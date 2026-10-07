/* Presets do Racha. Escolha com ?preset=<chave>. O painel (tecla P) salva
   ajustes por cima do preset neste PC, sem mexer neste arquivo.

   Faixas: a partir de quantas moedas (combo somado) cada efeito entra.
   `nomes` traduz o nome que a TikTokLive manda (quase sempre em inglês)
   pro que aparece no card; presente fora da lista aparece como veio. */
"use strict";

window.RACHA_PRESETS = {
  classico: {
    titulo: "Racha da Live",
    /* Diretrizes de monetização do TikTok: a tela não pede presente nem
       promete vantagem por ele (sem 2×, sem "faltam", sem placar de moedas). */
    modoSeguro: true,
    pista: 1000,
    velocidade: 10,
    variacao: 0.03,
    oscilacao: 0.05,
    fases: { espera: 15, largada: 3.5, chegada: 6, podio: 9 },
    minimoPilotos: 2,
    maxPilotos: 300,
    inatividade: 300,
    buzina: { intervalo: 8, maximo: 6, multiplicador: 1.15, segundos: 1.5 },
    curtida: { metros: 0.2, maximo: 15, intervalo: 2 },
    seguiu: 3,
    compartilhou: 3,
    faixas: [
      { moedas: 1, efeito: "turbo" },
      { moedas: 10, efeito: "nitro" },
      { moedas: 100, efeito: "oleo" },
      { moedas: 500, efeito: "missil" },
      { moedas: 1000, efeito: "escudo" },
      { moedas: 3000, efeito: "bomba" },
    ],
    efeitos: {
      turbo: { multiplicador: 1.35, segundos: 1.5, porMoeda: 0.5, maximo: 6 },
      nitro: { multiplicador: 1.7, minimo: 3, maximo: 9 },
      oleo: { lento: 0.3, segundos: 2.5, nitro: 10 },
      missil: { lento: 0.05, segundos: 3, nitro: 12 },
      escudo: { segundos: 25, nitro: 14 },
      bomba: { lento: 0.1, segundos: 3, alcance: 5, multiplicador: 2.1, nitro: 15 },
    },
    retaFinal: { inicio: 0.85, multiplicador: 2 },
    ultrapassagem: { top: 5, intervalo: 2.5 },
    falta: 12,
    surpresa: {
      ligada: true,
      frio: 35,
      intervalo: 120,
      dobro: 60,
      chuva: { segundos: 40, lento: 0.88, buzina: 3 },
      missil: { segundos: 45, moedas: 100 },
    },
    teto: { vertical: 24, horizontal: 30 },
    destaque: 6,
    nomes: {
      Rose: "Rosa", GG: "GG", TikTok: "TikTok", "Ice Cream Cone": "Sorvete", "Finger Heart": "Coração",
      Perfume: "Perfume", Doughnut: "Rosquinha", "Hat and Mustache": "Chapéu", "Hand Hearts": "Mãos de coração",
      Confetti: "Confete", "Money Gun": "Arma de dinheiro", Galaxy: "Galáxia", Interstellar: "Interestelar",
      Lion: "Leão", Universe: "Universo", "Ultimate FANDOM": "Fandom",
    },
    som: true,
    volume: 60,
  },
};

window.RACHA_PRESET_PADRAO = "classico";
