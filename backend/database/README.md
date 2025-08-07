# Configuração do Banco de Dados Supabase

Este diretório contém os scripts SQL necessários para configurar o banco de dados no Supabase.

## Passos para Configuração

### 1. Acesse o Supabase Dashboard
- Faça login em [supabase.com](https://supabase.com)
- Acesse seu projeto
- Vá para a seção "SQL Editor"

### 2. Execute o Schema
- Abra o arquivo `schema.sql`
- Copie todo o conteúdo
- Cole no SQL Editor do Supabase
- Execute o script clicando em "Run"

### 3. Verifique as Tabelas Criadas
Após executar o script, as seguintes tabelas devem estar disponíveis:
- `users` - Usuários do sistema
- `groups` - Grupos
- `monitors` - Monitores de uptime
- `monitor_checks` - Histórico de verificações
- `smtp_config` - Configuração de email
- `reports` - Relatórios gerados

### 4. Configurar Variáveis de Ambiente
Certifique-se de que o arquivo `.env` do backend contém:
```
SUPABASE_URL=sua_url_do_supabase
SUPABASE_ANON_KEY=sua_chave_anonima
SUPABASE_SERVICE_ROLE_KEY=sua_chave_de_servico
```

### 5. Dados Padrão
O script já inclui:
- Usuário administrador: `admin@agencia.com` / `admin123`
- Grupo de exemplo: "Grupo Exemplo"

## Funcionalidades Implementadas

### Cadastro de Grupos
- ✅ Criar novos grupos
- ✅ Listar grupos existentes
- ✅ Editar informações do grupo
- ✅ Excluir grupos (com verificação de dependências)

### Cadastro de Domínios (Monitores)
- ✅ Criar novos monitores
- ✅ Listar monitores existentes
- ✅ Editar configurações do monitor
- ✅ Excluir monitores
- ✅ Associar monitores a grupos (opcional)

### Integração com Supabase
- ✅ Todas as operações CRUD utilizam o Supabase
- ✅ Dados mock removidos
- ✅ Autenticação integrada
- ✅ Configuração SMTP persistente

## Testando a Funcionalidade

1. **Teste de Login**:
   - Acesse `http://localhost:3000/login`
   - Use: `admin@agencia.com` / `admin123`

2. **Teste de Cadastro de Grupo**:
   - Vá para a página de Grupos
   - Clique em "Adicionar Grupo"
   - Preencha os dados e salve

3. **Teste de Cadastro de Domínio**:
   - Vá para a página de Domínios
   - Clique em "Adicionar Monitor"
   - Opcionalmente selecione um grupo e configure o monitor

## Troubleshooting

### Erro: "relation does not exist"
- Execute o script `schema.sql` no Supabase SQL Editor

### Erro: "Could not find a relationship"
- Verifique se as foreign keys foram criadas corretamente
- Re-execute o script se necessário

### Erro de Autenticação
- Verifique as variáveis de ambiente do Supabase
- Confirme que as chaves estão corretas