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
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2' };
const servidor = createServer(async (req, res) => {
  const caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try {
    const arquivo = join(RAIZ, caminho === '/' ? 'index.html' : caminho);
    res.writeHead(200, { 'content-type': TIPOS[extname(arquivo)] ?? 'application/octet-stream' });
    res.end(await readFile(arquivo));
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
async function novaTarefa(campos) {
  await p.click('#nova');
  await p.waitForSelector('#form-tarefa');
  await p.fill('[name=titulo]', campos.titulo);
  if (campos.cliente) await p.selectOption('[name=cliente_id]', { label: campos.cliente });
  if (campos.projeto) await p.selectOption('[name=projeto_id]', { label: campos.projeto });
  for (const k of ['setor', 'tipo', 'status', 'prioridade', 'responsavel_id']) if (campos[k]) await p.selectOption(`[name=${k}]`, campos[k]);
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
await teste('Admin: sistema abre e mostra o menu completo', async () => {
  igual(await menu(), ['Visão geral', 'Atividades', 'Calendário', 'Clientes', 'Projetos', 'Equipe e acessos'], 'menu');
});

for (const rota of ['visao-geral', 'atividades', 'calendario', 'clientes', 'projetos', 'equipe', 'sobre']) {
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
  await novaTarefa({ titulo: 'Fotos do cardápio', cliente: 'Padaria Teste', projeto: 'Cardápio novo', setor: 'execucao', responsavel_id: 'u-marina', prazo: hojeMais(0) });
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

// =====================================================================
// GERENTE (Marina: setores criação e execução)
// =====================================================================
await comoUsuario('u-marina');

await teste('Gerente: menu sem Equipe e acessos', async () => {
  igual(await menu(), ['Visão geral', 'Atividades', 'Calendário', 'Clientes', 'Projetos'], 'menu');
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

await teste('Freelancer: menu só com Visão geral, Atividades e Calendário', async () => {
  igual(await menu(), ['Visão geral', 'Atividades', 'Calendário'], 'menu');
});

await teste('Freelancer: vê só as tarefas dele', async () => {
  await ir('atividades');
  const titulos = (await p.locator('.cartao .titulo').allTextContents()).sort();
  igual(titulos, ['Editar 3 reels de lançamento', 'Gravação de produtos na loja'], 'tarefas');
  confere(!(await p.locator('#nova').count()), 'botão Nova tarefa apareceu');
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
  igual(await menu(), ['Visão geral', 'Atividades', 'Calendário'], 'menu');
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

// =====================================================================
// CELULAR
// =====================================================================
await teste('Celular: telas cabem na largura (sem rolagem para o lado)', async () => {
  await comoUsuario('u-pablo');
  await p.setViewportSize({ width: 390, height: 844 });
  for (const rota of ['visao-geral', 'clientes', 'projetos']) {
    await ir(rota);
    const sobra = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    confere(sobra <= 1, `${rota} passa ${sobra}px da tela`);
  }
  await p.screenshot({ path: join(CAPTURAS, 'celular.png') });
  await p.setViewportSize({ width: 1440, height: 2000 });
});

// ---------- Resultado ----------
await navegador.close();
servidor.close();
for (const r of resultados) console.log(`${r.ok ? 'OK    ' : 'FALHOU'}  ${r.nome}${r.detalhe ? `  →  ${r.detalhe}` : ''}`);
const falhas = resultados.filter((r) => !r.ok).length;
console.log(`\n${resultados.length - falhas} passaram, ${falhas} falharam`);
process.exit(falhas ? 1 : 0);
