import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Rate limit configurations by endpoint
export const RATE_LIMITS = {
  chat: { requests: 20, window: '1m' },
  transcribe: { requests: 10, window: '1m' },
  upload: { requests: 20, window: '1m' },
  messages: { requests: 60, window: '1m' },
  conversations: { requests: 30, window: '1m' },
  webhook: { requests: 100, window: '1m' },
  default: { requests: 60, window: '1m' },
} as const

type RateLimitKey = keyof typeof RATE_LIMITS

// In-memory store for development (when Upstash is not configured)
const inMemoryStore = new Map<string, { count: number; resetAt: number }>()

function getInMemoryRateLimiter(limit: number, windowMs: number) {
  return {
    limit: async (identifier: string) => {
      const now = Date.now()
      const key = identifier
      const record = inMemoryStore.get(key)

      if (!record || now > record.resetAt) {
        inMemoryStore.set(key, { count: 1, resetAt: now + windowMs })
        return { success: true, remaining: limit - 1, reset: now + windowMs }
      }

      if (record.count >= limit) {
        return { success: false, remaining: 0, reset: record.resetAt }
      }

      record.count++
      return { success: true, remaining: limit - record.count, reset: record.resetAt }
    },
  }
}

// Parse window string to milliseconds
function parseWindow(window: string): number {
  const match = window.match(/^(\d+)(s|m|h|d)$/)
  if (!match) return 60000 // default 1 minute

  const value = parseInt(match[1])
  const unit = match[2]

  switch (unit) {
    case 's':
      return value * 1000
    case 'm':
      return value * 60 * 1000
    case 'h':
      return value * 60 * 60 * 1000
    case 'd':
      return value * 24 * 60 * 60 * 1000
    default:
      return 60000
  }
}

// Create rate limiter instance
function createRateLimiter(endpoint: RateLimitKey) {
  const config = RATE_LIMITS[endpoint]
  const windowMs = parseWindow(config.window)

  // Use Upstash Redis if configured
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })

    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(config.requests, config.window),
      prefix: `thinker:ratelimit:${endpoint}`,
      analytics: true,
    })
  }

  // Fallback to in-memory for development
  console.warn(`[Rate Limit] Using in-memory rate limiter for ${endpoint} (Upstash not configured)`)
  return getInMemoryRateLimiter(config.requests, windowMs)
}

// Cache rate limiters
const rateLimiters = new Map<string, ReturnType<typeof createRateLimiter>>()

function getRateLimiter(endpoint: RateLimitKey) {
  if (!rateLimiters.has(endpoint)) {
    rateLimiters.set(endpoint, createRateLimiter(endpoint))
  }
  return rateLimiters.get(endpoint)!
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  reset: number
  headers: Headers
}

/**
 * Check rate limit for a user on a specific endpoint
 * @param userId - The user's ID (from Supabase auth)
 * @param endpoint - The endpoint key (chat, transcribe, upload, etc.)
 * @returns RateLimitResult with success status and headers
 */
export async function checkRateLimit(
  userId: string,
  endpoint: RateLimitKey = 'default'
): Promise<RateLimitResult> {
  const limiter = getRateLimiter(endpoint)
  const identifier = `${endpoint}:${userId}`

  const result = await limiter.limit(identifier)

  const headers = new Headers()
  headers.set('X-RateLimit-Limit', String(RATE_LIMITS[endpoint].requests))
  headers.set('X-RateLimit-Remaining', String(result.remaining))
  headers.set('X-RateLimit-Reset', String(result.reset))

  return {
    success: result.success,
    remaining: result.remaining,
    reset: result.reset,
    headers,
  }
}

/**
 * Create a rate limit error response
 */
export function rateLimitResponse(result: RateLimitResult): Response {
  const retryAfter = Math.ceil((result.reset - Date.now()) / 1000)

  return new Response(
    JSON.stringify({
      error: 'Muitas requisições. Por favor, aguarde um momento.',
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': result.headers.get('X-RateLimit-Limit') || '',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': result.headers.get('X-RateLimit-Reset') || '',
      },
    }
  )
}
