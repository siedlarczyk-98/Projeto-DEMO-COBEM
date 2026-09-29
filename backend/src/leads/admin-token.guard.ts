import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

/**
 * Protege as rotas administrativas (listagem de leads e resync do RD).
 *
 * Aceita o token em:
 *  - `Authorization: Bearer <token>` ou `x-admin-token: <token>` (curl/scripts)
 *  - `?token=<token>` (conferência rápida pelo navegador)
 *
 * Sem ADMIN_TOKEN configurado a rota fica FECHADA — nunca pública por omissão.
 */
@Injectable()
export class AdminTokenGuard implements CanActivate {
  private readonly logger = new Logger(AdminTokenGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const esperado = this.config.get<string>('ADMIN_TOKEN')?.trim();
    if (!esperado) {
      this.logger.warn('ADMIN_TOKEN não configurado — rota administrativa bloqueada.');
      throw new UnauthorizedException();
    }

    const req = context.switchToHttp().getRequest<Request>();
    const recebido = this.extrairToken(req);
    if (!recebido || !this.iguais(recebido, esperado)) {
      throw new UnauthorizedException();
    }
    return true;
  }

  private extrairToken(req: Request): string | undefined {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) return auth.slice(7).trim();

    const header = req.headers['x-admin-token'];
    if (typeof header === 'string') return header.trim();

    const query = req.query.token;
    if (typeof query === 'string') return query.trim();

    return undefined;
  }

  /** Compara por hash para não vazar o tamanho nem o conteúdo por timing. */
  private iguais(a: string, b: string): boolean {
    const hash = (s: string) => createHash('sha256').update(s).digest();
    return timingSafeEqual(hash(a), hash(b));
  }
}
