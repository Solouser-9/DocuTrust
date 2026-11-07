# Student 2 — Auth & OTP Security — Masterclass Deep Dive

This file is the complete rehearsal brief for the team member presenting **Student 2 — Auth & OTP Security** at the DocuTrust oral defence (Group 3), and the companion read for examiners who want to check every claim against the repository.
It expands the matching role section in **`DEFENCE_GUIDE.md`** at the repository root — the master index that carries the shared numbers, the individual defence formula and the bridge map — into a full file-by-file ownership map, a method-by-method code walkthrough, a plain-words glossary, and a personal question bank.
Read your role section in `DEFENCE_GUIDE.md` first, then rehearse from here; `docs/defence/STUDENT_PACK.md` in the same folder is the one-page summary of all six roles, and every class, method, column and screen named below exists in the repo and can be opened live during the defence.

## My slice in one page

**Role in one line:** how a stranger becomes a trusted user — and how a stolen password alone still is not enough.

**Owns:** `AuthService`, `PasswordService` (PBKDF2), `TokenService` (rotating refresh + reuse detection + `listSessions` + `revokeById`), `MfaService` (TOTP), `JwtService` (hand-rolled HMAC-SHA256 tokens), `OtpService` (hashed one-time codes), `MailService` (Brevo), `StepUpService`, the rate limiter (`RateLimiter` on Bucket4j), and the mobile SecureStore-backed session persistence in the client; the `AuthController` endpoints; the `email_otps` schema; and the eight auth screens on the mobile side.

**Feature claims:** FT-001 to FT-024 plus the post-audit security addendum FT-217 to FT-234 (`docs/FEATURES.md`).

**My numbers:**

- 74 API routes, printed at boot (`routes=74`, `server/src/main/java/com/docutrust/Main.java`) — the auth, refresh, OTP, step-up, MFA and Active Sessions routes among them are mine.
- 15 database tables built by 12 migrations; V10 adds the `email_otps` table, V11 adds the OTP-gating fields on `shares` (shared with Student 3).
- Every OTP flow — including the negative paths — re-driven live with manual API calls (Postman/cURL) at the defence.
- PBKDF2-HmacSHA256 at **120,000 iterations**, 16-byte per-user salt, 256-bit key, constant-time verify (`PasswordService`).
- Sessions: **15-minute** access JWT (hand-rolled HMAC-SHA256) plus a **7-day** refresh token, 43 characters, stored only as a SHA-256 hash; the device keeps the JWT pair in `expo-secure-store`, while the backend exposes `GET /api/auth/sessions` and `DELETE /api/auth/sessions/:id` for the user-facing Active Sessions screen.
- Active Sessions ledger (newest slice): `refresh_tokens` doubles as the user-facing session history — `listSessions` returns the active rows (`id`, `device`, `ip`, `createdAt`, `expiresAt`, newest first) and `revokeById` revokes one row surgically (`UPDATE … WHERE id = ? AND user_id = ?`), so the token-family cascade stays reserved for reuse attacks. On the phone the JWT pair lives in `expo-secure-store` (Keychain/Keystore); a one-time hydration upgrade moves any legacy plaintext copy into SecureStore and scrubs it from AsyncStorage.
- Email OTPs: **6 digits** from `SecureRandom`, stored as `sha256(purpose:email:code)`, single-use, **10-minute**
  TTL (**24 h** for invites), **5 attempts** max, at most one live code per (purpose, target), sent through Brevo.
- Challenge tokens: MFA email challenge JWT **10 minutes** (`typ=mfa_challenge`); step-up token **5 minutes** (`typ=step_up`, header `X-Step-Up-Token`).
- Rate-limit budgets: **auth 20/min**, public-share 30/min, public-verify 20/min, default 10/min — one Bucket4j bucket per scope|IP in a Caffeine cache.
- 45 mobile screens, of which the **8 auth screens** are mine (`mobile/src/screens/`).
- The headline property: after the overhaul, **no API response ever contains a password, a reset code, or a temporary password** — the inbox is the only place a code exists.

> **Note:** every claim in this brief is verifiable from the public repository alone — the finding IDs are greppable in the code comments, and every flow (happy and negative path) is demonstrated live at the defence with manual API calls (Postman/cURL).

## Elevator pitch (≈ 1 minute)

> "I own everything that proves who you are. Passwords are PBKDF2-hashed; sessions are a 15-minute access JWT plus a rotating refresh token whose reuse is detected and kills the whole token family — B-1 in our audit. On top we just shipped an email-OTP layer: six-digit codes, SHA-256-hashed in the database, single-use, ten-minute expiry, five attempts max, sent through Brevo. They power four flows: password reset, email MFA fallback for login — the server answers HTTP 440 with a challenge — step-up verification for destructive actions like permanent deletion, and OTP-gated share links. The security headline: after the overhaul, **no API response ever contains a password, a reset code, or a temporary password** — the inbox is the only place a code exists. The proof is live: every one of those flows — including the negative paths — is walked with manual API calls (Postman/cURL) during the defence."

