// Janela de cadastro usada por Produtos, Fornecedores e Equipamentos:
// mostra os campos, salva, apaga (com dois cliques) e respeita as
// permissões do módulo. Quem bloqueia de verdade é o banco (schema.sql).
import { pode } from '../permissoes.js';
import { esc, $, avisar } from '../util.js';
import { abrirModal } from './modal.js';
import { lerValor } from './financas.js';

const valorNoCampo = (v) => (v || v === 0 ? Number(v).toFixed(2).replace('.', ',') : '');

// campos: [{ nome, rotulo, tipo: 'text'|'email'|'textarea'|'select'|'checkbox'|'valor', max, inteiro,
//            obrigatorio, opcoes: [{ chave, nome }], vazio: 'texto da opção vazia', sugestoes: [...], dica }]
export function abrirFicha(ctx, { tabela, modulo, titulo, campos, linha, padrao = {}, depois, salvo = 'Salvo', antesDeSalvar }) {
  const s = ctx.estado.sessao;
  const novo = !linha;
  const r = linha ?? { ...padrao };
  const podeSalvar = pode(s, modulo, novo ? 'criar' : 'editar');
  const podeApagar = !novo && pode(s, modulo, 'apagar');
  const dis = podeSalvar ? '' : 'disabled';

  const html = (c) => {
    const v = r[c.nome] ?? '';
    const classe = `campo ${c.inteiro ? 'inteiro' : ''}`;
    const dica = c.dica ? `<div class="fraco">${c.dica}</div>` : '';
    if (c.tipo === 'textarea') return `<div class="${classe}"><label>${c.rotulo}</label><textarea name="${c.nome}" maxlength="${c.max ?? 20000}" ${dis}>${esc(v)}</textarea>${dica}</div>`;
    if (c.tipo === 'checkbox') {
      return `<div class="${classe}"><label class="marcar"><input type="checkbox" name="${c.nome}" ${v ? 'checked' : ''} ${dis}> ${c.rotulo}</label>${dica}</div>`;
    }
    if (c.tipo === 'select') {
      return `<div class="${classe}"><label>${c.rotulo}</label><select name="${c.nome}" ${dis}>
        ${c.vazio !== undefined ? `<option value="">${esc(c.vazio)}</option>` : ''}
        ${c.opcoes.map((o) => `<option value="${esc(o.chave)}" ${o.chave === v ? 'selected' : ''}>${esc(o.nome)}</option>`).join('')}</select>${dica}</div>`;
    }
    const lista = c.sugestoes ? `list="sug-${c.nome}"` : '';
    const valor = c.tipo === 'valor' ? valorNoCampo(v) : v;
    return `<div class="${classe}"><label>${c.rotulo}</label>
      <input type="${c.tipo === 'email' ? 'email' : 'text'}" name="${c.nome}" value="${esc(valor)}" maxlength="${c.max ?? 200}" ${c.tipo === 'valor' ? 'inputmode="decimal" placeholder="0,00"' : ''} ${c.obrigatorio ? 'required' : ''} ${lista} ${dis}>
      ${c.sugestoes ? `<datalist id="sug-${c.nome}">${c.sugestoes.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>` : ''}${dica}</div>`;
  };

  const { el, fechar } = abrirModal({
    titulo: novo ? titulo.novo : esc(titulo.de(r)),
    corpo: `<form class="grade-campos" id="form-ficha">${campos.map(html).join('')}</form><div class="erro" id="erro-ficha"></div>`,
    rodape: `${podeApagar ? '<button class="botao perigo" id="apagar-ficha">Apagar</button>' : ''}<span class="espaco"></span>
      ${podeSalvar ? '<button class="botao primario" id="salvar-ficha">Salvar</button>' : ''}`,
  });
  const form = $('#form-ficha', el);
  const erro = $('#erro-ficha', el);
  form.addEventListener('submit', (e) => { e.preventDefault(); $('#salvar-ficha', el)?.click(); });

  $('#salvar-ficha', el)?.addEventListener('click', async () => {
    erro.textContent = '';
    if (!form.reportValidity()) return;
    const dados = {};
    for (const c of campos) {
      const campo = form.elements[c.nome];
      if (c.tipo === 'checkbox') dados[c.nome] = campo.checked;
      else if (c.tipo === 'valor') {
        const n = campo.value.trim() ? lerValor(campo.value) : 0;
        if (!Number.isFinite(n) || n < 0 || n >= 1e9) { erro.textContent = `Confira o campo "${c.rotulo}": use só números, como 1.250,00.`; campo.focus(); return; }
        dados[c.nome] = n;
      } else if (c.tipo === 'select' && c.vazio !== undefined) dados[c.nome] = campo.value || null;
      else dados[c.nome] = campo.value.trim();
    }
    try {
      antesDeSalvar?.(dados, r);
      if (novo) await ctx.db().inserir(tabela, { ...padrao, ...dados });
      else await ctx.db().atualizar(tabela, r.id, dados);
      fechar(); avisar(salvo); await depois();
    } catch (err) { erro.textContent = err.message; }
  });
  $('#apagar-ficha', el)?.addEventListener('click', async (e) => {
    if (e.target.dataset.confirmar !== 'sim') { e.target.dataset.confirmar = 'sim'; e.target.textContent = 'Clique de novo para apagar'; return; }
    try { await ctx.db().apagar(tabela, r.id); fechar(); avisar('Apagado'); await depois(); } catch (err) { erro.textContent = err.message; }
  });
  return { el, fechar, form };
}
