package com.docutrust.service;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import com.docutrust.db.Database;
import com.docutrust.db.Rows;
import com.docutrust.model.Models;

// In-app notification inbox plus insert helper that honours per-user notification preferences.
public final class NotificationService {
    private final Database db;

    public NotificationService(Database db) { this.db = db; }

    public void notify(Connection c, UUID userId, String type, String title, String body,
                       String entityType, String entityId) throws SQLException {
        if (userId == null || !enabled(c, userId, type)) return;
        try (PreparedStatement ps = c.prepareStatement(
                "INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id) VALUES (?,?,?,?,?,?)")) {
            ps.setObject(1, userId);
            ps.setString(2, type);
            ps.setString(3, title);
            ps.setString(4, body);
            ps.setString(5, entityType);
            ps.setObject(6, entityId == null ? null : UUID.fromString(entityId));
            ps.executeUpdate();
        }
    }

    public void notifyAsync(UUID userId, String type, String title, String body, String entityType, String entityId) {
        try {
            db.tx(c -> { notify(c, userId, type, title, body, entityType, entityId); return null; });
        } catch (Exception ignored) { }
    }

    private static boolean enabled(Connection c, UUID userId, String type) throws SQLException {
        String column = type.startsWith("expiry") || type.startsWith("document_expired") ? "expiry_alerts"
                : type.startsWith("share") ? "share_alerts"
                : type.startsWith("verification") ? "verification_alerts"
                : "admin_alerts";
        try (PreparedStatement ps = c.prepareStatement("SELECT " + column + " FROM settings WHERE user_id = ?")) {
            ps.setObject(1, userId);
            try (ResultSet rs = ps.executeQuery()) { return !rs.next() || rs.getBoolean(1); }
        }
    }

    public long unreadCount(UUID userId) {
        return db.with(c -> {
            try (PreparedStatement ps = c.prepareStatement("SELECT COUNT(*) FROM notifications WHERE user_id = ? AND read_at IS NULL")) {
                ps.setObject(1, userId);
                try (ResultSet rs = ps.executeQuery()) { rs.next(); return rs.getLong(1); }
            }
        });
    }

    public Models.Page<Models.Notification> list(UUID userId, boolean unreadOnly, int page, int limit) {
        String where = " WHERE user_id = ?" + (unreadOnly ? " AND read_at IS NULL" : "");
        return db.with(c -> {
            long total;
            try (PreparedStatement ps = c.prepareStatement("SELECT COUNT(*) FROM notifications" + where)) {
                ps.setObject(1, userId);
                try (ResultSet rs = ps.executeQuery()) { rs.next(); total = rs.getLong(1); }
            }
            List<Models.Notification> items = new ArrayList<>();
            try (PreparedStatement ps = c.prepareStatement(
                    "SELECT * FROM notifications" + where + " ORDER BY id DESC LIMIT ? OFFSET ?")) {
                ps.setObject(1, userId);
                ps.setInt(2, limit);
                ps.setInt(3, (page - 1) * limit);
                try (ResultSet rs = ps.executeQuery()) { while (rs.next()) items.add(Rows.notification(rs)); }
            }
            return new Models.Page<>(items, page, limit, total);
        });
    }

    public boolean markRead(UUID userId, long id) {
        return db.tx(c -> {
            try (PreparedStatement ps = c.prepareStatement("UPDATE notifications SET read_at = now() WHERE id = ? AND user_id = ? AND read_at IS NULL")) {
                ps.setLong(1, id);
                ps.setObject(2, userId);
                return ps.executeUpdate() > 0;
            }
        });
    }

    public void markAllRead(UUID userId) {
        db.tx(c -> {
            try (PreparedStatement ps = c.prepareStatement("UPDATE notifications SET read_at = now() WHERE user_id = ? AND read_at IS NULL")) {
                ps.setObject(1, userId);
                ps.executeUpdate();
            }
            return null;
        });
    }
}
