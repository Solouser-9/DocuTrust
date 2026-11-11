# DocuTrust — Oral Defence Guide (Group 3)

**One rule above all: every claim in this guide is verifiable in the repository.** Numbers were counted from the running system (each service prints its own `routes=` at boot), and every mechanism named here points at a file you can open during the defence. Learn your slice, bridge honestly to the others, and you cannot be caught out.

> **What changed since the monolith days:** the one big Java process became **three** — the **gateway** (:8080, the receptionist who forwards every request), **auth-service** (:8081, the bouncer who prints the ID cards) and **core-service** (:9000, the vault room) — sharing **one Neon PostgreSQL database**. The refactor followed the Strangler Fig pattern and the app's address never changed. Every number and walkthrough below already reflects the microservices topology.

## The numbers everyone must know

| Metric | Value | Where it is printed / counted |
|---|---|---|
| API routes | **74 logical** = 56 (core-service, incl. RC-1 accept-invite) + 19 (auth-service, incl. its health) | each service prints its own `routes=` at boot |
| Running services | **3** | gateway :8080 · auth-service :8081 · core-service :9000 (vault/admin stubs await later strangler slices) |
| Database tables | **15** — one shared database (Neon PostgreSQL) | `database/migrations/V01…V12` (V10 adds `email_otps`) |
| Migrations | **12** files — applied by core-service only (auth-service's migrator is hardcoded off) | `database/migrations/` — one numbered SQL file each |
| Runnable artifacts | **3 jars** | `mvn clean install` → `docutrust-gateway.jar` · `docutrust-auth-service.jar` · `docutrust-core-service.jar` |
| Pinned libraries | **8** | `server/*/pom.xml` |
| Mobile screens | **45** | `mobile/src/screens/index.js` |
| Numbered features | **216 + OTP addendum** | `docs/FEATURES.md` |
| Roles | `admin` > `org_manager` > `member` | enforced in `Middleware.requireRole` (both services) |
| Infra libraries | HikariCP 5.1.0 · Bucket4j 8.10.1 · Caffeine 3.1.8 · Dropwizard Metrics 4.2.25 · Sentry 7.14.0 | `server/*/pom.xml` |

> **Note:** every claim in this guide is verifiable from the public repository alone — finding IDs are greppable in the code comments, `mvn clean package` builds the runnable jar from a clean clone, and every flow is demonstrated live at the defence with manual API calls (Postman/cURL) or on the emulator.

## The Individual Defence Formula

Every student uses the same four-beat shape:

1. **PITCH (≤ 1 minute):** what I own → the hard problem inside it → the mechanism in one sentence → the proof (a live demo or a greppable artefact).
2. **ANALOGY (3 ready):** three layman's terms comparisons for your hardest concepts. Examiners reward the ability to explain technology to non-technologists.
3. **Q&A (3 deep):** the three questions an examiner is most likely to ask *you*, with answers you have rehearsed word-for-word.
4. **BRIDGE (always):** if a question lands outside your slice, say *"that's [Student N]'s area — here's how my part feeds into it"* and stop there. Never improvise another person's mechanism.

---

## Student 1 — Infrastructure & Database

**Owns:** `Router`, `Middleware`, `Config`, `Migrator`, the hand-rolled HTTP boundary, and the whole PostgreSQL schema (V01–V12, 15 tables, triggers, views, indexes) — this identical skeleton now runs **inside both working services** (core-service and auth-service). After the infrastructure upgrade they also own the pooling and caching layer.

### Elevator pitch (≈ 1 minute)

> "I built the skeleton everything else hangs on. DocuTrust's backend is pure Java 21 on the JDK's built-in HTTP server — no Spring — and after the microservices refactor that skeleton runs in **three processes**: a gateway reverse proxy on :8080, core-service on :9000 with 56 registered routes, and auth-service on :8081 with 19 — each request still matched by the same hand-written router and passing through the same middleware chain: CORS, logging, JWT authentication, role guards and rate limiting. Underneath, each service gets its own small HikariCP pool (≤ 5 connections, sized for Neon's free tier) against **one shared database**, and the schema itself does security work: fifteen tables with CHECK constraints, foreign keys, and append-only triggers so that even a database console cannot rewrite an audit trail. My proof is simple: the boot logs print `migrations=12, routes=56` and `routes=19`, `mvn clean install` turns a clean clone into the three runnable jars in one command, and the gateway's banner names both upstreams it forwards to."

### Three layman's terms analogies

1. **HikariCP is a restaurant host.** Guests (database queries) don't wait for a free table to be built; a host keeps a fixed set of tables ready and seats the next guest at whichever frees up first. Before HikariCP we hand-wrote that seating logic; now it's a battle-tested library with the same seats (our code's API didn't change at all).
2. **Migrations are LEGO instructions in order.** Each numbered file (V01–V12) adds a few bricks — a table here, an index there — and the database is just the sum of the steps. Any team member can rebuild the exact same database from scratch, which is why our ER diagram and our production schema can never drift apart.
3. **The gateway is a hotel receptionist, and each service is a floor of the hotel.** You say "I'm here for room 12" (`/api/documents/:id`) and the receptionist walks your request — untouched — to the right floor: identity requests to the security floor (`/api/auth/*` → auth-service), everything else to the vault floor (core-service). One exact address even breaks the pattern on purpose: `POST /api/auth/accept-invite` goes to the vault floor because that is where the organisation logic lives (RC-1). If a floor is closed, the receptionist does not pretend — you get a clean 502 `BAD_GATEWAY` instead of an endless wait.

### Top 3 examiner questions — exact answers

**Q: "Why no Spring Boot? Isn't that reinventing the wheel?"**
> "The brief forbids frameworks, and it turned out to be a gift: our request path is 4 files you can read in ten minutes, and there is zero magic between the socket and our code. We do use libraries where wheels are genuinely hard — HikariCP for pooling, Bucket4j for rate limiting — but the architectural skeleton is ours and fully explainable."

**Q: "What happens if two requests write to the same row at the same time?"**
> "Every write runs inside a transaction via `Database.tx` — autocommit off, commit or rollback, no nesting. Where races genuinely matter we push the guard into a single atomic SQL statement: for example a share open does `UPDATE shares SET view_count = view_count + 1 WHERE ... AND (max_views IS NULL OR view_count < max_views)` — one statement, database-level locking, and if it updates zero rows we re-classify and return the exact reason (revoked, expired, or max views)."

**Q: "Why is business logic like 'sensitive documents need review' in the database and not just in Java?"**
> "Defense in depth. There's a CHECK constraint — `documents_sensitive_needs_review` — so a medical or financial document physically cannot be `active` without review. A bug in Java can't bypass it, a manual SQL console can't bypass it. The Java layer gives friendly error messages; the schema guarantees the invariant."

---

## Student 2 — Auth & OTP Security

**Owns:** `AuthService`, `PasswordService` (PBKDF2), `TokenService` (rotating refresh + reuse detection + `listSessions` + `revokeById`), `MfaService` (TOTP), `OtpService`, `MailService` (Brevo), `StepUpService`, and the rate limiter — the **entire slice now runs in its own microservice, auth-service on :8081**, extracted in Phase 2 (18 auth routes + its own health route), reachable only through the gateway. This is the newest and deepest slice: the OTP security overhaul plus the Active Sessions backend, all while the mobile app keeps JWTs in `expo-secure-store`.

### Elevator pitch (≈ 1 minute)

> "I own everything that proves who you are — and since the refactor, my slice is its own building: auth-service on :8081. Passwords are PBKDF2-hashed; sessions are a 15-minute access JWT plus a rotating refresh token whose reuse is detected and kills the whole token family — B-1 in our audit. On top we shipped an email-OTP layer: six-digit codes, SHA-256-hashed in the database, single-use, ten-minute expiry, five attempts max, sent through Brevo. They power four flows: password reset, email MFA fallback for login — the server answers HTTP 440 with a challenge — step-up verification for destructive actions like permanent deletion, and OTP-gated share links. The security headline: after the overhaul, **no API response ever contains a password, a reset code, or a temporary password** — the inbox is the only place a code exists. And the microservices headline: my tokens are verified by the *other* service with the *same secret* — shared `JWT_SECRET`, cross-service JWT validation, no introspection call. The proof is live: login through the gateway on :8080, then read documents through the same address — one hop to my building, one to the vault's — with every OTP flow, including the negative paths, walked with manual API calls during the defence."

### Three layman's terms analogies

1. **An OTP is a VIP wristband, not a key.** Your password is the key to the building; the wristband is handed to you at the door, works for one night only, and is worthless to anyone who photographed it yesterday. Even if someone steals your key (password), without the wristband handed out to your phone's inbox they still don't get into tonight's event.
2. **Step-up authentication is a bank vault inside a bank.** Walking into the bank with your card (being logged in) gets you to the lobby. But opening the safe-deposit box — permanently deleting a document, changing your password — requires a second, fresh proof: a code to your phone, right now. We even made the vault token short-lived: five minutes, single purpose, useless on any other door.
3. **Refresh-token rotation is a tear-off ticket pad.** Every time you use your ticket, you get the next one off the pad and the old one is stamped. If someone tries to use a stamped ticket — a stolen, already-rotated refresh token — the system doesn't just refuse it: it tears up the whole pad, because a stamped ticket reappearing means someone is copying your tickets.

### Top 3 examiner questions — exact answers

**Q: "Why is the MFA email challenge 440 and not a standard status code?"**
> "HTTP has no standard code for 'second factor required'. We already answered the TOTP challenge with 440 `MFA_REQUIRED`, so the email fallback is its sibling: 440 `MFA_EMAIL_CHALLENGE` with a challenge token in the body. It's a deliberate, documented, non-standard code — consistent within our API contract, and the mobile client treats both the same way."

**Q: "You store OTPs — how? If your database leaked, would an attacker get working codes?"**
> "No. We store only a SHA-256 digest, salted with the purpose and the recipient — `sha256(purpose:email:code)` — so a code captured in one flow can't be replayed in another. Codes are six digits from SecureRandom, expire in ten minutes, die after five wrong attempts, and the verification marks them used inside the same locked transaction that read them, so two simultaneous guesses can't both spend one code. And in live mode the code only ever exists in the recipient's inbox — the API never returns one."

**Q: "What's the difference between the MFA challenge and the step-up token? Both are JWTs, no?"**
> "Different `typ` claims, different authorities, different lifetimes. The MFA challenge (`typ=mfa_challenge`, 10 minutes) only proves 'this person finished password + second factor' — `verify-otp` exchanges it for real session tokens. The step-up token (`typ=step_up`, 5 minutes) is the reverse: you already have a session, and it briefly certifies 'this exact user verified an OTP moments ago' for one destructive call via `X-Step-Up-Token`. The authorize gate rejects a step-up token that belongs to another account or carries the wrong type — a challenge token can never open the vault gate."

---

## Student 3 — Business Logic (Documents, Sharing, Verification)

**Owns:** `DocumentService` (vault, versions, trash, Caffeine read cache), `ShareService` (expiring links, passcodes, OTP gating), `VerifyService` (proof links pinned to versions), the `FileVault` AES-256-GCM encryption, and the org invite flow — the whole slice runs in **core-service on :9000** behind the gateway, and the invite endpoint carries the refactor's famous exception: `POST /api/auth/accept-invite` is admin-domain org logic under an auth prefix, so it deliberately **stays in core-service** and the gateway routes it there with an exact-match rule (RC-1) checked before the auth-prefix rule.

### Elevator pitch (≈ 1 minute)

> "I own the actual product: documents and the promises we make about them. Every file is encrypted with AES-256-GCM before it touches disk and fingerprinted with SHA-256; every download re-verifies that fingerprint, so tampering announces itself. Sharing is governed by atomic database guards — expiry, view counts, revocation, passcodes, and now optionally an emailed OTP pinned to one recipient's inbox: the link answers 401 until that inbox proves control of a code. Verification links don't just say 'valid' — since V09 each proof is pinned to an exact document version, so the verdict is cryptographically bound to the bytes that existed at mint time. And the invite flow no longer emails temporary passwords: the invitee claims their account with an emailed OTP and chooses their own password. The proof: live API calls flip a share through open, revoke and 409, and the tamper demo turns a verification verdict to `tampered` on screen."

### Three layman's terms analogies

1. **The share guard is a nightclub bouncer with a clicker.** Every condition — not expired, not revoked, under the maximum guest count — is checked in the same motion as counting you in: one atomic `UPDATE`. There is no moment where the bouncer checks the list, gets distracted, and two extra people slip in; the database either counts you in or names the exact reason it didn't.
2. **An OTP-gated share is a registered letter with a doorman.** Anyone holding the link can knock (the metadata is visible), but the doorman only opens for the one name the owner wrote on the envelope — and only after that person shows the one-time code that was just posted to their address. A forwarded link is useless without the doorman's handshake.
3. **Version pinning is a notarized photocopy.** A verification link doesn't say "this person's passport is real" — it says "the copy we notarized on Tuesday matches the bytes you're looking at." If the owner uploads a new version on Wednesday, the link honestly reports: the notarized copy is valid, and by the way, a newer version now exists.

### Top 3 examiner questions — exact answers

**Q: "Why do downloads go through single-use tickets instead of just streaming the file?"**
> "Two reasons. Authorization freshness: a ticket is checked at download time against the share's current state, so a revocation seconds after opening takes effect — a pre-signed URL would stay valid until its own expiry. And single use: the ticket is removed from memory the instant it's redeemed, so a leaked URL from the browser history can't be replayed. Tickets live five minutes."

**Q: "Your permanent delete is called 'tombstoning' sometimes — which is it?"**
> "Both, deliberately. We try a hard purge first; the append-only history trigger can refuse row deletion for audit reasons, and when it does we fall back to a tombstone: the document row survives but is stripped — title replaced, hash nulled, bytes deleted. So the file is always gone; the question is only whether the history row remains. That's the audit trail winning on purpose."

**Q: "What stops one user reading another user's documents?"**
> "Ownership lives in the SQL `WHERE owner_id = ?` of every query, not in an `if` in Java. You cannot forget a check that is part of the statement itself, and a document that isn't yours yields the same 404 as a missing one — so the API doesn't even leak that it exists. The role guards on top (admin/org_manager/member) are audited: every refusal writes a row to `audit_logs`."

---

## Student 4 — Mobile App (React Native 0.88 / Expo SDK 58)

**Owns:** the whole Expo client — 46 screens, the 9-frontend-microservice structure (api / model / presenter per domain), the MVP pattern (`BasePresenter`, `usePresenter`), `ApiClient` (single-flight token refresh), the Active Sessions UI, declarative navigation, keyboard focus fixes, and the app's configuration files: `mobile/.env` + `mobile/.env.example` (the `EXPO_PUBLIC_API_URL` the app reads via `src/core/config/env.js`) and the SDK 58 dependency matrix in `package.json`. The refactor changed exactly one thing on this side: `EXPO_PUBLIC_API_URL` now points at the **gateway** (:8080) — the phone still knows one address, and it cannot tell there are two buildings behind the receptionist.

### Elevator pitch (≈ 1 minute)

> "I own everything the user touches. The client is React Native 0.88 on Expo SDK 58 — the newest SDK generation, with the new React Native architecture and iOS 27 support — organized as nine frontend microservices, so six students could work without collisions. The API client handles the boring-but-critical parts silently: it unwraps our response envelope, refreshes an expired access token exactly once with single-flight de-duplication, and surfaces typed error codes instead of raw failures. This sprint I rebuilt the security UX: the login MFA screen now offers 'email me a code instead' and finishes the 440 challenge; the password-reset screen takes the emailed 6-digit code; and both destructive flows — permanent deletion in Trash and password change — detect the server's 403 STEP_UP_REQUIRED, prompt for the emailed code, trade it for a five-minute step-up token and retry with the X-Step-Up-Token header. The user sees a two-tap 'confirm with the code we emailed you' step; under the hood it's a full second-factor handshake. Where the server address comes from: `mobile/.env` holds `EXPO_PUBLIC_API_URL`, `src/core/config/env.js` reads it, and the real file never reaches GitHub — only `.env.example` does. Proof on this machine: `npx expo-doctor` reports 20/20 checks clean on SDK 58, Metro bundles the whole app to Hermes bytecode, and the emulator drives the same flows against the live API."

### Three layman's terms analogies

1. **The MVP pattern is a restaurant waiter.** The screen (view) is the dining room — it never walks into the kitchen (the API). The presenter is the waiter who takes your order, talks to the kitchen, and brings back the plated result; the model is the menu's ingredient list. When the kitchen changes a recipe, the dining room doesn't move — which is exactly how we swapped the whole auth flow for OTPs without rewriting a single screen layout.
2. **Single-flight token refresh is one umbrella in a sudden downpour.** Five people walk out at once, it starts raining — they don't each buy an umbrella; one person buys it and the rest share it. When five API calls all get 'token expired' at the same moment, one refresh request goes out and the other four wait for its result, instead of stampeding the server with four identical refreshes.
3. **The step-up UI is the "are you sure?" that actually checks something.** Normal confirmation dialogs are theater — everyone clicks OK. Ours can't be skipped: the app asks for a code that was just emailed, the server won't accept the destructive request without it, and the dialog you clicked is only the first of two independent proofs.

### Top 3 examiner questions — exact answers

**Q: "How does the app know a password change needs an OTP before it even tries?"**
> "It doesn't pre-check — it discovers. The first submit goes without the header; the server answers 403 STEP_UP_REQUIRED, the presenter catches that specific code, requests the emailed code, and flips the screen into its second phase. That design means the server stays the single source of truth for what is dangerous — the client can never drift out of sync with the server's idea of a sensitive action."

**Q: "Why presenters instead of putting fetch calls in the screens?"**
> "Readability and ownership. Screens are React components — visual, fiddly, and everyone's to touch. Presenters are plain JavaScript classes with a single injected navigation and a state machine, so the whole login, MFA, reset and deletion logic reads as plain classes without rendering anything. It also gives each of the six of us a clean ownership boundary: your microservice folder is yours."

**Q: "What happens if the refresh token is stolen while the user is logged in?"**
> "The attacker uses it first, the real device uses it second — rotation means the real device presents an already-rotated token, the server recognizes reuse, revokes the entire token family and answers 409 TOKEN_REUSE; the client logs the session out immediately. That's the B-1/B-3 audit fix, and it's demonstrated live: replay a rotated refresh token with one repeated API call and watch the whole family die, 409 on screen."

---

## Student 5 — The 8-Pass Security Audit

**Owns:** the audit itself — eight passes (A through H) over the pristine codebase, the finding IDs (A-1 … H-3) that are cited in code comments to this day, and the hardening batches that fixed them — each fix lands with its finding-ID comment, so the audit trail is greppable in the code.

### Elevator pitch (≈ 1 minute)

> "My job was to attack our own system before an examiner did. I ran eight thematic passes over the original code — access control, crypto and vault, concurrency, configuration, input validation, information leakage, error handling, and data integrity — and logged every finding with an ID and a severity. The fixes shipped in three hardening batches, and the IDs stuck: B-1 was refresh-reuse detection that used to fail open — the revocation was rolled back by the very exception that reported it, so a stolen token stayed usable; C-1 was nested transactions holding two pool connections at once, which could commit an audit row even when the outer transaction rolled back — a phantom audit. E-3 made the server refuse to boot on weak JWT secrets; D-1 pinned the vault key to exactly 32 bytes. Every fix landed with its finding-ID comment, so the audit trail is in the code: search any ID letter and you'll find the comment explaining what broke and why the fix is shaped the way it is — and every hardened flow is re-driven live with manual API calls (Postman/cURL) at the defence."

### Three layman's terms analogies

1. **The 8-pass audit is a building inspection with 8 specialists.** One inspector checks the locks, one the wiring, one the fire exits... A general handyman catches obvious things; a specialist catches the gas leak behind the correctly-painted wall. Each pass had one theme and a checklist, so 'we looked at everything' meant something checkable.
2. **B-1 (fail-open revocation) is a burglar alarm that unplugs itself when it rings.** The old code detected a stolen token and tried to revoke the family — but it did the revoking inside the very transaction that then threw the alarm's exception. Both rolled back together: the alarm rang and un-rang in the same instant. The fix rings the alarm *after* the bolt has been thrown — revoke in one committed transaction, then raise the error.
3. **A greppable finding ID is the label on the rewired wire.** An electrician who rewires your house and says 'trust me' is not done; the junction box gets a written label saying what was wrong and what was changed. Every fix in this codebase carries its label — the finding ID in a comment — so any reviewer can trace what broke and why the fix is shaped the way it is.

### Top 3 examiner questions — exact answers

**Q: "What was your most serious finding?"**
> "B-1, the refresh-token reuse detection that rolled back its own revocation. It's the nastiest class of bug — the security control exists in the code, but the transaction boundary made it fail open exactly when it mattered. The fix separates 'revoke the family' into its own committed transaction before the 409 is raised, with the audit event written best-effort afterwards so an audit outage can never undo a revocation. You can read the whole story in the comments around `TokenService.rotate` — `grep B-1` and you're standing on it."

**Q: "How did you prioritize eight passes' worth of findings?"**
> "By exploitability times blast radius. Anything that failed open, leaked a credential, or crossed an ownership boundary was batch 1 — 'someone can get in or see someone else's data'. Integrity and tamper-evidence was batch 2. Concurrency and robustness cleanups were batch 3. And documentation-level risks got logged with a named fix path rather than pretend-fixes. Nothing was closed because we felt like it — each closure points at a finding-ID comment in the code."

**Q: "Did the audit ever produce a false alarm?"**
> "Yes, and that's worth saying out loud. The OTP overhaul initially looked like the overhaul had broken something when our rehearsal API calls started hitting 429s — but the limiter was doing its job: machine-speed repeated calls from one IP legitimately exhaust a 10-per-minute auth bucket, and a real user doing password-reset + MFA + step-up in a minute would come close too. The honest fix was a scope-aware budget (20/min for auth, 30 for public share endpoints), not disabling the limiter. Knowing the difference between 'the system is broken' and 'the system is protecting itself' is the core audit skill."

---

## Student 6 — Deployment & DevOps

**Owns:** the build and run story — the Maven multi-module reactor and the one-command build (`mvn clean install` → gateway/auth/core jars), **the gateway reverse proxy itself** (routing rules, header and body forwarding, 502 behaviour), the multi-stage `server/Dockerfile` and the root `docker-compose.yml` that boots the whole campus, `.env` configuration and fail-fast validation, the root `.gitignore` and the mobile app's env-file setup, the demo seeder, the ExpiryScheduler (single-JVM contract — it runs in core-service only), metrics/health endpoints, and the Sentry Spotlight optional tracing. The schema already carries the session metadata in V01 (`device` and `ip` columns), so the Active Sessions feature is not a migration gap.

### Elevator pitch (≈ 1 minute)

> "I own getting it running — anywhere, in one command. The backend is now a **campus of three Java 21 processes**: one command — `mvn clean install` — builds the whole reactor into three runnable jars, and `docker compose up` boots them all: the **gateway** (:8080) — a pure-JDK reverse proxy I own, which forwards every request untouched to the right building and answers a clean `502 BAD_GATEWAY` when one is down — plus **auth-service** (:8081) and **core-service** (:9000), each with a fail-fast config check: a weak JWT secret or a missing vault key stops startup with a human explanation instead of a runtime surprise. Both DB-touching services share **one Neon PostgreSQL** with small connection pools (≤ 5 each — free-tier friendly), migrations run exactly once (core-service only), and the compose file wires `CORE_URL`/`AUTH_URL` into the gateway and mounts one shared vault volume so MFA secret decryption works across services. Configuration stays in `.env`: sixteen environment variables, `MAIL_MODE=dev` routes OTP codes to the log and an X-Dev-OTP header for demos, live mode sends real email through Brevo's API. Operations got real telemetry: HikariCP pool stats and Dropwizard request metrics surface on /api/health, and Sentry Spotlight tracing is one optional flag. Proof: from a clean clone, `docker compose up --build` boots the whole campus, and a login-plus-documents walk shows the gateway routing to two buildings behind one address."

### Three layman's terms analogies

1. **Fail-fast configuration is the pre-flight checklist.** Pilots don't discover a flat tyre at cruise altitude. Our server refuses to *start* with a weak signing key or a missing vault key, and prints exactly what to run to fix it — a two-minute fix on the ground beats a mystery crash in the air.
2. **MAIL_MODE is the flight simulator switch.** In `dev` mode the OTP codes appear in the console and the response header — you can rehearse the whole two-factor flow without emailing anyone. Flip to `live` and the same code path goes out through Brevo's real email service. Same cockpit, zero risk of spamming strangers while you learn.
3. **The migration runner is the moving truck with a checklist.** It looks at which numbered boxes (V01–V12) are already in the new house, carries in exactly the missing ones, in order, once each. Fresh database or five-months-old database, one boot command brings both to the same final layout.

### Top 3 examiner questions — exact answers

**Q: "How would you deploy this to real users?"**
> "The backend is a campus of three containers: I'd run the compose stack with the gateway behind a TLS-terminating proxy (the API already sets CORS per config), point `DB_URL` at managed PostgreSQL — we run Neon's pooled form today — set `MAIL_MODE=live` with the Brevo key, `VAULT_KEY` from a secret store, `SEED_DEMO=false` (the server itself refuses demo seeds on non-localhost databases), and let core-service's migration runner bring the schema up on first boot. Each service scales independently behind the gateway — the app's address never changes. Health checks already exist at `/api/health`."

**Q: "What stops a developer from leaking production secrets into the repo?"**
> "Three fences. First, secrets only exist in `.env` files, and a comprehensive `.gitignore` sits at the project root blocking secrets, build output, dependencies, editor settings and OS files from ever being committed — you can verify any pattern live with `git check-ignore`. Second, `.env.example` documents every variable with placeholders that the server actively refuses — the JWT placeholder is on a blocklist (E-3) — so nobody can run with example secrets by accident. Third, the committed template files carry no real values: `mobile/.env.example` ships `YOUR_PC_IP_ADDRESS` as its placeholder. The worst case in the repo is a documented example value."

**Q: "If the server crashes at 3am, how do you know what happened?"**
> "Three layers. Every request logs one line — method, path, status, duration. Every security-relevant event lands in the append-only `audit_logs` table with actor, IP and JSON detail. And `/api/health` plus the Dropwizard counters on `/api/meta` show whether the database and the request path are healthy. Optional Sentry Spotlight tracing adds the distributed-timeline view when it's switched on. The logs answer 'what happened'; the audit trail answers 'who did it'; the metrics answer 'is it still happening'."

---

## Bridge map — who to defer to

| If the question is about… | Bridge to |
|---|---|
| JWT internals, token rotation, OTP hashing, Brevo | **Student 2** |
| Table schema, constraints, triggers, pool internals, router matching | **Student 1** |
| AES-GCM vault, share guards, tickets, version pinning, tombstones | **Student 3** |
| Screens, presenters, ApiClient, UX flows | **Student 4** |
| Audit findings (letter-number IDs), what broke and why, the greppable fix comments | **Student 5** |
| Build, config, secrets, seeding, metrics, deployment | **Student 6** |
| Gateway routing rules, 502 behaviour, header forwarding, `X-Forwarded-For` | **Student 6** (owns the proxy) with **Student 1** (the routers behind it) |
| Why microservices / why a shared database / the Strangler Fig | **Student 6** (deployment shape) with **Student 1** (data layer) |

## The universal questions (everyone rehearses these)

- **"Why no Spring?"** — Brief constraint, owned as an advantage: a readable request path, zero magic, libraries only where wheels are genuinely hard.
- **"Why microservices — and why a *shared* database?"** — Two honest answers. The refactor (Strangler Fig) lets one branch move at a time behind a stable address, so a six-person team never halts features for an architecture rebuild; auth moved first because it is the smallest, cleanest branch. The shared database is the deliberate counter-move: on Render's free tier each service gets 512 MB of RAM, and a second Neon database would buy us distributed transactions ("login committed but the document insert didn't") and double the connection budget for zero user value — so both services read one schema, with small pools (≤ 5 each), one migration owner, and the schema's own constraints keeping both honest. Database-per-service remains the honest future answer when scale demands it.
- **"What does the gateway actually do?"** — Nothing clever, on purpose: pure JDK reverse proxy, three routing rules (RC-1 exact match → core, `/api/auth/*` → auth, everything else → core), forwards method, raw path, raw query, headers and body bytes untouched, recomputes `X-Forwarded-For` so audit rows keep the real client IP, and answers `502 BAD_GATEWAY` when a building is down. One file, no dependencies.
- **"Proudest piece?"** — The OTP security chain: password reset, MFA fallback, step-up and gated shares, all sharing one hashed, single-use, purpose-salted code engine — with the property that no API response ever contains a credential.
- **"How do you handle remote session revocation?"** — Surgical revoke: `DELETE /api/auth/sessions/:id` calls `TokenService.revokeById` — one `UPDATE refresh_tokens SET revoked_at = now() WHERE id = ? AND user_id = ?`, scoped to the caller's own rows, so the token-family cascade (reserved for refresh-reuse attacks) is never triggered, and the revoked row simply disappears from the next `GET /api/auth/sessions`.
- **"Weakest point?"** — Notification transport is in-app only (no email/push for expiry reminders), and the Active Sessions list shows sign-in metadata (device, IP, sign-in time), not live "last seen" heartbeats. Both are named, both have a fix path; neither weakens the security core.
- **"What would you build next?"** — Push notifications for expiry radar, cursor pagination for large vaults, an object-storage backend behind the same FileVault interface — and the next two strangler slices: vault-service and admin-service (the stubs are already sitting in `server/`).

---

## The Masterclass deep dives — docs/defence/

This guide is the master index; the complete brief for each role lives in its Masterclass file under [`docs/defence/`](docs/defence/):

| File | Owner |
|---|---|
| `STUDENT_1_INFRASTRUCTURE_DB.md` | Student 1 — Infrastructure & Database |
| `STUDENT_2_AUTH_OTP.md` | Student 2 — Auth & OTP Security |
| `STUDENT_3_BUSINESS_LOGIC.md` | Student 3 — Business Logic |
| `STUDENT_4_MOBILE_APP.md` | Student 4 — Mobile App |
| `STUDENT_5_AUDIT.md` | Student 5 — The 8-Pass Security Audit |
| `STUDENT_6_DEVOPS.md` | Student 6 — Deployment & DevOps |

Each Masterclass file carries the verbatim pitch, the complete file-and-folder ownership table (every owned file, one plain-English sentence each), five layman's analogies, the critical code walkthrough naming the exact methods in order, the domain glossary in plain words, the personal Q&A bank, and the cross-team handshake. Read your role section here first, then rehearse from your Masterclass file. `STUDENT_PACK.md` in the same folder is the one-page summary of all six.

---

# Part 2 — The system explained for absolute beginners

These nine explainers assume the reader has never written a line of code. Each one is assigned to the student who should rehearse it hardest, but every team member should be able to retell all nine. Every folder name, number and library mentioned here is real — open the folder during the defence and point at it.

## 2.1 React Hooks — the sticky notes that remember things (rehearse: Student 4)

**First, what is a "hook"?** A phone app screen is drawn hundreds of times per second — every time you tap something, the screen redraws. But a drawing has no memory: wipe it and start again, and nothing is left over. A **hook** is a sticky note that React (the drawing library) keeps beside the drawing. The screen is wiped and redrawn all day long, but the sticky notes stay on the desk, remembering things between drawings. The word "hook" literally means: your screen component *hooks into* React's memory. Three sticky notes matter in our app:

1. **`useState` — the sticky note with a magic pen.** You write a value on the note: "inbox notifications: 3". The screen copies whatever is on the note. When something happens — a new notification arrives — you call the pen that came with the note, the note now reads "4", and React *automatically redraws the screen* to show 4. You never redraw anything by hand; changing the note is the whole job. In our app every counter, form field, loading flag and error message lives on such notes.
2. **`useEffect` — the "after you finish drawing, run this errand" slip.** Drawing a screen should stay fast and dumb; the errands — fetching the document list from the server, starting a countdown timer, subscribing to a notification channel — go on the slip. React runs each errand *after* the drawing is done, and the slip has a cleanup line: when the screen is closed, the timer is stopped and the subscription cancelled, so nothing keeps running in the background like a tap left on.
3. **`usePresenter` — our own custom sticky note, the one an examiner will ask about.** DocuTrust does not let screens talk to the server directly; each screen gets a **presenter** — a plain-JavaScript "waiter" that holds the screen's brain: what to fetch, what counts as a valid form, what to show while loading, on error, on empty. `usePresenter` is the three-line glue that *hires the waiter when the screen opens* (sticky note: `presenter = new LoginPresenter()`), *passes the waiter's status onto a note* so the screen redraws as it moves idle → loading → success → error, and *fires the waiter when the screen closes* so no presenter haunts a closed screen. One hook, and 46 screens all behave the same way. **One-sentence version:** "A hook is a sticky note that remembers things between redraws; `useState` remembers a value, `useEffect` remembers an errand to run after drawing, and our `usePresenter` remembers to hire — and later fire — the screen's waiter."

## 2.2 The overall architecture — the customer, the cashier, and two kitchens (rehearse: Student 1, but everyone)

DocuTrust began as one restaurant with three rooms; it is now a **food court with one cashier and two kitchens**. The **customer** is the mobile app on your phone (built with React Native and Expo). It is good-looking and polite, but it has no kitchen: it cannot store your documents, check passwords or decide who may see what. It only *orders* — and it always orders from the same window.

The **cashier** is the **gateway** on port 8080. It cooks nothing. It takes the order slip and slides it, **unchanged**, to the right kitchen: identity orders — anything starting with `/api/auth/` — go to the **security kitchen** (auth-service, port 8081); everything else goes to the **vault kitchen** (core-service, port 9000); and one special order, the organisation invitation accept (`POST /api/auth/accept-invite`), goes to the vault kitchen even though it *sounds* like an identity order — the cashier memorised that one exception (RC-1). If a kitchen is closed, the cashier does not pretend: it hands back a "502 — kitchen unavailable" note at once. Each kitchen has its own staff chart — controllers as waiters, services as chefs, the same security lane every order passes (ID check, role check, too-many-requests check) — and both kitchens reach into the **same pantry** (one shared PostgreSQL database on Neon) and the **same safe** (one encrypted file vault). Because both kitchens mix their ink from the **same secret recipe** (`JWT_SECRET`), an ID card printed by the security kitchen is accepted by the vault kitchen on sight — nobody has to phone anyone.

**Why two kitchens instead of one big one?** So each can be rebuilt, restarted and scaled alone — and so the rebuild could happen gradually (the Strangler Fig: we put up the cashier window first, then moved the identity stove out while the customers kept ordering from the same window; the vault stove is still in the old kitchen, and two more huts — vault-service, admin-service — already have their foundations poured). **One-sentence version:** "The app is the customer, the gateway is the cashier with one address, the bouncer's kitchen prints the ID cards, the vault's kitchen guards the documents — two kitchens, one pantry, and a cashier who never cooks."

## 2.3 The frontend folders — it's like a smartphone (rehearse: Student 4)

Open `mobile/src/` and you see seven folders. The easiest way to explain them: **the app is a smartphone, and each folder is a part of the phone.**

- **`screens/` are the different apps you open.** Forty-five of them: a Login app, a Documents app, a Trash app, a Share app… Each screen is one full-page view the user sees. They are deliberately dumb — they draw what they're told and forward taps, like an app that only shows what its data says.
- **`components/` are the buttons on the screen.** Small reusable pieces — a document card, a password input, a toast pop-up, a loading skeleton — drawn once and used on many screens. If screens are apps, components are the physical buttons and icons shared by every app, so the whole phone feels consistent.
- **`microservices/` are the invisible background processes that fetch your data.** Nine folders (auth, documents, folders, sharing, verification, notifications, org, profile, admin), one per feature area. Each holds that domain's *api* files (how to ask the waiter), *model* files (what the data looks like) and *presenter* files (the screen's brain). The user never sees these; like background processes, they do the fetching and deciding. **Why separated?** So six students could work at once without stepping on each other — the sharing student re-wrote her whole OTP-gating flow and never touched the documents folder.
- **`navigation/` is the home-screen gesture.** The app switcher: which app opens when you tap what, and what the back gesture does.
- **`mvp/` is the house rulebook** — `BasePresenter` and `usePresenter` (see 2.1) that every screen's waiter follows.
- **`core/` is the phone's settings** — the server address, the design tokens (colours, spacing), shared helpers.

