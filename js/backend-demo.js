// Modo demonstração: guarda tudo neste navegador e imita as regras do
// banco, para dar para testar o sistema antes do Supabase estar ligado.
import { MODULOS } from './config.js';
import { pode, podeVerTarefa, podeEditarTarefa, temAlgumAcesso, responsaveisDe } from './permissoes.js';
import { chaveDia } from './util.js';
import { conferirArquivo, novoIdAnexo } from './anexos.js';

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
  return { perfis, permissoes, clientes, projetos, tarefas, comentarios, avisos, anexos: [], briefings: [] };
}

export async function iniciar() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE) || 'null');
    if (salvo?.banco) ({ banco, usuarioAtual } = salvo);
  } catch { /* sem armazenamento */ }
  for (const t of banco?.tarefas ?? []) t.responsaveis ??= t.responsavel_id ? [t.responsavel_id] : [];
  for (const p of banco?.projetos ?? []) p.briefing ??= 'dispensado';
  if (banco) banco.briefings ??= [];
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
    comentarios: () => linha.autor_id === s.perfil.id || s.perfil.admin,
    avisos: () => true,
    perfis: () => s.perfil.admin && id !== s.perfil.id,
  }[tabela];
  if (!permitido?.()) negar();
  banco[tabela] = banco[tabela].filter((l) => l.id !== id);
  if (tabela === 'tarefas') banco.comentarios = banco.comentarios.filter((c) => c.tarefa_id !== id);
  if (tabela === 'perfis') banco.permissoes = banco.permissoes.filter((p) => p.usuario_id !== id);
  // Igual ao banco: projeto sem cliente e tarefa sem projeto continuam existindo.
  if (tabela === 'clientes') banco.projetos.forEach((p) => { if (p.cliente_id === id) p.cliente_id = null; });
  if (tabela === 'projetos') banco.tarefas.forEach((t) => { if (t.projeto_id === id) t.projeto_id = null; });
  if (tabela === 'projetos') banco.anexos = (banco.anexos ?? []).filter((a) => a.projeto_id !== id);
  if (tabela === 'projetos') banco.briefings = (banco.briefings ?? []).filter((b) => b.projeto_id !== id);
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
