# Supabase 스키마 & 설정

## 테이블 정의

### projects
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| title | text NOT NULL | |
| slug | text UNIQUE NOT NULL | ASCII-only, form-{rand} |
| banner_url | text | Storage 공개 URL |
| notification_email | text | 응답 알림 수신 이메일 |
| theme_color | text | hex 색상값, 기본 #111827 |
| is_published | boolean | DEFAULT true, false면 공개 폼 접근 차단 |
| deadline | timestamptz | 제출 마감일시, NULL이면 제한 없음 |
| max_submissions | int | 최대 응답 수, NULL이면 제한 없음 |
| webhook_url | text | 제출 시 POST 발송할 외부 URL |
| submission_message | text | 제출 완료 후 표시할 커스텀 메시지 (NULL이면 기본값) |
| admin_email_template | text | 관리자 수신 이메일 HTML 템플릿 (NULL이면 기본 템플릿) |
| user_email_template | text | 응답자 수신 이메일 HTML 템플릿 (NULL이면 미발송) |
| thumbnail_url | text | 폼 썸네일 이미지 Storage 공개 URL |
| locale_settings | jsonb | 다국어 설정 (LocaleSettings 타입, NULL이면 기본 ko) |
| seo_title | text | 폼 SEO 타이틀 (NULL이면 project.title 사용) |
| seo_description | text | 폼 SEO 설명 |
| seo_og_image | text | 폼 OG 이미지 URL |
| user_id | uuid | Supabase Auth uid, 소유권 판별에 사용 |
| created_at | timestamptz | now() |

### form_fields
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| project_id | uuid FK | → projects ON DELETE CASCADE |
| label | text | 필드 제목 |
| description | text | 필드 상세 설명 (레이블 아래 표시, NULL이면 미표시) |
| type | text CHECK | FieldType 17종 참조 |
| required | boolean | |
| order_index | int | DnD 순서 |
| options | jsonb | select/radio/checkbox_group 선택지 배열 |
| content | text | html(WYSIWYG HTML), map/youtube URL, text_block 텍스트, image URL |
| logic | jsonb | radio 조건분기: { "optionValue": "sectionFieldId" } |
| created_at | timestamptz | |

**FieldType CHECK:**
`'text','email','textarea','checkbox','select','radio','checkbox_group','rating','section','html','map','youtube','text_block','image','divider','table'`

### announcements
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| title | text NOT NULL | |
| content | text NOT NULL | DEFAULT '' |
| author_id | uuid | |
| is_published | boolean | DEFAULT true |
| is_pinned | boolean | DEFAULT false |
| created_at | timestamptz | now() |
| updated_at | timestamptz | now() |

### release_notes
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| version | text NOT NULL | e.g. v1.2.0 |
| title | text NOT NULL | |
| content | text NOT NULL | DEFAULT '' |
| created_at | timestamptz | now() |

### submissions
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| project_id | uuid FK | → projects ON DELETE CASCADE |
| answers | jsonb NOT NULL | `{fieldId: string \| boolean \| string[]}` |
| created_at | timestamptz | |

---

## RLS 정책 (anon 롤)

```sql
-- projects (전체 허용)
CREATE POLICY anon_select_projects ON projects FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_projects ON projects FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_projects ON projects FOR UPDATE TO anon USING (true);
CREATE POLICY anon_delete_projects ON projects FOR DELETE TO anon USING (true);

-- form_fields
CREATE POLICY anon_select_form_fields ON form_fields FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_form_fields ON form_fields FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_delete_form_fields ON form_fields FOR DELETE TO anon USING (true);

-- submissions
CREATE POLICY anon_insert_submissions ON submissions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_select_submissions ON submissions FOR SELECT TO anon USING (true);
```

## Storage
- 버킷명: `banners` (public)
- 배너 경로: `project-banners/{uuid}.{ext}` → `uploadBanner(supabase, file)`
- 이미지 필드 경로: `field-images/{uuid}.{ext}` → `uploadFieldImage(supabase, file)`
- 썸네일 경로: `thumbnails/{uuid}.{ext}` → `uploadThumbnail(supabase, file)`
- 사이트 에셋 경로: `site-assets/og-image-{uuid}.{ext}` / `site-assets/favicon-{uuid}.{ext}` → `uploadSiteAsset(supabase, file, type)`
- 네 함수 모두 `src/utils/supabase/storage.ts` 에 정의, Public URL 반환

