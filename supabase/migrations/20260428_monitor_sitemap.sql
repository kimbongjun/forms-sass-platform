-- ── 사이트맵 체크 결과 테이블 ────────────────────────────────────────
-- 각 사이트의 sitemap.xml 기반 페이지별 상태를 저장한다.
-- pages 컬럼(jsonb)에 URL별 체크 결과를 배열로 보관.

CREATE TABLE IF NOT EXISTS monitor_sitemap_runs (
  id             uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id        uuid        NOT NULL REFERENCES monitor_sites(id) ON DELETE CASCADE,
  checked_at     timestamptz NOT NULL DEFAULT now(),
  sitemap_url    text,
  sitemap_found  boolean     NOT NULL DEFAULT false,
  tried_urls     jsonb       NOT NULL DEFAULT '[]',
  total_urls     int         NOT NULL DEFAULT 0,
  ok_count       int         NOT NULL DEFAULT 0,
  error_count    int         NOT NULL DEFAULT 0,
  issue_count    int         NOT NULL DEFAULT 0,
  pages          jsonb       NOT NULL DEFAULT '[]'
);

ALTER TABLE monitor_sitemap_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY auth_all_monitor_sitemap_runs ON monitor_sitemap_runs
  TO authenticated
  USING  (site_id IN (SELECT id FROM monitor_sites WHERE user_id = auth.uid()))
  WITH CHECK (site_id IN (SELECT id FROM monitor_sites WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_monitor_sitemap_runs_site
  ON monitor_sitemap_runs (site_id, checked_at DESC);
