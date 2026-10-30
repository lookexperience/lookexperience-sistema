import { iniciarDados, db } from './dados.js';
import { MODULOS } from './config.js';
import { VERSAO } from './versao.js';
import { pode, temAlgumAcesso } from './permissoes.js';
import { esc, $, $$, ICONES, iniciais, dataCurta, avisar } from './util.js';
import { abrirTarefa } from './views/tarefa.js';
import { filtros } from './views/comum.js';
import * as visaoGeral from './views/visao-geral.js';
import * as atividades from './views/atividades.js';
import * as calendario from './views/calendario.js';
import * as clientes from './views/clientes.js';
import * as projetos from './views/projetos.js';
import * as equipe from './views/equipe.js';
import * as sobre from './views/sobre.js';

// Telas da fase 1. "modulo" é a permissão que libera a tela.
const ROTAS = [
  { rota: 'visao-geral', nome: 'Visão geral', modulo: 'visao_geral', icone: 'geral', view: visaoGeral },
  { rota: 'atividades', nome: 'Atividades', modulo: 'tarefas', icone: 'kanban', view: atividades },
  { rota: 'calendario', nome: 'Calendário', modulo: 'tarefas', icone: 'calendario', view: calendario },
  { rota: 'clientes', nome: 'Clientes', modulo: 'clientes', icone: 'clientes', view: clientes },
  { rota: 'projetos', nome: 'Projetos', modulo: 'projetos', icone: 'projetos', view: projetos },
  { rota: 'equipe', nome: 'Equipe e acessos', modulo: 'equipe', icone: 'equipe', view: equipe },
  { rota: 'sobre', nome: 'Sobre o sistema', modulo: null, icone: 'sobre', view: sobre },
];

// Módulos das próximas fases, mostrados apagados no menu.
const FUTUROS = MODULOS.filter((m) => m.fase > 1);

const raiz = document.getElementById('app');
const estado = { sessao: null, perfis: [], clientes: [], projetos: [], tarefas: [], avisos: [] };

const ctx = {
  estado,
  db: () => db,
  recarregar: async () => { await carregar(); desenharPagina(); },
  abrirTarefa: (tarefa, padrao) => abrirTarefa(ctx, tarefa, padrao),
  navegar: (rota) => { location.hash = `#/${rota}`; },
  nomePerfil: (id) => estado.perfis.find((p) => p.id === id)?.nome ?? '',
  projeto: (id) => estado.projetos.find((p) => p.id === id),
  cliente: (id) => estado.clientes.find((c) => c.id === id),
};

async function carregar() {
  estado.sessao = await db.sessao();
  if (!estado.sessao) return;
  const [perfis, cli, proj, tar, av] = await Promise.all([
    db.listar('perfis'), db.listar('clientes'), db.listar('projetos'), db.listar('tarefas'), db.listar('avisos'),
  ]);
  Object.assign(estado, { perfis, clientes: cli, projetos: proj, tarefas: tar, avisos: av });
}

const rotasPermitidas = () => ROTAS.filter((r) => !r.modulo || pode(estado.sessao, r.modulo, 'ver'));

