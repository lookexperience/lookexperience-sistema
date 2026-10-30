import { pode } from '../permissoes.js';
import { esc, $, avisar } from '../util.js';
import { abrirModal } from './modal.js';
import { abrirProjeto } from './projetos.js';
import { STATUS_PROJETO, nomeDe } from '../config.js';
import { paletaCores, corCliente } from './comum.js';

export async function render(el, ctx) {
  const { estado } = ctx;
  const s = estado.sessao;
  const linhas = [...estado.clientes].sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => {
    const projetos = estado.projetos.filter((p) => p.cliente_id === c.id);
    const abertas = estado.tarefas.filter((t) => t.status !== 'feito' && projetos.some((p) => p.id === t.projeto_id)).length;
    return `<tr class="clicavel" data-id="${c.id}"><td><span class="ponto" style="background:${corCliente(c)};margin-right:8px"></span><b>${esc(c.nome)}</b></td><td>${esc(c.contato)}</td><td>${esc(c.instagram)}</td>
      <td>${projetos.length}</td><td>${abertas}</td></tr>`;
  }).join('');
  el.innerHTML = `
    <div class="cabecalho"><div><div class="sobre">Clientes</div><h1>Carteira de clientes</h1></div>
      ${pode(s, 'clientes', 'criar') ? '<button class="botao primario" id="novo">+ Novo cliente</button>' : ''}</div>
    <div class="painel">${linhas ? `<table class="tabela"><thead><tr><th>Cliente</th><th>Contato</th><th>Instagram</th><th>Projetos</th><th>Tarefas abertas</th></tr></thead><tbody>${linhas}</tbody></table>` : '<div class="vazio">Nenhum cliente cadastrado.</div>'}</div>`;
  el.querySelector('#novo')?.addEventListener('click', () => abrirCliente(ctx, null));
  el.querySelectorAll('tr[data-id]').forEach((tr) => tr.addEventListener('click', () => abrirCliente(ctx, estado.clientes.find((c) => c.id === tr.dataset.id))));
}

function abrirCliente(ctx, cliente) {
  const s = ctx.estado.sessao;
  const novo = !cliente;
  const c = cliente ?? { nome: '', contato: '', email: '', telefone: '', instagram: '', observacoes: '', cor: '' };
  const podeSalvar = novo ? pode(s, 'clientes', 'criar') : pode(s, 'clientes', 'editar');
  const dis = podeSalvar ? '' : 'disabled';
  const projetos = novo ? [] : ctx.estado.projetos.filter((p) => p.cliente_id === c.id);
  const campo = (nome, rotulo, tipo = 'text', inteiro = false) => `<div class="campo ${inteiro ? 'inteiro' : ''}"><label>${rotulo}</label><input type="${tipo}" name="${nome}" value="${esc(c[nome])}" ${dis} ${nome === 'nome' ? 'required' : ''}></div>`;
  const { el, fechar } = abrirModal({
    titulo: novo ? 'Novo cliente' : esc(c.nome),
    corpo: `<form class="grade-campos" id="form-cliente">
      ${campo('nome', 'Nome', 'text', true)}${campo('contato', 'Pessoa de contato')}${campo('telefone', 'Telefone')}${campo('email', 'E-mail', 'email')}${campo('instagram', 'Instagram')}
      <div class="campo inteiro"><label>Cor do cliente</label>${paletaCores(corCliente(c), 'cliente', !podeSalvar)}</div>
      <div class="campo inteiro"><label>Observações</label><textarea name="observacoes" ${dis}>${esc(c.observacoes)}</textarea></div></form>
      ${novo ? '' : `<div style="display:flex;justify-content:space-between;align-items:center;margin-top:24px">
        <h3>Projetos deste cliente</h3>
        ${pode(s, 'projetos', 'criar') ? '<button class="botao pequeno" id="novo-projeto">+ Novo projeto</button>' : ''}</div>
        <div class="lista">${projetos.map((p) => {
          const tarefas = ctx.estado.tarefas.filter((t) => t.projeto_id === p.id);
          const abertas = tarefas.filter((t) => t.status !== 'feito').length;
          return `<div class="item" data-projeto="${p.id}"><div class="titulo">${esc(p.nome)}<small>${esc(p.tipo) || 'Sem tipo'} · ${abertas} tarefa${abertas === 1 ? '' : 's'} aberta${abertas === 1 ? '' : 's'}</small></div>
            <span class="etiqueta">${nomeDe(STATUS_PROJETO, p.status)}</span></div>`;
        }).join('') || '<p class="fraco">Nenhum projeto ainda.</p>'}</div>`}`,
    rodape: `${!novo && pode(s, 'clientes', 'apagar') ? '<button class="botao perigo" id="apagar">Apagar</button>' : ''}<span class="espaco"></span>
      ${podeSalvar ? '<button class="botao primario" id="salvar">Salvar</button>' : ''}`,
  });
  el.querySelectorAll('.amostra').forEach((b) => b.addEventListener('click', () => {
    el.querySelectorAll('.amostra').forEach((x) => x.classList.toggle('escolhida', x === b));
  }));
  // Projeto aberto ou criado daqui volta para a ficha do cliente atualizada.
  const reabrir = () => abrirCliente(ctx, ctx.estado.clientes.find((x) => x.id === c.id));
  el.querySelectorAll('[data-projeto]').forEach((i) => i.addEventListener('click', () => {
    fechar();
    abrirProjeto(ctx, ctx.estado.projetos.find((p) => p.id === i.dataset.projeto), '', reabrir);
  }));
  $('#novo-projeto', el)?.addEventListener('click', () => { fechar(); abrirProjeto(ctx, null, c.id, reabrir); });
  $('#salvar', el)?.addEventListener('click', async () => {
    const form = $('#form-cliente', el);
    if (!form.reportValidity()) return;
    const dados = { ...Object.fromEntries(new FormData(form)), cor: $('.amostra.escolhida', el)?.dataset.cor ?? '' };
    try {
      if (novo) await ctx.db().inserir('clientes', dados); else await ctx.db().atualizar('clientes', c.id, dados);
      fechar(); avisar('Cliente salvo'); await ctx.recarregar();
    } catch (err) { avisar(err.message); }
  });
  $('#apagar', el)?.addEventListener('click', async (e) => {
    if (e.target.dataset.confirmar !== 'sim') { e.target.dataset.confirmar = 'sim'; e.target.textContent = 'Clique de novo para apagar'; return; }
    try { await ctx.db().apagar('clientes', c.id); fechar(); avisar('Cliente apagado'); await ctx.recarregar(); } catch (err) { avisar(err.message); }
  });
}
