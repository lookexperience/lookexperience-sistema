// Leitor de arquivos do Word (.docx), feito só com o que o navegador já tem.
// Um .docx é um arquivo .zip com textos em XML dentro. Aqui abrimos o zip,
// lemos o texto principal (word/document.xml), os nomes dos estilos
// (word/styles.xml) e as imagens (word/media), e devolvemos uma lista de
// "blocos" em ordem: parágrafos (com o estilo de cada um), tabelas e imagens.
// Nada sai do computador de quem usa: o arquivo não vai para servidor nenhum.

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const V = 'urn:schemas-microsoft-com:vml';

const LIMITE_ARQUIVO = 40 * 1024 * 1024; // 40 MB
const TIPOS_IMAGEM = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };

// ---------- Zip ----------
async function abrirZip(buffer) {
  const v = new DataView(buffer);
  let fim = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { fim = i; break; }
  }
  if (fim < 0) throw new Error('Este arquivo não parece ser um Word (.docx). Salve como "Documento do Word (.docx)" e tente de novo.');
  const total = v.getUint16(fim + 10, true);
  let pos = v.getUint32(fim + 16, true);
  const entradas = new Map();
  const nomes = new TextDecoder();
  for (let n = 0; n < total; n++) {
    if (v.getUint32(pos, true) !== 0x02014b50) break;
    const metodo = v.getUint16(pos + 10, true);
    const tamanho = v.getUint32(pos + 20, true);
    const tNome = v.getUint16(pos + 28, true);
    const tExtra = v.getUint16(pos + 30, true);
    const tComent = v.getUint16(pos + 32, true);
    const local = v.getUint32(pos + 42, true);
    const nome = nomes.decode(new Uint8Array(buffer, pos + 46, tNome));
    entradas.set(nome, { metodo, tamanho, local });
    pos += 46 + tNome + tExtra + tComent;
  }
  async function ler(nome) {
    const e = entradas.get(nome);
    if (!e) return null;
    const inicio = e.local + 30 + v.getUint16(e.local + 26, true) + v.getUint16(e.local + 28, true);
    const dados = new Uint8Array(buffer, inicio, e.tamanho);
    if (e.metodo === 0) return dados;
    if (e.metodo !== 8) throw new Error('O Word usa uma compressão que o sistema não conhece. Salve o arquivo de novo no Word.');
    const fluxo = new Blob([dados]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(fluxo).arrayBuffer());
  }
  return { ler, tem: (nome) => entradas.has(nome) };
}

const xml = (bytes) => new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'application/xml');
const filhos = (el, ns, nome) => [...el.childNodes].filter((c) => c.namespaceURI === ns && c.localName === nome);
const filho = (el, ns, nome) => filhos(el, ns, nome)[0] ?? null;
const atrW = (el, nome) => el?.getAttributeNS(W, nome) ?? el?.getAttribute(`w:${nome}`) ?? null;

function paraBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

