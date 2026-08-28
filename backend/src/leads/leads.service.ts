import { Injectable, Logger } from '@nestjs/common';
import { Perfil } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Paciente360Service } from '../integration/paciente360.service';
import { CreateLeadDto } from './dto/create-lead.dto';

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly p360: Paciente360Service,
  ) {}

  /**
   * Persiste o lead e devolve a URL de acesso ao Paciente 360.
   * O lead é salvo ANTES da geração da hash: mesmo que a montagem falhe
   * (ex.: client_key ausente), o contato não se perde.
   */
  async create(dto: CreateLeadDto, meta: RequestMeta = {}) {
    const lead = await this.prisma.lead.create({
      data: {
        nome: dto.nome,
        email: dto.email,
        telefone: dto.telefone,
        perfil: dto.perfil as Perfil,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    const { hash, url } = this.p360.buildUrl(
      { nome: lead.nome, email: lead.email, perfil: lead.perfil },
      {
        curso_id: dto.curso_id,
        class_id: dto.class_id,
        back_url: dto.back_url,
      },
    );

    await this.prisma.lead.update({
      where: { id: lead.id },
      data: { hash, redirectUrl: url },
    });

    this.logger.log(`Lead ${lead.id} registrado (${lead.email})`);
    return { leadId: lead.id, redirectUrl: url };
  }

  findAll() {
    return this.prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        perfil: true,
        createdAt: true,
      },
    });
  }
}
