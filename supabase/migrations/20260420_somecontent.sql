-- ============================================================
-- 썸콘텐츠: 소셜 빅데이터 인사이트 플랫폼
-- 2026-04-20
-- ============================================================

-- 1. 수집 키워드 관리
CREATE TABLE IF NOT EXISTS sc_keywords (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword     text NOT NULL,
  category    text NOT NULL DEFAULT 'brand'
                CHECK (category IN ('brand', 'product', 'competitor', 'general')),
  is_active   boolean NOT NULL DEFAULT true,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sc_keywords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_sc_keywords" ON sc_keywords
  TO authenticated USING (true) WITH CHECK (true);

-- 2. 채널별 일별 언급량 집계
CREATE TABLE IF NOT EXISTS sc_mentions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id    uuid NOT NULL REFERENCES sc_keywords(id) ON DELETE CASCADE,
  channel       text NOT NULL
                  CHECK (channel IN (
                    'naver_blog', 'naver_cafe', 'naver_news',
                    'instagram', 'youtube', 'twitter', 'facebook',
                    'dcinside', 'ppomppu', 'gangnam_unnie', 'babitalk'
                  )),
  mention_date  date NOT NULL DEFAULT CURRENT_DATE,
  count         bigint NOT NULL DEFAULT 0,
  synced_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (keyword_id, channel, mention_date)
);

ALTER TABLE sc_mentions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_sc_mentions" ON sc_mentions
  TO authenticated USING (true) WITH CHECK (true);

-- 3. 수집 원문 게시글
CREATE TABLE IF NOT EXISTS sc_posts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id    uuid REFERENCES sc_keywords(id) ON DELETE CASCADE,
  channel       text NOT NULL,
  title         text,
  content       text,
  url           text,
  author        text,
  sentiment     text CHECK (sentiment IN ('positive', 'negative', 'neutral')),
  published_at  timestamptz,
  fetched_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sc_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_sc_posts" ON sc_posts
  TO authenticated USING (true) WITH CHECK (true);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_sc_mentions_keyword ON sc_mentions (keyword_id, mention_date DESC);
CREATE INDEX IF NOT EXISTS idx_sc_mentions_date    ON sc_mentions (mention_date DESC);
CREATE INDEX IF NOT EXISTS idx_sc_posts_keyword    ON sc_posts (keyword_id, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_sc_posts_channel    ON sc_posts (channel, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_sc_keywords_active  ON sc_keywords (is_active, created_at DESC);
