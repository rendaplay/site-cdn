/* As duas torres em canvas: peças caindo, encaixe, balanço, lascas que
   caem, impacto do presente grande, a placa com a foto no topo, a régua do
   meio e o confete. Não decide nada: a regra diz quantos metros cada
   presente vale e a Tela chama `empilhar`.

   Altura é 1 moeda = 1 metro na mesma escala pros dois lados, mas cada peça
   tem altura mínima na tela (senão a rosa vira 1 px debaixo de um Leão).
   Por isso o lado de trás no placar é comprimido quando as mínimas o deixam
   mais alto: a torre mais alta na tela é sempre a que está ganhando. A
   largura das peças é fixa em px; só a altura acompanha o zoom da câmera,
   que abre conforme a torre mais alta cresce.

   Balanço: o topo anda `s` px (mola amortecida que leva o tranco de cada
   peça) mais um vai-e-vem do vento que cresce com a altura; a peça na
   altura y anda s·(y/H)², como uma haste presa no chão. */
"use strict";

const CENAS = {
  vertical: { W: 1080, H: 1920, chao: 1650, teto: 940, xs: [390, 690], larg: 250, regua: 540 },
  horizontal: { W: 1920, H: 1080, chao: 930, teto: 450, xs: [720, 1200], larg: 280, regua: 960 },
};
const ESCALA_MAX = 30;
const GRAVIDADE = 2200;
const PLACA = { w: 150, foto: 124, faixa: 50, haste: 30 };

/* Faixa de moedas → peça. `espalha` é o quanto ela pode cair fora do
   centro (fração da largura); passou de `ERRO_LASCA`, lasca a ponta. */
const TIPOS = [
  { nome: "tijolo", de: 0, larg: [0.64, 0.8], espalha: 0.19, impacto: 0, min: 14 },
  { nome: "caixa", de: 5, larg: [0.7, 0.86], espalha: 0.19, impacto: 0, min: 18 },
  { nome: "bloco", de: 30, larg: [0.8, 0.94], espalha: 0.18, impacto: 0.12, min: 24 },
  { nome: "grande", de: 100, larg: [0.94, 1], espalha: 0.05, impacto: 0.45, min: 32 },
  { nome: "enorme", de: 500, larg: [1, 1], espalha: 0, impacto: 0.75, min: 40 },
  { nome: "mega", de: 1000, larg: [1, 1], espalha: 0, impacto: 1, min: 48 },
];
/* Peça do comentário: estreita e baixa, pra nunca parecer presente. */
const TIJOLINHO = { nome: "tijolinho", de: 0, larg: [0.4, 0.46], espalha: 0.12, impacto: 0, min: 16 };

/* Ataque do presente grande na torre rival. `antes` é a animação até o
   impacto (a bola balançando, o raio descendo); `dura` é o total. */
const ATAQUES = {
  vento: { antes: 0.35, dura: 1.4 },
  raio: { antes: 0.3, dura: 1.0 },
  bola: { antes: 0.8, dura: 2.0 },
  terremoto: { antes: 0.3, dura: 2.6 },
};

/* `min` é a altura mínima da peça em px no vertical (espaço de torre de
   790 px); os outros formatos escalam pelo espaço que têm. */
const ESPACO_REF = 790;
const ERRO_LASCA = 0.15;
const FONTE_TXT = '"Figtree", "Segoe UI", system-ui, sans-serif';
const FONTE_NUM = '"Big Shoulders Display", "Arial Narrow", Impact, sans-serif';
const fmtM = new Intl.NumberFormat("pt-BR");
const fmtM1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
/* Tijolinho vale fração de metro: abaixo de 10 m mostra a casa decimal. */
function numeroMetros(n) { return Math.abs(n) < 10 ? fmtM1.format(n) : fmtM.format(Math.round(n)); }