Then demo: on your local machine, replay a rotated refresh token on purpose and let the audience watch the whole token family die with `409 TOKEN_REUSE`; then walk forgot-password → emailed code → reset with the server log and the `X-Dev-OTP` header in dev mode showing where the code travels.

## What I own, file by file

### The `auth/` package — the ID checkers at the door

| File | What it does, in one sentence |
|---|---|
| `server/src/main/java/com/docutrust/auth/PasswordService.java` | Hashes and verifies passwords with PBKDF2-HmacSHA256 at 120,000 iterations, a fresh 16-byte salt per user and a constant-time comparison, so the database never learns a password and guessing proofs take the same time to fail. |
| `server/src/main/java/com/docutrust/auth/JwtService.java` | Hand-rolled HMAC-SHA256 JWT issuer/verifier with a 15-minute access-TTL default, typed `TokenExpiredException` vs `TokenInvalidException`, and a `typ` claim that separates session tokens from `mfa_challenge` and `step_up` tokens. |
| `server/src/main/java/com/docutrust/auth/TokenService.java` | Mints and rotates 43-character opaque refresh tokens stored only as SHA-256 hashes with 7-day expiry, locks the token row `FOR UPDATE` during rotation (B-3), and on reuse of an already-revoked token revokes the entire family in its own committed transaction before answering `409 TOKEN_REUSE` (the B-1 fix). |
| `server/src/main/java/com/docutrust/auth/MfaService.java` | Implements RFC 6238 TOTP (30-second step, 6 digits, ±1 window) with RFC 4648 Base32 secrets, `otpauth://` URLs for authenticator apps, and constant-time code comparison. |
| `server/src/main/java/com/docutrust/auth/RateLimiter.java` | Token-bucket rate limiting on Bucket4j — one bucket per `scope|IP` key held in a Caffeine cache (50,000 entries, 10-minute idle eviction) — with per-scope budgets: auth 20/min, public-share 30/min, public-verify 20/min, everything else 10/min. |

### The auth services — the chefs cooking the flows

| File | What it does, in one sentence |
|---|---|
| `server/src/main/java/com/docutrust/service/AuthService.java` | The auth domain orchestrator: register (personal or org), login with TOTP or the email-MFA fallback (`useEmailMfa` → 440 challenge), `verifyOtp` challenge exchange, refresh/logout, OTP password reset, email verification, profile updates, MFA setup/enable/disable, and the step-up-gated password change. |
| `server/src/main/java/com/docutrust/service/OtpService.java` | The shared one-time-code engine: five purposes (`password_reset`, `mfa_login`, `step_up`, `share_access`, `org_invite`), 6-digit `SecureRandom` codes stored only as `sha256(purpose:email:code)` digests, single-use, 10-minute TTL (24 h invites), a 5-attempt burn, and at most one live code per (purpose, target). |
| `server/src/main/java/com/docutrust/service/MailService.java` | Delivers OTP emails through Brevo's transactional API in `MAIL_MODE=live` (a failed send is a loud `502 MAIL_SEND_FAILED`, never a silent drop), while `MAIL_MODE=dev` logs the code and hands it to the controller for the `X-Dev-OTP` demo header. |
| `server/src/main/java/com/docutrust/service/StepUpService.java` | Exchanges an emailed OTP for a 5-minute single-purpose JWT (`typ=step_up`) and gates destructive routes through `authorize()`, which throws `403 STEP_UP_REQUIRED` unless the `X-Step-Up-Token` header carries a valid token belonging to the calling user. |

### The auth controllers — the waiters taking the orders

| File | What it does, in one sentence |
|---|---|
| `server/src/main/java/com/docutrust/controller/AuthController.java` | Thin endpoints for register, login (rendering the `440 MFA_EMAIL_CHALLENGE` body with the masked email and challenge token), verify-otp, refresh, logout, forgot-password and reset-password-otp, request/verify-step-up, verify-email, me, change-password and the three MFA routes — parsing, delegating, and surfacing dev OTPs only via `X-Dev-OTP`. |
| `server/src/main/java/com/docutrust/controller/OrgController.java` (invite endpoints, shared slice) | The `invite` and `acceptInvite` endpoints sit in the org module, but the credential they move is my engine's `org_invite` OTP — a 24-hour emailed code that replaces the temporary-password-in-JSON anti-pattern (FT-225). |

### The `email_otps` schema — migration V10

