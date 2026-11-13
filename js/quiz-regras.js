/* Resultado do quiz a partir das respostas. Fica separado da página pra rodar no Node. */
"use strict";

(function (raiz) {
  const HORAS_GARANTIA = 10;
  const SEMANAS = 4;
  const DURACAO = { 0.5: "30 min", 1: "1 hora", 2: "2 horas" };

  // Os jogos do celular, na ordem da LP, menos a Batalha de Torres. Os do 8º dia liberam uma semana depois da compra.
  const JOGOS = {
    pipa: { nome: "Pipa Combate" },
    caiounaocai: { nome: "Cai ou Não Cai?", oitavoDia: true },
    davigolias: { nome: "Davi x Golias", oitavoDia: true },
    empurra: { nome: "Empurra-Empurra", oitavoDia: true },
    torcida: { nome: "Maior Torcida do Brasil", oitavoDia: true },
    escalada: { nome: "Escalada" },
    racha: { nome: "Racha da Live" },
    chefao: { nome: "Chefão Coletivo" },
    flappy: { nome: "Voa, Tuca!" },
    bolinha: { nome: "Chuva de Bolinha" },
  };

  // As lives por semana fecham as horas da garantia no mês, com no mínimo 3 pra criar hábito no público.
  function horasNoMes(tempo, livesPorSemana) {
    return tempo * livesPorSemana * SEMANAS;
  }

  function plano(r) {
    const livesPorSemana = Math.max(3, Math.ceil(HORAS_GARANTIA / r.tempo / SEMANAS));
    return { livesPorSemana, duracao: DURACAO[r.tempo], horasNoMes: horasNoMes(r.tempo, livesPorSemana) };
  }

  function semanas(r) {
    const escolhido = JOGOS[r.jogo] ? r.jogo : "pipa";
    const primeiro = JOGOS[escolhido].oitavoDia ? "pipa" : escolhido;
    const segundo = primeiro === "racha" ? "pipa" : "racha";
    const liberado = JOGOS[escolhido].oitavoDia ? escolhido : "caiounaocai";
    return [
      { jogo: primeiro, frase: "O público aprende a jogar" },
      { jogo: segundo, frase: "Alterna e vê qual rende" },
      { jogo: liberado, frase: "Jogo novo liberado" },
      { jogo: primeiro, frase: "Repete o que mais rendeu" },
    ];
  }

  // Índices de segunda (0) a domingo (6), com folga entre as lives sempre que der.
  const AGENDA = { 3: [0, 2, 4], 4: [0, 2, 4, 6], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5] };
  function diasDeLive(n) {
    return AGENDA[n] || [0, 1, 2, 3, 4, 5, 6].slice(0, n);
  }

  function meta(r) {
    if (r.meta === "recuperar") return "Recuperar o valor do plano até o dia 30. Se não recuperar, devolvemos.";
    return "Recuperar o plano e formar um público que volta. A renda cresce com ele.";
  }

  const api = { JOGOS, HORAS_GARANTIA, plano, horasNoMes, semanas, diasDeLive, meta };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.QuizRegras = api;
})(typeof window !== "undefined" ? window : globalThis);
