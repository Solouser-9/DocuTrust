-- ============================================================
-- DocuTrust Migration V09
-- F-4: pin verification requests to the exact document version
-- proven at verification time. A later upload can no longer
-- silently re-point an approved proof link at different bytes.
-- ============================================================

ALTER TABLE verification_requests
    ADD COLUMN version_id UUID REFERENCES document_versions(id) ON DELETE SET NULL;

-- Backfill: pin every existing request to the version that is current
-- at migration time - the same version public verify was checking
-- before this column existed, so legacy behaviour is preserved exactly.
UPDATE verification_requests vr
   SET version_id = dv.id
  FROM document_versions dv
 WHERE dv.document_id = vr.document_id
   AND dv.version_number = (SELECT d.current_version FROM documents d WHERE d.id = vr.document_id);
