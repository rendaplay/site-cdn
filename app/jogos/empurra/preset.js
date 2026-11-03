/* Presets do Empurra-Empurra. Escolha com ?preset=<chave>. O painel do jogo
   (tecla P) salva ajustes por cima do preset neste PC, sem mexer aqui.

   As faixas seguem as do kit (1, 10, 100, 500, 3000 moedas). O valor que
   conta é o do envio inteiro: rosa ×10 = 10 moedas = segunda faixa. */
"use strict";

window.EMPURRA_PRESETS = {
  centro: {
    titulo: "Empurra-Empurra",
    /* Diretrizes de monetização do TikTok: a tela não pede presente nem
       mostra moedas. */
    modoSeguro: true,

    /* Sem escudo, mascote oficial nem jogador: cada time é um bicho
       genérico de desenho vestindo a camisa (cores e padrão) com o número
       nas costas. Apelido é palavra inteira, sem acento e minúsculo; nome
       que serve pra mais de um time ("tricolor") fica de fora. `sigla` vai
       na placa; `peso` só pesa na plateia de demonstração. */
    times: [
      { id: "flamengo", nome: "Flamengo", sigla: "FLA", bicho: "urso", cor: "#d81f2a", cor2: "#111111", calcao: "#ffffff", padrao: "horiz", numero: 10, peso: 10,
        apelidos: ["flamengo", "mengo", "mengao", "fla"] },
      { id: "corinthians", nome: "Corinthians", sigla: "COR", bicho: "leao", cor: "#f4f4f4", cor2: "#111111", calcao: "#111111", padrao: "mangas", numero: 9, peso: 10,
        apelidos: ["corinthians", "corintia", "curintia", "timao", "coringao"] },
      { id: "palmeiras", nome: "Palmeiras", sigla: "PAL", bicho: "elefante", cor: "#0b7a3e", cor2: "#ffffff", calcao: "#ffffff", padrao: "liso", numero: 7, peso: 8,
        apelidos: ["palmeiras", "verdao", "porco", "palestra"] },
      { id: "saopaulo", nome: "São Paulo", sigla: "SAO", bicho: "panda", cor: "#f4f4f4", cor2: "#d81f2a", calcao: "#ffffff", padrao: "faixa", numero: 11, peso: 6,
        apelidos: ["sao paulo", "spfc", "soberano"] },
      { id: "santos", nome: "Santos", sigla: "SAN", bicho: "pinguim", cor: "#f4f4f4", cor2: "#111111", calcao: "#ffffff", padrao: "liso", numero: 8, peso: 4,
        apelidos: ["santos", "peixe"] },
      { id: "vasco", nome: "Vasco", sigla: "VAS", bicho: "hipopotamo", cor: "#f4f4f4", cor2: "#111111", calcao: "#111111", padrao: "diagonal", numero: 5, peso: 6,
        apelidos: ["vasco", "vascao"] },
      { id: "fluminense", nome: "Fluminense", sigla: "FLU", bicho: "gato", cor: "#7a1131", cor2: "#0b6b3a", calcao: "#ffffff", padrao: "listras", numero: 4, peso: 4,
        apelidos: ["fluminense", "flu", "nense"] },
      { id: "botafogo", nome: "Botafogo", sigla: "BOT", bicho: "coala", cor: "#151515", cor2: "#f4f4f4", calcao: "#151515", padrao: "listras", numero: 3, peso: 4,
        apelidos: ["botafogo", "fogao", "glorioso"] },
      { id: "gremio", nome: "Grêmio", sigla: "GRE", bicho: "tigre", cor: "#3aa6ee", cor2: "#111111", calcao: "#111111", padrao: "listras", numero: 2, peso: 5,
        apelidos: ["gremio", "imortal"] },
      { id: "internacional", nome: "Internacional", sigla: "INT", bicho: "touro", cor: "#d81f2a", cor2: "#ffffff", calcao: "#ffffff", padrao: "liso", numero: 6, peso: 5,
        apelidos: ["internacional", "inter", "colorado"] },
      { id: "atletico", nome: "Atlético-MG", sigla: "CAM", bicho: "rinoceronte", cor: "#f4f4f4", cor2: "#111111", calcao: "#111111", padrao: "listras", numero: 1, peso: 5,
        apelidos: ["atletico", "galo"] },
      { id: "cruzeiro", nome: "Cruzeiro", sigla: "CRU", bicho: "coelho", cor: "#1f4fb4", cor2: "#ffffff", calcao: "#ffffff", padrao: "liso", numero: 99, peso: 5,
        apelidos: ["cruzeiro", "raposa", "cabuloso"] },
    ],

    /* `fim` é a festa do vencedor; `intervalo`, o ranking da live na tela
       antes da próxima rodada. */
    rodada: { duracao: 120, fim: 6, intervalo: 7 },

    /* Arena em metros: o círculo central, o tamanho de cada mascote e o
       atrito do gramado (por segundo). Quem passa da borda fica `beira` s
       cambaleando; um comentário do próprio time nessa hora tem `salvar`
       de chance de trazer de volta, e no fim da cambaleada sobra `voltar`
       de chance de se segurar sozinho. */
    arena: { raio: 4.6, corpo: 0.55, atrito: 2.4, beira: 1.3, salvar: 0.5, voltar: 0.25 },

    /* Comentário com o time: 1 empurrão por pessoa a cada `intervalo` s.
       Curtida: um empurrão fraco, no mesmo limite. O empurrão é a
       velocidade que o rival leva (m/s); a força do time (comentários
       recentes, que somem pela metade a cada `meiaVida` s) aumenta isso em
       `porForca` por ponto, até `forcaMax` pontos. */
    chat: { intervalo: 1.5 },
    empurrao: { chat: 4.4, curtida: 2.2, alcance: 3.2, porForca: 0.06, forcaMax: 12, meiaVida: 6 },

    /* O juiz apita a cada `intervalo` s e corre até quem mais empurrou desde
       o último apito: metade das vezes dá um empurrão forte, metade dá
       amarelo (o mascote fica `tonto` s sem empurrar). */
    arbitro: { intervalo: 20, anda: 1.1, corre: 4.2, empurrao: 7.5, tonto: 2 },

    /* Presentes, da faixa 1 à 5: ombrada, carrinho e voadora (velocidade
       que o rival leva), cartão vermelho e terremoto (o time cresce
       `cresce` vezes por `gigante` s). Presente de faixa `revive` em diante
       traz de volta o time que já caiu. */
    presentes: { ombrada: 7, carrinho: 6.5, voadora: 10.5, gigante: 5, cresce: 1.6, revive: 2 },

    faixas: [
      { moedas: 1, nome: "Ombrada" },
      { moedas: 10, nome: "Carrinho" },
      { moedas: 100, nome: "Voadora" },
      { moedas: 500, nome: "Cartão vermelho" },
      { moedas: 3000, nome: "Terremoto" },
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

window.EMPURRA_PRESET_PADRAO = "centro";
