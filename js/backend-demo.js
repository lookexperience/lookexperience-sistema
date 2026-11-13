// Modo demonstração: guarda tudo neste navegador e imita as regras do
// banco, para dar para testar o sistema antes do Supabase estar ligado.
import { MODULOS } from './config.js';
import { pode, podeVerTarefa, podeEditarTarefa, temAlgumAcesso, responsaveisDe } from './permissoes.js';
import { chaveDia } from './util.js';
import { conferirArquivo, novoIdAnexo } from './anexos.js';
import { TABELA } from './orcamento-tabela.js';

export const modo = 'demo';
const CHAVE = 'look-sistema-demo-v4';
let banco = null;
let usuarioAtual = null;

const novoId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
const salvar = () => { try { localStorage.setItem(CHAVE, JSON.stringify({ banco, usuarioAtual })); } catch { /* sem armazenamento: segue só na memória */ } };

function diaRelativo(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return chaveDia(d);
}
function horaRelativa(dias, h) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  d.setHours(h, 0, 0, 0);
  return d.toISOString();
}

function permissao(usuario, modulo, ver, criar, editar, apagar, escopo = 'proprias') {
  return { usuario_id: usuario, modulo, ver, criar, editar, apagar, escopo };
}

function semente() {
  const pablo = 'u-pablo', marina = 'u-marina', rafa = 'u-rafa', novo = 'u-novo';
  const agora = new Date().toISOString();
  const perfis = [
    { id: pablo, nome: 'Pablo Caetano', email: 'contato@lookexperience.com.br', cargo: 'Fundador', setores: ['comercial', 'criacao', 'execucao'], admin: true, ativo: true, criado_em: agora },
    { id: marina, nome: 'Marina Exemplo', email: 'marina@exemplo.com', cargo: 'Gerente de criação', setores: ['criacao', 'execucao'], admin: false, ativo: true, criado_em: agora },
    { id: rafa, nome: 'Rafa Exemplo', email: 'rafa@exemplo.com', cargo: 'Editor de vídeo (freelancer)', setores: ['execucao'], admin: false, ativo: true, criado_em: agora },
    { id: novo, nome: 'Conta Nova', email: 'nova@exemplo.com', cargo: '', setores: [], admin: false, ativo: true, criado_em: agora },
    { id: 'u-saiu', nome: 'Ex Funcionário', email: 'saiu@exemplo.com', cargo: 'Conta desativada', setores: ['criacao'], admin: false, ativo: false, criado_em: agora },
  ];
  const permissoes = [
    permissao(marina, 'visao_geral', true, false, false, false),
    permissao(marina, 'tarefas', true, true, true, false, 'setor'),
    permissao(marina, 'clientes', true, false, false, false),
    permissao(marina, 'projetos', true, true, true, false),
    permissao(rafa, 'visao_geral', true, false, false, false),
    permissao(rafa, 'tarefas', true, false, false, false, 'proprias'),
    permissao('u-saiu', 'tarefas', true, true, true, true, 'todas'),
  ];
  const c = (id, nome, contato, extra = {}) => ({ id, nome, contato, email: '', telefone: '', instagram: '', observacoes: '', criado_por: pablo, criado_em: agora, ...extra });
  const clientes = [
    c('c-lotus', 'Lotus Games', 'Responsável da loja', { instagram: '@lotusgames', cor: '#4F7FB8' }),
    c('c-flambe', 'Flambé', 'Sócios', { cor: '#C2574A', observacoes: 'Restaurante de esfihas e vinhos. Paleta proposta: Bordeaux, Creme, Carvão.' }),
    c('c-fusion', 'Fusion Soldas', '', { cor: '#D08C3C' }),
    c('c-ketlin', 'Ketlin Joias', 'Ketlin', { cor: '#B5638F' }),
  ];
  const p = (id, cliente_id, nome, tipo, inicio, fim) => ({ id, cliente_id, nome, tipo, status: 'ativo', inicio, fim, descricao: '', briefing: 'dispensado', criado_por: pablo, criado_em: agora });
  const projetos = [
    p('p-lotus', 'c-lotus', 'Rebranding + conteúdo mensal', 'Rebranding', diaRelativo(-5), diaRelativo(40)),
    p('p-flambe', 'c-flambe', 'Identidade visual', 'Identidade visual', diaRelativo(-10), diaRelativo(25)),
    p('p-fusion', 'c-fusion', 'Landing page', 'Site', diaRelativo(0), diaRelativo(20)),
    p('p-ketlin', 'c-ketlin', 'Nova identidade visual', 'Identidade visual', diaRelativo(3), diaRelativo(35)),
  ];
  let ordem = 0;
  const t = (titulo, extra) => ({
    id: novoId(), projeto_id: null, titulo, descricao: '', tipo: 'tarefa', setor: 'criacao', responsavel_id: pablo,
    status: 'a_fazer', prioridade: 'normal', prazo: null, inicio: null, local: '', ordem: ordem++,
    criado_por: pablo, criado_em: agora, atualizado_em: agora, ...extra,
    responsaveis: extra?.responsaveis ?? [extra?.responsavel_id ?? pablo],
  });
  const tarefas = [
    t('Fechar valor mensal e duração com a Lotus', { projeto_id: 'p-lotus', setor: 'comercial', prazo: diaRelativo(1), prioridade: 'urgente' }),
    t('Contrato Lotus pelo gov.br', { projeto_id: 'p-lotus', setor: 'comercial', prazo: diaRelativo(4) }),
    t('Fechar cor do nome e acabamento da medalha', { projeto_id: 'p-lotus', setor: 'criacao', status: 'fazendo', responsavel_id: marina, prazo: diaRelativo(2) }),
    t('Gravação de produtos na loja', { projeto_id: 'p-lotus', tipo: 'gravacao', setor: 'execucao', inicio: horaRelativa(6, 14), local: 'Loja Lotus Games, Ourinhos', responsavel_id: rafa, responsaveis: [rafa, marina] }),
    t('Editar 3 reels de lançamento', { projeto_id: 'p-lotus', setor: 'execucao', responsavel_id: rafa, prazo: diaRelativo(9) }),
    t('Calendário editorial do 1º mês', { projeto_id: 'p-lotus', setor: 'criacao', status: 'em_aprovacao', responsavel_id: marina, prazo: diaRelativo(5) }),
    t('Flambé: direção, tipografia e símbolo', { projeto_id: 'p-flambe', setor: 'criacao', status: 'fazendo', prazo: diaRelativo(-1) }),
    t('Landing page da Fusion Soldas', { projeto_id: 'p-fusion', setor: 'criacao', prazo: diaRelativo(12) }),
    t('Reunião com a Valter Vidros', { tipo: 'reuniao', setor: 'comercial', inicio: horaRelativa(3, 10) }),
    t('Contato com a Gelateria Perino', { setor: 'comercial', prazo: diaRelativo(7) }),
    t('Moodboard Ketlin Joias', { projeto_id: 'p-ketlin', setor: 'criacao', responsavel_id: marina, prazo: diaRelativo(8) }),
    t('Post: bastidores do rebranding', { projeto_id: 'p-lotus', tipo: 'post', setor: 'criacao', inicio: horaRelativa(2, 18), responsavel_id: marina }),
    t('Reels: unboxing de cartas raras', { projeto_id: 'p-lotus', tipo: 'post', setor: 'criacao', inicio: horaRelativa(5, 19), responsavel_id: marina }),
    t('Carrossel: torneio de sábado', { projeto_id: 'p-lotus', tipo: 'post', setor: 'criacao', inicio: horaRelativa(9, 12), responsavel_id: marina }),
    t('Post: harmonização esfiha e vinho', { projeto_id: 'p-flambe', tipo: 'post', setor: 'criacao', inicio: horaRelativa(4, 11) }),
    t('Stories: menu da semana', { projeto_id: 'p-flambe', tipo: 'post', setor: 'criacao', inicio: horaRelativa(8, 17) }),
    t('Site da LOOK no ar com HTTPS', { setor: 'execucao', status: 'feito', prazo: diaRelativo(-1) }),
  ];
  const comentarios = [
    { id: novoId(), tarefa_id: tarefas[2].id, autor_id: marina, texto: 'Subi duas opções de dourado. @Pablo qual você prefere?', criado_em: agora },
  ];
  const avisos = [
    { id: novoId(), usuario_id: pablo, texto: 'Marina Exemplo marcou você em: Fechar cor do nome e acabamento da medalha', tarefa_id: tarefas[2].id, lido: false, criado_em: agora },
  ];
  const mes = diaRelativo(0).slice(0, 8);
  const l = (dono_id, escopo, tipo, descricao, valor, dia, extra = {}) => ({
    id: novoId(), dono_id, escopo, tipo, descricao, valor, data: `${mes}${String(dia).padStart(2, '0')}`, categoria: '', pago: true,
    cliente_id: null, projeto_id: null, observacoes: '', criado_em: agora, atualizado_em: agora, ...extra });
  const lancamentos = [
    l(pablo, 'pessoal', 'entrada', 'Pró-labore', 3500, 5, { categoria: 'Salário / pró-labore' }),
    l(pablo, 'pessoal', 'saida', 'Aluguel', 1200, 5, { categoria: 'Moradia' }),
    l(pablo, 'pessoal', 'saida', 'Mercado do mês', 640.5, 8, { categoria: 'Mercado' }),
    l(pablo, 'pessoal', 'saida', 'Conta de luz', 180, 20, { categoria: 'Contas da casa', pago: false }),
    l(marina, 'pessoal', 'saida', 'Academia', 99.9, 10, { categoria: 'Saúde' }),
    l(pablo, 'empresa', 'entrada', 'Rebranding Lotus · 1ª parcela', 2500, 3, { categoria: 'Serviço de cliente', cliente_id: 'c-lotus', projeto_id: 'p-lotus' }),
    l(pablo, 'empresa', 'entrada', 'Identidade Flambé · sinal', 1500, 25, { categoria: 'Serviço de cliente', cliente_id: 'c-flambe', projeto_id: 'p-flambe', pago: false }),
    l(pablo, 'empresa', 'saida', 'Adobe Creative Cloud', 124, 2, { categoria: 'Ferramentas e assinaturas' }),
    l(pablo, 'empresa', 'saida', 'Edição freelancer (reels)', 450, 12, { categoria: 'Freelancers', projeto_id: 'p-lotus', cliente_id: 'c-lotus' }),
  ];
  const ano = diaRelativo(0).slice(0, 4);
  const itens = [
    { cat: 'Marca', d: 'Identidade visual', det: 'Logo, paleta de cores, tipografia e aplicações principais.', u: 'projeto', q: 1, valor: 3000, mensal: false },
    { cat: 'Planos mensais', d: 'Plano Inicial', det: 'Conteúdo mensal para redes sociais.', u: 'mês', q: 1, valor: 1599.99, mensal: true },
  ];
  const orcamentos = [
    { id: novoId(), numero: `${ano}-001`, titulo: 'Identidade visual + conteúdo', status: 'enviado', cliente_id: 'c-ketlin', projeto_id: 'p-ketlin', lancamento_id: null,
      dados: { data: diaRelativo(-2), clienteEmpresa: 'Ketlin Joias', clienteNome: 'Ketlin', clienteContato: '', intro: '', itens, desconto: 0, descontoTipo: 'pct', validadeDias: 15,
        pagamento: 'Pix ou cartão.', prazo: '', revisoes: '', incluso: '', naoIncluso: '', obs: '', mostrarAceite: true, responsavel: 'Pablo Caetano · LOOK', cnpj: '68.954.688/0001-82', contatoLook: '' },
      total_unico: 3000, total_mensal: 1599.99, criado_por: pablo, criado_em: agora, atualizado_em: agora },
  ];
  return { perfis, permissoes, clientes, projetos, tarefas, comentarios, avisos, anexos: [], briefings: [], lancamentos, notas: {}, orcamentos, ...cadastrosIniciais(pablo, rafa, agora) };
}

