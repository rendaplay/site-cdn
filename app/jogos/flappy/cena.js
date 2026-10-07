/* Canvas do voo: cenário, pilares de tijolo, tucano, chinelos, meteoros,
   pão de queijo, partículas e os efeitos de tela (vento, neblina, ponta-
   cabeça, câmera lenta, chuva de meteoros). Só desenha: o estado vem da
   Partida, e o que acontece chega por `reagir`. */
"use strict";

const MAX_PARTICULAS = 700;
const DISPLAY = '"Big Shoulders Display", "Arial Narrow", Impact, sans-serif';
const TEXTO = '"Figtree", "Segoe UI", system-ui, sans-serif';

const Cena = {
  particulas: [],
  textos: [],
  folhas: [],
  tremor: 0,
  flash: 0,
  hora: 0,
  tintas: { inverte: 0, lento: 0, meteoros: 0, neblina: 0, vento: 0, turbo: 0 },

  montar(canvas) {
    this.canvas = canvas;
    this.c = canvas.getContext("2d");
  },

  aplicarFormato(dims, W, H) {
    this.dims = dims;
    this.W = W;
    this.H = H;
    this.canvas.width = W;
    this.canvas.height = H;
    Cenario.montar(dims, H);
    this.texturas = {};
    this.nevoa = document.createElement("canvas");
    this.nevoa.width = Math.round(W / 2);
    this.nevoa.height = Math.round(H / 2);
    this.folhas = Array.from({ length: 26 }, (_, i) => ({ x: Math.random() * W, y: dims.topo + Math.random() * (dims.chao - dims.topo), v: 0.6 + Math.random() * 0.8, f: i }));
  },

  /* ───────── texturas ───────── */

  /* Tijolo baiano em amarração corrida, com reboco cinza nas juntas e um
     ou outro tijolo virado mostrando os furos. Uma faixa de 480 px que se
     repete na vertical. */
  tijolo(largura, gigante) {
    const chave = `${largura}:${gigante ? 1 : 0}`;
    if (this.texturas[chave]) return this.texturas[chave];
    const alt = 480;
    const tc = document.createElement("canvas");
    tc.width = largura;
    tc.height = alt;
    const c = tc.getContext("2d");
    c.fillStyle = "#8E8A80";
    c.fillRect(0, 0, largura, alt);
    const r = sorteio(largura + (gigante ? 7 : 0));
    const tons = gigante ? ["#B2364A", "#C2414F", "#A42E45", "#BD4A5A"] : ["#C9592C", "#D16634", "#BF4F28", "#D87240", "#C45E30"];
    const th = 40;
    const tw = 86;
    for (let fila = 0; fila * th < alt; fila++) {
      const off = fila % 2 ? -tw / 2 : 0;
      for (let x = off; x < largura; x += tw) {
        const y = fila * th;
        c.fillStyle = tons[Math.floor(r() * tons.length)];
        c.fillRect(x + 3, y + 3, tw - 6, th - 6);
        c.fillStyle = "rgba(255,220,180,.14)";
        c.fillRect(x + 3, y + 3, tw - 6, 4);
        c.fillStyle = "rgba(60,15,5,.18)";
        c.fillRect(x + 3, y + th - 8, tw - 6, 5);
        if (r() < 0.16) {
          c.fillStyle = "rgba(60,18,8,.55)";
          for (let i = 0; i < 4; i++) c.fillRect(x + 12 + i * 17, y + 12, 10, 14);
        }
      }
    }
    /* Volume: luz da esquerda, sombra da direita. */
    const g = c.createLinearGradient(0, 0, largura, 0);
    g.addColorStop(0, "rgba(255,230,200,.20)");
    g.addColorStop(0.3, "rgba(255,230,200,0)");
    g.addColorStop(0.72, "rgba(30,0,10,0)");
    g.addColorStop(1, "rgba(30,0,10,.42)");
    c.fillStyle = g;
    c.fillRect(0, 0, largura, alt);
    this.texturas[chave] = this.c.createPattern(tc, "repeat");
    return this.texturas[chave];
  },

  /* ───────── quadro ───────── */

  quadro(partida, dt, agora) {
    const c = this.c;
    const m = partida.mundo;
    const d = this.dims;
    const alvoHora = (partida.pontos / 160) % 1;
    this.hora += (alvoHora - this.hora) * Math.min(1, dt * 0.8);
    if (Math.abs(alvoHora - this.hora) > 0.5) this.hora = alvoHora;
    const noite = noiteDe(this.hora);

    for (const k of Object.keys(this.tintas)) {
      const alvo = partida.ativo(k) ? 1 : 0;
      this.tintas[k] += (alvo - this.tintas[k]) * Math.min(1, dt * 4);
    }

    c.save();
    if (this.tremor > 0.3) {
      c.translate((Math.random() - 0.5) * this.tremor, (Math.random() - 0.5) * this.tremor);
      this.tremor *= Math.pow(0.02, dt);
    } else this.tremor = 0;

    Cenario.fundo(c, this.hora, m.distancia, agora);
    if (this.tintas.meteoros > 0.01) {
      c.fillStyle = `rgba(255,70,30,${0.22 * this.tintas.meteoros})`;
      c.fillRect(0, 0, this.W, d.chao);
    }
    Cenario.fiacao(c, m.distancia, agora, noite);

    for (const pi of m.pilares) this.pilar(pi, partida);
    for (const q of m.queijos) if (!q.pego) this.paoDeQueijo(q.x, q.y + Math.sin(agora * 4 + q.id) * 8, 1);
    for (const pr of m.projeteis) pr.tipo === "chinelo" ? this.chinelo(pr) : this.meteoro(pr, agora);

    this.ventania(dt, agora);
    this.tucano(partida, agora);
    this.atualizarParticulas(dt);
    this.desenharParticulas();

    if (this.tintas.neblina > 0.01) this.neblina(m.passaro, agora);
    if (this.tintas.inverte > 0.01) {
      c.fillStyle = `rgba(90,30,160,${0.2 * this.tintas.inverte})`;
      c.fillRect(0, 0, this.W, d.chao);
    }
    if (this.tintas.lento > 0.01) {
      const v = c.createRadialGradient(this.W / 2, (d.topo + d.chao) / 2, d.chao * 0.25, this.W / 2, (d.topo + d.chao) / 2, d.chao * 0.75);
      v.addColorStop(0, "rgba(60,140,255,0)");
      v.addColorStop(1, `rgba(40,110,255,${0.38 * this.tintas.lento})`);
      c.fillStyle = v;
      c.fillRect(0, 0, this.W, d.chao);
    }

    Cenario.calcadao(c, m.distancia, noite);
    this.desenharTextos(dt);
    c.restore();

    if (this.flash > 0.01) {
      c.fillStyle = `rgba(255,255,255,${this.flash})`;
      c.fillRect(0, 0, this.W, this.H);
      this.flash *= Math.pow(0.004, dt);
    }
  },

  /* ───────── pilar ───────── */

  pilar(pi, partida) {
    const c = this.c;
    const d = this.dims;
    const topoVao = pi.cy - pi.vao / 2;
    const baseVao = pi.cy + pi.vao / 2;
    const gig = !!pi.dono;
    if (pi.quebrado) return;
    c.save();
    if (pi.atravessado && partida.t < partida.invencivelAte) c.globalAlpha = 0.55;
    c.fillStyle = this.tijolo(Math.round(pi.largura), gig);
    c.translate(pi.x, 0);
    c.fillRect(0, 0, pi.largura, topoVao - 26);
    c.save();
    c.translate(0, baseVao + 26);
    c.fillRect(0, 0, pi.largura, d.chao - baseVao - 26);
    c.restore();
    this.laje(pi.largura, topoVao - 30, true, gig);
    this.laje(pi.largura, baseVao, false, gig);
    if (gig) this.pichacao(pi, topoVao, baseVao);
    c.restore();
  },

  /* Laje de concreto na ponta do pilar, com vergalhão espetado. */
  laje(largura, y, emCima, gigante) {
    const c = this.c;
    const x = -12;
    const w = largura + 24;
    const h = 30;
    c.strokeStyle = "#5A3A2A";
    c.lineWidth = 4;
    c.lineCap = "round";
    const ferro = emCima ? y + h : y;
    for (const fx of [0.18, 0.46, 0.8]) {
      const px = largura * fx;
      c.beginPath();
      c.moveTo(px, ferro);
      c.lineTo(px + (fx > 0.5 ? 4 : -3), ferro + (emCima ? 13 : -13));
      c.stroke();
    }
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, gigante ? "#C7BFC4" : "#C9C4B8");
    g.addColorStop(1, gigante ? "#8C8088" : "#8D887C");
    c.fillStyle = g;
    c.fillRect(x, y, w, h);
    c.fillStyle = "rgba(255,255,255,.28)";
    c.fillRect(x, emCima ? y + h - 4 : y, w, 4);
    c.fillStyle = "rgba(0,0,0,.18)";
    c.fillRect(x + w - 10, y, 10, h);
    c.fillStyle = "rgba(60,50,40,.35)";
    for (let i = 0; i < 6; i++) c.fillRect(x + 10 + ((i * 37) % (w - 20)), y + 8 + (i % 3) * 6, 3, 3);
  },

  /* O nome de quem mandou o pilar gigante, pichado no tijolo. */
  pichacao(pi, topoVao, baseVao) {
    const c = this.c;
    const d = this.dims;
    const nome = encurtar(pi.dono.nome, 18);
    const trechos = [[d.topo + 20, topoVao - 40], [baseVao + 40, d.chao - 20]];
    const [a, b] = trechos[0][1] - trechos[0][0] > trechos[1][1] - trechos[1][0] ? trechos[0] : trechos[1];
    const espaco = b - a;
    if (espaco < 140) return;
    c.save();
    c.translate(pi.largura / 2, (a + b) / 2);
    c.rotate(-Math.PI / 2);
    let tam = Math.min(pi.largura * 0.52, (espaco * 0.92) / Math.max(4, nome.length * 0.5));
    c.font = `900 ${tam}px ${DISPLAY}`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.lineJoin = "round";
    c.lineWidth = tam * 0.16;
    c.strokeStyle = "#16101C";
    c.strokeText(nome, 0, 0);
    c.fillStyle = "#FFF35C";
    c.fillText(nome, 0, 0);
    c.restore();
  },

  /* ───────── tucano ───────── */

  tucano(partida, agora) {
    const c = this.c;
    const p = partida.mundo.passaro;
    const g = partida.mundo.mods.gravidade;
    const morto = !p.vivo;
    let rot = Math.max(-0.5, Math.min(1.1, (p.vy * g) / 950));
    if (morto) rot = (p.morteGiro = (p.morteGiro || 0) + 0.18);
    const invencivel = partida.t < partida.invencivelAte && !partida.ativo("turbo");
    if (invencivel && Math.floor(agora * 14) % 2) return this.aura(p, partida, agora, true);

    this.aura(p, partida, agora, false);
    c.save();
    c.translate(p.x, p.y);
    if (g < 0 && !morto) c.scale(1, -1);
    c.rotate(rot);
    desenharTucano(c, 1, p.flap, agora, partida.ativo("turbo"), morto);
    c.restore();
  },

  /* Bolha e asa de ouro em volta do tucano. */
  aura(p, partida, agora, soEscudo) {
    const c = this.c;
    if (partida.ativo("turbo")) {
      const r = 78 + Math.sin(agora * 10) * 4;
      const g = c.createRadialGradient(p.x, p.y, 20, p.x, p.y, r * 1.5);
      g.addColorStop(0, "rgba(255,230,120,.55)");
      g.addColorStop(1, "rgba(255,180,40,0)");
      c.fillStyle = g;
      c.beginPath();
      c.arc(p.x, p.y, r * 1.5, 0, 7);
      c.fill();
      if (Math.random() < 0.7) this.particula({ x: p.x - 30, y: p.y + (Math.random() - 0.5) * 40, vx: -260 - Math.random() * 200, vy: (Math.random() - 0.5) * 80, vida: 0.6, cor: Math.random() < 0.5 ? "#FFD23F" : "#FFF3B0", tam: 6 + Math.random() * 6, tipo: "brilho" });
    }
    if (partida.ativo("escudo") && !soEscudo) {
      const resta = partida.restante("escudo");
      if (resta < 2 && Math.floor(agora * 8) % 2) return;
      const r = 70 + Math.sin(agora * 5) * 3;
      const g = c.createRadialGradient(p.x - 20, p.y - 24, 8, p.x, p.y, r);
      g.addColorStop(0, "rgba(255,255,255,.35)");
      g.addColorStop(0.7, "rgba(140,220,255,.12)");
      g.addColorStop(1, "rgba(140,220,255,.5)");
      c.fillStyle = g;
      c.beginPath();
      c.arc(p.x, p.y, r, 0, 7);
      c.fill();
      c.strokeStyle = "rgba(200,240,255,.9)";
      c.lineWidth = 4;
      c.stroke();
      c.strokeStyle = "rgba(255,255,255,.8)";
      c.lineWidth = 5;
      c.beginPath();
      c.arc(p.x, p.y, r - 12, -2.6, -1.9);
      c.stroke();
    }
  },

  /* ───────── projéteis e pão de queijo ───────── */

  chinelo(pr) {
    const c = this.c;
    c.save();
    c.translate(pr.x, pr.y);
    c.rotate(pr.rot);
    c.fillStyle = "#1D5FD1";
    sola(c, 0, 0, 1.12);
    c.fillStyle = "#F3F0E8";
    sola(c, 0, -3, 1);
    c.strokeStyle = "#1D5FD1";
    c.lineWidth = 6;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(-6, -24);
    c.quadraticCurveTo(-2, -8, -18, 6);
    c.moveTo(-6, -24);
    c.quadraticCurveTo(4, -8, 14, 8);
    c.stroke();
    c.restore();
    this.etiqueta(pr.dono ? pr.dono.nome : "", pr.x + 46, pr.y - 44, "#1D5FD1");
  },

  meteoro(pr, agora) {
    const c = this.c;
    const ang = Math.atan2(pr.vy, pr.vx);
    c.save();
    c.translate(pr.x, pr.y);
    c.rotate(ang);
    const g = c.createLinearGradient(0, 0, -220, 0);
    g.addColorStop(0, "rgba(255,240,170,.95)");
    g.addColorStop(0.3, "rgba(255,140,40,.75)");
    g.addColorStop(1, "rgba(255,60,20,0)");
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(10, -pr.r * 0.95);
    c.quadraticCurveTo(-120, -pr.r * 0.7 + Math.sin(agora * 30) * 4, -230, 0);
    c.quadraticCurveTo(-120, pr.r * 0.7, 10, pr.r * 0.95);
    c.closePath();
    c.fill();
    c.rotate(pr.rot - ang);
    c.fillStyle = "#4A3A36";
    c.beginPath();
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const rr = pr.r * (0.82 + ((i * 7) % 5) * 0.06);
      c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    c.closePath();
    c.fill();
    c.fillStyle = "#6B5650";
    c.beginPath();
    c.arc(-6, -6, pr.r * 0.55, 0, 7);
    c.fill();
    c.fillStyle = "#2E2422";
    for (const [x, y, r] of [[10, 8, 7], [-12, 10, 5], [4, -14, 4]]) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
    c.restore();
    if (Math.random() < 0.5) this.particula({ x: pr.x, y: pr.y, vx: -pr.vx * 0.1 + (Math.random() - 0.5) * 60, vy: -pr.vy * 0.1, vida: 0.5, cor: Math.random() < 0.5 ? "#FFB347" : "#FF6A2A", tam: 5 + Math.random() * 6, tipo: "brilho" });
  },

  paoDeQueijo(x, y, escala) {
    const c = this.c;
    c.save();
    c.translate(x, y);
    c.scale(escala, escala);
    c.fillStyle = "rgba(0,0,0,.18)";
    c.beginPath();
    c.ellipse(4, 26, 26, 7, 0, 0, 7);
    c.fill();
    const g = c.createRadialGradient(-8, -10, 4, 0, 0, 30);
    g.addColorStop(0, "#FFE7A0");
    g.addColorStop(0.6, "#F0B547");
    g.addColorStop(1, "#C98428");
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(0, 0, 30, 26, 0, 0, 7);
    c.fill();
    c.fillStyle = "rgba(160,90,20,.45)";
    for (const [px, py] of [[-12, 4], [8, -8], [12, 8], [-2, 12], [-14, -10], [2, 0]]) c.fillRect(px, py, 4, 3);
    c.fillStyle = "rgba(255,255,255,.55)";
    c.beginPath();
    c.ellipse(-10, -12, 9, 4, -0.5, 0, 7);
    c.fill();
    c.restore();
  },

  etiqueta(texto, x, y, cor) {
    if (!texto) return;
    const c = this.c;
    const t = encurtar(texto, 16);
    c.font = `800 26px ${TEXTO}`;
    const w = c.measureText(t).width + 26;
    c.fillStyle = "rgba(14,10,30,.78)";
    pilula(c, x - w / 2, y - 19, w, 38, 19);
    c.fill();
    c.fillStyle = cor;
    pilula(c, x - w / 2, y - 19, 8, 38, 4);
    c.fill();
    c.fillStyle = "#FFFFFF";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(t, x + 3, y + 1);
  },

  /* ───────── efeitos de tela ───────── */

  ventania(dt, agora) {
    const k = this.tintas.vento;
    if (k < 0.02) return;
    const c = this.c;
    const d = this.dims;
    c.save();
    c.globalAlpha = 0.55 * k;
    c.strokeStyle = "#FFFFFF";
    c.lineCap = "round";
    for (let i = 0; i < 22; i++) {
      const y = d.topo + ((i * 97 + agora * 40) % (d.chao - d.topo));
      const x = this.W - ((agora * (900 + (i % 5) * 160) + i * 230) % (this.W + 600)) + 300;
      const onda = Math.sin(agora * 3.1 + i) * 30;
      c.lineWidth = 2 + (i % 3);
      c.beginPath();
      c.moveTo(x, y + onda);
      c.bezierCurveTo(x - 80, y + onda - 10, x - 160, y + onda + 12, x - 260, y + onda);
      c.stroke();
    }
    c.globalAlpha = k;
    for (const f of this.folhas) {
      f.x -= (500 + f.v * 400) * dt;
      f.y += Math.sin(agora * 3 + f.f) * 180 * dt;
      if (f.x < -40) { f.x = this.W + 40; f.y = d.topo + Math.random() * (d.chao - d.topo); }
      c.save();
      c.translate(f.x, f.y);
      c.rotate(agora * 6 * f.v + f.f);
      c.fillStyle = f.f % 3 ? "#3FA34D" : "#8BC34A";
      c.beginPath();
      c.ellipse(0, 0, 14, 6, 0, 0, 7);
      c.fill();
      c.restore();
    }
    c.restore();
  },

  /* Neblina com um buraco em volta do tucano: dá pra ver ele, não o que
     vem pela frente. Desenhada em meia resolução. */
  neblina(p, agora) {
    const n = this.nevoa;
    const c = n.getContext("2d");
    const s = n.width / this.W;
    const k = this.tintas.neblina;
    c.globalCompositeOperation = "source-over";
    c.clearRect(0, 0, n.width, n.height);
    c.fillStyle = `rgba(196,204,222,${0.95 * k})`;
    c.fillRect(0, 0, n.width, this.dims.chao * s);
    c.fillStyle = `rgba(255,255,255,${0.3 * k})`;
    for (let i = 0; i < 14; i++) {
      const x = ((i * 211 - agora * 60) % (this.W + 400) + this.W + 400) % (this.W + 400) - 200;
      const y = this.dims.topo + ((i * 137) % (this.dims.chao - this.dims.topo));
      c.beginPath();
      c.ellipse(x * s, y * s, 160 * s, 70 * s, 0, 0, 7);
      c.fill();
    }
    c.globalCompositeOperation = "destination-out";
    const raio = 250;
    const g = c.createRadialGradient(p.x * s, p.y * s, raio * 0.2 * s, p.x * s, p.y * s, raio * s);
    g.addColorStop(0, "rgba(0,0,0,.9)");
    g.addColorStop(0.55, "rgba(0,0,0,.55)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, n.width, n.height);
    c.globalCompositeOperation = "source-over";
    this.c.drawImage(n, 0, 0, this.W, this.H);
  },

  /* ───────── partículas e textos ───────── */

  particula(p) {
    if (this.particulas.length >= MAX_PARTICULAS) this.particulas.shift();
    p.idade = 0;
    p.rot = p.rot || 0;
    this.particulas.push(p);
  },

  explodir(x, y, cores, n, forca, tipo = "brilho", tam = 8) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = forca * (0.3 + Math.random());
      this.particula({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - forca * 0.3, vida: 0.7 + Math.random() * 0.7,
        cor: cores[i % cores.length], tam: tam * (0.6 + Math.random() * 0.8), tipo, giro: (Math.random() - 0.5) * 12, g: tipo === "brilho" ? 300 : 1400 });
    }
  },

  atualizarParticulas(dt) {
    for (const p of this.particulas) {
      p.idade += dt;
      p.vy += (p.g || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += (p.giro || 0) * dt;
      if (p.tipo !== "brilho" && p.y > this.dims.chao - 4 && p.vy > 0) { p.y = this.dims.chao - 4; p.vy *= -0.3; p.vx *= 0.6; }
    }
    this.particulas = this.particulas.filter(p => p.idade < p.vida);
  },

  desenharParticulas() {
    const c = this.c;
    for (const p of this.particulas) {
      const k = 1 - p.idade / p.vida;
      c.globalAlpha = Math.min(1, k * 1.6);
      c.fillStyle = p.cor;
      if (p.tipo === "tijolo" || p.tipo === "confete") {
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.rot);
        c.fillRect(-p.tam, -p.tam * 0.5, p.tam * 2, p.tam);
        c.restore();
      } else if (p.tipo === "pena") {
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.rot);
        c.beginPath();
        c.ellipse(0, 0, p.tam * 1.6, p.tam * 0.55, 0, 0, 7);
        c.fill();
        c.restore();
      } else {
        c.beginPath();
        c.arc(p.x, p.y, p.tam * (0.4 + k * 0.6), 0, 7);
        c.fill();
      }
    }
    c.globalAlpha = 1;
  },

  texto(t, x, y, { cor = "#FFFFFF", tam = 64, dur = 1.1, sobe = 90 } = {}) {
    if (this.textos.length > 14) this.textos.shift();
    const d = this.dims;
    y = Math.max(d.topo + sobe + tam, Math.min(d.chao - 40, y));
    x = Math.max(tam * t.length * 0.22, Math.min(this.W - tam * t.length * 0.22, x));
    this.textos.push({ t, x, y, cor, tam, dur, sobe, idade: 0 });
  },

  desenharTextos(dt) {
    const c = this.c;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.lineJoin = "round";
    for (const t of this.textos) {
      t.idade += dt;
      const k = t.idade / t.dur;
      const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.5 : 1.1 - Math.min(0.1, (k - 0.15));
      c.globalAlpha = Math.max(0, Math.min(1, (1 - k) * 2.2));
      c.font = `900 ${t.tam * pop}px ${DISPLAY}`;
      c.lineWidth = t.tam * 0.14;
      c.strokeStyle = "rgba(16,10,30,.9)";
      c.strokeText(t.t, t.x, t.y - k * t.sobe);
      c.fillStyle = t.cor;
      c.fillText(t.t, t.x, t.y - k * t.sobe);
    }
    c.globalAlpha = 1;
    this.textos = this.textos.filter(t => t.idade < t.dur);
  },

  /* ───────── reações a acontecimentos ───────── */

  pena(p) {
    this.explodir(p.x, p.y, ["#151218", "#2A2530", "#FFD84A", "#FF8A1F"], 26, 520, "pena", 9);
  },

  quebrarPilar(pi, y) {
    const d = this.dims;
    const y0 = Math.max(d.topo, Math.min(d.chao, y));
    for (let i = 0; i < 40; i++) {
      this.particula({ x: pi.x + Math.random() * pi.largura, y: y0 + (Math.random() - 0.5) * 300,
        vx: 200 + Math.random() * 500, vy: -300 - Math.random() * 500, vida: 1.4, cor: ["#C9592C", "#D87240", "#8E8A80"][i % 3],
        tam: 10 + Math.random() * 8, tipo: "tijolo", giro: (Math.random() - 0.5) * 14, g: 1600 });
    }
  },

  impacto(x, y) {
    this.tremor = Math.max(this.tremor, 16);
    this.explodir(x, y - 10, ["#FF8A2A", "#FFD27A", "#5A4A44"], 22, 520, "tijolo", 7);
  },
};

