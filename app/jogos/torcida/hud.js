/* O que fica por cima do estádio, em DOM: o tempo no alto, o placar dos 5
   setores mais cheios na lateral (com a seta de quem subiu), as faixas de
   anúncio, a faixa do vencedor, o ranking da live entre as rodadas, o
   aviso de conector e a pausa. */
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

const LINHA = 86, NO_PLACAR = 5;

const Hud = {
  montar(palco, times) {
    const q = s => palco.querySelector(s);
    this.$ = {
      tempo: q(".tempo"), lateral: q(".lateral"), faixa: q(".faixa"), final: q(".final"),
      ranking: q(".ranking"), sinal: q(".sem-sinal"),
    };
    this.ultimoTempo = null;
    this._importancia = 0;
    this._ate = 0;
    this.linhas = new Map();
    for (const t of times) {
      const linha = el("div", "linha vazia");
      linha.style.setProperty("--c1", t.cor);
      linha.style.setProperty("--c2", t.cor2);
      const sigla = el("span", null, t.sigla);
      const n = el("b", null, "0");
      const seta = el("em", null, "▲");
      linha.append(sigla, n, seta);
      this.$.lateral.append(linha);
      this.linhas.set(t.id, { el: linha, n, pos: -1, valor: -1, subiu: 0 });
    }
  },

  /* Uma vez por quadro: só mexe no DOM quando o número muda. */
  quadro(estadio) {
    const $ = this.$;
    const seg = estadio.fase === "rodada" ? Math.ceil(estadio.resta()) : estadio.fase === "intervalo" ? estadio.cfg.rodada.duracao : 0;
    if (seg !== this.ultimoTempo) {
      this.ultimoTempo = seg;
      $.tempo.textContent = `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, "0")}`;
      $.tempo.classList.toggle("acabando", estadio.fase === "rodada" && seg <= 10);
    }
    $.tempo.hidden = estadio.fase === "intervalo";
    $.lateral.hidden = estadio.fase !== "rodada";
    const agora = performance.now();
    for (const s of estadio.setores) {
      const l = this.linhas.get(s.id);
      const n = estadio.lotacao(s);
      if (l.pos !== s.pos) {
        if (l.pos >= 0 && s.pos < l.pos && s.pos < NO_PLACAR && n > 0) l.subiu = agora + 3000;
        l.pos = s.pos;
        l.el.style.transform = `translateY(${Math.min(s.pos, NO_PLACAR) * LINHA}px)`;
      }
      if (n !== l.valor) {
        l.valor = n;
        l.n.textContent = n;
      }
      l.el.classList.toggle("fora", s.pos >= NO_PLACAR || !n);
      l.el.classList.toggle("lider", s.pos === 0 && n > 0);
      l.el.classList.toggle("subiu", agora < l.subiu);
    }
  },

  /* Faixa grande no alto; a nova troca a anterior, menos quando é de menor
     importância e a de agora ainda está na tela. */
  anunciar(texto, cor = "ouro", seg = 2.6, importancia = 1) {
    const f = this.$.faixa;
    const agora = performance.now();
    if (importancia < this._importancia && agora < this._ate) return;
    this._importancia = importancia;
    this._ate = agora + seg * 1000;
    f.className = `faixa ${cor}`;
    f.textContent = texto;
    f.style.fontSize = "";
    f.hidden = false;
    /* Sempre numa linha só: diminui a letra até caber. */
    let tam = parseFloat(getComputedStyle(f).fontSize);
    while (f.scrollWidth > f.clientWidth && tam > 36) {
      tam -= 4;
      f.style.fontSize = `${tam}px`;
    }
    void f.offsetWidth;
    f.classList.add("entra");
    clearTimeout(this._faixa);
    this._faixa = setTimeout(() => { f.hidden = true; }, seg * 1000);
  },

  /* "<TIME> TEM A MAIOR TORCIDA DO BRASIL" em duas linhas, na cor do time. */
  vencedor(time) {
    const f = this.$.final;
    f.innerHTML = "";
    f.style.setProperty("--c1", time.cor);
    f.style.setProperty("--c2", time.cor2);
    const nome = el("b", null, (time.curto || time.nome).toUpperCase());
    f.append(nome, el("span", null, "TEM A MAIOR TORCIDA DO BRASIL"));
    f.hidden = false;
    nome.style.fontSize = "";
    const max = f.clientWidth * 0.92;
    if (nome.offsetWidth > max) nome.style.fontSize = `${Math.floor(parseFloat(getComputedStyle(nome).fontSize) * max / nome.offsetWidth)}px`;
    f.classList.remove("entra");
    void f.offsetWidth;
    f.classList.add("entra");
  },

  esconderVencedor() { this.$.final.hidden = true; },

  /* Rodadas vencidas por time na live, com quem venceu agora em destaque. */
  mostrarRanking(estadio, vencedor) {
    const lista = estadio.rankingLive().slice(0, 5);
    const r = this.$.ranking;
    r.innerHTML = "";
    r.append(el("h2", null, "Ranking da live"));
    if (!lista.length) r.append(el("p", "vazio", "Nenhuma torcida lotou ainda"));
    const ol = el("ol");
    lista.forEach((s, i) => {
      const time = estadio.cfg.times.find(t => t.id === s.id);
      const li = el("li", s.id === vencedor ? "venceu" : "");
      li.style.setProperty("--c1", time.cor);
      li.style.setProperty("--c2", time.cor2);
      li.append(el("em", null, `${i + 1}º`), el("i"), el("span", null, time.curto || time.nome), el("b", null, `🏆${s.vitorias}`));
      ol.append(li);
    });
    r.append(ol, el("div", "proxima"));
    r.hidden = false;
  },

  proxima(seg) {
    const p = this.$.ranking.querySelector(".proxima");
    if (p) p.innerHTML = `Próxima rodada em <b>${Math.ceil(seg)}</b>`;
  },

  esconderRanking() { this.$.ranking.hidden = true; },

  sinal(estado) {
    const s = this.$.sinal;
    s.hidden = estado === "conectado" || estado === "demo";
    s.textContent = estado === "conectando" ? "Procurando o conector da live…" : "Sem conector da live: tentando de novo";
  },
};
