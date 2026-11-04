// Tela "Apresentações": joga um Word e sai a apresentação no padrão LOOK.
// Tudo acontece no navegador de quem usa: o Word não é enviado nem guardado.
import { esc, $, avisar } from '../util.js';
import { lerDocx } from '../apresentacao/docx.js';
import {
  montarApresentacao, desenharSlide, ajustarTamanhos, gerarArquivo, nomeDoArquivo, apresentador,
  CSS_SLIDES, CSS_PALCO, LARGURA,
} from '../apresentacao/slides.js';

const RECURSOS = { logo: 'img/logo-horizontal-branca.png', olho: 'img/olho-branco.png' };
const FONTES = [
  { familia: 'Anton', peso: 400, arquivo: 'fonts/anton-latin-400-normal.woff2' },
  { familia: 'Atkinson', peso: 400, arquivo: 'fonts/atkinson-hyperlegible-latin-400-normal.woff2' },
  { familia: 'Atkinson', peso: 700, arquivo: 'fonts/atkinson-hyperlegible-latin-700-normal.woff2' },
];
const MODELO = 'modelos/modelo-apresentacao-look.docx';

// Fica guardada enquanto a página estiver aberta, para não perder ao trocar de tela.
let atual = null; // { nome, apresentacao, escalas }

const CSS_TELA = `
.lk-largada{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:44px 20px;border:1.5px dashed var(--linha-forte);border-radius:var(--raio);cursor:pointer;text-align:center;transition:border-color .15s,background .15s}
.lk-largada:hover,.lk-largada.lk-sobre-largada{border-color:var(--latao);background:var(--painel-2)}
.lk-largada b{font-family:var(--titulo);font-weight:400;font-size:22px;text-transform:uppercase;letter-spacing:.02em}
.lk-largada input{display:none}
.lk-barra{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:22px 0 14px}
.lk-barra .espaco{flex:1}
.lk-grade{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px}
.lk-mini{position:relative}
.lk-mini .lk-quadro{position:relative;aspect-ratio:16/9;overflow:hidden;border-radius:8px;border:1px solid var(--linha);cursor:pointer;background:#0A0A0C}
.lk-mini .lk-quadro:hover{border-color:var(--latao)}
.lk-mini .lk-slide{position:absolute;left:0;top:0;transform-origin:0 0;transform:scale(var(--m,.18))}
.lk-mini .lk-num{font-size:12px;color:var(--texto-3);margin-top:6px;display:flex;justify-content:space-between;gap:8px}
.lk-mini .lk-num .reduzido{color:var(--latao)}
.lk-guia table{width:100%;border-collapse:collapse;margin-top:10px}
.lk-guia td{padding:8px 10px;border-bottom:1px solid var(--linha);vertical-align:top}
.lk-guia td:first-child{white-space:nowrap;font-weight:700;width:1%}
.lk-guia summary{cursor:pointer;font-family:var(--titulo);text-transform:uppercase;font-size:18px}
.lk-fechar{position:absolute;top:16px;right:16px;z-index:2;background:rgba(10,10,12,.7);border:1px solid rgba(245,243,238,.25);color:#F5F3EE;border-radius:8px;padding:8px 14px;cursor:pointer;font:14px var(--corpo);opacity:.35}
.lk-fechar:hover{opacity:1}
#lk-impressao{display:none}
@media print{
  @page{size:1920px 1080px;margin:0}
  body.lk-imprimindo{background:#0A0A0C}
  body.lk-imprimindo > :not(#lk-impressao){display:none!important}
  body.lk-imprimindo #lk-impressao{display:block}
  #lk-impressao .lk-slide{break-after:page;page-break-after:always}
}`;

function prepararEstilo() {
  if (document.getElementById('lk-estilo')) return;
  const el = document.createElement('style');
  el.id = 'lk-estilo';
  el.textContent = CSS_SLIDES + CSS_PALCO + CSS_TELA;
  document.head.append(el);
}

const comEscala = (html, e) => html.replace('<section class="lk-slide', `<section style="--e:${e ?? 1}" class="lk-slide`);
const slidesHtml = () => atual.apresentacao.slides.map((s, k) => comEscala(desenharSlide(s, RECURSOS), atual.escalas[k])).join('');

