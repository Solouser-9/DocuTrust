# DocuTrust — 3-Week Roadmap (6 students)

Sprint cadence: 3 weeks × 5 working days. Daily 15-min stand-up, demo every Friday.
Rule of thumb: each student owns one backend module + its screens + its docs (vertical slices).

## Week 1 — Foundations (auth, schema, skeleton)

| Days | Student 1 (lead/architect) | Student 2 | Student 3 | Student 4 | Student 5 | Student 6 |
|------|---------------------------|-----------|-----------|-----------|-----------|-----------|
| 1–2 | Repo, folder architecture, pom.xml, HttpServer spike, Router + JSON util, first green `mvn clean package` | Users + organisations migrations V01, UserDao, PasswordService (PBKDF2) | Documents + folders migrations V02, DocumentDao skeleton | Shares + versions migrations V03, ShareDao | Verification + notifications migrations V04 | Admin reviews + audit migrations V05, indexes V06–V08 |
| 3 | JWT service (HMAC), refresh rotation, AuthController | Register/login endpoints, validation util | Upload endpoint (multipart parser), AES-GCM FileVault | Share token mint + public open endpoint | Verification mint + public verify endpoint | RoleGuard middleware, audit service |
| 4 | Wire routes, error envelope, CORS, logging middleware | Refresh/logout/forgot/reset flows | Document CRUD + list filters/pagination | Share revoke + stats + incoming | Approve/reject + HTML verify page w/ SEO | Admin users/status endpoints |
| 5 | **Sprint demo:** register→login→upload→list happy path; JSON + password hashing shown live; seed bootstrap | Auth flows demoed live (register, login, refresh, reset) | Document flows demoed live (upload, list, folders) | Share flows demoed live (mint, open, revoke) | Verification flows demoed live (mint, verify page) | Admin flows demoed live (users, status) |

**Week 1 exit criteria:** all V01–V08 migrations (the first eight of the final eleven) applied on Supabase; auth + document flows demoed live; 45-screen navigation skeleton with theme in the mobile app.

## Week 2 — Product depth (all 46 screens, notifications, review process)

| Days | Focus |
|------|-------|
| 1 | Mobile: Auth microservice screens (8) + API client with silent refresh; Admin screens (7) wired to real endpoints |
| 2 | Mobile: Documents microservice screens (12): list/detail/upload/versions/history/folders/search/trash/expiring |
| 3 | Mobile: Sharing (3) + Verification (5) screens; public verify page polish; ExpiryScheduler + notifications service |
| 4 | Mobile: Notifications (2) + Org (3) + Profile/Security (5) screens; notification prefs; deep links |
| 5 | **Sprint demo:** full user journey + admin journey; presenter architecture review; edge-case fix list |

**Week 2 exit criteria:** all 46 screens live against the real API; 200+ features checked off; zero known UI dead-ends.

## Week 3 — Hardening, docs & defence

| Days | Focus |
|------|-------|
| 1 | Edge-case hardening: concurrent version uploads, token reuse attacks, expired-mid-session, revoked-share race, 25 MB limit, mime spoofing |
| 2 | Performance pass: trigram search, pagination totals, N+1 audit; seed data polish for demos |
| 3 | Docs freeze: API contracts, architecture + ER diagrams, FEATURES register, roadmap retro |
| 4 | Rehearsals: individual 2-minute pitches, demo run-through, rehearsal defence with tricky questions |
| 5 | **Final demo:** edge-case showpieces + Q&A dry run; tag release; zip submission |

**Week 3 exit criteria:** zero known critical bugs; every student can explain every layer; all deliverables (docs, diagrams, binaries) in repo.

## Risk register
| Risk | Mitigation |
|------|------------|
| Supabase network latency in class | Local Postgres fallback container + seed bootstrap |
| Multipart bugs late | Spike upload on day 3 of week 1 (already scheduled) |
| Screen creep beyond 45 | Screen registry frozen at week-2 start; changes need group vote |
| Uneven knowledge | Pair rotation on week-1 days 3–4; per-student defence packs |
| AES key mishandling | Key only via env var; never committed (checked at every review) |

## Post-submission hardening note

After the original submission, a pre-production security audit produced three fix batches (config fail-closed hardening; session/token lifecycle surgery; final cleanup). Code-facing results visible in this tree: migrations now run **V01–V09** (V09 adds `verification_requests.version_id` — proof links are pinned to the exact version minted, and the public verify page flags superseded proofs), the registered route count is **65** (`reset-password` now registered and rate-limited), transactions are single-level, and the docs (`FEATURES.md`, `API_CONTRACTS.md`, diagrams) were re-synced to the shipped code. The sprint tables above are kept as the historical plan.
