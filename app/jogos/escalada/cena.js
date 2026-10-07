/* Cena em canvas: céu que muda com a altura, praia, coqueiro sem fim, o Zé
   e os efeitos dos presentes. Não decide nada: recebe o estado da regra e os
   acontecimentos, e desenha.

   Unidade: px do palco (1080×1920 ou 1920×1080). Altura do mundo em metros,
   PX px por metro. A altura mostrada (`vis`) corre atrás da altura da regra:
   sobe macio, cai rápido. */
"use strict";

const PX = 60;
const LAYOUTS = {
  vertical: { W: 1080, H: 1920, x: 540, refY: 990, chaoMax: 1380, horizonte: 1040 },
  horizontal: { W: 1920, H: 1080, x: 960, refY: 700, chaoMax: 960, horizonte: 640 },
};
/* Pé até o quadril do Zé, em metros: a câmera mira o quadril. */
const QUADRIL = 2.05;
/* Escala do desenho do Zé (ze.js) na cena. */
const ZE_ESCALA = 1.2;

const CEU = [
  [0, "#2C2D78", "#DD6A7E", "#FFB45E"],
  [250, "#2A3383", "#D27290", "#FFBE78"],
  [800, "#1D2870", "#6C68AE", "#F0A07E"],
  [1700, "#0F1648", "#33357A", "#7C5C92"],
  [3000, "#050822", "#121640", "#2A2A5E"],
  [5000, "#010208", "#04061A", "#0B1030"],
];

function rgb(h) { return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); }
function mistura(a, b, t) {
  const x = rgb(a), y = rgb(b);
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
}
function rgba(h, a) { const [r, g, b] = rgb(h); return `rgba(${r},${g},${b},${a})`; }
const lim = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const suave = t => t * t * (3 - 2 * t);
const saida = t => 1 - Math.pow(1 - t, 3);

