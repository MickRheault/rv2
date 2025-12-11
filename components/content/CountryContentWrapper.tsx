'use client'

import { useRef, useCallback } from 'react'
import { ContentSection } from '@/types'
import ContentSectionNav from './ContentSectionNav'
import ContentSectionsContainer, { ContentSectionsContainerRef } from './ContentSectionsContainer'

interface CountryContentWrapperProps {
  sections: ContentSection[]
  children: React.ReactNode
}

export default function CountryContentWrapper({ sections, children }: CountryContentWrapperProps) {
  const containerRef = useRef<ContentSectionsContainerRef>(null)

  const handleSectionClick = useCallback((sectionId: string) => {
    containerRef.current?.scrollToAndExpand(sectionId)
  }, [])

  // Don't render nav if no sections
  const hasContent = sections && sections.length > 0

  return (
    <>
      {/* Navigation Pills - Under Hero Banner */}
      {hasContent && (
        <ContentSectionNav 
          sections={sections} 
          onSectionClick={handleSectionClick} 
        />
      )}

      {/* Business Cards (passed as children) */}
      {children}

      {/* Content Sections - After Businesses */}
      {hasContent && (
        <ContentSectionsContainer 
          ref={containerRef} 
          sections={sections} 
        />
      )}
    </>
  )
}
