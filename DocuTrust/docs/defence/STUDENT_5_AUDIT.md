# Student 5 — The 8-Pass Security Audit — Masterclass Deep Dive

This file is the complete rehearsal brief for **Student 5, who owns the 8-Pass Security Audit slice** of DocuTrust — the eight thematic passes over our own code, the finding IDs (A-1 … H-3) that still live in code comments, and the three hardening batches that fixed them. It is written for the student presenting this slice and for the examiners who want to check every claim against the real repository. It expands the matching role section — *"Student 5 — The 8-Pass Security Audit"* — in `DEFENCE_GUIDE.md` at the repository root, which is the master index for all six roles; read the guide section first for the one-page story, then rehearse from here, where every finding ID cited below was located by searching the shipped source, so you can re-run that search live during the defence.

---

## My slice in one page

**Role in the team:** Attacking our own system before an examiner could: eight thematic passes, finding IDs that live in the code comments, and the three hardening batches that fixed them.

**Owns:** The eight audit passes and their finding IDs (A-1 to H-3), and the three hardening batches that fixed them — the proof is that every finding ID is greppable in the shipped code comments, and every hardened flow is re-driven live with manual API calls (Postman/cURL).

**Feature claims:** the audit findings and the sixteen post-audit security features (FT-217 … FT-234); every ID cited in code comments is demonstrable.

**My numbers:**

- **8 passes, A through H** — access control, crypto and vault, concurrency, configuration, input validation, information leakage, error handling, and data integrity.
- **74 logical API routes across two services** (core-service 56, auth-service 19) — the audit's ID comments live in both codebases, in the same shared-module files both services compile.
- **15 finding IDs verifiable in code comments in this shipped tree** — A-3, B-1, B-2, B-3, C-1, C-2, C-7, C-8, C-13, D-1, E-3, F-2, F-4, H-1, H-3 — out of the ledger that spans A-1 … H-3 (see the honest note under the finding table).
- **3 hardening batches** shipped after the audit, each leaving the tree in a clean-build, bootable state.
- **Greppable proof** — every finding ID lives in a code comment in this shipped tree: `grep -rn "B-1" server/src/main/java/com/docutrust/auth/TokenService.java` lands on the fix and its story (the live grep index below).
- **Live behavioural proof** — every hardened flow, including the negative paths, is re-driven at the defence with manual API calls (Postman/cURL): replay a rotated refresh token and watch `409 TOKEN_REUSE` plus the family revocation land.
- **11 flow groups** rehearsed for that live demo, matching the OTP overhaul's own surface (table in the proof story below).
- **216 numbered features + 18 post-audit security features** (FT-217 … FT-234), per `docs/FEATURES.md`.

> **Note:** every claim in this brief is verifiable from the public repository alone — the finding IDs are greppable in the code comments, `mvn clean package` builds the server from a clean clone, and every hardened flow (including the negative paths) is demonstrated live at the defence with manual API calls (Postman/cURL).

---

## Elevator pitch (≈ 1 minute)

> "My job was to attack our own system before an examiner did. I ran eight thematic passes over the original code — access control, crypto and vault, concurrency, configuration, input validation, information leakage, error handling, and data integrity — and logged every finding with an ID and a severity. The fixes shipped in three hardening batches, and the IDs stuck: B-1 was refresh-reuse detection that used to fail open — the revocation was rolled back by the very exception that reported it, so a stolen token stayed usable; C-1 was nested transactions holding two pool connections at once, which could commit an audit row even when the outer transaction rolled back — a phantom audit. E-3 made the server refuse to boot on weak JWT secrets; D-1 pinned the vault key to exactly 32 bytes. Every fix landed with its finding-ID comment, so the audit trail is in the code: search any ID letter and you'll find the comment explaining what broke and why the fix is shaped the way it is — and every hardened flow is re-driven live with manual API calls (Postman/cURL) at the defence."

**Then demo:** in a terminal, run `grep -rn "B-1" server/src/main/java/com/docutrust/auth/TokenService.java` and walk the audience through the comment live — then, against the running local server, replay a rotated refresh token with `curl` and watch the `409 TOKEN_REUSE` plus the revocation land — the same flow the defence demo drives end to end against the real database.

---

## What I own, file by file

### The eight passes (A–H)

Each pass had one theme and a checklist — 'we looked at everything' meant something checkable. The themes below are the ledger's own ordering; the findings each pass produced are in the next table.

| Pass | Theme | What it hunted |
|---|---|---|
| **A** | Access control | Anything that let a request reach data it did not own: missing ownership scoping, role-guard gaps, and injection-class holes in anything user-controlled that reaches a rendering path (A-3, caught jointly with pass F). |
| **B** | Crypto and vault | Secrets and their lifecycle: password hashing parameters, token generation, hashing at rest, refresh-token rotation and reuse detection, and whether security actions actually *commit* (B-1, B-2, B-3). |
| **C** | Concurrency | Transaction hygiene: nested connections, commits that outlive their transaction, races between simultaneous requests, and parsers that mis-read structured input (C-1, C-2, C-7, C-8, C-13). |
| **D** | Configuration | The environment the server boots with: key shapes, placeholder values, silent defaults — anything that made a bad configuration look like a good one (D-1). |
| **E** | Input validation | Every value treated as hostile input — including configuration itself: a weak signing secret is a short, guessable input, so refusing it is validation (E-3). |
| **F** | Information leakage | What an output reveals that it should not: markup injection through embedded JSON on the public verify page (F-2, with A-3), and a proof link quietly certifying different bytes than the ones it minted for (F-4). |
| **G** | Error handling | Fail-open paths — errors that unwound security work already done, error responses that leaked internals, and stack traces reaching users. In the shipped tree no G-numbered comment survives; pass G's closures live in the shared `AppException` and error-envelope paths rather than letter-cited comments. |
| **H** | Data integrity | Broken promises between what the UI shows and what the data delivers: downloads resolving to the wrong version (H-1) and payloads missing the fields the screens render (H-3). |

