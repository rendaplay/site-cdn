/* Preset da Batalha: Ninja x Guerreiro. A versão genérica de "Naruto x Goku": personagens próprios, sem
 nome, roupa ou símbolo de anime (marca registrada).
 Abra com ?preset=ninja-guerreiro. Precisa carregar depois do preset.js (ver README). */
"use strict";

window.BATALHA_PRESETS["ninja-guerreiro"] = {
  titulo: "Ninja x Guerreiro",
  lados: [
    {
      nome: "Ninja",
      cor: "#3B4CC0",
      corEscura: "#0E1440",
      acento: "#E63946",
      foto: "presets/ilustracoes/ninja.svg",
      presente: { nome: "Rosa", icone: "🌹", aceitos: ["Rose", "Rosa"] },
      comandos: ["1", "ninja"],
    },
    {
      nome: "Guerreiro",
      cor: "#D62828",
      corEscura: "#4A0808",
      acento: "#FFC83D",
      foto: "presets/ilustracoes/guerreiro.svg",
      presente: { nome: "GG", icone: "GG", aceitos: ["GG"] },
      comandos: ["2", "guerreiro"],
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
