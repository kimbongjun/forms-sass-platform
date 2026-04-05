import { createClient } from '@supabase/supabase-js'
import { APP_TITLE } from '@/constants/branding'

export interface GlobalSiteSettings {
  logo_url?: string
  site_title?: string
  site_description?: string
  favicon_url?: string
  og_image_url?: string
  primary_color?: string
  footer_text?: string
  privacy_policy?: string
  terms_of_service?: string
  service_agreement?: string
}

export async function getGlobalSiteSettings(): Promise<GlobalSiteSettings> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!url || !anonKey) return {}

    const supabase = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data } = await supabase
      .from('site_settings')
      .select('settings')
      .eq('id', 1)
      .single()

    return (data?.settings as GlobalSiteSettings | null) ?? {}
  } catch {
    return {}
  }
}

export function getResolvedSiteTitle(settings: GlobalSiteSettings) {
  return settings.site_title?.trim() || APP_TITLE
}

export function getResolvedSiteDescription(settings: GlobalSiteSettings) {
  return settings.site_description?.trim() || APP_TITLE
}

export function getResolvedLogoUrl(settings: GlobalSiteSettings) {
  return settings.logo_url?.trim() || null
}

export function getResolvedDarkLogoUrl(settings: GlobalSiteSettings) {
  const logoUrl = getResolvedLogoUrl(settings)
  if (!logoUrl) return null

  return `/api/site-logo?mode=dark&url=${encodeURIComponent(logoUrl)}`
}

export function getResolvedPrimaryColor(settings: GlobalSiteSettings) {
  return settings.primary_color?.trim() || '#111827'
}

function normalizeHex(hex: string) {
  const trimmed = hex.trim()
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) {
    return '#111827'
  }

  if (trimmed.length === 4) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`
  }

  return trimmed
}

function hexToRgb(hex: string) {
  const normalized = normalizeHex(hex)
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  }
}

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((value) => clampChannel(value).toString(16).padStart(2, '0')).join('')}`
}

function mixWith(hex: string, target: { r: number; g: number; b: number }, ratio: number) {
  const source = hexToRgb(hex)
  return rgbToHex(
    source.r + (target.r - source.r) * ratio,
    source.g + (target.g - source.g) * ratio,
    source.b + (target.b - source.b) * ratio
  )
}

function channelToLinear(channel: number) {
  const normalized = channel / 255
  return normalized <= 0.04045
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4)
}

function getLuminance(hex: string) {
  const { r, g, b } = hexToRgb(hex)
  return (
    0.2126 * channelToLinear(r) +
    0.7152 * channelToLinear(g) +
    0.0722 * channelToLinear(b)
  )
}

function getReadableTextColor(hex: string) {
  return getLuminance(hex) > 0.42 ? '#0f172a' : '#f8fafc'
}

function ensureMinimumLuminance(hex: string, minimum: number) {
  let candidate = normalizeHex(hex)
  let attempts = 0

  while (getLuminance(candidate) < minimum && attempts < 10) {
    candidate = mixWith(candidate, { r: 255, g: 255, b: 255 }, 0.14)
    attempts += 1
  }

  return candidate
}

export function getResolvedPrimaryPalette(settings: GlobalSiteSettings) {
  const primary = getResolvedPrimaryColor(settings)
  const darkPrimary = ensureMinimumLuminance(primary, 0.42)

  return {
    primary,
    primaryHover: mixWith(primary, { r: 0, g: 0, b: 0 }, 0.14),
    primaryActive: mixWith(primary, { r: 0, g: 0, b: 0 }, 0.22),
    primarySoft: mixWith(primary, { r: 255, g: 255, b: 255 }, 0.9),
    primarySoftBorder: mixWith(primary, { r: 255, g: 255, b: 255 }, 0.72),
    primaryRing: mixWith(primary, { r: 255, g: 255, b: 255 }, 0.5),
    primaryContrast: getReadableTextColor(primary),
    darkPrimary,
    darkPrimaryHover: mixWith(darkPrimary, { r: 255, g: 255, b: 255 }, 0.08),
    darkPrimaryActive: mixWith(darkPrimary, { r: 0, g: 0, b: 0 }, 0.12),
    darkPrimarySoft: mixWith(darkPrimary, { r: 15, g: 23, b: 42 }, 0.82),
    darkPrimarySoftBorder: mixWith(darkPrimary, { r: 15, g: 23, b: 42 }, 0.6),
    darkPrimaryRing: mixWith(darkPrimary, { r: 255, g: 255, b: 255 }, 0.32),
    darkPrimaryContrast: getReadableTextColor(darkPrimary),
  }
}

export function getResolvedFavicon(settings: GlobalSiteSettings) {
  const faviconUrl = settings.favicon_url?.trim()
  if (!faviconUrl) return null

  const lowerUrl = faviconUrl.toLowerCase()
  const type = lowerUrl.endsWith('.svg')
    ? 'image/svg+xml'
    : lowerUrl.endsWith('.png')
      ? 'image/png'
      : lowerUrl.endsWith('.ico')
        ? 'image/x-icon'
        : undefined

  return {
    url: faviconUrl,
    type,
    sizes: type === 'image/svg+xml' ? 'any' : undefined,
  }
}
