# Student 4 — Mobile App — Masterclass Deep Dive

This file is the complete rehearsal brief for **Student 4, who owns the Mobile App slice** of DocuTrust — the React Native 0.88 / Expo SDK 58 client with its 46 screens, 9 frontend microservices, MVP pattern and single-flight `ApiClient`. It is written for the student presenting this slice and for the examiners who want to check every claim against the real repository. It expands the matching role section — *"Student 4 — Mobile App (React Native 0.88 / Expo SDK 58)"* — in `DEFENCE_GUIDE.md` at the repository root, which is the master index for all six roles; read the guide section first for the one-page story, then rehearse from here, where every claim is grounded in a file you can open on the day.

Everything named below is real: every screen name comes from `mobile/src/screens/index.js` (the `SCREEN_REGISTRY`), every class from the actual source files, every number from the tree. Where the project's standing claim is cited (doctor checks, bundle builds), it is labelled as such.

---

## My slice in one page

**Role in the team:** Everything the user touches: 46 screens, nine frontend microservices, the MVP pattern, and the app's own configuration story.

**Owns:** The Expo client — screens, components, navigation, the microservice folders (api / model / presenter each), `BasePresenter` and `usePresenter`, `ApiClient` with single-flight refresh, the Active Sessions UI, the declarative navigation tree, keyboard focus fixes, `expo-secure-store` JWT persistence, `mobile/.env` with `EXPO_PUBLIC_API_URL`, and the SDK 58 dependency matrix.

**Feature claims:** FT-133 to FT-172 and FT-173 to FT-178, plus the mobile side of FT-217 to FT-234.

**My numbers:**

- **46 screens** — the literal length of `SCREEN_REGISTRY` in `mobile/src/screens/index.js` (`SCREEN_COUNT` is exported from the same file).
- **9 frontend microservices** — `auth, documents, folders, sharing, verification, notifications, org, profile, admin`, each with its own `api.js` / `model.js` / `presenters.js`.
- **47 presenter classes** across those 9 domains (11 auth, 10 documents, 2 folders, 3 sharing, 5 verification, 2 notifications, 3 org, 4 profile, 7 admin) — count the `export class ... extends BasePresenter` lines.
- **20 shared components** in `mobile/src/components/`, one design system in `mobile/src/core/theme/`.
- **Stack:** React Native **0.88.1** on **Expo SDK 58** (`expo ^58.0.0`) with **React 19.3.0**, React Navigation 7, AsyncStorage 2.2.0 — the SDK 58 matrix in `mobile/package.json`.
- **Live conversation proof** — the emulator drives every flow, including every OTP path, against the running server; the same flows are replayed with manual API calls (Postman/cURL) side by side (standing claim, demonstrated live at the defence).
- **expo-doctor 20/20 checks clean on SDK 58** and a clean Metro/Hermes bundle (standing claim, demonstrated live on our machines).

> **Note:** every claim in this brief is verifiable from the public repository alone — the screen registry is countable, `npx expo start` bundles and runs the app from a clean clone, and every flow is demonstrated live at the defence on the emulator against the running server.

---

## Elevator pitch (≈ 1 minute)

> "I own everything the user touches. The client is React Native 0.88 on Expo SDK 58 — the newest SDK generation, with the new React Native architecture and iOS 27 support — organized as nine frontend microservices, so six students could work without collisions. The API client handles the boring-but-critical parts silently: it unwraps our response envelope, refreshes an expired access token exactly once with single-flight de-duplication, and surfaces typed error codes instead of raw failures. This sprint I rebuilt the security UX: the login MFA screen now offers 'email me a code instead' and finishes the 440 challenge; the password-reset screen takes the emailed 6-digit code; and both destructive flows — permanent deletion in Trash and password change — detect the server's 403 STEP_UP_REQUIRED, prompt for the emailed code, trade it for a five-minute step-up token and retry with the X-Step-Up-Token header. The user sees a two-tap 'confirm with the code we emailed you' step; under the hood it's a full second-factor handshake. Where the server address comes from: `mobile/.env` holds `EXPO_PUBLIC_API_URL`, `src/core/config/env.js` reads it, and the real file never reaches GitHub — only `.env.example` does. Proof on this machine: `npx expo-doctor` reports 20/20 checks clean on SDK 58, Metro bundles the whole app to Hermes bytecode, and the emulator drives the same flows against the live API."

**Then demo:** with the app and server already running (`npx expo start` beside the Java server), sign in on the emulator, trigger the Trash "delete forever" step-up phase live, and in a second window replay the same flows with manual API calls (Postman/cURL) so the audience watches the server's answers and the app's reactions side by side.

---

## What I own, file by file

### The folder structure — the app is a smartphone

Seven folders under `mobile/src/`, plus the boot and config files. Every path below is verified against the tree.

