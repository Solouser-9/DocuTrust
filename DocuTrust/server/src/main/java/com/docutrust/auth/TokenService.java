package com.docutrust.auth;

import com.docutrust.AppException;
import com.docutrust.db.Database;
import com.docutrust.util.Json;
import com.docutrust.util.Text;

import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.util.UUID;

// Rotating refresh tokens: 43-char opaque tokens, SHA-256 hashes at rest, family revocation on reuse.
public final class TokenService {
    public static final class Tokens {
        public final String accessToken, refreshToken;
        public Tokens(String a, String r) { accessToken = a; refreshToken = r; }
    }

    private final Database db;
    private final JwtService jwt;

    public TokenService(Database db, JwtService jwt) { this.db = db; this.jwt = jwt; }

    public static String newToken() { return Text.token(); }

    public static String hash(String token) { return Text.sha256Hex(token.getBytes(StandardCharsets.UTF_8)); }

    public static boolean validFormat(String t) {
        return t != null && t.length() == 43 && t.matches("[A-Za-z0-9_\\-]{43}");
    }

    public Tokens issue(UUID userId, String role, String orgId, String device, String ip) {
        return db.tx(c -> issue(c, userId, role, orgId, device, ip));
    }

    public Tokens issue(Connection c, UUID userId, String role, String orgId, String device, String ip) throws Exception {
        String refresh = newToken();
        try (PreparedStatement ps = c.prepareStatement(
                "INSERT INTO refresh_tokens (user_id, token_hash, device, ip, expires_at) VALUES (?,?,?,?, now() + interval '7 days')")) {
            ps.setObject(1, userId);
            ps.setString(2, hash(refresh));
            ps.setString(3, device);
            ps.setString(4, ip);
            ps.executeUpdate();
        }
        return new Tokens(jwt.issue(userId.toString(), role, orgId), refresh);
    }

    /** Rotation outcome; tokens == null signals reuse of an already-revoked token (B-1). */
    private record Rotation(UUID userId, Tokens tokens) {}

    public Tokens rotate(String presented, String device, String ip) {
        if (!validFormat(presented)) throw AppException.unauthorized("Invalid refresh token");
        Rotation r = db.tx(c -> {
            String role = null, orgId = null;
            UUID userId = null;
            Timestamp expiresAt = null;
            boolean revoked = false;
            try (PreparedStatement ps = c.prepareStatement(
                    // B-3: FOR UPDATE locks the token row, so a concurrent rotate/revoke of the same
                    // token serializes here instead of both reading revoked_at IS NULL and double-issuing.
                    "SELECT rt.user_id, rt.expires_at, rt.revoked_at, u.role, u.org_id FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id WHERE rt.token_hash = ? FOR UPDATE OF rt")) {
                ps.setString(1, hash(presented));
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) {
                        userId = UUID.fromString(rs.getString("user_id"));
                        expiresAt = rs.getTimestamp("expires_at");
                        revoked = rs.getTimestamp("revoked_at") != null;
                        role = rs.getString("role");
                        orgId = rs.getString("org_id");
                    }
                }
            }
            if (userId == null) throw AppException.unauthorized("Invalid refresh token");
            if (revoked) return new Rotation(userId, null); // B-1: handled AFTER this tx commits (below)
            if (expiresAt.before(new Timestamp(System.currentTimeMillis())))
                throw AppException.unauthorized("Refresh token expired");
            String fresh = newToken();
            UUID newId = UUID.randomUUID();
            try (PreparedStatement ps = c.prepareStatement(
                    "INSERT INTO refresh_tokens (id, user_id, token_hash, device, ip, expires_at) VALUES (?,?,?,?,?, now() + interval '7 days')")) {
                ps.setObject(1, newId);
                ps.setObject(2, userId);
                ps.setString(3, hash(fresh));
                ps.setString(4, device);
                ps.setString(5, ip);
                ps.executeUpdate();
            }
            try (PreparedStatement ps = c.prepareStatement("UPDATE refresh_tokens SET revoked_at = now(), replaced_by = ? WHERE token_hash = ? AND revoked_at IS NULL")) { // B-3: never re-revoke
                ps.setObject(1, newId);
                ps.setString(2, hash(presented));
                ps.executeUpdate();
            }
            return new Rotation(userId, new Tokens(jwt.issue(userId.toString(), role, orgId), fresh));
        });
        if (r.tokens() == null) {
            // B-1: the family revocation must COMMIT before the 409 unwinds. The old code revoked inside
            // the detection transaction - throwing the 409 rolled that revocation straight back, so reuse
            // detection had no durable effect (fail-open). C-1: this tx starts only after the detection
            // tx has fully finished, so no nested pool connections are held.
            revokeAllForUser(r.userId());
            // B-2: audit AFTER the revocation commit - best-effort, so an audit outage can never undo it.
            auditReuse(r.userId(), ip);
            throw new AppException(409, "TOKEN_REUSE", "Refresh token reuse detected - all sessions revoked, please log in again");
        }
        return r.tokens();
    }

    public void revoke(String presented) {
        if (!validFormat(presented)) return;
        db.tx(c -> {
            try (PreparedStatement ps = c.prepareStatement("UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = ? AND revoked_at IS NULL")) {
                ps.setString(1, hash(presented));
                ps.executeUpdate();
            }
            return null;
        });
    }

    public void revokeAllForUser(UUID userId) {
        db.tx(c -> { revokeAllForUser(c, userId); return null; });
    }

    public void revokeAllForUser(Connection c, UUID userId) throws Exception {
        try (PreparedStatement ps = c.prepareStatement("UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = ? AND revoked_at IS NULL")) {
            ps.setObject(1, userId);
            ps.executeUpdate();
        }
    }

    /** B-2: token_reuse audit event with VALID jsonb meta; best-effort so an audit outage can never undo the revocation. */
    private void auditReuse(UUID userId, String ip) {
        try {
            db.tx(c -> {
                try (PreparedStatement ps = c.prepareStatement(
                        "INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, ip, meta) VALUES (?,'auth.token_reuse','user',?,?, CAST(? AS jsonb))")) {
                    ps.setObject(1, userId);
                    ps.setObject(2, userId);
                    ps.setString(3, ip);
                    ps.setString(4, Json.write(Json.obj("tokenHash", hash(userId.toString()))));
                    ps.executeUpdate();
                }
                return null;
            });
        } catch (Exception ignored) { }
    }
}
