import type { KeyboardEvent } from 'react'

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

export function submitFormOnEnter(
  e: KeyboardEvent<HTMLTextAreaElement>,
  form: HTMLFormElement | null
): void {
  if (e.key === 'Enter' && !e.shiftKey && !isImeComposing(e)) {
    e.preventDefault()
    form?.requestSubmit()
  }
}
