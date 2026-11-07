package com.docutrust.auth;

import com.docutrust.util.Text;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.security.SecureRandom;

// RFC 6238 TOTP (30s step, 6 digits, +/-1 window) with RFC 4648 Base32 secrets and otpauth URLs.
public final class MfaService {
    private static final char[] ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".toCharArray();
    private static final long STEP_SECONDS = 30;
    private static final SecureRandom RNG = new SecureRandom();

    public String newSecret() {
        byte[] b = new byte[20];
        RNG.nextBytes(b);
        return base32Encode(b);
    }

    public String otpauthUrl(String email, String secret) {
        return "otpauth://totp/DocuTrust:" + email + "?secret=" + secret + "&issuer=DocuTrust";
    }

    public boolean verify(String base32Secret, String code) {
        if (base32Secret == null || code == null || !code.matches("\\d{6}")) return false;
        byte[] key;
        try { key = base32Decode(base32Secret); } catch (Exception e) { return false; }
        long step = System.currentTimeMillis() / 1000 / STEP_SECONDS;
        for (long drift = -1; drift <= 1; drift++) {
            if (Text.constEq(codeFor(key, step + drift), code)) return true;
        }
        return false;
    }

    public static String codeFor(byte[] key, long step) {
        try {
            byte[] msg = new byte[8];
            long v = step;
            for (int i = 7; i >= 0; i--) { msg[i] = (byte) v; v >>>= 8; }
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(key, "HmacSHA1"));
            byte[] h = mac.doFinal(msg);
            int off = h[h.length - 1] & 0xf;
            int bin = ((h[off] & 0x7f) << 24) | ((h[off + 1] & 0xff) << 16) | ((h[off + 2] & 0xff) << 8) | (h[off + 3] & 0xff);
            return String.format("%06d", bin % 1_000_000);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    public static String base32Encode(byte[] data) {
        StringBuilder sb = new StringBuilder();
        int buffer = 0, bits = 0;
        for (byte b : data) {
            buffer = (buffer << 8) | (b & 0xff);
            bits += 8;
            while (bits >= 5) { sb.append(ALPHABET[(buffer >> (bits - 5)) & 31]); bits -= 5; }
        }
        if (bits > 0) sb.append(ALPHABET[(buffer << (5 - bits)) & 31]);
        return sb.toString();
    }

    public static byte[] base32Decode(String s) {
        int buffer = 0, bits = 0, idx = 0;
        byte[] out = new byte[s.length() * 5 / 8];
        for (char c : s.trim().replace("=", "").toCharArray()) {
            int v = c >= 'A' && c <= 'Z' ? c - 'A' : c >= '2' && c <= '7' ? c - '2' + 26 : -1;
            if (v < 0) throw new IllegalArgumentException("Invalid Base32 character: " + c);
            buffer = (buffer << 5) | v;
            bits += 5;
            if (bits >= 8) { out[idx++] = (byte) (buffer >> (bits - 8)); bits -= 8; }
        }
        return idx == out.length ? out : java.util.Arrays.copyOf(out, idx);
    }
}
