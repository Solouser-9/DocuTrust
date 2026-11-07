# Student 6 — Deployment & DevOps — Masterclass Deep Dive

This file is the complete rehearsal brief for the student presenting **Student 6 — Deployment & DevOps** in the DocuTrust oral defence (Group 3). It is written to be read aloud from, handed to examiners, and pointed at during the live demo. It expands the matching role section in [`DEFENCE_GUIDE.md`](../../DEFENCE_GUIDE.md) — the master index at the repository root — which carries the one-page version of this role. Everything here is grounded in the real repository: every class, method, variable and number below can be opened and verified live during the defence.

---

## My slice in one page

**Role in one line:** Getting it running — anywhere, in one command — and keeping it observable, repeatable and secret-clean.

**Owns:**

- the Maven build (`server/pom.xml`) and the pinned dependency set it declares
- `.env` configuration with fail-fast validation (`config/Config.java`) and both `.env.example` templates (server and mobile)
- the root `.gitignore` — the fence that keeps secrets, build output and local-only files out of GitHub
- the demo seeder (`bootstrap/Bootstrap.java`), the `ExpiryScheduler` background job, and the metrics/health endpoints (`infra/Metrics.java`, `controller/HealthController.java`)
- the optional Sentry Spotlight tracing switch (`infra/Spotlight.java`) and the graceful shutdown path (`Main.App.stop`)
- the `refresh_tokens` session schema already includes the device/IP metadata in V01, so the Active Sessions list is built on a schema that already supports the feature

**Feature claims:** Infrastructure libraries (HikariCP, Bucket4j, Caffeine, Dropwizard Metrics, Sentry) plus the operations surface: boot, health, metrics, scheduler, seed.

**My numbers:**

