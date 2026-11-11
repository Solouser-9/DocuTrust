# core-service (Phase 1 modularisation → Phase 2 auth extraction → Phase 3 behind the gateway)

The **vault room** — the original DocuTrust backend, now one of three campus buildings. Phase 1
renamed the monolith into this module (nothing extracted yet); Phase 2 moved the 18 `/api/auth/*`
routes to **auth-service**, leaving **56 routes on port 9000 by convention** (`PORT=9000` in the run
command; Config's built-in default remains 8080) — including the RC-1 exception:
`POST /api/auth/accept-invite` is `OrgController.acceptInvite`, admin-domain logic under an auth
prefix, so it stays **here** and the gateway routes it by exact match before applying the
`/api/auth/` prefix rule. Package names remain `com.docutrust.*`; shared code (http stack, config,
db, cross-service domain helpers) lives in the `shared` module and is consumed as a normal jar
dependency. The mobile app never talks to this port directly — it calls the **gateway on :8080**,
which forwards everything byte-for-byte.

## Run (from `DocuTrust/server/`)

    PORT=9000 MIGRATOR_ENABLED=true SEED_DEMO=false mvn -pl core-service exec:java

Invoke Maven from `server/` (not from inside the module) so the working directory matches the old
single-module layout: `MIGRATIONS_DIR` default `../database/migrations` and `VAULT_DIR` default
`./data/vault` resolve exactly as they did before the split. Production jar (shade):
`core-service/target/docutrust-core-service.jar`. On a **shared cloud database (Neon)** keep
`SEED_DEMO=false` — the server refuses to seed a non-localhost database — and set `DB_POOL_MAX`
**≤ 5** (the Docker Compose file does both for you).

## ExpiryScheduler - single-JVM contract

`ExpiryScheduler` runs a 60-second background tick (document active→expiring→expired transitions,
verification expiry, once-per-day-per-type notifications). It is process-local state over the shared
database: **it must run on exactly one JVM per environment.** It runs here, in core-service. When
document/verification routes are extracted in a later phase, start it in exactly one service and
nowhere else, or expiry notifications and transition audits will double-fire.

## Configuration notes

- `DB_POOL_MAX` — HikariCP `maximumPoolSize`. Dev default **10**; production guidance: every
  DB-touching service sets **≤ 5** (multiple services × 5 connections stays within Neon limits).
- `MIGRATOR_ENABLED` — gates `Migrator.apply` at boot. Default **true**. In the microservices
  topology **core-service is the only migrator** — auth-service's migrator is hardcoded off — so
  migrations run exactly once no matter how many services boot against the shared database.
- The gateway/vault/admin stubs never touch the database and never call `Migrator.apply`.

## Rollback

    git reset --hard phase1-complete
