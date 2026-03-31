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

## 향후 작업 (미구현)

- [ ] **이메일 발송 실패 처리** — Resend 오류 시 로그 저장 또는 재시도
- [ ] **이미지 필드 Storage 정책 분리** — banners 버킷 내 field-images 경로에 별도 RLS 적용
- [ ] **다국어 지원** — 폼 UI 언어 설정
