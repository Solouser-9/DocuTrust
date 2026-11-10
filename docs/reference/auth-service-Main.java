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
