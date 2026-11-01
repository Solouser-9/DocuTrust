# DocuTrust — Master Feature Register (216 numbered features)

Every feature has a stable ID (`FT-xxx`) used in the defence pack, commit messages and demo scripts. Modules map 1:1 to frontend microservices.

## M1 — Authentication & Account Access (FT-001 … FT-024)
| ID | Feature |
|----|---------|
| FT-001 | Email+password registration with server-side validation |
| FT-002 | Password strength meter (client) + PBKDF2 hashing (server) |
| FT-003 | Duplicate-email conflict detection (409) |
| FT-004 | Personal vs organisation account creation (orgName branch) |
| FT-005 | Login with device + IP recording |
| FT-006 | JWT access token issue (15 min, HMAC-SHA256, hand-rolled) |
| FT-007 | Rotating refresh token issue (7 days, SHA-256 hashed at rest) |
| FT-008 | Silent token refresh on 401 in the mobile API client |
| FT-009 | Refresh-token reuse detection → family revocation |
| FT-010 | Logout revokes refresh token server-side |
| FT-011 | Email verification link flow |
| FT-012 | Forgot-password with no user enumeration |
| FT-013 | Single-use 15-minute reset codes |
| FT-014 | Reset password with strength rules |
| FT-015 | TOTP MFA setup (Base32 secret + otpauth URL) |
| FT-016 | MFA enable after code confirmation |
| FT-017 | MFA challenge during login (HTTP 440 MFA_REQUIRED) |
| FT-018 | MFA disable with code proof |
| FT-019 | Rate limiting on auth endpoints (10/min/IP) |
| FT-020 | Security screen "where am I signed in": shows the current device session (client-side only — there is no server-side session-list endpoint; `refresh_tokens` rows are never exposed as a list) |
| FT-021 | Change password with current-password proof |
| FT-022 | Edit profile (fullName, phone) |
| FT-023 | Security screen (MFA state, sessions, change password) |
| FT-024 | Splash → onboarding → auth gating by token presence |

## M2 — Documents & Vault (FT-025 … FT-070)
| ID | Feature |
|----|---------|
| FT-025 | Multipart upload (pdf/png/jpg/webp/doc/docx, ≤25 MB) |
| FT-026 | Server-side SHA-256 computed while streaming |
| FT-027 | AES-256-GCM encryption before bytes touch disk |
| FT-028 | Random 12-byte IV per file, GCM tag verified on read |
| FT-029 | Vault key loaded from environment, never in code |
| FT-030 | Document metadata record with title/type/description |
| FT-031 | 10 document types (passport, national_id, …) |
| FT-032 | Expiry date capture (real-world expiry of the paper) |
| FT-033 | Per-document reminder window (1–90 days) |
| FT-034 | Documents list with pagination |
| FT-035 | Full-text search over titles (pg_trgm ILIKE) |
| FT-036 | Filter by status |
| FT-037 | Filter by type |
| FT-038 | Filter by folder |
| FT-039 | Sort by created_at/title/expiry, asc/desc |
| FT-040 | Result count + total pages in meta |
| FT-041 | Document detail screen |
| FT-042 | Edit metadata (PATCH) |
| FT-043 | Move document between folders |
| FT-044 | Soft delete → trash |
| FT-045 | Restore from trash |
| FT-046 | Permanent delete (also removes encrypted bytes) |
| FT-047 | Trash screen listing deleted documents |
| FT-048 | New version upload (multipart) |
| FT-049 | Automatic version number N+1 under concurrency (UNIQUE guard) |
| FT-050 | Version list with sha256, size, uploader, time |
| FT-051 | Download current version (decrypted stream) |
| FT-052 | Download any historical version |
| FT-053 | Content-Disposition with original filename |
| FT-054 | Integrity check: sha256 recomputed on every download |
| FT-055 | Document history timeline (append-only) |
| FT-056 | History actor + IP + JSON detail display |
| FT-057 | Status badges: pending_review/active/expiring/expired/archived |
| FT-058 | Expiring-soon screen (days_left computed in SQL view) |
| FT-059 | Expiring filter by horizon (7/14/30/90 days) |
| FT-060 | Folders create / rename / delete |
| FT-061 | Duplicate folder-name constraint (per owner+parent) |
| FT-062 | Folder detail with contained documents |
| FT-063 | Delete folder → documents keep (folder_id=NULL) |
| FT-064 | Folder doc counts on folder list |
| FT-065 | Sensitive types (medical, financial) forced into admin review |
| FT-066 | pending_review status shown to owner, invisible to sharers |
| FT-067 | Upload progress UI + retry |
| FT-068 | Client-side file type pre-check + friendly errors |
| FT-069 | Empty states with vault-themed illustrations |
| FT-070 | Pull-to-refresh on all lists |