| File / folder | What it is, in one sentence |
|---|---|
| `mobile/App.js` | The boot file: hydrates the saved session from `AuthStore`, then mounts `RootNavigator` and the global `Toast` above a `SafeAreaProvider`. |
| `mobile/src/screens/` | The 45 full-page views the user sees — deliberately dumb, each drawing what its presenter hands it. `index.js` is the `SCREEN_REGISTRY`. |
| `mobile/src/components/` | 20 reusable pieces (buttons, cards, inputs, code boxes, toasts, skeletons) drawn once and shared by every screen, so the app feels like one product. |
| `mobile/src/navigation/RootNavigator.js` | The home-screen gesture: decides between the auth stack and the main stack from `AuthStore`, lays out the four tabs, and gates the admin and org stacks by role. |
| `mobile/src/mvp/BasePresenter.js` | The state machine every screen renders — five statuses, attach/detach lifecycle, a shared error-to-human-message mapper, and `go()`/`goBack()` navigation. |
| `mobile/src/mvp/usePresenter.js` | The React hook that binds a presenter to a component: creates it once, mirrors its state via `useState`, attaches on mount and destroys on unmount. |
| `mobile/src/core/api/ApiClient.js` | The only door to the network: unwraps the response envelope into `{ data, meta }`, performs the single-flight silent refresh, and throws typed `ApiError`s. |
| `mobile/src/core/api/endpoints.js` | The single source of truth for every REST path the app talks to, mirroring `docs/API_CONTRACTS.md`. |
| `mobile/src/core/config/env.js` | Runtime configuration: reads `EXPO_PUBLIC_API_URL` (defaulting to `http://localhost:8080`), and exports `APP_NAME`, `MAX_FILE_BYTES` (25 MB) and the public verify/share URL builders. |
| `mobile/src/core/store/AuthStore.js` | The tiny external session store — the JWT pair in `expo-secure-store` (Keychain/Keystore keys `accessToken`/`refreshToken`), the user profile under `docutrust.session.v1` in AsyncStorage, plus a one-time hydration upgrade that migrates legacy plaintext tokens into SecureStore and scrubs them; `isAdmin()`/`isManager()` helpers and a subscribe/emit contract. |
| `mobile/src/core/store/ToastStore.js` | A global toast queue (keeps the last three, auto-dismisses after 2.8 seconds) with `success`/`error`/`info` tones any presenter can call. |
| `mobile/src/core/theme/` | The ink-and-parchment design tokens: `palette.js`, `typography.js`, `spacing.js`, `radius.js`, `shadows.js`. |
| `mobile/src/core/utils/` | Shared helpers: `validators.js` (form rules), `formatters.js` (dates, sizes), `usePullRefresh.js` (pull-to-refresh wiring used across list screens). |
| `mobile/src/microservices/` | The nine feature domains below — each one self-contained, so six students could work without collisions. |

### The 9 frontend microservices

| Folder | Files | Presenter classes it exports |
|---|---|---|
| `microservices/auth/` | `api.js`, `model.js`, `presenters.js` | Splash, Onboarding, Login, Register, VerifyEmail, ForgotPassword, ResetPassword, Mfa, ChangePassword, SecurityMfa, Logout |
| `microservices/documents/` | `api.js`, `model.js`, `presenters.js` | Dashboard, DocumentsList, DocumentDetail, UploadDocument, EditDocument, Versions, History, Search, Trash, Expiring |
| `microservices/folders/` | `api.js`, `model.js`, `presenters.js` | Folders, FolderDetail |
| `microservices/sharing/` | `api.js`, `model.js`, `presenters.js` | Shares, ShareCreate, ShareDetail |
| `microservices/verification/` | `api.js`, `model.js`, `presenters.js` | VerificationList, VerificationCreate, VerificationDetail, PublicVerify, PublicVerifyResult |
| `microservices/notifications/` | `api.js`, `model.js`, `presenters.js` | Notifications, NotificationPrefs |
| `microservices/org/` | `api.js`, `model.js`, `presenters.js` | Org, TeamMembers, InviteMember |
| `microservices/profile/` | `api.js`, `model.js`, `presenters.js` | Profile, EditProfile, Security, Help |
| `microservices/admin/` | `api.js`, `model.js`, `presenters.js` | AdminDashboard, AdminQueue, AdminReviewDetail, AdminUsers, AdminUserDetail, AdminAudit, AdminDocuments |

Each domain splits the same way: `api.js` holds the thin `ApiClient` calls for that domain's endpoints, `model.js` holds the data shapes and mappers (what a document or share looks like when it arrives from the server), and `presenters.js` holds the screen brains.

### How `RootNavigator.js` wires the registry into stacks

One file turns the 45-entry registry into the navigation tree the user actually walks. Every piece below is a real object or function in `mobile/src/navigation/RootNavigator.js`:

| Piece | What it does, in one sentence |
|---|---|
| `linking` | Declares the `docutrust://` prefix and maps `PublicVerify: 'verify/:token'`, so a proof link opens the public verify screen without a session. |
| `useAuthSession` | Subscribes the router gate to `AuthStore` with `useSyncExternalStore` — one token commit flips the whole tree. |
| `AuthStack` | The signed-out tree: Splash, Onboarding, Login, Register, VerifyEmail, ForgotPassword, ResetPassword, Mfa — all 8 auth screens. |
| `MainTabs` | The signed-in shell: four bottom tabs — Vault, Shares, Alerts, Profile — with line-art `TabGlyph` icons drawn from plain Views. |
| `VaultStack` | Dashboard, Documents, Folders, Expiring, Trash — the vault's own five-screen stack. |
| `SharesStack` | Shares, CreateShare, ShareDetail. |
| `AlertsStack` | Notifications, NotificationPrefs. |
| `ProfileStack` | Profile, EditProfile, ChangePassword, Security, Help. |
| `AdminStack` | The 7 admin screens — mounted only when `isAdmin` is true, so a non-admin's tree contains no admin screens at all. |
| `OrgStack` | Org, TeamMembers, InviteMember — mounted only for managers (`isManager`). |
| `MODAL_SCREENS` | Seven names (UploadDocument, EditDocument, Versions, History, Search, CreateVerification, NotificationPrefs) presented as modals because they are pushed from outside their home clusters. |
| `PLAIN_SCREENS` | Eight names (FolderDetail, VerificationDetail, CreateShare, ShareDetail, AdminReviewDetail, VerificationRequests, PublicVerify, PublicVerifyResult) that must exist on the root stack because bare-name navigation bubbles up from sibling tabs and deep links. |
| `navTheme` / `screenOptions` | The parchment palette applied to the navigator itself, so navigation chrome matches the design tokens. |

