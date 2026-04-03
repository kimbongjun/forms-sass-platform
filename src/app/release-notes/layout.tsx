import SiteHeader from '@/components/common/SiteHeader'
import SiteFooter from '@/components/common/SiteFooter'

export default function ReleaseNotesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <SiteHeader />
      <main className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}
