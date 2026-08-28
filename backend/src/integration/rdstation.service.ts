import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  RdConversionEvent,
  RdConversionResult,
  RdLeadInput,
} from './rdstation.types';

const RD_API_BASE = 'https://api.rd.services';

/** 5xx e 429 valem retry; 4xx de validação não (reenviar não muda nada). */
const STATUS_RETENTAVEIS = new Set([408, 425, 429, 500, 502, 503, 504]);

/**
 * Envia a conversão do lead para o RD Station Marketing.
 *
 * Duas formas de autenticação, escolhidas por ordem de precedência:
 *  1. OAuth (RD_CLIENT_ID + RD_CLIENT_SECRET + RD_REFRESH_TOKEN) — recomendado
 *     em produção: o access_token vive ~24h e é renovado aqui, em memória.
 *  2. Chave pública (RD_PUBLIC_API_KEY) — vai na query string, sem refresh.
 *     Mais simples para a demo, mas só serve para o endpoint de conversões.
 *
 * Sem nenhuma das duas o serviço fica DESATIVADO: não lança erro, só devolve
 * `{ desativado: true }`. Assim a LP roda em dev sem credenciais do RD.
 */
@Injectable()
export class RdStationService {
  private readonly logger = new Logger(RdStationService.name);

  /** Cache do access_token do OAuth: expiraEm em epoch ms. */
  private tokenCache?: { token: string; expiraEm: number };
  /** Evita N refreshes simultâneos quando vários leads chegam juntos. */
  private refreshEmVoo?: Promise<string>;

  constructor(private readonly config: ConfigService) {}

  private get publicApiKey(): string | undefined {
    return this.config.get<string>('RD_PUBLIC_API_KEY') || undefined;
  }

  private get credenciaisOAuth() {
    const clientId = this.config.get<string>('RD_CLIENT_ID');
    const clientSecret = this.config.get<string>('RD_CLIENT_SECRET');
    const refreshToken = this.config.get<string>('RD_REFRESH_TOKEN');
    if (!clientId || !clientSecret || !refreshToken) return undefined;
    return { clientId, clientSecret, refreshToken };
  }

  /** true quando há alguma credencial utilizável. */
  get habilitado(): boolean {
    return Boolean(this.credenciaisOAuth ?? this.publicApiKey);
  }

  // --------------------------------------------------------------- OAuth ---