**One-sentence version:** "Screens are the apps you open, components are the buttons on them, microservices are the invisible background processes fetching the data — and navigation is the home gesture that moves between apps."

## 2.4 The backend folders — a well-organized campus (rehearse: Student 1)

Open `server/` and you now see the campus's site plan: a Maven **multi-module** project. **`shared/` is the standard staff kit every building is issued** — the `http` folder (the `Router` menu index, the `Middleware` security chain, the `Ctx` order-slip format), `db/` (the pantry connection, the numbered instruction sheets, the all-or-nothing order rule), `auth/` (the ID-checking toolkit), `config/` (the manager's opening checklist — refuse to open with weak keys), plus `model/`, `util/`, `vault/` and `controller/`/`service` helpers. **`core-service/` is the vault building** — it wires that shared kit to 56 routes of documents, folders, shares, verification, notifications, admin and org (including the special `POST /api/auth/accept-invite` order). **`auth-service/` is the security building** — the same shared kit wired to the 18 identity routes: register, login, refresh, me, sessions, MFA, step-up. **`gateway/` is the front desk** — one small file of routing rules and a byte-for-byte forwarding engine. (`vault-service/` and `admin-service/` are graded building plots with foundations poured — stubs waiting for the next strangler slices.)

Inside each service, the staff chart is the same one we always had. **The `controller` folder is the waiters taking orders** — one per section of the menu; receive the order, check the ID, hand it to the kitchen, carry the plate back. Waiters never cook. **The `service` folder is the chefs cooking** — hashing one-time codes, encrypting files, enforcing share rules. Chefs never talk to the customer directly; that's the cashier's and waiters' job. **The `db` folder is the pantry and the head clerk**, and the `vault` folder is the safe — files are encrypted there with AES-256-GCM, a standard so strong it's used by banks. **Why separated?** Same reason as the kitchens: a new chef can be hired without retraining the waiters — we moved the entire identity menu into a brand-new building and the shared kit, the chefs' recipes and the pantry never changed shape. **One-sentence version:** "`shared` is the staff kit, `core-service` is the vault building, `auth-service` is the security building, `gateway` is the front desk — and every building runs the same waiter/chef/pantry chart from the same kit."

