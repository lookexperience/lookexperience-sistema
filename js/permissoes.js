// As mesmas regras do banco (schema.sql), usadas pela tela para
// esconder o que a pessoa não pode usar. Quem realmente bloqueia é o banco.

export function pode(sessao, modulo, acao = 'ver') {
  const perfil = sessao?.perfil;
  if (!perfil || !perfil.ativo) return false;
  if (perfil.admin) return true;
  return !!sessao.permissoes[modulo]?.[acao];
}

export function escopoTarefas(sessao) {
  if (sessao?.perfil?.admin) return 'todas';
  return sessao?.permissoes.tarefas?.escopo ?? 'proprias';
}

export function podeVerTarefa(sessao, tarefa) {
  if (!pode(sessao, 'tarefas', 'ver')) return false;
  const eu = sessao.perfil.id;
  const escopo = escopoTarefas(sessao);
  return escopo === 'todas'
    || tarefa.responsavel_id === eu
    || tarefa.criado_por === eu
    || (escopo === 'setor' && sessao.perfil.setores.includes(tarefa.setor));
}

export function podeEditarTarefa(sessao, tarefa) {
  return podeVerTarefa(sessao, tarefa)
    && (pode(sessao, 'tarefas', 'editar') || tarefa.responsavel_id === sessao.perfil.id);
}

export function temAlgumAcesso(sessao) {
  if (!sessao?.perfil?.ativo) return false;
  return sessao.perfil.admin || Object.values(sessao.permissoes).some((p) => p.ver);
}
