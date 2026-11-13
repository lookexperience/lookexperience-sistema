// Testes das telas: simula cada tipo de usuário usando o sistema no modo
// demonstração, num navegador de verdade (Chromium via Playwright).
// Uso: node testes/telas.mjs   (precisa do pacote "playwright")
// Cada linha "OK" ou "FALHOU" é um teste. Capturas de tela vão para testes/capturas/.

import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_PATH ?? 'playwright');

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const CAPTURAS = join(RAIZ, 'testes', 'capturas');
await mkdir(CAPTURAS, { recursive: true });

// ---------- Servidor local das telas ----------
// Envia os mesmos cabeçalhos de segurança do Netlify (netlify.toml), para os
// testes rodarem sob as mesmas regras do site no ar.
const CABECALHOS = Object.fromEntries([...(await readFile(join(RAIZ, 'netlify.toml'), 'utf8'))
  .matchAll(/^\s*([A-Z][A-Za-z-]+) = "(.*)"\s*$/gm)].map((m) => [m[1], m[2]]));
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2' };
const servidor = createServer(async (req, res) => {
  const caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try {
    const arquivo = join(RAIZ, caminho === '/' ? 'index.html' : caminho);
    const conteudo = await readFile(arquivo);
    res.writeHead(200, { ...CABECALHOS, 'content-type': TIPOS[extname(arquivo)] ?? 'application/octet-stream' });
    res.end(conteudo);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((ok) => servidor.listen(0, ok));
const BASE = `http://localhost:${servidor.address().port}/`;

// ---------- Mini estrutura de testes ----------
const resultados = [];
let errosDaPagina = [];
async function teste(nome, fn) {
  errosDaPagina = [];
  try {
    await fn();
    if (errosDaPagina.length) throw new Error(`erro no navegador: ${errosDaPagina.join(' | ')}`);
    resultados.push({ ok: true, nome });
  } catch (err) {
    resultados.push({ ok: false, nome, detalhe: err.message.split('\n')[0] });
  }
}
function confere(cond, msg) { if (!cond) throw new Error(msg); }
const igual = (a, b, msg) => confere(JSON.stringify(a) === JSON.stringify(b), `${msg}: esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`);

const navegador = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 2000 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
const p = await contexto.newPage();
p.on('pageerror', (e) => errosDaPagina.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errosDaPagina.push(m.text()); });
p.setDefaultTimeout(5000);

// ---------- Ajudantes ----------
const ir = async (rota) => { await p.goto(`${BASE}#/${rota}`); await p.waitForSelector('#pagina > *'); await p.waitForTimeout(80); };
const comoUsuario = async (id) => { await p.selectOption('#usuario-demo', id); await p.waitForTimeout(250); };
const menu = () => p.locator('.menu a[href]').allTextContents();
const cartoes = (status) => p.locator(`.coluna[data-status=${status}] .cartao .titulo`).allTextContents();
const fecharModal = async () => { await p.keyboard.press('Escape'); await p.waitForTimeout(80); };
const clicarApagar = async (seletor) => { await p.click(seletor); await p.click(seletor); await p.waitForTimeout(250); };
const textoToast = async () => (await p.locator('.aviso-flutuante').last().textContent().catch(() => '')) ?? '';
const marcarResponsaveis = async (ids) => {
  for (const caixa of await p.locator('[name=responsaveis]').all()) await caixa.setChecked(ids.includes(await caixa.getAttribute('value')));
};
async function novaTarefa(campos) {
  await p.click('#nova');
  await p.waitForSelector('#form-tarefa');
  await p.fill('[name=titulo]', campos.titulo);
  if (campos.cliente) await p.selectOption('[name=cliente_id]', { label: campos.cliente });
  if (campos.projeto) await p.selectOption('[name=projeto_id]', { label: campos.projeto });
  for (const k of ['setor', 'tipo', 'status', 'prioridade']) if (campos[k]) await p.selectOption(`[name=${k}]`, campos[k]);
  if (campos.responsaveis) await marcarResponsaveis(campos.responsaveis);
  if (campos.prazo) await p.fill('[name=prazo]', campos.prazo);
  await p.click('#salvar-tarefa');
  await p.waitForTimeout(250);
}
// Data local (AAAA-MM-DD). Dias somados podem cair no mês seguinte, então
// os testes de calendário usam o dia de hoje.
const hojeMais = (dias) => {
  const d = new Date(); d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// =====================================================================
// Início: dados de exemplo do zero
// =====================================================================
await p.goto(BASE);
await p.waitForSelector('.menu');
await p.evaluate(() => localStorage.clear());
await p.reload();
await p.waitForSelector('.menu');

// =====================================================================
// ADMINISTRADOR
// =====================================================================
await teste('Site envia a política de segurança (CSP) do Netlify', async () => {
  const r = await p.request.get(BASE);
  confere((r.headers()['content-security-policy'] ?? '').includes("script-src 'self'"), 'CSP ausente');
});

await teste('Admin: sistema abre e mostra o menu completo', async () => {
  igual(await menu(), ['Visão geral', 'Atividades', 'Calendário', 'Clientes', 'Projetos', 'Orçamentos', 'Finanças', 'Apresentações', 'Equipe e acessos'], 'menu');
});

for (const rota of ['visao-geral', 'atividades', 'calendario', 'clientes', 'projetos', 'financas', 'apresentacoes', 'equipe', 'sobre']) {
  await teste(`Admin: tela "${rota}" abre sem erro`, async () => {
    await ir(rota);
    confere(!(await p.locator('#pagina .erro').count()), 'apareceu mensagem de erro');
    await p.screenshot({ path: join(CAPTURAS, `admin-${rota}.png`) });
  });
}

await teste('Admin: endereço que não existe volta para a Visão geral', async () => {
  await p.goto(`${BASE}#/nao-existe`); await p.waitForTimeout(200);
  confere(await p.locator('h1', { hasText: 'Bom trabalho' }).count(), 'não abriu a visão geral');
});

await teste('Admin: cliente sem nome não é salvo', async () => {
  await ir('clientes');
  const antes = await p.locator('tr[data-id]').count();
  await p.click('#novo'); await p.click('#salvar'); await p.waitForTimeout(150);
  confere(await p.locator('.modal').count(), 'a janela fechou sem nome');
  await fecharModal();
  igual(await p.locator('tr[data-id]').count(), antes, 'quantidade de clientes');
});

await teste('Admin: cria cliente com cor', async () => {
  await ir('clientes');
  await p.click('#novo');
  await p.fill('[name=nome]', 'Padaria Teste');
  await p.fill('[name=instagram]', '@padariateste');
  await p.click('.modal .amostra[data-cor="#6F9A5B"]');
  await p.click('#salvar'); await p.waitForTimeout(200);
  confere(await p.locator('tr[data-id]', { hasText: 'Padaria Teste' }).count(), 'cliente não apareceu na lista');
});

await teste('Admin: cria projeto de dentro da ficha do cliente', async () => {
  await p.click('tr[data-id]:has-text("Padaria Teste")');
  await p.click('#novo-projeto');
  igual(await p.locator('[name=cliente_id] option:checked').textContent(), 'Padaria Teste', 'cliente já escolhido');
  await p.fill('[name=nome]', 'Cardápio novo');
  await p.click('#salvar'); await p.waitForTimeout(250);
  confere(await p.locator('.modal [data-projeto]', { hasText: 'Cardápio novo' }).count(), 'projeto não apareceu na ficha');
  await fecharModal();
});

// ---------- Briefing do cliente ----------
let linkDoBriefing = '';
const cliente = await contexto.newPage();
cliente.on('pageerror', (e) => errosDaPagina.push(e.message));
cliente.on('console', (m) => { if (m.type() === 'error') errosDaPagina.push(m.text()); });
cliente.setDefaultTimeout(5000);

await teste('Projeto novo de cliente começa com "Briefing pendente"', async () => {
  await ir('projetos');
  confere((await p.locator('tr[data-id]', { hasText: 'Cardápio novo' }).textContent()).includes('Briefing pendente'), 'sem o alerta na lista');
  confere(!(await p.locator('tr[data-id=p-lotus]').textContent()).includes('Briefing pendente'), 'projeto antigo ficou pendente');
});

await teste('Admin: gera link de briefing na janela do projeto', async () => {
  await p.click('tr[data-id]:has-text("Cardápio novo")');
  await p.waitForSelector('#gerar-briefing');
  confere((await p.locator('.briefings .alerta-briefing').textContent()).includes('ainda não tem o briefing'), 'sem alerta no projeto');
  await p.selectOption('#modelo-briefing', 'marca');
  await p.click('#gerar-briefing');
  await p.waitForSelector('.briefing-item .link-briefing');
  linkDoBriefing = await p.locator('.briefing-item .link-briefing').inputValue();
  confere(/\/briefing\.html#[0-9a-f]{64}$/.test(linkDoBriefing), `link estranho: ${linkDoBriefing}`);
  confere((await p.locator('.briefings .alerta-briefing').textContent()).includes('ainda não respondeu'), 'alerta não mudou');
  await fecharModal();
});

await teste('Cliente: abre o link e vê o briefing com o nome dele', async () => {
  await cliente.goto(linkDoBriefing);
  await cliente.waitForSelector('#form-briefing');
  confere((await cliente.textContent('h1')).includes('Briefing de marca'), 'título');
  igual((await cliente.textContent('.sobre')).trim(), 'Padaria Teste', 'cliente');
  confere(await cliente.locator('.secao').count() > 5, 'seções não apareceram');
});

await teste('Cliente: sem as respostas obrigatórias o briefing não é enviado', async () => {
  await cliente.click('#enviar-briefing'); await cliente.waitForTimeout(150);
  confere((await cliente.textContent('#erro-briefing')).includes('obrigatória'), 'sem aviso');
  igual(await cliente.locator('.questao.faltando').count(), 3, 'perguntas marcadas');
});

await teste('Cliente: o que já foi digitado continua lá ao abrir de novo', async () => {
  await cliente.fill('[name=s1p1]', 'Padaria do Bairro');
  await cliente.reload(); await cliente.waitForSelector('#form-briefing');
  igual(await cliente.inputValue('[name=s1p1]'), 'Padaria do Bairro', 'rascunho');
});

await teste('Cliente: preenche e envia o briefing', async () => {
  await cliente.fill('[name=s1p2]', 'Dona Rosa');
  await cliente.fill('[name=s1p3]', 'rosa@padaria.com · (14) 99999-0000');
  await cliente.check('[name=s1p7][value="Marca nova"]');
  await cliente.fill('[name=s2p1]', '<img src=x onerror="window.__xssBriefing=1">Pão quentinho');
  await cliente.click('#enviar-briefing');
  await cliente.waitForSelector('h1:has-text("Briefing enviado")');
});

await teste('Cliente: link já respondido não abre o formulário de novo', async () => {
  await cliente.reload(); await cliente.waitForTimeout(300);
  confere((await cliente.textContent('h1')).includes('já enviado'), 'formulário abriu de novo');
});

await teste('Cliente: link incompleto mostra explicação', async () => {
  await cliente.goto(`${BASE}briefing.html#abc123`); await cliente.waitForTimeout(300);
  confere((await cliente.textContent('h1')).includes('Link incompleto'), 'sem explicação');
});

await teste('Admin: recebe aviso, o projeto sai de pendente e as respostas aparecem', async () => {
  await p.reload(); await ir('projetos');
  confere(!(await p.locator('tr[data-id]', { hasText: 'Cardápio novo' }).textContent()).includes('Briefing pendente'), 'continua pendente');
  await p.click('#abrir-avisos');
  await p.click('.caixa-avisos .aviso:has-text("Briefing recebido: Padaria Teste · Cardápio novo")');
  await p.waitForSelector('[data-ver-respostas]');
  await p.click('[data-ver-respostas]'); await p.waitForTimeout(150);
  const texto = await p.locator('.respostas-briefing').textContent();
  confere(texto.includes('Dona Rosa') && texto.includes('Marca nova'), 'respostas não aparecem');
  confere(texto.includes('<img src=x'), 'código do cliente não aparece como texto');
  confere(!(await p.evaluate(() => window.__xssBriefing)), 'código do cliente rodou');
  await fecharModal(); await fecharModal();
});

await teste('Projeto com briefing pendente mostra alerta no cartão e na tarefa (sem travar)', async () => {
  await ir('projetos');
  await p.click('tr[data-id=p-lotus]');
  await p.selectOption('[name=briefing]', 'aguardando');
  await p.click('#salvar'); await p.waitForTimeout(250);
  await ir('atividades');
  confere(await p.locator('.cartao:has-text("Editar 3 reels") .briefing-pendente').count(), 'cartão sem alerta');
  await p.click('.cartao:has-text("Editar 3 reels")');
  confere(await p.locator('#alerta-briefing').count(), 'tarefa sem alerta');
  await p.fill('[name=titulo]', 'Editar 3 reels de lançamento');
  await p.click('#salvar-tarefa'); await p.waitForTimeout(200);
  confere(!(await p.locator('.modal').count()), 'tarefa não salvou');
  await ir('projetos');
  await p.click('tr[data-id=p-lotus]');
  await p.selectOption('[name=briefing]', 'dispensado');
  await p.click('#salvar'); await p.waitForTimeout(250);
});

await teste('Admin: tarefa com cliente exige escolher um projeto', async () => {
  await ir('atividades');
  await p.click('#nova');
  await p.fill('[name=titulo]', 'Sem projeto escolhido');
  await p.selectOption('[name=cliente_id]', { label: 'Lotus Games' });
  await p.selectOption('[name=projeto_id]', '');
  await p.click('#salvar-tarefa'); await p.waitForTimeout(150);
  confere(await p.locator('.modal').count(), 'salvou sem projeto');
  await fecharModal();
});

await teste('Admin: cliente sem projeto mostra o aviso na tarefa', async () => {
  await ir('clientes');
  await p.click('#novo'); await p.fill('[name=nome]', 'Cliente Vazio'); await p.click('#salvar'); await p.waitForTimeout(200);
  await ir('atividades');
  await p.click('#nova');
  await p.selectOption('[name=cliente_id]', { label: 'Cliente Vazio' });
  confere((await p.textContent('#aviso-projeto')).includes('ainda não tem projeto'), 'aviso não apareceu');
  await fecharModal();
});

await teste('Admin: cria tarefa escolhendo cliente e projeto', async () => {
  await ir('atividades');
  await novaTarefa({ titulo: 'Fotos do cardápio', cliente: 'Padaria Teste', projeto: 'Cardápio novo', setor: 'execucao', responsaveis: ['u-marina'], prazo: hojeMais(0) });
  confere((await cartoes('a_fazer')).includes('Fotos do cardápio'), 'tarefa não está em A fazer');
});

await teste('Admin: tarefa nova aparece no calendário e na visão geral', async () => {
  await ir('calendario');
  confere(await p.locator('.evento', { hasText: 'Fotos do cardápio' }).count(), 'não está no calendário');
  await ir('visao-geral');
  confere(await p.locator('.item', { hasText: 'Fotos do cardápio' }).count(), 'não está nos próximos 14 dias');
});

await teste('Admin: edita o título de uma tarefa', async () => {
  await ir('atividades');
  await p.click('.cartao:has-text("Fotos do cardápio")');
  await p.fill('[name=titulo]', 'Fotos do cardápio (pães)');
  await p.click('#salvar-tarefa'); await p.waitForTimeout(200);
  confere((await cartoes('a_fazer')).includes('Fotos do cardápio (pães)'), 'título não mudou');
});

await teste('Admin: comenta com @Marina e ela recebe aviso', async () => {
  await p.click('.cartao:has-text("Fotos do cardápio (pães)")');
  await p.fill('#texto-comentario', 'Capricha na luz @Marina');
  await p.click('#enviar-comentario'); await p.waitForTimeout(200);
  confere(await p.locator('.comentario', { hasText: 'Capricha na luz' }).count(), 'comentário não apareceu');
  confere(await p.locator('.comentario .mencao', { hasText: '@Marina' }).count(), 'menção não destacada');
  await fecharModal();
});

await teste('Tarefa nova já vem com quem está criando marcado como responsável', async () => {
  await ir('atividades');
  await p.click('#nova'); await p.waitForSelector('#form-tarefa');
  igual(await p.locator('[name=responsaveis]:checked').evaluateAll((cs) => cs.map((c) => c.value)), ['u-pablo'], 'marcados');
  await fecharModal();
});

await teste('Admin: coloca duas pessoas na mesma tarefa e o cartão mostra as duas', async () => {
  await p.click('.cartao:has-text("Fotos do cardápio (pães)")');
  await marcarResponsaveis(['u-marina', 'u-rafa']);
  await p.click('#salvar-tarefa'); await p.waitForTimeout(200);
  const cartao = p.locator('.cartao', { hasText: 'Fotos do cardápio (pães)' });
  igual(await cartao.locator('.avatar').count(), 2, 'quantidade de avatares');
  const dica = await cartao.locator('.avatares').getAttribute('title');
  confere(dica.includes('Marina') && dica.includes('Rafa'), `nomes no cartão: ${dica}`);
  await p.click('.cartao:has-text("Fotos do cardápio (pães)")');
  igual(await p.locator('[name=responsaveis]:checked').evaluateAll((cs) => cs.map((c) => c.value)), ['u-marina', 'u-rafa'], 'marcados ao abrir de novo');
  await fecharModal();
});

await teste('Admin: filtro de pessoa acha a tarefa por qualquer um dos responsáveis', async () => {
  await p.selectOption('#f-responsavel', 'u-rafa'); await p.waitForTimeout(150);
  confere((await p.locator('.cartao .titulo').allTextContents()).includes('Fotos do cardápio (pães)'), 'filtro do Rafa não achou');
  await p.selectOption('#f-responsavel', 'u-marina'); await p.waitForTimeout(150);
  confere((await p.locator('.cartao .titulo').allTextContents()).includes('Fotos do cardápio (pães)'), 'filtro da Marina não achou');
  await p.selectOption('#f-responsavel', ''); await p.waitForTimeout(150);
});

await teste('Admin: comentário vazio não é enviado', async () => {
  await p.click('.cartao:has-text("Fotos do cardápio (pães)")');
  const antes = await p.locator('.comentario').count();
  await p.fill('#texto-comentario', '   ');
  await p.click('#enviar-comentario'); await p.waitForTimeout(150);
  igual(await p.locator('.comentario').count(), antes, 'quantidade de comentários');
  await fecharModal();
});

await teste('Admin: arrasta cartão para Fazendo (com a busca ligada)', async () => {
  // A busca deixa o cartão no topo da coluna, sem precisar rolar a página durante o arraste.
  await p.fill('#f-busca', 'Fotos do cardápio'); await p.waitForTimeout(120);
  await p.dragAndDrop('.cartao:has-text("Fotos do cardápio (pães)")', '.coluna[data-status=fazendo]');
  await p.waitForTimeout(250);
  await p.fill('#f-busca', ''); await p.waitForTimeout(120);
  confere((await cartoes('fazendo')).includes('Fotos do cardápio (pães)'), 'não mudou de coluna');
});

await teste('Admin: reordena cartões dentro da coluna e a ordem fica salva', async () => {
  const antes = await cartoes('a_fazer');
  const terceiro = p.locator('.coluna[data-status=a_fazer] .cartao').nth(2);
  const primeiro = p.locator('.coluna[data-status=a_fazer] .cartao').nth(0);
  const a = await terceiro.boundingBox(); const b = await primeiro.boundingBox();
  await p.mouse.move(a.x + 40, a.y + 15); await p.mouse.down();
  await p.mouse.move(b.x + 40, b.y + 4, { steps: 12 }); await p.mouse.up();
  await p.waitForTimeout(250);
  await ir('atividades');
  igual((await cartoes('a_fazer'))[0], antes[2], 'primeiro cartão depois de recarregar');
});

await teste('Admin: busca e filtros do quadro', async () => {
  await ir('atividades');
  await p.fill('#f-busca', 'cardápio'); await p.waitForTimeout(120);
  igual(await p.locator('.cartao').count(), 1, 'cartões com a busca');
  await p.fill('#f-busca', ''); await p.waitForTimeout(80);
  await p.selectOption('#f-cliente', { label: 'Flambé' }); await p.waitForTimeout(120);
  const titulos = await p.locator('.cartao .cliente').allTextContents();
  confere(titulos.length && titulos.every((t) => t.startsWith('Flambé')), `filtro de cliente trouxe outros: ${titulos}`);
  const opcoesProjeto = await p.locator('#f-projeto option').allTextContents();
  igual(opcoesProjeto, ['Todos os projetos', 'Identidade visual'], 'projetos do filtro');
  await p.selectOption('#f-cliente', ''); await p.waitForTimeout(80);
  await p.selectOption('#f-setor', 'comercial'); await p.waitForTimeout(80);
  confere((await p.locator('.cartao .etiqueta').allTextContents()).filter((t) => /Criação|Execução/.test(t)).length === 0, 'setor errado no filtro');
  await p.selectOption('#f-setor', '');
});

await teste('Admin: postagem nova vai para a Agenda de postagens (e não para a da equipe)', async () => {
  await ir('calendario');
  await p.click('[data-aba=postagens]');
  await p.click('#nova');
  igual(await p.inputValue('[name=tipo]'), 'post', 'tipo já escolhido');
  await p.fill('[name=titulo]', 'Post: pão de fermentação natural');
  await p.selectOption('[name=cliente_id]', { label: 'Padaria Teste' });
  await p.fill('[name=prazo]', hojeMais(0));
  await p.click('#salvar-tarefa'); await p.waitForTimeout(250);
  confere(await p.locator('.evento.post', { hasText: 'pão de fermentação' }).count(), 'não apareceu nas postagens');
  await p.click('[data-aba=equipe]'); await p.waitForTimeout(100);
  confere(!(await p.locator('.evento', { hasText: 'pão de fermentação' }).count()), 'apareceu também na agenda da equipe');
});

await teste('Admin: filtro de cliente na agenda de postagens', async () => {
  await p.click('[data-aba=postagens]');
  await p.selectOption('#f-cliente', { label: 'Padaria Teste' }); await p.waitForTimeout(120);
  const eventos = await p.locator('.evento.post small').allTextContents();
  await p.selectOption('#f-cliente', '');
  confere(eventos.length && eventos.every((e) => e.includes('Padaria Teste')), `veio post de outro cliente: ${eventos}`);
  await p.screenshot({ path: join(CAPTURAS, 'admin-postagens.png') });
});

await teste('Admin: navega entre meses no calendário', async () => {
  const mes = await p.textContent('#titulo-mes');
  await p.click('#proximo'); await p.waitForTimeout(80);
  confere((await p.textContent('#titulo-mes')) !== mes, 'mês não mudou');
  await p.click('#hoje'); await p.waitForTimeout(80);
  igual(await p.textContent('#titulo-mes'), mes, 'botão Hoje');
});

await teste('Admin: muda a cor do cliente na janela de Projetos', async () => {
  await ir('projetos');
  await p.click('[data-mudar-cor=c-flambe]');
  await p.click('[data-paleta-de=c-flambe] .amostra[data-cor="#7A6BB5"]'); await p.waitForTimeout(200);
  const cor = await p.locator('.janela-cliente', { hasText: 'Flambé' }).evaluate((e) => getComputedStyle(e).borderLeftColor);
  igual(cor, 'rgb(122, 107, 181)', 'cor da janela');
});

await teste('Admin: projetos mostram as tarefas em lista e criam tarefa no projeto', async () => {
  confere(await p.locator('.janela-cliente:has-text("Padaria Teste") .tarefa-linha', { hasText: 'Fotos do cardápio' }).count(), 'tarefa não listada no projeto');
  await p.click('.janela-cliente:has-text("Padaria Teste") [data-nova-tarefa]');
  igual(await p.locator('[name=projeto_id] option:checked').textContent(), 'Cardápio novo', 'projeto já escolhido');
  await fecharModal();
});

await teste('Admin: recolher janela e lista de tarefas fica lembrado', async () => {
  await p.click('[data-recolher="c:c-ketlin"]');
  await p.click('[data-recolher="p:p-lotus"]');
  await ir('projetos');
  confere(await p.locator('[data-janela="c:c-ketlin"].recolhida').count(), 'janela não ficou recolhida');
  confere(await p.locator('tr.sub.oculto[data-alvo="p:p-lotus"]').count(), 'tarefas do projeto não ficaram recolhidas');
  await p.click('#abrir-tudo');
  igual(await p.locator('.janela-cliente.recolhida').count(), 0, 'janelas recolhidas depois de Abrir tudo');
});

await teste('Admin: texto com código malicioso no título não é executado', async () => {
  await ir('atividades');
  await novaTarefa({ titulo: '<img src=x onerror="window.__invadido=1">Teste' });
  const invadido = await p.evaluate(() => window.__invadido);
  confere(!invadido, 'o código do título rodou');
  confere(await p.locator('.cartao .titulo', { hasText: '<img src=x' }).count(), 'título não apareceu como texto');
});

await teste('Admin: apaga tarefa (pede confirmação com segundo clique)', async () => {
  await p.click('.cartao:has-text("<img src=x")');
  await p.click('#apagar-tarefa'); await p.waitForTimeout(80);
  confere(await p.locator('.modal').count(), 'apagou no primeiro clique');
  await p.click('#apagar-tarefa'); await p.waitForTimeout(200);
  confere(!(await p.locator('.cartao', { hasText: '<img src=x' }).count()), 'tarefa não foi apagada');
});

// Imagem PNG mínima (1x1) para os testes de anexo.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const abrirProjetoLotus = async () => {
  await ir('projetos');
  await p.locator('tr[data-id=p-lotus]').click();
  await p.waitForSelector('#lista-anexos');
  await p.waitForTimeout(150);
};

await teste('Admin: anexa imagem e PDF ao projeto e eles aparecem na lista', async () => {
  await abrirProjetoLotus();
  confere((await p.locator('#lista-anexos').textContent()).includes('Nenhum anexo'), 'lista não começou vazia');
  await p.setInputFiles('#arquivos', [
    { name: 'Moodboard.png', mimeType: 'image/png', buffer: PNG },
    { name: 'Proposta Lotus.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 teste') },
  ]);
  await p.waitForSelector('.anexo >> nth=1');
  igual(await p.locator('.anexo .nome').allTextContents(), ['Moodboard.png', 'Proposta Lotus.pdf'], 'anexos');
  confere(await p.locator('.anexo').first().locator('.capa img').count(), 'imagem sem miniatura');
  igual(await p.locator('.anexo').nth(1).locator('.tipo-arquivo').textContent(), 'PDF', 'ícone do PDF');
  const baixar = await p.locator('.anexo').nth(1).locator('a[download]').getAttribute('download');
  igual(baixar, 'Proposta Lotus.pdf', 'nome do arquivo baixado');
  await fecharModal();
});

await teste('Admin: anexos continuam lá ao abrir o projeto de novo', async () => {
  await abrirProjetoLotus();
  igual(await p.locator('.anexo').count(), 2, 'anexos guardados');
  await fecharModal();
});

await teste('Ataque: arquivo de tipo proibido (página HTML, SVG, programa) não é anexado', async () => {
  await abrirProjetoLotus();
  await p.setInputFiles('#arquivos', [
    { name: 'pagina.html', mimeType: 'text/html', buffer: Buffer.from('<script>alert(1)</script>') },
    { name: 'logo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg onload="alert(1)"/>') },
    { name: 'programa.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('MZ') },
  ]);
  await p.waitForTimeout(300);
  igual(await p.locator('.anexo').count(), 2, 'anexos depois da tentativa');
  confere((await textoToast()).includes('não foi anexado'), 'sem aviso de tipo proibido');
  await fecharModal();
});

await teste('Ataque: nome de arquivo com código não é executado', async () => {
  await abrirProjetoLotus();
  await p.setInputFiles('#arquivos', [{ name: '<img src=x onerror="window.__xssAnexo=1">.png', mimeType: 'image/png', buffer: PNG }]);
  await p.waitForSelector('.anexo >> nth=2');
  confere(!(await p.evaluate(() => window.__xssAnexo)), 'código do nome do arquivo rodou');
  confere((await p.locator('.anexo .nome').nth(2).textContent()).startsWith('<img'), 'nome não aparece como texto');
  await fecharModal();
});

await teste('Admin: apaga anexo (pede confirmação com segundo clique)', async () => {
  await abrirProjetoLotus();
  const botao = p.locator('.anexo').nth(2).locator('[data-apagar-anexo]');
  await botao.click(); await p.waitForTimeout(100);
  igual(await p.locator('.anexo').count(), 3, 'apagou no primeiro clique');
  await botao.click(); await p.waitForTimeout(250);
  igual(await p.locator('.anexo').count(), 2, 'anexos depois de apagar');
  await fecharModal();
});

await teste('Projeto novo avisa que os anexos entram depois de salvar', async () => {
  await ir('projetos');
  await p.click('#novo');
  confere(!(await p.locator('#arquivos').count()), 'projeto novo já mostra anexar');
  confere((await p.locator('.modal').textContent()).includes('Depois de salvar o projeto'), 'sem o aviso');
  await fecharModal();
});

await teste('Admin: apagar projeto mantém as tarefas, sem projeto', async () => {
  await ir('projetos');
  await p.click('tr[data-id]:has-text("Cardápio novo")');
  await clicarApagar('#apagar');
  await ir('atividades');
  const cartao = p.locator('.cartao', { hasText: 'Fotos do cardápio' });
  confere(await cartao.count(), 'a tarefa sumiu junto');
  igual((await cartao.locator('.cliente').textContent()).trim(), 'Interno', 'tarefa sem projeto');
  await cartao.click();
  igual(await p.inputValue('[name=projeto_id]'), '', 'projeto na janela da tarefa');
  await fecharModal();
});

await teste('Admin: apagar cliente mantém o projeto, que vai para Interno', async () => {
  await ir('clientes');
  await p.click('#novo'); await p.fill('[name=nome]', 'Cliente Temporário'); await p.click('#salvar'); await p.waitForTimeout(200);
  await p.click('tr[data-id]:has-text("Cliente Temporário")');
  await p.click('#novo-projeto'); await p.fill('[name=nome]', 'Projeto órfão'); await p.click('#salvar'); await p.waitForTimeout(250);
  await clicarApagar('.modal #apagar');
  await ir('projetos');
  confere(await p.locator('.janela-cliente:has-text("Interno") tr[data-id]', { hasText: 'Projeto órfão' }).count(), 'projeto não foi para Interno');
});

await teste('Admin: clicar no aviso abre a tarefa e marca como lido', async () => {
  await ir('visao-geral');
  const antes = Number((await p.textContent('#contador-avisos')).trim() || 0);
  confere(antes > 0, 'não havia aviso');
  await p.click('#abrir-avisos');
  await p.click('.caixa-avisos .aviso.novo >> nth=0'); await p.waitForTimeout(250);
  confere(await p.locator('.modal').count(), 'tarefa não abriu');
  await fecharModal();
  igual(Number((await p.textContent('#contador-avisos')).trim() || 0), antes - 1, 'contador de avisos');
});

await teste('Admin: não consegue tirar o próprio acesso de administrador', async () => {
  await ir('equipe');
  await p.click('tr[data-id=u-pablo]');
  confere(await p.locator('[name=admin]').isDisabled(), 'caixa de admin está liberada');
  confere(await p.locator('[name=ativo]').isDisabled(), 'caixa de conta ativa está liberada');
  await fecharModal();
});

await teste('Admin: marcar e desmarcar "Administrador" devolve as permissões de antes', async () => {
  await p.click('tr[data-id=u-rafa]');
  const antes = await p.locator('#matriz input[type=checkbox]:checked').count();
  await p.check('[name=admin]'); await p.uncheck('[name=admin]');
  igual(await p.locator('#matriz input[type=checkbox]:checked').count(), antes, 'permissões marcadas');
  await fecharModal();
});

await teste('Admin: libera a conta nova como Freelancer', async () => {
  await p.click('tr[data-id=u-novo]');
  await p.fill('[name=cargo]', 'Fotógrafo');
  await p.check('[name=setor][value=execucao]');
  await p.click('[data-pronto=Freelancer]');
  await p.click('#salvar'); await p.waitForTimeout(250);
  confere((await p.locator('tr[data-id=u-novo]').textContent()).includes('2 módulos'), 'acesso não aparece na lista');
});

await teste('Admin: troca a senha de acesso (Enter salva, sem pôr a senha no endereço)', async () => {
  await ir('equipe');
  await p.click('#mudar-senha-acesso');
  await p.fill('[name=nova]', 'abc');
  await p.click('#salvar-senha-acesso'); await p.waitForTimeout(150);
  confere(await p.locator('#form-senha-acesso').count(), 'aceitou senha de 3 letras');
  await p.fill('[name=nova]', 'Nova#2026');
  await p.press('[name=nova]', 'Enter'); await p.waitForTimeout(250);
  confere(!p.url().includes('Nova'), `senha foi para o endereço: ${p.url()}`);
  confere(!(await p.locator('#form-senha-acesso').count()), 'janela não fechou');
  confere((await textoToast()).includes('Senha de acesso trocada'), 'sem aviso de troca');
});

// =====================================================================
// GERENTE (Marina: setores criação e execução)
// =====================================================================
await comoUsuario('u-marina');

await teste('Gerente: menu sem Equipe e acessos', async () => {
  igual(await menu(), ['Visão geral', 'Atividades', 'Calendário', 'Clientes', 'Projetos', 'Finanças', 'Apresentações'], 'menu');
});

await teste('Gerente: recebeu o aviso da menção', async () => {
  confere(Number((await p.textContent('#contador-avisos')).trim() || 0) >= 1, 'sem aviso');
  await p.click('#abrir-avisos');
  confere(await p.locator('.caixa-avisos .aviso', { hasText: 'marcou você' }).count(), 'aviso da menção não está na lista');
  await p.click('h1');
});

await teste('Gerente: vê só tarefas de criação e execução (e as que criou ou recebeu)', async () => {
  await ir('atividades');
  const setores = await p.locator('.cartao').evaluateAll((cs) => cs.map((c) => c.querySelector('.etiqueta').textContent.trim()));
  const titulos = await p.locator('.cartao .titulo').allTextContents();
  confere(!titulos.includes('Contrato Lotus pelo gov.br'), 'viu tarefa comercial de outra pessoa');
  confere(setores.every((s) => s !== 'Comercial'), `viu setor comercial: ${setores}`);
});

await teste('Gerente: abrir endereço da Equipe vai para a Visão geral', async () => {
  await p.goto(`${BASE}#/equipe`); await p.waitForTimeout(200);
  confere(!(await p.locator('h1', { hasText: 'Quem usa o sistema' }).count()), 'abriu a tela de equipe');
});

await teste('Gerente: cria tarefa, mas não vê botão de apagar', async () => {
  await ir('atividades');
  await novaTarefa({ titulo: 'Roteiro do reels', setor: 'criacao' });
  confere((await cartoes('a_fazer')).includes('Roteiro do reels'), 'não criou');
  await p.click('.cartao:has-text("Roteiro do reels")');
  confere(!(await p.locator('#apagar-tarefa').count()), 'botão apagar apareceu');
  await fecharModal();
});

await teste('Gerente: clientes só para consulta (sem criar nem salvar)', async () => {
  await ir('clientes');
  confere(!(await p.locator('#novo').count()), 'botão de novo cliente apareceu');
  await p.click('tr[data-id] >> nth=0');
  confere(!(await p.locator('#salvar').count()), 'botão salvar apareceu');
  confere(await p.locator('[name=nome]').isDisabled(), 'campo nome editável');
  await fecharModal();
});

await teste('Gerente: anexa ao projeto e só apaga o anexo que ela mesma enviou', async () => {
  await abrirProjetoLotus();
  igual(await p.locator('.anexo [data-apagar-anexo]').count(), 0, 'botões de apagar em anexos do admin');
  await p.setInputFiles('#arquivos', [{ name: 'Referencia.jpg', mimeType: 'image/jpeg', buffer: PNG }]);
  await p.waitForSelector('.anexo >> nth=2');
  igual(await p.locator('.anexo [data-apagar-anexo]').count(), 1, 'botões de apagar depois de anexar');
  await fecharModal();
});

await teste('Gerente: cria projeto', async () => {
  await ir('projetos');
  await p.click('#novo');
  await p.fill('[name=nome]', 'Campanha de Natal');
  await p.selectOption('[name=cliente_id]', { label: 'Lotus Games' });
  await p.click('#salvar'); await p.waitForTimeout(200);
  confere(await p.locator('tr[data-id]', { hasText: 'Campanha de Natal' }).count(), 'projeto não apareceu');
});

// =====================================================================
// FREELANCER (Rafa: só as tarefas dele, sem editar)
// =====================================================================
await comoUsuario('u-rafa');

await teste('Freelancer: menu só com Visão geral, Atividades, Calendário, Finanças e Apresentações', async () => {
  igual(await menu(), ['Visão geral', 'Atividades', 'Calendário', 'Finanças', 'Apresentações'], 'menu');
});

await teste('Freelancer: vê só as tarefas dele', async () => {
  await ir('atividades');
  const titulos = (await p.locator('.cartao .titulo').allTextContents()).sort();
  igual(titulos, ['Editar 3 reels de lançamento', 'Fotos do cardápio (pães)', 'Gravação de produtos na loja'], 'tarefas');
  confere(!(await p.locator('#nova').count()), 'botão Nova tarefa apareceu');
});

await teste('Freelancer: recebeu aviso da tarefa em que entrou junto com outra pessoa', async () => {
  await p.click('#abrir-avisos');
  confere(await p.locator('.caixa-avisos .aviso', { hasText: 'Nova tarefa para você: Fotos do cardápio' }).count(), 'sem aviso da tarefa dividida');
  await p.click('h1');
});

await teste('Freelancer: na tarefa dividida não troca os responsáveis, só o status', async () => {
  await p.click('.cartao:has-text("Fotos do cardápio (pães)")');
  confere(await p.locator('[name=responsaveis]').first().isDisabled(), 'responsáveis editáveis');
  confere(!(await p.locator('[name=status]').isDisabled()), 'status bloqueado');
  await p.selectOption('[name=status]', 'fazendo');
  await p.click('#salvar-tarefa'); await p.waitForTimeout(200);
  confere((await cartoes('fazendo')).includes('Fotos do cardápio (pães)'), 'status não mudou');
  igual(await p.locator('.cartao', { hasText: 'Fotos do cardápio (pães)' }).locator('.avatar').count(), 2, 'responsáveis depois de salvar');
});

await teste('Freelancer: na tarefa só o status pode mudar', async () => {
  await p.click('.cartao:has-text("Editar 3 reels")');
  confere(await p.locator('[name=titulo]').isDisabled(), 'título editável');
  confere(await p.locator('[name=prazo]').isDisabled(), 'prazo editável');
  confere(!(await p.locator('[name=status]').isDisabled()), 'status bloqueado');
  await p.selectOption('[name=status]', 'em_aprovacao');
  await p.click('#salvar-tarefa'); await p.waitForTimeout(200);
  confere((await cartoes('em_aprovacao')).includes('Editar 3 reels de lançamento'), 'status não mudou');
});

await teste('Freelancer: comenta na própria tarefa', async () => {
  await p.click('.cartao:has-text("Editar 3 reels")');
  await p.fill('#texto-comentario', 'Primeira versão pronta @Pablo');
  await p.click('#enviar-comentario'); await p.waitForTimeout(200);
  confere(await p.locator('.comentario', { hasText: 'Primeira versão pronta' }).count(), 'comentário não apareceu');
  await fecharModal();
});

await teste('Freelancer: arrasta a própria tarefa', async () => {
  await p.dragAndDrop('.cartao:has-text("Gravação de produtos")', '.coluna[data-status=fazendo]');
  await p.waitForTimeout(250);
  confere((await cartoes('fazendo')).includes('Gravação de produtos na loja'), 'não mudou de coluna');
});

await teste('Freelancer: clicar num dia vazio do calendário não abre nada', async () => {
  await ir('calendario');
  await p.click('.dia >> nth=3'); await p.waitForTimeout(150);
  igual(await p.locator('.modal').count(), 0, 'janelas abertas');
});

// =====================================================================
// CONTA NOVA, CONTA LIBERADA, CONTA DESATIVADA
// =====================================================================
await teste('Conta liberada pelo admin entra no sistema', async () => {
  await comoUsuario('u-novo');
  igual(await menu(), ['Visão geral', 'Atividades', 'Calendário', 'Finanças', 'Apresentações'], 'menu');
});

await teste('Conta desativada vê "Conta desativada"', async () => {
  await comoUsuario('u-saiu');
  confere(await p.locator('h2', { hasText: 'Conta desativada' }).count(), 'mensagem não apareceu');
  confere(!(await p.locator('.menu').count()), 'menu apareceu');
  await p.screenshot({ path: join(CAPTURAS, 'conta-desativada.png') });
});

await teste('Admin desativa e reativa uma conta', async () => {
  await comoUsuario('u-pablo');
  await ir('equipe');
  await p.click('tr[data-id=u-marina]'); await p.uncheck('[name=ativo]'); await p.click('#salvar'); await p.waitForTimeout(200);
  await comoUsuario('u-marina');
  confere(await p.locator('h2', { hasText: 'Conta desativada' }).count(), 'Marina ainda entra');
  await comoUsuario('u-pablo');
  await ir('equipe');
  await p.click('tr[data-id=u-marina]'); await p.check('[name=ativo]'); await p.click('#salvar'); await p.waitForTimeout(200);
  await comoUsuario('u-marina');
  confere(await p.locator('.menu').count(), 'Marina não voltou a entrar');
});

await teste('Conta nova sem liberação vê "Aguardando liberação"', async () => {
  await comoUsuario('u-pablo');
  await p.click('#resetar-demo'); await p.waitForTimeout(300);
  await comoUsuario('u-novo');
  confere(await p.locator('h2', { hasText: 'Aguardando liberação' }).count(), 'mensagem não apareceu');
});

await teste('Tela de criar conta pede a senha de acesso da LOOK', async () => {
  await comoUsuario('u-pablo');
  // Sem ninguém logado (no modo demonstração não há botão Sair).
  await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('look-sistema-demo-v4')); d.usuarioAtual = null; localStorage.setItem('look-sistema-demo-v4', JSON.stringify(d)); });
  await p.reload(); await p.waitForSelector('#form-entrada');
  confere(!(await p.locator('[name=codigo]').count()), 'tela de entrar pede senha de acesso');
  await p.click('#trocar');
  const campo = p.locator('[name=codigo]');
  confere(await campo.count(), 'campo de senha de acesso não apareceu');
  confere(await campo.evaluate((e) => e.required && e.type === 'password'), 'campo não é obrigatório ou mostra a senha');
  await p.click('#trocar');
  await p.fill('[name=email]', 'contato@lookexperience.com.br'); await p.fill('[name=senha]', '123456');
  await p.click('#form-entrada button[type=submit]'); await p.waitForSelector('.menu');
});

