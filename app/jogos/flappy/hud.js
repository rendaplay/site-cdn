/* O que fica por cima do voo, em DOM: placar, recorde, moedas, quem pilota,
   vidas, efeitos ativos, evento-surpresa, anúncios, cardápio do quiosque,
   feed, ranking e a tela de quem derrubou o Tuca. */
"use strict";

const fmt = new Intl.NumberFormat("pt-BR");
const CORES_AVATAR = ["#3B4C7A", "#6B3F7A", "#2F6E73", "#7A5A2F", "#4F6B2F", "#7A2F4A", "#2F4F7A", "#5E5E6E"];

const ICONES = {
  vento: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h10a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7"/></svg>`,
  neblina: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 10a4 4 0 0 1 7.5-2A3.5 3.5 0 0 1 19 10M3 14h18M5 18h14"/></svg>`,
  gigante: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18v14H3zM3 9.7h18M3 14.3h18M9 5v4.7M15 9.7v4.6M9 14.3V19"/></svg>`,
  inverte: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16M7 4 3 8M7 4l4 4M17 20V4M17 20l-4-4M17 20l4-4"/></svg>`,
  meteoros: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="16" cy="8" r="4"/><path d="M13 11 4 20M11 7 5 13M17 13l-6 6"/></svg>`,
  pontos: `<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="13" rx="8.5" ry="6.5"/><path d="M8.5 12h.01M12 10h.01M15.5 13h.01M11 15.5h.01"/></svg>`,
  escudo: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M7.5 9.5a5 5 0 0 1 4.5-3"/></svg>`,
  lento: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/></svg>`,
  vida: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/></svg>`,
  turbo: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 15c4 0 8-2 11-6 2-2.6 4-4 7-4-1 5-4 9-8 11-3 1.5-6 1-10-1z"/><path d="M8 15c1 2 3 3 6 3"/></svg>`,
  chinelo: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c3 0 4 3 4 7s-1 11-4 11-4-7-4-11 1-7 4-7z"/><path d="M12 6 9.5 11M12 6l2.5 5"/></svg>`,
  moeda: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4"/></svg>`,
  piloto: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M9.5 16h5"/></svg>`,
  streamer: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9h12a4 4 0 0 1 3.8 5.2l-1 3a2.5 2.5 0 0 1-4.3.8L15 16H9l-1.5 2a2.5 2.5 0 0 1-4.3-.8l-1-3A4 4 0 0 1 6 9z"/><path d="M8 11.5v3M6.5 13h3M16 12.5h.01M18 14h.01"/></svg>`,
  dobro: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7l6 10M10 7 4 17M14 9a3 3 0 0 1 6 0c0 3-6 4-6 8h6"/></svg>`,
};

/* Cor de cada efeito na tela: sabotagem em vermelho/laranja, ajuda em
   verde/azul. */
const COR_EFEITO = {
  vento: "#FF9F6B", neblina: "#C9D2E6", gigante: "#FF6A3D", inverte: "#B98CFF", meteoros: "#FF4D61",
  pontos: "#FFD23F", escudo: "#7FDBFF", lento: "#6FA8FF", vida: "#FF6F91", turbo: "#FFD23F",
};

const EVENTOS = {
  chinelo: { titulo: "Hora do chinelo", texto: "Comente 2 e taque um chinelo no Tuca" },
  dobro: { titulo: "Pontos em dobro", texto: "Cada pilar vale 2: o recorde tá perto" },
  queijo: { titulo: "Chuva de pão de queijo", texto: "Cada pão de queijo pego vale +1" },
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
  const nome = String((j && j.nome) || "?").replace(/^[^\p{L}\p{N}]+/u, "");
  a.textContent = ([...nome][0] || "?").toUpperCase();
  a.style.setProperty("--avatar-cor", CORES_AVATAR[hashTexto((j && (j.id || j.nome)) || "?") % CORES_AVATAR.length]);
  if (j && j.foto) {
    const img = new Image();
    img.referrerPolicy = "no-referrer";
    img.onload = () => { a.textContent = ""; a.style.backgroundImage = `url("${img.src.replace(/"/g, "%22")}")`; };
    img.src = j.foto;
  }
  return a;
}

