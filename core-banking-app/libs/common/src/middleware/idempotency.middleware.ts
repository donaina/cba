import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

interface CacheEntry {
  statusCode: number;
  body: unknown;
  createdAt: number;
}

const TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const key = req.headers['idempotency-key'] as string | undefined;
    if (!key) {
      next();
      return;
    }

    const now = Date.now();
    const entry = cache.get(key);

    if (entry && now - entry.createdAt < TTL_MS) {
      res.status(entry.statusCode).json(entry.body);
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      cache.set(key, { statusCode: res.statusCode, body, createdAt: Date.now() });
      return originalJson(body);
    };

    (req as Request & { idempotencyKey?: string }).idempotencyKey = key;
    next();
  }
}
