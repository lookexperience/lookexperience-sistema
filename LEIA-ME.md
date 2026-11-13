# Sistema interno da LOOK

Painel online da LOOK para organizar tarefas, calendário, clientes e projetos, com login e permissões por usuário.

**Versão:** 0.3.0. O histórico de mudanças fica em `js/versao.js` e aparece na tela "Sobre o sistema".

## Como está montado

| Peça | O que faz |
| --- | --- |
| `index.html`, `css/`, `js/`, `img/`, `fonts/` | As telas. Não precisam de instalação nem de etapa de build: a Cloudflare publica as telas como estão. |
| `supabase/schema.sql` | O banco de dados: tabelas, permissões por usuário e as regras de segurança. |
| `js/config.js` | Endereço e chave pública do Supabase. |
| `publicar.sh` | Publicação na Cloudflare Pages (onde o sistema fica desde nov/2026): monta a pasta `publico/` só com as telas e os cabeçalhos de segurança. Na Cloudflare: comando de build `bash publicar.sh`, pasta de saída `publico`. |
| `netlify.toml` | Cabeçalhos de segurança (lidos também pelo `publicar.sh` e pelos testes). Era a configuração da Netlify, que ficou sem créditos grátis para publicar. |
| `js/apresentacao/`, `modelos/` | Tela Apresentações: lê o Word no navegador (`docx.js`) e monta os slides no padrão LOOK (`slides.js`). `modelos/modelo-apresentacao-look.docx` é o modelo para baixar. |
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

- Para criar conta é preciso a **senha de acesso da LOOK** (o administrador passa para a pessoa). O banco confere essa senha, então não dá para pular pela API. Quem não sabe a senha não consegue nem criar a conta. O administrador troca a senha em **Equipe e acessos > Trocar senha de acesso**; quem já tem conta continua entrando normalmente.
- Cada pessoa cria a própria conta na tela de entrada e fica "Aguardando liberação".
- O administrador abre **Equipe e acessos**, escolhe cargo e setores e marca, módulo por módulo, o que a pessoa pode **ver, criar, editar e apagar**.
- Em tarefas, também escolhe o alcance: só as dela, as dos setores dela, ou todas.
- Uma tarefa pode ter **vários responsáveis** (até 10). Todos veem a tarefa, recebem os avisos dela e podem mudar o status. O primeiro marcado fica como responsável principal.
- Para tirar alguém, desmarque "Conta ativa".

## Anexos dos projetos

- Na janela de cada projeto: imagens, PDF, Word, PowerPoint e Excel, até 20 MB cada.
- Os arquivos ficam no depósito privado `anexos` do Supabase Storage (criado pelo `schema.sql`). O plano grátis guarda 1 GB no total; vídeos e arquivos pesados ficam como link do Google Drive na descrição do projeto.
- Quem vê o projeto vê os anexos; quem pode editar projetos anexa; apaga quem pode apagar projetos ou quem enviou o arquivo.

## Briefing do cliente

- Na janela do projeto: escolha o modelo (marca ou programa ao vivo) e clique em **+ Gerar link de briefing**. Copie o link e mande para o cliente.
- O cliente responde em `briefing.html#código`, sem login. O código tem 64 letras e números sorteados pelo banco e só abre aquele briefing. Depois de enviado, o link não aceita outra resposta.
- As respostas ficam no projeto (**Ver respostas**). Quem gerou o link e os administradores recebem aviso.
- Projeto novo de cliente começa com **Briefing pendente**. Isso aparece como alerta (lista de projetos, cartões e tarefas), mas não trava nada. No campo "Briefing do cliente" do projeto dá para marcar "Recebido" ou "Não precisa".
- As perguntas ficam em `js/briefing-modelos.js`. Cada briefing guarda a própria cópia das perguntas, então mudar o modelo não mexe nos que já foram enviados.

## Finanças

- Tela **Finanças** no menu. Cada lançamento é uma entrada ou uma saída, com valor, data, categoria e se já foi pago.
- **Pessoal**: todo mundo da equipe tem a sua. Só o dono vê e mexe, nem o administrador do sistema (a regra está no banco). Atenção: quem abre o painel do Supabase como dono do projeto enxerga tudo, então a senha do Supabase continua sendo só do PABLO.
- **Empresa**: o caixa da LOOK. Aparece só para quem tem a permissão **Financeiro da empresa** em Equipe e acessos (ver, criar, editar e apagar separados). O administrador sempre vê.
- **Nota fiscal**: o botão **Emitir nota fiscal** abre o Emissor Nacional (`LINK_EMISSOR_NF` em `js/config.js`). Depois de emitir, anote o número e anexe o PDF (ou foto, até 5 MB) no lançamento. O arquivo fica no depósito privado `notas` do Supabase e só abre para quem vê o caixa da empresa. Entradas sem nota ganham a etiqueta "Sem nota".
- Lançamento "a receber" ou "a pagar" (desmarcado em "Já recebi" ou "Já paguei") não entra no saldo até ser marcado.

## Orçamentos

- Tela **Orçamentos** no menu, para quem tem a permissão **Comercial e orçamentos** (ver, criar, editar e apagar separados). O administrador sempre vê.
- O número (2026-001, 2026-002...) é dado pelo banco, em sequência por ano, e nunca muda. A folha inteira (cliente, itens, desconto, condições) fica na coluna `dados`; os totais ficam em colunas para a lista.
- **Tabela de preços e textos padrão**: `js/orcamento-tabela.js`. É a mesma tabela do gerador avulso (`look/orcamentos/fonte/orcamento.html`): ao mudar um preço lá, mude aqui também.
- **PDF**: sai pelo `js/vendor/pdf-orcamento.js` (cópia do gerador avulso) com o jsPDF 2.5.1 (`js/vendor/jspdf.umd.min.js`) e as fontes `.ttf` de `fonts/`. Tudo fica no próprio site, sem serviço de fora.
- Orçamento **aprovado** ganha o botão **Lançar no caixa (a receber)** para quem também pode criar no Financeiro da empresa: cria a entrada no Caixa da LOOK (valor único; se só houver plano mensal, o primeiro mês) e liga ao orçamento.

## Como fazer atualizações

Toda mudança é feita no código, e só vai pro ar com os testes de `testes/` passando:

1. A mudança é feita num ramo separado do repositório no GitHub.
2. A Cloudflare gera uma prévia com endereço próprio para conferir.
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
