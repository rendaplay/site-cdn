/* Cenário do Rio no fim de tarde, desenhado por código: céu, sol e lua,
   Pão de Açúcar com o bondinho, mar, morro com casinhas, orla com prédios
   e coqueiros, e o calçadão em ondas. As camadas de fundo são desenhadas
   uma vez por formato em duas versões (tarde e noite) e trocadas por
   transparência; a cada quadro só se cola imagem. */
"use strict";

const PALETAS = [
  { h: 0, topo: "#29306F", meio: "#B4467C", baixo: "#FF9B57", mar: "#7B4678", brilho: "#FFD08A" },
  { h: 0.32, topo: "#121845", meio: "#4A2D70", baixo: "#C2507A", mar: "#3A2A62", brilho: "#F2A0B8" },
  { h: 0.55, topo: "#060A26", meio: "#141B4C", baixo: "#2E2F6E", mar: "#17204A", brilho: "#9FB4FF" },
  { h: 0.82, topo: "#0D1440", meio: "#33397A", baixo: "#7C5C9E", mar: "#2B2E62", brilho: "#C8C0FF" },
  { h: 1, topo: "#3B5DA8", meio: "#E58C9A", baixo: "#FFD08C", mar: "#8A6C9A", brilho: "#FFF0C8" },
];

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}

