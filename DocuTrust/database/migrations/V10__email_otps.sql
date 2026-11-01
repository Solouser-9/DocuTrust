-- OTP Phase 1: email one-time passcodes. Codes are never stored in plaintext - only a
-- SHA-256 hex digest (64 chars). Rows are single-use (used_at), purpose-scoped and
-- attempt-capped. user_id is NULL for share-access OTPs, which belong to an anonymous
-- recipient identified by recipient_email + share_id instead of an account.
CREATE TABLE email_otps (
    id              UUID PRIMARY KEY,
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    share_id        UUID REFERENCES shares(id) ON DELETE CASCADE,
    recipient_email VARCHAR(255),
    purpose         VARCHAR(32) NOT NULL,
    otp_hash        VARCHAR(64) NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    used_at         TIMESTAMPTZ,
    attempts        INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_otps_target ON email_otps (purpose, recipient_email, created_at DESC);
CREATE INDEX idx_email_otps_user   ON email_otps (user_id, purpose, created_at DESC);
CREATE INDEX idx_email_otps_share  ON email_otps (share_id, purpose, created_at DESC);