### The complete 45-screen table (from `screens/index.js`)

`SCREEN_REGISTRY` maps each name to `{ component, module, title }`; `RootNavigator` mounts these, and deep links, notification taps and presenter `go()` calls all use these names. Grouped by module, exactly as the file groups them.

**Auth module (8 screens)**

| Registry name | File | One sentence |
|---|---|---|
| `Splash` | `SplashScreen.js` | The boot screen that waits a beat for `AuthStore` hydration, then replaces itself with Dashboard if a session exists or Onboarding if not. |
| `Onboarding` | `OnboardingScreen.js` | Three swipeable pages — the Vault, the Seal, the Proof — that sell the product idea in plain words before the first login. |
| `Login` | `LoginScreen.js` | The sign-in form; on `MFA_REQUIRED` it hands the pending credentials to the Mfa screen instead of showing an error. |
| `Register` | `RegisterScreen.js` | Account creation with a personal-vs-organisation switch that reveals the org name field. |
| `VerifyEmail` | `VerifyEmailScreen.js` | Confirms the emailed verification link token and tells the user whether the address is now trusted. |
| `ForgotPassword` | `ForgotPasswordScreen.js` | Starts the OTP password reset: asks for the email, triggers the six-digit code, and never reveals whether the account exists. |
| `ResetPassword` | `ResetPasswordScreen.js` | Collects the emailed 6-digit code plus the new password and submits them together to `reset-password-otp`. |
| `Mfa` | `MfaScreen.js` | The two-factor checkpoint: six code boxes over one hidden numeric field, with a "email me a code instead" fallback that finishes the 440 challenge. |

**Documents module (10 screens)**

| Registry name | File | One sentence |
|---|---|---|
| `Dashboard` | `DashboardScreen.js` | The home screen: recent documents, the expiring-soon shelf and the share count, fetched in one `Promise.all`. |
| `Documents` | `DocumentsScreen.js` | "The Vault" — the paginated, sortable list of the user's documents with pull-to-refresh. |
| `DocumentDetail` | `DocumentDetailScreen.js` | The full record card for one document: metadata, versions, history entry points and share actions. |
| `UploadDocument` | `UploadDocumentScreen.js` | Seals a new document: `expo-document-picker` picks the file, then type, reminder and review metadata are attached. |
| `EditDocument` | `EditDocumentScreen.js` | Edits the metadata of an existing document without touching its sealed bytes. |
| `Versions` | `VersionsScreen.js` | Lists every version of a document with who uploaded it and when. |
| `History` | `HistoryScreen.js` | Renders the append-only history trail as a timeline the user can read. |
| `Search` | `SearchScreen.js` | Full-text search across the vault, driven by the server's trigram indexes. |
| `Trash` | `TrashScreen.js` | Soft-deleted documents with restore or "delete forever" — and delete forever is step-up gated by an emailed OTP. |
| `Expiring` | `ExpiringScreen.js` | The expiry radar: documents inside a configurable horizon (default 30 days) before they lapse. |

**Folders module (2 screens)**

| Registry name | File | One sentence |
|---|---|---|
| `Folders` | `FoldersScreen.js` | The cabinet drawers: create, rename and browse the user's folder tree. |
| `FolderDetail` | `FolderDetailScreen.js` | One folder opened: the documents it contains and the folder's own actions. |

**Sharing module (3 screens)**

| Registry name | File | One sentence |
|---|---|---|
| `Shares` | `SharesScreen.js` | Every share link the user has issued, with status chips for revoked, expired or view-limited. |
| `CreateShare` | `CreateShareScreen.js` | Mints a link: permission level, expiry, optional view limit, optional passcode — and, since the OTP overhaul, an optional email gate. |
| `ShareDetail` | `ShareDetailScreen.js` | One link's dashboard: open counters, revoke, and the current policy in plain words. |

**Verification module (5 screens)**

| Registry name | File | One sentence |
|---|---|---|
| `VerificationRequests` | `VerificationRequestsScreen.js` | The list of proof links the user has minted, with approve/reject status. |
| `CreateVerification` | `CreateVerificationScreen.js` | Mints a verification request pinned to the document's current version. |
| `VerificationDetail` | `VerificationDetailScreen.js` | One proof's status page: the pinned version, its digest and whether the seal still holds. |
| `PublicVerify` | `PublicVerifyScreen.js` | The stranger-facing screen a `docutrust://verify/:token` deep link opens — no session required. |
| `PublicVerifyResult` | `PublicVerifyResultScreen.js` | The verdict: valid, revoked, superseded or tampered, spelled out with the pinned SHA-256. |

**Notifications module (2 screens)**

| Registry name | File | One sentence |
|---|---|---|
| `Notifications` | `NotificationsScreen.js` | The alerts inbox with read/unread state and mark-all. |
| `NotificationPrefs` | `NotificationPrefsScreen.js` | Per-event-type reminder switches stored server-side. |

