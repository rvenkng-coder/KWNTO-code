#!/bin/sh
# Restores ALL data from a backup zip (plan 6 D11). Usage: deploy/restore.sh [--yes] <backup.zip>
# Offline procedure: stop pocketbase, empty the data volume with a throwaway container of the same
# image, unzip the backup into it, start pocketbase. It works when the app will not start.
# Env: KWNTO_COMPOSE_FILES (default "-f compose.prod.yaml"), KWNTO_DATA_VOLUME (default kwnto-data).
set -eu

COMPOSE_FILES=${KWNTO_COMPOSE_FILES:--f compose.prod.yaml}
VOLUME=${KWNTO_DATA_VOLUME:-kwnto-data}
IMAGE=kwnto-pocketbase:dev

YES=0
if [ "${1:-}" = "--yes" ]; then
  YES=1
  shift
fi
FILE=${1:-}
if [ -z "$FILE" ] || [ $# -gt 1 ]; then
  echo "Usage: deploy/restore.sh [--yes] <backup.zip>" >&2
  exit 2
fi
if [ ! -f "$FILE" ]; then
  echo "No such backup: $FILE" >&2
  exit 2
fi
# A zip starts with "PK".
if [ "$(head -c 2 -- "$FILE")" != "PK" ]; then
  echo "Not a zip file: $FILE" >&2
  exit 2
fi
ABS="$(cd "$(dirname -- "$FILE")" && pwd)/$(basename -- "$FILE")"

# Integrity check BEFORE anything is stopped or emptied: a cut-off or empty zip starts with "PK" too.
# A throwaway container of the same image (it has unzip), nothing mounted but the zip.
if ! docker run --rm --user 10001:10001 --entrypoint sh -v "$ABS:/restore/backup.zip:ro" "$IMAGE" \
  -c 'unzip -tq /restore/backup.zip' >/dev/null 2>&1; then
  echo "Backup is damaged: $FILE" >&2
  exit 2
fi

if [ "$YES" -ne 1 ]; then
  printf 'This replaces ALL data with %s. Type RESTORE to continue: ' "$FILE"
  ANSWER=""
  IFS= read -r ANSWER || true
  if [ "$ANSWER" != "RESTORE" ]; then
    echo
    echo "Nothing changed."
    exit 1
  fi
fi

# $COMPOSE_FILES is deliberately unquoted: it holds several words ("-f a.yaml -f b.yaml").
# shellcheck disable=SC2086
docker compose $COMPOSE_FILES stop pocketbase

# Runs as uid 10001 (the user PocketBase runs as), so the restored files belong to it.
if ! docker run --rm --user 10001:10001 --entrypoint sh \
  -v "$VOLUME:/pb/pb_data" -v "$ABS:/restore/backup.zip:ro" "$IMAGE" \
  -c 'find /pb/pb_data -mindepth 1 -delete && unzip -q /restore/backup.zip -d /pb/pb_data'; then
  echo "Restore failed after the data folder was emptied; pocketbase is stopped. Run the restore again with a good backup." >&2
  exit 1
fi

# shellcheck disable=SC2086
docker compose $COMPOSE_FILES start pocketbase

i=0
while [ "$i" -lt 60 ]; do
  # shellcheck disable=SC2086
  if docker compose $COMPOSE_FILES exec -T pocketbase wget -qO- http://127.0.0.1:8090/api/health >/dev/null 2>&1; then
    echo "Restored from $FILE"
    exit 0
  fi
  i=$((i + 1))
  sleep 1
done
echo "PocketBase did not answer within 60 seconds after the restore; see: docker compose $COMPOSE_FILES logs pocketbase" >&2
exit 1
