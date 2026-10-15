/* As duas urnas no canvas da mesa: o desenho da urna brasileira e a mão que
   digita o número do lado (1-3 / 2-2) e aperta CONFIRMA a cada voto. A urna
   é desenhada em unidades próprias (corpo 1000×760) e escalada pro espaço
   do formato. */
"use strict";

const TECLA_MOVE = 150;
const TECLA_APERTA = 120;
const TECLA_PASSO = TECLA_MOVE + TECLA_APERTA + 40;
const FIM_MS = 700;
/* A mão sobe de baixo da urna antes da primeira tecla. */
const SUBIDA_MS = 240;
const MAO = 0.55;
/* Rajada de presentes não pode deixar a mão minutos digitando: o resto
   conta no placar, só não anima. */
const FILA_MAX = 3;

const CORES_TECLA = {
  BRANCO: { fundo: "#F4F4F0", fundo2: "#D9D9D2", texto: "#1B1B1B" },
  CORRIGE: { fundo: "#F28C28", fundo2: "#C76A12", texto: "#1B1B1B" },
  CONFIRMA: { fundo: "#2BA84A", fundo2: "#1B7C33", texto: "#0E2A15" },
};

function arred(c, x, y, w, h, r) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

function suave(t) { return t < 0 ? 0 : t > 1 ? 1 : 1 - Math.pow(1 - t, 3); }

/* Confete simples em canvas (urna em massa e tela de eleito). */
class Confete {
  constructor() { this.pedacos = []; }

  soltar(x, y, n, cores, { espalha = 400, forca = 900, largura = 0 } = {}) {
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const v = forca * (0.45 + Math.random() * 0.75);
      this.pedacos.push({
        x: x + (Math.random() - 0.5) * largura, y,
        vx: Math.cos(ang) * v * (espalha / 400), vy: Math.sin(ang) * v,
        g: 1500 + Math.random() * 500, r: Math.random() * 6, vr: (Math.random() - 0.5) * 14,
        w: 10 + Math.random() * 12, h: 6 + Math.random() * 8, cor: cores[i % cores.length],
        vida: 2.6 + Math.random() * 1.4, t: 0, fase: Math.random() * 6,
      });
    }
  }

  quadro(c, dt) {
    const vivos = [];
    for (const p of this.pedacos) {
      p.t += dt;
      if (p.t > p.vida) continue;
      p.vx *= 1 - 1.4 * dt;
      p.vy = Math.min(p.vy + p.g * dt, 520);
      p.x += (p.vx + Math.sin(p.t * 6 + p.fase) * 60) * dt;
      p.y += p.vy * dt;
      p.r += p.vr * dt;
      c.save();
      c.globalAlpha = Math.min(1, (p.vida - p.t) * 2);
      c.translate(p.x, p.y);
      c.rotate(p.r);
      c.scale(1, Math.cos(p.t * 9 + p.fase));
      c.fillStyle = p.cor;
      c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      c.restore();
      vivos.push(p);
    }
    this.pedacos = vivos;
  }
}

/* Posição de cada tecla no corpo da urna (unidades da urna). */
function mapaDeTeclas() {
  const teclas = {};
  const w = 96, h = 92, gx = 14, gy = 16, x0 = 652, y0 = 104;
  const numeros = ["1", "2", "3", "4", "5", "6", "7", "8", "9", null, "0", null];
  numeros.forEach((n, i) => {
    if (!n) return;
    const col = i % 3, lin = Math.floor(i / 3);
    teclas[n] = { x: x0 + col * (w + gx), y: y0 + lin * (h + gy), w, h, rotulo: n };
  });
  teclas.BRANCO = { x: 646, y: 552, w: 100, h: 92, rotulo: "BRANCO", cor: CORES_TECLA.BRANCO };
  teclas.CORRIGE = { x: 752, y: 552, w: 100, h: 92, rotulo: "CORRIGE", cor: CORES_TECLA.CORRIGE };
  teclas.CONFIRMA = { x: 858, y: 536, w: 116, h: 124, rotulo: "CONFIRMA", cor: CORES_TECLA.CONFIRMA };
  return teclas;
}

