CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS contact_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(254) NOT NULL,
    phone VARCHAR(30) NOT NULL DEFAULT '',
    subject VARCHAR(160) NOT NULL,
    message TEXT NOT NULL CHECK (char_length(message) <= 3000),
    status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied', 'archived')),
    notification_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (notification_status IN ('pending', 'sent', 'not_configured', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contact_messages_status_created_idx
    ON contact_messages (status, created_at DESC);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(254) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'unsubscribed', 'suppressed')),
    consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    unsubscribed_at TIMESTAMPTZ,
    unsubscribe_token_hash CHAR(64) NOT NULL,
    source VARCHAR(50) NOT NULL DEFAULT 'website',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subscribers_email_unique
    ON newsletter_subscribers (lower(email));

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subscribers_token_unique
    ON newsletter_subscribers (unsubscribe_token_hash);

CREATE TABLE IF NOT EXISTS donation_enquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_reference VARCHAR(30) NOT NULL UNIQUE,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(254) NOT NULL,
    phone VARCHAR(30) NOT NULL DEFAULT '',
    intended_amount NUMERIC(14, 2) CHECK (intended_amount IS NULL OR intended_amount > 0),
    currency CHAR(3) NOT NULL DEFAULT 'SLE',
    purpose VARCHAR(40) NOT NULL CHECK (purpose IN ('general', 'skills-development', 'rehabilitation', 'entrepreneurship', 'agriculture')),
    message TEXT NOT NULL DEFAULT '' CHECK (char_length(message) <= 2000),
    status VARCHAR(30) NOT NULL DEFAULT 'awaiting_transfer' CHECK (status IN ('awaiting_transfer', 'pending_verification', 'confirmed', 'rejected', 'cancelled')),
    notification_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (notification_status IN ('pending', 'sent', 'not_configured', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS donation_enquiries_status_created_idx
    ON donation_enquiries (status, created_at DESC);

CREATE TABLE IF NOT EXISTS donation_transfer_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donation_enquiry_id UUID NOT NULL REFERENCES donation_enquiries(id) ON DELETE CASCADE,
    provider VARCHAR(30) NOT NULL CHECK (provider IN ('orange-money', 'afrimoney', 'bank-transfer', 'other')),
    transaction_reference VARCHAR(120) NOT NULL,
    sender_name VARCHAR(120) NOT NULL,
    verification_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'confirmed', 'rejected')),
    notification_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (notification_status IN ('pending', 'sent', 'not_configured', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified_at TIMESTAMPTZ,
    verified_by VARCHAR(254)
);

CREATE UNIQUE INDEX IF NOT EXISTS donation_transfer_provider_reference_unique
    ON donation_transfer_reports (provider, transaction_reference);

CREATE TABLE IF NOT EXISTS api_rate_limits (
    ip_hash CHAR(64) NOT NULL,
    route VARCHAR(80) NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 1 CHECK (request_count > 0),
    PRIMARY KEY (ip_hash, route, window_start)
);
