'use client'

import { useState } from 'react'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import Button from '@/components/ui/Button'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'

// Test component that throws an error when clicked
function ErrorButton({ type }: { type: string }) {
  const [shouldError, setShouldError] = useState(false)
  
  if (shouldError) {
    throw new Error(`${type} component error - This is a test error!`)
  }
  
  return (
    <div className="p-4 border border-gray-200 rounded-lg">
      <h4 className="font-medium text-gray-900 mb-2">{type} Component</h4>
      <p className="text-sm text-gray-600 mb-3">
        Click the button below to trigger a {type.toLowerCase()} error
      </p>
      <Button 
        variant="danger" 
        size="sm"
        onClick={() => setShouldError(true)}
      >
        Break {type}
      </Button>
    </div>
  )
}

// Component that throws an async error
function AsyncErrorButton() {
  const triggerAsyncError = () => {
    setTimeout(() => {
      throw new Error('Async error - This error happens after 1 second!')
    }, 1000)
  }
  
  const triggerPromiseError = () => {
    Promise.reject(new Error('Promise rejection - This is an unhandled promise rejection!'))
  }
  
  return (
    <div className="p-4 border border-gray-200 rounded-lg">
      <h4 className="font-medium text-gray-900 mb-2">Async Errors</h4>
      <p className="text-sm text-gray-600 mb-3">
        These errors will be caught by global error handlers
      </p>
      <div className="space-y-2">
        <Button 
          variant="danger" 
          size="sm"
          onClick={triggerAsyncError}
          className="w-full"
        >
          Async Error (1s delay)
        </Button>
        <Button 
          variant="danger" 
          size="sm"
          onClick={triggerPromiseError}
          className="w-full"
        >
          Promise Rejection
        </Button>
      </div>
    </div>
  )
}

// Component that triggers resource errors
function ResourceErrorButton() {
  const triggerResourceError = () => {
    // Create a fake image element with broken src
    const img = document.createElement('img')
    img.src = 'https://broken-url-that-does-not-exist.com/image.jpg'
    document.body.appendChild(img)
    
    // Remove it after a second
    setTimeout(() => {
      document.body.removeChild(img)
    }, 1000)
  }
  
  return (
    <div className="p-4 border border-gray-200 rounded-lg">
      <h4 className="font-medium text-gray-900 mb-2">Resource Error</h4>
      <p className="text-sm text-gray-600 mb-3">
        This will trigger a resource loading error
      </p>
      <Button 
        variant="danger" 
        size="sm"
        onClick={triggerResourceError}
        className="w-full"
      >
        Trigger Resource Error
      </Button>
    </div>
  )
}

export default function TestErrorsPage() {
  const [pageError, setPageError] = useState(false)
  
  // This will trigger the page-level error boundary
  if (pageError) {
    throw new Error('Page-level error - This error crashes the entire page!')
  }
  
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Error Testing Dashboard</h1>
          <p className="text-gray-600">
            Use this page to test different types of errors and see how they&apos;re handled.
            <br />
            <strong>Open your browser DevTools (F12) and check the Console tab to see error logs!</strong>
          </p>
        </div>

        {/* Page Level Error */}
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-xl font-semibold text-red-600">⚠️ Page Level Error</h2>
            <p className="text-gray-600">This will crash the entire page and show the error page</p>
          </CardHeader>
          <CardContent>
            <Button 
              variant="danger"
              onClick={() => setPageError(true)}
            >
              💥 Crash Entire Page
            </Button>
          </CardContent>
        </Card>

        {/* Component Level Errors */}
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-xl font-semibold">🔧 Component Level Errors</h2>
            <p className="text-gray-600">These errors are caught by individual error boundaries</p>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <ErrorBoundary level="component" name="Test Component A">
                <ErrorButton type="Component A" />
              </ErrorBoundary>
              
              <ErrorBoundary level="component" name="Test Component B">
                <ErrorButton type="Component B" />
              </ErrorBoundary>
            </div>
          </CardContent>
        </Card>

        {/* Section Level Error */}
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-xl font-semibold">📋 Section Level Error</h2>
            <p className="text-gray-600">This error affects a larger section but not the whole page</p>
          </CardHeader>
          <CardContent>
            <ErrorBoundary level="section" name="Test Section">
              <div className="grid md:grid-cols-3 gap-4">
                <ErrorButton type="Section Item 1" />
                <ErrorButton type="Section Item 2" />
                <ErrorButton type="Section Item 3" />
              </div>
            </ErrorBoundary>
          </CardContent>
        </Card>

        {/* Global Errors */}
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-xl font-semibold">🌐 Global Errors</h2>
            <p className="text-gray-600">These errors are caught by global error handlers</p>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <AsyncErrorButton />
              <ResourceErrorButton />
            </div>
          </CardContent>
        </Card>

        {/* Testing Instructions */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <h2 className="text-xl font-semibold text-blue-800">📋 How to Test</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <div>
                <h3 className="font-medium text-blue-800 mb-2">1. Open Browser DevTools</h3>
                <p className="text-blue-700">Press F12 or right-click → &quot;Inspect&quot; → Go to &quot;Console&quot; tab</p>
              </div>
              
              <div>
                <h3 className="font-medium text-blue-800 mb-2">2. Test Error Boundaries</h3>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li>Click &quot;Break Component A&quot; - see component-level error UI</li>
                  <li>Click &quot;Break Section Item 1&quot; - see section-level error UI</li>
                  <li>Click &quot;💥 Crash Entire Page&quot; - see page-level error page</li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-medium text-blue-800 mb-2">3. Test Global Error Handlers</h3>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li>Click &quot;Async Error&quot; - check console for error log</li>
                  <li>Click &quot;Promise Rejection&quot; - check console for promise rejection</li>
                  <li>Click &quot;Resource Error&quot; - check console for resource loading error</li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-medium text-blue-800 mb-2">4. Check Error Storage</h3>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li>DevTools → Application tab → Local Storage → rv_error_logs</li>
                  <li>See all errors logged with timestamps and details</li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-medium text-blue-800 mb-2">5. Test Retry Functionality</h3>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li>After breaking a component, click the &quot;Retry&quot; button</li>
                  <li>The component should reset and work normally again</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}