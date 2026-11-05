// As mesmas regras do banco (schema.sql), usadas pela tela para
// esconder o que a pessoa não pode usar. Quem realmente bloqueia é o banco.

export function pode(sessao, modulo, acao = 'ver') {
  const perfil = sessao?.perfil;
  if (!perfil || !perfil.ativo) return false;
  if (perfil.admin) return true;
  return !!sessao.permissoes[modulo]?.[acao];
}

// Lista de responsáveis da tarefa. Tarefas antigas só têm "responsavel_id".
export const responsaveisDe = (tarefa) => tarefa?.responsaveis ?? (tarefa?.responsavel_id ? [tarefa.responsavel_id] : []);
export const ehResponsavel = (tarefa, id) => responsaveisDe(tarefa).includes(id);

export function escopoTarefas(sessao) {
  if (sessao?.perfil?.admin) return 'todas';
  return sessao?.permissoes.tarefas?.escopo ?? 'proprias';
}

export function podeVerTarefa(sessao, tarefa) {
  if (!pode(sessao, 'tarefas', 'ver')) return false;
  const eu = sessao.perfil.id;
  const escopo = escopoTarefas(sessao);
  return escopo === 'todas'
    || ehResponsavel(tarefa, eu)
    || tarefa.criado_por === eu
    || (escopo === 'setor' && sessao.perfil.setores.includes(tarefa.setor));
}

export function podeEditarTarefa(sessao, tarefa) {
  return podeVerTarefa(sessao, tarefa)
    && (pode(sessao, 'tarefas', 'editar') || ehResponsavel(tarefa, sessao.perfil.id));
}

export function temAlgumAcesso(sessao) {
  if (!sessao?.perfil?.ativo) return false;
  return sessao.perfil.admin || Object.values(sessao.permissoes).some((p) => p.ver);
}
