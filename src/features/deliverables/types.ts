export type DeliverablePlatform =
  | 'instagram'
  | 'youtube'
  | 'tiktok'
  | 'facebook'
  | 'twitter'
  | 'other'

export type DeliverableSearchPlatform = 'instagram' | 'youtube'

export interface DeliverableSearchResult {
  key: string
  platform: DeliverableSearchPlatform
  url: string
  title: string
  thumbnail_url: string | null
  published_at: string | null
  channel_name: string | null
  media_type?: string | null
  views: number
  likes: number
  comments: number
  shares: number
  is_registered: boolean
  notice?: string | null
}

export interface ParsedDeliverable {
  platform: DeliverablePlatform
  url: string
  title: string
  thumbnail_url: string | null
  published_at: string | null
  views: number
  likes: number
  comments: number
  shares: number
  parsed_fields: {
    title: boolean
    thumbnail: boolean
    stats: boolean
    published_at: boolean
  }
  notice: string | null
}
