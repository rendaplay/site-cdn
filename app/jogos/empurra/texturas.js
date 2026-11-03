/* Texturas desenhadas em canvas na hora de abrir: o gramado listrado, a
   camisa de cada time (padrão e número nas costas), as listras do tigre,
   a placa de LED e os sprites das partículas. Nada pra baixar. */
"use strict";

const Texturas = (() => {
  const LETRA = '"Lilita One", "Arial Rounded MT Bold", Impact, sans-serif';

  function canvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return [c, c.getContext("2d")];
  }

  function textura(c, { repetir = false, cor = true } = {}) {
    const t = new THREE.CanvasTexture(c);
    if (cor) t.colorSpace = THREE.SRGBColorSpace;
    if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  }

  /* Gerador com semente: o gramado sai igual toda vez. */
  function sorteio(semente) {
    let a = semente >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Duas faixas de corte (clara e escura) com fiapos de grama; repete no
     sentido das faixas. */
  function gramado() {
    const W = 256, H = 512;
    const [c, g] = canvas(W, H);
    const rnd = sorteio(3);
    g.fillStyle = "#2f8a3a";
    g.fillRect(0, 0, W, H / 2);
    g.fillStyle = "#26752f";
    g.fillRect(0, H / 2, W, H / 2);
    for (let i = 0; i < 9000; i++) {
      const x = rnd() * W, y = rnd() * H;
      const claro = y < H / 2;
      g.fillStyle = rnd() < 0.5
        ? (claro ? "rgba(140,210,110,.28)" : "rgba(110,190,95,.22)")
        : (claro ? "rgba(20,70,25,.3)" : "rgba(12,55,18,.32)");
      g.fillRect(x, y, 1 + rnd() * 1.5, 2 + rnd() * 5);
    }
    for (let i = 0; i < 30; i++) {
      const x = rnd() * W, y = rnd() * H, r = 20 + rnd() * 50;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, rnd() < 0.5 ? "rgba(10,40,12,.18)" : "rgba(160,220,120,.1)");
      gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    return textura(c, { repetir: true });
  }

  /* Camisa enrolada no tronco (LatheGeometry): u = 0 é a frente, 0,5 são
     as costas; o alto do canvas é a gola. */
  function camisa(t) {
    const W = 512, H = 256;
    const [c, g] = canvas(W, H);
    const { cor, cor2 } = t;
    g.fillStyle = cor;
    g.fillRect(0, 0, W, H);
    switch (t.padrao) {
      case "horiz":
        for (let y = 0; y < H; y += 64) { g.fillStyle = cor2; g.fillRect(0, y + 32, W, 32); }
        break;
      case "listras":
        for (let x = 0; x < W; x += 64) {
          g.fillStyle = cor2;
          g.fillRect(x + 32, 0, 32, H);
          g.fillStyle = "rgba(255,255,255,.85)";
          if (t.id === "fluminense") { g.fillRect(x + 29, 0, 3, H); g.fillRect(x + 64, 0, 3, H); }
        }
        break;
      case "faixa":
        g.fillStyle = "#d81f2a"; g.fillRect(0, 70, W, 22);
        g.fillStyle = "#f4f4f4"; g.fillRect(0, 92, W, 12);
        g.fillStyle = "#111111"; g.fillRect(0, 104, W, 22);
        break;
      case "diagonal":
        g.strokeStyle = cor2;
        g.lineWidth = 34;
        for (const base of [0, W]) {
          g.beginPath();
          g.moveTo(base - 70, 10);
          g.lineTo(base + 70, H - 10);
          g.stroke();
        }
        break;
    }
    /* Gola e barra. */
    g.fillStyle = t.padrao === "mangas" || t.padrao === "liso" ? cor2 : t.calcao;
    g.fillRect(0, 0, W, 10);
    g.fillRect(0, H - 8, W, 8);
    if (t.padrao === "liso" || t.padrao === "mangas") {
      g.fillStyle = cor2;
      g.globalAlpha = 0.9;
      g.fillRect(0, 10, W, 4);
      g.globalAlpha = 1;
    }
    /* Número nas costas, com contorno que lê em cima de qualquer listra. */
    const claro = clareza(cor) > 0.6;
    const corNum = t.padrao === "horiz" || t.padrao === "listras" ? "#ffffff" : claro ? cor2 : "#ffffff";
    const contorno = corNum === "#ffffff" ? "#141414" : "#ffffff";
    g.font = `120px ${LETRA}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineJoin = "round";
    g.lineWidth = 14;
    g.strokeStyle = contorno;
    g.strokeText(String(t.numero), W / 2, H * 0.5);
    g.fillStyle = corNum;
    g.fillText(String(t.numero), W / 2, H * 0.5);
    g.font = `46px ${LETRA}`;
    g.lineWidth = 9;
    for (const x of [W * 0.13, W * 0.87]) {
      g.strokeText(String(t.numero), x, H * 0.4);
      g.fillText(String(t.numero), x, H * 0.4);
    }
    return textura(c);
  }

  function clareza(hex) {
    const n = parseInt(hex.slice(1), 16);
    return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  }

  /* Pelo do tigre: laranja com listras pretas em pincelada. */
  function tigre() {
    const W = 256, H = 128;
    const [c, g] = canvas(W, H);
    const rnd = sorteio(9);
    g.fillStyle = "#f08a24";
    g.fillRect(0, 0, W, H);
    g.fillStyle = "#1a120c";
    for (let i = 0; i < 14; i++) {
      const x = (i / 14) * W + rnd() * 6;
      g.beginPath();
      g.moveTo(x, 18 + rnd() * 10);
      g.quadraticCurveTo(x + 10, H * 0.45, x - 2, H - 30 - rnd() * 16);
      g.quadraticCurveTo(x + 4, H * 0.45, x + 3, 18);
      g.fill();
    }
    return textura(c);
  }

  function brilho() {
    const [c, g] = canvas(64, 64);
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(0.25, "rgba(255,255,255,.7)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    return textura(c, { cor: false });
  }

  function poeira() {
    const [c, g] = canvas(64, 64);
    const rnd = sorteio(5);
    for (let i = 0; i < 14; i++) {
      const x = 20 + rnd() * 24, y = 20 + rnd() * 24, r = 8 + rnd() * 12;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, "rgba(255,255,255,.55)");
      gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
    }
    return textura(c, { cor: false });
  }

  /* Facho do refletor: cone que some do topo pra baixo. */
  function facho() {
    const [c, g] = canvas(4, 128);
    const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, "rgba(255,255,255,.55)");
    gr.addColorStop(0.5, "rgba(255,255,255,.14)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 4, 128);
    return textura(c, { cor: false });
  }

  /* Sombra de contato redonda pros pés. */
  function sombra() {
    const [c, g] = canvas(64, 64);
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(0,0,0,.6)");
    gr.addColorStop(0.6, "rgba(0,0,0,.3)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    return textura(c, { cor: false });
  }

  /* Placa de LED da beira do campo: blocos coloridos com a trama de
     pontos do painel; a cena rola a textura. */
  function led() {
    const W = 512, H = 32;
    const [c, g] = canvas(W, H);
    const cores = ["#ffcc22", "#ff3b6b", "#2fd0ff", "#7cff5a"];
    for (let i = 0; i < 8; i++) {
      g.fillStyle = cores[i % cores.length];
      g.fillRect(i * 64, 0, 64, H);
      g.fillStyle = "rgba(255,255,255,.5)";
      g.fillRect(i * 64 + 10, 10, 44, 12);
    }
    g.fillStyle = "rgba(0,0,0,.35)";
    for (let x = 0; x < W; x += 4) g.fillRect(x, 0, 1, H);
    for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);
    return textura(c, { repetir: true });
  }

  return { gramado, camisa, tigre, brilho, poeira, facho, sombra, led, sorteio, clareza };
})();
