/* Desenho do palco em canvas: céu de desenho animado, a escada da tabela
   (degrau, placa e boneco de cada time), o buraco da Série B e os efeitos.
   Medidas em fração da largura (`u` = 1% de W) e da altura do palco, pra
   caber igual em 9:16 e em celular mais comprido. O estado do jogo vem da
   Tabela (regras.js); aqui só fica o que é animação. */
"use strict";

const OL = "#1d1433";
const OURO = "#ffc928";
const VERDE = "#2fd06b";
const VERMELHO = "#ff4a3d";
const LETRA = '"Lilita One", "Arial Rounded MT Bold", Impact, sans-serif';
const PELES = ["#f2c7a0", "#d9a074", "#a8693f", "#7a4a2a"];
const BRANCOS = ["#ffffff", "#f4f4f4"];

/* Faixa do título e do relógio abaixo do topo do TikTok; a escada vai de
   TOPO até FUNDO e o buraco fica no resto. */
const TOPO = 0.135, FUNDO = 0.86;

/* Placar curto: até 9.999 inteiro, depois "15 mil", "150 mil", "1,2 mi". */
function compacto(n) {
  n = Math.round(n);
  if (n < 10000) return n.toLocaleString("pt-BR");
  if (n < 1e6) return `${Math.floor(n / 1000)} mil`;
  return `${(Math.floor(n / 1e5) / 10).toLocaleString("pt-BR")} mi`;
}

/* Quebra em até duas linhas, no espaço mais perto do meio, em vez de
   espremer a letra com o maxWidth do canvas. */
function quebrar(ctx, texto, largura, separador = " ") {
  if (ctx.measureText(texto).width <= largura) return [texto];
  const partes = texto.split(separador);
  let melhor = null;
  for (let i = 1; i < partes.length; i++) {
    const a = partes.slice(0, i).join(separador), b = partes.slice(i).join(separador);
    const maior = Math.max(ctx.measureText(a).width, ctx.measureText(b).width);
    if (!melhor || maior < melhor.maior) melhor = { linhas: [a, b], maior };
  }
  return melhor ? melhor.linhas : [texto];
}

