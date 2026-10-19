const INTERNAL_CHAT_PATH_PREFIXES = ['/motorcycle/', '/shop/'] as const

/**
 * Normalize internal GMR listing links (/motorcycle/... and /shop/...) to relative paths
 * even if the LLM prepends an external or hallucinated domain (e.g. https://www.globalmoto.com).
 */
export function normalizeChatHref(href?: string): string | undefined {
  if (!href) return href
  const trimmed = href.trim()
  if (trimmed.startsWith('/')) return trimmed

  try {
    const parsed = new URL(trimmed)
    if (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      INTERNAL_CHAT_PATH_PREFIXES.some(
        prefix => parsed.pathname === prefix.slice(0, -1) || parsed.pathname.startsWith(prefix)
      )
    ) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`
    }
  } catch {
    // Non-URL strings are returned as-is
  }

  return href
}
