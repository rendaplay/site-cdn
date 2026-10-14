/* Presets da Chuva de Bolinha. Escolha com ?preset=<chave>. O painel do jogo
   (tecla P) salva ajustes por cima do preset neste PC, sem mexer aqui.

   As faixas seguem as do kit (1, 10, 100, 500, 3000 moedas). O valor que
   conta é o do envio inteiro: rosa ×10 = 10 moedas = segunda faixa. */
"use strict";

window.BOLINHA_PRESETS = {
  neon: {
    titulo: "Chuva de Bolinha",
    /* Diretrizes de monetização do TikTok: a tela não pede presente nem
       mostra moedas; curtida, seguidor e comentário também jogam. */
    modoSeguro: true,

    /* Pontos de cada pote, da esquerda pra direita. As pontas são raras. */
    potes: [50, 20, 10, 5, 2, 1, 2, 5, 10, 20, 50],
    destaque: 20,

    mesa: {
      linhas: 12,
      gravidade: 1500,
      quique: 0.38,
      quiqueParede: 0.4,
      empurraoParede: 90,
      velLado: 380,
      quiqueBolas: 0.55,
      atrito: 0.985,
      desvio: 0.3,
      velMax: 1150,
      raio: 22,
      raioPino: 7,
      /* Espalho da largada, em potes (desvio-padrão). */
      espalho: 0.8,
      limite: 160,
      /* Bolinhas que saem da fila por segundo quando ela enche. */
      vazao: 14,
    },

    rodada: { duracao: 120, podio: 9 },

    chat: { intervalo: 3, curtidas: 150, compartilhar: 5 },

    faixas: [
      { moedas: 1, nome: "Punhado", texto: "3 bolinhas", bolinhas: 3 },
      { moedas: 10, nome: "Bolada", texto: "10 bolinhas", bolinhas: 10 },
      { moedas: 100, nome: "Bolinha de ouro", texto: "ouro vale o dobro + 5", bolinhas: 5, ouro: 1 },
      { moedas: 500, nome: "Chuva", texto: "30 bolinhas do céu", bolinhas: 30, chuva: true },
      { moedas: 3000, nome: "Bolona", texto: "gigante + 40 bolinhas", bolinhas: 40, chuva: true, bolona: true },
    ],
    lendario: { moedas: 10000, nome: "Tempestade", texto: "bolona + 80 bolinhas", bolinhas: 80 },
    /* Com a bolona na mesa, os 3 potes do meio valem o máximo por tanto tempo. */
    bolonaDuracao: 10,

    surpresa: { ligada: true, semPresente: 45, intervalo: 90, duracao: 30, multiplica: 3 },

    destaqueMoedas: 100,
    som: true,
    volume: 60,
    musica: 25,

    /* Plateia de demonstração (?demo=1). Nome em inglês, como a TikTokLive manda. */
    demo: {
      ritmo: 1.6,
      presentes: [
        { nome: "Rose", moedas: 1, peso: 30 },
        { nome: "GG", moedas: 1, peso: 12 },
        { nome: "Finger Heart", moedas: 5, peso: 10 },
        { nome: "Perfume", moedas: 20, peso: 6 },
        { nome: "Doughnut", moedas: 30, peso: 4 },
        { nome: "Hand Hearts", moedas: 100, peso: 2 },
        { nome: "Money Gun", moedas: 500, peso: 0.7 },
        { nome: "Galaxy", moedas: 1000, peso: 0.4 },
        { nome: "Interstellar", moedas: 10000, peso: 0.05 },
      ],
    },
  },
};

window.BOLINHA_PRESET_PADRAO = "neon";
