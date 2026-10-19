import type { KeyboardEvent } from 'react'

export const SUGGESTION_PROMPTS = [
  'Find scooters in Bangkok',
  'List adventure bikes in Chiang Mai',
  'What brands are available?',
  'Show me shops in Phuket',
] as const

export function isImeComposing(e: KeyboardEvent<HTMLTextAreaElement>): boolean {
  const nativeEvent = e.nativeEvent as globalThis.KeyboardEvent & { keyCode?: number }
  const reactEvent = e as KeyboardEvent<HTMLTextAreaElement> & {
    isComposing?: boolean
    keyCode?: number
  }
  return Boolean(
    nativeEvent?.isComposing ||
      reactEvent?.isComposing ||
      nativeEvent?.keyCode === 229 ||
      reactEvent?.keyCode === 229
  )
}
