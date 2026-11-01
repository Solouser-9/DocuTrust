# DocuTrust — Oral Defence Guide (Group 3)

**One rule above all: every claim in this guide is verifiable in the repository.** Numbers were counted from the running system (`routes=71` is printed at boot), and every mechanism named here points at a file you can open during the defence. Learn your slice, bridge honestly to the others, and you cannot be caught out.

## The numbers everyone must know

| Metric | Value | Where it is printed / counted |
|---|---|---|
| API routes | **71** | boot log `routes=71`, `server/src/main/java/com/docutrust/Main.java` |
| Database tables | **15** | `database/migrations/V01…V11` (V10 adds `email_otps`) |
| Migrations | **11** | `database/migrations/` — one numbered SQL file each |
| Server unit tests | **42** | `bash server/run-tests.sh` → `DocuTest summary: 42 passed` |
| End-to-end steps | **31** | `node mobile/e2e/run.js` → `31 steps: 31 passed` |
| Mobile screens | **45** | `mobile/src/screens/index.js` |
| Numbered features | **216 + OTP addendum** | `docs/FEATURES.md` |
| Roles | `admin` > `org_manager` > `member` | enforced in `Middleware.requireRole` |
| Infra libraries | HikariCP 5.1.0 · Bucket4j 8.10.1 · Caffeine 3.1.8 · Dropwizard Metrics 4.2.25 · Sentry 7.14.0 | `server/pom.xml` |

## The Individual Defence Formula

Every student uses the same four-beat shape:

1. **PITCH (≤ 1 minute):** what I own → the hard problem inside it → the mechanism in one sentence → the proof (a test or a live demo you can run on command).
2. **ANALOGY (3 ready):** three layman's terms comparisons for your hardest concepts. Examiners reward the ability to explain technology to non-technologists.
3. **Q&A (3 deep):** the three questions an examiner is most likely to ask *you*, with answers you have rehearsed word-for-word.
4. **BRIDGE (always):** if a question lands outside your slice, say *"that's [Student N]'s area — here's how my part feeds into it"* and stop there. Never improvise another person's mechanism.

---

## Student 1 — Infrastructure & Database

**Owns:** `Router`, `Middleware`, `Config`, `Migrator`, the hand-rolled HTTP boundary, and the whole PostgreSQL schema (V01–V11, 15 tables, triggers, views, indexes). After the infrastructure upgrade they also own the pooling and caching layer.

### Elevator pitch (≈ 1 minute)

> "I built the skeleton everything else hangs on. DocuTrust's server is pure Java 21 on the JDK's built-in HTTP server — no Spring — so every request is matched by a hand-written router with 71 registered routes, then passes through a middleware chain: CORS, logging, JWT authentication, role guards and rate limiting. Underneath, HikariCP manages the database pool, and the schema itself does security work: fifteen tables with CHECK constraints, foreign keys, and append-only triggers so that even a database console cannot rewrite an audit trail. My proof is simple: the boot log prints `migrations=11, routes=71`, and the unit suite of 42 tests includes the router and JWT tests."

### Three layman's terms analogies

1. **HikariCP is a restaurant host.** Guests (database queries) don't wait for a free table to be built; a host keeps a fixed set of tables ready and seats the next guest at whichever frees up first. Before HikariCP we hand-wrote that seating logic; now it's a battle-tested library with the same seats (our code's API didn't change at all).
2. **Migrations are LEGO instructions in order.** Each numbered file (V01–V11) adds a few bricks — a table here, an index there — and the database is just the sum of the steps. Any team member can rebuild the exact same database from scratch, which is why our ER diagram and our production schema can never drift apart.
3. **The router is a hotel receptionist.** You say "I'm here for room 12" (`/api/documents/:id`) and the receptionist knows static room numbers take priority over "the room with whatever name" — exact matches win over wildcards. One receptionist, 71 known destinations, and anything unknown gets a clean 404 instead of a crash.

### Top 3 examiner questions — exact answers

