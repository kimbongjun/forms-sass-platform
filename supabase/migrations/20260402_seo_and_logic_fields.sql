-- 마이그레이션 12: 프로젝트별 SEO 옵션
ALTER TABLE projects ADD COLUMN IF NOT EXISTS seo_title text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS seo_description text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS seo_og_image text;

-- 마이그레이션 13: form_fields 조건분기 logic 컬럼
ALTER TABLE form_fields ADD COLUMN IF NOT EXISTS logic jsonb;

-- 마이그레이션 14: form_fields type CHECK — section / rating 타입 추가
ALTER TABLE form_fields DROP CONSTRAINT IF EXISTS form_fields_type_check;
ALTER TABLE form_fields ADD CONSTRAINT form_fields_type_check
  CHECK (type IN (
    'text','email','textarea','checkbox','select','radio','checkbox_group',
    'rating','section',
    'html','map','youtube','text_block','image','divider','table'
  ));

-- 마이그레이션 15: 공지사항 테이블
CREATE TABLE IF NOT EXISTS announcements (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text        NOT NULL,
  content    text        NOT NULL DEFAULT '',
  author_id  uuid,
  is_published boolean   DEFAULT true,
  is_pinned  boolean     DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 마이그레이션 16: 릴리즈노트 테이블
CREATE TABLE IF NOT EXISTS release_notes (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  version    text        NOT NULL,
  title      text        NOT NULL,
  content    text        NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- RLS: announcements (관리자만 write, 모두 read)
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anon_select_announcements ON announcements;
DROP POLICY IF EXISTS auth_select_announcements ON announcements;
DROP POLICY IF EXISTS auth_insert_announcements ON announcements;
DROP POLICY IF EXISTS auth_update_announcements ON announcements;
DROP POLICY IF EXISTS auth_delete_announcements ON announcements;

CREATE POLICY anon_select_announcements ON announcements
  FOR SELECT TO anon USING (true);
CREATE POLICY auth_select_announcements ON announcements
  FOR SELECT TO authenticated USING (true);
-- 관리자(profiles.role = 'administrator')만 쓰기 허용
CREATE POLICY auth_insert_announcements ON announcements
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrator')
  );
CREATE POLICY auth_update_announcements ON announcements
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrator')
  );
CREATE POLICY auth_delete_announcements ON announcements
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrator')
  );

-- RLS: release_notes (관리자만 write, 모두 read)
ALTER TABLE release_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anon_select_release_notes ON release_notes;
DROP POLICY IF EXISTS auth_select_release_notes ON release_notes;
DROP POLICY IF EXISTS auth_insert_release_notes ON release_notes;
DROP POLICY IF EXISTS auth_update_release_notes ON release_notes;
DROP POLICY IF EXISTS auth_delete_release_notes ON release_notes;

CREATE POLICY anon_select_release_notes ON release_notes
  FOR SELECT TO anon USING (true);
CREATE POLICY auth_select_release_notes ON release_notes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY auth_insert_release_notes ON release_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrator')
  );
CREATE POLICY auth_update_release_notes ON release_notes
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrator')
  );
CREATE POLICY auth_delete_release_notes ON release_notes
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrator')
  );

-- RLS: form_fields — authenticated 사용자 권한 추가 (브라우저 클라이언트에서 직접 호출 허용)
DROP POLICY IF EXISTS auth_insert_form_fields ON form_fields;
CREATE POLICY auth_insert_form_fields ON form_fields
  FOR INSERT TO authenticated WITH CHECK (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS auth_delete_form_fields ON form_fields;
CREATE POLICY auth_delete_form_fields ON form_fields
  FOR DELETE TO authenticated USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );
