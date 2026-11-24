import type { Express } from 'express';
import { getSnapshot, isValidActiveCategory } from '../db.ts';
import {
  authenticateRequest,
  requirePermission,
} from '../middleware/authMiddleware.ts';
import {
  createDownPayment,
  decideDownPayment,
  settleDownPayment,
} from '../services/downPaymentsService.ts';
import { broadcastSnapshot } from '../sse.ts';

export function registerDownPaymentRoutes(app: Express): void {
  app.post(
    '/api/down-payments',
    authenticateRequest,
    requirePermission('down_payments:create'),
    (req, res) => {
      const body = req.body as Record<string, unknown>;
      if (!body || typeof body !== 'object') {
        res.status(400).json({ error: 'Payload kasbon tidak valid.' });
        return;
      }
      const category = String(body.category ?? '').trim();
      if (!isValidActiveCategory(category)) {
        res.status(400).json({
          error: 'Kategori pengeluaran tidak ditemukan atau berstatus nonaktif.',
        });
        return;
      }

      const result = createDownPayment({
        departmentId: String(body.departmentId ?? ''),
        employeeId:
          typeof body.employeeId === 'string' && body.employeeId.trim()
            ? body.employeeId.trim()
            : undefined,
        createdByUserId: req.auth!.user.id,
        requesterName:
          typeof body.requesterName === 'string' && body.requesterName.trim()
            ? body.requesterName.trim()
            : req.auth!.user.name,
        title: String(body.title ?? ''),
        category,
        vehicleId:
          typeof body.vehicleId === 'string' && body.vehicleId.trim()
            ? body.vehicleId.trim()
            : undefined,
        requestedAmount: Number(body.requestedAmount),
        dueDate: String(body.dueDate ?? ''),
        notes: typeof body.notes === 'string' ? body.notes : '',
      });

      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      broadcastSnapshot();
      res.status(201).json({
        downPayment: result.downPayment,
        state: getSnapshot(req.auth!.permissions),
      });
    }
  );

  app.post(
    '/api/down-payments/:id/decision',
    authenticateRequest,
    requirePermission('down_payments:decide'),
    (req, res) => {
      const body = req.body as Record<string, unknown>;
      const decision = String(body?.decision ?? '');
      if (decision !== 'approve' && decision !== 'reject') {
        res.status(400).json({ error: 'Keputusan harus approve atau reject.' });
        return;
      }

      const result = decideDownPayment({
        dpId: String(req.params.id),
        actorUserId: req.auth!.user.id,
        actorRole: req.auth!.role.slug,
        actorName: req.auth!.user.name,
        actorRoleLabel: req.auth!.role.name,
        authorizedByRbac: true,
        decision,
        note: typeof body?.note === 'string' ? body.note : '',
      });
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      broadcastSnapshot();
      res.json({
        downPayment: result.downPayment,
        state: getSnapshot(req.auth!.permissions),
      });
    }
  );

  app.post(
    '/api/down-payments/:id/settle',
    authenticateRequest,
    requirePermission('down_payments:settle'),
    (req, res) => {
      const body = req.body as Record<string, unknown>;
      if (!body || typeof body !== 'object') {
        res.status(400).json({ error: 'Payload realisasi kasbon tidak valid.' });
        return;
      }

      const result = settleDownPayment({
        dpId: String(req.params.id),
        actualAmount: Number(body.actualAmount),
        receiptRef: typeof body.receiptRef === 'string' ? body.receiptRef : '',
        receiptImageUrl:
          typeof body.receiptImageUrl === 'string'
            ? body.receiptImageUrl
            : undefined,
        receiptImageName:
          typeof body.receiptImageName === 'string'
            ? body.receiptImageName
            : undefined,
        settledBy: req.auth!.user.name,
        note: typeof body.note === 'string' ? body.note : '',
      });
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      broadcastSnapshot();
      res.json({
        downPayment: result.downPayment,
        state: getSnapshot(req.auth!.permissions),
      });
    }
  );
}
