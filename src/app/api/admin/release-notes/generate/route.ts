import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { createServerClient, getUserRole } from '@/utils/supabase/server'

/**
 * git log를 파싱해 release_notes 테이블에 자동 저장.
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

    // NUL(\x00)을 구분자로 사용 — 커밋 메시지에 등장 불가
    const SEP = '\x00'
    const FMT = `%H${SEP}%s${SEP}%ae${SEP}%ad`

    // git log 범위 결정: 마지막 릴리즈 이후 or 최근 30커밋
    let logCommand = `git log --pretty=format:"${FMT}" --date=iso -30`
    if (lastNote?.created_at) {
      const since = new Date(lastNote.created_at).toISOString()
      logCommand = `git log --pretty=format:"${FMT}" --date=iso --after="${since}"`
    }

    let rawLog = ''
    let gitError: string | null = null
    try {
      rawLog = execSync(logCommand, { encoding: 'utf8', cwd: process.cwd() }).trim()
    } catch (e) {
      gitError = e instanceof Error ? e.message : String(e)
    }

    if (gitError !== null) {
      return NextResponse.json(
        { error: `git 실행 실패: ${gitError}` },
        { status: 500 }
      )
    }

    if (!rawLog) {
      return NextResponse.json({ error: '마지막 릴리즈 이후 새 커밋이 없습니다.' }, { status: 422 })
    }

    const commits = rawLog.split('\n').map((line) => {
      const parts = line.split(SEP)
      return {
        hash: parts[0]?.trim(),
        subject: parts[1]?.trim(),
        author: parts[2]?.trim(),
        date: parts[3]?.trim(),
      }
    }).filter((c) => c.hash && c.subject)

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
    // 첫 릴리즈: 날짜 기반 버전
    const now = new Date()
    return `v${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`
  }

  // semver (v1.2.3) 감지
  const semver = lastVersion.match(/^v?(\d+)\.(\d+)\.(\d+)$/)
  if (semver) {
    const patch = parseInt(semver[3], 10) + 1
    return `v${semver[1]}.${semver[2]}.${patch}`
  }

  // 날짜 기반 버전 (v2026.04.02) — 오늘 날짜로 갱신
  const dateVer = lastVersion.match(/^v?(\d{4})\.(\d{2})\.(\d{2})/)
  if (dateVer) {
    const now = new Date()
    const newDate = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`
    return lastVersion === `v${newDate}` ? `v${newDate}-2` : `v${newDate}`
  }

  // 알 수 없는 형식: 숫자 suffix 증가
  const suffix = lastVersion.match(/(\d+)$/)
  if (suffix) {
    return lastVersion.replace(/\d+$/, String(parseInt(suffix[1], 10) + 1))
  }

  return `${lastVersion}-next`
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
