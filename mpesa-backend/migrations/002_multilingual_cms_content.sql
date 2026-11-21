ALTER TABLE church_content
  ADD COLUMN IF NOT EXISTS page_key VARCHAR(60),
  ADD COLUMN IF NOT EXISTS section_key VARCHAR(100),
  ADD COLUMN IF NOT EXISTS locale VARCHAR(10),
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS image_alt VARCHAR(250),
  ADD COLUMN IF NOT EXISTS display_order INTEGER,
  ADD COLUMN IF NOT EXISTS published BOOLEAN,
  ADD COLUMN IF NOT EXISTS updated_by BIGINT REFERENCES admin_users(id) ON DELETE SET NULL;

UPDATE church_content
SET page_key = 'legacy',
    section_key = content_key,
    locale = 'en',
    image_url = '',
    image_alt = '',
    display_order = 0,
    published = TRUE
WHERE page_key IS NULL
   OR section_key IS NULL
   OR locale IS NULL
   OR image_url IS NULL
   OR image_alt IS NULL
   OR display_order IS NULL
   OR published IS NULL;

UPDATE church_content
SET page_key = 'about', section_key = 'main'
WHERE content_key = 'about'
  AND page_key = 'legacy';

ALTER TABLE church_content
  ALTER COLUMN page_key SET DEFAULT 'legacy',
  ALTER COLUMN page_key SET NOT NULL,
  ALTER COLUMN section_key SET DEFAULT 'main',
  ALTER COLUMN section_key SET NOT NULL,
  ALTER COLUMN locale SET DEFAULT 'en',
  ALTER COLUMN locale SET NOT NULL,
  ALTER COLUMN image_url SET DEFAULT '',
  ALTER COLUMN image_url SET NOT NULL,
  ALTER COLUMN image_alt SET DEFAULT '',
  ALTER COLUMN image_alt SET NOT NULL,
  ALTER COLUMN display_order SET DEFAULT 0,
  ALTER COLUMN display_order SET NOT NULL,
  ALTER COLUMN published SET DEFAULT TRUE,
  ALTER COLUMN published SET NOT NULL;

ALTER TABLE church_content
  ADD CONSTRAINT church_content_display_order_nonnegative
  CHECK (display_order >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS idx_church_content_page_section_locale
  ON church_content (page_key, section_key, locale);

CREATE INDEX IF NOT EXISTS idx_church_content_publication_lookup
  ON church_content (page_key, locale, published, display_order);
