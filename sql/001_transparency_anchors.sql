-- =============================================================================
-- WINDI Transparency Anchoring Schema v1.0
-- Public verifiability through external hash anchoring
-- =============================================================================

-- TABLE: transparency_anchors (Anchor records)
CREATE TABLE IF NOT EXISTS transparency_anchors (
    id                          BIGSERIAL PRIMARY KEY,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Snapshot hashes
    issuer_registry_root_hash   CHAR(64) NOT NULL,
    wcaf_heads_root_hash        CHAR(64) NOT NULL,
    combined_root_hash          CHAR(64) NOT NULL,

    -- Snapshot metadata
    issuer_count                INTEGER NOT NULL DEFAULT 0,
    wcaf_document_count         INTEGER NOT NULL DEFAULT 0,
    snapshot_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Anchor status
    status                      TEXT NOT NULL DEFAULT 'PENDING',

    -- External anchor reference
    anchor_target               TEXT,
    anchor_ref                  TEXT,
    anchored_at                 TIMESTAMPTZ,
    anchor_proof                JSONB,

    CONSTRAINT anchor_status_check CHECK (
        status IN ('PENDING', 'ANCHORED', 'FAILED', 'EXPIRED')
    )
);

CREATE INDEX IF NOT EXISTS anchors_created_idx ON transparency_anchors(created_at DESC);
CREATE INDEX IF NOT EXISTS anchors_status_idx ON transparency_anchors(status);
CREATE INDEX IF NOT EXISTS anchors_combined_hash_idx ON transparency_anchors(combined_root_hash);

-- TABLE: anchor_targets (Supported anchor destinations)
CREATE TABLE IF NOT EXISTS anchor_targets (
    target_id           TEXT PRIMARY KEY,
    target_type         TEXT NOT NULL,
    config              JSONB,
    enabled             BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT target_type_check CHECK (
        target_type IN ('PUBLIC_LOG', 'NOTARY', 'BLOCKCHAIN', 'CERTIFICATE_TRANSPARENCY')
    )
);

-- Default targets
INSERT INTO anchor_targets (target_id, target_type, config) VALUES
    ('local-log', 'PUBLIC_LOG', '{"description": "Local append-only log for development"}'),
    ('windi-public-log', 'PUBLIC_LOG', '{"url": "https://transparency.windi.systems/log"}')
ON CONFLICT (target_id) DO NOTHING;

-- VIEW: Latest anchor
CREATE OR REPLACE VIEW latest_anchor AS
SELECT * FROM transparency_anchors
ORDER BY created_at DESC
LIMIT 1;

-- VIEW: Anchor history summary
CREATE OR REPLACE VIEW anchor_history AS
SELECT
    id,
    created_at,
    combined_root_hash,
    issuer_count,
    wcaf_document_count,
    status,
    anchor_target,
    anchored_at
FROM transparency_anchors
ORDER BY created_at DESC;

COMMENT ON TABLE transparency_anchors IS 'WINDI Transparency Anchoring - External hash publications';
COMMENT ON TABLE anchor_targets IS 'Supported external anchor destinations';
