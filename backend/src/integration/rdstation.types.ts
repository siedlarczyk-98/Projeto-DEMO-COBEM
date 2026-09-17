/** Perfis que a LP coleta — espelha o enum do Prisma. */
export type PerfilLead = 'ALUNO' | 'PROFESSOR';

/** Dados do lead que interessam para a conversão no RD. */
export interface RdLeadInput {
  nome: string;
  email: string;
  telefone: string;
  perfil: PerfilLead;
}

/**
 * Corpo do POST /platform/conversions.
 * O `payload` aceita campos livres (cf_*), por isso o index signature.
 */
export interface RdConversionEvent {
  event_type: 'CONVERSION';
  event_family: 'CDP';
  payload: {
    conversion_identifier: string;
    name?: string;
    email: string;
    personal_phone?: string;
    tags?: string[];
    available_for_mailing?: boolean;
    [campoCustomizado: string]: unknown;
  };
}

export interface RdConversionResult {
  ok: boolean;
  /** id do evento devolvido pelo RD (útil para auditoria). */
  eventUuid?: string;
  status?: number;
  erro?: string;
  /** true quando não há credenciais configuradas — não é falha. */
  desativado?: boolean;
}
