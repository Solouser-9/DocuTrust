#!/usr/bin/env bash
# Dev runner: fetches runtime jars, compiles if needed, loads .env into the environment, starts the API.
set -u
cd "$(dirname "$0")"

./fetch-libs.sh || exit 1

if [ ! -d target/classes/com/docutrust ]; then
  ./compile-check.sh || exit 1
fi

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

exec java -cp "target/classes:lib/*" com.docutrust.Main