// Produtos (a tabela de preços padrão), fornecedores e equipamentos de exemplo.
function produtosIniciais(agora) {
  let ordem = 0;
  return Object.entries(TABELA).flatMap(([categoria, itens]) => itens.map((it) => ({
    id: novoId(), categoria, descricao: it.d, detalhe: it.det, unidade: it.u, valor: it.valor, mensal: !!it.mensal, ativo: true, ordem: (ordem += 10), criado_em: agora, atualizado_em: agora })));
}
function cadastrosIniciais(pablo, rafa, agora) {
  const f = (nome, categoria, extra = {}) => ({ id: novoId(), nome, categoria, contato: '', telefone: '', email: '', site: '', cidade: 'Ourinhos', observacoes: '', criado_por: pablo, criado_em: agora, ...extra });
  const e = (nome, categoria, status, extra = {}) => ({ id: novoId(), nome, categoria, marca_modelo: '', numero_serie: '', status, com_id: null, local: '', observacoes: '', criado_em: agora, atualizado_em: agora, ...extra });
  return {
    produtos: produtosIniciais(agora),
    fornecedores: [
      f('Gráfica Exemplo', 'Gráfica', { contato: 'Atendimento', telefone: '(14) 0000-0000', observacoes: 'Cartão de visita 4x4 em 2 dias úteis.' }),
      f('Locadora de Luz Exemplo', 'Locação de equipamento', { cidade: 'Marília' }),
    ],
    equipamentos: [
      e('Câmera principal', 'Câmera', 'em_uso', { marca_modelo: 'Sony FX30', com_id: rafa, local: 'Gravação na Lotus' }),
      e('Lente 24-70mm', 'Lente', 'disponivel', { local: 'Estúdio LOOK' }),
      e('Microfone de lapela', 'Áudio', 'manutencao', { marca_modelo: 'Rode Wireless GO II', local: 'Assistência técnica' }),
      e('Tripé de vídeo', 'Tripé e suporte', 'disponivel', { local: 'Estúdio LOOK' }),
    ],
  };
}

