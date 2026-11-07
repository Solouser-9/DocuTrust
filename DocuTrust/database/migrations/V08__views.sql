-- ============================================================
-- DocuTrust Migration V08
-- Views used by dashboards (kept in SQL so logic is testable)
-- ============================================================

-- Expiry radar rows powering the "Expiring soon" screen
CREATE OR REPLACE VIEW v_expiring_documents AS
SELECT d.id, d.owner_id, d.title, d.doc_type, d.expires_at,
       (d.expires_at - CURRENT_DATE) AS days_left
  FROM documents d
 WHERE d.deleted_at IS NULL
   AND d.status IN ('active','expiring')
   AND d.expires_at IS NOT NULL
   AND d.expires_at <= CURRENT_DATE + d.reminder_days;

-- Admin dashboard counters
CREATE OR REPLACE VIEW v_admin_stats AS
SELECT
    (SELECT COUNT(*) FROM users)                          AS total_users,
    (SELECT COUNT(*) FROM users WHERE status='pending')   AS pending_users,
    (SELECT COUNT(*) FROM organisations)                  AS total_orgs,
    (SELECT COUNT(*) FROM documents WHERE deleted_at IS NULL) AS total_documents,
    (SELECT COUNT(*) FROM documents WHERE status='pending_review') AS queue_documents,
    (SELECT COUNT(*) FROM shares WHERE revoked_at IS NULL) AS active_shares,
    (SELECT COUNT(*) FROM verification_requests WHERE status='pending') AS pending_verifications;
