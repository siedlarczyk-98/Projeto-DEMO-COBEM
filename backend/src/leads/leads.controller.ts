import {
  Body,
  Controller,
  Get,
  Ip,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Headers } from '@nestjs/common';
import { CreateLeadDto } from './dto/create-lead.dto';
import { RdLpLeadDto } from './dto/rd-lp-lead.dto';
import { LeadsService } from './leads.service';
import { AdminTokenGuard } from './admin-token.guard';

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

  /**
   * Chamado pelo script injetado na LP hospedada no RD Station, depois que o
   * RD confirma a conversão. Ver rd-lp/script-lp.html.
   */
  @Post('rd-lp')
  createFromRdLp(
    @Body() dto: RdLpLeadDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.leads.createFromRdLp(dto, { ip, userAgent });
  }

  /**
   * Reenvia ao RD Station os leads que falharam ou ficaram pendentes.
   * Rodar depois do evento, antes de ligar a régua de comunicação.
   */
  @Post('rd/resync')
  @UseGuards(AdminTokenGuard)
  resyncRd(@Query('limite') limite?: string) {
    return this.leads.resyncRd(Number(limite) || 100);
  }

  /** Listagem para conferência — exige ADMIN_TOKEN (tem dados pessoais). */
  @Get()
  @UseGuards(AdminTokenGuard)
  findAll() {
    return this.leads.findAll();
  }
}
