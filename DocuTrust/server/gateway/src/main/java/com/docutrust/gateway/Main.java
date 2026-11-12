package com.docutrust.gateway;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.function.BiConsumer;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

// Phase 3 composition root: the gateway is a pure reverse proxy in front of the extracted
// services - no business logic, no database, no dependencies beyond the JDK. Routing rules:
//   1. POST exactly /api/auth/accept-invite -> core-service (RC-1: admin-domain logic that
//      happens to live under the /api/auth/ prefix; core keeps serving it),
//   2. any other path starting with /api/auth/ -> auth-service,
//   3. everything else -> core-service.
// Methods, raw paths + query strings, bodies (read as bytes so document uploads survive) and
// headers are forwarded unchanged; responses are returned with their exact status/headers/body.
// If the upstream is unreachable, the gateway answers 502 BAD_GATEWAY itself.
// Run from server/:  mvn -pl gateway exec:java   (PORT env var, default 8080)
public final class Main {
    private static final String CORE_URL = base(envOrDefault("CORE_URL", "http://localhost:9000"));
    private static final String AUTH_URL = base(envOrDefault("AUTH_URL", "http://localhost:8081"));

    // Protect Render's 512MB free-tier RAM from OOM crashes. 25MB matches the mobile app's
    // MAX_FILE_BYTES. Anything larger is rejected before the body is buffered.
    private static final long MAX_UPLOAD_SIZE = 25L * 1024 * 1024;

    // One shared client: connection pooling per upstream, HTTP/1.1 because the backends are
    // com.sun.net.httpserver servers, short connect timeout so a down service fails fast to 502.
    private static final HttpClient HTTP = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    private Main() {}

