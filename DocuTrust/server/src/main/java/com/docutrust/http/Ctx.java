package com.docutrust.http;

import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

import com.docutrust.AppException;
import com.docutrust.config.Config;
import com.docutrust.model.Models;
import com.docutrust.util.Json;
import com.sun.net.httpserver.HttpExchange;

// Per-request context wrapping HttpExchange: params, query, JSON/multipart parsing, typed responses with CORS.
public final class Ctx {
    public static final long MAX_BODY_BYTES = 26L * 1024 * 1024; // a little over the 25 MB file cap

    public static final class Part {
        public String name, filename, contentType;
        public byte[] data = new byte[0];

        public String asString() { return new String(data, StandardCharsets.UTF_8); }
    }

    public final HttpExchange ex;
    public final Config cfg;
    public final Map<String, String> params = new HashMap<>();
    public Models.User user;
    public int responseStatus;
    private Map<String, String> query;
    private byte[] body;
    private boolean responded;

    public Ctx(HttpExchange ex, Config cfg) { this.ex = ex; this.cfg = cfg; }

    public String method() { return ex.getRequestMethod(); }
    public String path() { return ex.getRequestURI().getPath(); }
    public String header(String name) { return ex.getRequestHeaders().getFirst(name); }

    public static Map<String, String> parseQuery(String raw) {
        Map<String, String> q = new LinkedHashMap<>();
        if (raw == null || raw.isEmpty()) return q;
        for (String kv : raw.split("&")) {
            if (kv.isEmpty()) continue;
            int eq = kv.indexOf('=');
            if (eq > 0) q.put(dec(kv.substring(0, eq)), dec(kv.substring(eq + 1)));
            else q.put(dec(kv), "");
        }
        return q;
    }

    private static String dec(String s) { return URLDecoder.decode(s, StandardCharsets.UTF_8); }

    public Map<String, String> query() {
        if (query == null) query = parseQuery(ex.getRequestURI().getRawQuery());
        return query;
    }

    public String q(String name) { return query().get(name); }

    public String q(String name, String dflt) {
        String v = query().get(name);
        return v == null || v.isEmpty() ? dflt : v;
    }

    public String param(String name) { return params.get(name); }

    public java.util.UUID uuidParam(String name) {
        try { return java.util.UUID.fromString(params.get(name)); }
        catch (Exception e) { throw AppException.notFound("Resource not found"); }
    }

    public byte[] body() throws IOException {
        if (body == null) {
            String cl = header("Content-Length");
            if (cl != null) {
                try { if (Long.parseLong(cl) > MAX_BODY_BYTES) throw AppException.tooLarge("Request body exceeds the 25 MB limit"); }
                catch (NumberFormatException ignored) { }
            }
            body = ex.getRequestBody().readAllBytes();
        }
        return body;
    }

    public Map<String, Object> json() throws IOException {
        byte[] b = body();
        if (b.length == 0) return new HashMap<>();
        try { return Json.parseObject(new String(b, StandardCharsets.UTF_8)); }
        catch (Exception e) { throw AppException.validation("body", "Invalid JSON body"); }
    }

    public Map<String, Part> multipart() throws IOException {
        String ct = header("Content-Type");
        if (ct == null || !ct.toLowerCase().startsWith("multipart/form-data"))
            throw AppException.validation("file", "Expected multipart/form-data");
        String boundary = null;
        for (String piece : ct.split(";")) {
            String t = piece.trim();
            if (t.toLowerCase().startsWith("boundary=")) boundary = t.substring(9);
        }
        if (boundary == null || boundary.isBlank()) throw AppException.validation("file", "Missing multipart boundary");
        byte[] delim = ("--" + boundary).getBytes(StandardCharsets.UTF_8);
        byte[] data = body();
        byte[] blank = "\r\n\r\n".getBytes(StandardCharsets.UTF_8);
        Map<String, Part> parts = new LinkedHashMap<>();
        int pos = indexOf(data, delim, 0);
        while (pos >= 0) {
            int afterDelim = pos + delim.length;
            if (afterDelim + 1 < data.length && data[afterDelim] == '-' && data[afterDelim + 1] == '-') break; // final boundary
            int headStart = afterDelim + 2;
            int headEnd = indexOf(data, blank, headStart);
            if (headEnd < 0) break;
            Part p = new Part();
            for (String line : new String(data, headStart, headEnd - headStart, StandardCharsets.UTF_8).split("\r\n")) {
                String lower = line.toLowerCase();
                if (lower.startsWith("content-disposition:")) {
                    for (String piece : line.split(";")) {
                        String t = piece.trim();
                        if (t.startsWith("name=")) p.name = unquote(t.substring(5));
                        else if (t.startsWith("filename=")) p.filename = unquote(t.substring(9));
                    }
                } else if (lower.startsWith("content-type:")) {
                    p.contentType = line.substring(13).trim();
                }
            }
            int contentStart = headEnd + 4;
            int next = indexOf(data, delim, contentStart);
            if (next < 0) break;
            p.data = next - 2 >= contentStart ? Arrays.copyOfRange(data, contentStart, next - 2) : new byte[0];
            if (p.name != null) parts.put(p.name, p);
            pos = next;
        }
        return parts;
    }

