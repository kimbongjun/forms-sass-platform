-- ── 웹 모니터링 마이그레이션 ────────────────────────────────────────
-- 실행: Supabase Dashboard → SQL Editor 에서 전체 붙여넣기 후 실행

-- 1. 모니터링 사이트 테이블
CREATE TABLE IF NOT EXISTS monitor_sites (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  url               TEXT NOT NULL,
  check_interval    INTEGER NOT NULL DEFAULT 30,   -- 분 단위 (5/10/15/30/60/360/720/1440)
  is_active         BOOLEAN NOT NULL DEFAULT true,
  notify_email      TEXT,
  last_checked_at   TIMESTAMPTZ,
  last_status       TEXT DEFAULT 'unknown',        -- 'up' | 'down' | 'slow' | 'error' | 'unknown'
  last_response_time INTEGER,                      -- ms
  last_status_code  INTEGER,
  last_error        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT monitor_sites_status_check CHECK (
    last_status IN ('up', 'down', 'slow', 'error', 'unknown')
  ),
  CONSTRAINT monitor_sites_interval_check CHECK (
    check_interval IN (5, 10, 15, 30, 60, 360, 720, 1440)
  )
);

-- 2. 체크 이력 테이블
CREATE TABLE IF NOT EXISTS monitor_checks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id          UUID NOT NULL REFERENCES monitor_sites(id) ON DELETE CASCADE,
  checked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status           TEXT NOT NULL,
  response_time    INTEGER,   -- ms
  status_code      INTEGER,
  error_message    TEXT,

  CONSTRAINT monitor_checks_status_check CHECK (
    status IN ('up', 'down', 'slow', 'error', 'unknown')
  )
);

-- 3. 인덱스
CREATE INDEX IF NOT EXISTS idx_monitor_sites_user_id   ON monitor_sites(user_id);
CREATE INDEX IF NOT EXISTS idx_monitor_checks_site_id  ON monitor_checks(site_id);
CREATE INDEX IF NOT EXISTS idx_monitor_checks_checked  ON monitor_checks(site_id, checked_at DESC);

-- 4. RLS 활성화
ALTER TABLE monitor_sites   ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitor_checks  ENABLE ROW LEVEL SECURITY;

-- 5. RLS 정책 — 소유자만 접근
CREATE POLICY auth_all_monitor_sites ON monitor_sites
  TO authenticated
  USING       (user_id = auth.uid())
  WITH CHECK  (user_id = auth.uid());

CREATE POLICY auth_all_monitor_checks ON monitor_checks
  TO authenticated
  USING (
    site_id IN (
      SELECT id FROM monitor_sites WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    site_id IN (
      SELECT id FROM monitor_sites WHERE user_id = auth.uid()
    )
  );

-- 6. updated_at 자동 갱신 트리거 (선택)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_monitor_sites_updated_at ON monitor_sites;
CREATE TRIGGER trg_monitor_sites_updated_at
  BEFORE UPDATE ON monitor_sites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
