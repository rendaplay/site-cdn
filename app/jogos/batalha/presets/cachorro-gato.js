/* Preset da Batalha: Cachorro x Gato. O vira-lata caramelo contra o gato.
 Abra com ?preset=cachorro-gato. Precisa carregar depois do preset.js (ver README). */
"use strict";

window.BATALHA_PRESETS["cachorro-gato"] = {
  titulo: "Cachorro x Gato",
  lados: [
    {
      nome: "Cachorro",
      cor: "#E07B24",
      corEscura: "#5A2A05",
      acento: "#FFF1D6",
      foto: "presets/ilustracoes/cachorro.svg",
      presente: { nome: "Rosa", icone: "🌹", aceitos: ["Rose", "Rosa"] },
      comandos: ["1", "cachorro", "dog", "au"],
    },
    {
      nome: "Gato",
      cor: "#7048C8",
      corEscura: "#24124F",
      acento: "#FFC83D",
      foto: "presets/ilustracoes/gato.svg",
      presente: { nome: "GG", icone: "GG", aceitos: ["GG"] },
      comandos: ["2", "gato", "miau"],
    },
  ],
  rodada: { segundos: 180, prorrogacao: 20, vitoria: 14, automatica: true },
  meta: { moedas: 3000 },
  destaqueMoedas: 99,
  viradaMinima: 60,
  som: true,
  volume: 50,
  creditos: "",
};
