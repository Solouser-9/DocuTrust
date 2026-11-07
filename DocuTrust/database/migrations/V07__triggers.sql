-- ============================================================
-- DocuTrust Migration V07
-- Triggers: updated_at stamping, append-only guarantees,
-- and automatic history rows for document changes.
-- ============================================================

-- 1) Keep updated_at honest on mutable tables
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_touch     BEFORE UPDATE ON users     FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_documents_touch BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- 2) document_history is append-only: any UPDATE or DELETE raises
CREATE OR REPLACE FUNCTION forbid_history_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'document_history is append-only (audit trail)';
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_history_immutable
    BEFORE UPDATE OR DELETE ON document_history
    FOR EACH ROW EXECUTE FUNCTION forbid_history_mutation();

-- audit_logs likewise
CREATE OR REPLACE FUNCTION forbid_audit_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs is append-only (platform audit)';
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_immutable
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION forbid_audit_mutation();

-- 3) Auto-write a history row whenever a document row changes,
-- so no code path can silently skip the audit trail.
CREATE OR REPLACE FUNCTION log_document_change() RETURNS trigger AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO document_history (document_id, actor_id, action, detail)
        VALUES (NEW.id, NEW.owner_id, 'created',
                jsonb_build_object('title', NEW.title, 'doc_type', NEW.doc_type));
        INSERT INTO settings (user_id) VALUES (NEW.owner_id)
        ON CONFLICT (user_id) DO NOTHING;
    ELSIF (TG_OP = 'UPDATE') THEN
        IF NEW.current_version <> OLD.current_version THEN
            INSERT INTO document_history (document_id, actor_id, action, detail)
            VALUES (NEW.id, NEW.owner_id, 'version_added',
                    jsonb_build_object('version', NEW.current_version));
        ELSIF NEW.status <> OLD.status THEN
            INSERT INTO document_history (document_id, actor_id, action, detail)
            VALUES (NEW.id, NEW.owner_id, 'status_changed',
                    jsonb_build_object('from', OLD.status, 'to', NEW.status));
        END IF;
    END IF;
    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_documents_history
    AFTER INSERT OR UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION log_document_change();

-- 4) Sync current document sha256/size when a newer version lands
CREATE OR REPLACE FUNCTION sync_document_head() RETURNS trigger AS $$
BEGIN
    UPDATE documents d
       SET sha256 = NEW.sha256,
           file_size = NEW.file_size,
           mime_type = NEW.mime_type,
           current_version = NEW.version_number
     WHERE d.id = NEW.document_id;
    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_version_sync
    AFTER INSERT ON document_versions
    FOR EACH ROW EXECUTE FUNCTION sync_document_head();