| Column (table `email_otps`) | What it holds, in one sentence |
|---|---|
| `id UUID PRIMARY KEY` | The OTP row's own identity. |
| `user_id UUID REFERENCES users(id) ON DELETE CASCADE` | The account the code belongs to — deliberately `NULL` for share-access OTPs, which belong to an anonymous recipient instead. |
| `share_id UUID REFERENCES shares(id) ON DELETE CASCADE` | For `share_access` codes only: which share link this code unlocks. |
| `recipient_email VARCHAR(255)` | The lowercased inbox the code was minted for — part of the digest, so the code is nailed to one address. |
| `purpose VARCHAR(32) NOT NULL` | Which flow the code serves (`password_reset`, `mfa_login`, `step_up`, `share_access`, `org_invite`) — the first ingredient of the purpose-salted digest. |
| `otp_hash VARCHAR(64) NOT NULL` | Only the SHA-256 hex digest of `purpose:email:code` — a database leak yields no working codes. |
| `expires_at TIMESTAMPTZ NOT NULL` | The 10-minute life (24 hours for invites) enforced before any comparison happens. |
| `used_at TIMESTAMPTZ` | The single-use marker — set inside the same locked transaction that verified the code, so two parallel guesses cannot both spend it. |
| `attempts INT NOT NULL DEFAULT 0` | The burn counter — the fifth wrong attempt marks the code used for good. |
| `created_at TIMESTAMPTZ NOT NULL DEFAULT now()` | Mint time, used to pick the newest live code for the target. |

Three indexes back the lookup paths: `idx_email_otps_target` (purpose, recipient_email, created_at DESC), `idx_email_otps_user` and `idx_email_otps_share` — added by the same V10 migration.

### The eight auth screens — `mobile/src/screens/`

| Screen file | What it does, in one sentence |
|---|---|
| `LoginScreen.js` | Email + password sign-in that offers "email me a code instead" (`useEmailMfa`) and finishes the server's 440 challenge instead of treating it as an error. |
| `RegisterScreen.js` | Creates personal or organisation accounts with a client-side password-strength meter before the server's stricter validation runs. |
| `ForgotPasswordScreen.js` | Requests the emailed reset code and shows the same confirmation whether or not the account exists — no user enumeration. |
| `ResetPasswordScreen.js` | Collects the emailed 6-digit code plus the new password and submits `reset-password-otp {email, code, newPassword}` (FT-219). |
| `MfaScreen.js` | The second-factor screen: TOTP code entry for authenticator users, the email-fallback phase for the 440 challenge, and the exchange of challenge + code for real session tokens. |
| `VerifyEmailScreen.js` | Consumes the emailed verification token and flips a `pending` account to `active`. |
| `ChangePasswordScreen.js` | The step-up-gated password change: it detects `403 STEP_UP_REQUIRED`, requests the emailed code, trades it for the 5-minute step-up token and retries with the `X-Step-Up-Token` header. |
| `SecurityScreen.js` | The "where am I signed in" view — the server-backed Active Sessions list (`GET /api/auth/sessions`, revoked per row via `DELETE /api/auth/sessions/:id`), MFA state, and the change-password entry point. |

## Five layman's analogies

1. **An OTP is a VIP wristband, not a key.**
   Your password is the key to the building; the wristband is handed to you at the door, works for one night only, and is worthless to anyone who photographed it yesterday.
   Even if someone steals your key (password), without the wristband handed out to your phone's inbox they still don't get into tonight's event.
2. **Step-up authentication is a bank vault inside a bank.**
   Walking into the bank with your card (being logged in) gets you to the lobby.
   But opening the safe-deposit box — permanently deleting a document, changing your password — requires a second, fresh proof: a code to your phone, right now.
   We even made the vault token short-lived: five minutes, single purpose, useless on any other door.
3. **Refresh-token rotation is a tear-off ticket pad.**
   Every time you use your ticket, you get the next one off the pad and the old one is stamped.
   If someone tries to use a stamped ticket — a stolen, already-rotated refresh token — the system doesn't just refuse it: it tears up the whole pad, because a stamped ticket reappearing means someone is copying your tickets.
4. **PBKDF2 password hashing is a one-way blender run 120,000 times.**
   Fruit goes into the blender and a smoothie comes out; no machine pours a smoothie back into whole fruit.
   We run the blender 120,000 times so that anyone trying to recover the original by re-blending every possible basket has to do the same enormous chore — and every user's basket gets its own unique pinch of spice (the salt), so two people with the identical password still produce two different smoothies on the shelf.
5. **Purpose-salting an OTP digest is stamping the key with its door.**
   A spare key cut for the garden shed does not open the front door, even though the teeth are identical metal — the stamp is part of what the lock checks.
   `sha256(purpose:email:code)` means a code emailed for a password reset physically cannot be replayed into the share-access or step-up locks: same six digits, different stamp, no fit.

## The critical code walkthrough

### Flow (a) — password reset, method by method in order

1. **Route + rate limit.** `POST /api/auth/forgot-password` is registered in `Main.java` through `router.rateLimited(..., "auth", authC.forgotPassword())`, so before any of my code runs, the router asks `RateLimiter.allow(key)` — a Bucket4j token bucket keyed `auth|<ip>` in a Caffeine cache.
   Over the budget the caller gets `429 RATE_LIMITED`.
2. **The controller.** `AuthController.forgotPassword()` calls `AuthService.forgotPassword(ctx.json(), ctx.ip())` and, in dev mode only, attaches the code as the `X-Dev-OTP` response header — the body never carries it.
3. **The service, inside one transaction.**
   `AuthService.forgotPassword` validates the email with `Validator.email`, then opens `db.tx(...)` (`Database.tx` → `Tx.with`: autocommit off, commit on success, rollback on any exception).
   It looks the account up by email; if there is no user it returns a `null` dev code and the same body either way — `"If that email exists, a reset code has been sent"` — so the endpoint cannot be used to enumerate accounts.
