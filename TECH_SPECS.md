# Especificações Técnicas - Sistema de Monitoramento de Uptime

## 📋 Visão Geral
Sistema completo de monitoramento de uptime de websites com dashboard em tempo real, notificações por email e relatórios automatizados.

## 🏗️ Arquitetura do Sistema

### Estrutura Geral
- **Arquitetura**: Microserviços containerizados
- **Padrão**: Frontend/Backend separados
- **Containerização**: Docker + Docker Compose
- **Proxy Reverso**: Nginx (para frontend)
- **Cache**: Redis

---

## 🔧 Backend

### Linguagens e Runtime
- **Node.js**: v20 (Alpine Linux)
- **TypeScript**: v5.2.2
- **Target ES**: ES2022
- **Module System**: ESNext (ES Modules)

### Framework e Servidor
- **Framework**: Express.js v4.18.2
- **Servidor HTTP**: Express com middleware de segurança
- **Porta**: 3001 (interno), 8081 (exposta)

### Banco de Dados e ORM
- **Banco de Dados**: Supabase (PostgreSQL)
- **Cliente**: @supabase/supabase-js v2.38.4
- **Tipo**: Banco como Serviço (BaaS)

### Cache e Sessão
- **Cache**: Redis v7 (Alpine)
- **Porta Redis**: 6379
- **Persistência**: Habilitada (appendonly)

### Autenticação e Segurança
- **JWT**: jsonwebtoken v9.0.2
- **Hash de Senhas**: bcryptjs v2.4.3
- **Helmet**: v7.1.0 (cabeçalhos de segurança)
- **CORS**: v2.8.5
- **Rate Limiting**: express-rate-limit v7.1.5
- **Validação**: Zod v3.22.4

### Monitoramento e Comunicação
- **HTTP Requests**: Axios v1.6.2
- **Ping**: ping v0.4.4
- **WebSockets**: ws v8.14.2
- **Agendamento**: node-cron v3.0.3

### Email e Relatórios
- **Email**: Nodemailer v6.9.7
- **PDF**: PDFKit v0.14.0
- **Web Scraping**: Puppeteer v24.17.1

### Utilitários
- **Compressão**: compression v1.7.4
- **Upload de Arquivos**: multer v2.0.2
- **UUID**: uuid v11.1.0
- **Variáveis de Ambiente**: dotenv v16.3.1

### Ferramentas de Desenvolvimento
- **Compilador**: TypeScript Compiler (tsc)
- **Dev Server**: tsx v4.6.0 (watch mode)
- **Build**: Compilação para JavaScript (dist/)

---

## 🎨 Frontend

### Linguagens e Runtime
- **Node.js**: v20 (Alpine Linux)
- **TypeScript**: v5.2.2
- **Target ES**: ES2020
- **JSX**: React JSX

### Framework e Build
- **Framework**: React v18.2.0
- **Build Tool**: Vite v4.5.0
- **Plugin**: @vitejs/plugin-react v4.1.1
- **Porta**: 3001 (dev), 80 (produção)

### Roteamento e Estado
- **Roteamento**: React Router DOM v6.20.1
- **Estado Global**: Context API (React)

### UI e Estilização
- **CSS Framework**: Tailwind CSS v3.3.5
- **Componentes UI**: Radix UI (múltiplos pacotes)
  - Dialog, Dropdown Menu, Label, Select, Slot, Switch, Toast
- **Ícones**: Lucide React v0.294.0
- **Utilitários CSS**: 
  - clsx v2.0.0
  - tailwind-merge v2.0.0
  - class-variance-authority v0.7.0
  - tailwindcss-animate v1.0.7

### Gráficos e Visualização
- **Biblioteca Principal**: Chart.js v4.4.0
- **React Integration**: react-chartjs-2 v5.2.0
- **Gráficos Alternativos**: Recharts v2.8.0

### Utilitários Frontend
- **Datas**: date-fns v2.30.0
- **PDF Export**: jsPDF v3.0.1
- **Screenshot**: html2canvas v1.4.1
- **Supabase Client**: @supabase/supabase-js v2.38.4

### Ferramentas de Desenvolvimento
- **Linting**: ESLint v8.53.0 + plugins TypeScript e React
- **CSS Processing**: PostCSS v8.4.31 + Autoprefixer v10.4.16
- **Dev Server**: Vite dev server com proxy para backend

---

## 🐳 Containerização