const TECLAS = mapaDeTeclas();
const LAYOUTS_MESA = {
  vertical: { W: 1080, H: 540, escala: 0.514, urnas: [{ x: 14, y: 22 }, { x: 552, y: 22 }] },
  horizontal: { W: 1000, H: 440, escala: 0.47, urnas: [{ x: 20, y: 20 }, { x: 510, y: 20 }] },
};

const Urnas = {
  canvas: null,
  c: null,
  L: LAYOUTS_MESA.vertical,
  k: 1,
  estados: [],
  confete: new Confete(),
  ultimo: 0,

  montar(canvas, candidatos, artes) {
    this.canvas = canvas;
    this.c = canvas.getContext("2d");
    this.candidatos = candidatos;
    this.estados = candidatos.map((cand, lado) => {
      const img = new Image();
      img.src = (artes && artes[lado]) || cand.arte;
      return {
        lado, cand, img, digitos: cand.numero.split(""),
        fila: [], atual: null, tela: "pronta", digitado: 0, fimAte: 0, fimVotos: 0,
        treme: 0, brilho: 0, acesas: {}, mao: { x: 810, y: 2000, escala: 1.08, aperto: 0 },
      };
    });
  },

  formato(nome) {
    this.L = LAYOUTS_MESA[nome] || LAYOUTS_MESA.vertical;
    this.canvas.style.width = `${this.L.W}px`;
    this.canvas.style.height = `${this.L.H}px`;
  },

  dimensionar(escalaPalco) {
    const k = Math.max(0.25, escalaPalco) * Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.L.W * k);
    this.canvas.height = Math.round(this.L.H * k);
    this.k = k;
  },

  /* Ponto do alto da tela da urna, em px do canvas: de onde sai a bolha. */
  centro(lado) {
    const u = this.L.urnas[lado];
    const s = this.L.escala;
    return { x: u.x + 300 * s, y: u.y + 60 * s };
  },

  votar(lado, { massa = false, votos = 1, presente = false } = {}) {
    const e = this.estados[lado];
    if (!e) return;
    if (massa) {
      e.treme = performance.now() + 600;
      e.brilho = performance.now() + 1400;
      const u = this.L.urnas[lado];
      const s = this.L.escala;
      this.confete.soltar(u.x + 500 * s, u.y + 10 * s, 90, [e.cand.cor, "#FFD400", "#FFFFFF", e.cand.cor], { espalha: 260, forca: 820, largura: 380 * s });
    }
    const pedido = { votos, massa, presente };
    if (e.fila.length >= FILA_MAX) {
      /* Fila cheia: presente toma o lugar de um voto de comentário. */
      const i = presente ? e.fila.findIndex(x => !x.presente) : -1;
      if (i < 0) { if (e.atual) e.atual.votos += votos; return; }
      e.fila.splice(i, 1);
    }
    e.fila.push(pedido);
  },

  zerar() {
    for (const e of this.estados) { e.fila = []; e.atual = null; e.tela = "pronta"; e.acesas = {}; }
  },

  quadro(t) {
    if (!this.c) return;
    const dt = Math.min(0.05, (t - (this.ultimo || t)) / 1000);
    this.ultimo = t;
    const c = this.c;
    c.setTransform(this.k, 0, 0, this.k, 0, 0);
    c.clearRect(0, 0, this.L.W, this.L.H);
    for (const e of this.estados) {
      this.animar(e, t);
      this.desenharUrna(c, e, t);
    }
    for (const e of this.estados) this.desenharMao(c, e, t);
    this.confete.quadro(c, dt);
  },

  /* ───────────── animação da digitação ───────────── */

  animar(e, t) {
    if (!e.atual && e.fila.length) {
      const rapido = e.fila.length > 1 ? 0.72 : 1;
      e.atual = { ...e.fila.shift(), inicio: t, r: rapido, alvos: [...e.digitos, "CONFIRMA"], tocou: {}, deX: e.mao.x, deY: e.mao.y };
      e.tela = "digitando";
      e.digitado = 0;
    }
    const descanso = this.descanso(e);
    const a = e.atual;
    e.acesas = {};
    if (!a) {
      e.mao.x += (descanso.x - e.mao.x) * 0.12;
      e.mao.y += (descanso.y - e.mao.y) * 0.12;
      e.mao.escala += (1.08 - e.mao.escala) * 0.12;
      e.mao.aperto = 0;
      if (e.tela === "fim" && t > e.fimAte) e.tela = "pronta";
      return;
    }
    const passo = TECLA_PASSO * a.r;
    const move = TECLA_MOVE * a.r;
    const aperta = TECLA_APERTA * a.r;
    const subida = SUBIDA_MS * a.r;
    if (t - a.inicio < subida) {
      const alvo = this.pontoDaTecla(a.alvos[0]);
      const m = suave((t - a.inicio) / subida);
      e.mao.x = a.deX + (alvo.x - a.deX) * m;
      e.mao.y = a.deY + (alvo.y - a.deY) * m;
      e.mao.escala = 1.08;
      e.mao.aperto = 0;
      return;
    }
    const dec = t - a.inicio - subida;
    const i = Math.min(a.alvos.length - 1, Math.floor(dec / passo));
    const local = dec - i * passo;
    const alvo = this.pontoDaTecla(a.alvos[i]);
    const de = this.pontoDaTecla(a.alvos[Math.max(0, i - 1)]);

    if (dec < a.alvos.length * passo) {
      const m = suave(local / move);
      e.mao.x = de.x + (alvo.x - de.x) * m;
      e.mao.y = de.y + (alvo.y - de.y) * m - Math.sin(m * Math.PI) * 30;
      const p = local < move ? 0 : Math.sin(Math.min(1, (local - move) / aperta) * Math.PI);
      e.mao.aperto = p;
      e.mao.escala = 1.08 - 0.1 * p;
      if (local >= move && local < move + aperta) {
        e.acesas[a.alvos[i]] = p;
        if (!a.tocou[i]) {
          a.tocou[i] = true;
          if (a.alvos[i] === "CONFIRMA") Vozes.efeito("urna-confirma");
          else { Vozes.efeito("tecla", 0.7); e.digitado = i + 1; }
        }
      }
      return;
    }
    if (e.tela !== "fim") {
      e.tela = "fim";
      e.fimAte = t + FIM_MS * a.r;
      e.fimVotos = a.votos;
      e.fimMassa = a.massa;
      e.flash = t;
    }
    const volta = suave((dec - a.alvos.length * passo) / (FIM_MS * a.r));
    e.mao.x += (descanso.x - e.mao.x) * volta * 0.3;
    e.mao.y += (descanso.y - e.mao.y) * volta * 0.3;
    e.mao.escala = 1.08;
    e.mao.aperto = 0;
    if (t > e.fimAte) e.atual = null;
  },

  /* Parada: escondida abaixo da borda do canvas. */
  descanso(e) {
    const u = this.L.urnas[e.lado];
    return { x: 810, y: (this.L.H - u.y) / this.L.escala + 160 };
  },

  pontoDaTecla(nome) {
    const k = TECLAS[nome];
    return { x: k.x + k.w / 2, y: k.y + k.h / 2 + 4 };
  },

  /* ───────────── desenho ───────────── */

  desenharUrna(c, e, t) {
    const u = this.L.urnas[e.lado];
    const s = this.L.escala;
    let dx = 0;
    if (t < e.treme) dx = Math.sin(t / 18) * 14 * ((e.treme - t) / 600);
    c.save();
    c.translate(u.x + dx * s, u.y);
    c.scale(s, s);

    if (t < e.brilho) {
      c.save();
      c.globalAlpha = Math.min(1, (e.brilho - t) / 700);
      c.shadowColor = e.cand.cor;
      c.shadowBlur = 90;
      arred(c, 0, 0, 1000, 760, 48);
      c.fillStyle = e.cand.cor;
      c.fill();
      c.restore();
    }

    /* Sombra no chão em degradê: filter blur por quadro pesa no celular. */
    c.save();
    c.translate(500, 776);
    c.scale(1, 0.08);
    const chao = c.createRadialGradient(0, 0, 0, 0, 0, 560);
    chao.addColorStop(0, "rgba(0,0,0,.5)");
    chao.addColorStop(0.75, "rgba(0,0,0,.3)");
    chao.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = chao;
    c.beginPath();
    c.arc(0, 0, 560, 0, Math.PI * 2);
    c.fill();
    c.restore();

    arred(c, 0, 0, 1000, 772, 52);
    c.fillStyle = "#A99E86";
    c.fill();
    const corpo = c.createLinearGradient(0, 0, 0, 750);
    corpo.addColorStop(0, "#FBF7EE");
    corpo.addColorStop(0.55, "#EAE2D0");
    corpo.addColorStop(1, "#D3C9B2");
    arred(c, 0, 0, 1000, 750, 52);
    c.fillStyle = corpo;
    c.fill();
    c.lineWidth = 3;
    c.strokeStyle = "rgba(255,255,255,.7)";
    arred(c, 6, 6, 988, 738, 48);
    c.stroke();

    c.fillStyle = "#6E6654";
    c.font = "800 26px Figtree, sans-serif";
    c.textAlign = "center";
    c.fillText("DISPUTA FICCIONAL", 812, 62);

    this.desenharTela(c, e, t);
    this.desenharTeclado(c, e);
    c.restore();
  },

  desenharTela(c, e, t) {
    arred(c, 24, 24, 600, 712, 30);
    c.fillStyle = "#2A2E36";
    c.fill();
    arred(c, 32, 32, 584, 696, 26);
    c.strokeStyle = "#454B57";
    c.lineWidth = 3;
    c.stroke();

    const X = 46, Y = 46, W = 556, H = 668;
    const lcd = c.createLinearGradient(0, Y, 0, Y + H);
    lcd.addColorStop(0, "#FFFFFF");
    lcd.addColorStop(1, "#ECEEE8");
    arred(c, X, Y, W, H, 10);
    c.fillStyle = lcd;
    c.fill();
    c.save();
    arred(c, X, Y, W, H, 10);
    c.clip();

    const cor = e.cand.cor;
    if (e.tela === "fim") {
      const f = Math.max(0, 1 - (t - e.flash) / 260);
      if (f > 0) { c.fillStyle = `rgba(255,212,0,${f * 0.55})`; c.fillRect(X, Y, W, H); }
      const pulo = 1 + 0.25 * Math.max(0, 1 - (t - e.flash) / 220);
      c.save();
      c.translate(X + W / 2, Y + 290);
      c.scale(pulo, pulo);
      c.fillStyle = "#111";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.font = "900 270px 'Big Shoulders Display', Impact, sans-serif";
      c.fillText("FIM", 0, 0);
      c.restore();
      c.fillStyle = cor;
      c.textAlign = "center";
      c.font = "900 92px 'Big Shoulders Display', Impact, sans-serif";
      const v = Math.round(e.fimVotos);
      c.fillText(`+${v.toLocaleString("pt-BR")} ${v === 1 ? "PONTO" : "PONTOS"}`, X + W / 2, Y + 590);
      c.restore();
      return;
    }

    c.textAlign = "left";
    c.textBaseline = "alphabetic";
    c.fillStyle = "#3A3A3A";
    c.font = "800 40px Figtree, sans-serif";
    c.fillText("SEU APOIO PARA", X + 22, Y + 56);
    c.fillStyle = "#111";
    c.font = "900 92px 'Big Shoulders Display', Impact, sans-serif";
    c.fillText("PARTICIPANTE", X + 20, Y + 142);

    const pronto = e.tela === "pronta" || e.digitado >= e.digitos.length;
    c.fillStyle = "#3A3A3A";
    c.font = "800 40px Figtree, sans-serif";
    c.fillText("Número:", X + 22, Y + 260);
    for (let i = 0; i < e.digitos.length; i++) {
      const bx = X + 196 + i * 132, by = Y + 168;
      arred(c, bx, by, 118, 146, 8);
      c.fillStyle = "#FFFFFF";
      c.fill();
      c.lineWidth = 5;
      c.strokeStyle = "#1E1E1E";
      c.stroke();
      const visivel = e.tela === "pronta" || i < e.digitado;
      if (visivel) {
        c.fillStyle = cor;
        c.textAlign = "center";
        c.font = "900 138px 'Big Shoulders Display', Impact, sans-serif";
        c.fillText(e.digitos[i], bx + 59, by + 124);
        c.textAlign = "left";
      } else if (i === e.digitado && Math.floor(t / 260) % 2 === 0) {
        c.fillStyle = "#1E1E1E";
        c.fillRect(bx + 30, by + 120, 58, 8);
      }
    }

    if (pronto) {
      c.fillStyle = "#3A3A3A";
      c.font = "800 40px Figtree, sans-serif";
      c.fillText("Nome:", X + 22, Y + 420);
      c.fillStyle = "#111";
      c.font = "900 84px 'Big Shoulders Display', Impact, sans-serif";
      c.fillText(e.cand.nome.toUpperCase(), X + 22, Y + 498);
      this.desenharRetrato(c, e, X + 446, Y + 420, 88);
    }

    c.fillStyle = "#CFD2CB";
    c.fillRect(X + 18, Y + 532, W - 36, 4);
    const instrucao = (tecla, corTecla, resto, y) => {
      c.font = "900 38px Figtree, sans-serif";
      c.fillStyle = corTecla;
      c.fillText(tecla, X + 22, y);
      const largura = c.measureText(tecla).width;
      c.font = "700 38px Figtree, sans-serif";
      c.fillStyle = "#3A3A3A";
      c.fillText(resto, X + 34 + largura, y);
    };
    instrucao("CONFIRMA", "#1B7C33", "para votar", Y + 588);
    instrucao("CORRIGE", "#C76A12", "para refazer", Y + 640);
    c.restore();
  },

  desenharRetrato(c, e, cx, cy, r) {
    c.save();
    c.beginPath();
    c.arc(cx, cy, r + 7, 0, Math.PI * 2);
    c.fillStyle = e.cand.cor;
    c.fill();
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    const fundo = c.createRadialGradient(cx, cy - r * 0.3, 4, cx, cy, r);
    fundo.addColorStop(0, "#FFFFFF");
    fundo.addColorStop(1, "#DDE3EE");
    c.fillStyle = fundo;
    c.fill();
    c.clip();
    const img = e.img;
    if (img.complete && img.naturalWidth) {
      const lado = img.naturalWidth * 0.62;
      const sx = img.naturalWidth * 0.19, sy = img.naturalHeight * 0.0;
      c.drawImage(img, sx, sy, lado, lado, cx - r, cy - r * 0.92, r * 2, r * 2);
    }
    c.restore();
  },

  desenharTeclado(c, e) {
    arred(c, 634, 84, 350, 600, 24);
    const painel = c.createLinearGradient(0, 84, 0, 684);
    painel.addColorStop(0, "#3B3F48");
    painel.addColorStop(1, "#24272E");
    c.fillStyle = painel;
    c.fill();
    c.strokeStyle = "rgba(0,0,0,.5)";
    c.lineWidth = 3;
    c.stroke();

    for (const [nome, k] of Object.entries(TECLAS)) {
      const aceso = e.acesas[nome] || 0;
      const fundo = k.cor ? k.cor.fundo : "#16171B";
      const fundo2 = k.cor ? k.cor.fundo2 : "#050506";
      const afunda = aceso * 6;
      arred(c, k.x, k.y + 6, k.w, k.h, 10);
      c.fillStyle = fundo2;
      c.fill();
      if (aceso > 0) {
        c.save();
        c.shadowColor = k.cor ? k.cor.fundo : e.cand.cor;
        c.shadowBlur = 40 * aceso;
        arred(c, k.x, k.y + afunda, k.w, k.h, 10);
        c.fillStyle = k.cor ? k.cor.fundo : e.cand.cor;
        c.fill();
        c.restore();
      }
      arred(c, k.x, k.y + afunda, k.w, k.h, 10);
      const g = c.createLinearGradient(0, k.y, 0, k.y + k.h);
      g.addColorStop(0, k.cor ? fundo : "#2C2E35");
      g.addColorStop(1, fundo);
      c.fillStyle = aceso > 0 && !k.cor ? mistura("#2C2E35", e.cand.cor, aceso) : g;
      c.fill();
      c.textAlign = "center";
      c.textBaseline = "middle";
      if (k.cor) {
        c.fillStyle = k.cor.texto;
        c.font = "900 20px Figtree, sans-serif";
        c.fillText(k.rotulo, k.x + k.w / 2, k.y + afunda + k.h / 2 + 1, k.w - 8);
      } else {
        c.fillStyle = "#FFFFFF";
        c.font = "800 64px 'Big Shoulders Display', Impact, sans-serif";
        c.fillText(k.rotulo, k.x + k.w / 2, k.y + afunda + k.h / 2 + 4);
      }
      c.textBaseline = "alphabetic";
    }
  },

  /* Mão de desenho com o indicador esticado; a manga é da cor do lado e
     desce até sair do canvas, então a mão parece subir de baixo da urna. */
  desenharMao(c, e, t) {
    const u = this.L.urnas[e.lado];
    const s = this.L.escala;
    const m = e.mao;
    if (m.y > (this.L.H - u.y) / s + 20) return;
    let dx = 0;
    if (t < e.treme) dx = Math.sin(t / 18) * 14 * ((e.treme - t) / 600);
    c.save();
    c.translate(u.x + dx * s, u.y);
    c.scale(s, s);
    c.translate(m.x, m.y);
    c.rotate(e.lado === 0 ? 0.06 : 0.12);
    c.scale(MAO, MAO);

    const altura = (m.escala - 0.98) * 260;
    c.save();
    c.translate(18 + altura * 0.4, 26 + altura * 0.6);
    c.globalAlpha = 0.22;
    this.silhuetaMao(c, "#000", "#000", "#000");
    c.restore();

    c.scale(m.escala, m.escala);
    this.silhuetaMao(c, "#F6C6A0", "#B97A52", e.cand.cor);
    c.restore();
  },

  silhuetaMao(c, pele, contorno, manga) {
    const sombra = pele === "#000";
    c.lineJoin = "round";
    c.lineWidth = 7;
    c.strokeStyle = sombra ? "#000" : "#2A1A12";

    /* manga + punho */
    c.beginPath();
    c.roundRect(-8, 248, 214, 1400, 40);
    c.fillStyle = manga;
    c.fill();
    if (!sombra) {
      c.stroke();
      c.fillStyle = "rgba(0,0,0,.16)";
      c.fillRect(150, 300, 50, 1340);
      c.beginPath();
      c.roundRect(-14, 236, 226, 56, 18);
      c.fillStyle = "#FFFFFF";
      c.fill();
      c.stroke();
    }

    /* punho fechado */
    c.beginPath();
    c.roundRect(-40, 118, 210, 140, 58);
    c.fillStyle = pele;
    c.fill();
    if (!sombra) c.stroke();

    /* dedos dobrados */
    if (!sombra) {
      c.strokeStyle = contorno;
      c.lineWidth = 6;
      for (const x of [62, 104, 140]) {
        c.beginPath();
        c.moveTo(x, 132);
        c.quadraticCurveTo(x + 6, 166, x - 2, 198);
        c.stroke();
      }
      c.strokeStyle = "#2A1A12";
      c.lineWidth = 7;
    }

    /* indicador */
    c.beginPath();
    c.roundRect(-30, -6, 62, 196, 31);
    c.fillStyle = pele;
    c.fill();
    if (!sombra) {
      c.stroke();
      c.strokeStyle = contorno;
      c.lineWidth = 5;
      for (const y of [74, 118]) {
        c.beginPath();
        c.moveTo(-14, y);
        c.quadraticCurveTo(0, y + 6, 14, y);
        c.stroke();
      }
      c.beginPath();
      c.roundRect(-18, 4, 36, 36, 14);
      c.fillStyle = "#FBDCC4";
      c.fill();
      c.lineWidth = 7;
      c.strokeStyle = "#2A1A12";
    }

    /* polegar por cima do punho */
    c.beginPath();
    c.ellipse(4, 214, 70, 30, -0.35, 0, Math.PI * 2);
    c.fillStyle = pele;
    c.fill();
    if (!sombra) {
      c.stroke();
      c.fillStyle = "rgba(255,255,255,.35)";
      c.beginPath();
      c.ellipse(-10, 132, 26, 10, -0.5, 0, Math.PI * 2);
      c.fill();
    }
  },
};

function mistura(a, b, f) {
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * f)).join(",")})`;
}

window.Urnas = Urnas;
window.Confete = Confete;
