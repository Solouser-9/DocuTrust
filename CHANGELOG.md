# DocuTrust — CHANGELOG

This zip = original submission + audit Batches 1–3 + infrastructure upgrade + **OTP Security Overhaul (Phases 1–5)** + **Defence & Documentation Sync** + **Beginner deep-dives (Part 2) & binaries v2.1** + **Config, Git & Expo SDK 58 pass**.
Zip layout: `DEFENCE_GUIDE.md` + `CHANGELOG.md` + `.gitignore` + complete `DocuTrust/` tree (incl. `mobile/.env` placeholder).
Excluded: `server/target/`, `.git/`, `server/lib/` (regenerate with `bash server/fetch-libs.sh` or `mvn package`), `server/.env` (local secrets), `node_modules/`.

---

## Ticket: Production config, root .gitignore & Expo SDK 58 (this pass)

- **Root `.gitignore` (new, project root + zip root):** blocks `.env` / `.env.*` (keeps `.env.example`), `target/`, `node_modules/`, `.expo/`, `.idea/`, `.vscode/`, `*.iml`, `dist/`, `build/`, coverage, logs, and OS files (`.DS_Store`, `Thumbs.db`, …). Verified with `git check-ignore`: `mobile/.env` ignored, `mobile/.env.example` visible.
- **Mobile env files:** `mobile/.env` and `mobile/.env.example` both carry `EXPO_PUBLIC_API_URL=http://YOUR_PC_IP_ADDRESS:8080`; `mobile/src/core/config/env.js` reads `process.env.EXPO_PUBLIC_API_URL` (unchanged, verified).
- **Expo SDK 58 upgrade (config-only):** `package.json` → `expo ^58.0.0` with the full dependency matrix realigned by `npx expo install --fix` (React Native 0.88.1, React 19.3.0, navigation v7, jest-expo 58, jest 30, RNTL 14); `app.json` splash block removed (new schema forbids it), version → 1.1.0; `mobile/.npmrc` sets `legacy-peer-deps` (React 18→19 jump). **No screen, presenter or API code changed.**
- **Verification on SDK 58 (this sandbox):** `npx expo-doctor` **20/20 checks passed**; Jest **74/74**; Metro bundles the whole app to Hermes bytecode (`expo export`); mobile **E2E 31/31** against a live server (PostgreSQL 16 + migrations V01–V11 + seed, boot prints `migrations=11, routes=71`); server cold build 42/42 via ECJ fallback.
- **One non-config JS fix (disclosed):** `mobile/src/core/utils/formatters.js` — `parse()` now treats `null`/`''` as invalid dates. `new Date(null)` is epoch-0 per spec, so `formatDate(null)` rendered "1 Jan 1970"; the team's own test asserts "—". Latent bug surfaced the first time Jest actually ran (no node_modules existed before this pass).
- **QA handbook packs rebuilt:** the six per-student packs now use the mandated roles 1:1 with `DEFENCE_GUIDE.md` (Infrastructure & Database / Auth & OTP Security / Business Logic / Mobile App / The 8-Pass Security Audit / Deployment & DevOps) — pitches, analogies and personal Q&A aligned; Student 4's pitch carries the SDK 58 proof chain (doctor 20/20, Jest 74/74, Metro bundle, E2E 31/31).
- **Text & binaries:** README (quickstart env flow, layout, stack line), `docs/ARCHITECTURE.md` (SDK 58 layer line), `docs/defence/STUDENT_PACK.md` (roles, numbers incl. 74 Jest tests + expo-doctor 20/20), `DEFENCE_GUIDE.md` (Students 4/6 own-lines & pitches, tech-stack table, secrets answer, schema_migrations footnote) all updated; Beginner Guide (33 pp) + Defence Handbook (40 pp) DOCX/PDF regenerated — stale scan **CLEAN** (now also enforces "SDK 58" present and the old version strings absent).
- Java source: **untouched**.

---

## Ticket: Defence preparation — beginner deep-dives (Part 2) + binary v2.1 (this pass)

