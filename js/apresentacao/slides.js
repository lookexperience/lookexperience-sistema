// Transforma os blocos lidos do Word em slides no padrão LOOK.
//
// Regras do modelo (as mesmas do "modelo-apresentacao-look.docx", que segue o
// formato da proposta comercial da LOOK):
//   Primeira página (antes do primeiro Título 2) → capa
//     Título 1 (ou estilo "Título")        → título da capa
//     Linha curta em MAIÚSCULAS no topo     → etiqueta da capa (ex.: PROPOSTA COMERCIAL)
//     MAIÚSCULAS + linha de baixo            → par de informação (APRESENTADA A / nome, DATA / dia)
//     Primeiro texto normal                  → frase da capa; os seguintes viram slides de frase
//   Título 2  → slide de conteúdo
//   Título 3  → subtítulo dentro do slide (2 a 4 deles lado a lado viram colunas)
//   Texto, listas, tabelas e imagens → conteúdo do slide
//   Tabela de até 3 linhas → cartões (uma coluna por cartão); maior → tabela
//   "01 | Nome — descrição" → etapas lado a lado
//   Título 3 "Aceite da proposta" → slide de aceite com linhas para assinar
//   Título 1 depois da capa → slide de abertura de parte (divisória)
//   "Etiqueta:", "Rodapé:", "Notas:", "Layout:" → ajustes de cada slide
// No fim entra sozinho o slide de "Obrigado" com os contatos da LOOK.

import { esc } from '../util.js';

export const LARGURA = 1920;
export const ALTURA = 1080;

const CONTATOS = 'lookexperience.com.br · @look.experience · (14) 99733-2120';
const ASSINATURA = 'Entenda. Escolha. Expanda.';

// ---------- Texto ----------
const texto = (pedacos) => (pedacos ?? []).map((p) => p.t).join('');
const semAcento = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

function html(pedacos) {
  return (pedacos ?? []).map((p) => {
    let h = esc(p.t).replace(/\n/g, '<br>');
    if (p.b) h = `<strong>${h}</strong>`;
    if (p.i) h = `<em>${h}</em>`;
    return h;
  }).join('').trim();
}

// Tira os primeiros n caracteres (o "Etiqueta:" etc.), mantendo negrito e itálico do resto.
function cortarInicio(pedacos, n) {
  const saida = [];
  let falta = n;
  for (const p of pedacos) {
    if (falta >= p.t.length) { falta -= p.t.length; continue; }
    saida.push({ ...p, t: p.t.slice(falta) });
    falta = 0;
  }
  if (saida[0]) saida[0].t = saida[0].t.replace(/^\s+/, '');
  return saida;
}

const MARCAS = { etiqueta: 'etiqueta', rodape: 'rodape', nota: 'notas', notas: 'notas', layout: 'layout', formato: 'layout', cliente: 'cliente', data: 'data' };
function marca(pedacos, aceitas) {
  const m = texto(pedacos).match(/^\s*([A-Za-zÀ-ú]+)\s*:\s*/);
  if (!m) return null;
  const chave = MARCAS[semAcento(m[1])];
  return chave && aceitas.includes(chave) ? { chave, resto: cortarInicio(pedacos, m[0].length) } : null;
}

// Tira espaços, quebras e colchetes de rascunho ("[Nome]") das pontas.
function limpar(pedacos) {
  const p = (pedacos ?? []).map((x) => ({ ...x }));
  while (p.length && !p[0].t.replace(/^[\s[\]]+/, '')) p.shift();
  while (p.length && !p[p.length - 1].t.replace(/[\s[\]]+$/, '')) p.pop();
  if (p.length) { p[0].t = p[0].t.replace(/^[\s[]+/, ''); p[p.length - 1].t = p[p.length - 1].t.replace(/[\s\]]+$/, ''); }
  return p;
}
const temLetra = (pedacos) => /[\p{L}\d]/u.test(texto(pedacos));
const ehRotulo = (pedacos) => { const t = texto(pedacos).trim(); return t.length <= 40 && /\p{L}/u.test(t) && t === t.toLocaleUpperCase('pt-BR'); };

const LAYOUTS = { cartoes: 'cartoes', cartao: 'cartoes', cards: 'cartoes', tabela: 'tabela', destaque: 'destaque', frase: 'destaque', imagem: 'imagem', foto: 'imagem', texto: 'texto', colunas: 'colunas', etapas: 'etapas', passos: 'etapas' };

