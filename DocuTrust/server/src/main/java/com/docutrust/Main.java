package com.docutrust;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.Executors;

import com.docutrust.auth.JwtService;
import com.docutrust.auth.MfaService;
import com.docutrust.auth.PasswordService;
import com.docutrust.auth.RateLimiter;
import com.docutrust.auth.TokenService;
import com.docutrust.bootstrap.Bootstrap;
import com.docutrust.config.Config;
import com.docutrust.controller.AdminController;
import com.docutrust.controller.AuthController;
import com.docutrust.controller.DocumentController;
import com.docutrust.controller.FolderController;
import com.docutrust.controller.HealthController;
import com.docutrust.controller.NotificationController;
import com.docutrust.controller.OrgController;
import com.docutrust.controller.PublicController;
import com.docutrust.controller.ShareController;
import com.docutrust.controller.VerificationController;
import com.docutrust.db.Database;
import com.docutrust.db.Migrator;
import com.docutrust.http.Middleware;
import com.docutrust.http.Router;
import com.docutrust.service.AdminService;
import com.docutrust.service.AuditService;
import com.docutrust.service.AuthService;
import com.docutrust.service.DocumentService;
import com.docutrust.service.ExpiryScheduler;
import com.docutrust.service.FolderService;
import com.docutrust.service.MailService;
import com.docutrust.service.NotificationService;
import com.docutrust.service.OrgService;
import com.docutrust.service.OtpService;
import com.docutrust.service.SettingsService;
import com.docutrust.service.ShareService;
import com.docutrust.service.StepUpService;
import com.docutrust.service.VerifyService;
import com.docutrust.util.Text;
import com.docutrust.vault.FileVault;
import com.sun.net.httpserver.HttpServer;

// Composition root: loads config, migrates the DB, wires services + controllers, registers every
// route from docs/API_CONTRACTS.md, seeds demo data, starts the expiry scheduler and the HTTP server.
public final class Main {
    private Main() {}

    public static final class App {
        public final HttpServer server;
        public final Database db;
        public final Router router;
        public final ExpiryScheduler scheduler;

        App(HttpServer server, Database db, Router router, ExpiryScheduler scheduler) {
            this.server = server;
            this.db = db;
            this.router = router;
            this.scheduler = scheduler;
        }

        public void stop() {
            scheduler.stop();
            server.stop(0);
            db.close();
        }
    }

