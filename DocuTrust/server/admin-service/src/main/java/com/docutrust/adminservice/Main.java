package com.docutrust.adminservice;

import com.docutrust.util.Json;
import com.sun.net.httpserver.HttpServer;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;

// Phase 1 stub: proves the module builds against shared and binds its port.
// No database, no migrations, no business routes - admin/orgs/audit/settings/notification
// routes move here in a later phase.
public final class Main {
    private Main() {}

    public static void main(String[] args) throws Exception {
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8083"));
        byte[] body = Json.write(Json.obj(
                "ok", true, "service", "admin-service", "port", port, "phase", 1))
                .getBytes(StandardCharsets.UTF_8);
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
        System.out.println("[admin-service] stub listening on http://localhost:" + port + " - GET /health (Phase 1)");
    }
}
