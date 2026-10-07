/* Céu de fim de tarde e a quebrada, desenhados por código uma vez por
   formato em canvas fora da tela. Sorteio com semente: o bairro é sempre
   o mesmo, só muda se trocar a semente. */
"use strict";

function sorteioFixo(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function telaFora(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

const Cenario = {
  /* `horizonte` = altura média das lajes da frente. */
  montar(W, H, horizonte) {
    const rnd = sorteioFixo(1975);
    const fundo = telaFora(W, H);
    const nuvens = telaFora(W * 2, H);
    const frente = telaFora(W, H);
    this.ceu(fundo.getContext("2d"), W, H, horizonte, rnd);
    this.nuvens(nuvens.getContext("2d"), W * 2, horizonte, rnd);
    this.morro(fundo.getContext("2d"), W, H, horizonte, rnd);
    this.casario(fundo.getContext("2d"), W, H, horizonte - 40, rnd, 0.62, true);
    const { lajes, teto } = this.quebrada(frente.getContext("2d"), W, H, horizonte, rnd);
    return { fundo, nuvens, frente, lajes, teto, sol: this.solEm(W, horizonte) };
  },

  solEm(W, horizonte) { return { x: W * 0.7, y: horizonte - 70, r: Math.min(W, 1400) * 0.1 }; },

  ceu(c, W, H, hz, rnd) {
    const g = c.createLinearGradient(0, 0, 0, hz + 40);
    g.addColorStop(0, "#15123A");
    g.addColorStop(0.22, "#2E1F5C");
    g.addColorStop(0.46, "#6E3477");
    g.addColorStop(0.64, "#C24A6F");
    g.addColorStop(0.78, "#F2735A");
    g.addColorStop(0.9, "#FFA65A");
    g.addColorStop(1, "#FFD586");
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);

    for (let i = 0; i < 90; i++) {
      const y = Math.pow(rnd(), 1.8) * hz * 0.38;
      c.globalAlpha = (0.15 + rnd() * 0.55) * (1 - y / (hz * 0.38));
      c.fillStyle = "#FFF6E0";
      const r = rnd() < 0.9 ? 1.2 : 2.2;
      c.beginPath();
      c.arc(rnd() * W, y, r, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;

    const sol = this.solEm(W, hz);
    const brilho = c.createRadialGradient(sol.x, sol.y, sol.r * 0.4, sol.x, sol.y, sol.r * 7);
    brilho.addColorStop(0, "rgba(255,226,160,.85)");
    brilho.addColorStop(0.18, "rgba(255,170,100,.35)");
    brilho.addColorStop(1, "rgba(255,120,90,0)");
    c.fillStyle = brilho;
    c.fillRect(0, 0, W, H);
    const disco = c.createRadialGradient(sol.x, sol.y - sol.r * 0.3, 0, sol.x, sol.y, sol.r);
    disco.addColorStop(0, "#FFFBEA");
    disco.addColorStop(0.75, "#FFE6A8");
    disco.addColorStop(1, "#FFC978");
    c.fillStyle = disco;
    c.beginPath();
    c.arc(sol.x, sol.y, sol.r, 0, Math.PI * 2);
    c.fill();
    /* Faixas de calor cortando o sol, como no fim de tarde com fumaça. */
    c.globalCompositeOperation = "source-atop";
    c.globalAlpha = 0.18;
    c.fillStyle = "#E86A50";
    for (let k = 0; k < 4; k++) c.fillRect(sol.x - sol.r, sol.y + sol.r * (0.15 + k * 0.2), sol.r * 2, 4 + k * 3);
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
  },

  /* Nuvens de faixa (estrato), iluminadas por baixo. Canvas com o dobro
     da largura pra rolar devagar em loop. */
  nuvens(c, W2, hz, rnd) {
    const faixa = (y, comp, alt, cor, alfa) => {
      const x = rnd() * W2;
      for (const dx of [0, -W2, W2]) {
        c.save();
        c.globalAlpha = alfa;
        c.filter = `blur(${Math.round(alt * 0.35)}px)`;
        c.fillStyle = cor;
        c.beginPath();
        c.ellipse(x + dx, y, comp, alt, 0, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }
    };
    for (let i = 0; i < 16; i++) {
      const y = hz * (0.18 + rnd() * 0.62);
      const perto = y / hz;
      const cor = perto > 0.62 ? "#FFB27A" : perto > 0.42 ? "#F08A8A" : "#9C5A9A";
      faixa(y, 160 + rnd() * 380, 8 + rnd() * 16, cor, 0.25 + rnd() * 0.3);
      faixa(y + 6, 120 + rnd() * 200, 4 + rnd() * 6, "#FFE2B8", 0.18 + rnd() * 0.2);
    }
  },

  /* Morro ao fundo coberto de casinha, com janela acesa. */
  morro(c, W, H, hz, rnd) {
    const topo = x => hz - 150 - 120 * Math.exp(-Math.pow((x - W * 0.25) / (W * 0.32), 2))
      - 60 * Math.exp(-Math.pow((x - W * 0.95) / (W * 0.2), 2));
    c.fillStyle = "#5A2D5E";
    c.beginPath();
    c.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) c.lineTo(x, topo(x));
    c.lineTo(W, H);
    c.fill();

    for (let x = -10; x < W; x += 14 + rnd() * 16) {
      const t = topo(x);
      for (let y = t + rnd() * 10; y < hz + 40; y += 12 + rnd() * 10) {
        const w = 14 + rnd() * 20;
        const h = 10 + rnd() * 12;
        const tom = 40 + Math.floor(rnd() * 18);
        c.fillStyle = `rgb(${tom + 50},${tom},${tom + 52})`;
        c.fillRect(x, y - h, w, h);
        if (rnd() < 0.13) {
          c.fillStyle = rnd() < 0.7 ? "#FFC56E" : "#FFE9B0";
          c.fillRect(x + 3 + rnd() * (w - 8), y - h + 3, 3, 3);
        }
      }
    }
    /* Névoa quente por cima do morro. */
    const n = c.createLinearGradient(0, hz - 300, 0, hz + 40);
    n.addColorStop(0, "rgba(255,150,110,0)");
    n.addColorStop(1, "rgba(255,150,110,.45)");
    c.fillStyle = n;
    c.fillRect(0, hz - 300, W, 340);
  },

  /* A quebrada da frente: casas de bloco, laje com ferro pra cima, caixa
     d'água, antena, varal, fio de poste e a molecada na laje. Devolve
     onde ficam as mãos de quem solta pipa (as linhas descem até lá). */
  quebrada(c, W, H, hz, rnd) {
    const casas = this.casario(c, W, H, hz, rnd, 1, false);
    const teto = x => {
      for (const k of casas) if (x >= k.x && x < k.x + k.w) return k.topo;
      return hz;
    };

    this.fios(c, W, hz, rnd);

    /* Molecada na laje: as linhas descem até a mão de cada um. */
    const lajes = [];
    const passo = W / 13;
    for (let i = 0; i < 13; i++) {
      const x = passo * (i + 0.25 + rnd() * 0.5);
      const t = teto(x);
      const alto = 34 + rnd() * 10;
      const lado = rnd() < 0.5 ? 1 : -1;
      this.pessoa(c, x, t - 12, alto, lado);
      lajes.push({ x: x + 6 * (alto / 40) * lado, y: t - 12 - alto });
    }

    const sombra = c.createLinearGradient(0, hz, 0, H);
    sombra.addColorStop(0, "rgba(20,8,24,0)");
    sombra.addColorStop(1, "rgba(20,8,24,.85)");
    c.fillStyle = sombra;
    c.fillRect(0, hz, W, H - hz);
    return { lajes, teto };
  },

  /* Uma fileira de casas. A de trás (`longe`) é menor, mais clara pela
     névoa e sem detalhe de telhado. */
  casario(c, W, H, base, rnd, e, longe) {
    const PAREDES = ["#5A3346", "#4A3550", "#5E3B3B", "#3F3B58", "#57404C", "#4C3045", "#60463E", "#3E4652"];
    const casas = [];
    for (let x = -30; x < W + 30;) {
      const w = (70 + rnd() * 110) * e;
      const andares = rnd() < 0.3 ? 3 : rnd() < 0.65 ? 2 : 1;
      const h = andares * (58 + rnd() * 14) * e;
      casas.push({ x, w, h, topo: base + 110 * e - h + rnd() * 26 * e, andares, cor: PAREDES[Math.floor(rnd() * PAREDES.length)] });
      x += w - 3 + rnd() * 5;
    }

    for (const k of casas) {
      c.fillStyle = k.cor;
      c.fillRect(k.x, k.topo, k.w, H - k.topo);
      if (longe) {
        c.fillStyle = "rgba(190,90,110,.38)";
        c.fillRect(k.x, k.topo, k.w, H - k.topo);
      } else {
        /* Bloco sem reboco: fiadas fracas. Às vezes meia parede rebocada e pintada. */
        c.globalAlpha = 0.08;
        c.fillStyle = "#000";
        for (let y = k.topo + 10; y < H; y += 13) c.fillRect(k.x, y, k.w, 2);
        c.globalAlpha = 1;
        if (rnd() < 0.3) {
          c.fillStyle = "rgba(255,210,170,.07)";
          c.fillRect(k.x, k.topo + k.h * 0.45, k.w, H);
        }
      }
      c.fillStyle = longe ? "rgba(255,160,110,.35)" : "rgba(255,150,90,.6)";
      c.fillRect(k.x, k.topo, k.w, 3);

      const jw = 24 * e, jh = 19 * e;
      for (let a = 0; a < k.andares; a++) {
        const yj = k.topo + 20 * e + a * 66 * e;
        const nj = Math.max(1, Math.floor(k.w / (62 * e)));
        for (let j = 0; j < nj; j++) {
          if (rnd() < 0.18) continue;
          const xj = k.x + (k.w / nj) * (j + 0.5) - jw / 2;
          const acesa = rnd() < (longe ? 0.22 : 0.3);
          if (acesa) {
            c.fillStyle = "rgba(255,190,90,.22)";
            c.fillRect(xj - 6 * e, yj - 5 * e, jw + 12 * e, jh + 10 * e);
          }
          c.fillStyle = acesa ? (rnd() < 0.6 ? "#FFB84D" : "#FFD27A") : "#1C0E22";
          c.fillRect(xj, yj, jw, jh);
          if (longe) continue;
          if (rnd() < 0.55) {
            c.fillStyle = acesa ? "rgba(90,40,10,.55)" : "rgba(255,255,255,.07)";
            for (let g = 1; g < 4; g++) c.fillRect(xj + g * jw / 4, yj, 1.5, jh);
          }
          c.fillStyle = "rgba(0,0,0,.35)";
          c.fillRect(xj - 3, yj + jh, jw + 6, 3);
        }
      }

      if (longe) continue;
      if (rnd() < 0.55) {
        /* Laje com mureta e ferro de espera pra cima. */
        c.fillStyle = k.cor;
        c.fillRect(k.x, k.topo - 12, k.w, 12);
        c.fillStyle = "rgba(0,0,0,.25)";
        c.fillRect(k.x, k.topo - 12, k.w, 12);
        c.fillStyle = "rgba(255,150,90,.5)";
        c.fillRect(k.x, k.topo - 12, k.w, 2);
        c.strokeStyle = "rgba(40,20,30,.9)";
        c.lineWidth = 2;
        const nf = 2 + Math.floor(rnd() * 3);
        for (let f = 0; f < nf; f++) {
          const xf = k.x + 6 + rnd() * (k.w - 12);
          c.beginPath();
          c.moveTo(xf, k.topo - 12);
          c.lineTo(xf + (rnd() - 0.5) * 4, k.topo - 30 - rnd() * 18);
          c.stroke();
        }
      } else {
        /* Telhado de fibrocimento, caído pra um lado. */
        c.fillStyle = "#3B2A3E";
        c.beginPath();
        c.moveTo(k.x - 4, k.topo + 4);
        c.lineTo(k.x + k.w + 4, k.topo - 14);
        c.lineTo(k.x + k.w + 4, k.topo + 2);
        c.lineTo(k.x - 4, k.topo + 14);
        c.fill();
        c.strokeStyle = "rgba(255,170,120,.2)";
        c.lineWidth = 1;
        for (let o = 6; o < k.w; o += 9) {
          c.beginPath();
          c.moveTo(k.x + o, k.topo + 12 - (o / k.w) * 18);
          c.lineTo(k.x + o, k.topo - 2 - (o / k.w) * 18);
          c.stroke();
        }
      }
      if (rnd() < 0.45) this.caixaDagua(c, k.x + 10 + rnd() * Math.max(0, k.w - 54), k.topo - 12);
      else if (rnd() < 0.35) this.antena(c, k.x + 10 + rnd() * Math.max(0, k.w - 30), k.topo - 12, rnd);
      if (rnd() < 0.2 && k.w > 110) this.varal(c, k.x + 8, k.topo - 12, k.w - 16, rnd);
    }
    return casas;
  },

  caixaDagua(c, x, y) {
    c.fillStyle = "#1F4F7A";
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + 4, y - 30);
    c.lineTo(x + 40, y - 30);
    c.lineTo(x + 44, y);
    c.fill();
    c.fillStyle = "#2B6A9E";
    c.beginPath();
    c.ellipse(x + 22, y - 31, 20, 6, 0, Math.PI, 0);
    c.fill();
    c.fillStyle = "rgba(255,180,120,.45)";
    c.fillRect(x + 36, y - 29, 3, 28);
  },

  antena(c, x, y, rnd) {
    c.strokeStyle = "#24132A";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x, y - 46);
    c.stroke();
    for (let i = 0; i < 4; i++) {
      c.beginPath();
      c.moveTo(x - 14 + i * 2, y - 44 + i * 8);
      c.lineTo(x + 14 - i * 2, y - 44 + i * 8);
      c.stroke();
    }
    if (rnd() < 0.5) {
      c.fillStyle = "#2B1830";
      c.beginPath();
      c.ellipse(x + 18, y - 14, 12, 14, -0.5, 0, Math.PI * 2);
      c.fill();
    }
  },

  varal(c, x, y, w, rnd) {
    c.strokeStyle = "rgba(30,15,30,.9)";
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(x, y - 26);
    c.quadraticCurveTo(x + w / 2, y - 16, x + w, y - 26);
    c.stroke();
    const cores = ["#C0392B", "#2471A3", "#F1C40F", "#ECF0F1", "#8E44AD", "#16A085"];
    for (let p = x + 10; p < x + w - 16; p += 18 + rnd() * 10) {
      const f = (p - x) / w;
      const yp = y - 26 + Math.sin(f * Math.PI) * 10;
      c.fillStyle = cores[Math.floor(rnd() * cores.length)];
      c.globalAlpha = 0.55;
      c.fillRect(p, yp, 12, 14 + rnd() * 8);
      c.globalAlpha = 1;
    }
  },

  fios(c, W, hz, rnd) {
    const postes = [];
    for (let x = 60 + rnd() * 80; x < W + 200; x += 300 + rnd() * 120) postes.push(x);
    c.strokeStyle = "#1A0C1E";
    for (const x of postes) {
      c.lineWidth = 7;
      c.beginPath();
      c.moveTo(x, hz + 400);
      c.lineTo(x, hz - 40);
      c.stroke();
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(x - 22, hz - 30);
      c.lineTo(x + 22, hz - 30);
      c.stroke();
    }
    c.lineWidth = 1.4;
    for (let k = 0; k < 3; k++) {
      for (let i = 0; i < postes.length - 1; i++) {
        const a = postes[i], b = postes[i + 1];
        const y = hz - 30 + k * 5;
        c.beginPath();
        c.moveTo(a - 18 + k * 18, y);
        c.quadraticCurveTo((a + b) / 2, y + 34 + k * 6, b - 18 + k * 18, y);
        c.stroke();
      }
    }
  },

  /* Silhueta de quem solta pipa: braço erguido segurando a linha. */
  pessoa(c, x, y, alto, lado) {
    c.save();
    c.translate(x, y);
    c.scale(lado, 1);
    c.fillStyle = "#170A1B";
    const s = alto / 40;
    c.beginPath();
    c.arc(0, -36 * s, 5.5 * s, 0, Math.PI * 2);
    c.fill();
    c.lineCap = "round";
    c.strokeStyle = "#170A1B";
    c.lineWidth = 7 * s;
    c.beginPath();
    c.moveTo(0, -29 * s);
    c.lineTo(0, -12 * s);
    c.stroke();
    c.lineWidth = 4.5 * s;
    c.beginPath();
    c.moveTo(0, -13 * s);
    c.lineTo(-5 * s, 0);
    c.moveTo(0, -13 * s);
    c.lineTo(5 * s, 0);
    c.moveTo(0, -26 * s);
    c.lineTo(6 * s, -40 * s);
    c.moveTo(0, -26 * s);
    c.lineTo(-7 * s, -18 * s);
    c.stroke();
    c.restore();
  },
};
