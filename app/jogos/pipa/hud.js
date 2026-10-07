/* O que fica por cima do céu, em DOM: rei do céu, moedas da live, feed de
   cortes, ranking, cardápio de presentes, anúncios e eventos-surpresa. */
"use strict";

const fmt = new Intl.NumberFormat("pt-BR");
const CORES_AVATAR = ["#3B4C7A", "#6B3F7A", "#2F6E73", "#7A5A2F", "#4F6B2F", "#7A2F4A", "#2F4F7A", "#5E5E6E"];

const ICONES = {
  tesoura: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.1 8.1 20 20M8.1 15.9 20 4M14.5 12l1.5 1.5"/></svg>`,
  coroa: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18h18l-1.5-10-4.5 4-3-7-3 7-4.5-4z"/></svg>`,
  moeda: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4"/></svg>`,
  balao: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>`,
  coracao: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>`,
  presente: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7c-2-4-6-3-5-1s5 1 5 1zm0 0c2-4 6-3 5-1s-5 1-5 1z"/></svg>`,
};

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
   demo, link vencido), fica a inicial numa cor fixa da pessoa. */
function criarAvatar(j) {
  const a = el("span", "avatar");
  /* Primeira letra de verdade: pula emoji e enfeite, mas aceita letra de
     qualquer alfabeto (nick com "𝓛𝓮𝓸" ou "ʚïɞ" é comum). */
  const nome = String(j.nome || "?").replace(/^[^\p{L}\p{N}]+/u, "");
  a.textContent = (Array.from(nome)[0] || "?").toUpperCase();
  a.style.setProperty("--avatar-cor", CORES_AVATAR[hashTexto(j.id || j.nome) % CORES_AVATAR.length]);
  if (j.foto) {
    const img = new Image();
    img.referrerPolicy = "no-referrer";
    img.onload = () => { a.textContent = ""; a.style.backgroundImage = `url("${img.src.replace(/"/g, "%22")}")`; };
    img.src = j.foto;
  }
  return a;
}

