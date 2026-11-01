#!/usr/bin/env bash
# Runs compile-check, then the unit test Runner (always) and the integration
# test (only when DB_URL is configured).
set -u
cd "$(dirname "$0")"

./compile-check.sh || exit 1

java -cp "target/classes:target/test-classes:lib/*" com.docutrust.test.Runner
UNIT_EXIT=$?
echo "UNIT_EXIT=$UNIT_EXIT"

if [ -n "${DB_URL:-}" ]; then
  java -cp "target/classes:target/test-classes:lib/*" com.docutrust.test.IntegrationTest
  INTEGRATION_EXIT=$?
  echo "INTEGRATION_EXIT=$INTEGRATION_EXIT"
  if [ "$UNIT_EXIT" -eq 0 ] && [ "$INTEGRATION_EXIT" -eq 0 ]; then
    echo "[tests] ALL GREEN"
    exit 0
  fi
  exit 1
fi

echo "INTEGRATION_EXIT=SKIPPED (DB_URL not set)"
if [ "$UNIT_EXIT" -eq 0 ]; then
  echo "[tests] unit green, integration skipped"
  exit 0
fi
exit 1
