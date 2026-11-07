package com.docutrust.http;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.docutrust.AppException;
import com.docutrust.config.Config;
import com.docutrust.db.Database;
import com.docutrust.util.Json;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

// Hand-written router: ":param" patterns with static-over-param precedence, global error boundary + audit.
public final class Router implements HttpHandler {

    public record Match(Route route, Map<String, String> params) {}

    public static final class Route {
        public final String method, pattern;
        public final List<Seg> segs;
        public final Handler handler;
        public final int staticSegs;

        Route(String method, String pattern, Handler handler) {
            this.method = method;
            this.pattern = pattern;
            this.handler = handler;
            this.segs = new ArrayList<>();
            int statics = 0;
            for (String part : pattern.split("/")) {
                boolean isParam = part.startsWith(":") && part.length() > 1;
                segs.add(new Seg(isParam ? part.substring(1) : part, isParam));
                if (!isParam) statics++;
            }
            this.staticSegs = statics;
        }
    }

    private record Seg(String text, boolean param) {}

    private final Config cfg;
    private final Database db;
    private final Middleware mw;
    private final List<Route> routes = new ArrayList<>();

    public Router(Config cfg, Database db, Middleware mw) {
        this.cfg = cfg;
        this.db = db;
        this.mw = mw;
    }

    public void add(String method, String pattern, Handler h) { routes.add(new Route(method, pattern, h)); }

    public void publicRoute(String method, String pattern, Handler h) { add(method, pattern, h); }

    public void rateLimited(String method, String pattern, String scope, Handler h) {
        add(method, pattern, mw.rateLimited(scope, h));
    }

    public void auth(String method, String pattern, Handler h) { add(method, pattern, mw.authenticate(h)); }

    public void role(String method, String pattern, String requiredRole, Handler h) {
        add(method, pattern, mw.authenticate(mw.requireRole(requiredRole, h)));
    }

    public void anyRole(String method, String pattern, Handler h, String... requiredRoles) {
        add(method, pattern, mw.authenticate(mw.requireAnyRole(h, requiredRoles)));
    }

    public Match match(String method, String path) {
        Match best = null;
        for (Route r : routes) {
            if (!r.method.equals(method)) continue;
            Map<String, String> params = new HashMap<>();
            if (matches(r, path, params) && (best == null || r.staticSegs > best.route().staticSegs))
                best = new Match(r, params);
        }
        return best;
    }

    public int routeCount() { return routes.size(); }

    private static boolean matches(Route r, String path, Map<String, String> params) {
        String[] parts = path.split("/");
        if (parts.length != r.segs.size()) return false;
        for (int i = 0; i < parts.length; i++) {
            Seg s = r.segs.get(i);
            if (s.param()) params.put(s.text(), parts[i]);
            else if (!s.text().equals(parts[i])) return false;
        }
        return true;
    }

    @Override
    public void handle(HttpExchange ex) {
        Ctx ctx = new Ctx(ex, cfg);
        long start = System.currentTimeMillis();
        try {
            if ("OPTIONS".equalsIgnoreCase(ctx.method())) {
                ctx.raw(204, null, null);
                return;
            }
            Match m = match(ctx.method(), ctx.path());
            if (m == null) throw AppException.notFound("No route for " + ctx.method() + " " + ctx.path());
            ctx.params.putAll(m.params());
            // INFRA-2: per-route latency timer + request meter (pattern-level, not per-URL, so cardinality stays bounded)
            try (var ignored = com.docutrust.infra.Metrics.route(m.route().method, m.route().pattern)) {
                m.route().handler.handle(ctx);
            }
            if (!ctx.hasResponded()) throw AppException.internal("Handler produced no response");
        } catch (AppException e) {
            sendError(ctx, e.status, e.code, e.getMessage(), e.field);
        } catch (Exception e) {
            logUnexpected(ctx, e);
            sendError(ctx, 500, "INTERNAL_ERROR", "Unexpected server error", null);
        } finally {
            System.out.printf("[http] %s %s -> %d (%d ms)%n", ctx.method(), ctx.path(), ctx.responseStatus, System.currentTimeMillis() - start);
        }
    }

    private void sendError(Ctx ctx, int status, String code, String message, String field) {
        Map<String, Object> err = Json.obj("code", code, "message", message == null ? code : message);
        if (field != null) err.put("field", field);
        ctx.respondMap(status, Json.obj("ok", false, "error", err));
    }

    private void logUnexpected(Ctx ctx, Exception e) {
        System.err.println("[http] INTERNAL_ERROR " + ctx.method() + " " + ctx.path() + ": " + e);
        if (db == null) return;
        try {
            db.tx(c -> {
                try (var ps = c.prepareStatement(
                        "INSERT INTO audit_logs (action, entity_type, ip, user_agent, meta) VALUES ('http.internal_error','request',?, CAST(? AS jsonb))")) {
                    ps.setString(1, ctx.ip());
                    ps.setString(2, Json.write(Json.obj("path", ctx.path(), "method", ctx.method(), "error", String.valueOf(e.getMessage()))));
                    ps.executeUpdate();
                }
                return null;
            });
        } catch (Exception ignored) { }
    }
}
