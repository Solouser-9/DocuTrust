package com.docutrust.service;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.security.GeneralSecurityException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.docutrust.AppException;
import com.docutrust.auth.JwtService;
import com.docutrust.auth.MfaService;
import com.docutrust.auth.PasswordService;
import com.docutrust.auth.TokenService;
import com.docutrust.db.Database;
import com.docutrust.db.Rows;
import com.docutrust.http.Ctx;
import com.docutrust.model.Models;
import com.docutrust.util.Json;
import com.docutrust.util.Text;
import com.docutrust.util.Validator;
import com.docutrust.vault.FileVault;

public final class AuthService {
    private final Database db;
    private final PasswordService passwords;
    private final TokenService tokens;
    private final MfaService mfa;
    private final AuditService audit;
    private final MailService mail;
    private final OtpService otps;
    private final StepUpService stepUps;
    private final JwtService jwt;
    private final FileVault vault;
    private final boolean demoMode;

    public AuthService(Database db, PasswordService passwords, TokenService tokens, MfaService mfa,
                       AuditService audit, MailService mail, OtpService otps, StepUpService stepUps,
                       JwtService jwt, FileVault vault, boolean demoMode) {
        this.db = db;
        this.passwords = passwords;
        this.tokens = tokens;
        this.mfa = mfa;
        this.audit = audit;
        this.mail = mail;
        this.otps = otps;
        this.stepUps = stepUps;
        this.jwt = jwt;
        this.vault = vault;
        this.demoMode = demoMode;
        migratePlaintextMfaSecrets();
    }

    public record LoginResult(Map<String, Object> body, String mfaChallenge, String maskedEmail, String devOtp) {}
    public record ForgotResult(Map<String, Object> body, String devOtp) {}
    public record RegisterResult(Map<String, Object> body, String devOtp) {}
    private record RegistrationCreated(Map<String, Object> body, String otp) {}

    private static final class CredUser {
        final Models.User user;
        final String passwordHash, mfaSecret;
        CredUser(Models.User u, String passwordHash, String mfaSecret) {
            this.user = u; this.passwordHash = passwordHash; this.mfaSecret = mfaSecret;
        }
    }

