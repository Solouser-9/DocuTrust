package com.docutrust.controller;

import com.docutrust.http.Handler;
import com.docutrust.service.OrgService;

// Thin organisation endpoints (admin|org_manager): members, invite, roles, removal, stats.
public final class OrgController {
    private final OrgService org;

    public OrgController(OrgService org) { this.org = org; }

    public Handler members() {
        return ctx -> ctx.ok(org.members(ctx.user));
    }

    public Handler invite() {
        return ctx -> {
            OrgService.InviteResult r = org.invite(ctx.user, ctx.json(), ctx.ip());
            if (r.devCode() != null) ctx.created(r.body(), java.util.Map.of("X-Dev-OTP", r.devCode()));
            else ctx.created(r.body());
        };
    }

    /** Public: invitee claims a pending invite with the emailed OTP + a self-chosen password. */
    public Handler acceptInvite() {
        return ctx -> ctx.ok(org.acceptInvite(ctx.json(), ctx.ip(), ctx.userAgent()));
    }

    public Handler changeRole() {
        return ctx -> ctx.ok(java.util.Map.of("user", org.changeRole(ctx.user, ctx.uuidParam("id"), ctx.json(), ctx.ip()).toMap()));
    }

    public Handler remove() {
        return ctx -> ctx.ok(org.remove(ctx.user, ctx.uuidParam("id"), ctx.ip()));
    }

    public Handler stats() {
        return ctx -> ctx.ok(org.stats(ctx.user));
    }
}
