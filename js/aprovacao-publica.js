// Página do cliente para aprovar uma peça (aprovacao.html#código). Não
// precisa de login: o código do link, sorteado pelo banco, é a única chave
// e só abre esta peça. Mostra a última versão e o cliente aprova ou pede
// ajuste; as versões anteriores ficam logo abaixo.
import { iniciarDados } from './dados.js';
import { TIPOS_PECA, nomeDe } from './config.js';
import { esc, $, dataHora } from './util.js';

const raiz = $('#aprovacao');
const token = location.hash.slice(1);
const CHAVE_NOME = 'look-aprovacao-nome';
const logo = '<img class="logo" src="img/logo-horizontal-branca.png" alt="LOOK">';
let db;

const mensagem = (titulo, texto) => {
  raiz.innerHTML = `${logo}<h1>${esc(titulo)}</h1><p class="mudo">${esc(texto)}</p>`;
};

// A versão: imagem e vídeo aparecem na página; PDF e link abrem em outra aba.
function midia(v) {
  if (v.link) {
    return `<a class="botao primario" href="${esc(v.link)}" target="_blank" rel="noopener noreferrer">Abrir o arquivo</a>
      <p class="fraco">O arquivo está num link externo (Google Drive, YouTube...). Abra, veja com calma e volte aqui para responder.</p>`;
  }
  const url = esc(db.urlArquivoPeca(v.caminho));
  if (v.tipo.startsWith('image/')) return `<a href="${url}" target="_blank" rel="noopener noreferrer" title="Ver em tamanho real"><img class="previa" src="${url}" alt="Versão ${v.numero}"></a>`;
  if (v.tipo.startsWith('video/')) return `<video class="previa" src="${url}" controls playsinline preload="metadata"></video>`;
  return `<a class="botao primario" href="${url}" target="_blank" rel="noopener noreferrer">Abrir o PDF</a>`;
}

function resposta(v) {
  if (v.resposta === 'aprovada') return `<div class="resposta aprovada"><b>Aprovada</b> por ${esc(v.nome_cliente)} em ${esc(dataHora(v.respondido_em))}${v.comentario_cliente ? `<p>${esc(v.comentario_cliente)}</p>` : ''}</div>`;
  if (v.resposta === 'ajuste') return `<div class="resposta ajuste"><b>Ajuste pedido</b> por ${esc(v.nome_cliente)} em ${esc(dataHora(v.respondido_em))}<p>${esc(v.comentario_cliente)}</p></div>`;
  return '';
}

function formulario() {
  let nome = '';
  try { nome = localStorage.getItem(CHAVE_NOME) ?? ''; } catch { /* sem armazenamento */ }
  return `<form id="form-aprovacao" class="form-aprovacao" novalidate>
    <h2>O que você achou?</h2>
    <div class="campo"><label for="nome-cliente">Seu nome</label><input type="text" id="nome-cliente" name="nome" maxlength="120" autocomplete="name" value="${esc(nome)}"></div>
    <div class="campo"><label for="comentario-cliente">Comentário <span class="fraco">(obrigatório para pedir ajuste)</span></label>
      <textarea id="comentario-cliente" name="comentario" maxlength="5000" rows="4" placeholder="Ex.: aumentar o logo, trocar a foto, mudar o texto da chamada…"></textarea></div>
    <div id="erro-aprovacao" class="erro-briefing" role="alert"></div>
    <div class="botoes-aprovacao">
      <button type="button" class="botao primario" id="aprovar">Aprovar esta versão</button>
      <button type="button" class="botao" id="pedir-ajuste">Pedir ajuste</button>
    </div>
  </form>`;
}

