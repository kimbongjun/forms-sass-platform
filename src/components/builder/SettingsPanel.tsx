'use client'

import { useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Copy, Upload, X, Globe, ChevronDown } from 'lucide-react'
import { Loader2 } from 'lucide-react'
import { PRESET_COLORS, TEMPLATE_VARS, INPUT_CLASS } from '@/constants/builder'
import { ALL_LOCALES, LOCALE_LABELS, DEFAULT_LOCALE_STRINGS } from '@/constants/locale'
import type { Locale, LocaleStrings } from '@/constants/locale'
import type { LocaleSettings } from '@/types/database'
import { createClient } from '@/utils/supabase/client'
import { uploadThumbnail } from '@/utils/supabase/storage'
import type { useFormSettings } from '@/hooks/useFormSettings'

const RichTextEditor = dynamic(() => import('./RichTextEditor'), { ssr: false })

type Settings = ReturnType<typeof useFormSettings>

interface SettingsPanelProps {
  settings: Settings
  /** Edit mode: read-only slug with copy button */
  slug?: string
}

const OVERRIDE_KEYS: Array<{ key: keyof LocaleStrings; label: string; placeholder: (locale: Locale) => string }> = [
  { key: 'submit', label: '제출 버튼', placeholder: (l) => DEFAULT_LOCALE_STRINGS[l].submit },
  { key: 'submitting', label: '제출 중 텍스트', placeholder: (l) => DEFAULT_LOCALE_STRINGS[l].submitting },
  { key: 'submitted_title', label: '완료 제목', placeholder: (l) => DEFAULT_LOCALE_STRINGS[l].submitted_title },
  { key: 'submitted_subtitle', label: '완료 부제목', placeholder: (l) => DEFAULT_LOCALE_STRINGS[l].submitted_subtitle },
  { key: 'required_error', label: '필수 오류 메시지 ({{label}} 사용 가능)', placeholder: (l) => DEFAULT_LOCALE_STRINGS[l].required_error },
  { key: 'select_placeholder', label: '드롭다운 안내 문구', placeholder: (l) => DEFAULT_LOCALE_STRINGS[l].select_placeholder },
  { key: 'agree_label', label: '체크박스 동의 텍스트', placeholder: (l) => DEFAULT_LOCALE_STRINGS[l].agree_label },
]

