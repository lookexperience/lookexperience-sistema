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


-- ---------------------------------------------------------------------
-- Pessoas: A admin, G gerente, F freelancer, N conta nova, D desativada
-- ---------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000aa', 'pablo@look', '{"nome":"Pablo Caetano"}');
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000bb', 'marina@look', '{"nome":"Marina Gerente","codigo":"L@@k"}');
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000cc', 'rafa@look', '{"nome":"Rafa Freela","codigo":"L@@k"}');
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000dd', 'nova@look', '{"nome":"Nova Conta","codigo":"L@@k"}');
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000ee', 'saiu@look', '{"nome":"Ex Funcionario","codigo":"L@@k"}');

select teste.ok((select admin from perfis where email = 'pablo@look'), 'Primeira conta vira administrador');
select teste.ok((select count(*) = 0 from perfis where admin and email <> 'pablo@look'), 'As outras contas nascem sem ser administrador');
select teste.ok((select count(*) = 0 from permissoes), 'Contas novas nascem sem nenhuma permissão');
select teste.ok((select count(*) = 5 from perfis), 'Com a senha de acesso certa, a conta é criada');
select teste.ok((select count(*) = 0 from auth.users where raw_user_meta_data ? 'codigo'), 'A senha de acesso digitada não fica guardada na conta');

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
select teste.ok((select nome = 'Marina Gerente' from perfis where email = 'marina@look'), 'Gerente não muda o próprio nome (só o admin, para ninguém se passar por outra pessoa)');
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
select teste.ok(teste.linhas($$select * from tarefas$$) = -1 and teste.linhas($$select * from perfis$$) = -1 and teste.linhas($$select * from clientes$$) = -1, 'Visitante sem login não vê nada');
select teste.ok(teste.linhas($$insert into clientes (nome) values ('x')$$) = -1, 'Visitante sem login não grava nada');

-- ---------------------------------------------------------------------
-- Admin de novo: avisos, segundo admin, apagar
-- ---------------------------------------------------------------------
reset role;
set role authenticated;
select teste.como('00000000-0000-0000-0000-0000000000aa');
reset role;
select teste.ok((select count(*) = 1 from avisos where usuario_id = '00000000-0000-0000-0000-0000000000cc' and texto like 'Marina Gerente marcou você%'), 'Comentário com @Rafa gera aviso para o Rafa');
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
-- ATAQUES: alguém tentando burlar as regras
-- ---------------------------------------------------------------------
update perfis set admin = false where email = 'marina@look';

-- Conta nova tentando se liberar sozinha
select teste.como('00000000-0000-0000-0000-0000000000dd');
select teste.ok(teste.linhas($$insert into permissoes values ('00000000-0000-0000-0000-0000000000dd', 'tarefas', true, true, true, true, 'todas')$$) = -1, 'Ataque: conta nova não se dá permissão');
update perfis set admin = true, ativo = true, setores = '{comercial}' where id = '00000000-0000-0000-0000-0000000000dd';
select teste.ok((select not admin and setores = '{}' from perfis where id = '00000000-0000-0000-0000-0000000000dd'), 'Ataque: conta nova não se promove a admin');
select teste.ok(teste.linhas($$insert into perfis (id, nome, admin) values (gen_random_uuid(), 'Fantasma', true)$$) = -1, 'Ataque: ninguém cria perfil na mão');
select teste.ok(teste.linhas($$update perfis set id = '00000000-0000-0000-0000-0000000000aa' where id = '00000000-0000-0000-0000-0000000000dd'$$) = -1, 'Ataque: conta nova não assume o lugar de outra');

-- Cadastro tentando nascer administrador pelos dados extras do formulário
reset role;
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000ff', 'esperto@x', '{"nome":"Esperto","admin":true,"ativo":true,"codigo":"L@@k"}');
select teste.ok((select not admin from perfis where email = 'esperto@x'), 'Ataque: cadastro com "admin" nos dados não vira administrador');
set role authenticated;

-- Freelancer trocando o próprio nome para receber avisos dos outros
select teste.como('00000000-0000-0000-0000-0000000000cc');
update perfis set nome = '%' where id = '00000000-0000-0000-0000-0000000000cc';
select teste.ok((select nome <> '%' from perfis where id = '00000000-0000-0000-0000-0000000000cc'), 'Ataque: freelancer não troca o próprio nome (só o admin)');
select teste.ok(teste.linhas($$delete from tarefas where id = '30000000-0000-0000-0000-000000000003'$$) = 0, 'Ataque: freelancer sem "apagar" não apaga a própria tarefa');
select teste.ok(teste.linhas($$update tarefas set status = 'aprovado_por_mim' where id = '30000000-0000-0000-0000-000000000003'$$) = -1, 'Ataque: status inventado é recusado');

-- Gerente marcando o freelancer numa tarefa que ele não pode ver
reset role;
update perfis set nome = '%' where id = '00000000-0000-0000-0000-0000000000cc';
delete from avisos;
set role authenticated;
select teste.como('00000000-0000-0000-0000-0000000000aa');
select teste.ok(teste.linhas($$insert into comentarios (tarefa_id, texto) values ('30000000-0000-0000-0000-000000000002', 'Confidencial, fala com @Marina')$$) = 1, 'Admin comenta em tarefa do comercial');
reset role;
select teste.ok((select count(*) = 0 from avisos where usuario_id = '00000000-0000-0000-0000-0000000000cc'), 'Ataque: nome "%" não faz o freelancer receber avisos de todos os comentários');
select teste.ok((select count(*) = 0 from avisos where usuario_id = '00000000-0000-0000-0000-0000000000bb'), 'Marcar alguém que não vê a tarefa não vaza o título para essa pessoa');
update perfis set nome = 'Rafa Freela' where id = '00000000-0000-0000-0000-0000000000cc';
set role authenticated;

-- Gerente tentando tirar a tarefa do setor dela (sumir com ela) e textos gigantes
select teste.como('00000000-0000-0000-0000-0000000000bb');
select teste.ok(teste.linhas($$update tarefas set setor = 'comercial' where id = '30000000-0000-0000-0000-000000000003'$$) = -1, 'Ataque: gerente não joga tarefa para um setor que ela não vê');
select teste.ok(teste.linhas($$insert into tarefas (titulo, setor) values (repeat('x', 1000000), 'criacao')$$) = -1, 'Ataque: título gigante (1 MB) é recusado');
select teste.ok(teste.linhas($$insert into tarefas (titulo, setor) values ('   ', 'criacao')$$) = -1, 'Tarefa sem título é recusada');
select teste.ok(teste.linhas($$insert into comentarios (tarefa_id, texto) values ('30000000-0000-0000-0000-000000000001', repeat('x', 100000))$$) = -1, 'Ataque: comentário gigante é recusado');