// ---------- Montagem ----------
function montarCapa(itens) {
  const capa = { tipo: 'capa', titulo: [], subtitulo: null, etiqueta: null, pares: [], imagem: null, notas: '' };
  const frases = [];
  const temEstiloTitulo = itens.some((b) => b.estilo === 'titulo');
  for (let k = 0; k < itens.length; k++) {
    const b = itens[k];
    if (b.tipo === 'imagem') { capa.imagem ??= b.src; continue; }
    const p = limpar(b.pedacos);
    if (!temLetra(p)) continue;
    if (b.estilo === 'titulo' || (!temEstiloTitulo && b.estilo === 'h1' && !capa.titulo.length)) { capa.titulo.push(p); continue; }
    const m = marca(p, ['etiqueta', 'cliente', 'data', 'notas']);
    if (m?.chave === 'etiqueta') { capa.etiqueta = m.resto; continue; }
    if (m?.chave === 'notas') { capa.notas = texto(m.resto); continue; }
    if (m) { capa.pares.push({ rotulo: m.chave === 'data' ? 'Data' : 'Cliente', valor: m.resto }); continue; }
    if (ehRotulo(p)) {
      // Rótulo em maiúsculas: junta com a próxima linha com texto ("DATA" + "04 de novembro").
      let j = k + 1;
      while (j < itens.length && (itens[j].tipo !== 'paragrafo' || !temLetra(limpar(itens[j].pedacos)))) j++;
      const prox = itens[j];
      if (prox && prox.estilo !== 'titulo' && prox.estilo !== 'h1' && !ehRotulo(limpar(prox.pedacos))
        && (capa.titulo.length || capa.etiqueta)) {
        capa.pares.push({ rotulo: p, valor: limpar(prox.pedacos) });
        k = j;
      } else if (!capa.etiqueta) capa.etiqueta = p;
      continue;
    }
    if (!capa.subtitulo) capa.subtitulo = p;
    else frases.push({ tipo: 'conteudo', titulo: null, etiqueta: null, rodape: null, notas: '', layout: 'destaque', itens: [{ tipo: 'texto', pedacos: p }] });
  }
  if (!capa.titulo.length && capa.subtitulo) { capa.titulo.push(capa.subtitulo); capa.subtitulo = null; }
  return [capa, frases];
}

const novoSlide = (tipo, titulo) => ({ tipo, titulo, etiqueta: null, rodape: null, notas: '', layout: null, itens: [] });

export function montarApresentacao(blocos) {
  // A capa vai até o primeiro Título 2 (ou até um Título 1 quando a capa usa o estilo "Título").
  const usaEstiloTitulo = blocos.some((b) => b.estilo === 'titulo');
  let fimCapa = blocos.findIndex((b, k) => b.estilo === 'h2'
    || (b.estilo === 'h1' && (usaEstiloTitulo || blocos.slice(0, k).some((x) => x.estilo === 'h1'))));
  if (fimCapa < 0) fimCapa = blocos.length;
  const [capa, frases] = montarCapa(blocos.slice(0, fimCapa));

  const slides = [];
  let atual = null;
  for (const b of blocos.slice(fimCapa)) {
    if (b.tipo === 'paragrafo' && (b.estilo === 'h1' || b.estilo === 'h2')) {
      atual = novoSlide(b.estilo === 'h1' ? 'secao' : 'conteudo', limpar(b.pedacos));
      slides.push(atual);
      continue;
    }
    if (b.tipo === 'paragrafo' && b.estilo === 'h3' && /^aceite/.test(semAcento(texto(b.pedacos)))) {
      atual = novoSlide('aceite', limpar(b.pedacos));
      slides.push(atual);
      continue;
    }
    if (!atual) continue;
    const m = b.tipo === 'paragrafo' && b.estilo !== 'lista' ? marca(b.pedacos, ['etiqueta', 'rodape', 'notas', 'layout']) : null;
    if (m?.chave === 'etiqueta') { atual.etiqueta = m.resto; continue; }
    if (m?.chave === 'rodape') { atual.rodape = m.resto; continue; }
    if (m?.chave === 'notas') { atual.notas = [atual.notas, texto(m.resto)].filter(Boolean).join('\n'); continue; }
    if (m?.chave === 'layout') { atual.layout = LAYOUTS[semAcento(texto(m.resto)).replace(/[^a-z]/g, '')] ?? null; continue; }
    if (b.tipo === 'paragrafo') {
      const p = limpar(b.pedacos);
      if (!temLetra(p)) continue;
      if (b.estilo === 'lista') {
        const ultimo = atual.itens[atual.itens.length - 1];
        if (ultimo?.tipo === 'lista') ultimo.itens.push(p);
        else atual.itens.push({ tipo: 'lista', itens: [p] });
      } else atual.itens.push({ tipo: b.estilo === 'h3' ? 'sub' : 'texto', pedacos: p });
    } else if (b.tipo === 'tabela') {
      atual.itens.push({ tipo: 'tabela', linhas: b.linhas.map((l) => l.map((c) => c.map(limpar).filter(temLetra))) });
    } else atual.itens.push(b);
  }

  // Slide final: o "Obrigado" da LOOK. Se o Word já termina com um, ele é usado.
  const ultimo = slides[slides.length - 1];
  const fim = { tipo: 'fim', titulo: [{ t: 'Obrigado' }], itens: [], notas: '' };
  if (ultimo && /^obrigad[oa]s?!?$/.test(semAcento(texto(ultimo.titulo)))) {
    Object.assign(fim, { titulo: ultimo.titulo, itens: ultimo.itens.filter((i) => i.tipo === 'texto'), notas: ultimo.notas });
    slides.pop();
  }
  const lista = [];
  if (capa.titulo.length) lista.push(capa);
  lista.push(...frases, ...slides.filter((s) => s.itens.length || s.tipo !== 'conteudo' || s.titulo?.length), fim);

  let parte = 0;
  for (const s of lista) if (s.tipo === 'secao') s.parte = ++parte;

  return { titulo: capa.titulo.length ? capa.titulo.map(texto).join(' ') : texto(slides[0]?.titulo) || 'Apresentação', slides: lista };
}

