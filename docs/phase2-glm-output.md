Java 21 JRE 存在，但没有 `javac`/`mvn`（`/tmp/tools` 未能随着沙箱回收而保留），并且没有本地 DB —— 因此：我将在编辑的同时在后台重新构建构建工具链，并在没有 DB 的情况下尽力进行编译验证。没有测试源，所以 `mvn clean install` 不会运行任何需要 DB 的内容。
Router + HealthController signatures confirmed. Now the moves and edits.
Toolchain ready (system javac 21.0.13 + Maven 3.9.9). File re-read — re-applying the edits now.
Core Main 已完成修改。现在我来提供新的 auth-service Main.java（按照既定顺序）和 README。
现在在后台编译（首次构建可能会下载依赖），并并行运行静态路由计数检查和差异生成。
静态检查完全通过：core = 56 条路由（仅接受 `accept-invite` 遗留项），auth = 19 条路由且符合精确的方法/路径/守卫。在构建运行的同时，生成 diff 工件。
已验证 4 处文件迁移，且内容无任何更改（diff 显示均为 `| 0`）。在构建运行的同时，让我阅读一下 `core-Main` 的 diff，以便在交接前核对每一行代码。
Diff 已逐行验证 —— 完全符合约定的变更集（3 个导入，3 处连接，删除了 18 条路由，使用确切措辞保留 accept-invite 并附带 RC-1 注释）。现在我来检查构建。
The build used the system JRE which lacks a proper JDK compiler — the fetch script did download a full Adoptium JDK. Point `JAVA_HOME` at it and rebuild.
在构建运行的同时，我正在准备用于交付的 `git-mv` 脚本 artifact。
运行目录错误 —— POM 文件位于 `server/`。正在从此处重新运行。
**BUILD SUCCESS × 6 modules.** One last packaging-level proof: verify which jar each moved class landed in.
Packaging proof complete. Committing the sandbox state and writing the verification doc.
All gates green in the sandbox: **BUILD SUCCESS × 6 modules**, renames at 100% similarity, core=56 / auth=19 routes verified statically, jar placement proven (FileVault in shared + shaded into core; auth classes only in auth jar). No DB exists in this sandbox, so the runtime curls remain yours — as planned. Deliverables:

## 1. File moves — run from repo root (`DocuTrust/`), or `bash phase2-moves.sh`

