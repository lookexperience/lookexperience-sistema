import { pode } from '../permissoes.js';
import { esc, $, dataCurta, avisar } from '../util.js';
import { abrirModal } from './modal.js';
import { MODELOS_BRIEFING } from '../briefing-modelos.js';

// Situação do briefing de cada projeto.
export const BRIEFING_PROJETO = [
  { chave: 'aguardando', nome: 'Aguardando o cliente' },
  { chave: 'recebido', nome: 'Recebido' },
  { chave: 'dispensado', nome: 'Não precisa' },
];

export const etiquetaBriefing = (p) => (p.briefing === 'aguardando'
  ? ' <span class="etiqueta briefing-pendente" title="O cliente ainda não respondeu o briefing">Briefing pendente</span>' : '');

// Endereço que vai para o cliente. O código fica depois do "#", que o
// navegador não manda para nenhum servidor.
export const linkBriefing = (b) => `${location.origin}${location.pathname.replace(/[^/]*$/, '')}briefing.html#${b.token}`;

// Parte "Briefing do cliente" na janela do projeto.
export async function ligarBriefings(ctx, projeto, alvo) {
  if (!alvo) return;
  const s = ctx.estado.sessao;
  const podeEditar = pode(s, 'projetos', 'editar');
  const db = ctx.db();

  async function desenhar() {
    let lista;
    try { lista = await db.listar('briefings', { projeto_id: projeto.id }); } catch (err) { alvo.innerHTML = `<span class="fraco">${esc(err.message)}</span>`; return; }
    const atual = ctx.projeto(projeto.id) ?? projeto;
    const alerta = atual.briefing === 'aguardando'
      ? `<div class="alerta-briefing">${lista.some((b) => b.status === 'aguardando') ? 'O cliente ainda não respondeu o briefing.' : 'Este projeto ainda não tem o briefing do cliente. Gere o link abaixo e mande para ele.'}</div>` : '';
    const itens = lista.map((b) => `<div class="briefing-item" data-briefing="${esc(b.id)}">
        <div class="info"><b>${esc(b.titulo)}</b>
          <span class="fraco">${b.status === 'recebido' ? `Respondido em ${dataCurta(b.recebido_em)}` : `Link gerado em ${dataCurta(b.criado_em)} · aguardando o cliente`}</span></div>
        ${b.status === 'recebido'
          ? '<button class="botao pequeno" data-ver-respostas>Ver respostas</button>'
          : `<input type="text" readonly class="link-briefing" value="${esc(linkBriefing(b))}" aria-label="Link do briefing">
             <button class="botao pequeno" data-copiar>Copiar link</button>`}
        ${podeEditar && (b.status === 'aguardando' || pode(s, 'projetos', 'apagar')) ? '<button class="botao pequeno sutil perigo" data-apagar-briefing>Apagar</button>' : ''}
      </div>`).join('');
    const gerar = podeEditar ? `<div class="gerar-briefing">
        <select id="modelo-briefing" aria-label="Modelo do briefing">${Object.values(MODELOS_BRIEFING).map((m) => `<option value="${esc(m.id)}">${esc(m.titulo)}</option>`).join('')}</select>
        <button class="botao pequeno" id="gerar-briefing">+ Gerar link de briefing</button></div>` : '';
    alvo.innerHTML = `<div class="anexos-topo"><h3>Briefing do cliente</h3><span class="fraco">O cliente responde pelo link, sem precisar de conta</span></div>
      ${alerta}${itens || '<span class="fraco">Nenhum briefing ainda.</span>'}${gerar}`;

    $('#gerar-briefing', alvo)?.addEventListener('click', async () => {
      const modelo = MODELOS_BRIEFING[$('#modelo-briefing', alvo).value];
      try {
        await db.inserir('briefings', { projeto_id: projeto.id, modelo: modelo.id, titulo: modelo.titulo, perguntas: { descricao: modelo.descricao, secoes: modelo.secoes } });
        if (atual.briefing !== 'aguardando' && atual.briefing !== 'recebido') {
          await db.atualizar('projetos', projeto.id, { briefing: 'aguardando' });
        }
        avisar('Link do briefing gerado. Copie e mande para o cliente.');
        await ctx.recarregar();
        await desenhar();
      } catch (err) { avisar(err.message); }
    });
    alvo.querySelectorAll('[data-copiar]').forEach((b) => b.addEventListener('click', async () => {
      const campo = b.closest('.briefing-item').querySelector('.link-briefing');
      try { await navigator.clipboard.writeText(campo.value); avisar('Link copiado'); } catch { campo.select(); avisar('Selecione e copie o link (Ctrl+C)'); }
    }));
    alvo.querySelectorAll('[data-ver-respostas]').forEach((b) => b.addEventListener('click', () => {
      verRespostas(ctx, lista.find((x) => x.id === b.closest('[data-briefing]').dataset.briefing), projeto);
    }));
    alvo.querySelectorAll('[data-apagar-briefing]').forEach((b) => b.addEventListener('click', async () => {
      if (b.dataset.confirmar !== 'sim') { b.dataset.confirmar = 'sim'; b.textContent = 'Clique de novo'; return; }
      try { await db.apagar('briefings', b.closest('[data-briefing]').dataset.briefing); avisar('Briefing apagado'); await desenhar(); } catch (err) { avisar(err.message); }
    }));
  }
  await desenhar();
}

// Respostas do cliente, pergunta por pergunta.
export function verRespostas(ctx, briefing, projeto) {
  const r = briefing.respostas ?? {};
  const resposta = (q) => {
    const v = r[q.id];
    if (Array.isArray(v)) return v.length ? esc(v.join(', ')) : '';
    return v ? esc(v) : '';
  };
  const secoes = (briefing.perguntas?.secoes ?? []).map((sec) => `
    <section class="respostas-secao"><h3>${esc(sec.titulo)}</h3>
      ${sec.perguntas.map((q) => {
        const v = resposta(q);
        return `<div class="resposta"><div class="pergunta">${esc(q.pergunta)}</div><div class="${v ? 'texto' : 'fraco'}">${v || 'Sem resposta'}</div></div>`;
      }).join('')}</section>`).join('');
  const cliente = ctx.estado.clientes.find((c) => c.id === projeto.cliente_id);
  abrirModal({
    titulo: esc(briefing.titulo),
    corpo: `<p class="fraco">${esc(cliente?.nome ?? '')}${cliente ? ' · ' : ''}${esc(projeto.nome)} · respondido em ${dataCurta(briefing.recebido_em)}</p>
      <div class="respostas-briefing">${secoes}</div>`,
    largo: true,
  });
}
