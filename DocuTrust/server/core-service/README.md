# core-service (Phase 1)

The original single-module DocuTrust backend, renamed. **Phase 1 extracts nothing**: this module
still serves all 74 routes exactly as before, now on port 9000 by convention (PORT=9000 in the run
command; Config's built-in default remains 8080). If any future extracted service misbehaves, the
gateway can route back here and everything still works - that is the non-destructive migration
contract. Package names remain `com.docutrust.*`; shared code (http stack, config, db, cross-service
domain helpers) lives in the `shared` module and is consumed as a normal jar dependency.

## Run (from `DocuTrust/server/`)

    PORT=9000 MIGRATOR_ENABLED=true SEED_DEMO=true mvn -pl core-service exec:java

Invoke Maven from `server/` (not from inside the module) so the working directory matches the old
single-module layout: `MIGRATIONS_DIR` default `../database/migrations` and `VAULT_DIR` default
`./data/vault` resolve exactly as they did before the split. Production jar (shade):
`core-service/target/docutrust-core-service.jar`.

## ExpiryScheduler - single-JVM contract

`ExpiryScheduler` runs a 60-second background tick (document active→expiring→expired transitions,
verification expiry, once-per-day-per-type notifications). It is process-local state over the shared
database: **it must run on exactly one JVM per environment.** In Phase 1 it runs here, in
core-service. When document/verification routes are extracted in a later phase, start it in exactly
one service (vault-service, the eventual owner) and nowhere else, or expiry notifications and
transition audits will double-fire.

## Configuration notes (new in Phase 1)

- `DB_POOL_MAX` - HikariCP `maximumPoolSize`. Phase 1 default **10** pins the current single-app
  pool exactly. Phase 2: every DB-touching service must set **≤ 5** (4 services × 5 = 20
  connections, within Neon limits).
- `MIGRATOR_ENABLED` - gates `Migrator.apply` at boot. Default **true** preserves today's
  unconditional, idempotent migration run with zero env vars; core-service sets true in dev. In
  Phase 2 the migration-owning service (auth-service) keeps true and every other service sets
  false, so migrations run exactly once.
- Stubs (auth/vault/admin/gateway) never touch the database and never call `Migrator.apply`.

## Rollback

    git reset --hard pre-phase1
