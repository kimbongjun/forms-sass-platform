# IA 구조 (Information Architecture)

> 이 문서는 프로젝트의 전체 정보 구조를 정의합니다.
> 페이지 구조, 역할별 접근 권한, 사용자 플로우, 컴포넌트 연결을 한눈에 파악할 수 있습니다.

---

## 1. 페이지 사이트맵

```
/                               홈 (로그인 여부 감지 → /dashboard 리다이렉트)
│
├── /login                      로그인 / 회원가입
│
├── /[slug]                     공개 폼 제출 페이지 (비인증 접근 가능)
│
└── /dashboard                  대시보드 (인증 필수 — middleware.ts 보호)
    ├── /dashboard               폼 목록
    ├── /dashboard/new           새 폼 생성 (빌더)
    ├── /dashboard/[id]/edit     기존 폼 편집 (빌더)
    ├── /dashboard/[id]/responses  폼 응답 조회 + CSV 내보내기
    ├── /dashboard/account       계정 설정 (이메일 확인, 비밀번호 변경)
    └── /dashboard/admin/users   사용자 관리 (administrator 전용)
```

---

## 2. 역할별 접근 권한

| 페이지 / 기능             | 비인증 (anon) | editor | administrator |
|--------------------------|:---:|:---:|:---:|
| `/[slug]` 공개 폼 제출    | ✅  | ✅  | ✅  |
| `/login`                 | ✅  | —  | —  |
| `/dashboard` 폼 목록      | ❌  | ✅  | ✅  |
| 폼 생성 / 편집            | ❌  | ✅  | ✅  |
| 응답 조회 / CSV 내보내기  | ❌  | ✅  | ✅  |
| 계정 설정                 | ❌  | ✅  | ✅  |
| **사용자 관리** (admin)   | ❌  | ❌  | ✅  |
| 역할 변경 / 비밀번호 초기화 | ❌ | ❌  | ✅  |
| 회원 삭제                 | ❌  | ❌  | ✅  |

> 권한 판별 위치: `utils/supabase/server.ts` → `getUserRole(userId)`
> 관리자 API는 모두 서버에서 role 재검증 수행

---

## 3. 주요 사용자 플로우

### 3-1. 에디터 — 폼 생성 및 배포

```
로그인
  └─► /dashboard (폼 목록)
        └─► "새 폼 만들기" 클릭 → /dashboard/new
              └─► FormBuilder
                    ├── [폼 편집 탭] 필드 추가 / 순서 변경 / 설정
                    ├── [폼 설정 탭] 테마·알림·마감·웹훅·이메일 템플릿
                    ├── 미리보기 (PreviewModal)
                    └── "저장" → POST /api/projects → 저장 완료
                          └─► /dashboard (목록에 신규 폼 노출)
                                ├── 공개 URL 복사
                                ├── 폼 복제 → POST /api/duplicate
                                └─► /dashboard/[id]/edit (편집 재진입)
```

### 3-2. 응답자 — 공개 폼 제출

```
공개 URL 접속 → /[slug]
  └─► SlugPage (Server Component)
        ├── 비공개 폼 → 차단 메시지
        ├── 마감일 초과 → 차단 메시지
        ├── 최대 응답 수 초과 → 차단 메시지
        └── PublicForm 렌더링
              ├── 필드 입력 (text, email, select, checkbox 등)
              ├── 언어 전환 버튼 (다국어 활성화 시)
              └── 제출 → POST /api/submit
                    ├── submissions INSERT
                    ├── 관리자 이메일 발송 (Resend)
                    ├── 응답자 확인 이메일 발송 (user_email_template 있을 시)
                    ├── 웹훅 POST (webhook_url 있을 시)
                    └── 완료 메시지 표시
```

### 3-3. 관리자 — 회원 관리

```
로그인 (administrator 계정)
  └─► /dashboard
        └─► 사이드바/메뉴 → /dashboard/admin/users
              └─► AdminUserList
                    ├── 이메일 검색
                    ├── 역할 변경 (editor ↔ administrator) → POST /api/admin/update-role
                    ├── 비밀번호 초기화 → POST /api/admin/reset-password
                    └── 회원 삭제 → POST /api/admin/delete-user
                          └─► 본인 계정 삭제 차단
```

---

## 4. 컴포넌트 ↔ 페이지 연결

### /dashboard/new · /dashboard/[id]/edit (빌더)

