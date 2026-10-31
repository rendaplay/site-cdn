/* O que fica por cima do canvas, em DOM: o ranking da live entre as rodadas,
   o aviso de conector e a pausa. O resto (tabela, faixas, carimbo) é canvas. */
"use strict";

function el(tag, cls, texto) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (texto != null) e.textContent = texto;
  return e;
}

function escapar(s) {
  const d = document.createElement("div");
  d.textContent = String(s ?? "");
  return d.innerHTML;
}

function encurtar(s, n) {
  s = String(s || "");
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

const Hud = {
  montar(palco, cfg) {
    this.cores = new Map(cfg.times.map(t => [t.id, `--c1:${t.cor};--c2:${t.cor2}`]));
    const q = s => palco.querySelector(s);
    this.$ = {
      ranking: q(".ranking"), campeao: q(".ranking .campeao"),
      lista: q(".ranking ol"), proxima: q(".ranking .proxima"), sinal: q(".sem-sinal"),
    };
  },

  /* Times que já ganharam ou caíram na live; quem nunca apareceu fica fora,
     pra lista não virar a tabela de novo. */
  ranking(tabela, campeaoId) {
    const $ = this.$;
    const campeao = tabela.time(campeaoId);
    $.campeao.innerHTML = campeao
      ? `<span class="chip" style="${this.cores.get(campeao.id)}"></span>🏆 ${escapar(campeao.nome)} levou a rodada ${tabela.rodada}`
      : "";
    $.lista.replaceChildren(...tabela.rankingLive().slice(0, 8).map((t, i) => {
      const li = el("li");
      li.innerHTML = `<b class="n">${i + 1}</b><span class="chip" style="${this.cores.get(t.id)}"></span>`
        + `<span class="nome">${escapar(t.nome)}</span>`
        + `<span class="v">🏆 ${t.vitorias}</span><span class="q">⬇ ${t.quedas}</span>`;
      return li;
    }));
    $.ranking.hidden = false;
  },

  proxima(seg) {
    this.$.proxima.innerHTML = `Próxima rodada em <b>${Math.ceil(seg)}</b>`;
  },

  esconderRanking() { this.$.ranking.hidden = true; },

  sinal(estado) {
    const s = this.$.sinal;
    s.hidden = estado === "conectado" || estado === "demo";
    s.textContent = estado === "conectando" ? "Procurando o conector da live…" : "Sem conector da live: tentando de novo";
  },
};
