'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { SparklesIcon, MapPinIcon } from '@heroicons/react/24/outline'
import HeroSearchForm from './HeroSearchForm'
import { SUGGESTION_PROMPTS } from '@/lib/chat/suggestions'
import { submitFormOnEnter } from '@/lib/chat/keyboard'

type DiscoveryTab = 'ai' | 'location'

const DISCOVERY_TABS: {
  id: DiscoveryTab
  tabId: string
  panelId: string
  label: string
  Icon: typeof SparklesIcon
}[] = [
  {
    id: 'ai',
    tabId: 'hero-tab-ai',
    panelId: 'hero-panel-ai',
    label: 'Ask AI',
    Icon: SparklesIcon,
  },
  {
    id: 'location',
    tabId: 'hero-tab-location',
    panelId: 'hero-panel-location',
    label: 'Search by Location',
    Icon: MapPinIcon,
  },
]

export default function HeroDiscoveryCard() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<DiscoveryTab>('ai')
  const [prompt, setPrompt] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  const navigateToAiChat = (rawQuery: string) => {
    const trimmed = rawQuery.trim()
    if (!trimmed) return
    router.push(`/ai-chat?q=${encodeURIComponent(trimmed)}`)
  }

  const handleAiSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    navigateToAiChat(prompt)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    submitFormOnEnter(e, formRef.current)
  }

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 sm:p-6 shadow-lg max-w-4xl mx-auto text-left">
      {/* Segmented Switcher */}
      <div
        role="tablist"
        aria-label="Discovery mode"
        className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-xl mb-5 max-w-md mx-auto"
      >
        {DISCOVERY_TABS.map(({ id, tabId, panelId, label, Icon }) => {
          const isSelected = activeTab === id
          return (
            <button
              key={id}
              id={tabId}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls={panelId}
              onClick={() => setActiveTab(id)}
              className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                isSelected
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{label}</span>
            </button>
          )
        })}
      </div>

      {/* Ask AI Panel */}
      {activeTab === 'ai' ? (
        <div
          id="hero-panel-ai"
          role="tabpanel"
          aria-labelledby="hero-tab-ai"
          className="space-y-4"
        >
          <form ref={formRef} onSubmit={handleAiSubmit} className="space-y-3">
            <label htmlFor="hero-ai-prompt" className="sr-only">
              Ask about motorcycles, shops, or locations...
            </label>
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
              <textarea
                id="hero-ai-prompt"
                rows={2}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about motorcycles, shops, or locations..."
                className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all resize-none text-base leading-normal"
              />
              <button
                type="submit"
                disabled={!prompt.trim()}
                className="px-6 py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shrink-0 cursor-pointer"
              >
                <SparklesIcon className="w-5 h-5" />
                <span>Ask AI</span>
              </button>
            </div>
          </form>

          <div className="space-y-2 pt-1">
            <p className="text-xs font-medium text-gray-500">Try asking:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTION_PROMPTS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => navigateToAiChat(suggestion)}
                  className="text-xs sm:text-sm bg-gray-50 hover:bg-blue-50 text-gray-700 hover:text-blue-700 border border-gray-200 hover:border-blue-300 px-3 py-1.5 rounded-full transition-colors cursor-pointer"
                >
                  &quot;{suggestion}&quot;
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div
          id="hero-panel-location"
          role="tabpanel"
          aria-labelledby="hero-tab-location"
        >
          <HeroSearchForm embedded />
        </div>
      )}
    </div>
  )
}
