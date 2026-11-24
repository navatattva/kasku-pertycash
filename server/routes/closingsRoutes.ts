import type { Express } from 'express';
import { getSnapshot } from '../db.ts';
import {
  authenticateRequest,
  requirePermission,
} from '../middleware/authMiddleware.ts';
import {
  closeMonthlyPeriod,
  createDailyClosing,
  reopenMonthlyPeriod,
} from '../services/closingsService.ts';
import { broadcastSnapshot } from '../sse.ts';

export function registerClosingRoutes(app: Express): void {
  app.post(
    '/api/closings/daily',
    authenticateRequest,
    requirePermission('closing:daily'),
    (req, res) => {
      const body = req.body as Record<string, unknown>;
      if (!body || typeof body !== 'object') {
        res.status(400).json({ error: 'Payload tutup kas harian tidak valid.' });
        return;
      }

      const result = createDailyClosing({
        closingDate: String(body.closingDate ?? ''),
        departmentId: String(body.departmentId ?? ''),
        closedBy: req.auth!.user.name,
        note: typeof body.note === 'string' ? body.note : '',
      });
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      broadcastSnapshot();
      res.status(201).json({
        closing: result.closing,
        state: getSnapshot(req.auth!.permissions),
      });
    }
  );

  app.post(
    '/api/closings/periods',
    authenticateRequest,
    requirePermission('closing:lock_period'),
    (req, res) => {
      const body = req.body as Record<string, unknown>;
      if (!body || typeof body !== 'object') {
        res.status(400).json({ error: 'Payload tutup buku periode tidak valid.' });
        return;
      }

      const result = closeMonthlyPeriod({
        monthKey: String(body.monthKey ?? ''),
        actorRole: req.auth!.role.slug,
        authorizedByRbac: true,
        closedBy: req.auth!.user.name,
        note: typeof body.note === 'string' ? body.note : '',
      });
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      broadcastSnapshot();
      res.status(201).json({
        closedPeriod: result.closedPeriod,
        state: getSnapshot(req.auth!.permissions),
      });
    }
  );

  app.post(
    '/api/closings/periods/:monthKey/reopen',
    authenticateRequest,
    requirePermission('closing:reopen_period'),
    (req, res) => {
      const result = reopenMonthlyPeriod({
        monthKey: String(req.params.monthKey),
        actorRole: req.auth!.role.slug,
        authorizedByRbac: true,
      });
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      broadcastSnapshot();
      res.json({ state: getSnapshot(req.auth!.permissions) });
    }
  );
}