4. **The mint.** `OtpService.issue(c, "password_reset", userId, null, email)` first `DELETE`s the target's unused codes for that purpose, so at most one live OTP exists per (purpose, target).
   It then mints `String.format("%06d", new SecureRandom().nextInt(1_000_000))` and inserts the row with `digest(purpose, email, code)` — `Text.sha256Hex("password_reset:" + email + ":" + code)` — and `expires_at = now() + 10 minutes` (`TTL_MINUTES = 10`).
   The plaintext code exists nowhere in the database.
5. **The audit row.** Still inside the same transaction, `AuditService.insert(... "auth.password_reset_requested" ...)` writes the append-only audit entry — the whole mint is atomic.
6. **The email, after the commit.** `mail.sendOtp(email, purpose, code, 10)` runs only after the transaction has committed — no network call ever happens inside a transaction.
   In `MAIL_MODE=live`, `MailService.send` POSTs a JSON payload to `https://api.brevo.com/v3/smtp/email` with the `api-key` header and turns any non-2xx into `AppException(502, "MAIL_SEND_FAILED", ...)` — a silently dropped OTP would lock users out.
   In dev mode the code is printed to the log instead.
7. **The verification.** `POST /api/auth/reset-password-otp` → `AuthService.resetPasswordOtp` → inside `db.tx`, `OtpService.verify(c, "password_reset", userId, null, email, code)`.
   That method selects the newest live row `... ORDER BY created_at DESC LIMIT 1 FOR UPDATE` — the row lock means a second simultaneous guess waits, then sees the code spent.
   It checks the `\d{6}` format and the expiry, then compares `Text.constEq(digest(purpose, email, code), row.hash)` — constant-time, so timing leaks nothing.
   A wrong code increments `attempts`; at `MAX_ATTEMPTS = 5` the same UPDATE sets `used_at`, burning the code.
   A right code is spent by `UPDATE email_otps SET used_at = now() WHERE id = ? AND used_at IS NULL` — if that updates zero rows we lost a single-use race and fail closed with `400 OTP_INVALID`.
   Expired, used and unknown codes all return the identical message, so the reply never reveals which.
8. **The token update, same transaction.**
   Still inside the same `db.tx`: `UPDATE users SET password_hash = ?` with a fresh `PasswordService.hash(newPassword)` (new salt, 120,000 iterations), then `tokens.revokeAllForUser(c, userId)` — every refresh token of that user dies with the password — then the `auth.password_reset` audit row.
   If any step fails, all of it rolls back.

### Flow (b) — refresh-token rotation with reuse detection (the B-1 fix), method by method in order

1. **Route.** `POST /api/auth/refresh` → `AuthService.refresh` → `TokenService.rotate(presented, device, ip)`.
2. **Format gate.** `TokenService.validFormat` requires exactly 43 characters of `[A-Za-z0-9_\-]`; anything else is `401 Invalid refresh token` before the database is touched.
3. **Hash lookup under a row lock.** Inside `db.tx`, the presented token is hashed with `TokenService.hash` (`Text.sha256Hex`) — the database stores hashes only — and selected with `SELECT rt.user_id, rt.expires_at, rt.revoked_at, u.role, u.org_id FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id WHERE rt.token_hash = ? FOR UPDATE OF rt`.
   The `FOR UPDATE` is B-3: a concurrent rotate or revoke of the same token serialises here instead of both reading `revoked_at IS NULL` and double-issuing.
4. **Not found** → `401`. **Found and revoked** → the method does *not* throw; it returns `new Rotation(userId, null)` — the B-1 marker.
   **Found and expired** → `401 Refresh token expired`.
5. **The healthy rotation.** A fresh 43-character token is minted (`Text.token()` — 32 random bytes, Base64url), inserted with a 7-day expiry, and the old row is closed with `UPDATE refresh_tokens SET revoked_at = now(), replaced_by = ? WHERE token_hash = ? AND revoked_at IS NULL` (the `AND revoked_at IS NULL` is B-3: never re-revoke).
   The transaction commits and the caller receives a new 15-minute access JWT plus the fresh refresh token.
6. **The reuse branch — after the detection transaction has fully committed.**
   The heart of the B-1 fix is this block in `TokenService.rotate`:

```java
if (r.tokens() == null) {
    // B-1: the family revocation must COMMIT before the 409 unwinds. The old code revoked inside
    // the detection transaction - throwing the 409 rolled that revocation straight back, so reuse
    // detection had no durable effect (fail-open).
    revokeAllForUser(r.userId());
    // B-2: audit AFTER the revocation commit - best-effort, so an audit outage can never undo it.
    auditReuse(r.userId(), ip);
    throw new AppException(409, "TOKEN_REUSE", "Refresh token reuse detected - all sessions revoked, please log in again");
}
```

   `revokeAllForUser(userId)` runs in **its own committed transaction** — `UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = ? AND revoked_at IS NULL` — so by the time the `409` is thrown, the revocation is durable no matter what happens next.
