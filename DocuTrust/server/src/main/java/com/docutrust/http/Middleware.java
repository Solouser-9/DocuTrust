package com.docutrust.http;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.UUID;

import com.docutrust.AppException;
import com.docutrust.auth.JwtService;
import com.docutrust.auth.RateLimiter;
import com.docutrust.db.Database;
import com.docutrust.db.Rows;
import com.docutrust.model.Models;
import com.docutrust.util.Json;

// Request pipeline helpers: bearer authentication, role guards with audit, IP rate limiting.
public final class Middleware {
    private final Database db;
    private final JwtService jwt;
    private final RateLimiter limiter;

    public Middleware(Database db, JwtService jwt, RateLimiter limiter) {
        this.db = db;
        this.jwt = jwt;
        this.limiter = limiter;
    }

    public Handler authenticate(Handler next) {
        return ctx -> {
            String token = ctx.bearer();
            if (token == null) throw AppException.unauthorized("Missing bearer token");
            JwtService.Claims claims;
            try {
                claims = jwt.verify(token);
            } catch (JwtService.TokenExpiredException e) {
                throw new AppException(401, "TOKEN_EXPIRED", "Access token expired - refresh required");
            } catch (JwtService.TokenInvalidException e) {
                throw AppException.unauthorized("Invalid access token");
            }
            Models.User u = loadUser(UUID.fromString(claims.sub));
            if (u == null) throw AppException.unauthorized("Account no longer exists");
            if ("suspended".equals(u.status)) throw new AppException(403, "ACCOUNT_SUSPENDED", "Account suspended - contact support");
            ctx.user = u;
            next.handle(ctx);
        };
    }

    public Handler requireRole(String required, Handler next) {
        return requireAnyRole(next, required);
    }

    public Handler requireAnyRole(Handler next, String... required) {
        return ctx -> {
            if (ctx.user == null) throw AppException.unauthorized("Authentication required");
            boolean ok = false;
            for (String r : required) if (r.equals(ctx.user.role)) ok = true;
            if (!ok) {
                auditDenied(ctx, required);
                throw AppException.forbidden("Requires " + String.join(" or ", required) + " role");
            }
            next.handle(ctx);
        };
    }

    public Handler rateLimited(String scope, Handler next) {
        return ctx -> {
            if (!limiter.allow(scope + "|" + ctx.ip())) throw AppException.rateLimited();
            next.handle(ctx);
        };
    }

    private Models.User loadUser(UUID id) {
        return db.with(c -> {
            try (PreparedStatement ps = c.prepareStatement(
                    "SELECT id, org_id, email, full_name, phone, role, status, mfa_enabled, email_verified, last_login_at, created_at FROM users WHERE id = ?")) {
                ps.setObject(1, id);
                try (ResultSet rs = ps.executeQuery()) {
                    return rs.next() ? Rows.user(rs) : null;
                }
            }
        });
    }

    private void auditDenied(Ctx ctx, String[] required) {
        try {
            db.tx(c -> {
                try (PreparedStatement ps = c.prepareStatement(
                        "INSERT INTO audit_logs (action, entity_type, ip, user_agent, meta) VALUES ('admin_access_denied','endpoint',?, CAST(? AS jsonb))")) {
                    ps.setString(1, ctx.ip());
                    ps.setString(2, Json.write(Json.obj("path", ctx.path(), "method", ctx.method(),
                            "requiredRole", String.join(",", required), "role", ctx.user == null ? null : ctx.user.role)));
                    ps.executeUpdate();
                }
                return null;
            });
        } catch (Exception ignored) { }
    }
}
