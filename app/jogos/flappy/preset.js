/* Presets do Voa, Tuca! Escolha com ?preset=<chave>. O painel do jogo
   (tecla P) salva ajustes por cima do preset neste PC, sem mexer aqui.

   As faixas seguem as do kit (1, 10, 100, 500, 3000 moedas). O valor que
   conta é o do envio inteiro: rosa ×10 = 10 moedas = segunda faixa.
   `dur` em segundos; `teto` é até onde presentes repetidos somam tempo. */
"use strict";

window.FLAPPY_PRESETS = {
  tuca: {
    titulo: "Voa, Tuca!",
    /* Diretrizes de monetização do TikTok: a tela não pede presente nem
       mostra moedas; curtida e seguidor também agem. */
    modoSeguro: true,
    /* auto: piloto automático sempre · streamer: só o teclado · misto: o
       piloto voa e o streamer assume ao apertar, até `devolver` s parado. */
    controle: "misto",
    devolver: 6,
    piloto: { erro: 16, atraso: 0.05, visaoNeblina: 300, sustoInversao: 0.3 },

    voo: {
      gravidade: 2900,
      pulo: 960,
      velocidade: 340,
      velocidadeMax: 500,
      acelera: 3,
      vao: 370,
      vaoMin: 300,
      aperta: 0.8,
      distancia: 600,
      largura: 172,
      desnivel: 380,
    },
    vidasMax: 3,
    preparo: 1.5,
    telaMorte: 6,

    times: {
      ajuda: { comandos: ["1", "ajuda", "ajudar", "salva"], presentes: ["Rose", "Rosa"] },
      caos: { comandos: ["2", "caos", "sabota", "derruba"], presentes: ["TikTok"] },
      padrao: "caos",
    },

    faixas: [
      {
        moedas: 1,
        caos: { efeito: "vento", nome: "Rajada", texto: "vento 3 s", dur: 3, teto: 9 },
        ajuda: { efeito: "pontos", nome: "Pão de queijo", texto: "+1 ponto", pontos: 1 },
      },
      {
        moedas: 10,
        caos: { efeito: "neblina", nome: "Neblina", texto: "10 s sem enxergar", dur: 10, teto: 18 },
        ajuda: { efeito: "escudo", nome: "Bolha", texto: "segura 1 batida", dur: 12, teto: 20 },
      },
      {
        moedas: 100,
        caos: { efeito: "gigante", nome: "Pilar gigante", texto: "3 pilares apertados", pilares: 3, teto: 8 },
        ajuda: { efeito: "lento", nome: "Câmera lenta", texto: "8 s + bolha", dur: 8, teto: 12 },
      },
      {
        moedas: 500,
        caos: { efeito: "inverte", nome: "De ponta-cabeça", texto: "inverte a gravidade 7 s", dur: 7, teto: 12 },
        ajuda: { efeito: "vida", nome: "Vida extra", texto: "+1 vida", vidas: 1 },
      },
      {
        moedas: 3000,
        caos: { efeito: "meteoros", nome: "Chuva de meteoros", texto: "10 s de meteoro", dur: 10, teto: 22 },
        ajuda: { efeito: "turbo", nome: "Asa de ouro", texto: "invencível 12 s", dur: 12, teto: 22 },
      },
    ],
    lendario: 10000,

    chat: { carga: 20, porPessoa: 2, curtidas: 50, bolha: 6 },

    surpresa: {
      ligada: true,
      semPresente: 45,
      intervalo: 90,
      ordem: ["chinelo", "dobro", "queijo"],
      duracao: { chinelo: 20, dobro: 30, queijo: 20 },
    },

    recordeFesta: 10,
    destaqueMoedas: 100,
    som: true,
    volume: 60,

    /* Plateia de demonstração (?demo=1). Nome em inglês, como a TikTokLive manda. */
    demo: {
      ritmo: 1.1,
      presentes: [
        { nome: "Rose", moedas: 1, peso: 26, lado: 0 },
        { nome: "TikTok", moedas: 1, peso: 14, lado: 1 },
        { nome: "Finger Heart", moedas: 5, peso: 10 },
        { nome: "Perfume", moedas: 20, peso: 6 },
        { nome: "Doughnut", moedas: 30, peso: 4 },
        { nome: "Hand Hearts", moedas: 100, peso: 2 },
        { nome: "Money Gun", moedas: 500, peso: 0.6 },
        { nome: "Galaxy", moedas: 1000, peso: 0.4 },
        { nome: "Lion", moedas: 29999, peso: 0.03 },
      ],
      lados: [
        { comentarios: ["1", "ajuda", "voa tuca"] },
        { comentarios: ["2", "derruba", "cai cai cai"] },
      ],
    },
  },
};

window.FLAPPY_PRESET_PADRAO = "tuca";
