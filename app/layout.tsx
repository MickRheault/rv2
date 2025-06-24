import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import QueryProvider from '@/lib/providers/QueryProvider'
import { DevTools } from '@/components/debug'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'RideVault - Global Motorcycle Rental Platform',
  description: 'Discover and compare motorcycle rentals worldwide. Find the perfect bike for your adventure.',
  keywords: ['motorcycle rental', 'bike rental', 'travel', 'adventure'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-white text-gray-900 antialiased`}>
        <QueryProvider>
          {children}
          <DevTools />
        </QueryProvider>
      </body>
    </html>
  )
} 