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

import com.docutrust.AppException;
import com.docutrust.db.Database;
import com.docutrust.db.Rows;
import com.docutrust.http.Ctx;
import com.docutrust.model.Models;
import com.docutrust.util.Json;
import com.docutrust.util.Text;
import com.docutrust.util.Validator;
import com.docutrust.vault.FileVault;

// Verification requests: owner-minted proof links; public verify recomputes the document sha256
// (no bytes leave the vault) and renders JSON or an SEO HTML result page.
public final class VerifyService {
    private final Database db;
    private final FileVault vault;
    private final AuditService audit;
    private final DocumentService documents;

    public VerifyService(Database db, FileVault vault, AuditService audit, DocumentService documents) {
        this.db = db;
        this.vault = vault;
        this.audit = audit;
        this.documents = documents;
    }

    // H-3: owner-facing payloads carry the document type and the pinned version's sha256
    // (COALESCE falls back to the document digest for rows minted before version pinning).
    private static final String SELECT_REQ =
            "SELECT vr.*, d.title AS document_title, d.doc_type AS document_doc_type, "
                    + "COALESCE(pv.sha256, d.sha256) AS document_sha256, u.full_name AS owner_name "
                    + "FROM verification_requests vr JOIN documents d ON d.id = vr.document_id "
                    + "LEFT JOIN document_versions pv ON pv.id = vr.version_id "
                    + "JOIN users u ON u.id = vr.requester_id ";

    // ---- owner endpoints ----
    public Map<String, Object> create(Models.User me, Map<String, Object> b, String ip) {
        UUID docId = DocumentService.parseUuid(Ctx.str(b, "documentId"), "documentId");
        String verifierName = Validator.required(Ctx.str(b, "verifierName"), "verifierName", 160);
        String verifierOrg = Validator.optional(Ctx.str(b, "verifierOrg"), "verifierOrg", 160);
        String purpose = Validator.required(Ctx.str(b, "purpose"), "purpose", 300);
        Integer expiresInDays = Ctx.intVal(b, "expiresInDays");
        if (expiresInDays == null || expiresInDays < 1 || expiresInDays > 365)
            throw AppException.validation("expiresInDays", "expiresInDays must be between 1 and 365");

        return db.tx(c -> {
            Models.Document d = fetchOwnedDoc(c, UUID.fromString(me.id), docId);
            if ("deleted".equals(d.status)) throw AppException.notFound("Document not found");
            if ("pending_review".equals(d.status)) throw AppException.forbidden("Document is pending admin review - verification opens after approval");
            // F-4: pin the request to the version that is current at mint time, so a later
            // upload can never silently re-point an approved proof link at different bytes.
            UUID pinnedVersionId;
            try (PreparedStatement ps = c.prepareStatement(
                    "SELECT id FROM document_versions WHERE document_id = ? AND version_number = ?")) {
                ps.setObject(1, docId);
                ps.setInt(2, d.currentVersion);
                try (ResultSet rsv = ps.executeQuery()) {
                    if (!rsv.next()) throw AppException.conflict("Document has no versions to verify");
                    pinnedVersionId = UUID.fromString(rsv.getString(1));
                }
            }
            String token = Text.token();
            try (PreparedStatement ps = c.prepareStatement(
                    "INSERT INTO verification_requests (document_id, requester_id, verifier_name, verifier_org, purpose, token, version_id, expires_at) "
                            + "VALUES (?,?,?,?,?,?,?, now() + make_interval(days => ?))")) {
                ps.setObject(1, docId);
                ps.setObject(2, UUID.fromString(me.id));
                ps.setString(3, verifierName);
                ps.setString(4, verifierOrg);
                ps.setString(5, purpose);
                ps.setString(6, token);
                ps.setObject(7, pinnedVersionId);
                ps.setInt(8, expiresInDays);
                ps.executeUpdate();
            }
            documents.history(c, docId, UUID.fromString(me.id), "verification_requested",
                    Json.obj("verifier", verifierName, "purpose", purpose), ip);
            audit.insert(c, UUID.fromString(me.id), "verification.created", "verification_request", null, ip, null,
                    Json.obj("documentId", docId.toString(), "verifier", verifierName));
            return fetchOne(c, "vr.token = ?", token).toMap();
        });
    }

