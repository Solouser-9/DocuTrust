package com.docutrust.controller;

import java.util.Map;

import com.docutrust.http.Handler;
import com.docutrust.service.AdminService;

// Thin admin endpoints (route layer enforces role=admin): stats, review queue, users, documents, audit.
public final class AdminController {
    private final AdminService admin;

    public AdminController(AdminService admin) { this.admin = admin; }

    public Handler stats() {
        return ctx -> ctx.ok(admin.stats());
    }

    public Handler reviewQueue() {
        return ctx -> ctx.okPage(admin.reviewQueue(ctx.q("status"), ctx.page(), ctx.limit()));
    }

    public Handler decision() {
        return ctx -> ctx.ok(admin.decision(ctx.user, ctx.uuidParam("id"), ctx.json(), ctx.ip()));
    }

    public Handler users() {
        return ctx -> ctx.okPage(admin.users(ctx.q("search"), ctx.q("role"), ctx.q("status"), ctx.page(), ctx.limit()));
    }

    public Handler setUserStatus() {
        return ctx -> ctx.ok(Map.of("user", admin.setUserStatus(ctx.user, ctx.uuidParam("id"), ctx.json(), ctx.ip()).toMap()));
    }

    public Handler documents() {
        return ctx -> ctx.okPage(admin.documents(ctx.q("search"), ctx.q("status"), ctx.page(), ctx.limit()));
    }

    public Handler auditLogs() {
        return ctx -> ctx.okPage(admin.auditLogs(ctx.q("action"), ctx.q("search"), ctx.page(), ctx.limit()));
    }
}
