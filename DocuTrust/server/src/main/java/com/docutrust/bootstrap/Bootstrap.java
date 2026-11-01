package com.docutrust.bootstrap;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.docutrust.auth.PasswordService;
import com.docutrust.config.Config;
import com.docutrust.db.Database;
import com.docutrust.util.Json;
import com.docutrust.util.Text;
import com.docutrust.vault.FileVault;

// Demo seed: runs once on an empty users table. Creates a demo org, 7 users, folders, five
// real (hand-built PDF) documents stored through the FileVault exactly like uploads, a live
// share link, an approved verification request and a few notifications - all in one transaction.
public final class Bootstrap {
    private Bootstrap() {}

    public static void seed(Database db, FileVault vault, PasswordService passwords, boolean enabled, String dbUrl) {
        if (!enabled) {
            System.out.println("[bootstrap] SEED_DEMO=false - skipping demo seed");
            return;
        }
        if (!Config.isLocalDbUrl(dbUrl)) {
            System.err.println("[bootstrap] SEED_DEMO=true with a non-local database - refusing to seed demo accounts (demo credentials are in source control)");
            throw new IllegalStateException("SEED_DEMO=true is only permitted with a localhost database. Demo credentials are in source control.");
        }
        boolean empty = db.with(c -> {
            try (PreparedStatement ps = c.prepareStatement("SELECT COUNT(*) FROM users");
                 ResultSet rs = ps.executeQuery()) {
                rs.next();
                return rs.getLong(1) == 0;
            }
        });
        if (!empty) {
            System.out.println("[bootstrap] users table not empty - skipping demo seed");
            return;
        }
        List<String> storageKeys = new ArrayList<>();
        try {
            db.tx(c -> {
                UUID orgId = insert(c, "INSERT INTO organisations (name) VALUES ('DocuTrust Demo Org') RETURNING id", null);
                UUID admin = insertUser(c, passwords, "admin@docutrust.app", "Admin#2024", "Ada Admin", "admin", null);
                UUID manager = insertUser(c, passwords, "manager@docutrust.app", "Manager#2024", "Morgan Manager", "org_manager", orgId);
                UUID member = insertUser(c, passwords, "member@docutrust.app", "Member#2024", "Sam Member", "member", orgId);
                insertUser(c, passwords, "student1@docutrust.app", "Student#2024", "Stu One", "member", orgId);
                insertUser(c, passwords, "student2@docutrust.app", "Student#2024", "Stu Two", "member", orgId);
                insertUser(c, passwords, "student3@docutrust.app", "Student#2024", "Stu Three", "member", orgId);
                System.out.println("[bootstrap] seeded org + 7 users (admin/manager/member/student1-3@docutrust.app)");

                UUID fIdentity = insert(c, "INSERT INTO folders (owner_id, name) VALUES (?, 'Identity') RETURNING id", member);
                UUID fWork = insert(c, "INSERT INTO folders (owner_id, name) VALUES (?, 'Work') RETURNING id", member);

                LocalDate today = LocalDate.now();
                UUID passport = document(c, vault, storageKeys, member, fIdentity, "International Passport", "passport",
                        "Republic of Meridia passport, full validity", "active", "none",
                        today.plusDays(30), 14, "DocuTrust demo - International Passport", "Issued by the Republic of Meridia. Valid for travel worldwide.");
                UUID licence = document(c, vault, storageKeys, member, fIdentity, "Driver Licence", "driver_licence",
                        "Category B driving licence", "expiring", "none",
                        today.plusDays(3), 14, "DocuTrust demo - Driver Licence", "Category B, renewable every five years.");
                document(c, vault, storageKeys, member, fIdentity, "Old Visa", "national_id",
                        "Expired travel visa kept for records", "expired", "none",
                        today.minusDays(10), 14, "DocuTrust demo - Old Visa", "Single-entry visa, no longer valid.");
                document(c, vault, storageKeys, member, fWork, "Medical Report", "medical",
                        "Annual occupational health check", "pending_review", "submitted",
                        null, 14, "DocuTrust demo - Medical Report", "Routine occupational health screening results. Confidential.");
                UUID contract = document(c, vault, storageKeys, member, fWork, "Employment Contract", "contract",
                        "Full-time employment agreement with Meridia Labs", "active", "none",
                        null, 14, "DocuTrust demo - Employment Contract", "Signed full-time employment agreement.");

                // admins get notified about the sensitive upload queued above
                try (PreparedStatement ps = c.prepareStatement(
                        "INSERT INTO admin_reviews (target_type, target_id, submitted_by, reason) "
                                + "SELECT 'document', id, ?, 'Sensitive document type requires review' FROM documents WHERE title = 'Medical Report'")) {
                    ps.setObject(1, member);
                    ps.executeUpdate();
                }
                try (PreparedStatement ps = c.prepareStatement("SELECT id FROM users WHERE role = 'admin'")) {
                    try (ResultSet rs = ps.executeQuery()) {
                        while (rs.next()) {
                            notifyRow(c, UUID.fromString(rs.getString("id")), "admin_review",
                                    "Sensitive document awaiting review",
                                    "Sam Member uploaded 'Medical Report' (medical) - review required");
                        }
                    }
                }

                // one active link share on the passport
                UUID shareId = UUID.randomUUID();
                try (PreparedStatement ps = c.prepareStatement(
                        "INSERT INTO shares (id, document_id, owner_id, link_token, permission, expires_at) VALUES (?,?,?,?,'view', now() + interval '7 days')")) {
                    ps.setObject(1, shareId);
                    ps.setObject(2, passport);
                    ps.setObject(3, member);
                    ps.setString(4, Text.token());
                    ps.executeUpdate();
                }
                history(c, passport, member, "shared", Json.obj("shareId", shareId.toString(), "permission", "view", "kind", "link"));

                // one approved verification request on the contract (F-4: pinned to its current version)
                UUID verId = UUID.randomUUID();
                try (PreparedStatement ps = c.prepareStatement(
                        "INSERT INTO verification_requests (id, document_id, requester_id, verifier_name, verifier_org, purpose, token, status, version_id, decided_by, decided_at, expires_at) "
                                + "VALUES (?,?,?,?,?,?,?,'approved',"
                                + "(SELECT dv.id FROM document_versions dv JOIN documents d ON d.id = dv.document_id"
                                + " WHERE dv.document_id = ? AND dv.version_number = d.current_version),"
                                + "?, now(), now() + interval '30 days')")) {
                    ps.setObject(1, verId);
                    ps.setObject(2, contract);
                    ps.setObject(3, member);
                    ps.setString(4, "Acme Employer");
                    ps.setString(5, "Acme Corp HR");
                    ps.setString(6, "Employment eligibility check");
                    ps.setString(7, Text.token());
                    ps.setObject(8, contract);
                    ps.setObject(9, member);
                    ps.executeUpdate();
                }
                history(c, contract, member, "verification_requested", Json.obj("verifier", "Acme Employer", "purpose", "Employment eligibility check"));

                try (PreparedStatement ps = c.prepareStatement(
                        "INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id) VALUES (?,?,?,?, 'document', ?)")) {
                    ps.setObject(1, member);
                    ps.setString(2, "expiry_warning");
                    ps.setString(3, "Document expiring soon");
                    ps.setString(4, "'Driver Licence' is approaching its expiry date");
                    ps.setObject(5, licence);
                    ps.executeUpdate();
                }
                try (PreparedStatement ps = c.prepareStatement(
                        "INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id) VALUES (?,?,?,?, 'share', ?)")) {
                    ps.setObject(1, member);
                    ps.setString(2, "share_opened");
                    ps.setString(3, "Your shared document was opened");
                    ps.setString(4, "'International Passport' was opened via a share link");
                    ps.setObject(5, shareId);
                    ps.executeUpdate();
                }
                try (PreparedStatement ps = c.prepareStatement(
                        "INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id) VALUES (?,?,?,?, 'verification_request', ?)")) {
                    ps.setObject(1, member);
                    ps.setString(2, "verification_approved");
                    ps.setString(3, "Verification request approved");
                    ps.setString(4, "'Employment Contract' is now verifiable by Acme Employer");
                    ps.setObject(5, verId);
                    ps.executeUpdate();
                }
                return null;
            });
            System.out.println("[bootstrap] demo seed complete: 2 folders, 5 documents, 1 share, 1 verification");
        } catch (Exception e) {
            System.err.println("[bootstrap] demo seed failed: " + e);
        }
    }

