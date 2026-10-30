/* O que fica por cima da máquina, em DOM: relógio da rodada, Rei, top 3,
   fila, anúncios, o número gigante do pote bom e o pódio do fim da rodada. */
"use strict";

const fmt = new Intl.NumberFormat("pt-BR");

const COR_FAIXA = ["#39E6FF", "#7CFF6B", "#FFD24A", "#FF7A2E", "#FF3D9A"];

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

/* Avatar do TikTok com a inicial por baixo: se a foto não carrega (mock,
   demo, link vencido), fica a inicial na cor da pessoa. */
function criarAvatar(j) {
  const a = el("span", "avatar");
  a.textContent = inicial(j && j.nome);
  a.style.setProperty("--avatar-cor", (j && j.cor) || "#5E5E6E");
  if (j && j.foto) {
    const img = new Image();
    img.referrerPolicy = "no-referrer";
    img.onload = () => { a.textContent = ""; a.style.backgroundImage = `url("${img.src.replace(/"/g, "%22")}")`; };
    img.src = j.foto;
  }
  return a;
}

function relogio(seg) {
  const s = Math.ceil(seg);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const Hud = {
  filaAnuncio: [],
  anunciando: false,
  chaveTop: "",
  reiAtual: undefined,

  montar(palco, cfg) {
    this.palco = palco;
    this.cfg = cfg;
    const q = s => palco.querySelector(s);
    this.$ = {
      relogio: q(".relogio"), rodada: q(".relogio .rotulo b"), tempo: q(".relogio .tempo"), barra: q(".relogio .barra i"),
      rei: q(".rei"), reiFoto: q(".rei .foto"), reiNome: q(".rei .nome"),
      top: q(".top"), fila: q(".fila"),
      anuncio: q(".anuncio"), destaque: q(".destaque"),
      podio: q(".podio"), degraus: q(".podio .degraus"), novoRei: q(".podio .novo-rei"),
      geral: q(".podio .geral ol"), proxima: q(".podio .proxima"),
      sinal: q(".sem-sinal"),
    };
    this.$.reiFoto.append(criarAvatar(null));
    this.$.reiFoto.firstChild.textContent = "?";
  },

  /* ───────── topo ───────── */

  placar(p) {
    const $ = this.$;
    $.rodada.textContent = p.rodada;
    const r = $.relogio;
    if (p.fase === "rodada") {
      const resta = p.resta();
      $.tempo.textContent = relogio(resta);
      $.barra.style.transform = `scaleX(${Math.max(0, resta / p.cfg.rodada.duracao)})`;
      r.classList.toggle("final", resta <= 10);
      r.classList.remove("fechando");
    } else {
      r.classList.remove("final");
      r.classList.add("fechando");
      $.tempo.textContent = p.fase === "fechando" ? "Acabando…" : "Pódio";
      $.barra.style.transform = "scaleX(0)";
    }
    if (p.rei !== this.reiAtual) this.trocarRei(p.rei ? p.jogadores.get(p.rei) : null);
    const n = p.fila.length;
    $.fila.innerHTML = n > 3 ? `<b>${fmt.format(n)}</b> bolinhas na fila` : "";
  },

  trocarRei(j) {
    const primeira = this.reiAtual === undefined;
    this.reiAtual = j ? j.id : null;
    const $ = this.$;
    $.rei.classList.toggle("vazio", !j);
    $.reiFoto.replaceChildren(criarAvatar(j));
    if (!j) $.reiFoto.firstChild.textContent = "?";
    $.reiNome.textContent = j ? j.nome : "quem será?";
    if (!primeira && j) {
      $.rei.classList.remove("trocou");
      void $.rei.offsetWidth;
      $.rei.classList.add("trocou");
    }
  },

  top(p, horizontal) {
    const lista = p.rankingRodada(horizontal ? 5 : 3);
    const chave = lista.map(j => j.id + ":" + j.pontos).join("|") + horizontal;
    if (chave === this.chaveTop) return;
    const antes = this.chaveTop.split("|").map(x => x.split(":")[0]);
    this.chaveTop = chave;
    const ol = this.$.top;
    ol.replaceChildren();
    if (!lista.length) return;
    if (horizontal) ol.append(el("h3", null, "Top da rodada"));
    lista.forEach((j, i) => {
      const li = el("li");
      const txt = el("span", "txt");
      txt.append(el("span", "nome", j.nome), el("span", "pts", fmt.format(j.pontos)));
      li.append(el("span", "pos", String(i + 1)), criarAvatar(j), txt);
      if (antes.indexOf(j.id) > i || antes.indexOf(j.id) < 0) li.classList.add("subiu");
      ol.append(li);
    });
  },

  /* ───────── anúncio ───────── */

  anunciar(a) {
    this.filaAnuncio.push(a);
    if (this.filaAnuncio.length > 5) this.filaAnuncio.splice(1, 1);
    if (!this.anunciando) this.proximoAnuncio();
  },

  proximoAnuncio() {
    const box = this.$.anuncio;
    const a = this.filaAnuncio.shift();
    if (!a) {
      this.anunciando = false;
      box.classList.remove("on");
      return;
    }
    this.anunciando = true;
    box.className = `anuncio${a.lendario ? " lendario" : ""}`;
    box.style.setProperty("--cor", a.cor);
    box.replaceChildren(el("div", "fita", a.fita));
    if (a.jogador) {
      const quem = el("div", "quem");
      quem.append(criarAvatar(a.jogador), el("span", null, a.jogador.nome));
      box.append(quem);
    }
    if (a.texto) box.append(el("div", "texto", a.texto));
    requestAnimationFrame(() => box.classList.add("on"));
    clearTimeout(this.tAnuncio);
    this.tAnuncio = setTimeout(() => {
      box.classList.remove("on");
      this.tAnuncio = setTimeout(() => this.proximoAnuncio(), 260);
    }, a.ms || 2200);
  },

  /* Número gigante quando uma bolinha cai num pote bom. */
  destaque(j, pontos, extra = "") {
    const d = this.$.destaque;
    d.style.setProperty("--cor", pontos >= 50 ? "#FF3D9A" : "#FF7A2E");
    d.replaceChildren(criarAvatar(j), el("div", "num", `+${fmt.format(pontos)}`), el("div", "nome", j ? j.nome : ""));
    if (extra) d.append(el("div", "extra", extra));
    d.classList.remove("on");
    void d.offsetWidth;
    d.classList.add("on");
  },

  /* ───────── pódio ───────── */

  podio(a, p) {
    const $ = this.$;
    $.degraus.replaceChildren();
    for (const pos of [2, 1, 3]) {
      const j = a.top[pos - 1];
      const lugar = el("div", `lugar p${pos}${j ? "" : " vazio"}`);
      if (pos === 1) lugar.append(el("div", "coroa"));
      lugar.append(criarAvatar(j || { nome: "?", cor: "#3A2E5E" }));
      lugar.append(el("div", "nome", j ? j.nome : "—"), el("div", "pts", j ? fmt.format(j.pontos) : ""));
      lugar.append(el("div", "bloco", String(pos)));
      $.degraus.append(lugar);
    }
    const rei = a.rei ? p.jogadores.get(a.rei) : null;
    $.novoRei.textContent = !a.top.length ? "Ninguém pontuou"
      : a.novoRei ? `${rei.nome} é o novo Rei!` : `${rei.nome} continua Rei!`;
    $.geral.replaceChildren();
    p.rankingLive(5).forEach((j, i) => {
      const li = el("li");
      li.append(el("span", "pos", String(i + 1)), criarAvatar(j), el("span", "nome", j.nome), el("span", "pts", fmt.format(j.total)));
      $.geral.append(li);
    });
    $.geral.parentElement.hidden = !$.geral.children.length;
    $.podio.hidden = false;
  },

  proxima(seg) {
    this.$.proxima.innerHTML = `Próxima rodada em <b>${Math.ceil(seg)}</b>`;
  },

  esconderPodio() { this.$.podio.hidden = true; },

  sinal(estado) {
    const s = this.$.sinal;
    s.hidden = estado === "conectado" || estado === "demo";
    s.textContent = estado === "conectando" ? "Procurando o conector da live…" : "Sem conector da live: tentando de novo";
  },
};
