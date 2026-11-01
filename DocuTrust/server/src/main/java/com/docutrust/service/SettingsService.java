package com.docutrust.service;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.Map;
import java.util.UUID;

import com.docutrust.db.Database;
import com.docutrust.db.Rows;
import com.docutrust.model.Models;
import com.docutrust.util.Json;

// Per-user notification preferences: read (with defaults) and upsert.
public final class SettingsService {
    private final Database db;

    public SettingsService(Database db) { this.db = db; }

    public Models.Settings get(UUID userId) {
        return db.with(c -> read(c, userId));
    }

    /** C-1: single-connection read, shared by get() and upsert()'s transaction - never opens a second connection. */
    private static Models.Settings read(Connection c, UUID userId) throws Exception {
        try (PreparedStatement ps = c.prepareStatement("SELECT * FROM settings WHERE user_id = ?")) {
            ps.setObject(1, userId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return Rows.settings(rs);
            }
        }
        Models.Settings s = new Models.Settings();
        s.userId = userId.toString();
        return s;
    }

    public Models.Settings upsert(UUID userId, Map<String, Object> b) {
        Boolean expiry = CtxBool(b, "expiryAlerts");
        Boolean share = CtxBool(b, "shareAlerts");
        Boolean verification = CtxBool(b, "verificationAlerts");
        Boolean admin = CtxBool(b, "adminAlerts");
        Integer offset = com.docutrust.http.Ctx.intVal(b, "reminderOffsetDays");
        return db.tx(c -> {
            // C-7: on a fresh INSERT a missing field must fall back to the documented default
            // (TRUE / 14) instead of NULL - expiry_alerts and friends are NOT NULL columns,
            // so a partial update like {"shareAlerts":true} used to 500. The ON CONFLICT
            // branch below keeps existing values for users who already have a row.
            try (PreparedStatement ps = c.prepareStatement(
                    "INSERT INTO settings (user_id, expiry_alerts, share_alerts, verification_alerts, admin_alerts, reminder_offset_days) "
                            + "VALUES (?, COALESCE(?, TRUE), COALESCE(?, TRUE), COALESCE(?, TRUE), COALESCE(?, TRUE), COALESCE(?, 14)) "
                            + "ON CONFLICT (user_id) DO UPDATE SET expiry_alerts = COALESCE(?, settings.expiry_alerts), "
                            + "share_alerts = COALESCE(?, settings.share_alerts), verification_alerts = COALESCE(?, settings.verification_alerts), "
                            + "admin_alerts = COALESCE(?, settings.admin_alerts), reminder_offset_days = COALESCE(?, settings.reminder_offset_days)")) {
                ps.setObject(1, userId);
                ps.setObject(2, expiry);
                ps.setObject(3, share);
                ps.setObject(4, verification);
                ps.setObject(5, admin);
                ps.setObject(6, offset);
                ps.setObject(7, expiry);
                ps.setObject(8, share);
                ps.setObject(9, verification);
                ps.setObject(10, admin);
                ps.setObject(11, offset);
                ps.executeUpdate();
            }
            return read(c, userId); // C-1: same connection/tx - the old get(userId) call opened a second pool connection inside this tx
        });
    }

    private static Boolean CtxBool(Map<String, Object> b, String key) { return com.docutrust.http.Ctx.boolVal(b, key); }

    static { Json.write(Map.of()); } // keep import stable
}
