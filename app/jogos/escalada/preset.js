/* Presets da Escalada. Um preset é tudo que muda de uma escalada pra outra:
   o personagem, os times, o nome dos efeitos e os números da regra.
   Escolha com ?preset=<chave>. O painel (tecla P) salva ajustes por cima
   do preset neste PC, sem mexer neste arquivo.

   `aceitos` é o nome que a TikTokLive manda no evento (quase sempre em
   inglês). Na dúvida, mande o presente numa live de teste e confira na
   gravação do conector (dados/lives/*.jsonl). */
"use strict";

window.ESCALADA_PRESETS = {
  coqueiro: {
    titulo: "Coqueiro",
    /* Diretrizes de monetização do TikTok: nada de pedir presente, contagem
       de moedas ou "vale em dobro" na tela. Desligue só fora do TikTok. */
    modoSeguro: true,
    personagem: { nome: "Zé", regata: "#F2C230", bermuda: "#1E6FD9" },
    times: [
      {
        nome: "Ajuda",
        cor: "#17F864",
        comandos: ["1", "sobe", "ajuda"],
        presente: { nome: "Rosa", aceitos: ["Rose", "Rosa"] },
        efeitos: ["Empurrão", "Água de coco", "Escada", "Asa-delta", "Foguete"],
      },
      {
        nome: "Derruba",
        cor: "#FF5A36",
        comandos: ["2", "cai", "derruba"],
        presente: { nome: "TikTok", aceitos: ["TikTok"] },
        efeitos: ["Coquinho", "Sagui", "Ventania", "Bronzeador", "Urubu"],
      },
    ],
    /* Faixas de preço do kit: a partir de quantas moedas (combo somado)
       cada efeito entra. */
    faixas: [1, 10, 100, 500, 3000],
    regras: {
      metrosPorMoeda: 0.5,
      subidaSozinho: 0.12,
      /* Até o primeiro checkpoint ele sobe mais rápido: começo de tentativa
         é o ponto morto da live (longe demais pra ajudar valer a pena). */
      arrancada: 2,
      checkpoint: 100,
      corda: 50,
      comentario: { metros: 0.3, intervalo: 8 },
      curtida: 0.03,
      seguiu: 3,
      compartilhou: 5,
      recordeMinimo: 100,
      salvarCorda: 0.5,
      /* Acima de `acima` moedas o presente rende menos por moeda (potência
         `expoente`): Leão (29.999) sobe ~4,7 km em vez de 15 km. */
      retorno: { acima: 3000, expoente: 0.5 },
      /* Segundos que o presente de quem nunca escolheu time espera um
         comentário 1/2 antes de ir pra Ajuda. 0 = vai direto pra Ajuda. */
      pendente: 10,
      /* Sabotagem que sobra com o Zé no chão atola ele, até este tanto de metros. */
      atolar: true,
      atoladoMax: 30,
      /* Queda num golpe só a partir da qual vale "maior queda da live". */
      recordeQueda: 100,
    },
    surpresa: {
      ligada: true,
      frio: 40,
      intervalo: 150,
      dobro: 60,
      chuva: { segundos: 30, multiplicador: 5, intervalo: 2 },
      ventania: { segundos: 30, metros: 40, segurar: 100 },
    },
    destaqueMoedas: 100,
    /* Presente lendário: anúncio maior e espetáculo dobrado. */
    lendarioMoedas: 10000,
    som: true,
    volume: 60,
  },
};

window.ESCALADA_PRESET_PADRAO = "coqueiro";