    public static void main(String[] args) {
        Config cfg = Config.load();
        if (cfg.dbUrl == null || cfg.dbUrl.isBlank()) {
            System.out.println("DB_URL not configured - set .env (see .env.example)");
            System.exit(1);
        }
        try {
            App app = start(cfg);
            Runtime.getRuntime().addShutdownHook(new Thread(() -> {
                System.out.println("[main] shutting down...");
                app.stop();
            }));
            System.out.println("DocuTrust API listening on http://localhost:" + cfg.port + " - press Ctrl+C to stop");
            Thread.currentThread().join();
        } catch (Exception e) {
            System.err.println("[main] fatal: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }

    public static App start(Config cfg) throws Exception {
        long t0 = System.currentTimeMillis();
        com.docutrust.infra.Spotlight.init(cfg); // optional, SPOTLIGHT_ENABLED=true only
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
        Database db = new Database(cfg.dbUrl, cfg.dbUser, cfg.dbPassword, 2, 10, initSql);
        List<String> migrations = Migrator.apply(db, cfg.migrationsDir);
        System.out.println("[main] migrations applied: " + migrations.size());

        FileVault vault = new FileVault(Path.of(cfg.vaultDir), vaultKeyBytes(cfg.vaultKey));
        PasswordService passwords = new PasswordService();
        MfaService mfa = new MfaService();
        JwtService jwt = new JwtService(cfg.jwtSecret);
        RateLimiter limiter = new RateLimiter();
        TokenService tokens = new TokenService(db, jwt);
        Middleware mw = new Middleware(db, jwt, limiter);

        AuditService audit = new AuditService(db);
        NotificationService notifications = new NotificationService(db);
        SettingsService settings = new SettingsService(db);
        MailService mail = new MailService(cfg);
        OtpService otps = new OtpService();
        StepUpService stepUps = new StepUpService(db, otps, mail, jwt, audit);
        DocumentService documents = new DocumentService(db, vault, audit, notifications, stepUps);
        AuthService auth = new AuthService(db, passwords, tokens, mfa, audit, mail, otps, stepUps, jwt, cfg.seedDemo);
        FolderService folders = new FolderService(db, audit, documents);
        ShareService shares = new ShareService(db, passwords, documents, audit, notifications, vault, otps, mail);
        VerifyService verify = new VerifyService(db, vault, audit, documents);
        AdminService admin = new AdminService(db, tokens, audit, notifications);
        OrgService org = new OrgService(db, passwords, audit, notifications, otps, mail, tokens);

        Router router = new Router(cfg, db, mw);
        AuthController authC = new AuthController(auth, stepUps, mail);
        DocumentController docC = new DocumentController(documents);
        FolderController folderC = new FolderController(folders);
        ShareController shareC = new ShareController(shares);
        PublicController publicC = new PublicController(shares, verify);
        VerificationController verC = new VerificationController(verify);
        NotificationController notifC = new NotificationController(notifications, settings);
        AdminController adminC = new AdminController(admin);
        OrgController orgC = new OrgController(org);
        HealthController healthC = new HealthController(db);

        // ---- public: health & meta ----
        router.publicRoute("GET", "/api/health", healthC.health());
        router.publicRoute("GET", "/api/meta", healthC.meta());

        // ---- public: auth (login/register/forgot/reset rate limited) ----
        router.rateLimited("POST", "/api/auth/register", "auth", authC.register());
        router.rateLimited("POST", "/api/auth/login", "auth", authC.login());
        router.rateLimited("POST", "/api/auth/forgot-password", "auth", authC.forgotPassword());
        router.rateLimited("POST", "/api/auth/reset-password-otp", "auth", authC.resetPasswordOtp());
        router.rateLimited("POST", "/api/auth/verify-otp", "auth", authC.verifyOtp());
        router.rateLimited("POST", "/api/auth/accept-invite", "auth", orgC.acceptInvite());
        router.publicRoute("POST", "/api/auth/refresh", authC.refresh());
        router.publicRoute("POST", "/api/auth/logout", authC.logout());
        router.publicRoute("GET", "/api/auth/verify-email", authC.verifyEmail());

        // ---- auth ----
        router.auth("GET", "/api/auth/me", authC.me());
        router.auth("PATCH", "/api/auth/me", authC.updateMe());
        router.auth("POST", "/api/auth/change-password", authC.changePassword());
        router.auth("POST", "/api/auth/request-step-up", authC.requestStepUp());
        router.auth("POST", "/api/auth/verify-step-up", authC.verifyStepUp());
        router.auth("POST", "/api/auth/mfa/setup", authC.mfaSetup());
        router.auth("POST", "/api/auth/mfa/enable", authC.mfaEnable());
        router.auth("POST", "/api/auth/mfa/disable", authC.mfaDisable());

        // ---- documents ----
        router.auth("GET", "/api/documents", docC.list());
        router.auth("POST", "/api/documents", docC.upload());
        router.auth("GET", "/api/documents/expiring", docC.expiring());
        router.auth("GET", "/api/documents/:id", docC.get());
        router.auth("PATCH", "/api/documents/:id", docC.patch());
        router.auth("DELETE", "/api/documents/:id", docC.softDelete());
        router.auth("POST", "/api/documents/:id/restore", docC.restore());
        router.auth("DELETE", "/api/documents/:id/permanent", docC.permanentDelete());
        router.auth("POST", "/api/documents/:id/versions", docC.addVersion());
        router.auth("GET", "/api/documents/:id/versions", docC.versions());
        router.auth("GET", "/api/documents/:id/versions/:v/download", docC.downloadVersion());
        router.auth("GET", "/api/documents/:id/download", docC.download());
        router.auth("GET", "/api/documents/:id/history", docC.history());

        // ---- folders ----
        router.auth("GET", "/api/folders", folderC.list());
        router.auth("POST", "/api/folders", folderC.create());
        router.auth("PATCH", "/api/folders/:id", folderC.rename());
        router.auth("DELETE", "/api/folders/:id", folderC.delete());
        router.auth("GET", "/api/folders/:id/documents", folderC.documents());

        // ---- shares ----
        router.auth("GET", "/api/shares", shareC.mine());
        router.auth("POST", "/api/shares", shareC.create());
        router.auth("GET", "/api/shares/incoming", shareC.incoming());
        router.auth("POST", "/api/shares/:id/revoke", shareC.revoke());
        router.auth("DELETE", "/api/shares/:id", shareC.delete());
        router.auth("GET", "/api/shares/:id/stats", shareC.stats());

        // ---- public share links (rate limited) ----
        router.rateLimited("GET", "/api/public/shares/:token", "public-share", publicC.shareInfo());
        router.rateLimited("POST", "/api/public/shares/:token/open", "public-share", publicC.shareOpen());
        router.rateLimited("POST", "/api/public/shares/:token/request-otp", "public-share", publicC.shareRequestOtp());
        router.rateLimited("POST", "/api/public/shares/:token/open-with-otp", "public-share", publicC.shareOpenWithOtp());
        router.rateLimited("GET", "/api/public/download/:ticket", "public-share", publicC.download());

        // ---- verification ----
        router.auth("GET", "/api/verification-requests", verC.list());
        router.auth("POST", "/api/verification-requests", verC.create());
        router.auth("GET", "/api/verification-requests/:id", verC.detail());
        router.auth("POST", "/api/verification-requests/:id/approve", verC.approve());
        router.auth("POST", "/api/verification-requests/:id/reject", verC.reject());

        // ---- public verify (rate limited) ----
        router.rateLimited("GET", "/api/public/verify/:token", "public-verify", publicC.verifyToken());

        // ---- notifications & settings ----
        router.auth("GET", "/api/notifications", notifC.list());
        router.auth("POST", "/api/notifications/read-all", notifC.markAllRead());
        router.auth("POST", "/api/notifications/:id/read", notifC.markRead());
        router.auth("GET", "/api/settings/notifications", notifC.getSettings());
        router.auth("PUT", "/api/settings/notifications", notifC.putSettings());

        // ---- admin ----
        router.role("GET", "/api/admin/stats", "admin", adminC.stats());
        router.role("GET", "/api/admin/review-queue", "admin", adminC.reviewQueue());
        router.role("POST", "/api/admin/reviews/:id/decision", "admin", adminC.decision());
        router.role("GET", "/api/admin/users", "admin", adminC.users());
        router.role("PATCH", "/api/admin/users/:id/status", "admin", adminC.setUserStatus());
        router.role("GET", "/api/admin/documents", "admin", adminC.documents());
        router.role("GET", "/api/admin/audit-logs", "admin", adminC.auditLogs());

        // ---- organisation ----
        router.anyRole("GET", "/api/org/members", orgC.members(), "admin", "org_manager");
        router.anyRole("POST", "/api/org/invite", orgC.invite(), "admin", "org_manager");
        router.anyRole("PATCH", "/api/org/members/:id/role", orgC.changeRole(), "admin", "org_manager");
        router.anyRole("DELETE", "/api/org/members/:id", orgC.remove(), "admin", "org_manager");
        router.anyRole("GET", "/api/org/stats", orgC.stats(), "admin", "org_manager");

        // ---- boot extras ----
        if (cfg.seedDemo) {
            System.err.println("[SECURITY WARNING] SEED_DEMO is true -- reset codes are returned in HTTP responses. This is demo-only behavior.");
        }
        Bootstrap.seed(db, vault, passwords, cfg.seedDemo, cfg.dbUrl);
        ExpiryScheduler scheduler = new ExpiryScheduler(db, notifications);
        scheduler.start();

        HttpServer server = HttpServer.create(new InetSocketAddress(cfg.port), 0);
        server.createContext("/", router);
        server.setExecutor(Executors.newFixedThreadPool(32));
        server.start();

        System.out.println("[main] DocuTrust ready on port " + cfg.port
                + " (migrations=" + migrations.size() + ", routes=" + router.routeCount()
                + ", db=" + (db.healthy() ? "up" : "DOWN") + ", boot=" + (System.currentTimeMillis() - t0) + "ms)");
        return new App(server, db, router, scheduler);
    }

    /**
     * Decodes the vault key. Format is enforced by Config.validateVaultKeyFormat at config
     * load - before database connections and migrations. Config's constructor is private, so
     * every Config instance has already passed validation by the time it reaches Main.start.
     */
    private static byte[] vaultKeyBytes(String key) {
        return Text.b64decode(key);
    }
}