**Profile module (5 screens)**

| Registry name | File | One sentence |
|---|---|---|
| `Profile` | `ProfileScreen.js` | The account summary and quick links, including the admin and org entries when the role allows. |
| `EditProfile` | `EditProfileScreen.js` | Edits the profile fields (`fullName`, `phone`) with inline validation. |
| `ChangePassword` | `ChangePasswordScreen.js` | The current-password proof — and, since the OTP overhaul, the step-up phase that confirms an emailed code before the server will touch the password. |
| `Security` | `SecurityScreen.js` | "Security & sessions": TOTP setup and disable, plus the server-backed Active Sessions list — device, IP and sign-in time per row, each with its own revoke button. |
| `Help` | `HelpScreen.js` | The FAQ accordion plus About metadata pulled live from `/api/meta`. |

**Admin module (7 screens)**

| Registry name | File | One sentence |
|---|---|---|
| `AdminDashboard` | `AdminDashboardScreen.js` | The registrar console: live counters from the admin stats view. |
| `AdminReviewQueue` | `AdminReviewQueueScreen.js` | The pending sensitive-document reviews, filterable by status, with pagination. |
| `AdminReviewDetail` | `AdminReviewDetailScreen.js` | One review's full context: the document, its owner, the decision buttons with notes. |
| `AdminUsers` | `AdminUsersScreen.js` | The user directory with search and filters. |
| `AdminUserDetail` | `AdminUserDetailScreen.js` | One user's record with suspend/activate/re-pend actions. |
| `AdminAuditLogs` | `AdminAuditLogsScreen.js` | The platform audit log browser, filterable by action and actor. |
| `AdminDocuments` | `AdminDocumentsScreen.js` | The platform-wide, read-only documents view. |

**Organisation module (3 screens)**

| Registry name | File | One sentence |
|---|---|---|
| `Org` | `OrgScreen.js` | The organisation home: stats and the manager's entry points. |
| `TeamMembers` | `TeamMembersScreen.js` | The member directory with roles, status and pending invites visible. |
| `InviteMember` | `InviteMemberScreen.js` | Invites a colleague by email with a role choice; the invite is activated by an emailed OTP, not a temporary password. |

### The shared components (`mobile/src/components/`)

| File | What it is, in one sentence |
|---|---|
| `Screen.js` | The page chrome every screen wraps itself in: title, eyebrow, safe-area padding. |
| `AppButton.js` | The single button style, with loading and disabled states. |
| `AppInput.js` | The single text-field style with inline error display. |
| `AppCard.js` | The card container that gives lists their paper-on-parchment look. |
| `Avatar.js` | Initials avatar for users and members. |
| `Chip.js` | Small status pills (roles, states, filters). |
| `CodeBoxes.js` | The six-box OTP display over one hidden field — used by Mfa, reset and step-up. |
| `ConfirmDialog.js` | The confirmation dialog for destructive actions. |
| `EmptyState.js` | The friendly "nothing here yet" panel with per-context illustrations. |
| `FileTabCard.js` | The file-tab document card used across vault lists. |
| `ListItem.js` | The generic row for directories and lists. |
| `ProgressBar.js` | The upload progress bar. |
| `SearchBar.js` | The search field with clear button. |
| `SectionHeader.js` | Section titles inside long screens. |
| `SegmentedTabs.js` | The iOS-style segmented switch (for example personal vs organisation). |
| `SkeletonRow.js` | The loading skeleton — we show shape, never spinners-only. |
| `StampBadge.js` | The rotated, dashed-ring stamp badge for statuses. |
| `StatTile.js` | The number tiles on Dashboard and AdminDashboard. |
| `Timeline.js` | The vertical timeline that renders document history. |
| `Toast.js` | The floating toast layer wired to `ToastStore`. |

### The configuration files

| File | What it is, in one sentence |
|---|---|
| `mobile/package.json` | The SDK 58 matrix: `expo ^58.0.0`, `react-native 0.88.1`, `react 19.3.0`, React Navigation 7 (`native-stack ^7.21.0`, `bottom-tabs ^7.21.0`, `native ^7.5.1`), `@react-native-async-storage/async-storage 2.2.0`, `expo-document-picker ~58.0.4`, `expo-file-system ~58.0.13`, `expo-linking ~58.0.15`, `expo-status-bar ~58.0.4`, `react-native-safe-area-context ~5.10.1`, `react-native-screens ~4.30.1`; the run entries are the four `expo start` variants (`start` / `android` / `ios` / `web`). |
| `mobile/app.json` | The Expo manifest: name DocuTrust, slug `docutrust`, version 1.1.0, deep-link scheme `docutrust`, portrait orientation, light interface style, background `#F7F3EA`, iOS bundle `app.docutrust.mobile` (no tablet), Android package `app.docutrust.mobile`, plugins for `expo-document-picker` and `expo-status-bar`, Metro/static web output — and, after the SDK 58 upgrade, no splash block, which the new schema forbids. |
| `mobile/.npmrc` | One line — `legacy-peer-deps=true` — because the SDK jump crosses React 19 and peer ranges must not hard-fail the install. |
| `mobile/.env.example` | The committed template: copy to `mobile/.env`, replace `YOUR_PC_IP_ADDRESS` with the computer's LAN IP, and `EXPO_PUBLIC_API_URL=http://YOUR_PC_IP_ADDRESS:8080` tells the app where the Java server lives; the real `.env` never reaches GitHub. |

