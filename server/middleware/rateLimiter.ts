import type { NextFunction, Request, Response } from 'express';
import { SlidingWindowRateLimiter } from '../../src/utils/pettycashLogic.ts';
import { memoryDb } from '../db.ts';

const authLimiter = new SlidingWindowRateLimiter();
const uploadLimiter = new SlidingWindowRateLimiter();
const generalApiLimiter = new SlidingWindowRateLimiter();

function getClientIp(req: Request): string {
  const xff = req.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0].trim();
    if (first) return first;
  }
  return req.ip || req.socket.remoteAddress || 'unknown-client';
}

function applyRateLimiter(
  limiter: SlidingWindowRateLimiter,
  key: string,
  maxRequests: number,
  windowMs: number,
  res: Response
): boolean {
  const result = limiter.consume(key, maxRequests, windowMs);
  res.setHeader('X-RateLimit-Limit', String(result.limit));
  res.setHeader('X-RateLimit-Remaining', String(result.remaining));
  res.setHeader(
    'X-RateLimit-Reset',
    String(Math.ceil(result.resetAtMs / 1000))
  );

  if (!result.allowed) {
    res.setHeader('Retry-After', String(result.retryAfterSec));
    res.status(429).json({
      error: `Terlalu banyak permintaan. Batas ${result.limit} permintaan/menit tercapai. Coba lagi dalam ${result.retryAfterSec} detik.`,
      code: 'RATE_LIMITED',
      retryAfterSeconds: result.retryAfterSec,
    });
    return false;
  }
  return true;
}

export function authRateLimiterMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const max = Math.max(
    3,
    Math.min(120, memoryDb.securityPolicy?.authRateLimitMaxPerMinute || 15)
  );
  const ip = getClientIp(req);
  const allowed = applyRateLimiter(
    authLimiter,
    `auth:${ip}:${req.path}`,
    max,
    60_000,
    res
  );
  if (allowed) next();
}

export function uploadRateLimiterMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const ip = getClientIp(req);
  const allowed = applyRateLimiter(
    uploadLimiter,
    `upload:${ip}`,
    30,
    60_000,
    res
  );
  if (allowed) next();
}

export function generalApiRateLimiterMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Skip healthchecks, SSE stream establishment & auth/upload routes which have their own limiters
  if (
    req.path === '/api/health' ||
    req.path === '/api/stream' ||
    req.path.startsWith('/api/auth/') ||
    req.path === '/api/uploads'
  ) {
    next();
    return;
  }
  const max = Math.max(
    30,
    Math.min(2000, memoryDb.securityPolicy?.apiRateLimitMaxPerMinute || 180)
  );
  const ip = getClientIp(req);
  const allowed = applyRateLimiter(generalApiLimiter, `api:${ip}`, max, 60_000, res);
  if (allowed) next();
}
