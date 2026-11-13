// Orçamentos: o gerador de orçamento da LOOK dentro do sistema. Cada
// orçamento fica salvo no banco, com número automático (2026-001...), cliente,
// status e, quando aprovado, a entrada "a receber" no Caixa da LOOK.
// Quem vê, cria, muda e apaga segue a permissão "Comercial e orçamentos";
// quem bloqueia de verdade é o banco (schema.sql).
import { pode } from '../permissoes.js';
import { esc, $, $$, avisar, hoje, paraData } from '../util.js';
import { TABELA, TEXTOS_PADRAO, itemDaTabela, plural, totaisOrcamento } from '../orcamento-tabela.js';
import { dinheiro, lerValor } from './financas.js';

export const STATUS_ORCAMENTO = [
  { chave: 'rascunho', nome: 'Rascunho' },
  { chave: 'enviado', nome: 'Enviado' },
  { chave: 'aprovado', nome: 'Aprovado' },
  { chave: 'recusado', nome: 'Recusado' },
];
const nomeStatus = (c) => STATUS_ORCAMENTO.find((s) => s.chave === c)?.nome ?? c;

// O que a tela lembra enquanto a pessoa usa o sistema.
const tela = { filtro: 'todos', editando: null };

const dataBR = (iso) => { if (!iso) return ''; const [a, m, d] = iso.split('-'); return `${d}/${m}/${a}`; };
const somaDias = (iso, n) => { const d = paraData(iso); d.setDate(d.getDate() + (+n || 0)); return d.toLocaleDateString('pt-BR'); };
const valorNoCampo = (v) => (v ? Number(v).toFixed(2).replace('.', ',') : '');
const novosDados = () => ({ ...structuredClone(TEXTOS_PADRAO), data: hoje(), clienteNome: '', clienteEmpresa: '', clienteContato: '', itens: [] });

// Ao chegar na tela vindo de outra, abre a lista; o editor só continua
// aberto enquanto a pessoa estiver nele.
export async function render(el, ctx) {
  if (!$('.orc-editor', el)) tela.editando = null;
  return tela.editando ? desenharEditor(el, ctx) : desenharLista(el, ctx);
}

async function desenharLista(el, ctx) {
  const s = ctx.estado.sessao;
  const todos = (await ctx.db().listar('orcamentos')).sort((a, b) => b.numero.localeCompare(a.numero));
  const lista = tela.filtro === 'todos' ? todos : todos.filter((o) => o.status === tela.filtro);
  const conta = (c) => todos.filter((o) => o.status === c).length;
  const total = (o) => [Number(o.total_unico) ? dinheiro(o.total_unico) : '', Number(o.total_mensal) ? `${dinheiro(o.total_mensal)}/mês` : '']
    .filter(Boolean).join(' + ') || dinheiro(0);
  const linhas = lista.map((o) => {
    const cliente = ctx.cliente(o.cliente_id)?.nome || o.dados?.clienteEmpresa || o.dados?.clienteNome || '';
    return `<tr class="clicavel" data-id="${esc(o.id)}">
      <td class="fraco">${esc(o.numero)}</td>
      <td><b>${esc(o.titulo || '(sem título)')}</b>${cliente ? `<div class="fraco">${esc(cliente)}</div>` : ''}</td>
      <td><span class="etiqueta status-orc-${esc(o.status)}">${esc(nomeStatus(o.status))}</span>${o.lancamento_id ? ' <span class="etiqueta" title="Já está no Caixa da LOOK">No caixa</span>' : ''}</td>
      <td class="fraco">${esc(dataBR(o.dados?.data || o.criado_em?.slice(0, 10)))}</td>
      <td class="valor-orc">${total(o)}</td></tr>`;
  }).join('');

  el.innerHTML = `
    <div class="cabecalho"><div><div class="sobre">Comercial</div><h1>Orçamentos</h1></div>
      ${pode(s, 'comercial', 'criar') ? '<button class="botao primario" id="novo-orcamento">+ Novo orçamento</button>' : ''}</div>
    <div class="abas abas-orc">${[{ chave: 'todos', nome: 'Todos' }, ...STATUS_ORCAMENTO].map((f) =>
      `<button class="aba ${tela.filtro === f.chave ? 'ativa' : ''}" data-filtro="${f.chave}">${f.nome} <span class="fraco">${f.chave === 'todos' ? todos.length : conta(f.chave)}</span></button>`).join('')}</div>
    <div class="painel">${linhas
      ? `<table class="tabela orcamentos"><thead><tr><th>Nº</th><th>Projeto</th><th>Status</th><th>Data</th><th style="text-align:right">Total</th></tr></thead><tbody>${linhas}</tbody></table>`
      : `<div class="vazio">${todos.length ? 'Nenhum orçamento com este status.' : 'Nenhum orçamento ainda. Use "+ Novo orçamento".'}</div>`}</div>`;

  $$('[data-filtro]', el).forEach((b) => b.addEventListener('click', () => { tela.filtro = b.dataset.filtro; desenharLista(el, ctx); }));
  $('#novo-orcamento', el)?.addEventListener('click', () => {
    tela.editando = { linha: null, titulo: '', status: 'rascunho', cliente_id: null, projeto_id: null, dados: novosDados() };
    desenharEditor(el, ctx);
  });
  $$('tr[data-id]', el).forEach((tr) => tr.addEventListener('click', () => {
    const o = todos.find((x) => x.id === tr.dataset.id);
    tela.editando = { linha: o, titulo: o.titulo, status: o.status, cliente_id: o.cliente_id, projeto_id: o.projeto_id, dados: { ...novosDados(), ...structuredClone(o.dados) } };
    desenharEditor(el, ctx);
  }));
}

