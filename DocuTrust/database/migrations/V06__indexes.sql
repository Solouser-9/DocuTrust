-- ============================================================
-- DocuTrust Migration V06
-- Performance indexes (partial + trigram for search)
-- ============================================================

-- Documents: the hottest query path is "my visible documents"
CREATE INDEX idx_documents_owner_alive ON documents(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_status      ON documents(status);
CREATE INDEX idx_documents_expires     ON documents(expires_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_folder      ON documents(folder_id);
CREATE INDEX idx_documents_type        ON documents(doc_type);

-- Trigram index makes ILIKE '%term%' use the index instead of a scan
CREATE INDEX idx_documents_title_trgm  ON documents USING gin (title gin_trgm_ops);

-- Shares: token lookups happen on every public link hit
CREATE INDEX idx_shares_doc     ON shares(document_id);
CREATE INDEX idx_shares_token   ON shares(link_token) WHERE revoked_at IS NULL;
CREATE INDEX idx_shares_recipient ON shares(shared_with_user_id) WHERE revoked_at IS NULL;

-- History & audit: always queried newest-first per entity
CREATE INDEX idx_history_doc    ON document_history(document_id, created_at DESC);
CREATE INDEX idx_audit_action   ON audit_logs(action, created_at DESC);
CREATE INDEX idx_audit_actor    ON audit_logs(actor_id, created_at DESC);

-- Notifications: inbox = mine, unread first, newest first
CREATE INDEX idx_notifications_user ON notifications(user_id, read_at, created_at DESC);

-- Tokens & users
CREATE INDEX idx_refresh_user   ON refresh_tokens(user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_users_org      ON users(org_id);
CREATE INDEX idx_users_role     ON users(role) WHERE status = 'active';
CREATE INDEX idx_reviews_status ON admin_reviews(status, created_at);