const Hud = {
  filaAnuncio: [],
  anunciando: false,
  chaveEfeitos: "",

  montar(palco, cfg) {
    this.palco = palco;
    this.cfg = cfg;
    const q = s => palco.querySelector(s);
    this.$ = {
      pontos: q(".placar .pontos"), faltam: q(".placar .faltam"),
      recorde: q(".card.recorde"), moedas: q(".card.moedas"),
      controle: q(".controle"), vidas: q(".vidas"), efeitos: q(".efeitos"),
      evento: q(".evento"), anuncio: q(".anuncio"), dica: q(".dica"),
      faixas: q(".quiosque .faixas"), barraAjuda: q(".barra.ajuda"), barraCaos: q(".barra.caos"),
      feed: q(".feed ol"), ranking: q(".ranking ol"), morte: q(".morte"), sinal: q(".sem-sinal"),
    };
    q(".titulo-jogo").textContent = `Cardápio do ${cfg.titulo.replace(/^Voa,\s*/i, "").replace(/!$/, "") || "Tuca"}`;
    this.montarCardapio();
    this.ranking(null);
    this.ultimo = {};
  },

  montarCardapio() {
    this.$.faixas.replaceChildren(...this.cfg.faixas.map(f => {
      const li = el("li");
      const valor = el("span", "valor");
      valor.innerHTML = `${ICONES.moeda}${fmt.format(f.moedas)}`;
      const ef = (time, x) => {
        const s = el("span", `ef ${time}`);
        s.innerHTML = `<span class="ic">${ICONES[x.efeito] || ""}</span><b>${escapar(x.nome)}</b><small>${escapar(x.texto || "")}</small>`;
        return s;
      };
      li.append(valor, ef("caos", f.caos), ef("ajuda", f.ajuda));
      return li;
    }));
  },

  /* ───────── por quadro (barato: só mexe no que mudou) ───────── */

  placar(partida, controle) {
    const u = this.ultimo;
    if (u.pontos !== partida.pontos) {
      this.$.pontos.textContent = fmt.format(partida.pontos);
      if (partida.pontos > (u.pontos ?? 0)) {
        this.$.pontos.classList.remove("ganhou");
        void this.$.pontos.offsetWidth;
        this.$.pontos.classList.add("ganhou");
      }
      u.pontos = partida.pontos;
    }

    const faltam = partida.faltam();
    const txtFaltam = partida.fase === "morte" ? ""
      : partida.bateuRecorde ? "Novo recorde da live!"
      : faltam > 0 ? `Faltam ${fmt.format(faltam)} pro recorde`
      : partida.recordeLive === 0 ? "Primeiro voo da live" : "";
    if (u.faltam !== txtFaltam) {
      this.$.faltam.textContent = txtFaltam;
      this.$.faltam.classList.toggle("novo", partida.bateuRecorde);
      u.faltam = txtFaltam;
    }

    const rec = `${partida.recordeLive}|${partida.recordeSalvo}`;
    if (u.rec !== rec) {
      this.$.recorde.querySelector(".num").textContent = fmt.format(partida.recordeLive);
      this.$.recorde.querySelector(".sub").innerHTML = `deste PC: <b>${fmt.format(partida.recordeSalvo)}</b>`;
      u.rec = rec;
    }

    if (!this.cfg.modoSeguro && u.moedas !== partida.moedas) {
      const num = this.$.moedas.querySelector(".num");
      num.textContent = fmt.format(partida.moedas);
      num.classList.remove("pulo");
      void num.offsetWidth;
      num.classList.add("pulo");
      const m = partida.maiorPresente;
      this.$.moedas.querySelector(".sub").innerHTML = m ? `maior: <b>${escapar(encurtar(m.nome, 14))}</b> ${fmt.format(m.moedas)}` : "manda o primeiro";
      u.moedas = partida.moedas;
    }

    if (u.controle !== controle) {
      const auto = controle === "auto";
      this.$.controle.className = `controle ${auto ? "auto" : "streamer"}`;
      this.$.controle.innerHTML = `${auto ? ICONES.piloto : ICONES.streamer}<span>${auto ? "Piloto automático" : "Streamer no controle"}</span><span class="ponto"></span>`;
      u.controle = controle;
    }

    if (u.vidas !== partida.vidas) {
      const max = this.cfg.vidasMax;
      const html = [];
      if (partida.vidas > 0) for (let i = 0; i < max; i++) html.push(ICONES.vida.replace("<svg", `<svg class="${i < partida.vidas ? (i >= (u.vidas || 0) ? "nova" : "") : "vazia"}"`));
      this.$.vidas.innerHTML = html.join("");
      u.vidas = partida.vidas;
    }

    const carga = this.cfg.chat.carga;
    for (const [time, alvo] of [["ajuda", this.$.barraAjuda], ["caos", this.$.barraCaos]]) {
      const v = partida.barra[time];
      if (u["barra" + time] !== v) {
        alvo.querySelector("i").style.transform = `scaleX(${v / carga})`;
        alvo.querySelector("b").textContent = `${v}/${carga}`;
        u["barra" + time] = v;
      }
    }

    this.efeitos(partida);
    this.evento(partida);
  },

  nomeEfeito(efeito) {
    if (efeito === "escudo") return "Bolha";
    for (const f of this.cfg.faixas) {
      if (f.caos.efeito === efeito) return f.caos.nome;
      if (f.ajuda.efeito === efeito) return f.ajuda.nome;
    }
    return efeito;
  },

  efeitos(partida) {
    const lista = [];
    for (const nome of ["inverte", "meteoros", "neblina", "vento", "turbo", "lento", "escudo"]) {
      if (partida.ativo(nome)) {
        const e = partida.efeitos[nome];
        lista.push({ nome, dono: e.dono, k: (e.ate - partida.t) / Math.max(0.1, e.total), resta: e.ate - partida.t });
      }
    }
    const gig = partida.mundo.gigantes;
    if (gig.length) lista.push({ nome: "gigante", dono: gig[0], k: 1, resta: null, n: gig.length });

    const chave = lista.map(e => `${e.nome}:${e.dono ? e.dono.id : ""}:${e.n || ""}`).join("|");
    if (chave !== this.chaveEfeitos) {
      this.chaveEfeitos = chave;
      this.$.efeitos.replaceChildren(...lista.map(e => {
        const li = el("li");
        li.dataset.nome = e.nome;
        li.style.setProperty("--cor", COR_EFEITO[e.nome]);
        const titulo = e.nome === "gigante" ? `${this.nomeEfeito(e.nome)} ×${e.n}` : this.nomeEfeito(e.nome);
        li.innerHTML = `<span class="ic">${ICONES[e.nome]}</span><b>${escapar(titulo)}</b><small></small><span class="tempo"></span>`;
        return li;
      }));
    }
    const itens = this.$.efeitos.children;
    lista.forEach((e, i) => {
      const li = itens[i];
      if (!li) return;
      const dono = e.dono ? e.dono.nome : "";
      li.querySelector("small").textContent = e.resta == null ? `de ${dono}` : `${Math.ceil(e.resta)} s · ${dono}`;
      li.querySelector(".tempo").style.transform = `scaleX(${Math.max(0, Math.min(1, e.k))})`;
    });
  },

  evento(partida) {
    const ev = partida.evento;
    const box = this.$.evento;
    if (!ev) {
      if (box.classList.contains("on")) box.classList.remove("on");
      return;
    }
    if (box.dataset.nome !== ev.nome + ev.inicio) {
      box.dataset.nome = ev.nome + ev.inicio;
      const info = EVENTOS[ev.nome];
      box.innerHTML = `<div class="rot">Evento-surpresa</div><h4>${escapar(info.titulo)}</h4><p>${escapar(info.texto)}</p><span class="tempo"></span>`;
      box.classList.add("on");
    }
    box.querySelector(".tempo").style.transform = `scaleX(${Math.max(0, (ev.ate - partida.t) / (ev.ate - ev.inicio))})`;
  },

  /* ───────── feed e ranking ───────── */

  feed(j, texto, cor, guardado = false) {
    const lista = this.$.feed;
    const primeiro = lista.firstElementChild;
    if (primeiro && primeiro.dataset.chave === j.id + texto) {
      const n = Number(primeiro.dataset.n) + 1;
      primeiro.dataset.n = n;
      primeiro.querySelector(".vezes").textContent = `×${n}`;
      return;
    }
    const li = el("li", guardado ? "guardado" : null);
    li.dataset.chave = j.id + texto;
    li.dataset.n = 1;
    const oq = el("span", "oq", texto);
    oq.style.setProperty("--cor", cor);
    li.append(criarAvatar(j), el("span", "nome", j.nome), oq, el("span", "vezes"));
    lista.prepend(li);
    while (lista.children.length > 4) lista.lastElementChild.remove();
  },

  ranking(partida) {
    const top = partida ? partida.ranking("abates", 3) : [];
    const chave = top.map(j => j.id + j.abates).join("|");
    if (this.chaveRanking === chave) return;
    this.chaveRanking = chave;
    if (!top.length) {
      this.$.ranking.replaceChildren(el("li", "vazio", "Ninguém derrubou o Tuca ainda"));
      return;
    }
    this.$.ranking.replaceChildren(...top.map((j, i) => {
      const li = el("li");
      li.append(el("span", "pos", `${i + 1}º`), criarAvatar(j), el("span", "nome", j.nome), el("span", "n", `${j.abates}×`));
      return li;
    }));
  },

  /* ───────── anúncio de presente grande ───────── */

  anunciar(a) {
    this.filaAnuncio.push(a);
    if (this.filaAnuncio.length > 6) this.filaAnuncio.splice(1, 1);
    if (!this.anunciando) this.proximoAnuncio();
  },

  proximoAnuncio() {
    const box = this.$.anuncio;
    if (this.filaAnuncio.length && this.palco.classList.contains("morrendo")) {
      this.anunciando = true;
      box.classList.remove("on");
      this.tAnuncio = setTimeout(() => this.proximoAnuncio(), 400);
      return;
    }
    const a = this.filaAnuncio.shift();
    if (!a) {
      this.anunciando = false;
      box.classList.remove("on");
      return;
    }
    this.anunciando = true;
    box.className = `anuncio${a.lendario ? " lendario" : ""}${this.tucaEmCima && this.tucaEmCima() ? " embaixo" : ""}`;
    box.style.setProperty("--cor", a.cor);
    box.replaceChildren();
    box.append(el("div", "fita", a.fita));
    if (a.jogador) {
      const quem = el("div", "quem");
      quem.append(criarAvatar(a.jogador), el("div", "nome", a.jogador.nome));
      box.append(quem);
    }
    if (a.texto) box.append(el("div", "texto", a.texto));
    void box.offsetWidth;
    box.classList.add("on");
    const ms = (a.ms || 2400) * (this.filaAnuncio.length > 2 ? 0.6 : 1);
    clearTimeout(this.tAnuncio);
    this.tAnuncio = setTimeout(() => {
      box.classList.remove("on");
      setTimeout(() => this.proximoAnuncio(), 260);
    }, ms);
  },

  /* ───────── morte ───────── */

  /* Nome no maior tamanho que cabe na largura. */
  ajustarNome(nomeEl, max, largura) {
    const medida = document.createElement("canvas").getContext("2d");
    medida.font = `900 ${max}px ${DISPLAY}`;
    const w = medida.measureText(nomeEl.textContent.toUpperCase()).width + max * 0.2;
    nomeEl.style.fontSize = `${Math.max(60, Math.min(max, (max * largura) / w))}px`;
  },

  morte(m, partida, controle) {
    const box = this.$.morte;
    box.replaceChildren();
    const j = m.matador || (m.dono && { id: m.dono.id, nome: m.dono.nome });
    box.classList.toggle("sozinho", !j);
    const vertical = this.palco.classList.contains("vertical");
    if (j) {
      box.append(el("div", "fita", "Derrubou o Tuca"));
      if (j.id !== "@chat") box.append(criarAvatar(j));
      const nome = el("div", "nome", encurtar(j.nome, 24));
      box.append(nome);
      this.ajustarNome(nome, vertical ? 200 : 170, vertical ? 980 : 1500);
      box.append(Object.assign(el("div", "como"), { innerHTML: `com <b>${escapar(CAUSAS[m.causa] || this.nomeEfeito(m.causa))}</b>` }));
    } else {
      box.append(el("div", "fita", "Caiu sozinho"));
      const nome = el("div", "nome", controle === "auto" ? "Piloto vacilou" : "Vacilou!");
      box.append(nome);
      this.ajustarNome(nome, vertical ? 170 : 150, vertical ? 980 : 1500);
      box.append(Object.assign(el("div", "como"), { innerHTML: `bateu ${CAUSAS_SOZINHO[m.com] || "no pilar"}, sem ninguém sabotar` }));
    }
    const resumo = el("div", "resumo");
    resumo.innerHTML = `<div><b>${fmt.format(m.pontos)}</b>pontos</div>` +
      `<div class="${m.bateuRecorde ? "novo" : ""}"><b>${fmt.format(partida.recordeLive)}</b>${m.bateuRecorde ? "novo recorde!" : "recorde da live"}</div>`;
    box.append(resumo);
    const top = partida.ranking("abates", 3);
    if (top.length) {
      const ol = el("ol", "top");
      ol.append(el("h5", null, "Quem mais derrubou na live"));
      top.forEach((x, i) => {
        const li = el("li");
        li.append(el("span", "pos", `${i + 1}º`), criarAvatar(x), el("span", "nome-top", x.nome), el("span", "n", `${x.abates}×`));
        ol.append(li);
      });
      box.append(ol);
    }
    this.proximo = el("div", "proximo");
    box.append(this.proximo);
    box.classList.add("on");
    this.palco.classList.add("morrendo");
  },

  contagemMorte(segundos) {
    if (this.proximo) this.proximo.textContent = `Próximo voo em ${Math.max(1, Math.ceil(segundos))}`;
  },

  esconderMorte() {
    this.$.morte.classList.remove("on");
    this.palco.classList.remove("morrendo");
  },

  dica(html) {
    if (html) this.$.dica.innerHTML = html;
    this.$.dica.classList.toggle("on", !!html);
  },

  sinal(estado) {
    const s = this.$.sinal;
    s.hidden = estado === "conectado" || estado === "demo";
    s.textContent = estado === "conectando" ? "Procurando o conector da live…" : "Sem conector da live: tentando de novo";
  },
};

const CAUSAS = {
  meteoro: "um meteoro", chinelo: "uma chinelada", gigante: "um pilar gigante",
  vento: "uma rajada de vento", neblina: "a neblina", inverte: "a gravidade invertida", meteoros: "a chuva de meteoros",
};
const CAUSAS_SOZINHO = { chao: "no chão", teto: "na fiação", pilar: "no pilar", chinelo: "num chinelo", meteoro: "num meteoro" };
