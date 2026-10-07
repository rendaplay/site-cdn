/* Presets da Batalha de Torres. Um preset é tudo que muda de uma batalha pra outra:
   quem está de cada lado, a cor, a foto, o presente-símbolo e a rodada.
   Cenário: `cenario` (imagem 1080×1920), `desenho` (o fundo desenhado quando não
   há imagem: "congresso" ou "arena") e `arte` em cada lado (PNG recortado,
   1200×1600). Como gerar as artes: presets/ARTE.md.
   Escolha com ?preset=<chave>. O painel do jogo (tecla P) salva ajustes
   por cima do preset neste PC, sem mexer neste arquivo.

   `presente.aceitos` é o nome que a TikTokLive manda no evento (quase
   sempre em inglês). Na dúvida, mande o presente numa live de teste e
   confira o nome na gravação do conector (dados/lives/*.jsonl). */
"use strict";

window.BATALHA_PRESETS = {
  "lula-flavio": {
    titulo: "Lula x Flávio",
    desenho: "congresso",
    cenario: "presets/arte/congresso.jpg",
    /* Na tela só aparecem as cores ("Vermelho" e "Verde"), nunca os nomes;
       o chat continua aceitando os nomes como comando. */
    lados: [
      {
        nome: "Vermelho",
        cor: "#D8141F",
        corEscura: "#5C0710",
        acento: "#FFFFFF",
        foto: "fotos/lula.webp",
        arte: "presets/arte/lula.png",
        presente: { nome: "Rosa", icone: "🌹", aceitos: ["Rose", "Rosa"], palavras: ["rosas", "rosinha"] },
        comandos: ["1", "lula", "vermelho"],
      },
      {
        nome: "Verde",
        cor: "#00873F",
        corEscura: "#00351A",
        acento: "#FFD400",
        foto: "fotos/flavio.webp",
        arte: "presets/arte/flavio.png",
        /* A live manda "White Rose" (1 moeda). "GG" continua valendo pra
           quem já mandava GG pro verde. */
        presente: {
          nome: "Rosa branca", icone: "🌹", imagem: "presets/ilustracoes/rosa-branca.svg",
          aceitos: ["White Rose", "Rosa branca", "Rosa Branca", "GG"],
          palavras: ["branca", "rosa branca", "gg"],
        },
        comandos: ["2", "flavio", "verde"],
      },
    ],
    rodada: {
      segundos: 180,
      prorrogacao: 20,
      prorrogacoesMax: 3,
      vitoria: 14,
      automatica: true,
    },
    meta: { moedas: 3000 },
    destaqueMoedas: 99,
    viradaMinima: 60,
    /* Lado com até `atras`% da altura do outro (rodada com 150 m ou mais):
       o próximo presente dele vale 2× por 10 s. segundos: 0 desliga. */
    dobro: { atras: 50, minimo: 150, segundos: 10, intervalo: 45 },
    /* Comentar 1/2 (ou o nome do presente) empilha um tijolinho de
       `metros` (rosa = 1 m), um a cada `intervalo` s por pessoa, até
       `teto` m por pessoa na rodada. */
    comentario: { metros: 0.2, intervalo: 5, teto: 6 },
    /* Modo seguro TikTok: a tela nunca pede presente nem mostra moeda (a
       live já foi restringida por "solicitação artificial de presentes").
       Também desliga o 2×. */
    modoSeguro: true,
    /* A cada `cada` curtidas de uma pessoa, um tijolinho de `metros` no lado
       dela (o escolhido ou o de menos torcida); mesmo intervalo e teto do
       comentário. Seguir vale `metros` uma vez por pessoa. */
    curtida: { cada: 25, metros: 0.5, intervalo: 5, teto: 6 },
    seguiu: { metros: 1 },
    /* Presente de 10+ moedas também derruba a torre rival (vento, raio,
       bola de demolição, terremoto), nunca mais que `maxPct`% dela. */
    ataque: { maxPct: 40 },
    som: true,
    volume: 50,
    creditos: "Fotos: Ricardo Stuckert/PR (CC BY 2.0) e Agência Senado (CC BY 2.0)",
  },
};

window.BATALHA_PRESET_PADRAO = "lula-flavio";