## 2.5 The database — a highly organized filing cabinet (rehearse: Student 1)

A **relational database** is a filing cabinet with strict rules, and PostgreSQL — the one we chose — is the strictest, most trusted cabinet on the market. The cabinet has **15 drawers (tables)**: `users`, `documents`, `document_versions`, `shares`, `email_otps`, `audit_logs`, and so on. (Peek with `\dt` and you'll see a 16th — `schema_migrations` — but that's not one of ours: it's the moving truck's own clipboard, where the migration runner writes down which numbered instruction sheets it already delivered.) Inside each drawer are **index cards (rows)** — one card per user, per document, per share link. Each card has the same **printed fields (columns)**: a user card always has name, email, role, created-at. You never find a hand-scribbled card with a different shape — the drawer's form is fixed when the drawer is built.

**A foreign key is a cross-reference written on the card.** A document card says "owner: see card #42 in the USERS drawer." The clerk refuses to file a document whose owner card doesn't exist, and (by our setting) refuses to destroy a user card while documents still point at it. That is what "relation" means: the cabinet itself guarantees the references make sense, so a typo or a bug can't create an orphan.

**Why PostgreSQL, in plain words?** Four reasons. (1) It *enforces rules* — a CHECK constraint is a house rule the clerk applies even to the boss: a medical document physically cannot become "active" without review, no matter what buggy code asks for. (2) It *keeps honest history* — we added automatic triggers so audit cards cannot be edited or torn out, only appended. (3) It is *free, battle-tested for 25+ years, and runs everywhere* — including Neon, the free cloud host we use, so our project costs nothing to run. (4) It speaks a standard language (SQL) that every one of us could write. The cabinet is assembled from **12 numbered instruction sheets (migrations)** — V01 builds the users drawer, V10 adds the email-OTP drawer, V11 adds three fields to shares — so any team member can rebuild the identical cabinet from nothing, in order, in minutes. Both kitchens reach into this one cabinet, each through its own small doorway (a connection pool of at most 5), so the shared free-tier cabinet is never overcrowded. **One-sentence version:** "Tables are drawers, rows are index cards, foreign keys are cross-references the clerk refuses to break — and PostgreSQL is the strict, free, 25-year-old cabinet that enforces our house rules even against bugs."

