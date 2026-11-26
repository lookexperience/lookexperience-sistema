// Criação: as peças de cada projeto (post, vídeo, logo...) e as versões
// enviadas ao cliente. Cada peça tem um link exclusivo (aprovacao.html#código)
// em que o cliente vê a última versão e aprova ou pede ajuste, sem login.
// Segue a permissão "Criação"; quem bloqueia de verdade é o banco.
import { pode } from '../permissoes.js';
import { TIPOS_PECA, STATUS_PECA, nomeDe } from '../config.js';
import { esc, $, $$, avisar, dataCurta, dataHora, iniciais, hoje } from '../util.js';
import { ACEITOS_PECA, tamanhoLegivel } from '../anexos.js';
import { abrirFicha } from './ficha.js';
import { corCliente } from './comum.js';

export const linkAprovacao = (pc) => `${location.origin}${location.pathname.replace(/[^/]*$/, '')}aprovacao.html#${pc.token}`;

const RESPOSTAS = { aguardando: 'Aguardando o cliente', aprovada: 'Aprovada', ajuste: 'Ajuste pedido', substituida: 'Substituída' };
const tela = { cliente: '', busca: '' };
const sem = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// "Cliente · Projeto" de cada peça.
function ondeEsta(ctx, pc) {
  const projeto = ctx.projeto(pc.projeto_id);
  const cliente = ctx.cliente(projeto?.cliente_id);
  return { projeto, cliente, texto: [cliente?.nome ?? 'Interno', projeto?.nome ?? 'Projeto'].join(' · ') };
}

// A versão que espera o cliente mas já tem outra mais nova foi substituída.
const respostaDe = (v, ultima) => (v.resposta === 'aguardando' && v.numero !== ultima ? 'substituida' : v.resposta);

