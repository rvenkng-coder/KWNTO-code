#!/bin/sh
set -eu

if [ -z "${KWNTO_ADMIN_EMAIL:-}" ] || [ -z "${KWNTO_ADMIN_PASSWORD:-}" ]; then
  echo "KWNTO_ADMIN_EMAIL and KWNTO_ADMIN_PASSWORD must be set" >&2
  exit 64
fi
if [ "${#KWNTO_ADMIN_PASSWORD}" -lt 10 ]; then
  echo "KWNTO_ADMIN_PASSWORD must be at least 10 characters" >&2
  exit 64
fi
if [ "${KWNTO_PRODUCTION:-}" = "1" ]; then
  case "${KWNTO_PUBLIC_URL:-}" in
    https://?*) ;;
    *)
      echo "KWNTO_PUBLIC_URL must be set when KWNTO_PRODUCTION=1" >&2
      exit 64
      ;;
  esac
fi

exec /pb/pocketbase serve --http=0.0.0.0:8090 --dir=/pb/pb_data \
  --migrationsDir=/pb/pb_migrations --hooksDir=/pb/pb_hooks \
  --publicDir=/pb/pb_public
