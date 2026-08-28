import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { LeadsModule } from './leads/leads.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // A LP compilada (vite build) e copiada para backend/public no Dockerfile.
    // exclude evita que o static engula as rotas da API.
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      exclude: ['/api/{*rest}'],
    }),

    PrismaModule,
    LeadsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
