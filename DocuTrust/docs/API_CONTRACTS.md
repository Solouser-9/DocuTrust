# DocuTrust — REST API Contract (v1)

Base URL: `http://localhost:8080` · All bodies are JSON unless marked *multipart*.
Auth = `Authorization: Bearer <accessToken>` (15 min) + rotating refresh token (7 days).

## Conventions

**Success envelope** — every response is wrapped:
```json
{ "ok": true, "data": { ... }, "meta": { "page": 1, "limit": 20, "total": 143, "pages": 8 } }
```
`meta` appears only on paginated list endpoints. Page starts at **1**.

**Error envelope** — always this shape, never raw stack traces:
```json
{ "ok": false, "error": { "code": "VALIDATION_ERROR", "message": "Email is not valid", "field": "email" } }
```

| HTTP | code | meaning |
|------|------|---------|
| 400 | VALIDATION_ERROR | field-level validation failed |
| 400 | OTP_INVALID | emailed code wrong, expired, already used or attempt-capped |
| 401 | UNAUTHORIZED | missing/expired/invalid access token |
| 401 | TOKEN_EXPIRED | access token expired (client must refresh) |
| 401 | SHARE_OTP_REQUIRED | OTP-gated link: the pinned recipient must verify an emailed code first |
| 403 | FORBIDDEN | authenticated but role/ownership check failed |
| 403 | SHARE_PASSCODE_REQUIRED | link needs passcode |
| 403 | SHARE_PASSCODE_INVALID | wrong passcode |
| 403 | STEP_UP_REQUIRED | destructive action needs a fresh `X-Step-Up-Token` (from verify-step-up) |
| 404 | NOT_FOUND | resource missing or not yours |
| 409 | CONFLICT | duplicate email, concurrent version, token reuse |
| 409 | SHARE_EXPIRED / SHARE_REVOKED / SHARE_MAX_VIEWS | link no longer usable |
| 410 | GONE | expired link (public verify/share) |
| 413 | FILE_TOO_LARGE | > 25 MB |
| 415 | UNSUPPORTED_MEDIA_TYPE | file type not allowed |
| 429 | RATE_LIMITED | too many attempts (Bucket4j token bucket per scope + IP) |
| 440 | MFA_REQUIRED | TOTP code required for this account |
| 440 | MFA_EMAIL_CHALLENGE | email-MFA fallback: body carries `challenge`; POST it with the emailed code to /api/auth/verify-otp |
| 502 | MAIL_SEND_FAILED | Brevo rejected/failed the OTP email (live mode only) |
| 500 | INTERNAL_ERROR | logged in audit_logs, generic message to client |

**Pagination**: `?page=1&limit=20` (max limit 100). **Search**: `?search=term` (ILIKE via pg_trgm on title/email). **Filtering**: `?status=&type=&folder=`. **Sorting**: `?sort=created_at&order=desc`.

**Roles**: `admin` > `org_manager` > `member`. Server enforces everything; the UI only hides by role.

---

## 1. Auth (public)

| Method | Path | Roles | Request | Response data |
|--------|------|-------|---------|---------------|
| POST | /api/auth/register | – | `{email, password, fullName, phone?, orgName?}` | `{user, accessToken, refreshToken, verifyToken}` |
| POST | /api/auth/login | – | `{email, password, mfaCode?, useEmailMfa?}` | `{user, accessToken, refreshToken}` · if `mfa_enabled` and no code → `440 MFA_REQUIRED` · if `useEmailMfa:true` → `440 MFA_EMAIL_CHALLENGE` with `{challenge, email (masked)}` |
| POST | /api/auth/verify-otp | – | `{challenge, code}` | exchanges an `mfa_challenge` token + emailed 6-digit code for `{user, accessToken, refreshToken}` (Phase 4 email-MFA fallback) |
| POST | /api/auth/refresh | – | `{refreshToken}` | `{accessToken, refreshToken}` (rotation: old token revoked with `replaced_by`; reuse → 409 TOKEN_REUSE — the family revocation **commits first**, an `auth.token_reuse` audit row is written, then the 409 is returned) |
| POST | /api/auth/logout | – | `{refreshToken}` | `204` |
| POST | /api/auth/forgot-password | – | `{email}` | always `200` (no user enumeration); emails a 6-digit OTP (10 min, single use, 5 attempts). The legacy reset-code-in-body pattern is **removed** |
| POST | /api/auth/reset-password-otp | – | `{email, code, newPassword}` | `204`; verifies the emailed OTP, sets the password, revokes every session |
| POST | /api/auth/accept-invite | – | `{email, code, password, fullName?}` | claims a pending org invite with the emailed 24 h invite OTP → `{user, accessToken, refreshToken}` (replaces temporary-password invites) |
| POST | /api/auth/request-step-up | any | – | `200 {message, ttlMinutes}`; emails a step-up OTP to the account's own address |
| POST | /api/auth/verify-step-up | any | `{code}` | `{stepUpToken, ttlMinutes:5}` — a single-purpose JWT for the `X-Step-Up-Token` header |
| GET | /api/auth/verify-email?token= | – | query | `{verified:true}` |
| GET | /api/auth/me | any | – | `{user}` |
| PATCH | /api/auth/me | any | `{fullName?, phone?}` | `{user}` |
| POST | /api/auth/change-password | any | `{currentPassword, newPassword}` + header `X-Step-Up-Token` | `204`; **step-up gated** — without a valid token → `403 STEP_UP_REQUIRED` |
| POST | /api/auth/mfa/setup | any | – | `{secret, otpauthUrl}` |
| POST | /api/auth/mfa/enable | any | `{secret, code}` | `{mfaEnabled:true}` |
| POST | /api/auth/mfa/disable | any | `{code}` | `{mfaEnabled:false}` |