// ---------- Desenho ----------
// recursos = { logo, olho }: endereço das imagens da marca (arquivo ou embutidas).
function notas(s) { return s.notas ? `<aside class="lk-notas">${esc(s.notas)}</aside>` : ''; }
function fundo(src) { return src ? `<img class="lk-fundo" src="${esc(src)}" alt=""><div class="lk-veu"></div>` : ''; }

function capaHtml(s, r) {
  const pares = s.pares.map((p) => `<div class="lk-par"><p class="lk-rotulo">${html(p.rotulo)}</p><p class="lk-valor">${html(p.valor)}</p></div>`).join('');
  return `<section class="lk-slide lk-capa">${fundo(s.imagem)}
    <p class="lk-etiqueta">${html(s.etiqueta) || '&nbsp;'}</p>
    <div class="lk-meio">
      <h1 class="lk-titulo">${s.titulo.map(html).join('<br>')}</h1>
      ${s.subtitulo ? `<p class="lk-sub">${html(s.subtitulo)}</p>` : ''}
    </div>
    <div class="lk-base"><div class="lk-pares">${pares}</div><img class="lk-logo" src="${esc(r.logo)}" alt="LOOK Direção de Marca &amp; Conteúdo"></div>
    ${notas(s)}</section>`;
}

function secaoHtml(s) {
  const img = s.itens.find((i) => i.tipo === 'imagem');
  const textos = s.itens.filter((i) => i.tipo === 'texto' || i.tipo === 'sub');
  return `<section class="lk-slide lk-secao">${fundo(img?.src)}
    <p class="lk-etiqueta">${html(s.etiqueta) || `Parte ${String(s.parte).padStart(2, '0')}`}</p>
    <h2 class="lk-titulo">${html(s.titulo)}</h2>
    ${textos.map((t) => `<p class="lk-sub">${html(t.pedacos)}</p>`).join('')}
    ${notas(s)}</section>`;
}

function fimHtml(s, r) {
  return `<section class="lk-slide lk-fim">
    <h2 class="lk-titulo">${html(s.titulo)}</h2>
    ${s.itens.map((t) => `<p class="lk-sub">${html(t.pedacos)}</p>`).join('')}
    <img class="lk-logo" src="${esc(r.logo)}" alt="LOOK Direção de Marca &amp; Conteúdo">
    <p class="lk-contatos">${esc(CONTATOS)}</p>
    <p class="lk-etiqueta">${esc(ASSINATURA)}</p>
    ${notas(s)}</section>`;
}

