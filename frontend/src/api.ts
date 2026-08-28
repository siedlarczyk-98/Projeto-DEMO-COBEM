export type Perfil = 'ALUNO' | 'PROFESSOR';

export interface LeadPayload {
  nome: string;
  email: string;
  telefone: string;
  perfil: Perfil;
  curso_id?: string;
  class_id?: string;
  back_url?: string;
}

export interface LeadResponse {
  leadId: string;
  redirectUrl: string;
}

const BASE = import.meta.env.VITE_API_URL ?? '';

/** Erro com as mensagens de validação vindas do Nest. */
export class ApiError extends Error {
  constructor(public readonly messages: string[]) {
    super(messages[0] ?? 'Erro inesperado.');
  }
}

export async function criarLead(payload: LeadPayload): Promise<LeadResponse> {
  const res = await fetch(`${BASE}/api/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const msg = body?.message;
    throw new ApiError(
      Array.isArray(msg) ? msg : [msg ?? 'Não foi possível enviar seus dados.'],
    );
  }

  return res.json();
}
