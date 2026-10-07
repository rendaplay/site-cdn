/* Preset da Batalha: Flamengo x Corinthians. Só nome e cor dos times: sem escudo nem marca (direito de imagem).
 A ilustração é uma camisa genérica desenhada.
 Abra com ?preset=flamengo-corinthians. Precisa carregar depois do preset.js (ver README). */
"use strict";

window.BATALHA_PRESETS["flamengo-corinthians"] = {
  titulo: "Flamengo x Corinthians",
  lados: [
    {
      nome: "Flamengo",
      cor: "#C8102E",
      corEscura: "#3D0009",
      acento: "#111111",
      foto: "presets/ilustracoes/camisa-rubro-negra.svg",
      presente: { nome: "Rosa", icone: "🌹", aceitos: ["Rose", "Rosa"] },
      comandos: ["1", "flamengo", "mengao", "fla"],
    },
    {
      nome: "Corinthians",
      cor: "#2A2A2A",
      corEscura: "#050505",
      acento: "#FFFFFF",
      foto: "presets/ilustracoes/camisa-alvinegra.svg",
      presente: { nome: "GG", icone: "GG", aceitos: ["GG"] },
      comandos: ["2", "corinthians", "timao", "coringao"],
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
