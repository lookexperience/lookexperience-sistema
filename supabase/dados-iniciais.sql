-- =====================================================================
-- Dados iniciais da LOOK: clientes, projetos e a lista de tarefas que
-- estava no Claude (LOOK: Lista de tarefas, 30/10/2026).
--
-- Como usar: depois de rodar o schema.sql e de criar a conta do
-- administrador, cole este arquivo no SQL Editor do Supabase e clique em
-- "Run". Tudo fica no nome do primeiro administrador, como responsável.
-- Pode rodar de novo: o que já existe (mesmo nome) não é duplicado.
-- =====================================================================

create or replace function pg_temp.admin_id() returns uuid language sql as $$
  select id from public.perfis where admin and ativo order by criado_em limit 1;
$$;

create or replace function pg_temp.cliente(p_nome text, p_cor text, p_contato text default '', p_obs text default '') returns uuid
language plpgsql as $$
declare v uuid;
begin
  select id into v from public.clientes where lower(nome) = lower(p_nome);
  if v is null then
    insert into public.clientes (nome, cor, contato, observacoes, criado_por)
    values (p_nome, p_cor, p_contato, p_obs, pg_temp.admin_id()) returning id into v;
  end if;
  return v;
end $$;

create or replace function pg_temp.projeto(p_cliente uuid, p_nome text, p_tipo text default '', p_status text default 'ativo', p_desc text default '') returns uuid
language plpgsql as $$
declare v uuid;
begin
  select id into v from public.projetos where cliente_id is not distinct from p_cliente and lower(nome) = lower(p_nome);
  if v is null then
    insert into public.projetos (cliente_id, nome, tipo, status, descricao, criado_por)
    values (p_cliente, p_nome, p_tipo, p_status, p_desc, pg_temp.admin_id()) returning id into v;
  end if;
  return v;
end $$;

-- Ordem: cada tarefa nova vai para o fim da coluna.
create or replace function pg_temp.tarefa(p_projeto uuid, p_titulo text, p_setor text, p_status text default 'a_fazer',
  p_desc text default '', p_prazo date default null, p_tipo text default 'tarefa') returns void
language plpgsql as $$
begin
  if not exists (select 1 from public.tarefas where projeto_id is not distinct from p_projeto and lower(titulo) = lower(p_titulo)) then
    insert into public.tarefas (projeto_id, titulo, setor, status, descricao, prazo, tipo, responsavel_id, criado_por, ordem)
    values (p_projeto, p_titulo, p_setor, p_status, p_desc, p_prazo, p_tipo, pg_temp.admin_id(), pg_temp.admin_id(),
            coalesce((select max(ordem) + 1 from public.tarefas where status = p_status), 0));
  end if;
end $$;

do $$
declare
  inicio timestamptz := now();
  c uuid; pr uuid;