**Q: "Why no Spring Boot? Isn't that reinventing the wheel?"**
> "The brief forbids frameworks, and it turned out to be a gift: our request path is 4 files you can read in ten minutes, and there is zero magic between the socket and our code. We do use libraries where wheels are genuinely hard — HikariCP for pooling, Bucket4j for rate limiting — but the architectural skeleton is ours and fully explainable."

**Q: "What happens if two requests write to the same row at the same time?"**
> "Every write runs inside a transaction via `Database.tx` — autocommit off, commit or rollback, no nesting. Where races genuinely matter we push the guard into a single atomic SQL statement: for example a share open does `UPDATE shares SET view_count = view_count + 1 WHERE ... AND (max_views IS NULL OR view_count < max_views)` — one statement, database-level locking, and if it updates zero rows we re-classify and return the exact reason (revoked, expired, or max views)."

**Q: "Why is business logic like 'sensitive documents need review' in the database and not just in Java?"**
> "Defense in depth. There's a CHECK constraint — `documents_sensitive_needs_review` — so a medical or financial document physically cannot be `active` without review. A bug in Java can't bypass it, a manual SQL console can't bypass it. The Java layer gives friendly error messages; the schema guarantees the invariant."

---

## Student 2 — Auth & OTP Security

**Owns:** `AuthService`, `PasswordService` (PBKDF2), `TokenService` (rotating refresh + reuse detection), `MfaService` (TOTP), `OtpService`, `MailService` (Brevo), `StepUpService`, and the rate limiter. This is the newest and deepest slice: the OTP security overhaul.

### Elevator pitch (≈ 1 minute)

> "I own everything that proves who you are. Passwords are PBKDF2-hashed; sessions are a 15-minute access JWT plus a rotating refresh token whose reuse is detected and kills the whole token family — B-1 in our audit. On top we just shipped an email-OTP layer: six-digit codes, SHA-256-hashed in the database, single-use, ten-minute expiry, five attempts max, sent through Brevo. They power four flows: password reset, email MFA fallback for login — the server answers HTTP 440 with a challenge — step-up verification for destructive actions like permanent deletion, and OTP-gated share links. The security headline: after the overhaul, **no API response ever contains a password, a reset code, or a temporary password** — the inbox is the only place a code exists. The proof is the 31-step E2E suite: it walks every one of those flows, including the negative paths."

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

**Owns:** `DocumentService` (vault, versions, trash, Caffeine read cache), `ShareService` (expiring links, passcodes, OTP gating), `VerifyService` (proof links pinned to versions), the `FileVault` AES-256-GCM encryption, and the org invite flow.

### Elevator pitch (≈ 1 minute)

> "I own the actual product: documents and the promises we make about them. Every file is encrypted with AES-256-GCM before it touches disk and fingerprinted with SHA-256; every download re-verifies that fingerprint, so tampering announces itself. Sharing is governed by atomic database guards — expiry, view counts, revocation, passcodes, and now optionally an emailed OTP pinned to one recipient's inbox: the link answers 401 until that inbox proves control of a code. Verification links don't just say 'valid' — since V09 each proof is pinned to an exact document version, so the verdict is cryptographically bound to the bytes that existed at mint time. And the invite flow no longer emails temporary passwords: the invitee claims their account with an emailed OTP and chooses their own password. The proof: the E2E suite flips a share through open, revoke and 409, and the tamper demo turns a verification verdict to `tampered` live."

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

**Owns:** the whole Expo client — 45 screens, the 9-frontend-microservice structure (api / model / presenter per domain), the MVP pattern (`BasePresenter`, `usePresenter`), `ApiClient` (single-flight token refresh), the auth screens, every OTP-era UI flow, and the app's configuration files: `mobile/.env` + `mobile/.env.example` (the `EXPO_PUBLIC_API_URL` the app reads via `src/core/config/env.js`) and the SDK 58 dependency matrix in `package.json`.

### Elevator pitch (≈ 1 minute)

