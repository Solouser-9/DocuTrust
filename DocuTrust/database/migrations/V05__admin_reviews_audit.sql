-- ============================================================
-- DocuTrust Migration V05
-- Administrative review process + platform audit logs
-- ============================================================

-- ------------------------------------------------------------
-- ADMIN REVIEWS: the queue admins work through.
--   target_type=document  -> sensitive upload awaiting approval
--   target_type=user      -> suspicious account / report
--   target_type=verification -> flagged verification request
-- ------------------------------------------------------------
CREATE TABLE admin_reviews (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_type   VARCHAR(30) NOT NULL
                  CHECK (target_type IN ('document','user','verification')),
    target_id     UUID NOT NULL,
    submitted_by  UUID REFERENCES users(id),
    reviewer_id   UUID REFERENCES users(id),
    status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','rejected','escalated')),
    reason        VARCHAR(300),
    decision_note VARCHAR(500),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at   TIMESTAMPTZ
);

-- ------------------------------------------------------------
-- AUDIT LOGS: platform-wide, append-only (trigger in V07).
-- Records security-relevant events: logins, failures, downloads,
-- revocations, admin decisions. Meta is JSONB for flexibility.
-- ------------------------------------------------------------
CREATE TABLE audit_logs (
    id         BIGSERIAL PRIMARY KEY,
    actor_id   UUID REFERENCES users(id),
    action     VARCHAR(60) NOT NULL,
    entity_type VARCHAR(40) NOT NULL,
    entity_id  UUID,
    ip         VARCHAR(45),
    user_agent VARCHAR(200),
    meta       JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
