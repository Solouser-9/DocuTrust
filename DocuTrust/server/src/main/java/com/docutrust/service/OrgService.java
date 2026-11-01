package com.docutrust.service;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.docutrust.AppException;
import com.docutrust.auth.PasswordService;
import com.docutrust.db.Database;
import com.docutrust.db.Rows;
import com.docutrust.http.Ctx;
import com.docutrust.model.Models;
import com.docutrust.util.Json;
import com.docutrust.util.Text;
import com.docutrust.util.Validator;

// Organisation domain: member directory, OTP invitations (claimed via /api/auth/accept-invite),
// role changes, removal, stats. The old temporary-password-in-response pattern is gone: the
// invitee's inbox is the only place the invite code ever appears.
public final class OrgService {
    private final Database db;
    private final PasswordService passwords;
    private final AuditService audit;
    private final NotificationService notifications;
    private final OtpService otps;
    private final MailService mail;
    private final com.docutrust.auth.TokenService tokens;

    public OrgService(Database db, PasswordService passwords, AuditService audit, NotificationService notifications,
                      OtpService otps, MailService mail, com.docutrust.auth.TokenService tokens) {
        this.db = db;
        this.passwords = passwords;
        this.audit = audit;
        this.notifications = notifications;
        this.otps = otps;
        this.mail = mail;
        this.tokens = tokens;
    }

    private static final String USER_COLS =
            "id, org_id, email, full_name, phone, role, status, mfa_enabled, email_verified, last_login_at, created_at";

    public List<Map<String, Object>> members(Models.User me) {
        if (me.orgId == null) return List.of();
        return db.with(c -> {
            List<Map<String, Object>> out = new ArrayList<>();
            try (PreparedStatement ps = c.prepareStatement(
                    "SELECT " + USER_COLS + " FROM users WHERE org_id = ? ORDER BY created_at ASC")) {
                ps.setObject(1, UUID.fromString(me.orgId));
                try (ResultSet rs = ps.executeQuery()) { while (rs.next()) out.add(Rows.user(rs).toMap()); }
            }
            return out;
        });
    }

    /** Invitation outcome: public body + dev-mode code the controller may echo via X-Dev-OTP. */
    public record InviteResult(Map<String, Object> body, String devCode) {}