> "I own everything the user touches. The client is React Native 0.88 on Expo SDK 58 — the newest SDK generation, with the new React Native architecture and iOS 27 support — organized as nine frontend microservices, so six students could work without collisions. The API client handles the boring-but-critical parts silently: it unwraps our response envelope, refreshes an expired access token exactly once with single-flight de-duplication, and surfaces typed error codes instead of raw failures. This sprint I rebuilt the security UX: the login MFA screen now offers 'email me a code instead' and finishes the 440 challenge; the password-reset screen takes the emailed 6-digit code; and both destructive flows — permanent deletion in Trash and password change — detect the server's 403 STEP_UP_REQUIRED, prompt for the emailed code, trade it for a five-minute step-up token and retry with the X-Step-Up-Token header. The user sees a two-tap 'confirm with the code we emailed you' step; under the hood it's a full second-factor handshake. Where the server address comes from: `mobile/.env` holds `EXPO_PUBLIC_API_URL`, `src/core/config/env.js` reads it, and the real file never reaches GitHub — only `.env.example` does. Proof on this machine: `npx expo-doctor` reports 20/20 checks clean on SDK 58, the Jest suite runs 74/74, Metro bundles the whole app to Hermes bytecode, and the 31-step E2E drives the same flows against the live API."

### Three layman's terms analogies

1. **The MVP pattern is a restaurant waiter.** The screen (view) is the dining room — it never walks into the kitchen (the API). The presenter is the waiter who takes your order, talks to the kitchen, and brings back the plated result; the model is the menu's ingredient list. When the kitchen changes a recipe, the dining room doesn't move — which is exactly how we swapped the whole auth flow for OTPs without rewriting a single screen layout.
2. **Single-flight token refresh is one umbrella in a sudden downpour.** Five people walk out at once, it starts raining — they don't each buy an umbrella; one person buys it and the rest share it. When five API calls all get 'token expired' at the same moment, one refresh request goes out and the other four wait for its result, instead of stampeding the server with four identical refreshes.
3. **The step-up UI is the "are you sure?" that actually checks something.** Normal confirmation dialogs are theater — everyone clicks OK. Ours can't be skipped: the app asks for a code that was just emailed, the server won't accept the destructive request without it, and the dialog you clicked is only the first of two independent proofs.

### Top 3 examiner questions — exact answers

**Q: "How does the app know a password change needs an OTP before it even tries?"**
> "It doesn't pre-check — it discovers. The first submit goes without the header; the server answers 403 STEP_UP_REQUIRED, the presenter catches that specific code, requests the emailed code, and flips the screen into its second phase. That design means the server stays the single source of truth for what is dangerous — the client can never drift out of sync with the server's idea of a sensitive action."

**Q: "Why presenters instead of putting fetch calls in the screens?"**
> "Testability and ownership. Screens are React components — expensive to test and everyone's to touch. Presenters are plain JavaScript classes with a single injected navigation and a state machine, so Jest covers login, MFA, reset, and the deletion flows without rendering anything. It also gives each of the six of us a clean ownership boundary: your microservice folder is yours."

**Q: "What happens if the refresh token is stolen while the user is logged in?"**
> "The attacker uses it first, the real device uses it second — rotation means the real device presents an already-rotated token, the server recognizes reuse, revokes the entire token family and answers 409 TOKEN_REUSE; the client logs the session out immediately. That's the B-1/B-3 audit fix and it's demoed in our unit tests: replay a rotated refresh token and watch the family die."

---

## Student 5 — The 8-Pass Security Audit

**Owns:** the audit itself — eight passes (A through H) over the pristine codebase, the finding IDs (A-1 … H-3) that are cited in code comments to this day, the hardening batches that fixed them, and the regression proof that nothing broke (42 unit + 31 E2E green after every batch).

### Elevator pitch (≈ 1 minute)

