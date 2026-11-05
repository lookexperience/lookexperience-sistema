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
  ('comercial',    'Comercial',            2, 50),
  ('criacao',      'Criação',              3, 60),
  ('execucao',     'Execução',             3, 70),
  ('materiais',    'Banco de materiais',   3, 75),
  ('equipamentos', 'Equipamentos',         3, 76),
  ('financeiro',   'Financeiro',           4, 80),
  ('horas',        'Registro de horas',    4, 85)
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
alter table public.modulos     enable row level security;
alter table public.perfis      enable row level security;
alter table public.permissoes  enable row level security;
alter table public.clientes    enable row level security;
alter table public.projetos    enable row level security;
alter table public.tarefas     enable row level security;
alter table public.comentarios enable row level security;
alter table public.avisos      enable row level security;
alter table public.anexos      enable row level security;

do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public'
    and tablename in ('modulos','perfis','permissoes','clientes','projetos','tarefas','comentarios','avisos','ajustes','anexos')
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
