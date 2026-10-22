import { SETORES, STATUS, nomeDe } from '../config.js';
import { pode } from '../permissoes.js';
import { esc, nomeMes, DIAS_SEMANA, chaveDia, hoje, hora, diaDaTarefa } from '../util.js';
import { ligarTarefas, barraFiltros, ligarFiltros, aplicarFiltros, corDaTarefa } from './comum.js';

let mesVisto = null; // primeiro dia do mês na tela
let aba = 'equipe'; // 'equipe' ou 'postagens'

// Duas agendas: a da equipe (tudo menos posts) e a de postagens (só posts).
const ABAS = {
  equipe: { nome: 'Agenda da equipe', titulo: 'Agenda da equipe', botao: '+ Novo compromisso', filtro: (t) => t.tipo !== 'post', padrao: { tipo: 'reuniao' } },
  postagens: { nome: 'Agenda de postagens', titulo: 'Agenda de postagens', botao: '+ Nova postagem', filtro: (t) => t.tipo === 'post', padrao: { tipo: 'post', setor: 'criacao' } },
};

export async function render(el, ctx) {
  if (!mesVisto) { const d = new Date(); mesVisto = new Date(d.getFullYear(), d.getMonth(), 1); }
  const atual = ABAS[aba];
  el.innerHTML = `
    <div class="cabecalho"><div><div class="sobre">Calendário</div><h1>${atual.titulo}</h1></div>
      ${pode(ctx.estado.sessao, 'tarefas', 'criar') ? `<button class="botao primario" id="nova">${atual.botao}</button>` : ''}</div>
    <div class="abas">${Object.entries(ABAS).map(([chave, a]) => `<button class="aba ${chave === aba ? 'ativa' : ''}" data-aba="${chave}">${a.nome}</button>`).join('')}</div>
    ${barraFiltros(ctx)}
    <div class="cal-topo">
      <button class="botao pequeno" id="anterior">‹</button><button class="botao pequeno" id="hoje">Hoje</button><button class="botao pequeno" id="proximo">›</button>
      <h2 id="titulo-mes"></h2>
    </div>
    <div class="calendario" id="grade"></div>
    <div class="legenda">${aba === 'equipe' ? SETORES.map((s) => `<span><span class="ponto ${s.chave}"></span> ${s.nome}</span>`).join('') : ''}<span class="fraco">Clique num dia vazio para marcar algo nele.</span></div>`;

  const desenhar = () => desenharMes(el, ctx);
  el.querySelector('#nova')?.addEventListener('click', () => ctx.abrirTarefa(null, { ...atual.padrao, prazo: hoje() }));
  el.querySelectorAll('[data-aba]').forEach((b) => b.addEventListener('click', () => { aba = b.dataset.aba; render(el, ctx); }));
  el.querySelector('#anterior').onclick = () => { mesVisto = new Date(mesVisto.getFullYear(), mesVisto.getMonth() - 1, 1); desenhar(); };
  el.querySelector('#proximo').onclick = () => { mesVisto = new Date(mesVisto.getFullYear(), mesVisto.getMonth() + 1, 1); desenhar(); };
  el.querySelector('#hoje').onclick = () => { const d = new Date(); mesVisto = new Date(d.getFullYear(), d.getMonth(), 1); desenhar(); };
  ligarFiltros(ctx, el, desenhar);
  desenhar();
}

const nomeCliente = (ctx, t) => ctx.cliente(ctx.projeto(t.projeto_id)?.cliente_id)?.nome ?? 'LOOK';

function desenharMes(el, ctx) {
  el.querySelector('#titulo-mes').textContent = `${nomeMes(mesVisto.getMonth())} ${mesVisto.getFullYear()}`;
  const porDia = {};
  const atual = ABAS[aba];
  for (const t of aplicarFiltros(ctx, ctx.estado.tarefas).filter(atual.filtro)) {
    const d = diaDaTarefa(t);
    if (d) (porDia[d] ??= []).push(t);
  }
  const inicio = new Date(mesVisto);
  inicio.setDate(1 - inicio.getDay());
  const dias = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
    if (i === 35 && d.getMonth() !== mesVisto.getMonth()) break;
    dias.push(d);
  }
  const podeCriar = pode(ctx.estado.sessao, 'tarefas', 'criar');
  el.querySelector('#grade').innerHTML = DIAS_SEMANA.map((d) => `<div class="dia-semana">${d}</div>`).join('')
    + dias.map((d) => {
      const chave = chaveDia(d);
      const eventos = (porDia[chave] ?? []).sort((a, b) => (a.inicio ?? 'z').localeCompare(b.inicio ?? 'z'));
      return `<div class="dia ${d.getMonth() !== mesVisto.getMonth() ? 'fora' : ''} ${chave === hoje() ? 'hoje' : ''}" data-dia="${chave}">
        <span class="n">${d.getDate()}</span>
        ${eventos.map((t) => (aba === 'postagens'
          ? `<div class="evento post ${t.status === 'feito' ? 'feito' : ''}" data-tarefa="${t.id}" style="--cor-cliente:${corDaTarefa(ctx, t)}" title="${esc(t.titulo)} · ${nomeDe(STATUS, t.status)}">
              <small>${t.inicio ? `${hora(t.inicio)} · ` : ''}${esc(nomeCliente(ctx, t))}</small>${esc(t.titulo)}</div>`
          : `<div class="evento ${t.status === 'feito' ? 'feito' : ''}" data-tarefa="${t.id}" title="${esc(t.titulo)} · ${nomeDe(STATUS, t.status)}">
              <span class="ponto ${t.setor}"></span>${t.inicio ? `<b>${hora(t.inicio)}</b>` : ''} ${esc(t.titulo)}</div>`)).join('')}
      </div>`;
    }).join('');
  ligarTarefas(ctx, el.querySelector('#grade'));
  if (podeCriar) {
    el.querySelectorAll('.dia').forEach((dia) => dia.addEventListener('click', () => ctx.abrirTarefa(null, { ...atual.padrao, prazo: dia.dataset.dia })));
  }
}
