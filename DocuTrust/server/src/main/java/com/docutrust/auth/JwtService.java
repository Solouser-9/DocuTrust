package com.docutrust.auth;

import com.docutrust.util.Json;
import com.docutrust.util.Text;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Map;

// Hand-rolled HMAC-SHA256 JWT: issue/verify with typed expired-vs-invalid errors, constant-time signature compare.
public final class JwtService {
    public static class TokenExpiredException extends RuntimeException {
        public TokenExpiredException(String m) { super(m); }
    }

    public static class TokenInvalidException extends RuntimeException {
        public TokenInvalidException(String m) { super(m); }
    }

    public static final class Claims {
        public String sub, role, orgId, jti, typ;
        public long iat, exp;
    }

    public static final long ACCESS_TTL_SECONDS = 900;

    private final byte[] secret;

    public JwtService(String secret) { this.secret = secret.getBytes(StandardCharsets.UTF_8); }

    public String issue(String sub, String role, String orgId) {
        return issue(sub, role, orgId, ACCESS_TTL_SECONDS, null);
    }

    public String issue(String sub, String role, String orgId, long ttlSeconds, String typ) {
        long now = Text.now();
        Map<String, Object> payload = Json.obj("sub", sub, "role", role, "orgId", orgId, "iat", now,
                "exp", now + ttlSeconds, "jti", Text.uuid());
        if (typ != null) payload.put("typ", typ);
        String head = Text.b64url(Json.write(Json.obj("alg", "HS256", "typ", "JWT")).getBytes(StandardCharsets.UTF_8));
        String body = Text.b64url(Json.write(payload).getBytes(StandardCharsets.UTF_8));
        return head + "." + body + "." + sign(head + "." + body);
    }

    public Claims verify(String token) {
        if (token == null || token.isBlank()) throw new TokenInvalidException("Missing token");
        String[] parts = token.split("\\.");
        if (parts.length != 3) throw new TokenInvalidException("Malformed token");
        String expected = sign(parts[0] + "." + parts[1]);
        if (!Text.constEq(parts[2], expected)) throw new TokenInvalidException("Signature mismatch");
        Map<String, Object> payload;
        try {
            payload = Json.parseObject(new String(Text.b64urlDecode(parts[1]), StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new TokenInvalidException("Unreadable payload");
        }
        long exp = payload.get("exp") instanceof Number n ? n.longValue() : 0;
        if (Text.now() >= exp) throw new TokenExpiredException("Token expired");
        Claims c = new Claims();
        c.sub = (String) payload.get("sub");
        c.role = (String) payload.get("role");
        c.orgId = (String) payload.get("orgId");
        c.typ = (String) payload.get("typ");
        c.jti = (String) payload.get("jti");
        c.iat = payload.get("iat") instanceof Number n ? n.longValue() : 0;
        c.exp = exp;
        if (c.sub == null) throw new TokenInvalidException("Missing subject");
        return c;
    }

    private String sign(String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            return Text.b64url(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
