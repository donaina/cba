import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '@libs/database';

const REDACTED = '[REDACTED]';
const SENSITIVE_KEYS = new Set([
  'password', 'pin', 'otp', 'bvn', 'nin',
  'cardNumber', 'cvv', 'refreshToken',
]);

function redact(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redact);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEYS.has(k) ? REDACTED : redact(v);
  }
  return out;
}

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = Date.now();
    const req = context.switchToHttp().getRequest();
    const method: string = req.method;

    if (!['POST', 'PATCH', 'DELETE', 'PUT'].includes(method)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async (responseBody) => {
        const res = context.switchToHttp().getResponse();
        const durationMs = Date.now() - start;
        try {
          await this.prisma.auditLog.create({
            data: {
              tenantId: req.user?.tenantId ?? null,
              userId: req.user?.sub ?? null,
              sessionId: req.user?.sessionId ?? null,
              ipAddress: req.ip,
              userAgent: req.headers['user-agent'],
              method,
              path: req.path,
              statusCode: res.statusCode,
              durationMs,
              requestBody: redact(req.body) as object,
              responseCode: (responseBody as Record<string, unknown>)?.code as string ?? null,
            },
          });
        } catch {
          // audit failure must never break the request
        }
      }),
    );
  }
}
