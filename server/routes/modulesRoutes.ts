import type { Express } from 'express';
import type { ColdForecastMethod } from '../../src/types/pettycash.ts';
import { getSnapshot } from '../db.ts';
import {
  authenticateRequest,
  requirePermission,
} from '../middleware/authMiddleware.ts';
import {
  dispatchWhatsAppNotification,
  updateForecastModuleConfig,
  updateFraudGuardConfig,
  updateTaxModuleConfig,
  updateWhatsAppModuleConfig,
} from '../services/modulesService.ts';
import { broadcastSnapshot } from '../sse.ts';

export function registerModuleRoutes(app: Express): void {
  app.patch(
    '/api/modules/tax',
    authenticateRequest,
    requirePermission('modules:manage'),
    (req, res) => {
      const body = req.body as Record<string, unknown>;
      if (!body || typeof body !== 'object') {
        res.status(400).json({ error: 'Payload pengaturan modul tidak valid.' });
        return;
      }
      const result = updateTaxModuleConfig({
        enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
        enablePpn:
          typeof body.enablePpn === 'boolean' ? body.enablePpn : undefined,
        enablePph23:
          typeof body.enablePph23 === 'boolean' ? body.enablePph23 : undefined,
        enablePph21:
          typeof body.enablePph21 === 'boolean' ? body.enablePph21 : undefined,
      });
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      broadcastSnapshot();
      res.json({
        taxModule: result.taxModule,
        state: getSnapshot(req.auth!.permissions),
      });
    }
  );

  app.patch(
    '/api/modules/forecast',
    authenticateRequest,
    requirePermission('modules:manage'),
    (req, res) => {
      const body = req.body as Record<string, unknown>;
      if (!body || typeof body !== 'object') {
        res.status(400).json({ error: 'Payload pengaturan modul forecast tidak valid.' });
        return;
      }
      const result = updateForecastModuleConfig({
        enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
        coldStartMethod:
          typeof body.coldStartMethod === 'string'
            ? (body.coldStartMethod as ColdForecastMethod)
            : undefined,
        budgetUtilizationAssumptionPct:
          body.budgetUtilizationAssumptionPct !== undefined
            ? Number(body.budgetUtilizationAssumptionPct)
            : undefined,
        horizonDays:
          body.horizonDays !== undefined ? Number(body.horizonDays) : undefined,
      });
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      broadcastSnapshot();
      res.json({
        forecastModule: result.forecastModule,
        state: getSnapshot(req.auth!.permissions),
      });
    }
  );

  app.patch(
    '/api/modules/fraud-guard',
    authenticateRequest,
    requirePermission('modules:manage'),
    (req, res) => {
      const body = req.body as Record<string, unknown>;
      if (!body || typeof body !== 'object') {
        res.status(400).json({ error: 'Payload pengaturan guard tidak valid.' });
        return;
      }
      const result = updateFraudGuardConfig({
        enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
        requireReceiptImage:
          typeof body.requireReceiptImage === 'boolean'
            ? body.requireReceiptImage
            : undefined,
        receiptRequiredMinAmount:
          body.receiptRequiredMinAmount !== undefined
            ? Number(body.receiptRequiredMinAmount)
            : undefined,
        blockDuplicateReceiptRef:
          typeof body.blockDuplicateReceiptRef === 'boolean'
            ? body.blockDuplicateReceiptRef
            : undefined,
        preventSelfApproval:
          typeof body.preventSelfApproval === 'boolean'
            ? body.preventSelfApproval
            : undefined,
        detectDuplicateClaimWindowHours:
          body.detectDuplicateClaimWindowHours !== undefined
            ? Number(body.detectDuplicateClaimWindowHours)
            : undefined,
        highValueAlertAmount:
          body.highValueAlertAmount !== undefined
            ? Number(body.highValueAlertAmount)
            : undefined,
        maxSingleRequestAmount:
          body.maxSingleRequestAmount !== undefined
            ? Number(body.maxSingleRequestAmount)
            : undefined,
      });
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      broadcastSnapshot();
      res.json({
        fraudGuard: result.fraudGuard,
        state: getSnapshot(req.auth!.permissions),
      });
    }
  );

  app.patch(
    '/api/modules/whatsapp',
    authenticateRequest,
    requirePermission('modules:manage'),
    (req, res) => {
      const body = req.body as Record<string, unknown>;
      if (!body || typeof body !== 'object') {
        res.status(400).json({ error: 'Payload pengaturan WhatsApp tidak valid.' });
        return;
      }
      const result = updateWhatsAppModuleConfig({
        enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
        directorPhone:
          typeof body.directorPhone === 'string' ? body.directorPhone : undefined,
        autoSendOnNewRequest:
          typeof body.autoSendOnNewRequest === 'boolean'
            ? body.autoSendOnNewRequest
            : undefined,
        autoSendOnDecision:
          typeof body.autoSendOnDecision === 'boolean'
            ? body.autoSendOnDecision
            : undefined,
        lowBalanceReminder:
          typeof body.lowBalanceReminder === 'boolean'
            ? body.lowBalanceReminder
            : undefined,
      });
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      broadcastSnapshot();
      res.json({
        whatsappModule: result.whatsappModule,
        state: getSnapshot(req.auth!.permissions),
      });
    }
  );

  app.post(
    '/api/whatsapp/dispatch',
    authenticateRequest,
    requirePermission('whatsapp:dispatch'),
    (req, res) => {
      const body = req.body as Record<string, unknown>;
      if (!body || typeof body !== 'object') {
        res.status(400).json({ error: 'Payload kirim WhatsApp tidak valid.' });
        return;
      }
      const rawEvent = String(body.eventType ?? 'manual_test');
      const eventType = (
        ['new_request', 'decision', 'low_balance', 'manual_test'].includes(rawEvent)
          ? rawEvent
          : 'manual_test'
      ) as 'new_request' | 'decision' | 'low_balance' | 'manual_test';

      const result = dispatchWhatsAppNotification({
        eventType,
        referenceNumber: String(body.referenceNumber ?? 'TEST-WA'),
        messagePreview: String(body.messagePreview ?? ''),
        recipientPhone:
          typeof body.recipientPhone === 'string' ? body.recipientPhone : undefined,
        status: body.status === 'queued' ? 'queued' : 'sent',
      });
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      broadcastSnapshot();
      res.status(201).json({
        log: result.log,
        state: getSnapshot(req.auth!.permissions),
      });
    }
  );
}
