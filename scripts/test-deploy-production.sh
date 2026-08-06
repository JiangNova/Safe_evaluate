#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_SCRIPT="$PROJECT_ROOT/scripts/deploy-production.sh"
TEST_ROOT="$(mktemp -d)"

cleanup() {
  rm -rf "$TEST_ROOT"
}
trap cleanup EXIT

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

assert_file_equals() {
  local path="$1"
  local expected="$2"
  local actual
  actual="$(cat "$path")"
  [[ "$actual" == "$expected" ]] || fail "expected $path to contain '$expected', got '$actual'"
}

create_release() {
  local archive="$1"
  local include_protected_path="${2:-false}"
  local staging="$TEST_ROOT/release-$(basename "$archive" .tar.gz)"

  mkdir -p \
    "$staging/backend" \
    "$staging/frontend/dist" \
    "$staging/frontend-public/dist" \
    "$staging/frontend-leadership/dist" \
    "$staging/website/dist"
  printf 'new backend\n' > "$staging/backend/app.py"
  printf 'frontend\n' > "$staging/frontend/dist/index.html"
  printf 'public\n' > "$staging/frontend-public/dist/index.html"
  printf 'leadership\n' > "$staging/frontend-leadership/dist/index.html"
  printf 'website\n' > "$staging/website/dist/index.html"
  printf 'server {}\n' > "$staging/nginx.conf"
  printf 'services: {}\n' > "$staging/docker-compose.yml"

  if [[ "$include_protected_path" == 'true' ]]; then
    mkdir -p "$staging/backend/data"
    printf 'overwrite\n' > "$staging/backend/data/overwrite.json"
  fi

  tar -czf "$archive" -C "$staging" \
    backend frontend/dist frontend-public/dist frontend-leadership/dist website/dist \
    nginx.conf docker-compose.yml
}

create_deployment_tree() {
  local deploy_dir="$1"
  mkdir -p "$deploy_dir/backend/data" "$deploy_dir/requirement" "$deploy_dir/ssl"
  printf 'old backend\n' > "$deploy_dir/backend/app.py"
  printf 'secret\n' > "$deploy_dir/.env"
  printf 'report\n' > "$deploy_dir/backend/data/report.json"
  printf 'rule\n' > "$deploy_dir/requirement/rule.docx"
  printf 'certificate\n' > "$deploy_dir/ssl/cert.pem"
  printf 'old nginx\n' > "$deploy_dir/nginx.conf"
  printf 'services: {old}\n' > "$deploy_dir/docker-compose.yml"
  mkdir -p "$deploy_dir/frontend/dist" "$deploy_dir/frontend-public/dist" \
    "$deploy_dir/frontend-leadership/dist" "$deploy_dir/website/dist"
}

create_fake_commands() {
  local fake_bin="$1"
  mkdir -p "$fake_bin"

  cat > "$fake_bin/docker" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
printf 'docker %s\n' "$*" >> "${FAKE_LOG:?}"
exit "${FAKE_DOCKER_EXIT:-0}"
EOF

  cat > "$fake_bin/curl" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
exit "${FAKE_CURL_EXIT:-0}"
EOF

  cat > "$fake_bin/sleep" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF

  chmod +x "$fake_bin/docker" "$fake_bin/curl" "$fake_bin/sleep"
}

run_deploy() {
  local deploy_dir="$1"
  local backup_dir="$2"
  local fake_bin="$3"
  local log_file="$4"
  local archive="$5"
  local curl_exit="$6"

  DEPLOY_DIR="$deploy_dir" \
  BACKUP_DIR="$backup_dir" \
  FAKE_LOG="$log_file" \
  FAKE_CURL_EXIT="$curl_exit" \
  PATH="$fake_bin:$PATH" \
  bash "$DEPLOY_SCRIPT" --archive "$archive" --revision deadbeef
}

test_success_keeps_persistent_paths() {
  local test_dir="$TEST_ROOT/success"
  local deploy_dir="$test_dir/deploy"
  local backup_dir="$test_dir/backups"
  local fake_bin="$test_dir/bin"
  local archive="$test_dir/release.tar.gz"
  local log_file="$test_dir/docker.log"

  mkdir -p "$test_dir"
  create_deployment_tree "$deploy_dir"
  create_fake_commands "$fake_bin"
  create_release "$archive"
  run_deploy "$deploy_dir" "$backup_dir" "$fake_bin" "$log_file" "$archive" 0

  assert_file_equals "$deploy_dir/backend/app.py" 'new backend'
  assert_file_equals "$deploy_dir/.env" 'secret'
  assert_file_equals "$deploy_dir/backend/data/report.json" 'report'
  assert_file_equals "$deploy_dir/requirement/rule.docx" 'rule'
  assert_file_equals "$deploy_dir/ssl/cert.pem" 'certificate'
  assert_file_equals "$deploy_dir/.last-deployed-revision" 'deadbeef'
  grep -q 'docker compose up -d --build' "$log_file" || fail 'docker compose was not invoked'
}

test_failed_health_restores_previous_release() {
  local test_dir="$TEST_ROOT/rollback"
  local deploy_dir="$test_dir/deploy"
  local backup_dir="$test_dir/backups"
  local fake_bin="$test_dir/bin"
  local archive="$test_dir/release.tar.gz"
  local log_file="$test_dir/docker.log"

  mkdir -p "$test_dir"
  create_deployment_tree "$deploy_dir"
  create_fake_commands "$fake_bin"
  create_release "$archive"

  if run_deploy "$deploy_dir" "$backup_dir" "$fake_bin" "$log_file" "$archive" 1; then
    fail 'deployment unexpectedly succeeded when health checks failed'
  fi

  assert_file_equals "$deploy_dir/backend/app.py" 'old backend'
  assert_file_equals "$deploy_dir/.env" 'secret'
  assert_file_equals "$deploy_dir/backend/data/report.json" 'report'
  grep -c 'docker compose up -d --build' "$log_file" | grep -q '^2$' || fail 'rollback did not restart the previous release'
}

test_protected_archive_path_is_rejected() {
  local test_dir="$TEST_ROOT/protected-path"
  local deploy_dir="$test_dir/deploy"
  local backup_dir="$test_dir/backups"
  local fake_bin="$test_dir/bin"
  local archive="$test_dir/release.tar.gz"
  local log_file="$test_dir/docker.log"

  mkdir -p "$test_dir"
  create_deployment_tree "$deploy_dir"
  create_fake_commands "$fake_bin"
  create_release "$archive" true

  if run_deploy "$deploy_dir" "$backup_dir" "$fake_bin" "$log_file" "$archive" 0; then
    fail 'deployment unexpectedly accepted backend/data in the release archive'
  fi

  assert_file_equals "$deploy_dir/backend/data/report.json" 'report'
}

test_success_keeps_persistent_paths
test_failed_health_restores_previous_release
test_protected_archive_path_is_rejected
printf 'PASS: production deployment safety contract\n'
