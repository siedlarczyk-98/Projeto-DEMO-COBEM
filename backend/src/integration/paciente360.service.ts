import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as CryptoJS from 'crypto-js';
import {
  LeadInput,
  P360Overrides,
  P360Payload,
  P360Role,
} from './paciente360.types';

/**
 * Monta o payload do Paciente 360, criptografa em AES-256 e devolve a URL final.
 *
 * IMPORTANTE: usamos crypto-js de proposito. `CryptoJS.AES.encrypt(texto, senha)`
 * com senha em string não é AES "cru": ele aplica o esquema OpenSSL
 * (salt aleatório de 8 bytes + EVP_BytesToKey/MD5) e serializa como
 * Base64("Salted__" + salt + ciphertext). O Paciente 360 espera exatamente
 * esse formato, então replicar com o `crypto` nativo do Node só adicionaria
 * risco de incompatibilidade.
 */
@Injectable()
export class Paciente360Service {
  private readonly logger = new Logger(Paciente360Service.name);

  constructor(private readonly config: ConfigService) {}

  /** aluno -> usuario | professor -> professor */
  private mapRole(perfil: LeadInput['perfil']): P360Role {
    return perfil === 'PROFESSOR' ? 'professor' : 'usuario';
  }

  /** Remove chaves vazias/undefined para não poluir o JSON criptografado. */
  private compact<T extends Record<string, any>>(obj: T): T {
    return Object.fromEntries(
      Object.entries(obj).filter(
        ([, v]) => v !== undefined && v !== null && v !== '',
      ),
    ) as T;
  }

  buildPayload(lead: LeadInput, overrides: P360Overrides = {}): P360Payload {
    const clientId = this.config.get<string>('P360_CLIENT_ID');
    const clientKey = this.config.get<string>('P360_CLIENT_KEY');

    if (!clientId || !clientKey) {
      throw new Error(
        'P360_CLIENT_ID e P360_CLIENT_KEY precisam estar definidos no .env',
      );
    }

    const payload: P360Payload = {
      client_id: clientId,
      client_key: clientKey,
      curso_id: overrides.curso_id ?? this.config.get<string>('P360_CURSO_ID'),
      back_url: overrides.back_url ?? this.config.get<string>('P360_BACK_URL'),
      class_id: overrides.class_id ?? this.config.get<string>('P360_CLASS_ID'),
      client_lang:
        overrides.client_lang ?? this.config.get<string>('P360_CLIENT_LANG'),
      user: this.compact({
        name: lead.nome,
        email: lead.email,
        role: this.mapRole(lead.perfil),
      }),
    };

    return this.compact(payload);
  }

  /** JSON -> AES-256 (formato OpenSSL/CryptoJS) -> Base64 */
  encrypt(payload: P360Payload): string {
    return CryptoJS.AES.encrypt(
      JSON.stringify(payload),
      payload.client_key,
    ).toString();
  }

  /** Ponto de entrada: lead -> URL pronta para redirecionar. */
  buildUrl(
    lead: LeadInput,
    overrides: P360Overrides = {},
  ): { hash: string; url: string } {
    const payload = this.buildPayload(lead, overrides);
    const hash = this.encrypt(payload);
    const baseUrl = this.config.get<string>('P360_BASE_URL');

    // encodeURIComponent é obrigatório: o Base64 contém +, / e =,
    // e um "+" não escapado vira espaço no destino.
    const url = `${baseUrl}?h=${encodeURIComponent(hash)}`;

    this.logger.log(`URL gerada para ${lead.email} (${payload.user.role})`);
    return { hash, url };
  }
}