## M3 — Sharing & Permissions (FT-071 … FT-096)
| ID | Feature |
|----|---------|
| FT-071 | Share creation form (doc picker, permission, expiry) |
| FT-072 | view vs download permission levels |
| FT-073 | Expiring share links (hours, server-enforced) |
| FT-074 | Optional max view count |
| FT-075 | Optional passcode (hashed server-side) |
| FT-076 | Direct user-to-user shares (in-app) |
| FT-077 | Public link with 43-char URL-safe token |
| FT-078 | Public share metadata screen (no bytes) |
| FT-079 | Passcode gate on public open |
| FT-080 | Atomic view_count increment (transaction, no lost updates) |
| FT-081 | Max-views enforcement → SHARE_MAX_VIEWS |
| FT-082 | Expiry enforcement → SHARE_EXPIRED (410) |
| FT-083 | Instant revocation by owner → SHARE_REVOKED |
| FT-084 | Single-use 5-minute download tickets |
| FT-085 | Ticket invalidated after one use |
| FT-086 | Incoming shares inbox |
| FT-087 | My-shares management list |
| FT-088 | Per-share stats (views, last viewed) |
| FT-089 | Revoke confirmation dialog |
| FT-090 | Copy link to clipboard |
| FT-091 | Share status badges (active/expired/revoked/exhausted) |
| FT-092 | Owner notified when a link is opened |
| FT-093 | Share rows block access to pending_review documents |
| FT-094 | Downloads of view-only shares blocked server-side |
| FT-095 | Share history rows written on open/download |
| FT-096 | Public share hit rate limiting |

## M4 — Verification (FT-097 … FT-116)
| ID | Feature |
|----|---------|
| FT-097 | Create verification request (verifier name/org/purpose) |
| FT-098 | Mint unique verification token |
| FT-099 | Two-step activation: owner approves before link works |
| FT-100 | Verification expiry window (days) |
| FT-101 | Public verify page — SEO meta tags, Open Graph, JSON-LD |
| FT-102 | JSON API mode for the same token (Accept-based) |
| FT-103 | Proof payload: pinned version + its sha256, issued date, status, superseded flag (F-4) — no file bytes |
| FT-104 | Result valid / invalid / tampered / expired / revoked |
| FT-105 | Tamper detection: stored sha256 vs recomputed bytes mismatch → tampered |
| FT-106 | Verification status shown on owner's list |
| FT-107 | Verification detail screen with shareable link |
| FT-108 | Owner approve/reject actions |
| FT-109 | Expired verification auto-cleanup |
| FT-110 | Notification when a verifier checks the proof — **Not implemented** (public verify persists the result and audits tamper events, but sends no notification) |
| FT-111 | Anti-guessing: 43-char token + rate limit |
| FT-112 | Revoked document → verification result revoked |
| FT-113 | Permanently deleted document → verification invalid |
| FT-114 | Requested-fields (JSONB) ready for selective disclosure |
| FT-115 | Admin can reject flagged verification requests |
| FT-116 | Verification request history rows |