    public InviteResult invite(Models.User me, Map<String, Object> b, String ip) {
        if (me.orgId == null) throw AppException.forbidden("You are not part of an organisation");
        String email = Validator.email(Ctx.str(b, "email"));
        String role = Validator.oneOf(Ctx.str(b, "role"), "role", "member", "org_manager");
        record Minted(UUID userId, String code) {}
        Minted m = db.tx(c -> {
            try (PreparedStatement ps = c.prepareStatement("SELECT id FROM users WHERE email = ?")) {
                ps.setString(1, email);
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) throw AppException.conflict("An account with this email already exists");
                }
            }
            UUID userId = UUID.randomUUID();
            String fullName = email.substring(0, email.indexOf('@'));
            // Unusable placeholder hash - the account only becomes usable once the invitee
            // claims it with the emailed OTP via /api/auth/accept-invite.
            String placeholderHash = passwords.hash(Text.randomUrl(43));
            try (PreparedStatement ps = c.prepareStatement(
                    "INSERT INTO users (id, org_id, email, password_hash, full_name, role, status, email_verified) "
                            + "VALUES (?,?,?,?,?,?,'pending',FALSE)")) {
                ps.setObject(1, userId);
                ps.setObject(2, UUID.fromString(me.orgId));
                ps.setString(3, email);
                ps.setString(4, placeholderHash);
                ps.setString(5, Character.toUpperCase(fullName.charAt(0)) + fullName.substring(1));
                ps.setString(6, role);
                ps.executeUpdate();
            }
            String code = otps.issue(c, OtpService.PURPOSE_ORG_INVITE, userId, null, email, OtpService.INVITE_TTL_MINUTES);
            String orgName = orgName(c, me.orgId);
            notifications.notify(c, userId, "org_invite", "You've been added to " + orgName,
                    me.fullName + " invited you as " + role + ". A 6-digit invite code was emailed to you - "
                            + "use it via POST /api/auth/accept-invite to choose your password.", "user", userId.toString());
            audit.insert(c, UUID.fromString(me.id), "org.invited", "user", userId.toString(), ip, null,
                    Json.obj("email", email, "role", role));
            return new Minted(userId, code);
        });
        Models.User u = db.with(c -> fetchUser(c, m.userId()));
        mail.sendOtp(email, OtpService.PURPOSE_ORG_INVITE, m.code(), OtpService.INVITE_TTL_MINUTES); // after commit
        Map<String, Object> body = Json.obj("user", u.toMap(), "message",
                "Invite created - a 6-digit invite code was emailed to " + email + " (valid 24 hours)");
        return new InviteResult(body, mail.devMode() ? m.code() : null);
    }

    /** Claims a pending invite: emailed OTP + self-chosen password -> active account with tokens. */
    public Map<String, Object> acceptInvite(Map<String, Object> b, String ip, String userAgent) {
        String email = Validator.email(Ctx.str(b, "email"));
        String code = Validator.required(Ctx.str(b, "code"), "code", 6);
        String password = Validator.password(Ctx.str(b, "password"));
        String fullName = Validator.optional(Ctx.str(b, "fullName"), "fullName", 120);
        UUID userId = db.with(c -> {
            try (PreparedStatement ps = c.prepareStatement("SELECT id FROM users WHERE email = ? AND status = 'pending'")) {
                ps.setString(1, email);
                try (ResultSet rs = ps.executeQuery()) {
                    return rs.next() ? UUID.fromString(rs.getString("id")) : null;
                }
            }
        });
        if (userId == null) throw AppException.validation("code", "No pending invite for this email - the code is invalid or already used");
        return db.tx(c -> {
            otps.verify(c, OtpService.PURPOSE_ORG_INVITE, userId, null, email, code);
            StringBuilder sql = new StringBuilder("UPDATE users SET password_hash = ?, status = 'active', email_verified = TRUE");
            if (fullName != null) sql.append(", full_name = ?");
            sql.append(" WHERE id = ? AND status = 'pending'");
            try (PreparedStatement ps = c.prepareStatement(sql.toString())) {
                ps.setString(1, passwords.hash(password));
                if (fullName != null) ps.setString(2, fullName);
                ps.setObject(fullName != null ? 3 : 2, userId);
                ps.executeUpdate();
            }
            Models.User u = fetchUser(c, userId);
            audit.insert(c, userId, "org.invite_accepted", "user", userId.toString(), ip, userAgent, Json.obj("email", email));
            com.docutrust.auth.TokenService.Tokens t = tokens.issue(c, userId, u.role, u.orgId, device(userAgent), ip);
            return Json.obj("user", u.toMap(), "accessToken", t.accessToken, "refreshToken", t.refreshToken);
        });
    }

    private static String device(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) return "api";
        return userAgent.length() > 120 ? userAgent.substring(0, 120) : userAgent;
    }

    public Models.User changeRole(Models.User me, UUID memberId, Map<String, Object> b, String ip) {
        String role = Validator.oneOf(Ctx.str(b, "role"), "role", "member", "org_manager");
        if (memberId.equals(UUID.fromString(me.id))) throw AppException.conflict("You cannot change your own role");
        return db.tx(c -> {
            int n;
            try (PreparedStatement ps = c.prepareStatement(
                    "UPDATE users SET role = ? WHERE id = ? AND org_id = ?")) {
                ps.setString(1, role);
                ps.setObject(2, memberId);
                ps.setObject(3, me.orgId == null ? null : UUID.fromString(me.orgId));
                n = ps.executeUpdate();
            }
            if (n == 0) throw AppException.notFound("Member not found in your organisation");
            audit.insert(c, UUID.fromString(me.id), "org.role_changed", "user", memberId.toString(), ip, null,
                    Json.obj("role", role));
            return fetchUser(c, memberId);
        });
    }

    public Map<String, Object> remove(Models.User me, UUID memberId, String ip) {
        if (memberId.equals(UUID.fromString(me.id))) throw AppException.conflict("You cannot remove yourself");
        db.tx(c -> {
            try (PreparedStatement ps = c.prepareStatement("DELETE FROM users WHERE id = ? AND org_id = ?")) {
                ps.setObject(1, memberId);
                ps.setObject(2, me.orgId == null ? null : UUID.fromString(me.orgId));
                if (ps.executeUpdate() == 0) throw AppException.notFound("Member not found in your organisation");
            }
            audit.insert(c, UUID.fromString(me.id), "org.member_removed", "user", memberId.toString(), ip, null, Json.obj());
            return null;
        });
        return Json.obj("removed", true, "id", memberId.toString());
    }

    public Map<String, Object> stats(Models.User me) {
        Map<String, Object> out = Json.obj("orgId", me.orgId, "orgName", (Object) null,
                "memberCount", 0, "documentCount", 0, "activeShareCount", 0);
        if (me.orgId == null) return out;
        return db.with(c -> {
            out.put("orgName", orgName(c, me.orgId));
            try (PreparedStatement ps = c.prepareStatement("SELECT COUNT(*) FROM users WHERE org_id = ?")) {
                ps.setObject(1, UUID.fromString(me.orgId));
                try (ResultSet rs = ps.executeQuery()) { rs.next(); out.put("memberCount", rs.getLong(1)); }
            }
            try (PreparedStatement ps = c.prepareStatement(
                    "SELECT COUNT(*) FROM documents d JOIN users u ON u.id = d.owner_id "
                            + "WHERE u.org_id = ? AND d.deleted_at IS NULL")) {
                ps.setObject(1, UUID.fromString(me.orgId));
                try (ResultSet rs = ps.executeQuery()) { rs.next(); out.put("documentCount", rs.getLong(1)); }
            }
            try (PreparedStatement ps = c.prepareStatement(
                    "SELECT COUNT(*) FROM shares s JOIN users u ON u.id = s.owner_id "
                            + "WHERE u.org_id = ? AND s.revoked_at IS NULL")) {
                ps.setObject(1, UUID.fromString(me.orgId));
                try (ResultSet rs = ps.executeQuery()) { rs.next(); out.put("activeShareCount", rs.getLong(1)); }
            }
            return new LinkedHashMap<>(out);
        });
    }

    // ---- internals ----
    private String orgName(java.sql.Connection c, String orgId) throws Exception {
        try (PreparedStatement ps = c.prepareStatement("SELECT name FROM organisations WHERE id = ?")) {
            ps.setObject(1, UUID.fromString(orgId));
            try (ResultSet rs = ps.executeQuery()) { return rs.next() ? rs.getString(1) : "your organisation"; }
        }
    }

    private Models.User fetchUser(java.sql.Connection c, UUID userId) throws Exception {
        try (PreparedStatement ps = c.prepareStatement("SELECT " + USER_COLS + " FROM users WHERE id = ?")) {
            ps.setObject(1, userId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) throw AppException.notFound("User not found");
                return Rows.user(rs);
            }
        }
    }
}