function rotaAtual() {
  const nome = location.hash.replace(/^#\/?/, '') || 'visao-geral';
  const permitidas = rotasPermitidas();
  return permitidas.find((r) => r.rota === nome) ?? permitidas[0];
}

// ---------- Entrada (login) ----------
function desenharEntrada(modoCriar = false, aviso = '') {
  raiz.innerHTML = `
    <div class="entrada"><div class="caixa">
      <img src="img/logo-horizontal-branca.png" alt="LOOK Direção de Marca & Conteúdo">
      <form id="form-entrada">
        <h2>${modoCriar ? 'Criar conta' : 'Entrar no sistema'}</h2>
        ${modoCriar ? '<div class="campo"><label>Nome completo</label><input type="text" name="nome" maxlength="120" required autocomplete="name"></div>' : ''}
        <div class="campo"><label>E-mail</label><input type="email" name="email" required autocomplete="email"></div>
        <div class="campo"><label>Senha</label><input type="password" name="senha" required minlength="6" autocomplete="${modoCriar ? 'new-password' : 'current-password'}"></div>
        ${aviso ? `<div class="aviso-entrada">${esc(aviso)}</div>` : ''}
        <div class="erro" id="erro-entrada"></div>
        <button class="botao primario" type="submit">${modoCriar ? 'Criar conta' : 'Entrar'}</button>
      </form>
      <div class="troca">${modoCriar ? 'Já tem conta?' : 'Primeira vez aqui?'} <button type="button" id="trocar">${modoCriar ? 'Entrar' : 'Criar conta'}</button></div>
    </div></div>`;
  $('#trocar').onclick = () => desenharEntrada(!modoCriar);
  $('#form-entrada').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const erro = $('#erro-entrada');
    const botao = e.target.querySelector('button[type=submit]');
    erro.textContent = '';
    botao.disabled = true; // evita mandar o cadastro duas vezes
    try {
      if (modoCriar) {
        const r = await db.criarConta(f.get('nome').trim(), f.get('email').trim(), f.get('senha'));
        if (r?.precisaConfirmar) {
          desenharEntrada(false, 'Conta criada. Enviamos um link de confirmação para o seu e-mail: clique nele e depois entre aqui.');
          return;
        }
      } else {
        await db.entrar(f.get('email').trim(), f.get('senha'));
      }
      await iniciarApp();
    } catch (err) { erro.textContent = err.message; botao.disabled = false; }
  };
}

// ---------- Estrutura ----------
function faixaDemo() {
  if (db.modo !== 'demo') return '';
  const opcoes = db.usuariosDemo().map((u) => `<option value="${u.id}" ${u.id === db.usuarioDemo() ? 'selected' : ''}>${esc(u.nome)}${u.cargo ? ` · ${esc(u.cargo)}` : ' · sem acesso'}</option>`).join('');
  return `<div class="faixa-demo"><b>Demonstração</b><span>Dados de exemplo, salvos só neste navegador. Ver o sistema como:</span>
    <select id="usuario-demo">${opcoes}</select><span class="espaco"></span><button id="resetar-demo">Recomeçar exemplo</button></div>`;
}

function desenharEstrutura() {
  const perfil = estado.sessao.perfil;
  const atual = rotaAtual();
  const menu = rotasPermitidas().filter((r) => r.rota !== 'sobre').map((r) =>
    `<a href="#/${r.rota}" class="${r === atual ? 'ativo' : ''}">${ICONES[r.icone]}<span>${r.nome}</span></a>`).join('');
  const futuros = FUTUROS.map((m) => `<a class="futuro">${ICONES[m.chave] ?? ''}<span>${m.nome}</span><span class="fase">fase ${m.fase}</span></a>`).join('');
  raiz.innerHTML = `
    ${faixaDemo()}
    <div class="app">
      <aside class="lateral">
        <div class="marca"><img src="img/logo-horizontal-branca.png" alt="LOOK"><span>Sistema interno</span></div>
        <nav class="menu">${menu}<div class="grupo">Em breve</div>${futuros}</nav>
        <div class="rodape"><a href="#/sobre">Versão ${VERSAO}</a></div>
      </aside>
      <div class="principal">
        <header class="topo">
          <span class="espaco"></span>
          <button class="botao sutil sino" id="abrir-avisos" title="Avisos">${ICONES.sino}<span id="contador-avisos"></span></button>
          <span class="avatar" title="${esc(perfil.nome)}">${esc(iniciais(perfil.nome))}</span>
          <span>${esc(perfil.nome.split(' ')[0])}</span>
          ${db.modo === 'demo' ? '' : `<button class="botao sutil" id="sair" title="Sair">${ICONES.sair}</button>`}
        </header>
        <main class="conteudo" id="pagina"></main>
      </div>
    </div>
    <div class="caixa-avisos oculto" id="caixa-avisos"></div>`;

  $('#sair')?.addEventListener('click', async () => { await db.sair(); desenharEntrada(); });
  $('#usuario-demo')?.addEventListener('change', async (e) => { db.trocarUsuario(e.target.value); await iniciarApp(); });
  $('#resetar-demo')?.addEventListener('click', async () => { db.resetar(); await iniciarApp(); avisar('Exemplo recomeçado'); });
  $('#abrir-avisos').onclick = (e) => { e.stopPropagation(); alternarAvisos(); };
  atualizarContador();
}

