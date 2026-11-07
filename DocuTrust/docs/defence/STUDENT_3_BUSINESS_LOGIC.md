# Student 3 — Business Logic (Documents, Sharing, Verification) — Masterclass Deep Dive

This file is the complete rehearsal brief for the team member presenting **Student 3 — Business Logic: Documents, Sharing, Verification** at the DocuTrust oral defence (Group 3), and the companion read for examiners who want to check every claim against the repository.
It expands the matching role section in **`DEFENCE_GUIDE.md`** at the repository root — the master index that carries the shared numbers, the individual defence formula and the bridge map — into a full file-by-file ownership map, a method-by-method code walkthrough, a plain-words glossary, and a personal question bank.
Read your role section in `DEFENCE_GUIDE.md` first, then rehearse from here; `docs/defence/STUDENT_PACK.md` in the same folder is the one-page summary of all six roles, and every class, method, column and endpoint named below exists in the repo and can be opened live during the defence.

## My slice in one page

**Role in one line:** the bytes and the doors — encrypted storage, versioned documents, and the share engine that faces strangers.

**Owns:** `DocumentService` (vault, versions, trash, the Caffeine read cache), `FileVault` (AES-256-GCM encryption at rest), `ShareService` (atomic guards, passcodes, OTP gating, download tickets), `VerifyService` (proof links pinned to versions); the `DocumentController`, `ShareController`, `PublicController` and `VerificationController` endpoints; the `documents` / `document_versions` / `document_history` / `shares` schema; and the twelve vault screens on the mobile side.

**Feature claims:** FT-025 to FT-070 (Documents & Vault), FT-071 to FT-096 (Sharing & Permissions), FT-209 to FT-212 (data integrity), plus the Phase-5 OTP-gating features FT-223 and FT-224 from the security addendum (`docs/FEATURES.md`).

**My numbers:**

- 74 API routes, printed at boot (`routes=74`, `server/src/main/java/com/docutrust/Main.java`) — the 13 document routes, the 6 owner share routes, the 5 public share/download routes, the 5 verification routes and the public verify page are mine.
- 15 database tables built by 12 migrations; V02 builds `documents`, V03 builds `document_versions` / `document_history` / `shares`, V09 pins verification to versions, V11 adds the OTP-gating fields on `shares`.
- The share and tamper demos run live: API calls flip a share through open, revoke and 409, and the two-byte tamper flip turns a verification verdict to `tampered` in front of the audience.
- 45 mobile screens, of which the **12 vault screens** are mine.
- Uploads: **25 MB** cap (`413` beyond it), 6 allowed MIME types (`415` otherwise), 10 document types, sensitive types `medical` and `financial` forced into admin review.
- Encryption at rest: **AES-256-GCM**, random 12-byte IV per file, 128-bit authentication tag, 8 KB streaming chunks, key from the environment (`VAULT_KEY`, never in code); **SHA-256 computed while streaming** and re-verified on every download.
- Sharing: 43-character link tokens, expiry up to 8760 hours, optional max views and passcode, instant revocation, **single-use 5-minute download tickets**, and optional OTP gating pinned to one recipient inbox (`401 SHARE_OTP_REQUIRED` until verified).
- Verification: verdicts `valid / invalid / tampered / expired / revoked`, each proof pinned to one document version (V09 / F-4) with a `superseded` flag when a newer version exists; no bytes ever leave the vault.
- Cache: a 10-second, 1,000-entry Caffeine read-through cache on ownership-scoped document rows, invalidated explicitly on every write path (INFRA-2 / FT-228).

> **Note:** every claim in this brief is verifiable from the public repository alone — the finding IDs are greppable in the code comments, and every guard and verdict is demonstrated live at the defence with manual API calls (Postman/cURL).

## Elevator pitch (≈ 1 minute)

> "I own the actual product: documents and the promises we make about them. Every file is encrypted with AES-256-GCM before it touches disk and fingerprinted with SHA-256; every download re-verifies that fingerprint, so tampering announces itself. Sharing is governed by atomic database guards — expiry, view counts, revocation, passcodes, and now optionally an emailed OTP pinned to one recipient's inbox: the link answers 401 until that inbox proves control of a code. Verification links don't just say 'valid' — since V09 each proof is pinned to an exact document version, so the verdict is cryptographically bound to the bytes that existed at mint time. And the invite flow no longer emails temporary passwords: the invitee claims their account with an emailed OTP and chooses their own password. The proof: live API calls flip a share through open, revoke and 409, and the tamper demo turns a verification verdict to `tampered` on screen."

Then demo: on your local machine, flip two bytes inside a file in the vault directory and refresh the verification link — the badge flips from `valid` to `tampered` in front of the audience; then create a 30-second share, open it twice, and let the third open answer `409 SHARE_MAX_VIEWS` while the whole audience watches the link die.

## What I own, file by file

### The services and the vault — the chefs and the safe

