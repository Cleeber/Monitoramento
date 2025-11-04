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

## Tecnologias Utilizadas

### Backend
- Node.js
- TypeScript
- Express.js
- SQLite
- JWT para autenticação
- bcrypt para criptografia

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- Lucide React (ícones)
- Recharts (gráficos)

## Estrutura do Projeto

```
uptime-monitor/
├── backend/                 # API e serviços backend
│   ├── src/
│   │   ├── index.ts        # Ponto de entrada
│   │   ├── lib/            # Utilitários e configurações
│   │   ├── monitoring/     # Serviços de monitoramento
│   │   └── services/       # Serviços de dados
│   ├── database/           # Schema e configuração do banco
│   └── package.json
├── frontend/               # Interface do usuário
│   ├── src/
│   │   ├── components/     # Componentes reutilizáveis
│   │   ├── pages/          # Páginas da aplicação
│   │   ├── contexts/       # Contextos React
│   │   └── lib/            # Utilitários
│   └── package.json
└── README.md
```

## Instalação e Configuração

### Pré-requisitos
- Node.js (versão 18 ou superior)
- npm ou yarn

### 1. Clone o repositório
```bash
git clone https://github.com/Cleeber/Monitoramento.git
cd Monitoramento
```

### 2. Configuração do Backend
```bash
cd backend
npm install
```

Crie um arquivo `.env` baseado no `.env.example`:
```env
PORT=8080
JWT_SECRET=seu_jwt_secret_aqui
DATABASE_PATH=./database/uptime_monitor.db
```

### 3. Configuração do Frontend
```bash
cd ../frontend
npm install
```

Crie um arquivo `.env` baseado no `.env.example`:
```env
VITE_API_URL=http://localhost:8080/api
```

### 4. Inicialização do Banco de Dados
```bash
cd ../backend
npm run init-db
```

## Execução

### Desenvolvimento

1. **Backend** (Terminal 1):
```bash
cd backend
npm run dev
```

2. **Frontend** (Terminal 2):
```bash
cd frontend
npm run dev
```

A aplicação estará disponível em:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8080

### Produção

1. **Build do Frontend**:
```bash
cd frontend
npm run build
```

2. **Execução do Backend**:
```bash
cd backend
npm start
```

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

### Grupos
- `GET /api/groups` - Listar grupos
- `POST /api/groups` - Criar grupo
- `PUT /api/groups/:id` - Atualizar grupo
- `DELETE /api/groups/:id` - Remover grupo

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