package com.docutrust.service;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import com.docutrust.AppException;
import com.docutrust.auth.PasswordService;
import com.docutrust.db.Database;
import com.docutrust.db.Rows;
import com.docutrust.http.Ctx;
import com.docutrust.model.Models;
import com.docutrust.util.Json;
import com.docutrust.util.Text;
import com.docutrust.util.Validator;
import com.docutrust.vault.FileVault;

// Sharing: owner-scoped user/link shares with passcode, max views, revocation; public open with atomic
// view counting, single-use download tickets and owner notifications.
public final class ShareService {
    private static final long TICKET_TTL_MS = 5 * 60 * 1000;

    private static final class Ticket {
        final UUID shareId;
        final long expiresAt;
        Ticket(UUID shareId, long expiresAt) { this.shareId = shareId; this.expiresAt = expiresAt; }
    }

    private static final String SELECT_SHARE =
            "SELECT s.*, d.title AS document_title, d.doc_type, d.status AS document_status, u.full_name AS owner_name "
                    + "FROM shares s JOIN documents d ON d.id = s.document_id JOIN users u ON u.id = s.owner_id ";

    private final Database db;
    private final PasswordService passwords;
    private final DocumentService documents;
    private final AuditService audit;
    private final NotificationService notifications;
    private final FileVault vault;
    private final OtpService otps;
    private final MailService mail;
    private final ConcurrentHashMap<String, Ticket> tickets = new ConcurrentHashMap<>();

    public ShareService(Database db, PasswordService passwords, DocumentService documents, AuditService audit,
                        NotificationService notifications, FileVault vault, OtpService otps, MailService mail) {
        this.db = db;
        this.passwords = passwords;
        this.documents = documents;
        this.audit = audit;
        this.notifications = notifications;
        this.vault = vault;
        this.otps = otps;
        this.mail = mail;
    }

    // ---- owner endpoints ----
    public List<Map<String, Object>> mine(Models.User me) {
        return db.with(c -> {
            List<Map<String, Object>> out = new ArrayList<>();
            try (PreparedStatement ps = c.prepareStatement(SELECT_SHARE + "WHERE s.owner_id = ? ORDER BY s.created_at DESC")) {
                ps.setObject(1, UUID.fromString(me.id));
                try (ResultSet rs = ps.executeQuery()) { while (rs.next()) out.add(Rows.share(rs).toMap()); }
            }
            return out;
        });
    }

    public List<Map<String, Object>> incoming(Models.User me) {
        return db.with(c -> {
            List<Map<String, Object>> out = new ArrayList<>();
            try (PreparedStatement ps = c.prepareStatement(SELECT_SHARE
                    + "WHERE s.shared_with_user_id = ? AND s.revoked_at IS NULL AND s.expires_at > now() "
                    + "AND d.status <> 'pending_review' AND d.deleted_at IS NULL ORDER BY s.created_at DESC")) {
                ps.setObject(1, UUID.fromString(me.id));
                try (ResultSet rs = ps.executeQuery()) { while (rs.next()) out.add(Rows.share(rs).toMap()); }
            }
            return out;
        });
    }