    public List<Map<String, Object>> list(Models.User me) {
        return db.with(c -> {
            List<Map<String, Object>> out = new ArrayList<>();
            try (PreparedStatement ps = c.prepareStatement(SELECT_REQ + "WHERE vr.requester_id = ? ORDER BY vr.created_at DESC")) {
                ps.setObject(1, UUID.fromString(me.id));
                try (ResultSet rs = ps.executeQuery()) { while (rs.next()) out.add(Rows.verification(rs).toMap()); }
            }
            return out;
        });
    }

    public Map<String, Object> detail(Models.User me, UUID id) {
        return db.with(c -> fetchOwned(c, UUID.fromString(me.id), id).toMap());
    }

    public Map<String, Object> decide(Models.User me, UUID id, boolean approved, String ip) {
        return db.tx(c -> {
            try (PreparedStatement ps = c.prepareStatement(
                    "UPDATE verification_requests SET status = ?, decided_by = ?, decided_at = now() "
                            + "WHERE id = ? AND requester_id = ? AND status = 'pending'")) {
                ps.setString(1, approved ? "approved" : "rejected");
                ps.setObject(2, UUID.fromString(me.id));
                ps.setObject(3, id);
                ps.setObject(4, UUID.fromString(me.id));
                if (ps.executeUpdate() == 0) throw AppException.notFound("Request not found or already decided");
            }
            audit.insert(c, UUID.fromString(me.id), approved ? "verification.approved" : "verification.rejected",
                    "verification_request", id.toString(), ip, null, Json.obj());
            return fetchOwned(c, UUID.fromString(me.id), id).toMap();
        });
    }

    // ---- public verify ----
    public record VerifyResult(int status, Map<String, Object> payload) {}

