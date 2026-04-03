# 메뉴 구조 (현재 기준)

> 작성일: 2026-04-03  
> 이 문서는 향후 메뉴 개선 기획 시 현황 파악용으로 사용합니다.

---

## 1. 공개 페이지 (비로그인 접근 가능)

```
/ (홈 · 랜딩)
│
├── /login                          로그인 / 회원가입
│   └── (OAuth 콜백) /auth/callback
│
├── /[slug]                         공개 폼 응답 페이지 (개별 폼)
│
├── /announcements                  공지사항 목록
│   └── /announcements/[id]         공지사항 상세
│
├── /release-notes                  릴리즈노트 목록
│   └── /release-notes/[id]         릴리즈노트 상세
│
├── /privacy                        개인정보처리방침
├── /terms                          이용약관
└── /service                        서비스이용동의
```

**공개 페이지 공통 레이아웃**
- 상단: `SiteHeader` (로고 + 공지사항·릴리즈노트 링크)
- 하단: `SiteFooter` (약관 링크 + 저작권 문구)
- 콘텐츠 폭: `max-w-7xl`

---

## 2. 대시보드 — 일반 사용자 (로그인 필요)

### 2-1. 글로벌 헤더 (DashboardMainLayout)

```
[로고 · 사이트명]    공지사항    릴리즈노트    [UserMenu]
```

| UserMenu 드롭다운 | 대상 |
|---|---|
| 계정 설정 | /dashboard/account |
| 로그아웃 | — |

### 2-2. 사이드바 (DashboardSidebar)

```
프로젝트 목록    /dashboard
새 프로젝트      /dashboard/new
```

### 2-3. 대시보드 페이지 구조

```
/dashboard                          프로젝트 목록 (카드 그리드)
│   ├── [카드] 폼 미리보기 링크 → /[slug]
│   ├── [카드] 응답 보기 → /dashboard/[id]/responses
│   ├── [카드] 편집 → /dashboard/(builder)/[id]/edit
│   └── [카드] 복제 / 삭제
│
├── /dashboard/(builder)/new         새 폼 빌더
│   └── (저장) → /dashboard
│
├── /dashboard/(builder)/[id]/edit   폼 편집 빌더
│   ├── 탭: 필드 편집
│   ├── 탭: 설정
│   └── 탭: 응답 (ResponsesTab)
│
└── /dashboard/[id]/responses        응답 목록 (테이블 + 통계 바)
    ├── [행 클릭] → 상세 모달
    └── /dashboard/[id]/responses/stats  필드별 상세 통계
        (CSV 내보내기 → /dashboard/[id]/responses/export)
```

---

## 3. 대시보드 — 관리자 전용 (role = administrator)

### 3-1. UserMenu 드롭다운 (관리자 추가 항목)

```
[관리자]
├── 회원 관리          /dashboard/admin/users
├── 사이트 설정        /dashboard/admin/settings
├── 공지사항 관리      /dashboard/admin/announcements
└── 릴리즈노트 관리    /dashboard/admin/release-notes

[공통]
├── 계정 설정          /dashboard/account
└── 로그아웃
```

### 3-2. 관리자 페이지 구조

```
/dashboard/admin/users               회원 목록 · 역할 변경 · 비밀번호 초기화 · 삭제

/dashboard/admin/settings            글로벌 사이트 설정
│   ├── 탭: 일반 설정
│   │   ├── SEO / 메타 (사이트 제목, 설명)
│   │   ├── OG 이미지 (파일 업로드)
│   │   ├── 파비콘 (파일 업로드)
│   │   └── 기타 (푸터 문구, 파일 최대 크기)
│   └── 탭: 약관 관리
│       ├── 개인정보처리방침 (WYSIWYG · 공개: /privacy)
│       ├── 이용약관 (WYSIWYG · 공개: /terms)
│       └── 서비스이용동의 (WYSIWYG · 공개: /service)

/dashboard/admin/announcements       공지사항 관리 목록
│   ├── /dashboard/admin/announcements/new       새 공지 작성
│   └── /dashboard/admin/announcements/[id]/edit 공지 수정

/dashboard/admin/release-notes       릴리즈노트 관리 목록
│   ├── [자동 생성 버튼] → POST /api/admin/release-notes/generate
│   ├── /dashboard/admin/release-notes/new       새 릴리즈노트 작성
│   └── /dashboard/admin/release-notes/[id]/edit 릴리즈노트 수정

/dashboard/account                   계정 정보 · 비밀번호 변경
```

---

## 4. API 라우트 전체 목록

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/projects` | 신규 폼 생성 |
| POST | `/api/duplicate` | 폼 복제 |
| POST | `/api/submit` | 공개 폼 응답 제출 |
| GET | `/dashboard/[id]/responses/export` | CSV 내보내기 |
| GET/PUT | `/api/admin/settings` | 사이트 설정 조회/저장 |
| GET | `/api/admin/users` | 회원 목록 |
| PUT | `/api/admin/update-role` | 역할 변경 |
| POST | `/api/admin/reset-password` | 비밀번호 초기화 |
| DELETE | `/api/admin/delete-user` | 회원 삭제 |
| POST | `/api/admin/announcements` | 공지사항 생성 |
| PUT | `/api/admin/announcements/[id]` | 공지사항 수정 |
| DELETE | `/api/admin/announcements/[id]` | 공지사항 삭제 |
| POST | `/api/admin/release-notes` | 릴리즈노트 수동 생성 |
| PUT | `/api/admin/release-notes/[id]` | 릴리즈노트 수정 |
| DELETE | `/api/admin/release-notes/[id]` | 릴리즈노트 삭제 |
| POST | `/api/admin/release-notes/generate` | 릴리즈노트 git 자동 생성 |

---

## 5. 개선 검토 포인트 (향후 작업용)

> 현재 구조의 UX/구조적 문제점을 정리합니다.

- **사이드바 항목 부족**: 사이드바에 "프로젝트 목록"과 "새 프로젝트" 두 항목만 있어 확장성 부족
- **관리자 메뉴 접근성**: 관리자 기능이 UserMenu 드롭다운에만 있어 발견성 낮음
- **공개/대시보드 전환**: 대시보드 헤더에서 공개 페이지(공지/릴리즈노트)로 이동 시 레이아웃 변경이 있음
- **응답/통계 탐색**: 응답 목록에서 통계로 넘어가는 뎁스가 깊음 (/responses → /responses/stats)
- **계정 설정**: 사이드바에 없고 UserMenu에만 있어 접근성 낮음