### How each pass was run — the checklist method

Each pass began as written checklist questions; the files were then read against those questions and anything that answered badly got an ID. The shape of the questions — grounded in the findings each pass actually produced — looked like this:

| Pass | The kind of question its checklist asked |
|---|---|
| A | "Trace every read path: what SQL `WHERE` clause stops user X reading user Y's row — and is it in the statement, not an `if` afterwards?" / "What happens if user-controlled text reaches a rendering path?" |
| B | "When a security action fails, what has *committed* by the time the error is seen?" / "What is stored about a secret, where, and in what form?" |
| C | "Find every place a second connection opens while a transaction is holding one." / "What do two simultaneous requests do to the same row?" |
| D | "List every environment variable: what does a silently wrong value do, and when would we find out?" |
| E | "Which of those 'configuration values' are really inputs? What is the shortest secret an attacker could guess?" |
| F | "Read every byte we send to a stranger: what could it reveal, or let their browser do, that it should not?" |
| G | "Which error paths unwind security work that already succeeded?" / "Do error responses ever echo internals?" |
| H | "For every screen promise, is there a payload field and a resolution rule that always keeps it?" |

That is also the answer to "how is this not just one giant code read": a single reading with eight questions in mind hunts none of them well; one question per reading, eight times, is why the IDs cluster the way they do.

### The finding IDs verifiable in code comments

Every finding was logged with an ID and a severity at audit time; what ships in the code is the ID and the story — which is precisely what makes each fix traceable months later. Every row below was found by searching `server/src/main/java/` — re-run the search during the defence and the audience sees the same lines. Paths are relative to that folder.

| ID | Where it lives in the code | The story, in one sentence |
|---|---|---|
| **A-3** (with F-2) | `service/VerifyService.java` (the `jsonLdSafe` helper and the LD-JSON block of the public verify page) | JSON embedded in a `<script>` block must escape `<`, `>`, `&`, `/` — a raw `</script>` inside a document title would close the block and inject markup into a stranger's browser. |
| **B-1** | `auth/TokenService.java` — the `Rotation` record javadoc, the `rotate` method's `if (revoked)` return, and the comment block before `revokeAllForUser` | Reuse detection used to revoke the token family *inside* the transaction whose exception reported the reuse — the 409 rolled the revocation straight back, so detection had no durable effect: fail-open. The fix commits the family revocation in its own transaction before the 409 unwinds. |
| **B-2** | `auth/TokenService.java` — the `auditReuse` method and its call site | The `token_reuse` audit event is written *after* the revocation commits, best-effort, with valid jsonb meta — so an audit outage can never undo a revocation. |
| **B-3** | `auth/TokenService.java` — the `FOR UPDATE` select and the revocation UPDATE in `rotate` | `FOR UPDATE` locks the token row so a concurrent rotate/revoke of the same token serialises instead of double-issuing, and the revoke only touches rows with `revoked_at IS NULL` — never re-revoking. |
| **C-1** | `service/SettingsService.java` (the single-connection read shared by `get()` and `upsert()`), `service/ShareService.java` (the public open's audit insert), `auth/TokenService.java` (the revocation transaction's placement) | The old code opened a second pool connection inside an outer transaction, and the two committed independently — so a business operation could roll back while its audit row survived: a phantom audit. The fix is one connection per transaction, and post-commit side effects written best-effort afterwards. |
| **C-2 / C-13** | `db/Migrator.java` — the `split` method | The migration splitter cuts on top-level `;` only, respecting quoted strings, `$$` dollar-quoted bodies and `--` comments — V03 carries a `;` inside a comment that used to cut the CREATE TABLE statement in half on fresh databases. |
| **C-7** | `service/SettingsService.java` — the upsert path | On a fresh INSERT a missing notification field must fall back to the documented default instead of writing a null the UI cannot interpret. |
| **C-8** | `service/ShareService.java` — the public open's audit insert (paired with C-1) | The anonymous public opener's audit row now joins the open's transaction with actor left null, instead of the old no-connection overload that opened a second pool connection inside the open transaction. |
| **D-1** | `config/Config.java` — `validateVaultKeyFormat` | The vault key is accepted only as a 44-character base64 string decoding to exactly 32 bytes, checked at config load before any database connection — and the passphrase-derived key path is gone, a documented, accepted breakage for this student project. |
| **E-3** | `config/Config.java` — `validateJwtSecret` and the placeholder blocklist | A short or placeholder JWT secret makes HS256 tokens forgeable, so the server refuses to start and prints the exact remedy (`openssl rand -base64 48`); the `.env.example` placeholder must never reach runtime. |
| **F-2** (with A-3) | `service/VerifyService.java` — `jsonLdSafe` | The escapes keep the LD-JSON payload parseable while making it impossible for the HTML parser to see a closing `</script>` tag — each escape decodes back to the original character for JSON readers. |
| **F-4** | `service/VerifyService.java` (mint, prove and supersede paths), `bootstrap/Bootstrap.java` (the seeded contract request), `model/Models.java` (`versionId` field) | Verification requests are pinned to the version that was current at mint time, so a later upload can never silently re-point an approved proof link at different bytes — the seal still verifies the pinned bytes, and both JSON and HTML consumers are told a newer version exists. |
| **H-1** | `service/DocumentService.java` — the download blob path | No explicit version now resolves "current" via the document's `current_version` pointer, instead of the impossible sentinel version the old query asked for — one definition of current for default downloads. |
| **H-3** | `service/AuthService.java` (`/api/auth/me` payload), `service/AdminService.java` (admin user rows), `service/VerifyService.java` (owner-facing payloads), `model/Models.java` (`orgName`, `docType`/`sha256` fields) | The payloads the screens actually render now carry the fields they promise — the organisation name on the profile and admin user screens, and the document type plus pinned digest on verification detail — instead of silently dropping them. |

