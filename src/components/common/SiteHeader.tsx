import Link from 'next/link'
import SiteLogo from '@/components/common/SiteLogo'
import { getGlobalSiteSettings, getResolvedSiteTitle } from '@/utils/site-settings'

export default async function SiteHeader() {
  const siteSettings = await getGlobalSiteSettings()
  const siteTitle = getResolvedSiteTitle(siteSettings)

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center px-8">
        <Link href="/dashboard" className="flex items-center gap-3 transition-opacity hover:opacity-80">
          <SiteLogo settings={siteSettings} alt={siteTitle} className="h-7 w-auto" />
          <span className="text-sm font-semibold text-gray-900">{siteTitle}</span>
        </Link>
      </div>
    </header>
  )
}
