import crypto from 'node:crypto';

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  iat: number;
  exp: number;
  type: 'access';
}

// Runtime signing key: reads process.env or generates a strong ephemeral 256-bit key in memory.
const EPHEMERAL_FALLBACK_KEY = crypto.randomBytes(32);

function getSigningSecret(): Buffer {
  const configured =
    process.env.AUTH_JWT_SECRET?.trim() || process.env.SESSION_SECRET?.trim();
  if (configured && configured.length >= 16) {
    return crypto.createHash('sha256').update(configured, 'utf8').digest();
  }
  return EPHEMERAL_FALLBACK_KEY;
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64url');
}

function base64UrlDecode(input: string): Buffer {
  return Buffer.from(input, 'base64url');
}

export function hashPasswordScrypt(password: string): {
  salt: string;
  hash: string;
} {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64);
  return {
    salt,
    hash: derived.toString('hex'),
  };
}

export function verifyPasswordScrypt(
  password: string,
  salt: string,
  expectedHexHash: string
): boolean {
  if (!password || !salt || !expectedHexHash) return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHexHash, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function signAccessToken(params: {
  userId: string;
  sessionId: string;
  ttlSeconds: number;
  nowMs?: number;
}): { token: string; expiresAtIso: string } {
  const nowSec = Math.floor((params.nowMs ?? Date.now()) / 1000);
  const expSec = nowSec + Math.max(10, Math.floor(params.ttlSeconds));
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadObj: AccessTokenPayload = {
    sub: params.userId,
    sid: params.sessionId,
    iat: nowSec,
    exp: expSec,
    type: 'access',
  };
  const payload = base64UrlEncode(JSON.stringify(payloadObj));
  const unsigned = `${header}.${payload}`;
  const sig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(unsigned, 'utf8')
    .digest('base64url');
  return {
    token: `${unsigned}.${sig}`,
    expiresAtIso: new Date(expSec * 1000).toISOString(),
  };
}

export function verifyAccessToken(
  token: string,
  nowMs: number = Date.now()
): {
  valid: boolean;
  expired: boolean;
  payload?: AccessTokenPayload;
} {
  if (!token || typeof token !== 'string') {
    return { valid: false, expired: false };
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, expired: false };
  }
  const [headerPart, payloadPart, sigPart] = parts;
  if (!headerPart || !payloadPart || !sigPart) {
    return { valid: false, expired: false };
  }

  try {
    const unsigned = `${headerPart}.${payloadPart}`;
    const expectedSig = crypto
      .createHmac('sha256', getSigningSecret())
      .update(unsigned, 'utf8')
      .digest();
    const providedSig = base64UrlDecode(sigPart);
    if (
      providedSig.length !== expectedSig.length ||
      !crypto.timingSafeEqual(providedSig, expectedSig)
    ) {
      return { valid: false, expired: false };
    }

    const parsed = JSON.parse(
      base64UrlDecode(payloadPart).toString('utf8')
    ) as AccessTokenPayload;
    if (
      !parsed ||
      typeof parsed.sub !== 'string' ||
      typeof parsed.sid !== 'string' ||
      typeof parsed.exp !== 'number' ||
      parsed.type !== 'access'
    ) {
      return { valid: false, expired: false };
    }

    const nowSec = Math.floor(nowMs / 1000);
    if (parsed.exp <= nowSec) {
      return { valid: false, expired: true, payload: parsed };
    }
    return { valid: true, expired: false, payload: parsed };
  } catch {
    return { valid: false, expired: false };
  }
}

export function sha256Hex(raw: string): string {
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
}

export function generateRefreshTokenSecret(sessionId: string): {
  rawToken: string;
  tokenHash: string;
} {
  const randomSecret = crypto.randomBytes(32).toString('base64url');
  const rawToken = `rt_${sessionId}.${randomSecret}`;
  return {
    rawToken,
    tokenHash: sha256Hex(rawToken),
  };
}

export function parseSessionIdFromRefreshToken(rawToken: string): string | null {
  if (typeof rawToken !== 'string') return null;
  const match = /^rt_([a-zA-Z0-9\-]+)\.[A-Za-z0-9_\-]+$/.exec(rawToken.trim());
  return match ? match[1] : null;
}

export function getEnvAdminPasscode(): string {
  return (process.env.ADMIN_BOOTSTRAP_PASSCODE ?? '').trim();
}

export function verifyEnvAdminPasscode(input: string): boolean {
  const expected = getEnvAdminPasscode();
  if (!expected || typeof input !== 'string') return false;
  const a = Buffer.from(input, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
