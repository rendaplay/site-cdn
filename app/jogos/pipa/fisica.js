/* Física do céu: vento, linha (corda Verlet), rabiola e o corpo da pipa.
   Unidades em px do palco e segundos. Sem DOM: dá pra rodar no node. */
"use strict";

/* Vento = um empurrão base pra direita com rajadas que mudam devagar no
   tempo e com a altura. `forca` sobe na ventania. */
const Vento = {
  base: 70,
  forca: 1,

  em(x, y, t) {
    const rajada = 0.55 * Math.sin(t * 0.37 + y * 0.004) + 0.3 * Math.sin(t * 1.13 + x * 0.006 + 1.7)
      + 0.15 * Math.sin(t * 2.9 + y * 0.011);
    const f = this.base * this.forca;
    return { x: f * (0.8 + rajada), y: f * 0.18 * Math.sin(t * 0.8 + x * 0.003) };
  },
};

class Corda {
  constructor(n, x0, y0, x1, y1) {
    this.n = n;
    this.x = new Float32Array(n);
    this.y = new Float32Array(n);
    this.ax = new Float32Array(n);
    this.ay = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1);
      this.x[i] = this.ax[i] = x0 + (x1 - x0) * f;
      this.y[i] = this.ay[i] = y0 + (y1 - y0) * f;
    }
    this.comprimento = Math.hypot(x1 - x0, y1 - y0);
    this.presoInicio = true;
    this.presoFim = true;
  }

  /* gravidade e quanto o vento pega na linha (arrasto). */
  /* `tremor`: a fita da rabiola batendo no vento (empurrão de lado que
     corre pela corda). */
  passo(dt, t, { gravidade = 260, arrasto = 0.35, amortece = 0.985, iteracoes = 10, tremor = 0 } = {}) {
    const { n, x, y, ax, ay } = this;
    const dt2 = dt * dt;
    for (let i = 0; i < n; i++) {
      if ((i === 0 && this.presoInicio) || (i === n - 1 && this.presoFim)) continue;
      const v = Vento.em(x[i], y[i], t);
      const vx = (x[i] - ax[i]) * amortece;
      const vy = (y[i] - ay[i]) * amortece;
      ax[i] = x[i];
      ay[i] = y[i];
      const bate = tremor ? Math.sin(t * 7 - i * 0.9) * tremor * (i / n) : 0;
      x[i] += vx + (v.x * arrasto * 6 + bate * 0.4) * dt2;
      y[i] += vy + (gravidade + v.y * arrasto + bate) * dt2;
    }
    const seg = this.comprimento / (n - 1);
    for (let k = 0; k < iteracoes; k++) {
      for (let i = 0; i < n - 1; i++) {
        const dx = x[i + 1] - x[i];
        const dy = y[i + 1] - y[i];
        const d = Math.hypot(dx, dy) || 0.0001;
        /* Linha não encolhe: só puxa quando passa do comprimento. */
        if (d <= seg) continue;
        const fixoA = i === 0 && this.presoInicio;
        const fixoB = i + 1 === n - 1 && this.presoFim;
        if (fixoA && fixoB) continue;
        const dif = (d - seg) / d;
        const wa = fixoA ? 0 : fixoB ? 1 : 0.5;
        const wb = 1 - wa;
        x[i] += dx * dif * wa;
        y[i] += dy * dif * wa;
        x[i + 1] -= dx * dif * wb;
        y[i + 1] -= dy * dif * wb;
      }
    }
  }

  prender(i, px, py) {
    this.x[i] = px;
    this.y[i] = py;
    this.ax[i] = px;
    this.ay[i] = py;
  }

  /* Parte a linha no ponto i: devolve [de baixo (presa na laje), de cima
     (presa na pipa)]. Cada pedaço guarda o próprio comprimento. */
  partir(i) {
    i = Math.max(1, Math.min(this.n - 2, i));
    const pedaco = (de, ate) => {
      const c = new Corda(ate - de + 1, 0, 0, 0, 0);
      for (let k = de; k <= ate; k++) {
        c.x[k - de] = this.x[k];
        c.y[k - de] = this.y[k];
        c.ax[k - de] = this.ax[k];
        c.ay[k - de] = this.ay[k];
      }
      c.comprimento = this.comprimento * (ate - de) / (this.n - 1);
      return c;
    };
    const baixo = pedaco(0, i);
    baixo.presoFim = false;
    const cima = pedaco(i, this.n - 1);
    cima.presoInicio = false;
    return [baixo, cima];
  }
}

/* Onde duas linhas se cruzam (ou chegam mais perto): índice do ponto em
   cada uma e o ponto em si. Serve pra faísca do relo e pro corte.
   `desde` (0..1) ignora o começo das linhas: relo é perto das pipas, não
   na mão de quem solta. */
function cruzamento(a, b, desde = 0) {
  let melhor = { d: Infinity, i: 0, j: 0, x: 0, y: 0 };
  const ia = Math.floor((a.n - 1) * desde);
  const ib = Math.floor((b.n - 1) * desde);
  for (let i = ia; i < a.n - 1; i++) {
    for (let j = ib; j < b.n - 1; j++) {
      const p = interseccao(a.x[i], a.y[i], a.x[i + 1], a.y[i + 1], b.x[j], b.y[j], b.x[j + 1], b.y[j + 1]);
      if (p) return { d: 0, i, j, x: p.x, y: p.y };
      const mx = (a.x[i] + a.x[i + 1]) / 2 - (b.x[j] + b.x[j + 1]) / 2;
      const my = (a.y[i] + a.y[i + 1]) / 2 - (b.y[j] + b.y[j + 1]) / 2;
      const d = mx * mx + my * my;
      if (d < melhor.d) {
        melhor = { d, i, j, x: (a.x[i] + b.x[j]) / 2, y: (a.y[i] + b.y[j]) / 2 };
      }
    }
  }
  melhor.d = Math.sqrt(melhor.d);
  return melhor;
}

function interseccao(x1, y1, x2, y2, x3, y3, x4, y4) {
  const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(den) < 1e-6) return null;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
}

/* Corpo da pipa: mola até o alvo, amortecimento e o vento. A linha segura
   a pipa no comprimento dela (não deixa passar), o que dá aquele tranco
   de quando a linha estica. */
class Corpo {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.rot = 0;
    this.giro = 0;
  }

  passo(dt, t, alvoX, alvoY, { mola = 3.2, freio = 2.4, vento = 0.6 } = {}) {
    const v = Vento.em(this.x, this.y, t);
    this.vx += ((alvoX - this.x) * mola - this.vx * freio + (v.x - Vento.base) * vento) * dt;
    this.vy += ((alvoY - this.y) * mola - this.vy * freio + v.y * vento) * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  /* Segura no raio da linha a partir da laje. */
  segurar(ax, ay, raio) {
    const dx = this.x - ax;
    const dy = this.y - ay;
    const d = Math.hypot(dx, dy);
    if (d <= raio) return false;
    const nx = dx / d;
    const ny = dy / d;
    this.x = ax + nx * raio;
    this.y = ay + ny * raio;
    const radial = this.vx * nx + this.vy * ny;
    if (radial > 0) {
      this.vx -= radial * nx;
      this.vy -= radial * ny;
    }
    return true;
  }
}

if (typeof module !== "undefined") module.exports = { Vento, Corda, Corpo, cruzamento, interseccao };
