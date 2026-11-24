import type { Request, Response } from 'express';
import type { PermissionKey } from '../src/types/pettycash.ts';
import { getSnapshot, memoryDb } from './db.ts';

interface SseClientEntry {
  res: Response;
  userId: string;
  sessionId: string;
}

const sseClients = new Set<SseClientEntry>();

function resolveViewerPermissionsForUser(userId: string): PermissionKey[] {
  const user = memoryDb.authUsers.find((u) => u.id === userId && u.active);
  if (!user) return [];
  const role = memoryDb.rbacRoles.find((r) => r.id === user.roleId);
  return role?.permissions ?? [];
}

export function broadcastSnapshot(): void {
  for (const client of sseClients) {
    const permissions = resolveViewerPermissionsForUser(client.userId);
    const snapshot = getSnapshot(permissions);
    try {
      client.res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

export function closeSseForSession(sessionId: string, reason = 'SESSION_ENDED'): void {
  for (const client of sseClients) {
    if (client.sessionId === sessionId) {
      try {
        client.res.write(
          `event: session_revoked\ndata: ${JSON.stringify({ reason })}\n\n`
        );
        client.res.end();
      } catch {
        // Ignore broken pipes
      }
      sseClients.delete(client);
    }
  }
}

export function closeSseForUser(userId: string, reason = 'USER_UPDATED'): void {
  for (const client of sseClients) {
    if (client.userId === userId) {
      try {
        client.res.write(
          `event: session_revoked\ndata: ${JSON.stringify({ reason })}\n\n`
        );
        client.res.end();
      } catch {
        // Ignore broken pipes
      }
      sseClients.delete(client);
    }
  }
}

export function handleSseStream(req: Request, res: Response): void {
  if (!req.auth) {
    res.status(401).json({ error: 'Autentikasi diperlukan.' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const clientEntry: SseClientEntry = {
    res,
    userId: req.auth.user.id,
    sessionId: req.auth.session.id,
  };
  sseClients.add(clientEntry);

  res.write(
    `event: snapshot\ndata: ${JSON.stringify(
      getSnapshot(req.auth.permissions)
    )}\n\n`
  );

  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
      sseClients.delete(clientEntry);
    }
  }, 25_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(clientEntry);
  });
}
