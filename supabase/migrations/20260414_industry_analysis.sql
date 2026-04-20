-- ============================================================
-- 업계분석 테이블 마이그레이션
-- 2026-04-14
-- ============================================================

-- 1. 업계분석 아이템 테이블
CREATE TABLE IF NOT EXISTS industry_analysis_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  summary         text,
  content         text,
  category        text NOT NULL
                    CHECK (category IN (
                      'trend', 'advertising', 'celebrity', 'medical_device',
                      'conference', 'sns_event', 'ai_case', 'press_release', 'finance'
                    )),
  region          text NOT NULL DEFAULT 'domestic'
                    CHECK (region IN ('domestic', 'global')),
  company_tags    text[] NOT NULL DEFAULT '{}',
  source_url      text,
  source_name     text,
  thumbnail_url   text,
  published_at    date,
  is_featured     boolean NOT NULL DEFAULT false,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- 2. 뉴스레터 구독자 테이블
CREATE TABLE IF NOT EXISTS industry_analysis_subscribers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL UNIQUE,
  name        text,
  frequency   text NOT NULL DEFAULT 'weekly'
                CHECK (frequency IN ('daily', 'weekly')),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 3. RLS 활성화
ALTER TABLE industry_analysis_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE industry_analysis_subscribers ENABLE ROW LEVEL SECURITY;

-- 4. RLS 정책 — 인증된 사용자 전체 접근
CREATE POLICY "auth_all_industry_items" ON industry_analysis_items
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "auth_all_industry_subscribers" ON industry_analysis_subscribers
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5. updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_industry_analysis_items_updated_at
  BEFORE UPDATE ON industry_analysis_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. 인덱스
CREATE INDEX IF NOT EXISTS idx_industry_items_region_cat
  ON industry_analysis_items (region, category, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_industry_items_featured
  ON industry_analysis_items (is_featured, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_industry_subscribers_freq
  ON industry_analysis_subscribers (frequency, is_active);