-- Admin (ou quem rouba a sessão dele) gravando cor com código
select teste.como('00000000-0000-0000-0000-0000000000aa');
select teste.ok(teste.linhas($$update clientes set cor = '#fff" onmouseover="alert(1)' where id = '10000000-0000-0000-0000-000000000001'$$) = -1, 'Ataque: cor com código é recusada pelo banco');
select teste.ok(teste.linhas($$update clientes set cor = '#4F7FB8' where id = '10000000-0000-0000-0000-000000000001'$$) = 1, 'Cor válida continua sendo aceita');

-- Conta desativada não lê avisos antigos (que trazem títulos de tarefas)
reset role;
insert into avisos (usuario_id, texto) values ('00000000-0000-0000-0000-0000000000ee', 'Nova tarefa para você: Segredo');
set role authenticated;
select teste.como('00000000-0000-0000-0000-0000000000ee');
select teste.ok((select count(*) = 0 from avisos), 'Ataque: conta desativada não lê avisos antigos');

-- Estranho tentando criar conta sem a senha de acesso (direto pela API)
reset role;
select teste.ok(teste.linhas($$insert into auth.users (email, raw_user_meta_data) values ('estranho@x', '{"nome":"Estranho"}')$$) = -1, 'Ataque: cadastro sem senha de acesso é recusado');
select teste.ok(teste.linhas($$insert into auth.users (email, raw_user_meta_data) values ('estranho@x', '{"nome":"Estranho","codigo":"l@@k"}')$$) = -1, 'Ataque: senha de acesso com letra trocada é recusada');
select teste.ok(teste.linhas($$insert into auth.users (email, raw_user_meta_data) values ('estranho@x', '{"nome":"Estranho","codigo":"L@@k "}')$$) = -1, 'Ataque: senha de acesso com espaço a mais é recusada');
select teste.ok(teste.linhas($$insert into auth.users (email, raw_user_meta_data) values ('estranho@x', '{"nome":"Estranho","codigo":{"a":1}}')$$) = -1, 'Ataque: senha de acesso em formato estranho é recusada');
select teste.ok(teste.linhas($$insert into auth.users (email, raw_user_meta_data) values ('estranho@x', null)$$) = -1, 'Ataque: cadastro sem nenhum dado extra é recusado');
select teste.ok((select count(*) = 0 from perfis where email = 'estranho@x'), 'Nenhuma conta de estranho foi criada');
set role authenticated;

-- Ninguém lê nem troca a senha de acesso, só o administrador troca
select teste.como('00000000-0000-0000-0000-0000000000bb');
select teste.ok((select count(*) = 0 from ajustes), 'Ataque: gerente não lê a senha de acesso (nem embaralhada)');
select teste.ok(teste.linhas($$update ajustes set valor = 'x'$$) = 0 and teste.linhas($$insert into ajustes values ('senha_acesso_hash2', 'x')$$) = -1, 'Ataque: gerente não grava na tabela de ajustes');
select teste.ok(teste.linhas($$select public.mudar_senha_acesso('minhasenha')$$) = -1, 'Ataque: gerente não troca a senha de acesso');
select teste.ok(teste.linhas($$select public.hash_senha_acesso('L@@k')$$) = -1, 'Ataque: ninguém usa o embaralhador da senha para testar senhas');
select teste.ok(teste.linhas($$select public.usuario_ve_tarefa('00000000-0000-0000-0000-0000000000cc', '30000000-0000-0000-0000-000000000001')$$) = -1, 'Ataque: ninguém pergunta ao banco quem vê qual tarefa');
select teste.como('00000000-0000-0000-0000-0000000000aa');
select teste.ok(teste.linhas($$select public.mudar_senha_acesso('abc')$$) = -1, 'Senha de acesso curta demais é recusada');
select teste.ok(teste.linhas($$select public.mudar_senha_acesso('Nova#2026')$$) = 1, 'Administrador troca a senha de acesso');
reset role;
select teste.ok(teste.linhas($$insert into auth.users (email, raw_user_meta_data) values ('velha@x', '{"nome":"Velha","codigo":"L@@k"}')$$) = -1, 'Depois da troca, a senha antiga não cria conta');
select teste.ok(teste.linhas($$insert into auth.users (email, raw_user_meta_data) values ('nova2@x', '{"nome":"Nova Dois","codigo":"Nova#2026"}')$$) = 1, 'Depois da troca, a senha nova cria conta');
set role authenticated;
select teste.como('00000000-0000-0000-0000-0000000000aa');
select public.mudar_senha_acesso('L@@k');

-- Ligando tarefa ou projeto a algo que a pessoa não enxerga (para passar a ver)
reset role;
insert into projetos (id, nome) values ('20000000-0000-0000-0000-0000000000f1', 'Projeto secreto');
insert into clientes (id, nome) values ('10000000-0000-0000-0000-0000000000f1', 'Cliente secreto');
insert into permissoes values ('00000000-0000-0000-0000-0000000000cc', 'projetos', false, true, true, false, 'proprias');
update permissoes set criar = true where usuario_id = '00000000-0000-0000-0000-0000000000cc' and modulo = 'tarefas';
set role authenticated;
select teste.como('00000000-0000-0000-0000-0000000000cc');
select teste.ok(teste.linhas($$insert into tarefas (titulo, setor, projeto_id, responsavel_id) values ('Espiã', 'execucao', '20000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000cc')$$) = -1, 'Ataque: tarefa não entra num projeto que a pessoa não vê');
select teste.ok((select count(*) = 0 from projetos where id = '20000000-0000-0000-0000-0000000000f1'), 'O projeto secreto continua invisível');
select teste.ok(teste.linhas($$insert into projetos (nome, cliente_id) values ('Espião', '10000000-0000-0000-0000-0000000000f1')$$) = -1, 'Ataque: projeto não entra num cliente que a pessoa não vê');
select teste.ok(teste.linhas($$insert into tarefas (titulo, setor, responsavel_id) values ('Tarefa normal', 'execucao', '00000000-0000-0000-0000-0000000000cc')$$) = 1, 'Tarefa sem projeto continua sendo criada normalmente');
reset role;
delete from permissoes where usuario_id = '00000000-0000-0000-0000-0000000000cc' and modulo = 'projetos';
update permissoes set criar = false where usuario_id = '00000000-0000-0000-0000-0000000000cc' and modulo = 'tarefas';
update permissoes set ver = false where usuario_id = '00000000-0000-0000-0000-0000000000bb' and modulo = 'projetos';
set role authenticated;
select teste.como('00000000-0000-0000-0000-0000000000bb');
select teste.ok(teste.linhas($$update tarefas set projeto_id = '20000000-0000-0000-0000-0000000000f1' where id = '30000000-0000-0000-0000-000000000001'$$) = -1, 'Ataque: gerente não move tarefa para projeto invisível a ela');
select teste.ok(teste.linhas($$update tarefas set projeto_id = '20000000-0000-0000-0000-000000000001' where id = '30000000-0000-0000-0000-000000000001'$$) = 1, 'Gerente continua movendo tarefa entre projetos que vê');
reset role;
update permissoes set ver = true where usuario_id = '00000000-0000-0000-0000-0000000000bb' and modulo = 'projetos';
set role authenticated;

