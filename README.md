# LP Paciente 360

Landing page que coleta o lead (nome, e-mail, telefone e perfil), grava no Postgres
e devolve a URL de acesso ao Paciente 360 com a hash AES-256 já montada.

```
LP React  →  POST /api/leads  →  grava no Postgres  →  monta hash  →  redirect
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
| `CORS_ORIGIN` | só se um front externo consumir esta API | não |

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
| `GET` | `/api/leads` | Últimos 200 leads |

### Exemplo

```bash
curl -X POST https://seu-app.up.railway.app/api/leads   -H "Content-Type: application/json"   -d '{"nome":"Maria Silva","email":"maria@teste.com","telefone":"11987654321","perfil":"PROFESSOR"}'
```

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
