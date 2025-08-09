'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { MapPinIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui'

interface GoogleMapProps {
  latitude?: number | null
  longitude?: number | null
  shopName: string
  address: string
  googleMapsUrl?: string | null
  placeId?: string | null
  className?: string
}

export default function GoogleMap({
  latitude,
  longitude,
  shopName,
  address,
  googleMapsUrl,
  placeId,
  className = ''
}: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState(false)

  // Check if we have valid coordinates
  const hasCoordinates = latitude !== null && longitude !== null && 
                        typeof latitude === 'number' && typeof longitude === 'number'

  const initializeMap = useCallback(() => {
    if (!mapRef.current || !hasCoordinates) return

    try {
      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat: latitude!, lng: longitude! },
        zoom: 15,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      })

      new window.google.maps.Marker({
        position: { lat: latitude!, lng: longitude! },
        map: map,
        title: shopName,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#3B82F6',
          fillOpacity: 1,
          strokeColor: '#1E40AF',
          strokeWeight: 2,
        }
      })

      setMapLoaded(true)
    } catch (error) {
      console.error('Error initializing Google Map:', error)
      setMapError(true)
    }
  }, [hasCoordinates, latitude, longitude, shopName])

  useEffect(() => {
    // Only try to load map if we have coordinates and Google Maps is available
    if (!hasCoordinates || !mapRef.current) {
      return
    }

    // Check if Google Maps API is loaded
    if (typeof window !== 'undefined' && window.google && window.google.maps) {
      initializeMap()
    } else {
      // For now, we'll skip Google Maps API loading to avoid API key requirements
      // In production, you would load the Google Maps API here
      setMapError(true)
    }
  }, [hasCoordinates, initializeMap])

  // Generate Google Maps URL for external link
  const getGoogleMapsLink = () => {
    if (googleMapsUrl) {
      return googleMapsUrl
    }
    
    if (hasCoordinates) {
      return `https://www.google.com/maps?q=${latitude},${longitude}`
    }
    
    // Fallback to address search
    const encodedAddress = encodeURIComponent(`${shopName} ${address}`)
    return `https://www.google.com/maps/search/${encodedAddress}`
  }

  if (!hasCoordinates && !address) {
    return (
      <div className={`bg-gray-100 rounded-lg p-8 text-center ${className}`}>
        <MapPinIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">Location information not available</p>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Map Container */}
      <div className="relative bg-gray-100 rounded-lg overflow-hidden">
        {hasCoordinates && !mapError ? (
          <div
            ref={mapRef}
            className="w-full h-64 md:h-80"
            style={{ minHeight: '256px' }}
          />
        ) : (
          // Fallback when no coordinates or map fails to load
          <div className="w-full h-64 md:h-80 flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
            <div className="text-center">
              <MapPinIcon className="w-16 h-16 text-blue-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{shopName}</h3>
              <p className="text-gray-600 max-w-sm">{address}</p>
            </div>
          </div>
        )}

        {/* Loading overlay */}
        {hasCoordinates && !mapLoaded && !mapError && (
          <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-gray-600">Loading map...</p>
            </div>
          </div>
        )}
      </div>

      {/* Address and Actions */}
      <div className="space-y-3">
        <div>
          <h4 className="font-semibold text-gray-900 mb-1">Address</h4>
          <p className="text-gray-600">{address}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button 
            variant="primary" 
            className="flex items-center gap-2"
            onClick={() => window.open(getGoogleMapsLink(), '_blank')}
          >
            <MapPinIcon className="w-4 h-4" />
            View on Google Maps
            <ArrowTopRightOnSquareIcon className="w-4 h-4" />
          </Button>
          
          {hasCoordinates && (
            <Button 
              variant="outline" 
              className="flex items-center gap-2"
              onClick={() => {
                const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
                window.open(url, '_blank')
              }}
            >
              Get Directions
            </Button>
          )}
        </div>
      </div>

      {/* Coordinates info for debugging (only in development) */}
      {process.env.NODE_ENV === 'development' && hasCoordinates && (
        <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
          Coordinates: {latitude}, {longitude}
          {placeId && <span className="block">Place ID: {placeId}</span>}
        </div>
      )}
    </div>
  )
}

// Type declaration for Google Maps (in a real app, you'd install @types/google.maps)
declare global {
  interface Window {
    google: {
      maps: {
        Map: any
        Marker: any
        SymbolPath: any
      }
    }
  }
} 