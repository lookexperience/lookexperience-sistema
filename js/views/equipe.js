import { MODULOS, SETORES, nomeDe } from '../config.js';
import { esc, $, $$, iniciais, avisar } from '../util.js';
import { abrirModal } from './modal.js';

const ACOES = [['ver', 'Ver'], ['criar', 'Criar'], ['editar', 'Editar'], ['apagar', 'Apagar']];

// Modelos prontos para preencher as permissões com um clique.
const PERFIS_PRONTOS = {
  Gerente: { visao_geral: 'vcea', tarefas: 'vcea:setor', clientes: 'vce', projetos: 'vce', comercial: 'vce', criacao: 'vce', execucao: 'vce', materiais: 'vce', equipamentos: 'vce', horas: 'v' },
  'Funcionário': { visao_geral: 'v', tarefas: 'vce:setor', clientes: 'v', projetos: 'v', criacao: 'vc', execucao: 'vc', materiais: 'v', equipamentos: 'v' },
  Freelancer: { visao_geral: 'v', tarefas: 'v:proprias' },
  'Sem acesso': {},
};

export async function render(el, ctx) {
  const { estado } = ctx;
  const souAdmin = estado.sessao.perfil.admin;
  const todas = await ctx.db().listar('permissoes');
  const resumo = (p) => {
    if (!p.ativo) return '<span class="etiqueta urgente">Desativado</span>';
    if (p.admin) return '<span class="etiqueta" style="color:var(--latao);border-color:var(--latao)">Administrador</span>';
    // Só o administrador enxerga as permissões dos outros.
    if (!souAdmin && p.id !== estado.sessao.perfil.id) return '<span class="fraco">—</span>';
    const n = todas.filter((x) => x.usuario_id === p.id && x.ver).length;
    return n ? `<span class="etiqueta">${n} módulo${n > 1 ? 's' : ''}</span>` : '<span class="etiqueta">Aguardando liberação</span>';
  };
  const linhas = [...estado.perfis].sort((a, b) => Number(b.admin) - Number(a.admin) || a.nome.localeCompare(b.nome)).map((p) => `
    <tr class="clicavel" data-id="${p.id}">
      <td style="display:flex;gap:10px;align-items:center"><span class="avatar">${esc(iniciais(p.nome))}</span><div><b>${esc(p.nome)}</b><div class="fraco">${esc(p.email)}</div></div></td>
      <td>${esc(p.cargo) || '<span class="fraco">—</span>'}</td>
      <td>${p.setores.map((s) => `<span class="etiqueta"><span class="ponto ${s}"></span>${nomeDe(SETORES, s)}</span>`).join(' ') || '<span class="fraco">—</span>'}</td>
      <td>${resumo(p)}</td></tr>`).join('');

  el.innerHTML = `
    <div class="cabecalho"><div><div class="sobre">Equipe e acessos</div><h1>Quem usa o sistema</h1></div></div>
    <div class="painel" style="margin-bottom:18px"><p class="mudo" style="margin:0">
      <b>Para colocar alguém novo:</b> mande o endereço do sistema para a pessoa. Ela clica em "Criar conta" e aparece aqui como "Aguardando liberação".
      ${souAdmin ? 'Clique no nome dela e marque o que ela pode ver e fazer.' : 'Só o administrador muda as permissões.'}
      As permissões ficam guardadas no banco de dados, por usuário.</p></div>
    <div class="painel"><table class="tabela"><thead><tr><th>Pessoa</th><th>Cargo</th><th>Setores</th><th>Acesso</th></tr></thead><tbody>${linhas}</tbody></table></div>`;
  $$('tr[data-id]', el).forEach((tr) => tr.addEventListener('click', () => abrirPessoa(ctx, estado.perfis.find((p) => p.id === tr.dataset.id), todas)));
}

function matriz(permissoes, admin, bloqueado) {
  const porModulo = Object.fromEntries(permissoes.map((p) => [p.modulo, p]));
  return `<table class="tabela permissoes"><thead><tr><th>Módulo</th>${ACOES.map(([, n]) => `<th>${n}</th>`).join('')}<th>Quais tarefas</th></tr></thead><tbody>
    ${MODULOS.map((m) => {
      const p = porModulo[m.chave] ?? {};
      return `<tr data-modulo="${m.chave}"><td>${m.nome}${m.fase > 1 ? ` <span class="fraco">(fase ${m.fase})</span>` : ''}</td>
        ${ACOES.map(([a]) => `<td><input type="checkbox" data-acao="${a}" ${admin || p[a] ? 'checked' : ''} ${bloqueado || admin ? 'disabled' : ''}></td>`).join('')}
        <td>${m.chave === 'tarefas' ? `<select data-escopo ${bloqueado || admin ? 'disabled' : ''}>
          ${[['proprias', 'Só as dele'], ['setor', 'As dos setores dele'], ['todas', 'Todas']].map(([v, n]) => `<option value="${v}" ${(admin ? 'todas' : p.escopo ?? 'proprias') === v ? 'selected' : ''}>${n}</option>`).join('')}</select>` : ''}</td></tr>`;
    }).join('')}</tbody></table>`;
}

