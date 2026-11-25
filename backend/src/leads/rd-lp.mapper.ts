import { Perfil } from '@prisma/client';

const semAcento = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * "Você é" da LP do RD -> perfil interno.
 *
 *  Professor                  -> PROFESSOR   (P360: professor)
 *  Coordenação, Direção       -> COORDENADOR (P360: professor)
 *  Aluno, Administrativo,
 *  Outro e qualquer valor novo -> ALUNO       (P360: usuario)
 *
 * O padrão é ALUNO de propósito: uma opção nova criada na LP sem ajustar
 * este mapa entra com o menor privilégio, nunca como professor.
 */
export function mapearPerfilRdLp(valor: string): Perfil {
  switch (semAcento(valor)) {
    case 'professor':
      return Perfil.PROFESSOR;
    case 'coordenacao':
    case 'direcao':
      return Perfil.COORDENADOR;
    default:
      return Perfil.ALUNO;
  }
}

/** Remove o DDI 55 quando o campo de telefone do RD o inclui. */
export function normalizarTelefoneRdLp(digitos: string): string {
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')) {
    return digitos.slice(2);
  }
  return digitos;
}