export async function iniciar() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE) || 'null');
    if (salvo?.banco) ({ banco, usuarioAtual } = salvo);
  } catch { /* sem armazenamento */ }
  for (const t of banco?.tarefas ?? []) t.responsaveis ??= t.responsavel_id ? [t.responsavel_id] : [];
  for (const p of banco?.projetos ?? []) p.briefing ??= 'dispensado';
  if (banco) { banco.briefings ??= []; banco.lancamentos ??= []; banco.notas ??= {}; banco.orcamentos ??= []; banco.produtos ??= produtosIniciais(new Date().toISOString()); banco.fornecedores ??= []; banco.equipamentos ??= []; }
  if (!banco) { banco = semente(); usuarioAtual = 'u-pablo'; salvar(); }
}

export function resetar() { banco = semente(); usuarioAtual = 'u-pablo'; salvar(); }
export const usuariosDemo = () => banco.perfis.map(({ id, nome, cargo, admin }) => ({ id, nome, cargo, admin }));
export const usuarioDemo = () => usuarioAtual;
export function trocarUsuario(id) { usuarioAtual = id; salvar(); }

export async function sessao() {
  return sessaoDe(usuarioAtual);
}

function sessaoDe(id) {
  if (!id) return null;
  const perfil = banco.perfis.find((p) => p.id === id);
  if (!perfil) return null;
  const permissoes = {};
  for (const p of banco.permissoes.filter((x) => x.usuario_id === perfil.id)) permissoes[p.modulo] = p;
  return { perfil: { ...perfil }, permissoes };
}

