import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import {
  getGlobalSiteSettings,
  getResolvedFavicon,
  getResolvedPrimaryColor,
  getResolvedSiteDescription,
  getResolvedSiteTitle,
} from '@/utils/site-settings'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getGlobalSiteSettings()
  const siteTitle = getResolvedSiteTitle(settings)
  const siteDescription = getResolvedSiteDescription(settings)
  const favicon = getResolvedFavicon(settings)
  const ogImage = settings.og_image_url?.trim()

  return {
    title: {
      default: siteTitle,
      template: `%s | ${siteTitle}`,
    },
    description: siteDescription,
    openGraph: {
      title: siteTitle,
      description: siteDescription,
      images: ogImage ? [ogImage] : undefined,
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title: siteTitle,
      description: siteDescription,
      images: ogImage ? [ogImage] : undefined,
    },
    icons: favicon
      ? {
          icon: [favicon],
          shortcut: [favicon],
        }
      : undefined,
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const settings = await getGlobalSiteSettings()
  const primaryColor = getResolvedPrimaryColor(settings)

  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      style={{ '--color-primary': primaryColor } as React.CSSProperties}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
