'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { ArrowLeft, Save, Loader2, CheckCircle2, Upload, X } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { uploadSiteAsset } from '@/utils/supabase/storage'

const RichTextEditor = dynamic(() => import('@/components/builder/RichTextEditor'), { ssr: false })

interface SiteSettings {
  site_title?: string
  site_description?: string
  favicon_url?: string
  og_image_url?: string
  footer_text?: string
  max_file_size_mb?: number
  allowed_domains?: string
  privacy_policy?: string
  terms_of_service?: string
  service_agreement?: string
}

interface Props {
  initialSettings: SiteSettings
}

const LEGAL_SECTIONS: Array<{ key: keyof SiteSettings; title: string; desc: string }> = [
  { key: 'privacy_policy', title: '개인정보처리방침', desc: '공개 URL: /privacy' },
  { key: 'terms_of_service', title: '이용약관', desc: '공개 URL: /terms' },
  { key: 'service_agreement', title: '서비스이용동의', desc: '공개 URL: /service' },
]

export default function AdminSettingsForm({ initialSettings }: Props) {
  const router = useRouter()
  const [settings, setSettings] = useState<SiteSettings>({
    site_title: '',
    site_description: '',
    favicon_url: '',
    og_image_url: '',
    footer_text: '',
    max_file_size_mb: 5,
    allowed_domains: '',
    privacy_policy: '',
    terms_of_service: '',
    service_agreement: '',
    ...initialSettings,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [activeTab, setActiveTab] = useState<'general' | 'legal'>('general')
  const [uploadingOg, setUploadingOg] = useState(false)
  const [uploadingFavicon, setUploadingFavicon] = useState(false)
  const ogInputRef = useRef<HTMLInputElement>(null)
  const faviconInputRef = useRef<HTMLInputElement>(null)

  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
  const ALLOWED_FAVICON_TYPES = ['image/x-icon', 'image/png', 'image/svg+xml', 'image/vnd.microsoft.icon']
  const MAX_FILE_SIZE_MB = 5

  async function handleFileUpload(
    file: File,
    type: 'og-image' | 'favicon',
    setUploading: (v: boolean) => void,
    settingKey: 'og_image_url' | 'favicon_url'
  ) {
    const allowed = type === 'favicon'
      ? [...ALLOWED_IMAGE_TYPES, ...ALLOWED_FAVICON_TYPES]
      : ALLOWED_IMAGE_TYPES
    if (!allowed.includes(file.type)) {
      setError(`허용되지 않는 파일 형식입니다. (${file.type})`)
      return
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`파일 크기는 ${MAX_FILE_SIZE_MB}MB 이하여야 합니다.`)
      return
    }
    setUploading(true)
    setError('')
    try {
      const supabase = createClient()
      const url = await uploadSiteAsset(supabase, file, type)
      set(settingKey, url)
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드 실패')
    } finally {
      setUploading(false)
    }
  }

  function set<K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  async function handleSave() {
    setLoading(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const contentType = res.headers.get('content-type') ?? ''
      const json = contentType.includes('application/json') ? await res.json() : null
      if (!res.ok) throw new Error(json?.error ?? `저장 실패 (${res.status})`)
      setSaved(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900'

  return (
    <div>
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/admin/users" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-base font-semibold text-gray-900">글로벌 사이트 설정</h1>
              <p className="text-xs text-gray-400">전체 플랫폼에 적용되는 설정을 관리합니다</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {loading ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl px-6">
          {(['general', 'legal'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={[
                'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-400 hover:text-gray-700',
              ].join(' ')}
            >
              {tab === 'general' ? '일반 설정' : '약관 관리'}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-8 space-y-6">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        {saved && (
          <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            설정이 저장되었습니다.
          </div>
        )}

        {activeTab === 'general' && (
          <>
            {/* SEO / 메타 */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
              <h2 className="text-sm font-semibold text-gray-900">SEO / 메타 정보</h2>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-500">사이트 제목</label>
                <input type="text" value={settings.site_title ?? ''} onChange={(e) => set('site_title', e.target.value)} placeholder="클래시스 폼 생성 템플릿" className={inputClass} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-500">사이트 설명 (meta description)</label>
                <textarea rows={2} value={settings.site_description ?? ''} onChange={(e) => set('site_description', e.target.value)} placeholder="설문을 생성하고 관리하는 플랫폼입니다." className={`${inputClass} resize-none`} />
              </div>
              {/* OG 이미지 */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-500">OG 이미지</label>
                <input
                  ref={ogInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFileUpload(file, 'og-image', setUploadingOg, 'og_image_url')
                    e.target.value = ''
                  }}
                />
                {settings.og_image_url ? (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={settings.og_image_url} alt="OG preview" className="h-16 w-28 rounded-lg border border-gray-200 object-cover" />
                    <div className="flex flex-col gap-1.5">
                      <button type="button" onClick={() => ogInputRef.current?.click()} disabled={uploadingOg}
                        className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                        {uploadingOg ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                        {uploadingOg ? '업로드 중...' : '변경'}
                      </button>
                      <button type="button" onClick={() => set('og_image_url', '')}
                        className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors">
                        <X className="h-3.5 w-3.5" />
                        제거
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => ogInputRef.current?.click()} disabled={uploadingOg}
                    className="flex h-24 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                    {uploadingOg ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                    {uploadingOg ? '업로드 중...' : '이미지 파일 선택 (권장: 1200×630)'}
                  </button>
                )}
              </div>
            </section>

            {/* 파비콘 */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
              <h2 className="text-sm font-semibold text-gray-900">파비콘</h2>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-500">파비콘 (.ico, .png, .svg)</label>
                <input
                  ref={faviconInputRef}
                  type="file"
                  accept=".ico,.png,.svg,image/x-icon,image/png,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFileUpload(file, 'favicon', setUploadingFavicon, 'favicon_url')
                    e.target.value = ''
                  }}
                />
                {settings.favicon_url ? (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={settings.favicon_url} alt="favicon preview" className="h-10 w-10 rounded-lg border border-gray-200 object-contain p-1" />
                    <div className="flex flex-col gap-1.5">
                      <button type="button" onClick={() => faviconInputRef.current?.click()} disabled={uploadingFavicon}
                        className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                        {uploadingFavicon ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                        {uploadingFavicon ? '업로드 중...' : '변경'}
                      </button>
                      <button type="button" onClick={() => set('favicon_url', '')}
                        className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors">
                        <X className="h-3.5 w-3.5" />
                        제거
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => faviconInputRef.current?.click()} disabled={uploadingFavicon}
                    className="flex h-16 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                    {uploadingFavicon ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                    {uploadingFavicon ? '업로드 중...' : '파비콘 파일 선택 (권장: 32×32 PNG)'}
                  </button>
                )}
              </div>
            </section>

            {/* 기타 */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
              <h2 className="text-sm font-semibold text-gray-900">기타</h2>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-500">푸터 문구</label>
                <input type="text" value={settings.footer_text ?? ''} onChange={(e) => set('footer_text', e.target.value)} placeholder="© 2025 CLASSYS. All rights reserved." className={inputClass} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-500">파일 업로드 최대 크기 (MB)</label>
                <input type="number" min={1} max={50} value={settings.max_file_size_mb ?? 5} onChange={(e) => set('max_file_size_mb', Number(e.target.value))} className={inputClass} />
              </div>
            </section>
          </>
        )}

        {activeTab === 'legal' && (
          <div className="space-y-8">
            <p className="text-sm text-gray-500">각 약관은 공개 URL로 접근 가능하며, 회원가입 시 동의 항목으로 표시됩니다.</p>
            {LEGAL_SECTIONS.map(({ key, title, desc }) => (
              <section key={key} className="rounded-2xl border border-gray-200 bg-white p-6 space-y-3">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
                  <p className="mt-0.5 text-xs text-gray-400">{desc}</p>
                </div>
                <RichTextEditor
                  content={(settings[key] ?? '') as string}
                  onChange={(html) => set(key, html)}
                  height="400px"
                />
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