export async function entrar() { usuarioAtual = 'u-pablo'; salvar(); }
export async function criarConta() { throw new Error('No modo demonstração não dá para criar conta. Use o seletor de usuário na faixa dourada.'); }
export async function sair() { usuarioAtual = null; salvar(); }

const negar = () => { throw new Error('Você não tem permissão para isso.'); };

// Filtro de leitura: imita as políticas RLS do schema.sql.
function visivel(tabela, linha, s) {
  const eu = s.perfil.id;
  const tarefaVisivel = (t) => podeVerTarefa(s, t);
  switch (tabela) {
    case 'perfis': return linha.id === eu || temAlgumAcesso(s);
    case 'permissoes': return linha.usuario_id === eu || s.perfil.admin;
    case 'tarefas': return tarefaVisivel(linha);
    case 'projetos': return pode(s, 'projetos', 'ver') || banco.tarefas.some((t) => t.projeto_id === linha.id && tarefaVisivel(t));
    case 'clientes': return pode(s, 'clientes', 'ver') || banco.projetos.some((p) => p.cliente_id === linha.id && banco.tarefas.some((t) => t.projeto_id === p.id && tarefaVisivel(t)));
    case 'comentarios': return banco.tarefas.some((t) => t.id === linha.tarefa_id && tarefaVisivel(t));
    case 'avisos': return linha.usuario_id === eu;
    case 'anexos': return banco.projetos.some((p) => p.id === linha.projeto_id && visivel('projetos', p, s));
    case 'briefings': return pode(s, 'projetos', 'ver') && banco.projetos.some((p) => p.id === linha.projeto_id && visivel('projetos', p, s));
    // Pessoal: só o dono, nem o admin. Empresa: permissão "financeiro".
    case 'lancamentos': return linha.escopo === 'pessoal' ? linha.dono_id === eu && s.perfil.ativo : pode(s, 'financeiro', 'ver');
    case 'orcamentos': case 'produtos': return pode(s, 'comercial', 'ver');
    case 'fornecedores': return pode(s, 'fornecedores', 'ver');
    case 'equipamentos': return pode(s, 'equipamentos', 'ver');
    default: return false;
  }
}

export async function listar(tabela, filtros = {}) {
  const s = await sessao();
  if (!s) return [];
  return structuredClone(banco[tabela].filter((l) => visivel(tabela, l, s) && Object.entries(filtros).every(([k, v]) => l[k] === v)));
}

// Igual ao banco: sem repetidos, até 10, todos da equipe; o primeiro é o principal.
function arrumarResponsaveis(alvo, lista) {
  const limpa = [...new Set((lista ?? []).filter(Boolean))];
  if (limpa.length > 10) throw new Error('Uma tarefa pode ter no máximo 10 responsáveis.');
  if (limpa.some((id) => !banco.perfis.some((p) => p.id === id))) throw new Error('Responsável não encontrado na equipe.');
  alvo.responsaveis = limpa;
  alvo.responsavel_id = limpa[0] ?? null;
}

// Mesmos limites do banco para os lançamentos de finanças.
function conferirLancamento(l, s) {
  if (!['pessoal', 'empresa'].includes(l.escopo) || !['entrada', 'saida'].includes(l.tipo)) throw new Error('Lançamento inválido.');
  if (!(Number(l.valor) > 0) || Number(l.valor) >= 1e9) throw new Error('O valor precisa ser maior que zero.');
  if (!String(l.descricao ?? '').trim() || l.descricao.length > 200) throw new Error('Preencha a descrição (até 200 letras).');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(l.data ?? '')) throw new Error('Confira a data.');
  if (l.escopo === 'pessoal' && (l.cliente_id || l.projeto_id)) throw new Error('Lançamento pessoal não se liga a cliente nem a projeto.');
  if ((l.nf_numero ?? '').length > 60) throw new Error('Confira o número e o arquivo da nota fiscal.');
  if (l.nf_caminho && (l.escopo !== 'empresa' || l.nf_caminho.split('/')[0] !== l.id || !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|jpg|png)$/.test(l.nf_caminho))) {
    throw new Error('Confira o número e o arquivo da nota fiscal.');
  }
  const cliente = l.cliente_id && banco.clientes.find((c) => c.id === l.cliente_id);
  const projeto = l.projeto_id && banco.projetos.find((p) => p.id === l.projeto_id);
  if ((l.cliente_id && !(cliente && visivel('clientes', cliente, s))) || (l.projeto_id && !(projeto && visivel('projetos', projeto, s)))) negar();
}

