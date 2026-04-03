import { cache } from 'react'
import { APP_TITLE } from '@/constants/branding'
import { createServerClient } from '@/utils/supabase/server'

export interface GlobalSiteSettings {
  site_title?: string
  site_description?: string
  favicon_url?: string
  og_image_url?: string
  primary_color?: string
}

export const getGlobalSiteSettings = cache(async (): Promise<GlobalSiteSettings> => {
  try {
    const supabase = await createServerClient()
    const { data } = await supabase
      .from('site_settings')
      .select('settings')
      .eq('id', 1)
      .single()

    return (data?.settings as GlobalSiteSettings | null) ?? {}
  } catch {
    return {}
  }
})

export function getResolvedSiteTitle(settings: GlobalSiteSettings) {
  return settings.site_title?.trim() || APP_TITLE
}

export function getResolvedSiteDescription(settings: GlobalSiteSettings) {
  return settings.site_description?.trim() || APP_TITLE
}

export function getResolvedPrimaryColor(settings: GlobalSiteSettings) {
  return settings.primary_color?.trim() || '#111827'
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