`auditReuse` then writes the `auth.token_reuse` audit row best-effort in yet another transaction and swallows failures: the trail may lag, never lie, and can never undo the revocation.
The old code failed open — the revocation shared a transaction with the exception that reported the reuse, so both rolled back together.
The story, the finding ID and the fix are all readable in the comments around `TokenService.rotate`.
7. **The client's end.** The mobile `ApiClient` (Student 4) receives `409 TOKEN_REUSE`, logs the session out immediately, and the legitimate user simply logs in again — annoying for them, fatal for the attacker.

### Flow (c) — the email-MFA fallback login (the 440), method by method in order

1. **The request.** `POST /api/auth/login` with `useEmailMfa: true` (rate-limited in the `auth` scope like every public auth route).
2. **Credentials first, always.** `AuthService.login` loads the credential row with `loadCred` and runs `passwords.verify`; a failure writes the `auth.login_failed` audit row and answers the identical `401 Invalid email or password`; a suspended account answers `403 ACCOUNT_SUSPENDED` before any factor is discussed.
3. **The fallback branch.** If `mfaEnabled` and `useEmailMfa` are both set, one `db.tx` calls `otps.issue(c, OtpService.PURPOSE_MFA_LOGIN, userId, null, cu.user.email)` and writes the `auth.mfa_email_challenge` audit row; only after the commit does `mail.sendOtp` send the code to the account's own address.
4. **The challenge token.** `jwt.issue(userId, role, orgId, OtpService.TTL_MINUTES * 60, "mfa_challenge")` mints a 10-minute JWT whose `typ` claim gives it no session authority — it only proves "password plus email factor done".
5. **The 440.** `AuthController.login` answers `440` with `error.code MFA_EMAIL_CHALLENGE`, the `challenge` token and the masked address from `maskEmail` (`a***@domain.tld` — recognisable to the owner, useless for enumeration).
6. **The exchange.** `POST /api/auth/verify-otp {challenge, code}` → `AuthService.verifyOtp`: `jwt.verify` (expired → `401 CHALLENGE_EXPIRED`, wrong `typ` → `401`), a suspended-account re-check, then `otps.verify` for `mfa_login` inside one transaction — after which `last_login_at` is stamped, the `auth.login` audit row is written with `"mfa": "email_otp"`, and `tokens.issue` finally grants the real session.
7. **Why this shape.** The TOTP path (`mfa.verify`) and the email path share the same login endpoint and the same OTP engine; the only difference is who generates the second factor — an authenticator app or an inbox.

### Flow (d) — the step-up-gated password change, method by method in order

1. **The request.** `POST /api/auth/change-password` with the current and new password plus the `X-Step-Up-Token` header (`StepUpService.HEADER`).
2. **The gate, before anything else.** `AuthService.changePassword` calls `stepUps.authorize(stepUpToken, me)` — a missing header, an expired token, an invalid signature, a wrong `typ`, or a token belonging to another account each answers `403 STEP_UP_REQUIRED` with the exact remedy spelled out in the message.
   The comment in `AuthService` records the reasoning: changing a password is exactly the moment an attacker with a stolen session would strike.
3. **The current-password proof.** `passwords.verify(current, stored)` guards against a hijacked step-up too; a failure writes the `auth.password_change_failed` audit row.
4. **The swap, one transaction.** Inside `db.tx`: `UPDATE users SET password_hash = ?` with a fresh PBKDF2 hash, then `tokens.revokeAllForUser(c, userId)` — every session dies with the password — then the `auth.password_changed` audit row.
   A stolen session that somehow passed step-up still ends with the thief's own tokens revoked.

### The five OTP purposes at a glance

| Purpose (`OtpService` constant) | Triggered by | Delivered to | Consumed by |
|---|---|---|---|
| `password_reset` | `POST /api/auth/forgot-password` | the account's own inbox | `POST /api/auth/reset-password-otp` |
| `mfa_login` | `POST /api/auth/login` with `useEmailMfa: true` → 440 | the account's own inbox | `POST /api/auth/verify-otp` + the challenge JWT |
| `step_up` | `POST /api/auth/request-step-up` | the account's own inbox | `POST /api/auth/verify-step-up` → the `X-Step-Up-Token` header |
| `share_access` | `POST /api/public/shares/:token/request-otp` | the owner-pinned `otp_recipient_email` only | `POST /api/public/shares/:token/open-with-otp` |
| `org_invite` | `POST /api/org/invite` (24-hour TTL) | the invitee's inbox | `POST /api/auth/accept-invite` |

### What my status codes tell the client