---

## Five layman's analogies

1. **The MVP pattern is a restaurant waiter.** The screen (view) is the dining room — it never walks into the kitchen (the API). The presenter is the waiter who takes your order, talks to the kitchen, and brings back the plated result; the model is the menu's ingredient list. When the kitchen changes a recipe, the dining room doesn't move — which is exactly how we swapped the whole auth flow for OTPs without rewriting a single screen layout.
2. **Single-flight token refresh is one umbrella in a sudden downpour.** Five people walk out at once, it starts raining — they don't each buy an umbrella; one person buys it and the rest share it. When five API calls all get 'token expired' at the same moment, one refresh request goes out and the other four wait for its result, instead of stampeding the server with four identical refreshes.
3. **The step-up UI is the "are you sure?" that actually checks something.** Normal confirmation dialogs are theater — everyone clicks OK. Ours can't be skipped: the app asks for a code that was just emailed, the server won't accept the destructive request without it, and the dialog you clicked is only the first of two independent proofs.
4. **The screen registry is the phone's home-screen gesture.** You don't tell the phone "open the fourth icon in the second row of the third folder" — you say the app's name, and the phone itself knows where it lives. Every navigation in our app — a presenter's `go()`, a notification tap, a `docutrust://` deep link — says the *name* from `SCREEN_REGISTRY`, and the registry alone knows which component, which module and which title that name means. Change where a screen lives once, in one file, and forty-five other screens never notice.
5. **AsyncStorage is the app's coat pocket.** When you leave a building you keep your key in your pocket, not in your head — next morning you reach for it and you're still you. When the app is killed, the session tokens live in the phone's keystore pocket (`expo-secure-store`), while the profile card that greets you stays in the AsyncStorage pocket (`docutrust.session.v1`), so reopening the app doesn't mean signing in again. And just as you'd empty the pocket of a stolen coat, `logout()` wipes the pocket and the server revokes what was in it.

---

## The critical code walkthrough

### A. The silent-refresh handshake, method by method (`mobile/src/core/api/ApiClient.js`)

The rule: an expired access token must never be the user's problem, and a stolen refresh token must be the end of the session. Read it top to bottom:

1. **Any API call goes through `request(method, path, opts, retried)`** — the single private engine behind the five public verbs `ApiClient.get/post/patch/put/del`. It attaches `Authorization: Bearer <accessToken>` via `buildHeaders(...)` and sends the JSON body via `buildBody(...)`. A network-level failure is converted to `new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the vault...')` so screens never see a raw TypeError.
2. **A success is unwrapped once:** `res.ok && json.ok !== false` returns `{ data: json.data, meta: json.meta }` — the envelope is the client's only dialect. A 204 short-circuits to `{ data: null, meta: null }`.
3. **A 401 with code `TOKEN_EXPIRED` triggers the refresh exactly once:** `if (res.status === 401 && err.code === 'TOKEN_EXPIRED' && auth && !retried)` → `await refreshSession()` → `return request(method, path, opts, true)`. The `retried` flag is the guarantee that every waiter retries *exactly once* — no loops, ever.
4. **`refreshSession()` is single-flight by construction:** a module-level `let refreshFlight = null;` holds the in-progress promise. The first 401 creates the promise — `POST endpoints.refresh()` with the stored `refreshToken` — and every concurrent 401 in that window returns *the same promise* instead of starting its own. The `.finally()` clears `refreshFlight` when the flight lands. That is the one-umbrella rule in code.
5. **On success the new pair is stored:** `AuthStore.setTokens(json.data.accessToken, json.data.refreshToken)` — rotation means the refresh token changes every time it is used — and every waiter then replays its original request with the fresh `Bearer` header.
6. **On `TOKEN_REUSE` the session dies:** the server answered `409 TOKEN_REUSE` because a rotated token was replayed — the signature of theft. The very next block, `if ((res.status === 409 && err.code === 'TOKEN_REUSE') || (res.status === 401 && err.code === 'UNAUTHORIZED' && signedIn))`, calls `await AuthStore.logout()`, which wipes `docutrust.session.v1` from AsyncStorage and emits to every listener. `RootNavigator` is subscribed via `useSyncExternalStore(AuthStore.subscribe, ...)`, so `authed` flips to false and the **Login screen appears** — not as a pushed route but because the whole tree swaps to `AuthStack`. The thrown `ApiError` still reaches the presenter, which shows "Session expired, please sign in again."
7. **Everything else is a typed error:** `apiError = new ApiError(res.status, err.code, err.message, err.field)` plus `apiError.body = json` — the comment on that line reads *"e.g. the MFA_EMAIL_CHALLENGE 440 payload carries the challenge token"*. `BasePresenter.handleError` maps codes to human sentences through its `FRIENDLY` table (`SHARE_EXPIRED`, `SHARE_MAX_VIEWS`, `FILE_TOO_LARGE`, `RATE_LIMITED`, ...), so a screen shows "This share link has expired," never "HTTP 410".

### B. The step-up UI flow, screen by screen

