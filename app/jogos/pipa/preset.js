/* Presets do Pipa Combate. Escolha com ?preset=<chave>. O painel do jogo
   (tecla P) salva ajustes por cima do preset neste PC, sem mexer aqui.

   As faixas seguem as do kit (1, 10, 100, 500, 3000 moedas). O valor
   que conta é o do envio inteiro: rosa ×10 = 10 moedas = cerol prata. */
"use strict";

window.PIPA_PRESETS = {
  quebrada: {
    titulo: "Pipa Combate",
    /* Diretriz de monetização do TikTok: nada de pedir presente, contar
       moedas na tela ou evento que premia presente (cerol dourado). */
    modoSeguro: true,
    maxPipas: 40,
    tetoPipas: 56,
    reentrada: 4,
    escudoCompartilhar: 15,
    faixas: [
      { moedas: 1, nome: "Relo", efeito: "corta 1", cortes: 1, escudo: 0 },
      { moedas: 10, nome: "Cerol prata", efeito: "corta 1 + escudo 30 s", cortes: 1, escudo: 30 },
      { moedas: 100, nome: "Aparador", efeito: "corta 3 + escudo", cortes: 3, escudo: 45 },
      { moedas: 500, nome: "Pipa gigante", efeito: "gigante, corta 5", cortes: 5, escudo: 60, gigante: 60 },
      { moedas: 3000, nome: "Rabiola de fogo", efeito: "fogo, corta 10", cortes: 10, escudo: 120, gigante: 120, fogo: true },
    ],
    gas: { max: 5, forca: 0.35, decai: 8, espera: 1.5, curtidas: 30 },
    relo: { primeiro: 4, intervaloMin: 3, intervaloMax: 6, duracao: 1.8, simultaneos: 2, minimoNoCeu: 4, confortavel: 14, carencia: 3 },
    ataque: { duracao: 1.2, fogo: 0.55, fogoSegundos: 12, simultaneos: 4, esperaMaxima: 20 },
    rei: { minimo: 15, firme: 5, anuncio: 20 },
    surpresa: {
      ligada: true,
      semPresente: 45,
      intervalo: 90,
      ordem: ["ventania", "dourado", "avoada"],
      duracao: { ventania: 20, dourado: 60, avoada: 25 },
      ventaniaLeva: 8,
      aparar: { escudo: 30, cortes: 2 },
    },
    destaqueMoedas: 100,
    som: true,
    volume: 60,
    /* Plateia de demonstração (?demo=1). Nome em inglês, como a TikTokLive manda. */
    demo: {
      ritmo: 1,
      presentes: [
        { nome: "Rose", moedas: 1, peso: 30 },
        { nome: "Finger Heart", moedas: 5, peso: 10 },
        { nome: "Perfume", moedas: 20, peso: 6 },
        { nome: "Doughnut", moedas: 30, peso: 4 },
        { nome: "Hand Hearts", moedas: 100, peso: 2 },
        { nome: "Galaxy", moedas: 1000, peso: 0.5 },
        { nome: "Lion", moedas: 29999, peso: 0.04 },
      ],
    },
  },
};

window.PIPA_PRESET_PADRAO = "quebrada";
