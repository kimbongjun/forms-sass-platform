'use client'

import { LayoutTemplate, Settings2, BarChart2 } from 'lucide-react'

export type BuilderTab = 'edit' | 'settings' | 'responses'

interface Tab {
  id: BuilderTab
  label: string
  icon: React.ReactNode
}

const BASE_TABS: Tab[] = [
  { id: 'edit', label: '폼 편집', icon: <LayoutTemplate className="h-4 w-4" /> },
  { id: 'settings', label: '폼 설정', icon: <Settings2 className="h-4 w-4" /> },
]

const RESPONSES_TAB: Tab = {
  id: 'responses',
  label: '신청 현황',
  icon: <BarChart2 className="h-4 w-4" />,
}

interface BuilderTabBarProps {
  activeTab: BuilderTab
  onChange: (tab: BuilderTab) => void
  showResponses?: boolean
}

export default function BuilderTabBar({ activeTab, onChange, showResponses = false }: BuilderTabBarProps) {
  const tabs = showResponses ? [...BASE_TABS, RESPONSES_TAB] : BASE_TABS

  return (
    <div className="flex border-b border-gray-200 bg-white px-6">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === tab.id
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  )
}
