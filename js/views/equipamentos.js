// Equipamentos: o que a LOOK tem, se está disponível e com quem ou onde
// está cada item. Segue a permissão "Equipamentos".
import { pode } from '../permissoes.js';
import { esc, $, $$, dataCurta } from '../util.js';
import { abrirFicha } from './ficha.js';

export const STATUS_EQUIPAMENTO = [
  { chave: 'disponivel', nome: 'Disponível' },
  { chave: 'em_uso', nome: 'Em uso' },
  { chave: 'manutencao', nome: 'Em manutenção' },
  { chave: 'indisponivel', nome: 'Indisponível' },
];
const CATEGORIAS = ['Câmera', 'Lente', 'Áudio', 'Iluminação', 'Tripé e suporte', 'Estabilizador', 'Drone', 'Computador', 'Armazenamento', 'Bateria e energia', 'Acessório', 'Outros'];
const nomeStatus = (c) => STATUS_EQUIPAMENTO.find((x) => x.chave === c)?.nome ?? c;
const tela = { filtro: 'todos', busca: '' };
const sem = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export async function render(el, ctx) {
  const s = ctx.estado.sessao;
  const todos = (await ctx.db().listar('equipamentos')).sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nome.localeCompare(b.nome));
  const conta = (st) => todos.filter((e) => e.status === st).length;
  const busca = sem(tela.busca);
  const comQuem = (e) => [ctx.nomePerfil(e.com_id), e.local].filter(Boolean);
  const lista = todos.filter((e) => (tela.filtro === 'todos' || e.status === tela.filtro)
    && (!busca || sem(`${e.nome} ${e.categoria} ${e.marca_modelo} ${e.numero_serie} ${comQuem(e).join(' ')}`).includes(busca)));
  const linhas = lista.map((e) => `<tr class="clicavel" data-id="${esc(e.id)}">
    <td><b>${esc(e.nome)}</b>${e.marca_modelo ? `<div class="fraco">${esc(e.marca_modelo)}</div>` : ''}</td>
    <td class="fraco">${esc(e.categoria)}</td>
    <td><span class="etiqueta equip-${esc(e.status)}">${esc(nomeStatus(e.status))}</span></td>
    <td>${comQuem(e).map(esc).join(' · ') || '<span class="fraco">—</span>'}${e.atualizado_em ? `<div class="fraco">desde ${esc(dataCurta(e.atualizado_em))}</div>` : ''}</td></tr>`).join('');

  el.innerHTML = `
    <div class="cabecalho"><div><div class="sobre">Equipamentos</div><h1>Equipamentos</h1></div>
      ${pode(s, 'equipamentos', 'criar') ? '<button class="botao primario" id="novo-equipamento">+ Novo equipamento</button>' : ''}</div>
    <div class="numeros financas">${STATUS_EQUIPAMENTO.map((st) => `<div class="numero"><div class="rotulo">${st.nome}</div><div class="valor" id="qtd-${st.chave}">${conta(st.chave)}</div></div>`).join('')}</div>
    <div class="abas abas-orc">${[{ chave: 'todos', nome: 'Todos' }, ...STATUS_EQUIPAMENTO].map((f) =>
      `<button class="aba ${tela.filtro === f.chave ? 'ativa' : ''}" data-filtro="${f.chave}">${f.nome}</button>`).join('')}</div>
    <div class="filtros"><input type="search" id="busca-equipamento" placeholder="Buscar por nome, modelo ou pessoa" value="${esc(tela.busca)}"></div>
    <div class="painel">${linhas ? `<table class="tabela equipamentos"><thead><tr><th>Equipamento</th><th>Categoria</th><th>Situação</th><th>Com quem / onde</th></tr></thead><tbody>${linhas}</tbody></table>`
      : `<div class="vazio">${todos.length ? 'Nenhum equipamento neste filtro.' : 'Nenhum equipamento cadastrado.'}</div>`}</div>`;

  const redesenhar = () => render(el, ctx);
  $$('[data-filtro]', el).forEach((b) => b.addEventListener('click', () => { tela.filtro = b.dataset.filtro; redesenhar(); }));
  $('#busca-equipamento', el).addEventListener('input', (e) => {
    tela.busca = e.target.value;
    clearTimeout(tela.espera); tela.espera = setTimeout(async () => { await redesenhar(); const b = $('#busca-equipamento', el); b.focus(); b.setSelectionRange(b.value.length, b.value.length); }, 200);
  });
  const equipe = ctx.estado.perfis.filter((p) => p.ativo).sort((a, b) => a.nome.localeCompare(b.nome)).map((p) => ({ chave: p.id, nome: p.nome }));
  const abrir = (linha) => {
    const { form } = abrirFicha(ctx, {
      tabela: 'equipamentos', modulo: 'equipamentos', linha, depois: redesenhar, salvo: 'Equipamento salvo',
      titulo: { novo: 'Novo equipamento', de: (e) => e.nome },
      padrao: { status: 'disponivel', com_id: null, local: '' },
      campos: [
        { nome: 'nome', rotulo: 'Equipamento', obrigatorio: true, inteiro: true, max: 200 },
        { nome: 'categoria', rotulo: 'Categoria', max: 60, sugestoes: CATEGORIAS },
        { nome: 'marca_modelo', rotulo: 'Marca e modelo', max: 200 },
        { nome: 'numero_serie', rotulo: 'Número de série', max: 120 },
        { nome: 'status', rotulo: 'Situação', tipo: 'select', opcoes: STATUS_EQUIPAMENTO },
        { nome: 'com_id', rotulo: 'Com quem está', tipo: 'select', vazio: 'Ninguém (guardado)', opcoes: equipe },
        { nome: 'local', rotulo: 'Onde está', max: 200, sugestoes: ['Estúdio LOOK', 'Casa do Pablo', 'Assistência técnica'], dica: 'Ex.: estúdio, casa de alguém, assistência técnica.' },
        { nome: 'observacoes', rotulo: 'Observações (acessórios, defeitos, valor)', tipo: 'textarea', inteiro: true },
      ],
      // Voltou para "Disponível": não está mais com ninguém.
      antesDeSalvar: (d) => { if (d.status === 'disponivel') d.com_id = null; },
    });
    // Escolher uma pessoa já marca como "Em uso".
    form.com_id.addEventListener('change', () => { if (form.com_id.value && form.status.value === 'disponivel') form.status.value = 'em_uso'; });
  };
  $('#novo-equipamento', el)?.addEventListener('click', () => abrir(null));
  $$('tr[data-id]', el).forEach((tr) => tr.addEventListener('click', () => abrir(todos.find((e) => e.id === tr.dataset.id))));
}
