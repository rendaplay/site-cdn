/* Presets da Embaixadinha Coletiva. Escolha com ?preset=<chave>. O painel do
   jogo (tecla P) salva ajustes por cima do preset neste PC, sem mexer aqui.

   As faixas seguem as do kit (1, 10, 100, 500, 3000 moedas). O valor que
   conta é o do envio inteiro: rosa ×10 = 10 moedas = segunda faixa. */
"use strict";

window.EMBAIXADINHA_PRESETS = {
  brasileirao: {
    titulo: "Embaixadinha Coletiva",
    /* Diretrizes de monetização do TikTok: a tela não pede presente nem
       mostra moedas. */
    modoSeguro: true,

    /* Sem escudo nem jogador: o time é o nome, as cores e o padrão da camisa.
       Apelido é palavra inteira, sem acento e minúsculo; nome que serve pra
       mais de um time ("tricolor") fica de fora. `sigla` vai no placar.
       `peso` sorteia o rival quando só um time foi citado e pesa na demo. */
    times: [
      { id: "flamengo", nome: "Flamengo", sigla: "FLA", cor: "#d81f2a", cor2: "#111111", calcao: "#ffffff", padrao: "horiz", peso: 10,
        apelidos: ["flamengo", "mengo", "mengao", "fla"],
        reserva: { cor: "#f4f4f4", cor2: "#d81f2a", calcao: "#ffffff", padrao: "faixa" } },
      { id: "corinthians", nome: "Corinthians", sigla: "COR", cor: "#f4f4f4", cor2: "#111111", calcao: "#111111", padrao: "mangas", peso: 10,
        apelidos: ["corinthians", "corintia", "curintia", "timao", "coringao"],
        reserva: { cor: "#151515", cor2: "#f4f4f4", calcao: "#111111", padrao: "liso" } },
      { id: "palmeiras", nome: "Palmeiras", sigla: "PAL", cor: "#0b7a3e", cor2: "#ffffff", calcao: "#ffffff", padrao: "liso", peso: 8,
        apelidos: ["palmeiras", "verdao", "porco", "palestra"],
        reserva: { cor: "#f4f4f4", cor2: "#0b7a3e", calcao: "#0b7a3e", padrao: "liso" } },
      { id: "saopaulo", nome: "São Paulo", sigla: "SAO", cor: "#f4f4f4", cor2: "#d81f2a", calcao: "#ffffff", padrao: "faixa", peso: 6,
        apelidos: ["sao paulo", "spfc", "soberano"],
        reserva: { cor: "#d81f2a", cor2: "#111111", calcao: "#111111", padrao: "listras" } },
      { id: "santos", nome: "Santos", sigla: "SAN", cor: "#f4f4f4", cor2: "#111111", calcao: "#ffffff", padrao: "liso", peso: 4,
        apelidos: ["santos", "peixe"],
        reserva: { cor: "#151515", cor2: "#f4f4f4", calcao: "#111111", padrao: "liso" } },
      { id: "vasco", nome: "Vasco", sigla: "VAS", cor: "#f4f4f4", cor2: "#111111", calcao: "#111111", padrao: "diagonal", peso: 6,
        apelidos: ["vasco", "vascao"],
        reserva: { cor: "#151515", cor2: "#f4f4f4", calcao: "#111111", padrao: "diagonal" } },
      { id: "fluminense", nome: "Fluminense", sigla: "FLU", cor: "#7a1131", cor2: "#0b6b3a", calcao: "#ffffff", padrao: "listras", peso: 4,
        apelidos: ["fluminense", "flu", "nense"],
        reserva: { cor: "#f4f4f4", cor2: "#7a1131", calcao: "#ffffff", padrao: "liso" } },
      { id: "botafogo", nome: "Botafogo", sigla: "BOT", cor: "#151515", cor2: "#f4f4f4", calcao: "#111111", padrao: "listras", peso: 4,
        apelidos: ["botafogo", "fogao", "glorioso"],
        reserva: { cor: "#f4f4f4", cor2: "#111111", calcao: "#ffffff", padrao: "liso" } },
      { id: "gremio", nome: "Grêmio", sigla: "GRE", cor: "#3aa6ee", cor2: "#111111", calcao: "#111111", padrao: "listras", peso: 5,
        apelidos: ["gremio", "imortal"],
        reserva: { cor: "#f4f4f4", cor2: "#3aa6ee", calcao: "#ffffff", padrao: "liso" } },
      { id: "internacional", nome: "Internacional", sigla: "INT", cor: "#d81f2a", cor2: "#ffffff", calcao: "#ffffff", padrao: "liso", peso: 5,
        apelidos: ["internacional", "inter", "colorado"],
        reserva: { cor: "#f4f4f4", cor2: "#d81f2a", calcao: "#ffffff", padrao: "liso" } },
      { id: "atletico", nome: "Atlético-MG", sigla: "CAM", cor: "#f4f4f4", cor2: "#111111", calcao: "#111111", padrao: "listras", peso: 5,
        apelidos: ["atletico", "galo"],
        reserva: { cor: "#151515", cor2: "#f4f4f4", calcao: "#111111", padrao: "liso" } },
      { id: "cruzeiro", nome: "Cruzeiro", sigla: "CRU", cor: "#1f4fb4", cor2: "#ffffff", calcao: "#ffffff", padrao: "liso", peso: 5,
        apelidos: ["cruzeiro", "raposa", "cabuloso"],
        reserva: { cor: "#f4f4f4", cor2: "#1f4fb4", calcao: "#ffffff", padrao: "liso" } },
    ],

    /* Tempo da rodada (s). Vence a maior sequência feita nela. */
    duracao: 120,

    /* Segundos de cada momento. */
    tempos: { aquecimento: 12, abertura: 4, fim: 7, intervalo: 8 },

    /* Quem citou um time conta pro clássico por tantos segundos. */
    janelaCitacao: 60,

    /* Sem comentário de time nem presente por tanto tempo, as bolas param no
       pé e o jogo espera alguém comentar (o TikTok derruba live parada). */
    ociosidade: 45,

    /* Fôlego vai de 0 a 1. Cai `queda` por segundo, mais `quedaPorToque` a
       cada toque da sequência (até `quedaMaxima`). Comentário do time enche
       `toque`, cada curtida `curtida` (no máximo `curtidaMaxima` por envio).
       A bola caída volta depois de `recomeco` s com fôlego `inicio`. */
    folego: { inicio: 0.8, queda: 0.04, quedaPorToque: 0.0006, quedaMaxima: 0.22, toque: 0.2, curtida: 0.004, curtidaMaxima: 0.06 },
    recomeco: 2,

    /* Sequência mínima pra valer recorde da live. */
    recordeMinimo: 20,

    /* Truque pelo chat: uma vez a cada tantos segundos por pessoa. */
    intervaloTruque: 20,

    /* Seguir: o reforço fica tantos segundos e cada toque vale `reforcoValor`. */
    reforco: 20,
    reforcoValor: 2,

    /* Duração dos efeitos de presente (s) e quantos esperam na fila de cada time. */
    lento: 8,
    vento: 6,
    blindada: 15,
    filaMaxima: 12,

    faixas: [
      { moedas: 1, nome: "Bola brilhante" },
      { moedas: 10, nome: "Câmera lenta" },
      { moedas: 100, nome: "Vento no rival" },
      { moedas: 500, nome: "Bola de fogo" },
      { moedas: 3000, nome: "Show do craque" },
    ],

    som: true,
    volume: 70,
    musica: 25,
    narrador: true,

    /* Plateia de demonstração (?demo=1). Nome em inglês, como a TikTokLive manda. */
    demo: {
      ritmo: 3,
      presentes: [
        { nome: "Rose", moedas: 1, peso: 30 },
        { nome: "GG", moedas: 1, peso: 12 },
        { nome: "Finger Heart", moedas: 5, peso: 10 },
        { nome: "Perfume", moedas: 20, peso: 6 },
        { nome: "Doughnut", moedas: 30, peso: 4 },
        { nome: "Hand Heart", moedas: 100, peso: 2 },
        { nome: "Money Gun", moedas: 500, peso: 0.7 },
        { nome: "Galaxy", moedas: 1000, peso: 0.4 },
        { nome: "Lion", moedas: 29999, peso: 0.05 },
      ],
    },
  },
};

window.EMBAIXADINHA_PRESET_PADRAO = "brasileirao";
