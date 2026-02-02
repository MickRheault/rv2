import { NextRequest } from 'next/server';

/**
 * Simple in-memory rate limiter
 * Note: This is per-instance and will reset on server restart
 * For production at scale, consider Redis-based rate limiting
 */

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

// In-memory store for rate limiting
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupExpiredEntries() {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL) return;

    lastCleanup = now;
    for (const [key, entry] of rateLimitStore.entries()) {
        if (entry.resetAt < now) {
            rateLimitStore.delete(key);
        }
    }
}

/**
 * Get client identifier for rate limiting (IP address)
 */
export function getClientIdentifier(request: NextRequest): string {
    // Try various headers for the real IP
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }

    const realIp = request.headers.get('x-real-ip');
    if (realIp) {
        return realIp;
    }

    // Fallback to a generic identifier
    return 'anonymous';
}

/**
 * Check and update rate limit for a client
 * 
 * @param key - Unique identifier for the rate limit (typically IP or user ID)
 * @param limit - Maximum number of requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns Object with allowed status and remaining requests
 */
export function checkRateLimit(
    key: string,
    limit: number = 100,
    windowMs: number = 60 * 1000 // 1 minute default
): { allowed: boolean; remaining: number; resetAt: number } {
    cleanupExpiredEntries();

    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry || entry.resetAt < now) {
        // Create new entry or reset expired one
        rateLimitStore.set(key, {
            count: 1,
            resetAt: now + windowMs,
        });
        return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
    }

    if (entry.count >= limit) {
        return { allowed: false, remaining: 0, resetAt: entry.resetAt };
    }

    entry.count++;
    return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

/**
 * Rate limit middleware for API routes
 * 
 * @param request - Next.js request
 * @param limit - Maximum requests per window (default: 100)
 * @param windowMs - Window size in milliseconds (default: 60000 = 1 minute)
 */
export function rateLimit(
    request: NextRequest,
    limit: number = 100,
    windowMs: number = 60 * 1000
): { allowed: boolean; remaining: number; resetAt: number } {
    const clientId = getClientIdentifier(request);
    const path = new URL(request.url).pathname;
    const key = `${clientId}:${path}`;

    return checkRateLimit(key, limit, windowMs);
}

/**
 * Get rate limit headers to include in response
 */
export function getRateLimitHeaders(
    remaining: number,
    resetAt: number,
    limit: number = 100
): Record<string, string> {
    return {
        'X-RateLimit-Limit': String(limit),
        'X-RateLimit-Remaining': String(remaining),
        'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
    };
}