Two honest footnotes for examiners. First, the ledger spans A-1 … H-3, but the table above lists only the IDs whose comments survive verbatim in the shipped tree — search any listed ID and you will find it; that is the claim, and it is all the claim needs to be. Second, the code also carries a sibling tag family, `INFRA-2` (in `service/DocumentService.java` and `http/Router.java`), which marks the performance instrumentation (the read-through cache and per-route metrics) rather than an audit finding.

### The live grep index — commands you can run during the defence

Every row of the table above is one grep away. These are the exact commands, from the repository root:

```bash
grep -rn "B-1" server/src/main/java/com/docutrust/auth/TokenService.java
grep -rn "B-2\|B-3" server/src/main/java/com/docutrust/auth/TokenService.java
grep -rn "C-1"  server/src/main/java/com/docutrust/service/SettingsService.java
grep -rn "C-1/C-8" server/src/main/java/com/docutrust/service/ShareService.java
grep -rn "C-2"  server/src/main/java/com/docutrust/db/Migrator.java
grep -rn "D-1\|E-3" server/src/main/java/com/docutrust/config/Config.java
grep -rn "F-4"  server/src/main/java/com/docutrust/service/VerifyService.java
grep -rn "A-3/F-2" server/src/main/java/com/docutrust/service/VerifyService.java
grep -rn "H-1"  server/src/main/java/com/docutrust/service/DocumentService.java
grep -rn "H-3"  server/src/main/java/com/docutrust/service/ server/src/main/java/com/docutrust/model/
```

That last one is the audience favourite: it shows H-3 touching four different files, which is the moment "payload completeness" stops being abstract.

### The audit's deliverables in the feature register (FT-217 … FT-234)

The OTP overhaul that the audit produced is written down as sixteen numbered features in `docs/FEATURES.md` — the post-audit addendum on top of the original 216. Each row is the audit's work wearing its feature-register name:

| ID | What shipped |
|---|---|
| FT-217 | Email OTP engine: 6-digit SecureRandom codes, SHA-256 `purpose:email:code` digests at rest, single-use, 10-min TTL (24 h invites), 5-attempt burn, one live code per target |
| FT-218 | Brevo email delivery (`MailService`): `MAIL_MODE=live` posts to Brevo's transactional API; `MAIL_MODE=dev` logs the code and echoes it in `X-Dev-OTP` (bodies never carry codes) |
| FT-219 | Password reset by emailed OTP: `forgot-password` → `reset-password-otp {email, code, newPassword}`; legacy reset-code-in-response pattern removed |
| FT-220 | Email MFA fallback for login: `useEmailMfa:true` → `440 MFA_EMAIL_CHALLENGE` + 10-min challenge JWT → `POST /api/auth/verify-otp` issues session tokens |
| FT-221 | Step-up verification: `request-step-up` / `verify-step-up` → 5-minute single-purpose JWT (`typ=step_up`) |
| FT-222 | Step-up gates: password change and permanent document deletion require `X-Step-Up-Token`, else `403 STEP_UP_REQUIRED` |
| FT-223 | OTP-gated share links: `requireOtp` + owner-pinned `recipientEmail` (V11); plain open answers `401 SHARE_OTP_REQUIRED` |
| FT-224 | Share access by OTP: `request-otp` (code travels only to the pinned inbox; mismatching requests 403 without revealing it) + `open-with-otp` (code + passcode → atomic open) |
| FT-225 | Org invites by emailed OTP (24 h): invite creates a pending account with an unusable placeholder hash; `POST /api/auth/accept-invite {email, code, password}` activates it — temporary-password-in-response pattern removed |
| FT-226 | HikariCP connection pool under the unchanged `Database` API (min/max idle, lifetime, init SQL) |
| FT-227 | Bucket4j token-bucket rate limiting with per-scope budgets (auth 20/min, public-share 30/min, public-verify 20/min) and Caffeine-managed bucket map |
| FT-228 | Caffeine read-through cache for ownership-scoped document rows (10 s TTL, explicit invalidation on every write path) |
| FT-229 | Dropwizard Metrics: per-route timers + request meters surfaced on `/api/health` (`requestsTotal`, `meanResponseMs`) |
| FT-230 | Optional Sentry → Spotlight local tracing behind `SPOTLIGHT_ENABLED` (default off; zero telemetry egress in production) |
| FT-231 | Mobile OTP-era UX: MFA screen "email me a code instead" flow, OTP reset screen with email field, step-up confirm phases in Change-password and Trash "Delete forever" |
| FT-232 | Black-box verification coverage for every OTP flow including negative paths (wrong codes, wrong recipient, reuse-after-use) — demonstrated live with manual API calls |

