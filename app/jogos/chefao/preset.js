/* Presets do Chefão Coletivo. Escolha com ?preset=<chave>. O painel do jogo
   (tecla P) salva ajustes por cima do preset neste PC, sem mexer aqui.

   Dano = moedas do envio (combo somado) × danoPorMoeda. As faixas seguem
   as do kit (1, 10, 100, 500, 3000 moedas). A vida dos chefões está em
   dano: 6.000 = 600 moedas, ou 300 comentários. */
"use strict";

window.CHEFAO_PRESETS = {
  brasil: {
    titulo: "Chefão Coletivo",
    /* Diretrizes de monetização do TikTok: a tela não pede presente nem
       promete vantagem por ele (sem "faltam X", sem moedas, sem "presente 2×"). */
    modoSeguro: true,
    danoPorMoeda: 10,
    comentario: { dano: 20, espera: 4 },
    curtida: { cada: 25, dano: 10, espera: 3, teto: 2 },
    seguiu: 100,
    compartilhou: 300,

    /* Vida de cada rodada; depois da lista, a última × crescimento a cada rodada. */
    vida: [6000, 10000, 16000, 25000],
    crescimento: 1.5,

    faixas: [
      { moedas: 1, nome: "Peteleco", golpe: "peteleco" },
      { moedas: 10, nome: "Bicuda", golpe: "bicuda" },
      { moedas: 100, nome: "Chinelada", golpe: "chinelada" },
      { moedas: 500, nome: "Rojão", golpe: "rojao" },
      { moedas: 3000, nome: "Chinelo da Mãe", golpe: "mae" },
    ],

    fases: { furia: 0.5, escudo: 0.25, escudoVida: 0.12 },
    /* Contra-ataque: anuncia, dá `duracao` s pro chat bater `meta` da vida
       máxima; se não bater, cura `cura`. Só com gente ativa (`ativoNos` s). */
    contra: { primeiro: 45, intervalo: 55, intervaloFuria: 35, duracao: 20, meta: 0.08, cura: 0.12, tonto: 6, tontoDano: 1.5, ativoNos: 60 },
    curaParado: { depois: 20, porSegundo: 0.01 },
    faltam: 0.15,
    vitoria: 12,
    guardadoMax: 0.5,

    surpresa: {
      ligada: true,
      semPresente: 40,
      intervalo: 120,
      ordem: ["dobro", "pontoFraco", "mutirao"],
      duracao: { dobro: 60, pontoFraco: 25, mutirao: 30 },
      multiplicador: { dobro: 2, pontoFraco: 3 },
      mutirao: { pessoas: 8, dano: 0.06 },
    },

    /* Pro "faltam X: uma Rosquinha derruba". Nome como aparece no app em PT. */
    sugestoes: [
      { nome: "Rosa", moedas: 1 },
      { nome: "Coração com os dedos", moedas: 5 },
      { nome: "Rosquinha", moedas: 30 },
      { nome: "Mãos em coração", moedas: 100 },
      { nome: "Arma de dinheiro", moedas: 500 },
      { nome: "Galáxia", moedas: 1000 },
      { nome: "Interestelar", moedas: 10000 },
      { nome: "Leão", moedas: 29999 },
    ],

    chefes: [
      {
        id: "boleto",
        nome: "O Boleto Gigante",
        cor: "#E23B3B",
        entrada: "Vence hoje, hein!",
        furia: "PROTESTADO! Agora tem multa!",
        escudo: "Débito automático!",
        contra: "Juros",
        contraFala: "Hora dos juros!",
        curou: "Juros de 12% ao mês. Obrigado!",
        tonto: "Erro no código de barras...",
        derrota: "Quitado...",
        falas: ["Pagou? Não pagou!", "Tem 2ª via, viu?", "Não aceito Pix parcelado!", "Já caiu no Serasa?", "Venci ontem e hoje!"],
      },
      {
        id: "chefe",
        nome: "O Chefe do Trabalho",
        cor: "#2F5FD0",
        entrada: "Reunião rapidinha. Três horas.",
        furia: "HORA EXTRA PRA TODO MUNDO!",
        escudo: "Planilha blindada!",
        contra: "Feedback construtivo",
        contraFala: "Vem cá, vamos ter uma conversinha...",
        curou: "Isso aí, vestiu a camisa!",
        tonto: "Quem marcou essa reunião?",
        derrota: "Tá bom... tira férias.",
        falas: ["Isso é pra ontem!", "Vamos alinhar?", "Sábado você vem, né?", "Mais um e-mail, com cópia!", "Somos uma família!"],
      },
      {
        id: "mosquito",
        nome: "O Mosquito da Dengue Rei",
        cor: "#C8283A",
        entrada: "Bzzz! Água parada é meu palácio!",
        furia: "ENXAME! Bzzzzzz!",
        escudo: "Me escondi no pneu velho!",
        contra: "Picada real",
        contraFala: "Vou picar a live inteira!",
        curou: "Bzzz... achei um vaso de planta!",
        tonto: "Fumacê? Cof cof...",
        derrota: "Fumacê não...",
        falas: ["Bzzz bzzz!", "Deixou a tampa aberta?", "Repelente? Hahaha!", "Sou da realeza!", "Zzzzum!"],
      },
      {
        id: "onibus",
        nome: "O Ônibus Lotado",
        cor: "#F2A81D",
        entrada: "Cabe mais um, chega pra trás!",
        furia: "EXPRESSO! Sem parada!",
        escudo: "Catraca travada!",
        contra: "Freada brusca",
        contraFala: "Segura aí que vou frear!",
        curou: "Subiu mais gente!",
        tonto: "Pneu furou...",
        derrota: "Ponto final...",
        falas: ["Ô motorista!", "Próxima parada: amanhã!", "Chega pra trás aí!", "Tem lugar no teto!", "O ar tá ligado, juro!"],
      },
    ],

    destaqueMoedas: 100,
    som: true,
    volume: 60,

    /* Plateia de demonstração (?demo=1). Nome em inglês, como a TikTokLive manda. */
    demo: {
      ritmo: 1.4,
      presentes: [
        { nome: "Rose", moedas: 1, peso: 30 },
        { nome: "Finger Heart", moedas: 5, peso: 10 },
        { nome: "Perfume", moedas: 20, peso: 6 },
        { nome: "Doughnut", moedas: 30, peso: 5 },
        { nome: "Hand Hearts", moedas: 100, peso: 2.5 },
        { nome: "Money Gun", moedas: 500, peso: 0.7 },
        { nome: "Galaxy", moedas: 1000, peso: 0.4 },
        { nome: "Lion", moedas: 29999, peso: 0.02 },
      ],
    },
  },
};

window.CHEFAO_PRESET_PADRAO = "brasil";
