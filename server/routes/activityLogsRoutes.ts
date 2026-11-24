import type { Express } from 'express';
import { memoryDb } from '../db.ts';
import {
  authenticateRequest,
  requirePermission,
} from '../middleware/authMiddleware.ts';
import { verifyActivityLogsIntegrity } from '../services/activityLogService.ts';

export function registerActivityLogRoutes(app: Express): void {
  // Read-only endpoint: activity logs are strictly append-only (no PUT/PATCH/DELETE).
  app.get(
    '/api/activity-logs',
    authenticateRequest,
    requirePermission('activity_log:view'),
    (_req, res) => {
      res.json({
        activityLogs: memoryDb.activityLogs,
        integrity: verifyActivityLogsIntegrity(memoryDb.activityLogs),
      });
    }
  );
}
