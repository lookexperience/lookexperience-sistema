// Página do cliente: abre o briefing pelo link (briefing.html#código),
// mostra as perguntas e envia as respostas. Não precisa de login: o
// código do link, sorteado pelo banco, é a única chave, e só abre este
// briefing. As respostas ficam salvas neste navegador até o envio.
import { iniciarDados } from './dados.js';
import { esc, $, $$ } from './util.js';

const raiz = $('#briefing');
const token = location.hash.slice(1);
const CHAVE_RASCUNHO = `look-briefing-${token.slice(0, 16)}`;
const logo = '<img class="logo" src="img/logo-horizontal-branca.png" alt="LOOK">';

const mensagem = (titulo, texto) => {
  raiz.innerHTML = `${logo}<h1>${esc(titulo)}</h1><p class="mudo">${esc(texto)}</p>`;
};

function campo(q) {
  const nome = esc(q.id);
  const obrig = q.obrigatoria ? ' <span class="obrigatoria" title="Obrigatória">*</span>' : '';
  const titulo = `<div class="pergunta">${esc(q.pergunta)}${obrig}</div>`;
  const outro = (tipo) => (q.permite_outro
    ? `<label class="opcao"><input type="${tipo}" name="${nome}" value="__outro"> Outro: <input type="text" class="outro" data-outro="${nome}" maxlength="500"></label>` : '');
  switch (q.tipo) {
    case 'paragrafo':
      return `${titulo}<textarea name="${nome}" maxlength="10000" rows="4"></textarea>`;
    case 'data':
      return `${titulo}<input type="date" name="${nome}">`;
    case 'escala_1_5':
      return `${titulo}<div class="escala"><span class="fraco">${esc(q.rotulos?.[0] ?? '')}</span>
        ${[1, 2, 3, 4, 5].map((n) => `<label class="opcao"><input type="radio" name="${nome}" value="${n}"> ${n}</label>`).join('')}
        <span class="fraco">${esc(q.rotulos?.[1] ?? '')}</span></div>`;
    case 'escolha_unica':
      return `${titulo}<div class="opcoes">${(q.opcoes ?? []).map((o) => `<label class="opcao"><input type="radio" name="${nome}" value="${esc(o)}"> ${esc(o)}</label>`).join('')}${outro('radio')}</div>`;
    case 'multipla_escolha':
      return `${titulo}<div class="opcoes">${(q.opcoes ?? []).map((o) => `<label class="opcao"><input type="checkbox" name="${nome}" value="${esc(o)}"> ${esc(o)}</label>`).join('')}${outro('checkbox')}</div>`;
    default:
      return `${titulo}<input type="text" name="${nome}" maxlength="1000">`;
  }
}

// Lê o formulário: texto vira texto; várias escolhas viram lista.
function lerRespostas(form, perguntas) {
  const r = {};
  for (const q of perguntas) {
    const outro = $(`[data-outro="${CSS.escape(q.id)}"]`, form)?.value.trim();
    const valores = $$(`[name="${CSS.escape(q.id)}"]`, form)
      .filter((el) => !['radio', 'checkbox'].includes(el.type) || el.checked)
      .map((el) => (el.value === '__outro' ? (outro ? `Outro: ${outro}` : '') : el.value.trim()))
      .filter(Boolean);
    if (q.tipo === 'multipla_escolha') { if (valores.length) r[q.id] = valores.slice(0, 30); } else if (valores[0]) r[q.id] = valores[0].slice(0, 10000);
  }
  return r;
}

function preencher(form, r) {
  for (const [id, v] of Object.entries(r ?? {})) {
    const lista = Array.isArray(v) ? v : [v];
    for (const el of $$(`[name="${CSS.escape(id)}"]`, form)) {
      if (el.type === 'radio' || el.type === 'checkbox') {
        const outro = lista.find((x) => String(x).startsWith('Outro: '));
        el.checked = lista.includes(el.value) || (el.value === '__outro' && !!outro);
        if (el.value === '__outro' && outro) $(`[data-outro="${CSS.escape(id)}"]`, form).value = outro.slice(7);
      } else el.value = lista[0] ?? '';
    }
  }
}

