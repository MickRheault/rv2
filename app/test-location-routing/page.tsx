import Link from 'next/link'
import { validateLocationParam, formatLocationName, validateCountryCityCombo, isReservedRoute } from '@/lib/utils'

export default function TestLocationRouting() {
  // Test cases for URL validation
  const testCases = [
    // Valid cases
    { country: 'thailand', city: 'bangkok', expected: 'valid' },
    { country: 'vietnam', city: 'hanoi', expected: 'valid' },
    { country: 'new-zealand', city: 'auckland', expected: 'valid' },
    { country: 'united-states', city: 'new-york', expected: 'valid' },
    
    // Invalid cases
    { country: 'admin', city: 'test', expected: 'invalid - reserved route' },
    { country: 'thailand', city: 'thailand', expected: 'invalid - same name' },
    { country: 'x', city: 'bangkok', expected: 'invalid - too short' },
    { country: 'thailand', city: '', expected: 'invalid - empty city' },
    { country: '', city: 'bangkok', expected: 'invalid - empty country' },
  ]

  const runValidationTest = (country: string, city: string) => {
    const results: string[] = []
    
    // Test reserved routes
    if (isReservedRoute(country) || isReservedRoute(city)) {
      results.push('❌ Reserved route detected')
    } else {
      results.push('✅ Not a reserved route')
    }
    
    // Test parameter validation
    const validCountry = validateLocationParam(country)
    const validCity = validateLocationParam(city)
    
    if (!validCountry || !validCity) {
      results.push('❌ Parameter validation failed')
    } else {
      results.push('✅ Parameters valid')
      
      // Test combination validation
      const comboValidation = validateCountryCityCombo(validCountry, validCity)
      if (comboValidation.isValid) {
        results.push('✅ Combination valid')
      } else {
        results.push(`❌ Combination invalid: ${comboValidation.error}`)
        if (comboValidation.suggestion) {
          results.push(`💡 Suggestion: ${comboValidation.suggestion}`)
        }
      }
    }
    
    return results
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Location Routing Test Page
        </h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            URL Validation Tests
          </h2>
          
          <div className="space-y-6">
            {testCases.map((testCase, index) => {
              const results = runValidationTest(testCase.country, testCase.city)
              
              return (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900">
                      /{testCase.country}/{testCase.city}/
                    </h3>
                    <span className={`px-2 py-1 rounded text-sm ${
                      testCase.expected.includes('valid') && !testCase.expected.includes('invalid')
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      Expected: {testCase.expected}
                    </span>
                  </div>
                  
                  <div className="space-y-1">
                    {results.map((result, resultIndex) => (
                      <p key={resultIndex} className="text-sm text-gray-600">
                        {result}
                      </p>
                    ))}
                  </div>
                  
                  {/* Test link if valid */}
                  {!results.some(r => r.includes('❌')) && (
                    <div className="mt-3">
                      <Link 
                        href={`/${testCase.country}/${testCase.city}/`}
                        className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200"
                      >
                        Test Live URL →
                      </Link>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            SEO Metadata Test Links
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Country Pages</h3>
              <div className="space-y-2">
                <Link href="/thailand" className="block p-3 border border-gray-200 rounded hover:bg-gray-50">
                  <div className="font-medium">Thailand</div>
                  <div className="text-sm text-gray-600">Test country metadata</div>
                </Link>
                <Link href="/vietnam" className="block p-3 border border-gray-200 rounded hover:bg-gray-50">
                  <div className="font-medium">Vietnam</div>
                  <div className="text-sm text-gray-600">Test country metadata</div>
                </Link>
              </div>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-900 mb-2">City Pages</h3>
              <div className="space-y-2">
                <Link href="/thailand/bangkok" className="block p-3 border border-gray-200 rounded hover:bg-gray-50">
                  <div className="font-medium">Bangkok, Thailand</div>
                  <div className="text-sm text-gray-600">Test city metadata</div>
                </Link>
                <Link href="/vietnam/hanoi" className="block p-3 border border-gray-200 rounded hover:bg-gray-50">
                  <div className="font-medium">Hanoi, Vietnam</div>
                  <div className="text-sm text-gray-600">Test city metadata</div>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Error Handling Test Links
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">404 Tests</h3>
              <div className="space-y-2">
                <Link href="/nonexistent-country" className="block p-3 border border-red-200 rounded hover:bg-red-50">
                  <div className="font-medium text-red-800">Invalid Country</div>
                  <div className="text-sm text-red-600">Should show 404</div>
                </Link>
                <Link href="/thailand/nonexistent-city" className="block p-3 border border-red-200 rounded hover:bg-red-50">
                  <div className="font-medium text-red-800">Invalid City</div>
                  <div className="text-sm text-red-600">Should show 404</div>
                </Link>
                <Link href="/admin/test" className="block p-3 border border-red-200 rounded hover:bg-red-50">
                  <div className="font-medium text-red-800">Reserved Route</div>
                  <div className="text-sm text-red-600">Should show 404</div>
                </Link>
              </div>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Empty State Tests</h3>
              <div className="space-y-2">
                <Link href="/country-with-no-shops" className="block p-3 border border-yellow-200 rounded hover:bg-yellow-50">
                  <div className="font-medium text-yellow-800">No Shops Country</div>
                  <div className="text-sm text-yellow-600">Test empty state</div>
                </Link>
                <Link href="/thailand/city-with-no-shops" className="block p-3 border border-yellow-200 rounded hover:bg-yellow-50">
                  <div className="font-medium text-yellow-800">No Shops City</div>
                  <div className="text-sm text-yellow-600">Test empty state</div>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link 
            href="/"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  )
}