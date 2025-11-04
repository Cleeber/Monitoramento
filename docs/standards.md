# Padrões e Convenções do Sistema

Este documento consolida padrões para manter consistência em todo o sistema (backend, frontend, deploy e operações).

## Visão Geral
- Base da API: `/api/`
- Autenticação: JWT via `Authorization: Bearer <token>`
- Campos e naming: `snake_case` para chaves de dados, alinhado ao banco
- Respostas de listagem: array simples por padrão; opcional `format=full` ou `full=1` para objeto `{ count, data }`
- Datas: ISO 8601 (ex.: `2025-11-04T23:22:29.910Z`)

## Convenções de API
- Rotas protegidas exigem token JWT; rotas públicas são explicitamente prefixadas com `/api/public/*`.
- Padrão de erros: sempre retornar `{ error: "mensagem" }` com HTTP adequado.
- Query params comuns:
  - `limit`: máximo de registros retornados.
  - `period`: `24h|7d|30d|90d` (quando `start_date`/`end_date` não são fornecidos).
  - `start_date` e `end_date`: período explícito em ISO.
  - `format=full` ou `full=1`: ativa resposta detalhada `{ count, data }`.
- Conexão com banco: Supabase, tabelas com `snake_case` e colunas como `monitor_id`, `checked_at`.

### Exemplo de Respostas
- Array simples:
```json
[
  {
    "id": "string",
    "monitor_id": "string",
    "status": "online|offline|warning",
    "response_time": 123,
    "error_message": null,
    "checked_at": "2025-11-04T12:34:56.000Z"
  }
]
```
- Formato completo:
```json
{
  "monitor_id": "string",
  "start_date": "2025-11-01T00:00:00.000Z",
  "end_date": "2025-11-04T23:59:59.000Z",
  "count": 250,
  "data": [
    { "id": "string", "monitor_id": "string", "status": "online", "response_time": 123, "error_message": null, "checked_at": "2025-11-04T12:34:56.000Z" }
  ]
}
```

## Autenticação e Autorização
- Login: `POST /api/auth/login` retorna `{ token, user }`.
- Frontend armazena token em `localStorage` como `auth_token` (consumido por `apiUtils.ts`).
- Proteção: middleware `authenticateToken` aplicado em rotas privadas.

## Status Codes e Erros
- 200/201: sucesso; 204: sem conteúdo.
- 400: validação/requisição inválida; 401: não autenticado; 403: não autorizado; 404: não encontrado.
- 500: erro interno do servidor; logar detalhes em servidor, mensagem genérica para cliente.
- Sempre retornar `{ error: "mensagem" }` no corpo em casos de erro.

## Nomenclatura e Tipos
- `status`: `online|offline|warning` (backend). Convertido para relatórios conforme necessário.
- Interfaces (referência):
  - `Monitor`: `id, name, url, status, group_id?, last_check?, response_time?, uptime_*`
  - `MonitorCheck`: `id, monitor_id, status, response_time?, error_message?, checked_at`
  - `Report`: `monitor_id, monitor_name, uptime_percentage, total_checks, successful_checks, failed_checks, avg_response_time, min_response_time, max_response_time, incidents`

## Frontend: Consumo de API
- Utilitários: `apiUtils.ts` (`apiGet`, `apiPost`, etc.) retornam `{ success, data?, error? }`.
- Adapters: padronizar respostas de endpoints em `src/lib/adapters/`.
  - `monitorChecksAdapter.ts`:
    - `normalizeChecksArray(payload)` → garante array de checks.
    - `normalizeChecksResponse(payload)` → retorna `{ items, count }`.
- Forçar uso de adapters quando endpoint suportar múltiplos formatos (ex.: `format=full`).

## Endpoints Públicos vs Protegidos
- Protegidos: `GET /api/monitors`, `GET /api/monitor-checks`, etc.
- Públicos: `GET /api/public/monitors/:id/checks`, `GET /api/public/uptime-history`, `GET /api/public/monitor-stats/:monitorId`.
- Padrão público: retornar apenas campos necessários (ex.: sem `id` interno, sem mensagens sensíveis).

## Logs e Observabilidade
- Healthcheck: `GET /api/health` (usado pelos containers).
- Operações:
  - Ver logs: `docker compose logs backend --tail=20`, `docker compose logs frontend --tail=20`.
  - Nginx: `nginx -t`, `systemctl status nginx`.
- Evitar vazamento de dados sensíveis nos logs; mensagens amigáveis em erros.

## Deploy e Validação em Produção
- Fluxo padrão (resumo):
  1. `git add . && git commit -m "..." && git push origin master`
  2. SSH na VPS, `git pull` no diretório do projeto.
  3. `docker compose down && docker compose build --no-cache && docker compose up -d`.
  4. Verificar saúde dos serviços e Nginx; validar com `curl -I https://monitor.pagina1digital.com.br`.
- Referências: `.windsurfrules`, `DEPLOY_SETUP.md`, `DEPLOY_AUTOMATICO.md`.

## Variáveis de Ambiente
- Backend:
  - `PORT`, `NODE_ENV`, `JWT_SECRET`
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  - SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME`, `SMTP_SECURE`
- Frontend:
  - `VITE_API_URL` (ex.: `http://backend:8081/api` em Docker)
  - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (opcional)

## Banco de Dados
- Supabase como camada de dados; tabelas principais:
  - `monitors` e `monitor_checks` (chaves como `monitor_id`, `checked_at`).
- Consultas com filtros de período via `getMonitorChecksForPeriod` no serviço.
- Índices: criar conforme necessidade de performance (ex.: `monitor_id + checked_at`).

## Segurança
- Cabeçalhos e proteção: `helmet`, `cors`, `express-rate-limit` (aplicar em rotas sensíveis).
- Validar e sanitizar entradas; limitar tamanhos de payload;
- Autorização baseada em função/escopo quando aplicável.
- Políticas para rotas públicas: dados mínimos e sem informações sensíveis.

## Versionamento e Commits
- Mensagens de commit claras e descritivas (ex.: `Docs: ...`, `Frontend: ...`, `Backend: ...`).
- Evitar mudanças amplas fora de escopo; focar alterações pontuais com baixo impacto.

## Práticas de Código
- TypeScript em todas as camadas; evitar funções longas e arquivos >300 linhas.
- Separação de responsabilidades (serviços, utilitários, adapters, páginas).
- Sem mocks em dev/produção; usar variáveis de ambiente para segredos.