| File | What it does, in one sentence |
|---|---|
| `server/src/main/java/com/docutrust/service/DocumentService.java` | The vault domain: multipart upload with streaming SHA-256 and AES-GCM encryption, ownership-scoped list/search/filter/sort with pagination, metadata patch, soft delete and restore, step-up-gated permanent delete with a tombstone fallback, version upload at N+1 under a UNIQUE guard, integrity-checked downloads of any version, the append-only history timeline, the expiring-soon view, and a 10-second Caffeine read cache that every write invalidates. |
| `server/src/main/java/com/docutrust/vault/FileVault.java` | The encryption-at-rest engine: every file is AES-256-GCM encrypted with a fresh 12-byte IV written as a ciphertext prefix and a 128-bit tag appended, encrypted and SHA-256-fingerprinted in the same 8 KB streaming pass, and decrypted only after the tag verifies — a mismatch throws `TamperedException` and the document answers "tampered" instead of serving bytes. |
| `server/src/main/java/com/docutrust/service/ShareService.java` | The share engine: owner CRUD for user-to-user and public link shares with PBKDF2-hashed passcodes, max views and instant revocation; the public open path runs one atomic guard `UPDATE` that increments the view count only if the link is unrevoked, unexpired and under its limit; OTP-gated links (Phase 5) verify an emailed code before opening; download permission mints single-use 5-minute tickets held in a `ConcurrentHashMap` and removed on first redemption. |
| `server/src/main/java/com/docutrust/service/VerifyService.java` | The proof engine: owner-minted verification requests pinned at creation to the exact current version (F-4, V09), a two-step approve/reject lifecycle, and a public verify that decrypts the pinned version inside the vault, recomputes its SHA-256, and renders `valid / invalid / tampered / expired / revoked` plus a `superseded` flag as JSON or an SEO HTML page — no bytes leave the vault. |

### The controllers — the waiters taking the orders

| File | What it does, in one sentence |
|---|---|
| `server/src/main/java/com/docutrust/controller/DocumentController.java` | The 13 document endpoints: multipart upload, list, detail, patch, soft delete, restore, step-up-gated permanent delete, add version, list versions, download current or a specific version, history, and the expiring horizon query. |
| `server/src/main/java/com/docutrust/controller/ShareController.java` | The 6 owner share endpoints: my shares, create (user share XOR link share, with optional passcode / max views / OTP gating), revoke, delete, per-share stats with history, and the incoming shares inbox. |
| `server/src/main/java/com/docutrust/controller/PublicController.java` | The no-auth surface strangers touch: share metadata, share open, `request-otp` and `open-with-otp` for gated links, download-by-ticket, and the verify endpoint that answers HTML (SEO meta, Open Graph, JSON-LD) or JSON depending on the `Accept` header. |
| `server/src/main/java/com/docutrust/controller/VerificationController.java` | The verification lifecycle endpoints: create, list mine, detail, approve, reject — the public half lives in `PublicController`. |

### The schema — migrations V02, V03, V09 and V11

| Column (table `documents`, V02) | What it holds, in one sentence |
|---|---|
| `id UUID PRIMARY KEY` | The document's identity — also the name everything else points at. |
| `owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE` | The one account that can ever touch this row; every query I write filters on it. |
| `folder_id UUID REFERENCES folders(id) ON DELETE SET NULL` | Optional folder; deleting a folder leaves documents alive with a null folder. |
| `title VARCHAR(200) NOT NULL` | The human name, search-enabled via trigram indexes. |
| `doc_type VARCHAR(50) NOT NULL` | One of ten CHECK-constrained types (`passport` … `other`); `medical` and `financial` are the sensitive pair. |
| `status VARCHAR(20) NOT NULL` | The lifecycle: `pending_review / active / expiring / expired / archived / deleted`. |
| `review_status VARCHAR(20) NOT NULL` | The review wheel: `none / submitted / approved / rejected`. |
| `current_version INTEGER NOT NULL DEFAULT 1` | The pointer that defines "the current version" — downloads and verification resolve through it. |
| `file_size / mime_type / sha256` | The mirror of the current version's facts, kept in sync by the V07 version-head trigger (FT-212). |
| `expires_at DATE / reminder_days INTEGER` | The paper's real-world expiry and the 1–90 day reminder window feeding the expiring radar. |
| `created_at / updated_at / deleted_at` | Lifecycle timestamps; `deleted_at` non-null is what "in the trash" means. |
| constraint `documents_sensitive_needs_review` | The engine-level rule: a `medical` or `financial` document physically cannot be `active` unless `review_status = 'submitted'` — a Java bug cannot bypass it. |

| Column (table `document_versions`, V03) | What it holds, in one sentence |
|---|---|
| `id UUID PRIMARY KEY` | The version's identity — the pin target for verification links. |
| `document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE` | Which document this version belongs to. |
| `version_number INTEGER NOT NULL CHECK (version_number >= 1)` | 1, 2, 3… — and `UNIQUE (document_id, version_number)` is what turns an upload race into a clean 409 instead of a phantom version. |
| `storage_key VARCHAR(200) NOT NULL` | The encrypted object's address in the vault (`xx/<uuid>.bin`) — never the document's name, so the filesystem leaks nothing. |
| `sha256 CHAR(64) NOT NULL` | The fingerprint of the exact plaintext bytes, computed while streaming — the heart of every integrity verdict. |
| `file_size BIGINT NOT NULL CHECK (file_size > 0) / mime_type VARCHAR(120) NOT NULL` | What was uploaded and in what format, re-checked against the allowlist. |
| `note VARCHAR(300) / uploaded_by UUID NOT NULL / created_at` | Who added this version, when, and why it matters. |

