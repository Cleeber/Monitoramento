# PRD — Sistema de Monitoramento de Uptime

## 1. Visão Geral
Produto para monitoramento de disponibilidade (uptime) e performance de websites e serviços, com dashboard interativo, relatórios e notificações por e‑mail. Público-alvo: agências e equipes internas que precisam acompanhar a saúde de múltiplos domínios/serviços.

## 2. Objetivos do Produto
- Detectar rapidamente indisponibilidades e lentidão.
- Fornecer visão consolidada (24h/7d/30d) de uptime e tempos de resposta.
- Organizar monitores por grupos (clientes, squads, projetos).
- Enviar alertas por e-mail quando houver falhas e quando o serviço normalizar.
- Gerar relatórios periódicos (mensal) para stakeholders.

Sucesso medido por: redução do MTTA/MTTR, adoção do dashboard, entrega mensal de relatórios sem intervenção manual e baixa taxa de falsos positivos.

## 3. Escopo
Incluído:
- Monitores de HTTP/HTTPS, PING e TCP; agendamento de verificações.
- Dashboard com estatísticas e status em tempo real (polling) e visão histórica.
- Gerenciamento de monitores e grupos; configuração de timeouts/intervalos.
- Relatórios (24h/7d/30d) e relatório mensal consolidado (PDF/armazenamento).
- Notificações por e-mail via SMTP configurável.
- Autenticação por e-mail/senha (JWT) e rotas protegidas no frontend.

Fora de escopo (v1):
- Multi-tenant completo e faturamento.
- Webhooks e integrações de alerta além de e‑mail (ex.: Slack, SMS).
- Alta disponibilidade nível enterprise (clusterização/auto‑scale).

## 4. Personas e Casos de Uso
- Analista/DevOps: cria e mantém monitores, acompanha incidentes, exporta relatórios.
- Gerente/Account: consome relatórios e status por grupo/cliente.

Principais histórias:
- Como analista, quero cadastrar um monitor HTTP com intervalo e timeout para ser alertado em falhas.
- Como gerente, quero ver uptime de 30 dias por cliente para reuniões de status.
- Como analista, quero configurar SMTP para o envio de alertas e relatórios.

## 5. Funcionalidades Principais
- Dashboard: visão geral, lista de monitores com status, gráficos e KPIs.
- Monitores: CRUD, tipos (HTTP, PING, TCP), intervalos, timeouts, associação a grupos.
- Grupos: CRUD e filtro/segmentação de monitores.
- Relatórios: KPIs de uptime, tempo médio de resposta, incidentes e PDF mensal.
- Notificações: e‑mail para falha/recuperação.
- Autenticação: login, proteção de rotas, armazenamento de token (localStorage).
- Página pública de Status (opcional) por configuração.

## 6. Fluxos (alto nível)
- Login → Dashboard → Detalhe do monitor → Histórico/Incidentes.
- Configurar SMTP → Habilitar alertas → Receber e‑mail em falha/ok.
- Criar Grupo → Associar Monitores → Filtrar dashboard/relatórios por grupo.
- Gerar (ou agendar) Relatório Mensal → Armazenar/Enviar/Download.

## 7. Requisitos Funcionais
Autenticação
- RF‑A1: Login via POST /api/auth/login com e‑mail/senha; retorno de JWT.
- RF‑A2: Rotas protegidas exigem JWT válido.

Monitores
- RF‑M1: Criar/editar/excluir/listar monitores com: nome, tipo, URL/host/porta, intervalo (cron/minutos), timeout, grupo (opcional).
- RF‑M2: Executar verificações agendadas por tipo (HTTP, PING, TCP) e persistir resultados.
- RF‑M3: Calcular uptime (24h/7d/30d) e tempo médio de resposta.
- RF‑M4: Limpar histórico de verificações de um monitor específico, mantendo as configurações do monitor.

Grupos
- RF‑G1: CRUD de grupos; associação de monitores.

Dashboard
- RF‑D1: Exibir KPIs (uptime, tempo de resposta, total/sucesso/falha).
- RF‑D2: Listar status atual dos monitores e histórico resumido.

Relatórios
- RF‑R1: Relatórios de período (24h/7d/30d) por monitor e por grupo.
- RF‑R2: Geração de relatório mensal consolidado (PDF) com incidências e KPIs.

