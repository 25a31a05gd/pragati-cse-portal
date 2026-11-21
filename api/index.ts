import type { IncomingMessage, ServerResponse } from 'http';
import { getExpressApp } from '../src/server/app.js';

function sanitizeLogText(raw: string): string {
  return raw
    .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, 'postgresql://[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[JWT_REDACTED]')
    .replace(/(password|secret|service_role|token|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL_REDACTED]');
}

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
            console.error('[Vercel API Handler Error]', {
              errorName: err instanceof Error ? err.name : typeof err,
              message: sanitizeLogText(err instanceof Error ? err.message : String(err)),
              stack:
                err instanceof Error && err.stack
                  ? sanitizeLogText(err.stack.split('\n').slice(0, 8).join('\n'))
                  : undefined,
            });
            sendJsonFallbackError(
              res,
              503,
              'Backend API could not complete this request. Verify DATABASE_URL and Supabase environment secrets.'
            );
          }
          done();
        }
      );
    });
  } catch (err) {
    console.error('[Vercel API Bootstrap Error]', {
      errorName: err instanceof Error ? err.name : typeof err,
      message: sanitizeLogText(err instanceof Error ? err.message : String(err)),
      stack:
        err instanceof Error && err.stack
          ? sanitizeLogText(err.stack.split('\n').slice(0, 8).join('\n'))
          : undefined,
    });
    sendJsonFallbackError(
      res,
      503,
      'Backend API failed to initialize on serverless runtime. Verify backend environment configuration on Vercel.'
    );
  }
}
