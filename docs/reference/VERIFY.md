# Phase 2 verification steps (run locally, in this order)

## 0. Apply the changes
    cd DocuTrust && bash /path/to/phase2-moves.sh   # or paste the 4 git mv commands
    # then apply core-service-Main.diff (git apply), replace auth-service Main.java, add README.md
    git status --short   # expect: 4 renames (R), 1 modified Main.java, 1 new Main.java, 1 new README.md

## 1. Build
    cd server && mvn clean install
    EXPECT: BUILD SUCCESS, Reactor Summary 6/6 SUCCESS (shared, core-service, auth-service, vault-service, admin-service, gateway)

## 2. Start core-service (terminal A)
    cd server && PORT=9000 MIGRATOR_ENABLED=true SEED_DEMO=true mvn -pl core-service exec:java
    EXPECT banner: "... ready on port 9000 (migrations=N, routes=56, db=up, boot=...ms)"

## 3. Start auth-service (terminal B) — MUST be from server/
    cd server && PORT=8081 mvn -pl auth-service exec:java
    EXPECT: "[auth-service] migrations skipped (auth-service never runs migrations)"
    EXPECT: "[auth-service] ready on port 8081 (routes=19, db=up)"

## 4. Acceptance curls
    # money shot: login on auth, use token on core
    TOKEN=$(curl -s -X POST http://localhost:8081/api/auth/login -H 'Content-Type: application/json' \
      -d '{"email":"<seed email>","password":"<seed password>"}' | jq -r .accessToken)
    curl -s -H "Authorization: Bearer $TOKEN" http://localhost:9000/api/documents
    EXPECT: 200 + documents list  (auth-service issued JWT, core-service verified it - shared JWT_SECRET)

    # route ownership flipped
    curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:9000/api/auth/login -d '{}'
    EXPECT: 404  (route no longer on core)

    curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:9000/api/auth/accept-invite -H 'Content-Type: application/json' -d '{}'
    EXPECT: 400/422  (NOT 404 - RC-1 route still on core)

    curl -s http://localhost:9000/api/health | jq .ok      # EXPECT: true
    curl -s http://localhost:8081/api/health | jq .ok      # EXPECT: true (auth-service answers its own health)

    # regression sweep on core (spot checks)
    curl -s -H "Authorization: Bearer $TOKEN" http://localhost:9000/api/folders | jq .ok
    curl -s -H "Authorization: Bearer $TOKEN" http://localhost:9000/api/auth/me
    EXPECT: 404 on core; the same GET on :8081 with the token returns 200 + profile

## 5. Negative: wrong CWD guard (do NOT make this permanent)
    cd server/auth-service && PORT=8081 mvn exec:java
    EXPECT: starts but VAULT_DIR resolves to server/auth-service/data/vault (wrong dir) - MFA decrypts fail.
    Kill it and always run from server/. This is why the README says CRITICAL.

## Rollback (any time)
    git reset --hard phase1-complete
