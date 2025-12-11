'use client'

import { ContentSection } from '@/types'

interface ContentSectionNavProps {
  sections: ContentSection[]
  onSectionClick: (sectionId: string) => void
}

export default function ContentSectionNav({ sections, onSectionClick }: ContentSectionNavProps) {
  // Don't render anything if no sections
  if (!sections || sections.length === 0) {
    return null
  }

  // Sort sections by order (ascending)
  const sortedSections = [...sections].sort((a, b) => a.order - b.order)

  return (
    <div className="w-full mb-6">
      <div className="flex flex-wrap gap-2">
        {sortedSections.map((section) => (
          <button
            key={section.id}
            onClick={() => onSectionClick(section.id)}
            className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-full border border-blue-200 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {section.title}
          </button>
        ))}
      </div>
    </div>
  )
}
