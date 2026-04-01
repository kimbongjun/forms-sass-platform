'use client'

import React, { useState } from 'react'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

interface AccountFormProps {
  email: string
  initialName: string
  initialTeam: string
}

export default function AccountForm({ email, initialName, initialTeam }: AccountFormProps) {
  const [name, setName] = useState(initialName)
  const [team, setTeam] = useState(initialTeam)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)

  const inputClass =
    'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900'

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault()
    setProfileError('')
    setProfileSuccess(false)
    if (!name.trim()) { setProfileError('이름을 입력해주세요.'); return }
    if (!team.trim()) { setProfileError('소속팀을 입력해주세요.'); return }

    setProfileLoading(true)
    try {
      const supabase = createClient()
      const { error: err } = await supabase.auth.updateUser({
        data: { name: name.trim(), team: team.trim() },
      })
      if (err) throw err
      setProfileSuccess(true)
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setProfileLoading(false)
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    setPwSuccess(false)

    if (newPassword.length < 6) { setPwError('비밀번호는 6자 이상이어야 합니다.'); return }
    if (newPassword !== confirmPassword) { setPwError('비밀번호가 일치하지 않습니다.'); return }

    setPwLoading(true)
    try {
      const supabase = createClient()
      const { error: err } = await supabase.auth.updateUser({ password: newPassword })
      if (err) throw err
      setPwSuccess(true)
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPwError(err instanceof Error ? err.message : '비밀번호 변경에 실패했습니다.')
    } finally {
      setPwLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 계정 정보 */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">계정 정보</h2>
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-gray-500">이메일</label>
          <input
            type="email"
            value={email}
            readOnly
            className={`${inputClass} cursor-not-allowed bg-gray-50 text-gray-500`}
          />
          <p className="mt-1.5 text-xs text-gray-400">이메일은 변경할 수 없습니다.</p>
        </div>

        <form onSubmit={handleProfileSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">이름</label>
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
              <label className="mb-1.5 block text-xs font-medium text-gray-500">소속팀</label>
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

          {profileError && (
            <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">{profileError}</p>
          )}
          {profileSuccess && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-2.5 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              프로필이 저장되었습니다.
            </div>
          )}

          <button
            type="submit"
            disabled={profileLoading}
            className="flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {profileLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {profileLoading ? '저장 중...' : '프로필 저장'}
          </button>
        </form>
      </section>

      {/* 비밀번호 변경 */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">비밀번호 변경</h2>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500">새 비밀번호</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="6자 이상"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500">비밀번호 확인</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="새 비밀번호 재입력"
              required
              className={inputClass}
            />
          </div>

          {pwError && (
            <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">{pwError}</p>
          )}
          {pwSuccess && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-2.5 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              비밀번호가 변경되었습니다.
            </div>
          )}

          <button
            type="submit"
            disabled={pwLoading}
            className="flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pwLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {pwLoading ? '변경 중...' : '비밀번호 변경'}
          </button>
        </form>
      </section>
    </div>
  )
}
