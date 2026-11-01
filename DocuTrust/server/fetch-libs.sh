#!/usr/bin/env bash
# Downloads the exact runtime jars into lib/ (idempotent). Used by compile-check.sh and
# run-dev.sh so the project builds with plain javac + java even without Maven. Maven users
# get the same versions from pom.xml.
set -eu
cd "$(dirname "$0")"
mkdir -p lib

BASE=https://repo1.maven.org/maven2

fetch() { # <group/path> <artifact> <version>
  local jar="lib/$2-$3.jar"
  if [ -s "$jar" ]; then echo "[fetch-libs] $jar present"; return 0; fi
  echo "[fetch-libs] downloading $2-$3.jar"
  for attempt in 1 2 3 4 5; do
    # central first, aliyun as the fallback mirror (both host the same artifacts)
    if curl -fsS --retry 2 --retry-delay 3 -o "$jar" "$BASE/$1/$2/$3/$2-$3.jar" \
       || curl -fsS -o "$jar" "https://maven.aliyun.com/repository/public/$1/$2/$3/$2-$3.jar"; then
      sleep 2 # pace the requests - registry rate limits bite on bursts
      return 0
    fi
    echo "[fetch-libs] attempt $attempt failed, backing off $((attempt * 5))s"
    rm -f "$jar"
    sleep $((attempt * 5))
  done
  echo "[fetch-libs] giving up on $2-$3.jar" >&2
  return 1
}

fetch org/postgresql            postgresql    42.7.4
fetch com/zaxxer                HikariCP      5.1.0
fetch com/bucket4j              bucket4j-core 8.10.1
fetch com/github/ben-manes/caffeine caffeine   3.1.8
fetch io/dropwizard/metrics     metrics-core  4.2.25
fetch io/sentry                 sentry        7.14.0
fetch org/slf4j                 slf4j-api     2.0.13
fetch org/slf4j                 slf4j-nop     2.0.13

echo "[fetch-libs] lib/ ready: $(ls lib | wc -l) jars"
