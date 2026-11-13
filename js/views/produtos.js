// Produtos: a tabela de preços que aparece no "Escolha um item da tabela"
// dos orçamentos. Segue a permissão "Comercial e orçamentos".
import { pode } from '../permissoes.js';
import { esc, $, $$ } from '../util.js';
import { abrirFicha } from './ficha.js';
import { dinheiro } from './financas.js';

const tela = { busca: '', inativos: false };
const sem = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Ordem da tabela: categoria na ordem do primeiro item dela; itens pela "ordem".
export function agruparProdutos(lista) {
  const grupos = new Map();
  for (const p of [...lista].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || a.descricao.localeCompare(b.descricao))) {
    if (!grupos.has(p.categoria)) grupos.set(p.categoria, []);
    grupos.get(p.categoria).push(p);
  }
  return [...grupos.entries()];
}

export async function render(el, ctx) {
  const s = ctx.estado.sessao;
  const todos = await ctx.db().listar('produtos');
  const busca = sem(tela.busca);
  const lista = todos.filter((p) => (tela.inativos || p.ativo)
    && (!busca || sem(`${p.categoria} ${p.descricao} ${p.detalhe}`).includes(busca)));
  const grupos = agruparProdutos(lista).map(([cat, itens]) => `
    <div class="painel grupo-produtos"><h2>${esc(cat)}</h2>
      <table class="tabela produtos"><thead><tr><th>Produto</th><th>Unidade</th><th style="text-align:right">Valor</th></tr></thead><tbody>
      ${itens.map((p) => `<tr class="clicavel ${p.ativo ? '' : 'inativo'}" data-id="${esc(p.id)}">
        <td><b>${esc(p.descricao)}</b>${p.ativo ? '' : ' <span class="etiqueta">Fora da tabela</span>'}${p.detalhe ? `<div class="fraco">${esc(p.detalhe)}</div>` : ''}</td>
        <td class="fraco">${esc(p.unidade)}</td>
        <td class="valor-orc">${Number(p.valor) ? dinheiro(p.valor) : 'sob consulta'}${p.mensal ? '<span class="fraco">/mês</span>' : ''}</td></tr>`).join('')}
      </tbody></table></div>`).join('');

  el.innerHTML = `
    <div class="cabecalho"><div><div class="sobre">Comercial</div><h1>Produtos e preços</h1></div>
      ${pode(s, 'comercial', 'criar') ? '<button class="botao primario" id="novo-produto">+ Novo produto</button>' : ''}</div>
    <p class="mudo">Esta é a tabela de preços dos orçamentos. Mudar um preço aqui vale para os próximos orçamentos; os que já foram feitos não mudam.</p>
    <div class="filtros"><input type="search" id="busca-produto" placeholder="Buscar produto" value="${esc(tela.busca)}">
      <label class="marcar"><input type="checkbox" id="ver-inativos" ${tela.inativos ? 'checked' : ''}> Mostrar os que estão fora da tabela</label></div>
    <div class="lista-produtos">${grupos || `<div class="painel"><div class="vazio">${todos.length ? 'Nenhum produto com essa busca.' : 'Nenhum produto ainda.'}</div></div>`}</div>`;

  const redesenhar = () => render(el, ctx);
  $('#busca-produto', el).addEventListener('input', (e) => {
    tela.busca = e.target.value;
    clearTimeout(tela.espera); tela.espera = setTimeout(async () => { await redesenhar(); const b = $('#busca-produto', el); b.focus(); b.setSelectionRange(b.value.length, b.value.length); }, 200);
  });
  $('#ver-inativos', el).addEventListener('change', (e) => { tela.inativos = e.target.checked; redesenhar(); });
  const categorias = [...new Set(todos.map((p) => p.categoria))];
  const abrir = (linha) => abrirFicha(ctx, {
    tabela: 'produtos', modulo: 'comercial', linha, depois: redesenhar, salvo: 'Produto salvo',
    titulo: { novo: 'Novo produto', de: (p) => p.descricao },
    padrao: { categoria: categorias[0] ?? 'Outros', unidade: 'un.', ativo: true, mensal: false, ordem: Math.max(0, ...todos.map((p) => p.ordem ?? 0)) + 10 },
    campos: [
      { nome: 'descricao', rotulo: 'Produto', obrigatorio: true, inteiro: true, max: 200 },
      { nome: 'detalhe', rotulo: 'Detalhe (aparece embaixo do nome no orçamento)', inteiro: true, max: 400 },
      { nome: 'categoria', rotulo: 'Grupo', obrigatorio: true, max: 60, sugestoes: categorias },
      { nome: 'unidade', rotulo: 'Unidade', max: 30, sugestoes: ['un.', 'vídeo', 'arte', 'projeto', 'mês', 'diária', 'página', 'lote'], dica: 'Como aparece na quantidade: "2 vídeos", "3 meses".' },
      { nome: 'valor', rotulo: 'Valor (R$)', tipo: 'valor', dica: 'Deixe 0 para "sob consulta".' },
      { nome: 'mensal', rotulo: 'Cobrado por mês (soma no total mensal)', tipo: 'checkbox' },
      { nome: 'ativo', rotulo: 'Aparece na tabela dos orçamentos', tipo: 'checkbox', inteiro: true },
    ],
  });
  $('#novo-produto', el)?.addEventListener('click', () => abrir(null));
  $$('tr[data-id]', el).forEach((tr) => tr.addEventListener('click', () => abrir(todos.find((p) => p.id === tr.dataset.id))));
}
