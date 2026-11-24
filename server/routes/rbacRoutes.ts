import type { Express } from 'express';
import { getSnapshot } from '../db.ts';
import {
  authenticateRequest,
  requirePermission,
} from '../middleware/authMiddleware.ts';
import {
  createRbacRole,
  createUserAccount,
  deleteRbacRole,
  revokeSessionById,
  updateRbacRole,
  updateSecurityPolicy,
  updateUserAccount,
} from '../services/authService.ts';
import { broadcastSnapshot } from '../sse.ts';

export function registerRbacRoutes(app: Express): void {
  app.post(
    '/api/rbac/roles',
    authenticateRequest,
    requirePermission('rbac:manage_roles'),
    (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = createRbacRole({
        actorName: req.auth!.user.name,
        actorRoleName: req.auth!.role.name,
        name: String(body?.name ?? ''),
        description: String(body?.description ?? ''),
        permissions: body?.permissions,
      });
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      broadcastSnapshot();
      res.status(201).json({
        role: result.role,
        state: getSnapshot(req.auth!.permissions),
      });
    }
  );

  app.patch(
    '/api/rbac/roles/:id',
    authenticateRequest,
    requirePermission('rbac:manage_roles'),
    (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = updateRbacRole({
        actorName: req.auth!.user.name,
        actorRoleName: req.auth!.role.name,
        roleId: String(req.params.id),
        name: String(body?.name ?? ''),
        description: String(body?.description ?? ''),
        permissions: body?.permissions,
      });
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      broadcastSnapshot();
      res.json({
        role: result.role,
        state: getSnapshot(req.auth!.permissions),
      });
    }
  );

  app.delete(
    '/api/rbac/roles/:id',
    authenticateRequest,
    requirePermission('rbac:manage_roles'),
    (req, res) => {
      const result = deleteRbacRole({
        actorName: req.auth!.user.name,
        actorRoleName: req.auth!.role.name,
        roleId: String(req.params.id),
      });
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      broadcastSnapshot();
      res.json({ state: getSnapshot(req.auth!.permissions) });
    }
  );

  app.post(
    '/api/rbac/users',
    authenticateRequest,
    requirePermission('rbac:manage_users'),
    (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = createUserAccount({
        actorName: req.auth!.user.name,
        actorRoleName: req.auth!.role.name,
        name: String(body?.name ?? ''),
        email: String(body?.email ?? ''),
        password: String(body?.password ?? ''),
        roleId: String(body?.roleId ?? ''),
      });
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      broadcastSnapshot();
      res.status(201).json({
        user: result.user,
        state: getSnapshot(req.auth!.permissions),
      });
    }
  );

  app.patch(
    '/api/rbac/users/:id',
    authenticateRequest,
    requirePermission('rbac:manage_users'),
    (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = updateUserAccount({
        actorUserId: req.auth!.user.id,
        actorName: req.auth!.user.name,
        actorRoleName: req.auth!.role.name,
        targetUserId: String(req.params.id),
        name: typeof body?.name === 'string' ? body.name : undefined,
        roleId: typeof body?.roleId === 'string' ? body.roleId : undefined,
        active: typeof body?.active === 'boolean' ? body.active : undefined,
        newPassword:
          typeof body?.newPassword === 'string' ? body.newPassword : undefined,
      });
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      broadcastSnapshot();
      res.json({
        user: result.user,
        state: getSnapshot(req.auth!.permissions),
      });
    }
  );

  app.post(
    '/api/rbac/sessions/:id/revoke',
    authenticateRequest,
    requirePermission('rbac:manage_users'),
    (req, res) => {
      const result = revokeSessionById({
        actorName: req.auth!.user.name,
        actorRoleName: req.auth!.role.name,
        sessionId: String(req.params.id),
      });
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      broadcastSnapshot();
      res.json({ state: getSnapshot(req.auth!.permissions) });
    }
  );

  app.patch(
    '/api/rbac/security-policy',
    authenticateRequest,
    requirePermission('rbac:manage_users'),
    (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = updateSecurityPolicy({
        actorName: req.auth!.user.name,
        actorRoleName: req.auth!.role.name,
        accessTokenTtlMinutes:
          body?.accessTokenTtlMinutes !== undefined
            ? Number(body.accessTokenTtlMinutes)
            : undefined,
        refreshTokenTtlMinutes:
          body?.refreshTokenTtlMinutes !== undefined
            ? Number(body.refreshTokenTtlMinutes)
            : undefined,
        authRateLimitMaxPerMinute:
          body?.authRateLimitMaxPerMinute !== undefined
            ? Number(body.authRateLimitMaxPerMinute)
            : undefined,
        apiRateLimitMaxPerMinute:
          body?.apiRateLimitMaxPerMinute !== undefined
            ? Number(body.apiRateLimitMaxPerMinute)
            : undefined,
        maxFailedLoginsBeforeCooldown:
          body?.maxFailedLoginsBeforeCooldown !== undefined
            ? Number(body.maxFailedLoginsBeforeCooldown)
            : undefined,
        cooldownSeconds:
          body?.cooldownSeconds !== undefined
            ? Number(body.cooldownSeconds)
            : undefined,
      });
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      broadcastSnapshot();
      res.json({
        securityPolicy: result.securityPolicy,
        state: getSnapshot(req.auth!.permissions),
      });
    }
  );
}
