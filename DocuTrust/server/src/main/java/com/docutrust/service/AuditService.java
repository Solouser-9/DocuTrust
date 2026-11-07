package com.docutrust.service;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.docutrust.db.Database;
import com.docutrust.db.Rows;
import com.docutrust.model.Models;
import com.docutrust.util.Json;

// Append-only platform audit trail: insert helper (never throws) + admin browse with filters.
public final class AuditService {
    private final Database db;

    public AuditService(Database db) { this.db = db; }

    public void insert(Connection c, UUID actorId, String action, String entityType, String entityId,
                       String ip, String userAgent, Map<String, Object> meta) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(
                "INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, ip, user_agent, meta) VALUES (?,?,?,?,?,?, CAST(? AS jsonb))")) {
            ps.setObject(1, actorId);
            ps.setString(2, action);
            ps.setString(3, entityType);
            ps.setObject(4, entityId == null ? null : UUID.fromString(entityId));
            ps.setString(5, ip);
            ps.setString(6, userAgent);
            ps.setString(7, Json.write(meta == null ? Map.of() : meta));
            ps.executeUpdate();
        }
    }

    public void insert(UUID actorId, String action, String entityType, String entityId,
                       String ip, String userAgent, Map<String, Object> meta) {
        try {
            db.tx(c -> { insert(c, actorId, action, entityType, entityId, ip, userAgent, meta); return null; });
        } catch (Exception e) {
            System.err.println("[audit] insert failed: " + e.getMessage());
        }
    }

    public Models.Page<Models.AuditLog> browse(String action, String search, int page, int limit) {
        StringBuilder where = new StringBuilder(" WHERE 1=1");
        List<Object> args = new ArrayList<>();
        if (action != null && !action.isBlank()) {
            where.append(" AND action = ?");
            args.add(action.trim());
        }
        if (search != null && !search.isBlank()) {
            where.append(" AND (action ILIKE ? OR ip ILIKE ? OR user_agent ILIKE ? OR entity_id::text ILIKE ?)");
            String like = "%" + escape(search) + "%";
            for (int i = 0; i < 4; i++) args.add(like);
        }
        return db.with(c -> {
            long total;
            try (PreparedStatement ps = c.prepareStatement("SELECT COUNT(*) FROM audit_logs" + where)) {
                bind(ps, args);
                try (ResultSet rs = ps.executeQuery()) { rs.next(); total = rs.getLong(1); }
            }
            List<Models.AuditLog> items = new ArrayList<>();
            try (PreparedStatement ps = c.prepareStatement(
                    "SELECT * FROM audit_logs" + where + " ORDER BY id DESC LIMIT ? OFFSET ?")) {
                List<Object> all = new ArrayList<>(args);
                all.add(limit);
                all.add((page - 1) * limit);
                bind(ps, all);
                try (ResultSet rs = ps.executeQuery()) { while (rs.next()) items.add(Rows.audit(rs)); }
            }
            return new Models.Page<>(items, page, limit, total);
        });
    }

    private static void bind(PreparedStatement ps, List<Object> args) throws SQLException {
        for (int i = 0; i < args.size(); i++) ps.setObject(i + 1, args.get(i));
    }

    static String escape(String s) {
        return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