## 환경변수 (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
RESEND_API_KEY=re_xxxxx
RESEND_FROM_EMAIL=onboarding@resend.dev   # 도메인 인증 후 변경
```

## 마이그레이션 히스토리
1. 초기 4개 타입 → `options(jsonb)`, `content(text)` 컬럼 추가
2. CHECK 제약 확장 → html, select, radio, checkbox_group 추가
3. CHECK 재확장 → map, youtube 추가
4. `notification_email`, `theme_color` 컬럼 추가 (ALTER TABLE ADD COLUMN IF NOT EXISTS)
5. CHECK 재확장 → text_block, image, divider 추가
6. `is_published(boolean)`, `deadline(timestamptz)`, `max_submissions(int)` 컬럼 추가

```sql
-- 마이그레이션 6: 공개 설정 컬럼
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT true;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deadline timestamptz;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS max_submissions int;

-- 마이그레이션 9: 이메일 템플릿
ALTER TABLE projects ADD COLUMN IF NOT EXISTS admin_email_template text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS user_email_template text;

-- 마이그레이션 8: submission_message + table 타입
ALTER TABLE projects ADD COLUMN IF NOT EXISTS submission_message text;

-- form_fields CHECK 확장 (table 타입 추가)
ALTER TABLE form_fields DROP CONSTRAINT IF EXISTS form_fields_type_check;
ALTER TABLE form_fields ADD CONSTRAINT form_fields_type_check
  CHECK (type IN ('text','email','textarea','checkbox','select','radio','checkbox_group','html','map','youtube','text_block','image','divider','table'));

-- 마이그레이션 10: 썸네일 + 다국어 설정
ALTER TABLE projects ADD COLUMN IF NOT EXISTS thumbnail_url text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS locale_settings jsonb;

-- 마이그레이션 11: 필드 상세 설명
ALTER TABLE form_fields ADD COLUMN IF NOT EXISTS description text;

-- 마이그레이션 12: 프로젝트별 SEO 옵션 ← 미실행 시 저장 오류 발생
ALTER TABLE projects ADD COLUMN IF NOT EXISTS seo_title text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS seo_description text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS seo_og_image text;

-- 마이그레이션 13: form_fields 조건분기 logic 컬럼
ALTER TABLE form_fields ADD COLUMN IF NOT EXISTS logic jsonb;

-- 마이그레이션 14: form_fields type CHECK — section / rating 추가
ALTER TABLE form_fields DROP CONSTRAINT IF EXISTS form_fields_type_check;
ALTER TABLE form_fields ADD CONSTRAINT form_fields_type_check
  CHECK (type IN (
    'text','email','textarea','checkbox','select','radio','checkbox_group',
    'rating','section',
    'html','map','youtube','text_block','image','divider','table'
  ));

-- 마이그레이션 15: 공지사항 테이블
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  author_id uuid,
  is_published boolean DEFAULT true,
  is_pinned boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 마이그레이션 16: 릴리즈노트 테이블
CREATE TABLE IF NOT EXISTS release_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- RLS: announcements & release_notes
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY anon_select_announcements ON announcements FOR SELECT TO anon USING (true);
CREATE POLICY auth_select_announcements ON announcements FOR SELECT TO authenticated USING (true);
CREATE POLICY auth_insert_announcements ON announcements FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY auth_update_announcements ON announcements FOR UPDATE TO authenticated USING (true);
CREATE POLICY auth_delete_announcements ON announcements FOR DELETE TO authenticated USING (true);

ALTER TABLE release_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY anon_select_release_notes ON release_notes FOR SELECT TO anon USING (true);
CREATE POLICY auth_select_release_notes ON release_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY auth_insert_release_notes ON release_notes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY auth_update_release_notes ON release_notes FOR UPDATE TO authenticated USING (true);
CREATE POLICY auth_delete_release_notes ON release_notes FOR DELETE TO authenticated USING (true);

-- RLS: form_fields authenticated 정책 (브라우저 클라이언트에서 직접 호출 허용)
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

-- 마이그레이션 7: 웹훅 + Auth
ALTER TABLE projects ADD COLUMN IF NOT EXISTS webhook_url text;

-- Auth RLS (Supabase Auth 활성화 후 실행)
DROP POLICY IF EXISTS anon_insert_projects ON projects;
DROP POLICY IF EXISTS anon_update_projects ON projects;
DROP POLICY IF EXISTS anon_delete_projects ON projects;

CREATE POLICY auth_insert_projects ON projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY auth_update_projects ON projects FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY auth_delete_projects ON projects FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS anon_select_submissions ON submissions;
CREATE POLICY auth_select_submissions ON submissions FOR SELECT TO authenticated
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- user_id 자동 설정 트리거
CREATE OR REPLACE FUNCTION set_user_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.user_id = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER projects_set_user_id
  BEFORE INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION set_user_id();
```
