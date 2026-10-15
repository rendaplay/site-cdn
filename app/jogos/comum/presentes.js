/* Presentes populares que o streamer pode configurar (launcher e jogos web).
   `api` é o nome que a API do TikTok manda, em inglês; `chave` é como a
   escolha fica salva. A rosa de 1 chega como "Rose" e a de 10 como "Rosa";
   nomes conferidos na lista oficial de presentes (out/2026). */
"use strict";

(function (raiz) {
  const PRESENTES_TIKTOK = [
    { chave: "rose:1", api: "Rose", nome: "Rosa", moedas: 1, icone: "🌹" },
    { chave: "tiktok", api: "TikTok", nome: "TikTok", moedas: 1, icone: "🎵" },
    { chave: "gg", api: "GG", nome: "GG", moedas: 1, icone: "🎮" },
    { chave: "white rose", api: "White Rose", nome: "Rosa branca", moedas: 1, icone: "🌹" },
    { chave: "finger heart", api: "Finger Heart", nome: "Coração com os dedos", moedas: 5, icone: "🫰" },
    { chave: "rosa", api: "Rosa", nome: "Rosa", moedas: 10, icone: "🌹" },
    { chave: "perfume", api: "Perfume", nome: "Perfume", moedas: 20, icone: "🧴" },
    { chave: "doughnut", api: "Doughnut", nome: "Rosquinha", moedas: 30, icone: "🍩" },
    { chave: "hand heart", api: "Hand Heart", nome: "Mãos de coração", moedas: 100, icone: "🫶" },
    { chave: "sunglasses", api: "Sunglasses", nome: "Óculos", moedas: 199, icone: "🕶️" },
    { chave: "corgi", api: "Corgi", nome: "Corgi", moedas: 299, icone: "🐶" },
    { chave: "galaxy", api: "Galaxy", nome: "Galáxia", moedas: 1000, icone: "🌌" },
    { chave: "lion", api: "Lion", nome: "Leão", moedas: 29999, icone: "🦁" },
    { chave: "tiktok universe", api: "TikTok Universe", nome: "Universo", moedas: 44999, icone: "🪐" },
  ];

  /* A escolha que vale pra este presente: primeiro nome + preço unitário,
     depois só o nome. `escolhas` é { chave: valor }. */
  function escolhaDoPresente(escolhas, nome, moedas) {
    if (!escolhas || !nome) return undefined;
    const n = String(nome).trim().toLowerCase();
    return escolhas[`${n}:${moedas}`] ?? escolhas[n];
  }

  raiz.PRESENTES_TIKTOK = PRESENTES_TIKTOK;
  raiz.escolhaDoPresente = escolhaDoPresente;
  if (typeof module !== "undefined") module.exports = { PRESENTES_TIKTOK, escolhaDoPresente };
})(typeof window !== "undefined" ? window : globalThis);