function misturar(a, b, k) {
  const x = rgb(a);
  const y = rgb(b);
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(",")})`;
}

function paleta(hora) {
  let i = 0;
  while (i < PALETAS.length - 2 && hora > PALETAS[i + 1].h) i++;
  const a = PALETAS[i];
  const b = PALETAS[i + 1];
  const k = Math.max(0, Math.min(1, (hora - a.h) / (b.h - a.h)));
  const saida = {};
  for (const c of ["topo", "meio", "baixo", "mar", "brilho"]) saida[c] = misturar(a[c], b[c], k);
  return saida;
}

/* Quanto é noite (0 a 1) numa hora do ciclo. */
function noiteDe(hora) {
  const sobe = Math.max(0, Math.min(1, (hora - 0.18) / 0.3));
  const desce = Math.max(0, Math.min(1, (hora - 0.78) / 0.2));
  return sobe * (1 - desce);
}

function sorteio(semente) {
  let s = semente;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

function tela(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

const Cenario = {
  montar(dims, H) {
    this.dims = dims;
    this.H = H;
    this.mar = dims.chao - (H > dims.W ? 300 : 250);
    this.camadas = {
      longe: this.camada(2600, 0.05, (c, noite) => this.montanhas(c, noite)),
      morro: this.camada(2300, 0.16, (c, noite) => this.favela(c, noite)),
      orla: this.camada(1900, 0.38, (c, noite) => this.orla(c, noite)),
    };
    this.calcada = this.padraoCalcada();
    const r = sorteio(99);
    this.estrelas = Array.from({ length: 140 }, () => ({ x: r() * dims.W, y: r() * (this.mar - 80), r: 0.6 + r() * 1.8, f: r() * 6 }));
  },

  camada(largura, velocidade, desenhar) {
    const altura = this.dims.chao;
    const tarde = tela(largura, altura);
    const noite = tela(largura, altura);
    desenhar(tarde.getContext("2d"), false);
    desenhar(noite.getContext("2d"), true);
    return { largura, velocidade, tarde, noite };
  },

  /* Desenha uma forma em x e de novo em x ± largura, pra camada emendar. */
  emendar(c, largura, x, w, fn) {
    fn(x);
    if (x + w > largura) fn(x - largura);
    if (x < 0) fn(x + largura);
  },

  /* ───────── camada de longe: Pão de Açúcar, Urca, Dois Irmãos ───────── */

  montanhas(c, noite) {
    const L = c.canvas.width;
    const base = this.mar + 4;
    const g = c.createLinearGradient(0, base - 520, 0, base);
    g.addColorStop(0, noite ? "#1B1940" : "#4A2C63");
    g.addColorStop(1, noite ? "#2A2752" : "#8A4776");
    c.fillStyle = g;

    const serra = (x0, picos) => {
      c.beginPath();
      c.moveTo(x0, base);
      for (const [dx, h] of picos) c.lineTo(x0 + dx, base - h);
      c.lineTo(x0 + picos[picos.length - 1][0] + 60, base);
      c.closePath();
      c.fill();
    };
    serra(-40, [[80, 120], [210, 180], [330, 150], [450, 210], [560, 170], [700, 120]]);
    serra(1380, [[90, 140], [170, 300], [220, 330], [260, 300], [330, 250], [380, 320], [430, 300], [520, 180], [640, 120]]);
    serra(2050, [[120, 110], [260, 210], [300, 220], [420, 214], [520, 150], [620, 90]]);

    const pao = 860;
    const urca = 600;
    /* Pão de Açúcar como se vê da orla: flanco esquerdo subindo em curva,
       topo arredondado e a face direita quase a prumo. Urca na frente,
       um tom mais escura. */
    c.beginPath();
    c.moveTo(pao - 125, base);
    c.bezierCurveTo(pao - 108, base - 150, pao - 78, base - 285, pao - 22, base - 335);
    c.bezierCurveTo(pao + 14, base - 366, pao + 62, base - 348, pao + 76, base - 280);
    c.bezierCurveTo(pao + 90, base - 200, pao + 96, base - 80, pao + 128, base);
    c.closePath();
    c.fill();
    c.fillStyle = noite ? "#171535" : "#3E2456";
    c.beginPath();
    c.moveTo(urca - 150, base);
    c.bezierCurveTo(urca - 110, base - 110, urca + 10, base - 150, urca + 110, base - 112);
    c.bezierCurveTo(urca + 170, base - 88, urca + 200, base - 40, urca + 230, base);
    c.closePath();
    c.fill();

    /* Cabo e bondinho. */
    const a = [urca + 20, base - 146];
    const b = [pao - 28, base - 332];
    c.strokeStyle = noite ? "rgba(200,200,255,.35)" : "rgba(40,20,50,.55)";
    c.lineWidth = 2;
    for (const off of [0, 6]) {
      c.beginPath();
      c.moveTo(a[0], a[1] + off);
      c.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 40 + off, b[0], b[1] + off);
      c.stroke();
    }
    const car = (k, cor) => {
      const x = a[0] + (b[0] - a[0]) * k;
      const y = a[1] + (b[1] - a[1]) * k + 40 * 4 * k * (1 - k);
      c.fillStyle = cor;
      c.fillRect(x - 11, y + 6, 22, 14);
      c.fillRect(x - 1, y, 2, 7);
    };
    car(0.35, noite ? "#FFD27A" : "#2A1830");
    car(0.72, noite ? "#FFD27A" : "#2A1830");
    if (noite) {
      c.fillStyle = "#FFDFA0";
      for (const [x, y] of [[a[0], a[1]], [b[0], b[1]]]) { c.beginPath(); c.arc(x, y + 4, 4, 0, 7); c.fill(); }
    }
  },

  /* ───────── camada do meio: o morro com as casinhas ───────── */

  favela(c, noite) {
    const L = c.canvas.width;
    const chao = this.dims.chao;
    const r = sorteio(7);
    const cores = noite
      ? ["#3A2F55", "#2F3A5C", "#4A3550", "#2E4250", "#463A48", "#38304E"]
      : ["#C46A6A", "#5E8F9A", "#D0A04A", "#7A6AA8", "#C77E4E", "#6E9A6A", "#B85A7A", "#E0B08A"];
    const morros = [{ x: 150, w: 900, h: 400 }, { x: 1350, w: 760, h: 320 }];
    for (const m of morros) {
      const topo = x => chao - 60 - m.h * Math.pow(Math.sin(Math.PI * Math.max(0, Math.min(1, (x - m.x) / m.w))), 1.4);
      c.fillStyle = noite ? "#1B1835" : "#5A3358";
      c.beginPath();
      c.moveTo(m.x - 40, chao);
      for (let x = m.x - 40; x <= m.x + m.w + 40; x += 20) c.lineTo(x, topo(x) + 20);
      c.lineTo(m.x + m.w + 40, chao);
      c.fill();
      /* Casas em fileiras que seguem a encosta, de trás pra frente. */
      for (let fila = 0; fila < 9; fila++) {
        let x = m.x + 10 + r() * 30;
        while (x < m.x + m.w - 20) {
          const w = 34 + r() * 40;
          const h = 30 + r() * 26;
          const solo = topo(x + w / 2) + 26 + fila * 34;
          if (solo < chao - 30) {
            c.fillStyle = cores[Math.floor(r() * cores.length)];
            c.fillRect(x, solo - h, w, h + 6);
            c.fillStyle = noite ? "rgba(0,0,0,.25)" : "rgba(40,10,40,.22)";
            c.fillRect(x + w - 6, solo - h, 6, h + 6);
            c.fillRect(x, solo - h, w, 4);
            for (let jx = x + 6; jx < x + w - 12; jx += 16) {
              const acesa = noite && r() < 0.62;
              c.fillStyle = acesa ? (r() < 0.8 ? "#FFD27A" : "#FFF2C0") : noite ? "#1A1530" : "rgba(30,15,35,.55)";
              c.fillRect(jx, solo - h + 10, 8, 10);
            }
            if (r() < 0.18) {
              c.fillStyle = noite ? "#2A4A7A" : "#2F7FC1";
              c.fillRect(x + 6, solo - h - 14, 18, 14);
              c.fillStyle = noite ? "#36588C" : "#4FA0E0";
              c.fillRect(x + 4, solo - h - 17, 22, 4);
            } else if (r() < 0.15) {
              c.strokeStyle = noite ? "#3A3550" : "#3A2238";
              c.lineWidth = 2;
              c.beginPath();
              c.moveTo(x + w - 10, solo - h);
              c.lineTo(x + w - 10, solo - h - 26);
              c.moveTo(x + w - 18, solo - h - 20);
              c.lineTo(x + w - 2, solo - h - 20);
              c.stroke();
            }
          }
          x += w + 2 + r() * 6;
        }
      }
    }
  },

  /* ───────── camada de perto: prédios da orla e coqueiros ───────── */

  orla(c, noite) {
    const chao = this.dims.chao;
    const r = sorteio(21);
    const L = c.canvas.width;
    let x = 0;
    while (x < L - 60) {
      const w = 110 + r() * 90;
      const h = 150 + r() * 190;
      const y = chao - h;
      c.fillStyle = noite ? "#141230" : "#3C2547";
      c.fillRect(x, y, w, h);
      c.fillStyle = noite ? "#1C1A3E" : "#4A2E55";
      c.fillRect(x, y, w, 6);
      for (let jy = y + 16; jy < chao - 20; jy += 22) {
        for (let jx = x + 10; jx < x + w - 14; jx += 18) {
          const acesa = noite && r() < 0.45;
          c.fillStyle = acesa ? (r() < 0.75 ? "#FFCF70" : "#BFE3FF") : noite ? "#0F0E24" : "rgba(255,190,150,.16)";
          c.fillRect(jx, jy, 9, 12);
        }
      }
      x += w + 40 + r() * 140;
    }
    for (let i = 0; i < 9; i++) this.coqueiro(c, 80 + i * 210 + r() * 80, chao + 4, 180 + r() * 110, r() < 0.5 ? -1 : 1, noite);
  },

  coqueiro(c, x, y, h, lado, noite) {
    const cor = noite ? "#0B0A1E" : "#261434";
    const topoX = x + lado * h * 0.22;
    const topoY = y - h;
    c.strokeStyle = cor;
    c.lineCap = "round";
    c.lineWidth = 11;
    c.beginPath();
    c.moveTo(x, y);
    c.quadraticCurveTo(x + lado * h * 0.02, y - h * 0.55, topoX, topoY);
    c.stroke();
    c.fillStyle = cor;
    for (let i = 0; i < 7; i++) {
      const ang = -Math.PI / 2 + (i - 3) * 0.55 + lado * 0.15;
      const comp = 80 + (i % 2) * 22;
      const fx = topoX + Math.cos(ang) * comp;
      const fy = topoY + Math.sin(ang) * comp * 0.6 + comp * 0.35;
      c.beginPath();
      c.moveTo(topoX, topoY);
      c.quadraticCurveTo((topoX + fx) / 2 + Math.sin(ang) * 14, (topoY + fy) / 2 - 26, fx, fy);
      c.quadraticCurveTo((topoX + fx) / 2, (topoY + fy) / 2 - 8, topoX, topoY + 6);
      c.fill();
    }
    c.beginPath();
    c.arc(topoX, topoY + 6, 8, 0, 7);
    c.fill();
  },

  /* Ondas pretas e brancas do calçadão: faixas senoidais repetidas. */
  padraoCalcada() {
    const L = 180;
    const H = 64;
    const c = tela(L, H).getContext("2d");
    c.fillStyle = "#E4DCCB";
    c.fillRect(0, 0, L, H);
    c.fillStyle = "#2B2427";
    c.beginPath();
    for (let x = 0; x <= L; x += 3) c.lineTo(x, 8 + Math.sin((x / L) * Math.PI * 2) * 9);
    for (let x = L; x >= 0; x -= 3) c.lineTo(x, 30 + Math.sin((x / L) * Math.PI * 2) * 9);
    c.closePath();
    c.fill();
    return c.canvas;
  },

  /* ───────── por quadro ───────── */

  ceu(c, hora, t) {
    const { W } = this.dims;
    const p = paleta(hora);
    const noite = noiteDe(hora);
    const g = c.createLinearGradient(0, 0, 0, this.mar);
    g.addColorStop(0, p.topo);
    g.addColorStop(0.62, p.meio);
    g.addColorStop(1, p.baixo);
    c.fillStyle = g;
    c.fillRect(0, 0, W, this.mar + 2);

    if (noite > 0.02) {
      c.fillStyle = "#FFFFFF";
      for (const e of this.estrelas) {
        c.globalAlpha = noite * (0.45 + 0.4 * Math.sin(t * 1.7 + e.f));
        c.fillRect(e.x, e.y, e.r, e.r);
      }
      c.globalAlpha = 1;
    }

    /* Sol se pondo na tarde, lua alta de noite, sol nascendo no fim. */
    const sol = hora < 0.4 ? 1 - hora / 0.4 : hora > 0.86 ? (hora - 0.86) / 0.14 : 0;
    if (sol > 0) {
      const sx = W * 0.8;
      const sy = this.mar - 150 + (1 - sol) * 220;
      const halo = c.createRadialGradient(sx, sy, 10, sx, sy, 340);
      halo.addColorStop(0, `rgba(255,214,140,${0.55 * sol})`);
      halo.addColorStop(1, "rgba(255,150,100,0)");
      c.fillStyle = halo;
      c.fillRect(sx - 340, sy - 340, 680, 680);
      c.fillStyle = "#FFE3A3";
      c.beginPath();
      c.arc(sx, sy, 92, 0, 7);
      c.fill();
    }
    if (noite > 0.05) {
      const lx = W * 0.22;
      const ly = this.mar * 0.32;
      c.globalAlpha = noite;
      const halo = c.createRadialGradient(lx, ly, 20, lx, ly, 200);
      halo.addColorStop(0, "rgba(220,225,255,.35)");
      halo.addColorStop(1, "rgba(220,225,255,0)");
      c.fillStyle = halo;
      c.fillRect(lx - 200, ly - 200, 400, 400);
      c.fillStyle = "#F4F1E6";
      c.beginPath();
      c.arc(lx, ly, 52, 0, 7);
      c.fill();
      c.fillStyle = "rgba(170,170,190,.35)";
      for (const [dx, dy, rr] of [[-14, -10, 10], [12, 8, 7], [-6, 18, 6], [18, -16, 5]]) { c.beginPath(); c.arc(lx + dx, ly + dy, rr, 0, 7); c.fill(); }
      c.globalAlpha = 1;
    }
    return p;
  },

  fundo(c, hora, distancia, t) {
    const { W, chao } = this.dims;
    const p = this.ceu(c, hora, t);
    const noite = noiteDe(hora);
    this.colar(c, this.camadas.longe, distancia, noite);

    const g = c.createLinearGradient(0, this.mar, 0, chao);
    g.addColorStop(0, p.mar);
    g.addColorStop(1, misturar("#120E28", "#120E28", 0));
    c.fillStyle = g;
    c.fillRect(0, this.mar, W, chao - this.mar);
    c.fillStyle = p.brilho;
    for (let i = 0; i < 26; i++) {
      const y = this.mar + 6 + i * 7;
      const largura = 60 + ((i * 53) % 120) * (1 - i / 30);
      const x = W * 0.8 - largura / 2 + Math.sin(t * 1.3 + i) * 18;
      c.globalAlpha = 0.5 * (1 - i / 26);
      c.fillRect(x, y, largura, 2);
    }
    c.globalAlpha = 1;

    this.colar(c, this.camadas.morro, distancia, noite);
    this.colar(c, this.camadas.orla, distancia, noite);
  },

  colar(c, camada, distancia, noite) {
    const { W } = this.dims;
    const x0 = -((distancia * camada.velocidade) % camada.largura);
    for (let x = x0; x < W; x += camada.largura) {
      if (noite < 0.99) c.drawImage(camada.tarde, x, 0);
      if (noite > 0.01) {
        c.globalAlpha = noite;
        c.drawImage(camada.noite, x, 0);
        c.globalAlpha = 1;
      }
    }
  },

  /* Calçadão (anda junto com os pilares) e o meio-fio. */
  calcadao(c, distancia, noite) {
    const { W, chao } = this.dims;
    const H = this.H;
    const off = -(distancia % this.calcada.width);
    for (let y = chao + 22; y < H; y += this.calcada.height) {
      for (let x = off; x < W; x += this.calcada.width) c.drawImage(this.calcada, x, y);
    }
    c.fillStyle = "#8C8478";
    c.fillRect(0, chao, W, 22);
    c.fillStyle = "#B7AE9F";
    c.fillRect(0, chao, W, 7);
    c.fillStyle = "rgba(0,0,0,.25)";
    c.fillRect(0, chao + 22, W, 6);
    const sombra = c.createLinearGradient(0, chao + 22, 0, H);
    sombra.addColorStop(0, `rgba(14,10,32,${0.3 + noite * 0.3})`);
    sombra.addColorStop(0.35, `rgba(14,10,32,${0.62 + noite * 0.2})`);
    sombra.addColorStop(1, `rgba(14,10,32,${0.82 + noite * 0.1})`);
    c.fillStyle = sombra;
    c.fillRect(0, chao + 22, W, H - chao - 22);
  },

  /* Fiação de poste: o teto do voo, com uma pipa enroscada. */
  fiacao(c, distancia, t, noite) {
    const { W, topo } = this.dims;
    const vao = 640;
    const off = -(distancia % vao);
    c.lineWidth = 3;
    for (let fio = 0; fio < 3; fio++) {
      c.strokeStyle = noite > 0.5 ? "rgba(10,8,25,.9)" : "rgba(25,12,30,.85)";
      c.beginPath();
      for (let x = off - vao; x < W + vao; x += vao) {
        const y = topo - 30 + fio * 11;
        c.moveTo(x, y - 18);
        c.quadraticCurveTo(x + vao / 2, y + 18 + fio * 3, x + vao, y - 18);
      }
      c.stroke();
    }
    for (let x = off - vao; x < W + vao; x += vao) {
      c.fillStyle = "#2A1A2E";
      c.fillRect(x - 4, topo - 64, 8, 34);
      c.fillStyle = "#9BB0B8";
      for (let i = 0; i < 3; i++) c.fillRect(x - 6, topo - 52 + i * 11, 12, 5);
    }
    const px = off + vao * 0.62 + vao;
    const py = topo - 6;
    c.save();
    c.translate(px, py);
    c.rotate(0.5 + Math.sin(t * 2) * 0.06);
    c.fillStyle = "#E63946";
    c.beginPath();
    c.moveTo(0, -26); c.lineTo(20, 0); c.lineTo(0, 30); c.lineTo(-20, 0); c.closePath();
    c.fill();
    c.fillStyle = "#FFD23F";
    c.beginPath();
    c.moveTo(0, -26); c.lineTo(20, 0); c.lineTo(0, 0); c.closePath();
    c.fill();
    c.strokeStyle = "rgba(255,255,255,.7)";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, 30);
    for (let i = 1; i < 7; i++) c.lineTo(Math.sin(t * 3 + i) * 6, 30 + i * 10);
    c.stroke();
    c.restore();
  },
};

if (typeof module !== "undefined" && module.exports) module.exports = { paleta, noiteDe };