-- ---------------------------------------------------------------------
-- ANEXOS dos projetos (tabela + arquivos no Storage)
-- ---------------------------------------------------------------------
reset role;
insert into storage.buckets (id, name) values ('anexos', 'anexos') on conflict do nothing;
set role authenticated;
select teste.como('00000000-0000-0000-0000-0000000000aa');
select teste.ok(teste.linhas($$insert into anexos (id, projeto_id, nome, caminho, tipo, tamanho, enviado_por) values
  ('a0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Proposta Lotus.pdf', '20000000-0000-0000-0000-000000000001/a0000000-0000-0000-0000-000000000001.pdf', 'application/pdf', 120000, '00000000-0000-0000-0000-0000000000bb')$$) = 1, 'Admin anexa um PDF ao projeto');
select teste.ok((select enviado_por = '00000000-0000-0000-0000-0000000000aa' from anexos where id = 'a0000000-0000-0000-0000-000000000001'), 'Anexo fica no nome de quem enviou (não dá para pôr no nome de outro)');
select teste.ok(teste.linhas($$insert into storage.objects (bucket_id, name) values ('anexos', '20000000-0000-0000-0000-000000000001/a0000000-0000-0000-0000-000000000001.pdf')$$) = 1, 'Admin envia o arquivo do anexo registrado');
select teste.ok(teste.linhas($$insert into storage.objects (bucket_id, name) values ('anexos', '20000000-0000-0000-0000-000000000001/b0000000-0000-0000-0000-000000000009.pdf')$$) = -1, 'Ataque: arquivo sem anexo registrado não é aceito no depósito');
select teste.ok(teste.linhas($$insert into anexos (id, projeto_id, nome, caminho, tipo, tamanho) values
  ('a0000000-0000-0000-0000-0000000000f1', '20000000-0000-0000-0000-0000000000f1', 'Contrato secreto.pdf', '20000000-0000-0000-0000-0000000000f1/a0000000-0000-0000-0000-0000000000f1.pdf', 'application/pdf', 5000)$$) = 1, 'Admin anexa contrato no projeto secreto');
insert into storage.objects (bucket_id, name) values ('anexos', '20000000-0000-0000-0000-0000000000f1/a0000000-0000-0000-0000-0000000000f1.pdf');

-- Ataques no tipo, no tamanho e no lugar do arquivo
select teste.ok(teste.linhas($$insert into anexos (projeto_id, nome, caminho, tipo, tamanho) values ('20000000-0000-0000-0000-000000000001', 'pagina.html', '20000000-0000-0000-0000-000000000001/a0000000-0000-0000-0000-000000000002.html', 'text/html', 100)$$) = -1, 'Ataque: página HTML não é aceita como anexo');
select teste.ok(teste.linhas($$insert into anexos (projeto_id, nome, caminho, tipo, tamanho) values ('20000000-0000-0000-0000-000000000001', 'logo.svg', '20000000-0000-0000-0000-000000000001/a0000000-0000-0000-0000-000000000003.svg', 'image/svg+xml', 100)$$) = -1, 'Ataque: SVG (que pode carregar código) não é aceito');
select teste.ok(teste.linhas($$insert into anexos (projeto_id, nome, caminho, tipo, tamanho) values ('20000000-0000-0000-0000-000000000001', 'video.pdf', '20000000-0000-0000-0000-000000000001/a0000000-0000-0000-0000-000000000004.pdf', 'application/pdf', 30000000)$$) = -1, 'Arquivo acima de 20 MB é recusado');
select teste.ok(teste.linhas($$insert into anexos (projeto_id, nome, caminho, tipo, tamanho) values ('20000000-0000-0000-0000-000000000001', 'x.pdf', '20000000-0000-0000-0000-0000000000f1/a0000000-0000-0000-0000-000000000005.pdf', 'application/pdf', 100)$$) = -1, 'Ataque: arquivo não vai para a pasta de outro projeto');
select teste.ok(teste.linhas($$insert into anexos (projeto_id, nome, caminho, tipo, tamanho) values ('20000000-0000-0000-0000-000000000001', 'x.pdf', '20000000-0000-0000-0000-000000000001/../../perfis.pdf', 'application/pdf', 100)$$) = -1, 'Ataque: caminho com "../" é recusado');

-- Gerente (edita projetos, não apaga). Aqui ela não tem "ver todos os
-- projetos": enxerga o Rebranding só pela tarefa dela.
reset role;
update permissoes set ver = false where usuario_id = '00000000-0000-0000-0000-0000000000bb' and modulo = 'projetos';
set role authenticated;
select teste.como('00000000-0000-0000-0000-0000000000bb');
select teste.ok((select count(*) = 1 from anexos), 'Gerente vê só os anexos dos projetos que vê');
select teste.ok(teste.linhas($$select * from storage.objects where name like '20000000-0000-0000-0000-0000000000f1/%'$$) = 0, 'Gerente não lê o arquivo do projeto secreto');
select teste.ok(teste.linhas($$insert into anexos (id, projeto_id, nome, caminho, tipo, tamanho) values
  ('a0000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001', 'Moodboard.jpg', '20000000-0000-0000-0000-000000000001/a0000000-0000-0000-0000-000000000006.jpg', 'image/jpeg', 800000)$$) = 1, 'Gerente anexa imagem ao projeto');
select teste.ok(teste.linhas($$insert into storage.objects (bucket_id, name) values ('anexos', '20000000-0000-0000-0000-000000000001/a0000000-0000-0000-0000-000000000006.jpg')$$) = 1, 'Gerente envia o arquivo da imagem');
select teste.ok(teste.linhas($$insert into anexos (projeto_id, nome, caminho, tipo, tamanho) values ('20000000-0000-0000-0000-0000000000f1', 'x.pdf', '20000000-0000-0000-0000-0000000000f1/a0000000-0000-0000-0000-000000000007.pdf', 'application/pdf', 100)$$) = -1, 'Ataque: gerente não anexa em projeto que não vê');
select teste.ok(teste.linhas($$insert into storage.objects (bucket_id, name) values ('anexos', '20000000-0000-0000-0000-000000000001/a0000000-0000-0000-0000-000000000001.pdf')$$) = -1, 'Ataque: ninguém substitui o arquivo de outra pessoa');
select teste.ok(teste.linhas($$update storage.objects set name = name || 'x' where bucket_id = 'anexos'$$) = 0, 'Ataque: ninguém renomeia arquivos do depósito');
select teste.ok(teste.linhas($$update anexos set projeto_id = '20000000-0000-0000-0000-0000000000f1' where id = 'a0000000-0000-0000-0000-000000000006'$$) <= 0, 'Ataque: anexo não muda de projeto depois de enviado');
select teste.ok(teste.linhas($$delete from storage.objects where name = '20000000-0000-0000-0000-000000000001/a0000000-0000-0000-0000-000000000001.pdf'$$) = 0
  and teste.linhas($$delete from anexos where id = 'a0000000-0000-0000-0000-000000000001'$$) = 0, 'Gerente sem "apagar" não apaga anexo de outra pessoa');
