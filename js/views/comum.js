import { SETORES, TIPOS, CORES_CLIENTE, COR_PADRAO, nomeDe } from '../config.js';
import { esc, iniciais, dataCurta, hora, estaAtrasada } from '../util.js';

export const etiquetaSetor = (setor) => `<span class="etiqueta"><span class="ponto ${setor}"></span>${nomeDe(SETORES, setor)}</span>`;

export function nomeClienteDaTarefa(ctx, t) {
  const projeto = ctx.projeto(t.projeto_id);
  if (!projeto) return 'Interno';
  return `${ctx.cliente(projeto.cliente_id)?.nome ?? 'Sem cliente'} · ${projeto.nome}`;
}

export const corCliente = (cliente) => cliente?.cor || COR_PADRAO;
export const corDaTarefa = (ctx, t) => corCliente(ctx.cliente(ctx.projeto(t.projeto_id)?.cliente_id));

// Paleta de cores clicável. "nome" identifica o grupo de botões.
export const paletaCores = (atual, nome, desabilitado = false) => `<div class="paleta" data-paleta="${nome}">
  ${CORES_CLIENTE.map((c) => `<button type="button" class="amostra ${c.chave === atual ? 'escolhida' : ''}" data-cor="${c.chave}" title="${c.nome}" style="--cor:${c.chave}" ${desabilitado ? 'disabled' : ''}></button>`).join('')}
</div>`;

export function quando(t) {
  if (t.inicio) return `${dataCurta(t.inicio)}, ${hora(t.inicio)}`;
  if (t.prazo) return `até ${dataCurta(t.prazo)}`;
  return '';
}

export function cartaoTarefa(ctx, t, arrastavel = false) {
  const responsavel = ctx.nomePerfil(t.responsavel_id);
  const tipo = t.tipo !== 'tarefa' ? `<span class="etiqueta">${nomeDe(TIPOS, t.tipo)}</span>` : '';
  return `<div class="cartao" data-tarefa="${t.id}" ${arrastavel ? 'draggable="true"' : ''} style="--cor-cliente:${corDaTarefa(ctx, t)}">
    <div class="titulo">${esc(t.titulo)}</div>
    <div class="cliente">${esc(nomeClienteDaTarefa(ctx, t))}</div>
    <div class="rodape">
      ${etiquetaSetor(t.setor)}${tipo}
      ${t.prioridade === 'urgente' ? '<span class="etiqueta urgente">Urgente</span>' : ''}
      <span class="espaco"></span>
      <span class="fraco ${estaAtrasada(t) ? 'atrasada' : ''}">${quando(t)}</span>
      ${responsavel ? `<span class="avatar" title="${esc(responsavel)}">${esc(iniciais(responsavel))}</span>` : ''}
    </div>
  </div>`;
}

// Liga o clique dos cartões/itens com data-tarefa à janela da tarefa.
export function ligarTarefas(ctx, raiz) {
  raiz.querySelectorAll('[data-tarefa]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const t = ctx.estado.tarefas.find((x) => x.id === el.dataset.tarefa);
      if (t) ctx.abrirTarefa(t);
    });
  });
}

// Filtros comuns de Atividades e Calendário (guardados enquanto a página está aberta).
export const filtros = { setor: '', responsavel: '', cliente: '', projeto: '', busca: '' };

export function barraFiltros(ctx) {
  const { estado } = ctx;
  const pessoas = estado.perfis.filter((p) => p.ativo);
  return `<div class="filtros">
    <input type="search" id="f-busca" placeholder="Buscar" value="${esc(filtros.busca)}">
    <select id="f-setor"><option value="">Todos os setores</option>${SETORES.map((s) => `<option value="${s.chave}" ${filtros.setor === s.chave ? 'selected' : ''}>${s.nome}</option>`).join('')}</select>
    <select id="f-responsavel"><option value="">Todas as pessoas</option><option value="eu" ${filtros.responsavel === 'eu' ? 'selected' : ''}>Só as minhas</option>${pessoas.map((p) => `<option value="${p.id}" ${filtros.responsavel === p.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select>
    <select id="f-cliente"><option value="">Todos os clientes</option>${[...estado.clientes].sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => `<option value="${c.id}" ${filtros.cliente === c.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}<option value="interno" ${filtros.cliente === 'interno' ? 'selected' : ''}>Interno (sem cliente)</option></select>
    ${seletorProjetos(ctx)}
  </div>`;
}

// Opções do filtro: cada cliente vira um grupo com os projetos dele.
function grupoProjetos(ctx) {
  const { estado } = ctx;
  const grupos = [...estado.clientes].sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => [c.id, c.nome]);
  grupos.push([null, 'Interno']);
  return grupos.filter(([id]) => !filtros.cliente || (filtros.cliente === 'interno' ? id === null : id === filtros.cliente)).map(([id, nome]) => {
    const lista = estado.projetos.filter((p) => (p.cliente_id ?? null) === id);
    if (!lista.length) return '';
    return `<optgroup label="${esc(nome)}">${lista.map((p) => `<option value="${p.id}" ${filtros.projeto === p.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</optgroup>`;
  }).join('');
}

const seletorProjetos = (ctx) => `<select id="f-projeto"><option value="">Todos os projetos</option>${grupoProjetos(ctx)}</select>`;

export function ligarFiltros(ctx, raiz, redesenhar) {
  const ligar = (id, chave, evento = 'change') => raiz.querySelector(id).addEventListener(evento, (e) => { filtros[chave] = e.target.value; redesenhar(); });
  ligar('#f-setor', 'setor');
  ligar('#f-responsavel', 'responsavel');
  raiz.querySelector('#f-cliente').addEventListener('change', (e) => {
    filtros.cliente = e.target.value;
    filtros.projeto = '';
    // Troca as opções de projeto para as do cliente escolhido.
    raiz.querySelector('#f-projeto').outerHTML = seletorProjetos(ctx);
    raiz.querySelector('#f-projeto').addEventListener('change', (ev) => { filtros.projeto = ev.target.value; redesenhar(); });
    redesenhar();
  });
  ligar('#f-projeto', 'projeto');
  ligar('#f-busca', 'busca', 'input');
}

export function aplicarFiltros(ctx, tarefas) {
  const eu = ctx.estado.sessao.perfil.id;
  const busca = filtros.busca.trim().toLowerCase();
  return tarefas.filter((t) =>
    (!filtros.setor || t.setor === filtros.setor)
    && (!filtros.responsavel || t.responsavel_id === (filtros.responsavel === 'eu' ? eu : filtros.responsavel))
    && (!filtros.cliente || (ctx.projeto(t.projeto_id)?.cliente_id ?? 'interno') === filtros.cliente)
    && (!filtros.projeto || t.projeto_id === filtros.projeto)
    && (!busca || t.titulo.toLowerCase().includes(busca) || nomeClienteDaTarefa(ctx, t).toLowerCase().includes(busca)));
}
