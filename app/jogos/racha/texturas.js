/* Texturas desenhadas em canvas na hora de abrir: asfalto, grama,
   guard-rail, céu, placas de beira de estrada, números das portas,
   quadriculado da chegada e os sprites das partículas. Nada pra baixar. */
"use strict";

const Texturas = (() => {
  const NUMEROS_LADO = 20;

  function canvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return [c, c.getContext("2d")];
  }

  function textura(c, { repetir = false, cor = true, aniso = 4 } = {}) {
    const t = new THREE.CanvasTexture(c);
    if (cor) t.colorSpace = THREE.SRGBColorSpace;
    if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso;
    return t;
  }

  /* Gerador com semente: a pista sai igual toda vez. */
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

  function granulado(g, w, h, rnd, quantos, cores, tam = [1, 2]) {
    for (let i = 0; i < quantos; i++) {
      g.fillStyle = cores[Math.floor(rnd() * cores.length)];
      const s = tam[0] + rnd() * (tam[1] - tam[0]);
      g.fillRect(rnd() * w, rnd() * h, s, s);
    }
  }

  /* Asfalto: 16 m de pista por ladrilho (u) e a largura inteira (v).
     Topo do canvas = lado do guard-rail. */
  function asfalto({ faixas, largura }) {
    const W = 1024;
    const H = 1024;
    const [c, g] = canvas(W, H);
    const rnd = sorteio(7);
    g.fillStyle = "#2a2b30";
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 60; i++) {
      g.fillStyle = `rgba(${rnd() < 0.5 ? "20,20,24" : "52,52,58"},${0.12 + rnd() * 0.18})`;
      g.beginPath();
      g.ellipse(rnd() * W, rnd() * H, 30 + rnd() * 120, 10 + rnd() * 40, 0, 0, Math.PI * 2);
      g.fill();
    }
    granulado(g, W, H, rnd, 26000, ["#1d1e22", "#3a3b41", "#45464c", "#26272b"]);
    const pxm = H / largura;
    const faixa = largura / faixas;
    /* Marca de pneu escurecida no meio de cada faixa. */
    for (let f = 0; f < faixas; f++) {
      for (const lado of [-0.6, 0.6]) {
        const y = (f + 0.5) * faixa * pxm + lado * pxm;
        const grad = g.createLinearGradient(0, y - 14, 0, y + 14);
        grad.addColorStop(0, "rgba(0,0,0,0)");
        grad.addColorStop(0.5, "rgba(10,10,12,0.32)");
        grad.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = grad;
        g.fillRect(0, y - 14, W, 28);
      }
    }
    /* Tracejado entre as faixas: 3 m pintados, 5 m de vão, ponta borrada
       (a câmera passa rápido, dá a sensação de velocidade). */
    const pxU = W / 16;
    for (let f = 1; f < faixas; f++) {
      const y = f * faixa * pxm;
      for (const x0 of [0, 8]) {
        const grad = g.createLinearGradient(x0 * pxU, 0, (x0 + 3) * pxU, 0);
        grad.addColorStop(0, "rgba(240,240,232,0)");
        grad.addColorStop(0.12, "rgba(240,240,232,0.9)");
        grad.addColorStop(0.88, "rgba(240,240,232,0.9)");
        grad.addColorStop(1, "rgba(240,240,232,0)");
        g.fillStyle = grad;
        g.fillRect(x0 * pxU, y - 5, 3 * pxU, 10);
      }
    }
    g.fillStyle = "#f2c230";
    g.fillRect(0, 0.35 * pxm, W, 12);
    g.fillRect(0, 0.35 * pxm + 20, W, 12);
    g.fillStyle = "rgba(240,240,232,0.92)";
    g.fillRect(0, H - 0.35 * pxm - 12, W, 12);
    granulado(g, W, H, rnd, 5000, ["rgba(20,20,22,0.5)", "rgba(60,60,64,0.4)"]);
    return textura(c, { repetir: true, aniso: 8 });
  }

  function grama(tons = ["#3d5a2a", "#4a6a30", "#35502a", "#56743a", "#2d4422"]) {
    const [c, g] = canvas(512, 512);
    const rnd = sorteio(3);
    g.fillStyle = tons[0];
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 90; i++) {
      g.fillStyle = tons[Math.floor(rnd() * tons.length)];
      g.globalAlpha = 0.35;
      g.beginPath();
      g.ellipse(rnd() * 512, rnd() * 512, 20 + rnd() * 70, 10 + rnd() * 40, rnd() * 3, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    granulado(g, 512, 512, rnd, 12000, tons.concat(["#6d8a44"]), [1, 3]);
    return textura(c, { repetir: true });
  }

  function cascalho() {
    const [c, g] = canvas(256, 256);
    const rnd = sorteio(11);
    g.fillStyle = "#6b6258";
    g.fillRect(0, 0, 256, 256);
    granulado(g, 256, 256, rnd, 9000, ["#857a6c", "#4f4840", "#9a8f80", "#5e564c"], [1, 3]);
    return textura(c, { repetir: true });
  }

  /* Lâmina do guard-rail: blocos vermelhos e brancos. */
  function guardRail() {
    const [c, g] = canvas(512, 64);
    for (let i = 0; i < 4; i++) {
      g.fillStyle = i % 2 ? "#f0ede6" : "#c8202a";
      g.fillRect(i * 128, 0, 128, 64);
    }
    const grad = g.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0, "rgba(255,255,255,0.25)");
    grad.addColorStop(0.45, "rgba(0,0,0,0)");
    grad.addColorStop(0.55, "rgba(0,0,0,0.25)");
    grad.addColorStop(1, "rgba(0,0,0,0.05)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 64);
    granulado(g, 512, 64, sorteio(5), 900, ["rgba(60,40,30,0.25)", "rgba(255,255,255,0.15)"]);
    return textura(c, { repetir: true });
  }

  function ceu() {
    const [c, g] = canvas(4, 512);
    const grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, "#2a1f4e");
    grad.addColorStop(0.35, "#6b3f6e");
    grad.addColorStop(0.62, "#d8705a");
    grad.addColorStop(0.82, "#ffb36b");
    grad.addColorStop(1, "#ffe0a3");
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 512);
    return textura(c);
  }

  /* Placas de beira de estrada, quatro num atlas 2×2. */
  function placas() {
    const [c, g] = canvas(1024, 512);
    const placa = (col, lin, fundo, desenhar) => {
      g.save();
      g.translate(col * 512, lin * 256);
      g.fillStyle = fundo;
      g.fillRect(0, 0, 512, 256);
      desenhar();
      g.strokeStyle = "rgba(0,0,0,0.35)";
      g.lineWidth = 10;
      g.strokeRect(5, 5, 502, 246);
      g.restore();
    };
    const texto = (t, x, y, tam, cor, peso = 900, fonte = "Big Shoulders Display") => {
      g.font = `${peso} ${tam}px "${fonte}", "Arial Narrow", sans-serif`;
      g.fillStyle = cor;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(t, x, y);
    };
    placa(0, 0, "#f2c230", () => {
      texto("BORRACHARIA", 256, 92, 92, "#1b1b1b");
      g.fillStyle = "#1b1b1b";
      g.fillRect(40, 150, 432, 70);
      texto("24 HORAS", 256, 186, 64, "#f2c230");
    });
    placa(1, 0, "#f4efe2", () => {
      texto("PASTEL", 256, 96, 120, "#c62a26");
      texto("& CALDO DE CANA", 256, 196, 52, "#1f6b3a", 800);
    });
    placa(0, 1, "#1f3a70", () => {
      texto("AUTO ELÉTRICA", 256, 100, 76, "#ffffff");
      texto("BATERIA · FAROL · SOM", 256, 184, 40, "#f2c230", 700);
    });
    placa(1, 1, "#0e2e25", () => {
      texto("RENDA PLAY", 256, 104, 96, "#ffc81e");
      texto("rendaplay.com.br", 256, 190, 44, "#e9ece4", 500, "Lexend");
    });
    return textura(c);
  }

  /* Números das portas: círculo branco com número preto, grade 20×20. */
  function numeros() {
    const lado = 2048;
    const cel = lado / NUMEROS_LADO;
    const [c, g] = canvas(lado, lado);
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (let n = 0; n < NUMEROS_LADO * NUMEROS_LADO; n++) {
      const x = (n % NUMEROS_LADO) * cel + cel / 2;
      const y = Math.floor(n / NUMEROS_LADO) * cel + cel / 2;
      g.fillStyle = "#f6f3ea";
      g.beginPath();
      g.arc(x, y, cel * 0.47, 0, Math.PI * 2);
      g.fill();
      g.lineWidth = cel * 0.05;
      g.strokeStyle = "#141414";
      g.stroke();
      const txt = String(n);
      g.fillStyle = "#141414";
      g.font = `900 ${txt.length > 2 ? cel * 0.48 : cel * 0.62}px "Big Shoulders Display", "Arial Narrow", sans-serif`;
      g.fillText(txt, x, y + cel * 0.03);
    }
    const t = textura(c, { aniso: 8 });
    t.flipY = false;
    return t;
  }

  /* Faixa da chegada/largada: quadriculado com o nome no meio. */
  function faixaPortico(nome) {
    const [c, g] = canvas(1024, 128);
    for (let x = 0; x < 32; x++) {
      for (let y = 0; y < 4; y++) {
        g.fillStyle = (x + y) % 2 ? "#111" : "#f4f4f4";
        g.fillRect(x * 32, y * 32, 32, 32);
      }
    }
    g.fillStyle = "#c8202a";
    g.fillRect(300, 10, 424, 108);
    g.font = `900 92px "Big Shoulders Display", "Arial Narrow", sans-serif`;
    g.fillStyle = "#fff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(nome, 512, 68);
    return textura(c);
  }

  function quadriculado() {
    const [c, g] = canvas(64, 256);
    for (let x = 0; x < 2; x++) {
      for (let y = 0; y < 8; y++) {
        g.fillStyle = (x + y) % 2 ? "#111" : "#f2f2f2";
        g.fillRect(x * 32, y * 32, 32, 32);
      }
    }
    const t = textura(c, { repetir: true });
    t.magFilter = THREE.NearestFilter;
    return t;
  }

  function redondo(paradas, tam = 128) {
    const [c, g] = canvas(tam, tam);
    const grad = g.createRadialGradient(tam / 2, tam / 2, 0, tam / 2, tam / 2, tam / 2);
    for (const [p, cor] of paradas) grad.addColorStop(p, cor);
    g.fillStyle = grad;
    g.fillRect(0, 0, tam, tam);
    return textura(c, { cor: false });
  }

  const brilho = () => redondo([[0, "rgba(255,255,255,1)"], [0.18, "rgba(255,255,255,0.75)"], [0.45, "rgba(255,255,255,0.18)"], [1, "rgba(255,255,255,0)"]]);
  const fumaca = () => {
    const [c, g] = canvas(128, 128);
    const rnd = sorteio(9);
    for (let i = 0; i < 9; i++) {
      const x = 40 + rnd() * 48, y = 40 + rnd() * 48, r = 22 + rnd() * 22;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, "rgba(255,255,255,0.55)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
    }
    return textura(c, { cor: false });
  };
  const sombra = () => redondo([[0, "rgba(0,0,0,0.75)"], [0.55, "rgba(0,0,0,0.45)"], [1, "rgba(0,0,0,0)"]]);
  const facho = () => redondo([[0, "rgba(255,236,190,0.9)"], [0.5, "rgba(255,220,160,0.3)"], [1, "rgba(255,210,150,0)"]]);

  function oleo() {
    const [c, g] = canvas(256, 256);
    const rnd = sorteio(21);
    for (let i = 0; i < 14; i++) {
      const x = 70 + rnd() * 116, y = 70 + rnd() * 116, r = 30 + rnd() * 50;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, "rgba(8,8,12,0.95)");
      grad.addColorStop(0.8, "rgba(8,8,12,0.9)");
      grad.addColorStop(1, "rgba(8,8,12,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 256, 256);
    }
    g.globalCompositeOperation = "source-atop";
    const iris = g.createLinearGradient(40, 40, 220, 220);
    iris.addColorStop(0, "rgba(90,40,140,0.35)");
    iris.addColorStop(0.5, "rgba(30,110,120,0.3)");
    iris.addColorStop(1, "rgba(140,110,30,0.3)");
    g.fillStyle = iris;
    g.fillRect(0, 0, 256, 256);
    return textura(c);
  }

  return {
    NUMEROS_LADO,
    asfalto, grama, cascalho, guardRail, ceu, placas, numeros, faixaPortico, quadriculado,
    brilho, fumaca, sombra, facho, oleo, sorteio,
  };
})();
