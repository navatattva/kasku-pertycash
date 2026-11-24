import type { Express } from 'express';
import {
  memoryDb,
  toPublicAuthSession,
  toPublicAuthUser,
} from '../db.ts';
import { authenticateRequest } from '../middleware/authMiddleware.ts';
import { authRateLimiterMiddleware } from '../middleware/rateLimiter.ts';
import {
  bootstrapFirstAdmin,
  getAuthStatus,
  loginWithEmailPassword,
  logoutSession,
  refreshSessionTokens,
  updateUserLastTab,
} from '../services/authService.ts';

export function registerAuthRoutes(app: Express): void {
  app.get('/api/auth/status', (_req, res) => {
    res.json(getAuthStatus());
  });

  app.post('/api/auth/bootstrap', authRateLimiterMiddleware, (req, res) => {
    const body = req.body as Record<string, unknown>;
    if (!body || typeof body !== 'object') {
      res.status(400).json({ error: 'Payload aktivasi admin tidak valid.' });
      return;
    }
    const result = bootstrapFirstAdmin({
      name: String(body.name ?? ''),
      email: String(body.email ?? ''),
      password: String(body.password ?? ''),
      passcode: typeof body.passcode === 'string' ? body.passcode : undefined,
    });
    if (!result.ok || !result.bundle) {
      res.status(result.status ?? 400).json({ error: result.error });
      return;
    }
    res.status(201).json(result.bundle);
  });

  app.post('/api/auth/login', authRateLimiterMiddleware, (req, res) => {
    const body = req.body as Record<string, unknown>;
    if (!body || typeof body !== 'object') {
      res.status(400).json({ error: 'Payload login tidak valid.' });
      return;
    }
    const result = loginWithEmailPassword({
      email: String(body.email ?? ''),
      password: String(body.password ?? ''),
    });
    if (!result.ok || !result.bundle) {
      res.status(result.status ?? 401).json({ error: result.error });
      return;
    }
    res.json(result.bundle);
  });

  app.post('/api/auth/refresh', authRateLimiterMiddleware, (req, res) => {
    const body = req.body as Record<string, unknown>;
    if (!body || typeof body !== 'object') {
      res.status(400).json({ error: 'Payload refresh token tidak valid.' });
      return;
    }
    const result = refreshSessionTokens(String(body.refreshToken ?? ''));
    if (!result.ok || !result.bundle) {
      res.status(result.status ?? 401).json({
        error: result.error,
        code: result.code ?? 'SESSION_EXPIRED',
      });
      return;
    }
    res.json(result.bundle);
  });

  app.post('/api/auth/logout', authenticateRequest, (req, res) => {
    const body = req.body as Record<string, unknown> | undefined;
    logoutSession({
      user: req.auth!.user,
      role: req.auth!.role,
      session: req.auth!.session,
      reason: typeof body?.reason === 'string' ? body.reason : undefined,
    });
    res.json({ ok: true });
  });

  app.get('/api/auth/me', authenticateRequest, (req, res) => {
    res.json({
      user: toPublicAuthUser(req.auth!.user),
      role: req.auth!.role,
      permissions: req.auth!.permissions,
      session: toPublicAuthSession(req.auth!.session),
      securityPolicy: memoryDb.securityPolicy,
    });
  });

  app.patch('/api/auth/last-tab', authenticateRequest, (req, res) => {
    const body = req.body as Record<string, unknown>;
    const result = updateUserLastTab({
      user: req.auth!.user,
      role: req.auth!.role,
      tab: String(body?.tab ?? ''),
    });
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ ok: true, user: result.user });
  });
}
