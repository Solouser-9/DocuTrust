# DocuTrust — Architecture

Rendered diagram: [`diagrams/architecture.png`](diagrams/architecture.png) · Mermaid source: [`diagrams/src/architecture.mmd`](diagrams/src/architecture.mmd)

> **Plain English — why it looks like this:** six students, a few weeks, real security requirements. A tangle of microservices would have meant network failures and distributed-transaction headaches nobody could defend, so DocuTrust is a *modular monolith*: one small Java process where every request visibly flows through the same four layers. The rule of the house is "boring and readable beats clever": a hand-written router you can read in ten minutes, one middleware chain every request passes, services that own their rules, and a database schema that enforces the invariants even when application code has a bug. The infrastructure upgrade swapped our hand-rolled internals for proven libraries — HikariCP for pooling, Bucket4j for rate limiting, Caffeine for caching — **without changing the code that calls them**, which is the whole point of good seams.

## For absolute beginners: the restaurant and the smartphone

Never written code? Two pictures carry the whole architecture.

**The backend is a well-organized restaurant.** The `controller` folder is the **waiters taking orders** — ten of them, one per menu section; they check your ID (the JWT), take the order, and carry the plate back, but never cook. The `service` folder is the **chefs cooking** — encryption, one-time codes, share rules; we swapped the password-reset recipe for an OTP recipe without changing a single waiter. The `db` folder is the **pantry** plus a strict head clerk: fifteen drawers of facts and eleven numbered instruction sheets (`V01…V11`) that rebuild the pantry from scratch. The `auth` folder is the **ID checkers at the door**, the `http` folder is the **uniforms and order pads** (the router and middleware every order passes), and `vault` is the **safe** where files sit encrypted. No waiter ever walks into the pantry himself — that separation is the whole design.

**The frontend is a smartphone.** `screens/` are the different **apps you open** (45 of them); `components/` are the **buttons on the screen** (cards, inputs, toasts — drawn once, used everywhere); `microservices/` are the **invisible background processes that fetch your data** (nine folders — auth, documents, sharing… — each owning its api/model/presenter trio); `navigation/` is the **home-screen gesture**; `mvp/` is the rulebook every app's "waiter" follows; `core/` is the **settings**. And the loop that ties both pictures together: the customer (app) orders from the waiter (API — 71 dishes on the menu), the waiter checks ID and permission, the kitchen (services) cooks, the pantry (database) remembers — and the answer always comes back on the same standardized tray (the JSON envelope). The full beginner walkthroughs, one per concept, live in [`DEFENCE_GUIDE.md`](../DEFENCE_GUIDE.md) Part 2.

## Layers

```
Mobile (React Native 0.88 / Expo SDK 58, JavaScript)
  9 frontend microservices · 45 screens · MVP (View → Presenter → Model)
        │ HTTPS · JSON envelopes · Bearer JWT · multipart
        ▼
REST boundary (pure Java 21, com.sun.net.httpserver — no Spring)
  Router (71 paths, :id patterns) · Middleware (CORS, logging, JWT auth,
  role guard, rate limit) · 10 thin controllers
        │ plain method calls
        ▼
Domain services (business rules, transactions, authorization, audit)
  Auth · Document · Folder · Share · Verify · Notification · Settings · Admin · Org · Audit
  OtpService (hashed one-time codes) · MailService (Brevo) · StepUpService (destructive-action gate)
  ExpiryScheduler (60 s) · Bootstrap seeder
        │ JDBC (HikariCP pool) · PreparedStatement only
        ▼
Data & storage
  Supabase PostgreSQL (15 tables, V01–V11, constraints, triggers, views)
  FileVault — AES-256-GCM encrypted bytes + SHA-256 integrity
        │
  Supporting cast: Bucket4j token buckets (rate limits) · Caffeine (limiter buckets +
  document read cache) · Dropwizard Metrics (per-route timers → /api/health) ·
  Sentry Spotlight (optional local tracing, off by default)
```

## Request lifecycle (authoritative version)

