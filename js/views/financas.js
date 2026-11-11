// Finanças: aba "Pessoal" (as contas de cada pessoa, que só ela vê) e aba
// "Empresa" (o caixa da LOOK, só para quem tem a permissão "Financeiro da
// empresa"). Quem bloqueia de verdade é o banco (schema.sql).
import { pode } from '../permissoes.js';
import { esc, $, $$, avisar, hoje, nomeMes, paraData } from '../util.js';
import { abrirModal } from './modal.js';
import { LINK_EMISSOR_NF } from '../config.js';
import { ACEITOS_NOTA, conferirNota, novoIdAnexo } from '../anexos.js';

export const CATEGORIAS = {
  pessoal: {
    entrada: ['Salário / pró-labore', 'Freela', 'Reembolso', 'Outros'],
    saida: ['Moradia', 'Contas da casa', 'Mercado', 'Alimentação fora', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Assinaturas', 'Cartão de crédito', 'Outros'],
  },
  empresa: {
    entrada: ['Serviço de cliente', 'Mensalidade de cliente', 'Outros'],
    saida: ['Ferramentas e assinaturas', 'Equipamentos', 'Freelancers', 'Impostos e taxas', 'Anúncios e marketing', 'Transporte', 'Pró-labore', 'Outros'],
  },
};

// O que a tela lembra enquanto a pessoa usa o sistema.
const tela = { aba: 'pessoal', mes: hoje().slice(0, 7) };

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const dinheiro = (v) => moeda.format(Number(v) || 0);

// Aceita "1.234,56", "1234,56", "1234.56" e "R$ 1.234".
export function lerValor(texto) {
  let t = String(texto ?? '').replace(/[R$\s]/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

const valorNoCampo = (v) => (v ? Number(v).toFixed(2).replace('.', ',') : '');
const nomeDoMes = (chave) => { const [a, m] = chave.split('-').map(Number); const n = nomeMes(m - 1); return `${n[0].toUpperCase()}${n.slice(1)} de ${a}`; };
function outroMes(chave, passo) {
  const [a, m] = chave.split('-').map(Number);
  const d = new Date(a, m - 1 + passo, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
const soma = (lista) => lista.reduce((t, l) => t + Number(l.valor), 0);

export async function render(el, ctx) {
  const s = ctx.estado.sessao;
  const veEmpresa = pode(s, 'financeiro', 'ver');
  if (!veEmpresa) tela.aba = 'pessoal';
  const aba = tela.aba;
  const empresa = aba === 'empresa';
  const podeCriar = empresa ? pode(s, 'financeiro', 'criar') : true;

  const todos = await ctx.db().listar('lancamentos', { escopo: aba });
  const doMes = todos.filter((l) => l.data.startsWith(tela.mes))
    .sort((a, b) => b.data.localeCompare(a.data) || (b.criado_em ?? '').localeCompare(a.criado_em ?? ''));
  const pagos = doMes.filter((l) => l.pago);
  const entradas = soma(pagos.filter((l) => l.tipo === 'entrada'));
  const saidas = soma(pagos.filter((l) => l.tipo === 'saida'));
  const aReceber = soma(doMes.filter((l) => !l.pago && l.tipo === 'entrada'));
  const aPagar = soma(doMes.filter((l) => !l.pago && l.tipo === 'saida'));
  // Saldo de tudo o que já entrou e saiu até o fim deste mês.
  const fimDoMes = `${tela.mes}-31`;
  const acumulado = todos.filter((l) => l.pago && l.data <= fimDoMes)
    .reduce((t, l) => t + (l.tipo === 'entrada' ? 1 : -1) * Number(l.valor), 0);

  const porCategoria = {};
  for (const l of doMes.filter((x) => x.tipo === 'saida')) porCategoria[l.categoria || 'Sem categoria'] = (porCategoria[l.categoria || 'Sem categoria'] ?? 0) + Number(l.valor);
  const totalGastos = soma(doMes.filter((x) => x.tipo === 'saida'));
  const categorias = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]).map(([nome, v]) => `
    <div class="categoria-gasto"><div class="linha-cat"><span>${esc(nome)}</span><b>${dinheiro(v)}</b></div>
      <div class="barra"><span style="width:${Math.max(2, Math.round((v / totalGastos) * 100))}%"></span></div></div>`).join('');

  const ligado = (l) => {
    if (!empresa) return '';
    const projeto = ctx.projeto(l.projeto_id);
    const cliente = ctx.cliente(l.cliente_id ?? projeto?.cliente_id);
    return [cliente?.nome, projeto?.nome].filter(Boolean).map(esc).join(' · ');
  };
  const linhas = doMes.map((l) => {
    const d = paraData(l.data);
    const extra = [esc(l.categoria), ligado(l)].filter(Boolean).join(' · ');
    return `<tr class="clicavel" data-id="${esc(l.id)}">
      <td class="fraco">${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}</td>
      <td><b>${esc(l.descricao)}</b>${extra ? `<div class="fraco">${extra}</div>` : ''}</td>
      <td class="etiquetas-lancamento">${l.pago ? '' : `<span class="etiqueta pendente">${l.tipo === 'entrada' ? 'A receber' : 'A pagar'}</span>`}
        ${empresa && l.nf_numero ? `<span class="etiqueta" title="Nota fiscal">NF ${esc(l.nf_numero)}</span>` : ''}
        ${empresa && l.tipo === 'entrada' && !l.nf_numero ? '<span class="etiqueta sem-nota" title="Entrada sem nota fiscal registrada">Sem nota</span>' : ''}</td>
      <td class="valor-lancamento tipo-${l.tipo}">${l.tipo === 'entrada' ? '+' : '−'} ${dinheiro(l.valor)}</td></tr>`;
  }).join('');

  el.innerHTML = `
    <div class="cabecalho"><div><div class="sobre">Finanças</div><h1>${empresa ? 'Caixa da LOOK' : 'Minhas finanças'}</h1></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${empresa ? `<a class="botao" id="emitir-nf" href="${LINK_EMISSOR_NF}" target="_blank" rel="noopener noreferrer" title="Abre o Emissor Nacional (gov.br) numa aba nova">Emitir nota fiscal ↗</a>` : ''}
        ${podeCriar ? '<button class="botao" id="nova-saida">+ Saída</button><button class="botao primario" id="nova-entrada">+ Entrada</button>' : ''}</div></div>
    ${veEmpresa ? `<div class="abas"><button class="aba ${empresa ? '' : 'ativa'}" data-aba="pessoal">Pessoal</button><button class="aba ${empresa ? 'ativa' : ''}" data-aba="empresa">Empresa</button></div>` : ''}
    <p class="mudo aviso-financas">${empresa
      ? 'Só quem tem a permissão "Financeiro da empresa" vê esta aba.'
      : 'Só você vê esta aba. Nem o administrador do sistema enxerga suas finanças pessoais.'}</p>
    <div class="navega-mes"><button class="botao sutil" id="mes-antes" title="Mês anterior">‹</button>
      <b id="nome-mes">${nomeDoMes(tela.mes)}</b><button class="botao sutil" id="mes-depois" title="Próximo mês">›</button>
      ${tela.mes !== hoje().slice(0, 7) ? '<button class="botao pequeno sutil" id="mes-hoje">Voltar para este mês</button>' : ''}</div>
    <div class="numeros financas">
      <div class="numero"><div class="rotulo">Entrou</div><div class="valor" id="total-entradas">${dinheiro(entradas)}</div></div>
      <div class="numero"><div class="rotulo">Saiu</div><div class="valor" id="total-saidas">${dinheiro(saidas)}</div></div>
      <div class="numero ${entradas - saidas < 0 ? 'alerta' : ''}"><div class="rotulo">Saldo do mês</div><div class="valor" id="saldo-mes">${dinheiro(entradas - saidas)}</div></div>
      <div class="numero ${acumulado < 0 ? 'alerta' : ''}"><div class="rotulo">Saldo acumulado</div><div class="valor" id="saldo-acumulado">${dinheiro(acumulado)}</div></div>
    </div>
    ${aReceber || aPagar ? `<p class="mudo" id="pendentes">Ainda neste mês: <b>${dinheiro(aReceber)}</b> a receber e <b>${dinheiro(aPagar)}</b> a pagar.</p>` : ''}
    <div class="duas-colunas financas">
      <div class="painel">${linhas ? `<table class="tabela lancamentos"><thead><tr><th>Dia</th><th>Descrição</th><th></th><th style="text-align:right">Valor</th></tr></thead><tbody>${linhas}</tbody></table>`
        : `<div class="vazio">Nenhum lançamento em ${nomeDoMes(tela.mes).toLowerCase()}.${podeCriar ? ' Use os botões "+ Entrada" e "+ Saída".' : ''}</div>`}</div>
      <div class="painel"><h2>Para onde foi o dinheiro</h2><div style="margin-top:12px">${categorias || '<div class="vazio">Nenhuma saída neste mês.</div>'}</div></div>
    </div>`;

  const redesenhar = () => render(el, ctx);
  $$('[data-aba]', el).forEach((b) => b.addEventListener('click', () => { tela.aba = b.dataset.aba; redesenhar(); }));
  $('#mes-antes', el).addEventListener('click', () => { tela.mes = outroMes(tela.mes, -1); redesenhar(); });
  $('#mes-depois', el).addEventListener('click', () => { tela.mes = outroMes(tela.mes, 1); redesenhar(); });
  $('#mes-hoje', el)?.addEventListener('click', () => { tela.mes = hoje().slice(0, 7); redesenhar(); });
  $('#nova-entrada', el)?.addEventListener('click', () => abrirLancamento(ctx, null, { escopo: aba, tipo: 'entrada' }, redesenhar));
  $('#nova-saida', el)?.addEventListener('click', () => abrirLancamento(ctx, null, { escopo: aba, tipo: 'saida' }, redesenhar));
  $$('tr[data-id]', el).forEach((tr) => tr.addEventListener('click', () => abrirLancamento(ctx, doMes.find((l) => l.id === tr.dataset.id), null, redesenhar)));
}

function abrirLancamento(ctx, lancamento, padrao, depois) {
  const s = ctx.estado.sessao;
  const novo = !lancamento;
  // Lançamento novo cai no mês que está aberto na tela (hoje, se for este mês).
  const diaPadrao = tela.mes === hoje().slice(0, 7) ? hoje() : `${tela.mes}-01`;
  const l = lancamento ?? { descricao: '', categoria: '', valor: '', data: diaPadrao, pago: true, cliente_id: null, projeto_id: null, observacoes: '', ...padrao };
  const empresa = l.escopo === 'empresa';
  const podeSalvar = !empresa || pode(s, 'financeiro', novo ? 'criar' : 'editar');
  const podeApagar = !novo && (!empresa || pode(s, 'financeiro', 'apagar'));
  const dis = podeSalvar ? '' : 'disabled';
  const sugestoes = [...new Set([...CATEGORIAS[l.escopo].entrada, ...CATEGORIAS[l.escopo].saida])];
  const clientes = [...ctx.estado.clientes].sort((a, b) => a.nome.localeCompare(b.nome));
  const projetos = [...ctx.estado.projetos].sort((a, b) => a.nome.localeCompare(b.nome));

  const { el, fechar } = abrirModal({
    titulo: novo ? (l.tipo === 'entrada' ? 'Nova entrada' : 'Nova saída') : esc(l.descricao),
    corpo: `<form class="grade-campos" id="form-lancamento">
      <div class="campo"><label>Tipo</label><select name="tipo" ${dis}>
        <option value="entrada" ${l.tipo === 'entrada' ? 'selected' : ''}>Entrada (dinheiro que entra)</option>
        <option value="saida" ${l.tipo === 'saida' ? 'selected' : ''}>Saída (dinheiro que sai)</option></select></div>
      <div class="campo"><label>Valor (R$)</label><input type="text" name="valor" inputmode="decimal" placeholder="0,00" value="${esc(valorNoCampo(l.valor))}" required ${dis}></div>
      <div class="campo inteiro"><label>Descrição</label><input type="text" name="descricao" maxlength="200" required value="${esc(l.descricao)}" placeholder="${empresa ? 'Ex.: Rebranding Lotus, 1ª parcela' : 'Ex.: Aluguel de novembro'}" ${dis}></div>
      <div class="campo"><label>Categoria</label><input type="text" name="categoria" maxlength="60" list="categorias-financas" value="${esc(l.categoria)}" placeholder="Escolha ou escreva" ${dis}>
        <datalist id="categorias-financas">${sugestoes.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></div>
      <div class="campo"><label>Data</label><input type="date" name="data" required value="${esc(l.data)}" ${dis}></div>
      <div class="campo inteiro"><label style="display:flex;gap:8px;align-items:center;text-transform:none;letter-spacing:0">
        <input type="checkbox" name="pago" ${l.pago ? 'checked' : ''} ${dis}> <span id="rotulo-pago">${l.tipo === 'entrada' ? 'Já recebi este dinheiro' : 'Já paguei esta conta'}</span></label>
        <div class="fraco">Desmarcado, entra como "${l.tipo === 'entrada' ? 'a receber' : 'a pagar'}" e não conta no saldo até ser marcado.</div></div>
      ${empresa ? `
      <div class="campo"><label>Cliente</label><select name="cliente_id" ${dis}><option value="">Nenhum</option>
        ${clientes.map((c) => `<option value="${esc(c.id)}" ${c.id === l.cliente_id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></div>
      <div class="campo"><label>Projeto</label><select name="projeto_id" ${dis}><option value="">Nenhum</option>
        ${projetos.map((p) => `<option value="${esc(p.id)}" ${p.id === l.projeto_id ? 'selected' : ''}>${esc(p.nome)}${ctx.cliente(p.cliente_id) ? ` · ${esc(ctx.cliente(p.cliente_id).nome)}` : ''}</option>`).join('')}</select></div>` : ''}
      ${empresa ? `
      <div class="campo inteiro nota-fiscal"><label>Nota fiscal</label>
        <div class="linha-nota"><input type="text" name="nf_numero" maxlength="60" value="${esc(l.nf_numero ?? '')}" placeholder="Número da nota" ${dis}>
          <a class="botao pequeno sutil" href="${LINK_EMISSOR_NF}" target="_blank" rel="noopener noreferrer">Emitir no Emissor Nacional ↗</a></div>
        ${l.nf_caminho ? `<div class="arquivo-nota" id="arquivo-nota"><a id="ver-nota" target="_blank" rel="noopener noreferrer">${esc(l.nf_nome || 'Ver a nota')}</a>
          ${podeSalvar ? '<button type="button" class="botao pequeno sutil perigo" id="tirar-nota">Tirar arquivo</button>' : ''}</div>` : ''}
        ${podeSalvar ? `<input type="file" name="nf_arquivo" accept="${ACEITOS_NOTA}" aria-label="Arquivo da nota">
        <div class="fraco">${l.nf_caminho ? 'Escolher outro arquivo troca o atual.' : 'Depois de emitir, baixe o PDF da nota e anexe aqui (PDF ou foto, até 5 MB).'}</div>` : ''}</div>` : ''}
      <div class="campo inteiro"><label>Observações</label><textarea name="observacoes" maxlength="2000" ${dis}>${esc(l.observacoes)}</textarea></div>
    </form><div class="erro" id="erro-lancamento"></div>`,
    rodape: `${podeApagar ? '<button class="botao perigo" id="apagar-lancamento">Apagar</button>' : ''}<span class="espaco"></span>
      ${podeSalvar ? '<button class="botao primario" id="salvar-lancamento">Salvar</button>' : ''}`,
  });

  const form = $('#form-lancamento', el);
  form.addEventListener('submit', (e) => { e.preventDefault(); $('#salvar-lancamento', el)?.click(); });
  form.tipo.addEventListener('change', () => {
    $('#rotulo-pago', el).textContent = form.tipo.value === 'entrada' ? 'Já recebi este dinheiro' : 'Já paguei esta conta';
  });
  // Escolher o projeto preenche o cliente dele.
  form.projeto_id?.addEventListener('change', () => {
    const p = ctx.projeto(form.projeto_id.value);
    if (p?.cliente_id) form.cliente_id.value = p.cliente_id;
  });

  $('#salvar-lancamento', el)?.addEventListener('click', async () => {
    const erro = $('#erro-lancamento', el);
    erro.textContent = '';
    if (!form.reportValidity()) return;
    const valor = lerValor(form.valor.value);
    if (!(valor > 0) || valor >= 1e9) { erro.textContent = 'Confira o valor: use só números, como 1.250,00.'; form.valor.focus(); return; }
    const dados = {
      tipo: form.tipo.value, valor, descricao: form.descricao.value.trim(), categoria: form.categoria.value.trim(),
      data: form.data.value, pago: form.pago.checked, observacoes: form.observacoes.value.trim(),
    };
    if (empresa) {
      dados.cliente_id = form.cliente_id.value || null; dados.projeto_id = form.projeto_id.value || null;
      dados.nf_numero = form.nf_numero.value.trim();
    }
    // Arquivo da nota: o banco só aceita o envio para o caminho já registrado no lançamento.
    const arquivo = empresa ? form.nf_arquivo?.files?.[0] : null;
    const id = novo ? novoIdAnexo() : l.id;
    let nota = null;
    try {
      if (arquivo) {
        const { tipo, ext } = conferirNota(arquivo);
        nota = { tipo, arquivo, caminho: `${id}/${novoIdAnexo()}.${ext}` };
        Object.assign(dados, { nf_caminho: nota.caminho, nf_nome: arquivo.name.slice(0, 255) });
      }
      if (novo) await ctx.db().inserir('lancamentos', { ...dados, id, escopo: l.escopo });
      else await ctx.db().atualizar('lancamentos', l.id, dados);
      if (nota) {
        try { await ctx.db().enviarArquivoNota(nota.caminho, nota.arquivo, nota.tipo); } catch (err) {
          // O envio falhou: o lançamento volta para a nota que tinha antes.
          await ctx.db().atualizar('lancamentos', id, { nf_caminho: novo ? null : l.nf_caminho ?? null, nf_nome: novo ? '' : l.nf_nome ?? '' }).catch(() => {});
          throw new Error(`O lançamento foi salvo, mas o arquivo da nota não foi enviado: ${err.message}`);
        }
        if (!novo && l.nf_caminho) await ctx.db().apagarArquivoNota(l.nf_caminho).catch(() => {});
      }
      // Lançamento de outro mês: a tela vai para o mês dele, para a pessoa ver onde ficou.
      tela.mes = dados.data.slice(0, 7);
      fechar(); avisar(novo ? 'Lançamento salvo' : 'Lançamento atualizado'); await depois();
    } catch (err) { erro.textContent = err.message; }
  });
  // Link da nota guardada: vale por 1 hora.
  if (l.nf_caminho) {
    ctx.db().linkNota(l.nf_caminho).then((url) => { const a = $('#ver-nota', el); if (a && url) a.href = url; }).catch(() => {});
  }
  $('#tirar-nota', el)?.addEventListener('click', async (e) => {
    if (e.target.dataset.confirmar !== 'sim') { e.target.dataset.confirmar = 'sim'; e.target.textContent = 'Clique de novo para tirar'; return; }
    try {
      await ctx.db().apagarArquivoNota(l.nf_caminho);
      await ctx.db().atualizar('lancamentos', l.id, { nf_caminho: null, nf_nome: '' });
      l.nf_caminho = null; l.nf_nome = '';
      $('#arquivo-nota', el)?.remove(); avisar('Arquivo da nota retirado'); await depois();
    } catch (err) { avisar(err.message); }
  });
  $('#apagar-lancamento', el)?.addEventListener('click', async (e) => {
    if (e.target.dataset.confirmar !== 'sim') { e.target.dataset.confirmar = 'sim'; e.target.textContent = 'Clique de novo para apagar'; return; }
    try { await ctx.db().apagar('lancamentos', l.id); fechar(); avisar('Lançamento apagado'); await depois(); } catch (err) { avisar(err.message); }
  });
}