> "My job was to attack our own system before an examiner did. I ran eight thematic passes over the original code — access control, crypto and vault, concurrency, configuration, input validation, information leakage, error handling, and data integrity — and logged every finding with an ID and a severity. The fixes shipped in three tested batches, and the IDs stuck: B-1 was refresh-reuse detection that used to fail open — the revocation was rolled back by the very exception that reported it, so a stolen token stayed usable; C-1 was nested transactions holding two pool connections at once, which could commit an audit row even when the outer transaction rolled back — a phantom audit. E-3 made the server refuse to boot on weak JWT secrets; D-1 pinned the vault key to exactly 32 bytes. Every fix landed with a test, and the full suite — 42 unit, 31 end-to-end — is green on the final build. The audit trail is in the code: search any ID letter and you'll find the comment explaining what broke and why the fix is shaped the way it is."

### Three layman's terms analogies

1. **The 8-pass audit is a building inspection with 8 specialists.** One inspector checks the locks, one the wiring, one the fire exits... A general handyman catches obvious things; a specialist catches the gas leak behind the correctly-painted wall. Each pass had one theme and a checklist, so 'we looked at everything' meant something checkable.
2. **B-1 (fail-open revocation) is a burglar alarm that unplugs itself when it rings.** The old code detected a stolen token and tried to revoke the family — but it did the revoking inside the very transaction that then threw the alarm's exception. Both rolled back together: the alarm rang and un-rang in the same instant. The fix rings the alarm *after* the bolt has been thrown — revoke in one committed transaction, then raise the error.
3. **Regression proof is the smoke detector after the rewiring.** An electrician who rewires your house and says 'trust me' is not done; you press the test button. Every hardening batch ended with the full suite green — 42 unit tests plus 31 end-to-end steps — so a fix could not silently break the feature next door.

### Top 3 examiner questions — exact answers

**Q: "What was your most serious finding?"**
> "B-1, the refresh-token reuse detection that rolled back its own revocation. It's the nastiest class of bug — the security control exists in the code, there's even a test path for it, but the transaction boundary made it fail open exactly when it mattered. The fix separates 'revoke the family' into its own committed transaction before the 409 is raised, with the audit event written best-effort afterwards so an audit outage can never undo a revocation. You can read the whole story in the comments around `TokenService.rotate`."

**Q: "How did you prioritize eight passes' worth of findings?"**
> "By exploitability times blast radius. Anything that failed open, leaked a credential, or crossed an ownership boundary was batch 1 — 'someone can get in or see someone else's data'. Integrity and tamper-evidence was batch 2. Concurrency and robustness cleanups were batch 3. And documentation-level risks got logged with a named fix path rather than pretend-fixes. Nothing was closed because we felt like it — each closure points at a test."

**Q: "Did the audit ever produce a false alarm?"**
> "Yes, and that's worth saying out loud. The OTP overhaul initially looked like a regression source when the E2E suite hit 429s — but the limiter was doing its job: a 31-step suite from one IP legitimately exhausts a 10-per-minute auth bucket, and a real user doing password-reset + MFA + step-up in a minute would too. The honest fix was a scope-aware budget (20/min for auth, 30 for public share endpoints), not disabling the limiter. Knowing the difference between 'the system is broken' and 'the system is protecting itself' is the core audit skill."

---

## Student 6 — Deployment & DevOps

**Owns:** the build and run story — Maven `pom.xml` + the dependency fetcher (`fetch-libs.sh`), `compile-check.sh` (javac with an ECJ fallback), `run-dev.sh`, `.env` configuration and fail-fast validation, the root `.gitignore` and the mobile app's env-file setup, the demo seeder, the ExpiryScheduler, metrics/health endpoints, and the Sentry Spotlight optional tracing.

### Elevator pitch (≈ 1 minute)

