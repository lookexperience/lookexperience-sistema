// Histórico de versões. Toda atualização do sistema acrescenta uma
// entrada no topo desta lista; a tela "Sobre o sistema" mostra tudo.
export const HISTORICO = [
  {
    versao: '0.4.0',
    data: '2026-11-05',
    titulo: 'Anexos nos projetos',
    itens: [
      'Cada projeto ganhou a área Anexos: imagens, PDF, Word, PowerPoint e Excel, até 20 MB cada (clicando em "+ Anexar" ou arrastando os arquivos)',
      'Imagens aparecem em miniatura; qualquer anexo abre no navegador ou baixa com o nome original',
      'Quem vê o projeto vê os anexos; quem edita projetos anexa; apaga quem pode apagar projetos ou quem enviou',
      'Arquivos ficam num depósito privado do Supabase e só abrem por link temporário (1 hora)',
      'Tipos perigosos (página, SVG, programa) são recusados na tela, no banco e no depósito',
      'Apagar um projeto apaga também os arquivos dele',
    ],
  },
  {
    versao: '0.3.0',
    data: '2026-11-04',
    titulo: 'Apresentações a partir do Word',
    itens: [
      'Nova tela Apresentações: arrasta um Word (.docx) e sai a apresentação no padrão visual da LOOK',
      'Segue o formato da proposta comercial: capa com título, etiqueta e "Apresentada a / por / Data", um slide por Título 2, cartões, etapas, colunas, listas, tabelas, imagens e aceite',
      'Texto se ajusta sozinho ao slide (cresce se é pouco, diminui se é muito) e o slide Obrigado com os contatos entra no fim',
      'Botões para apresentar em tela cheia (setas, N mostra as notas), salvar em PDF e baixar a apresentação num arquivo único que abre em qualquer computador',
      'Modelo de Word para baixar na própria tela; o arquivo não sai do computador de quem usa',
    ],
  },
  {
    versao: '0.2.2',
    data: '2026-11-04',
    titulo: 'Senha de acesso para criar conta',
    itens: [
      'Criar conta agora pede a senha de acesso da LOOK, conferida pelo próprio banco (não dá para pular pela API)',
      'A senha digitada não fica guardada na conta; no banco ela fica embaralhada e ninguém consegue lê-la',
      'O administrador troca a senha de acesso em Equipe e acessos',
      'Tarefa só entra em projeto (e projeto só entra em cliente) que a pessoa já enxerga, para ninguém passar a ver projeto alheio',
      'Funções internas do banco fechadas também para quem está logado',
    ],
  },
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
      'Robô que impede o Supabase grátis de pausar (todo dia), backup semanal e testes automáticos a cada atualização',
      'Se o banco não responder, a abertura mostra um aviso com "Tentar de novo" em vez de ficar presa no logo',
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