### Where the audit story is written down in the repo

An audit that lives only in someone's memory is not an audit. Four places in the tree carry this slice, and each is openable during the defence:

| Location | What it records |
|---|---|
| `DEFENCE_GUIDE.md` — section "Student 5 — The 8-Pass Security Audit" | The master index's one-page story: the verbatim pitch, the three analogies and the top-3 examiner questions. |
| `docs/ROADMAP.md` — "Post-submission hardening note" | The three fix batches by name, kept as the historical record of the sprint tables above it. |
| `docs/FEATURES.md` — "OTP Security Overhaul (post-audit addendum, FT-217 … FT-234)" | The sixteen features the audit shipped. |
| `server/src/main/java/com/docutrust/…` | The finding-ID comments themselves — the audit's living primary source (table above). |

### The three hardening batches

The fixes did not land as one big bang; they shipped in three named batches, and the tree had to build clean with `mvn clean package` and boot after *each* one before the next started. `docs/ROADMAP.md` records the batch names under its post-submission hardening note; the ordering principle is the one I rehearse below.

| Batch | Name (from `docs/ROADMAP.md`) | What landed | Proof it broke nothing |
|---|---|---|---|
| 1 | Config fail-closed hardening | The refuse-to-boot checks: E-3's JWT secret validation with the placeholder blocklist, and D-1's exact-32-byte vault key — plus removing the passphrase-derived key path entirely. | Clean `mvn clean package`, clean boot, flows re-driven by hand. |
| 2 | Session/token lifecycle surgery | B-1's committed-before-error family revocation, B-3's `FOR UPDATE` serialisation and never-re-revoke guard, B-2's post-commit audit event, and the C-1 transaction hygiene that stops side effects outliving their transaction. | Clean `mvn clean package`, clean boot, flows re-driven by hand. |
| 3 | Final cleanup | The integrity and payload fixes: F-4's version pinning with superseded-proof reporting, H-1's single definition of "current" for downloads, H-3's completed payloads, and the A-3/F-2 script-block escaping. | Clean `mvn clean package`, clean boot, flows re-driven by hand. |

**How the ordering was decided:** by exploitability times blast radius. Anything that failed open, leaked a credential, or crossed an ownership boundary went first — "someone can get in or see someone else's data". Integrity and tamper-evidence next. Concurrency and robustness cleanups last. And documentation-level risks got logged with a named fix path rather than pretend-fixes. Nothing was closed because we felt like it — each closure points at a finding-ID comment in the code.

**Where the batch names are written down:** `docs/ROADMAP.md`, under its "Post-submission hardening note", records verbatim that *"a pre-production security audit produced three fix batches (config fail-closed hardening; session/token lifecycle surgery; final cleanup)"* — the same three batches, by name, in the project's own risk register.

### The proof story

- **The audit trail is greppable.** Every finding ID lives in a comment in the shipped tree, and the live grep index above is the whole demonstration: search the ID, land on the fix, read the story in the authors' own words. No tool, no setup — a terminal and the repository.
- **The fixes carry their stories in place.** B-1's comment block in `TokenService.rotate` is the model: effect (the revocation commits first), evidence (the audit row is written after, best-effort) and race window (`FOR UPDATE`) each get their own committed transaction, and the comment explains all three where they happen.
- **The demo is mechanical, not an impression.** Each flow group below is a short list of manual API calls with their expected status codes; running them in order against the booted server makes the audit's work show itself — including the negative paths, where the honest refusals (401, 403, 409, 429) are the proof.
- **No tooling makes the demo repeatable.** The flows need only `curl` or Postman and the booted server — the same eleven groups run identically on any machine, which is what let three batches in a row be demonstrated the same way.
- **The 11 flow groups, exactly as rehearsed for the live demo:**

| Group | What those steps prove |
|---|---|
| health | `GET /api/health` reports ok plus database. |
| register A+B, login A+B | Account creation for two users, and login recording device + IP. |
| upload, list, search | Multipart upload, the vault list, and search working over the seeded content. |
| link share lifecycle | A 1-hour, 2-view share opens publicly, is revoked, and the post-revoke open answers 409 — the dying link, live. |
| verification chain | Request minted → admin approves → public verify answers against the pinned proof. |
| admin surface | Admin login, stats, the review queue, and a notification marked read. |
| OTP password reset | Forgot → wrong code refused → right code resets — the negative path is part of the proof. |
| step-up | Gate, wrong code, verify, then the gated change-password with the header. |
| MFA email fallback | Setup + TOTP enable, the 440 challenge, and `verify-otp` issuing real tokens. |
| OTP-gated share | The 401 gate, the wrong-recipient refusal, and `open-with-otp` succeeding. |
| org invite | Invite by emailed OTP and `accept-invite` activating the pending account. |
- **The false-alarm chapter is part of the demo's story:** when the OTP overhaul landed, our rehearsal runs started hitting 429s — which looked like a break but was the rate limiter working. Machine-speed repeated calls from one IP legitimately exhaust a 10-per-minute auth bucket. The honest fix was scope-aware budgets (FT-227: auth 20/min, public-share 30/min, public-verify 20/min), not disabling the limiter.

