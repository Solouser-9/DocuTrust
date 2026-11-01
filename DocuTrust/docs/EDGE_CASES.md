# DocuTrust — Edge-Case Demonstration Scripts

Ten scripted demos for the final presentation. Each is reproducible with the seeded accounts (see server bootstrap) and one-line curl/app steps.

| # | Edge case | Script | Expected behaviour |
|---|-----------|--------|--------------------|
| 1 | **Expired share link** | Create link with `expiresInHours: 0.01` (~36 s). Open it in the app now → works. Wait 40 s → open again | Second open returns `410 SHARE_EXPIRED`; public page shows "This link has expired"; owner sees status badge flip |
| 2 | **Instant revocation** | Create share link, open once (works), owner taps Revoke, open again | `409 SHARE_REVOKED` immediately; open verification link of same doc still fine (isolation) |
| 3 | **Max-views exhaustion** | Share with `maxViews: 2`; open twice; third open | Third open → `409 SHARE_MAX_VIEWS`; view_count frozen at 2; download ticket of an unconsumed ticket also dies (single-use) |
| 4 | **Access-token death mid-session** | Set access token aside; wait 15 min (or tamper exp); tap any list | Client gets `401 TOKEN_EXPIRED`, silently refreshes (rotating), retries → user never sees error. No audit row is written for a routine rotation — only reuse events are audited (`auth.token_reuse`, see #5) |
| 5 | **Refresh-token reuse attack** | Copy refresh token R1, call /api/auth/refresh twice with R1 | First call rotates (R1→R2). Second call → `409 TOKEN_REUSE`; the whole token family is revoked; user must log in again — presented as "stolen token detected" |
| 6 | **Role escalation attempt** | As `member`, call `GET /api/admin/users` with a valid member JWT | `403 FORBIDDEN` from RoleGuard middleware; audit row `admin_access_denied`; UI admin tab hidden by role, but the server never trusted the UI |
| 7 | **Ownership bypass attempt** | As user B, call `GET /api/documents/{id-of-user-A}` | `404 NOT_FOUND` (ownership in SQL WHERE, so B cannot even prove A's document exists) |
| 8 | **Concurrent version upload race** | Fire two version uploads at the same version simultaneously (two terminals) | One succeeds as v(N+1); the loser hits UNIQUE(document_id, version_number) → `409 CONFLICT` clean error, no corrupt state |
| 9 | **Mime spoofing / oversize file** | Upload a `.exe` renamed to `.pdf` → `415 UNSUPPORTED_MEDIA_TYPE`. Upload 30 MB → `413 FILE_TOO_LARGE`; nothing written to vault |
| 10 | **Tamper-evident verification** | Create verification link for a document; verify → `valid`. (Demo hook) overwrite 2 bytes in the vault file, verify again | Result flips to `tampered` because recomputed SHA-256 ≠ stored SHA-256; proves version integrity end-to-end |

**Bonus rapid-fire edge cases (Q&A if time allows):**
- Suspended user: admin suspends → member's next request is `403 ACCOUNT_SUSPENDED`.
- Sensitive upload: medical doc enters `pending_review`; hidden from shares until admin approves (FT-065/093).
- Folder delete: documents survive with `folder_id = NULL` (FK ON DELETE SET NULL).
- Duplicate email register → `409 CONFLICT` (UNIQUE constraint, not app logic).
- History immutability: `UPDATE document_history ...` in SQL editor → DB exception "append-only".
- Rate limit: 11th login attempt in a minute → `429 RATE_LIMITED`.
