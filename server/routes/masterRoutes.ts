import type { Express } from 'express';
import { getSnapshot } from '../db.ts';
import {
  authenticateRequest,
  requirePermission,
} from '../middleware/authMiddleware.ts';
import {
  createCategory,
  createEmployee,
  createVehicle,
  updateCategory,
  updateEmployee,
  updateVehicle,
} from '../services/masterDataService.ts';
import { broadcastSnapshot } from '../sse.ts';

export function registerMasterRoutes(app: Express): void {
  app.post(
    '/api/master/employees',
    authenticateRequest,
    requirePermission('master:manage'),
    (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = createEmployee({
        code: String(body?.code ?? ''),
        name: String(body?.name ?? ''),
        roleTitle: String(body?.roleTitle ?? ''),
        departmentId: String(body?.departmentId ?? ''),
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
    '/api/master/employees/:id',
    authenticateRequest,
    requirePermission('master:manage'),
    (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = updateEmployee({
        employeeId: String(req.params.id),
        code: typeof body?.code === 'string' ? body.code : undefined,
        name: typeof body?.name === 'string' ? body.name : undefined,
        roleTitle:
          typeof body?.roleTitle === 'string' ? body.roleTitle : undefined,
        departmentId:
          typeof body?.departmentId === 'string' ? body.departmentId : undefined,
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
    '/api/master/categories',
    authenticateRequest,
    requirePermission('master:manage'),
    (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = createCategory({
        code: String(body?.code ?? ''),
        name: String(body?.name ?? ''),
        requiresVehicle: Boolean(body?.requiresVehicle),
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
    '/api/master/categories/:id',
    authenticateRequest,
    requirePermission('master:manage'),
    (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = updateCategory({
        categoryId: String(req.params.id),
        code: typeof body?.code === 'string' ? body.code : undefined,
        name: typeof body?.name === 'string' ? body.name : undefined,
        requiresVehicle:
          typeof body?.requiresVehicle === 'boolean'
            ? body.requiresVehicle
            : undefined,
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
    '/api/master/vehicles',
    authenticateRequest,
    requirePermission('master:manage'),
    (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = createVehicle({
        plateNumber: String(body?.plateNumber ?? ''),
        unitType: String(body?.unitType ?? ''),
        departmentId: String(body?.departmentId ?? ''),
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
    '/api/master/vehicles/:id',
    authenticateRequest,
    requirePermission('master:manage'),
    (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = updateVehicle({
        vehicleId: String(req.params.id),
        plateNumber:
          typeof body?.plateNumber === 'string' ? body.plateNumber : undefined,
        unitType:
          typeof body?.unitType === 'string' ? body.unitType : undefined,
        departmentId:
          typeof body?.departmentId === 'string' ? body.departmentId : undefined,
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
}
