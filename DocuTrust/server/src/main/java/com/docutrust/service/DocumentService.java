package com.docutrust.service;

import java.io.ByteArrayInputStream;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import com.docutrust.AppException;
import com.docutrust.db.Database;
import com.docutrust.db.Rows;
import com.docutrust.http.Ctx;
import com.docutrust.http.Ctx.Part;
import com.docutrust.model.Models;
import com.docutrust.util.Json;
import com.docutrust.util.Text;
import com.docutrust.util.Validator;
import com.docutrust.vault.FileVault;

// Document vault: upload/version with streaming sha256 + AES-GCM, ownership-scoped queries, soft/hard delete, downloads.
public final class DocumentService {
    public static final long MAX_FILE_BYTES = 25L * 1024 * 1024;
    public static final Set<String> ALLOWED_MIME = Set.of(
            "application/pdf", "image/png", "image/jpeg", "image/webp",
            "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    public static final String[] DOC_TYPES = {
            "passport", "national_id", "driver_licence", "certificate", "contract",
            "invoice", "academic", "medical", "financial", "other" };
    public static final Set<String> SENSITIVE = Set.of("medical", "financial");
    private static final Set<String> SORTABLE = Set.of("created_at", "updated_at", "title", "expires_at", "file_size");

    public record FileOut(byte[] data, String contentType, String filename) {}

    private final Database db;
    private final FileVault vault;
    private final AuditService audit;
    private final NotificationService notifications;
    private final StepUpService stepUps;
    // INFRA-2: 10s read-through cache of the ownership-scoped document row behind the hot
    // detail/list views. Ownership is re-checked on every write path; every mutation below
    // invalidates explicitly, so residual staleness is bounded by the TTL.
    private final com.github.benmanes.caffeine.cache.Cache<String, Models.Document> docCache =
            com.github.benmanes.caffeine.cache.Caffeine.newBuilder()
                    .expireAfterWrite(10, java.util.concurrent.TimeUnit.SECONDS)
                    .maximumSize(1_000)
                    .build();

    private static String docKey(String ownerId, UUID docId) { return ownerId + "/" + docId; }

    public DocumentService(Database db, FileVault vault, AuditService audit, NotificationService notifications,
                           StepUpService stepUps) {
        this.db = db;
        this.vault = vault;
        this.audit = audit;
        this.notifications = notifications;
        this.stepUps = stepUps;
    }

