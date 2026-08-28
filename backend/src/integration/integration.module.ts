import { Module } from '@nestjs/common';
import { Paciente360Service } from './paciente360.service';
import { RdStationService } from './rdstation.service';

@Module({
  providers: [Paciente360Service, RdStationService],
  exports: [Paciente360Service, RdStationService],
})
export class IntegrationModule {}