// Nome do estilo (em inglês, como o Word guarda por dentro, mesmo em português).
function classificarEstilo(nome) {
  const n = (nome || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  if (n === 'title' || n === 'titulo') return 'titulo';
  if (n === 'subtitle' || n === 'subtitulo') return 'subtitulo';
  const m = n.match(/^(heading|titulo)\s*(\d)$/);
  if (m) return m[2] === '1' ? 'h1' : m[2] === '2' ? 'h2' : 'h3';
  if (n.startsWith('list') || n.startsWith('lista')) return 'lista';
  return 'normal';
}

// Liga um ou desliga: <w:b/> liga; <w:b w:val="0"/> desliga.
const ligado = (el) => !!el && !['0', 'false', 'off'].includes(atrW(el, 'val'));

// ---------- Leitura ----------
export async function lerDocx(arquivo) {
  if (arquivo.size > LIMITE_ARQUIVO) throw new Error('O arquivo passa de 40 MB. Diminua as imagens dentro do Word e tente de novo.');
  const zip = await abrirZip(await arquivo.arrayBuffer());
  const principal = await zip.ler('word/document.xml');
  if (!principal) throw new Error('Este arquivo não parece ser um Word (.docx). Salve como "Documento do Word (.docx)" e tente de novo.');

  const estilos = new Map();
  const xmlEstilos = await zip.ler('word/styles.xml');
  if (xmlEstilos) {
    for (const s of xml(xmlEstilos).getElementsByTagNameNS(W, 'style')) {
      estilos.set(atrW(s, 'styleId'), classificarEstilo(atrW(filho(s, W, 'name'), 'val')));
    }
  }

  const ligacoes = new Map();
  const xmlLig = await zip.ler('word/_rels/document.xml.rels');
  if (xmlLig) {
    for (const r of xml(xmlLig).getElementsByTagName('Relationship')) ligacoes.set(r.getAttribute('Id'), r.getAttribute('Target'));
  }
  const imagensLidas = new Map();
  async function imagem(id) {
    const alvo = ligacoes.get(id);
    if (!alvo || /^https?:/i.test(alvo)) return null;
    const caminho = alvo.startsWith('/') ? alvo.slice(1) : `word/${alvo.replace(/^\.\//, '')}`;
    if (imagensLidas.has(caminho)) return imagensLidas.get(caminho);
    const tipo = TIPOS_IMAGEM[caminho.split('.').pop().toLowerCase()];
    const bytes = tipo ? await zip.ler(caminho) : null;
    const url = bytes ? `data:${tipo};base64,${paraBase64(bytes)}` : null;
    imagensLidas.set(caminho, url);
    return url;
  }

  // Texto de um parágrafo, em pedaços com negrito e itálico.
  function pedacos(p) {
    const lista = [];
    const andar = (el) => {
      for (const c of el.childNodes) {
        if (c.namespaceURI !== W) continue;
        if (c.localName === 'r') {
          const rPr = filho(c, W, 'rPr');
          const b = ligado(rPr && filho(rPr, W, 'b'));
          const i = ligado(rPr && filho(rPr, W, 'i'));
          for (const t of c.childNodes) {
            if (t.namespaceURI !== W) continue;
            let texto = null;
            if (t.localName === 't') texto = t.textContent;
            else if (t.localName === 'tab') texto = ' ';
            else if (t.localName === 'br' || t.localName === 'cr') texto = '\n';
            if (texto === null) continue;
            const ultimo = lista[lista.length - 1];
            if (ultimo && ultimo.b === b && ultimo.i === i) ultimo.t += texto;
            else lista.push({ t: texto, b, i });
          }
        } else if (['hyperlink', 'ins', 'smartTag', 'fldSimple', 'customXml'].includes(c.localName)) andar(c);
        else if (c.localName === 'sdt') { const conteudo = filho(c, W, 'sdtContent'); if (conteudo) andar(conteudo); }
      }
    };
    andar(p);
    return lista;
  }

  async function imagensDe(p) {
    const ids = [...p.getElementsByTagNameNS(A, 'blip')].map((b) => b.getAttributeNS(R, 'embed'))
      .concat([...p.getElementsByTagNameNS(V, 'imagedata')].map((b) => b.getAttributeNS(R, 'id')))
      .filter(Boolean);
    const urls = [];
    for (const id of ids) { const u = await imagem(id); if (u) urls.push(u); }
    return urls;
  }

  function estiloDe(p) {
    const pPr = filho(p, W, 'pPr');
    const id = atrW(pPr && filho(pPr, W, 'pStyle'), 'val');
    let tipo = estilos.get(id) ?? classificarEstilo(id);
    if (tipo === 'normal' && pPr && filho(pPr, W, 'numPr')) tipo = 'lista';
    return tipo;
  }

  const blocos = [];
  async function lerCorpo(el) {
    for (const c of el.childNodes) {
      if (c.namespaceURI !== W) continue;
      if (c.localName === 'p') {
        const p = pedacos(c);
        const estilo = estiloDe(c);
        if (p.some((x) => x.t.trim())) blocos.push({ tipo: 'paragrafo', estilo, pedacos: p });
        for (const src of await imagensDe(c)) blocos.push({ tipo: 'imagem', src });
      } else if (c.localName === 'tbl') {
        const linhas = filhos(c, W, 'tr').map((tr) => filhos(tr, W, 'tc').map((tc) =>
          filhos(tc, W, 'p').map((p) => pedacos(p)).filter((p) => p.some((x) => x.t.trim()))));
        const uteis = linhas.filter((l) => l.some((celula) => celula.length));
        if (uteis.length) blocos.push({ tipo: 'tabela', linhas: uteis });
      } else if (c.localName === 'sdt') {
        const conteudo = filho(c, W, 'sdtContent');
        if (conteudo) await lerCorpo(conteudo);
      }
    }
  }
  const corpo = xml(principal).getElementsByTagNameNS(W, 'body')[0];
  if (!corpo) throw new Error('Não encontramos texto neste Word.');
  await lerCorpo(corpo);
  return blocos;
}
