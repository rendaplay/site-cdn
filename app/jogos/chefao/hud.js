/* O que fica por cima da arena, em DOM (texto nítido): barra de vida,
   placar de moedas, ranking de dano, cardápio, faixa de estado, "faltam",
   balão de fala, anúncios, golpe final e tela de vitória. */
"use strict";

const fmt = new Intl.NumberFormat("pt-BR");

const ICONES = {
  coroa: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18h18l-1.5-10-4.5 4-3-7-3 7-4.5-4z"/></svg>`,
  moeda: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4"/></svg>`,
  coracao: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/></svg>`,
  balao: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>`,
  presente: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7c-2-4-6-3-5-1s5 1 5 1zm0 0c2-4 6-3 5-1s-5 1-5 1z"/></svg>`,
  caveira: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a8 8 0 0 0-5 14v3h10v-3a8 8 0 0 0-5-14z"/><circle cx="9" cy="11" r="1.6"/><circle cx="15" cy="11" r="1.6"/><path d="M10 20v-2M14 20v-2"/></svg>`,
  fogo: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/></svg>`,
  escudo: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/></svg>`,
};

const EVENTOS = {
  dobro: { titulo: "Dano em dobro", texto: "Todo golpe vale 2×", cor: "#FFD23F" },
  pontoFraco: { titulo: "Ponto fraco exposto!", texto: "Todo golpe é crítico: 3×", textoSeguro: "Comentário e curtida: 3×", cor: "#FF5AE0" },
  mutirao: { titulo: "Mutirão!", texto: "pessoas comentando = golpe coletivo", cor: "#5CFF9A" },
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
function criarAvatar(j, cls = "") {
  const a = el("span", "avatar " + cls);
  a.textContent = inicialDe(j.nome);
  a.style.setProperty("--avatar-cor", corDe(j.id || j.nome));
  if (j.foto) {
    const img = new Image();
    img.referrerPolicy = "no-referrer";
    img.onload = () => { a.textContent = ""; a.style.backgroundImage = `url("${img.src.replace(/"/g, "%22")}")`; };
    img.src = j.foto;
  }
  return a;
}

function duracao(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const Hud = {
  filaAnuncio: [],
  anunciando: false,
  visivel: { vida: -1, escudo: -1, rastro: 1 },

  montar(palco, cfg) {
    this.palco = palco;
    this.cfg = cfg;
    const q = s => palco.querySelector(s);
    this.$ = {
      moedas: q(".moedas"), derrotados: q(".derrotados"), rodada: q(".rodada"),
      nome: q(".nome-chefe"), chips: q(".chips"), barra: q(".barra"), cheio: q(".barra .cheio"),
      rastro: q(".barra .rastro"), escudo: q(".barra .escudo"), vidaNum: q(".vida-num"), pct: q(".pct"),
      estado: q(".estado"), faltam: q(".faltam"), fala: q(".fala"), anuncio: q(".anuncio"), aviso: q(".aviso"),
      cardapio: q(".cardapio ol"), ranking: q(".ranking ol"),
      final: q(".final"), sinal: q(".sem-sinal"), chamada: q(".chamada"),
    };
    q(".titulo-jogo").textContent = cfg.titulo;
    this.$.chamada.innerHTML = cfg.modoSeguro
      ? `<span>${ICONES.balao}<b>Comentário</b> soco de ${fmt.format(cfg.comentario.dano)}</span>` +
        `<span>${ICONES.coracao}<b>${fmt.format(cfg.curtida.cada)} curtidas</b> soco</span>`
      : `<span>${ICONES.balao}<b>Comente</b> soco de ${fmt.format(cfg.comentario.dano)}</span>` +
        `<span>${ICONES.presente}<b>Presente</b> = golpe</span>`;
    const m50 = q(".barra .m50");
    const m25 = q(".barra .m25");
    m50.style.left = cfg.fases.furia * 100 + "%";
    m25.style.left = cfg.fases.escudo * 100 + "%";
    m50.innerHTML = ICONES.fogo;
    m25.innerHTML = ICONES.escudo;
    this.montarCardapio();
  },

  montarCardapio() {
    const ol = this.$.cardapio;
    ol.replaceChildren();
    for (const f of this.cfg.faixas) {
      const li = el("li", "golpe-" + f.golpe);
      const icone = document.createElement("canvas");
      icone.width = 96;
      icone.height = 96;
      icone.className = "icone";
      Cena.icone(icone, f.golpe);
      const valor = el("span", "valor");
      valor.innerHTML = `${ICONES.moeda}${fmt.format(f.moedas)}${f === this.cfg.faixas[this.cfg.faixas.length - 1] ? "+" : ""}`;
      li.append(icone, valor, el("span", "nome", this.cfg.modoSeguro ? "→ " + f.nome : f.nome));
      ol.append(li);
    }
  },

  /* ───────── chefão e barra ───────── */

  chefe(c) {
    this.$.nome.textContent = c.nome;
    this.$.rodada.textContent = `Chefão ${c.numero}`;
    this.$.barra.style.setProperty("--cor-chefe", c.def.cor);
    this.visivel = { vida: -1, escudo: -1, rastro: 1 };
    this.$.faltam.classList.remove("on");
  },

  /* Todo quadro: a barra segue a vida "vista" (já descontado o que está em voo). */
  vida(c, emVoo, dt) {
    const vida = c.estado === "luta" ? Math.min(c.vidaMax, c.vida + emVoo.vida) : 0;
    const escudo = c.estado === "luta" && Cena.escudoLigado ? c.escudo + emVoo.escudo : 0;
    const frac = vida / c.vidaMax;
    const v = this.visivel;
    if (frac > v.rastro) v.rastro = frac;
    else v.rastro += (frac - v.rastro) * Math.min(1, dt * (frac < v.rastro - 0.001 ? 2.2 : 10));
    if (Math.abs(v.vida - frac) > 0.0001 || Math.abs(v.rastroDesenhado - v.rastro) > 0.0005) {
      this.$.cheio.style.width = (frac * 100).toFixed(2) + "%";
      this.$.rastro.style.width = (v.rastro * 100).toFixed(2) + "%";
      v.rastroDesenhado = v.rastro;
    }
    if (v.vida !== frac || v.escudo !== escudo) {
      v.vida = frac;
      v.escudo = escudo;
      const esc = c.escudoMax ? escudo / c.escudoMax : 0;
      this.$.escudo.style.width = (esc * Math.max(frac, 0.06) * 100).toFixed(2) + "%";
      this.$.barra.classList.toggle("com-escudo", escudo > 0);
      this.$.vidaNum.innerHTML = escudo > 0
        ? `${ICONES.escudo}<b>${fmt.format(Math.ceil(escudo))}</b> de escudo · ${fmt.format(Math.ceil(vida))} / ${fmt.format(c.vidaMax)}`
        : `<b>${fmt.format(Math.ceil(vida))}</b> / ${fmt.format(c.vidaMax)}`;
      this.$.pct.textContent = `${Math.ceil(frac * 100)}%`;
      this.$.barra.classList.toggle("baixa", frac <= this.cfg.faltam);
    }
  },

  chips(raid, agora) {
    const c = raid.chefe;
    const lista = [];
    if (c.estado === "luta") {
      if (c.furia) lista.push(["furia", "Fúria"]);
      if (c.escudo > 0) lista.push(["escudo", "Escudo"]);
      if (agora < c.tontoAte) lista.push(["tonto", "Tonto ×" + String(raid.cfg.contra.tontoDano).replace(".", ",")]);
    }
    const chave = lista.map(x => x[0]).join(",");
    if (this.$.chips.dataset.chave === chave) return;
    this.$.chips.dataset.chave = chave;
    this.$.chips.replaceChildren(...lista.map(([cls, txt]) => el("span", "chip chip-" + cls, txt)));
  },

  /* ───────── faixa de estado: contra-ataque, evento, cura ───────── */

  estado(raid, agora) {
    const c = raid.chefe;
    const caixa = this.$.estado;
    let modo = null;
    let titulo = "";
    let texto = "";
    let progresso = 0;
    let cor = "#FFD23F";
    if (c.estado === "luta" && c.contra) {
      modo = "contra";
      const falta = Math.max(0, c.contra.meta - c.contra.feito);
      titulo = `${c.def.contra}! ${Math.ceil((c.contra.fim - agora) / 1000)} s`;
      texto = `Bata <b>${fmt.format(falta)}</b> pra interromper, senão ele cura ${Math.round(raid.cfg.contra.cura * 100)}%`;
      progresso = Math.min(1, c.contra.feito / c.contra.meta);
      cor = "#FF4A3A";
    } else if (raid.evento) {
      const ev = raid.evento;
      const info = EVENTOS[ev.tipo];
      modo = "evento-" + ev.tipo;
      titulo = info.titulo;
      cor = info.cor;
      if (ev.tipo === "mutirao") {
        const meta = raid.cfg.surpresa.mutirao.pessoas;
        texto = `<b>${ev.pessoas.size}/${meta}</b> pessoas comentando = golpe coletivo`;
      } else texto = raid.cfg.modoSeguro && info.textoSeguro || info.texto;
      progresso = Math.max(0, (ev.fim - agora) / (ev.fim - ev.inicio));
    } else if (c.estado === "luta" && c.curando) {
      modo = "cura";
      titulo = "Ele está se curando!";
      texto = raid.cfg.modoSeguro ? "Cada golpe interrompe a cura" : "Comente ou mande presente pra parar";
      progresso = c.vida / c.vidaMax;
      cor = "#5CFF9A";
    }
    if (!modo) {
      if (caixa.classList.contains("on")) caixa.classList.remove("on");
      return;
    }
    if (caixa.dataset.modo !== modo) {
      caixa.dataset.modo = modo;
      caixa.style.setProperty("--cor", cor);
      caixa.innerHTML = `<b class="titulo"></b><span class="texto"></span><i><u></u></i>`;
    }
    caixa.classList.add("on");
    const t = caixa.querySelector(".titulo");
    if (t.textContent !== titulo) t.textContent = titulo;
    const s = caixa.querySelector(".texto");
    if (s.innerHTML !== texto) s.innerHTML = texto;
    caixa.querySelector("u").style.width = (progresso * 100).toFixed(1) + "%";
  },

  /* ───────── faltam X ───────── */

  faltam(raid, emVoo, agora, destacar = false) {
    const caixa = this.$.faltam;
    const c = raid.chefe;
    const vida = c.vida + emVoo.vida;
    const ligado = !raid.cfg.modoSeguro && c.estado === "luta" && vida / c.vidaMax <= raid.cfg.faltam;
    if (!ligado) {
      if (caixa.classList.contains("on")) caixa.classList.remove("on");
      return;
    }
    const f = raid.faltam();
    const valor = f.alvo === "escudo" ? Math.ceil(c.escudo + emVoo.escudo) : Math.ceil(vida);
    const sug = raid.sugestao(valor + (f.alvo === "escudo" ? Math.ceil(vida) : 0), agora);
    const html = `<span><b>Faltam ${fmt.format(valor)}</b> ${f.alvo === "escudo" ? "de escudo" : "de vida"}!</span>` +
      (sug ? `<small>1 <em>${escapar(sug.nome)}</em> derruba</small>` : "");
    if (caixa.dataset.html !== html) {
      caixa.dataset.html = html;
      caixa.innerHTML = html;
    }
    caixa.classList.add("on");
    if (destacar) caixa.animate([{ transform: "translateX(-50%) scale(1.35)" }, { transform: "translateX(-50%) scale(1)" }], { duration: 500, easing: "cubic-bezier(.2,.9,.3,1.3)" });
  },

  /* ───────── placares ───────── */

  placar(raid) {
    const m = this.$.moedas;
    const num = m.querySelector(".num");
    const txt = fmt.format(raid.moedas);
    if (num.textContent !== txt) {
      num.textContent = txt;
      num.animate([{ transform: "scale(1.18)" }, { transform: "scale(1)" }], { duration: 300, easing: "ease-out" });
    }
    const top = raid.doadores(1)[0];
    this.trocar(m.querySelector(".sub"), top ? `maior: <b>${escapar(top.nome)}</b> ${fmt.format(top.moedas)}` : "nenhum presente ainda");

    const d = this.$.derrotados;
    d.querySelector(".num").textContent = String(raid.derrotados);
    const rei = raid.rankingLive(1)[0];
    this.trocar(d.querySelector(".sub"), rei ? `maior dano: <b>${escapar(rei.nome)}</b>` : "ninguém bateu ainda");

    if (raid.chefe.estado === "luta") this.ranking(raid.ranking(5), raid.chefe);
  },

  trocar(elemento, html) {
    if (elemento.dataset.html !== html) {
      elemento.dataset.html = html;
      elemento.innerHTML = html;
    }
  },

  ranking(lista, chefe) {
    const ol = this.$.ranking;
    const chave = chefe.numero + "|" + lista.map(j => j.id + ":" + j.danoChefe).join("|");
    if (ol.dataset.chave === chave) return;
    ol.dataset.chave = chave;
    ol.replaceChildren();
    const max = lista.length ? lista[0].danoChefe : 1;
    for (let i = 0; i < 5; i++) {
      const j = lista[i];
      const li = el("li", j ? (i === 0 ? "primeiro" : "") : "vazio");
      li.append(el("span", "pos", String(i + 1)));
      if (j) {
        li.append(criarAvatar(j), el("span", "quem", j.nome), el("span", "valor", fmt.format(j.danoChefe)));
        li.style.setProperty("--parte", (j.danoChefe / max * 100).toFixed(1) + "%");
      } else li.append(el("span", "quem", i === 0 ? "Dê o primeiro golpe" : "—"));
      ol.append(li);
    }
  },

  /* ───────── fala, aviso e anúncios ───────── */

  falar(texto, ms = 2800) {
    const f = this.$.fala;
    f.textContent = texto;
    f.classList.remove("on");
    void f.offsetWidth;
    f.classList.add("on");
    clearTimeout(this._fala);
    this._fala = setTimeout(() => f.classList.remove("on"), ms);
  },

  esconderFala() {
    clearTimeout(this._fala);
    this.$.fala.classList.remove("on");
  },

  aviso(html) {
    const a = this.$.aviso;
    a.innerHTML = html;
    a.classList.remove("on");
    void a.offsetWidth;
    a.classList.add("on");
    clearTimeout(this._aviso);
    this._aviso = setTimeout(() => a.classList.remove("on"), 2400);
  },

  anunciar({ fita, nome, texto, cor = "#FFD23F", jogador = null, ms = 2600 }) {
    this.filaAnuncio.push({ fita, nome, texto, cor, jogador, ms });
    /* Fila curta: com 50 presentes no mesmo segundo, os do meio caem. */
    if (this.filaAnuncio.length > 3) this.filaAnuncio.splice(1, 1);
    if (!this.anunciando) this.proximoAnuncio();
  },

  proximoAnuncio() {
    const a = this.filaAnuncio.shift();
    const caixa = this.$.anuncio;
    if (!a) { this.anunciando = false; return; }
    this.anunciando = true;
    const cartao = el("div", "cartao");
    cartao.style.setProperty("--cor", a.cor);
    const corpo = el("div", "corpo");
    if (a.jogador) corpo.append(criarAvatar(a.jogador));
    const linhas = el("div", "linhas");
    if (a.nome) linhas.append(el("div", "nome", a.nome));
    if (a.texto) linhas.append(el("div", "texto", a.texto));
    corpo.append(linhas);
    cartao.append(el("div", "fita", a.fita), corpo);
    caixa.replaceChildren(cartao);
    const ms = this.filaAnuncio.length ? Math.min(a.ms, 1700) : a.ms;
    cartao.animate([
      { transform: "scale(.6) rotate(-3deg)", opacity: 0 },
      { transform: "scale(1.06) rotate(1deg)", opacity: 1, offset: 0.1 },
      { transform: "scale(1) rotate(0)", opacity: 1, offset: 0.16 },
      { transform: "scale(1) rotate(0)", opacity: 1, offset: 0.86 },
      { transform: "scale(.94) translateY(-30px)", opacity: 0 },
    ], { duration: ms, easing: "ease-out" }).onfinish = () => {
      cartao.remove();
      this.proximoAnuncio();
    };
  },

  limparAnuncios() {
    this.filaAnuncio = [];
  },

  /* ───────── golpe final e vitória ───────── */

  golpeFinal(jogador, dano) {
    const f = this.$.final;
    f.className = "final on golpe";
    f.replaceChildren();
    const coroa = el("div", "coroa");
    coroa.innerHTML = ICONES.coroa;
    const av = criarAvatar(jogador, "grande");
    const nome = el("div", "nome-final", jogador.nome);
    f.append(el("div", "rotulo-final", "Golpe final"), coroa, av, nome, el("div", "dano-final", `${fmt.format(dano)} de dano no último golpe`));
    this.encaixarNome(nome);
  },

  /* Nome gigante: diminui a fonte até caber (nome comprido com emoji). */
  encaixarNome(nome) {
    let tam = 150;
    nome.style.fontSize = tam + "px";
    const max = nome.parentElement.clientWidth - 100;
    while (nome.scrollWidth > max && tam > 56) {
      tam -= 8;
      nome.style.fontSize = tam + "px";
    }
  },

  vitoria(info, raid, proximo) {
    const f = this.$.final;
    f.className = "final on vitoria";
    f.replaceChildren();
    const mvp = info.ranking[0];
    const final = raid.jogadores.get(info.golpeFinal);
    f.append(el("div", "rotulo-final", "Derrotado!"), el("div", "titulo-vitoria", info.chefe.nome));

    const cartao = el("div", "mvp");
    const coroa = el("span", "coroa-mvp");
    coroa.innerHTML = ICONES.coroa;
    const blocoAv = el("div", "mvp-av");
    blocoAv.append(criarAvatar(mvp, "grande"), coroa);
    const txt = el("div", "mvp-txt");
    txt.append(el("div", "mvp-rotulo", "MVP"), el("div", "mvp-nome", mvp.nome), el("div", "mvp-dano", `${fmt.format(mvp.danoChefe)} de dano`));
    cartao.append(blocoAv, txt);
    f.append(cartao);
    const nomeMvp = txt.querySelector(".mvp-nome");
    for (let tam = 76; nomeMvp.scrollWidth > nomeMvp.clientWidth && tam > 40; tam -= 6) nomeMvp.style.fontSize = tam - 6 + "px";

    const top = el("ol", "top3");
    info.ranking.forEach((j, i) => {
      const li = el("li");
      li.append(el("span", "pos", String(i + 1)), criarAvatar(j), el("span", "quem", j.nome), el("span", "valor", fmt.format(j.danoChefe)));
      top.append(li);
    });
    f.append(top);

    const linha = el("div", "linha-vitoria");
    linha.innerHTML = `<span>Golpe final: <b>${escapar(final ? final.nome : "?")}</b></span><span>Luta: <b>${duracao(info.tempo)}</b></span>`;
    f.append(linha);
    const prox = el("div", "proximo");
    prox.innerHTML = `Próximo chefão: <b>${escapar(proximo)}</b> <span class="conta"></span>`;
    f.append(prox);
  },

  contagemVitoria(segundos) {
    const c = this.$.final.querySelector(".conta");
    if (c) c.textContent = segundos > 0 ? `em ${Math.ceil(segundos)} s` : "";
  },

  fecharFinal() {
    this.$.final.className = "final";
  },

  sinal(estado) {
    const s = this.$.sinal;
    s.hidden = estado === "conectado" || estado === "demo";
    s.textContent = estado === "desconectado" ? "Sem conector: tentando de novo…" : "Procurando o conector…";
  },
};
