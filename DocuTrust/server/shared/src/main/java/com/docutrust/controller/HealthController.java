package com.docutrust.controller;

import com.docutrust.config.Config;
import com.docutrust.db.Database;
import com.docutrust.http.Handler;
import com.docutrust.util.Json;

// Health + app metadata for the mobile client and SEO/indexing.
public final class HealthController {
    private static final long STARTED_AT = System.currentTimeMillis();
    private static final String DESCRIPTION = "DocuTrust is a secure document vault with expiring share links, "
            + "tamper-evident verification links, admin review for sensitive documents and full audit trails.";

    private final Database db;
    private final Config cfg;

    public HealthController(Database db, Config cfg) { this.db = db; this.cfg = cfg; }

    public Handler health() {
        return ctx -> ctx.ok(Json.obj("ok", true, "db", db.healthy(),
                "uptimeSeconds", (System.currentTimeMillis() - STARTED_AT) / 1000,
                "requestsTotal", com.docutrust.infra.Metrics.requestsTotal(),
                "meanResponseMs", com.docutrust.infra.Metrics.meanLatencyMs()));
    }

    public Handler meta() {
        return ctx -> ctx.ok(Json.obj(
                "name", "DocuTrust",
                "tagline", "Secure document vault & verification",
                "description", DESCRIPTION,
                "roles", Json.arr("admin", "org_manager", "member"),
                "screens", 45,
                "features", 216,
                "infra", Json.obj(
                        "pool", "HikariCP",
                        "rateLimiter", "Bucket4j",
                        "cache", "Caffeine",
                        "metrics", "Dropwizard Metrics",
                        "mail", mailInfo())));
    }

    private String mailInfo() {
        String mode = cfg.get("MAIL_MODE", "dev");
        return "live".equalsIgnoreCase(mode) ? "Brevo" : "Brevo (dev mode: X-Dev-OTP)";
    }
}
