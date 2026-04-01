# 구현 현황 & 기능 목록

## ✅ 완료된 기능

### 인프라
- [x] `types/database.ts` — FieldType(13종), FormField, Project, Submission
- [x] `utils/supabase/client.ts` — createClient (브라우저)
- [x] `utils/supabase/server.ts` — createServerClient (서버)
- [x] `utils/supabase/storage.ts` — uploadBanner

### 빌더
- [x] `FormBuilder.tsx` — 신규 프로젝트 생성 (사이드바 + 캔버스 2컬럼)
- [x] `EditFormBuilder.tsx` — 기존 프로젝트 편집
- [x] `FieldCard.tsx` — 13가지 필드 타입 카드 (DnD, 라벨, 옵션, 컨텐츠, 미리보기)
- [x] `MapFieldEditor.tsx` — Google Maps iframe 붙여넣기 (API 불필요, 비용 없음, 실시간 미리보기)
- [x] `BannerUpload.tsx` — 배너 이미지 선택·미리보기·제거
- [x] `SaveButton.tsx` — 트랜잭션 저장 (projects → form_fields)
- [x] `RichTextEditor.tsx` — Tiptap WYSIWYG (SSR 제외)
- [x] 드래그앤드롭 순서 변경 (@dnd-kit)
- [x] 테마 컬러 선택 (프리셋 8종 + 커스텀 color picker)

### 대시보드
- [x] `dashboard/page.tsx` — 프로젝트 목록 (Server)
- [x] `ProjectList.tsx` — 목록 카드, 개별 삭제, 일괄 삭제, 공개 폼 뷰 버튼, 응답 보기 버튼
- [x] `dashboard/[id]/responses/page.tsx` — 응답 확인 테이블 (Server), 입력 필드만 컬럼 표시
- [x] `dashboard/[id]/responses/export/route.ts` — CSV 내보내기 (BOM UTF-8, Excel 호환)

### 공개 폼
- [x] `[slug]/page.tsx` — slug로 project+fields 조회 (Server), 비공개/마감일/최대응답 수 검사
- [x] `PublicForm.tsx` — 13가지 필드 렌더 + 제출 + 테마 컬러 적용
- [x] `api/submit/route.ts` — 제한 검사 → submissions INSERT → Resend 이메일 발송 (입력 필드만)

### 폼 공개 설정
- [x] `is_published` 공개/비공개 토글 (FormBuilder + EditFormBuilder)
- [x] `deadline` 제출 마감일 datetime-local 입력
- [x] `max_submissions` 최대 응답 수 number 입력

### 이미지 업로드
- [x] `uploadFieldImage()` — `storage.ts` 추가 (banners 버킷 `field-images/` 경로)
- [x] `FieldCard` 이미지 섹션 — URL 입력 + 파일 업로드 병행

### 사용자 인증 (Supabase Auth)
- [x] `middleware.ts` — `/dashboard` 보호, 미로그인 시 `/login` 리다이렉트
- [x] `utils/supabase/server.ts` — `@supabase/ssr` createServerClient (쿠키 기반 세션)
- [x] `app/login/page.tsx` — 로그인/회원가입 탭 UI
- [x] `app/auth/callback/route.ts` — OAuth 코드 교환 핸들러
- [x] `components/auth/AuthForm.tsx` — 이메일+비밀번호 로그인/가입, 비밀번호 표시 토글
- [x] `app/dashboard/account/page.tsx` — 계정 정보(이메일), 비밀번호 변경
- [x] `components/dashboard/UserMenu.tsx` — 이메일 표시 + 계정 설정 + 로그아웃 드롭다운
- [x] `app/page.tsx` — 로그인 사용자 → `/dashboard` 자동 리다이렉트

### 폼 복제
- [x] `app/api/duplicate/route.ts` — 원본 project+fields 복사, 비공개 상태로 생성
- [x] `ProjectList.tsx` — Copy 아이콘 버튼 + 복제 중 스피너

### 응답 관리 고도화
- [x] `ResponsesTable.tsx` — 행 클릭 → 응답 상세 모달
- [x] `responses/page.tsx` — 20건 페이지네이션 + select/radio/checkbox_group 통계 바 차트

