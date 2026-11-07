package com.docutrust.service;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.docutrust.AppException;
import com.docutrust.db.Database;
import com.docutrust.db.Rows;
import com.docutrust.http.Ctx;
import com.docutrust.model.Models;
import com.docutrust.util.Json;
import com.docutrust.util.Validator;

// Folder CRUD with per-owner duplicate protection; deleting a folder keeps its documents (folder_id NULL).
public final class FolderService {
    private final Database db;
    private final AuditService audit;
    private final DocumentService documents;

    public FolderService(Database db, AuditService audit, DocumentService documents) {
        this.db = db;
        this.audit = audit;
        this.documents = documents;
    }

    public List<Models.Folder> list(Models.User me) {
        return db.with(c -> {
            List<Models.Folder> out = new ArrayList<>();
            try (PreparedStatement ps = c.prepareStatement(
                    "SELECT f.*, (SELECT COUNT(*) FROM documents d WHERE d.folder_id = f.id AND d.deleted_at IS NULL) AS doc_count "
                            + "FROM folders f WHERE f.owner_id = ? ORDER BY f.created_at ASC")) {
                ps.setObject(1, UUID.fromString(me.id));
                try (ResultSet rs = ps.executeQuery()) { while (rs.next()) out.add(Rows.folder(rs)); }
            }
            return out;
        });
    }

    public Models.Folder create(Models.User me, Map<String, Object> b, String ip) {
        String name = Validator.required(Ctx.str(b, "name"), "name", 120);
        String rawParent = Ctx.str(b, "parentId");
        final UUID parent = rawParent == null || rawParent.isBlank() ? null : DocumentService.parseUuid(rawParent, "parentId");
        if (parent != null) {
            // contract: single level - parents must be top-level themselves
            int parents = db.with(c -> {
                try (PreparedStatement ps = c.prepareStatement("SELECT parent_id FROM folders WHERE id = ? AND owner_id = ?")) {
                    ps.setObject(1, parent);
                    ps.setObject(2, UUID.fromString(me.id));
                    try (ResultSet rs = ps.executeQuery()) {
                        if (!rs.next()) throw AppException.notFound("Parent folder not found");
                        return rs.getString("parent_id") == null ? 0 : 1;
                    }
                }
            });
            if (parents > 0) throw AppException.validation("parentId", "Folders support a single level of nesting");
        }
        try {
            return db.tx(c -> {
                UUID id = UUID.randomUUID();
                try (PreparedStatement ps = c.prepareStatement("INSERT INTO folders (id, owner_id, parent_id, name) VALUES (?,?,?,?)")) {
                    ps.setObject(1, id);
                    ps.setObject(2, UUID.fromString(me.id));
                    ps.setObject(3, parent);
                    ps.setString(4, name);
                    ps.executeUpdate();
                }
                audit.insert(c, UUID.fromString(me.id), "folder.created", "folder", id.toString(), ip, null, Json.obj("name", name));
                return fetchOwned(c, UUID.fromString(me.id), id);
            });
        } catch (AppException e) {
            throw e;
        } catch (RuntimeException e) {
            if (isUniqueViolation(e)) throw AppException.conflict("A folder with this name already exists");
            throw e;
        }
    }

    public Models.Folder rename(Models.User me, UUID folderId, Map<String, Object> b, String ip) {
        String name = Validator.required(Ctx.str(b, "name"), "name", 120);
        try {
            return db.tx(c -> {
                int n;
                try (PreparedStatement ps = c.prepareStatement("UPDATE folders SET name = ? WHERE id = ? AND owner_id = ?")) {
                    ps.setString(1, name);
                    ps.setObject(2, folderId);
                    ps.setObject(3, UUID.fromString(me.id));
                    n = ps.executeUpdate();
                }
                if (n == 0) throw AppException.notFound("Folder not found");
                audit.insert(c, UUID.fromString(me.id), "folder.renamed", "folder", folderId.toString(), ip, null, Json.obj("name", name));
                return fetchOwned(c, UUID.fromString(me.id), folderId);
            });
        } catch (AppException e) {
            throw e;
        } catch (RuntimeException e) {
            if (isUniqueViolation(e)) throw AppException.conflict("A folder with this name already exists");
            throw e;
        }
    }

    public Map<String, Object> delete(Models.User me, UUID folderId, String ip) {
        db.tx(c -> {
            int n;
            try (PreparedStatement ps = c.prepareStatement("DELETE FROM folders WHERE id = ? AND owner_id = ?")) {
                ps.setObject(1, folderId);
                ps.setObject(2, UUID.fromString(me.id));
                n = ps.executeUpdate();
            }
            if (n == 0) throw AppException.notFound("Folder not found");
            audit.insert(c, UUID.fromString(me.id), "folder.deleted", "folder", folderId.toString(), ip, null, Json.obj());
            return null;
        });
        return Json.obj("deleted", true, "id", folderId.toString());
    }

    public Models.Page<Models.Document> documents(Models.User me, UUID folderId, int page, int limit) {
        return db.with(c -> {
            fetchOwned(c, UUID.fromString(me.id), folderId);
            long total;
            try (PreparedStatement ps = c.prepareStatement(
                    "SELECT COUNT(*) FROM documents WHERE folder_id = ? AND owner_id = ? AND deleted_at IS NULL")) {
                ps.setObject(1, folderId);
                ps.setObject(2, UUID.fromString(me.id));
                try (ResultSet rs = ps.executeQuery()) { rs.next(); total = rs.getLong(1); }
            }
            List<Models.Document> items = new ArrayList<>();
            try (PreparedStatement ps = c.prepareStatement(
                    "SELECT * FROM documents WHERE folder_id = ? AND owner_id = ? AND deleted_at IS NULL "
                            + "ORDER BY created_at DESC LIMIT ? OFFSET ?")) {
                ps.setObject(1, folderId);
                ps.setObject(2, UUID.fromString(me.id));
                ps.setInt(3, limit);
                ps.setInt(4, (page - 1) * limit);
                try (ResultSet rs = ps.executeQuery()) { while (rs.next()) items.add(Rows.document(rs)); }
            }
            return new Models.Page<>(items, page, limit, total);
        });
    }

    private Models.Folder fetchOwned(java.sql.Connection c, UUID ownerId, UUID folderId) throws Exception {
        try (PreparedStatement ps = c.prepareStatement("SELECT * FROM folders WHERE id = ? AND owner_id = ?")) {
            ps.setObject(1, folderId);
            ps.setObject(2, ownerId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) throw AppException.notFound("Folder not found");
                return Rows.folder(rs);
            }
        }
    }

    private static boolean isUniqueViolation(Throwable t) {
        while (t != null) {
            if (t instanceof SQLException se && "23505".equals(se.getSQLState())) return true;
            t = t.getCause();
        }
        return false;
    }
}
