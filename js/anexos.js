// Regras dos anexos dos projetos, iguais às do banco (supabase/schema.sql):
// só imagens, PDFs e propostas (Word, PowerPoint, Excel), até 20 MB cada.
// A tela confere antes de enviar; o banco e o depósito conferem de novo.

export const LIMITE_ANEXO = 20 * 1024 * 1024;

export const TIPOS_ANEXO = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

// Alguns computadores mandam o arquivo sem tipo: deduz pela extensão.
const PELA_EXTENSAO = Object.fromEntries(Object.entries(TIPOS_ANEXO).map(([tipo, ext]) => [ext, tipo]));
PELA_EXTENSAO.jpeg = 'image/jpeg';

export const ACEITOS = Object.keys(PELA_EXTENSAO).map((e) => `.${e}`).join(',');

export function tipoDoArquivo(arquivo) {
  if (TIPOS_ANEXO[arquivo.type]) return arquivo.type;
  const ext = (arquivo.name.split('.').pop() || '').toLowerCase();
  return PELA_EXTENSAO[ext] ?? null;
}

// Confere o arquivo e devolve { tipo, ext } ou lança um erro com a explicação.
export function conferirArquivo(arquivo) {
  const tipo = tipoDoArquivo(arquivo);
  if (!tipo) throw new Error(`"${arquivo.name}" não foi anexado: só imagens, PDF, Word, PowerPoint e Excel.`);
  if (arquivo.size > LIMITE_ANEXO) throw new Error(`"${arquivo.name}" passa de 20 MB. Para arquivos grandes, coloque o link do Google Drive na descrição do projeto.`);
  if (!arquivo.size) throw new Error(`"${arquivo.name}" está vazio.`);
  return { tipo, ext: TIPOS_ANEXO[tipo] };
}

export const ehImagem = (anexo) => anexo.tipo.startsWith('image/');

export function tamanhoLegivel(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

// Nome curto do tipo, para o ícone do arquivo.
export const rotuloTipo = (anexo) => (TIPOS_ANEXO[anexo.tipo] ?? 'arq').replace(/x$/, '').toUpperCase();

export const novoIdAnexo = () => (crypto.randomUUID ? crypto.randomUUID()
  : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));

// Arquivo da nota fiscal no lançamento da empresa: PDF ou foto, até 5 MB
// (iguais ao depósito "notas" do banco).
export const LIMITE_NOTA = 5 * 1024 * 1024;
const TIPOS_NOTA = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };
export const ACEITOS_NOTA = '.pdf,.jpg,.jpeg,.png';

export function conferirNota(arquivo) {
  const tipo = tipoDoArquivo(arquivo);
  if (!TIPOS_NOTA[tipo]) throw new Error('A nota precisa ser um PDF ou uma foto (JPG ou PNG).');
  if (arquivo.size > LIMITE_NOTA) throw new Error('O arquivo da nota passa de 5 MB.');
  if (!arquivo.size) throw new Error('O arquivo da nota está vazio.');
  return { tipo, ext: TIPOS_NOTA[tipo] };
}

// Arquivo de uma versão de peça da Criação: imagem, PDF ou vídeo, até 50 MB
// (iguais ao depósito "pecas" do banco). Maior que isso: mande o link do Drive.
export const LIMITE_PECA = 50 * 1024 * 1024;
export const TIPOS_PECA = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'application/pdf': 'pdf', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
};
const PECA_PELA_EXTENSAO = { ...Object.fromEntries(Object.entries(TIPOS_PECA).map(([t, e]) => [e, t])), jpeg: 'image/jpeg' };
export const ACEITOS_PECA = Object.keys(PECA_PELA_EXTENSAO).map((e) => `.${e}`).join(',');

export function conferirArquivoPeca(arquivo) {
  const ext0 = (arquivo.name.split('.').pop() || '').toLowerCase();
  const tipo = TIPOS_PECA[arquivo.type] ? arquivo.type : PECA_PELA_EXTENSAO[ext0];
  if (!tipo) throw new Error(`"${arquivo.name}" não foi enviado: só imagens (JPG, PNG, WEBP, GIF), PDF e vídeos (MP4, WEBM, MOV).`);
  if (arquivo.size > LIMITE_PECA) throw new Error(`"${arquivo.name}" passa de 50 MB. Para arquivos grandes, envie como link (Google Drive, YouTube).`);
  if (!arquivo.size) throw new Error(`"${arquivo.name}" está vazio.`);
  return { tipo, ext: TIPOS_PECA[tipo] };
}

// Link externo da versão: só https, sem espaços.
export function conferirLinkPeca(link) {
  const l = String(link ?? '').trim();
  if (!/^https:\/\/[^\s<>"]+$/.test(l) || l.length > 1000) throw new Error('O link precisa começar com https:// (ex.: link do Google Drive ou do YouTube).');
  return l;
}