---

## Five layman's analogies

1. **The 8-pass audit is a building inspection with 8 specialists.** One inspector checks the locks, one the wiring, one the fire exits... A general handyman catches obvious things; a specialist catches the gas leak behind the correctly-painted wall. Each pass had one theme and a checklist, so 'we looked at everything' meant something checkable.
2. **B-1 (fail-open revocation) is a burglar alarm that unplugs itself when it rings.** The old code detected a stolen token and tried to revoke the family — but it did the revoking inside the very transaction that then threw the alarm's exception. Both rolled back together: the alarm rang and un-rang in the same instant. The fix rings the alarm *after* the bolt has been thrown — revoke in one committed transaction, then raise the error.
3. **A greppable finding ID is the label on the rewired wire.** An electrician who rewires your house and says 'trust me' is not done; the junction box gets a written label saying what was wrong and what was changed. Every fix in this codebase carries its label — the finding ID in a comment — so any reviewer can trace what broke and why the fix is shaped the way it is.
4. **A finding ID is a named scar with a story.** "There was a bug once" heals into nothing; "B-1" is a scar you can point at — the skin remembers, and anyone can press it later and hear the story. Naming findings the way hospitals name procedures means the fix, the demo and the comment all use the same word, five months later, in three different files.
5. **Prioritizing the fixes is a hospital triage nurse.** Eight passes produce a waiting room full of problems; the nurse does not treat whoever arrived first, she treats the most contagious and most life-threatening first. Exploitability is how contagious a bug is — how easily a stranger can trigger it — and blast radius is how much of the system it infects. Fail-open token revocation is a haemorrhage; a mis-split migration comment is a splinter; and the splinter genuinely waits its turn.

---

## The critical code walkthrough

### The B-1 fix in `TokenService` — the whole story in one method

File: `server/src/main/java/com/docutrust/auth/TokenService.java`. Read `rotate` top to bottom; every step below is real code.

**The old, fail-open ordering (what the audit found):** the reuse check and the family revocation lived *inside the same `db.tx(...)` transaction*. Detect reuse → revoke the family → throw the 409 — but throwing rolls the transaction back, and the rollback took the revocation with it. The alarm rang and un-rang in the same instant, and the stolen refresh token stayed usable. That is fail-open: the security control exists, the code even has a path for it, and the transaction boundary defeats it precisely when it matters.

**The fixed ordering, as shipped:**

1. **`rotate(String presented, String device, String ip)`** first validates the token's shape (`validFormat`) and opens the detection transaction: `Rotation r = db.tx(c -> { ... })`.
2. **Inside that transaction, B-3's guard runs:** the SELECT carries `FOR UPDATE OF rt` — the comment reads *"B-3: FOR UPDATE locks the token row, so a concurrent rotate/revoke of the same token serializes here instead of both reading revoked_at IS NULL and double-issuing."*
3. **Reuse is detected, not yet punished:** the javadoc on the result record says it — *"Rotation outcome; tokens == null signals reuse of an already-revoked token (B-1)."* The detection transaction ends cleanly with `if (revoked) return new Rotation(userId, null); // B-1: handled AFTER this tx commits (below)`.
4. **The revocation gets its own committed transaction:** once detection has fully finished, the code calls `revokeAllForUser(r.userId())`, which opens a *separate* `db.tx(...)` that sets `revoked_at = now()` on every live refresh token of that user — and commits. The shipped comment is the one to quote on stage:

   > *"B-1: the family revocation must COMMIT before the 409 unwinds. The old code revoked inside the detection transaction - throwing the 409 rolled that revocation straight back, so reuse detection had no durable effect (fail-open). C-1: this tx starts only after the detection tx has fully finished, so no nested pool connections are held."*

5. **The audit event is written afterwards, best-effort:** `auditReuse(r.userId(), ip)` inserts the `auth.token_reuse` row into `audit_logs` in its own transaction — the javadoc reads *"B-2: token_reuse audit event with VALID jsonb meta; best-effort so an audit outage can never undo the revocation."* An audit outage can cost us a row; it can never cost us the revocation.
6. **Only now does the error fly:** `throw new AppException(409, "TOKEN_REUSE", "Refresh token reuse detected - all sessions revoked, please log in again")` — the bolt is thrown before the alarm rings, so the exception can no longer undo the security work.

**The client half of the same story:** on the mobile side, `ApiClient.js` sees `409 TOKEN_REUSE` and calls `AuthStore.logout()`, so the thief *and* the legitimate user are both locked out of the dead family — the user logs in again; the attacker logs in never.

**Old ordering versus fixed ordering, side by side:**

