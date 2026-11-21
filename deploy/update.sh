#!/bin/sh
# Backs up and updates the running stack (docs/admin/deployment.md, Updating).
# Usage: deploy/update.sh [--no-pull]
# Run on the VM in the repository folder. Steps: refuse local edits to tracked files, fetch, stop if
# nothing is new, make a backup (deploy/backup-now.sh), fast-forward to the fetched commit, rebuild
# and recreate every service, then wait until PocketBase and Caddy answer /api/health.
# --no-pull skips git (option C of the guide: the new files were unpacked by hand) and always rebuilds.
# Reads the admin email and password from standard input, two lines, as backup-now.sh does.
# Env: KWNTO_COMPOSE_FILES (default "-f compose.prod.yaml"), PB (default: pocketbase's address on the
# compose network), KWNTO_HEALTH_SECONDS (default 180).
set -eu

COMPOSE_FILES=${KWNTO_COMPOSE_FILES:--f compose.prod.yaml}
HEALTH_SECONDS=${KWNTO_HEALTH_SECONDS:-180}
SCRIPT_DIR=$(cd "$(dirname -- "$0")" && pwd)

PULL=1
case "${1:-}" in
  --no-pull) PULL=0; shift ;;
  "") ;;
  *) echo "Usage: deploy/update.sh [--no-pull]" >&2; exit 2 ;;
esac
[ $# -eq 0 ] || { echo "Usage: deploy/update.sh [--no-pull]" >&2; exit 2; }

die() {
  echo "$1" >&2
  exit 1
}

# $COMPOSE_FILES is deliberately unquoted: it holds several words ("-f a.yaml -f b.yaml").
compose() {
  # shellcheck disable=SC2086
  docker compose $COMPOSE_FILES "$@"
}

# 1. Is there anything to update? Checked before the backup, so "nothing new" costs nothing.
OLD=""
if [ "$PULL" -eq 1 ]; then
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 \
    || die "This folder is not a git checkout. If you unpacked the new files by hand, run: deploy/update.sh --no-pull"
  [ -z "$(git status --porcelain --untracked-files=no)" ] \
    || die "Tracked files were changed on this machine (git status shows them). Commit, stash or undo them first; nothing was changed."
  git fetch --quiet || die "git fetch failed; nothing was changed."
  NEW=$(git rev-parse '@{u}' 2>/dev/null) || die "The current branch has no upstream to update from; nothing was changed."
  OLD=$(git rev-parse HEAD)
  if [ "$OLD" = "$NEW" ]; then
    echo "Already up to date ($(git log -1 --format='%h %s' HEAD)); nothing changed."
    exit 0
  fi
  git merge-base --is-ancestor HEAD '@{u}' \
    || die "This checkout has commits that are not upstream, so it cannot fast-forward; nothing was changed."
  echo "Updating $(git log -1 --format=%h "$OLD") to $(git log -1 --format='%h %s' "$NEW")"
fi

# 2. Backup first. The backup needs the running pocketbase.
if [ -z "${PB:-}" ]; then
  CONTAINER=$(compose ps -q pocketbase 2>/dev/null | head -n 1) || CONTAINER=""
  [ -n "$CONTAINER" ] || die "pocketbase is not running, so no backup can be made; nothing was changed. Start it with: docker compose $COMPOSE_FILES up -d"
  PB_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$CONTAINER")
  PB="http://$PB_IP:8090"
fi
[ -t 0 ] && echo "Backup first. Admin email, then password (not shown):" >&2
OUT=$(PB="$PB" sh "$SCRIPT_DIR/backup-now.sh") || die "The backup failed (see above); nothing was changed."
BACKUP=$(printf '%s\n' "$OUT" | sed -n 's/^Backup written: //p')
echo "Backup written: $BACKUP"

# 3. New code, then rebuild. --force-recreate makes the one-shot web service build the app again.
if [ "$PULL" -eq 1 ]; then
  git merge --ff-only --quiet '@{u}' || die "git could not fast-forward; the stack was not touched. Backup: $BACKUP"
fi

rollback_help() {
  echo "The update did not finish. Data was backed up first as backups/$BACKUP." >&2
  if [ -n "$OLD" ]; then
    echo "To go back to the previous version: git reset --keep $OLD && docker compose $COMPOSE_FILES up -d --build --force-recreate" >&2
  fi
  echo "If the new version changed or damaged data, restore the backup: deploy/restore.sh backups/$BACKUP" >&2
  echo "Logs: docker compose $COMPOSE_FILES logs --tail 100 web pocketbase caddy" >&2
}

if ! compose up -d --build --force-recreate; then
  rollback_help
  exit 1
fi

# 4. Wait for both PocketBase and the public proxy (Caddy) to answer.
i=0
while [ "$i" -lt "$HEALTH_SECONDS" ]; do
  if compose exec -T pocketbase wget -qO- http://127.0.0.1:8090/api/health >/dev/null 2>&1 \
    && compose exec -T caddy wget -qO- http://127.0.0.1:8080/api/health >/dev/null 2>&1; then
    if [ "$PULL" -eq 1 ]; then
      echo "Updated to $(git log -1 --format='%h %s' HEAD)"
    else
      echo "Rebuilt and restarted"
    fi
    exit 0
  fi
  i=$((i + 1))
  sleep 1
done
echo "PocketBase or Caddy did not answer /api/health within $HEALTH_SECONDS seconds." >&2
rollback_help
exit 1