// =====================================================================
// FINANÇAS: pessoal (só o dono) e empresa (permissão "financeiro")
// =====================================================================
const reais = async (sel) => ((await p.textContent(sel)) ?? '').replace(/\s/g, ' ').trim();

await teste('Finanças: aba pessoal mostra entradas, saídas e saldo do mês', async () => {
  await comoUsuario('u-pablo');
  await p.click('#resetar-demo'); await p.waitForTimeout(300);
  await ir('financas');
  igual(await p.locator('.aba.ativa').textContent(), 'Pessoal', 'aba aberta');
  confere((await p.textContent('.aviso-financas')).includes('Só você vê'), 'sem aviso de privacidade');
  igual(await reais('#total-entradas'), 'R$ 3.500,00', 'entradas');
  igual(await reais('#total-saidas'), 'R$ 1.840,50', 'saídas pagas');
  igual(await reais('#saldo-mes'), 'R$ 1.659,50', 'saldo');
  confere((await reais('#pendentes')).includes('R$ 180,00 a pagar'), 'conta a pagar não aparece');
  confere((await p.textContent('.painel')).includes('Mercado do mês'), 'lançamento não aparece');
  confere(!(await p.locator('tr', { hasText: 'Academia' }).count()), 'conta pessoal da Marina apareceu para o admin');
  await p.screenshot({ path: join(CAPTURAS, 'financas-pessoal.png') });
});

