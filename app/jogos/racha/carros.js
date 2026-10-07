/* Os sete carros do Racha, montados por código: perfil lateral extrudado
   (com o teto afinando, como carro de verdade), janelas e frisos colados
   por fora, sem textura. Nada de marca, logo ou grade de montadora.

   Cada modelo sai em duas malhas: `pintura` (branca, pega a cor do carro
   por instância) e `detalhe` (vidro, borracha, cromo, faróis, com cor por
   vértice). Sistema do carro: X pra frente, Y pra cima, Z pro lado
   esquerdo (o lado que a câmera vê), origem no chão no meio do carro. */
"use strict";

const Carros = (() => {
  const COR = {
    pintura: 0xffffff,
    vidro: 0x1b2633,
    preto: 0x18181b,
    borracha: 0x101012,
    cromo: 0xcfd4da,
    farol: 0xfff4d2,
    lanterna: 0xc8161d,
    pisca: 0xff9b26,
    branco: 0xf1ede2,
    cacamba: 0x26262a,
    jaqueta: 0x2a3446,
    calca: 0x23262e,
    motor: 0x4a4d55,
  };

  /* Cores de carro de época, sem nada de neon. */
  const PALETA = ["#1f6b3a", "#c62a26", "#86b8dc", "#d9c59a", "#f2c230", "#b6bcc3",
    "#7a1f33", "#e8742a", "#ecebe4", "#2a2a2e", "#1f3a70", "#9ccf3a"];
  const OURO = "#ffcf3a";

  const area = pts => pts.reduce((s, p, i) => {
    const q = pts[(i + 1) % pts.length];
    return s + p[0] * q[1] - q[0] * p[1];
  }, 0) / 2;
  const antiHorario = pts => (area(pts) < 0 ? [...pts].reverse() : pts);
  const meiaDe = m => (typeof m === "function" ? m : () => m);

  /* Meia largura que afina acima da cintura (teto mais estreito que a
     saia). A tampa de um prisma só é plana se a largura variar de forma
     linear dentro dela, então o perfil é cortado na cintura. */
  function afina(base, cintura, taxa) {
    const f = y => (y < cintura ? base : base - (y - cintura) * taxa);
    f.cortes = [cintura];
    return f;
  }

  /* Recorta o polígono no semiplano y >= c (acima) ou y <= c (abaixo). */
  function recortar(pts, c, acima) {
    const dentro = p => (acima ? p[1] >= c : p[1] <= c);
    const saida = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if (dentro(a)) saida.push(a);
      if (dentro(a) !== dentro(b)) {
        const t = (c - a[1]) / (b[1] - a[1]);
        saida.push([a[0] + (b[0] - a[0]) * t, c]);
      }
    }
    return saida;
  }

  function faixas(perfil, meia) {
    const cortes = (typeof meia === "function" && meia.cortes) || [];
    let resto = perfil;
    const saida = [];
    for (const c of cortes) {
      const baixo = recortar(resto, c, false);
      if (baixo.length >= 3 && Math.abs(area(baixo)) > 1e-6) saida.push(baixo);
      resto = recortar(resto, c, true);
    }
    if (resto.length >= 3 && Math.abs(area(resto)) > 1e-6) saida.push(resto);
    return saida;
  }

  function arco(cx, r, y0, lados = 6) {
    const pts = [];
    for (let i = 0; i <= lados; i++) {
      const a = Math.PI - (i / lados) * Math.PI;
      pts.push([cx + Math.cos(a) * r, y0 + Math.sin(a) * r]);
    }
    return pts;
  }

  class Malha {
    constructor() { this.pos = []; this.cor = []; }

    tri(a, b, c, cor) {
      const k = new THREE.Color(cor);
      for (const v of [a, b, c]) { this.pos.push(v[0], v[1], v[2]); this.cor.push(k.r, k.g, k.b); }
    }

    quad(a, b, c, d, cor) { this.tri(a, b, c, cor); this.tri(a, c, d, cor); }

    caixa(x0, x1, y0, y1, z0, z1, cor) {
      const v = (x, y, z) => [x, y, z];
      this.quad(v(x0, y0, z1), v(x1, y0, z1), v(x1, y1, z1), v(x0, y1, z1), cor);
      this.quad(v(x1, y0, z0), v(x0, y0, z0), v(x0, y1, z0), v(x1, y1, z0), cor);
      this.quad(v(x1, y0, z1), v(x1, y0, z0), v(x1, y1, z0), v(x1, y1, z1), cor);
      this.quad(v(x0, y0, z0), v(x0, y0, z1), v(x0, y1, z1), v(x0, y1, z0), cor);
      this.quad(v(x0, y1, z1), v(x1, y1, z1), v(x1, y1, z0), v(x0, y1, z0), cor);
      this.quad(v(x0, y0, z0), v(x1, y0, z0), v(x1, y0, z1), v(x0, y0, z1), cor);
    }

    /* Perfil (x, y) extrudado em Z; `meia` é a meia largura, número ou
       função da altura (teto afinando). */
    prisma(perfil, meia, cor, zc = 0) {
      for (const parte of faixas(perfil, meia)) this.prismaPlano(parte, meia, cor, zc);
    }

    prismaPlano(perfil, meia, cor, zc) {
      const pts = antiHorario(perfil);
      const m = meiaDe(meia);
      const n = pts.length;
      const tris = THREE.ShapeUtils.triangulateShape(pts.map(p => new THREE.Vector2(p[0], p[1])), []);
      for (const t of tris) {
        let [a, b, c] = t.map(i => pts[i]);
        if (area([a, b, c]) < 0) [b, c] = [c, b];
        this.tri([a[0], a[1], zc + m(a[1], a[0])], [b[0], b[1], zc + m(b[1], b[0])], [c[0], c[1], zc + m(c[1], c[0])], cor);
        this.tri([a[0], a[1], zc - m(a[1], a[0])], [c[0], c[1], zc - m(c[1], c[0])], [b[0], b[1], zc - m(b[1], b[0])], cor);
      }
      for (let i = 0; i < n; i++) {
        const p = pts[i];
        const q = pts[(i + 1) % n];
        const mp = m(p[1], p[0]);
        const mq = m(q[1], q[0]);
        this.quad([p[0], p[1], zc + mp], [p[0], p[1], zc - mp], [q[0], q[1], zc - mq], [q[0], q[1], zc + mq], cor);
      }
    }

    /* Peça chapada nos dois lados (janela, friso, faixa). */
    lamina(perfil, meia, cor, folga = 0.008) {
      for (const parte of faixas(perfil, meia)) this.laminaPlana(parte, meia, cor, folga);
    }

    laminaPlana(perfil, meia, cor, folga) {
      const pts = antiHorario(perfil);
      const m = meiaDe(meia);
      const tris = THREE.ShapeUtils.triangulateShape(pts.map(p => new THREE.Vector2(p[0], p[1])), []);
      for (const t of tris) {
        let [a, b, c] = t.map(i => pts[i]);
        if (area([a, b, c]) < 0) [b, c] = [c, b];
        const z = p => m(p[1], p[0]) + folga;
        this.tri([a[0], a[1], z(a)], [b[0], b[1], z(b)], [c[0], c[1], z(c)], cor);
        this.tri([a[0], a[1], -z(a)], [c[0], c[1], -z(c)], [b[0], b[1], -z(b)], cor);
      }
    }

    /* Para-brisa e vidro traseiro: um quadrilátero sobre a aresta p0→p1 do
       perfil (na ordem anti-horária), afastado um pouco pra fora. */
    vidro(p0, p1, meia, cor, margem = 0.07, folga = 0.012) {
      const m = meiaDe(meia);
      const dx = p1[0] - p0[0];
      const dy = p1[1] - p0[1];
      const len = Math.hypot(dx, dy);
      const nx = dy / len * folga;
      const ny = -dx / len * folga;
      const a = [p0[0] + nx, p0[1] + ny];
      const b = [p1[0] + nx, p1[1] + ny];
      const za = m(p0[1], p0[0]) - margem;
      const zb = m(p1[1], p1[0]) - margem;
      this.quad([a[0], a[1], za], [a[0], a[1], -za], [b[0], b[1], -zb], [b[0], b[1], zb], cor);
    }

    esfera(cx, cy, cz, r, cor, detalhe = 0) {
      const g = new THREE.IcosahedronGeometry(r, detalhe).toNonIndexed();
      const p = g.attributes.position.array;
      for (let i = 0; i < p.length; i += 9) {
        this.tri([p[i] + cx, p[i + 1] + cy, p[i + 2] + cz], [p[i + 3] + cx, p[i + 4] + cy, p[i + 5] + cz], [p[i + 6] + cx, p[i + 7] + cy, p[i + 8] + cz], cor);
      }
      g.dispose();
    }

    espelhar(fn) { fn(1); fn(-1); }

    geometria() {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(this.cor, 3));
      g.computeVertexNormals();
      return g;
    }
  }

  /* Faróis, lanterna, para-choque e friso de carro "três volumes". */
  function frenteETraseira(d, { xf, xr, meia, farolY, farol = "retangular", cromado = false, lanternaLarga = false }) {
    const pc = cromado ? COR.cromo : COR.preto;
    d.caixa(xf - 0.08, xf + 0.06, 0.3, 0.46, -meia - 0.02, meia + 0.02, pc);
    d.caixa(xr - 0.06, xr + 0.08, 0.3, 0.46, -meia - 0.02, meia + 0.02, pc);
    d.caixa(xf, xf + 0.035, farolY - 0.07, farolY + 0.07, -meia * 0.42, meia * 0.42, COR.preto);
    d.espelhar(s => {
      if (farol === "duplo") {
        d.caixa(xf, xf + 0.04, farolY - 0.075, farolY + 0.075, s * meia * 0.5, s * meia * 0.66, COR.farol);
        d.caixa(xf, xf + 0.04, farolY - 0.075, farolY + 0.075, s * meia * 0.7, s * meia * 0.86, COR.farol);
      } else if (farol === "redondo") {
        d.caixa(xf, xf + 0.04, farolY - 0.08, farolY + 0.08, s * meia * 0.58, s * meia * 0.8, COR.farol);
      } else {
        d.caixa(xf, xf + 0.04, farolY - 0.065, farolY + 0.065, s * meia * 0.48, s * meia * 0.86, COR.farol);
      }
      d.caixa(xf, xf + 0.035, farolY - 0.16, farolY - 0.09, s * meia * 0.66, s * meia * 0.86, COR.pisca);
      const lz0 = lanternaLarga ? 0.3 : 0.5;
      d.caixa(xr - 0.035, xr, farolY - 0.06, farolY + 0.08, s * meia * lz0, s * meia * 0.9, COR.lanterna);
    });
  }

  function retrovisor(d, x, y, meia) {
    d.espelhar(s => d.caixa(x - 0.1, x + 0.04, y, y + 0.09, s * meia, s * (meia + 0.11), COR.preto));
  }

  const MODELOS = [];

  /* Sedã quadrado anos 80. */
  MODELOS.push((() => {
    const p = new Malha();
    const d = new Malha();
    const meia = afina(0.81, 0.88, 0.3);
    const roda = 0.3;
    const perfil = [
      [-2.0, 0.32], ...arco(-1.25, 0.37, 0.32), ...arco(1.25, 0.37, 0.32), [2.0, 0.32],
      [2.04, 0.45], [2.03, 0.72], [1.9, 0.79], [0.72, 0.87], [0.12, 1.33], [-0.95, 1.34],
      [-1.42, 0.93], [-1.98, 0.89], [-2.04, 0.72], [-2.03, 0.42],
    ];
    p.prisma(perfil, meia, COR.pintura);
    d.lamina([[-0.33, 0.93], [0.6, 0.93], [0.13, 1.27], [-0.33, 1.27]], meia, COR.vidro);
    d.lamina([[-1.3, 0.94], [-0.44, 0.94], [-0.44, 1.27], [-0.9, 1.28]], meia, COR.vidro);
    p.vidro([0.72, 0.87], [0.12, 1.33], meia, COR.pintura, 0, 0.002);
    d.vidro([0.72, 0.87], [0.12, 1.33], meia, COR.vidro);
    d.vidro([-0.95, 1.34], [-1.42, 0.93], meia, COR.vidro);
    d.lamina([[-1.96, 0.47], [1.98, 0.47], [1.98, 0.52], [-1.96, 0.52]], 0.81, COR.preto, 0.012);
    d.lamina([[0.0, 0.76], [0.14, 0.76], [0.14, 0.79], [0.0, 0.79]], 0.81, COR.cromo, 0.015);
    frenteETraseira(d, { xf: 2.03, xr: -2.03, meia: 0.81, farolY: 0.62 });
    retrovisor(d, 0.66, 0.9, 0.79);
    return {
      nome: "quadradinho", p, d, comprimento: 4.1, largura: 1.7, topo: 1.34,
      rodas: [[-1.25, roda, 0.74], [1.25, roda, 0.74]], raio: roda, larguraRoda: 0.2,
      placa: [-0.12, 0.66, 0.42], meiaPlaca: 0.81,
      farois: [[2.07, 0.62, 0.55], [2.07, 0.62, -0.55]], lanternas: [[-2.07, 0.63, 0.6], [-2.07, 0.63, -0.6]],
      escape: [-2.1, 0.32, -0.5],
    };
  })());

  /* Besouro (fusca-like): corpo redondo e para-lama separado. */
  MODELOS.push((() => {
    const p = new Malha();
    const d = new Malha();
    const meia = afina(0.7, 0.9, 0.36);
    const roda = 0.31;
    const perfil = [
      [-1.95, 0.38], [1.9, 0.38], [2.02, 0.5], [1.98, 0.66], [1.75, 0.78], [1.2, 0.86], [0.75, 0.92],
      [0.45, 1.25], [0.2, 1.42], [-0.2, 1.5], [-0.65, 1.48], [-1.05, 1.37], [-1.45, 1.13], [-1.8, 0.88], [-1.98, 0.64],
    ];
    p.prisma(perfil, meia, COR.pintura);
    for (const cx of [-1.2, 1.2]) {
      const fora = arco(cx, 0.52, 0.3, 8);
      const dentro = arco(cx, 0.37, 0.3, 8).reverse();
      const frente = cx > 0 ? [[cx + 0.62, 0.3]] : [];
      const tras = cx < 0 ? [[cx - 0.62, 0.3]] : [];
      p.prisma([...tras, ...fora, ...frente, ...dentro].reverse(), 0.8, COR.pintura);
    }
    d.caixa(-0.65, 0.65, 0.3, 0.38, -0.79, 0.79, COR.preto);
    d.lamina([[-0.42, 0.98], [0.56, 0.98], [0.22, 1.36], [-0.2, 1.43], [-0.42, 1.42]], meia, COR.vidro);
    d.lamina([[-1.3, 0.98], [-0.52, 0.98], [-0.52, 1.41], [-0.66, 1.41], [-1.0, 1.3], [-1.26, 1.07]], meia, COR.vidro);
    d.vidro([0.75, 0.92], [0.45, 1.25], meia, COR.vidro, 0.1);
    d.vidro([-1.05, 1.37], [-1.45, 1.13], meia, COR.vidro, 0.2);
    d.caixa(1.92, 2.08, 0.34, 0.42, -0.86, 0.86, COR.cromo);
    d.caixa(-2.06, -1.9, 0.34, 0.42, -0.86, 0.86, COR.cromo);
    d.espelhar(s => {
      d.caixa(1.5, 1.66, 0.66, 0.8, s * 0.56, s * 0.74, COR.farol);
      d.caixa(-1.72, -1.6, 0.66, 0.78, s * 0.62, s * 0.78, COR.lanterna);
    });
    d.lamina([[-1.4, 0.55], [1.4, 0.55], [1.4, 0.58], [-1.4, 0.58]], 0.7, COR.cromo, 0.012);
    retrovisor(d, 0.7, 0.95, 0.66);
    return {
      nome: "besouro", p, d, comprimento: 4.1, largura: 1.65, topo: 1.5,
      rodas: [[-1.2, roda, 0.7], [1.2, roda, 0.7]], raio: roda, larguraRoda: 0.2,
      placa: [-0.05, 0.68, 0.4], meiaPlaca: 0.7,
      farois: [[1.7, 0.73, 0.65], [1.7, 0.73, -0.65]], lanternas: [[-1.75, 0.72, 0.7], [-1.75, 0.72, -0.7]],
      escape: [-2.02, 0.36, -0.4],
    };
  })());

  /* Perua: teto até a traseira, três janelas. */
  MODELOS.push((() => {
    const p = new Malha();
    const d = new Malha();
    const meia = afina(0.82, 0.88, 0.26);
    const roda = 0.3;
    const perfil = [
      [-2.12, 0.32], ...arco(-1.3, 0.37, 0.32), ...arco(1.28, 0.37, 0.32), [2.02, 0.32],
      [2.06, 0.45], [2.05, 0.72], [1.92, 0.79], [0.76, 0.87], [0.16, 1.34], [-1.98, 1.36],
      [-2.12, 1.2], [-2.15, 0.72], [-2.14, 0.42],
    ];
    p.prisma(perfil, meia, COR.pintura);
    d.lamina([[-0.32, 0.93], [0.64, 0.93], [0.17, 1.28], [-0.32, 1.28]], meia, COR.vidro);
    d.lamina([[-1.18, 0.93], [-0.42, 0.93], [-0.42, 1.28], [-1.18, 1.29]], meia, COR.vidro);
    d.lamina([[-2.0, 0.93], [-1.28, 0.93], [-1.28, 1.29], [-1.92, 1.3], [-2.04, 1.18]], meia, COR.vidro);
    d.vidro([0.76, 0.87], [0.16, 1.34], meia, COR.vidro);
    d.vidro([-2.12, 1.2], [-2.15, 0.9], meia, COR.vidro, 0.12);
    p.caixa(-1.85, 0.0, 1.36, 1.4, 0.55, 0.62, COR.pintura);
    p.caixa(-1.85, 0.0, 1.36, 1.4, -0.62, -0.55, COR.pintura);
    d.caixa(-1.85, 0.0, 1.4, 1.43, 0.52, 0.65, COR.cromo);
    d.caixa(-1.85, 0.0, 1.4, 1.43, -0.65, -0.52, COR.cromo);
    d.lamina([[-2.08, 0.5], [2.0, 0.5], [2.0, 0.55], [-2.08, 0.55]], 0.82, COR.cromo, 0.012);
    frenteETraseira(d, { xf: 2.05, xr: -2.15, meia: 0.82, farolY: 0.62, cromado: true });
    retrovisor(d, 0.7, 0.9, 0.8);
    return {
      nome: "perua", p, d, comprimento: 4.3, largura: 1.72, topo: 1.43,
      rodas: [[-1.3, roda, 0.75], [1.28, roda, 0.75]], raio: roda, larguraRoda: 0.2,
      placa: [-0.12, 0.68, 0.42], meiaPlaca: 0.82,
      farois: [[2.09, 0.62, 0.55], [2.09, 0.62, -0.55]], lanternas: [[-2.19, 0.63, 0.6], [-2.19, 0.63, -0.6]],
      escape: [-2.2, 0.32, -0.5],
    };
  })());

  /* Picape: cabine curta e caçamba aberta. */
  MODELOS.push((() => {
    const p = new Malha();
    const d = new Malha();
    const meia = afina(0.82, 0.92, 0.3);
    const roda = 0.31;
    const perfil = [
      [-2.1, 0.32], ...arco(-1.38, 0.38, 0.32), ...arco(1.3, 0.38, 0.32), [2.04, 0.32],
      [2.08, 0.46], [2.07, 0.74], [1.92, 0.81], [0.72, 0.9], [0.16, 1.37], [-0.4, 1.38],
      [-0.52, 0.92], [-2.08, 0.92], [-2.13, 0.72], [-2.12, 0.44],
    ];
    p.prisma(perfil, meia, COR.pintura);
    d.caixa(-2.02, -0.6, 0.92, 0.926, -0.73, 0.73, COR.cacamba);
    d.caixa(-0.6, -0.56, 0.92, 1.02, -0.74, 0.74, COR.preto);
    d.lamina([[-0.38, 0.97], [0.62, 0.97], [0.16, 1.31], [-0.33, 1.31]], meia, COR.vidro);
    d.vidro([0.72, 0.9], [0.16, 1.37], meia, COR.vidro);
    d.vidro([-0.4, 1.38], [-0.52, 0.92], meia, COR.vidro, 0.12);
    d.lamina([[-2.06, 0.5], [2.0, 0.5], [2.0, 0.56], [-2.06, 0.56]], 0.82, COR.preto, 0.012);
    frenteETraseira(d, { xf: 2.07, xr: -2.13, meia: 0.82, farolY: 0.64, lanternaLarga: true });
    retrovisor(d, 0.68, 0.93, 0.8);
    return {
      nome: "picape", p, d, comprimento: 4.25, largura: 1.72, topo: 1.38,
      rodas: [[-1.38, roda, 0.75], [1.3, roda, 0.75]], raio: roda, larguraRoda: 0.22,
      placa: [0.12, 0.68, 0.4], meiaPlaca: 0.82,
      farois: [[2.11, 0.64, 0.55], [2.11, 0.64, -0.55]], lanternas: [[-2.17, 0.65, 0.6], [-2.17, 0.65, -0.6]],
      escape: [-2.18, 0.32, -0.5],
    };
  })());

  /* Kombi-like: caixote saia e blusa, teto branco. */
  MODELOS.push((() => {
    const p = new Malha();
    const d = new Malha();
    const meia = afina(0.86, 1.55, 0.22);
    const roda = 0.3;
    const perfil = [
      [-2.1, 0.32], ...arco(-1.25, 0.37, 0.32), ...arco(1.2, 0.37, 0.32), [2.12, 0.32],
      [2.16, 0.5], [2.16, 1.02], [2.09, 1.45], [1.97, 1.84], [1.72, 1.95], [-1.8, 1.95],
      [-2.05, 1.85], [-2.13, 1.5], [-2.13, 0.5],
    ];
    p.prisma(perfil, meia, COR.pintura);
    d.lamina([[-2.12, 1.06], [2.16, 1.06], [2.09, 1.45], [1.97, 1.84], [1.72, 1.94], [-1.8, 1.94], [-2.05, 1.84], [-2.12, 1.5]], meia, COR.branco, 0.005);
    d.caixa(-1.8, 1.72, 1.95, 1.965, -0.78, 0.78, COR.branco);
    d.caixa(2.16, 2.175, 1.0, 1.45, -0.86, 0.86, COR.branco);
    d.lamina([[1.0, 1.2], [1.95, 1.2], [1.9, 1.72], [1.0, 1.72]], meia, COR.vidro, 0.011);
    for (const [a, b] of [[-0.05, 0.9], [-1.0, -0.15], [-1.95, -1.1]]) {
      d.lamina([[a, 1.22], [b, 1.22], [b, 1.72], [a, 1.72]], meia, COR.vidro, 0.011);
    }
    d.vidro([2.09, 1.45], [1.97, 1.84], meia, COR.vidro, 0.1);
    d.caixa(2.09, 2.13, 1.44, 1.84, -0.03, 0.03, COR.branco);
    d.vidro([-2.05, 1.85], [-2.13, 1.5], meia, COR.vidro, 0.25);
    d.caixa(2.1, 2.24, 0.32, 0.46, -0.9, 0.9, COR.cromo);
    d.caixa(-2.2, -2.08, 0.32, 0.46, -0.9, 0.9, COR.cromo);
    d.espelhar(s => {
      d.caixa(2.16, 2.2, 0.8, 0.96, s * 0.48, s * 0.66, COR.farol);
      d.caixa(2.16, 2.19, 0.66, 0.74, s * 0.52, s * 0.66, COR.pisca);
      d.caixa(-2.16, -2.13, 0.72, 0.92, s * 0.62, s * 0.8, COR.lanterna);
    });
    d.caixa(2.16, 2.2, 0.62, 0.68, -0.36, 0.36, COR.preto);
    retrovisor(d, 1.95, 1.35, 0.86);
    return {
      nome: "kombi", p, d, comprimento: 4.35, largura: 1.78, topo: 1.97,
      rodas: [[-1.25, roda, 0.78], [1.2, roda, 0.78]], raio: roda, larguraRoda: 0.2,
      placa: [0.15, 0.7, 0.44], meiaPlaca: 0.86,
      farois: [[2.22, 0.88, 0.57], [2.22, 0.88, -0.57]], lanternas: [[-2.17, 0.82, 0.7], [-2.17, 0.82, -0.7]],
      escape: [-2.15, 0.32, -0.55],
    };
  })());

  /* Moto com piloto: capacete e tanque na cor. */
  MODELOS.push((() => {
    const p = new Malha();
    const d = new Malha();
    const roda = 0.33;
    p.prisma([[-0.15, 0.82], [0.35, 0.84], [0.47, 0.98], [0.2, 1.08], [-0.15, 1.02]], 0.17, COR.pintura);
    p.prisma([[-0.62, 0.76], [-0.15, 0.78], [-0.15, 0.94], [-0.78, 0.98], [-0.98, 0.93]], 0.13, COR.pintura);
    p.prisma([[0.56, 0.92], [0.76, 0.92], [0.84, 1.14], [0.62, 1.2]], 0.15, COR.pintura);
    p.prisma([[0.5, 0.62], [0.98, 0.62], [1.02, 0.68], [0.56, 0.7]], 0.08, COR.pintura);
    p.esfera(0.06, 1.7, 0, 0.17, COR.pintura, 1);
    d.caixa(0.16, 0.24, 1.62, 1.74, -0.12, 0.12, COR.vidro);
    d.caixa(-0.32, 0.3, 0.38, 0.78, -0.15, 0.15, COR.motor);
    d.caixa(-0.95, -0.15, 0.4, 0.48, 0.15, 0.24, COR.cromo);
    d.caixa(-0.78, -0.08, 0.98, 1.07, -0.14, 0.14, COR.preto);
    d.caixa(0.46, 0.52, 1.17, 1.22, -0.34, 0.34, COR.preto);
    d.espelhar(s => {
      d.prisma([[0.68, 0.33], [0.76, 0.33], [0.62, 1.0], [0.54, 1.0]], 0.025, COR.cromo, s * 0.1);
      d.prisma([[0.08, 1.43], [0.16, 1.48], [0.53, 1.23], [0.47, 1.17]], 0.055, COR.jaqueta, s * 0.22);
      d.prisma([[-0.33, 1.0], [0.16, 1.0], [0.22, 0.9], [-0.28, 0.9]], 0.075, COR.calca, s * 0.17);
      d.prisma([[0.1, 0.99], [0.23, 0.95], [0.1, 0.56], [-0.01, 0.59]], 0.06, COR.calca, s * 0.2);
    });
    d.prisma([[-0.36, 1.0], [0.06, 1.0], [0.2, 1.5], [-0.12, 1.57]], 0.21, COR.jaqueta);
    d.caixa(0.82, 0.86, 1.02, 1.12, -0.07, 0.07, COR.farol);
    d.caixa(-1.0, -0.96, 0.9, 0.97, -0.07, 0.07, COR.lanterna);
    return {
      nome: "moto", p, d, comprimento: 2.2, largura: 0.8, topo: 1.88,
      rodas: [[-0.72, roda, 0], [0.72, roda, 0]], raio: roda, larguraRoda: 0.13,
      placa: [-0.55, 0.86, 0.26], meiaPlaca: 0.14,
      farois: [[0.88, 1.07, 0]], lanternas: [[-1.02, 0.94, 0]],
      escape: [-1.0, 0.44, 0.2],
    };
  })());

  /* Sedã longo (opala-like): capô comprido, cromado, quatro faróis. */
  MODELOS.push((() => {
    const p = new Malha();
    const d = new Malha();
    const meia = afina(0.85, 0.84, 0.36);
    const roda = 0.31;
    const perfil = [
      [-2.35, 0.32], ...arco(-1.45, 0.38, 0.32), ...arco(1.45, 0.38, 0.32), [2.35, 0.32],
      [2.4, 0.46], [2.38, 0.7], [2.25, 0.75], [0.72, 0.83], [0.0, 1.27], [-0.85, 1.28],
      [-1.62, 0.86], [-2.3, 0.84], [-2.39, 0.7], [-2.38, 0.45],
    ];
    p.prisma(perfil, meia, COR.pintura);
    d.lamina([[-0.38, 0.89], [0.6, 0.89], [0.02, 1.22], [-0.38, 1.22]], meia, COR.vidro);
    d.lamina([[-1.45, 0.89], [-0.48, 0.89], [-0.48, 1.22], [-0.83, 1.23]], meia, COR.vidro);
    d.vidro([0.72, 0.83], [0.0, 1.27], meia, COR.vidro);
    d.vidro([-0.85, 1.28], [-1.62, 0.86], meia, COR.vidro);
    d.lamina([[-2.3, 0.6], [2.32, 0.6], [2.32, 0.63], [-2.3, 0.63]], 0.85, COR.cromo, 0.012);
    d.lamina([[-1.6, 0.85], [0.7, 0.85], [0.7, 0.87], [-1.6, 0.87]], meia, COR.cromo, 0.012);
    frenteETraseira(d, { xf: 2.38, xr: -2.38, meia: 0.85, farolY: 0.6, farol: "duplo", cromado: true, lanternaLarga: true });
    retrovisor(d, 0.66, 0.86, 0.83);
    return {
      nome: "sedan", p, d, comprimento: 4.8, largura: 1.78, topo: 1.28,
      rodas: [[-1.45, roda, 0.78], [1.45, roda, 0.78]], raio: roda, larguraRoda: 0.22,
      placa: [-0.1, 0.62, 0.4], meiaPlaca: 0.85,
      farois: [[2.42, 0.6, 0.62], [2.42, 0.6, -0.62]], lanternas: [[-2.42, 0.6, 0.55], [-2.42, 0.6, -0.55]],
      escape: [-2.45, 0.3, -0.5],
    };
  })());

  /* Roda: pneu, aro claro com cubo e quatro parafusos (pra ver girar).
     Raio 1 e largura 1: a instância escala. Eixo em Z. */
  function roda() {
    const m = new Malha();
    const lados = 12;
    const anel = (r, z, cor, fora) => {
      for (let i = 0; i < lados; i++) {
        const a0 = (i / lados) * Math.PI * 2;
        const a1 = ((i + 1) / lados) * Math.PI * 2;
        const p0 = [Math.cos(a0) * r, Math.sin(a0) * r, z];
        const p1 = [Math.cos(a1) * r, Math.sin(a1) * r, z];
        if (fora) m.tri([0, 0, z], p0, p1, cor); else m.tri([0, 0, z], p1, p0, cor);
      }
    };
    for (let i = 0; i < lados; i++) {
      const a0 = (i / lados) * Math.PI * 2;
      const a1 = ((i + 1) / lados) * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      m.quad([c0, s0, 0.5], [c0, s0, -0.5], [c1, s1, -0.5], [c1, s1, 0.5], COR.borracha);
    }
    anel(1, 0.5, COR.borracha, true);
    anel(1, -0.5, COR.borracha, false);
    anel(0.64, 0.51, 0x9aa0a8, true);
    anel(0.64, -0.51, 0x9aa0a8, false);
    anel(0.24, 0.52, 0x5d626a, true);
    anel(0.24, -0.52, 0x5d626a, false);
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2;
      const x = Math.cos(a) * 0.42, y = Math.sin(a) * 0.42;
      m.caixa(x - 0.07, x + 0.07, y - 0.07, y + 0.07, 0.505, 0.53, 0x2e3136);
      m.caixa(x - 0.07, x + 0.07, y - 0.07, y + 0.07, -0.53, -0.505, 0x2e3136);
    }
    return m.geometria();
  }

  return {
    MODELOS: MODELOS.map(m => ({ ...m, pintura: m.p.geometria(), detalhe: m.d.geometria(), p: undefined, d: undefined })),
    roda,
    PALETA,
    OURO,
  };
})();
