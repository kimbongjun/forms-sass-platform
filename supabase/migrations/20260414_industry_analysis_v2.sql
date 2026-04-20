-- ============================================================
-- 업계분석 v2 마이그레이션 (AI 에이전트 지원)
-- 2026-04-14
-- 이전 마이그레이션(20260414_industry_analysis.sql)을 먼저 실행하거나
-- 아래 전체를 새로 실행하세요.
-- ============================================================

-- 1. AI 분석 실행 이력 테이블
CREATE TABLE IF NOT EXISTS industry_analysis_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status          text NOT NULL DEFAULT 'running'
                    CHECK (status IN ('running', 'completed', 'failed')),
  region          text NOT NULL CHECK (region IN ('domestic', 'global')),
  ai_sources      text[] NOT NULL DEFAULT '{}',
  items_count     int NOT NULL DEFAULT 0,
  market_summary  text,
  key_insights    text[],
  error_message   text,
  started_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE industry_analysis_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_runs" ON industry_analysis_runs
  TO authenticated USING (true) WITH CHECK (true);

-- 2. 아이템 테이블 (기존 있으면 컬럼 추가, 없으면 신규 생성)
CREATE TABLE IF NOT EXISTS industry_analysis_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          uuid REFERENCES industry_analysis_runs(id) ON DELETE SET NULL,
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
  ai_source       text CHECK (ai_source IN ('claude', 'openai', 'gemini')),
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- 기존 테이블에 누락된 컬럼 추가 (이미 실행한 경우)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'industry_analysis_items' AND column_name = 'run_id'
  ) THEN
    ALTER TABLE industry_analysis_items ADD COLUMN run_id uuid REFERENCES industry_analysis_runs(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'industry_analysis_items' AND column_name = 'ai_source'
  ) THEN
    ALTER TABLE industry_analysis_items ADD COLUMN ai_source text CHECK (ai_source IN ('claude', 'openai', 'gemini'));
  END IF;
END $$;

ALTER TABLE industry_analysis_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_industry_items" ON industry_analysis_items;
CREATE POLICY "auth_all_industry_items" ON industry_analysis_items
  TO authenticated USING (true) WITH CHECK (true);

-- 3. updated_at 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_industry_analysis_items_updated_at ON industry_analysis_items;
CREATE TRIGGER trg_industry_analysis_items_updated_at
  BEFORE UPDATE ON industry_analysis_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. 구독자 테이블 (없으면 생성)
CREATE TABLE IF NOT EXISTS industry_analysis_subscribers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL UNIQUE,
  name        text,
  frequency   text NOT NULL DEFAULT 'weekly'
                CHECK (frequency IN ('daily', 'weekly')),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE industry_analysis_subscribers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_industry_subscribers" ON industry_analysis_subscribers;
CREATE POLICY "auth_all_industry_subscribers" ON industry_analysis_subscribers
  TO authenticated USING (true) WITH CHECK (true);

-- 5. 인덱스
CREATE INDEX IF NOT EXISTS idx_industry_items_run_id    ON industry_analysis_items (run_id);
CREATE INDEX IF NOT EXISTS idx_industry_items_region    ON industry_analysis_items (region, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_industry_items_category  ON industry_analysis_items (category, region);
CREATE INDEX IF NOT EXISTS idx_industry_items_featured  ON industry_analysis_items (is_featured, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_industry_runs_status     ON industry_analysis_runs (status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_industry_subs_freq       ON industry_analysis_subscribers (frequency, is_active);