/* ───────── desenho do Tuca (também usado no cardápio e na capa) ───────── */

function desenharTucano(c, escala, flap, agora, dourado, morto) {
  c.save();
  c.scale(escala, escala);
  const preto = dourado ? "#9A6A10" : "#141117";
  const asaAng = morto ? 0.9 : -0.9 * flap + Math.sin(agora * 16) * 0.12 * (1 - flap) + 0.25;

  /* cauda */
  c.fillStyle = preto;
  c.beginPath();
  c.moveTo(-30, -4);
  c.lineTo(-66, -18);
  c.lineTo(-70, 4);
  c.lineTo(-30, 14);
  c.closePath();
  c.fill();
  c.fillStyle = "#D7263D";
  c.beginPath();
  c.ellipse(-26, 22, 12, 8, 0.3, 0, 7);
  c.fill();

  /* corpo */
  const corpo = c.createRadialGradient(-6, -14, 6, 0, 0, 46);
  corpo.addColorStop(0, dourado ? "#FFD860" : "#3A3440");
  corpo.addColorStop(1, preto);
  c.fillStyle = corpo;
  c.beginPath();
  c.ellipse(0, 2, 42, 34, -0.08, 0, 7);
  c.fill();

  /* papo amarelo */
  const papo = c.createLinearGradient(14, -22, 30, 26);
  papo.addColorStop(0, "#FFF6D0");
  papo.addColorStop(0.55, "#FFD84A");
  papo.addColorStop(1, "#F2A81E");
  c.fillStyle = papo;
  c.beginPath();
  c.ellipse(22, -2, 19, 24, 0.15, 0, 7);
  c.fill();
  c.fillStyle = "#E3402A";
  c.beginPath();
  c.ellipse(18, 22, 12, 4, 0.2, 0, 7);
  c.fill();

  /* bico: laranja, crista vermelha, ponta preta */
  c.save();
  c.translate(30, -14);
  const bico = c.createLinearGradient(0, -14, 0, 22);
  bico.addColorStop(0, "#FFC23A");
  bico.addColorStop(0.55, "#FF8F1F");
  bico.addColorStop(1, "#E5631A");
  c.fillStyle = bico;
  c.beginPath();
  c.moveTo(0, -12);
  c.bezierCurveTo(26, -22, 62, -14, 80, 4);
  c.bezierCurveTo(70, 12, 40, 18, 2, 18);
  c.closePath();
  c.fill();
  c.fillStyle = "#141117";
  c.beginPath();
  c.moveTo(64, -6);
  c.bezierCurveTo(72, -2, 78, 0, 80, 4);
  c.bezierCurveTo(76, 9, 70, 11, 62, 12);
  c.closePath();
  c.fill();
  c.strokeStyle = "#E0402A";
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(4, -12);
  c.bezierCurveTo(26, -21, 50, -16, 64, -6);
  c.stroke();
  c.strokeStyle = "rgba(20,17,23,.55)";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(4, 6);
  c.quadraticCurveTo(40, 8, 74, 6);
  c.stroke();
  c.fillStyle = "#3E9A54";
  c.fillRect(-2, -12, 5, 30);
  c.restore();

  /* olho com a pele azul */
  c.fillStyle = "#3C8FE0";
  c.beginPath();
  c.ellipse(22, -16, 11, 10, 0, 0, 7);
  c.fill();
  if (morto) {
    c.strokeStyle = "#141117";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(18, -20); c.lineTo(26, -12);
    c.moveTo(26, -20); c.lineTo(18, -12);
    c.stroke();
  } else {
    c.fillStyle = "#FFFFFF";
    c.beginPath();
    c.arc(23, -16, 6, 0, 7);
    c.fill();
    c.fillStyle = "#141117";
    c.beginPath();
    c.arc(25, -16, 3.4, 0, 7);
    c.fill();
  }

  /* asa */
  c.save();
  c.translate(-8, -2);
  c.rotate(asaAng);
  const asa = c.createLinearGradient(0, -10, -40, 30);
  asa.addColorStop(0, dourado ? "#FFE27A" : "#2E2934");
  asa.addColorStop(1, dourado ? "#E0A020" : "#0E0C10");
  c.fillStyle = asa;
  c.beginPath();
  c.moveTo(6, -6);
  c.bezierCurveTo(-10, -18, -46, -10, -52, 14);
  c.lineTo(-38, 10);
  c.lineTo(-40, 22);
  c.lineTo(-26, 16);
  c.lineTo(-24, 26);
  c.bezierCurveTo(-8, 22, 6, 10, 6, -6);
  c.closePath();
  c.fill();
  c.restore();
  c.restore();
}

function sola(c, x, y, s) {
  c.beginPath();
  c.ellipse(x, y - 10 * s, 15 * s, 22 * s, 0, Math.PI, 0);
  c.bezierCurveTo(x + 15 * s, y + 6 * s, x + 11 * s, y + 10 * s, x + 12 * s, y + 22 * s);
  c.bezierCurveTo(x + 12 * s, y + 34 * s, x - 12 * s, y + 34 * s, x - 12 * s, y + 22 * s);
  c.bezierCurveTo(x - 11 * s, y + 10 * s, x - 15 * s, y + 6 * s, x - 15 * s, y - 10 * s);
  c.closePath();
  c.fill();
}

function pilula(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function encurtar(texto, n) {
  const chars = [...String(texto || "")];
  return chars.length > n ? chars.slice(0, n - 1).join("") + "…" : chars.join("");
}