| Column (table `document_history`, V03) | What it holds, in one sentence |
|---|---|
| `id / document_id / actor_id` | The timeline row's identity, its document, and who acted (null for anonymous public opens). |
| `action VARCHAR(40) NOT NULL` | `created, version_added, shared, share_revoked, downloaded, edited, share_opened, verification_requested`… |
| `detail JSONB NOT NULL DEFAULT '{}'` | The structured facts of the event — share IDs, view IPs, version numbers. |
| `ip VARCHAR(45) / created_at` | Where and when — and the V07 trigger `trg_history_immutable` makes UPDATE and DELETE physically impossible: the timeline is append-only. |

| Column (table `shares`, V03 + V11) | What it holds, in one sentence |
|---|---|
| `id UUID PRIMARY KEY` | The share's identity. |
| `document_id / owner_id` | Which document, and whose link it is — both foreign keys, both checked on every owner route. |
| `shared_with_user_id UUID` | A direct user-to-user share — or NULL when this is a link share. |
| `link_token VARCHAR(64) UNIQUE` | The public link's secret: exactly 43 URL-safe characters (`shares_link_token_format` CHECK), and `shares_target_required` enforces user-share XOR link-share. |
| `permission VARCHAR(20) DEFAULT 'view'` | `view` or `download` — download-only mints tickets, view-only gets `403` if it tries. |
| `max_views INTEGER / view_count INTEGER DEFAULT 0` | The clicker and its ceiling — both CHECK-constrained positive, and the atomic guard makes the count unable to overshoot. |
| `passcode_hash VARCHAR(128)` | The passcode's PBKDF2 hash — the same machinery as passwords, never the passcode itself. |
| `expires_at TIMESTAMPTZ NOT NULL / revoked_at TIMESTAMPTZ` | The mandatory life-end and the instant kill switch; either one makes the guard update zero rows. |
| `require_otp BOOLEAN DEFAULT FALSE / otp_recipient_email VARCHAR(255)` (V11) | The Phase-5 gate: the owner pins exactly one inbox at creation time, and the link answers `401 SHARE_OTP_REQUIRED` until that inbox proves a freshly emailed code. |

### The endpoints I own

| Endpoint | What it does, in one sentence |
|---|---|
| `POST /api/documents` | Multipart upload: validates, encrypts, computes the SHA-256 while streaming, and inserts document + version 1 + history in one transaction. |
| `GET /api/documents` | Ownership-scoped, paginated list with `search`, `status`, `type`, `folder`, `sort`, `order`. |
| `GET /api/documents/:id` | One document's metadata (served through the 10-second Caffeine cache). |
| `PATCH /api/documents/:id` | Metadata edits; reclassifying to a sensitive type re-enters the review queue automatically. |
| `DELETE /api/documents/:id` | Soft delete to trash; `POST /api/documents/:id/restore` brings it back. |
| `DELETE /api/documents/:id/permanent` | Step-up-gated hard delete: purge if the append-only trigger allows, tombstone if it refuses; encrypted bytes deleted after commit either way. |
| `POST /api/documents/:id/versions` | New version at N+1; a concurrent loser gets `409 CONFLICT` from the UNIQUE guard. |
| `GET /api/documents/:id/versions` | The version list with sha256, size, uploader and time. |
| `GET /api/documents/:id/download` (and `.../versions/:v/download`) | Decrypts, re-verifies the SHA-256, and streams with a `Content-Disposition` filename; no version requested means the current one (H-1 fix). |
| `GET /api/documents/:id/history` | The append-only timeline, newest first. |
| `GET /api/documents/expiring?days=30` | The expiring-soon radar from the `v_expiring_documents` SQL view. |
| `POST /api/shares` (+ `GET /api/shares`, `GET /api/shares/incoming`, `POST /api/shares/:id/revoke`, `DELETE /api/shares/:id`, `GET /api/shares/:id/stats`) | The owner's share cockpit: create, inspect, kill, and watch. |
| `GET /api/public/shares/:token` | Public metadata only — title, type, owner name, flags; never bytes. |
| `POST /api/public/shares/:token/open` | The atomic guarded open: counts the view or names the exact reason it refused. |
| `POST /api/public/shares/:token/request-otp` | Emails a 6-digit access code — only to the owner-pinned address; a mismatching request gets `403` without revealing the designated recipient. |
| `POST /api/public/shares/:token/open-with-otp` | Verifies code (+ passcode), then performs the same atomic open; single-use means each open costs one OTP. |
| `GET /api/public/download/:ticket` | Redeems the single-use 5-minute ticket, decrypts, re-verifies the digest, streams. |
| `POST /api/verification-requests` (+ list, detail, approve, reject) | Mints the version-pinned proof token and runs the two-step activation. |
| `GET /api/public/verify/:token` | The public verdict: JSON, or the SEO HTML card when `Accept: text/html`. |

