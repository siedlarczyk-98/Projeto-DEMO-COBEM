# LP Paciente 360

Landing page que coleta o lead (nome, e-mail, telefone e perfil), grava no Postgres
e devolve a URL de acesso ao Paciente 360 com a hash AES-256 já montada.

```
LP React  →  POST /api/leads  →  grava no Postgres  →  monta hash  →  redirect
                                        └─ (assíncrono) conversão no RD Station
```

## Stack

- **Backend** NestJS 11 + Prisma 6 + Postgres
- **Frontend** React 18 + Vite 6 + TypeScript
- **Deploy** serviço único no Railway (o Nest serve a LP compilada)

---

## Rodando local

```bash
docker compose up -d              # Postgres na porta 5433

cd backend
cp .env.example .env              # preencha P360_CLIENT_ID e P360_CLIENT_KEY
npm install
npx prisma migrate dev
npm run start:dev                 # http://localhost:3000

cd ../frontend
npm install
npm run dev                       # http://localhost:5173
```

Em dev o Vite faz proxy de `/api` para o backend, então não há CORS.

---

## Deploy no Railway

### 1. Suba o código para o GitHub

```bash
git init && git add . && git commit -m "LP Paciente 360"
git remote add origin <seu-repo> && git push -u origin main
```

### 2. Crie o projeto

No Railway: **New Project → Deploy from GitHub repo** e aponte para o repositório.
O `railway.json` já instrui o build via `Dockerfile` — não precisa configurar nada.

### 3. Adicione o Postgres

**New → Database → Add PostgreSQL**. O Railway cria a variável `DATABASE_URL`
automaticamente; basta referenciá-la no serviço da aplicação.

### 4. Configure as variáveis

No serviço da aplicação, aba **Variables**:

| Variável | Valor | Obrigatória |
|---|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | sim |
| `P360_CLIENT_ID` | fornecido pelo Paciente 360 | sim |
| `P360_CLIENT_KEY` | fornecido pelo Paciente 360 | sim |
| `P360_BASE_URL` | `https://api.paciente360.com.br/integration` | sim |
| `P360_CLIENT_LANG` | `pt-br` | não |
| `P360_CURSO_ID` | caso clínico padrão | não |
| `P360_CLASS_ID` | turma padrão | não |
| `P360_BACK_URL` | retorno após o caso clínico | não |
| `RD_CLIENT_ID` / `RD_CLIENT_SECRET` / `RD_REFRESH_TOKEN` | OAuth do RD Station | não* |
| `RD_PUBLIC_API_KEY` | alternativa ao OAuth | não* |
| `RD_CONVERSION_IDENTIFIER` | ex.: `cobem-2026-lp` | não |
| `RD_TAGS` | ex.: `cobem-2026,evento` | não |
| `RD_CAMPO_PERFIL` | nome de API do campo customizado de perfil | não |
| `CORS_ORIGIN` | só se um front externo consumir esta API | não |

\* sem nenhuma credencial do RD o envio fica desativado e o lead continua sendo
gravado normalmente.

`PORT` é injetada pelo Railway — não defina manualmente.

### 5. Gere o domínio

**Settings → Networking → Generate Domain**.

As migrations rodam sozinhas a cada deploy (`prisma migrate deploy` no start),
e o healthcheck aponta para `/api/health`.

---

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/` | Landing page |
| `GET` | `/api/health` | Healthcheck (status + conexão com o banco) |
| `POST` | `/api/leads` | Cria o lead e devolve `{ leadId, redirectUrl }` |
| `GET` | `/api/leads` | Últimos 200 leads (com o status do RD) |
| `POST` | `/api/leads/rd/resync?limite=100` | Reenvia ao RD os leads `FALHOU`/`PENDENTE` |

### Exemplo

```bash
curl -X POST https://seu-app.up.railway.app/api/leads   -H "Content-Type: application/json"   -d '{"nome":"Maria Silva","email":"maria@teste.com","telefone":"11987654321","perfil":"PROFESSOR"}'
```

---

## RD Station Marketing

Cada lead salvo vira uma **conversão** no RD (`POST /platform/conversions`),
enviada em background — o formulário não espera o RD para redirecionar o lead
para o Paciente 360.

O que vai no payload:

| Campo no RD | Origem |
|---|---|
| `conversion_identifier` | `RD_CONVERSION_IDENTIFIER` — é o gatilho da automação |
| `email`, `name` | lead |
| `personal_phone` | telefone normalizado para `+55DDDNÚMERO` |
| `tags` | `RD_TAGS` + `perfil-aluno` / `perfil-professor` |
| campo customizado | `RD_CAMPO_PERFIL` (opcional), com `ALUNO`/`PROFESSOR` |

### Régua pós-evento

A segmentação da régua sai de duas peças, e as duas já vão em toda conversão:

1. **`conversion_identifier`** — no RD, crie a automação com o gatilho
   *"Conversão em landing page/formulário"* apontando para esse identificador.
2. **Tag de perfil** — a condição `perfil-professor` vs. `perfil-aluno` separa
   os dois fluxos dentro da mesma automação (ou em duas automações distintas).

Como a tag é aplicada no momento da conversão, dá para montar a régua no RD
**depois** do evento e ainda assim segmentar toda a base coletada.

### Falhas e reenvio

O status do envio fica na própria linha do lead (`rdStatus`, `rdSyncedAt`,
`rdError`, `rdAttempts`):

| Status | Significado |
|---|---|
| `ENVIADO` | conversão aceita pelo RD |
| `FALHOU` | erro após 3 tentativas (backoff exponencial) |
| `PENDENTE` | ainda não processado, ou queda no meio do envio |
| `DESATIVADO` | ambiente sem credenciais do RD |

Antes de ligar a régua, reprocesse o que ficou para trás:

```bash
curl -X POST https://seu-app.up.railway.app/api/leads/rd/resync?limite=200
```

> Esse endpoint está aberto, como o `GET /api/leads`. Se a demo virar produção,
> proteja os dois antes.

---

## Sobre a hash

O Paciente 360 espera `CryptoJS.AES.encrypt(JSON.stringify(data), client_key)`.
Com uma **string** como chave, o CryptoJS não faz AES puro: aplica o esquema
OpenSSL — salt aleatório de 8 bytes, derivação `EVP_BytesToKey` com MD5 — e
serializa como `Base64("Salted__" + salt + ciphertext)`.

Por isso o backend usa a própria biblioteca `crypto-js`, e não o `crypto` nativo
do Node: replicar o formato manualmente só adicionaria risco de incompatibilidade.

Dois cuidados que valem registro:

1. **A hash nunca pode ser gerada no frontend.** A `client_key` é ao mesmo tempo a
   senha de criptografia e um campo dentro do JSON criptografado — no browser ela
   vazaria para qualquer um com o DevTools aberto.
2. **A hash vai sempre com `encodeURIComponent`.** O Base64 contém `+`, `/` e `=`;
   um `+` não escapado chega como espaço no destino e invalida a hash.

---

## Notas

- O lead é gravado **antes** da geração da hash: se a montagem falhar, o contato
  não se perde.
- Perfil: `ALUNO` vira `usuario` e `PROFESSOR` vira `professor` no payload.
- O telefone existe apenas no nosso banco — o payload do Paciente 360 não tem
  esse campo.
- `trust proxy` está ativo para que o IP registrado seja o do lead, e não o do
  proxy do Railway.
