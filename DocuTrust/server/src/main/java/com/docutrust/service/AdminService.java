package com.docutrust.service;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.docutrust.AppException;
import com.docutrust.auth.TokenService;
import com.docutrust.db.Database;
import com.docutrust.db.Rows;
import com.docutrust.http.Ctx;
import com.docutrust.model.Models;
import com.docutrust.util.Json;
import com.docutrust.util.Validator;

// Admin domain: dashboard stats, sensitive-document review queue with decisions, user directory,
// user status control, platform documents and audit browsing.
public final class AdminService {
    private final Database db;
    private final TokenService tokens;
    private final AuditService audit;
    private final NotificationService notifications;

    public AdminService(Database db, TokenService tokens, AuditService audit, NotificationService notifications) {
        this.db = db;
        this.tokens = tokens;
        this.audit = audit;
        this.notifications = notifications;
    }

    public Map<String, Object> stats() {
        return db.with(c -> {
            Map<String, Object> out = new LinkedHashMap<>();
            try (PreparedStatement ps = c.prepareStatement("SELECT * FROM v_admin_stats");
                 ResultSet rs = ps.executeQuery()) {
                rs.next();
                out.put("totalUsers", rs.getLong("total_users"));
                out.put("pendingUsers", rs.getLong("pending_users"));
                out.put("totalOrgs", rs.getLong("total_orgs"));
                out.put("totalDocuments", rs.getLong("total_documents"));
                out.put("queueDocuments", rs.getLong("queue_documents"));
                out.put("activeShares", rs.getLong("active_shares"));
                out.put("pendingVerifications", rs.getLong("pending_verifications"));
            }
            return out;
        });
    }

    public Models.Page<Models.AdminReview> reviewQueue(String status, int page, int limit) {
        String st = status == null || status.isBlank() ? "pending"
                : Validator.oneOf(status, "status", "pending", "approved", "rejected", "escalated");
        String where = " WHERE r.status = ?";
        return db.with(c -> {
            long total;
            try (PreparedStatement ps = c.prepareStatement("SELECT COUNT(*) FROM admin_reviews r" + where)) {
                ps.setString(1, st);
                try (ResultSet rs = ps.executeQuery()) { rs.next(); total = rs.getLong(1); }
            }
            List<Models.AdminReview> items = new ArrayList<>();
            try (PreparedStatement ps = c.prepareStatement(
                    "SELECT r.*, d.title AS target_title, d.doc_type, d.sha256 AS sha256, u.email AS submitter_email "
                            + "FROM admin_reviews r LEFT JOIN documents d ON d.id = r.target_id "
                            + "LEFT JOIN users u ON u.id = r.submitted_by"
                            + where + " ORDER BY r.created_at ASC LIMIT ? OFFSET ?")) {
                ps.setString(1, st);
                ps.setInt(2, limit);
                ps.setInt(3, (page - 1) * limit);
                try (ResultSet rs = ps.executeQuery()) { while (rs.next()) items.add(Rows.review(rs)); }
            }
            return new Models.Page<>(items, page, limit, total);
        });
    }