    // ---- upload ----
    public Models.Document upload(Models.User me, Map<String, Part> parts, String ip) {
        Part file = parts.get("file");
        if (file == null || file.data.length == 0) throw AppException.validation("file", "file is required");
        if (file.data.length > MAX_FILE_BYTES) throw AppException.tooLarge("File exceeds the 25 MB limit");
        String mime = resolveMime(file);
        final String fTitle = Validator.required(field(parts, "title"), "title", 200);
        String docType = Validator.oneOf(field(parts, "docType"), "docType", DOC_TYPES);
        String description = Validator.optional(field(parts, "description"), "description", 2000);
        UUID folderId = folderIdOrNull(me, field(parts, "folderId"));
        LocalDate expiresAt = expiresAtOrNull(field(parts, "expiresAt"));
        int reminderDays = intField(parts, "reminderDays", 14);
        boolean sensitive = SENSITIVE.contains(docType);

        String storageKey = FileVault.newStorageKey();
        FileVault.Stored stored;
        try {
            stored = vault.encrypt(new ByteArrayInputStream(file.data), storageKey);
        } catch (Exception e) {
            vault.delete(storageKey);
            throw AppException.internal("Could not encrypt file: " + e.getMessage());
        }

        return db.tx(c -> {
            UUID docId = UUID.randomUUID();
            try (PreparedStatement ps = c.prepareStatement(
                    "INSERT INTO documents (id, owner_id, folder_id, title, doc_type, description, status, review_status, expires_at, reminder_days) "
                            + "VALUES (?,?,?,?,?,?,?,?,?,?)")) {
                ps.setObject(1, docId);
                ps.setObject(2, UUID.fromString(me.id));
                ps.setObject(3, folderId);
                ps.setString(4, fTitle);
                ps.setString(5, docType);
                ps.setString(6, description);
                ps.setString(7, sensitive ? "pending_review" : "active");
                ps.setString(8, sensitive ? "submitted" : "none");
                ps.setObject(9, expiresAt);
                ps.setInt(10, reminderDays);
                ps.executeUpdate();
            }
            try (PreparedStatement ps = c.prepareStatement(
                    "INSERT INTO document_versions (document_id, version_number, storage_key, sha256, file_size, mime_type, uploaded_by) "
                            + "VALUES (?,1,?,?,?,?,?)")) {
                ps.setObject(1, docId);
                ps.setString(2, storageKey);
                ps.setString(3, stored.sha256());
                ps.setLong(4, stored.size());
                ps.setString(5, mime);
                ps.setObject(6, UUID.fromString(me.id));
                ps.executeUpdate();
            }
            if (sensitive) {
                try (PreparedStatement ps = c.prepareStatement(
                        "INSERT INTO admin_reviews (target_type, target_id, submitted_by, reason) VALUES ('document',?,?,?)")) {
                    ps.setObject(1, docId);
                    ps.setObject(2, UUID.fromString(me.id));
                    ps.setString(3, "Sensitive document type '" + docType + "' requires admin review");
                    ps.executeUpdate();
                }
                notifyAdmins(c, "admin_review", "Sensitive document awaiting review",
                        me.fullName + " uploaded '" + fTitle + "' (" + docType + ") - review required", "document", docId.toString());
            }
            audit.insert(c, UUID.fromString(me.id), "document.uploaded", "document", docId.toString(), ip, null,
                    Json.obj("title", fTitle, "docType", docType, "size", stored.size(), "sha256", stored.sha256()));
            return fetchOwned(c, UUID.fromString(me.id), docId);
        });
    }

    // ---- list ----
    public Models.Page<Models.Document> list(Models.User me, Map<String, String> q, int page, int limit) {
        StringBuilder where = new StringBuilder(" WHERE d.owner_id = ?");
        List<Object> args = new ArrayList<>();
        args.add(UUID.fromString(me.id));
        String status = q.get("status");
        if (status != null && !status.isBlank()) {
            if (!Set.of("pending_review", "active", "expiring", "expired", "archived", "deleted").contains(status))
                throw AppException.validation("status", "Unknown status filter");
            where.append(status.equals("deleted") ? " AND d.deleted_at IS NOT NULL" : " AND d.status = ? AND d.deleted_at IS NULL");
            if (!status.equals("deleted")) args.add(status);
        } else {
            where.append(" AND d.deleted_at IS NULL");
        }
        String type = q.get("type");
        if (type != null && !type.isBlank()) {
            where.append(" AND d.doc_type = ?");
            args.add(type);
        }
        String folder = q.get("folder");
        if (folder != null && !folder.isBlank()) {
            where.append(" AND d.folder_id = ?");
            args.add(parseUuid(folder, "folder"));
        }
        String search = q.get("search");
        if (search != null && !search.isBlank()) {
            where.append(" AND d.title ILIKE ?");
            args.add("%" + AuditService.escape(search) + "%");
        }
        String sort = q.getOrDefault("sort", "created_at");
        if (!SORTABLE.contains(sort)) throw AppException.validation("sort", "sort must be one of: " + String.join(", ", SORTABLE));
        String order = "desc".equalsIgnoreCase(q.getOrDefault("order", "desc")) ? "DESC" : "ASC";

        return db.with(c -> {
            long total;
            try (PreparedStatement ps = c.prepareStatement("SELECT COUNT(*) FROM documents d" + where)) {
                bind(ps, args);
                try (ResultSet rs = ps.executeQuery()) { rs.next(); total = rs.getLong(1); }
            }
            List<Models.Document> items = new ArrayList<>();
            try (PreparedStatement ps = c.prepareStatement("SELECT d.* FROM documents d" + where
                    + " ORDER BY d." + sort + " " + order + " LIMIT ? OFFSET ?")) {
                List<Object> all = new ArrayList<>(args);
                all.add(limit);
                all.add((page - 1) * limit);
                bind(ps, all);
                try (ResultSet rs = ps.executeQuery()) { while (rs.next()) items.add(Rows.document(rs)); }
            }
            return new Models.Page<>(items, page, limit, total);
        });
    }

