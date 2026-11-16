CREATE SCHEMA IF NOT EXISTS catalog;

CREATE TABLE IF NOT EXISTS catalog.items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type        TEXT        NOT NULL CHECK (type IN ('artist', 'track')),
    title       TEXT        NOT NULL,
    source      TEXT        NOT NULL CHECK (source IN ('musicbrainz', 'itunes', 'audius')),
    source_id   TEXT        NOT NULL,
    description TEXT,
    url         TEXT,
    metadata    JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (source, source_id)
);

CREATE INDEX idx_items_type ON catalog.items (type);
CREATE INDEX idx_items_source ON catalog.items (source);
CREATE INDEX idx_items_title ON catalog.items (title);
CREATE INDEX idx_items_created_at ON catalog.items (created_at);

CREATE TABLE IF NOT EXISTS catalog.item_relations (
    id         BIGSERIAL PRIMARY KEY,
    parent_id  UUID        NOT NULL REFERENCES catalog.items (id) ON DELETE CASCADE,
    child_id   UUID        NOT NULL REFERENCES catalog.items (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (parent_id, child_id)
);

CREATE INDEX idx_item_relations_child_id ON catalog.item_relations (child_id);