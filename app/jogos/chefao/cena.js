/* A arena num canvas: fundo, chefão (com respiração, flash, tremor, fúria,
   escudo e tontura), golpes de cada faixa, números de dano e partículas.
   Não decide nada: anima os acontecimentos que o jogo repassa.

   A regra é instantânea, mas o golpe leva um tempo pra chegar. A cena
   guarda o dano "em voo" e a barra de vida só desce quando ele acerta. */
"use strict";

const LAYOUTS = {
  vertical: { W: 1080, H: 1920, x: 540, y: 822, s: 0.98, chao: 1150, plateia: 1500 },
  horizontal: { W: 1920, H: 1080, x: 960, y: 556, s: 0.74, chao: 815, plateia: 900 },
};

const COR_FAIXA = ["#FFD23F", "#FFB23F", "#FF7A3A", "#FF4A6A", "#FFE066"];
const TAM_FAIXA = [62, 72, 92, 118, 180];
const NUM = new Intl.NumberFormat("pt-BR");
const FONTE = "'Big Shoulders Display', Impact, sans-serif";

function hashTexto(s) {
  let h = 0;
  for (const ch of String(s)) h = (h * 31 + ch.codePointAt(0)) | 0;
  return Math.abs(h);
}

const CORES_FICHA = ["#E8505C", "#2E7DF2", "#17B26A", "#F28C1A", "#9B5DE5", "#00A6A6", "#E84393", "#5F7ADB"];
function corDe(id) { return CORES_FICHA[hashTexto(id) % CORES_FICHA.length]; }

function inicialDe(nome) {
  const limpo = String(nome || "?").replace(/[^\p{L}\p{N}]/gu, "");
  return (limpo[0] || "?").toUpperCase();
}

const suave = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

/* ───────── objetos dos golpes (também servem de ícone no cardápio) ───────── */

const Objetos = {
  luva(c, s = 1, cor = "#E8283F") {
    c.save();
    c.scale(s, s);
    retangulo(c, -70, -24, 40, 48, 10);
    tracar(c, "#FFFFFF", 7);
    c.beginPath();
    c.moveTo(-34, -40);
    c.bezierCurveTo(10, -66, 70, -50, 70, 0);
    c.bezierCurveTo(70, 50, 10, 64, -34, 40);
    c.closePath();
    tracar(c, cor, 8);
    c.beginPath();
    c.moveTo(-10, -42);
    c.bezierCurveTo(10, -60, 34, -40, 20, -22);
    c.lineWidth = 6;
    c.strokeStyle = TINTA;
    c.stroke();
    elipse(c, 34, -24, 16, 8, -0.4);
    c.fillStyle = "rgba(255,255,255,.45)";
    c.fill();
    c.restore();
  },

  bola(c, s = 1, giro = 0) {
    c.save();
    c.scale(s, s);
    c.rotate(giro);
    elipse(c, 0, 0, 46, 46);
    c.fillStyle = "#FFFFFF";
    c.fill();
    c.save();
    c.clip();
    const pent = (x, y, r, a) => {
      c.beginPath();
      for (let i = 0; i < 5; i++) {
        const ang = a + i * TAU / 5;
        c.lineTo(x + Math.cos(ang) * r, y + Math.sin(ang) * r);
      }
      c.closePath();
      c.fillStyle = TINTA;
      c.fill();
    };
    c.strokeStyle = TINTA;
    c.lineWidth = 4;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i * TAU / 5;
      c.beginPath();
      c.moveTo(Math.cos(a) * 16, Math.sin(a) * 16);
      c.lineTo(Math.cos(a) * 40, Math.sin(a) * 40);
      c.stroke();
      pent(Math.cos(a) * 52, Math.sin(a) * 52, 15, a + Math.PI);
    }
    pent(0, 0, 17, -Math.PI / 2);
    c.fillStyle = "rgba(0,0,0,.12)";
    c.beginPath();
    c.arc(10, 10, 46, 0, TAU);
    c.fill();
    c.restore();
    elipse(c, 0, 0, 46, 46);
    tracar(c, null, 7);
    c.restore();
  },

  chinelo(c, s = 1, dourado = false) {
    c.save();
    c.scale(s, s);
    const sola = () => {
      c.beginPath();
      c.moveTo(0, -92);
      c.bezierCurveTo(44, -92, 50, -30, 38, 10);
      c.bezierCurveTo(30, 40, 40, 70, 30, 90);
      c.bezierCurveTo(16, 108, -16, 108, -30, 90);
      c.bezierCurveTo(-40, 70, -30, 40, -38, 10);
      c.bezierCurveTo(-50, -30, -44, -92, 0, -92);
      c.closePath();
    };
    c.save();
    c.translate(8, 8);
    sola();
    c.fillStyle = dourado ? "#B9840C" : "#1F5FBF";
    c.fill();
    c.restore();
    sola();
    tracar(c, dourado ? "#F7C531" : "#F4F1EA", 7);
    if (dourado) {
      c.save();
      sola();
      c.clip();
      c.fillStyle = "rgba(255,255,255,.4)";
      c.fillRect(-60, -100, 30, 220);
      c.restore();
    }
    c.save();
    c.lineCap = "round";
    c.lineJoin = "round";
    c.beginPath();
    c.moveTo(-36, 6);
    c.quadraticCurveTo(-20, -44, 0, -58);
    c.quadraticCurveTo(20, -44, 36, 6);
    c.lineWidth = 22;
    c.strokeStyle = TINTA;
    c.stroke();
    c.lineWidth = 12;
    c.strokeStyle = dourado ? "#D61F3A" : "#1F5FBF";
    c.stroke();
    c.restore();
    elipse(c, 0, -58, 8, 8);
    tracar(c, dourado ? "#D61F3A" : "#1F5FBF", 5);
    c.restore();
  },

  rojao(c, s = 1) {
    c.save();
    c.scale(s, s);
    c.beginPath();
    c.moveTo(-3, 30); c.lineTo(3, 30); c.lineTo(3, 120); c.lineTo(-3, 120);
    tracar(c, "#C9A26A", 4);
    retangulo(c, -16, -40, 32, 76, 6);
    tracar(c, "#E8283F", 6);
    c.fillStyle = "#FFD23F";
    c.fillRect(-13, -6, 26, 10);
    c.beginPath();
    c.moveTo(-18, -40); c.lineTo(0, -74); c.lineTo(18, -40);
    c.closePath();
    tracar(c, "#F4F1EA", 6);
    c.restore();
  },
};

