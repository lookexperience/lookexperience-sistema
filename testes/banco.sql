-- =====================================================================
-- Testes do banco: cada tipo de usuário tenta ver, criar, editar e
-- apagar o que pode e o que não pode. Rodar com testes/rodar-banco.sh.
-- Cada linha "OK" ou "FALHOU" é um teste.
-- =====================================================================
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null

create schema teste;
create table teste.resultado (n serial, nome text, ok boolean, detalhe text);
grant usage on schema teste to authenticated, anon;
grant all on teste.resultado to authenticated, anon;
grant usage on sequence teste.resultado_n_seq to authenticated, anon;

create function teste.ok(cond boolean, nome text, detalhe text default '') returns void
language sql as $$ insert into teste.resultado (nome, ok, detalhe) values (nome, coalesce(cond, false), detalhe) $$;

-- Executa um comando e diz se foi bloqueado (erro) ou quantas linhas mexeu.
create function teste.linhas(sql text) returns int language plpgsql as $$
declare n int;
begin
  execute sql; get diagnostics n = row_count; return n;
exception when others then return -1;
end $$;

create function teste.como(usuario uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(usuario::text, ''), false);
$$;

-- Supabase dá acesso às tabelas também para "anon" (visitante sem login).
grant all on all tables in schema public to anon;

-- ---------------------------------------------------------------------
-- Pessoas: A admin, G gerente, F freelancer, N conta nova, D desativada
-- ---------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000aa', 'pablo@look', '{"nome":"Pablo Caetano"}'),
  ('00000000-0000-0000-0000-0000000000bb', 'marina@look', '{"nome":"Marina Gerente"}'),
  ('00000000-0000-0000-0000-0000000000cc', 'rafa@look', '{"nome":"Rafa Freela"}'),
  ('00000000-0000-0000-0000-0000000000dd', 'nova@look', '{"nome":"Nova Conta"}'),
  ('00000000-0000-0000-0000-0000000000ee', 'saiu@look', '{"nome":"Ex Funcionario"}');

select teste.ok((select admin from perfis where email = 'pablo@look'), 'Primeira conta vira administrador');
select teste.ok((select count(*) = 0 from perfis where admin and email <> 'pablo@look'), 'As outras contas nascem sem ser administrador');
select teste.ok((select count(*) = 0 from permissoes), 'Contas novas nascem sem nenhuma permissão');

-- ---------------------------------------------------------------------
-- Administrador configura a equipe
-- ---------------------------------------------------------------------
set role authenticated;
select teste.como('00000000-0000-0000-0000-0000000000aa');

update perfis set cargo = 'Gerente de criação', setores = '{criacao,execucao}' where email = 'marina@look';
update perfis set cargo = 'Editor freelancer', setores = '{execucao}' where email = 'rafa@look';
insert into permissoes values
  ('00000000-0000-0000-0000-0000000000bb', 'visao_geral', true, false, false, false, 'proprias'),
  ('00000000-0000-0000-0000-0000000000bb', 'tarefas', true, true, true, false, 'setor'),
  ('00000000-0000-0000-0000-0000000000bb', 'clientes', true, false, false, false, 'proprias'),
  ('00000000-0000-0000-0000-0000000000bb', 'projetos', true, true, true, false, 'proprias'),
  ('00000000-0000-0000-0000-0000000000cc', 'visao_geral', true, false, false, false, 'proprias'),
  ('00000000-0000-0000-0000-0000000000cc', 'tarefas', true, false, false, false, 'proprias'),
  ('00000000-0000-0000-0000-0000000000ee', 'tarefas', true, true, true, true, 'todas');
update perfis set ativo = false where email = 'saiu@look';

select teste.ok((select setores = '{criacao,execucao}' from perfis where email = 'marina@look'), 'Admin muda setores de outra pessoa');
select teste.ok((select count(*) = 7 from permissoes), 'Admin libera permissões');