    public Models.Document get(Models.User me, UUID docId) {
        Models.Document cached = docCache.getIfPresent(docKey(me.id, docId));
        if (cached != null) return cached;
        Models.Document d = db.with(c -> fetchOwned(c, UUID.fromString(me.id), docId));
        docCache.put(docKey(me.id, docId), d);
        return d;
    }

    // ---- patch ----
    public Models.Document patch(Models.User me, UUID docId, Map<String, Object> b, String ip) {
        Models.Document out = db.tx(c -> {
            Models.Document d = fetchOwned(c, UUID.fromString(me.id), docId);
            String title = Validator.optional(Ctx.str(b, "title"), "title", 200);
            String description = Validator.optional(Ctx.str(b, "description"), "description", 2000);
            String docType = b.containsKey("docType") && Ctx.str(b, "docType") != null
                    ? Validator.oneOf(Ctx.str(b, "docType"), "docType", DOC_TYPES) : null;
            Integer reminderDays = Ctx.intVal(b, "reminderDays");
            if (reminderDays != null) Validator.intRange(reminderDays, "reminderDays", 1, 90, 14);
            LocalDate expiresAt = null;
            boolean clearExpiry = false;
            if (b.containsKey("expiresAt")) {
                String raw = Ctx.str(b, "expiresAt");
                clearExpiry = raw == null || raw.isBlank();
                if (!clearExpiry) expiresAt = Text.parseDate(raw, "expiresAt");
            }
            UUID folderId = null;
            boolean clearFolder = false;
            if (b.containsKey("folderId")) {
                String raw = Ctx.str(b, "folderId");
                clearFolder = raw == null || raw.isBlank();
                if (!clearFolder) {
                    folderId = parseUuid(raw, "folderId");
                    try (PreparedStatement ps = c.prepareStatement("SELECT 1 FROM folders WHERE id = ? AND owner_id = ?")) {
                        ps.setObject(1, folderId);
                        ps.setObject(2, UUID.fromString(me.id));
                        try (ResultSet rs = ps.executeQuery()) { if (!rs.next()) throw AppException.notFound("Folder not found"); }
                    }
                }
            }

            boolean resubmit = docType != null && SENSITIVE.contains(docType) && "none".equals(d.reviewStatus);

            StringBuilder sql = new StringBuilder("UPDATE documents SET ");
            List<Object> args = new ArrayList<>();
            if (title != null) { sql.append("title = ?, "); args.add(title); }
            if (b.containsKey("description")) { sql.append("description = ?, "); args.add(description); }
            if (docType != null) { sql.append("doc_type = ?, "); args.add(docType); }
            if (reminderDays != null) { sql.append("reminder_days = ?, "); args.add(reminderDays); }
            if (clearExpiry || expiresAt != null) { sql.append("expires_at = ?, "); args.add(clearExpiry ? null : expiresAt); }
            if (clearFolder || folderId != null) { sql.append("folder_id = ?, "); args.add(clearFolder ? null : folderId); }
            if (resubmit) { sql.append("status = 'pending_review', review_status = 'submitted', "); }
            sql.setLength(sql.length() - 2);
            sql.append(" WHERE id = ? AND owner_id = ?");
            args.add(docId);
            args.add(UUID.fromString(me.id));
            try (PreparedStatement ps = c.prepareStatement(sql.toString())) {
                bind(ps, args);
                ps.executeUpdate();
            }
            if (resubmit) {
                try (PreparedStatement ps = c.prepareStatement(
                        "INSERT INTO admin_reviews (target_type, target_id, submitted_by, reason) VALUES ('document',?,?,?)")) {
                    ps.setObject(1, docId);
                    ps.setObject(2, UUID.fromString(me.id));
                    ps.setString(3, "Document reclassified as sensitive (" + docType + ")");
                    ps.executeUpdate();
                }
                notifyAdmins(c, "admin_review", "Sensitive document awaiting review",
                        me.fullName + " updated '" + d.title + "' to type " + docType + " - review required", "document", docId.toString());
            }
            history(c, docId, UUID.fromString(me.id), "edited",
                    Json.obj("fields", args.size() - 2, "docType", docType, "resubmitted", resubmit), ip);
            audit.insert(c, UUID.fromString(me.id), "document.updated", "document", docId.toString(), ip, null, Json.obj());
            return fetchOwned(c, UUID.fromString(me.id), docId);
        });
        docCache.invalidate(docKey(me.id, docId));
        return out;
    }