function rgbDe(h) { return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); }
function tom(hex, com, peso) {
  const a = rgbDe(hex);
  const b = rgbDe(com);
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * peso)).join(",")})`;
}
function clarear(hex, peso) {
  return "#" + rgbDe(hex).map(v => Math.round(v + (255 - v) * peso).toString(16).padStart(2, "0")).join("");
}
function rgba(hex, alfa) { return `rgba(${rgbDe(hex).join(",")},${alfa})`; }
function luminancia(hex) {
  const [r, g, b] = rgbDe(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
function retangulo(c, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function caberTexto(c, texto, largura) {
  if (c.measureText(texto).width <= largura) return texto;
  let t = [...texto];
  while (t.length > 1 && c.measureText(t.join("") + "…").width > largura) t.pop();
  return t.join("") + "…";
}
function tipoPorMoedas(m) {
  let t = TIPOS[0];
  for (const x of TIPOS) if (m >= x.de) t = x;
  return t;
}

const Torres = {
  L: CENAS.vertical,
  esc: ESCALA_MAX,
  minF: 1,
  fator: [1, 1],
  torres: [],
  lascas: [],
  ruinas: [],
  particulas: [],
  aneis: [],
  ataques: [],
  flash: 0,
  tremor: 0,
  t: 0,
  travada: false,
  soEfeitos: false,
  dobroLado: -1,
  aoPousar: () => {},

  montar(canvas, cfg) {
    this.canvas = canvas;
    this.c = canvas.getContext("2d");
    this.cfg = cfg;
    /* A foto vira um canvas 3:4 (o quadro das fotos e ilustrações): SVG só
       com viewBox não tem tamanho próprio e o recorte direto sai vazio. */
    this.fotos = cfg.lados.map(() => null);
    cfg.lados.forEach((l, i) => {
      const img = new Image();
      img.onload = () => {
        const quadro = document.createElement("canvas");
        quadro.width = 600;
        quadro.height = 800;
        quadro.getContext("2d").drawImage(img, 0, 0, 600, 800);
        this.fotos[i] = quadro;
      };
      img.src = l.foto;
    });
    this.icones = cfg.lados.map(l => {
      if (!l.presente.imagem) return null;
      const img = new Image();
      img.src = l.presente.imagem;
      return img;
    });
    this.torres = cfg.lados.map(() => this.novaTorre());
  },

  formato(nome) {
    this.L = CENAS[nome];
    this.canvas.width = this.L.W;
    this.canvas.height = this.L.H;
  },

  novaTorre() {
    return { pecas: [], altura: 0, fila: [], voando: [], ultimoX: 0, s: 0, v: 0, fase: Math.random() * 6, placa: { a: 0, v: 0 }, susto: 0 };
  },

  /* ───────── peças ───────── */

  /* Combo de presente barato vira várias peças (rosa ×10 = 8 tijolos);
     presente de 100+ chega em 3 a 5 peças, pra continuar parecendo torre. */
  empilhar(a) {
    const torre = this.torres[a.lado];
    if (a.tijolinho) {
      const [l0, l1] = TIJOLINHO.larg;
      torre.fila.push({
        m: a.pontos, w: this.L.larg * (l0 + Math.random() * (l1 - l0)), tipo: TIJOLINHO,
        quem: a.quem, lado: a.lado, cor: clarear(this.cfg.lados[a.lado].cor, 0.55),
        luz: 0, valor: null, ultima: true, evento: a,
      });
      return;
    }
    const unidade = a.pontos / Math.max(1, a.quantidade);
    let n = 1;
    let tipo = tipoPorMoedas(a.pontos);
    if (a.quantidade > 1 && unidade < 30) {
      n = Math.min(8, a.quantidade);
      tipo = tipoPorMoedas(a.pontos / n);
    } else if (a.pontos >= 100) n = a.pontos >= 2000 ? 5 : a.pontos >= 500 ? 4 : 3;
    const lado = this.cfg.lados[a.lado];
    for (let i = 0; i < n; i++) {
      const [l0, l1] = tipo.larg;
      torre.fila.push({
        m: a.pontos / n,
        w: this.L.larg * (l0 + Math.random() * (l1 - l0)),
        tipo,
        quem: a.quem,
        lado: a.lado,
        cor: lado.cor,
        luz: (torre.pecas.length + torre.fila.length) % 3,
        dobrado: a.dobrado && i === 0,
        valor: i === 0 ? a.pontos : null,
        ultima: i === n - 1,
        evento: a,
      });
    }
  },

  /* Várias peças no ar ao mesmo tempo, assentando na ordem: chuva de rosa
     não pode deixar a torre segundos atrás do placar. Fila muito longa
     assenta direto, sem queda. */
  soltar(i, torre) {
    while (torre.fila.length > 24) this.pousar(i, torre, this.mirar(torre, torre.fila.shift()), true);
    const p = this.mirar(torre, torre.fila.shift());
    const T = Math.max(0.24, 0.5 - torre.fila.length * 0.02) + p.tipo.impacto * 0.22;
    torre.voando.push({ peca: p, t: 0, T, giro: (Math.random() - 0.5) * 0.5 });
  },

  /* Onde a peça vai cair: perto do centro, puxando de volta pro eixo. */
  mirar(torre, p) {
    p.x = torre.ultimoX * 0.45 + (Math.random() * 2 - 1) * p.tipo.espalha * p.w;
    torre.ultimoX = p.x;
    return p;
  },

  intervaloSoltar(torre) { return Math.max(0.05, 0.26 - torre.fila.length * 0.02); },

  pousar(i, torre, p, calado = false) {
    const topo = torre.pecas[torre.pecas.length - 1];
    const apoio = topo ? topo : { x: 0, w: this.L.larg + 60 };
    const erro = p.x - apoio.x;
    const hp = this.hpx(p, i);
    const x0 = this.L.xs[i];
    const base = this.alturaPx(torre, i);
    const H = base + hp;
    const yPouso = this.L.chao - base - hp / 2;
    const massa = 0.35 + p.tipo.impacto;
    let lascou = false;

    if (p.tipo.impacto < 0.4 && Math.abs(erro) > ERRO_LASCA * Math.min(p.w, apoio.w)) {
      const lado = Math.sign(erro);
      const lw = Math.min(p.w * 0.34, Math.max(22, Math.abs(erro) * 1.4));
      p.w -= lw;
      p.x -= lado * lw / 2;
      this.lascas.push({
        x: x0 + p.x + lado * (p.w / 2 + lw / 2), y: yPouso, w: lw, h: Math.max(6, hp),
        vx: lado * (90 + Math.random() * 120), vy: -120 - Math.random() * 120,
        a: 0, va: lado * (2.5 + Math.random() * 3), cor: p.cor, luz: p.luz, vida: 0, quicou: 0,
      });
      lascou = true;
    }
    p.nasc = this.t;
    torre.pecas.push(p);
    torre.altura += p.m;

    const w = this.omega(H);
    torre.v += Math.sign(erro || Math.random() - 0.5) * (8 + H * 0.03) * massa * w * (lascou ? 1.4 : 0.5);
    if (p.tipo.impacto >= 0.4) {
      const f = p.tipo.impacto;
      torre.v += (Math.random() < 0.5 ? -1 : 1) * (22 + H * 0.05) * f * w;
      this.tremor = Math.max(this.tremor, 10 + f * 26);
      const outra = this.torres[1 - i];
      if (outra) outra.susto = Math.max(outra.susto, f * 14);
      const cores = [p.cor, this.cfg.lados[i].acento, "#FFFFFF", "#FFD45A"];
      this.explodir(x0 + p.x, yPouso, cores, 40 + f * 110, 9 + f * 14);
      this.poeira(x0 + p.x, yPouso + hp / 2, p.w, 10 + f * 20);
      this.poeira(x0, this.L.chao, this.L.larg + 80, 6 + f * 14);
      this.aneis.push({ x: x0 + p.x, y: yPouso, r: p.w * 0.4, vida: 0, cor: "#FFFFFF" });
    } else {
      this.poeira(x0 + p.x, yPouso + hp / 2, p.w, 3 + p.tipo.impacto * 20);
    }
    if (p.dobrado) this.explodir(x0 + p.x, yPouso, ["#FFD45A", "#FFFFFF"], 50, 12);
    if (!calado) {
      if (p.tipo.impacto >= 0.4) Som.impacto(p.tipo.impacto);
      else Som.encaixe(Math.min(1, p.tipo.impacto * 4 + (p.tipo.nome === "caixa" ? 0.3 : 0)));
      if (lascou) Som.queda();
    }
    if (p.ultima) this.aoPousar(p.evento, i);
  },

  omega(Hpx) { return 2 * Math.PI * (1.15 / (1 + Hpx / 420)); },

  /* ───────── fim de rodada ───────── */

  /* A torre que perdeu desaba; a que ganhou fica de pé até a tela de
     vitória cobrir, e só aí as duas zeram (`zerar`). Presente que chega
     nesse meio-tempo espera na fila e cai na torre nova. */
  encerrar(vencedor) {
    this.travada = true;
    this.dobroLado = -1;
    this.torres.forEach((torre, i) => {
      if (i === vencedor) return;
      this.posicoes(torre, i).forEach(({ p, x, y, ang, hp }) => {
        const dir = (x - this.L.xs[i]) >= 0 ? 1 : -1;
        const alto = (this.L.chao - y) / Math.max(1, this.L.chao - this.L.teto);
        this.ruinas.push({
          x, y, w: p.w, h: Math.max(4, hp), a: ang, cor: p.cor, luz: p.luz,
          vx: (dir * 40 + (Math.random() - 0.5) * 260) * (0.4 + alto), vy: -Math.random() * 200,
          va: (Math.random() - 0.5) * 5, vida: 0, quicou: 0, atraso: (1 - alto) * 0.25 + Math.random() * 0.1,
        });
      });
      torre.pecas = [];
      torre.altura = 0;
      torre.voando = [];
      this.poeira(this.L.xs[i], this.L.chao, this.L.larg + 160, 26);
    });
    this.tremor = 22;
    Som.desabar();
  },

  zerar() {
    this.travada = false;
    this.torres.forEach(t => {
      const fila = t.fila;
      Object.assign(t, this.novaTorre(), { fila });
    });
    this.ruinas = [];
    this.lascas = [];
    this.ataques = [];
  },

  /* ───────── ataque na torre rival ───────── */

  /* A regra já tirou os metros do placar; aqui é só o show: animação até
     o impacto e, no impacto, as peças do topo saem voando com física. */
  atacar(a) {
    const tempo = ATAQUES[a.ataque] || ATAQUES.vento;
    const dir = a.alvo === 0 ? -1 : 1;
    const riscos = Array.from({ length: 16 }, () => ({
      dy: (Math.random() - 0.5) * 300, len: 120 + Math.random() * 220, vel: 0.8 + Math.random() * 0.7, atraso: Math.random() * 0.35,
    }));
    this.ataques.push({ a, t: -tempo.antes, dura: tempo.dura, dir, riscos, caiu: false });
  },

  passoAtaques(dt) {
    for (const k of this.ataques) {
      k.t += dt;
      if (!k.caiu && k.t >= 0) { k.caiu = true; this.derrubar(k); }
      if (k.a.ataque === "terremoto" && k.t >= 0 && k.t < k.dura - 0.6) {
        this.tremor = Math.max(this.tremor, 30);
        this.torres[k.a.alvo].susto = Math.max(this.torres[k.a.alvo].susto, 26);
      }
    }
    this.ataques = this.ataques.filter(k => k.t < k.dura);
    this.flash *= Math.pow(0.004, dt);
  },

  /* Tira `metros` do topo: peças inteiras e, se sobrar, um pedaço da
     última. O que ainda não pousou (fila, no ar) paga o resto. */
  derrubar(k) {
    const { a, dir } = k;
    const i = a.alvo;
    const torre = this.torres[i];
    const pos = this.posicoes(torre, i);
    let resta = a.metros;
    const caidos = [];
    while (resta > 0.001 && torre.pecas.length && !this.travada) {
      const p = torre.pecas[torre.pecas.length - 1];
      const q = pos[torre.pecas.length - 1];
      if (p.m <= resta + 0.001) {
        torre.pecas.pop();
        resta -= p.m;
        caidos.push({ x: q.x, y: q.y, w: p.w, h: Math.max(4, q.hp), a: q.ang, cor: p.cor, luz: p.luz });
      } else {
        const f = resta / p.m;
        const h = Math.max(4, q.hp * f);
        p.m -= resta;
        resta = 0;
        caidos.push({ x: q.x, y: q.y - q.hp / 2 + h / 2, w: p.w, h, a: q.ang, cor: p.cor, luz: p.luz });
      }
    }
    torre.altura = Math.max(0, torre.altura - (a.metros - resta));
    for (const lista of [torre.fila, torre.voando]) {
      while (resta > 0.001 && lista.length) {
        const ult = lista[lista.length - 1];
        const p = ult.peca || ult;
        if (p.m <= resta + 0.001) { lista.pop(); resta -= p.m; } else { p.m -= resta; resta = 0; }
      }
    }

    const topo = this.topoTela(i);
    const n = caidos.length;
    caidos.forEach((q, idx) => {
      const alto = n > 1 ? 1 - idx / (n - 1) : 1;
      const r = Math.random();
      let vx, vy, va, atraso = 0;
      if (a.ataque === "vento") {
        vx = dir * (420 + r * 520); vy = -160 - r * 160; va = dir * (2 + r * 4);
      } else if (a.ataque === "raio") {
        vx = (Math.random() - 0.5) * 900; vy = -380 - r * 420; va = (Math.random() - 0.5) * 14;
      } else if (a.ataque === "bola") {
        vx = dir * (700 + r * 700); vy = -260 - r * 260; va = dir * (4 + r * 6);
      } else {
        vx = (dir * 120 + (Math.random() - 0.5) * 520) * (0.5 + alto); vy = -60 - r * 160; va = (Math.random() - 0.5) * 6;
        atraso = idx * Math.min(0.05, 1.4 / Math.max(1, n));
      }
      this.ruinas.push({ ...q, vx, vy, va, vida: 0, quicou: 0, atraso });
    });

    const lado = this.cfg.lados[i];
    const cores = [lado.cor, lado.acento, "#FFFFFF"];
    if (a.ataque === "vento") {
      this.poeira(topo.x, topo.y + 40, this.L.larg, 18);
      Som.queda();
    } else if (a.ataque === "raio") {
      this.flash = 1;
      this.tremor = Math.max(this.tremor, 20);
      this.explodir(topo.x, topo.y + 30, ["#FFFFFF", "#FFE45A", "#8FD3FF", ...cores], 120, 16);
      this.aneis.push({ x: topo.x, y: topo.y + 30, r: 60, vida: 0 });
      Som.impacto(1);
    } else if (a.ataque === "bola") {
      this.tremor = Math.max(this.tremor, 28);
      this.explodir(topo.x, topo.y + 30, cores, 90, 15);
      this.poeira(topo.x, topo.y + 40, this.L.larg, 24);
      Som.impacto(0.9);
      Som.queda();
    } else {
      this.poeira(this.L.xs[i], this.L.chao, this.L.larg + 260, 40);
      this.poeira(this.L.xs[1 - i], this.L.chao, this.L.larg, 12);
      Som.desabar();
    }
    torre.v += dir * (40 + this.alturaPx(torre, i) * 0.06) * this.omega(this.alturaPx(torre, i));
  },

  desenharAtaques() {
    const c = this.c;
    const L = this.L;
    for (const k of this.ataques) {
      const { a, t } = k;
      const topo = this.topoTela(a.alvo);
      c.save();
      if (a.ataque === "vento") this.desenharVento(k, topo);
      else if (a.ataque === "raio" && t < 0.35) this.desenharRaio(topo, Math.min(1, (0.35 - t) / 0.2));
      else if (a.ataque === "bola") this.desenharBola(k, topo);
      else if (a.ataque === "terremoto" && t >= 0) this.desenharRachaduras(k);
      c.restore();
    }
    if (this.flash > 0.02) {
      c.fillStyle = `rgba(255,255,255,${this.flash * 0.75})`;
      c.fillRect(-50, -50, L.W + 100, L.H + 100);
    }
  },

  /* Riscos brancos atravessando o topo, do lado de quem atacou pra fora. */
  desenharVento(k, topo) {
    const c = this.c;
    const vida = k.t + ATAQUES.vento.antes;
    c.lineCap = "round";
    for (const r of k.riscos) {
      const s = (vida - r.atraso) * r.vel;
      if (s < 0 || s > 1) continue;
      const x = topo.x - k.dir * 700 + k.dir * s * 1400;
      const y = topo.y + 60 + r.dy + Math.sin(s * 8 + r.dy) * 16;
      c.strokeStyle = `rgba(255,255,255,${0.75 * Math.sin(s * Math.PI)})`;
      c.lineWidth = 7;
      c.beginPath();
      c.moveTo(x - k.dir * r.len, y);
      c.quadraticCurveTo(x - k.dir * r.len / 2, y - 18, x, y);
      c.stroke();
    }
    c.lineCap = "butt";
  },

  /* Raio em zigue-zague do céu até o topo; muda a cada quadro (pisca). */
  desenharRaio(topo, alfa) {
    const c = this.c;
    const pontos = [];
    const y0 = -40;
    const passos = 11;
    for (let n = 0; n <= passos; n++) {
      const f = n / passos;
      const espalha = n === 0 || n === passos ? 0 : (Math.random() - 0.5) * 110;
      pontos.push([topo.x + espalha + (1 - f) * 60, y0 + (topo.y + 40 - y0) * f]);
    }
    c.globalAlpha = alfa;
    c.shadowColor = "#8FD3FF";
    c.shadowBlur = 40;
    for (const [larg, cor] of [[26, "rgba(143,211,255,.55)"], [11, "#FFFFFF"]]) {
      c.strokeStyle = cor;
      c.lineWidth = larg;
      c.lineJoin = "round";
      c.beginPath();
      pontos.forEach(([x, y], n) => (n ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.stroke();
    }
    c.shadowBlur = 0;
  },

  /* Bola de demolição: desce em arco do lado de quem atacou e acerta o
     topo no fundo do balanço; depois volta e some. */
  desenharBola(k, topo) {
    const c = this.c;
    const R = 520;
    const raio = 58;
    const alvoY = topo.y + 40;
    const piv = { x: topo.x - k.dir * 20, y: alvoY - R };
    const ini = -k.dir * 1.25;
    let ang;
    if (k.t < 0) {
      const e = 1 + k.t / 0.8;
      ang = ini * (1 - e * e);
    } else ang = k.dir * 0.45 * Math.sin(Math.min(1, k.t / 0.5) * Math.PI / 2) * Math.exp(-k.t * 0.8);
    const bx = piv.x + Math.sin(ang) * R;
    const by = piv.y + Math.cos(ang) * R;
    c.globalAlpha = k.t > k.dura - 0.5 ? Math.max(0, (k.dura - k.t) / 0.5) : 1;
    c.strokeStyle = "#2A2F3A";
    c.lineWidth = 9;
    c.setLineDash([16, 6]);
    c.beginPath();
    c.moveTo(piv.x, piv.y - 600);
    c.lineTo(piv.x, piv.y);
    c.lineTo(bx, by);
    c.stroke();
    c.setLineDash([]);
    const g = c.createRadialGradient(bx - raio * 0.35, by - raio * 0.4, raio * 0.1, bx, by, raio);
    g.addColorStop(0, "#9AA3B5");
    g.addColorStop(0.5, "#3A4150");
    g.addColorStop(1, "#11141B");
    c.fillStyle = g;
    c.beginPath();
    c.arc(bx, by, raio, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#FFD45A";
    c.lineWidth = 6;
    c.stroke();
  },

  /* Rachaduras no chão saindo da base da torre atacada. */
  desenharRachaduras(k) {
    const c = this.c;
    const L = this.L;
    const x0 = L.xs[k.a.alvo];
    const cresce = Math.min(1, k.t / 0.6);
    c.globalAlpha = k.t > k.dura - 0.6 ? Math.max(0, (k.dura - k.t) / 0.6) : 1;
    c.strokeStyle = "#EDE6DA";
    c.lineWidth = 7;
    c.lineJoin = "round";
    k.fendas = k.fendas || Array.from({ length: 5 }, (_, n) => {
      const sentido = n % 2 ? 1 : -1;
      const pts = [[x0 + sentido * 20, L.chao + 4]];
      for (let s = 1; s <= 6; s++) pts.push([x0 + sentido * (20 + s * (50 + n * 12)), L.chao + 6 + (Math.random() - 0.3) * 40 + s * n * 2]);
      return pts;
    });
    for (const pts of k.fendas) {
      const ate = Math.max(1, Math.round(cresce * (pts.length - 1)));
      c.beginPath();
      pts.slice(0, ate + 1).forEach(([x, y], n) => (n ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.stroke();
    }
  },

  /* ───────── quadro ───────── */

  quadro(dt) {
    this.t += dt;
    const L = this.L;
    this.escala(dt);

    this.torres.forEach((torre, i) => {
      if (!this.travada) {
        for (const v of torre.voando) v.t += dt;
        while (torre.voando.length && torre.voando[0].t >= torre.voando[0].T) this.pousar(i, torre, torre.voando.shift().peca);
        const ultimo = torre.voando[torre.voando.length - 1];
        const livre = !ultimo || ultimo.t >= this.intervaloSoltar(torre);
        if (torre.fila.length && livre && torre.voando.length < 6) this.soltar(i, torre);
      }
      const H = this.alturaPx(torre, i);
      const w = this.omega(H);
      const zeta = 0.07;
      torre.v += (-w * w * torre.s - 2 * zeta * w * torre.v) * dt;
      torre.s += torre.v * dt;
      const lim = 10 + H * 0.07;
      if (Math.abs(torre.s) > lim) { torre.s = Math.sign(torre.s) * lim; torre.v *= -0.3; }
      torre.susto *= Math.pow(0.02, dt);
      const placa = torre.placa;
      const alvoPlaca = this.angulo(torre, H) * 1.25;
      placa.v += (-70 * (placa.a - alvoPlaca) - 5 * placa.v) * dt;
      placa.a += placa.v * dt;
    });

    this.tremor *= Math.pow(0.012, dt);
    this.passoAtaques(dt);
    this.fisicaSoltos(this.lascas, dt, true);
    this.fisicaSoltos(this.ruinas, dt, false);
    this.desenhar(dt);
  },

  /* Zoom e compressão, contando o que já caiu, o que está no ar e a fila
     (o placar). `esc` é o px por moeda que faz a torre mais alta caber; se
     as alturas mínimas não cabem nem com ele, elas encolhem (`minF`). Se as
     mínimas deixam o lado de trás no placar mais alto que o líder, o de trás
     encolhe por inteiro (`fator`) até ficar abaixo, sem nunca inverter. */
  escala(dt) {
    const L = this.L;
    const espaco = L.chao - L.teto;
    const listas = this.torres.map(t => [...t.pecas, ...t.voando.map(v => v.peca), ...t.fila]);
    const somaMin = Math.max(...listas.map(ps => ps.reduce((s, p) => s + p.tipo.min, 0)));
    this.minF = Math.min(espaco / ESPACO_REF, (espaco * 0.8) / Math.max(1, somaMin));
    const total = (ps, k) => ps.reduce((s, p) => s + Math.max(p.tipo.min * this.minF, p.m * k), 0);
    const cabe = k => listas.every(ps => total(ps, k) <= espaco);
    let alvo = ESCALA_MAX;
    if (!cabe(alvo)) {
      let lo = 0;
      for (let n = 0; n < 24; n++) {
        const k = (lo + alvo) / 2;
        if (cabe(k)) lo = k; else alvo = k;
      }
      alvo = lo;
    }
    /* Abre rápido (a torre não pode furar o teto) e fecha devagar. */
    const vel = alvo < this.esc ? 5 : 0.8;
    this.esc += (alvo - this.esc) * Math.min(1, vel * dt);

    const moedas = listas.map(ps => ps.reduce((s, p) => s + p.m, 0));
    const px = listas.map(ps => total(ps, this.esc));
    this.fator = [1, 1];
    if (moedas[0] === moedas[1]) return;
    const lider = moedas[0] > moedas[1] ? 0 : 1;
    const atras = 1 - lider;
    const folga = Math.min(px[lider] / 2, Math.max(3, (moedas[lider] - moedas[atras]) * this.esc));
    if (px[atras] > px[lider] - folga) this.fator[atras] = (px[lider] - folga) / px[atras];
  },

  hpx(p, i) { return Math.max(p.tipo.min * this.minF, p.m * this.esc) * this.fator[i]; },

  alturaPx(torre, i) { return torre.pecas.reduce((s, p) => s + this.hpx(p, i), 0); },

  /* Topo agora: mola + vento (que cresce com a altura) + susto (tremor de
     quando a outra torre leva um presente grande). */
  balanco(torre, H) {
    const t = this.t;
    const vento = (1.5 + H * 0.015) * (Math.sin(t * 1.1 + torre.fase) * 0.75 + Math.sin(t * 2.7 + torre.fase * 1.7) * 0.25);
    return torre.s + vento + this.susto(torre);
  },

  /* Inclinação do topo, sem o susto (tremor não entorta placa). */
  angulo(torre, H) { return H > 0 ? (2 * (this.balanco(torre, H) - this.susto(torre))) / Math.max(H, 320) : 0; },

  susto(torre) { return torre.susto * Math.sin(this.t * 38 + torre.fase); },

  posicoes(torre, i) {
    const H = this.alturaPx(torre, i);
    const S = this.balanco(torre, H);
    let base = 0;
    return torre.pecas.map(p => {
      const hp = this.hpx(p, i);
      const yc = base + hp / 2;
      base += hp;
      const f = H > 0 ? yc / H : 0;
      return { p, x: this.L.xs[i] + p.x + S * f * f, y: this.L.chao - yc, ang: H > 0 ? (2 * S * yc) / (H * H) : 0, hp };
    });
  },

  fisicaSoltos(lista, dt, somem) {
    const chao = this.L.chao + 40;
    for (const q of lista) {
      if (q.atraso > 0) { q.atraso -= dt; continue; }
      q.vida += dt;
      q.vy += GRAVIDADE * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.a += q.va * dt;
      if (q.y + q.h / 2 > chao && q.vy > 0 && q.quicou < 2) {
        q.y = chao - q.h / 2;
        q.vy *= -0.32;
        q.vx *= 0.6;
        q.va *= 0.5;
        q.quicou++;
      }
    }
    for (let k = lista.length - 1; k >= 0; k--) {
      const q = lista[k];
      if (q.y > this.L.H + 200 || (somem && q.vida > 2.4) || q.vida > 4) lista.splice(k, 1);
    }
  },

  /* ───────── desenho ───────── */

  desenhar(dt) {
    const c = this.c;
    const L = this.L;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, L.W, L.H);
    if (this.tremor > 0.3) c.translate((Math.random() - 0.5) * this.tremor, (Math.random() - 0.5) * this.tremor);
    /* Na tela de vitória o canvas fica por cima só pelo confete. */
    if (this.soEfeitos) { this.efeitos(dt); return; }

    this.regua();
    this.chao();
    this.torres.forEach((torre, i) => {
      const pos = this.posicoes(torre, i);
      if (!pos.length && !torre.voando.length && !this.travada) this.fantasma(i);
      for (const q of pos) this.peca(q.p, q.x, q.y, q.ang, q.hp);
    });
    this.torres.forEach((torre, i) => this.placa(torre, i));
    /* Peça no ar passa na frente da placa: atrás dela parecia embolada. */
    this.torres.forEach((torre, i) => {
      const H = this.alturaPx(torre, i);
      const S = this.balanco(torre, H);
      let base = H;
      for (const { peca: p, t, T, giro } of torre.voando) {
        const hp = this.hpx(p, i);
        const yFim = L.chao - base - hp / 2;
        base += hp;
        const yIni = Math.min(yFim - 300, L.teto - 520);
        const k = Math.min(1, t / T);
        this.peca(p, L.xs[i] + p.x + S * k, yIni + (yFim - yIni) * k * k, giro * (1 - k), hp);
      }
    });
    this.marcaFalta();
    const sumindo = (q, vida) => Math.max(0, Math.min(1, (vida - q.vida) / 0.5));
    for (const q of this.lascas) {
      c.globalAlpha = sumindo(q, 2.4);
      this.bloco(q.x, q.y, q.a, q.w, q.h, q.cor, q.luz);
    }
    for (const q of this.ruinas) {
      c.globalAlpha = sumindo(q, 4);
      this.bloco(q.x, q.y, q.a, q.w, q.h, q.cor, q.luz);
    }
    c.globalAlpha = 1;
    this.efeitos(dt);
    this.desenharAtaques();
  },

  regua() {
    const c = this.c;
    const L = this.L;
    const passos = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
    const i = this.torres[0].altura >= this.torres[1].altura ? 0 : 1;
    const altura = this.torres[i].altura;
    const pxPorM = altura > 0 ? this.alturaPx(this.torres[i], i) / altura : this.esc;
    const passo = passos.find(p => p * pxPorM >= 64) || 100000;
    c.save();
    c.strokeStyle = "rgba(255,255,255,.22)";
    c.fillStyle = "rgba(255,255,255,.5)";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(L.regua, L.chao);
    c.lineTo(L.regua, L.teto - 120);
    c.stroke();
    c.font = `700 22px ${FONTE_TXT}`;
    c.textAlign = "left";
    c.textBaseline = "middle";
    let ultimo = L.chao;
    /* A etiqueta do "faltam" fica em cima da régua: a marca que cairia
       embaixo dela some. */
    const falta = this.linhaFalta();
    for (let m = passo; ; m += passo) {
      const y = this.yDaMoeda(i, m);
      if (y <= L.teto - 110) break;
      if (ultimo - y < 40) continue;
      if (falta && y > falta.y - 62 && y < falta.y + 14) continue;
      ultimo = y;
      c.beginPath();
      c.moveTo(L.regua - 10, y);
      c.lineTo(L.regua + 10, y);
      c.stroke();
      c.fillText(`${fmtM.format(m)} m`, L.regua + 16, y);
    }
    c.restore();
  },

  /* A régua segue a torre mais alta: com a altura mínima das peças a
     escala não é linear, então a marca de cada metro anda pelas peças dela. */
  yDaMoeda(i, m) {
    let moedas = 0;
    let px = 0;
    for (const p of this.torres[i].pecas) {
      const hp = this.hpx(p, i);
      if (moedas + p.m >= m) return this.L.chao - px - (hp * (m - moedas)) / p.m;
      moedas += p.m;
      px += hp;
    }
    return this.L.chao - px - (m - moedas) * this.esc;
  },

  chao() {
    const c = this.c;
    const L = this.L;
    const g = c.createLinearGradient(0, L.chao, 0, L.H);
    g.addColorStop(0, "rgba(6,10,24,.78)");
    g.addColorStop(1, "rgba(6,10,24,.95)");
    c.fillStyle = g;
    c.fillRect(0, L.chao, L.W, L.H - L.chao);
    c.fillStyle = "rgba(255,255,255,.85)";
    c.fillRect(0, L.chao, L.W, 4);
    this.cfg.lados.forEach((lado, i) => {
      const x = L.xs[i];
      const w = L.larg + 70;
      c.fillStyle = lado.corEscura;
      retangulo(c, x - w / 2, L.chao - 18, w, 30, 8);
      c.fill();
      c.fillStyle = lado.cor;
      c.fillRect(x - w / 2 + 8, L.chao - 18, w - 16, 6);
    });
  },

  /* Torre vazia: contorno tracejado com o presente que começa ela. */
  fantasma(i) {
    const c = this.c;
    const L = this.L;
    const lado = this.cfg.lados[i];
    const x = L.xs[i];
    const w = L.larg * 0.86;
    const h = 150;
    const y = L.chao - 18 - PLACA.haste - PLACA.foto - PLACA.faixa - 18 - h - 26;
    c.save();
    c.globalAlpha = 0.55 + 0.25 * Math.sin(this.t * 3 + i * 1.6);
    c.setLineDash([16, 12]);
    c.lineDashOffset = -this.t * 30;
    c.strokeStyle = "#FFFFFF";
    c.lineWidth = 4;
    retangulo(c, x - w / 2, y, w, h, 18);
    c.stroke();
    c.setLineDash([]);
    c.fillStyle = "#FFFFFF";
    c.textAlign = "center";
    c.textBaseline = "middle";
    const icone = this.icones && this.icones[i];
    if (icone && icone.complete && icone.naturalWidth) c.drawImage(icone, x - 34, y + 16, 68, 68);
    else {
      c.font = `900 60px ${FONTE_NUM}`;
      c.fillText(lado.presente.icone, x, y + 50);
    }
    c.font = `800 26px ${FONTE_TXT}`;
    /* Modo seguro: o fantasma não pede presente. */
    c.fillText(this.cfg.modoSeguro !== false ? `Comente ${lado.comandos[0]}` : `Mande ${lado.presente.nome}`, x, y + 102);
    c.font = `600 21px ${FONTE_TXT}`;
    c.fillText("pra começar a torre", x, y + 130);
    c.restore();
  },

  bloco(x, y, ang, w, h, cor, luz) {
    const c = this.c;
    c.save();
    c.translate(x, y);
    c.rotate(ang);
    const claro = [0.1, 0.02, 0.18][luz] ?? 0.1;
    const g = c.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, tom(cor, "#FFFFFF", claro + 0.12));
    g.addColorStop(1, tom(cor, "#000000", 0.12));
    c.fillStyle = g;
    retangulo(c, -w / 2, -h / 2, w, h, Math.min(6, h / 3));
    c.fill();
    c.restore();
  },

  peca(p, x, y, ang, hp, alfa = 1) {
    const c = this.c;
    const w = p.w;
    const nome = p.tipo.nome;
    const lado = this.cfg.lados[p.lado];
    const novo = p.nasc != null ? Math.max(0, 1 - (this.t - p.nasc) / 0.5) : 0;
    c.save();
    c.globalAlpha = alfa;
    c.translate(x, y);
    c.rotate(ang);
    const h = Math.max(1.5, hp);
    const r = Math.min(nome === "tijolo" ? 6 : 10, h / 3);
    const claro = [0.1, 0.02, 0.18][p.luz] ?? 0.1;
    const forte = p.tipo.impacto >= 0.4;
    const base = forte ? lado.corEscura : p.cor;

    const g = c.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, tom(base, "#FFFFFF", claro + 0.14));
    g.addColorStop(0.55, tom(base, "#FFFFFF", claro));
    g.addColorStop(1, tom(base, "#000000", 0.18));
    c.fillStyle = g;
    retangulo(c, -w / 2, -h / 2, w, h, r);
    c.fill();

    if (h >= 5) {
      c.fillStyle = "rgba(255,255,255,.32)";
      c.fillRect(-w / 2 + r, -h / 2, w - 2 * r, Math.min(3, h * 0.15));
      c.fillStyle = "rgba(0,0,0,.22)";
      c.fillRect(-w / 2 + r, h / 2 - Math.min(4, h * 0.18), w - 2 * r, Math.min(4, h * 0.18));
    }
    if (nome === "tijolo" && h >= 18) {
      c.strokeStyle = "rgba(0,0,0,.16)";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(-w / 2 + 4, 0); c.lineTo(w / 2 - 4, 0);
      for (let k = 1; k < 4; k++) {
        const xx = -w / 2 + (w * k) / 4;
        c.moveTo(xx, -h / 2 + 3); c.lineTo(xx, 0);
        c.moveTo(xx - w / 8, 0); c.lineTo(xx - w / 8, h / 2 - 3);
      }
      c.stroke();
    }
    if (nome === "caixa" && h >= 22) {
      c.strokeStyle = "rgba(0,0,0,.2)";
      c.lineWidth = 3;
      retangulo(c, -w / 2 + 7, -h / 2 + 7, w - 14, h - 14, 4);
      c.stroke();
    }
    if (nome === "bloco" && h >= 14) {
      c.fillStyle = rgba(lado.acento, 0.85);
      c.fillRect(-w / 2, -h / 2 + h * 0.18, w, Math.max(3, h * 0.08));
    }
    if (forte && h >= 10) {
      const ouro = nome === "grande" ? lado.acento : "#FFD45A";
      c.strokeStyle = ouro;
      c.lineWidth = Math.min(6, h * 0.12);
      retangulo(c, -w / 2 + 3, -h / 2 + 3, w - 6, h - 6, r);
      c.stroke();
      if (h >= 34) {
        c.fillStyle = ouro;
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
          c.beginPath();
          c.arc(sx * (w / 2 - 16), sy * (h / 2 - 14), 4, 0, Math.PI * 2);
          c.fill();
        }
      }
    }
    if (novo > 0) {
      c.fillStyle = `rgba(255,255,255,${novo * 0.55})`;
      retangulo(c, -w / 2, -h / 2, w, h, r);
      c.fill();
    }
    if (nome === "tijolinho") {
      c.strokeStyle = "rgba(255,255,255,.9)";
      c.lineWidth = 2;
      retangulo(c, -w / 2 + 1, -h / 2 + 1, w - 2, h - 2, r);
      c.stroke();
      const fonte = Math.min(20, h * 0.8);
      if (fonte >= 9) {
        c.fillStyle = "#0A1530";
        c.font = `800 ${Math.round(fonte)}px ${FONTE_TXT}`;
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText(caberTexto(c, p.quem.nick, w - 12), 0, 1);
      }
      c.restore();
      return;
    }

    const tam = Math.min(forte ? 46 : 30, h * 0.52);
    if (tam >= 13) {
      const claroFundo = luminancia(base) > 0.62;
      c.fillStyle = claroFundo ? "#0A1530" : "#FFFFFF";
      c.textBaseline = "middle";
      let lv = 0;
      if (p.valor != null) {
        const valor = `+${fmtM.format(Math.round(p.valor))}`;
        c.font = `900 ${Math.round(tam * 1.08)}px ${FONTE_NUM}`;
        lv = c.measureText(valor).width;
        c.textAlign = "right";
        c.fillText(valor, w / 2 - 14, 1);
        if (p.dobrado) {
          const cor = c.fillStyle;
          c.fillStyle = "#FFD45A";
          c.fillText("2× ", w / 2 - 14 - lv, 1);
          lv += c.measureText("2× ").width;
          c.fillStyle = cor;
        }
      }
      c.font = `800 ${Math.round(tam * 0.8)}px ${FONTE_TXT}`;
      c.textAlign = "left";
      c.fillText(caberTexto(c, p.quem.nick, w - lv - 44), -w / 2 + 14, 1);
    }
    c.restore();
  },

  /* Placa com a foto do lado, em cima da torre, balançando um pouco mais
     que o topo (tem haste). Com a torre vazia, fica na base. */
  placa(torre, i) {
    const c = this.c;
    const L = this.L;
    const lado = this.cfg.lados[i];
    const pos = this.posicoes(torre, i);
    const topo = pos[pos.length - 1];
    const x = topo ? topo.x + Math.sin(topo.ang) * topo.hp / 2 : L.xs[i];
    const y = topo ? topo.y - topo.hp / 2 : L.chao - 18;
    const { w, foto, faixa, haste } = PLACA;
    const alturaPlaca = foto + faixa + 18;

    c.save();
    c.translate(x, y);
    c.rotate(torre.placa.a);
    c.fillStyle = "#E8ECF4";
    c.fillRect(-3, -haste, 6, haste);
    c.translate(0, -haste);

    c.shadowColor = "rgba(0,0,0,.4)";
    c.shadowBlur = 24;
    c.shadowOffsetY = 10;
    c.fillStyle = "#FFFFFF";
    retangulo(c, -w / 2, -alturaPlaca, w, alturaPlaca, 18);
    c.fill();
    c.shadowColor = "transparent";

    c.fillStyle = lado.cor;
    retangulo(c, -w / 2 + 6, -alturaPlaca + 6, w - 12, foto + 6, 13);
    c.fill();
    const quadro = this.fotos[i];
    if (quadro) {
      c.save();
      retangulo(c, -w / 2 + 6, -alturaPlaca + 6, w - 12, foto + 6, 13);
      c.clip();
      c.drawImage(quadro, 30, 20, 540, 540, -w / 2 + 6, -alturaPlaca + 6, w - 12, w - 12);
      c.restore();
    }
    c.fillStyle = lado.corEscura;
    retangulo(c, -w / 2 + 6, -faixa - 6, w - 12, faixa, 11);
    c.fill();
    c.fillStyle = "#FFFFFF";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = `900 40px ${FONTE_NUM}`;
    c.fillText(`${numeroMetros(torre.altura)} m`, 0, -faixa / 2 - 5);

    if (this.dobroLado === i) {
      const pulso = 1 + 0.08 * Math.sin(this.t * 10);
      c.translate(w / 2 - 6, -alturaPlaca + 4);
      c.scale(pulso, pulso);
      c.fillStyle = "#FFD45A";
      c.beginPath();
      c.arc(0, 0, 38, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#0A1530";
      c.lineWidth = 5;
      c.stroke();
      c.fillStyle = "#0A1530";
      c.font = `900 42px ${FONTE_NUM}`;
      c.fillText("2×", 0, 2);
    }
    c.restore();
  },

  /* Altura de cada torre já pousada: é o número da placa, e a Tela usa o
     mesmo no placar e no "faltam". */
  alturas() { return this.torres.map(t => t.altura); },

  /* y da linha do "faltam" (topo do líder) e o lado de trás, que fica
     embaixo dela. A Tela usa pra bolha de nome não cobrir a linha. */
  linhaFalta() {
    const ft = faltaEntre(this.alturas());
    if (!ft || this.travada) return null;
    const lider = 1 - ft.lado;
    return { lado: ft.lado, metros: ft.metros, y: this.L.chao - this.alturaPx(this.torres[lider], lider) };
  },

  /* Linha tracejada na altura do líder, por cima da torre de trás: mostra
     quanto falta sem precisar ler número. */
  marcaFalta() {
    const linha = this.linhaFalta();
    if (!linha) return;
    const ft = linha;
    const lider = 1 - ft.lado;
    const c = this.c;
    const L = this.L;
    const y = linha.y;
    const yb = L.chao - this.alturaPx(this.torres[ft.lado], ft.lado);
    if (yb - y < 24) return;
    const x = L.xs[ft.lado];
    const meia = L.larg / 2 + 30;
    const corLider = this.cfg.lados[lider].cor;
    c.save();
    c.strokeStyle = "#FFFFFF";
    c.lineWidth = 3;
    c.setLineDash([14, 10]);
    c.beginPath();
    c.moveTo(Math.min(x - meia, L.regua), y);
    c.lineTo(Math.max(x + meia, L.regua), y);
    c.stroke();
    c.setLineDash([]);
    const texto = `faltam ${fmtM1.format(ft.metros)} m`;
    c.font = `800 26px ${FONTE_TXT}`;
    const tw = c.measureText(texto).width + 28;
    const ladoX = ft.lado === 0 ? L.regua - 10 - tw : L.regua + 10;
    c.fillStyle = corLider;
    retangulo(c, ladoX, y - 44, tw, 38, 19);
    c.fill();
    c.fillStyle = "#FFFFFF";
    c.textAlign = "left";
    c.textBaseline = "middle";
    c.fillText(texto, ladoX + 14, y - 25);
    c.restore();
  },

  /* ───────── partículas ───────── */

  explodir(x, y, cores, n, forca) {
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const vel = forca * 60 * (0.35 + Math.random() * 0.65);
      this.particulas.push({
        x, y, vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel - forca * 20,
        vida: 0, max: 0.8 + Math.random() * 0.8, g: 1100,
        cor: cores[i % cores.length], tam: 6 + Math.random() * 10,
        gira: Math.random() * 6, vg: (Math.random() - 0.5) * 20, papel: Math.random() < 0.6,
      });
    }
    this.limitar();
  },

  poeira(x, y, largura, n) {
    for (let i = 0; i < n; i++) {
      const lado = Math.random() < 0.5 ? -1 : 1;
      this.particulas.push({
        x: x + lado * largura * (0.3 + Math.random() * 0.25), y: y - Math.random() * 8,
        vx: lado * (80 + Math.random() * 260), vy: -10 - Math.random() * 70,
        vida: 0, max: 0.45 + Math.random() * 0.5, g: -20, poeira: true,
        cor: "#EDE6DA", tam: 5 + Math.random() * 9,
      });
    }
    this.limitar();
  },

  chuva(cores, n) {
    for (let i = 0; i < n; i++) {
      this.particulas.push({
        x: Math.random() * this.L.W, y: -40 - Math.random() * 400, vx: (Math.random() - 0.5) * 180, vy: 240 + Math.random() * 360,
        vida: 0, max: 3.6, g: 0, cor: cores[i % cores.length], tam: 10 + Math.random() * 12,
        gira: Math.random() * 6, vg: (Math.random() - 0.5) * 18, papel: true,
      });
    }
    this.limitar();
  },

  limitar() {
    if (this.particulas.length > 1100) this.particulas.splice(0, this.particulas.length - 1100);
  },

  efeitos(dt) {
    const c = this.c;
    for (const a of this.aneis) {
      a.vida += dt;
      const k = a.vida / 0.55;
      c.strokeStyle = `rgba(255,255,255,${Math.max(0, 0.8 * (1 - k))})`;
      c.lineWidth = 10 * (1 - k) + 1;
      c.beginPath();
      c.ellipse(a.x, a.y, a.r + k * 340, (a.r + k * 340) * 0.32, 0, 0, Math.PI * 2);
      c.stroke();
    }
    this.aneis = this.aneis.filter(a => a.vida < 0.55);

    const vivas = [];
    for (const p of this.particulas) {
      p.vida += dt;
      if (p.vida > p.max || p.y > this.L.H + 60) continue;
      p.vy += p.g * dt;
      p.vx *= Math.pow(p.poeira ? 0.15 : 0.6, dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const fim = Math.min(1, (p.max - p.vida) / 0.3);
      if (p.poeira) {
        const k = p.vida / p.max;
        c.globalAlpha = 0.5 * (1 - k);
        c.fillStyle = p.cor;
        c.beginPath();
        c.arc(p.x, p.y, p.tam * (0.6 + k), 0, Math.PI * 2);
        c.fill();
      } else {
        p.gira += p.vg * dt;
        c.globalAlpha = fim;
        c.fillStyle = p.cor;
        if (p.papel) {
          c.save();
          c.translate(p.x, p.y);
          c.rotate(p.gira);
          c.fillRect(-p.tam / 2, -p.tam / 4, p.tam, (p.tam / 2) * Math.abs(Math.cos(p.gira * 1.7)) + 2);
          c.restore();
        } else {
          c.beginPath();
          c.arc(p.x, p.y, p.tam / 2.6, 0, Math.PI * 2);
          c.fill();
        }
      }
      vivas.push(p);
    }
    c.globalAlpha = 1;
    this.particulas = vivas;
  },

  /* Onde fica o topo de cada torre na tela (pra Tela pôr a bolha do nome). */
  topoTela(i) {
    const torre = this.torres[i];
    const H = this.alturaPx(torre, i);
    return { x: this.L.xs[i] + this.balanco(torre, H), y: this.L.chao - H - 18 };
  },
};
