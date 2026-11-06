/* Presets do Davi x Golias. Escolha com ?preset=<chave>. O painel do jogo
   (tecla P) salva ajustes por cima do preset neste PC, sem mexer aqui.

   As faixas seguem as do kit (1, 10, 100, 500, 3000 moedas). O valor que
   conta é o do envio inteiro: rosa ×10 = 10 moedas = segunda faixa. */
"use strict";

window.DAVIGOLIAS_PRESETS = {
  vale: {
    titulo: "Davi x Golias",
    /* Diretrizes de monetização do TikTok: a tela não pede presente nem
       mostra moedas. */
    modoSeguro: true,

    /* `tiro` é a pedra voando em câmera lenta (a lendária ganha `lenda` s
       a mais de abertura); `fim`, o gigante caindo (ou pisando);
       `intervalo`, o placar da live antes da próxima rodada. */
    rodada: { duracao: 120, tiro: 3.4, lenda: 1.5, fim: 5.5, intervalo: 7 },

    /* A funda enche em `cheia`. Comentário carrega 1 por pessoa a cada
       `intervalo` s; curtida, 1 a cada tantas curtidas da pessoa. Presente
       de quem não é o Golias carrega pela faixa (a última dispara na hora).
       No fim do tempo a pedra sai com o que tiver e acerta se passou de
       `acertoNoTempo` da funda. */
    funda: {
      cheia: 120,
      comentario: 1,
      intervalo: 1,
      curtidasPorCarga: 15,
      presente: [4, 14, 30, 45, 0],
      acertoNoTempo: 0.5,
    },

    /* Distância em metros do vale até o Davi. O gigante anda sozinho
       (mais devagar sem dono) e cada presente do Golias dá `passos` metros
       e cresce `crescimento`. O tremor (4ª faixa do Davi) empurra
       `empurrao` metros pra trás. */
    golias: {
      distancia: 100,
      velocidade: 0.5,
      velocidadeSemDono: 0.32,
      passos: [2, 5, 10, 18, 32],
      crescimento: [0.01, 0.03, 0.06, 0.1, 0.18],
      escalaMax: 1.8,
      empurrao: 10,
    },

    faixas: [
      { moedas: 1, nome: "Faísca", efeito: "carrega um pouco a funda" },
      { moedas: 10, nome: "Pedra extra", efeito: "carrega bem a funda" },
      { moedas: 100, nome: "Funda de fogo", efeito: "carrega muito a funda" },
      { moedas: 500, nome: "Tremor", efeito: "carrega muito e empurra o gigante pra trás" },
      { moedas: 3000, nome: "Pedra lendária", efeito: "atira na hora e sempre acerta" },
    ],

    som: true,
    volume: 70,
    musica: 35,
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

window.DAVIGOLIAS_PRESET_PADRAO = "vale";
