import { Module } from '@nestjs/common';
import { Paciente360Service } from './paciente360.service';

@Module({
  providers: [Paciente360Service],
  exports: [Paciente360Service],
})
export class IntegrationModule {}