## M5 — Notifications & Settings (FT-117 … FT-132)
| ID | Feature |
|----|---------|
| FT-117 | In-app notification inbox (newest first, paginated) |
| FT-118 | Unread count badge (`meta.unreadCount` on list) |
| FT-119 | Mark one read / mark all read |
| FT-120 | Expiry warning generator (scheduler, once per document/day) |
| FT-121 | Configurable reminder offset (settings) |
| FT-122 | Status auto-transition active→expiring→expired by scheduler |
| FT-123 | Share-viewed notifications |
| FT-124 | Verification-update notifications |
| FT-125 | Admin-decision notifications |
| FT-126 | Per-type notification preferences toggles |
| FT-127 | Notification tap → deep-link to entity screen |
| FT-128 | Relative time formatting ("2 h ago") |
| FT-129 | Notification preferences persisted per user (settings table) |
| FT-130 | Read/unread visual distinction |
| FT-131 | Push-ready payload structure (documented) |
| FT-132 | Empty inbox state |

## M6 — Administrative Review (FT-133 … FT-156)
| ID | Feature |
|----|---------|
| FT-133 | Admin dashboard with live counters (v_admin_stats) |
| FT-134 | Review queue with status filter |
| FT-135 | Sensitive-document review cards (target join) |
| FT-136 | Approve decision → document becomes active |
| FT-137 | Reject decision with note → owner notified |
| FT-138 | Escalate decision |
| FT-139 | Admin user directory with search + filters |
| FT-140 | Suspend / activate / re-pend accounts |
| FT-141 | Self-suspension guard (admin cannot suspend self) |
| FT-142 | Suspended users blocked at token level |
| FT-143 | Platform-wide documents view (read-only) |
| FT-144 | Platform audit log browser (filter by action/actor) |
| FT-145 | Audit rows capture IP + user agent + meta JSON |
| FT-146 | Every admin decision writes an audit row |
| FT-147 | Review queue pagination |
| FT-148 | Review decision notes persisted |
| FT-149 | Admin notifications on new pending reviews |
| FT-150 | Role guard middleware `requireRole("admin")` on every admin route |
| FT-151 | Admin stats cached per request cycle — **Not implemented** (`stats()` queries `v_admin_stats` fresh on every call; no cache layer) |
| FT-152 | Review detail screen with full context |
| FT-153 | Bulk visual status chips |
| FT-154 | Admin action confirmation dialogs |
| FT-155 | Reviewer + reviewed_at stamping |
| FT-156 | Cross-module integrity: reject review → document archived (`status='archived'`, `review_status='rejected'`) + owner notified + audit row. Link death is tied to state, not to the decision itself: `deleted` → 410 GONE / verify `invalid`; `pending_review` → 403; an archived document's existing share/verify links stay usable |

## M7 — Organisation Management (FT-157 … FT-172)
| ID | Feature |
|----|---------|
| FT-157 | Organisation creation during register (orgName branch) |
| FT-158 | Creator becomes org_manager automatically |
| FT-159 | Member list with roles + status |
| FT-160 | Invite member by email (creates pending user) |
| FT-161 | Invite role selection (member/org_manager) |
| FT-162 | Change member role |
| FT-163 | Remove member from organisation |
| FT-164 | Cannot demote/remove yourself guard |
| FT-165 | Org stats screen (members, shared docs) |
| FT-166 | Manager role guard on org endpoints |
| FT-167 | Org-scoped member search — **Not implemented** (`GET /api/org/members` has no search parameter) |
| FT-168 | Pending invites visible in member list |
| FT-169 | Org name on profile |
| FT-170 | Personal accounts have NULL org (documented difference) |
| FT-171 | Member removal revokes their shares |
| FT-172 | Org activity feed from audit_logs (org members) — **Not implemented** (no route registered; audit logs are admin-only via `/api/admin/audit-logs`) |

