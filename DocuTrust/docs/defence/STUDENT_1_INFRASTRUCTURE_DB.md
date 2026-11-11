# Student 1 — Infrastructure & Database — Masterclass Deep Dive

This file is the complete rehearsal brief for the student presenting **Student 1 — Infrastructure & Database** in the DocuTrust oral defence (Group 3). It is written to be read aloud from, handed to examiners, and pointed at during the live demo. It expands the matching role section in [`DEFENCE_GUIDE.md`](../../DEFENCE_GUIDE.md) — the master index at the repository root — which carries the one-page version of this role. Everything here is grounded in the real repository: every class name, method name, migration and number below can be opened and verified live during the defence.

---

## My slice in one page

**Role in one line:** The skeleton and the truth layer — the pure-Java server platform every request travels through, and the PostgreSQL schema whose invariants live in the database engine itself.

**Owns:**

- `Router`, the middleware chain, the `Ctx` request context and the error envelope
- the JWT service (`JwtService`) and the rate limiter (`RateLimiter`) as platform services
- config/boot (`Config`, `Main` as composition root — shared with Student 6, who owns the run story)
- the migration runner (`Migrator`), the HikariCP connection pool (`Database`) and the transaction runner (`Tx`, `Rows`)
- the whole PostgreSQL schema: migrations V01–V12, 15 tables, CHECK constraints, foreign keys, triggers, views, indexes
- the mobile app shell side of the platform: the Dashboard screen and the navigation registry

**Feature claims:** FT-193 to FT-202 and FT-206 to FT-208 (server platform), plus the Dashboard and navigation registry features FT-173, FT-177, FT-178.

**My numbers:**

- **74 logical API routes across two services** — 56 registered in core-service's `Main.start` (`routes=56`, incl. the RC-1 `accept-invite`), 19 in auth-service (`routes=19`); each service prints its own count at boot
- **3 runnable services** — gateway :8080 (pure JDK reverse proxy), auth-service :8081, core-service :9000; the identical platform skeleton (Router → Middleware → Ctx) runs inside both working services
- **15 database tables — one shared database (Neon)** — built by migrations V01–V12 (plus `schema_migrations`, the migration runner's own clipboard, which is not one of ours); core-service is the only migrator (auth's is hardcoded off)
- **12 migrations** — one numbered SQL file each in `database/migrations/`
- **3 runnable jars** — `mvn clean install` packs `docutrust-gateway.jar`, `docutrust-auth-service.jar`, `docutrust-core-service.jar`
- **216 numbered features + the post-audit addendum (FT-217–FT-234)** in `docs/FEATURES.md`; my slice covers the Server Platform module FT-193–FT-208
- **3 roles** — `admin` > `org_manager` > `member`, enforced in `Middleware.requireRole`
- Connection pool: **min 2 idle, max 10 connections**, 10-second connection timeout, 30-minute max connection lifetime (HikariCP)
- Request executor: **32 worker threads** (`Executors.newFixedThreadPool(32)` in `Main.start`)
- Request body cap: **25 MB** (`Ctx.MAX_BODY_BYTES`, rejected with HTTP 413)
- Access-token lifetime: **900 seconds (15 minutes)** — `JwtService.ACCESS_TTL_SECONDS`
- Rate-limit budgets: **20/min for `auth`, 30/min for `public-share`, 20/min for `public-verify`, 10/min default** — `RateLimiter.SCOPE_DEFAULTS`
- Migration ledger: **`schema_migrations` (name TEXT PRIMARY KEY, applied_at timestamptz)**, created by `Migrator.apply`

> **Note:** every claim in this brief is verifiable from the public repository alone — the boot log prints the numbers, `mvn clean package` builds the runnable jar from a clean clone, and the live demo walks a real request through every layer during the defence.

---

## Elevator pitch (≈ 1 minute)

> "I built the skeleton everything else hangs on — and since the microservices refactor, that skeleton runs in three processes. DocuTrust's backend is pure Java 21 on the JDK's built-in HTTP server — no Spring — and every request is still matched by my hand-written router and passes through the same middleware chain: CORS, logging, JWT authentication, role guards and rate limiting. The chain lives in the shared module and runs identically inside core-service (56 routes) and auth-service (19 routes), in front of a **single shared Neon database** with one schema doing security work: fifteen tables with CHECK constraints, foreign keys, and append-only triggers so that even a database console cannot rewrite an audit trail. Each service gets its own small HikariCP pool (≤ 5 connections — sized for Neon's free tier), and exactly one service migrates. My proof is simple: the boot logs print `migrations=12, routes=56` and `routes=19`, `mvn clean install` builds the three jars in one command, and the gateway's banner names both upstreams — my routers are what sits behind it."

*Then demo:* run one request live against the local server (a `GET /api/admin/stats` with an admin token) and show the console line `[http] GET /api/admin/stats -> 200 (... ms)` appear as it is served; then open the SQL editor and run a manual `UPDATE` against `audit_logs` so the audience watches PostgreSQL itself throw the append-only exception. The numbers on screen — `migrations=12, routes=74` — come from the boot log of `Main.start`, so the claim checks itself.

---

## What I own, file by file

Every path below exists in the repository today — open any of them during the defence.

### The request boundary — `server/src/main/java/com/docutrust/http/`

