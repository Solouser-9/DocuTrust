-- ============================================================
-- DocuTrust Migration V04
-- Verification requests, notifications and user settings
-- ============================================================

-- ------------------------------------------------------------
-- VERIFICATION REQUESTS: the owner mints a verifiable proof-link
-- for a third party (bank, employer, school). A verifier opens
-- /api/public/verify/:token and sees tamper-evident proof:
-- sha256, issue/creation dates, status, without downloading bytes.
-- Flow: pending -> (owner approves) approved -> verifier checks.
-- Admin may reject suspicious requests (administrative review).
-- ------------------------------------------------------------
CREATE TABLE verification_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    requester_id    UUID NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
    verifier_name   VARCHAR(160) NOT NULL,
    verifier_org    VARCHAR(160),
    purpose         VARCHAR(300) NOT NULL,
    token           VARCHAR(64) UNIQUE NOT NULL,
    status          VARCHAR(20)  NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected','expired')),
    result          VARCHAR(30)
                    CHECK (result IN ('valid','invalid','tampered','expired','revoked')),
    requested_fields JSONB      NOT NULL DEFAULT '[]',
    decided_by      UUID REFERENCES users(id),
    decided_at      TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- NOTIFICATIONS: in-app alert inbox (expiry warnings, share
-- views, verification updates, admin decisions).
-- ------------------------------------------------------------
CREATE TABLE notifications (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        VARCHAR(40) NOT NULL,
    title       VARCHAR(160) NOT NULL,
    body        VARCHAR(500),
    entity_type VARCHAR(40),
    entity_id   UUID,
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- SETTINGS: per-user notification preferences (powers the
-- Notification Preferences screen).
-- ------------------------------------------------------------
CREATE TABLE settings (
    user_id              UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    expiry_alerts        BOOLEAN NOT NULL DEFAULT TRUE,
    share_alerts         BOOLEAN NOT NULL DEFAULT TRUE,
    verification_alerts  BOOLEAN NOT NULL DEFAULT TRUE,
    admin_alerts         BOOLEAN NOT NULL DEFAULT TRUE,
    reminder_offset_days INTEGER NOT NULL DEFAULT 14
                         CHECK (reminder_offset_days BETWEEN 1 AND 90)
);