    private CredUser loadCred(Connection c, String email) throws Exception {
        try (PreparedStatement ps = c.prepareStatement(
                "SELECT id, org_id, email, full_name, phone, role, status, mfa_enabled, mfa_secret, email_verified, last_login_at, created_at, password_hash "
                        + "FROM users WHERE email = ?")) {
            ps.setString(1, email.toLowerCase());
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return null;
                Models.User u = new Models.User();
                u.id = rs.getString("id");
                u.orgId = Rows.str(rs, "org_id");
                u.email = rs.getString("email");
                u.fullName = rs.getString("full_name");
                u.phone = Rows.str(rs, "phone");
                u.role = rs.getString("role");
                u.status = rs.getString("status");
                u.mfaEnabled = rs.getBoolean("mfa_enabled");
                u.emailVerified = rs.getBoolean("email_verified");
                u.lastLoginAt = Rows.ts(rs, "last_login_at");
                u.createdAt = Rows.ts(rs, "created_at");
                return new CredUser(u, rs.getString("password_hash"), Rows.str(rs, "mfa_secret"));
            }
        }
    }

    public Models.User get(UUID userId) {
        return db.with(c -> {
            Models.User u;
            try (PreparedStatement ps = c.prepareStatement(
                    "SELECT id, org_id, email, full_name, phone, role, status, mfa_enabled, email_verified, last_login_at, created_at FROM users WHERE id = ?")) {
                ps.setObject(1, userId);
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) throw AppException.notFound("Account not found");
                    u = Rows.user(rs);
                }
            }
            if (u.orgId != null) {
                try (PreparedStatement ps = c.prepareStatement("SELECT name FROM organisations WHERE id = ?")) {
                    ps.setObject(1, UUID.fromString(u.orgId));
                    try (ResultSet rs = ps.executeQuery()) { if (rs.next()) u.orgName = rs.getString(1); }
                }
            }
            return u;
        });
    }

    public RegisterResult register(Map<String, Object> b, String ip, String userAgent) {
        String email = Validator.email(Ctx.str(b, "email"));
        String password = Validator.password(Ctx.str(b, "password"));
        String fullName = Validator.required(Ctx.str(b, "fullName"), "fullName", 120);
        String phone = Validator.optional(Ctx.str(b, "phone"), "phone", 30);
        String orgName = Validator.optional(Ctx.str(b, "orgName"), "orgName", 120);

        RegistrationCreated created = db.tx(c -> {
            try (PreparedStatement ps = c.prepareStatement("SELECT id FROM users WHERE email = ?")) {
                ps.setString(1, email);
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) throw AppException.conflict("An account with this email already exists");
                }
            }
            String orgId = null;
            String role = "member";
            if (orgName != null) {
                try (PreparedStatement ps = c.prepareStatement("INSERT INTO organisations (name) VALUES (?) RETURNING id")) {
                    ps.setString(1, orgName);
                    try (ResultSet rs = ps.executeQuery()) {
                        if (rs.next()) {
                            orgId = rs.getString("id");
                        }
                    }
                }
                role = "org_manager";
            }
            UUID userId = UUID.randomUUID();
            try (PreparedStatement ps = c.prepareStatement(
                    "INSERT INTO users (id, org_id, email, password_hash, full_name, phone, role, status, email_verified) "
                            + "VALUES (?,?,?,?,?,?,?,'pending',FALSE)")) {
                ps.setObject(1, userId);
                ps.setObject(2, orgId == null ? null : UUID.fromString(orgId));
                ps.setString(3, email);
                ps.setString(4, passwords.hash(password));
                ps.setString(5, fullName);
                ps.setString(6, phone);
                ps.setString(7, role);
                ps.executeUpdate();
            }
            String code = otps.issue(c, OtpService.PURPOSE_REGISTRATION, userId, null, email);
            audit.insert(c, userId, "auth.register", "user", userId.toString(), ip, userAgent,
                    Json.obj("email", email, "org", orgName));
            Models.User fresh = fetchUser(c, userId);
            return new RegistrationCreated(Json.obj("user", fresh.toMap(),
                    "message", "A 6-digit verification code was sent to your email"), code);
        });
        mail.sendOtp(email, OtpService.PURPOSE_REGISTRATION, created.otp(), OtpService.TTL_MINUTES);
        return new RegisterResult(created.body(), mail.devMode() ? created.otp() : null);
    }

    public LoginResult login(Map<String, Object> b, String ip, String userAgent) {
        String email = Validator.email(Ctx.str(b, "email"));
        String password = Ctx.str(b, "password");
        String mfaCode = Ctx.str(b, "mfaCode");
        boolean useEmailMfa = Boolean.TRUE.equals(Ctx.boolVal(b, "useEmailMfa"));

        CredUser cu = db.with(c -> loadCred(c, email));
        if (cu == null || !passwords.verify(password == null ? "" : password, cu.passwordHash)) {
            audit.insert(null, "auth.login_failed", "user", null, ip, userAgent, Json.obj("email", email));
            throw AppException.unauthorized("Invalid email or password");
        }
        UUID userId = UUID.fromString(cu.user.id);
        if ("suspended".equals(cu.user.status)) throw new AppException(403, "ACCOUNT_SUSPENDED", "Account suspended - contact support");
        if ("pending".equals(cu.user.status)) throw new AppException(403, "EMAIL_VERIFICATION_REQUIRED", "Verify your email address before signing in");
        if (cu.user.mfaEnabled) {
            if (useEmailMfa) {
                String code = db.tx(c -> otps.issue(c, OtpService.PURPOSE_MFA_LOGIN, userId, null, cu.user.email));
                audit.insert(userId, "auth.mfa_email_challenge", "user", userId.toString(), ip, userAgent, Json.obj());
                mail.sendOtp(cu.user.email, OtpService.PURPOSE_MFA_LOGIN, code, OtpService.TTL_MINUTES);
                String challenge = jwt.issue(userId.toString(), cu.user.role, cu.user.orgId, OtpService.TTL_MINUTES * 60, "mfa_challenge");
                return new LoginResult(null, challenge, maskEmail(cu.user.email), demoMode ? code : null);
            }
            if (!mfa.verify(decryptMfaSecret(cu.mfaSecret), mfaCode == null ? "" : mfaCode.trim()))
                throw new AppException(440, "MFA_REQUIRED", "A valid TOTP code is required for this account (or retry with useEmailMfa: true)");
        }

        db.tx(c -> {
            try (PreparedStatement ps = c.prepareStatement("UPDATE users SET last_login_at = now() WHERE id = ?")) {
                ps.setObject(1, userId);
                ps.executeUpdate();
            }
            audit.insert(c, userId, "auth.login", "user", userId.toString(), ip, userAgent, Json.obj("mfa", cu.user.mfaEnabled));
            return null;
        });
        TokenService.Tokens t = tokens.issue(userId, cu.user.role, cu.user.orgId, device(userAgent), ip);
        return new LoginResult(Json.obj("user", cu.user.toMap(), "accessToken", t.accessToken, "refreshToken", t.refreshToken), null, null, null);
    }

    public Map<String, Object> verifyOtp(String challenge, String code, String ip, String userAgent) {
        if (challenge == null || challenge.isBlank()) throw AppException.validation("challenge", "challenge is required");
        JwtService.Claims claims;
        try {
            claims = jwt.verify(challenge.trim());
        } catch (JwtService.TokenExpiredException e) {
            throw new AppException(401, "CHALLENGE_EXPIRED", "This sign-in challenge expired - start again");
        } catch (JwtService.TokenInvalidException e) {
            throw AppException.unauthorized("Invalid sign-in challenge");
        }
        if (!"mfa_challenge".equals(claims.typ)) throw AppException.unauthorized("Invalid sign-in challenge");
        UUID userId = UUID.fromString(claims.sub);
        Models.User u = get(userId);
        if ("suspended".equals(u.status)) throw new AppException(403, "ACCOUNT_SUSPENDED", "Account suspended - contact support");
        db.tx(c -> otps.verify(c, OtpService.PURPOSE_MFA_LOGIN, userId, null, u.email, code));
        db.tx(c -> {
            try (PreparedStatement ps = c.prepareStatement("UPDATE users SET last_login_at = now() WHERE id = ?")) {
                ps.setObject(1, userId);
                ps.executeUpdate();
            }
            audit.insert(c, userId, "auth.login", "user", userId.toString(), ip, userAgent, Json.obj("mfa", "email_otp"));
            return null;
        });
        TokenService.Tokens t = tokens.issue(userId, u.role, u.orgId, device(userAgent), ip);
        return Json.obj("user", u.toMap(), "accessToken", t.accessToken, "refreshToken", t.refreshToken);
    }

    public Map<String, Object> verifyRegistrationOtp(String email, String code, String ip, String userAgent) {
        String validatedEmail = Validator.email(email);
        return db.tx(c -> {
            UUID userId;
            String orgId;
            String role;
            try (PreparedStatement ps = c.prepareStatement(
                    "SELECT id, org_id, role FROM users WHERE email = ? AND status = 'pending' AND email_verified = FALSE FOR UPDATE")) {
                ps.setString(1, validatedEmail);
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) throw new AppException(400, "OTP_INVALID",
                            "This code is invalid, expired or already used - request a fresh one");
                    userId = UUID.fromString(rs.getString("id"));
                    orgId = Rows.str(rs, "org_id");
                    role = rs.getString("role");
                }
            }
            otps.verify(c, OtpService.PURPOSE_REGISTRATION, userId, null, validatedEmail, code);
            try (PreparedStatement ps = c.prepareStatement(
                    "UPDATE users SET status = 'active', email_verified = TRUE, last_login_at = now() "
                            + "WHERE id = ? AND status = 'pending' AND email_verified = FALSE")) {
                ps.setObject(1, userId);
                if (ps.executeUpdate() != 1) throw new AppException(400, "OTP_INVALID",
                        "This code is invalid, expired or already used - request a fresh one");
            }
            audit.insert(c, userId, "auth.email_verified", "user", userId.toString(), ip, userAgent,
                    Json.obj("via", "registration_otp"));
            TokenService.Tokens t = tokens.issue(c, userId, role, orgId, device(userAgent), ip);
            Models.User fresh = fetchUser(c, userId);
            return Json.obj("user", fresh.toMap(),
                    "accessToken", t.accessToken, "refreshToken", t.refreshToken);
        });
    }

    // ---- NEW: Resend OTP ----
    public void resendOtp(String email) {
        if (email == null || email.isBlank()) return;
        String validatedEmail = email.trim().toLowerCase();

        db.tx(c -> {
            UUID userId = null;
            String status = null;
            try (PreparedStatement ps = c.prepareStatement("SELECT id, status FROM users WHERE email = ?")) {
                ps.setString(1, validatedEmail);
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) {
                        userId = UUID.fromString(rs.getString("id"));
                        status = rs.getString("status");
                    }
                }
            }
            // If user doesn't exist, return silently to prevent enumeration
            if (userId == null) return null;

            String code;
            String purpose;

            // Smart Context: If pending, it's a registration OTP. If active, it's a password reset OTP.
            if ("pending".equals(status)) {
                purpose = OtpService.PURPOSE_REGISTRATION;
                code = otps.issue(c, purpose, userId, null, validatedEmail);
                mail.sendOtp(validatedEmail, purpose, code, OtpService.TTL_MINUTES);
            } else {
                purpose = OtpService.PURPOSE_PASSWORD_RESET;
                code = otps.issue(c, purpose, userId, null, validatedEmail);
                mail.sendOtp(validatedEmail, purpose, code, OtpService.TTL_MINUTES);
            }
            return null;
        });
    }

    // ---- refresh / logout ----
    public Map<String, Object> refresh(Map<String, Object> b, String ip, String userAgent) {
        TokenService.Tokens t = tokens.rotate(Ctx.str(b, "refreshToken"), device(userAgent), ip);
        return Json.obj("accessToken", t.accessToken, "refreshToken", t.refreshToken);
    }

    public void logout(Map<String, Object> b) {
        tokens.revoke(Ctx.str(b, "refreshToken"));
    }

    public List<Map<String, Object>> listSessions(UUID userId) {
        return db.with(c -> tokens.listSessions(c, userId));
    }

    public boolean revokeSession(UUID userId, UUID sessionId) {
        return db.tx(c -> tokens.revokeById(c, userId, sessionId));
    }

    // ---- forgot / reset password (email OTP) ----
    public ForgotResult forgotPassword(Map<String, Object> b, String ip) {
        String email = Validator.email(Ctx.str(b, "email"));
        String devCode = db.tx(c -> {
            UUID userId = null;
            try (PreparedStatement ps = c.prepareStatement("SELECT id FROM users WHERE email = ?")) {
                ps.setString(1, email);
                try (ResultSet rs = ps.executeQuery()) { if (rs.next()) userId = UUID.fromString(rs.getString("id")); }
            }
            if (userId == null) return null;
            String code = otps.issue(c, OtpService.PURPOSE_PASSWORD_RESET, userId, null, email);
            audit.insert(c, userId, "auth.password_reset_requested", "user", userId.toString(), ip, null, Json.obj());
            return code;
        });
        if (devCode != null) mail.sendOtp(email, OtpService.PURPOSE_PASSWORD_RESET, devCode, OtpService.TTL_MINUTES);
        return new ForgotResult(Json.obj("message", "If that email exists, a reset code has been sent"), devCode);
    }

    public void resetPasswordOtp(Map<String, Object> b, String ip) {
        String email = Validator.email(Ctx.str(b, "email"));
        String code = Validator.required(Ctx.str(b, "code"), "code", 6);
        String newPassword = Validator.password(Ctx.str(b, "newPassword"));
        UUID userId = db.with(c -> {
            try (PreparedStatement ps = c.prepareStatement("SELECT id FROM users WHERE email = ?")) {
                ps.setString(1, email);
                try (ResultSet rs = ps.executeQuery()) {
                    return rs.next() ? UUID.fromString(rs.getString("id")) : null;
                }
            }
        });
        if (userId == null) throw new AppException(400, "OTP_INVALID", "This code is invalid, expired or already used - request a fresh one");
        db.tx(c -> {
            otps.verify(c, OtpService.PURPOSE_PASSWORD_RESET, userId, null, email, code);
            try (PreparedStatement ps = c.prepareStatement("UPDATE users SET password_hash = ? WHERE id = ?")) {
                ps.setString(1, passwords.hash(newPassword));
                ps.setObject(2, userId);
                ps.executeUpdate();
            }
            tokens.revokeAllForUser(c, userId);
            audit.insert(c, userId, "auth.password_reset", "user", userId.toString(), ip, null, Json.obj("via", "email_otp"));
            return null;
        });
    }

    // ---- email verification ----
    public Map<String, Object> verifyEmail(String token) {
        if (token == null || token.isBlank()) throw AppException.validation("token", "token is required");
        db.tx(c -> {
            UUID userId = consumeToken(c, TokenService.hash(token.trim()));
            if (userId == null) throw AppException.validation("token", "Verification token is invalid or expired");
            try (PreparedStatement ps = c.prepareStatement(
                    "UPDATE users SET email_verified = TRUE, status = CASE WHEN status = 'pending' THEN 'active' ELSE status END WHERE id = ?")) {
                ps.setObject(1, userId);
                ps.executeUpdate();
            }
            audit.insert(c, userId, "auth.email_verified", "user", userId.toString(), null, null, Json.obj());
            return null;
        });
        return Json.obj("verified", true);
    }

    // ---- profile ----
    public Models.User updateMe(UUID userId, Map<String, Object> b) {
        String fullName = Validator.optional(Ctx.str(b, "fullName"), "fullName", 120);
        String phone = Validator.optional(Ctx.str(b, "phone"), "phone", 30);
        if (fullName == null && phone == null) return get(userId);
        db.tx(c -> {
            StringBuilder sql = new StringBuilder("UPDATE users SET ");
            if (fullName != null) sql.append("full_name = ?, ");
            if (phone != null) sql.append("phone = ?, ");
            sql.setLength(sql.length() - 2);
            sql.append(" WHERE id = ?");
            try (PreparedStatement ps = c.prepareStatement(sql.toString())) {
                int i = 1;
                if (fullName != null) ps.setString(i++, fullName);
                if (phone != null) ps.setString(i++, phone);
                ps.setObject(i, userId);
                ps.executeUpdate();
            }
            return null;
        });
        return get(userId);
    }

    public void changePassword(UUID userId, Map<String, Object> b, String stepUpToken, String ip) {
        stepUps.authorize(stepUpToken, db.with(c -> fetchUser(c, userId)));
        String current = Ctx.str(b, "currentPassword");
        String next = Validator.password(Ctx.str(b, "newPassword"));
        String stored = db.with(c -> {
            try (PreparedStatement ps = c.prepareStatement("SELECT password_hash FROM users WHERE id = ?")) {
                ps.setObject(1, userId);
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) throw AppException.notFound("Account not found");
                    return rs.getString(1);
                }
            }
        });
        if (!passwords.verify(current == null ? "" : current, stored)) {
            audit.insert(userId, "auth.password_change_failed", "user", userId.toString(), ip, null, Json.obj());
            throw AppException.validation("currentPassword", "Current password is incorrect");
        }
        if (current != null && current.equals(next)) {
            throw AppException.validation("newPassword", "New password must be different from the old password.");
        }
        db.tx(c -> {
            try (PreparedStatement ps = c.prepareStatement("UPDATE users SET password_hash = ? WHERE id = ?")) {
                ps.setString(1, passwords.hash(next));
                ps.setObject(2, userId);
                ps.executeUpdate();
            }
            tokens.revokeAllForUser(c, userId);
            audit.insert(c, userId, "auth.password_changed", "user", userId.toString(), ip, null, Json.obj());
            return null;
        });
    }

    // ---- MFA ----
    public Map<String, Object> mfaSetup(UUID userId, String email) {
        String secret = mfa.newSecret();
        String encryptedSecret = encryptMfaSecret(secret);
        db.tx(c -> {
            try (PreparedStatement ps = c.prepareStatement("UPDATE users SET mfa_secret = ? WHERE id = ?")) {
                ps.setString(1, encryptedSecret);
                ps.setObject(2, userId);
                ps.executeUpdate();
            }
            return null;
        });
        return Json.obj("secret", secret, "otpauthUrl", mfa.otpauthUrl(email, secret));
    }

    public Map<String, Object> mfaEnable(UUID userId, Map<String, Object> b) {
        String requestedSecret = Validator.required(Ctx.str(b, "secret"), "secret", 64);
        String code = Validator.required(Ctx.str(b, "code"), "code", 10);
        String secret = db.with(c -> {
            try (PreparedStatement ps = c.prepareStatement("SELECT mfa_secret FROM users WHERE id = ?")) {
                ps.setObject(1, userId);
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) throw AppException.notFound("Account not found");
                    return decryptMfaSecret(Rows.str(rs, "mfa_secret"));
                }
            }
        });
        if (!requestedSecret.equals(secret)) throw AppException.validation("secret", "MFA setup secret does not match");
        if (!mfa.verify(secret, code)) throw AppException.validation("code", "Invalid TOTP code, try the next one");
        db.tx(c -> {
            try (PreparedStatement ps = c.prepareStatement("UPDATE users SET mfa_enabled = TRUE WHERE id = ?")) {
                ps.setObject(1, userId);
                ps.executeUpdate();
            }
            audit.insert(c, userId, "auth.mfa_enabled", "user", userId.toString(), null, null, Json.obj());
            return null;
        });
        return Json.obj("mfaEnabled", true);
    }

    public Map<String, Object> mfaDisable(UUID userId, Map<String, Object> b) {
        String code = Validator.required(Ctx.str(b, "code"), "code", 10);
        db.tx(c -> {
            String secret;
            boolean enabled;
            try (PreparedStatement ps = c.prepareStatement("SELECT mfa_secret, mfa_enabled FROM users WHERE id = ?")) {
                ps.setObject(1, userId);
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) throw AppException.notFound("Account not found");
                    secret = decryptMfaSecret(Rows.str(rs, "mfa_secret"));
                    enabled = rs.getBoolean("mfa_enabled");
                }
            }
            if (!enabled || secret == null) throw AppException.conflict("MFA is not enabled");
            if (!mfa.verify(secret, code)) throw AppException.validation("code", "Invalid TOTP code, try the next one");
            try (PreparedStatement ps = c.prepareStatement("UPDATE users SET mfa_secret = NULL, mfa_enabled = FALSE WHERE id = ?")) {
                ps.setObject(1, userId);
                ps.executeUpdate();
            }
            audit.insert(c, userId, "auth.mfa_disabled", "user", userId.toString(), null, null, Json.obj());
            return null;
        });
        return Json.obj("mfaEnabled", false);
    }

    // ---- helpers ----
    private void migratePlaintextMfaSecrets() {
        db.tx(c -> {
            Map<String, String> legacySecrets = new HashMap<>();
            try (PreparedStatement ps = c.prepareStatement(
                    "SELECT id, mfa_secret FROM users WHERE mfa_secret IS NOT NULL");
                 ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String secret = rs.getString("mfa_secret");
                    if (!vault.isEncryptedText(secret)) {
                        legacySecrets.put(rs.getString("id"), secret);
                    }
                }
            }
            try (PreparedStatement ps = c.prepareStatement("UPDATE users SET mfa_secret = ? WHERE id = ?")) {
                for (Map.Entry<String, String> entry : legacySecrets.entrySet()) {
                    ps.setString(1, encryptMfaSecret(entry.getValue()));
                    ps.setString(2, entry.getKey());
                    ps.addBatch();
                }
                ps.executeBatch();
            }
            return null;
        });
    }

    private String encryptMfaSecret(String secret) {
        try {
            return vault.encryptText(secret);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Unable to encrypt MFA secret", e);
        }
    }

    private String decryptMfaSecret(String encryptedSecret) {
        if (encryptedSecret == null || encryptedSecret.isBlank()) {
            throw new IllegalStateException("MFA secret is missing");
        }
        try {
            return vault.decryptText(encryptedSecret);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Unable to decrypt MFA secret", e);
        }
    }

    private String issueOneTimeToken(Connection c, UUID userId, int minutes) throws Exception {
        String token = Text.token();
        try (PreparedStatement ps = c.prepareStatement(
                "INSERT INTO password_resets (user_id, code_hash, expires_at) VALUES (?, ?, now() + make_interval(mins => ?))")) {
            ps.setObject(1, userId);
            ps.setString(2, TokenService.hash(token));
            ps.setInt(3, minutes);
            ps.executeUpdate();
        }
        return token;
    }

    private UUID consumeToken(Connection c, String codeHash) throws Exception {
        UUID userId = null;
        Timestamp expiresAt = null;
        Timestamp usedAt = null;
        try (PreparedStatement ps = c.prepareStatement(
                "SELECT user_id, expires_at, used_at FROM password_resets WHERE code_hash = ? ORDER BY created_at DESC LIMIT 1")) {
            ps.setString(1, codeHash);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    userId = UUID.fromString(rs.getString("user_id"));
                    expiresAt = rs.getTimestamp("expires_at");
                    usedAt = rs.getTimestamp("used_at");
                }
            }
        }
        if (userId == null || usedAt != null || expiresAt.before(new Timestamp(System.currentTimeMillis()))) return null;
        try (PreparedStatement ps = c.prepareStatement("UPDATE password_resets SET used_at = now() WHERE code_hash = ?")) {
            ps.setString(1, codeHash);
            ps.executeUpdate();
        }
        return userId;
    }

    private static Models.User fetchUser(Connection c, UUID userId) throws Exception {
        try (PreparedStatement ps = c.prepareStatement(
                "SELECT id, org_id, email, full_name, phone, role, status, mfa_enabled, email_verified, last_login_at, created_at FROM users WHERE id = ?")) {
            ps.setObject(1, userId);
            try (ResultSet rs = ps.executeQuery()) { rs.next(); return Rows.user(rs); }
        }
    }

    private static String device(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) return "api";
        return userAgent.length() > 120 ? userAgent.substring(0, 120) : userAgent;
    }

    private static String maskEmail(String email) {
        if (email == null || !email.contains("@")) return "***";
        int at = email.indexOf('@');
        return email.charAt(0) + "***" + email.substring(at);
    }
}