CREATE SCHEMA IF NOT EXISTS collections;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS collections.collections (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       TEXT        NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_collections_title ON collections.collections (title);
CREATE INDEX idx_collections_created_at ON collections.collections (created_at);

-- item_id не имеет внешнего ключа на catalog.items;
-- существование объекта проверяется через Catalog Service.
CREATE TABLE IF NOT EXISTS collections.collection_items (
    id            BIGSERIAL PRIMARY KEY,
    collection_id UUID        NOT NULL REFERENCES collections.collections (id) ON DELETE CASCADE,
    item_id       UUID        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (collection_id, item_id)
);

CREATE INDEX idx_collection_items_item_id ON collections.collection_items (item_id);