| File | What it does, in one plain-English sentence |
|---|---|
| `http/Router.java` | The hand-written menu index: it matches an incoming method + path against all 74 registered routes, prefers static segments (like `/expiring`) over parameters (like `/:id`), and turns any unknown request into a clean 404 envelope instead of a crash. |
| `http/Middleware.java` | The security lane every protected request walks through: `authenticate` checks the bearer JWT and loads the user, `requireRole`/`requireAnyRole` enforce `admin`/`org_manager`/`member` (auditing every denial), and `rateLimited` applies the per-scope, per-IP token bucket. |
| `http/Ctx.java` | The standard order slip: one object per request that carries the path, query, route params, the parsed JSON or multipart body (capped at 25 MB), the authenticated user, and every response helper — including the CORS headers stamped onto every reply. |
| `http/Handler.java` | The one-line contract shared by router, middleware and controllers: a handler receives a `Ctx` and either responds or throws. |

### The error envelope and shared toolbox — package root and `util/`

| File | What it does, in one plain-English sentence |
|---|---|
| `AppException.java` | The typed error every layer throws: it carries an HTTP status, a machine-readable code (like `VALIDATION_ERROR`), a human message and an optional field, which the router converts into the one error envelope the whole API speaks. |
| `util/Json.java` | Our hand-rolled JSON parser and serializer (no external library) — it writes and reads every request body and every response envelope, including the `{"ok":true,"data":…}` wrapper. |
| `util/Text.java` | The shared text-and-crypto toolbox the platform leans on: base64url for JWTs, `sha256Hex`, random token generation, and `constEq` — the constant-time string comparison that keeps token verification timing-safe. |

### Platform security services — `auth/` (the platform-owned half)

| File | What it does, in one plain-English sentence |
|---|---|
| `auth/JwtService.java` | Our own HMAC-SHA256 JSON Web Token machine: `issue` prints a signed token with subject, role, org, `iat`/`exp`/`jti` claims, and `verify` checks the signature, distinguishes expired from invalid tokens with dedicated exception types, and returns typed `Claims`. |
| `auth/RateLimiter.java` | The bouncer's clicker, built on Bucket4j token buckets with the bucket map held in a Caffeine cache: per-scope budgets (20/min for `auth`, 30/min for `public-share`, 20/min for `public-verify`, 10/min default) keyed by scope + IP, with idle buckets evicted so memory cannot leak. |

### Boot and configuration — shared with Student 6 (they own the run story; I own what the boot wires)

| File | What it does, in one plain-English sentence |
|---|---|
| `config/Config.java` | Loads configuration once at boot (system properties > environment variables > optional `.env` file) and runs the fail-fast gates — weak/placeholder JWT secret (E-3), vault-key format (D-1), localhost-only demo seeding, live-mail credentials — refusing to start with a human explanation instead of a runtime surprise. |
| `Main.java` | The composition root: `Config.load()`, migrate, construct the pool and every service and controller, register all 74 routes, seed, start the scheduler and the HTTP server, then print the proof line `DocuTrust ready on port 8080 (migrations=12, routes=74, db=up, boot=…ms)`. |

### The database platform — `db/`

| File | What it does, in one plain-English sentence |
|---|---|
| `db/Database.java` | The HikariCP-backed JDBC pool (min 2 idle, max 10, 10 s connection timeout, 30 min max lifetime) behind a deliberately tiny surface — `get`/`release`/`with`/`tx`/`healthy`/`close` plus `poolIdle`/`poolActive` telemetry — so callers can ride the pool without knowing it is Hikari. |
| `db/Migrator.java` | The moving truck: applies every `V*.sql` in filename order, one transaction per file, recording each delivery in the `schema_migrations` table so re-running is always safe, with a splitter that respects quoted strings, `$$` dollar-quoted bodies and `--` comments. |
| `db/Tx.java` | The all-or-nothing rule: `Tx.with` turns autocommit off, runs the unit of work, commits on success and rolls back on any exception, restoring the old autocommit setting in a `finally`. |
| `db/Rows.java` | The read side of the DAO layer: static mappers that turn a JDBC `ResultSet` row into a typed model (`Rows.user`, `Rows.document`, `Rows.share`, …), handling nulls and timestamps uniformly. |

### The schema story — `database/migrations/` (V01–V12)

