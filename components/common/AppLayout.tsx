'use client'

import { usePathname } from 'next/navigation'
import Header from '@/components/common/Header'
import Footer from '@/components/common/Footer'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import CookieConsentBanner from '@/components/analytics/CookieConsentBanner'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isStandaloneChat = pathname === '/ai-chat' || pathname?.startsWith('/ai-chat/')

  if (isStandaloneChat) {
    return (
      <div className="h-screen h-[100dvh] overflow-hidden flex flex-col">
        <ErrorBoundary level="page" name="Standalone Chat">
          {children}
        </ErrorBoundary>
        <CookieConsentBanner />
      </div>
    )
  }

  return (
    <>
      <ErrorBoundary level="section" name="Header">
        <Header />
      </ErrorBoundary>

      <main className="flex-1">
        <ErrorBoundary level="page" name="Main Content">
          {children}
        </ErrorBoundary>
      </main>

      <ErrorBoundary level="section" name="Footer">
        <Footer />
      </ErrorBoundary>
      <CookieConsentBanner />
    </>
  )
}
