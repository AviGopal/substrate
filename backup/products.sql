-- =============================================================================
-- Table: products
-- =============================================================================
-- Stores the product catalog for a small online shop.
-- Designed for PostgreSQL (portable to MySQL/SQLite with minor adjustments).
-- =============================================================================

CREATE TABLE products (
    -- Primary key
    id              SERIAL PRIMARY KEY,

    -- Core product identity
    name            VARCHAR(255)   NOT NULL,
    slug            VARCHAR(255)   NOT NULL UNIQUE,
    sku             VARCHAR(64)    NOT NULL UNIQUE,

    -- Descriptive content
    description     TEXT,
    image_url       VARCHAR(2048),

    -- Categorization
    category        VARCHAR(100)   NOT NULL,

    -- Pricing (stored as integer cents to avoid floating-point issues)
    price_cents     INTEGER        NOT NULL CHECK (price_cents >= 0),

    -- Inventory
    stock_quantity  INTEGER        NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),

    -- Status flags
    is_active       BOOLEAN        NOT NULL DEFAULT TRUE,
    is_featured     BOOLEAN        NOT NULL DEFAULT FALSE,

    -- Weight for shipping calculations (kilograms, 2 decimal places)
    weight_kg       NUMERIC(6,2),

    -- Audit timestamps
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast category-based lookups
CREATE INDEX idx_products_category   ON products (category);

-- Index for filtering active products (most common query)
CREATE INDEX idx_products_is_active  ON products (is_active) WHERE is_active = TRUE;

-- Index for searching by name (prefix / LIKE queries)
CREATE INDEX idx_products_name       ON products (name);

-- Trigger to auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Design rationale
-- =============================================================================
-- id            : Auto-incrementing integer PK; simple, efficient for joins.
-- name          : 255 chars covers any real product name; NOT NULL (every
--                 product needs a display name).
-- slug          : URL-safe identifier derived from name; UNIQUE for clean
--                 URLs (e.g. /products/blue-t-shirt).
-- sku           : Stock-keeping unit from inventory systems; UNIQUE.
-- description   : Free-text; nullable because some products need no blurb.
-- image_url     : Nullable — a product may not yet have a photo.
-- category      : Single category string; sufficient for a small shop.
--                 (A separate categories table can be added later if needed.)
-- price_cents   : Integer cents, not a float. Avoids the classic floating-
--                 point rounding problem (0.1 + 0.2 ≠ 0.3). Display logic
--                 divides by 100. CHECK ensures no negative prices.
-- stock_quantity: 0 means out-of-stock; CHECK prevents negative values.
-- is_active     : Soft-delete / draft flag; inactive products are hidden
--                 from the storefront without removing historical data.
-- is_featured   : Allows surfacing specific products on the homepage.
-- weight_kg     : Nullable; not all products need shipping weight.
-- created_at / updated_at : Audit trail; updated_at is maintained by trigger.
-- =============================================================================
