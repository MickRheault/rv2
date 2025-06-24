'use client'

import { useEffect, useState, Suspense } from 'react'
import { useURLParams, useURLFilters, useURLPagination } from '@/hooks/useURLParams'
import { useSearchStore } from '@/lib/stores/searchStore'
import { generateShareableURL, createSearchURL } from '@/lib/utils/urlParams'
import { SearchFilters } from '@/types'

function TestURLParamsContent() {
  const { filters, setFilters, resetFilters } = useSearchStore()
  const [shareableURL, setShareableURL] = useState<string>('')
  const [testResults, setTestResults] = useState<string[]>([])
  const [currentURL, setCurrentURL] = useState<string>('Loading...')
  
  // URL parameter management
  const urlParams = useURLParams({
    debounceMs: 300,
    onParamsChange: (newFilters) => {
      addTestResult(`URL params changed: ${JSON.stringify(newFilters)}`)
    }
  })
  
  // Read-only URL filters
  const urlFilters = useURLFilters()
  
  // Pagination management
  const pagination = useURLPagination()

  // Update current URL on client side only
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentURL(window.location.href)
    }
  }, [urlParams.urlParams, pagination.page])

  // Update shareable URL when filters change
  useEffect(() => {
    const shareURL = generateShareableURL(filters)
    setShareableURL(shareURL)
  }, [filters])

  // Debug: Log when filters change
  useEffect(() => {
    addTestResult(`Filters changed: ${JSON.stringify(filters)}`)
  }, [filters])

  const addTestResult = (message: string) => {
    setTestResults(prev => [`${new Date().toLocaleTimeString()}: ${message}`, ...prev.slice(0, 9)])
  }

  // Test scenarios
  const testScenarios = [
    {
      name: 'Basic Location Search',
      filters: {
        location: { id: 'bangkok', name: 'Bangkok', type: 'city' as const },
        sortBy: 'price_asc' as const
      }
    },
    {
      name: 'Advanced Filtering',
      filters: {
        location: { id: 'thailand', name: 'Thailand', type: 'country' as const },
        brand: 'Honda',
        category: 'Scooter',
        priceRange: { min: 20, max: 100 },
        features: ['ABS', 'GPS'],
        sortBy: 'rating' as const
      }
    },
    {
      name: 'Price Range Only',
      filters: {
        priceRange: { min: 50, max: 200 },
        sortBy: 'price_desc' as const
      }
    },
    {
      name: 'Multiple Features',
      filters: {
        features: ['ABS', 'GPS', 'Bluetooth', 'USB_Charging'],
        category: 'Adventure',
        sortBy: 'newest' as const
      }
    }
  ]

  const runTestScenario = (scenario: typeof testScenarios[0]) => {
    addTestResult(`Running test: ${scenario.name}`)
    addTestResult(`Setting filters: ${JSON.stringify(scenario.filters)}`)
    setFilters(scenario.filters)
    
    // Also manually trigger URL sync as a backup
    setTimeout(() => {
      urlParams.syncToURL()
      addTestResult(`Manual URL sync triggered`)
    }, 100)
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">🔗 URL Parameter Test</h1>
      
      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4 text-blue-800">🧪 How to Test</h2>
        <div className="space-y-2 text-blue-700">
          <p><strong>1. Apply Test Scenarios:</strong> Click buttons below to set different search filters</p>
          <p><strong>2. Watch URL Change:</strong> Notice how the URL updates automatically with your selections</p>
          <p><strong>3. Copy & Share URL:</strong> Copy the URL and open in new tab - filters should be preserved</p>
          <p><strong>4. Browser Navigation:</strong> Use back/forward buttons - filters should change accordingly</p>
          <p><strong>5. Manual URL Edit:</strong> Edit URL parameters directly and refresh - state should sync</p>
        </div>
      </div>

      {/* Current State */}
      <div className="bg-white border rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Current State</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <strong>Has URL Params:</strong> {urlParams.isClient ? (urlParams.hasParams ? 'Yes' : 'No') : 'Loading...'}
          </div>
          <div>
            <strong>Current Page:</strong> {pagination.isClient ? pagination.page : 'Loading...'}
          </div>
          <div>
            <strong>Filters Applied:</strong> {Object.keys(filters).length}
          </div>
        </div>
        
        <div className="mb-4">
          <strong>Current URL:</strong>
          <div className="bg-gray-50 p-2 rounded border font-mono text-xs break-all">
            {currentURL}
          </div>
        </div>

        <div>
          <strong>Current Filters:</strong>
          <div className="bg-gray-50 p-3 rounded border mt-2">
            <pre className="text-xs overflow-x-auto">{JSON.stringify(filters, null, 2)}</pre>
          </div>
        </div>
      </div>

      {/* Test Scenarios */}
      <div className="bg-white border rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Test Scenarios</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {testScenarios.map((scenario, index) => (
            <div key={index} className="border rounded-lg p-4">
              <h3 className="font-semibold mb-2">{scenario.name}</h3>
              <div className="text-sm text-gray-600 mb-3">
                <pre className="text-xs">{JSON.stringify(scenario.filters, null, 1)}</pre>
              </div>
              <button
                onClick={() => runTestScenario(scenario)}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 mr-2"
              >
                Apply Scenario
              </button>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="border-t pt-4">
          <h3 className="font-semibold mb-3">Quick Actions</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => resetFilters()}
              className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
            >
              Clear All Filters
            </button>
            <button
              onClick={() => urlParams.clearURLParams()}
              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
            >
              Clear URL Params
            </button>
            <button
              onClick={() => pagination.setPage(Math.floor(Math.random() * 5) + 1)}
              className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
            >
              Random Page
            </button>
            <button
              onClick={() => {
                const url = urlParams.getURLWithFilters(filters)
                navigator.clipboard.writeText(window.location.origin + url)
                addTestResult('URL copied to clipboard!')
              }}
              className="px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm"
            >
              Copy Shareable URL
            </button>
          </div>
        </div>
      </div>

      {/* Test Results */}
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Test Results</h2>
        
        <div className="bg-black text-green-400 p-4 rounded font-mono text-sm max-h-64 overflow-y-auto">
          {testResults.length === 0 ? (
            <div className="text-gray-500">No test results yet.</div>
          ) : (
            testResults.map((result, index) => (
              <div key={index}>{result}</div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default function TestURLParamsPage() {
  return (
    <Suspense fallback={<div className="container mx-auto p-6">Loading URL parameter test...</div>}>
      <TestURLParamsContent />
    </Suspense>
  )
} 