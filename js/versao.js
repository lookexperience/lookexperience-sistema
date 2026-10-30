// Histórico de versões. Toda atualização do sistema acrescenta uma
// entrada no topo desta lista; a tela "Sobre o sistema" mostra tudo.
export const HISTORICO = [
  {
    versao: '0.2.1',
    data: '2026-10-30',
    titulo: 'Sistema no ar e revisão de segurança',
    itens: [
      'Corrigida falha grave: nome de pessoa ou cliente com código escondido podia rodar esse código na tela de quem abrisse uma tarefa',
      'Cor do cliente só aceita o formato #RRGGBB, no banco e na tela',
      'Política de segurança do site (CSP): o navegador só roda scripts do próprio sistema',
      'Banco: limites de tamanho nos textos, visitante sem login não acessa tabelas nem funções',
      'Só o administrador muda o nome das pessoas, e marcação com @ só avisa quem pode ver a tarefa',
      'Conta desativada não lê mais os avisos antigos',
      'Robô que impede o Supabase grátis de pausar, backup semanal e testes automáticos a cada atualização',
      'Ligado ao banco Supabase, em sistema.lookexperience.com.br',
      'Depois de criar conta, a tela volta para o login com o aviso do e-mail de confirmação',
      'Botão de cadastro e de entrada travado enquanto envia, para não mandar duas vezes',
      'Mensagens do login traduzidas (espera de segurança, muitas tentativas, sem conexão)',
    ],
  },
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
      'No quadro de Atividades, os cartões podem ser arrastados para qualquer posição da coluna; a ordem fica salva para todos',
      'Revisão completa com testes automáticos de cada tipo de usuário (59 no banco, 54 nas telas)',
      'Segurança: o sistema nunca fica sem administrador; autor de tarefa, cliente e projeto não pode ser trocado; quem não tem "editar" só muda status e posição; conta ainda não liberada não vê a equipe',
      'Correções: marcar e desmarcar "Administrador" não libera mais tudo sem querer; conta desativada vê aviso próprio; responsável desativado não some da tarefa; filtros zeram ao trocar de usuário; tabelas cabem no celular',
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
