/* O que fica por cima do canvas, em DOM: a barra do aquário da live com o
   nível, o top 3 dos maiores peixes, a contagem, cartões de presente,
   faixas, o letreiro grande, o telão da baleia, a chamada de quando
   ninguém comenta e o aviso de conector. O @ de cada peixe é desenhado no
   canvas. */
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

const NOME_EFEITO = { bolhas: "Bolhas brilhantes", aguaviva: "Água-viva", tartaruga: "Tartaruga", tubarao: "Tubarão", baleia: "Baleia" };
const SIMBOLO_EFEITO = { bolhas: "🫧", aguaviva: "🪼", tartaruga: "🐢", tubarao: "🦈", baleia: "🐋" };
const NOME_DECORACAO = { coral: "Coral", castelo: "Castelo", navio: "Navio naufragado", bau: "Baú do tesouro", noturno: "Aquário noturno" };

const DICAS_JOGO = [
  "<b>Comente</b> e ganhe um peixe com o seu @",
  "Comentou de novo? Cai um <b>petisco</b> pro seu peixe",
  "Escreva <b>pula</b> ou <b>dança</b> e veja seu peixe",
  "<b>Curtidas</b> soltam comida no aquário",
  "Tudo que acontece enche o <b>aquário da live</b>",
];

const Hud = {
  montar(palco, cfg) {
    this.palco = palco;
    this.cfg = cfg;
    const q = s => palco.querySelector(s);
    this.$ = {
      topo: q(".topo"), barra: q(".barra i"), nivel: q(".barra .nivel"),
      maiores: q(".maiores ol"), peixes: q(".contagem .n"), toca: q(".contagem .toca"),
      faixas: q(".faixas"), presentes: q(".presentes"), resultado: q(".resultado"), telao: q(".telao"),
      dica: q(".dica"), chamada: q(".chamada"), sinal: q(".sem-sinal"),
    };
    q(".titulo-jogo").textContent = cfg.titulo;
    this.visto = {};
    this.miniaturas = new Map();
    this.dicas = DICAS_JOGO;
    this.iDica = -1;
    this.trocarDica();
    setInterval(() => this.trocarDica(), 6500);
  },

  /* Peixinho do placar: o mesmo sprite do aquário, em imagem. */
  miniatura(p) {
    const chave = `${p.especie}|${p.paleta}`;
    let url = this.miniaturas.get(chave);
    if (!url) {
      url = Sprites.peixe(p.especie, p.paleta, 16, 0, false, false).toDataURL();
      this.miniaturas.set(chave, url);
    }
    return url;
  },

  /* ───────── todo quadro ───────── */

  /* Mexer no DOM toda hora custa no celular fraco: os números andam 5 vezes
     por segundo e a barra vai por transform. */
  atualizar(P) {
    const v = this.visto, $ = this.$;
    const agora = performance.now();
    if (agora - (v.em || 0) < 200) return;
    v.em = agora;
    const a = P.aquario;
    const cheio = Math.min(1, Math.round(a.valor / a.meta * 300) / 300);
    if (v.cheio !== cheio) { v.cheio = cheio; $.barra.style.transform = `scaleX(${cheio})`; }
    if (v.nivel !== a.nivel) { v.nivel = a.nivel; $.nivel.textContent = `Nível ${a.nivel}`; }
    const festa = P.t < P.festaAte;
    if (v.festa !== festa) { v.festa = festa; $.topo.classList.toggle("festa", festa); }

    const top = P.ranking(3);
    const chaveTop = top.map(x => x.id + centimetros(x.tamanho)).join("|");
    if (v.top !== chaveTop) {
      v.top = chaveTop;
      $.maiores.innerHTML = top.length
        ? top.map((x, i) => {
          const p = P.pessoas.get(x.id);
          return `<li style="--c:${x.cor}"><b class="n">${i + 1}</b><img alt="" src="${this.miniatura(p)}">`
            + `<span class="nome">@${escapar(encurtar(x.nome, 15))}</span><b class="cm">${centimetros(x.tamanho)} cm</b></li>`;
        }).join("")
        : `<li class="vazio">Comente e ganhe seu peixe</li>`;
    }
    const n = String(P.peixes.length);
    if (v.n !== n) { v.n = n; $.peixes.textContent = n; }
    const toca = P.naToca();
    const textoToca = toca ? `${toca} na toca` : "nadando";
    if (v.toca !== textoToca) { v.toca = textoToca; $.toca.textContent = textoToca; }

    if (P.palco && P.palco.tipo === "baleia" && !$.telao.hidden) {
      const resta = `${Math.max(0, Math.ceil(P.palco.ate - P.t))}s`;
      const e = $.telao.querySelector(".resta");
      if (e && e.textContent !== resta) e.textContent = resta;
    }
  },

  /* ───────── avisos ───────── */

  faixa(texto, cor = "", tipo = "") {
    if (tipo) for (const velha of this.$.faixas.querySelectorAll(`[data-tipo="${tipo}"]`)) velha.remove();
    const f = el("div", `faixa ${cor}`, texto);
    if (tipo) f.dataset.tipo = tipo;
    this.$.faixas.prepend(f);
    while (this.$.faixas.children.length > 2) this.$.faixas.lastChild.remove();
    setTimeout(() => f.remove(), 3300);
  },

  presente({ nome, cor, simbolo, quantidade, efeito, faixa }) {
    const c = el("div", `presente f${faixa}`);
    c.style.setProperty("--c", cor);
    c.innerHTML = `<div class="simbolo">${simbolo}</div>`
      + `<div class="quem">@${escapar(encurtar(nome, 18))}${quantidade > 1 ? ` ×${quantidade}` : ""}</div>`
      + `<div class="efeito">${SIMBOLO_EFEITO[efeito] || ""} ${NOME_EFEITO[efeito] || ""}</div>`;
    this.$.presentes.prepend(c);
    while (this.$.presentes.children.length > 2) this.$.presentes.lastChild.remove();
    setTimeout(() => c.remove(), 4300);
  },

  resultado(titulo, sub, cor, ms = 2400) {
    const r = this.$.resultado;
    r.style.setProperty("--c", cor || "#38d9ff");
    r.innerHTML = `${titulo}${sub ? `<small>${sub}</small>` : ""}`;
    r.hidden = false;
    r.style.animation = "none";
    void r.offsetWidth;
    r.style.animation = "";
    this.palco.classList.add("com-resultado");
    clearTimeout(this._resultado);
    this._resultado = setTimeout(() => { r.hidden = true; this.palco.classList.remove("com-resultado"); }, ms);
  },

  telao(ev) {
    const tl = this.$.telao;
    tl.style.setProperty("--c", ev.cor);
    tl.innerHTML = `<div class="topo-telao">🐋 A baleia é de</div><div class="nome">@${escapar(encurtar(ev.nome, 16))}</div>`
      + `<div class="sub">festa no aquário · <span class="resta"></span></div>`;
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

  /* ───────── chamada ───────── */

  /* Ninguém comentou ainda (`aguardando`) ou a live esfriou e os peixes
     dormiram (`ocioso`). */
  chamada(tipo) {
    const titulo = tipo === "ocioso" ? "Os peixes dormiram" : this.cfg.titulo;
    this.$.chamada.innerHTML = `<h2>${escapar(titulo)}</h2><p>Comente pra ganhar seu peixe</p>`
      + `<div class="exemplo"><img alt="" src="${this.miniatura({ especie: 0, paleta: 0 })}">@você</div>`;
    this.$.chamada.classList.toggle("dormindo", tipo === "ocioso");
    this.$.chamada.hidden = false;
    this.dicas = ["<b>Comente</b> e ganhe um peixe com o seu @", "Cada comentário é <b>comida</b> pro seu peixe"];
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

  sinal(estado) {
    const s = this.$.sinal;
    s.hidden = estado === "conectado" || estado === "demo";
    s.textContent = estado === "conectando" ? "Procurando o conector da live…" : "Sem conector da live: tentando de novo";
  },
};
