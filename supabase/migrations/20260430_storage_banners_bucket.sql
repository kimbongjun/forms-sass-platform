-- ============================================================
-- banners 스토리지 버킷 생성 및 RLS 정책 설정
-- 오류: "new row violates row-level security policy"
-- 원인: banners 버킷 미생성 또는 storage 정책 누락
-- ============================================================

-- 1. banners 버킷 생성 (이미 존재하면 무시)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'banners',
  'banners',
  true,
  52428800,
  ARRAY[
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
    'image/webp', 'image/svg+xml', 'image/x-icon',
    'image/vnd.microsoft.icon'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- 2. 기존 정책 제거 (재실행 안전)
DROP POLICY IF EXISTS "banners_public_select"  ON storage.objects;
DROP POLICY IF EXISTS "banners_auth_insert"    ON storage.objects;
DROP POLICY IF EXISTS "banners_auth_update"    ON storage.objects;
DROP POLICY IF EXISTS "banners_auth_delete"    ON storage.objects;

-- 3. 공개 읽기 — 이미지 URL 직접 접근 허용
CREATE POLICY "banners_public_select"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'banners');

-- 4. 업로드 허용 — 인증된 사용자 (service_role 포함)
CREATE POLICY "banners_auth_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'banners');

-- 5. 수정 허용
CREATE POLICY "banners_auth_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'banners')
  WITH CHECK (bucket_id = 'banners');

-- 6. 삭제 허용
CREATE POLICY "banners_auth_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'banners');