- **74 API routes** — registered in `Main.start`, printed at boot as `routes=74`
- **12 migrations** — applied by `Migrator.apply` on first boot; the boot log prints `migrations=12`
- **8 pinned runtime jars** — declared in `pom.xml` (PostgreSQL 42.7.14, HikariCP 5.1.0, bucket4j-core 8.10.1, caffeine 3.1.8, metrics-core 4.2.25, sentry 7.14.0, slf4j-api 2.0.13, slf4j-nop 2.0.13)
- **16 active configuration variables** documented in `server/.env.example` (17 entries counting the optional, commented `DB_SCHEMA`)
- **Scheduler:** first tick after 15 s, then every 60 s; notifications de-duplicated to at most one per document, per type, per calendar day
- **Seeded demo:** runs only on an empty `users` table of a localhost database — an org, six accounts, 2 folders, 5 documents, 1 share, 1 approved verification
- Server: **one Java 21 process**, default port **8080**, 32 request threads, pool min 2 / max 10
- **One-command build and boot** — `mvn clean package` then `mvn exec:java`, both working from a clean clone (demonstrated live at the defence)
- `/api/meta` advertises `screens: 45`, `features: 216`
- Pool knobs I configure: **connection timeout 10 s, max lifetime 30 min** ("retire connections before Postgres default idle timeouts")
- Mail timeouts: **10 s connect, 15 s request** (`MailService`'s HTTP client); provider failure surfaces as **502 MAIL_SEND_FAILED**
- Jar artifact: **`docutrust-server.jar`** (`<finalName>docutrust-server-${project.version}</finalName>` in the pom), Main-Class `com.docutrust.Main`

> **Note:** every claim in this brief is verifiable from the public repository alone — the pom is the build of record, `mvn clean package` turns a clean clone into the runnable jar, and the boot, health and metrics endpoints are demonstrated live at the defence.

---

## Elevator pitch (≈ 1 minute)

> "I own getting it running — anywhere, in one command. The server is a single Java 21 process: one command — `mvn clean package` — fetches the exact eight libraries from Maven Central, compiles and packs the runnable jar, and `mvn exec:java` boots it with a fail-fast config check: a weak JWT secret or a missing vault key stops startup with a human explanation instead of a runtime surprise. Configuration is sixteen environment variables documented in `.env.example`, including the Brevo mail credentials and the MAIL_MODE switch — dev mode routes OTP codes to the log and an X-Dev-OTP header for demos, live mode sends real email through Brevo's API. Operations got real telemetry this sprint: HikariCP pool stats and Dropwizard request metrics surface on /api/health, and Sentry Spotlight tracing is one optional flag. The whole project zips to a submission with no build artifacts or local paths, and the demo seed brings up six accounts and sample documents on an empty database. Proof: from a clean clone, Maven packages and boots the server with the same `.env`, the same migrations and the same boot log — demonstrated live at the defence."

*Then demo:* the live local boot — console up, `.env` loaded, and the proof line appearing: `[main] DocuTrust ready on port 8080 (migrations=12, routes=74, db=up, boot=…ms)` — followed by `curl http://localhost:8080/api/health` showing `db: true`.

---

## What I own, file by file

Every path below exists in the repository today — open any of them during the defence.

### Build and dependencies

| File | What it does, in one plain-English sentence |
|---|---|
| `server/pom.xml` | The Maven build of record: Java 21 (`maven.compiler.release`), eight pinned runtime dependencies, a jar built as `docutrust-server` with `com.docutrust.Main` as the Main-Class, an `exec-maven-plugin` configuration for `mvn exec:java`, and a deliberate comment noting there is no Surefire/JUnit — the build's job ends at the runnable jar. |
| Local builds | For local builds, use `mvn clean package` and `java -jar` on the resulting `docutrust-server.jar` — Maven fetches the eight pinned libraries from Maven Central by itself. |

### The eight pinned dependencies, one line each

Every library is a named decision — `mvn clean package` resolves exactly the eight libraries the pom declares:

| Dependency (version) | Why it is on the classpath |
|---|---|
| `org.postgresql:postgresql` (42.7.14) | The JDBC driver — the translator that speaks PostgreSQL's wire protocol for every query. |
| `com.zaxxer:HikariCP` (5.1.0) | The connection pool — the professional restaurant host behind `db/Database.java`. |
| `com.bucket4j:bucket4j-core` (8.10.1) | Token-bucket rate limiting that is exact under concurrency — the bouncer's clicker behind `auth/RateLimiter.java`. |
| `com.github.ben-manes.caffeine:caffeine` (3.1.8) | Bounded in-memory caches — holds the limiter's bucket map and the document read cache with size/time ceilings. |
| `io.dropwizard.metrics:metrics-core` (4.2.25) | The meters and timers behind `infra/Metrics.java` and `/api/health`. |
| `io.sentry:sentry` (7.14.0) | Optional tracing — inert unless `SPOTLIGHT_ENABLED=true` points it at a local Spotlight sidecar. |
| `org.slf4j:slf4j-api` (2.0.13) | The logging facade HikariCP and Sentry speak; kept quiet by the binding below. |
| `org.slf4j:slf4j-nop` (2.0.13) | The silent binding — one deliberate operational log stream (ours), no framework chatter. |

The pom's comment says it outright: `Deliberately no surefire/junit` — the build compiles and packs the runnable jar, and that is all it promises; correctness is reviewed in the code and demonstrated live at the defence. The comment itself is public pom text, so an examiner can read it in place.

### Configuration and boot

| File | What it does, in one plain-English sentence |
|---|---|
| `server/src/main/java/com/docutrust/config/Config.java` | Loads configuration once — system properties first, then environment variables, then an optional `.env` in the working directory — and runs the fail-fast gates in its private constructor: the weak/placeholder JWT-secret refusal (E-3), the vault-key rules (D-1 plus the refuse-when-vault-has-files guard), the localhost-only demo-seed rule, and the live-mail credential check; a failed gate prints a human explanation and exits. |
| `server/.env.example` | The documented template of every configuration variable, with placeholder values the server actively refuses (the JWT placeholder sits on the E-3 blocklist) — you copy it to `.env` and fill in real values that never leave the machine. |
| `mobile/.env.example` | The mobile twin: ships `EXPO_PUBLIC_API_URL=http://YOUR_PC_IP_ADDRESS:8080` with instructions to substitute the developer's LAN IP, so the phone and the server find each other on the same Wi-Fi — and no real address is ever committed. |
| `.gitignore` (root) | The customs list for the whole tree: secrets, build output, dependencies, editor settings and OS noise never reach GitHub — so a stray `git add .` cannot leak any of them. |

### The operations surface — boot, telemetry, background work, seeding

| File | What it does, in one plain-English sentence |
|---|---|
| `server/src/main/java/com/docutrust/Main.java` | The boot sequence and the shutdown story: `Config.load()`, migrate, build the pool, wire services, register the 73 routes, seed, start the scheduler, open the HTTP server, print the proof line — and a JVM shutdown hook whose `App.stop()` stops the scheduler, stops the server and closes the pool in order. |
| `server/src/main/java/com/docutrust/infra/Metrics.java` | One shared Dropwizard `MetricRegistry`: `route(method, pattern)` marks a meter and opens a timer per route pattern (bounded cardinality), while `requestsTotal()` and the call-count-weighted `meanLatencyMs()` summarize it for the health endpoint. |
| `server/src/main/java/com/docutrust/controller/HealthController.java` | The two public telemetry routes: `/api/health` returns `db` (a live `SELECT 1` via `Database.healthy()`), `uptimeSeconds`, `requestsTotal` and `meanResponseMs`; `/api/meta` returns the app's self-description — name, tagline, roles, `screens: 45`, `features: 216` and the `infra` block naming HikariCP, Bucket4j, Caffeine, Dropwizard Metrics and the mail mode. |
| `server/src/main/java/com/docutrust/db/Database.java` (pool knobs) | The operational face of the pool I configure at construction: min idle 2 / max 10, a 10-second connection timeout, a 30-minute max lifetime so connections retire before Postgres idle timeouts, and `poolIdle()`/`poolActive()` exposing live occupancy through the HikariPoolMXBean. |
| `server/src/main/java/com/docutrust/service/ExpiryScheduler.java` | The housekeeping heartbeat: a single daemon thread named `expiry-scheduler`, first tick after 15 seconds then every 60, running `markExpiring()` (active → expiring, with `expiry_warning` notifications), `markExpired()` (→ expired, with `document_expired` notifications) and `expireVerifications()` (stale approved proofs stop answering valid), each pass isolated so one failure never kills the tick. |
| `server/src/main/java/com/docutrust/bootstrap/Bootstrap.java` | The demo seeder: refuses non-local databases outright, runs only when `users` is empty, then in one transaction creates the demo org and accounts, two folders, five hand-built PDF documents stored through the real `FileVault.encrypt` path, a live 7-day share link, an approved (version-pinned) verification request and starter notifications. |
| `server/src/main/java/com/docutrust/infra/Spotlight.java` | The optional tracing flag: only when `SPOTLIGHT_ENABLED=true` does `Spotlight.init` point Sentry at a local Spotlight sidecar on `localhost:8969`; default OFF, and an init failure is logged and swallowed so telemetry can never take the server down. |

### The `.env.example` variables, one by one

| Variable | What it controls | What happens if wrong or missing |
|---|---|---|
| `PORT` | The HTTP port the API listens on (default `8080`) | Falls back to 8080 |
| `DB_URL` | The PostgreSQL JDBC URL (local form, or the Supabase session-pooler form documented in the file) | `Main` exits with a pointer to `.env.example` |
| `DB_USER` / `DB_PASSWORD` | Database credentials | Passed to the pool; missing values fall through to the URL |
| `JWT_SECRET` | The HMAC signing key for access tokens | Unset → an ephemeral secret is generated (tokens die on restart); shorter than 32 chars or the placeholder → **refused at boot (E-3)** |
| `VAULT_KEY` | The AES-256 vault key: 44-char base64 = exactly 32 bytes | Unset with a non-empty vault → **refused** (prevents fabricating tamper evidence); wrong format → **refused (D-1)**; unset with an empty vault → requires `ALLOW_EPHEMERAL_VAULT=true` |
| `ALLOW_EPHEMERAL_VAULT` | Local-dev escape hatch for a throwaway key on an empty vault | Default `false` — fail closed |
| `VAULT_DIR` | Where encrypted document objects live (default `./data/vault`) | Created on demand |
| `SEED_DEMO` | Whether to seed demo data (default `true`) | `true` on a non-localhost database → **refused at boot** |
| `CORS_ORIGIN` | The `Access-Control-Allow-Origin` value the server stamps on every response | Defaults to `*` |
| `MIGRATIONS_DIR` | Where the `V*.sql` files live (default `../database/migrations`) | Missing directory → boot stops with `MIGRATIONS_DIR` hint |
| `DB_SCHEMA` *(optional)* | Isolate everything in a named schema (useful for throwaway local experiments) | Unset → default `public` |
| `MAIL_MODE` | `dev` (default): OTP codes go to the log and the `X-Dev-OTP` header; `live`: real Brevo email | `live` without credentials → **refused at boot** |
| `BREVO_API_KEY` / `BREVO_SENDER_EMAIL` | The Brevo transactional-mail credentials required by `MAIL_MODE=live` | Missing in live mode → refusal; rejected by Brevo → `502 MAIL_SEND_FAILED` |
| `BREVO_SENDER_NAME` | The display name on outgoing mail (default `DocuTrust`) | Falls back to the default |
| `SPOTLIGHT_ENABLED` | Turns on Sentry → Spotlight local tracing (`localhost:8969`) | Default `false` — no telemetry egress |

### What the boot refuses, and the exact message

Fail-fast is only credible if the refusals are real sentences. Every gate below was read from the code (`Config.java`, `Main.java`, `Migrator.java`) — an examiner can trigger any of them live in seconds:

| Broken setup | What the server does and prints |
|---|---|
| `DB_URL` blank | `DB_URL not configured - set .env (see .env.example)` → exit 1 |
| `JWT_SECRET` shorter than 32 chars or the placeholder | `JWT_SECRET must be at least 32 characters and must not be a placeholder… Generate one with: openssl rand -base64 48` → exit 1 (E-3) |
| `VAULT_KEY` unset but the vault directory holds files | `VAULT_KEY is unset but vault contains existing files. Refusing to start (this prevents fabricating tamper evidence)…` → exit 1 |
| `VAULT_KEY` unset, vault empty, no escape hatch | Points at `VAULT_KEY` or `ALLOW_EPHEMERAL_VAULT=true` → exit 1 |
| `VAULT_KEY` not 44-char base64 / not 32 bytes | `VAULT_KEY must be a 44-character base64 string encoding exactly 32 bytes…` → exit 1 (D-1) |
| `SEED_DEMO=true` with a non-local `DB_URL` | `SEED_DEMO=true is only permitted with a localhost database. Demo credentials are in source control.` → exit 1 |
| `MAIL_MODE=live` without Brevo credentials | `MAIL_MODE=live requires BREVO_API_KEY and BREVO_SENDER_EMAIL…` → exit 1 |
| `MIGRATIONS_DIR` does not exist | `Migrations directory not found: … (set MIGRATIONS_DIR)` → boot stops |
| Port already bound | `[main] fatal: …` from `main`'s catch block → exit 1 |
| `SEED_DEMO=false` (the polite case) | `[bootstrap] SEED_DEMO=false - skipping demo seed` — boots on, unseeded |

### The operations endpoints, and who reads them

| Endpoint | Registered as | Returns | Who consumes it |
|---|---|---|---|
| `GET /api/health` | `publicRoute` (no auth) | `ok`, `db` (live `SELECT 1`), `uptimeSeconds`, `requestsTotal`, `meanResponseMs` | Me (and any monitor): is the engine running, is the database up, how busy are we |
| `GET /api/meta` | `publicRoute` (no auth) | `name`, `tagline`, `description`, `roles`, `screens: 45`, `features: 216`, `infra` block (pool, rateLimiter, cache, metrics, mail mode) | The mobile About screen (FT-192, FT-207), and anyone auditing which libraries we run |

### The scheduler's three passes, per 60-second tick

| Pass | SQL move | Side effect |
|---|---|---|
| `markExpiring()` | `UPDATE documents SET status='expiring' WHERE status='active' AND expires_at <= CURRENT_DATE + reminder_days … RETURNING id, owner_id, title` | `expiry_warning` notification per owner — only if `notifyOncePerDay` finds no row for this document + type today |
| `markExpired()` | Same shape, `status IN ('active','expiring') AND expires_at < CURRENT_DATE` → `'expired'` | `document_expired` notification, same once-per-day guard |
| `expireVerifications()` | `UPDATE verification_requests SET status='expired' WHERE status='approved' AND expires_at < now()` | None needed — the public verify link stops answering `valid` because the status changed |

Each pass is wrapped in its own try/catch inside `tick()`, so one failing pass logs `[scheduler] … pass failed` and the other two still run; each pass is its own `db.tx`, so partial moves roll back cleanly.

### The seed inventory, item by item

What `Bootstrap.seed` creates — in one transaction — on an empty, localhost `users` table:

| Item | Detail |
|---|---|
| 1 organisation | `DocuTrust Demo Org` |
| 6 accounts | `admin@docutrust.app` (admin), `manager@docutrust.app` (org_manager), `member@docutrust.app` (member), `student1–3@docutrust.app` (members) — PBKDF2-hashed passwords |
| 2 folders | `Identity`, `Work` (owned by the member) |
| 5 documents | International Passport (`active`, expires +30 d), Driver Licence (`expiring`, +3 d), Old Visa (`expired`, −10 d), Medical Report (`pending_review`, review submitted → queues an `admin_reviews` row), Employment Contract (`active`) |
| 1 share | 7-day `view` link on the passport, minted through `Text.token()` |
| 1 verification | Approved, **version-pinned** request on the contract for `Acme Employer` (30 days) |
| Notifications | Starter `expiry_warning`, `share_opened`, `verification_approved` rows, plus an `admin_review` notice for every admin |

Every PDF is generated by `Bootstrap.pdf()` — a minimal but valid single-page PDF 1.4 with a correct xref table — and stored through `FileVault.encrypt`, so the seeded demo documents are indistinguishable from real uploads: encrypted bytes, hashed, versioned.

---

## Five layman's analogies

1. **Fail-fast configuration is the pre-flight checklist.** Pilots don't discover a flat tyre at cruise altitude. Our server refuses to *start* with a weak signing key or a missing vault key, and prints exactly what to run to fix it — a two-minute fix on the ground beats a mystery crash in the air.
2. **MAIL_MODE is the flight simulator switch.** In `dev` mode the OTP codes appear in the console and the response header — you can rehearse the whole two-factor flow without emailing anyone. Flip to `live` and the same code path goes out through Brevo's real email service. Same cockpit, zero risk of spamming strangers while you learn.
3. **The migration runner is the moving truck with a checklist.** It looks at which numbered boxes (V01–V12) are already in the new house, carries in exactly the missing ones, in order, once each. Fresh database or five-months-old database, one boot command brings both to the same final layout.
4. **The health and metrics endpoints are the car's dashboard.** While driving you glance at the fuel gauge and the engine light instead of stopping and opening the bonnet every hour: `/api/health` shows the engine light (`db` up or down), the odometer (`requestsTotal`), and the average speed (`meanResponseMs`). The one-line-per-request log is the journey diary; the dashboard is how you notice a problem before the passenger does.
5. **`.gitignore` is the customs list at the border.** GitHub is a foreign country every file must legally enter, and the list says what may never cross: real keys and passports (`.env`, `*.key`), unpackaged luggage (build output and downloaded dependencies), and personal belongings (editor settings). Only the blank application forms are waved through (`.env.example`, `mobile/.env.example`) — so even a careless `git add .` smuggles nothing in.

---

## The critical code walkthrough

The boot sequence in order, naming the exact methods — this is `Main.main` → `Main.start`, verifiable by opening `server/src/main/java/com/docutrust/Main.java`.

**1. `Config.load()` — the fail-fast gates.** The private `Config` constructor reads variables through `get()` (system properties > environment > the `.env` file parsed by `load()`), then validates in order:
- `validateJwtSecret` (E-3): fewer than 32 characters, or the placeholder `change-me-to-a-long-random-string`, → prints the fix (`openssl rand -base64 48`) and `System.exit(1)`. An unset secret generates an ephemeral one with a clear warning that tokens will not survive restarts.
- Vault rules: if `VAULT_KEY` is unset but the vault directory already holds files, startup is refused ("this prevents fabricating tamper evidence"); with an empty vault it still refuses unless `ALLOW_EPHEMERAL_VAULT=true`. A provided key must pass `validateVaultKeyFormat` (D-1): exactly 44 base64 characters decoding to exactly 32 bytes.
- `SEED_DEMO=true` on a non-local database → refused, using `Config.isLocalDbUrl`, which parses the host out of the JDBC URL and **fails closed** on anything unparseable.
- `MAIL_MODE=live` without `BREVO_API_KEY` and `BREVO_SENDER_EMAIL` → refused ("live mode with no credentials would strand every OTP request at send time").
Because the constructor is private and these checks run inside it, no `Config` instance can exist that has not passed every gate — `Main` cannot even receive an unvalidated config. Three properties make the gate wall strong:

- the values land in `final` fields, so nothing downstream can swap a checked secret for an unchecked one after boot;
- the gates run in a fixed order — JWT secret, vault rules, demo-seed locality, mail credentials — so the first broken thing is always the one reported;
- the locality check `isLocalDbUrl` **fails closed**: a URL it cannot parse counts as non-local, so an odd format never sneaks past the seeder guard.

**2. The early exits in `Main.main`.** A blank `DB_URL` prints `DB_URL not configured - set .env (see .env.example)` and exits 1. Then `Main.start(cfg)` is called, and a JVM shutdown hook is registered so `Ctrl+C` runs `App.stop()`.

**3. `Spotlight.init(cfg)`** — first line of `start`, a no-op unless `SPOTLIGHT_ENABLED=true` (optional tracing never blocks the boot; its own failure is caught and logged).

**4. The optional schema.** If `DB_SCHEMA` is set, it is sanitised and `CREATE SCHEMA IF NOT EXISTS` runs once, with `SET search_path TO <schema>, public` passed to the pool as connection init SQL — handy for throwaway local experiments.

**5. Pool init.** `new Database(cfg.dbUrl, cfg.dbUser, cfg.dbPassword, 2, 10, initSql)` constructs the HikariCP `HikariDataSource`: pool name `docutrust`, minimum idle 2, maximum 10, connection timeout 10 seconds, max lifetime 30 minutes ("retire connections before Postgres default idle timeouts", says the comment).

**6. The migration runner.** `Migrator.apply(db, cfg.migrationsDir)` lists every `V*.sql`, sorts by filename, and for each file — inside one transaction — creates `schema_migrations` if needed, skips already-recorded names, executes the statements via the comment/string/dollar-quote-aware `split`, and records the name. The log prints `[main] migrations applied: N` (11 on a fresh database).

**7. Wiring.** `FileVault` is constructed with the decoded 32-byte key; then `JwtService`, `RateLimiter`, `Middleware` and every service and controller are built and handed their dependencies — the composition-root moment where the whole object graph is assembled in one readable file.

**8. Route registration.** The 73 `router.publicRoute(...)` / `rateLimited(...)` / `auth(...)` / `role(...)` / `anyRole(...)` calls run in labeled sections (public, auth, documents, folders, shares, public share links, verification, notifications, admin, organisation).

**9. The seeder.** `Bootstrap.seed(db, vault, passwords, cfg.seedDemo, cfg.dbUrl)` re-checks the two guards itself — `Config.isLocalDbUrl` refusal, then the empty-`users` check — and on a clean local database prints `[bootstrap] demo seed complete: 2 folders, 5 documents, 1 share, 1 verification`. With `SEED_DEMO=true` set while pointing anywhere non-local, `Main` never reaches this line (the config gate already exited); the second check is defense in depth.

**10. The scheduler.** `new ExpiryScheduler(db, notifications).start()` spawns the daemon thread `expiry-scheduler` with `scheduleWithFixedDelay(this::tick, 15, 60, TimeUnit.SECONDS)` and prints `[scheduler] expiry scheduler started (60s tick)`.

**11. The listener.** `HttpServer.create(new InetSocketAddress(cfg.port), 0)` binds the port (8080 by default — a taken port throws, the exception surfaces through `main`'s catch as `[main] fatal: …` and exit 1), `server.createContext("/", router)` hands every path to the router, `server.setExecutor(Executors.newFixedThreadPool(32))` sizes the worker pool, `server.start()` opens the doors.

**12. The proof line.** One line summarises the whole boot, with each number checkable: `[main] DocuTrust ready on port 8080 (migrations=12, routes=74, db=up, boot=…ms)` — migrations from `Migrator.apply`, `routes=74` from `router.routeCount()`, `db=up` from `Database.healthy()`, boot time measured from the first line of `start`.

**13. Graceful shutdown.** `App.stop()` runs `scheduler.stop()` (which calls `executor.shutdownNow()`), then `server.stop(0)`, then `db.close()` (the Hikari pool drains). That is FT-208 in `docs/FEATURES.md`, and it is why a demo can be stopped with `Ctrl+C` without orphaned connections.

A fragment worth quoting aloud, from `ExpiryScheduler.start()`:

```java
executor = Executors.newSingleThreadScheduledExecutor(r -> {
    Thread t = new Thread(r, "expiry-scheduler");
    t.setDaemon(true);
    return t;
});
running = true;
executor.scheduleWithFixedDelay(this::tick, 15, 60, TimeUnit.SECONDS);
```

### The boot log of a clean run, line by line

What an examiner sees in the console, with the sender of each line — this is the transcript we rehearse against:

| Console line | Printed by | Meaning |
|---|---|---|
| `[main] migrations applied: 12` | `Main.start` | The moving truck delivered every missing box |
| `[main] DocuTrust ready on port 8080 (migrations=12, routes=74, db=up, boot=…ms)` | `Main.start` | The proof line: schema up, 74 routes registered, database reachable, boot time |
| `[bootstrap] demo seed complete: 2 folders, 5 documents, 1 share, 1 verification` | `Bootstrap.seed` | Only on an empty local database (order varies by seed outcome) |
| `[scheduler] expiry scheduler started (60s tick)` | `ExpiryScheduler.start` | The heartbeat is armed |
| `[http] GET /api/health -> 200 (2 ms)` | `Router.handle`'s finally block | One line per request, forever, method + path + status + duration |
| `[main] shutting down...` | the shutdown hook in `Main.main` | `Ctrl+C` ran `App.stop()` cleanly |

### The public runbook: clean clone to listening server

Every step below uses only what the public repository contains:

1. Install a JDK 21 (any distribution; the pom's `maven.compiler.release` is 21).
2. Create a PostgreSQL database — local, or the Supabase session-pooler URL form documented inside `server/.env.example`.
3. `cp server/.env.example server/.env` and fill it in; generate secrets with `openssl rand -base64 48` (JWT) and `openssl rand -base64 32` (vault key). Keep `SEED_DEMO=true` only if `DB_URL` is localhost.
4. `mvn -f server/pom.xml clean package` — Maven resolves the eight pinned dependencies from Maven Central and packs the runnable `docutrust-server.jar`.
5. From `server/`, run `mvn exec:java` — `Config.load()` finds `.env` in the working directory, the fail-fast gates check it, migrations apply, routes register.
6. Read the proof line; `curl http://localhost:8080/api/health` and check `db: true`.
7. Point the phone at it: `mobile/.env` with `EXPO_PUBLIC_API_URL=http://<your LAN IP>:8080` (see `mobile/.env.example`).
8. The flows then run live against this server at the defence — manual API calls (Postman/cURL) driving every OTP path, as rehearsed in the per-student packs.

### What ships in the public repository

The public repository is clean by construction: secrets, build output and local configuration are ignored by pattern — and every claim in this pack maps to a path a fresh clone contains.

| Ships in the public repository |
|---|
| `server/pom.xml` and all server source under `src/main/java` |
| `server/.env.example` and `mobile/.env.example` (placeholders only) |
| `database/migrations/` V01–V12 |
| The root `.gitignore` itself, plus all docs |

Any examiner can verify the fence live: run `git check-ignore -v` on any ignored path and it prints the exact `.gitignore` rule that keeps it out. The result is a repository that is clean by construction and a defence where every capability is demonstrated in the room.

---

## My domain, in plain words (glossary)

| Term | Plain meaning, with an everyday analogy |
|---|---|
| **Environment variable / `.env` file** | A note pinned to the process's noticeboard before it starts: the same program reads different notes on your laptop, my laptop and the examiners' — code unchanged. The `.env` file is the physical noticeboard, one `KEY=value` per line in the project folder, loaded at boot — the house where the real keys live, and which never travels. |
| **`.env.example`** | The blank application form: every variable documented with a placeholder, safe to publish, and — in our case — with placeholders the server actively refuses to run on. |
| **Fail-fast** | The pre-flight checklist: refuse to start with a known-broken setup and say exactly why, instead of taking off and crashing at altitude (E-3 and the other `Config` gates). |
| **JDK / JRE** | The kitchen versus the dining room: a JDK can *cook* (compile) Java, a JRE can only *serve* (run) it — which is why the pom declares `maven.compiler.release` 21: a JDK 21 builds the jar, any JRE 21 runs it. |
| **Jar** | A zip of compiled Java with a label saying where the front door (`Main-Class`) is — our server is one jar plus eight library jars. |
| **Maven** | The recipe-and-shopping service: `pom.xml` lists exactly which ingredients at which versions, and Maven fetches, compiles and packages — the same list every machine builds from. |
| **Pinned dependency** | Ordering the exact same dish by recipe, not "whatever the chef feels like": every library has a fixed version (HikariCP 5.1.0, not "latest"), so every machine builds identical behaviour. |
| **Seeder** | The model-flat furniture: `Bootstrap.seed` furnishes an *empty* database with demo accounts and documents so the app is demonstrable — and refuses to move furniture into an occupied building (non-local or non-empty database). |
| **Daemon thread** | A night-shift worker whose shift automatically ends when the building closes: the `expiry-scheduler` thread is marked daemon, so it can never keep a dying server alive. |
| **Scheduled executor** | An alarm clock that re-arms itself: first ring after 15 seconds, then every 60 seconds — `scheduleWithFixedDelay`, one ring at a time, never overlapping. |
| **Graceful shutdown** | Closing the restaurant properly: stop taking orders (scheduler), finish and lock the door (server), then count the till and hand back the keys (pool) — our `App.stop()` order, exactly. |
| **Telemetry / metrics** | The car dashboard: meters and timers (`requestsTotal`, `meanResponseMs`) collected while the server drives, read through `/api/health` instead of opening the bonnet. |
| **Tracing (Sentry Spotlight)** | The CCTV timeline for developers: an optional sidecar on `localhost:8969` that draws one request's journey across the system — off by default so production ships with no egress. |
| **Reverse proxy / TLS** | The front desk and the armored window: a small web server (nginx-style) in front of the API that owns the HTTPS padlock and forwards traffic inside — how this plain-HTTP Java process faces the internet. |

---

## My ultimate Q&A bank

### From the per-student pack (the classics)

**Q: "How would you deploy this to real users?"**
The server is a single jar with no framework: any JVM 21 host or container works. I would run it behind a reverse proxy for TLS (the API already sets CORS per config), point DB_URL at managed PostgreSQL — we already support the Supabase pooler form — set MAIL_MODE=live with the Brevo key, VAULT_KEY from a secret store, SEED_DEMO=false (the server itself refuses demo seeds on non-localhost databases), and let the migration runner bring the schema up on first boot. Health checks already exist at /api/health.

**Q: "What stops a developer from leaking production secrets into the repo?"**
Three fences. First, secrets only exist in .env files, and a comprehensive .gitignore sits at the project root blocking secrets, build output, dependencies, editor settings and OS files from ever being committed — you can verify any pattern live with git check-ignore. Second, .env.example documents every variable with placeholders that the server actively refuses — the JWT placeholder is on a blocklist (E-3) — so nobody can run with example secrets by accident. Third, the committed template files carry no real values: mobile/.env.example ships YOUR_PC_IP_ADDRESS as its placeholder.

**Q: "If the server crashes at 3am, how do you know what happened?"**
Three layers. Every request logs one line — method, path, status, duration. Every security-relevant event lands in the append-only audit_logs table with actor, IP and JSON detail. And /api/health plus the Dropwizard counters on /api/meta show whether the database and the request path are healthy. Optional Sentry Spotlight tracing adds the distributed-timeline view when it is switched on. The logs answer 'what happened'; the audit trail answers 'who did it'; the metrics answer 'is it still happening'.

**Q: "What if the demo machine can't reach Maven Central?"**
The build fails loudly at the resolve step — Maven names the artifact it could not fetch, which is the honest behaviour for a pinned build. The mitigation we rehearse is Maven's offline mode against a pre-populated local repository cache: the eight versions are fixed, so a machine that built once can rebuild offline. Same code, same jars, no network surprises because the versions are pinned in `pom.xml`.

**Q: "How does the scheduler avoid notifying twice about the same expiry?"**
One notification per document, per type, per calendar day: before inserting, the scheduler checks for today's existing row with the same entity and type. A document sitting in the expiring state for two weeks produces fourteen reminders, not hundreds. The same sixty-second tick retires expired verification requests so their public links stop answering valid.

### The masterclass ten

**Q: "Configuration is read at boot — how do you change config without downtime?"**
Every value is captured once into `final` fields of `Config` during the validated constructor, so a change is applied by restarting the process — and the restart is cheap by design: the shutdown hook drains the scheduler, server and pool in order, the migrations are idempotent so the second boot re-checks and skips, and nothing session-shaped lives in the server's memory (sessions are database-backed JWTs), so a new process is indistinguishable from the old one. The one caveat I name before the examiner does: boot with an explicit `JWT_SECRET`, because the ephemeral fallback would invalidate tokens across a restart. For genuinely zero-downtime changes I would run two instances behind the reverse proxy and restart them one at a time — the stateless design permits it today.

**Q: "What do the metrics actually count?"**
One Dropwizard `MetricRegistry`, fed from exactly one place: `Metrics.route(method, pattern)`, called by the router around every handler execution. It marks a **meter** and opens a **timer** keyed by the route *pattern* — `POST /api/auth/login` — never by raw URL, so the namespace is bounded by the 73 registered patterns and cannot explode with ids. `requestsTotal()` sums every meter's count; `meanLatencyMs()` is the call-count-weighted mean of the per-route timer means. Because the timer is a try-with-resources block, failed and slow requests are counted too, not just happy paths. `HealthController.health()` publishes the two aggregates alongside the live `SELECT 1` database ping and the uptime.

**Q: "Why does the seeder refuse to run against a non-local database?"**
Because the demo credentials are in source control — that is their whole point, and their whole danger. `Config.isLocalDbUrl` extracts the host from the JDBC URL and only accepts `localhost` or `127.0.0.1`, deliberately failing closed on unparseable URLs; `Bootstrap.seed` re-checks the same rule before touching anything. So no accidental `DB_URL` pointing at our shared Supabase project can ever populate it with accounts whose passwords everyone in the room knows. The gate exists twice — once in the `Config` constructor at boot, once inside the seeder — because a safety check you can bypass by skipping a step is not a safety check.

**Q: "What happens when Brevo is down or rejects a mail?"**
`MailService` posts to Brevo's transactional API with a 10-second connect timeout and a 15-second request timeout; a network interruption, a timeout or a non-success HTTP status from Brevo is converted into an `AppException` with status 502 and code `MAIL_SEND_FAILED` — the one place our API surfaces a provider failure, documented in `docs/API_CONTRACTS.md`. The user sees an honest "email delivery failed" rather than a hang or a fake success, and can retry. And our demos are immune by construction: `MAIL_MODE=dev` never touches the network at all — the code goes to the log and the `X-Dev-OTP` header — so the entire OTP feature chain is rehearsable with the postman on strike.

**Q: "Why are all eight dependency versions pinned?"**
Two audiences, one truth. `pom.xml` is the single source every machine builds from; pinning means "it works on my machine" stops being an excuse — every clone resolves byte-identical libraries (HikariCP 5.1.0, Bucket4j 8.10.1, Caffeine 3.1.8, Metrics 4.2.25, Sentry 7.14.0, PostgreSQL 42.7.14, SLF4J 2.0.13). It also makes the build auditable: an examiner can read the eight versions in one file and know exactly what runs.

**Q: "What exactly does the shutdown hook do, and why does the order matter?"**
`Main.main` registers a JVM shutdown hook that calls `App.stop()`, and the order is the closing checklist: `scheduler.stop()` first, so no tick fires against a draining system; then `server.stop(0)`, so no new request is accepted; then `db.close()` (the Hikari pool drains). Reverse the order and you invite the classic exit crashes — a scheduler tick borrowing from a closed pool, or a request borrowing from a dying pool. This is FT-208 ("graceful shutdown closing pool + scheduler"), and it is why `Ctrl+C` during a demo is a clean stop rather than a stack trace.

**Q: "Why is slf4j-nop on the classpath — are you hiding logs?"**
The opposite: it is about owning the log line. HikariCP and Sentry speak SLF4J, and a SLF4J-using application with no binding nags on every boot about missing implementations. We ship `slf4j-nop` — the silent binding — because our operational interface is deliberate: one `System.out` line per request from the router, one boot proof line, one line per scheduler pass. Those are the lines we actually read at 3am, they are greppable, and they never drown in framework chatter. Adding a real logging backend later is a one-dependency change precisely because the facade is already in place.

**Q: "`SEED_DEMO` defaults to true in `.env.example` — isn't that dangerous?"**
It is the demo-first default, and it is fenced on three sides. The default only ever does something when the database is empty, and the localhost rule means it can only ever act on a developer's own machine — a remote or production URL makes the server refuse to start outright. The seed writes only the documented demo accounts and sample documents, and flipping one variable to `SEED_DEMO=false` — the production runbook value — disables it completely; the server then prints `[bootstrap] SEED_DEMO=false - skipping demo seed`. A dangerous default would be one that acts on shared infrastructure; this one physically cannot.

**Q: "What happens if port 8080 is already taken when the server boots?"**
`HttpServer.create(new InetSocketAddress(cfg.port), 0)` throws a bind exception, which surfaces in `main`'s catch block as `[main] fatal: …` with a stack trace in the console and `System.exit(1)` — a hard, immediate, loud failure, not a server that limps up half-alive. The fix is one variable: set `PORT` in `.env` and boot again. I put this in the same family as the E-3 secret checks: every boot-blocking condition is discovered in the first seconds, with an actionable message, because a process that cannot bind its port has nothing useful to offer.

**Q: "Why is Sentry tracing off by default, and what does it even do here?"**
Because telemetry is a promise about data leaving the machine, and a document vault should make that promise rarely. `Spotlight.init` runs only when `SPOTLIGHT_ENABLED=true`, and even then it points at a Spotlight sidecar on `localhost:8969` — a developer's own machine, no external account, no cloud destination — drawing the timeline of a request across layers while I profile locally. Default OFF means production builds ship with zero telemetry egress, and the code is defensive about it: an init failure is caught, logged as "continuing without telemetry", and the server boots anyway. Observability should be a switch you flip for a reason, not a faucet left open.

---

## The handshake — how my slice feeds the other five

- **If you ask me about the router, the pool or the schema → that's Student 1's area.** My side of the border: I launch and configure what they built. Their numbers are printed by my boot sequence — `migrations=12, routes=74` — and their pool (min 2, max 10) is sized by my `Database` construction, but the matching logic and the schema invariants are theirs.
- **If you ask me about JWTs, OTP flows or Brevo → that's Student 2's area.** My side: their OTP engine's two delivery modes are my two `.env` worlds — `MAIL_MODE=dev` feeds their codes to the log and the `X-Dev-OTP` header, `MAIL_MODE=live` hands them to Brevo — and my fail-fast gate refuses a live mode that would strand their flows mid-send.
- **If you ask me about encryption, shares or verification → that's Student 3's area.** My side: their encrypted bytes live in the `VAULT_DIR` my config points at, under the `VAULT_KEY` my boot validates to exactly 32 bytes before anything mounts — and my seeder creates their demo documents through their real `FileVault.encrypt` path, never around it.
- **If you ask me about screens, presenters or the mobile build → that's Student 4's area.** My side: the phone finds my server through the two env files I own — `mobile/.env.example` with `EXPO_PUBLIC_API_URL` on the app side, `CORS_ORIGIN` and `PORT` on mine — and their About screen reads its facts (`screens: 45`, `features: 216`) live from my `/api/meta`.
- **If you ask me about audit findings or the 8-pass audit → that's Student 5's area.** My side: two of their named findings are implemented *in* my files — E-3, the weak-JWT-secret refusal in `Config.validateJwtSecret`, and D-1, the 32-byte vault-key format in `validateVaultKeyFormat` — plus the `.gitignore` fences that close their information-leakage pass. Their IDs are cited in my code to this day.
- **Who most often bridges TO me:** everyone's live demo, honestly — the server must be up, seeded and observable before any of the five other slices can show anything. In DEFENCE_GUIDE.md's bridge map, build, config, secrets, seeding, metrics and deployment all route to this desk, and Student 5's hardening work most often ends up as changes in my files.