- **`DEFENCE_GUIDE.md` gains Part 2 — "The system explained for absolute beginners":** eight step-by-step explainers, each assigned to the student who should rehearse it, in complete layman terms with the mandated analogies: React hooks as sticky notes (`useState` / `useEffect` / custom `usePresenter`); overall architecture as customer-waiter-kitchen; frontend folders as a smartphone (`screens` = apps, `components` = buttons, `microservices` = background processes); backend folders as a restaurant (`controller` = waiters, `service` = chefs, `db` = pantry, `auth` = ID checkers, `http` = uniforms); the database as a filing cabinet (tables/rows/foreign keys, why PostgreSQL); the server as a 24/7 receptionist; the tech stack with a plain-words "why" for Java 21 / PostgreSQL+Supabase / React Native+Expo / Brevo / HikariCP / Bucket4j / Caffeine / Metrics+Spotlight; and the data API as standardized order forms (GET/POST/PUT/PATCH/DELETE, JSON envelope, status codes 200–500 incl. our 440).
- **Text sync extended:** `README.md` gains "Explain it like I'm 5 — the 60-second tour"; `docs/ARCHITECTURE.md` gains "For absolute beginners: the restaurant and the smartphone"; `docs/ER_DIAGRAM.md` gains the filing-cabinet walkthrough. Numbers re-verified: **71 routes / 15 tables / 11 migrations**.
- **Binaries v2.1:** `DocuTrust_Beginner_Guide.docx/.pdf` now 33 pages with new chapter "14. Explain It Like I'm 5 — The Eight Core Concepts" (14.1–14.8); `DocuTrust_Defence_QA.docx/.pdf` now 39 pages with the same eight explainers as a closing appendix (headings 1.–8.) plus the architecture diagram embedded as Figure A. Stale scan: **CLEAN**; visual page checks passed.
- No Java/JavaScript source changed in this pass (documentation and binaries only).

---

## Ticket: Final delivery — OTP overhaul, defence guide, layman docs, binaries

### 1. OTP Security Overhaul (Phases 1–5) — Java + migrations

| Phase | What shipped | Key files |
|---|---|---|
| Engine | `email_otps` table (V10): 6-digit SecureRandom codes stored only as `sha256(purpose:email:code)`, single-use, 10-min TTL (24 h invites), 5-attempt burn, one live code per (purpose, target) | `V10__email_otps.sql`, `OtpService.java` |
| Mail | Brevo transactional email via `MailService`; `MAIL_MODE=dev` echoes codes in `X-Dev-OTP` (bodies never carry them), `MAIL_MODE=live` requires `BREVO_API_KEY`/`BREVO_SENDER_EMAIL` (fail-fast at boot) | `MailService.java`, `Config.java`, `.env.example` |
| P1–3 | Password reset by emailed OTP (`forgot-password` → `reset-password-otp`); the legacy `reset-password` route and its code-in-response pattern **removed**; step-up pair (`request-step-up` / `verify-step-up`) issuing 5-min single-purpose JWTs; gates on `change-password` and permanent delete (`403 STEP_UP_REQUIRED` + `X-Step-Up-Token`) | `AuthService.java`, `StepUpService.java`, `DocumentService.java`, `Main.java` |
| P4 | Email MFA fallback: login with `useEmailMfa:true` → `440 MFA_EMAIL_CHALLENGE` + challenge JWT → `POST /api/auth/verify-otp` issues session tokens | `AuthService.java`, `AuthController.java` |
| P5 | OTP-gated shares: V11 adds `shares.require_otp` + `otp_recipient_email`; plain open → `401 SHARE_OTP_REQUIRED`; new public `request-otp` (code only ever emailed to the pinned inbox; mismatches 403 without revealing it) and `open-with-otp` (code + passcode → the same atomic open) | `V11__shares_require_otp.sql`, `ShareService.java`, `PublicController.java` |
| Invites | Org invites reworked: no more `temporaryPassword` in responses; invite emails a 24 h OTP and `POST /api/auth/accept-invite {email, code, password}` activates the account with tokens | `OrgService.java`, `OrgController.java` |
| Routes | 65 → **71**: −`reset-password`, +`reset-password-otp`, `verify-otp`, `accept-invite`, `request-step-up`, `verify-step-up`, `public request-otp`, `public open-with-otp` | `Main.java` (boot prints `routes=71`) |

### 2. Infrastructure upgrade — five libraries, zero call-site churn

- **HikariCP 5.1.0** under the existing `Database` API (`get/release/with/tx/healthy/close` unchanged).
- **Bucket4j 8.10.1** token buckets behind `RateLimiter.allow(...)`, per-scope budgets (auth 20/min, public-share 30/min, public-verify 20/min), bucket map in a **Caffeine** cache.
- **Caffeine 3.1.8** also caches ownership-scoped document rows (10 s TTL, explicit invalidation on every write).
- **Dropwizard Metrics 4.2.25**: per-route timers/meters → `/api/health` (`requestsTotal`, `meanResponseMs`).
- **Sentry 7.14.0**: optional Spotlight tracing behind `SPOTLIGHT_ENABLED` (default off).
- Build plumbing: `pom.xml` gains all deps; `fetch-libs.sh` downloads the exact jars for the no-Maven path; `compile-check.sh`/`run-dev.sh`/`run-tests.sh` updated; `server/lib/` excluded from the zip (regenerate with `fetch-libs.sh`).

