#!/bin/sh
# Makes a backup now (plan 6 D10). Usage: PB=<private address> deploy/backup-now.sh
# Reads the admin email and password from standard input, two lines, never from arguments.
# The password and the token reach curl only on its standard input (security.md 9), so they
# never show in the process list.
set -eu

: "${PB:?PB must be the backend's private address, for example http://127.0.0.1:8090}"

IFS= read -r ADMIN_EMAIL || { echo "Expected the admin email on the first line of standard input" >&2; exit 1; }
# At a terminal the password is typed without echo; piped input is unaffected.
if [ -t 0 ]; then
  stty -echo
  trap 'stty echo' EXIT
fi
IFS= read -r ADMIN_PASSWORD || { echo "Expected the admin password on the second line of standard input" >&2; exit 1; }
if [ -t 0 ]; then
  stty echo
  echo
fi

# Puts a value into JSON text: a backslash and a double quote each get a backslash before them.
json_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

message_of() {
  sed -n -E 's/.*"message":"([^"]*)".*/\1/p' | head -n 1
}

AUTH=$(printf '{"identity":"%s","password":"%s"}' "$(json_escape "$ADMIN_EMAIL")" "$(json_escape "$ADMIN_PASSWORD")" \
  | curl -s -w '\n%{http_code}' -X POST "$PB/api/collections/_superusers/auth-with-password" \
      -H 'Content-Type: application/json' --data-binary @-) || { echo "Could not reach $PB" >&2; exit 1; }
unset ADMIN_PASSWORD
AUTH_CODE=$(printf '%s\n' "$AUTH" | tail -n 1)
AUTH_BODY=$(printf '%s\n' "$AUTH" | sed '$d')
case "$AUTH_CODE" in
  2??) ;;
  *) echo "Sign-in failed: $(printf '%s' "$AUTH_BODY" | message_of)" >&2; exit 1 ;;
esac
TOKEN=$(printf '%s' "$AUTH_BODY" | sed -n -E 's/.*"token":"([^"]+)".*/\1/p')
[ -n "$TOKEN" ] || { echo "Sign-in gave no token" >&2; exit 1; }

NAME="manual_$(date -u +%Y%m%d_%H%M%S).zip"
RESULT=$(printf 'header = "Authorization: %s"\n' "$TOKEN" \
  | curl -s -w '\n%{http_code}' -X POST "$PB/api/backups" \
      -H 'Content-Type: application/json' -d "{\"name\":\"$NAME\"}" --config -) || { echo "Could not reach $PB" >&2; exit 1; }
unset TOKEN
CODE=$(printf '%s\n' "$RESULT" | tail -n 1)
BODY=$(printf '%s\n' "$RESULT" | sed '$d')
case "$CODE" in
  2??) echo "Backup written: $NAME" ;;
  *) echo "Backup failed: $(printf '%s' "$BODY" | message_of)" >&2; exit 1 ;;
esac