1. Presenter calls `ApiClient` → request leaves with `Authorization: Bearer <JWT>`.
2. Router matches method + path pattern (static segments beat `:id` params), parses query.
3. Middleware chain: CORS → logging → JWT verify (401 `UNAUTHORIZED` / `TOKEN_EXPIRED`) → role guard (403 + audit row on refusal) → rate limit (429, Bucket4j token bucket per scope + IP).
4. Controller parses → calls service. Services own all business rules.
5. Service runs DAO calls inside `Tx` on a HikariCP connection (autocommit off; commit or rollback). Transactions are single-level — services never open a nested `db.tx` inside an open one (the nested calls that used to hold two pool connections were removed in the hardening pass, audit finding C-1). Every SQL statement is a `PreparedStatement`.
6. Success: `{ ok:true, data, meta? }`. Failure: typed `AppException` → global boundary → `{ ok:false, error:{ code, message, field? } }`.
7. Sensitive destructive routes add a second gate: without a valid `X-Step-Up-Token` (a 5-minute JWT issued after an emailed OTP) they answer `403 STEP_UP_REQUIRED` — this covers password change and permanent deletion.
8. OTP flows (`forgot-password`, MFA email fallback, step-up, share OTP, invites) mint a hashed, single-use row in `email_otps` and email the 6-digit code through Brevo; in `MAIL_MODE=dev` the code is additionally echoed via the `X-Dev-OTP` response header so demos and the E2E suite need no mail traffic. Bodies never carry codes.
9. Security-relevant branches also append to `audit_logs` (append-only by trigger).

## Module ownership map (6 students)

| Student | Domain | Server | Mobile | Tests |
|---|---|---|---|---|
| 1 | Infrastructure & DB | Router, middleware, JWT, config, boot, migrations | Dashboard, navigation shell | Router/JWT unit tests |
| 2 | Auth & OTP security | AuthService, PBKDF2, rotation, MFA, OtpService, MailService, StepUpService, limiter | 8 auth screens | JWT/Password/MFA unit + OTP e2e steps |
| 3 | Business logic | DocumentService, FileVault, ShareService, VerifyService, invites | 12 vault screens | Vault unit + share/tamper e2e |
| 4 | Mobile app | — (API client contract) | All 45 screens, MVP infra, ApiClient | Presenter Jest suite |
| 5 | The 8-pass audit | Hardening batches 1–3 (finding IDs B-1, C-1, E-3, D-1, H-1…) | — | 42 unit + 31 e2e regression proof |
| 6 | Deployment & DevOps | pom.xml, fetch-libs, run scripts, config fail-fast, metrics/health, scheduler | — | Boot + 31-step e2e runbook |

## Key design decisions

| Decision | Rationale | Alternative rejected |
|---|---|---|
| Modular monolith | 6 people, real transactions, one deploy | Backend microservices (network failure modes, distributed tx) |
| Hand-written JWT (HS256) | Brief forbids Spring; JDK `Mac` is audited crypto | Opaque session tokens (no stateless claims) |
| Download tickets vs signed URLs | Tickets revoke instantly; signed URLs live until expiry | Signed static URLs |
| Ownership in SQL `WHERE` | Cannot be forgotten like an `if`; 404 hides existence | Service-level ownership `if` |
| Append-only via DB trigger | Even a DBA console cannot rewrite history | Application-only enforcement |
| Frontend microservices + registry | Per-module ownership; one indirection for nav/deeplinks | Per-feature ad-hoc navigation |
| HikariCP under the old pool API | Production-grade pooling with zero call-site changes | Rewriting every `db.with` call site |
| Bucket4j token buckets | Smooths bursts; per-scope budgets (auth 20/min, public-share 30/min) | Hand-rolled sliding window (burst-permissive) |
| Caffeine for limiter buckets + doc read cache | Bounded memory, TTL-bounded staleness, explicit invalidation on writes | Unbounded ConcurrentHashMaps |
| Emailed OTPs instead of codes in responses | The inbox is the only place a credential exists; API responses can't leak what they never carry | `resetCode`/`temporaryPassword` in bodies (removed this sprint) |
