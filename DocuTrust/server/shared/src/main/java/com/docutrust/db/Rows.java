package com.docutrust.db;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.Map;

import com.docutrust.model.Models;
import com.docutrust.util.Json;
import com.docutrust.util.Text;

// ResultSet -> model mapping used by services (the read side of the DAO layer).
public final class Rows {
    private Rows() {}

    public static String str(ResultSet rs, String col) throws SQLException {
        String v = rs.getString(col);
        return rs.wasNull() ? null : v;
    }

    public static Long lng(ResultSet rs, String col) throws SQLException {
        long v = rs.getLong(col);
        return rs.wasNull() ? null : v;
    }

    public static Integer integer(ResultSet rs, String col) throws SQLException {
        int v = rs.getInt(col);
        return rs.wasNull() ? null : v;
    }

    public static String ts(ResultSet rs, String col) throws SQLException {
        Timestamp t = rs.getTimestamp(col);
        return t == null ? null : Text.iso(t);
    }

    public static String date(ResultSet rs, String col) throws SQLException {
        LocalDate d = rs.getObject(col, LocalDate.class);
        return d == null ? null : d.toString();
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> json(ResultSet rs, String col) throws SQLException {
        String v = rs.getString(col);
        if (v == null) return Map.of();
        try {
            Object o = Json.parse(v);
            return o instanceof Map ? (Map<String, Object>) o : Map.of();
        } catch (Exception e) {
            return Map.of();
        }
    }

    public static Models.User user(ResultSet rs) throws SQLException {
        Models.User u = new Models.User();
        u.id = str(rs, "id");
        u.orgId = str(rs, "org_id");
        u.email = rs.getString("email");
        u.fullName = rs.getString("full_name");
        u.phone = str(rs, "phone");
        u.role = rs.getString("role");
        u.status = rs.getString("status");
        u.mfaEnabled = rs.getBoolean("mfa_enabled");
        u.emailVerified = rs.getBoolean("email_verified");
        u.lastLoginAt = ts(rs, "last_login_at");
        u.createdAt = ts(rs, "created_at");
        return u;
    }

    public static Models.Document document(ResultSet rs) throws SQLException {
        Models.Document d = new Models.Document();
        d.id = str(rs, "id");
        d.ownerId = str(rs, "owner_id");
        d.folderId = str(rs, "folder_id");
        d.title = rs.getString("title");
        d.docType = rs.getString("doc_type");
        d.description = str(rs, "description");
        d.status = rs.getString("status");
        d.reviewStatus = rs.getString("review_status");
        d.currentVersion = rs.getInt("current_version");
        Long size = lng(rs, "file_size");
        d.fileSize = size == null ? 0 : size;
        d.mimeType = str(rs, "mime_type");
        d.sha256 = str(rs, "sha256");
        d.expiresAt = date(rs, "expires_at");
        d.reminderDays = rs.getInt("reminder_days");
        d.createdAt = ts(rs, "created_at");
        d.updatedAt = ts(rs, "updated_at");
        return d;
    }

    public static Models.Folder folder(ResultSet rs) throws SQLException {
        Models.Folder f = new Models.Folder();
        f.id = str(rs, "id");
        f.ownerId = str(rs, "owner_id");
        f.parentId = str(rs, "parent_id");
        f.name = rs.getString("name");
        f.createdAt = ts(rs, "created_at");
        f.docCount = rs.getInt("doc_count");
        return f;
    }

    public static Models.DocumentVersion version(ResultSet rs) throws SQLException {
        Models.DocumentVersion v = new Models.DocumentVersion();
        v.id = str(rs, "id");
        v.documentId = str(rs, "document_id");
        v.versionNumber = rs.getInt("version_number");
        v.storageKey = str(rs, "storage_key");
        v.sha256 = rs.getString("sha256");
        v.fileSize = rs.getLong("file_size");
        v.mimeType = rs.getString("mime_type");
        v.note = str(rs, "note");
        v.uploadedBy = str(rs, "uploaded_by");
        v.createdAt = ts(rs, "created_at");
        return v;
    }

    public static Models.Share share(ResultSet rs) throws SQLException {
        Models.Share s = new Models.Share();
        s.id = str(rs, "id");
        s.documentId = str(rs, "document_id");
        s.ownerId = str(rs, "owner_id");
        s.sharedWithUserId = str(rs, "shared_with_user_id");
        s.linkToken = str(rs, "link_token");
        s.permission = rs.getString("permission");
        s.maxViews = integer(rs, "max_views");
        s.viewCount = rs.getInt("view_count");
        s.passcodeRequired = str(rs, "passcode_hash") != null;
        s.otpRequired = rs.getBoolean("require_otp");
        s.otpRecipientEmail = str(rs, "otp_recipient_email");
        s.expiresAt = ts(rs, "expires_at");
        s.revokedAt = ts(rs, "revoked_at");
        s.createdAt = ts(rs, "created_at");
        s.documentTitle = str(rs, "document_title");
        s.docType = str(rs, "doc_type");
        s.ownerName = str(rs, "owner_name");
        return s;
    }

    public static Models.VerificationRequest verification(ResultSet rs) throws SQLException {
        Models.VerificationRequest v = new Models.VerificationRequest();
        v.id = str(rs, "id");
        v.documentId = str(rs, "document_id");
        v.requesterId = str(rs, "requester_id");
        v.verifierName = rs.getString("verifier_name");
        v.verifierOrg = str(rs, "verifier_org");
        v.purpose = rs.getString("purpose");
        v.token = rs.getString("token");
        v.status = rs.getString("status");
        v.result = str(rs, "result");
        v.decidedBy = str(rs, "decided_by");
        v.decidedAt = ts(rs, "decided_at");
        v.expiresAt = ts(rs, "expires_at");
        v.createdAt = ts(rs, "created_at");
        v.documentTitle = str(rs, "document_title");
        v.ownerName = str(rs, "owner_name");
        v.versionId = str(rs, "version_id");
        v.docType = str(rs, "document_doc_type");
        v.sha256 = str(rs, "document_sha256");
        return v;
    }

    public static Models.Notification notification(ResultSet rs) throws SQLException {
        Models.Notification n = new Models.Notification();
        n.id = rs.getLong("id");
        n.userId = str(rs, "user_id");
        n.type = rs.getString("type");
        n.title = rs.getString("title");
        n.body = str(rs, "body");
        n.entityType = str(rs, "entity_type");
        n.entityId = str(rs, "entity_id");
        n.readAt = ts(rs, "read_at");
        n.createdAt = ts(rs, "created_at");
        return n;
    }

    public static Models.AdminReview review(ResultSet rs) throws SQLException {
        Models.AdminReview r = new Models.AdminReview();
        r.id = str(rs, "id");
        r.targetType = rs.getString("target_type");
        r.targetId = str(rs, "target_id");
        r.submittedBy = str(rs, "submitted_by");
        r.reviewerId = str(rs, "reviewer_id");
        r.status = rs.getString("status");
        r.reason = str(rs, "reason");
        r.decisionNote = str(rs, "decision_note");
        r.createdAt = ts(rs, "created_at");
        r.reviewedAt = ts(rs, "reviewed_at");
        r.targetTitle = str(rs, "target_title");
        r.docType = str(rs, "doc_type");
        r.submitterEmail = str(rs, "submitter_email");
        r.sha256 = str(rs, "sha256");
        return r;
    }

    public static Models.AuditLog audit(ResultSet rs) throws SQLException {
        Models.AuditLog a = new Models.AuditLog();
        a.id = rs.getLong("id");
        a.actorId = str(rs, "actor_id");
        a.action = rs.getString("action");
        a.entityType = rs.getString("entity_type");
        a.entityId = str(rs, "entity_id");
        a.ip = str(rs, "ip");
        a.userAgent = str(rs, "user_agent");
        a.meta = json(rs, "meta");
        a.createdAt = ts(rs, "created_at");
        return a;
    }

    public static Models.Settings settings(ResultSet rs) throws SQLException {
        Models.Settings s = new Models.Settings();
        s.userId = str(rs, "user_id");
        s.expiryAlerts = rs.getBoolean("expiry_alerts");
        s.shareAlerts = rs.getBoolean("share_alerts");
        s.verificationAlerts = rs.getBoolean("verification_alerts");
        s.adminAlerts = rs.getBoolean("admin_alerts");
        s.reminderOffsetDays = rs.getInt("reminder_offset_days");
        return s;
    }
}
