package com.docutrust.controller;

import com.docutrust.http.Handler;
import com.docutrust.service.VerifyService;

// Thin verification endpoints: request lifecycle + listing (public verify lives in PublicController).
public final class VerificationController {
    private final VerifyService verification;

    public VerificationController(VerifyService verification) { this.verification = verification; }

    public Handler create() {
        return ctx -> ctx.created(verification.create(ctx.user, ctx.json(), ctx.ip()));
    }

    public Handler list() {
        return ctx -> ctx.ok(verification.list(ctx.user));
    }

    public Handler detail() {
        return ctx -> ctx.ok(verification.detail(ctx.user, ctx.uuidParam("id")));
    }

    public Handler approve() {
        return ctx -> ctx.ok(verification.decide(ctx.user, ctx.uuidParam("id"), true, ctx.ip()));
    }

    public Handler reject() {
        return ctx -> ctx.ok(verification.decide(ctx.user, ctx.uuidParam("id"), false, ctx.ip()));
    }
}
