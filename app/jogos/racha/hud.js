/* Tudo que é texto na tela: placar, feed, cardápio, cartões de presente,
   anúncios, contagem, barra LARGADA → CHEGADA, espera e pódio, e os textos
   que sobem dos carros. Animação guiada pelo relógio do jogo
   (Hud.quadro), não por CSS: pausa junto e grava quadro a quadro igual. */
"use strict";

const fmt = new Intl.NumberFormat("pt-BR");
const CORES_AVATAR = ["#3B4C7A", "#6B3F7A", "#2F6E73", "#7A5A2F", "#4F6B2F", "#7A2F4A", "#2F4F7A", "#5E5E6E"];

const ICONES = {
  turbo: '<path d="M13.5 2 4 14h6.5l-1.5 8 10-12.5h-6.6z"/>',
  nitro: '<path d="M12.6 2c.9 3.9 5.4 6.2 5.4 11.4a6 6 0 0 1-12 0c0-2.5 1.1-4.3 2.4-5.5.1 2.2 1.1 3.4 2.3 3.6-.3-3.4-.4-6.6 1.9-9.5z"/>',
  oleo: '<path d="M12 2.5s6.5 7.4 6.5 12a6.5 6.5 0 0 1-13 0c0-4.6 6.5-12 6.5-12zm-2.6 11.2a2.6 2.6 0 0 0 2.6 3.6v-1.6a1.2 1.2 0 0 1-1.2-1.6z"/>',
  missil: '<path d="M21.5 2.5c-3.4-.2-6.9 1.4-9.6 4.1L7.8 10.7 4 10.4 2 12.4l4.3 1.3 4 4 1.3 4.3 2-2-.3-3.8 4.1-4.1c2.7-2.7 4.3-6.2 4.1-9.6zM15.8 9.8a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6zM5.6 15.6 2.5 21.5l5.9-3.1z"/>',
  escudo: '<path d="M12 2 20 5v6.2c0 5-3.4 9.3-8 10.8-4.6-1.5-8-5.8-8-10.8V5zm-1 13.4 6-6-1.4-1.4-4.6 4.6-2.1-2.1L7.5 11.9z"/>',
  bomba: '<circle cx="10" cy="14.5" r="7"/><path d="M14.3 8.2 16.6 6l1.4 1.4-2.3 2.3zM18.5 2.5l.6 1.8 1.9.1-1.5 1.1.5 1.8-1.5-1.1-1.5 1.1.5-1.8-1.5-1.1 1.9-.1z"/>',
  buzina: '<path d="M3 9.5v5h3.5L12 19V5L6.5 9.5zM15 8.3a5 5 0 0 1 0 7.4l-1.2-1.2a3.3 3.3 0 0 0 0-5zM17.6 5.7a8.6 8.6 0 0 1 0 12.6l-1.2-1.2a6.9 6.9 0 0 0 0-10.2z"/>',
  coroa: '<path d="M2.5 19h19l-1.6-11-4.7 4.2L12 5.5l-3.2 6.7L4.1 8z"/>',
  bandeira: '<path d="M5 2h2v20H5zM8 3h12v10H8zm2 0v2.5h2.5V3zm5 0v2.5h2.5V3zm-2.5 2.5V8H15V5.5zm5 0V8H20V5.5zM10 8v2.5h2.5V8zm5 0v2.5h2.5V8zm-2.5 2.5V13H15v-2.5zm5 0V13H20v-2.5z"/>',
  passou: '<path d="M3 15h10v3l6-5-6-5v3H3zM6 4h9v2H6z"/>',
  apoio: '<path d="M7 11.5 3 15.5l5.5 5.5 4-4zM12.5 6l-5 5 6 6 1.5-1.5-1-1 1.4-1.4 1 1 1.6-1.6-1-1 1.4-1.4 1 1L21 9.4 15.6 4z"/>',
  moeda: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5" fill="rgba(0,0,0,.25)"/>',
  chuva: '<path d="M7 15a5 5 0 1 1 1.4-9.8A6 6 0 0 1 19.6 8 4 4 0 0 1 18 15.9zM8 17l-1.5 4M12 17l-1.5 4M16 17l-1.5 4" stroke="currentColor" stroke-width="1.6"/>',
};
const icone = (nome, cls = "") => `<span class="ic ${cls}"><svg viewBox="0 0 24 24">${ICONES[nome] || ""}</svg></span>`;

