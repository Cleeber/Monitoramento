# PRD — Sistema de Monitoramento de Uptime

## 1. Visão Geral
Produto para monitoramento de disponibilidade (uptime) e performance de websites e serviços, com dashboard interativo, relatórios, notificações por e‑mail e páginas de status públicas. Público-alvo: agências e equipes internas que precisam acompanhar a saúde de múltiplos domínios/serviços e dar transparência aos clientes.

## 2. Objetivos do Produto
- Detectar rapidamente indisponibilidades e lentidão.
- Fornecer visão consolidada (24h/7d/30d) de uptime e tempos de resposta.
- Organizar monitores por grupos (clientes, squads, projetos).
- Enviar alertas por e-mail quando houver falhas e quando o serviço normalizar.
- Gerar relatórios periódicos (mensal) para stakeholders.
- Prover páginas de status públicas para transparência com clientes.

Sucesso medido por: redução do MTTA/MTTR, adoção do dashboard, entrega mensal de relatórios sem intervenção manual e baixa taxa de falsos positivos.

## 3. Escopo
Incluído:
- Monitores de HTTP/HTTPS, PING e TCP; agendamento de verificações.
- Validação avançada de conteúdo (tamanho mínimo, presença de texto, ignorar códigos de erro específicos).
- Dashboard com estatísticas e status em tempo real (polling) e visão histórica.
- Gerenciamento de monitores e grupos; configuração de timeouts/intervalos.
- Funcionalidade de limpeza de histórico de monitor.
- Relatórios (24h/7d/30d) e relatório mensal consolidado (PDF/armazenamento).
- Notificações por e-mail via SMTP configurável e testável via UI.
- Autenticação por e-mail/senha (JWT) e rotas protegidas no frontend.
- Páginas de Status Públicas (Geral, por Grupo e por Monitor Individual) com suporte a slugs amigáveis.

Fora de escopo (v1):
- Multi-tenant completo e faturamento.
- Webhooks e integrações de alerta além de e‑mail (ex.: Slack, SMS).
- Alta disponibilidade nível enterprise (clusterização/auto‑scale).

## 4. Personas e Casos de Uso
- Analista/DevOps: cria e mantém monitores, acompanha incidentes, exporta relatórios, configura páginas de status.
- Gerente/Account: consome relatórios e status por grupo/cliente.
- Cliente Final: acessa a página de status pública para verificar a disponibilidade dos serviços contratados.

Principais histórias:
- Como analista, quero cadastrar um monitor HTTP com validação de conteúdo para garantir que a página não está em branco.
- Como gerente, quero ver uptime de 30 dias por cliente para reuniões de status.
- Como analista, quero limpar o histórico de testes de um monitor após um período de manutenção.
- Como cliente, quero acessar uma URL pública (ex: /status/cliente-x) para ver se meus sistemas estão no ar.

## 5. Funcionalidades Principais
- Dashboard: visão geral, lista de monitores com status, gráficos e KPIs.
- Monitores: CRUD, tipos (HTTP, PING, TCP), intervalos, timeouts, associação a grupos.
- Validação Avançada: verificação de tamanho de corpo e presença de texto na resposta.
- Grupos: CRUD, slugs personalizados e filtro/segmentação de monitores.
- Relatórios: KPIs de uptime, tempo médio de resposta, incidentes e PDF mensal.
- Notificações: e‑mail para falha/recuperação.
- Autenticação: login, proteção de rotas, armazenamento de token (localStorage).
- Páginas de Status: visualização pública de status em tempo real, acessível via UUID ou Slug.

## 6. Fluxos (alto nível)
- Login → Dashboard → Detalhe do monitor → Histórico/Incidentes.
- Configurar SMTP → Testar Envio → Habilitar alertas → Receber e‑mail em falha/ok.
- Criar Grupo → Definir Slug → Associar Monitores → Acessar Página de Status Pública do Grupo.
- Manutenção → Limpar Histórico do Monitor → Reiniciar estatísticas.
- Gerar (ou agendar) Relatório Mensal → Armazenar/Enviar/Download.

## 7. Requisitos Funcionais
Autenticação
- RF‑A1: Login via POST /api/auth/login com e‑mail/senha; retorno de JWT.
- RF‑A2: Rotas protegidas exigem JWT válido.

Monitores
- RF‑M1: Criar/editar/excluir/listar monitores com: nome, tipo, URL/host/porta, intervalo, timeout, grupo.
- RF‑M2: Executar verificações agendadas e persistir resultados. Carregar estado inicial do banco ao reiniciar serviço.
- RF‑M3: Calcular uptime (24h/7d/30d) e tempo médio de resposta com base no histórico persistido.
- RF‑M4: Limpar histórico de verificações de um monitor específico via UI e API.
- RF‑M5: Configurar validações extras: ignorar SSL, ignorar erros 403, validar tamanho mínimo de conteúdo.

Grupos
- RF‑G1: CRUD de grupos com suporte a Slugs para URLs amigáveis.

