import { SETORES, STATUS, TIPOS } from '../config.js';
import { pode, podeEditarTarefa } from '../permissoes.js';
import { esc, $, iniciais, dataHora, paraCampoDataHora, comMencoes, avisar } from '../util.js';
import { abrirModal, opcoes } from './modal.js';

// Janela de uma tarefa: ver, criar, editar, comentar.
export async function abrirTarefa(ctx, tarefa, padrao = {}) {
  const { estado } = ctx;
  const db = ctx.db();
  const s = estado.sessao;
  const nova = !tarefa;
  const t = tarefa ?? { titulo: '', descricao: '', tipo: 'tarefa', setor: s.perfil.setores[0] ?? 'criacao', status: 'a_fazer', prioridade: 'normal', responsavel_id: s.perfil.id, projeto_id: '', prazo: '', inicio: '', local: '', ...padrao };
  const podeEditar = nova ? pode(s, 'tarefas', 'criar') : podeEditarTarefa(s, t);
  const soStatus = !nova && !pode(s, 'tarefas', 'editar') && t.responsavel_id === s.perfil.id;
  const bloqueado = (campo) => (!podeEditar || (soStatus && campo !== 'status') ? 'disabled' : '');

  // Pessoas ativas, mais o responsável atual mesmo que desativado (para não sumir ao salvar).
  const pessoas = estado.perfis.filter((p) => p.ativo || p.id === t.responsavel_id)
    .map((p) => ({ chave: p.id, nome: p.ativo ? p.nome : `${p.nome} (desativado)` }));
  // Projetos pertencem a um cliente: escolhe o cliente e depois um dos projetos dele.
  const clientes = [...estado.clientes].sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => ({ chave: c.id, nome: c.nome }));
  const clienteAtual = t.cliente_id ?? ctx.projeto(t.projeto_id)?.cliente_id ?? '';
  const projetosDo = (clienteId) => estado.projetos.filter((p) => (p.cliente_id ?? '') === clienteId && (p.status !== 'concluido' || p.id === t.projeto_id))
    .map((p) => ({ chave: p.id, nome: p.nome }));

  const corpo = `
    <form id="form-tarefa" class="grade-campos">
      <div class="campo inteiro"><label>Título</label><input type="text" name="titulo" maxlength="300" required value="${esc(t.titulo)}" ${bloqueado('titulo')}></div>
      <div class="campo"><label>Cliente</label><select name="cliente_id" ${bloqueado('projeto_id')}>${opcoes(clientes, clienteAtual, 'Interno (sem cliente)')}</select></div>
      <div class="campo"><label>Projeto</label><select name="projeto_id" ${bloqueado('projeto_id')}></select><span class="fraco" id="aviso-projeto"></span></div>
      <div class="campo"><label>Responsável</label><select name="responsavel_id" ${bloqueado('responsavel_id')}>${opcoes(pessoas, t.responsavel_id, 'Ninguém ainda')}</select></div>
      <div class="campo"><label>Setor</label><select name="setor" ${bloqueado('setor')}>${opcoes(SETORES, t.setor)}</select></div>
      <div class="campo"><label>Tipo</label><select name="tipo" ${bloqueado('tipo')}>${opcoes(TIPOS, t.tipo)}</select></div>
      <div class="campo"><label>Status</label><select name="status" ${bloqueado('status')}>${opcoes(STATUS, t.status)}</select></div>
      <div class="campo"><label>Prioridade</label><select name="prioridade" ${bloqueado('prioridade')}>${opcoes([{ chave: 'normal', nome: 'Normal' }, { chave: 'urgente', nome: 'Urgente' }], t.prioridade)}</select></div>
      <div class="campo"><label>Prazo</label><input type="date" name="prazo" value="${esc(t.prazo ?? '')}" ${bloqueado('prazo')}></div>
      <div class="campo"><label>Compromisso (data e hora)</label><input type="datetime-local" name="inicio" value="${paraCampoDataHora(t.inicio)}" ${bloqueado('inicio')}></div>
      <div class="campo"><label>Local</label><input type="text" name="local" maxlength="300" value="${esc(t.local ?? '')}" placeholder="Para gravações e reuniões" ${bloqueado('local')}></div>
      <div class="campo inteiro"><label>Descrição</label><textarea name="descricao" maxlength="20000" ${bloqueado('descricao')}>${esc(t.descricao ?? '')}</textarea></div>
    </form>
    ${nova ? '' : '<div class="comentarios"><h3>Comentários</h3><div id="lista-comentarios" style="margin-top:14px"></div></div>'}`;

  const rodape = `
    ${!nova && pode(s, 'tarefas', 'apagar') ? '<button class="botao perigo" id="apagar-tarefa">Apagar</button>' : ''}
    <span class="espaco"></span>
    <button class="botao" data-fechar-rodape>${podeEditar ? 'Cancelar' : 'Fechar'}</button>
    ${podeEditar ? `<button class="botao primario" id="salvar-tarefa">${nova ? 'Criar tarefa' : 'Salvar'}</button>` : ''}`;

  const { el, fechar } = abrirModal({ titulo: nova ? 'Nova tarefa' : 'Tarefa', corpo, rodape, largo: true });
  $('[data-fechar-rodape]', el).onclick = fechar;

  const seletorCliente = $('[name=cliente_id]', el);
  const seletorProjeto = $('[name=projeto_id]', el);
  const atualizarProjetos = () => {
    const lista = projetosDo(seletorCliente.value);
    const escolhido = lista.some((p) => p.chave === seletorProjeto.value) ? seletorProjeto.value : t.projeto_id;
    const interno = !seletorCliente.value;
    seletorProjeto.innerHTML = opcoes(lista, escolhido, interno ? 'Sem projeto' : 'Escolha o projeto');
    seletorProjeto.required = !interno;
    if (!interno && lista.length === 1 && !seletorProjeto.value) seletorProjeto.value = lista[0].chave;
    $('#aviso-projeto', el).textContent = !interno && !lista.length ? 'Este cliente ainda não tem projeto. Crie um na ficha do cliente.' : '';
  };
  seletorCliente.addEventListener('change', atualizarProjetos);
  atualizarProjetos();

  $('#salvar-tarefa', el)?.addEventListener('click', async () => {
    const form = $('#form-tarefa', el);
    if (!form.reportValidity()) return;
    const f = Object.fromEntries(new FormData(form));
    const dados = soStatus ? { status: f.status } : {
      titulo: f.titulo.trim(), projeto_id: f.projeto_id || null, responsavel_id: f.responsavel_id || null,
      setor: f.setor, tipo: f.tipo, status: f.status, prioridade: f.prioridade,
      prazo: f.prazo || null, inicio: f.inicio ? new Date(f.inicio).toISOString() : null,
      local: f.local.trim(), descricao: f.descricao,
    };
    try {
      if (nova) await db.inserir('tarefas', { ...dados, ordem: Date.now() });
      else await db.atualizar('tarefas', t.id, dados);
      fechar();
      avisar(nova ? 'Tarefa criada' : 'Tarefa salva');
      await ctx.recarregar();
    } catch (err) { avisar(err.message); }
  });

  $('#apagar-tarefa', el)?.addEventListener('click', async () => {
    const botao = $('#apagar-tarefa', el);
    if (botao.dataset.confirmar !== 'sim') { botao.dataset.confirmar = 'sim'; botao.textContent = 'Clique de novo para apagar'; return; }
    try { await db.apagar('tarefas', t.id); fechar(); avisar('Tarefa apagada'); await ctx.recarregar(); } catch (err) { avisar(err.message); }
  });

  if (!nova) await desenharComentarios(ctx, t, $('#lista-comentarios', el));
}

