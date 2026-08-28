import { Body, Controller, Get, Ip, Post } from '@nestjs/common';
import { Headers } from '@nestjs/common';
import { CreateLeadDto } from './dto/create-lead.dto';
import { LeadsService } from './leads.service';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Post()
  create(
    @Body() dto: CreateLeadDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.leads.create(dto, { ip, userAgent });
  }

  /** Listagem simples para conferência durante a demo. */
  @Get()
  findAll() {
    return this.leads.findAll();
  }
}