await teste('Finanças: lança uma saída digitando o valor com vírgula', async () => {
  await p.click('#nova-saida');
  await p.fill('[name=descricao]', 'Farmácia');
  await p.fill('[name=valor]', 'abc');
  await p.click('#salvar-lancamento');
  confere((await p.textContent('#erro-lancamento')).includes('Confira o valor'), 'valor errado foi aceito');
  await p.fill('[name=valor]', '45,90');
  await p.fill('[name=categoria]', 'Saúde');
  await p.click('#salvar-lancamento'); await p.waitForTimeout(200);
  igual(await p.locator('.modal').count(), 0, 'janela não fechou');
  igual(await reais('#saldo-mes'), 'R$ 1.613,60', 'saldo depois da saída');
  confere((await p.textContent('.categoria-gasto:has-text("Saúde")')).includes('45,90'), 'categoria não somou');
});

await teste('Finanças: marcar a conta como paga tira do "a pagar" e entra no saldo', async () => {
  await p.click('tr[data-id]:has-text("Conta de luz")');
  await p.check('[name=pago]');
  await p.click('#salvar-lancamento'); await p.waitForTimeout(200);
  igual(await p.locator('#pendentes').count(), 0, 'continua a pagar');
  igual(await reais('#saldo-mes'), 'R$ 1.433,60', 'saldo');
});

