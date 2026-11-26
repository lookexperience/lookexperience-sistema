// Execução: as gravações da LOOK, com dia e horário, local, equipe,
// equipamentos e checklist. Segue a permissão "Execução"; quem está na equipe
// de uma gravação também a vê e marca o checklist. Quem bloqueia é o banco.
import { pode } from '../permissoes.js';
import { STATUS_GRAVACAO, CHECKLIST_PADRAO, nomeDe } from '../config.js';
import { esc, $, $$, avisar, chaveDia, hora, paraData, nomeMes, DIAS_SEMANA } from '../util.js';
import { abrirModal, opcoes } from './modal.js';
import { avatares, corCliente } from './comum.js';
import { STATUS_EQUIPAMENTO } from './equipamentos.js';

const tela = { filtro: 'proximas' };
const FILTROS = [
  { chave: 'proximas', nome: 'Próximas' },
  { chave: 'realizada', nome: 'Realizadas' },
  { chave: 'cancelada', nome: 'Canceladas' },
  { chave: 'todas', nome: 'Todas' },
];

// O menu mostra a tela para quem tem a permissão ou está em alguma gravação.
export const temGravacao = (estado) => (estado.gravacoes ?? []).length > 0;

const doisDigitos = (n) => String(n).padStart(2, '0');
const horaCampo = (v) => { const d = paraData(v); return d ? `${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}` : ''; };
const diaPorExtenso = (dia) => { const d = paraData(dia); return `${DIAS_SEMANA[d.getDay()]}, ${d.getDate()} de ${nomeMes(d.getMonth())}`; };
const progresso = (g) => `${g.checklist.filter((i) => i.feito).length}/${g.checklist.length}`;
const sobrepoe = (a, b) => {
  const fimA = Date.parse(a.fim ?? a.inicio) || Date.parse(a.inicio);
  const fimB = Date.parse(b.fim ?? b.inicio) || Date.parse(b.inicio);
  return Date.parse(a.inicio) <= fimB && Date.parse(b.inicio) <= fimA;
};

export async function render(el, ctx) {
  const s = ctx.estado.sessao;
  const todas = (await ctx.db().listar('gravacoes')).sort((a, b) => a.inicio.localeCompare(b.inicio));
  ctx.estado.gravacoes = todas;
  const equipamentos = pode(s, 'equipamentos', 'ver') ? await ctx.db().listar('equipamentos').catch(() => []) : [];
  const agora = Date.now();
  const lista = todas.filter((g) => (tela.filtro === 'todas' ? true
    : tela.filtro === 'proximas' ? g.status === 'agendada' && (Date.parse(g.fim ?? g.inicio) >= agora - 12 * 3600e3 || chaveDia(g.inicio) >= chaveDia(new Date()))
      : g.status === tela.filtro));
  if (tela.filtro === 'realizada' || tela.filtro === 'cancelada') lista.reverse();

  const porDia = new Map();
  for (const g of lista) { const dia = chaveDia(g.inicio); if (!porDia.has(dia)) porDia.set(dia, []); porDia.get(dia).push(g); }
  const linha = (g) => {
    const projeto = ctx.projeto(g.projeto_id);
    const cliente = ctx.cliente(projeto?.cliente_id);
    return `<div class="gravacao" data-gravacao="${esc(g.id)}" style="--cor-cliente:${corCliente(cliente)}">
      <div class="horario">${esc(hora(g.inicio))}${g.fim ? `<span class="fraco">até ${esc(hora(g.fim))}</span>` : ''}</div>
      <div class="info"><b>${esc(g.titulo)}</b>
        <div class="fraco">${esc([cliente?.nome, projeto?.nome].filter(Boolean).join(' · ') || 'Sem projeto')}${g.local ? ` · ${esc(g.local)}` : ''}</div></div>
      <div class="rodape">${g.status !== 'agendada' ? `<span class="etiqueta grav-${esc(g.status)}">${esc(nomeDe(STATUS_GRAVACAO, g.status))}</span>` : ''}
        ${g.equipamentos.length ? `<span class="etiqueta" title="Equipamentos">${g.equipamentos.length} equip.</span>` : ''}
        ${g.checklist.length ? `<span class="etiqueta ${g.checklist.every((i) => i.feito) ? 'checklist-ok' : ''}" title="Checklist">✓ ${progresso(g)}</span>` : ''}
        ${avatares(ctx, { responsaveis: g.equipe })}</div></div>`;
  };
  const dias = [...porDia].map(([dia, gs]) => `<section class="dia-gravacoes"><h3>${esc(diaPorExtenso(dia))}</h3>${gs.map(linha).join('')}</section>`).join('');

  el.innerHTML = `
    <div class="cabecalho"><div><div class="sobre">Execução</div><h1>Gravações</h1></div>
      ${pode(s, 'execucao', 'criar') ? '<button class="botao primario" id="nova-gravacao">+ Nova gravação</button>' : ''}</div>
    <div class="abas abas-orc">${FILTROS.map((f) => `<button class="aba ${tela.filtro === f.chave ? 'ativa' : ''}" data-filtro="${f.chave}">${f.nome}</button>`).join('')}</div>
    <div class="painel lista-gravacoes">${dias || `<div class="vazio">${todas.length ? 'Nenhuma gravação neste filtro.' : 'Nenhuma gravação agendada ainda.'}</div>`}</div>`;

  const redesenhar = () => render(el, ctx);
  $$('[data-filtro]', el).forEach((b) => b.addEventListener('click', () => { tela.filtro = b.dataset.filtro; redesenhar(); }));
  $('#nova-gravacao', el)?.addEventListener('click', () => abrirGravacao(ctx, null, { todas, equipamentos, aoMudar: redesenhar }));
  $$('[data-gravacao]', el).forEach((d) => d.addEventListener('click', () => abrirGravacao(ctx, todas.find((g) => g.id === d.dataset.gravacao), { todas, equipamentos, aoMudar: redesenhar })));

  // Vindo de um aviso ("Gravação com você..."): abre a gravação.
  if (ctx.estado.abrirGravacao) {
    const alvo = todas.find((g) => g.id === ctx.estado.abrirGravacao);
    ctx.estado.abrirGravacao = null;
    if (alvo) abrirGravacao(ctx, alvo, { todas, equipamentos, aoMudar: redesenhar });
  }
}

