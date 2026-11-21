import 'dotenv/config';
import express, { type Express } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { closeDb, getConnectionMetadata } from './src/db/index.js';
import { isSupabaseConfigured } from './src/server/supabase.js';
import { getExpressApp as buildBaseExpressApp, getPgErrorCode } from './src/server/app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function mountStandaloneFrontend(app: Express): Promise<void> {
  if (process.env.VERCEL) {
    return;
  }

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    return;
  }

  const distPath = path.join(__dirname, 'dist');
  const indexHtmlPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexHtmlPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(indexHtmlPath);
    });
  } else {
    app.get('/', (_req, res) => {
      res.json({
        ok: true,
        service: 'Pragati University CSE Portal API',
        health: '/api/health',
      });
    });
  }
}

export function getExpressApp(): Promise<Express> {
  return buildBaseExpressApp({
    mountFrontend: mountStandaloneFrontend,
  });
}

async function startServer(): Promise<void> {
  const app = await getExpressApp();
  const PORT = Number(process.env.PORT) || 3000;

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Pragati University CSE Portal server running on http://0.0.0.0:${PORT}`);
    if (!isSupabaseConfigured()) {
      console.warn(
        '[Startup Notice] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set in environment.'
      );
    }
    const dbMeta = getConnectionMetadata();
    if (!dbMeta.configured || dbMeta.connectionMode === 'invalid_url') {
      console.warn(
        '[Startup Notice] DATABASE_URL is missing or invalid in environment.'
      );
    } else if (dbMeta.ipv4PoolerRecommended) {
      console.warn(
        '[Startup Warning] DATABASE_URL points to a direct Supabase host (*.supabase.co). Switch to the Supabase Session Pooler (port 5432) or Transaction Pooler (port 6543, *.pooler.supabase.com) to avoid IPv4 ENETUNREACH errors.'
      );
    }
    if (
      process.env.NODE_ENV === 'production' &&
      !(process.env.CODING_VERIFY_HMAC_SECRET || '').trim()
    ) {
      console.warn(
        '[Startup Notice] CODING_VERIFY_HMAC_SECRET is not set; using derived service key for coding ownership verification.'
      );
    }
  });

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[Shutdown] Received ${signal}; closing HTTP server and database pool...`);
    const forceTimer = setTimeout(() => {
      console.error('[Shutdown] Timed out waiting for connections; exiting.');
      process.exit(1);
    }, 10000);
    forceTimer.unref();

    server.close(async () => {
      await closeDb();
      clearTimeout(forceTimer);
      process.exit(0);
    });
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

process.on('unhandledRejection', (reason) => {
  const code = getPgErrorCode(reason);
  const label = code || (reason instanceof Error ? reason.name : 'UnknownRejection');
  console.error('[Process Warning] Unhandled promise rejection:', label);
});

if (!process.env.VERCEL) {
  startServer().catch((err) => {
    const code = getPgErrorCode(err);
    console.error('[Fatal Startup Error]', code || (err instanceof Error ? err.name : 'StartupError'));
    process.exit(1);
  });
}
