import { SETORES, TIPOS, nomeDe } from '../config.js';
import { esc, iniciais, dataCurta, hora, estaAtrasada } from '../util.js';

export const etiquetaSetor = (setor) => `<span class="etiqueta"><span class="ponto ${setor}"></span>${nomeDe(SETORES, setor)}</span>`;

export function nomeClienteDaTarefa(ctx, t) {
  const projeto = ctx.projeto(t.projeto_id);
  if (!projeto) return 'Interno';
  return `${ctx.cliente(projeto.cliente_id)?.nome ?? 'Sem cliente'} · ${projeto.nome}`;
}

export function quando(t) {
  if (t.inicio) return `${dataCurta(t.inicio)}, ${hora(t.inicio)}`;
  if (t.prazo) return `até ${dataCurta(t.prazo)}`;
  return '';
}

export function cartaoTarefa(ctx, t, arrastavel = false) {
  const responsavel = ctx.nomePerfil(t.responsavel_id);
  const tipo = t.tipo !== 'tarefa' ? `<span class="etiqueta">${nomeDe(TIPOS, t.tipo)}</span>` : '';
  return `<div class="cartao" data-tarefa="${t.id}" ${arrastavel ? 'draggable="true"' : ''}>
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
export const filtros = { setor: '', responsavel: '', projeto: '', busca: '' };

export function barraFiltros(ctx) {
  const { estado } = ctx;
  const pessoas = estado.perfis.filter((p) => p.ativo);
  return `<div class="filtros">
    <input type="search" id="f-busca" placeholder="Buscar" value="${esc(filtros.busca)}">
    <select id="f-setor"><option value="">Todos os setores</option>${SETORES.map((s) => `<option value="${s.chave}" ${filtros.setor === s.chave ? 'selected' : ''}>${s.nome}</option>`).join('')}</select>
    <select id="f-responsavel"><option value="">Todas as pessoas</option><option value="eu" ${filtros.responsavel === 'eu' ? 'selected' : ''}>Só as minhas</option>${pessoas.map((p) => `<option value="${p.id}" ${filtros.responsavel === p.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select>
    <select id="f-projeto"><option value="">Todos os projetos</option>${estado.projetos.map((p) => `<option value="${p.id}" ${filtros.projeto === p.id ? 'selected' : ''}>${esc(ctx.cliente(p.cliente_id)?.nome ?? '')} · ${esc(p.nome)}</option>`).join('')}</select>
  </div>`;
}

export function ligarFiltros(raiz, redesenhar) {
  const ligar = (id, chave, evento = 'change') => raiz.querySelector(id).addEventListener(evento, (e) => { filtros[chave] = e.target.value; redesenhar(); });
  ligar('#f-setor', 'setor');
  ligar('#f-responsavel', 'responsavel');
  ligar('#f-projeto', 'projeto');
  ligar('#f-busca', 'busca', 'input');
}

export function aplicarFiltros(ctx, tarefas) {
  const eu = ctx.estado.sessao.perfil.id;
  const busca = filtros.busca.trim().toLowerCase();
  return tarefas.filter((t) =>
    (!filtros.setor || t.setor === filtros.setor)
    && (!filtros.responsavel || t.responsavel_id === (filtros.responsavel === 'eu' ? eu : filtros.responsavel))
    && (!filtros.projeto || t.projeto_id === filtros.projeto)
    && (!busca || t.titulo.toLowerCase().includes(busca) || nomeClienteDaTarefa(ctx, t).toLowerCase().includes(busca)));
}
