-- ============================================================
-- DocuTrust Migration V02
-- Folders and Documents (the vault core)
-- ============================================================

-- ------------------------------------------------------------
-- FOLDERS: simple single-level nesting (parent_id self-FK).
-- UNIQUE(owner,parent,name) stops duplicate folder names.
-- ------------------------------------------------------------
CREATE TABLE folders (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id   UUID NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    parent_id  UUID REFERENCES folders(id)           ON DELETE CASCADE,
    name       VARCHAR(120) NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (owner_id, parent_id, name)
);

-- ------------------------------------------------------------
-- DOCUMENTS: metadata only - bytes live encrypted in the vault.
-- status lifecycle: pending_review -> active -> expiring ->
-- expired -> archived / deleted (soft) -> permanent (hard).
-- review_status powers the administrative review process for
-- sensitive document types (medical, financial).
-- expires_at is the REAL-WORLD expiry printed on the document
-- (e.g. passport expiry date) - drives alerts & notifications.
-- ------------------------------------------------------------
CREATE TABLE documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    folder_id       UUID REFERENCES folders(id)        ON DELETE SET NULL,
    title           VARCHAR(200) NOT NULL,
    doc_type        VARCHAR(50)  NOT NULL DEFAULT 'other'
                    CHECK (doc_type IN ('passport','national_id','driver_licence',
                                        'certificate','contract','invoice','academic',
                                        'medical','financial','other')),
    description     TEXT,
    status          VARCHAR(20)  NOT NULL DEFAULT 'active'
                    CHECK (status IN ('pending_review','active','expiring',
                                      'expired','archived','deleted')),
    review_status   VARCHAR(20)  NOT NULL DEFAULT 'none'
                    CHECK (review_status IN ('none','submitted','approved','rejected')),
    current_version INTEGER      NOT NULL DEFAULT 1 CHECK (current_version >= 1),
    file_size       BIGINT       CHECK (file_size IS NULL OR file_size >= 0),
    mime_type       VARCHAR(120),
    sha256          CHAR(64),
    expires_at      DATE,
    reminder_days   INTEGER      NOT NULL DEFAULT 14
                    CHECK (reminder_days BETWEEN 1 AND 90),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

-- Every sensitive document upload must enter the admin review queue
ALTER TABLE documents ADD CONSTRAINT documents_sensitive_needs_review
    CHECK ( NOT (doc_type IN ('medical','financial') AND review_status <> 'submitted'
                 AND status = 'active') );
