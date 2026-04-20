# 업계분석 (Industry Analysis) 개선 계획

> 작성일: 2026-04-14  
> 현황 파악 후 작성한 버그 수정 + 기능 개선 계획서

---

## 1. 현재 구조 요약

```
src/app/industry-analysis/
  page.tsx                          # 서버 컴포넌트 (메타데이터)
  layout.tsx
  _components/
    IndustryAnalysisClient.tsx      # 메인 클라이언트 컴포넌트 (700줄)
    CalendarViews.tsx               # 주간/월간 달력 뷰

src/lib/industry-analysis/
  runner.ts          # OpenAI + Gemini 병렬 실행, Google 검색 폴백
  openai.ts          # GPT-4o / GPT-4o-mini 호출
  gemini.ts          # Gemini 모델 호출
  google-search.ts   # Google News RSS 폴백 수집
  prompts.ts         # 시스템/유저 프롬프트 + 타입 정의

src/app/api/industry-analysis/
  run/route.ts       # POST: AI 분석 실행 / GET: API 키 설정 상태
  runs/route.ts      # GET: 분석 실행 이력 목록
  items/route.ts     # GET: 아이템 목록 (region, run_id 필터)
  items/[itemId]/route.ts
  newsletter/
    subscribers/route.ts
    subscribers/[subscriberId]/route.ts
    send/route.ts

supabase/migrations/
  20260414_industry_analysis.sql     # v1 (items, subscribers)
  20260414_industry_analysis_v2.sql  # v2 (runs 테이블 추가, ai_source 컬럼)
```

---

## 2. 발견된 버그 / 오류

### 🔴 P0 — 즉시 수정 (AI 분석 실패 원인)

#### [BUG-01] OpenAI SDK v6 — `max_tokens` 파라미터 deprecated
- **파일**: `src/lib/industry-analysis/openai.ts:61`
- **현황**: `max_tokens: 3000` 사용
- **원인**: OpenAI SDK v5부터 `max_tokens`는 deprecated, `max_completion_tokens`로 대체됨
- **영향**: 경고 또는 일부 모델에서 무시되어 토큰 제한 미적용 → 긴 응답에서 JSON 잘림 오류 발생 가능
- **수정**: `max_tokens` → `max_completion_tokens`

#### [BUG-02] Gemini 모델 `gemini-1.5-flash` 구식
- **파일**: `src/lib/industry-analysis/gemini.ts:30`
- **현황**: `model: 'gemini-1.5-flash'`
- **원인**: 2025년 말부터 Google AI Studio에서 `gemini-2.0-flash`가 기본 권장 모델로 전환됨. 1.5-flash는 할당량(quota) 제한이 강화될 수 있음
- **수정**: `gemini-2.0-flash`로 업그레이드 (JSON mode, 속도, 품질 개선)
- **참고**: `maxOutputTokens: 4096`은 그대로 유지 가능

#### [BUG-03] DB 스키마 vs TypeScript 타입 불일치
- **파일**: `supabase/migrations/20260414_industry_analysis_v2.sql:48`
- **현황**: `ai_source CHECK (ai_source IN ('claude', 'openai', 'gemini'))` — DB는 'claude' 허용
- **TypeScript**: `type AiSource = 'openai' | 'gemini'` — 'claude' 없음
- **영향**: 런타임 오류 없으나 미래에 Claude 연동 시 타입 오류 발생 가능
- **수정**: TypeScript 타입에 'claude' 추가 또는 DB CHECK에서 'claude' 제거 (현재는 비활성)

### 🟡 P1 — 성능/안정성 개선

#### [BUG-04] 아이템 API 무제한 조회
- **파일**: `src/app/api/industry-analysis/items/route.ts`
- **현황**: LIMIT 없이 전체 조회 (`SELECT * FROM industry_analysis_items`)
- **영향**: 데이터 누적 시 응답 지연 및 메모리 초과
- **수정**: `.limit(200)` 추가 + 최신순 정렬 확인

