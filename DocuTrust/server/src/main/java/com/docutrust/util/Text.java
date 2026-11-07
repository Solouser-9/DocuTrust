package com.docutrust.util;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.UUID;

import com.docutrust.AppException;

// Byte/text helpers: Base64URL, SHA-256 hex, secure tokens, constant-time compare, ISO dates.
public final class Text {
    private static final SecureRandom RNG = new SecureRandom();

    private Text() {}

    public static String b64url(byte[] b) { return Base64.getUrlEncoder().withoutPadding().encodeToString(b); }

    public static byte[] b64urlDecode(String s) {
        int pad = (4 - s.length() % 4) % 4;
        return Base64.getUrlDecoder().decode(s + "=".repeat(pad));
    }

    public static String b64(byte[] b) { return Base64.getEncoder().encodeToString(b); }
    public static byte[] b64decode(String s) { return Base64.getDecoder().decode(s); }

    public static String hex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte x : bytes) sb.append(Character.forDigit((x >> 4) & 0xf, 16)).append(Character.forDigit(x & 0xf, 16));
        return sb.toString();
    }

    public static String sha256Hex(byte[] data) {
        try { return hex(MessageDigest.getInstance("SHA-256").digest(data)); }
        catch (Exception e) { throw new IllegalStateException(e); }
    }

    public static String token() { return randomUrl(32); }

    public static String randomUrl(int bytes) {
        byte[] b = new byte[bytes];
        RNG.nextBytes(b);
        return b64url(b);
    }

    public static boolean constEq(String a, String b) {
        if (a == null || b == null) return a == b;
        return MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }

    public static boolean constEq(byte[] a, byte[] b) { return MessageDigest.isEqual(a, b); }

    public static String uuid() { return UUID.randomUUID().toString(); }
    public static long now() { return System.currentTimeMillis() / 1000; }

    public static String iso(Instant t) { return t == null ? null : DateTimeFormatter.ISO_INSTANT.format(t); }
    public static String iso(Timestamp ts) { return ts == null ? null : iso(ts.toInstant()); }
    public static String iso(LocalDate d) { return d == null ? null : d.format(DateTimeFormatter.ISO_LOCAL_DATE); }

    public static LocalDate parseDate(String s, String field) {
        try { return LocalDate.parse(s.trim()); }
        catch (Exception e) { throw AppException.validation(field, "Invalid date, expected YYYY-MM-DD"); }
    }
}
