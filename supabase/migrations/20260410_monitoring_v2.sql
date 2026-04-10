-- ── 모니터링 v2 마이그레이션 ────────────────────────────────────────
-- 기존 monitor_sites / monitor_checks 테이블에 컬럼 추가
-- 실행: Supabase Dashboard → SQL Editor 에서 전체 붙여넣기 후 실행

-- 1. monitor_sites: TTFB 컬럼 추가
ALTER TABLE monitor_sites ADD COLUMN IF NOT EXISTS last_ttfb INTEGER;  -- ms

-- 2. monitor_sites: Web Vitals 컬럼 추가
ALTER TABLE monitor_sites ADD COLUMN IF NOT EXISTS vitals_lcp        INTEGER;   -- ms
ALTER TABLE monitor_sites ADD COLUMN IF NOT EXISTS vitals_inp        INTEGER;   -- ms
ALTER TABLE monitor_sites ADD COLUMN IF NOT EXISTS vitals_cls        NUMERIC(6,3); -- score
ALTER TABLE monitor_sites ADD COLUMN IF NOT EXISTS vitals_ttfb       INTEGER;   -- ms
ALTER TABLE monitor_sites ADD COLUMN IF NOT EXISTS vitals_perf_score INTEGER;   -- 0-100
ALTER TABLE monitor_sites ADD COLUMN IF NOT EXISTS vitals_checked_at TIMESTAMPTZ;

-- 3. monitor_sites: 표시 순서 컬럼 (drag & drop 순서 저장)
ALTER TABLE monitor_sites ADD COLUMN IF NOT EXISTS display_order INTEGER;

-- 4. monitor_checks: TTFB 컬럼 추가
ALTER TABLE monitor_checks ADD COLUMN IF NOT EXISTS ttfb INTEGER;  -- ms

-- 5. display_order 인덱스
CREATE INDEX IF NOT EXISTS idx_monitor_sites_display_order
  ON monitor_sites(user_id, display_order NULLS LAST);
