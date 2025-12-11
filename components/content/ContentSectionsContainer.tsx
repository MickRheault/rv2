'use client'

import { useState, useRef, useCallback, useImperativeHandle, forwardRef } from 'react'
import { ContentSection } from '@/types'
import ContentSectionCard from './ContentSectionCard'

interface ContentSectionsContainerProps {
  sections: ContentSection[]
}

export interface ContentSectionsContainerRef {
  scrollToAndExpand: (sectionId: string) => void
}

const ContentSectionsContainer = forwardRef<ContentSectionsContainerRef, ContentSectionsContainerProps>(
  function ContentSectionsContainer({ sections }, ref) {
    // Track which sections are expanded
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
    
    // Store refs for each section card
    const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

    // Toggle a section's expanded state
    const toggleSection = useCallback((sectionId: string) => {
      setExpandedSections(prev => ({
        ...prev,
        [sectionId]: !prev[sectionId]
      }))
    }, [])

    // Scroll to a section and expand it
    const scrollToAndExpand = useCallback((sectionId: string) => {
      // First expand the section
      setExpandedSections(prev => ({
        ...prev,
        [sectionId]: true
      }))

      // Then scroll to it with a small delay to allow the DOM to update
      setTimeout(() => {
        const element = sectionRefs.current[sectionId]
        if (element) {
          // Account for sticky header (h-16 = 64px) plus some padding
          const headerOffset = 80
          const elementPosition = element.getBoundingClientRect().top
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset

          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          })
        }
      }, 150)
    }, [])

    // Expose the scrollToAndExpand method via ref
    useImperativeHandle(ref, () => ({
      scrollToAndExpand
    }), [scrollToAndExpand])

    // Don't render anything if no sections
    if (!sections || sections.length === 0) {
      return null
    }

    // Sort sections by order (ascending)
    const sortedSections = [...sections].sort((a, b) => a.order - b.order)

    return (
      <div className="w-full mt-12 mb-8">
        <div className="space-y-4">
          {sortedSections.map((section) => (
            <ContentSectionCard
              key={section.id}
              ref={(el) => { sectionRefs.current[section.id] = el }}
              section={section}
              isExpanded={!!expandedSections[section.id]}
              onToggle={() => toggleSection(section.id)}
            />
          ))}
        </div>
      </div>
    )
  }
)

export default ContentSectionsContainer

