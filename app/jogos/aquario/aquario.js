/* Desenho do aquário em pixel art: tudo é pintado num canvas pequeno (270
   pixels de largura, um por pixel da arte) e ampliado 2×, 3× ou 4× sem
   suavizar. O cenário parado (água, morro, areia, pedras, decorações) fica
   numa camada pronta que só refaz quando muda o nível ou a tela; plantas,
   peixes, bolhas e luz são sprites em cache. O @ de cada peixe é escrito
   por cima, já na resolução da tela, pra continuar legível.

   Posição de tudo vem do regras.js; aqui é só luz, partícula e animação. */
"use strict";

const ARTE = 4;
const AR = 12;
/* Plantas: x, altura, cor, fase. As `frente` passam na frente dos peixes. */
const ALGAS = [
  { x: 6, h: 92, cor: "#2f9e4a", fase: 0 },
  { x: 16, h: 64, cor: "#3fae3a", fase: 1.3 },
  { x: 44, h: 118, cor: "#268a52", fase: 2.1 },
  { x: 112, h: 74, cor: "#3a9a3a", fase: 0.7 },
  { x: 140, h: 104, cor: "#2f9e4a", fase: 3.0 },
  { x: 206, h: 86, cor: "#4aae44", fase: 1.8 },
  { x: 262, h: 128, cor: "#268a52", fase: 2.6 },
  { x: 92, h: 34, cor: "#5abf4a", fase: 0.4, frente: true },
  { x: 182, h: 28, cor: "#4aae44", fase: 2.2, frente: true },
];
const PEDRAS = [{ x: 30, w: 26, h: 15, s: 1 }, { x: 104, w: 34, h: 19, s: 4 }, { x: 170, w: 20, h: 12, s: 7 }, { x: 252, w: 22, h: 13, s: 9 }];
const TOCA_X = 220;
const BAU_X = 146;
const AGUA = ["#4cc4dc", "#34a8cc", "#2789b8", "#1f6ea2", "#18568a", "#134473", "#10375f"];
const AREIA = ["#f0d79a", "#e2c47e", "#cfac64", "#b8924e"];
const FESTA = ["#ff4fa8", "#ffe14a", "#38d9ff", "#7cff6b", "#c58bff"];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