## 2.6 The server — a 24/7 front desk with two kitchens behind it (rehearse: Student 6)

What *is* a web server? It is a program that never sleeps, sitting by a phone that never stops ringing. Ours is now **three programs**: a front desk and two kitchens. The **front desk** (the gateway, port 8080) picks up **within milliseconds, always** — it doesn't matter if it's one call or fifty at once — and it asks exactly one question: "which kitchen does this order belong to?" It forwards the order **untouched** (same verb, same address, same headers, same bytes — your 25 MB document upload arrives exactly as it left the phone), and it carries the answer back unchanged. If the kitchen it needs is closed, it answers instantly with a polite "502 — kitchen unavailable" instead of letting the customer wait forever.

Each **kitchen** is a full server in its own right, with the same good-receptionist duties. It asks "who's calling?" and checks the caller's ID card (the JWT — and both kitchens check with the *same secret ink*, so a card printed by one is trusted by the other); it looks up the requested department in its own directory (core-service has **56 departments**, auth-service **19** — anything unknown gets a clean "no such extension", a 404, never a crash); and it walks the request to that department and carries the answer back on the same standardized tray (a JSON envelope — see 2.8). Three more duties make each a *good* kitchen: it **writes down every call** — one line per request, and every security-relevant event into an append-only audit book (the front desk even writes the visitor's true address on the slip so the book records who really called); it **limits repeated callers** (rate limiting); and it **refuses to open with broken locks** — at start-up it checks its own keys and configuration, and if the signing key is weak it refuses to start and prints exactly what to fix (fail-fast). **One-sentence version:** "A front desk that forwards everything untouched, two kitchens that check IDs with the same ink, 75 departments between them, and every call written down."

