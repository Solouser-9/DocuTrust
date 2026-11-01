# DocuTrust — Secure Document Vault & Verification Platform

**Group 3** · React Native 0.88 (Expo SDK 58, JavaScript) · Pure Java 21 + Maven (no Spring, no JUnit) · PostgreSQL (Supabase)

> **Plain English:** DocuTrust is a locked filing room for important documents. Files are encrypted the moment they arrive, owners get warned before documents expire, sharing works through links that can expire, be revoked, be view-limited — and now, if the owner chooses, be locked until a specific person proves control of their email inbox with a 6-digit code. Third parties verify authenticity via proof links instead of receiving the file, sensitive uploads pass an admin review, and every security-relevant action leaves an append-only audit trail. This sprint added the OTP layer: password reset, email MFA fallback for login, step-up confirmation for destructive actions, OTP-gated shares and OTP invites — and removed the last two credentials-from-the-API anti-patterns (reset codes and temporary passwords in response bodies).

## Numbers at a glance

| Metric | Value |
|---|---|
| Screens (mobile) | 45 (registered in `mobile/src/screens/index.js`) |
| Numbered features | 216 (`docs/FEATURES.md`, FT-001…FT-216) + OTP security addendum (FT-217…FT-232) |
| API route paths | **71** (`docs/API_CONTRACTS.md`; also printed at boot as `routes=71`) |
| Database tables | **15** (migrations `database/migrations/V01…V11`; V10 adds `email_otps`) |
| User roles | `admin` > `org_manager` > `member` (server-enforced) |
| Server unit tests | 42 (custom `DocuTest` runner — JUnit is forbidden by the brief) |
| End-to-end steps | **31** (`mobile/e2e/run.js` — includes every OTP flow) |
| Uploads | ≤ 25 MB, allow-listed mime types, AES-256-GCM encrypted |
| Server libraries | HikariCP 5.1.0 (pooling) · Bucket4j 8.10.1 (rate limiting) · Caffeine 3.1.8 (caching) · Dropwizard Metrics 4.2.25 (telemetry) · Sentry 7.14.0 (optional Spotlight tracing) · PostgreSQL 42.7.4 |

## Explain it like I'm 5 — the 60-second tour

Never written a line of code? Four pictures are enough to follow the whole system:

- **A restaurant.** The mobile app is the **customer** — it orders but never cooks. The Java server is the **waiter** — 71 dishes on the menu (the 71 API routes), checks your ID card (a signed token) before taking an order. The **kitchen** is the service code, and the **pantry** is the PostgreSQL database. No room ever walks into another uninvited.
- **A filing cabinet.** The database is fifteen drawers (**tables**), each holding identical index cards (**rows**) whose cross-references (**foreign keys**) the clerk refuses to break — even when buggy code begs it to.
- **A smartphone.** The app's `screens/` are the apps you open, `components/` are the buttons, `microservices/` are the invisible background processes that fetch your data.
- **Sticky notes.** Each screen keeps "sticky notes" (React **hooks**) that remember things between redraws; our custom `usePresenter` note hires each screen's "waiter" and fires it on close.

The full eight-part beginner walkthrough — hooks, architecture, both folder structures, the database, the server, the tech stack and the JSON order forms — is [DEFENCE_GUIDE.md](DEFENCE_GUIDE.md) **Part 2**.

## Repository layout

```
DocuTrust/
├── .gitignore       Root ignore rules: .env / target/ / node_modules/ / IDE folders / OS files never reach GitHub
├── mobile/          React Native (Expo SDK 58, JavaScript) client — MVP pattern, 9 frontend microservices
├── server/          Pure Java 21 REST API — modular monolith: Router → Controller → Service → DAO
├── database/        PostgreSQL migrations (V01–V11), seeds/
├── docs/            API contracts, architecture, ER diagram, features, roadmap, edge cases, diagrams
├── DEFENCE_GUIDE.md Oral-defence playbook: 6 roles × pitch + analogies + Q&A, plus Part 2 — eight beginner walkthroughs
├── DocuTrust_Beginner_Guide.docx/.pdf     Beginner companion: hooks, architecture, DB, server, API
└── DocuTrust_Defence_QA.docx/.pdf         78 defence Q&A + per-student packs for 6 students
```

## Quick start

### 1. Database (Supabase)
1. Create a Supabase project (or use any PostgreSQL 14+).
2. Apply migrations in order: `database/migrations/V01…V11` (SQL editor), **or** let the server's migration runner apply them on first boot.
3. Copy the pooler connection string for the `.env` (see `server/.env.example`).

