/* Os dois lados dos jogos das eleições (2º turno). Índice 0 é sempre o 13 e
   1 o 22: regras, cores e falas contam com essa ordem. */
"use strict";

(function (raiz) {
  const ARTE = "../comum/eleicao/arte/";
  const CANDIDATOS = [
    {
      id: "lula", nome: "Lula", numero: "13",
      cor: "#D8141F", corEscura: "#5C0710", acento: "#FFFFFF",
      arte: ARTE + "lula.png", foto: ARTE + "lula.webp",
      presente: { nome: "Rosa", icone: "🌹", aceitos: ["Rose", "Rosa"], palavras: ["rosas", "rosinha"] },
      comandos: ["13", "lula", "vermelho"],
    },
    {
      id: "flavio", nome: "Flávio", numero: "22",
      cor: "#00873F", corEscura: "#00351A", acento: "#FFD400",
      arte: ARTE + "flavio.png", foto: ARTE + "flavio.webp",
      presente: { nome: "Rosa branca", icone: "🌹", imagem: ARTE + "rosa-branca.svg", aceitos: ["White Rose", "Rosa branca", "Rosa Branca", "GG"], palavras: ["branca", "rosa branca", "gg"] },
      comandos: ["22", "flavio", "verde"],
    },
  ];
  /* A rosa branca não tem emoji: com 🤍 a live lia "coração branco", que não existe. */
  function iconeDoPresente(presente) {
    return presente.imagem ? `<img class="icone-presente" src="${presente.imagem}" alt="${presente.nome}">` : presente.icone;
  }

  raiz.CANDIDATOS = CANDIDATOS;
  raiz.iconeDoPresente = iconeDoPresente;
  if (typeof module !== "undefined") module.exports = { CANDIDATOS, iconeDoPresente };
})(typeof window !== "undefined" ? window : globalThis);
