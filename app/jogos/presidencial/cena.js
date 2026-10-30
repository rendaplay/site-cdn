/* A cena da Corrida: céu, arquibancada com torcida, placas de LED, pista
   terracota em perspectiva e os dois corredores. Tudo em canvas, em px do
   palco (1080×1920 ou 1920×1080); o canvas tem o tamanho real da tela.

   Distância de verdade (largada, marcas de 100 m, chegada) segue a câmera
   em metros. O chão, a torcida e as placas andam por um "odômetro" visual
   mais rápido: a 2,5 m/s de verdade a pista mal se mexeria e a passada
   pareceria esteira. */
"use strict";

(function (raiz) {
  const TAU = Math.PI * 2;
  const TINTA = "#14121C";
  const PISTA = "#C8553D";

  const LAYOUTS = {
    vertical: {
      W: 1080, H: 1920, arqTopo: 318, arqBase: 900, muroBase: 984, pistaTopo: 984, raiaMeio: 1212, pistaBase: 1470,
      pe: [1180, 1438], escala: [0.97, 1.06], kTopo: 0.86, kBase: 1.03, fileiras: 6, ppmMax: 22, margem: 60, afasta: 130,
    },
    horizontal: {
      W: 1920, H: 1080, arqTopo: 150, arqBase: 468, muroBase: 528, pistaTopo: 528, raiaMeio: 718, pistaBase: 936,
      pe: [702, 912], escala: [0.72, 0.8], kTopo: 0.9, kBase: 1.03, fileiras: 4, ppmMax: 36, margem: 60, afasta: 160,
    },
  };

  /* Vertical montada pela altura do palco (1920 a 2520): o HUD de baixo
     ocupa os últimos 450 px mais parte da sobra, porque no celular os
     comentários do TikTok cobrem essa faixa e a raia da frente tem que
     ficar acima deles. A pista fica logo acima e leva a maior parte do resto
     (corredores maiores), a arquibancada fica com o que sobra, quase toda
     atrás do placar. O pé da raia de trás desce o bastante pro tronco ficar
     na pista e só a cabeça subir sobre o muro. */
  function vertical(base, H) {
    const sobra = H - base.H;
    const cresce = 1 + 0.25 * sobra / 600;
    const pistaBase = H - 450 - sobra * 0.45;
    const pistaTopo = pistaBase - (600 + sobra * 0.55);
    const arqBase = pistaTopo - 80;
    const pe0 = pistaTopo + 300 * cresce;
    return {
      ...base, H, sobra: sobra / 2,
      arqBase, muroBase: pistaTopo, pistaTopo, raiaMeio: pe0 + 30, pistaBase,
      pe: [pe0, pistaBase - 30],
      escala: base.escala.map(e => e * cresce),
      fileiras: Math.round((arqBase - base.arqTopo) / 95),
    };
  }

  /* Gerador com semente: a torcida sai igual toda vez que monta. */
  function semeado(s) {
    let a = s >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function tela(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const lerp = (a, b, t) => a + (b - a) * t;
  const lim = (v, a, b) => Math.max(a, Math.min(b, v));
  const mod = (a, n) => ((a % n) + n) % n;

  /* ───────────── sprites pré-desenhados ───────────── */

  const CORES_TORCIDA = [
    ["#D8141F", "#D8141F", "#FFFFFF", "#A30E17", "#D8141F", "#F2F2F2"],
    ["#00873F", "#00873F", "#FFD400", "#0B6B35", "#FFD400", "#1E4FB0"],
  ];
  const PELES = ["#F1C3A0", "#E2A47C", "#C78457", "#9A5E3A", "#6E4027", "#F6D2B8"];
  const CABELOS = ["#1D140E", "#3A2416", "#6B4A2E", "#B9B2A8", "#141414", "#8A5A2B"];

  const TILE = 1200;
  const FATIA = 40;

  /* Uma fileira de torcedores de um lado (as duas camadas se intercalam
     no mesmo banco, pra cada lado pular separado). */
  function fileiraTorcida(lado, escala, semente) {
    const r = semeado(semente);
    const alt = Math.ceil(130 * escala);
    const cv = tela(TILE, alt);
    const c = cv.getContext("2d");
    const passo = 46 * escala;
    const n = Math.floor(TILE / passo);
    for (let i = 0; i < n; i++) {
      if ((i + lado) % 2) continue;
      const x = (i + 0.5) * (TILE / n) + (r() - 0.5) * 8 * escala;
      const base = alt - 4;
      const cor = CORES_TORCIDA[lado][Math.floor(r() * 6)];
      const pele = PELES[Math.floor(r() * PELES.length)];
      const s = escala * (0.9 + r() * 0.2);
      const bracos = r();
      c.lineCap = "round";
      /* braços pra cima em metade da torcida */
      if (bracos < 0.5) {
        c.strokeStyle = pele;
        c.lineWidth = 7 * s;
        c.beginPath();
        c.moveTo(x - 13 * s, base - 46 * s); c.lineTo(x - 22 * s, base - 84 * s);
        c.moveTo(x + 13 * s, base - 46 * s); c.lineTo(x + 22 * s, base - 84 * s);
        c.stroke();
      }
      /* corpo */
      c.fillStyle = cor;
      c.beginPath();
      c.roundRect(x - 17 * s, base - 50 * s, 34 * s, 54 * s, [12 * s, 12 * s, 3 * s, 3 * s]);
      c.fill();
      if (r() < 0.35) {
        c.fillStyle = lado ? "#FFD400" : "#FFFFFF";
        c.font = `900 ${18 * s}px 'Big Shoulders Display', 'Arial Narrow', sans-serif`;
        c.textAlign = "center";
        c.fillText(lado ? "22" : "13", x, base - 22 * s);
      }
      /* cabeça */
      c.fillStyle = pele;
      c.beginPath();
      c.arc(x, base - 64 * s, 14 * s, 0, TAU);
      c.fill();
      c.fillStyle = CABELOS[Math.floor(r() * CABELOS.length)];
      c.beginPath();
      c.arc(x, base - 67 * s, 14.5 * s, Math.PI * 1.05, Math.PI * 1.95);
      c.fill();
      if (r() < 0.18) {
        /* boné ou chapéu na cor do lado */
        c.fillStyle = lado ? "#FFD400" : "#D8141F";
        c.beginPath();
        c.ellipse(x, base - 75 * s, 15 * s, 7 * s, 0, Math.PI, TAU);
        c.fill();
      }
      /* bandeirinha */
      if (bracos > 0.86) {
        const bx = x + 24 * s, by = base - 92 * s;
        c.strokeStyle = "#3B2A1C";
        c.lineWidth = 3 * s;
        c.beginPath(); c.moveTo(bx, base - 40 * s); c.lineTo(bx, by - 30 * s); c.stroke();
        c.fillStyle = lado ? "#00873F" : "#D8141F";
        c.fillRect(bx, by - 30 * s, 38 * s, 26 * s);
        c.fillStyle = lado ? "#FFD400" : "#FFFFFF";
        c.font = `900 ${20 * s}px 'Big Shoulders Display', 'Arial Narrow', sans-serif`;
        c.textAlign = "center";
        c.fillText(lado ? "22" : "13", bx + 19 * s, by - 10 * s);
      }
    }
    return cv;
  }

  function fundoArquibancada(L, linhas) {
    const h = L.arqBase - L.arqTopo + 40;
    const cv = tela(TILE, h);
    const c = cv.getContext("2d");
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#1C2A4A");
    g.addColorStop(1, "#2F3F66");
    c.fillStyle = g;
    c.fillRect(0, 0, TILE, h);
    /* degraus: cada fileira um banco */
    for (const ln of linhas) {
      const y = ln.y - L.arqTopo;
      c.fillStyle = "#43537D";
      c.fillRect(0, y - 6 * ln.escala, TILE, 14 * ln.escala);
      c.fillStyle = "rgba(0,0,0,.25)";
      c.fillRect(0, y + 8 * ln.escala, TILE, 6 * ln.escala);
    }
    /* escadas de acesso */
    c.fillStyle = "rgba(255,255,255,.07)";
    for (let x = 140; x < TILE; x += 400) c.fillRect(x, 0, 34, h);
    return cv;
  }

  const SLOGANS = ["QUEM VAI GANHAR?", "DISPUTA AO VIVO", "CORRIDA DA LIVE", "A TORCIDA DECIDE", "RETA FINAL"];

  function placasLed(altura) {
    const w = 2400;
    const cv = tela(w, altura);
    const c = cv.getContext("2d");
    const larg = w / SLOGANS.length;
    SLOGANS.forEach((txt, i) => {
      const x = i * larg;
      const g = c.createLinearGradient(0, 0, 0, altura);
      const cores = [["#101836", "#1B2A5C"], ["#3A0A0F", "#7A121C"], ["#06301A", "#0B5A31"], ["#1A1033", "#2D1F5C"], ["#2B2208", "#5C4A0E"]][i % 5];
      g.addColorStop(0, cores[0]);
      g.addColorStop(1, cores[1]);
      c.fillStyle = g;
      c.fillRect(x + 3, 4, larg - 6, altura - 8);
      c.fillStyle = "rgba(255,255,255,.05)";
      for (let y = 6; y < altura - 6; y += 4) c.fillRect(x + 3, y, larg - 6, 1);
      c.font = `900 ${Math.round(altura * 0.56)}px 'Big Shoulders Display', 'Arial Narrow', sans-serif`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillStyle = ["#FFD400", "#FFFFFF", "#FFFFFF", "#FFD400", "#7FE3FF"][i % 5];
      c.shadowColor = c.fillStyle;
      c.shadowBlur = 12;
      c.fillText(txt, x + larg / 2, altura / 2 + 2);
      c.shadowBlur = 0;
    });
    return cv;
  }

  function nuvem(r) {
    const w = 360, h = 150;
    const cv = tela(w, h);
    const c = cv.getContext("2d");
    c.fillStyle = "rgba(255,255,255,.92)";
    const bolas = [[80, 100, 52], [150, 78, 66], [228, 88, 58], [290, 106, 40], [120, 112, 40], [200, 114, 44]];
    for (const [x, y, rr] of bolas) {
      c.beginPath();
      c.arc(x + (r() - 0.5) * 16, y, rr * (0.85 + r() * 0.3), 0, TAU);
      c.fill();
    }
    c.globalCompositeOperation = "source-atop";
    const g = c.createLinearGradient(0, 40, 0, h);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(1, "rgba(150,180,220,.45)");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    return cv;
  }

  function cascaBanana() {
    const cv = tela(120, 90);
    const c = cv.getContext("2d");
    c.translate(60, 52);
    c.lineJoin = "round";
    const pedaco = (ang) => {
      c.save();
      c.rotate(ang);
      c.beginPath();
      c.moveTo(-6, 0);
      c.quadraticCurveTo(-14, -26, -4, -44);
      c.quadraticCurveTo(6, -30, 6, 0);
      c.closePath();
      c.lineWidth = 4;
      c.strokeStyle = TINTA;
      c.stroke();
      c.fillStyle = "#FFD83A";
      c.fill();
      c.fillStyle = "#6B4A1E";
      c.beginPath(); c.arc(-4, -43, 3, 0, TAU); c.fill();
      c.restore();
    };
    pedaco(-1.1); pedaco(1.1); pedaco(-0.2);
    c.beginPath();
    c.ellipse(0, 4, 14, 10, 0, 0, TAU);
    c.lineWidth = 4;
    c.strokeStyle = TINTA;
    c.stroke();
    c.fillStyle = "#F2C629";
    c.fill();
    c.fillStyle = "#6B4A1E";
    c.fillRect(-3, 10, 6, 9);
    return cv;
  }

  function bolinha(cor, r) {
    const cv = tela(r * 2, r * 2);
    const c = cv.getContext("2d");
    const g = c.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, cor);
    g.addColorStop(1, cor.replace(/[\d.]+\)$/, "0)"));
    c.fillStyle = g;
    c.fillRect(0, 0, r * 2, r * 2);
    return cv;
  }

  /* ───────────── partículas: pool fixo, sem alocar no quadro ───────────── */

  const MAX_PART = 500;
  function novaParticula() {
    return { vivo: false, tipo: 0, x: 0, y: 0, vx: 0, vy: 0, g: 0, vida: 0, dur: 1, tam: 1, rot: 0, vr: 0, cor: "#fff", chao: 0 };
  }
  const P_POEIRA = 1, P_FUMACA = 2, P_CONFETE = 3, P_FAISCA = 4, P_BRILHO = 5;

  /* ───────────── cena ───────────── */

  const Cena = {
    L: LAYOUTS.vertical,
    nome: "vertical",
    t: 0,
    cam: 0,
    camVel: 0,
    ppm: 22,
    zoom: 1,
    zoomAlvo: 1,
    zoomAte: 0,
    camY: 0,
    tremor: 0,
    ritmo: 1,
    lentoAte: 0,
    lentoFator: 1,
    odo: 0,
    vis: [0, 0],
    vv: [0, 0],
    raiaDe: [0, 1],
    frente: 1,
    corredores: [null, null],
    rastro: [0, 0],
    empolgacao: [0, 0],
    olaX: -400,
    proximaOla: 6,
    flash: 0,
    foto: null,
    fita: { quebrada: false, t: 0 },
    bananas: [],
    caidoVis: [0, 0],
    pista: 1000,
    fase: "largada",
    vencedor: -1,
    telas: [{ x: 0, y: 0, longe: 0 }, { x: 0, y: 0, longe: 0 }],

    montar(canvas, nome, candidatos, artes) {
      this.canvas = canvas;
      this.c = canvas.getContext("2d");
      this.candidatos = candidatos;
      this.part = Array.from({ length: MAX_PART }, novaParticula);
      const r = semeado(11);
      this.nuvens = Array.from({ length: 7 }, (_, i) => ({ img: nuvem(r), x: r() * 2400, y: r(), s: 0.5 + r() * 0.7, v: 4 + r() * 8, i }));
      this.banana = cascaBanana();
      this.spritePoeira = bolinha("rgba(214,150,110,.85)", 24);
      this.spriteFumaca = bolinha("rgba(235,235,240,.9)", 32);
      this.spriteBrilho = bolinha("rgba(255,240,170,1)", 20);
      this.formato(nome);
      return Promise.all(candidatos.map((cand, i) => Corredor.criar(cand, artes[i]))).then(cs => { this.corredores = cs; });
    },

    formato(nome, altura) {
      const base = LAYOUTS[nome] || LAYOUTS.vertical;
      this.nome = nome;
      this.L = nome === "horizontal" ? { ...base, sobra: 0 } : vertical(base, Math.max(base.H, altura || 0));
      this.prerender();
    },

    prerender() {
      const L = this.L;
      const n = L.fileiras;
      this.linhas = [];
      for (let i = 0; i < n; i++) {
        const f = (i + 1) / n;
        const escala = (0.5 + 0.5 * (i / (n - 1))) * (this.nome === "horizontal" ? 0.8 : 1);
        this.linhas.push({
          y: L.arqTopo + 40 + (L.arqBase - L.arqTopo - 40) * Math.pow(f, 1.08),
          escala,
          camadas: [fileiraTorcida(0, escala, 100 + i * 7), fileiraTorcida(1, escala, 300 + i * 7)],
          fase: i * 0.9,
        });
      }
      this.fundoArq = fundoArquibancada(L, this.linhas);
      this.arqParada = this.compor();
      /* degradês do quadro, criados uma vez por formato */
      const c = this.c;
      const degrade = (y0, y1, cores) => {
        const g = c.createLinearGradient(0, y0, 0, y1);
        cores.forEach((cor, i) => g.addColorStop(i / (cores.length - 1), cor));
        return g;
      };
      this.degrades = {
        cobertura: degrade(L.arqTopo, L.arqTopo + 80, ["rgba(0,0,20,.45)", "rgba(0,0,20,0)"]),
        muro: degrade(L.pistaTopo, L.pistaTopo + 50, ["rgba(40,10,0,.35)", "rgba(40,10,0,0)"]),
        grama: degrade(L.pistaBase, L.H + 200, ["#4FA53A", "#2F7A25"]),
      };
      this.placas = placasLed(L.muroBase - L.arqBase - 18);
      this.ceu = this.desenharCeu();
      this.texturaPista = this.desenharTexturaPista();
    },

    /* A torcida parada já vem pintada no fundo: no quadro, só o lado que
       pula e o trecho da ola são redesenhados em fatias. Índice: bit 0 =
       lado 0 parado, bit 1 = lado 1 parado. */
    compor() {
      const L = this.L;
      return [0, 1, 2, 3].map(bits => {
        const cv = tela(TILE, this.fundoArq.height);
        const c = cv.getContext("2d");
        c.drawImage(this.fundoArq, 0, 0);
        for (const ln of this.linhas) {
          for (let lado = 0; lado < 2; lado++) {
            if (!(bits & (1 << lado))) continue;
            const img = ln.camadas[lado];
            c.drawImage(img, 0, ln.y - img.height + 6 * ln.escala - L.arqTopo);
          }
        }
        return cv;
      });
    },

    desenharCeu() {
      const L = this.L;
      const h = L.arqTopo + 60;
      const cv = tela(8, h);
      const c = cv.getContext("2d");
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#1E6FD9");
      g.addColorStop(0.55, "#58A8F0");
      g.addColorStop(1, "#BFE3FF");
      c.fillStyle = g;
      c.fillRect(0, 0, 8, h);
      return cv;
    },

    desenharTexturaPista() {
      const L = this.L;
      const h = L.pistaBase - L.pistaTopo;
      const w = 512;
      const cv = tela(w, h);
      const c = cv.getContext("2d");
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#B9492F");
      g.addColorStop(0.5, PISTA);
      g.addColorStop(1, "#D5644A");
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      const r = semeado(5);
      for (let i = 0; i < 1400; i++) {
        c.fillStyle = r() < 0.5 ? "rgba(255,220,200,.10)" : "rgba(80,20,10,.12)";
        c.fillRect(r() * w, r() * h, 2 + r() * 2, 2);
      }
      return cv;
    },

    dimensionar(escala) {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const k = escala * dpr;
      this.canvas.width = Math.round(this.L.W * k);
      this.canvas.height = Math.round(this.L.H * k);
      this.k = k;
    },

    novaCorrida(numero, pista) {
      this.pista = pista;
      this.raiaDe = numero % 2 ? [0, 1] : [1, 0];
      this.frente = this.raiaDe[0] === 0 ? 1 : -1;
      this.vis = [0, 0];
      this.vv = [0, 0];
      this.cam = 0;
      this.camVel = 0;
      this.foto = null;
      this.fita = { quebrada: false, t: 0 };
      this.bananas.length = 0;
      this.caidoVis = [0, 0];
      this.vencedor = -1;
      this.lentoAte = 0;
      this.zoomAlvo = 1;
      for (const p of this.part) p.vivo = false;
    },

    /* ───────────── mundo → tela ───────────── */

    kDe(y) {
      const L = this.L;
      return lerp(L.kTopo, L.kBase, (y - L.pistaTopo) / (L.pistaBase - L.pistaTopo));
    },
    sx(m, y) { return this.L.W / 2 + (m - this.cam) * this.ppm * this.kDe(y); },

    /* ───────────── acontecimentos ───────────── */

    empolgar(lado, forca = 1) {
      if (lado >= 0) this.empolgacao[lado] = Math.min(1.4, this.empolgacao[lado] + forca);
      else this.empolgacao[0] = this.empolgacao[1] = Math.min(1.4, Math.max(this.empolgacao[0], this.empolgacao[1]) + forca);
    },

    lento(segundos, fator) {
      this.lentoAte = Math.max(this.lentoAte, this.t + segundos * fator);
      this.lentoFator = fator;
    },

    efeito(a) {
      if (a.tipo !== "efeito") {
        if (a.tipo === "ultrapassagem") { this.empolgar(a.lado, 1.2); this.olaX = -300; }
        if (a.tipo === "retaFinal") { this.empolgar(-1, 1); this.olaX = -300; }
        if (a.tipo === "encostou") this.empolgar(a.lado, 0.8);
        return;
      }
      const l = a.lado;
      if (a.efeito === "passinho") {
        this.brilho(l, 2);
        return;
      }
      if (a.efeito === "impulso") {
        this.rastro[l] = 0.6;
        this.empolgar(l, 0.35 + Math.min(0.5, a.metros / 60));
        this.brilho(l, 5);
      } else if (a.efeito === "nitro") {
        this.empolgar(l, 0.8);
        this.zoomAlvo = 1.07;
        this.zoomAte = this.t + 1.4;
        this.tremor = Math.max(this.tremor, 6);
      } else if (a.efeito === "banana") {
        this.empolgar(l, 1.1);
        this.bananas.push({ de: l, alvo: a.alvo, t: 0, dur: 0.55, caiu: false });
      } else if (a.efeito === "jato") {
        this.empolgar(l, 1.4);
        this.tremor = Math.max(this.tremor, 14);
        this.confete(this.telas[l].x, this.telas[l].y + 60, 60, l);
      }
    },

    /* Câmera lenta, flash e quadro congelado na chegada. */
    fotoFinish(vencedor) {
      this.vencedor = vencedor;
      this.foto = { t: 0, congelado: false, cruzou: -1 };
      this.lentoFator = 0.28;
      this.lentoAte = Infinity;
    },

    linhaChegadaX() { return this.sx(this.pista, this.L.raiaMeio); },

    /* ───────────── partículas ───────────── */

    particula(tipo, x, y, vx, vy, dur, tam, cor = "#fff", g = 0) {
      for (const p of this.part) {
        if (p.vivo) continue;
        p.vivo = true; p.tipo = tipo; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.g = g;
        p.vida = 0; p.dur = dur; p.tam = tam; p.cor = cor; p.rot = Math.random() * TAU; p.vr = (Math.random() - 0.5) * 12;
        p.chao = y;
        return p;
      }
      return null;
    },

    poeira(x, y, escala, forte = 1) {
      for (let i = 0; i < 3 * forte; i++) {
        this.particula(P_POEIRA, x + (Math.random() - 0.5) * 20, y - 4, -40 - Math.random() * 90, -20 - Math.random() * 50, 0.45 + Math.random() * 0.35, (14 + Math.random() * 14) * escala);
      }
    },

    brilho(l, n) {
      const p = this.telas[l];
      const cor = this.candidatos[l].cor;
      for (let i = 0; i < n; i++) {
        this.particula(P_FAISCA, p.x + (Math.random() - 0.5) * 80, p.y + 120 + Math.random() * 120, (Math.random() - 0.5) * 120, -150 - Math.random() * 160, 0.7 + Math.random() * 0.4, 7 + Math.random() * 5, i % 2 ? "#FFFFFF" : cor, 260);
      }
    },

    confete(x, y, n, lado) {
      const cores = lado === 1 ? ["#00873F", "#FFD400", "#FFFFFF", "#1E4FB0"] : lado === 0 ? ["#D8141F", "#FFFFFF", "#FFD400", "#FF6B6B"] : ["#D8141F", "#00873F", "#FFD400", "#FFFFFF"];
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
        const v = 400 + Math.random() * 600;
        this.particula(P_CONFETE, x, y, Math.cos(a) * v, Math.sin(a) * v, 2.2 + Math.random() * 1.2, 10 + Math.random() * 8, cores[i % cores.length], 900);
      }
    },

    /* ───────────── quadro ───────────── */

    /* dt real; devolve o fator de tempo (câmera lenta) pro jogo aplicar nas regras. */
    passoDeTempo(dt) {
      let alvo = 1;
      if (this.foto) alvo = this.foto.congelado ? 0 : this.lentoFator;
      else if (this.t < this.lentoAte) alvo = this.lentoFator;
      this.ritmo += (alvo - this.ritmo) * Math.min(1, dt * (alvo < this.ritmo ? 18 : 6));
      if (this.foto && this.foto.congelado) this.ritmo = 0;
      return this.ritmo;
    },

    quadro(dtReal, corrida, fase) {
      this.fase = fase;
      const ritmo = this.passoDeTempo(dtReal);
      const dt = dtReal * ritmo;
      this.t += dt;
      if (this.foto) this.foto.t += dtReal;
      this.atualizar(dt, dtReal, corrida, fase);
      this.desenhar(corrida, fase);
    },

    atualizar(dt, dtReal, corrida, fase) {
      const L = this.L;
      /* posições visuais: impulso vira arrancada curta, não teleporte */
      for (let l = 0; l < 2; l++) {
        const antes = this.vis[l];
        if (fase === "largada") this.vis[l] = 0;
        else if (this.foto && !this.foto.congelado) {
          /* na chegada as regras param: o vencedor ainda tem que cruzar a linha */
          const alvo = l === this.vencedor ? this.pista + 3 : Math.min(corrida.pos[l], this.pista - 0.6);
          const vmin = l === this.vencedor ? 14 : 0;
          this.vis[l] = Math.min(alvo, this.vis[l] + Math.max(vmin, (alvo - this.vis[l]) * 3) * dt);
        } else if (!this.foto) {
          this.vis[l] += (corrida.pos[l] - this.vis[l]) * (1 - Math.exp(-dt * 3.2));
        }
        const v = dt > 0 ? (this.vis[l] - antes) / dt : this.vv[l];
        this.vv[l] += (v - this.vv[l]) * Math.min(1, dtReal * 6);
      }
      if (this.foto && !this.foto.congelado) {
        const v = this.vencedor, o = 1 - v;
        if (this.vis[o] > this.vis[v] - 0.4) this.vis[o] = this.vis[v] - 0.4;
        if (this.vis[v] >= this.pista && this.foto.cruzou < 0) {
          this.foto.cruzou = this.t;
          this.fita.quebrada = true;
          this.flash = 1;
          this.confete(this.linhaChegadaX(), L.pistaTopo - 40, 90, v);
        }
        if (this.foto.cruzou >= 0 && this.t - this.foto.cruzou > 0.09) this.foto.congelado = true;
      }

      /* Cabeça grande demais pra dois corredores no mesmo x: quem está na
         frente ganha uns px a mais. Muda de lado devagar e só com 0,5 m de
         diferença, senão empate pisca. */
      const dif = this.vis[0] - this.vis[1];
      const frenteAlvo = Math.abs(dif) > 0.5 ? Math.sign(dif) : this.frente;
      this.frente += (frenteAlvo - this.frente) * Math.min(1, dt * 3);

      /* câmera: meio dos dois; aproxima/afasta pra caber os dois */
      const meio = (this.vis[0] + this.vis[1]) / 2;
      const gap = Math.abs(this.vis[0] - this.vis[1]);
      const ppmAlvo = lim((0.5 * L.W) / Math.max(1, gap), L.ppmMax * 0.16, L.ppmMax);
      if (dt > 0) {
        this.ppm += (ppmAlvo - this.ppm) * Math.min(1, dt * 2.5);
        const camAntes = this.cam;
        this.cam += (meio - this.cam) * Math.min(1, dt * 5);
        const cv = (this.cam - camAntes) / dt;
        this.camVel += (cv - this.camVel) * Math.min(1, dt * 4);
      }
      /* odômetro do cenário (px de chão por segundo) */
      const corrend = fase === "correndo" || (this.foto && !this.foto.congelado);
      const velDecor = corrend ? 150 * Math.sqrt(Math.max(0, this.camVel)) * (L.W / 1080) ** 0.5 : 0;
      const dOdo = velDecor * dt;
      this.odo += dOdo;

      /* corredores */
      const voo = [0, 0];
      for (let l = 0; l < 2; l++) {
        const cr = this.corredores[l];
        if (!cr) continue;
        const raia = this.raiaDe[l];
        const tipos = corrida.boost[l];
        let jato = false, nitro = false;
        for (const b of tipos) { if (b.tipo === "jato") jato = true; else nitro = true; }
        cr.boostVis = fase === "correndo" ? (jato ? "jato" : nitro ? "nitro" : null) : null;
        /* tombo só quando a casca chega */
        const esperandoCasca = this.bananas.some(b => b.alvo === l && !b.caiu);
        const caido = fase === "correndo" && corrida.caido[l] > 0 && !esperandoCasca;
        const pose = fase === "largada" ? "largada" : fase === "podio" ? "comemora" : "correndo";
        const velPasso = Math.max(fase === "correndo" || this.foto ? 2.5 : 0, this.vv[l]);
        const pisou = cr.atualizar(dt, { vel: velPasso, caido, voando: jato && fase === "correndo", pose });
        const p = this.telas[l];
        if (pisou) this.poeira(p.x - 10, L.pe[raia], L.escala[raia], cr.boostVis === "nitro" ? 2 : 1);
        if (cr.boostVis === "jato" && Math.random() < dt * 40) {
          this.particula(P_FUMACA, p.x - 70 * L.escala[raia], L.pe[raia] - 160 * L.escala[raia] - cr.voo * 110 + 60, -120 - Math.random() * 120, 60 + Math.random() * 60, 0.9, 26 * L.escala[raia]);
        }
        voo[l] = cr.voo;
        this.rastro[l] = Math.max(0, this.rastro[l] - dt);
      }
      /* jato: a câmera sobe junto com quem voa */
      const vooMax = Math.max(voo[0], voo[1]);
      this.camY += (vooMax * 70 - this.camY) * Math.min(1, dt * 3);

      /* bananas voando de uma raia pra outra */
      for (const b of this.bananas) {
        b.t += dt;
        if (!b.caiu && b.t >= b.dur) {
          b.caiu = true;
          this.lento(0.4, 0.3);
          this.tremor = Math.max(this.tremor, 10);
          const p = this.telas[b.alvo];
          const raia = this.raiaDe[b.alvo];
          this.poeira(p.x + 30, L.pe[raia], L.escala[raia], 3);
        }
      }
      for (let i = this.bananas.length - 1; i >= 0; i--) if (this.bananas[i].t > b2fim(this.bananas[i])) this.bananas.splice(i, 1);

      if (this.t > this.zoomAte) this.zoomAlvo = 1;
      this.zoom += (this.zoomAlvo - this.zoom) * Math.min(1, dtReal * 3);
      this.tremor = Math.max(0, this.tremor - dtReal * 30);
      this.flash = Math.max(0, this.flash - dtReal * 2.2);
      for (let l = 0; l < 2; l++) this.empolgacao[l] = Math.max(0, this.empolgacao[l] - dtReal * 0.45);

      /* ola: passa de vez em quando, e na hora da emoção */
      this.olaX += dtReal * 1100;
      if (this.olaX > L.W + 400 && this.t > this.proximaOla) {
        this.olaX = -400;
        this.proximaOla = this.t + 9 + Math.random() * 6;
      }

      for (const n of this.nuvens) n.x -= (n.v + velDecor * 0.02) * dtReal;

      for (const p of this.part) {
        if (!p.vivo) continue;
        p.vida += dt;
        if (p.vida >= p.dur) { p.vivo = false; continue; }
        p.vy += p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        if (p.tipo === P_POEIRA || p.tipo === P_FUMACA) p.x -= dOdo;
        if (p.tipo === P_CONFETE) { p.vx *= 1 - dt * 1.6; if (p.vy > 160) p.vy = 160; }
      }
    },

    /* ───────────── desenho ───────────── */

    desenhar(corrida, fase) {
      const c = this.c;
      const L = this.L;
      c.setTransform(this.k, 0, 0, this.k, 0, 0);
      c.fillStyle = "#3E7D2C";
      c.fillRect(0, 0, L.W, L.H);

      const tx = this.tremor ? (Math.random() - 0.5) * this.tremor : 0;
      const ty = this.tremor ? (Math.random() - 0.5) * this.tremor : 0;
      const fx = L.W / 2, fy = L.raiaMeio;
      c.translate(fx + tx, fy + ty + this.camY);
      c.scale(this.zoom, this.zoom);
      c.translate(-fx, -fy);

      this.desenharCeuENuvens(c);
      this.desenharArquibancada(c);
      this.desenharMuro(c);
      this.desenharPista(c);
      this.desenharMarcas(c);
      this.desenharChegada(c, false);

      /* raia de trás primeiro */
      const ordem = this.raiaDe[0] === 0 ? [0, 1] : [1, 0];
      for (const l of ordem) this.desenharCorredor(c, l, fase);
      this.desenharChegada(c, true);
      this.desenharBananas(c);
      this.desenharGrama(c);
      this.desenharParticulas(c);

      if (this.foto && this.foto.congelado) this.desenharLinhaFoto(c);

      c.setTransform(this.k, 0, 0, this.k, 0, 0);
      this.desenharVelocidade(c);
      if (this.flash > 0) {
        c.fillStyle = `rgba(255,255,255,${this.flash})`;
        c.fillRect(0, 0, L.W, L.H);
      }
    },

    desenharCeuENuvens(c) {
      const L = this.L;
      c.drawImage(this.ceu, -200, -300, L.W + 400, L.arqTopo + 360);
      /* sol */
      c.save();
      c.globalCompositeOperation = "lighter";
      c.drawImage(this.spriteBrilho, L.W * 0.78 - 160, L.arqTopo * 0.35 - 160, 320, 320);
      c.restore();
      for (const n of this.nuvens) {
        const w = 360 * n.s;
        const x = Math.round(mod(n.x, L.W + 900) - 450);
        c.drawImage(n.img, x, 40 + n.y * (L.arqTopo - 120) - 80, w, 150 * n.s);
      }
      /* torres de luz do estádio */
      c.fillStyle = "#24314F";
      for (const bx of [0.1, 0.9]) {
        const x = L.W * bx;
        c.fillRect(x - 6, L.arqTopo - 190, 12, 200);
        c.fillStyle = "#2E3D60";
        c.fillRect(x - 46, L.arqTopo - 230, 92, 44);
        c.fillStyle = "#FFF6C9";
        for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) c.fillRect(x - 40 + i * 21, L.arqTopo - 225 + j * 20, 17, 15);
        c.fillStyle = "#24314F";
      }
      /* cobertura da arquibancada */
      c.fillStyle = "#1A2440";
      c.beginPath();
      c.moveTo(-20, L.arqTopo - 34);
      c.lineTo(L.W + 20, L.arqTopo - 34);
      c.lineTo(L.W + 20, L.arqTopo + 6);
      c.lineTo(-20, L.arqTopo + 6);
      c.fill();
      c.fillStyle = "#C9D3E8";
      c.fillRect(-20, L.arqTopo - 38, L.W + 40, 7);
    },

    desenharArquibancada(c) {
      const L = this.L;
      /* x inteiro: imagem em x quebrado é filtrada, e isso pesa sem GPU */
      const desl = Math.round(mod(this.odo * 0.3, TILE));
      const t = this.t;
      const pula0 = this.empolgacao[0] > 0.03, pula1 = this.empolgacao[1] > 0.03;
      const fundo = this.arqParada[(pula0 ? 0 : 1) | (pula1 ? 0 : 2)];
      for (let x = -desl; x < L.W; x += TILE) c.drawImage(fundo, x, L.arqTopo);

      /* trecho da ola: apaga a torcida parada com o fundo limpo */
      const ola0 = this.olaX - 300, ola1 = this.olaX + 300;
      const olaNaTela = ola1 > 0 && ola0 < L.W;
      if (olaNaTela && !(pula0 && pula1)) {
        const limpo = this.arqParada[0];
        this.fatias(c, desl, ola0, ola1, (ti, dx) => c.drawImage(limpo, ti * FATIA, 0, FATIA, limpo.height, dx, L.arqTopo, FATIA, limpo.height));
      }
      for (let i = 0; i < this.linhas.length; i++) {
        const ln = this.linhas[i];
        for (let lado = 0; lado < 2; lado++) {
          const pula = lado ? pula1 : pula0;
          if (!pula && !olaNaTela) continue;
          const img = ln.camadas[lado];
          const h = img.height;
          const pulo = 26 * ln.escala * this.empolgacao[lado];
          const y0 = ln.y - h + 6 * ln.escala;
          this.fatias(c, desl, pula ? -FATIA : ola0, pula ? L.W + FATIA : ola1, (ti, dx) => {
            const ola = (dx + FATIA / 2 - this.olaX) / 140;
            let dy = -30 * ln.escala * Math.exp(-ola * ola);
            if (pula) dy -= pulo * Math.abs(Math.sin(t * 13 + ti * 0.9 + i * 0.7));
            c.drawImage(img, ti * FATIA, 0, FATIA, h, dx, Math.round(y0 + dy), FATIA, h);
          });
        }
      }
      /* sombra da cobertura no alto */
      c.fillStyle = this.degrades.cobertura;
      c.fillRect(0, L.arqTopo, L.W, 80);
    },

    /* Chama `desenhar(índiceNoTile, xNaTela)` pra cada fatia entre x0 e x1. */
    fatias(c, desl, x0, x1, desenhar) {
      const resto = desl % FATIA;
      const primeiro = Math.floor(desl / FATIA);
      const j0 = Math.max(0, Math.floor((x0 + resto) / FATIA));
      for (let j = j0; j * FATIA - resto < Math.min(x1, this.L.W); j++) {
        desenhar((primeiro + j) % (TILE / FATIA), j * FATIA - resto);
      }
    },

    desenharMuro(c) {
      const L = this.L;
      const y0 = L.arqBase, h = L.muroBase - L.arqBase;
      c.fillStyle = "#0E1428";
      c.fillRect(0, y0, L.W, h);
      const p = this.placas;
      const desl = Math.round(mod(this.odo * 0.85 + this.t * 40, p.width));
      for (let x = -desl; x < L.W; x += p.width) c.drawImage(p, x, y0 + 9, p.width, p.height);
      c.fillStyle = "#E9EDF7";
      c.fillRect(0, L.muroBase - 6, L.W, 6);
    },

    desenharPista(c) {
      const L = this.L;
      const tp = this.texturaPista;
      const h = L.pistaBase - L.pistaTopo;
      const desl = Math.round(mod(this.odo, tp.width));
      for (let x = -desl; x < L.W; x += tp.width) c.drawImage(tp, x, L.pistaTopo, tp.width, h);
      /* linhas das raias */
      c.fillStyle = "#FFFFFF";
      c.fillRect(0, L.pistaTopo + 6, L.W, 6);
      c.fillRect(0, L.raiaMeio - 4, L.W, 8);
      c.fillRect(0, L.pistaBase - 12, L.W, 9);
      /* tracinhos que correm com o chão, em perspectiva */
      const passo = 180;
      const d0 = mod(this.odo, passo);
      c.fillStyle = "rgba(255,255,255,.55)";
      for (let x = -d0 - passo; x < L.W + passo * 2; x += passo) {
        for (const y of [L.pistaTopo + 6, L.raiaMeio - 4, L.pistaBase - 12]) {
          const xx = L.W / 2 + (x - L.W / 2) * this.kDe(y);
          c.fillRect(xx, y + 7, 26, 4);
        }
      }
      /* número da raia pintado no chão */
      const passoN = 720;
      const dn = mod(this.odo, passoN);
      c.save();
      c.font = "900 150px 'Big Shoulders Display', 'Arial Narrow', sans-serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillStyle = "rgba(255,255,255,.22)";
      for (let x = -dn + 200; x < L.W + passoN; x += passoN) {
        for (let l = 0; l < 2; l++) {
          const raia = this.raiaDe[l];
          const y = raia === 0 ? (L.pistaTopo + L.raiaMeio) / 2 : (L.raiaMeio + L.pistaBase) / 2;
          const xx = L.W / 2 + (x - L.W / 2) * this.kDe(y);
          c.save();
          c.translate(xx, y);
          c.scale(1.2, raia === 0 ? 0.42 : 0.5);
          c.fillText(this.candidatos[l].numero, 0, 0);
          c.restore();
        }
      }
      c.restore();
      /* sombra do muro na pista */
      c.fillStyle = this.degrades.muro;
      c.fillRect(0, L.pistaTopo, L.W, 50);
    },

    /* faixa atravessando a pista em perspectiva, na distância m */
    faixaTransversal(c, m, largura, estilo) {
      const L = this.L;
      const xa = this.sx(m, L.pistaTopo + 6), xb = this.sx(m, L.pistaBase - 4);
      if (Math.max(xa, xb) < -200 || Math.min(xa, xb) > L.W + 200) return false;
      c.fillStyle = estilo;
      c.beginPath();
      c.moveTo(xa, L.pistaTopo + 6);
      c.lineTo(xa + largura, L.pistaTopo + 6);
      c.lineTo(xb + largura, L.pistaBase - 4);
      c.lineTo(xb, L.pistaBase - 4);
      c.closePath();
      c.fill();
      return true;
    },

    desenharMarcas(c) {
      this.faixaTransversal(c, 0, 10, "#FFFFFF");
      for (let m = 100; m < this.pista; m += 100) this.faixaTransversal(c, m, 6, "rgba(255,255,255,.85)");
    },

    desenharChegada(c, frente) {
      const L = this.L;
      const m = this.pista;
      const xa = this.sx(m, L.pistaTopo), xb = this.sx(m, L.pistaBase);
      if (Math.max(xa, xb) < -400 || Math.min(xa, xb) > L.W + 400) return;
      const escT = L.escala[0], escF = L.escala[1];
      if (!frente) {
        /* quadriculado */
        const lin = 12, col = 3, larg = 42;
        const h = (L.pistaBase - 4 - (L.pistaTopo + 6)) / lin;
        for (let i = 0; i < lin; i++) {
          const y = L.pistaTopo + 6 + i * h;
          const x0 = this.sx(m, y), x1 = this.sx(m, y + h);
          for (let j = 0; j < col; j++) {
            c.fillStyle = (i + j) % 2 ? "#111" : "#FFF";
            c.beginPath();
            c.moveTo(x0 + j * larg / col, y);
            c.lineTo(x0 + (j + 1) * larg / col, y);
            c.lineTo(x1 + (j + 1) * larg / col, y + h);
            c.lineTo(x1 + j * larg / col, y + h);
            c.fill();
          }
        }
        /* poste do fundo e faixa de cima */
        const topo = Math.max(L.pistaTopo - 520 * escT, L.arqTopo + 60 + 92 * escF);
        c.fillStyle = "#E9EDF7";
        c.fillRect(xa - 8, topo, 16, L.pistaTopo - topo + 4);
        c.fillStyle = TINTA;
        c.fillRect(xa - 8, topo, 4, L.pistaTopo - topo + 4);
        this.fitaDesenho(c, xa, xb, false);
        return;
      }
      /* poste da frente e o pórtico (na horizontal a arquibancada é baixa:
         o pórtico não sobe por baixo do placar) */
      const bw = 420 * escF, bh = 92 * escF;
      const teto = L.arqTopo + 60 + bh;
      const topo = Math.max(L.pistaTopo - 520 * escT, teto);
      const topoF = Math.max(L.pistaBase - 600 * escF, teto);
      c.fillStyle = "#E9EDF7";
      c.fillRect(xb - 10, topoF, 20, L.pistaBase + 20 - topoF);
      c.fillStyle = TINTA;
      c.fillRect(xb - 10, topoF, 4, L.pistaBase + 20 - topoF);
      this.fitaDesenho(c, xa, xb, true);
      const bx = (xa + xb) / 2 - bw / 2 + 20, by = Math.min(topo, topoF) - bh + 20;
      c.save();
      c.beginPath();
      c.roundRect(bx, by, bw, bh, 12);
      c.lineWidth = 6;
      c.strokeStyle = TINTA;
      c.stroke();
      c.clip();
      const q = bh / 4;
      for (let i = 0; i * q < bw; i++) for (let j = 0; j < 4; j++) {
        c.fillStyle = (i + j) % 2 ? "#111" : "#FFF";
        c.fillRect(bx + i * q, by + j * q, q, q);
      }
      c.fillStyle = "rgba(10,14,30,.86)";
      c.fillRect(bx + bh * 0.5, by + bh * 0.14, bw - bh, bh * 0.72);
      c.font = `900 ${Math.round(bh * 0.62)}px 'Big Shoulders Display', 'Arial Narrow', sans-serif`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillStyle = "#FFD400";
      c.fillText("CHEGADA", bx + bw / 2, by + bh / 2 + 2);
      c.restore();
    },

    /* Fita da chegada: inteira entre os postes; estourada, cada metade cai pro seu poste. */
    fitaDesenho(c, xa, xb, frente) {
      const L = this.L;
      const ya = L.pe[0] - 150 * L.escala[0], yb = L.pe[1] - 160 * L.escala[1];
      c.lineCap = "round";
      c.strokeStyle = "#FFD400";
      c.lineWidth = 7;
      if (!this.fita.quebrada) {
        if (!frente) return;
        c.beginPath();
        c.moveTo(xa, ya);
        c.quadraticCurveTo((xa + xb) / 2 - 10, (ya + yb) / 2 + 10, xb, yb);
        c.stroke();
        return;
      }
      const t = Math.min(1, (this.t - (this.foto ? this.foto.cruzou : 0)) * 2.5 + 0.25);
      const mx = (xa + xb) / 2, my = (ya + yb) / 2;
      c.beginPath();
      if (!frente) {
        c.moveTo(xa, ya);
        c.quadraticCurveTo(lerp(mx, xa, t) + 50 * t, lerp(my, ya, t) + 40 * t, lerp(mx, xa, t) + 70 * t, lerp(my, ya + 120, t));
      } else {
        c.moveTo(xb, yb);
        c.quadraticCurveTo(lerp(mx, xb, t) + 50 * t, lerp(my, yb, t) + 30 * t, lerp(mx, xb, t) + 80 * t, lerp(my, yb + 130, t));
      }
      c.stroke();
    },

    desenharCorredor(c, l, fase) {
      const cr = this.corredores[l];
      if (!cr) return;
      const L = this.L;
      const raia = this.raiaDe[l];
      const y = L.pe[raia];
      const k = this.kDe(y);
      const esc = L.escala[raia];
      /* cabeça e braço pra frente, mochila e fogo do jato pra trás: o corpo
         inteiro fica a L.margem px da borda */
      const xMin = L.margem + (160 + cr.recuo) * esc, xMax = L.W - L.margem - 130 * esc;
      const alvo = L.W / 2 + (this.vis[l] - this.cam) * this.ppm * k + (l ? -1 : 1) * this.frente * L.afasta / 2;
      const x = lim(alvo, xMin, xMax);
      const longe = x !== alvo;
      const tl = this.telas[l];
      tl.x = x;
      tl.y = y - (TRONCO_TOTAL * esc) - cr.voo * 110 * esc;
      tl.pe = y;
      tl.escala = esc;
      tl.longe = longe && this.vis[l] < this.vis[1 - l] ? Math.round(this.vis[1 - l] - this.vis[l]) : 0;

      const o = this.opcoesDesenho || (this.opcoesDesenho = { escala: 1, vel: 0, pose: "correndo", boost: null, alturaVoo: 110 });
      o.escala = esc;
      o.vel = this.vv[l];
      o.pose = fase === "largada" ? "largada" : fase === "podio" && l === this.vencedor ? "comemora" : "correndo";
      o.boost = cr.boostVis;
      if (this.rastro[l] > 0 || cr.boostVis) {
        /* rastro: cópias apagadas pra trás */
        const forca = cr.boostVis ? 0.5 : this.rastro[l] / 0.6;
        const fase0 = cr.fase;
        for (let i = 2; i >= 1; i--) {
          c.globalAlpha = 0.2 * forca * (3 - i) / 2;
          cr.fase = fase0 - i * 0.45;
          o.boost = null;
          cr.desenhar(c, x - i * 60 * esc, y, o);
        }
        cr.fase = fase0;
        c.globalAlpha = 1;
        o.boost = cr.boostVis;
      }
      cr.desenhar(c, x, y, o);

      if (tl.longe) {
        /* ficou pra trás demais pra caber: fica na borda com quanto falta */
        const txt = `−${tl.longe} m`;
        const ty = tl.y - 70 * esc;
        c.font = "900 48px 'Big Shoulders Display', 'Arial Narrow', sans-serif";
        c.textAlign = "center";
        c.textBaseline = "middle";
        const w = c.measureText(txt).width + 34;
        c.fillStyle = TINTA;
        c.beginPath();
        c.roundRect(x - w / 2 - 4, ty - 32, w + 8, 64, 32);
        c.fill();
        c.fillStyle = this.candidatos[l].cor;
        c.beginPath();
        c.roundRect(x - w / 2, ty - 28, w, 56, 28);
        c.fill();
        c.fillStyle = "#fff";
        c.fillText(txt, x, ty + 2);
      }
    },

    desenharBananas(c) {
      const L = this.L;
      for (const b of this.bananas) {
        const de = this.telas[b.de], alvo = this.telas[b.alvo];
        const ra = this.raiaDe[b.alvo];
        const destinoX = alvo.x + 70 * L.escala[ra];
        const destinoY = L.pe[ra] - 6;
        let x, y, rot, esc = L.escala[ra];
        if (!b.caiu) {
          const t = b.t / b.dur;
          x = lerp(de.x, destinoX, t);
          y = lerp(de.y + 80, destinoY, t) - Math.sin(t * Math.PI) * 260;
          rot = t * 10;
        } else {
          /* a casca escorrega pra trás e some */
          const t = b.t - b.dur;
          x = destinoX - t * 260;
          y = destinoY - Math.max(0, Math.sin(t * 5) * 70 * Math.exp(-t * 2));
          rot = t * 12;
          c.globalAlpha = Math.max(0, 1 - t / 1.2);
        }
        c.save();
        c.translate(x, y);
        c.rotate(rot);
        c.drawImage(this.banana, -60 * esc, -52 * esc, 120 * esc, 90 * esc);
        c.restore();
        c.globalAlpha = 1;
      }
    },

    desenharGrama(c) {
      const L = this.L;
      const y0 = L.pistaBase;
      c.fillStyle = this.degrades.grama;
      c.fillRect(-50, y0, L.W + 100, L.H + 400 - y0);
      /* listras de corte, mais rápidas que a pista (estão mais perto) */
      const passo = 220;
      const d = mod(this.odo * 1.15, passo * 2);
      c.fillStyle = "rgba(255,255,255,.07)";
      for (let x = -d - passo * 2; x < L.W + passo * 2; x += passo * 2) {
        c.beginPath();
        c.moveTo(x, y0);
        c.lineTo(x + passo, y0);
        c.lineTo(x + passo * 1.3 - 120, L.H + 200);
        c.lineTo(x + passo * 0.3 - 120, L.H + 200);
        c.fill();
      }
      c.fillStyle = "#EDE6D6";
      c.fillRect(-50, y0 - 3, L.W + 100, 5);
      this.desenharMarcasGrama(c);
    },

    desenharMarcasGrama(c) {
      const L = this.L;
      for (let m = 100; m < this.pista; m += 100) {
        const x = this.sx(m, L.pistaBase + 40);
        if (x < -100 || x > L.W + 100) continue;
        c.fillStyle = "#E9EDF7";
        c.fillRect(x - 3, L.pistaBase + 4, 6, 76);
        c.fillStyle = "#14203F";
        c.beginPath();
        c.roundRect(x - 64, L.pistaBase + 14, 128, 58, 12);
        c.fill();
        c.font = "900 42px 'Big Shoulders Display', 'Arial Narrow', sans-serif";
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillStyle = "#FFD400";
        c.fillText(`${m} m`, x, L.pistaBase + 45);
      }
      if (this.cam < 60) {
        const x = this.sx(0, L.pistaBase + 40);
        c.fillStyle = "#14203F";
        c.beginPath();
        c.roundRect(x - 96, L.pistaBase + 14, 192, 58, 12);
        c.fill();
        c.font = "900 40px 'Big Shoulders Display', 'Arial Narrow', sans-serif";
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillStyle = "#FFFFFF";
        c.fillText("LARGADA", x, L.pistaBase + 45);
      }
    },

    desenharParticulas(c) {
      for (const p of this.part) {
        if (!p.vivo) continue;
        const f = p.vida / p.dur;
        if (p.tipo === P_POEIRA || p.tipo === P_FUMACA) {
          const s = p.tam * (0.6 + f * 1.4);
          c.globalAlpha = (1 - f) * (p.tipo === P_FUMACA ? 0.7 : 0.8);
          c.drawImage(p.tipo === P_FUMACA ? this.spriteFumaca : this.spritePoeira, p.x - s, p.y - s, s * 2, s * 2);
        } else if (p.tipo === P_CONFETE) {
          c.globalAlpha = Math.min(1, (1 - f) * 3);
          c.save();
          c.translate(p.x, p.y);
          c.rotate(p.rot);
          c.scale(1, Math.cos(p.rot * 1.7));
          c.fillStyle = p.cor;
          c.fillRect(-p.tam / 2, -p.tam / 3, p.tam, p.tam * 0.66);
          c.restore();
        } else if (p.tipo === P_FAISCA) {
          c.globalAlpha = 1 - f;
          c.fillStyle = p.cor;
          desenharEstrela(c, p.x, p.y, p.tam * (1 - f * 0.5));
          c.fill();
        }
      }
      c.globalAlpha = 1;
    },

    /* linhas de velocidade na tela inteira quando alguém está no nitro/jato */
    desenharVelocidade(c) {
      const L = this.L;
      let forca = 0;
      for (let l = 0; l < 2; l++) {
        const cr = this.corredores[l];
        if (cr && cr.boostVis) forca = Math.max(forca, cr.boostVis === "jato" ? 1 : 0.6);
      }
      if (!forca || this.foto) return;
      const t = this.t;
      c.fillStyle = "rgba(255,255,255,.55)";
      for (let i = 0; i < 18; i++) {
        const y = L.arqBase - 200 + ((i * 197.3) % (L.pistaBase - L.arqBase + 300));
        const comp = 160 + ((i * 71) % 240);
        const x = L.W - mod(t * (1800 + i * 90) + i * 377, L.W + comp * 2);
        c.globalAlpha = forca * (0.25 + ((i * 13) % 10) / 20);
        c.fillRect(x, y, comp, 3 + (i % 3));
      }
      c.globalAlpha = 1;
    },

    /* A linha vermelha do foto finish, em cima da faixa de chegada. */
    desenharLinhaFoto(c) {
      const L = this.L;
      const xa = this.sx(this.pista, L.pistaTopo), xb = this.sx(this.pista, L.pistaBase);
      const dx = (xb - xa) / (L.pistaBase - L.pistaTopo);
      const y0 = L.arqTopo, y1 = L.H + 200;
      c.save();
      c.strokeStyle = "rgba(255,45,58,.35)";
      c.lineWidth = 22;
      c.beginPath();
      c.moveTo(xa + (y0 - L.pistaTopo) * dx, y0);
      c.lineTo(xa + (y1 - L.pistaTopo) * dx, y1);
      c.stroke();
      c.strokeStyle = "#FF2D3A";
      c.lineWidth = 6;
      c.stroke();
      c.restore();
    },

    /* Onde está cada corredor na tela (px do palco), pra HUD pôr as bolhas. */
    telaDo(l) { return this.telas[l]; },
  };

  /* altura do pé ao alto da cabeça, aproximada, na escala 1 */
  const TRONCO_TOTAL = 470;
  const b2fim = b => b.dur + 1.2;

  raiz.Cena = Cena;
})(window);
