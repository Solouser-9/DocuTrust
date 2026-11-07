package com.docutrust.service;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import com.docutrust.db.Database;

// Background job (60s tick): active -> expiring -> expired document transitions plus verification
// request expiry. Notifications are sent at most once per document per day per type.
public final class ExpiryScheduler {
    private final Database db;
    private final NotificationService notifications;
    private ScheduledExecutorService executor;
    private volatile boolean running;

    public ExpiryScheduler(Database db, NotificationService notifications) {
        this.db = db;
        this.notifications = notifications;
    }

    public void start() {
        executor = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "expiry-scheduler");
            t.setDaemon(true);
            return t;
        });
        running = true;
        executor.scheduleWithFixedDelay(this::tick, 15, 60, TimeUnit.SECONDS);
        System.out.println("[scheduler] expiry scheduler started (60s tick)");
    }

    public void stop() {
        running = false;
        if (executor != null) executor.shutdownNow();
    }

    public boolean isRunning() { return running; }

    void tick() {
        try {
            markExpiring();
        } catch (Exception e) {
            System.err.println("[scheduler] expiring pass failed: " + e);
        }
        try {
            markExpired();
        } catch (Exception e) {
            System.err.println("[scheduler] expired pass failed: " + e);
        }
        try {
            expireVerifications();
        } catch (Exception e) {
            System.err.println("[scheduler] verification expiry pass failed: " + e);
        }
    }

    private void markExpiring() {
        db.tx(c -> {
            int n = 0;
            try (PreparedStatement ps = c.prepareStatement(
                    "UPDATE documents SET status = 'expiring' WHERE status = 'active' AND deleted_at IS NULL "
                            + "AND expires_at IS NOT NULL AND expires_at <= CURRENT_DATE + reminder_days "
                            + "RETURNING id, owner_id, title")) {
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        UUID docId = UUID.fromString(rs.getString("id"));
                        UUID ownerId = UUID.fromString(rs.getString("owner_id"));
                        String title = rs.getString("title");
                        if (notifyOncePerDay(c, ownerId, "expiry_warning", docId)) {
                            notifications.notify(c, ownerId, "expiry_warning", "Document expiring soon",
                                    "'" + title + "' is approaching its expiry date", "document", docId.toString());
                        }
                        n++;
                    }
                }
            }
            if (n > 0) System.out.println("[scheduler] marked " + n + " document(s) expiring");
            return null;
        });
    }

    private void markExpired() {
        db.tx(c -> {
            int n = 0;
            try (PreparedStatement ps = c.prepareStatement(
                    "UPDATE documents SET status = 'expired' WHERE status IN ('active','expiring') AND deleted_at IS NULL "
                            + "AND expires_at IS NOT NULL AND expires_at < CURRENT_DATE "
                            + "RETURNING id, owner_id, title")) {
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        UUID docId = UUID.fromString(rs.getString("id"));
                        UUID ownerId = UUID.fromString(rs.getString("owner_id"));
                        String title = rs.getString("title");
                        if (notifyOncePerDay(c, ownerId, "document_expired", docId)) {
                            notifications.notify(c, ownerId, "document_expired", "Document expired",
                                    "'" + title + "' has passed its expiry date", "document", docId.toString());
                        }
                        n++;
                    }
                }
            }
            if (n > 0) System.out.println("[scheduler] marked " + n + " document(s) expired");
            return null;
        });
    }

    private void expireVerifications() {
        int n = db.tx(c -> {
            try (PreparedStatement ps = c.prepareStatement(
                    "UPDATE verification_requests SET status = 'expired' WHERE status = 'approved' AND expires_at < now()")) {
                return ps.executeUpdate();
            }
        });
        if (n > 0) System.out.println("[scheduler] expired " + n + " verification request(s)");
    }

    /** True when no notification of this type exists today for the document (once per doc per day). */
    private boolean notifyOncePerDay(java.sql.Connection c, UUID userId, String type, UUID docId) throws Exception {
        try (PreparedStatement ps = c.prepareStatement(
                "SELECT 1 FROM notifications WHERE user_id = ? AND type = ? AND entity_id = ? AND created_at::date = CURRENT_DATE LIMIT 1")) {
            ps.setObject(1, userId);
            ps.setString(2, type);
            ps.setObject(3, docId);
            try (ResultSet rs = ps.executeQuery()) { return !rs.next(); }
        }
    }
}
