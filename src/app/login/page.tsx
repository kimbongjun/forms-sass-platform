import AuthForm from '@/components/auth/AuthForm'

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">MKT Form Builder</h1>
        <p className="mt-1.5 text-sm text-gray-500">폼을 구성하고 응답을 수집하세요</p>
      </div>
      <AuthForm />
    </div>
  )
}