function abrirPessoa(ctx, pessoa, todas) {
  const souAdmin = ctx.estado.sessao.perfil.admin;
  const souEu = pessoa.id === ctx.estado.sessao.perfil.id;
  const dis = souAdmin ? '' : 'disabled';
  const permissoes = todas.filter((p) => p.usuario_id === pessoa.id);
  const { el, fechar } = abrirModal({
    titulo: esc(pessoa.nome),
    largo: true,
    corpo: `<form class="grade-campos" id="form-pessoa">
      <div class="campo"><label>Nome</label><input type="text" name="nome" maxlength="120" value="${esc(pessoa.nome)}" ${dis}></div>
      <div class="campo"><label>Cargo</label><input type="text" name="cargo" maxlength="120" value="${esc(pessoa.cargo)}" placeholder="Gerente, designer, editor..." ${dis}></div>
      <div class="campo"><label>Setores</label><div style="display:flex;gap:16px;padding:8px 0">${SETORES.map((s) => `<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" name="setor" value="${s.chave}" ${pessoa.setores.includes(s.chave) ? 'checked' : ''} ${dis}> ${s.nome}</label>`).join('')}</div></div>
      <div class="campo"><label>Situação</label><div style="display:flex;gap:16px;padding:8px 0">
        <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" name="ativo" ${pessoa.ativo ? 'checked' : ''} ${dis} ${souEu ? 'disabled' : ''}> Conta ativa</label>
        <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" name="admin" ${pessoa.admin ? 'checked' : ''} ${dis} ${souEu ? 'disabled' : ''}> Administrador</label></div></div>
    </form>
    <h3 style="margin:22px 0 8px">Permissões</h3>
    ${souAdmin ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><span class="fraco" style="align-self:center">Preencher como:</span>${Object.keys(PERFIS_PRONTOS).map((n) => `<button class="botao pequeno" data-pronto="${n}">${n}</button>`).join('')}</div>` : ''}
    <div id="matriz">${souAdmin || souEu ? matriz(permissoes, pessoa.admin, !souAdmin) : '<p class="fraco">Só o administrador vê as permissões de outras pessoas.</p>'}</div>
    <p class="fraco">Administrador vê e pode tudo. Módulos das próximas fases já podem ser liberados; passam a valer quando as telas chegarem.</p>`,
    rodape: souAdmin ? '<span class="fraco">Para tirar alguém do sistema, desmarque "Conta ativa".</span><span class="espaco"></span><button class="botao primario" id="salvar">Salvar</button>' : '',
  });

  $$('[data-pronto]', el).forEach((b) => b.addEventListener('click', () => {
    const modelo = PERFIS_PRONTOS[b.dataset.pronto];
    $$('#matriz tr[data-modulo]', el).forEach((tr) => {
      const [letras = '', escopo] = (modelo[tr.dataset.modulo] ?? '').split(':');
      const mapa = { ver: 'v', criar: 'c', editar: 'e', apagar: 'a' };
      $$('input[data-acao]', tr).forEach((cb) => { cb.checked = letras.includes(mapa[cb.dataset.acao]); });
      const sel = $('[data-escopo]', tr);
      if (sel) sel.value = escopo ?? 'proprias';
    });
  }));

  // Marcar "Administrador" mostra tudo liberado; desmarcar volta às permissões de antes.
  let antesDeAdmin = permissoes;
  $('#form-pessoa [name=admin]', el)?.addEventListener('change', (e) => {
    if (e.target.checked) antesDeAdmin = lerMatriz(el);
    $('#matriz', el).innerHTML = matriz(antesDeAdmin, e.target.checked, false);
  });

  $('#salvar', el)?.addEventListener('click', async () => {
    const form = $('#form-pessoa', el);
    const dados = {
      nome: form.nome.value.trim(), cargo: form.cargo.value.trim(),
      setores: $$('[name=setor]:checked', form).map((c) => c.value),
      ativo: souEu ? true : form.ativo.checked, admin: souEu ? true : form.admin.checked,
    };
    try {
      await ctx.db().atualizar('perfis', pessoa.id, dados);
      if (!dados.admin) await ctx.db().salvarPermissoes(pessoa.id, lerMatriz(el));
      fechar(); avisar('Acessos salvos'); await ctx.recarregar();
    } catch (err) { avisar(err.message); }
  });

}

function lerMatriz(el) {
  return $$('#matriz tr[data-modulo]', el).map((tr) => {
    const linha = { modulo: tr.dataset.modulo, escopo: $('[data-escopo]', tr)?.value ?? 'proprias' };
    $$('input[data-acao]', tr).forEach((cb) => { linha[cb.dataset.acao] = cb.checked; });
    return linha;
  });
}
