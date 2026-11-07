package com.docutrust.model;

import com.docutrust.util.Json;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

// All API models as compact POJOs with JSON mapping (public fields, no builders).
public final class Models {
    private Models() {}

    public interface Jsonable { Map<String, Object> toMap(); }

    public static final class User implements Jsonable {
        public String id, orgId, email, fullName, phone, role, status, lastLoginAt, createdAt;
        public String orgName; // H-3: emitted with /api/auth/me and admin user rows
        public boolean mfaEnabled, emailVerified;

        @Override
        public Map<String, Object> toMap() {
            Map<String, Object> m = Json.obj("id", id, "email", email, "fullName", fullName, "phone", phone, "role", role,
                    "orgId", orgId, "status", status, "mfaEnabled", mfaEnabled, "emailVerified", emailVerified,
                    "lastLoginAt", lastLoginAt, "createdAt", createdAt);
            if (orgName != null) m.put("orgName", orgName);
            return m;
        }
    }

    public static final class Organisation implements Jsonable {
        public String id, name, plan, createdAt;

        @Override
        public Map<String, Object> toMap() {
            return Json.obj("id", id, "name", name, "plan", plan, "createdAt", createdAt);
        }
    }

    public static final class Folder implements Jsonable {
        public String id, ownerId, parentId, name, createdAt;
        public int docCount;

        @Override
        public Map<String, Object> toMap() {
            return Json.obj("id", id, "ownerId", ownerId, "parentId", parentId, "name", name,
                    "docCount", docCount, "createdAt", createdAt);
        }
    }

    public static final class Document implements Jsonable {
        public String id, ownerId, folderId, title, docType, description, status, reviewStatus,
                mimeType, sha256, expiresAt, createdAt, updatedAt, ownerEmail, ownerName;
        public int currentVersion, reminderDays;
        public long fileSize;
        public Integer daysLeft;

        @Override
        public Map<String, Object> toMap() {
            Map<String, Object> m = Json.obj("id", id, "ownerId", ownerId, "folderId", folderId, "title", title,
                    "docType", docType, "description", description, "status", status, "reviewStatus", reviewStatus,
                    "currentVersion", currentVersion, "fileSize", fileSize, "mimeType", mimeType, "sha256", sha256,
                    "expiresAt", expiresAt, "reminderDays", reminderDays, "createdAt", createdAt, "updatedAt", updatedAt);
            if (ownerEmail != null) m.put("ownerEmail", ownerEmail);
            if (ownerName != null) m.put("ownerName", ownerName);
            if (daysLeft != null) m.put("daysLeft", daysLeft);
            return m;
        }
    }

    public static final class DocumentVersion implements Jsonable {
        public String id, documentId, sha256, mimeType, note, uploadedBy, createdAt, storageKey;
        public int versionNumber;
        public long fileSize;

        @Override
        public Map<String, Object> toMap() {
            return Json.obj("id", id, "documentId", documentId, "versionNumber", versionNumber, "sha256", sha256,
                    "fileSize", fileSize, "mimeType", mimeType, "note", note, "uploadedBy", uploadedBy, "createdAt", createdAt);
        }
    }

    public static final class Share implements Jsonable {
        public String id, documentId, documentTitle, docType, ownerId, ownerName, sharedWithUserId,
                linkToken, permission, expiresAt, revokedAt, createdAt;
        public Integer maxViews;
        public int viewCount;
        public boolean passcodeRequired;
        public boolean otpRequired; // Phase 5: link stays locked until the pinned recipient verifies an emailed OTP
        public String otpRecipientEmail;

        @Override
        public Map<String, Object> toMap() {
            Map<String, Object> m = Json.obj("id", id, "documentId", documentId, "documentTitle", documentTitle,
                    "docType", docType, "ownerId", ownerId, "ownerName", ownerName, "sharedWithUserId", sharedWithUserId,
                    "permission", permission, "maxViews", maxViews, "viewCount", viewCount,
                    "passcodeRequired", passcodeRequired, "otpRequired", otpRequired, "expiresAt", expiresAt,
                    "revokedAt", revokedAt, "createdAt", createdAt);
            if (linkToken != null) m.put("linkToken", linkToken);
            if (otpRecipientEmail != null) m.put("otpRecipientEmail", otpRecipientEmail);
            return m;
        }
    }

