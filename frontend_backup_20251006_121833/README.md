# Uptime Monitor - Frontend

Interface web para o sistema de monitoramento de uptime.

## Tecnologias

- **React 18** - Biblioteca para construção da interface
- **TypeScript** - Tipagem estática
- **Vite** - Build tool e dev server
- **Tailwind CSS** - Framework CSS utilitário
- **Shadcn/ui** - Componentes de interface
- **React Router** - Roteamento
- **Lucide React** - Ícones
- **Supabase** - Backend as a Service (opcional)

## Funcionalidades

### Páginas Públicas
- **Status Page** - Página pública de status dos serviços
- **Login** - Autenticação de usuários

### Páginas Protegidas
- **Dashboard** - Visão geral dos monitores e estatísticas
- **Domínios** - Gerenciamento de monitores (HTTP, Ping, TCP)
- **Grupos** - Gerenciamento de grupos
- **Configuração SMTP** - Configuração de e-mail para notificações
- **Relatórios** - Relatórios detalhados e exportação

## Instalação

1. **Instalar dependências:**
   ```bash
   npm install
   ```

2. **Configurar variáveis de ambiente:**
   ```bash
   cp .env.example .env
   ```
   
   Edite o arquivo `.env` com suas configurações:
   ```env
   # API Configuration
   VITE_API_URL=http://localhost:8081/api
   
   # Supabase Configuration (opcional)
   VITE_SUPABASE_URL=your_supabase_url_here
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   ```

3. **Executar em modo de desenvolvimento:**
   ```bash
   npm run dev
   ```
   
   A aplicação estará disponível em `http://localhost:3000`

## Scripts Disponíveis

- `npm run dev` - Inicia o servidor de desenvolvimento
- `npm run build` - Gera build de produção
- `npm run preview` - Visualiza o build de produção
- `npm run lint` - Executa o linter

## Estrutura do Projeto

```
src/
├── components/          # Componentes reutilizáveis
│   ├── ui/             # Componentes base (Shadcn/ui)
│   ├── Layout.tsx      # Layout principal
│   └── ProtectedRoute.tsx
├── contexts/           # Contextos React
│   ├── AuthContext.tsx
│   └── ToastContext.tsx
├── lib/               # Utilitários e configurações
│   ├── supabase.ts    # Cliente Supabase
│   └── utils.ts       # Funções utilitárias
├── pages/             # Páginas da aplicação
│   ├── LoginPage.tsx
│   ├── StatusPage.tsx
│   ├── DashboardPage.tsx
│   ├── DomainsPage.tsx
│   ├── ClientsPage.tsx
│   ├── SmtpConfigPage.tsx
│   └── ReportsPage.tsx
├── App.tsx            # Componente principal
├── main.tsx           # Ponto de entrada
└── index.css          # Estilos globais
```

## Componentes UI

O projeto utiliza componentes do **Shadcn/ui** que são:
- Totalmente customizáveis
- Baseados em Radix UI
- Estilizados com Tailwind CSS
- TypeScript first

Componentes disponíveis:
- `Button` - Botões com variantes
- `Input` - Campos de entrada
- `Label` - Rótulos
- `Card` - Cartões de conteúdo
- `Dialog` - Modais
- `Toast` - Notificações
- `Select` - Seletores
- `Switch` - Interruptores
- `Badge` - Etiquetas

## Autenticação

O sistema de autenticação funciona através de:
1. Login com email/senha via API
2. Token JWT armazenado no localStorage
3. Context API para gerenciar estado global
4. Rotas protegidas com ProtectedRoute

## Integração com Backend

O frontend se comunica com o backend através de:
- **REST API** - Operações CRUD
- **WebSocket** - Atualizações em tempo real (futuro)
- **Proxy Vite** - Desenvolvimento local

## Build e Deploy

1. **Gerar build:**
   ```bash
   npm run build
   ```

2. **Arquivos gerados em `dist/`**

3. **Deploy:**
   - Servir arquivos estáticos
   - Configurar proxy para `/api/*` → backend
   - Configurar fallback para SPA routing

## Desenvolvimento

### Adicionando Nova Página

1. Criar componente em `src/pages/`
2. Adicionar rota em `App.tsx`
3. Adicionar link na navegação (`Layout.tsx`)

### Adicionando Novo Componente UI

1. Instalar via Shadcn CLI (se disponível)
2. Ou criar manualmente em `src/components/ui/`
3. Seguir padrões existentes

### Gerenciamento de Estado

- **Context API** para estado global
- **useState** para estado local
- **Custom hooks** para lógica reutilizável

## Troubleshooting

### Erro de CORS
- Verificar configuração do proxy no `vite.config.ts`
- Verificar se backend está rodando na porta correta

### Erro de Autenticação
- Verificar se `VITE_API_URL` está correto
- Verificar se backend está respondendo
- Limpar localStorage se necessário

### Erro de Build
- Verificar se todas as dependências estão instaladas
- Verificar se não há erros de TypeScript
- Verificar se variáveis de ambiente estão definidas