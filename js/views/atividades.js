import { STATUS } from '../config.js';
import { podeEditarTarefa, pode } from '../permissoes.js';
import { avisar } from '../util.js';
import { cartaoTarefa, ligarTarefas, barraFiltros, ligarFiltros, aplicarFiltros } from './comum.js';

export async function render(el, ctx) {
  const s = ctx.estado.sessao;
  el.innerHTML = `
    <div class="cabecalho"><div><div class="sobre">Atividades</div><h1>Quadro de tarefas</h1></div>
      ${pode(s, 'tarefas', 'criar') ? '<button class="botao primario" id="nova">+ Nova tarefa</button>' : ''}</div>
    ${barraFiltros(ctx)}
    <div class="kanban" id="kanban"></div>`;
  el.querySelector('#nova')?.addEventListener('click', () => ctx.abrirTarefa(null));
  const desenhar = () => desenharQuadro(el.querySelector('#kanban'), ctx);
  ligarFiltros(ctx, el, desenhar);
  desenhar();
}

function desenharQuadro(quadro, ctx) {
  const tarefas = aplicarFiltros(ctx, ctx.estado.tarefas);
  quadro.innerHTML = STATUS.map((st) => {
    const lista = tarefas.filter((t) => t.status === st.chave).sort((a, b) => (a.prioridade === 'urgente' ? -1 : 0) - (b.prioridade === 'urgente' ? -1 : 0) || (a.prazo ?? '9').localeCompare(b.prazo ?? '9'));
    return `<div class="coluna" data-status="${st.chave}">
      <div class="coluna-topo"><h3>${st.nome}</h3><span class="qtd">${lista.length}</span></div>
      ${lista.map((t) => cartaoTarefa(ctx, t, podeEditarTarefa(ctx.estado.sessao, t))).join('')}
    </div>`;
  }).join('');
  ligarTarefas(ctx, quadro);

  // Arrastar um cartão para outra coluna muda o status.
  quadro.querySelectorAll('.cartao[draggable]').forEach((c) => {
    c.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', c.dataset.tarefa); c.classList.add('arrastando'); });
    c.addEventListener('dragend', () => c.classList.remove('arrastando'));
  });
  quadro.querySelectorAll('.coluna').forEach((col) => {
    col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('alvo'); });
    col.addEventListener('dragleave', () => col.classList.remove('alvo'));
    col.addEventListener('drop', async (e) => {
      e.preventDefault();
      col.classList.remove('alvo');
      const t = ctx.estado.tarefas.find((x) => x.id === e.dataTransfer.getData('text/plain'));
      if (!t || t.status === col.dataset.status) return;
      try {
        Object.assign(t, await ctx.db().atualizar('tarefas', t.id, { status: col.dataset.status }));
        desenharQuadro(quadro, ctx);
      } catch (err) { avisar(err.message); }
    });
  });
}