`user` object: `{id, email, fullName, phone, role, orgId, status, mfaEnabled, emailVerified, lastLoginAt, createdAt, orgName?}` — `orgName` is emitted for org members on `GET/PATCH /api/auth/me` and on admin user rows.

**OTP engine (shared by all five flows):** codes are 6 digits from `SecureRandom`, stored only as `sha256(purpose:email:code)`, single-use, 10-minute TTL (24 h for invites), burned after 5 wrong attempts; at most one live code per (purpose, target). In `MAIL_MODE=dev` codes are echoed in the `X-Dev-OTP` response header (bodies never carry them); in `MAIL_MODE=live` they travel only by Brevo email.

## 2. Documents (auth; ownership enforced in SQL WHERE owner_id = :me)

| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | /api/documents | any | filters: `search,status,type,folder,sort,order,page,limit` |
| POST | /api/documents | any | *multipart*: `file` + `title,docType,description?,folderId?,expiresAt?,reminderDays?` → creates doc + version 1 |
| GET | /api/documents/:id | any | metadata + version list head |
| PATCH | /api/documents/:id | any | `{title?,description?,folderId?,expiresAt?,reminderDays?,docType?}` |
| DELETE | /api/documents/:id | any | soft delete (status=deleted) |
| POST | /api/documents/:id/restore | any | from trash |
| DELETE | /api/documents/:id/permanent | any | hard delete (also removes encrypted bytes); **step-up gated** — without `X-Step-Up-Token` → `403 STEP_UP_REQUIRED` |
| POST | /api/documents/:id/versions | any | *multipart* new version → version N+1, sha256 pinned, history row |
| GET | /api/documents/:id/versions | any | list of versions |
| GET | /api/documents/:id/download | any | streams decrypted file (Content-Disposition); no explicit version → the document's **current** version is served |
| GET | /api/documents/:id/versions/:v/download | any | streams that version |
| GET | /api/documents/:id/history | any | append-only audit trail, newest first |
| GET | /api/documents/expiring?days=30 | any | `v_expiring_documents` |

Document object: `{id, ownerId, folderId, title, docType, description, status, reviewStatus, currentVersion, fileSize, mimeType, sha256, expiresAt, reminderDays, createdAt, updatedAt}`

## 3. Folders (auth)

| Method | Path | Notes |
|--------|------|-------|
| GET | /api/folders | own folders, with doc counts |
| POST | /api/folders | `{name, parentId?}` (single level) |
| PATCH | /api/folders/:id | `{name}` |
| DELETE | /api/folders/:id | docs inside get `folder_id=NULL` |
| GET | /api/folders/:id/documents | paginated docs in folder |

Folder object: `{id, ownerId, parentId?, name, docCount, createdAt}`

## 4. Sharing (auth owner) + public links

| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | /api/shares | any | shares I created (with view counts) |
| POST | /api/shares | any | `{documentId, permission:"view"|"download", expiresInHours, maxViews?, passcode?, sharedWithUserId?}` — user share XOR link share · **Phase 5:** `{requireOtp: true, recipientEmail}` (link shares only) gates the link behind an emailed OTP pinned to one inbox |
| POST | /api/shares/:id/revoke | any | instant: sets revoked_at; further use → 409 SHARE_REVOKED |
| DELETE | /api/shares/:id | any | delete share record |
| GET | /api/shares/:id/stats | any | view_count, last viewed, history |
| GET | /api/shares/incoming | any | shares sent directly to me |

Share object: `{id, documentId, documentTitle, docType, ownerId, ownerName, sharedWithUserId?, linkToken? (link shares only — the secret for the public URL), permission, maxViews?, viewCount, passcodeRequired, otpRequired, otpRecipientEmail?, expiresAt, revokedAt?, createdAt}`

Public (no auth): 

| Method | Path | Notes |
|--------|------|-------|
| GET | /api/public/shares/:token | checks expiry/revocation/max_views → `{title,docType,ownerName,createdAt,permission,passcodeRequired,otpRequired}` or 410/409 |
| POST | /api/public/shares/:token/open | `{passcode?}` → increments view_count in a transaction; if permission=download returns `{downloadTicket}` (single-use, 5 min). **Phase 5:** OTP-gated links answer `401 SHARE_OTP_REQUIRED` until `open-with-otp` succeeds |
| POST | /api/public/shares/:token/request-otp | `{email}` → emails a 6-digit access code — **only to the owner-pinned recipient**; mismatching requests get 403 without revealing the designated address |
| POST | /api/public/shares/:token/open-with-otp | `{email, code, passcode?}` → verifies the emailed code (+ passcode) then performs the same atomic open as `/open`; the code is single-use, so each open costs one OTP |
| GET | /api/public/download/:ticket | streams decrypted file; ticket single-use |

