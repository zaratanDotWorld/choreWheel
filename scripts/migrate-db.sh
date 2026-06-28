#!/usr/bin/env bash
#
# migrate-db.sh — copy the ChoreWheel database from RDS (source) into Neon (target).
#
# One-time data-migration tool for the Render/Neon move (see MIGRATION.md).
# Idempotent: wraps a target schema reset + fresh restore in a SINGLE transaction,
# so a failed run leaves the target untouched and a successful run fully replaces
# it. Safe to run for the initial load and again for the cutover re-sync, and safe
# against a target that already holds stale data or an empty preDeploy-created
# schema. Streams pg_dump straight into psql — the dump carries Slack OAuth tokens,
# so nothing is ever written to disk.
#
# Usage (from the repo root):
#   SOURCE_URL=$(node -e "require('dotenv').config({quiet:true});process.stdout.write(process.env.PG_CONNECTION_PROD)") \
#   TARGET_URL=$(npx neonctl@latest connection-string --project-id noisy-poetry-20219969) \
#   ./scripts/migrate-db.sh
#
#   -y / FORCE=1   skip the confirmation prompt (non-interactive re-runs)
#
# Requires pg_dump/psql >= the source server major version (Postgres 17).

set -euo pipefail

if [[ "${1:-}" == "-y" || "${FORCE:-}" == "1" ]]; then CONFIRM=false; else CONFIRM=true; fi

: "${SOURCE_URL:?Set SOURCE_URL to the RDS connection string — see usage at top of script}"
: "${TARGET_URL:?Set TARGET_URL to the Neon DIRECT connection string — see usage at top of script}"

export PGSSLMODE="${PGSSLMODE:-require}"            # RDS enforces SSL; Neon requires it
export PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-10}"

mask()    { sed -E 's#(://[^:]+:)[^@]+(@)#\1********\2#'; }
host_of() { sed -E 's#.*@([^/?]+).*#\1#'; }

# pg_dump must be at least the source server major version (source is Postgres 17).
dump_major=$(pg_dump --version | grep -oE '[0-9]+' | head -1)
if (( dump_major < 17 )); then
  echo "ERROR: pg_dump is v${dump_major}; need >= 17 to dump the Postgres 17 source." >&2
  echo "       macOS: 'brew install postgresql@17', or use the /opt/homebrew/bin tools." >&2
  exit 1
fi

src_host=$(printf '%s' "$SOURCE_URL" | host_of)
tgt_host=$(printf '%s' "$TARGET_URL" | host_of)
if [[ "$src_host" == "$tgt_host" ]]; then
  echo "ERROR: source and target are the same host (${src_host}). Refusing to run." >&2
  exit 1
fi

echo "Source (read-only): $(printf '%s' "$SOURCE_URL" | mask)"
echo "Target (REPLACED):  $(printf '%s' "$TARGET_URL" | mask)"
echo

echo "Checking connectivity..."
psql "$SOURCE_URL" -tAc 'select 1' >/dev/null
psql "$TARGET_URL" -tAc 'select 1' >/dev/null
echo "  both reachable."

if $CONFIRM; then
  echo
  echo "This REPLACES all data in the target (${tgt_host}) with a fresh copy of the source."
  read -r -p "Type 'yes' to continue: " reply
  [[ "$reply" == "yes" ]] || { echo "Aborted."; exit 1; }
fi

echo
echo "Migrating (schema reset + restore, single transaction, streaming)..."
{
  echo 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'
  pg_dump "$SOURCE_URL" --no-owner --no-privileges --no-acl
} | psql "$TARGET_URL" --single-transaction -v ON_ERROR_STOP=1 -q
echo "  restore committed."

echo
echo "Verifying row counts (source vs target)..."
printf '%-34s %10s %10s\n' table source target
mismatch=0
while IFS= read -r t; do
  [[ -z "$t" ]] && continue
  s=$(psql "$SOURCE_URL" -tAc "select count(*) from \"$t\"")
  d=$(psql "$TARGET_URL" -tAc "select count(*) from \"$t\"")
  flag=""; [[ "$s" != "$d" ]] && { flag="  <-- MISMATCH"; mismatch=1; }
  printf '%-34s %10s %10s%s\n' "$t" "$s" "$d" "$flag"
done < <(psql "$TARGET_URL" -tAc "select tablename from pg_tables where schemaname='public' order by tablename")

echo
if (( mismatch )); then echo "DONE with MISMATCHES — investigate above."; exit 1; fi
echo "DONE — all row counts match."