// Mesmos limites do banco para os orçamentos.
function conferirOrcamento(o, s) {
  if (!['rascunho', 'enviado', 'aprovado', 'recusado'].includes(o.status ?? 'rascunho')) throw new Error('Status de orçamento inválido.');
  if ((o.titulo ?? '').length > 200 || JSON.stringify(o.dados ?? {}).length > 200000) throw new Error('Orçamento grande demais: confira o título (até 200 letras) e a quantidade de itens.');
  for (const v of [o.total_unico ?? 0, o.total_mensal ?? 0]) if (!(Number(v) >= 0 && Number(v) <= 1e9)) throw new Error('Confira os valores do orçamento.');
  const cliente = o.cliente_id && banco.clientes.find((c) => c.id === o.cliente_id);
  const projeto = o.projeto_id && banco.projetos.find((p) => p.id === o.projeto_id);
  const lanc = o.lancamento_id && banco.lancamentos.find((l) => l.id === o.lancamento_id);
  if ((o.cliente_id && !(cliente && visivel('clientes', cliente, s))) || (o.projeto_id && !(projeto && visivel('projetos', projeto, s)))
    || (o.lancamento_id && !(lanc && lanc.escopo === 'empresa' && visivel('lancamentos', lanc, s)))) negar();
}

// Produtos, fornecedores e equipamentos: módulo de cada um e os limites do banco.
const MODULO_CADASTRO = { produtos: 'comercial', fornecedores: 'fornecedores', equipamentos: 'equipamentos' };
function conferirCadastro(tabela, l) {
  const curto = (v, n) => String(v ?? '').length <= n;
  const preenchido = (v, n) => String(v ?? '').trim().length >= 1 && curto(v, n);
  if (tabela === 'produtos') {
    if (!preenchido(l.categoria, 60) || !preenchido(l.descricao, 200) || !curto(l.detalhe, 400) || !curto(l.unidade, 30)) throw new Error('Preencha o produto e o grupo (textos curtos).');
    if (!(Number(l.valor) >= 0 && Number(l.valor) <= 1e9)) throw new Error('Confira o valor do produto.');
  } else if (tabela === 'fornecedores') {
    if (!preenchido(l.nome, 200)) throw new Error('Preencha o nome do fornecedor (textos curtos).');
  } else {
    if (!preenchido(l.nome, 200)) throw new Error('Preencha o nome do equipamento (textos curtos).');
    if (!['disponivel', 'em_uso', 'manutencao', 'indisponivel'].includes(l.status)) throw new Error('Situação de equipamento inválida.');
    if (l.com_id && !banco.perfis.some((p) => p.id === l.com_id)) throw new Error('Escolha alguém da equipe.');
  }
}

const novoToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('');

function avisar(usuario_id, texto, tarefa_id, projeto_id = null) {
  banco.avisos.unshift({ id: novoId(), usuario_id, texto, tarefa_id, projeto_id, lido: false, criado_em: new Date().toISOString() });
}

