import { NextRequest, NextResponse } from 'next/server'

function isAllowedLogoUrl(url: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  if (!supabaseUrl) return false

  return url.startsWith(`${supabaseUrl}/storage/v1/object/public/banners/site-assets/`)
}

function transformSvgForDarkMode(svg: string) {
  const fillPattern = /fill="(?!none|currentColor|url\()[^"]*"/gi
  const strokePattern = /stroke="(?!none|currentColor|url\()[^"]*"/gi
  const fillStylePattern = /fill\s*:\s*(?!none|currentColor|url\()[^;"']+/gi
  const strokeStylePattern = /stroke\s*:\s*(?!none|currentColor|url\()[^;"']+/gi

  let transformed = svg
    .replace(fillPattern, 'fill="#ffffff"')
    .replace(strokePattern, 'stroke="#ffffff"')
    .replace(fillStylePattern, 'fill:#ffffff')
    .replace(strokeStylePattern, 'stroke:#ffffff')

  if (!/fill="/i.test(transformed)) {
    transformed = transformed.replace('<svg', '<svg fill="#ffffff"')
  }

  if (!/color="/i.test(transformed)) {
    transformed = transformed.replace('<svg', '<svg color="#ffffff"')
  }

  return transformed
}

export async function GET(req: NextRequest) {
  const requestedUrl = req.nextUrl.searchParams.get('url')?.trim()
  const mode = req.nextUrl.searchParams.get('mode')

  if (!requestedUrl) {
    return NextResponse.json({ error: 'url 파라미터가 필요합니다.' }, { status: 400 })
  }

  if (!isAllowedLogoUrl(requestedUrl)) {
    return NextResponse.json({ error: '허용되지 않은 로고 URL입니다.' }, { status: 400 })
  }

  try {
    const response = await fetch(requestedUrl, {
      headers: { Accept: 'image/svg+xml,text/plain;q=0.9,*/*;q=0.8' },
      next: { revalidate: 3600 },
    })

    if (!response.ok) {
      throw new Error(`로고를 불러오지 못했습니다. (${response.status})`)
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('image/svg+xml') && !requestedUrl.toLowerCase().endsWith('.svg')) {
      return NextResponse.json({ error: 'SVG 로고만 지원합니다.' }, { status: 400 })
    }

    const source = await response.text()
    const output = mode === 'dark' ? transformSvgForDarkMode(source) : source

    return new NextResponse(output, {
      headers: {
        'content-type': 'image/svg+xml; charset=utf-8',
        'cache-control': 'public, max-age=3600, s-maxage=3600',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '로고 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