## Five layman's analogies

1. **The share guard is a nightclub bouncer with a clicker.**
   Every condition — not expired, not revoked, under the maximum guest count — is checked in the same motion as counting you in: one atomic `UPDATE`.
   There is no moment where the bouncer checks the list, gets distracted, and two extra people slip in; the database either counts you in or names the exact reason it didn't.
2. **An OTP-gated share is a registered letter with a doorman.**
   Anyone holding the link can knock (the metadata is visible), but the doorman only opens for the one name the owner wrote on the envelope — and only after that person shows the one-time code that was just posted to their address.
   A forwarded link is useless without the doorman's handshake.
3. **Version pinning is a notarized photocopy.**
   A verification link doesn't say "this person's passport is real" — it says "the copy we notarized on Tuesday matches the bytes you're looking at." If the owner uploads a new version on Wednesday, the link honestly reports: the notarized copy is valid, and by the way, a newer version now exists.
4. **The vault is airport luggage wrap with a built-in seal checker.**
   Before your suitcase goes on the belt it is sealed in strong film (AES-256-GCM) with a serial-printed seal (the 128-bit GCM tag); at the far end, the desk re-checks the seal *before* unwrapping.
   Anyone who opened the bag and re-wrapped it — even with the same film — cannot recreate the original seal, so interference announces itself instead of passing silently.
5. **A download ticket is a cinema stub torn at the door.**
   The share link is the advertisement, not the admission: the box office (the atomic open) checks the showtime (expiry), the head count (max views) and the banning list (revocation) in one motion, then hands you a stub valid five minutes.
   The usher tears it on entry — a photographed stub from yesterday, or a copy of yours, opens nothing.

## The critical code walkthrough

### Flow (a) — upload: stream once, hash while streaming, encrypt, one transaction

1. **Route + controller.** `POST /api/documents` → `DocumentController.upload()` → `DocumentService.upload(ctx.user, ctx.multipart(), ctx.ip())`.
2. **Validation before any bytes are stored.**
   The multipart `file` part must exist and be non-empty; `file.data.length > MAX_FILE_BYTES` (25 MB) throws `413 FILE_TOO_LARGE`; `DocumentService.resolveMime` normalises the content type (falling back to a filename extension guess) and rejects anything outside `ALLOWED_MIME` — PDF, PNG, JPEG, WebP, DOC, DOCX — with `415 UNSUPPORTED_MEDIA_TYPE`.
   Title and `docType` go through `Validator.required` and `Validator.oneOf(DOC_TYPES)`; a supplied `folderId` must already belong to the caller (`folderIdOrNull` checks `SELECT 1 FROM folders WHERE id = ? AND owner_id = ?`).
3. **The vault address.** `FileVault.newStorageKey()` returns a two-level fan-out path like `ab/ab…-….bin` from a UUID — unguessable, and `FileVault.pathOf` refuses any key containing `..` or a leading `/`, so a crafted key cannot escape the vault directory.
4. **One streaming pass: hash and encrypt together.**
   `FileVault.encrypt(in, storageKey)` writes a fresh 12-byte `SecureRandom` IV as the first bytes of the file, initialises `Cipher.getInstance("AES/GCM/NoPadding")` in encrypt mode with `GCMParameterSpec(128, iv)`, and then runs this loop — the exact code from `FileVault.java`:

```java
while ((n = in.read(buf)) > 0) {          // 8 KB chunks
    digest.update(buf, 0, n);             // SHA-256 in the same pass
    size += n;
    byte[] ct = cipher.update(buf, 0, n); // AES-GCM ciphertext to disk
    if (ct != null) out.write(ct);
}
out.write(cipher.doFinal());              // 128-bit GCM tag appended
```

   Plaintext is never written anywhere: the bytes flow from memory into the cipher and only ciphertext lands on disk, while `digest` accumulates the fingerprint of the plaintext.
If anything throws, the `catch` deletes the partial target file — no broken ciphertext is ever left behind.
The method returns `Stored(sha256, size)`.
5. **One transaction, three inserts.** Inside `db.tx`, `upload` inserts the `documents` row (status `pending_review` with `review_status 'submitted'` for the sensitive pair, `active` otherwise — and the `documents_sensitive_needs_review` CHECK would refuse anything else), inserts `document_versions` row number 1 with the `storage_key`, the `sha256` and the size, and — for sensitive types — inserts the `admin_reviews` queue entry and notifies every active admin.
   The `document.uploaded` audit row, carrying the sha256 and size, is written in the same transaction: either the document exists with its fingerprint and its history, or nothing exists.
6. **The promise this buys.** Every later read path — owner download, share download, public verification — re-decrypts and re-hashes the bytes and compares against this stored digest (`DocumentService.decryptAndVerify` / `ShareService.downloadByTicket` / `VerifyService.publicVerify`), so the fingerprint minted at upload time is the referee for the file's whole life.