await teste('Finanças: setas trocam o mês', async () => {
  await p.click('#mes-antes'); await p.waitForTimeout(100);
  confere((await p.textContent('.vazio')).includes('Nenhum lançamento'), 'mês anterior não está vazio');
  igual(await reais('#saldo-acumulado'), 'R$ 0,00', 'acumulado do mês anterior');
  await p.click('#mes-hoje'); await p.waitForTimeout(100);
  igual(await reais('#saldo-mes'), 'R$ 1.433,60', 'voltou para este mês');
});

await teste('Finanças: aba Empresa mostra o caixa da LOOK com cliente e projeto', async () => {
  await p.click('[data-aba=empresa]'); await p.waitForTimeout(100);
  igual(await reais('#total-entradas'), 'R$ 2.500,00', 'entradas da empresa');
  confere((await p.textContent('tr:has-text("Rebranding Lotus")')).includes('Lotus Games'), 'cliente não aparece');
  confere((await reais('#pendentes')).includes('R$ 1.500,00 a receber'), 'a receber');
  confere(!(await p.locator('tr', { hasText: 'Aluguel' }).count()), 'conta pessoal apareceu no caixa da empresa');
  await p.click('#nova-entrada');
  await p.selectOption('[name=projeto_id]', 'p-fusion');
  igual(await p.inputValue('[name=cliente_id]'), 'c-fusion', 'projeto não preencheu o cliente');
  await fecharModal();
  await p.screenshot({ path: join(CAPTURAS, 'financas-empresa.png') });
});

