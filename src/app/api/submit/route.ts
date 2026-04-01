import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServerClient } from '@/utils/supabase/server'
import type { FormField } from '@/types/database'

const resend = new Resend(process.env.RESEND_API_KEY)

interface SubmitBody {
  projectId: string
  answers: Record<string, string | boolean | string[]>
  fields: Pick<FormField, 'id' | 'label' | 'type'>[]
}

const INPUT_TYPES = ['text', 'email', 'textarea', 'checkbox', 'select', 'radio', 'checkbox_group']

// ── 이메일 공통 래퍼 HTML ────────────────────────────────────────────────────
function wrapEmailLayout(innerHtml: string, title: string): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
      <div style="background:#111;padding:20px 24px">
        <p style="margin:0;color:#fff;font-size:18px;font-weight:700">${title}</p>
      </div>
      <div style="padding:24px">
        ${innerHtml}
      </div>
    </div>`
}

// ── 응답 테이블 HTML 생성 ────────────────────────────────────────────────────
function buildAnswersTable(
  inputFields: Pick<FormField, 'id' | 'label' | 'type'>[],
  answers: Record<string, string | boolean | string[]>
): string {
  const rows = inputFields
    .map((f) => {
      const val = answers[f.id]
      let display = ''
      if (Array.isArray(val)) display = val.join(', ')
      else if (typeof val === 'boolean') display = val ? '✅ 동의' : '❌ 미동의'
      else display = (val as string) ?? '(미입력)'
      return `
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;color:#555;font-size:13px;width:38%;vertical-align:top">${f.label || '(제목 없음)'}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;color:#111;font-size:13px">${display}</td>
        </tr>`
    })
    .join('')

  return `
    <table style="width:100%;border-collapse:collapse;border:1px solid #f0f0f0;border-radius:8px;overflow:hidden">
      <thead>
        <tr style="background:#f9fafb">
          <th style="padding:10px 14px;text-align:left;font-size:12px;color:#888;font-weight:600;border-bottom:1px solid #f0f0f0">항목</th>
          <th style="padding:10px 14px;text-align:left;font-size:12px;color:#888;font-weight:600;border-bottom:1px solid #f0f0f0">응답</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`
}

// ── 기본 관리자 템플릿 ───────────────────────────────────────────────────────
function defaultAdminTemplate(formTitle: string, submittedAt: string, answersTable: string): string {
  return `
    <p style="margin:0 0 16px;font-size:14px;color:#374151">새로운 폼 응답이 도착했습니다.</p>
    <p style="margin:0 0 4px;font-size:13px;color:#6b7280"><strong>폼:</strong> ${formTitle}</p>
    <p style="margin:0 0 20px;font-size:13px;color:#6b7280"><strong>제출 시각:</strong> ${submittedAt}</p>
    ${answersTable}`
}

// ── 템플릿 변수 치환 ─────────────────────────────────────────────────────────
function renderTemplate(
  template: string,
  vars: { form_title: string; submitted_at: string; answers_table: string }
): string {
  return template
    .replace(/\{\{form_title\}\}/g, vars.form_title)
    .replace(/\{\{submitted_at\}\}/g, vars.submitted_at)
    .replace(/\{\{answers_table\}\}/g, vars.answers_table)
}

export async function POST(req: NextRequest) {
  try {
    const body: SubmitBody = await req.json()
    const { projectId, answers, fields } = body

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // ── 0. 제출 제한 검사 ────────────────────────────────────────────────────
    const { data: project } = await supabase
      .from('projects')
      .select('title, notification_email, slug, is_published, deadline, max_submissions, webhook_url, admin_email_template, user_email_template')
      .eq('id', projectId)
      .single()

    if (!project) {
      return NextResponse.json({ error: '존재하지 않는 폼입니다.' }, { status: 404 })
    }
    if (project.is_published === false) {
      return NextResponse.json({ error: '비공개 폼입니다.' }, { status: 403 })
    }
    if (project.deadline && new Date(project.deadline) < new Date()) {
      return NextResponse.json({ error: '제출 마감된 폼입니다.' }, { status: 403 })
    }
    if (project.max_submissions) {
      const { count } = await supabase
        .from('submissions')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId)
      if ((count ?? 0) >= project.max_submissions) {
        return NextResponse.json({ error: '최대 응답 수에 도달했습니다.' }, { status: 403 })
      }
    }

    // ── 1. submissions 저장 ──────────────────────────────────────────────────
    const { error: insertErr } = await supabase
      .from('submissions')
      .insert({ project_id: projectId, answers })

    if (insertErr) {
      return NextResponse.json({ error: `제출 저장 실패: ${insertErr.message}` }, { status: 500 })
    }

    const inputFields = fields.filter((f) => INPUT_TYPES.includes(f.type))

    // ── 2. 웹훅 발송 ─────────────────────────────────────────────────────────
    if (project.webhook_url) {
      try {
        await fetch(project.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            projectTitle: project.title,
            submittedAt: new Date().toISOString(),
            answers: Object.fromEntries(
              inputFields.map((f) => [f.label || f.id, answers[f.id]])
            ),
          }),
        })
      } catch (webhookErr) {
        console.error('[/api/submit] webhook error:', webhookErr)
      }
    }

    // ── 3. 이메일 발송 준비 ──────────────────────────────────────────────────
    if (!process.env.RESEND_API_KEY || (!project.notification_email && !project.user_email_template)) {
      return NextResponse.json({ ok: true })
    }

    const submittedAt = new Date().toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

    const answersTable = buildAnswersTable(inputFields, answers)
    const templateVars = {
      form_title: project.title,
      submitted_at: submittedAt,
      answers_table: answersTable,
    }

    const from = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'
    const emailPromises: Promise<unknown>[] = []

    // ── 3-1. 관리자 이메일 ────────────────────────────────────────────────────
    if (project.notification_email) {
      const bodyHtml = project.admin_email_template
        ? renderTemplate(project.admin_email_template, templateVars)
        : defaultAdminTemplate(project.title, submittedAt, answersTable)

      emailPromises.push(
        resend.emails.send({
          from,
          to: project.notification_email,
          subject: `[폼 응답] ${project.title}`,
          html: wrapEmailLayout(bodyHtml, `📋 새 폼 응답 — ${project.title}`),
        }).catch((err) => console.error('[/api/submit] admin email error:', err))
      )
    }

    // ── 3-2. 응답자 이메일 ────────────────────────────────────────────────────
    if (project.user_email_template) {
      // 폼에서 email 타입 필드의 응답값 추출
      const emailField = fields.find((f) => f.type === 'email')
      const userEmail = emailField ? (answers[emailField.id] as string | undefined) : undefined

      if (userEmail && userEmail.includes('@')) {
        const bodyHtml = renderTemplate(project.user_email_template, templateVars)

        emailPromises.push(
          resend.emails.send({
            from,
            to: userEmail,
            subject: `[확인] ${project.title} 응답이 접수되었습니다`,
            html: wrapEmailLayout(bodyHtml, `✅ 응답이 접수되었습니다`),
          }).catch((err) => console.error('[/api/submit] user email error:', err))
        )
      }
    }

    await Promise.all(emailPromises)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/submit] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '서버 오류' },
      { status: 500 }
    )
  }
}
