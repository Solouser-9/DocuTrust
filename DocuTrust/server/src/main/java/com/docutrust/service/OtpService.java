package com.docutrust.service;

import com.docutrust.AppException;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.util.UUID;

// Email one-time passcodes: 6-digit SecureRandom codes, SHA-256-hashed at rest, single use,
// 10-minute TTL and a 5-attempt cap per code. Issue deletes the target's unused codes first
// so at most one live OTP exists per (purpose, target). The digest is salted with the purpose
// and the target, so a code captured for one flow can never be replayed against another.
public final class OtpService {
    public static final String PURPOSE_PASSWORD_RESET = "password_reset";
    public static final String PURPOSE_MFA_LOGIN = "mfa_login";
    public static final String PURPOSE_STEP_UP = "step_up";
    public static final String PURPOSE_SHARE_ACCESS = "share_access";
    public static final String PURPOSE_ORG_INVITE = "org_invite";

    public static final long TTL_MINUTES = 10;
    public static final long INVITE_TTL_MINUTES = 24 * 60; // invites sit in inboxes
    public static final int MAX_ATTEMPTS = 5;

    /** Outcome of a verification that succeeded - the OTP's owner (null for share-access OTPs). */
    public record Verified(UUID userId) {}

    /** Issue one OTP and return the plaintext code (the caller emails it, or exposes it in dev mode). */
    public String issue(Connection c, String purpose, UUID userId, UUID shareId, String recipientEmail) throws Exception {
        return issue(c, purpose, userId, shareId, recipientEmail, TTL_MINUTES);
    }

    public String issue(Connection c, String purpose, UUID userId, UUID shareId, String recipientEmail, long ttlMinutes) throws Exception {
        String email = recipientEmail.toLowerCase();
        // keep at most one live code per target - issuing invalidates the previous unused ones
        try (PreparedStatement ps = c.prepareStatement(
                "DELETE FROM email_otps WHERE purpose = ? AND used_at IS NULL "
                        + "AND (share_id IS NOT DISTINCT FROM ?) "
                        + "AND (CASE WHEN ?::uuid IS NULL THEN user_id IS NULL ELSE user_id = ? END)")) {
            ps.setString(1, purpose);
            ps.setObject(2, shareId);
            ps.setObject(3, userId);
            ps.setObject(4, userId);
            ps.executeUpdate();
        }
        String code = String.format("%06d", new java.security.SecureRandom().nextInt(1_000_000));
        try (PreparedStatement ps = c.prepareStatement(
                "INSERT INTO email_otps (id, user_id, share_id, recipient_email, purpose, otp_hash, expires_at) "
                        + "VALUES (?,?,?,?,?,?, now() + make_interval(mins => ?))")) {
            ps.setObject(1, UUID.randomUUID());
            ps.setObject(2, userId);
            ps.setObject(3, shareId);
            ps.setString(4, email);
            ps.setString(5, purpose);
            ps.setString(6, digest(purpose, email, code));
            ps.setInt(7, (int) ttlMinutes);
            ps.executeUpdate();
        }
        return code;
    }

    /**
     * Verifies and consumes the newest live OTP for (purpose, user, share). A wrong code
     * burns one attempt; at MAX_ATTEMPTS the code is burned entirely. Expired, already used
     * and unknown codes all fail identically - the reply never reveals which.
     */
    public Verified verify(Connection c, String purpose, UUID userId, UUID shareId, String recipientEmail, String code) throws Exception {
        String email = recipientEmail.toLowerCase();
        if (code == null || !code.trim().matches("\\d{6}")) throw otpInvalid();
        record Row(UUID id, String hash, Timestamp expiresAt, int attempts) {}
        Row row;
        try (PreparedStatement ps = c.prepareStatement(
                "SELECT id, otp_hash, expires_at, attempts FROM email_otps "
                        + "WHERE purpose = ? AND used_at IS NULL "
                        + "AND (share_id IS NOT DISTINCT FROM ?) "
                        + "AND (CASE WHEN ?::uuid IS NULL THEN user_id IS NULL ELSE user_id = ? END) "
                        + "ORDER BY created_at DESC LIMIT 1 FOR UPDATE")) {
            ps.setString(1, purpose);
            ps.setObject(2, shareId);
            ps.setObject(3, userId);
            ps.setObject(4, userId);
            try (ResultSet rs = ps.executeQuery()) {
                row = rs.next() ? new Row(UUID.fromString(rs.getString("id")), rs.getString("otp_hash"),
                        rs.getTimestamp("expires_at"), rs.getInt("attempts")) : null;
            }
        }
        if (row == null || row.expiresAt().before(new Timestamp(System.currentTimeMillis()))) throw otpInvalid();
        boolean match = com.docutrust.util.Text.constEq(digest(purpose, email, code.trim()), row.hash());
        if (!match) {
            int attempts = row.attempts() + 1;
            boolean burned = attempts >= MAX_ATTEMPTS;
            try (PreparedStatement ps = c.prepareStatement(
                    "UPDATE email_otps SET attempts = ?, used_at = CASE WHEN ? THEN now() ELSE used_at END WHERE id = ?")) {
                ps.setInt(1, attempts);
                ps.setBoolean(2, burned);
                ps.setObject(3, row.id());
                ps.executeUpdate();
            }
            throw otpInvalid();
        }
        try (PreparedStatement ps = c.prepareStatement(
                "UPDATE email_otps SET used_at = now() WHERE id = ? AND used_at IS NULL")) {
            ps.setObject(1, row.id());
            if (ps.executeUpdate() == 0) throw otpInvalid(); // lost a single-use race - fail closed
        }
        UUID owner = userId != null ? userId : ownerOf(c, row.id());
        return new Verified(owner);
    }

    private UUID ownerOf(Connection c, UUID otpId) throws Exception {
        try (PreparedStatement ps = c.prepareStatement("SELECT user_id FROM email_otps WHERE id = ?")) {
            ps.setObject(1, otpId);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() && rs.getString(1) != null ? UUID.fromString(rs.getString(1)) : null;
            }
        }
    }

    private static AppException otpInvalid() {
        return new AppException(400, "OTP_INVALID", "This code is invalid, expired or already used - request a fresh one");
    }

    public static String digest(String purpose, String targetEmail, String code) {
        return com.docutrust.util.Text.sha256Hex((purpose + ":" + targetEmail.toLowerCase() + ":" + code)
                .getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }
}