insert into clientes (id, nome) values ('10000000-0000-0000-0000-000000000001', 'Lotus Games'), ('10000000-0000-0000-0000-000000000002', 'Flambé');
insert into projetos (id, cliente_id, nome) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Rebranding'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Identidade');
insert into tarefas (id, titulo, setor, projeto_id, responsavel_id) values
  ('30000000-0000-0000-0000-000000000001', 'Medalha', 'criacao', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000bb'),
  ('30000000-0000-0000-0000-000000000002', 'Proposta Flambé', 'comercial', '20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000aa'),
  ('30000000-0000-0000-0000-000000000003', 'Editar reels', 'execucao', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000cc'),
  ('30000000-0000-0000-0000-000000000004', 'Contrato Lotus', 'comercial', null, '00000000-0000-0000-0000-0000000000aa');
select teste.ok((select count(*) = 4 from tarefas), 'Admin cria e vê todas as tarefas');
reset role;
select teste.ok((select count(*) = 2 from avisos where usuario_id <> '00000000-0000-0000-0000-0000000000aa'), 'Quem recebe tarefa ganha aviso (Marina e Rafa)');
set role authenticated;

select teste.ok(teste.linhas($$update perfis set admin = false where email = 'pablo@look'$$) = -1, 'Único administrador não consegue tirar o próprio acesso de admin');
select teste.ok(teste.linhas($$update perfis set ativo = false where email = 'pablo@look'$$) = -1, 'Único administrador não consegue desativar a própria conta');
select teste.ok((select admin and ativo from perfis where email = 'pablo@look'), 'Administrador continua ativo e admin');

-- ---------------------------------------------------------------------
-- Gerente (vê tarefas dos setores criação e execução)
-- ---------------------------------------------------------------------
select teste.como('00000000-0000-0000-0000-0000000000bb');
select teste.ok((select array_agg(titulo order by titulo) = '{Editar reels,Medalha}' from tarefas), 'Gerente vê só as tarefas dos setores dela', (select string_agg(titulo, ', ') from tarefas));
select teste.ok((select count(*) = 2 from clientes), 'Gerente com "ver clientes" vê os clientes');
select teste.ok(teste.linhas($$insert into clientes (nome) values ('Cliente pirata')$$) = -1, 'Gerente sem "criar clientes" não cria cliente');
select teste.ok(teste.linhas($$update tarefas set titulo = 'Medalha dourada' where id = '30000000-0000-0000-0000-000000000001'$$) = 1, 'Gerente edita tarefa do setor dela');
select teste.ok(teste.linhas($$update tarefas set titulo = 'Hackeada' where id = '30000000-0000-0000-0000-000000000002'$$) = 0, 'Gerente não edita tarefa de outro setor');
select teste.ok(teste.linhas($$delete from tarefas where id = '30000000-0000-0000-0000-000000000001'$$) = 0, 'Gerente sem "apagar" não apaga tarefa');
select teste.ok(teste.linhas($$insert into tarefas (id, titulo, setor, criado_por) values ('30000000-0000-0000-0000-000000000005', 'Moodboard', 'criacao', '00000000-0000-0000-0000-0000000000aa')$$) = 1, 'Gerente cria tarefa');
reset role;
select teste.ok((select criado_por = '00000000-0000-0000-0000-0000000000bb' from tarefas where id = '30000000-0000-0000-0000-000000000005'), 'Tarefa criada fica no nome de quem criou, mesmo tentando usar outro nome');
set role authenticated;
select teste.linhas($$update tarefas set criado_por = '00000000-0000-0000-0000-0000000000aa' where id = '30000000-0000-0000-0000-000000000005'$$);
select teste.ok((select criado_por = '00000000-0000-0000-0000-0000000000bb' from tarefas where id = '30000000-0000-0000-0000-000000000005'), 'Ninguém troca o autor de uma tarefa');
update perfis set admin = true, setores = '{comercial,criacao,execucao}', cargo = 'Chefe', nome = 'Marina G.' where id = '00000000-0000-0000-0000-0000000000bb';
select teste.ok((select not admin and setores = '{criacao,execucao}' and cargo = 'Gerente de criação' from perfis where email = 'marina@look'), 'Gerente não se promove a admin nem muda os próprios setores');
select teste.ok((select nome = 'Marina G.' from perfis where email = 'marina@look'), 'Gerente muda o próprio nome');
select teste.ok((select count(*) = 4 from permissoes), 'Gerente vê só as próprias permissões', (select count(*)::text from permissoes));
select teste.ok(teste.linhas($$insert into permissoes values ('00000000-0000-0000-0000-0000000000bb', 'financeiro', true, true, true, true, 'todas')$$) = -1, 'Gerente não se dá permissão nova');
select teste.ok(teste.linhas($$update permissoes set apagar = true where usuario_id = '00000000-0000-0000-0000-0000000000bb'$$) = 0, 'Gerente não altera as próprias permissões');
select teste.linhas($$update perfis set ativo = false where email = 'rafa@look'$$);
select teste.ok((select ativo from perfis where email = 'rafa@look'), 'Gerente não desativa outra pessoa');
select teste.ok(teste.linhas($$delete from perfis where email = 'rafa@look'$$) = 0, 'Gerente não remove ninguém');
select teste.ok(teste.linhas($$insert into comentarios (tarefa_id, texto) values ('30000000-0000-0000-0000-000000000003', 'Ficou ótimo @Rafa')$$) = 1, 'Gerente comenta em tarefa que vê');
select teste.ok(teste.linhas($$insert into comentarios (tarefa_id, texto) values ('30000000-0000-0000-0000-000000000002', 'Espiando')$$) = -1, 'Gerente não comenta em tarefa que não vê');
select teste.ok(teste.linhas($$insert into comentarios (tarefa_id, autor_id, texto) values ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000aa', 'Assinado: Pablo')$$) = -1, 'Ninguém comenta usando o nome de outra pessoa');
select teste.ok(teste.linhas($$insert into avisos (usuario_id, texto) values ('00000000-0000-0000-0000-0000000000aa', 'falso')$$) = -1, 'Ninguém cria aviso na mão');

-- ---------------------------------------------------------------------
-- Freelancer (só as tarefas dele, sem editar)
-- ---------------------------------------------------------------------
select teste.como('00000000-0000-0000-0000-0000000000cc');
select teste.ok((select array_agg(titulo) = '{Editar reels}' from tarefas), 'Freelancer vê só a tarefa dele', (select string_agg(titulo, ', ') from tarefas));
select teste.ok((select array_agg(nome) = '{Rebranding}' from projetos), 'Freelancer vê só o projeto da tarefa dele');
select teste.ok((select array_agg(nome) = '{Lotus Games}' from clientes), 'Freelancer vê só o cliente da tarefa dele');
select teste.ok(teste.linhas($$update tarefas set status = 'fazendo', ordem = 5 where id = '30000000-0000-0000-0000-000000000003'$$) = 1, 'Freelancer muda status e posição da própria tarefa');
update tarefas set titulo = 'Mudei', prazo = '2030-01-01', setor = 'comercial' where id = '30000000-0000-0000-0000-000000000003';
select teste.ok((select titulo = 'Editar reels' and prazo is null and setor = 'execucao' from tarefas where id = '30000000-0000-0000-0000-000000000003'), 'Freelancer sem "editar" não muda título, prazo ou setor');
select teste.ok((select status = 'fazendo' from tarefas where id = '30000000-0000-0000-0000-000000000003'), 'Status mudado pelo freelancer ficou salvo');
select teste.linhas($$update tarefas set responsavel_id = '00000000-0000-0000-0000-0000000000aa' where id = '30000000-0000-0000-0000-000000000003'$$);
select teste.ok((select responsavel_id = '00000000-0000-0000-0000-0000000000cc' from tarefas where id = '30000000-0000-0000-0000-000000000003'), 'Freelancer não passa a tarefa para outra pessoa');
select teste.ok(teste.linhas($$insert into tarefas (titulo) values ('Tarefa do freela')$$) = -1, 'Freelancer sem "criar" não cria tarefa');
select teste.ok(teste.linhas($$update tarefas set status = 'feito' where id = '30000000-0000-0000-0000-000000000001'$$) = 0, 'Freelancer não mexe na tarefa dos outros');
select teste.ok((select count(*) = 1 from comentarios), 'Freelancer lê o comentário da tarefa dele');
select teste.ok(teste.linhas($$delete from comentarios$$) = 0, 'Freelancer não apaga comentário dos outros');
select teste.ok((select count(*) >= 1 from avisos), 'Freelancer vê os avisos dele');
select teste.ok((select bool_and(usuario_id = '00000000-0000-0000-0000-0000000000cc') from avisos), 'Freelancer não vê aviso dos outros');
select teste.ok(teste.linhas($$update avisos set lido = true$$) >= 1, 'Freelancer marca os avisos como lidos');
select teste.ok(teste.linhas($$update avisos set usuario_id = '00000000-0000-0000-0000-0000000000aa'$$) = -1, 'Freelancer não manda o aviso dele para outra pessoa');

-- ---------------------------------------------------------------------
-- Conta nova (ainda sem liberação)
-- ---------------------------------------------------------------------
select teste.como('00000000-0000-0000-0000-0000000000dd');
select teste.ok((select count(*) = 0 from tarefas) and (select count(*) = 0 from clientes) and (select count(*) = 0 from projetos), 'Conta nova não vê tarefas, clientes nem projetos');
select teste.ok((select array_agg(email) = '{nova@look}' from perfis), 'Conta nova não vê nomes e e-mails da equipe', (select string_agg(email, ', ') from perfis));
select teste.ok(teste.linhas($$insert into tarefas (titulo) values ('x')$$) = -1, 'Conta nova não cria tarefa');

-- ---------------------------------------------------------------------
-- Conta desativada (tinha todas as permissões)
-- ---------------------------------------------------------------------
select teste.como('00000000-0000-0000-0000-0000000000ee');
select teste.ok((select count(*) = 0 from tarefas), 'Conta desativada não vê nada, mesmo com permissões antigas');
select teste.ok(teste.linhas($$insert into tarefas (titulo) values ('x')$$) = -1, 'Conta desativada não cria nada');
select teste.ok((select count(*) = 1 from perfis), 'Conta desativada vê só o próprio perfil');

-- ---------------------------------------------------------------------
-- Visitante sem login
-- ---------------------------------------------------------------------
reset role;
set role anon;
select teste.como(null);
select teste.ok((select count(*) = 0 from tarefas) and (select count(*) = 0 from perfis) and (select count(*) = 0 from clientes), 'Visitante sem login não vê nada');
select teste.ok(teste.linhas($$insert into clientes (nome) values ('x')$$) = -1, 'Visitante sem login não grava nada');

-- ---------------------------------------------------------------------
-- Admin de novo: avisos, segundo admin, apagar
-- ---------------------------------------------------------------------
reset role;
set role authenticated;
select teste.como('00000000-0000-0000-0000-0000000000aa');
reset role;
select teste.ok((select count(*) = 1 from avisos where usuario_id = '00000000-0000-0000-0000-0000000000cc' and texto like 'Marina G. marcou você%'), 'Comentário com @Rafa gera aviso para o Rafa');
set role authenticated;
update perfis set admin = true where email = 'marina@look';
select teste.ok(teste.linhas($$update perfis set admin = false where email = 'pablo@look'$$) = 1, 'Com dois administradores, um pode deixar de ser admin');
select teste.como('00000000-0000-0000-0000-0000000000bb');
update perfis set admin = true where email = 'pablo@look';
select teste.como('00000000-0000-0000-0000-0000000000aa');
select teste.ok(teste.linhas($$delete from tarefas where id = '30000000-0000-0000-0000-000000000004'$$) = 1, 'Admin apaga tarefa');
select teste.ok(teste.linhas($$delete from clientes where id = '10000000-0000-0000-0000-000000000002'$$) = 1, 'Admin apaga cliente');
select teste.ok((select cliente_id is null from projetos where id = '20000000-0000-0000-0000-000000000002'), 'Apagar cliente mantém o projeto, sem cliente');
select teste.ok(teste.linhas($$delete from perfis where id = '00000000-0000-0000-0000-0000000000aa'$$) = 0, 'Admin não remove a própria conta');

-- ---------------------------------------------------------------------
reset role;
\o
\set QUIET 0
\pset footer off
select n, case when ok then 'OK     ' else 'FALHOU ' end as resultado, nome, detalhe from teste.resultado order by n;
select count(*) filter (where ok) as passaram, count(*) filter (where not ok) as falharam from teste.resultado;
