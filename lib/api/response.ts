import { NextResponse } from 'next/server';

/**
 * Standard API Response Types
 */
export interface ApiSuccessResponse<T> {
    success: true;
    data: T;
    meta?: {
        total?: number;
        page?: number;
        limit?: number;
        offset?: number;
    };
}

export interface ApiErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        details?: Record<string, string[]>;
    };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Create a success response
 */
export function successResponse<T>(
    data: T,
    meta?: ApiSuccessResponse<T>['meta'],
    status: number = 200
): NextResponse<ApiSuccessResponse<T>> {
    const response: ApiSuccessResponse<T> = {
        success: true,
        data,
    };

    if (meta) {
        response.meta = meta;
    }

    return NextResponse.json(response, { status });
}

/**
 * Create an error response
 */
export function errorResponse(
    code: string,
    message: string,
    status: number = 400,
    details?: Record<string, string[]>
): NextResponse<ApiErrorResponse> {
    const response: ApiErrorResponse = {
        success: false,
        error: {
            code,
            message,
        },
    };

    if (details) {
        response.error.details = details;
    }

    return NextResponse.json(response, { status });
}

/**
 * Common error responses
 */
export const errors = {
    unauthorized: () => errorResponse('UNAUTHORIZED', 'Authentication required', 401),
    forbidden: () => errorResponse('FORBIDDEN', 'Insufficient permissions', 403),
    notFound: (resource: string = 'Resource') =>
        errorResponse('NOT_FOUND', `${resource} not found`, 404),
    badRequest: (message: string, details?: Record<string, string[]>) =>
        errorResponse('BAD_REQUEST', message, 400, details),
    rateLimited: () =>
        errorResponse('RATE_LIMITED', 'Too many requests. Please try again later.', 429),
    internal: (message: string = 'An unexpected error occurred') =>
        errorResponse('INTERNAL_ERROR', message, 500),
};

/**
 * Parse pagination params from request
 */
export function parsePaginationParams(searchParams: URLSearchParams): {
    limit: number;
    offset: number;
    page: number;
} {
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10), 1), 100);
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const offset = parseInt(searchParams.get('offset') || String((page - 1) * limit), 10);

    return { limit, offset, page };
}

/**
 * Parse sort params from request
 */
export function parseSortParams<T extends string>(
    searchParams: URLSearchParams,
    allowedFields: T[],
    defaultField: T,
    defaultOrder: 'asc' | 'desc' = 'asc'
): { sortBy: T; sortOrder: 'asc' | 'desc' } {
    const sortBy = searchParams.get('sortBy') as T;
    const sortOrder = searchParams.get('sortOrder') as 'asc' | 'desc';

    return {
        sortBy: allowedFields.includes(sortBy) ? sortBy : defaultField,
        sortOrder: sortOrder === 'asc' || sortOrder === 'desc' ? sortOrder : defaultOrder,
    };
}
