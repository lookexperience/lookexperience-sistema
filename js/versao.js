// Histórico de versões. Toda atualização do sistema acrescenta uma
// entrada no topo desta lista; a tela "Sobre o sistema" mostra tudo.
export const HISTORICO = [
  {
    versao: '0.2.0',
    data: '2026-10-22',
    titulo: 'Ajustes da primeira revisão',
    itens: [
      'Projetos ligados ao cliente: na tarefa, escolhe-se o cliente e depois um dos projetos dele',
      'Ficha do cliente mostra os projetos dele e cria projeto novo ali mesmo',
      'Tela Projetos agrupada por cliente; filtros de Atividades e Calendário agrupados por cliente',
      'Calendário com duas abas: Agenda da equipe e Agenda de postagens',
      'Filtro por cliente em Atividades e nas duas agendas',
      'Projetos por cliente mostram as tarefas de cada projeto em lista, com botão para criar tarefa no projeto',
      'Em Projetos, cada pessoa pode recolher ou abrir a janela de cada cliente e a lista de tarefas de cada projeto',
      'Cor por cliente: escolhida na janela do cliente em Projetos ou na ficha dele, e usada na agenda de postagens e nos cartões',
    ],
  },
  {
    versao: '0.1.0',
    data: '2026-10-21',
    titulo: 'Fase 1: a base',
    itens: [
      'Login com e-mail e senha; contas novas entram sem acesso até o administrador liberar',
      'Permissões por usuário guardadas no banco: ver, criar, editar e apagar por módulo, e alcance das tarefas (só as próprias, do setor ou todas)',
      'Visão geral, Atividades (kanban), Calendário, Clientes, Projetos e Equipe e acessos',
      'Comentários nas tarefas com @menção e avisos no sininho',
      'Modo demonstração para testar antes do banco estar ligado',
    ],
  },
];

export const VERSAO = HISTORICO[0].versao;