Dashboard
- RF‑D1: Exibir KPIs agregados (total monitores, online/offline, uptime médio).
- RF‑D2: Listar status atual dos monitores com atualização automática (polling).

Relatórios
- RF‑R1: Relatórios de período (24h/7d/30d) por monitor e por grupo.
- RF‑R2: Geração de relatório mensal consolidado (PDF) e envio customizado por e-mail.

Notificações
- RF‑N1: Configurar SMTP via UI com persistência segura no banco.
- RF‑N2: Enviar e‑mail de teste para validar configuração.
- RF‑N3: Enviar e‑mail em falha e em recuperação.

Páginas de Status (Públicas)
- RF‑S1: Rota pública para status geral do sistema.
- RF‑S2: Rota pública para status de grupo (via ID ou Slug).
- RF‑S3: Rota pública para status de monitor individual (via ID ou Slug).
- RF‑S4: Exibir histórico de uptime e incidentes recentes publicamente (com filtros de segurança).

## 8. Requisitos Não Funcionais
- RNF‑S1 Segurança: JWT; CORS; Helmet; Rate limiting; sanitização; rotas públicas somente leitura.
- RNF‑P1 Performance: Caching 'no-store' para APIs de tempo real; carga inicial otimizada.
- RNF‑D1 Disponibilidade: tolerante a reinícios (recuperação de estado do DB).
- RNF‑U1 Usabilidade: responsive design, feedback claro, URLs amigáveis.
- RNF‑O1 Observabilidade: logs estruturados de inicialização e erros.

## 9. Integrações e Stack
- Backend: Node.js + Express + TypeScript; agendamento (cron); envio de e‑mails (Nodemailer).
- Frontend: React + Vite + TypeScript + Tailwind; gráficos (Recharts/Chart.js).
- Persistência: Supabase (Postgres) e armazenamento de arquivos (relatórios).

## 10. API (resumo)
Autenticação & Sistema
- POST /api/auth/login
- GET /api/health

Monitores
- GET/POST /api/monitors
- PUT/DELETE /api/monitors/:id
- DELETE /api/monitors/:id/history (Limpar histórico)

Dashboard
- GET /api/dashboard/stats (Estatísticas agregadas)
- GET /api/dashboard/monitors (Lista com status em tempo real)

Grupos
- GET/POST /api/groups
- PUT/DELETE /api/groups/:id

Relatórios & SMTP
- POST /api/reports/send-monthly-custom
- GET/POST /api/smtp/config
- POST /api/smtp/test

API Pública (Status Pages)
- GET /api/public/groups
- GET /api/public/monitors
- GET /api/public/status/all
- GET /api/public/status/group/:id (Aceita UUID ou Slug)
- GET /api/public/status/monitor/:id (Aceita UUID ou Slug)
- GET /api/public/incidents
- GET /api/public/uptime-history
- GET /api/public/monitor-stats/:id
- GET /api/public/monitors/:id/checks
- GET /api/status-page/:slug (Resolver slug de grupo ou monitor)

## 11. Modelo de Dados (alto nível)
- users: id, email, password_hash, role, created_at.
- groups: id, name, description, slug, created_at.
- monitors: id, name, type, url, interval, is_active, group_id, slug, validation_config (json).
- monitor_checks: id, monitor_id, status, response_time, checked_at, error_message.
- smtp_config: host, port, user, pass (enc), secure, from_email, from_name.
- monthly_reports: id, monitor_id, email, sent_at, period_start, period_end.

## 12. Regras de Negócio
- Uptime = sucesso/(sucesso+falha) no período.
- Falha HTTP: status code fora de 2xx/3xx (salvo exceções configuradas), timeout, erro de rede ou falha de validação de conteúdo.
- Status Pages: Grupos e Monitores podem ser acessados publicamente se tiverem slug configurado ou via ID.
- Inicialização: O serviço deve sempre carregar o histórico recente do banco ao iniciar para evitar "falso 100% uptime".

## 13. Relatórios
- Conteúdo: KPIs do período, incidentes, gráficos de uptime.
- Entrega: PDF via e-mail (agendado ou manual).

## 14. Segurança e Compliance
- Senhas bcrypt; JWT expiração.
- Segredos em .env e banco (criptografados/protegidos).
- Rate limit diferenciado para login e API pública.

## 15. KPIs e Métricas
- Uptime global e por grupo.
- Tempo médio de resposta.
- MTTA/MTTR.

## 16. Roadmap
- v1.0: Monitores + Dashboard + Grupos + Relatórios básicos + SMTP + Auth. (Concluído)
- v1.1: Relatório mensal PDF + Limpeza de Histórico + Validações Avançadas. (Concluído)
- v1.2: Páginas Públicas de Status (Geral/Grupo/Monitor) com Slugs. (Concluído)
- v2.0: Tempo real via WebSocket; integrações (Slack/Teams); multi‑tenant. (Planejado)
