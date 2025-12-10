'use client'

import { ContentSection } from '@/types'
import ContentSectionCard from './ContentSectionCard'

interface ContentSectionsContainerProps {
  sections: ContentSection[]
}

export default function ContentSectionsContainer({ sections }: ContentSectionsContainerProps) {
  // Don't render anything if no sections
  if (!sections || sections.length === 0) {
    return null
  }

  // Sort sections by order (ascending)
  const sortedSections = [...sections].sort((a, b) => a.order - b.order)

  return (
    <div className="w-full mb-8">
      <div className="space-y-4">
        {sortedSections.map((section) => (
          <ContentSectionCard key={section.id} section={section} />
        ))}
      </div>
    </div>
  )
}

