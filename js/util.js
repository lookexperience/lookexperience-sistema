export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

// Datas "AAAA-MM-DD" são tratadas no fuso local, sem virar o dia.
export function paraData(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return valor;
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [a, m, d] = valor.split('-').map(Number);
    return new Date(a, m - 1, d);
  }
  return new Date(valor);
}

export const chaveDia = (data) => {
  const d = paraData(data);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const hoje = () => chaveDia(new Date());
export const nomeMes = (i) => MESES[i];
export const mesCurto = (i) => MESES_CURTOS[i];

export function dataCurta(valor) {
  const d = paraData(valor);
  return d ? `${d.getDate()} ${MESES_CURTOS[d.getMonth()]}` : '';
}

export function hora(valor) {
  const d = paraData(valor);
  return d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
}

export function dataHora(valor) {
  const d = paraData(valor);
  return d ? `${dataCurta(d)}, ${hora(d)}` : '';
}

// Valor para <input type="datetime-local">.
export function paraCampoDataHora(valor) {
  const d = paraData(valor);
  if (!d) return '';
  return `${chaveDia(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Dia em que a tarefa aparece no calendário: o compromisso, senão o prazo.
export const diaDaTarefa = (t) => (t.inicio ? chaveDia(t.inicio) : t.prazo || null);

export const estaAtrasada = (t) => t.status !== 'feito' && t.prazo && t.prazo < hoje();

export const iniciais = (nome) => (nome || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

export function avisar(texto) {
  const el = document.createElement('div');
  el.className = 'aviso-flutuante';
  el.textContent = texto;
  document.body.append(el);
  setTimeout(() => el.remove(), 2600);
}

// Destaca @menções num texto já escapado.
export const comMencoes = (texto) => esc(texto).replace(/@([\p{L}\d_]+)/gu, '<span class="mencao">@$1</span>');

export const ICONES = {
  geral: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 11l9-7 9 7v9H3z"/><path d="M9 20v-6h6v6"/></svg>',
  kanban: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="5" height="16"/><rect x="10" y="4" width="5" height="10"/><rect x="17" y="4" width="4" height="13"/></svg>',
  calendario: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  clientes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6"/><path d="M16 4a4 4 0 010 8M22 21c0-3-2-5-4-6"/></svg>',
  projetos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h7l2 2h9v12H3z"/></svg>',
  comercial: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 4h18l-7 8v7l-4 2v-9z"/></svg>',
  criacao: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20l4-1 11-11-3-3L5 16z"/></svg>',
  execucao: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="6" width="14" height="12"/><path d="M16 10l6-3v10l-6-3"/></svg>',
  materiais: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18"/><path d="M3 9h18M9 21V9"/></svg>',
  equipamentos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="13" r="4"/><path d="M3 8h4l2-3h6l2 3h4v12H3z"/></svg>',
  financeiro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2v20M17 6H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>',
  horas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  equipe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="10" width="16" height="11"/><path d="M8 10V7a4 4 0 018 0v3"/></svg>',
  sobre: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.5"/></svg>',
  sino: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 16V11a6 6 0 0112 0v5l2 2H4z"/><path d="M10 21h4"/></svg>',
  mais: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
  fechar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  sair: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11"/></svg>',
};
