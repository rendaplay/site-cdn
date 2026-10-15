/* O que fica por cima da máquina, em DOM: relógio da rodada, Rei, top 3,
   legenda do que cada ação faz, fila, anúncios, o número gigante do pote
   bom e o pódio do fim da rodada. */
"use strict";

const fmt = new Intl.NumberFormat("pt-BR");

const ICONES = {
  comentario: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>`,
  seguiu: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="8" r="4"/><path d="M3 20a7 7 0 0 1 14 0M19 8v6M16 11h6"/></svg>`,
  compartilhou: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5l7 7-7 7v-4c-5 0-8 1.5-11 5 1-6 4-10 11-11z"/></svg>`,
  curtida: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/></svg>`,
  presente: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="9" width="18" height="12" rx="2"/><path d="M12 9v12M3 13h18M12 9C9 9 7 7.5 7 6a2 2 0 0 1 4-1l1 4 1-4a2 2 0 0 1 4 1c0 1.5-2 3-5 3"/></svg>`,
};

const COR_FAIXA = ["#39E6FF", "#7CFF6B", "#FFD24A", "#FF7A2E", "#FF3D9A"];

/* Desenho de cada faixa de presente, na ordem do preset: punhado, bolada,
   ouro, chuva e bolona. Preenchido na cor da faixa (currentColor). */
const BOLA = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}"/><circle class="luz" cx="${x - r * .35}" cy="${y - r * .35}" r="${r * .3}"/>`;
const ICONES_FAIXA = [
  BOLA(15, 31, 8) + BOLA(33, 31, 8) + BOLA(24, 16, 8),
  BOLA(10, 36, 6) + BOLA(24, 36, 6) + BOLA(38, 36, 6) + BOLA(17, 24, 6) + BOLA(31, 24, 6) + BOLA(24, 12, 6),
  `<path class="raio" d="M24 2v6M24 40v6M2 24h6M40 24h6M8 8l4 4M36 36l4 4M40 8l-4 4M12 36l-4 4"/>` + BOLA(24, 24, 13),
  `<path d="M12 22a8 8 0 0 1 3-15 10 10 0 0 1 19 2 7 7 0 0 1 2 13z"/>` + BOLA(14, 32, 4.5) + BOLA(26, 40, 4.5) + BOLA(36, 31, 4.5),
  BOLA(22, 24, 17) + BOLA(41, 40, 5),
];
const iconeFaixa = i => `<svg class="ico-faixa" viewBox="0 0 48 48" aria-hidden="true">${ICONES_FAIXA[i] || ICONES_FAIXA[0]}</svg>`;

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
      top: q(".top"), acoes: q(".legenda .acoes"), faixas: q(".legenda .faixas"), fila: q(".fila"),
      anuncio: q(".anuncio"), destaque: q(".destaque"),
      podio: q(".podio"), degraus: q(".podio .degraus"), novoRei: q(".podio .novo-rei"),
      geral: q(".podio .geral ol"), proxima: q(".podio .proxima"),
      sinal: q(".sem-sinal"),
    };
    this.$.reiFoto.append(criarAvatar(null));
    this.$.reiFoto.firstChild.textContent = "?";
    this.legenda();
  },

  legenda() {
    const c = this.cfg;
    const item = (icone, cor, acao, faz) =>
      `<li style="--cor:${cor}"><div class="acao">${ICONES[icone]}<span>${acao}</span></div><div class="faz">${faz}</div></li>`;
    this.$.acoes.innerHTML = [
      item("comentario", "#39E6FF", "Comente", "<span class=\"mais\">solta </span><b>1 bolinha</b><span class=\"mais\"> com sua foto</span>"),
      item("seguiu", "#FFD24A", "Siga", "<b>bolinha de ouro</b><span class=\"mais\">: pontos em dobro</span>"),
      item("compartilhou", "#7CFF6B", "Compartilhe", `<b>${fmt.format(c.chat.compartilhar)} bolinhas</b>`),
      item("curtida", "#FF3D9A", `${fmt.format(c.chat.curtidas)} curtidas`, "<b>choque</b><span class=\"mais\"> nos pinos</span>"),
    ].join("");
    this.$.faixas.innerHTML = c.faixas.map((f, i) =>
      `<li style="--cor:${COR_FAIXA[i]}">${iconeFaixa(i)}<div class="nome">${escapar(f.nome)}</div>` +
      `<div class="faz">${escapar(f.texto)}</div><span class="moedas">${fmt.format(f.moedas)}</span></li>`).join("");
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
    if (horizontal) ol.append(el("h3", null, "Top da rodada"));
    if (!lista.length) {
      ol.append(el("div", "vazio", "Comente pra soltar sua bolinha!"));
      return;
    }
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
    $.novoRei.textContent = !a.top.length ? "Ninguém pontuou: comente pra jogar!"
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
