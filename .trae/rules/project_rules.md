Todas as suas respostas e pensamentos devem ser no idioma Português BR.

Algumas premissas básicas que você precisa sempre se lembrar e executar:

- Avalie atentamente as instruções passadas no chat e faça somente o que for solicitado. Faça as correções apenas do que for solicitado e evite alterar o restante do projeto sem que seja orientado a isso.

- Tome o máximo de cuidado possível para que edições que estiver fazendo tenham o menor impacto possível em outras áreas do projeto.

- O projeto já está em execução, então após qualquer edição nos arquivos do projeto, é necessário fazer um git push e dentro do Easy Panel fazer um novo deploy.

- Crie os commits de forma simples com os comandos: git add . | git commit -m "mensagem do commit" | git push  

- Quando executar o comando de commit, mantenha sempre o mesmo padrão de identificação da versão anterior, apenas seguindo a sequencia para o próximo número da versão. Exemplo:
```
git commit -m "Produção: 010 - Erros ao cadastrar novo monitor"
git commit -m "Produção: 011 - Correção XYZ"
git commit -m "Produção: 012 - Correção XPTO"
```

- Quando fizer o deploy no Easy Panel, sempre faça tanto para o backend quanto para o frontend.

- Sempre após um deploy, verifique na aba Deployments se o deploy foi realizado com sucesso. Caso exista algum erro de deploy, verifique os logs, identifique e corrija.

- Quando necessário, faça as validações usando o MCP Playwright, tanto da aplicação quanto do EasyPanel. Estes são os acessos de ambos:
EasyPanel:
Link: http://85.31.62.181:3000/
Login: cleeberm@hotmail.com
Senha: 2tfcG4aMUy4VtHQ

Monitor
Link: https://monitor.pagina1digital.com.br/
Login: admin@agencia.com
Senha: admin123

- Quando necessário, faça validações do banco de dados usando o MCP do Supabase para verificar se todas as tabelas, relações e etc estão corretas.
Se necessário conecte-se via MCP Playwright na conta da Supabase para executar alguma ação. Estes são os dados de acesso:
Link: https://supabase.com/
Login: websites@pagina1digital.com.br
Senha: Mlez1HO;4xNsbuxF4u5@