#### [BUG-05] 실행 이력 API 컬럼명 오류
- **파일**: `src/app/api/industry-analysis/runs/route.ts:10`
- **현황**: `.order('started_at', ...)` — DB 컬럼은 `started_at`
- **상태**: v2 마이그레이션 기준 OK (started_at 존재), 문제없음 확인

#### [BUG-06] 회사 필터 — 지역 무관하게 적용
- **파일**: `src/app/industry-analysis/_components/IndustryAnalysisClient.tsx:551-563`
- **현황**: `fetchAll`이 region 변경 시 API 재호출 하지만, 회사/카테고리 필터는 리셋 안 됨
- **수정**: region 변경 시 `activeCategory`, `activeCompany` 리셋

---

## 3. 기능 개선 계획

### 🟢 Phase 1 — API & 모델 수정 (즉시)

- [ ] OpenAI `max_tokens` → `max_completion_tokens` 변경
- [ ] Gemini 모델 `gemini-1.5-flash` → `gemini-2.0-flash` 업그레이드
- [ ] items API `.limit(200)` 추가
- [ ] region 변경 시 필터 리셋

### 🔵 Phase 2 — UX 개선 (단기)

- [ ] **에러 상세 표시**: AI 분석 실패 시 구체적 오류 메시지 표시 (현재는 "오류: ..." 만 표시)
- [ ] **에이전트별 실행 상태**: 분석 완료 후 OpenAI/Gemini/Google 각 결과 건수 표시 (현재 미표시)
- [ ] **아이템 pagination**: 200건 초과 시 "더보기" 버튼
- [ ] **날짜 필터**: 특정 기간 아이템만 표시

### 🟣 Phase 3 — 기능 확장 (중기)

- [ ] **Claude (Anthropic) 에이전트 추가**: 
  - `src/lib/industry-analysis/claude.ts` 생성
  - `@anthropic-ai/sdk` 연동
  - DB `ai_source` 타입에 'claude' 추가
  - 환경변수 `ANTHROPIC_API_KEY`

- [ ] **자동 스케줄 실행**: 
  - Vercel Cron으로 매일 오전 9시 자동 분석
  - `src/app/api/industry-analysis/cron/route.ts` 신설

- [ ] **아이템 편집 기능**: 
  - 제목/요약 인라인 수정
  - featured 토글
  - 카테고리 재분류

- [ ] **PDF 리포트 내보내기**: 최신 실행 결과를 PDF로 다운로드

---

## 4. 파일별 수정 요약

| 파일 | 수정 내용 | 우선순위 |
|---|---|---|
| `src/lib/industry-analysis/openai.ts` | `max_tokens` → `max_completion_tokens` | P0 |
| `src/lib/industry-analysis/gemini.ts` | 모델 `gemini-2.0-flash` 업그레이드 | P0 |
| `src/app/api/industry-analysis/items/route.ts` | `.limit(200)` 추가 | P1 |
| `src/app/industry-analysis/_components/IndustryAnalysisClient.tsx` | region 변경 시 필터 리셋 | P1 |
| `src/types/database.ts` | `AiSource`에 `'claude'` 추가 (선택) | P2 |

---

## 5. 환경변수 체크리스트

```bash
# .env.local 필수 설정
OPENAI_API_KEY=sk-proj-...          # OpenAI GPT-4o 사용 시
GOOGLE_AI_API_KEY=AIza...           # Gemini 사용 시

# 선택 (Phase 3)
ANTHROPIC_API_KEY=sk-ant-...        # Claude 에이전트 추가 시
```

---

## 6. 알려진 제약사항

- **Vercel Hobby Plan**: `maxDuration = 300`(5분) 설정이지만 실제로는 60초 제한
  - Hobby 플랜이라면 `maxDuration = 55`로 줄이고 타임아웃 에러 핸들링 강화 필요
- **Google News RSS**: IP 차단 가능성 있음 (Vercel 서버레스 IP 풀 공유)
  - 폴백 수집 실패 시 빈 화면 대신 안내 메시지 표시 필요
- **Gemini 무료 키 할당량**: `gemini-2.0-flash` 기준 분당 15회, 일 1,500회 제한