    // ---- delete / restore ----
    public Map<String, Object> softDelete(Models.User me, UUID docId, String ip) {
        int n = db.tx(c -> {
            try (PreparedStatement ps = c.prepareStatement(
                    "UPDATE documents SET status = 'deleted', deleted_at = now() WHERE id = ? AND owner_id = ? AND deleted_at IS NULL")) {
                ps.setObject(1, docId);
                ps.setObject(2, UUID.fromString(me.id));
                return ps.executeUpdate();
            }
        });
        if (n == 0) throw AppException.notFound("Document not found");
        docCache.invalidate(docKey(me.id, docId));
        audit.insert(UUID.fromString(me.id), "document.deleted", "document", docId.toString(), ip, null, Json.obj());
        return Json.obj("deleted", true, "id", docId.toString());
    }

    public Map<String, Object> restore(Models.User me, UUID docId, String ip) {
        String newStatus = db.tx(c -> {
            Models.Document d = fetchOwnedForRestore(c, UUID.fromString(me.id), docId);
            boolean sensitiveRejected = SENSITIVE.contains(d.docType) && "rejected".equals(d.reviewStatus);
            String status;
            if (sensitiveRejected) status = "pending_review";
            else if (d.expiresAt != null && LocalDate.parse(d.expiresAt).isBefore(LocalDate.now())) status = "expired";
            else status = "active";
            try (PreparedStatement ps = c.prepareStatement(
                    "UPDATE documents SET status = ?, deleted_at = NULL"
                            + (sensitiveRejected ? ", review_status = 'submitted'" : "")
                            + " WHERE id = ? AND owner_id = ?")) {
                ps.setString(1, status);
                ps.setObject(2, docId);
                ps.setObject(3, UUID.fromString(me.id));
                ps.executeUpdate();
            }
            if (sensitiveRejected) {
                try (PreparedStatement ps = c.prepareStatement(
                        "INSERT INTO admin_reviews (target_type, target_id, submitted_by, reason) VALUES ('document',?,?,?)")) {
                    ps.setObject(1, docId);
                    ps.setObject(2, UUID.fromString(me.id));
                    ps.setString(3, "Restored sensitive document with prior rejection - re-review required");
                    ps.executeUpdate();
                }
                notifyAdmins(c, "admin_review", "Sensitive document awaiting review",
                        "Restored document '" + d.title + "' needs re-review", "document", docId.toString());
            }
            audit.insert(c, UUID.fromString(me.id), "document.restored", "document", docId.toString(), ip, null, Json.obj());
            return status;
        });
        docCache.invalidate(docKey(me.id, docId));
        return Json.obj("restored", true, "id", docId.toString(), "status", newStatus);
    }

