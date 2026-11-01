# DocuTrust — ER Diagram & Schema Notes

Rendered diagram: [`diagrams/er.png`](diagrams/er.png) · Mermaid source: [`diagrams/src/er.mmd`](diagrams/src/er.mmd)

> **Plain English — how to read this:** the database is the referee. Application code can have bugs, so the rules that must *never* break live here, in the schema: ownership is a column on every row, "sensitive documents need review" is a CHECK constraint, history tables refuse UPDATE/DELETE by trigger, and every one-time code is stored only as a salted hash. Fifteen tables, grouped below, describe one simple story — people in organisations own folders of documents; documents are versioned, shared and verifiable; and two tables exist purely for trust: `audit_logs` (what happened, unchangeable) and `email_otps` (short-lived proof-of-inbox codes).

> **Explain it like I'm 5:** think of the database as a **filing cabinet**. Each **table is a drawer** (`users`, `documents`, `shares`… fifteen of them), each **row is an index card** in that drawer, and every card in a drawer has the same printed **fields (columns)** — no hand-scribbled odd shapes. A **foreign key is a cross-reference on the card**: a document card says "owner: see card #42 in the USERS drawer", and the clerk refuses to file a card whose reference doesn't exist — or to destroy a user card while documents still point at it. The cabinet was built from eleven numbered instruction sheets (`V01…V11`, the **migrations**), so anyone can rebuild the identical cabinet from scratch in order, in minutes. PostgreSQL is the strict, free, 25-year-old clerk who enforces the house rules even against our own bugs.

## Tables (15)

| Group | Tables |
|---|---|
| Identity & access | `organisations`, `users`, `settings`, `refresh_tokens`, `password_resets` |
| Vault core | `folders`, `documents`, `document_versions`, `document_history` |
| Sharing & proofs | `shares`, `verification_requests` |
| Platform | `notifications`, `admin_reviews`, `audit_logs` |
| One-time codes | `email_otps` (V10 — password reset, MFA login, step-up, share access, org invites) |

## Foreign keys (all N:1, ON DELETE CASCADE unless noted)

- `users.org_id → organisations.id` (SET NULL)
- `settings.user_id → users.id` (1:1, PK+FK)
- `refresh_tokens.user_id → users.id` · `password_resets.user_id → users.id`
- `folders.owner_id → users.id` · `folders.parent_id → folders.id` (self, CASCADE)
- `documents.owner_id → users.id` · `documents.folder_id → folders.id` (SET NULL)
- `document_versions.document_id → documents.id` · `document_versions.uploaded_by → users.id`
- `document_history.document_id → documents.id` · `document_history.actor_id → users.id`
- `shares.document_id → documents.id` · `shares.owner_id → users.id` · `shares.shared_with_user_id → users.id` (nullable)
- `verification_requests.document_id → documents.id` · `.requester_id → users.id` · `.decided_by → users.id`
- `notifications.user_id → users.id` · `audit_logs.actor_id → users.id` · `admin_reviews.reviewer_id → users.id` (target is polymorphic: `target_type` + `target_id`)
- `verification_requests.version_id → document_versions.id` (SET NULL — the F-4 pin added in V09)
- `email_otps.user_id → users.id` (nullable — anonymous share recipients have no account) · `email_otps.share_id → shares.id` (nullable — share-access codes)

## The `email_otps` table (new in V10)

| Column | Type | Purpose |
|---|---|---|
| `id` | UUID PK | row identity |
| `user_id` | UUID FK, nullable | the account the code protects (NULL for share-access codes) |
| `share_id` | UUID FK, nullable | binds a share-access code to exactly one share link |
| `recipient_email` | VARCHAR(255) | the only inbox the code was sent to (lowercased target key) |
| `purpose` | VARCHAR(32) | `password_reset` · `mfa_login` · `step_up` · `share_access` · `org_invite` |
| `otp_hash` | VARCHAR(64) | SHA-256 of `purpose:email:code` — the plaintext code is nowhere in the database |
| `expires_at` | TIMESTAMPTZ | 10 minutes for personal codes, 24 hours for invites |
| `used_at` | TIMESTAMPTZ | set once on successful verification (single use, race-safe) |
| `attempts` | INT | wrong guesses increment it; at 5 the code burns |
| `created_at` | TIMESTAMPTZ | newest live code per (purpose, target) wins; issuing invalidates older ones |

**Why the salt matters (defence line):** hashing `purpose:email:code` instead of just `code` means a code captured for, say, password reset cannot be replayed as a step-up or share code even if a digest leaked — the digest simply doesn't match any other purpose's arithmetic.

## `shares` additions (V11)

- `require_otp BOOLEAN NOT NULL DEFAULT FALSE` — the link answers `401 SHARE_OTP_REQUIRED` until the pinned recipient verifies a code.
- `otp_recipient_email VARCHAR(255)` — the single inbox the access code goes to; set at creation, never accepted from the requester at open time (so the API can refuse mismatching requests without revealing who is designated).

## Rules enforced by the engine (constraints, triggers, views)

- `CHECK` enumerations: roles, statuses, document types, share permissions, plans, reminder windows.
- `documents_sensitive_needs_review`: a `medical`/`financial` document can never be `active` unless `review_status = 'submitted'` — the administrative review gate is a schema rule.
- `shares_target_required`: a share must have a recipient user **XOR** a link token; link tokens are exactly 43 chars.
- `UNIQUE (document_id, version_number)`: concurrent version uploads → one winner, one clean 409.
- `UNIQUE (owner_id, parent_id, name)` on folders; `UNIQUE email` on users.
- Append-only triggers: `UPDATE`/`DELETE` on `document_history` / `audit_logs` raise exceptions.
- Auto-history trigger on `documents` writes `created`, `version_added`, `status_changed` rows itself.
- Head-sync trigger: new `document_versions` rows update `documents.sha256 / file_size / mime_type / current_version`.
- Views: `v_expiring_documents` (expiry radar with `days_left`), `v_admin_stats` (dashboard counters).
- Key indexes: partial `documents(owner_id) WHERE deleted_at IS NULL`; GIN trigram on `title`; partial `shares(link_token) WHERE revoked_at IS NULL`; composite `(entity, created_at DESC)` for history/audit/notifications; `(purpose, recipient_email)` / `(user_id, purpose)` / `(share_id, purpose)` on `email_otps`.

## Lifecycle states

- `documents.status`: `pending_review → active → expiring → expired → archived | deleted` (scheduler-driven; `reminder_days` per document).
- `shares`: created → active → (`expired` 410 | `revoked` 409 | `max_views` 409 | document `deleted` → 410 GONE | document `pending_review` → 403); OTP-gated links additionally hold the `401 SHARE_OTP_REQUIRED` state until the pinned inbox proves a code.
- `verification_requests.status`: `pending → approved | rejected | expired`; `result`: `valid | tampered | expired | revoked | invalid`. Since V09 every request pins `version_id` at mint time; public verify proves the pinned version's bytes and sets `superseded` in the payload when a newer version exists.
- `email_otps`: `live → (verified: used_at set) | (burned: 5 attempts) | (expired: 10 min) | (superseded: a newer code for the same target was issued)`.