// Aceite: cada "Nome:" do Word vira uma linha para assinar ("Data:" vira __/__/____).
function aceiteHtml(s, r) {
  const campos = [];
  const avisos = [];
  for (const i of s.itens) {
    if (i.tipo !== 'texto') continue;
    const t = texto(i.pedacos);
    const nomes = [...t.matchAll(/([\p{L}][\p{L} ]{1,40}?)\s*:/gu)].map((m) => m[1].trim());
    const sobra = t.replace(/[\p{L}][\p{L} ]{1,40}?\s*:/gu, '').replace(/[\s/_.\-]/g, '');
    if (nomes.length && !sobra) campos.push(...nomes);
    else avisos.push(i);
  }
  const campo = (n) => `<div class="lk-campo${/^data$/i.test(n) ? ' lk-campo-data' : ''}"><p class="lk-rotulo">${esc(n)}</p><div class="lk-linha">${/^data$/i.test(n) ? '<span>/</span><span>/</span>' : ''}</div></div>`;
  return `<section class="lk-slide lk-conteudo lk-aceite">
    <header class="lk-cabeca"><h2 class="lk-titulo">${html(s.titulo)}</h2></header>
    <div class="lk-corpo"><div class="lk-campos">${campos.map(campo).join('')}</div></div>
    ${avisos.length ? `<p class="lk-rodape">${avisos.map((a) => html(a.pedacos)).join(' ')}</p>` : ''}
    <img class="lk-olho" src="${esc(r.olho)}" alt="">${notas(s)}</section>`;
}

const celula = (c) => (c ?? []).map(html).join('<br>');

// Tabela pequena: cada coluna vira um cartão (1ª linha etiqueta, 2ª destaque, 3ª explicação).
function cartoesHtml(tabela) {
  const linhas = tabela.linhas;
  const n = Math.max(...linhas.map((l) => l.length));
  const colunas = n <= 4 ? n : n <= 6 ? 3 : 4;
  const tamanho = colunas >= 4 ? 'p' : colunas === 3 ? 'm' : 'g';
  const so = linhas.length === 1;
  const cartoes = Array.from({ length: n }, (_, j) => {
    const [a, b, c] = linhas.map((l) => l[j]);
    const [rotulo, grande, desc] = so ? [null, a, null] : [a, b, c];
    return `<div class="lk-cartao">
      ${rotulo?.length ? `<p class="lk-rotulo">${celula(rotulo)}</p>` : ''}
      ${grande?.length ? `<p class="lk-grande">${celula(grande)}</p>` : ''}
      ${desc?.length ? `<p class="lk-desc">${celula(desc)}</p>` : ''}
    </div>`;
  });
  return `<div class="lk-cartoes lk-${tamanho}" style="grid-template-columns:repeat(${colunas},1fr)">${cartoes.join('')}</div>`;
}

