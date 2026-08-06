#!/usr/bin/env bash
set -Eeuo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/safe-evaluate}"
BACKUP_DIR="${BACKUP_DIR:-/opt/safe-evaluate-backups}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:8000/api/health}"
ARCHIVE=''
REVISION=''
SNAPSHOT_ARCHIVE=''
DEPLOYMENT_MUTATED=false
COMPOSE_COMMAND=()

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage: deploy-production.sh --archive <release.tar.gz> --revision <git-sha>
EOF
}

while (($# > 0)); do
  case "$1" in
    --archive)
      (($# >= 2)) || die '--archive requires a value'
      ARCHIVE="$2"
      shift 2
      ;;
    --revision)
      (($# >= 2)) || die '--revision requires a value'
      REVISION="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      die "unknown argument: $1"
      ;;
  esac
done

[[ -n "$ARCHIVE" ]] || die '--archive is required'
[[ -r "$ARCHIVE" ]] || die "release archive is not readable: $ARCHIVE"
[[ "$REVISION" =~ ^[0-9a-f]{7,40}$ ]] || die '--revision must be a 7-40 character lowercase Git SHA'
[[ -d "$DEPLOY_DIR" ]] || die "deployment directory does not exist: $DEPLOY_DIR"

DEPLOY_DIR="$(cd "$DEPLOY_DIR" && pwd -P)"
[[ "$DEPLOY_DIR" != '/' ]] || die 'deployment directory must not be the filesystem root'
mkdir -p "$BACKUP_DIR"
BACKUP_DIR="$(cd "$BACKUP_DIR" && pwd -P)"

WORK_DIR="$(mktemp -d "$BACKUP_DIR/.deploy-${REVISION}-XXXXXX")"
cleanup() {
  rm -rf -- "$WORK_DIR"
}
trap cleanup EXIT

required_paths=(
  backend
  frontend/dist
  frontend-public/dist
  frontend-leadership/dist
  website/dist
  nginx.conf
  docker-compose.yml
)

is_protected_path() {
  local entry="$1"
  case "$entry" in
    .env|.env/*|backend/data|backend/data/*|requirement|requirement/*|ssl|ssl/*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

is_allowed_path() {
  local entry="$1"
  case "$entry" in
    backend|backend/*|frontend|frontend/dist|frontend/dist/*|frontend-public|frontend-public/dist|frontend-public/dist/*|frontend-leadership|frontend-leadership/dist|frontend-leadership/dist/*|website|website/dist|website/dist/*|nginx.conf|docker-compose.yml)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

validate_archive() {
  local entry normalized required found
  local entries=()

  while IFS= read -r entry; do
    normalized="${entry%/}"
    [[ -n "$normalized" ]] || die 'release archive contains an empty path'
    [[ "$normalized" != /* && "$normalized" != ../* && "$normalized" != *'/../'* && "$normalized" != '..' ]] || die "release archive contains an unsafe path: $entry"
    is_protected_path "$normalized" && die "release archive contains a protected path: $entry"
    is_allowed_path "$normalized" || die "release archive contains an unsupported path: $entry"
    entries+=("$normalized")
  done < <(tar -tzf "$ARCHIVE")

  ((${#entries[@]} > 0)) || die 'release archive is empty'

  while IFS= read -r entry; do
    case "${entry:0:1}" in
      l|h)
        die "release archive contains a link entry: $entry"
        ;;
    esac
  done < <(tar -tvzf "$ARCHIVE")

  for required in "${required_paths[@]}"; do
    found=false
    for entry in "${entries[@]}"; do
      if [[ "$entry" == "$required" || "$entry" == "$required/"* ]]; then
        found=true
        break
      fi
    done
    "$found" || die "release archive is missing required path: $required"
  done
}

resolve_compose() {
  if docker compose version >/dev/null 2>&1; then
    printf 'docker compose\n'
  elif command -v docker-compose >/dev/null 2>&1; then
    printf 'docker-compose\n'
  else
    die 'neither docker compose nor docker-compose is available'
  fi
}

create_snapshot() {
  local timestamp snapshot_dir
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  snapshot_dir="$BACKUP_DIR/${timestamp}-${REVISION}"
  mkdir -p "$snapshot_dir"
  SNAPSHOT_ARCHIVE="$snapshot_dir/payload.tar.gz"

  local snapshot_paths=(
    backend
    frontend/dist
    frontend-public/dist
    frontend-leadership/dist
    website/dist
    nginx.conf
    docker-compose.yml
  )
  [[ -f "$DEPLOY_DIR/.last-deployed-revision" ]] && snapshot_paths+=(.last-deployed-revision)

  tar -C "$DEPLOY_DIR" \
    --exclude='backend/data' \
    --exclude='backend/data/**' \
    -czf "$SNAPSHOT_ARCHIVE" \
    "${snapshot_paths[@]}"
}

clear_deployable_paths() {
  local child
  shopt -s nullglob dotglob
  mkdir -p "$DEPLOY_DIR/backend"
  for child in "$DEPLOY_DIR/backend"/*; do
    [[ "$(basename "$child")" == 'data' ]] && continue
    rm -rf -- "$child"
  done
  shopt -u nullglob dotglob

  rm -rf -- \
    "$DEPLOY_DIR/frontend/dist" \
    "$DEPLOY_DIR/frontend-public/dist" \
    "$DEPLOY_DIR/frontend-leadership/dist" \
    "$DEPLOY_DIR/website/dist"
  rm -f -- \
    "$DEPLOY_DIR/nginx.conf" \
    "$DEPLOY_DIR/docker-compose.yml" \
    "$DEPLOY_DIR/.last-deployed-revision"
}

apply_release() {
  local extracted_dir="$WORK_DIR/release"
  mkdir -p "$extracted_dir"
  tar --no-same-owner --no-same-permissions -xzf "$ARCHIVE" -C "$extracted_dir"

  clear_deployable_paths
  cp -a "$extracted_dir/backend/." "$DEPLOY_DIR/backend/"
  mkdir -p "$DEPLOY_DIR/frontend" "$DEPLOY_DIR/frontend-public" \
    "$DEPLOY_DIR/frontend-leadership" "$DEPLOY_DIR/website"
  cp -a "$extracted_dir/frontend/dist" "$DEPLOY_DIR/frontend/"
  cp -a "$extracted_dir/frontend-public/dist" "$DEPLOY_DIR/frontend-public/"
  cp -a "$extracted_dir/frontend-leadership/dist" "$DEPLOY_DIR/frontend-leadership/"
  cp -a "$extracted_dir/website/dist" "$DEPLOY_DIR/website/"
  cp -a "$extracted_dir/nginx.conf" "$DEPLOY_DIR/nginx.conf"
  cp -a "$extracted_dir/docker-compose.yml" "$DEPLOY_DIR/docker-compose.yml"
  printf '%s\n' "$REVISION" > "$DEPLOY_DIR/.last-deployed-revision"
}

restore_snapshot() {
  [[ -n "$SNAPSHOT_ARCHIVE" && -r "$SNAPSHOT_ARCHIVE" ]] || return 1
  clear_deployable_paths
  tar --no-same-owner --no-same-permissions -xzf "$SNAPSHOT_ARCHIVE" -C "$DEPLOY_DIR"
}

run_compose() {
  (cd "$DEPLOY_DIR" && "${COMPOSE_COMMAND[@]}" up -d --build)
}

wait_for_health() {
  local attempt
  for attempt in $(seq 1 12); do
    if curl --fail --silent --show-error "$HEALTH_URL" >/dev/null; then
      return 0
    fi
    printf 'Health check %s/12 failed; retrying...\n' "$attempt" >&2
    sleep 5
  done
  return 1
}

rollback_and_fail() {
  local status="$1"
  trap - ERR
  printf 'Deployment failed; restoring %s\n' "$SNAPSHOT_ARCHIVE" >&2
  if ! restore_snapshot; then
    printf 'Rollback failed while restoring the snapshot. Manual recovery is required.\n' >&2
    exit "$status"
  fi
  if ! run_compose; then
    printf 'Rollback restored files but could not restart the previous containers. Manual recovery is required.\n' >&2
  fi
  exit "$status"
}

on_error() {
  local status="$?"
  if [[ "$DEPLOYMENT_MUTATED" == true ]]; then
    rollback_and_fail "$status"
  fi
  exit "$status"
}
trap on_error ERR

validate_archive
read -r -a COMPOSE_COMMAND <<< "$(resolve_compose)"
create_snapshot
DEPLOYMENT_MUTATED=true
apply_release
run_compose
wait_for_health
DEPLOYMENT_MUTATED=false
printf 'Deployment completed: %s\n' "$REVISION"
