# Sistema de Monitoramento de Uptime

Um sistema completo de monitoramento de uptime para websites e serviços, desenvolvido com Node.js, TypeScript e React.

## Características

- 🔍 **Monitoramento em tempo real** de websites e serviços
- 📊 **Dashboard interativo** com estatísticas detalhadas
- 🎯 **Múltiplos tipos de verificação** (HTTP, PING, TCP)
- 📈 **Relatórios de uptime** (24h, 7d, 30d)
- 🔔 **Sistema de notificações** para falhas
- 👥 **Gerenciamento de grupos** para organizar monitores
- 🔐 **Autenticação segura** com JWT
- 📱 **Interface responsiva** e moderna
- 🐳 **Deploy em container único** (API + SPA servidos pelo mesmo processo)

## Tecnologias Utilizadas

### Backend (servidor Node)
- Node.js 18
- TypeScript
- Express.js
- Supabase (Postgres)
- JWT para autenticação
- bcrypt para criptografia
- node-cron para agendamentos
- nodemailer para envio de e-mails
- pdfkit para relatórios PDF

### Frontend (SPA React)
- React 18
- TypeScript
- Vite
- Tailwind CSS + componentes shadcn/ui
- Lucide React (ícones)
- Recharts (gráficos)

## Estrutura do Projeto

Monorepo unificado: API e SPA convivem no mesmo repositório e são servidas pelo mesmo processo Express.

```
uptime-monitor/
├── src/                      # Backend (Express)
│   ├── index.ts              # Ponto de entrada: serve /api/* + arquivos estáticos
│   ├── lib/                  # Cliente Supabase e tipos compartilhados
│   ├── monitoring/           # Engine de checks (HTTP/PING/TCP)
│   └── services/             # DatabaseService, EmailService, PDFService, etc.
├── client/                   # Frontend (SPA React/Vite)
│   ├── App.tsx
│   ├── main.tsx
│   ├── components/           # Componentes reutilizáveis
│   ├── pages/                # Páginas da aplicação
│   ├── contexts/             # Contextos React
│   └── lib/utils.ts
├── database/                 # Schema e migrations do Supabase
├── scripts/                  # Scripts auxiliares
├── uploads/                  # Uploads de logos (volume Docker)
├── reports/                  # Relatórios gerados (volume Docker)
├── public/                   # Assets públicos do Vite
├── index.html                # Entrada do Vite
├── vite.config.ts            # Config do Vite (root, alias @ → ./client)
├── tailwind.config.js
├── tsconfig.json             # Project references
├── tsconfig.server.json      # Build do backend → dist/server
├── tsconfig.client.json      # IDE/Vite do frontend
├── Dockerfile                # Multi-stage único
├── docker-compose.yml        # Serviço único (sem nginx, sem dois domínios)
└── package.json              # Único manifest com todas as deps
```

### Como API e SPA convivem no mesmo processo

- Em **dev**: `npm run dev` sobe Vite (`:3001`) e Express (`:8081`) em paralelo via `concurrently`. Vite faz proxy de `/api` para o Express. Você acessa `http://localhost:3001` no navegador.
- Em **produção** (Docker): o Express compila para `dist/server/index.js` e serve, na porta `8081`:
  - `GET /api/*` — rotas JSON
  - `GET /*` (que não seja `/api`) — fallback para `client-dist/index.html` (a SPA)

Como ambos servem do mesmo domínio em produção, **não há CORS a configurar** (browsers só bloqueiam cross-origin).

## Padrões e Convenções

Para garantir consistência em todo o sistema, consulte o documento de padrões:

- `docs/standards.md` — Convenções de API, autenticação, formatos de resposta, adapters no frontend, segurança, deploy e operações.

## Instalação e Configuração

### Pré-requisitos
- Node.js (versão 18 ou superior)
- npm

### 1. Clone o repositório
```bash
git clone https://github.com/Cleeber/Monitoramento.git
cd Monitoramento
```

### 2. Instale as dependências (raiz única)
```bash
npm install
```

### 3. Configure as variáveis de ambiente

Copie `.env.example` para `.env` na raiz e preencha:
```env
JWT_SECRET=seu_jwt_secret_seguro
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua_anon_key
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
PORT=8081
NODE_ENV=development
```

## Execução

### Desenvolvimento — um único comando
```bash
npm run dev
```

Isso sobe simultaneamente:
- Servidor backend: `http://localhost:8081` (com `tsx watch` para hot reload)
- Servidor Vite (frontend + proxy /api): `http://localhost:3001`

Abra `http://localhost:3001` no navegador.

### Produção com Docker
```bash
docker compose up -d --build
```

O único container expõe a porta `8081`. Acesse:
- Aplicação: `http://localhost:8081`
- API: `http://localhost:8081/api/health`
- Status pages públicas (via slug): `http://localhost:8081/status-page/<slug>`

