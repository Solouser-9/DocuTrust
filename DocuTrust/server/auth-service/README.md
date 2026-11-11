# auth-service (Phase 2, behind the gateway since Phase 3)

The **bouncer's building** — serves the 18 `/api/auth/*` routes extracted from core-service: register, login, forgot-password,
reset-password-otp, verify-otp, refresh, logout, verify-email, me (GET+PATCH), sessions (GET+DELETE),
change-password, request-step-up, verify-step-up, mfa/setup, mfa/enable, mfa/disable — plus its own
`GET /api/health`: **19 routes on port 8081**. Package names remain `com.docutrust.*`.
`/api/auth/accept-invite` deliberately stays in core-service (RC-1: the handler is
`OrgController.acceptInvite`, admin-domain logic under an auth prefix — the gateway routes it there
by exact match, checked before the `/api/auth/` prefix rule).

The mobile app never talks to this port directly: it calls the **gateway on :8080**, which forwards
every `/api/auth/*` request here byte-for-byte and carries the response back unchanged.

## Run (from `DocuTrust/server/` — CRITICAL)

    cd server && PORT=8081 mvn -pl auth-service exec:java

**Run from `server/`, never from inside `auth-service/`.** The default `VAULT_DIR=./data/vault` is
resolved against the current working directory. From `server/` it is the SAME absolute path
core-service uses, so both JVMs share one vault and MFA secret decryption works across services.
(In Docker, `docker-compose.yml` mounts the same named vault volume into both containers — same
contract, containerised.) Running from inside `auth-service/` points `VAULT_DIR` at
`server/auth-service/data/vault` (a different, empty directory) and breaks MFA secret decryption
across services.

## CRITICAL: shared secrets

**JWT_SECRET and VAULT_KEY must be identical to core-service's — both read the same `.env`.**
If either is ephemeral, cross-service JWT validation and MFA secret decryption will fail.
(If `JWT_SECRET` is unset, Config silently generates a fresh ephemeral secret per boot:
auth-service would then issue tokens that core-service cannot verify, and the cross-service
login → documents flow breaks.)

## Migrations

auth-service **never** runs migrations. The skip is hardcoded in `Main` — it prints
`[auth-service] migrations skipped (auth-service never runs migrations)` and ignores
`MIGRATOR_ENABLED` entirely. core-service remains the migration owner (`MIGRATOR_ENABLED=true`).

## Configuration notes

- `PORT` — process env var only, default **8081**. A `PORT` value inside `.env` is deliberately
  ignored by auth-service (Main reads the environment directly), so the port core-service uses can
  never leak into auth-service.
- `DB_POOL_MAX` — HikariCP `maximumPoolSize` (default 10). Production guidance (Neon free tier):
  every DB-touching service sets **≤ 5** — the Docker Compose file does this for you.
- No `Bootstrap` seeding (SEED_DEMO handling stays in core-service) and no `ExpiryScheduler`
  (single-JVM contract, stays in core-service).