    public VerifyResult publicVerify(String token, boolean html) {
        record Row(Models.VerificationRequest req, String docStatus, String docSha, String docCreatedAt,
                   String storageKey, String versionSha, Integer pinnedVersion, Integer currentVersion) {}
        Row row = db.with(c -> {
            Models.VerificationRequest req = findByToken(c, token);
            String docStatus = null, docSha = null, docCreatedAt = null, storageKey = null, versionSha = null;
            Integer pinnedVersion = null, currentVersion = null;
            // F-4: prove the pinned version, not "whatever is current today". Requests minted
            // before V09 carry no pin and fall back to the current version (old behaviour).
            UUID pinnedId;
            if (req.versionId != null) {
                pinnedId = UUID.fromString(req.versionId);
            } else {
                try (PreparedStatement psv = c.prepareStatement(
                        "SELECT v.id FROM document_versions v JOIN documents d ON d.id = v.document_id "
                                + "WHERE v.document_id = ? AND v.version_number = d.current_version")) {
                    psv.setObject(1, UUID.fromString(req.documentId));
                    try (ResultSet rsv = psv.executeQuery()) {
                        pinnedId = rsv.next() ? UUID.fromString(rsv.getString(1)) : null;
                    }
                }
            }
            try (PreparedStatement ps = c.prepareStatement(
                    "SELECT d.status, d.sha256, d.created_at, d.current_version, "
                            + "v.storage_key, v.sha256 AS version_sha, v.version_number AS pinned_version "
                            + "FROM documents d LEFT JOIN document_versions v ON v.id = ? WHERE d.id = ?")) {
                ps.setObject(1, pinnedId);
                ps.setObject(2, UUID.fromString(req.documentId));
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) {
                        docStatus = rs.getString("status");
                        docSha = Rows.str(rs, "sha256");
                        docCreatedAt = Rows.ts(rs, "created_at");
                        currentVersion = rs.getInt("current_version");
                        storageKey = Rows.str(rs, "storage_key");
                        versionSha = Rows.str(rs, "version_sha");
                        pinnedVersion = Rows.integer(rs, "pinned_version");
                    }
                }
            }
            return new Row(req, docStatus, docSha, docCreatedAt, storageKey, versionSha, pinnedVersion, currentVersion);
        });

        Models.VerificationRequest req = row.req();
        String result;
        if ("pending".equals(req.status) || "rejected".equals(req.status))
            throw new AppException(410, "GONE", "This verification request is not active");
        if ("expired".equals(req.status) || isExpired(req.expiresAt)) {
            result = "expired";
            persist(req.id, "expired");
        } else if (row.docStatus() == null) {
            result = "invalid"; // document row gone (hard delete)
        } else if ("deleted".equals(row.docStatus())) {
            result = "revoked";
            persist(req.id, "revoked");
        } else if (row.storageKey() == null || row.versionSha() == null) {
            result = "invalid";
        } else {
            try {
                FileVault.Decrypted dec = vault.decryptBytes(row.storageKey());
                result = Text.constEq(dec.sha256(), row.versionSha()) ? "valid" : "tampered";
            } catch (FileVault.TamperedException e) {
                result = "tampered";
            } catch (Exception e) {
                throw AppException.internal("Vault read failed: " + e.getMessage());
            }
            if ("tampered".equals(result))
                audit.insert(null, "verification.tamper_detected", "verification_request", req.id, null, null,
                        Json.obj("documentId", req.documentId));
            persist(req.id, result);
        }

        // F-4: a newer upload supersedes the proof - the seal still verifies the pinned
        // bytes, but both JSON and HTML consumers are told a newer version exists.
        boolean superseded = row.pinnedVersion() != null && row.currentVersion() != null
                && row.pinnedVersion().intValue() != row.currentVersion().intValue();
        Map<String, Object> proof = Json.obj(
                "documentTitle", req.documentTitle, "docType", docTypeOf(row.docStatus(), req.documentId),
                "ownerName", req.ownerName, "sha256", row.versionSha() == null ? row.docSha() : row.versionSha(),
                "issuedAt", row.docCreatedAt(), "verifiedAt", Text.iso(Instant.now()), "verificationId", req.id,
                "version", row.pinnedVersion(), "currentVersion", row.currentVersion(), "superseded", superseded);
        Map<String, Object> payload = Json.obj("status", result, "proof", proof);
        return new VerifyResult(200, html ? null : payload);
    }

    public String htmlPage(String token) {
        Map<String, Object> payload = publicVerify(token, false).payload();
        String status = String.valueOf(payload.get("status"));
        @SuppressWarnings("unchecked")
        Map<String, Object> proof = (Map<String, Object>) payload.get("proof");
        boolean valid = "valid".equals(status);
        String title = "DocuTrust - " + esc(String.valueOf(proof.get("documentTitle")));
        String desc = "Verification result: " + status + ". Issued by " + esc(nvl(proof.get("ownerName")))
                + " on DocuTrust, the secure document vault.";
        StringBuilder h = new StringBuilder();
        h.append("<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\">")
                .append("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">")
                .append("<title>").append(title).append("</title>")
                .append("<meta name=\"description\" content=\"").append(desc).append("\">")
                .append("<meta name=\"robots\" content=\"noindex\">")
                .append("<meta property=\"og:title\" content=\"").append(title).append("\">")
                .append("<meta property=\"og:description\" content=\"").append(desc).append("\">")
                .append("<meta property=\"og:type\" content=\"website\">")
                .append("<meta name=\"twitter:card\" content=\"summary\">")
                // A-3/F-2: JSON embedded in a <script> block must escape <, >, &, / - a raw
                // </script> inside a document title would close the block and inject markup.
                .append("<script type=\"application/ld+json\">")
                .append(jsonLdSafe(Json.write(Json.obj(
                        "@context", "https://schema.org", "@type", "CreativeWork",
                        "name", nvl(proof.get("documentTitle")), "author", nvl(proof.get("ownerName")),
                        "dateCreated", nvl(proof.get("issuedAt")),
                        "encodingFormat", "verification/" + status)))).append("</script>")
                .append("<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f4f6fa;"
                        + "margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center}"
                        + ".card{background:#fff;border-radius:16px;box-shadow:0 10px 40px rgba(20,40,80,.12);"
                        + "padding:48px;max-width:520px;width:92%;text-align:center}"
                        + ".badge{display:inline-block;padding:8px 22px;border-radius:999px;font-weight:700;"
                        + "letter-spacing:.08em;text-transform:uppercase;font-size:14px;color:#fff;"
                        + "background:").append(valid ? "#16a34a" : "tampered".equals(status) ? "#dc2626" : "#64748b").append(";}"
                        + "h1{font-size:22px;margin:24px 0 8px;color:#0f172a}"
                        + "p{color:#475569;margin:4px 0;font-size:14px;line-height:1.6}"
                        + "code{background:#f1f5f9;border-radius:6px;padding:2px 8px;font-size:12px;word-break:break-all}"
                        + "footer{margin-top:28px;font-size:12px;color:#94a3b8}</style></head><body>")
                .append("<div class=\"card\"><span class=\"badge\">").append(status).append("</span>")
                .append("<h1>").append(esc(nvl(proof.get("documentTitle")))).append("</h1>")
                .append("<p>Issued by <strong>").append(esc(nvl(proof.get("ownerName")))).append("</strong></p>")
                .append("<p>Document type: ").append(esc(nvl(proof.get("docType")))).append("</p>")
                .append("<p>SHA-256 integrity proof:<br><code>").append(esc(nvl(proof.get("sha256")))).append("</code></p>")
                .append("<p>Issued at ").append(esc(nvl(proof.get("issuedAt")))).append(" &middot; verified at ")
                .append(esc(nvl(proof.get("verifiedAt")))).append("</p>");
        if (Boolean.TRUE.equals(proof.get("superseded"))) {
            h.append("<p style=\"background:#fffbeb;border:1px solid #f59e0b;border-radius:10px;padding:10px 14px;"
                    + "color:#b45309;font-size:13px;margin-top:14px\">A newer version (v")
                    .append(esc(nvl(proof.get("currentVersion"))))
                    .append(") of this document exists - this sealed proof covers v")
                    .append(esc(nvl(proof.get("version"))))
                    .append(".</p>");
        }
        h.append("<footer>Verified by DocuTrust &middot; document contents never leave the encrypted vault</footer></div></body></html>");
        return h.toString();
    }

    // ---- internals ----
    private void persist(String requestId, String result) {
        try {
            db.tx(c -> {
                try (PreparedStatement ps = c.prepareStatement("UPDATE verification_requests SET result = ? WHERE id = ?")) {
                    ps.setString(1, result);
                    ps.setObject(2, UUID.fromString(requestId));
                    ps.executeUpdate();
                }
                return null;
            });
        } catch (Exception e) {
            System.err.println("[verify] result persist failed: " + e.getMessage());
        }
    }

    private String docTypeOf(String docStatus, String documentId) {
        if (docStatus == null) return "unknown";
        return db.with(c -> {
            try (PreparedStatement ps = c.prepareStatement("SELECT doc_type FROM documents WHERE id = ?")) {
                ps.setObject(1, UUID.fromString(documentId));
                try (ResultSet rs = ps.executeQuery()) { return rs.next() ? rs.getString(1) : "unknown"; }
            }
        });
    }

    private Models.VerificationRequest findByToken(Connection c, String token) throws Exception {
        if (token == null || token.isBlank()) throw AppException.notFound("Verification link not found");
        return fetchOne(c, "vr.token = ?", token);
    }

    private Models.VerificationRequest fetchOne(Connection c, String predicate, String value) throws Exception {
        try (PreparedStatement ps = c.prepareStatement(SELECT_REQ + "WHERE " + predicate + " LIMIT 1")) {
            ps.setString(1, value);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) throw AppException.notFound("Verification link not found");
                return Rows.verification(rs);
            }
        }
    }

    private Models.VerificationRequest fetchOwned(Connection c, UUID ownerId, UUID id) throws Exception {
        try (PreparedStatement ps = c.prepareStatement(SELECT_REQ + "WHERE vr.id = ? AND vr.requester_id = ?")) {
            ps.setObject(1, id);
            ps.setObject(2, ownerId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) throw AppException.notFound("Verification request not found");
                return Rows.verification(rs);
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

    private static boolean isExpired(String iso) {
        try { return Timestamp.from(Instant.parse(iso)).before(new Timestamp(System.currentTimeMillis())); }
        catch (Exception e) { return true; }
    }

    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&#39;");
    }

    // A-3/F-2: JSON-safe escapes that keep the LD-JSON payload parseable while making it
    // impossible for the HTML parser to see a closing </script> tag. Each escape decodes
    // back to the original character when a JSON parser reads the block.
    private static String jsonLdSafe(String json) {
        return json.replace("<", "\\u003c").replace(">", "\\u003e")
                .replace("&", "\\u0026").replace("/", "\\/");
    }

    private static String nvl(Object o) { return o == null ? "" : String.valueOf(o); }
}