```bash
mkdir -p server/auth-service/src/main/java/com/docutrust/{controller,service,auth}
mkdir -p server/shared/src/main/java/com/docutrust/vault

git mv server/core-service/src/main/java/com/docutrust/controller/AuthController.java server/auth-service/src/main/java/com/docutrust/controller/AuthController.java
git mv server/core-service/src/main/java/com/docutrust/service/AuthService.java      server/auth-service/src/main/java/com/docutrust/service/AuthService.java
git mv server/core-service/src/main/java/com/docutrust/auth/MfaService.java         server/auth-service/src/main/java/com/docutrust/auth/MfaService.java
git mv server/core-service/src/main/java/com/docutrust/vault/FileVault.java         server/shared/src/main/java/com/docutrust/vault/FileVault.java
```
(The `mkdir -p` lines are required — the target packages don't exist yet.)

## 2. Unified diff — `core-service/src/main/java/com/docutrust/Main.java`

```diff
diff --git a/server/core-service/src/main/java/com/docutrust/Main.java b/server/core-service/src/main/java/com/docutrust/Main.java
index 4b42af6..e7067b9 100644
--- a/server/core-service/src/main/java/com/docutrust/Main.java
+++ b/server/core-service/src/main/java/com/docutrust/Main.java
@@ -7,14 +7,12 @@ import java.util.List;
 import java.util.concurrent.Executors;
 
 import com.docutrust.auth.JwtService;
-import com.docutrust.auth.MfaService;
 import com.docutrust.auth.PasswordService;
 import com.docutrust.auth.RateLimiter;
 import com.docutrust.auth.TokenService;
 import com.docutrust.bootstrap.Bootstrap;
 import com.docutrust.config.Config;
 import com.docutrust.controller.AdminController;
-import com.docutrust.controller.AuthController;
 import com.docutrust.controller.DocumentController;
 import com.docutrust.controller.FolderController;
 import com.docutrust.controller.HealthController;
@@ -29,7 +27,6 @@ import com.docutrust.http.Middleware;
 import com.docutrust.http.Router;
 import com.docutrust.service.AdminService;
 import com.docutrust.service.AuditService;
-import com.docutrust.service.AuthService;
 import com.docutrust.service.DocumentService;
 import com.docutrust.service.ExpiryScheduler;
 import com.docutrust.service.FolderService;
@@ -115,7 +112,6 @@ public final class Main {
 
         FileVault vault = new FileVault(Path.of(cfg.vaultDir), vaultKeyBytes(cfg.vaultKey));
         PasswordService passwords = new PasswordService();
-        MfaService mfa = new MfaService();
         JwtService jwt = new JwtService(cfg.jwtSecret);
         RateLimiter limiter = new RateLimiter();
         TokenService tokens = new TokenService(db, jwt);
@@ -128,7 +124,6 @@ public final class Main {
         OtpService otps = new OtpService();
         StepUpService stepUps = new StepUpService(db, otps, mail, jwt, audit);
         DocumentService documents = new DocumentService(db, vault, audit, notifications, stepUps);
-        AuthService auth = new AuthService(db, passwords, tokens, mfa, audit, mail, otps, stepUps, jwt, vault, cfg.seedDemo);
         FolderService folders = new FolderService(db, audit, documents);
         ShareService shares = new ShareService(db, passwords, documents, audit, notifications, vault, otps, mail);
         VerifyService verify = new VerifyService(db, vault, audit, documents);
@@ -136,7 +131,6 @@ public final class Main {
         OrgService org = new OrgService(db, passwords, audit, notifications, otps, mail, tokens);
 
         Router router = new Router(cfg, db, mw);
-        AuthController authC = new AuthController(auth, stepUps, mail);
         DocumentController docC = new DocumentController(documents);
         FolderController folderC = new FolderController(folders);
         ShareController shareC = new ShareController(shares);
@@ -152,27 +146,8 @@ public final class Main {
         router.publicRoute("GET", "/api/meta", healthC.meta());
 
         // ---- public: auth (login/register/forgot/reset rate limited) ----
-        router.rateLimited("POST", "/api/auth/register", "auth", authC.register());
-        router.rateLimited("POST", "/api/auth/login", "auth", authC.login());
-        router.rateLimited("POST", "/api/auth/forgot-password", "auth", authC.forgotPassword());
-        router.rateLimited("POST", "/api/auth/reset-password-otp", "auth", authC.resetPasswordOtp());
-        router.rateLimited("POST", "/api/auth/verify-otp", "auth", authC.verifyOtp());
+        // RC-1: accept-invite stays in core-service. Handler is OrgController.acceptInvite (admin-domain logic under auth prefix).
         router.rateLimited("POST", "/api/auth/accept-invite", "auth", orgC.acceptInvite());
-        router.publicRoute("POST", "/api/auth/refresh", authC.refresh());
-        router.publicRoute("POST", "/api/auth/logout", authC.logout());
-        router.publicRoute("GET", "/api/auth/verify-email", authC.verifyEmail());
-
-        // ---- auth ----
-        router.auth("GET", "/api/auth/me", authC.me());
-        router.auth("PATCH", "/api/auth/me", authC.updateMe());
-        router.auth("GET", "/api/auth/sessions", authC.sessions());
-        router.auth("DELETE", "/api/auth/sessions/:id", authC.revokeSession());
-        router.auth("POST", "/api/auth/change-password", authC.changePassword());
-        router.auth("POST", "/api/auth/request-step-up", authC.requestStepUp());
-        router.auth("POST", "/api/auth/verify-step-up", authC.verifyStepUp());
-        router.auth("POST", "/api/auth/mfa/setup", authC.mfaSetup());
-        router.auth("POST", "/api/auth/mfa/enable", authC.mfaEnable());
-        router.auth("POST", "/api/auth/mfa/disable", authC.mfaDisable());
 
         // ---- documents ----
         router.auth("GET", "/api/documents", docC.list());
```

## 3. Full new `auth-service/src/main/java/com/docutrust/authservice/Main.java`

```java
package com.docutrust.authservice;

import java.net.InetSocketAddress;
import java.nio.file.Path;
import java.util.concurrent.Executors;

import com.docutrust.auth.JwtService;
import com.docutrust.auth.MfaService;
import com.docutrust.auth.PasswordService;
import com.docutrust.auth.RateLimiter;
import com.docutrust.auth.TokenService;
import com.docutrust.config.Config;
import com.docutrust.controller.AuthController;
import com.docutrust.controller.HealthController;
import com.docutrust.db.Database;
import com.docutrust.http.Middleware;
import com.docutrust.http.Router;
import com.docutrust.service.AuditService;
import com.docutrust.service.AuthService;
import com.docutrust.service.MailService;
import com.docutrust.service.OtpService;
import com.docutrust.service.StepUpService;
import com.docutrust.util.Text;
import com.docutrust.vault.FileVault;
import com.sun.net.httpserver.HttpServer;

// Composition root for auth-service (Phase 2): serves the 18 /api/auth/* routes extracted from
// core-service plus its own /api/health. It NEVER runs migrations (the skip below is hardcoded,
// regardless of MIGRATOR_ENABLED - core-service owns schema changes) and never seeds demo data
// (Bootstrap stays in core-service). Run from server/ so VAULT_DIR resolves to the same absolute
// path as core-service and MFA secret decryption works across services.
public final class Main {
    private Main() {}

    public static void main(String[] args) {
        Config cfg = Config.load();
        if (cfg.dbUrl == null || cfg.dbUrl.isBlank()) {
            System.out.println("DB_URL not configured - set .env (see .env.example)");
            System.exit(1);
        }
        try {
            String initSql = null;
            if (cfg.dbSchema != null && !cfg.dbSchema.isBlank()) {
                String schema = cfg.dbSchema.replaceAll("[^A-Za-z0-9_]", "");
                try (var c = cfg.dbUser == null ? java.sql.DriverManager.getConnection(cfg.dbUrl)
                        : java.sql.DriverManager.getConnection(cfg.dbUrl, cfg.dbUser, cfg.dbPassword);
                     var st = c.createStatement()) {
                    st.execute("CREATE SCHEMA IF NOT EXISTS " + schema);
                }
                initSql = "SET search_path TO " + schema + ", public";
            }
            Database db = new Database(cfg.dbUrl, cfg.dbUser, cfg.dbPassword, 2, cfg.dbPoolMax, initSql);
            // Hardcoded skip: auth-service NEVER runs migrations, whatever MIGRATOR_ENABLED says.
            System.out.println("[auth-service] migrations skipped (auth-service never runs migrations)");

            // Wiring order matters: every constructor argument must already exist when its consumer
            // is built (same sequence as core-service Main).
            FileVault vault = new FileVault(Path.of(cfg.vaultDir), Text.b64decode(cfg.vaultKey));
            PasswordService passwords = new PasswordService();
            JwtService jwt = new JwtService(cfg.jwtSecret);
            RateLimiter limiter = new RateLimiter();
            TokenService tokens = new TokenService(db, jwt);
            Middleware mw = new Middleware(db, jwt, limiter);
            Router router = new Router(cfg, db, mw);

            AuditService audit = new AuditService(db);
            MailService mail = new MailService(cfg);
            OtpService otps = new OtpService();
            StepUpService stepUps = new StepUpService(db, otps, mail, jwt, audit);
            MfaService mfa = new MfaService();
            AuthService auth = new AuthService(db, passwords, tokens, mfa, audit, mail, otps, stepUps, jwt, vault, cfg.seedDemo);
            AuthController authC = new AuthController(auth, stepUps, mail);
            HealthController healthC = new HealthController(db, cfg);

            // ---- public: health ----
            router.publicRoute("GET", "/api/health", healthC.health());

            // ---- public: auth (login/register/forgot/reset rate limited) ----
            router.rateLimited("POST", "/api/auth/register", "auth", authC.register());
            router.rateLimited("POST", "/api/auth/login", "auth", authC.login());
            router.rateLimited("POST", "/api/auth/forgot-password", "auth", authC.forgotPassword());
            router.rateLimited("POST", "/api/auth/reset-password-otp", "auth", authC.resetPasswordOtp());
            router.rateLimited("POST", "/api/auth/verify-otp", "auth", authC.verifyOtp());
            router.publicRoute("POST", "/api/auth/refresh", authC.refresh());
            router.publicRoute("POST", "/api/auth/logout", authC.logout());
            router.publicRoute("GET", "/api/auth/verify-email", authC.verifyEmail());

            // ---- auth ----
            router.auth("GET", "/api/auth/me", authC.me());
            router.auth("PATCH", "/api/auth/me", authC.updateMe());
            router.auth("GET", "/api/auth/sessions", authC.sessions());
            router.auth("DELETE", "/api/auth/sessions/:id", authC.revokeSession());
            router.auth("POST", "/api/auth/change-password", authC.changePassword());
            router.auth("POST", "/api/auth/request-step-up", authC.requestStepUp());
            router.auth("POST", "/api/auth/verify-step-up", authC.verifyStepUp());
            router.auth("POST", "/api/auth/mfa/setup", authC.mfaSetup());
            router.auth("POST", "/api/auth/mfa/enable", authC.mfaEnable());
            router.auth("POST", "/api/auth/mfa/disable", authC.mfaDisable());

            // PORT is read from the process environment with default 8081 (not cfg.port), so a
            // PORT value in .env (meant for another service) can never leak into auth-service.
            int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8081"));
            HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
            server.createContext("/", router);
            server.setExecutor(Executors.newFixedThreadPool(32));
            server.start();
            Runtime.getRuntime().addShutdownHook(new Thread(() -> {
                System.out.println("[auth-service] shutting down...");
                server.stop(0);
                db.close();
            }));
            System.out.println("[auth-service] ready on port " + port
                    + " (routes=" + router.routeCount()
                    + ", db=" + (db.healthy() ? "up" : "DOWN") + ")");
            Thread.currentThread().join();
        } catch (Exception e) {
            System.err.println("[auth-service] fatal: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }
}
```

## 4. New `auth-service/README.md`

```markdown
# auth-service (Phase 2)

Serves the 18 `/api/auth/*` routes extracted from core-service — register, login, forgot-password,
reset-password-otp, verify-otp, refresh, logout, verify-email, me (GET+PATCH), sessions (GET+DELETE),
change-password, request-step-up, verify-step-up, mfa/setup, mfa/enable, mfa/disable — plus its own
`GET /api/health`: **19 routes on port 8081**. Package names remain `com.docutrust.*`.
`/api/auth/accept-invite` deliberately stays in core-service (RC-1: the handler is
`OrgController.acceptInvite`, admin-domain logic under an auth prefix).

## Run (from `DocuTrust/server/` — CRITICAL)

    cd server && PORT=8081 mvn -pl auth-service exec:java

**Run from `server/`, never from inside `auth-service/`.** The default `VAULT_DIR=./data/vault` is
resolved against the current working directory. From `server/` it is the SAME absolute path
core-service uses, so both JVMs share one vault and MFA secret decryption works across services.
Running from inside `auth-service/` points `VAULT_DIR` at `server/auth-service/data/vault` (a
different, empty directory) and breaks MFA secret decryption across services.

## CRITICAL: shared secrets

**JWT_SECRET and VAULT_KEY must be identical to core-service's — both read the same `.env`.**
If either is ephemeral, cross-service JWT validation and MFA secret decryption will fail.
(If `JWT_SECRET` is unset, Config silently generates a fresh ephemeral secret per boot:
auth-service would then issue tokens that core-service cannot verify, and the cross-service
login → documents flow breaks.)

## Migrations

auth-service **never** runs migrations. The skip is hardcoded in `Main` — it prints
`[auth-service] migrations skipped (auth-service never runs migrations)` and ignores
`MIGRATOR_ENABLED` entirely. core-service remains the migration owner (`MIGRATOR_ENABLED=true`).

## Configuration notes

- `PORT` — process env var only, default **8081**. A `PORT` value inside `.env` is deliberately
  ignored by auth-service (Main reads the environment directly), so the port core-service uses can
  never leak into auth-service.
- `DB_POOL_MAX` — HikariCP `maximumPoolSize` (default 10). Phase 2 guidance: every DB-touching
  service sets **≤ 5** (4 services × 5 = 20 connections, within Neon limits).
- No `Bootstrap` seeding (SEED_DEMO handling stays in core-service) and no `ExpiryScheduler`
  (single-JVM contract, stays in core-service).
```

## 5. Verification steps (full copy in `VERIFY.md`)

1. `cd server && mvn clean install` → **BUILD SUCCESS, 6/6 modules** (proven in sandbox: 39 s, JDK 21).
2. Terminal A: `cd server && PORT=9000 MIGRATOR_ENABLED=true SEED_DEMO=true mvn -pl core-service exec:java` → banner shows **routes=56**.
3. Terminal B: `cd server && PORT=8081 mvn -pl auth-service exec:java` → `migrations skipped` line, then **`[auth-service] ready on port 8081 (routes=19, db=up)`**.
4. `curl -X POST http://localhost:8081/api/auth/login` (seed creds) → **200 + accessToken**.
5. `curl -H "Authorization: Bearer $TOKEN" http://localhost:9000/api/documents` → **200 + documents list** (the money shot: auth issues, core verifies).
6. `curl -X POST http://localhost:9000/api/auth/login -d '{}'` → **404**; `curl -X POST http://localhost:9000/api/auth/accept-invite -d '{}'` → **400/422** (RC-1 alive).
7. `curl http://localhost:9000/api/health` and `curl http://localhost:8081/api/health` → both **200**.

## 6. Concerns / notes from generation

- **All 4 moves are byte-identical** — git rename detection shows 100% similarity, zero edits inside moved files; text-crypto untouched (`gcm:v1:` AES-256-GCM intact). Core's FileVault consumers needed no edits (same package, new jar). Jar proof: shared jar has `FileVault.class`, core shaded jar has FileVault + **0** auth classes, auth jar has all three + `authservice.Main`.
- **SEED_DEMO warning asymmetry (cosmetic):** core's boot still prints the `[SECURITY WARNING] SEED_DEMO…` line, but reset-code echoing now happens in auth-service. AuthService still receives `cfg.seedDemo` so demo behavior is unchanged; if you want the warning printed by auth-service too, that's a one-line addition I left out per "don't touch anything else".
- **Doc staleness:** Phase 1 `core-service/README.md` still says auth-service "keeps MIGRATOR_ENABLED=true" in Phase 2 — superseded by the hardcoded skip. Left untouched per scope; one-liner if you want it fixed.
- **`DB_SCHEMA` block replicated** in auth Main (same `initSql` as core) — if tests use a throwaway schema, auth queries land in the same schema instead of `public`.
- No pom edits, no gateway changes, no other routes touched (verified: core's only remaining `/api/auth` line is accept-invite).

**Acceptance gate:** all 9 criteria in section 5 pass → tag `phase2-complete`. **Rollback:** `git reset --hard phase1-complete`.

Files saved in `download/phase2/`: `phase2-moves.sh`, `core-service-Main.diff`, `phase2-full.patch` (all changes incl. renames — `git apply`-able), `auth-service-Main.java`, `auth-service-README.md`, `VERIFY.md`.