select teste.ok(teste.linhas($$delete from storage.objects where name = '20000000-0000-0000-0000-000000000001/a0000000-0000-0000-0000-000000000006.jpg'$$) = 1
  and teste.linhas($$delete from anexos where id = 'a0000000-0000-0000-0000-000000000006'$$) = 1, 'Gerente apaga o anexo que ela mesma enviou');

reset role;
update permissoes set ver = true where usuario_id = '00000000-0000-0000-0000-0000000000bb' and modulo = 'projetos';
set role authenticated;

-- Freelancer (vê o projeto só pela tarefa dele, não edita projetos)
select teste.como('00000000-0000-0000-0000-0000000000cc');
select teste.ok((select count(*) = 1 from anexos) and (select count(*) = 1 from storage.objects), 'Freelancer vê os anexos do projeto da tarefa dele');
select teste.ok(teste.linhas($$insert into anexos (projeto_id, nome, caminho, tipo, tamanho) values ('20000000-0000-0000-0000-000000000001', 'x.pdf', '20000000-0000-0000-0000-000000000001/a0000000-0000-0000-0000-000000000008.pdf', 'application/pdf', 100)$$) = -1, 'Freelancer não anexa (não edita projetos)');
select teste.ok(teste.linhas($$delete from storage.objects where bucket_id = 'anexos'$$) = 0, 'Ataque: freelancer não apaga arquivos');

-- Conta nova, conta desativada e visitante sem login
select teste.como('00000000-0000-0000-0000-0000000000dd');
select teste.ok((select count(*) = 0 from anexos) and (select count(*) = 0 from storage.objects), 'Conta nova não vê anexos nem arquivos');
select teste.como('00000000-0000-0000-0000-0000000000ee');
select teste.ok((select count(*) = 0 from anexos) and (select count(*) = 0 from storage.objects), 'Conta desativada não vê anexos nem arquivos');
reset role;
set role anon;
select teste.como(null);
select teste.ok(teste.linhas($$select * from anexos$$) = -1 and teste.linhas($$select * from storage.objects$$) = 0, 'Ataque: visitante sem login não vê anexos nem arquivos');
reset role;
set role authenticated;

-- Apagar o projeto leva os anexos junto
select teste.como('00000000-0000-0000-0000-0000000000aa');
delete from storage.objects where name like '20000000-0000-0000-0000-0000000000f1/%';
select teste.ok(teste.linhas($$delete from projetos where id = '20000000-0000-0000-0000-0000000000f1'$$) = 1, 'Admin apaga o projeto secreto');
select teste.ok((select count(*) = 0 from anexos where projeto_id = '20000000-0000-0000-0000-0000000000f1'), 'Apagar o projeto apaga os anexos dele');

-- ---------------------------------------------------------------------
-- VÁRIOS RESPONSÁVEIS por tarefa
-- ---------------------------------------------------------------------
reset role;
delete from avisos;
set role authenticated;
select teste.como('00000000-0000-0000-0000-0000000000aa');
select teste.ok(teste.linhas($$insert into tarefas (id, titulo, setor, responsaveis) values ('30000000-0000-0000-0000-0000000000e1', 'Gravação a dois', 'execucao', array['00000000-0000-0000-0000-0000000000bb', '00000000-0000-0000-0000-0000000000cc', '00000000-0000-0000-0000-0000000000bb', null]::uuid[])$$) = 1, 'Admin cria tarefa com dois responsáveis');
select teste.ok((select responsaveis = array['00000000-0000-0000-0000-0000000000bb', '00000000-0000-0000-0000-0000000000cc']::uuid[] and responsavel_id = '00000000-0000-0000-0000-0000000000bb' from tarefas where id = '30000000-0000-0000-0000-0000000000e1'), 'Lista sem repetidos nem vazios, e o primeiro vira o responsável principal');
reset role;
select teste.ok((select count(*) = 2 from avisos where tarefa_id = '30000000-0000-0000-0000-0000000000e1'), 'Os dois responsáveis recebem aviso');
set role authenticated;

select teste.como('00000000-0000-0000-0000-0000000000cc');
select teste.ok((select count(*) = 1 from tarefas where id = '30000000-0000-0000-0000-0000000000e1'), 'Freelancer vê a tarefa em que é um dos responsáveis');
select teste.ok(teste.linhas($$update tarefas set status = 'fazendo' where id = '30000000-0000-0000-0000-0000000000e1'$$) = 1, 'Freelancer (um dos responsáveis) muda o status');
update tarefas set responsaveis = array['00000000-0000-0000-0000-0000000000cc']::uuid[] where id = '30000000-0000-0000-0000-0000000000e1';
select teste.ok((select responsaveis = array['00000000-0000-0000-0000-0000000000bb', '00000000-0000-0000-0000-0000000000cc']::uuid[] from tarefas where id = '30000000-0000-0000-0000-0000000000e1'), 'Ataque: freelancer sem "editar" não tira os outros responsáveis');

select teste.como('00000000-0000-0000-0000-0000000000aa');
reset role;
delete from avisos;
set role authenticated;
update tarefas set responsaveis = array['00000000-0000-0000-0000-0000000000bb', '00000000-0000-0000-0000-0000000000cc', '00000000-0000-0000-0000-0000000000aa']::uuid[] where id = '30000000-0000-0000-0000-0000000000e1';
update tarefas set responsaveis = array['00000000-0000-0000-0000-0000000000bb', '00000000-0000-0000-0000-0000000000cc', '00000000-0000-0000-0000-0000000000dd']::uuid[] where id = '30000000-0000-0000-0000-0000000000e1';
reset role;
select teste.ok((select array_agg(usuario_id) = array['00000000-0000-0000-0000-0000000000dd']::uuid[] from avisos where tarefa_id = '30000000-0000-0000-0000-0000000000e1'), 'Só quem entrou na lista recebe aviso (e o admin não avisa a si mesmo)');
delete from avisos;
set role authenticated;
select teste.ok(teste.linhas($$insert into comentarios (tarefa_id, texto) values ('30000000-0000-0000-0000-0000000000e1', 'Combinado o horário')$$) = 1, 'Admin comenta na tarefa de vários responsáveis');
reset role;
select teste.ok((select count(*) = 2 from avisos where tarefa_id = '30000000-0000-0000-0000-0000000000e1' and usuario_id in ('00000000-0000-0000-0000-0000000000bb', '00000000-0000-0000-0000-0000000000cc')), 'Comentário avisa todos os responsáveis que veem a tarefa');
select teste.ok((select count(*) = 0 from avisos where usuario_id = '00000000-0000-0000-0000-0000000000dd'), 'Conta sem liberação na lista não recebe o título da tarefa');
set role authenticated;

