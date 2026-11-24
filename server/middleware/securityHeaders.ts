import type { NextFunction, Request, Response } from 'express';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function extractHostnamePort(rawUrl: string | undefined): string | null {
  if (!rawUrl) return null;
  try {
    return new URL(rawUrl).host.toLowerCase();
  } catch {
    return null;
  }
}

export function securityHeadersMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Standard HTTP hardening headers (omit X-Frame-Options so AI Studio iframe preview renders normally)
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  if (req.path.startsWith('/api/')) {
    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, private'
    );
    res.setHeader('Pragma', 'no-cache');

    // Enforce strict same-origin validation on mutating API calls if browser provides Origin header
    if (MUTATING_METHODS.has(req.method)) {
      const originHeader = req.get('origin');
      if (originHeader) {
        const originHost = extractHostnamePort(originHeader);
        const forwardedHost = (
          req.get('x-forwarded-host') ||
          req.get('host') ||
          ''
        )
          .split(',')[0]
          .trim()
          .toLowerCase();
        const appUrlHost = extractHostnamePort(process.env.APP_URL);
        const extraAllowedHosts = (process.env.ALLOWED_ORIGINS || '')
          .split(',')
          .map((item) => extractHostnamePort(item.trim()) || item.trim().toLowerCase())
          .filter(Boolean);

        const isAllowed =
          Boolean(originHost) &&
          (originHost === forwardedHost ||
            (Boolean(appUrlHost) && originHost === appUrlHost) ||
            extraAllowedHosts.includes(originHost!));

        if (!isAllowed) {
          res.status(403).json({
            error: 'Permintaan lintas origin (CORS/CSRF) ditolak oleh kebijakan keamanan.',
            code: 'ORIGIN_FORBIDDEN',
          });
          return;
        }
      }
    }
  }

  next();
}
