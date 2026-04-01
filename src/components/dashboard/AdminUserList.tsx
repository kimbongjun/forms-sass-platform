'use client'

import { useEffect, useState } from 'react'
import {
  Shield, User, RotateCcw, ChevronDown,
  Loader2, CheckCircle2, X, Search, Trash2,
} from 'lucide-react'

interface UserRow {
  id: string
  email: string
  role: 'administrator' | 'editor'
  created_at: string
  last_sign_in_at: string | null
}

export default function AdminUserList() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  // 비밀번호 초기화 모달
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState('')
  const [resetSuccess, setResetSuccess] = useState(false)

  // 역할 변경
  const [roleChangingId, setRoleChangingId] = useState<string | null>(null)

  // 회원 삭제
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/users')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setUsers(json.users)
    } catch (err) {
      setError(err instanceof Error ? err.message : '사용자 목록을 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function handleRoleChange(userId: string, newRole: 'administrator' | 'editor') {
    setRoleChangingId(userId)
    try {
      const res = await fetch('/api/admin/update-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, newRole }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole } : u))
    } catch (err) {
      alert(err instanceof Error ? err.message : '역할 변경에 실패했습니다.')
    } finally {
      setRoleChangingId(null)
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!resetTarget) return
    setResetError('')
    setResetLoading(true)
    try {
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: resetTarget.id, newPassword }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setResetSuccess(true)
    } catch (err) {
      setResetError(err instanceof Error ? err.message : '비밀번호 초기화에 실패했습니다.')
    } finally {
      setResetLoading(false)
    }
  }

  async function handleDeleteUser() {
    if (!deleteTarget) return
    setDeleteError('')
    setDeleteLoading(true)
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: deleteTarget.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    } finally {
      setDeleteLoading(false)
    }
  }

  function openReset(user: UserRow) {
    setResetTarget(user)
    setNewPassword('')
    setResetError('')
    setResetSuccess(false)
  }

  function closeReset() {
    setResetTarget(null)
    setNewPassword('')
    setResetError('')
    setResetSuccess(false)
  }

  const filtered = users.filter((u) =>
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  function formatDate(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  }

  // ── 비밀번호 초기화 모달 ──────────────────────────────────────────────────

  if (resetTarget) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">비밀번호 초기화</p>
              <p className="mt-0.5 text-xs text-gray-400 truncate max-w-[240px]">{resetTarget.email}</p>
            </div>
            <button type="button" onClick={closeReset} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-5">
            {resetSuccess ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
                <p className="text-sm font-medium text-gray-800">비밀번호가 변경되었습니다.</p>
                <p className="text-xs text-gray-400">사용자에게 새 비밀번호를 안전하게 전달해주세요.</p>
                <button type="button" onClick={closeReset}
                  className="mt-2 rounded-xl bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700">
                  확인
                </button>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-500">새 비밀번호</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="6자 이상"
                    required
                    minLength={6}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                {resetError && (
                  <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">{resetError}</p>
                )}
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={closeReset}
                    className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    취소
                  </button>
                  <button type="submit" disabled={resetLoading}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gray-900 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50">
                    {resetLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    초기화
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── 회원 삭제 확인 모달 ──────────────────────────────────────────────────────

  if (deleteTarget) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-4 w-4" />
              <p className="text-sm font-semibold">회원 삭제</p>
            </div>
            <button type="button" onClick={() => { setDeleteTarget(null); setDeleteError('') }}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-sm text-gray-700">
              <span className="font-medium text-gray-900 break-all">{deleteTarget.email}</span> 계정을 삭제하면
              해당 사용자의 모든 폼과 응답 데이터도 함께 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
            </p>
            {deleteError && (
              <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">{deleteError}</p>
            )}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => { setDeleteTarget(null); setDeleteError('') }}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                취소
              </button>
              <button type="button" onClick={handleDeleteUser} disabled={deleteLoading}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                {deleteLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                삭제
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── 메인 목록 ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* 검색 + 새로고침 */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이메일로 검색..."
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
        <button type="button" onClick={fetchUsers} disabled={loading}
          className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          새로고침
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 bg-gray-50 px-5 py-3">
            <p className="text-xs font-medium text-gray-500">전체 {users.length}명 {search && `(검색 결과 ${filtered.length}명)`}</p>
          </div>

          {filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-400">검색 결과가 없습니다.</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map((u) => (
                <div key={u.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/50 transition-colors">
                  {/* 아이콘 */}
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    u.role === 'administrator' ? 'bg-amber-100' : 'bg-gray-100'
                  }`}>
                    {u.role === 'administrator'
                      ? <Shield className="h-4 w-4 text-amber-600" />
                      : <User className="h-4 w-4 text-gray-500" />
                    }
                  </div>

                  {/* 정보 */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{u.email}</p>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-400">
                      <span>가입: {formatDate(u.created_at)}</span>
                      {u.last_sign_in_at && <span>최근 로그인: {formatDate(u.last_sign_in_at)}</span>}
                    </div>
                  </div>

                  {/* 역할 변경 */}
                  <div className="relative shrink-0">
                    {roleChangingId === u.id ? (
                      <div className="flex h-8 w-32 items-center justify-center">
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                      </div>
                    ) : (
                      <div className="relative">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as 'administrator' | 'editor')}
                          className={[
                            'appearance-none rounded-lg border py-1.5 pl-3 pr-7 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-gray-900 cursor-pointer',
                            u.role === 'administrator'
                              ? 'border-amber-200 bg-amber-50 text-amber-700'
                              : 'border-gray-200 bg-gray-50 text-gray-600',
                          ].join(' ')}
                        >
                          <option value="editor">Editor</option>
                          <option value="administrator">Administrator</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* 비밀번호 초기화 */}
                  <button
                    type="button"
                    onClick={() => openReset(u)}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    비밀번호 초기화
                  </button>

                  {/* 회원 삭제 */}
                  <button
                    type="button"
                    onClick={() => { setDeleteTarget(u); setDeleteError('') }}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:border-red-300 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    삭제
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
