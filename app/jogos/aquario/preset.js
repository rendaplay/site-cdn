/* Presets do Aquário da Live. Escolha com ?preset=<chave>. O painel do jogo
   (tecla P) salva ajustes por cima do preset neste PC, sem mexer aqui.

   As faixas seguem as do kit (1, 10, 100, 500, 3000 moedas). O valor que
   conta é o do envio inteiro: rosa ×10 = 10 moedas = segunda faixa.

   Tamanho do peixe em degraus: 1 é o filhote, `tamanho.maximo` é o da
   baleia. */
"use strict";

window.AQUARIO_PRESETS = {
  recife: {
    titulo: "Aquário da Live",
    /* Diretrizes de monetização do TikTok: a tela não pede presente nem
       mostra moedas. */
    modoSeguro: true,

    /* Peixes nadando ao mesmo tempo; passou disso, quem está há mais tempo
       sem interagir dorme na toca e volta quando comentar de novo. */
    maxPeixes: 40,

    /* Sem comentário, presente, seguir nem compartilhar por tanto tempo (s),
       os peixes dormem e aparece a chamada (o TikTok derruba live parada).
       Curtida sozinha não acorda: o toque na tela vem até de quem saiu. */
    ociosidade: 45,

    /* "pula" e "dança" no comentário: uma vez a cada tanto por pessoa (s). */
    intervaloTruque: 20,

    tamanho: { inicial: 1, maximo: 10, petisco: 0.5, floco: 0.12, petiscoGrande: 1.2 },

    /* Fome: sem comer por `apos` s, nada devagar e a barriga murcha; a cada
       `intervalo` s com fome encolhe `encolhe`, até perder no máximo `perda`
       do maior tamanho que já teve. Nunca morre. */
    fome: { apos: 120, intervalo: 45, encolhe: 0.25, perda: 1.5 },

    /* Barra coletiva: tudo enche (pontos abaixo); cheia, sobe o nível, ganha
       decoração e a próxima meta fica `cresce` vezes maior. */
    aquario: { meta: 120, cresce: 1.35, festa: 8 },
    pontos: { comentario: 1, peixeNovo: 2, curtida: 0.15, curtidaMaxima: 3, seguiu: 8, compartilhou: 8, presente: [4, 12, 30, 80, 200] },

    /* Duração dos efeitos (s) e quantos esperam na fila de cada pessoa. */
    tartaruga: 11,
    tubarao: 9,
    maiorTubarao: 30,
    baleia: 12,
    cardume: 20,
    filaMaxima: 10,

    faixas: [
      { moedas: 1, nome: "Bolhas brilhantes" },
      { moedas: 10, nome: "Água-viva" },
      { moedas: 100, nome: "Tartaruga" },
      { moedas: 500, nome: "Tubarão" },
      { moedas: 3000, nome: "Baleia" },
    ],

    som: true,
    volume: 70,
    musica: 30,
    narrador: true,

    /* Plateia de demonstração (?demo=1). Nome em inglês, como a TikTokLive manda. */
    demo: {
      ritmo: 2.4,
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

window.AQUARIO_PRESET_PADRAO = "recife";