    // ---- helpers ----
    private static UUID insertUser(java.sql.Connection c, PasswordService passwords, String email, String password,
                                   String fullName, String role, UUID orgId) throws Exception {
        UUID id = UUID.randomUUID();
        try (PreparedStatement ps = c.prepareStatement(
                "INSERT INTO users (id, org_id, email, password_hash, full_name, role, status, email_verified) "
                        + "VALUES (?,?,?,?,?,?,'active',TRUE)")) {
            ps.setObject(1, id);
            ps.setObject(2, orgId);
            ps.setString(3, email);
            ps.setString(4, passwords.hash(password));
            ps.setString(5, fullName);
            ps.setString(6, role);
            ps.executeUpdate();
        }
        return id;
    }

    /** Creates a document + version 1 through the FileVault exactly like a real upload. */
    private static UUID document(java.sql.Connection c, FileVault vault, List<String> keys, UUID ownerId, UUID folderId,
                                 String title, String docType, String description, String status, String reviewStatus,
                                 LocalDate expiresAt, int reminderDays, String pdfTitle, String pdfLine) throws Exception {
        byte[] pdf = pdf(pdfTitle, pdfLine);
        String storageKey = FileVault.newStorageKey();
        FileVault.Stored stored = vault.encrypt(new ByteArrayInputStream(pdf), storageKey);
        keys.add(storageKey);
        UUID docId = UUID.randomUUID();
        try (PreparedStatement ps = c.prepareStatement(
                "INSERT INTO documents (id, owner_id, folder_id, title, doc_type, description, status, review_status, expires_at, reminder_days) "
                        + "VALUES (?,?,?,?,?,?,?,?,?,?)")) {
            ps.setObject(1, docId);
            ps.setObject(2, ownerId);
            ps.setObject(3, folderId);
            ps.setString(4, title);
            ps.setString(5, docType);
            ps.setString(6, description);
            ps.setString(7, status);
            ps.setString(8, reviewStatus);
            ps.setObject(9, expiresAt);
            ps.setInt(10, reminderDays);
            ps.executeUpdate();
        }
        try (PreparedStatement ps = c.prepareStatement(
                "INSERT INTO document_versions (document_id, version_number, storage_key, sha256, file_size, mime_type, note, uploaded_by) "
                        + "VALUES (?,1,?,?,?,?,?,?)")) {
            ps.setObject(1, docId);
            ps.setString(2, storageKey);
            ps.setString(3, stored.sha256());
            ps.setLong(4, stored.size());
            ps.setString(5, "application/pdf");
            ps.setString(6, "Initial version");
            ps.setObject(7, ownerId);
            ps.executeUpdate();
        }
        return docId;
    }

