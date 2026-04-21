// Module-level daily token budget for Groq's free tier (100K TPD).
// Resets at KST midnight. Works for single-process deployments.

const DAILY_BUDGET = 85_000   // stay below 100K hard limit
const WARN_AT = 60_000        // warn at 70% of budget

interface State { date: string; tokens: number }
const state: State = { date: '', tokens: 0 }

function todayKST(): string {
  return new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10)
}

function sync() {
  const today = todayKST()
  if (state.date !== today) { state.date = today; state.tokens = 0 }
}

export function checkQuota(): { blocked: boolean; warning: boolean; used: number; remaining: number } {
  sync()
  const used = state.tokens
  return {
    blocked: used >= DAILY_BUDGET,
    warning: used >= WARN_AT && used < DAILY_BUDGET,
    used,
    remaining: Math.max(0, DAILY_BUDGET - used),
  }
}

export function consume(tokens: number) {
  sync()
  state.tokens += tokens
}

export const BUDGET = DAILY_BUDGET
