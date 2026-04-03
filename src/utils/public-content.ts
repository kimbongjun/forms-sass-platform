import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/utils/supabase/public'

const PUBLIC_CONTENT_REVALIDATE_SECONDS = 300
const PUBLIC_PROJECT_REVALIDATE_SECONDS = 60

const getCachedPublishedAnnouncements = unstable_cache(
  async () => {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('announcements')
      .select('id, title, created_at, is_pinned')
      .eq('is_published', true)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error
    return data ?? []
  },
  ['public-announcements-list'],
  { revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS, tags: ['announcements'] }
)

const getCachedPublishedAnnouncementById = unstable_cache(
  async (id: string) => {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('id', id)
      .eq('is_published', true)
      .single()

    if (error) return null
    return data
  },
  ['public-announcements-detail'],
  { revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS, tags: ['announcements'] }
)

const getCachedReleaseNotes = unstable_cache(
  async () => {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('release_notes')
      .select('id, version, title, created_at')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data ?? []
  },
  ['public-release-notes-list'],
  { revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS, tags: ['release-notes'] }
)

const getCachedReleaseNoteById = unstable_cache(
  async (id: string) => {
    const supabase = createPublicClient()
    const { data, error } = await supabase.from('release_notes').select('*').eq('id', id).single()
    if (error) return null
    return data
  },
  ['public-release-notes-detail'],
  { revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS, tags: ['release-notes'] }
)

export async function getPublishedAnnouncements() {
  return getCachedPublishedAnnouncements()
}

export async function getPublishedAnnouncementById(id: string) {
  return getCachedPublishedAnnouncementById(id)
}

export async function getReleaseNotes() {
  return getCachedReleaseNotes()
}

export async function getReleaseNoteById(id: string) {
  return getCachedReleaseNoteById(id)
}

/**
 * slug별 고유 캐시 키를 사용해 다른 프로젝트 데이터가 반환되는 문제 방지
 */
export async function getPublicProjectBySlug(slug: string) {
  return unstable_cache(
    async () => {
      const supabase = createPublicClient()
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('slug', slug)
        .single()

      if (error) return null
      return data
    },
    [`public-project-slug-${slug}`],
    { revalidate: PUBLIC_PROJECT_REVALIDATE_SECONDS, tags: ['projects-public'] }
  )()
}

/**
 * projectId별 고유 캐시 키를 사용해 다른 프로젝트 필드가 반환되는 문제 방지
 */
export async function getPublicFormFields(projectId: string) {
  return unstable_cache(
    async () => {
      const supabase = createPublicClient()
      const { data, error } = await supabase
        .from('form_fields')
        .select('*')
        .eq('project_id', projectId)
        .order('order_index', { ascending: true })

      if (error) return []
      return data ?? []
    },
    [`public-project-fields-${projectId}`],
    { revalidate: PUBLIC_PROJECT_REVALIDATE_SECONDS, tags: ['projects-public'] }
  )()
}