1. **The destructive action is attempted normally.** `TrashPresenter.destroy(id)` calls `documentsApi.removePermanent(id)`; `ChangePasswordPresenter.submit()` calls `authApi.changePassword(current, next, this.stepUpToken)` with `stepUpToken` still null, so no header is sent.
2. **The server answers `403 STEP_UP_REQUIRED`.** The presenter catches *that specific code* — `if (e.code === 'STEP_UP_REQUIRED')` — in `mobile/src/microservices/documents/presenters.js` and `mobile/src/microservices/auth/presenters.js` respectively. It does not pre-check: discovery is the design, so the server stays the single source of truth for what counts as dangerous.
3. **The presenter requests the emailed code:** `await authApi.requestStepUp()` — `POST /api/auth/request-step-up` in `endpoints.js`. The server emails a six-digit OTP (in dev mode it also appears in the log and the `X-Dev-OTP` header). The presenter stashes the pending action (`this.pendingDestroyId = id` / resets `this.stepUpToken = null`) and flips state: `setState({ ..., data: { stepUpRequired: true, ... } })`, plus the toast "We emailed you a 6-digit code to confirm this deletion." `TrashScreen` renders the OTP phase because `const stepUpRequired = !!(state.data && state.data.stepUpRequired)`.
4. **The user types the code; the code is traded for a token.** `confirmDestroyOtp(code)` / `confirmStepUp(code)` call `authApi.verifyStepUp(code)` — `POST /api/auth/verify-step-up` — which returns a five-minute single-purpose JWT (`typ=step_up`).
5. **The original action is retried with the header.** `documentsApi.removePermanent(this.pendingDestroyId, res.stepUpToken)` and `authApi.changePassword(..., this.stepUpToken)` both attach `headers: { 'X-Step-Up-Token': stepUpToken }` — visible in `mobile/src/microservices/documents/api.js` and `mobile/src/microservices/auth/api.js`. The server checks the header before it will let go of the bytes, and the flow ends with "Removed permanently." / "Password updated."
6. **Cancel is a first-class path:** `cancelDestroyOtp()` clears `pendingDestroyId` and returns the screen to its idle list — the gate demands proof but never traps the user.

### C. The MFA email fallback (the 440 handshake)

`LoginPresenter.submit()` catches `MFA_REQUIRED` and navigates: `this.go('Mfa', { email, password })`. On `MfaScreen`, "email me a code instead" calls `MfaPresenter.sendEmailCode()`, which re-runs login with `useEmailMfa: true`; the server answers **440 `MFA_EMAIL_CHALLENGE`** with a challenge in the body — which is exactly what `apiError.body = json` preserved. `this.challenge = e.body.challenge` switches the presenter's mode to `'email'`, and `submit()` then calls `authApi.verifyOtp(this.challenge, this.code)` — `POST /api/auth/verify-otp` — to trade challenge plus emailed code for the real session tokens. `AuthStore.setSession(...)` lands them, and the auth gate switches to the main stack on its own.
**The polish pass (newest commit):** the Active Sessions UI lives in `SecurityScreen` — `SecurityPresenter.loadSessions()` fills loading, error and empty states, each row shows the device name (with an "Unknown device" fallback), the IP and the "Signed in" timestamp, and the per-row revoke button calls `revokeSession(id)`, toasts the outcome and reloads the ledger. Navigation stays declarative: every destination is a name in the 46-entry `SCREEN_REGISTRY`, and deep links and notification taps resolve through the same table. The polish pass also hardened the shell itself — `Screen.js` pads content by `insets.bottom` so nothing hides behind the gesture bar, stretches its content with `flexGrow: 1` so footers never float mid-screen, and the MFA code input gained a focus `Pressable` (`inputRef.current?.focus()`) so tapping the label re-opens the keyboard on every device.

---

## My domain, in plain words (glossary)

