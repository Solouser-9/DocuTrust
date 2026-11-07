-- ============================================================
-- DocuTrust Migration V03
-- Versions (integrity), History (audit trail) and Shares (links)
-- ============================================================

-- ------------------------------------------------------------
-- DOCUMENT VERSIONS: every upload = new immutable version row.
-- sha256 pins the exact bytes; UNIQUE(document_id, version_number)
-- forbids two concurrent uploads from claiming the same version.
-- ------------------------------------------------------------
CREATE TABLE document_versions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id    UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL CHECK (version_number >= 1),
    storage_key    VARCHAR(200) NOT NULL,     -- encrypted object in vault
    sha256         CHAR(64)     NOT NULL,
    file_size      BIGINT       NOT NULL CHECK (file_size > 0),
    mime_type      VARCHAR(120) NOT NULL,
    note           VARCHAR(300),
    uploaded_by    UUID NOT NULL REFERENCES users(id),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (document_id, version_number)
);

-- ------------------------------------------------------------
-- DOCUMENT HISTORY: append-only audit trail per document.
-- A DB trigger (V07) makes UPDATE/DELETE impossible.
-- ------------------------------------------------------------
CREATE TABLE document_history (
    id          BIGSERIAL PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    actor_id    UUID REFERENCES users(id),
    action      VARCHAR(40) NOT NULL,   -- created, version_added, shared,
                                        -- share_revoked, downloaded, edited, ...
    detail      JSONB       NOT NULL DEFAULT '{}',
    ip          VARCHAR(45),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- SHARES: two kinds.
--   shared_with_user_id NOT NULL -> direct user-to-user share
--   link_token NOT NULL          -> public expiring link
-- Guards: expires_at (mandatory), optional max_views + passcode,
-- revoked_at for instant revocation. view_count enforced by the
-- service layer inside a transaction (no lost updates).
-- ------------------------------------------------------------
CREATE TABLE shares (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id        UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    owner_id           UUID NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
    shared_with_user_id UUID REFERENCES users(id)             ON DELETE CASCADE,
    link_token         VARCHAR(64) UNIQUE,
    permission         VARCHAR(20) NOT NULL DEFAULT 'view'
                       CHECK (permission IN ('view','download')),
    max_views          INTEGER CHECK (max_views IS NULL OR max_views > 0),
    view_count         INTEGER     NOT NULL DEFAULT 0 CHECK (view_count >= 0),
    passcode_hash      VARCHAR(128),
    expires_at         TIMESTAMPTZ NOT NULL,
    revoked_at         TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT shares_target_required
        CHECK (shared_with_user_id IS NOT NULL OR link_token IS NOT NULL),
    CONSTRAINT shares_link_token_format
        CHECK (link_token IS NULL OR char_length(link_token) = 43)
);