export async function render(el, ctx) {
  const s = ctx.estado.sessao;
  const [pecas, versoes] = await Promise.all([ctx.db().listar('pecas'), ctx.db().listar('peca_versoes')]);
  const qtdVersoes = (id) => versoes.filter((v) => v.peca_id === id).length;
  const busca = sem(tela.busca);
  const visiveis = pecas.filter((pc) => {
    const { cliente, texto } = ondeEsta(ctx, pc);
    return (!tela.cliente || (tela.cliente === 'interno' ? !cliente : cliente?.id === tela.cliente))
      && (!busca || sem(`${pc.titulo} ${texto} ${nomeDe(TIPOS_PECA, pc.tipo)}`).includes(busca));
  }).sort((a, b) => (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999') || a.titulo.localeCompare(b.titulo));

  const cartao = (pc) => {
    const { cliente, texto } = ondeEsta(ctx, pc);
    const n = qtdVersoes(pc.id);
    const atrasada = pc.prazo && pc.prazo < hoje() && pc.status !== 'aprovada';
    const resp = ctx.nomePerfil(pc.responsavel_id);
    return `<div class="cartao" data-peca="${esc(pc.id)}" style="--cor-cliente:${corCliente(cliente)}">
      <div class="titulo">${esc(pc.titulo)}</div>
      <div class="cliente">${esc(texto)}</div>
      <div class="rodape"><span class="etiqueta">${esc(nomeDe(TIPOS_PECA, pc.tipo))}</span>
        ${n ? `<span class="etiqueta">v${n}</span>` : ''}
        ${pc.prazo ? `<span class="etiqueta ${atrasada ? 'atrasada' : ''}">${atrasada ? 'Atrasada · ' : ''}${esc(dataCurta(pc.prazo))}</span>` : ''}
        <span class="espaco"></span>${resp ? `<span class="avatar pequeno" title="${esc(resp)}">${esc(iniciais(resp))}</span>` : ''}</div></div>`;
  };
  const colunas = STATUS_PECA.map((st) => {
    const lista = visiveis.filter((pc) => pc.status === st.chave);
    return `<div class="coluna" data-status="${st.chave}"><div class="coluna-topo"><b>${st.nome}</b><span class="qtd">${lista.length}</span></div>
      ${lista.map(cartao).join('') || '<div class="vazio pequeno">Nada aqui.</div>'}</div>`;
  }).join('');
  const clientes = [...ctx.estado.clientes].sort((a, b) => a.nome.localeCompare(b.nome));

  el.innerHTML = `
    <div class="cabecalho"><div><div class="sobre">Criação</div><h1>Peças e aprovação</h1></div>
      ${pode(s, 'criacao', 'criar') ? '<button class="botao primario" id="nova-peca">+ Nova peça</button>' : ''}</div>
    <p class="mudo aviso-criacao">Cada peça tem um link para o cliente ver a última versão e aprovar ou pedir ajuste, sem precisar de login.</p>
    <div class="filtros">
      <select id="filtro-cliente-peca"><option value="">Todos os clientes</option><option value="interno" ${tela.cliente === 'interno' ? 'selected' : ''}>Interno (sem cliente)</option>
        ${clientes.map((c) => `<option value="${esc(c.id)}" ${tela.cliente === c.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select>
      <input type="search" id="busca-peca" placeholder="Buscar peça" value="${esc(tela.busca)}">
    </div>
    ${pecas.length ? `<div class="kanban criacao">${colunas}</div>` : '<div class="painel"><div class="vazio">Nenhuma peça ainda. Crie a primeira com "+ Nova peça".</div></div>'}`;

  const redesenhar = () => render(el, ctx);
  $('#filtro-cliente-peca', el).addEventListener('change', (e) => { tela.cliente = e.target.value; redesenhar(); });
  $('#busca-peca', el).addEventListener('input', (e) => {
    tela.busca = e.target.value;
    clearTimeout(tela.espera); tela.espera = setTimeout(async () => { await redesenhar(); const b = $('#busca-peca', el); b.focus(); b.setSelectionRange(b.value.length, b.value.length); }, 200);
  });
  $('#nova-peca', el)?.addEventListener('click', () => abrirPeca(ctx, null, redesenhar));
  $$('[data-peca]', el).forEach((c) => c.addEventListener('click', () => abrirPeca(ctx, pecas.find((pc) => pc.id === c.dataset.peca), redesenhar)));

  // Vindo de um aviso ("Cliente aprovou..."): abre a peça.
  if (ctx.estado.abrirPeca) {
    const alvo = pecas.find((pc) => pc.id === ctx.estado.abrirPeca);
    ctx.estado.abrirPeca = null;
    if (alvo) abrirPeca(ctx, alvo, redesenhar);
  }
}

function capa(ctx, v) {
  if (v.link) return '<span class="capa rotulo">LINK</span>';
  if (v.tipo.startsWith('image/')) return `<span class="capa"><img src="${esc(ctx.db().urlArquivoPeca(v.caminho))}" alt=""></span>`;
  return `<span class="capa rotulo">${v.tipo.startsWith('video/') ? 'VÍDEO' : 'PDF'}</span>`;
}

function blocoVersoes(ctx, pc, versoes) {
  const s = ctx.estado.sessao;
  const ultima = versoes[0]?.numero ?? 0;
  const podeEnviar = pode(s, 'criacao', 'criar') || pode(s, 'criacao', 'editar');
  const link = linkAprovacao(pc);
  const item = (v) => {
    const r = respostaDe(v, ultima);
    const url = v.link || ctx.db().urlArquivoPeca(v.caminho);
    const podeApagarV = pode(s, 'criacao', 'apagar') || (v.enviado_por === s.perfil.id && v.resposta === 'aguardando');
    return `<div class="versao" data-versao="${esc(v.id)}">
      ${capa(ctx, v)}
      <div class="info"><div><b>Versão ${v.numero}</b> <span class="etiqueta resposta-${r}">${RESPOSTAS[r]}</span></div>
        <div class="fraco">Enviada ${esc(dataHora(v.criado_em))}${ctx.nomePerfil(v.enviado_por) ? ` por ${esc(ctx.nomePerfil(v.enviado_por))}` : ''}${v.nome ? ` · ${esc(v.nome)} (${tamanhoLegivel(v.tamanho)})` : ''}</div>
        ${v.observacao ? `<div class="observacao">${esc(v.observacao)}</div>` : ''}
        ${v.respondido_em ? `<div class="comentario-cliente"><b>${esc(v.nome_cliente)}</b> <span class="fraco">${esc(dataHora(v.respondido_em))}</span>${v.comentario_cliente ? `<div>${esc(v.comentario_cliente)}</div>` : ''}</div>` : ''}
      </div>
      <div class="acoes"><a class="botao pequeno" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Abrir</a>
        ${podeApagarV ? '<button class="botao pequeno perigo" data-apagar-versao>Apagar</button>' : ''}</div></div>`;
  };
  return `<div class="versoes">
    <div class="anexos-topo"><h3>Link de aprovação do cliente</h3></div>
    <div class="linha-link"><input type="text" readonly class="link-peca" value="${esc(link)}">
      <button class="botao pequeno" id="copiar-link-peca">Copiar link</button>
      <a class="botao pequeno sutil" href="${esc(link)}" target="_blank" rel="noopener">Ver como o cliente</a></div>
    ${podeEnviar ? `<form class="nova-versao" id="form-versao">
      <h3>Enviar versão ${ultima + 1}</h3>
      <div class="grade-campos">
        <div class="campo"><label>Arquivo (imagem, PDF ou vídeo até 50 MB)</label><input type="file" name="arquivo" accept="${ACEITOS_PECA}"></div>
        <div class="campo"><label>ou link (Google Drive, YouTube...)</label><input type="text" name="link" maxlength="1000" placeholder="https://"></div>
        <div class="campo inteiro"><label>Recado para o cliente (opcional)</label><textarea name="observacao" maxlength="5000" rows="2"></textarea></div>
      </div>
      <div class="erro" id="erro-versao"></div>
      <button type="submit" class="botao primario" id="enviar-versao">Enviar versão ${ultima + 1}</button>
    </form>` : ''}
    <div class="lista-versoes">${versoes.map(item).join('') || '<div class="vazio pequeno">Nenhuma versão enviada ainda. O cliente vê a peça assim que a primeira versão for enviada.</div>'}</div>
  </div>`;
}

// Janela da peça: dados da peça em cima e, para peça já salva, o link do
// cliente, o envio de versão nova e a lista de versões com as respostas.
export async function abrirPeca(ctx, pc, aoMudar) {
  const versoes = pc ? (await ctx.db().listar('peca_versoes', { peca_id: pc.id })).sort((a, b) => b.numero - a.numero) : [];
  const nomeProjeto = (p) => `${ctx.cliente(p.cliente_id)?.nome ?? 'Interno'} · ${p.nome}`;
  const projetos = ctx.estado.projetos.filter((p) => p.status !== 'concluido' || p.id === pc?.projeto_id)
    .map((p) => ({ chave: p.id, nome: nomeProjeto(p) })).sort((a, b) => a.nome.localeCompare(b.nome));
  if (!pc && !projetos.length) { avisar('Crie um projeto antes: toda peça é de um projeto.'); return; }
  const equipe = ctx.estado.perfis.filter((p) => p.ativo || p.id === pc?.responsavel_id).sort((a, b) => a.nome.localeCompare(b.nome)).map((p) => ({ chave: p.id, nome: p.nome }));
  const reabrir = async (id) => {
    await aoMudar();
    const nova = (await ctx.db().listar('pecas', { id }))[0];
    if (nova) await abrirPeca(ctx, nova, aoMudar);
  };

  const { el, fechar } = abrirFicha(ctx, {
    tabela: 'pecas', modulo: 'criacao', linha: pc, largo: true, salvo: 'Peça salva',
    titulo: { novo: 'Nova peça', de: (r) => r.titulo },
    padrao: { tipo: 'post', status: 'em_criacao', projeto_id: projetos[0]?.chave, responsavel_id: ctx.estado.sessao.perfil.id },
    campos: [
      { nome: 'titulo', rotulo: 'Peça', obrigatorio: true, inteiro: true, max: 200, dica: 'Ex.: Post de lançamento, Reels da inauguração, Logo.' },
      { nome: 'projeto_id', rotulo: 'Projeto', tipo: 'select', opcoes: projetos },
      { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', opcoes: TIPOS_PECA },
      { nome: 'responsavel_id', rotulo: 'Responsável', tipo: 'select', vazio: 'Ninguém', opcoes: equipe },
      { nome: 'prazo', rotulo: 'Prazo', tipo: 'data' },
      { nome: 'status', rotulo: 'Situação', tipo: 'select', opcoes: STATUS_PECA, dica: 'Muda sozinha quando uma versão é enviada e quando o cliente responde.' },
      { nome: 'descricao', rotulo: 'Sobre a peça (o cliente vê este texto)', tipo: 'textarea', inteiro: true, max: 5000 },
    ],
    extra: pc ? blocoVersoes(ctx, pc, versoes) : '<p class="mudo">Depois de salvar, envie a primeira versão e copie o link para o cliente.</p>',
    depois: async (salva) => { if (!pc && salva) await reabrir(salva.id); else await aoMudar(); },
  });
  if (!pc) return;

  $('#copiar-link-peca', el).addEventListener('click', async () => {
    const campo = $('.link-peca', el);
    try { await navigator.clipboard.writeText(campo.value); avisar('Link copiado'); } catch { campo.select(); avisar('Selecione e copie o link (Ctrl+C)'); }
  });

  $('#form-versao', el)?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const erro = $('#erro-versao', el);
    const arquivo = form.arquivo.files[0];
    const link = form.link.value.trim();
    erro.textContent = '';
    if (!arquivo && !link) { erro.textContent = 'Escolha um arquivo ou cole um link.'; return; }
    if (arquivo && link) { erro.textContent = 'Envie o arquivo ou o link, não os dois.'; return; }
    const botao = $('#enviar-versao', el);
    botao.disabled = true; botao.textContent = 'Enviando…';
    try {
      await ctx.db().enviarVersaoPeca(pc.id, { arquivo, link, observacao: form.observacao.value.trim() });
      fechar(); avisar('Versão enviada. Mande o link para o cliente.');
      await reabrir(pc.id);
    } catch (err) {
      erro.textContent = err.message;
      botao.disabled = false; botao.textContent = `Enviar versão ${(versoes[0]?.numero ?? 0) + 1}`;
    }
  });

  $$('[data-apagar-versao]', el).forEach((b) => b.addEventListener('click', async () => {
    if (b.dataset.confirmar !== 'sim') { b.dataset.confirmar = 'sim'; b.textContent = 'Clique de novo'; return; }
    const v = versoes.find((x) => x.id === b.closest('[data-versao]').dataset.versao);
    try { await ctx.db().apagarVersaoPeca(v); fechar(); avisar('Versão apagada'); await reabrir(pc.id); } catch (err) { $('#erro-ficha', el).textContent = err.message; }
  }));
}
