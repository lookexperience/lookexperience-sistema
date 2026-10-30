// Configuração do sistema.
// URL e chave pública (publishable) do projeto no Supabase (Project Settings > API Keys).
// A chave pública pode ficar no código: quem protege os dados são as regras do banco (schema.sql).
// O sistema roda em MODO DEMONSTRAÇÃO (dados só neste navegador, com usuários de exemplo)
// quando aberto no próprio computador (localhost, usado pelos testes) ou com ?demo no endereço.
export const CONFIG = {
  supabaseUrl: 'https://xylbjuooxdfthuxluxsx.supabase.co',
  supabaseAnonKey: 'sb_publishable_ALDizIBHX6mlmgqSpx2r0g_AHAcvuV-',
};

export const MODO_DEMO = !CONFIG.supabaseUrl
  || ['localhost', '127.0.0.1'].includes(location.hostname)
  || new URLSearchParams(location.search).has('demo');

export const SETORES = [
  { chave: 'comercial', nome: 'Comercial' },
  { chave: 'criacao', nome: 'Criação' },
  { chave: 'execucao', nome: 'Execução' },
];

export const STATUS = [
  { chave: 'a_fazer', nome: 'A fazer' },
  { chave: 'fazendo', nome: 'Fazendo' },
  { chave: 'em_aprovacao', nome: 'Em aprovação' },
  { chave: 'feito', nome: 'Feito' },
];

export const TIPOS = [
  { chave: 'tarefa', nome: 'Tarefa' },
  { chave: 'gravacao', nome: 'Gravação' },
  { chave: 'reuniao', nome: 'Reunião' },
  { chave: 'entrega', nome: 'Entrega' },
  { chave: 'post', nome: 'Post' },
];

export const STATUS_PROJETO = [
  { chave: 'ativo', nome: 'Ativo' },
  { chave: 'pausado', nome: 'Pausado' },
  { chave: 'concluido', nome: 'Concluído' },
];

// Mesmo catálogo da tabela "modulos" do banco.
export const MODULOS = [
  { chave: 'visao_geral', nome: 'Visão geral', fase: 1 },
  { chave: 'tarefas', nome: 'Atividades e calendário', fase: 1 },
  { chave: 'clientes', nome: 'Clientes', fase: 1 },
  { chave: 'projetos', nome: 'Projetos', fase: 1 },
  { chave: 'comercial', nome: 'Comercial', fase: 2 },
  { chave: 'criacao', nome: 'Criação', fase: 3 },
  { chave: 'execucao', nome: 'Execução', fase: 3 },
  { chave: 'materiais', nome: 'Banco de materiais', fase: 3 },
  { chave: 'equipamentos', nome: 'Equipamentos', fase: 3 },
  { chave: 'financeiro', nome: 'Financeiro', fase: 4 },
  { chave: 'horas', nome: 'Registro de horas', fase: 4 },
  { chave: 'equipe', nome: 'Equipe e acessos', fase: 1 },
];

// Cores para identificar cada cliente nas telas (janelas, agenda, cartões).
export const CORES_CLIENTE = [
  { chave: '#B8955A', nome: 'Latão' },
  { chave: '#C2574A', nome: 'Tijolo' },
  { chave: '#D08C3C', nome: 'Âmbar' },
  { chave: '#B9A44C', nome: 'Mostarda' },
  { chave: '#6F9A5B', nome: 'Oliva' },
  { chave: '#4E9A8E', nome: 'Petróleo' },
  { chave: '#4F7FB8', nome: 'Azul' },
  { chave: '#7A6BB5', nome: 'Violeta' },
  { chave: '#B5638F', nome: 'Vinho' },
  { chave: '#8C8C94', nome: 'Cinza' },
];
export const COR_PADRAO = '#8C8C94';

export const nomeDe = (lista, chave) => lista.find((i) => i.chave === chave)?.nome ?? chave;
