import { createClient } from '@supabase/supabase-js'

/**
 * Supabase Admin 클라이언트 (service role key 사용).
 * 서버 사이드 전용 — 절대 클라이언트에 노출하지 않을 것.
 * 사용처: 사용자 목록 조회, 비밀번호 초기화 등 Admin API 호출
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.')
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