## M8 — Mobile App Experience & Navigation (FT-173 … FT-192)
| ID | Feature |
|----|---------|
| FT-173 | 45-screen navigation map with role-based stacks |
| FT-174 | MVP pattern: every screen = View + Presenter + Model |
| FT-175 | BasePresenter state machine (idle/loading/success/error/empty) |
| FT-176 | usePresenter hook binds presenter lifecycle to React |
| FT-177 | Frontend microservices: 9 self-contained modules with own api/model/presenters (auth, documents, folders, sharing, verification, notifications, admin, org, profile) |
| FT-178 | Module registry pattern for navigation wiring |
| FT-179 | Ink & parchment design system (palette, type scale, radii, shadows) |
| FT-180 | Stamp-style status badges (rotated, dashed ring) |
| FT-181 | Timeline component for history |
| FT-182 | Skeleton loaders (never spinners-only) |
| FT-183 | Toast system for action feedback |
| FT-184 | Confirmation dialogs for destructive actions |
| FT-185 | Form validation with inline field errors |
| FT-186 | Keyboard-safe scroll views |
| FT-187 | Pull-to-refresh everywhere |
| FT-188 | Empty-state illustrations per context |
| FT-189 | Profile screen with account summary |
| FT-190 | Settings hub screen |
| FT-191 | Help & FAQ screen |
| FT-192 | About screen with feature/role metadata from /api/meta |

## M9 — Server Platform (FT-193 … FT-208)
| ID | Feature |
|----|---------|
| FT-193 | Pure Java 21 HTTP server (com.sun.net.httpserver) |
| FT-194 | Hand-written Router with path params (:id) + query parsing |
| FT-195 | Modular monolith layers: Router→Controller→Service→DAO |
| FT-196 | Hand-rolled JSON serializer/parser (no external libs) |
| FT-197 | PostgreSQL connection pool with health check |
| FT-198 | SQL migrations runner (V01→V09, idempotent by filename via `schema_migrations`, one transaction per file, comment/string/dollar-quote-aware splitter — no checksums) |
| FT-199 | PreparedStatements everywhere (SQL-injection safe) |
| FT-200 | TransactionManager with rollback-on-exception |
| FT-201 | CORS for the Expo dev origin |
| FT-202 | Global exception mapping to error envelope |
| FT-203 | Request logging middleware |
| FT-204 | Bootstrap seeder: demo org + 6 accounts (admin, manager, member, 3 students) + sample data; runs only when `SEED_DEMO=true` and the database is localhost |
| FT-205 | Expiry scheduler thread (60 s tick) |
| FT-206 | Health endpoint with DB ping |
| FT-207 | /api/meta endpoint powering About + SEO |
| FT-208 | Graceful shutdown closing pool + scheduler |

## M10 — Data, Search & Integrity (FT-209 … FT-216)
| ID | Feature |
|----|---------|
| FT-209 | 14-table relational schema with CHECK + FK constraints |
| FT-210 | Append-only triggers on document_history and audit_logs |
| FT-211 | Auto-history trigger on document changes |
| FT-212 | Version-head sync trigger (documents.sha256 mirror) |
| FT-213 | Expiring-documents SQL view + admin stats view |
| FT-214 | Trigram search indexes |
| FT-215 | Partial indexes for hot queries (owner_alive, token_active) |
| FT-216 | Seed dataset for offline demos |

**Totals: 216 numbered features across 10 modules.**

---

## OTP Security Overhaul (post-audit addendum, FT-217 … FT-232)

The audit's OTP security overhaul: one hashed, single-use, purpose-salted code engine (`email_otps`, V10) powering five flows, plus the infrastructure upgrade. Verified by the 31-step E2E suite and 42 unit tests.

| ID | Feature |
|----|---------|
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
| FT-232 | 31-step black-box E2E suite covering every OTP flow including negative paths (wrong codes, wrong recipient, reuse-after-use) |

**Totals: 216 numbered features across 10 modules + 16 post-audit security features (FT-217…FT-232).**
