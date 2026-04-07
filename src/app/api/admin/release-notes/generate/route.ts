import { NextResponse } from 'next/server'
import { createServerClient, getUserRole } from '@/utils/supabase/server'

interface GitHubCommit {
  sha: string
  commit: {
    message: string
    author: {
      name: string
      email: string
      date: string
    }
  }
}

/**
 * GitHub Commits API를 조회해 release_notes 테이블에 자동 저장.
 * POST /api/admin/release-notes/generate
 */
export async function POST() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

    const role = await getUserRole(user.id)
    if (role !== 'administrator') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 })
    }

    // 마지막 릴리즈 노트 조회
    const { data: lastNote } = await supabase
      .from('release_notes')
      .select('version, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    let commits: Array<{ hash: string; subject: string; author: string; date: string }> = []
    try {
      commits = await fetchGitHubCommits(lastNote?.created_at ?? null)
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'GitHub 커밋 조회에 실패했습니다.' },
        { status: 500 }
      )
    }

    if (commits.length === 0) {
      return NextResponse.json({ error: '마지막 릴리즈 이후 새 커밋이 없습니다.' }, { status: 422 })
    }

    // 버전 자동 결정: 마지막 버전에서 patch 증가 또는 날짜 기반
    const nextVersion = deriveNextVersion(lastNote?.version ?? null)

    // 커밋을 카테고리별로 분류
    const categories: Record<string, string[]> = {
      '✨ 새로운 기능': [],
      '🐛 버그 수정': [],
      '🔧 개선 사항': [],
      '📦 기타 변경': [],
    }

    for (const c of commits) {
      const s = c.subject.toLowerCase()
      if (s.startsWith('feat') || s.includes('신규') || s.includes('추가')) {
        categories['✨ 새로운 기능'].push(c.subject)
      } else if (s.startsWith('fix') || s.includes('수정') || s.includes('오류') || s.includes('버그')) {
        categories['🐛 버그 수정'].push(c.subject)
      } else if (s.startsWith('refactor') || s.startsWith('perf') || s.startsWith('improve') || s.includes('개선')) {
        categories['🔧 개선 사항'].push(c.subject)
      } else {
        // merge / chore / docs / 일반 메시지 — 의미있는 것만
        if (!s.startsWith('chore') && !s.startsWith('merge') && s.length > 3) {
          categories['📦 기타 변경'].push(c.subject)
        }
      }
    }

    // HTML 콘텐츠 생성
    let html = ''
    for (const [category, items] of Object.entries(categories)) {
      if (items.length === 0) continue
      html += `<h3>${category}</h3><ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`
    }

    if (!html) {
      html = '<p>변경 사항이 없습니다.</p>'
    }

    // 제목 자동 생성: 가장 큰 카테고리 기준
    const dominantCategory = Object.entries(categories)
      .filter(([, v]) => v.length > 0)
      .sort((a, b) => b[1].length - a[1].length)[0]

    const autoTitle = dominantCategory
      ? `${dominantCategory[0].replace(/[^\w\s가-힣]/g, '').trim()} (${commits.length}건 반영)`
      : `업데이트 ${nextVersion}`

    // DB에 저장
    const { data: inserted, error: insertErr } = await supabase
      .from('release_notes')
      .insert({ version: nextVersion, title: autoTitle, content: html })
      .select('id')
      .single()

    if (insertErr) {
      return NextResponse.json({ error: `저장 실패: ${insertErr.message}` }, { status: 500 })
    }

    return NextResponse.json({ id: inserted.id, version: nextVersion, commitCount: commits.length })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '서버 오류' },
      { status: 500 }
    )
  }
}

function deriveNextVersion(lastVersion: string | null): string {
  if (!lastVersion) {
    // 첫 릴리즈: v1.0.0 semver 시작
    return 'v1.0.0'
  }

  // semver (v1.2.3) 감지 → patch 증가
  const semver = lastVersion.match(/^v?(\d+)\.(\d+)\.(\d+)$/)
  if (semver) {
    const patch = parseInt(semver[3], 10) + 1
    return `v${semver[1]}.${semver[2]}.${patch}`
  }

  // v1.2 형식 → patch 추가 (v1.2.1)
  const shortver = lastVersion.match(/^v?(\d+)\.(\d+)$/)
  if (shortver) {
    return `v${shortver[1]}.${shortver[2]}.1`
  }

  // 알 수 없는 형식: 숫자 suffix 증가
  const suffix = lastVersion.match(/(\d+)$/)
  if (suffix) {
    return lastVersion.replace(/\d+$/, String(parseInt(suffix[1], 10) + 1))
  }

  return `${lastVersion}-1`
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function fetchGitHubCommits(lastReleaseAt: string | null) {
  const provider = process.env.VERCEL_GIT_PROVIDER
  if (provider && provider !== 'github') {
    throw new Error(`현재 Git Provider(${provider})는 자동 릴리즈노트 생성 대상이 아닙니다. GitHub 저장소에서만 지원됩니다.`)
  }

  const owner = process.env.GITHUB_REPO_OWNER || process.env.VERCEL_GIT_REPO_OWNER
  const repo = process.env.GITHUB_REPO_SLUG || process.env.VERCEL_GIT_REPO_SLUG
  const token = process.env.GITHUB_TOKEN

  if (!owner || !repo) {
    throw new Error('저장소 정보를 찾을 수 없습니다. Vercel System Environment Variables를 노출하거나 GITHUB_REPO_OWNER / GITHUB_REPO_SLUG를 설정해주세요.')
  }

  if (!token) {
    throw new Error('GITHUB_TOKEN 환경변수가 필요합니다. Vercel 프로젝트 환경변수에 GitHub 토큰을 추가해주세요.')
  }

  const params = new URLSearchParams({
    per_page: '100',
  })

  if (lastReleaseAt) {
    params.set('since', new Date(lastReleaseAt).toISOString())
  }

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?${params.toString()}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': `${repo}-release-notes-generator`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`GitHub API 요청 실패 (${response.status}): ${errorBody || response.statusText}`)
  }

  const data = await response.json() as GitHubCommit[]

  return data
    .map((commit) => ({
      hash: commit.sha,
      subject: commit.commit.message.split('\n')[0]?.trim() ?? '',
      author: commit.commit.author?.email?.trim() || commit.commit.author?.name?.trim() || 'unknown',
      date: commit.commit.author?.date?.trim() || '',
    }))
    .filter((commit) => commit.hash && commit.subject)
}