    public Map<String, Object> decision(Models.User admin, UUID reviewId, Map<String, Object> b, String ip) {
        String status = Validator.oneOf(Ctx.str(b, "status"), "status", "approved", "rejected", "escalated");
        String note = Validator.optional(Ctx.str(b, "note"), "note", 500);
        return db.tx(c -> {
            String targetType = null, targetId = null, previousStatus = null;
            try (PreparedStatement ps = c.prepareStatement(
                    "UPDATE admin_reviews SET status = ?, decision_note = ?, reviewer_id = ?, reviewed_at = now() "
                            + "WHERE id = ? AND status = 'pending' RETURNING target_type, target_id")) {
                ps.setString(1, status);
                ps.setString(2, note);
                ps.setObject(3, UUID.fromString(admin.id));
                ps.setObject(4, reviewId);
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) throw AppException.notFound("Review not found or already decided");
                    targetType = rs.getString("target_type");
                    targetId = Rows.str(rs, "target_id");
                }
            }
            if ("document".equals(targetType) && targetId != null) {
                UUID docId = UUID.fromString(targetId);
                Models.Document d = fetchDoc(c, docId);
                if ("approved".equals(status)) {
                    // schema CHECK: sensitive docs may only be 'active' while review_status = 'submitted';
                    // the decision itself lives in admin_reviews
                    try (PreparedStatement ps = c.prepareStatement("UPDATE documents SET status = 'active' WHERE id = ?")) {
                        ps.setObject(1, docId);
                        ps.executeUpdate();
                    }
                    notifications.notify(c, UUID.fromString(d.ownerId), "admin_decision", "Document approved",
                            "'" + d.title + "' passed the admin review and is now active" + (note == null ? "" : " - " + note),
                            "document", docId.toString());
                } else if ("rejected".equals(status)) {
                    try (PreparedStatement ps = c.prepareStatement(
                            "UPDATE documents SET status = 'archived', review_status = 'rejected' WHERE id = ?")) {
                        ps.setObject(1, docId);
                        ps.executeUpdate();
                    }
                    notifications.notify(c, UUID.fromString(d.ownerId), "admin_decision", "Document rejected",
                            "'" + d.title + "' did not pass the admin review" + (note == null ? "" : " - " + note),
                            "document", docId.toString());
                }
            }
            audit.insert(c, UUID.fromString(admin.id), "admin.review_decision", "admin_review", reviewId.toString(), ip, null,
                    Json.obj("decision", status, "targetType", targetType, "targetId", targetId, "note", note));
            return fetchReview(c, reviewId).toMap();
        });
    }

    public Models.Page<Models.User> users(String search, String role, String status, int page, int limit) {
        StringBuilder where = new StringBuilder(" WHERE 1=1");
        List<Object> args = new ArrayList<>();
        if (search != null && !search.isBlank()) {
            where.append(" AND (u.email ILIKE ? OR u.full_name ILIKE ?)");
            String like = "%" + AuditService.escape(search) + "%";
            args.add(like);
            args.add(like);
        }
        if (role != null && !role.isBlank()) {
            Validator.oneOf(role, "role", "admin", "org_manager", "member");
            where.append(" AND u.role = ?");
            args.add(role);
        }
        if (status != null && !status.isBlank()) {
            Validator.oneOf(status, "status", "pending", "active", "suspended");
            where.append(" AND u.status = ?");
            args.add(status);
        }
        return db.with(c -> {
            long total;
            try (PreparedStatement ps = c.prepareStatement("SELECT COUNT(*) FROM users u" + where)) {
                bind(ps, args);
                try (ResultSet rs = ps.executeQuery()) { rs.next(); total = rs.getLong(1); }
            }
            List<Models.User> items = new ArrayList<>();
            try (PreparedStatement ps = c.prepareStatement(
                    "SELECT u.id, u.org_id, u.email, u.full_name, u.phone, u.role, u.status, u.mfa_enabled, u.email_verified, u.last_login_at, u.created_at, o.name AS org_name "
                            + "FROM users u LEFT JOIN organisations o ON o.id = u.org_id" + where + " ORDER BY u.created_at DESC LIMIT ? OFFSET ?")) {
                List<Object> all = new ArrayList<>(args);
                all.add(limit);
                all.add((page - 1) * limit);
                bind(ps, all);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        Models.User u = Rows.user(rs);
                        u.orgName = Rows.str(rs, "org_name"); // H-3: organisation badge on the admin user screens
                        items.add(u);
                    }
                }
            }
            return new Models.Page<>(items, page, limit, total);
        });
    }

    public Models.User setUserStatus(Models.User admin, UUID userId, Map<String, Object> b, String ip) {
        String status = Validator.oneOf(Ctx.str(b, "status"), "status", "active", "suspended", "pending");
        if (userId.equals(UUID.fromString(admin.id)) && "suspended".equals(status))
            throw AppException.conflict("You cannot suspend your own account");
        return db.tx(c -> {
            String old;
            try (PreparedStatement ps = c.prepareStatement("SELECT status FROM users WHERE id = ?")) {
                ps.setObject(1, userId);
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) throw AppException.notFound("User not found");
                    old = rs.getString(1);
                }
            }
            try (PreparedStatement ps = c.prepareStatement("UPDATE users SET status = ? WHERE id = ?")) {
                ps.setString(1, status);
                ps.setObject(2, userId);
                ps.executeUpdate();
            }
            if ("suspended".equals(status)) tokens.revokeAllForUser(c, userId); // kill sessions immediately
            audit.insert(c, UUID.fromString(admin.id), "admin.user_status_changed", "user", userId.toString(), ip, null,
                    Json.obj("from", old, "to", status));
            return fetchUser(c, userId);
        });
    }

    public Models.Page<Models.Document> documents(String search, String status, int page, int limit) {
        StringBuilder where = new StringBuilder(" WHERE d.deleted_at IS NULL");
        List<Object> args = new ArrayList<>();
        if (search != null && !search.isBlank()) {
            where.append(" AND (d.title ILIKE ? OR u.email ILIKE ?)");
            String like = "%" + AuditService.escape(search) + "%";
            args.add(like);
            args.add(like);
        }
        if (status != null && !status.isBlank()) {
            Validator.oneOf(status, "status", "pending_review", "active", "expiring", "expired", "archived");
            where.append(" AND d.status = ?");
            args.add(status);
        }
        return db.with(c -> {
            long total;
            try (PreparedStatement ps = c.prepareStatement(
                    "SELECT COUNT(*) FROM documents d JOIN users u ON u.id = d.owner_id" + where)) {
                bind(ps, args);
                try (ResultSet rs = ps.executeQuery()) { rs.next(); total = rs.getLong(1); }
            }
            List<Models.Document> items = new ArrayList<>();
            try (PreparedStatement ps = c.prepareStatement(
                    "SELECT d.*, u.email AS owner_email, u.full_name AS owner_name "
                            + "FROM documents d JOIN users u ON u.id = d.owner_id" + where
                            + " ORDER BY d.created_at DESC LIMIT ? OFFSET ?")) {
                List<Object> all = new ArrayList<>(args);
                all.add(limit);
                all.add((page - 1) * limit);
                bind(ps, all);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        Models.Document d = Rows.document(rs);
                        d.ownerEmail = Rows.str(rs, "owner_email");
                        d.ownerName = Rows.str(rs, "owner_name");
                        items.add(d);
                    }
                }
            }
            return new Models.Page<>(items, page, limit, total);
        });
    }

    public Models.Page<Models.AuditLog> auditLogs(String action, String search, int page, int limit) {
        return audit.browse(action, search, page, limit);
    }

    // ---- internals ----
    private Models.Document fetchDoc(java.sql.Connection c, UUID docId) throws Exception {
        try (PreparedStatement ps = c.prepareStatement("SELECT * FROM documents WHERE id = ?")) {
            ps.setObject(1, docId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) throw AppException.notFound("Target document no longer exists");
                return Rows.document(rs);
            }
        }
    }

    private Models.AdminReview fetchReview(java.sql.Connection c, UUID reviewId) throws Exception {
        try (PreparedStatement ps = c.prepareStatement(
                "SELECT r.*, d.title AS target_title, d.doc_type, d.sha256 AS sha256, u.email AS submitter_email "
                        + "FROM admin_reviews r LEFT JOIN documents d ON d.id = r.target_id "
                        + "LEFT JOIN users u ON u.id = r.submitted_by WHERE r.id = ?")) {
            ps.setObject(1, reviewId);
            try (ResultSet rs = ps.executeQuery()) { rs.next(); return Rows.review(rs); }
        }
    }

    private Models.User fetchUser(java.sql.Connection c, UUID userId) throws Exception {
        try (PreparedStatement ps = c.prepareStatement(
                "SELECT id, org_id, email, full_name, phone, role, status, mfa_enabled, email_verified, last_login_at, created_at FROM users WHERE id = ?")) {
            ps.setObject(1, userId);
            try (ResultSet rs = ps.executeQuery()) { rs.next(); return Rows.user(rs); }
        }
    }

    private static void bind(PreparedStatement ps, List<Object> args) throws java.sql.SQLException {
        for (int i = 0; i < args.size(); i++) ps.setObject(i + 1, args.get(i));
    }
}