begin
  if pg_temp.admin_id() is null then
    raise exception 'Crie a conta do administrador no sistema antes de importar os dados.';
  end if;

  -- ---------------- Clientes com trabalho em andamento ----------------
  c := pg_temp.cliente('Lotus Games', '#7A6BB5', '', 'Loja de card games. Rebranding: lótus roxa vetorizada, nome na base da flor, paleta roxo noite, lilás e pêssego com detalhe dourado.');
  pr := pg_temp.projeto(c, 'Gestão de marca nas redes', 'Rebranding + conteúdo mensal', 'ativo',
    'Instagram primeiro: 4 posts e 4 reels por mês (card games, mundo geek, curiosidades, produtos), gestão do perfil, campanhas, relatório e reunião de alinhamento. Rebranding e padronização no início. Duração do contrato em aberto.');
  perform pg_temp.tarefa(pr, 'Fechamento: definir valor mensal e duração, enviar resumo por escrito e coletar dados para o contrato', 'comercial');
  perform pg_temp.tarefa(pr, 'Contrato: gerar no modelo LOOK, assinar pelo gov.br e receber o primeiro pagamento', 'comercial');
  perform pg_temp.tarefa(pr, 'Briefing: kit de boas-vindas, questionário, acesso ao Instagram pelo Meta Business Suite, kickoff e relatório de briefing', 'criacao');
  perform pg_temp.tarefa(pr, 'Rebranding: fechar a cor do nome e o final da medalha, conferir os fatos dos posts de exemplo', 'criacao');
  perform pg_temp.tarefa(pr, 'Planejamento: cronograma do rebranding, calendário editorial do 1º mês e frequência das campanhas', 'criacao');
  perform pg_temp.tarefa(pr, 'Rotina: fixar as datas do relatório mensal e da reunião de alinhamento', 'comercial');

  c := pg_temp.cliente('Flambé', '#C2574A', '', 'Restaurante elegante de esfihas e vinhos. Paleta proposta: Bordeaux #5C0F1E, Vermelho Sangue #8B1A1A, Âmbar #D9822B (5%), Creme #F3E9DC, Carvão #1A1412, Dourado #B08D57 opcional.');
  pr := pg_temp.projeto(c, 'Identidade visual', 'Identidade visual');
  perform pg_temp.tarefa(pr, 'Direção, tipografia e símbolo', 'criacao');

  c := pg_temp.cliente('Fusion Soldas', '#D08C3C');
  pr := pg_temp.projeto(c, 'Landing page', 'Site');
  perform pg_temp.tarefa(pr, 'Criar a landing page da Fusion Soldas', 'criacao');

  c := pg_temp.cliente('Ketlin Joias', '#B5638F', 'Ketlin (prima)');
  pr := pg_temp.projeto(c, 'Nova identidade visual', 'Identidade visual');
  perform pg_temp.tarefa(pr, 'Criar a nova identidade visual', 'criacao');

  c := pg_temp.cliente('Gelateria Perino', '#B9A44C');
  pr := pg_temp.projeto(c, 'Apresentação da LOOK', 'Proposta');
  perform pg_temp.tarefa(pr, 'Criar o projeto de apresentação', 'criacao', 'fazendo');
  perform pg_temp.tarefa(pr, 'Entrar em contato com a Gelateria Perino', 'comercial');

  c := pg_temp.cliente('Massa FM', '#4F7FB8', '', 'Rádio Massa. A LOOK tem permuta com a rádio e revende pacotes de inserções.');
  pr := pg_temp.projeto(c, 'Marketing mensal', 'Marketing');
  perform pg_temp.tarefa(pr, 'Feedback e análises do fechamento do mês, e passar novas ideias', 'comercial');
  perform pg_temp.tarefa(pr, 'Criar a apresentação de fechamento mensal', 'criacao');

  c := pg_temp.cliente('Exatas Contabilidade', '#4E9A8E', '', 'Proposta de pacote de rádio pela permuta com a Rádio Massa: R$ 700 por mês, 72 inserções ou 1 testemunhal por dia, com entrevista de brinde. Sem prazo mínimo, proposta válida por 30 dias.');
  perform pg_temp.projeto(c, 'Pacote Rádio Massa', 'Rádio', 'ativo', 'Apresentação enviada em 29/10/2026. O cliente escolhe inserções ou testemunhal, manda as informações, a LOOK escreve o texto e o cliente aprova antes de ir ao ar.');

  c := pg_temp.cliente('Hotel Pousada Ourinhos', '#4E9A8E');
  perform pg_temp.projeto(c, 'Logo vetorizado', 'Identidade visual', 'concluido', 'Logo refeito em vetor em 22/10/2026 (SVG e PNG), arquivos em clientes/hotel-pousada-ourinhos/logo/.');

  c := pg_temp.cliente('Condomínio da Gi', '#6F9A5B');
  pr := pg_temp.projeto(c, 'Toldo', 'Projeto');
  perform pg_temp.tarefa(pr, 'Criar o projeto de toldo (fotos do local em clientes/condominio-gi/toldo/fotos/)', 'criacao');

  -- ---------------- Contatos em prospecção ----------------
  c := pg_temp.cliente('Valter Vidros', '#8C8C94');
  pr := pg_temp.projeto(c, 'Prospecção', 'Comercial');
  perform pg_temp.tarefa(pr, 'Marcar reunião com a Valter Vidros', 'comercial', 'a_fazer', '', null, 'reuniao');

  c := pg_temp.cliente('Tropical Bronze Ourinhos', '#D08C3C');
  pr := pg_temp.projeto(c, 'Prospecção', 'Comercial');
  perform pg_temp.tarefa(pr, 'Entrar em contato: a fachada está feia e dá para indicar mais serviços', 'comercial');

  c := pg_temp.cliente('Cristian Billy Bear', '#B8955A');
  pr := pg_temp.projeto(c, 'Proposta', 'Comercial');
  perform pg_temp.tarefa(pr, 'Pensar e montar a proposta', 'comercial');

  c := pg_temp.cliente('Rei dos Pod', '#7A6BB5', 'Kelvin');
  pr := pg_temp.projeto(c, 'Pacote de rádio', 'Rádio');
  perform pg_temp.tarefa(pr, 'Dar retorno sobre a rádio ao Kelvin', 'comercial');

  -- ---------------- Tarefas internas da LOOK (sem cliente) ----------------
  perform pg_temp.tarefa(null, 'Escolher a frase da marca: "Entenda. Escolha. Expanda." ou "VEJA. ESCOLHA. CONTE."', 'criacao');
  perform pg_temp.tarefa(null, 'Textos do site e projetos do carrossel (depois da frase)', 'criacao');
  perform pg_temp.tarefa(null, 'Google Search Console (opcional)', 'execucao');
  perform pg_temp.tarefa(null, 'Refazer a prancha "Direção de Cor e Tipografia" com os logos oficiais', 'criacao');
  perform pg_temp.tarefa(null, 'Pós-reunião: escolher qual modelo fazer primeiro (contrato, kit de boas-vindas, relatório de briefing, calendário editorial, relatório mensal)', 'comercial');
  perform pg_temp.tarefa(null, 'Trocar os sons ❔/⛔ da biblioteca antes de usar em trabalho de cliente', 'execucao');
  perform pg_temp.tarefa(null, 'Formato do questionário de briefing online (Google Forms / Tally / Jotform)', 'comercial');
  perform pg_temp.tarefa(null, 'Menino do adubo (não iniciado)', 'comercial');
  perform pg_temp.tarefa(null, 'Venda da moto + vídeos', 'execucao');
  perform pg_temp.tarefa(null, 'Analisar proposta da Z1000 2011 na troca da BMW S1000 (Z1000 com 45 mil km rodados)', 'comercial');
  perform pg_temp.tarefa(null, 'Desenvolver aula/curso de DJ para a Cissa e o Paulinho', 'criacao');
  perform pg_temp.tarefa(null, 'Plano de ação para reativar a marcenaria do avô: processos, como abordar clientes (imóveis/marcenaria) e crédito do governo (Pronampe, microcrédito, Sebrae)', 'comercial');
  perform pg_temp.tarefa(null, 'Planejar o lanche do evento de 31/10', 'execucao', 'a_fazer', '', date '2026-10-31');
  perform pg_temp.tarefa(null, 'Sistema de controle interno da LOOK: fases 2 a 5 (comercial, criação/execução, gestão, app de celular)', 'execucao', 'fazendo');

  -- ---------------- Já feito ----------------
  perform pg_temp.tarefa(null, 'E-mail contato@lookexperience.com.br (Zoho)', 'execucao', 'feito');
  perform pg_temp.tarefa(null, 'Domínio e site no ar com HTTPS', 'execucao', 'feito');
  perform pg_temp.tarefa(null, 'Site no GitHub com publicação automática pela Netlify', 'execucao', 'feito');
  perform pg_temp.tarefa(null, 'Biblioteca de sons em look/sons/', 'execucao', 'feito');
  perform pg_temp.tarefa(null, 'Sistema interno no ar em sistema.lookexperience.com.br', 'execucao', 'feito');

  -- A importação não precisa encher o sino de avisos "Nova tarefa para você".
  delete from public.avisos where criado_em >= inicio and texto like 'Nova tarefa para você:%';
end $$;

select (select count(*) from public.clientes) as clientes,
       (select count(*) from public.projetos) as projetos,
       (select count(*) from public.tarefas) as tarefas;
