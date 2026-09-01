# 🚀 Configuração de Deploy Automático com GitHub Actions

Este documento contém as instruções para configurar o deploy automático na VPS da Hostinger usando GitHub Actions.

## 📋 Pré-requisitos

- Repositório no GitHub
- VPS da Hostinger com acesso SSH
- Docker e Docker Compose instalados na VPS
- Projeto já funcionando na VPS

## 🔐 Configuração dos Secrets no GitHub

### 1. Acessar as configurações do repositório

1. Vá para o seu repositório no GitHub
2. Clique em **Settings** (Configurações)
3. No menu lateral, clique em **Secrets and variables** → **Actions**
4. Clique em **New repository secret**

### 2. Adicionar os seguintes secrets:

#### `SSH_HOST`
- **Nome:** `SSH_HOST`
- **Valor:** IP ou domínio da sua VPS (ex: `123.456.789.123` ou `seu-dominio.com`)

#### `SSH_USERNAME`
- **Nome:** `SSH_USERNAME`
- **Valor:** Usuário SSH da VPS (geralmente `root` ou seu usuário)

#### `SSH_PRIVATE_KEY`
- **Nome:** `SSH_PRIVATE_KEY`
- **Valor:** Chave privada SSH (conteúdo completo do arquivo `~/.ssh/id_rsa`)

#### `SSH_PORT` (Opcional)
- **Nome:** `SSH_PORT`
- **Valor:** Porta SSH (padrão: `22`)

#### `PROJECT_PATH`
- **Nome:** `PROJECT_PATH`
- **Valor:** Caminho completo do projeto na VPS (ex: `/home/usuario/uptime-monitor`)

## 🔑 Como obter a chave SSH privada

### Opção 1: Usar chave existente
```bash
# Na sua máquina local ou na VPS
cat ~/.ssh/id_rsa
```

### Opção 2: Criar nova chave SSH
```bash
# Gerar nova chave SSH
ssh-keygen -t rsa -b 4096 -C "github-actions@deploy"

# Copiar chave pública para a VPS
ssh-copy-id -i ~/.ssh/id_rsa.pub usuario@ip-da-vps

# Exibir chave privada para copiar
cat ~/.ssh/id_rsa
```

## 📁 Estrutura do Projeto na VPS

Certifique-se de que o projeto esteja estruturado assim na VPS:

```
/caminho/do/projeto/
├── docker-compose.yml
├── Dockerfile
├── .env
├── src/             # backend
├── client/          # frontend (SPA)
├── database/
├── scripts/
├── uploads/         # volume Docker
├── reports/         # volume Docker
└── .git/
```

## 🔄 Como funciona o Deploy

O workflow será executado automaticamente quando:

1. **Push para branch master/main:** Deploy automático
2. **Pull Request:** Apenas testes (sem deploy)

### Processo do Deploy:

1. ✅ Checkout do código
2. ✅ Setup do Node.js
3. ✅ Instalação de dependências
4. ✅ Build do frontend
5. ✅ Conexão SSH com a VPS
6. ✅ Git pull na VPS
7. ✅ Backup e restauração do .env
8. ✅ Parada dos containers
9. ✅ Rebuild dos containers
10. ✅ Restart dos containers
11. ✅ Verificação do status
12. ✅ Limpeza de imagens não utilizadas

## 🧪 Testando o Deploy

1. Faça um commit e push para a branch master:
```bash
git add .
git commit -m "test: Testar deploy automático"
git push origin master
```

2. Vá para a aba **Actions** no GitHub para acompanhar o progresso

3. Verifique se o deploy foi bem-sucedido acessando sua aplicação

## 🚨 Troubleshooting

### Erro de conexão SSH
- Verifique se o IP/domínio está correto
- Confirme se a porta SSH está correta (padrão: 22)
- Teste a conexão SSH manualmente

### Erro de permissão
- Verifique se a chave SSH está correta
- Confirme se a chave pública está no `~/.ssh/authorized_keys` da VPS

### Erro no Docker
- Verifique se o Docker está instalado e rodando na VPS
- Confirme se o usuário tem permissões para executar Docker

### Erro de caminho
- Verifique se o `PROJECT_PATH` está correto
- Confirme se o repositório Git está inicializado no diretório

## 📊 Monitoramento

Após cada deploy, você pode verificar:

1. **GitHub Actions:** Status do workflow
2. **VPS:** Logs dos containers
```bash
docker-compose logs -f
```
3. **Aplicação:** Funcionamento no navegador

## 🔒 Segurança

- ✅ Chaves SSH são armazenadas como secrets criptografados
- ✅ Deploy apenas em branches autorizadas
- ✅ Backup automático do arquivo .env
- ✅ Limpeza automática de imagens Docker

---

## 📞 Suporte

Se encontrar problemas:

1. Verifique os logs do GitHub Actions
2. Teste a conexão SSH manualmente
3. Confirme se todos os secrets estão configurados
4. Verifique se o projeto está funcionando manualmente na VPS