select teste.ok(teste.linhas($$update tarefas set responsaveis = array['00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-0000000000bb', '00000000-0000-0000-0000-0000000000cc', '00000000-0000-0000-0000-0000000000dd', '00000000-0000-0000-0000-0000000000ee', '00000000-0000-0000-0000-0000000000ff', '00000000-0000-0000-0000-0000000000aa']::uuid[] where id = '30000000-0000-0000-0000-0000000000e1'$$) = 1, 'Lista com 6 pessoas (e um repetido) é aceita');
select teste.ok(teste.linhas($$update tarefas set responsaveis = array(select gen_random_uuid() from generate_series(1, 11)) where id = '30000000-0000-0000-0000-0000000000e1'$$) = -1, 'Mais de 10 responsáveis é recusado');
select teste.ok(teste.linhas($$update tarefas set responsaveis = array[gen_random_uuid()] where id = '30000000-0000-0000-0000-0000000000e1'$$) = -1, 'Ataque: responsável que não existe na equipe é recusado');
select teste.ok(teste.linhas($$update tarefas set responsavel_id = '00000000-0000-0000-0000-0000000000cc' where id = '30000000-0000-0000-0000-0000000000e1'$$) = 1, 'Tela antiga (só um responsável) continua salvando');
select teste.ok((select responsaveis = array['00000000-0000-0000-0000-0000000000cc']::uuid[] from tarefas where id = '30000000-0000-0000-0000-0000000000e1'), 'Tela antiga troca a lista pela pessoa escolhida');
select teste.ok(teste.linhas($$update tarefas set responsaveis = '{}' where id = '30000000-0000-0000-0000-0000000000e1'$$) = 1, 'Tarefa pode ficar sem responsável');
select teste.ok((select responsavel_id is null from tarefas where id = '30000000-0000-0000-0000-0000000000e1'), 'Sem lista, o responsável principal fica vazio');

-- Gerente (escopo setor) com tarefa de outro setor em que ela é uma das responsáveis
select teste.ok(teste.linhas($$insert into tarefas (id, titulo, setor, responsaveis) values ('30000000-0000-0000-0000-0000000000e2', 'Reunião comercial', 'comercial', array['00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-0000000000bb']::uuid[])$$) = 1, 'Admin cria tarefa do comercial com a gerente junto');
select teste.como('00000000-0000-0000-0000-0000000000bb');
select teste.ok((select count(*) = 1 from tarefas where id = '30000000-0000-0000-0000-0000000000e2'), 'Gerente vê tarefa de outro setor por ser uma das responsáveis');
select teste.como('00000000-0000-0000-0000-0000000000aa');

-- Atualização do banco antigo: tarefas só com responsavel_id ganham a lista
reset role;
alter table tarefas disable trigger user;
update tarefas set responsaveis = '{}' where id = '30000000-0000-0000-0000-000000000001';
alter table tarefas enable trigger user;
delete from avisos;
\ir ../supabase/schema.sql
\o /dev/null
select teste.ok((select responsaveis = array['00000000-0000-0000-0000-0000000000bb']::uuid[] from tarefas where id = '30000000-0000-0000-0000-000000000001'), 'Rodar o schema novo copia o responsável antigo para a lista');
select teste.ok((select count(*) = 0 from avisos), 'A cópia não gera avisos repetidos');
set role authenticated;

-- ---------------------------------------------------------------------
-- BRIEFING DO CLIENTE (link sem login)
-- ---------------------------------------------------------------------
reset role;
delete from avisos;
set role authenticated;
select teste.como('00000000-0000-0000-0000-0000000000aa');
select teste.ok((select bool_and(briefing = 'dispensado') from projetos), 'Projetos que já existiam não pedem briefing');
select teste.ok(teste.linhas($$insert into projetos (id, cliente_id, nome, briefing) values ('20000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-000000000001', 'Site novo', 'aguardando')$$) = 1, 'Admin cria projeto aguardando briefing');
select teste.ok(teste.linhas($$insert into tarefas (titulo, setor, projeto_id) values ('Criar layout', 'criacao', '20000000-0000-0000-0000-0000000000b1')$$) = 1, 'Projeto aguardando briefing aceita tarefas (só alerta, não trava)');

insert into briefings (id, projeto_id, modelo, titulo, perguntas, token, status, respostas)
  values ('40000000-0000-0000-0000-0000000000b1', '20000000-0000-0000-0000-0000000000b1', 'marca', 'Briefing de marca', '{"secoes": []}', 'aaaa', 'recebido', '{"s1p1": "falso"}');
select teste.ok((select token ~ '^[0-9a-f]{64}$' and token <> 'aaaa' from briefings where id = '40000000-0000-0000-0000-0000000000b1'), 'O banco sorteia o link do briefing (não aceita um escolhido)');
select teste.ok((select status = 'aguardando' and respostas is null from briefings where id = '40000000-0000-0000-0000-0000000000b1'), 'Briefing nasce aguardando e sem respostas');
select teste.ok(teste.linhas($$update briefings set respostas = '{"s1p1": "mudei"}' where id = '40000000-0000-0000-0000-0000000000b1'$$) <= 0, 'Ataque: equipe não muda respostas do briefing');
select teste.ok(teste.linhas($$update briefings set token = repeat('a', 64) where id = '40000000-0000-0000-0000-0000000000b1'$$) <= 0, 'Ataque: equipe não troca o link do briefing');

select teste.como('00000000-0000-0000-0000-0000000000cc');
select teste.ok((select count(*) = 0 from briefings), 'Freelancer não vê briefings');
select teste.ok(teste.linhas($$insert into briefings (projeto_id, modelo, titulo, perguntas) values ('20000000-0000-0000-0000-0000000000b1', 'marca', 'x', '{}')$$) = -1, 'Freelancer não gera link de briefing');
select teste.como('00000000-0000-0000-0000-0000000000bb');
select teste.ok((select count(*) = 1 from briefings where id = '40000000-0000-0000-0000-0000000000b1'), 'Gerente (vê projetos) acompanha o briefing');
select teste.como('00000000-0000-0000-0000-0000000000aa');