const Tanque = {
  montar(canvas, cfg, partida, leve) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.cfg = cfg;
    this.P = partida;
    this.leve = leve;
    this.k = 0;
    this.W = 1080;
    this.H = 1920;
    this.buf = Sprites.tela(AQ.largura, partida.alto);
    this.b = this.buf.getContext("2d");
    this.rotulos = new Map();
    this.zerar();
  },

  zerar() {
    this.t = 0;
    this.bolhas = [];
    this.particulas = [];
    this.aguas = [];
    this.emissores = [];
    this.zs = [];
    this.anim = new Map();
    this.cresceu = new Map();
    this.foco = null;
    this.fundoChave = "";
    this.proxBolha = 0;
    this.proxZ = 0;
    this.tocaCheia = 0;
    this.tocaEm = 0;
    this.baleiaEm = -1;
    this.plancton = Array.from({ length: this.leve ? 18 : 40 }, (_, i) => ({ x: (i * 97 + 13) % AQ.largura, y: (i * 53) % 400, fase: i * 1.7 }));
  },

  aplicarFormato(W, H, escala) {
    this.W = W;
    this.H = H;
    const k = Math.min(1, Math.max(0.5, Math.round(escala * (window.devicePixelRatio || 1) * 4) / 4));
    if (k !== this.k || this.canvas.height !== Math.round(H * k)) {
      if (k !== this.k) this.rotulos.clear();
      this.k = k;
      this.canvas.width = Math.round(W * k);
      this.canvas.height = Math.round(H * k);
    }
    const alto = Math.round(H / ARTE);
    if (this.buf.height !== alto) this.buf.height = alto;
    this.fundoChave = "";
  },

  /* ───────── acontecimentos ───────── */

  ver(lista) {
    const P = this.P;
    for (const a of lista) {
      switch (a.tipo) {
        case "chegou":
        case "voltou":
          this.respingo(a.x, AQ.superficie, 10);
          this.focar(a.id, 5);
          break;
        case "toca":
          for (let i = 0; i < 5; i++) this.bolha(a.x + (Math.random() - 0.5) * 8, a.y, 1 + (i % 2));
          break;
        case "petisco": this.focar(a.id, 3); break;
        case "comeu": {
          const cores = a.comida === "floco" ? ["#ffd27a", "#ff9f5a"] : ["#ffcf7a", "#d98a3a", "#fff2a8"];
          for (let i = 0; i < (a.comida === "floco" ? 3 : 7); i++) this.particula(a.x, a.y, (Math.random() - 0.5) * 26, (Math.random() - 0.8) * 20, cores[i % cores.length], 0.5, 18);
          break;
        }
        case "cresceu": {
          this.cresceu.set(a.id, this.t);
          for (let i = 0; i < 10; i++) {
            const ang = i / 10 * Math.PI * 2;
            this.particula(a.x, a.y, Math.cos(ang) * 34, Math.sin(ang) * 34, i % 2 ? "#ffffff" : "#9ff3ff", 0.45, 0);
          }
          this.focar(a.id, 3);
          break;
        }
        case "splash": this.respingo(a.x, a.y, a.sobe ? 8 : 14); break;
        case "pulo": case "danca": this.focar(a.id, 4); break;
        case "reforco": {
          const p = P.pessoas.get(a.id);
          if (p) for (let i = 0; i < 18; i++) {
            const ang = i / 18 * Math.PI * 2;
            this.particula(p.x, p.y, Math.cos(ang) * 30, Math.sin(ang) * 30, i % 2 ? "#ffe14a" : "#fff6c0", 0.9, 0);
          }
          this.focar(a.id, 6);
          break;
        }
        case "compartilhou": case "presente": this.focar(a.id, 5); break;
        case "efeito": this.efeito(a); break;
        case "nivel":
          for (let i = 0; i < (this.leve ? 14 : 34); i++) this.bolha(8 + Math.random() * (AQ.largura - 16), P.fundo() - Math.random() * 30, 1 + Math.floor(Math.random() * 3));
          break;
      }
    }
  },

  efeito(a) {
    const P = this.P;
    this.focar(a.id, a.ate - P.t + 2);
    if (a.efeito === "bolhas") this.emissores.push({ id: a.id, forma: a.forma, ate: this.t + 2.6, prox: 0 });
    else if (a.efeito === "aguaviva") {
      const p = P.pessoas.get(a.id);
      if (!p) return;
      for (let i = 0; i < 5; i++) {
        this.aguas.push({ dx: (i - 2) * 16 + (Math.random() - 0.5) * 6, y0: p.y + 40 + Math.random() * 24, ini: this.t + i * 0.25, ate: this.t + 6, fase: Math.random() * 6, id: a.id });
      }
    } else if (a.efeito === "baleia") this.baleiaEm = this.t;
  },

  /* O @ de quem acabou de fazer algo fica grande, e os vizinhos também. */
  focar(id, seg) {
    this.foco = { id, ate: this.t + seg };
  },

  bolha(x, y, r, forma = null) {
    if (this.bolhas.length >= (this.leve ? 34 : 90)) return;
    this.bolhas.push({ x, y, r, forma, vy: forma ? 14 + Math.random() * 6 : 10 + r * 5 + Math.random() * 5, fase: Math.random() * 6 });
  },

  particula(x, y, vx, vy, cor, vida, g = 30) {
    if (this.particulas.length >= (this.leve ? 90 : 240)) return;
    this.particulas.push({ x, y, vx, vy, cor, ate: this.t + vida * (0.7 + Math.random() * 0.6), g });
  },

  respingo(x, y, n) {
    for (let i = 0; i < n; i++) this.particula(x, y, (Math.random() - 0.5) * 50, -20 - Math.random() * 40, i % 3 ? "#bff3ff" : "#ffffff", 0.7, 90);
  },

  /* ───────── cenário pronto ───────── */

  noite() { return this.P.decoracoes.includes("noturno"); },

  montarFundo() {
    const P = this.P, A = this.buf.height, W = AQ.largura;
    const c = this.fundo = Sprites.tela(W, A), g = c.getContext("2d");
    const sup = AQ.superficie, fundo = P.fundo();
    const img = g.createImageData(W, A), d = img.data;
    const pal = AGUA.map(h => Sprites.rgb(h));
    const sala = Sprites.rgb("#0b1730"), ar = Sprites.rgb("#2a6f96");
    const morro1 = Sprites.rgb("#0f3a63"), morro2 = Sprites.rgb("#0c2f52");
    const areia = AREIA.map(h => Sprites.rgb(h));
    const pintar = (i, v) => { d[i] = v[0]; d[i + 1] = v[1]; d[i + 2] = v[2]; d[i + 3] = 255; };
    for (let y = 0; y < A; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const limiar = BAYER[(y % 4) * 4 + (x % 4)] / 16;
      if (y < sup - AR) { pintar(i, sala); continue; }
      if (y < sup) { pintar(i, ar); continue; }
      const onda = Math.round(Math.sin(x * 0.11) * 1.5 + Math.sin(x * 0.037 + 2) * 2);
      if (y >= fundo - 2 + onda) {
        const k = Math.min(3, (y - fundo + 2 - onda) / 7 + limiar * 0.9);
        const ruido = hashNome(x * 7919 + y * 104729 + "") % 23;
        pintar(i, ruido === 0 ? areia[3] : ruido === 1 ? areia[0] : areia[Math.floor(k)]);
        continue;
      }
      const m1 = fundo - 52 - 20 * Math.sin(x * 0.028 + 1) - 8 * Math.sin(x * 0.09);
      const m2 = fundo - 22 - 10 * Math.sin(x * 0.05 + 4) - 4 * Math.sin(x * 0.17);
      if (y > m2 + limiar * 2) { pintar(i, morro2); continue; }
      if (y > m1 + limiar * 2) { pintar(i, morro1); continue; }
      const u = (y - sup) / (fundo - sup) * (pal.length - 1);
      const base = Math.floor(u);
      pintar(i, pal[Math.min(pal.length - 1, base + (u - base > limiar ? 1 : 0))]);
    }
    g.putImageData(img, 0, 0);

    /* Tampa do aquário e o vidro, na faixa de ar acima da água. */
    g.fillStyle = "#16324f"; g.fillRect(0, sup - AR - 3, W, 3);
    g.fillStyle = "#3a6e94"; g.fillRect(0, sup - AR, W, 1);
    g.fillStyle = "#5fb0d0"; g.fillRect(0, sup - 2, W, 1);

    const dec = new Set(P.decoracoes);
    const pousar = (sp, x, afunda = 3) => g.drawImage(sp, Math.round(x), fundo + afunda - sp.height);
    if (dec.has("navio")) pousar(Sprites.navio(), 120, 10);
    if (dec.has("castelo")) pousar(Sprites.castelo(), 52, 4);
    if (dec.has("coral")) {
      pousar(Sprites.coral(0), 2, 4);
      pousar(Sprites.coral(2), 84, 4);
      pousar(Sprites.coral(1), 184, 4);
    }
    for (const r of PEDRAS) pousar(Sprites.pedra(r.w, r.h, r.s, false), r.x - r.w / 2, 4);
    pousar(Sprites.toca(false), TOCA_X - 23, 5);
    if (dec.has("bau")) pousar(Sprites.bau(false), BAU_X, 4);

    /* Beirada de areia na frente, cobrindo o pé de tudo. */
    for (let x = 0; x < W; x++) {
      const topo = fundo + 3 + Math.round(Math.sin(x * 0.07 + 1) * 1.5);
      for (let y = topo; y < A; y++) {
        const ruido = hashNome(x * 31 + y * 7 + "a") % 19;
        g.fillStyle = AREIA[ruido === 0 ? 3 : Math.min(3, 1 + Math.floor((y - topo) / 9))];
        g.fillRect(x, y, 1, 1);
      }
    }
    for (let i = 0; i < 14; i++) {
      const x = (i * 71 + 9) % (W - 4), y = fundo + 8 + (i * 13) % Math.max(1, A - fundo - 12);
      g.fillStyle = i % 3 ? "#f7e8c4" : "#e0866a";
      g.fillRect(x, y, 2, 1);
      g.fillRect(x + (i % 2), y - 1, 1, 1);
    }

    /* Aquário noturno: tudo puxa pro azul escuro, e o brilho vem do
       plâncton e das águas-vivas por cima. */
    if (this.noite()) {
      g.globalCompositeOperation = "multiply";
      g.fillStyle = "#4b5da6";
      g.fillRect(0, sup - AR, W, A - sup + AR);
      g.globalCompositeOperation = "source-over";
    }
  },

  /* ───────── quadro ───────── */

  quadro(dt, agora) {
    const P = this.P, b = this.b, A = this.buf.height;
    this.t += dt;
    const t = this.t;
    const noite = this.noite();
    const chave = `${A}|${P.decoracoes.join(",")}`;
    if (chave !== this.fundoChave) { this.fundoChave = chave; this.montarFundo(); }
    const festa = P.t < P.festaAte;
    const fundo = P.fundo();
    this.mover(dt, fundo, festa);

    b.imageSmoothingEnabled = false;
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.globalAlpha = 1;
    b.drawImage(this.fundo, 0, 0);

    if (!noite) this.raios(b, t, fundo);
    else this.planctonLuz(b, t, fundo);

    for (const a of ALGAS) if (!a.frente) this.alga(b, a, t, fundo, noite);
    this.bau(b, fundo);
    this.comida(b, t);

    const s = P.palco;
    if (s && s.tipo !== "baleia") this.bicho(b, s, t);
    this.peixes(b, t);
    this.aguasVivas(b, t, noite);
    this.desenharBolhas(b);
    for (const a of ALGAS) if (a.frente) this.alga(b, a, t, fundo, noite);
    if (s && s.tipo === "baleia") this.bicho(b, s, t);
    this.desenharParticulas(b);
    if (festa) this.luzesFesta(b, t, fundo);
    this.superficie(b, t);
    if (P.ocioso) {
      b.fillStyle = "rgba(4,8,30,0.38)";
      b.fillRect(0, AQ.superficie - AR, AQ.largura, A);
      this.desenharZs(b);
    }

    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.buf, 0, 0, this.canvas.width, this.canvas.height);
    this.nomes(ctx);
  },

  mover(dt, fundo, festa) {
    const P = this.P, t = this.t;
    if (t >= this.proxBolha) {
      this.proxBolha = t + (this.leve ? 0.32 : 0.14);
      this.bolha(12 + Math.random() * 3, fundo - 2, Math.random() < 0.3 ? 2 : 1);
      if (P.decoracoes.includes("castelo") && Math.random() < 0.5) this.bolha(92, fundo - 50, 1);
      if (!this.leve && P.peixes.length && Math.random() < 0.6) {
        const p = P.peixes[Math.floor(Math.random() * P.peixes.length)];
        this.bolha(p.x + p.dir * comprimento(P.tamanhoDe(p)) * 0.5, p.y - 2, 1);
      }
      if (festa) this.bolha(10 + Math.random() * (AQ.largura - 20), fundo - 4, 1 + Math.floor(Math.random() * 3));
    }
    for (const e of this.emissores) {
      const p = P.pessoas.get(e.id);
      if (!p || t >= e.ate || t < e.prox) continue;
      e.prox = t + (this.leve ? 0.3 : 0.16);
      this.bolha(p.x + (Math.random() - 0.5) * 20, p.y - 6, 2, e.forma);
    }
    this.emissores = this.emissores.filter(e => t < e.ate);

    for (const x of this.bolhas) {
      x.y -= x.vy * dt;
      x.x += Math.sin(t * 3 + x.fase) * (x.forma ? 10 : 5) * dt;
      if (x.y < AQ.superficie + 2) {
        x.morta = true;
        if (!x.forma) this.particula(x.x, AQ.superficie, 0, -8, "#dff9ff", 0.2, 0);
      }
    }
    this.bolhas = this.bolhas.filter(x => !x.morta);

    for (const q of this.particulas) {
      q.vy += q.g * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
    }
    this.particulas = this.particulas.filter(q => t < q.ate);
    this.aguas = this.aguas.filter(a => t < a.ate);

    /* Confete da festa, só fora do modo leve. */
    if (festa && !this.leve && Math.random() < 0.5) {
      this.particula(Math.random() * AQ.largura, AQ.superficie + 2, (Math.random() - 0.5) * 10, 6, FESTA[Math.floor(Math.random() * FESTA.length)], 3, 4);
    }

    if (P.ocioso && t >= this.proxZ && P.peixes.length) {
      this.proxZ = t + 0.9;
      const p = P.peixes[Math.floor(Math.random() * P.peixes.length)];
      this.zs.push({ x: p.x + p.dir * 4, y: p.y - 8, ini: t });
    }
    if (t >= this.tocaEm) { this.tocaEm = t + 1; this.tocaCheia = P.naToca(); }
    if (this.tocaCheia && Math.random() < dt * 0.6) this.zs.push({ x: TOCA_X + 2, y: fundo - 10, ini: t });
    this.zs = this.zs.filter(z => t - z.ini < 2.2);
  },

  raios(b, t, fundo) {
    const alto = Math.round((fundo - AQ.superficie) * 0.85);
    for (let i = 0; i < 4; i++) {
      const larg = 16 + (i % 2) * 8;
      const x = 18 + i * 66 + Math.sin(t * 0.13 + i * 1.9) * 14;
      b.globalAlpha = 0.65 + 0.35 * Math.sin(t * 0.45 + i * 2.3);
      b.drawImage(Sprites.raio(larg, alto, "#e8fbff"), Math.round(x), AQ.superficie);
    }
    b.globalAlpha = 1;
  },

  planctonLuz(b, t, fundo) {
    const alto = fundo - AQ.topoNado;
    for (const q of this.plancton) {
      const brilho = 0.5 + 0.5 * Math.sin(t * 1.6 + q.fase);
      const x = Math.round((q.x + Math.sin(t * 0.2 + q.fase) * 6 + AQ.largura) % AQ.largura);
      const y = Math.round(AQ.topoNado + ((q.y + t * 3) % alto));
      if (brilho > 0.7 && !this.leve) {
        b.globalAlpha = brilho - 0.5;
        b.drawImage(Sprites.halo("#7ff6ff", 3), x - 3, y - 3);
      }
      b.globalAlpha = 0.4 + brilho * 0.6;
      b.fillStyle = q.fase % 2 > 1 ? "#a8fff0" : "#7ff6ff";
      b.fillRect(x, y, 1, 1);
    }
    b.globalAlpha = 1;
  },

  alga(b, a, t, fundo, noite) {
    const quadro = Math.floor(t * 2.2 + a.fase * 3) % 8;
    const cor = noite ? Sprites.misturar(a.cor, "#0a1640", 0.55) : a.cor;
    const sp = Sprites.alga(a.h, cor, quadro, a.fase);
    b.drawImage(sp, Math.round(a.x - sp.width / 2), fundo + 5 - sp.height);
  },

  bau(b, fundo) {
    const P = this.P;
    const aberto = P.palco && P.palco.tipo === "baleia";
    if (!aberto) return;
    const sp = Sprites.bau(true);
    b.drawImage(sp, BAU_X, fundo + 4 - sp.height);
    if (Math.random() < 0.5) this.particula(BAU_X + 6 + Math.random() * 12, fundo - 10, (Math.random() - 0.5) * 16, -30 - Math.random() * 20, Math.random() < 0.5 ? "#ffe14a" : "#fff6c0", 1.2, 10);
  },

  comida(b, t) {
    for (const c of this.P.comida) {
      const sp = Sprites.comida(c.tipo);
      const pisca = c.tipo === "grande" && Math.floor(t * 4) % 2 ? 1 : 0;
      b.drawImage(sp, Math.round(c.x - sp.width / 2), Math.round(c.y - sp.height / 2) - pisca);
    }
  },

  /* ───────── peixes ───────── */

  peixes(b, t) {
    const P = this.P, dorme = P.ocioso;
    const ordem = P.peixes.slice().sort((x, y) => P.tamanhoDe(y) - P.tamanhoDe(x));
    for (const p of ordem) {
      let a = this.anim.get(p.id);
      if (!a) { a = { fase: Math.random() * 4, ultimo: t }; this.anim.set(p.id, a); }
      const dt = Math.min(0.1, t - a.ultimo);
      a.ultimo = t;
      const vel = Math.hypot(p.vx, p.vy);
      a.fase += dt * (dorme ? 0.6 : 2 + vel * 0.12 + (p.estado === "danca" ? 6 : 0));
      const len = comprimento(P.tamanhoDe(p));
      const sp = Sprites.peixe(p.especie, p.paleta, len, Math.floor(a.fase) % 4, p.fome, dorme);
      a.meio = sp.cy;
      a.len = len;
      const x = Math.round(p.x), y = Math.round(p.y);

      if (p.cardumeAte > P.t) this.cardume(b, p, len, t);

      const giro = p.giro || 0, dir = p.dir < 0 ? -1 : 1;
      /* Subiu de tamanho: incha e volta, um "pop" de 0,35 s. */
      const u = (t - (this.cresceu.get(p.id) ?? -9)) / 0.35;
      const e = u >= 0 && u < 1 ? 1 + 0.35 * Math.sin(u * Math.PI) : 1;
      if (giro) {
        const c = Math.cos(giro) * e, s = Math.sin(giro) * e;
        b.setTransform(dir * c, s, -dir * s, c, x, y);
      } else b.setTransform(dir * e, 0, 0, e, x, y);
      if (p.coroa) {
        b.globalAlpha = 0.6 + 0.4 * Math.sin(t * 5 + p.x);
        b.drawImage(Sprites.aura(sp, `${p.especie}|${p.paleta}|${len}|${Math.floor(a.fase) % 4}|${p.fome ? 1 : 0}|${dorme ? 1 : 0}`), -Math.round(sp.cx) - 2, -Math.round(sp.cy) - 2);
        b.globalAlpha = 1;
      }
      b.drawImage(sp, -Math.round(sp.cx), -Math.round(sp.cy));
      b.setTransform(1, 0, 0, 1, 0, 0);

      if (p.coroa) {
        const coroa = Sprites.icone("coroa");
        b.drawImage(coroa, x - Math.floor(coroa.width / 2), Math.round(y - sp.cy + 1 - coroa.height + Math.sin(t * 3) * 0.6));
      }
      if (p.ativo && p.ativo.efeito === "aguaviva" && Math.floor(t * 6) % 2) {
        b.globalAlpha = 0.5;
        b.drawImage(Sprites.halo("#ff8fd0", Math.round(len * 0.6)), x - Math.round(len * 0.6), y - Math.round(len * 0.6));
        b.globalAlpha = 1;
      }
    }
    for (const id of this.anim.keys()) {
      const p = P.pessoas.get(id);
      if (!p || !p.naAgua) { this.anim.delete(id); this.cresceu.delete(id); }
    }
  },

  /* Cardume de quem compartilhou: peixinhos que seguem atrás, calculados
     da posição do dono (não têm estado próprio). */
  cardume(b, p, len, t) {
    const sp = Sprites.miudo(Sprites.misturar(p.cor, "#ffffff", 0.2));
    const n = this.leve ? 4 : 7;
    for (let i = 0; i < n; i++) {
      const ang = t * 1.4 + i * 1.3;
      const x = Math.round(p.x - p.dir * (len * 0.55 + 6 + (i % 3) * 6) + Math.cos(ang) * 3);
      const y = Math.round(p.y + (i - n / 2) * 4 + Math.sin(ang * 1.2) * 3);
      b.setTransform(p.dir < 0 ? -1 : 1, 0, 0, 1, x, y);
      b.drawImage(sp, -3, -2);
    }
    b.setTransform(1, 0, 0, 1, 0, 0);
  },

  bicho(b, s, t) {
    const quadro = Math.floor(t * (s.tipo === "baleia" ? 2.4 : 4)) % 4;
    const sp = s.tipo === "tartaruga" ? Sprites.tartaruga(quadro) : s.tipo === "tubarao" ? Sprites.tubarao(quadro) : Sprites.baleia(quadro);
    const k = s.tipo === "tartaruga" ? 2 : 1;
    b.setTransform(s.dir < 0 ? -k : k, 0, 0, k, Math.round(s.x), Math.round(s.y));
    b.drawImage(sp, -sp.cx, -sp.cy);
    b.setTransform(1, 0, 0, 1, 0, 0);
    if (s.tipo === "baleia" && Math.random() < 0.35) this.bolha(s.x + s.dir * 90, s.y - 30, 2);
  },

  aguasVivas(b, t, noite) {
    const P = this.P;
    for (const a of this.aguas) {
      if (t < a.ini) continue;
      const p = P.pessoas.get(a.id);
      const u = (t - a.ini) / (a.ate - a.ini);
      const x = Math.round((p ? p.x : 135) + a.dx + Math.sin(t * 1.5 + a.fase) * 4);
      const y = Math.round(a.y0 - u * 110 - Math.max(0, Math.sin(t * 3 + a.fase)) * 3);
      const quadro = Math.floor(t * 3 + a.fase) % 4;
      const fim = Math.min(1, (1 - u) * 5);
      b.globalAlpha = (noite ? 0.9 : 0.6) * fim;
      b.drawImage(Sprites.halo("#ff8fd0", 10), x - 10, y - 8);
      b.globalAlpha = fim;
      b.drawImage(Sprites.aguaviva(quadro), x - 6, y - 6);
    }
    b.globalAlpha = 1;
  },

  desenharBolhas(b) {
    for (const x of this.bolhas) {
      const sp = x.forma ? Sprites.icone(x.forma) : Sprites.bolha(x.r);
      b.drawImage(sp, Math.round(x.x - sp.width / 2), Math.round(x.y - sp.height / 2));
    }
  },

  desenharParticulas(b) {
    for (const q of this.particulas) {
      b.fillStyle = q.cor;
      b.fillRect(Math.round(q.x), Math.round(q.y), 1, 1);
    }
  },

  desenharZs(b) {
    const z = Sprites.icone("z");
    for (const q of this.zs) {
      const u = (this.t - q.ini) / 2.2;
      b.globalAlpha = Math.min(1, (1 - u) * 2);
      b.drawImage(z, Math.round(q.x + Math.sin(u * 6) * 3), Math.round(q.y - u * 18));
    }
    b.globalAlpha = 1;
  },

  luzesFesta(b, t, fundo) {
    b.globalCompositeOperation = "lighter";
    const n = this.leve ? 2 : 4;
    for (let i = 0; i < n; i++) {
      const x = AQ.largura / 2 + Math.sin(t * 0.9 + i * 1.7) * 110;
      const y = (AQ.topoNado + fundo) / 2 + Math.cos(t * 0.7 + i * 2.1) * 90;
      b.globalAlpha = 0.55;
      b.drawImage(Sprites.halo(FESTA[i % FESTA.length], 24), Math.round(x) - 24, Math.round(y) - 24);
    }
    b.globalAlpha = 1;
    b.globalCompositeOperation = "source-over";
  },

  superficie(b, t) {
    const y0 = AQ.superficie;
    b.fillStyle = this.noite() ? "#5a8fc0" : "#c8f6ff";
    for (let x = 0; x < AQ.largura; x += 3) {
      const y = y0 + Math.round(Math.sin(x * 0.09 + t * 1.8) * 1.2);
      b.fillRect(x, y, 3, 1);
    }
  },

  /* ───────── @ ───────── */

  /* Com 40 peixes o @ de todo mundo vira sopa: o do maior ganha a vaga
     quando dois se encostam, e longe do foco o @ fica pequeno. */
  nomes(ctx) {
    const P = this.P, f = ARTE * this.k, t = P.t;
    const top = new Set(P.ranking(3).map(x => x.id));
    let fx = null, fy = null;
    const foco = this.foco && this.t < this.foco.ate ? P.pessoas.get(this.foco.id) : null;
    if (foco && foco.naAgua) { fx = foco.x; fy = foco.y; }
    else if (P.palco) { fx = P.palco.x; fy = P.palco.y; }
    const lista = [];
    for (const p of P.peixes) {
      const a = this.anim.get(p.id);
      if (!a || a.len == null) continue;
      const perto = fx != null && (p.x - fx) ** 2 + (p.y - fy) ** 2 < 70 * 70;
      const novo = t - p.chegou < 5;
      const grande = !P.ocioso && (perto || novo || top.has(p.id) || !!p.ativo || p.coroa);
      const peso = (foco === p ? 1e4 : 0) + (grande ? 1e3 : 0) + (top.has(p.id) ? 500 : 0) + a.len;
      lista.push({ p, a, grande, peso });
    }
    lista.sort((x, y) => y.peso - x.peso);
    const postos = [];
    const folga = 3 * this.k;
    ctx.globalAlpha = P.ocioso ? 0.75 : 1;
    for (const { p, a, grande } of lista) {
      const r = this.rotulo(p, grande);
      const cx = p.x * f;
      const base = (p.y - a.meio - (p.coroa ? 8 : 1)) * f;
      let x = Math.round(Math.min(this.canvas.width - r.width - 4, Math.max(4, cx - r.width / 2)));
      let y = Math.round(base - r.height);
      const caixa = [x - folga, y - folga, x + r.width + folga, y + r.height + folga];
      if (postos.some(o => caixa[0] < o[2] && caixa[2] > o[0] && caixa[1] < o[3] && caixa[3] > o[1])) continue;
      postos.push(caixa);
      ctx.drawImage(r, x, y);
    }
    ctx.globalAlpha = 1;
  },

  rotulo(p, grande) {
    const chave = `${p.nome}|${p.cor}|${grande ? 1 : 0}|${p.coroa ? 1 : 0}`;
    let c = this.rotulos.get(chave);
    if (c) return c;
    if (this.rotulos.size > 500) this.rotulos.clear();
    const k = this.k;
    const tam = (grande ? 30 : 21) * k;
    const texto = "@" + encurtar(p.nome, grande ? 16 : 12);
    c = document.createElement("canvas");
    const g = c.getContext("2d");
    const fonte = `800 ${tam}px Figtree, system-ui, sans-serif`;
    g.font = fonte;
    const larg = Math.ceil(g.measureText(texto).width);
    const px = (grande ? 12 : 7) * k, alto = Math.round(tam * 1.4);
    c.width = larg + px * 2;
    c.height = alto + (grande ? 4 * k : 0);
    g.font = fonte;
    g.textBaseline = "middle";
    g.textAlign = "center";
    const r = alto / 2;
    g.beginPath();
    g.roundRect(1, 1, c.width - 2, alto - 2, r);
    g.fillStyle = grande ? "rgba(6,14,36,0.82)" : "rgba(6,14,36,0.55)";
    g.fill();
    if (grande) {
      g.lineWidth = 3 * k;
      g.strokeStyle = p.coroa ? "#ffd23a" : p.cor;
      g.stroke();
      /* Bico apontando pro peixe. */
      g.beginPath();
      g.moveTo(c.width / 2 - 6 * k, alto - 2);
      g.lineTo(c.width / 2, c.height);
      g.lineTo(c.width / 2 + 6 * k, alto - 2);
      g.fillStyle = p.coroa ? "#ffd23a" : p.cor;
      g.fill();
    }
    g.fillStyle = grande ? "#ffffff" : "rgba(255,255,255,0.9)";
    g.fillText(texto, c.width / 2, alto / 2 + tam * 0.04);
    this.rotulos.set(chave, c);
    return c;
  },
};
