// Modo online: conversa com o banco no Supabase. As regras de quem vê o
// quê estão no próprio banco (supabase/schema.sql).
import { CONFIG } from './config.js';

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
  if (/Password should be/i.test(msg)) return 'A senha precisa ter pelo menos 6 caracteres.';
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

export async function criarConta(nome, email, senha) {
  const data = checar(await sb.auth.signUp({ email, password: senha, options: { data: { nome } } }));
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
  const linhas = checar(await sb.from(tabela).delete().eq('id', id).select('id'));
  if (!linhas.length) throw new Error('Você não tem permissão para isso.');
}

export async function salvarPermissoes(usuarioId, linhas) {
  checar(await sb.from('permissoes').upsert(linhas.map((l) => ({ ...l, usuario_id: usuarioId })), { onConflict: 'usuario_id,modulo' }));
}
