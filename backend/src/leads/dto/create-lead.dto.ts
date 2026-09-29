import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export enum PerfilDto {
  ALUNO = 'ALUNO',
  PROFESSOR = 'PROFESSOR',
  COORDENADOR = 'COORDENADOR',
  REITORIA = 'REITORIA',
}

export class CreateLeadDto {
  @IsString()
  @Transform(({ value }) => String(value ?? '').trim().replace(/\s+/g, ' '))
  @Length(3, 120, { message: 'Informe seu nome completo.' })
  nome: string;

  @Transform(({ value }) => String(value ?? '').trim().toLowerCase())
  @IsEmail({}, { message: 'E-mail inválido.' })
  email: string;

  /** Guardamos só os dígitos: 10 (fixo) ou 11 (celular) com DDD. */
  @Transform(({ value }) => String(value ?? '').replace(/\D/g, ''))
  @Matches(/^\d{10,11}$/, { message: 'Telefone inválido. Use DDD + número.' })
  telefone: string;

  @IsEnum(PerfilDto, {
    message: 'Perfil deve ser ALUNO, PROFESSOR, COORDENADOR ou REITORIA.',
  })
  perfil: PerfilDto;

  /** Instituicao de Ensino Superior a que o lead esta vinculado. */
  @IsString()
  @Transform(({ value }) => String(value ?? '').trim().replace(/\s+/g, ' '))
  @Length(2, 160, { message: 'Informe a universidade (IES).' })
  ies: string;

  // Overrides opcionais — úteis para campanhas/turmas diferentes na mesma LP.
  @IsOptional() @IsString() curso_id?: string;
  @IsOptional() @IsString() class_id?: string;
  @IsOptional() @IsString() back_url?: string;
}
