import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import QueryProvider from '@/lib/providers/QueryProvider'
import AppLayout from '@/components/common/AppLayout'
import GoogleAnalytics from '@/components/analytics/GoogleAnalytics'
import { generateMetadata as generateSEOMetadata, PAGE_CONFIGS } from '@/lib/seo/config'
import { StructuredData, generateOrganizationSchema, generateWebsiteSchema } from '@/lib/seo/structured-data'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Analytics } from '@vercel/analytics/next'
const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  preload: true,
})

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
          <SpeedInsights />
          <Analytics />
          
          {/* Structured Data for SEO */}
          <StructuredData schema={generateOrganizationSchema()} />
          <StructuredData schema={generateWebsiteSchema()} />
          
          <AppLayout>
            {children}
          </AppLayout>
        </QueryProvider>
      </body>
    </html>
  )
} 