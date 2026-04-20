import type { IndustryRegion } from '@/types/database'

export interface AiAnalysisItem {
  title: string
  summary: string
  category: string
  region: IndustryRegion
  company_tags: string[]
  source_name: string
  source_url: string | null
  published_at: string
  is_featured: boolean
  content?: string
  ai_source?: 'openai' | 'gemini' | 'claude'
}

export interface AiAnalysisResult {
  items: AiAnalysisItem[]
  market_summary: string
  key_insights: string[]
  ai_source: 'openai' | 'gemini' | 'claude'
  generated_at: string
}

const TODAY = () => new Date().toISOString().slice(0, 10)

const COMPANIES_DESC = `
- 솔타메디칼(Solta Medical): HIFU 기반 써마지(Thermage), 리스타일렌 등 피부과 미용 의료기기
- 멀츠(Merz Aesthetics): 고강도 초음파 울쎄라(Ultherapy), 필러·보톡스 제품군
- 제이시스메디칼(Jeisys Medical): 레이저·RF 기반 덴서티(Densiti), 인트라셀 등 국내 중견 의료기기
- 루트로닉(Lutronic): 레이저 기반 세르프(Cerfs), 레이저 에이스트 등 글로벌 판매
- 클래시스(Classys): HIFU 슈링크(Shurink), 볼뉴머(Volnewmer) 등 메가 히트 제품군`

const CATEGORIES_DESC = `
- trend: 시장 주요 동향, 업계 이슈, 경쟁 구도 변화
- advertising: 온라인·디지털 광고 캠페인, 마케팅 전략
- celebrity: 연예인 모델 계약, 브랜드 앰배서더, 콘텐츠 마케팅
- medical_device: 신제품 출시, 임상 승인, 기술 혁신, 특허
- conference: 의학 학회, 전시회, 산업 행사 (IMCAS, AMWC, 대한피부과학회 등)
- sns_event: 인스타그램 마케팅 캠페인, 릴스/피드 콘텐츠, 인플루언서·앰배서더 인스타 활동, 바이럴 이벤트 (Instagram 중심으로 분석)
- ai_case: AI 기술 적용 (진단, 시뮬레이션, 마케팅 자동화, 의료 데이터 분석)
- press_release: 기업 공식 보도자료, 투자, M&A, IR
- finance: 실적 발표, 주가, 재무 지표, 투자 유치`

export function buildSystemPrompt(region: IndustryRegion): string {
  const regionLabel = region === 'domestic' ? '국내(한국)' : '글로벌(미국/유럽/아시아 포함)'
  return `당신은 피부 미용 의료기기(Aesthetic Medical Device) 산업 전문 애널리스트입니다.
분석 대상 기업:${COMPANIES_DESC}

분석 지역: ${regionLabel}
분석 카테고리:${CATEGORIES_DESC}

출력 규칙:
1. 반드시 유효한 JSON만 출력합니다 (마크다운 코드블록 없이 순수 JSON).
2. published_at은 최근 7일 이내 날짜를 YYYY-MM-DD 형식으로 추정합니다.
3. 각 카테고리별 최소 1개, 최대 3개 아이템을 생성합니다.
4. 위 5개 기업 중 관련성 높은 회사를 company_tags에 포함합니다.
5. is_featured: true는 가장 임팩트 큰 3개 아이템에만 적용합니다.
6. summary는 핵심을 2~3문장으로 간결하게 서술합니다.
7. source_name은 실제 미디어/기관명(예: 헬스조선, Reuters, Fierce Biotech)을 사용합니다.`
}

export function buildUserPrompt(region: IndustryRegion): string {
  const today = TODAY()
  const regionLabel = region === 'domestic' ? '국내' : '글로벌'
  return `오늘 날짜: ${today}
${regionLabel} 피부 미용 의료기기 업계의 최신 동향을 분석하여 아래 JSON 스키마로 응답하세요.

{
  "items": [
    {
      "title": "아이템 제목",
      "summary": "2~3문장 요약",
      "content": "상세 분석 내용 (3~5문장)",
      "category": "trend|advertising|celebrity|medical_device|conference|sns_event|ai_case|press_release|finance",
      "region": "${region}",
      "company_tags": ["솔타메디칼", "멀츠", "제이시스메디칼", "루트로닉", "클래시스"],
      "source_name": "출처 미디어명",
      "source_url": null,
      "published_at": "YYYY-MM-DD",
      "is_featured": false
    }
  ],
  "market_summary": "전체 시장 현황 요약 (3~4문장)",
  "key_insights": ["핵심 인사이트 1", "핵심 인사이트 2", "핵심 인사이트 3", "핵심 인사이트 4", "핵심 인사이트 5"]
}

9개 카테고리 각각에 대해 최소 1개씩, 총 10~15개 아이템을 생성하세요.`
}
