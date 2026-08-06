# GitHub Actions Production Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically build, publish, health-check, and safely roll back the production site whenever a reviewed change reaches `main`.

**Architecture:** A GitHub Actions workflow builds the four Vite applications and packages only deployable code and static assets. It authenticates to the server with an SSH key stored in GitHub Secrets and invokes a versioned Bash deployment script. The server script snapshots replaceable files, preserves all persistent and secret paths, restarts Docker Compose, and restores the snapshot if the API health check fails.

**Tech Stack:** GitHub Actions, Node.js 22, npm, Bash, OpenSSH, GNU tar, Docker Compose, FastAPI health endpoint.

## Global Constraints

- Trigger automatically only for pushes to `main`, and expose `workflow_dispatch` for manual re-release.
- Never include, delete, replace, or read `.env`, `backend/data/`, `requirement/`, or `ssl/` in the release archive or rollback routine.
- Use `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PORT`, `DEPLOY_SSH_KEY`, and `DEPLOY_KNOWN_HOSTS` as GitHub Secrets; never print them.
- Serialize production deployments with GitHub Actions concurrency; do not cancel an in-progress deployment.
- Deploy to `/opt/safe-evaluate`; save backups outside it at `/opt/safe-evaluate-backups`.
- Treat `http://127.0.0.1:8000/api/health` as the release health check.

---

## File Structure

- Create `.github/workflows/deploy-production.yml`: Builds, tests, packages, uploads, and remotely executes a deployment for `main` pushes or a manual run.
- Create `scripts/deploy-production.sh`: Server-side argument validation, archive validation, snapshot, restart, health check, and rollback implementation.
- Create `scripts/test-deploy-production.sh`: Hermetic Bash integration tests using temporary directories and fake `docker`/`curl` commands.
- Create `docs/deployment/github-actions-auto-deploy.md`: One-time server preparation, GitHub Secret setup, release operation, troubleshooting, and emergency rollback guide.

### Task 1: Server deployment script test harness

**Files:**
- Create: `scripts/test-deploy-production.sh`
- Test: `scripts/test-deploy-production.sh`

**Interfaces:**
- Consumes: `scripts/deploy-production.sh`, invoked as `DEPLOY_DIR=<path> BACKUP_DIR=<path> PATH=<fake-bin> ./scripts/deploy-production.sh --archive <file> --revision <sha>`.
- Produces: A zero-exit test command that proves success deployment, health-check rollback, and persistent-path protection before the production script is added to CI.

- [ ] **Step 1: Write a failing hermetic test script**

Create a POSIX/Bash test that creates a temporary deployment tree containing these sentinel files:

```bash
mkdir -p "$deploy_dir/backend/data" "$deploy_dir/requirement" "$deploy_dir/ssl"
printf 'old backend\n' > "$deploy_dir/backend/app.py"
printf 'secret\n' > "$deploy_dir/.env"
printf 'report\n' > "$deploy_dir/backend/data/report.json"
printf 'rule\n' > "$deploy_dir/requirement/rule.docx"
printf 'certificate\n' > "$deploy_dir/ssl/cert.pem"
```

Build a valid archive containing new `backend/app.py`, the four `dist` directories, `nginx.conf`, and `docker-compose.yml`. Add fake `docker` and `curl` executables to `$PATH`; use an environment flag so `curl` can return either 0 or 1. Assert that a successful run changes `backend/app.py` but leaves every sentinel unchanged. Assert that a failed-health run exits nonzero and restores `backend/app.py` to its previous value.

- [ ] **Step 2: Verify the test fails before implementation**

Run:

```bash
bash scripts/test-deploy-production.sh
```

Expected: FAIL because `scripts/deploy-production.sh` does not yet exist.

- [ ] **Step 3: Add archive-rejection coverage**

Extend the same test with an archive containing `backend/data/overwrite.json`, then invoke the script and assert a nonzero exit while `backend/data/report.json` remains `report`. This fixes the exact protected-path contract that later implementation must honor.

- [ ] **Step 4: Commit the failing test harness**

```bash
git add scripts/test-deploy-production.sh
git commit -m "test: define production deployment safety contract"
```

### Task 2: Transactional server deployment and rollback script

**Files:**
- Create: `scripts/deploy-production.sh`
- Modify: `scripts/test-deploy-production.sh`
- Test: `scripts/test-deploy-production.sh`

**Interfaces:**
- Consumes: `--archive <absolute-or-relative-tar.gz>` and `--revision <7-to-40-character-git-sha>`; optional environment variables `DEPLOY_DIR` and `BACKUP_DIR`.
- Produces: Exit status 0 only after `docker compose up -d --build` and `/api/health` succeed. On a post-extraction failure, restores the immediately preceding snapshot and exits nonzero.

- [ ] **Step 1: Implement strict argument and archive validation**

Create `scripts/deploy-production.sh` with `#!/usr/bin/env bash` and `set -Eeuo pipefail`. Parse only `--archive` and `--revision`; reject missing arguments, unreadable archives, revisions that do not match `^[0-9a-f]{7,40}$`, and unknown options.