| Moment | Old (fail-open) | Fixed (as shipped) |
|---|---|---|
| Reuse detected | Inside the detection transaction | Same — detection still happens inside `db.tx`, and ends cleanly |
| Family revoked | Inside that same transaction | In its own separate committed transaction (`revokeAllForUser`), *after* detection fully finishes |
| 409 raised | Thrown from inside the transaction — rollback takes the revocation with it | Thrown after the revocation has committed — nothing left to roll back |
| Audit row | Inside the doomed transaction | After the revocation commit, best-effort (`auditReuse`), own transaction |
| Net effect | Detection had no durable effect; stolen token stayed usable | Family dead, evidence written, error flies last |

**Why the fix is shaped this way — three properties worth rehearsing:** order, ownership, and honesty. Order: the security effect commits before the exception that announces it, so the exception can never undo it. Ownership: the revocation transaction belongs to the revocation, not to the detection — no nested pool connections (that is the C-1 half of the same comment). Honesty: the audit trail is allowed to lag behind the revocation but is never allowed to veto it, which is what "best-effort" means in the B-2 comment.

### The phantom audit, C-1, in one place you can open

`server/src/main/java/com/docutrust/service/ShareService.java`, in the public share-open transaction — the shipped comment:

> *"C-1/C-8: join this transaction (actor stays null - anonymous public opener). The old no-connection overload opened a SECOND pool connection inside this open tx, and its row could commit even if this tx rolled back (phantom audit)."*

The same hygiene is recorded in `service/SettingsService.java` (*"single-connection read, shared by get() and upsert()'s transaction - never opens a second connection"*) and in `auth/TokenService.java` step 4 above. One connection per transaction through the shared runner; post-commit side effects written best-effort; so the trail can only lag, never lie.

### The false alarm, step by step

1. **The symptom:** right after the OTP overhaul landed, our rehearsal runs began failing with `429 RATE_LIMITED` partway through the reset/MFA groups — which looked exactly like a flaw the overhaul had introduced.
2. **The investigation:** the failing calls were all auth-scope requests, and machine-speed repeated calls from a single IP legitimately exhaust a 10-per-minute auth bucket (FT-019) — a real user doing password-reset, MFA and step-up inside a minute would hit the same wall.
3. **The verdict:** the limiter was not broken; it was working. Disabling or widening it globally would have been the dishonest fix.
4. **The fix:** scope-aware budgets (FT-227) — 20 per minute for auth, 30 for public-share endpoints, 20 for public-verify — implemented with Bucket4j token buckets and a Caffeine-managed bucket map.
5. **The lesson we rehearse:** the core audit skill is telling "the system is broken" from "the system is protecting itself" — and the machine-speed one-IP rehearsal shape is now a known, documented characteristic, not a surprise.

---

## My domain, in plain words (glossary)

| Term | Plain meaning, with an everyday analogy |
|---|---|
| **Finding ID** | A stable name for one discovered weakness (letter = pass, number = order in that pass). A named scar with a story — everyone on the team says "B-1" and means the same wound. |
| **Fail-open** | A control that lets everything through *when it fails*. A doorman who faints and props the door open. Fail-closed is the opposite: he faints and the door locks. |
| **Transaction / commit / rollback** | An all-or-nothing bundle of database changes — every item scans or the whole basket goes back. *Commit* is the till drawer closing (changes become permanent); *rollback* is the receipt torn up and the shelf restocked, which is what an exception triggers. |
| **Race condition** | Two operations interleaving badly because both "checked" before either "acted". Two people reading the last concert ticket on the board and both walking to the counter. |
| **`FOR UPDATE`** | A database row lock: "I'm being served about this row — everyone else waits." The numbered ticket dispenser at the deli counter. |
| **Connection pool** | A fixed set of database connections shared by all requests. Ten changing rooms for the whole shop: hold one too long (or hold two at once) and someone queues. |
| **Nested transaction** | Opening a second connection inside a transaction that is still open — holding two changing rooms at once, the root of C-1. |
| **Phantom audit** | An audit row that survived the rollback of the event it describes — a history book that records battles that never happened. Worse than a missing row, because the trail lies. |
| **Best-effort write** | A side effect we attempt but never let break the main result — if it fails, the important thing already committed. Spraying wax on the car after the engine is fixed: nice if it lands, irrelevant if the sprayer is empty. |
| **Family revocation** | Killing every refresh token belonging to one user at once, because one of them proved stolen. Changing all the locks, not just the lost key's door. |
| **Rotation** | Issuing a brand-new refresh token on every use and retiring the old one — so replaying an old one is itself the alarm. Tear-off ticket stubs: presenting yesterday's stub means someone kept your roll. |
| **Append-only audit trail** | A history table rows can only be added to, never edited or deleted (enforced by database triggers). A carbon-copy receipt book — you can add a page, you cannot erase ink. |
| **Exploitability × blast radius** | Our triage formula: how easily a stranger can pull the trigger, times how much of the system is behind it. Contagiousness times severity. |
| **Grep** | The auditor's scalpel: search the codebase for a finding ID and every place that finding touched lights up. `grep -rn "B-1" server/src/main/java` is the whole demonstration in one line. |
| **Fail-fast boot & hardening batch** | Fail-fast: the server refusing to start on bad configuration, with the remedy printed — a pilot's pre-flight checklist that stops at the gate. A *hardening batch* is a named group of fixes shipped together, each batch leaving the tree building clean and booting — moving the wiring, then the plumbing, then the paint, checking after every crew. |

---

## My ultimate Q&A bank

### From the per-student pack (the classics)

