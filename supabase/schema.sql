-- =====================================================================
-- Sistema interno da LOOK · banco de dados (Supabase / PostgreSQL)
-- Fase 1: usuários, permissões por usuário, clientes, projetos,
-- tarefas, comentários e avisos.
--
-- Como usar: no painel do Supabase, abra "SQL Editor", cole este
-- arquivo inteiro e clique em "Run". Pode rodar de novo sem estragar
-- nada que já existe.
--
-- Regra de ouro: quem vê o quê é decidido AQUI, no banco, pelas
-- políticas de segurança (RLS). A tela só esconde botões; o banco é
-- quem realmente bloqueia.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Módulos do sistema (catálogo). Novos módulos entram aqui nas
-- próximas fases; as permissões de cada usuário apontam para eles.
-- ---------------------------------------------------------------------
create table if not exists public.modulos (
  chave text primary key,
  nome  text not null,
  fase  int  not null default 1,
  ordem int  not null default 0
);

insert into public.modulos (chave, nome, fase, ordem) values
  ('visao_geral',  'Visão geral',          1, 10),
  ('tarefas',      'Atividades e calendário', 1, 20),
  ('clientes',     'Clientes',             1, 30),
  ('projetos',     'Projetos',             1, 40),
  ('equipe',       'Equipe e acessos',     1, 90),
  ('comercial',    'Comercial e orçamentos', 1, 50),
  ('criacao',      'Criação',              1, 60),
  ('execucao',     'Execução',             1, 70),
  ('fornecedores', 'Fornecedores',         1, 55),
  ('materiais',    'Banco de materiais',   1, 75),
  ('equipamentos', 'Equipamentos',         1, 76),
  ('financeiro',   'Financeiro da empresa', 1, 80),
  ('horas',        'Registro de horas',    1, 85)
on conflict (chave) do update set nome = excluded.nome, fase = excluded.fase, ordem = excluded.ordem;