### Flow (b) — share open: the atomic guard, the ticket, and the tamper flip

1. **Route + rate limit.** `POST /api/public/shares/:token/open` is registered `rateLimited(..., "public-share", ...)` in `Main.java` — 30/min per IP for the whole public share scope — then `PublicController.shareOpen()` → `ShareService.publicOpen(token, passcode, ip)` → the shared path `doOpen(token, passcode, ip, otpVerified=false)`.
2. **Find and classify.** Inside one `db.tx`, `findLink` looks the token up (`SELECT id FROM shares WHERE link_token = ?`, `404` if unknown) and `throwIfUnusable` → `classify` returns a *named* refusal: `409 SHARE_REVOKED` (owner revoked), `410 SHARE_EXPIRED`, `409 SHARE_MAX_VIEWS`, `410 GONE` (document hard-deleted), `403` (document pending review).
   The public caller always learns exactly why a link is dead — and never receives bytes from a dead one.
3. **The gates in front of the count.** If the share is OTP-gated and no verified OTP is attached, the answer is `401 SHARE_OTP_REQUIRED` (Phase 5: the code only ever travels to the owner-pinned `otp_recipient_email`, and `requestShareOtp` refuses a mismatching email with `403` without revealing the designated address).
   If a passcode is set, `passwords.verify(passcode, passcodeHash(...))` checks it against the PBKDF2 hash — `403 SHARE_PASSCODE_REQUIRED` / `403 SHARE_PASSCODE_INVALID`.
4. **The atomic guard — the whole policy in one statement.**
   This is the exact SQL from `ShareService.doOpen`:

```sql
UPDATE shares SET view_count = view_count + 1
WHERE id = ? AND revoked_at IS NULL AND expires_at > now()
  AND (max_views IS NULL OR view_count < max_views)
```

   Because the conditions live in the `WHERE` clause of the increment itself, Postgres row locking serialises two simultaneous opens: the loser updates zero rows, and the count can never overshoot `max_views`.
Zero rows moved means we re-read the share and re-classify, so the caller still gets the *specific* reason (`SHARE_REVOKED`, `SHARE_EXPIRED`, `SHARE_MAX_VIEWS`) rather than a vague conflict.
5. **The ticket.** If `permission = 'download'`, the same transaction mints `ticket = Text.token()` (43 characters) and stores `new Ticket(shareId, now + 5 minutes)` in a `ConcurrentHashMap` (swept when it grows past 10,000 entries).
   The response carries the ticket; the bytes do not.
6. **The record-keeping, joined to the same transaction.**
   The owner gets a `share_opened` notification, `document_history` gets a `share_opened` row with the IP, and the `share.opened` audit row is inserted with the *same* connection (actor stays null — anonymous public opener).
   The comment in the code records why: the old overload opened a second pool connection inside this transaction, and its audit row could commit even when the open rolled back — the C-1 "phantom audit" fix lives here too.
7. **Redeeming the ticket.** `GET /api/public/download/:ticket` → `ShareService.downloadByTicket`: the first thing it does is `tickets.remove(ticket)` — removal *is* the single-use mechanism, so a second request with the same ticket finds nothing (`404`); an expired ticket answers `410 GONE`.
   It then loads the share's current version row, `vault.decryptBytes(storageKey)`, and re-verifies `Text.constEq(dec.sha256(), blob.sha256())` before streaming — and it re-checks nothing else about the share: the guard already counted this visit.
8. **The tamper flip, on verification.**
   `GET /api/public/verify/:token` → `VerifyService.publicVerify`: after the status checks (pending/rejected → `410 GONE`; expired → `expired`; document deleted → `revoked`; document gone → `invalid`), it resolves the *pinned* version — `req.versionId` from V09 (F-4), falling back to the current version for pre-V09 rows — and decrypts that version inside the vault.
   Then the verdict in one line:

```java
result = Text.constEq(dec.sha256(), row.versionSha()) ? "valid" : "tampered";
```

   A `FileVault.TamperedException` (GCM tag failure — someone altered the stored ciphertext) also maps to `tampered`, and a `verification.tamper_detected` audit row is written.
The proof payload carries the pinned version's sha256, `version`, `currentVersion` and the `superseded` flag — a newer upload leaves the sealed verdict standing but tells every consumer (JSON and the amber notice on the HTML page) that a newer version exists.
No bytes ever leave the vault.

### How every refusal is named — the share `classify` matrix

| Situation (checked in order by `ShareService.classify` / `doOpen`) | What the stranger sees |
|---|---|
| Owner revoked the share (`revoked_at` set) | `409 SHARE_REVOKED` — "revoked by its owner" |
| `expires_at` has passed | `410 SHARE_EXPIRED` |
| `view_count` has reached `max_views` | `409 SHARE_MAX_VIEWS` |
| The document was hard-deleted | `410 GONE` — "Shared document no longer exists" |
| The document is pending admin review | `403` — pending documents are invisible to strangers |
| OTP-gated link, no verified code yet | `401 SHARE_OTP_REQUIRED` — with the `request-otp` route named in the message |
| Passcode missing / wrong | `403 SHARE_PASSCODE_REQUIRED` / `403 SHARE_PASSCODE_INVALID` |
| The guard `UPDATE` matched zero rows | re-read and re-classify — the same named reason, never a vague conflict |