| Term | Plain meaning, with an everyday analogy |
|---|---|
| **MVP pattern** | Model-View-Presenter: the screen draws, the presenter decides, the model describes the data. Like a restaurant: the dining room (view), the waiter (presenter), the menu's ingredient list (model) — the dining room never walks into the kitchen. |
| **Presenter** | The screen's brain: a plain JavaScript class holding its state machine and its API calls, so the logic lives in one reviewable place without drawing anything. The waiter you always get, whatever table you sit at. |
| **View / screen** | The dumb drawing: it renders presenter state and forwards taps. The dining room that only displays plates. |
| **`usePresenter`** | The hook (React's sticky note) that connects one brain to one drawing: create it once, mirror its state, clean up when the screen closes. Hiring the waiter when you sit down and thanking them when you leave. |
| **BasePresenter state machine** | Five statuses — `idle, loading, success, error, empty` — every screen passes through. The restaurant's standard placemats: waiting, serving, sorry-we're-out, the bill. |
| **Screen registry** | `SCREEN_REGISTRY` in `screens/index.js`: name → component + module + title. The phone's home-screen gesture — you say the app's name, the phone itself knows where it lives. |
| **Single-flight refresh** | When many calls hit 401 at once, exactly one refresh request goes out and everyone shares its result. One umbrella bought in a downpour, four people under it. |
| **Access token / refresh token** | The short-lived entry wristband (15 minutes) and the long-lived re-entry card (7 days). The wristband expires all day; the card quietly prints you a new one — and if someone else uses your card after you, the club voids the whole set. |
| **Rotation & `TOKEN_REUSE`** | Every refresh issues a brand-new pair and retires the old one; presenting an already-retired one means theft, so the server answers `409 TOKEN_REUSE` and the client logs the session out. Reusing a yesterday's stamp at the door: the bouncer tears up all your stamps. |
| **440 `MFA_EMAIL_CHALLENGE`** | Our documented extension: "your password was right, now prove the second factor." The doorman saying "ID checks out — now the secret handshake," not "you're not on the list." |
| **Step-up token / `X-Step-Up-Token`** | A five-minute, single-purpose proof (an emailed code traded in) attached as a header when doing something destructive. The one-day backstage pass you get by showing your email at the office — worthless tomorrow, useless for anything but the one door. |
| **Response envelope & typed error codes** | Every server answer has the same shape — `{ ok, data, meta }` or `{ error }` — which `ApiClient` unwraps once; failures arrive as machine codes (`TOKEN_EXPIRED`, `SHARE_EXPIRED`, `FILE_TOO_LARGE`) the presenter translates into human sentences. The standard tray every plate arrives on and the departures board that shows flight-status codes, not a mechanic's diary. |
| **AsyncStorage** | The device's sandboxed key-value pocket where the session survives app restarts (`docutrust.session.v1`). Your coat pocket for the building key — per-app, wiped on logout. |
| **Deep link** | A `docutrust://verify/:token` URL that opens the app straight on the public verify screen. A named side door into one exact room of the building. |
| **Metro / Hermes** | Metro is Expo's bundler that packs the JavaScript; Hermes is the engine that runs it as bytecode. The kitchen that pre-chops everything so the dining room serves fast. |

---

## My ultimate Q&A bank

### From the per-student pack (the classics)

**Q: "What did the SDK 58 upgrade touch, and what could have broken?"**
Only configuration. package.json moved to expo ^58.0.0 and every dependency was realigned to the SDK 58 matrix with npx expo install --fix; app.json dropped the splash block that the new schema forbids; .npmrc sets legacy-peer-deps because the jump crosses React 19. No screen, presenter or API code changed. What could have broken — native module versions above all — is exactly what the verification covers: expo-doctor 20/20 on the SDK 58 matrix and a clean Metro/Hermes bundle, then the emulator driving the real flows against the live server.

**Q: "Why is the screen registry more than a folder of imports?"**
Because it is the single indirection point that navigation, deep links and notification taps share: a name maps to a component, its owning module and its title, and nothing navigates by constructing paths ad hoc. That gave us role-based mounting — the admin stack exists only for admins — and a countable inventory: forty-six entries is not a claim, it is a file. When a screen moves or a module changes hands, the registry is the one place that records it.

**Q: "What does BasePresenter standardise, concretely?"**
Five states — idle, loading, success, error, empty — plus attach and detach and a shared error mapper. Because every screen passes through it, every screen shows the same skeletons, the same empty states and the same toast behaviour, and the presenter logic stays in plain, reviewable classes with no React rendering. The pattern is why forty-six screens feel like one app instead of forty-six prototypes.

**Q: "Why does the logic live in presenters rather than in the components?"**
Because the bugs that matter live in decisions, not rendering: does login route MFA correctly, does pagination accumulate, does the client refresh once for five parallel 401s. Keeping those decisions in plain presenter classes makes them reviewable line by line and checkable by driving the class directly — no rendering involved. Component snapshots would have looked impressive and caught nothing we cared about.

**Q: "Is client-side token storage in AsyncStorage secure enough?"**
It is the platform-standard trade-off for this kind of app: AsyncStorage is sandboxed per app, so another app cannot read it, and the real threats are device theft and device-level compromise. We mitigate what we can from the server side — fifteen-minute access tokens, rotation with reuse detection, revocation on logout and password change — and a production roadmap item would be encrypted storage or biometric-gated keychain use.

### The masterclass ten

**Q: "Why AsyncStorage and not the secure keychain — what actually protects a stolen phone?"**
Because AsyncStorage is the platform-standard, dependency-free pocket every React Native app has, sandboxed per application, and the honest answer is that no client-side storage survives a rooted device. Our defence is server-side: the access token lives only fifteen minutes; the refresh token is rotated on every use with reuse detection, so a stolen pair dies the moment the real device refreshes; logout and password change revoke server-side. An attacker holding the pocket holds a fifteen-minute wristband and a card that turns itself in. The roadmap item is explicit — encrypted storage or biometric-gated keychain — and I say that unprompted.

**Q: "How does a `docutrust://verify/:token` deep link find the right screen?"**
`app.json` declares the scheme `docutrust`, `RootNavigator` passes a `linking` config to `NavigationContainer` mapping `PublicVerify: 'verify/:token'`, and react-navigation resolves the URL to the name `PublicVerify` — which exists in `SCREEN_REGISTRY`, gets mounted from there, and receives the token as a route param. `PublicVerifyScreen` runs without a session because the registry lets the navigator mount it on the root stack, outside the auth gate. One name, one indirection point — the deep link never constructs a path by hand.

**Q: "Why presenters instead of just calling fetch inside useEffect hooks?"**
Three reasons. Reviewability: presenters are plain classes, so login, reset, MFA and deletion logic can be driven and checked directly, with no rendering involved. Ownership: each microservice folder is one student's territory, and the presenter is the contract between my screens and their data. Consistency: `BasePresenter` gives all 47 presenter classes the same five-state machine and the same error mapper, so screen forty-five behaves like screen one. A hook in a component would make all three of those properties someone's good intentions instead of the framework's guarantee.

**Q: "Concretely, what did the SDK 58 upgrade change in the repo?"**
Four files, zero logic. `package.json` moved to `expo ^58.0.0` and the aligned matrix — `react-native 0.88.1`, `react 19.3.0`, the expo-* packages to their `~58.0.x` lines. `app.json` dropped the splash block the new schema forbids. `.npmrc` gained `legacy-peer-deps=true` because the jump crosses React 19. Nothing else — which is the point: the matrix alignment is exactly what `npx expo-doctor` (20/20) and the live emulator run verify.

**Q: "How do 46 screens from six students end up looking like one app?"**
Three enforcement points. The design tokens: every colour, spacing step, radius and shadow comes from `core/theme/`, so nobody hand-picks a hex value. The components: 20 shared pieces from `AppButton` to `CodeBoxes`, so a form field is always *the* form field. And `BasePresenter`: every screen's loading, empty and error behaviour is the same machine. The screen registry keeps the inventory honest — a screen not in the registry does not exist. Consistency here is structure, not discipline.

**Q: "What happens when the user goes offline mid-action?"**
The fetch throws, `request()` catches it before anything else and converts it to `ApiError(0, 'NETWORK_ERROR', 'Cannot reach the vault. Check your connection and try again.')`. The presenter's `handleError` mirrors that sentence into state, the screen shows it, and pull-to-refresh (`usePullRefresh`) is the recovery path. No retry storm, no half-written state — the app is read-and-retry by design, and nothing destructive is attempted optimistically.

**Q: "How does the app switch to the main app the instant login succeeds — who calls 'go to dashboard'?"**
Nobody. `AuthStore` is a tiny external store, and `RootNavigator` subscribes with `useSyncExternalStore(AuthStore.subscribe, AuthStore.getState, ...)`. When `AuthStore.setSession(...)` commits the tokens, `authed` flips true and the tree swaps from `AuthStack` to `MainStack` — the gate is reactive, like a door that opens because the light turned green, not because someone pushed it. The same mechanism handles logout and the `TOKEN_REUSE` kill: one commit, whole tree swaps.

**Q: "Why is the admin stack conditionally mounted rather than just hidden?"**
Because `MainStack` receives `isAdmin`/`isManager` from the session and mounts `AdminStack` or `OrgStack` only when the role allows — a non-admin's navigation tree literally contains no admin screens. Hiding is a UI choice a curious user can defeat; absence is not. The server's role guards remain the real gate — this is defence in depth where the client's layer costs one ternary.

**Q: "Where is the 25 MB upload limit enforced on the client?"**
Twice, deliberately. `env.js` exports `MAX_FILE_BYTES = 25 * 1024 * 1024` and the upload path checks the picked file before a byte is sent; and if anything oversized ever reaches the server anyway, the response code `FILE_TOO_LARGE` maps in `BasePresenter`'s `FRIENDLY` table to "Files must be 25 MB or smaller." Client-first saves the user's data plan; server-side is the real wall. The same double-check pattern applies to the accepted file types.

**Q: "Why draw the tab icons with Views instead of an icon font?"**
Because an icon font is a whole native dependency, a bundling step and a licensing question — for four glyphs. `RootNavigator`'s `TabGlyph` draws the vault dial, the share rings, the bell and the person from bordered `View`s, tinted by focus state. It keeps `package.json` on the SDK 58 matrix with zero extras, renders identically on iOS and Android, and it is a nice standing answer to "what did you build yourself that most projects import?"

**Q: "How do you prove the client-server conversation itself, not just the screens?"**
Because the riskiest logic in this app is the *conversation with the server*: envelope handling, silent refresh, 440 and step-up handshakes, negative paths. At the defence I drive that conversation live — manual API calls (Postman/cURL) replay the same `ApiClient`-level flows the screens perform, including wrong codes and reuse-after-use, while the emulator shows the client reacting; the two views side by side are the proof. Component screenshots would have covered neither side.

---

## The handshake — how my slice feeds the other five

- **If you ask me about the router, tables or the pool → that's Student 1's area.** My part feeds it as the consumer that keeps it honest: `endpoints.js` mirrors the router's paths 1:1, my `ApiClient` expects Student 1's response envelope and error codes verbatim, and if the middleware chain changed shape, my screen is where the mismatch would show first.
- **If you ask me about JWT internals, rotation or OTP → that's Student 2's area.** My part is the handshake partner: `refreshSession()` performs the rotation dance, `MfaPresenter` finishes the 440 challenge, and the step-up phases call `request-step-up` / `verify-step-up`. Student 2's token rules are only real once a client obeys them — that client is mine.
- **If you ask me about the vault, shares or verification → that's Student 3's area.** My part renders the promises: the share screens surface Student 3's guards (expiry, view limits, passcode, OTP gate) as chips and phases, and `PublicVerifyResult` displays the pinned-version verdict the VerifyService mints.
- **If you ask me about the audit findings → that's Student 5's area.** My part carries the client-visible fixes: the `TOKEN_REUSE` logout branch exists because of B-1/B-3, and the OTP-era UX (FT-231) is the screens-half of the audit's security overhaul — Student 5 found it, I made the user feel it.
- **If you ask me about build, config or deployment → that's Student 6's area.** My part is the config seam: `mobile/.env` with `EXPO_PUBLIC_API_URL` is Student 6's environment story continued to the client, `env.js` is its single reader, and the Metro/Hermes bundle is the artifact the whole build story ends in.
- **Who most often bridges TO me: Student 2.** Every token, MFA and step-up question ends at a screen — the MFA screen, the reset screen, the step-up phases — so we rehearse the auth chain together more than any other pairing; Student 5's client-side findings are the second-most common bridge.