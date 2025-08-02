import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import QueryProvider from '@/lib/providers/QueryProvider'
import Header from '@/components/common/Header'
import Footer from '@/components/common/Footer'
import GoogleAnalytics from '@/components/analytics/GoogleAnalytics'
import CookieConsentBanner from '@/components/analytics/CookieConsentBanner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'RideVault - Global Motorcycle Rental Platform',
  description: 'Discover and compare motorcycle rentals worldwide. Find the perfect bike for your adventure.',
  keywords: ['motorcycle rental', 'bike rental', 'travel', 'adventure'],
  authors: [{ name: 'RideVault' }],
  openGraph: {
    title: 'RideVault - Global Motorcycle Rental Platform',
    description: 'Discover and compare motorcycle rentals worldwide. Find the perfect bike for your adventure.',
    type: 'website',
    locale: 'en_US',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${inter.className} bg-white text-gray-900 antialiased min-h-screen flex flex-col`}>
        <QueryProvider>
          <GoogleAnalytics />
          <Header />
          <main className="flex-1">
            {children}
          </main>
          <Footer />
          <CookieConsentBanner />
        </QueryProvider>
      </body>
    </html>
  )
} 