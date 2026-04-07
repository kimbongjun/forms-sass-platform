'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

interface TabNavigationProps {
  projectId: string
}

type OpenMenu = 'execution' | 'outputs' | null

export default function TabNavigation({ projectId }: TabNavigationProps) {
  const pathname = usePathname()
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null)

  const baseUrl = `/projects/${projectId}`
  const isOverview = pathname === baseUrl
  const isGoals = pathname.startsWith(`${baseUrl}/goals`)
  const isSchedule = pathname.startsWith(`${baseUrl}/schedule`)
  const isExecution = pathname.startsWith(`${baseUrl}/execution`)
  const isBudget = pathname.startsWith(`${baseUrl}/budget`)
  const isOutputs = pathname.startsWith(`${baseUrl}/outputs`)
  const isInsights = pathname.startsWith(`${baseUrl}/insights`)
  const isIssues = pathname.startsWith(`${baseUrl}/issues`)

  const executionLinks = useMemo(
    () => [
      { href: `${baseUrl}/execution/forms`, label: '폼/서베이 관리' },
      { href: `${baseUrl}/execution/tasks`, label: 'Task & WBS' },
    ],
    [baseUrl]
  )

  const outputsLinks = useMemo(
    () => [
      { href: `${baseUrl}/outputs/deliverables`, label: '산출물 관리' },
      { href: `${baseUrl}/outputs/clippings`, label: '보도자료 클리핑' },
    ],
    [baseUrl]
  )

  const activeMenu: OpenMenu = isExecution ? 'execution' : isOutputs ? 'outputs' : openMenu

  // pathname 변경 시 운영/산출물 섹션 밖으로 이동하면 열린 메뉴 닫기
  useEffect(() => {
    if (!isExecution && !isOutputs) {
      setOpenMenu(null)
    }
  }, [pathname, isExecution, isOutputs])

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpenMenu(null)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  const tabClass = (active: boolean) =>
    [
      'rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors',
      active ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900',
    ].join(' ')

  const subTabClass = (active: boolean) =>
    [
      'inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
      active
        ? 'bg-gray-900 text-white'
        : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50 hover:text-gray-900',
    ].join(' ')

  function toggleMenu(menu: Exclude<OpenMenu, null>) {
    const links = menu === 'execution' ? executionLinks : outputsLinks
    const isActiveSection = menu === 'execution' ? isExecution : isOutputs

    if (activeMenu === menu && !isActiveSection) {
      setOpenMenu(null)
      return
    }

    setOpenMenu(menu)

    if (!isActiveSection) {
      router.push(links[0].href)
    }
  }

  const activeSubMenu = activeMenu === 'execution' ? executionLinks : activeMenu === 'outputs' ? outputsLinks : null

  return (
    <div ref={containerRef} className="space-y-2">
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        <Link href={baseUrl} className={tabClass(isOverview)}>
          개요
        </Link>
        <Link href={`${baseUrl}/goals`} className={tabClass(isGoals)}>
          목표
        </Link>
        <Link href={`${baseUrl}/schedule`} className={tabClass(isSchedule)}>
          일정
        </Link>
        <Link href={`${baseUrl}/budget`} className={tabClass(isBudget)}>
          예산
        </Link>
        <button type="button" onClick={() => toggleMenu('execution')} className={tabClass(isExecution)}>
          운영
        </button>
        <button type="button" onClick={() => toggleMenu('outputs')} className={tabClass(isOutputs)}>
          산출물
        </button>
        <Link href={`${baseUrl}/insights`} className={tabClass(isInsights)}>
          인사이트
        </Link>
        <Link href={`${baseUrl}/issues`} className={tabClass(isIssues)}>
          이슈 트래커
        </Link>
      </div>

      {activeSubMenu ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-2">
          {activeSubMenu.map((item) => {
            const active = pathname.startsWith(item.href)
            return (
              <Link key={item.href} href={item.href} className={subTabClass(active)}>
                {item.label}
              </Link>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