const EFEITOS = {
  turbo: { nome: "TURBO", cor: "cor-turbo" },
  nitro: { nome: "NITRO", cor: "cor-nitro" },
  oleo: { nome: "ÓLEO", cor: "cor-oleo" },
  missil: { nome: "MÍSSIL", cor: "cor-missil" },
  escudo: { nome: "ESCUDO", cor: "cor-escudo" },
  bomba: { nome: "BOMBA", cor: "cor-bomba" },
};
const NOMES_SURPRESA = {
  dobro: ["Nitro em dobro", "todo presente vale 2×"],
  chuva: ["Chuva na pista", "comentar vira turbo, a cada 3 s"],
  missil: ["Temporada de míssil", "míssil a partir de 100 moedas"],
};

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

function escapar(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const arroba = p => `<b>@${escapar(p ? p.nome : "?")}</b>`;

function corDoCarro(p, rei) {
  return rei ? Carros.OURO : Carros.PALETA[p.cor % Carros.PALETA.length];
}

function textoSobre(hex) {
  const n = parseInt(hex.slice(1), 16);
  const l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.55 ? "#111" : "#fff";
}

function chip(p, rei) {
  const cor = corDoCarro(p, rei);
  return `<span class="chip" style="background:${cor};color:${textoSobre(cor)}">${p.numero}</span>`;
}

function criarAvatar(quem) {
  const a = el("span", "avatar");
  const nome = String(quem.nome || "?").replace(/^[^a-z0-9]+/i, "");
  a.textContent = (nome[0] || "?").toUpperCase();
  a.style.background = CORES_AVATAR[hashTexto(quem.id || quem.nome) % CORES_AVATAR.length];
  if (quem.foto) {
    const img = new Image();
    img.referrerPolicy = "no-referrer";
    img.onload = () => { a.textContent = ""; a.style.backgroundImage = `url("${img.src.replace(/"/g, "%22")}")`; };
    img.src = quem.foto;
  }
  return a;
}

function carrinho(cor) {
  return `<svg viewBox="0 0 52 30"><path d="M2.5 22.5v-6.2l6.4-2.1 7-6.7h16.6l8.2 6.6 8 2.2v6.2z" fill="${cor}" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/>` +
    '<path d="M17.4 9.4h6.6v5.4H12zM26.6 9.4h5.6l5.6 5.4H26.6z" fill="#1b2633"/>' +
    '<circle cx="13" cy="23" r="4.6" fill="#141414"/><circle cx="40" cy="23" r="4.6" fill="#141414"/></svg>';
}

const Hud = {
  tempo: 0,
  feedLinhas: [],
  cartoesAtivos: [],
  filaCartoes: [],
  filaAnuncios: [],
  anuncio: null,
  flutuantes: [],
  linhasPlacar: new Map(),
  iconesBarra: new Map(),
  proxLento: 0,

  montar(palco, config) {
    this.palco = palco;
    this.config = config;
    const $ = s => palco.querySelector(s);
    this.$ = $;
    this.el = {
      rodada: $(".rodada"), placar: $(".placar"), espera: $(".espera"), podio: $(".podio"),
      feed: $(".feed"), cardapio: $(".cardapio"), surpresa: $(".surpresa"), anuncios: $(".anuncios"),
      cartoes: $(".cartoes"), contagem: $(".contagem"), progresso: $(".progresso"), avisos: $(".avisos"),
      pista: $(".hud-pista"),
    };
    palco.classList.toggle("seguro", !!config.modoSeguro);
    this.el.placar.innerHTML = '<div class="grade"></div><div class="rodape"><span class="pilotos"></span><span class="moedas"></span></div>';
    this.grade = this.el.placar.querySelector(".grade");
    this.montarCardapio();
    this.montarProgresso();
  },

  montarCardapio(evento = null) {
    const promo = evento && evento.tipo === "missil" ? this.config.surpresa.missil.moedas : null;
    const seguro = this.config.modoSeguro;
    this.el.cardapio.innerHTML = this.config.faixas.map(f => {
      const e = EFEITOS[f.efeito] || { nome: f.efeito, cor: "" };
      if (seguro) return `<div class="item"><span class="moedas"><b>${fmt.format(f.moedas)}</b> →</span>${icone(f.efeito, e.cor)}<span class="nome ${e.cor}">${e.nome}</span></div>`;
      const barato = promo && f.efeito === "missil";
      return `<div class="item${barato ? " barato" : ""}">${icone(f.efeito, e.cor)}<span class="nome ${e.cor}">${e.nome}</span>` +
        `<span class="moedas"><b>${fmt.format(barato ? promo : f.moedas)}+</b> moedas</span></div>`;
    }).join("");
  },

  montarProgresso() {
    const pista = this.config.pista;
    const marcos = [0.25, 0.5, 0.75].map(f => `<div class="marco" style="left:${f * 100}%"><span>${fmt.format(Math.round(pista * f))} m</span></div>`).join("");
    this.el.progresso.innerHTML = `<span class="ponta ini">LARGADA</span><div class="trilho"><div class="feito"></div>${marcos}` +
      '<div class="pontos"></div><div class="carros"></div></div><span class="ponta fim"><span>CHEGADA</span></span>';
    this.trilho = this.el.progresso.querySelector(".trilho");
    this.feito = this.el.progresso.querySelector(".feito");
    this.pontosBarra = this.el.progresso.querySelector(".pontos");
    this.carrosBarra = this.el.progresso.querySelector(".carros");
  },

  formato(nome) {
    this.formatoAtual = nome;
    this.linhasPlacar.forEach(l => l.remove());
    this.linhasPlacar.clear();
  },

  /* ───────────── acontecimentos ───────────── */

  contar(lista, racha) {
    for (const a of lista) {
      switch (a.tipo) {
        case "entrou":
          if (a.fila) this.feed(icone("bandeira"), `${arroba(a.piloto)} está na fila da próxima rodada`);
          else this.feed(icone("bandeira"), `${arroba(a.piloto)} entrou ${a.atrasado ? "atrasado, larga da rabeira" : "na corrida"} · <em class="cor-ouro">#${a.piloto.numero}</em>`);
          break;
        case "buzina":
          this.flutuar(a.piloto.id, a.chuva ? "TURBO!" : "BI-BI!", a.chuva ? "var(--turbo)" : "#fff");
          break;
        case "apoio":
          if (a.alvo) this.feed(icone("apoio", "cor-rosa"), `${arroba(a.quem)} agora empurra ${arroba(a.alvo)}`);
          break;
        case "presente": this.presente(a); break;
        case "atingido": this.atingido(a, racha); break;
        case "bloqueou":
          this.feed(icone("escudo", "cor-escudo"), `escudo de ${arroba(a.alvo)} segurou ${EFEITOS[a.efeito].nome.toLowerCase()} de ${arroba(a.por)}`);
          this.flutuar(a.alvo.id, "BLOQUEOU!", "var(--escudo)");
          break;
        case "seguiu":
        case "compartilhou":
          this.feed(icone(a.efeito, EFEITOS[a.efeito].cor), `${arroba(a.piloto)} ${a.tipo === "seguiu" ? "seguiu" : "compartilhou"} e ganhou <em class="${EFEITOS[a.efeito].cor}">${EFEITOS[a.efeito].nome}</em>`);
          break;
        case "curtida":
          if (a.curtidas >= 5) this.flutuar(a.piloto.id, `+${a.curtidas} ♥`, "var(--rosa)", 0.9);
          break;
        case "lider":
          this.anunciar("lider", "Novo líder", `${arroba(a.piloto)} passou ${arroba(a.anterior)}`, 3);
          this.feed(icone("coroa", "cor-ouro"), `${arroba(a.piloto)} assumiu a liderança`);
          break;
        case "ultrapassagem":
          this.flutuar(a.piloto.id, `PASSOU! ${a.posicao}º`, "#fff");
          this.feed(icone("passou"), `${arroba(a.piloto)} passou ${arroba(a.passou)} · <em>${a.posicao}º</em>`);
          break;
        case "falta":
          this.anunciar("falta", `Faltam ${fmt.format(Math.round(a.metros))} m pro 1º`, this.config.modoSeguro ? `${arroba(a.piloto)} está na caça` : `${arroba(a.piloto)}, um <b class="cor-nitro">NITRO</b> resolve`, 1);
          break;
        case "retaFinal":
          if (this.config.modoSeguro) this.anunciar("reta", "Reta final", `${arroba(a.lider)} vê a chegada`, 2, 3);
          else this.anunciar("reta", "Reta final", `presente vale <b>${a.multiplicador}×</b> até a chegada`, 2, 3);
          break;
        case "largada":
          this.contagemFim = null;
          break;
        case "vai":
          this.contagemFim = this.tempo + 0.9;
          break;
        case "chegou":
          if (a.posicao === 1) this.anunciar("venceu", `${escapar(a.piloto.nome)} venceu!`, `${fmt.format(Math.round(a.tempo * 10) / 10)} s de corrida`, 4, 3);
          break;
        case "podio": this.mostrarPodio(a, racha); break;
        case "espera":
          this.el.podio.hidden = true;
          break;
        case "surpresa":
          this.anunciar("surpresa", NOMES_SURPRESA[a.evento.tipo][0], NOMES_SURPRESA[a.evento.tipo][1], 2, 3);
          if (a.evento.tipo === "missil") this.montarCardapio(a.evento);
          break;
        case "fimSurpresa":
          if (a.evento.tipo === "missil") this.montarCardapio();
          break;
      }
    }
  },

  presente(a) {
    const nomePresente = this.config.nomes[a.nomePresente] || a.nomePresente || "presente";
    const qtd = a.quantidade > 1 ? ` ×${a.quantidade}` : "";
    if (!a.efeito) return;
    const e = EFEITOS[a.efeito];
    const para = a.para ? ` para ${arroba(a.alvo)}` : "";
    if (a.largada) {
      this.feed(icone("nitro", "cor-nitro"), `${arroba(a.quem)} guardou <em class="cor-nitro">NITRO</em> pra largada${para}`);
    } else if (a.efeito === "turbo" || a.efeito === "nitro" || a.efeito === "escudo") {
      this.feed(icone(a.efeito, e.cor), `${arroba(a.quem)} ativou <em class="${e.cor}">${e.nome}</em>${para}`);
    }
    if (a.efeito === "bomba" && !a.largada) this.anunciar("ataque", "Bomba no top 5!", `${arroba(a.quem)} explodiu a frente da corrida`, 3, 3);
    this.flutuar(a.alvo.id, a.largada ? "NITRO NA LARGADA" : e.nome + (a.dobro ? " 2×" : ""), `var(--${a.largada ? "nitro" : a.efeito})`);

    const alvo = a.para ? `<span class="seta">→</span><span class="alvo">@${escapar(a.alvo.nome)}</span>` : "";
    this.filaCartoes.push({
      quem: a.quem,
      classe: `f${a.faixa}${a.faixa >= 3 ? " grande" : ""}${a.largada ? " largada" : ""}`,
      dur: a.faixa >= 3 ? 4.4 : a.faixa >= 2 ? 3.6 : 2.8,
      l1: this.config.modoSeguro ? `${arroba(a.quem)} · ${escapar(nomePresente)}${qtd}` : `${arroba(a.quem)} enviou ${escapar(nomePresente)}${qtd}`,
      l2: `<span class="seta">→</span>${icone(a.efeito)}${a.largada ? "NITRO NA LARGADA" : e.nome}${a.dobro && !a.largada ? ' <span class="dobro">2×</span>' : ""}${alvo}`,
      faixa: a.faixa,
      quando: this.tempo,
    });
  },

  atingido(a, racha) {
    const e = EFEITOS[a.efeito];
    const frases = {
      oleo: `${arroba(a.alvo)} rodou no óleo de ${arroba(a.por)}`,
      missil: `${arroba(a.por)} lançou <em class="cor-missil">MÍSSIL</em> em ${arroba(a.alvo)}`,
      bomba: `${arroba(a.alvo)} voou na <em class="cor-bomba">BOMBA</em> de ${arroba(a.por)}`,
    };
    this.feed(icone(a.efeito, e.cor), frases[a.efeito]);
    this.flutuar(a.alvo.id, a.efeito === "oleo" ? "RODOU!" : "BOOM!", `var(--${a.efeito})`);
    if (a.efeito === "missil") {
      this.anunciar("ataque", a.rei ? "Míssil no rei!" : `Míssil no ${a.posicao}º`, `${arroba(a.por)} acertou ${arroba(a.alvo)}`, 2);
    }
  },

  feed(ic, html) {
    const linha = el("div", "linha", `${ic}<span>${html}</span>`);
    this.el.feed.prepend(linha);
    this.feedLinhas.unshift({ el: linha, t: this.tempo });
    const max = this.formatoAtual === "horizontal" ? 6 : 3;
    while (this.feedLinhas.length > max) this.feedLinhas.pop().el.remove();
  },

  flutuar(id, texto, cor, escala = 1) {
    const f = el("div", "flutua");
    f.textContent = texto;
    f.style.color = cor;
    f.style.fontSize = `${Math.round(34 * escala)}px`;
    this.el.pista.appendChild(f);
    this.flutuantes.push({ el: f, id, t: this.tempo, dur: 1.4 });
  },

  /* Um anúncio por vez; prioridade maior passa na frente e derruba o atual. */
  anunciar(tipo, titulo, sub, prioridade = 1, dur = 2.4) {
    const item = { tipo, titulo, sub, prioridade, dur, quando: this.tempo };
    if (this.anuncio && prioridade > this.anuncio.prioridade) this.anuncio.fim = this.tempo;
    this.filaAnuncios.push(item);
    this.filaAnuncios.sort((a, b) => b.prioridade - a.prioridade || a.quando - b.quando);
  },

  mostrarPodio(a, racha) {
    const degrau = (p, n) => p
      ? `<div class="degrau d${n}"><span class="nome">${chip(p, n === 1)} @${escapar(p.nome)}</span>` +
        `<div class="bloco">${n}</div><span class="tempo">${p.tempo ? fmt.format(Math.round(p.tempo * 10) / 10) + " s" : fmt.format(Math.round(p.d)) + " m"}</span></div>`
      : `<div class="degrau d${n}"></div>`;
    const [p1, p2, p3] = a.podio;
    const seguro = this.config.modoSeguro;
    this.el.podio.innerHTML = `<div class="titulo">Pódio · rodada ${a.rodada}</div>` +
      `<div class="degraus">${degrau(p2, 2)}${degrau(p1, 1)}${degrau(p3, 3)}</div>` +
      (a.mvp
        ? `<div class="mvp"><span class="av"></span><div><div class="rot">${seguro ? "MVP DA RODADA" : "MVP DOS PRESENTES"}</div><div class="nome">@${escapar(a.mvp.nome)}</div></div><span class="moedas">${fmt.format(a.mvp.moedas)}${seguro ? " pts" : ""}</span></div>`
        : seguro ? "" : '<div class="mvp sem">Ninguém mandou presente nessa rodada. O MVP leva o pódio junto do vencedor.</div>');
    if (a.mvp) this.el.podio.querySelector(".av").replaceWith(criarAvatar(a.mvp));
    this.el.podio.hidden = false;
  },

  /* ───────────── quadro ───────────── */

  quadro(dt, racha, agora) {
    this.tempo += dt;
    const fase = racha.fase;
    const emPodio = fase === "podio";
    const naEspera = fase === "espera";
    this.el.placar.hidden = emPodio || naEspera;
    /* Na vertical, espera e pódio ocupam também a faixa do feed. */
    const cheio = (emPodio || naEspera) && this.formatoAtual !== "horizontal";
    this.el.feed.hidden = this.el.cardapio.hidden = cheio;
    this.el.espera.hidden = !naEspera;
    if (!emPodio) this.el.podio.hidden = true;

    this.lento = this.tempo >= this.proxLento;
    if (this.lento) this.proxLento = this.tempo + 0.2;

    this.topo(racha, agora);
    if (!this.el.placar.hidden) this.placar(dt, racha);
    if (naEspera && this.lento) this.espera(racha, agora);
    this.progresso(racha);
    this.contagem(racha, agora);
    this.surpresa(racha, agora);
    this.animarFeed();
    this.animarCartoes();
    this.animarAnuncios();
    this.animarFlutuantes();
  },

  topo(racha, agora) {
    if (!this.lento) return;
    const restante = Math.max(0, Math.ceil((racha.faseAte - agora) / 1000));
    let status;
    if (racha.fase === "espera") status = racha.totalCorrendo() < racha.config.minimoPilotos ? '<span class="pilula">Esperando pilotos</span>' : `<span class="pilula">Largada em ${restante}</span>`;
    else if (racha.fase === "largada") status = '<span class="pilula vivo">Largada</span>';
    else if (racha.fase === "podio") status = '<span class="pilula">Pódio</span>';
    else if (racha.retaFinal) status = `<span class="pilula dobro">Reta final${racha.multiplicador > 1 ? ` ${racha.multiplicador}×` : ""}</span>`;
    else status = '<span class="pilula vivo">Ao vivo</span>';
    const html = `<span class="pilula">Rodada ${racha.rodada}</span>${status}`;
    if (this.el.rodada.innerHTML !== html) this.el.rodada.innerHTML = html;
  },

  placar(dt, racha) {
    const vertical = this.formatoAtual !== "horizontal";
    const top = racha.ordem.slice(0, 10);
    const ids = new Set(top.map(p => p.id));
    const largura = this.grade.clientWidth || 1000;
    const alt = 58;
    top.forEach((p, i) => {
      let l = this.linhasPlacar.get(p.id);
      if (!l) {
        l = el("div", "linha", '<span class="pos"></span><span class="chipw"></span><span class="nome"></span><span class="metros"></span>');
        l._y = null;
        this.grade.appendChild(l);
        this.linhasPlacar.set(p.id, l);
      }
      const col = vertical && i >= 5 ? 1 : 0;
      const yAlvo = (vertical ? i % 5 : i) * alt;
      const w = vertical ? (largura - 10) / 2 : largura;
      l.style.width = `${w}px`;
      l._y = l._y == null ? yAlvo : l._y + (yAlvo - l._y) * (1 - Math.exp(-dt * 22));
      l.style.transform = `translate(${col * (w + 10)}px, ${l._y.toFixed(1)}px)`;
      const cls = `linha l${i + 1}`;
      if (l.className !== cls) l.className = cls;
      if (this.lento || l._novo !== false) {
        l._novo = false;
        const rei = racha.rei === p.id;
        const pos = `${i + 1}`;
        const metros = p.chegada != null ? "CHEGOU" : fmt.format(Math.max(0, Math.floor(p.d)));
        if (l.children[0].textContent !== pos) l.children[0].textContent = pos;
        const chipHtml = chip(p, rei);
        if (l._chip !== chipHtml) { l.children[1].innerHTML = chipHtml; l._chip = chipHtml; }
        const nome = i === 0 ? `${icone("coroa", "coroa-mini")}${escapar(p.nome)}` : escapar(p.nome);
        if (l._nome !== nome) { l.children[2].innerHTML = nome; l._nome = nome; }
        const mHtml = p.chegada != null ? `<small>${metros}</small>` : `${metros}<small>m</small>`;
        if (l._m !== mHtml) { l.children[3].innerHTML = mHtml; l._m = mHtml; }
      }
    });
    for (const [id, l] of this.linhasPlacar) if (!ids.has(id)) { l.remove(); this.linhasPlacar.delete(id); }
    if (this.lento) {
      const pilotos = this.el.placar.querySelector(".pilotos");
      const moedas = this.el.placar.querySelector(".moedas");
      const tp = `<b>${fmt.format(racha.ordem.length)}</b> pilotos · pista de <b>${fmt.format(racha.pista)} m</b>`;
      const tm = racha.config.modoSeguro ? "" : `${icone("moeda", "cor-ouro")} <b>${fmt.format(racha.moedasLive)}</b> moedas na live`;
      if (pilotos.innerHTML !== tp) pilotos.innerHTML = tp;
      if (moedas.innerHTML !== tm) moedas.innerHTML = tm;
    }
  },

  espera(racha, agora) {
    const faltam = Math.max(0, racha.config.minimoPilotos - racha.totalCorrendo());
    const n = faltam ? racha.totalCorrendo() : Math.max(0, Math.ceil((racha.faseAte - agora) / 1000));
    const titulo = faltam
      ? `Esperando pilotos<small>falta${faltam > 1 ? "m" : ""} ${faltam} pra largar</small>`
      : `Próxima largada<small>rodada ${racha.rodada} · ${fmt.format(racha.totalCorrendo())} na grade</small>`;
    const vitorias = racha.topVitorias(5);
    const doadores = racha.topDoadores(4);
    const lista = (itens, valor) => `<ol>${itens.map(p => `<li>${chip(p, racha.rei === p.id)}<span class="nome">@${escapar(p.nome)}</span><span class="v">${valor(p)}</span></li>`).join("")}</ol>`;
    let esquerda;
    if (vitorias.length) esquerda = `<h3>${icone("coroa", "cor-ouro")} Vitórias na live</h3>${lista(vitorias, p => p.vitorias)}`;
    else {
      const grade = racha.ordem.slice(-5).reverse();
      esquerda = `<h3>${icone("bandeira")} Chegaram na grade</h3>${grade.length ? lista(grade, p => "#" + p.numero) : '<div class="vazio">Ninguém ainda. Seja o primeiro.</div>'}`;
    }
    const comNumero = doadores.map(d => ({ ...d, numero: (racha.pilotos.get(d.id) || {}).numero || "–", cor: (racha.pilotos.get(d.id) || {}).cor || 0 }));
    const seguro = racha.config.modoSeguro;
    const direita = seguro
      ? `<h3>${icone("coroa", "cor-ouro")} Pontos da live</h3>` +
        (comNumero.length ? lista(comNumero, d => fmt.format(d.moedas)) : '<div class="vazio">Ninguém pontuou ainda.</div>')
      : `<h3>${icone("moeda", "cor-ouro")} Moedas da live</h3>` +
        (comNumero.length ? lista(comNumero, d => fmt.format(d.moedas)) : '<div class="vazio">O primeiro presente vira nitro na largada.</div>') +
        `<div class="total">Total na live: <b>${fmt.format(racha.moedasLive)}</b> moedas</div>`;
    const cta = seguro
      ? '<div class="cta">Comente qualquer coisa pra <b>entrar na corrida</b> · curtir empurra seu carro</div>'
      : '<div class="cta">Comente qualquer coisa pra <b>entrar na corrida</b> · presente agora vira <b>nitro na largada</b></div>';
    const html = `<div class="cab"><div class="t">${titulo}</div><div class="n">${n}</div></div>` + cta +
      `<div class="colunas"><div>${esquerda}</div><div>${direita}</div></div>`;
    if (this._espera !== html) { this.el.espera.innerHTML = html; this._espera = html; }
  },

  progresso(racha) {
    const pista = racha.pista;
    const lider = racha.ordem[0];
    this.feito.style.width = `${lider ? Math.min(100, Math.max(0, lider.d / pista * 100)) : 0}%`;
    const visiveis = new Set(Cena.vis.keys());
    const vivos = new Set();
    for (const p of racha.ordem) {
      if (!visiveis.has(p.id)) continue;
      vivos.add(p.id);
      let ic = this.iconesBarra.get(p.id);
      const rei = racha.rei === p.id;
      const cor = corDoCarro(p, rei);
      if (!ic) {
        ic = el("div", "carro");
        this.carrosBarra.appendChild(ic);
        this.iconesBarra.set(p.id, ic);
      }
      if (ic._cor !== cor || ic._n !== p.numero) {
        ic.innerHTML = carrinho(cor) + `<b style="color:${textoSobre(cor)}">${p.numero}</b>`;
        ic._cor = cor;
        ic._n = p.numero;
      }
      const pos = racha.posicao(p);
      const cls = pos === 1 ? "carro lider" : "carro";
      if (ic.className !== cls) ic.className = cls;
      ic.style.left = `${Math.min(100, Math.max(0, p.d / pista * 100)).toFixed(2)}%`;
      ic.style.zIndex = String(1000 - pos);
    }
    for (const [id, ic] of this.iconesBarra) if (!vivos.has(id)) { ic.remove(); this.iconesBarra.delete(id); }

    if (this.lento) {
      const fora = racha.ordem.filter(p => !visiveis.has(p.id));
      const pontos = this.pontosBarra;
      while (pontos.children.length < fora.length) pontos.appendChild(el("i"));
      while (pontos.children.length > fora.length) pontos.lastChild.remove();
      fora.forEach((p, i) => { pontos.children[i].style.left = `${Math.min(100, Math.max(0, p.d / pista * 100)).toFixed(2)}%`; });
    }
  },

  contagem(racha, agora) {
    const c = this.el.contagem;
    if (racha.fase === "largada") {
      const resto = (racha.faseAte - agora) / 1000;
      const n = Math.ceil(resto);
      if (n > 3) { c.hidden = true; return; }
      const frac = n - resto;
      c.hidden = false;
      c.className = "contagem";
      c.textContent = String(n);
      c.style.transform = `scale(${(1.5 - Math.min(1, frac * 3) * 0.5).toFixed(3)})`;
      c.style.opacity = String(Math.min(1, (1 - frac) * 4));
    } else if (this.contagemFim && this.tempo < this.contagemFim) {
      const t = 1 - (this.contagemFim - this.tempo) / 0.9;
      c.hidden = false;
      c.className = "contagem vai";
      c.textContent = "VAI!";
      c.style.transform = `scale(${(0.8 + t * 0.6).toFixed(3)})`;
      c.style.opacity = String(Math.min(1, (1 - t) * 3));
    } else c.hidden = true;
  },

  surpresa(racha, agora) {
    const ev = racha.evento;
    const s = this.el.surpresa;
    if (!ev) { s.hidden = true; return; }
    s.hidden = false;
    const resto = Math.max(0, (ev.ate - agora) / 1000);
    const [titulo, sub] = NOMES_SURPRESA[ev.tipo];
    if (s._tipo !== ev.tipo) {
      s.innerHTML = `${icone(ev.tipo === "chuva" ? "chuva" : ev.tipo === "missil" ? "missil" : "nitro")}<span>${titulo}</span><span class="s">${sub}</span><div class="barra"><i></i></div><span class="r"></span>`;
      s._tipo = ev.tipo;
    }
    s.querySelector(".barra i").style.width = `${(resto / ev.segundos * 100).toFixed(1)}%`;
    s.querySelector(".r").textContent = `${Math.ceil(resto)} s`;
  },

  animarFeed() {
    for (let i = this.feedLinhas.length - 1; i >= 0; i--) {
      const f = this.feedLinhas[i];
      const idade = this.tempo - f.t;
      const entrada = Math.min(1, idade / 0.25);
      const saida = idade > 9 ? Math.max(0, 1 - (idade - 9) / 0.6) : 1;
      f.el.style.opacity = String(entrada * saida * (1 - i * 0.12));
      f.el.style.transform = `translateX(${((1 - entrada) * -40).toFixed(1)}px)`;
      if (saida <= 0) { f.el.remove(); this.feedLinhas.splice(i, 1); }
    }
  },

  animarCartoes() {
    const max = this.formatoAtual === "horizontal" ? 3 : 2;
    this.filaCartoes = this.filaCartoes.filter(c => this.tempo - c.quando < 6 || c.faixa >= 3);
    while (this.cartoesAtivos.length < max && this.filaCartoes.length) {
      this.filaCartoes.sort((a, b) => b.faixa - a.faixa || a.quando - b.quando);
      const c = this.filaCartoes.shift();
      const e = el("div", `cartao ${c.classe}`, `<span class="av"></span><div class="txt"><div class="l1">${c.l1}</div><div class="l2">${c.l2}</div></div>`);
      e.querySelector(".av").replaceWith(criarAvatar(c.quem));
      this.el.cartoes.appendChild(e);
      this.cartoesAtivos.push({ ...c, el: e, t: this.tempo });
    }
    this.cartoesAtivos = this.cartoesAtivos.filter(c => {
      const idade = this.tempo - c.t;
      const ent = Math.min(1, idade / 0.22);
      const sai = Math.max(0, Math.min(1, (c.dur - idade) / 0.3));
      const pop = ent < 1 ? 0.85 + 0.25 * Math.sin(ent * Math.PI * 0.75) : 1;
      c.el.style.opacity = String(Math.min(ent, sai));
      c.el.style.transform = `translateY(${((1 - ent) * -30 - (1 - sai) * 20).toFixed(1)}px) scale(${pop.toFixed(3)})`;
      if (idade >= c.dur) { c.el.remove(); return false; }
      return true;
    });
  },

  animarAnuncios() {
    if (this.anuncio && this.tempo >= this.anuncio.fim) {
      this.anuncio.el.remove();
      this.anuncio = null;
    }
    if (!this.anuncio) {
      this.filaAnuncios = this.filaAnuncios.filter(a => this.tempo - a.quando < 4 || a.prioridade >= 3);
      const a = this.filaAnuncios.shift();
      if (a) {
        a.el = el("div", `anuncio ${a.tipo}`, `<div class="t">${a.titulo}</div><div class="s">${a.sub}</div>`);
        this.el.anuncios.appendChild(a.el);
        a.inicio = this.tempo;
        a.fim = this.tempo + a.dur;
        this.anuncio = a;
      }
    }
    const a = this.anuncio;
    if (!a) return;
    const idade = this.tempo - a.inicio;
    const ent = Math.min(1, idade / 0.2);
    const sai = Math.max(0, Math.min(1, (a.fim - this.tempo) / 0.25));
    a.el.style.opacity = String(Math.min(ent, sai));
    a.el.style.transform = `skewX(-8deg) translateX(${((1 - ent) * 120 - (1 - sai) * 120).toFixed(1)}px) scale(${(0.9 + ent * 0.1).toFixed(3)})`;
  },

  animarFlutuantes() {
    this.flutuantes = this.flutuantes.filter(f => {
      const idade = this.tempo - f.t;
      if (idade >= f.dur) { f.el.remove(); return false; }
      const pos = Cena.telaDoCarro(f.id);
      if (pos) f.ultimo = pos;
      const p = f.ultimo;
      if (!p) { f.el.style.opacity = "0"; return true; }
      const t = idade / f.dur;
      f.el.style.opacity = String(Math.min(1, idade / 0.12) * (1 - Math.max(0, t - 0.6) / 0.4));
      f.el.style.transform = `translate(${p.x.toFixed(1)}px, ${(p.y - 44 - t * 90).toFixed(1)}px) scale(${(1 + Math.max(0, 0.25 - idade) * 2).toFixed(3)})`;
      return true;
    });
  },

  sinal(estado) {
    const s = this.$(".sem-sinal");
    if (estado === "desconectado" || estado === "conectando") {
      s.hidden = false;
      s.textContent = "Procurando o conector da live… (tecla D liga a demonstração)";
    } else s.hidden = true;
  },

  aviso(texto) {
    const a = el("div", "aviso");
    a.textContent = texto;
    this.el.avisos.appendChild(a);
    setTimeout(() => a.remove(), 2600);
  },

  zerar() {
    for (const m of [this.linhasPlacar, this.iconesBarra]) { m.forEach(x => x.remove()); m.clear(); }
    this.feedLinhas.forEach(f => f.el.remove());
    this.feedLinhas = [];
  },
};
