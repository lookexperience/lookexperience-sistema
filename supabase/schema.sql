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
  criado_por  uuid references public.perfis(id) on delete set null default auth.uid(),
  criado_em   timestamptz not null default now()
);

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

-- Projeto visível porque o usuário enxerga alguma tarefa dele.
create or replace function public.ve_tarefa_do_projeto(p_projeto uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from tarefas t where t.projeto_id = p_projeto
                 and public.pode_ver_tarefa(t.setor, t.responsavel_id, t.criado_por));
$$;

create or replace function public.ve_tarefa_do_cliente(p_cliente uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from projetos p where p.cliente_id = p_cliente and public.ve_tarefa_do_projeto(p.id));
$$;

-- ---------------------------------------------------------------------
-- Gatilhos (acontecem sozinhos).
-- ---------------------------------------------------------------------

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

-- Só o administrador muda cargo, setores, admin e ativo. Os outros
-- podem mudar apenas o próprio nome.
create or replace function public.proteger_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_admin() then
    new.cargo := old.cargo; new.setores := old.setores;
    new.admin := old.admin; new.ativo := old.ativo; new.email := old.email;
  end if;
  return new;
end $$;

drop trigger if exists proteger_perfil on public.perfis;
create trigger proteger_perfil before update on public.perfis
  for each row execute function public.proteger_perfil();

create or replace function public.marcar_atualizacao() returns trigger
language plpgsql as $$
begin new.atualizado_em := now(); return new; end $$;

drop trigger if exists marcar_atualizacao on public.tarefas;
create trigger marcar_atualizacao before update on public.tarefas
  for each row execute function public.marcar_atualizacao();

-- Aviso para quem recebe uma tarefa.
create or replace function public.avisar_responsavel() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.responsavel_id is not null
     and new.responsavel_id is distinct from auth.uid()
     and (tg_op = 'INSERT' or new.responsavel_id is distinct from old.responsavel_id) then
    insert into avisos (usuario_id, texto, tarefa_id)
    values (new.responsavel_id, 'Nova tarefa para você: ' || new.titulo, new.id);
  end if;
  return new;
end $$;

drop trigger if exists avisar_responsavel on public.tarefas;
create trigger avisar_responsavel after insert or update of responsavel_id on public.tarefas
  for each row execute function public.avisar_responsavel();

-- Aviso de comentário: para o responsável da tarefa e para quem foi
-- marcado com @PrimeiroNome.
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
         case when new.texto ilike '%@' || split_part(p.nome, ' ', 1) || '%'
              then v_autor || ' marcou você em: ' || v_tarefa.titulo
              else v_autor || ' comentou em: ' || v_tarefa.titulo end,
         new.tarefa_id
  from perfis p
  where p.ativo and p.id <> new.autor_id
    and (p.id = v_tarefa.responsavel_id
         or (split_part(p.nome, ' ', 1) <> '' and new.texto ilike '%@' || split_part(p.nome, ' ', 1) || '%'));
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

do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public'
    and tablename in ('modulos','perfis','permissoes','clientes','projetos','tarefas','comentarios','avisos')
  loop execute format('drop policy %I on public.%I', r.policyname, r.tablename); end loop;
end $$;

-- Módulos: qualquer pessoa logada lê o catálogo.
create policy modulos_ler on public.modulos for select to authenticated using (true);

-- Perfis: quem está ativo vê os nomes da equipe (para atribuir tarefas).
create policy perfis_ler on public.perfis for select to authenticated
  using (id = auth.uid() or public.esta_ativo());
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
  with check (public.pode('projetos', 'criar'));
create policy projetos_editar on public.projetos for update to authenticated
  using (public.pode('projetos', 'editar'));
create policy projetos_apagar on public.projetos for delete to authenticated
  using (public.pode('projetos', 'apagar'));

-- Tarefas: o responsável sempre pode mover a própria tarefa.
create policy tarefas_ler on public.tarefas for select to authenticated
  using (public.pode_ver_tarefa(setor, responsavel_id, criado_por));
create policy tarefas_criar on public.tarefas for insert to authenticated
  with check (public.pode('tarefas', 'criar'));
create policy tarefas_editar on public.tarefas for update to authenticated
  using (public.pode_ver_tarefa(setor, responsavel_id, criado_por)
         and (public.pode('tarefas', 'editar') or responsavel_id = auth.uid()));
create policy tarefas_apagar on public.tarefas for delete to authenticated
  using (public.pode('tarefas', 'apagar') and public.pode_ver_tarefa(setor, responsavel_id, criado_por));

-- Comentários: quem vê a tarefa lê e comenta.
create policy comentarios_ler on public.comentarios for select to authenticated
  using (exists (select 1 from public.tarefas t where t.id = tarefa_id));
create policy comentarios_criar on public.comentarios for insert to authenticated
  with check (autor_id = auth.uid() and exists (select 1 from public.tarefas t where t.id = tarefa_id));
create policy comentarios_apagar on public.comentarios for delete to authenticated
  using (autor_id = auth.uid() or public.eh_admin());

-- Avisos: cada um vê e marca como lido os seus.
create policy avisos_ler on public.avisos for select to authenticated using (usuario_id = auth.uid());
create policy avisos_marcar on public.avisos for update to authenticated using (usuario_id = auth.uid());
create policy avisos_apagar on public.avisos for delete to authenticated using (usuario_id = auth.uid());
