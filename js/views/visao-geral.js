import { pode } from '../permissoes.js';
import { esc, hoje, paraData, mesCurto, diaDaTarefa, estaAtrasada, chaveDia } from '../util.js';
import { etiquetaSetor, nomeClienteDaTarefa, quando, ligarTarefas, filtros } from './comum.js';

export async function render(el, ctx) {
  const { estado } = ctx;
  const s = estado.sessao;
  const eu = s.perfil.id;
  const abertas = estado.tarefas.filter((t) => t.status !== 'feito');
  const minhas = abertas.filter((t) => t.responsavel_id === eu);
  const atrasadas = abertas.filter(estaAtrasada);
  const emAprovacao = abertas.filter((t) => t.status === 'em_aprovacao');
  const ativos = estado.projetos.filter((p) => p.status === 'ativo');

  const limite = new Date(); limite.setDate(limite.getDate() + 14);
  const proximos = abertas.filter((t) => { const d = diaDaTarefa(t); return d && d >= hoje() && d <= chaveDia(limite); })
    .sort((a, b) => (diaDaTarefa(a) + (a.inicio ?? '')).localeCompare(diaDaTarefa(b) + (b.inicio ?? ''))).slice(0, 8);

  const item = (t) => {
    const d = paraData(diaDaTarefa(t));
    return `<div class="item" data-tarefa="${t.id}">
      <div class="data-bloco">${d ? `<b>${d.getDate()}</b><span>${mesCurto(d.getMonth())}</span>` : '<span>sem data</span>'}</div>
      <div class="titulo">${esc(t.titulo)}<small>${esc(nomeClienteDaTarefa(ctx, t))} · ${quando(t)}</small></div>
      ${etiquetaSetor(t.setor)}</div>`;
  };
  const verTarefas = pode(s, 'tarefas', 'ver');

  el.innerHTML = `
    <div class="cabecalho"><div><div class="sobre">Visão geral</div><h1>Bom trabalho, ${esc(s.perfil.nome.split(' ')[0])}</h1></div>
      ${pode(s, 'tarefas', 'criar') ? '<button class="botao primario" id="nova">+ Nova tarefa</button>' : ''}</div>
    ${verTarefas ? `
    <div class="numeros">
      <div class="numero" data-ir="minhas"><div class="rotulo">Minhas tarefas abertas</div><div class="valor">${minhas.length}</div></div>
      <div class="numero ${atrasadas.length ? 'alerta' : ''}" data-ir="atividades"><div class="rotulo">Atrasadas</div><div class="valor">${atrasadas.length}</div></div>
      <div class="numero" data-ir="atividades"><div class="rotulo">Esperando aprovação</div><div class="valor">${emAprovacao.length}</div></div>
      <div class="numero" data-ir="projetos"><div class="rotulo">Projetos ativos</div><div class="valor">${ativos.length}</div></div>
    </div>
    <div class="duas-colunas">
      <div class="painel"><h2>Próximos 14 dias</h2><div class="lista" style="margin-top:10px">${proximos.map(item).join('') || '<div class="vazio">Nada marcado para os próximos dias.</div>'}</div></div>
      <div class="painel"><h2>Atrasadas</h2><div class="lista" style="margin-top:10px">${atrasadas.map(item).join('') || '<div class="vazio">Nenhuma tarefa atrasada.</div>'}</div></div>
    </div>` : '<div class="painel vazio">Você ainda não tem acesso às tarefas. Fale com o administrador.</div>'}`;

  ligarTarefas(ctx, el);
  el.querySelector('#nova')?.addEventListener('click', () => ctx.abrirTarefa(null));
  el.querySelectorAll('[data-ir]').forEach((card) => card.addEventListener('click', () => {
    const destino = card.dataset.ir;
    if (destino === 'minhas') { Object.assign(filtros, { responsavel: 'eu' }); ctx.navegar('atividades'); } else if (destino !== 'projetos' || pode(s, 'projetos', 'ver')) ctx.navegar(destino);
  }));
}
