/* Presets da Maior Torcida do Brasil. Escolha com ?preset=<chave>. O painel
   do jogo (tecla P) salva ajustes por cima do preset neste PC, sem mexer aqui.

   As faixas seguem as do kit (1, 10, 100, 500, 3000 moedas). O valor que
   conta é o do envio inteiro: rosa ×10 = 10 moedas = segunda faixa. */
"use strict";

window.TORCIDA_PRESETS = {
  estadio: {
    titulo: "Maior Torcida do Brasil",
    /* Diretrizes de monetização do TikTok: a tela não pede presente nem
       mostra moedas. */
    modoSeguro: true,

    /* Os 12 grandes do Cai ou Não Cai?, na ordem em que ficam no anel do
       estádio (dois alvinegros nunca lado a lado). Sem escudo nem jogador:
       o time aparece pelo nome, pelas cores e pelo padrão da camisa.
       Apelido é palavra inteira, sem acento e minúsculo; nome que serve pra
       mais de um time ("tricolor") fica de fora. `peso` só pesa na plateia
       de demonstração. */
    times: [
      { id: "flamengo", nome: "Flamengo", sigla: "FLA", cor: "#d81f2a", cor2: "#111111", padrao: "horiz", peso: 10,
        apelidos: ["flamengo", "mengo", "mengao", "fla"] },
      { id: "corinthians", nome: "Corinthians", sigla: "COR", cor: "#f4f4f4", cor2: "#111111", padrao: "mangas", peso: 10,
        apelidos: ["corinthians", "corintia", "curintia", "timao", "coringao"] },
      { id: "palmeiras", nome: "Palmeiras", sigla: "PAL", cor: "#0b7a3e", cor2: "#ffffff", padrao: "liso", peso: 8,
        apelidos: ["palmeiras", "verdao", "porco", "palestra"] },
      { id: "saopaulo", nome: "São Paulo", sigla: "SAO", cor: "#f4f4f4", cor2: "#d81f2a", padrao: "faixa", peso: 6,
        apelidos: ["sao paulo", "spfc", "soberano"] },
      { id: "santos", nome: "Santos", sigla: "SAN", cor: "#f4f4f4", cor2: "#111111", padrao: "liso", peso: 4,
        apelidos: ["santos", "peixe"] },
      { id: "cruzeiro", nome: "Cruzeiro", sigla: "CRU", cor: "#1f4fb4", cor2: "#ffffff", padrao: "liso", peso: 5,
        apelidos: ["cruzeiro", "raposa", "cabuloso"] },
      { id: "vasco", nome: "Vasco", sigla: "VAS", cor: "#f4f4f4", cor2: "#111111", padrao: "diagonal", peso: 6,
        apelidos: ["vasco", "vascao"] },
      { id: "fluminense", nome: "Fluminense", sigla: "FLU", cor: "#7a1131", cor2: "#0b6b3a", padrao: "listras", peso: 4,
        apelidos: ["fluminense", "flu", "nense"] },
      { id: "botafogo", nome: "Botafogo", sigla: "BOT", cor: "#151515", cor2: "#f4f4f4", padrao: "listras", peso: 4,
        apelidos: ["botafogo", "fogao", "glorioso"] },
      { id: "gremio", nome: "Grêmio", sigla: "GRE", cor: "#3aa6ee", cor2: "#111111", padrao: "listras", peso: 5,
        apelidos: ["gremio", "imortal"] },
      { id: "internacional", nome: "Internacional", curto: "Inter", sigla: "INT", cor: "#d81f2a", cor2: "#ffffff", padrao: "liso", peso: 5,
        apelidos: ["internacional", "inter", "colorado"] },
      { id: "atletico", nome: "Atlético-MG", curto: "Atlético", sigla: "CAM", cor: "#f4f4f4", cor2: "#111111", padrao: "listras", peso: 5,
        apelidos: ["atletico", "galo"] },
    ],

    /* `fim` é a festa do setor vencedor; `intervalo`, o ranking da live na
       tela antes da próxima rodada. */
    rodada: { duracao: 180, fim: 8, intervalo: 7 },

    /* Comentário de quem já está sentado: faz barulho no máximo 1 vez a cada
       `intervalo` s (o boneco pula sempre). */
    chat: { intervalo: 1.5 },

    /* Barulho de cada setor: soma por comentário, curtida e presente (pela
       faixa) e cai pela metade a cada `meiaVida` s. Passando de cada
       `niveis` a torcida fica de pé, pula e faz a ola. */
    barulho: {
      comentario: 1,
      curtida: 0.12,
      curtidaMax: 1.5,
      presente: [3, 6, 10, 14, 24],
      meiaVida: 10,
      niveis: [1.5, 5, 11],
    },

    /* A caravana (4ª faixa) soma torcedores pelo valor do envio. */
    caravana: { porMoeda: 0.05, minimo: 8, maximo: 120 },

    /* Sem comentário, torcedores sem @ chegam devagar pra cena não ficar
       morta (não contam no placar). */
    genericos: { ligado: true, intervalo: 2.2, porSetor: 7, calma: 6 },

    faixas: [
      { moedas: 1, nome: "Sinalizador" },
      { moedas: 10, nome: "Bandeirão" },
      { moedas: 100, nome: "Mosaico" },
      { moedas: 500, nome: "Caravana" },
      { moedas: 3000, nome: "Show lendário" },
    ],

    som: true,
    volume: 70,
    musica: 40,
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

window.TORCIDA_PRESET_PADRAO = "estadio";
