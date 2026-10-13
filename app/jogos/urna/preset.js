/* Preset da Urna Eletrônica. `candidatos` é o nome da lista global
   (comum/eleicao/candidatos.js); `arte` troca a caricatura pela cópia leve
   desta pasta. Escolha com ?preset=<chave>; o painel (tecla P) salva
   ajustes por cima neste PC. */
"use strict";

window.URNA_PRESETS = {
  "lula-flavio": {
    titulo: "Urna Eletrônica",
    candidatos: "CANDIDATOS",
    arte: ["arte/lula.webp", "arte/flavio.webp"],
    rodada: { segundos: 300, prorrogacao: 20, prorrogacoesMax: 3, apuracao: 6, vitoria: 12, automatica: true },
    massa: 100,
    viradaMinima: 30,
    comentario: { pontos: 1, intervalo: 5, teto: 3 },
    curtida: { cada: 25, pontos: 1, intervalo: 5, teto: 3 },
    seguiu: { pontos: 1 },
    modoSeguro: true,
    som: true,
    volume: 80,
    musica: 100,
  },
};
window.URNA_PRESET_PADRAO = "lula-flavio";
