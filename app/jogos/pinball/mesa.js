/* Desenho da mesa em canvas 2D: fundo, paredes de neon e a arte do tampo
   ficam numa camada pronta; bumpers, flippers, bolas, alvos, roleta e
   partículas são sprites desenhados a cada quadro. Todo brilho é feito uma
   vez só, na hora de montar os sprites (shadowBlur por quadro derruba o
   celular). A posição de tudo vem do regras.js; aqui só tem luz, partícula
   e animação.

   Coordenadas da mesa = as do regras.js (1080 × 1640), encostadas no pé do
   palco. O que sobra em cima é do placar. */
"use strict";

const NEON = { ciano: "#00e5ff", rosa: "#ff2bd6", roxo: "#8a3bff", amarelo: "#ffe600", laranja: "#ff7a1a", verde: "#39ff14", vermelho: "#ff3355" };
const COR_BUMPER = [NEON.rosa, NEON.ciano, NEON.amarelo];
const COR_ROLETA = ["#ff2bd6", "#00e5ff", "#ffe600", "#39ff14", "#ff7a1a", "#b44bff", "#ff3860", "#1affb2"];
const OURO = "#ffd23a";
/* Folga do sprite do bumper: o brilho do aceso não pode bater na borda. */
const MARGEM_BUMPER = 64;
/* Abaixo disso a bola está chegando nos flippers (que ficam em y 1460). */
const ZONA_FLIPPER = 1300;

function telaNova(w, h, k) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w * k));
  c.height = Math.max(1, Math.ceil(h * k));
  const g = c.getContext("2d");
  g.scale(k, k);
  return [c, g];
}

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
}

function caminhoForma(g, forma, r) {
  g.beginPath();
  if (forma === "estrela") {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.45 : r;
      g.lineTo(Math.cos(a) * q, Math.sin(a) * q);
    }
  } else if (forma === "coracao") {
    g.moveTo(0, r * 0.9);
    g.bezierCurveTo(-r * 1.3, -r * 0.1, -r * 0.6, -r * 1.1, 0, -r * 0.45);
    g.bezierCurveTo(r * 0.6, -r * 1.1, r * 1.3, -r * 0.1, 0, r * 0.9);
  } else {
    g.moveTo(r * 0.25, -r); g.lineTo(-r * 0.55, r * 0.1); g.lineTo(-r * 0.02, r * 0.1);
    g.lineTo(-r * 0.3, r); g.lineTo(r * 0.6, -r * 0.15); g.lineTo(r * 0.05, -r * 0.15);
  }
  g.closePath();
}

