# 구현 현황 & 기능 목록

## ✅ 완료된 기능

### 인프라
- [x] `types/database.ts` — FieldType(15종), FormField, Project, Submission
- [x] `utils/supabase/client.ts` — createClient (브라우저)
- [x] `utils/supabase/server.ts` — createServerClient (서버)
- [x] `utils/supabase/storage.ts` — uploadBanner, uploadThumbnail

### 빌더
- [x] `FormBuilder.tsx` — 신규 프로젝트 생성 (사이드바 + 캔버스 2컬럼, 모바일 드로어)
- [x] `EditFormBuilder.tsx` — 기존 프로젝트 편집 (모바일 드로어)
- [x] `FieldCard.tsx` — 15가지 필드 타입 카드 (DnD, 리치텍스트 레이블, 옵션, 컨텐츠, 미리보기)
- [x] `LabelEditor.tsx` — Tiptap 미니 에디터 (Bold/Italic/Underline/Color/Link, SSR 제외)
- [x] `MapFieldEditor.tsx` — Google Maps iframe 붙여넣기
- [x] `BannerUpload.tsx` — 배너 이미지 선택·미리보기·제거
- [x] `SaveButton.tsx` — 트랜잭션 저장 (projects → form_fields)
- [x] `RichTextEditor.tsx` — Tiptap WYSIWYG (SSR 제외)
- [x] 드래그앤드롭 순서 변경 (@dnd-kit)
- [x] 테마 컬러 선택 (프리셋 8종 + 커스텀 color picker)

### 대시보드
- [x] `dashboard/page.tsx` — 프로젝트 목록 (Server)
- [x] `ProjectList.tsx` — 목록 카드 (thumbnail_url ?? banner_url 프리뷰), 삭제, 복제, 공개 폼 뷰, 응답 보기
- [x] `dashboard/[id]/responses/page.tsx` — 응답 확인 테이블 + 통계 바 + 상세 통계 버튼 + CSV 버튼
- [x] `dashboard/[id]/responses/stats/page.tsx` — 필드별 상세 통계 (SVG 파이차트, 바차트, 평점분포, 텍스트목록)
- [x] `dashboard/[id]/responses/export/route.ts` — CSV 내보내기 (BOM UTF-8, Excel 호환)

### 공개 폼
- [x] `[slug]/page.tsx` — slug로 project+fields 조회 (Server), 비공개/마감일/최대응답 수 검사
- [x] `PublicForm.tsx` — 15가지 필드 렌더 + 다단계(섹션) + 평점 + 조건분기 + 테마 컬러 + 다국어
- [x] `api/submit/route.ts` — 제한 검사 → submissions INSERT → Resend 이메일 발송

### 필드 타입
- [x] rating — 별점 입력 (3/5/10점 설정, 공개폼 클릭 별점)
- [x] section — 섹션 구분자, 다단계 폼 페이지 분할
- [x] table — 행/열 편집 UI, content에 JSON 저장

### 섹션 & Conditional Logic
- [x] `PublicForm.tsx` — splitSections() 다단계 분할, 진행바, 다음/이전 버튼
- [x] `FieldCard.tsx` — radio 옵션별 섹션 분기 `<select>` UI
- [x] `EditFormBuilder.tsx` — logic 필드 저장
- [x] DB: `form_fields.logic jsonb` — radio: { "optionValue": "sectionFieldId" }

### 관리자 글로벌 옵션
- [x] `app/api/admin/settings/route.ts` — GET/PUT (site_settings 단일 행)
- [x] `app/dashboard/admin/settings/page.tsx` — 관리자 전용 설정 페이지
- [x] `app/dashboard/admin/settings/AdminSettingsForm.tsx` — 설정 폼 (site_title, description, og_image, favicon, footer_text, max_file_size)
- [x] `app/layout.tsx` — 동적 generateMetadata() (DB 연동)
- [x] `UserMenu.tsx` — 관리자 메뉴에 "사이트 설정" 링크

### 폼 공개 설정
- [x] `is_published` 공개/비공개 토글
- [x] `deadline` 제출 마감일
- [x] `max_submissions` 최대 응답 수

### 사용자 인증 (Supabase Auth)
- [x] `middleware.ts` — `/dashboard` 보호
- [x] `app/login/page.tsx` — 로그인/회원가입 탭 UI
- [x] `app/auth/callback/route.ts` — OAuth 코드 교환 핸들러
- [x] `components/auth/AuthForm.tsx` — 이메일+비밀번호 로그인/가입
- [x] `app/dashboard/account/page.tsx` — 계정 정보, 비밀번호 변경
- [x] `components/dashboard/UserMenu.tsx` — 이메일 표시 + 계정 설정 + 로그아웃

### 폼 복제
- [x] `app/api/duplicate/route.ts` — project+fields 복사, 비공개 상태로 생성

