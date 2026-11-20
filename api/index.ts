import type { IncomingMessage, ServerResponse } from 'http';
import { getExpressApp } from '../server';

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const app = await getExpressApp();
  await new Promise<void>((resolve, reject) => {
    res.once('finish', resolve);
    res.once('close', resolve);
    app(
      req as Parameters<typeof app>[0],
      res as Parameters<typeof app>[1],
      (err?: unknown) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}