const Cena = {
  particulas: [],
  numeros: [],
  efeitos: [],
  fichas: [],
  t: 0,
  escala: 1,
  lentoAte: 0,
  tremor: 0,
  escurecer: 0,
  clarao: 0,
  claraoCor: "#FFFFFF",
  emVoo: { vida: 0, escudo: 0 },
  MAX_PARTICULAS: 900,
  MAX_NUMEROS: 46,
  MAX_FICHAS: 26,

  montar(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.arte = document.createElement("canvas");
    this.arte.width = 920;
    this.arte.height = 800;
    this.actx = this.arte.getContext("2d");
    this.chefe = null;
  },

  aplicarFormato(formato) {
    this.L = LAYOUTS[formato];
    this.canvas.width = this.L.W;
    this.canvas.height = this.L.H;
    this.fundo = this.montarFundo();
    this.plateia = this.montarPlateia();
  },

  /* ───────── fundo (desenhado uma vez por formato) ───────── */

  montarFundo() {
    const { W, H, chao } = this.L;
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const c = cv.getContext("2d");
    const ceu = c.createLinearGradient(0, 0, 0, chao);
    ceu.addColorStop(0, "#120A26");
    ceu.addColorStop(0.55, "#2A1450");
    ceu.addColorStop(1, "#4A1E5E");
    c.fillStyle = ceu;
    c.fillRect(0, 0, W, H);

    let semente = 7;
    const rnd = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 90; i++) {
      c.fillStyle = `rgba(255,240,255,${0.15 + rnd() * 0.5})`;
      const r = rnd() * 2 + 0.6;
      c.beginPath();
      c.arc(rnd() * W, rnd() * chao * 0.6, r, 0, TAU);
      c.fill();
    }

    /* morro com casinhas acesas, duas camadas */
    const morro = (base, alto, cor, janela, largura) => {
      c.fillStyle = cor;
      c.beginPath();
      c.moveTo(0, chao);
      for (let x = 0; x <= W; x += 20) {
        c.lineTo(x, base - Math.sin(x / W * Math.PI * 1.3 + 0.4) * alto - Math.sin(x / 90) * 10);
      }
      c.lineTo(W, chao);
      c.closePath();
      c.fill();
      for (let x = 10; x < W; x += largura + rnd() * largura) {
        const topo = base - Math.sin(x / W * Math.PI * 1.3 + 0.4) * alto - Math.sin(x / 90) * 10;
        for (let y = topo + 16; y < chao - 10; y += 26 + rnd() * 20) {
          const w = largura * (0.7 + rnd() * 0.5);
          const h = 18 + rnd() * 14;
          c.fillStyle = cor;
          c.fillRect(x, y - h, w, h);
          if (rnd() < 0.5) {
            c.fillStyle = janela;
            c.globalAlpha = 0.5 + rnd() * 0.5;
            c.fillRect(x + w * 0.3, y - h * 0.65, 6, 7);
            c.globalAlpha = 1;
          }
        }
      }
    };
    morro(chao - 150, 160, "#2B1546", "#FFB65A", 38);
    morro(chao - 40, 90, "#1D0F33", "#FFD27A", 46);

    /* chão da arena */
    const piso = c.createLinearGradient(0, chao - 30, 0, H);
    piso.addColorStop(0, "#2A1838");
    piso.addColorStop(1, "#0D0716");
    c.fillStyle = piso;
    c.fillRect(0, chao - 30, W, H - chao + 30);
    c.save();
    c.translate(this.L.x, chao);
    c.scale(1, 0.22);
    const anel = c.createRadialGradient(0, 0, 0, 0, 0, 470);
    anel.addColorStop(0, "rgba(255,210,120,.28)");
    anel.addColorStop(0.7, "rgba(255,120,180,.12)");
    anel.addColorStop(1, "rgba(255,120,180,0)");
    c.fillStyle = anel;
    c.beginPath();
    c.arc(0, 0, 470, 0, TAU);
    c.fill();
    c.lineWidth = 10;
    c.strokeStyle = "rgba(255,210,140,.35)";
    c.beginPath();
    c.arc(0, 0, 360, 0, TAU);
    c.stroke();
    c.restore();
    return cv;
  },

  /* Plateia em silhueta com punho pro alto: mostra que é o chat contra ele. */
  montarPlateia() {
    const { W } = this.L;
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = 420;
    const c = cv.getContext("2d");
    let semente = 3;
    const rnd = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
    for (const [linha, cor] of [[0, "#1A0D2A"], [1, "#100820"]]) {
      for (let x = -20; x < W + 40; x += 52 + rnd() * 20) {
        const y = 120 + linha * 90 + rnd() * 20;
        c.fillStyle = cor;
        if (rnd() < 0.45) {
          c.save();
          c.lineCap = "round";
          c.strokeStyle = cor;
          c.lineWidth = 18;
          c.beginPath();
          c.moveTo(x + 14, y + 40);
          c.lineTo(x + 26 + rnd() * 10, y - 50);
          c.stroke();
          c.beginPath();
          c.arc(x + 30, y - 58, 15, 0, TAU);
          c.fill();
          c.restore();
        }
        c.beginPath();
        c.arc(x, y, 26, 0, TAU);
        c.fill();
        c.beginPath();
        c.roundRect(x - 44, y + 22, 88, 300, 36);
        c.fill();
      }
    }
    return cv;
  },

  /* ───────── chefão ───────── */

  trocarChefe(chefe) {
    const arte = ARTE[chefe.def.id] || ARTE.boleto;
    this.chefe = {
      dados: chefe,
      arte,
      entrada: 0,
      derrota: -1,
      flash: 0,
      recuo: { x: 0, y: 0 },
      amasso: 0,
      olhar: { x: 0, y: 0.2 },
      olharAlvo: { x: 0, y: 0.2 },
      piscaEm: 2,
      piscar: 0,
      susto: 0,
      falaAte: 0,
      furia: 0,
      escudo: 0,
      escudoTremor: 0,
      investida: 0,
      tontoAte: 0,
    };
    this.emVoo = { vida: 0, escudo: 0 };
    this.escudoLigado = false;
    this.efeitos = this.efeitos.filter(e => e.tipo === "mae" && e.t >= e.dur);
  },

  /* Posição na tela de um ponto da arte. */
  telaDe(px, py) {
    const { x, y, s } = this.L;
    return { x: x + px * s, y: y + py * s };
  },

  pontoNoChefe() {
    const a = this.chefe ? this.chefe.arte.alvo : { x: 0, y: 0, rx: 150, ry: 150 };
    const ang = Math.random() * TAU;
    const r = Math.sqrt(Math.random()) * 0.8;
    return this.telaDe(a.x + Math.cos(ang) * a.rx * r, a.y + Math.sin(ang) * a.ry * r);
  },

  falar(segundos) { if (this.chefe) this.chefe.falaAte = this.t + segundos; },

  /* ───────── golpes ───────── */

  /* `a` é o acontecimento "dano" da regra. */
  golpe(a, jogador) {
    if (!this.chefe) return;
    const alvo = this.pontoNoChefe();
    const dano = { vida: a.naVida || 0, escudo: a.noEscudo || 0 };
    this.emVoo.vida += dano.vida;
    this.emVoo.escudo += dano.escudo;
    const ef = { a, jogador, alvo, dano, t: 0, acertou: false };
    const { W, H } = this.L;
    const faixa = a.origem === "presente" ? a.faixa : -1;

    if (faixa < 0) {
      const de = { x: 80 + Math.random() * (W - 160), y: H * (this.L.W > this.L.H ? 0.62 : 1.04) + Math.random() * 60 };
      if (this.fichas.length >= this.MAX_FICHAS) {
        ef.tipo = "instante";
        ef.dur = 0;
      } else {
        ef.tipo = "ficha";
        ef.de = de;
        ef.dur = 0.42 + Math.random() * 0.12;
        this.fichas.push(ef);
      }
    } else if (faixa === 0) {
      const lado = Math.random() < 0.5 ? -1 : 1;
      Object.assign(ef, { tipo: "luva", lado, dur: 0.22, de: { x: lado < 0 ? -120 : W + 120, y: alvo.y + 40 } });
    } else if (faixa === 1) {
      Object.assign(ef, { tipo: "bola", dur: 0.5, de: { x: W * (0.25 + Math.random() * 0.5), y: H + 60 } });
    } else if (faixa === 2) {
      const lado = Math.random() < 0.5 ? -1 : 1;
      Object.assign(ef, { tipo: "chinelo", lado, dur: 0.55, de: { x: lado < 0 ? -160 : W + 160, y: alvo.y - 300 } });
    } else if (faixa === 3) {
      Object.assign(ef, { tipo: "rojao", dur: 1.25, foguetes: Array.from({ length: 6 }, (_, i) => ({
        de: { x: W * (0.12 + i * 0.152), y: H + 80 }, alvo: this.pontoNoChefe(), sai: i * 0.1, estourou: false })) });
    } else {
      Object.assign(ef, { tipo: "mae", dur: 2.7, impacto: 1.35 });
    }

    /* Muita coisa ao mesmo tempo (50 presentes no mesmo segundo): golpe
       pequeno vira instantâneo pra não entupir a tela. */
    const pesados = this.efeitos.filter(e => e.tipo !== "ficha" && e.t < e.dur).length;
    if (pesados > 14 && faixa >= 0 && faixa < 3) {
      ef.tipo = "instante";
      ef.dur = 0;
    }
    this.efeitos.push(ef);
  },

  /* Chama `fn` quando o último golpe em voo acertar (ou já). */
  quandoAcertar(fn) {
    const ultimo = [...this.efeitos].reverse().find(e => !e.acertou && e.a);
    if (ultimo) (ultimo.depois = ultimo.depois || []).push(fn);
    else fn();
  },

  acertar(ef, ponto = ef.alvo) {
    if (ef.acertou) return;
    ef.acertou = true;
    this.emVoo.vida = Math.max(0, this.emVoo.vida - ef.dano.vida);
    this.emVoo.escudo = Math.max(0, this.emVoo.escudo - ef.dano.escudo);
    const a = ef.a;
    const faixa = a.origem === "presente" ? a.faixa : -1;
    const ch = this.chefe;
    if (ch) {
      const peso = faixa < 0 ? 0.25 : 0.5 + faixa * 0.25;
      ch.flash = Math.min(0.65, ch.flash + 0.25 + peso * 0.25);
      ch.susto = Math.max(ch.susto, 0.3 + peso * 0.3);
      const dx = ponto.x - this.L.x;
      ch.recuo.x += (dx > 0 ? -1 : 1) * (6 + peso * 22);
      ch.recuo.y -= 4 + peso * 10;
      ch.amasso = Math.min(1, ch.amasso + 0.15 + peso * 0.35);
      ch.olharAlvo = { x: Math.max(-1, Math.min(1, dx / 260)), y: Math.max(-1, Math.min(1, (ponto.y - this.L.y) / 260)) };
      if (a.noEscudo > 0) ch.escudoTremor = 1;
    }
    this.tremor = Math.max(this.tremor, [3, 5, 9, 16, 24, 40][faixa + 1]);
    this.impacto(ponto.x, ponto.y, faixa, a.noEscudo > 0 && !a.naVida);
    this.numero(a, ef.jogador, ponto);
    if (ef.depois) ef.depois.forEach(f => f());
  },

  impacto(x, y, faixa, noEscudo) {
    const n = [5, 10, 16, 26, 34, 70][faixa + 1];
    const cores = noEscudo ? ["#9FF0FF", "#FFFFFF", "#4FD8FF"] : ["#FFFFFF", "#FFE066", COR_FAIXA[Math.max(0, faixa)]];
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * TAU;
      const v = 200 + Math.random() * (300 + faixa * 160);
      this.particula({ x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, vida: 0.35 + Math.random() * 0.35, cor: cores[i % 3], tam: 4 + Math.random() * (4 + faixa * 2), tipo: "faisca" });
    }
    if (faixa >= 0) this.particula({ x, y, vida: 0.35 + faixa * 0.08, tam: 60 + faixa * 60, tipo: "anel", cor: noEscudo ? "#9FF0FF" : "#FFFFFF" });
    if (faixa >= 0) this.particula({ x, y, vida: 0.22 + faixa * 0.04, tam: 50 + faixa * 30, tipo: "estrela", cor: "#FFFFFF" });
  },

  numero(a, jogador, ponto) {
    const faixa = a.origem === "presente" ? a.faixa : -1;
    const pequeno = faixa < 0;
    if (pequeno && this.numeros.length > this.MAX_NUMEROS * 0.6) return;
    if (this.numeros.length >= this.MAX_NUMEROS) this.numeros.shift();
    const tam = pequeno ? (a.origem === "comentario" ? 40 : 46) : TAM_FAIXA[faixa];
    this.numeros.push({
      texto: NUM.format(a.dano),
      x: ponto.x + (Math.random() - 0.5) * 30,
      y: ponto.y - 20,
      vx: (Math.random() - 0.5) * 120,
      vy: -(380 + (pequeno ? 0 : faixa * 90)),
      t: 0,
      dur: pequeno ? 0.9 : 1.3 + faixa * 0.25,
      tam,
      cor: a.critico ? "#FF5AE0" : a.noEscudo > 0 && !a.naVida ? "#9FF0FF" : pequeno ? "#FFFFFF" : COR_FAIXA[faixa],
      rotulo: a.critico ? "CRÍTICO!" : a.mult >= 2 ? `×${a.mult}` : "",
      nome: !pequeno && faixa >= 2 && jogador ? jogador.nome : "",
    });
  },

  particula(p) {
    if (this.particulas.length >= this.MAX_PARTICULAS) this.particulas.splice(0, 40);
    this.particulas.push({ vx: 0, vy: 0, g: 0, giro: 0, rot: 0, ...p, max: p.vida });
  },

  /* ───────── fases e momentos ───────── */

  curar(qtd) {
    if (!this.chefe) return;
    for (let i = 0; i < 26; i++) {
      const p = this.pontoNoChefe();
      this.particula({ x: p.x, y: p.y, vy: -120 - Math.random() * 120, vida: 0.9 + Math.random() * 0.6, cor: "#5CFF9A", tam: 10 + Math.random() * 10, tipo: "mais" });
    }
    const topo = this.telaDe(0, this.chefe.arte.cabeca.y + 40);
    this.numeros.push({ texto: "+" + NUM.format(qtd), x: topo.x, y: topo.y + 120, vx: 0, vy: -200, t: 0, dur: 1.8, tam: 96, cor: "#5CFF9A", rotulo: "CUROU", nome: "" });
  },

  curaLenta() {
    if (!this.chefe || Math.random() > 0.35) return;
    const p = this.pontoNoChefe();
    this.particula({ x: p.x, y: p.y, vy: -90, vida: 1.1, cor: "#5CFF9A", tam: 8 + Math.random() * 8, tipo: "mais" });
  },

  contraAcertou() {
    if (!this.chefe) return;
    this.chefe.investida = 1;
    this.tremor = 34;
    this.clarao = 0.55;
    this.claraoCor = this.chefe.arte.cor;
    this.particula({ x: this.L.x, y: this.L.y, vida: 0.7, tam: 900, tipo: "anel", cor: this.chefe.arte.cor });
  },

  /* O escudo só aparece quando o golpe que o fez subir acerta. */
  ligarEscudo() {
    this.quandoAcertar(() => { this.escudoLigado = true; });
  },

  escudoQuebrou() {
    this.escudoLigado = false;
    if (!this.chefe) return;
    const { x, y, s } = this.L;
    for (let i = 0; i < 40; i++) {
      const ang = Math.random() * TAU;
      const r = 340 * s;
      this.particula({ x: x + Math.cos(ang) * r, y: y - 40 * s + Math.sin(ang) * r * 1.05, vx: Math.cos(ang) * 420, vy: Math.sin(ang) * 420 - 100, g: 900, vida: 0.9, cor: "#9FF0FF", tam: 16 + Math.random() * 16, tipo: "caco", giro: (Math.random() - 0.5) * 14 });
    }
    this.tremor = 22;
  },

  derrotar() {
    if (!this.chefe) return;
    this.chefe.derrota = 0;
    this.lentoAte = this.t + 0.25;
  },

  explodirChefe() {
    const { x, y, s } = this.L;
    const cor = this.chefe ? this.chefe.arte.cor : "#FFFFFF";
    for (let i = 0; i < 160; i++) {
      const ang = Math.random() * TAU;
      const v = 300 + Math.random() * 900;
      const tipo = i % 4 === 0 ? "moeda" : i % 4 === 1 ? "confete" : "faisca";
      this.particula({ x: x + (Math.random() - 0.5) * 200 * s, y: y + (Math.random() - 0.5) * 300 * s, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v - 300, g: tipo === "faisca" ? 300 : 1100, vida: 1.2 + Math.random() * 1.2, cor: tipo === "confete" ? CORES_FICHA[i % CORES_FICHA.length] : tipo === "moeda" ? "#FFD23F" : i % 2 ? cor : "#FFFFFF", tam: tipo === "faisca" ? 6 + Math.random() * 8 : 14 + Math.random() * 10, tipo, giro: (Math.random() - 0.5) * 16 });
    }
    this.particula({ x, y, vida: 0.9, tam: 1100, tipo: "anel", cor: "#FFFFFF" });
    this.clarao = 1;
    this.claraoCor = "#FFFFFF";
    this.tremor = 40;
  },

  /* ───────── quadro ───────── */

  quadro(dt, raid, agora) {
    if (!this.L) return;
    this.agora = agora;
    const lento = this.t < this.lentoAte;
    const passo = dt * (lento ? 0.3 : 1);
    this.t += passo;
    this.atualizar(passo, raid);
    this.desenhar(raid);
  },

  atualizar(dt, raid) {
    const ch = this.chefe;
    if (ch) {
      ch.entrada = Math.min(1, ch.entrada + dt / 0.9);
      ch.flash = Math.max(0, ch.flash - dt * 7);
      ch.susto = Math.max(0, ch.susto - dt * 3);
      ch.amasso = Math.max(0, ch.amasso - dt * 4);
      ch.investida = Math.max(0, ch.investida - dt * 1.6);
      ch.escudoTremor = Math.max(0, ch.escudoTremor - dt * 4);
      ch.recuo.x *= Math.pow(0.0008, dt);
      ch.recuo.y *= Math.pow(0.0008, dt);
      ch.olhar.x += (ch.olharAlvo.x - ch.olhar.x) * Math.min(1, dt * 8);
      ch.olhar.y += (ch.olharAlvo.y - ch.olhar.y) * Math.min(1, dt * 8);
      if (Math.random() < dt * 0.4) ch.olharAlvo = { x: (Math.random() - 0.5) * 1.2, y: 0.1 + Math.random() * 0.5 };
      ch.piscaEm -= dt;
      if (ch.piscaEm <= 0) { ch.piscar = 1; ch.piscaEm = 2.5 + Math.random() * 3; }
      ch.piscar = Math.max(0, ch.piscar - dt * 7);
      const d = ch.dados;
      ch.furia += ((d.furia ? 1 : 0) - ch.furia) * Math.min(1, dt * 3);
      const escudoAlvo = this.escudoLigado && (d.escudo > 0 || this.emVoo.escudo > 0) ? 1 : 0;
      ch.escudo += (escudoAlvo - ch.escudo) * Math.min(1, dt * 6);
      if (ch.derrota >= 0) {
        const antes = ch.derrota;
        ch.derrota += dt;
        if (antes < 0.9 && ch.derrota >= 0.9) this.explodirChefe();
      }
      if (ch.furia > 0.5 && Math.random() < dt * 8) {
        const p = this.pontoNoChefe();
        this.particula({ x: p.x, y: p.y + 60, vy: -160 - Math.random() * 100, vida: 0.8, cor: "#FF4A3A", tam: 6 + Math.random() * 8, tipo: "brasa" });
      }
    }

    for (const ef of this.efeitos) {
      ef.t += dt;
      this.passoEfeito(ef, dt);
    }
    this.efeitos = this.efeitos.filter(ef => ef.t < ef.dur + 0.8 || !ef.acertou);
    this.fichas = this.fichas.filter(f => !f.acertou);

    for (const p of this.particulas) {
      p.vida -= dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.giro * dt;
      if (p.tipo === "fumaca") { p.vx *= 0.96; p.vy *= 0.96; }
    }
    this.particulas = this.particulas.filter(p => p.vida > 0);
    for (const n of this.numeros) {
      n.t += dt;
      n.vy += 900 * dt;
      n.x += n.vx * dt;
      n.y += Math.max(-1200, n.vy) * dt * (n.vy > 0 ? 0.15 : 1);
    }
    this.numeros = this.numeros.filter(n => n.t < n.dur);

    this.tremor = Math.max(0, this.tremor - dt * 60);
    this.clarao = Math.max(0, this.clarao - dt * 2.2);
    const escuroAlvo = this.efeitos.some(e => e.tipo === "mae" && e.t < e.dur) ? 0.6 : 0;
    this.escurecer += (escuroAlvo - this.escurecer) * Math.min(1, dt * 5);
  },

  passoEfeito(ef, dt) {
    if (ef.tipo === "instante") {
      this.acertar(ef);
    } else if (ef.tipo === "ficha" || ef.tipo === "luva" || ef.tipo === "bola" || ef.tipo === "chinelo") {
      if (!ef.acertou && ef.t >= ef.dur) this.acertar(ef);
    } else if (ef.tipo === "rojao") {
      for (const f of ef.foguetes) {
        const k = (ef.t - f.sai) / 0.55;
        if (k > 0 && k < 1 && Math.random() < 0.9) {
          const pos = this.posFoguete(f, k);
          this.particula({ x: pos.x, y: pos.y + 30, vx: (Math.random() - 0.5) * 40, vy: 40, vida: 0.7, cor: "rgba(220,210,230,.5)", tam: 14 + Math.random() * 12, tipo: "fumaca" });
        }
        if (k >= 1 && !f.estourou) {
          f.estourou = true;
          this.impacto(f.alvo.x, f.alvo.y, 2, false);
          this.tremor = Math.max(this.tremor, 14);
          if (this.chefe) this.chefe.flash = Math.max(this.chefe.flash, 0.5);
        }
      }
      if (!ef.acertou && ef.foguetes.every(f => f.estourou)) this.acertar(ef, this.telaDe(0, this.chefe ? this.chefe.arte.alvo.y : 0));
    } else if (ef.tipo === "mae") {
      if (!ef.acertou && ef.t >= ef.impacto) {
        const ponto = this.telaDe(0, this.chefe ? this.chefe.arte.alvo.y : 0);
        this.acertar(ef, ponto);
        this.clarao = 1;
        this.claraoCor = "#FFF3C4";
        this.tremor = 48;
        for (let i = 0; i < 70; i++) {
          this.particula({ x: Math.random() * this.L.W, y: -40 - Math.random() * 300, vx: (Math.random() - 0.5) * 80, vy: 200 + Math.random() * 300, g: 700, vida: 2.2, cor: "#FFD23F", tam: 14 + Math.random() * 10, tipo: "moeda", giro: (Math.random() - 0.5) * 12 });
        }
      }
    }
  },

  posFoguete(f, k) {
    const e = suave(k);
    return { x: f.de.x + (f.alvo.x - f.de.x) * e + Math.sin(k * Math.PI) * 40, y: f.de.y + (f.alvo.y - f.de.y) * e };
  },

  desenhar(raid) {
    const c = this.ctx;
    const { W, H } = this.L;
    c.save();
    if (this.tremor > 0) c.translate((Math.random() - 0.5) * this.tremor, (Math.random() - 0.5) * this.tremor);
    c.drawImage(this.fundo, 0, 0);
    this.desenharLuzes(c);
    c.drawImage(this.plateia, 0, this.L.plateia + Math.sin(this.t * 3) * 6);
    this.desenharChefe(c, raid);
    for (const ef of this.efeitos) this.desenharEfeito(c, ef);
    this.desenharParticulas(c);
    this.desenharNumeros(c);
    c.restore();
    if (this.escurecer > 0.01) {
      c.fillStyle = `rgba(8,2,16,${this.escurecer})`;
      c.fillRect(0, 0, W, H);
      for (const ef of this.efeitos) if (ef.tipo === "mae") this.desenharMae(c, ef);
    }
    if (this.clarao > 0.01) {
      c.globalAlpha = Math.min(1, this.clarao);
      c.fillStyle = this.claraoCor;
      c.fillRect(0, 0, W, H);
      c.globalAlpha = 1;
    }
  },

  desenharLuzes(c) {
    const { x, y, chao, W } = this.L;
    const cor = this.chefe ? this.chefe.arte.cor : "#FFFFFF";
    const halo = c.createRadialGradient(x, y, 40, x, y, 560);
    halo.addColorStop(0, cor + "55");
    halo.addColorStop(1, cor + "00");
    c.fillStyle = halo;
    c.fillRect(0, 0, W, chao + 80);
    c.save();
    c.globalCompositeOperation = "lighter";
    for (let i = 0; i < 2; i++) {
      const base = i ? W * 0.92 : W * 0.08;
      const ang = Math.sin(this.t * 0.5 + i * 2) * 0.18;
      c.save();
      c.translate(base, -40);
      c.rotate((i ? 0.42 : -0.42) + ang);
      const g = c.createLinearGradient(0, 0, 0, chao * 1.05);
      g.addColorStop(0, "rgba(255,230,190,.22)");
      g.addColorStop(1, "rgba(255,230,190,0)");
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(-20, 0); c.lineTo(20, 0); c.lineTo(200, chao * 1.05); c.lineTo(-200, chao * 1.05);
      c.fill();
      c.restore();
    }
    c.restore();
  },

  desenharChefe(c, raid) {
    const ch = this.chefe;
    if (!ch) return;
    const { x, y, s, chao } = this.L;
    const d = ch.dados;
    const t = this.t;
    if (ch.derrota >= 1.1) return;

    const a = this.actx;
    a.setTransform(1, 0, 0, 1, 0, 0);
    a.clearRect(0, 0, 920, 800);
    a.save();
    a.translate(460, 400);
    const tonto = raid && raid.chefe === d && raid.chefe.tontoAte > this.agora;
    ch.arte.desenhar(a, {
      t,
      resp: Math.sin(t * (2.2 + ch.furia * 1.4)),
      olhar: ch.olhar,
      boca: t < ch.falaAte ? 0.5 + Math.sin(t * 22) * 0.5 : ch.susto * 0.8,
      piscar: Math.max(ch.piscar, ch.susto > 0.4 ? 0.55 : 0),
      furia: ch.furia,
      tonto,
      fala: t < ch.falaAte,
    });
    a.restore();
    a.globalCompositeOperation = "source-atop";
    if (ch.furia > 0.05) {
      a.fillStyle = `rgba(255,30,40,${(0.08 + Math.sin(t * 6) * 0.04) * ch.furia})`;
      a.fillRect(0, 0, 920, 800);
    }
    if (ch.flash > 0) {
      a.fillStyle = `rgba(255,255,255,${Math.min(0.85, ch.flash)})`;
      a.fillRect(0, 0, 920, 800);
    }
    a.globalCompositeOperation = "source-over";

    /* entrada: cai do céu e quica; derrota: treme e some girando */
    let dy = 0;
    let rot = 0;
    let esc = 1;
    let alfa = 1;
    if (ch.entrada < 1) {
      const k = ch.entrada;
      dy = k < 0.6 ? -1300 * Math.pow(1 - k / 0.6, 2) : -Math.sin((k - 0.6) / 0.4 * Math.PI) * 50 * (1 - k);
      if (!ch.pousou && k >= 0.6) {
        ch.pousou = true;
        this.tremor = 30;
        for (let i = 0; i < 40; i++) {
          const lado = i % 2 ? 1 : -1;
          this.particula({ x: x + lado * (100 + Math.random() * 220), y: chao - 10, vx: lado * (200 + Math.random() * 400), vy: -80 - Math.random() * 160, vida: 0.9, cor: "rgba(200,170,220,.45)", tam: 24 + Math.random() * 20, tipo: "fumaca" });
        }
      }
    }
    if (ch.derrota >= 0) {
      const k = ch.derrota;
      if (k < 0.9) {
        dy = 0;
        rot = Math.sin(k * 60) * 0.05;
        ch.flash = Math.max(ch.flash, Math.sin(k * 30) > 0 ? 0.7 : 0);
      } else {
        const m = (k - 0.9) / 0.2;
        esc = 1 + m * 0.4;
        alfa = 1 - m;
      }
    }
    const investida = Math.sin(ch.investida * Math.PI);
    esc *= 1 + investida * 0.14;
    const amasso = Math.sin(ch.amasso * Math.PI) * 0.08;

    /* sombra no chão */
    c.save();
    c.fillStyle = `rgba(0,0,0,${0.35 * alfa * (ch.entrada < 0.6 ? ch.entrada / 0.6 : 1)})`;
    c.beginPath();
    c.ellipse(x, chao - 4, 300 * s * esc, 40 * s, 0, 0, TAU);
    c.fill();
    c.restore();

    c.save();
    c.globalAlpha = alfa;
    c.translate(x + ch.recuo.x, y + dy + ch.recuo.y);
    c.rotate(rot);
    c.scale(s * esc * (1 + amasso), s * esc * (1 - amasso));
    c.drawImage(this.arte, -460, -400);
    c.restore();

    if (ch.escudo > 0.02) this.desenharEscudo(c, ch);
    if (raid && raid.evento && raid.evento.tipo === "pontoFraco" && d.estado === "luta") this.desenharPontoFraco(c, ch);
    if (tonto) this.desenharTontura(c, ch);
  },

  desenharEscudo(c, ch) {
    const { x, y, s } = this.L;
    const t = this.t;
    const tremor = ch.escudoTremor * 8;
    const raio = 360 * s;
    c.save();
    c.globalAlpha = ch.escudo;
    c.translate(x + (Math.random() - 0.5) * tremor, y - 30 * s);
    const g = c.createRadialGradient(0, 0, raio * 0.6, 0, 0, raio);
    g.addColorStop(0, "rgba(120,230,255,0)");
    g.addColorStop(0.85, "rgba(120,230,255,.18)");
    g.addColorStop(1, "rgba(180,245,255,.55)");
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(0, 0, raio, raio * 1.05, 0, 0, TAU);
    c.fill();
    c.save();
    c.clip();
    c.strokeStyle = `rgba(190,248,255,${0.22 + ch.escudoTremor * 0.4})`;
    c.lineWidth = 3;
    const lado = 46;
    for (let row = -9; row <= 9; row++) {
      for (let col = -9; col <= 9; col++) {
        const hx = col * lado * 1.5;
        const hy = row * lado * 1.732 + (col % 2 ? lado * 0.866 : 0) + Math.sin(t) * 6;
        c.beginPath();
        for (let k = 0; k < 6; k++) c.lineTo(hx + Math.cos(k * Math.PI / 3) * lado * 0.92, hy + Math.sin(k * Math.PI / 3) * lado * 0.92);
        c.closePath();
        c.stroke();
      }
    }
    c.restore();
    c.lineWidth = 6;
    c.strokeStyle = "rgba(200,250,255,.85)";
    c.beginPath();
    c.ellipse(0, 0, raio, raio * 1.05, 0, 0, TAU);
    c.stroke();
    c.restore();
  },

  desenharPontoFraco(c, ch) {
    const p = this.telaDe(ch.arte.pontoFraco.x, ch.arte.pontoFraco.y);
    const t = this.t;
    const r = 70 + Math.sin(t * 6) * 8;
    c.save();
    c.translate(p.x + ch.recuo.x, p.y + ch.recuo.y);
    c.rotate(t * 1.4);
    c.strokeStyle = "#FF5AE0";
    c.shadowColor = "#FF5AE0";
    c.shadowBlur = 24;
    c.lineWidth = 8;
    c.beginPath();
    c.arc(0, 0, r, 0, TAU);
    c.stroke();
    c.lineWidth = 6;
    c.beginPath();
    c.arc(0, 0, r * 0.45, 0, TAU);
    c.stroke();
    for (let k = 0; k < 4; k++) {
      c.rotate(Math.PI / 2);
      c.beginPath();
      c.moveTo(r * 0.7, 0);
      c.lineTo(r * 1.35, 0);
      c.stroke();
    }
    c.restore();
  },

  desenharTontura(c, ch) {
    const p = this.telaDe(ch.arte.cabeca.x, ch.arte.cabeca.y);
    const t = this.t;
    for (let i = 0; i < 4; i++) {
      const a = t * 4 + i * TAU / 4;
      const sx = p.x + Math.cos(a) * 130;
      const sy = p.y + Math.sin(a) * 28;
      c.save();
      c.translate(sx, sy);
      c.rotate(t * 3);
      c.beginPath();
      for (let k = 0; k < 10; k++) {
        const r = k % 2 ? 9 : 22;
        c.lineTo(Math.cos(k * Math.PI / 5) * r, Math.sin(k * Math.PI / 5) * r);
      }
      c.closePath();
      tracar(c, "#FFE066", 5);
      c.restore();
    }
  },

  desenharEfeito(c, ef) {
    const k = ef.dur ? Math.min(1, ef.t / ef.dur) : 1;
    if (ef.tipo === "ficha" && !ef.acertou) {
      const e = suave(k);
      const px = ef.de.x + (ef.alvo.x - ef.de.x) * e;
      const py = ef.de.y + (ef.alvo.y - ef.de.y) * e - Math.sin(k * Math.PI) * 120;
      const j = ef.jogador || { id: "?", nome: "?" };
      c.save();
      c.translate(px, py);
      c.scale(1 - k * 0.25, 1 - k * 0.25);
      c.beginPath();
      c.arc(0, 0, 28, 0, TAU);
      c.fillStyle = corDe(j.id);
      c.fill();
      c.lineWidth = 5;
      c.strokeStyle = "#FFFFFF";
      c.stroke();
      c.fillStyle = "#FFFFFF";
      c.font = `900 30px ${FONTE}`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(inicialDe(j.nome), 0, 2);
      c.restore();
    } else if (ef.tipo === "luva") {
      const vai = ef.t < ef.dur ? suave(ef.t / ef.dur) : 1 - suave((ef.t - ef.dur) / 0.25);
      if (ef.t > ef.dur + 0.25) return;
      const px = ef.de.x + (ef.alvo.x - ef.de.x) * vai;
      c.save();
      c.translate(px, ef.de.y + (ef.alvo.y - ef.de.y) * vai);
      if (ef.lado > 0) c.scale(-1, 1);
      c.rotate(-0.15);
      Objetos.luva(c, 1.4);
      c.restore();
    } else if (ef.tipo === "bola") {
      let px, py, giro;
      if (ef.t < ef.dur) {
        const e = ef.t / ef.dur;
        px = ef.de.x + (ef.alvo.x - ef.de.x) * e;
        py = ef.de.y + (ef.alvo.y - ef.de.y) * e - Math.sin(e * Math.PI) * 260;
        giro = ef.t * 14;
      } else {
        const u = ef.t - ef.dur;
        if (u > 0.8) return;
        const lado = ef.alvo.x > this.L.x ? 1 : -1;
        px = ef.alvo.x + lado * u * 700;
        py = ef.alvo.y - u * 500 + u * u * 1400;
        giro = ef.t * 20;
        c.globalAlpha = 1 - u / 0.8;
      }
      c.save();
      c.translate(px, py);
      Objetos.bola(c, 1.3, giro);
      c.restore();
      c.globalAlpha = 1;
    } else if (ef.tipo === "chinelo") {
      let px, py, rot;
      if (ef.t < ef.dur) {
        const e = suave(ef.t / ef.dur);
        px = ef.de.x + (ef.alvo.x - ef.de.x) * e;
        py = ef.de.y + (ef.alvo.y - ef.de.y) * e;
        rot = ef.t * 18 * ef.lado;
      } else {
        const u = ef.t - ef.dur;
        if (u > 0.8) return;
        px = ef.alvo.x - ef.lado * u * 240;
        py = ef.alvo.y + u * u * 1600 - u * 200;
        rot = ef.t * 8 * ef.lado;
      }
      c.save();
      c.translate(px, py);
      c.rotate(rot);
      Objetos.chinelo(c, 1.5);
      c.restore();
      if (ef.t >= ef.dur && ef.t < ef.dur + 0.6) this.onomatopeia(c, "PLAFT!", ef.alvo.x, ef.alvo.y - 90, (ef.t - ef.dur) / 0.6, "#FFB23F", 96);
    } else if (ef.tipo === "rojao") {
      for (const f of ef.foguetes) {
        const kk = (ef.t - f.sai) / 0.55;
        if (kk <= 0 || kk >= 1) continue;
        const pos = this.posFoguete(f, kk);
        const prox = this.posFoguete(f, Math.min(1, kk + 0.02));
        c.save();
        c.translate(pos.x, pos.y);
        c.rotate(Math.atan2(prox.y - pos.y, prox.x - pos.x) + Math.PI / 2);
        Objetos.rojao(c, 1.1);
        c.fillStyle = Math.random() < 0.5 ? "#FFD23F" : "#FF7A3A";
        c.beginPath();
        c.moveTo(-10, 40); c.lineTo(10, 40); c.lineTo(0, 70 + Math.random() * 30);
        c.fill();
        c.restore();
      }
      const ultimo = ef.foguetes[ef.foguetes.length - 1];
      if (ultimo.estourou && ef.t < ef.dur + 0.6) this.onomatopeia(c, "BUM!", ef.alvo.x, ef.alvo.y - 110, (ef.t - 1.15) / 0.7, "#FF4A6A", 120);
    }
  },

  /* Chinelo da Mãe: a tela escurece, o chinelo dourado desce do céu. */
  desenharMae(c, ef) {
    const { W, H } = this.L;
    const t = ef.t;
    if (t > ef.dur) return;
    const alvo = this.telaDe(0, this.chefe ? this.chefe.arte.alvo.y : 0);
    if (t < ef.impacto + 0.1) {
      const desce = suave(Math.max(0, (t - 0.35) / (ef.impacto - 0.35)));
      const py = -500 + (alvo.y + 500) * desce;
      c.save();
      c.translate(alvo.x, py);
      const brilho = c.createRadialGradient(0, 0, 0, 0, 0, 520);
      brilho.addColorStop(0, "rgba(255,210,63,.55)");
      brilho.addColorStop(1, "rgba(255,210,63,0)");
      c.fillStyle = brilho;
      c.fillRect(-520, -520, 1040, 1040);
      c.rotate(-0.5 + desce * 0.5);
      Objetos.chinelo(c, W > H ? 3.2 : 4.2, true);
      c.restore();
      const k = Math.min(1, t / 0.3);
      c.save();
      c.translate(W / 2, H * (W > H ? 0.3 : 0.34));
      c.scale(0.6 + suave(k) * 0.4, 0.6 + suave(k) * 0.4);
      c.globalAlpha = k;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.font = `900 ${W > H ? 120 : 136}px ${FONTE}`;
      c.lineWidth = 18;
      c.strokeStyle = TINTA;
      c.lineJoin = "round";
      c.strokeText("A MÃE CHEGOU", 0, 0);
      c.fillStyle = "#FFE066";
      c.fillText("A MÃE CHEGOU", 0, 0);
      c.restore();
    } else {
      const u = (t - ef.impacto) / (ef.dur - ef.impacto);
      this.onomatopeia(c, "PLAAAFT!", alvo.x, alvo.y - 40, u, "#FFE066", W > H ? 170 : 190);
      c.save();
      c.globalCompositeOperation = "lighter";
      c.translate(alvo.x, alvo.y);
      c.rotate(t * 0.6);
      for (let i = 0; i < 12; i++) {
        c.rotate(TAU / 12);
        c.fillStyle = `rgba(255,220,120,${0.16 * (1 - u)})`;
        c.beginPath();
        c.moveTo(0, 0); c.lineTo(-60, -1400); c.lineTo(60, -1400);
        c.fill();
      }
      c.restore();
    }
  },

  onomatopeia(c, texto, x, y, k, cor, tam) {
    if (k < 0 || k > 1) return;
    const pop = k < 0.15 ? 0.5 + k / 0.15 * 0.7 : 1.2 - Math.min(0.2, (k - 0.15) * 0.6);
    c.save();
    c.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    c.translate(x, y);
    c.rotate(-0.12);
    c.scale(pop, pop);
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = `900 ${tam}px ${FONTE}`;
    c.lineJoin = "round";
    c.lineWidth = tam * 0.16;
    c.strokeStyle = TINTA;
    c.strokeText(texto, 0, 0);
    c.fillStyle = cor;
    c.fillText(texto, 0, 0);
    c.restore();
  },

  desenharParticulas(c) {
    for (const p of this.particulas) {
      const k = p.vida / p.max;
      c.save();
      if (p.tipo === "anel") {
        c.globalAlpha = k * 0.8;
        c.strokeStyle = p.cor;
        c.lineWidth = 10 * k + 2;
        c.beginPath();
        c.ellipse(p.x, p.y, p.tam * (1 - k) + 10, (p.tam * (1 - k) + 10) * 0.9, 0, 0, TAU);
        c.stroke();
      } else if (p.tipo === "estrela") {
        c.globalAlpha = k;
        c.translate(p.x, p.y);
        const r = p.tam * (1.3 - k * 0.5);
        c.beginPath();
        for (let i = 0; i < 16; i++) {
          const rr = i % 2 ? r * 0.38 : r;
          c.lineTo(Math.cos(i * Math.PI / 8) * rr, Math.sin(i * Math.PI / 8) * rr);
        }
        c.closePath();
        c.fillStyle = p.cor;
        c.fill();
      } else if (p.tipo === "fumaca") {
        c.globalAlpha = k * 0.8;
        c.fillStyle = p.cor;
        c.beginPath();
        c.arc(p.x, p.y, p.tam * (1.6 - k * 0.6), 0, TAU);
        c.fill();
      } else if (p.tipo === "moeda") {
        c.globalAlpha = Math.min(1, k * 3);
        c.translate(p.x, p.y);
        c.scale(Math.cos(p.rot * 2), 1);
        c.beginPath();
        c.arc(0, 0, p.tam, 0, TAU);
        c.fillStyle = "#FFD23F";
        c.fill();
        c.lineWidth = 3;
        c.strokeStyle = "#B9840C";
        c.stroke();
        c.fillStyle = "#FFF2B0";
        c.fillRect(-p.tam * 0.15, -p.tam * 0.55, p.tam * 0.3, p.tam * 1.1);
      } else if (p.tipo === "confete" || p.tipo === "caco") {
        c.globalAlpha = Math.min(1, k * 3);
        c.translate(p.x, p.y);
        c.rotate(p.rot);
        c.fillStyle = p.cor;
        if (p.tipo === "caco") {
          c.beginPath();
          c.moveTo(0, -p.tam); c.lineTo(p.tam * 0.7, p.tam * 0.6); c.lineTo(-p.tam * 0.6, p.tam * 0.4);
          c.fill();
        } else c.fillRect(-p.tam / 2, -p.tam / 4, p.tam, p.tam / 2);
      } else if (p.tipo === "mais") {
        c.globalAlpha = Math.min(1, k * 2);
        c.fillStyle = p.cor;
        const r = p.tam;
        c.fillRect(p.x - r / 2, p.y - r * 0.15, r, r * 0.3);
        c.fillRect(p.x - r * 0.15, p.y - r / 2, r * 0.3, r);
      } else {
        c.globalAlpha = Math.min(1, k * 2);
        c.fillStyle = p.cor;
        c.beginPath();
        c.arc(p.x, p.y, p.tam * (0.4 + k * 0.6), 0, TAU);
        c.fill();
      }
      c.restore();
    }
  },

  desenharNumeros(c) {
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.lineJoin = "round";
    for (const n of this.numeros) {
      const k = n.t / n.dur;
      const pop = n.t < 0.1 ? 0.4 + n.t / 0.1 * 1.0 : n.t < 0.2 ? 1.4 - (n.t - 0.1) / 0.1 * 0.4 : 1;
      c.save();
      c.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      c.translate(n.x, n.y);
      c.scale(pop, pop);
      c.font = `900 ${n.tam}px ${FONTE}`;
      c.lineWidth = Math.max(6, n.tam * 0.16);
      c.strokeStyle = TINTA;
      c.strokeText(n.texto, 0, 0);
      c.fillStyle = n.cor;
      c.fillText(n.texto, 0, 0);
      if (n.rotulo) {
        c.font = `900 ${Math.round(n.tam * 0.42)}px ${FONTE}`;
        c.lineWidth = 8;
        c.strokeText(n.rotulo, 0, -n.tam * 0.72);
        c.fillStyle = n.cor;
        c.fillText(n.rotulo, 0, -n.tam * 0.72);
      }
      if (n.nome) {
        c.font = `800 ${Math.round(Math.min(40, n.tam * 0.34))}px 'Figtree', sans-serif`;
        const nome = encurtar(c, n.nome, 380);
        c.lineWidth = 8;
        c.strokeText(nome, 0, n.tam * 0.66);
        c.fillStyle = "#FFFFFF";
        c.fillText(nome, 0, n.tam * 0.66);
      }
      c.restore();
    }
  },

  /* Ícone de cada faixa pro cardápio (canvas pequeno). */
  icone(cv, golpe) {
    const c = cv.getContext("2d");
    c.clearRect(0, 0, cv.width, cv.height);
    c.save();
    c.translate(cv.width / 2, cv.height / 2);
    const s = cv.width / 160;
    if (golpe === "peteleco") { c.rotate(-0.3); Objetos.luva(c, s * 0.95); }
    else if (golpe === "bicuda") Objetos.bola(c, s * 1.25, 0.3);
    else if (golpe === "chinelada") { c.rotate(0.5); Objetos.chinelo(c, s * 0.62); }
    else if (golpe === "rojao") { c.rotate(0.5); c.translate(0, -10 * s); Objetos.rojao(c, s * 0.68); }
    else { c.rotate(-0.5); c.shadowColor = "#FFD23F"; c.shadowBlur = 16; Objetos.chinelo(c, s * 0.62, true); }
    c.restore();
  },
};

/* Corta o texto com reticências pra caber em `max` px (nome comprido com emoji). */
function encurtar(c, texto, max) {
  if (c.measureText(texto).width <= max) return texto;
  const letras = [...texto];
  while (letras.length > 1 && c.measureText(letras.join("") + "…").width > max) letras.pop();
  return letras.join("") + "…";
}
