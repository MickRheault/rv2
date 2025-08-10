'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import locationService from '@/services/locations'

interface Country {
  code: string
  name: string
}

interface City {
  id: string
  name: string
  fullName: string
  countryCode: string
}

export default function HeroSearchForm() {
  const router = useRouter()
  const [countries, setCountries] = useState<Country[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [selectedCountry, setSelectedCountry] = useState('')
  const [selectedCity, setSelectedCity] = useState('')
  const [loading, setLoading] = useState(true)
  const countrySelectId = 'hero-country'
  const citySelectId = 'hero-city'

  useEffect(() => {
    const loadData = async () => {
      try {
        const [countriesData, locationsData] = await Promise.all([
          locationService.getCountries(),
          locationService.getLocationsWithShops()
        ])
        
        setCountries(countriesData)
        
        // Extract all cities from locations data with country mapping
        const allCities = Object.values(locationsData)
          .flatMap(countryData => 
            Object.values(countryData.provinces || {})
              .flatMap(province => province.cities || [])
              .map(city => ({
                id: city.id,
                name: city.name,
                fullName: city.name,
                countryCode: countryData.country.code
              }))
          )
          .sort((a, b) => a.name.localeCompare(b.name))
        
        setCities(allCities)
      } catch (error) {
        console.error('Error loading search data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const handleCountryChange = (countryCode: string) => {
    setSelectedCountry(countryCode)
    // If a city is selected but doesn't belong to the new country, clear it
    if (selectedCity) {
      const selectedCityData = cities.find(city => city.id === selectedCity)
      if (selectedCityData && selectedCityData.countryCode !== countryCode) {
        setSelectedCity('')
      }
    }
  }

  const handleCityChange = (cityId: string) => {
    setSelectedCity(cityId)
    // If a city is selected, automatically set the country
    if (cityId) {
      const selectedCityData = cities.find(city => city.id === cityId)
      if (selectedCityData && selectedCityData.countryCode !== selectedCountry) {
        setSelectedCountry(selectedCityData.countryCode)
      }
    }
  }

  const handleSearch = () => {
    // If both country and city are selected, go to the specific city page
    if (selectedCountry && selectedCity) {
      const selectedCountryData = countries.find(c => c.code === selectedCountry)
      const selectedCityData = cities.find(c => c.id === selectedCity)
      
      if (selectedCountryData && selectedCityData) {
        const countrySlug = selectedCountryData.name.toLowerCase().replace(/\s+/g, '-')
        const citySlug = selectedCityData.name.toLowerCase().replace(/\s+/g, '-')
        
        const url = `/${countrySlug}/${citySlug}`
        router.push(url)
        return
      }
    }
    
    // If only country is selected, go to the country page
    if (selectedCountry && !selectedCity) {
      const selectedCountryData = countries.find(c => c.code === selectedCountry)
      
      if (selectedCountryData) {
        const countrySlug = selectedCountryData.name.toLowerCase().replace(/\s+/g, '-')
        const url = `/${countrySlug}`
        router.push(url)
        return
      }
    }
    
    // Fallback to search page with all parameters
    const searchParams = new URLSearchParams()
    
    if (selectedCountry) {
      searchParams.set('countryCode', selectedCountry)
    }
    if (selectedCity) {
      searchParams.set('cityId', selectedCity)
    }

    router.push(`/search?${searchParams.toString()}`)
  }

  if (loading) {
    return (
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 sm:p-6 shadow-lg max-w-4xl mx-auto">
        <div className="animate-pulse">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-16"></div>
              <div className="h-12 bg-gray-200 rounded-lg"></div>
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-12"></div>
              <div className="h-12 bg-gray-200 rounded-lg"></div>
            </div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-1">
              <div className="h-4 bg-gray-200 rounded w-14"></div>
              <div className="h-12 bg-gray-200 rounded-lg"></div>
            </div>
          </div>
          <div className="pt-2">
            <div className="h-14 bg-gray-200 rounded-xl w-full sm:w-48"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 sm:p-6 shadow-lg max-w-4xl mx-auto">
      <div className="flex flex-col gap-4">
        {/* Mobile: Stack all fields vertically, Desktop: Row layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor={countrySelectId} className="block text-sm font-medium text-gray-700">
              Country
            </label>
            <select
              id={countrySelectId}
              value={selectedCountry}
              onChange={(e) => handleCountryChange(e.target.value)}
              className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white appearance-none"
            >
              <option value="">Select Country</option>
              {countries.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor={citySelectId} className="block text-sm font-medium text-gray-700">
              City
            </label>
            <select
              id={citySelectId}
              value={selectedCity}
              onChange={(e) => handleCityChange(e.target.value)}
              className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white appearance-none"
            >
              <option value="">Select City</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Button - Full width on mobile, centered on desktop */}
        <div className="pt-2">
          <button
            onClick={handleSearch}
            className="w-full sm:w-auto sm:min-w-[200px] px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold text-lg rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl focus:ring-4 focus:ring-blue-300 focus:outline-none"
          >
            Search Motorcycles
          </button>
        </div>
      </div>
    </div>
  )
}