| Code my slice emits | When | What the client should do |
|---|---|---|
| `440 MFA_REQUIRED` | TOTP-enabled login without a valid authenticator code | show the TOTP entry — or offer the email fallback |
| `440 MFA_EMAIL_CHALLENGE` | `useEmailMfa: true` accepted | keep the `challenge`, prompt for the emailed code, POST both to `/api/auth/verify-otp` |
| `403 STEP_UP_REQUIRED` | destructive action without a valid `X-Step-Up-Token` | `request-step-up` → `verify-step-up` → retry with the header |
| `409 TOKEN_REUSE` | an already-rotated refresh token was presented | log the session out immediately — the family is already revoked |
| `429 RATE_LIMITED` | the scope's token bucket ran dry | wait; the buckets refill continuously, not in fixed windows |
| `502 MAIL_SEND_FAILED` | Brevo rejected or failed the send (live mode only) | offer a retry — a silently dropped code would lock users out |

### Every lifetime in my slice, at a glance

| Credential | Lifetime | Where it is enforced |
|---|---|---|
| Access JWT | 15 minutes | `JwtService.ACCESS_TTL_SECONDS`, verified on every authenticated route |
| Refresh token | 7 days | `refresh_tokens.expires_at`, set on issue and on every rotation |
| Email OTP | 10 minutes | `OtpService.TTL_MINUTES`, checked before any digest comparison |
| Org-invite OTP | 24 hours | `OtpService.INVITE_TTL_MINUTES` |
| MFA email challenge | 10 minutes | the `mfa_challenge` JWT expiry, re-checked in `AuthService.verifyOtp` |
| Step-up token | 5 minutes | `StepUpService.TTL_SECONDS`, re-checked by `authorize` at use time |
| Rate-limit bucket | continuous refill over 60 s | Bucket4j `Refill.greedy` in `RateLimiter.allow` |

## My domain, in plain words (glossary)

| Term | Plain meaning, with an everyday analogy |
|---|---|
| OTP (one-time passcode) | A VIP wristband: handed to you at the door, works once, worthless tomorrow. Six digits, emailed, dead in 10 minutes. |
| PBKDF2 + salt | A recipe that stirs the password soup 120,000 times before serving — and every user's soup gets its own unique pinch of spice (the salt), so identical passwords still store differently and pre-computed "rainbow" recipe books become useless. |
| SHA-256 digest | A fingerprint of a message: any change in the input changes the fingerprint, and you cannot rebuild the message from it. We store fingerprints, never the secrets themselves. |
| Purpose-salted digest | The fingerprint taken over `purpose:email:code` instead of just the code — a key stamped with which door it fits, so a reset code can never open the share lock. |
| JWT (JSON Web Token) | A wax-sealed ID card: the server writes your details on it, stamps the seal with its secret key, and anyone can read the card but only the server can forge the seal. |
| Refresh-token rotation | The tear-off ticket pad: every use hands you the next ticket and stamps the old one. |
| Reuse detection / family revocation | A stamped ticket coming back means someone is copying your tickets — so the whole pad is torn up (`409 TOKEN_REUSE`), not just refused. |
| TOTP | The numbered key fob from online banking: a new 6-digit number every 30 seconds, computed from a shared secret plus the clock (RFC 6238). Our `MfaService` implements it by hand. |
| Step-up verification | A bank vault inside a bank: being logged in gets you to the lobby, but the safe-deposit box needs a fresh, second proof — a code to your inbox, right now. |
| `typ` claim | The job title printed on the ID card: `mfa_challenge` (10 min) and `step_up` (5 min) look alike but authorise opposite directions, and each gate checks the title. |
| Rate limiter (token bucket) | A coffee-shop punch card that fills itself: every auth request stamps one square; when the minute's squares are gone, the machine politely says come back in sixty seconds — humans barely notice, rapid-fire tools hit a wall. |
| User enumeration | The leak where "wrong password" and "no such account" sound different, letting an attacker map which emails exist. Every public auth reply here is deliberately identical either way. |
| Constant-time compare | A guard who always takes exactly the same time to say no, whether the first character or the last was wrong — so the stopwatch itself leaks nothing (`Text.constEq`). |
| Brevo / `MAIL_MODE` | The postman, plus a flight-simulator switch: `dev` mode prints the code to the log and the `X-Dev-OTP` header so we can rehearse without emailing anyone; `live` mode sends real email. |
| HTTP 440 | Our own rubber stamp, documented in the API contract: "second factor needed — check your email." The standard codes have no word for that situation, so we printed one. |

## My ultimate Q&A bank

### From the per-student pack (the classics)

**Q: "Why store refresh tokens hashed if they are already random?"**

> Because the database should not be able to give a thief a usable token. A hash means a full database leak yields nothing usable directly; the attacker would have to reverse a SHA-256 of a 43-character random string. It costs one hash per refresh and buys immunity to the most damaging dump scenario.

**Q: "Walk me through exactly what happens when a rotated token is replayed."**

> The presented token is hashed and looked up; the row is found but already revoked, which by definition only happens if something replayed it. The server answers 409 TOKEN_REUSE and revokes every refresh token belonging to that user, so whatever device holds the stolen one is locked out with it. The legitimate user simply logs in again — annoying for them, fatal for the attacker.

**Q: "What exactly changed in the OTP overhaul?"**

