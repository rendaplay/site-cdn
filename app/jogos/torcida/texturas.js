/* Texturas desenhadas em canvas na hora de abrir: o gramado, as faixas de
   cada setor, o bandeirão, o mosaico, o telão, as placas de LED, o ônibus da
   caravana e os sprites das partículas. Nada pra baixar. Nada de escudo:
   o time aparece pelo nome e pelas cores. */
"use strict";

const Texturas = (() => {
  const LETRA = '"Lilita One", "Arial Rounded MT Bold", Impact, sans-serif';
  const TINTA = "#140d24";

  function canvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return [c, c.getContext("2d")];
  }

  function textura(c, { repetir = false, cor = true, pixel = false } = {}) {
    const t = new THREE.CanvasTexture(c);
    if (cor) t.colorSpace = THREE.SRGBColorSpace;
    if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (pixel) {
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
    } else t.anisotropy = 4;
    return t;
  }

  /* Gerador com semente: o estádio sai igual toda vez. */
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

  /* Escreve centrado, com contorno, diminuindo a letra até caber. */
  function letreiro(g, texto, x, y, largura, tam, { cor = "#fff", contorno = TINTA, borda = 0.16, sombra = 0 } = {}) {
    g.textAlign = "center";
    g.textBaseline = "middle";
    let t = tam;
    g.font = `${t}px ${LETRA}`;
    while (g.measureText(texto).width > largura && t > 8) {
      t -= 2;
      g.font = `${t}px ${LETRA}`;
    }
    g.lineJoin = "round";
    if (sombra) {
      g.fillStyle = "rgba(0,0,0,.45)";
      g.fillText(texto, x, y + t * sombra);
    }
    if (borda) {
      g.lineWidth = t * borda;
      g.strokeStyle = contorno;
      g.strokeText(texto, x, y);
    }
    g.fillStyle = cor;
    g.fillText(texto, x, y);
    return t;
  }

  /* Cor de texto que aparece em cima da cor do time. */
  function claro(hex) {
    const c = new THREE.Color(hex);
    return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b > 0.6;
  }

  /* Faixas do padrão da camisa por cima de um retângulo. */
  function padrao(g, time, x, y, w, h, escala = 1) {
    g.fillStyle = time.cor;
    g.fillRect(x, y, w, h);
    g.fillStyle = time.cor2;
    const passo = 90 * escala;
    switch (time.padrao) {
      case "horiz":
        for (let k = 0; k * passo < h; k++) if (k % 2) g.fillRect(x, y + k * passo / 2, w, passo / 2);
        break;
      case "listras":
        for (let k = 0; k * passo / 2 < w; k++) if (k % 2) g.fillRect(x + k * passo / 2, y, passo / 2, h);
        break;
      case "faixa":
        g.fillRect(x, y + h * 0.42, w, h * 0.16);
        g.fillStyle = "#111";
        g.fillRect(x, y + h * 0.38, w, h * 0.04);
        g.fillRect(x, y + h * 0.58, w, h * 0.04);
        break;
      case "diagonal":
        g.save();
        g.beginPath();
        g.rect(x, y, w, h);
        g.clip();
        g.translate(x + w / 2, y + h / 2);
        g.rotate(-0.55);
        g.fillRect(-w, -h * 0.09, w * 2, h * 0.18);
        g.restore();
        break;
      case "mangas":
        g.fillRect(x, y, w, h * 0.08);
        g.fillRect(x, y + h * 0.92, w, h * 0.08);
        break;
      default:
        g.fillRect(x, y + h * 0.88, w, h * 0.12);
    }
  }

  /* Gramado com as faixas de corte e as linhas do campo. Mapeia o plano
     de `largura` × `comprimento` metros, com o campo de `campo` × `campo`·1,55
     no meio (a área e o círculo encolhem junto). */
  function gramado(largura, comprimento, campo) {
    const px = 20;
    const k = campo / 34;
    const W = largura * px, H = comprimento * px;
    const [c, g] = canvas(W, H);
    const rnd = sorteio(7);
    const faixas = 14;
    for (let i = 0; i < faixas; i++) {
      g.fillStyle = i % 2 ? "#2f8f3a" : "#38a043";
      g.fillRect(0, (i * H) / faixas, W, H / faixas + 1);
    }
    for (let i = 0; i < 26000; i++) {
      g.fillStyle = rnd() < 0.5 ? "rgba(20,70,20,.22)" : "rgba(140,220,110,.16)";
      g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 2 + rnd() * 3);
    }
    const cx = W / 2, cy = H / 2, cl = 17 * k * px, cc = 26 * k * px;
    g.strokeStyle = "rgba(255,255,255,.92)";
    g.lineWidth = 0.22 * px;
    g.strokeRect(cx - cl, cy - cc, cl * 2, cc * 2);
    g.beginPath();
    g.moveTo(cx - cl, cy);
    g.lineTo(cx + cl, cy);
    g.stroke();
    g.beginPath();
    g.arc(cx, cy, 4.6 * k * px, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = "#fff";
    const m = k * px;
    for (const s of [-1, 1]) {
      const fundo = cy + s * cc;
      g.strokeRect(cx - 10 * m, fundo - (s > 0 ? 8.5 * m : 0), 20 * m, 8.5 * m);
      g.strokeRect(cx - 4.4 * m, fundo - (s > 0 ? 3 * m : 0), 8.8 * m, 3 * m);
      g.beginPath();
      g.arc(cx, fundo - s * 6 * m, 0.25 * px, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(cx, fundo - s * 6 * m, 4.6 * m, s > 0 ? Math.PI * 1.2 : Math.PI * 0.2, s > 0 ? Math.PI * 1.8 : Math.PI * 0.8);
      g.stroke();
    }
    g.beginPath();
    g.arc(cx, cy, 0.3 * px, 0, Math.PI * 2);
    g.fill();
    return textura(c);
  }

  /* Faixa do alambrado na frente do setor: o nome do time repetido. */
  function faixaFrente(time) {
    const [c, g] = canvas(1024, 96);
    padrao(g, time, 0, 0, 1024, 96, 0.6);
    g.fillStyle = "rgba(0,0,0,.18)";
    g.fillRect(0, 0, 1024, 10);
    g.fillRect(0, 86, 1024, 10);
    const nome = time.nome.toUpperCase();
    const letra = claro(time.cor) ? TINTA : "#fff";
    for (let i = 0; i < 2; i++) letreiro(g, nome, 256 + i * 512, 50, 460, 66, { cor: letra, contorno: claro(time.cor) ? "#fff" : TINTA, borda: 0.18 });
    return textura(c);
  }

  /* Faixa alta no fundo do setor: o nome grande, que aparece no plano geral. */
  function faixaTopo(time) {
    const [c, g] = canvas(1024, 160);
    padrao(g, time, 0, 0, 1024, 160, 0.8);
    g.fillStyle = "rgba(0,0,0,.25)";
    g.fillRect(0, 0, 1024, 12);
    g.fillRect(0, 148, 1024, 12);
    letreiro(g, (time.curto || time.nome).toUpperCase(), 512, 84, 900, 124, {
      cor: claro(time.cor) ? TINTA : "#fff", contorno: claro(time.cor) ? "#fff" : TINTA, borda: 0.14,
    });
    return textura(c);
  }

  /* Bandeirão: o padrão da camisa inteiro, estrelas e o nome no meio. */
  function bandeira(time) {
    const [c, g] = canvas(1024, 768);
    padrao(g, time, 0, 0, 1024, 768, 2.2);
    const grad = g.createRadialGradient(512, 384, 100, 512, 384, 620);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(1, "rgba(0,0,0,.28)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 1024, 768);
    const letra = claro(time.cor) ? time.cor2 : "#fff";
    const contorno = claro(letra) ? TINTA : "#fff";
    g.fillStyle = letra;
    for (const [x, y, r] of [[180, 150, 46], [844, 150, 46], [512, 120, 60], [180, 620, 38], [844, 620, 38]]) estrela(g, x, y, r, letra, contorno);
    letreiro(g, (time.curto || time.nome).toUpperCase(), 512, 410, 900, 230, { cor: letra, contorno, borda: 0.12, sombra: 0.05 });
    g.strokeStyle = "rgba(0,0,0,.35)";
    g.lineWidth = 18;
    g.strokeRect(9, 9, 1006, 750);
    return textura(c);
  }

  function estrela(g, x, y, r, cor, contorno) {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.45 : r;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
    g.lineWidth = r * 0.18;
    g.strokeStyle = contorno;
    g.stroke();
    g.fillStyle = cor;
    g.fill();
  }

  /* Mosaico: o @ chapado na cor do time, letra esticada na vertical porque a
     arquibancada é vista deitada, com contorno escuro pra ler até em time
     de camisa branca. */
  function mosaico(time, nome) {
    const W = 1024, H = 640;
    const [c, g] = canvas(W, H);
    g.fillStyle = time.cor;
    g.fillRect(0, 0, W, H);
    g.fillStyle = claro(time.cor) ? time.cor2 : "#ffc928";
    g.fillRect(0, 0, W, 34);
    g.fillRect(0, H - 34, W, 34);
    g.textAlign = "center";
    g.textBaseline = "middle";
    let t = 220;
    g.font = `${t}px ${LETRA}`;
    while (g.measureText(nome).width > W * 0.88 && t > 40) {
      t -= 6;
      g.font = `${t}px ${LETRA}`;
    }
    const estica = Math.min(2.6, (H * 0.62) / t);
    g.save();
    g.translate(W / 2, H / 2 + 6);
    g.scale(1, estica);
    g.lineJoin = "round";
    g.lineWidth = t * 0.2;
    g.strokeStyle = TINTA;
    g.strokeText(nome, 0, 0);
    g.fillStyle = "#fff";
    g.fillText(nome, 0, 0);
    g.restore();
    return textura(c);
  }

  /* Placa de LED em volta do campo: texto que corre (a cena anda o offset). */
  function led() {
    const [c, g] = canvas(1024, 64);
    const grad = g.createLinearGradient(0, 0, 1024, 0);
    grad.addColorStop(0, "#1b1440");
    grad.addColorStop(0.5, "#2b1a66");
    grad.addColorStop(1, "#1b1440");
    g.fillStyle = grad;
    g.fillRect(0, 0, 1024, 64);
    for (let i = 0; i < 2; i++) {
      letreiro(g, "MAIOR TORCIDA DO BRASIL", 256 + i * 512, 34, 440, 44, { cor: i ? "#ffc928" : "#ffffff", borda: 0 });
    }
    g.fillStyle = "rgba(0,0,0,.35)";
    for (let x = 0; x < 1024; x += 4) g.fillRect(x, 0, 1, 64);
    return textura(c, { repetir: true });
  }

  /* Fachada de concreto com pilares e a faixa de luz em cima. */
  function fachada() {
    const [c, g] = canvas(256, 256);
    g.fillStyle = "#545a6e";
    g.fillRect(0, 0, 256, 256);
    const rnd = sorteio(3);
    for (let i = 0; i < 1500; i++) {
      g.fillStyle = rnd() < 0.5 ? "rgba(0,0,0,.08)" : "rgba(255,255,255,.05)";
      g.fillRect(rnd() * 256, rnd() * 256, 2, 2);
    }
    g.fillStyle = "#3c4152";
    g.fillRect(0, 0, 40, 256);
    g.fillStyle = "#6a7088";
    g.fillRect(40, 0, 6, 256);
    g.fillStyle = "#2a2e3c";
    for (let y = 60; y < 230; y += 56) g.fillRect(70, y, 150, 22);
    g.fillStyle = "rgba(255,226,160,.85)";
    for (let y = 60; y < 230; y += 56) g.fillRect(74, y + 4, 142, 3);
    return textura(c, { repetir: true });
  }

  /* Janelas acesas dos prédios em volta. */
  function janelas() {
    const [c, g] = canvas(128, 256);
    g.fillStyle = "#0c1020";
    g.fillRect(0, 0, 128, 256);
    const rnd = sorteio(19);
    for (let y = 6; y < 256; y += 14) {
      for (let x = 6; x < 128; x += 14) {
        const r = rnd();
        if (r < 0.42) continue;
        g.fillStyle = r < 0.8 ? "rgba(255,206,120,.85)" : r < 0.93 ? "rgba(170,210,255,.75)" : "rgba(255,255,230,.95)";
        g.fillRect(x, y, 8, 9);
      }
    }
    return textura(c, { repetir: true });
  }

  /* Lado do ônibus da caravana: cor do time, janelas com cabeças de
     torcedor e a palavra CARAVANA. */
  function onibus(time) {
    const [c, g] = canvas(1024, 320);
    padrao(g, time, 0, 0, 1024, 320, 1.4);
    g.fillStyle = "rgba(0,0,0,.15)";
    g.fillRect(0, 250, 1024, 70);
    g.fillStyle = "#1a2133";
    g.fillRect(60, 40, 904, 110);
    const rnd = sorteio(time.nome.length * 13);
    const peles = ["#f2c59b", "#c98b5f", "#8a5a3b", "#e8b48a", "#5e3b25"];
    for (let x = 90; x < 940; x += 58) {
      g.fillStyle = "rgba(255,230,170,.18)";
      g.fillRect(x - 24, 44, 50, 102);
      if (rnd() < 0.15) continue;
      g.fillStyle = peles[Math.floor(rnd() * peles.length)];
      g.beginPath();
      g.arc(x, 104, 18, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = time.cor;
      g.fillRect(x - 22, 124, 44, 24);
      if (rnd() < 0.5) {
        g.fillStyle = peles[0];
        g.fillRect(x + 12, 64, 8, 36);
      }
    }
    g.fillStyle = "rgba(255,255,255,.25)";
    for (let x = 60; x < 964; x += 58) g.fillRect(x, 40, 4, 110);
    letreiro(g, "CARAVANA", 512, 212, 760, 86, {
      cor: claro(time.cor) ? TINTA : "#fff", contorno: claro(time.cor) ? "#fff" : TINTA, borda: 0.16,
    });
    return textura(c);
  }

  /* Placa do presidente da torcida, embaixo do boneco de coroa. */
  function placa(nome) {
    const [c, g] = canvas(512, 112);
    const grad = g.createLinearGradient(0, 0, 0, 112);
    grad.addColorStop(0, "#3b2a08");
    grad.addColorStop(1, "#1a1203");
    g.fillStyle = grad;
    g.beginPath();
    g.roundRect(4, 4, 504, 104, 26);
    g.fill();
    g.lineWidth = 8;
    g.strokeStyle = "#ffc928";
    g.stroke();
    letreiro(g, `👑 @${nome}`, 256, 58, 470, 64, { cor: "#ffd95a", borda: 0.14 });
    return textura(c);
  }

  /* ───────────── sprites ───────────── */

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

  function fumaca() {
    const [c, g] = canvas(128, 128);
    const rnd = sorteio(5);
    for (let i = 0; i < 16; i++) {
      const x = 64 + (rnd() - 0.5) * 40, y = 64 + (rnd() - 0.5) * 40, r = 22 + rnd() * 26;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, "rgba(255,255,255,.4)");
      gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
    }
    return textura(c, { cor: false });
  }

  function papel() {
    const [c, g] = canvas(32, 32);
    g.fillStyle = "#fff";
    g.fillRect(6, 10, 20, 12);
    return textura(c, { cor: false });
  }

  return {
    sorteio, claro, gramado, faixaFrente, faixaTopo, bandeira, mosaico, led, fachada, janelas, onibus, placa,
    brilho, fumaca, papel, letreiro, padrao, LETRA, TINTA,
  };
})();
