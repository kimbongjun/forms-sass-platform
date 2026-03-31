# 프로젝트 개요 & 폴더 구조

## 스택
- **Next.js 16** App Router · **TypeScript** · **Tailwind CSS v4** · **Supabase** (DB+Storage)
- **Resend** (이메일 알림) · **@dnd-kit** (드래그앤드롭) · **Tiptap v2** (WYSIWYG)
- **lucide-react** · **@supabase/ssr** (브라우저 클라이언트)

## 핵심 규칙
- `params`는 반드시 `await` → `params: Promise<{id:string}>`
- Server Component → `createServerClient()` / Client Component → `createClient()`
- Tiptap: `dynamic(...,{ssr:false})` + `immediatelyRender: false` 필수
- 타입 정의: `src/types/database.ts` (FieldType, FormField, Project, Submission)
- 슬러그: ASCII-only 자동 생성 (`form-{rand6}`, 한글 제거)

## 폴더 구조
```
src/
├── app/
│   ├── [slug]/page.tsx                       공개 폼 뷰 (Server) — 비공개/마감/최대응답 검사
│   ├── api/submit/route.ts                   제출 API (POST → 제한검사 → DB저장 → 이메일)
│   ├── dashboard/
│   │   ├── page.tsx                          프로젝트 목록 (Server)
│   │   ├── new/page.tsx                      신규 생성 (Server shell → FormBuilder)
│   │   └── [id]/
│   │       ├── edit/page.tsx                 편집 (Server shell → EditFormBuilder)
│   │       └── responses/
│   │           ├── page.tsx                  응답 확인 대시보드 (Server)
│   │           └── export/route.ts           CSV 내보내기 GET 핸들러
│   ├── page.tsx                              랜딩 페이지
│   └── globals.css                           Tiptap 스타일 포함
├── components/
│   ├── builder/                  (모두 'use client')
│   │   ├── FormBuilder.tsx       신규 빌더 전체 레이아웃
│   │   ├── EditFormBuilder.tsx   편집 빌더 전체 레이아웃
│   │   ├── FieldCard.tsx         필드 카드 (DnD + 13가지 타입 + 미리보기)
│   │   ├── MapFieldEditor.tsx    지도 iframe 입력 (API 불필요, 비용 없음)
│   │   ├── BannerUpload.tsx      배너 업로드/미리보기
│   │   ├── SaveButton.tsx        신규 저장 핸들러
│   │   └── RichTextEditor.tsx    Tiptap WYSIWYG (dynamic, ssr:false)
│   ├── dashboard/
│   │   └── ProjectList.tsx       목록 + 개별/일괄 삭제 (Client)
│   └── form/
│       └── PublicForm.tsx        공개 폼 렌더 + 제출 (Client)
├── types/database.ts
└── utils/supabase/
    ├── client.ts    createClient() — 브라우저
    ├── server.ts    createServerClient() — Server Component
    └── storage.ts   uploadBanner(supabase, file) → string URL
```

## 저장/수정 흐름
- **신규**: `projects INSERT` (is_published/deadline/max_submissions 포함) → `uploadBanner` → `form_fields bulk INSERT` → `/dashboard`
- **수정**: `projects UPDATE` → `form_fields DELETE` → `form_fields re-INSERT` → `/dashboard`
- **제출**: `POST /api/submit` → 제한 검사 (is_published/deadline/max_submissions) → `submissions INSERT` → Resend 이메일 발송 (입력 필드만)