```
page.tsx
  └─► FormBuilder / EditFormBuilder          (hooks: useFormFields, useFormSettings)
        ├─► BuilderTabBar                    탭 전환 (편집 / 설정 / 응답)
        │
        ├─► [편집 탭]
        │     ├─► BuilderSidebar             필드 팔레트 (INPUT_TYPES, CONTENT_TYPES)
        │     └─► BuilderCanvas              DnD 캔버스
        │           └─► FieldCard            개별 필드 (레이블, 설명, 옵션, 타입별 UI)
        │                 ├─► RichTextEditor   (html 타입, SSR 제외)
        │                 └─► MapFieldEditor   (map 타입, SSR 제외)
        │
        ├─► [설정 탭]
        │     └─► SettingsPanel             테마 컬러, 알림·마감·웹훅, 이메일 템플릿, 다국어, 썸네일
        │           └─► BannerUpload
        │
        ├─► [응답 탭]  (EditFormBuilder 전용)
        │     └─► ResponsesTab             최근 응답 + 통계 + CSV 링크
        │
        ├─► SaveButton                      POST /api/projects (신규) or PATCH (편집)
        └─► PreviewModal                    PublicForm previewMode=true
```

### /dashboard (폼 목록)

```
page.tsx (Server)
  └─► ProjectList                           폼 카드 목록
        ├── 공개/비공개 뱃지
        ├── "응답 보기" → /dashboard/[id]/responses
        ├── "편집" → /dashboard/[id]/edit
        ├── "복제" → POST /api/duplicate
        └── "삭제" → DELETE /api/projects
```

### /dashboard/[id]/responses (응답)

```
page.tsx (Server)
  └─► ResponsesTable                        응답 테이블 + 모달 + 통계 바
        └── "CSV 내보내기" → GET /dashboard/[id]/responses/export
```

---

## 5. API 엔드포인트 한눈에 보기

| Method | 경로 | 역할 | 호출 컴포넌트 |
|--------|------|------|--------------|
| POST | `/api/projects` | 폼 생성 | SaveButton |
| PATCH | `/api/projects` | 폼 수정 | SaveButton |
| DELETE | `/api/projects` | 폼 삭제 | ProjectList |
| POST | `/api/submit` | 폼 제출 | PublicForm |
| POST | `/api/duplicate` | 폼 복제 | ProjectList |
| GET | `/dashboard/[id]/responses/export` | CSV 내보내기 | ResponsesTable |
| GET | `/auth/callback` | OAuth 콜백 | — |
| GET | `/api/admin/users` | 사용자 목록 | AdminUserList |
| POST | `/api/admin/update-role` | 역할 변경 | AdminUserList |
| POST | `/api/admin/reset-password` | 비밀번호 초기화 | AdminUserList |
| POST | `/api/admin/delete-user` | 회원 삭제 | AdminUserList |

---

## 6. 데이터 흐름 요약

```
Supabase Auth
  ├── 로그인 세션 (쿠키) → middleware.ts가 /dashboard 보호
  ├── profiles 테이블 → role (editor / administrator)
  └── auth.admin API → 회원 삭제 / 비밀번호 초기화 (service_role key 필요)

Supabase DB (PostgreSQL)
  ├── projects       ← 폼 메타데이터 (user_id FK, RLS: 소유자만 수정)
  ├── form_fields    ← 필드 정의 (project_id FK, CASCADE)
  └── submissions    ← 응답 데이터 (project_id FK, anon INSERT 허용)

Supabase Storage (banners 버킷, public)
  ├── project-banners/{uuid}   배너 이미지
  ├── field-images/{uuid}      필드 이미지
  └── thumbnails/{uuid}        폼 썸네일

Resend (이메일 서비스)
  └── /api/submit 에서 RESEND_API_KEY로 발송
        ├── 관리자 알림 (admin_email_template or 기본 템플릿)
        └── 응답자 확인 (user_email_template 있을 때만)
```

---

## 7. 유지보수 가이드

### 새 페이지 추가 시
1. `src/app/...` 에 `page.tsx` 생성
2. 인증이 필요한 경로면 `middleware.ts`의 `matcher`에 추가
3. 관리자 전용이면 서버 컴포넌트 or API에서 `getUserRole()` 호출
4. 이 문서 §1(사이트맵), §2(권한), §4(컴포넌트 연결) 업데이트

### 새 API 라우트 추가 시
1. `src/app/api/...` 에 `route.ts` 생성
2. 인증 체크: `createServerClient()` → `getUser()`
3. 관리자 전용: `getUserRole()` → `'administrator'` 확인
4. 이 문서 §5(API 엔드포인트) 업데이트

### 새 필드 타입 추가 시
1. `src/types/database.ts` — `FieldType` union 확장
2. `src/components/builder/FieldCard.tsx` — 렌더 추가
3. `src/components/form/PublicForm.tsx` — 공개 폼 렌더 추가
4. `src/constants/builder.ts` — 사이드바 팔레트에 추가
5. Supabase DB — `form_fields_type_check` 제약 조건 업데이트
6. `.claudeprompts/01-SUPABASE-SCHEMA.md` — 타입 목록 업데이트
