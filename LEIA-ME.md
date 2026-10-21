# Sistema interno da LOOK

Painel online da LOOK para organizar tarefas, calendário, clientes e projetos, com login e permissões por usuário.

**Versão:** 0.1.0 (fase 1). O histórico de mudanças fica em `js/versao.js` e aparece na tela "Sobre o sistema".

## Como está montado

| Peça | O que faz |
| --- | --- |
| `index.html`, `css/`, `js/`, `img/`, `fonts/` | As telas. Não precisam de instalação nem de etapa de build: o Netlify publica a pasta como está. |
| `supabase/schema.sql` | O banco de dados: tabelas, permissões por usuário e as regras de segurança. |
| `js/config.js` | Onde entram o endereço e a chave pública do Supabase. Vazio = modo demonstração. |
| `netlify.toml` | Configuração de publicação no Netlify. |

## Modo demonstração

Enquanto `js/config.js` estiver sem os dados do Supabase, o sistema abre com dados de exemplo, salvos só no navegador. A faixa dourada no topo deixa ver o sistema como cada usuário de exemplo (administrador, gerente, freelancer, conta sem acesso), para conferir as permissões.

## Ligar o banco de verdade (uma vez só)

1. Criar uma conta gratuita em supabase.com e um projeto novo (região São Paulo).
2. No projeto, abrir **SQL Editor**, colar todo o `supabase/schema.sql` e clicar em **Run**.
3. Em **Project Settings > API**, copiar a **Project URL** e a chave **anon public** para `js/config.js`.
4. Publicar. A **primeira conta criada** no sistema vira administrador principal automaticamente.

A chave anon é pública por natureza. Quem protege os dados são as regras do banco (RLS): mesmo que alguém mexa na tela, o banco só entrega o que aquele usuário pode ver.

## Permissões

- Cada pessoa cria a própria conta na tela de entrada e fica "Aguardando liberação".
- O administrador abre **Equipe e acessos**, escolhe cargo e setores e marca, módulo por módulo, o que a pessoa pode **ver, criar, editar e apagar**.
- Em tarefas, também escolhe o alcance: só as dela, as dos setores dela, ou todas.
- O responsável por uma tarefa sempre pode mudar o status dela.
- Para tirar alguém, desmarque "Conta ativa".

## Como fazer atualizações

Toda mudança é feita no código:

1. A mudança é feita num ramo separado do repositório no GitHub.
2. O Netlify gera uma prévia com endereço próprio para conferir.
3. Aprovada, ela entra no ramo principal e vai pro ar sozinha.
4. Cada versão fica guardada no GitHub; dá para voltar atrás.
5. Toda atualização acrescenta uma entrada em `js/versao.js`.

Mudanças no banco entram como arquivos novos em `supabase/` (ex.: `002-comercial.sql`), rodados no SQL Editor na ordem.
