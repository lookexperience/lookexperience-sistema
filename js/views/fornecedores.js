// Fornecedores: gráficas, freelancers, locadoras e quem mais a LOOK contrata.
// Segue a permissão "Fornecedores".
import { pode } from '../permissoes.js';
import { esc, $, $$ } from '../util.js';
import { abrirFicha } from './ficha.js';

export const CATEGORIAS_FORNECEDOR = ['Gráfica', 'Freelancer', 'Locação de equipamento', 'Estúdio / espaço', 'Brindes', 'Comunicação visual', 'Software e serviços', 'Transporte', 'Outros'];
const tela = { busca: '', categoria: '' };
const sem = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export async function render(el, ctx) {
  const s = ctx.estado.sessao;
  const todos = (await ctx.db().listar('fornecedores')).sort((a, b) => a.nome.localeCompare(b.nome));
  const busca = sem(tela.busca);
  const lista = todos.filter((f) => (!tela.categoria || f.categoria === tela.categoria)
    && (!busca || sem(`${f.nome} ${f.categoria} ${f.contato} ${f.cidade} ${f.observacoes}`).includes(busca)));
  const categorias = [...new Set([...CATEGORIAS_FORNECEDOR, ...todos.map((f) => f.categoria).filter(Boolean)])];
  const linhas = lista.map((f) => `<tr class="clicavel" data-id="${esc(f.id)}">
    <td><b>${esc(f.nome)}</b>${f.site ? `<div class="fraco">${esc(f.site)}</div>` : ''}</td>
    <td>${f.categoria ? `<span class="etiqueta">${esc(f.categoria)}</span>` : ''}</td>
    <td>${esc(f.contato)}${f.telefone || f.email ? `<div class="fraco">${esc([f.telefone, f.email].filter(Boolean).join(' · '))}</div>` : ''}</td>
    <td class="fraco">${esc(f.cidade)}</td></tr>`).join('');

  el.innerHTML = `
    <div class="cabecalho"><div><div class="sobre">Fornecedores</div><h1>Fornecedores</h1></div>
      ${pode(s, 'fornecedores', 'criar') ? '<button class="botao primario" id="novo-fornecedor">+ Novo fornecedor</button>' : ''}</div>
    <div class="filtros"><input type="search" id="busca-fornecedor" placeholder="Buscar fornecedor" value="${esc(tela.busca)}">
      <select id="filtro-categoria"><option value="">Todas as categorias</option>${categorias.map((c) => `<option ${c === tela.categoria ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
    <div class="painel">${linhas ? `<table class="tabela fornecedores"><thead><tr><th>Fornecedor</th><th>Categoria</th><th>Contato</th><th>Cidade</th></tr></thead><tbody>${linhas}</tbody></table>`
      : `<div class="vazio">${todos.length ? 'Nenhum fornecedor com esse filtro.' : 'Nenhum fornecedor cadastrado.'}</div>`}</div>`;

  const redesenhar = () => render(el, ctx);
  $('#busca-fornecedor', el).addEventListener('input', (e) => {
    tela.busca = e.target.value;
    clearTimeout(tela.espera); tela.espera = setTimeout(async () => { await redesenhar(); const b = $('#busca-fornecedor', el); b.focus(); b.setSelectionRange(b.value.length, b.value.length); }, 200);
  });
  $('#filtro-categoria', el).addEventListener('change', (e) => { tela.categoria = e.target.value; redesenhar(); });
  const abrir = (linha) => abrirFicha(ctx, {
    tabela: 'fornecedores', modulo: 'fornecedores', linha, depois: redesenhar, salvo: 'Fornecedor salvo',
    titulo: { novo: 'Novo fornecedor', de: (f) => f.nome },
    campos: [
      { nome: 'nome', rotulo: 'Nome', obrigatorio: true, inteiro: true, max: 200 },
      { nome: 'categoria', rotulo: 'Categoria', max: 60, sugestoes: categorias },
      { nome: 'contato', rotulo: 'Pessoa de contato', max: 200 },
      { nome: 'telefone', rotulo: 'Telefone / WhatsApp', max: 60 },
      { nome: 'email', rotulo: 'E-mail', tipo: 'email', max: 320 },
      { nome: 'site', rotulo: 'Site ou Instagram', max: 300 },
      { nome: 'cidade', rotulo: 'Cidade', max: 120 },
      { nome: 'observacoes', rotulo: 'Observações (preços, prazos, como pedir)', tipo: 'textarea', inteiro: true },
    ],
  });
  $('#novo-fornecedor', el)?.addEventListener('click', () => abrir(null));
  $$('tr[data-id]', el).forEach((tr) => tr.addEventListener('click', () => abrir(todos.find((f) => f.id === tr.dataset.id))));
}