## 2.7 The tech stack — what we chose and why, in plain words (rehearse: Student 6)

| Technology | What it is, in plain words | Why we chose it |
|---|---|---|
| **Java 21** | The language of the server — one recipe book, runs on any machine with a "Java reader" installed | The brief forbids frameworks, and Java is a 25-year-old workhorse: strict (mistakes are caught before running), fast, and every one of us had read it. Version 21 is a long-term-support release — the "sturdy, supported for years" edition |
| **The gateway (pure JDK reverse proxy)** | The front desk: one small Java file that forwards every request to the right building, untouched | No framework, no extra image — a proxy you can read in ten minutes is a proxy you can defend |
| **PostgreSQL** (hosted free on **Neon**) | The filing cabinet (see 2.5) — **one cabinet shared by both kitchens** | Strictest rule enforcement, free cloud hosting, 25+ years of trust. Neon is "PostgreSQL with a free landlord"; sharing one cabinet keeps every order all-or-nothing and fits the free tier's connection budget (small pools per service) |
| **React Native + Expo (SDK 58)** | The phone-app builder — you write the app once in JavaScript and it runs on both iPhone and Android, like a translator who speaks both fluently. SDK 58 pairs React Native 0.88 with the new React Native architecture and iOS 27 support | One codebase instead of two; Expo is the training wheels: scan a QR code and the app runs on a real phone immediately, no app store needed for demos. `npx expo-doctor` is the app's own mechanic — it inspects the dependency list and reports 20/20 checks clean, and `npx expo install --fix` keeps every library on the version the SDK certified |
| **Brevo** | The postman — an email-delivery service with a simple API | OTP codes must reach real inboxes; Brevo has a free tier, a 2-line sending call, and a `MAIL_MODE` switch lets us rehearse without emailing anyone |
| **HikariCP** | The restaurant host for the database (see Student 1's analogy) — keeps a fixed set of "tables" (connections) ready and seats each query instantly | Hand-rolling connection seating is a classic source of 3am crashes; HikariCP is the fastest and most battle-tested host, and our code's API didn't change |
| **Bucket4j** | The ration-book stamp — counts requests per minute per user | Rate limiting must be exact under concurrency; Bucket4j is the standard Java library, and we tuned budgets per endpoint scope (20/min auth, 30/min public shares) |
| **Caffeine** | The noticeboard by the kettle — the few hot facts everyone re-reads, kept in memory | Listing documents re-reads the same rows; Caffeine keeps them hot with size and time limits so the board can never go stale |
| **Dropwizard Metrics + Sentry Spotlight** | The office dashboard and the CCTV timeline | `/api/health` shows pool and request stats live; Spotlight (optional one-flag) draws the full timeline of a request across the system |

**One-sentence version:** "Every choice is either 'the brief told us' (pure Java, no framework), 'the boring, trusted option' (PostgreSQL, Java 21 LTS), or 'the standard library for a problem too dangerous to hand-roll' (HikariCP, Bucket4j) — and we can name the danger for each."

## 2.8 The data API — the standardized order form (rehearse: Student 3)

How does the app actually talk to the waiter? Two conventions make it work, and both are just agreed paperwork.

**HTTP methods are the five verbs on the order pad.** Every request says *what kind of wish it is*: **GET** = "just let me look" (open the documents list — looking changes nothing); **POST** = "here is something new" (upload a document, register, request an OTP code); **PUT** = "replace this whole thing" (overwrite the notification settings); **PATCH** = "amend one field" (rename a document); **DELETE** = "take this away" (move to trash). The same address can behave differently by verb: `GET /api/documents` lists, `POST /api/documents` uploads, `DELETE /api/documents/12` trashes document 12. Reading is safe, writing is checked twice — ID first, then permission.

**JSON is the standardized order form.** JSON is a way of writing data that both the app and the server read: labelled boxes in fixed positions — `{"title": "Passport", "status": "active"}` — like an order form where every box is printed and everyone agreed what goes in each box. The phone speaks Android, the server speaks Java, but neither cares: they only swap forms. Every answer from our server arrives in the **same envelope**: `{ "ok": true, "data": … }` on success, `{ "ok": false, "error": { "code": "SHARE_OTP_REQUIRED", "message": … } }` on failure — so the app opens every envelope the same way, and a screen that hits an error always finds a *code* it can translate into friendly words.

**The rubber stamp on the envelope is the status code**, three numbers with fixed meanings everyone should memorise: **200** "here you go"; **400** "your form was filled wrong"; **401** "ID card missing or fake"; **403** "real ID, but not allowed" (or, with `STEP_UP_REQUIRED`, "allowed, but prove a second time first"); **404** "no such thing — and we won't say whether it exists for someone else"; **409** "conflict — the link is expired/revoked/out of views, or that token was reused"; **429** "too many requests, wait a minute"; **440** *our own stamp*: "second factor needed — check your email"; **500** "our mistake, sorry — the details are in the log, not in your face." **One-sentence version:** "The frontend hands the backend standardized order forms — five verbs on the pad, JSON as the form's printed boxes, one envelope for every answer, and a rubber stamp (the status code) saying exactly how it went."

## 2.9 The microservices refactor — why one restaurant became a campus (rehearse: Student 6, but everyone)

**First, the name.** The **Strangler Fig pattern** is named after a real plant: a fig seed sprouts on a big tree, grows *around* it for years, and one day the fig stands on its own while the old trunk has quietly become just its core. In software it means: don't knock the old system down while people are using it — put a **new front desk in front of it**, then move one branch at a time behind that desk, so users never notice the construction site. Our fig is the **gateway** (port 8080): since it appeared, the mobile app has pointed at the exact same address it always did. Our old tree is the monolith, now called **core-service**, still standing in its room doing what it does best. Our first moved branch is **auth-service** — identity was the smallest, cleanest branch, so it went first.

**The three moves, in plain words.** *Phase 1 — build the site:* the one big code folder became a **multi-module site** (`shared` = the standard staff kit; `core-service` = the old restaurant renamed, now on port 9000; four empty building plots marked with signs: auth, vault, admin, gateway). *Phase 2 — move the identity stove:* the 18 identity routes physically moved into the new **auth-service** building (the files moved **byte-identical** — same recipes, new kitchen), and the two buildings agreed on two things: the **same ink** for ID cards (a shared `JWT_SECRET`, so core-service can verify auth-service's tokens with no phone call — cross-service JWT validation) and **one pantry**. One famous exception stayed behind: the organisation-invite accept (`POST /api/auth/accept-invite`) is *organisation* paperwork that happens to live at an identity address, so the gateway memorised an exact-match rule to send it to the vault building — we call that RC-1. *Phase 3 — open the front desk:* the gateway became a real proxy that forwards every request **untouched** (method, address, query, headers, body bytes), carries answers back unchanged, rewrites the visitor's address on the slip (`X-Forwarded-For`) so the audit book keeps recording true visitors, and says "502 — kitchen unavailable" the instant a building is down.

**Why the two kitchens share one pantry (the question every examiner asks).** Our free hosting plan gives each building only **512 MB of memory** and a small database connection budget. A pantry *per* kitchen would mean: two rent bills, twice the connection budget spent, and — the real killer — orders that must now succeed **in two places at once** ("the login was written to pantry A, but the document went into pantry B and failed — now what?"). That problem has a name, *distributed transactions*, and it is the kind of cleverness that produces 3am mysteries. Sharing **one** pantry (one Neon PostgreSQL) means every order is still all-or-nothing, the schema's own rules referee both kitchens, and the connection budget is spent on small pools per service (`DB_POOL_MAX ≤ 5`) instead of duplicated ones. We gave up nothing we needed: the two kitchens touch different drawers of the same cabinet, and the drawers' rules (append-only history, checked ownership, hashed codes) never cared which kitchen wrote the row.

**What stayed deliberately boring.** No new frameworks: the gateway is one Java file using only the JDK's built-in tools. No new dependencies: `mvn clean install` still builds everything in one command; `docker compose up` still boots everything with one command. No behaviour change: 74 dishes on the menu before, 74 after — the cashier just knows which kitchen cooks which. **One-sentence version:** "We built a front desk, moved the identity stove into its own building with the same ink and the same pantry, and the customers — the app and its users — never changed their habits."