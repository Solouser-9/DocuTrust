package com.docutrust.controller;

import java.util.Map;
import java.util.UUID;

import com.docutrust.http.Ctx;
import com.docutrust.http.Handler;
import com.docutrust.service.AuthService;
import com.docutrust.service.MailService;
import com.docutrust.service.StepUpService;
import com.docutrust.util.Json;

// Thin auth endpoints: parse -> service -> respond. OTP flows surface their code via the
// X-Dev-OTP response header in MAIL_MODE=dev so demos and the e2e suite stay testable -
// in live mode nothing but the actual email ever carries the code.
public final class AuthController {
    private final AuthService auth;
    private final StepUpService stepUps;
    private final MailService mail;

    public AuthController(AuthService auth, StepUpService stepUps, MailService mail) {
        this.auth = auth;
        this.stepUps = stepUps;
        this.mail = mail;
    }

    public Handler register() {
        return ctx -> ctx.created(auth.register(ctx.json(), ctx.ip(), ctx.userAgent()));
    }

    public Handler login() {
        return ctx -> {
            AuthService.LoginResult r = auth.login(ctx.json(), ctx.ip(), ctx.userAgent());
            if (r.mfaChallenge() != null) {
                // Email MFA challenge (Phase 4): 440 with the challenge token the client echoes to /api/auth/verify-otp.
                if (r.devOtp() != null) ctx.raw(440, "application/json; charset=utf-8",
                        Json.write(Json.obj("ok", false,
                                "error", Json.obj("code", "MFA_EMAIL_CHALLENGE",
                                        "message", "A 6-digit code was emailed to you - POST it with the challenge to /api/auth/verify-otp"),
                                "challenge", r.mfaChallenge(), "email", r.maskedEmail())).getBytes(),
                        Map.of("X-Dev-OTP", r.devOtp()));
                else
                    ctx.respondMap(440, Json.obj("ok", false,
                            "error", Json.obj("code", "MFA_EMAIL_CHALLENGE",
                                    "message", "A 6-digit code was emailed to you - POST it with the challenge to /api/auth/verify-otp"),
                            "challenge", r.mfaChallenge(), "email", r.maskedEmail()));
                return;
            }
            ctx.ok(r.body());
        };
    }

    public Handler verifyOtp() {
        return ctx -> ctx.ok(auth.verifyOtp(Ctx.str(ctx.json(), "challenge"), Ctx.str(ctx.json(), "code"), ctx.ip(), ctx.userAgent()));
    }

    public Handler refresh() {
        return ctx -> ctx.ok(auth.refresh(ctx.json(), ctx.ip(), ctx.userAgent()));
    }

    public Handler logout() {
        return ctx -> { auth.logout(ctx.json()); ctx.noContent(); };
    }

    public Handler forgotPassword() {
        return ctx -> {
            AuthService.ForgotResult r = auth.forgotPassword(ctx.json(), ctx.ip());
            if (r.devOtp() != null && mail.devMode())
                ctx.ok(r.body(), Map.of("X-Dev-OTP", r.devOtp()));
            else
                ctx.ok(r.body());
        };
    }

    public Handler resetPasswordOtp() {
        return ctx -> { auth.resetPasswordOtp(ctx.json(), ctx.ip()); ctx.noContent(); };
    }

    public Handler requestStepUp() {
        return ctx -> {
            StepUpService.RequestResult r = stepUps.request(ctx.user, ctx.ip());
            if (r.devCode() != null) ctx.ok(r.body(), Map.of("X-Dev-OTP", r.devCode()));
            else ctx.ok(r.body());
        };
    }

    public Handler verifyStepUp() {
        return ctx -> ctx.ok(stepUps.verify(ctx.user, Ctx.str(ctx.json(), "code"), ctx.ip()));
    }

    public Handler verifyEmail() {
        return ctx -> ctx.ok(auth.verifyEmail(ctx.q("token")));
    }

    public Handler me() {
        return ctx -> ctx.ok(Map.of("user", auth.get(UUID.fromString(ctx.user.id)).toMap()));
    }

    public Handler updateMe() {
        return ctx -> ctx.ok(Map.of("user", auth.updateMe(UUID.fromString(ctx.user.id), ctx.json())));
    }

    public Handler changePassword() {
        return ctx -> {
            auth.changePassword(UUID.fromString(ctx.user.id), ctx.json(), ctx.header(StepUpService.HEADER), ctx.ip());
            ctx.noContent();
        };
    }

    public Handler mfaSetup() {
        return ctx -> ctx.ok(auth.mfaSetup(UUID.fromString(ctx.user.id), ctx.user.email));
    }

    public Handler mfaEnable() {
        return ctx -> ctx.ok(auth.mfaEnable(UUID.fromString(ctx.user.id), ctx.json()));
    }

    public Handler mfaDisable() {
        return ctx -> ctx.ok(auth.mfaDisable(UUID.fromString(ctx.user.id), ctx.json()));
    }
}