> "I own getting it running — anywhere, in one command. The server is a single Java 21 process: `run-dev.sh` fetches the exact library jars from Maven Central, compiles if needed — with javac, or ECJ when only a JRE is present — then boots with a fail-fast config check: a weak JWT secret or a missing vault key stops startup with a human explanation instead of a runtime surprise. Configuration is twelve environment variables documented in `.env.example`, including the Brevo mail credentials and the MAIL_MODE switch — dev mode routes OTP codes to the log and an X-Dev-OTP header for demos, live mode sends real email through Brevo's API. Operations got real telemetry this sprint: HikariCP pool stats and Dropwizard request metrics surface on /api/health, and Sentry Spotlight tracing is one optional flag. The whole project zips to a submission with no build artifacts or local paths, and the demo seed brings up six accounts and sample documents on an empty database. Proof: from a clean clone, `bash server/run-dev.sh` plus `node mobile/e2e/run.js` — 31 green steps."

### Three layman's terms analogies

1. **Fail-fast configuration is the pre-flight checklist.** Pilots don't discover a flat tyre at cruise altitude. Our server refuses to *start* with a weak signing key or a missing vault key, and prints exactly what to run to fix it — a two-minute fix on the ground beats a mystery crash in the air.
2. **MAIL_MODE is the flight simulator switch.** In `dev` mode the OTP codes appear in the console and the response header — you can rehearse the whole two-factor flow without emailing anyone. Flip to `live` and the same code path goes out through Brevo's real email service. Same cockpit, zero risk of spamming strangers while you learn.
3. **The migration runner is the moving truck with a checklist.** It looks at which numbered boxes (V01–V11) are already in the new house, carries in exactly the missing ones, in order, once each. Fresh database or five-months-old database, one boot command brings both to the same final layout.

### Top 3 examiner questions — exact answers

**Q: "How would you deploy this to real users?"**
> "The server is a single jar with no framework: any JVM 21 host or container works. I'd run it behind a reverse proxy for TLS (the API already sets CORS per config), point DB_URL at managed PostgreSQL — we already support the Supabase pooler form — set MAIL_MODE=live with the Brevo key, VAULT_KEY from a secret store, SEED_DEMO=false (the server itself refuses demo seeds on non-localhost databases), and let the migration runner bring the schema up on first boot. Health checks already exist at /api/health."

**Q: "What stops a developer from leaking production secrets into the repo?"**
> "Three fences. First, secrets only exist in `.env` files, and a comprehensive `.gitignore` sits at the project root blocking `.env`, `target/`, `node_modules/`, `dist/`, `build/`, IDE folders (`.idea/`, `.vscode/`, `*.iml`) and OS files (`.DS_Store`, `Thumbs.db`) from ever being committed — you can verify any pattern live with `git check-ignore`. Second, `.env.example` documents every variable with placeholders that the server actively refuses — the JWT placeholder is on a blocklist (E-3) — so nobody can run with example secrets by accident. Third, the committed template files carry no real values: `mobile/.env.example` ships `YOUR_PC_IP_ADDRESS` as its placeholder. The worst case in the repo is a documented example value."

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
| Audit findings (letter-number IDs), what broke and why, regression suite | **Student 5** |
| Build, config, secrets, seeding, metrics, deployment | **Student 6** |

## The universal questions (everyone rehearses these)

- **"Why no Spring?"** — Brief constraint, owned as an advantage: a readable request path, zero magic, libraries only where wheels are genuinely hard.
- **"Proudest piece?"** — The OTP security chain: password reset, MFA fallback, step-up and gated shares, all sharing one hashed, single-use, purpose-salted code engine — with the property that no API response ever contains a credential.
- **"Weakest point?"** — Notification transport is in-app only (no email/push for expiry reminders), and the mobile session list is client-side only. Both are named, both have a fix path; neither weakens the security core.
- **"What would you build next?"** — Push notifications for expiry radar, cursor pagination for large vaults, and an object-storage backend behind the same FileVault interface.

---

# Part 2 — The system explained for absolute beginners

These eight explainers assume the reader has never written a line of code. Each one is assigned to the student who should rehearse it hardest, but every team member should be able to retell all eight. Every folder name, number and library mentioned here is real — open the folder during the defence and point at it.