-- Cliente (visitante sem login) com o link
reset role;
create temp table link as select token from briefings where id = '40000000-0000-0000-0000-0000000000b1';
grant select on link to anon;
set role anon;
select teste.como(null);
select teste.ok(teste.linhas($$select * from briefings$$) = -1, 'Ataque: visitante não lê a tabela de briefings');
select teste.ok((select public.briefing_abrir((select token from link)) ->> 'cliente' = 'Lotus Games'), 'Cliente abre o briefing pelo link');
select teste.ok((select public.briefing_abrir(repeat('0', 64)) is null), 'Link errado não abre nada');
select teste.ok((select public.briefing_abrir('x'' or 1=1 --') is null), 'Ataque: link com código não abre nada');
select teste.ok(teste.linhas($$select public.briefing_enviar((select token from link), '{"s1p1": {"x": 1}}'::jsonb)$$) = -1, 'Ataque: resposta que não é texto é recusada');
select teste.ok(teste.linhas($$select public.briefing_enviar((select token from link), jsonb_build_object('s1p1', repeat('a', 10001)))$$) = -1, 'Ataque: resposta gigante é recusada');
select teste.ok(teste.linhas($$select public.briefing_enviar((select token from link), '{"<script>": "x"}'::jsonb)$$) = -1, 'Ataque: nome de pergunta inventado é recusado');
select teste.ok(teste.linhas($$select public.briefing_enviar(repeat('0', 64), '{"s1p1": "x"}'::jsonb)$$) = -1, 'Link errado não envia nada');
select teste.ok(teste.linhas($$select public.briefing_enviar((select token from link), '{"s1p1": "Lotus Games", "s1p2": ["Instagram", "Site"], "s2p1": "<img src=x onerror=alert(1)>"}'::jsonb)$$) = 1, 'Cliente envia o briefing pelo link');
select teste.ok(teste.linhas($$select public.briefing_enviar((select token from link), '{"s1p1": "de novo"}'::jsonb)$$) = -1, 'Briefing já enviado não é sobrescrito');
select teste.ok((select public.briefing_abrir((select token from link)) ->> 'status' = 'recebido' and public.briefing_abrir((select token from link)) -> 'perguntas' = 'null'::jsonb), 'Depois de enviado, o link só diz que foi recebido');
reset role;
select teste.ok((select respostas ->> 's1p1' = 'Lotus Games' and recebido_em is not null from briefings where id = '40000000-0000-0000-0000-0000000000b1'), 'Respostas ficam guardadas no briefing');
select teste.ok((select briefing = 'recebido' from projetos where id = '20000000-0000-0000-0000-0000000000b1'), 'Projeto passa para "briefing recebido"');
select teste.ok((select count(*) >= 1 from avisos where usuario_id = '00000000-0000-0000-0000-0000000000aa' and texto = 'Briefing recebido: Lotus Games · Site novo' and projeto_id = '20000000-0000-0000-0000-0000000000b1'), 'Admin recebe aviso do briefing');
set role authenticated;
select teste.como('00000000-0000-0000-0000-0000000000aa');
select teste.como('00000000-0000-0000-0000-0000000000bb');
select teste.ok(teste.linhas($$delete from briefings where id = '40000000-0000-0000-0000-0000000000b1'$$) = 0, 'Gerente (sem apagar projetos) não apaga briefing já respondido');
select teste.como('00000000-0000-0000-0000-0000000000aa');
select teste.ok(teste.linhas($$insert into briefings (projeto_id, modelo, titulo, perguntas) values ('20000000-0000-0000-0000-0000000000b1', 'marca', 'x', to_jsonb(repeat('a', 300000)))$$) = -1, 'Ataque: modelo de briefing gigante é recusado');

-- ---------------------------------------------------------------------
-- Finanças: pessoal (só o dono) e empresa (permissão "financeiro")
-- ---------------------------------------------------------------------
set role authenticated;
select teste.como('00000000-0000-0000-0000-0000000000bb');
select teste.ok(teste.linhas($$insert into lancamentos (id, escopo, tipo, descricao, valor) values ('50000000-0000-0000-0000-000000000001', 'pessoal', 'saida', 'Aluguel', 1200)$$) = 1, 'Qualquer pessoa da equipe cria lançamento pessoal');
select teste.ok(teste.linhas($$insert into lancamentos (id, escopo, dono_id, tipo, descricao, valor) values ('50000000-0000-0000-0000-000000000002', 'pessoal', '00000000-0000-0000-0000-0000000000aa', 'saida', 'Mercado', 300)$$) = 1, 'Lançamento pessoal criado em nome de outro...');
select teste.ok((select dono_id = '00000000-0000-0000-0000-0000000000bb' from lancamentos where id = '50000000-0000-0000-0000-000000000002'), '...fica com quem criou (não dá para pôr na conta de outra pessoa)');
select teste.ok(teste.linhas($$insert into lancamentos (escopo, tipo, descricao, valor) values ('empresa', 'entrada', 'Mensalidade', 500)$$) = -1, 'Sem permissão de finanças, não lança no caixa da empresa');
select teste.ok(teste.linhas($$insert into lancamentos (escopo, tipo, descricao, valor, projeto_id) values ('pessoal', 'saida', 'x', 10, '20000000-0000-0000-0000-000000000001')$$) = -1, 'Lançamento pessoal não se liga a projeto da empresa');
select teste.ok(teste.linhas($$insert into lancamentos (escopo, tipo, descricao, valor) values ('pessoal', 'saida', 'x', -10)$$) = -1, 'Valor negativo ou zero é recusado');
select teste.ok(teste.linhas($$insert into lancamentos (escopo, tipo, descricao, valor) values ('pessoal', 'saida', '  ', 10)$$) = -1, 'Lançamento sem descrição é recusado');
select teste.ok(teste.linhas($$insert into lancamentos (escopo, tipo, descricao, valor) values ('pessoal', 'emprestimo', 'x', 10)$$) = -1, 'Tipo inventado é recusado');
update lancamentos set escopo = 'empresa', dono_id = '00000000-0000-0000-0000-0000000000aa' where id = '50000000-0000-0000-0000-000000000001';
select teste.ok((select escopo = 'pessoal' and dono_id = '00000000-0000-0000-0000-0000000000bb' from lancamentos where id = '50000000-0000-0000-0000-000000000001'), 'Ataque: não dá para passar o lançamento pessoal para a empresa nem para outra pessoa');
select teste.ok(teste.linhas($$update lancamentos set valor = 1250, pago = false where id = '50000000-0000-0000-0000-000000000001'$$) = 1, 'Dono edita o próprio lançamento pessoal');

