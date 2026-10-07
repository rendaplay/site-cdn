/* Preset da Batalha: Meninos x Meninas. Azul x rosa, com ilustração própria (sem foto). A rosa vale pras meninas.
 Abra com ?preset=meninos. Precisa carregar depois do preset.js (ver README). */
"use strict";

window.BATALHA_PRESETS["meninos"] = {
  titulo: "Meninos x Meninas",
  lados: [
    {
      nome: "Meninos",
      cor: "#1E6FE0",
      corEscura: "#0A2A66",
      acento: "#FFFFFF",
      foto: "presets/ilustracoes/menino.svg",
      presente: { nome: "GG", icone: "GG", aceitos: ["GG"] },
      comandos: ["1", "meninos", "menino"],
    },
    {
      nome: "Meninas",
      cor: "#E8458B",
      corEscura: "#6A1238",
      acento: "#FFFFFF",
      foto: "presets/ilustracoes/menina.svg",
      presente: { nome: "Rosa", icone: "🌹", aceitos: ["Rose", "Rosa"] },
      comandos: ["2", "meninas", "menina"],
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
