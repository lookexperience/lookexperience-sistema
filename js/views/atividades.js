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

// A ordem dos cartões em cada coluna é a que a equipe arrastou (campo "ordem").
const porOrdem = (a, b) => (a.ordem ?? 0) - (b.ordem ?? 0);

function desenharQuadro(quadro, ctx) {
  const tarefas = aplicarFiltros(ctx, ctx.estado.tarefas);
  quadro.innerHTML = STATUS.map((st) => {
    const lista = tarefas.filter((t) => t.status === st.chave).sort(porOrdem);
    return `<div class="coluna" data-status="${st.chave}">
      <div class="coluna-topo"><h3>${st.nome}</h3><span class="qtd">${lista.length}</span></div>
      ${lista.map((t) => cartaoTarefa(ctx, t, podeEditarTarefa(ctx.estado.sessao, t))).join('')}
    </div>`;
  }).join('');
  ligarTarefas(ctx, quadro);

  // Arrastar muda a posição na coluna e, se for para outra coluna, o status.
  const marcador = document.createElement('div');
  marcador.className = 'marcador-posicao';
  let arrastada = null;

  quadro.querySelectorAll('.cartao[draggable]').forEach((c) => {
    c.addEventListener('dragstart', (e) => {
      arrastada = c.dataset.tarefa;
      e.dataTransfer.setData('text/plain', arrastada);
      e.dataTransfer.effectAllowed = 'move';
      c.classList.add('arrastando');
    });
    c.addEventListener('dragend', () => { c.classList.remove('arrastando'); marcador.remove(); arrastada = null; });
  });

  // Primeiro cartão da coluna cujo meio está abaixo do ponteiro: o arrastado entra antes dele.
  const cartaoDepois = (col, y) => [...col.querySelectorAll('.cartao:not(.arrastando)')]
    .find((c) => { const r = c.getBoundingClientRect(); return y < r.top + r.height / 2; }) ?? null;

  quadro.querySelectorAll('.coluna').forEach((col) => {
    col.addEventListener('dragover', (e) => {
      if (!arrastada) return;
      e.preventDefault();
      col.classList.add('alvo');
      const depois = cartaoDepois(col, e.clientY);
      if (depois) col.insertBefore(marcador, depois); else col.append(marcador);
    });
    col.addEventListener('dragleave', (e) => { if (!col.contains(e.relatedTarget)) { col.classList.remove('alvo'); marcador.remove(); } });
    col.addEventListener('drop', async (e) => {
      e.preventDefault();
      col.classList.remove('alvo');
      const t = ctx.estado.tarefas.find((x) => x.id === e.dataTransfer.getData('text/plain'));
      const depois = cartaoDepois(col, e.clientY);
      marcador.remove();
      if (!t) return;
      // Nova ordem fica entre o cartão de cima e o de baixo do ponto onde soltou.
      const vizinhos = [...col.querySelectorAll('.cartao')].filter((c) => c.dataset.tarefa !== t.id)
        .map((c) => ctx.estado.tarefas.find((x) => x.id === c.dataset.tarefa));
      const indice = depois ? vizinhos.findIndex((v) => v.id === depois.dataset.tarefa) : vizinhos.length;
      const acima = vizinhos[indice - 1];
      const abaixo = vizinhos[indice];
      const ordem = acima && abaixo ? (acima.ordem + abaixo.ordem) / 2
        : acima ? acima.ordem + 1
        : abaixo ? abaixo.ordem - 1
        : 0;
      const mudancas = { ordem };
      if (t.status !== col.dataset.status) mudancas.status = col.dataset.status;
      if (!mudancas.status && t.ordem === ordem) return;
      try {
        Object.assign(t, await ctx.db().atualizar('tarefas', t.id, mudancas));
        desenharQuadro(quadro, ctx);
      } catch (err) { avisar(err.message); }
    });
  });
}
