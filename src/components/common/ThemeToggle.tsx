'use client'

import { useSyncExternalStore } from 'react'
import { Moon, Sun } from 'lucide-react'

type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'theme-preference'
const THEME_EVENT = 'theme-change'

function resolveThemeFromDom(): ThemeMode {
  if (typeof document !== 'undefined') {
    const domTheme = document.documentElement.dataset.theme
    if (domTheme === 'light' || domTheme === 'dark') {
      return domTheme
    }
  }

  return resolveTheme()
}

function resolveTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light'

  const savedTheme = window.localStorage.getItem(STORAGE_KEY)
  if (savedTheme === 'light' || savedTheme === 'dark') {
    return savedTheme
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getButtonClass(active: boolean) {
  if (active) {
    return 'brand-active shadow-sm'
  }

  return 'bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark-surface-button'
}

function subscribe(callback: () => void) {
  if (typeof window === 'undefined') {
    return () => undefined
  }

  const handleThemeChange = () => callback()
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

  window.addEventListener(THEME_EVENT, handleThemeChange)
  window.addEventListener('storage', handleThemeChange)
  mediaQuery.addEventListener('change', handleThemeChange)

  return () => {
    window.removeEventListener(THEME_EVENT, handleThemeChange)
    window.removeEventListener('storage', handleThemeChange)
    mediaQuery.removeEventListener('change', handleThemeChange)
  }
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, resolveThemeFromDom, () => 'light')

  function applyTheme(nextTheme: ThemeMode) {
    document.documentElement.dataset.theme = nextTheme
    window.localStorage.setItem(STORAGE_KEY, nextTheme)
    window.dispatchEvent(new Event(THEME_EVENT))
  }

  return (
    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-2">
      <button
        type="button"
        onClick={() => applyTheme('light')}
        className={[
          'flex items-center justify-center rounded-xl border border-transparent px-3 py-2 transition-colors',
          getButtonClass(theme === 'light'),
        ].join(' ')}
        aria-label="라이트 모드로 전환"
        aria-pressed={theme === 'light'}
      >
        <Sun className="h-4 w-4" />
        <span className="sr-only">라이트 모드</span>
      </button>
      <button
        type="button"
        onClick={() => applyTheme('dark')}
        className={[
          'flex items-center justify-center rounded-xl border border-transparent px-3 py-2 transition-colors',
          getButtonClass(theme === 'dark'),
        ].join(' ')}
        aria-label="다크 모드로 전환"
        aria-pressed={theme === 'dark'}
      >
        <Moon className="h-4 w-4" />
        <span className="sr-only">다크 모드</span>
      </button>
    </div>
  )
}
