import type { Express } from 'express';
import {
  authenticateRequest,
  requirePermission,
} from '../middleware/authMiddleware.ts';
import { uploadRateLimiterMiddleware } from '../middleware/rateLimiter.ts';
import {
  resolveUploadedReceiptPath,
  saveUploadedReceiptImage,
} from '../services/uploadsService.ts';

export function registerUploadRoutes(app: Express): void {
  app.post(
    '/api/uploads',
    uploadRateLimiterMiddleware,
    authenticateRequest,
    requirePermission(['requests:create', 'down_payments:settle']),
    (req, res) => {
      const body = req.body as Record<string, unknown>;
      if (!body || typeof body !== 'object') {
        res.status(400).json({ error: 'Payload unggahan tidak valid.' });
        return;
      }
      const result = saveUploadedReceiptImage({
        filename: String(body.filename ?? ''),
        mimeType: String(body.mimeType ?? ''),
        dataBase64: String(body.dataBase64 ?? ''),
      });
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.status(201).json({ url: result.url, name: result.name });
    }
  );

  app.get('/api/uploads/:filename', authenticateRequest, (req, res) => {
    const resolved = resolveUploadedReceiptPath(String(req.params.filename));
    if (!resolved) {
      res.status(404).json({ error: 'Lampiran gambar tidak ditemukan.' });
      return;
    }
    res.setHeader('Content-Type', resolved.contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.sendFile(resolved.path);
  });
}
