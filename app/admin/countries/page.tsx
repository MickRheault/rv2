'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, Button, Spinner, Alert } from '@/components/ui'
import { 
  ArrowLeftIcon,
  DocumentTextIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline'
import Link from 'next/link'
import { locationService } from '@/services/locations'

interface Country {
  code: string
  name: string
  content_sections: any
}

function CountriesAdminContent() {
  const [countries, setCountries] = useState<Country[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load countries
  const loadCountries = useCallback(async () => {
    try {
      setLoading(true)
      const data = await locationService.getCountries()
      setCountries(data as Country[])
    } catch (err) {
      console.error('Error loading countries:', err)
      setError('Failed to load countries')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCountries()
  }, [loadCountries])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="sm">
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back to Admin
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Countries Management
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage content sections for country pages
            </p>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && <Alert variant="error" description={error} dismissible onDismiss={() => setError(null)} />}

      {/* Loading State */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Spinner size="lg" />
        </div>
      ) : (
        /* Countries List */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {countries.map((country) => {
            const sectionsCount = country.content_sections ? 
              (Array.isArray(country.content_sections) ? country.content_sections.length : 0) : 0

            return (
              <Card key={country.code}>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <GlobeAltIcon className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {country.name}
                        </h3>
                        <p className="text-xs text-gray-500">
                          Code: {country.code}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">{sectionsCount}</span> content section{sectionsCount !== 1 ? 's' : ''}
                    </div>
                    <Link href={`/admin/countries/${country.code}/content`}>
                      <Button size="sm">
                        <DocumentTextIcon className="h-4 w-4 mr-2" />
                        Manage Content
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function CountriesAdminPage() {
  return (
    
      <CountriesAdminContent />
    
  )
}

