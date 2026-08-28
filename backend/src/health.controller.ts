import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Usado pelo healthcheck do Railway. */
  @Get()
  async check() {
    let db = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'erro';
    }
    return { status: db === 'ok' ? 'ok' : 'degradado', db, ts: new Date().toISOString() };
  }
}
