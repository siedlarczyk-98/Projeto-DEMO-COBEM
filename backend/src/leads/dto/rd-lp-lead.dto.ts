import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

/**
 * Corpo enviado pelo script injetado na LP hospedada no RD Station.
 * Os nomes dos campos são os `name` do formulário do RD — o mapeamento para
 * o nosso modelo acontece no service (rd-lp.mapper.ts).
 *
 * A validação é mais tolerante que a da LP própria: quando esta rota é
 * chamada, o RD já aceitou a conversão, então só barramos o que impede de
 * montar o acesso ao P360.
 */
export class RdLpLeadDto {
  @IsString()
  @Transform(({ value }) => String(value ?? '').trim().replace(/\s+/g, ' '))
  @Length(2, 120, { message: 'Nome inválido.' })
  name: string;

  @Transform(({ value }) => String(value ?? '').trim().toLowerCase())
  @IsEmail({}, { message: 'E-mail inválido.' })
  email: string;

  /** "Empresa" na LP do RD — usamos como IES. */
  @IsString()
  @Transform(({ value }) => String(value ?? '').trim().replace(/\s+/g, ' '))
  @Length(2, 160, { message: 'Informe a instituição.' })
  company: string;

  /** Vem com máscara e às vezes com +55; guardamos só os dígitos. */
  @Transform(({ value }) => String(value ?? '').replace(/\D/g, ''))
  @Matches(/^\d{8,15}$/, { message: 'Telefone inválido.' })
  mobile_phone: string;

  /**
   * "Você é": Direção, Coordenação, Professor, Administrativo, Aluno, Outro.
   * Opcional: há LPs sem esse campo (ex.: live360-indicacao-alunos). Vazio
   * cai no padrão do mapper (ALUNO), o de menor privilégio.
   */
  @IsOptional()
  @IsString()
  @Transform(({ value }) => String(value ?? '').trim())
  @MaxLength(60, { message: 'Perfil inválido.' })
  cf_voce_e?: string;
}