async function desenharComentarios(ctx, t, alvo) {
  const db = ctx.db();
  const lista = await db.listar('comentarios', { tarefa_id: t.id });
  const primeiros = ctx.estado.perfis.filter((p) => p.ativo).map((p) => '@' + p.nome.split(' ')[0]).join(', ');
  alvo.innerHTML = `
    ${lista.length ? lista.map((c) => {
      const nome = ctx.nomePerfil(c.autor_id);
      return `<div class="comentario"><span class="avatar">${esc(iniciais(nome))}</span>
        <div class="balao"><b>${esc(nome)}</b> <span class="fraco">${dataHora(c.criado_em)}</span><p>${comMencoes(c.texto)}</p></div></div>`;
    }).join('') : '<p class="fraco">Nenhum comentário ainda.</p>'}
    <div class="novo-comentario"><textarea id="texto-comentario" maxlength="5000" placeholder="Escreva um comentário. Para chamar alguém: ${esc(primeiros)}"></textarea>
    <button class="botao" id="enviar-comentario">Enviar</button></div>`;
  $('#enviar-comentario', alvo).onclick = async () => {
    const texto = $('#texto-comentario', alvo).value.trim();
    if (!texto) return;
    try { await db.inserir('comentarios', { tarefa_id: t.id, texto }); await desenharComentarios(ctx, t, alvo); } catch (err) { avisar(err.message); }
  };
}
