export type P360Role = 'admin' | 'professor' | 'usuario';

export interface P360User {
  name: string;
  email: string;
  role?: P360Role;
  crm?: string;
  crm_uf?: string;
}

export interface P360Payload {
  client_id: string;
  client_key: string;
  curso_id?: string;
  back_url?: string;
  class_id?: string;
  client_lang?: string;
  user: P360User;
}

/** Dados que o nosso lado conhece sobre o lead. */
export interface LeadInput {
  nome: string;
  email: string;
  perfil: 'ALUNO' | 'PROFESSOR';
}

/** Overrides opcionais por requisição (sobrepõem o .env). */
export interface P360Overrides {
  curso_id?: string;
  back_url?: string;
  class_id?: string;
  client_lang?: string;
}
