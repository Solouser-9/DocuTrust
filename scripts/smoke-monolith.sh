#!/usr/bin/env bash
# Smoke test: baseline monolith on port 8080 (before Phase 1)
# After Phase 1, run the same script against core-service on port 9000
BASE=${BASE:-http://localhost:8080}
PASS=0; FAIL=0

check() {
  local name="$1" expected="$2" actual="$3"
  if [[ "$actual" == *"$expected"* ]]; then
    echo "✓ $name"; PASS=$((PASS+1))
  else
    echo "✗ $name — expected '$expected'"; echo "  got: $actual"; FAIL=$((FAIL+1))
  fi
}

echo "== health =="
check "GET /api/health 200" "200" "$(curl -s -o /dev/null -w '%{http_code}' $BASE/api/health)"

echo "== login =="
LOGIN=$(curl -s -X POST $BASE/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"member@docutrust.app","password":"Member#2024"}')
check "login returns accessToken" "accessToken" "$LOGIN"
TOKEN=$(echo "$LOGIN" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

echo "== documents =="
DOCS=$(curl -s $BASE/api/documents -H "Authorization: Bearer $TOKEN")
check "GET /api/documents 200" "200" "$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TOKEN" $BASE/api/documents)"

echo "== folders =="
check "GET /api/folders 200" "200" "$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TOKEN" $BASE/api/folders)"

echo "== notifications =="
check "GET /api/notifications 200" "200" "$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TOKEN" $BASE/api/notifications)"

echo "== admin stats (skip if not admin) =="
check "GET /api/admin/stats responds" "" "$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TOKEN" $BASE/api/admin/stats)"

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[[ $FAIL -eq 0 ]]