async function desenhar(agradecimento = '') {
  let peca;
  try { peca = await db.abrirPeca(token); } catch {
    mensagem('Não deu para abrir', 'Confira sua internet e tente de novo em alguns minutos.'); return;
  }
  if (!peca) { mensagem('Link não encontrado', 'Este link não existe mais. Peça um novo para a LOOK.'); return; }
  const [ultima, ...anteriores] = peca.versoes ?? [];
  const topo = `${logo}
    <div class="sobre">${esc([peca.cliente, peca.projeto].filter(Boolean).join(' · '))}</div>
    <h1>${esc(peca.titulo)}</h1>
    <span class="etiqueta">${esc(nomeDe(TIPOS_PECA, peca.tipo))}</span>
    ${peca.descricao ? `<p class="descricao">${esc(peca.descricao)}</p>` : ''}
    ${agradecimento ? `<div class="obrigado" role="status">${esc(agradecimento)}</div>` : ''}`;
  if (!ultima) {
    raiz.innerHTML = `${topo}<section class="secao"><p class="mudo">A LOOK ainda está criando esta peça. Assim que a primeira versão ficar pronta, ela aparece aqui, neste mesmo link.</p></section>`;
    return;
  }
  raiz.innerHTML = `${topo}
    <section class="secao versao-atual">
      <h2>Versão ${ultima.numero}</h2><div class="fraco">Enviada em ${esc(dataHora(ultima.criado_em))}</div>
      ${ultima.observacao ? `<p class="recado"><b>Recado da LOOK:</b> ${esc(ultima.observacao)}</p>` : ''}
      <div class="midia">${midia(ultima)}</div>
      ${ultima.resposta === 'aguardando' ? formulario() : resposta(ultima)}
      ${ultima.resposta === 'ajuste' ? '<p class="mudo">A LOOK vai preparar uma nova versão e ela aparece aqui, neste mesmo link.</p>' : ''}
    </section>
    ${anteriores.length ? `<details class="secao anteriores"><summary>Versões anteriores (${anteriores.length})</summary>
      ${anteriores.map((v) => `<div class="versao-antiga"><h3>Versão ${v.numero} <span class="fraco">· ${esc(dataHora(v.criado_em))}</span></h3>
        <div class="midia">${midia(v)}</div>${resposta(v) || '<p class="fraco">Substituída por uma versão mais nova.</p>'}</div>`).join('')}</details>` : ''}`;

  const form = $('#form-aprovacao');
  if (!form) return;
  const erro = $('#erro-aprovacao');
  const responder = async (tipo, botao) => {
    const nome = form.nome.value.trim();
    const comentario = form.comentario.value.trim();
    erro.textContent = '';
    if (!nome) { erro.textContent = 'Escreva seu nome, para a LOOK saber quem respondeu.'; form.nome.focus(); return; }
    if (tipo === 'ajuste' && !comentario) { erro.textContent = 'Conte no comentário o que precisa ajustar.'; form.comentario.focus(); return; }
    // Aprovar pede um segundo clique, para não aprovar sem querer.
    if (tipo === 'aprovada' && botao.dataset.confirmar !== 'sim') { botao.dataset.confirmar = 'sim'; botao.textContent = 'Clique de novo para confirmar'; return; }
    try { localStorage.setItem(CHAVE_NOME, nome); } catch { /* ok */ }
    form.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    try {
      await db.responderPeca(token, tipo, comentario, nome);
      await desenhar(tipo === 'aprovada' ? 'Obrigado! A versão foi aprovada e a LOOK já foi avisada.' : 'Obrigado! Seu pedido de ajuste foi enviado para a LOOK.');
      scrollTo(0, 0);
    } catch (err) {
      erro.textContent = err.message;
      form.querySelectorAll('button').forEach((b) => { b.disabled = false; });
    }
  };
  $('#aprovar').addEventListener('click', (e) => responder('aprovada', e.currentTarget));
  $('#pedir-ajuste').addEventListener('click', (e) => responder('ajuste', e.currentTarget));
}

async function iniciar() {
  if (!/^[0-9a-f]{64}$/.test(token)) { mensagem('Link incompleto', 'Confira se o link foi copiado inteiro, ou peça um novo para a LOOK.'); return; }
  try { db = await iniciarDados(); } catch {
    mensagem('Não deu para abrir', 'Confira sua internet e tente de novo em alguns minutos.'); return;
  }
  await desenhar();
}

// Trocar o código no endereço abre a outra peça.
addEventListener('hashchange', () => location.reload());

iniciar();
