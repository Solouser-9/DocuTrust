# DocuTrust — Secure Document Vault & Verification Platform

**Group 3** · React Native 0.88 (Expo SDK 58, JavaScript) · Pure Java 21 + Maven (no Spring, no JUnit) · PostgreSQL (Neon)

> **Explain it like I'm 5:** DocuTrust is a locked filing room for important documents, and after our microservices refactor it is no longer one big building — it is a small **campus with three buildings**. The **Gateway** is the **receptionist at the front desk** (port 8080): every visitor speaks to the receptionist, and the receptionist walks each request to the right building. The **Auth service** is the **bouncer at the security desk** (port 8081): it checks passwords, prints the ID cards (JWTs), and emails the one-time codes. The **Core service** is the **vault room** (port 9000): documents are encrypted, versioned, shared and verified there. Both working buildings share **one pantry** — a single PostgreSQL database (hosted free on Neon) — so the bouncer's ID cards are checked with the same ink the vault room trusts. Your phone app only ever knows one address: the front desk. It never noticed the refactor — that is the whole trick.

> **Plain English (what the app does):** files are encrypted the moment they arrive; owners get warned before documents expire; sharing works through links that can expire, be revoked, be view-limited, and be locked until a specific person proves control of their email inbox with a 6-digit code. Third parties verify authenticity via proof links instead of receiving the file, sensitive uploads pass an admin review, and every security-relevant action leaves an append-only audit trail. Password reset, email MFA fallback, step-up confirmation and OTP-gated shares all share one hashed, single-use code engine — and no API response ever contains a credential.

## The three buildings (the microservices, in one table each)

| Building | Port | Analogy | What actually runs there |
|---|---|---|---|
| **Gateway** | **8080** | The **receptionist at the front desk** — takes every request and forwards it, untouched, to the right building; if a building is closed, the receptionist says so politely (502 Bad Gateway) | Pure Java 21 reverse proxy (`com.sun.net.httpserver` + `java.net.http.HttpClient`). Routing rules: `POST /api/auth/accept-invite` → Core (RC-1: admin logic that lives under an auth prefix), anything starting `/api/auth/` → **Auth**, everything else → **Core**. It preserves method, path, query, headers and body byte-for-byte — the app cannot tell it is not talking to a single server |
| **auth-service** | **8081** | The **bouncer at the security desk** — checks passwords, prints ID cards, emails wristbands | 18 `/api/auth/*` routes (register, login, refresh, me, sessions, MFA, step-up, OTP…) + its own `/api/health`. Never touches migrations; verifies the same JWTs with the same secret |
| **core-service** | **9000** | The **vault room** — where the valuable things live and the paperwork is stamped | 56 routes: documents, folders, shares, verification, notifications, admin, org — plus `/api/auth/accept-invite` (RC-1). Runs the migrations, the demo seeder and the 60-second ExpiryScheduler (exactly one copy per environment) |