function tabelaHtml(tabela) {
  const [cab, ...resto] = tabela.linhas;
  return `<table class="lk-tabela"><thead><tr>${cab.map((c) => `<th>${celula(c)}</th>`).join('')}</tr></thead>
    <tbody>${resto.map((l) => `<tr>${cab.map((_, i) => `<td>${celula(l[i])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

// Item de lista que começa com "Nome: ..." ganha o nome em negrito.
function itemLista(p) {
  const t = texto(p);
  const m = t.match(/^([^:\n]{2,32}):\s/);
  if (!m || p.some((x) => x.b)) return html(p);
  return `<strong>${esc(m[1])}:</strong> ${html(cortarInicio(p, m[0].length))}`;
}

function itemHtml(item, layout) {
  if (item.tipo === 'texto') return `<p class="lk-texto">${html(item.pedacos)}</p>`;
  if (item.tipo === 'sub') return `<h3 class="lk-titulo lk-h3">${html(item.pedacos)}</h3>`;
  if (item.tipo === 'lista') {
    const longa = item.itens.length >= 4 && item.itens.reduce((n, p) => n + texto(p).length, 0) > 420;
    return `<ul class="lk-lista${longa ? ' lk-lista-2' : ''}">${item.itens.map((p) => `<li>${itemLista(p)}</li>`).join('')}</ul>`;
  }
  if (item.tipo === 'tabela') {
    const comoCartao = layout === 'cartoes' || (layout !== 'tabela' && item.linhas.length <= 3);
    return comoCartao ? cartoesHtml(item) : tabelaHtml(item);
  }
  return '';
}

// "01 | Planejamento — Definição de nome..." (vários no mesmo parágrafo ou um por linha).
function etapasDe(itens) {
  if (!itens.length || itens.some((i) => i.tipo !== 'texto')) return null;
  const tudo = itens.map((i) => texto(i.pedacos)).join(' ');
  const etapas = [...tudo.matchAll(/(\d{1,2})\s*[|.)]\s*([^—–|]+?)\s+[—–-]\s+(.+?)(?=\s+\d{1,2}\s*[|.)]\s|$)/gs)]
    .map((m) => ({ numero: m[1], nome: m[2].trim(), desc: m[3].trim() }));
  return etapas.length >= 2 && etapas.length <= 8 ? etapas : null;
}

function etapasHtml(etapas) {
  const colunas = etapas.length <= 5 ? etapas.length : Math.ceil(etapas.length / 2);
  return `<div class="lk-etapas" style="grid-template-columns:repeat(${colunas},1fr)">${etapas.map((e) => `
    <div class="lk-etapa"><p class="lk-numero">${esc(e.numero.padStart(2, '0'))}</p><p class="lk-titulo lk-nome">${esc(e.nome)}</p><p class="lk-desc">${esc(e.desc)}</p></div>`).join('')}</div>`;
}

// Vários Título 3 no mesmo slide: um ao lado do outro, cada um com seu texto.
function colunasDe(itens) {
  const subs = itens.filter((i) => i.tipo === 'sub').length;
  if (subs < 2 || subs > 4 || itens[0].tipo !== 'sub' || itens.some((i) => i.tipo === 'tabela')) return null;
  const grupos = [];
  for (const i of itens) { if (i.tipo === 'sub') grupos.push([i]); else grupos[grupos.length - 1].push(i); }
  return grupos;
}

function conteudoHtml(s, r) {
  const imagens = s.itens.filter((i) => i.tipo === 'imagem');
  const outros = s.itens.filter((i) => i.tipo !== 'imagem');
  const so = outros.length === 1 && outros[0].tipo === 'texto' ? outros[0] : null;
  let layout = s.layout;
  const etapas = (!layout || layout === 'etapas') && !imagens.length ? etapasDe(outros) : null;
  const grupos = (!layout || layout === 'colunas') && !imagens.length ? colunasDe(outros) : null;
  if (!layout) layout = etapas ? 'etapas' : grupos ? 'colunas' : (!imagens.length && so && texto(so.pedacos).length <= 140) ? 'destaque' : 'texto';

  const cabeca = s.titulo?.length || s.etiqueta
    ? `<header class="lk-cabeca">${s.etiqueta ? `<p class="lk-etiqueta">${html(s.etiqueta)}</p>` : ''}${s.titulo?.length ? `<h2 class="lk-titulo">${html(s.titulo)}</h2>` : ''}</header>`
    : '';
  const rodape = `${s.rodape ? `<p class="lk-rodape">${html(s.rodape)}</p>` : ''}<img class="lk-olho" src="${esc(r.olho)}" alt="">`;

  if (layout === 'imagem' && imagens.length) {
    return `<section class="lk-slide lk-conteudo lk-cheia">${fundo(imagens[0].src)}
      <div class="lk-sobre">${cabeca}${outros.filter((i) => i.tipo === 'texto').map((i) => itemHtml(i)).join('')}</div>
      ${rodape}${notas(s)}</section>`;
  }
  let textoHtml;
  if (layout === 'destaque' && so) textoHtml = `<p class="lk-destaque">${html(so.pedacos)}</p>`;
  else if (layout === 'etapas' && etapas) textoHtml = etapasHtml(etapas);
  else if (layout === 'colunas' && grupos) {
    textoHtml = `<div class="lk-grupos" style="grid-template-columns:repeat(${grupos.length},1fr)">${grupos.map((g) => `<div class="lk-grupo">${g.map((i) => itemHtml(i, layout)).join('')}</div>`).join('')}</div>`;
  } else textoHtml = outros.map((i) => itemHtml(i, layout)).join('');
  const fotos = imagens.length
    ? `<div class="lk-fotos" style="grid-template-columns:repeat(${Math.min(imagens.length, 3)},1fr)">${imagens.slice(0, 6).map((i) => `<img src="${esc(i.src)}" alt="">`).join('')}</div>`
    : '';
  const corpo = fotos && outros.length
    ? `<div class="lk-duas"><div class="lk-coluna">${textoHtml}</div>${fotos}</div>`
    : `${textoHtml}${fotos}`;
  return `<section class="lk-slide lk-conteudo${cabeca ? '' : ' lk-sem-titulo'}">${cabeca}<div class="lk-corpo">${corpo}</div>${rodape}${notas(s)}</section>`;
}

export function desenharSlide(s, recursos) {
  if (s.tipo === 'capa') return capaHtml(s, recursos);
  if (s.tipo === 'secao') return secaoHtml(s, recursos);
  if (s.tipo === 'fim') return fimHtml(s, recursos);
  if (s.tipo === 'aceite') return aceiteHtml(s, recursos);
  return conteudoHtml(s, recursos);
}

// Ajusta o tamanho do texto de cada slide para ocupar bem o espaço:
// slide com pouco texto cresce até 125%; slide cheio diminui até 55%.
// Precisa dos slides já na página, em tamanho real (1920 × 1080).
export function ajustarTamanhos(elementos) {
  return elementos.map((el) => {
    const transborda = () => {
      if (el.scrollHeight > ALTURA + 2) return true;
      return [...el.querySelectorAll('.lk-corpo, .lk-cartao, .lk-etapa, .lk-coluna, .lk-meio, .lk-sobre, .lk-grupo')]
        .some((c) => c.scrollHeight > c.clientHeight + 2 || c.scrollWidth > c.clientWidth + 2);
    };
    let e = el.classList.contains('lk-conteudo') && !el.classList.contains('lk-aceite') ? 1.25 : 1;
    el.style.setProperty('--e', e);
    while (transborda() && e > 0.56) { e = Math.round((e - 0.05) * 100) / 100; el.style.setProperty('--e', e); }
    return e;
  });
}

// ---------- Visual (mesmo padrão dos decks recentes da LOOK) ----------
export const CSS_SLIDES = `
.lk-slide{--e:1;position:relative;width:1920px;height:1080px;overflow:hidden;background:#0A0A0C;color:#F5F3EE;font-family:'Atkinson','Atkinson Hyperlegible',Arial,sans-serif;display:flex;flex-direction:column;box-sizing:border-box;text-align:left;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.lk-slide *{box-sizing:border-box;margin:0;padding:0}
.lk-slide strong{color:#F5F3EE;font-weight:700}
.lk-titulo{font-family:'Anton',Impact,sans-serif;font-weight:400;text-transform:uppercase;line-height:1.05;letter-spacing:0;color:#F5F3EE}
.lk-etiqueta{font-size:24px;letter-spacing:6px;text-transform:uppercase;color:#B8955A;font-weight:700;line-height:1.3;position:relative}
.lk-notas{display:none}
.lk-fundo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.lk-veu{position:absolute;inset:0;background:linear-gradient(90deg,rgba(10,10,12,.94) 0%,rgba(10,10,12,.78) 45%,rgba(10,10,12,.35) 100%)}
.lk-capa,.lk-secao,.lk-fim{padding:128px}
.lk-capa{justify-content:space-between}
.lk-capa .lk-meio{position:relative;display:flex;flex-direction:column;gap:32px;min-height:0}
.lk-capa h1{font-size:calc(180px*var(--e));line-height:1;max-width:1664px}
.lk-sub{position:relative;font-size:calc(40px*max(var(--e),.8));color:#C9C5BC;line-height:1.35;max-width:1500px}
.lk-capa .lk-base{position:relative;display:flex;justify-content:space-between;align-items:flex-end}
.lk-capa .lk-base{gap:64px}
.lk-pares{display:flex;gap:72px;flex-wrap:wrap}
.lk-par{display:flex;flex-direction:column;gap:10px;max-width:560px}
.lk-valor{font-size:30px;color:#F5F3EE;line-height:1.3}
.lk-capa .lk-logo{width:400px;height:auto}
.lk-secao{justify-content:center;gap:40px}
.lk-secao h2{position:relative;font-size:calc(150px*var(--e));max-width:1600px}
.lk-secao .lk-etiqueta{font-size:28px;letter-spacing:8px}
.lk-fim{align-items:center;justify-content:center;gap:44px;text-align:center}
.lk-fim h2{font-size:calc(160px*var(--e));line-height:1}
.lk-fim .lk-sub{text-align:center}
.lk-fim .lk-logo{width:520px;height:auto}
.lk-contatos{font-size:28px;color:#C9C5BC}
.lk-conteudo{padding:120px 128px 150px;gap:calc(48px*var(--e))}
.lk-cabeca{display:flex;flex-direction:column;gap:12px;flex:none;position:relative}
.lk-cabeca h2{font-size:calc(96px*clamp(.75,var(--e),1));max-width:1664px}
.lk-corpo{flex:1;min-height:0;display:flex;flex-direction:column;gap:calc(32px*var(--e));overflow:hidden}
.lk-texto{font-size:calc(36px*var(--e));line-height:1.42;color:#C9C5BC;max-width:1500px}
.lk-h3{font-size:calc(52px*var(--e));margin-top:calc(8px*var(--e))}
.lk-destaque{font-size:calc(68px*var(--e));line-height:1.22;color:#F5F3EE;max-width:1560px;margin:auto 0;padding-bottom:40px}
.lk-lista{list-style:none;display:flex;flex-direction:column;gap:calc(22px*var(--e));max-width:1500px}
.lk-lista li{position:relative;padding-left:calc(52px*var(--e));font-size:calc(36px*var(--e));line-height:1.38;color:#C9C5BC}
.lk-lista li::before{content:'';position:absolute;left:0;top:calc(.62em - 7px);width:14px;height:14px;background:#B8955A}
.lk-cartoes{flex:1 1 auto;min-height:0;display:grid;grid-auto-rows:1fr;gap:calc(32px*var(--e))}
.lk-cartao{background:#17171B;border-radius:16px;padding:calc(40px*var(--e));display:flex;flex-direction:column;justify-content:center;gap:calc(12px*var(--e));overflow:hidden;min-height:0}
.lk-rotulo{font-size:24px;letter-spacing:4px;text-transform:uppercase;color:#B8955A;font-weight:700}
.lk-grande{font-family:'Anton',Impact,sans-serif;line-height:1;color:#F5F3EE}
.lk-g .lk-grande{font-size:calc(110px*var(--e))}
.lk-m .lk-grande{font-size:calc(88px*var(--e))}
.lk-p .lk-grande{font-size:calc(68px*var(--e))}
.lk-desc{font-size:calc(28px*var(--e));color:#C9C5BC;line-height:1.4}
.lk-p .lk-desc{font-size:calc(26px*var(--e))}
.lk-tabela{width:100%;border-collapse:collapse}
.lk-tabela th{font-size:22px;letter-spacing:3px;text-transform:uppercase;color:#B8955A;font-weight:700;text-align:left;padding:0 24px calc(18px*var(--e)) 0;border-bottom:2px solid #3A3833;vertical-align:bottom}
.lk-tabela td{font-size:calc(30px*var(--e));color:#C9C5BC;padding:calc(22px*var(--e)) 24px calc(22px*var(--e)) 0;border-bottom:1px solid #26262B;vertical-align:top;line-height:1.35}
.lk-tabela td:first-child{color:#F5F3EE;font-weight:700}
.lk-duas{flex:1;min-height:0;display:grid;grid-template-columns:1.05fr 1fr;gap:72px}
.lk-coluna{display:flex;flex-direction:column;gap:calc(32px*var(--e));min-height:0;overflow:hidden;justify-content:center}
.lk-fotos{flex:1;min-height:0;display:grid;gap:24px;grid-auto-rows:1fr}
.lk-fotos img{width:100%;height:100%;min-height:0;object-fit:cover;border-radius:16px;display:block}
.lk-cheia{justify-content:flex-end}
.lk-sem-titulo .lk-corpo{justify-content:center}
.lk-lista-2{display:grid;grid-template-columns:1fr 1fr;column-gap:72px;max-width:none}
.lk-lista-2 li{font-size:calc(30px*var(--e))}
.lk-grupos{display:grid;gap:64px;min-height:0}
.lk-grupo{display:flex;flex-direction:column;gap:calc(24px*var(--e));border-top:2px solid #3A3833;padding-top:calc(32px*var(--e));min-height:0}
.lk-grupo .lk-h3{font-size:calc(44px*var(--e));margin:0}
.lk-grupo .lk-texto{font-size:calc(32px*var(--e))}
.lk-etapas{flex:1;min-height:0;display:grid;gap:24px;grid-auto-rows:1fr}
.lk-etapa{background:#17171B;border-radius:16px;padding:calc(36px*var(--e)) calc(32px*var(--e));display:flex;flex-direction:column;gap:calc(16px*var(--e));overflow:hidden;min-height:0;border-top:4px solid #B8955A}
.lk-numero{font-family:'Anton',Impact,sans-serif;font-size:calc(80px*var(--e));line-height:1;color:#5A5750}
.lk-nome{font-size:calc(38px*var(--e))}
.lk-etapa .lk-desc{font-size:calc(26px*var(--e))}
.lk-campos{display:grid;grid-template-columns:1.6fr 1fr;gap:96px 72px;margin-top:40px}
.lk-campo{display:flex;flex-direction:column;gap:16px}
.lk-campo:nth-child(3){grid-column:1/2}
.lk-linha{height:72px;border-bottom:2px solid #5A5750;display:flex;justify-content:space-around;align-items:flex-end;padding-bottom:8px;font-size:36px;color:#5A5750}
.lk-sobre{position:relative;display:flex;flex-direction:column;gap:32px;max-width:1200px;min-height:0;overflow:hidden}
.lk-sobre .lk-texto{color:#E4E1DA}
.lk-rodape{position:absolute;left:128px;bottom:62px;width:1500px;font-size:24px;color:#77736B;line-height:1.3}
.lk-olho{position:absolute;right:120px;bottom:52px;width:46px;height:46px;opacity:.5}
`;

// ---------- Modo apresentação ----------
// Função independente (sem nada de fora): é copiada também para dentro do
// arquivo baixado, para ele apresentar sozinho, sem o sistema.
export function apresentador(palco, aoSair, inicio = 0) {
  const slides = [...palco.querySelectorAll('.lk-slide')];
  let i = 0;
  const painel = document.createElement('div');
  painel.className = 'lk-painel-notas';
  painel.hidden = true;
  palco.append(painel);
  const escala = () => palco.style.setProperty('--s', Math.min(palco.clientWidth / 1920, palco.clientHeight / 1080));
  const mostrar = (n) => {
    i = Math.max(0, Math.min(slides.length - 1, n));
    slides.forEach((s, k) => s.classList.toggle('lk-ativo', k === i));
    const nota = slides[i].querySelector('.lk-notas');
    painel.textContent = `${i + 1} / ${slides.length}${nota ? `  ·  ${nota.textContent}` : ''}`;
  };
  const tela = () => (document.fullscreenElement ? document.exitFullscreen() : palco.requestFullscreen?.())?.catch?.(() => {});
  const teclas = (e) => {
    if (e.target.closest?.('input, textarea, select')) return;
    const k = e.key;
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(k)) mostrar(i + 1);
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) mostrar(i - 1);
    else if (k === 'Home') mostrar(0);
    else if (k === 'End') mostrar(slides.length - 1);
    else if (k === 'n' || k === 'N') painel.hidden = !painel.hidden;
    else if (k === 'f' || k === 'F') tela();
    else if (k === 'Escape' && aoSair && !document.fullscreenElement) aoSair();
    else return;
    e.preventDefault();
  };
  const clique = (e) => { if (e.target.closest('.lk-fechar')) return; mostrar(e.clientX > innerWidth / 2 ? i + 1 : i - 1); };
  let toqueX = null;
  const toque = (e) => { toqueX = e.touches[0].clientX; };
  const soltou = (e) => { if (toqueX === null) return; const d = e.changedTouches[0].clientX - toqueX; if (Math.abs(d) > 40) mostrar(d < 0 ? i + 1 : i - 1); toqueX = null; };
  addEventListener('keydown', teclas);
  addEventListener('resize', escala);
  document.addEventListener('fullscreenchange', escala);
  palco.addEventListener('click', clique);
  palco.addEventListener('touchstart', toque, { passive: true });
  palco.addEventListener('touchend', soltou);
  escala();
  mostrar(inicio);
  return () => {
    removeEventListener('keydown', teclas);
    removeEventListener('resize', escala);
    document.removeEventListener('fullscreenchange', escala);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };
}

export const CSS_PALCO = `
.lk-palco{position:fixed;inset:0;background:#000;overflow:hidden;cursor:pointer;z-index:1000;--s:.5}
.lk-palco .lk-slide{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(var(--s));display:none}
.lk-palco .lk-slide.lk-ativo{display:flex}
.lk-painel-notas{position:absolute;left:0;right:0;bottom:0;padding:16px 24px;background:rgba(10,10,12,.92);color:#F5F3EE;font:18px/1.45 'Atkinson',Arial,sans-serif;white-space:pre-wrap;max-height:40vh;overflow:auto;cursor:default}
@media print{
  @page{size:1920px 1080px;margin:0}
  html,body{margin:0;background:#0A0A0C}
  .lk-palco{position:static;overflow:visible;background:none}
  .lk-palco .lk-slide{position:relative;left:auto;top:auto;transform:none;display:flex!important;break-after:page;page-break-after:always}
  .lk-painel-notas,.lk-fechar{display:none!important}
}
`;

// ---------- Arquivo para baixar ----------
// Um .html só, com fontes e imagens dentro: abre em qualquer navegador,
// apresenta com as setas e vira PDF pelo "Imprimir > Salvar como PDF".
export function gerarArquivo(apresentacao, recursos, escalas, fontes) {
  const slides = apresentacao.slides.map((s, k) => desenharSlide(s, recursos).replace('<section class="lk-slide', `<section style="--e:${escalas[k] ?? 1}" class="lk-slide`)).join('\n');
  const faces = fontes.map((f) => `@font-face{font-family:'${f.familia}';src:url(${f.url}) format('woff2');font-weight:${f.peso};font-display:block}`).join('\n');
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(apresentacao.titulo)} · LOOK</title>
<style>${faces}
html,body{margin:0;height:100%;background:#000}
${CSS_SLIDES}${CSS_PALCO}</style></head>
<body><div class="lk-palco">
${slides}
</div>
<script>(${apresentador.toString()})(document.querySelector('.lk-palco'));</script>
</body></html>`;
}

export const nomeDoArquivo = (titulo) => (semAcento(titulo).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'apresentacao');