function tempoNoAr(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const EVENTOS = {
  ventania: { titulo: "Ventania!", texto: "Comente pra segurar sua linha" },
  dourado: { titulo: "Cerol dourado", texto: "Todo presente sobe uma faixa" },
  avoada: { titulo: "Pipa avoada!", texto: "Comente APAREI pra pegar" },
};

const Hud = {
  palco: null,
  filaAnuncio: [],
  anunciando: false,

  montar(palco, cfg) {
    this.palco = palco;
    this.cfg = cfg;
    const q = s => palco.querySelector(s);
    this.$ = {
      rei: q(".rei"), moedas: q(".moedas"), feed: q(".feed ol"), ranking: q(".ranking ol"),
      cardapio: q(".cardapio ol"), anuncio: q(".anuncio"), chamada: q(".chamada"), evento: q(".evento"),
      sinal: q(".sem-sinal"),
    };
    q(".titulo-jogo").textContent = cfg.titulo;
    this.$.chamada.innerHTML = cfg.modoSeguro
      ? `<span>${ICONES.balao}<b>Comente</b> e sua pipa sobe</span><span>${ICONES.coracao}<b>Curtida</b> dá gás</span>`
      : `<span>${ICONES.balao}<b>Comente</b> e sua pipa sobe</span><span>${ICONES.presente}<b>Presente</b> corta</span>`;
    if (cfg.modoSeguro) q(".cardapio h3").textContent = "Na pipa";
    this.montarCardapio();
    this.ranking([]);
  },

  montarCardapio() {
    const lista = this.$.cardapio;
    lista.replaceChildren();
    const estampas = ["meio", "xadrez", "estrela", "olho", "fogo"];
    this.cfg.faixas.forEach((f, i) => {
      const li = el("li");
      const icone = document.createElement("canvas");
      icone.width = 64;
      icone.height = 80;
      icone.className = "mini";
      const c = icone.getContext("2d");
      Ceu.desenharPipa(c, { x: 32, y: 38, rot: -0.15 }, ["#E63946", "#F4A300"], estampas[i] || "meio", 56, 0.4);
      const valor = el("span", "valor");
      valor.innerHTML = `${ICONES.moeda}${fmt.format(f.moedas)}`;
      const txt = el("span", "txt");
      txt.innerHTML = `<b>${escapar(f.nome)}</b><small>${escapar(f.efeito)}</small>`;
      li.append(icone, valor, txt);
      lista.append(li);
    });
  },

  /* ───────── placares ───────── */

  placar(combate, agora) {
    const rei = combate.rei(agora);
    const r = this.$.rei;
    if (rei) {
      const j = combate.jogadores.get(rei.id);
      if (r.dataset.id !== rei.id) {
        r.dataset.id = rei.id;
        r.querySelector(".quem").replaceChildren(criarAvatar(j), el("span", "nome", j.nome));
        r.classList.add("ocupado");
      }
      r.querySelector(".tempo").textContent = `${tempoNoAr(agora - rei.entrouEm)} no ar`;
    } else if (r.dataset.id !== "") {
      r.dataset.id = "";
      r.classList.remove("ocupado");
      r.querySelector(".quem").replaceChildren(el("span", "nome vazio", "Ninguém ainda"));
      r.querySelector(".tempo").textContent = `fique ${combate.cfg.rei.minimo} s no ar`;
    }

    const m = this.$.moedas;
    const num = m.querySelector(".num");
    const txt = fmt.format(combate.moedas);
    if (num.textContent !== txt) {
      num.textContent = txt;
      num.animate([{ transform: "scale(1.18)" }, { transform: "scale(1)" }], { duration: 300, easing: "ease-out" });
    }
    const top = combate.doadores(1)[0];
    m.querySelector(".maior").innerHTML = top
      ? `maior: <b>${escapar(top.nome)}</b> ${fmt.format(top.moedas)}`
      : "nenhum presente ainda";
  },

  ranking(lista) {
    const ol = this.$.ranking;
    const chave = lista.map(j => j.id + ":" + j.cortes).join("|");
    if (ol.dataset.chave === chave) return;
    ol.dataset.chave = chave;
    ol.replaceChildren();
    for (let i = 0; i < 5; i++) {
      const j = lista[i];
      const li = el("li", j ? (i === 0 ? "primeiro" : "") : "vazio");
      li.append(el("span", "pos", String(i + 1)));
      if (j) li.append(criarAvatar(j), el("span", "quem", j.nome), el("span", "valor", String(j.cortes)));
      else li.append(el("span", "quem", i === 0 ? "Corte uma pipa" : "—"));
      ol.append(li);
    }
  },

  /* ───────── feed de cortes ───────── */

  corte(autor, vitima, { cobrou, eraRei, fogo }) {
    const li = el("li");
    if (cobrou || eraRei || fogo) li.classList.add("forte");
    li.append(criarAvatar(autor), el("b", "autor", autor.nome));
    const t = el("span", "tesoura");
    t.innerHTML = ICONES.tesoura;
    li.append(t, el("span", "vitima", vitima.nome));
    if (cobrou) li.append(el("em", "tag tag-cobrou", "cobrou"));
    else if (eraRei) li.append(el("em", "tag tag-rei", "era o rei"));
    else if (fogo) li.append(el("em", "tag tag-fogo", "fogo"));
    this.noFeed(li);
  },

  aviso(texto, cls = "") {
    const li = el("li", "aviso " + cls);
    li.innerHTML = texto;
    this.noFeed(li);
  },

  noFeed(li) {
    const ol = this.$.feed;
    ol.prepend(li);
    li.animate([{ transform: "translateX(-40px)", opacity: 0 }, { transform: "none", opacity: 1 }],
      { duration: 280, easing: "cubic-bezier(.2,.8,.3,1.2)" });
    while (ol.children.length > 5) ol.lastChild.remove();
  },

  /* ───────── anúncios grandes ───────── */

  anunciar({ fita, nome, texto, cor = "#FFD23F", jogador = null, ms = 2600 }) {
    this.filaAnuncio.push({ fita, nome, texto, cor, jogador, ms });
    if (this.filaAnuncio.length > 4) this.filaAnuncio.splice(1, 1);
    if (!this.anunciando) this.proximoAnuncio();
  },

  proximoAnuncio() {
    const a = this.filaAnuncio.shift();
    const caixa = this.$.anuncio;
    if (!a) { this.anunciando = false; this.palco.classList.remove("anunciando"); return; }
    this.anunciando = true;
    this.palco.classList.add("anunciando");
    const cartao = el("div", "cartao");
    cartao.style.setProperty("--cor", a.cor);
    const fita = el("div", "fita", a.fita);
    const corpo = el("div", "corpo");
    if (a.jogador) corpo.append(criarAvatar(a.jogador));
    const linhas = el("div", "linhas");
    if (a.nome) linhas.append(el("div", "nome", a.nome));
    if (a.texto) linhas.append(el("div", "texto", a.texto));
    corpo.append(linhas);
    cartao.append(fita, corpo);
    caixa.replaceChildren(cartao);
    cartao.animate([
      { transform: "scale(.6) rotate(-4deg)", opacity: 0 },
      { transform: "scale(1.06) rotate(1deg)", opacity: 1, offset: 0.1 },
      { transform: "scale(1) rotate(0)", opacity: 1, offset: 0.16 },
      { transform: "scale(1) rotate(0)", opacity: 1, offset: 0.88 },
      { transform: "scale(.94) translateY(-40px)", opacity: 0 },
    ], { duration: a.ms, easing: "ease-out" }).onfinish = () => {
      cartao.remove();
      this.proximoAnuncio();
    };
  },

  /* ───────── evento-surpresa ───────── */

  evento(ev, agora) {
    const caixa = this.$.evento;
    if (!ev) {
      if (caixa.classList.contains("on")) {
        caixa.classList.remove("on");
        this.$.chamada.classList.remove("escondida");
      }
      return;
    }
    const info = EVENTOS[ev.tipo];
    if (caixa.dataset.tipo !== ev.tipo || !caixa.classList.contains("on")) {
      caixa.dataset.tipo = ev.tipo;
      caixa.innerHTML = `<b>${escapar(info.titulo)}</b><span>${escapar(info.texto)}</span><i><u></u></i>`;
      caixa.classList.add("on");
      this.$.chamada.classList.add("escondida");
    }
    const resta = Math.max(0, (ev.fim - agora) / (ev.fim - ev.inicio));
    caixa.querySelector("u").style.width = (resta * 100).toFixed(1) + "%";
  },

  /* Onde os painéis estão (px do palco), pro céu não pôr pipa atrás deles.
     O feed vazio é só o título, mas reserva o espaço de cheio: pipa que
     mora ali fica tapada quando os cortes começam. */
  areas() {
    const caixa = (sec, largura = sec.offsetWidth, altura = sec.offsetHeight) =>
      [sec.offsetLeft, sec.offsetTop, sec.offsetLeft + largura, sec.offsetTop + altura];
    const feed = this.$.feed.parentElement;
    const largura = Math.max(400, ...[...this.$.feed.children].map(li => li.offsetWidth));
    const altura = Math.max(feed.offsetHeight, feed.querySelector("h3").offsetHeight + 10 + 5 * 62);
    return [caixa(feed, largura, altura), caixa(this.$.ranking.parentElement), caixa(this.$.cardapio.parentElement)];
  },

  sinal(estado) {
    const s = this.$.sinal;
    s.hidden = estado === "conectado" || estado === "demo";
    s.textContent = estado === "desconectado" ? "Sem conector: abra o Renda Play e inicie a live" : "Procurando o conector…";
  },
};