    private static void history(java.sql.Connection c, UUID docId, UUID actorId, String action, Map<String, Object> detail) throws Exception {
        try (PreparedStatement ps = c.prepareStatement(
                "INSERT INTO document_history (document_id, actor_id, action, detail) VALUES (?,?,?, CAST(? AS jsonb))")) {
            ps.setObject(1, docId);
            ps.setObject(2, actorId);
            ps.setString(3, action);
            ps.setString(4, Json.write(detail));
            ps.executeUpdate();
        }
    }

    private static UUID insert(java.sql.Connection c, String sql, UUID bind) throws Exception {
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            if (bind != null) ps.setObject(1, bind);
            try (ResultSet rs = ps.executeQuery()) { rs.next(); return UUID.fromString(rs.getString(1)); }
        }
    }

    private static void notifyRow(java.sql.Connection c, UUID userId, String type, String title, String body) throws Exception {
        try (PreparedStatement ps = c.prepareStatement(
                "INSERT INTO notifications (user_id, type, title, body, entity_type) VALUES (?,?,?,?, 'document')")) {
            ps.setObject(1, userId);
            ps.setString(2, type);
            ps.setString(3, title);
            ps.setString(4, body);
            ps.executeUpdate();
        }
    }

    /** Minimal but valid single-page PDF 1.4 document with a correct xref table. */
    static byte[] pdf(String title, String line) {
        String content = "BT /F1 22 Tf 72 716 Td (" + esc(title) + ") Tj ET\n"
                + "BT /F1 12 Tf 72 682 Td (" + esc(line) + ") Tj ET\n"
                + "BT /F1 9 Tf 72 64 Td (Generated by DocuTrust demo seed - confidential) Tj ET\n";
        StringBuilder o = new StringBuilder();
        o.append("%PDF-1.4\n");
        List<Integer> offsets = new ArrayList<>();
        String[] objs = {
                "<< /Type /Catalog /Pages 2 0 R >>",
                "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
                "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
                "<< /Length " + content.getBytes(StandardCharsets.ISO_8859_1).length + " >>\nstream\n" + content + "endstream",
                "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
        };
        for (int i = 0; i < objs.length; i++) {
            offsets.add(o.length());
            o.append(i + 1).append(" 0 obj\n").append(objs[i]).append("\nendobj\n");
        }
        int xref = o.length();
        o.append("xref\n0 ").append(objs.length + 1).append("\n0000000000 65535 f \n");
        for (int off : offsets) o.append(String.format("%010d 00000 n \n", off));
        o.append("trailer\n<< /Size ").append(objs.length + 1).append(" /Root 1 0 R >>\nstartxref\n")
                .append(xref).append("\n%%EOF\n");
        return o.toString().getBytes(StandardCharsets.ISO_8859_1);
    }

    private static String esc(String s) {
        return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)");
    }
}
