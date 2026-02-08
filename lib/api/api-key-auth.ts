/**
 * API Key Authentication
 * 
 * Simple API key validation using environment variables.
 * - MCP_KEY_READ_ONLY: Read-only access (GET endpoints only)
 * - MCP_KEY_ADMIN: Full access (all HTTP methods)
 */

export type ApiKeyType = 'public' | 'admin' | null;

/**
 * Validate an API key against environment variables
 * @param key The API key from the Authorization header
 * @returns 'admin' | 'public' | null
 */
export function validateApiKey(key: string | null): ApiKeyType {
    if (!key) return null;

    // Check admin key first (more privileges)
    if (process.env.MCP_KEY_ADMIN && key === process.env.MCP_KEY_ADMIN) {
        return 'admin';
    }

    // Check public (read-only) key
    if (process.env.MCP_KEY_READ_ONLY && key === process.env.MCP_KEY_READ_ONLY) {
        return 'public';
    }

    return null;
}

/**
 * Check if an API key type has permission for a given operation
 * @param keyType The type of API key
 * @param requiresWrite Whether the operation requires write access
 * @returns true if permitted
 */
export function hasApiKeyPermission(keyType: ApiKeyType, requiresWrite: boolean): boolean {
    if (!keyType) return false;
    if (keyType === 'admin') return true;
    if (keyType === 'public' && !requiresWrite) return true;
    return false;
}