    private static String unquote(String s) {
        s = s.trim();
        if (s.length() >= 2 && s.startsWith("\"") && s.endsWith("\"")) return s.substring(1, s.length() - 1);
        return s;
    }

    private static int indexOf(byte[] hay, byte[] needle, int from) {
        outer:
        for (int i = Math.max(0, from); i <= hay.length - needle.length; i++) {
            for (int j = 0; j < needle.length; j++) if (hay[i + j] != needle[j]) continue outer;
            return i;
        }
        return -1;
    }

    // ---- typed field helpers ----
    public static String str(Map<String, Object> m, String key) {
        Object v = m.get(key);
        return v == null ? null : v instanceof String s ? s : String.valueOf(v);
    }

    public static Integer intVal(Map<String, Object> m, String key) {
        Object v = m.get(key);
        if (v == null) return null;
        if (v instanceof Number n) return n.intValue();
        try { return (int) Double.parseDouble(String.valueOf(v)); }
        catch (NumberFormatException e) { throw AppException.validation(key, key + " must be a number"); }
    }

    public static Double numVal(Map<String, Object> m, String key) {
        Object v = m.get(key);
        if (v == null) return null;
        if (v instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(String.valueOf(v)); }
        catch (NumberFormatException e) { throw AppException.validation(key, key + " must be a number"); }
    }

    public static Boolean boolVal(Map<String, Object> m, String key) {
        Object v = m.get(key);
        if (v == null) return null;
        if (v instanceof Boolean b) return b;
        return Boolean.parseBoolean(String.valueOf(v));
    }

    public int page() { return Math.max(1, intQ("page", 1)); }

    public int limit() { return Math.min(100, Math.max(1, intQ("limit", 20))); }

    public Integer intQ(String name, Integer dflt) {
        String v = q(name);
        if (v == null || v.isBlank()) return dflt;
        try { return Integer.parseInt(v); }
        catch (NumberFormatException e) { throw AppException.validation(name, name + " must be a number"); }
    }

    public String ip() {
        String xf = header("X-Forwarded-For");
        if (xf != null && !xf.isBlank()) return xf.split(",")[0].trim();
        try {
            return ex.getRemoteAddress().getAddress().getHostAddress();
        } catch (Exception e) {
            return "unknown";
        }
    }

    public String userAgent() {
        String ua = header("User-Agent");
        if (ua == null) return "";
        return ua.length() > 200 ? ua.substring(0, 200) : ua;
    }

    public String bearer() {
        String a = header("Authorization");
        if (a == null || !a.startsWith("Bearer ")) return null;
        return a.substring(7).trim();
    }

    // ---- response helpers ----
    public void ok(Object data) { respondMap(200, Json.obj("ok", true, "data", data)); }

    public void ok(Object data, Map<String, String> headers) {
        raw(200, "application/json; charset=utf-8",
                Json.write(Json.obj("ok", true, "data", data)).getBytes(java.nio.charset.StandardCharsets.UTF_8), headers);
    }

    public void created(Object data) { respondMap(201, Json.obj("ok", true, "data", data)); }

    public void created(Object data, Map<String, String> headers) {
        raw(201, "application/json; charset=utf-8",
                Json.write(Json.obj("ok", true, "data", data)).getBytes(java.nio.charset.StandardCharsets.UTF_8), headers);
    }

    public void okPage(Models.Page<? extends Models.Jsonable> page) { okPage(page, null); }

    public void okPage(Models.Page<? extends Models.Jsonable> page, Map<String, Object> extraMeta) {
        Map<String, Object> meta = page.toMeta();
        if (extraMeta != null) meta.putAll(extraMeta);
        respondMap(200, Json.obj("ok", true, "data", page.toItems(), "meta", meta));
    }

    public void noContent() { raw(204, null, null); }

    public void html(int status, String body) { raw(status, "text/html; charset=utf-8", body.getBytes(StandardCharsets.UTF_8)); }

    public void bytes(int status, String contentType, byte[] data, Map<String, String> headers) {
        raw(status, contentType, data, headers);
    }

    public void respondMap(int status, Map<String, Object> envelope) {
        raw(status, "application/json; charset=utf-8", Json.write(envelope).getBytes(StandardCharsets.UTF_8));
    }

    public void raw(int status, String contentType, byte[] data) { raw(status, contentType, data, null); }

    public void raw(int status, String contentType, byte[] data, Map<String, String> headers) {
        try {
            if (responded) return;
            responded = true;
            responseStatus = status;
            var h = ex.getResponseHeaders();
            h.set("Content-Type", contentType == null ? "application/json; charset=utf-8" : contentType);
            h.set("Access-Control-Allow-Origin", cfg == null ? "*" : cfg.corsOrigin);
            h.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
            h.set("Access-Control-Allow-Headers", "Authorization,Content-Type,X-Step-Up-Token");
            h.set("Access-Control-Expose-Headers", "X-Dev-OTP");
            h.set("Access-Control-Max-Age", "86400");
            if (headers != null) headers.forEach(h::set);
            if (status == 204 || data == null || data.length == 0) ex.sendResponseHeaders(status, status == 204 ? -1 : -1);
            else {
                ex.sendResponseHeaders(status, data.length);
                try (var os = ex.getResponseBody()) { os.write(data); }
            }
            ex.close();
        } catch (IOException ignored) { }
    }

    public boolean hasResponded() { return responded; }
}
