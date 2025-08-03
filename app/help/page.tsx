import { Metadata } from 'next'
import { generateMetadata as generateSEOMetadata, PAGE_CONFIGS } from '@/lib/seo/config'

export const metadata: Metadata = generateSEOMetadata(PAGE_CONFIGS.help)

export default function HelpPage() {
  return (
    <div className="container-custom py-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Help Center
        </h1>
        <div className="card p-8 text-center">
          <p className="text-gray-600 mb-4">
            Find answers to frequently asked questions and get support.
          </p>
          <div className="inline-flex items-center px-4 py-2 bg-green-100 text-green-800 rounded-lg">
            💬 Coming Soon
          </div>
        </div>
      </div>
    </div>
  )
} 