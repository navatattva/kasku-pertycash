import express, { type NextFunction, type Request, type Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { getSnapshot } from './server/db.ts';
import { authenticateRequest } from './server/middleware/authMiddleware.ts';
import { generalApiRateLimiterMiddleware } from './server/middleware/rateLimiter.ts';
import { securityHeadersMiddleware } from './server/middleware/securityHeaders.ts';
import { registerActivityLogRoutes } from './server/routes/activityLogsRoutes.ts';
import { registerAuthRoutes } from './server/routes/authRoutes.ts';
import { registerClosingRoutes } from './server/routes/closingsRoutes.ts';
import { registerDepartmentRoutes } from './server/routes/departmentsRoutes.ts';
import { registerDownPaymentRoutes } from './server/routes/downPaymentsRoutes.ts';
import { registerMasterRoutes } from './server/routes/masterRoutes.ts';
import { registerModuleRoutes } from './server/routes/modulesRoutes.ts';
import { registerRbacRoutes } from './server/routes/rbacRoutes.ts';
import { registerRequestRoutes } from './server/routes/requestsRoutes.ts';
import { registerUploadRoutes } from './server/routes/uploadsRoutes.ts';
import { handleSseStream } from './server/sse.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);

export interface CreateAppOptions {
  skipFrontend?: boolean;
}

export async function createApp(options: CreateAppOptions = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(securityHeadersMiddleware);
  app.use('/api', generalApiRateLimiterMiddleware);
  app.use(express.json({ limit: '6mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
  });

  registerAuthRoutes(app);

  app.get('/api/state', authenticateRequest, (req, res) => {
    res.json(getSnapshot(req.auth!.permissions));
  });

  app.get('/api/stream', authenticateRequest, handleSseStream);

  registerRbacRoutes(app);
  registerUploadRoutes(app);
  registerRequestRoutes(app);
  registerDepartmentRoutes(app);
  registerMasterRoutes(app);
  registerModuleRoutes(app);
  registerDownPaymentRoutes(app);
  registerClosingRoutes(app);
  registerActivityLogRoutes(app);

  // Return JSON 404 for unknown /api/* endpoints instead of SPA HTML fallback
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Endpoint API tidak ditemukan.' });
  });

  // Safe API error handler: avoid leaking stack traces or internal file paths
  app.use(
    (
      err: unknown,
      req: Request,
      res: Response,
      next: NextFunction
    ): void => {
      if (req.path.startsWith('/api/')) {
        if (err instanceof SyntaxError && 'body' in err) {
          res.status(400).json({ error: 'Format JSON tidak valid.' });
          return;
        }
        res.status(500).json({ error: 'Terjadi kesalahan internal server.' });
        return;
      }
      next(err);
    }
  );

  const isProd = process.env.NODE_ENV === 'production';
  if (!options.skipFrontend) {
    if (!isProd) {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distDir = path.resolve(__dirname, 'dist');
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  return app;
}

export async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const app = await createApp();

  if (
    isProd &&
    !process.env.AUTH_JWT_SECRET?.trim() &&
    !process.env.SESSION_SECRET?.trim()
  ) {
    console.warn(
      '[KasKu Kargo] AUTH_JWT_SECRET belum diatur. Menggunakan secret sementara di memori; atur AUTH_JWT_SECRET di Environment Dokploy agar sesi tetap aktif saat container restart.'
    );
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`KasKu Kargo server listening on http://0.0.0.0:${PORT}`);
  });

  const shutdown = (signal: string) => {
    console.log(`[KasKu Kargo] Menerima sinyal ${signal}, menutup server...`);
    server.close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  return server;
}

const isMainModule =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === path.resolve(__filename);

if (isMainModule) {
  startServer();
}
