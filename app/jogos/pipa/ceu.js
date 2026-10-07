/* O céu inteiro num canvas: cenário, pipas, linhas, relos, cortes e
   partículas. Não decide nada: segue o estado do Combate (regras.js) e
   anima os acontecimentos que o jogo repassa. */
"use strict";

const FORMATOS = {
  vertical: {
    W: 1080, H: 1920, horizonte: 1590,
    ceu: { x0: 90, x1: 990, y0: 430, y1: 1270 },
    /* Áreas do HUD onde não vale pôr pipa parada (x0, y0, x1, y1). O jogo
       troca por `areas` com o tamanho real dos painéis assim que monta. */
    evitar: [[0, 330, 500, 760], [730, 330, 1080, 740], [700, 1150, 1080, 1600]],
    /* Chat do TikTok no celular: pipa pode passar, mas não mora lá. */
    chat: [0, 1150, 720, 1920],
    tamanho: 76,
  },
  horizontal: {
    W: 1920, H: 1080, horizonte: 900,
    ceu: { x0: 470, x1: 1450, y0: 270, y1: 700 },
    evitar: [[0, 120, 440, 760], [1480, 120, 1920, 1000]],
    chat: null,
    tamanho: 66,
  },
};

const SEDA = ["#E63946", "#F4A300", "#1FA58F", "#1D6FD6", "#8E44AD", "#F0609A", "#27AE60",
  "#FF6B1A", "#00B3D6", "#FFD23F", "#C2185B", "#3F51B5", "#7CB342", "#FF8A65"];
const ESTAMPAS = ["meio", "xadrez", "estrela", "olho", "fogo"];
/* Cor da linha pela faixa da pipa: -1 (sem presente), 0..3, e o fogo. */
const COR_LINHA = { fundo: "rgba(255,244,228,.5)", nada: "rgba(255,244,228,.8)", 0: "rgba(255,244,228,.9)",
  1: "#DCE8F5", 2: "#FFD86A", 3: "#FFD86A", fogo: "#FF9A3A", dourado: "#FFD54A" };

const RABIOLA = { gravidade: 300, arrasto: 0.45, amortece: 0.95, iteracoes: 6, tremor: 420 };

