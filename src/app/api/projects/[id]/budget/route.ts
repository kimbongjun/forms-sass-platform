import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/utils/supabase/server'
import type { ProjectBudgetItem } from '@/types/database'

interface BudgetPayload {
  totalBudget: number
  currency: string
  items: ProjectBudgetItem[]
}

function normalizeItem(item: ProjectBudgetItem): ProjectBudgetItem {
  const amount = Math.max(0, Number(item.amount) || 0)
  const minAmount =
    item.min_amount == null || Number.isNaN(Number(item.min_amount))
      ? null
      : Math.max(0, Number(item.min_amount))
  const maxAmount =
    item.max_amount == null || Number.isNaN(Number(item.max_amount))
      ? null
      : Math.max(0, Number(item.max_amount))
  const weight = Math.max(0, Number(item.weight) || 0)

  const actualAmount =
    item.actual_amount == null || Number.isNaN(Number(item.actual_amount))
      ? null
      : Math.max(0, Number(item.actual_amount))

  return {
    id: item.id,
    name: item.name.trim() || '항목',
    type: item.type,
    amount,
    actual_amount: actualAmount,
    min_amount: minAmount,
    max_amount: maxAmount,
    weight,
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

    const { data: ownedProject } = await supabase
      .from('projects')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!ownedProject) return NextResponse.json({ error: '조회 권한이 없습니다.' }, { status: 403 })

    const { data, error } = await supabase
      .from('project_budget_plans')
      .select('total_budget, currency, items')
      .eq('project_id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return NextResponse.json({ plan: null })
      if (error.code === '42P01') {
        return NextResponse.json({
          plan: null,
          warning: 'project_budget_plans 테이블이 없어 기본 상태로 표시합니다. 마이그레이션을 적용해 주세요.',
        })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      plan: {
        totalBudget: data.total_budget ?? 0,
        currency: data.currency ?? 'KRW',
        items: Array.isArray(data.items) ? data.items : [],
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = (await req.json()) as BudgetPayload

    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

    const { data: ownedProject } = await supabase
      .from('projects')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!ownedProject) return NextResponse.json({ error: '수정 권한이 없습니다.' }, { status: 403 })

    const items = Array.isArray(body.items) ? body.items.map(normalizeItem) : []

    const { error } = await supabase.from('project_budget_plans').upsert(
      {
        project_id: id,
        total_budget: Math.max(0, Number(body.totalBudget) || 0),
        currency: body.currency?.trim() || 'KRW',
        items,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'project_id' }
    )

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json(
          { error: 'project_budget_plans 테이블이 없습니다. 마이그레이션을 먼저 적용해 주세요.' },
          { status: 500 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
