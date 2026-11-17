/* O que fica por cima do canvas, em DOM: a barra do jackpot da live, o top
   3 da rodada, o relógio, o 2X das curtidas, o recorde, cartões de
   presente, faixas, o letreiro grande (JACKPOT!), o telão da "mesa é sua",
   o "@fulano fez 12.500" de quando a bola cai, a chamada da vitrine, o
   pódio e o aviso de conector. O @ em cada bola é desenhado na mesa. */
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

const NOME_EFEITO = { brilho: "Bola brilhante", ima: "Ímã", multibola: "Multibola", fogo: "Bola de fogo", mesa: "Mesa é sua" };
const SIMBOLO_EFEITO = { brilho: "✨", ima: "🧲", multibola: "🎱", fogo: "🔥", mesa: "👑" };
const SIMBOLO_FORMA = { estrela: "⭐", coracao: "💖", raio: "⚡" };

const DICAS_JOGO = [
  "<b>Comente</b> e a sua bola entra na mesa",
  "Já tem bola? <b>Comente de novo</b> e ela pula",
  "<b>Curtidas</b> enchem o 2X: tudo vale dobrado",
  "Todo ponto enche o <b>jackpot da live</b>",
  "Bateu a bola na <b>roleta</b>? Vem bônus",
];

const Hud = {
  montar(palco, cfg) {
    this.palco = palco;
    this.cfg = cfg;
    const q = s => palco.querySelector(s);
    this.$ = {
      topo: q(".topo"), barra: q(".jackpot i"), valor: q(".jackpot .valor"), recorde: q(".recorde"),
      top3: q(".top3"), relogio: q(".relogio"), rotulo: q(".rotulo"), dobro: q(".dobro"), cargaDobro: q(".dobro i"), contagem: q(".contagem"),
      faixas: q(".faixas"), presentes: q(".presentes"), resultado: q(".resultado"), telao: q(".telao"),
      caidas: q(".caidas"), dica: q(".dica"), chamada: q(".chamada"), podio: q(".podio"), sinal: q(".sem-sinal"),
    };
    this.visto = {};
    this.dicas = DICAS_JOGO;
    this.iDica = -1;
    this.trocarDica();
    setInterval(() => this.trocarDica(), 6500);
  },

  /* ───────── todo quadro ───────── */

  /* Placar e jackpot mudam a cada batida: mexer no DOM toda hora custa
     estilo e pintura no celular fraco, então os números andam 5 vezes por
     segundo. As barras vão por transform, que não refaz o layout. */
  atualizar(P) {
    const v = this.visto, $ = this.$;
    const agora = performance.now();
    const numeros = !(agora - (v.numerosEm || 0) < 200);
    if (numeros) v.numerosEm = agora;
    const j = P.jackpot;
    const nivel = Math.min(1, Math.round(j.valor / j.meta * 500) / 500);
    if (v.nivel !== nivel) { v.nivel = nivel; $.barra.style.transform = `scaleX(${nivel})`; }
    if (numeros) {
      const valor = `${milhar(j.valor)} / ${milhar(j.meta)}`;
      if (v.valor !== valor) { v.valor = valor; $.valor.textContent = valor; }
    }
    const festa = P.t < j.festaAte;
    if (v.festa !== festa) { v.festa = festa; $.topo.classList.toggle("festa", festa); }

    const r = P.recorde;
    const recorde = r.nome ? `🏆 Melhor bola da live <b>${milhar(r.pontos)}</b> · @${escapar(encurtar(r.nome, 14))}` : "";
    if (v.recorde !== recorde) { v.recorde = recorde; $.recorde.innerHTML = recorde; $.recorde.hidden = !recorde; }

    const top = numeros || !v.top ? P.rankingRodada(3) : null;
    const chaveTop = top ? top.map(x => x.id + x.pontos).join("|") : v.top;
    if ((numeros || !v.top) && v.top !== chaveTop) {
      v.top = chaveTop;
      $.top3.innerHTML = top.length
        ? top.map((x, i) => `<li style="--c:${x.cor}"><b class="n">${i + 1}</b><span class="nome">@${escapar(encurtar(x.nome, 15))}</span><b class="pts">${milhar(x.pontos)}</b></li>`).join("")
        : `<li class="vazio">Comente e lance sua bola</li>`;
    }

    const seg = Math.ceil(P.relogio);
    const relogio = `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, "0")}`;
    if (v.relogio !== relogio) { v.relogio = relogio; $.relogio.textContent = relogio; }
    const acabando = seg <= 10 && P.fase === "jogo" && !P.ocioso;
    if (v.acabando !== acabando) { v.acabando = acabando; $.relogio.classList.toggle("acabando", acabando); }
    const rotulo = P.fase === "fim" ? "Pódio" : P.fase === "espera" || P.ocioso ? "Parado" : "Rodada";
    if (v.rotulo !== rotulo) { v.rotulo = rotulo; $.rotulo.textContent = rotulo; }

    const m = P.mult, dobrando = P.t < m.ate;
    const carga = Math.min(1, Math.max(0, Math.round((dobrando ? (m.ate - P.t) / this.cfg.multiplicador.duracao : m.carga) * 200) / 200));
    if (v.carga !== carga) { v.carga = carga; $.cargaDobro.style.transform = `scaleX(${carga})`; }
    if (v.dobrando !== dobrando) { v.dobrando = dobrando; $.dobro.classList.toggle("ligado", dobrando); }

    const naFila = P.lancamentos.length;
    const contagem = `🎱 ${P.bolas.length} na mesa${naFila ? ` · ${naFila} na fila` : ""}`;
    if (numeros && v.contagem !== contagem) { v.contagem = contagem; $.contagem.textContent = contagem; }

    if (P.mesa && !$.telao.hidden) {
      const resta = `${Math.max(0, Math.ceil(P.mesa.ate - P.t))}s`;
      const e = $.telao.querySelector(".resta");
      if (e && e.textContent !== resta) e.textContent = resta;
    }
    if (P.fase === "fim" && !$.podio.hidden) {
      const p = $.podio.querySelector(".proxima");
      const texto = P.t - P.ultimoReal < this.cfg.ociosidade ? `Próxima rodada em <b>${Math.ceil(P.resta())}</b>` : "Comente pra começar outra rodada";
      if (p && p.innerHTML !== texto) p.innerHTML = texto;
    }
  },

  /* ───────── avisos ───────── */

  /* `tipo`: faixa repetida (ímã, fogo) troca a que ainda está na tela em vez
     de empilhar e cobrir o topo da mesa. */
  faixa(texto, cor = "", tipo = "") {
    if (tipo) for (const velha of this.$.faixas.querySelectorAll(`[data-tipo="${tipo}"]`)) velha.remove();
    const f = el("div", `faixa ${cor}`, texto);
    if (tipo) f.dataset.tipo = tipo;
    this.$.faixas.prepend(f);
    while (this.$.faixas.children.length > 2) this.$.faixas.lastChild.remove();
    setTimeout(() => f.remove(), 3300);
  },

  presente({ nome, cor, simbolo, quantidade, efeito, forma, faixa }) {
    const c = el("div", `presente f${faixa}`);
    c.style.setProperty("--c", cor);
    const icone = efeito === "brilho" ? SIMBOLO_FORMA[forma] || "✨" : SIMBOLO_EFEITO[efeito] || "";
    c.innerHTML = `<div class="simbolo">${simbolo}</div>`
      + `<div class="quem">@${escapar(encurtar(nome, 18))}${quantidade > 1 ? ` ×${quantidade}` : ""}</div>`
      + `<div class="efeito">${icone} ${NOME_EFEITO[efeito] || ""}</div>`;
    this.$.presentes.prepend(c);
    while (this.$.presentes.children.length > 2) this.$.presentes.lastChild.remove();
    setTimeout(() => c.remove(), 4300);
  },

  resultado(titulo, sub, cor, ms = 2400) {
    const r = this.$.resultado;
    r.style.setProperty("--c", cor || "#ff2bd6");
    r.innerHTML = `${titulo}${sub ? `<small>${sub}</small>` : ""}`;
    r.hidden = false;
    r.style.animation = "none";
    void r.offsetWidth;
    r.style.animation = "";
    this.palco.classList.add("com-resultado");
    clearTimeout(this._resultado);
    this._resultado = setTimeout(() => { r.hidden = true; this.palco.classList.remove("com-resultado"); }, ms);
  },

  /* "@fulano fez 12.500": pilha curta em cima dos flippers. */
  caiu(ev) {
    if (!ev.nome) return;
    const c = el("div", "caida");
    c.style.setProperty("--c", ev.cor);
    c.innerHTML = `@${escapar(encurtar(ev.nome, 16))} fez <b>${milhar(ev.pontos)}</b>`;
    this.$.caidas.prepend(c);
    while (this.$.caidas.children.length > 3) this.$.caidas.lastChild.remove();
    setTimeout(() => c.remove(), 2600);
  },

  telao(ev) {
    const tl = this.$.telao;
    tl.style.setProperty("--c", ev.cor);
    tl.innerHTML = `<div class="topo-telao">👑 A mesa é de</div><div class="nome">@${escapar(encurtar(ev.nome, 16))}</div>`
      + `<div class="sub">tudo conta pro @${escapar(encurtar(ev.nome, 12))} · ninguém cai · <span class="resta"></span></div>`;
    tl.hidden = false;
  },

  esconderTelao() { this.$.telao.hidden = true; },

  trocarDica() {
    if (!this.dicas.length) return;
    const d = this.$.dica;
    d.classList.add("trocando");
    setTimeout(() => {
      this.iDica = (this.iDica + 1) % this.dicas.length;
      d.innerHTML = this.dicas[this.iDica];
      d.classList.remove("trocando");
    }, 400);
  },

  /* ───────── telas grandes ───────── */

  /* Vitrine: ninguém comentou ainda (`aguardando`) ou a live esfriou (`ocioso`). */
  chamada(tipo) {
    const titulo = tipo === "ocioso" ? "A mesa tá esperando!" : "Pinball Gigante";
    this.$.chamada.innerHTML = `<h2>${titulo}</h2><p>Comente pra lançar sua bola</p>`
      + `<div class="bolinha"><span></span>@você</div>`;
    this.$.chamada.hidden = false;
    this.$.podio.hidden = true;
    this.dicas = ["<b>Comente</b> pra lançar sua bola", "Cada comentário é uma <b>bola com o seu @</b>"];
    this.iDica = -1;
    this.trocarDica();
  },

  esconderChamada() {
    if (this.$.chamada.hidden) return;
    this.$.chamada.hidden = true;
    this.dicas = DICAS_JOGO;
    this.iDica = -1;
    this.trocarDica();
  },

  podio(ev, ranking) {
    const [a, b, c] = ev.podio;
    const degrau = (x, lugar) => x
      ? `<div class="degrau d${lugar}" style="--c:${x.cor}"><span class="nome">@${escapar(encurtar(x.nome, 12))}</span><b class="pts">${milhar(x.pontos)}</b><div class="bloco">${lugar}</div></div>`
      : `<div class="degrau d${lugar} vazio"><span class="nome">–</span><b class="pts"></b><div class="bloco">${lugar}</div></div>`;
    const mb = ev.melhorBola;
    const live = ranking.length
      ? `<h3>Ranking da live</h3><ol>${ranking.map((x, i) => `<li style="--c:${x.cor}"><b class="n">${i + 1}</b><span class="nome">@${escapar(encurtar(x.nome, 18))}</span><span>${milhar(x.pontos)}</span></li>`).join("")}</ol>`
      : "";
    this.$.podio.innerHTML = `
      <h2>Fim da rodada</h2>
      <div class="degraus">${degrau(b, 2)}${degrau(a, 1)}${degrau(c, 3)}</div>
      ${mb.nome ? `<div class="melhor" style="--c:${mb.cor}">🎱 Melhor bola: <b>@${escapar(encurtar(mb.nome, 14))}</b> · ${milhar(mb.pontos)}</div>` : ""}
      ${live}
      <div class="proxima"></div>`;
    this.$.podio.hidden = false;
    this.$.telao.hidden = true;
    this.$.chamada.hidden = true;
  },

  esconderPodio() { this.$.podio.hidden = true; },

  sinal(estado) {
    const s = this.$.sinal;
    s.hidden = estado === "conectado" || estado === "demo";
    s.textContent = estado === "conectando" ? "Procurando o conector da live…" : "Sem conector da live: tentando de novo";
  },
};