### Deploy em VPS

Veja `DEPLOY_SETUP.md` e `DEPLOY_AUTOMATICO.md` para o pipeline GitHub Actions → VPS via SSH.

Após unificação:
- Apenas **um bloco de proxy reverso** para `monitor.pagina1digital.com.br` (nginx/Caddy) apontando para `localhost:8081`.
- O subdomínio `api.pagina1digital.com.br` deixa de existir (mesma origem).

## Funcionalidades

### Dashboard
- Visão geral de todos os monitores
- Estatísticas de uptime em tempo real
- Gráficos de performance
- Status atual de cada serviço

### Gerenciamento de Monitores
- Adicionar/editar/remover monitores
- Configuração de intervalos de verificação
- Definição de timeouts personalizados
- Organização por grupos

### Tipos de Monitoramento
- **HTTP/HTTPS**: Verificação de websites e APIs
- **PING**: Teste de conectividade de rede
- **TCP**: Verificação de portas específicas

### Relatórios
- Uptime percentual (24h, 7d, 30d)
- Tempo de resposta médio
- Histórico de verificações
- Detalhes de falhas
- Envio mensal automático por e-mail
- Geração de PDF

## API Endpoints

### Autenticação
- `POST /api/auth/login` - Login do usuário
- `POST /api/auth/register` - Registro de usuário

### Monitores
- `GET /api/monitors` - Listar monitores
- `POST /api/monitors` - Criar monitor
- `PUT /api/monitors/:id` - Atualizar monitor
- `DELETE /api/monitors/:id` - Remover monitor

### Dashboard
- `GET /api/dashboard/stats` - Estatísticas gerais
- `GET /api/dashboard/monitors` - Monitores com status

### Checks

Para obter o histórico de verificações (checks) de monitores, há duas rotas disponíveis e compatíveis entre si. Ambas exigem autenticação via Bearer Token.

- `GET /api/monitors/:id/checks`
  - Uso: obter checks de um monitor específico pelo `:id`.
  - Query params:
    - `limit` (opcional, padrão `100`): número máximo de registros retornados.
  - Resposta: retorna um array simples de checks no formato:
    ```json
    [
      {
        "id": "string",
        "monitor_id": "string",
        "status": "online|offline|warning",
        "response_time": 123,
        "error_message": null,
        "checked_at": "2024-11-04T12:34:56.000Z"
      }
    ]
    ```

- `GET /api/monitor-checks`
  - Uso: rota com filtros de período e compatível com o frontend.
  - Query params:
    - `monitor_id` (obrigatório): ID do monitor.
    - `start_date` e `end_date` (opcionais): ISO strings delimitando o período.
    - `period` (opcional, valores: `24h|7d|30d|90d`, padrão `7d`): se não enviar `start_date/end_date`.
    - `limit` (opcional): número máximo de registros.
    - `format` (opcional): `full` para resposta detalhada; padrão retorna array simples.
    - `full` (opcional, `1` para habilitar): equivalente a `format=full`.
  - Respostas:
    - Padrão (array simples):
      ```json
      [
        {
          "id": "string",
          "monitor_id": "string",
          "status": "online|offline|warning",
          "response_time": 123,
          "error_message": null,
          "checked_at": "2024-11-04T12:34:56.000Z"
        }
      ]
      ```
    - `format=full` ou `full=1` (objeto detalhado):
      ```json
      {
        "monitor_id": "string",
        "start_date": "2024-11-01T00:00:00.000Z",
        "end_date": "2024-11-04T23:59:59.000Z",
        "count": 250,
        "data": [
          { "id": "string", "monitor_id": "string", "status": "online", "response_time": 123, "error_message": null, "checked_at": "2024-11-04T12:34:56.000Z" }
        ]
      }
      ```

Exemplos de uso (PowerShell):

```powershell
$token = "SEU_TOKEN_JWT"

# /api/monitors/:id/checks
Invoke-RestMethod -Method GET -Uri "https://monitor.pagina1digital.com.br/api/monitors/abc123/checks?limit=200" -Headers @{ Authorization = "Bearer $token" }

# /api/monitor-checks (array simples)
Invoke-RestMethod -Method GET -Uri "https://monitor.pagina1digital.com.br/api/monitor-checks?monitor_id=abc123&period=7d&limit=500" -Headers @{ Authorization = "Bearer $token" }

# /api/monitor-checks (formato completo)
Invoke-RestMethod -Method GET -Uri "https://monitor.pagina1digital.com.br/api/monitor-checks?monitor_id=abc123&period=7d&limit=500&format=full" -Headers @{ Authorization = "Bearer $token" }
```

## Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## Suporte

Para suporte, abra uma issue no GitHub ou entre em contato através do email.

---

**Desenvolvido com ❤️ para monitoramento confiável de serviços**