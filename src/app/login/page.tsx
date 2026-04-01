import Image from 'next/image'
import classysLogo from '@/imgs/classys_logo.svg'
import AuthForm from '@/components/auth/AuthForm'

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="mb-8 text-center">
        <div className="mb-4 flex justify-center">
          <Image src={classysLogo} alt="CLASSYS" width={160} height={48} priority />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Form & Survey Builder</h1>
        <p className="mt-1.5 text-sm text-gray-500">설문을 생성하고 관리하는 플랫폼입니다.</p>
        <p className="mt-1.5 text-sm text-gray-500">국/내외 클래시스 학회,행사,유저미팅 등 다양한 목적으로 활용해 주시기 바랍니다.</p>
      </div>
      <AuthForm />
      <small className='mt-1.5'>※ 관련 문의 : 국내마컴팀 김봉준 책임</small>
    </div>
  )
}
