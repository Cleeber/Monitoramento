Algumas premissas básicas que você precisa sempre se lembrar e executar:

- O projeto já está em execução então, após qualquer edição nos arquivos do projeto, é necessário fazer um git push e dentro do Easy Panel fazer um novo deploy. 
- Quando executar o comando de commit, mantenha sempre o mesmo padrão de identificação da versão anterior, apenas seguindo para o próximo número da versão "010, 011, 012, etc e a mensagem curta. Exemplo:
```
git commit -m "Produção: 010 - Erros ao cadastrar novo monitor"
```
- Crie os commits de forma simples com os comandos: git add . | git commit -m "mensagem do commit" | git push  

- Sempre faça as validações usando o MCP Playwrigth, tanto da aplicação quanto do EasyPanel. Estes são os acessos de ambos:
EasyPanel:
Link: http://85.31.62.181:3000/
Login: cleeberm@hotmail.com
Senha: 2tfcG4aMUy4VtHQ

Monitor
Link: https://monitor.pagina1digital.com.br/
Login: admin@agencia.com
Senha: admin123

- Faça validações do banco de dados usando o MCP do Supabase para verificar se todas as tabelas, relações e etc estão corretas.
Se necessário conecte-se via MCP Playwright na conta da Supabase para executar alguma ação. Estes são os dados de acesso:
Link: https://supabase.com/
Login: websites@pagina1digital.com.br
Senha: Mlez1HO;4xNsbuxF4u5@