package com.docutrust.controller;

import java.util.UUID;

import com.docutrust.http.Handler;
import com.docutrust.service.NotificationService;
import com.docutrust.service.SettingsService;

// Thin notification inbox + preference endpoints.
public final class NotificationController {
    private final NotificationService notifications;
    private final SettingsService settings;

    public NotificationController(NotificationService notifications, SettingsService settings) {
        this.notifications = notifications;
        this.settings = settings;
    }

    public Handler list() {
        return ctx -> {
            boolean unreadOnly = "true".equalsIgnoreCase(ctx.q("unread", "false"));
            var page = notifications.list(UUID.fromString(ctx.user.id), unreadOnly, ctx.page(), ctx.limit());
            ctx.okPage(page, com.docutrust.util.Json.obj("unreadCount", notifications.unreadCount(UUID.fromString(ctx.user.id))));
        };
    }

    public Handler markRead() {
        return ctx -> {
            long id;
            try { id = Long.parseLong(ctx.param("id")); }
            catch (NumberFormatException e) { throw com.docutrust.AppException.notFound("Notification not found"); }
            boolean read = notifications.markRead(UUID.fromString(ctx.user.id), id);
            ctx.ok(com.docutrust.util.Json.obj("read", read, "id", id));
        };
    }

    public Handler markAllRead() {
        return ctx -> {
            notifications.markAllRead(UUID.fromString(ctx.user.id));
            ctx.ok(com.docutrust.util.Json.obj("read", true));
        };
    }

    public Handler getSettings() {
        return ctx -> ctx.ok(settings.get(UUID.fromString(ctx.user.id)).toMap());
    }

    public Handler putSettings() {
        return ctx -> ctx.ok(settings.upsert(UUID.fromString(ctx.user.id), ctx.json()).toMap());
    }
}