## 2.1 React Hooks — the sticky notes that remember things (rehearse: Student 4)

**First, what is a "hook"?** A phone app screen is drawn hundreds of times per second — every time you tap something, the screen redraws. But a drawing has no memory: wipe it and start again, and nothing is left over. A **hook** is a sticky note that React (the drawing library) keeps beside the drawing. The screen is wiped and redrawn all day long, but the sticky notes stay on the desk, remembering things between drawings. The word "hook" literally means: your screen component *hooks into* React's memory. Three sticky notes matter in our app:

1. **`useState` — the sticky note with a magic pen.** You write a value on the note: "inbox notifications: 3". The screen copies whatever is on the note. When something happens — a new notification arrives — you call the pen that came with the note, the note now reads "4", and React *automatically redraws the screen* to show 4. You never redraw anything by hand; changing the note is the whole job. In our app every counter, form field, loading flag and error message lives on such notes.
2. **`useEffect` — the "after you finish drawing, run this errand" slip.** Drawing a screen should stay fast and dumb; the errands — fetching the document list from the server, starting a countdown timer, subscribing to a notification channel — go on the slip. React runs each errand *after* the drawing is done, and the slip has a cleanup line: when the screen is closed, the timer is stopped and the subscription cancelled, so nothing keeps running in the background like a tap left on.
3. **`usePresenter` — our own custom sticky note, the one an examiner will ask about.** DocuTrust does not let screens talk to the server directly; each screen gets a **presenter** — a plain-JavaScript "waiter" that holds the screen's brain: what to fetch, what counts as a valid form, what to show while loading, on error, on empty. `usePresenter` is the three-line glue that *hires the waiter when the screen opens* (sticky note: `presenter = new LoginPresenter()`), *passes the waiter's status onto a note* so the screen redraws as it moves idle → loading → success → error, and *fires the waiter when the screen closes* so no presenter haunts a closed screen. One hook, and 45 screens all behave the same way. **One-sentence version:** "A hook is a sticky note that remembers things between redraws; `useState` remembers a value, `useEffect` remembers an errand to run after drawing, and our `usePresenter` remembers to hire — and later fire — the screen's waiter."

## 2.2 The overall architecture — the customer, the waiter, the kitchen (rehearse: Student 1, but everyone)

DocuTrust is a restaurant with three rooms. The **customer** is the mobile app on your phone (built with React Native and Expo). It is good-looking and polite, but it has no kitchen: it cannot store your documents, check passwords or decide who may see what. It only *orders*.

The **waiter** is the backend server — a single Java program. Every wish from the customer ("show my documents", "share file X until Friday", "email me a login code") is spoken to the waiter, never shouted into the kitchen. The waiter does four things, always in order: checks you are who you claim to be (a digital ID card called a JWT — see Student 2), checks you are allowed to order that (role and ownership rules), walks the order into the kitchen, and carries the plated result back on a standardized tray (a JSON envelope — see 2.8). Our restaurant has exactly **71 dishes on the menu** (the 71 registered API routes — the number is printed when the server boots, so it is checkable).

The **kitchen and pantry** are the services and the PostgreSQL database. The chefs (the service code: `DocumentService`, `ShareService`, `OtpService`…) do the real cooking — encrypting files, minting share links, hashing one-time codes. The pantry is the database: fifteen filing drawers (tables) that remember every document, user, share link and audit entry. The pantry has a strict head clerk: it refuses orders that break the house rules even if the chef made a mistake (CHECK constraints, foreign keys, append-only triggers — see 2.5). **Why three rooms?** So each can be fixed alone: we rebuilt the entire OTP flow inside the kitchen and the customer barely noticed — only the ordering script changed. **One-sentence version:** "The app is the customer, the server is the waiter with 71 things on the menu, the database is the pantry — and no room ever walks into another room uninvited."

## 2.3 The frontend folders — it's like a smartphone (rehearse: Student 4)

