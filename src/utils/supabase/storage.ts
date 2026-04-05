// Bucket: banners
//   project-banners/{uuid}.{ext}  — 프로젝트 배너
//   field-images/{uuid}.{ext}     — 필드 이미지
//   thumbnails/{uuid}.{ext}       — 폼 썸네일

import type { SupabaseClient } from '@supabase/supabase-js'

async function uploadToStorage(supabase: SupabaseClient, path: string, file: File, label: string): Promise<string> {
  const { error } = await supabase.storage
    .from('banners')
    .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })

  if (error) {
    console.error(`[storage] ${label} 업로드 실패:`, error)
    throw new Error(`${label} 업로드 실패: ${error.message}`)
  }

  const { data } = supabase.storage.from('banners').getPublicUrl(path)
  return data.publicUrl
}

export async function uploadBanner(supabase: SupabaseClient, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  return uploadToStorage(supabase, `project-banners/${crypto.randomUUID()}.${ext}`, file, '배너')
}

export async function uploadFieldImage(supabase: SupabaseClient, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  return uploadToStorage(supabase, `field-images/${crypto.randomUUID()}.${ext}`, file, '이미지')
}

export async function uploadThumbnail(supabase: SupabaseClient, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  return uploadToStorage(supabase, `thumbnails/${crypto.randomUUID()}.${ext}`, file, '썸네일')
}

export async function uploadSiteAsset(
  supabase: SupabaseClient,
  file: File,
  type: 'og-image' | 'favicon' | 'logo'
): Promise<string> {
  const ext = file.name.split('.').pop() ?? (type === 'logo' ? 'svg' : 'png')
  const label = type === 'og-image' ? 'OG 이미지' : type === 'favicon' ? '파비콘' : '로고'
  return uploadToStorage(supabase, `site-assets/${type}-${crypto.randomUUID()}.${ext}`, file, label)
}
