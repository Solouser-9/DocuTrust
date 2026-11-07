package com.docutrust.service;

import com.docutrust.AppException;
import com.docutrust.auth.JwtService;
import com.docutrust.db.Database;
import com.docutrust.model.Models;
import com.docutrust.util.Json;

import java.util.Map;
import java.util.UUID;

// Step-up re-authentication for sensitive actions (permanent deletion, password change).
// The user first proves a second factor (emailed OTP), receives a 5-minute single-purpose
// JWT, and echoes it back in the X-Step-Up-Token header on the destructive call. The token
// carries no authority beyond "this exact user verified an OTP moments ago" - it is not a
// session token, it is rejected on any other route type, and it never outlives 5 minutes.
public final class StepUpService {
    public static final long TTL_SECONDS = 5 * 60;
    public static final String HEADER = "X-Step-Up-Token";

    private final Database db;
    private final OtpService otps;
    private final MailService mail;
    private final JwtService jwt;
    private final AuditService audit;

    public StepUpService(Database db, OtpService otps, MailService mail, JwtService jwt, AuditService audit) {
        this.db = db;
        this.otps = otps;
        this.mail = mail;
        this.jwt = jwt;
        this.audit = audit;
    }

    /** Sends the step-up OTP to the account's own email; reply is identical whether or not the account exists. */
    public record RequestResult(Map<String, Object> body, String devCode) {}

    public RequestResult request(Models.User me, String ip) {
        UUID userId = UUID.fromString(me.id);
        String code = db.tx(c -> {
            String issued = otps.issue(c, OtpService.PURPOSE_STEP_UP, userId, null, me.email);
            audit.insert(c, userId, "auth.step_up_requested", "user", me.id, ip, null, Json.obj());
            return issued;
        });
        mail.sendOtp(me.email, OtpService.PURPOSE_STEP_UP, code, OtpService.TTL_MINUTES); // after commit - no network inside a tx
        Map<String, Object> body = Json.obj("message", "If that email exists, a verification code has been sent", "ttlMinutes", OtpService.TTL_MINUTES);
        return new RequestResult(body, mail.devMode() ? code : null);
    }

    /** Exchanges a valid OTP for the short-lived step-up token. */
    public Map<String, Object> verify(Models.User me, String code, String ip) {
        UUID userId = UUID.fromString(me.id);
        db.tx(c -> {
            otps.verify(c, OtpService.PURPOSE_STEP_UP, userId, null, me.email, code);
            audit.insert(c, userId, "auth.step_up_verified", "user", me.id, ip, null, Json.obj());
            return null;
        });
        String token = jwt.issue(me.id, me.role, me.orgId, TTL_SECONDS, "step_up");
        return Json.obj("stepUpToken", token, "ttlMinutes", TTL_SECONDS / 60);
    }

    /**
     * Gate for sensitive routes: throws 403 STEP_UP_REQUIRED unless the header carries a
     * valid step-up JWT belonging to the current user.
     */
    public void authorize(String headerValue, Models.User me) {
        if (headerValue == null || headerValue.isBlank())
            throw new AppException(403, "STEP_UP_REQUIRED",
                    "This action requires step-up verification: request an email code via /api/auth/request-step-up, "
                            + "verify it via /api/auth/verify-step-up, then retry with the " + HEADER + " header");
        JwtService.Claims claims;
        try {
            claims = jwt.verify(headerValue.trim());
        } catch (JwtService.TokenExpiredException e) {
            throw new AppException(403, "STEP_UP_REQUIRED", "Step-up verification expired - request a fresh code");
        } catch (JwtService.TokenInvalidException e) {
            throw new AppException(403, "STEP_UP_REQUIRED", "Step-up token is invalid - repeat the verification");
        }
        boolean isStepUp = "step_up".equals(claims.typ);
        boolean isSelf = me.id != null && me.id.equals(claims.sub);
        if (!isStepUp || !isSelf)
            throw new AppException(403, "STEP_UP_REQUIRED", "Step-up token does not cover this account - repeat the verification");
    }
}
