import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServerClient } from '@/utils/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

const URGENCY_LABELS: Record<string, string> = {
  critical: '긴급',
  high: '높음',
  normal: '보통',
  low: '낮음',
}

const TYPE_LABELS: Record<string, string> = {
  bug: '결함(Bug)',
  suggestion: '건의사항',
  question: '질문',
}

async function sendIssueNotification(
  projectId: string,
  issue: { title: string; description: string; type: string; urgency: string; status: string },
  eventType: 'created' | 'updated'
) {
  const resendKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL
  if (!resendKey || !fromEmail) return

  try {
    const supabase = await createServerClient()
    const [{ data: project }, { data: members }] = await Promise.all([
      supabase.from('projects').select('title').eq('id', projectId).single(),
      supabase
        .from('project_members')
        .select('name, email, notify')
        .eq('project_id', projectId)
        .eq('notify', true)
        .not('email', 'is', null),
    ])

    const recipients = (members ?? []).filter((m) => m.email).map((m) => m.email as string)
    if (recipients.length === 0) return

    const resend = new Resend(resendKey)
    const projectTitle = project?.title ?? '프로젝트'
    const subject =
      eventType === 'created'
        ? `[${projectTitle}] 새 이슈 등록: ${issue.title}`
        : `[${projectTitle}] 이슈 업데이트: ${issue.title}`

    await resend.emails.send({
      from: fromEmail,
      to: recipients,
      subject,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
          <h2 style="font-size:16px;margin-bottom:4px">${subject}</h2>
          <p style="color:#6b7280;font-size:13px;margin-bottom:16px">${projectTitle}</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <tr><td style="padding:6px 0;color:#6b7280;width:80px">유형</td><td>${TYPE_LABELS[issue.type] ?? issue.type}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">긴급도</td><td>${URGENCY_LABELS[issue.urgency] ?? issue.urgency}</td></tr>
            ${issue.description ? `<tr><td style="padding:6px 0;color:#6b7280;vertical-align:top">내용</td><td style="white-space:pre-wrap">${issue.description}</td></tr>` : ''}
          </table>
        </div>
      `,
    })
  } catch {
    // 알림 실패가 이슈 저장을 막지 않음
  }
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('project_issues')
    .select('*')
    .eq('project_id', id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createServerClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from('project_issues')
    .insert({ ...body, project_id: id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // critical/high 이슈 생성 시 알림 발송
  if (body.urgency === 'critical' || body.urgency === 'high') {
    await sendIssueNotification(id, body, 'created')
  }

  return NextResponse.json(data)
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createServerClient()
  const { issueId, ...body } = await req.json()

  const { data, error } = await supabase
    .from('project_issues')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', issueId)
    .eq('project_id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 상태가 resolved로 변경될 때 알림
  if (body.status === 'resolved' && data) {
    await sendIssueNotification(id, data, 'updated')
  }

  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createServerClient()
  const { issueId } = await req.json()

  const { error } = await supabase
    .from('project_issues')
    .delete()
    .eq('id', issueId)
    .eq('project_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