  private async obterAccessToken(forcarRenovacao = false): Promise<string> {
    const cred = this.credenciaisOAuth;
    if (!cred) throw new Error('OAuth do RD não configurado.');

    // Margem de 60s para não usar um token que expira no meio do voo.
    if (
      !forcarRenovacao &&
      this.tokenCache &&
      this.tokenCache.expiraEm - 60_000 > Date.now()
    ) {
      return this.tokenCache.token;
    }

    if (this.refreshEmVoo) return this.refreshEmVoo;

    this.refreshEmVoo = (async () => {
      const res = await fetch(`${RD_API_BASE}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: cred.clientId,
          client_secret: cred.clientSecret,
          refresh_token: cred.refreshToken,
        }),
      });

      const corpo = await res.text();
      if (!res.ok) {
        throw new Error(
          `Falha ao renovar token do RD (HTTP ${res.status}): ${corpo.slice(0, 300)}`,
        );
      }

      const json = JSON.parse(corpo) as {
        access_token: string;
        expires_in?: number;
      };
      this.tokenCache = {
        token: json.access_token,
        expiraEm: Date.now() + (json.expires_in ?? 86_400) * 1000,
      };
      this.logger.log('access_token do RD renovado.');
      return json.access_token;
    })();

    try {
      return await this.refreshEmVoo;
    } finally {
      this.refreshEmVoo = undefined;
    }
  }

  // -------------------------------------------------------------- Payload ---

  /** O RD guarda telefone em formato internacional; nós guardamos só dígitos. */
  private formatarTelefone(telefone: string): string | undefined {
    const digitos = String(telefone ?? '').replace(/\D/g, '');
    if (digitos.length < 10) return undefined;
    return digitos.startsWith('55') && digitos.length > 11
      ? `+${digitos}`
      : `+55${digitos}`;
  }

  /**
   * Tags são o gancho da régua pós-evento: dá para segmentar a automação por
   * evento (RD_TAGS) e por perfil (perfil-aluno / perfil-professor) sem
   * depender de campo customizado.
   */
  private montarTags(lead: RdLeadInput): string[] {
    const base = (this.config.get<string>('RD_TAGS') ?? '')
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    return Array.from(new Set([...base, `perfil-${lead.perfil.toLowerCase()}`]));
  }

  montarEvento(lead: RdLeadInput): RdConversionEvent {
    const identificador =
      this.config.get<string>('RD_CONVERSION_IDENTIFIER') || 'cobem-lp';

    // Nome de API do campo customizado no RD (precisa existir na conta).
    // Vazio = não envia, evitando 400 por campo inexistente.
    const campoPerfil = this.config.get<string>('RD_CAMPO_PERFIL')?.trim();

    const payload: RdConversionEvent['payload'] = {
      conversion_identifier: identificador,
      name: lead.nome,
      email: lead.email,
      personal_phone: this.formatarTelefone(lead.telefone),
      tags: this.montarTags(lead),
      available_for_mailing: true,
    };

    if (campoPerfil) payload[campoPerfil] = lead.perfil;

    // Remove chaves vazias para não sobrescrever dados já existentes no RD.
    for (const [chave, valor] of Object.entries(payload)) {
      if (valor === undefined || valor === null || valor === '') {
        delete payload[chave];
      }
    }

    return { event_type: 'CONVERSION', event_family: 'CDP', payload };
  }

  // ---------------------------------------------------------------- Envio ---

  private async postConversao(
    evento: RdConversionEvent,
  ): Promise<{ status: number; corpo: string }> {
    const cred = this.credenciaisOAuth;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    let url = `${RD_API_BASE}/platform/conversions`;

    if (cred) {
      headers.Authorization = `Bearer ${await this.obterAccessToken()}`;
    } else {
      url += `?api_key=${encodeURIComponent(this.publicApiKey as string)}`;
    }

    const timeout = Number(this.config.get('RD_TIMEOUT_MS')) || 8000;
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(evento),
      signal: AbortSignal.timeout(timeout),
    });

    return { status: res.status, corpo: await res.text() };
  }

  /**
   * Envia com backoff exponencial nos erros transitórios.
   * Nunca lança: quem chama decide o que fazer com `ok: false`.
   */
  async enviarConversao(
    lead: RdLeadInput,
    tentativas = 3,
  ): Promise<RdConversionResult> {
    if (!this.habilitado) {
      this.logger.warn(
        `RD Station sem credenciais — conversão de ${lead.email} não enviada.`,
      );
      return { ok: false, desativado: true, erro: 'RD Station não configurado' };
    }

    const evento = this.montarEvento(lead);
    let ultimoErro = 'erro desconhecido';
    let ultimoStatus: number | undefined;

    for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
      try {
        const { status, corpo } = await this.postConversao(evento);

        if (status >= 200 && status < 300) {
          this.logger.log(
            `Conversão "${evento.payload.conversion_identifier}" enviada ao RD (${lead.email})`,
          );
          return { ok: true, status, eventUuid: this.extrairUuid(corpo) };
        }

        ultimoStatus = status;
        ultimoErro = `HTTP ${status}: ${corpo.slice(0, 300)}`;

        // Token pode ser revogado antes de expirar: renova e tenta de novo.
        if (status === 401 && this.credenciaisOAuth) {
          await this.obterAccessToken(true).catch(() => undefined);
        } else if (!STATUS_RETENTAVEIS.has(status)) {
          break;
        }
      } catch (e) {
        ultimoErro = e instanceof Error ? e.message : String(e);
      }

      if (tentativa < tentativas) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** (tentativa - 1)));
      }
    }

    this.logger.error(
      `Falha ao enviar ${lead.email} ao RD após ${tentativas} tentativa(s): ${ultimoErro}`,
    );
    return { ok: false, status: ultimoStatus, erro: ultimoErro };
  }

  private extrairUuid(corpo: string): string | undefined {
    try {
      return (JSON.parse(corpo) as { event_uuid?: string })?.event_uuid;
    } catch {
      return undefined;
    }
  }
}
