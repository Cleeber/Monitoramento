# ============================================================
# Stage 1: Build do frontend com Vite
# ============================================================
FROM node:18-alpine AS client-builder

WORKDIR /build

# Dependências para compilar pacotes nativos (ex: pdfkit, bcrypt)
RUN apk add --no-cache python3 make g++

# Copia apenas o necessário para instalar deps e rodar vite build
COPY package*.json ./
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY tailwind.config.js ./
COPY postcss.config.js ./
COPY index.html ./
COPY public ./public
COPY client ./client

RUN npm install

# Gera o bundle estático da SPA em /build/client-dist
RUN npm run build:client

# ============================================================
# Stage 2: Build do backend com tsc
# ============================================================
FROM node:18-alpine AS server-builder

WORKDIR /build

RUN apk add --no-cache python3 make g++

COPY package*.json ./
COPY tsconfig*.json ./
RUN npm install

COPY src ./src
COPY database ./database
COPY scripts ./scripts

# Gera o bundle JS do servidor em /build/dist/server
RUN npm run build:server

# ============================================================
# Stage 3: Imagem final de produção
# ============================================================
FROM node:18-alpine AS production

RUN apk update && apk add --no-cache \
    curl \
    dumb-init \
    ca-certificates \
    && addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001

WORKDIR /app

# Copia apenas dependências de produção
COPY package*.json ./
RUN npm install --only=production && npm cache clean --force

# Copia artefatos de build
COPY --from=server-builder /build/dist ./dist
COPY --from=server-builder /build/database ./database
COPY --from=server-builder /build/scripts ./scripts
COPY --from=client-builder /build/client-dist ./client-dist

# Diretórios de runtime
RUN mkdir -p uploads reports logs \
    && chown -R nodejs:nodejs /app

USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8081/api/health || exit 1

EXPOSE 8081

# Uso do dumb-init para tratamento correto de sinais (SIGTERM)
ENTRYPOINT ["dumb-init", "--"]

# Inicia o Express, que serve API + SPA estática numa única porta
CMD ["node", "dist/server/index.js"]
