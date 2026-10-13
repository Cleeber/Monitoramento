# Análise do backend Supabase e retenção de dados

Em 13 de outubro de 2026, o banco do projeto `uptime-monitor` ocupava 68,4 MB. A tabela `monitor_checks` concentrava 55,2 MB, incluindo dados, índices e espaço alocado pelo PostgreSQL. O principal ajuste necessário é substituir a exclusão semanal de dados acima de 30 dias pela retenção de 180 dias definida para as verificações detalhadas.

## Volume e armazenamento

| Medida | Resultado observado |
| --- | --- |
| Monitores ativos | 18, com intervalo de 5 minutos |
| Verificações armazenadas | Aproximadamente 169 mil |
| Verificação mais antiga | 11 de setembro de 2026 |
| Verificações com mais de 180 dias | 0 |
| `monitor_checks`, dados da tabela | 19,7 MB |
| `monitor_checks`, total com índices e espaço alocado | 55,2 MB |
| Banco inteiro | 68,4 MB |
| Histórico de envios de relatórios | 62 registros, 188 KB com índices |
| Tokens de renovação | 36 registros; 35 expirados há mais de 7 dias |

Com todos os monitores executando continuamente, são 18 × 288 = 5.184 verificações por dia e 933.120 em 180 dias. A projeção proporcional do espaço atual é de aproximadamente **304 MB para a tabela de verificações**, incluindo índices. Ela não representa uma garantia de tamanho: o espaço alocado inclui versões antigas de linhas e os índices não crescem de forma perfeitamente linear.

## Gargalos identificados