### 응답 관리
- [x] `ResponsesTable.tsx` — 행 클릭 → 응답 상세 모달, 20건 페이지네이션
- [x] `PreviewModal.tsx` — 빌더 내 모달 미리보기

### 커스텀 슬러그 / 웹훅
- [x] 슬러그 입력 필드 (FormBuilder), 표시 + 복사 (EditFormBuilder)
- [x] `api/submit/route.ts` — webhook_url JSON POST 발송

### 이메일 템플릿
- [x] `projects.admin_email_template` / `projects.user_email_template`
- [x] 템플릿 변수: `{{form_title}}`, `{{submitted_at}}`, `{{answers_table}}`
- [x] 응답자 이메일: email 필드 값 추출 → user_email_template 있을 때만 발송

### 다국어 지원
- [x] `constants/locale.ts` — Locale 타입(ko/en/ja/zh), resolveLocaleStrings()
- [x] `SettingsPanel.tsx` — 다국어 섹션 (활성화 토글, 언어 선택, 텍스트 오버라이드)
- [x] `PublicForm.tsx` — 언어 전환 버튼 적용

### 코드 구조 개편 (훅 기반 리팩토링)
- [x] `hooks/useFormFields.ts` — 필드 상태 훅 (add/remove/update/drag)
- [x] `hooks/useFormSettings.ts` — 설정 상태 훅 (toApiPayload / toUpdatePayload)
- [x] `constants/builder.ts` — 공유 상수 추출 (INPUT_TYPES, CONTENT_TYPES, PRESET_COLORS 등)
- [x] `BuilderTabBar.tsx` / `BuilderSidebar.tsx` / `BuilderCanvas.tsx` — 분리된 빌더 서브컴포넌트
- [x] `SettingsPanel.tsx` — 설정 탭 전용 컴포넌트

---

## 필드 타입 목록 (FieldType 15종)

| 타입 | 분류 | 설명 | content | options |
|---|---|---|---|---|
| text | 입력 | 단문 텍스트 | - | - |
| email | 입력 | 이메일 입력 | - | - |
| textarea | 입력 | 장문 텍스트 | - | - |
| checkbox | 입력 | 단일 체크 (동의) | - | - |
| select | 입력 | 드롭다운 선택 | - | ✅ |
| radio | 입력 | 라디오 단일 선택 + conditional logic | - | ✅ |
| checkbox_group | 입력 | 복수 체크 선택 | - | ✅ |
| rating | 입력 | 별점 (3/5/10점) | ✅ 최대점수 | - |
| text_block | 꾸밈 | 평문 텍스트 단락 | ✅ 텍스트 | - |
| image | 꾸밈 | 이미지 + 캡션 | ✅ URL | - |
| divider | 꾸밈 | 수평선 구분선 | - | - |
| map | 꾸밈 | Google Maps embed | ✅ embed URL | - |
| youtube | 꾸밈 | YouTube 영상 | ✅ 영상 URL | - |
| table | 꾸밈 | 행/열 테이블 | ✅ JSON | - |
| section | 구조 | 섹션 구분 (다단계 페이지 분할) | - | - |

---

## API 라우트

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/projects` | 신규 프로젝트 생성 |
| POST | `/api/duplicate` | 프로젝트 복제 |
| POST | `/api/submit` | 폼 제출 |
| GET/PUT | `/api/admin/settings` | 사이트 설정 |
| GET | `/api/admin/users` | 회원 목록 |
| PUT | `/api/admin/update-role` | 역할 변경 |
| POST | `/api/admin/reset-password` | 비밀번호 초기화 |
| DELETE | `/api/admin/delete-user` | 회원 삭제 |
| GET | `/dashboard/[id]/responses/export` | CSV 내보내기 |

---

## 향후 작업
- [x] **저장 시 오류 해결** : SEO/logic 컬럼 누락 → 조건부 포함으로 수정. announcements/release_notes CRUD를 서버 API 라우트로 이전(브라우저 RLS 우회). TinyMCE controlled mode(`value`) 버그 → `initialValue`로 수정.
- [x] **레이아웃 통일** : 공지사항·릴리즈노트에 `layout.tsx` 추가(SiteHeader/SiteFooter 공유), 콘텐츠 컨테이너 `max-w-7xl`로 확장, SiteHeader 내부 `max-w-7xl px-8`로 통일.
- [x] **릴리즈 노트** : `POST /api/admin/release-notes/generate` 구현 — git log 파싱 → 카테고리 분류 → 버전 자동 증가 → DB 저장. 관리자 페이지에 "자동 생성" 버튼 추가.
- [x] **위지윅 에디터 변경** : Toast UI Editor → TinyMCE(self-hosted, `public/tinymce`) 교체. `scripts/copy-tinymce.js` + `postinstall` 스크립트로 자동 복사.
- [x] **글로벌 설정 수정** : OG 이미지·파비콘을 URL 입력 → 파일 업로드(Supabase Storage `site-assets/`) 형태로 변경. 파일 크기 5MB·MIME 화이트리스트 검증 포함.