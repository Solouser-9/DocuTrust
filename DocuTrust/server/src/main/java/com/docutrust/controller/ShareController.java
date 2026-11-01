package com.docutrust.controller;

import com.docutrust.http.Handler;
import com.docutrust.service.ShareService;

// Thin share endpoints: owner views (mine/incoming/stats/CRUD) — public routes live in PublicController.
public final class ShareController {
    private final ShareService shares;

    public ShareController(ShareService shares) { this.shares = shares; }

    public Handler mine() {
        return ctx -> ctx.ok(shares.mine(ctx.user));
    }

    public Handler create() {
        return ctx -> ctx.created(shares.create(ctx.user, ctx.json(), ctx.ip()));
    }

    public Handler revoke() {
        return ctx -> ctx.ok(shares.revoke(ctx.user, ctx.uuidParam("id"), ctx.ip()));
    }

    public Handler delete() {
        return ctx -> ctx.ok(shares.delete(ctx.user, ctx.uuidParam("id"), ctx.ip()));
    }

    public Handler stats() {
        return ctx -> ctx.ok(shares.stats(ctx.user, ctx.uuidParam("id")));
    }

    public Handler incoming() {
        return ctx -> ctx.ok(shares.incoming(ctx.user));
    }
}
