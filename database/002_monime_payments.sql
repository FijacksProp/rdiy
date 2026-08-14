-- Run once after database/001_initial.sql and before enabling Monime checkout.

ALTER TABLE donation_enquiries
    DROP CONSTRAINT IF EXISTS donation_enquiries_status_check;

ALTER TABLE donation_enquiries
    ADD CONSTRAINT donation_enquiries_status_check CHECK (
        status IN (
            'awaiting_transfer', 'awaiting_payment', 'pending_verification',
            'confirmed', 'rejected', 'cancelled'
        )
    );

CREATE TABLE IF NOT EXISTS donation_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donation_enquiry_id UUID NOT NULL REFERENCES donation_enquiries(id) ON DELETE RESTRICT,
    provider VARCHAR(30) NOT NULL DEFAULT 'monime' CHECK (provider IN ('monime')),
    idempotency_key UUID NOT NULL UNIQUE,
    checkout_session_id VARCHAR(120) UNIQUE,
    external_payment_id VARCHAR(120),
    external_transaction_reference VARCHAR(160),
    amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
    currency CHAR(3) NOT NULL DEFAULT 'SLE' CHECK (currency = 'SLE'),
    payment_method VARCHAR(30),
    payment_provider_code VARCHAR(30),
    status VARCHAR(24) NOT NULL DEFAULT 'initializing' CHECK (
        status IN ('initializing', 'pending', 'completed', 'failed', 'cancelled', 'expired')
    ),
    failure_detail TEXT NOT NULL DEFAULT '' CHECK (char_length(failure_detail) <= 1000),
    receipt_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (
        receipt_status IN ('pending', 'sending', 'sent', 'not_configured', 'failed')
    ),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS donation_payments_status_created_idx
    ON donation_payments (status, created_at DESC);

CREATE INDEX IF NOT EXISTS donation_payments_enquiry_idx
    ON donation_payments (donation_enquiry_id, created_at DESC);

CREATE TABLE IF NOT EXISTS monime_webhook_events (
    event_id VARCHAR(160) PRIMARY KEY,
    event_name VARCHAR(120) NOT NULL,
    object_id VARCHAR(160) NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