### 2. Server
```bash
cd server
cp .env.example .env          # fill DB_URL / DB_USER / DB_PASSWORD / JWT_SECRET / VAULT_KEY
                              # + optional BREVO_* / MAIL_MODE for real OTP emails
mvn package && java -jar target/docutrust-server-1.0.0.jar   # or: bash run-dev.sh
# no Maven? bash compile-check.sh compiles with javac/ECJ (fetch-libs.sh pulls the exact jars);
# run-dev.sh runs with plain java
```
First boot: migrations → demo seed (only when `SEED_DEMO=true`; refused for non-localhost databases) → scheduler (60 s tick). Health: `GET http://localhost:8080/api/health`.

**OTP email (Brevo):** with `MAIL_MODE=dev` (default) codes go to the server log and the `X-Dev-OTP` response header — perfect for demos and the E2E suite. With `MAIL_MODE=live` codes are sent as real email; `BREVO_API_KEY` and `BREVO_SENDER_EMAIL` are then mandatory (the server refuses to boot in live mode without them). API responses never contain codes in either mode.

**Demo accounts (6, seeded by `Bootstrap.seed` only when `SEED_DEMO=true`):** `admin@docutrust.app / Admin#2024` · `manager@docutrust.app / Manager#2024` · `member@docutrust.app / Member#2024` (+ `student1..3@docutrust.app / Student#2024`). All are created `status='active'` with `email_verified=TRUE`; the admin sits outside the demo org.

### 3. Mobile app
```bash
cd mobile
cp .env.example .env          # set EXPO_PUBLIC_API_URL=http://<YOUR-PC-LAN-IP>:8080
npm install
npx expo start                # scan QR with Expo Go, or press i / a
```
The client runs on **Expo SDK 58** (React Native 0.88). `src/core/config/env.js` reads
`process.env.EXPO_PUBLIC_API_URL` from that `.env` file — the phone and the PC must share
the same Wi-Fi. The root `.gitignore` keeps the real `.env`, `node_modules/` and build
output out of GitHub; `mobile/.env.example` is the committed template.

### 4. Tests
```bash
bash server/run-tests.sh       # 42 unit tests always; integration tests when DB_URL is set
cd mobile && npm test          # Jest: presenters, ApiClient, stores, validators
cd mobile && npm run e2e       # 31-step black-box end-to-end vs a running server (API_URL env or :8080)
```

## Documentation map

| Document | Content |
|---|---|
| `docs/API_CONTRACTS.md` | All 71 paths, envelopes, error codes, pagination/search conventions |
| `docs/FEATURES.md` | 216 numbered features across 10 modules + OTP security addendum |
| `docs/ARCHITECTURE.md` | Layers, request lifecycle, module map (Mermaid + PNG) |
| `docs/ER_DIAGRAM.md` | 15-table schema, relationships, constraints (Mermaid + PNG) |
| `docs/ROADMAP.md` | 3-week plan per student + risk register |
| `docs/EDGE_CASES.md` | 10 scripted edge-case demos with expected behaviour |
| `docs/diagrams/` | Rendered PNGs + Mermaid sources |
| `docs/defence/STUDENT_PACK.md` | Per-student ownership summary (formula + full packs in `DEFENCE_GUIDE.md`) |
| `DEFENCE_GUIDE.md` | **Oral defence playbook: 6 roles, elevator pitches, layman analogies, examiner Q&A** |

## The six hard challenges → where they live

| Challenge | Mechanism | Proof |
|---|---|---|
| Access control | JWT middleware + `requireRole` + SQL `owner_id` scoping | Edge case 6 & 7 |
| Private file delivery | AES-256-GCM vault, streamed via guarded endpoints only | §5.4 of the Guide |
| Expiring share links | Atomic guard `UPDATE` on every open | Edge case 1 |
| Revocation | `revoked_at` checked at request time → instant | Edge case 2 |
| Audit trails | Append-only triggers on `document_history` / `audit_logs` | SQL editor demo |
| Version integrity | SHA-256 per version, recomputed on download | Edge case 10 (tamper) |

## The OTP security layer (new this sprint) → where it lives

| Flow | Mechanism | Proof |
|---|---|---|
| Password reset by email | `email_otps` (SHA-256 + purpose salt, 10 min, 5 attempts) + Brevo | E2E steps 19–21 |
| Email MFA fallback | login → `440 MFA_EMAIL_CHALLENGE` + challenge JWT → `/api/auth/verify-otp` | E2E steps 26–28 |
| Step-up for destructive actions | `request-step-up`/`verify-step-up` → 5-min `X-Step-Up-Token` JWT → gated `change-password` + permanent delete | E2E steps 22–25 |
| OTP-gated share links | `require_otp` + pinned recipient → `401 SHARE_OTP_REQUIRED` → `request-otp` / `open-with-otp` | E2E steps 29–30 |
| Invitations without temp passwords | emailed invite OTP (24 h) + `/api/auth/accept-invite` | E2E step 31 |
