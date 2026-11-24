import type { Express } from 'express';
import { getSnapshot } from '../db.ts';
import {
  authenticateRequest,
  requirePermission,
} from '../middleware/authMiddleware.ts';
import {
  createCashOpnameRecord,
  topUpDepartment,
} from '../services/departmentsService.ts';
import {
  createDepartment,
  updateDepartmentConfig,
} from '../services/masterDataService.ts';
import { broadcastSnapshot } from '../sse.ts';

export function registerDepartmentRoutes(app: Express): void {
  app.post(
    '/api/departments/:id/topup',
    authenticateRequest,
    requirePermission('departments:topup'),
    (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = topUpDepartment({
        departmentId: String(req.params.id),
        amount: Number(body?.amount),
        performedBy: req.auth!.user.name,
        note: String(body?.note ?? ''),
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
    '/api/departments',
    authenticateRequest,
    requirePermission('master:manage'),
    (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = createDepartment({
        code: String(body?.code ?? ''),
        name: String(body?.name ?? ''),
        picName: String(body?.picName ?? ''),
        monthlyBudget: Number(body?.monthlyBudget),
        lowBalanceThreshold: Number(body?.lowBalanceThreshold ?? 0),
        initialBalance: Number(body?.initialBalance ?? 0),
      });

      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }

      broadcastSnapshot();
      res.status(201).json({ state: getSnapshot(req.auth!.permissions) });
    }
  );

  app.patch(
    '/api/departments/:id',
    authenticateRequest,
    requirePermission(['departments:edit', 'master:manage']),
    (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = updateDepartmentConfig({
        departmentId: String(req.params.id),
        code: typeof body?.code === 'string' ? body.code : undefined,
        name: typeof body?.name === 'string' ? body.name : undefined,
        picName: String(body?.picName ?? ''),
        monthlyBudget: Number(body?.monthlyBudget),
        lowBalanceThreshold: Number(body?.lowBalanceThreshold),
        active: typeof body?.active === 'boolean' ? body.active : undefined,
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
    '/api/opname',
    authenticateRequest,
    requirePermission('opname:create'),
    (req, res) => {
      const body = req.body as Record<string, unknown>;
      if (!body || typeof body !== 'object') {
        res.status(400).json({ error: 'Payload cash opname tidak valid.' });
        return;
      }
      const rawDenoms = Array.isArray(body.denominations)
        ? body.denominations.map((d) => ({
            denomination: Number((d as Record<string, unknown>)?.denomination),
            count: Number((d as Record<string, unknown>)?.count),
          }))
        : [];

      const result = createCashOpnameRecord({
        departmentId: String(body.departmentId ?? ''),
        countedBy: req.auth!.user.name,
        note: typeof body.note === 'string' ? body.note : '',
        denominations: rawDenoms,
      });
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      broadcastSnapshot();
      res.status(201).json({
        opname: result.opname,
        state: getSnapshot(req.auth!.permissions),
      });
    }
  );
}
