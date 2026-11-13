// Tabela de preços e textos padrão do orçamento da LOOK. Mesma tabela do
// gerador avulso (look/orcamentos/fonte/orcamento.html): ao mudar um preço lá,
// mude aqui também. valor: 0 = "sob consulta" (digita no orçamento).
// "mensal: true" soma num total mensal separado.
export const TABELA = {
  "Vídeo": [
    {d:"Vídeo curto (Reels / TikTok)", det:"Até 60 s. Roteiro, captação, edição e legenda.", u:"vídeo", valor:450},
    {d:"Edição de vídeo", det:"Até 60 s, com material enviado pelo cliente.", u:"vídeo", valor:200},
    {d:"Produção audiovisual completa", det:"Roteiro, captação e edição de uma peça.", u:"projeto", valor:800},
    {d:"Vídeo institucional", det:"Até 3 min. Roteiro, captação em até 1 diária, edição, trilha e cor.", u:"vídeo", valor:2500},
    {d:"Diária de captação", det:"Até 8 h de gravação com equipamento LOOK.", u:"diária", valor:1200},
    {d:"Meia diária de captação", det:"Até 4 h de gravação com equipamento LOOK.", u:"meia diária", valor:700},
    {d:"Cobertura de evento", det:"Captação no evento + vídeo resumo de até 90 s.", u:"evento", valor:1800},
    {d:"Vinheta / animação de logo", det:"Motion de até 10 s para abrir e fechar vídeos.", u:"vinheta", valor:600},
    {d:"Legenda em vídeo", det:"Legenda sincronizada no padrão do cliente.", u:"vídeo", valor:80}
  ],
  "Artes": [
    {d:"Post para feed", det:"Arte única no formato do Instagram.", u:"arte", valor:80},
    {d:"Carrossel", det:"Até 5 lâminas.", u:"carrossel", valor:180},
    {d:"Arte para stories", det:"Formato 1080 x 1920.", u:"arte", valor:50},
    {d:"Capa de Reels", det:"Capa no padrão do perfil.", u:"capa", valor:40},
    {d:"Flyer digital", det:"Para redes sociais e WhatsApp.", u:"arte", valor:120},
    {d:"Flyer impresso (arte)", det:"Arte pronta para gráfica, A5 ou A4.", u:"arte", valor:150},
    {d:"Banner / faixa (arte)", det:"Arte pronta para gráfica no tamanho pedido.", u:"arte", valor:200},
    {d:"Cardápio (arte)", det:"Valor por página.", u:"página", valor:150}
  ],
  "Papelaria e impressos": [
    {d:"Cartão de visita (arte)", det:"Frente e verso, arquivo pronto para gráfica.", u:"modelo", valor:180},
    {d:"Impressão de cartão de visita", det:"Repasse da gráfica. Quantidade e papel a combinar.", u:"lote", valor:0},
    {d:"Papel timbrado", det:"Arquivo para Word e para impressão.", u:"modelo", valor:120},
    {d:"Assinatura de e-mail", det:"Com logo, contatos e ícones, instalada no e-mail.", u:"assinatura", valor:150},
    {d:"Adesivo / etiqueta (arte)", det:"Arte pronta para gráfica.", u:"arte", valor:120}
  ],
  "Marca": [
    {d:"Criação de logotipo", det:"Até 3 propostas e 2 rodadas de ajuste. Arquivos em vetor e PNG.", u:"projeto", valor:1500},
    {d:"Identidade visual", det:"Logo, paleta de cores, tipografia e aplicações principais.", u:"projeto", valor:3000},
    {d:"Manual da marca", det:"Regras de uso do logo, cores, fontes e exemplos.", u:"projeto", valor:1200},
    {d:"Vetorização de logo", det:"Redesenho em vetor de um logo existente.", u:"logo", valor:150}
  ],
  "Sites": [
    {d:"Landing page", det:"Página única com domínio, formulário e botão de WhatsApp.", u:"site", valor:1800},
    {d:"Site institucional", det:"Até 5 páginas.", u:"site", valor:3500}
  ],
  "Planos mensais": [
    {d:"Plano Inicial", det:"Conteúdo mensal para redes sociais.", u:"mês", valor:1599.99, mensal:true},
    {d:"Plano Essencial", det:"Conteúdo mensal ampliado para redes sociais.", u:"mês", valor:2399.99, mensal:true}
  ]
};

export const TEXTOS_PADRAO = {
  intro: 'Obrigado pela conversa. Abaixo está o orçamento com o que combinamos, item por item.',
  pagamento: 'Pix, transferência, boleto ou cartão de crédito parcelado em até 3x.\nÀ vista: 50% na aprovação e 50% na entrega.',
  prazo: 'Início após a aprovação do orçamento e do pagamento da entrada. Prazo combinado por item.',
  revisoes: 'Até 2 rodadas de ajuste por peça.',
  incluso: 'Arquivos finais em alta qualidade.',
  naoIncluso: 'Impressão, mídia paga, deslocamento fora de Ourinhos e licenças de terceiros, a não ser que estejam listados acima.',
  obs: '',
  validadeDias: 15,
  desconto: 0,
  descontoTipo: 'pct',
  mostrarAceite: true,
  responsavel: 'Pablo Caetano · LOOK',
  cnpj: '',
  contatoLook: '(14) 99733-2120 · contato@lookexperience.com.br · lookexperience.com.br · @look.experience',
};

export function itemDaTabela(cat, i, q = 1) {
  const t = TABELA[cat][i];
  return { cat, d: t.d, det: t.det, u: t.u, q, valor: t.valor, mensal: !!t.mensal };
}

// "2 vídeos", "3 meses", "2 meias diárias"...
export function plural(u, q) {
  if (!u || q <= 1) return u || '';
  const m = { 'mês': 'meses', 'meia diária': 'meias diárias', 'un.': 'un.', carrossel: 'carrosséis', papel: 'papéis' };
  if (m[u]) return m[u];
  if (/[aeiouáéíóú]$/i.test(u)) return `${u}s`;
  if (/[rz]$/i.test(u)) return `${u}es`;
  if (/m$/.test(u)) return `${u.slice(0, -1)}ns`;
  return u;
}

// Total único e mensal, com o desconto (em % vale para os dois; em R$ sai do
// único, ou do mensal se não houver único).
export function totaisOrcamento(E) {
  let unico = 0; let mensal = 0;
  for (const it of E.itens ?? []) { const t = (+it.q || 0) * (+it.valor || 0); if (it.mensal) mensal += t; else unico += t; }
  const pct = E.descontoTipo === 'pct';
  const desc = (v) => (pct ? (v * (+E.desconto || 0)) / 100 : Math.min(v, +E.desconto || 0));
  const du = desc(unico);
  const dm = pct ? desc(mensal) : (unico ? 0 : desc(mensal));
  const r = (v) => Math.round(v * 100) / 100;
  return { unico: r(unico), mensal: r(mensal), du: r(du), dm: r(dm), fu: r(unico - du), fm: r(mensal - dm) };
}