Open `mobile/src/` and you see seven folders. The easiest way to explain them: **the app is a smartphone, and each folder is a part of the phone.**

- **`screens/` are the different apps you open.** Forty-five of them: a Login app, a Documents app, a Trash app, a Share app… Each screen is one full-page view the user sees. They are deliberately dumb — they draw what they're told and forward taps, like an app that only shows what its data says.
- **`components/` are the buttons on the screen.** Small reusable pieces — a document card, a password input, a toast pop-up, a loading skeleton — drawn once and used on many screens. If screens are apps, components are the physical buttons and icons shared by every app, so the whole phone feels consistent.
- **`microservices/` are the invisible background processes that fetch your data.** Nine folders (auth, documents, folders, sharing, verification, notifications, org, profile, admin), one per feature area. Each holds that domain's *api* files (how to ask the waiter), *model* files (what the data looks like) and *presenter* files (the screen's brain). The user never sees these; like background processes, they do the fetching and deciding. **Why separated?** So six students could work at once without stepping on each other — the sharing student re-wrote her whole OTP-gating flow and never touched the documents folder.
- **`navigation/` is the home-screen gesture.** The app switcher: which app opens when you tap what, and what the back gesture does.
- **`mvp/` is the house rulebook** — `BasePresenter` and `usePresenter` (see 2.1) that every screen's waiter follows.
- **`core/` is the phone's settings** — the server address, the design tokens (colours, spacing), shared helpers.

**One-sentence version:** "Screens are the apps you open, components are the buttons on them, microservices are the invisible background processes fetching the data — and navigation is the home gesture that moves between apps."

## 2.4 The backend folders — a well-organized restaurant (rehearse: Student 1)

Open `server/src/main/java/com/docutrust/` and you see the restaurant's staff chart. **The `controller` folder is the waiters taking orders** — ten of them (`AuthController`, `DocumentController`, `ShareController`…), one per section of the menu. A waiter's job is narrow on purpose: receive the order, check the ID, hand it to the kitchen, carry the plate back. Waiters never cook.

**The `service` folder is the chefs cooking** — the real logic: hashing one-time codes, encrypting files, enforcing share rules. Chefs never talk to the customer directly; that's the waiter's job. This split is why we could swap the recipe for password resets (from "send a temporary password" to "send a one-time code") without changing a single waiter.

**The `db` folder is the pantry and the head clerk** — `Database` (the walk-in cooler connection), `Migrator` (the 11 numbered instruction sheets that build the pantry from scratch), `Rows` and `Tx` (the rules for reading a shelf and for all-or-nothing orders). The `vault` folder is the restaurant safe — files are encrypted there with AES-256-GCM, a standard so strong it's used by banks.