**One pantry, two chefs:** auth-service and core-service both connect to the **same** PostgreSQL database (Neon free tier — we picked a shared DB over per-service databases because Render's free plan gives each service only 512 MB of RAM, and two databases would also mean answering "what if a login commits but the document insert doesn't?" — a distributed-transactions headache we deliberately refused). The **JWT_SECRET is shared** between the two services, so a token the bouncer printed is verified by the vault room without a phone call — that is **cross-service JWT validation**, and it is why login on 8081 then reading documents on 9000 just works.

## Numbers at a glance

| Metric | Value |
|---|---|
| Logical API routes | **74** = 56 (core-service, incl. RC-1 accept-invite) + 19 (auth-service, incl. its health route) — printed at each service's boot |
| Run services | **3** (gateway + auth + core) — the vault-service and admin-service stubs exist but are not yet wired (Strangler Fig, next slices) |
| Runnable artifacts | `mvn clean install` → **3 jars**: `docutrust-gateway.jar`, `docutrust-auth-service.jar`, `docutrust-core-service.jar` |
| Database | **15 tables**, migrations V01–V12, **shared** by both DB-touching services (Neon PostgreSQL) |
| Mobile screens | 46 (registered in `mobile/src/screens/index.js`) |
| Numbered features | 216 (`docs/FEATURES.md`, FT-001…FT-216) + OTP security addendum (FT-217…FT-234) |
| User roles | `admin` > `org_manager` > `member` (server-enforced) |
| Uploads | ≤ 25 MB, allow-listed mime types, AES-256-GCM encrypted |
| Server libraries | HikariCP 5.1.0 (pooling) · Bucket4j 8.10.1 (rate limiting) · Caffeine 3.1.8 (caching) · Dropwizard Metrics 4.2.25 (telemetry) · Sentry 7.14.0 (optional Spotlight tracing) · PostgreSQL 42.7.14 |

*Every number above is verifiable from the repository alone — each service prints its own route count at boot, and every flow is demonstrated live at the defence with manual API calls (Postman/cURL) or on the emulator.*

## Explain it like I'm 5 — the 60-second tour

Never written a line of code? Four pictures are enough to follow the whole system:

- **A food court with one cashier.** The mobile app is the **customer** — it orders but never cooks. The **cashier** is the Gateway (8080): it takes every order, doesn't cook anything itself, and slides the tray to the right kitchen — burger orders (login, ID cards) to the **security kitchen** (auth, 8081), everything else to the **vault kitchen** (core, 9000). Both kitchens reach into the **same pantry** (the shared PostgreSQL database). If a kitchen is closed, the cashier doesn't pretend: it hands back a "502 — kitchen unavailable" note.
- **A filing cabinet.** The database is fifteen drawers (**tables**), each holding identical index cards (**rows**) whose cross-references (**foreign keys**) the clerk refuses to break — even when buggy code begs it to. Two chefs share the cabinet, but the cabinet's own rules keep them honest.
- **A smartphone.** The app's `screens/` are the apps you open, `components/` are the buttons, `microservices/` are the invisible background processes that fetch your data.
- **Sticky notes.** Each screen keeps "sticky notes" (React **hooks**) that remember things between redraws; our custom `usePresenter` note hires each screen's "waiter" and fires it on close.

The full beginner walkthrough — hooks, architecture, the database, the server, the tech stack and the JSON order forms — is [DEFENCE_GUIDE.md](DEFENCE_GUIDE.md) **Part 2** (start at §2.9 for the three-building story).

## New here? Read in this order

1. **The four pictures above** — the whole system in sixty seconds.
2. **`DocuTrust_Beginner_Guide.docx/.pdf`** (this folder) — the beginner companion: hooks, architecture, the database, the server, the tech stack and the JSON order forms.
3. **[`DEFENCE_GUIDE.md`](DEFENCE_GUIDE.md)** — the master index: the numbers everyone must know, the six roles with pitches and examiner Q&A, and the beginner walkthroughs in Part 2.
4. **Your Masterclass file** — `docs/defence/STUDENT_1…6.md` for the slice you are defending: every owned file with a one-sentence job description, five layman's analogies, the code walkthrough, the domain glossary and the personal Q&A bank.

## Repository layout

```
DocuTrust/
├── mobile/          React Native (Expo SDK 58, JavaScript) client — MVP pattern, 9 frontend microservices;
│                    points ONLY at the gateway (EXPO_PUBLIC_API_URL → :8080)
├── server/          Pure Java 21 + Maven multi-module: gateway / auth-service / core-service / shared
│                    (+ vault-service & admin-service stubs for the next strangler slices)
├── database/        PostgreSQL migrations (V01–V12), applied by core-service on boot
├── docs/            API contracts, architecture, ER diagram, features, roadmap, edge cases, defence packs
├── server/Dockerfile          Multi-stage build → three runnable images (gateway / auth / core)
└── docker-compose.yml (repo root)  One command starts the whole campus
```

## Quick start A — run the three services yourself (3 terminals)

**Prerequisites:** JDK 21, Maven 3.9+, and a PostgreSQL 14+ database (local, or a free Neon project).

1. **Configure once.** Copy `server/.env.example` to `server/.env` and fill in `DB_URL` / `DB_USER` / `DB_PASSWORD` (Neon gives you the pooled connection string), a **32+ character** `JWT_SECRET` (`openssl rand -base64 48`), and a 44-character base64 `VAULT_KEY` (`openssl rand -base64 32`). Both DB-touching services read this same file — that is what makes cross-service JWT validation work. Generate secrets with `openssl`, never commit the real `.env`.

2. **Build the whole reactor once.**
   ```bash
   cd server
   mvn clean install          # BUILD SUCCESS expected: 6/6 modules
   ```

3. **Terminal 1 — the vault room (core, 9000).**
   ```bash
   cd server
   PORT=9000 MIGRATOR_ENABLED=true SEED_DEMO=false mvn -pl core-service exec:java
   ```
   *(`SEED_DEMO=true` is allowed only on a `localhost` database — the server refuses to seed a cloud DB like Neon. Run migrations manually the first time: `database/migrations/V01…V12` in order, or let core apply them on boot with `MIGRATOR_ENABLED=true`.)*
   Expect the banner: `[main] DocuTrust ready on port 9000 (migrations=12, routes=56, db=up, boot=…ms)`.

4. **Terminal 2 — the bouncer (auth, 8081).** Run **from `server/`, never from inside `auth-service/`** (the shared vault path is resolved from the working directory).
   ```bash
   cd server
   PORT=8081 mvn -pl auth-service exec:java
   ```
   Expect: `[auth-service] migrations skipped (auth-service never runs migrations)` then `[auth-service] ready on port 8081 (routes=19, db=up)`.

5. **Terminal 3 — the receptionist (gateway, 8080).**
   ```bash
   cd server
   mvn -pl gateway exec:java
   ```
   Expect: `[gateway] ready on port 8080 (core=http://localhost:9000, auth=http://localhost:8081)`.

6. **Check the whole campus through the front desk only:**
   ```bash
   curl http://localhost:8080/api/health                    # → core's health, via the gateway
   TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login -H 'Content-Type: application/json' \
     -d '{"email":"…","password":"…"}' | <extract accessToken>)   # gateway → auth-service
   curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/documents  # gateway → core-service
   ```
   The login went to 8081, the documents call went to 9000, and your phone never knew. Stop a service and the gateway answers `502 {"ok":false,"error":{"code":"BAD_GATEWAY",…}}` instead of hanging.

7. **Mobile app.**
   ```bash
   cd mobile
   cp .env.example .env          # set EXPO_PUBLIC_API_URL=http://<YOUR-PC-LAN-IP>:8080  (the gateway!)
   npm install && npx expo start  # scan QR with Expo Go, or press i / a
   ```
   The client stores the session JWT in `expo-secure-store`; the phone and the PC must share the same Wi-Fi.

## Quick start B — Docker Compose (one command, the whole campus)

From the **repository root**:

```bash
cp DocuTrust/server/.env.example .env    # fill in DB_URL, DB_USER, DB_PASSWORD, JWT_SECRET, VAULT_KEY
docker compose up --build
```

That starts all three buildings: `gateway` on **localhost:8080** (the only address the app needs), `auth-service` on 8081 and `core-service` on 9000 (also published locally for debugging and direct-access demos). The compose file wires `CORE_URL=http://core-service:9000` and `AUTH_URL=http://auth-service:8081` into the gateway, mounts **one shared vault volume** into both auth and core (so MFA secret decryption works across services), gives each DB-touching service a **DB_POOL_MAX of 5** (four-service pool budget fits Neon's free tier), and leaves migrations to **core only**. Stop everything with `Ctrl+C`; wipe volumes with `docker compose down -v`.

## Documentation map

| Document | Content |
|---|---|
| `docs/API_CONTRACTS.md` | All 74 paths, envelopes, error codes, pagination/search conventions — and which service serves what |
| `docs/FEATURES.md` | 216 numbered features across 10 modules + OTP security addendum |
| `docs/ARCHITECTURE.md` | The three-building topology, gateway routing rules, request lifecycle (Mermaid) |
| `docs/ER_DIAGRAM.md` | 15-table schema, relationships, constraints — one shared database |
| `docs/ROADMAP.md` | 3-week plan per student + risk register + the Phase 1–3 refactor history |
| `docs/EDGE_CASES.md` | 10 hands-on edge-case demos with expected behaviour |
| `docs/defence/STUDENT_PACK.md` | Per-student ownership summary (full packs in `DEFENCE_GUIDE.md`) |
| `docs/defence/STUDENT_1…6.md` | Per-student Masterclass deep dives |
| `DEFENCE_GUIDE.md` | **Oral defence playbook: 6 roles, elevator pitches, layman analogies, examiner Q&A** |

## The six hard challenges → where they live

| Challenge | Mechanism | Proof |
|---|---|---|
| Access control | JWT middleware + `requireRole` + SQL `owner_id` scoping (auth prints, core verifies — one shared secret) | Edge case 6 & 7 |
| Private file delivery | AES-256-GCM vault, streamed via guarded endpoints only | §5.4 of the Guide |
| Expiring share links | Atomic guard `UPDATE` on every open | Edge case 1 |
| Revocation | `revoked_at` checked at request time → instant | Edge case 2 |
| Audit trails | Append-only triggers on `document_history` / `audit_logs` — the gateway also rewrites `X-Forwarded-For` so the trail keeps the real client IP | SQL editor demo |
| Version integrity | SHA-256 per version, recomputed on download | Edge case 10 (tamper) |

## The OTP security layer → where it lives

| Flow | Mechanism | Proof |
|---|---|---|
| Password reset by email | `email_otps` (SHA-256 + purpose salt, 10 min, 5 attempts) + Brevo | `OtpService` + `MailService` (auth-service) · live demo |
| Email MFA fallback | login → `440 MFA_EMAIL_CHALLENGE` + challenge JWT → `/api/auth/verify-otp` | auth-service · live demo |
| Step-up for destructive actions | `request-step-up`/`verify-step-up` → 5-min `X-Step-Up-Token` JWT → gated `change-password` + permanent delete | auth-service · live demo (403 → emailed code) |
| OTP-gated share links | `require_otp` + pinned recipient → `401 SHARE_OTP_REQUIRED` → `request-otp` / `open-with-otp` | core-service share guards · live demo |
| Invitations without temp passwords | emailed invite OTP (24 h) + `/api/auth/accept-invite` | RC-1: lives in **core-service**, reachable through the gateway · live demo |