export async function inserir(tabela, dados) {
  const s = await sessao();
  const eu = s.perfil.id;
  const linha = { id: novoId(), criado_em: new Date().toISOString(), ...dados };
  if (tabela === 'clientes' || tabela === 'projetos') {
    if (!pode(s, tabela, 'criar')) negar();
    linha.criado_por = eu;
  } else if (tabela === 'tarefas') {
    if (!pode(s, 'tarefas', 'criar')) negar();
    Object.assign(linha, { criado_por: eu, atualizado_em: linha.criado_em });
    arrumarResponsaveis(linha, linha.responsaveis ?? (linha.responsavel_id ? [linha.responsavel_id] : []));
    for (const r of linha.responsaveis) if (r !== eu) avisar(r, `Nova tarefa para você: ${linha.titulo}`, linha.id);
  } else if (tabela === 'comentarios') {
    const tarefa = banco.tarefas.find((t) => t.id === linha.tarefa_id);
    if (!tarefa || !podeVerTarefa(s, tarefa)) negar();
    linha.autor_id = eu;
    for (const p of banco.perfis) {
      if (!p.ativo || p.id === eu) continue;
      const primeiro = p.nome.split(' ')[0];
      const marcado = primeiro && linha.texto.toLowerCase().includes(`@${primeiro.toLowerCase()}`);
      // Igual ao banco: só avisa quem pode ver a tarefa (o aviso traz o título).
      if ((marcado || responsaveisDe(tarefa).includes(p.id)) && podeVerTarefa(sessaoDe(p.id), tarefa)) {
        avisar(p.id, `${s.perfil.nome} ${marcado ? 'marcou você em' : 'comentou em'}: ${tarefa.titulo}`, tarefa.id);
      }
    }
  } else if (tabela === 'briefings') {
    const projeto = banco.projetos.find((p) => p.id === linha.projeto_id);
    if (!projeto || !visivel('projetos', projeto, s) || !pode(s, 'projetos', 'editar')) negar();
    Object.assign(linha, { token: novoToken(), status: 'aguardando', respostas: null, recebido_em: null, criado_por: eu });
  } else if (tabela === 'lancamentos') {
    conferirLancamento(linha, s);
    if (linha.escopo === 'pessoal' ? !s.perfil.ativo : !pode(s, 'financeiro', 'criar')) negar();
    Object.assign(linha, { dono_id: eu, atualizado_em: linha.criado_em });
  } else if (MODULO_CADASTRO[tabela]) {
    if (!pode(s, MODULO_CADASTRO[tabela], 'criar')) negar();
    if (tabela === 'produtos') Object.assign(linha, { categoria: 'Outros', detalhe: '', unidade: 'un.', valor: 0, mensal: false, ativo: true, ordem: 0, ...dados });
    if (tabela === 'equipamentos') Object.assign(linha, { categoria: '', marca_modelo: '', numero_serie: '', status: 'disponivel', com_id: null, local: '', observacoes: '', ...dados });
    if (tabela === 'fornecedores') Object.assign(linha, { categoria: '', contato: '', telefone: '', email: '', site: '', cidade: '', observacoes: '', ...dados, criado_por: eu });
    conferirCadastro(tabela, linha);
    linha.atualizado_em = linha.criado_em;
  } else if (tabela === 'orcamentos') {
    if (!pode(s, 'comercial', 'criar') || linha.lancamento_id) negar();
    conferirOrcamento(linha, s);
    // Igual ao banco: o número sai em sequência por ano, nunca escolhido.
    const ano = chaveDia(new Date()).slice(0, 4);
    const ultimo = Math.max(0, ...banco.orcamentos.filter((o) => o.numero.startsWith(`${ano}-`)).map((o) => Number(o.numero.split('-')[1])));
    Object.assign(linha, { numero: `${ano}-${String(ultimo + 1).padStart(3, '0')}`, status: linha.status ?? 'rascunho', criado_por: eu, atualizado_em: linha.criado_em });
  } else negar();
  banco[tabela].push(linha);
  salvar();
  return structuredClone(linha);
}

export async function atualizar(tabela, id, mudancas) {
  const s = await sessao();
  const linha = banco[tabela].find((l) => l.id === id);
  if (!linha || !visivel(tabela, linha, s)) negar();
  if (tabela === 'tarefas') {
    if (!podeEditarTarefa(s, linha)) negar();
    // Igual ao banco: sem "editar", só status e posição mudam; o autor nunca muda.
    if (!pode(s, 'tarefas', 'editar')) {
      mudancas = Object.fromEntries(Object.entries(mudancas).filter(([k]) => k === 'status' || k === 'ordem'));
    }
    delete mudancas.criado_por;
    if ('responsaveis' in mudancas || 'responsavel_id' in mudancas) {
      const antes = responsaveisDe(linha);
      const lista = 'responsaveis' in mudancas ? mudancas.responsaveis : (mudancas.responsavel_id ? [mudancas.responsavel_id] : []);
      arrumarResponsaveis(mudancas, lista);
      for (const r of mudancas.responsaveis) {
        if (!antes.includes(r) && r !== s.perfil.id) avisar(r, `Nova tarefa para você: ${mudancas.titulo ?? linha.titulo}`, id);
      }
    }
    mudancas = { ...mudancas, atualizado_em: new Date().toISOString() };
  } else if (tabela === 'clientes' || tabela === 'projetos') {
    if (!pode(s, tabela, 'editar')) negar();
  } else if (tabela === 'perfis') {
    if (!s.perfil.admin) {
      if (id !== s.perfil.id) negar();
      mudancas = {}; // igual ao banco: só o admin muda nome, cargo, setores e acesso
    }
    const perdeAdmin = linha.admin && linha.ativo && (mudancas.admin === false || mudancas.ativo === false);
    if (perdeAdmin && !banco.perfis.some((p) => p.id !== id && p.admin && p.ativo)) {
      throw new Error('O sistema precisa de pelo menos um administrador ativo.');
    }
  } else if (tabela === 'lancamentos') {
    if (linha.escopo === 'empresa' && !pode(s, 'financeiro', 'editar')) negar();
    // Igual ao banco: dono e aba (pessoal/empresa) nunca mudam.
    const { dono_id: _d, escopo: _e, criado_em: _c, ...resto } = mudancas;
    mudancas = { ...resto, atualizado_em: new Date().toISOString() };
    conferirLancamento({ ...linha, ...mudancas }, s);
  } else if (MODULO_CADASTRO[tabela]) {
    if (!pode(s, MODULO_CADASTRO[tabela], 'editar')) negar();
    const { criado_por: _p, criado_em: _c, ...resto } = mudancas;
    mudancas = { ...resto, atualizado_em: new Date().toISOString() };
    conferirCadastro(tabela, { ...linha, ...mudancas });
  } else if (tabela === 'orcamentos') {
    if (!pode(s, 'comercial', 'editar')) negar();
    const { numero: _n, criado_por: _p, criado_em: _c, ...resto } = mudancas;
    mudancas = { ...resto, atualizado_em: new Date().toISOString() };
    conferirOrcamento({ ...linha, ...mudancas }, s);
  } else if (tabela !== 'avisos') negar();
  Object.assign(linha, mudancas);
  salvar();
  return structuredClone(linha);
}

