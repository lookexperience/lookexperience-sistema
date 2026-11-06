// Modelos de briefing da LOOK (marca e programa ao vivo), feitos a partir
// dos briefings oficiais. Cada pergunta tem um "id" (seção e número) que
// identifica a resposta. Ao gerar um link, o sistema guarda uma cópia do
// modelo no briefing: mudar este arquivo não mexe nos que já foram enviados.
// Tipos: texto_curto, paragrafo, data, escala_1_5 (com rótulos),
// escolha_unica e multipla_escolha (com opções; permite_outro abre um campo).
export const MODELOS_BRIEFING = {
 "marca": {
  "id": "marca",
  "titulo": "Briefing de marca — LOOK",
  "descricao": "Este briefing reúne o que a LOOK precisa saber da sua marca antes de desenhar logo, cores, tipografia e conteúdo. Leva de 30 a 45 minutos. Respostas curtas e honestas valem mais que respostas bonitas. O que ainda não estiver decidido pode ficar em branco: conversamos sobre isso na reunião de kickoff.\n\nLOOK Direção de Marca e Conteúdo · contato@lookexperience.com.br",
  "secoes": [
   {
    "titulo": "Dados do cliente",
    "ajuda": null,
    "perguntas": [
     {
      "tipo": "texto_curto",
      "pergunta": "Nome da marca / empresa",
      "obrigatoria": true,
      "id": "s1p1"
     },
     {
      "tipo": "texto_curto",
      "pergunta": "Responsável pela aprovação",
      "obrigatoria": true,
      "id": "s1p2"
     },
     {
      "tipo": "texto_curto",
      "pergunta": "Contato (e-mail e WhatsApp)",
      "obrigatoria": true,
      "id": "s1p3"
     },
     {
      "tipo": "texto_curto",
      "pergunta": "Site e redes atuais",
      "id": "s1p4"
     },
     {
      "tipo": "texto_curto",
      "pergunta": "Segmento e cidade de atuação",
      "id": "s1p5"
     },
     {
      "tipo": "texto_curto",
      "pergunta": "Tempo de mercado",
      "id": "s1p6"
     },
     {
      "tipo": "escolha_unica",
      "pergunta": "Marca nova ou reposicionamento?",
      "opcoes": [
       "Marca nova",
       "Reposicionamento de uma marca que já existe"
      ],
      "id": "s1p7"
     }
    ]
   },
   {
    "titulo": "1. Essência da marca",
    "ajuda": "A essência define por que a marca existe além de vender. Tudo o que for desenhado depois volta a estas respostas.",
    "perguntas": [
     {
      "tipo": "paragrafo",
      "pergunta": "Por que a marca existe? Que problema ou desejo ela resolve para as pessoas?",
      "id": "s2p1"
     },
     {
      "tipo": "texto_curto",
      "pergunta": "Em uma frase, o que você faz e para quem?",
      "id": "s2p2"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Qual é a história de origem? Quem fundou, por quê e em que momento?",
      "id": "s2p3"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Qual é a missão hoje (o que vocês entregam todos os dias)?",
      "id": "s2p4"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Onde a marca estará em 5 anos? Tamanho, mercados, reputação, produtos novos, equipe.",
      "id": "s2p5"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Como o cliente deve se sentir ao terminar o primeiro contato com a marca?",
      "id": "s2p6"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Se a marca desaparecesse amanhã, o que as pessoas sentiriam falta?",
      "id": "s2p7"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Qual é a maior conquista da marca até aqui?",
      "id": "s2p8"
     }
    ]
   },
   {
    "titulo": "2. Posicionamento",
    "ajuda": "Posicionar é escolher o lugar que a marca ocupa na cabeça do público em relação aos concorrentes.",
    "perguntas": [
     {
      "tipo": "paragrafo",
      "pergunta": "Quem é o cliente ideal? Idade, renda, cidade, comportamento, o que consome e onde passa o tempo.",
      "id": "s3p1"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Quem NÃO é cliente (e está tudo bem não ser)?",
      "id": "s3p2"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Quais são os 3 principais concorrentes, diretos e indiretos? O que fazem bem e mal?",
      "id": "s3p3"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Qual é o diferencial real, aquilo que o cliente não encontra no concorrente?",
      "id": "s3p4"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Complete: \"Somos a marca de ___ para quem ___, diferente de ___ porque ___.\"",
      "id": "s3p5"
     },
     {
      "tipo": "multipla_escolha",
      "pergunta": "A marca quer ser percebida como (escolha até 2):",
      "opcoes": [
       "Acessível",
       "Premium",
       "De luxo",
       "Popular",
       "Técnica",
       "Jovem",
       "Tradicional"
      ],
      "id": "s3p6"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Qual é a promessa que a marca faz e consegue cumprir?",
      "id": "s3p7"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Como o público fala da marca hoje? E como você gostaria que falasse?",
      "id": "s3p8"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Por que o cliente escolhe vocês, e por que às vezes escolhe outro?",
      "id": "s3p9"
     }
    ]
   },
   {
    "titulo": "3. Valores e personalidade",
    "ajuda": "Valores orientam decisões; personalidade define como a marca soa e se comporta.",
    "perguntas": [
     {
      "tipo": "paragrafo",
      "pergunta": "Quais são os 3 a 5 valores inegociáveis? Para cada um, dê um exemplo de atitude prática.",
      "id": "s4p1"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Se a marca fosse uma pessoa, como seria? Idade, jeito de falar, como se veste.",
      "id": "s4p2"
     },
     {
      "tipo": "escolha_unica",
      "pergunta": "Qual arquétipo mais se aproxima?",
      "opcoes": [
       "Criador",
       "Cuidador",
       "Explorador",
       "Rebelde",
       "Sábio",
       "Herói",
       "Mago",
       "Governante",
       "Amante",
       "Bobo da corte",
       "Inocente",
       "Cara comum"
      ],
      "permite_outro": true,
      "id": "s4p3"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Escolha 5 adjetivos que definem a marca e 5 que ela NUNCA pode ser.",
      "id": "s4p4"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Tom de voz: usa gíria, emojis, humor? Algo mais sobre o jeito de falar?",
      "id": "s4p5"
     },
     {
      "tipo": "escala_1_5",
      "pergunta": "Formal ↔ Descontraído",
      "rotulos": [
       "Formal",
       "Descontraído"
      ],
      "id": "s4p6"
     },
     {
      "tipo": "escala_1_5",
      "pergunta": "Sério ↔ Bem-humorado",
      "rotulos": [
       "Sério",
       "Bem-humorado"
      ],
      "id": "s4p7"
     },
     {
      "tipo": "escala_1_5",
      "pergunta": "Técnico ↔ Simples",
      "rotulos": [
       "Técnico",
       "Simples"
      ],
      "id": "s4p8"
     },
     {
      "tipo": "escala_1_5",
      "pergunta": "Discreto ↔ Ousado",
      "rotulos": [
       "Discreto",
       "Ousado"
      ],
      "id": "s4p9"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Existem temas, polêmicas ou palavras que a marca evita?",
      "id": "s4p10"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Que causas ou comunidades a marca apoia?",
      "id": "s4p11"
     }
    ]
   },
   {
    "titulo": "4. Cores e intenção de cada uma",
    "ajuda": "Cor não é gosto pessoal: é uma decisão de comunicação. Para cada cor, a marca precisa saber o que quer provocar.",
    "perguntas": [
     {
      "tipo": "paragrafo",
      "pergunta": "Quais cores vocês já usam hoje e por quê? Alguma tem valor afetivo ou histórico?",
      "id": "s5p1"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Quais cores os concorrentes usam? (Para não ficarmos iguais a eles.)",
      "id": "s5p2"
     },
     {
      "tipo": "texto_curto",
      "pergunta": "Cor principal (identidade): qual cor e o que ela deve fazer o público sentir?",
      "id": "s5p3"
     },
     {
      "tipo": "texto_curto",
      "pergunta": "Cor secundária (apoio): qual cor e o que ela deve fazer o público sentir?",
      "id": "s5p4"
     },
     {
      "tipo": "texto_curto",
      "pergunta": "Cor de destaque (ação, botões, chamadas): qual cor e o que ela deve fazer o público sentir?",
      "id": "s5p5"
     },
     {
      "tipo": "texto_curto",
      "pergunta": "Neutras (fundos claros e textos escuros): alguma preferência?",
      "id": "s5p6"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Existe cor proibida (religião, time, partido, experiência ruim)?",
      "id": "s5p7"
     },
     {
      "tipo": "multipla_escolha",
      "pergunta": "Onde a cor vai aparecer mais?",
      "opcoes": [
       "Tela (redes, site)",
       "Impressão",
       "Tecido",
       "Fachada",
       "Vídeo"
      ],
      "id": "s5p8"
     },
     {
      "tipo": "escolha_unica",
      "pergunta": "A marca precisa funcionar em fundo claro e escuro, e em uma cor só?",
      "opcoes": [
       "Sim, nos três casos",
       "Só em fundo claro",
       "Só em fundo escuro",
       "Não sei"
      ],
      "id": "s5p9"
     },
     {
      "tipo": "escolha_unica",
      "pergunta": "Preferência de paleta:",
      "opcoes": [
       "Enxuta (2 a 3 cores)",
       "Rica (4 a 6 cores)",
       "Não sei"
      ],
      "id": "s5p10"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Cite 3 marcas ou imagens que transmitem o clima de cor desejado (pode colar links).",
      "id": "s5p11"
     }
    ]
   },
   {
    "titulo": "5. Tipografia e estilo visual",
    "ajuda": null,
    "perguntas": [
     {
      "tipo": "escolha_unica",
      "pergunta": "A voz da marca é mais:",
      "opcoes": [
       "Robusta e forte",
       "Limpa e neutra",
       "Editorial e elegante",
       "Técnica e precisa"
      ],
      "id": "s6p1"
     },
     {
      "tipo": "multipla_escolha",
      "pergunta": "Preferência de fontes:",
      "opcoes": [
       "Com serifa",
       "Sem serifa",
       "Condensadas",
       "Manuscritas",
       "Mistas",
       "Não sei"
      ],
      "id": "s6p2"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Existe alguma fonte já usada ou licenciada? Há orçamento para licença comercial?",
      "id": "s6p3"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Onde o texto aparece em tamanho pequeno (legendas, embalagem, app)? A legibilidade é prioridade?",
      "id": "s6p4"
     },
     {
      "tipo": "multipla_escolha",
      "pergunta": "O estilo visual é mais:",
      "opcoes": [
       "Minimalista",
       "Maximalista",
       "Retrô",
       "Futurista",
       "Artesanal",
       "Cinematográfico",
       "Urbano"
      ],
      "permite_outro": true,
      "id": "s6p5"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Como são as fotos e vídeos ideais: luz dura ou suave, cores saturadas ou dessaturadas, gente ou produto?",
      "id": "s6p6"
     },
     {
      "tipo": "multipla_escolha",
      "pergunta": "Elementos gráficos desejados:",
      "opcoes": [
       "Ícones",
       "Texturas",
       "Padrões",
       "Formas",
       "Grafismos"
      ],
      "id": "s6p7"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Referências: 3 marcas que você admira e 3 que você NÃO quer parecer, cada uma com o motivo.",
      "id": "s6p8"
     }
    ]
   },
   {
    "titulo": "6. Aplicações, conteúdo e canais",
    "ajuda": null,
    "perguntas": [
     {
      "tipo": "multipla_escolha",
      "pergunta": "Onde a marca vai aparecer primeiro?",
      "opcoes": [
       "Instagram / TikTok / YouTube",
       "Site ou loja virtual",
       "Vídeos e vinhetas (abertura, lower third, encerramento)",
       "Embalagem, etiquetas e produto",
       "Uniforme, camisetas e brindes",
       "Fachada, sinalização e veículos",
       "Material impresso (cartão, cardápio, catálogo)",
       "Apresentações e propostas comerciais"
      ],
      "permite_outro": true,
      "id": "s7p1"
     },
     {
      "tipo": "texto_curto",
      "pergunta": "Qual é o canal principal de vendas e de primeiro contato com o cliente?",
      "id": "s7p2"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Quem produz o conteúdo hoje? Existe rotina, equipe ou fornecedor?",
      "id": "s7p3"
     },
     {
      "tipo": "multipla_escolha",
      "pergunta": "Quais formatos vocês querem?",
      "opcoes": [
       "Foto",
       "Reels",
       "Vídeo longo",
       "Podcast",
       "Texto"
      ],
      "permite_outro": true,
      "id": "s7p4"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Quais são os 3 pilares de conteúdo (assuntos sobre os quais a marca sempre fala)?",
      "id": "s7p5"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Que conteúdos deram mais resultado até hoje, e quais nunca funcionaram?",
      "id": "s7p6"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Há datas, sazonalidades ou campanhas fixas no ano?",
      "id": "s7p7"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "A marca precisa de versão animada (motion)? Onde será usada e com que duração?",
      "id": "s7p8"
     }
    ]
   },
   {
    "titulo": "7. Metas, prazos e aprovação",
    "ajuda": null,
    "perguntas": [
     {
      "tipo": "multipla_escolha",
      "pergunta": "Objetivo principal do projeto:",
      "opcoes": [
       "Ser reconhecido",
       "Vender mais",
       "Subir de preço",
       "Entrar em novo mercado"
      ],
      "permite_outro": true,
      "id": "s8p1"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Como saberemos que deu certo? Indique 1 a 3 números (seguidores, vendas, pedidos, reconhecimento).",
      "id": "s8p2"
     },
     {
      "tipo": "data",
      "pergunta": "Data fixa de lançamento, se houver",
      "id": "s8p3"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Quem aprova cada etapa?",
      "id": "s8p4"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "O que NÃO pode mudar na marca atual (nome, símbolo, cor, slogan)?",
      "id": "s8p5"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Algo mais que precisamos saber antes de começar?",
      "id": "s8p6"
     }
    ]
   },
   {
    "titulo": "Materiais",
    "ajuda": "Envie logos atuais, fotos e referências para contato@lookexperience.com.br ou pelo WhatsApp da LOOK. Se preferir, cole aqui links do Google Drive.",
    "perguntas": [
     {
      "tipo": "paragrafo",
      "pergunta": "Links de materiais (logos, fotos, referências)",
      "id": "s9p1"
     }
    ]
   }
  ]
 },
 "ao_vivo": {
  "id": "ao_vivo",
  "titulo": "Briefing de programa ao vivo — LOOK",
  "descricao": "Este briefing reúne o que a LOOK precisa saber para criar a identidade visual do programa: as páginas nas redes e as layers da transmissão (abertura, encerramento, identificação, tarjas, patrocinadores e transições). Leva cerca de 30 minutos. O que ainda não estiver decidido pode ficar em branco, e definimos juntos.\n\nLOOK Direção de Marca e Conteúdo · contato@lookexperience.com.br",
  "secoes": [
   {
    "titulo": "Dados do programa",
    "ajuda": null,
    "perguntas": [
     {
      "tipo": "texto_curto",
      "pergunta": "Nome do programa (definido ou opções)",
      "obrigatoria": true,
      "id": "s1p1"
     },
     {
      "tipo": "texto_curto",
      "pergunta": "Apresentador (nome usado no ar)",
      "obrigatoria": true,
      "id": "s1p2"
     },
     {
      "tipo": "texto_curto",
      "pergunta": "Quem aprova as peças",
      "obrigatoria": true,
      "id": "s1p3"
     },
     {
      "tipo": "texto_curto",
      "pergunta": "Contato (WhatsApp e e-mail)",
      "obrigatoria": true,
      "id": "s1p4"
     },
     {
      "tipo": "texto_curto",
      "pergunta": "Dias e horário das lives",
      "id": "s1p5"
     },
     {
      "tipo": "data",
      "pergunta": "Data prevista de estreia",
      "id": "s1p6"
     },
     {
      "tipo": "texto_curto",
      "pergunta": "Perfis que vão transmitir (Instagram, Facebook, outras páginas)",
      "id": "s1p7"
     }
    ]
   },
   {
    "titulo": "1. O programa",
    "ajuda": "Aqui definimos o que o programa é. Toda escolha visual depois volta a estas respostas.",
    "perguntas": [
     {
      "tipo": "texto_curto",
      "pergunta": "Em uma frase: sobre o que é o programa e para quem ele fala?",
      "id": "s2p1"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "O nome já está definido? Se não, quais opções existem e qual ideia o nome deve passar?",
      "id": "s2p2"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Qual é o público principal: cidade, região, faixa de idade, ouvintes do rádio?",
      "id": "s2p3"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Quais quadros fixos o programa terá, e em que dia cada um entra?",
      "id": "s2p4"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Existe bordão, frase de abertura ou assinatura que o apresentador já usa?",
      "id": "s2p5"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Já existe vinheta, trilha ou som que identifica o apresentador e deve ser mantido?",
      "id": "s2p6"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "O que faz este programa ser diferente das outras lives e páginas de notícia da cidade?",
      "id": "s2p7"
     }
    ]
   },
   {
    "titulo": "2. O apresentador",
    "ajuda": "A identidade precisa conversar com o apresentador e fortalecer a imagem dele.",
    "perguntas": [
     {
      "tipo": "multipla_escolha",
      "pergunta": "Como o apresentador quer ser visto (escolha até 2):",
      "opcoes": [
       "Próximo do povo",
       "Firme e investigativo",
       "Institucional",
       "Bem-humorado"
      ],
      "permite_outro": true,
      "id": "s3p1"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Qual é a trajetória dele (emissoras, programas, tempo de carreira)? Algo disso deve aparecer na tela?",
      "id": "s3p2"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Ele tem vínculo atual com alguma rádio ou marca que limite o uso de cores, nomes ou logos?",
      "id": "s3p3"
     },
     {
      "tipo": "texto_curto",
      "pergunta": "O que deve aparecer na identificação dele na tela (nome, função, @ das redes)?",
      "id": "s3p4"
     },
     {
      "tipo": "escolha_unica",
      "pergunta": "Existem fotos profissionais dele?",
      "opcoes": [
       "Sim",
       "Não, podemos agendar fotos no dia da instalação"
      ],
      "id": "s3p5"
     },
     {
      "tipo": "escolha_unica",
      "pergunta": "Ele já tem logo, assinatura ou marca pessoal?",
      "opcoes": [
       "Sim",
       "Não"
      ],
      "id": "s3p6"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "O programa tem relação com outra página ou marca que deve aparecer na identidade? Qual?",
      "id": "s3p7"
     }
    ]
   },
   {
    "titulo": "3. Personalidade e tom",
    "ajuda": "Marque de 1 a 5 onde o programa deve ficar em cada linha.",
    "perguntas": [
     {
      "tipo": "escala_1_5",
      "pergunta": "Sério ↔ Descontraído",
      "rotulos": [
       "Sério",
       "Descontraído"
      ],
      "id": "s4p1"
     },
     {
      "tipo": "escala_1_5",
      "pergunta": "Tradicional ↔ Moderno",
      "rotulos": [
       "Tradicional",
       "Moderno"
      ],
      "id": "s4p2"
     },
     {
      "tipo": "escala_1_5",
      "pergunta": "Informativo ↔ Opinativo",
      "rotulos": [
       "Informativo",
       "Opinativo"
      ],
      "id": "s4p3"
     },
     {
      "tipo": "escala_1_5",
      "pergunta": "Calmo ↔ Urgente (clima de plantão)",
      "rotulos": [
       "Calmo",
       "Urgente (clima de plantão)"
      ],
      "id": "s4p4"
     },
     {
      "tipo": "escala_1_5",
      "pergunta": "Popular ↔ Institucional",
      "rotulos": [
       "Popular",
       "Institucional"
      ],
      "id": "s4p5"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Cite 3 palavras que o programa deve passar e 3 que ele nunca pode passar.",
      "id": "s4p6"
     },
     {
      "tipo": "multipla_escolha",
      "pergunta": "Que sensação a pessoa deve ter ao entrar na live?",
      "opcoes": [
       "Estar bem informada",
       "Indignada",
       "Tranquila",
       "Por dentro da cidade"
      ],
      "permite_outro": true,
      "id": "s4p7"
     }
    ]
   },
   {
    "titulo": "4. Cores, estilo e referências",
    "ajuda": "Cor aqui é decisão de comunicação, não só gosto. Num programa que fala de política local, isso pesa ainda mais.",
    "perguntas": [
     {
      "tipo": "paragrafo",
      "pergunta": "Há cores que o apresentador quer usar, ou que já o identificam?",
      "id": "s5p1"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Há cores proibidas? Atenção a cores ligadas a partidos, times ou rádios concorrentes, para o programa não parecer ter lado.",
      "id": "s5p2"
     },
     {
      "tipo": "texto_curto",
      "pergunta": "Cor principal (identidade): qual e o que deve transmitir?",
      "id": "s5p3"
     },
     {
      "tipo": "texto_curto",
      "pergunta": "Cor de apoio: qual e o que deve transmitir?",
      "id": "s5p4"
     },
     {
      "tipo": "texto_curto",
      "pergunta": "Cor de destaque (urgente, chamadas): qual e o que deve transmitir?",
      "id": "s5p5"
     },
     {
      "tipo": "escolha_unica",
      "pergunta": "Qual estilo combina mais?",
      "opcoes": [
       "Telejornal clássico",
       "Digital moderno",
       "Regional popular",
       "Rádio com câmera"
      ],
      "permite_outro": true,
      "id": "s5p6"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Cite 3 programas, telejornais ou páginas com visual que ele admira, e 3 que não quer parecer, com o motivo de cada.",
      "id": "s5p7"
     },
     {
      "tipo": "escolha_unica",
      "pergunta": "Preferência de visual na tela:",
      "opcoes": [
       "Mais limpo (pouca coisa na tela)",
       "Mais cheio de informação (letreiros, relógio, rodapé)"
      ],
      "id": "s5p8"
     }
    ]
   },
   {
    "titulo": "5. Layers da transmissão",
    "ajuda": "Marque o que o programa vai usar. Depois definimos juntos a prioridade de cada uma.",
    "perguntas": [
     {
      "tipo": "multipla_escolha",
      "pergunta": "Layers que o programa vai usar:",
      "opcoes": [
       "Tela de espera antes de começar (\"Já vamos começar\")",
       "Vinheta de abertura",
       "Selo \"AO VIVO\", com data e hora",
       "Identificação do apresentador (nome e função)",
       "Identificação de convidado ou entrevistado (nome e cargo)",
       "Selo de cada quadro",
       "Tarja de manchete do assunto do momento",
       "Tarja de \"Urgente\" ou \"Plantão\"",
       "Rodapé com notícias rodando (letreiro)",
       "Comentários do público na tela",
       "Espaço para patrocinador (logo fixa, vinheta de oferecimento ou ambos)",
       "Transição entre cenas e quadros",
       "Tela para mostrar fotos, vídeos ou documentos",
       "Tela para participação remota (telefone ou vídeo)",
       "Tela de intervalo",
       "Encerramento com redes sociais e próximos horários"
      ],
      "id": "s6p1"
     },
     {
      "tipo": "texto_curto",
      "pergunta": "Vinheta de abertura: com ou sem trilha, e até quantos segundos?",
      "id": "s6p2"
     },
     {
      "tipo": "escolha_unica",
      "pergunta": "Os convidados vão estar presencialmente ou participar à distância?",
      "opcoes": [
       "Presencialmente",
       "À distância",
       "Os dois"
      ],
      "id": "s6p3"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Ele vai mostrar documentos, matérias ou vídeos durante a live? Com que frequência?",
      "id": "s6p4"
     },
     {
      "tipo": "escolha_unica",
      "pergunta": "Qual transmissão é a mais importante? (Define como a câmera e as layers são montadas.)",
      "opcoes": [
       "Instagram (em pé, vertical)",
       "Facebook (deitado, horizontal)",
       "As duas igualmente"
      ],
      "id": "s6p5"
     },
     {
      "tipo": "escolha_unica",
      "pergunta": "Quantas câmeras?",
      "opcoes": [
       "Só uma",
       "Mais de uma"
      ],
      "id": "s6p6"
     }
    ]
   },
   {
    "titulo": "6. Páginas nas redes",
    "ajuda": null,
    "perguntas": [
     {
      "tipo": "escolha_unica",
      "pergunta": "O programa terá perfil próprio ou vai rodar no perfil pessoal do apresentador?",
      "opcoes": [
       "Perfil próprio",
       "Perfil pessoal do apresentador",
       "Os dois"
      ],
      "id": "s7p1"
     },
     {
      "tipo": "multipla_escolha",
      "pergunta": "O que precisa ser criado ou atualizado?",
      "opcoes": [
       "Foto de perfil",
       "Capa do Facebook",
       "Capas dos destaques do Instagram",
       "Texto da bio",
       "Post modelo de chamada (\"Hoje às 8h, ao vivo\")",
       "Post modelo da pauta do dia",
       "Post modelo de patrocinador",
       "Post de estreia do programa"
      ],
      "id": "s7p2"
     },
     {
      "tipo": "texto_curto",
      "pergunta": "Quem vai postar no dia a dia?",
      "id": "s7p3"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Qual é o @ atual de cada perfil, e quantos seguidores cada um tem hoje?",
      "id": "s7p4"
     }
    ]
   },
   {
    "titulo": "7. Patrocinadores",
    "ajuda": null,
    "perguntas": [
     {
      "tipo": "texto_curto",
      "pergunta": "Quantos patrocinadores já estão confirmados ou em conversa?",
      "id": "s8p1"
     },
     {
      "tipo": "multipla_escolha",
      "pergunta": "Cada patrocinador aparece como:",
      "opcoes": [
       "Logo fixa",
       "Vinheta",
       "Menção falada",
       "Tela própria"
      ],
      "id": "s8p2"
     },
     {
      "tipo": "texto_curto",
      "pergunta": "Há exclusividade de segmento (ex.: só um mercado, só uma farmácia)?",
      "id": "s8p3"
     },
     {
      "tipo": "texto_curto",
      "pergunta": "Quantas vezes por programa cada patrocinador deve aparecer?",
      "id": "s8p4"
     },
     {
      "tipo": "escolha_unica",
      "pergunta": "Os patrocinadores têm logo em boa qualidade (de preferência vetor: PDF, SVG, AI ou CDR)?",
      "opcoes": [
       "Sim",
       "Alguns",
       "Não",
       "Não sei"
      ],
      "id": "s8p5"
     }
    ]
   },
   {
    "titulo": "8. Materiais e aprovação",
    "ajuda": "Envie os materiais para contato@lookexperience.com.br ou pelo WhatsApp da LOOK. Se preferir, cole aqui links do Google Drive.",
    "perguntas": [
     {
      "tipo": "multipla_escolha",
      "pergunta": "O que você já pode enviar?",
      "opcoes": [
       "Fotos do apresentador (boa resolução)",
       "Logo ou marca pessoal",
       "Vinheta ou trilha que já usa",
       "Logos dos patrocinadores",
       "Lista dos quadros e dias de cada um",
       "Referências visuais (prints ou links)",
       "Acessos e permissões das contas"
      ],
      "id": "s9p1"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Links de materiais",
      "id": "s9p2"
     },
     {
      "tipo": "texto_curto",
      "pergunta": "Quem dá a palavra final em cada etapa?",
      "id": "s9p3"
     },
     {
      "tipo": "escolha_unica",
      "pergunta": "Combinamos até 2 rodadas de ajuste por etapa. Está de acordo?",
      "opcoes": [
       "Sim",
       "Quero conversar sobre isso"
      ],
      "id": "s9p4"
     },
     {
      "tipo": "paragrafo",
      "pergunta": "Algo mais que precisamos saber antes de começar?",
      "id": "s9p5"
     }
    ]
   }
  ]
 }
};
