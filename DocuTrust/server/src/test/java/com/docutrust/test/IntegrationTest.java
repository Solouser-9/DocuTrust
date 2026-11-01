package com.docutrust.test;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.docutrust.Main;
import com.docutrust.config.Config;
import com.docutrust.util.Json;

/**
 * End-to-end integration test: boots the real server on port 18080 against a throwaway schema
 * and walks the main API flow. Skips cleanly when DB_URL is not configured.
 */
public final class IntegrationTest {
    private static int passed = 0;
    private static final List<String> failures = new ArrayList<>();
    private static final HttpClient HTTP = HttpClient.newHttpClient();
    private static String base;
    private static Main.App app;
    private static String schema;

    public static void main(String[] args) throws Exception {
        String dbUrl = System.getenv("DB_URL");
        if (dbUrl == null || dbUrl.isBlank()) {
            System.out.println("SKIP: DB_URL not set");
            System.exit(0);
        }
        base = "http://localhost:18080";
        schema = "docutrust_it_" + Long.toHexString(System.currentTimeMillis());
        setProp("PORT", "18080");
        setProp("DB_URL", dbUrl);
        setEnvLike("DB_USER", "DB_USER");
        setEnvLike("DB_PASSWORD", "DB_PASSWORD");
        setProp("DB_SCHEMA", schema);
        setProp("JWT_SECRET", "integration-test-secret-0123456789abcdef");
        setProp("VAULT_KEY", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");
        setProp("VAULT_DIR", "./target/it-vault");
        setProp("MIGRATIONS_DIR", "../database/migrations");
        setProp("SEED_DEMO", "true");

        try {
            app = Main.start(Config.load());
            flow();
        } catch (Throwable t) {
            failures.add("boot/flow: " + t);
            t.printStackTrace();
        } finally {
            if (app != null) app.stop();
            dropSchema();
        }
        System.out.println();
        System.out.println("Integration summary: " + passed + " passed, " + failures.size() + " failed");
        for (String f : failures) System.out.println("  FAIL " + f);
        System.exit(failures.isEmpty() ? 0 : 1);
    }

    private static void flow() throws Exception {
        // health + meta
        Map<String, Object> health = body(GET("/api/health"), 200);
        A.eq(true, health.get("ok"));
        A.eq(true, health.get("db"));
        A.notNull(body(GET("/api/meta"), 200).get("name"));
        A.eq(204, status(OPTIONS("/api/documents")));
        check("health+meta+preflight");

        // register -> verify email -> login -> me
        String email = "it-" + UUID.randomUUID() + "@docutrust.test";
        Map<String, Object> reg = body(POST("/api/auth/register",
                Json.obj("email", email, "password", "Passw0rd!x", "fullName", "IT Tester")), 201);
        @SuppressWarnings("unchecked")
        Map<String, Object> regUser = (Map<String, Object>) reg.get("user");
        A.eq("pending", regUser.get("status"));
        String verifyToken = (String) reg.get("verifyToken");
        Map<String, Object> verified = body(GET("/api/auth/verify-email?token=" + verifyToken), 200);
        A.eq(true, verified.get("verified"));
        Map<String, Object> login = body(POST("/api/auth/login",
                Json.obj("email", email, "password", "Passw0rd!x")), 200);
        String token = (String) login.get("accessToken");
        @SuppressWarnings("unchecked")
        Map<String, Object> me = (Map<String, Object>) body(GET("/api/auth/me", token), 200).get("user");
        A.eq(email, me.get("email"));
        A.eq("active", me.get("status"));
        check("register->verify->login->me");

        // bad login + duplicate register
        A.eq(401, status(POST("/api/auth/login", Json.obj("email", email, "password", "WrongPass1"))));
        A.eq(409, status(POST("/api/auth/register", Json.obj("email", email, "password", "Passw0rd!x", "fullName", "Dup"))));
        check("auth failure paths");

        // upload multipart document
        byte[] pdf = demoPdf();
        String boundary = "----docutrustit" + UUID.randomUUID();
        String docId = upload(token, boundary, pdf, "Integration Test Doc", "contract", "201");
        check("upload multipart");

        // list + search
        Map<String, Object> listed = body(GET("/api/documents?search=Integration", token), 200);
        @SuppressWarnings("unchecked")
        Map<String, Object> meta = (Map<String, Object>) listed.get("meta");
        A.isTrue(((Number) meta.get("total")).longValue() >= 1);
        check("list/search");

        // create share -> public metadata -> open -> revoke -> open blocked
        Map<String, Object> share = body(POST("/api/shares", token,
                Json.obj("documentId", docId, "permission", "view", "expiresInHours", 1)), 201);
        String shareToken = (String) share.get("linkToken");
        String shareId = (String) share.get("id");
        Map<String, Object> pub = body(GET("/api/public/shares/" + shareToken), 200);
        A.eq("Integration Test Doc", pub.get("title"));
        Map<String, Object> opened = body(POST("/api/public/shares/" + shareToken + "/open", Json.obj()), 200);
        A.eq(1L, ((Number) opened.get("viewCount")).longValue());
        A.eq(200, status(POST("/api/shares/" + shareId + "/revoke", token, Json.obj())));
        Map<String, Object> err = error(POST("/api/public/shares/" + shareToken + "/open", Json.obj()), 409);
        A.eq("SHARE_REVOKED", ((Map<String, Object>) err.get("error")).get("code"));
        check("share lifecycle");

        // verification request -> approve -> public verify
        Map<String, Object> req = body(POST("/api/verification-requests", token,
                Json.obj("documentId", docId, "verifierName", "IT Verifier", "purpose", "E2E", "expiresInDays", 1)), 201);
        String vToken = (String) req.get("token");
        String vId = (String) req.get("id");
        A.eq(200, status(POST("/api/verification-requests/" + vId + "/approve", token, Json.obj())));
        Map<String, Object> vres = body(GET("/api/public/verify/" + vToken), 200);
        A.eq("valid", vres.get("status"));
        A.notNull(((Map<String, Object>) vres.get("proof")).get("sha256"));
        String html = raw(GET("/api/public/verify/" + vToken, null, Map.of("Accept", "text/html")), 200);
        A.contains("<!DOCTYPE html>", html);
        A.contains("og:title", html);
        check("verification flow");

        // admin decision on a sensitive upload by the regular user (seeded admin reviews it)
        String adminToken = (String) body(POST("/api/auth/login",
                Json.obj("email", "admin@docutrust.app", "password", "Admin#2024")), 200).get("accessToken");
        String medicalId = upload(token, boundary, pdf, "IT Medical Doc", "medical", "201");
        Map<String, Object> queue = body(GET("/api/admin/review-queue?status=pending", adminToken), 200);
        String reviewId = null;
        for (Object o : (List<?>) queue.get("data")) {
            @SuppressWarnings("unchecked")
            Map<String, Object> r = (Map<String, Object>) o;
            if (medicalId.equals(r.get("targetId"))) reviewId = (String) r.get("id");
        }
        A.notNull(reviewId);
        A.eq(403, status(GET("/api/admin/users", token))); // member denied + audited
        Map<String, Object> decided = body(POST("/api/admin/reviews/" + reviewId + "/decision", adminToken,
                Json.obj("status", "approved", "note", "looks good")), 200);
        A.eq("approved", decided.get("status"));
        Map<String, Object> medical = body(GET("/api/documents/" + medicalId, token), 200);
        A.eq("active", medical.get("status"));
        check("admin decision flow");

        // notifications for the uploader (admin decision)
        Map<String, Object> inbox = body(GET("/api/notifications", token), 200);
        A.isTrue(((Number) ((Map<String, Object>) inbox.get("meta")).get("unreadCount")).longValue() >= 1);
        boolean foundDecision = false;
        for (Object o : (List<?>) inbox.get("data")) {
            @SuppressWarnings("unchecked")
            Map<String, Object> n = (Map<String, Object>) o;
            if ("admin_decision".equals(n.get("type"))) foundDecision = true;
        }
        A.isTrue(foundDecision);
        check("notifications");
    }

    // ---- helpers ----
    private static String upload(String token, String boundary, byte[] pdf, String title, String docType, String expect) throws Exception {
        String head = "--" + boundary + "\r\n"
                + "Content-Disposition: form-data; name=\"file\"; filename=\"test.pdf\"\r\n"
                + "Content-Type: application/pdf\r\n\r\n";
        String tail = "\r\n--" + boundary + "\r\n"
                + "Content-Disposition: form-data; name=\"title\"\r\n\r\n" + title + "\r\n"
                + "--" + boundary + "\r\n"
                + "Content-Disposition: form-data; name=\"docType\"\r\n\r\n" + docType + "\r\n"
                + "--" + boundary + "--\r\n";
        byte[] body = concat(head.getBytes(StandardCharsets.UTF_8), pdf, tail.getBytes(StandardCharsets.UTF_8));
        HttpRequest req = HttpRequest.newBuilder(URI.create(base + "/api/documents"))
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body)).build();
        HttpResponse<String> resp = HTTP.send(req, HttpResponse.BodyHandlers.ofString());
        if (!String.valueOf(resp.statusCode()).equals(expect)) throw new AssertionError("upload expected " + expect + " got " + resp.statusCode() + ": " + resp.body());
        Map<String, Object> parsed = Json.parseObject(resp.body());
        Object data = parsed.get("data");
        return data instanceof Map<?, ?> d && d.get("id") != null ? d.get("id").toString() : null;
    }

    private static byte[] concat(byte[] a, byte[] b, byte[] c) {
        byte[] out = new byte[a.length + b.length + c.length];
        System.arraycopy(a, 0, out, 0, a.length);
        System.arraycopy(b, 0, out, a.length, b.length);
        System.arraycopy(c, 0, out, a.length + b.length, c.length);
        return out;
    }

    private static byte[] demoPdf() {
        String content = "BT /F1 24 Tf 72 700 Td (Integration Test Document) Tj ET\n";
        return ("--- skip real pdf; any bytes are accepted because the mime type is declared ---\n" + content)
                .getBytes(StandardCharsets.UTF_8);
    }

    private static HttpRequest GET(String path) { return GET(path, null, Map.of()); }

    private static HttpRequest GET(String path, String token) { return GET(path, token, Map.of()); }

    private static HttpRequest GET(String path, String token, Map<String, String> headers) {
        HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(base + path)).GET();
        if (token != null) b.header("Authorization", "Bearer " + token);
        headers.forEach(b::header);
        return b.build();
    }

    private static HttpRequest POST(String path, Map<String, Object> body) { return POST(path, null, body); }

    private static HttpRequest POST(String path, String token, Map<String, Object> body) {
        HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(base + path))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(Json.write(body)));
        if (token != null) b.header("Authorization", "Bearer " + token);
        return b.build();
    }

    private static HttpRequest OPTIONS(String path) {
        return HttpRequest.newBuilder(URI.create(base + path)).method("OPTIONS", HttpRequest.BodyPublishers.noBody()).build();
    }

    private static HttpResponse<String> send(HttpRequest req) throws Exception { return HTTP.send(req, HttpResponse.BodyHandlers.ofString()); }

    private static int status(HttpRequest req) throws Exception { return send(req).statusCode(); }

    private static Map<String, Object> body(HttpRequest req, int expect) throws Exception {
        HttpResponse<String> resp = send(req);
        if (resp.statusCode() != expect) throw new AssertionError("expected " + expect + " got " + resp.statusCode() + ": " + resp.body());
        return Json.parseObject(resp.body());
    }

    private static String raw(HttpRequest req, int expect) throws Exception {
        HttpResponse<String> resp = send(req);
        if (resp.statusCode() != expect) throw new AssertionError("expected " + expect + " got " + resp.statusCode());
        return resp.body();
    }

    private static Map<String, Object> error(HttpRequest req, int expect) throws Exception {
        HttpResponse<String> resp = send(req);
        if (resp.statusCode() != expect) throw new AssertionError("expected " + expect + " got " + resp.statusCode() + ": " + resp.body());
        return Json.parseObject(resp.body());
    }

    private static void check(String label) {
        passed++;
        System.out.println("  ok   " + label);
    }

    private static void setProp(String key, String val) { System.setProperty(key, val); }

    private static void setEnvLike(String propKey, String envKey) {
        String v = System.getenv(envKey);
        if (v != null && !v.isBlank()) System.setProperty(propKey, v);
    }

    private static void dropSchema() {
        if (schema == null) return;
        try {
            String user = System.getProperty("DB_USER", "");
            String pass = System.getProperty("DB_PASSWORD", "");
            var c = user.isBlank()
                    ? java.sql.DriverManager.getConnection(System.getProperty("DB_URL"))
                    : java.sql.DriverManager.getConnection(System.getProperty("DB_URL"), user, pass);
            try (c; var st = c.createStatement()) {
                st.execute("DROP SCHEMA IF EXISTS " + schema + " CASCADE");
            }
        } catch (Exception ignored) { }
    }
}