export async function apagar(tabela, id) {
  const s = await sessao();
  const linha = banco[tabela].find((l) => l.id === id);
  if (!linha || !visivel(tabela, linha, s)) negar();
  const permitido = {
    tarefas: () => pode(s, 'tarefas', 'apagar'),
    clientes: () => pode(s, 'clientes', 'apagar'),
    projetos: () => pode(s, 'projetos', 'apagar'),
    briefings: () => pode(s, 'projetos', 'editar') && (linha.status === 'aguardando' || pode(s, 'projetos', 'apagar')),
    lancamentos: () => linha.escopo === 'pessoal' || pode(s, 'financeiro', 'apagar'),
    orcamentos: () => pode(s, 'comercial', 'apagar'),
    produtos: () => pode(s, 'comercial', 'apagar'),
    fornecedores: () => pode(s, 'fornecedores', 'apagar'),
    equipamentos: () => pode(s, 'equipamentos', 'apagar'),
    comentarios: () => linha.autor_id === s.perfil.id || s.perfil.admin,
    avisos: () => true,
    perfis: () => s.perfil.admin && id !== s.perfil.id,
  }[tabela];
  if (!permitido?.()) negar();
  banco[tabela] = banco[tabela].filter((l) => l.id !== id);
  if (tabela === 'tarefas') banco.comentarios = banco.comentarios.filter((c) => c.tarefa_id !== id);
  if (tabela === 'perfis') banco.permissoes = banco.permissoes.filter((p) => p.usuario_id !== id);
  if (tabela === 'perfis') banco.equipamentos.forEach((e) => { if (e.com_id === id) e.com_id = null; });
  // Igual ao banco: projeto sem cliente e tarefa sem projeto continuam existindo.
  if (tabela === 'clientes') banco.projetos.forEach((p) => { if (p.cliente_id === id) p.cliente_id = null; });
  if (tabela === 'projetos') banco.tarefas.forEach((t) => { if (t.projeto_id === id) t.projeto_id = null; });
  if (tabela === 'projetos') banco.anexos = (banco.anexos ?? []).filter((a) => a.projeto_id !== id);
  if (tabela === 'projetos') banco.briefings = (banco.briefings ?? []).filter((b) => b.projeto_id !== id);
  if (tabela === 'lancamentos' && linha.nf_caminho) delete banco.notas[linha.nf_caminho];
  if (tabela === 'lancamentos') banco.orcamentos.forEach((o) => { if (o.lancamento_id === id) o.lancamento_id = null; });
  if (tabela === 'clientes') banco.orcamentos.forEach((o) => { if (o.cliente_id === id) o.cliente_id = null; });
  if (tabela === 'projetos') banco.orcamentos.forEach((o) => { if (o.projeto_id === id) o.projeto_id = null; });
  salvar();
}

export async function mudarSenhaAcesso(nova) {
  const s = await sessao();
  if (!s?.perfil.admin) negar();
  if ((nova ?? '').length < 4 || nova.length > 100) throw new Error('A senha de acesso precisa ter de 4 a 100 caracteres.');
}

export async function salvarPermissoes(usuarioId, linhas) {
  const s = await sessao();
  if (!s.perfil.admin) negar();
  banco.permissoes = banco.permissoes.filter((p) => p.usuario_id !== usuarioId)
    .concat(linhas.filter((l) => MODULOS.some((m) => m.chave === l.modulo)).map((l) => ({ ...l, usuario_id: usuarioId })));
  salvar();
}

// ---------- Anexos (na demonstração, o arquivo fica dentro deste navegador) ----------
const LIMITE_DEMO = 2 * 1024 * 1024;

export async function listarAnexos(projetoId) {
  const s = await sessao();
  banco.anexos ??= [];
  return structuredClone(banco.anexos.filter((a) => a.projeto_id === projetoId && visivel('anexos', a, s)));
}

export async function enviarAnexo(projetoId, arquivo) {
  const s = await sessao();
  const { tipo, ext } = conferirArquivo(arquivo);
  const projeto = banco.projetos.find((p) => p.id === projetoId);
  if (!projeto || !visivel('projetos', projeto, s) || !pode(s, 'projetos', 'editar')) negar();
  if (arquivo.size > LIMITE_DEMO) throw new Error('Na demonstração o limite é 2 MB por arquivo (no sistema de verdade, 20 MB).');
  const dados = await new Promise((ok, falhar) => {
    const leitor = new FileReader();
    leitor.onload = () => ok(leitor.result);
    leitor.onerror = () => falhar(new Error('Não deu para ler o arquivo.'));
    leitor.readAsDataURL(arquivo);
  });
  const id = novoIdAnexo();
  const anexo = { id, projeto_id: projetoId, nome: arquivo.name.slice(0, 255), caminho: `${projetoId}/${id}.${ext}`, tipo, tamanho: arquivo.size, enviado_por: s.perfil.id, criado_em: new Date().toISOString(), dados };
  banco.anexos ??= [];
  banco.anexos.push(anexo);
  salvar();
  return structuredClone(anexo);
}