export default function SettingsPanel({ settings, slug }: SettingsPanelProps) {
  const [slugCopied, setSlugCopied] = useState(false)
  const [thumbnailLoading, setThumbnailLoading] = useState(false)
  const [expandedLocale, setExpandedLocale] = useState<Locale | null>(null)
  const thumbnailRef = useRef<HTMLInputElement>(null)

  function copySlug() {
    if (!slug) return
    navigator.clipboard.writeText(slug)
    setSlugCopied(true)
    setTimeout(() => setSlugCopied(false), 1500)
  }

  async function handleThumbnailFile(file: File) {
    setThumbnailLoading(true)
    try {
      const supabase = createClient()
      const url = await uploadThumbnail(supabase, file)
      settings.setThumbnailUrl(url)
    } catch (err) {
      console.error('[SettingsPanel] 썸네일 업로드 실패:', err)
    } finally {
      setThumbnailLoading(false)
    }
  }

  function toggleAvailableLocale(locale: Locale) {
    const ls = settings.localeSettings
    const next = ls.available_locales.includes(locale)
      ? ls.available_locales.filter((l) => l !== locale)
      : [...ls.available_locales, locale]
    if (next.length === 0) return
    settings.setLocaleSettings({
      ...ls,
      available_locales: next,
      default_locale: next.includes(ls.default_locale) ? ls.default_locale : next[0],
    })
  }

  function setDefaultLocale(locale: Locale) {
    settings.setLocaleSettings({ ...settings.localeSettings, default_locale: locale })
  }

  function updateOverride(locale: Locale, key: keyof LocaleStrings, value: string) {
    const ls = settings.localeSettings
    settings.setLocaleSettings({
      ...ls,
      overrides: {
        ...ls.overrides,
        [locale]: { ...(ls.overrides[locale] ?? {}), [key]: value },
      },
    })
  }

  const ls: LocaleSettings = settings.localeSettings

  return (
    <main className="flex-1 overflow-y-auto px-8 py-6">
      <div className="mx-auto w-full max-w-7xl">
        <div className="grid grid-cols-2 gap-8 items-start">

          {/* ── 왼쪽 컬럼 ── */}
          <div className="space-y-6">

            {/* 테마 컬러 */}
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-semibold text-gray-900">테마 컬러</h2>
              <div className="grid grid-cols-8 gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => settings.setThemeColor(color)}
                    style={{ backgroundColor: color }}
                    className={`h-8 w-full rounded-lg transition-all ${
                      settings.themeColor === color ? 'ring-2 ring-offset-2 ring-gray-400' : ''
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-400">직접 선택</label>
                <input
                  type="color"
                  value={settings.themeColor}
                  onChange={(e) => settings.setThemeColor(e.target.value)}
                  className="h-9 w-24 cursor-pointer rounded-lg border border-gray-200"
                />
                <span className="text-xs text-gray-500">{settings.themeColor}</span>
              </div>
            </section>

            {/* 폼 썸네일 */}
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-semibold text-gray-900">폼 썸네일</h2>
              {settings.thumbnailUrl ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={settings.thumbnailUrl}
                    alt="썸네일 미리보기"
                    className="w-full max-h-40 rounded-xl object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => settings.setThumbnailUrl('')}
                    className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white transition-colors hover:bg-black/70"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => thumbnailRef.current?.click()}
                  disabled={thumbnailLoading}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-8 text-gray-400 transition-colors hover:border-gray-300 hover:text-gray-600 disabled:opacity-50"
                >
                  {thumbnailLoading
                    ? <Loader2 className="h-6 w-6 animate-spin" />
                    : <Upload className="h-6 w-6" />}
                  <span className="text-xs">{thumbnailLoading ? '업로드 중...' : '이미지 업로드'}</span>
                </button>
              )}
              <input
                ref={thumbnailRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleThumbnailFile(f) }}
              />
              <p className="text-xs text-gray-400">대시보드 목록에 표시될 폼의 대표 이미지입니다.</p>
            </section>

            {/* 운영 설정 */}
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-semibold text-gray-900">운영 설정</h2>

              {/* Slug */}
              {slug ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    슬러그 (URL — 변경 불가)
                  </p>
                  <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                    <span className="flex-1 text-sm text-gray-500">{slug}</span>
                    <button
                      type="button"
                      onClick={copySlug}
                      className="flex shrink-0 items-center gap-1 text-xs text-gray-400 transition-colors hover:text-gray-700"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {slugCopied ? '복사됨!' : '복사'}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">공개된 폼 URL이 변경되므로 수정할 수 없습니다.</p>
                </div>
              ) : (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">슬러그 (URL)</p>
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-xs text-gray-400">your-domain.com/</span>
                    <input
                      type="text"
                      value={settings.customSlug}
                      onChange={(e) => settings.setCustomSlug(e.target.value.replace(/[^a-z0-9-]/g, ''))}
                      placeholder="비워두면 자동 생성"
                      className={INPUT_CLASS}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-400">영문 소문자, 숫자, 하이픈(-)만 사용 가능합니다.</p>
                </div>
              )}

              {/* 공개 설정 */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">공개 설정</p>
                <label className="flex cursor-pointer items-center gap-3">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={settings.isPublished}
                      onChange={(e) => settings.setIsPublished(e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`h-5 w-9 rounded-full transition-colors ${settings.isPublished ? 'bg-gray-900' : 'bg-gray-300'}`} />
                    <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${settings.isPublished ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-sm font-medium text-gray-700">
                    {settings.isPublished ? '공개' : '비공개'}
                  </span>
                </label>
              </div>

              {/* 응답 알림 이메일 */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">응답 알림 이메일</p>
                <input
                  type="email"
                  value={settings.notificationEmail}
                  onChange={(e) => settings.setNotificationEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className={INPUT_CLASS}
                />
                <p className="mt-1.5 text-xs text-gray-400">
                  입력 시 폼 제출마다 해당 이메일로 응답 내용이 발송됩니다.
                </p>
              </div>

              {/* 제출 마감일 + 최대 응답 수 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">제출 마감일</p>
                  <input
                    type="datetime-local"
                    value={settings.deadline}
                    onChange={(e) => settings.setDeadline(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">최대 응답 수</p>
                  <input
                    type="number"
                    min="1"
                    value={settings.maxSubmissions}
                    onChange={(e) => settings.setMaxSubmissions(e.target.value)}
                    placeholder="제한 없음"
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              {/* 웹훅 URL */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">웹훅 URL</p>
                <input
                  type="url"
                  value={settings.webhookUrl}
                  onChange={(e) => settings.setWebhookUrl(e.target.value)}
                  placeholder="https://your-server.com/webhook"
                  className={INPUT_CLASS}
                />
                <p className="mt-1 text-xs text-gray-400">제출 시 해당 URL로 응답 데이터가 POST 됩니다.</p>
              </div>

              {/* 제출 완료 메시지 */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">제출 완료 메시지</p>
                <textarea
                  value={settings.submissionMessage}
                  onChange={(e) => settings.setSubmissionMessage(e.target.value)}
                  placeholder="제출이 완료되었습니다! 응답해주셔서 감사합니다."
                  rows={2}
                  className={`${INPUT_CLASS} resize-none`}
                />
                <p className="mt-1 text-xs text-gray-400">비워두면 기본 메시지가 표시됩니다.</p>
              </div>
            </section>
          </div>

          {/* ── 오른쪽 컬럼 ── */}
          <div className="space-y-6">

            {/* 이메일 템플릿 */}
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">이메일 템플릿</h2>
                <p className="mt-1 text-xs text-gray-400">폼 제출 시 발송되는 이메일 내용을 커스터마이징합니다.</p>
              </div>

              {/* 템플릿 변수 힌트 */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="mb-2 text-xs font-semibold text-gray-500">사용 가능한 변수</p>
                <div className="flex flex-wrap gap-2">
                  {TEMPLATE_VARS.map(({ var: v, desc }) => (
                    <span key={v} className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs">
                      <code className="font-mono text-blue-600">{v}</code>
                      <span className="text-gray-400">{desc}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* 관리자 이메일 템플릿 */}
              <div className="space-y-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">관리자 수신 템플릿</p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    응답 알림 이메일 주소로 발송됩니다. 비워두면 기본 템플릿을 사용합니다.
                  </p>
                </div>
                <RichTextEditor
                  content={settings.adminEmailTemplate}
                  onChange={settings.setAdminEmailTemplate}
                  placeholder="관리자에게 발송할 이메일 내용을 작성하세요..."
                />
              </div>

              {/* 응답자 이메일 템플릿 */}
              <div className="space-y-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">응답자 수신 템플릿</p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    폼에 이메일 필드가 있고 응답자가 입력한 경우 자동 발송됩니다. 비워두면 발송하지 않습니다.
                  </p>
                </div>
                <RichTextEditor
                  content={settings.userEmailTemplate}
                  onChange={settings.setUserEmailTemplate}
                  placeholder="응답자에게 발송할 이메일 내용을 작성하세요..."
                />
              </div>
            </section>

            {/* 다국어 설정 */}
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Globe className="h-4 w-4 text-gray-500" />
                    다국어 설정
                  </h2>
                  <p className="mt-1 text-xs text-gray-400">공개 폼의 UI 문구를 다국어로 제공합니다.</p>
                </div>
                <label className="flex cursor-pointer items-center gap-2">
                  <span className="text-xs text-gray-500">{ls.enabled ? '활성' : '비활성'}</span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={ls.enabled}
                      onChange={(e) =>
                        settings.setLocaleSettings({ ...ls, enabled: e.target.checked })
                      }
                      className="sr-only"
                    />
                    <div className={`h-5 w-9 rounded-full transition-colors ${ls.enabled ? 'bg-gray-900' : 'bg-gray-300'}`} />
                    <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${ls.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                </label>
              </div>

              {ls.enabled && (
                <>
                  {/* 지원 언어 선택 */}
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">지원 언어</p>
                    <div className="flex flex-wrap gap-2">
                      {ALL_LOCALES.map((locale) => {
                        const active = ls.available_locales.includes(locale)
                        return (
                          <button
                            key={locale}
                            type="button"
                            onClick={() => toggleAvailableLocale(locale)}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                              active
                                ? 'border-gray-900 bg-gray-900 text-white'
                                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
                            }`}
                          >
                            {LOCALE_LABELS[locale]}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* 기본 언어 */}
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">기본 언어</p>
                    <select
                      value={ls.default_locale}
                      onChange={(e) => setDefaultLocale(e.target.value as Locale)}
                      className={INPUT_CLASS}
                    >
                      {ls.available_locales.map((locale) => (
                        <option key={locale} value={locale}>{LOCALE_LABELS[locale]}</option>
                      ))}
                    </select>
                  </div>

                  {/* 언어별 텍스트 커스터마이징 */}
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                      텍스트 커스터마이징 (선택 사항)
                    </p>
                    <div className="space-y-2">
                      {ls.available_locales.map((locale) => (
                        <div key={locale} className="rounded-xl border border-gray-200 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setExpandedLocale(expandedLocale === locale ? null : locale)}
                            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <span>{LOCALE_LABELS[locale]}</span>
                            <ChevronDown
                              className={`h-4 w-4 text-gray-400 transition-transform ${
                                expandedLocale === locale ? 'rotate-180' : ''
                              }`}
                            />
                          </button>
                          {expandedLocale === locale && (
                            <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
                              {OVERRIDE_KEYS.map(({ key, label, placeholder }) => (
                                <div key={key}>
                                  <label className="mb-1 block text-xs font-medium text-gray-500">{label}</label>
                                  <input
                                    type="text"
                                    value={ls.overrides?.[locale]?.[key] ?? ''}
                                    onChange={(e) => updateOverride(locale, key, e.target.value)}
                                    placeholder={placeholder(locale)}
                                    className={INPUT_CLASS}
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}
