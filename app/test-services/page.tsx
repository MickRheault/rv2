'use client'

import { useEffect, useState } from 'react'
import { motorcycleService } from '@/services/motorcycles'
import { shopService } from '@/services/shops'
import { locationService } from '@/services/locations'
import { supabase } from '@/lib/supabase/client'

interface DatabaseInfo {
  connected: boolean
  url: string
  environment: 'Local Docker' | 'Supabase Cloud' | 'Unknown'
  error?: string
  responseTime?: number
}

export default function TestServicesPage() {
  const [results, setResults] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [dbInfo, setDbInfo] = useState<DatabaseInfo | null>(null)

  useEffect(() => {
    async function checkDatabaseConnection() {
      const startTime = Date.now()
      
      try {
        // Test basic connection with a simple query
        const { data, error } = await supabase
          .from('countries')
          .select('code')
          .limit(1)
        
        const responseTime = Date.now() - startTime
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'Not configured'
        
        if (error) {
          setDbInfo({
            connected: false,
            url: supabaseUrl,
            environment: 'Unknown',
            error: error.message,
            responseTime
          })
          return
        }

        // Determine environment based on URL
        let environment: DatabaseInfo['environment'] = 'Unknown'
        if (supabaseUrl.includes('localhost') || supabaseUrl.includes('127.0.0.1')) {
          environment = 'Local Docker'
        } else if (supabaseUrl.includes('supabase.co')) {
          environment = 'Supabase Cloud'
        }

        setDbInfo({
          connected: true,
          url: supabaseUrl,
          environment,
          responseTime
        })

      } catch (error) {
        const responseTime = Date.now() - startTime
        setDbInfo({
          connected: false,
          url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'Not configured',
          environment: 'Unknown',
          error: error instanceof Error ? error.message : String(error),
          responseTime
        })
      }
    }
    async function testServices() {
      const tests = [
        { name: 'motorcycles', fn: () => motorcycleService.getMotorcycles({ limit: 3 }) },
        { name: 'brands', fn: () => motorcycleService.getBrands() },
        { name: 'categories', fn: () => motorcycleService.getCategories() },
        { name: 'priceRange', fn: () => motorcycleService.getPriceRange() },
        { name: 'shops', fn: () => shopService.getShops({ limit: 3 }) },
        { name: 'topShops', fn: () => shopService.getTopRatedShops(3) },
        { name: 'countries', fn: () => locationService.getCountries() },
        { name: 'cities', fn: () => locationService.getCities() },
      ]

      const newResults: Record<string, any> = {}
      const newErrors: Record<string, string> = {}

      for (const test of tests) {
        try {
          console.log(`Testing ${test.name}...`)
          const result = await test.fn()
          newResults[test.name] = result
          console.log(`✅ ${test.name}:`, result)
        } catch (error) {
          console.error(`❌ ${test.name}:`, error)
          newErrors[test.name] = error instanceof Error ? error.message : String(error)
        }
      }

      setResults(newResults)
      setErrors(newErrors)
      setLoading(false)
    }

    async function runTests() {
      await checkDatabaseConnection()
      await testServices()
    }

    runTests()
  }, [])

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Testing Database Services...</h1>
        <div className="animate-pulse">Loading...</div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Database Services Test Results</h1>
      
      {/* Database Connection Status */}
      {dbInfo && (
        <div className={`border rounded-lg p-4 mb-6 ${
          dbInfo.connected 
            ? 'bg-green-50 border-green-200' 
            : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <h2 className={`text-lg font-semibold ${
              dbInfo.connected ? 'text-green-800' : 'text-red-800'
            }`}>
              {dbInfo.connected ? '✅ Database Connected' : '❌ Database Connection Failed'}
            </h2>
            <span className={`text-sm ${
              dbInfo.connected ? 'text-green-600' : 'text-red-600'
            }`}>
              {dbInfo.responseTime}ms
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Environment:</strong> 
              <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                dbInfo.environment === 'Local Docker' 
                  ? 'bg-blue-100 text-blue-800'
                  : dbInfo.environment === 'Supabase Cloud'
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {dbInfo.environment}
              </span>
            </div>
            <div>
              <strong>URL:</strong> 
              <span className="ml-2 font-mono text-xs break-all">
                {dbInfo.url.replace(/^https?:\/\//, '').substring(0, 40)}...
              </span>
            </div>
          </div>
          
          {dbInfo.error && (
            <div className="mt-3 p-2 bg-red-100 rounded text-red-700 text-sm">
              <strong>Error:</strong> {dbInfo.error}
            </div>
          )}
        </div>
      )}
      
      {Object.keys(errors).length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2">❌ Errors Found:</h2>
          {Object.entries(errors).map(([test, error]) => (
            <div key={test} className="mb-2">
              <strong>{test}:</strong> <span className="text-red-600">{error}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-6">
        {Object.entries(results).map(([test, result]) => (
          <div key={test} className="bg-white border rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-2 capitalize">✅ {test}</h3>
            <div className="bg-gray-50 p-3 rounded text-sm">
              {Array.isArray(result) ? (
                <div>
                  <div className="font-medium">Array with {result.length} items</div>
                  {result.length > 0 && (
                    <pre className="mt-2 text-xs overflow-auto">
                      {JSON.stringify(result[0], null, 2)}
                    </pre>
                  )}
                </div>
              ) : result && typeof result === 'object' ? (
                <pre className="text-xs overflow-auto">
                  {JSON.stringify(result, null, 2)}
                </pre>
              ) : (
                <div>{String(result)}</div>
              )}
            </div>
          </div>
        ))}
      </div>


    </div>
  )
} 