function itemChecklist(item, i, podeMudarTexto) {
  return `<li class="item-checklist" data-item="${i}"><label class="marcar"><input type="checkbox" data-feito ${item.feito ? 'checked' : ''}>
    <span class="texto-item">${esc(item.texto)}</span></label>${podeMudarTexto ? `<button type="button" class="botao sutil pequeno" data-tirar-item title="Tirar item">×</button>` : ''}</li>`;
}

export function abrirGravacao(ctx, gravacao, { todas, equipamentos, aoMudar }) {
  const s = ctx.estado.sessao;
  const nova = !gravacao;
  const amanha = new Date(); amanha.setDate(amanha.getDate() + 1);
  const g = gravacao ?? { titulo: '', projeto_id: null, inicio: `${chaveDia(amanha)}T09:00`, fim: null, local: '', equipe: [s.perfil.id], equipamentos: [],
    checklist: CHECKLIST_PADRAO.map((texto) => ({ texto, feito: false })), observacoes: '', status: 'agendada' };
  const podeTudo = pode(s, 'execucao', nova ? 'criar' : 'editar');
  const naEquipe = !nova && g.equipe.includes(s.perfil.id);
  const podeMarcar = podeTudo || naEquipe;
  const dis = podeTudo ? '' : 'disabled';
  let checklist = structuredClone(g.checklist);

  const projetos = ctx.estado.projetos.filter((p) => p.status !== 'concluido' || p.id === g.projeto_id)
    .map((p) => ({ chave: p.id, nome: `${ctx.cliente(p.cliente_id)?.nome ?? 'Interno'} · ${p.nome}` })).sort((a, b) => a.nome.localeCompare(b.nome));
  const pessoas = ctx.estado.perfis.filter((p) => p.ativo || g.equipe.includes(p.id)).sort((a, b) => a.nome.localeCompare(b.nome));
  const escolhaPessoas = pessoas.map((p) => `<label class="pessoa"><input type="checkbox" name="equipe" value="${esc(p.id)}" ${g.equipe.includes(p.id) ? 'checked' : ''} ${dis}><span>${esc(p.nome)}</span></label>`).join('');
  const nomeEquip = (id) => equipamentos.find((e) => e.id === id)?.nome;
  // Equipamento já reservado em outra gravação agendada no mesmo horário.
  const conflito = (id, inicio, fim) => todas.find((o) => o.id !== g.id && o.status === 'agendada' && o.equipamentos.includes(id) && sobrepoe(o, { inicio, fim }));
  const escolhaEquip = () => {
    if (!equipamentos.length) {
      return g.equipamentos.length ? `<span class="fraco">${g.equipamentos.length} equipamento(s) reservado(s).</span>` : '<span class="fraco">Nenhum equipamento cadastrado (ou sem permissão para ver Equipamentos).</span>';
    }
    return [...equipamentos].sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nome.localeCompare(b.nome)).map((e) => {
      const fora = e.status !== 'disponivel' && e.status !== 'em_uso' ? ` · ${nomeDe(STATUS_EQUIPAMENTO, e.status)}` : '';
      return `<label class="pessoa equip" data-equip="${esc(e.id)}"><input type="checkbox" name="equipamentos" value="${esc(e.id)}" ${g.equipamentos.includes(e.id) ? 'checked' : ''} ${dis}>
        <span>${esc(e.nome)}<span class="fraco">${esc(fora)}</span></span></label>`;
    }).join('');
  };

  const titulo = nova ? 'Nova gravação' : esc(g.titulo);
  const { el, fechar } = abrirModal({
    titulo, largo: true,
    corpo: `<form class="grade-campos" id="form-gravacao">
      <div class="campo inteiro"><label>Gravação</label><input type="text" name="titulo" maxlength="200" required value="${esc(g.titulo)}" ${dis} placeholder="Ex.: Reels da inauguração"></div>
      <div class="campo"><label>Projeto</label><select name="projeto_id" ${dis}>${opcoes(projetos, g.projeto_id, 'Sem projeto')}</select></div>
      <div class="campo"><label>Local</label><input type="text" name="local" maxlength="300" value="${esc(g.local)}" ${dis} placeholder="Endereço ou nome do lugar"></div>
      <div class="campo"><label>Dia</label><input type="date" name="dia" required value="${esc(chaveDia(g.inicio))}" ${dis}></div>
      <div class="campo horarios"><div><label>Começa</label><input type="time" name="hora_inicio" required value="${esc(horaCampo(g.inicio))}" ${dis}></div>
        <div><label>Termina</label><input type="time" name="hora_fim" value="${esc(horaCampo(g.fim))}" ${dis}></div></div>
      <div class="campo"><label>Situação</label><select name="status" ${podeMarcar ? '' : 'disabled'}>${opcoes(STATUS_GRAVACAO, g.status)}</select></div>
      <div class="campo inteiro"><label>Equipe</label><div class="escolha-pessoas">${escolhaPessoas}</div></div>
      <div class="campo inteiro"><label>Equipamentos</label><div class="escolha-pessoas" id="equipamentos-gravacao">${escolhaEquip()}</div><div class="aviso-conflito" id="conflitos"></div></div>
      <div class="campo inteiro"><label>Checklist <span class="fraco" id="progresso-checklist"></span></label>
        <ul class="checklist" id="checklist"></ul>
        ${podeTudo ? `<div class="novo-item"><input type="text" id="novo-item" maxlength="300" placeholder="Novo item do checklist"><button type="button" class="botao pequeno" id="adicionar-item">Adicionar</button></div>` : ''}</div>
      <div class="campo inteiro"><label>Observações (roteiro, contato no local, horário de chegada)</label><textarea name="observacoes" maxlength="20000" rows="3" ${dis}>${esc(g.observacoes)}</textarea></div>
    </form><div class="erro" id="erro-gravacao"></div>`,
    rodape: `${!nova && pode(s, 'execucao', 'apagar') ? '<button class="botao perigo" id="apagar-gravacao">Apagar</button>' : ''}<span class="espaco"></span>
      ${podeMarcar ? '<button class="botao primario" id="salvar-gravacao">Salvar</button>' : ''}`,
  });
  const form = $('#form-gravacao', el);
  const erro = $('#erro-gravacao', el);

  const desenharChecklist = () => {
    $('#checklist', el).innerHTML = checklist.map((item, i) => itemChecklist(item, i, podeTudo)).join('') || '<li class="fraco">Sem itens.</li>';
    $('#progresso-checklist', el).textContent = checklist.length ? `(${progresso({ checklist })} feitos)` : '';
    $$('[data-feito]', el).forEach((c) => {
      c.disabled = !podeMarcar;
      c.addEventListener('change', () => { checklist[c.closest('[data-item]').dataset.item].feito = c.checked; $('#progresso-checklist', el).textContent = `(${progresso({ checklist })} feitos)`; });
    });
    $$('[data-tirar-item]', el).forEach((b) => b.addEventListener('click', () => { checklist.splice(Number(b.closest('[data-item]').dataset.item), 1); desenharChecklist(); }));
  };
  desenharChecklist();
  const adicionar = () => {
    const campo = $('#novo-item', el);
    const texto = campo.value.trim();
    if (!texto) return;
    if (checklist.length >= 100) { erro.textContent = 'O checklist tem no máximo 100 itens.'; return; }
    checklist.push({ texto: texto.slice(0, 300), feito: false });
    campo.value = ''; desenharChecklist(); campo.focus();
  };
  $('#adicionar-item', el)?.addEventListener('click', adicionar);
  $('#novo-item', el)?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); adicionar(); } });

  const horario = () => {
    const dia = form.dia.value;
    const inicio = dia && form.hora_inicio.value ? new Date(`${dia}T${form.hora_inicio.value}`) : null;
    const fim = dia && form.hora_fim.value ? new Date(`${dia}T${form.hora_fim.value}`) : null;
    return { inicio, fim };
  };
  const mostrarConflitos = () => {
    const { inicio, fim } = horario();
    const alvo = $('#conflitos', el);
    if (!inicio) { alvo.textContent = ''; return; }
    const avisos = $$('[name=equipamentos]:checked', el).map((c) => {
      const o = conflito(c.value, inicio.toISOString(), (fim ?? inicio).toISOString());
      return o ? `${nomeEquip(c.value) ?? 'Equipamento'} também está reservado em "${o.titulo}" (${hora(o.inicio)}).` : '';
    }).filter(Boolean);
    alvo.textContent = avisos.join(' ');
  };
  form.addEventListener('change', mostrarConflitos);
  mostrarConflitos();
  form.addEventListener('submit', (e) => { e.preventDefault(); $('#salvar-gravacao', el)?.click(); });

  $('#salvar-gravacao', el)?.addEventListener('click', async () => {
    erro.textContent = '';
    let dados;
    if (podeTudo) {
      if (!form.reportValidity()) return;
      const { inicio, fim } = horario();
      if (!inicio || Number.isNaN(inicio.getTime())) { erro.textContent = 'Confira o dia e o horário de começo.'; return; }
      if (fim && fim < inicio) { erro.textContent = 'O horário de término precisa ser depois do começo.'; return; }
      dados = {
        titulo: form.titulo.value.trim(), projeto_id: form.projeto_id.value || null, local: form.local.value.trim(),
        inicio: inicio.toISOString(), fim: fim ? fim.toISOString() : null, status: form.status.value,
        equipe: $$('[name=equipe]:checked', el).map((c) => c.value),
        equipamentos: equipamentos.length ? $$('[name=equipamentos]:checked', el).map((c) => c.value) : g.equipamentos,
        checklist, observacoes: form.observacoes.value.trim(),
      };
    } else dados = { checklist, status: form.status.value };
    try {
      if (nova) await ctx.db().inserir('gravacoes', dados); else await ctx.db().atualizar('gravacoes', g.id, dados);
      fechar(); avisar(nova ? 'Gravação agendada' : 'Gravação salva'); await aoMudar();
    } catch (err) { erro.textContent = err.message; }
  });
  $('#apagar-gravacao', el)?.addEventListener('click', async (e) => {
    if (e.target.dataset.confirmar !== 'sim') { e.target.dataset.confirmar = 'sim'; e.target.textContent = 'Clique de novo para apagar'; return; }
    try { await ctx.db().apagar('gravacoes', g.id); fechar(); avisar('Gravação apagada'); await aoMudar(); } catch (err) { erro.textContent = err.message; }
  });
}
