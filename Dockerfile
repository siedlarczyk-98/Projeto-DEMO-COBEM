# syntax=docker/dockerfile:1

# ---------- estágio de build ----------
FROM node:22-alpine AS build
# Prisma precisa de openssl para gerar/rodar o engine
RUN apk add --no-cache openssl
WORKDIR /app

# Deps primeiro: aproveita cache de camada enquanto o lock não muda
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci

COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci

COPY backend ./backend
COPY frontend ./frontend

RUN cd backend && npx prisma generate && npm run build
RUN cd frontend && npm run build

# ---------- imagem final ----------
FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY backend/prisma ./prisma
# Gerado aqui (e não copiado do build) para o engine casar com esta imagem
RUN npx prisma generate

COPY --from=build /app/backend/dist ./dist
# A LP compilada vira o estático servido pelo Nest
COPY --from=build /app/frontend/dist ./public

EXPOSE 3000

# migrate deploy aplica as migrations pendentes antes de subir
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
