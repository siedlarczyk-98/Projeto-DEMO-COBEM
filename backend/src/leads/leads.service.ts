import { Injectable, Logger } from '@nestjs/common';
import { Lead, Perfil, RdStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Paciente360Service } from '../integration/paciente360.service';
import { RdStationService } from '../integration/rdstation.service';
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
    private readonly rd: RdStationService,
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

    // Fire-and-forget: o lead não pode esperar o RD para ser redirecionado.
    // Quem falhar fica com rdStatus = FALHOU e volta no /leads/rd/resync.
    void this.sincronizarComRd(lead);

    this.logger.log(`Lead ${lead.id} registrado (${lead.email})`);
    return { leadId: lead.id, redirectUrl: url };
  }

  /**
   * Envia a conversão ao RD e grava o resultado na própria linha do lead.
   * Não lança: é chamada sem await no fluxo do formulário.
   */
  private async sincronizarComRd(lead: Lead): Promise<RdStatus> {
    const resultado = await this.rd.enviarConversao({
      nome: lead.nome,
      email: lead.email,
      telefone: lead.telefone,
      perfil: lead.perfil,
    });

    // Sem credenciais não é falha operacional — marcamos DESATIVADO para o
    // resync não ficar tentando reenviar leads de ambiente sem RD.
    const status: RdStatus = resultado.ok
      ? RdStatus.ENVIADO
      : resultado.desativado
        ? RdStatus.DESATIVADO
        : RdStatus.FALHOU;

    try {
      await this.prisma.lead.update({
        where: { id: lead.id },
        data: {
          rdStatus: status,
          rdSyncedAt: resultado.ok ? new Date() : null,
          rdEventUuid: resultado.eventUuid ?? null,
          rdError: resultado.ok ? null : (resultado.erro ?? null),
          rdAttempts: { increment: 1 },
        },
      });
    } catch (e) {
      // Banco fora do ar no meio do fire-and-forget não pode derrubar o processo.
      this.logger.error(
        `Não foi possível gravar o status do RD no lead ${lead.id}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }

    return status;
  }

  /**
   * Reprocessa os leads que falharam no envio ao RD (e os que ficaram
   * PENDENTE por queda no meio do caminho). Útil depois do evento, quando a
   * régua de comunicação depende de todo mundo estar na base do RD.
   */
  async resyncRd(limite = 100) {
    const pendentes = await this.prisma.lead.findMany({
      where: { rdStatus: { in: [RdStatus.FALHOU, RdStatus.PENDENTE] } },
      orderBy: { createdAt: 'asc' },
      take: Math.min(Math.max(limite, 1), 500),
    });

    let enviados = 0;
    let falhas = 0;

    // Sequencial de propósito: o RD limita requisições por conta e o volume
    // de um evento não justifica paralelizar.
    for (const lead of pendentes) {
      const status = await this.sincronizarComRd(lead);
      if (status === RdStatus.ENVIADO) enviados++;
      else falhas++;
    }

    this.logger.log(
      `Resync RD: ${enviados} enviado(s), ${falhas} pendente(s) de ${pendentes.length}.`,
    );
    return { processados: pendentes.length, enviados, falhas };
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
        rdStatus: true,
        rdSyncedAt: true,
        rdError: true,
      },
    });
  }
}
