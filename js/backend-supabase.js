// Modo online: conversa com o banco no Supabase. As regras de quem vê o
// quê estão no próprio banco (supabase/schema.sql).
import { CONFIG } from './config.js';
import { conferirArquivo, novoIdAnexo } from './anexos.js';

export const modo = 'online';
let sb = null;

export async function iniciar() {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.99.3/+esm');
  sb = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
}

const checar = ({ data, error }) => {
  if (error) throw new Error(traduzirErro(error.message));
  return data;
};

function traduzirErro(msg) {
  if (/row-level security|permission denied/i.test(msg)) return 'Você não tem permissão para isso.';
  if (/Invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.';
  if (/Email not confirmed/i.test(msg)) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  if (/already registered/i.test(msg)) return 'Esse e-mail já tem conta. Use "Entrar".';
  if (/Database error saving new user/i.test(msg)) return 'Não deu para criar a conta. Confira a senha de acesso da LOOK com o administrador.';
  if (/Password should be/i.test(msg)) return 'A senha precisa ter pelo menos 6 caracteres.';
  const espera = msg.match(/only request this after (\d+) seconds/i);
  if (espera) return `Por segurança, espere ${espera[1]} segundos antes de tentar de novo.`;
  if (/rate limit/i.test(msg)) return 'Muitas tentativas em pouco tempo. Espere alguns minutos e tente de novo.';
  if (/invalid format|valid email/i.test(msg)) return 'Confira o e-mail digitado.';
  if (/mime type|not supported/i.test(msg)) return 'Esse tipo de arquivo não é aceito: só imagens, PDF, Word, PowerPoint e Excel.';
  if (/exceeded the maximum allowed size|Payload too large/i.test(msg)) return 'Arquivo grande demais: o limite é 20 MB.';
  if (/anexos_tipo/i.test(msg)) return 'Esse tipo de arquivo não é aceito: só imagens, PDF, Word, PowerPoint e Excel.';
  if (/anexos_tamanhos/i.test(msg)) return 'Arquivo grande demais: o limite é 20 MB.';
  if (/briefings_tamanhos/i.test(msg)) return 'Briefing grande demais.';
  if (/lancamentos_valor/i.test(msg)) return 'O valor precisa ser maior que zero.';
  if (/lancamentos_tamanhos/i.test(msg)) return 'Preencha a descrição (até 200 letras).';
  if (/lancamentos_data/i.test(msg)) return 'Confira a data.';
  if (/lancamentos_nf/i.test(msg)) return 'Confira o número e o arquivo da nota fiscal.';
  if (/orcamentos_tamanhos/i.test(msg)) return 'Orçamento grande demais: confira o título (até 200 letras) e a quantidade de itens.';
  if (/orcamentos_totais/i.test(msg)) return 'Confira os valores do orçamento.';
  if (/orcamentos_status/i.test(msg)) return 'Status de orçamento inválido.';
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'Sem conexão com o servidor. Confira a internet e tente de novo.';
  return msg;
}

export async function sessao() {
  const { data } = await sb.auth.getSession();
  const usuario = data.session?.user;
  if (!usuario) return null;
  const perfil = checar(await sb.from('perfis').select('*').eq('id', usuario.id).maybeSingle());
  if (!perfil) return null;
  const permissoes = {};
  for (const p of checar(await sb.from('permissoes').select('*').eq('usuario_id', usuario.id))) permissoes[p.modulo] = p;
  return { perfil, permissoes };
}

export async function entrar(email, senha) {
  checar(await sb.auth.signInWithPassword({ email, password: senha }));
}

export async function criarConta(nome, email, senha, codigo) {
  // A senha de acesso vai junto e é conferida pelo banco (schema.sql), que não a guarda.
  const data = checar(await sb.auth.signUp({ email, password: senha, options: { data: { nome, codigo } } }));
  return { precisaConfirmar: !data.session };
}

export async function sair() { await sb.auth.signOut(); }

export async function listar(tabela, filtros = {}) {
  let consulta = sb.from(tabela).select('*');
  for (const [k, v] of Object.entries(filtros)) consulta = consulta.eq(k, v);
  if (tabela !== 'permissoes') consulta = consulta.order('criado_em', { ascending: tabela !== 'avisos' });
  return checar(await consulta);
}

export async function inserir(tabela, dados) {
  return checar(await sb.from(tabela).insert(dados).select().single());
}

export async function atualizar(tabela, id, mudancas) {
  const linhas = checar(await sb.from(tabela).update(mudancas).eq('id', id).select());
  if (!linhas.length) throw new Error('Você não tem permissão para isso.');
  return linhas[0];
}

export async function apagar(tabela, id) {
  // Os arquivos dos anexos ficam fora da tabela: saem do depósito antes do projeto.
  if (tabela === 'lancamentos') {
    const l = checar(await sb.from('lancamentos').select('nf_caminho').eq('id', id).maybeSingle());
    if (l?.nf_caminho) checar(await sb.storage.from('notas').remove([l.nf_caminho]));
  }
  if (tabela === 'projetos') {
    const anexos = checar(await sb.from('anexos').select('caminho').eq('projeto_id', id));
    if (anexos.length) checar(await sb.storage.from('anexos').remove(anexos.map((a) => a.caminho)));
  }
  const linhas = checar(await sb.from(tabela).delete().eq('id', id).select('id'));
  if (!linhas.length) throw new Error('Você não tem permissão para isso.');
}

export async function mudarSenhaAcesso(nova) {
  checar(await sb.rpc('mudar_senha_acesso', { p_nova: nova }));
}

export async function salvarPermissoes(usuarioId, linhas) {
  checar(await sb.from('permissoes').upsert(linhas.map((l) => ({ ...l, usuario_id: usuarioId })), { onConflict: 'usuario_id,modulo' }));
}

// ---------- Anexos dos projetos ----------
const deposito = () => sb.storage.from('anexos');

export async function listarAnexos(projetoId) {
  return checar(await sb.from('anexos').select('*').eq('projeto_id', projetoId).order('criado_em', { ascending: true }));
}

// Registra o anexo e depois envia o arquivo para a pasta do projeto, com nome
// sorteado (o nome original fica só na tabela). Se o envio falhar, desfaz.
export async function enviarAnexo(projetoId, arquivo) {
  const { tipo, ext } = conferirArquivo(arquivo);
  const id = novoIdAnexo();
  const caminho = `${projetoId}/${id}.${ext}`;
  const anexo = checar(await sb.from('anexos').insert({
    id, projeto_id: projetoId, nome: arquivo.name.slice(0, 255), caminho, tipo, tamanho: arquivo.size,
  }).select().single());
  const { error } = await deposito().upload(caminho, arquivo, { contentType: tipo, upsert: false });
  if (error) {
    await sb.from('anexos').delete().eq('id', id);
    throw new Error(traduzirErro(error.message));
  }
  return anexo;
}

// Links que valem por 1 hora: um para abrir no navegador e outro para baixar
// com o nome original.
export async function linksAnexos(anexos) {
  if (!anexos.length) return {};
  const abrir = checar(await deposito().createSignedUrls(anexos.map((a) => a.caminho), 3600));
  const baixar = await Promise.all(anexos.map((a) => deposito().createSignedUrl(a.caminho, 3600, { download: a.nome })));
  const links = {};
  anexos.forEach((a, i) => { links[a.id] = { abrir: abrir[i]?.signedUrl ?? '', baixar: baixar[i]?.data?.signedUrl ?? '' }; });
  return links;
}

export async function apagarAnexo(anexo) {
  const removidos = checar(await deposito().remove([anexo.caminho]));
  if (!removidos?.length) throw new Error('Você não tem permissão para isso.');
  await apagar('anexos', anexo.id);
}

// ---------- Notas fiscais dos lançamentos da empresa ----------
export async function enviarArquivoNota(caminho, arquivo, tipo) {
  checar(await sb.storage.from('notas').upload(caminho, arquivo, { contentType: tipo, upsert: false }));
}

export async function linkNota(caminho) {
  return checar(await sb.storage.from('notas').createSignedUrl(caminho, 3600)).signedUrl;
}

export async function apagarArquivoNota(caminho) {
  const removidos = checar(await sb.storage.from('notas').remove([caminho]));
  if (!removidos?.length) throw new Error('Você não tem permissão para isso.');
}

// ---------- Briefing pelo link do cliente (sem login) ----------
export async function abrirBriefing(token) {
  return checar(await sb.rpc('briefing_abrir', { p_token: token }));
}

export async function enviarBriefing(token, respostas) {
  checar(await sb.rpc('briefing_enviar', { p_token: token, p_respostas: respostas }));
}