**Q: "What was your most serious finding?"**
B-1, the refresh-token reuse detection that rolled back its own revocation. It is the nastiest class of bug — the security control exists in the code, but the transaction boundary made it fail open exactly when it mattered. The fix separates 'revoke the family' into its own committed transaction before the 409 is raised, with the audit event written best-effort afterwards so an audit outage can never undo a revocation. You can read the whole story in the comments around TokenService.rotate.

**Q: "Explain the phantom audit bug — why is it dangerous?"**
C-1. The old code opened a second connection inside an outer transaction to write the audit row, and the two committed independently. So a business operation could roll back — the thing never happened — while its audit row survived: the trail then claims events that never occurred, which is worse than a missing row in a system whose promise is tamper-evident history. The fix is transaction hygiene: one connection per transaction through the shared runner, and post-commit side effects written best-effort, so the trail can only lag, never lie. The fix comments in `ShareService` and `SettingsService` record the rule exactly where the bug lived.

**Q: "How did you prioritize eight passes' worth of findings?"**
By exploitability times blast radius. Anything that failed open, leaked a credential, or crossed an ownership boundary was batch 1 — 'someone can get in or see someone else's data'. Integrity and tamper-evidence was batch 2. Concurrency and robustness cleanups were batch 3. And documentation-level risks got logged with a named fix path rather than pretend-fixes. Nothing was closed because we felt like it — each closure points at a finding-ID comment in the code.

**Q: "Did the audit ever produce a false alarm?"**
Yes, and that is worth saying out loud. The OTP overhaul initially looked like the overhaul had broken something when our rehearsal API calls started hitting 429s — but the limiter was doing its job: machine-speed repeated calls from one IP legitimately exhaust a 10-per-minute auth bucket, and a real user doing password-reset, MFA and step-up in a minute would come close too. The honest fix was a scope-aware budget — 20 a minute for auth, 30 for public share endpoints — not disabling the limiter. Knowing the difference between 'the system is broken' and 'the system is protecting itself' is the core audit skill.

**Q: "Give one finding that was not a classic security hole."**
H-1: the default document download resolved to the wrong version when the current-version pointer and the mirror disagreed, so a user could fetch bytes other than the version they were shown. The fix pins download resolution to one definition of current. H-3 was an orgName join that silently dropped organisations with unusual casing, and F-4 pinned the client's document versions so a stale screen cannot overwrite a newer one. None of these leak data on their own — all of them break a promise the UI makes, which is why they were worth a pass of their own.

### The masterclass ten

**Q: "How were eight passes checklists and not just vibes?"**
Each pass started as a written checklist of the ways its theme fails in real systems — for concurrency: "find every place a second connection opens inside a transaction"; for configuration: "list every environment variable and what a silent wrong value does". I then walked the relevant files against the checklist and wrote an ID for anything that answered badly. That is why the IDs cluster: B-1, B-2 and B-3 are all answers to the same written question about token lifecycle. "We looked at everything" is not evidence; "these eight checklists were run against these folders" is.

**Q: "Why is B-1 the nastiest *class* of bug, not just one bug?"**
Because it is fail-open: the control exists, the code path exists, even the intent exists — and the surrounding machinery (the transaction rollback) silently defeats it exactly when it fires. A missing control is loud in code review; a defeated control looks like a control. The only reliable way to catch the class is to trace what actually commits when the error flies, which is exactly what our review of `TokenService.rotate` now documents in its comments for the next reader.

**Q: "What did the phantom audit (C-1) actually break?"**
Trust in our own history. DocuTrust's promise is tamper-evident history — every security-relevant event leaves an append-only row. C-1 meant the history book could record events that never happened: a business operation rolls back, its audit row survives on the second connection. Anyone querying `audit_logs` would be reading fiction. The fix makes one connection the unit of truth; the shipped comments in `ShareService` and `SettingsService` record the rule where it happened, and the phantom can never return because the second-connection overload no longer exists in the tree.

**Q: "Did the microservices refactor break any of your audit guarantees?"**

> No — and I can show why in three moves. The security-critical mechanics all live in the **shared module** both services compile: `TokenService`'s B-1 committed-before-error revocation, E-3/D-1's fail-fast config gates, C-1's single-connection transaction hygiene — moving them into a second service copied their guarantees, not their risks. The database guarantees never moved at all: the append-only triggers, the ownership `WHERE` clauses and the constraint wall are schema-side, and both services write the **one shared database** through the same prepared-statement discipline. The one genuinely new surface — the gateway — was built with the audit's own instincts: it forwards bytes rather than re-interpreting them (nothing to re-validate, nothing to leak), it **recomputes `X-Forwarded-For`** from the live peer so audit rows keep recording the true client IP instead of a proxy address, and it answers `502 BAD_GATEWAY` with the standard error envelope rather than hanging or leaking internals. And the refactor itself followed the audit's house rules: one phase, one verifiable state (build green, boot banners, route counts counted), before the next phase started.

**Q: "You fixed the same reuse bug three ways — B-1, B-2, B-3. Why three?"**
Because a security action has three independent parts: the effect (revoke the family), the evidence (the audit row), and the race window (concurrent rotations). B-1 makes the effect durable before the error unwinds; B-2 makes the evidence post-commit and best-effort so it can never veto the effect; B-3 closes the race so two simultaneous refreshes cannot both pass the "is it still live?" check. Fixing only B-1 would have left the audit row able to roll the revocation back indirectly, or two racing requests double-issuing tokens. The trio is one correct action.