async function iniciar() {
  if (!/^[0-9a-f]{64}$/.test(token)) { mensagem('Link incompleto', 'Confira se o link foi copiado inteiro, ou peça um novo para a LOOK.'); return; }
  let db;
  let briefing;
  try { db = await iniciarDados(); briefing = await db.abrirBriefing(token); } catch {
    mensagem('Não deu para abrir', 'Confira sua internet e tente de novo em alguns minutos.'); return;
  }
  if (!briefing) { mensagem('Link não encontrado', 'Este link não existe mais. Peça um novo para a LOOK.'); return; }
  if (briefing.status !== 'aguardando') { mensagem('Briefing já enviado', 'Recebemos suas respostas. Obrigado! Qualquer ajuste, fale direto com a LOOK.'); return; }

  const secoes = briefing.perguntas?.secoes ?? [];
  const perguntas = secoes.flatMap((s) => s.perguntas);
  raiz.innerHTML = `${logo}
    <div class="sobre">${esc(briefing.cliente)}</div>
    <h1>${esc(briefing.titulo)}</h1>
    <p class="descricao">${esc(briefing.perguntas?.descricao ?? '')}</p>
    <form id="form-briefing" novalidate>
      ${secoes.map((s) => `<section class="secao"><h2>${esc(s.titulo)}</h2>${s.ajuda ? `<p class="mudo">${esc(s.ajuda)}</p>` : ''}
        ${s.perguntas.map((q) => `<div class="questao" data-questao="${esc(q.id)}">${campo(q)}</div>`).join('')}</section>`).join('')}
      <p class="mudo">Suas respostas ficam guardadas neste navegador enquanto você preenche. Pode fechar e voltar pelo mesmo link.</p>
      <div id="erro-briefing" class="erro-briefing" role="alert"></div>
      <button type="submit" class="botao primario" id="enviar-briefing">Enviar briefing</button>
    </form>`;
  const form = $('#form-briefing');
  try { preencher(form, JSON.parse(localStorage.getItem(CHAVE_RASCUNHO) || 'null')); } catch { /* sem rascunho */ }
  form.addEventListener('input', () => {
    try { localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(lerRespostas(form, perguntas))); } catch { /* sem armazenamento */ }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const respostas = lerRespostas(form, perguntas);
    $$('.questao.faltando', form).forEach((el) => el.classList.remove('faltando'));
    const faltando = perguntas.filter((q) => q.obrigatoria && !respostas[q.id]);
    if (faltando.length) {
      faltando.forEach((q) => $(`[data-questao="${CSS.escape(q.id)}"]`, form).classList.add('faltando'));
      $('#erro-briefing').textContent = `Faltam ${faltando.length === 1 ? '1 resposta obrigatória' : `${faltando.length} respostas obrigatórias`} (marcadas com *).`;
      $(`[data-questao="${CSS.escape(faltando[0].id)}"]`, form).scrollIntoView({ block: 'center' });
      return;
    }
    const botao = $('#enviar-briefing');
    botao.disabled = true; botao.textContent = 'Enviando…';
    try {
      await db.enviarBriefing(token, respostas);
      try { localStorage.removeItem(CHAVE_RASCUNHO); } catch { /* ok */ }
      mensagem('Briefing enviado!', 'Recebemos suas respostas. Obrigado! A LOOK vai estudar tudo e falar com você sobre os próximos passos.');
      scrollTo(0, 0);
    } catch (err) {
      $('#erro-briefing').textContent = err.message;
      botao.disabled = false; botao.textContent = 'Enviar briefing';
    }
  });
}

// Trocar o código no endereço abre o outro briefing.
addEventListener('hashchange', () => location.reload());

iniciar();