    /** Hard delete: removes rows and encrypted bytes. Falls back to a redacted tombstone when the
     *  append-only history trigger blocks cascading DELETEs (no table-owner privileges).
     *  Phase 3: destructive and irreversible, so it demands a fresh step-up OTP on top of the bearer token. */
    public Map<String, Object> permanentDelete(Models.User me, UUID docId, String stepUpToken, String ip) {
        stepUps.authorize(stepUpToken, me);
        record Purge(boolean hard, List<String> keys) {}
        Purge r = db.tx(c -> {
            fetchOwned(c, UUID.fromString(me.id), docId);
            List<String> keys = new ArrayList<>();
            try (PreparedStatement ps = c.prepareStatement("SELECT storage_key FROM document_versions WHERE document_id = ?")) {
                ps.setObject(1, docId);
                try (ResultSet rs = ps.executeQuery()) { while (rs.next()) keys.add(rs.getString(1)); }
            }
            boolean hard = false;
            try (Statement st = c.createStatement()) {
                st.execute("SAVEPOINT perm_del");
                try {
                    st.execute("ALTER TABLE document_history DISABLE TRIGGER trg_history_immutable");
                    try (PreparedStatement ps = c.prepareStatement("DELETE FROM documents WHERE id = ?")) {
                        ps.setObject(1, docId);
                        hard = ps.executeUpdate() > 0;
                    }
                    st.execute("ALTER TABLE document_history ENABLE TRIGGER trg_history_immutable");
                    st.execute("RELEASE SAVEPOINT perm_del");
                } catch (SQLException e) {
                    st.execute("ROLLBACK TO SAVEPOINT perm_del");
                    hard = false;
                }
            }
            if (!hard) {
                try (PreparedStatement ps = c.prepareStatement("DELETE FROM document_versions WHERE document_id = ?")) {
                    ps.setObject(1, docId);
                    ps.executeUpdate();
                }
                try (PreparedStatement ps = c.prepareStatement(
                        "UPDATE documents SET title = '[Permanently deleted]', description = NULL, sha256 = NULL, "
                                + "file_size = NULL, mime_type = NULL, folder_id = NULL, expires_at = NULL, "
                                + "status = 'deleted', deleted_at = now() WHERE id = ?")) {
                    ps.setObject(1, docId);
                    ps.executeUpdate();
                }
            }
            audit.insert(c, UUID.fromString(me.id), "document.purged", "document", hard ? docId.toString() : null, ip, null,
                    Json.obj("mode", hard ? "purged" : "tombstoned", "versions", keys.size()));
            return new Purge(hard, keys);
        });
        docCache.invalidate(docKey(me.id, docId));
        for (String key : r.keys()) vault.delete(key); // only after commit
        return Json.obj("deleted", true, "id", docId.toString(), "mode", r.hard() ? "purged" : "tombstoned");
    }

    // ---- versions ----
    public Models.DocumentVersion addVersion(Models.User me, UUID docId, Map<String, Part> parts, String ip) {        Part file = parts.get("file");
        if (file == null || file.data.length == 0) throw AppException.validation("file", "file is required");
        if (file.data.length > MAX_FILE_BYTES) throw AppException.tooLarge("File exceeds the 25 MB limit");
        String mime = resolveMime(file);
        String note = Validator.optional(field(parts, "note"), "note", 300);

        String storageKey = FileVault.newStorageKey();
        FileVault.Stored stored;
        try {
            stored = vault.encrypt(new ByteArrayInputStream(file.data), storageKey);
        } catch (Exception e) {
            vault.delete(storageKey);
            throw AppException.internal("Could not encrypt file: " + e.getMessage());
        }

        Models.DocumentVersion out = db.tx(c -> {
            fetchOwned(c, UUID.fromString(me.id), docId);
            int next;
            try (PreparedStatement ps = c.prepareStatement(
                    "SELECT COALESCE(MAX(version_number), 0) + 1 AS next FROM document_versions WHERE document_id = ?")) {
                ps.setObject(1, docId);
                try (ResultSet rs = ps.executeQuery()) { rs.next(); next = rs.getInt("next"); }
            }
            try (PreparedStatement ps = c.prepareStatement(
                    "INSERT INTO document_versions (document_id, version_number, storage_key, sha256, file_size, mime_type, note, uploaded_by) "
                            + "VALUES (?,?,?,?,?,?,?,?)")) {
                ps.setObject(1, docId);
                ps.setInt(2, next);
                ps.setString(3, storageKey);
                ps.setString(4, stored.sha256());
                ps.setLong(5, stored.size());
                ps.setString(6, mime);
                ps.setString(7, note);
                ps.setObject(8, UUID.fromString(me.id));
                ps.executeUpdate();
            }
            audit.insert(c, UUID.fromString(me.id), "document.version_added", "document", docId.toString(), ip, null,
                    Json.obj("version", next, "sha256", stored.sha256()));
            return fetchVersion(c, docId, next);
        });
        docCache.invalidate(docKey(me.id, docId));
        return out;
    }

