# 컴포넌트 구조 & UI 가이드

## 빌더 레이아웃 (FormBuilder / EditFormBuilder)

```
┌─ Header ──────────────────────────────────────────────┐
│  ← 뒤로   [프로젝트 제목]                [저장하기]    │
├─ Sidebar (w-56) ──┬─ Canvas (flex-1) ───────────────── ┤
│ [입력 필드]        │  BannerUpload                      │
│ · 텍스트          │  프로젝트 제목 input                │
│ · 이메일          │  알림 이메일 input                  │
│ · 장문            │  ───────────────────               │
│ · 체크박스        │  FieldCard × N (DnD 순서변경)       │
│ · 셀렉박스        │                                    │
│ · 라디오          │                                    │
│ · 체크박스 그룹   │                                    │
│ [꾸밈 요소]        │                                    │
│ · HTML           │                                    │
│ · 텍스트 블록     │                                    │
│ · 이미지          │                                    │
│ · 구분선          │                                    │
│ · 지도           │                                    │
│ · YouTube        │                                    │
│ ─────────────── │                                    │
│ [테마 컬러]        │                                    │
│ 프리셋 8종 + 커스텀│                                    │
└───────────────────┴────────────────────────────────────┘
```

## FieldCard — 타입별 동작

| 타입 | 라벨 입력 | 필수 토글 | 빌더 추가 UI | 빌더 미리보기 |
|---|---|---|---|---|
| text / email / textarea / checkbox | ✅ | ✅ | 없음 | - |
| select / radio / checkbox_group | ✅ | ✅ | 옵션 목록 (추가/수정/삭제) | - |
| html | ❌ | ❌ | Tiptap WYSIWYG 에디터 | - |
| text_block | ❌ | ❌ | textarea (평문 텍스트) | - |
| image | ✅ (캡션) | ❌ | URL 입력 + 파일 업로드 버튼 | URL 있으면 `<img>` 미리보기 |
| divider | ❌ | ❌ | `<hr>` 미리보기 | - |
| map | ❌ | ❌ | MapFieldEditor (iframe 코드/URL 입력) | 40% 비율 iframe |
| youtube | ❌ | ❌ | URL 입력 | videoId 파싱 → 56.25% iframe |

- 모든 카드: GripVertical 드래그 핸들 (DnD 순서 변경)
- `content` 필드: html/text_block/map/youtube/image 타입의 내용·URL 저장
- `showLabel`: 입력 타입 + image만 라벨 표시
- `showRequired`: 입력 타입(text/email/textarea/checkbox/select/radio/checkbox_group)만

## MapFieldEditor
- **API 불필요, 비용 없음** — Google Maps "지도 퍼가기" iframe 코드 수동 붙여넣기
- 입력 파싱 우선순위:
  1. `<iframe src="...">` HTML → src 추출
  2. `output=embed` 포함 URL → 그대로 사용
  3. 일반 Google Maps URL / 주소 텍스트 → `maps.google.com/maps?q=...&z=16&output=embed` 변환
- 빌더 내 실시간 미리보기 (40% 비율)
- 지도 사용법: Google Maps → 공유 → 지도 퍼가기 → `<iframe>` 코드 복사

## SaveButton (신규 저장)
```typescript
interface SaveButtonProps {
  title: string
  notificationEmail: string
  isPublished: boolean
  deadline: string          // datetime-local 문자열, 빈 문자열이면 null 저장
  maxSubmissions: string    // 숫자 문자열, 빈 문자열이면 null 저장
  themeColor: string
  fields: FormField[]
  bannerFile: File | null
  onError: (msg: string) => void
}
```

## EditFormBuilder (수정 저장)
- `handleUpdate()`: projects UPDATE (is_published/deadline/max_submissions 포함) → form_fields DELETE → form_fields re-INSERT
- 저장 완료 후 1.2초 뒤 `/dashboard` 이동
- `deadline` 초기값: `project.deadline` → `new Date().toISOString().slice(0, 16)` 변환

## 테마 컬러
- 사이드바 프리셋: `['#111827','#2563EB','#16A34A','#DC2626','#9333EA','#F59E0B','#0891B2','#EC4899']`
- `projects.theme_color`에 저장
- 공개 폼 적용: 제출 버튼 `backgroundColor`, 체크박스·라디오 `accentColor`

## 공개 폼 (PublicForm)
```typescript
interface PublicFormProps {
  projectId: string
  fields: FormField[]
  themeColor?: string  // 기본값 '#111827'
}
```
| 타입 | 렌더 방식 |
|---|---|
| text / email / textarea | input / textarea |
| checkbox | 체크박스 + "동의합니다" |
| select | `<select>` |
| radio | radio 버튼 목록 |
| checkbox_group | 체크박스 목록 |
| text_block | `<p className="whitespace-pre-wrap">` |
| image | `<figure><img><figcaption>` |
| divider | `<hr>` |
| html | `dangerouslySetInnerHTML` |
| map | 반응형 16:9 iframe (구형 embed/v1 URL 자동 변환) |
| youtube | videoId 추출 → 반응형 16:9 iframe |

- map 하위 호환: `embed/v1/place?key=...` 포맷은 q 파라미터 추출 후 신규 포맷으로 변환

## 대시보드 (ProjectList)
- 전체 선택 체크박스 + 선택 수 뱃지
- 일괄 삭제: "N개 삭제" → 인라인 확인/취소
- 개별 삭제: 휴지통 아이콘 → `window.confirm()` 후 삭제
- BarChart2 아이콘: `/dashboard/{id}/responses` 응답 확인 페이지 이동
- Eye 아이콘: `/{slug}` 새 탭으로 공개 폼 뷰
- 삭제 완료 후 `router.refresh()`로 목록 갱신

## 스타일 원칙
- 대시보드: `bg-gray-50` 배경, 카드 `border border-gray-200 bg-white rounded-2xl`
- 빌더: 2컬럼 (사이드바 고정 + 캔버스 스크롤)
- 공개 폼: `max-w-xl` 중앙 정렬, 배너 상단 16:9
- `next/image` remotePatterns: `*.supabase.co/storage/v1/object/public/**`
- Tiptap 에디터 스타일: `globals.css` `.tiptap-editor .ProseMirror` 클래스