### Docker
- **Base Images**: 
  - Node.js: node:20-alpine
  - Nginx: nginx:alpine
  - Redis: redis:7-alpine
- **Multi-stage Builds**: Sim (builder + production)
- **Init System**: dumb-init (para backend)

### Docker Compose
- **Versão**: 3.8
- **Serviços**: 3 (redis, backend, frontend)
- **Volumes**: redis_data, uploads
- **Networks**: Default bridge network
- **Restart Policy**: unless-stopped

### Portas Expostas
- **Frontend**: 3000:80
- **Backend**: 8081:3001
- **Redis**: 6379:6379

---

## 🔧 Configurações de Desenvolvimento

### TypeScript (Backend)
```json
{
  "target": "ES2022",
  "module": "ESNext",
  "moduleResolution": "node",
  "strict": true,
  "outDir": "./dist",
  "rootDir": "./src"
}
```

### TypeScript (Frontend)
```json
{
  "target": "ES2020",
  "module": "ESNext",
  "moduleResolution": "bundler",
  "jsx": "react-jsx",
  "strict": true
}
```

### Vite Configuration
- **Alias**: @ → ./src
- **Proxy**: /api → http://localhost:8081
- **Build**: Source maps habilitados
- **Global**: globalThis polyfill

### Tailwind CSS
- **Dark Mode**: Class-based
- **Content**: src/**/*.{ts,tsx}
- **Plugins**: tailwindcss-animate
- **Custom Theme**: Cores CSS variables, animações personalizadas

---

## 🌐 Variáveis de Ambiente

### Backend
- `NODE_ENV`: production/development
- `PORT`: 3001
- `REDIS_URL`: redis://redis:6379
- `SUPABASE_URL`: URL do projeto Supabase
- `SUPABASE_ANON_KEY`: Chave anônima do Supabase
- `SUPABASE_SERVICE_ROLE_KEY`: Chave de serviço do Supabase
- `JWT_SECRET`: Segredo para tokens JWT
- `FRONTEND_BASE_URL`: URL base do frontend
- `CORS_ORIGIN`: Origens permitidas para CORS

### Frontend
- `VITE_API_URL`: URL da API backend
- `VITE_SUPABASE_URL`: URL do projeto Supabase
- `VITE_SUPABASE_ANON_KEY`: Chave anônima do Supabase
- `VITE_BACKEND_ORIGIN`: Origem do backend

---

## 📦 Scripts de Build e Deploy

### Backend
- `npm run dev`: Desenvolvimento com tsx watch
- `npm run build`: Compilação TypeScript
- `npm start`: Execução em produção

### Frontend
- `npm run dev`: Servidor de desenvolvimento Vite
- `npm run build`: Build de produção (tsc + vite build)
- `npm run preview`: Preview do build de produção
- `npm run lint`: Linting com ESLint

---

## 🔒 Segurança

### Medidas Implementadas
- **Helmet**: Cabeçalhos de segurança HTTP
- **CORS**: Controle de origem cruzada
- **Rate Limiting**: Limitação de taxa de requisições
- **JWT**: Autenticação baseada em tokens
- **bcryptjs**: Hash seguro de senhas
- **Zod**: Validação e sanitização de dados
- **HTTPS**: Suportado via proxy reverso

### Boas Práticas
- Variáveis de ambiente para dados sensíveis
- Validação de entrada em todas as rotas
- Sanitização de dados do usuário
- Tokens JWT com expiração
- Senhas hasheadas com salt

---

## 📊 Monitoramento e Observabilidade

### Funcionalidades
- **Health Checks**: Ping e HTTP requests
- **WebSockets**: Atualizações em tempo real
- **Cron Jobs**: Agendamento de verificações
- **Logs**: Sistema de logging integrado
- **Métricas**: Coleta de dados de uptime
- **Relatórios**: Geração automática de PDFs

---

## 🚀 Deploy e Produção

### Estratégia de Deploy
- **Containerização**: Docker multi-stage builds
- **Orquestração**: Docker Compose
- **Proxy**: Nginx para servir frontend estático
- **Persistência**: Volumes Docker para dados Redis e uploads
- **Restart**: Política de restart automático

### Otimizações de Produção
- **Frontend**: Build otimizado com Vite
- **Backend**: Compilação TypeScript para JavaScript
- **Cache**: Redis para cache de dados
- **Compressão**: Middleware de compressão HTTP
- **Static Assets**: Servidos via Nginx

---

*Documento gerado automaticamente em: ${new Date().toLocaleDateString('pt-BR')}*