> Two anti-patterns died: the password-reset endpoint that returned the reset code in the response, and invites that carried a temporary password in JSON. Their replacements share one engine: six-digit codes from SecureRandom, stored only as sha256 of purpose, target and code, single-use, ten-minute TTL — 24 hours for invites — five wrong attempts burn the code, and one live code per purpose and target. Responses never contain codes in any mode; dev mode puts them in the log and an X-Dev-OTP header, live mode sends real Brevo email. Every flow, including the negative paths, is re-driven live with manual API calls at the defence.

**Q: "Why did you return a special 440 status for MFA instead of a normal 401?"**

> The client needs to distinguish two very different situations after a login attempt: wrong credentials, versus correct credentials awaiting a second factor. A distinct machine-readable status makes the MFA screen a routing decision rather than an error message, and it cannot be confused with a failed password. It is a deliberate, documented extension of the standard statuses, used only for that branch.

**Q: "Could an attacker brute-force the six-digit code?"**

> They get ten attempts per minute per IP from the shared rate limiter, and each attempt must land inside the code's ten-minute life with a five-attempt burn limit, so the search space is practically unreachable. The limiter plus the short window make guessing a losing game, and failed attempts are audited.

### The masterclass ten

**Q: "Why `SecureRandom` and not the ordinary `Random`?"**

> Java's ordinary `Random` is a small, fully predictable mathematical sequence seeded from the clock — if an observer sees a couple of outputs, they can reconstruct the seed and predict every future output, including everyone else's codes.
> `SecureRandom` draws from the operating system's entropy pool and gives no such foothold.
> The whole security of a six-digit code rests on the mint being unpredictable: one million combinations is only safe if every one of them is equally likely and independent of everything an attacker has seen.
> Both `OtpService.issue` and `PasswordService.hash` use `SecureRandom` for exactly that reason — it is a one-word change that is the difference between a lottery and a pattern.

**Q: "Two guesses arrive at the same millisecond. What stops them both spending one code?"**

> The verification runs inside `Database.tx`, and `OtpService.verify` selects the live row with `FOR UPDATE` — Postgres row locking means the first verifier holds the row and the second one waits.
> When the second proceeds, it re-reads the state the first committed: attempts incremented, or `used_at` already set, so it fails.
> And there is a second fence: the consumption itself is `UPDATE email_otps SET used_at = now() WHERE id = ? AND used_at IS NULL`, and if that statement updates zero rows — meaning someone else spent it between the read and the write — we throw `OTP_INVALID` and fail closed.
> Two independent mechanisms, the lock and the conditional update, would each have to fail for a double-spend to happen, and the transaction wraps both.

**Q: "The MFA challenge and the step-up token are both JWTs — why give them different `typ` claims?"**

> Because they authorise opposite directions and must never be interchangeable.
> The `mfa_challenge` token (10 minutes) says "this person finished password plus second factor" and is only accepted by `AuthService.verifyOtp`, which exchanges it for real session tokens.
> The `step_up` token (5 minutes) says the reverse — you already have a session, and this briefly certifies that you proved an OTP moments ago — and is only accepted by `StepUpService.authorize` on destructive routes.
> Each gate verifies the `typ` field and, for step-up, that the token's subject is the calling user: a challenge token cannot open the vault gate, and a step-up token cannot finish a login.
> One `JwtService`, one signing key, and the authority is carried in the claim — misusing a token fails the type check, not the signature.

**Q: "Why are the codes purpose-salted in the digest?"**

> The stored digest is `sha256(purpose:email:code)`, not `sha256(code)`, so a code is welded to its flow and its inbox.
> If someone captures a code from a share-access email and tries it against the reset endpoint, the reset lookup computes a different digest and nothing matches — the same six digits are simply a different key on a different door.
> It also lets one table, one index layout and one verification path serve five flows safely, which is what made the overhaul affordable.
> And because the email is inside the digest, a code that was legitimately issued to one address cannot be verified against another address even within the same flow.

**Q: "What actually happens when Brevo is down?"**

> `MailService.send` treats a provider failure as a loud, immediate `AppException(502, "MAIL_SEND_FAILED", ...)` — never a silent drop, because a user who never receives their code is locked out just as surely as if we refused it.
> The client translates that into a friendly retry message.
> The design point is ordering: the email is sent *after* the minting transaction has committed, so a mail failure cannot roll back the audit row or leave a half-minted state, and the next attempt simply issues a fresh code — `issue` deletes the target's unused codes first, so there is never a pile of competing live codes.
> In dev mode none of this is reachable, because the network call is replaced by a log line.

**Q: "Why do responses never contain codes — even in dev mode?"**

> Because the old pattern trained clients to render credentials: a code that appears in a response body ends up in log files, screenshots, HTTP proxies and browser dev tools, all of which outlive the ten-minute TTL in practice.
> So the overhaul deleted the anti-pattern rather than deprecating it: `AuthService.forgotPassword` returns the code only through a side channel the controller controls, and in `MAIL_MODE=dev` that side channel is the `X-Dev-OTP` response header plus the server log — the body still says only "If that email exists, a reset code has been sent".
> Live mode has no header at all: the inbox is the only place the code exists.
> Our live demo reads the header, which is how we exercise the full flows without ever teaching the API to leak.

