/* Presets do Pinball Gigante. Escolha com ?preset=<chave>. O painel do jogo
   (tecla P) salva ajustes por cima do preset neste PC, sem mexer aqui.

   As faixas seguem as do kit (1, 10, 100, 500, 3000 moedas). O valor que
   conta é o do envio inteiro: rosa ×10 = 10 moedas = segunda faixa. */
"use strict";

window.PINBALL_PRESETS = {
  neon: {
    titulo: "Pinball Gigante",
    /* Diretrizes de monetização do TikTok: a tela não pede presente nem
       mostra moedas. */
    modoSeguro: true,

    /* Tempo da rodada (s). No fim, pódio com o top 3 e a melhor bola. */
    duracao: 180,

    /* Segundos do pódio entre uma rodada e outra. */
    podio: 10,

    /* Sem comentário nem presente por tanto tempo, a mesa vira vitrine e o
       relógio para (o TikTok derruba live parada). */
    ociosidade: 45,

    /* Bolas de comentário na mesa ao mesmo tempo; passou disso, espera numa
       fila curta. Bola de presente pode passar até `maxPresente`. */
    maxBolas: 12,
    maxPresente: 16,
    filaCurta: 8,

    /* Comentário de quem já tem bola: a bola pula pra cima, uma vez a cada
       tantos segundos. */
    intervaloTilt: 10,

    /* Inclinação da mesa (px/s²) e força do lançador (px/s). */
    gravidade: 1500,
    lancamento: 2700,

    /* Flippers sozinhos: reação entre `reacao` e `reacao + variacao` s e
       chance de deixar passar a bola. Maior erro = bola cai mais cedo. */
    ia: { reacao: 0.03, variacao: 0.09, erro: 0.12 },

    /* Pontos de cada peça da mesa. */
    pontos: { bumper: 1000, estilingue: 250, alvo: 2500, banco: 10000, rampa: 5000, rollover: 500, rollovers: 7500 },

    /* Curtidas enchem o multiplicador (cada uma vale `curtida`, cheio em 1);
       cheio, tudo vale dobrado por `duracao` s. */
    multiplicador: { curtida: 0.005, curtidaMaxima: 0.08, duracao: 10 },

    /* Barra coletiva da live: cheia, a mesa vira festa por `festa` s (tudo
       vale dobrado) e a próxima meta fica `cresce` vezes maior. Quem estoura
       leva `bonus` da meta em pontos. */
    jackpot: { meta: 1500000, cresce: 1.5, festa: 10, bonus: 0.03 },

    /* Melhor bola mínima pra valer recorde da live. */
    recordeMinimo: 20000,

    /* Duração dos efeitos de presente (s), pedaço do jackpot que a bola de
       fogo enche e quantos esperam na fila de cada pessoa. */
    ima: 6,
    fogo: 10,
    fogoJackpot: 0.08,
    mesa: 12,
    filaMaxima: 12,

    faixas: [
      { moedas: 1, nome: "Bola brilhante" },
      { moedas: 10, nome: "Ímã" },
      { moedas: 100, nome: "Multibola" },
      { moedas: 500, nome: "Bola de fogo" },
      { moedas: 3000, nome: "Mesa é sua" },
    ],

    som: true,
    volume: 70,
    musica: 25,
    narrador: true,

    /* Plateia de demonstração (?demo=1). Nome em inglês, como a TikTokLive manda. */
    demo: {
      ritmo: 2.2,
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

window.PINBALL_PRESET_PADRAO = "neon";
