#!/usr/bin/env bash
# Runs the setup file twice against a scratch database, then the separation
# and admin-only checks, then the verify script. Needs a local Postgres.
#   PGHOST=/tmp PGPORT=5432 PGUSER=postgres tests/sql/run.sh
set -euo pipefail
export PGOPTIONS="-c client_min_messages=warning"
cd "$(dirname "$0")/../.."
DB=compass_teaser_test
psql -q -c "drop database if exists $DB" -c "create database $DB"
P="psql -q -v ON_ERROR_STOP=1 -d $DB"
$P -f tests/sql/supabase-shim.sql
$P -f docs/SUPABASE_SETUP.sql > /dev/null
$P -f docs/SUPABASE_SETUP.sql > /dev/null   # idempotency
$P -f tests/sql/grants.sql
OUT=$($P -t -f tests/sql/separation.test.sql | grep -E "PASS|FAIL")
echo "$OUT"
VERIFY=$($P -t -f docs/SUPABASE_VERIFY.sql | grep -v '^$')
echo "$VERIFY" | grep -v PASS || true
psql -q -c "drop database $DB"
if echo "$OUT" | grep -q FAIL || echo "$VERIFY" | grep -vq PASS; then echo "SQL TESTS FAILED"; exit 1; fi
echo "SQL tests: all passed"
