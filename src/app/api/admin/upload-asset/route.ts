import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getUserRole } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

const ALLOWED_TYPES: Record<string, string[]> = {
  logo: ['image/svg+xml'],
  favicon: ['image/x-icon', 'image/png', 'image/svg+xml', 'image/vnd.microsoft.icon'],
  'og-image': ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
}

const MAX_SIZE_MB = 5

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const role = await getUserRole(user.id)
  if (role !== 'administrator') {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const type = formData.get('type') as string | null

  if (!file || !type) {
    return NextResponse.json({ error: 'file과 type이 필요합니다.' }, { status: 400 })
  }

  const allowed = ALLOWED_TYPES[type]
  if (!allowed) {
    return NextResponse.json({ error: '유효하지 않은 type입니다.' }, { status: 400 })
  }

  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: `허용되지 않는 파일 형식입니다. (${file.type})` }, { status: 400 })
  }

  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return NextResponse.json({ error: `파일 크기는 ${MAX_SIZE_MB}MB 이하여야 합니다.` }, { status: 400 })
  }

  const ext = file.name.split('.').pop() ?? (type === 'logo' ? 'svg' : 'png')
  const path = `site-assets/${type}-${crypto.randomUUID()}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const admin = createAdminClient()

  const { error } = await admin.storage
    .from('banners')
    .upload(path, arrayBuffer, { contentType: file.type, cacheControl: '3600', upsert: false })

  if (error) {
    console.error('[upload-asset] Storage 업로드 실패:', error)
    return NextResponse.json({ error: `업로드 실패: ${error.message}` }, { status: 500 })
  }

  const { data } = admin.storage.from('banners').getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl })
}