### 폼 미리보기
- [x] `PreviewModal.tsx` — 빌더 내 모달로 공개 폼 렌더링 (previewMode: 실제 제출 안됨)
- [x] FormBuilder / EditFormBuilder 헤더에 "미리보기" 버튼 추가

### 커스텀 슬러그
- [x] FormBuilder — 슬러그 입력 필드 (영문/숫자/하이픈만 허용, 비워두면 자동 생성)
- [x] EditFormBuilder — 기존 슬러그 표시 + 클립보드 복사 (변경 불가)

### 웹훅
- [x] `api/submit/route.ts` — webhook_url 있으면 JSON POST 발송 (실패해도 제출 차단 안함)
- [x] FormBuilder / EditFormBuilder — 웹훅 URL 입력 필드

### 공개 상태 표시
- [x] `ProjectList.tsx` — 공개/비공개 뱃지 (Globe / EyeOff 아이콘)

## 필드 타입 목록 (FieldType 13종)

| 타입 | 분류 | 설명 | content | options | 빌더 미리보기 |
|---|---|---|---|---|---|
| text | 입력 | 단문 텍스트 | - | - | - |
| email | 입력 | 이메일 입력 | - | - | - |
| textarea | 입력 | 장문 텍스트 | - | - | - |
| checkbox | 입력 | 단일 체크 (동의) | - | - | - |
| select | 입력 | 드롭다운 선택 | - | ✅ | - |
| radio | 입력 | 라디오 단일 선택 | - | ✅ | - |
| checkbox_group | 입력 | 복수 체크 선택 | - | ✅ | - |
| html | 꾸밈 | WYSIWYG HTML 블록 | ✅ HTML | - | - |
| text_block | 꾸밈 | 평문 텍스트 단락 | ✅ 텍스트 | - | - |
| image | 꾸밈 | 이미지 + 캡션 | ✅ URL | - | ✅ img |
| divider | 꾸밈 | 수평선 구분선 | - | - | ✅ hr |
| map | 꾸밈 | Google Maps embed | ✅ embed URL | - | ✅ iframe |
| youtube | 꾸밈 | YouTube 영상 | ✅ 영상 URL | - | ✅ iframe |

## API 라우트

### POST /api/submit
```typescript
// Body
{ projectId: string, answers: Record<string, string|boolean|string[]>, fields: {id,label,type}[] }
// 동작
// 1. submissions INSERT
// 2. project.notification_email 있으면 + RESEND_API_KEY 있으면 → Resend 이메일 발송
// 이메일 스킵 타입: html, map, youtube, text_block, image, divider
```

## 주요 설계 결정 사항

| 항목 | 결정 | 이유 |
|---|---|---|
| Google Maps | Places API 미사용, iframe 직접 붙여넣기 | API 비용 발생 방지 |
| map embed URL | `maps.google.com/maps?q=...&output=embed` | Maps Embed API 별도 활성화 불필요 |
| YouTube embed | videoId 파싱 → `youtube.com/embed/{id}` | 표준 embed 방식 |
| 슬러그 | ASCII-only (`form-{rand6}`) | 한글 URL 인코딩 이슈 방지 |
| 이미지 | URL 입력 방식 | Storage 업로드 복잡도 제거 |
| Tiptap SSR | `dynamic(ssr:false)` + `immediatelyRender:false` | hydration mismatch 방지 |

### 제출 완료 메시지
- [x] `projects.submission_message` 컬럼 (마이그레이션 8)
- [x] FormBuilder / EditFormBuilder — "폼 설정" 섹션 내 완료 메시지 텍스트 입력
- [x] `PublicForm.tsx` — `submissionMessage` prop 수신, 커스텀/기본 메시지 표시

### 메뉴 개선
- [x] FormBuilder / EditFormBuilder — 글로벌 옵션(알림 이메일, 마감일, 최대 응답 수, 웹훅, 완료 메시지)을 접이식 "폼 설정" 카드로 분리

