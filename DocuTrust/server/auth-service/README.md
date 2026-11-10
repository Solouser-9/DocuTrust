# auth-service (Phase 2)

Serves the 18 `/api/auth/*` routes extracted from core-service — register, login, forgot-password,
reset-password-otp, verify-otp, refresh, logout, verify-email, me (GET+PATCH), sessions (GET+DELETE),
change-password, request-step-up, verify-step-up, mfa/setup, mfa/enable, mfa/disable — plus its own
`GET /api/health`: **19 routes on port 8081**. Package names remain `com.docutrust.*`.
`/api/auth/accept-invite` deliberately stays in core-service (RC-1: the handler is
`OrgController.acceptInvite`, admin-domain logic under an auth prefix).

## Run (from `DocuTrust/server/` — CRITICAL)

    cd server && PORT=8081 mvn -pl auth-service exec:java

**Run from `server/`, never from inside `auth-service/`.** The default `VAULT_DIR=./data/vault` is
resolved against the current working directory. From `server/` it is the SAME absolute path
core-service uses, so both JVMs share one vault and MFA secret decryption works across services.
Running from inside `auth-service/` points `VAULT_DIR` at `server/auth-service/data/vault` (a
different, empty directory) and breaks MFA secret decryption across services.

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
- `DB_POOL_MAX` — HikariCP `maximumPoolSize` (default 10). Phase 2 guidance: every DB-touching
  service sets **≤ 5** (4 services × 5 = 20 connections, within Neon limits).
- No `Bootstrap` seeding (SEED_DEMO handling stays in core-service) and no `ExpiryScheduler`
  (single-JVM contract, stays in core-service).