await teste('Finanças: caixa da empresa tem atalho para o Emissor Nacional e marca entrada sem nota', async () => {
  igual(await p.getAttribute('#emitir-nf', 'href'), 'https://www.nfse.gov.br/EmissorNacional', 'link do emissor');
  igual(await p.getAttribute('#emitir-nf', 'target'), '_blank', 'abre em aba nova');
  confere(await p.locator('tr:has-text("Rebranding Lotus") .sem-nota').count(), 'entrada sem nota não marcada');
  confere(!(await p.locator('tr:has-text("Adobe") .sem-nota').count()), 'saída marcada como sem nota');
});

await teste('Finanças: arquivo que não é PDF nem foto não vira nota', async () => {
  await p.click('tr[data-id]:has-text("Rebranding Lotus")');
  await p.setInputFiles('[name=nf_arquivo]', { name: 'nota.txt', mimeType: 'text/plain', buffer: Buffer.from('x') });
  await p.click('#salvar-lancamento'); await p.waitForTimeout(150);
  confere((await p.textContent('#erro-lancamento')).includes('PDF ou uma foto'), 'arquivo errado foi aceito');
  await fecharModal();
});

await teste('Finanças: registra o número e o PDF da nota fiscal no lançamento', async () => {
  await p.click('tr[data-id]:has-text("Rebranding Lotus")');
  await p.fill('[name=nf_numero]', '2026/15');
  await p.setInputFiles('[name=nf_arquivo]', { name: 'nota-lotus.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 nota') });
  await p.click('#salvar-lancamento'); await p.waitForTimeout(250);
  igual(await p.locator('.modal').count(), 0, 'janela não fechou');
  confere((await p.textContent('tr:has-text("Rebranding Lotus")')).includes('NF 2026/15'), 'número da nota não aparece');
  confere(!(await p.locator('tr:has-text("Rebranding Lotus") .sem-nota').count()), 'continua "Sem nota"');
  await p.click('tr[data-id]:has-text("Rebranding Lotus")');
  await p.waitForFunction(() => document.querySelector('#ver-nota')?.href.startsWith('blob:'));
  igual((await p.textContent('#ver-nota')).trim(), 'nota-lotus.pdf', 'nome do arquivo');
  await p.click('#tirar-nota'); await p.click('#tirar-nota'); await p.waitForTimeout(250);
  await fecharModal();
  await p.click('tr[data-id]:has-text("Rebranding Lotus")');
  igual(await p.locator('#ver-nota').count(), 0, 'arquivo não saiu');
  igual(await p.inputValue('[name=nf_numero]'), '2026/15', 'número sumiu junto com o arquivo');
  await fecharModal();
});