| Migration | What it adds |
|---|---|
| `V01__extensions_and_organisations.sql` | The `pgcrypto` and `pg_trgm` extensions (UUID generation and fuzzy text search), plus the first three tables: `organisations` (with a plan CHECK), `users` (role/status CHECKs, unique email) and the auth scaffolding `refresh_tokens` (unique `token_hash`) and `password_resets`. |
| `V02__folders_documents.sql` | `folders` (unique folder name per owner + parent) and `documents` (doc_type/status/review_status CHECKs, reminder window), including the star constraint `documents_sensitive_needs_review`: a medical or financial document physically cannot be `active` without review. |
| `V03__versions_history_shares.sql` | `document_versions` (UNIQUE on document + version number, positive file size), `document_history` (the auto-written timeline) and `shares` (permission CHECK, view-count guards, the 43-character link-token rule, and a CHECK that every share is either to a user or a link). |
| `V04__verification_notifications.sql` | `verification_requests` (status/result CHECKs, unique token), `notifications` and per-user `settings` (reminder offset between 1 and 90 days). |
| `V05__admin_reviews_audit.sql` | `admin_reviews` (the review queue) and `audit_logs` — the platform's append-only security diary with actor, action, IP, user agent and a JSONB `meta` column. |
| `V06__indexes.sql` | The speed layer: partial indexes for the hot queries (alive documents per owner, active share tokens, unread notifications), trigram GIN index for fuzzy title search, and audit/review ordering indexes. |
| `V07__triggers.sql` | The honesty layer: `touch_updated_at` stamps, the append-only triggers (`trg_history_immutable`, `trg_audit_immutable` — any UPDATE or DELETE raises an exception), the auto-history trigger `trg_documents_history` that writes `created`/`version_added`/`status_changed` rows, and `trg_version_sync` which mirrors the newest version's hash/size onto the document head. |
| `V08__views.sql` | Two saved queries as views: `v_expiring_documents` (what is about to expire) and `v_admin_stats` (the registrar dashboard's numbers). |
| `V09__verification_pinning.sql` | Adds `version_id` to `verification_requests` and backfills it, so every verification proof is pinned to the exact document version that existed when it was minted (audit finding F-4). |
| `V10__email_otps.sql` | The `email_otps` table of the OTP security overhaul — one row per hashed, single-use, purpose-salted code — plus three indexes for target, user and share lookups. |
| `V11__shares_require_otp.sql` | Adds `require_otp` and `otp_recipient_email` to `shares`, turning a share link into a doorman that checks one emailed code. |

### The mobile shell I own — `mobile/src/`

| File | What it does, in one plain-English sentence |
|---|---|
| `mobile/src/screens/index.js` | The screen registry (`SCREEN_REGISTRY`, 45 entries, counted by `SCREEN_COUNT`): one place where a screen name maps to its component, owning module and title, so navigation, deep links and notification taps all share one directory instead of ad-hoc paths. |
| `mobile/src/navigation/RootNavigator.js` | The app switcher: builds the stacks from the registry and mounts the admin stack (`AdminStack`) only when the session role is `admin` — role-based navigation decided in one file. |
| `mobile/src/screens/DashboardScreen.js` | The member's home screen: the shell view that greets the user and routes into the documents, shares and notifications flows. |
| `mobile/src/screens/AdminDashboardScreen.js` | The registrar console's home screen: the admin-side shell over the review queue, users and audit views. |

---

### Shared platform files — I can speak to them, the feature owners drive them

| File | What it does, in one plain-English sentence |
|---|---|
| `model/Models.java` | The standard plate shapes: every typed record the mappers fill (`Models.User`, `Models.Document`, `Models.Share`, …) plus `Models.Page`, the pagination wrapper behind `okPage`. |
| `vault/FileVault.java` | The safe's interface that my boot constructs with the validated 32-byte key (`Main.start` → `new FileVault(Path.of(cfg.vaultDir), vaultKeyBytes(cfg.vaultKey))`) — the encryption itself is Student 3's feature. |

### Reading the error envelope, field by field

Every failure in the API leaves through one door — `Router.sendError` — so an examiner only needs one shape:

| Envelope field | What it carries | Example |
|---|---|---|
| `ok` | Always `false` on errors, `true` on success — the client's first check | `false` |
| `error.code` | The machine-readable reason a screen can translate | `VALIDATION_ERROR`, `TOKEN_EXPIRED`, `RATE_LIMITED` |
| `error.message` | The human sentence, safe to show | `"Email is not valid"` |
| `error.field` | Optional; names the offending input, set by `AppException.validation(field, msg)` | `"email"` |

The codes are minted by the factory methods on `AppException` — `unauthorized` (401), `forbidden` (403), `notFound` (404), `conflict` (409), `tooLarge` (413), `rateLimited` (429), `internal` (500) — so no layer ever hand-assembles a status code, and the full catalogue is documented in `docs/API_CONTRACTS.md`.

### The pooling-and-caching layer — two Caffeine caches

The infrastructure upgrade gave the platform its caching half, both built on Caffeine with hard ceilings so neither can grow unbounded:

| Cache | Where | Ceiling | Eviction rule |
|---|---|---|---|
| Rate-limiter bucket map (`RateLimiter.buckets`) | one Bucket4j token bucket per `scope\|ip` key | `maximumSize(50_000)` | `expireAfterAccess(10 min)` — an IP that goes quiet forgets its bucket, so memory cannot leak |
| Document read cache (`DocumentService.docCache`) | per owner+document lookup on the hot read path | `maximumSize(1_000)` | `expireAfterWrite(10 s)` — residual staleness is bounded by the TTL, and every mutation invalidates its key explicitly |

The first cache is entirely mine (it is the rate limiter's memory); the second serves Student 3's document feature but is part of the caching layer this slice owns — and its contract is the honest one: ownership is re-checked on every write, and any change to a document drops its cache entry in the same request.

## Five layman's analogies

1. **HikariCP is a restaurant host.** Guests (database queries) don't wait for a free table to be built; a host keeps a fixed set of tables ready and seats the next guest at whichever frees up first. Before HikariCP we hand-wrote that seating logic; now it's a battle-tested library with the same seats (our code's API didn't change at all).
2. **Migrations are LEGO instructions in order.** Each numbered file (V01–V12) adds a few bricks — a table here, an index there — and the database is just the sum of the steps. Any team member can rebuild the exact same database from scratch, which is why our ER diagram and our production schema can never drift apart.
3. **The gateway is a hotel receptionist; each service is a floor.** You say "I'm here for room 12" (`/api/documents/:id`) and the receptionist walks the request — untouched — to the right floor: identity requests to the security floor (`/api/auth/*` → auth-service), everything else to the vault floor (core-service). One exact room number even breaks the pattern on purpose (`POST /api/auth/accept-invite` → the vault floor, RC-1). The floors themselves each keep their own hand-written floor directory (my Router — 56 and 19 known destinations, static room numbers beating wildcards), and a closed floor gets a clean 502 from the receptionist instead of an endless wait.
4. **The middleware chain is airport security.** Every passenger walks the same lane before reaching the shops: the passport scan is JWT authentication, the boarding-class check is the role guard, and the queue counter that says "too many people, wait" is the rate limiter. No shop — no controller — is ever reached without passing through the lane first, and the lane's order never changes, which is exactly why it is owned by one person.
5. **The append-only audit trigger is a cash-register till tape.** The tape only prints new lines; you cannot edit or un-print a line, not even the shop owner can, and at the end of the day the tape is the one thing everyone trusts in a dispute. Our `audit_logs` and `document_history` tables work the same way: the database itself raises an exception if anyone — application, administrator, or a hand-typed SQL command — tries to alter or tear out a line.

---

## The critical code walkthrough

One request's full journey, in order, naming the exact classes and methods. Example request: `GET /api/admin/stats` with a valid admin bearer token.

**1. The socket.** The JDK's built-in HTTP server (`com.sun.net.httpserver.HttpServer`) is created in `Main.start`: `HttpServer.create(new InetSocketAddress(cfg.port), 0)`, then `server.createContext("/", router)` hands every path to our one `Router`, and `server.setExecutor(Executors.newFixedThreadPool(32))` gives it 32 worker threads. There is no framework between the TCP socket and our code — the first line of Java that runs is ours.

**2. `Router.handle(HttpExchange)`.** The router wraps the exchange in a `Ctx` (the order slip), starts a millisecond timer, and short-circuits CORS preflight: an `OPTIONS` request is answered `204` immediately via `ctx.raw(204, null, null)`.

**3. `Router.match(method, path)`.** Every registered route was pre-split into segments in the `Route` constructor, each `:param` segment flagged and each route scored with `staticSegs`. `match` walks all routes, keeps the ones whose segment count equals the path's (`matches`), collects parameter values into a map, and keeps whichever candidate has the **highest static segment count** — that one line, `if (matches(r, path, params) && (best == null || r.staticSegs > best.route().staticSegs))`, is the whole static-over-param precedence rule. It is why `/api/documents/expiring` and `/api/shares/incoming` are never swallowed by `/:id` patterns. No match → `AppException.notFound(...)` → a 404 envelope, never a crash.

**4. The middleware chain — wrapped at registration time.** The chain is not a runtime loop; it is composed when `Main.start` registers each route, so the order is fixed in code. `router.role("GET", "/api/admin/stats", "admin", adminC.stats())` literally wraps `mw.authenticate(mw.requireRole("admin", h))`. For a request that means:
- `Middleware.authenticate`: reads the `Authorization: Bearer` header via `ctx.bearer()`; no token → 401. `jwt.verify(token)` (in `JwtService`) checks the HMAC-SHA256 signature with the constant-time `Text.constEq`, then the expiry — a `TokenExpiredException` becomes `401 TOKEN_EXPIRED` (which the mobile client uses to trigger its refresh), a `TokenInvalidException` becomes plain `401 UNAUTHORIZED`. The claims' `sub` is then loaded from the database (`loadUser` → `db.with` → `Rows.user`), so a deleted account's token dies immediately, and a suspended account gets `403 ACCOUNT_SUSPENDED`.
- `Middleware.requireAnyRole`: the user's role must be one of the allowed ones; a denial is not silent — `auditDenied` writes an `admin_access_denied` row into `audit_logs` before the `403 FORBIDDEN` is thrown.

**5. The metrics timer.** Around the handler call, `Metrics.route(method, pattern)` opens a Dropwizard timer and marks a meter **per route pattern** (e.g. `GET /api/admin/stats`), not per URL — so the metrics namespace can never explode with ids (the INFRA-2 comment in `Router.handle`). It is a try-with-resources block, so even requests that fail are counted.

**6. Controller → service → DAO.** The handler `AdminController.stats()` is a waiter: it never cooks. It delegates to `AdminService`, which does the real work through the `db` platform: every read is a `PreparedStatement` (SQL-injection safe by construction) executed through `db.with(...)` or `db.tx(...)`, and rows come back as typed models via `Rows`. The stats themselves come from the `v_admin_stats` view that migration V08 created — the database does the aggregating.

**7. HikariCP → PostgreSQL.** `db.with` borrows a pooled connection (`Database.get()` → `ds.getConnection()`), runs the work, and always returns the connection in a `finally` (`release`, where `close()` means "back to the pool"). The pool is configured for min 2 idle / max 10 connections, a 10-second borrow timeout and a 30-minute max lifetime, so connections retire before PostgreSQL's idle timeouts can kill them.

**8. The response envelope.** The controller calls `ctx.ok(data)`, which builds `{"ok":true,"data":…}` with `Json.obj` and sends it through `Ctx.respondMap` → `Ctx.raw`. `raw` stamps `Content-Type: application/json; charset=utf-8` and the CORS headers (`Access-Control-Allow-Origin` from `cfg.corsOrigin`, plus `X-Step-Up-Token` in the allowed headers) onto **every** response, writes the body, and closes the exchange.

**4b. The authentication decision table.** `Middleware.authenticate` plus the role guard produce exactly these outcomes — every branch is a line you can find in `Middleware.java`:

| Situation at the gate | What the middleware answers |
|---|---|
| No `Authorization: Bearer` header | `401 UNAUTHORIZED` ("Missing bearer token") |
| Signature does not verify (`TokenInvalidException`) | `401 UNAUTHORIZED` ("Invalid access token") |
| Signature valid but `exp` passed (`TokenExpiredException`) | `401 TOKEN_EXPIRED` — the client's cue to refresh |
| `sub` not found in `users` | `401 UNAUTHORIZED` ("Account no longer exists") |
| Account `status = 'suspended'` | `403 ACCOUNT_SUSPENDED` |
| Valid user, wrong role for the route | `403 FORBIDDEN`, plus an `admin_access_denied` audit row |

**9. The log line, always.** In the router's `finally` block, exactly one line prints per request: `[http] GET /api/admin/stats -> 200 (12 ms)`. Errors take the same corridor: an `AppException` becomes `sendError(...)` — `{"ok":false,"error":{"code":…,"message":…}}` — while any unexpected exception is caught by `logUnexpected`, which writes an `http.internal_error` row to `audit_logs` and returns a generic `500 INTERNAL_ERROR` so no stack trace ever reaches a client.

And the truth-layer half of the proof: in a SQL console, `UPDATE audit_logs SET action='x';` fails outright — the trigger `trg_audit_immutable` (migration V07) raises `audit_logs is append-only (platform audit)` before the statement can touch a single row. A tiny fragment of the rule, from `V07__triggers.sql`:

```sql
CREATE FUNCTION forbid_audit_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs is append-only (platform audit)';
END $$ LANGUAGE plpgsql;
```

### The write path — same corridor, and where my platform does the heavy lifting

The read example above is half the story; a `POST /api/documents` upload walks the identical corridor with three extra platform moments:

1. `Ctx.multipart()` parses the multipart body by hand — boundary detection, headers per part, byte slices — after `body()` already enforced the 25 MB cap, so the expensive parse only happens for a body we accepted.
2. `DocumentService.upload()` (Student 3's feature) runs inside one `db.tx(...)`: the document row, version one, and the first history entry commit together or not at all — one connection, no nesting.
3. My triggers take over on commit: `trg_documents_history` writes the `created` history row automatically, and `trg_version_sync` mirrors the version's `sha256`, size and mime type onto the document head — the schema doing bookkeeping no Java code has to remember.

### The 74 routes at a glance — now split across two services

The route count is not a slogan; it is the registration section, countable line by line. Since Phase 2 it lives in **two files**: the "public auth" and "authenticated profile & MFA / sessions" rows below are registered in **auth-service's** `Main` (19 routes there, including its own health route), and every other row is registered in **core-service's** `Main` (56 routes, still including the RC-1 `accept-invite`):

| Registration group | How they are registered | Count |
|---|---|---|
| Public health & meta | `publicRoute` | 2 |
| Public auth (register, login, forgot, reset, verify-otp, accept-invite) | `rateLimited("auth", …)` | 6 |
| Public auth continued (refresh, logout, verify-email) | `publicRoute` | 3 |
| Authenticated profile & MFA (`me`, change-password, step-up, mfa/*) | `auth` | 8 |
| Authenticated sessions (Active Sessions list + revoke) | `auth` | 2 |
| Documents (list, upload, expiring, get/patch/delete, restore, permanent, versions, download, history) | `auth` | 13 |
| Folders | `auth` | 5 |
| Shares (owner side) | `auth` | 6 |
| Public share links (info, open, request-otp, open-with-otp, download ticket) | `rateLimited("public-share", …)` | 5 |
| Verification requests | `auth` | 5 |
| Public verify link | `rateLimited("public-verify", …)` | 1 |
| Notifications & settings | `auth` | 5 |
| Admin (stats, review queue, review detail, decision, users, status, documents, audit logs) | `role("admin", …)` | 8 |
| Organisation (members, invite, role change, remove, stats) | `anyRole("admin", "org_manager", …)` | 5 |
| **Total** | `router.routeCount()` printed at each boot — core-service `routes=56`, auth-service `routes=19` (18 auth + its health) | **74 logical** |

### The schema's guarantees, demonstrated live

Five refusals an examiner can watch the database itself produce, each traceable to one migration line:

| Attempt in a SQL console | What PostgreSQL answers | Rule |
|---|---|---|
| Set a `medical` document to `status='active'` with `review_status='none'` | CHECK violation | `documents_sensitive_needs_review` (V02) |
| Insert a second `document_versions` row with the same document + version number | UNIQUE violation | `UNIQUE (document_id, version_number)` (V03) |
| `UPDATE audit_logs SET action='x'` | Exception: append-only | `trg_audit_immutable` → `forbid_audit_mutation` (V07) |
| `DELETE` from `document_history` | Exception: append-only | `trg_history_immutable` → `forbid_history_mutation` (V07) |
| Insert a share whose `link_token` is 20 characters | CHECK violation | `char_length(link_token) = 43` (V03) |

### Where each number lives

| My claim | Where an examiner verifies it |
|---|---|
| `routes=56` / `routes=19` | Printed by each service's boot (core-service `Main.start`, auth-service `Main`); counted from the two registration blocks |
| `migrations=12` | Printed by core-service's boot (`[main] migrations applied: 12`); twelve files in `database/migrations/` — auth-service prints `migrations skipped` instead |
| 15 tables | The CREATE TABLE statements across V01–V05 and V10 — **one shared database** for both services |
| 3 runnable jars | `mvn clean install` on a clean clone packs `docutrust-gateway.jar`, `docutrust-auth-service.jar`, `docutrust-core-service.jar` — the one-command build works from nothing |
| 3 roles | `Middleware.requireAnyRole` + the CHECK on `users.role` (V01) — the same middleware runs in both services |
| Pool 2–10 (≤ 5 per service in production) | The `new Database(..., 2, 10, ...)` call in each service's boot, configured in `db/Database.java`; `DB_POOL_MAX` caps it for Neon |
| 32 threads (core) / 64 (gateway) | `server.setExecutor(Executors.newFixedThreadPool(...))` in each boot |
| 25 MB cap | `Ctx.MAX_BODY_BYTES` in `http/Ctx.java` |

### How a fresh database becomes the schema — the `Migrator.apply` loop

Eight steps, each one a line in `db/Migrator.java`:

1. List every file in `cfg.migrationsDir` whose name starts with `V` and ends with `.sql` (a missing directory stops the boot with a `MIGRATIONS_DIR` hint).
2. Sort by filename — the V-numbers *are* the ordering, so nobody can apply V07 before V02.
3. Open one transaction for this file.
4. Inside it: `CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at timestamptz DEFAULT now())` — the clipboard, created lazily on the very first run.
5. Ask the clipboard whether this filename is already recorded; if yes, the transaction closes with nothing done (idempotence).
6. Read the file and split it into statements with `Migrator.split` — the splitter that tracks single-quoted strings (with `''` escapes), `$$` dollar-quoted bodies and `--` line comments, so a semicolon inside a comment cannot cut a statement in half (the C-2/C-13 lesson).
7. Execute each statement, then `INSERT INTO schema_migrations(name)` — the delivery and its receipt commit together.
8. Collect the applied names; `Main.start` prints them as `[main] migrations applied: 12`.

---

## My domain, in plain words (glossary)

| Term | Plain meaning, with an everyday analogy |
|---|---|
| **Middleware** | Airport security: the same lane every passenger walks through (ID check, boarding class, queue counter) before reaching any shop. In code: `Middleware.authenticate`, `requireRole`, `rateLimited`. |
| **JWT (JSON Web Token)** | A tamper-proof visitor badge: a signed card that states who you are and until when — the signature makes forging it as futile as photocopying a hologram. Ours is HMAC-SHA256, hand-built in `JwtService`. |
| **HTTP status code** | The rubber stamp on the reply envelope: 200 "here you go", 401 "no or fake ID", 403 "real ID, not allowed", 404 "no such thing", 429 "too many requests". |
| **CORS** | The guest list at the club door for web browsers: a header the server sends declaring which origins may talk to it, so a stranger's website cannot quietly use your logged-in session. |
| **Connection pool (HikariCP)** | The restaurant host: a fixed set of ready "tables" (open database connections) that guests (queries) are seated at instantly, instead of building a new table per guest. HikariCP is the battle-tested professional host we hired to replace our hand-written one — same seats, and it reports room occupancy (`poolIdle`/`poolActive`). |
| **Transaction** | An all-or-nothing order: either every dish of the order is accepted or the whole order is cancelled — never half a dinner. `Tx.with` does commit-or-rollback. |
| **Migration** | One numbered LEGO instruction sheet (V01–V12) that adds bricks to the database; applied in order, once each, tracked in `schema_migrations`. |
| **CHECK constraint** | A house rule even the boss must obey, enforced by the clerk (the database engine): a medical document simply cannot become "active" without review — no buggy code can persuade it. |
| **Foreign key** | The cross-reference on a filing card: "owner: see card #42 in USERS." The clerk refuses to file a document whose owner card does not exist. |
| **Trigger** | An automatic reflex wired into the table: insert a version and the head row updates itself (`trg_version_sync`); try to edit the audit tape and the alarm rings (`trg_audit_immutable`). |
| **Append-only** | A cash-register tape: new lines can be printed, existing lines can never be edited or torn out — even by the owner, even by hand-typed SQL. |
| **Index** | The tabs on a filing cabinet: pre-sorted shortcuts so the clerk finds "documents owned by me, not deleted" without reading every card (V06 builds them). |
| **PreparedStatement** | An order form with printed blanks: the SQL is fixed, only the blank values arrive, so nothing a user types can ever be mistaken for part of the form itself (the cure for SQL injection). |
| **JSON envelope** | The standardized tray every answer travels on: `{"ok":true,"data":…}` or `{"ok":false,"error":{…}}` — the client opens every reply the same way. |
| **Rate limiter (token bucket)** | The bouncer's clicker: each caller gets a small purse of tokens per minute (20 for auth, 30 for public shares); when the purse is empty, the answer is 429 "wait a minute". |

---

## My ultimate Q&A bank

### From the per-student pack (the classics)

**Q: "Why should one student own the middleware, rather than sharing it?"**
Because the middleware chain is where cross-module policy lives, and split ownership would have meant five people editing one file with five opinions. Owning it let me keep the chain small and consistent while module owners focused on services; I still paired with each of them when their endpoints needed a new guard.

**Q: "Your router matches static segments over parameters. Why does that ordering matter?"**
If /api/documents/expiring were captured by /api/documents/:id, the word expiring would be treated as an id and the route would 404 or misparse. Matching static segments first, parameters second, is what lets both shapes coexist. The `staticSegs` scoring in `Router.match` is the whole rule — one line you can read in the file.

**Q: "How do you know your JWT implementation is correct?"**
Three ways. The code is small enough to read aloud: sign, verify, check expiry — each a named method in `JwtService`. The middleware treats expired and invalid differently, which the client depends on for refresh. And the live demo runs real login-to-refresh flows over HTTP, so the hand-rolled token is exercised against the running server, not just in isolation.

**Q: "If I delete Spring from the equation, what did you actually gain educationally?"**
The ability to answer how questions that frameworks answer with because it does. How routing matches, when middleware runs, what a 401 versus 403 means, why a connection pool bounds concurrency — each is a file we wrote. That is the difference between using a framework and understanding one.

**Q: "Why put the sensitive-document rule in a CHECK constraint instead of the service?"**
Because the service can be bypassed — a migration, a manual SQL statement, a future bug — but the constraint is enforced on every statement by the engine. The rule is one line: a medical or financial document cannot be active unless its review status is submitted. Encoding it in the schema means the review process has no silent back door, which is exactly what an auditor would want to hear.

### The masterclass ten

**Q: "The pool has 10 connections but the server has 32 request threads. What happens when the pool is exhausted?"**
Then up to ten queries run at once and the other requests wait to borrow a connection. HikariCP bounds that wait: `Database` sets the connection timeout to 10 seconds, so a request that cannot borrow within that window gets a SQL exception, which `Tx.rethrow` turns into an error and my router's catch-all converts into a clean `500 INTERNAL_ERROR` envelope — with an `http.internal_error` row in `audit_logs` recording the path. The 32 threads are cheap (they mostly wait on the network or the database); the 10 connections are the expensive, scarce resource, and that bound is precisely what protects PostgreSQL from being stampeded. You can watch the balance live: `Database.poolIdle()` and `poolActive()` expose the host's free and occupied tables.

**Q: "Why are your transactions non-nested? What bug does that prevent?"**
A nested transaction would hold two pool connections at once — the outer one and the inner one — which on a bounded 10-connection pool is a recipe for self-inflicted deadlock, and worse, the two could commit independently: the outer work rolls back while the inner audit row survives, so the trail claims events that never happened. That exact bug is audit finding C-1. The fix is transaction hygiene: one connection per unit of work, and helpers receive the already-open connection instead of starting their own — for example `NotificationService.notify(Connection c, …)` takes the caller's connection, it never borrows a second one. Side effects that may legitimately lag, like best-effort audit writes, run after the outer commit, so the trail can only be late, never false.

**Q: "How do you track which migrations have run, and why no checksums?"**
The runner keeps its own clipboard: `Migrator.apply` first creates `schema_migrations` (a name plus `applied_at`), and for each `V*.sql` in sorted filename order it checks, inside the same transaction, whether that name is already recorded — if not, it executes the file statement-by-statement and inserts the name, committing both together. So a fresh database runs all eleven and a five-month-old database runs only what it is missing, and a re-run is always a no-op. We deliberately do not checksum file contents: migrations are append-only history, reviewed in version control — you fix forward with V12, never edit V07 in place, exactly like the LEGO instructions cannot be reordered once built.

**Q: "Why are the append-only rules database triggers and not just code discipline?"**
Because the whole point of an audit trail is that it survives the failure of everything above it. `trg_history_immutable` and `trg_audit_immutable` execute `forbid_history_mutation` / `forbid_audit_mutation`, which raise an exception on any UPDATE or DELETE — including from a manual SQL console, a migration, or a future bug. Application discipline is a promise; a trigger is physics. It is also the honest answer to "what if someone with database credentials goes rogue": they can add rows, but they cannot quietly rewrite the past, and attempts are loud, not silent.

**Q: "After the refactor, where does routing actually live — gateway or service?"**
Both, in a deliberate division of labour. The **gateway** answers one question only: *which building* — RC-1's exact match first, then the `/api/auth/` prefix, then the default; it never inspects roles or bodies. **Inside each service**, my Router still answers *which room* — method + path pattern matching with static-over-param scoring, exactly as before. The two layers never overlap: the gateway forwards byte-for-byte and cannot 404 a known service route, and the services 404 on their own unknown paths. That is why the total menu is unchanged: 74 dishes, one cashier, two floor directories.

**Q: "Why PreparedStatements everywhere, rather than building SQL strings?"**
Three reasons. Security: the SQL shape is fixed and only values are sent, so a user typing `' OR 1=1 --` into a search box is stored as text, never executed as SQL — the injection simply has nowhere to happen. Correctness: types are bound explicitly (UUIDs as UUIDs, timestamps as timestamps), which kills a whole class of quoting bugs. Performance: the database can reuse a prepared statement's execution plan instead of re-parsing a new string every time. Every query in every service and in the middleware follows this one pattern, so there is no "clever" exception to audit.

**Q: "Beyond the route table, where does static-over-param routing actually pay off in this API?"**
All over the menu. `/api/documents/expiring` exists alongside `/api/documents/:id`; `/api/shares/incoming` alongside `/api/shares/:id`; `/api/notifications/read-all` alongside `/api/notifications/:id/read`. Without precedence, "expiring", "incoming" and "read-all" would be parsed as UUIDs, fail parsing, and surface as mysterious 404s — the classic framework foot-gun. Because `Router.match` scores candidates by static segments, the specific path always wins, and because the boot log prints `routes=74`, an examiner can count the menu live and see that every registered dish is findable.

**Q: "What happens to an in-flight request if the database dies mid-operation?"**
The borrow or the query throws; `Tx.with` rolls the transaction back — autocommit restored in the `finally` — and the exception is rethrown up to the router, which answers a generic 500 envelope and writes the `http.internal_error` audit row. The server itself does not fall over: the pool keeps the surviving connections, HikariCP keeps retrying on demand, `Database.healthy()` (a `SELECT 1`) reports honestly, and `/api/health` shows `db:false` while the boot-style log would print `db=DOWN`. Recovery needs no restart: the next request that borrows successfully is served normally.

**Q: "You hand-rolled a JSON parser. Isn't that dangerous?"**
It would be, if it were ambitious — so we kept it small and boring. `util/Json` supports exactly what our envelope needs: objects, arrays, strings with escapes, numbers, booleans and null, plus the `Json.obj`/`Json.write` builders. It has no code-execution surface to begin with (it builds plain maps and lists, it never instantiates classes from input), and malformed input throws and the caller turns that into a 400 VALIDATION_ERROR. The honest trade: we gave up convenience features we do not use, in exchange for a parser we can read line by line during the defence.

**Q: "Why check the request body size before reading it?"**
Because `Ctx.body()` reads the whole body into memory (`readAllBytes`), an unchecked 2 GB upload would be a denial-of-service with one request. So `Ctx` caps `MAX_BODY_BYTES` at 26 MB — a little over the 25 MB file limit — and checks the `Content-Length` header before reading a single byte, rejecting with `413 FILE_TOO_LARGE` via `AppException.tooLarge`. The cheap header check runs first; the expensive read only happens for bodies we are willing to hold. That ordering — refuse before you pay — is the same fail-fast instinct the config layer uses.

**Q: "Who enforces the response envelope, and what if a handler forgets to answer?"**
The router does, twice. Success responses go through `Ctx.ok`/`created`/`okPage`, which always wrap data as `{"ok":true,"data":…}`; every error is funneled into `Router.sendError`, which always wraps as `{"ok":false,"error":{"code","message"}}`. And if a handler finishes without responding at all, the router notices — `if (!ctx.hasResponded()) throw AppException.internal("Handler produced no response")` — so a client can never be left hanging on a silent route. The mobile client's `ApiClient` unwraps exactly this shape, which is why a screen that hits an error always finds a machine-readable `code` it can translate into friendly words.

---

## The handshake — how my slice feeds the other five

- **If you ask me about tokens, OTPs or Brevo → that's Student 2's area.** My side of the border: `Middleware.authenticate` is where every JWT is verified and where `401 TOKEN_EXPIRED` is born — I verify the badge; Student 2 decides what badges exist, how they rotate, and what the OTP engine mails. My rate limiter's 20/min `auth` scope is what stands between code-guessers and their OTP engine.
- **If you ask me about encryption, share guards or verification → that's Student 3's area.** My side: their entire business layer rides on my platform — the atomic share-guard `UPDATE` runs inside my `Tx.with` on my HikariCP pool, and their "zero rows moved" reasoning depends on my single-connection transaction rule. The Caffeine read cache they use is a platform library I brought in.
- **If you ask me about screens, presenters or the API client → that's Student 4's area.** My side: the envelope and status codes their `ApiClient` unwraps are produced by my `Ctx` and `Router`, and the `401 TOKEN_EXPIRED` distinction is the hook their single-flight refresh hangs on. I also own the shell they live in: the `SCREEN_REGISTRY`, `RootNavigator` role stacks and the Dashboard screen.
- **If you ask me about audit findings or the fix comments → that's Student 5's area.** My side: several of their findings are fixed *in* my files — C-1 (the one-connection transaction hygiene in `Database`/`Tx`), C-2/C-13 (the migration splitter that survives `;` inside comments), E-3 (the weak-secret refusal in `Config`) and D-1 (the 32-byte vault-key format). Their IDs are cited in those files to this day.
- **If you ask me about builds, configuration, seeding or deployment → that's Student 6's area.** My side: I own *what* the boot does — wire the pool, apply the migrations, register the routes (in core-service and auth-service alike); Student 6 owns *how it is launched, configured and monitored* — and the gateway that stands in front of both. Their boot logs literally print my numbers: `migrations=12, routes=56` and `routes=19`.
- **Who most often bridges TO me:** Student 5 — audit findings kept landing in my layer, so their stories start in my files; and Student 3, whose services are the heaviest daily users of my transactions, pool and query mappers. The bridge map in DEFENCE_GUIDE.md routes every schema, pool and router-matching question to this desk.