## 5. Verification (auth owner) + public verify

| Method | Path | Notes |
|--------|------|-------|
| POST | /api/verification-requests | `{documentId, verifierName, verifierOrg?, purpose, expiresInDays}` → `{request}` (token minted; **pinned** to the document's current version at mint time — `request.versionId`) |
| GET | /api/verification-requests | mine, newest first |
| GET | /api/verification-requests/:id | detail |
| POST | /api/verification-requests/:id/approve | owner approves → status=approved (link becomes verifiable) |
| POST | /api/verification-requests/:id/reject | owner rejects |
| GET | /api/public/verify/:token | **HTML page with SEO meta tags** when `Accept: text/html`; JSON API result otherwise. Checks: request active? not expired? pinned version's sha256 intact (recomputed from vault bytes)? → `{status:"valid"|"invalid"|"tampered"|"expired"|"revoked", proof:{documentTitle, docType, ownerName, sha256, issuedAt, verifiedAt, verificationId, version (pinned), currentVersion, superseded}}` — no bytes leave the vault. A later upload sets `superseded: true` while the pinned verdict stands; the HTML page shows an amber superseded notice |

Verification request object: `{id, documentId, requesterId, verifierName, verifierOrg?, purpose, token, status, result?, decidedBy?, decidedAt?, expiresAt, createdAt, versionId?, documentTitle?, docType?, sha256? (pinned version's digest), ownerName?}`

## 6. Notifications (auth)

| Method | Path | Notes |
|--------|------|-------|
| GET | /api/notifications?unread=&page=&limit= | inbox, newest first + `meta.unreadCount` |
| POST | /api/notifications/:id/read | marks read |
| POST | /api/notifications/read-all | marks all read |
| GET | /api/settings/notifications | `{expiryAlerts, shareAlerts, verificationAlerts, adminAlerts, reminderOffsetDays}` |
| PUT | /api/settings/notifications | same shape, upsert; **partial bodies are fine** — omitted booleans/days fall back to the defaults (`true` / `14`) on first save, or keep the already-saved values on later updates |

## 7. Admin (role=admin) — server-side role guard

| Method | Path | Notes |
|--------|------|-------|
| GET | /api/admin/stats | `v_admin_stats` → `{totalUsers, pendingUsers, totalOrgs, totalDocuments, queueDocuments, activeShares, pendingVerifications}` |
| GET | /api/admin/review-queue?status=pending | admin_reviews joined with targets; rows carry `targetTitle`, `docType`, `sha256`, `submitterEmail`, `decisionNote` |
| POST | /api/admin/reviews/:id/decision | `{status:"approved"|"rejected"|"escalated", note?}` → updates target, notifies owner, audit row |
| GET | /api/admin/users?search=&role=&status=&page= | directory |
| PATCH | /api/admin/users/:id/status | `{status:"active"|"suspended"|"pending"}` (admin cannot suspend self) |
| GET | /api/admin/documents?search=&status=&page= | all documents |
| GET | /api/admin/audit-logs?search=&action=&page= | platform audit trail |

## 8. Organisation (role=admin|org_manager for members area)

| Method | Path | Notes |
|--------|------|-------|
| GET | /api/org/members | same-org members |
| POST | /api/org/invite | `{email, role:"member"|"org_manager"}` → creates pending user + notification |
| PATCH | /api/org/members/:id/role | `{role}` |
| DELETE | /api/org/members/:id | removes member (not self) |
| GET | /api/org/stats | member count, shared doc count |

## 9. Health & Meta (public)

| Method | Path | Notes |
|--------|------|-------|
| GET | /api/health | `{ok:true, db:true, uptimeSeconds}` |
| GET | /api/meta | app metadata for SEO/indexing `{name, tagline, description, roles[], screens:45, features:216}` |

### Rate limiting
Auth endpoints (login/register/forgot-password/reset-password-otp/verify-otp/accept-invite), the step-up pair, and the public share-link and verify endpoints are rate limited per scope + IP: auth 20/min, public-share 30/min, public-verify 20/min, others 10/min → `429 RATE_LIMITED`. Implemented with Bucket4j token buckets (one per scope|IP, held in a Caffeine cache); token buckets smooth bursts instead of permitting a full window at once.

### Multipart spec
`Content-Type: multipart/form-data`; file field MUST be named `file`. Allowed mime: `application/pdf, image/png, image/jpeg, image/webp, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document`. Max size **25 MB**. Server computes SHA-256 while streaming, encrypts with AES-256-GCM, stores `<uuid>.bin` in vault dir.