const GUIA = [
  ['Primeira página', 'Vira a capa. O <b>Título 1</b> é o título grande; uma linha curta em MAIÚSCULAS no topo (ex.: PROPOSTA COMERCIAL) vira a etiqueta; pares como <b>APRESENTADA A</b> + nome na linha de baixo, ou <b>DATA</b> + dia, vão para o rodapé da capa; o primeiro texto normal vira a frase da capa e os seguintes viram slides de frase.'],
  ['Título 2', 'Cada um abre um slide novo, com esse texto como título.'],
  ['Texto normal', 'Texto do slide. Um texto curto sozinho aparece grande, como destaque. Negrito e itálico são mantidos.'],
  ['Lista', 'Tópicos com o marcador da LOOK. Lista comprida fica em duas colunas. "Nome: texto" deixa o nome em negrito.'],
  ['Título 3', 'Subtítulo dentro do slide. Dois a quatro Títulos 3 no mesmo slide ficam lado a lado, em colunas.'],
  ['Tabela pequena', 'Até 3 linhas vira cartões, um por coluna: 1ª linha etiqueta, 2ª o número ou palavra em destaque, 3ª a explicação (ex.: Investimento).'],
  ['Tabela grande', '4 linhas ou mais vira tabela, com a 1ª linha de cabeçalho.'],
  ['Etapas', 'Texto no formato <b>01 | Nome — descrição</b> vira etapas lado a lado (ex.: Implantação).'],
  ['Imagem', 'Imagem colada no Word fica ao lado do texto; sozinha, ocupa o slide. Na capa, vira o fundo.'],
  ['Título 3 "Aceite da proposta"', 'Vira o slide de aceite: cada "Nome:" vira uma linha para assinar e "Data:" vira __/__/____.'],
  ['Título 1 no meio', 'Depois da capa, um Título 1 vira slide de abertura de parte (Parte 01, 02…).'],
  ['Linhas especiais', '<b>Etiqueta:</b> texto pequeno dourado acima do título · <b>Rodapé:</b> nota no pé do slide · <b>Notas:</b> o que falar (só aparece apertando N ao apresentar) · <b>Layout:</b> cartões, tabela, destaque, etapas, colunas ou imagem, para forçar um formato.'],
  ['Final', 'O slide "Obrigado" com os contatos da LOOK entra sozinho.'],
];

export async function render(el) {
  prepararEstilo();
  el.innerHTML = `
    <div class="cabecalho"><div><div class="sobre">Criação</div><h1>Apresentações</h1></div>
      <a class="botao" href="${MODELO}" download>Baixar modelo de Word</a></div>
    <label class="lk-largada" id="lk-largada">
      <input type="file" id="lk-arquivo" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document">
      <b>Arraste o Word aqui</b>
      <span class="mudo">ou clique para escolher o arquivo (.docx). Ele não sai do seu computador: a apresentação é montada aqui mesmo no navegador.</span>
    </label>
    <div id="lk-erro" style="margin-top:10px;color:var(--perigo)"></div>
    <div id="lk-resultado"></div>
    <details class="painel lk-guia" style="margin-top:22px" ${atual ? '' : 'open'}>
      <summary>Como escrever o Word</summary>
      <p class="mudo" style="margin:10px 0 0">Use os estilos do Word (Página Inicial &gt; Estilos). Linhas em branco são ignoradas, então pode espaçar o texto à vontade. Google Docs também serve: Arquivo &gt; Fazer download &gt; Microsoft Word (.docx).</p>
      <table>${GUIA.map(([a, b]) => `<tr><td>${a}</td><td class="mudo">${b}</td></tr>`).join('')}</table>
    </details>`;

  const largada = $('#lk-largada');
  const entrada = $('#lk-arquivo');
  entrada.onchange = () => entrada.files[0] && abrir(entrada.files[0]);
  largada.ondragover = (e) => { e.preventDefault(); largada.classList.add('lk-sobre-largada'); };
  largada.ondragleave = () => largada.classList.remove('lk-sobre-largada');
  largada.ondrop = (e) => {
    e.preventDefault();
    largada.classList.remove('lk-sobre-largada');
    const arquivo = e.dataTransfer.files[0];
    if (arquivo) abrir(arquivo);
  };
  if (atual) await mostrar();
}

async function abrir(arquivo) {
  const erro = $('#lk-erro');
  erro.textContent = '';
  if (!/\.docx$/i.test(arquivo.name)) {
    erro.textContent = arquivo.name.match(/\.doc$/i)
      ? 'Esse é o formato antigo do Word (.doc). Abra no Word e use Salvar como > Documento do Word (.docx).'
      : 'Escolha um arquivo do Word (.docx).';
    return;
  }
  $('#lk-resultado').innerHTML = '<div class="painel mudo" style="margin-top:22px">Montando a apresentação…</div>';
  try {
    const blocos = await lerDocx(arquivo);
    const apresentacao = montarApresentacao(blocos);
    if (apresentacao.slides.length <= 1) throw new Error('Não encontramos conteúdo no Word. Confira se os títulos dos slides estão com o estilo "Título 2".');
    atual = { nome: arquivo.name, apresentacao, escalas: [] };
    await mostrar();
  } catch (err) {
    $('#lk-resultado').innerHTML = '';
    erro.textContent = err.message || 'Não foi possível ler esse Word.';
  }
}

