# Sistema interno da LOOK

Painel online da LOOK para organizar tarefas, calendário, clientes e projetos, com login e permissões por usuário.

**Versão:** 0.2.0 (fase 1 + ajustes da primeira revisão). O histórico de mudanças fica em `js/versao.js` e aparece na tela "Sobre o sistema".

## Como está montado

| Peça | O que faz |
| --- | --- |
| `index.html`, `css/`, `js/`, `img/`, `fonts/` | As telas. Não precisam de instalação nem de etapa de build: o Netlify publica a pasta como está. |
| `supabase/schema.sql` | O banco de dados: tabelas, permissões por usuário e as regras de segurança. |
| `js/config.js` | Endereço e chave pública do Supabase. |
| `netlify.toml` | Configuração de publicação no Netlify. |
| `testes/` | Testes automáticos de cada tipo de usuário (banco e telas). Ver `testes/LEIA-ME.md`. |

## Modo demonstração

Aberto no próprio computador (localhost, como nos testes) ou com `?demo` no endereço, o sistema abre com dados de exemplo, salvos só no navegador. A faixa dourada no topo deixa ver o sistema como cada usuário de exemplo (administrador, gerente, freelancer, conta sem acesso), para conferir as permissões.

## Ligar o banco de verdade (uma vez só)

1. Criar uma conta gratuita em supabase.com e um projeto novo (região São Paulo).
2. No projeto, abrir **SQL Editor**, colar todo o `supabase/schema.sql` e clicar em **Run**.
3. Em **Project Settings > API**, copiar a **Project URL** e a chave pública (**publishable**, antiga **anon public**) para `js/config.js`.
4. Publicar. A **primeira conta criada** no sistema vira administrador principal automaticamente.
5. Opcional: colar `supabase/dados-iniciais.sql` no SQL Editor para trazer os clientes, projetos e a lista de tarefas que existiam antes do sistema.

A chave pública pode ficar no código. Quem protege os dados são as regras do banco (RLS): mesmo que alguém mexa na tela, o banco só entrega o que aquele usuário pode ver.

## Permissões

- Cada pessoa cria a própria conta na tela de entrada e fica "Aguardando liberação".
- O administrador abre **Equipe e acessos**, escolhe cargo e setores e marca, módulo por módulo, o que a pessoa pode **ver, criar, editar e apagar**.
- Em tarefas, também escolhe o alcance: só as dela, as dos setores dela, ou todas.
- O responsável por uma tarefa sempre pode mudar o status dela.
- Para tirar alguém, desmarque "Conta ativa".

## Como fazer atualizações

Toda mudança é feita no código, e só vai pro ar com os testes de `testes/` passando:

1. A mudança é feita num ramo separado do repositório no GitHub.
2. O Netlify gera uma prévia com endereço próprio para conferir.
3. Aprovada, ela entra no ramo principal e vai pro ar sozinha.
4. Cada versão fica guardada no GitHub; dá para voltar atrás.
5. Toda atualização acrescenta uma entrada em `js/versao.js`.

Mudanças no banco entram no `supabase/schema.sql`, que pode ser rodado de novo no SQL Editor sem perder dados.

## Robôs do GitHub (aba Actions)

- **Testes**: a cada pull request, roda os testes do banco (permissões e ataques) e das telas. Só dá merge com tudo verde.
- **Manter o banco ativo**: a cada 2 dias dá um "oi" no Supabase, que no plano grátis pausa depois de 7 dias sem uso.
- **Backup do banco**: toda segunda-feira guarda uma cópia das tabelas por 90 dias. Precisa do segredo `SUPABASE_DB_URL` em Settings > Secrets and variables > Actions, com o endereço "Session pooler" do Supabase (Connect) e a senha do banco no lugar de `[YOUR-PASSWORD]`.

## Segurança

- O banco decide quem vê o quê (RLS). Visitante sem login não acessa tabela nem função (só o `ping` do robô).
- Textos têm limite de tamanho e a cor do cliente só aceita `#RRGGBB`.
- O site manda uma política de segurança (CSP) que só deixa rodar scripts do próprio sistema e da biblioteca do Supabase.
- Os testes em `testes/` simulam ataques: conta nova tentando se liberar, freelancer tentando subir de cargo ou ler avisos dos outros, código escondido em nomes e textos, visitante chamando o banco direto.