List the archive with `tar -tzf "$archive"` and reject every entry except these exact roots:

```text
backend/
frontend/dist/
frontend-public/dist/
frontend-leadership/dist/
website/dist/
nginx.conf
docker-compose.yml
```

Explicitly reject an entry that equals or begins with `.env`, `backend/data/`, `requirement/`, `ssl/`, `../`, or `/`. Require all six deployable roots to be present before extracting.

- [ ] **Step 2: Implement snapshot, deploy, and health-check functions**

Implement the following functions in the deployment script:

```bash
resolve_compose()      # prints "docker compose" or "docker-compose", otherwise exits 1
create_snapshot()      # creates $BACKUP_DIR/<UTC timestamp>-<revision>/payload.tar.gz
restore_snapshot()     # restores only the six deployable roots from payload.tar.gz
wait_for_health()      # retries curl --fail --silent http://127.0.0.1:8000/api/health 12 times, 5 seconds apart
rollback_and_fail()    # restore snapshot, run compose up -d --build, then exit 1
```

Snapshot and restore only `backend/` excluding `backend/data/`, the four `dist` paths, `nginx.conf`, and `docker-compose.yml`. Extract into a temporary directory under `$BACKUP_DIR`, then copy only the validated paths into `$DEPLOY_DIR`; use `tar --no-same-owner` and never recursively delete `$DEPLOY_DIR`.

After extraction, write the revision to `$DEPLOY_DIR/.last-deployed-revision`; this file is not secret and must be included in the snapshot/restore set only if it already exists.

- [ ] **Step 3: Run the safety contract tests**

Run:

```bash
bash scripts/test-deploy-production.sh
```

Expected: PASS for successful deployment, failed-health rollback, and protected archive rejection. Confirm the test uses no real Docker daemon and no network access.

- [ ] **Step 4: Perform syntax and static safety checks**

Run:

```bash
bash -n scripts/deploy-production.sh
grep -nE 'rm[[:space:]]+-[A-Za-z]*r|backend/data|requirement|\.env|ssl' scripts/deploy-production.sh
```

Expected: Bash syntax succeeds; all persistent-path references are validation or explicit exclusions, and the script contains no recursive removal of `$DEPLOY_DIR`.

- [ ] **Step 5: Commit the deployment script and passing tests**

```bash
git add scripts/deploy-production.sh scripts/test-deploy-production.sh
git commit -m "feat: add safe production deployment script"
```

### Task 3: GitHub Actions build, package, and SSH delivery workflow

**Files:**
- Create: `.github/workflows/deploy-production.yml`
- Test: `.github/workflows/deploy-production.yml`

**Interfaces:**
- Consumes: a `push` to `main` or `workflow_dispatch`, repository content, and the five declared GitHub Secrets.
- Produces: a checked release archive at `release/safe-evaluate-${GITHUB_SHA}.tar.gz`, an SSH upload to `/tmp`, and a remote invocation of `scripts/deploy-production.sh`.

- [ ] **Step 1: Write the workflow contract in YAML**

Create a workflow named `Deploy production` with:

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: safe-evaluate-production
  cancel-in-progress: false

permissions:
  contents: read
```

Use Ubuntu latest, `actions/checkout@v7` with `persist-credentials: false`, and `actions/setup-node@v7` with `node-version: 22` and `package-manager-cache: false`. Do not grant write permissions, use a personal access token, or use third-party SSH actions.

- [ ] **Step 2: Add deterministic frontend build and test commands**

Implement four explicit `working-directory` steps, matching the existing `scripts/build-frontends.ps1` contract:

```bash
# website
npm ci && npm run lint && npm test -- --run && npm run build

# frontend-public, frontend-leadership, frontend
npm ci && npm test -- --run && npm run build
```

In a separate step, run `bash scripts/test-deploy-production.sh` so production deployment semantics are tested before any network connection is made.

- [ ] **Step 3: Package only reviewed deployable paths**

Create `release/` and package this exact list after all builds succeed:

```bash
tar -czf "release/safe-evaluate-${GITHUB_SHA}.tar.gz" \
  backend frontend/dist frontend-public/dist frontend-leadership/dist website/dist \
  nginx.conf docker-compose.yml
```

Before uploading, list the archive and fail the job if `tar -tzf` finds `.env`, `backend/data/`, `requirement/`, `ssl/`, an absolute path, or `..` path segment.

- [ ] **Step 4: Add noninteractive SSH upload and remote invocation**

Create a temporary key file with mode 600 from `secrets.DEPLOY_SSH_KEY`; write `secrets.DEPLOY_KNOWN_HOSTS` to a temporary known-hosts file. Set SSH options to use only these two files and `StrictHostKeyChecking=yes`.

Upload the archive and deployment script to `/tmp/safe-evaluate-${GITHUB_SHA}.tar.gz` and `/tmp/deploy-production-${GITHUB_SHA}.sh` with `scp -P "${DEPLOY_PORT:-22}"`. Run:

```bash
ssh -p "${DEPLOY_PORT:-22}" "$DEPLOY_USER@$DEPLOY_HOST" \
  "chmod 700 /tmp/deploy-production-${GITHUB_SHA}.sh && \
   DEPLOY_DIR=/opt/safe-evaluate BACKUP_DIR=/opt/safe-evaluate-backups \
   /tmp/deploy-production-${GITHUB_SHA}.sh \
   --archive /tmp/safe-evaluate-${GITHUB_SHA}.tar.gz --revision ${GITHUB_SHA}"
