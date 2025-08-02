import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import QueryProvider from '@/lib/providers/QueryProvider'
import Header from '@/components/common/Header'
import Footer from '@/components/common/Footer'
import GoogleAnalytics from '@/components/analytics/GoogleAnalytics'
import CookieConsentBanner from '@/components/analytics/CookieConsentBanner'
import { generateMetadata as generateSEOMetadata, PAGE_CONFIGS } from '@/lib/seo/config'
import { StructuredData, generateOrganizationSchema, generateWebsiteSchema } from '@/lib/seo/structured-data'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = generateSEOMetadata(PAGE_CONFIGS.home)

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
          
          {/* Structured Data for SEO */}
          <StructuredData schema={generateOrganizationSchema()} />
          <StructuredData schema={generateWebsiteSchema()} />
          
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