function hashTexto(s) {
  let h = 0;
  for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

function coresDe(id) {
  const h = hashTexto(id);
  const a = SEDA[h % SEDA.length];
  let b = SEDA[(h >> 4) % SEDA.length];
  if (b === a) b = SEDA[(h % SEDA.length + 5) % SEDA.length];
  return [a, b];
}

const Fotos = {
  cache: new Map(),
  de(url) {
    if (!url) return null;
    let f = this.cache.get(url);
    if (!f) {
      f = new Image();
      f.referrerPolicy = "no-referrer";
      f.src = url;
      this.cache.set(url, f);
    }
    return f.complete && f.naturalWidth ? f : null;
  },
};

/* Corta por caractere de verdade: emoji é par de UTF-16 e `slice` partia
   no meio, desenhando um quadradinho. */
function encurtar(texto, max) {
  const letras = Array.from(String(texto));
  return letras.length > max ? letras.slice(0, max - 1).join("") + "…" : letras.join("");
}

function suave(atual, alvo, dt, rapidez) {
  return atual + (alvo - atual) * Math.min(1, dt * rapidez);
}

/* ───────── a pipa na tela ───────── */

class PipaNoCeu {
  constructor(id, jogador, laje, casa, agora) {
    this.id = id;
    this.jogador = jogador;
    this.cores = coresDe(id);
    this.laje = laje;
    this.casa = casa;
    this.fase = (hashTexto(id) % 1000) / 1000 * Math.PI * 2;
    this.corpo = new Corpo(laje.x, laje.y - 10);
    this.corda = new Corda(18, laje.x, laje.y, laje.x, laje.y - 10);
    this.corda.comprimento = 12;
    this.raioFinal = Math.hypot(casa.x - laje.x, casa.y - laje.y) * 1.05;
    this.rabiola = new Corda(11, laje.x, laje.y, laje.x, laje.y + 40);
    this.rabiola.presoFim = false;
    this.escala = 0.5;
    this.alfa = 0;
    this.estado = "subindo";
    this.desde = agora;
    this.puxada = 0;
    this.flash = 0;
    this.giro3d = 0;
  }
}

class Avoada {
  constructor(p, cima, giro) {
    this.cores = p.cores;
    this.estampa = p.estampa;
    this.escala = p.escala;
    this.corpo = p.corpo;
    this.corpo.giro = giro;
    this.corda = cima;
    this.rabiola = p.rabiola;
    this.vida = 0;
    this.alfa = 1;
    this.nome = p.jogador.nome;
    this.dourada = p.dourada;
  }
}

const Ceu = {
  formato: "vertical",
  pipas: new Map(),
  avoadas: [],
  pedacos: [],
  particulas: [],
  textos: [],
  visDuelo: new Map(),
  tremor: 0,
  tingir: { cor: "#000", alfa: 0, alvo: 0 },
  tempo: 0,
  areas: null,
  MAX_PARTICULAS: 700,
  MAX_AVOADAS: 16,

  montar(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
  },

  aplicarFormato(formato) {
    this.formato = formato;
    const f = FORMATOS[formato];
    this.dims = f;
    this.canvas.width = f.W;
    this.canvas.height = f.H;
    this.cena = Cenario.montar(f.W, f.H, f.horizonte);
    /* Pipas que já estavam no ar trocam de laje e de lugar no céu. */
    for (const p of this.pipas.values()) {
      p.laje = this.escolherLaje(p.casa = this.escolherCasa(p.id));
      p.raioFinal = Math.hypot(p.casa.x - p.laje.x, p.casa.y - p.laje.y) * 1.05;
      p.corpo.x = p.casa.x;
      p.corpo.y = p.casa.y;
      p.corda = new Corda(18, p.laje.x, p.laje.y, p.corpo.x, p.corpo.y);
      p.corda.comprimento = p.raioFinal;
    }
    this.avoadas = [];
    this.pedacos = [];
    this.areas = null;
  },

  /* Quanto vale morar em (x, y): 1 no céu livre, quase nada atrás do HUD
     (o nome fica em cima e a rabiola embaixo, daí a folga desigual). */
  bloqueio(x, y) {
    const areas = this.areas || this.dims.evitar;
    if (areas.some(([a, b, c, d]) => x > a - 40 && x < c + 40 && y > b - 100 && y < d + 110)) return 0.05;
    const chat = this.dims.chat;
    if (chat && x > chat[0] && x < chat[2] && y > chat[1] - 60) return 0.3;
    return 1;
  },

  /* Lugar no céu longe das outras pipas e fora do HUD. */
  escolherCasa(id) {
    const { ceu } = this.dims;
    let melhor = null;
    for (let k = 0; k < 32; k++) {
      const x = ceu.x0 + Math.random() * (ceu.x1 - ceu.x0);
      const y = ceu.y0 + Math.random() * (ceu.y1 - ceu.y0);
      const bloqueio = this.bloqueio(x, y);
      let perto = Infinity;
      for (const p of this.pipas.values()) {
        if (p.id === id || p.estado === "recolhendo") continue;
        const casa = p.casaNova || p.casa;
        perto = Math.min(perto, Math.hypot(casa.x - x, casa.y - y));
      }
      const nota = Math.min(perto, 400) * bloqueio;
      if (!melhor || nota > melhor.nota) melhor = { x, y, nota };
    }
    return { x: melhor.x, y: melhor.y };
  },

  /* O vento sopra pra direita: quem solta fica à esquerda e abaixo da pipa. */
  escolherLaje(casa) {
    const alvo = casa.x - (this.dims.horizonte - casa.y) * 0.32;
    const lajes = [...this.cena.lajes].sort((a, b) => Math.abs(a.x - alvo) - Math.abs(b.x - alvo));
    return lajes[Math.floor(Math.random() * Math.min(3, lajes.length))];
  },

  distancia(a, b) {
    const pa = this.pipas.get(a);
    const pb = this.pipas.get(b);
    if (!pa || !pb) return 9999;
    return Math.hypot(pa.corpo.x - pb.corpo.x, pa.corpo.y - pb.corpo.y);
  },

  /* ───────── acontecimentos ───────── */

  entrar(id, jogador, agora) {
    const antiga = this.pipas.get(id);
    if (antiga) {
      /* Estava sendo recolhida (céu lotado) e voltou: solta de novo. */
      if (antiga.estado === "recolhendo") {
        antiga.estado = "subindo";
        antiga.alfa = Math.max(antiga.alfa, 0.4);
      }
      return;
    }
    const casa = this.escolherCasa(id);
    const p = new PipaNoCeu(id, jogador, this.escolherLaje(casa), casa, agora);
    this.pipas.set(id, p);
  },

  gas(id) {
    const p = this.pipas.get(id);
    if (!p) return;
    p.puxada = 1;
    p.corpo.vy -= 240;
    p.corpo.vx += (Math.random() - 0.5) * 80;
  },

  recolher(id) {
    const p = this.pipas.get(id);
    if (p) { p.estado = "recolhendo"; p.desde = this.tempo; }
  },

  /* Ventania: a linha arrebenta perto da mão e a pipa vai embora. */
  levar(id) {
    const p = this.pipas.get(id);
    if (!p) return;
    this.pipas.delete(id);
    const [baixo, cima] = p.corda.partir(2);
    this.pedacos.push({ corda: baixo, vida: 0 });
    p.corpo.vx += 260 + Math.random() * 200;
    p.corpo.vy -= 120;
    this.soltarAvoada(p, cima, (Math.random() < 0.5 ? -1 : 1) * 2.5);
  },

  soltarAvoada(p, cima, giro) {
    this.avoadas.push(new Avoada(p, cima, giro));
    while (this.avoadas.length > this.MAX_AVOADAS) this.avoadas.shift();
  },

  cortar(autorId, vitimaId, { grande = false, fogo = false } = {}) {
    const v = this.pipas.get(vitimaId);
    const a = this.pipas.get(autorId);
    if (!v) return null;
    this.pipas.delete(vitimaId);
    let ponto;
    if (a) {
      const c = cruzamento(a.corda, v.corda, 0.5);
      ponto = c.d < 70 ? c : { j: Math.floor(v.corda.n * 0.75) };
      if (ponto.d === undefined || ponto.d >= 70) {
        ponto.x = v.corda.x[ponto.j];
        ponto.y = v.corda.y[ponto.j];
      }
    } else {
      ponto = { j: Math.floor(v.corda.n * 0.6) };
      ponto.x = v.corda.x[ponto.j];
      ponto.y = v.corda.y[ponto.j];
    }
    const [baixo, cima] = v.corda.partir(ponto.j);
    this.pedacos.push({ corda: baixo, vida: 0 });
    v.corpo.vx += 120 + Math.random() * 120;
    v.corpo.vy += 40;
    this.soltarAvoada(v, cima, (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 2));

    const cores = [v.cores[0], v.cores[1], "#FFFFFF"];
    this.explodir(ponto.x, ponto.y, cores, grande ? 70 : 34, grande ? 11 : 7, "papel");
    this.explodir(ponto.x, ponto.y, fogo ? ["#FFD04A", "#FF7A1A", "#FF3B1A"] : ["#FFF6D0", "#FFE08A"], 26, 9, "faisca");
    this.gritar(autorId, ponto.x, ponto.y - 40, grande ? 1.25 : 0.85, fogo ? "#FFB347" : "#FFFFFF");
    if (a) a.flash = 1;
    if (grande) this.tremor = Math.max(this.tremor, 14);
    return ponto;
  },

  bloquear(autorId, vitimaId) {
    const v = this.pipas.get(vitimaId);
    if (!v) return;
    v.flash = 1;
    this.explodir(v.corpo.x, v.corpo.y, ["#BFF3FF", "#FFFFFF"], 30, 8, "faisca");
    this.texto("SEGUROU!", v.corpo.x, v.corpo.y - 70 * v.escala, 0.7, "#BFF3FF");
  },

  /* Pipa avoada do evento: dourada, sem dono, atravessa o céu devagar
     arrastando um pedaço de linha. */
  soltarDourada(segundos) {
    const { ceu } = this.dims;
    const y = ceu.y0 + (ceu.y1 - ceu.y0) * 0.5;
    const corpo = new Corpo(-90, y);
    const corda = new Corda(14, -400, y + 200, -90, y);
    corda.presoInicio = false;
    const rabiola = new Corda(13, -90, y, -90, y + 100);
    rabiola.presoFim = false;
    this.dourada = { corpo, corda, rabiola, inicio: this.tempo, dur: segundos, alfa: 1 };
  },

  pegarDourada(id) {
    const d = this.dourada;
    if (!d) return;
    this.explodir(d.corpo.x, d.corpo.y, ["#FFE27A", "#FFFFFF", "#F2B51F"], 90, 12, "faisca");
    this.texto("APAROU!", d.corpo.x, d.corpo.y - 90, 1.1, "#FFE27A");
    const p = this.pipas.get(id);
    if (p) p.flash = 1;
    this.dourada = null;
  },

  largarDourada() { this.dourada = null; },

  /* "Ê, cortou!" no ponto do corte. Corte em sequência do mesmo autor
     vira um grito só com a conta, em vez de empilhar texto. */
  gritar(autorId, x, y, tam, cor) {
    const ultimo = this.textos.find(tx => tx.autor === autorId && tx.vida < 1.2);
    if (ultimo) {
      ultimo.n++;
      Object.assign(ultimo, { texto: `Ê, CORTOU! ×${ultimo.n}`, x, y, vida: 0.12, tam: Math.max(ultimo.tam, tam) });
      return;
    }
    this.texto("Ê, CORTOU!", x, y, tam, cor);
    Object.assign(this.textos[this.textos.length - 1], { autor: autorId, n: 1 });
  },

  texto(texto, x, y, tam, cor) {
    this.textos.push({ texto, x, y, tam, cor, vida: 0, max: 1.6, rot: (Math.random() - 0.5) * 0.18 });
    if (this.textos.length > 12) this.textos.shift();
  },

  explodir(x, y, cores, n, forca, tipo = "faisca") {
    for (let i = 0; i < n; i++) {
      if (this.particulas.length >= this.MAX_PARTICULAS) this.particulas.shift();
      const ang = Math.random() * Math.PI * 2;
      const v = (0.3 + Math.random()) * forca * 40;
      this.particulas.push({
        x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v - (tipo === "papel" ? 60 : 0),
        vida: 0, max: tipo === "papel" ? 2.4 + Math.random() : 0.5 + Math.random() * 0.5,
        cor: cores[i % cores.length], tam: tipo === "papel" ? 6 + Math.random() * 8 : 2 + Math.random() * 3,
        tipo, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12,
      });
    }
  },

  /* ───────── quadro ───────── */

  quadro(dt, combate, agora, info) {
    this.tempo += dt;
    const t = this.tempo;
    this.atualizarPipas(dt, t, combate, agora, info);
    this.atualizarSoltos(dt, t);
    this.desenhar(dt, t, combate, agora, info);
  },

  atualizarPipas(dt, t, combate, agora, info) {
    const { ceu } = this.dims;
    const alvos = this.alvosDosDuelos(combate, agora, t);
    /* Céu cheio de gigante vira borrão: só as duas mais recentes ficam
       no tamanho cheio. */
    const gigantes = [...combate.pipas.values()].filter(e => e.giganteAte > agora)
      .sort((a, b) => b.giganteAte - a.giganteAte).slice(0, 2).map(e => e.id);
    for (const p of this.pipas.values()) {
      const estado = combate.pipas.get(p.id);
      if (estado) {
        p.faixa = estado.faixa;
        p.dourada = estado.dourada;
        p.estampa = estado.dourada ? "dourada" : estado.faixa >= 0 ? ESTAMPAS[estado.faixa] : "lisa";
        p.gigante = estado.giganteAte > agora;
        p.fogo = estado.fogoAte > agora;
        p.escudo = estado.escudoAte > agora ? (estado.escudoAte - agora) / 1000 : 0;
        p.gas = estado.gas;
      }
      p.destaque = p.faixa >= 0 || p.dourada || p.id === info.rei || alvos.has(p.id) || info.top.has(p.id) || p.puxada > 0.05;
      const escalaAlvo = p.gigante ? (gigantes.includes(p.id) ? 1.85 : 1.3) : p.destaque ? 1 : 0.78;
      p.escala = suave(p.escala, escalaAlvo, dt, 3);

      this.passear(p, t, dt, alvos.has(p.id));
      let ax = p.casa.x + Math.sin(t * 0.31 + p.fase) * 46 + Math.sin(t * 0.83 + p.fase * 2) * 14;
      let ay = p.casa.y + Math.sin(t * 0.47 + p.fase * 1.3) * 30;
      const duelo = alvos.get(p.id);
      if (duelo) { ax = duelo.x; ay = duelo.y; }
      ax = Math.max(ceu.x0 - 60, Math.min(ceu.x1 + 60, ax));
      /* Pipa grande não sobe por cima do topo do HUD. */
      ay = Math.max(ceu.y0 - 40 + this.dims.tamanho * (p.escala - 0.8) * 1.4, ay);

      if (p.estado === "subindo") {
        p.alfa = Math.min(1, p.alfa + dt * 2.5);
        p.corda.comprimento = Math.min(p.raioFinal, p.corda.comprimento + dt * 520);
        if (p.corda.comprimento >= p.raioFinal) p.estado = "voando";
      } else if (p.estado === "recolhendo") {
        p.corda.comprimento = Math.max(8, p.corda.comprimento - dt * 640);
        ax = p.laje.x;
        ay = p.laje.y;
        if (p.corda.comprimento <= 10) p.alfa -= dt * 4;
      } else {
        /* Quem solta vai dando e recolhendo linha pra ela ficar quase
           esticada: só um pouco de barriga, sem laçada. */
        const d = Math.hypot(p.corpo.x - p.laje.x, p.corpo.y - p.laje.y);
        p.corda.comprimento = suave(p.corda.comprimento, d * 1.035 + 6, dt, duelo ? 6 : 2.5);
      }

      const rapido = duelo ? duelo.rapidez : 1;
      p.corpo.passo(dt, t, ax, ay, { mola: 3.2 * rapido, freio: 2.4 * Math.sqrt(rapido), vento: 0.7 * Vento.forca });
      if (p.estado !== "voando") p.corpo.segurar(p.laje.x, p.laje.y, p.corda.comprimento);

      p.corda.prender(0, p.laje.x, p.laje.y);
      p.corda.prender(p.corda.n - 1, p.corpo.x, p.corpo.y);
      p.corda.passo(dt, t, { gravidade: 160, arrasto: 0.3 });

      const n = p.corda.n;
      const dx = p.corpo.x - p.corda.x[n - 4];
      const dy = p.corda.y[n - 4] - p.corpo.y;
      const inclina = Math.atan2(dx, Math.max(20, dy));
      const balanco = Math.sin(t * 1.7 + p.fase) * 0.1 + Math.sin(t * 6.3 + p.fase * 3) * 0.03 * Vento.forca;
      const rotAlvo = inclina * 0.5 + p.corpo.vx * 0.0012 + balanco + (duelo ? Math.sin(t * 9 + p.fase) * 0.35 : 0)
        + p.puxada * 0.5 * Math.sin(t * 20);
      p.corpo.rot = suave(p.corpo.rot, rotAlvo, dt, 7);
      p.giro3d = Math.sin(t * 1.1 + p.fase * 2) * 0.12 + (duelo ? Math.sin(t * 7) * 0.12 : 0);
      p.puxada = Math.max(0, p.puxada - dt * 1.4);
      p.flash = Math.max(0, p.flash - dt * 2.5);

      this.prenderRabiola(p);
      p.rabiola.passo(dt, t, RABIOLA);

      if (p.fogo && Math.random() < 0.9) {
        const r = p.rabiola;
        const i = 1 + Math.floor(Math.random() * (r.n - 1));
        if (this.particulas.length < this.MAX_PARTICULAS) {
          this.particulas.push({ x: r.x[i], y: r.y[i], vx: (Math.random() - 0.5) * 40, vy: -40 - Math.random() * 60,
            vida: 0, max: 0.45 + Math.random() * 0.3, cor: Math.random() < 0.5 ? "#FFB43A" : "#FF5A1F",
            tam: 6 + Math.random() * 8 * p.escala, tipo: "fogo", rot: 0, vr: 0 });
        }
      }
    }
    for (const [id, p] of this.pipas) if (p.alfa <= 0 && p.estado === "recolhendo") this.pipas.delete(id);
  },

  /* De tempos em tempos a pipa muda de lugar no céu, devagar: espalha de
     novo quem ficou junto depois que o céu esvaziou e tira de trás de
     painel que cresceu. */
  passear(p, t, dt, emRelo) {
    if (p.estado !== "voando") return;
    if (p.trocaEm === undefined) p.trocaEm = t + 8 + Math.random() * 20;
    let tapada = false;
    if (!p.casaNova && !(t < p.conferirEm)) {
      p.conferirEm = t + 2;
      tapada = this.bloqueio(p.casa.x, p.casa.y) < 0.1;
    }
    if ((t >= p.trocaEm || tapada) && !emRelo) {
      p.trocaEm = t + 25 + Math.random() * 25;
      p.casaNova = this.escolherCasa(p.id);
    }
    const nova = p.casaNova;
    if (!nova) return;
    const dx = nova.x - p.casa.x;
    const dy = nova.y - p.casa.y;
    const d = Math.hypot(dx, dy);
    const passo = 45 * dt;
    if (d <= passo) { p.casa = nova; p.casaNova = null; return; }
    p.casa = { x: p.casa.x + dx / d * passo, y: p.casa.y + dy / d * passo };
  },

  prenderRabiola(p) {
    const s = this.dims.tamanho * p.escala;
    const comp = (p.faixa >= 2 || p.dourada ? 2.6 : 1.7) * s;
    p.rabiola.comprimento = comp;
    const bx = p.corpo.x - Math.sin(p.corpo.rot) * s * 0.5;
    const by = p.corpo.y + Math.cos(p.corpo.rot) * s * 0.5;
    p.rabiola.prender(0, bx, by);
  },

  /* Pra onde cada pipa em relo vai. As duas trocam de lado em relação à
     laje (é isso que cruza as linhas) e serram pra cima e pra baixo. */
  alvosDosDuelos(combate, agora, t) {
    const alvos = new Map();
    const vivos = new Set();
    for (const d of combate.duelos) {
      const a = this.pipas.get(d.a);
      const b = this.pipas.get(d.b);
      if (!a || !b) continue;
      vivos.add(d.id);
      let vis = this.visDuelo.get(d.id);
      if (!vis) {
        const ataque = d.tipo === "ataque";
        const mx = ataque ? b.corpo.x * 0.75 + a.corpo.x * 0.25 : (a.corpo.x + b.corpo.x) / 2;
        const my = ataque ? b.corpo.y * 0.75 + a.corpo.y * 0.25 : (a.corpo.y + b.corpo.y) / 2;
        vis = { mx, my, aEsquerda: a.laje.x < b.laje.x || (a.laje.x === b.laje.x && a.corpo.x < b.corpo.x) };
        this.visDuelo.set(d.id, vis);
      }
      const p = Math.min(1, (agora - d.inicio) / (d.fim - d.inicio));
      const abre = 90 * (1 - p) * (1 - p) + 8;
      const serra = p > 0.35 ? Math.sin(t * (d.fogo ? 26 : 15)) * 22 : 0;
      const lado = vis.aEsquerda ? 1 : -1;
      const rapidez = d.fogo ? 5 : d.tipo === "ataque" ? 2.4 : 1.6;
      alvos.set(d.a, { x: vis.mx + lado * abre, y: vis.my - 20 + serra, rapidez });
      alvos.set(d.b, { x: vis.mx - lado * abre, y: vis.my + 10 - serra, rapidez: d.tipo === "ataque" ? 1.2 : rapidez });

      if (p > 0.3) {
        const c = cruzamento(a.corda, b.corda, 0.5);
        if (c.d < 50 && Math.random() < 0.6) {
          const cor = d.fogo ? ["#FFB43A", "#FF5A1F"] : a.faixa >= 1 || b.faixa >= 1 ? ["#FFFFFF", "#CFE8FF"] : ["#FFF3C8", "#FFD27A"];
          this.explodir(c.x, c.y, cor, 2, 4, "faisca");
        }
        vis.ponto = c;
      }
      vis.d = d;
    }
    for (const id of this.visDuelo.keys()) if (!vivos.has(id)) this.visDuelo.delete(id);
    return alvos;
  },

  atualizarSoltos(dt, t) {
    for (const v of this.avoadas) {
      v.vida += dt;
      const c = v.corpo;
      const w = Vento.em(c.x, c.y, t);
      c.vx += (w.x * 1.4 - c.vx * 0.6) * dt;
      c.vy += (55 - c.vy * 0.5) * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.rot += c.giro * dt;
      c.giro *= 1 - dt * 0.3;
      v.corda.prender(v.corda.n - 1, c.x, c.y);
      v.corda.passo(dt, t, { gravidade: 120, arrasto: 0.6 });
      const s = this.dims.tamanho * v.escala;
      v.rabiola.prender(0, c.x - Math.sin(c.rot) * s * 0.5, c.y + Math.cos(c.rot) * s * 0.5);
      v.rabiola.passo(dt, t, RABIOLA);
      if (v.vida > 4) v.alfa -= dt * 0.8;
    }
    this.avoadas = this.avoadas.filter(v => v.alfa > 0 && v.corpo.x < this.dims.W + 300);

    const ouro = this.dourada;
    if (ouro) {
      const { W, ceu } = this.dims;
      const k = Math.min(1, (t - ouro.inicio) / ouro.dur);
      const c = ouro.corpo;
      /* Desce pela faixa do meio, abaixo do feed e do cardápio. */
      const y0 = ceu.y0 + (ceu.y1 - ceu.y0) * 0.5;
      c.passo(dt, t, -90 + (W + 180) * k, y0 + (ceu.y1 - y0) * k + Math.sin(t * 0.9) * 40, { mola: 2, freio: 2 });
      c.rot = Math.sin(t * 1.3) * 0.45;
      ouro.corda.prender(ouro.corda.n - 1, c.x, c.y);
      ouro.corda.passo(dt, t, { gravidade: 140, arrasto: 0.5 });
      const s = this.dims.tamanho * 1.5;
      ouro.rabiola.comprimento = s * 3;
      ouro.rabiola.prender(0, c.x - Math.sin(c.rot) * s * 0.5, c.y + Math.cos(c.rot) * s * 0.5);
      ouro.rabiola.passo(dt, t, RABIOLA);
      if (Math.random() < 0.5) this.explodir(c.x, c.y, ["#FFE27A", "#FFFFFF"], 1, 2, "faisca");
    }

    for (const pd of this.pedacos) {
      pd.vida += dt;
      pd.corda.passo(dt, t, { gravidade: 420, arrasto: 0.15, amortece: 0.97 });
    }
    this.pedacos = this.pedacos.filter(pd => pd.vida < 2.6);

    for (const q of this.particulas) {
      q.vida += dt;
      if (q.tipo === "papel") {
        q.vx += (Vento.em(q.x, q.y, t).x * 0.8 - q.vx) * dt * 1.2;
        q.vy += (70 - q.vy) * dt * 1.5;
      } else if (q.tipo === "fogo") {
        q.vy -= 30 * dt;
      } else {
        q.vy += 380 * dt;
        q.vx *= 1 - dt * 1.5;
      }
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.rot += q.vr * dt;
    }
    this.particulas = this.particulas.filter(q => q.vida < q.max);
    for (const tx of this.textos) tx.vida += dt;
    this.textos = this.textos.filter(tx => tx.vida < tx.max);
    this.tremor = Math.max(0, this.tremor - dt * 30);
  },

  /* ───────── desenho ───────── */

  desenhar(dt, t, combate, agora, info) {
    const c = this.ctx;
    const { W, H } = this.dims;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(this.cena.fundo, 0, 0);

    const rolar = (t * 6) % W;
    c.globalAlpha = 0.9;
    c.drawImage(this.cena.nuvens, -rolar, 0);
    c.globalAlpha = 1;

    const tg = this.tingir;
    tg.alfa = suave(tg.alfa, tg.alvo, dt, 1.5);
    if (tg.alfa > 0.01) {
      c.globalAlpha = tg.alfa;
      c.fillStyle = tg.cor;
      c.fillRect(0, 0, W, H);
      c.globalAlpha = 1;
    }

    if (this.tremor > 0.5) c.translate((Math.random() - 0.5) * this.tremor, (Math.random() - 0.5) * this.tremor);

    const fundo = [];
    const frente = [];
    for (const p of this.pipas.values()) (p.destaque ? frente : fundo).push(p);
    frente.sort((a, b) => a.escala - b.escala);

    for (const pd of this.pedacos) {
      c.globalAlpha = Math.max(0, 1 - pd.vida / 2.6) * 0.6;
      this.linha(c, pd.corda, "rgba(255,244,228,.8)", 1.2);
    }
    c.globalAlpha = 1;
    for (const v of this.avoadas) {
      c.globalAlpha = Math.max(0, v.alfa);
      this.linha(c, v.corda, "rgba(255,244,228,.7)", 1.2);
      this.desenharRabiola(c, v.rabiola, v.cores, this.dims.tamanho * v.escala, false);
      this.desenharPipa(c, v.corpo, v.cores, v.dourada ? "dourada" : v.estampa || "lisa", this.dims.tamanho * v.escala, t, 0);
    }
    c.globalAlpha = 1;

    if (this.dourada) {
      const d = this.dourada;
      const s = this.dims.tamanho * 1.5;
      this.linha(c, d.corda, "rgba(255,230,160,.8)", 1.6);
      this.desenharRabiola(c, d.rabiola, ["#F2B51F", "#FFF3B0"], s, false);
      this.desenharPipa(c, d.corpo, ["#F2B51F", "#FFF3B0"], "dourada", s, t, 0.2 + 0.2 * Math.sin(t * 6));
    }

    for (const grupo of [fundo, frente]) {
      const destaque = grupo === frente;
      for (const p of grupo) {
        c.globalAlpha = p.alfa * (destaque ? 1 : 0.8);
        const cor = combate.evento && combate.evento.tipo === "dourado" ? COR_LINHA.dourado
          : p.fogo || p.faixa >= 4 ? COR_LINHA.fogo : p.faixa >= 0 ? COR_LINHA[p.faixa] : destaque ? COR_LINHA.nada : COR_LINHA.fundo;
        this.linha(c, p.corda, cor, destaque ? (p.faixa >= 1 ? 2.4 : 1.8) : 1.2, p.faixa >= 1 || p.fogo);
      }
      for (const p of grupo) {
        c.globalAlpha = p.alfa * (destaque ? 1 : 0.88);
        const s = this.dims.tamanho * p.escala;
        this.desenharRabiola(c, p.rabiola, p.cores, s, p.fogo);
        if (p.escudo > 0) this.desenharEscudo(c, p, s, t);
        this.desenharPipa(c, p.corpo, p.cores, p.estampa || "lisa", s, t, p.flash, p.giro3d);
      }
    }
    c.globalAlpha = 1;

    this.desenharParticulas(c);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(this.cena.frente, 0, 0);
    this.desenharFaiscasRelo(c, t);

    /* Nome não pode encavalar: quem importa mais reserva o lugar primeiro
       e o resto encolhe pro nome pequeno ou some naquele quadro. */
    const peso = p => (p.id === info.rei ? 50 : 0) + (p.fogo ? 40 : 0) + (p.gigante ? 30 : 0) + (p.faixa + 1) * 5 + (p.dourada ? 20 : 0);
    const ocupado = [];
    for (const p of [...frente].sort((a, b) => peso(b) - peso(a))) this.etiqueta(c, p, info, true, ocupado);
    for (const p of fundo) this.etiqueta(c, p, info, false, ocupado);
    if (this.dourada) this.etiquetaDourada(c, this.dourada, t);
    this.desenharTextos(c);
  },

  etiquetaDourada(c, d, t) {
    const x = d.corpo.x;
    const y = d.corpo.y - this.dims.tamanho * 1.1 - 14;
    c.font = "900 34px 'Big Shoulders Display', Impact, sans-serif";
    c.textAlign = "center";
    c.textBaseline = "bottom";
    c.lineJoin = "round";
    c.lineWidth = 8;
    c.strokeStyle = "#3A2200";
    const txt = "COMENTE APAREI";
    c.strokeText(txt, x, y);
    c.fillStyle = `rgb(255,${220 + 30 * Math.sin(t * 8)},120)`;
    c.fillText(txt, x, y);
  },

  linha(c, corda, cor, largura, brilho = false) {
    const { x, y, n } = corda;
    c.strokeStyle = cor;
    c.lineWidth = largura;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.beginPath();
    c.moveTo(x[0], y[0]);
    for (let i = 1; i < n - 1; i++) {
      const mx = (x[i] + x[i + 1]) / 2;
      const my = (y[i] + y[i + 1]) / 2;
      c.quadraticCurveTo(x[i], y[i], mx, my);
    }
    c.lineTo(x[n - 1], y[n - 1]);
    c.stroke();
    if (brilho) {
      /* Cerol: brilho que corre pela linha. */
      const k = Math.floor((this.tempo * 9) % n);
      c.fillStyle = "#FFFFFF";
      for (let i = k % 3; i < n; i += 3) c.fillRect(x[i] - 1.5, y[i] - 1.5, 3, 3);
    }
  },

  desenharRabiola(c, r, cores, s, fogo) {
    const { x, y, n } = r;
    c.strokeStyle = fogo ? "#FF8A2A" : "rgba(40,20,30,.65)";
    c.lineWidth = fogo ? 3 : 1.2;
    c.beginPath();
    c.moveTo(x[0], y[0]);
    for (let i = 1; i < n; i++) c.lineTo(x[i], y[i]);
    c.stroke();
    const f = s * 0.11;
    for (let i = 1; i < n; i++) {
      const ang = Math.atan2(y[i] - y[i - 1], x[i] - x[i - 1]) + Math.PI / 2;
      c.save();
      c.translate(x[i], y[i]);
      c.rotate(ang);
      c.fillStyle = fogo ? (i % 2 ? "#FFB43A" : "#FF4A1A") : cores[i % 2];
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(-f * 1.3, -f * 0.7);
      c.lineTo(-f * 1.3, f * 0.7);
      c.closePath();
      c.moveTo(0, 0);
      c.lineTo(f * 1.3, -f * 0.7);
      c.lineTo(f * 1.3, f * 0.7);
      c.closePath();
      c.fill();
      c.restore();
    }
  },

  /* Pipa brasileira: vareta em pé e o arco atravessado, papel de seda,
     estampa conforme a faixa. Origem no centro, já girada. */
  desenharPipa(c, corpo, cores, estampa, s, t, flash = 0, giro3d = 0) {
    const [A, B] = cores;
    c.save();
    c.translate(corpo.x, corpo.y);
    c.rotate(corpo.rot);
    c.scale(1 - Math.abs(giro3d), 1);

    const topo = -0.52 * s, base = 0.5 * s, ombro = -0.14 * s, larg = 0.44 * s;
    const forma = new Path2D();
    forma.moveTo(0, topo);
    forma.quadraticCurveTo(-larg * 0.56, topo + 0.12 * s, -larg, ombro);
    forma.lineTo(0, base);
    forma.lineTo(larg, ombro);
    forma.quadraticCurveTo(larg * 0.56, topo + 0.12 * s, 0, topo);
    forma.closePath();

    if (estampa === "fogo" || estampa === "dourada") {
      c.shadowColor = estampa === "fogo" ? "rgba(255,110,30,.9)" : "rgba(255,215,90,.9)";
      c.shadowBlur = s * 0.35;
    }
    c.fillStyle = A;
    c.fill(forma);
    c.shadowBlur = 0;
    c.save();
    c.clip(forma);

    if (estampa === "lisa") {
      c.fillStyle = B;
      c.fillRect(-s, topo - 2, 2 * s, ombro - topo + 2);
    } else if (estampa === "meio") {
      c.fillStyle = B;
      c.fillRect(0, -s, s, 2 * s);
      c.fillStyle = "rgba(0,0,0,.22)";
      c.fillRect(-s, topo - 2, 2 * s, ombro - topo + 2);
    } else if (estampa === "xadrez") {
      c.fillStyle = B;
      c.fillRect(0, -s, s, s + ombro);
      c.fillRect(-s, ombro, s, s);
      c.strokeStyle = "rgba(230,238,247,.9)";
      c.lineWidth = s * 0.035;
      c.strokeRect(-larg * 0.55, ombro - s * 0.12, larg * 1.1, s * 0.26);
    } else if (estampa === "estrela") {
      this.estrela(c, 0, ombro + s * 0.06, s * 0.2, B);
    } else if (estampa === "olho") {
      for (const [r, cor] of [[0.34, B], [0.24, "#FFF6E0"], [0.15, A], [0.07, "#120818"]]) {
        c.fillStyle = cor;
        c.beginPath();
        c.arc(0, ombro + s * 0.05, s * r, 0, Math.PI * 2);
        c.fill();
      }
    } else if (estampa === "fogo") {
      const g = c.createLinearGradient(0, base, 0, topo);
      g.addColorStop(0, "#FFE15A");
      g.addColorStop(0.45, "#FF6A1A");
      g.addColorStop(1, "#7A0E12");
      c.fillStyle = g;
      c.fillRect(-s, -s, 2 * s, 2 * s);
      c.fillStyle = "rgba(40,6,8,.75)";
      for (let k = -2; k <= 2; k++) {
        const ox = k * s * 0.16;
        const alt = s * (0.32 + 0.08 * Math.sin(t * 9 + k * 1.7));
        c.beginPath();
        c.moveTo(ox - s * 0.08, base);
        c.quadraticCurveTo(ox - s * 0.06, base - alt * 0.6, ox, base - alt);
        c.quadraticCurveTo(ox + s * 0.06, base - alt * 0.6, ox + s * 0.08, base);
        c.fill();
      }
    } else if (estampa === "dourada") {
      const g = c.createLinearGradient(-larg, topo, larg, base);
      g.addColorStop(0, "#FFF3B0");
      g.addColorStop(0.5, "#F2B51F");
      g.addColorStop(1, "#A8700A");
      c.fillStyle = g;
      c.fillRect(-s, -s, 2 * s, 2 * s);
      const brilho = ((t * 0.8) % 2) - 1;
      c.fillStyle = "rgba(255,255,255,.55)";
      c.beginPath();
      c.moveTo(brilho * s - 0.1 * s, -s);
      c.lineTo(brilho * s + 0.05 * s, -s);
      c.lineTo(brilho * s - 0.25 * s, s);
      c.lineTo(brilho * s - 0.4 * s, s);
      c.fill();
    }

    /* Luz do sol pela direita e sombra do lado de lá. */
    const luz = c.createLinearGradient(larg, topo, -larg, base);
    luz.addColorStop(0, "rgba(255,236,200,.32)");
    luz.addColorStop(0.5, "rgba(255,236,200,0)");
    luz.addColorStop(1, "rgba(20,0,30,.28)");
    c.fillStyle = luz;
    c.fillRect(-s, -s, 2 * s, 2 * s);
    if (flash > 0) {
      c.fillStyle = `rgba(255,255,255,${flash * 0.7})`;
      c.fillRect(-s, -s, 2 * s, 2 * s);
    }
    c.restore();

    c.strokeStyle = "rgba(60,30,20,.55)";
    c.lineWidth = Math.max(1, s * 0.022);
    c.beginPath();
    c.moveTo(0, topo);
    c.lineTo(0, base);
    c.moveTo(-larg, ombro);
    c.quadraticCurveTo(0, ombro - s * 0.16, larg, ombro);
    c.stroke();

    const borda = estampa === "estrela" || estampa === "olho" || estampa === "fogo" || estampa === "dourada";
    c.strokeStyle = borda ? "#FFD34A" : "rgba(25,10,25,.55)";
    c.lineWidth = borda ? Math.max(2, s * 0.04) : Math.max(1, s * 0.018);
    c.stroke(forma);
    c.restore();
  },

  estrela(c, x, y, r, cor) {
    c.fillStyle = cor;
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const rr = i % 2 ? r * 0.45 : r;
      c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    c.closePath();
    c.fill();
  },

  /* Bolha fraca e um arco que vai encolhendo com o tempo que falta. */
  desenharEscudo(c, p, s, t) {
    const r = s * 0.8;
    const { x, y } = p.corpo;
    const g = c.createRadialGradient(x, y, r * 0.55, x, y, r);
    g.addColorStop(0, "rgba(150,225,255,0)");
    g.addColorStop(1, "rgba(150,225,255,.2)");
    c.fillStyle = g;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = "rgba(190,240,255,.25)";
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.stroke();
    const resta = Math.min(1, p.escudo / 30);
    c.lineWidth = 3.5;
    c.lineCap = "round";
    c.strokeStyle = p.escudo < 5 && Math.sin(t * 14) > 0 ? "rgba(255,255,255,.95)" : "rgba(190,240,255,.9)";
    c.beginPath();
    c.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + resta * Math.PI * 2);
    c.stroke();
  },

  desenharFaiscasRelo(c, t) {
    for (const vis of this.visDuelo.values()) {
      const pt = vis.ponto;
      if (!pt || pt.d > 50) continue;
      const pulso = 0.6 + 0.4 * Math.sin(t * 30);
      const g = c.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, 26);
      g.addColorStop(0, `rgba(255,255,230,${pulso})`);
      g.addColorStop(1, "rgba(255,200,120,0)");
      c.fillStyle = g;
      c.beginPath();
      c.arc(pt.x, pt.y, 26, 0, Math.PI * 2);
      c.fill();
    }
  },

  desenharParticulas(c) {
    for (const q of this.particulas) {
      const vida = 1 - q.vida / q.max;
      c.globalAlpha = Math.max(0, Math.min(1, vida * 1.5));
      c.fillStyle = q.cor;
      if (q.tipo === "papel") {
        c.save();
        c.translate(q.x, q.y);
        c.rotate(q.rot);
        c.scale(1, Math.abs(Math.sin(q.rot * 1.3)) + 0.2);
        c.fillRect(-q.tam / 2, -q.tam / 3, q.tam, q.tam * 0.66);
        c.restore();
      } else if (q.tipo === "fogo") {
        c.globalCompositeOperation = "lighter";
        c.beginPath();
        c.arc(q.x, q.y, q.tam * vida, 0, Math.PI * 2);
        c.fill();
        c.globalCompositeOperation = "source-over";
      } else {
        c.fillRect(q.x - q.tam / 2, q.y - q.tam / 2, q.tam, q.tam);
      }
    }
    c.globalAlpha = 1;
  },

  etiqueta(c, p, info, destaque, ocupado) {
    if (p.alfa < 0.3) return;
    const s = this.dims.tamanho * p.escala;
    const nome = encurtar(p.jogador.nome, 16);
    const tam = p.gigante ? 30 : 25;
    /* Pipa encostada na borda: a etiqueta desliza pra dentro da tela. */
    c.font = `800 ${tam}px Figtree, sans-serif`;
    const meia = c.measureText(nome).width / 2 + 50;
    const x = Math.max(meia, Math.min(this.dims.W - meia, p.corpo.x));
    const y = p.corpo.y - s * 0.62 - 10;
    const cabe = (w, h) => {
      const r = [x - w / 2, y - h, x + w / 2, y];
      if (ocupado.some(o => r[0] < o[2] && r[2] > o[0] && r[1] < o[3] && r[3] > o[1])) return false;
      ocupado.push(r);
      return true;
    };
    if (destaque) {
      c.font = `800 ${tam}px Figtree, sans-serif`;
      if (!cabe(c.measureText(nome).width + 70, tam + 16)) destaque = false;
    }
    c.globalAlpha = p.alfa;
    if (!destaque) {
      c.font = "700 21px Figtree, sans-serif";
      if (!cabe(c.measureText(nome).width + 10, 25)) { c.globalAlpha = 1; return; }
      if (p.id === info.rei) this.coroa(c, x, y - 34, 20);
      c.textAlign = "center";
      c.textBaseline = "bottom";
      c.lineWidth = 4;
      c.strokeStyle = "rgba(24,10,30,.75)";
      c.strokeText(nome, x, y);
      c.fillStyle = "rgba(255,246,230,.92)";
      c.fillText(nome, x, y);
      c.globalAlpha = 1;
      return;
    }
    if (p.id === info.rei) this.coroa(c, x, y - 64, 26);
    c.font = `800 ${tam}px Figtree, sans-serif`;
    c.textAlign = "left";
    c.textBaseline = "middle";
    const foto = Fotos.de(p.jogador.foto);
    const larguraTexto = c.measureText(nome).width;
    const alt = tam + 16;
    const temFoto = !!foto;
    const w = larguraTexto + 28 + (temFoto ? alt - 4 : 0);
    const x0 = x - w / 2;
    const y0 = y - alt;
    const cor = p.fogo ? "#FF6A1A" : p.dourada ? "#E7A90E" : p.faixa >= 0 ? p.cores[0] : "rgba(24,10,30,.82)";
    c.fillStyle = cor;
    c.beginPath();
    c.roundRect(x0, y0, w, alt, alt / 2);
    c.fill();
    c.strokeStyle = "rgba(255,246,230,.9)";
    c.lineWidth = 2;
    c.stroke();
    if (temFoto) {
      c.save();
      c.beginPath();
      c.arc(x0 + alt / 2, y0 + alt / 2, alt / 2 - 4, 0, Math.PI * 2);
      c.clip();
      c.drawImage(foto, x0 + 4, y0 + 4, alt - 8, alt - 8);
      c.restore();
    }
    c.fillStyle = "#FFFFFF";
    c.lineWidth = 3;
    c.strokeStyle = "rgba(0,0,0,.25)";
    const tx = x0 + 14 + (temFoto ? alt - 4 : 0);
    c.strokeText(nome, tx, y0 + alt / 2 + 1);
    c.fillText(nome, tx, y0 + alt / 2 + 1);
    if (p.gas > 0) {
      for (let i = 0; i < 5; i++) {
        c.fillStyle = i < p.gas ? "#FFB23A" : "rgba(255,255,255,.25)";
        c.beginPath();
        c.arc(x - 24 + i * 12, y0 + alt + 9, 4, 0, Math.PI * 2);
        c.fill();
      }
    }
    c.globalAlpha = 1;
  },

  coroa(c, x, y, s) {
    c.save();
    c.translate(x, y);
    c.fillStyle = "#FFD34A";
    c.strokeStyle = "#7A4A00";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-s, s * 0.5);
    c.lineTo(-s, -s * 0.2);
    c.lineTo(-s * 0.5, s * 0.15);
    c.lineTo(0, -s * 0.55);
    c.lineTo(s * 0.5, s * 0.15);
    c.lineTo(s, -s * 0.2);
    c.lineTo(s, s * 0.5);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = "#E63946";
    c.beginPath();
    c.arc(0, s * 0.18, s * 0.14, 0, Math.PI * 2);
    c.fill();
    c.restore();
  },

  desenharTextos(c) {
    for (const tx of this.textos) {
      const k = tx.vida / tx.max;
      const entra = Math.min(1, tx.vida / 0.12);
      const escala = tx.tam * (0.6 + 0.5 * entra - 0.1 * k);
      c.font = "900 64px 'Big Shoulders Display', Impact, sans-serif";
      const meia = c.measureText(tx.texto).width * escala / 2 + 16;
      c.save();
      /* Grito de pipa que ainda está subindo cairia em cima da quebrada
         (e do chat, no vertical): sobe pro céu. */
      const y = Math.min(tx.y, this.dims.ceu.y1 + 60);
      c.translate(Math.max(meia, Math.min(this.dims.W - meia, tx.x)), y - k * 50);
      c.rotate(tx.rot);
      c.scale(escala, escala);
      c.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      c.font = "900 64px 'Big Shoulders Display', Impact, sans-serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.lineJoin = "round";
      c.lineWidth = 12;
      c.strokeStyle = "#1A0A1E";
      c.strokeText(tx.texto, 0, 0);
      c.fillStyle = tx.cor;
      c.fillText(tx.texto, 0, 0);
      c.restore();
    }
    c.globalAlpha = 1;
  },
};