/* Sorteio fixo (cenário não pode mudar de um quadro pro outro). */
function semeado(s) {
  let a = s >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ───────────────────────── peças desenhadas ───────────────────────── */

const Desenho = {
  /* Folha de coqueiro: nervura curva com folíolos caindo pros dois lados. */
  folha(c, x, y, ang, comp, curva, cor, corEscura) {
    const ex = x + Math.cos(ang) * comp, ey = y + Math.sin(ang) * comp + curva;
    const cx = x + Math.cos(ang) * comp * 0.5, cy = y + Math.sin(ang) * comp * 0.5 - comp * 0.18;
    const ponto = t => [
      (1 - t) * (1 - t) * x + 2 * (1 - t) * t * cx + t * t * ex,
      (1 - t) * (1 - t) * y + 2 * (1 - t) * t * cy + t * t * ey,
    ];
    c.lineCap = "round";
    for (let i = 2; i <= 26; i++) {
      const t = i / 27;
      const [px, py] = ponto(t);
      const [qx, qy] = ponto(Math.min(1, t + 0.02));
      const dir = Math.atan2(qy - py, qx - px);
      const tam = comp * 0.24 * Math.sin(Math.PI * Math.min(1, t * 1.15)) + 4;
      c.lineWidth = 5 * (1 - t) + 2;
      for (const lado of [-1, 1]) {
        const a = dir + lado * 1.05 + 0.45;
        c.strokeStyle = lado < 0 ? corEscura : cor;
        c.beginPath();
        c.moveTo(px, py);
        c.lineTo(px + Math.cos(a) * tam, py + Math.sin(a) * tam);
        c.stroke();
      }
    }
    c.strokeStyle = corEscura;
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(x, y);
    c.quadraticCurveTo(cx, cy, ex, ey);
    c.stroke();
  },

  coco(c, x, y, r, verde = false) {
    const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    if (verde) { g.addColorStop(0, "#9BD15A"); g.addColorStop(1, "#3F7A22"); }
    else { g.addColorStop(0, "#A7703F"); g.addColorStop(1, "#4E2E17"); }
    c.fillStyle = g;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  },

  copa(c, x, y, escala, t, balanco = 0) {
    const verde = "#3E9B3A", escuro = "#22612A";
    const angulos = [-2.9, -2.45, -2.0, -1.55, -1.1, -0.65, -0.2, 0.25, 3.4];
    angulos.forEach((a, i) => {
      const mexe = Math.sin(t * 1.6 + i) * 0.04 + balanco * Math.sin(t * 6 + i) * 0.12;
      const comp = (150 + (i % 3) * 22) * escala;
      Desenho.folha(c, x, y, a + mexe, comp, comp * 0.42, i % 2 ? verde : "#4DAE45", escuro);
    });
    for (let i = 0; i < 4; i++) Desenho.coco(c, x - 22 * escala + i * 15 * escala, y + 14 * escala + (i % 2) * 9 * escala, 13 * escala, i === 1);
  },

  escada(c, x, yTopo, yBase, desloc) {
    c.strokeStyle = "#8A5A2B"; c.lineWidth = 10; c.lineCap = "round";
    c.beginPath(); c.moveTo(x - 30, yBase); c.lineTo(x - 22, yTopo); c.moveTo(x + 30, yBase); c.lineTo(x + 22, yTopo); c.stroke();
    c.strokeStyle = "#B07A3E"; c.lineWidth = 7;
    for (let y = yBase - (desloc % 46); y > yTopo; y -= 46) {
      const k = (yBase - y) / (yBase - yTopo);
      c.beginPath(); c.moveTo(x - 30 + 8 * k, y); c.lineTo(x + 30 - 8 * k, y); c.stroke();
    }
  },

  asaDelta(c, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.fillStyle = "#FF5A36";
    c.beginPath(); c.moveTo(0, -40); c.lineTo(-170, 30); c.lineTo(0, 10); c.closePath(); c.fill();
    c.fillStyle = "#1E6FD9";
    c.beginPath(); c.moveTo(0, -40); c.lineTo(170, 30); c.lineTo(0, 10); c.closePath(); c.fill();
    c.fillStyle = "#F2C230";
    c.beginPath(); c.moveTo(0, -40); c.lineTo(-60, 4); c.lineTo(0, 10); c.lineTo(60, 4); c.closePath(); c.fill();
    c.strokeStyle = "#222"; c.lineWidth = 3;
    c.beginPath(); c.moveTo(0, 10); c.lineTo(-30, 80); c.lineTo(30, 80); c.closePath(); c.stroke();
    c.restore();
  },

  foguete(c, x, y, s, t) {
    c.save(); c.translate(x, y); c.scale(s, s);
    const chama = 40 + Math.sin(t * 50) * 10;
    const g = c.createLinearGradient(0, 60, 0, 60 + chama * 2);
    g.addColorStop(0, "#FFF4B0"); g.addColorStop(0.4, "#FFA62B"); g.addColorStop(1, "rgba(255,70,30,0)");
    c.fillStyle = g;
    c.beginPath(); c.moveTo(-18, 58); c.quadraticCurveTo(0, 60 + chama * 2.2, 18, 58); c.closePath(); c.fill();
    c.fillStyle = "#C9302C";
    c.beginPath(); c.moveTo(-26, 60); c.lineTo(-40, 76); c.lineTo(-20, 40); c.closePath(); c.moveTo(26, 60); c.lineTo(40, 76); c.lineTo(20, 40); c.closePath(); c.fill();
    c.fillStyle = "#F4F1EA";
    c.beginPath(); c.moveTo(-22, 60); c.lineTo(-22, -40); c.quadraticCurveTo(0, -96, 22, -40); c.lineTo(22, 60); c.closePath(); c.fill();
    c.fillStyle = "#C9302C";
    c.beginPath(); c.moveTo(-22, -40); c.quadraticCurveTo(0, -96, 22, -40); c.closePath(); c.fill();
    c.fillStyle = "#1E6FD9"; c.beginPath(); c.arc(0, -8, 10, 0, Math.PI * 2); c.fill();
    c.fillStyle = "rgba(0,0,0,0.12)"; c.fillRect(6, -40, 16, 100);
    c.restore();
  },

  sagui(c, x, y, s, t) {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.strokeStyle = "#5A5048"; c.lineWidth = 7; c.lineCap = "round";
    c.beginPath(); c.moveTo(6, 10);
    for (let k = 0; k < 8; k++) c.lineTo(14 + k * 4 + Math.sin(t * 6 + k) * 3, 18 + k * 9);
    c.stroke();
    c.strokeStyle = "#2E2924"; c.lineWidth = 7; c.setLineDash([6, 6]);
    c.beginPath(); c.moveTo(6, 10);
    for (let k = 0; k < 8; k++) c.lineTo(14 + k * 4 + Math.sin(t * 6 + k) * 3, 18 + k * 9);
    c.stroke(); c.setLineDash([]);
    c.fillStyle = "#6E655C";
    c.beginPath(); c.ellipse(0, 0, 16, 22, 0.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#3A332D";
    c.beginPath(); c.arc(-2, -26, 13, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#F4F1EA";
    c.beginPath(); c.ellipse(-16, -30, 9, 6, -0.5, 0, Math.PI * 2); c.ellipse(12, -30, 9, 6, 0.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#C9B79F"; c.beginPath(); c.ellipse(-2, -22, 7, 6, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#111"; c.beginPath(); c.arc(-6, -28, 2.4, 0, Math.PI * 2); c.arc(2, -28, 2.4, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "#5A5048"; c.lineWidth = 6;
    c.beginPath(); c.moveTo(-10, -6); c.lineTo(-22, -26); c.stroke();
    c.restore();
  },

  urubu(c, x, y, s, t) {
    c.save(); c.translate(x, y); c.scale(s, s);
    const bate = Math.sin(t * 14) * 0.5;
    c.fillStyle = "#15120F";
    for (const lado of [-1, 1]) {
      c.save(); c.scale(lado, 1); c.rotate(bate * 0.6);
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(80, -50, 150, -10);
      for (let k = 0; k < 5; k++) c.lineTo(150 - k * 18, 2 + (k % 2) * 10);
      c.quadraticCurveTo(50, 20, 0, 18); c.closePath(); c.fill();
      c.restore();
    }
    c.beginPath(); c.ellipse(0, 10, 26, 36, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#6F6A66"; c.beginPath(); c.arc(0, -30, 13, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#DCD3C2"; c.beginPath(); c.moveTo(-4, -22); c.lineTo(4, -22); c.lineTo(0, -8); c.closePath(); c.fill();
    c.restore();
  },

  bronzeador(c, x, y, s, ang) {
    c.save(); c.translate(x, y); c.rotate(ang); c.scale(s, s);
    c.fillStyle = "#FF8A1E";
    c.beginPath(); c.roundRect ? c.roundRect(-24, -50, 48, 92, 12) : c.rect(-24, -50, 48, 92); c.fill();
    c.fillStyle = "#FFF1D6"; c.fillRect(-18, -22, 36, 34);
    c.fillStyle = "#FF8A1E"; c.beginPath(); c.arc(0, -5, 9, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#2B2B2B"; c.fillRect(-10, -66, 20, 18);
    c.restore();
  },

  aviao(c, x, y, s, dir) {
    c.save(); c.translate(x, y); c.scale(s * dir, s);
    c.fillStyle = "#E9EEF5";
    c.beginPath(); c.ellipse(0, 0, 70, 11, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(-10, 0); c.lineTo(-34, 40); c.lineTo(-20, 40); c.lineTo(18, 2); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(-54, -2); c.lineTo(-70, -30); c.lineTo(-60, -30); c.lineTo(-40, -4); c.closePath(); c.fill();
    c.fillStyle = "#9FB2C8"; c.fillRect(-40, -3, 90, 3);
    c.restore();
  },

  /* ─── céu alto: do que se vê a partir de ~2 km ─── */

  satelite(c, s) {
    c.save(); c.scale(s, s);
    c.fillStyle = "#2A4E8C";
    for (const lado of [-1, 1]) {
      c.fillRect(lado > 0 ? 22 : -82, -14, 60, 28);
      c.strokeStyle = "#7FA6E0"; c.lineWidth = 1.5;
      for (let i = 1; i < 4; i++) { const x = (lado > 0 ? 22 : -82) + i * 15; c.beginPath(); c.moveTo(x, -14); c.lineTo(x, 14); c.stroke(); }
      c.beginPath(); c.moveTo(lado > 0 ? 22 : -82, 0); c.lineTo(lado > 0 ? 82 : -22, 0); c.stroke();
    }
    c.fillStyle = "#D9DDE6"; c.fillRect(-22, -18, 44, 36);
    c.fillStyle = "#E8B54A"; c.fillRect(-22, -18, 44, 10);
    c.strokeStyle = "#D9DDE6"; c.lineWidth = 3;
    c.beginPath(); c.moveTo(0, 18); c.lineTo(0, 34); c.stroke();
    c.beginPath(); c.arc(0, 40, 10, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
    c.restore();
  },

  estacao(c, s) {
    c.save(); c.scale(s, s);
    c.fillStyle = "#C9883A";
    for (const x of [-170, -120, 90, 140]) { c.fillRect(x, -60, 34, 120); }
    c.strokeStyle = "rgba(255,230,180,0.5)"; c.lineWidth = 1;
    for (const x of [-170, -120, 90, 140]) for (let y = -48; y < 60; y += 12) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + 34, y); c.stroke(); }
    c.fillStyle = "#B8BFCC"; c.fillRect(-176, -4, 352, 8);
    c.fillStyle = "#E6E9EF";
    c.beginPath(); c.roundRect(-60, -16, 120, 32, 14); c.fill();
    c.beginPath(); c.roundRect(-14, -50, 28, 100, 12); c.fill();
    c.fillStyle = "#9AA3B5"; c.fillRect(-60, 6, 120, 10);
    c.fillStyle = "#FF5A36"; c.beginPath(); c.arc(50, -8, 3, 0, Math.PI * 2); c.fill();
    c.restore();
  },

  astronauta(c, s, t) {
    c.save(); c.scale(s, s); c.rotate(Math.sin(t * 0.5) * 0.3);
    const branco = "#F1F3F7", sombra = "#BFC5D2";
    c.lineCap = "round";
    c.strokeStyle = branco; c.lineWidth = 16;
    c.beginPath(); c.moveTo(-14, 26); c.lineTo(-24, 58); c.moveTo(14, 26); c.lineTo(22, 56); c.stroke();
    c.beginPath(); c.moveTo(-20, -10); c.lineTo(-44, 8); c.stroke();
    const aceno = Math.sin(t * 4) * 0.4;
    c.beginPath(); c.moveTo(20, -10); c.lineTo(36 + Math.cos(-1.2 + aceno) * 10, -30 + Math.sin(-1.2 + aceno) * 20); c.stroke();
    c.fillStyle = sombra; c.beginPath(); c.roundRect(-30, -22, 18, 46, 6); c.fill();
    c.fillStyle = branco; c.beginPath(); c.roundRect(-22, -24, 44, 56, 14); c.fill();
    c.fillStyle = "#FF5A36"; c.fillRect(-10, -6, 20, 8);
    c.fillStyle = branco; c.beginPath(); c.arc(0, -40, 22, 0, Math.PI * 2); c.fill();
    const visor = c.createLinearGradient(-14, -52, 14, -30);
    visor.addColorStop(0, "#FFE08A"); visor.addColorStop(1, "#C77A12");
    c.fillStyle = visor; c.beginPath(); c.ellipse(2, -40, 15, 12, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "rgba(255,255,255,0.7)"; c.beginPath(); c.ellipse(-4, -45, 5, 3, -0.5, 0, Math.PI * 2); c.fill();
    c.restore();
  },

  planeta(c, r, cor1, cor2, anel) {
    const g = c.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, cor1); g.addColorStop(1, cor2);
    if (anel) {
      c.strokeStyle = "rgba(230,200,150,0.55)"; c.lineWidth = r * 0.16;
      c.beginPath(); c.ellipse(0, 0, r * 1.9, r * 0.45, -0.3, Math.PI, Math.PI * 2); c.stroke();
    }
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
    c.save(); c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.clip();
    c.fillStyle = "rgba(0,0,0,0.12)";
    for (let i = -3; i <= 3; i++) c.fillRect(-r, i * r * 0.28 - r * 0.06, r * 2, r * 0.1);
    c.fillStyle = "rgba(0,0,20,0.45)"; c.beginPath(); c.arc(r * 0.45, r * 0.4, r * 1.05, 0, Math.PI * 2); c.fill();
    c.restore();
    if (anel) {
      c.strokeStyle = "rgba(240,215,170,0.8)"; c.lineWidth = r * 0.16;
      c.beginPath(); c.ellipse(0, 0, r * 1.9, r * 0.45, -0.3, 0, Math.PI); c.stroke();
    }
  },

  ovni(c, s, t) {
    c.save(); c.scale(s, s); c.translate(0, Math.sin(t * 2) * 6);
    const luz = c.createLinearGradient(0, 10, 0, 140);
    luz.addColorStop(0, "rgba(160,255,190,0.45)"); luz.addColorStop(1, "rgba(160,255,190,0)");
    c.fillStyle = luz; c.beginPath(); c.moveTo(-26, 10); c.lineTo(26, 10); c.lineTo(70, 140); c.lineTo(-70, 140); c.closePath(); c.fill();
    c.fillStyle = "rgba(170,230,255,0.85)"; c.beginPath(); c.ellipse(0, -10, 26, 22, 0, Math.PI, Math.PI * 2); c.fill();
    c.fillStyle = "#AEB6C6"; c.beginPath(); c.ellipse(0, 0, 70, 16, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#7D8597"; c.beginPath(); c.ellipse(0, 6, 46, 9, 0, 0, Math.PI); c.fill();
    for (let i = 0; i < 6; i++) {
      c.fillStyle = (Math.floor(t * 6) + i) % 3 ? "#FFE66B" : "#FF5A36";
      c.beginPath(); c.arc(-50 + i * 20, 2, 4, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  },

  gaivota(c, x, y, s, t) {
    const b = Math.sin(t) * 10 * s;
    c.strokeStyle = "rgba(255,245,235,0.85)"; c.lineWidth = 3 * s; c.lineCap = "round";
    c.beginPath(); c.moveTo(x - 18 * s, y - b); c.quadraticCurveTo(x - 8 * s, y - 8 * s, x, y); c.quadraticCurveTo(x + 8 * s, y - 8 * s, x + 18 * s, y - b); c.stroke();
  },

  coracao(c, x, y, r, cor) {
    c.fillStyle = cor;
    c.beginPath();
    c.moveTo(x, y + r * 0.9);
    c.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.7, y - r * 1.3, x, y - r * 0.45);
    c.bezierCurveTo(x + r * 0.7, y - r * 1.3, x + r * 1.6, y - r * 0.2, x, y + r * 0.9);
    c.fill();
  },

  /* Ícones do cardápio: a mesma arte da cena, em miniatura. */
  icone(c, efeito, cor) {
    c.save();
    c.translate(32, 32);
    const t = 0.3;
    switch (efeito) {
      case 0: c.fillStyle = cor; for (const y of [-10, 6]) { c.beginPath(); c.moveTo(-16, y + 10); c.lineTo(0, y - 6); c.lineTo(16, y + 10); c.lineTo(9, y + 10); c.lineTo(0, y + 2); c.lineTo(-9, y + 10); c.fill(); } break;
      case 1: Desenho.coco(c, 0, 4, 20, true); c.strokeStyle = "#FF5A9E"; c.lineWidth = 4; c.beginPath(); c.moveTo(4, -12); c.lineTo(14, -28); c.lineTo(22, -26); c.stroke(); break;
      case 2: Desenho.escada(c, 0, -26, 28, 0); break;
      case 3: Desenho.asaDelta(c, 0, 0, 0.18); break;
      case 4: c.rotate(0.5); Desenho.foguete(c, 0, -2, 0.36, t); break;
      case 5: Desenho.coco(c, 0, 0, 20); c.fillStyle = "#3E2312"; c.beginPath(); c.arc(-6, -4, 2.6, 0, 7); c.arc(4, -6, 2.6, 0, 7); c.arc(-1, 3, 2.6, 0, 7); c.fill(); break;
      case 6: Desenho.sagui(c, -4, 6, 0.75, t); break;
      case 7: c.strokeStyle = "#DCEBFF"; c.lineWidth = 4; c.lineCap = "round"; for (const [y, w] of [[-12, 30], [0, 40], [12, 26]]) { c.beginPath(); c.moveTo(-22, y); c.lineTo(-22 + w, y); c.arc(-22 + w, y - 6, 6, Math.PI / 2, -Math.PI, true); c.stroke(); } break;
      case 8: Desenho.bronzeador(c, 0, 4, 0.5, 0.25); break;
      case 9: Desenho.urubu(c, 0, 4, 0.2, 0); break;
    }
    c.restore();
  },
};

/* ───────────────────────── cena ───────────────────────── */

const Cena = {
  L: LAYOUTS.vertical,
  vis: 0,
  vel: 0,
  cam: QUADRIL,
  fase: 0,
  tempo: 0,
  tremor: 0,
  balanco: 0,
  efeitos: [],
  particulas: [],
  cordaGolpe: 0,
  cordasRotas: new Set(),
  personagem: {},

  montar(canvas, formato, personagem) {
    this.canvas = canvas;
    this.c = canvas.getContext("2d");
    this.personagem = personagem || {};
    this.formato(formato);
    const r = semeado(7);
    this.estrelas = Array.from({ length: 220 }, () => ({ x: r(), y: r(), m: 0.6 + r() * 1.8, f: r() * 6 }));
    this.nuvens = Array.from({ length: 46 }, (_, i) => ({
      alt: 260 + r() * 1500, x: r(), par: 0.45 + r() * 0.5, vx: 6 + r() * 14, tam: 0.6 + r() * 0.9, img: null, semente: i,
    }));
    this.gaivotas = Array.from({ length: 14 }, () => ({ alt: 18 + r() * 420, x: r(), vx: 30 + r() * 40, f: r() * 6, s: 0.7 + r() * 0.8 }));
    this.avioes = [];
    this.espaco = this.montarEspaco(semeado(31));
    this.proximoAviao = 0;
  },

  formato(nome) {
    this.L = LAYOUTS[nome] || LAYOUTS.vertical;
  },

  dimensionar(escala) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const k = escala * dpr;
    this.canvas.width = Math.round(this.L.W * k);
    this.canvas.height = Math.round(this.L.H * k);
    this.k = k;
  },

  /* tela ← mundo */
  sy(altMetros) { return this.L.refY - (altMetros - this.cam) * PX; },

  /* ───────────── acontecimentos → efeitos ───────────── */

  efeito(tipo, dados = {}) {
    this.efeitos.push({ tipo, inicio: this.tempo, dur: dados.dur || 1.6, ...dados });
  },

  /* Como o Zé reage a cada efeito: [reação, atraso, duração], em fração da
     duração do efeito (o coco bate em 38%, o sagui agarra em 25%...). */
  REACOES: {
    p0: [["feliz", 0.1, 1.1]], p1: [["feliz", 0.4, 0.8]],
    p3: [["asa", 0.18, 0.64]], p4: [["foguete", 0.02, 0.82]],
    p5: [["coco", 0.36, 1.3]], p6: [["sagui", 0.22, 0.6]], p7: [["vento", 0, 1]],
    p8: [["escorrega", 0.05, 0.9]], p9: [["susto", 0, 0.27], ["agarrado", 0.25, 0.5]],
  },

  aoAcontecer(a, estado) {
    if (a.tipo === "presente") {
      const faixa = Math.max(0, a.faixa);
      const k = a.time * 5 + faixa;
      const dur = [0.6, 1.4, 2.2, 3, 3.6][faixa] * (a.lendario ? 1.4 : 1);
      this.efeito("p" + k, { dur, time: a.time });
      for (const [tipo, atraso, fracao] of this.REACOES["p" + k] || []) {
        Ze.reagir(tipo, { atraso: atraso * dur, dur: fracao * dur, prio: faixa >= 3 ? 3 : 2 });
      }
      if (a.lendario) {
        this.tremor = 34;
        for (let i = 0; i < 4; i++) this.confete(this.L.x + (i - 1.5) * 220, this.vis + 4 + i, 70);
      }
      if (a.time === 0) this.faiscas(this.L.x, this.vis + 0.3, "#17F864", 6 + faixa * 6);
      else if (faixa >= 1) this.tremor = Math.max(this.tremor, 4 + faixa * 4);
      if (faixa === 4) this.tremor = 26;
      if (faixa === 2 && a.time === 1) this.balanco = Math.max(this.balanco, 1);
    } else if (a.tipo === "comando") {
      this.faiscas(this.L.x, this.vis + 0.4, a.time ? "#FF5A36" : "#17F864", a.chuva ? 8 : 4);
    } else if (a.tipo === "curtida") {
      for (let i = 0; i < Math.min(6, Math.ceil(a.curtidas / 3)); i++) {
        this.particulas.push({ tipo: "coracao", x: this.L.x + (Math.random() - 0.5) * 160, wy: (this.vis - 0.6) * PX, vx: (Math.random() - 0.5) * 30, vy: 90 + Math.random() * 70, vida: 0, dur: 1.6 + Math.random(), tam: 9 + Math.random() * 7, cor: Math.random() < 0.5 ? "#FF4A6E" : "#FF7A93" });
      }
    } else if (a.tipo === "corda") {
      this.cordaGolpe = 1;
      this.tremor = Math.max(this.tremor, 8);
    } else if (a.tipo === "queda") {
      this.cordasRotas.add(a.de);
      this.tremor = Math.max(this.tremor, 18);
      this.efeito("rompe", { dur: 1.2, alt: a.de });
    } else if (a.tipo === "checkpoint") {
      for (const h of a.alturas) this.cordasRotas.delete(h);
      this.confete(this.L.x, a.altura, 50);
      Ze.reagir("comemora", { dur: 1.7, prio: 1 });
    } else if (a.tipo === "recorde") {
      this.confete(this.L.x, estado.altura, 120);
      Ze.reagir("comemora", { dur: 2.4, prio: 2 });
    } else if (a.tipo === "salvou" || a.tipo === "segurou") {
      Ze.reagir("comemora", { dur: 1.5, prio: 1 });
    } else if (a.tipo === "areia") {
      this.tremor = 30;
      this.cordasRotas.clear();
      this.efeito("poeira", { dur: 1.6 });
      const urubu = this.efeitos.find(e => e.tipo === "p9");
      const solta = urubu ? Math.max(0, urubu.inicio + urubu.dur * 0.8 - this.tempo) : 0;
      Ze.reagir("tonto", { atraso: Math.max(1.1, solta), dur: 2.2, prio: 4 });
    } else if (a.tipo === "ventou") {
      this.balanco = 1.4;
      Ze.reagir("vento", { dur: 2, prio: 2 });
    } else if (a.tipo === "surpresa" && a.evento.tipo === "ventania") {
      this.balanco = 0.4;
    }
  },

  faiscas(x, alt, cor, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 120 + Math.random() * 260;
      this.particulas.push({ tipo: "faisca", x, wy: alt * PX, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: 0, dur: 0.5 + Math.random() * 0.5, tam: 3 + Math.random() * 4, cor });
    }
  },

  confete(x, alt, n) {
    const cores = ["#17F864", "#FFC81E", "#FF5A36", "#1E6FD9", "#F4F8F3", "#FF7AB6"];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, v = 300 + Math.random() * 500;
      this.particulas.push({ tipo: "confete", x, wy: alt * PX + 60, vx: Math.cos(a) * v, vy: -Math.sin(a) * v, vida: 0, dur: 2 + Math.random() * 1.5, tam: 6 + Math.random() * 6, cor: cores[i % cores.length], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14 });
    }
  },

  /* ───────────── quadro ───────────── */

  quadro(dt, estado) {
    this.tempo += dt;
    const L = this.L;

    /* altura mostrada: sobe macio, cai rápido */
    const alvo = estado.altura;
    const antes = this.vis;
    const k = alvo < this.vis ? 3.2 : 2.6;
    this.vis += (alvo - this.vis) * (1 - Math.exp(-k * dt));
    if (Math.abs(alvo - this.vis) < 0.002) this.vis = alvo;
    this.vel = dt > 0 ? (this.vis - antes) / dt : 0;

    /* A câmera persegue o Zé com folga curta: pulinho de rosa aparece como
       movimento dele; foguete não deixa ele sair da tela. */
    const camMin = (L.chaoMax - L.refY) / PX;
    const camAlvo = Math.max(camMin, this.vis + QUADRIL);
    this.cam += (camAlvo - this.cam) * (1 - Math.exp(-7 * dt));
    this.cam = lim(this.cam, camAlvo - 1.2, camAlvo + 1.2);

    this.caindo += ((this.vel < -3 ? 1 : 0) - (this.caindo || 0)) * (1 - Math.exp(-10 * dt));
    this.tremor *= Math.exp(-5 * dt);
    this.balanco *= Math.exp(-0.9 * dt);
    this.cordaGolpe *= Math.exp(-3 * dt);
    if (estado.evento && estado.evento.tipo === "ventania") {
      const passou = 1 - (estado.evento.ate - estado.agora) / (estado.evento.segundos * 1000);
      this.balanco = Math.max(this.balanco, 0.25 + 0.6 * lim(passou));
    }

    const c = this.c;
    c.setTransform(this.k, 0, 0, this.k, 0, 0);
    if (this.tremor > 0.3) c.translate((Math.random() - 0.5) * this.tremor, (Math.random() - 0.5) * this.tremor);

    this.ceu(c);
    this.fundo(c, dt);
    this.praia(c);
    this.coqueiro(c, estado);
    this.desenharEfeitos(c, estado, "atras");
    Ze.quadro(dt, { vel: this.vel, caindo: this.caindo, balanco: this.balanco });
    this.desenharZe(c, estado);
    this.desenharEfeitos(c, estado, "frente");
    this.desenharParticulas(c, dt);
    if (estado.evento && estado.evento.tipo === "chuva") this.chuvaDeCoco(c, dt);
    if (this.balanco > 0.3) this.vento(c);
  },

  balancoEm(sy) {
    const chao = this.sy(0);
    const altura = lim((chao - sy) / 900, 0, 1);
    return this.balanco * Math.sin(this.tempo * 3.1 + sy * 0.002) * 28 * altura;
  },

  /* ───────────── fundo ───────────── */

  corCeu(alt) {
    let i = 0;
    while (i < CEU.length - 2 && alt > CEU[i + 1][0]) i++;
    const [a0, ...ca] = CEU[i], [a1, ...cb] = CEU[i + 1];
    const t = suave(lim((alt - a0) / (a1 - a0)));
    return ca.map((cor, j) => mistura(cor, cb[j], t));
  },

  horizonteY() { return this.L.horizonte + (this.cam - 8) * PX * 0.03; },

  ceu(c) {
    const L = this.L;
    const [topo, meio, baixo] = this.corCeu(this.cam);
    const hy = Math.min(L.H, this.horizonteY());
    const g = c.createLinearGradient(0, 0, 0, Math.max(hy, L.H * 0.6));
    g.addColorStop(0, topo); g.addColorStop(0.6, meio); g.addColorStop(1, baixo);
    c.fillStyle = g;
    c.fillRect(0, 0, L.W, L.H);

    const noite = lim((this.cam - 1100) / 1800);
    if (noite > 0) {
      for (const e of this.estrelas) {
        const a = noite * (0.55 + 0.45 * Math.sin(this.tempo * 2 + e.f));
        c.fillStyle = `rgba(255,255,240,${a.toFixed(3)})`;
        c.fillRect(e.x * L.W, e.y * L.H, e.m, e.m);
      }
    }

    /* sol baixo no fim de tarde, some com a altura */
    const solY = this.horizonteY() - 70 + this.cam * 0.08;
    const solA = 1 - lim((this.cam - 900) / 900);
    if (solA > 0 && solY < L.H + 200) {
      const sx = L.W * 0.76;
      const halo = c.createRadialGradient(sx, solY, 20, sx, solY, 420);
      halo.addColorStop(0, `rgba(255,214,140,${0.55 * solA})`); halo.addColorStop(1, "rgba(255,170,100,0)");
      c.fillStyle = halo; c.fillRect(sx - 420, solY - 420, 840, 840);
      const disco = c.createLinearGradient(0, solY - 95, 0, solY + 95);
      disco.addColorStop(0, `rgba(255,236,170,${solA})`); disco.addColorStop(1, `rgba(255,128,74,${solA})`);
      c.fillStyle = disco;
      c.beginPath(); c.arc(sx, solY, 95, 0, Math.PI * 2); c.fill();
    }

    const lua = lim((this.cam - 2200) / 1500);
    if (lua > 0) {
      const lx = L.W * 0.78, ly = L.H * (L.H > L.W ? 0.66 : 0.3), lr = 50 + lua * 60;
      const g2 = c.createRadialGradient(lx, ly, lr * 0.8, lx, ly, lr * 3);
      g2.addColorStop(0, `rgba(220,228,255,${0.25 * lua})`); g2.addColorStop(1, "rgba(220,228,255,0)");
      c.fillStyle = g2; c.fillRect(lx - lr * 3, ly - lr * 3, lr * 6, lr * 6);
      c.fillStyle = rgba("#EEF0F6", lua);
      c.beginPath(); c.arc(lx, ly, lr, 0, Math.PI * 2); c.fill();
      c.fillStyle = rgba("#C9CEDB", lua * 0.8);
      for (const [dx, dy, r] of [[-0.3, -0.2, 0.18], [0.25, 0.1, 0.24], [-0.1, 0.4, 0.12], [0.35, -0.35, 0.1]]) {
        c.beginPath(); c.arc(lx + dx * lr, ly + dy * lr, r * lr, 0, Math.PI * 2); c.fill();
      }
    }

    const terra = lim((this.cam - 3800) / 2500);
    if (terra > 0) {
      const raio = L.W * 2.2;
      const cy = L.H + raio - terra * L.H * 0.22;
      const atm = c.createRadialGradient(L.W / 2, cy, raio * 0.98, L.W / 2, cy, raio * 1.06);
      atm.addColorStop(0, "rgba(90,170,255,0.9)"); atm.addColorStop(1, "rgba(90,170,255,0)");
      c.fillStyle = atm; c.beginPath(); c.arc(L.W / 2, cy, raio * 1.06, 0, Math.PI * 2); c.fill();
      const chao = c.createLinearGradient(0, cy - raio, 0, cy - raio + 300);
      chao.addColorStop(0, "#2D6FB8"); chao.addColorStop(1, "#0B2A55");
      c.fillStyle = chao; c.beginPath(); c.arc(L.W / 2, cy, raio, 0, Math.PI * 2); c.fill();
    }
  },

  fundo(c, dt) {
    const L = this.L, t = this.tempo;
    const hy = this.horizonteY();

    if (hy < L.H + 40) {
      /* Pão de Açúcar e Urca do outro lado da baía, com o bondinho */
      const [, meio, baixo] = this.corCeu(this.cam);
      const morro = mistura(mistura(meio, "#2A2050", 0.55), baixo, 0.15);
      const longe = mistura(mistura(meio, baixo, 0.5), "#3C2F66", 0.3);
      /* Na horizontal o morro fica entre a coluna da esquerda e o tronco. */
      const mx = L.W > L.H ? 470 : L.W * 0.12;
      c.fillStyle = longe;
      c.beginPath(); c.moveTo(-20, hy);
      c.bezierCurveTo(L.W * 0.3, hy - 60, L.W * 0.55, hy - 30, L.W * 0.62, hy - 70);
      c.bezierCurveTo(L.W * 0.7, hy - 110, L.W * 0.82, hy - 40, L.W + 20, hy - 60);
      c.lineTo(L.W + 20, hy); c.closePath(); c.fill();
      c.fillStyle = morro;
      c.beginPath(); c.moveTo(mx - 40, hy);
      c.bezierCurveTo(mx - 10, hy - 70, mx + 60, hy - 95, mx + 110, hy - 70);
      c.bezierCurveTo(mx + 140, hy - 55, mx + 150, hy - 40, mx + 170, hy - 40);
      c.bezierCurveTo(mx + 190, hy - 120, mx + 230, hy - 245, mx + 280, hy - 250);
      c.bezierCurveTo(mx + 330, hy - 245, mx + 350, hy - 150, mx + 400, hy);
      c.closePath(); c.fill();
      c.strokeStyle = rgba("#1C1438", 0.5); c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(mx + 70, hy - 88); c.quadraticCurveTo(mx + 170, hy - 140, mx + 270, hy - 247); c.stroke();
      const b = (t * 0.05) % 1;
      c.fillStyle = "#1C1438";
      c.fillRect(mx + 70 + b * 200 - 4, hy - 88 - b * 159 + 20 * Math.sin(b * Math.PI) - 2, 7, 5);

      /* mar */
      const mar = c.createLinearGradient(0, hy, 0, L.H);
      mar.addColorStop(0, mistura(baixo, "#5B6FB0", 0.35));
      mar.addColorStop(0.35, "#3D4F92");
      mar.addColorStop(1, "#1D3E78");
      c.fillStyle = mar;
      c.fillRect(0, hy, L.W, L.H - hy + 40);
      const sx = L.W * 0.76;
      for (let i = 0; i < 14; i++) {
        const y = hy + 4 + i * 9 + i * i * 0.6;
        if (y > L.H) break;
        const w = (150 - i * 7) * (0.7 + 0.3 * Math.sin(t * 2 + i * 1.7));
        c.fillStyle = `rgba(255,${206 - i * 4},${140 - i * 3},${0.5 - i * 0.032})`;
        c.fillRect(sx - w / 2 + Math.sin(t * 1.3 + i) * 10, y, w, 3);
      }
    }

    /* gaivotas */
    for (const g of this.gaivotas) {
      const y = this.L.refY - (g.alt - this.cam) * PX * 0.7;
      if (y < -40 || y > L.H + 40) continue;
      const x = ((g.x * (L.W + 200) + t * g.vx) % (L.W + 200)) - 100;
      Desenho.gaivota(c, x, y, g.s, t * 9 + g.f);
    }

    /* nuvens (pré-desenhadas) */
    for (const n of this.nuvens) {
      const y = this.L.refY - (n.alt - this.cam) * PX * n.par;
      if (y < -300 || y > L.H + 300) continue;
      if (!n.img) n.img = this.nuvem(n.semente, n.tam);
      const largura = L.W + n.img.width;
      const x = ((n.x * largura + t * n.vx) % largura) - n.img.width;
      c.globalAlpha = 0.55 + n.par * 0.45;
      c.drawImage(n.img, x, y - n.img.height / 2);
      c.globalAlpha = 1;
    }

    this.desenharEspaco(c);

    /* aviões na rota */
    if (this.cam > 900 && this.cam < 2600 && t > this.proximoAviao) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      this.avioes.push({ alt: this.cam + 2 + Math.random() * 10, dir, x: dir > 0 ? -200 : L.W + 200, s: 0.7 + Math.random() * 0.6 });
      this.proximoAviao = t + 9 + Math.random() * 8;
    }
    this.avioes = this.avioes.filter(a => a.x > -400 && a.x < L.W + 400);
    for (const a of this.avioes) {
      a.x += a.dir * 160 * dt;
      const y = this.L.refY - (a.alt - this.cam) * PX * 0.35;
      const rastro = c.createLinearGradient(a.x - a.dir * 600, 0, a.x, 0);
      rastro.addColorStop(0, "rgba(255,255,255,0)"); rastro.addColorStop(1, "rgba(255,255,255,0.5)");
      c.fillStyle = rastro;
      c.fillRect(Math.min(a.x, a.x - a.dir * 600), y - 3, 600, 4);
      Desenho.aviao(c, a.x, y, a.s, a.dir);
    }
  },

  /* Objetos do céu alto, um a cada ~13 m, do tipo da faixa de altura. A
     paralaxe baixa deixa eles na tela por muito tempo quando o Zé sobe
     devagar, então a 5, 10 ou 20 km sempre tem algo pra ver. */
  montarEspaco(r) {
    const lista = [];
    const faixas = [
      [2200, 4500, ["satelite", "meteoro", "satelite", "meteoro"]],
      [4500, 9000, ["satelite", "estacao", "meteoro", "astronauta", "satelite"]],
      [9000, 16000, ["astronauta", "estacao", "planeta", "satelite", "meteoro"]],
      [16000, 60000, ["planeta", "ovni", "meteoro", "astronauta", "cometa", "planeta"]],
    ];
    for (const [de, ate, tipos] of faixas) {
      for (let alt = de; alt < ate; alt += 9 + r() * 9) {
        lista.push({
          alt, tipo: tipos[Math.floor(r() * tipos.length)], x: 0.08 + r() * 0.84, par: 0.35 + r() * 0.3,
          s: 0.5 + r() * 0.6, vx: (r() - 0.5) * 18, f: r() * 10,
          cor: [["#E8B07A", "#8A4E2A"], ["#7FC4E8", "#2A5E9C"], ["#E87A9A", "#7A2A5E"], ["#C6E87A", "#4E7A2A"]][Math.floor(r() * 4)],
          anel: r() < 0.5,
        });
      }
    }
    /* marcos fixos: 5 km satélite grande, 10 km estação, 20 km Saturno */
    lista.push({ alt: 5000, tipo: "satelite", x: 0.78, par: 0.6, s: 1.5, vx: 0, f: 0, marco: true });
    lista.push({ alt: 10000, tipo: "estacao", x: 0.5, par: 0.6, s: 1.3, vx: 0, f: 0, marco: true });
    lista.push({ alt: 20000, tipo: "planeta", x: 0.24, par: 0.6, s: 3.2, vx: 0, f: 0, marco: true, cor: ["#F0D49A", "#B07A3A"], anel: true });
    return lista.sort((a, b) => a.alt - b.alt);
  },

  desenharEspaco(c) {
    const L = this.L, t = this.tempo;
    if (this.cam < 1800) return;
    const alcance = (L.H + 400) / (PX * 0.35);
    for (const o of this.espaco) {
      if (o.alt < this.cam - alcance) continue;
      if (o.alt > this.cam + alcance) break;
      const y = L.refY - (o.alt - this.cam) * PX * o.par;
      if (y < -300 || y > L.H + 300) continue;
      const largura = L.W + 400;
      const x = ((o.x * largura + t * o.vx) % largura + largura) % largura - 200;
      c.save();
      c.translate(x, y);
      c.globalAlpha = o.marco ? 1 : 0.55 + o.par;
      if (o.tipo === "satelite") { c.rotate(Math.sin(t * 0.3 + o.f) * 0.2); Desenho.satelite(c, o.s); }
      else if (o.tipo === "estacao") Desenho.estacao(c, o.s * 0.6);
      else if (o.tipo === "astronauta") Desenho.astronauta(c, o.s * 0.8, t + o.f);
      else if (o.tipo === "planeta") Desenho.planeta(c, 40 * o.s, o.cor[0], o.cor[1], o.anel);
      else if (o.tipo === "ovni") Desenho.ovni(c, o.s * 0.7, t + o.f);
      else if (o.tipo === "cometa" || o.tipo === "meteoro") {
        const k = ((t * 0.25 + o.f) % 4) / 4;
        if (o.tipo === "meteoro" && k > 0.25) { c.restore(); continue; }
        const d = o.tipo === "meteoro" ? k * 4 * 500 : 0;
        const cauda = o.tipo === "meteoro" ? 160 : 320 * o.s;
        c.translate(-d, d * 0.45);
        const g = c.createLinearGradient(0, 0, cauda, -cauda * 0.45);
        g.addColorStop(0, "rgba(255,255,255,0.95)"); g.addColorStop(1, "rgba(150,200,255,0)");
        c.strokeStyle = g; c.lineWidth = o.tipo === "meteoro" ? 3 : 10 * o.s; c.lineCap = "round";
        c.beginPath(); c.moveTo(0, 0); c.lineTo(cauda, -cauda * 0.45); c.stroke();
        c.fillStyle = "#FFF"; c.beginPath(); c.arc(0, 0, o.tipo === "meteoro" ? 3 : 7 * o.s, 0, Math.PI * 2); c.fill();
      }
      if (o.marco) {
        c.globalAlpha = 1;
        c.fillStyle = "rgba(9,11,34,0.7)";
        c.font = "800 30px 'Big Shoulders Display', sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
        const txt = `${fmt.format(o.alt / 1000)} KM`;
        const w = c.measureText(txt).width + 28;
        c.beginPath(); c.roundRect(-w / 2, 80 * Math.max(1, o.s * 0.8), w, 42, 21); c.fill();
        c.fillStyle = "#FFF"; c.fillText(txt, 0, 80 * Math.max(1, o.s * 0.8) + 21);
      }
      c.restore();
    }
  },

  nuvem(semente, tam) {
    const r = semeado(semente * 97 + 3);
    const w = Math.round(360 * tam), h = Math.round(160 * tam);
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    const c = cv.getContext("2d");
    const base = h * 0.72;
    const bolas = Array.from({ length: 7 }, (_, i) => ({ x: w * (0.15 + i * 0.12 + r() * 0.05), r: h * (0.18 + r() * 0.2) }));
    const pinta = (cor, dy, esc) => {
      c.fillStyle = cor;
      c.beginPath();
      for (const b of bolas) { c.moveTo(b.x + b.r * esc, base - b.r * 0.6 + dy); c.arc(b.x, base - b.r * 0.6 + dy, b.r * esc, 0, Math.PI * 2); }
      c.rect(w * 0.12, base - h * 0.12 + dy, w * 0.76, h * 0.12);
      c.fill();
    };
    pinta("rgba(150,120,190,0.9)", 6, 1);
    pinta("rgba(255,214,214,0.95)", 0, 0.96);
    pinta("rgba(255,240,228,0.9)", -6, 0.7);
    c.clearRect(0, base, w, h);
    return cv;
  },

  praia(c) {
    const L = this.L, t = this.tempo;
    const chao = this.sy(0);
    if (chao > L.H + 700) return;

    /* coqueiros do fundo */
    const largura = L.W > L.H ? 1500 : 1100;
    for (const [dx, alt, esc] of [[-0.38, 10, 0.75], [0.4, 13, 0.85], [-0.47, 7, 0.6]]) {
      const x = L.x + dx * largura;
      const topo = this.sy(alt);
      c.strokeStyle = "#4E463F"; c.lineWidth = 34 * esc; c.lineCap = "round";
      c.beginPath(); c.moveTo(x, chao - 10); c.quadraticCurveTo(x + 30 * esc * Math.sign(dx), (chao + topo) / 2, x + 50 * Math.sign(dx) * esc, topo); c.stroke();
      this.copa(c, x + 50 * Math.sign(dx) * esc, topo, esc * 0.9, Math.sin(t * 1.1 + dx * 9) * 0.03);
    }

    /* areia */
    const areia = c.createLinearGradient(0, chao - 70, 0, chao + 170);
    areia.addColorStop(0, "#E8C38E"); areia.addColorStop(1, "#D9A867");
    c.fillStyle = "#F5E3C4";
    c.beginPath(); c.moveTo(0, chao - 70);
    for (let x = 0; x <= L.W; x += 40) c.lineTo(x, chao - 78 + Math.sin(x * 0.012 + t * 1.3) * 6);
    c.lineTo(L.W, chao + 20); c.lineTo(0, chao + 20); c.closePath(); c.fill();
    c.fillStyle = areia;
    c.fillRect(0, chao - 64, L.W, 240);

    /* quiosque */
    const qx = L.x - Math.min(330, L.W * 0.3), qy = chao + 10;
    c.fillStyle = "#6B4426"; c.fillRect(qx - 70, qy - 120, 10, 120); c.fillRect(qx + 60, qy - 120, 10, 120);
    c.fillStyle = "#F4F1EA"; c.fillRect(qx - 80, qy - 70, 160, 70);
    c.fillStyle = "#17A05A"; c.fillRect(qx - 80, qy - 70, 160, 16);
    c.fillStyle = "#C99A4E";
    c.beginPath(); c.moveTo(qx - 110, qy - 115); c.lineTo(qx, qy - 175); c.lineTo(qx + 110, qy - 115); c.closePath(); c.fill();
    c.strokeStyle = "rgba(110,70,30,0.45)"; c.lineWidth = 2;
    for (let i = -100; i <= 100; i += 12) { c.beginPath(); c.moveTo(qx + i, qy - 115); c.lineTo(qx + i * 0.2, qy - 168); c.stroke(); }
    c.fillStyle = "#1D3E78"; c.font = "700 22px 'Big Shoulders Display', sans-serif"; c.textAlign = "center";
    c.fillText("COCO GELADO", qx, qy - 26);
    for (let i = 0; i < 4; i++) Desenho.coco(c, qx - 48 + i * 32, qy - 8, 11, true);

    /* guarda-sóis */
    for (const [dx, cor1, cor2] of [[0.26, "#FF5A36", "#F4F1EA"], [0.4, "#1E6FD9", "#F2C230"]]) {
      const x = L.x + dx * Math.min(L.W, 1100), y = chao + 40;
      c.strokeStyle = "#EEE"; c.lineWidth = 5;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x - 8, y - 120); c.stroke();
      for (let k = 0; k < 6; k++) {
        c.fillStyle = k % 2 ? cor1 : cor2;
        c.beginPath(); c.moveTo(x - 8, y - 132);
        c.arc(x - 8, y - 112, 80, Math.PI + k * (Math.PI / 6), Math.PI + (k + 1) * (Math.PI / 6));
        c.closePath(); c.fill();
      }
    }

    /* calçadão de Copacabana */
    const cy = chao + 150;
    if (cy < L.H) {
      c.fillStyle = "#F2EDE2";
      c.fillRect(0, cy, L.W, L.H - cy + 20);
      c.fillStyle = "#1B1A1A";
      for (let faixa = 0; faixa < 14; faixa++) {
        const y0 = cy + 24 + faixa * 64;
        if (y0 > L.H + 40) break;
        c.beginPath();
        c.moveTo(0, y0);
        for (let x = 0; x <= L.W + 20; x += 20) c.lineTo(x, y0 + Math.sin(x * 0.0125 + faixa * Math.PI) * 18);
        for (let x = L.W + 20; x >= 0; x -= 20) c.lineTo(x, y0 + 30 + Math.sin(x * 0.0125 + faixa * Math.PI) * 18);
        c.closePath(); c.fill();
      }
      c.fillStyle = "rgba(0,0,0,0.18)"; c.fillRect(0, cy, L.W, 10);
    }
  },

  /* Copa pré-desenhada (são ~500 traços cada): o balanço é só rotação. */
  copa(c, x, y, escala, angulo) {
    const chave = `${escala.toFixed(2)}@${this.k.toFixed(2)}`;
    this.copas = this.copas || new Map();
    let img = this.copas.get(chave);
    if (!img) {
      const meia = Math.ceil(240 * escala), k = this.k;
      img = document.createElement("canvas");
      img.width = Math.ceil(meia * 2 * k);
      img.height = Math.ceil(meia * 1.6 * k);
      const ic = img.getContext("2d");
      ic.scale(k, k);
      Desenho.copa(ic, meia, meia * 0.62, escala, 0, 0);
      img.meia = meia;
      this.copas.set(chave, img);
    }
    c.save();
    c.translate(x, y);
    c.rotate(angulo);
    c.drawImage(img, -img.meia, -img.meia * 0.62, img.meia * 2, img.meia * 1.6);
    c.restore();
  },

  /* ───────────── coqueiro ───────────── */

  meiaLargura(alt) { return 60 + Math.sin(alt * 0.9) * 3 + Math.sin(alt * 2.7) * 1.6; },

  coqueiro(c, estado) {
    const L = this.L, t = this.tempo;
    const chao = this.sy(0);
    const topoAlt = this.cam + (L.refY + 40) / PX;
    const baseAlt = Math.max(0, this.cam - (L.H - L.refY + 40) / PX);
    const cp = estado.checkpoint;

    /* copas dos checkpoints ficam atrás do tronco */
    const primeiro = Math.max(1, Math.floor((baseAlt - 4) / cp));
    for (let k = primeiro; k * cp <= topoAlt + 4; k++) {
      const y = this.sy(k * cp + 1.2);
      this.copa(c, L.x + this.balancoEm(y), y, 1.25, Math.sin(t * 1.3 + k) * 0.02 + this.balanco * Math.sin(t * 5 + k) * 0.06);
    }

    /* tronco: polígono com largura irregular e anéis */
    const passo = 12;
    const yTopo = -20, yBase = Math.min(L.H + 20, chao);
    const esquerda = [], direita = [];
    for (let y = yTopo; y <= yBase + passo; y += passo) {
      const yy = Math.min(y, yBase);
      const alt = this.cam + (L.refY - yy) / PX;
      const base = yy > chao - 140 ? (yy - (chao - 140)) / 140 : 0;
      const w = this.meiaLargura(alt) + base * base * 34;
      const x = L.x + this.balancoEm(yy);
      esquerda.push([x - w, yy]);
      direita.push([x + w, yy]);
    }
    const g = c.createLinearGradient(L.x - 70, 0, L.x + 70, 0);
    g.addColorStop(0, "#4A423B"); g.addColorStop(0.35, "#6E645A"); g.addColorStop(0.75, "#8D8174"); g.addColorStop(0.92, "#B79A80"); g.addColorStop(1, "#4F463E");
    c.fillStyle = g;
    c.beginPath();
    esquerda.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    for (let i = direita.length - 1; i >= 0; i--) c.lineTo(direita[i][0], direita[i][1]);
    c.closePath(); c.fill();

    const anel = 0.42;
    for (let a = Math.floor(baseAlt / anel) * anel; a < topoAlt; a += anel) {
      const y = this.sy(a);
      if (y > chao - 4) continue;
      const w = this.meiaLargura(a);
      const x = L.x + this.balancoEm(y);
      const n = Math.round(a / anel);
      const tom = 0.18 + ((n * 7919) % 13) / 60;
      c.strokeStyle = `rgba(30,24,20,${tom + 0.1})`;
      c.lineWidth = 3;
      c.beginPath(); c.moveTo(x - w + 2, y - 2); c.quadraticCurveTo(x, y + 7, x + w - 2, y - 2); c.stroke();
      c.strokeStyle = "rgba(225,205,180,0.2)";
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(x - w * 0.2, y + 5); c.quadraticCurveTo(x + w * 0.4, y + 7, x + w - 6, y + 2); c.stroke();
    }

    /* cordas, placas e recorde */
    for (let k = primeiro; k * cp <= topoAlt + 4; k++) this.corda(c, k * cp, estado);
    if (estado.recorde > estado.altura + 1 && estado.recorde >= 10) this.linhaRecorde(c, estado.recorde);
  },

  corda(c, alt, estado) {
    const L = this.L;
    const y = this.sy(alt);
    if (y < -60 || y > L.H + 60) return;
    const x = L.x + this.balancoEm(y);
    const w = this.meiaLargura(alt) + 4;
    const atual = estado.piso === alt && estado.altura < alt + 6;
    const gasto = atual ? estado.desgaste : 0;
    const rota = this.cordasRotas.has(alt) && estado.piso < alt;
    const treme = atual ? Math.sin(this.tempo * 60) * this.cordaGolpe * 5 : 0;

    c.save();
    c.translate(treme, 0);
    if (rota) {
      c.strokeStyle = "#C9A46A"; c.lineWidth = 9; c.lineCap = "round";
      for (const lado of [-1, 1]) {
        c.beginPath(); c.moveTo(x + lado * w, y); c.quadraticCurveTo(x + lado * (w + 10), y + 30, x + lado * (w + 2), y + 60 + Math.sin(this.tempo * 3 + lado) * 6); c.stroke();
      }
    } else {
      const cor = mistura("#D8B57A", "#E2482E", gasto);
      c.strokeStyle = cor; c.lineWidth = 14 - gasto * 6; c.lineCap = "round";
      c.beginPath(); c.moveTo(x - w, y); c.quadraticCurveTo(x, y + 12, x + w, y); c.stroke();
      c.strokeStyle = "rgba(90,55,20,0.6)"; c.lineWidth = 2.5;
      for (let i = -w + 6; i < w - 4; i += 11) {
        const yy = y + 12 * (1 - Math.pow(i / w, 2)) * 0.5;
        c.beginPath(); c.moveTo(x + i, yy - 5); c.lineTo(x + i + 7, yy + 5); c.stroke();
      }
      c.strokeStyle = cor; c.lineWidth = 8;
      c.beginPath(); c.moveTo(x + w - 4, y + 2); c.quadraticCurveTo(x + w + 18, y + 30, x + w + 8, y + 56); c.moveTo(x + w - 2, y + 2); c.quadraticCurveTo(x + w + 34, y + 20, x + w + 30, y + 46); c.stroke();
      c.fillStyle = cor; c.beginPath(); c.arc(x + w - 2, y + 2, 9, 0, Math.PI * 2); c.fill();
    }

    /* placa */
    const px = x - w - 120, py = y - 30;
    c.strokeStyle = "#5B3A1E"; c.lineWidth = 4;
    c.beginPath(); c.moveTo(px + 100, py + 30); c.lineTo(x - w + 4, y); c.stroke();
    c.fillStyle = "#8A5A2B"; c.fillRect(px, py, 104, 52);
    c.fillStyle = "#6B4426"; c.fillRect(px, py + 44, 104, 8);
    c.fillStyle = "#F7E6C4"; c.font = "800 34px 'Big Shoulders Display', sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(`${fmt.format(alt)} m`, px + 52, py + 24);
    if (atual && gasto > 0) {
      const bx = px - 4, by = py + 58;
      c.fillStyle = "rgba(9,11,34,0.88)"; c.fillRect(bx, by, 112, 42);
      c.fillStyle = mistura("#FFC81E", "#FF3B2E", gasto); c.fillRect(bx + 4, by + 34, 104 * (1 - gasto), 5);
      c.fillStyle = "#FFF"; c.font = "800 25px 'Big Shoulders Display', sans-serif";
      c.fillText(`CORDA ${Math.round((1 - gasto) * 100)}%`, bx + 56, by + 17);
    }
    c.restore();
  },

  linhaRecorde(c, alt) {
    const L = this.L;
    const y = this.sy(alt);
    if (y < -40 || y > L.H + 40) return;
    c.save();
    c.setLineDash([22, 14]);
    c.strokeStyle = "rgba(255,255,255,0.8)"; c.lineWidth = 4;
    c.beginPath(); c.moveTo(0, y); c.lineTo(L.W, y); c.stroke();
    c.setLineDash([]);
    const x = L.x + 110;
    c.strokeStyle = "#F4F1EA"; c.lineWidth = 5;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 90); c.stroke();
    c.fillStyle = "#FFC81E";
    c.beginPath(); c.moveTo(x, y - 90); c.lineTo(x + 150, y - 72 + Math.sin(this.tempo * 4) * 4); c.lineTo(x, y - 48); c.closePath(); c.fill();
    c.fillStyle = "#1A1206"; c.font = "800 22px 'Big Shoulders Display', sans-serif"; c.textAlign = "left"; c.textBaseline = "middle";
    c.fillText("RECORDE", x + 10, y - 70);
    c.restore();
  },

  /* ───────────── o Zé ───────────── */

  zeTela() {
    const y = this.sy(this.vis + QUADRIL);
    return { x: this.L.x + this.balancoEm(y), y };
  },

  desenharZe(c, estado) {
    const { x, y } = this.zeTela();
    c.save();
    c.translate(x, y);
    c.scale(ZE_ESCALA, ZE_ESCALA);
    c.rotate((this.caindo || 0) * Math.sin(this.tempo * 9) * 0.1);
    Ze.desenhar(c, this.personagem);
    c.restore();
    if (estado.atolado > 0) this.monteDeAreia(c, x, estado.atolado);
  },

  /* Atolado: monte de areia até a canela (ou até a cintura, se for muito). */
  monteDeAreia(c, x, atolado) {
    const chao = this.sy(0);
    const h = 50 + 110 * lim(atolado / 400);
    const g = c.createLinearGradient(0, chao - h, 0, chao + 20);
    g.addColorStop(0, "#F2D3A0"); g.addColorStop(1, "#C9955A");
    c.fillStyle = "rgba(60,30,10,0.35)";
    c.beginPath(); c.ellipse(x, chao + 14, 190, 26, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(x - 200, chao + 16);
    c.bezierCurveTo(x - 130, chao - h * 0.2, x - 90, chao - h, x, chao - h);
    c.bezierCurveTo(x + 90, chao - h, x + 130, chao - h * 0.2, x + 200, chao + 16);
    c.closePath(); c.fill();
    c.fillStyle = "rgba(120,80,40,0.35)";
    const r = semeado(5);
    for (let i = 0; i < 40; i++) {
      const gx = x + (r() - 0.5) * 300, gy = chao - r() * h * 0.8;
      c.fillRect(gx, gy, 3, 3);
    }
    /* areia voando de quem está cavando */
    c.fillStyle = "rgba(240,210,160,0.9)";
    for (let i = 0; i < 6; i++) {
      const k = (this.tempo * 1.4 + i / 6) % 1;
      const lado = i % 2 ? 1 : -1;
      c.beginPath(); c.arc(x + lado * (40 + k * 140), chao - h + 10 - Math.sin(k * Math.PI) * 90, 6 * (1 - k) + 2, 0, Math.PI * 2); c.fill();
    }
  },

  /* Ponto do corpo do Zé na tela (mãos, pés, ombros, cabeça), do último quadro. */
  zePonto(nome) {
    const z = this.zeTela();
    const p = Ze.pontos && Ze.pontos[nome];
    return p ? { x: z.x + p[0] * ZE_ESCALA, y: z.y + p[1] * ZE_ESCALA } : z;
  },

  /* ───────────── efeitos dos presentes ───────────── */

  desenharEfeitos(c, estado, camada) {
    const t = this.tempo;
    const ze = this.zeTela();
    this.efeitos = this.efeitos.filter(e => t - e.inicio < e.dur);
    for (const e of this.efeitos) {
      const p = lim((t - e.inicio) / e.dur);
      const f = this.EFEITOS[e.tipo];
      if (f && (f.camada || "frente") === camada) f.call(this, c, p, ze, e);
    }
  },

  EFEITOS: {
    /* Ajuda */
    p0(c, p, ze) {
      c.fillStyle = rgba("#17F864", 1 - p);
      for (let i = 0; i < 3; i++) {
        const y = ze.y + 120 - p * 120 - i * 26;
        c.beginPath(); c.moveTo(ze.x - 26, y + 14); c.lineTo(ze.x, y - 4); c.lineTo(ze.x + 26, y + 14); c.lineTo(ze.x + 16, y + 14); c.lineTo(ze.x, y + 4); c.lineTo(ze.x - 16, y + 14); c.fill();
      }
    },
    p1(c, p, ze) {
      const voo = lim(p / 0.45);
      const x = ze.x + 260 * (1 - saida(voo)), y = ze.y - 200 - Math.sin(voo * Math.PI) * 120 + 20 * voo;
      if (p < 0.55) {
        Desenho.coco(c, x, y, 26, true);
        c.strokeStyle = "#FF5A9E"; c.lineWidth = 5; c.beginPath(); c.moveTo(x + 6, y - 20); c.lineTo(x + 16, y - 44); c.lineTo(x + 28, y - 42); c.stroke();
      } else {
        c.strokeStyle = rgba("#C9FFD9", 1 - p);
        c.lineWidth = 4;
        for (let i = 0; i < 6; i++) { const lx = ze.x - 90 + i * 36; c.beginPath(); c.moveTo(lx, ze.y + 60 + (p * 400 + i * 50) % 120); c.lineTo(lx, ze.y + 130 + (p * 400 + i * 50) % 120); c.stroke(); }
      }
    },
    p2: Object.assign(function (c, p, ze) {
      const a = p < 0.12 ? suave(p / 0.12) : p > 0.85 ? 1 - suave((p - 0.85) / 0.15) : 1;
      c.globalAlpha = a;
      Desenho.escada(c, ze.x + 105, ze.y - 260, ze.y + 220, p * 2400);
      c.globalAlpha = 1;
    }, { camada: "atras" }),
    p3(c, p, ze) {
      const entra = lim(p / 0.2), sai = lim((p - 0.82) / 0.18);
      const x = ze.x - 500 * (1 - saida(entra)) + 700 * sai * sai;
      const y = ze.y - 360 - 160 * sai;
      Desenho.asaDelta(c, x, y, 1.15);
      if (sai === 0 && entra === 1) {
        /* barra da asa nas mãos dele */
        const mL = this.zePonto("maoL"), mR = this.zePonto("maoR");
        c.strokeStyle = "#222"; c.lineWidth = 3;
        c.beginPath(); c.moveTo(x, y + 92); c.lineTo(mL.x, mL.y); c.moveTo(x, y + 92); c.lineTo(mR.x, mR.y); c.stroke();
        c.strokeStyle = "#B8BCC8"; c.lineWidth = 7;
        c.beginPath(); c.moveTo(mL.x - 20, mL.y); c.lineTo(mR.x + 20, mR.y); c.stroke();
      }
    },
    p4: Object.assign(function (c, p, ze) {
      /* amarrado do lado do Zé, atrás dele: o Zé abraçado continua visível */
      const sai = lim((p - 0.8) / 0.2);
      const x = ze.x + 96 + sai * 300, y = ze.y - 60 - sai * 700;
      Desenho.foguete(c, x, y, 1.25, this.tempo);
      if (p < 0.85) {
        for (let i = 0; i < 3; i++) {
          this.particulas.push({ tipo: "fumaca", x: ze.x + 96 + (Math.random() - 0.5) * 40, wy: (this.vis + QUADRIL) * PX - 180, vx: (Math.random() - 0.5) * 80, vy: -40, vida: 0, dur: 1.2, tam: 26 + Math.random() * 20, cor: "#F2EDE6" });
        }
      }
    }, { camada: "atras" }),
    /* Derruba */
    p5(c, p, ze) {
      if (p > 0.6) return;
      const y = ze.y - 900 + saida(lim(p / 0.38)) * 720;
      const x = ze.x + (p > 0.38 ? (p - 0.38) * 600 : 0);
      Desenho.coco(c, x, p > 0.38 ? y - Math.sin((p - 0.38) / 0.22 * Math.PI) * 80 : y, 24);
      if (p > 0.36 && p < 0.5) {
        c.fillStyle = "#FFF"; c.font = "900 46px 'Big Shoulders Display', sans-serif"; c.textAlign = "center";
        c.fillText("TOC!", ze.x - 120, ze.y - 210);
      }
    },
    p6(c, p, ze) {
      const sobe = lim(p / 0.25), sai = lim((p - 0.8) / 0.2);
      const x = ze.x + 40 - sai * 260, y = ze.y + 330 - saida(sobe) * 200 + sai * 200;
      Desenho.sagui(c, x, y, 1.6, this.tempo);
      if (sai === 0 && sobe === 1) {
        const pe = this.zePonto("peR");
        c.strokeStyle = "#5A5048"; c.lineWidth = 9; c.lineCap = "round";
        c.beginPath(); c.moveTo(x - 10, y - 30); c.lineTo(pe.x, pe.y + 6); c.stroke();
      }
    },
    p7(c, p) {
      this.balanco = Math.max(this.balanco, 1.2 * (1 - p));
      this.folhasVoando(c, p, 16);
    },
    p8(c, p, ze) {
      const x = ze.x + 170, y = ze.y - 330;
      Desenho.bronzeador(c, x, y, 1.6, -2.3 + Math.sin(p * 30) * 0.08);
      if (p < 0.6) {
        c.fillStyle = "rgba(255,190,80,0.75)";
        for (let i = 0; i < 14; i++) {
          const k = (p * 3 + i / 14) % 1;
          c.beginPath(); c.arc(x - 60 - k * 120, y + 40 + k * 260 + Math.sin(i) * 10, 7 - k * 3, 0, Math.PI * 2); c.fill();
        }
      }
      c.strokeStyle = "rgba(255,236,170,0.75)"; c.lineWidth = 4; c.lineCap = "round";
      for (let i = 0; i < 8; i++) {
        const lado = i % 2 ? 1 : -1;
        const yy = ze.y - 300 + ((p * 1100 + i * 83) % 640);
        c.beginPath(); c.moveTo(ze.x + lado * 48, yy); c.lineTo(ze.x + lado * 46, yy + 36); c.stroke();
      }
    },
    p9(c, p, ze) {
      const desce = lim(p / 0.25), solta = lim((p - 0.75) / 0.25);
      const x = ze.x + (1 - saida(desce)) * 380 - solta * 500;
      const y = ze.y - 330 - (1 - saida(desce)) * 600 - solta * 300;
      if (desce === 1 && solta === 0) {
        /* pernas e garras do urubu nos ombros dele */
        const o = this.zePonto("ombros");
        c.strokeStyle = "#C9B79F"; c.lineWidth = 7; c.lineCap = "round";
        c.beginPath(); c.moveTo(x - 14, y + 40); c.lineTo(o.x - 46, o.y - 4); c.moveTo(x + 14, y + 40); c.lineTo(o.x + 46, o.y - 4); c.stroke();
        c.lineWidth = 4;
        for (const lado of [-1, 1]) {
          for (const d of [-10, 0, 10]) { c.beginPath(); c.moveTo(o.x + lado * 46, o.y - 4); c.lineTo(o.x + lado * 46 + d, o.y + 10); c.stroke(); }
        }
      }
      Desenho.urubu(c, x, y, 1.5, this.tempo);
    },
    rompe(c, p, ze, e) {
      const y = this.sy(e.alt);
      c.fillStyle = `rgba(255,255,255,${(1 - p) * 0.9})`;
      c.font = "900 64px 'Big Shoulders Display', sans-serif"; c.textAlign = "center";
      c.fillText("TREC!", this.L.x + 180, y - 20 - p * 60);
    },
    poeira(c, p) {
      const chao = this.sy(0);
      const a = 0.85 * (1 - p) * (1 - p);
      for (let i = 0; i < 14; i++) {
        const lado = i % 2 ? 1 : -1;
        const d = (40 + (i >> 1) * 34) * saida(lim(p * 1.6));
        const r = 26 + (i % 3) * 10 + p * 30;
        const x = this.L.x + lado * (70 + d), y = chao - 10 - Math.sin(p * Math.PI) * (20 + (i % 4) * 12);
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(240,214,170,${a})`); g.addColorStop(1, "rgba(240,214,170,0)");
        c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      }
    },
  },

  folhasVoando(c, p, n) {
    const L = this.L;
    for (let i = 0; i < n; i++) {
      const k = (p * 1.6 + i / n) % 1;
      const x = -80 + k * (L.W + 160);
      const y = L.H * (0.15 + ((i * 0.618) % 0.7)) + Math.sin(k * 12 + i) * 40;
      c.save(); c.translate(x, y); c.rotate(k * 20 + i);
      c.fillStyle = i % 2 ? "#4DAE45" : "#2F7A30";
      c.beginPath(); c.ellipse(0, 0, 18, 6, 0, 0, Math.PI * 2); c.fill();
      c.restore();
    }
  },

  vento(c) {
    const L = this.L, t = this.tempo;
    c.strokeStyle = `rgba(235,245,255,${lim(this.balanco * 0.35, 0, 0.5)})`;
    c.lineWidth = 3; c.lineCap = "round";
    for (let i = 0; i < 12; i++) {
      const y = (i * 173) % L.H;
      const x = ((t * 900 + i * 331) % (L.W + 400)) - 200;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 90, y - 12, x + 200, y); c.stroke();
    }
  },

  chuvaDeCoco(c, dt) {
    if (Math.random() < dt * 9) {
      this.particulas.push({ tipo: "coco", x: Math.random() * this.L.W, wy: (this.cam + (this.L.refY + 80) / PX) * PX, vx: 0, vy: -420 - Math.random() * 200, vida: 0, dur: 4, tam: 14 + Math.random() * 8, rot: 0, vr: (Math.random() - 0.5) * 6 });
    }
  },

  desenharParticulas(c, dt) {
    const base = this.cam * PX;
    this.particulas = this.particulas.filter(q => (q.vida += dt) < q.dur);
    if (this.particulas.length > 700) this.particulas.splice(0, this.particulas.length - 700);
    for (const q of this.particulas) {
      const a = 1 - q.vida / q.dur;
      q.x += q.vx * dt;
      q.wy += q.vy * dt;
      if (q.tipo === "confete") { q.vy -= 500 * dt; q.vx *= Math.exp(-1.5 * dt); q.vy = Math.max(q.vy, -260); q.rot += q.vr * dt; }
      else if (q.tipo === "faisca") { q.vx *= Math.exp(-4 * dt); q.vy *= Math.exp(-4 * dt); }
      else if (q.tipo === "fumaca") { q.tam += 40 * dt; }
      else if (q.tipo === "coco") { q.rot += q.vr * dt; }
      const y = this.L.refY - (q.wy - base);
      if (y < -80 || y > this.L.H + 80) continue;
      if (q.tipo === "coracao") Desenho.coracao(c, q.x, y, q.tam, rgba(q.cor, a));
      else if (q.tipo === "confete") {
        c.save(); c.translate(q.x, y); c.rotate(q.rot); c.fillStyle = q.cor; c.globalAlpha = Math.min(1, a * 2); c.fillRect(-q.tam / 2, -q.tam / 4, q.tam, q.tam / 2); c.restore();
      } else if (q.tipo === "fumaca") {
        const g = c.createRadialGradient(q.x, y, 0, q.x, y, q.tam);
        g.addColorStop(0, rgba(q.cor, a * 0.5)); g.addColorStop(1, rgba(q.cor, 0));
        c.fillStyle = g; c.beginPath(); c.arc(q.x, y, q.tam, 0, Math.PI * 2); c.fill();
      } else if (q.tipo === "coco") {
        Desenho.coco(c, q.x, y, q.tam, q.tam > 18);
      } else {
        c.fillStyle = rgba(q.cor, a); c.beginPath(); c.arc(q.x, y, q.tam * a, 0, Math.PI * 2); c.fill();
      }
    }
    c.globalAlpha = 1;
  },
};
