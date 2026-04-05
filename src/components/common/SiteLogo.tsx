import Image from 'next/image'
import classysLogo from '@/imgs/classys_logo.svg'
import { type GlobalSiteSettings, getResolvedDarkLogoUrl, getResolvedLogoUrl } from '@/utils/site-settings'

interface SiteLogoProps {
  settings?: GlobalSiteSettings
  alt: string
  className?: string
}

export default function SiteLogo({ settings = {}, alt, className = 'h-8 w-auto' }: SiteLogoProps) {
  const lightLogoUrl = getResolvedLogoUrl(settings) ?? classysLogo.src
  const darkLogoUrl = getResolvedDarkLogoUrl(settings) ?? classysLogo.src

  return (
    <span className="inline-flex items-center">
      <span className="site-logo-light">
        <Image
          src={lightLogoUrl}
          alt={alt}
          width={180}
          height={40}
          unoptimized
          className={['shrink-0 object-contain', className].join(' ')}
        />
      </span>
      <span className="site-logo-dark">
        <Image
          src={darkLogoUrl}
          alt=""
          aria-hidden="true"
          width={180}
          height={40}
          unoptimized
          className={['shrink-0 object-contain', className].join(' ')}
        />
      </span>
    </span>
  )
}