async function mostrar() {
  const caixa = $('#lk-resultado');
  if (!caixa) return;
  const { apresentacao } = atual;
  await Promise.all(['400 40px Anton', '400 20px Atkinson', '700 20px Atkinson'].map((f) => document.fonts.load(f).catch(() => {})));
  caixa.innerHTML = `
    <div class="lk-barra">
      <div><h2>${esc(apresentacao.titulo)}</h2><div class="fraco">${apresentacao.slides.length} slides · ${esc(atual.nome)}</div></div>
      <span class="espaco"></span>
      <button class="botao primario" id="lk-apresentar">Apresentar</button>
      <button class="botao" id="lk-pdf">Salvar PDF</button>
      <button class="botao" id="lk-baixar">Baixar apresentação (.html)</button>
    </div>
    <div class="lk-grade" id="lk-grade">${apresentacao.slides.map((s, k) => `
      <div class="lk-mini"><div class="lk-quadro" data-k="${k}">${desenharSlide(s, RECURSOS)}</div><div class="lk-num"><span>${k + 1}</span><span class="reduzido" data-reduzido="${k}"></span></div></div>`).join('')}
    </div>`;
  const grade = $('#lk-grade');
  const escalar = () => {
    const quadro = grade.querySelector('.lk-quadro');
    if (quadro) grade.style.setProperty('--m', quadro.clientWidth / LARGURA);
  };
  escalar();
  new ResizeObserver(escalar).observe(grade);
  await esperarImagens(grade);
  atual.escalas = ajustarTamanhos([...grade.querySelectorAll('.lk-slide')]);
  atual.escalas.forEach((e, k) => {
    if (e < 0.9) grade.querySelector(`[data-reduzido="${k}"]`).textContent = `texto reduzido para ${Math.round(e * 100)}% para caber`;
  });

  grade.onclick = (e) => { const q = e.target.closest('.lk-quadro'); if (q) apresentar(Number(q.dataset.k)); };
  $('#lk-apresentar').onclick = () => apresentar(0);
  $('#lk-pdf').onclick = imprimir;
  $('#lk-baixar').onclick = baixar;
}

function esperarImagens(raiz) {
  return Promise.all([...raiz.querySelectorAll('img')].map((img) => (img.complete ? null : new Promise((ok) => { img.onload = ok; img.onerror = ok; }))));
}

function apresentar(inicio) {
  const palco = document.createElement('div');
  palco.className = 'lk-palco';
  palco.innerHTML = `${slidesHtml()}<button class="lk-fechar" type="button">Fechar (Esc)</button>`;
  document.body.append(palco);
  let parar = () => {};
  const sair = () => { parar(); palco.remove(); };
  palco.querySelector('.lk-fechar').onclick = sair;
  palco.requestFullscreen?.().catch(() => {});
  parar = apresentador(palco, sair, inicio);
}

async function imprimir() {
  const folha = document.createElement('div');
  folha.id = 'lk-impressao';
  folha.innerHTML = slidesHtml();
  document.body.append(folha);
  document.body.classList.add('lk-imprimindo');
  await esperarImagens(folha);
  const limpar = () => { document.body.classList.remove('lk-imprimindo'); folha.remove(); removeEventListener('afterprint', limpar); };
  addEventListener('afterprint', limpar);
  avisar('Na janela de impressão, escolha "Salvar como PDF"');
  window.print();
}

async function paraDataUrl(caminho) {
  const blob = await (await fetch(caminho)).blob();
  return new Promise((ok, falhar) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = falhar; r.readAsDataURL(blob); });
}

async function baixar() {
  const botao = $('#lk-baixar');
  botao.disabled = true;
  try {
    const [logo, olho, ...fontes] = await Promise.all([RECURSOS.logo, RECURSOS.olho, ...FONTES.map((f) => f.arquivo)].map(paraDataUrl));
    const conteudo = gerarArquivo(atual.apresentacao, { logo, olho }, atual.escalas,
      FONTES.map((f, k) => ({ familia: f.familia, peso: f.peso, url: fontes[k] })));
    const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/html' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${nomeDoArquivo(atual.apresentacao.titulo)}.html`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    avisar('Apresentação baixada');
  } catch (err) {
    avisar('Não foi possível baixar: tente de novo');
    console.error(err);
  } finally { botao.disabled = false; }
}