### 필드 유형 UX 개선
- [x] 사이드바 2열 그리드 레이아웃 (입력 / 콘텐츠 섹션 분리)
- [x] HTML 타입 신규 추가 불가 (기존 데이터 렌더링은 유지)
- [x] TABLE 타입 추가 — 행/열 편집 UI, `content`에 JSON 저장
- [x] `PublicForm.tsx` — TABLE 타입 렌더링 (헤더 + 행 테이블)

### 메뉴 탭 구조 개편
- [x] FormBuilder / EditFormBuilder — **폼 편집** 탭 (사이드바 + 캔버스) / **폼 설정** 탭 (단일 컬럼) 분리
- [x] 폼 설정 탭: 테마 컬러, 운영 설정 (알림 이메일·마감일·응답수·웹훅·완료메시지), 이메일 템플릿

### 이메일 템플릿
- [x] `projects.admin_email_template` — 관리자 수신 HTML 템플릿 (NULL = 기본 템플릿)
- [x] `projects.user_email_template` — 응답자 수신 HTML 템플릿 (NULL = 미발송)
- [x] 템플릿 변수: `{{form_title}}`, `{{submitted_at}}`, `{{answers_table}}`
- [x] `api/submit/route.ts` — 관리자 이메일: 커스텀/기본 템플릿 선택 발송
- [x] `api/submit/route.ts` — 응답자 이메일: email 필드 값 추출 → user_email_template 있을 때만 발송
- [x] `api/duplicate/route.ts` — 복제 시 템플릿 필드 복사
- [x] Tiptap WYSIWYG 에디터로 폼 설정 탭 내에서 편집

### 응답 탭 (EditFormBuilder 인라인)
- [x] `BuilderTabBar.tsx` — edit / settings / responses 탭 네비게이션 (`showResponses` prop)
- [x] `ResponsesTab.tsx` — 인라인 응답 현황 (최근 10건 + 통계 바 + 전체보기 링크 + CSV 내보내기 링크)
- [x] `EditFormBuilder.tsx` — 응답 탭 연결

### 이미지 필드 레이블 제거
- [x] `FieldCard.tsx` — 이미지 타입에서 레이블 편집 영역 숨김 (`showLabel = isInputType` only)

### 다국어 지원
- [x] `constants/locale.ts` — Locale 타입(ko/en/ja/zh), LocaleStrings 인터페이스, DEFAULT_LOCALE_STRINGS, resolveLocaleStrings()
- [x] `types/database.ts` — LocaleSettings 인터페이스, Project.locale_settings 필드 추가
- [x] `SettingsPanel.tsx` — 다국어 섹션 (활성화 토글, 언어 선택, 기본 언어, 언어별 텍스트 오버라이드)
- [x] `PublicForm.tsx` — 언어 전환 버튼, resolveLocaleStrings() 적용
- [x] `api/projects/route.ts` — locale_settings INSERT
- [x] `api/duplicate/route.ts` — locale_settings 복제

### 폼 썸네일
- [x] `utils/supabase/storage.ts` — uploadThumbnail() 함수 추가
- [x] `types/database.ts` — Project.thumbnail_url 필드 추가
- [x] `SettingsPanel.tsx` — 썸네일 업로드 UI (파일 선택 + 미리보기 + 제거)
- [x] `api/projects/route.ts` — thumbnail_url INSERT
- [x] `api/duplicate/route.ts` — thumbnail_url 복제

### 코드 구조 개편 (훅 기반 리팩토링)
- [x] `hooks/useFormFields.ts` — 필드 상태 훅 (add/remove/update/drag)
- [x] `hooks/useFormSettings.ts` — 설정 상태 훅 (toApiPayload / toUpdatePayload)
- [x] `constants/builder.ts` — 공유 상수 추출 (INPUT_TYPES, CONTENT_TYPES, PRESET_COLORS 등)
- [x] `BuilderTabBar.tsx` / `BuilderSidebar.tsx` / `BuilderCanvas.tsx` — 분리된 빌더 서브컴포넌트
- [x] `SettingsPanel.tsx` — 설정 탭 전용 컴포넌트
- [x] `FormBuilder.tsx` / `EditFormBuilder.tsx` — 훅 기반으로 ~70라인으로 축소

## 향후 작업 (미구현)
- 없음 (모든 계획된 기능 구현 완료)