    public Map<String, Object> create(Models.User me, Map<String, Object> b, String ip) {
        UUID docId = DocumentService.parseUuid(Ctx.str(b, "documentId"), "documentId");
        String permission = Validator.oneOf(Ctx.str(b, "permission"), "permission", "view", "download");
        Double expiresInHours = Ctx.numVal(b, "expiresInHours");
        if (expiresInHours == null || expiresInHours <= 0 || expiresInHours > 8760)
            throw AppException.validation("expiresInHours", "expiresInHours is required (0 < hours <= 8760)");
        Integer maxViews = Ctx.intVal(b, "maxViews");
        if (maxViews != null && maxViews <= 0) throw AppException.validation("maxViews", "maxViews must be a positive number");
        String passcode = Validator.optional(Ctx.str(b, "passcode"), "passcode", 120);
        boolean requireOtp = Boolean.TRUE.equals(Ctx.boolVal(b, "requireOtp"));
        String sharedWith = Ctx.str(b, "sharedWithUserId");
        UUID targetUserId = null;
        if (sharedWith != null && !sharedWith.isBlank()) {
            targetUserId = DocumentService.parseUuid(sharedWith, "sharedWithUserId");
            if (targetUserId.equals(UUID.fromString(me.id)))
                throw AppException.validation("sharedWithUserId", "Cannot share with yourself");
        }
        // Phase 5: an OTP-gated link must pin exactly one recipient - the only inbox the code goes to.
        if (requireOtp && targetUserId != null)
            throw AppException.validation("requireOtp", "requireOtp applies to link shares - user shares are already private to the recipient");
        final String otpRecipient = requireOtp ? Validator.email(Ctx.str(b, "recipientEmail")) : null;
        String passHash = passcode == null ? null : passwords.hash(passcode);
        final UUID target = targetUserId;

        return db.tx(c -> {
            Models.Document d = fetchOwnedDoc(c, UUID.fromString(me.id), docId);
            if ("pending_review".equals(d.status)) throw AppException.forbidden("Document is pending admin review and cannot be shared yet");
            if ("deleted".equals(d.status)) throw AppException.notFound("Document not found");
            if (target != null) {
                try (PreparedStatement ps = c.prepareStatement("SELECT 1 FROM users WHERE id = ?")) {
                    ps.setObject(1, target);
                    try (ResultSet rs = ps.executeQuery()) { if (!rs.next()) throw AppException.notFound("Target user not found"); }
                }
            }
            String linkToken = target == null ? Text.token() : null; // user share XOR link share
            Timestamp expiresAt = new Timestamp(System.currentTimeMillis() + (long) (expiresInHours * 3600_000.0));
            UUID shareId = UUID.randomUUID();
            try (PreparedStatement ps = c.prepareStatement(
                    "INSERT INTO shares (id, document_id, owner_id, shared_with_user_id, link_token, permission, max_views, passcode_hash, expires_at, require_otp, otp_recipient_email) "
                            + "VALUES (?,?,?,?,?,?,?,?,?,?,?)")) {
                ps.setObject(1, shareId);
                ps.setObject(2, docId);
                ps.setObject(3, UUID.fromString(me.id));
                ps.setObject(4, target);
                ps.setString(5, linkToken);
                ps.setString(6, permission);
                ps.setObject(7, maxViews);
                ps.setString(8, passHash);
                ps.setTimestamp(9, expiresAt);
                ps.setBoolean(10, requireOtp);
                ps.setString(11, otpRecipient);
                ps.executeUpdate();
            }
            documents.history(c, docId, UUID.fromString(me.id), "shared",
                    Json.obj("shareId", shareId.toString(), "permission", permission, "kind", linkToken == null ? "user" : "link",
                            "otpGated", requireOtp), ip);
            audit.insert(c, UUID.fromString(me.id), "share.created", "share", shareId.toString(), ip, null,
                    Json.obj("documentId", docId.toString(), "permission", permission, "otpGated", requireOtp));
            return fetchShare(c, shareId).toMap();
        });
    }

    public Map<String, Object> revoke(Models.User me, UUID shareId, String ip) {
        return db.tx(c -> {
            Models.Share s = fetchOwnedShare(c, UUID.fromString(me.id), shareId);
            try (PreparedStatement ps = c.prepareStatement(
                    "UPDATE shares SET revoked_at = now() WHERE id = ? AND owner_id = ? AND revoked_at IS NULL")) {
                ps.setObject(1, shareId);
                ps.setObject(2, UUID.fromString(me.id));
                if (ps.executeUpdate() == 0) throw AppException.conflict("Share is already revoked");
            }
            documents.history(c, UUID.fromString(s.documentId), UUID.fromString(me.id), "share_revoked",
                    Json.obj("shareId", shareId.toString()), ip);
            audit.insert(c, UUID.fromString(me.id), "share.revoked", "share", shareId.toString(), ip, null, Json.obj());
            return fetchShare(c, shareId).toMap();
        });
    }

    public Map<String, Object> delete(Models.User me, UUID shareId, String ip) {
        db.tx(c -> {
            try (PreparedStatement ps = c.prepareStatement("DELETE FROM shares WHERE id = ? AND owner_id = ?")) {
                ps.setObject(1, shareId);
                ps.setObject(2, UUID.fromString(me.id));
                if (ps.executeUpdate() == 0) throw AppException.notFound("Share not found");
            }
            audit.insert(c, UUID.fromString(me.id), "share.deleted", "share", shareId.toString(), ip, null, Json.obj());
            return null;
        });
        return Json.obj("deleted", true, "id", shareId.toString());
    }

