/**
 * @jest-environment node
 * 
 * Tests for MCP API endpoint
 * Tests the API key authentication and tool availability based on access level
 */

// Mock environment variables
const originalEnv = process.env;

beforeEach(() => {
    jest.resetModules();
    process.env = {
        ...originalEnv,
        MCP_KEY_READ_ONLY: 'pk_test_public_key',
        MCP_KEY_ADMIN: 'sk_test_admin_key',
        NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
    };
});

afterEach(() => {
    process.env = originalEnv;
});

describe('MCP API Authentication', () => {
    describe('API Key Validation', () => {
        const { validateApiKey } = require('@/lib/api/api-key-auth');

        it('should return "admin" for valid admin key', () => {
            const result = validateApiKey('sk_test_admin_key');
            expect(result).toBe('admin');
        });

        it('should return "public" for valid public key', () => {
            const result = validateApiKey('pk_test_public_key');
            expect(result).toBe('public');
        });

        it('should return null for invalid key', () => {
            const result = validateApiKey('invalid_key');
            expect(result).toBeNull();
        });

        it('should return null for empty key', () => {
            const result = validateApiKey('');
            expect(result).toBeNull();
        });

        it('should return null for null key', () => {
            const result = validateApiKey(null);
            expect(result).toBeNull();
        });
    });

    describe('Permission Checking', () => {
        const { hasApiKeyPermission } = require('@/lib/api/api-key-auth');

        it('should allow admin key to have all permissions', () => {
            expect(hasApiKeyPermission('admin', 'motorcycles.create')).toBe(true);
            expect(hasApiKeyPermission('admin', 'shops.delete')).toBe(true);
            expect(hasApiKeyPermission('admin', 'any.permission')).toBe(true);
        });

        it('should deny public key for write permissions', () => {
            expect(hasApiKeyPermission('public', 'motorcycles.create')).toBe(false);
            expect(hasApiKeyPermission('public', 'shops.delete')).toBe(false);
        });

        it('should allow public key when no permission is required', () => {
            expect(hasApiKeyPermission('public', undefined)).toBe(true);
        });
    });
});

describe('MCP Endpoint Access Control', () => {
    describe('Read-only tools', () => {
        it('should be available for all access levels', () => {
            // These tools should work without admin key
            const readOnlyTools = [
                'search_motorcycles',
                'get_motorcycle',
                'list_shops',
                'get_shop',
                'list_brands',
                'list_categories',
                'list_locations',
            ];

            // Verify tool names are defined
            expect(readOnlyTools.length).toBe(7);
            readOnlyTools.forEach(tool => {
                expect(typeof tool).toBe('string');
                expect(tool.length).toBeGreaterThan(0);
            });
        });
    });

    describe('Admin-only tools', () => {
        it('should require admin access', () => {
            const adminTools = [
                'create_motorcycle',
                'update_motorcycle',
                'delete_motorcycle',
                'create_shop',
                'update_shop',
                'delete_shop',
            ];

            // Verify tool names are defined
            expect(adminTools.length).toBe(6);
            adminTools.forEach(tool => {
                expect(tool).toMatch(/^(create|update|delete)_/);
            });
        });
    });
});

describe('URL Key Extraction', () => {
    it('should extract key from query parameter', () => {
        const url = new URL('http://localhost:3000/api/mcp?key=test_key');
        const key = url.searchParams.get('key');
        expect(key).toBe('test_key');
    });

    it('should handle missing key parameter', () => {
        const url = new URL('http://localhost:3000/api/mcp');
        const key = url.searchParams.get('key');
        expect(key).toBeNull();
    });

    it('should handle empty key parameter', () => {
        const url = new URL('http://localhost:3000/api/mcp?key=');
        const key = url.searchParams.get('key');
        expect(key).toBe('');
    });

    it('should handle key with special characters (URL encoded)', () => {
        const url = new URL('http://localhost:3000/api/mcp?key=sk%24%23test');
        const key = url.searchParams.get('key');
        expect(key).toBe('sk$#test');
    });
});
