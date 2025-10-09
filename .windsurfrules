#1 O projeto já está em produção, então SEMPRE todas as alterações/correções feitas devem ser testadas e validadas DIRETAMENTE no ambiente de produção, isto é: https://monitor.pagina1digital.com.br/.

#2 Para testar e validar as alterações no ambiente de produção, primeiro elas devem ser implantadas em produção, isto é faça um novo commit e push e em seguida faça o deploy via ssh, ai então você pode testar as alterações no ambiente de produção, pois as correções já terão sido implantadas.

Dados SSH
root@85.31.62.181
Senha:Mlez1HO;4xNsbuxF4u5@

#Sempre que for fazer um novo deploy no servidor, confirme se você está conectado no terminal do servidor da VPS,e não no terminal local do Windows.

#3 Para validações em tabelas e tudo relacionado ao banco de dados, você pode usar o MCP do Supabase.
Caso o MCP não funcione, acesse o supabase e faça as validações manualmente.
Link: https://supabase.com/dashboard/
Login: websites@pagina1digital.com.br
Senha: Mlez1HO;4xNsbuxF4u5@

#4 Acessos Github
Login: cleeberm@hotmail.com
Senha: Palmeiras123!@

#5 Procedimento de Deploy Correto na VPS

## Passos para Deploy Bem-Sucedido:

### 1. Preparação Local
```bash
# Fazer commit das alterações
git add .
git commit -m "Descrição das alterações"
git push origin master
```

### 2. Conexão SSH e Deploy
```bash
# Conectar na VPS
ssh root@85.31.62.181

# Navegar para o diretório do projeto
cd uptime-monitor

# Verificar se há conflitos de merge antes do pull
git status

# Se houver conflitos, resolver automaticamente (aceitar incoming changes)
git pull --strategy=ours origin master

# Ou fazer pull normal se não houver conflitos
git pull origin master

# Rebuild e restart dos containers
docker compose down
docker compose build --no-cache
docker compose up -d

# Verificar se os containers estão rodando
docker compose ps
```

### 3. Verificações Pós-Deploy
```bash
# Verificar logs do backend
docker compose logs backend --tail=20

# Verificar logs do frontend
docker compose logs frontend --tail=20

# Verificar status do Nginx
systemctl status nginx

# Reiniciar Nginx se necessário
systemctl restart nginx
```

### 4. Testes de Validação
```bash
# Testar o site diretamente no servidor
curl -I https://monitor.pagina1digital.com.br

# Verificar logs do Nginx em caso de erro
tail -20 /var/log/nginx/monitor.pagina1digital.com.br.error.log
```

### 5. Comandos de Troubleshooting
```bash
# Verificar portas em uso
netstat -tlnp | grep :3000
netstat -tlnp | grep :8081

# Verificar containers
docker compose ps
docker compose logs [service_name]

# Verificar configuração do Nginx
nginx -t
cat /etc/nginx/sites-available/monitor.pagina1digital.com.br

# Verificar arquivos duplicados do Nginx
ls -la /etc/nginx/sites-available/ | grep monitor
```

## Pontos Importantes:
- ⚠️ **SEMPRE** verificar se está conectado no terminal da VPS antes de executar comandos de deploy
- ⚠️ Usar `--strategy=ours` no git pull para resolver conflitos automaticamente
- ⚠️ Fazer `docker compose build --no-cache` para garantir rebuild completo
- ⚠️ Verificar logs dos containers após cada deploy
- ⚠️ Reiniciar Nginx se houver mudanças na configuração
- ✅ O site deve responder HTTP 200 tanto localmente quanto via HTTPS público