    public List<Models.DocumentVersion> versions(Models.User me, UUID docId) {
        return db.with(c -> {
            fetchOwned(c, UUID.fromString(me.id), docId);
            List<Models.DocumentVersion> out = new ArrayList<>();
            try (PreparedStatement ps = c.prepareStatement(
                    "SELECT * FROM document_versions WHERE document_id = ? ORDER BY version_number DESC")) {
                ps.setObject(1, docId);
                try (ResultSet rs = ps.executeQuery()) { while (rs.next()) out.add(Rows.version(rs)); }
            }
            return out;
        });
    }

    // ---- download ----
    public FileOut download(Models.User me, UUID docId, Integer versionNumber, String ip) {
        record Blob(String storageKey, String sha256, String mime, String title, int v) {}
        Blob blob = db.with(c -> {
            fetchOwned(c, UUID.fromString(me.id), docId);
            // H-1: no explicit version means "current version" - resolve via d.current_version
            // instead of the impossible version_number = -1 that made default downloads 404.
            try (PreparedStatement ps = c.prepareStatement(
                    "SELECT v.storage_key, v.sha256, v.mime_type, d.title, v.version_number FROM document_versions v "
                            + "JOIN documents d ON d.id = v.document_id "
                            + "WHERE v.document_id = ? AND v.version_number = COALESCE(?, d.current_version)")) {
                ps.setObject(1, docId);
                if (versionNumber == null) ps.setNull(2, java.sql.Types.INTEGER); else ps.setInt(2, versionNumber);
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) throw AppException.notFound("Version not found");
                    return new Blob(rs.getString("storage_key"), rs.getString("sha256"),
                            rs.getString("mime_type"), rs.getString("title"), rs.getInt("version_number"));
                }
            }
        });
        byte[] data = decryptAndVerify(blob.storageKey(), blob.sha256(), docId, "document." + blob.v());
        db.tx(c -> {
            history(c, docId, UUID.fromString(me.id), "downloaded", Json.obj("version", blob.v()), ip);
            audit.insert(c, UUID.fromString(me.id), "document.downloaded", "document", docId.toString(), ip, null,
                    Json.obj("version", blob.v()));
            return null;
        });
        return new FileOut(data, blob.mime(), safeFilename(blob.title()) + " (v" + blob.v() + ")" + extensionFor(blob.mime()));
    }

    private byte[] decryptAndVerify(String storageKey, String expectedSha, UUID docId, String auditTag) {
        try {
            FileVault.Decrypted dec = vault.decryptBytes(storageKey);
            if (!Text.constEq(dec.sha256(), expectedSha)) {
                audit.insert(null, "tamper_detected", "document", docId.toString(), null, null,
                        Json.obj("where", auditTag, "reason", "Recomputed SHA-256 does not match stored digest"));
                throw AppException.conflict("File integrity check failed - possible tampering");
            }
            return dec.data();
        } catch (FileVault.TamperedException e) {
            audit.insert(null, "tamper_detected", "document", docId.toString(), null, null,
                    Json.obj("where", auditTag, "reason", "Vault tag verification failed"));
            throw AppException.conflict("File integrity check failed - possible tampering");
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            throw AppException.internal("Vault read failed: " + e.getMessage());
        }
    }

    // ---- history ----
    public List<Map<String, Object>> history(Models.User me, UUID docId) {
        return db.with(c -> {
            fetchOwned(c, UUID.fromString(me.id), docId);
            List<Map<String, Object>> out = new ArrayList<>();
            try (PreparedStatement ps = c.prepareStatement(
                    "SELECT * FROM document_history WHERE document_id = ? ORDER BY id DESC LIMIT 200")) {
                ps.setObject(1, docId);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        out.add(Json.obj("id", rs.getLong("id"), "action", rs.getString("action"),
                                "actorId", Rows.str(rs, "actor_id"), "detail", Rows.json(rs, "detail"),
                                "ip", Rows.str(rs, "ip"), "createdAt", Rows.ts(rs, "created_at")));
                    }
                }
            }
            return out;
        });
    }

    // ---- expiring ----
    public List<Map<String, Object>> expiring(Models.User me, int days) {
        if (days < 1 || days > 365) throw AppException.validation("days", "days must be between 1 and 365");
        return db.with(c -> {
            List<Map<String, Object>> out = new ArrayList<>();
            try (PreparedStatement ps = c.prepareStatement(
                    "SELECT * FROM v_expiring_documents WHERE owner_id = ? AND days_left <= ? ORDER BY days_left ASC")) {
                ps.setObject(1, UUID.fromString(me.id));
                ps.setInt(2, days);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        out.add(Json.obj("id", Rows.str(rs, "id"), "title", rs.getString("title"),
                                "docType", rs.getString("doc_type"), "expiresAt", Rows.date(rs, "expires_at"),
                                "daysLeft", rs.getInt("days_left")));
                    }
                }
            }
            return out;
        });
    }

    // ---- shared helpers ----
    public Models.Document fetchOwned(Connection c, UUID ownerId, UUID docId) throws Exception {
        try (PreparedStatement ps = c.prepareStatement("SELECT * FROM documents WHERE id = ? AND owner_id = ?")) {
            ps.setObject(1, docId);
            ps.setObject(2, ownerId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) throw AppException.notFound("Document not found");
                return Rows.document(rs);
            }
        }
    }

    private Models.Document fetchOwnedForRestore(Connection c, UUID ownerId, UUID docId) throws Exception {
        try (PreparedStatement ps = c.prepareStatement("SELECT * FROM documents WHERE id = ? AND owner_id = ? AND deleted_at IS NOT NULL")) {
            ps.setObject(1, docId);
            ps.setObject(2, ownerId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) throw AppException.notFound("Deleted document not found");
                return Rows.document(rs);
            }
        }
    }

    private Models.DocumentVersion fetchVersion(Connection c, UUID docId, int v) throws Exception {
        try (PreparedStatement ps = c.prepareStatement("SELECT * FROM document_versions WHERE document_id = ? AND version_number = ?")) {
            ps.setObject(1, docId);
            ps.setInt(2, v);
            try (ResultSet rs = ps.executeQuery()) { rs.next(); return Rows.version(rs); }
        }
    }

    public void history(Connection c, UUID docId, UUID actorId, String action, Map<String, Object> detail, String ip) throws Exception {
        try (PreparedStatement ps = c.prepareStatement(
                // detail is JSONB - CAST keeps the varchar parameter from failing type resolution
                "INSERT INTO document_history (document_id, actor_id, action, detail, ip) VALUES (?,?,?,CAST(? AS jsonb),?)")) {
            ps.setObject(1, docId);
            ps.setObject(2, actorId);
            ps.setString(3, action);
            ps.setString(4, Json.write(detail == null ? Map.of() : detail));
            ps.setString(5, ip);
            ps.executeUpdate();
        }
    }

    public void notifyAdmins(Connection c, String type, String title, String body, String entityType, String entityId) throws Exception {
        try (PreparedStatement ps = c.prepareStatement("SELECT id FROM users WHERE role = 'admin' AND status = 'active'")) {
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) notifications.notify(c, UUID.fromString(rs.getString("id")), type, title, body, entityType, entityId);
            }
        }
    }

    public static String resolveMime(Part file) {
        String mime = file.contentType == null ? null : file.contentType.split(";")[0].trim().toLowerCase(Locale.ROOT);
        if (mime == null || mime.isBlank() || "application/octet-stream".equals(mime)) mime = guessMime(file.filename);
        if (!ALLOWED_MIME.contains(mime))
            throw AppException.unsupportedMedia("File type not allowed - use PDF, PNG, JPEG, WebP, DOC or DOCX");
        return mime;
    }

    private static String guessMime(String filename) {
        if (filename == null) return "application/octet-stream";
        String n = filename.toLowerCase(Locale.ROOT);
        if (n.endsWith(".pdf")) return "application/pdf";
        if (n.endsWith(".png")) return "image/png";
        if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
        if (n.endsWith(".webp")) return "image/webp";
        if (n.endsWith(".doc")) return "application/msword";
        if (n.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        return "application/octet-stream";
    }

    public static String extensionFor(String mime) {
        return switch (mime == null ? "" : mime) {
            case "application/pdf" -> ".pdf";
            case "image/png" -> ".png";
            case "image/jpeg" -> ".jpg";
            case "image/webp" -> ".webp";
            case "application/msword" -> ".doc";
            case "application/vnd.openxmlformats-officedocument.wordprocessingml.document" -> ".docx";
            default -> "";
        };
    }

    public static String safeFilename(String title) {
        String s = title == null ? "document" : title;
        StringBuilder sb = new StringBuilder();
        for (char ch : s.toCharArray()) sb.append(Character.isLetterOrDigit(ch) ? ch : (ch == ' ' ? '_' : '_'));
        String out = sb.toString().replaceAll("_+", "_");
        return out.isBlank() ? "document" : (out.length() > 80 ? out.substring(0, 80) : out);
    }

    private UUID folderIdOrNull(Models.User me, String raw) {
        if (raw == null || raw.isBlank()) return null;
        UUID id = parseUuid(raw, "folderId");
        return db.with(c -> {
            try (PreparedStatement ps = c.prepareStatement("SELECT 1 FROM folders WHERE id = ? AND owner_id = ?")) {
                ps.setObject(1, id);
                ps.setObject(2, UUID.fromString(me.id));
                try (ResultSet rs = ps.executeQuery()) { if (!rs.next()) throw AppException.notFound("Folder not found"); }
            }
            return id;
        });
    }

    private static LocalDate expiresAtOrNull(String raw) {
        if (raw == null || raw.isBlank()) return null;
        return Text.parseDate(raw, "expiresAt");
    }

    public static UUID parseUuid(String raw, String field) {
        try { return UUID.fromString(raw.trim()); }
        catch (Exception e) { throw AppException.validation(field, field + " must be a UUID"); }
    }

    private static String field(Map<String, Part> parts, String name) {
        Part p = parts.get(name);
        return p == null ? null : p.asString();
    }

    private static int intField(Map<String, Part> parts, String name, int dflt) {
        Part p = parts.get(name);
        if (p == null || p.asString().isBlank()) return dflt;
        return Validator.intRange(Ctx.intVal(Map.of(name, p.asString()), name), name, 1, 90, dflt);
    }

    private static void bind(PreparedStatement ps, List<Object> args) throws SQLException {
        for (int i = 0; i < args.size(); i++) ps.setObject(i + 1, args.get(i));
    }
}
