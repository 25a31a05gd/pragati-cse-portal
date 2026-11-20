import type { IncomingMessage, ServerResponse } from 'http';
import { getExpressApp } from '../server';

function sendJsonFallbackError(
  res: ServerResponse,
  statusCode: number,
  message: string
): void {
  if (res.headersSent) return;
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({ error: message }));
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const app = await getExpressApp();
    await new Promise<void>((resolve) => {
      let settled = false;
      const done = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };

      res.once('finish', done);
      res.once('close', done);

      app(
        req as Parameters<typeof app>[0],
        res as Parameters<typeof app>[1],
        (err?: unknown) => {
          if (err) {
            console.error(
              '[Vercel API Handler Error]',
              err instanceof Error ? err.name : 'UnhandledError'
            );
            sendJsonFallbackError(
              res,
              503,
              'Backend API could not complete this request. Verify DATABASE_URL, Supabase secrets, or VITE_API_BASE_URL if hosted on Render.'
            );
          }
          done();
        }
      );
    });
  } catch (err) {
    console.error(
      '[Vercel API Bootstrap Error]',
      err instanceof Error ? err.name : 'BootstrapError'
    );
    sendJsonFallbackError(
      res,
      503,
      'Backend API failed to initialize on serverless runtime. Verify backend environment configuration.'
    );
  }
}