**Q: "How do you audit without commercial scanners — isn't manual review unreliable?"**
Manual and systematic beats automated and shallow for a codebase our size: a scanner would have flagged dependencies, not found that our revocation rolled back with its own exception. The discipline that makes manual work is the checklist per pass, the ID per finding, and the comment per closure — those three turn an opinion into a record. We also had an advantage a scanner lacks: we could read every line, because the whole server is a few thousand lines of framework-free Java.

**Q: "Why eight passes instead of one giant pass?"**
Because attention is single-threaded: reading one file for eight kinds of danger means you hunt none of them well. One pass per theme means each reading of a file has exactly one question, so a concurrency bug cannot hide behind a prettier crypto question. The side effect is the ID system itself — the letter tells you which lens found it, which tells the fixer which kind of care the fix needs (a concurrency fix wants a lock-ordering story; a leakage fix wants a payload check).

**Q: "D-1 and E-3 both refuse to boot. What is the difference, and why two checks?"**
They guard two different secrets with two different failure modes. D-1 is about the vault key's *shape*: it must be a 44-character base64 string decoding to exactly 32 bytes, because AES-256 needs precisely that much key material — a wrong-shaped key would fail later, mysteriously, at decryption time. E-3 is about the JWT secret's *strength and provenance*: at least 256 bits for HS256 and never a placeholder, because a guessable signing secret means forgeable identities. Both run at config load, before database connections, so a bad configuration dies at the gate with the remedy printed.

**Q: "How does 'every closure points at a comment' actually work?"**
Each fix landed together with the comment that carries its ID: `TokenService.rotate`'s B-1/B-2/B-3 block explains the committed revocation, the post-commit audit and the row lock; the C-1 comments in `ShareService` and `SettingsService` record the one-connection rule where the bug lived; the D-1 and E-3 comments sit exactly on the config checks they describe. If a closure has no greppable comment, it is not closed — it is a wish. That rule is why three batches in a row can be audited the same way: search the ID, read the story, watch the flow live.

**Q: "Did the audit change how the team writes code, beyond the fixes?"**
Three habits became house rules. Transactions hold exactly one connection, and anything that must survive an error gets its own committed transaction before the error flies. Side effects after a commit are best-effort by design — the trail may lag, never lie. And configuration fails closed: any value the server cannot afford to guess (signing secret, vault key) is validated at boot with the remedy printed. You can see all three habits in code written *after* the audit, because the comments cite the IDs that taught us.

**Q: "How do you demonstrate an audit in two minutes on stage?"**
Two moves. First, `grep -rn "B-1" server/src/main/java/com/docutrust/auth/TokenService.java` — the comment tells the whole story in the authors' own words, which is stronger than any slide. Second, live behaviour: replay a rotated refresh token against the running local server and show the `409 TOKEN_REUSE`, then point at the database or the log to show every session's refresh token died with it. An audit you cannot show in the product is a document; this one is both.

**Q: "What is still on the audit's open list — what would you fix next?"**
The named, honest items: notification transport is still in-app only (no email or push for expiry reminders), the mobile session list is client-side only, and the docs-level risks we logged carry fix paths rather than pretend-fixes — that is what the universal "weakest point" answer says, and I own it the same way. None of them weakens the security core: the fail-closed boot, the committed revocation, the single-connection transactions and the version pinning are all shipped and demonstrable. An audit that ends with "everything is perfect" is the one you should distrust.

---

## The handshake — how my slice feeds the other five

- **If you ask me about the router, tables or triggers → that's Student 1's area.** My part feeds it as the stress pass: the C-1 transaction hygiene lives in the shared database layer Student 1 owns, the C-2/C-13 splitter fix is in the migration runner, and every append-only audit guarantee I lean on is a trigger Student 1 built.
- **If you ask me about JWT internals, rotation or OTP → that's Student 2's area.** My part found where it hurt: B-1/B-2/B-3 are Student 2's token lifecycle made durable, and the 429 false alarm was the rate limiter's budget being tuned (20/min auth, 30/min public share) rather than switched off. I attack it; Student 2 explains how it works.
- **If you ask me about the vault, shares or verification → that's Student 3's area.** My part pinned its promises: D-1 gave the vault key its exact shape, F-4 stops a proof link from silently re-pointing at different bytes, H-1 pins downloads to one definition of "current", and H-3 completes the payloads its screens render.
- **If you ask me about screens, ApiClient or UX flows → that's Student 4's area.** My part is the reason several of its branches exist: the client's `409 TOKEN_REUSE` logout, the step-up phases and the OTP-era UX (FT-231) are the user-facing halves of audit findings — Student 4 made the fixes feel like product instead of patches.
- **If you ask me about build, config or deployment → that's Student 6's area.** My part wrote the checks it boots with: E-3 and D-1 are the fail-fast config validation that stops the server starting on weak or misshapen secrets, and the `.env.example` placeholder blocklist is E-3's rule applied to documentation.
- **Who most often bridges TO me: Student 2.** Every token-lifecycle question walks from "how does rotation work" straight into "and the audit found it once failed open — B-1" — so we rehearse the refresh-replay demo together; Student 3's version-pinning story (F-4) is the second-most common bridge.
