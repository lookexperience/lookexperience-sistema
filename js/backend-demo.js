// Modo demonstração: guarda tudo neste navegador e imita as regras do
// banco, para dar para testar o sistema antes do Supabase estar ligado.
import { MODULOS } from './config.js';
import { pode, podeVerTarefa, podeEditarTarefa } from './permissoes.js';
import { chaveDia } from './util.js';

export const modo = 'demo';
const CHAVE = 'look-sistema-demo-v2';
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
  ];
  const permissoes = [
    permissao(marina, 'visao_geral', true, false, false, false),
    permissao(marina, 'tarefas', true, true, true, false, 'setor'),
    permissao(marina, 'clientes', true, false, false, false),
    permissao(marina, 'projetos', true, true, true, false),
    permissao(rafa, 'visao_geral', true, false, false, false),
    permissao(rafa, 'tarefas', true, false, false, false, 'proprias'),
  ];
  const c = (id, nome, contato, extra = {}) => ({ id, nome, contato, email: '', telefone: '', instagram: '', observacoes: '', criado_por: pablo, criado_em: agora, ...extra });
  const clientes = [
    c('c-lotus', 'Lotus Games', 'Responsável da loja', { instagram: '@lotusgames' }),
    c('c-flambe', 'Flambé', 'Sócios', { observacoes: 'Restaurante de esfihas e vinhos. Paleta proposta: Bordeaux, Creme, Carvão.' }),
    c('c-fusion', 'Fusion Soldas', ''),
    c('c-ketlin', 'Ketlin Joias', 'Ketlin'),
  ];
  const p = (id, cliente_id, nome, tipo, inicio, fim) => ({ id, cliente_id, nome, tipo, status: 'ativo', inicio, fim, descricao: '', criado_por: pablo, criado_em: agora });
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
  });
  const tarefas = [
    t('Fechar valor mensal e duração com a Lotus', { projeto_id: 'p-lotus', setor: 'comercial', prazo: diaRelativo(1), prioridade: 'urgente' }),
    t('Contrato Lotus pelo gov.br', { projeto_id: 'p-lotus', setor: 'comercial', prazo: diaRelativo(4) }),
    t('Fechar cor do nome e acabamento da medalha', { projeto_id: 'p-lotus', setor: 'criacao', status: 'fazendo', responsavel_id: marina, prazo: diaRelativo(2) }),
    t('Gravação de produtos na loja', { projeto_id: 'p-lotus', tipo: 'gravacao', setor: 'execucao', inicio: horaRelativa(6, 14), local: 'Loja Lotus Games, Ourinhos', responsavel_id: rafa }),
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
  return { perfis, permissoes, clientes, projetos, tarefas, comentarios, avisos };
}

export async function iniciar() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE) || 'null');
    if (salvo?.banco) ({ banco, usuarioAtual } = salvo);
  } catch { /* sem armazenamento */ }
  if (!banco) { banco = semente(); usuarioAtual = 'u-pablo'; salvar(); }
}

export function resetar() { banco = semente(); usuarioAtual = 'u-pablo'; salvar(); }
export const usuariosDemo = () => banco.perfis.map(({ id, nome, cargo, admin }) => ({ id, nome, cargo, admin }));
export const usuarioDemo = () => usuarioAtual;
export function trocarUsuario(id) { usuarioAtual = id; salvar(); }

export async function sessao() {
  if (!usuarioAtual) return null;
  const perfil = banco.perfis.find((p) => p.id === usuarioAtual);
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
    case 'perfis': return linha.id === eu || s.perfil.ativo;
    case 'permissoes': return linha.usuario_id === eu || s.perfil.admin;
    case 'tarefas': return tarefaVisivel(linha);
    case 'projetos': return pode(s, 'projetos', 'ver') || banco.tarefas.some((t) => t.projeto_id === linha.id && tarefaVisivel(t));
    case 'clientes': return pode(s, 'clientes', 'ver') || banco.projetos.some((p) => p.cliente_id === linha.id && banco.tarefas.some((t) => t.projeto_id === p.id && tarefaVisivel(t)));
    case 'comentarios': return banco.tarefas.some((t) => t.id === linha.tarefa_id && tarefaVisivel(t));
    case 'avisos': return linha.usuario_id === eu;
    default: return false;
  }
}

export async function listar(tabela, filtros = {}) {
  const s = await sessao();
  if (!s) return [];
  return structuredClone(banco[tabela].filter((l) => visivel(tabela, l, s) && Object.entries(filtros).every(([k, v]) => l[k] === v)));
}

function avisar(usuario_id, texto, tarefa_id) {
  banco.avisos.unshift({ id: novoId(), usuario_id, texto, tarefa_id, lido: false, criado_em: new Date().toISOString() });
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
    if (linha.responsavel_id && linha.responsavel_id !== eu) avisar(linha.responsavel_id, `Nova tarefa para você: ${linha.titulo}`, linha.id);
  } else if (tabela === 'comentarios') {
    const tarefa = banco.tarefas.find((t) => t.id === linha.tarefa_id);
    if (!tarefa || !podeVerTarefa(s, tarefa)) negar();
    linha.autor_id = eu;
    for (const p of banco.perfis) {
      if (!p.ativo || p.id === eu) continue;
      const primeiro = p.nome.split(' ')[0];
      const marcado = primeiro && linha.texto.toLowerCase().includes(`@${primeiro.toLowerCase()}`);
      if (marcado || p.id === tarefa.responsavel_id) {
        avisar(p.id, `${s.perfil.nome} ${marcado ? 'marcou você em' : 'comentou em'}: ${tarefa.titulo}`, tarefa.id);
      }
    }
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
    const novoResp = mudancas.responsavel_id;
    if (novoResp && novoResp !== linha.responsavel_id && novoResp !== s.perfil.id) avisar(novoResp, `Nova tarefa para você: ${mudancas.titulo ?? linha.titulo}`, id);
    mudancas = { ...mudancas, atualizado_em: new Date().toISOString() };
  } else if (tabela === 'clientes' || tabela === 'projetos') {
    if (!pode(s, tabela, 'editar')) negar();
  } else if (tabela === 'perfis') {
    if (!s.perfil.admin) {
      if (id !== s.perfil.id) negar();
      mudancas = { nome: mudancas.nome ?? linha.nome };
    }
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
    comentarios: () => linha.autor_id === s.perfil.id || s.perfil.admin,
    avisos: () => true,
    perfis: () => s.perfil.admin && id !== s.perfil.id,
  }[tabela];
  if (!permitido?.()) negar();
  banco[tabela] = banco[tabela].filter((l) => l.id !== id);
  if (tabela === 'tarefas') banco.comentarios = banco.comentarios.filter((c) => c.tarefa_id !== id);
  if (tabela === 'perfis') banco.permissoes = banco.permissoes.filter((p) => p.usuario_id !== id);
  salvar();
}

export async function salvarPermissoes(usuarioId, linhas) {
  const s = await sessao();
  if (!s.perfil.admin) negar();
  banco.permissoes = banco.permissoes.filter((p) => p.usuario_id !== usuarioId)
    .concat(linhas.filter((l) => MODULOS.some((m) => m.chave === l.modulo)).map((l) => ({ ...l, usuario_id: usuarioId })));
  salvar();
}