await teste('Finanças: gerente sem permissão só vê a própria aba pessoal', async () => {
  await comoUsuario('u-marina');
  await ir('financas');
  igual(await p.locator('.aba').count(), 0, 'aba Empresa apareceu');
  confere(await p.locator('tr', { hasText: 'Academia' }).count(), 'não vê a própria conta');
  confere(!(await p.locator('tr', { hasText: 'Aluguel' }).count()), 'vê as contas pessoais do admin');
  confere(!(await p.textContent('#pagina')).includes('Rebranding Lotus'), 'vê o caixa da empresa');
});

await teste('Finanças: admin libera "Financeiro da empresa" só para ver', async () => {
  await comoUsuario('u-pablo');
  await ir('equipe');
  await p.click('tr[data-id=u-marina]');
  confere(await p.locator('tr[data-modulo=financeiro]', { hasText: 'Financeiro da empresa' }).count(), 'permissão não aparece na equipe');
  await p.check('tr[data-modulo=financeiro] [data-acao=ver]');
  await p.click('#salvar'); await p.waitForTimeout(200);
  await comoUsuario('u-marina');
  await ir('financas');
  await p.click('[data-aba=empresa]'); await p.waitForTimeout(100);
  confere((await p.textContent('#pagina')).includes('Rebranding Lotus'), 'não vê o caixa da empresa');
  igual(await p.locator('#nova-entrada').count(), 0, 'pode lançar só com "ver"');
  await p.click('tr[data-id]:has-text("Rebranding Lotus")');
  igual(await p.locator('#salvar-lancamento').count(), 0, 'pode salvar só com "ver"');
  await fecharModal();
  await p.click('[data-aba=pessoal]'); await p.waitForTimeout(100);
  confere(!(await p.locator('tr', { hasText: 'Aluguel' }).count()), 'ver a empresa mostrou as contas pessoais do admin');
  await comoUsuario('u-pablo');
});

