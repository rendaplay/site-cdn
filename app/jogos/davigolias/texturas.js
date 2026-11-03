/* Texturas desenhadas em canvas na hora de abrir: chão do vale, escamas da
   armadura, a placa do peito do Golias e os sprites das partículas. Nada
   pra baixar. */
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

  /* Gerador com semente: o vale sai igual toda vez. */
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

  /* Terra batida do vale: manchas, cascalho e rachaduras. Repete sem
     emenda porque tudo que sai de um lado volta pelo outro. */
  function chao() {
    const W = 512;
    const [c, g] = canvas(W, W);
    const rnd = sorteio(11);
    g.fillStyle = "#c99263";
    g.fillRect(0, 0, W, W);
    const mancha = (x, y, r, cor) => {
      for (const dx of [-W, 0, W]) for (const dy of [-W, 0, W]) {
        const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
        gr.addColorStop(0, cor);
        gr.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = gr;
        g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
      }
    };
    for (let i = 0; i < 40; i++) {
      mancha(rnd() * W, rnd() * W, 30 + rnd() * 90,
        rnd() < 0.5 ? `rgba(150,92,52,${0.18 + rnd() * 0.2})` : `rgba(232,182,128,${0.15 + rnd() * 0.2})`);
    }
    g.lineCap = "round";
    for (let i = 0; i < 18; i++) {
      let x = rnd() * W, y = rnd() * W;
      g.strokeStyle = `rgba(110,62,34,${0.25 + rnd() * 0.2})`;
      g.lineWidth = 1 + rnd() * 1.5;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += (rnd() - 0.5) * 40;
        y += (rnd() - 0.5) * 40;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    for (let i = 0; i < 9000; i++) {
      const s = 1 + rnd() * 2.2;
      g.fillStyle = ["#8f5a36", "#e3b383", "#a96f44", "#f0c999", "#7a4a2c"][Math.floor(rnd() * 5)];
      g.fillRect(rnd() * W, rnd() * W, s, s);
    }
    for (let i = 0; i < 160; i++) {
      const x = rnd() * W, y = rnd() * W, r = 2 + rnd() * 4;
      g.fillStyle = "rgba(70,40,22,.35)";
      g.beginPath();
      g.ellipse(x + 1.5, y + 1.5, r, r * 0.75, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = ["#b88458", "#d9a774", "#9c6a46"][Math.floor(rnd() * 3)];
      g.beginPath();
      g.ellipse(x, y, r, r * 0.75, rnd() * 3, 0, Math.PI * 2);
      g.fill();
    }
    return textura(c, { repetir: true });
  }

  /* Armadura de escamas: fileiras desencontradas de escama em gota, cada
     fileira por cima da de baixo, então só aparece a ponta redonda de
     cada uma, com o fio claro na borda. Sai em tons de cinza: a cor vem
     do material (bronze), e a mesma imagem dá o relevo. */
  function escamas() {
    const W = 256;
    const [c, g] = canvas(W, W);
    g.fillStyle = "#3a3a3a";
    g.fillRect(0, 0, W, W);
    const L = 32, H = 40, A = 16;
    for (let fila = W / A + 2; fila >= -2; fila--) {
      for (let col = -1; col <= W / L + 1; col++) {
        const x = col * L + (fila % 2 ? L / 2 : 0), y = fila * A;
        const gr = g.createLinearGradient(x, y - H, x, y);
        gr.addColorStop(0, "#5a5a5a");
        gr.addColorStop(0.55, "#c8c8c8");
        gr.addColorStop(0.85, "#f4f4f4");
        gr.addColorStop(1, "#8a8a8a");
        g.fillStyle = gr;
        g.beginPath();
        g.moveTo(x - L / 2, y - H);
        g.lineTo(x - L / 2, y - H * 0.45);
        g.quadraticCurveTo(x - L / 2, y, x, y);
        g.quadraticCurveTo(x + L / 2, y, x + L / 2, y - H * 0.45);
        g.lineTo(x + L / 2, y - H);
        g.closePath();
        g.fill();
        g.strokeStyle = "rgba(20,20,20,.85)";
        g.lineWidth = 1.5;
        g.stroke();
        g.fillStyle = "rgba(255,255,255,.55)";
        g.beginPath();
        g.ellipse(x - L * 0.12, y - H * 0.42, L * 0.08, H * 0.12, 0.2, 0, Math.PI * 2);
        g.fill();
      }
    }
    return textura(c, { repetir: true });
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

  /* Nuvem de poeira: bolotas sobrepostas, borda macia. */
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

  /* Placa do peito do Golias: bronze com rebite e o @ de quem é o gigante.
     Sem dono fica só o bronze liso. */
  function placa() {
    const W = 512, H = 192;
    const [c, g] = canvas(W, H);
    const t = textura(c);
    const desenhar = nome => {
      g.clearRect(0, 0, W, H);
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, "#f6d58a");
      gr.addColorStop(0.5, "#c88d3c");
      gr.addColorStop(1, "#7a4e1e");
      g.fillStyle = "#3a230e";
      g.beginPath();
      g.roundRect(0, 0, W, H, 40);
      g.fill();
      g.fillStyle = gr;
      g.beginPath();
      g.roundRect(10, 10, W - 20, H - 20, 32);
      g.fill();
      g.fillStyle = "#3a230e";
      for (const [x, y] of [[36, 36], [W - 36, 36], [36, H - 36], [W - 36, H - 36]]) {
        g.beginPath();
        g.arc(x, y, 9, 0, Math.PI * 2);
        g.fill();
      }
      if (!nome) { t.needsUpdate = true; return; }
      let tam = 92;
      const texto = `@${nome}`;
      g.font = `${tam}px ${LETRA}`;
      while (g.measureText(texto).width > W - 110 && tam > 40) {
        tam -= 4;
        g.font = `${tam}px ${LETRA}`;
      }
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.lineJoin = "round";
      g.lineWidth = 14;
      g.strokeStyle = "#2a1606";
      g.strokeText(texto, W / 2, H / 2 + 6);
      g.fillStyle = "#fff4d6";
      g.fillText(texto, W / 2, H / 2 + 6);
      t.needsUpdate = true;
    };
    desenhar("");
    return { textura: t, desenhar };
  }

  /* Chão rachado do tremor: rachas em zigue-zague saindo do centro, com
     galhos, escuras no meio e com a borda clara de terra quebrada. */
  function racha() {
    const W = 512;
    const [c, g] = canvas(W, W);
    const rnd = sorteio(53);
    const fundo = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
    fundo.addColorStop(0, "rgba(70,36,16,.55)");
    fundo.addColorStop(0.35, "rgba(90,50,24,.25)");
    fundo.addColorStop(1, "rgba(90,50,24,0)");
    g.fillStyle = fundo;
    g.fillRect(0, 0, W, W);
    g.lineCap = g.lineJoin = "round";
    const galho = (x, y, ang, comp, larg, nivel) => {
      const pontos = [[x, y]];
      let a = ang;
      for (let i = 0; i < 7; i++) {
        a += (rnd() - 0.5) * 0.9;
        x += Math.cos(a) * comp / 7;
        y += Math.sin(a) * comp / 7;
        pontos.push([x, y]);
      }
      for (const [cor, largura] of [["rgba(240,196,140,.75)", larg + 6], ["#1e0a03", larg], ["#ff7a1a", larg * 0.55], ["#ffd060", larg * 0.2]]) {
        g.strokeStyle = cor;
        g.lineWidth = largura;
        g.beginPath();
        pontos.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
        g.stroke();
      }
      if (nivel < 2) {
        for (let i = 2; i < pontos.length - 1; i += 2) {
          if (rnd() < 0.6) galho(pontos[i][0], pontos[i][1], ang + (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.6), comp * 0.45, larg * 0.55, nivel + 1);
        }
      }
    };
    for (let i = 0; i < 8; i++) galho(W / 2, W / 2, (i / 8) * Math.PI * 2 + rnd() * 0.5, 170 + rnd() * 70, 30, 0);
    g.fillStyle = "#1e0a03";
    g.beginPath();
    g.ellipse(W / 2, W / 2, 40, 30, 0.4, 0, Math.PI * 2);
    g.fill();
    const lava = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, 30);
    lava.addColorStop(0, "#ffe08a");
    lava.addColorStop(0.5, "#ff8a20");
    lava.addColorStop(1, "rgba(255,90,10,0)");
    g.fillStyle = lava;
    g.beginPath();
    g.ellipse(W / 2, W / 2, 30, 22, 0.4, 0, Math.PI * 2);
    g.fill();
    return textura(c);
  }

  /* Labareda em gota, ponta pra cima, pra partícula de fogo. */
  function chama() {
    const [c, g] = canvas(128, 128);
    const forma = () => {
      g.beginPath();
      g.moveTo(64, 6);
      g.bezierCurveTo(70, 40, 100, 58, 96, 88);
      g.bezierCurveTo(92, 112, 76, 122, 64, 122);
      g.bezierCurveTo(52, 122, 36, 112, 32, 88);
      g.bezierCurveTo(28, 62, 56, 46, 64, 6);
      g.closePath();
    };
    const fora = g.createRadialGradient(64, 92, 0, 64, 80, 70);
    fora.addColorStop(0, "rgba(255,255,255,1)");
    fora.addColorStop(0.45, "rgba(255,220,190,.85)");
    fora.addColorStop(1, "rgba(255,160,120,0)");
    g.shadowColor = "rgba(255,200,160,.8)";
    g.shadowBlur = 10;
    g.fillStyle = fora;
    forma();
    g.fill();
    g.shadowBlur = 0;
    const miolo = g.createRadialGradient(64, 98, 0, 64, 94, 26);
    miolo.addColorStop(0, "rgba(255,255,255,.9)");
    miolo.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = miolo;
    g.fillRect(0, 0, 128, 128);
    const t = textura(c, { cor: false });
    t.flipY = false;
    return t;
  }

  /* Raio de luz do céu: forte em cima, some pra baixo e nas bordas. */
  function raio() {
    const [c, g] = canvas(64, 512);
    const lado = g.createLinearGradient(0, 0, 64, 0);
    lado.addColorStop(0, "rgba(255,255,255,0)");
    lado.addColorStop(0.5, "rgba(255,255,255,1)");
    lado.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = lado;
    g.fillRect(0, 0, 64, 512);
    g.globalCompositeOperation = "destination-in";
    const desce = g.createLinearGradient(0, 0, 0, 512);
    desce.addColorStop(0, "rgba(0,0,0,1)");
    desce.addColorStop(0.6, "rgba(0,0,0,.35)");
    desce.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = desce;
    g.fillRect(0, 0, 64, 512);
    return textura(c);
  }

  return { chao, escamas, brilho, poeira, placa, racha, raio, chama, sorteio };
})();