### The verification verdicts — decided in one pass

| Verdict (`VerifyService.publicVerify`) | Trigger | Audit / persistence |
|---|---|---|
| `expired` | request past `expiresAt`, or status already `expired` | result persisted |
| `invalid` | document row gone (hard delete), or the pinned version row is missing | result persisted |
| `revoked` | document status `deleted` (tombstoned) | result persisted as `revoked` |
| `valid` | pinned version decrypted, recomputed SHA-256 equals the stored digest | result persisted |
| `tampered` | digest mismatch, or `FileVault.TamperedException` (GCM tag failure) | `verification.tamper_detected` audit row + result persisted |

In every verdict the proof payload carries the pinned version's sha256, `version`, `currentVersion` and the `superseded` flag — and no bytes ever leave the vault, which the HTML footer says in plain words.

## My domain, in plain words (glossary)

| Term | Plain meaning, with an everyday analogy |
|---|---|
| AES-256-GCM | The airport luggage wrap for files: strong modern encryption *plus* a built-in seal, so the wrapped thing cannot be read or silently altered. Banks use the same family of standards. |
| GCM tag (128-bit) | The tamper-evident seal printed on the wrap: any modification of the stored ciphertext — even one flipped bit — makes the seal fail at unwrap time, and we answer "tampered" instead of serving bytes. |
| IV (initialisation vector) | The unique twist pattern given to each wrap: 12 fresh random bytes per file, written in front of the ciphertext, so two identical documents still encrypt to completely different bytes. |
| SHA-256 fingerprint | The notary's fingerprint of the exact bytes, taken while they stream past; store the fingerprint, and every future reader can check the file still matches. |
| Storage key | The safe-deposit box number (`ab/<uuid>.bin`), never the document's name — the filesystem reveals nothing about what is inside. |
| Version pinning | The notarized photocopy: a proof link is nailed to the exact version that existed when it was minted, so later uploads cannot quietly re-point the promise at different bytes. |
| Atomic guard | The bouncer with a clicker: expiry, revocation and the head count are checked in the same single motion as counting you in — one `UPDATE`, database-locked, no gap to slip through. |
| Single-use download ticket | The cinema stub torn at the door: five minutes, one entry, worthless afterwards even if photographed. |
| Soft delete vs tombstone | The kitchen bin vs the demolition: soft delete is recoverable trash; permanent delete empties the bytes and, if the audit ledger refuses to lose the row, leaves a stripped "tombstone" — title replaced, hash nulled, file gone. |
| Append-only history | A ledger glued shut: the `trg_history_immutable` trigger makes every UPDATE or DELETE of `document_history` an error, so even a database console can only add pages. |
| Ownership scoping | Every query carries `WHERE owner_id = ?` — your bank statement is printed with your account number in the query itself, not checked as an afterthought; someone else's document simply does not exist for you (a 404, never a 403 that would confirm it exists). |
| Passcode hash | The bouncer checks the secret knock by comparing fingerprints, not by writing the knock down: share passcodes go through the same PBKDF2 machinery as passwords. |
| `superseded` flag | "The notarized copy is still valid — and a newer version now exists": the sealed verdict stands, honestly annotated. |
| `409` vs `410` | Two different rubber stamps: 409 conflict ("revoked" or "out of views" — the link was killed), 410 gone ("expired" — its time simply ran out). |
| OTP-gated share | The registered letter with a doorman: the link can be knocked on by anyone, but it opens only for the one pinned inbox, after a code that was just posted to it. |

## My ultimate Q&A bank

### From the per-student pack (the classics)

**Q: "Why stream the hash instead of hashing after saving?"**

> Because plaintext should exist in as few places and moments as possible. Streaming lets me compute the digest while transferring to the encryptor in the same pass, so there is no intermediate plaintext file on disk and no second read. It also gives honest file sizes and rejects oversize uploads before we have stored anything.

**Q: "What exactly does the GCM tag protect against that a plain hash does not?"**

> They protect different axes. The hash tells us what we wrote at upload time; the GCM tag is verified against the key during decryption, so it detects any modification of the stored ciphertext afterwards, even by someone with disk access but not the key. We use both: the tag at decrypt time, the digest for the tamper evidence we can show users and verifiers.

**Q: "A user uploads two versions at the same moment. Trace it."**

> Both services read the current max version, both target N plus one, both insert inside transactions; the UNIQUE constraint on document and version number lets the first commit and rejects the second, which we catch and rethrow as a 409 CONFLICT after rolling back — no orphan file, no phantom row. The client then offers a retry, and the loser's staged bytes are deleted. The edge-case demo runs this from two terminals simultaneously.

**Q: "Why one atomic UPDATE instead of check-then-increment in code?"**

> Because check-then-increment is a race: two opens can both pass the check and both increment, overshooting max_views. Making the guard the WHERE clause of the increment means Postgres row locks serialise the two, and the loser matches zero rows — the count can never exceed the limit. One statement is also the audit-friendly unit: rows moved, or not.