select teste.como('00000000-0000-0000-0000-0000000000aa');
select teste.ok((select count(*) = 0 from lancamentos where dono_id = '00000000-0000-0000-0000-0000000000bb'), 'Nem o administrador vê as finanças pessoais dos outros');
select teste.ok(teste.linhas($$update lancamentos set valor = 1 where id = '50000000-0000-0000-0000-000000000001'$$) = 0, 'Administrador não muda lançamento pessoal de outra pessoa');
select teste.ok(teste.linhas($$delete from lancamentos where id = '50000000-0000-0000-0000-000000000001'$$) = 0, 'Administrador não apaga lançamento pessoal de outra pessoa');
select teste.ok(teste.linhas($$insert into lancamentos (id, escopo, tipo, descricao, valor, cliente_id, projeto_id) values ('50000000-0000-0000-0000-000000000003', 'empresa', 'entrada', 'Rebranding Lotus (1ª parcela)', 2500, '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001')$$) = 1, 'Administrador lança no caixa da empresa, ligado a cliente e projeto');
select teste.ok(teste.linhas($$insert into lancamentos (id, escopo, tipo, descricao, valor) values ('50000000-0000-0000-0000-000000000004', 'pessoal', 'entrada', 'Pró-labore', 3000)$$) = 1, 'Administrador também tem a própria aba pessoal');
insert into permissoes values ('00000000-0000-0000-0000-0000000000bb', 'financeiro', true, false, false, false, 'proprias'),
  ('00000000-0000-0000-0000-0000000000cc', 'financeiro', true, true, false, false, 'proprias');

select teste.como('00000000-0000-0000-0000-0000000000bb');
select teste.ok((select count(*) = 1 from lancamentos where escopo = 'empresa'), 'Com permissão de ver finanças, vê o caixa da empresa');
select teste.ok((select count(*) = 0 from lancamentos where escopo = 'pessoal' and dono_id = '00000000-0000-0000-0000-0000000000aa'), 'Ver o caixa da empresa não mostra as contas pessoais do administrador');
select teste.ok(teste.linhas($$insert into lancamentos (escopo, tipo, descricao, valor) values ('empresa', 'saida', 'Adobe', 120)$$) = -1, 'Só com "ver", não lança no caixa da empresa');
select teste.ok(teste.linhas($$update lancamentos set valor = 1 where id = '50000000-0000-0000-0000-000000000003'$$) = 0, 'Só com "ver", não muda o caixa da empresa');
select teste.ok(teste.linhas($$delete from lancamentos where id = '50000000-0000-0000-0000-000000000003'$$) = 0, 'Só com "ver", não apaga do caixa da empresa');

select teste.como('00000000-0000-0000-0000-0000000000cc');
select teste.ok(teste.linhas($$insert into lancamentos (escopo, tipo, descricao, valor, cliente_id) values ('empresa', 'entrada', 'x', 10, '10000000-0000-0000-0000-000000000002')$$) = -1, 'Ataque: não liga lançamento a cliente que a pessoa não enxerga');
select teste.ok(teste.linhas($$insert into lancamentos (escopo, tipo, descricao, valor) values ('empresa', 'saida', 'Cartão de memória', 90)$$) = 1, 'Com permissão de criar, lança no caixa da empresa');
select teste.ok((select count(*) = 0 from lancamentos where escopo = 'pessoal'), 'Quem não lançou nada pessoal não vê nenhuma conta pessoal');

select teste.como('00000000-0000-0000-0000-0000000000ee');
select teste.ok(teste.linhas($$insert into lancamentos (escopo, tipo, descricao, valor) values ('pessoal', 'saida', 'x', 10)$$) = -1, 'Conta desativada não lança nada');

-- Nota fiscal no lançamento da empresa
select teste.como('00000000-0000-0000-0000-0000000000aa');
select teste.ok(teste.linhas($$update lancamentos set nf_numero = '2026/123', nf_nome = 'nota.pdf', nf_caminho = '50000000-0000-0000-0000-000000000003/c0000000-0000-0000-0000-000000000001.pdf' where id = '50000000-0000-0000-0000-000000000003'$$) = 1, 'Admin registra a nota fiscal no lançamento da empresa');
select teste.ok(teste.linhas($$insert into storage.objects (bucket_id, name) values ('notas', '50000000-0000-0000-0000-000000000003/c0000000-0000-0000-0000-000000000001.pdf')$$) = 1, 'Admin envia o arquivo da nota');
select teste.ok(teste.linhas($$insert into storage.objects (bucket_id, name) values ('notas', '50000000-0000-0000-0000-000000000003/c0000000-0000-0000-0000-000000000009.pdf')$$) = -1, 'Ataque: arquivo de nota sem registro no lançamento não é aceito');
select teste.ok(teste.linhas($$update lancamentos set nf_caminho = '50000000-0000-0000-0000-000000000004/c0000000-0000-0000-0000-000000000002.pdf' where id = '50000000-0000-0000-0000-000000000003'$$) = -1, 'Ataque: nota não aponta para a pasta de outro lançamento');
select teste.ok(teste.linhas($$update lancamentos set nf_caminho = '50000000-0000-0000-0000-000000000004/c0000000-0000-0000-0000-000000000002.pdf' where id = '50000000-0000-0000-0000-000000000004'$$) = -1, 'Lançamento pessoal não guarda arquivo de nota');
select teste.ok(teste.linhas($$update lancamentos set nf_caminho = '50000000-0000-0000-0000-000000000003/c0000000-0000-0000-0000-000000000003.exe' where id = '50000000-0000-0000-0000-000000000003'$$) = -1, 'Ataque: nota só aceita PDF ou foto');

select teste.como('00000000-0000-0000-0000-0000000000bb');
select teste.ok((select count(*) = 1 from storage.objects where bucket_id = 'notas'), 'Quem vê o caixa da empresa abre a nota');
select teste.ok(teste.linhas($$delete from storage.objects where bucket_id = 'notas'$$) = 0, 'Só com "ver", não apaga a nota');

select teste.como('00000000-0000-0000-0000-0000000000dd');
select teste.ok((select count(*) = 0 from storage.objects where bucket_id = 'notas'), 'Sem permissão de finanças, não abre nenhuma nota');

select teste.como('00000000-0000-0000-0000-0000000000cc');
select teste.ok(teste.linhas($$insert into lancamentos (id, escopo, tipo, descricao, valor, nf_numero, nf_caminho) values ('50000000-0000-0000-0000-000000000005', 'empresa', 'entrada', 'Diária de gravação', 800, '45', '50000000-0000-0000-0000-000000000005/c0000000-0000-0000-0000-000000000005.png')$$) = 1, 'Quem pode criar lança a entrada já com a nota');
select teste.ok(teste.linhas($$insert into storage.objects (bucket_id, name) values ('notas', '50000000-0000-0000-0000-000000000005/c0000000-0000-0000-0000-000000000005.png')$$) = 1, '...e envia o arquivo da nota que acabou de lançar');
select teste.ok(teste.linhas($$insert into storage.objects (bucket_id, name) values ('notas', '50000000-0000-0000-0000-000000000003/c0000000-0000-0000-0000-000000000001.pdf')$$) = -1, 'Ataque: não substitui o arquivo de nota de outra pessoa');
select teste.ok(teste.linhas($$delete from storage.objects where bucket_id = 'notas'$$) = 0, 'Sem editar nem apagar, não apaga nota');