-- ---------------------------------------------------------------------
-- Perfis: um por pessoa que tem login.
-- ---------------------------------------------------------------------
create table if not exists public.perfis (
  id        uuid primary key references auth.users(id) on delete cascade,
  nome      text not null default '',
  email     text not null default '',
  cargo     text not null default '',
  setores   text[] not null default '{}',   -- 'comercial', 'criacao', 'execucao'
  admin     boolean not null default false, -- administrador principal: vê e pode tudo
  ativo     boolean not null default true,  -- desativado = não entra em nada
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Permissões POR USUÁRIO e por módulo.
-- escopo vale para tarefas: 'proprias' (só as dele), 'setor' (as dos
-- setores dele) ou 'todas'.
-- ---------------------------------------------------------------------
create table if not exists public.permissoes (
  usuario_id uuid not null references public.perfis(id) on delete cascade,
  modulo     text not null references public.modulos(chave) on delete cascade,
  ver        boolean not null default false,
  criar      boolean not null default false,
  editar     boolean not null default false,
  apagar     boolean not null default false,
  escopo     text not null default 'proprias' check (escopo in ('proprias', 'setor', 'todas')),
  primary key (usuario_id, modulo)
);

-- ---------------------------------------------------------------------
-- Clientes, projetos, tarefas, comentários, avisos.
-- ---------------------------------------------------------------------
create table if not exists public.clientes (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  contato     text not null default '',
  email       text not null default '',
  telefone    text not null default '',
  instagram   text not null default '',
  observacoes text not null default '',
  cor         text not null default '',   -- cor do cliente nas telas (ex.: #B8955A)
  criado_por  uuid references public.perfis(id) on delete set null default auth.uid(),
  criado_em   timestamptz not null default now()
);
alter table public.clientes add column if not exists cor text not null default '';

create table if not exists public.projetos (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid references public.clientes(id) on delete set null,
  nome        text not null,
  tipo        text not null default '',
  status      text not null default 'ativo' check (status in ('ativo', 'pausado', 'concluido')),
  inicio      date,
  fim         date,
  descricao   text not null default '',
  criado_por  uuid references public.perfis(id) on delete set null default auth.uid(),
  criado_em   timestamptz not null default now()
);

create table if not exists public.tarefas (
  id             uuid primary key default gen_random_uuid(),
  projeto_id     uuid references public.projetos(id) on delete set null,
  titulo         text not null,
  descricao      text not null default '',
  tipo           text not null default 'tarefa' check (tipo in ('tarefa', 'gravacao', 'reuniao', 'entrega', 'post')),
  setor          text not null default 'criacao' check (setor in ('comercial', 'criacao', 'execucao')),
  responsavel_id uuid references public.perfis(id) on delete set null,
  status         text not null default 'a_fazer' check (status in ('a_fazer', 'fazendo', 'em_aprovacao', 'feito')),
  prioridade     text not null default 'normal' check (prioridade in ('normal', 'urgente')),
  prazo          date,
  inicio         timestamptz,
  local          text not null default '',
  ordem          double precision not null default 0,
  criado_por     uuid references public.perfis(id) on delete set null default auth.uid(),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

-- Vários responsáveis por tarefa (desde a versão 0.5.0). "responsavel_id"
-- continua existindo e é sempre o primeiro da lista, para as telas antigas.
alter table public.tarefas add column if not exists responsaveis uuid[] not null default '{}';
do $$ begin
  if exists (select 1 from public.tarefas where responsavel_id is not null and responsaveis = '{}') then
    alter table public.tarefas disable trigger user;  -- copia sem gerar avisos nem mudar datas
    update public.tarefas set responsaveis = array[responsavel_id] where responsavel_id is not null and responsaveis = '{}';
    alter table public.tarefas enable trigger user;
  end if;
end $$;
create index if not exists tarefas_responsaveis_idx on public.tarefas using gin (responsaveis);

create table if not exists public.comentarios (
  id        uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references public.tarefas(id) on delete cascade,
  autor_id  uuid not null references public.perfis(id) on delete cascade default auth.uid(),
  texto     text not null,
  criado_em timestamptz not null default now()
);

create table if not exists public.avisos (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfis(id) on delete cascade,
  texto      text not null,
  tarefa_id  uuid references public.tarefas(id) on delete cascade,
  lido       boolean not null default false,
  criado_em  timestamptz not null default now()
);

create index if not exists tarefas_responsavel_idx on public.tarefas (responsavel_id);
create index if not exists tarefas_projeto_idx on public.tarefas (projeto_id);
create index if not exists comentarios_tarefa_idx on public.comentarios (tarefa_id);
create index if not exists avisos_usuario_idx on public.avisos (usuario_id, lido);

-- ---------------------------------------------------------------------
-- Limites de tamanho e formato. Impedem que alguém encha o banco com
-- textos gigantes (o plano grátis tem 500 MB) ou grave código na cor.
-- ---------------------------------------------------------------------
create or replace function pg_temp.limite(tabela text, nome text, regra text) returns void
language plpgsql as $$
begin
  if not exists (select 1 from pg_constraint where conname = nome) then
    execute format('alter table public.%I add constraint %I check (%s)', tabela, nome, regra);
  end if;
end $$;

select pg_temp.limite('perfis', 'perfis_tamanhos', 'char_length(nome) <= 120 and char_length(cargo) <= 120 and char_length(email) <= 320');
select pg_temp.limite('clientes', 'clientes_tamanhos', 'char_length(btrim(nome)) between 1 and 200 and char_length(contato) <= 200 and char_length(email) <= 320 and char_length(telefone) <= 60 and char_length(instagram) <= 120 and char_length(observacoes) <= 20000');
select pg_temp.limite('clientes', 'clientes_cor', $c$cor = '' or cor ~ '^#[0-9A-Fa-f]{6}$'$c$);
select pg_temp.limite('projetos', 'projetos_tamanhos', 'char_length(btrim(nome)) between 1 and 200 and char_length(tipo) <= 120 and char_length(descricao) <= 20000');
select pg_temp.limite('tarefas', 'tarefas_responsaveis', 'cardinality(responsaveis) <= 10');
select pg_temp.limite('tarefas', 'tarefas_tamanhos', 'char_length(btrim(titulo)) between 1 and 300 and char_length(descricao) <= 20000 and char_length(local) <= 300');
select pg_temp.limite('comentarios', 'comentarios_tamanhos', 'char_length(btrim(texto)) between 1 and 5000');
select pg_temp.limite('avisos', 'avisos_tamanhos', 'char_length(texto) <= 1000');

-- ---------------------------------------------------------------------
-- Anexos dos projetos: imagens, PDFs e propostas (Word, PowerPoint,
-- Excel), até 20 MB cada. O arquivo fica no depósito "anexos" do
-- Supabase Storage (privado); esta tabela guarda o nome, o tipo e de
-- qual projeto ele é. Quem vê o projeto vê os anexos dele.
-- ---------------------------------------------------------------------
create table if not exists public.anexos (
  id          uuid primary key default gen_random_uuid(),
  projeto_id  uuid not null references public.projetos(id) on delete cascade,
  nome        text not null,
  caminho     text not null unique,
  tipo        text not null,
  tamanho     bigint not null,
  enviado_por uuid references public.perfis(id) on delete set null default auth.uid(),
  criado_em   timestamptz not null default now()
);
create index if not exists anexos_projeto_idx on public.anexos (projeto_id);

select pg_temp.limite('anexos', 'anexos_tamanhos', 'char_length(btrim(nome)) between 1 and 255 and tamanho between 1 and 20971520');
select pg_temp.limite('anexos', 'anexos_tipo', $c$tipo in (
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')$c$);
-- O arquivo sempre fica na pasta do próprio projeto, com nome sorteado.
select pg_temp.limite('anexos', 'anexos_caminho', $c$caminho ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.[a-z0-9]{1,5}$' and split_part(caminho, '/', 1) = projeto_id::text$c$);

-- Depósito privado: só abre com link assinado, que vale por pouco tempo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('anexos', 'anexos', false, 20971520, array[
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------
-- Briefing do cliente (desde a versão 0.6.0). Depois da proposta aprovada,
-- a LOOK gera um link exclusivo; o cliente responde sem login e as
-- respostas ficam no projeto. Enquanto o projeto está "aguardando", o
-- sistema mostra um alerta no projeto e nas tarefas dele (sem travar nada).
-- Projetos antigos ficam "dispensado".
-- ---------------------------------------------------------------------
alter table public.projetos add column if not exists briefing text not null default 'dispensado';
select pg_temp.limite('projetos', 'projetos_briefing', $c$briefing in ('dispensado', 'aguardando', 'recebido')$c$);

create table if not exists public.briefings (
  id          uuid primary key default gen_random_uuid(),
  projeto_id  uuid not null references public.projetos(id) on delete cascade,
  modelo      text not null,
  titulo      text not null,
  perguntas   jsonb not null,
  token       text not null unique,
  status      text not null default 'aguardando',
  respostas   jsonb,
  criado_por  uuid references public.perfis(id) on delete set null default auth.uid(),
  criado_em   timestamptz not null default now(),
  recebido_em timestamptz
);
create index if not exists briefings_projeto_idx on public.briefings (projeto_id);
-- Aviso de briefing recebido abre o projeto.
alter table public.avisos add column if not exists projeto_id uuid references public.projetos(id) on delete cascade;
select pg_temp.limite('briefings', 'briefings_tamanhos', $c$char_length(modelo) between 1 and 40 and char_length(btrim(titulo)) between 1 and 200
  and jsonb_typeof(perguntas) = 'object' and pg_column_size(perguntas) <= 200000
  and (respostas is null or (jsonb_typeof(respostas) = 'object' and pg_column_size(respostas) <= 200000))$c$);
select pg_temp.limite('briefings', 'briefings_status', $c$status in ('aguardando', 'recebido')$c$);
select pg_temp.limite('briefings', 'briefings_token', $c$token ~ '^[0-9a-f]{64}$'$c$);

-- ---------------------------------------------------------------------
-- Finanças (desde a versão 0.7.0). Cada lançamento é uma entrada ou uma
-- saída de dinheiro.
--  * "pessoal": as contas de cada pessoa. Só o dono vê, nem o administrador.
--  * "empresa": o caixa da LOOK. Só quem tem a permissão "Financeiro da
--    empresa" vê (o administrador sempre vê).
-- "pago" falso = ainda vai entrar (a receber) ou sair (a pagar).
-- ---------------------------------------------------------------------
create table if not exists public.lancamentos (
  id            uuid primary key default gen_random_uuid(),
  escopo        text not null,
  dono_id       uuid not null references public.perfis(id) on delete cascade default auth.uid(),
  tipo          text not null,
  descricao     text not null,
  categoria     text not null default '',
  valor         numeric(14,2) not null,
  data          date not null default current_date,
  pago          boolean not null default true,
  cliente_id    uuid references public.clientes(id) on delete set null,
  projeto_id    uuid references public.projetos(id) on delete set null,
  observacoes   text not null default '',
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists lancamentos_dono_idx on public.lancamentos (escopo, dono_id, data);

select pg_temp.limite('lancamentos', 'lancamentos_escopo', $c$escopo in ('pessoal', 'empresa')$c$);
select pg_temp.limite('lancamentos', 'lancamentos_tipo', $c$tipo in ('entrada', 'saida')$c$);
select pg_temp.limite('lancamentos', 'lancamentos_valor', 'valor > 0 and valor < 1000000000');
select pg_temp.limite('lancamentos', 'lancamentos_tamanhos', 'char_length(btrim(descricao)) between 1 and 200 and char_length(categoria) <= 60 and char_length(observacoes) <= 2000');
select pg_temp.limite('lancamentos', 'lancamentos_data', $c$data between date '2000-01-01' and date '2100-12-31'$c$);
-- Conta pessoal não se liga a cliente nem a projeto da empresa.
select pg_temp.limite('lancamentos', 'lancamentos_pessoal', $c$escopo = 'empresa' or (cliente_id is null and projeto_id is null)$c$);

-- Nota fiscal do lançamento da empresa: o número e o arquivo (PDF ou foto,
-- até 5 MB). A nota é emitida no Emissor Nacional (nfse.gov.br); aqui fica
-- só o registro. O arquivo vai para o depósito privado "notas", na pasta do
-- próprio lançamento, com nome sorteado.
alter table public.lancamentos add column if not exists nf_numero text not null default '';
alter table public.lancamentos add column if not exists nf_caminho text;
alter table public.lancamentos add column if not exists nf_nome text not null default '';
select pg_temp.limite('lancamentos', 'lancamentos_nf', $c$char_length(nf_numero) <= 60 and char_length(nf_nome) <= 255
  and (nf_caminho is null or (escopo = 'empresa' and nf_caminho ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|png)$'
       and split_part(nf_caminho, '/', 1) = id::text))$c$);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('notas', 'notas', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------
-- Orçamentos (desde a versão 0.8.0). O número (2026-001, 2026-002...) é
-- dado pelo banco, em sequência por ano. "dados" guarda a folha inteira
-- (cliente, itens, desconto, condições); os totais ficam em colunas para
-- a lista. Segue a permissão "comercial".
-- ---------------------------------------------------------------------
create table if not exists public.orcamentos (
  id            uuid primary key default gen_random_uuid(),
  numero        text not null unique,
  cliente_id    uuid references public.clientes(id) on delete set null,
  projeto_id    uuid references public.projetos(id) on delete set null,
  titulo        text not null default '',
  dados         jsonb not null default '{}'::jsonb,
  status        text not null default 'rascunho',
  total_unico   numeric(14,2) not null default 0,
  total_mensal  numeric(14,2) not null default 0,
  lancamento_id uuid references public.lancamentos(id) on delete set null,
  criado_por    uuid references public.perfis(id) on delete set null default auth.uid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists orcamentos_cliente_idx on public.orcamentos (cliente_id);

select pg_temp.limite('orcamentos', 'orcamentos_status', $c$status in ('rascunho', 'enviado', 'aprovado', 'recusado')$c$);
select pg_temp.limite('orcamentos', 'orcamentos_tamanhos', $c$char_length(titulo) <= 200 and jsonb_typeof(dados) = 'object' and pg_column_size(dados) <= 200000$c$);
select pg_temp.limite('orcamentos', 'orcamentos_totais', 'total_unico between 0 and 1000000000 and total_mensal between 0 and 1000000000');
select pg_temp.limite('orcamentos', 'orcamentos_numero', $c$numero ~ '^[0-9]{4}-[0-9]{3,6}$'$c$);

-- ---------------------------------------------------------------------
-- Produtos: a tabela de preços que os orçamentos usam (desde a 0.9.0).
-- Segue a permissão "comercial". "mensal" soma num total mensal separado.
-- ---------------------------------------------------------------------
create table if not exists public.produtos (
  id            uuid primary key default gen_random_uuid(),
  categoria     text not null default 'Outros',
  descricao     text not null,
  detalhe       text not null default '',
  unidade       text not null default 'un.',
  valor         numeric(14,2) not null default 0,
  mensal        boolean not null default false,
  ativo         boolean not null default true,
  ordem         integer not null default 0,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
select pg_temp.limite('produtos', 'produtos_tamanhos', 'char_length(btrim(categoria)) between 1 and 60 and char_length(btrim(descricao)) between 1 and 200 and char_length(detalhe) <= 400 and char_length(unidade) <= 30');
select pg_temp.limite('produtos', 'produtos_valor', 'valor between 0 and 1000000000');

-- Primeira vez: a tabela começa com os itens do gerador de orçamento.
insert into public.produtos (categoria, descricao, detalhe, unidade, valor, mensal, ordem)
select * from (values
  ('Vídeo', 'Vídeo curto (Reels / TikTok)', 'Até 60 s. Roteiro, captação, edição e legenda.', 'vídeo', 450, false, 10),
  ('Vídeo', 'Edição de vídeo', 'Até 60 s, com material enviado pelo cliente.', 'vídeo', 200, false, 20),
  ('Vídeo', 'Produção audiovisual completa', 'Roteiro, captação e edição de uma peça.', 'projeto', 800, false, 30),
  ('Vídeo', 'Vídeo institucional', 'Até 3 min. Roteiro, captação em até 1 diária, edição, trilha e cor.', 'vídeo', 2500, false, 40),
  ('Vídeo', 'Diária de captação', 'Até 8 h de gravação com equipamento LOOK.', 'diária', 1200, false, 50),
  ('Vídeo', 'Meia diária de captação', 'Até 4 h de gravação com equipamento LOOK.', 'meia diária', 700, false, 60),
  ('Vídeo', 'Cobertura de evento', 'Captação no evento + vídeo resumo de até 90 s.', 'evento', 1800, false, 70),
  ('Vídeo', 'Vinheta / animação de logo', 'Motion de até 10 s para abrir e fechar vídeos.', 'vinheta', 600, false, 80),
  ('Vídeo', 'Legenda em vídeo', 'Legenda sincronizada no padrão do cliente.', 'vídeo', 80, false, 90),
  ('Artes', 'Post para feed', 'Arte única no formato do Instagram.', 'arte', 80, false, 100),
  ('Artes', 'Carrossel', 'Até 5 lâminas.', 'carrossel', 180, false, 110),
  ('Artes', 'Arte para stories', 'Formato 1080 x 1920.', 'arte', 50, false, 120),
  ('Artes', 'Capa de Reels', 'Capa no padrão do perfil.', 'capa', 40, false, 130),
  ('Artes', 'Flyer digital', 'Para redes sociais e WhatsApp.', 'arte', 120, false, 140),
  ('Artes', 'Flyer impresso (arte)', 'Arte pronta para gráfica, A5 ou A4.', 'arte', 150, false, 150),
  ('Artes', 'Banner / faixa (arte)', 'Arte pronta para gráfica no tamanho pedido.', 'arte', 200, false, 160),
  ('Artes', 'Cardápio (arte)', 'Valor por página.', 'página', 150, false, 170),
  ('Papelaria e impressos', 'Cartão de visita (arte)', 'Frente e verso, arquivo pronto para gráfica.', 'modelo', 180, false, 180),
  ('Papelaria e impressos', 'Impressão de cartão de visita', 'Repasse da gráfica. Quantidade e papel a combinar.', 'lote', 0, false, 190),
  ('Papelaria e impressos', 'Papel timbrado', 'Arquivo para Word e para impressão.', 'modelo', 120, false, 200),
  ('Papelaria e impressos', 'Assinatura de e-mail', 'Com logo, contatos e ícones, instalada no e-mail.', 'assinatura', 150, false, 210),
  ('Papelaria e impressos', 'Adesivo / etiqueta (arte)', 'Arte pronta para gráfica.', 'arte', 120, false, 220),
  ('Marca', 'Criação de logotipo', 'Até 3 propostas e 2 rodadas de ajuste. Arquivos em vetor e PNG.', 'projeto', 1500, false, 230),
  ('Marca', 'Identidade visual', 'Logo, paleta de cores, tipografia e aplicações principais.', 'projeto', 3000, false, 240),
  ('Marca', 'Manual da marca', 'Regras de uso do logo, cores, fontes e exemplos.', 'projeto', 1200, false, 250),
  ('Marca', 'Vetorização de logo', 'Redesenho em vetor de um logo existente.', 'logo', 150, false, 260),
  ('Sites', 'Landing page', 'Página única com domínio, formulário e botão de WhatsApp.', 'site', 1800, false, 270),
  ('Sites', 'Site institucional', 'Até 5 páginas.', 'site', 3500, false, 280),
  ('Planos mensais', 'Plano Inicial', 'Conteúdo mensal para redes sociais.', 'mês', 1599.99, true, 290),
  ('Planos mensais', 'Plano Essencial', 'Conteúdo mensal ampliado para redes sociais.', 'mês', 2399.99, true, 300)
) as v(categoria, descricao, detalhe, unidade, valor, mensal, ordem)
where not exists (select 1 from public.produtos);

-- ---------------------------------------------------------------------
-- Fornecedores (desde a 0.9.0). Permissão "fornecedores".
-- ---------------------------------------------------------------------
create table if not exists public.fornecedores (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  categoria   text not null default '',
  contato     text not null default '',
  telefone    text not null default '',
  email       text not null default '',
  site        text not null default '',
  cidade      text not null default '',
  observacoes text not null default '',
  criado_por  uuid references public.perfis(id) on delete set null default auth.uid(),
  criado_em   timestamptz not null default now()
);
select pg_temp.limite('fornecedores', 'fornecedores_tamanhos', 'char_length(btrim(nome)) between 1 and 200 and char_length(categoria) <= 60 and char_length(contato) <= 200 and char_length(telefone) <= 60 and char_length(email) <= 320 and char_length(site) <= 300 and char_length(cidade) <= 120 and char_length(observacoes) <= 20000');

-- ---------------------------------------------------------------------
-- Equipamentos (desde a 0.9.0): o que a LOOK tem, se está disponível e
-- com quem ou onde está. Permissão "equipamentos".
-- ---------------------------------------------------------------------
create table if not exists public.equipamentos (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  categoria     text not null default '',
  marca_modelo  text not null default '',
  numero_serie  text not null default '',
  status        text not null default 'disponivel',
  com_id        uuid references public.perfis(id) on delete set null,
  local         text not null default '',
  observacoes   text not null default '',
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
select pg_temp.limite('equipamentos', 'equipamentos_status', $c$status in ('disponivel', 'em_uso', 'manutencao', 'indisponivel')$c$);
select pg_temp.limite('equipamentos', 'equipamentos_tamanhos', 'char_length(btrim(nome)) between 1 and 200 and char_length(categoria) <= 60 and char_length(marca_modelo) <= 200 and char_length(numero_serie) <= 120 and char_length(local) <= 200 and char_length(observacoes) <= 20000');

-- ---------------------------------------------------------------------
-- Criação (desde a 0.10.0): cada peça (post, vídeo, logo...) de um
-- projeto, com as versões enviadas ao cliente. O cliente abre a peça por
-- um link exclusivo (sem login), vê a última versão e aprova ou pede
-- ajuste. Permissão "criacao".
-- ---------------------------------------------------------------------
create table if not exists public.pecas (
  id             uuid primary key default gen_random_uuid(),
  projeto_id     uuid not null references public.projetos(id) on delete cascade,
  titulo         text not null,
  tipo           text not null default 'post',
  descricao      text not null default '',
  status         text not null default 'em_criacao',
  responsavel_id uuid references public.perfis(id) on delete set null,
  prazo          date,
  token          text not null unique,
  criado_por     uuid references public.perfis(id) on delete set null default auth.uid(),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create index if not exists pecas_projeto_idx on public.pecas (projeto_id);
select pg_temp.limite('pecas', 'pecas_tamanhos', 'char_length(btrim(titulo)) between 1 and 200 and char_length(descricao) <= 5000');
select pg_temp.limite('pecas', 'pecas_tipo', $c$tipo in ('post', 'carrossel', 'stories', 'video', 'logo', 'identidade', 'roteiro', 'apresentacao', 'impresso', 'site', 'outro')$c$);
select pg_temp.limite('pecas', 'pecas_status', $c$status in ('em_criacao', 'em_aprovacao', 'ajuste', 'aprovada')$c$);
select pg_temp.limite('pecas', 'pecas_token', $c$token ~ '^[0-9a-f]{64}$'$c$);
select pg_temp.limite('pecas', 'pecas_prazo', $c$prazo is null or prazo between date '2000-01-01' and date '2100-12-31'$c$);

-- Cada versão é um arquivo (imagem, PDF ou vídeo até 50 MB, no depósito
-- "pecas") ou um link (Google Drive, YouTube...). O número (1, 2, 3...)
-- é dado pelo banco. A resposta do cliente só muda pelo link dele.
create table if not exists public.peca_versoes (
  id                 uuid primary key default gen_random_uuid(),
  peca_id            uuid not null references public.pecas(id) on delete cascade,
  numero             integer not null,
  caminho            text unique,
  link               text not null default '',
  nome               text not null default '',
  tipo               text not null default '',
  tamanho            bigint not null default 0,
  observacao         text not null default '',
  resposta           text not null default 'aguardando',
  comentario_cliente text not null default '',
  nome_cliente       text not null default '',
  respondido_em      timestamptz,
  enviado_por        uuid references public.perfis(id) on delete set null default auth.uid(),
  criado_em          timestamptz not null default now(),
  unique (peca_id, numero)
);
select pg_temp.limite('peca_versoes', 'peca_versoes_tamanhos', 'char_length(nome) <= 255 and char_length(observacao) <= 5000 and char_length(comentario_cliente) <= 5000 and char_length(nome_cliente) <= 120');
select pg_temp.limite('peca_versoes', 'peca_versoes_resposta', $c$resposta in ('aguardando', 'aprovada', 'ajuste')$c$);
-- Ou arquivo, ou link (só https), nunca os dois.
select pg_temp.limite('peca_versoes', 'peca_versoes_origem', $c$(caminho is null) <> (link = '')
  and (link = '' or (link ~ '^https://[^\s<>"]+$' and char_length(link) <= 1000))
  and (caminho is null or (caminho ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|gif|pdf|mp4|webm|mov)$'
       and split_part(caminho, '/', 1) = peca_id::text
       and tamanho between 1 and 52428800
       and tipo in ('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'video/mp4', 'video/webm', 'video/quicktime')))$c$);

-- Aviso de resposta do cliente abre a peça.
alter table public.avisos add column if not exists peca_id uuid references public.pecas(id) on delete cascade;

-- Depósito das peças: público para o cliente conseguir ver pelo link sem
-- login, mas cada arquivo tem um nome sorteado (impossível de adivinhar)
-- e ninguém de fora consegue listar o que tem dentro.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pecas', 'pecas', true, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------
-- Execução (desde a 0.11.0): gravações com dia e horário, local, equipe,
-- equipamentos e checklist. Permissão "execucao"; quem está na equipe de
-- uma gravação também a vê e marca o checklist.
-- ---------------------------------------------------------------------
create table if not exists public.gravacoes (
  id            uuid primary key default gen_random_uuid(),
  projeto_id    uuid references public.projetos(id) on delete set null,
  titulo        text not null,
  inicio        timestamptz not null,
  fim           timestamptz,
  local         text not null default '',
  equipe        uuid[] not null default '{}',
  equipamentos  uuid[] not null default '{}',
  checklist     jsonb not null default '[]'::jsonb,
  observacoes   text not null default '',
  status        text not null default 'agendada',
  criado_por    uuid references public.perfis(id) on delete set null default auth.uid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists gravacoes_inicio_idx on public.gravacoes (inicio);
select pg_temp.limite('gravacoes', 'gravacoes_tamanhos', 'char_length(btrim(titulo)) between 1 and 200 and char_length(local) <= 300 and char_length(observacoes) <= 20000 and cardinality(equipe) <= 20 and cardinality(equipamentos) <= 60');
select pg_temp.limite('gravacoes', 'gravacoes_status', $c$status in ('agendada', 'realizada', 'cancelada')$c$);
select pg_temp.limite('gravacoes', 'gravacoes_horario', $c$inicio between timestamptz '2000-01-01' and timestamptz '2100-12-31' and (fim is null or (fim >= inicio and fim <= inicio + interval '7 days'))$c$);
-- Checklist: lista de até 100 itens { "texto": "...", "feito": true/false }.
select pg_temp.limite('gravacoes', 'gravacoes_checklist', $c$jsonb_typeof(checklist) = 'array' and jsonb_array_length(checklist) <= 100 and pg_column_size(checklist) <= 50000$c$);

-- Aviso de gravação nova abre a gravação.
alter table public.avisos add column if not exists gravacao_id uuid references public.gravacoes(id) on delete cascade;

-- ---------------------------------------------------------------------
-- Banco de materiais (desde a 0.12.0): logos, fontes, modelos de contrato
-- e proposta, sons, fotos... da LOOK ou de um cliente. Cada material é um
-- arquivo (depósito privado "materiais", até 50 MB) ou um link https.
-- Permissão "materiais".
-- ---------------------------------------------------------------------
create table if not exists public.materiais (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null,
  categoria   text not null default 'outros',
  cliente_id  uuid references public.clientes(id) on delete set null,
  descricao   text not null default '',
  caminho     text unique,
  link        text not null default '',
  nome        text not null default '',
  tipo        text not null default '',
  tamanho     bigint not null default 0,
  criado_por  uuid references public.perfis(id) on delete set null default auth.uid(),
  criado_em   timestamptz not null default now()
);
select pg_temp.limite('materiais', 'materiais_tamanhos', 'char_length(btrim(titulo)) between 1 and 200 and char_length(descricao) <= 5000 and char_length(nome) <= 255');
select pg_temp.limite('materiais', 'materiais_categoria', $c$categoria in ('logos', 'fontes', 'modelos', 'sons', 'fotos', 'videos', 'identidade', 'outros')$c$);
select pg_temp.limite('materiais', 'materiais_origem', $c$(caminho is null) <> (link = '')
  and (link = '' or (link ~ '^https://[^\s<>"]+$' and char_length(link) <= 1000))
  and (caminho is null or (caminho ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|gif|pdf|zip|ttf|otf|woff|woff2|mp3|wav|mp4|docx|pptx|xlsx)$'
       and split_part(caminho, '/', 1) = id::text and tamanho between 1 and 52428800
       and tipo in ('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'application/zip',
         'font/ttf', 'font/otf', 'font/woff', 'font/woff2', 'audio/mpeg', 'audio/wav', 'video/mp4',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/vnd.openxmlformats-officedocument.presentationml.presentation',
         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')))$c$);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('materiais', 'materiais', false, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'application/zip',
  'font/ttf', 'font/otf', 'font/woff', 'font/woff2', 'audio/mpeg', 'audio/wav', 'video/mp4',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Conversa de cada projeto (desde a 0.12.0): quem enxerga o projeto lê e
-- escreve. Marcar @Nome avisa a pessoa (se ela vê os projetos).
create table if not exists public.mensagens (
  id          uuid primary key default gen_random_uuid(),
  projeto_id  uuid not null references public.projetos(id) on delete cascade,
  autor_id    uuid references public.perfis(id) on delete set null default auth.uid(),
  texto       text not null,
  criado_em   timestamptz not null default now()
);
create index if not exists mensagens_projeto_idx on public.mensagens (projeto_id, criado_em);
select pg_temp.limite('mensagens', 'mensagens_tamanhos', 'char_length(btrim(texto)) between 1 and 5000');

-- Registro de horas (desde a 0.12.0): cada pessoa lança o tempo que gastou,
-- ligado (ou não) a um projeto e a uma tarefa. Cada um vê e muda as próprias
-- horas; ver, corrigir ou apagar as dos outros segue a permissão "horas".
create table if not exists public.horas (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references public.perfis(id) on delete cascade default auth.uid(),
  projeto_id    uuid references public.projetos(id) on delete set null,
  tarefa_id     uuid references public.tarefas(id) on delete set null,
  data          date not null default current_date,
  minutos       integer not null,
  descricao     text not null default '',
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists horas_usuario_idx on public.horas (usuario_id, data);
create index if not exists horas_projeto_idx on public.horas (projeto_id);
select pg_temp.limite('horas', 'horas_minutos', 'minutos between 1 and 1440');
select pg_temp.limite('horas', 'horas_tamanhos', 'char_length(descricao) <= 1000');
select pg_temp.limite('horas', 'horas_data', $c$data between date '2000-01-01' and date '2100-12-31'$c$);

-- ---------------------------------------------------------------------
-- Funções de permissão (usadas pelas políticas abaixo).
-- "security definer" deixa a função ler perfis/permissões sem cair
-- nas próprias regras de segurança (evita um laço infinito).
-- ---------------------------------------------------------------------
create or replace function public.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select admin and ativo from perfis where id = auth.uid()), false);
$$;

create or replace function public.esta_ativo() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select ativo from perfis where id = auth.uid()), false);
$$;

create or replace function public.pode(p_modulo text, p_acao text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.eh_admin() or (public.esta_ativo() and coalesce((
    select case p_acao
      when 'ver'    then ver
      when 'criar'  then criar
      when 'editar' then editar
      when 'apagar' then apagar
      else false end
    from permissoes where usuario_id = auth.uid() and modulo = p_modulo
  ), false));
$$;

-- Tem alguma permissão liberada (ou é admin). Conta nova ainda não tem.
create or replace function public.tem_acesso() returns boolean
language sql stable security definer set search_path = public as $$
  select public.eh_admin() or (public.esta_ativo()
    and exists (select 1 from permissoes where usuario_id = auth.uid() and ver));
$$;

create or replace function public.escopo_tarefas() returns text
language sql stable security definer set search_path = public as $$
  select case when public.eh_admin() then 'todas'
    else coalesce((select escopo from permissoes where usuario_id = auth.uid() and modulo = 'tarefas'), 'proprias') end;
$$;

create or replace function public.pode_ver_tarefa(p_setor text, p_responsavel uuid, p_criado_por uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.pode('tarefas', 'ver') and (
    public.escopo_tarefas() = 'todas'
    or p_responsavel = auth.uid()
    or p_criado_por = auth.uid()
    or (public.escopo_tarefas() = 'setor'
        and p_setor = any(coalesce((select setores from perfis where id = auth.uid()), '{}')))
  );
$$;

-- Mesma regra, com a lista de responsáveis (usada pelas políticas).
create or replace function public.pode_ver_tarefa(p_setor text, p_responsaveis uuid[], p_criado_por uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.pode('tarefas', 'ver') and (
    public.escopo_tarefas() = 'todas'
    or auth.uid() = any(coalesce(p_responsaveis, '{}'))
    or p_criado_por = auth.uid()
    or (public.escopo_tarefas() = 'setor'
        and p_setor = any(coalesce((select setores from perfis where id = auth.uid()), '{}')))
  );
$$;

-- Projeto visível porque o usuário enxerga alguma tarefa dele.
create or replace function public.ve_tarefa_do_projeto(p_projeto uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from tarefas t where t.projeto_id = p_projeto
                 and public.pode_ver_tarefa(t.setor, t.responsaveis, t.criado_por));
$$;

create or replace function public.ve_tarefa_do_cliente(p_cliente uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from projetos p where p.cliente_id = p_cliente and public.ve_tarefa_do_projeto(p.id));
$$;

-- Uma pessoa QUALQUER (não quem está logado) enxerga a tarefa? Mesmas regras
-- de pode_ver_tarefa, usadas para não mandar aviso com título de tarefa a
-- quem não pode vê-la.
create or replace function public.usuario_ve_tarefa(p_usuario uuid, p_tarefa uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from perfis u join tarefas t on t.id = p_tarefa
    where u.id = p_usuario and u.ativo
      and (u.admin or exists (
        select 1 from permissoes pm
        where pm.usuario_id = u.id and pm.modulo = 'tarefas' and pm.ver
          and (pm.escopo = 'todas' or u.id = any(t.responsaveis) or t.criado_por = u.id
               or (pm.escopo = 'setor' and t.setor = any(u.setores))))));
$$;

-- ---------------------------------------------------------------------
-- Senha de acesso para criar conta. Só quem sabe a senha da LOOK
-- consegue se cadastrar. Fica guardada embaralhada (hash), numa tabela
-- que ninguém lê pela internet. O administrador troca pela tela Equipe.
-- ---------------------------------------------------------------------
create table if not exists public.ajustes (
  chave text primary key,
  valor text not null
);
alter table public.ajustes enable row level security;
insert into public.ajustes (chave, valor)
values ('senha_acesso_hash', 'f7122818931147dd08cdb78351bc18de68de40b94b8390d047051b614614c81e')
on conflict (chave) do nothing;

create or replace function public.hash_senha_acesso(p_senha text) returns text
language sql immutable as $$
  select encode(sha256(convert_to(coalesce(p_senha, ''), 'UTF8')), 'hex');
$$;

create or replace function public.mudar_senha_acesso(p_nova text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_admin() then
    raise exception 'Só o administrador muda a senha de acesso.';
  end if;
  if char_length(coalesce(p_nova, '')) not between 4 and 100 then
    raise exception 'A senha de acesso precisa ter de 4 a 100 caracteres.';
  end if;
  insert into ajustes (chave, valor) values ('senha_acesso_hash', public.hash_senha_acesso(p_nova))
  on conflict (chave) do update set valor = excluded.valor;
end $$;

-- ---------------------------------------------------------------------
-- Gatilhos (acontecem sozinhos).
-- ---------------------------------------------------------------------

-- Antes de criar qualquer conta: confere a senha de acesso da LOOK. Vale
-- também para quem tenta se cadastrar direto pela API, sem passar pela tela.
-- A primeira conta (o administrador) não precisa. A senha digitada não fica
-- guardada nos dados da conta.
create or replace function public.exigir_senha_acesso() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from perfis)
     and public.hash_senha_acesso(new.raw_user_meta_data->>'codigo')
         is distinct from (select valor from ajustes where chave = 'senha_acesso_hash') then
    raise exception 'Senha de acesso da LOOK incorreta.';
  end if;
  new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb) - 'codigo';
  return new;
end $$;

drop trigger if exists exigir_senha_acesso on auth.users;
create trigger exigir_senha_acesso before insert on auth.users
  for each row execute function public.exigir_senha_acesso();

-- Toda conta nova ganha um perfil SEM permissões. A primeira conta
-- criada vira administrador principal automaticamente.
create or replace function public.ao_criar_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into perfis (id, nome, email, admin)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
          new.email,
          not exists (select 1 from perfis))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.ao_criar_usuario();

-- Só o administrador muda nome, cargo, setores, admin e ativo. O nome também,
-- para ninguém se passar por outra pessoa nem receber as marcações dela.
create or replace function public.proteger_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_admin() then
    new.nome := old.nome; new.cargo := old.cargo; new.setores := old.setores;
    new.admin := old.admin; new.ativo := old.ativo; new.email := old.email;
  end if;
  return new;
end $$;

drop trigger if exists proteger_perfil on public.perfis;
create trigger proteger_perfil before update on public.perfis
  for each row execute function public.proteger_perfil();

-- O sistema nunca fica sem administrador: o último admin ativo não pode
-- perder o acesso de admin, ser desativado nem removido.
create or replace function public.manter_um_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.admin and old.ativo
     and (tg_op = 'DELETE' or not new.admin or not new.ativo)
     and not exists (select 1 from perfis where admin and ativo and id <> old.id) then
    raise exception 'O sistema precisa de pelo menos um administrador ativo.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

drop trigger if exists manter_um_admin on public.perfis;
create trigger manter_um_admin before update or delete on public.perfis
  for each row execute function public.manter_um_admin();

create or replace function public.marcar_atualizacao() returns trigger
language plpgsql as $$
begin new.atualizado_em := now(); return new; end $$;

-- Autor da tarefa é sempre quem criou. Quem não tem "editar" (por exemplo,
-- o responsável freelancer) só muda o status e a posição no quadro.
create or replace function public.proteger_tarefa() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then new.criado_por := auth.uid(); end if;
    return new;
  end if;
  new.criado_por := old.criado_por;
  new.criado_em := old.criado_em;
  if auth.uid() is not null and not public.pode('tarefas', 'editar') then
    new := jsonb_populate_record(old, jsonb_build_object('status', new.status, 'ordem', new.ordem));
  end if;
  return new;
end $$;

drop trigger if exists proteger_tarefa on public.tarefas;
create trigger proteger_tarefa before insert or update on public.tarefas
  for each row execute function public.proteger_tarefa();

-- Lista de responsáveis: sem repetidos nem vazios, até 10 pessoas, todas
-- com perfil. Quem manda só "responsavel_id" (tela antiga) troca a lista
-- inteira por essa pessoa. "responsavel_id" vira sempre o primeiro da lista.
create or replace function public.arrumar_responsaveis() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if cardinality(new.responsaveis) = 0 and new.responsavel_id is not null then
      new.responsaveis := array[new.responsavel_id];
    end if;
  elsif new.responsaveis is not distinct from old.responsaveis
        and new.responsavel_id is distinct from old.responsavel_id then
    new.responsaveis := case when new.responsavel_id is null then '{}'::uuid[] else array[new.responsavel_id] end;
  end if;
  new.responsaveis := coalesce((select array_agg(r order by primeira)
    from (select r, min(ordem) as primeira from unnest(new.responsaveis) with ordinality as x(r, ordem)
          where r is not null group by r) d), '{}');
  if cardinality(new.responsaveis) > 10 then
    raise exception 'Uma tarefa pode ter no máximo 10 responsáveis.';
  end if;
  if exists (select 1 from unnest(new.responsaveis) r where not exists (select 1 from perfis p where p.id = r)) then
    raise exception 'Responsável não encontrado na equipe.';
  end if;
  new.responsavel_id := new.responsaveis[1];
  return new;
end $$;

drop trigger if exists arrumar_responsaveis on public.tarefas;
create trigger arrumar_responsaveis before insert or update on public.tarefas
  for each row execute function public.arrumar_responsaveis();

-- Pessoa removida da equipe sai da lista de responsáveis das tarefas.
create or replace function public.tirar_responsavel_removido() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update tarefas set responsaveis = array_remove(responsaveis, old.id) where old.id = any(responsaveis);
  return old;
end $$;

drop trigger if exists tirar_responsavel_removido on public.perfis;
create trigger tirar_responsavel_removido before delete on public.perfis
  for each row execute function public.tirar_responsavel_removido();

-- Clientes e projetos também ficam no nome de quem criou.
create or replace function public.fixar_autor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then new.criado_por := auth.uid(); end if;
  else
    new.criado_por := old.criado_por; new.criado_em := old.criado_em;
  end if;
  return new;
end $$;

drop trigger if exists fixar_autor on public.clientes;
create trigger fixar_autor before insert or update on public.clientes
  for each row execute function public.fixar_autor();
drop trigger if exists fixar_autor on public.projetos;
create trigger fixar_autor before insert or update on public.projetos
  for each row execute function public.fixar_autor();

-- Anexo fica no nome de quem enviou, e não muda depois de enviado.
create or replace function public.fixar_anexo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then new.enviado_por := auth.uid(); end if;
    new.criado_em := now();
    return new;
  end if;
  raise exception 'Anexo não pode ser alterado; apague e envie de novo.';
end $$;

drop trigger if exists fixar_anexo on public.anexos;
create trigger fixar_anexo before insert or update on public.anexos
  for each row execute function public.fixar_anexo();

drop trigger if exists marcar_atualizacao on public.tarefas;
create trigger marcar_atualizacao before update on public.tarefas
  for each row execute function public.marcar_atualizacao();

-- Aviso para cada pessoa que entra na lista de responsáveis.
create or replace function public.avisar_responsavel() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into avisos (usuario_id, texto, tarefa_id)
  select r, left('Nova tarefa para você: ' || new.titulo, 1000), new.id
  from unnest(new.responsaveis) r
  where r is distinct from auth.uid()
    and (tg_op = 'INSERT' or not (r = any(old.responsaveis)));
  return new;
end $$;

drop trigger if exists avisar_responsavel on public.tarefas;
create trigger avisar_responsavel after insert or update of responsaveis, responsavel_id on public.tarefas
  for each row execute function public.avisar_responsavel();

-- Aviso de comentário: para o responsável da tarefa e para quem foi
-- marcado com @PrimeiroNome, desde que a pessoa possa ver a tarefa.
create or replace function public.avisar_comentario() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_tarefa tarefas%rowtype;
  v_autor  text;
begin
  select * into v_tarefa from tarefas where id = new.tarefa_id;
  select nome into v_autor from perfis where id = new.autor_id;

  insert into avisos (usuario_id, texto, tarefa_id)
  select p.id,
         left(case when m.marcado
              then v_autor || ' marcou você em: ' || v_tarefa.titulo
              else v_autor || ' comentou em: ' || v_tarefa.titulo end, 1000),
         new.tarefa_id
  from perfis p
  cross join lateral (select split_part(p.nome, ' ', 1) <> ''
    and strpos(lower(new.texto), lower('@' || split_part(p.nome, ' ', 1))) > 0 as marcado) m
  where p.ativo and p.id <> new.autor_id
    and (p.id = any(v_tarefa.responsaveis) or m.marcado)
    and public.usuario_ve_tarefa(p.id, new.tarefa_id);
  return new;
end $$;

drop trigger if exists avisar_comentario on public.comentarios;
create trigger avisar_comentario after insert on public.comentarios
  for each row execute function public.avisar_comentario();

-- ---------------------------------------------------------------------
-- Políticas de segurança (RLS).
-- ---------------------------------------------------------------------
-- Briefing novo: o banco sorteia o link (64 letras e números, impossível de
-- adivinhar), nasce "aguardando" e só o próprio cliente, pelo link, preenche.
create or replace function public.preparar_briefing() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    -- Só a porta do cliente (briefing_enviar) muda o briefing, e só as respostas.
    if current_setting('look.enviando_briefing', true) is distinct from 'sim' then
      raise exception 'Briefing não pode ser alterado depois de criado.';
    end if;
    new.id := old.id; new.projeto_id := old.projeto_id; new.modelo := old.modelo; new.titulo := old.titulo;
    new.perguntas := old.perguntas; new.token := old.token; new.criado_por := old.criado_por; new.criado_em := old.criado_em;
    return new;
  end if;
  new.token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  new.status := 'aguardando';
  new.respostas := null;
  new.recebido_em := null;
  new.criado_em := now();
  if auth.uid() is not null then new.criado_por := auth.uid(); end if;
  return new;
end $$;

drop trigger if exists preparar_briefing on public.briefings;
create trigger preparar_briefing before insert or update on public.briefings
  for each row execute function public.preparar_briefing();

-- Portas do cliente (sem login). Só funcionam com o link certo e só
-- mostram aquele briefing: título, perguntas e nome do cliente.
create or replace function public.briefing_abrir(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'titulo', b.titulo,
    'status', b.status,
    'cliente', coalesce(c.nome, ''),
    'perguntas', case when b.status = 'aguardando' then b.perguntas end)
  from briefings b
  join projetos p on p.id = b.projeto_id
  left join clientes c on c.id = p.cliente_id
  where coalesce(p_token, '') ~ '^[0-9a-f]{64}$' and b.token = p_token;
$$;

create or replace function public.briefing_enviar(p_token text, p_respostas jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v briefings%rowtype;
  v_projeto projetos%rowtype;
  v_cliente text;
  r record;
begin
  if coalesce(p_token, '') !~ '^[0-9a-f]{64}$' then raise exception 'Link de briefing inválido.'; end if;
  select * into v from briefings where token = p_token for update;
  if not found then raise exception 'Link de briefing inválido.'; end if;
  if v.status <> 'aguardando' then raise exception 'Este briefing já foi enviado. Obrigado!'; end if;
  if p_respostas is null or jsonb_typeof(p_respostas) <> 'object' or pg_column_size(p_respostas) > 200000 then
    raise exception 'Respostas inválidas.';
  end if;
  -- Cada resposta: chave curta; texto até 10 mil letras, ou lista de até 30 opções.
  for r in select key, value from jsonb_each(p_respostas) loop
    if r.key !~ '^[a-z0-9_]{1,40}$'
       or not (
         (jsonb_typeof(r.value) = 'string' and char_length(r.value #>> '{}') <= 10000)
         or (jsonb_typeof(r.value) = 'array' and jsonb_array_length(r.value) <= 30
             and not exists (select 1 from jsonb_array_elements(r.value) e
                             where jsonb_typeof(e) <> 'string' or char_length(e #>> '{}') > 1000))) then
      raise exception 'Respostas inválidas.';
    end if;
  end loop;
  if (select count(*) from jsonb_object_keys(p_respostas)) > 400 then raise exception 'Respostas inválidas.'; end if;

  perform set_config('look.enviando_briefing', 'sim', true);
  update briefings set respostas = p_respostas, status = 'recebido', recebido_em = now() where id = v.id;
  perform set_config('look.enviando_briefing', '', true);
  update projetos set briefing = 'recebido' where id = v.projeto_id and briefing <> 'recebido';
  select * into v_projeto from projetos where id = v.projeto_id;
  select nome into v_cliente from clientes where id = v_projeto.cliente_id;

  -- Avisa quem gerou o link e os administradores.
  insert into avisos (usuario_id, texto, projeto_id)
  select distinct pf.id, left('Briefing recebido: ' || coalesce(v_cliente || ' · ', '') || v_projeto.nome, 1000), v_projeto.id
  from perfis pf
  where pf.ativo and (pf.admin or pf.id = v.criado_por);
end $$;

-- Lançamento: o dono é sempre quem cria; depois, ninguém troca o dono nem
-- passa um lançamento de pessoal para empresa (ou o contrário).
create or replace function public.preparar_lancamento() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then new.dono_id := auth.uid(); end if;
    new.criado_em := now();
  else
    new.dono_id := old.dono_id;
    new.escopo := old.escopo;
    new.criado_em := old.criado_em;
  end if;
  new.atualizado_em := now();
  return new;
end $$;

drop trigger if exists preparar_lancamento on public.lancamentos;
create trigger preparar_lancamento before insert or update on public.lancamentos
  for each row execute function public.preparar_lancamento();

-- Orçamento: número em sequência por ano (horário de Brasília), autor e
-- data de criação nunca mudam.
create or replace function public.preparar_orcamento() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_ano text := to_char(now() at time zone 'America/Sao_Paulo', 'YYYY');
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtext('look_orcamentos_numero'));
    new.numero := v_ano || '-' || lpad((coalesce((select max(split_part(numero, '-', 2)::int) from orcamentos
      where split_part(numero, '-', 1) = v_ano), 0) + 1)::text, 3, '0');
    if auth.uid() is not null then new.criado_por := auth.uid(); end if;
    new.criado_em := now();
  else
    new.numero := old.numero;
    new.criado_por := old.criado_por;
    new.criado_em := old.criado_em;
  end if;
  new.atualizado_em := now();
  return new;
end $$;

drop trigger if exists preparar_orcamento on public.orcamentos;
create trigger preparar_orcamento before insert or update on public.orcamentos
  for each row execute function public.preparar_orcamento();

-- Produtos e equipamentos guardam a data da última mudança.
drop trigger if exists marcar_produto on public.produtos;
create trigger marcar_produto before update on public.produtos
  for each row execute function public.marcar_atualizacao();
drop trigger if exists marcar_equipamento on public.equipamentos;
create trigger marcar_equipamento before update on public.equipamentos
  for each row execute function public.marcar_atualizacao();

-- Fornecedor: autor é quem cadastrou e nunca muda.
create or replace function public.preparar_fornecedor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then new.criado_por := auth.uid(); end if;
    new.criado_em := now();
  else
    new.criado_por := old.criado_por;
    new.criado_em := old.criado_em;
  end if;
  return new;
end $$;
drop trigger if exists preparar_fornecedor on public.fornecedores;
create trigger preparar_fornecedor before insert or update on public.fornecedores
  for each row execute function public.preparar_fornecedor();

-- Peça nova: o banco sorteia o link do cliente. Link, autor e data de
-- criação nunca mudam.
create or replace function public.preparar_peca() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    if auth.uid() is not null then new.criado_por := auth.uid(); end if;
    new.criado_em := now();
  else
    new.token := old.token;
    new.criado_por := old.criado_por;
    new.criado_em := old.criado_em;
  end if;
  new.atualizado_em := now();
  return new;
end $$;
drop trigger if exists preparar_peca on public.pecas;
create trigger preparar_peca before insert or update on public.pecas
  for each row execute function public.preparar_peca();

-- Versão nova: número em sequência dentro da peça, nasce aguardando o
-- cliente e a peça passa para "em aprovação". Depois, a equipe só muda a
-- observação; a resposta só muda pela porta do cliente (peca_responder).
create or replace function public.preparar_versao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtext('look_peca_' || new.peca_id::text));
    new.numero := coalesce((select max(numero) from peca_versoes where peca_id = new.peca_id), 0) + 1;
    new.resposta := 'aguardando';
    new.comentario_cliente := '';
    new.nome_cliente := '';
    new.respondido_em := null;
    if auth.uid() is not null then new.enviado_por := auth.uid(); end if;
    new.criado_em := now();
    update pecas set status = 'em_aprovacao' where id = new.peca_id;
    return new;
  end if;
  if current_setting('look.respondendo_peca', true) is distinct from 'sim' then
    new.resposta := old.resposta; new.comentario_cliente := old.comentario_cliente;
    new.nome_cliente := old.nome_cliente; new.respondido_em := old.respondido_em;
  end if;
  new.id := old.id; new.peca_id := old.peca_id; new.numero := old.numero; new.caminho := old.caminho;
  new.link := old.link; new.nome := old.nome; new.tipo := old.tipo; new.tamanho := old.tamanho;
  new.enviado_por := old.enviado_por; new.criado_em := old.criado_em;
  return new;
end $$;
drop trigger if exists preparar_versao on public.peca_versoes;
create trigger preparar_versao before insert or update on public.peca_versoes
  for each row execute function public.preparar_versao();

-- Gravação: autor nunca muda; equipe sem repetidos e só gente da equipe;
-- equipamentos só os cadastrados (pessoa ou equipamento apagado sai da
-- lista sozinho); checklist só com itens { texto, feito }.
-- Quem está na equipe mas não tem "editar" só marca o checklist e a situação.
create or replace function public.preparar_gravacao() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_item jsonb;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then new.criado_por := auth.uid(); end if;
    new.criado_em := now();
  else
    new.criado_por := old.criado_por;
    new.criado_em := old.criado_em;
    if auth.uid() is not null and not public.pode('execucao', 'editar') then
      -- Só os itens marcados mudam: o texto e a quantidade continuam os mesmos.
      if jsonb_typeof(new.checklist) <> 'array' or jsonb_array_length(new.checklist) <> jsonb_array_length(old.checklist)
         or exists (select 1 from jsonb_array_elements(new.checklist) with ordinality n(i, k)
                    join jsonb_array_elements(old.checklist) with ordinality o(i, k) using (k)
                    where n.i ->> 'texto' is distinct from o.i ->> 'texto') then
        raise exception 'Sem permissão de editar, só dá para marcar os itens do checklist.';
      end if;
      new := jsonb_populate_record(old, jsonb_build_object('checklist', new.checklist, 'status', new.status));
    end if;
  end if;
  new.atualizado_em := now();
  new.equipe := coalesce((select array_agg(r order by primeira)
    from (select r, min(ordem) as primeira from unnest(new.equipe) with ordinality as x(r, ordem)
          where r in (select id from perfis) group by r) d), '{}');
  new.equipamentos := coalesce((select array_agg(distinct r) from unnest(new.equipamentos) r
    where r in (select id from equipamentos)), '{}');
  if jsonb_typeof(new.checklist) = 'array' then
    for v_item in select value from jsonb_array_elements(new.checklist) loop
      if jsonb_typeof(v_item) <> 'object' or jsonb_typeof(v_item -> 'texto') <> 'string'
         or char_length(btrim(v_item ->> 'texto')) not between 1 and 300
         or jsonb_typeof(v_item -> 'feito') <> 'boolean'
         or (select count(*) from jsonb_object_keys(v_item)) <> 2 then
        raise exception 'Item de checklist inválido.';
      end if;
    end loop;
  end if;
  return new;
end $$;
-- Todo cliente novo já nasce com um projeto "Geral" (desde a 0.11.0), para
-- dar para criar tarefa na hora, mesmo em trabalho avulso. Clientes que já
-- existiam sem nenhum projeto ganham o "Geral" uma vez.
create or replace function public.criar_projeto_geral() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into projetos (cliente_id, nome, tipo, status, briefing, criado_por, descricao)
  values (new.id, 'Geral', 'Geral', 'ativo', 'dispensado', new.criado_por,
          'Projeto criado junto com o cliente, para tarefas avulsas e trabalhos menores.');
  return new;
end $$;
drop trigger if exists criar_projeto_geral on public.clientes;
create trigger criar_projeto_geral after insert on public.clientes
  for each row execute function public.criar_projeto_geral();
insert into public.projetos (cliente_id, nome, tipo, status, briefing, criado_por, descricao)
select c.id, 'Geral', 'Geral', 'ativo', 'dispensado', c.criado_por,
       'Projeto criado junto com o cliente, para tarefas avulsas e trabalhos menores.'
from public.clientes c
where not exists (select 1 from public.projetos p where p.cliente_id = c.id);

-- Material: autor e data nunca mudam; arquivo e link também não (para
-- trocar o arquivo, apaga e envia de novo).
create or replace function public.preparar_material() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then new.criado_por := auth.uid(); end if;
    new.criado_em := now();
  else
    new.criado_por := old.criado_por; new.criado_em := old.criado_em;
    new.caminho := old.caminho; new.link := old.link; new.nome := old.nome; new.tipo := old.tipo; new.tamanho := old.tamanho;
  end if;
  return new;
end $$;
drop trigger if exists preparar_material on public.materiais;
create trigger preparar_material before insert or update on public.materiais
  for each row execute function public.preparar_material();

-- Mensagem: autor é sempre quem escreveu, na hora em que escreveu. Quem é
-- marcado com @Nome (e vê os projetos) recebe aviso.
create or replace function public.preparar_mensagem() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then new.autor_id := auth.uid(); end if;
  new.criado_em := now();
  return new;
end $$;
drop trigger if exists preparar_mensagem on public.mensagens;
create trigger preparar_mensagem before insert on public.mensagens
  for each row execute function public.preparar_mensagem();

create or replace function public.avisar_mensagem() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_autor text; v_projeto text;
begin
  select nome into v_autor from perfis where id = new.autor_id;
  select nome into v_projeto from projetos where id = new.projeto_id;
  insert into avisos (usuario_id, texto, projeto_id)
  select p.id, left(coalesce(v_autor, 'Alguém') || ' marcou você na conversa do projeto: ' || v_projeto, 1000), new.projeto_id
  from perfis p
  where p.ativo and p.id is distinct from new.autor_id
    and split_part(p.nome, ' ', 1) <> ''
    and strpos(lower(new.texto), lower('@' || split_part(p.nome, ' ', 1))) > 0
    and (p.admin or exists (select 1 from permissoes pm where pm.usuario_id = p.id and pm.modulo = 'projetos' and pm.ver));
  return new;
end $$;
drop trigger if exists avisar_mensagem on public.mensagens;
create trigger avisar_mensagem after insert on public.mensagens
  for each row execute function public.avisar_mensagem();

-- Horas: quem lança é sempre o dono (só o administrador lança para outra
-- pessoa); o dono nunca muda depois. Tarefa escolhida define o projeto.
create or replace function public.preparar_hora() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_projeto uuid;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null and not public.eh_admin() then new.usuario_id := auth.uid(); end if;
    new.criado_em := now();
  else
    new.usuario_id := old.usuario_id; new.criado_em := old.criado_em;
  end if;
  new.atualizado_em := now();
  new.descricao := btrim(coalesce(new.descricao, ''));
  if new.tarefa_id is not null then
    select projeto_id into v_projeto from tarefas where id = new.tarefa_id;
    if v_projeto is not null then new.projeto_id := v_projeto; end if;
  end if;
  return new;
end $$;
drop trigger if exists preparar_hora on public.horas;
create trigger preparar_hora before insert or update on public.horas
  for each row execute function public.preparar_hora();

drop trigger if exists preparar_gravacao on public.gravacoes;
create trigger preparar_gravacao before insert or update on public.gravacoes
  for each row execute function public.preparar_gravacao();

-- Quem entra na equipe de uma gravação recebe um aviso (menos quem marcou).
create or replace function public.avisar_gravacao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into avisos (usuario_id, texto, gravacao_id)
  select r, left('Gravação com você: ' || new.titulo || ' · '
    || to_char(new.inicio at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI'), 1000), new.id
  from unnest(new.equipe) r
  join perfis p on p.id = r and p.ativo
  where r is distinct from auth.uid()
    and (tg_op = 'INSERT' or not (r = any(old.equipe)));
  return new;
end $$;
drop trigger if exists avisar_gravacao on public.gravacoes;
create trigger avisar_gravacao after insert or update on public.gravacoes
  for each row execute function public.avisar_gravacao();

-- Portas do cliente para a peça (sem login). Só funcionam com o link
-- certo e só mostram aquela peça e as versões dela.
create or replace function public.peca_abrir(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'titulo', pc.titulo,
    'tipo', pc.tipo,
    'descricao', pc.descricao,
    'status', pc.status,
    'cliente', coalesce(c.nome, ''),
    'projeto', p.nome,
    'versoes', coalesce((select jsonb_agg(jsonb_build_object(
        'numero', v.numero, 'caminho', v.caminho, 'link', v.link, 'nome', v.nome, 'tipo', v.tipo,
        'observacao', v.observacao, 'resposta', v.resposta, 'comentario_cliente', v.comentario_cliente,
        'nome_cliente', v.nome_cliente, 'respondido_em', v.respondido_em, 'criado_em', v.criado_em) order by v.numero desc)
      from peca_versoes v where v.peca_id = pc.id), '[]'::jsonb))
  from pecas pc
  join projetos p on p.id = pc.projeto_id
  left join clientes c on c.id = p.cliente_id
  where coalesce(p_token, '') ~ '^[0-9a-f]{64}$' and pc.token = p_token;
$$;

create or replace function public.peca_responder(p_token text, p_resposta text, p_comentario text, p_nome text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_peca pecas%rowtype;
  v_versao peca_versoes%rowtype;
  v_cliente text;
begin
  if coalesce(p_token, '') !~ '^[0-9a-f]{64}$' then raise exception 'Link de aprovação inválido.'; end if;
  select * into v_peca from pecas where token = p_token for update;
  if not found then raise exception 'Link de aprovação inválido.'; end if;
  if p_resposta is null or p_resposta not in ('aprovada', 'ajuste') then raise exception 'Resposta inválida.'; end if;
  if char_length(btrim(coalesce(p_nome, ''))) not between 1 and 120 then raise exception 'Escreva seu nome (até 120 letras).'; end if;
  if char_length(coalesce(p_comentario, '')) > 5000 then raise exception 'Comentário grande demais (até 5 mil letras).'; end if;
  if p_resposta = 'ajuste' and btrim(coalesce(p_comentario, '')) = '' then raise exception 'Conte o que precisa ajustar.'; end if;
  select * into v_versao from peca_versoes where peca_id = v_peca.id order by numero desc limit 1;
  if not found then raise exception 'Esta peça ainda não tem versão para aprovar.'; end if;
  if v_versao.resposta <> 'aguardando' then raise exception 'Esta versão já foi respondida. Obrigado!'; end if;

  perform set_config('look.respondendo_peca', 'sim', true);
  update peca_versoes set resposta = p_resposta, comentario_cliente = coalesce(p_comentario, ''),
    nome_cliente = btrim(p_nome), respondido_em = now() where id = v_versao.id;
  perform set_config('look.respondendo_peca', '', true);
  update pecas set status = p_resposta where id = v_peca.id;
  select c.nome into v_cliente from projetos p join clientes c on c.id = p.cliente_id where p.id = v_peca.projeto_id;

  -- Avisa quem cuida da peça (responsável, quem criou, quem enviou a
  -- versão) e os administradores, desde que vejam a Criação.
  insert into avisos (usuario_id, texto, projeto_id, peca_id)
  select distinct pf.id,
    left(case when p_resposta = 'aprovada' then 'Cliente aprovou: ' else 'Cliente pediu ajuste em: ' end
         || coalesce(v_cliente || ' · ', '') || v_peca.titulo || ' (versão ' || v_versao.numero || ')', 1000),
    v_peca.projeto_id, v_peca.id
  from perfis pf
  where pf.ativo
    and (pf.admin or pf.id in (v_peca.responsavel_id, v_peca.criado_por, v_versao.enviado_por))
    and (pf.admin or exists (select 1 from permissoes pm where pm.usuario_id = pf.id and pm.modulo = 'criacao' and pm.ver));
end $$;

alter table public.modulos     enable row level security;
alter table public.perfis      enable row level security;
alter table public.permissoes  enable row level security;
alter table public.clientes    enable row level security;
alter table public.projetos    enable row level security;
alter table public.tarefas     enable row level security;
alter table public.comentarios enable row level security;
alter table public.avisos      enable row level security;
alter table public.anexos      enable row level security;
alter table public.briefings   enable row level security;
alter table public.lancamentos enable row level security;
alter table public.orcamentos  enable row level security;
alter table public.produtos    enable row level security;
alter table public.fornecedores enable row level security;
alter table public.equipamentos enable row level security;
alter table public.pecas       enable row level security;
alter table public.peca_versoes enable row level security;
alter table public.gravacoes   enable row level security;
alter table public.materiais   enable row level security;
alter table public.mensagens   enable row level security;
alter table public.horas       enable row level security;

do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public'
    and tablename in ('modulos','perfis','permissoes','clientes','projetos','tarefas','comentarios','avisos','ajustes','anexos','briefings','lancamentos','orcamentos','produtos','fornecedores','equipamentos','pecas','peca_versoes','gravacoes','materiais','mensagens','horas')
  loop execute format('drop policy %I on public.%I', r.policyname, r.tablename); end loop;
end $$;

-- Módulos: qualquer pessoa logada lê o catálogo.
create policy modulos_ler on public.modulos for select to authenticated using (true);

-- Perfis: quem já foi liberado vê os nomes da equipe (para atribuir
-- tarefas). Conta nova ou desativada vê só o próprio perfil.
create policy perfis_ler on public.perfis for select to authenticated
  using (id = auth.uid() or public.tem_acesso());
create policy perfis_editar on public.perfis for update to authenticated
  using (id = auth.uid() or public.eh_admin());
create policy perfis_apagar on public.perfis for delete to authenticated
  using (public.eh_admin() and id <> auth.uid());

-- Permissões: cada um vê as suas; só o administrador muda.
create policy permissoes_ler on public.permissoes for select to authenticated
  using (usuario_id = auth.uid() or public.eh_admin());
create policy permissoes_admin on public.permissoes for all to authenticated
  using (public.eh_admin()) with check (public.eh_admin());

-- Clientes
create policy clientes_ler on public.clientes for select to authenticated
  using (public.pode('clientes', 'ver') or public.ve_tarefa_do_cliente(id));
create policy clientes_criar on public.clientes for insert to authenticated
  with check (public.pode('clientes', 'criar'));
create policy clientes_editar on public.clientes for update to authenticated
  using (public.pode('clientes', 'editar'));
create policy clientes_apagar on public.clientes for delete to authenticated
  using (public.pode('clientes', 'apagar'));

-- Projetos
create policy projetos_ler on public.projetos for select to authenticated
  using (public.pode('projetos', 'ver') or public.ve_tarefa_do_projeto(id));
create policy projetos_criar on public.projetos for insert to authenticated
  with check (public.pode('projetos', 'criar')
              and (cliente_id is null or exists (select 1 from public.clientes c where c.id = cliente_id)));
create policy projetos_editar on public.projetos for update to authenticated
  using (public.pode('projetos', 'editar'))
  with check (public.pode('projetos', 'editar')
              and (cliente_id is null or exists (select 1 from public.clientes c where c.id = cliente_id)));
create policy projetos_apagar on public.projetos for delete to authenticated
  using (public.pode('projetos', 'apagar'));

-- Tarefas: o responsável sempre pode mover a própria tarefa.
create policy tarefas_ler on public.tarefas for select to authenticated
  using (public.pode_ver_tarefa(setor, responsaveis, criado_por));
-- Tarefa só entra num projeto que a pessoa já enxerga (senão, ligando uma
-- tarefa a um projeto alheio, ela passaria a ver o projeto e o cliente).
create policy tarefas_criar on public.tarefas for insert to authenticated
  with check (public.pode('tarefas', 'criar')
              and (projeto_id is null or exists (select 1 from public.projetos p where p.id = projeto_id)));
create policy tarefas_editar on public.tarefas for update to authenticated
  using (public.pode_ver_tarefa(setor, responsaveis, criado_por)
         and (public.pode('tarefas', 'editar') or auth.uid() = any(responsaveis)))
  with check (public.pode_ver_tarefa(setor, responsaveis, criado_por)
              and (public.pode('tarefas', 'editar') or auth.uid() = any(responsaveis))
              and (projeto_id is null or exists (select 1 from public.projetos p where p.id = projeto_id)));
create policy tarefas_apagar on public.tarefas for delete to authenticated
  using (public.pode('tarefas', 'apagar') and public.pode_ver_tarefa(setor, responsaveis, criado_por));

-- Comentários: quem vê a tarefa lê e comenta.
create policy comentarios_ler on public.comentarios for select to authenticated
  using (exists (select 1 from public.tarefas t where t.id = tarefa_id));
create policy comentarios_criar on public.comentarios for insert to authenticated
  with check (autor_id = auth.uid() and exists (select 1 from public.tarefas t where t.id = tarefa_id));
create policy comentarios_apagar on public.comentarios for delete to authenticated
  using (autor_id = auth.uid() or public.eh_admin());

-- Avisos: cada um vê e marca como lido os seus.
create policy avisos_ler on public.avisos for select to authenticated using (usuario_id = auth.uid() and public.esta_ativo());
create policy avisos_marcar on public.avisos for update to authenticated using (usuario_id = auth.uid());
create policy avisos_apagar on public.avisos for delete to authenticated using (usuario_id = auth.uid());

-- Anexos: quem vê o projeto vê os anexos; quem pode editar projetos anexa;
-- apaga quem pode apagar projetos, ou quem enviou (se ainda edita projetos).
create policy anexos_ler on public.anexos for select to authenticated
  using (exists (select 1 from public.projetos p where p.id = projeto_id));
create policy anexos_criar on public.anexos for insert to authenticated
  with check (public.pode('projetos', 'editar')
              and exists (select 1 from public.projetos p where p.id = projeto_id));
create policy anexos_apagar on public.anexos for delete to authenticated
  using (exists (select 1 from public.projetos p where p.id = projeto_id)
         and (public.pode('projetos', 'apagar')
              or (enviado_por = auth.uid() and public.pode('projetos', 'editar'))));

-- Briefings: quem vê e edita projetos acompanha; quem edita gera o link e
-- apaga um link que ainda não foi respondido. Ninguém da equipe muda as
-- respostas: elas só chegam pelo link do cliente.
create policy briefings_ler on public.briefings for select to authenticated
  using (public.pode('projetos', 'ver') and exists (select 1 from public.projetos p where p.id = projeto_id));
create policy briefings_criar on public.briefings for insert to authenticated
  with check (public.pode('projetos', 'editar') and exists (select 1 from public.projetos p where p.id = projeto_id));
create policy briefings_apagar on public.briefings for delete to authenticated
  using (public.pode('projetos', 'editar') and exists (select 1 from public.projetos p where p.id = projeto_id)
         and (status = 'aguardando' or public.pode('projetos', 'apagar')));

-- Finanças. Pessoal: só o próprio dono (conta ativa) vê e mexe, nem o
-- administrador enxerga. Empresa: segue a permissão "financeiro"; cliente e
-- projeto ligados precisam ser os que a pessoa já enxerga.
create policy lancamentos_ler on public.lancamentos for select to authenticated
  using ((escopo = 'pessoal' and dono_id = auth.uid() and public.esta_ativo())
         or (escopo = 'empresa' and public.pode('financeiro', 'ver')));
create policy lancamentos_criar on public.lancamentos for insert to authenticated
  with check ((escopo = 'pessoal' and dono_id = auth.uid() and public.esta_ativo())
              or (escopo = 'empresa' and public.pode('financeiro', 'criar')
                  and (cliente_id is null or exists (select 1 from public.clientes c where c.id = cliente_id))
                  and (projeto_id is null or exists (select 1 from public.projetos p where p.id = projeto_id))));
create policy lancamentos_editar on public.lancamentos for update to authenticated
  using ((escopo = 'pessoal' and dono_id = auth.uid() and public.esta_ativo())
         or (escopo = 'empresa' and public.pode('financeiro', 'editar')))
  with check ((escopo = 'pessoal' and dono_id = auth.uid() and public.esta_ativo())
              or (escopo = 'empresa' and public.pode('financeiro', 'editar')
                  and (cliente_id is null or exists (select 1 from public.clientes c where c.id = cliente_id))
                  and (projeto_id is null or exists (select 1 from public.projetos p where p.id = projeto_id))));
create policy lancamentos_apagar on public.lancamentos for delete to authenticated
  using ((escopo = 'pessoal' and dono_id = auth.uid() and public.esta_ativo())
         or (escopo = 'empresa' and public.pode('financeiro', 'apagar')));

-- Orçamentos: seguem a permissão "comercial". Cliente, projeto e lançamento
-- ligados precisam ser os que a pessoa já enxerga.
create policy orcamentos_ler on public.orcamentos for select to authenticated
  using (public.pode('comercial', 'ver'));
create policy orcamentos_criar on public.orcamentos for insert to authenticated
  with check (public.pode('comercial', 'criar')
              and (cliente_id is null or exists (select 1 from public.clientes c where c.id = cliente_id))
              and (projeto_id is null or exists (select 1 from public.projetos p where p.id = projeto_id))
              and lancamento_id is null);
create policy orcamentos_editar on public.orcamentos for update to authenticated
  using (public.pode('comercial', 'editar'))
  with check (public.pode('comercial', 'editar')
              and (cliente_id is null or exists (select 1 from public.clientes c where c.id = cliente_id))
              and (projeto_id is null or exists (select 1 from public.projetos p where p.id = projeto_id))
              and (lancamento_id is null or exists (select 1 from public.lancamentos l where l.id = lancamento_id and l.escopo = 'empresa')));
create policy orcamentos_apagar on public.orcamentos for delete to authenticated
  using (public.pode('comercial', 'apagar'));

-- Produtos (tabela de preços): permissão "comercial".
create policy produtos_ler on public.produtos for select to authenticated
  using (public.pode('comercial', 'ver'));
create policy produtos_criar on public.produtos for insert to authenticated
  with check (public.pode('comercial', 'criar'));
create policy produtos_editar on public.produtos for update to authenticated
  using (public.pode('comercial', 'editar')) with check (public.pode('comercial', 'editar'));
create policy produtos_apagar on public.produtos for delete to authenticated
  using (public.pode('comercial', 'apagar'));

-- Fornecedores: permissão "fornecedores".
create policy fornecedores_ler on public.fornecedores for select to authenticated
  using (public.pode('fornecedores', 'ver'));
create policy fornecedores_criar on public.fornecedores for insert to authenticated
  with check (public.pode('fornecedores', 'criar'));
create policy fornecedores_editar on public.fornecedores for update to authenticated
  using (public.pode('fornecedores', 'editar')) with check (public.pode('fornecedores', 'editar'));
create policy fornecedores_apagar on public.fornecedores for delete to authenticated
  using (public.pode('fornecedores', 'apagar'));

-- Equipamentos: permissão "equipamentos". "Com quem" precisa ser alguém da equipe.
create policy equipamentos_ler on public.equipamentos for select to authenticated
  using (public.pode('equipamentos', 'ver'));
create policy equipamentos_criar on public.equipamentos for insert to authenticated
  with check (public.pode('equipamentos', 'criar'));
create policy equipamentos_editar on public.equipamentos for update to authenticated
  using (public.pode('equipamentos', 'editar')) with check (public.pode('equipamentos', 'editar'));
create policy equipamentos_apagar on public.equipamentos for delete to authenticated
  using (public.pode('equipamentos', 'apagar'));

-- Criação: permissão "criacao". A peça precisa ser de um projeto que a
-- pessoa enxerga. Versão nova: quem pode criar ou editar peças. Apagar
-- versão: quem pode apagar, ou quem enviou, enquanto o cliente não respondeu.
create policy pecas_ler on public.pecas for select to authenticated
  using (public.pode('criacao', 'ver'));
create policy pecas_criar on public.pecas for insert to authenticated
  with check (public.pode('criacao', 'criar') and exists (select 1 from public.projetos p where p.id = projeto_id));
create policy pecas_editar on public.pecas for update to authenticated
  using (public.pode('criacao', 'editar'))
  with check (public.pode('criacao', 'editar') and exists (select 1 from public.projetos p where p.id = projeto_id));
create policy pecas_apagar on public.pecas for delete to authenticated
  using (public.pode('criacao', 'apagar'));
create policy peca_versoes_ler on public.peca_versoes for select to authenticated
  using (public.pode('criacao', 'ver'));
create policy peca_versoes_criar on public.peca_versoes for insert to authenticated
  with check ((public.pode('criacao', 'criar') or public.pode('criacao', 'editar'))
              and exists (select 1 from public.pecas pc where pc.id = peca_id));
create policy peca_versoes_editar on public.peca_versoes for update to authenticated
  using (public.pode('criacao', 'editar')) with check (public.pode('criacao', 'editar'));
create policy peca_versoes_apagar on public.peca_versoes for delete to authenticated
  using (public.pode('criacao', 'apagar')
         or (enviado_por = auth.uid() and resposta = 'aguardando' and public.pode('criacao', 'ver')));

-- Gravações: permissão "execucao". Quem está na equipe também vê e marca
-- o checklist (o gatilho deixa só isso). Projeto ligado precisa ser visível.
create policy gravacoes_ler on public.gravacoes for select to authenticated
  using (public.pode('execucao', 'ver') or (public.esta_ativo() and auth.uid() = any(equipe)));
create policy gravacoes_criar on public.gravacoes for insert to authenticated
  with check (public.pode('execucao', 'criar')
              and (projeto_id is null or exists (select 1 from public.projetos p where p.id = projeto_id)));
create policy gravacoes_editar on public.gravacoes for update to authenticated
  using (public.pode('execucao', 'editar') or (public.esta_ativo() and auth.uid() = any(equipe)))
  with check (public.pode('execucao', 'editar') or (public.esta_ativo() and auth.uid() = any(equipe)));
create policy gravacoes_apagar on public.gravacoes for delete to authenticated
  using (public.pode('execucao', 'apagar'));

-- Banco de materiais: permissão "materiais"; cliente ligado precisa ser visível.
create policy materiais_ler on public.materiais for select to authenticated
  using (public.pode('materiais', 'ver'));
create policy materiais_criar on public.materiais for insert to authenticated
  with check (public.pode('materiais', 'criar')
              and (cliente_id is null or exists (select 1 from public.clientes c where c.id = cliente_id)));
create policy materiais_editar on public.materiais for update to authenticated
  using (public.pode('materiais', 'editar'))
  with check (public.pode('materiais', 'editar')
              and (cliente_id is null or exists (select 1 from public.clientes c where c.id = cliente_id)));
create policy materiais_apagar on public.materiais for delete to authenticated
  using (public.pode('materiais', 'apagar') or (criado_por = auth.uid() and public.pode('materiais', 'criar')));

-- Conversa do projeto: quem enxerga o projeto lê e escreve; cada um apaga
-- a própria mensagem (o administrador apaga qualquer uma).
create policy mensagens_ler on public.mensagens for select to authenticated
  using (public.esta_ativo() and exists (select 1 from public.projetos p where p.id = projeto_id));
create policy mensagens_criar on public.mensagens for insert to authenticated
  with check (public.esta_ativo() and autor_id = auth.uid() and exists (select 1 from public.projetos p where p.id = projeto_id));
create policy mensagens_apagar on public.mensagens for delete to authenticated
  using ((autor_id = auth.uid() and public.esta_ativo()) or public.eh_admin());

-- Horas: cada um as próprias; as dos outros pela permissão "horas". O projeto
-- e a tarefa ligados precisam estar visíveis para quem grava.
create policy horas_ler on public.horas for select to authenticated
  using (public.esta_ativo() and (usuario_id = auth.uid() or public.pode('horas', 'ver')));
create policy horas_criar on public.horas for insert to authenticated
  with check (public.esta_ativo() and (usuario_id = auth.uid() or public.eh_admin())
              and (projeto_id is null or exists (select 1 from public.projetos p where p.id = projeto_id))
              and (tarefa_id is null or exists (select 1 from public.tarefas t where t.id = tarefa_id)));
create policy horas_editar on public.horas for update to authenticated
  using (public.esta_ativo() and (usuario_id = auth.uid() or public.pode('horas', 'editar')))
  with check (public.esta_ativo() and (usuario_id = auth.uid() or public.pode('horas', 'editar'))
              and (projeto_id is null or exists (select 1 from public.projetos p where p.id = projeto_id))
              and (tarefa_id is null or exists (select 1 from public.tarefas t where t.id = tarefa_id)));
create policy horas_apagar on public.horas for delete to authenticated
  using ((usuario_id = auth.uid() and public.esta_ativo()) or public.pode('horas', 'apagar'));

-- Os arquivos em si (Storage) seguem a tabela de anexos: só se lê o arquivo
-- cujo anexo a pessoa vê; só se envia para um caminho que ela mesma acabou
-- de registrar; só se apaga o que ela pode apagar. Ninguém substitui arquivo.
drop policy if exists anexos_arquivo_ler on storage.objects;
drop policy if exists anexos_arquivo_enviar on storage.objects;
drop policy if exists anexos_arquivo_apagar on storage.objects;
create policy anexos_arquivo_ler on storage.objects for select to authenticated
  using (bucket_id = 'anexos' and exists (select 1 from public.anexos a where a.caminho = name));
create policy anexos_arquivo_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'anexos' and exists (
    select 1 from public.anexos a where a.caminho = name and a.enviado_por = auth.uid()));
create policy anexos_arquivo_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'anexos' and exists (
    select 1 from public.anexos a join public.projetos p on p.id = a.projeto_id
    where a.caminho = name and (public.pode('projetos', 'apagar')
      or (a.enviado_por = auth.uid() and public.pode('projetos', 'editar')))));

-- Arquivos das notas fiscais (depósito "notas"): lê quem vê o lançamento;
-- envia para o caminho já registrado no lançamento quem pode editar o caixa
-- (ou quem acabou de criar o lançamento); apaga quem pode editar ou apagar.
drop policy if exists notas_arquivo_ler on storage.objects;
drop policy if exists notas_arquivo_enviar on storage.objects;
drop policy if exists notas_arquivo_apagar on storage.objects;
create policy notas_arquivo_ler on storage.objects for select to authenticated
  using (bucket_id = 'notas' and exists (select 1 from public.lancamentos l where l.nf_caminho = name));
create policy notas_arquivo_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'notas' and exists (
    select 1 from public.lancamentos l where l.nf_caminho = name and l.escopo = 'empresa'
      and (public.pode('financeiro', 'editar') or (l.dono_id = auth.uid() and public.pode('financeiro', 'criar')))));
create policy notas_arquivo_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'notas' and exists (
    select 1 from public.lancamentos l where l.nf_caminho = name
      and (public.pode('financeiro', 'editar') or public.pode('financeiro', 'apagar'))));

-- Arquivos das peças (depósito "pecas"): a equipe lista e lê o que a
-- versão dela registra; envia só para o caminho que a própria pessoa
-- acabou de registrar; apaga quem pode apagar a versão. O cliente só abre
-- o arquivo pelo endereço exato, que vem junto da peça pelo link dele.
drop policy if exists pecas_arquivo_ler on storage.objects;
drop policy if exists pecas_arquivo_enviar on storage.objects;
drop policy if exists pecas_arquivo_apagar on storage.objects;
create policy pecas_arquivo_ler on storage.objects for select to authenticated
  using (bucket_id = 'pecas' and exists (select 1 from public.peca_versoes v where v.caminho = name));
create policy pecas_arquivo_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'pecas' and exists (
    select 1 from public.peca_versoes v where v.caminho = name and v.enviado_por = auth.uid()));
-- Arquivos do banco de materiais (depósito privado "materiais"): lê quem vê
-- o material; envia para o caminho que acabou de registrar; apaga quem pode
-- apagar o material.
drop policy if exists materiais_arquivo_ler on storage.objects;
drop policy if exists materiais_arquivo_enviar on storage.objects;
drop policy if exists materiais_arquivo_apagar on storage.objects;
create policy materiais_arquivo_ler on storage.objects for select to authenticated
  using (bucket_id = 'materiais' and exists (select 1 from public.materiais m where m.caminho = name));
create policy materiais_arquivo_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'materiais' and exists (
    select 1 from public.materiais m where m.caminho = name and m.criado_por = auth.uid()));
create policy materiais_arquivo_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'materiais' and exists (
    select 1 from public.materiais m where m.caminho = name
      and (public.pode('materiais', 'apagar') or (m.criado_por = auth.uid() and public.pode('materiais', 'criar')))));

create policy pecas_arquivo_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'pecas' and exists (
    select 1 from public.peca_versoes v where v.caminho = name
      and (public.pode('criacao', 'apagar') or (v.enviado_por = auth.uid() and v.resposta = 'aguardando'))));

-- ---------------------------------------------------------------------
-- Visitante sem login (papel "anon" do Supabase) não toca em nada:
-- nem tabelas, nem funções. O login usa o serviço de autenticação, não
-- estas tabelas. Quem está logado ("authenticated") passa pelas regras acima.
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
-- Funções que só o próprio banco usa (dentro dos gatilhos) ficam fechadas
-- também para quem está logado.
revoke execute on function public.usuario_ve_tarefa(uuid, uuid) from authenticated;
revoke execute on function public.hash_senha_acesso(text) from authenticated;

-- Única porta aberta para o visitante: um "oi" sem dados, usado pelo robô
-- do GitHub que impede o Supabase grátis de pausar o banco por falta de uso.
create or replace function public.ping() returns text language sql stable as $$ select 'ok'::text $$;
grant execute on function public.ping() to anon;
-- Cliente respondendo o briefing pelo link (sem login).
grant execute on function public.briefing_abrir(text) to anon;
grant execute on function public.briefing_enviar(text, jsonb) to anon;
-- Cliente aprovando a peça pelo link (sem login).
grant execute on function public.peca_abrir(text) to anon;
grant execute on function public.peca_responder(text, text, text, text) to anon;
-- Funções internas dos gatilhos ficam fechadas.
revoke execute on function public.preparar_briefing() from authenticated;
revoke execute on function public.preparar_lancamento() from authenticated;
revoke execute on function public.preparar_orcamento() from authenticated;
revoke execute on function public.preparar_fornecedor() from authenticated;
revoke execute on function public.preparar_peca() from authenticated;
revoke execute on function public.preparar_versao() from authenticated;
revoke execute on function public.preparar_gravacao() from authenticated;
revoke execute on function public.avisar_gravacao() from authenticated;
revoke execute on function public.criar_projeto_geral() from authenticated;
revoke execute on function public.preparar_material() from authenticated;
revoke execute on function public.preparar_mensagem() from authenticated;
revoke execute on function public.avisar_mensagem() from authenticated;
revoke execute on function public.preparar_hora() from authenticated;

-- Avisa a API do Supabase para reler a estrutura (colunas e funções novas).
notify pgrst, 'reload schema';