1. **Limpeza em uma única transação.** O agendamento antigo fazia um `DELETE` sem limite e duas contagens exatas de toda a tabela. As contagens apresentavam média histórica de 969 ms; a exclusão antiga, média de 200 ms. Essas estatísticas são acumuladas desde setembro de 2025 e não representam percentis ou um teste de carga atual.
2. **Carregamento de histórico em memória.** `MonitoringService.loadRecentChecks` solicita até 500 mil registros por monitor, sem filtro de data. Os cálculos de disponibilidade percorrem o array global três vezes por verificação. Com retenção maior, aumentam o tráfego inicial, a memória e o trabalho de CPU. O próximo ajuste deve carregar somente a janela de 30 dias usada no painel e calcular resumos no banco.
3. **Relatórios transferem todas as verificações.** `getMonitorChecksForPeriod` usa `SELECT *` com limite de 100 mil, sem paginação. As consultas por período têm média histórica de 85 ms. Uma leitura real de 30 dias retornou 8.645 linhas de um monitor; não houve truncamento nesse teste. Com intervalos menores ou relatórios maiores, o limite do servidor pode truncar resultados. Usar agregações SQL para estatísticas e paginação para detalhes evita esse risco.
4. **Índices repetidos e espaço dos índices.** Já existem índices em `checked_at` e `(monitor_id, checked_at DESC)`, portanto não é necessário criar novos para a limpeza. Os índices de verificações ocupam cerca de 35 MB. Existem duplicatas exatas em `monthly_report_configs(is_active)`, além de índices candidatos à consolidação em `users(email)`, `monitors(slug)` e `monitor_checks(monitor_id)`. Validar planos e dependências antes de removê-los; os menores não são prioridade de armazenamento.
5. **Manutenção após exclusões.** Havia aproximadamente 18,8 mil versões mortas em `monitor_checks`; o último autovacuum observado ocorreu em 11 de outubro. Isso exige acompanhamento, não demonstra por si só um problema de bloat. Exclusões liberam espaço para reutilização após vacuum; não garantem redução imediata do arquivo no disco. Evitar `VACUUM FULL` como tarefa recorrente, pois ele exige bloqueio exclusivo. [Documentação PostgreSQL](https://www.postgresql.org/docs/15/sql-vacuum.html).

## Rotina de limpeza

A migration `supabase/migrations/20261013200630_monitoring_retention_180_days.sql` instala `maintenance.cleanup_monitoring_data`, executada pelo Supabase Cron. A função usa o índice de data, bloqueio consultivo por transação e `FOR UPDATE SKIP LOCKED`. Seu acesso fica restrito ao proprietário administrativo, sem execução por `anon`, `authenticated` ou `service_role`.

| Dados | Retenção | Limite por execução |
| --- | --- | --- |
| Verificações detalhadas | 180 dias completos | 5.000 linhas |
| Tokens já expirados | 7 dias após a expiração | 1.000 linhas |
| Execuções concluídas deste job | 30 dias | 1.000 linhas |
| Relatórios e histórico de envios | Preservados | Não são excluídos pela rotina |

O job `monitoring-retention-180-days` executa **uma vez por dia, às 02:17 no horário de São Paulo**, com limite de 20 segundos e espera por bloqueios de até 2 segundos. O cron `17 5 * * *` usa o fuso GMT configurado no banco e corresponde a 05:17 UTC. A rodada diária executa até dois lotes de 5 mil verificações, com capacidade máxima de 10 mil exclusões por dia, acima da entrada atual de 5.184. Sua execução depende do banco estar ativo, mas independe do processo Node da aplicação.

A migration inicial instala o job pausado para permitir a desativação da limpeza antiga. A migration `supabase/migrations/20261013202220_monitoring_retention_daily.sql` aplica a frequência diária solicitada e preserva o estado ativo ou pausado existente.

O histórico do Cron registra sucesso ou falha. Uma chamada manual da função retorna as quantidades removidas. O próprio histórico do Cron precisa de retenção, porque não é limpo automaticamente. A rotina remove somente registros concluídos do seu próprio job. [Supabase Cron](https://supabase.com/docs/guides/cron), [limpeza do histórico](https://supabase.com/docs/guides/cron/quickstart).

## Segurança corrigida em produção

O [Security Advisor](https://supabase.com/dashboard/project/zhywrrzzezexlvtpqacl/advisors/security) passou de **1 erro e 13 avisos para zero erros e zero avisos** após as correções de 13 de outubro de 2026. As verificações do Advisor abrangem as categorias do banco analisadas pelo Supabase; os testes da API complementam essa análise.

- As políticas irrestritas de `monthly_report_configs` e `monthly_report_history` foram removidas. O acesso direto às oito tabelas da aplicação foi revogado de `PUBLIC`, `anon` e `authenticated`, incluindo `TRUNCATE`, que não é restringido por RLS. O backend mantém suas permissões de leitura e escrita.
- `refresh_tokens` recebeu RLS e política exclusiva para `service_role`. Os testes confirmaram criação, leitura, atualização e exclusão de um token temporário pelo backend, seguida da remoção da fixture.
- `cleanup_expired_refresh_tokens()` passou a executar com `SECURITY INVOKER`. As funções da aplicação, incluindo `exec_sql(text)`, ficaram restritas ao backend e receberam `search_path` fixo. Chamadas anônimas aos RPCs administrativos foram negadas.
- As tabelas de monitores e verificações deixaram de ter políticas anônimas. O frontend acessa os dados públicos pela API do backend. A listagem pública usa uma seleção explícita de campos, protegendo e-mails de relatório, regras de validação e configurações internas.
- As rotas públicas de incidentes, disponibilidade e estatísticas agora verificam se o monitor está ativo. Monitores inativos, inexistentes ou IDs inválidos recebem 404; as rotas privadas continuam exigindo autenticação.
- Os oito avisos de `search_path` das funções foram corrigidos. A extensão `unaccent` foi reinstalada no schema `extensions` pelo painel do Supabase, após confirmar a ausência de dependências personalizadas e o uso do dicionário padrão. A geração de slugs com acentos foi validada novamente. [Orientação do Advisor](https://supabase.com/docs/guides/observability/advisors?queryGroups=lint&lint=0014_extension_in_public).
- A criação automática de uma conta administrativa com senha padrão foi removida do backend em produção. O bootstrap exige credenciais explícitas e preserva um administrador existente.

A troca da senha administrativa padrão **permanece pendente de ação do proprietário no painel**, conforme a escolha expressa durante a correção. As permissões do banco e o bootstrap foram corrigidos sem alterar essa senha.

O Performance Advisor continua sendo uma análise separada: os índices duplicados e não utilizados descritos no diagnóstico são próximos ajustes de desempenho.

## Operação e validação

As consultas de status, comandos de ativação e pausa e execução manual estão em `database/monitoring_retention_operations.sql`. O script `scripts/supabase-sql.mjs` usa as credenciais já configuradas no ambiente, sem imprimi-las. O plugin MCP estava sem autenticação; as medições foram feitas pelo acesso administrativo existente e a extensão Cron foi habilitada no painel autenticado do Supabase.

```powershell
node scripts/supabase-sql.mjs supabase/migrations/20261013200630_monitoring_retention_180_days.sql
node scripts/supabase-sql.mjs supabase/migrations/20261013202220_monitoring_retention_daily.sql
node scripts/supabase-sql.mjs supabase/migrations/20261013202617_backend_security_hardening.sql
node scripts/supabase-sql.mjs supabase/migrations/20261013204643_unaccent_private_schema.sql
node scripts/supabase-sql.mjs database/tests/monitoring_retention.sql --rollback-test
node scripts/supabase-sql.mjs database/tests/backend_security.sql --rollback-test
node scripts/verify-backend-security.mjs
npm run check
```

Os testes SQL verificam limite de lote, prioridade dos registros mais antigos, preservação do limite exato de 180 dias, de linhas sem data, de tokens válidos e de jobs em andamento, além das permissões. Uma exceção intencional ao final reverte todas as inserções e exclusões do teste. A concorrência também foi verificada em duas transações independentes.

O backend em produção utiliza a estrutura anterior em `backend/src`, enquanto esta cópia usa `src`. A alteração de produção deve desativar apenas o agendamento antigo, preservando a arquitetura e o comportamento dos relatórios existentes. O job deve ser ativado somente depois de verificar que o processo em execução já não agenda a limpeza de 30 dias.

A desativação do agendamento antigo foi implantada no backend em 13 de outubro de 2026. A imagem em execução foi derivada da imagem anterior, alterando apenas a chamada ao agendamento no JavaScript compilado; a mesma desativação foi salva no fonte de produção para os próximos builds. O frontend não foi recriado. A imagem de rollback está disponível na VPS como `uptime-monitor-backend:before-retention-20261013201456`. O endpoint público `/api/health` respondeu HTTP 200 após a implantação.

O job de retenção foi ativado depois dessa verificação. As migrations também são registradas em `supabase_migrations.schema_migrations`. Reaplicar o arquivo inicial restaura o agendamento horário e pausa o job; reaplicar a migration diária e usar o comando de ativação no arquivo de operações após a validação.

A primeira execução automática terminou com sucesso em 13 de outubro de 2026 às **17:17, horário de São Paulo**, em aproximadamente **22 ms**. Os 35 tokens expirados há mais de 7 dias foram removidos; não havia verificações acima de 180 dias para excluir. Os testes SQL foram executados com rollback integral, os testes de concorrência passaram, e `npm run check` concluiu lint, checagem de tipos, 7 testes e build.

A frequência foi alterada no mesmo dia para uma execução diária às 02:17, conforme solicitado. A consulta de validação confirmou um único job ativo com `17 5 * * *` no fuso GMT. O comando diário com dois lotes foi executado para validação com rollback integral, sem exclusões persistentes durante esse teste.

A correção de segurança foi implantada no backend existente e validada pelo endereço público. Os 10 testes automatizados, lint, checagem de tipos e build passaram. Os testes SQL de segurança e retenção passaram com rollback integral. A validação da API confirmou bloqueio anônimo de SELECT, INSERT, UPDATE e DELETE nas oito tabelas, bloqueio dos RPCs administrativos, preservação do acesso autenticado aos relatórios e das páginas públicas, além de 404 para históricos de monitores inativos e inexistentes.

A imagem anterior à correção de segurança foi preservada na VPS como `uptime-monitor-backend:before-security-20261013203912`. Reverter apenas a imagem não reverte as permissões do banco. A rotina de retenção de 180 dias permanece ativa com o cron diário `17 5 * * *`, às 02:17 de São Paulo.