Notificações
- RF‑N1: Configurar SMTP via UI e persistência segura.
- RF‑N2: Enviar e‑mail em falha e em recuperação; registrar tentativas/erros.

## 8. Requisitos Não Funcionais
- RNF‑S1 Segurança: JWT; CORS; Helmet; Rate limiting; sanitização de entradas; não logar segredos.
- RNF‑P1 Performance: verificação eficiente; consultas paginadas; gráficos responsivos.
- RNF‑D1 Disponibilidade: tolerante a reinícios; agendador restabelece jobs.
- RNF‑U1 Usabilidade: responsive design e feedback claro de erros/carregamentos.
- RNF‑O1 Observabilidade: logs estruturados e métricas básicas.

## 9. Integrações e Stack
- Backend: Node.js + Express + TypeScript; agendamento (cron); envio de e‑mails.
- Frontend: React + Vite + TypeScript + Tailwind; gráficos (Recharts/Chart.js).
- Persistência: Supabase (Postgres) e armazenamento de arquivos (relatórios).

## 10. API (resumo mínimo)
Autenticação
- POST /api/auth/login
- POST /api/auth/register (se habilitado)

Monitores
- GET/POST /api/monitors
- PUT/DELETE /api/monitors/:id
- DELETE /api/monitors/:id/history

Dashboard
- GET /api/dashboard/stats
- GET /api/dashboard/monitors

Grupos
- GET/POST /api/groups
- PUT/DELETE /api/groups/:id

(Relatórios e SMTP terão endpoints específicos para geração/consulta/configuração.)

## 11. Modelo de Dados (alto nível)
- users: id, email, password_hash, created_at.
- groups: id, name, description.
- monitors: id, name, type (HTTP|PING|TCP), target (url/host/porta), interval, timeout, group_id.
- checks: id, monitor_id, timestamp, status (up|down), response_time_ms, message.
- incidents: id, monitor_id, started_at, ended_at, duration_ms, description.
- smtp_config: host, port, user, secure, from, created_by.
- monthly_reports: id, monitor_id/grupo, period, path/url, generated_at, summary.

## 12. Regras de Negócio
- Uptime = sucesso/(sucesso+falha) no período.
- Falha HTTP: status code fora de 2xx/3xx, timeout ou erro de rede.
- Falha PING/TCP: sem resposta dentro do timeout.
- Notificação: disparar em transição up→down e down→up (com debouncing para ruído).

## 13. Relatórios
- Conteúdo: KPIs do período, incidentes (data, duração, causa/mensagem), gráficos e recomendação textual automática.
- Entrega: armazenamento e exportação (PDF); opção de envio por e‑mail.

## 14. Segurança e Compliance
- Armazenar senhas com bcrypt; tokens JWT com expiração.
- Variáveis de ambiente para segredos (JWT, SMTP, Supabase).
- Rate limit em endpoints públicos; CORS restrito a origens confiáveis.

## 15. KPIs e Métricas
- Uptime por monitor/grupo; tempo médio de resposta; número/duração de incidentes.
- MTTA/MTTR; taxa de falsos positivos de alerta; SLA atendido.

## 16. Roadmap (fases sugeridas)
- v1: Monitores + Dashboard + Grupos + Relatórios básicos + SMTP + Auth.
- v1.1: Relatório mensal em PDF + armazenamento.
- v1.2: Página pública de status configurável.
- v2: Tempo real via WebSocket; integrações (Slack/Teams); multi‑tenant.

## 17. Riscos e Premissas
- Dependência de e‑mail SMTP externo; limites de envio.
- Alvos bloqueando PING/TCP; necessidade de alternativas (HTTP healthcheck).
- Premissa: Supabase disponível e configurado (URL/Anon Key) quando utilizado.

## 18. Critérios de Aceite (amostra)
- Criar monitor HTTP e ver status/uptime refletidos no dashboard em até 1 ciclo.
- Receber e‑mail ao cair e ao recuperar com detalhes do incidente.
- Gerar relatório mensal com KPIs corretos e arquivo disponível para download.
- Autenticação impede acesso a rotas protegidas sem JWT válido.

## 19. Configuração de Ambiente (alto nível)
- Frontend: VITE_API_URL apontando para /api do backend.
- Backend: PORT configurável; JWT_SECRET; credenciais SMTP; chaves Supabase.

## 20. Fora de Escopo (confirmado)
- Cobrança/faturamento; relatórios financeiros; SSO corporativo; apps mobile nativos.