// ---------- Editor ----------
function desenharEditor(el, ctx) {
  const s = ctx.estado.sessao;
  const ed = tela.editando;
  const E = ed.dados;
  const novo = !ed.linha;
  const podeSalvar = pode(s, 'comercial', novo ? 'criar' : 'editar');
  const dis = podeSalvar ? '' : 'disabled';
  const clientes = [...ctx.estado.clientes].sort((a, b) => a.nome.localeCompare(b.nome));
  const projetos = [...ctx.estado.projetos].sort((a, b) => a.nome.localeCompare(b.nome));
  const campo = (nome, rotulo, extra = '') => `<div class="campo"><label>${rotulo}</label><input type="text" name="${nome}" value="${esc(E[nome])}" ${extra} ${dis}></div>`;
  const texto = (nome, rotulo) => `<div class="campo inteiro"><label>${rotulo}</label><textarea name="${nome}" maxlength="3000" ${dis}>${esc(E[nome])}</textarea></div>`;
  const opcoesTabela = Object.entries(TABELA).map(([cat, itens]) => `<optgroup label="${esc(cat)}">${itens.map((it, i) =>
    `<option value="${esc(cat)}|${i}">${esc(it.d)} · ${it.valor ? dinheiro(it.valor) : 'sob consulta'}${it.mensal ? '/mês' : ''}</option>`).join('')}</optgroup>`).join('');

  el.innerHTML = `
    <div class="cabecalho"><div><div class="sobre">Orçamentos</div><h1>${novo ? 'Novo orçamento' : `Orçamento ${esc(ed.linha.numero)}`}</h1></div>
      <div class="barra-orc">
        <button class="botao" id="voltar-orcamentos">‹ Voltar</button>
        ${podeSalvar ? '<button class="botao primario" id="salvar-orcamento">Salvar</button>' : ''}
        <button class="botao" id="pdf-orcamento">Gerar PDF</button>
        ${pode(s, 'comercial', 'criar') && !novo ? '<button class="botao" id="duplicar-orcamento" title="Cria um orçamento novo com os mesmos itens">Duplicar</button>' : ''}
      </div></div>
    <div id="caixa-orcamento"></div>
    <div class="erro" id="erro-orcamento"></div>
    <div class="orc-editor">
      <form class="orc-form" id="form-orcamento">
        <div class="painel grade-campos">
          <div class="campo inteiro"><label>Projeto (título do orçamento)</label><input type="text" name="titulo" maxlength="200" value="${esc(ed.titulo)}" placeholder="Ex.: Identidade visual + lançamento" ${dis}></div>
          <div class="campo"><label>Status</label><select name="status" ${dis}>${STATUS_ORCAMENTO.map((st) => `<option value="${st.chave}" ${st.chave === ed.status ? 'selected' : ''}>${st.nome}</option>`).join('')}</select></div>
          <div class="campo"><label>Data</label><input type="date" name="data" value="${esc(E.data)}" required ${dis}></div>
          <div class="campo"><label>Cliente do sistema</label><select name="cliente_id" ${dis}><option value="">Nenhum (digite abaixo)</option>
            ${clientes.map((c) => `<option value="${esc(c.id)}" ${c.id === ed.cliente_id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></div>
          <div class="campo"><label>Projeto do sistema</label><select name="projeto_id" ${dis}><option value="">Nenhum</option>
            ${projetos.map((p) => `<option value="${esc(p.id)}" ${p.id === ed.projeto_id ? 'selected' : ''}>${esc(p.nome)}${ctx.cliente(p.cliente_id) ? ` · ${esc(ctx.cliente(p.cliente_id).nome)}` : ''}</option>`).join('')}</select></div>
          ${campo('clienteEmpresa', 'Empresa', 'maxlength="200"')}${campo('clienteNome', 'Pessoa de contato', 'maxlength="200"')}
          <div class="campo inteiro"><label>Contato do cliente</label><input type="text" name="clienteContato" maxlength="300" value="${esc(E.clienteContato)}" placeholder="Telefone, e-mail" ${dis}></div>
          ${texto('intro', 'Apresentação (texto de abertura)')}
        </div>
        <div class="painel">
          <h2>Itens</h2>
          <div id="itens-orcamento"></div>
          ${podeSalvar ? `<div class="linha-add-item">
            <select id="item-da-tabela" aria-label="Item da tabela de preços"><option value="">Escolha um item da tabela de preços…</option>${opcoesTabela}</select>
            <button type="button" class="botao" id="add-item-tabela">+ Adicionar</button>
            <button type="button" class="botao sutil" id="add-item-livre">+ Item livre</button></div>` : ''}
          <div class="grade-campos" style="margin-top:14px">
            <div class="campo"><label>Desconto</label><input type="text" inputmode="decimal" name="desconto" value="${esc(String(E.desconto || '').replace('.', ','))}" placeholder="0" ${dis}></div>
            <div class="campo"><label>Tipo de desconto</label><select name="descontoTipo" ${dis}>
              <option value="pct" ${E.descontoTipo === 'pct' ? 'selected' : ''}>% (porcentagem)</option>
              <option value="valor" ${E.descontoTipo !== 'pct' ? 'selected' : ''}>R$ (valor)</option></select></div>
          </div>
        </div>
        <div class="painel grade-campos">
          <h2 class="inteiro">Condições</h2>
          ${texto('pagamento', 'Forma de pagamento')}${texto('prazo', 'Prazo')}${texto('revisoes', 'Ajustes')}
          ${texto('incluso', 'Incluso')}${texto('naoIncluso', 'Não incluso')}${texto('obs', 'Observações')}
          <div class="campo"><label>Validade (dias)</label><input type="number" name="validadeDias" min="1" max="365" value="${esc(E.validadeDias)}" ${dis}></div>
          ${campo('cnpj', 'CNPJ da LOOK', 'maxlength="30"')}
          ${campo('responsavel', 'Assinatura', 'maxlength="200"')}
          <div class="campo"><label style="display:flex;gap:8px;align-items:center;text-transform:none;letter-spacing:0;margin-top:24px">
            <input type="checkbox" name="mostrarAceite" ${E.mostrarAceite ? 'checked' : ''} ${dis}> Linhas de aceite (assinaturas)</label></div>
          <div class="campo inteiro"><label>Contato da LOOK (rodapé)</label><input type="text" name="contatoLook" maxlength="300" value="${esc(E.contatoLook)}" ${dis}></div>
        </div>
        ${!novo && pode(s, 'comercial', 'apagar') ? '<div><button type="button" class="botao perigo" id="apagar-orcamento">Apagar orçamento</button></div>' : ''}
      </form>
      <div class="orc-palco"><div class="folha-orc" id="folha-orc"></div></div>
    </div>`;

  const form = $('#form-orcamento', el);
  let sujo = false;
  const erro = $('#erro-orcamento', el);

  // Lê o formulário para o orçamento em edição.
  function ler() {
    ed.titulo = form.titulo.value;
    ed.status = form.status.value;
    ed.cliente_id = form.cliente_id.value || null;
    ed.projeto_id = form.projeto_id.value || null;
    for (const k of ['data', 'clienteEmpresa', 'clienteNome', 'clienteContato', 'intro', 'pagamento', 'prazo', 'revisoes', 'incluso', 'naoIncluso', 'obs', 'cnpj', 'responsavel', 'contatoLook', 'descontoTipo']) E[k] = form[k].value;
    E.validadeDias = Math.max(0, parseInt(form.validadeDias.value, 10) || 0);
    const d = lerValor(form.desconto.value);
    E.desconto = Number.isFinite(d) && d > 0 ? d : 0;
    E.mostrarAceite = form.mostrarAceite.checked;
    $$('.item-orc', el).forEach((linha, i) => {
      const it = E.itens[i];
      it.cat = $('[data-c=cat]', linha).value; it.d = $('[data-c=d]', linha).value; it.det = $('[data-c=det]', linha).value;
      it.u = $('[data-c=u]', linha).value; it.q = Math.max(0, Number(String($('[data-c=q]', linha).value).replace(',', '.')) || 0);
      const v = lerValor($('[data-c=valor]', linha).value);
      it.valor = Number.isFinite(v) && v > 0 ? v : 0;
      it.mensal = $('[data-c=mensal]', linha).checked;
    });
  }

  function desenharItens() {
    $('#itens-orcamento', el).innerHTML = E.itens.length ? E.itens.map((it, i) => `
      <div class="item-orc" data-i="${i}">
        <div class="topo-item"><input type="text" data-c="cat" value="${esc(it.cat)}" maxlength="60" aria-label="Grupo" title="Grupo do item na folha" ${dis}>
          ${podeSalvar ? `<button type="button" class="botao pequeno sutil" data-mover="-1" title="Subir">↑</button><button type="button" class="botao pequeno sutil" data-mover="1" title="Descer">↓</button>
          <button type="button" class="botao pequeno sutil perigo" data-tirar title="Tirar item">Tirar</button>` : ''}</div>
        <input type="text" data-c="d" value="${esc(it.d)}" maxlength="200" placeholder="Descrição" aria-label="Descrição" ${dis}>
        <input type="text" data-c="det" value="${esc(it.det)}" maxlength="400" placeholder="Detalhe (opcional)" aria-label="Detalhe" ${dis}>
        <div class="numeros-item">
          <label>Qtd <input type="text" inputmode="decimal" data-c="q" value="${esc(it.q)}" ${dis}></label>
          <label>Unidade <input type="text" data-c="u" value="${esc(it.u)}" maxlength="30" ${dis}></label>
          <label>Valor (R$) <input type="text" inputmode="decimal" data-c="valor" value="${esc(valorNoCampo(it.valor))}" placeholder="sob consulta" ${dis}></label>
          <label class="mensal"><input type="checkbox" data-c="mensal" ${it.mensal ? 'checked' : ''} ${dis}> por mês</label>
        </div>
      </div>`).join('') : '<div class="vazio">Nenhum item. Escolha da tabela de preços ou crie um item livre.</div>';
    $$('[data-tirar]', el).forEach((b) => b.addEventListener('click', () => {
      ler(); E.itens.splice(Number(b.closest('.item-orc').dataset.i), 1); mudou(true);
    }));
    $$('[data-mover]', el).forEach((b) => b.addEventListener('click', () => {
      ler();
      const i = Number(b.closest('.item-orc').dataset.i); const j = i + Number(b.dataset.mover);
      if (j < 0 || j >= E.itens.length) return;
      [E.itens[i], E.itens[j]] = [E.itens[j], E.itens[i]]; mudou(true);
    }));
  }

  function mudou(itensTambem) {
    sujo = true;
    if (itensTambem) desenharItens();
    desenharFolha();
  }

  function desenharFolha() {
    const numero = ed.linha?.numero ?? 'sai ao salvar';
    $('#folha-orc', el).innerHTML = folhaHtml({ ...E, numero, titulo: ed.titulo });
  }

  function desenharCaixa() {
    const caixa = $('#caixa-orcamento', el);
    const o = ed.linha;
    if (!o || o.status !== 'aprovado') { caixa.innerHTML = ''; return; }
    if (o.lancamento_id) { caixa.innerHTML = '<p class="aviso-orc" id="orc-no-caixa">Este orçamento já está no Caixa da LOOK como entrada.</p>'; return; }
    if (!pode(s, 'financeiro', 'criar') || !pode(s, 'comercial', 'editar')) { caixa.innerHTML = ''; return; }
    caixa.innerHTML = `<p class="aviso-orc">Orçamento aprovado. <button class="botao pequeno primario" id="lancar-orcamento">Lançar no caixa (a receber)</button>
      <span class="fraco">Cria a entrada no Caixa da LOOK, ligada ao cliente.</span></p>`;
    $('#lancar-orcamento', el).addEventListener('click', () => lancarNoCaixa(ctx, el));
  }

  async function salvar() {
    erro.textContent = '';
    ler();
    if (!ed.titulo.trim()) { erro.textContent = 'Dê um título ao orçamento (o campo "Projeto").'; form.titulo.focus(); return false; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(E.data)) { erro.textContent = 'Confira a data.'; return false; }
    const T = totaisOrcamento(E);
    const linha = { titulo: ed.titulo.trim(), status: ed.status, cliente_id: ed.cliente_id, projeto_id: ed.projeto_id, dados: E, total_unico: T.fu, total_mensal: T.fm };
    try {
      ed.linha = novo || !ed.linha ? await ctx.db().inserir('orcamentos', linha) : await ctx.db().atualizar('orcamentos', ed.linha.id, linha);
      sujo = false;
      avisar(`Orçamento ${ed.linha.numero} salvo`);
      return true;
    } catch (err) { erro.textContent = err.message; return false; }
  }

  form.addEventListener('submit', (e) => e.preventDefault());
  form.addEventListener('input', () => { ler(); mudou(false); });
  form.addEventListener('change', () => { ler(); mudou(false); });
  // Escolher o cliente preenche os dados dele; escolher o projeto preenche o cliente e o título.
  form.cliente_id.addEventListener('change', () => {
    const c = ctx.cliente(form.cliente_id.value);
    if (!c) return;
    form.clienteEmpresa.value = c.nome;
    form.clienteNome.value = c.contato || '';
    form.clienteContato.value = [c.telefone, c.email, c.instagram].filter(Boolean).join(' · ');
    ler(); mudou(false);
  });
  form.projeto_id.addEventListener('change', () => {
    const p = ctx.projeto(form.projeto_id.value);
    if (!p) return;
    if (p.cliente_id && form.cliente_id.value !== p.cliente_id) { form.cliente_id.value = p.cliente_id; form.cliente_id.dispatchEvent(new Event('change')); }
    if (!form.titulo.value.trim()) form.titulo.value = p.nome;
    ler(); mudou(false);
  });
  $('#add-item-tabela', el)?.addEventListener('click', () => {
    const v = $('#item-da-tabela', el).value;
    if (!v) { $('#item-da-tabela', el).focus(); return; }
    const [cat, i] = v.split('|');
    ler(); E.itens.push(itemDaTabela(cat, Number(i))); mudou(true);
    $('#item-da-tabela', el).value = '';
  });
  $('#add-item-livre', el)?.addEventListener('click', () => {
    ler(); E.itens.push({ cat: 'Outros', d: '', det: '', u: 'un.', q: 1, valor: 0, mensal: false }); mudou(true);
    $$('.item-orc [data-c=d]', el).at(-1)?.focus();
  });

  $('#voltar-orcamentos', el).addEventListener('click', (e) => {
    if (sujo && podeSalvar && e.target.dataset.confirmar !== 'sim') {
      e.target.dataset.confirmar = 'sim'; e.target.textContent = 'Sair sem salvar? Clique de novo'; return;
    }
    tela.editando = null; desenharLista(el, ctx);
  });
  $('#salvar-orcamento', el)?.addEventListener('click', async () => {
    const eraNovo = !ed.linha;
    if (await salvar()) { if (eraNovo) desenharEditor(el, ctx); else { desenharFolha(); desenharCaixa(); } }
  });
  $('#pdf-orcamento', el).addEventListener('click', async (e) => {
    const botao = e.target;
    // O PDF sai com o número do orçamento: salva antes se houver mudança.
    if ((sujo || !ed.linha) && podeSalvar) { const eraNovo = !ed.linha; if (!(await salvar())) return; if (eraNovo) { desenharEditor(el, ctx); $('#pdf-orcamento', el).click(); return; } }
    if (!ed.linha) return;
    botao.disabled = true; botao.textContent = 'Gerando PDF...';
    try {
      const blob = await gerarPdf({ ...E, numero: ed.linha.numero, titulo: ed.titulo });
      baixar(blob, `${nomeArquivo(ed.linha.numero, E)}.pdf`);
    } catch (err) { erro.textContent = `Não deu para gerar o PDF: ${err.message}`; console.warn(err); }
    botao.disabled = false; botao.textContent = 'Gerar PDF';
  });
  $('#duplicar-orcamento', el)?.addEventListener('click', () => {
    ler();
    tela.editando = { linha: null, titulo: ed.titulo, status: 'rascunho', cliente_id: ed.cliente_id, projeto_id: ed.projeto_id, dados: { ...structuredClone(E), data: hoje() } };
    desenharEditor(el, ctx);
    avisar('Cópia criada: salve para ganhar um número novo');
  });
  $('#apagar-orcamento', el)?.addEventListener('click', async (e) => {
    if (e.target.dataset.confirmar !== 'sim') { e.target.dataset.confirmar = 'sim'; e.target.textContent = 'Clique de novo para apagar'; return; }
    try { await ctx.db().apagar('orcamentos', ed.linha.id); avisar('Orçamento apagado'); tela.editando = null; desenharLista(el, ctx); } catch (err) { erro.textContent = err.message; }
  });

  desenharItens();
  desenharFolha();
  desenharCaixa();
}

// Aprovado: cria a entrada "a receber" no Caixa da LOOK e liga ao orçamento.
async function lancarNoCaixa(ctx, el) {
  const ed = tela.editando;
  const o = ed.linha;
  const unico = Number(o.total_unico); const mensal = Number(o.total_mensal);
  const erro = $('#erro-orcamento', el);
  if (!(unico > 0 || mensal > 0)) { erro.textContent = 'O orçamento está sem valor: não há o que lançar.'; return; }
  try {
    const lanc = await ctx.db().inserir('lancamentos', {
      escopo: 'empresa', tipo: 'entrada', valor: unico > 0 ? unico : mensal, pago: false, data: hoje(),
      descricao: `Orçamento ${o.numero} · ${o.titulo}`.slice(0, 200),
      categoria: unico > 0 ? 'Serviço de cliente' : 'Mensalidade de cliente',
      cliente_id: o.cliente_id ?? ctx.projeto(o.projeto_id)?.cliente_id ?? null, projeto_id: o.projeto_id ?? null,
      observacoes: unico > 0 && mensal > 0 ? `Valor único. O plano mensal (${dinheiro(mensal)}) é lançado a cada mês.` : '',
    });
    ed.linha = await ctx.db().atualizar('orcamentos', o.id, { lancamento_id: lanc.id });
    avisar('Entrada lançada no Caixa da LOOK');
    desenharEditor(el, ctx);
  } catch (err) { erro.textContent = err.message; }
}

// ---------- Folha (prévia na tela, igual ao PDF) ----------
function folhaHtml(E) {
  const T = totaisOrcamento(E);
  const grupos = {};
  for (const it of E.itens) (grupos[it.cat || 'Outros'] ??= []).push(it);
  const linhas = Object.entries(grupos).map(([cat, its]) => `
    <tr class="gr"><td colspan="4">${esc(cat)}</td></tr>
    ${its.map((it) => `<tr><td><b>${esc(it.d) || '(sem descrição)'}</b>${it.det ? `<span class="det">${esc(it.det)}</span>` : ''}</td>
      <td class="n">${+it.q || 0} ${esc(plural(it.u, +it.q))}</td>
      <td class="n">${it.valor ? dinheiro(it.valor) : 'sob consulta'}</td>
      <td class="n"><b>${it.valor ? dinheiro((+it.q || 0) * it.valor) : '—'}</b>${it.mensal ? '<span class="det">por mês</span>' : ''}</td></tr>`).join('')}`).join('');
  const temDesc = (+E.desconto || 0) > 0;
  const rotDesc = E.descontoTipo === 'pct' ? `Desconto (${(+E.desconto).toLocaleString('pt-BR')}%)` : 'Desconto';
  let tot = '';
  if (T.unico || !T.mensal) {
    if (temDesc && T.du) tot += `<div class="l"><span>Subtotal</span><span>${dinheiro(T.unico)}</span></div><div class="l"><span>${rotDesc}</span><span>− ${dinheiro(T.du)}</span></div>`;
    tot += `<div class="final"><span>Investimento${T.mensal ? ' único' : ''}</span><b id="orc-total-unico">${dinheiro(T.fu)}</b></div>`;
  }
  if (T.mensal) {
    if (temDesc && T.dm) tot += `<div class="l"><span>Mensal sem desconto</span><span>${dinheiro(T.mensal)}</span></div><div class="l"><span>${rotDesc}</span><span>− ${dinheiro(T.dm)}</span></div>`;
    tot += `<div class="final"><span>Investimento mensal</span><b id="orc-total-mensal">${dinheiro(T.fm)}</b></div>`;
  }
  const bloco = (r, v, c = '') => (v && String(v).trim() ? `<div class="${c}"><div class="rot">${r}</div><div class="val">${esc(v)}</div></div>` : '');
  return `
    <div class="cab"><img src="img/logo-assinatura-branca.png" alt="LOOK Direção de Marca &amp; Conteúdo">
      <div class="tit"><b>ORÇAMENTO</b><small>Nº ${esc(E.numero)} · ${esc(dataBR(E.data))}</small></div></div>
    <div class="filete"></div>
    <div class="corpo">
      <div class="dados">
        <div><div class="rot">Para</div><div class="val"><b>${esc(E.clienteEmpresa || E.clienteNome)}</b>${E.clienteEmpresa && E.clienteNome ? `<br>${esc(E.clienteNome)}` : ''}${E.clienteContato ? `<br>${esc(E.clienteContato)}` : ''}</div></div>
        <div><div class="rot">Projeto</div><div class="val"><b>${esc(E.titulo)}</b></div></div>
        <div><div class="rot">Válido até</div><div class="val"><b>${E.data ? esc(somaDias(E.data, E.validadeDias)) : ''}</b><br>${+E.validadeDias || 0} dias</div></div>
      </div>
      ${E.intro ? `<p class="intro">${esc(E.intro)}</p>` : ''}
      ${linhas ? `<table><colgroup><col><col style="width:30mm"><col style="width:30mm"><col style="width:30mm"></colgroup>
        <thead><tr><th>Item</th><th class="n">Qtd</th><th class="n">Valor unit.</th><th class="n">Total</th></tr></thead><tbody>${linhas}</tbody></table>` : '<p class="sem-itens">Adicione itens ao lado.</p>'}
      <div class="totais">${tot}</div>
      <div class="cond">${bloco('Forma de pagamento', E.pagamento)}${bloco('Prazo', E.prazo)}${bloco('Ajustes', E.revisoes)}${bloco('Incluso', E.incluso)}
        ${bloco('Não incluso', E.naoIncluso, 'cheio')}${bloco('Observações', E.obs, 'cheio')}</div>
      ${E.mostrarAceite ? `<div class="aceite"><div>${esc(E.responsavel)}${E.cnpj ? ` · CNPJ ${esc(E.cnpj)}` : ''}</div><div>De acordo: ${esc(E.clienteNome || 'cliente')} · data ____/____/______</div></div>` : ''}
    </div>
    <div class="rod"><img src="img/olho-preto.png" alt=""><span>${E.cnpj ? `CNPJ ${esc(E.cnpj)}<br>` : ''}${esc(E.contatoLook)}</span><span class="tag">Entenda. Escolha. Expanda.</span></div>`;
}

// ---------- PDF (texto de verdade, com as fontes da LOOK) ----------
let recursos = null;
const carregarScript = (src) => new Promise((ok, falhar) => {
  const s = document.createElement('script');
  s.src = src; s.onload = ok; s.onerror = () => falhar(new Error('não deu para carregar o gerador de PDF.'));
  document.head.append(s);
});
async function base64De(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`arquivo ${url} não encontrado.`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
async function carregarRecursos() {
  if (!window.jspdf) await carregarScript('js/vendor/jspdf.umd.min.js');
  if (!window.LookOrcamentoPDF) await carregarScript('js/vendor/pdf-orcamento.js');
  const [anton, atk400, atk700, logo, olho] = await Promise.all([
    base64De('fonts/anton-latin-400-normal.ttf'), base64De('fonts/atkinson-hyperlegible-latin-400-normal.ttf'),
    base64De('fonts/atkinson-hyperlegible-latin-700-normal.ttf'), base64De('img/logo-assinatura-branca.png'), base64De('img/olho-preto.png')]);
  return { anton, atk400, atk700, logo: `data:image/png;base64,${logo}`, olho: `data:image/png;base64,${olho}` };
}
async function gerarPdf(E) {
  recursos ??= await carregarRecursos().catch((err) => { recursos = null; throw err; });
  return window.LookOrcamentoPDF.gerar(structuredClone(E), recursos);
}
function nomeArquivo(numero, E) {
  const c = (E.clienteEmpresa || E.clienteNome || 'cliente').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
  return `Orcamento-LOOK-${numero}-${c || 'cliente'}`;
}
function baixar(blob, nome) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nome;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