// =====================================================================
// ORÇAMENTOS (permissão "comercial")
// =====================================================================
const ANO = String(new Date().getFullYear());

await teste('Orçamentos: lista mostra o orçamento de exemplo com status e total', async () => {
  await comoUsuario('u-pablo');
  await ir('orcamentos');
  const linha = p.locator('tr[data-id]', { hasText: `${ANO}-001` });
  confere(await linha.count(), 'orçamento de exemplo não aparece');
  confere((await linha.textContent()).includes('Enviado'), 'status não aparece');
  confere((await linha.textContent()).replace(/\s/g, ' ').includes('R$ 3.000,00 + R$ 1.599,99/mês'), 'total não aparece');
  await p.click('[data-filtro=aprovado]'); await p.waitForTimeout(80);
  igual(await p.locator('tr[data-id]').count(), 0, 'filtro de status não filtrou');
  await p.click('[data-filtro=todos]'); await p.waitForTimeout(80);
});

await teste('Orçamentos: novo orçamento com cliente, itens da tabela e desconto', async () => {
  await ir('orcamentos');
  await p.click('#novo-orcamento');
  await p.fill('[name=titulo]', 'Logo + conteúdo mensal');
  await p.selectOption('[name=cliente_id]', 'c-fusion');
  igual(await p.inputValue('[name=clienteEmpresa]'), 'Fusion Soldas', 'cliente não preencheu a empresa');
  await p.selectOption('#item-da-tabela', 'Marca|0'); await p.click('#add-item-tabela');
  await p.selectOption('#item-da-tabela', 'Planos mensais|0'); await p.click('#add-item-tabela');
  igual(await p.locator('.item-orc').count(), 2, 'itens não entraram');
  await p.fill('[name=desconto]', '10');
  igual(await reais('#orc-total-unico'), 'R$ 1.350,00', 'total único com desconto');
  igual(await reais('#orc-total-mensal'), 'R$ 1.439,99', 'total mensal com desconto');
  confere((await p.textContent('#folha-orc')).includes('Fusion Soldas'), 'cliente não aparece na folha');
  await p.click('#salvar-orcamento'); await p.waitForTimeout(150);
  igual((await p.textContent('h1')).trim(), `Orçamento ${ANO}-002`, 'número automático');
  confere((await p.textContent('#folha-orc')).includes(`Nº ${ANO}-002`), 'número não aparece na folha');
});

await teste('Orçamentos: "Gerar PDF" baixa o PDF com o número e o cliente no nome', async () => {
  const [baixado] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }), p.click('#pdf-orcamento')]);
  igual(baixado.suggestedFilename(), `Orcamento-LOOK-${ANO}-002-Fusion-Soldas.pdf`, 'nome do arquivo');
  const bytes = await readFile(await baixado.path());
  confere(bytes.subarray(0, 5).toString() === '%PDF-', 'não é PDF');
  confere(bytes.length > 20000, `PDF pequeno demais (${bytes.length} bytes): fontes não embutidas?`);
  confere(bytes.includes('Anton'), 'fonte Anton não está no PDF');
});

await teste('Orçamentos: aprovado vai para o Caixa da LOOK como "a receber"', async () => {
  igual(await p.locator('#lancar-orcamento').count(), 0, 'botão aparece antes de aprovar');
  await p.selectOption('[name=status]', 'aprovado');
  await p.click('#salvar-orcamento'); await p.waitForTimeout(150);
  await p.click('#lancar-orcamento'); await p.waitForTimeout(150);
  confere(await p.locator('#orc-no-caixa').count(), 'não avisou que está no caixa');
  await ir('financas');
  await p.click('[data-aba=empresa]'); await p.waitForTimeout(100);
  const linha = p.locator('tr[data-id]', { hasText: `Orçamento ${ANO}-002` });
  confere(await linha.count(), 'entrada não apareceu no caixa');
  confere((await linha.textContent()).includes('A receber'), 'entrada não ficou "a receber"');
  confere((await linha.textContent()).includes('1.350,00'), 'valor da entrada');
  confere((await linha.textContent()).includes('Fusion Soldas'), 'entrada sem o cliente');
  await p.click('[data-aba=pessoal]'); await p.waitForTimeout(80);
});

await teste('Orçamentos: duplicar ganha número novo e o original não muda', async () => {
  await ir('orcamentos');
  await p.click(`tr[data-id]:has-text("${ANO}-002")`);
  await p.click('#duplicar-orcamento');
  igual((await p.textContent('h1')).trim(), 'Novo orçamento', 'cópia não abriu');
  igual(await p.locator('.item-orc').count(), 2, 'cópia sem os itens');
  await p.fill('[name=titulo]', 'Logo + conteúdo (versão 2)');
  await p.click('#salvar-orcamento'); await p.waitForTimeout(150);
  igual((await p.textContent('h1')).trim(), `Orçamento ${ANO}-003`, 'número da cópia');
  await p.click('#voltar-orcamentos'); await p.waitForTimeout(80);
  confere((await p.textContent(`tr[data-id]:has-text("${ANO}-002")`)).includes('Aprovado'), 'original mudou');
});

await teste('Orçamentos: voltar com mudança sem salvar pede confirmação', async () => {
  await p.click(`tr[data-id]:has-text("${ANO}-003")`);
  await p.fill('[name=titulo]', 'Mudança que não vai ficar');
  await p.click('#voltar-orcamentos');
  confere(await p.locator('#form-orcamento').count(), 'saiu sem confirmar');
  await p.click('#voltar-orcamentos'); await p.waitForTimeout(80);
  confere(!(await p.textContent('#pagina')).includes('Mudança que não vai ficar'), 'mudança foi salva');
});

await teste('Orçamentos: texto com código não vira código na folha', async () => {
  await p.click('#novo-orcamento');
  await p.fill('[name=titulo]', '<img src=x data-xss onerror="window.__xss=1">');
  await p.fill('[name=clienteEmpresa]', '<script>window.__xss=1</script>');
  await p.waitForTimeout(100);
  const achados = await p.evaluate(() => document.querySelectorAll('#folha-orc [data-xss], #folha-orc script').length + (window.__xss ? 1 : 0));
  igual(achados, 0, 'elementos injetados');
  await p.click('#voltar-orcamentos'); await p.click('#voltar-orcamentos'); await p.waitForTimeout(80);
});

await teste('Orçamentos: com "Comercial" só para ver, gerente abre mas não muda', async () => {
  await ir('equipe');
  await p.click('tr[data-id=u-marina]');
  confere(await p.locator('tr[data-modulo=comercial]', { hasText: 'Comercial e orçamentos' }).count(), 'permissão não aparece na equipe');
  await p.check('tr[data-modulo=comercial] [data-acao=ver]');
  await p.click('#salvar'); await p.waitForTimeout(200);
  await comoUsuario('u-marina');
  confere((await menu()).includes('Orçamentos'), 'menu sem Orçamentos');
  await ir('orcamentos');
  igual(await p.locator('#novo-orcamento').count(), 0, 'pode criar só com "ver"');
  await p.click(`tr[data-id]:has-text("${ANO}-001")`);
  igual(await p.locator('#salvar-orcamento').count(), 0, 'pode salvar só com "ver"');
  confere(await p.locator('[name=titulo]').isDisabled(), 'campo editável só com "ver"');
  await p.click('#voltar-orcamentos'); await p.waitForTimeout(80);
  await comoUsuario('u-pablo');
  await ir('equipe');
  await p.click('tr[data-id=u-marina]');
  await p.uncheck('tr[data-modulo=comercial] [data-acao=ver]');
  await p.click('#salvar'); await p.waitForTimeout(200);
});

// =====================================================================
// CELULAR
// =====================================================================
await teste('Celular: telas cabem na largura (sem rolagem para o lado)', async () => {
  await comoUsuario('u-pablo');
  await p.setViewportSize({ width: 390, height: 844 });
  for (const rota of ['visao-geral', 'clientes', 'projetos', 'financas', 'orcamentos']) {
    await ir(rota);
    const sobra = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    confere(sobra <= 1, `${rota} passa ${sobra}px da tela`);
  }
  await p.screenshot({ path: join(CAPTURAS, 'celular.png') });
  await ir('orcamentos'); await p.click('tr[data-id]');
  const sobraEditor = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  confere(sobraEditor <= 1, `editor de orçamento passa ${sobraEditor}px da tela`);
  await p.screenshot({ path: join(CAPTURAS, 'celular-orcamento.png'), fullPage: true });
  await p.setViewportSize({ width: 1440, height: 2000 });
});

