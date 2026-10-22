import { STATUS_PROJETO, nomeDe } from '../config.js';
import { pode } from '../permissoes.js';
import { esc, $, dataCurta, avisar } from '../util.js';
import { abrirModal, opcoes } from './modal.js';
import { filtros } from './comum.js';

export async function render(el, ctx) {
  const { estado } = ctx;
  const s = estado.sessao;
  const ordem = { ativo: 0, pausado: 1, concluido: 2 };
  const linha = (p) => {
    const tarefas = estado.tarefas.filter((t) => t.projeto_id === p.id);
    const feitas = tarefas.filter((t) => t.status === 'feito').length;
    const pct = tarefas.length ? Math.round((feitas / tarefas.length) * 100) : 0;
    return `<tr class="clicavel" data-id="${p.id}">
      <td><b>${esc(p.nome)}</b></td>
      <td>${esc(p.tipo)}</td><td><span class="etiqueta">${nomeDe(STATUS_PROJETO, p.status)}</span></td>
      <td>${p.inicio ? dataCurta(p.inicio) : '—'} a ${p.fim ? dataCurta(p.fim) : '—'}</td>
      <td><div class="barra"><i style="width:${pct}%"></i></div><div class="fraco">${feitas} de ${tarefas.length} tarefas</div></td>
      <td><button class="botao pequeno" data-quadro="${p.id}">Ver tarefas</button></td></tr>`;
  };
  // Um bloco por cliente, com os projetos dele; projetos internos no fim.
  const grupos = [...estado.clientes].sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => ({ id: c.id, nome: c.nome }));
  grupos.push({ id: null, nome: 'Interno (sem cliente)' });
  const blocos = grupos.map((g) => {
    const lista = estado.projetos.filter((p) => (p.cliente_id ?? null) === g.id)
      .sort((a, b) => ordem[a.status] - ordem[b.status] || (a.fim ?? '9').localeCompare(b.fim ?? '9'));
    if (!lista.length) return '';
    return `<div class="painel" style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <h2>${esc(g.nome)}</h2>
        ${pode(s, 'projetos', 'criar') && g.id ? `<button class="botao pequeno" data-novo-para="${g.id}">+ Projeto para ${esc(g.nome)}</button>` : ''}</div>
      <table class="tabela" style="table-layout:fixed"><colgroup><col style="width:28%"><col style="width:17%"><col style="width:11%"><col style="width:16%"><col style="width:16%"><col style="width:12%"></colgroup><thead><tr><th>Projeto</th><th>Tipo</th><th>Status</th><th>Período</th><th>Andamento</th><th></th></tr></thead>
      <tbody>${lista.map(linha).join('')}</tbody></table></div>`;
  }).join('');
  el.innerHTML = `
    <div class="cabecalho"><div><div class="sobre">Projetos</div><h1>Projetos por cliente</h1></div>
      ${pode(s, 'projetos', 'criar') ? '<button class="botao primario" id="novo">+ Novo projeto</button>' : ''}</div>
    ${blocos || '<div class="painel vazio">Nenhum projeto cadastrado.</div>'}`;
  el.querySelector('#novo')?.addEventListener('click', () => abrirProjeto(ctx, null));
  el.querySelectorAll('[data-novo-para]').forEach((b) => b.addEventListener('click', () => abrirProjeto(ctx, null, b.dataset.novoPara)));
  el.querySelectorAll('tr[data-id]').forEach((tr) => tr.addEventListener('click', () => abrirProjeto(ctx, estado.projetos.find((p) => p.id === tr.dataset.id))));
  el.querySelectorAll('[data-quadro]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    Object.assign(filtros, { projeto: b.dataset.quadro, responsavel: '', setor: '', busca: '' });
    ctx.navegar('atividades');
  }));
}

export function abrirProjeto(ctx, projeto, clienteId = '', aoSalvar) {
  const s = ctx.estado.sessao;
  const novo = !projeto;
  const p = projeto ?? { nome: '', cliente_id: clienteId, tipo: '', status: 'ativo', inicio: '', fim: '', descricao: '' };
  const podeSalvar = novo ? pode(s, 'projetos', 'criar') : pode(s, 'projetos', 'editar');
  const dis = podeSalvar ? '' : 'disabled';
  const clientes = ctx.estado.clientes.map((c) => ({ chave: c.id, nome: c.nome }));
  const { el, fechar } = abrirModal({
    titulo: novo ? 'Novo projeto' : esc(p.nome),
    corpo: `<form class="grade-campos" id="form-projeto">
      <div class="campo inteiro"><label>Nome do projeto</label><input type="text" name="nome" required value="${esc(p.nome)}" ${dis}></div>
      <div class="campo"><label>Cliente</label><select name="cliente_id" ${dis}>${opcoes(clientes, p.cliente_id, 'Sem cliente (interno)')}</select></div>
      <div class="campo"><label>Tipo</label><input type="text" name="tipo" value="${esc(p.tipo)}" placeholder="Rebranding, conteúdo mensal, site..." ${dis}></div>
      <div class="campo"><label>Início</label><input type="date" name="inicio" value="${esc(p.inicio ?? '')}" ${dis}></div>
      <div class="campo"><label>Fim previsto</label><input type="date" name="fim" value="${esc(p.fim ?? '')}" ${dis}></div>
      <div class="campo"><label>Status</label><select name="status" ${dis}>${opcoes(STATUS_PROJETO, p.status)}</select></div>
      <div class="campo inteiro"><label>Descrição</label><textarea name="descricao" ${dis}>${esc(p.descricao)}</textarea></div></form>`,
    rodape: `${!novo && pode(s, 'projetos', 'apagar') ? '<button class="botao perigo" id="apagar">Apagar</button>' : ''}<span class="espaco"></span>
      ${podeSalvar ? '<button class="botao primario" id="salvar">Salvar</button>' : ''}`,
  });
  $('#salvar', el)?.addEventListener('click', async () => {
    const form = $('#form-projeto', el);
    if (!form.reportValidity()) return;
    const f = Object.fromEntries(new FormData(form));
    const dados = { ...f, cliente_id: f.cliente_id || null, inicio: f.inicio || null, fim: f.fim || null };
    try {
      if (novo) await ctx.db().inserir('projetos', dados); else await ctx.db().atualizar('projetos', p.id, dados);
      fechar(); avisar('Projeto salvo'); await ctx.recarregar(); aoSalvar?.();
    } catch (err) { avisar(err.message); }
  });
  $('#apagar', el)?.addEventListener('click', async (e) => {
    if (e.target.dataset.confirmar !== 'sim') { e.target.dataset.confirmar = 'sim'; e.target.textContent = 'Clique de novo para apagar'; return; }
    try { await ctx.db().apagar('projetos', p.id); fechar(); avisar('Projeto apagado'); await ctx.recarregar(); aoSalvar?.(); } catch (err) { avisar(err.message); }
  });
}