**The `auth` folder is the ID checkers at the door** — `PasswordService` (checks your password without ever knowing it — it only compares scrambled fingerprints), `TokenService` (prints and re-prints your session wristband), `MfaService` (the second-proof checker), `RateLimiter` (the bouncer who says "too many tries, wait a minute"). **The `http` folder is the uniforms and order pads** — `Router` (the 71-item menu index), `Middleware` (the security chain every order passes), `Ctx` (the standard order-slip format). Plus `config` (the manager's opening checklist — refuse to open with weak keys), `infra` (the office dashboard showing pool and traffic stats), `model` (the standard plate shapes), `util` (the toolbox). **Why separated?** Same reason as the kitchen: a new chef can be hired without retraining the waiters, and during the OTP overhaul we rewrote chefs (`OtpService`, `MailService`) while the waiters and the pantry never changed. **One-sentence version:** "Controllers are the waiters taking orders, services are the chefs cooking, db is the pantry, auth checks IDs at the door — and no waiter ever walks into the pantry himself."

## 2.5 The database — a highly organized filing cabinet (rehearse: Student 1)

A **relational database** is a filing cabinet with strict rules, and PostgreSQL — the one we chose — is the strictest, most trusted cabinet on the market. The cabinet has **15 drawers (tables)**: `users`, `documents`, `document_versions`, `shares`, `email_otps`, `audit_logs`, and so on. (Peek with `\dt` and you'll see a 16th — `schema_migrations` — but that's not one of ours: it's the moving truck's own clipboard, where the migration runner writes down which numbered instruction sheets it already delivered.) Inside each drawer are **index cards (rows)** — one card per user, per document, per share link. Each card has the same **printed fields (columns)**: a user card always has name, email, role, created-at. You never find a hand-scribbled card with a different shape — the drawer's form is fixed when the drawer is built.

**A foreign key is a cross-reference written on the card.** A document card says "owner: see card #42 in the USERS drawer." The clerk refuses to file a document whose owner card doesn't exist, and (by our setting) refuses to destroy a user card while documents still point at it. That is what "relation" means: the cabinet itself guarantees the references make sense, so a typo or a bug can't create an orphan.

**Why PostgreSQL, in plain words?** Four reasons. (1) It *enforces rules* — a CHECK constraint is a house rule the clerk applies even to the boss: a medical document physically cannot become "active" without review, no matter what buggy code asks for. (2) It *keeps honest history* — we added automatic triggers so audit cards cannot be edited or torn out, only appended. (3) It is *free, battle-tested for 25+ years, and runs everywhere* — including Supabase, a free cloud host for it, so our project costs nothing to run. (4) It speaks a standard language (SQL) that every one of us could write. The cabinet is assembled from **11 numbered instruction sheets (migrations)** — V01 builds the users drawer, V10 adds the email-OTP drawer, V11 adds three fields to shares — so any team member can rebuild the identical cabinet from nothing, in order, in minutes. **One-sentence version:** "Tables are drawers, rows are index cards, foreign keys are cross-references the clerk refuses to break — and PostgreSQL is the strict, free, 25-year-old cabinet that enforces our house rules even against bugs."

## 2.6 The server — a 24/7 receptionist answering phones (rehearse: Student 6)

What *is* a web server? It is a program that never sleeps, sitting by a phone that never stops ringing. Ours is one single Java process. Its day looks like this: the phone rings (a request arrives from the app); the receptionist picks up **within milliseconds, always** — it doesn't matter if it's one call or fifty at once; it asks "who's calling?" and checks the caller's ID card (the JWT; no card or a fake card → politely refused, "401"); it looks up the requested department in its directory of **71 extensions** (the router — and anything unknown gets a clean "no such extension", a 404, never a crash); it walks the request to that department and carries the answer back, always on the same standardized tray (a JSON envelope, with a rubber stamp saying how it went — see 2.8).

Three more duties make ours a *good* receptionist. It **writes down every call** — one line per request (what was asked, when, how long it took), and every security-relevant event into an append-only audit book that even the boss cannot tear pages from. It **limits repeated callers** — a caller asking for a password reset eleven times a minute gets told to wait (rate limiting), which is how the system shrugs off people who try to guess codes. And it **refuses to open the office with broken locks** — at start-up it checks its own keys and configuration, and if the signing key is weak it refuses to start and prints exactly what to fix (fail-fast). It has been awake since boot, on any laptop, for months. **One-sentence version:** "A web server is a 24/7 receptionist: answers every call instantly, checks IDs, forwards to one of 71 departments, writes down everything, and never hangs up rudely."

## 2.7 The tech stack — what we chose and why, in plain words (rehearse: Student 6)

| Technology | What it is, in plain words | Why we chose it |
|---|---|---|
| **Java 21** | The language of the server — one recipe book, runs on any machine with a "Java reader" installed | The brief forbids frameworks, and Java is a 25-year-old workhorse: strict (mistakes are caught before running), fast, and every one of us had read it. Version 21 is a long-term-support release — the "sturdy, supported for years" edition |
| **PostgreSQL** (hosted free on **Supabase**) | The filing cabinet (see 2.5) | Strictest rule enforcement, free cloud hosting, 25+ years of trust. Supabase is just "PostgreSQL with a free landlord" |
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
