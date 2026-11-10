package com.docutrust.gateway;

import com.sun.net.httpserver.HttpServer;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;

// Phase 1 stub: binds 8080 and answers GET /health only. Zero dependencies - no shared
// library, no database. Reverse-proxy routing to core-service (9000), auth-service (8081),
// vault-service (8082) and admin-service (8083) arrives in a later phase, including the
// exact-path rule for /api/auth/accept-invite (RC-1: auth prefix, admin-service logic).
// Until proxying exists, run core-service with PORT=8080 for the mobile client and leave
// this stub stopped, or accept that 8080 serves only the health probe.
public final class Main {
    private Main() {}

    public static void main(String[] args) throws Exception {
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8080"));
        String json = "{\"ok\":true,\"service\":\"gateway\",\"port\":" + port + ",\"phase\":1}";
        byte[] body = json.getBytes(StandardCharsets.UTF_8);
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/health", ex -> {
            if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
                ex.sendResponseHeaders(405, -1);
                return;
            }
            ex.getResponseHeaders().set("Content-Type", "application/json");
            ex.sendResponseHeaders(200, body.length);
            try (var os = ex.getResponseBody()) {
                os.write(body);
            }
        });
        server.start();
        System.out.println("[gateway] stub listening on http://localhost:" + port + " - GET /health (Phase 1; no proxy yet)");
    }
}
