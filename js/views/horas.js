// Registro de horas: cada pessoa lança o tempo que gastou, ligado (ou não) a
// um projeto e a uma tarefa. Aba "Minhas horas" para todos; aba "Equipe" para
// quem tem a permissão "Registro de horas". Quem bloqueia de verdade é o banco.
import { pode, podeVerTarefa } from '../permissoes.js';
import { esc, $, $$, avisar, hoje, nomeMes, paraData } from '../util.js';
import { abrirModal } from './modal.js';

const tela = { aba: 'minhas', mes: hoje().slice(0, 7), pessoa: '' };
const CHAVE_CRONOMETRO = 'look-cronometro-v1';
let relogio = null;

// 90 → "1h30"; 45 → "45min"; 120 → "2h".
export function duracao(min) {
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return `${m}min`;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

// Aceita "1:30", "1h30", "1h", "45min", "1,5" (horas) e "90" (minutos, se
// passar de 24). Devolve minutos ou NaN.
export function lerDuracao(texto) {
  const t = String(texto ?? '').trim().toLowerCase().replace(/\s+/g, '');
  if (!t) return NaN;
  let m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (m) return Number(m[2]) < 60 ? Number(m[1]) * 60 + Number(m[2]) : NaN;
  m = t.match(/^(\d{1,2})h(?:(\d{1,2})(?:m|min)?)?$/);
  if (m) return (m[2] && Number(m[2]) >= 60) ? NaN : Number(m[1]) * 60 + Number(m[2] ?? 0);
  m = t.match(/^(\d{1,4})(?:m|min)$/);
  if (m) return Number(m[1]);
  m = t.match(/^(\d{1,4})(?:[.,](\d{1,2}))?$/);
  if (m) {
    const n = Number(`${m[1]}.${m[2] ?? 0}`);
    return n <= 24 ? Math.round(n * 60) : (m[2] ? NaN : n);
  }
  return NaN;
}

const nomeDoMes = (chave) => { const [a, m] = chave.split('-').map(Number); const n = nomeMes(m - 1); return `${n[0].toUpperCase()}${n.slice(1)} de ${a}`; };
function outroMes(chave, passo) {
  const [a, m] = chave.split('-').map(Number);
  const d = new Date(a, m - 1 + passo, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
const somar = (lista) => lista.reduce((t, h) => t + h.minutos, 0);

// Cronômetro: guarda só a hora em que começou, neste navegador.
function lerCronometro() {
  try { const c = JSON.parse(localStorage.getItem(CHAVE_CRONOMETRO)); return c && Number.isFinite(c.inicio) ? c : null; } catch { return null; }
}
function gravarCronometro(c) {
  try { if (c) localStorage.setItem(CHAVE_CRONOMETRO, JSON.stringify(c)); else localStorage.removeItem(CHAVE_CRONOMETRO); } catch { /* sem armazenamento: o cronômetro só não sobrevive ao recarregar */ }
}
const relogioTexto = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export async function render(el, ctx) {
  const s = ctx.estado.sessao;
  const eu = s.perfil.id;
  const veEquipe = pode(s, 'horas', 'ver');
  if (!veEquipe) tela.aba = 'minhas';
  const equipe = tela.aba === 'equipe';

  const todas = await ctx.db().listar('horas');
  const doMes = todas.filter((h) => h.data.startsWith(tela.mes) && (equipe ? (!tela.pessoa || h.usuario_id === tela.pessoa) : h.usuario_id === eu))
    .sort((a, b) => b.data.localeCompare(a.data) || (b.criado_em ?? '').localeCompare(a.criado_em ?? ''));
  const total = somar(doMes);
  const hojeTotal = somar(doMes.filter((h) => h.data === hoje()));
  const dias = new Set(doMes.map((h) => h.data)).size;

  const nomeProjeto = (id) => {
    const p = ctx.projeto(id);
    if (!p) return 'Sem projeto';
    const c = ctx.cliente(p.cliente_id);
    return c ? `${c.nome} · ${p.nome}` : p.nome;
  };
  const tarefa = (id) => ctx.estado.tarefas.find((t) => t.id === id);
  const barras = (grupos) => {
    const lista = Object.entries(grupos).sort((a, b) => b[1] - a[1]);
    return lista.map(([nome, min]) => `
      <div class="categoria-gasto"><div class="linha-cat"><span>${esc(nome)}</span><b>${duracao(min)}</b></div>
        <div class="barra"><span style="width:${Math.max(2, Math.round((min / total) * 100))}%"></span></div></div>`).join('');
  };
  const porProjeto = {};
  for (const h of doMes) { const n = nomeProjeto(h.projeto_id); porProjeto[n] = (porProjeto[n] ?? 0) + h.minutos; }
  const porPessoa = {};
  for (const h of doMes) { const n = ctx.nomePerfil(h.usuario_id) || 'Alguém'; porPessoa[n] = (porPessoa[n] ?? 0) + h.minutos; }

  const linhas = doMes.map((h) => {
    const d = paraData(h.data);
    const t = tarefa(h.tarefa_id);
    const sub = [nomeProjeto(h.projeto_id), t?.titulo].filter(Boolean).map(esc).join(' · ');
    return `<tr class="clicavel" data-id="${esc(h.id)}">
      <td class="fraco">${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}</td>
      ${equipe ? `<td>${esc(ctx.nomePerfil(h.usuario_id) || 'Alguém')}</td>` : ''}
      <td><b>${esc(h.descricao || 'Sem descrição')}</b><div class="fraco">${sub}</div></td>
      <td class="duracao-hora">${duracao(h.minutos)}</td></tr>`;
  }).join('');

  const crono = lerCronometro();
  const pessoas = [...ctx.estado.perfis].filter((p) => p.ativo !== false).sort((a, b) => a.nome.localeCompare(b.nome));
  el.innerHTML = `
    <div class="cabecalho"><div><div class="sobre">Registro de horas</div><h1>${equipe ? 'Horas da equipe' : 'Minhas horas'}</h1></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="botao ${crono ? 'rodando' : ''}" id="cronometro" title="${crono ? 'Para e lança o tempo contado' : 'Conta o tempo enquanto você trabalha'}">${crono ? `⏹ Parar <span id="tempo-cronometro">${relogioTexto(Date.now() - crono.inicio)}</span>` : '▶ Iniciar cronômetro'}</button>
        <button class="botao primario" id="nova-hora">+ Lançar horas</button></div></div>
    ${veEquipe ? `<div class="abas"><button class="aba ${equipe ? '' : 'ativa'}" data-aba="minhas">Minhas horas</button><button class="aba ${equipe ? 'ativa' : ''}" data-aba="equipe">Equipe</button></div>` : ''}
    <div class="navega-mes"><button class="botao sutil" id="mes-antes" title="Mês anterior">‹</button>
      <b id="nome-mes">${nomeDoMes(tela.mes)}</b><button class="botao sutil" id="mes-depois" title="Próximo mês">›</button>
      ${tela.mes !== hoje().slice(0, 7) ? '<button class="botao pequeno sutil" id="mes-hoje">Voltar para este mês</button>' : ''}
      ${equipe ? `<select id="filtro-pessoa"><option value="">Toda a equipe</option>${pessoas.map((p) => `<option value="${esc(p.id)}" ${tela.pessoa === p.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select>` : ''}</div>
    <div class="numeros financas">
      <div class="numero"><div class="rotulo">No mês</div><div class="valor" id="total-mes">${duracao(total)}</div></div>
      <div class="numero"><div class="rotulo">Hoje</div><div class="valor" id="total-hoje">${duracao(hojeTotal)}</div></div>
      <div class="numero"><div class="rotulo">Dias com horas</div><div class="valor">${dias}</div></div>
      <div class="numero"><div class="rotulo">Média por dia</div><div class="valor">${duracao(dias ? Math.round(total / dias) : 0)}</div></div>
    </div>
    <div class="duas-colunas financas">
      <div class="painel">${linhas ? `<table class="tabela lista-horas"><thead><tr><th>Dia</th>${equipe ? '<th>Pessoa</th>' : ''}<th>O que fez</th><th style="text-align:right">Tempo</th></tr></thead><tbody>${linhas}</tbody></table>`
        : `<div class="vazio">Nenhuma hora lançada em ${nomeDoMes(tela.mes).toLowerCase()}. Use "+ Lançar horas" ou o cronômetro.</div>`}</div>
      <div class="painel"><h2>Por projeto</h2><div style="margin-top:12px" id="por-projeto">${barras(porProjeto) || '<div class="vazio">Nada neste mês.</div>'}</div>
        ${equipe ? `<h2 style="margin-top:18px">Por pessoa</h2><div style="margin-top:12px" id="por-pessoa">${barras(porPessoa) || '<div class="vazio">Nada neste mês.</div>'}</div>` : ''}</div>
    </div>`;

  const redesenhar = () => render(el, ctx);
  $$('[data-aba]', el).forEach((b) => b.addEventListener('click', () => { tela.aba = b.dataset.aba; redesenhar(); }));
  $('#mes-antes', el).addEventListener('click', () => { tela.mes = outroMes(tela.mes, -1); redesenhar(); });
  $('#mes-depois', el).addEventListener('click', () => { tela.mes = outroMes(tela.mes, 1); redesenhar(); });
  $('#mes-hoje', el)?.addEventListener('click', () => { tela.mes = hoje().slice(0, 7); redesenhar(); });
  $('#filtro-pessoa', el)?.addEventListener('change', (e) => { tela.pessoa = e.target.value; redesenhar(); });
  $('#nova-hora', el).addEventListener('click', () => abrirHora(ctx, null, {}, redesenhar));
  $$('tr[data-id]', el).forEach((tr) => tr.addEventListener('click', () => abrirHora(ctx, doMes.find((h) => h.id === tr.dataset.id), {}, redesenhar)));
  $('#cronometro', el).addEventListener('click', () => {
    const c = lerCronometro();
    if (!c) { gravarCronometro({ inicio: Date.now() }); avisar('Cronômetro ligado. Pode trocar de tela: ele continua contando.'); redesenhar(); return; }
    const minutos = Math.min(1440, Math.max(1, Math.round((Date.now() - c.inicio) / 60000)));
    abrirHora(ctx, null, { minutos, data: hoje() }, async () => { gravarCronometro(null); await redesenhar(); });
  });

  clearInterval(relogio);
  if (crono) {
    relogio = setInterval(() => {
      const alvo = document.getElementById('tempo-cronometro');
      const atual = lerCronometro();
      if (!alvo || !atual) { clearInterval(relogio); return; }
      alvo.textContent = relogioTexto(Date.now() - atual.inicio);
    }, 1000);
  }
}

export function abrirHora(ctx, registro, padrao, depois) {
  const s = ctx.estado.sessao;
  const eu = s.perfil.id;
  const novo = !registro;
  const diaPadrao = tela.mes === hoje().slice(0, 7) ? hoje() : `${tela.mes}-01`;
  const h = registro ?? { usuario_id: eu, projeto_id: null, tarefa_id: null, data: diaPadrao, minutos: null, descricao: '', ...padrao };
  const minha = h.usuario_id === eu;
  const podeSalvar = s.perfil.ativo !== false && (novo || minha || pode(s, 'horas', 'editar'));
  const podeApagar = !novo && (minha || pode(s, 'horas', 'apagar'));
  const dis = podeSalvar ? '' : 'disabled';
  const projetos = [...ctx.estado.projetos]
    .map((p) => ({ id: p.id, nome: ctx.cliente(p.cliente_id) ? `${ctx.cliente(p.cliente_id).nome} · ${p.nome}` : p.nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
  const tarefas = ctx.estado.tarefas.filter((t) => podeVerTarefa(s, t));
  const pessoas = [...ctx.estado.perfis].filter((p) => p.ativo !== false).sort((a, b) => a.nome.localeCompare(b.nome));
  const opcoesTarefa = (projetoId, atual) => `<option value="">Nenhuma</option>${tarefas
    .filter((t) => (projetoId ? t.projeto_id === projetoId : true) && (t.status !== 'feito' || t.id === atual))
    .sort((a, b) => a.titulo.localeCompare(b.titulo))
    .map((t) => `<option value="${esc(t.id)}" ${t.id === atual ? 'selected' : ''}>${esc(t.titulo)}</option>`).join('')}`;

  const { el, fechar } = abrirModal({
    titulo: novo ? 'Lançar horas' : 'Horas lançadas',
    corpo: `<form class="grade-campos" id="form-hora">
      ${novo && s.perfil.admin ? `<div class="campo inteiro"><label>De quem</label><select name="usuario_id">${pessoas.map((p) => `<option value="${esc(p.id)}" ${p.id === h.usuario_id ? 'selected' : ''}>${esc(p.nome)}${p.id === eu ? ' (você)' : ''}</option>`).join('')}</select></div>`
        : !minha ? `<div class="campo inteiro"><label>De quem</label><input type="text" disabled value="${esc(ctx.nomePerfil(h.usuario_id) || 'Alguém')}"></div>` : ''}
      <div class="campo"><label>Dia</label><input type="date" name="data" required value="${esc(h.data)}" ${dis}></div>
      <div class="campo"><label>Duração</label><input type="text" name="duracao" required inputmode="numeric" placeholder="Ex.: 1:30 ou 45min" value="${h.minutos ? esc(duracao(h.minutos)) : ''}" ${dis}>
        <div class="fraco" id="previa-duracao">${h.minutos ? `= ${duracao(h.minutos)}` : 'Escreva 1:30, 1h30, 2 (horas) ou 45min.'}</div></div>
      <div class="campo inteiro"><label>Projeto</label><select name="projeto_id" ${dis}><option value="">Sem projeto (tarefa interna)</option>
        ${projetos.map((p) => `<option value="${esc(p.id)}" ${p.id === h.projeto_id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></div>
      <div class="campo inteiro"><label>Tarefa (opcional)</label><select name="tarefa_id" ${dis}>${opcoesTarefa(h.projeto_id, h.tarefa_id)}</select></div>
      <div class="campo inteiro"><label>O que você fez</label><textarea name="descricao" maxlength="1000" rows="2" placeholder="Ex.: Edição do reels, reunião com o cliente" ${dis}>${esc(h.descricao)}</textarea></div>
    </form><div class="erro" id="erro-hora"></div>`,
    rodape: `${podeApagar ? '<button class="botao perigo" id="apagar-hora">Apagar</button>' : ''}<span class="espaco"></span>
      ${podeSalvar ? '<button class="botao primario" id="salvar-hora">Salvar</button>' : ''}`,
  });

  const form = $('#form-hora', el);
  const erro = $('#erro-hora', el);
  form.addEventListener('submit', (e) => { e.preventDefault(); $('#salvar-hora', el)?.click(); });
  form.duracao.addEventListener('input', () => {
    const min = lerDuracao(form.duracao.value);
    $('#previa-duracao', el).textContent = min >= 1 && min <= 1440 ? `= ${duracao(min)}` : 'Escreva 1:30, 1h30, 2 (horas) ou 45min.';
  });
  // Escolher o projeto filtra as tarefas; escolher a tarefa acerta o projeto.
  form.projeto_id.addEventListener('change', () => { form.tarefa_id.innerHTML = opcoesTarefa(form.projeto_id.value || null, form.tarefa_id.value); });
  form.tarefa_id.addEventListener('change', () => {
    const t = tarefas.find((x) => x.id === form.tarefa_id.value);
    if (t?.projeto_id && form.projeto_id.value !== t.projeto_id) { form.projeto_id.value = t.projeto_id; form.tarefa_id.innerHTML = opcoesTarefa(t.projeto_id, t.id); }
  });

  $('#salvar-hora', el)?.addEventListener('click', async (e) => {
    erro.textContent = '';
    if (!form.reportValidity()) return;
    const minutos = lerDuracao(form.duracao.value);
    if (!(minutos >= 1 && minutos <= 1440)) { erro.textContent = 'Confira a duração: de 1 minuto a 24 horas (ex.: 1:30).'; form.duracao.focus(); return; }
    const dados = { data: form.data.value, minutos, projeto_id: form.projeto_id.value || null, tarefa_id: form.tarefa_id.value || null, descricao: form.descricao.value.trim() };
    if (novo && form.usuario_id) dados.usuario_id = form.usuario_id.value;
    const botao = e.currentTarget;
    botao.disabled = true;
    try {
      if (novo) await ctx.db().inserir('horas', dados); else await ctx.db().atualizar('horas', h.id, dados);
      fechar(); avisar(novo ? `${duracao(minutos)} lançadas` : 'Horas salvas'); await depois();
    } catch (err) { erro.textContent = err.message; botao.disabled = false; }
  });
  $('#apagar-hora', el)?.addEventListener('click', async (e) => {
    const b = e.currentTarget;
    if (b.dataset.confirmar !== 'sim') { b.dataset.confirmar = 'sim'; b.textContent = 'Clique de novo para apagar'; return; }
    try { await ctx.db().apagar('horas', h.id); fechar(); avisar('Horas apagadas'); await depois(); } catch (err) { erro.textContent = err.message; }
  });
}