    public Map<String, Object> stats(Models.User me, UUID shareId) {
        return db.with(c -> {
            Models.Share s = fetchOwnedShare(c, UUID.fromString(me.id), shareId);
            List<Map<String, Object>> history = new ArrayList<>();
            try (PreparedStatement ps = c.prepareStatement(
                    "SELECT * FROM document_history WHERE document_id = ? AND action LIKE 'share%' ORDER BY id DESC LIMIT 100")) {
                ps.setObject(1, UUID.fromString(s.documentId));
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        Map<String, Object> detail = Rows.json(rs, "detail");
                        if (shareId.toString().equals(detail.get("shareId"))) {
                            history.add(Json.obj("id", rs.getLong("id"), "action", rs.getString("action"),
                                    "detail", detail, "ip", Rows.str(rs, "ip"), "createdAt", Rows.ts(rs, "created_at")));
                        }
                    }
                }
            }
            Map<String, Object> out = s.toMap();
            out.put("history", history);
            out.put("lastActivity", history.isEmpty() ? null : history.get(0).get("createdAt"));
            return out;
        });
    }

    // ---- public link: metadata ----
    public Map<String, Object> publicGet(String token) {
        return db.with(c -> {
            Models.Share s = findLink(c, token);
            String docStatus = documentStatus(c, s.documentId);
            throwIfUnusable(s, docStatus);
            return publicMeta(s);
        });
    }

    // ---- public link: open (counts a view atomically) ----
    public Map<String, Object> publicOpen(String token, String passcode, String ip) {
        return doOpen(token, passcode, ip, false);
    }

    // ---- Phase 5: email an access code to the pinned recipient of an OTP-gated link ----
    public record ShareOtpResult(Map<String, Object> body, String devCode) {}

    public ShareOtpResult requestShareOtp(String token, String email, String ip) {
        String validated = Validator.email(email);
        record Ref(UUID id, boolean otpRequired, String recipient, String docId) {}
        Ref ref = db.with(c -> {
            Models.Share s = findLink(c, token);
            throwIfUnusable(s, documentStatus(c, s.documentId));
            return new Ref(UUID.fromString(s.id), s.otpRequired, s.otpRecipientEmail, s.documentId);
        });
        if (!ref.otpRequired() || ref.recipient() == null)
            throw AppException.validation("requireOtp", "This share link does not use OTP gating");
        // The code only ever travels to the owner-pinned address; a mismatching request is
        // refused WITHOUT revealing the designated recipient.
        if (!ref.recipient().equalsIgnoreCase(validated))
            throw AppException.forbidden("This email is not authorized for this link");
        String code = db.tx(c -> {
            String issued = otps.issue(c, OtpService.PURPOSE_SHARE_ACCESS, null, ref.id(), ref.recipient());
            audit.insert(c, null, "share.otp_requested", "share", ref.id().toString(), ip, null, Json.obj("documentId", ref.docId()));
            return issued;
        });
        mail.sendOtp(ref.recipient(), OtpService.PURPOSE_SHARE_ACCESS, code, OtpService.TTL_MINUTES);
        Map<String, Object> body = Json.obj("message", "If that email is the recipient of this link, a 6-digit code has been sent",
                "ttlMinutes", OtpService.TTL_MINUTES);
        return new ShareOtpResult(body, mail.devMode() ? code : null);
    }

    // ---- Phase 5: verify OTP (+ passcode) and open the gated link ----
    public Map<String, Object> openWithOtp(String token, String email, String code, String passcode, String ip) {
        String validated = Validator.email(email);
        db.with(c -> {
            Models.Share s = findLink(c, token);
            throwIfUnusable(s, documentStatus(c, s.documentId));
            if (!s.otpRequired || s.otpRecipientEmail == null)
                throw AppException.validation("requireOtp", "This share link does not use OTP gating");
            if (!s.otpRecipientEmail.equalsIgnoreCase(validated))
                throw AppException.forbidden("This email is not authorized for this link");
            otps.verify(c, OtpService.PURPOSE_SHARE_ACCESS, null, UUID.fromString(s.id), s.otpRecipientEmail, code);
            return null;
        });
        return doOpen(token, passcode, ip, true);
    }

    /** Shared open path; otpVerified=false enforces the Phase 5 401 gate for the plain route. */
    private Map<String, Object> doOpen(String token, String passcode, String ip, boolean otpVerified) {
        record Open(String permission, String title, String docType, String ownerName, int viewCount, String downloadTicket) {}
        Open open = db.tx(c -> {
            Models.Share s = findLink(c, token);
            String docStatus = documentStatus(c, s.documentId);
            throwIfUnusable(s, docStatus);
            if (s.otpRequired && !otpVerified)
                throw new AppException(401, "SHARE_OTP_REQUIRED",
                        "This link requires email verification before opening - request a code via /api/public/shares/:token/request-otp");
            if (s.passcodeRequired) {
                if (passcode == null || passcode.isBlank())
                    throw new AppException(403, "SHARE_PASSCODE_REQUIRED", "This link requires a passcode");
                if (!passwords.verify(passcode, passcodeHash(c, s.id)))
                    throw new AppException(403, "SHARE_PASSCODE_INVALID", "Wrong passcode");
            }
            int updated;
            try (PreparedStatement ps = c.prepareStatement(
                    "UPDATE shares SET view_count = view_count + 1 WHERE id = ? AND revoked_at IS NULL AND expires_at > now() "
                            + "AND (max_views IS NULL OR view_count < max_views)")) {
                ps.setObject(1, UUID.fromString(s.id));
                updated = ps.executeUpdate();
            }
            if (updated == 0) {
                // lost a race (revoked / expired / max views between select and update) - re-select to classify
                Models.Share again = fetchShare(c, UUID.fromString(s.id));
                String status = documentStatus(c, again.documentId);
                throwIfUnusable(again, status);
                throw AppException.conflict("Share link is no longer usable");
            }
            String ticket = null;
            if ("download".equals(s.permission)) {
                ticket = Text.token();
                tickets.put(ticket, new Ticket(UUID.fromString(s.id), System.currentTimeMillis() + TICKET_TTL_MS));
                if (tickets.size() > 10_000) tickets.values().removeIf(t -> t.expiresAt < System.currentTimeMillis());
            }
            notifications.notify(c, UUID.fromString(s.ownerId), "share_opened", "Your shared document was opened",
                    "'" + s.documentTitle + "' was opened via a share link", "share", s.id);
            documents.history(c, UUID.fromString(s.documentId), null, "share_opened",
                    Json.obj("shareId", s.id, "ip", ip == null ? "unknown" : ip), ip);
            // C-1/C-8: join this transaction (actor stays null - anonymous public opener). The old
            // no-connection overload opened a SECOND pool connection inside this open tx, and its
            // row could commit even if this tx rolled back (phantom audit).
            audit.insert(c, null, "share.opened", "share", s.id, ip, null, Json.obj("documentId", s.documentId));
            return new Open(s.permission, s.documentTitle, s.docType, s.ownerName, s.viewCount + 1, ticket);
        });
        Map<String, Object> out = Json.obj("title", open.title(), "docType", open.docType(), "ownerName", open.ownerName(),
                "permission", open.permission(), "viewCount", open.viewCount());
        if (open.downloadTicket() != null) out.put("downloadTicket", open.downloadTicket());
        return out;
    }

    // ---- public download via single-use ticket ----
    public DocumentService.FileOut downloadByTicket(String ticket, String ip) {
        if (ticket == null || ticket.isBlank()) throw AppException.notFound("Invalid download ticket");
        Ticket t = tickets.remove(ticket); // single use
        if (t == null) throw AppException.notFound("Invalid or already used download ticket");
        if (t.expiresAt < System.currentTimeMillis()) throw new AppException(410, "GONE", "Download ticket expired");
        record Blob(String docId, String storageKey, String sha256, String mime, String title, UUID shareId) {}
        Blob blob = db.with(c -> {
            try (PreparedStatement ps = c.prepareStatement(
                    "SELECT d.id AS doc_id, v.storage_key, v.sha256, v.mime_type, d.title, s.id AS share_id "
                            + "FROM shares s JOIN documents d ON d.id = s.document_id "
                            + "JOIN document_versions v ON v.document_id = d.id AND v.version_number = d.current_version "
                            + "WHERE s.id = ?")) {
                ps.setObject(1, t.shareId);
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) throw AppException.notFound("Shared document no longer exists");
                    return new Blob(rs.getString("doc_id"), rs.getString("storage_key"), rs.getString("sha256"),
                            rs.getString("mime_type"), rs.getString("title"), UUID.fromString(rs.getString("share_id")));
                }
            }
        });
        byte[] data;
        try {
            FileVault.Decrypted dec = vault.decryptBytes(blob.storageKey());
            if (!Text.constEq(dec.sha256(), blob.sha256())) throw new IllegalStateException("sha256 mismatch");
            data = dec.data();
        } catch (FileVault.TamperedException e) {
            audit.insert(null, "tamper_detected", "document", blob.docId(), ip, null, Json.obj("where", "share.download"));
            throw AppException.conflict("File integrity check failed - possible tampering");
        } catch (Exception e) {
            throw AppException.internal("Vault read failed: " + e.getMessage());
        }
        audit.insert(null, "share.downloaded", "share", blob.shareId().toString(), ip, null, Json.obj("documentId", blob.docId()));
        return new DocumentService.FileOut(data, blob.mime(),
                DocumentService.safeFilename(blob.title()) + DocumentService.extensionFor(blob.mime()));
    }

    // ---- internals ----
    private static void throwIfUnusable(Models.Share s, String docStatus) {
        AppException e = classify(s, docStatus);
        if (e != null) throw e;
    }

    /** Returns null when the share is usable, otherwise the AppException that explains why it is not. */
    private static AppException classify(Models.Share s, String docStatus) {
        if (s.revokedAt != null) return new AppException(409, "SHARE_REVOKED", "This share link was revoked by its owner");
        if (s.expiresAt == null || Timestamp.from(Instant.parse(s.expiresAt)).before(new Timestamp(System.currentTimeMillis())))
            return new AppException(410, "SHARE_EXPIRED", "This share link has expired");
        if (s.maxViews != null && s.viewCount >= s.maxViews)
            return new AppException(409, "SHARE_MAX_VIEWS", "This share link reached its maximum number of views");
        if ("deleted".equals(docStatus)) return new AppException(410, "GONE", "Shared document no longer exists");
        if ("pending_review".equals(docStatus)) return AppException.forbidden("Shared document is pending admin review");
        return null;
    }

    private Models.Share findLink(Connection c, String token) throws Exception {
        if (token == null || token.isBlank()) throw AppException.notFound("Share link not found");
        try (PreparedStatement ps = c.prepareStatement("SELECT id FROM shares WHERE link_token = ?")) {
            ps.setString(1, token);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) throw AppException.notFound("Share link not found");
                return fetchShare(c, UUID.fromString(rs.getString("id")));
            }
        }
    }

    private Models.Share fetchShare(Connection c, UUID shareId) throws Exception {
        try (PreparedStatement ps = c.prepareStatement(SELECT_SHARE + "WHERE s.id = ?")) {
            ps.setObject(1, shareId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) throw AppException.notFound("Share not found");
                return Rows.share(rs);
            }
        }
    }

    private Models.Share fetchOwnedShare(Connection c, UUID ownerId, UUID shareId) throws Exception {
        try (PreparedStatement ps = c.prepareStatement(SELECT_SHARE + "WHERE s.id = ? AND s.owner_id = ?")) {
            ps.setObject(1, shareId);
            ps.setObject(2, ownerId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) throw AppException.notFound("Share not found");
                return Rows.share(rs);
            }
        }
    }

    private Models.Document fetchOwnedDoc(Connection c, UUID ownerId, UUID docId) throws Exception {
        try (PreparedStatement ps = c.prepareStatement("SELECT * FROM documents WHERE id = ? AND owner_id = ?")) {
            ps.setObject(1, docId);
            ps.setObject(2, ownerId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) throw AppException.notFound("Document not found");
                return Rows.document(rs);
            }
        }
    }

    private String documentStatus(Connection c, String documentId) throws Exception {
        try (PreparedStatement ps = c.prepareStatement("SELECT status FROM documents WHERE id = ?")) {
            ps.setObject(1, UUID.fromString(documentId));
            try (ResultSet rs = ps.executeQuery()) { return rs.next() ? rs.getString(1) : "missing"; }
        }
    }

    private String passcodeHash(Connection c, String shareId) throws Exception {
        try (PreparedStatement ps = c.prepareStatement("SELECT passcode_hash FROM shares WHERE id = ?")) {
            ps.setObject(1, UUID.fromString(shareId));
            try (ResultSet rs = ps.executeQuery()) { rs.next(); return rs.getString(1); }
        }
    }

    private static Map<String, Object> publicMeta(Models.Share s) {
        return Json.obj("title", s.documentTitle, "docType", s.docType, "ownerName", s.ownerName,
                "createdAt", s.createdAt, "permission", s.permission, "passcodeRequired", s.passcodeRequired,
                "otpRequired", s.otpRequired, "maxViews", s.maxViews, "viewCount", s.viewCount, "expiresAt", s.expiresAt);
    }
}