function blobDe(dataUrl) {
  const [cabeca, base64] = dataUrl.split(',');
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: cabeca.slice(5).split(';')[0] });
}

export async function linksAnexos(anexos) {
  return Object.fromEntries(anexos.map((a) => {
    const guardado = (banco.anexos ?? []).find((x) => x.id === a.id);
    const url = guardado?.dados ? URL.createObjectURL(blobDe(guardado.dados)) : '';
    return [a.id, { abrir: url, baixar: url }];
  }));
}

export async function apagarAnexo(anexo) {
  const s = await sessao();
  const linha = (banco.anexos ?? []).find((a) => a.id === anexo.id);
  if (!linha || !visivel('anexos', linha, s)) negar();
  if (!(pode(s, 'projetos', 'apagar') || (linha.enviado_por === s.perfil.id && pode(s, 'projetos', 'editar')))) negar();
  banco.anexos = banco.anexos.filter((a) => a.id !== anexo.id);
  salvar();
}

// ---------- Notas fiscais (na demonstração, o arquivo fica neste navegador) ----------
export async function enviarArquivoNota(caminho, arquivo) {
  const s = await sessao();
  const l = banco.lancamentos.find((x) => x.nf_caminho === caminho);
  if (!l || l.escopo !== 'empresa' || banco.notas[caminho]
    || !(pode(s, 'financeiro', 'editar') || (l.dono_id === s.perfil.id && pode(s, 'financeiro', 'criar')))) negar();
  if (arquivo.size > LIMITE_DEMO) throw new Error('Na demonstração o limite é 2 MB por arquivo (no sistema de verdade, 5 MB).');
  banco.notas[caminho] = await new Promise((ok, falhar) => {
    const leitor = new FileReader();
    leitor.onload = () => ok(leitor.result);
    leitor.onerror = () => falhar(new Error('Não deu para ler o arquivo.'));
    leitor.readAsDataURL(arquivo);
  });
  salvar();
}

export async function linkNota(caminho) {
  const s = await sessao();
  const l = banco.lancamentos.find((x) => x.nf_caminho === caminho);
  if (!l || !visivel('lancamentos', l, s) || !banco.notas[caminho]) return '';
  return URL.createObjectURL(blobDe(banco.notas[caminho]));
}

export async function apagarArquivoNota(caminho) {
  const s = await sessao();
  const l = banco.lancamentos.find((x) => x.nf_caminho === caminho);
  if (!l || !visivel('lancamentos', l, s) || !(pode(s, 'financeiro', 'editar') || pode(s, 'financeiro', 'apagar'))) negar();
  delete banco.notas[caminho];
  salvar();
}

// ---------- Briefing pelo link do cliente (sem login) ----------
const tokenValido = (token) => /^[0-9a-f]{64}$/.test(token ?? '');

export async function abrirBriefing(token) {
  const b = tokenValido(token) && (banco.briefings ?? []).find((x) => x.token === token);
  if (!b) return null;
  const projeto = banco.projetos.find((p) => p.id === b.projeto_id);
  const cliente = banco.clientes.find((c) => c.id === projeto?.cliente_id);
  return { titulo: b.titulo, status: b.status, cliente: cliente?.nome ?? '', perguntas: b.status === 'aguardando' ? structuredClone(b.perguntas) : null };
}

export async function enviarBriefing(token, respostas) {
  const b = tokenValido(token) && (banco.briefings ?? []).find((x) => x.token === token);
  if (!b) throw new Error('Link de briefing inválido.');
  if (b.status !== 'aguardando') throw new Error('Este briefing já foi enviado. Obrigado!');
  const certo = respostas && typeof respostas === 'object' && !Array.isArray(respostas)
    && Object.entries(respostas).every(([k, v]) => /^[a-z0-9_]{1,40}$/.test(k)
      && ((typeof v === 'string' && v.length <= 10000) || (Array.isArray(v) && v.length <= 30 && v.every((x) => typeof x === 'string' && x.length <= 1000))));
  if (!certo) throw new Error('Respostas inválidas.');
  Object.assign(b, { respostas: structuredClone(respostas), status: 'recebido', recebido_em: new Date().toISOString() });
  const projeto = banco.projetos.find((p) => p.id === b.projeto_id);
  if (projeto) projeto.briefing = 'recebido';
  const cliente = banco.clientes.find((c) => c.id === projeto?.cliente_id);
  for (const p of banco.perfis) {
    if (p.ativo && (p.admin || p.id === b.criado_por)) avisar(p.id, `Briefing recebido: ${cliente ? `${cliente.nome} · ` : ''}${projeto?.nome ?? ''}`, null, projeto?.id ?? null);
  }
  salvar();
}
