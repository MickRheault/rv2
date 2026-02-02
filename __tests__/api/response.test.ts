/**
 * @jest-environment node
 */
import {
    successResponse,
    errorResponse,
    errors,
    parsePaginationParams,
    parseSortParams
} from '@/lib/api/response';
import {
    checkRateLimit,
    getRateLimitHeaders
} from '@/lib/api/rate-limit';

describe('API Response Helpers', () => {
    describe('successResponse', () => {
        it('should create a success response with data', async () => {
            const data = { id: '123', name: 'Test' };
            const response = successResponse(data);
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data).toEqual(data);
        });

        it('should include meta when provided', async () => {
            const data = [{ id: '1' }, { id: '2' }];
            const meta = { total: 100, limit: 20, offset: 0 };
            const response = successResponse(data, meta);
            const body = await response.json();

            expect(body.meta).toEqual(meta);
        });

        it('should allow custom status code', async () => {
            const response = successResponse({ created: true }, undefined, 201);
            expect(response.status).toBe(201);
        });
    });

    describe('errorResponse', () => {
        it('should create an error response', async () => {
            const response = errorResponse('TEST_ERROR', 'Test error message', 400);
            const body = await response.json();

            expect(response.status).toBe(400);
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('TEST_ERROR');
            expect(body.error.message).toBe('Test error message');
        });

        it('should include details when provided', async () => {
            const details = { field: ['Error 1', 'Error 2'] };
            const response = errorResponse('VALIDATION', 'Validation error', 400, details);
            const body = await response.json();

            expect(body.error.details).toEqual(details);
        });
    });

    describe('errors helper', () => {
        it('should return 401 for unauthorized', async () => {
            const response = errors.unauthorized();
            expect(response.status).toBe(401);
        });

        it('should return 403 for forbidden', async () => {
            const response = errors.forbidden();
            expect(response.status).toBe(403);
        });

        it('should return 404 for notFound', async () => {
            const response = errors.notFound('Motorcycle');
            const body = await response.json();
            expect(response.status).toBe(404);
            expect(body.error.message).toContain('Motorcycle');
        });

        it('should return 429 for rateLimited', async () => {
            const response = errors.rateLimited();
            expect(response.status).toBe(429);
        });

        it('should return 500 for internal', async () => {
            const response = errors.internal();
            expect(response.status).toBe(500);
        });
    });

    describe('parsePaginationParams', () => {
        it('should parse limit and offset from query params', () => {
            const params = new URLSearchParams('limit=50&offset=100');
            const result = parsePaginationParams(params);

            expect(result.limit).toBe(50);
            expect(result.offset).toBe(100);
        });

        it('should use defaults when not provided', () => {
            const params = new URLSearchParams();
            const result = parsePaginationParams(params);

            expect(result.limit).toBe(20);
            expect(result.offset).toBe(0);
            expect(result.page).toBe(1);
        });

        it('should cap limit at 100', () => {
            const params = new URLSearchParams('limit=500');
            const result = parsePaginationParams(params);

            expect(result.limit).toBe(100);
        });

        it('should enforce minimum limit of 1', () => {
            const params = new URLSearchParams('limit=0');
            const result = parsePaginationParams(params);

            expect(result.limit).toBe(1);
        });

        it('should calculate offset from page', () => {
            const params = new URLSearchParams('page=3&limit=10');
            const result = parsePaginationParams(params);

            expect(result.offset).toBe(20);
        });
    });

    describe('parseSortParams', () => {
        it('should parse valid sort params', () => {
            const params = new URLSearchParams('sortBy=price_asc&sortOrder=asc');
            const result = parseSortParams(
                params,
                ['price_asc', 'price_desc', 'newest'] as const,
                'newest'
            );

            expect(result.sortBy).toBe('price_asc');
            expect(result.sortOrder).toBe('asc');
        });

        it('should use defaults for invalid sortBy', () => {
            const params = new URLSearchParams('sortBy=invalid');
            const result = parseSortParams(
                params,
                ['price_asc', 'newest'] as const,
                'newest'
            );

            expect(result.sortBy).toBe('newest');
        });

        it('should use default order when not provided', () => {
            const params = new URLSearchParams();
            const result = parseSortParams(
                params,
                ['newest'] as const,
                'newest',
                'desc'
            );

            expect(result.sortOrder).toBe('desc');
        });
    });
});

describe('Rate Limiting', () => {
    describe('checkRateLimit', () => {
        it('should allow requests within limit', () => {
            const uniqueKey = `test-${Date.now()}-${Math.random()}`;
            const result = checkRateLimit(uniqueKey, 100, 60000);

            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(99);
        });

        it('should track request count', () => {
            const uniqueKey = `test-${Date.now()}-${Math.random()}`;

            checkRateLimit(uniqueKey, 100, 60000);
            checkRateLimit(uniqueKey, 100, 60000);
            const result = checkRateLimit(uniqueKey, 100, 60000);

            expect(result.remaining).toBe(97);
        });

        it('should block when limit exceeded', () => {
            const uniqueKey = `test-${Date.now()}-${Math.random()}`;

            // Exhaust the limit
            for (let i = 0; i < 5; i++) {
                checkRateLimit(uniqueKey, 5, 60000);
            }

            const result = checkRateLimit(uniqueKey, 5, 60000);
            expect(result.allowed).toBe(false);
            expect(result.remaining).toBe(0);
        });
    });

    describe('getRateLimitHeaders', () => {
        it('should return correct headers', () => {
            const headers = getRateLimitHeaders(50, Date.now() + 60000, 100);

            expect(headers['X-RateLimit-Limit']).toBe('100');
            expect(headers['X-RateLimit-Remaining']).toBe('50');
            expect(headers['X-RateLimit-Reset']).toBeDefined();
        });
    });
});
