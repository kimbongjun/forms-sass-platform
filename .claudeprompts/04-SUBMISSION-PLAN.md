# 폼 제출 & 응답 관리

## 제출 흐름 (POST /api/submit)

```
PublicForm → POST /api/submit
  → 0. 제출 제한 검사 (is_published / deadline / max_submissions)
  → 1. submissions INSERT
  → 2. 이메일 발송 (notification_email + RESEND_API_KEY 있는 경우)
```

### 요청 바디
```typescript
{
  projectId: string
  answers: Record<string, string | boolean | string[]>
  fields: { id: string; label: string; type: FieldType }[]
}
```

### 제출 제한 검사 순서
| 조건 | HTTP 상태 | 메시지 |
|---|---|---|
| `is_published === false` | 403 | 비공개 폼입니다 |
| `deadline < now` | 403 | 제출 마감된 폼입니다 |
| `submissions.count >= max_submissions` | 403 | 최대 응답 수에 도달했습니다 |

### 이메일 필터 규칙
이메일에는 **입력 타입만** 포함 — 꾸밈 요소 제외

```typescript
const INPUT_TYPES = ['text', 'email', 'textarea', 'checkbox', 'select', 'radio', 'checkbox_group']
fields.filter((f) => INPUT_TYPES.includes(f.type))
```

---

## 응답 확인 대시보드

### 페이지: `/dashboard/[id]/responses`
- **Server Component** — `createServerClient()` 사용
- project + form_fields + submissions 병렬 조회
- 입력 타입 필드만 컬럼으로 표시 (INPUT_TYPES 화이트리스트)
- 응답 없을 때: 빈 상태 UI + 폼 링크 안내

### 테이블 구조
| 컬럼 | 내용 |
|---|---|
| 제출 시각 | `created_at` → ko-KR 포맷 |
| 필드 컬럼 × N | `answers[field.id]` 값 표시 |

### 값 표시 규칙
| 타입 | 표시 방식 |
|---|---|
| `string[]` (checkbox_group) | 쉼표 구분 join |
| `boolean` (checkbox) | ✅ 동의 / ❌ 미동의 |
| 빈 값 | `—` |

---

## CSV 내보내기

### 라우트: GET `/dashboard/[id]/responses/export`
- **Route Handler** (`route.ts`) — `createServerClient()` 사용
- BOM(`\uFEFF`) 포함 UTF-8 → Excel 한글 깨짐 방지
- `Content-Disposition: attachment; filename*=UTF-8''...` 형식

### CSV 구조
```
제출 시각,필드1,필드2,...
2026-01-01 09:00,홍길동,hong@example.com,...
```

### 특수문자 이스케이프
- 쉼표·쌍따옴표·줄바꿈 포함 시 `"..."` 로 감싸기
- 내부 `"` → `""` 이중 처리

---

## 폼 공개 설정

### projects 테이블 추가 컬럼
```sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT true;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deadline timestamptz;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS max_submissions int;
```

### 빌더 UI (FormBuilder / EditFormBuilder)
| 항목 | 입력 타입 | 기본값 |
|---|---|---|
| 공개/비공개 토글 | 커스텀 toggle (checkbox sr-only) | `true` (공개) |
| 제출 마감일 | `datetime-local` | 없음 |
| 최대 응답 수 | `number` (min=1) | 없음 (제한 없음) |

### 공개 폼 (`[slug]/page.tsx`) 검사 순서
1. `is_published === false` → "비공개 폼" 페이지
2. `deadline < now` → "제출 마감" 페이지
3. `submissions.count >= max_submissions` → "응답 마감" 페이지
4. 정상 → `PublicForm` 렌더

---

## 이미지 필드 파일 업로드

### 스토리지 함수: `uploadFieldImage(supabase, file)`
- 버킷: `banners` (기존 배너 버킷 공유)
- 경로: `field-images/{uuid}.{ext}`
- 반환: Public URL → `FormField.content`에 저장

### FieldCard 이미지 섹션
- URL 직접 입력 + "파일 업로드" 버튼 병행 제공
- 업로드 중 `Loader2` 스피너 표시
- 업로드 완료 시 URL 자동 입력 + 미리보기 갱신

---

## 파일 위치 요약

| 파일 | 역할 |
|---|---|
| `src/app/api/submit/route.ts` | 제출 POST 핸들러 |
| `src/app/dashboard/[id]/responses/page.tsx` | 응답 확인 대시보드 (Server) |
| `src/app/dashboard/[id]/responses/export/route.ts` | CSV 내보내기 GET 핸들러 |
| `src/app/[slug]/page.tsx` | 공개 폼 — 제한 검사 포함 |
| `src/components/form/PublicForm.tsx` | 폼 렌더 + 제출 (Client) |
| `src/utils/supabase/storage.ts` | `uploadBanner` + `uploadFieldImage` |
