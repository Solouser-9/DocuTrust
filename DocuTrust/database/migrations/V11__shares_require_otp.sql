-- OTP Phase 5: OTP-gated share links. The owner pins the designated recipient email at
-- creation time; the link answers 401 SHARE_OTP_REQUIRED on open until that inbox proves
-- control of a freshly emailed code. Existing shares keep require_otp = FALSE.
ALTER TABLE shares ADD COLUMN require_otp         BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE shares ADD COLUMN otp_recipient_email VARCHAR(255);