**Q: "You hash passwords with PBKDF2 but refresh tokens and OTPs with plain SHA-256. Inconsistent?"**

> Deliberate. PBKDF2's 120,000 iterations exist to slow down guessing of *low-entropy* secrets — human passwords, where the attacker's job is trying dictionary words.
> A refresh token is 32 random bytes encoded to 43 characters: there is nothing to dictionary-search, so a single fast SHA-256 already forces an attacker who dumped the database to brute-force 2-to-the-256 possibilities, which is no attack at all.
> The OTP codes *are* low-entropy, but their protection is not hash cost — it is the 10-minute expiry, the five-attempt burn, the row-locked single-use spend and the rate limiter, which together bound an attacker to a handful of guesses.
> Matching the tool to the threat, rather than applying the strongest primitive everywhere, is the actual lesson.

**Q: "The limiter used to answer 429 during your own rehearsal runs. What did you change?"**

> That was the audit's most useful false alarm: machine-speed repeated calls from one IP legitimately exhausted the old one-size 10-per-minute auth bucket, and a real user doing forgot-password, MFA and step-up inside a minute would come close too.
> The honest fix was not weakening the limiter but making it scope-aware: `RateLimiter` now keeps per-scope budgets — auth 20/min, public-share 30/min, public-verify 20/min, default 10/min — as one Bucket4j bucket per `scope|IP` key in a Caffeine cache that evicts idle keys after ten minutes.
> Bucket4j's token buckets also smooth bursts instead of permitting a full window's worth at once.
> The limiter stayed exactly as strict where it matters; it just stopped punishing legitimate multi-step flows.

**Q: "An attacker steals my *access* token. What is the actual blast radius?"**

> Fifteen minutes, by construction — that is `JwtService.ACCESS_TTL_SECONDS`, and there is no way to extend it without the refresh token.
> Within that window the bearer can act as me on ordinary routes, but the dangerous doors are additionally locked: changing the password and permanently deleting documents demand a fresh step-up OTP through `StepUpService.authorize`, which a stolen bearer token cannot produce, and a password change revokes every session anyway.
> The attacker also cannot rotate the access token, because rotation requires the refresh token — whose reuse would trigger the family revocation.
> So the design assumes the access token leaks eventually and minimises what fifteen minutes of it can do.

**Q: "Registration returns a `verifyToken` in the response — isn't that the anti-pattern you killed?"**

> It is the one deliberate survivor, and the difference is what the string unlocks.
> The killed anti-patterns returned *account credentials*: a reset code that unlocks the password, or a temporary password that *is* the login.
> The registration `verifyToken` does neither — it is a 43-character opaque token, stored hashed in `password_resets` via `issueOneTimeToken`, valid 24 hours, single-use, and the only thing it can do is flip the caller's own `email_verified` flag through `AuthService.verifyEmail`.
> It is handed to the person who just created the account, in the same session that created it, so there is no credential being exposed to a stranger.
> We named it in the review anyway, and the roadmap item is to move that last token fully into the email like every other flow.

## The handshake — how my slice feeds the other five

- **If you ask me about the router, middleware chain, or the schema → that's Student 1's area.**
  Here's how my part feeds it: my routes are registered in their `Router` with per-scope rate-limit wrappers, my JWT check runs as one link in their `Middleware` chain before any controller, and my `email_otps` and `refresh_tokens` tables live in their migrations V10 and V01 — I inherited constraints and indexes I did not have to build.
- **If you ask me about documents, shares or the vault → that's Student 3's area.**
  Here's how my part feeds it: my `OtpService` is the engine behind the OTP-gated share links (purpose `share_access`, the V11 fields on `shares`), and Student 3's permanent-delete route calls my `StepUpService.authorize` before a single byte is touched — the vault cannot be opened destructively without my second factor.
- **If you ask me about screens, presenters or the API client → that's Student 4's area.**
  Here's how my part feeds it: my `440 MFA_EMAIL_CHALLENGE`, `403 STEP_UP_REQUIRED` and `409 TOKEN_REUSE` codes are the routing decisions the eight auth screens and the `ApiClient` are built on — the client never guesses when to demand a second factor, my status codes tell it.
- **If you ask me about audit findings or the fix comments → that's Student 5's area.**
  Here's how my part feeds it: the B-1, B-2 and B-3 findings live in my `TokenService.rotate` and are the reason the revocation commits first — their IDs are cited in my files' comments, greppable during the defence.
- **If you ask me about builds, configuration or deployment → that's Student 6's area.**
  Here's how my part feeds it: my `MailService` reads the `BREVO_*` variables and the `MAIL_MODE` switch from their fail-fast `Config`, and the dev-mode `X-Dev-OTP` header is what makes the live demo possible without sending real email.
- **Who most often bridges to me: Student 4.**
  Every question about the login, MFA, reset, step-up or security screens ends in one of my mechanisms — the client owns the UX of the handshake, I own the handshake.