    public static void main(String[] args) throws Exception {
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8080"));
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/", Main::proxy);
        server.setExecutor(Executors.newFixedThreadPool(64));
        server.start();
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            System.out.println("[gateway] shutting down...");
            server.stop(0);
        }));
        System.out.println("[gateway] ready on port " + port + " (core=" + CORE_URL + ", auth=" + AUTH_URL + ")");
        Thread.currentThread().join();
    }

    // RC-1 must be tested before the /api/auth/ prefix rule: accept-invite carries the auth
    // prefix but is core-service logic. Matching uses the raw path only - query strings never
    // influence routing.
    private static String targetFor(String method, String rawPath) {
        if ("POST".equalsIgnoreCase(method) && "/api/auth/accept-invite".equals(rawPath)) return CORE_URL;
        if (rawPath.startsWith("/api/auth/")) return AUTH_URL;
        return CORE_URL;
    }

    private static void proxy(HttpExchange ex) {
        long t0 = System.currentTimeMillis();
        String method = ex.getRequestMethod();
        URI requested = ex.getRequestURI();
        String rawPath = requested.getRawPath();
        String rawQuery = requested.getRawQuery();
        String target = targetFor(method, rawPath);
        boolean responded = false;
        try {
            // ---- Pre-check 1: Fast-fail on oversized Content-Length ----
            String cl = ex.getRequestHeaders().getFirst("Content-Length");
            if (cl != null) {
                try {
                    long contentLength = Long.parseLong(cl.trim());
                    if (contentLength > MAX_UPLOAD_SIZE) {
                        responded = true;
                        sendPayloadTooLargeError(ex);
                        System.out.printf("[gateway] %s %s -> 413 (payload %d > max %d)%n", method, rawPath, contentLength, MAX_UPLOAD_SIZE);
                        return;
                    }
                } catch (NumberFormatException ignored) {
                    // Malformed Content-Length - let the backend decide.
                }
            }

            // ---- Pre-check 2: Bounded read for chunked transfers without Content-Length ----
            byte[] body = readBounded(ex.getRequestBody());
            if (body == null) {
                responded = true;
                sendPayloadTooLargeError(ex);
                System.out.printf("[gateway] %s %s -> 413 (chunked payload > max %d)%n", method, rawPath, MAX_UPLOAD_SIZE);
                return;
            }

            URI upstream = URI.create(target + rawPath + (rawQuery == null ? "" : "?" + rawQuery));
            HttpRequest.Builder out = HttpRequest.newBuilder(upstream)
                    .timeout(Duration.ofSeconds(60))
                    .method(method, body.length == 0
                            ? HttpRequest.BodyPublishers.noBody()
                            : HttpRequest.BodyPublishers.ofByteArray(body));
            copyHeaders(ex.getRequestHeaders(), out::header);
            // Backend audit logs read X-Forwarded-For (Ctx.ip()); strip any client-supplied chain
            // from the verbatim copy above and recompute it from the peer we actually saw, so
            // audit trails keep the real client IP instead of the gateway's loopback address.
            out.header("X-Forwarded-For", forwardedFor(ex.getRequestHeaders().getFirst("X-Forwarded-For"), clientIp(ex)));

            HttpResponse<byte[]> resp = HTTP.send(out.build(), HttpResponse.BodyHandlers.ofByteArray());

            copyHeaders(resp.headers().map(), ex.getResponseHeaders()::add);
            byte[] respBody = resp.body();
            if (resp.statusCode() == 204 || resp.statusCode() == 304) {
                ex.sendResponseHeaders(resp.statusCode(), -1);
                responded = true;
            } else {
                ex.sendResponseHeaders(resp.statusCode(), respBody.length == 0 ? -1 : respBody.length);
                responded = true;
                if (respBody.length > 0) {
                    try (var os = ex.getResponseBody()) {
                        os.write(respBody);
                    }
                }
            }
            System.out.printf("[gateway] %s %s -> %d (%d ms) -> %s%n", method, rawPath, resp.statusCode(),
                    System.currentTimeMillis() - t0, target);
        } catch (Exception e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            System.err.printf("[gateway] %s %s -> upstream %s failed: %s%n", method, rawPath, target, e);
            if (!responded) {
                try {
                    String message = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
                    message = message.replaceAll("[\\p{Cntrl}\"]", " ");
                    if (message.length() > 200) message = message.substring(0, 200);
                    byte[] err = ("{\"ok\":false,\"error\":{\"code\":\"BAD_GATEWAY\",\"message\":\"upstream unavailable: "
                            + message + "\"}}").getBytes(StandardCharsets.UTF_8);
                    ex.getResponseHeaders().set("Content-Type", "application/json");
                    ex.sendResponseHeaders(502, err.length);
                    try (var os = ex.getResponseBody()) {
                        os.write(err);
                    }
                } catch (Exception ignored) {
                    // client went away mid-flight - nothing left to answer
                }
            }
        } finally {
            ex.close();
        }
    }

    // ---- Helper: Bounded stream reader ----
    // Reads at most MAX_UPLOAD_SIZE bytes. Returns null if the stream exceeds the limit.
    private static byte[] readBounded(InputStream in) throws IOException {
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        byte[] chunk = new byte[8192];
        int n;
        long total = 0;
        while ((n = in.read(chunk)) != -1) {
            total += n;
            if (total > MAX_UPLOAD_SIZE) {
                return null;
            }
            buf.write(chunk, 0, n);
        }
        return buf.toByteArray();
    }

    // ---- Helper: Clean 413 error response ----
    private static void sendPayloadTooLargeError(HttpExchange ex) throws IOException {
        String msg = "{\"ok\":false,\"error\":{\"code\":\"PAYLOAD_TOO_LARGE\",\"message\":\"Request body exceeds the 25MB maximum size.\"}}";
        byte[] err = msg.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type", "application/json");
        ex.sendResponseHeaders(413, err.length);
        try (var os = ex.getResponseBody()) {
            os.write(err);
        }
    }

    // Hop-by-hop and connection-scoped headers never cross a proxy hop; Host and Content-Length
    // are recomputed by HttpClient for the rebuilt upstream request; Date and Server are stamped
    // by the receiving HttpServer. Everything else (Authorization, Content-Type, X-Step-Up-Token,
    // X-Dev-OTP, Access-Control-*, Set-Cookie, ...) is forwarded, multi-value safe.
    private static void copyHeaders(Map<String, List<String>> from, BiConsumer<String, String> add) {
        for (Map.Entry<String, List<String>> e : from.entrySet()) {
            String name = e.getKey();
            if (name == null || neverForwarded(name)) continue;
            for (String value : e.getValue()) {
                if (value != null) add.accept(name, value);
            }
        }
    }

    private static boolean neverForwarded(String name) {
        return switch (name.toLowerCase()) {
            case "connection", "keep-alive", "proxy-authenticate",
                 "proxy-authorization", "te", "trailer",
                 "transfer-encoding", "upgrade", "host",
                 "content-length", "expect", "date", "server",
                 "x-forwarded-for" -> true; // recomputed from the live peer + client chain
            default -> false;
        };
    }

    private static String forwardedFor(String existingChain, String peer) {
        return existingChain == null || existingChain.isBlank() ? peer : existingChain + ", " + peer;
    }

    private static String clientIp(HttpExchange ex) {
        try {
            return ex.getRemoteAddress().getAddress().getHostAddress();
        } catch (Exception e) {
            return "unknown";
        }
    }

    private static String envOrDefault(String name, String fallback) {
        String v = System.getenv(name);
        return v == null || v.isBlank() ? fallback : v;
    }

    private static String base(String url) {
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}