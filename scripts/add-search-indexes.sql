-- Sprint 9: Performance indexes for full-text search
-- Run against the production database: psql $DATABASE_URL < scripts/add-search-indexes.sql
-- These are idempotent (CREATE INDEX IF NOT EXISTS).

-- GIN index for full-text search over post content
CREATE INDEX IF NOT EXISTS idx_posts_content_fts
  ON posts USING GIN (to_tsvector('english', content));

-- GIN index for topic name search
CREATE INDEX IF NOT EXISTS idx_posts_topic_fts
  ON posts USING GIN (to_tsvector('english', topic))
  WHERE topic IS NOT NULL;

-- Composite index for cursor-based pagination on "new" sort
-- (already covered by schema, but explicit for clarity)
CREATE INDEX IF NOT EXISTS idx_posts_block_height_content_hash
  ON posts (block_height DESC, content_hash DESC);

-- Partial index for root posts (no parent) used in grouped feed
CREATE INDEX IF NOT EXISTS idx_posts_root_by_topic
  ON posts (topic_hash, block_height DESC)
  WHERE parent_hash IS NULL;

-- Index on burns for aggregation queries
CREATE INDEX IF NOT EXISTS idx_burns_target_type
  ON burns (target_hash, target_type);