// =====================================================================
// ATAQUES: código malicioso escondido nos textos
// Alguém com acesso (ou uma conta nova, pelo próprio nome) grava HTML e
// JavaScript nos campos. Nenhuma tela pode executar esse código.
// =====================================================================
await teste('Ataque: código escondido em nomes, textos e cores não é executado em nenhuma tela', async () => {
  await comoUsuario('u-pablo');
  await p.click('#resetar-demo'); await p.waitForTimeout(300);
  await p.evaluate(() => {
    const isca = (onde) => `<img src=x data-xss="${onde}" onerror="window.__xss=(window.__xss||[]).concat('${onde}')">`;
    const fuga = (onde) => `"><img src=x data-xss="${onde}" onerror="window.__xss=(window.__xss||[]).concat('${onde}')">`;
    const dados = JSON.parse(localStorage.getItem('look-sistema-demo-v4'));
    const b = dados.banco;
    for (const pf of b.perfis) if (pf.id !== 'u-pablo') { pf.nome = `Rafa ${isca('perfil.nome')}${fuga('perfil.nome2')}`; pf.cargo = isca('perfil.cargo'); pf.email = fuga('perfil.email'); }
    for (const c of b.clientes) {
      c.nome = `Cliente ${isca('cliente.nome')}${fuga('cliente.nome2')}`; c.contato = isca('cliente.contato'); c.observacoes = isca('cliente.obs');
      c.instagram = fuga('cliente.insta'); c.email = fuga('cliente.email'); c.telefone = fuga('cliente.tel');
      c.cor = '#fff" data-xss="cliente.cor';
    }
    for (const pr of b.projetos) { pr.nome = `Projeto ${isca('projeto.nome')}${fuga('projeto.nome2')}`; pr.tipo = fuga('projeto.tipo'); pr.descricao = isca('projeto.desc'); }
    for (const t of b.tarefas) { t.titulo = `Tarefa ${isca('tarefa.titulo')}${fuga('tarefa.titulo2')}`; t.descricao = isca('tarefa.desc'); t.local = fuga('tarefa.local'); }
    for (const c of b.comentarios) c.texto = `@Rafa ${isca('comentario')}${fuga('comentario2')}`;
    for (const l of b.lancamentos) { l.descricao = `Conta ${isca('lancamento.desc')}${fuga('lancamento.desc2')}`; l.categoria = fuga('lancamento.cat'); l.observacoes = fuga('lancamento.obs'); }
    b.avisos.push({ id: 'a-xss', usuario_id: 'u-pablo', texto: isca('aviso'), tarefa_id: b.tarefas[0].id, lido: false, criado_em: new Date().toISOString() });
    localStorage.setItem('look-sistema-demo-v4', JSON.stringify(dados));
  });
  await p.reload(); await p.waitForSelector('.menu');
  const injetados = () => p.evaluate(() => [...document.querySelectorAll('[data-xss]')].map((e) => e.getAttribute('data-xss')).concat(window.__xss ?? []));
  const achados = new Set();
  const anotar = async () => (await injetados()).forEach((x) => achados.add(x));
  for (const rota of ['visao-geral', 'atividades', 'calendario', 'clientes', 'projetos', 'financas', 'apresentacoes', 'equipe', 'sobre']) {
    await ir(rota); await anotar();
  }
  await ir('calendario'); await p.click('[data-aba=postagens]'); await anotar();
  await ir('atividades'); await p.locator('.cartao').first().click(); await p.waitForTimeout(150); await anotar(); await fecharModal();
  await ir('clientes'); await p.locator('tr[data-id]').first().click(); await p.waitForTimeout(150); await anotar(); await fecharModal();
  await ir('projetos'); await p.locator('tr[data-id]').first().click(); await p.waitForTimeout(150); await anotar(); await fecharModal();
  await ir('equipe'); await p.locator('tr[data-id=u-rafa]').click(); await p.waitForTimeout(150); await anotar(); await fecharModal();
  await ir('financas'); await p.locator('tr[data-id]').first().click(); await p.waitForTimeout(150); await anotar(); await fecharModal();
  await p.click('[data-aba=empresa]'); await anotar(); await p.locator('tr[data-id]').first().click(); await p.waitForTimeout(150); await anotar(); await fecharModal();
  await p.click('#abrir-avisos'); await p.waitForTimeout(150); await anotar();
  for (const usuario of ['u-marina', 'u-rafa', 'u-novo']) { await comoUsuario(usuario); await anotar(); }
  await comoUsuario('u-pablo');
  // Imagens com src=x quebradas geram erro no console; aqui só importa se o código rodou.
  errosDaPagina = errosDaPagina.filter((e) => !/Failed to load resource/.test(e));
  igual([...achados].sort(), [], 'código injetado apareceu ou rodou em');
});

// ---------- Apresentações (Word vira slides) ----------
await teste('Apresentações: o modelo de Word vira slides no padrão LOOK', async () => {
  await comoUsuario('u-pablo');
  await ir('apresentacoes');
  await p.setInputFiles('#lk-arquivo', join(RAIZ, 'modelos', 'modelo-apresentacao-look.docx'));
  await p.waitForSelector('#lk-grade .lk-slide');
  await p.waitForTimeout(300);
  const tipos = await p.$$eval('#lk-grade .lk-slide', (els) => els.map((e) => e.className.replace('lk-slide ', '')));
  igual(tipos.length, 14, 'quantidade de slides');
  confere(tipos[0] === 'lk-capa' && tipos[tipos.length - 1] === 'lk-fim', 'capa no começo e Obrigado no fim');
  confere(await p.locator('#lk-grade .lk-cartoes').count() === 2, 'tabelas pequenas viram cartões');
  confere(await p.locator('#lk-grade .lk-etapas .lk-etapa').count() === 5, 'etapas 01 | ... viram 5 cartões');
  confere(await p.locator('#lk-grade .lk-aceite .lk-campo').count() === 3, 'aceite com 3 linhas para assinar');
  confere(await p.locator('#lk-grade .lk-notas').count() >= 1, 'notas guardadas fora do slide');
  // Nada passa da borda do slide.
  const vazando = await p.$$eval('#lk-grade .lk-corpo', (els) => els.filter((e) => e.scrollHeight > e.clientHeight + 2).length);
  igual(vazando, 0, 'slides com texto cortado');
  await p.screenshot({ path: join(CAPTURAS, 'apresentacoes.png') });
  // Modo apresentação abre, anda com a seta e fecha com o botão.
  await p.evaluate(() => { Element.prototype.requestFullscreen = () => Promise.resolve(); });
  await p.click('#lk-apresentar');
  await p.keyboard.press('ArrowRight');
  igual(await p.locator('.lk-palco .lk-slide.lk-ativo').evaluate((e) => [...e.parentNode.querySelectorAll('.lk-slide')].indexOf(e)), 1, 'slide depois da seta');
  await p.click('.lk-fechar');
  igual(await p.locator('.lk-palco').count(), 0, 'modo apresentação fechado');
});

await teste('Apresentações: arquivo que não é Word mostra aviso', async () => {
  await ir('apresentacoes');
  await p.setInputFiles('#lk-arquivo', { name: 'texto.doc', mimeType: 'application/msword', buffer: Buffer.from('x') });
  confere((await p.textContent('#lk-erro')).includes('.docx'), 'aviso de formato antigo');
  await p.setInputFiles('#lk-arquivo', { name: 'falso.docx', mimeType: 'application/octet-stream', buffer: Buffer.from('não é zip') });
  await p.waitForFunction(() => document.querySelector('#lk-erro').textContent.length > 0);
});

await teste('Apresentações: código escondido no Word não roda', async () => {
  await ir('apresentacoes');
  await p.setInputFiles('#lk-arquivo', join(RAIZ, 'testes', 'apresentacao-ataque.docx'));
  await p.waitForSelector('#lk-grade .lk-slide');
  await p.evaluate(() => { Element.prototype.requestFullscreen = () => Promise.resolve(); });
  await p.click('#lk-apresentar'); await p.keyboard.press('n'); await p.waitForTimeout(150);
  const achados = await p.evaluate(() => [...document.querySelectorAll('[data-xss], script:not([src]), svg[onload], img[onerror]')].length + (window.__xss ? 1 : 0));
  await p.click('.lk-fechar');
  igual(achados, 0, 'elementos injetados');
});

// ---------- Resultado ----------
await navegador.close();
servidor.close();
for (const r of resultados) console.log(`${r.ok ? 'OK    ' : 'FALHOU'}  ${r.nome}${r.detalhe ? `  →  ${r.detalhe}` : ''}`);
const falhas = resultados.filter((r) => !r.ok).length;
console.log(`\n${resultados.length - falhas} passaram, ${falhas} falharam`);
process.exit(falhas ? 1 : 0);