```

Use GitHub Actions masking for all secrets; delete the local temporary key and known-hosts files in an `if: always()` cleanup step.

- [ ] **Step 5: Validate workflow structure without production credentials**

Run locally if available:

```bash
docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest
```

Expected: no workflow syntax or expression errors. If Docker is unavailable locally, commit the workflow and validate it by manually dispatching it only after the documented Secrets setup is complete; a build failure must occur before any SSH step.

- [ ] **Step 6: Commit the workflow**

```bash
git add .github/workflows/deploy-production.yml
git commit -m "ci: automate production deployment from main"
```

### Task 4: Administrator setup and operating guide

**Files:**
- Create: `docs/deployment/github-actions-auto-deploy.md`
- Test: `docs/deployment/github-actions-auto-deploy.md`

**Interfaces:**
- Consumes: an Ubuntu/Debian production server with Docker Compose and the `SafeEvaluate` checkout at `/opt/safe-evaluate`.
- Produces: a least-privilege `deployer` account, GitHub Secrets values, and reproducible manual verification/rollback steps for administrators.

- [ ] **Step 1: Document one-time server preparation with exact commands**

Provide commands an administrator runs as root:

```bash
adduser --disabled-password --gecos '' deployer
usermod -aG docker deployer
install -d -m 700 -o deployer -g deployer /home/deployer/.ssh
install -d -m 750 -o deployer -g deployer /opt/safe-evaluate-backups
chown deployer:deployer /opt/safe-evaluate/backend
find /opt/safe-evaluate/backend -mindepth 1 -maxdepth 1 ! -name data -exec chown -R deployer:deployer {} +
chown -R deployer:deployer /opt/safe-evaluate/frontend /opt/safe-evaluate/frontend-public /opt/safe-evaluate/frontend-leadership /opt/safe-evaluate/website
chown deployer:deployer /opt/safe-evaluate/nginx.conf /opt/safe-evaluate/docker-compose.yml
chown root:deployer /opt/safe-evaluate/.env
chmod 640 /opt/safe-evaluate/.env
```

Then document appending the generated public key to `/home/deployer/.ssh/authorized_keys` with `chmod 600` and `chown deployer:deployer`. State that the private key must be generated on an administrator device with `ssh-keygen -t ed25519 -f safe-evaluate-github-deploy -C github-actions-deploy` and is never copied to the server.

- [ ] **Step 2: Document secret setup and host-key verification**

List each GitHub Secret name, exact source, and destination: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PORT`, `DEPLOY_SSH_KEY`, and `DEPLOY_KNOWN_HOSTS`.

Require the administrator to collect the server’s displayed Ed25519 fingerprint from a trusted console and compare it before storing the output of:

```bash
ssh-keyscan -p 22 -t ed25519 YOUR_SERVER_HOST
```

in `DEPLOY_KNOWN_HOSTS`. Do not describe accepting an unverified SSH fingerprint.

- [ ] **Step 3: Document first-release verification and emergency response**

Explain how to merge a harmless PR to `main` or use Actions → `Deploy production` → `Run workflow`, then verify workflow logs, `/api/health`, `/`, `/evaluate`, and an existing report. Include commands for locating a backup, reviewing `.last-deployed-revision`, and manually restoring only deployable paths using `scripts/deploy-production.sh` failure logs; explicitly prohibit deleting or restoring `backend/data/`, `.env`, `requirement/`, or `ssl/` during rollback.

- [ ] **Step 4: Check documentation links and command formatting**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only the four deployment files are staged for this feature commit sequence.

- [ ] **Step 5: Commit the operations guide**

```bash
git add docs/deployment/github-actions-auto-deploy.md
git commit -m "docs: explain GitHub Actions deployment setup"
```

## Final Verification

- [ ] Run `bash scripts/test-deploy-production.sh` locally.
- [ ] Run all four frontend build/test command groups from the workflow locally or in GitHub Actions.
- [ ] Validate `.github/workflows/deploy-production.yml` with `actionlint`.
- [ ] Configure the five GitHub Secrets, complete server preparation, and manually dispatch the workflow once.
- [ ] Verify the workflow reports the deployed revision, `/api/health` returns HTTP 200, and the deployed site routes `/`, `/evaluate`, `/leader-assistant/`, and `/evaluate_tianxin` still work.
- [ ] Confirm existing reports and images remain present after the first automated deployment.
