/**
 * Agent API Key Authentication
 * 
 * Validates bearer token for external crawler agents (e.g. Hermes)
 * accessing /api/agent/* endpoints.
 */

export function validateAgentApiKey(authHeader: string | null | undefined): boolean {
  if (!authHeader) return false;

  const expectedKey = process.env.AGENT_API_KEY;
  if (!expectedKey || expectedKey.trim() === '') {
    return false;
  }

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.substring(7).trim()
    : authHeader.trim();

  return token === expectedKey.trim();
}
