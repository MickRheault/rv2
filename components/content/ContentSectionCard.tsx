'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { ContentSection } from '@/types'

interface ContentSectionCardProps {
  section: ContentSection
}

export default function ContentSectionCard({ section }: ContentSectionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      {/* Header - Always Visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors duration-200"
        aria-expanded={isExpanded}
        aria-controls={`section-content-${section.id}`}
      >
        <h2 className="text-lg font-semibold text-gray-900 text-left break-words pr-4">
          {section.title}
        </h2>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-sm text-blue-600 font-medium">
            {isExpanded ? 'Hide' : 'Read more'}
          </span>
          <ChevronDownIcon 
            className={`h-5 w-5 text-blue-600 transition-transform duration-300 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {/* Content - Expandable */}
      <div
        id={`section-content-${section.id}`}
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? 'max-h-[10000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-6 py-4 border-t border-gray-200">
          <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900 prose-ul:text-gray-700 prose-ol:text-gray-700 prose-li:text-gray-700 prose-img:rounded-lg prose-img:shadow-md">
            <ReactMarkdown
              rehypePlugins={[rehypeSanitize]}
              components={{
                // Make external links open in new tab
                a: ({ node, ...props }) => {
                  const href = props.href || ''
                  const isExternal = href.startsWith('http://') || href.startsWith('https://')
                  return (
                    <a
                      {...props}
                      target={isExternal ? '_blank' : undefined}
                      rel={isExternal ? 'noopener noreferrer' : undefined}
                    />
                  )
                },
                // Make images responsive
                img: ({ node, ...props }) => (
                  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
                  <img
                    {...props}
                    alt={props.alt || ''}
                    className="max-w-full h-auto"
                    loading="lazy"
                  />
                )
              }}
            >
              {section.content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  )
}