select teste.como('00000000-0000-0000-0000-0000000000aa');
select teste.ok(teste.linhas($$delete from storage.objects where name = '50000000-0000-0000-0000-000000000005/c0000000-0000-0000-0000-000000000005.png'$$) = 1, 'Admin apaga o arquivo da nota');

select teste.como('00000000-0000-0000-0000-0000000000bb');
select teste.ok(teste.linhas($$delete from lancamentos where id = '50000000-0000-0000-0000-000000000002'$$) = 1, 'Dono apaga o próprio lançamento pessoal');
reset role;
set role anon;
select teste.como(null);
select teste.ok(teste.linhas($$select * from lancamentos$$) = -1, 'Ataque: visitante sem login não lê nenhuma finança');
reset role;
set role authenticated;
select teste.como('00000000-0000-0000-0000-0000000000aa');

-- ---------------------------------------------------------------------
-- Orçamentos (permissão "comercial")
-- ---------------------------------------------------------------------
set role authenticated;
select teste.como('00000000-0000-0000-0000-0000000000aa');
select teste.ok(teste.linhas($$insert into orcamentos (id, numero, titulo, cliente_id, dados, total_unico) values ('60000000-0000-0000-0000-000000000001', '1999-999', 'Rebranding', '10000000-0000-0000-0000-000000000001', '{"itens": []}', 3000)$$) = 1, 'Admin cria orçamento');
select teste.ok((select numero = to_char(now() at time zone 'America/Sao_Paulo', 'YYYY') || '-001' and status = 'rascunho' from orcamentos where id = '60000000-0000-0000-0000-000000000001'), 'O banco dá o número do orçamento (não aceita um escolhido)');
select teste.ok(teste.linhas($$insert into orcamentos (id, titulo) values ('60000000-0000-0000-0000-000000000002', 'Vídeos')$$) = 1, 'Segundo orçamento...');
select teste.ok((select numero = to_char(now() at time zone 'America/Sao_Paulo', 'YYYY') || '-002' from orcamentos where id = '60000000-0000-0000-0000-000000000002'), '...ganha o número seguinte');
update orcamentos set numero = '2000-001', status = 'enviado' where id = '60000000-0000-0000-0000-000000000001';
select teste.ok((select numero = to_char(now() at time zone 'America/Sao_Paulo', 'YYYY') || '-001' and status = 'enviado' from orcamentos where id = '60000000-0000-0000-0000-000000000001'), 'Status muda, mas o número do orçamento nunca muda');
select teste.ok(teste.linhas($$update orcamentos set status = 'perdido' where id = '60000000-0000-0000-0000-000000000001'$$) = -1, 'Status inventado é recusado');
select teste.ok(teste.linhas($$update orcamentos set total_unico = -5 where id = '60000000-0000-0000-0000-000000000001'$$) = -1, 'Total negativo é recusado');
select teste.ok(teste.linhas($$update orcamentos set lancamento_id = '50000000-0000-0000-0000-000000000004' where id = '60000000-0000-0000-0000-000000000001'$$) = -1, 'Ataque: orçamento não se liga a lançamento pessoal');
select teste.ok(teste.linhas($$update orcamentos set status = 'aprovado', lancamento_id = '50000000-0000-0000-0000-000000000003' where id = '60000000-0000-0000-0000-000000000001'$$) = 1, 'Orçamento aprovado fica ligado à entrada no caixa da empresa');

select teste.como('00000000-0000-0000-0000-0000000000bb');
select teste.ok((select count(*) = 0 from orcamentos), 'Sem permissão comercial, não vê orçamentos');
select teste.ok(teste.linhas($$insert into orcamentos (titulo) values ('x')$$) = -1, 'Sem permissão comercial, não cria orçamento');
select teste.como('00000000-0000-0000-0000-0000000000aa');
insert into permissoes values ('00000000-0000-0000-0000-0000000000bb', 'comercial', true, true, false, false, 'proprias');
select teste.como('00000000-0000-0000-0000-0000000000bb');
select teste.ok((select count(*) = 2 from orcamentos), 'Com permissão comercial, vê os orçamentos');
select teste.ok(teste.linhas($$insert into orcamentos (titulo) values ('Cardápio')$$) = 1, 'Com "criar", faz orçamento novo');
select teste.ok(teste.linhas($$update orcamentos set status = 'recusado' where id = '60000000-0000-0000-0000-000000000002'$$) = 0, 'Sem "editar", não muda orçamento');
select teste.ok(teste.linhas($$delete from orcamentos where id = '60000000-0000-0000-0000-000000000002'$$) = 0, 'Sem "apagar", não apaga orçamento');
select teste.ok(teste.linhas($$insert into orcamentos (titulo, dados) values ('x', to_jsonb(repeat('a', 300000)))$$) = -1, 'Ataque: orçamento gigante é recusado');
select teste.como('00000000-0000-0000-0000-0000000000aa');
select teste.ok(teste.linhas($$delete from orcamentos where id = '60000000-0000-0000-0000-000000000002'$$) = 1, 'Admin apaga orçamento');
reset role;
set role anon;
select teste.como(null);
select teste.ok(teste.linhas($$select * from orcamentos$$) = -1, 'Ataque: visitante sem login não lê orçamentos');
reset role;
set role authenticated;
select teste.como('00000000-0000-0000-0000-0000000000aa');

-- Visitante sem login chamando as funções do banco direto pela API
reset role;
set role anon;
select teste.como(null);
select teste.ok(teste.linhas($$select public.pode('tarefas', 'ver')$$) = -1, 'Ataque: visitante sem login não chama funções do banco');
select teste.ok(teste.linhas($$select * from public.modulos$$) = -1, 'Ataque: visitante sem login não lê nem o catálogo de módulos');
select teste.ok((select public.ping() = 'ok'), 'Robô que mantém o banco ativo consegue dar o "oi"');
-- ---------------------------------------------------------------------
reset role;
\o
\set QUIET 0
\pset footer off
select n, case when ok then 'OK     ' else 'FALHOU ' end as resultado, nome, detalhe from teste.resultado order by n;
select count(*) filter (where ok) as passaram, count(*) filter (where not ok) as falharam from teste.resultado;
