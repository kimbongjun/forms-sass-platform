export interface WorkspaceHub {
  key: 'dashboard' | 'projects' | 'blueberry' | 'monitoring'
  href: string
  label: string
  description: string
}

export interface ProjectNavItem {
  key: string
  label: string
  description: string
  href: (projectId: string) => string
}

export interface ProjectNavGroup {
  label: string
  items: ProjectNavItem[]
}

export const WORKSPACE_HUBS: WorkspaceHub[] = [
  {
    key: 'dashboard',
    href: '/dashboard',
    label: 'Dashboard',
    description: '성과 요약 & 퀵 액션',
  },
  {
    key: 'projects',
    href: '/projects',
    label: 'Projects',
    description: '핵심 워크스페이스',
  },
  {
    key: 'blueberry',
    href: '/blueberry',
    label: '블루베리',
    description: '키워드 검색 인사이트',
  },
  {
    key: 'monitoring',
    href: '/monitoring',
    label: '모니터링',
    description: '웹사이트 상태 점검',
  },
]

export const PROJECT_NAV_GROUPS: ProjectNavGroup[] = [
  {
    label: 'Execution',
    items: [
      {
        key: 'execution/tasks',
        label: 'Task & WBS',
        description: '칸반 방식 업무 관리',
        href: (projectId) => `/projects/${projectId}/execution/tasks`,
      },
      {
        key: 'execution/forms',
        label: 'Form Builder',
        description: '프로젝트 전용 폼 생성',
        href: (projectId) => `/projects/${projectId}/execution/forms`,
      },
      {
        key: 'execution/live-responses',
        label: 'Live Responses',
        description: '실시간 응답 및 리드 관리',
        href: (projectId) => `/projects/${projectId}/execution/live-responses`,
      },
    ],
  },
  {
    label: 'Outputs',
    items: [
      {
        key: 'outputs/deliverables',
        label: '산출물 관리',
        description: 'SNS 게시물 · 영상 지표 관리',
        href: (projectId) => `/projects/${projectId}/outputs/deliverables`,
      },
      {
        key: 'outputs/clippings',
        label: '보도자료 클리핑',
        description: '언론 노출 · 외부 링크 아카이빙',
        href: (projectId) => `/projects/${projectId}/outputs/clippings`,
      },
    ],
  },
  {
    label: 'Insights',
    items: [
      {
        key: 'insights',
        label: '운영 결과 보고서',
        description: '전체 KPI · 목표 달성률 대시보드',
        href: (projectId) => `/projects/${projectId}/insights`,
      },
    ],
  },
]
