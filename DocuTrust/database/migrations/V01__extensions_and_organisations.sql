-- ============================================================
-- DocuTrust Migration V01
-- Extensions, organisations and users (the security foundation)
-- Run order: V01 -> V08. Migrations are executed by the Java
-- Migrator (server) or manually in the Supabase SQL editor.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- fast fuzzy text search

-- ------------------------------------------------------------
-- ORGANISATIONS: a company/institution that owns a DocuTrust
-- workspace. Individuals get a NULL org (personal vault).
-- ------------------------------------------------------------
CREATE TABLE organisations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(120) NOT NULL,
    plan        VARCHAR(20)  NOT NULL DEFAULT 'free'
                CHECK (plan IN ('free','team','enterprise')),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- USERS: one row per person. Role is the heart of RBAC:
--   admin       -> platform staff, sees review queue + audit logs
--   org_manager -> manages members of their organisation
--   member      -> individual / regular vault user
-- ------------------------------------------------------------
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id        UUID REFERENCES organisations(id) ON DELETE SET NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,          -- pbkdf2$iter$salt$hash
    full_name     VARCHAR(120) NOT NULL,
    phone         VARCHAR(30),
    role          VARCHAR(20)  NOT NULL DEFAULT 'member'
                  CHECK (role IN ('admin','org_manager','member')),
    status        VARCHAR(20)  NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','active','suspended')),
    mfa_enabled   BOOLEAN      NOT NULL DEFAULT FALSE,
    mfa_secret    VARCHAR(64),                    -- Base32 TOTP secret
    email_verified BOOLEAN     NOT NULL DEFAULT FALSE,
    last_login_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- REFRESH TOKENS: rotating refresh tokens. Each login stores a
-- SHA-256 hash of the token (never the raw token). When a token
-- is reused after rotation we revoke the whole chain.
-- ------------------------------------------------------------
CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(128) NOT NULL UNIQUE,
    device      VARCHAR(120),
    ip          VARCHAR(45),
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ,
    replaced_by UUID,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- PASSWORD RESETS: single-use, 15-minute reset codes.
-- ------------------------------------------------------------
CREATE TABLE password_resets (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash  VARCHAR(128) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
