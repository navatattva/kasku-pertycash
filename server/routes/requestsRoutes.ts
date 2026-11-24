import type { Express } from 'express';
import type { TaxSchemeId } from '../../src/types/pettycash.ts';
import { getSnapshot, isValidActiveCategory } from '../db.ts';
import {
  authenticateRequest,
  requirePermission,
} from '../middleware/authMiddleware.ts';
import {
  createPettyCashRequest,
  decidePettyCashRequest,
} from '../services/requestsService.ts';
import { broadcastSnapshot } from '../sse.ts';
import { VALID_TAX_SCHEMES } from './constants.ts';

export function registerRequestRoutes(app: Express): void {
  app.post(
    '/api/requests',
    authenticateRequest,
    requirePermission('requests:create'),
    (req, res) => {
      const body = req.body as Record<string, unknown>;
      if (!body || typeof body !== 'object') {
        res.status(400).json({ error: 'Payload tidak valid.' });
        return;
      }
      const category = String(body.category ?? '').trim();
      if (!isValidActiveCategory(category)) {
        res.status(400).json({
          error: 'Kategori pengeluaran tidak ditemukan atau berstatus nonaktif.',
        });
        return;
      }

      const rawTaxType =
        typeof body.taxType === 'string' && body.taxType.trim()
          ? body.taxType.trim()
          : 'none';
      if (!VALID_TAX_SCHEMES.has(rawTaxType as TaxSchemeId)) {
        res.status(400).json({ error: 'Skema pajak tidak dikenal.' });
        return;
      }

      const result = createPettyCashRequest({
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
        amount: Number(body.amount),
        taxType: rawTaxType as TaxSchemeId,
        notes: typeof body.notes === 'string' ? body.notes : '',
        receiptRef: typeof body.receiptRef === 'string' ? body.receiptRef : '',
        receiptImageUrl:
          typeof body.receiptImageUrl === 'string'
            ? body.receiptImageUrl
            : undefined,
        receiptImageName:
          typeof body.receiptImageName === 'string'
            ? body.receiptImageName
            : undefined,
      });

      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }

      broadcastSnapshot();
      res.status(201).json({
        request: result.request,
        state: getSnapshot(req.auth!.permissions),
      });
    }
  );

  app.post(
    '/api/requests/:id/decision',
    authenticateRequest,
    requirePermission('requests:decide'),
    (req, res) => {
      const body = req.body as Record<string, unknown>;
      const decision = String(body?.decision ?? '');
      if (decision !== 'approve' && decision !== 'reject') {
        res.status(400).json({ error: 'Keputusan harus approve atau reject.' });
        return;
      }

      const result = decidePettyCashRequest({
        requestId: String(req.params.id),
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
        request: result.request,
        state: getSnapshot(req.auth!.permissions),
      });
    }
  );
}