const Mesa = {
  montar(canvas, cfg, partida, leve) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.cfg = cfg;
    this.partida = partida;
    this.leve = leve;
    this.k = 0;
    this.W = 1080;
    this.H = 1920;
    this.zerarEfeitos();
  },

  zerarEfeitos() {
    this.particulas = [];
    this.pops = [];
    this.rastros = new Map();
    this.luz = { bumper: [0, 0, 0], estilingue: [0, 0], rollover: [0, 0, 0], rampa: [0, 0], alvo: [0, 0, 0, 0, 0, 0], banco: [0, 0], lancador: 0, dreno: 0, trava: 0, flash: 0 };
    this.roda = { ang: 0, de: 0, para: 0, ini: 0, fim: 0 };
    this.tremor = 0;
    this.atracao = true;
    this.tempo = 0;
    this.proximoFogo = 0;
  },

  aplicarFormato(W, H, escala) {
    this.W = W;
    this.H = H;
    this.oy = H - 1640;
    const k = Math.min(1, Math.max(0.5, Math.round(escala * (window.devicePixelRatio || 1) * 4) / 4));
    if (k !== this.k || this.canvas.height !== Math.ceil(H * k)) {
      this.k = k;
      this.canvas.width = Math.ceil(W * k);
      this.canvas.height = Math.ceil(H * k);
      this.sprites();
    }
  },

  ocioso(sim) { this.atracao = sim; },

  /* ───────── sprites ───────── */

  sprites() {
    const k = this.k;
    this.cacheBola = new Map();
    this.cachePonto = new Map();
    this.cacheNome = new Map();
    this.cacheTexto = new Map();
    this.cacheLampada = new Map();
    this.spSeta = (() => {
      const [c, g] = telaNova(60, 34, k);
      g.fillStyle = NEON.verde;
      g.beginPath(); g.moveTo(2, 32); g.lineTo(30, 2); g.lineTo(58, 32); g.lineTo(30, 18); g.closePath(); g.fill();
      return c;
    })();
    this.fundo = this.desenharFundo();
    this.brilhoParedes = this.desenharParedes(true);

    this.spBumper = COR_BUMPER.map(c => [this.desenharBumper(c, false), this.desenharBumper(c, true)]);
    this.spFlipper = this.desenharFlipper(NEON.ciano);
    this.spFlipperMesa = new Map();
    this.spAlvo = [this.desenharAlvo(true), this.desenharAlvo(false)];
    this.spRoleta = this.desenharRoleta();
    this.spDreno = (() => {
      const [c, g] = telaNova(600, 160, k);
      const gr = g.createRadialGradient(300, 160, 10, 300, 160, 300);
      gr.addColorStop(0, "rgba(255,51,85,.9)");
      gr.addColorStop(1, "rgba(255,51,85,0)");
      g.fillStyle = gr;
      g.fillRect(0, 0, 600, 160);
      return c;
    })();
    this.spFormas = {};
    for (const f of ["estrela", "coracao", "raio"]) {
      const [c, g] = telaNova(44, 44, k);
      g.translate(22, 22);
      g.shadowColor = "#fff"; g.shadowBlur = 8;
      caminhoForma(g, f, 15);
      g.fillStyle = f === "coracao" ? "#ff4fa3" : f === "raio" ? "#fff36b" : "#fff";
      g.fill();
      g.lineWidth = 2.5; g.strokeStyle = "#1a0633"; g.stroke();
      this.spFormas[f] = c;
    }
  },

  /* Bola de cada cor: metal brilhante com o halo da pessoa. */
  bola(cor, tipo = "") {
    const chave = cor + tipo;
    let c = this.cacheBola.get(chave);
    if (c) return c;
    const R = RAIO, m = 22, s = (R + m) * 2;
    let g;
    [c, g] = telaNova(s, s, this.k);
    g.translate(s / 2, s / 2);
    const halo = tipo === "fogo" ? NEON.laranja : tipo === "ouro" ? OURO : cor;
    const gl = g.createRadialGradient(0, 0, R * 0.8, 0, 0, R + m);
    gl.addColorStop(0, rgba(halo, 0.85));
    gl.addColorStop(1, rgba(halo, 0));
    g.fillStyle = gl;
    g.beginPath(); g.arc(0, 0, R + m, 0, Math.PI * 2); g.fill();
    const corpo = g.createRadialGradient(-R * 0.35, -R * 0.4, 2, 0, 0, R);
    if (tipo === "ouro") { corpo.addColorStop(0, "#fffbe0"); corpo.addColorStop(0.35, "#ffd84a"); corpo.addColorStop(1, "#8a5a00"); }
    else if (tipo === "fogo") { corpo.addColorStop(0, "#fff7c0"); corpo.addColorStop(0.35, "#ffb21a"); corpo.addColorStop(1, "#b81d00"); }
    else { corpo.addColorStop(0, "#ffffff"); corpo.addColorStop(0.3, "#e8ecf6"); corpo.addColorStop(0.75, cor); corpo.addColorStop(1, "#1b1030"); }
    g.fillStyle = corpo;
    g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
    g.lineWidth = 2.5; g.strokeStyle = "rgba(255,255,255,.75)"; g.stroke();
    g.fillStyle = "rgba(255,255,255,.9)";
    g.beginPath(); g.ellipse(-R * 0.35, -R * 0.42, R * 0.28, R * 0.18, -0.6, 0, Math.PI * 2); g.fill();
    this.cacheBola.set(chave, c);
    return c;
  },

  /* Ponto de luz pra rastro e faísca (desenhado em modo "lighter"). */
  ponto(cor) {
    let c = this.cachePonto.get(cor);
    if (c) return c;
    let g;
    [c, g] = telaNova(32, 32, this.k);
    const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(0.25, rgba(cor, 0.95));
    gr.addColorStop(1, rgba(cor, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, 32, 32);
    this.cachePonto.set(cor, c);
    return c;
  },

  /* O @ da bola: pílula escura com a borda na cor da pessoa. */
  etiqueta(nome, cor) {
    const chave = nome + "|" + cor;
    let c = this.cacheNome.get(chave);
    if (c) return c;
    const texto = "@" + encurtar(nome, 13);
    const medir = this.ctx;
    medir.font = '800 27px "Figtree", sans-serif';
    const w = Math.ceil(medir.measureText(texto).width) + 30, h = 42;
    let g;
    [c, g] = telaNova(w + 8, h + 8, this.k);
    g.translate(4, 4);
    g.fillStyle = "rgba(10,4,28,.86)";
    g.strokeStyle = cor;
    g.lineWidth = 3.5;
    g.beginPath(); g.roundRect(0, 0, w, h, h / 2); g.fill(); g.stroke();
    g.font = '800 27px "Figtree", sans-serif';
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = "#fff";
    g.fillText(texto, w / 2, h / 2 + 1);
    c.w = w + 8; c.h = h + 8;
    if (this.cacheNome.size > 300) this.cacheNome.clear();
    this.cacheNome.set(chave, c);
    return c;
  },

  /* Texto em Lilita One num canvas pequeno, com contorno escuro opcional:
     número que sobe e letreiro aceso não medem nem contornam a cada quadro. */
  texto(texto, cor, tam, contorno) {
    const chave = texto + "|" + cor + "|" + tam + "|" + contorno;
    let c = this.cacheTexto.get(chave);
    if (c) return c;
    const fonte = `400 ${tam}px "Lilita One", sans-serif`;
    this.ctx.font = fonte;
    const w = Math.ceil(this.ctx.measureText(texto).width) + contorno + 8, h = Math.ceil(tam * 1.3) + contorno;
    let g;
    [c, g] = telaNova(w, h, this.k);
    g.font = fonte;
    g.textAlign = "center"; g.textBaseline = "middle";
    if (contorno) { g.lineJoin = "round"; g.lineWidth = contorno; g.strokeStyle = "#12052a"; g.strokeText(texto, w / 2, h / 2); }
    g.fillStyle = cor;
    g.fillText(texto, w / 2, h / 2);
    c.w = w; c.h = h;
    if (this.cacheTexto.size > 120) this.cacheTexto.clear();
    this.cacheTexto.set(chave, c);
    return c;
  },

  lampada(cor) {
    let par = this.cacheLampada.get(cor);
    if (par) return par;
    par = [0.16, 1].map(a => {
      const r = 13, s = r * 2 + 6;
      const [c, g] = telaNova(s, s, this.k);
      g.fillStyle = rgba(cor, a === 1 ? 1 : 0.16);
      g.beginPath(); g.arc(s / 2, s / 2, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = rgba(cor, a === 1 ? 1 : 0.5); g.lineWidth = 2.5; g.stroke();
      return c;
    });
    this.cacheLampada.set(cor, par);
    return par;
  },

  desenharBumper(cor, aceso) {
    const r = 46, s = (r + MARGEM_BUMPER) * 2;
    const [c, g] = telaNova(s, s, this.k);
    g.translate(s / 2, s / 2);
    g.shadowColor = cor;
    g.shadowBlur = aceso ? 40 : 22;
    g.lineWidth = 9;
    g.strokeStyle = cor;
    g.beginPath(); g.arc(0, 0, r - 4, 0, Math.PI * 2); g.stroke();
    if (aceso) { g.beginPath(); g.arc(0, 0, r - 4, 0, Math.PI * 2); g.stroke(); }
    g.shadowBlur = 0;
    const tampa = g.createRadialGradient(0, -8, 4, 0, 0, r - 8);
    tampa.addColorStop(0, aceso ? "#ffffff" : rgba(cor, 0.55));
    tampa.addColorStop(0.55, aceso ? rgba(cor, 0.95) : "#2a0f4a");
    tampa.addColorStop(1, aceso ? rgba(cor, 0.6) : "#12052a");
    g.fillStyle = tampa;
    g.beginPath(); g.arc(0, 0, r - 8, 0, Math.PI * 2); g.fill();
    g.lineWidth = 3; g.strokeStyle = "rgba(255,255,255,.9)";
    g.beginPath(); g.arc(0, 0, r - 4, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(0, 0, r - 22, 0, Math.PI * 2);
    g.strokeStyle = aceso ? "#fff" : rgba(cor, 0.9); g.lineWidth = 4; g.stroke();
    caminhoForma(g, "estrela", 13);
    g.fillStyle = aceso ? "#fff" : cor;
    g.fill();
    return c;
  },

  /* Flipper apontando pro +x a partir do pino; gira no desenho. */
  desenharFlipper(cor) {
    const f = this.partida.geo.flippers[0];
    const m = 24, w = f.len + f.r0 + f.r1 + m * 2, h = f.r0 * 2 + m * 2;
    const [c, g] = telaNova(w, h, this.k);
    g.translate(m + f.r0, h / 2);
    const contorno = () => {
      const a = Math.asin((f.r0 - f.r1) / f.len);
      g.beginPath();
      g.arc(0, 0, f.r0, Math.PI / 2 + a, Math.PI * 1.5 - a);
      g.arc(f.len, 0, f.r1, -Math.PI / 2 - a, Math.PI / 2 + a);
      g.closePath();
    };
    g.shadowColor = cor; g.shadowBlur = 20;
    contorno();
    const gr = g.createLinearGradient(0, -f.r0, 0, f.r0);
    gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.45, cor); gr.addColorStop(1, "#1c0a40");
    g.fillStyle = gr; g.fill();
    g.shadowBlur = 0;
    g.lineWidth = 3; g.strokeStyle = "#fff"; g.stroke();
    g.fillStyle = "#170733";
    g.beginPath(); g.arc(0, 0, 8, 0, Math.PI * 2); g.fill();
    g.strokeStyle = cor; g.lineWidth = 3; g.stroke();
    c.ox = m + f.r0; c.oy = h / 2;
    return c;
  },

  desenharAlvo(em) {
    const [c, g] = telaNova(48, 90, this.k);
    g.translate(24, 45);
    if (em) {
      g.shadowColor = NEON.laranja; g.shadowBlur = 18;
      const gr = g.createLinearGradient(-9, 0, 9, 0);
      gr.addColorStop(0, "#ffb15e"); gr.addColorStop(0.5, "#fff1d6"); gr.addColorStop(1, NEON.laranja);
      g.fillStyle = gr;
      g.beginPath(); g.roundRect(-9, -33, 18, 66, 5); g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = "#fff"; g.lineWidth = 2; g.stroke();
    } else {
      g.fillStyle = "rgba(255,122,26,.18)";
      g.strokeStyle = "rgba(255,122,26,.45)"; g.lineWidth = 2;
      g.beginPath(); g.roundRect(-9, -33, 18, 66, 5); g.fill(); g.stroke();
    }
    return c;
  },

  desenharRoleta() {
    const r = 54, m = 26, s = (r + m) * 2;
    const [c, g] = telaNova(s, s, this.k);
    g.translate(s / 2, s / 2);
    g.shadowColor = NEON.amarelo; g.shadowBlur = 24;
    g.fillStyle = "#12052a";
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0;
    const n = PREMIOS_ROLETA.length, fatia = Math.PI * 2 / n;
    for (let i = 0; i < n; i++) {
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, r - 4, i * fatia, (i + 1) * fatia);
      g.closePath();
      g.fillStyle = rgba(COR_ROLETA[i], PREMIOS_ROLETA[i].id === "jackpot" ? 1 : 0.8);
      g.fill();
      g.strokeStyle = "#12052a"; g.lineWidth = 3; g.stroke();
    }
    g.lineWidth = 4; g.strokeStyle = "#fff";
    g.beginPath(); g.arc(0, 0, r - 2, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "#12052a";
    g.beginPath(); g.arc(0, 0, 17, 0, Math.PI * 2); g.fill();
    g.strokeStyle = NEON.amarelo; g.lineWidth = 3; g.stroke();
    caminhoForma(g, "estrela", 10);
    g.fillStyle = NEON.amarelo; g.fill();
    return c;
  },

  /* Tubo de neon: halo largo e fraco, brilho e o miolo quase branco. */
  tubo(g, desenho, cor, largura = 8) {
    g.lineCap = "round"; g.lineJoin = "round";
    g.strokeStyle = rgba(cor, 0.16); g.lineWidth = largura * 4; desenho(); g.stroke();
    g.shadowColor = cor; g.shadowBlur = largura * 3;
    g.strokeStyle = cor; g.lineWidth = largura; desenho(); g.stroke();
    g.shadowBlur = 0;
    g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = Math.max(2, largura * 0.3); desenho(); g.stroke();
  },

  corParede(s) {
    if (s.tipo === "estilingue") return NEON.rosa;
    if (s.tipo === "arco") return NEON.ciano;
    if (s.r === 6) return NEON.roxo;
    if (s.ay === 172) return NEON.amarelo;
    return NEON.ciano;
  },

  desenharParedes(soBrilho) {
    const geo = this.partida.geo;
    const [c, g] = telaNova(1080, 1640, this.k);
    for (const s of geo.paredes) {
      if (s.tipo === "trava") continue;
      const cor = soBrilho ? "#ffffff" : this.corParede(s);
      this.tubo(g, () => { g.beginPath(); g.moveTo(s.ax, s.ay); g.lineTo(s.bx, s.by); }, cor, s.tipo === "estilingue" ? 10 : 8);
    }
    return c;
  },

  desenharFundo() {
    const W = this.W, H = this.H, oy = this.oy, geo = this.partida.geo;
    const [c, g] = telaNova(W, H, this.k);
    const ceu = g.createLinearGradient(0, 0, 0, H);
    ceu.addColorStop(0, "#0d0221"); ceu.addColorStop(0.5, "#14032e"); ceu.addColorStop(1, "#07010f");
    g.fillStyle = ceu;
    g.fillRect(0, 0, W, H);

    g.save();
    g.translate(0, oy);
    /* Tampo da mesa. */
    g.beginPath();
    for (const p of geo.arco) g.lineTo(p.x, p.y);
    g.lineTo(1044, 1640); g.lineTo(36, 1640);
    g.closePath();
    const tampo = g.createLinearGradient(0, 0, 0, 1640);
    tampo.addColorStop(0, "#1d0a44"); tampo.addColorStop(0.55, "#120533"); tampo.addColorStop(1, "#0a0220");
    g.fillStyle = tampo;
    g.fill();
    g.save();
    g.clip();
    /* Grade de fliperama, só sugerida. */
    g.strokeStyle = "rgba(138,59,255,.10)";
    g.lineWidth = 2;
    for (let x = 36; x < 1044; x += 54) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 1640); g.stroke(); }
    for (let y = 40; y < 1640; y += 54) { g.beginPath(); g.moveTo(0, y); g.lineTo(1080, y); g.stroke(); }
    /* Halo atrás das peças do meio. */
    const meio = g.createRadialGradient(498, 600, 30, 498, 600, 520);
    meio.addColorStop(0, "rgba(255,43,214,.20)"); meio.addColorStop(1, "rgba(255,43,214,0)");
    g.fillStyle = meio;
    g.fillRect(0, 0, 1080, 1640);
    /* Canal de lançamento. */
    g.fillStyle = "rgba(0,229,255,.06)";
    g.fillRect(960, 420, 84, 1220);
    g.restore();

    /* Anéis em volta da roleta. */
    const ro = geo.roleta;
    for (const [r, a] of [[92, 0.35], [118, 0.18]]) {
      g.strokeStyle = rgba(NEON.amarelo, a); g.lineWidth = 3;
      g.setLineDash([10, 12]);
      g.beginPath(); g.arc(ro.x, ro.y, r, 0, Math.PI * 2); g.stroke();
    }
    g.setLineDash([]);

    /* Letreiro do tampo, entre os estilingues. */
    g.textAlign = "center"; g.textBaseline = "middle";
    g.font = '400 92px "Lilita One", sans-serif';
    g.shadowColor = NEON.rosa; g.shadowBlur = 26;
    g.lineWidth = 4; g.strokeStyle = rgba(NEON.rosa, 0.85);
    g.strokeText("PINBALL", 498, 1130);
    g.shadowColor = NEON.ciano;
    g.strokeStyle = rgba(NEON.ciano, 0.85);
    g.strokeText("GIGANTE", 498, 1225);
    g.shadowBlur = 0;
    g.fillStyle = "rgba(255,255,255,.06)";
    g.fillText("PINBALL", 498, 1130);
    g.fillText("GIGANTE", 498, 1225);

    /* Molas do lançador. */
    g.strokeStyle = rgba(NEON.ciano, 0.7); g.lineWidth = 4;
    for (let y = 1612; y < 1640; y += 8) { g.beginPath(); g.moveTo(972, y); g.lineTo(1032, y + 4); g.stroke(); }

    g.drawImage(this.desenharParedes(false), 0, 0, 1080, 1640);
    g.restore();
    return c;
  },

  /* ───────── acontecimentos ───────── */

  ver(lista) {
    const geo = this.partida.geo, L = this.luz;
    for (const e of lista) {
      switch (e.tipo) {
        case "bumper": {
          const k = geo.bumpers[e.i];
          L.bumper[e.i] = 1;
          this.faiscas(k.x, k.y, COR_BUMPER[e.i], 8, 420);
          break;
        }
        case "estilingue": {
          L.estilingue[e.i] = 1;
          this.faiscas(e.i ? 853 : 143, 1217, NEON.rosa, 5, 300);
          break;
        }
        case "alvo": {
          L.alvo[e.i] = 1;
          const a = geo.alvos[e.i];
          this.faiscas(a.ax, (a.ay + a.by) / 2, NEON.laranja, 10, 380);
          break;
        }
        case "banco": L.banco[e.banco] = 1.6; break;
        case "rollover": L.rollover[e.i] = 1; break;
        case "rollovers": L.rollover.fill(1.8); this.faiscas(498, 205, NEON.amarelo, 18, 500); break;
        case "rampa": {
          L.rampa[e.i - 3] = 1.6;
          const s = geo.sensores[e.i];
          this.faiscas(s.x, s.y, NEON.verde, 12, 420);
          break;
        }
        case "roleta": this.girar(e); break;
        case "premio": {
          const r = geo.roleta;
          this.faiscas(r.x, r.y, COR_ROLETA[e.premio], 22, 600);
          this.pop(r.x, r.y - 80, PREMIOS_ROLETA[e.premio].pontos ? `+${milhar(e.valor)}` : PREMIOS_ROLETA[e.premio].rotulo, COR_ROLETA[e.premio], 1.25);
          break;
        }
        case "pontos":
          if (e.valor >= 1000 && e.motivo !== "roleta") this.pop(e.x, e.y - 30, `+${milhar(e.valor)}`, e.cor, e.valor >= 10000 ? 1.15 : 0.85);
          break;
        case "lancou": L.lancador = 1; this.faiscas(1002, 1560, e.dourada ? OURO : e.cor, 8, 380, -1); break;
        case "relancou": L.lancador = 1; break;
        case "caiu":
          L.dreno = 1;
          this.faiscas(Math.max(60, Math.min(1020, e.x)), 1630, e.cor, 14, 520, -1);
          this.rastros.delete(e.n);
          break;
        case "tilt":
          this.tremor = 0.3;
          for (const n of e.bolas) {
            const b = this.partida.bolas.find(x => x.n === n);
            if (b) this.faiscas(b.x, b.y, e.cor, 10, 500);
          }
          break;
        case "jackpot": this.fogos(6); L.flash = 1; break;
        case "recorde": this.fogos(3); break;
        case "efeito":
          if (e.efeito === "fogo") this.anel(e.id, NEON.laranja);
          else if (e.efeito === "mesa") { this.fogos(5); L.flash = 1; }
          else if (e.efeito === "ima") this.anel(e.id, NEON.ciano);
          break;
        case "compartilhou": this.confete(70); break;
        case "reforco": this.confete(40, [OURO, "#fff4b0", "#ffb300"]); break;
        case "limpou":
          for (const b of e.bolas) this.faiscas(b.x, b.y, b.cor, 12, 520);
          this.rastros.clear();
          break;
        case "fim": this.fogos(4); break;
      }
    }
  },

  girar(e) {
    const r = this.roda, fatia = Math.PI * 2 / PREMIOS_ROLETA.length;
    let alvo = -Math.PI / 2 - (e.premio + 0.5) * fatia;
    while (alvo < r.ang + Math.PI * 6) alvo += Math.PI * 2;
    Object.assign(r, { de: r.ang, para: alvo, ini: this.partida.t, fim: e.ate });
  },

  pop(x, y, texto, cor, escala = 1) {
    /* Batida repetida no mesmo lugar (ímã, fogo) empilhava os números até
       virar borrão: o novo toma o lugar do que acabou de nascer ali. */
    const perto = this.pops.find(p => p.vida < 0.3 && Math.abs(p.x - x) < 60 && Math.abs(p.y - y) < 40);
    if (perto) { Object.assign(perto, { x, y, texto, cor, escala, vida: 0 }); return; }
    if (this.pops.length >= (this.leve ? 8 : 14)) this.pops.shift();
    this.pops.push({ x, y, texto, cor, escala, vida: 0 });
  },

  faiscas(x, y, cor, n, vel, sobe = 0) {
    if (this.leve) n = Math.ceil(n / 3);
    const max = this.leve ? 120 : 400;
    for (let i = 0; i < n && this.particulas.length < max; i++) {
      const a = sobe ? -Math.PI / 2 + (Math.random() - 0.5) * 1.6 : Math.random() * Math.PI * 2;
      const v = vel * (0.35 + Math.random() * 0.65);
      this.particulas.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: 0, max: 0.35 + Math.random() * 0.4, cor, tam: 14 + Math.random() * 16, g: 600 });
    }
  },

  anel(id, cor) {
    for (const b of this.partida.bolas) if (b.id === id) this.faiscas(b.x, b.y, cor, 24, 700);
  },

  fogos(n) {
    for (let i = 0; i < n; i++) {
      setTimeout(() => {
        const x = 180 + Math.random() * 720, y = 220 + Math.random() * 700;
        const cor = COR_ROLETA[Math.floor(Math.random() * COR_ROLETA.length)];
        this.faiscas(x, y, cor, 34, 760);
        this.faiscas(x, y, "#ffffff", 8, 300);
      }, i * 260);
    }
  },

  confete(n, cores = COR_ROLETA) {
    if (this.leve) n = Math.ceil(n / 2);
    for (let i = 0; i < n && this.particulas.length < 600; i++) {
      this.particulas.push({
        x: 60 + Math.random() * 960, y: -40 - Math.random() * 300 - this.oy, vx: (Math.random() - 0.5) * 120, vy: 200 + Math.random() * 220,
        vida: 0, max: 2.6 + Math.random(), cor: cores[Math.floor(Math.random() * cores.length)], tam: 10 + Math.random() * 8, g: 60, confete: true, giro: Math.random() * 6,
      });
    }
  },

  /* ───────── quadro ───────── */

  quadro(dt, agora) {
    const P = this.partida, geo = P.geo, L = this.luz, g = this.ctx, k = this.k;
    this.tempo += dt;
    const tt = this.tempo;
    const apagar = (lista, vel) => { for (let i = 0; i < lista.length; i++) lista[i] = Math.max(0, lista[i] - dt * vel); };
    apagar(L.bumper, 4); apagar(L.estilingue, 4); apagar(L.alvo, 4);
    apagar(L.rollover, 2.5); apagar(L.rampa, 1.6); apagar(L.banco, 1.5);
    L.lancador = Math.max(0, L.lancador - dt * 4); L.dreno = Math.max(0, L.dreno - dt * 2.5); L.flash = Math.max(0, L.flash - dt * 2.5);
    this.tremor = Math.max(0, this.tremor - dt);

    const festa = P.t < P.jackpot.festaAte;
    const mult = P.t < P.mult.ate;
    const atr = this.atracao || P.fase !== "jogo";

    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;
    g.drawImage(this.fundo, 0, 0);

    const tx = this.tremor > 0 ? (Math.random() - 0.5) * 22 * this.tremor / 0.3 : 0;
    const ty = this.tremor > 0 ? (Math.random() - 0.5) * 14 * this.tremor / 0.3 : 0;
    g.setTransform(k, 0, 0, k, tx * k, (this.oy + ty) * k);

    /* Festa do jackpot e flash: as paredes acendem por cima no ritmo. */
    if (!this.leve && (festa || L.flash > 0)) {
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = Math.min(1, L.flash + (festa ? 0.35 + 0.35 * Math.abs(Math.sin(tt * 7.8)) : 0));
      g.drawImage(this.brilhoParedes, 0, 0, 1080, 1640);
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
    }

    this.lampadas(g, tt, atr, festa, mult);

    /* Estilingues piscando quando batem. */
    g.lineCap = "round";
    for (const s of geo.paredes) {
      if (s.tipo !== "estilingue") continue;
      const v = L.estilingue[s.i];
      if (v <= 0) continue;
      g.globalCompositeOperation = "lighter";
      g.strokeStyle = rgba(NEON.rosa, 0.5 * v); g.lineWidth = 40;
      g.beginPath(); g.moveTo(s.ax, s.ay); g.lineTo(s.bx, s.by); g.stroke();
      g.strokeStyle = rgba("#ffffff", v); g.lineWidth = 8;
      g.beginPath(); g.moveTo(s.ax, s.ay); g.lineTo(s.bx, s.by); g.stroke();
      g.globalCompositeOperation = "source-over";
    }

    for (const a of geo.alvos) {
      const sp = this.spAlvo[a.caido ? 1 : 0];
      g.drawImage(sp, a.ax - 24, (a.ay + a.by) / 2 - 45, 48, 90);
    }

    /* Bumpers: na vitrine e na festa piscam em sequência. */
    geo.bumpers.forEach((b, i) => {
      const chase = (atr || festa) && Math.floor(tt * (festa ? 8 : 3)) % 3 === i;
      const v = Math.max(L.bumper[i], chase ? 0.7 : 0);
      const sp = this.spBumper[i][v > 0.25 ? 1 : 0];
      const s = (b.r + MARGEM_BUMPER) * 2 * (1 + v * 0.1);
      g.drawImage(sp, b.x - s / 2, b.y - s / 2, s, s);
    });

    this.roleta(g, P, dt);

    /* Trava da "mesa é sua". */
    if (P.mesa) {
      const tr = geo.trava;
      const pulso = 0.6 + 0.4 * Math.sin(tt * 10);
      g.lineCap = "round";
      g.strokeStyle = rgba(P.mesa.cor, 0.35 * pulso); g.lineWidth = 46;
      g.beginPath(); g.moveTo(tr.ax, tr.ay); g.lineTo(tr.bx, tr.by); g.stroke();
      g.strokeStyle = P.mesa.cor; g.lineWidth = 14;
      g.beginPath(); g.moveTo(tr.ax, tr.ay); g.lineTo(tr.bx, tr.by); g.stroke();
      g.strokeStyle = "#fff"; g.lineWidth = 4;
      g.beginPath(); g.moveTo(tr.ax, tr.ay); g.lineTo(tr.bx, tr.by); g.stroke();
    }

    for (const f of geo.flippers) {
      let sp = this.spFlipper;
      if (P.mesa) {
        sp = this.spFlipperMesa.get(P.mesa.cor);
        if (!sp) { sp = this.desenharFlipper(P.mesa.cor); this.spFlipperMesa.set(P.mesa.cor, sp); }
      }
      g.save();
      g.translate(f.px, f.py);
      g.rotate(f.ang);
      g.drawImage(sp, -sp.ox, -sp.oy, sp.width / k, sp.height / k);
      g.restore();
    }

    if (L.dreno > 0) {
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = L.dreno;
      g.drawImage(this.spDreno, 198, 1480, 600, 160);
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
    }

    this.bolas(g, P, tt);
    this.efeitosParticulas(g, dt);
    this.desenharPops(g, dt);
    g.setTransform(1, 0, 0, 1, 0, 0);
  },

  lampadas(g, tt, atr, festa, mult) {
    const P = this.partida, geo = P.geo, L = this.luz;
    const corrida = atr || festa ? Math.floor(tt * (festa ? 14 : 5)) : -1;
    const acende = (x, y, r, cor, v) => {
      const [apagada, acesa] = this.lampada(cor);
      const s = r * 2 + 6;
      if (v <= 0.05) { g.drawImage(apagada, x - s / 2, y - s / 2, s, s); return; }
      g.globalCompositeOperation = "lighter";
      g.drawImage(this.ponto(cor), x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
      g.globalCompositeOperation = "source-over";
      g.globalAlpha = 0.5 + 0.5 * Math.min(1, v);
      g.drawImage(acesa, x - s / 2, y - s / 2, s, s);
      g.globalAlpha = 1;
    };

    geo.sensores.slice(0, 3).forEach((s, i) => {
      const v = Math.max(geo.rollovers[i] ? 0.8 : 0, L.rollover[i], corrida >= 0 && corrida % 3 === i ? 0.9 : 0);
      acende(s.x, s.y + 2, 13, NEON.amarelo, v);
    });

    /* Setas das rampas: correm pra cima quando a bola passa. */
    for (const [i, x] of [[0, 93], [1, 903]]) {
      const v = L.rampa[i];
      for (let j = 0; j < 3; j++) {
        const y = 880 - j * 62;
        const fase = Math.floor(tt * (v > 0 ? 14 : atr || festa ? 6 : 2.5)) % 3;
        g.globalAlpha = fase === j ? (v > 0 ? 1 : 0.55) : v > 0 ? 0.35 : 0.08;
        g.drawImage(this.spSeta, x - 30, y - 16, 60, 34);
      }
      g.globalAlpha = 1;
    }

    geo.alvos.forEach((a, i) => {
      const lado = a.banco ? -38 : 38;
      const v = Math.max(a.caido ? 0.7 : 0, L.alvo[i], L.banco[a.banco] > 0 ? Math.abs(Math.sin(tt * 18)) : 0);
      acende(a.ax + lado, (a.ay + a.by) / 2, 9, NEON.laranja, v);
    });

    const pisca = Math.abs(Math.sin(tt * 9));
    this.insert(g, 498, 965, "2X", NEON.verde, mult ? 0.6 + 0.4 * pisca : corrida >= 0 && corrida % 4 === 0 ? 0.5 : 0);
    this.insert(g, 498, 1015, "JACKPOT", NEON.rosa, festa ? pisca : corrida >= 0 && corrida % 4 === 2 ? 0.5 : 0);

    if (L.lancador > 0 || atr) acende(1002, 1520, 12, NEON.ciano, Math.max(L.lancador, atr ? 0.3 + 0.3 * Math.sin(tt * 4) : 0));
  },

  insert(g, x, y, texto, cor, v) {
    const aceso = v > 0.05;
    if (aceso) {
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = Math.min(1, v);
      g.drawImage(this.ponto(cor), x - 110, y - 40, 220, 80);
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
    }
    const sp = this.texto(texto, aceso ? "#ffffff" : rgba(cor, 0.22), 34, 0);
    g.drawImage(sp, x - sp.w / 2, y - sp.h / 2, sp.w, sp.h);
  },

  roleta(g, P, dt) {
    const r = this.roda, ro = P.geo.roleta;
    if (r.fim > r.ini && P.t < r.fim) {
      const u = Math.min(1, (P.t - r.ini) / (r.fim - r.ini));
      r.ang = r.de + (r.para - r.de) * (1 - Math.pow(1 - u, 3));
    } else if (r.fim > r.ini) {
      r.ang = r.para;
      r.ini = r.fim = 0;
    } else r.ang += dt * 0.25;
    const sp = this.spRoleta, s = (54 + 26) * 2;
    g.save();
    g.translate(ro.x, ro.y);
    g.rotate(r.ang);
    g.drawImage(sp, -s / 2, -s / 2, s, s);
    g.restore();
    g.fillStyle = "#fff";
    g.strokeStyle = "#12052a"; g.lineWidth = 3;
    g.beginPath(); g.moveTo(ro.x - 12, ro.y - 72); g.lineTo(ro.x + 12, ro.y - 72); g.lineTo(ro.x, ro.y - 50); g.closePath();
    g.fill(); g.stroke();
  },

  bolas(g, P, tt) {
    const alfa = P.alfa;
    const max = this.leve ? 3 : 9;
    const k = this.k;
    const vivos = this._vivos || (this._vivos = new Set());
    vivos.clear();
    for (const b of P.bolas) {
      const x = b.antX + (b.x - b.antX) * alfa, y = b.antY + (b.y - b.antY) * alfa;
      vivos.add(b.n);
      let r = this.rastros.get(b.n);
      if (!r) { r = []; this.rastros.set(b.n, r); }
      r.push(x, y);
      if (r.length > max * 2) r.splice(0, 2);
      const p = P.pessoas.get(b.id);
      const fogo = p && P.t < p.fogoAte;
      const ima = p && P.t < p.imaAte;
      const cor = fogo ? NEON.laranja : b.dourada ? OURO : b.cor;

      g.globalCompositeOperation = "lighter";
      const pt = this.ponto(cor);
      const n = r.length / 2;
      for (let i = 0; i < n - 1; i++) {
        const u = (i + 1) / n;
        const s = RAIO * 2.4 * (0.4 + 0.6 * u);
        g.globalAlpha = 0.5 * u;
        g.drawImage(pt, r[i * 2] - s / 2, r[i * 2 + 1] - s / 2, s, s);
      }
      g.globalAlpha = 1;

      if (ima) {
        let alvo = P.geo.bumpers[0], melhor = Infinity;
        for (const kb of P.geo.bumpers) {
          const d = (kb.x - x) ** 2 + (kb.y - y) ** 2;
          if (d < melhor) { melhor = d; alvo = kb; }
        }
        g.strokeStyle = rgba(NEON.ciano, 0.8);
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(x, y);
        for (let i = 1; i < 6; i++) {
          const u = i / 6;
          g.lineTo(x + (alvo.x - x) * u + (Math.random() - 0.5) * 22, y + (alvo.y - y) * u + (Math.random() - 0.5) * 22);
        }
        g.lineTo(alvo.x, alvo.y);
        g.stroke();
      }
      if (fogo && Math.random() < (this.leve ? 0.5 : 1)) {
        this.particulas.push({ x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 20, vx: (Math.random() - 0.5) * 80, vy: -120 - Math.random() * 120, vida: 0, max: 0.4, cor: Math.random() < 0.5 ? NEON.laranja : NEON.amarelo, tam: 26, g: -200 });
      }
      g.globalCompositeOperation = "source-over";

      const sp = this.bola(b.cor, fogo ? "fogo" : b.dourada ? "ouro" : "");
      const s = sp.width / k;
      g.drawImage(sp, x - s / 2, y - s / 2, s, s);
      if (b.brilho) {
        const f = this.spFormas[b.brilho];
        g.save();
        g.translate(x, y);
        g.rotate(Math.sin(tt * 3 + b.n) * 0.3);
        g.drawImage(f, -22, -22, 44, 44);
        g.restore();
      }
    }
    for (const n of this.rastros.keys()) if (!vivos.has(n)) this.rastros.delete(n);

    this.rotulos(g, P, alfa);
  },

  /* Os @ por último, por cima de tudo. Com a mesa cheia eles se amontoam:
     quando dois se cruzam fica o da bola com mais pontos (empate: a mais
     nova). Perto dos flippers, onde as bolas se juntam, o @ fica menor e
     mais apagado. */
  rotulos(g, P, alfa) {
    const lista = this._rotulos || (this._rotulos = []);
    lista.length = 0;
    for (const b of P.bolas) lista.push(b);
    lista.sort((a, b) => b.pontos - a.pontos || b.n - a.n);
    const postos = this._postos || (this._postos = []);
    postos.length = 0;
    for (const b of lista) {
      const x = b.antX + (b.x - b.antX) * alfa, y = b.antY + (b.y - b.antY) * alfa;
      const e = this.etiqueta(b.nome, b.dourada ? OURO : b.cor);
      const discreto = y > ZONA_FLIPPER;
      const esc = discreto ? 0.78 : 1;
      const w = e.w * esc, h = e.h * esc;
      const ex = Math.min(1080 - w - 4, Math.max(4, x - w / 2));
      const ey = y < 140 ? y + RAIO + 8 : y - RAIO - h - 4;
      let cruza = false;
      for (let i = 0; i < postos.length; i += 4) {
        if (ex + 6 < postos[i + 2] && ex + w - 6 > postos[i] && ey + 4 < postos[i + 3] && ey + h - 4 > postos[i + 1]) { cruza = true; break; }
      }
      if (cruza) continue;
      postos.push(ex, ey, ex + w, ey + h);
      g.globalAlpha = discreto ? 0.6 : 1;
      g.drawImage(e, ex, ey, w, h);
    }
    g.globalAlpha = 1;
  },

  efeitosParticulas(g, dt) {
    const ps = this.particulas;
    let j = 0;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      p.vida += dt;
      if (p.vida >= p.max) continue;
      p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (!p.confete) { p.vx *= 1 - dt * 2; p.vy *= 1 - dt * 1.2; }
      ps[j++] = p;
    }
    ps.length = j;
    g.globalCompositeOperation = "lighter";
    for (const p of ps) {
      if (p.confete) continue;
      const u = 1 - p.vida / p.max;
      const s = p.tam * (0.5 + 0.5 * u);
      g.globalAlpha = u;
      g.drawImage(this.ponto(p.cor), p.x - s / 2, p.y - s / 2, s, s);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    for (const p of ps) {
      if (!p.confete) continue;
      p.giro += dt * 8;
      g.fillStyle = p.cor;
      const w = p.tam * Math.abs(Math.cos(p.giro));
      g.fillRect(p.x - w / 2, p.y - p.tam * 0.3, w, p.tam * 0.6);
    }
  },

  desenharPops(g, dt) {
    let j = 0;
    for (const p of this.pops) {
      p.vida += dt;
      if (p.vida > 1) continue;
      this.pops[j++] = p;
      const u = p.vida;
      const s = p.escala * (u < 0.12 ? 0.6 + u * 4 : 1);
      g.globalAlpha = u > 0.7 ? (1 - u) / 0.3 : 1;
      const sp = this.texto(p.texto, p.cor, Math.round(40 * p.escala), 9);
      const y = p.y - u * 70;
      const w = sp.w * s / p.escala, h = sp.h * s / p.escala;
      g.drawImage(sp, p.x - w / 2, y - h / 2, w, h);
    }
    this.pops.length = j;
    g.globalAlpha = 1;
  },
};

function milhar(n) { return Math.round(n).toLocaleString("pt-BR"); }
