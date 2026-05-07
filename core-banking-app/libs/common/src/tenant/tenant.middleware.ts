import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { TenantContext } from './tenant-context';
import { JwtPayload } from '../types/jwt-payload.interface';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly ctx: TenantContext) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const payload = jwt.decode(token) as JwtPayload | null;
        if (payload) {
          this.ctx.tenantId = payload.tenantId;
          this.ctx.userId = payload.sub;
          this.ctx.branchId = payload.branchId;
          this.ctx.sessionId = payload.sessionId;
        }
      } catch {
        // Invalid token format — JwtAuthGuard will reject it
      }
    }
    next();
  }
}
