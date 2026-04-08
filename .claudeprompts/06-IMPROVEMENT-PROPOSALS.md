# 기능 개선 제안 (Functional Improvement Proposals)

> 최초 작성: 2026-04-07  
> 구현 완료: 2026-04-07  
> 분석 대상: `src/app`, `src/components`, `src/app/api` 전체 구조

---

## 구현 완료 항목 ✅

| # | 항목 | 구현 내용 |
|---|---|---|
| 1 | **프로젝트 목록 검색·필터** | 이미 구현되어 있음 확인 (이름·카테고리·국가·기간·팀원 필터) |
| 2 | **대시보드 KPI 차트** | `kpi/_components/KpiCharts.tsx` — 월별 응답 수·프로젝트 생성 수 SVG 바 차트 추가 |
| 3 | **Insights ↔ Goals KPI 달성률 연결** | Insights 페이지에 `project_goal_plans` 로드 → 목표 대비 달성률 진행 바 시각화 |
| 4 | **마일스톤 UI 연결** | `SchedulePlanner.tsx` 리팩토링 → 마일스톤 CRUD UI + API 연동 |
| 5 | **예산 실집행 추적** | `ProjectBudgetItem.actual_amount` 필드 추가 · 항목별·전체 집행률 바 표시 |
| 6 | **개요 진행 상태 요약** | 개요 페이지에 Task 완료율·미해결 이슈·KPI 달성률·예산 집행률 요약 카드 추가 |
| 7 | **이슈 알림** | issues API POST 시 critical/high 이슈 → project_members(notify=true) Resend 발송 |
| 8 | **SNS 지표 동기화** | `/api/projects/[id]/deliverables/sync` 엔드포인트 신설 · YouTube Data API 연동 · 산출물 페이지에 "지표 동기화" 버튼 추가 |
| 9 | **라이브 응답 Realtime** | `LiveFeed.tsx` 클라이언트 컴포넌트 분리 + Supabase Realtime `postgres_changes` 구독 |
| 10 | **Stub 페이지 구현** | leads(응답 집계), templates(프로젝트 복제), reports(인사이트 링크), feedback(이슈 전체 뷰) |

---

## SQL 마이그레이션 필요 항목

아래 항목은 **Supabase SQL Editor에서 직접 실행이 필요**합니다.

### 필수 없음 (기존 JSONB 구조 활용)

`project_budget_plans.items`는 JSONB이므로 `actual_amount` 필드는 SQL 변경 없이 TypeScript 타입과 UI만 업데이트했습니다.

### 선택적 마이그레이션

아래는 기능 확장을 위해 추후 적용을 권장하는 마이그레이션입니다.

---

#### 마이그레이션 23: `project_issues` 담당자 필드 추가 (이슈 알림 고도화용)

현재는 `project_members(notify=true)` 전원에게 알림을 발송합니다.  
특정 담당자에게만 알림을 보내려면 아래 컬럼을 추가하세요.

```sql
-- 마이그레이션 23: 이슈 담당자 필드 추가
ALTER TABLE project_issues
  ADD COLUMN IF NOT EXISTS assignee_name text,
  ADD COLUMN IF NOT EXISTS assignee_email text;
```

---

#### 마이그레이션 24: YouTube 지표 메모 필드 (산출물 동기화 로그)

현재 `project_deliverables`에는 동기화 오류 로그 필드가 없습니다.  
동기화 실패 원인을 추적하려면 추가하세요.

```sql
-- 마이그레이션 24: 산출물 동기화 상태 필드
ALTER TABLE project_deliverables
  ADD COLUMN IF NOT EXISTS sync_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS sync_error text;
-- sync_status: 'pending' | 'synced' | 'failed' | 'skipped'
```

---

#### 환경변수 추가 필요 (SQL 아님)

SNS 지표 자동 동기화를 위해 `.env.local`에 아래 변수 추가:

```
# YouTube Data API v3 (Google Cloud Console에서 발급)
YOUTUBE_API_KEY=AIza...

# Instagram Graph API (Meta Business Suite에서 발급, 추후 구현)
# INSTAGRAM_ACCESS_TOKEN=EAAB...
```

YouTube API 없이도 수동으로 지표를 입력하는 기존 기능은 정상 동작합니다.

---

## 우선순위 요약 (구현 전 기준)

| 우선순위 | 항목 | 상태 |
|:---:|---|:---:|