function atualizarContador() {
  const n = estado.avisos.filter((a) => !a.lido).length;
  const el = $('#contador-avisos');
  if (el) el.innerHTML = n ? `<span class="contador">${n}</span>` : '';
}

function alternarAvisos() {
  const caixa = $('#caixa-avisos');
  if (!caixa.classList.contains('oculto')) { caixa.classList.add('oculto'); return; }
  caixa.innerHTML = estado.avisos.length
    ? estado.avisos.map((a) => `<div class="aviso ${a.lido ? '' : 'novo'}" data-id="${a.id}">${esc(a.texto)}<div class="fraco">${dataCurta(a.criado_em)}</div></div>`).join('')
    : '<div class="vazio">Nenhum aviso por enquanto.</div>';
  caixa.classList.remove('oculto');
  $$('.aviso', caixa).forEach((el) => el.onclick = async () => {
    const aviso = estado.avisos.find((a) => a.id === el.dataset.id);
    caixa.classList.add('oculto');
    if (!aviso.lido) { await db.atualizar('avisos', aviso.id, { lido: true }); aviso.lido = true; atualizarContador(); }
    const tarefa = estado.tarefas.find((t) => t.id === aviso.tarefa_id);
    if (tarefa) ctx.abrirTarefa(tarefa);
  });
}

function desenharSemAcesso() {
  raiz.innerHTML = `${faixaDemo()}
    <div class="entrada"><div class="caixa" style="text-align:center">
      <img src="img/logo-horizontal-branca.png" alt="LOOK">
      ${estado.sessao.perfil.ativo
        ? `<h2>Aguardando liberação</h2>
      <p class="mudo">Sua conta foi criada, ${esc(estado.sessao.perfil.nome.split(' ')[0])}. O administrador precisa liberar o que você pode ver no sistema. Assim que liberar, é só recarregar esta página.</p>`
        : `<h2>Conta desativada</h2>
      <p class="mudo">Esta conta não tem mais acesso ao sistema. Se for engano, fale com o administrador.</p>`}
      ${db.modo === 'demo' ? '' : '<button class="botao" id="sair">Sair</button>'}
    </div></div>`;
  $('#usuario-demo')?.addEventListener('change', async (e) => { db.trocarUsuario(e.target.value); await iniciarApp(); });
  $('#resetar-demo')?.addEventListener('click', async () => { db.resetar(); await iniciarApp(); });
  $('#sair')?.addEventListener('click', async () => { await db.sair(); desenharEntrada(); });
}

async function desenharPagina() {
  if (!estado.sessao) return;
  const atual = rotaAtual();
  $$('.menu a[href]').forEach((a) => a.classList.toggle('ativo', a.getAttribute('href') === `#/${atual.rota}`));
  const pagina = $('#pagina');
  if (!pagina) return;
  try {
    await atual.view.render(pagina, ctx);
  } catch (err) {
    pagina.innerHTML = `<div class="painel erro">Algo deu errado ao abrir esta tela: ${esc(err.message)}</div>`;
    console.error(err);
  }
  atualizarContador();
}

async function iniciarApp() {
  // Filtros são de quem está usando: limpa ao entrar ou trocar de usuário.
  Object.keys(filtros).forEach((k) => { filtros[k] = ''; });
  await carregar();
  if (!estado.sessao) return desenharEntrada();
  if (!temAlgumAcesso(estado.sessao)) return desenharSemAcesso();
  desenharEstrutura();
  await desenharPagina();
}

document.addEventListener('click', (e) => { if (!e.target.closest('#caixa-avisos')) $('#caixa-avisos')?.classList.add('oculto'); });
window.addEventListener('hashchange', () => { if (estado.sessao) desenharPagina(); });

// Novos avisos chegam a cada minuto, sem recarregar a página.
setInterval(async () => {
  if (!estado.sessao || document.hidden) return;
  try { estado.avisos = await db.listar('avisos'); atualizarContador(); } catch { /* tenta de novo no próximo minuto */ }
}, 60000);

(async () => {
  try {
    await iniciarDados();
    await iniciarApp();
  } catch (err) {
    raiz.innerHTML = `<div class="entrada"><div class="caixa"><h2>Não foi possível abrir o sistema</h2><p class="erro">${esc(err.message)}</p></div></div>`;
    console.error(err);
  }
})();
