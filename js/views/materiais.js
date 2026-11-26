// Banco de materiais: logos, fontes, modelos de contrato e proposta, sons,
// fotos... da LOOK ou de um cliente, num lugar só. Cada material é um arquivo
// (até 50 MB, depósito privado) ou um link. Segue a permissão "Banco de
// materiais"; quem bloqueia de verdade é o banco.
import { pode } from '../permissoes.js';
import { CATEGORIAS_MATERIAL, nomeDe } from '../config.js';
import { esc, $, $$, avisar, dataCurta } from '../util.js';
import { ACEITOS_MATERIAL, tamanhoLegivel, TIPOS_MATERIAL } from '../anexos.js';
import { abrirModal, opcoes } from './modal.js';
import { corCliente } from './comum.js';

const tela = { categoria: '', cliente: '', busca: '' };
const sem = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const rotulo = (m) => (m.link ? 'LINK' : (TIPOS_MATERIAL[m.tipo] ?? 'ARQ').toUpperCase());

export async function render(el, ctx) {
  const s = ctx.estado.sessao;
  const todos = (await ctx.db().listar('materiais')).sort((a, b) => a.titulo.localeCompare(b.titulo));
  const links = await ctx.db().linksMateriais(todos).catch(() => ({}));
  const busca = sem(tela.busca);
  const lista = todos.filter((m) => (!tela.categoria || m.categoria === tela.categoria)
    && (!tela.cliente || (tela.cliente === 'look' ? !m.cliente_id : m.cliente_id === tela.cliente))
    && (!busca || sem(`${m.titulo} ${m.descricao} ${m.nome} ${ctx.cliente(m.cliente_id)?.nome ?? 'LOOK'}`).includes(busca)));
  const conta = (cat) => todos.filter((m) => m.categoria === cat).length;
  const eu = s.perfil.id;
  const podeApagar = (m) => pode(s, 'materiais', 'apagar') || (m.criado_por === eu && pode(s, 'materiais', 'criar'));

  const cartao = (m) => {
    const cliente = ctx.cliente(m.cliente_id);
    const l = links[m.id] ?? {};
    const abrir = m.link || l.abrir || '';
    const capa = m.tipo?.startsWith('image/') && l.abrir ? `<img src="${esc(l.abrir)}" alt="" loading="lazy">` : `<span class="tipo-arquivo">${esc(rotulo(m))}</span>`;
    return `<div class="material" data-material="${esc(m.id)}" style="--cor-cliente:${corCliente(cliente)}">
      <a class="capa" href="${esc(abrir)}" target="_blank" rel="noopener noreferrer" title="Abrir">${capa}</a>
      <div class="info"><b class="nome-material">${esc(m.titulo)}</b>
        <span class="fraco">${esc(nomeDe(CATEGORIAS_MATERIAL, m.categoria))} · ${esc(cliente?.nome ?? 'LOOK')}${m.caminho ? ` · ${tamanhoLegivel(m.tamanho)}` : ''} · ${esc(dataCurta(m.criado_em))}</span>
        ${m.descricao ? `<span class="descricao-material">${esc(m.descricao)}</span>` : ''}</div>
      <div class="acoes"><a class="botao pequeno" href="${esc(abrir)}" target="_blank" rel="noopener noreferrer">Abrir</a>
        ${m.caminho && l.baixar ? `<a class="botao pequeno sutil" href="${esc(l.baixar)}" download="${esc(m.nome)}" rel="noopener noreferrer">Baixar</a>` : ''}
        ${pode(s, 'materiais', 'editar') ? '<button class="botao pequeno sutil" data-editar>Editar</button>' : ''}
        ${podeApagar(m) ? '<button class="botao pequeno sutil perigo" data-apagar-material>Apagar</button>' : ''}</div></div>`;
  };
  const clientes = [...ctx.estado.clientes].sort((a, b) => a.nome.localeCompare(b.nome));

  el.innerHTML = `
    <div class="cabecalho"><div><div class="sobre">Banco de materiais</div><h1>Materiais</h1></div>
      ${pode(s, 'materiais', 'criar') ? '<button class="botao primario" id="novo-material">+ Novo material</button>' : ''}</div>
    <div class="abas abas-orc">${[{ chave: '', nome: 'Todos' }, ...CATEGORIAS_MATERIAL].map((c) =>
      `<button class="aba ${tela.categoria === c.chave ? 'ativa' : ''}" data-categoria="${c.chave}">${esc(c.nome)}${c.chave ? ` <span class="fraco">${conta(c.chave)}</span>` : ''}</button>`).join('')}</div>
    <div class="filtros">
      <select id="filtro-cliente-material"><option value="">LOOK e clientes</option><option value="look" ${tela.cliente === 'look' ? 'selected' : ''}>Só da LOOK</option>
        ${clientes.map((c) => `<option value="${esc(c.id)}" ${tela.cliente === c.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select>
      <input type="search" id="busca-material" placeholder="Buscar material" value="${esc(tela.busca)}">
    </div>
    <div class="painel lista-materiais">${lista.map(cartao).join('') || `<div class="vazio">${todos.length ? 'Nenhum material neste filtro.' : 'Nenhum material ainda. Comece pelos logos, fontes e modelos de contrato.'}</div>`}</div>`;

  const redesenhar = () => render(el, ctx);
  $$('[data-categoria]', el).forEach((b) => b.addEventListener('click', () => { tela.categoria = b.dataset.categoria; redesenhar(); }));
  $('#filtro-cliente-material', el).addEventListener('change', (e) => { tela.cliente = e.target.value; redesenhar(); });
  $('#busca-material', el).addEventListener('input', (e) => {
    tela.busca = e.target.value;
    clearTimeout(tela.espera); tela.espera = setTimeout(async () => { await redesenhar(); const b = $('#busca-material', el); b.focus(); b.setSelectionRange(b.value.length, b.value.length); }, 200);
  });
  $('#novo-material', el)?.addEventListener('click', () => abrirMaterial(ctx, null, redesenhar));
  const doCartao = (b) => todos.find((m) => m.id === b.closest('[data-material]').dataset.material);
  $$('[data-editar]', el).forEach((b) => b.addEventListener('click', () => abrirMaterial(ctx, doCartao(b), redesenhar)));
  $$('[data-apagar-material]', el).forEach((b) => b.addEventListener('click', async () => {
    if (b.dataset.confirmar !== 'sim') { b.dataset.confirmar = 'sim'; b.textContent = 'Clique de novo'; return; }
    try { await ctx.db().apagar('materiais', doCartao(b).id); avisar('Material apagado'); await redesenhar(); } catch (err) { avisar(err.message); }
  }));
}

function abrirMaterial(ctx, material, aoMudar) {
  const novo = !material;
  const m = material ?? { titulo: '', categoria: tela.categoria || 'logos', cliente_id: tela.cliente && tela.cliente !== 'look' ? tela.cliente : null, descricao: '' };
  const clientes = [...ctx.estado.clientes].sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => ({ chave: c.id, nome: c.nome }));
  const { el, fechar } = abrirModal({
    titulo: novo ? 'Novo material' : esc(m.titulo),
    corpo: `<form class="grade-campos" id="form-material">
      <div class="campo inteiro"><label>Nome do material</label><input type="text" name="titulo" maxlength="200" required value="${esc(m.titulo)}" placeholder="Ex.: Logo oficial, Fonte Anton, Contrato padrão"></div>
      <div class="campo"><label>Categoria</label><select name="categoria">${opcoes(CATEGORIAS_MATERIAL, m.categoria)}</select></div>
      <div class="campo"><label>De quem é</label><select name="cliente_id">${opcoes(clientes, m.cliente_id ?? '', 'LOOK')}</select></div>
      ${novo ? `<div class="campo"><label>Arquivo (até 50 MB)</label><input type="file" name="arquivo" accept="${ACEITOS_MATERIAL}"><div class="fraco">AI, CDR ou PSD: coloque dentro de um ZIP.</div></div>
      <div class="campo"><label>ou link (Google Drive, Canva...)</label><input type="text" name="link" maxlength="1000" placeholder="https://"></div>` : ''}
      <div class="campo inteiro"><label>Descrição (opcional)</label><textarea name="descricao" maxlength="5000" rows="2">${esc(m.descricao)}</textarea></div>
    </form><div class="erro" id="erro-material"></div>`,
    rodape: `<span class="espaco"></span><button class="botao primario" id="salvar-material">${novo ? 'Enviar' : 'Salvar'}</button>`,
  });
  const form = $('#form-material', el);
  const erro = $('#erro-material', el);
  form.addEventListener('submit', (e) => { e.preventDefault(); $('#salvar-material', el).click(); });
  $('#salvar-material', el).addEventListener('click', async (e) => {
    erro.textContent = '';
    if (!form.reportValidity()) return;
    const dados = { titulo: form.titulo.value.trim(), categoria: form.categoria.value, cliente_id: form.cliente_id.value || null, descricao: form.descricao.value.trim() };
    const botao = e.currentTarget;
    try {
      if (novo) {
        const arquivo = form.arquivo.files[0];
        const link = form.link.value.trim();
        if (!arquivo && !link) { erro.textContent = 'Escolha um arquivo ou cole um link.'; return; }
        if (arquivo && link) { erro.textContent = 'Envie o arquivo ou o link, não os dois.'; return; }
        botao.disabled = true; botao.textContent = 'Enviando…';
        await ctx.db().enviarMaterial({ ...dados, link }, arquivo);
      } else await ctx.db().atualizar('materiais', m.id, dados);
      fechar(); avisar(novo ? 'Material enviado' : 'Material salvo'); await aoMudar();
    } catch (err) { erro.textContent = err.message; botao.disabled = false; botao.textContent = novo ? 'Enviar' : 'Salvar'; }
  });
}