function caminhoArredondado(c, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

const Cena = {
  pops: [],
  confetes: [],
  faixas: [],
  nuvens: [],
  tremor: 0,
  flash: 0,
  carimbo: null,
  trofeu: null,
  sacode: null,
  chuvaDourada: 0,

  montar(canvas, cfg) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.cfg = cfg;
    this.N = cfg.times.length;
    this.bonecos = new Map(cfg.times.map((t, i) => [t.id, {
      ...t, x: 0, y: 0, salto: null, squash: 0, braco: 0, fase: Math.random() * 9,
      seta: null, caindo: null, foguete: 0, duplo: null, voo: null, pele: PELES[i % PELES.length],
    }]));
    for (let i = 0; i < 5; i++) this.nuvens.push({ x: Math.random(), y: 0.03 + Math.random() * 0.5, s: 0.6 + Math.random() * 0.7, v: 0.004 + Math.random() * 0.006 });
  },

  aplicarFormato(W, H, tabela) {
    this.W = this.canvas.width = W;
    this.H = this.canvas.height = H;
    this.u = W / 100;
    this.fundo = this.pintarFundo();
    for (const t of tabela.times) this.assentar(t.id, t.pos);
  },

  linhaH() { return (FUNDO - TOPO) * this.H / this.N; },
  linhaY(r) { return TOPO * this.H + (r + 0.74) * this.linhaH(); },
  posX(r) { return this.W * (0.6 + ((r * 3) % 4) * 0.095); },
  zona(r) { return r < this.cfg.zonas.topo ? "topo" : r >= this.N - this.cfg.zonas.queda ? "queda" : "meio"; },

  assentar(id, pos) {
    const b = this.bonecos.get(id);
    b.x = this.posX(pos);
    b.y = this.linhaY(pos);
    b.salto = null;
  },

  /* ───────── reações ───────── */

  mudou(id, de, para) {
    const b = this.bonecos.get(id);
    if (b.caindo) return;
    b.salto = { x0: b.x, y0: b.y, x1: this.posX(para), y1: this.linhaY(para), t: 0, dur: Math.min(0.9, 0.35 + Math.abs(de - para) * 0.08), alto: para < de };
    if (para < de) b.seta = { t: 0 };
  },

  comemorar(id) { this.bonecos.get(id).braco = 1; },

  pop(id, texto, grande = false) {
    const b = this.bonecos.get(id);
    this.pops.push({ x: b.x, y: b.y - this.linhaH() * 1.2, texto, t: 0, grande });
    if (this.pops.length > 14) this.pops.shift();
  },

  confete(id, n) {
    const b = this.bonecos.get(id), u = this.u;
    for (let i = 0; i < n; i++) {
      this.confetes.push({
        x: b.x, y: b.y - this.linhaH(), vx: (Math.random() - 0.5) * u * 1.6, vy: -Math.random() * u * 1.8,
        r: u * (0.5 + Math.random() * 0.6), giro: Math.random() * 6, vida: 1,
        cor: Math.random() < 0.5 ? b.cor : Math.random() < 0.5 ? b.cor2 : OURO,
      });
    }
    if (this.confetes.length > 500) this.confetes.splice(0, this.confetes.length - 500);
  },

  saltoDuplo(id) { this.bonecos.get(id).duplo = { t: 0 }; },

  foguete(id) {
    this.bonecos.get(id).foguete = 1.2;
    this.flash = 1;
    this.tremor = Math.max(this.tremor, 0.5);
  },

  /* Os degraus de quem está acima balançam: o terremoto é contra os rivais. */
  terremoto(id, pos) {
    this.sacode = { t: 0, dur: 1.8, acimaDe: pos };
    this.tremor = Math.max(this.tremor, 1.1);
    this.bonecos.get(id).braco = 1;
  },

  /* Vai direto ao topo na tela, mesmo antes dos pontos levarem ele lá. */
  lendario(id) {
    const b = this.bonecos.get(id);
    b.voo = { t: 0, dur: 2.6 };
    b.foguete = 2.6;
    this.flash = 1;
    this.tremor = Math.max(this.tremor, 0.8);
    this.chuvaDourada = 2.4;
  },

  faixa(texto, cor) {
    if (this.faixas.some(f => f.texto === texto)) return;
    this.faixas.push({ texto, cor, t: 0 });
    if (this.faixas.length > 2) this.faixas.shift();
  },

  cair(id) {
    const b = this.bonecos.get(id), u = this.u;
    b.salto = null;
    b.voo = null;
    b.caindo = { t: 0, x: b.x, y: b.y, vx: (Math.random() - 0.5) * u * 0.6 };
    this.tremor = Math.max(this.tremor, 0.35);
  },

  carimbar(nomes) {
    this.carimbo = { texto: "CAÍRAM!", nomes: nomes.join(" · "), t: 0 };
    this.tremor = Math.max(this.tremor, 0.8);
  },

  /* Os bonecos caem do céu nos degraus da rodada nova. */
  novaRodada(tabela) {
    this.carimbo = null;
    this.trofeu = null;
    for (const t of tabela.times) {
      const b = this.bonecos.get(t.id);
      b.caindo = null;
      b.voo = null;
      const x = this.posX(t.pos), y = this.linhaY(t.pos);
      b.x = x;
      b.y = y - this.H * 0.6;
      b.salto = { x0: x, y0: b.y, x1: x, y1: y, t: 0, dur: 0.8 + Math.random() * 0.4, alto: false };
    }
  },

  /* ───────── fundo (pintado uma vez) ───────── */

  pintarFundo() {
    const { W, H, u } = this;
    const tela = document.createElement("canvas");
    tela.width = W;
    tela.height = H;
    const c = tela.getContext("2d");
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#3fb4ff");
    g.addColorStop(0.55, "#a9e4ff");
    g.addColorStop(1, "#ffe9b8");
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    c.fillStyle = "rgba(255,255,255,.35)";
    for (let i = 0; i < 9; i++) {
      c.beginPath();
      c.moveTo(W * 0.15, -H * 0.05);
      c.arc(W * 0.15, -H * 0.05, H * 1.3, 0.9 + i * 0.14, 0.95 + i * 0.14);
      c.fill();
    }
    const px = W * 0.92, y0 = TOPO * H, y1 = FUNDO * H;
    c.fillStyle = "#b9824f";
    c.strokeStyle = OL;
    c.lineWidth = u * 0.7;
    c.beginPath();
    c.moveTo(W * 1.02, y0);
    for (let i = 0; i <= 20; i++) c.lineTo(px + Math.sin(i * 1.7) * u * 2.2, y0 + i * (y1 - y0) / 20);
    c.lineTo(W * 1.02, y1);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = "#9c6a3d";
    const pedras = Math.round((y1 - y0) / (H * 0.055));
    for (let i = 0; i < pedras; i++) {
      c.beginPath();
      c.ellipse(px + u * 4 + (i % 2) * u * 2, y0 + (i + 0.5) * H * 0.055, u * 1.6, u * 0.9, 0, 0, 6.28);
      c.fill();
    }
    return tela;
  },

  /* ───────── desenho ───────── */

  rr(x, y, w, h, r) { caminhoArredondado(this.ctx, x, y, w, h, r); },

  nuvensPassando(dt) {
    const { ctx, W, H, u } = this;
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = OL;
    ctx.lineWidth = u * 0.5;
    for (const n of this.nuvens) {
      n.x += n.v * dt;
      if (n.x > 1.2) n.x = -0.3;
      const x = n.x * W, y = n.y * H, s = n.s * u * 7;
      ctx.beginPath();
      ctx.arc(x, y, s, Math.PI, 0);
      ctx.arc(x + s * 1.3, y + s * 0.2, s * 0.8, Math.PI * 1.2, 0.2);
      ctx.arc(x - s * 1.2, y + s * 0.3, s * 0.7, Math.PI * 0.8, Math.PI * 1.9);
      ctx.closePath();
      ctx.globalAlpha = 0.9;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  },

  buraco(agora) {
    const { ctx, W, H, u } = this;
    const y = FUNDO * H, h = H - y;
    ctx.fillStyle = "#6fbf4a";
    ctx.strokeStyle = OL;
    ctx.lineWidth = u * 0.7;
    this.rr(-u, y - u * 0.5, W + u * 2, h + u, 0);
    ctx.fill();
    ctx.stroke();
    const cy = y + Math.min(h * 0.52, u * 14);
    const ry = Math.min(h * 0.36, u * 10);
    ctx.fillStyle = "#16112c";
    ctx.beginPath();
    ctx.ellipse(W * 0.58, cy, W * 0.4, ry, 0, 0, 6.28);
    ctx.fill();
    ctx.stroke();
    const gl = ctx.createRadialGradient(W * 0.58, cy + ry * 0.1, 0, W * 0.58, cy + ry * 0.1, W * 0.38);
    gl.addColorStop(0, "rgba(255,60,40,.55)");
    gl.addColorStop(1, "rgba(255,60,40,0)");
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.ellipse(W * 0.58, cy, W * 0.38, ry * 0.92, 0, 0, 6.28);
    ctx.fill();
    const piscar = (agora / 1000 % 3.2) < 0.12;
    for (const ox of [-0.08, 0.2]) {
      ctx.fillStyle = "#ffe14d";
      ctx.beginPath();
      ctx.ellipse(W * (0.58 + ox), cy - ry * 0.05, u * 1.8, piscar ? u * 0.2 : u * 1.1, 0, 0, 6.28);
      ctx.fill();
      if (!piscar) {
        ctx.fillStyle = OL;
        ctx.beginPath();
        ctx.arc(W * (0.58 + ox) + u * 0.4, cy, u * 0.55, 0, 6.28);
        ctx.fill();
      }
    }
    const ph = Math.min(h, u * 28);
    ctx.save();
    ctx.translate(W * 0.14, cy);
    ctx.rotate(-0.12);
    ctx.fillStyle = "#7a4a26";
    ctx.fillRect(-u * 0.8, -ph * 0.1, u * 1.6, ph * 0.55);
    ctx.fillStyle = "#c98b4f";
    this.rr(-u * 11, -ph * 0.38, u * 22, ph * 0.34, u * 1.5);
    ctx.fill();
    ctx.stroke();
    ctx.font = `${u * 5.2}px ${LETRA}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = u * 0.9;
    ctx.strokeText("SÉRIE B", 0, -ph * 0.2);
    ctx.fillStyle = "#ff5a3d";
    ctx.fillText("SÉRIE B", 0, -ph * 0.2);
    ctx.restore();
  },

  degrau(r, agora) {
    const { ctx, W, u } = this;
    const y = this.linhaY(r), lh = this.linhaH(), z = this.zona(r);
    let treme = z === "queda" ? Math.sin(agora / 45 + r) * u * 0.25 : 0;
    const s = this.sacode;
    if (s && r < s.acimaDe) treme += Math.sin(agora / 28 + r * 1.7) * u * 1.4 * (1 - s.t / s.dur);
    const x0 = W * 0.46;
    ctx.fillStyle = z === "topo" ? "#ffcf3d" : z === "queda" ? "#e0573f" : "#c98b4f";
    ctx.strokeStyle = OL;
    ctx.lineWidth = u * 0.55;
    this.rr(x0 + treme, y - lh * 0.02, W * 0.5, lh * 0.26, lh * 0.1);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(29,20,51,.35)";
    ctx.lineWidth = u * 0.3;
    ctx.beginPath();
    ctx.moveTo(x0 + W * 0.05 + treme, y + lh * 0.11);
    ctx.lineTo(x0 + W * 0.18 + treme, y + lh * 0.11);
    ctx.stroke();
    if (z === "queda") {
      ctx.beginPath();
      ctx.moveTo(x0 + W * 0.3 + treme, y);
      ctx.lineTo(x0 + W * 0.32 + treme, y + lh * 0.12);
      ctx.lineTo(x0 + W * 0.3 + treme, y + lh * 0.24);
      ctx.stroke();
    }
  },

  placa(t, b) {
    const { ctx, W, u } = this;
    const r = t.pos, y = this.linhaY(r), lh = this.linhaH(), z = this.zona(r);
    const x = W * 0.025, w = W * 0.42, h = lh * 0.86, top = y - h + lh * 0.2;
    ctx.fillStyle = z === "topo" ? "#fff4c9" : z === "queda" ? "#ffd9d2" : "#fffaf0";
    ctx.strokeStyle = OL;
    ctx.lineWidth = u * 0.5;
    this.rr(x, top, w, h, h * 0.3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = z === "topo" ? OURO : z === "queda" ? VERMELHO : "#5b4f8c";
    this.rr(x, top, h * 1.05, h, h * 0.3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = `${h * 0.5}px ${LETRA}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeText(r + 1, x + h * 0.52, top + h * 0.54);
    ctx.fillText(r + 1, x + h * 0.52, top + h * 0.54);
    ctx.fillStyle = b.cor;
    this.rr(x + h * 1.2, top + h * 0.2, h * 0.24, h * 0.6, h * 0.1);
    ctx.fill();
    ctx.stroke();
    if (b.padrao !== "liso" && b.padrao !== "mangas") {
      ctx.fillStyle = b.cor2;
      ctx.fillRect(x + h * 1.2 + h * 0.08, top + h * 0.26, h * 0.08, h * 0.48);
    }
    /* Nome nunca condensa: diminui inteiro até 77%; se ainda não couber ao
       lado dos pontos (placar alto), os pontos descem pra baixo do nome. */
    /* Em celular mais comprido a placa fica mais alta, não mais larga: a letra
       segue a largura. */
    const f = Math.min(h, W * 0.093);
    const pontos = compacto(t.pontos), xNome = x + h * 1.05 + f * 0.55, fim = x + w - f * 0.3;
    ctx.font = `900 ${f * 0.34}px Figtree, sans-serif`;
    const larguraPontos = ctx.measureText(pontos).width;
    ctx.font = `${f * 0.44}px ${LETRA}`;
    const larguraNome = ctx.measureText(t.nome).width;
    const aoLado = Math.min(1, (fim - xNome - larguraPontos - f * 0.2) / larguraNome);
    const embaixo = aoLado < 0.77;
    const escala = embaixo ? Math.min(1, (fim - xNome) / larguraNome) : aoLado;
    ctx.textAlign = "left";
    ctx.fillStyle = OL;
    ctx.font = `${f * 0.44 * escala}px ${LETRA}`;
    ctx.fillText(t.nome, xNome, top + h * (embaixo ? 0.36 : 0.54));
    ctx.textAlign = embaixo ? "left" : "right";
    ctx.font = `900 ${f * (embaixo ? 0.28 : 0.34)}px Figtree, sans-serif`;
    ctx.fillStyle = "#5b4f8c";
    ctx.fillText(pontos, embaixo ? xNome : fim, top + h * (embaixo ? 0.76 : 0.55));
    if (b.seta && b.seta.t < 1.6) {
      const a = Math.min(1, (1.6 - b.seta.t) * 3), sx = x + w + h * 0.3, sy = top + h * 0.5 - Math.sin(b.seta.t * 12) * h * 0.06;
      ctx.globalAlpha = a;
      ctx.fillStyle = VERDE;
      ctx.lineWidth = u * 0.45;
      ctx.beginPath();
      ctx.moveTo(sx, sy - h * 0.22);
      ctx.lineTo(sx + h * 0.2, sy + h * 0.14);
      ctx.lineTo(sx - h * 0.2, sy + h * 0.14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  },

  boneco(t, b, fase, agora, dt) {
    const { ctx, W, H, u } = this;
    const lh = this.linhaH(), s = lh * 1.15;
    let x = b.x, y = b.y, giro = 0;
    if (b.caindo) {
      const c = b.caindo;
      c.t += dt;
      if (c.t < 0.35) { x = c.x; y = c.y - Math.sin(c.t / 0.35 * Math.PI / 2) * lh * 1.2; }
      else {
        const q = c.t - 0.35;
        x = c.x + c.vx * q * 60;
        y = c.y - lh * 1.2 + q * q * H * 1.6;
        giro = q * 9;
      }
      if (y > H + s) return;
    }
    if (b.voo) {
      const v = b.voo, p = v.t / v.dur;
      const alto = TOPO * this.H + lh * 0.9;
      const ida = Math.min(1, p / 0.35), volta = p > 0.75 ? (p - 0.75) / 0.25 : 0;
      const sobe = 1 - (1 - ida) ** 3;
      y = b.y + (alto - b.y) * sobe * (1 - volta * volta);
      x = b.x + Math.sin(p * Math.PI * 3) * u * 1.5;
    }
    const z = this.zona(t.pos);
    const medo = (z === "queda" && fase === "rodada") || !!b.caindo;
    /* O lanterna fica pendurado pela mão na beira do degrau: é o "cai ou não cai". */
    const pendurado = t.pos === this.N - 1 && !b.caindo && !b.salto && !b.voo && fase === "rodada";
    if (medo && !b.caindo && !pendurado) x += Math.sin(agora / 30 + b.fase) * u * 0.35;
    if (this.sacode && t.pos < this.sacode.acimaDe && !b.caindo) x += Math.sin(agora / 25 + b.fase) * u * 1.2 * (1 - this.sacode.t / this.sacode.dur);
    let pulo = b.salto || pendurado ? 0 : Math.abs(Math.sin(agora / 260 + b.fase)) * lh * (z === "topo" ? 0.14 : 0.05);
    if (b.duplo) {
      const p = b.duplo.t / 0.95;
      pulo += Math.abs(Math.sin(p * Math.PI * 2)) * lh * (p < 0.5 ? 1.1 : 1.6);
    }
    const sq = 1 - b.squash * 0.25;
    if (t.pos === 0 && !b.caindo) {
      const brilho = ctx.createRadialGradient(x, y - s * 0.6, 0, x, y - s * 0.6, s * 1.3);
      brilho.addColorStop(0, "rgba(255,230,120,.75)");
      brilho.addColorStop(1, "rgba(255,230,120,0)");
      ctx.fillStyle = brilho;
      ctx.beginPath();
      ctx.arc(x, y - s * 0.6, s * 1.3, 0, 6.28);
      ctx.fill();
    }
    ctx.save();
    if (pendurado) {
      ctx.translate(W * 0.49, y + lh * 0.12);
      ctx.rotate(Math.sin(agora / 420 + b.fase) * 0.14);
      ctx.translate(0, s * 1.02);
    } else {
      ctx.translate(x, y - pulo);
      ctx.rotate(giro);
      ctx.scale(1 + (1 - sq) * 0.8, sq);
    }
    ctx.lineWidth = s * 0.05;
    ctx.strokeStyle = OL;
    ctx.lineJoin = "round";

    if (b.foguete > 0) {
      const tam = b.voo ? 1.6 : 1;
      ctx.fillStyle = "#ff9b1f";
      ctx.beginPath();
      ctx.moveTo(-s * 0.16, 0);
      ctx.lineTo(0, s * (0.5 + Math.random() * 0.3) * tam);
      ctx.lineTo(s * 0.16, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ffe14d";
      ctx.beginPath();
      ctx.moveTo(-s * 0.08, 0);
      ctx.lineTo(0, s * 0.3 * tam);
      ctx.lineTo(s * 0.08, 0);
      ctx.fill();
    }
    const calcao = BRANCOS.includes(b.cor2) ? "#f4f4f4" : b.cor2;
    ctx.fillStyle = calcao;
    this.rr(-s * 0.13, -s * 0.17, s * 0.1, s * 0.17, s * 0.03);
    ctx.fill();
    ctx.stroke();
    this.rr(s * 0.03, -s * 0.17, s * 0.1, s * 0.17, s * 0.03);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = OL;
    this.rr(-s * 0.16, -s * 0.04, s * 0.14, s * 0.06, s * 0.03);
    ctx.fill();
    this.rr(s * 0.02, -s * 0.04, s * 0.14, s * 0.06, s * 0.03);
    ctx.fill();
    ctx.fillStyle = BRANCOS.includes(b.cor2) ? "#ffffff" : b.cor2;
    this.rr(-s * 0.17, -s * 0.3, s * 0.34, s * 0.15, s * 0.04);
    ctx.fill();
    ctx.stroke();

    const levanta = b.braco > 0 || b.voo || (z === "topo" && Math.sin(agora / 400 + b.fase) > 0.6);
    for (const lado of [-1, 1]) {
      ctx.save();
      ctx.translate(lado * s * 0.2, -s * 0.5);
      ctx.rotate(pendurado ? lado * -2.95 : lado * (levanta ? -2.4 : medo ? -2.9 + Math.sin(agora / 60) * 0.3 : -0.35));
      if (pendurado) ctx.scale(1, 1.9);
      ctx.fillStyle = b.padrao === "mangas" ? b.cor2 : b.cor;
      this.rr(-s * 0.055, -s * 0.01, s * 0.11, s * 0.09, s * 0.04);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = b.pele;
      this.rr(-s * 0.05, s * 0.06, s * 0.1, s * 0.18, s * 0.05);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    this.camisa(b, s);

    const hy = -s * 0.8, hr = s * 0.24;
    ctx.fillStyle = b.pele;
    ctx.beginPath();
    ctx.arc(0, hy, hr, 0, 6.28);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = OL;
    ctx.beginPath();
    ctx.arc(0, hy - hr * 0.1, hr * 1.02, Math.PI * 1.08, Math.PI * 1.92);
    ctx.lineTo(hr * 0.6, hy - hr * 0.55);
    ctx.lineTo(-hr * 0.6, hy - hr * 0.55);
    ctx.fill();
    const pisca = ((agora / 1000 + b.fase) % 4) < 0.1;
    for (const lado of [-1, 1]) {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.ellipse(lado * hr * 0.38, hy, hr * 0.25, pisca ? hr * 0.04 : hr * (medo ? 0.34 : 0.28), 0, 0, 6.28);
      ctx.fill();
      ctx.lineWidth = s * 0.03;
      ctx.stroke();
      if (!pisca) {
        ctx.fillStyle = OL;
        ctx.beginPath();
        ctx.arc(lado * hr * 0.38 + (medo ? 0 : hr * 0.05), hy + (medo ? -hr * 0.05 : hr * 0.04), hr * (medo ? 0.09 : 0.12), 0, 6.28);
        ctx.fill();
      }
    }
    ctx.lineWidth = s * 0.035;
    ctx.fillStyle = "#7a1d2a";
    if (medo) {
      ctx.beginPath();
      ctx.ellipse(0, hy + hr * 0.52, hr * 0.2, hr * 0.26, 0, 0, 6.28);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-hr * 0.62, hy - hr * 0.42);
      ctx.lineTo(-hr * 0.18, hy - hr * 0.3);
      ctx.moveTo(hr * 0.62, hy - hr * 0.42);
      ctx.lineTo(hr * 0.18, hy - hr * 0.3);
      ctx.stroke();
      ctx.fillStyle = "#7fd4ff";
      ctx.beginPath();
      ctx.moveTo(hr * 0.95, hy - hr * 0.5);
      ctx.quadraticCurveTo(hr * 1.2, hy - hr * 0.05, hr * 0.95, hy);
      ctx.quadraticCurveTo(hr * 0.72, hy - hr * 0.05, hr * 0.95, hy - hr * 0.5);
      ctx.fill();
      ctx.lineWidth = s * 0.02;
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(0, hy + hr * 0.3, hr * (z === "topo" || b.braco > 0 ? 0.42 : 0.3), 0.15, Math.PI - 0.15);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    if (t.presidente) this.coroa(hy - hr * 1.05, hr, s);
    if (this.trofeu === t.id && !b.caindo) this.taca(s * 0.42, hy - hr * 0.5 - Math.abs(Math.sin(agora / 300)) * hr * 0.3, hr * 1.3);
    ctx.restore();
  },

  camisa(b, s) {
    const ctx = this.ctx;
    this.rr(-s * 0.22, -s * 0.58, s * 0.44, s * 0.31, s * 0.1);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = b.cor;
    ctx.fillRect(-s * 0.3, -s * 0.6, s * 0.6, s * 0.4);
    ctx.fillStyle = b.cor2;
    if (b.padrao === "listras") for (let i = -2; i <= 2; i += 2) ctx.fillRect(i * s * 0.09 - s * 0.045, -s * 0.6, s * 0.09, s * 0.4);
    if (b.padrao === "horiz") for (let i = 0; i < 4; i += 2) ctx.fillRect(-s * 0.3, -s * 0.58 + i * s * 0.078, s * 0.6, s * 0.078);
    if (b.padrao === "faixa") {
      ctx.fillRect(-s * 0.3, -s * 0.49, s * 0.6, s * 0.06);
      ctx.fillStyle = "#111111";
      ctx.fillRect(-s * 0.3, -s * 0.43, s * 0.6, s * 0.035);
    }
    if (b.padrao === "mangas") ctx.fillRect(-s * 0.3, -s * 0.6, s * 0.6, s * 0.045);
    if (b.padrao === "diagonal") {
      ctx.beginPath();
      ctx.moveTo(-s * 0.25, -s * 0.6);
      ctx.lineTo(-s * 0.1, -s * 0.6);
      ctx.lineTo(s * 0.25, -s * 0.3);
      ctx.lineTo(s * 0.1, -s * 0.25);
      ctx.closePath();
      ctx.fill();
    }
    const claro = BRANCOS.includes(b.cor);
    ctx.font = `${s * 0.17}px ${LETRA}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = s * 0.03;
    ctx.strokeStyle = claro ? "#fff" : OL;
    ctx.fillStyle = claro ? OL : "#fff";
    ctx.strokeText(b.numero, 0, -s * 0.42);
    ctx.fillText(b.numero, 0, -s * 0.42);
    ctx.strokeStyle = OL;
    ctx.restore();
    this.rr(-s * 0.22, -s * 0.58, s * 0.44, s * 0.31, s * 0.1);
    ctx.lineWidth = s * 0.05;
    ctx.stroke();
  },

  coroa(cy, hr, s) {
    const ctx = this.ctx;
    ctx.fillStyle = OURO;
    ctx.lineWidth = s * 0.035;
    ctx.beginPath();
    ctx.moveTo(-hr * 0.55, cy + hr * 0.35);
    ctx.lineTo(-hr * 0.6, cy - hr * 0.2);
    ctx.lineTo(-hr * 0.25, cy + hr * 0.05);
    ctx.lineTo(0, cy - hr * 0.35);
    ctx.lineTo(hr * 0.25, cy + hr * 0.05);
    ctx.lineTo(hr * 0.6, cy - hr * 0.2);
    ctx.lineTo(hr * 0.55, cy + hr * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = VERMELHO;
    ctx.beginPath();
    ctx.arc(0, cy + hr * 0.12, hr * 0.09, 0, 6.28);
    ctx.fill();
  },

  /* Troféu da rodada, erguido sobre a cabeça do líder. */
  taca(x, y, r) {
    const ctx = this.ctx, u = this.u;
    ctx.save();
    ctx.translate(x, y);
    ctx.lineWidth = u * 0.45;
    ctx.strokeStyle = OL;
    ctx.fillStyle = OURO;
    for (const lado of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(lado * r * 0.42, -r * 0.55, r * 0.2, r * 0.22, 0, 0, 6.28);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-r * 0.45, -r * 0.85);
    ctx.lineTo(r * 0.45, -r * 0.85);
    ctx.quadraticCurveTo(r * 0.42, -r * 0.2, 0, -r * 0.12);
    ctx.quadraticCurveTo(-r * 0.42, -r * 0.2, -r * 0.45, -r * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(-r * 0.06, -r * 0.14, r * 0.12, r * 0.22);
    ctx.strokeRect(-r * 0.06, -r * 0.14, r * 0.12, r * 0.22);
    this.rr(-r * 0.28, r * 0.06, r * 0.56, r * 0.16, r * 0.04);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.7)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.2, -r * 0.6, r * 0.06, r * 0.16, 0.2, 0, 6.28);
    ctx.fill();
    ctx.restore();
  },

  bandeirinhas(agora) {
    const { ctx, W, H, u } = this;
    const y = TOPO * H * 0.94, cores = [VERMELHO, OURO, VERDE, "#3aa6ee", "#fff"];
    ctx.strokeStyle = OL;
    ctx.lineWidth = u * 0.35;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.quadraticCurveTo(W / 2, y + u * 3, W, y);
    ctx.stroke();
    for (let i = 0; i < 16; i++) {
      const p = (i + 0.5) / 16, x = p * W, yy = y + Math.sin(p * Math.PI) * u * 1.5, bal = Math.sin(agora / 300 + i) * u * 0.5;
      ctx.fillStyle = cores[i % cores.length];
      ctx.beginPath();
      ctx.moveTo(x - u * 2, yy);
      ctx.lineTo(x + u * 2, yy);
      ctx.lineTo(x + bal, yy + u * 3.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  },

  /* Título e relógio, na faixa logo abaixo do topo do TikTok. */
  cabecalho(tabela) {
    const { ctx, W, H, u } = this;
    const meio = TOPO * H * 0.62, h = u * 10;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${u * 8.2}px ${LETRA}`;
    ctx.lineWidth = u * 1.6;
    ctx.strokeStyle = OL;
    ctx.lineJoin = "round";
    ctx.strokeText(this.cfg.titulo.toUpperCase(), W * 0.4, meio, W * 0.72);
    ctx.fillStyle = OURO;
    ctx.fillText(this.cfg.titulo.toUpperCase(), W * 0.4, meio, W * 0.72);
    const jogando = tabela.fase === "rodada";
    const urg = jogando && tabela.resta() <= 10;
    const bate = urg ? 1 + Math.max(0, Math.sin(tabela.resta() * Math.PI * 2)) * 0.08 : 1;
    ctx.save();
    ctx.translate(W * 0.875, meio);
    ctx.scale(bate, bate);
    ctx.fillStyle = urg ? VERMELHO : "#fffaf0";
    ctx.lineWidth = u * 0.6;
    this.rr(-W * 0.095, -h * 0.5, W * 0.19, h, h * 0.5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = urg ? "#fff" : OL;
    ctx.font = `${u * 5.8}px ${LETRA}`;
    let rotulo = "FIM";
    if (jogando) {
      const s = Math.ceil(tabela.resta());
      rotulo = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    }
    ctx.fillText(rotulo, 0, u * 0.3);
    ctx.restore();
  },

  efeitos(dt) {
    const { ctx, W, H, u } = this;
    this.pops = this.pops.filter(p => (p.t += dt) < 1.4);
    ctx.lineJoin = "round";
    for (const p of this.pops) {
      const a = Math.min(1, (1.4 - p.t) * 2.5), tam = u * (p.grande ? 4.4 : 3.2) * Math.min(1, 0.5 + p.t * 4);
      ctx.globalAlpha = a;
      ctx.font = `${tam}px ${LETRA}`;
      ctx.textAlign = "center";
      const px = Math.min(W * 0.8, Math.max(W * 0.62, p.x)), py = Math.max(TOPO * H + u * 4, p.y - p.t * u * 6);
      ctx.lineWidth = u * 0.8;
      ctx.strokeStyle = OL;
      ctx.strokeText(p.texto, px, py, W * 0.6);
      ctx.fillStyle = p.grande ? OURO : "#fff";
      ctx.fillText(p.texto, px, py, W * 0.6);
    }
    ctx.globalAlpha = 1;

    if (this.chuvaDourada > 0) {
      this.chuvaDourada -= dt;
      for (let i = 0; i < 4; i++) {
        this.confetes.push({ x: Math.random() * W, y: -u * 2, vx: (Math.random() - 0.5) * u * 0.3, vy: u * (0.4 + Math.random() * 0.6),
          r: u * (0.5 + Math.random() * 0.5), giro: Math.random() * 6, vida: 1.6, cor: Math.random() < 0.7 ? OURO : "#fff6c2" });
      }
    }
    const passo = dt * 60;
    this.confetes = this.confetes.filter(c => (c.vida -= dt * 0.5) > 0 && c.y < H + u * 4);
    for (const c of this.confetes) {
      c.x += c.vx * passo;
      c.y += c.vy * passo;
      c.vy += u * 0.06 * passo;
      c.vx *= Math.pow(0.98, passo);
      c.giro += 0.2 * passo;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.giro);
      ctx.fillStyle = c.cor;
      ctx.fillRect(-c.r, -c.r * 0.5, c.r * 2, c.r);
      ctx.restore();
    }

    this.faixas = this.faixas.filter(f => (f.t += dt) < 2.6);
    /* Faixas só sobre os degraus (à direita das placas), nas linhas 2 a 5:
       a tabela fica sempre legível. */
    const xFaixa = W * 0.47, largFaixa = W * 0.515;
    let yFaixa = this.linhaY(1) - this.linhaH() * 0.4;
    this.faixas.forEach(f => {
      const entra = Math.min(1, f.t * 5), sai = f.t > 2.2 ? (f.t - 2.2) / 0.4 : 0;
      ctx.save();
      ctx.font = `${u * 3.6}px ${LETRA}`;
      const linhas = quebrar(ctx, f.texto, largFaixa - u * 5);
      const alto = u * (2.4 + linhas.length * 4.2);
      ctx.translate(xFaixa + largFaixa / 2 + ((1 - entra) - sai) * W * 0.6, yFaixa + alto / 2);
      ctx.rotate(-0.02);
      ctx.globalAlpha = 1 - sai;
      ctx.fillStyle = f.cor;
      ctx.strokeStyle = OL;
      ctx.lineWidth = u * 0.7;
      this.rr(-largFaixa / 2, -alto / 2, largFaixa, alto, u * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = u * 0.8;
      linhas.forEach((l, k) => {
        const ly = (k - (linhas.length - 1) / 2) * u * 4.2 + u * 0.3;
        ctx.strokeText(l, 0, ly);
        ctx.fillText(l, 0, ly);
      });
      ctx.restore();
      yFaixa += alto + u * 1.6;
    });

    const c = this.carimbo;
    if (c) {
      c.t += dt;
      const e = Math.max(1, 3 - c.t * 8);
      ctx.save();
      ctx.translate(W / 2, H * 0.45);
      ctx.rotate(-0.12);
      ctx.scale(e, e);
      ctx.font = `${u * 17}px ${LETRA}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = u * 2.4;
      ctx.strokeStyle = OL;
      ctx.strokeText(c.texto, 0, 0);
      ctx.fillStyle = VERMELHO;
      ctx.fillText(c.texto, 0, 0);
      ctx.restore();
      /* Os nomes numa tarja escura reta, que cobre as placas de baixo inteiras
         em vez de passar por cima das letras delas. */
      if (c.t > 0.25) {
        ctx.save();
        ctx.font = `${u * 4.6}px ${LETRA}`;
        const linhas = quebrar(ctx, c.nomes, W * 0.86, " · ").map((l, k, todas) => k < todas.length - 1 ? l + " ·" : l);
        const larg = Math.min(W * 0.94, Math.max(...linhas.map(l => ctx.measureText(l).width)) + u * 8);
        const alto = u * (3 + linhas.length * 5.6), topo = H * 0.45 + u * 10;
        ctx.globalAlpha = Math.min(1, (c.t - 0.25) * 4);
        ctx.fillStyle = "rgba(29,20,51,.94)";
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = u * 0.5;
        this.rr(W / 2 - larg / 2, topo, larg, alto, u * 2.4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        linhas.forEach((l, k) => ctx.fillText(l, W / 2, topo + u * 1.5 + (k + 0.5) * u * 5.6 + u * 0.3));
        ctx.restore();
      }
    }
  },

  animar(dt) {
    const lh = this.linhaH();
    for (const b of this.bonecos.values()) {
      if (b.seta) b.seta.t += dt;
      if (b.salto) {
        const s = b.salto;
        s.t += dt;
        const p = Math.min(1, s.t / s.dur), e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
        b.x = s.x0 + (s.x1 - s.x0) * e;
        b.y = s.y0 + (s.y1 - s.y0) * e - Math.sin(p * Math.PI) * lh * (s.alto ? 2.2 : 0.8);
        if (p >= 1) { b.salto = null; b.squash = 1; }
      }
      if (b.duplo && (b.duplo.t += dt) >= 0.95) { b.duplo = null; b.squash = 1; }
      if (b.voo && (b.voo.t += dt) >= b.voo.dur) { b.voo = null; b.squash = 1; }
      b.squash = Math.max(0, b.squash - dt * 4);
      b.braco = Math.max(0, b.braco - dt * 1.2);
      b.foguete = Math.max(0, b.foguete - dt);
    }
    if (this.sacode && (this.sacode.t += dt) >= this.sacode.dur) this.sacode = null;
    this.tremor = Math.max(0, this.tremor - dt);
  },

  quadro(tabela, dt, agora) {
    const { ctx, W, H, u } = this;
    this.animar(dt);
    ctx.save();
    if (this.tremor > 0) ctx.translate((Math.random() - 0.5) * u * 2 * this.tremor, (Math.random() - 0.5) * u * 2 * this.tremor);
    ctx.drawImage(this.fundo, 0, 0);
    this.nuvensPassando(dt);
    this.bandeirinhas(agora);
    for (let r = 0; r < this.N; r++) this.degrau(r, agora);
    for (const t of tabela.times) {
      const b = this.bonecos.get(t.id);
      if (!b.caindo) this.placa(t, b);
    }
    this.buraco(agora);
    /* O líder fica rente ao título: o boneco vai na frente, senão a coroa e
       o troféu somem atrás das letras. */
    this.cabecalho(tabela);
    const ordem = tabela.times.map(t => [t, this.bonecos.get(t.id)]).sort((a, b) => a[1].y - b[1].y);
    for (const [t, b] of ordem) this.boneco(t, b, tabela.fase, agora, dt);
    this.efeitos(dt);
    ctx.restore();
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,250,220,${this.flash * 0.55})`;
      ctx.fillRect(0, 0, W, H);
      this.flash = Math.max(0, this.flash - dt * 2.5);
    }
  },
};
