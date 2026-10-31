/* Presets do Cai ou Não Cai?. Escolha com ?preset=<chave>. O painel do jogo
   (tecla P) salva ajustes por cima do preset neste PC, sem mexer aqui.

   As faixas seguem as do kit (1, 10, 100, 500, 3000 moedas). O valor que
   conta é o do envio inteiro: rosa ×10 = 10 moedas = segunda faixa. */
"use strict";

window.CAIOUNAOCAI_PRESETS = {
  brasileirao: {
    titulo: "Cai ou Não Cai?",
    /* Diretrizes de monetização do TikTok: a tela não pede presente nem
       mostra moedas. */
    modoSeguro: true,

    /* Sem escudo nem jogador: o time aparece pelo nome, pelas cores e pelo
       padrão da camisa. Apelido é palavra inteira, sem acento e minúsculo;
       nome que serve pra mais de um time ("tricolor") fica de fora. `peso`
       só pesa na plateia de demonstração. */
    times: [
      { id: "flamengo", nome: "Flamengo", cor: "#d81f2a", cor2: "#111111", padrao: "horiz", numero: 10, peso: 10,
        apelidos: ["flamengo", "mengo", "mengao", "fla"] },
      { id: "corinthians", nome: "Corinthians", cor: "#f4f4f4", cor2: "#111111", padrao: "mangas", numero: 9, peso: 10,
        apelidos: ["corinthians", "corintia", "curintia", "timao", "coringao"] },
      { id: "palmeiras", nome: "Palmeiras", cor: "#0b7a3e", cor2: "#ffffff", padrao: "liso", numero: 7, peso: 8,
        apelidos: ["palmeiras", "verdao", "porco", "palestra"] },
      { id: "saopaulo", nome: "São Paulo", cor: "#f4f4f4", cor2: "#d81f2a", padrao: "faixa", numero: 11, peso: 6,
        apelidos: ["sao paulo", "spfc", "soberano"] },
      { id: "santos", nome: "Santos", cor: "#f4f4f4", cor2: "#111111", padrao: "liso", numero: 8, peso: 4,
        apelidos: ["santos", "peixe"] },
      { id: "vasco", nome: "Vasco", cor: "#f4f4f4", cor2: "#111111", padrao: "diagonal", numero: 5, peso: 6,
        apelidos: ["vasco", "vascao"] },
      { id: "fluminense", nome: "Fluminense", cor: "#7a1131", cor2: "#0b6b3a", padrao: "listras", numero: 4, peso: 4,
        apelidos: ["fluminense", "flu", "nense"] },
      { id: "botafogo", nome: "Botafogo", cor: "#151515", cor2: "#f4f4f4", padrao: "listras", numero: 3, peso: 4,
        apelidos: ["botafogo", "fogao", "glorioso"] },
      { id: "gremio", nome: "Grêmio", cor: "#3aa6ee", cor2: "#111111", padrao: "listras", numero: 2, peso: 5,
        apelidos: ["gremio", "imortal"] },
      { id: "internacional", nome: "Internacional", cor: "#d81f2a", cor2: "#ffffff", padrao: "liso", numero: 6, peso: 5,
        apelidos: ["internacional", "inter", "colorado"] },
      { id: "atletico", nome: "Atlético-MG", cor: "#f4f4f4", cor2: "#111111", padrao: "listras", numero: 1, peso: 5,
        apelidos: ["atletico", "galo"] },
      { id: "cruzeiro", nome: "Cruzeiro", cor: "#1f4fb4", cor2: "#ffffff", padrao: "liso", numero: 99, peso: 5,
        apelidos: ["cruzeiro", "raposa", "cabuloso"] },
    ],

    /* Os primeiros ficam no degrau dourado; os últimos caem no fim da rodada. */
    zonas: { topo: 3, queda: 4 },

    /* `queda` é o tempo da cena dos times caindo; `intervalo`, o do ranking
       da live na tela antes da próxima rodada. */
    rodada: { duracao: 180, queda: 8, intervalo: 7 },

    /* Comentário: 1 ponto por pessoa a cada `intervalo` s, pra o spam não
       decidir sozinho. Curtida: 1 ponto a cada tantas curtidas da pessoa. */
    chat: { intervalo: 1.5, ponto: 1, curtidasPorPonto: 15 },

    /* Presente: pontos = moedas do envio × isto. */
    pontosPorMoeda: 5,

    faixas: [
      { moedas: 1, nome: "Confete" },
      { moedas: 10, nome: "Salto duplo" },
      { moedas: 100, nome: "Foguete" },
      { moedas: 500, nome: "Terremoto" },
      { moedas: 3000, nome: "Foguete lendário" },
    ],

    som: true,
    volume: 70,
    musica: 30,
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

window.CAIOUNAOCAI_PRESET_PADRAO = "brasileirao";
