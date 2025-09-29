# 🚀 Guia de Deploy - Sistema de Monitoramento Uptime

## 📋 Pré-requisitos

- VPS configurada com EasyPanel
- Domínios configurados na Cloudflare
- Conta Supabase configurada
- Repositório GitHub conectado ao EasyPanel

## 🔧 Configuração do EasyPanel

### 1. Aplicações Criadas
- **monitoramento** (aplicação principal)
  - **backend** (serviço)
  - **frontend** (serviço)
- **redis** (aplicação separada)

### 2. Variáveis de Ambiente

#### Backend
```env
SUPABASE_URL=https://zhywrrzzezexlvtpqacl.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoeXdycnp6ZXpleGx2dHBxYWNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNDc2NzYsImV4cCI6MjA3MzYyMzY3Nn0.5oajwKPFaz9HsyhgTK6EXsjGVajw_YuUF-TOtAc7rNw
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoeXdycnp6ZXpleGx2dHBxYWNsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODA0NzY3NiwiZXhwIjoyMDczNjIzNjc2fQ.d5jf-sobZyluD0FZFj1fh8Eai12QeohnQxeRwL9j5T4
JWT_SECRET=EJ/c4RA7wQ17O+dEynIcn4MXA4oOiBr39zBSTdexzaZuzl8XUCwfoJA4nngxGH0FMa83xwmeRfxs52pN3qs7sQ==
PORT=3001
NODE_ENV=production
REDIS_URL=redis://redis:6379
FRONTEND_BASE_URL=https://monitor.pagina1digital.com.br
CORS_ORIGIN=https://monitoramento-uptime-monitor.4uxnvx.easypanel.host
```

#### Frontend
```env
VITE_API_URL=https://monitor.pagina1digital.com.br/api
VITE_SUPABASE_URL=https://zhywrrzzezexlvtpqacl.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoeXdycnp6ZXpleGx2dHBxYWNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNDc2NzYsImV4cCI6MjA3MzYyMzY3Nn0.5oajwKPFaz9HsyhgTK6EXsjGVajw_YuUF-TOtAc7rNw
VITE_BACKEND_ORIGIN=https://monitor.pagina1digital.com.br
```

### 3. Configuração de Source
- **Backend**: `backend/Dockerfile`
- **Frontend**: `frontend/Dockerfile`

## 🌐 Domínios Configurados

- **Frontend**: https://monitor.pagina1digital.com.br
- **Backend**: https://monitor.pagina1digital.com.br/api
- **EasyPanel**: https://monitoramento-uptime-monitor.4uxnvx.easypanel.host

## 🔄 Deploy Automático

### GitHub Actions
O arquivo `.github/workflows/deploy.yml` está configurado para:
1. Executar testes automaticamente
2. Fazer build do backend e frontend
3. Triggerar deploy no EasyPanel

### Deploy Manual
```bash
# 1. Fazer commit das alterações
git add .
git commit -m "Deploy: atualizações do sistema"

# 2. Push para o repositório
git push origin main

# 3. EasyPanel detectará automaticamente e fará o redeploy
```

## 🧪 Testes de Conectividade

Execute o script de teste para verificar se todos os serviços estão funcionando:

```bash
node test-connectivity.js
```

## 📁 Estrutura de Arquivos

```
uptime-monitor/
├── backend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── .env.example
│   └── src/
├── frontend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── .env.example
│   └── src/
├── .github/
│   └── workflows/
│       └── deploy.yml
├── docker-compose.yml
├── .env.production
├── test-connectivity.js
└── DEPLOY.md
```

## 🔧 Comandos Úteis

### Desenvolvimento Local
```bash
# Executar com Docker Compose
docker-compose up -d

# Parar serviços
docker-compose down

# Ver logs
docker-compose logs -f
```

### Verificação de Status
```bash
# Testar conectividade
node test-connectivity.js

# Verificar logs do EasyPanel
# (acessar via interface web)
```

## 🚨 Troubleshooting

### Problemas Comuns

1. **Erro de CORS**
   - Verificar se `CORS_ORIGIN` está configurado corretamente
   - Confirmar se `FRONTEND_BASE_URL` está correto

2. **Erro de Conexão com Supabase**
   - Verificar se as chaves estão corretas
   - Confirmar se a URL do Supabase está acessível

3. **Erro de Redis**
   - Verificar se o serviço Redis está rodando
   - Confirmar se `REDIS_URL` está correto

4. **Erro de Build**
   - Verificar se os Dockerfiles estão corretos
   - Confirmar se as dependências estão instaladas

### Logs Importantes
- **EasyPanel**: Interface web > Logs
- **Backend**: Logs do container backend
- **Frontend**: Logs do container frontend
- **Redis**: Logs do container redis

## 📞 Suporte

Para problemas específicos:
1. Verificar logs no EasyPanel
2. Executar teste de conectividade
3. Verificar configurações de DNS na Cloudflare
4. Confirmar variáveis de ambiente

## ✅ Checklist de Deploy

- [ ] VPS configurada
- [ ] EasyPanel instalado
- [ ] Aplicações criadas (monitoramento + redis)
- [ ] Variáveis de ambiente configuradas
- [ ] Domínios apontando para VPS
- [ ] Repositório GitHub conectado
- [ ] Dockerfiles criados
- [ ] GitHub Actions configurado
- [ ] Teste de conectividade executado
- [ ] Sistema funcionando em produção