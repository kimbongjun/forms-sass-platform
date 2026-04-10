'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Eye, EyeOff, Mail, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

const ALLOWED_DOMAIN = 'classys.com'

type Tab = 'login' | 'signup'

export default function AuthForm() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('login')

  // 이메일 = username + @classys.com
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [name, setName] = useState('')
  const [team, setTeam] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [agreedPrivacy, setAgreedPrivacy] = useState(false)
  const [agreedTerms, setAgreedTerms] = useState(false)
  const [agreedService, setAgreedService] = useState(false)
  const [signupDone, setSignupDone] = useState(false)
  const [signupEmail, setSignupEmail] = useState('')
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMessage, setResendMessage] = useState('')

  const email = username.trim() ? `${username.trim()}@${ALLOWED_DOMAIN}` : ''

  const inputClass =
    'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900'

  function handleUsernameChange(value: string) {
    // @ 이후 입력 방지, 소문자·숫자·점·하이픈·언더스코어만 허용
    setUsername(value.replace(/@.*/, '').replace(/[^a-zA-Z0-9._-]/g, ''))
    setError('')
  }

  function resetForm() {
    setUsername('')
    setPassword('')
    setPasswordConfirm('')
    setName('')
    setTeam('')
    setError('')
    setMessage('')
    setAgreedPrivacy(false)
    setAgreedTerms(false)
    setAgreedService(false)
  }

  async function handleResend() {
    setResendLoading(true)
    setResendMessage('')
    const supabase = createClient()
    const { error: err } = await supabase.auth.resend({
      type: 'signup',
      email: signupEmail,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    })
    setResendLoading(false)
    setResendMessage(err ? '재발송에 실패했습니다. 잠시 후 다시 시도해주세요.' : '인증 이메일을 재발송했습니다.')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')

    if (!username.trim()) {
      setError('이메일 아이디를 입력해주세요.')
      return
    }

    if (tab === 'signup') {
      if (!name.trim()) { setError('이름을 입력해주세요.'); return }
      if (!team.trim()) { setError('소속팀을 입력해주세요.'); return }
      if (password !== passwordConfirm) { setError('비밀번호가 일치하지 않습니다.'); return }
      if (!agreedPrivacy || !agreedTerms || !agreedService) { setError('모든 필수 약관에 동의해주세요.'); return }
    }

    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    try {
      if (tab === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) throw err
        router.push('/dashboard')
        router.refresh()
      } else {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name: name.trim(), team: team.trim() },
            emailRedirectTo: `${location.origin}/auth/callback`,
          },
        })
        if (err) throw err
        setSignupEmail(email)
        setSignupDone(true)
        resetForm()
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '오류가 발생했습니다.'
      if (msg.includes('Invalid login credentials')) setError('이메일 또는 비밀번호가 올바르지 않습니다.')
      else if (msg.includes('User already registered')) setError('이미 가입된 이메일입니다.')
      else setError(msg)
    } finally {
      setLoading(false)
    }
  }

  // ── 이메일 인증 안내 화면 ─────────────────────────────────────────
  if (signupDone) {
    return (
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
            <Mail className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="mb-2 text-lg font-bold text-gray-900">이메일 인증을 완료해주세요</h2>
          <p className="mb-1 text-sm text-gray-500">아래 주소로 인증 링크를 발송했습니다.</p>
          <p className="mb-6 text-sm font-semibold text-gray-800">{signupEmail}</p>

          <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 p-4 text-left space-y-2">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
              <p className="text-xs text-blue-700">이메일 받은편지함을 확인해주세요. 스팸 폴더도 확인해보세요.</p>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
              <p className="text-xs text-blue-700">이메일의 <strong>인증하기</strong> 버튼을 클릭하면 가입이 완료됩니다.</p>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
              <p className="text-xs text-blue-700">인증 링크는 24시간 동안 유효합니다.</p>
            </div>
          </div>

          {resendMessage && (
            <p className={`mb-4 rounded-lg px-4 py-2.5 text-sm ${resendMessage.includes('실패') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
              {resendMessage}
            </p>
          )}

          <button
            type="button"
            onClick={handleResend}
            disabled={resendLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            {resendLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {resendLoading ? '발송 중...' : '인증 이메일 재발송'}
          </button>

          <button
            type="button"
            onClick={() => { setSignupDone(false); setTab('login'); setResendMessage('') }}
            className="mt-3 w-full text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            로그인으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* 탭 */}
      <div className="flex border-b border-gray-100">
        {(['login', 'signup'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setTab(t); resetForm() }}
            className={[
              'flex-1 py-3.5 text-sm font-medium transition-colors',
              tab === t
                ? 'border-b-2 border-gray-900 text-gray-900'
                : 'text-gray-400 hover:text-gray-600',
            ].join(' ')}
          >
            {t === 'login' ? '로그인' : '회원가입'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 p-8">

        {/* 이름 (회원가입 전용) */}
        {tab === 'signup' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">이름 <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">소속팀 <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                placeholder="국내마컴팀"
                required
                className={inputClass}
              />
            </div>
          </div>
        )}

        {/* 이메일 */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-500">이메일</label>
          <div className="flex overflow-hidden rounded-xl border border-gray-200 focus-within:border-transparent focus-within:ring-2 focus-within:ring-gray-900">
            <input
              type="text"
              value={username}
              onChange={(e) => handleUsernameChange(e.target.value)}
              placeholder="아이디"
              required
              className="min-w-0 flex-1 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
            />
            <span className="flex shrink-0 items-center border-l border-gray-200 bg-gray-50 px-3 text-sm text-gray-500">
              @{ALLOWED_DOMAIN}
            </span>
          </div>
        </div>

        {/* 비밀번호 */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-500">비밀번호</label>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6자 이상"
              required
              className={`${inputClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* 비밀번호 확인 (회원가입 전용) */}
        {tab === 'signup' && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500">비밀번호 확인</label>
            <input
              type={showPw ? 'text' : 'password'}
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="비밀번호 재입력"
              required
              className={inputClass}
            />
          </div>
        )}

        {/* 약관 동의 (회원가입 전용) */}
        {tab === 'signup' && (
          <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-medium text-gray-600 mb-2">필수 약관 동의</p>
            {[
              { key: 'privacy', label: '개인정보처리방침', href: '/privacy', state: agreedPrivacy, setter: setAgreedPrivacy },
              { key: 'terms', label: '이용약관', href: '/terms', state: agreedTerms, setter: setAgreedTerms },
              { key: 'service', label: '서비스이용동의', href: '/service', state: agreedService, setter: setAgreedService },
            ].map(({ key, label, href, state, setter }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={state}
                  onChange={(e) => setter(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                />
                <span className="text-xs text-gray-700">
                  (필수){' '}
                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">
                    {label}
                  </a>
                  에 동의합니다.
                </span>
              </label>
            ))}
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? '처리 중...' : tab === 'login' ? '로그인' : '회원가입'}
        </button>

        {tab === 'login' && (
          <div className="relative flex items-center py-1">
            <div className="flex-1 border-t border-gray-100" />
            <span className="px-3 text-xs text-gray-400">또는</span>
            <div className="flex-1 border-t border-gray-100" />
          </div>
        )}

        {tab === 'login' && (
          <button
            type="button"
            onClick={() => router.push('/blueberry')}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50"
          >
            비회원으로 접속
          </button>
        )}
      </form>
    </div>
  )
}
