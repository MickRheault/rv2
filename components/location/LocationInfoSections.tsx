'use client'

import { useState } from 'react'
import { Card } from '@/components/ui'

interface InfoSection {
  id: string
  title: string
  content: string
}

interface LocationInfoSectionsProps {
  locationName: string
  locationType: 'country' | 'city'
}

export default function LocationInfoSections({ locationName, locationType }: LocationInfoSectionsProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  // Generate sections based on location type
  const sections: InfoSection[] = [
    {
      id: 'why-ride',
      title: `Why ride a motorcycle in ${locationName}?`,
      content: `Discover the freedom and adventure of exploring ${locationName} on two wheels. Experience breathtaking landscapes, authentic local culture, and unforgettable roads that are best enjoyed from the seat of a motorcycle.`
    },
    {
      id: 'requirements',
      title: 'Rental requirements & licenses',
      content: `Learn about the necessary documents, licenses, and requirements for renting a motorcycle in ${locationName}. Make sure you're properly prepared before your adventure begins.`
    },
    {
      id: 'routes',
      title: locationType === 'city' 
        ? `Top motorcycle routes from ${locationName}`
        : `Top motorcycle routes in ${locationName}`,
      content: `Explore the most scenic and exciting motorcycle routes ${locationType === 'city' ? 'departing from' : 'in'} ${locationName}. From coastal highways to mountain passes, discover the best riding experiences.`
    },
    {
      id: 'best-time',
      title: 'Best time to visit',
      content: `Find out the optimal seasons and weather conditions for motorcycle touring in ${locationName}. Plan your trip for the best riding experience.`
    }
  ]

  const toggleSection = (sectionId: string) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId)
  }

  return (
    <div className="mt-12 space-y-4">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        Motorcycle Travel Guide for {locationName}
      </h2>
      
      {sections.map((section) => (
        <Card
          key={section.id}
          padding="none"
          className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => toggleSection(section.id)}
        >
          <div className="p-6 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              {section.title}
            </h3>
            <button
              className="text-blue-600 hover:text-blue-700 font-medium text-sm transition-colors"
              aria-label={expandedSection === section.id ? 'Collapse section' : 'Expand section'}
            >
              {expandedSection === section.id ? 'Close' : 'Read more'}
            </button>
          </div>
          
          {expandedSection === section.id && (
            <div className="px-6 pb-6 pt-0">
              <div className="border-t border-gray-200 pt-4">
                <p className="text-gray-600 leading-relaxed">
                  {section.content}
                </p>
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}

