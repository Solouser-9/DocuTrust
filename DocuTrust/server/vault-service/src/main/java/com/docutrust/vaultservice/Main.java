package com.docutrust.vaultservice;

import com.docutrust.util.Json;
import com.sun.net.httpserver.HttpServer;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;

// Phase 1 stub: proves the module builds against shared and binds its port.
// No database, no vault directory, no business routes - documents/folders/shares/verification
// routes move here in a later phase. ExpiryScheduler must then run on exactly one JVM.
public final class Main {
    private Main() {}

    public static void main(String[] args) throws Exception {
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8082"));
        byte[] body = Json.write(Json.obj(
                "ok", true, "service", "vault-service", "port", port, "phase", 1))
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
        System.out.println("[vault-service] stub listening on http://localhost:" + port + " - GET /health (Phase 1)");
    }
}
