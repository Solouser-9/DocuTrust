# DocuTrust — Per-Student Defence Pack (Summary)

Full pitches, layman analogies and examiner Q&A live in **`DEFENCE_GUIDE.md`** (repository root) and in **DocuTrust_Defence_QA.docx / .pdf**. This file is the quick-reference map; the roles below match the defence guide 1:1.

| Student | Owns (server) | Owns (mobile) | Feature claims | Signature demo |
|---|---|---|---|---|
| 1 — Infrastructure & DB | Router, middleware chain, JWT service, error envelope, config/boot, migration runner, HikariCP pool, schema V01–V12 (15 tables) | Dashboard, navigation shell, screen registry | FT-193–202, FT-206–208, FT-173/177/178 | Boot log prints `migrations=12, routes=74`; one request crossing the whole middleware chain, live |
| 2 — Auth & OTP security | AuthService, PasswordService (PBKDF2), TokenService (rotation + reuse detection), MfaService, OtpService, MailService (Brevo), StepUpService, rate limiter | 8 auth screens + MFA email fallback + step-up prompts | FT-001–024 + FT-217–234 (post-audit addendum) | Forgot-password → emailed OTP → reset; login with `useEmailMfa` → 440 → tokens, live |
| 3 — Business logic | DocumentService, FileVault (AES-256-GCM), ShareService (atomic guards, passcode, OTP gating), VerifyService (version pinning), invites | 12 vault screens (list, detail, upload, versions, history, folders, search, trash, expiring) | FT-025–070, FT-071–096, FT-209–212 | Tamper demo: flipped vault bytes → verification flips to `tampered`; gated share answers 401 until the OTP is quoted, live |
| 4 — Mobile app | — (owns the API client contract) | All 46 screens, 9 frontend microservices, MVP infra, ApiClient single-flight refresh; Expo SDK 58 (RN 0.88) + mobile `.env` (`EXPO_PUBLIC_API_URL`) | FT-133–172, FT-173–178 + mobile side of FT-217–234 | Trash: "Delete forever" → 403 STEP_UP_REQUIRED → emailed code → destroy, on device |
| 5 — The 8-pass audit | Hardening batches 1–3; finding IDs B-1 (fail-open reuse revocation), B-3, C-1 (phantom audit), D-1, E-3, H-1, H-3, F-4 | — | Audit findings, greppable in code | `grep B-1` in TokenService: the comment tells the story; every flow re-driven live with manual API calls (Postman/cURL) |
| 6 — Deployment & DevOps | pom.xml, config fail-fast, metrics/health, ExpiryScheduler, seeder | — | Infra libraries + ops surface + root `.gitignore` (secrets/build output never committed) | Clean clone → `mvn clean package` → boot → `/api/health` shows pool + metrics |

> **Note:** every claim above is verifiable from the public repository alone — finding IDs are greppable in the code comments, `mvn clean package` builds and boots the server from a clean clone, and each signature demo runs live at the defence.

## Individual defence formula (everyone)

1. **Pitch (≤ 1 min):** what I own → the hard problem inside it → the mechanism → the proof (a live demo or a greppable artefact).
2. **Analogies (3 ready):** explain your hardest concepts to a non-technologist — HikariCP is a restaurant host, an OTP is a VIP wristband, step-up auth is a bank vault (full sets per student in `DEFENCE_GUIDE.md`).
3. **Q&A (3 deep):** the three questions an examiner is most likely to ask *you*, rehearsed word-for-word.
4. **Bridge, never bluff:** "that's Student N's area — here's how my part feeds it." The bridge map is at the bottom of `DEFENCE_GUIDE.md`.
5. **Own your numbers:** 74 routes · 15 tables · 12 migrations · 46 screens · 216+18 features · 8 pinned libraries · Expo SDK 58 with `expo-doctor` 20/20.
6. **Universal answers:** why no Spring (brief + transparency) · proudest (the OTP security chain, all demoable) · weakest (notification transport; named, with a fix path) · next week (push, object storage, cursor pagination).
