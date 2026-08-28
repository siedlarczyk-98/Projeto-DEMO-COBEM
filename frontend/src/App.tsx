import { useState, type FormEvent } from 'react';
import { ApiError, criarLead, type Perfil } from './api';
import { maskPhone, onlyDigits } from './phone';
import logo from './assets/logo.png';
import './styles.css';

type Status = 'idle' | 'enviando' | 'redirecionando';

export default function App() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [perfil, setPerfil] = useState<Perfil | ''>('');
  const [status, setStatus] = useState<Status>('idle');
  const [erros, setErros] = useState<string[]>([]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (status !== 'idle') return;

    setErros([]);
    setStatus('enviando');

    try {
      const { redirectUrl } = await criarLead({
        nome,
        email,
        telefone: onlyDigits(telefone),
        perfil: perfil as Perfil,
      });

      // Feedback antes de sair da página — o destino é externo.
      setStatus('redirecionando');
      window.location.href = redirectUrl;
    } catch (err) {
      setErros(
        err instanceof ApiError ? err.messages : ['Falha de conexão. Tente novamente.'],
      );
      setStatus('idle');
    }
  }

  if (status === 'redirecionando') {
    return (
      <main className="lp">
        <div className="card">
          <img src={logo} alt="Paciente 360" className="logo" />
          <div className="spinner" aria-hidden="true" />
          <h1>Tudo certo, {nome.split(' ')[0]}!</h1>
          <p className="muted">Estamos te levando para a plataforma…</p>
        </div>
      </main>
    );
  }

  const enviando = status === 'enviando';

  return (
    <main className="lp">
      <form className="card" onSubmit={handleSubmit} noValidate>
        <img src={logo} alt="Paciente 360" className="logo" />
        <h1>Acesse a plataforma</h1>
        <p className="muted">Preencha seus dados para começar.</p>

        {erros.length > 0 && (
          <div className="erro" role="alert">
            {erros.map((m) => (
              <div key={m}>{m}</div>
            ))}
          </div>
        )}

        <label>
          Nome completo
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Seu nome"
            autoComplete="name"
            required
          />
        </label>

        <label>
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
            autoComplete="email"
            required
          />
        </label>

        <label>
          Telefone
          <input
            inputMode="numeric"
            value={telefone}
            onChange={(e) => setTelefone(maskPhone(e.target.value))}
            placeholder="(11) 98765-4321"
            autoComplete="tel"
            required
          />
        </label>

        <fieldset className="perfil">
          <legend>Você é</legend>
          {(['ALUNO', 'PROFESSOR'] as const).map((p) => (
            <label key={p} className={perfil === p ? 'opcao ativa' : 'opcao'}>
              <input
                type="radio"
                name="perfil"
                value={p}
                checked={perfil === p}
                onChange={() => setPerfil(p)}
                required
              />
              {p === 'ALUNO' ? 'Aluno' : 'Professor'}
            </label>
          ))}
        </fieldset>

        <button type="submit" disabled={enviando}>
          {enviando ? 'Enviando…' : 'Acessar plataforma'}
        </button>
      </form>
    </main>
  );
}