### 3. Mobile client (11 files, esbuild-verified)

- `endpoints.js` / `auth/api.js`: OTP endpoints; `resetPassword` replaced by `resetPasswordOtp(email, code, newPassword)`; step-up + verify-otp + accept-invite added; `changePassword`/`removePermanent` accept the `X-Step-Up-Token` header. `resetCode` / `temporaryPassword` references: **zero**.
- `MfaScreen`: "Email me a code instead" → 440 challenge → `verifyOtp`. `ResetPasswordScreen`: email + 6-digit code. `ChangePasswordScreen` & `TrashScreen`: 403 `STEP_UP_REQUIRED` → emailed-code phase → retry with token.
- `ApiClient`: error objects now carry the raw body (the 440 `challenge`); CORS allow-list on the server extended for `X-Step-Up-Token`, `X-Dev-OTP` exposed.

### 4. Verification evidence (this sandbox)

- `bash server/compile-check.sh`: MAIN_EXIT=0, TEST_EXIT=0 (42/42 unit tests green).
- Embedded PostgreSQL 16 live run: migrations V01→V11 applied; boot prints `migrations=11, routes=71`.
- 25-check OTP smoke (scripts/smoke_otp.py equivalent in-node): **25/25 PASS** — every new flow incl. negative paths.
- `node mobile/e2e/run.js`: **31 steps: 31 passed** (incl. TOTP computed in-process for MFA enable).
- `mobile/src`: 11 modified files parse clean via esbuild; `grep resetCode|temporaryPassword` → 0 hits.

### 5. Defence & documentation sync

- **`DEFENCE_GUIDE.md` (new, zip root + repo root):** Individual Defence Formula for 6 roles — Infrastructure & DB / Auth & OTP Security / Business Logic / Mobile App / The 8-Pass Audit / Deployment & DevOps. Each role: 1-minute pitch, 3 layman analogies (HikariCP = restaurant host, OTP = VIP wristband, step-up = bank vault…), top-3 examiner questions with exact answers; plus shared numbers table and bridge map. Every claim traces to a file.
- Text docs layman-synced with "Plain English" openers and the exact numbers (**71 routes / 15 tables / 11 migrations**): `README.md`, `docs/ARCHITECTURE.md`, `docs/ER_DIAGRAM.md` (email_otps + require_otp documented), `docs/API_CONTRACTS.md` (new endpoints + error codes incl. 440/403-step-up/401-otp), `docs/FEATURES.md` (+FT-217…FT-232), `docs/defence/STUDENT_PACK.md` (roles aligned to the guide), `server/.env.example` (Brevo/Spotlight vars).
- `.mmd` diagram sources rewritten with human-readable node labels (Login_Service, Database, OTP_Vault…) reflecting the new tables/services/libraries; the four PNGs re-rendered from those sources.
- `DocuTrust_Beginner_Guide.docx/.pdf` and `DocuTrust_Defence_QA.docx/.pdf` regenerated with the layman explanations, updated numbers and the new diagrams.

---

## Earlier tickets (summary)

- **Final pass (download hotfix + doc sync):** DL-1 `document_history` JSONB cast fix (`CAST(? AS jsonb)`); every `.md`/`.mmd` re-synced to the shipped code (54→65 routes, 13→14 tables, 8→9 microservices); Beginner Guide + Defence QA DOCX/PDF + 4 PNGs re-rendered and stale-scanned clean. (Full detail in the previous CHANGELOG revision / `PATCH.md`.)
- **Batch 3:** security hardening closure (B-1 commit-before-409 revocation, B-2 post-commit audit, B-3 FOR UPDATE rotation lock, C-1/C-8 transaction hygiene, H-1 default download resolution, H-3 orgName join, F-4 version pinning).
- **Batch 2:** ownership + validation hardening (E-3 JWT secret policy, D-1 vault key format, input validation sweeps).
- **Batch 1:** access-control fixes across auth/documents/shares (41 findings).
- **Original submission:** DocuTrust Group 3 — 45 screens, 216 features, pure Java 21 server, Expo client, PostgreSQL schema V01–V09.
