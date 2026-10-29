/* Preset da Corrida Presidencial. `candidatos` é o nome da lista global
   (comum/eleicao/candidatos.js); `lados` troca campos de cada candidato só
   neste jogo; `arte` troca a caricatura pela cópia leve desta pasta.
   Escolha com ?preset=<chave>; o painel (tecla P) salva ajustes por cima
   neste PC.

   Velocidade em m/s e metros por voto: com a plateia de demonstração a
   corrida de 1000 m dura de 2 a 4 min (média ~3 min). Sem nenhum apoio
   ela levaria quase 7 min. */
"use strict";

window.PRESIDENCIAL_PRESETS = {
  "lula-flavio": {
    titulo: "Corrida Presidencial",
    candidatos: "CANDIDATOS",
    /* Trump e Bolsonaro correm juntos no 22: o Trump é o parceiro de chapa,
       desenhado colado no Flávio, e o pódio usa a arte dos dois.
       `comando` é o que a tela pede, igual à Batalha; 13, 22 e os nomes
       continuam valendo no chat. */
    lados: [
      { comando: "vermelho" },
      {
        nome: "Trump e Bolsonaro",
        plural: true,
        comando: "verde",
        comandos: ["22", "flavio", "verde", "bolsonaro", "trump"],
        parceiro: { id: "trump", arte: "arte/trump.webp" },
        podio: "arte/trump-flavio.webp",
      },
    ],
    arte: ["arte/lula.webp", "arte/flavio.webp"],
    pista: 1000,
    base: 2.5,
    comentario: { pontos: 1, intervalo: 5, teto: 6 },
    curtida: { cada: 25, pontos: 0.5, intervalo: 5, teto: 6 },
    seguiu: { pontos: 2 },
    faixas: [{ de: 1, efeito: "impulso" }, { de: 10, efeito: "nitro" }, { de: 100, efeito: "banana" }, { de: 500, efeito: "jato" }],
    impulso: { metrosPorMoeda: 1, teto: 120 },
    nitro: { segundos: 2, metrosPorMoeda: 1, teto: 120 },
    banana: { segundos: 2.5, metrosPorMoeda: 0.8, teto: 150 },
    jato: { segundos: 3, metrosPorMoeda: 0.6, teto: 260 },
    retaFinal: 0.85,
    encostou: { de: 30, para: 8 },
    modoSeguro: true,
    largada: 3,
    chegada: 2.4,
    podio: 10,
    som: true,
    volume: 80,
    musica: 100,
  },
};
window.PRESIDENCIAL_PRESET_PADRAO = "lula-flavio";