**Q: "You chose tickets over signed URLs for public downloads. Defend that."**

> A signed URL is valid until it expires; you cannot revoke it early, which breaks our instant-revocation guarantee. A ticket is a server-side grant: single-use, five minutes, bound to one share, redeemed through the same guard path. The cost is one lookup per redemption; the benefit is that revocation is truly instant for downloads too. We logged this decision in the roadmap because the losing option was reasonable.

### The masterclass ten

**Q: "Your permanent delete is sometimes called a 'tombstone' — which is it, and when?"**

> Both, deliberately, and the code shows the decision.
> `DocumentService.permanentDelete` first tries a hard purge inside a `SAVEPOINT perm_del`: it temporarily disables the `trg_history_immutable` trigger, runs `DELETE FROM documents WHERE id = ?`, and re-enables the trigger.
> If the database still refuses — the append-only history policy can block cascading deletes for audit reasons — we `ROLLBACK TO SAVEPOINT`, delete the version rows instead, and reduce the document row to a tombstone: title replaced with `[Permanently deleted]`, description, sha256, file size and mime nulled, status `deleted`.
> Either way the response says which mode happened, and the encrypted bytes are deleted with `vault.delete(...)` only *after* the transaction commits — the file is always gone; the question is only whether the history row remains.
> That is the audit trail winning on purpose.

**Q: "Why does pinning verification to a version make the whole scheme honest?"**

> Before V09, a proof link effectively said "the current version is valid" — so an owner could upload different bytes after minting a proof and the public verdict would silently follow the new bytes.
> F-4 pins `verification_requests.version_id` at mint time, and `VerifyService.publicVerify` proves that exact version's bytes against that exact version's stored sha256, forever.
> If a newer version exists, the verdict stays valid — the sealed promise still holds — but the payload and the HTML page carry `superseded: true` with the current version number, so nobody is misled.
> The migration even backfilled every pre-existing request to the version that was current at migration time, preserving legacy behaviour exactly.
> Honesty here is a schema column, not a hope.

**Q: "What happens to a share that dies *while* someone is mid-download?"**

> Two honest boundaries. A download that has already been redeemed and is streaming finishes — we do not cut sockets mid-flight, because the guard counted that visit.
> But the ticket cannot be used again (`tickets.remove` is the single-use mechanism), and every *new* open re-runs the atomic guard: the moment the owner revokes, the `WHERE revoked_at IS NULL` clause makes the update match zero rows and the visitor gets the named reason, `409 SHARE_REVOKED`, not bytes.
> So "dies mid-download" decomposes into: the current download completes, and the next one never starts.
> The same logic covers expiry and max views — the guard is re-evaluated per open, never cached.

**Q: "Why does ownership scoping live in the SQL `WHERE` clause instead of an `if` in Java?"**