    public static final class VerificationRequest implements Jsonable {
        public String id, documentId, requesterId, verifierName, verifierOrg, purpose, token, status, result,
                decidedBy, decidedAt, expiresAt, createdAt, documentTitle, ownerName;
        public String versionId; // F-4: the document version this proof is pinned to
        public String docType, sha256; // H-3: document type + pinned digest for the detail screen

        @Override
        public Map<String, Object> toMap() {
            Map<String, Object> m = Json.obj("id", id, "documentId", documentId, "requesterId", requesterId,
                    "verifierName", verifierName, "verifierOrg", verifierOrg, "purpose", purpose, "token", token,
                    "status", status, "result", result, "decidedBy", decidedBy, "decidedAt", decidedAt,
                    "expiresAt", expiresAt, "createdAt", createdAt);
            if (documentTitle != null) m.put("documentTitle", documentTitle);
            if (ownerName != null) m.put("ownerName", ownerName);
            if (versionId != null) m.put("versionId", versionId);
            if (docType != null) m.put("docType", docType);
            if (sha256 != null) m.put("sha256", sha256);
            return m;
        }
    }

    public static final class Notification implements Jsonable {
        public long id;
        public String userId, type, title, body, entityType, entityId, readAt, createdAt;

        @Override
        public Map<String, Object> toMap() {
            return Json.obj("id", id, "type", type, "title", title, "body", body, "entityType", entityType,
                    "entityId", entityId, "readAt", readAt, "createdAt", createdAt);
        }
    }

    public static final class AdminReview implements Jsonable {
        public String id, targetType, targetId, submittedBy, reviewerId, status, reason, decisionNote,
                createdAt, reviewedAt, targetTitle, docType, submitterEmail;
        public String sha256; // H-3: fingerprint of the reviewed document (detail screen)

        @Override
        public Map<String, Object> toMap() {
            Map<String, Object> m = Json.obj("id", id, "targetType", targetType, "targetId", targetId,
                    "submittedBy", submittedBy, "reviewerId", reviewerId, "status", status, "reason", reason,
                    "decisionNote", decisionNote, "createdAt", createdAt, "reviewedAt", reviewedAt);
            if (targetTitle != null) m.put("targetTitle", targetTitle);
            if (docType != null) m.put("docType", docType);
            if (submitterEmail != null) m.put("submitterEmail", submitterEmail);
            if (sha256 != null) m.put("sha256", sha256);
            return m;
        }
    }

    public static final class AuditLog implements Jsonable {
        public long id;
        public String actorId, action, entityType, entityId, ip, userAgent, createdAt;
        public Map<String, Object> meta = Map.of();

        @Override
        public Map<String, Object> toMap() {
            return Json.obj("id", id, "actorId", actorId, "action", action, "entityType", entityType,
                    "entityId", entityId, "ip", ip, "userAgent", userAgent, "meta", meta, "createdAt", createdAt);
        }
    }

    public static final class Settings implements Jsonable {
        public String userId;
        public boolean expiryAlerts = true, shareAlerts = true, verificationAlerts = true, adminAlerts = true;
        public int reminderOffsetDays = 14;

        @Override
        public Map<String, Object> toMap() {
            return Json.obj("expiryAlerts", expiryAlerts, "shareAlerts", shareAlerts,
                    "verificationAlerts", verificationAlerts, "adminAlerts", adminAlerts, "reminderOffsetDays", reminderOffsetDays);
        }
    }

    public static final class Page<T extends Jsonable> {
        public final List<T> items;
        public final int page, limit;
        public final long total;

        public Page(List<T> items, int page, int limit, long total) {
            this.items = items;
            this.page = page;
            this.limit = limit;
            this.total = total;
        }

        public int pages() { return (int) Math.max(1, Math.ceil((double) Math.max(total, 0) / Math.max(1, limit))); }

        public Map<String, Object> toMeta() { return Json.obj("page", page, "limit", limit, "total", total, "pages", pages()); }

        public List<Map<String, Object>> toItems() {
            List<Map<String, Object>> out = new ArrayList<>();
            for (T t : items) out.add(t.toMap());
            return out;
        }
    }
}
