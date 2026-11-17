/* Pixel art do Aquário, toda desenhada aqui por código: cada sprite nasce
   numa grade de pixels (uma cor por pixel, contorno escuro em volta) e vira
   um canvas pequeno, guardado em cache. Os peixes saem de uma fórmula por
   espécie no tamanho exato pedido, então crescer nunca estica pixel.
   Sprites olham pra direita; o desenho espelha. */
"use strict";

const Sprites = {
  cache: new Map(),

  /* ───────── base ───────── */

  tela(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, w);
    c.height = Math.max(1, h);
    return c;
  },

  rgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  },

  misturar(a, b, k) {
    const x = this.rgb(a), y = this.rgb(b);
    const c = x.map((v, i) => Math.round(v + (y[i] - v) * k));
    return "#" + c.map(v => v.toString(16).padStart(2, "0")).join("");
  },

  grade(w, h) {
    return { w, h, px: new Array(w * h).fill(null) };
  },

  pintar(g, x, y, cor) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= g.w || y >= g.h) return;
    g.px[y * g.w + x] = cor;
  },

  ler(g, x, y) {
    if (x < 0 || y < 0 || x >= g.w || y >= g.h) return null;
    return g.px[y * g.w + x];
  },

  /* Grade → canvas. `contorno` pinta de escuro todo pixel vazio encostado
     num cheio (o traço de 1 px que segura a leitura da pixel art). */
  canvas(g, contorno = null, alfa = 1) {
    if (contorno) {
      const borda = [];
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
        if (g.px[y * g.w + x]) continue;
        if (this.ler(g, x - 1, y) || this.ler(g, x + 1, y) || this.ler(g, x, y - 1) || this.ler(g, x, y + 1)) borda.push(y * g.w + x);
      }
      for (const i of borda) g.px[i] = contorno;
    }
    const c = this.tela(g.w, g.h);
    const ctx = c.getContext("2d");
    const img = ctx.createImageData(g.w, g.h);
    const memo = new Map();
    for (let i = 0; i < g.px.length; i++) {
      const cor = g.px[i];
      if (!cor) continue;
      let v = memo.get(cor);
      if (!v) { v = this.rgb(cor); memo.set(cor, v); }
      img.data[i * 4] = v[0]; img.data[i * 4 + 1] = v[1]; img.data[i * 4 + 2] = v[2];
      img.data[i * 4 + 3] = Math.round(255 * alfa);
    }
    ctx.putImageData(img, 0, 0);
    return c;
  },

  /* Desenho em texto: cada letra é uma cor do mapa, "." é vazio. */
  desenho(linhas, mapa, contorno = null) {
    const g = this.grade(linhas[0].length + (contorno ? 2 : 0), linhas.length + (contorno ? 2 : 0));
    const m = contorno ? 1 : 0;
    linhas.forEach((l, y) => [...l].forEach((ch, x) => { if (mapa[ch]) this.pintar(g, x + m, y + m, mapa[ch]); }));
    return this.canvas(g, contorno);
  },

  guardar(chave, fazer) {
    let c = this.cache.get(chave);
    if (!c) { c = fazer(); this.cache.set(chave, c); }
    return c;
  },

  /* ───────── peixes ───────── */

  /* Quanto do comprimento é cauda, por espécie. */
  CAUDA: { palhaco: 0.27, neon: 0.25, anjo: 0.24, baiacu: 0.2, betta: 0.42, cirurgiao: 0.26, dourado: 0.34 },

  peixe(e, pal, L, quadro, fome = false, dorme = false) {
    return this.guardar(`p${e}|${pal}|${L}|${quadro}|${fome ? 1 : 0}|${dorme ? 1 : 0}`, () => this.desenharPeixe(e, pal, L, quadro, fome, dorme));
  },

  desenharPeixe(e, pal, L, quadro, fome, dorme) {
    const esp = ESPECIES[e], c = esp.paletas[pal], id = esp.id;
    const H = Math.max(5, Math.round(L * esp.alto));
    const extra = id === "anjo" ? Math.round(H * 0.5) : id === "betta" ? Math.round(H * 0.55) : Math.max(2, Math.round(H * 0.3));
    const W = L + 2, GH = H + extra * 2 + 2;
    const g = this.grade(W, GH);
    const cy = GH / 2;
    const ini = 1 + Math.round(L * this.CAUDA[id]);
    const fim = L + 1;
    const a = (fim - ini) / 2, cx = ini + a, b = H / 2;
    const balanco = [0, 1, 0, -1][quadro] * Math.max(1, Math.round(H / 7));
    const contorno = this.misturar(c.escuro, "#0b0a1f", 0.55);

    const dentro = (u, v) => {
      if (id === "anjo") return Math.abs(u) ** 1.25 + Math.abs(v) ** 1.25 <= 1;
      if (id === "baiacu") return u * u + v * v <= 1;
      const p = u > 0 ? 2.3 : 1.7;
      return Math.abs(u) ** p + v * v <= 1;
    };

    /* Corpo, com a traseira acompanhando o balanço da cauda. */
    for (let x = ini; x <= fim; x++) {
      const u = (x + 0.5 - cx) / a;
      const dobra = u < 0 ? Math.round(balanco * u * u * 0.6) : 0;
      for (let y = 0; y < GH; y++) {
        let v = (y + 0.5 - cy - dobra) / b;
        if (fome && v > 0 && Math.abs(u) < 0.75) v /= 0.74;
        if (!dentro(u, v)) continue;
        this.pintar(g, x, y, this.corCorpo(id, c, u, v, x, y, a));
      }
    }

    /* Cauda: leque que balança mais na ponta. */
    const nc = ini - 1;
    for (let x = 1; x < ini; x++) {
      const t = (ini - x) / nc;
      const oy = Math.round(balanco * (0.6 + t * 1.4));
      let meia = b * (0.22 + 0.8 * t);
      if (id === "betta") meia = b * (0.45 + 1.2 * t);
      if (id === "dourado") meia = b * (0.3 + 1.05 * t);
      if (id === "anjo") meia = b * (0.18 + 0.55 * t);
      for (let y = 0; y < GH; y++) {
        const dy = y + 0.5 - cy - oy;
        if (Math.abs(dy) > meia) continue;
        const garfo = id === "dourado" ? 0.35 : id === "betta" || id === "baiacu" ? 2 : 0.55;
        if (t > garfo && Math.abs(dy) < (t - garfo) * meia * (id === "dourado" ? 1.6 : 1.3)) continue;
        this.pintar(g, x, y, this.corCauda(id, c, t, dy, meia, x));
      }
    }

    /* Nadadeiras: dorsal (e anal no anjo e no betta), peitoral que pisca. */
    const alturaDorsal = id === "anjo" ? H * 0.5 : id === "betta" ? H * 0.6 : id === "baiacu" ? H * 0.12 : H * 0.3;
    const deU = id === "anjo" ? -0.55 : -0.45, ateU = id === "anjo" ? 0.35 : 0.3;
    for (let x = ini; x <= fim; x++) {
      const u = (x + 0.5 - cx) / a;
      if (u < deU || u > ateU) continue;
      const k = (u - deU) / (ateU - deU);
      const perfil = id === "anjo" || id === "betta" ? Math.min(1, (1 - k) * 1.6) * Math.min(1, k * 3) : Math.sin(k * Math.PI) ** 0.8;
      const alto = Math.round(alturaDorsal * perfil);
      if (alto < 1) continue;
      let topo = 0;
      while (topo < GH && !this.ler(g, x, topo)) topo++;
      for (let i = 1; i <= alto; i++) this.pintar(g, x, topo - i, i === alto ? c.escuro : this.corNadadeira(id, c, i, x));
      if (id === "anjo" || id === "betta") {
        let base = GH - 1;
        while (base > 0 && !this.ler(g, x, base)) base--;
        for (let i = 1; i <= alto; i++) this.pintar(g, x, base + i, i === alto ? c.escuro : this.corNadadeira(id, c, i, x));
      }
    }
    if (L >= 12) {
      const px = Math.round(cx + a * 0.15), py = Math.round(cy + b * 0.35);
      const n = Math.max(2, Math.round(L / 9));
      for (let i = 0; i < n; i++) this.pintar(g, px - i, py + (quadro % 2 ? i >> 1 : 0) + (i === n - 1 ? 1 : 0), c.claro);
    }

    /* Olho e boca. */
    const ox = Math.round(cx + a * (id === "baiacu" ? 0.45 : 0.56)), oy = Math.round(cy - b * 0.22);
    const pupila = "#0d0b1e";
    if (L < 16) this.pintar(g, ox, oy, dorme ? c.escuro : pupila);
    else if (dorme) { this.pintar(g, ox - 1, oy + 1, pupila); this.pintar(g, ox, oy + 1, pupila); }
    else {
      const r = L >= 28 ? 3 : 2;
      for (let i = 0; i < r; i++) for (let j = 0; j < r; j++) this.pintar(g, ox - j, oy + i, "#ffffff");
      this.pintar(g, ox, oy + r - 1, pupila);
      if (r === 3) { this.pintar(g, ox - 1, oy + 2, pupila); this.pintar(g, ox, oy + 1, pupila); }
    }
    const boca = Math.round(cy + b * 0.2);
    if (this.ler(g, fim, boca)) this.pintar(g, fim, boca, c.escuro);
    if (L >= 20) for (let y = Math.round(cy - b * 0.45); y <= Math.round(cy + b * 0.35); y++) {
      const x = Math.round(cx + a * 0.32 - Math.abs(y - cy) * 0.25);
      if (this.ler(g, x, y) && this.ler(g, x, y) !== "#ffffff") this.pintar(g, x, y, this.misturar(this.ler(g, x, y), c.escuro, 0.5));
    }

    const cv = this.canvas(g, contorno);
    cv.cx = W / 2;
    cv.cy = cy;
    return cv;
  },

  corCorpo(id, c, u, v, x, y, a) {
    if (id === "palhaco") {
      for (const centro of [0.42, -0.12, -0.7]) {
        const d = Math.abs(u - centro) * a;
        const meia = Math.max(1, a * 0.13);
        if (d < meia) return c.detalhe;
        if (d < meia + 1) return c.escuro;
      }
    } else if (id === "neon") {
      if (v < -0.4) return c.escuro;
      if (v < 0.08) return v < -0.2 ? c.claro : c.corpo;
      return u < 0.2 ? c.detalhe : "#e8f4ff";
    } else if (id === "anjo") {
      for (const centro of [0.28, -0.22]) if (Math.abs(u - centro) * a < Math.max(0.6, a * 0.07)) return c.detalhe;
    } else if (id === "baiacu") {
      if (v > 0.3) return c.claro;
      if (v < 0.15 && (x * 7 + y * 5) % 11 === 0) return c.detalhe;
    } else if (id === "cirurgiao") {
      const faixa = v < 0.05 && v > -0.8 + 0.55 * Math.abs(u + 0.1) && u > -0.7 && u < 0.4;
      if (faixa && v > -0.55 + 0.35 * Math.abs(u + 0.15)) return c.escuro;
    } else if (id === "dourado") {
      if (v > 0.4) return c.claro;
    } else if (id === "betta") {
      if (v > 0.5) return c.escuro;
    }
    if (v < -0.55) return c.claro;
    if (v > 0.62) return c.escuro;
    return c.corpo;
  },

  corCauda(id, c, t, dy, meia, x) {
    if (id === "cirurgiao") return c.detalhe;
    if (id === "palhaco") return t > 0.8 ? c.escuro : c.corpo;
    if (id === "neon") return t > 0.5 ? c.claro : c.corpo;
    if (id === "betta" || id === "dourado") return (x % 3 === 0) ? c.claro : t > 0.75 ? c.detalhe : c.corpo;
    if (id === "anjo") return c.escuro;
    return c.corpo;
  },

  corNadadeira(id, c, i, x) {
    if (id === "betta") return x % 3 === 0 ? c.claro : c.corpo;
    if (id === "anjo") return i % 3 === 0 ? c.detalhe : c.claro;
    if (id === "palhaco") return c.corpo;
    if (id === "cirurgiao") return c.escuro;
    return c.claro;
  },

  /* Brilho dourado do reforço: anel de 2 px em volta da silhueta. */
  aura(fonte, chave) {
    return this.guardar("aura|" + chave, () => {
      const w = fonte.width + 4, h = fonte.height + 4;
      const cheio = fonte.getContext("2d").getImageData(0, 0, fonte.width, fonte.height).data;
      const solido = (x, y) => x >= 0 && y >= 0 && x < fonte.width && y < fonte.height && cheio[(y * fonte.width + x) * 4 + 3] > 0;
      const g = this.grade(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const sx = x - 2, sy = y - 2;
        if (solido(sx, sy)) continue;
        let perto = 9;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          if (solido(sx + dx, sy + dy)) perto = Math.min(perto, Math.abs(dx) + Math.abs(dy));
        }
        if (perto <= 1) this.pintar(g, x, y, "#ffe14a");
        else if (perto <= 2 && (x + y) % 2 === 0) this.pintar(g, x, y, "#ffb21a");
      }
      return this.canvas(g);
    });
  },

  /* Peixinho do cardume e do placar (sem balanço). */
  miudo(cor) {
    return this.guardar("miudo|" + cor, () => this.desenho([
      "..aa.",
      "aabbbc",
      ".abbb.",
      "..aa..",
    ].map(l => l.padEnd(6, ".")), { a: this.misturar(cor, "#0b0a1f", 0.3), b: cor, c: "#0d0b1e" }));
  },

  /* ───────── bichos dos presentes ───────── */

  tartaruga(quadro) {
    return this.guardar("tartaruga|" + quadro, () => {
      const W = 60, H = 34, g = this.grade(W, H);
      const casco = { base: "#4f8f3a", placa: "#6cb04a", linha: "#2c5a24", borda: "#c9a24a", pele: "#8fc26a", peleEsc: "#5c8c3e" };
      const ang = [0, 1, 0, -1][quadro];
      /* Nadadeira de trás e de frente (a da frente rema). */
      for (let i = 0; i < 9; i++) for (let j = 0; j < 4; j++) this.pintar(g, 9 - i * 0.7, 21 + j + i * 0.35 + ang * 0.4, casco.peleEsc);
      for (let i = 0; i < 14; i++) for (let j = 0; j < 5 - i / 5; j++) this.pintar(g, 38 + i * 0.75, 21 + j + i * (0.25 + ang * 0.22), casco.pele);
      /* Cabeça. */
      for (let x = 44; x < 58; x++) for (let y = 10; y < 22; y++) {
        const u = (x - 51) / 7, v = (y - 15.5) / 5;
        if (u * u + v * v <= 1) this.pintar(g, x, y, v > 0.4 ? casco.peleEsc : casco.pele);
      }
      this.pintar(g, 54, 13, "#ffffff"); this.pintar(g, 55, 13, "#0d0b1e"); this.pintar(g, 55, 14, "#0d0b1e");
      this.pintar(g, 56, 17, casco.peleEsc); this.pintar(g, 55, 17, casco.peleEsc);
      /* Casco em cúpula com placas. */
      for (let x = 6; x < 48; x++) for (let y = 2; y < 24; y++) {
        const u = (x - 27) / 21, v = (y - 23) / 21;
        if (v > 0 || u * u + v * v > 1) continue;
        let cor = casco.base;
        if (u * u + v * v > 0.86 || y >= 22) cor = casco.borda;
        else {
          const cel = (Math.floor((x + (Math.floor(y / 6) % 2) * 5) / 10) + Math.floor(y / 6)) % 2;
          cor = cel ? casco.placa : casco.base;
          if (y % 6 === 0 || (x + (Math.floor(y / 6) % 2) * 5) % 10 === 0) cor = casco.linha;
          if (v < -0.75) cor = this.misturar(cor, "#ffffff", 0.25);
        }
        this.pintar(g, x, y, cor);
      }
      const cv = this.canvas(g, "#163018");
      cv.cx = 27; cv.cy = 17;
      return cv;
    });
  },

  tubarao(quadro) {
    return this.guardar("tubarao|" + quadro, () => {
      const L = 112, H = 30, W = L + 4, GH = 64, g = this.grade(W, GH);
      const cor = { corpo: "#6f8aa6", claro: "#9fb6cc", barriga: "#e6edf3", escuro: "#3d5470" };
      const cy = 36, ini = 22, fim = L, a = (fim - ini) / 2, cx = ini + a, b = H / 2;
      const balanco = [0, 2, 0, -2][quadro];
      for (let x = ini; x <= fim; x++) {
        const u = (x + 0.5 - cx) / a;
        const dobra = u < 0 ? Math.round(balanco * u * u) : 0;
        for (let y = 0; y < GH; y++) {
          const v = (y + 0.5 - cy - dobra) / b;
          const p = u > 0 ? 1.8 : 2.2;
          if (Math.abs(u) ** p + v * v > 1) continue;
          const linha = 0.22 - 0.25 * u;
          this.pintar(g, x, y, v > linha ? cor.barriga : v < -0.6 ? cor.claro : cor.corpo);
        }
      }
      /* Cauda em meia-lua, lobo de cima maior. */
      for (let x = 2; x < ini + 2; x++) {
        const t = (ini + 2 - x) / ini;
        const oy = Math.round(balanco * (1 + t));
        for (let y = 0; y < GH; y++) {
          const dy = y + 0.5 - cy - oy;
          const cima = -dy < t * 26 + 3 && dy < 0, baixo = dy >= 0 && dy < t * 16 + 3;
          if (!(cima || baixo)) continue;
          if (t > 0.35 && Math.abs(dy) < (t - 0.35) * 14) continue;
          this.pintar(g, x, y, cor.corpo);
        }
      }
      /* Dorsal alta e peitoral. */
      for (let i = 0; i < 17; i++) for (let x = 0; x < 17 - i; x++) this.pintar(g, 50 + x + i * 0.6, cy - b - i + 1, i > 13 ? cor.escuro : cor.corpo);
      for (let i = 0; i < 12; i++) for (let x = 0; x < 9 - i * 0.6; x++) this.pintar(g, 74 - i * 0.9 + x, cy + b * 0.5 + i, cor.escuro);
      for (const gx of [86, 89, 92]) for (let y = cy - 4; y < cy + 4; y++) this.pintar(g, gx, y, cor.escuro);
      this.pintar(g, 99, cy - 5, "#0d0b1e"); this.pintar(g, 100, cy - 5, "#0d0b1e"); this.pintar(g, 99, cy - 6, "#ffffff");
      for (let x = 98; x < 110; x++) this.pintar(g, x, cy + 4 - Math.round((x - 98) * 0.15), "#2a3346");
      for (let x = 100; x < 108; x += 2) this.pintar(g, x, cy + 5 - Math.round((x - 98) * 0.15), "#ffffff");
      const cv = this.canvas(g, "#1c2536");
      cv.cx = 60; cv.cy = cy;
      return cv;
    });
  },

  baleia(quadro) {
    return this.guardar("baleia|" + quadro, () => {
      const W = 236, GH = 104, g = this.grade(W, GH);
      const cor = { corpo: "#3b6ea8", claro: "#6f9fd6", escuro: "#24477a", barriga: "#c9d9ea", sulco: "#9fb8d4" };
      const cy = 52, ini = 46, fim = 232, a = (fim - ini) / 2, cx = ini + a, b = 34;
      const balanco = [0, 3, 0, -3][quadro];
      for (let x = ini; x <= fim; x++) {
        const u = (x + 0.5 - cx) / a;
        const dobra = u < 0 ? Math.round(balanco * u * u * 1.4) : 0;
        for (let y = 0; y < GH; y++) {
          const v = (y + 0.5 - cy - dobra) / b;
          const p = u > 0 ? 2.6 : 1.6;
          if (Math.abs(u) ** p + v * v > 1) continue;
          let c = cor.corpo;
          if (v > 0.25 && u > -0.2) c = (y % 3 === 0) ? cor.sulco : cor.barriga;
          else if (v < -0.62) c = cor.claro;
          else if (v > 0.55) c = cor.escuro;
          if (v < 0.1 && ((x * 13 + y * 7) % 37 === 0)) c = cor.claro;
          this.pintar(g, x, y, c);
        }
      }
      /* Cauda (nadadeira caudal) subindo e descendo. */
      for (let x = 2; x < ini + 2; x++) {
        const t = (ini + 2 - x) / ini;
        const oy = Math.round(balanco * (1.5 + t * 2));
        const meia = 6 + t * 30;
        for (let y = 0; y < GH; y++) {
          const dy = y + 0.5 - cy - oy;
          if (Math.abs(dy) > meia || (t < 0.7 && Math.abs(dy) > 6 + t * 4)) continue;
          if (t > 0.85 && Math.abs(dy) < (t - 0.85) * 40) continue;
          this.pintar(g, x, y, Math.abs(dy) > meia - 2 ? cor.escuro : cor.corpo);
        }
      }
      for (let i = 0; i < 22; i++) for (let j = 0; j < 7 - i / 4; j++) this.pintar(g, 150 - i * 0.8 + j, cy + 18 + i * 0.7, cor.escuro);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) this.pintar(g, 196 + j, cy - 2 + i, i === 0 || j === 0 ? "#ffffff" : "#0d0b1e");
      for (let x = 170; x < 230; x++) this.pintar(g, x, cy + 12 - Math.round((x - 170) * 0.08), cor.escuro);
      const cv = this.canvas(g, "#0f2240");
      cv.cx = 118; cv.cy = cy;
      return cv;
    });
  },

  aguaviva(quadro) {
    return this.guardar("aguaviva|" + quadro, () => {
      const g = this.grade(13, 20);
      const sino = "#ff8fd0", claro = "#ffd6f0", esc = "#c45aa0";
      for (let x = 0; x < 13; x++) for (let y = 0; y < 8; y++) {
        const u = (x - 6) / 6, v = (y - 7) / 7;
        if (u * u + v * v > 1) continue;
        this.pintar(g, x, y, v < -0.6 ? claro : y >= 6 ? esc : sino);
      }
      for (const tx of [3, 6, 9]) for (let y = 8; y < 19; y++) {
        const ox = Math.round(Math.sin(y * 0.8 + quadro * 2 + tx) * 0.9);
        this.pintar(g, tx + ox, y, y % 2 ? sino : claro);
      }
      const cv = this.canvas(g, null, 0.85);
      cv.cx = 6; cv.cy = 6;
      return cv;
    });
  },

  /* Luz redonda pontilhada (água-viva, plâncton, festa): sem gradiente, pra
     continuar pixel art. */
  halo(cor, r) {
    return this.guardar(`halo|${cor}|${r}`, () => {
      const d = r * 2 + 1, g = this.grade(d, d);
      for (let y = 0; y < d; y++) for (let x = 0; x < d; x++) {
        const q = Math.hypot(x - r, y - r) / r;
        if (q > 1) continue;
        if (q < 0.45 || (q < 0.75 && (x + y) % 2 === 0) || (x % 2 === 0 && y % 2 === 0)) this.pintar(g, x, y, cor);
      }
      return this.canvas(g, null, 0.32);
    });
  },

  /* ───────── miudezas ───────── */

  ICONES: {
    estrela: ["...y...", "..yyy..", "yyyyyyy", ".yyyyy.", ".yy.yy.", "yy...yy"],
    coracao: [".rr.rr.", "rrrrrrr", "rrrrrrr", ".rrrrr.", "..rrr..", "...r..."],
    raio: ["...yy", "..yy.", ".yyyy", "..yy.", ".yy..", "yy..."],
    coroa: ["y.y.y.y", "yyyyyyy", "yryyyby", "yyyyyyy"],
    nota: ["..ww", "..w.", "..w.", "www.", "ww.."],
    z: ["www", "..w", ".w.", "www"],
  },

  icone(nome) {
    return this.guardar("icone|" + nome, () => this.desenho(this.ICONES[nome],
      { y: "#ffe14a", r: "#ff4f8b", b: "#38d9ff", w: "#ffffff" }, "#1a1033"));
  },

  bolha(r) {
    return this.guardar("bolha|" + r, () => {
      const d = r * 2 + 1, g = this.grade(d, d);
      for (let y = 0; y < d; y++) for (let x = 0; x < d; x++) {
        const q = Math.hypot(x - r, y - r);
        if (q > r + 0.3) continue;
        if (q > r - 0.9) this.pintar(g, x, y, "#bfefff");
        else if (r >= 2 && x === r - 1 && y === r - 1) this.pintar(g, x, y, "#ffffff");
      }
      if (r === 1) this.pintar(g, 1, 1, "#e8fbff");
      return this.canvas(g, null, 0.85);
    });
  },

  comida(tipo) {
    return this.guardar("comida|" + tipo, () => {
      if (tipo === "floco") return this.desenho(["ab"], { a: "#ffd27a", b: "#ff9f5a" });
      if (tipo === "grande") return this.desenho([".ab.", "abbc", "bbcc", ".cc."], { a: "#fff2a8", b: "#ffb84a", c: "#d9722a" }, "#5a2a10");
      return this.desenho(["ab", "bc"], { a: "#ffcf7a", b: "#d98a3a", c: "#9a5520" });
    });
  },

  /* ───────── cenário ───────── */

  /* Alga comprida em quadros de balanço; pixel art mexe em degraus. */
  alga(altura, cor, quadro, fase) {
    return this.guardar(`alga|${altura}|${cor}|${quadro}|${fase}`, () => {
      const W = 22, g = this.grade(W, altura + 2);
      const claro = this.misturar(cor, "#d8ffb0", 0.35), esc = this.misturar(cor, "#06210f", 0.45);
      for (let y = 0; y < altura; y++) {
        const k = y / altura;
        const ox = Math.round(Math.sin(fase + quadro / 8 * Math.PI * 2 + k * 3.2) * (1 - k) * 3.4);
        const x = 11 + ox;
        const larg = y % 7 < 3 ? 2 : 1;
        for (let i = -1; i <= larg; i++) this.pintar(g, x + i, altura - y, i === -1 ? esc : i === larg ? claro : cor);
        if (y % 6 === 3 && y < altura - 4) {
          const lado = y % 12 === 3 ? 1 : -1;
          for (let i = 1; i < 6; i++) {
            const lx = lado > 0 ? x + larg + i : x - 1 - i;
            this.pintar(g, lx, altura - y - Math.round(i * 0.7), i < 3 ? cor : claro);
            if (i < 4) this.pintar(g, lx, altura - y - Math.round(i * 0.7) + 1, esc);
          }
        }
      }
      return this.canvas(g, this.misturar(cor, "#041208", 0.7));
    });
  },

  pedra(w, h, semente, noturno) {
    return this.guardar(`pedra|${w}|${h}|${semente}|${noturno ? 1 : 0}`, () => {
      const g = this.grade(w, h);
      const tons = noturno ? ["#2c3448", "#3c465e", "#1c2234", "#4c5874"] : ["#5a6478", "#7a869c", "#3c4456", "#9aa6ba"];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const u = (x - w / 2 + 0.5) / (w / 2), v = (y - h + 0.5) / h;
        const borda = 1 + 0.12 * Math.sin(x * 1.7 + semente);
        if (u * u + v * v > borda) continue;
        let c = tons[0];
        if (v < -0.65 + u * 0.2) c = tons[1];
        if (u > 0.55 || v > -0.12) c = tons[2];
        if (v < -0.82 && u < 0) c = tons[3];
        if ((x * 5 + y * 3 + semente) % 17 === 0) c = tons[2];
        this.pintar(g, x, y, c);
      }
      return this.canvas(g, noturno ? "#0a0e1a" : "#1d2232");
    });
  },

  coral(tipo) {
    return this.guardar("coral|" + tipo, () => {
      const W = 40, H = 40, g = this.grade(W, H);
      const cores = tipo === 0 ? ["#ff6f91", "#ffb0c4", "#c23a64"] : tipo === 1 ? ["#ff9a4a", "#ffd08a", "#c25a1a"] : ["#a86bff", "#d7b8ff", "#6a34c2"];
      const galho = (x, y, ang, comp, larg) => {
        for (let i = 0; i < comp; i++) {
          const px = x + Math.cos(ang) * i, py = y - Math.sin(ang) * i;
          for (let j = 0; j < larg; j++) this.pintar(g, px + j, py, j === 0 ? cores[2] : j === larg - 1 && larg > 1 ? cores[1] : cores[0]);
          this.pintar(g, px, py, cores[0]);
        }
        const fx = x + Math.cos(ang) * comp, fy = y - Math.sin(ang) * comp;
        if (comp > 6) {
          galho(fx, fy, ang + 0.5, comp * 0.62, Math.max(1, larg - 1));
          galho(fx, fy, ang - 0.45, comp * 0.66, Math.max(1, larg - 1));
        } else {
          this.pintar(g, fx, fy, cores[1]);
          this.pintar(g, fx + 1, fy, cores[1]);
        }
      };
      if (tipo === 2) {
        for (let y = 0; y < 30; y++) for (let x = 0; x < W; x++) {
          const u = (x - 20) / 18, v = (y - 30) / 28;
          if (u * u + v * v > 1 || v > 0) continue;
          const furo = (x + y) % 4 === 0 || (x - y) % 4 === 0;
          if (!furo) this.pintar(g, x, y + 2, u * u + v * v > 0.8 ? cores[2] : cores[0]);
          else if ((x + y) % 8 === 0) this.pintar(g, x, y + 2, cores[1]);
        }
        for (let y = 30; y < 40; y++) { this.pintar(g, 19, y, cores[2]); this.pintar(g, 20, y, cores[0]); }
      } else {
        galho(18, 39, Math.PI / 2, 15, 3);
        galho(14, 39, Math.PI / 2 + 0.6, 9, 2);
        galho(24, 39, Math.PI / 2 - 0.55, 10, 2);
      }
      return this.canvas(g, this.misturar(cores[2], "#12051a", 0.6));
    });
  },

  castelo() {
    return this.guardar("castelo", () => {
      const W = 48, H = 62, g = this.grade(W, H);
      const pedra = ["#8d96a8", "#a9b2c4", "#6a7286", "#c7cede"];
      const bloco = (x0, y0, w, h) => {
        for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
          const linha = (y - y0) % 5 === 4;
          const junta = (x - x0 + (Math.floor((y - y0) / 5) % 2) * 3) % 6 === 5;
          this.pintar(g, x, y, linha || junta ? pedra[2] : x === x0 ? pedra[3] : x === x0 + w - 1 ? pedra[2] : pedra[0]);
        }
        for (let x = x0; x < x0 + w; x += 3) for (let y = y0 - 3; y < y0; y++) if ((x - x0) % 6 < 3) { this.pintar(g, x, y, pedra[1]); this.pintar(g, x + 1, y, pedra[0]); this.pintar(g, x + 2, y, pedra[2]); }
      };
      bloco(10, 26, 28, 36);
      bloco(2, 14, 12, 48);
      bloco(34, 10, 12, 52);
      for (const [x, y] of [[6, 22], [38, 18], [38, 30], [6, 34]]) for (let i = 0; i < 4; i++) { this.pintar(g, x, y + i, "#1a1f2e"); this.pintar(g, x + 1, y + i, "#1a1f2e"); }
      for (let y = 46; y < 62; y++) for (let x = 19; x < 29; x++) {
        const u = (x - 23.5) / 5, v = (y - 50) / 5;
        if (y > 50 || u * u + v * v <= 1) this.pintar(g, x, y, "#141826");
      }
      for (let y = 0; y < 10; y++) this.pintar(g, 40, y, "#5a4632");
      for (let y = 0; y < 4; y++) for (let x = 41; x < 46 - y; x++) this.pintar(g, x, y, y % 2 ? "#ff4f8b" : "#ff7aa8");
      return this.canvas(g, "#262b3a");
    });
  },

  navio() {
    return this.guardar("navio", () => {
      const W = 100, H = 58, g = this.grade(W, H);
      const mad = ["#7a4e2c", "#9a6a3c", "#523018", "#b5824a"];
      for (let x = 4; x < 96; x++) {
        const fundoCasco = 56 - Math.round(Math.max(0, (x - 70) * 0.35));
        const topo = 30 + Math.round(Math.abs(x - 50) * 0.06) - (x > 82 ? (x - 82) : 0);
        for (let y = topo; y < fundoCasco; y++) {
          const tabua = (y - topo) % 4 === 3;
          let c = tabua ? mad[2] : (y - topo) < 2 ? mad[3] : mad[0];
          if ((x * 3 + y * 7) % 23 === 0) c = mad[1];
          this.pintar(g, x, y, c);
        }
      }
      for (const [cx, cy, r] of [[28, 42, 4], [52, 44, 5], [72, 40, 3]]) for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) this.pintar(g, cx + x, cy + y, "#1a0f08");
      for (let y = 0; y < 34; y++) { this.pintar(g, 46 + Math.round(y * 0.35), 30 - y, mad[2]); this.pintar(g, 47 + Math.round(y * 0.35), 30 - y, mad[1]); }
      for (let y = 4; y < 20; y++) for (let x = 0; x < 16 - (y % 5); x++) if ((x + y) % 7 !== 0) this.pintar(g, 50 + Math.round(y * 0.35) + x - 2, y, y % 3 ? "#d9cfae" : "#bfb38c");
      for (let x = 30; x < 60; x++) this.pintar(g, x, 30 - Math.round((x - 30) * 0.1), mad[3]);
      return this.canvas(g, "#2a160a");
    });
  },

  bau(aberto) {
    return this.guardar("bau|" + (aberto ? 1 : 0), () => this.desenho(aberto ? [
      ".wwwwwwwwwwwwwwwwwww.",
      "wdddddddddddddddddddw",
      "wdgggggggggggggggggdw",
      ".wwwwwwwwwwwwwwwwwww.",
      "..y.y.yy.y.yyy.y.y...",
      ".yyyyyyyyyyyyyyyyyyy.",
      "wwwwwwwwwyywwwwwwwwww",
      "wbbbbbbbbykybbbbbbbbw",
      "wbbbbbbbbyyybbbbbbbbw",
      "wddddddddddddddddddw.",
      "wbbbbbbbbbbbbbbbbbbbw",
      "wbbbbbbbbbbbbbbbbbbbw",
      "wwwwwwwwwwwwwwwwwwwww",
    ] : [
      "...wwwwwwwwwwwwwww...",
      "..wbbbbbbbbbbbbbbbw..",
      ".wbbbbbbbbbbbbbbbbbw.",
      "wdddddddddddddddddddw",
      "wbbbbbbbbbbbbbbbbbbbw",
      "wwwwwwwwwyyywwwwwwwww",
      "wbbbbbbbbykybbbbbbbbw",
      "wbbbbbbbbyyybbbbbbbbw",
      "wddddddddddddddddddw.",
      "wbbbbbbbbbbbbbbbbbbbw",
      "wbbbbbbbbbbbbbbbbbbbw",
      "wwwwwwwwwwwwwwwwwwwww",
    ], { w: "#e0a83a", b: "#8a5a2c", d: "#5c3418", y: "#ffe14a", k: "#2a160a", g: "#2a160a" }, "#2a160a"));
  },

  /* Pedra da toca, com a boca escura onde dorme quem saiu. */
  toca(noturno) {
    return this.guardar("toca|" + (noturno ? 1 : 0), () => {
      const W = 46, H = 30, g = this.grade(W, H);
      const tons = noturno ? ["#2c3448", "#3c465e", "#1c2234"] : ["#5a6478", "#7a869c", "#3c4456"];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const u = (x - 23) / 23, v = (y - 30) / 30;
        if (u * u + v * v > 1) continue;
        const boca = ((x - 22) / 9) ** 2 + ((y - 29) / 13) ** 2 <= 1;
        this.pintar(g, x, y, boca ? "#0a0d18" : v < -0.7 ? tons[1] : (x * 3 + y * 5) % 19 === 0 ? tons[2] : tons[0]);
      }
      return this.canvas(g, noturno ? "#0a0e1a" : "#1d2232");
    });
  },

  /* Raio de luz da superfície: faixa inclinada pontilhada (dither), clara
     em cima e sumindo pra baixo. */
  raio(largura, altura, cor) {
    return this.guardar(`raio|${largura}|${altura}|${cor}`, () => {
      const W = largura + Math.round(altura * 0.35), g = this.grade(W, altura);
      for (let y = 0; y < altura; y++) {
        const k = y / altura;
        const x0 = Math.round(y * 0.35);
        for (let x = 0; x < largura; x++) {
          const borda = Math.min(x, largura - 1 - x) / (largura / 2);
          const forca = (1 - k) * Math.min(1, borda * 2.5);
          const limiar = [0.15, 0.55, 0.35, 0.75][(x % 2) + (y % 2) * 2];
          if (forca > limiar) this.pintar(g, x0 + x, y, cor);
        }
      }
      return this.canvas(g, null, 0.22);
    });
  },
};
