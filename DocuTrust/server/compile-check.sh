#!/usr/bin/env bash
# Compiles main -> target/classes and test -> target/test-classes.
# Prefers javac (JDK); falls back to the bundled ECJ compiler. No pipes that eat exit codes.
set -u
cd "$(dirname "$0")"

ECJ="${ECJ_JAR:-$HOME/.docutrust/ecj-3.36.0.jar}" # optional fallback compiler; javac is the primary path
mkdir -p target/classes target/test-classes

./fetch-libs.sh || exit 1

CP="$(printf '%s:' lib/*.jar)" # explicit jar list (ECJ does not expand lib/* wildcards)

find src/main/java -name '*.java' > /tmp/srcs.txt
find src/test/java -name '*.java' > /tmp/testsrcs.txt

if command -v javac >/dev/null 2>&1; then
  echo "[compile] javac main..."
  javac -cp "$CP" -d target/classes @/tmp/srcs.txt
  MAIN_EXIT=$?
  if [ "$MAIN_EXIT" -eq 0 ]; then
    echo "[compile] javac test..."
    javac -cp "target/classes:$CP" -d target/test-classes @/tmp/testsrcs.txt
    TEST_EXIT=$?
  else
    TEST_EXIT=1
  fi
else
  if [ ! -s "$ECJ" ]; then
    echo "[compile] no javac and no ECJ fallback at $ECJ - install a JDK (javac) or set ECJ_JAR" >&2
    exit 1
  fi
  echo "[compile] ECJ main..."
  java -jar "$ECJ" -21 -nowarn -cp "$CP" -d target/classes @/tmp/srcs.txt
  MAIN_EXIT=$?
  echo "MAIN_EXIT=$MAIN_EXIT"
  if [ "$MAIN_EXIT" -eq 0 ]; then
    echo "[compile] ECJ test..."
    java -jar "$ECJ" -21 -nowarn -cp "target/classes:$CP" -d target/test-classes @/tmp/testsrcs.txt
    TEST_EXIT=$?
    echo "TEST_EXIT=$TEST_EXIT"
  else
    TEST_EXIT=1
  fi
fi

echo "MAIN_EXIT=$MAIN_EXIT"
echo "TEST_EXIT=$TEST_EXIT"
if [ "$MAIN_EXIT" -ne 0 ] || [ "$TEST_EXIT" -ne 0 ]; then
  echo "[compile] FAILED"
  exit 1
fi
echo "[compile] OK"
exit 0
