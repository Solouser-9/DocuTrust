I'll pick up from the approved Phase 1 plan with the three amendments and generate the actual code now. First, let me re-verify the repository state so the diffs and `git mv` block match the real file layout exactly.
JDK 21 JRE is present but `javac` and `mvn` are missing — installing Maven (which brings the full JDK) in the background while I read the files I need to patch exactly:
The apt install failed (exit 127) — checking why, and what package tooling actually exists here:
apt needs root. Checking for a full JDK (javac may exist under `/usr/lib/jvm` without being on PATH), sudo availability, and network reachability for a Maven binary tarball:
Network is open and sudo is unavailable, so: extract `openjdk-21-jdk-headless` locally via `apt-get download` (no root needed) and grab the Maven binary tarball from Apache:
Toolchain ready (Maven 3.9.9 + JDK 21 with javac + git). Now setting up the Phase 1 working copy with a git baseline so I can generate exact diffs:
The moves script must run from `DocuTrust/server` — I invoked it from `DocuTrust`. Rerunning from the right directory:
Found it — `TokenService.java` lives in `auth/`, not `service/` (the analysis table even says `auth/TokenService.java`); my script mispathed it, and 23 moves already applied. Resetting to the tag, fixing the script, and redoing cleanly:
48 renames staged cleanly. Now removing the leftover empty package dirs and the old pom (will be replaced by the parent pom), then writing the new module files:
A `Dockerfile` I hadn't inventoried sits in `server/` — checking whether it references the old jar name, since core-service's shaded jar will now be `docutrust-core-service`:
The Dockerfile builds the old single module and copies `docutrust-server.jar` — Phase 1 breaks the deploy path, so I'll patch it minimally to build the reactor's core-service and flag this as an addition beyond the approved plan in my summary. Writing the new poms now:
All 6 poms written. Now the four stub Mains, the core-service README, and the Dockerfile fix:
Now the patch script applying the four sanctioned content changes (Config, Main, HealthController, .env.example) with exact-string assertions:
All patches applied — 48 renames, 3 modified (parent pom, Dockerfile, .env.example), 11 added files. Now the acceptance build:
Maven Central rate-limited the plugin download (429). I'll point Maven at the Aliyun Central mirror (this is an Alibaba Cloud sandbox) and retry:
One compile error — `mailInfo()` is static but now references the instance field `cfg`. Making it an instance method:
Build exit 0 — but I need the full reactor summary to confirm all six modules, then smoke-test the stubs:
BUILD SUCCESS on all six modules. Smoke-testing all four stubs (core-service itself needs a live Postgres, which the sandbox doesn't have — that smoke runs on your machine per the plan):
No response — checking the stub logs to see what happened:
My mistake — the smoke command's PATH was missing the Maven bin dir. Simpler and faster: run the stub classes directly with `java -cp` (gateway needs nothing; the three service stubs just need the shared jar for Json):
All four stubs answer `/health` correctly on their ports, `405` on non-GET, and shared-module `Json` works in the service stubs. Now restructuring the git history into "moves" + "content" commits so the deliverable patch is exactly `moves-script + patch`:
Pathspec issue — the deleted `server/src` directory can't be staged with a worktree-matching `git add`. Unstaging everything first, then staging deletions and adds separately:
48 pure renames (R100) committed, then content. Generating the deliverable patch and running an end-to-end QA: a fresh baseline, the moves script, then the patch, then a full rebuild:
The patch is 1903 lines — far larger than the actual changes, which suggests my Python patch normalized line endings (CRLF→LF) and rewrote whole files. Checking the baseline files' actual line endings before fixing:
Confirmed — the whole repo is CRLF, and my Python patch silently normalized the four patched files to LF, producing whole-file diffs. Fixing with an EOL-aware patch pass (restoring baselines first), converting my new files to CRLF for consistency, then amending the content commit:
The script died on `Path.read_text(newline=)` (that kwarg is Python 3.13+; sandbox has older), but the `| tail` swallowed the failure and amended the commit anyway. Fixing the script to use `open(newline='')`, re-restoring the four baselines (including Dockerfile), and redoing the amend:
Minimal diffs now — Config +13, Main 13±, HealthController 8±, .env.example +10, Dockerfile 16±. Rebuilding to re-verify, then regenerating the deliverable patch:
BUILD SUCCESS and patch regenerated (861 lines). Now the definitive end-to-end QA: a virgin copy of the baseline, the exact moves script, the exact patch file, and a full build:
Archive paths were repo-root relative — adjusting the QA directory layout:
Patch applies cleanly (the "whitespace" warnings are just CRLF lines in the diff — cosmetic). Two loose ends: an empty leftover `src/` dir in the QA copy, and the QA build result wasn't actually captured (`PIPESTATUS` measured grep, not mvn). Re-running the QA build properly and cleaning the empty dirs:
QA is fully green: trees byte-identical, `mvn clean package` exit 0, zero errors, from a virgin baseline using exactly the moves script + patch being delivered. Final sanity check of the patch header format, then the deliverables:
The patch is complete and correct — one cosmetic flaw to fix first: the two new Config fields landed with 2-space indent (my anchor matched a substring mid-line; surrounding fields use 4). Fixing, re-applying, and re-verifying:
The Edit was rejected (stale read state) but the bash re-applied the old script — fixing properly: read the script, patch the line, redo:
Indent fixed and committed. Final verification chain — rebuild, regenerate patch, and rerun the full virgin-copy QA:
Patch applies clean from a virgin baseline, trees byte-identical, BUILD SUCCESS. Final stub smoke from the QA tree, and grabbing the regenerated Config.java hunk (the only section that changed with the indent fix):
Phase 1 code is generated **and verified in this sandbox**: `mvn clean package` across all 6 modules exits 0 (twice — once on my working tree, once on a virgin baseline reproduced using exactly the moves script + patch below), `git apply` succeeds cleanly, and the four stubs were curl-verified: `{"ok":true,"service":"auth-service","port":18081,"phase":1}` etc., with 405 on non-GET. All three amendments are in: MIGRATOR_ENABLED default **true** (Config, so zero env vars preserve today's behavior), DB_POOL_MAX default **10**, and stub packages `com.docutrust.authservice/vaultservice/adminservice/gateway`. Deliverable copies are saved at `download/docutrust-phase1.patch` and `download/docutrust-phase1-moves.sh`.

**Apply order in your repo:** (1) `git tag pre-phase1` from your repo root; (2) run the `git mv` block below from `DocuTrust/server/`; (3) from your **repo root** (the patch paths are `a/server/...`), save the patch as `docutrust-phase1.patch` and `git apply docutrust-phase1.patch`; (4) `cd DocuTrust/server && mvn clean package`.

Two things to know: your repo is **CRLF** — I preserved that byte-for-byte (only real changed lines appear in diffs), but `git apply` may print harmless "trailing whitespace" warnings for CRLF lines; do **not** use `--whitespace=fix`. And one addition beyond the approved plan, flagged for your review: `server/Dockerfile` would have broken (it copies `server/src` and `docutrust-server.jar`, both gone), so the diff updates it to build `-pl core-service -am` and copy `docutrust-core-service.jar`. Everything else matches the approved plan exactly.

## 1) File moves — run from `DocuTrust/server/`

```bash
mkdir -p shared/src/main/java/com/docutrust/{config,util,model,db,http,infra,auth,service,controller}
mkdir -p core-service/src/main/java/com/docutrust/{bootstrap,auth,service,controller,vault}

# ---- 26 files -> shared (library jar) ----
git mv src/main/java/com/docutrust/AppException.java          shared/src/main/java/com/docutrust/AppException.java
git mv src/main/java/com/docutrust/config/Config.java         shared/src/main/java/com/docutrust/config/Config.java
git mv src/main/java/com/docutrust/util/Json.java             shared/src/main/java/com/docutrust/util/Json.java
git mv src/main/java/com/docutrust/util/Text.java             shared/src/main/java/com/docutrust/util/Text.java
git mv src/main/java/com/docutrust/util/Validator.java        shared/src/main/java/com/docutrust/util/Validator.java
git mv src/main/java/com/docutrust/model/Models.java          shared/src/main/java/com/docutrust/model/Models.java
git mv src/main/java/com/docutrust/db/Database.java           shared/src/main/java/com/docutrust/db/Database.java
git mv src/main/java/com/docutrust/db/Migrator.java           shared/src/main/java/com/docutrust/db/Migrator.java
git mv src/main/java/com/docutrust/db/Rows.java               shared/src/main/java/com/docutrust/db/Rows.java
git mv src/main/java/com/docutrust/db/Tx.java                 shared/src/main/java/com/docutrust/db/Tx.java
git mv src/main/java/com/docutrust/http/Ctx.java              shared/src/main/java/com/docutrust/http/Ctx.java
git mv src/main/java/com/docutrust/http/Handler.java          shared/src/main/java/com/docutrust/http/Handler.java
git mv src/main/java/com/docutrust/http/Middleware.java       shared/src/main/java/com/docutrust/http/Middleware.java
git mv src/main/java/com/docutrust/http/Router.java           shared/src/main/java/com/docutrust/http/Router.java
git mv src/main/java/com/docutrust/infra/Metrics.java         shared/src/main/java/com/docutrust/infra/Metrics.java
git mv src/main/java/com/docutrust/infra/Spotlight.java       shared/src/main/java/com/docutrust/infra/Spotlight.java
git mv src/main/java/com/docutrust/auth/JwtService.java       shared/src/main/java/com/docutrust/auth/JwtService.java
git mv src/main/java/com/docutrust/auth/PasswordService.java  shared/src/main/java/com/docutrust/auth/PasswordService.java
git mv src/main/java/com/docutrust/auth/RateLimiter.java      shared/src/main/java/com/docutrust/auth/RateLimiter.java
git mv src/main/java/com/docutrust/service/AuditService.java  shared/src/main/java/com/docutrust/service/AuditService.java
git mv src/main/java/com/docutrust/service/MailService.java   shared/src/main/java/com/docutrust/service/MailService.java
git mv src/main/java/com/docutrust/service/NotificationService.java shared/src/main/java/com/docutrust/service/NotificationService.java
git mv src/main/java/com/docutrust/service/OtpService.java    shared/src/main/java/com/docutrust/service/OtpService.java
git mv src/main/java/com/docutrust/service/StepUpService.java shared/src/main/java/com/docutrust/service/StepUpService.java
git mv src/main/java/com/docutrust/auth/TokenService.java     shared/src/main/java/com/docutrust/auth/TokenService.java
git mv src/main/java/com/docutrust/controller/HealthController.java shared/src/main/java/com/docutrust/controller/HealthController.java

# ---- 22 files -> core-service (renamed monolith, all 74 routes) ----
git mv src/main/java/com/docutrust/Main.java                  core-service/src/main/java/com/docutrust/Main.java
git mv src/main/java/com/docutrust/bootstrap/Bootstrap.java   core-service/src/main/java/com/docutrust/bootstrap/Bootstrap.java
git mv src/main/java/com/docutrust/auth/MfaService.java       core-service/src/main/java/com/docutrust/auth/MfaService.java
git mv src/main/java/com/docutrust/service/AuthService.java   core-service/src/main/java/com/docutrust/service/AuthService.java
git mv src/main/java/com/docutrust/service/AdminService.java  core-service/src/main/java/com/docutrust/service/AdminService.java
git mv src/main/java/com/docutrust/service/DocumentService.java core-service/src/main/java/com/docutrust/service/DocumentService.java
git mv src/main/java/com/docutrust/service/ExpiryScheduler.java core-service/src/main/java/com/docutrust/service/ExpiryScheduler.java
git mv src/main/java/com/docutrust/service/FolderService.java core-service/src/main/java/com/docutrust/service/FolderService.java
git mv src/main/java/com/docutrust/service/OrgService.java    core-service/src/main/java/com/docutrust/service/OrgService.java
git mv src/main/java/com/docutrust/service/SettingsService.java core-service/src/main/java/com/docutrust/service/SettingsService.java
git mv src/main/java/com/docutrust/service/ShareService.java  core-service/src/main/java/com/docutrust/service/ShareService.java
git mv src/main/java/com/docutrust/service/VerifyService.java core-service/src/main/java/com/docutrust/service/VerifyService.java
git mv src/main/java/com/docutrust/controller/AdminController.java core-service/src/main/java/com/docutrust/controller/AdminController.java
git mv src/main/java/com/docutrust/controller/AuthController.java core-service/src/main/java/com/docutrust/controller/AuthController.java
git mv src/main/java/com/docutrust/controller/DocumentController.java core-service/src/main/java/com/docutrust/controller/DocumentController.java
git mv src/main/java/com/docutrust/controller/FolderController.java core-service/src/main/java/com/docutrust/controller/FolderController.java
git mv src/main/java/com/docutrust/controller/NotificationController.java core-service/src/main/java/com/docutrust/controller/NotificationController.java
git mv src/main/java/com/docutrust/controller/OrgController.java core-service/src/main/java/com/docutrust/controller/OrgController.java
git mv src/main/java/com/docutrust/controller/PublicController.java core-service/src/main/java/com/docutrust/controller/PublicController.java
git mv src/main/java/com/docutrust/controller/ShareController.java core-service/src/main/java/com/docutrust/controller/ShareController.java
git mv src/main/java/com/docutrust/controller/VerificationController.java core-service/src/main/java/com/docutrust/controller/VerificationController.java
git mv src/main/java/com/docutrust/vault/FileVault.java       core-service/src/main/java/com/docutrust/vault/FileVault.java
```

## 2) Unified diff — added/modified files

```diff
diff --git a/server/.env.example b/server/.env.example
index 29747ea..e423f4e 100644
--- a/server/.env.example
+++ b/server/.env.example
@@ -58,3 +58,13 @@ BREVO_SENDER_NAME=DocuTrust
 # ---- Optional local tracing (Sentry -> Spotlight sidecar) -----------------------
 # Set true only while profiling locally with Spotlight (https://spotlightjs.com) running.
 SPOTLIGHT_ENABLED=false
+
+# ---- Phase 1 multi-module additions ----------------------------------------------
+# HikariCP maximumPoolSize. Phase 1 default 10 pins the current single-app pool.
+# Phase 2: every DB-touching service must set <= 5 (4 services x 5 = 20 <= Neon limits).
+DB_POOL_MAX=10
+
+# Run V*.sql migrations at boot. Default true preserves today's always-migrate behavior
+# (idempotent). Phase 2+: the migration-owning service keeps true; every other service
+# sets false so migrations run exactly once.
+MIGRATOR_ENABLED=true
diff --git a/server/Dockerfile b/server/Dockerfile
index 1f3f90f..79f7737 100644
--- a/server/Dockerfile
+++ b/server/Dockerfile
@@ -1,12 +1,12 @@
-# Stage 1: Build the application
+# Stage 1: Build the application (Phase 1 multi-module reactor)
 FROM maven:3.9-eclipse-temurin-21 AS build
 WORKDIR /app
 
-# Copy only the server files needed for the build
-COPY DocuTrust/server/pom.xml .
-COPY DocuTrust/server/src ./src
+# Copy the multi-module server tree (parent + shared + core-service + service stubs + gateway)
+COPY DocuTrust/server ./server
 
-RUN mvn clean package -DskipTests
+# Build core-service and its reactor dependencies (-am builds shared first)
+RUN cd server && mvn clean package -pl core-service -am -DskipTests -q
 
 # Stage 2: Run the application
 FROM eclipse-temurin:21-jre
@@ -18,8 +18,8 @@ RUN groupadd -r appgroup && useradd -r -g appgroup appuser
 # FIX: Create the data/vault directories and give appuser ownership of /app
 RUN mkdir -p /app/data/vault && chown -R appuser:appgroup /app
 
-# Copy the built jar
-COPY --from=build --chown=appuser:appgroup /app/target/docutrust-server.jar app.jar
+# Copy the built core-service shaded jar
+COPY --from=build --chown=appuser:appgroup /app/server/core-service/target/docutrust-core-service.jar app.jar
 
 # Copy the database migrations folder
 COPY --chown=appuser:appgroup DocuTrust/database ./database
@@ -29,4 +29,4 @@ ENV MIGRATIONS_DIR=./database/migrations
 
 USER appuser
 EXPOSE 8080
-ENTRYPOINT ["java", "-jar", "app.jar"]
\ No newline at end of file
+ENTRYPOINT ["java", "-jar", "app.jar"]
diff --git a/server/admin-service/pom.xml b/server/admin-service/pom.xml
new file mode 100644
index 0000000..ea32f86
--- /dev/null
+++ b/server/admin-service/pom.xml
@@ -0,0 +1,37 @@
+<?xml version="1.0" encoding="UTF-8"?>
+<project xmlns="http://maven.apache.org/POM/4.0.0"
+         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
+         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
+  <modelVersion>4.0.0</modelVersion>
+
+  <parent>
+    <groupId>com.docutrust</groupId>
+    <artifactId>docutrust-parent</artifactId>
+    <version>1.0.0</version>
+  </parent>
+
+  <artifactId>docutrust-admin-service</artifactId>
+  <packaging>jar</packaging>
+  <name>DocuTrust Admin Service</name>
+  <description>Phase 1 stub (port 8083): GET /health only. Admin/orgs/audit/settings routes arrive in a later phase (notification inbox + settings included per RC-3).</description>
+
+  <dependencies>
+    <dependency>
+      <groupId>com.docutrust</groupId>
+      <artifactId>docutrust-shared</artifactId>
+    </dependency>
+  </dependencies>
+
+  <build>
+    <finalName>docutrust-admin-service</finalName>
+    <plugins>
+      <plugin>
+        <groupId>org.codehaus.mojo</groupId>
+        <artifactId>exec-maven-plugin</artifactId>
+        <configuration>
+          <mainClass>com.docutrust.adminservice.Main</mainClass>
+        </configuration>
+      </plugin>
+    </plugins>
+  </build>
+</project>
diff --git a/server/admin-service/src/main/java/com/docutrust/adminservice/Main.java b/server/admin-service/src/main/java/com/docutrust/adminservice/Main.java
new file mode 100644
index 0000000..1304486
--- /dev/null
+++ b/server/admin-service/src/main/java/com/docutrust/adminservice/Main.java
@@ -0,0 +1,35 @@
+package com.docutrust.adminservice;
+
+import com.docutrust.util.Json;
+import com.sun.net.httpserver.HttpServer;
+
+import java.net.InetSocketAddress;
+import java.nio.charset.StandardCharsets;
+
+// Phase 1 stub: proves the module builds against shared and binds its port.
+// No database, no migrations, no business routes - admin/orgs/audit/settings/notification
+// routes move here in a later phase.
+public final class Main {
+    private Main() {}
+
+    public static void main(String[] args) throws Exception {
+        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8083"));
+        byte[] body = Json.write(Json.obj(
+                "ok", true, "service", "admin-service", "port", port, "phase", 1))
+                .getBytes(StandardCharsets.UTF_8);
+        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
+        server.createContext("/health", ex -> {
+            if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
+                ex.sendResponseHeaders(405, -1);
+                return;
+            }
+            ex.getResponseHeaders().set("Content-Type", "application/json");
+            ex.sendResponseHeaders(200, body.length);
+            try (var os = ex.getResponseBody()) {
+                os.write(body);
+            }
+        });
+        server.start();
+        System.out.println("[admin-service] stub listening on http://localhost:" + port + " - GET /health (Phase 1)");
+    }
+}
diff --git a/server/auth-service/pom.xml b/server/auth-service/pom.xml
new file mode 100644
index 0000000..dab9f5f
--- /dev/null
+++ b/server/auth-service/pom.xml
@@ -0,0 +1,37 @@
+<?xml version="1.0" encoding="UTF-8"?>
+<project xmlns="http://maven.apache.org/POM/4.0.0"
+         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
+         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
+  <modelVersion>4.0.0</modelVersion>
+
+  <parent>
+    <groupId>com.docutrust</groupId>
+    <artifactId>docutrust-parent</artifactId>
+    <version>1.0.0</version>
+  </parent>
+
+  <artifactId>docutrust-auth-service</artifactId>
+  <packaging>jar</packaging>
+  <name>DocuTrust Auth Service</name>
+  <description>Phase 1 stub (port 8081): GET /health only. Auth/MFA/OTP/session routes arrive in Phase 2 when AuthController + AuthService + MfaService extract from core-service (excluding /api/auth/accept-invite per RC-1, which stays in core-service).</description>
+
+  <dependencies>
+    <dependency>
+      <groupId>com.docutrust</groupId>
+      <artifactId>docutrust-shared</artifactId>
+    </dependency>
+  </dependencies>
+
+  <build>
+    <finalName>docutrust-auth-service</finalName>
+    <plugins>
+      <plugin>
+        <groupId>org.codehaus.mojo</groupId>
+        <artifactId>exec-maven-plugin</artifactId>
+        <configuration>
+          <mainClass>com.docutrust.authservice.Main</mainClass>
+        </configuration>
+      </plugin>
+    </plugins>
+  </build>
+</project>
diff --git a/server/auth-service/src/main/java/com/docutrust/authservice/Main.java b/server/auth-service/src/main/java/com/docutrust/authservice/Main.java
new file mode 100644
index 0000000..b56a0ae
--- /dev/null
+++ b/server/auth-service/src/main/java/com/docutrust/authservice/Main.java
@@ -0,0 +1,34 @@
+package com.docutrust.authservice;
+
+import com.docutrust.util.Json;
+import com.sun.net.httpserver.HttpServer;
+
+import java.net.InetSocketAddress;
+import java.nio.charset.StandardCharsets;
+
+// Phase 1 stub: proves the module builds against shared and binds its port.
+// No database, no migrations, no business routes - the /api/auth/* routes move here in Phase 2.
+public final class Main {
+    private Main() {}
+
+    public static void main(String[] args) throws Exception {
+        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8081"));
+        byte[] body = Json.write(Json.obj(
+                "ok", true, "service", "auth-service", "port", port, "phase", 1))
+                .getBytes(StandardCharsets.UTF_8);
+        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
+        server.createContext("/health", ex -> {
+            if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
+                ex.sendResponseHeaders(405, -1);
+                return;
+            }
+            ex.getResponseHeaders().set("Content-Type", "application/json");
+            ex.sendResponseHeaders(200, body.length);
+            try (var os = ex.getResponseBody()) {
+                os.write(body);
+            }
+        });
+        server.start();
+        System.out.println("[auth-service] stub listening on http://localhost:" + port + " - GET /health (Phase 1)");
+    }
+}
diff --git a/server/core-service/README.md b/server/core-service/README.md
new file mode 100644
index 0000000..b2356af
--- /dev/null
+++ b/server/core-service/README.md
@@ -0,0 +1,41 @@
+# core-service (Phase 1)
+
+The original single-module DocuTrust backend, renamed. **Phase 1 extracts nothing**: this module
+still serves all 74 routes exactly as before, now on port 9000 by convention (PORT=9000 in the run
+command; Config's built-in default remains 8080). If any future extracted service misbehaves, the
+gateway can route back here and everything still works - that is the non-destructive migration
+contract. Package names remain `com.docutrust.*`; shared code (http stack, config, db, cross-service
+domain helpers) lives in the `shared` module and is consumed as a normal jar dependency.
+
+## Run (from `DocuTrust/server/`)
+
+    PORT=9000 MIGRATOR_ENABLED=true SEED_DEMO=true mvn -pl core-service exec:java
+
+Invoke Maven from `server/` (not from inside the module) so the working directory matches the old
+single-module layout: `MIGRATIONS_DIR` default `../database/migrations` and `VAULT_DIR` default
+`./data/vault` resolve exactly as they did before the split. Production jar (shade):
+`core-service/target/docutrust-core-service.jar`.
+
+## ExpiryScheduler - single-JVM contract
+
+`ExpiryScheduler` runs a 60-second background tick (document active→expiring→expired transitions,
+verification expiry, once-per-day-per-type notifications). It is process-local state over the shared
+database: **it must run on exactly one JVM per environment.** In Phase 1 it runs here, in
+core-service. When document/verification routes are extracted in a later phase, start it in exactly
+one service (vault-service, the eventual owner) and nowhere else, or expiry notifications and
+transition audits will double-fire.
+
+## Configuration notes (new in Phase 1)
+
+- `DB_POOL_MAX` - HikariCP `maximumPoolSize`. Phase 1 default **10** pins the current single-app
+  pool exactly. Phase 2: every DB-touching service must set **≤ 5** (4 services × 5 = 20
+  connections, within Neon limits).
+- `MIGRATOR_ENABLED` - gates `Migrator.apply` at boot. Default **true** preserves today's
+  unconditional, idempotent migration run with zero env vars; core-service sets true in dev. In
+  Phase 2 the migration-owning service (auth-service) keeps true and every other service sets
+  false, so migrations run exactly once.
+- Stubs (auth/vault/admin/gateway) never touch the database and never call `Migrator.apply`.
+
+## Rollback
+
+    git reset --hard pre-phase1
diff --git a/server/core-service/pom.xml b/server/core-service/pom.xml
new file mode 100644
index 0000000..117d760
--- /dev/null
+++ b/server/core-service/pom.xml
@@ -0,0 +1,69 @@
+<?xml version="1.0" encoding="UTF-8"?>
+<project xmlns="http://maven.apache.org/POM/4.0.0"
+         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
+         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
+  <modelVersion>4.0.0</modelVersion>
+
+  <parent>
+    <groupId>com.docutrust</groupId>
+    <artifactId>docutrust-parent</artifactId>
+    <version>1.0.0</version>
+  </parent>
+
+  <artifactId>docutrust-core-service</artifactId>
+  <packaging>jar</packaging>
+  <name>DocuTrust Core Service</name>
+  <description>The original monolith renamed. Phase 1: serves ALL 74 routes (nothing extracted yet). ExpiryScheduler runs here - it must run on exactly one JVM. See core-service/README.md.</description>
+
+  <!-- MIGRATOR_ENABLED defaults to true in Config (preserves today's unconditional,
+       idempotent Migrator.apply). This property documents the intent for core-service;
+       the effective value at runtime comes from the environment (MIGRATOR_ENABLED). -->
+  <properties>
+    <MIGRATOR_ENABLED>true</MIGRATOR_ENABLED>
+  </properties>
+
+  <dependencies>
+    <dependency>
+      <groupId>com.docutrust</groupId>
+      <artifactId>docutrust-shared</artifactId>
+    </dependency>
+  </dependencies>
+
+  <build>
+    <finalName>docutrust-core-service</finalName>
+    <plugins>
+      <!-- Exec plugin for local development: run from server/ so the MIGRATIONS_DIR
+           default (../database/migrations) and VAULT_DIR (./data/vault) resolve as before.
+           Example: PORT=9000 MIGRATOR_ENABLED=true mvn -pl core-service exec:java -->
+      <plugin>
+        <groupId>org.codehaus.mojo</groupId>
+        <artifactId>exec-maven-plugin</artifactId>
+        <configuration>
+          <mainClass>com.docutrust.Main</mainClass>
+        </configuration>
+      </plugin>
+
+      <!-- Shade plugin for production (bundles all dependencies into one runnable jar) -->
+      <plugin>
+        <groupId>org.apache.maven.plugins</groupId>
+        <artifactId>maven-shade-plugin</artifactId>
+        <executions>
+          <execution>
+            <phase>package</phase>
+            <goals>
+              <goal>shade</goal>
+            </goals>
+            <configuration>
+              <createDependencyReducedPom>false</createDependencyReducedPom>
+              <transformers>
+                <transformer implementation="org.apache.maven.plugins.shade.resource.ManifestResourceTransformer">
+                  <mainClass>com.docutrust.Main</mainClass>
+                </transformer>
+              </transformers>
+            </configuration>
+          </execution>
+        </executions>
+      </plugin>
+    </plugins>
+  </build>
+</project>
diff --git a/server/core-service/src/main/java/com/docutrust/Main.java b/server/core-service/src/main/java/com/docutrust/Main.java
index 2ead5a5..4b42af6 100644
--- a/server/core-service/src/main/java/com/docutrust/Main.java
+++ b/server/core-service/src/main/java/com/docutrust/Main.java
@@ -104,9 +104,14 @@ public final class Main {
             }
             initSql = "SET search_path TO " + schema + ", public";
         }
-        Database db = new Database(cfg.dbUrl, cfg.dbUser, cfg.dbPassword, 2, 10, initSql);
-        List<String> migrations = Migrator.apply(db, cfg.migrationsDir);
-        System.out.println("[main] migrations applied: " + migrations.size());
+        Database db = new Database(cfg.dbUrl, cfg.dbUser, cfg.dbPassword, 2, cfg.dbPoolMax, initSql);
+        List<String> migrations = List.of();
+        if (cfg.migratorEnabled) {
+            migrations = Migrator.apply(db, cfg.migrationsDir);
+            System.out.println("[main] migrations applied: " + migrations.size());
+        } else {
+            System.out.println("[main] migrations skipped (MIGRATOR_ENABLED=false)");
+        }
 
         FileVault vault = new FileVault(Path.of(cfg.vaultDir), vaultKeyBytes(cfg.vaultKey));
         PasswordService passwords = new PasswordService();
@@ -140,7 +145,7 @@ public final class Main {
         NotificationController notifC = new NotificationController(notifications, settings);
         AdminController adminC = new AdminController(admin);
         OrgController orgC = new OrgController(org);
-        HealthController healthC = new HealthController(db);
+        HealthController healthC = new HealthController(db, cfg);
 
         // ---- public: health & meta ----
         router.publicRoute("GET", "/api/health", healthC.health());
diff --git a/server/gateway/pom.xml b/server/gateway/pom.xml
new file mode 100644
index 0000000..a923cdb
--- /dev/null
+++ b/server/gateway/pom.xml
@@ -0,0 +1,30 @@
+<?xml version="1.0" encoding="UTF-8"?>
+<project xmlns="http://maven.apache.org/POM/4.0.0"
+         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
+         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
+  <modelVersion>4.0.0</modelVersion>
+
+  <parent>
+    <groupId>com.docutrust</groupId>
+    <artifactId>docutrust-parent</artifactId>
+    <version>1.0.0</version>
+  </parent>
+
+  <artifactId>docutrust-gateway</artifactId>
+  <packaging>jar</packaging>
+  <name>DocuTrust Gateway</name>
+  <description>Phase 1 stub (port 8080): GET /health only, no database, no dependencies. Reverse-proxy routing to core/auth/vault/admin arrives in a later phase; until then leave the gateway stopped during demos and run core-service with PORT=8080 for the mobile client.</description>
+
+  <build>
+    <finalName>docutrust-gateway</finalName>
+    <plugins>
+      <plugin>
+        <groupId>org.codehaus.mojo</groupId>
+        <artifactId>exec-maven-plugin</artifactId>
+        <configuration>
+          <mainClass>com.docutrust.gateway.Main</mainClass>
+        </configuration>
+      </plugin>
+    </plugins>
+  </build>
+</project>
diff --git a/server/gateway/src/main/java/com/docutrust/gateway/Main.java b/server/gateway/src/main/java/com/docutrust/gateway/Main.java
new file mode 100644
index 0000000..72b7eb7
--- /dev/null
+++ b/server/gateway/src/main/java/com/docutrust/gateway/Main.java
@@ -0,0 +1,36 @@
+package com.docutrust.gateway;
+
+import com.sun.net.httpserver.HttpServer;
+
+import java.net.InetSocketAddress;
+import java.nio.charset.StandardCharsets;
+
+// Phase 1 stub: binds 8080 and answers GET /health only. Zero dependencies - no shared
+// library, no database. Reverse-proxy routing to core-service (9000), auth-service (8081),
+// vault-service (8082) and admin-service (8083) arrives in a later phase, including the
+// exact-path rule for /api/auth/accept-invite (RC-1: auth prefix, admin-service logic).
+// Until proxying exists, run core-service with PORT=8080 for the mobile client and leave
+// this stub stopped, or accept that 8080 serves only the health probe.
+public final class Main {
+    private Main() {}
+
+    public static void main(String[] args) throws Exception {
+        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8080"));
+        String json = "{\"ok\":true,\"service\":\"gateway\",\"port\":" + port + ",\"phase\":1}";
+        byte[] body = json.getBytes(StandardCharsets.UTF_8);
+        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
+        server.createContext("/health", ex -> {
+            if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
+                ex.sendResponseHeaders(405, -1);
+                return;
+            }
+            ex.getResponseHeaders().set("Content-Type", "application/json");
+            ex.sendResponseHeaders(200, body.length);
+            try (var os = ex.getResponseBody()) {
+                os.write(body);
+            }
+        });
+        server.start();
+        System.out.println("[gateway] stub listening on http://localhost:" + port + " - GET /health (Phase 1; no proxy yet)");
+    }
+}
diff --git a/server/pom.xml b/server/pom.xml
index 32d5870..6fe44ca 100644
--- a/server/pom.xml
+++ b/server/pom.xml
@@ -5,100 +5,100 @@
   <modelVersion>4.0.0</modelVersion>
 
   <groupId>com.docutrust</groupId>
-  <artifactId>docutrust-server</artifactId>
+  <artifactId>docutrust-parent</artifactId>
   <version>1.0.0</version>
-  <packaging>jar</packaging>
-  <name>DocuTrust Server</name>
-  <description>Pure Java 21 backend for DocuTrust - no frameworks, no JUnit.</description>
+  <packaging>pom</packaging>
+  <name>DocuTrust Parent</name>
+  <description>Pure Java 21 backend for DocuTrust - no frameworks, no JUnit. Phase 1: shared library + core-service (the monolith, all 74 routes) + three service stubs + gateway stub. Package names stay com.docutrust.*; only physical file locations moved.</description>
+
+  <modules>
+    <module>shared</module>
+    <module>core-service</module>
+    <module>auth-service</module>
+    <module>vault-service</module>
+    <module>admin-service</module>
+    <module>gateway</module>
+  </modules>
 
   <properties>
     <maven.compiler.release>21</maven.compiler.release>
     <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
   </properties>
 
-  <dependencies>
-    <!-- Bumped to 42.7.14 to patch CVEs -->
-    <dependency>
-      <groupId>org.postgresql</groupId>
-      <artifactId>postgresql</artifactId>
-      <version>42.7.14</version>
-    </dependency>
+  <dependencyManagement>
+    <dependencies>
+      <!-- Bumped to 42.7.14 to patch CVEs -->
+      <dependency>
+        <groupId>org.postgresql</groupId>
+        <artifactId>postgresql</artifactId>
+        <version>42.7.14</version>
+      </dependency>
+
+      <!-- INFRA-2: connection pooling, rate limiting, caching, metrics, optional telemetry -->
+      <dependency>
+        <groupId>com.zaxxer</groupId>
+        <artifactId>HikariCP</artifactId>
+        <version>5.1.0</version>
+      </dependency>
+      <dependency>
+        <groupId>com.bucket4j</groupId>
+        <artifactId>bucket4j-core</artifactId>
+        <version>8.10.1</version>
+      </dependency>
+      <dependency>
+        <groupId>com.github.ben-manes.caffeine</groupId>
+        <artifactId>caffeine</artifactId>
+        <version>3.1.8</version>
+      </dependency>
+      <dependency>
+        <groupId>io.dropwizard.metrics</groupId>
+        <artifactId>metrics-core</artifactId>
+        <version>4.2.25</version>
+      </dependency>
+      <dependency>
+        <groupId>io.sentry</groupId>
+        <artifactId>sentry</artifactId>
+        <version>7.14.0</version>
+      </dependency>
 
-    <!-- INFRA-2: connection pooling, rate limiting, caching, metrics, optional telemetry -->
-    <dependency>
-      <groupId>com.zaxxer</groupId>
-      <artifactId>HikariCP</artifactId>
-      <version>5.1.0</version>
-    </dependency>
-    <dependency>
-      <groupId>com.bucket4j</groupId>
-      <artifactId>bucket4j-core</artifactId>
-      <version>8.10.1</version>
-    </dependency>
-    <dependency>
-      <groupId>com.github.ben-manes.caffeine</groupId>
-      <artifactId>caffeine</artifactId>
-      <version>3.1.8</version>
-    </dependency>
-    <dependency>
-      <groupId>io.dropwizard.metrics</groupId>
-      <artifactId>metrics-core</artifactId>
-      <version>4.2.25</version>
-    </dependency>
-    <dependency>
-      <groupId>io.sentry</groupId>
-      <artifactId>sentry</artifactId>
-      <version>7.14.0</version>
-    </dependency>
+      <!-- SLF4J: Removed slf4j-nop so simple logging actually works -->
+      <dependency>
+        <groupId>org.slf4j</groupId>
+        <artifactId>slf4j-api</artifactId>
+        <version>2.0.13</version>
+      </dependency>
+      <dependency>
+        <groupId>org.slf4j</groupId>
+        <artifactId>slf4j-simple</artifactId>
+        <version>2.0.13</version>
+      </dependency>
 
-    <!-- SLF4J: Removed slf4j-nop so simple logging actually works -->
-    <dependency>
-      <groupId>org.slf4j</groupId>
-      <artifactId>slf4j-api</artifactId>
-      <version>2.0.13</version>
-    </dependency>
-    <dependency>
-      <groupId>org.slf4j</groupId>
-      <artifactId>slf4j-simple</artifactId>
-      <version>2.0.13</version>
-    </dependency>
-  </dependencies>
+      <!-- Internal: shared library consumed by core-service and the future service extractions -->
+      <dependency>
+        <groupId>com.docutrust</groupId>
+        <artifactId>docutrust-shared</artifactId>
+        <version>${project.version}</version>
+      </dependency>
+    </dependencies>
+  </dependencyManagement>
 
   <build>
-    <finalName>docutrust-server</finalName>
-    <plugins>
-      <!-- Exec plugin for local development -->
-      <plugin>
-        <groupId>org.codehaus.mojo</groupId>
-        <artifactId>exec-maven-plugin</artifactId>
-        <version>3.1.0</version>
-        <configuration>
-          <mainClass>com.docutrust.Main</mainClass>
-        </configuration>
-      </plugin>
+    <pluginManagement>
+      <plugins>
+        <!-- Exec plugin for local development -->
+        <plugin>
+          <groupId>org.codehaus.mojo</groupId>
+          <artifactId>exec-maven-plugin</artifactId>
+          <version>3.1.0</version>
+        </plugin>
 
-      <!-- Shade plugin for production (bundles all dependencies into one runnable jar) -->
-      <plugin>
-        <groupId>org.apache.maven.plugins</groupId>
-        <artifactId>maven-shade-plugin</artifactId>
-        <version>3.5.1</version>
-        <executions>
-          <execution>
-            <phase>package</phase>
-            <goals>
-              <goal>shade</goal>
-            </goals>
-            <configuration>
-              <createDependencyReducedPom>false</createDependencyReducedPom>
-              <transformers>
-                <transformer implementation="org.apache.maven.plugins.shade.resource.ManifestResourceTransformer">
-                  <mainClass>com.docutrust.Main</mainClass>
-                </transformer>
-              </transformers>
-            </configuration>
-          </execution>
-        </executions>
-      </plugin>
-    </plugins>
+        <!-- Shade plugin for production (bundles all dependencies into one runnable jar) -->
+        <plugin>
+          <groupId>org.apache.maven.plugins</groupId>
+          <artifactId>maven-shade-plugin</artifactId>
+          <version>3.5.1</version>
+        </plugin>
+      </plugins>
+    </pluginManagement>
   </build>
-</project>
\ No newline at end of file
+</project>
diff --git a/server/shared/pom.xml b/server/shared/pom.xml
new file mode 100644
index 0000000..9b0c85e
--- /dev/null
+++ b/server/shared/pom.xml
@@ -0,0 +1,56 @@
+<?xml version="1.0" encoding="UTF-8"?>
+<project xmlns="http://maven.apache.org/POM/4.0.0"
+         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
+         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
+  <modelVersion>4.0.0</modelVersion>
+
+  <parent>
+    <groupId>com.docutrust</groupId>
+    <artifactId>docutrust-parent</artifactId>
+    <version>1.0.0</version>
+  </parent>
+
+  <artifactId>docutrust-shared</artifactId>
+  <packaging>jar</packaging>
+  <name>DocuTrust Shared</name>
+  <description>Library jar (no port, no Main): http stack, config, db access, cross-service domain helpers. Carries every dependency today so any future service module can extract code without new pom surgery; slim down per-service in Phase 2+ if desired.</description>
+
+  <dependencies>
+    <dependency>
+      <groupId>org.postgresql</groupId>
+      <artifactId>postgresql</artifactId>
+    </dependency>
+    <dependency>
+      <groupId>com.zaxxer</groupId>
+      <artifactId>HikariCP</artifactId>
+    </dependency>
+    <dependency>
+      <groupId>com.bucket4j</groupId>
+      <artifactId>bucket4j-core</artifactId>
+    </dependency>
+    <dependency>
+      <groupId>com.github.ben-manes.caffeine</groupId>
+      <artifactId>caffeine</artifactId>
+    </dependency>
+    <dependency>
+      <groupId>io.dropwizard.metrics</groupId>
+      <artifactId>metrics-core</artifactId>
+    </dependency>
+    <dependency>
+      <groupId>io.sentry</groupId>
+      <artifactId>sentry</artifactId>
+    </dependency>
+    <dependency>
+      <groupId>org.slf4j</groupId>
+      <artifactId>slf4j-api</artifactId>
+    </dependency>
+    <dependency>
+      <groupId>org.slf4j</groupId>
+      <artifactId>slf4j-simple</artifactId>
+    </dependency>
+  </dependencies>
+
+  <build>
+    <finalName>docutrust-shared</finalName>
+  </build>
+</project>
diff --git a/server/shared/src/main/java/com/docutrust/config/Config.java b/server/shared/src/main/java/com/docutrust/config/Config.java
index 5d374f3..faa09bb 100644
--- a/server/shared/src/main/java/com/docutrust/config/Config.java
+++ b/server/shared/src/main/java/com/docutrust/config/Config.java
@@ -13,6 +13,8 @@ public final class Config {
     public final int port;
     public final String dbUrl, dbUser, dbPassword, jwtSecret, vaultKey, vaultDir, corsOrigin, migrationsDir, dbSchema;
     public final boolean seedDemo;
+    public final int dbPoolMax;
+    public final boolean migratorEnabled;
     // OTP mail delivery (Brevo) + optional Sentry Spotlight profiling.
     public final String mailMode, brevoApiKey, brevoSenderEmail, brevoSenderName;
     public final boolean spotlightEnabled;
@@ -61,6 +63,12 @@ public final class Config {
             System.err.println("SEED_DEMO=true is only permitted with a localhost database. Demo credentials are in source control.");
             System.exit(1);
         }
+        // Phase 1 multi-module: pool size and the migration gate became configuration concerns.
+        // DB_POOL_MAX default 10 pins the monolith's current pool (Phase 2 drops each DB-touching
+        // service to <= 5 - Neon limits). MIGRATOR_ENABLED default true preserves today's
+        // unconditional, idempotent Migrator.apply on boot.
+        dbPoolMax = Integer.parseInt(getOrDefault("DB_POOL_MAX", "10"));
+        migratorEnabled = !"false".equalsIgnoreCase(getOrDefault("MIGRATOR_ENABLED", "true"));
         mailMode = getOrDefault("MAIL_MODE", "dev");
         brevoApiKey = get("BREVO_API_KEY");
         brevoSenderEmail = get("BREVO_SENDER_EMAIL");
@@ -166,4 +174,9 @@ public final class Config {
         String v = get(key);
         return v == null ? dflt : v;
     }
+
+    /** Public read for shared classes constructed outside Main (e.g. HealthController's MAIL_MODE lookup). */
+    public String get(String key, String dflt) {
+        return getOrDefault(key, dflt);
+    }
 }
diff --git a/server/shared/src/main/java/com/docutrust/controller/HealthController.java b/server/shared/src/main/java/com/docutrust/controller/HealthController.java
index 670a011..295be86 100644
--- a/server/shared/src/main/java/com/docutrust/controller/HealthController.java
+++ b/server/shared/src/main/java/com/docutrust/controller/HealthController.java
@@ -1,5 +1,6 @@
 package com.docutrust.controller;
 
+import com.docutrust.config.Config;
 import com.docutrust.db.Database;
 import com.docutrust.http.Handler;
 import com.docutrust.util.Json;
@@ -11,8 +12,9 @@ public final class HealthController {
             + "tamper-evident verification links, admin review for sensitive documents and full audit trails.";
 
     private final Database db;
+    private final Config cfg;
 
-    public HealthController(Database db) { this.db = db; }
+    public HealthController(Database db, Config cfg) { this.db = db; this.cfg = cfg; }
 
     public Handler health() {
         return ctx -> ctx.ok(Json.obj("ok", true, "db", db.healthy(),
@@ -37,8 +39,8 @@ public final class HealthController {
                         "mail", mailInfo())));
     }
 
-    private static String mailInfo() {
-        String mode = java.util.Optional.ofNullable(System.getenv("MAIL_MODE")).orElse("dev");
+    private String mailInfo() {
+        String mode = cfg.get("MAIL_MODE", "dev");
         return "live".equalsIgnoreCase(mode) ? "Brevo" : "Brevo (dev mode: X-Dev-OTP)";
     }
 }
diff --git a/server/vault-service/pom.xml b/server/vault-service/pom.xml
new file mode 100644
index 0000000..60c9d06
--- /dev/null
+++ b/server/vault-service/pom.xml
@@ -0,0 +1,37 @@
+<?xml version="1.0" encoding="UTF-8"?>
+<project xmlns="http://maven.apache.org/POM/4.0.0"
+         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
+         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
+  <modelVersion>4.0.0</modelVersion>
+
+  <parent>
+    <groupId>com.docutrust</groupId>
+    <artifactId>docutrust-parent</artifactId>
+    <version>1.0.0</version>
+  </parent>
+
+  <artifactId>docutrust-vault-service</artifactId>
+  <packaging>jar</packaging>
+  <name>DocuTrust Vault Service</name>
+  <description>Phase 1 stub (port 8082): GET /health only. Documents/folders/shares/verification routes arrive in a later phase. Note: ExpiryScheduler (documents + verification expiry) must run on exactly one JVM once extracted.</description>
+
+  <dependencies>
+    <dependency>
+      <groupId>com.docutrust</groupId>
+      <artifactId>docutrust-shared</artifactId>
+    </dependency>
+  </dependencies>
+
+  <build>
+    <finalName>docutrust-vault-service</finalName>
+    <plugins>
+      <plugin>
+        <groupId>org.codehaus.mojo</groupId>
+        <artifactId>exec-maven-plugin</artifactId>
+        <configuration>
+          <mainClass>com.docutrust.vaultservice.Main</mainClass>
+        </configuration>
+      </plugin>
+    </plugins>
+  </build>
+</project>
diff --git a/server/vault-service/src/main/java/com/docutrust/vaultservice/Main.java b/server/vault-service/src/main/java/com/docutrust/vaultservice/Main.java
new file mode 100644
index 0000000..01e02dd
--- /dev/null
+++ b/server/vault-service/src/main/java/com/docutrust/vaultservice/Main.java
@@ -0,0 +1,35 @@
+package com.docutrust.vaultservice;
+
+import com.docutrust.util.Json;
+import com.sun.net.httpserver.HttpServer;
+
+import java.net.InetSocketAddress;
+import java.nio.charset.StandardCharsets;
+
+// Phase 1 stub: proves the module builds against shared and binds its port.
+// No database, no vault directory, no business routes - documents/folders/shares/verification
+// routes move here in a later phase. ExpiryScheduler must then run on exactly one JVM.
+public final class Main {
+    private Main() {}
+
+    public static void main(String[] args) throws Exception {
+        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8082"));
+        byte[] body = Json.write(Json.obj(
+                "ok", true, "service", "vault-service", "port", port, "phase", 1))
+                .getBytes(StandardCharsets.UTF_8);
+        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
+        server.createContext("/health", ex -> {
+            if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
+                ex.sendResponseHeaders(405, -1);
+                return;
+            }
+            ex.getResponseHeaders().set("Content-Type", "application/json");
+            ex.sendResponseHeaders(200, body.length);
+            try (var os = ex.getResponseBody()) {
+                os.write(body);
+            }
+        });
+        server.start();
+        System.out.println("[vault-service] stub listening on http://localhost:" + port + " - GET /health (Phase 1)");
+    }
+}
```

## Notes on decisions inside the approved scope

- **TokenService path**: it lives in `com.docutrust.auth` (not `service/` — my first moves script had that wrong and the git tree caught it); it moves `auth/TokenService.java` → `shared/.../auth/TokenService.java` per your Q1 shared placement.
- **MIGRATOR_ENABLED pom property**: the `<MIGRATOR_ENABLED>true</MIGRATOR_ENABLED>` in core-service's pom is declarative documentation — Maven properties don't set process env. The effective behavior comes from Config's default **true** (your amendment), so zero env vars preserve today's always-migrate boot; the run command in the README passes it explicitly anyway.
- **`mailInfo()` had to become an instance method** (it was `static` but now reads the injected `cfg`) — caught by the compile, part of the sanctioned CF-3 fix.
- **Repo is CRLF end-to-end**: the patch preserves that (a naive patch would have rewritten four whole files); the only "trailing whitespace" warnings from `git apply` are CRLF artifacts — harmless, don't `--whitespace=fix`.
- **The only content changes to existing files** are: Config.java (+2 fields, +2 config reads, +1 public accessor), Main.java (pool max from config, migration gate, HealthController wiring), HealthController.java (CF-3), .env.example (+10 doc lines), Dockerfile (deploy-path repair, flagged above), parent pom (identity). The 48 moved files are byte-identical (git shows 48 × R100).

## Acceptance gate

1. `cd DocuTrust/server && mvn clean install` — all 6 modules (parent, shared, core-service, auth-service, vault-service, admin-service, gateway) exit 0. Verified here: BUILD SUCCESS, twice, including from a virgin baseline + moves script + this exact patch.
2. Four stubs each serve `GET /health` on 8080/8081/8082/8083 (verified by curl here); `gateway` has no dependencies and never touches the DB; the three service stubs compile against `docutrust-shared`.
3. On your machine (needs a live Postgres, which this sandbox lacks): `PORT=9000 MIGRATOR_ENABLED=true mvn -pl core-service exec:java` from `server/` — expect the familiar boot line with `routes=74`, migrations applied once, and the pool maxed at `DB_POOL_MAX=10`. That regression smoke is the Phase 2 gate.
4. For the Monday demo: run core with `PORT=8080` and leave the gateway stub stopped until the proxy phase, so the mobile client's contract is untouched.

## Rollback

```bash
git reset --hard pre-phase1
```

(taken right after `git tag pre-phase1`, before the moves)

Phase 2 (auth routes → auth-service, excluding `/api/auth/accept-invite` per RC-1) is scoped and on hold — I will not start it until you say "Phase 1 verified, begin Phase 2."