> Because you cannot forget a check that is part of the statement itself.
> Every document query I own carries `WHERE id = ? AND owner_id = ?` — `fetchOwned`, `fetchOwnedShare`, `fetchOwnedDoc` — so a wrong ID from another user simply matches nothing and yields the same `404` as a missing document; the API does not even leak that the row exists, which a `403` would.
> If the check were an `if`, one new endpoint written at 2am could omit it and the data would still be one query away.
> The role guards on top (admin/org_manager/member, in Student 1's middleware) are a separate layer, and every refusal lands in `audit_logs` — but the ownership guarantee is in the SQL, enforced on every statement, every time.

**Q: "What exactly does the Caffeine cache cache, and how does it stay honest?"**

> It caches the ownership-scoped document row behind the hot detail and list views — the `docKey` is `ownerId + "/" + docId`, so a cached entry is only ever valid for the same owner — with a 10-second write expiry and a 1,000-entry cap.
> Every mutation path invalidates explicitly: `patch`, `softDelete`, `restore`, `permanentDelete` and `addVersion` all call `docCache.invalidate(docKey(...))` after their transaction commits.
> Writes also re-check ownership in the database regardless of the cache, so the cache can only ever make a *read* up to ten seconds stale — never grant access, never skip a check.
> That is the standard trade we named in the code comment (INFRA-2): bounded staleness for hot reads, with the write path as the source of truth.

**Q: "Walk me through what the version race loser actually experiences."**

> Both requests pass validation, both encrypt their staged ciphertext under different storage keys, both open transactions, both compute `MAX(version_number) + 1` — and both try to insert that same number.
> The `UNIQUE (document_id, version_number)` constraint in V03 lets the first commit and rejects the second; `Tx.with` rolls the loser back, and the exception surfaces as `409 CONFLICT` to that client, which offers a retry that will then cleanly create version N+2.
> The staged ciphertext of an *encryption* failure is deleted synchronously inside `FileVault.encrypt`'s own catch block (`Files.deleteIfExists`), so the vault does not accumulate broken objects from failed writes.
> The database is the referee; the loser is told instantly and precisely.

**Q: "Share passcodes are hashed with PBKDF2 — the same 120,000-iteration machinery as passwords. Overkill?"**

> No, and the reason is the same one that justifies it for passwords: a share passcode is a human-chosen, low-entropy secret that we hand to strangers over a public link, which makes it the most guessable credential in the system.
> PBKDF2 at 120,000 iterations with a per-share salt means each guessing attempt costs real CPU *on the attacker's side*, and the stored `passcode_hash` column never contains the passcode itself.
> Reusing `PasswordService` also means the comparison is constant-time and the format (`pbkdf2$iterations$salt$key`) is self-describing, so a future cost upgrade is a one-line change.
> The one thing we deliberately did *not* build is a separate weaker path for "just a share password" — separate weak paths are how systems leak.

**Q: "What stops someone brute-forcing share tokens or verification tokens?"**

> The tokens themselves are the first fence: 43 URL-safe characters from `Text.token()` — 32 random bytes from `SecureRandom` — so the search space is roughly 2-to-the-256 and there is no structure to learn from one token that helps guess another.
> The second fence is the rate limiter: the whole public surface runs in scoped buckets — 30/min per IP for share endpoints, 20/min for public verify — so automated guessing is throttled to a pace that cannot traverse even a trivial fraction of the space within any link's lifetime.
> The third fence is time: shares carry a mandatory `expires_at` and verification requests an expiry in days, so every target has a countdown regardless.
> And failures are observable — every successful open is audited with the IP, so a probing pattern is visible in the trail.

**Q: "If a second server instance ran against the same database and vault, what breaks first?"**

> Honestly: the download tickets, and I would name that before an examiner does.
> Tickets live in a per-process `ConcurrentHashMap` in `ShareService`, so a ticket minted by instance A is unresolvable at instance B — the same is true of the Caffeine document cache, though that one only costs ten seconds of staleness on reads.
> The database-level guarantees survive happily: the atomic guard, the UNIQUE version constraint and the append-only triggers are all Postgres-side, and the vault directory could be shared or moved behind an object store later.
> The roadmap answer is already written: object storage behind the same `FileVault` interface and a shared ticket store (or short-lived signed grants) — the single-process assumption is a named, scoped limitation, not a surprise.

**Q: "The verify endpoint serves an HTML page built by string concatenation. How is that not an injection risk?"**

> Because the document title — attacker-controlled data in an attacker-controlled position — never reaches the HTML unescaped.
> Every interpolated value goes through `esc()`, which escapes `& < > " '` before insertion into the page, and the JSON-LD block goes through `jsonLdSafe`, which additionally escapes `<`, `>`, `&` and `/` as `\u003c`, `\u003e`, `\u0026` and `\/` — escapes that a JSON parser decodes back to the original characters but that make it impossible for the HTML parser to see a closing `</script>` tag.
> That specific pair of findings is A-3 and F-2 in the audit: a raw `</script>` inside a document title would otherwise have closed the script block and injected markup.
> The page also sends `noindex` and carries Open Graph metadata, so it is both safe and presentable when pasted into a chat or a report.

## The handshake — how my slice feeds the other five

- **If you ask me about tables, constraints, triggers or the transaction runner → that's Student 1's area.**
  Here's how my part feeds it: my four core tables (`documents`, `document_versions`, `document_history`, `shares`) are migrations V02/V03 with the engine-level rules they built — the sensitive-review CHECK, the version UNIQUE guard, the append-only trigger — and every atomic guard I write executes on their `Database.tx` runway.
- **If you ask me about passwords, JWTs, OTPs or step-up → that's Student 2's area.**
  Here's how my part feeds it: my OTP-gated shares mint their codes with Student 2's `OtpService` (purpose `share_access`, the V11 fields on my `shares` table), and my `permanentDelete` refuses to run until their `StepUpService.authorize` sees a valid `X-Step-Up-Token` — the vault's most destructive door is locked by the auth slice.
- **If you ask me about screens, presenters or navigation → that's Student 4's area.**
  Here's how my part feeds it: the twelve vault screens are thin views over my endpoints — my named error codes (`SHARE_MAX_VIEWS`, `STEP_UP_REQUIRED`, the `superseded` flag) are exactly what their presenters translate into the UI, and the amber superseded notice on the verify result screen is my payload rendered.
- **If you ask me about audit findings or the fix comments → that's Student 5's area.**
  Here's how my part feeds it: H-1 (current-version download resolution), H-3 (owner payload sha256), F-4 (version pinning), C-1/C-8 (the phantom-audit fix inside my open transaction) and A-3/F-2 (the HTML escaping) are all fixes to my files — their IDs are cited in my files' comments, and the tamper demo is the live integrity proof.
- **If you ask me about deployment, config or the scheduler → that's Student 6's area.**
  Here's how my part feeds it: my `FileVault` key comes from their fail-fast `VAULT_KEY` environment check, their ExpiryScheduler retires my expired shares and verification requests every sixty seconds, and their Dropwizard timers measure my routes on `/api/health`.
- **Who most often bridges to me: Student 4.**
  Every question about the vault screens — upload, versions, history, trash, shares, verify — ends in one of my services; the client draws the doors, I build and guard them.
