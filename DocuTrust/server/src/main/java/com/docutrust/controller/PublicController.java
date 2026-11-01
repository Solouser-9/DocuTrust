package com.docutrust.controller;

import java.util.Map;

import com.docutrust.http.Ctx;
import com.docutrust.http.Handler;
import com.docutrust.service.ShareService;
import com.docutrust.service.VerifyService;

// Public (no-auth) endpoints: share link metadata/open/download-by-ticket and the verify result page.
public final class PublicController {
    private final ShareService shares;
    private final VerifyService verify;

    public PublicController(ShareService shares, VerifyService verify) {
        this.shares = shares;
        this.verify = verify;
    }

    public Handler shareInfo() {
        return ctx -> ctx.ok(shares.publicGet(ctx.param("token")));
    }

    public Handler shareOpen() {
        return ctx -> ctx.ok(shares.publicOpen(ctx.param("token"), Ctx.str(ctx.json(), "passcode"), ctx.ip()));
    }

    public Handler shareRequestOtp() {
        return ctx -> {
            ShareService.ShareOtpResult r = shares.requestShareOtp(ctx.param("token"), Ctx.str(ctx.json(), "email"), ctx.ip());
            if (r.devCode() != null) ctx.ok(r.body(), Map.of("X-Dev-OTP", r.devCode()));
            else ctx.ok(r.body());
        };
    }

    public Handler shareOpenWithOtp() {
        return ctx -> ctx.ok(shares.openWithOtp(ctx.param("token"), Ctx.str(ctx.json(), "email"),
                Ctx.str(ctx.json(), "code"), Ctx.str(ctx.json(), "passcode"), ctx.ip()));
    }

    public Handler download() {
        return ctx -> {
            var file = shares.downloadByTicket(ctx.param("ticket"), ctx.ip());
            ctx.bytes(200, file.contentType() == null ? "application/octet-stream" : file.contentType(),
                    file.data(), Map.of("Content-Disposition", "attachment; filename=\"" + file.filename() + "\""));
        };
    }

    public Handler verifyToken() {
        return ctx -> {
            String accept = ctx.header("Accept");
            boolean wantsHtml = accept != null && accept.contains("text/html");
            if (wantsHtml) {
                ctx.html(200, verify.htmlPage(ctx.param("token")));
            } else {
                ctx.ok(verify.publicVerify(ctx.param("token"), false).payload());
            }
        };
    }
}
