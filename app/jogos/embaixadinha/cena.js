/* A embaixadinha em 3D (three.js): estádio à noite, a torcida dos dois
   clubes atrás (a multidão da Torcida), refletores, placas de LED, os dois
   craques articulados lado a lado, cada um com a sua bola, e os efeitos.

   Medidas em metros: craques em z = 0 olhando pra câmera (+z). A bola não
   tem física aqui: cada salto é a parábola que o regras.js já decidiu
   (`lado.salto`), só ajustada pro corpo de verdade do boneco. Truque é uma
   curva própria por cima do corpo. Só a queda do CAIU é simulada na cena. */
"use strict";

const Cena = (() => {
  const LEVE = new URLSearchParams(location.search).get("leve") === "1";
  const BOLA = 0.15;
  const X_CRAQUE = 1.45;
  const X_REFORCO = 1.0;
  /* Onde a bola encosta em cada parte do corpo, no boneco parado olhando
     pra +z (o `CONTATO` do regras.js é só a altura teórica). */
  const PONTO = {
    peE: [-0.13, 0.31, 0.36], peD: [0.13, 0.31, 0.36],
    coxaE: [-0.13, 0.97, 0.27], coxaD: [0.13, 0.97, 0.27],
    cabeca: [0, 2.17, 0.05],
  };
  /* Caminho de cada truque em volta do corpo; o primeiro ponto vira o
     contato de onde a bola saiu e o último é o peito do pé direito. */
  const CAMINHOS = {
    lambreta: [[0, 0, 0], [0.13, 0.2, -0.25], [0.1, 0.9, -0.45], [0, 2.4, -0.3], [0, 2.9, 0.4], [0.1, 1.6, 0.8], PONTO.peD],
    chapeu: [[0, 0, 0], [0.1, 1.2, 0.6], [0, 2.8, 0.2], [-0.1, 2.6, -0.5], [0, 1.2, 0.2], PONTO.peD],
    bicicleta: [[0, 0, 0], [0.1, 1.5, 0.4], [0.05, 3.0, 0.1], [0.1, 2.3, 0], [0.2, 3.2, 0.9], [0.15, 1.4, 0.7], PONTO.peD],
    calcanhar: [[0, 0, 0], [0.15, 0.15, -0.3], [0.2, 1.0, -0.5], [0.15, 2.2, -0.1], [0.15, 1.5, 0.5], PONTO.peD],
    ombro: [[0, 0, 0], [0.2, 1.3, 0.4], [0.32, 1.75, 0.1], [0.35, 2.3, 0.1], [0.2, 1.6, 0.4], PONTO.peD],
  };
  const EIXO_Y = new THREE.Vector3(0, 1, 0);
  const V1 = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3(), V4 = new THREE.Vector3();

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const suave = (atual, alvo, taxa, dt) => atual + (alvo - atual) * (1 - Math.exp(-taxa * dt));
  const curva = t => t * t * (3 - 2 * t);
  const sorte = (a, b) => a + Math.random() * (b - a);
  const rgb = hex => new THREE.Color(hex).toArray();

  /* ───────────── texturas ───────────── */

  function canvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    return [c, c.getContext("2d")];
  }

  function textura(c, { cor = true, repetir = false } = {}) {
    const t = new THREE.CanvasTexture(c);
    if (cor) t.colorSpace = THREE.SRGBColorSpace;
    if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    return t;
  }

  const Tex = {
    brilho() {
      const [c, g] = canvas(64, 64);
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, "rgba(255,255,255,1)");
      gr.addColorStop(0.25, "rgba(255,255,255,.7)");
      gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
      return textura(c, { cor: false });
    },
    estrela() {
      const [c, g] = canvas(64, 64);
      g.translate(32, 32);
      g.fillStyle = "#fff";
      g.shadowColor = "#fff";
      g.shadowBlur = 8;
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 11 : 28, a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.fill();
      return textura(c, { cor: false });
    },
    coracao() {
      const [c, g] = canvas(64, 64);
      g.fillStyle = "#fff";
      g.shadowColor = "#fff";
      g.shadowBlur = 6;
      g.beginPath();
      g.moveTo(32, 54);
      g.bezierCurveTo(4, 34, 8, 8, 32, 20);
      g.bezierCurveTo(56, 8, 60, 34, 32, 54);
      g.fill();
      return textura(c, { cor: false });
    },
    papel() {
      const [c, g] = canvas(32, 32);
      g.fillStyle = "#fff";
      g.fillRect(6, 10, 20, 12);
      return textura(c, { cor: false });
    },
    fumaca() {
      const [c, g] = canvas(128, 128);
      for (let i = 0; i < 16; i++) {
        const x = 64 + Math.sin(i * 2.3) * 22, y = 64 + Math.cos(i * 1.7) * 22, r = 26 + (i % 5) * 6;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, "rgba(255,255,255,.4)");
        gr.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = gr;
        g.fillRect(0, 0, 128, 128);
      }
      return textura(c, { cor: false });
    },
    sombra() {
      const [c, g] = canvas(64, 64);
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, "rgba(0,0,0,.55)");
      gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
      return textura(c, { cor: false });
    },
    raio() {
      const [c, g] = canvas(64, 64);
      g.fillStyle = "#fff";
      g.shadowColor = "#fff";
      g.shadowBlur = 6;
      g.beginPath();
      for (const [x, y] of [[38, 4], [16, 36], [30, 36], [24, 60], [48, 26], [34, 26], [42, 4]]) g.lineTo(x, y);
      g.closePath();
      g.fill();
      return textura(c, { cor: false });
    },
    /* Gramado em volta do círculo central: faixas de corte, ruído, a linha
       do meio e o círculo. Cobre x de -32 a 32 e z de -16 a 32. */
    gramado() {
      const W = LEVE ? 1024 : 2048, H = Math.round(W * 48 / 64);
      const [c, g] = canvas(W, H);
      const px = x => (x + 32) / 64 * W, pz = z => (z + 16) / 48 * H, m = W / 64;
      for (let z = -16, i = 0; z < 32; z += 4.5, i++) {
        g.fillStyle = i % 2 ? "#2f8a3a" : "#3a9c44";
        g.fillRect(0, pz(z), W, 4.5 * m + 1);
      }
      for (let k = 0; k < (LEVE ? 9000 : 32000); k++) {
        const x = Math.random() * W, y = Math.random() * H;
        g.fillStyle = Math.random() < 0.5 ? "rgba(15,60,20,.22)" : "rgba(160,230,140,.12)";
        g.fillRect(x, y, 1 + Math.random() * 2, 2 + Math.random() * 4);
      }
      const v = g.createRadialGradient(px(0), pz(0), 0, px(0), pz(0), W * 0.6);
      v.addColorStop(0, "rgba(255,255,230,.12)");
      v.addColorStop(1, "rgba(0,10,20,.4)");
      g.fillStyle = v;
      g.fillRect(0, 0, W, H);
      g.strokeStyle = "rgba(250,252,255,.9)";
      g.lineWidth = 0.12 * m;
      g.beginPath(); g.moveTo(0, pz(-2.2)); g.lineTo(W, pz(-2.2)); g.stroke();
      g.beginPath();
      g.ellipse(px(0), pz(-2.2), 9.15 * m, 9.15 * m * (H / 48) / (W / 64), 0, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = "#fff";
      g.beginPath(); g.arc(px(0), pz(-2.2), 0.16 * m, 0, Math.PI * 2); g.fill();
      return textura(c);
    },
    /* Faixa de LED que corre: o canvas tem um número inteiro de voltas do
       texto, senão a emenda do repeat corta uma palavra no meio. */
    placa(textoA, textoB, corA, corB) {
      const blocos = [[textoA, corA], ["EMBAIXADINHA DA LIVE", "#ffd23a"], [textoB, corB], ["★", "#ffffff"]].filter(b => b[0]);
      const fonte = '46px "Lilita One", "Arial Black", sans-serif';
      const [, medir] = canvas(8, 8);
      medir.font = fonte;
      const largura = blocos.map(([t]) => Math.ceil(medir.measureText(t).width) + 70);
      const volta = largura.reduce((a, b) => a + b, 0);
      const W = volta * Math.max(1, Math.round(2048 / volta));
      const [c, g] = canvas(W, 64);
      g.fillStyle = "#06070d";
      g.fillRect(0, 0, W, 64);
      g.font = fonte;
      g.textBaseline = "middle";
      for (let x = 0, k = 0; x < W; x += largura[k % blocos.length], k++) {
        const [t, cor] = blocos[k % blocos.length];
        g.fillStyle = cor;
        g.fillText(t, x + 35, 34);
      }
      g.fillStyle = "rgba(0,0,0,.35)";
      for (let y = 0; y < 64; y += 4) g.fillRect(0, y, W, 1);
      const t = textura(c, { repetir: true });
      t.wrapT = THREE.ClampToEdgeWrapping;
      return t;
    },
    /* Gomos de bola clássica: pentágonos pretos espalhados na esfera (UV). */
    bola() {
      const [c, g] = canvas(512, 256);
      g.fillStyle = "#f7f7f2";
      g.fillRect(0, 0, 512, 256);
      const gomo = (x, y, r) => {
        g.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 1.0);
        }
        g.closePath();
        g.fill();
      };
      g.fillStyle = "#16161c";
      for (let i = 0; i < 6; i++) {
        gomo(i * 85 + 20, 128, 26);
        gomo(i * 85 + 62, 58, 20);
        gomo(i * 85 + 62, 198, 20);
      }
      gomo(256, 6, 60);
      gomo(256, 250, 60);
      g.strokeStyle = "rgba(0,0,0,.25)";
      g.lineWidth = 2;
      for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(i * 43, 0); g.lineTo(i * 43 + 20, 256); g.stroke(); }
      return textura(c);
    },
    bandeira(time) {
      const [c, g] = canvas(512, 256);
      const P = time.padrao;
      g.fillStyle = time.cor;
      g.fillRect(0, 0, 512, 256);
      g.fillStyle = time.cor2;
      if (P === "horiz") for (let y = 0; y < 256; y += 64) g.fillRect(0, y + 32, 512, 32);
      else if (P === "listras") for (let x = 0; x < 512; x += 80) g.fillRect(x + 40, 0, 40, 256);
      else if (P === "faixa") g.fillRect(0, 104, 512, 48);
      else if (P === "diagonal") { g.save(); g.translate(256, 128); g.rotate(-0.45); g.fillRect(-400, -30, 800, 60); g.restore(); }
      else if (P === "mangas") { g.fillRect(0, 0, 90, 256); g.fillRect(422, 0, 90, 256); }
      else { g.fillRect(0, 0, 512, 22); g.fillRect(0, 234, 512, 22); }
      g.font = '900 92px "Lilita One", "Arial Black", sans-serif';
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.lineWidth = 12;
      g.lineJoin = "round";
      const luz = cor => new THREE.Color(cor).getHSL({}).l;
      const claro = luz(time.cor) > 0.6;
      const nome = time.nome.toUpperCase();
      g.font = `900 ${nome.length > 10 ? 70 : 92}px "Lilita One", "Arial Black", sans-serif`;
      g.strokeStyle = claro ? "#fff" : "#111";
      g.strokeText(nome, 256, 134);
      g.fillStyle = !claro ? "#fff" : luz(time.cor2) < 0.5 ? time.cor2 : "#111";
      g.fillText(nome, 256, 134);
      return textura(c);
    },
  };

  /* ───────────── partículas (pontos com textura) ───────────── */

  class Particulas {
    constructor(max, mapa, aditivo) {
      this.max = max;
      this.i = 0;
      this.vivas = 0;
      this.d = {
        p: new Float32Array(max * 3), v: new Float32Array(max * 3),
        vida: new Float32Array(max), vidaMax: new Float32Array(max),
        tam0: new Float32Array(max), tam1: new Float32Array(max),
        alfa: new Float32Array(max), arrasto: new Float32Array(max), grav: new Float32Array(max),
        cor0: new Float32Array(max * 3), cor1: new Float32Array(max * 3),
      };
      const g = new THREE.BufferGeometry();
      this.pos = new THREE.BufferAttribute(new Float32Array(max * 3), 3);
      this.cor = new THREE.BufferAttribute(new Float32Array(max * 3), 3);
      this.tam = new THREE.BufferAttribute(new Float32Array(max), 1);
      this.alf = new THREE.BufferAttribute(new Float32Array(max), 1);
      for (const a of [this.pos, this.cor, this.tam, this.alf]) a.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute("position", this.pos);
      g.setAttribute("aCor", this.cor);
      g.setAttribute("aTam", this.tam);
      g.setAttribute("aAlfa", this.alf);
      this.material = new THREE.ShaderMaterial({
        uniforms: { uMapa: { value: mapa }, uEscala: { value: 800 } },
        vertexShader: `
          attribute vec3 aCor; attribute float aTam; attribute float aAlfa;
          uniform float uEscala;
          varying vec3 vCor; varying float vAlfa;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = aTam * uEscala / -mv.z;
            vCor = aCor; vAlfa = aAlfa;
          }`,
        fragmentShader: `
          uniform sampler2D uMapa;
          varying vec3 vCor; varying float vAlfa;
          void main() {
            vec4 t = texture2D(uMapa, gl_PointCoord);
            gl_FragColor = vec4(vCor * t.rgb, t.a * vAlfa);
            #include <colorspace_fragment>
          }`,
        transparent: true,
        depthWrite: false,
        blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      this.pontos = new THREE.Points(g, this.material);
      this.pontos.frustumCulled = false;
      this.pontos.renderOrder = aditivo ? 3 : 2;
    }

    emitir(o) {
      const d = this.d;
      const i = this.i;
      this.i = (this.i + 1) % this.max;
      d.p[i * 3] = o.x; d.p[i * 3 + 1] = o.y; d.p[i * 3 + 2] = o.z;
      d.v[i * 3] = o.vx || 0; d.v[i * 3 + 1] = o.vy || 0; d.v[i * 3 + 2] = o.vz || 0;
      d.vida[i] = d.vidaMax[i] = o.vida || 1;
      d.tam0[i] = o.tam || 1;
      d.tam1[i] = o.tamFim ?? o.tam ?? 1;
      d.alfa[i] = o.alfa ?? 1;
      d.arrasto[i] = o.arrasto || 0;
      d.grav[i] = o.grav || 0;
      d.cor0.set(o.cor || [1, 1, 1], i * 3);
      d.cor1.set(o.corFim || o.cor || [1, 1, 1], i * 3);
      this.vivas = this.max;
    }

    passo(dt) {
      if (!this.vivas) return;
      const d = this.d;
      const P = this.pos.array, C = this.cor.array, T = this.tam.array, A = this.alf.array;
      let vivas = 0;
      for (let i = 0; i < this.max; i++) {
        if (d.vida[i] <= 0) { if (A[i] !== 0) { A[i] = 0; T[i] = 0; } continue; }
        vivas++;
        d.vida[i] -= dt;
        const k = i * 3;
        const ar = Math.exp(-d.arrasto[i] * dt);
        d.v[k] *= ar; d.v[k + 1] = d.v[k + 1] * ar - d.grav[i] * dt; d.v[k + 2] *= ar;
        d.p[k] += d.v[k] * dt;
        d.p[k + 1] += d.v[k + 1] * dt;
        d.p[k + 2] += d.v[k + 2] * dt;
        const t = 1 - Math.max(0, d.vida[i]) / d.vidaMax[i];
        P[k] = d.p[k]; P[k + 1] = d.p[k + 1]; P[k + 2] = d.p[k + 2];
        for (let c = 0; c < 3; c++) C[k + c] = lerp(d.cor0[k + c], d.cor1[k + c], t);
        T[i] = lerp(d.tam0[i], d.tam1[i], t);
        A[i] = d.alfa[i] * (t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9);
      }
      this.vivas = vivas;
      for (const a of [this.pos, this.cor, this.tam, this.alf]) a.needsUpdate = true;
    }
  }

  /* ───────────── cena ───────────── */

  return {
    LEVE,
    t: 0,
    pronta: false,
    timeA: null,
    timeB: null,
    flash: 0,
    soco: 0,
    tremor: 0,
    ociosa: false,
    final: null,
    foco: null,

    montar(canvas, cfg) {
      this.cfg = cfg;
      this.canvas = canvas;
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !LEVE, powerPreference: "high-performance" });
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.05;
      if (!LEVE) {
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      }
      this.scene = new THREE.Scene();
      this.scene.fog = new THREE.Fog(0x0b1030, 45, 140);
      this.camera = new THREE.PerspectiveCamera(60, 9 / 16, 0.1, 600);
      this.hfov = 46;

      this.tex = {
        brilho: Tex.brilho(), estrela: Tex.estrela(), coracao: Tex.coracao(), raio: Tex.raio(),
        papel: Tex.papel(), fumaca: Tex.fumaca(), sombra: Tex.sombra(),
      };
      this.U = {
        uT: { value: 0 },
        uAgito: { value: new Array(12).fill(0.6) },
        uOla: { value: new Array(12).fill(0) },
        uOlaG: { value: new THREE.Vector2(0, 0) },
      };
      this.agito = [0.8, 0.8];
      this.extra = [0, 0];
      this.triste = [0, 0];
      this.agenda = [];

      this.montarLuz();
      this.montarCeu();
      this.montarGramado();
      this.montarArquibancada();
      this.montarRefletores();
      this.montarCraques();
      this.montarEfeitos();

      this.cam = { pos: new THREE.Vector3(), olhar: new THREE.Vector3(), fov: 0 };
      this.neutro();
      this.pronta = true;
    },

    aplicarFormato(W, H) {
      this.W = W;
      this.H = H;
      this.canvas.style.width = `${W}px`;
      this.canvas.style.height = `${H}px`;
      const dpr = Math.min(LEVE ? 1 : 1.75, window.devicePixelRatio || 1);
      const larg = Math.min(W, Math.max(2, Math.round(Math.min(innerWidth || W, W) * dpr)));
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(larg, Math.round(larg * H / W), false);
      this.camera.aspect = W / H;
      /* A largura manda: os dois craques e os reforços sempre cabem; celular
         mais comprido ganha céu e gramado. */
      const v = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(this.hfov) / 2) / this.camera.aspect);
      this.fovBase = THREE.MathUtils.radToDeg(v);
      this.camera.fov = this.fovBase;
      this.camera.updateProjectionMatrix();
      for (const p of this.sistemas) p.material.uniforms.uEscala.value = larg * 0.9;
    },

    /* ───────────── montagem ───────────── */

    montarLuz() {
      this.hemi = new THREE.HemisphereLight(0x9fb0ff, 0x1d3020, 1.2);
      this.scene.add(this.hemi);
      this.luzFrente = new THREE.DirectionalLight(0xfff1dc, 2.3);
      this.luzFrente.position.set(5, 14, 12);
      if (!LEVE) {
        this.luzFrente.castShadow = true;
        const s = this.luzFrente.shadow;
        s.mapSize.set(1024, 1024);
        Object.assign(s.camera, { left: -6, right: 6, top: 7, bottom: -2, near: 4, far: 40 });
        s.bias = -0.0008;
        s.radius = 3;
      }
      this.scene.add(this.luzFrente);
      this.luzFundo = new THREE.DirectionalLight(0xbcd0ff, 1.6);
      this.luzFundo.position.set(-8, 12, -20);
      this.scene.add(this.luzFundo);
      this.luzFesta = new THREE.PointLight(0xffd27a, 0, 12, 1.6);
      this.luzFesta.position.set(0, 3, 2);
      this.scene.add(this.luzFesta);
    },

    montarCeu() {
      const mat = new THREE.ShaderMaterial({
        uniforms: { uLuz: { value: 1 } },
        vertexShader: `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `
          uniform float uLuz;
          varying vec3 vDir;
          void main() {
            float h = max(vDir.y, 0.0);
            vec3 c = mix(vec3(0.20, 0.12, 0.30), vec3(0.06, 0.08, 0.22), smoothstep(0.0, 0.25, h));
            c = mix(c, vec3(0.012, 0.018, 0.06), smoothstep(0.2, 0.7, h));
            gl_FragColor = vec4(c * uLuz, 1.0);
            #include <colorspace_fragment>
          }`,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      });
      this.ceu = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), mat);
      this.ceu.renderOrder = -1;
      this.scene.add(this.ceu);
      const n = LEVE ? 150 : 400, p = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI - Math.PI, h = 0.2 + Math.random() * 0.9;
        p.set([Math.cos(a) * 300 * Math.cos(h), Math.sin(h) * 300, Math.sin(a) * 300 * Math.cos(h)], i * 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(p, 3));
      this.estrelas = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xcad6ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 }));
      this.scene.add(this.estrelas);
    },

    montarGramado() {
      const perto = new THREE.Mesh(new THREE.PlaneGeometry(64, 48), new THREE.MeshLambertMaterial({ map: Tex.gramado() }));
      perto.rotation.x = -Math.PI / 2;
      perto.position.set(0, 0, 8);
      perto.receiveShadow = true;
      this.scene.add(perto);
      const longe = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: 0x2c7a35 }));
      longe.rotation.x = -Math.PI / 2;
      longe.position.y = -0.02;
      this.scene.add(longe);
      const pista = new THREE.Mesh(new THREE.PlaneGeometry(90, 6), new THREE.MeshLambertMaterial({ color: 0x23283a }));
      pista.rotation.x = -Math.PI / 2;
      pista.position.set(0, 0.01, -10.2);
      this.scene.add(pista);
    },

    /* Degraus atrás dos craques, a multidão por cima e o corredor no meio
       que separa as torcidas. Setor 0 = time A (esquerda), 1 = time B. */
    montarArquibancada() {
      const filas = LEVE ? 7 : 9;
      const passo = LEVE ? 0.86 : 0.7;
      const largura = 30;
      const concreto = new THREE.MeshLambertMaterial({ color: 0x2b3047 });
      const borda = new THREE.MeshLambertMaterial({ color: 0x3a4060 });
      const y0 = 1.3, z0 = -13.2, dy = 0.72, dz = 0.92;
      for (let f = 0; f < filas; f++) {
        const degrau = new THREE.Mesh(new THREE.BoxGeometry(largura * 2, dy, dz), f % 2 ? concreto : borda);
        degrau.position.set(0, y0 + f * dy - dy / 2, z0 - f * dz);
        this.scene.add(degrau);
      }
      const parede = new THREE.Mesh(new THREE.BoxGeometry(largura * 2, y0, 0.1), concreto);
      parede.position.set(0, y0 / 2, z0 + dz / 2);
      this.scene.add(parede);
      const fundo = new THREE.Mesh(new THREE.BoxGeometry(largura * 2, 3, 1), new THREE.MeshLambertMaterial({ color: 0x151a2c }));
      fundo.position.set(0, y0 + filas * dy + 0.7, z0 - filas * dz - 0.4);
      this.scene.add(fundo);

      /* Faixa de LED na frente do anel superior. */
      this.texAnel = Tex.placa("", "", "#fff", "#fff");
      this.texAnel.repeat.set(3, 1);
      this.anel = new THREE.Mesh(new THREE.PlaneGeometry(largura * 2, 1.1), new THREE.MeshBasicMaterial({ map: this.texAnel, toneMapped: false }));
      this.anel.position.set(0, y0 + filas * dy + 0.2, z0 - filas * dz + 0.15);
      this.scene.add(this.anel);

      const corredor = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, filas * dz + 1), new THREE.MeshLambertMaterial({ color: 0x8a90a8 }));
      corredor.position.set(0, y0 + (filas * dy) / 2 - 0.4, z0 - (filas * dz) / 2 + 0.4);
      corredor.rotation.x = Math.atan2(dy, dz);
      this.scene.add(corredor);

      /* A malha leve do torcedor vale pros dois modos: dessa distância não se
         vê diferença, e a versão cheia triplicava os triângulos. */
      const geo = Personagens.malhaTorcedor({ leve: true });
      this.matTorcida = Personagens.material(this.U);
      /* A câmera só vê uns 9 m pra cada lado na primeira fila (um pouco mais
         lá atrás): torcedor fora disso só gastava triângulo. */
      const lugares = [];
      for (let f = 0; f < filas; f++) {
        const visivel = 9.6 + f * 0.4;
        for (let x = -visivel + 0.5; x <= visivel - 0.5; x += passo) {
          if (Math.abs(x) < 1.25) continue;
          lugares.push({ x: x + sorte(-0.08, 0.08), y: y0 + f * dy, z: z0 - f * dz + 0.05, f });
        }
      }
      this.multidao = new Personagens.Multidao(lugares.length, geo, this.matTorcida);
      this.torcedores = lugares.map(l => {
        const um = this.multidao.por({
          ...Personagens.sortearVisual(Math.random),
          cor1: new THREE.Color(), cor2: new THREE.Color(), padrao: 0,
          setor: l.x < 0 ? 0 : 1, fase: Math.random(), coluna: l.x * 0.05,
          pos: new THREE.Vector3(l.x, l.y, l.z), giro: sorte(-0.15, 0.15), escala: sorte(0.92, 1.06),
        });
        um.neutro = Math.random() < 0.06;
        return um;
      });
      this.scene.add(this.multidao.mesh);

      /* Bandeirões na frente de cada torcida, balançando no vertex shader. */
      this.bandeiras = [];
      for (const lado of [-1, 1]) {
        const geoB = new THREE.PlaneGeometry(6, 2.8, LEVE ? 12 : 24, LEVE ? 5 : 10);
        const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
        mat.onBeforeCompile = sh => {
          sh.uniforms.uT = this.U.uT;
          sh.vertexShader = sh.vertexShader
            .replace("#include <common>", "#include <common>\nuniform float uT;")
            .replace("#include <begin_vertex>", `
              vec3 transformed = vec3(position);
              float k = (position.x + 3.0) / 6.0;
              transformed.z += sin(position.x * 0.9 - uT * 3.2 + position.y * 0.6) * 0.32 * (0.3 + k);
              transformed.y += sin(position.x * 0.7 - uT * 2.6) * 0.12;`);
        };
        const b = new THREE.Mesh(geoB, mat);
        b.position.set(lado * 5.6, y0 + 5 * dy + 0.9, z0 - 5 * dz + 1.4);
        b.rotation.x = -0.32;
        this.scene.add(b);
        this.bandeiras.push(b);
      }

      /* Placas de LED atrás dos craques: a textura corre pelo offset. */
      this.texPlaca = Tex.placa("", "", "#fff", "#fff");
      this.texPlaca.repeat.set(1.6, 1);
      const escuro = new THREE.MeshLambertMaterial({ color: 0x0a0b12 });
      this.placas = new THREE.Mesh(new THREE.BoxGeometry(40, 0.95, 0.12), [
        escuro, escuro, escuro, escuro, new THREE.MeshBasicMaterial({ map: this.texPlaca, toneMapped: false }), escuro,
      ]);
      this.placas.position.set(0, 0.48, -8.2);
      this.scene.add(this.placas);
    },

    /* Duas torres de refletor com halo aditivo e o cone de luz descendo. */
    montarRefletores() {
      this.halos = [];
      const halo = new THREE.SpriteMaterial({ map: this.tex.brilho, color: 0xfff4dc, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
      const lampada = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, fog: false });
      this.matCone = new THREE.ShaderMaterial({
        uniforms: { uForca: { value: 0.05 } },
        vertexShader: `
          varying float vY;
          void main() { vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
          uniform float uForca;
          varying float vY;
          void main() { gl_FragColor = vec4(vec3(1.0, 0.96, 0.86) * uForca * pow(vY, 1.6), 1.0); }`,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
      });
      for (const lado of [-1, 1]) {
        const torre = new THREE.Group();
        torre.position.set(lado * 9.5, 15, -31);
        torre.add(new THREE.Mesh(new THREE.BoxGeometry(6.2, 3.2, 0.4), new THREE.MeshLambertMaterial({ color: 0x1b1f2e })));
        for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
          const l = new THREE.Mesh(new THREE.CircleGeometry(0.55, 12), lampada);
          l.position.set(-2.25 + i * 1.5, -1 + j, 0.21);
          torre.add(l);
        }
        const s = new THREE.Sprite(halo);
        s.scale.set(22, 16, 1);
        s.position.z = 1;
        torre.add(s);
        this.halos.push(s);
        const s2 = new THREE.Sprite(halo.clone());
        s2.scale.set(26, 6, 1);
        s2.position.z = 1.2;
        torre.add(s2);
        this.halos.push(s2);
        torre.lookAt(0, 0, 8);
        this.scene.add(torre);
        const de = torre.position.clone(), para = new THREE.Vector3(lado * 2.5, 0, 2);
        const c = new THREE.Mesh(new THREE.ConeGeometry(7, de.distanceTo(para), 24, 1, true), this.matCone);
        c.position.copy(de).lerp(para, 0.5);
        c.lookAt(para);
        c.rotateX(-Math.PI / 2);
        this.scene.add(c);
      }
    },

    /* Por lado: o craque, o reforço (escondido até alguém seguir), a bola,
       as sombras de disco, a aura, o escudo da bola blindada e a gota de suor. */
    montarCraques() {
      const sombra = new THREE.MeshBasicMaterial({ map: this.tex.sombra, transparent: true, depthWrite: false });
      const disco = r => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(r, r), sombra);
        m.rotation.x = -Math.PI / 2;
        m.position.y = 0.012;
        this.scene.add(m);
        return m;
      };
      const texBola = Tex.bola();
      const geoBola = new THREE.SphereGeometry(BOLA, LEVE ? 16 : 24, LEVE ? 12 : 16);
      const geoEscudo = new THREE.SphereGeometry(0.34, LEVE ? 16 : 24, LEVE ? 12 : 16);
      this.lados = [0, 1].map(k => {
        const craque = Personagens.jogador({ leve: LEVE });
        const parceiro = Personagens.jogador({ leve: LEVE });
        for (const m of [craque, parceiro]) {
          m.traverse(o => { if (o.isMesh) o.castShadow = !LEVE; });
          this.scene.add(m);
        }
        parceiro.visible = false;
        const bola = new THREE.Mesh(geoBola, new THREE.MeshLambertMaterial({ map: texBola, emissive: 0x000000 }));
        bola.castShadow = !LEVE;
        this.scene.add(bola);
        const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.brilho, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
        this.scene.add(aura);
        const escudo = new THREE.Mesh(geoEscudo, new THREE.ShaderMaterial({
          uniforms: { uT: this.U.uT, uForca: { value: 0 } },
          vertexShader: `
            varying vec3 vN; varying vec3 vV;
            void main() {
              vec4 mv = modelViewMatrix * vec4(position, 1.0);
              vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
              gl_Position = projectionMatrix * mv;
            }`,
          fragmentShader: `
            uniform float uT; uniform float uForca;
            varying vec3 vN; varying vec3 vV;
            void main() {
              float borda = pow(1.0 - abs(dot(vN, vV)), 2.2);
              float faixa = 0.5 + 0.5 * sin(vN.y * 14.0 - uT * 6.0);
              gl_FragColor = vec4(vec3(1.0, 0.82, 0.3) * (borda * 1.6 + faixa * 0.12) * uForca, 1.0);
            }`,
          transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        escudo.visible = false;
        this.scene.add(escudo);
        const gota = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0x8fd8ff, transparent: true, opacity: 0 }));
        gota.scale.y = 1.4;
        this.scene.add(gota);
        return {
          k, craque, parceiro, bola, aura, escudo, gota,
          sombras: { craque: disco(1.3), parceiro: disco(1.3), bola: disco(0.36) },
          x: k === 0 ? -X_CRAQUE : X_CRAQUE,
          entra: 0, curva: null, saltoVisto: -1, queda: null, volta: 0,
          ant: new THREE.Vector3(), vel: new THREE.Vector3(), giro: 0,
          deco: { salto: novoSalto("peD", "peE", 0.4), folego: 0.8 },
        };
      });
    },

    montarEfeitos() {
      const n = LEVE ? 0.5 : 1;
      this.p = {
        brilho: new Particulas(Math.round(1400 * n), this.tex.brilho, true),
        estrela: new Particulas(Math.round(300 * n), this.tex.estrela, true),
        coracao: new Particulas(Math.round(240 * n), this.tex.coracao, true),
        raio: new Particulas(Math.round(240 * n), this.tex.raio, true),
        papel: new Particulas(Math.round(900 * n), this.tex.papel, false),
        fumaca: new Particulas(Math.round(300 * n), this.tex.fumaca, false),
        chama: new Particulas(Math.round(500 * n), this.tex.brilho, false),
      };
      this.sistemas = Object.values(this.p);
      for (const s of this.sistemas) this.scene.add(s.pontos);
      this.foguetes = [];
    },

    /* ───────────── times ───────────── */

    vestir(m, time, numero) {
      m.userData.vestir({
        cor1: time.cor, cor2: time.cor2, padrao: time.padrao, calcao: time.calcao, nome: "", numero,
        pele: Personagens.PELES[Math.floor(Math.random() * Personagens.PELES.length)],
        cabelo: Personagens.CABELOS[Math.floor(Math.random() * Personagens.CABELOS.length)],
        chuteira: ["#111116", "#f4f4f4", "#ff4a1a", "#18c8ff", "#ffd23a"][Math.floor(Math.random() * 5)],
      });
    },

    /* Antes do primeiro clássico: colete de treino, torcida misturada. */
    neutro() {
      const treino = [
        { id: "", nome: "", cor: "#ff7a1a", cor2: "#1b1f2e", calcao: "#1b1f2e", padrao: "liso" },
        { id: "", nome: "", cor: "#18c8ff", cor2: "#1b1f2e", calcao: "#1b1f2e", padrao: "liso" },
      ];
      this.timeA = this.timeB = null;
      this.lados.forEach((L, k) => {
        this.vestir(L.craque, treino[k], "");
        L.parceiro.visible = false;
        L.entra = 0;
      });
      const times = this.cfg.times;
      for (const um of this.torcedores) {
        const t = times[Math.floor(Math.random() * times.length)];
        um.cor1 = new THREE.Color(t.cor); um.cor2 = new THREE.Color(t.cor2); um.padrao = Personagens.PADRAO[t.padrao] || 0;
        this.multidao.gravar(um);
      }
      this.pintarPlacas(null, null);
      this.final = null;
    },

    classico(a, b) {
      if (!a || !b) return;
      this.timeA = a;
      this.timeB = b;
      const tA = { cor1: new THREE.Color(a.cor), cor2: new THREE.Color(a.cor2), padrao: Personagens.PADRAO[a.padrao] || 0 };
      const tB = { cor1: new THREE.Color(b.cor), cor2: new THREE.Color(b.cor2), padrao: Personagens.PADRAO[b.padrao] || 0 };
      for (const um of this.torcedores) {
        const t = um.setor === 0 ? tA : tB;
        if (um.neutro) {
          um.cor1 = new THREE.Color(0x2a2f44); um.cor2 = new THREE.Color(0x40465f); um.padrao = 0;
        } else {
          um.cor1 = t.cor1.clone(); um.cor2 = t.cor2.clone(); um.padrao = t.padrao;
        }
        um.chegou = this.t + Math.random() * 1.2;
        this.multidao.gravar(um);
      }
      for (const [i, time] of [[0, a], [1, b]]) {
        const m = this.bandeiras[i].material;
        if (m.map) m.map.dispose();
        m.map = Tex.bandeira(time);
        m.needsUpdate = true;
      }
      const kits = uniformes(a, b);
      this.lados.forEach((L, k) => {
        this.vestir(L.craque, kits[k], 10);
        this.vestir(L.parceiro, kits[k], 7);
        L.parceiro.visible = false;
        L.entra = 0;
        L.queda = null;
      });
      this.pintarPlacas(a, b);
      this.final = null;
      this.foco = null;
    },

    pintarPlacas(a, b) {
      const cor = t => (t.cor === "#f4f4f4" ? t.cor2 === "#111111" ? "#ffffff" : t.cor2 : t.cor);
      /* Repete a textura pra letra não esticar: `largura` × `altura` em metros. */
      const nova = (largura, altura) => {
        const t = Tex.placa(a ? a.nome.toUpperCase() : "", b ? b.nome.toUpperCase() : "", a ? cor(a) : "#fff", b ? cor(b) : "#fff");
        t.repeat.set(largura / altura * 64 / t.image.width, 1);
        return t;
      };
      this.texPlaca.dispose();
      this.texAnel.dispose();
      this.texPlaca = this.placas.material[4].map = nova(40, 0.95);
      this.texAnel = this.anel.material.map = nova(60, 1.1);
    },

    setor(timeId) {
      if (this.timeA && timeId === this.timeA.id) return 0;
      if (this.timeB && timeId === this.timeB.id) return 1;
      return -1;
    },

    time(id) { return id === (this.timeA && this.timeA.id) ? this.timeA : id === (this.timeB && this.timeB.id) ? this.timeB : null; },

    corDoTime(id) {
      const t = this.time(id) || (this.cfg.times.find(x => x.id === id));
      if (!t) return [rgb("#ffd23a"), rgb("#ffffff")];
      /* Time de camisa branca brilha na segunda cor (branco no gramado some). */
      const c1 = t.cor === "#f4f4f4" ? rgb(t.cor2 === "#111111" ? "#ffd23a" : t.cor2) : rgb(t.cor);
      return [c1, rgb(t.cor2)];
    },

    /* ───────────── acontecimentos ───────────── */

    festa(timeId, forca = 0.5) {
      const s = this.setor(timeId);
      if (s < 0) return;
      this.extra[s] = Math.min(1.6, Math.max(this.extra[s], forca * 1.6));
    },

    confete(timeId, n = 60) {
      const [c1, c2] = timeId ? this.corDoTime(timeId) : [rgb("#ffd23a"), rgb("#ffffff")];
      const extras = [rgb("#ffd23a"), [1, 1, 1]];
      /* Nasce logo acima do quadro, na frente da câmera, onde quer que ela esteja. */
      const cam = this.camera.position;
      for (let i = 0; i < n; i++) {
        const cor = i % 5 === 4 ? extras[i % 2] : i % 2 ? c1 : c2;
        const longe = sorte(4, 11);
        this.p.papel.emitir({
          x: cam.x + sorte(-0.45, 0.45) * longe, y: cam.y + sorte(0.3, 0.8) * longe, z: cam.z - longe,
          vx: sorte(-1, 1), vy: sorte(-0.5, 2), vz: sorte(-0.5, 0.5),
          vida: sorte(2.8, 4.5), tam: sorte(0.2, 0.32), cor, arrasto: 1.4, grav: 1.6,
        });
      }
    },

    fogos(n = 3) {
      for (let i = 0; i < n; i++) {
        this.foguetes.push({
          em: this.t + i * 0.35 + Math.random() * 0.2,
          x: sorte(-12, 12), z: sorte(-26, -14), y: 0, alto: sorte(16, 24),
          cor: [rgb("#ffd23a"), rgb("#ff4a6a"), rgb("#4ad8ff"), rgb("#9bff6a"), rgb("#ffffff")][Math.floor(Math.random() * 5)],
          subindo: false,
        });
      }
    },

    estouro(pos, cor, n, forca = 3, sis = "brilho") {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1, v = sorte(0.4, 1) * forca;
        const r = Math.sqrt(1 - u * u);
        this.p[sis].emitir({
          x: pos.x, y: pos.y, z: pos.z, vx: r * Math.cos(a) * v, vy: u * v, vz: r * Math.sin(a) * v,
          vida: sorte(0.35, 0.8), tam: sorte(0.14, 0.3), tamFim: 0.02, cor, corFim: [1, 1, 1], arrasto: 3,
        });
      }
    },

    lado(timeId) { const s = this.setor(timeId); return s < 0 ? null : this.lados[s]; },

    toque(ev) {
      const L = this.lado(ev.time);
      if (!L) return;
      const [c1] = this.corDoTime(ev.time);
      this.estouro(L.bola.position, c1, ev.origem === "comentario" ? (LEVE ? 6 : 10) : 3, ev.origem === "fogo" ? 2 : 2.6);
      if (ev.origem === "comentario") this.festa(ev.time, 0.35);
    },

    truque(ev) {
      const L = this.lado(ev.time);
      if (!L) return;
      this.estouro(L.bola.position, [1, 0.85, 0.3], LEVE ? 14 : 26, 3.5, "estrela");
      this.festa(ev.time, 0.9);
      this.soco = Math.max(this.soco, 0.35);
    },

    marco(ev) {
      this.festa(ev.time, 1);
      this.confete(ev.time, ev.n >= 100 ? (LEVE ? 70 : 120) : (LEVE ? 40 : 70));
      this.soco = Math.max(this.soco, 0.6);
      this.flash = Math.max(this.flash, 0.5);
    },

    recorde(ev) {
      this.flash = 1;
      this.soco = 1;
      this.tremor = 0.35;
      this.luzFesta.intensity = 8;
      this.fogos(LEVE ? 3 : 5);
      this.confete(null, LEVE ? 90 : 160);
      this.festa(ev.time, 1.4);
      this.mirar(ev.time, 3);
    },

    caiu(ev) {
      const L = this.lado(ev.time);
      if (!L) return;
      const s = this.setor(ev.time);
      this.triste[s] = this.t + 2.2;
      L.queda = { p: L.bola.position.clone(), v: L.vel.clone().multiplyScalar(0.6).add(new THREE.Vector3(sorte(-0.8, 0.8), 0, sorte(0.4, 1.2))), quicou: 0 };
      if (L.queda.v.y > 0) L.queda.v.y *= 0.3;
    },

    recomecou(ev) {
      const L = this.lado(ev.time);
      if (!L) return;
      L.volta = this.t;
      L.ondeCaiu = L.bola.position.clone();
      L.queda = null;
    },

    efeito(ev) {
      const L = this.lado(ev.time);
      if (!L) return;
      const [c1] = this.corDoTime(ev.time);
      if (ev.efeito === "fogo") this.estouro(L.bola.position, [1, 0.6, 0.15], LEVE ? 20 : 40, 4);
      else if (ev.efeito === "vento") {
        const R = this.lado(ev.rival);
        if (R) for (let i = 0; i < (LEVE ? 12 : 24); i++) this.p.fumaca.emitir({
          x: R.x + sorte(-3, -1.5) * (R.k ? -1 : 1), y: sorte(0.3, 3), z: sorte(-0.5, 1),
          vx: (R.k ? -1 : 1) * sorte(3, 6), vy: sorte(-0.2, 0.5), vz: sorte(-0.3, 0.3),
          vida: sorte(0.8, 1.4), tam: sorte(0.5, 0.9), tamFim: 1.4, cor: [0.85, 0.92, 1], alfa: 0.35, arrasto: 0.6,
        });
      } else if (ev.efeito === "show") {
        this.fogos(LEVE ? 4 : 7);
        this.confete(ev.time, LEVE ? 70 : 130);
        this.flash = 0.8;
        this.mirar(ev.time, 4);
        const s = this.setor(ev.time);
        if (s >= 0) this.U.uOla.value[s] = 1;
        this.agenda.push({ em: this.t + 9, f: () => { if (s >= 0) this.U.uOla.value[s] = 0; } });
      } else this.estouro(L.bola.position, c1, LEVE ? 12 : 22, 3);
      this.festa(ev.time, 0.6 + (ev.efeito === "show" ? 0.8 : 0));
    },

    reforco(ev) {
      const L = this.lado(ev.time);
      if (!L) return;
      this.confete(ev.time, LEVE ? 30 : 50);
      this.festa(ev.time, 1);
    },

    /* A câmera chega mais perto de um dos lados por um tempo. */
    mirar(timeId, seg) {
      const s = this.setor(timeId);
      if (s >= 0) this.foco = { k: s, ate: this.t + seg };
    },

    fim(ev) {
      if (!ev) return;
      this.final = { t0: this.t, vencedor: ev.vencedor, perdedor: ev.perdedor };
      this.fogos(LEVE ? 6 : 10);
      this.confete(ev.vencedor, LEVE ? 120 : 220);
      for (let i = 1; i < 4; i++) this.agenda.push({ em: this.t + i * 1.6, f: () => { this.fogos(LEVE ? 3 : 5); this.confete(ev.vencedor, LEVE ? 50 : 90); } });
    },

    ocioso(ligado) { this.ociosa = !!ligado; },

    /* ───────────── a bola ───────────── */

    /* Onde fica cada parte do corpo do jogador `j` (0 craque, 1 reforço). */
    ponto(L, parte, j, saida) {
      const m = j === 1 ? L.parceiro : L.craque;
      const o = PONTO[parte];
      saida.set(o[0], o[1], o[2]).applyAxisAngle(EIXO_Y, m.rotation.y);
      return saida.add(m.position).setY(o[1] + m.position.y);
    },

    /* Posição da bola num salto comum: a parábola do regras.js, ajustada do
       contato teórico pra parte do corpo de verdade deste boneco. */
    bolaNoSalto(L, s, f, saida) {
      const a = this.ponto(L, s.de, s.j0, V1), b = this.ponto(L, s.para, s.j1, V2);
      const k = s.j0 !== s.j1 ? f : curva(f);
      saida.set(lerp(a.x, b.x, k), 0, lerp(a.z, b.z, k));
      saida.y = alturaNoSalto(s, f) + lerp(a.y - CONTATO[s.de], b.y - CONTATO[s.para], f);
      return saida;
    },

    /* Caminho do truque, montado no começo do salto: pontos no corpo do
       craque, do contato de onde saiu até o peito do pé direito. */
    caminhoTruque(L, s) {
      const m = s.j0 === 1 ? L.parceiro : L.craque;
      const pts = CAMINHOS[s.truque].map(([x, y, z]) => new THREE.Vector3(x, y, z).applyAxisAngle(EIXO_Y, m.rotation.y).add(m.position));
      pts[0].copy(this.ponto(L, s.de, s.j0, V1));
      return new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5);
    },

    posarBola(L, lado, estado, dt) {
      const b = L.bola.position;
      L.ant.copy(b);
      const parada = !lado || estado.fase !== "jogo";
      if (!lado) {
        this.animarDeco(L, dt);
        this.bolaNoSalto(L, L.deco.salto, L.deco.salto.f, b);
      } else if (lado.caida && L.queda) {
        const q = L.queda;
        q.v.y -= 9.8 * dt;
        q.p.addScaledVector(q.v, dt);
        if (q.p.y < BOLA) {
          q.p.y = BOLA;
          if (Math.abs(q.v.y) > 0.6) {
            if (q.quicou++ === 0) for (let i = 0; i < (LEVE ? 5 : 10); i++) this.p.fumaca.emitir({
              x: q.p.x, y: 0.1, z: q.p.z, vx: sorte(-0.6, 0.6), vy: sorte(0.2, 0.6), vz: sorte(-0.6, 0.6),
              vida: 0.8, tam: 0.3, tamFim: 0.7, cor: [0.55, 0.62, 0.45], alfa: 0.35, arrasto: 2,
            });
          }
          q.v.y = Math.abs(q.v.y) * 0.5;
          if (q.v.y < 0.4) q.v.y = 0;
          q.v.x *= 0.8; q.v.z *= 0.8;
        }
        b.copy(q.p);
      } else if (parada) {
        /* Bola descansando debaixo do pé direito. */
        const alvo = V1.set(L.craque.position.x + 0.13, BOLA, 0.42);
        b.lerp(alvo, 1 - Math.exp(-7 * dt));
        b.y = Math.max(BOLA, b.y);
      } else {
        const s = lado.salto;
        const lento = estado.t < lado.lentoAte ? 2.6 : 1;
        const f = clamp(s.f + estado.alfa * PASSO / (s.T * lento), 0, 1);
        if (L.saltoVisto !== lado.saltos) {
          L.saltoVisto = lado.saltos;
          L.curva = s.truque ? this.caminhoTruque(L, s) : null;
        }
        if (s.truque && L.curva) L.curva.getPoint(f, b);
        else this.bolaNoSalto(L, s, f, b);
        if (estado.t < lado.ventoAte) {
          const v = clamp((lado.ventoAte - estado.t) / 0.6) * clamp(b.y - 0.3);
          b.x += Math.sin(this.t * 5.3 + L.k) * 0.38 * v + (L.k ? -0.15 : 0.15) * v;
          b.z += Math.cos(this.t * 3.7) * 0.22 * v;
        }
        /* Na volta depois do CAIU a bola sobe do chão pro pé. */
        const volta = (this.t - L.volta) / 0.4;
        if (volta < 1 && L.ondeCaiu) {
          V1.copy(L.ondeCaiu).lerp(b, curva(volta));
          V1.y += Math.sin(volta * Math.PI) * 0.5;
          b.copy(V1);
        }
      }
      if (dt > 0) L.vel.subVectors(b, L.ant).divideScalar(dt);
      L.giro += dt * (parada ? 0 : 6 + L.vel.length() * 2);
      L.bola.rotation.set(L.giro, L.giro * 0.4, 0);
    },

    /* Antes do clássico os dois treinam sozinhos, sem regra nenhuma. */
    animarDeco(L, dt) {
      const d = L.deco;
      d.salto.f += dt / d.salto.T;
      if (d.salto.f < 1) return;
      const partes = ["peE", "peD", "peE", "peD", "coxaE", "coxaD", "cabeca"];
      d.salto = novoSalto(d.salto.para, partes[Math.floor(Math.random() * partes.length)], sorte(0.35, 0.8));
    },

    /* ───────────── poses ───────────── */

    zerarPose(m) {
      const u = m.userData;
      m.position.y = 0;
      m.rotation.x = m.rotation.z = 0;
      u.corpo.position.y = 0.74;
      u.corpo.rotation.set(0, 0, 0);
      u.cabeca.rotation.set(0, 0, 0);
      u.bracoE.rotation.set(0, 0, -0.18);
      u.bracoD.rotation.set(0, 0, 0.18);
      for (const p of [u.pernaE, u.pernaD]) {
        p.rotation.set(0, 0, 0);
        p.userData.joelho.rotation.set(0, 0, 0);
      }
    },

    /* Quanto cada parte do corpo está pronta pro toque: sobe chegando no
       contato e desce logo depois. */
    pesoDaParte(s, f, parte, quem) {
      const chega = s.para === parte && s.j1 === quem ? curva(clamp((f - 0.5) / 0.5)) : 0;
      const sai = s.de === parte && s.j0 === quem ? 1 - curva(clamp(f / 0.3)) : 0;
      return Math.max(chega, sai);
    },

    posarToques(m, s, f, quem, folego, bolaY) {
      const u = m.userData;
      const peso = parte => this.pesoDaParte(s, f, parte, quem);
      const pe = { E: peso("peE"), D: peso("peD") }, coxa = { E: peso("coxaE"), D: peso("coxaD") };
      for (const L of ["E", "D"]) {
        const perna = u["perna" + L];
        perna.rotation.x = -(0.95 * pe[L] + 1.5 * coxa[L]);
        perna.userData.joelho.rotation.x = 0.85 * pe[L] + 1.45 * coxa[L];
      }
      const cab = peso("cabeca");
      u.corpo.position.y -= 0.06 * cab;
      for (const p of [u.pernaE, u.pernaD]) { p.rotation.x -= 0.18 * cab; p.userData.joelho.rotation.x += 0.3 * cab; }
      const olha = clamp((bolaY - 1.5) / 3);
      u.cabeca.rotation.x = -0.25 * olha - 0.35 * cab;
      u.corpo.rotation.x = 0.12 * (pe.E + pe.D) - 0.05 * olha;
      /* Braços abertos pro equilíbrio; sem fôlego eles se debatem. */
      const aflito = clamp(1 - folego * 1.6);
      u.bracoE.rotation.z = -(0.35 + 0.45 * (pe.D + coxa.D) + aflito * (0.6 + Math.sin(this.t * 9) * 0.5));
      u.bracoD.rotation.z = 0.35 + 0.45 * (pe.E + coxa.E) + aflito * (0.6 + Math.cos(this.t * 8) * 0.5);
      u.bracoE.rotation.x = -0.2 * coxa.D;
      u.bracoD.rotation.x = -0.2 * coxa.E;
    },

    posarTruque(m, nome, f) {
      const u = m.userData;
      const janela = (a, b) => Math.sin(Math.PI * clamp((f - a) / (b - a)));
      if (nome === "lambreta") {
        const w = janela(0.05, 0.42);
        u.pernaD.rotation.x = 0.35 * w;
        u.pernaD.userData.joelho.rotation.x = 2.0 * w;
        u.corpo.rotation.x = 0.3 * w;
        u.cabeca.rotation.x = -0.5 * janela(0.35, 0.8);
      } else if (nome === "chapeu") {
        const w = janela(0, 0.25);
        u.pernaD.rotation.x = -1.0 * w;
        u.pernaD.userData.joelho.rotation.x = 0.6 * w;
        m.rotation.y += Math.PI * 2 * curva(clamp((f - 0.25) / 0.5));
        u.cabeca.rotation.x = -0.6 * janela(0.15, 0.9);
        u.bracoE.rotation.z = -1.2; u.bracoD.rotation.z = 1.2;
      } else if (nome === "bicicleta") {
        const voo = clamp((f - 0.1) / 0.55);
        m.position.y = Math.sin(Math.PI * voo) * 1.1;
        u.corpo.rotation.x = -Math.PI * 2 * curva(clamp((f - 0.12) / 0.48));
        const w = janela(0.2, 0.5);
        u.pernaD.rotation.x = -2.2 * w;
        u.pernaE.rotation.x = -0.6 * w;
        u.pernaE.userData.joelho.rotation.x = 1.2 * w;
        u.bracoE.rotation.z = -1.4 * Math.sin(Math.PI * voo); u.bracoD.rotation.z = 1.4 * Math.sin(Math.PI * voo);
      } else if (nome === "calcanhar") {
        const w = janela(0.15, 0.48);
        u.pernaD.rotation.x = 0.5 * w;
        u.pernaD.rotation.z = -0.25 * w;
        u.pernaD.userData.joelho.rotation.x = 1.6 * w;
        u.corpo.rotation.x = 0.22 * w;
        u.cabeca.rotation.y = 0.6 * w;
      } else if (nome === "ombro") {
        const w = janela(0.12, 0.62);
        u.corpo.rotation.z = -0.25 * w;
        u.bracoD.rotation.z = 0.18 + 0.9 * w;
        u.cabeca.rotation.z = 0.3 * w;
        u.corpo.position.y += 0.1 * janela(0.58, 0.72);
      }
    },

    /* `quem`: 0 craque, 1 reforço. */
    posarCraque(L, m, quem, lado, estado) {
      const u = m.userData;
      this.zerarPose(m);
      u.corpo.position.y += Math.sin(this.t * 3 + L.k * 2 + quem) * 0.008;
      const b = L.bola.position;
      if (!lado) {
        if (quem === 0) this.posarToques(m, L.deco.salto, L.deco.salto.f, 0, 0.8, b.y);
        return;
      }
      const s = this.final;
      if (s) {
        const venceu = s.vencedor === (L.k === 0 ? this.timeA : this.timeB).id;
        const k = clamp((this.t - s.t0) / 0.5);
        if (venceu) {
          m.position.y = Math.abs(Math.sin(this.t * 6 + quem)) * 0.35 * k;
          u.bracoE.rotation.z = -2.7 * k + Math.sin(this.t * 12) * 0.2;
          u.bracoD.rotation.z = 2.7 * k - Math.sin(this.t * 12) * 0.2;
        } else {
          u.cabeca.rotation.x = 0.45 * k;
          u.corpo.rotation.x = 0.15 * k;
          u.bracoE.rotation.z = -0.05; u.bracoD.rotation.z = 0.05;
        }
        return;
      }
      if (lado.caida) {
        /* CAIU: mão na cabeça. */
        const k = clamp((estado.t - lado.caida) / 0.35);
        u.bracoE.rotation.z = -2.5 * k; u.bracoE.rotation.x = -0.9 * k;
        u.bracoD.rotation.z = 2.5 * k; u.bracoD.rotation.x = -0.9 * k;
        u.cabeca.rotation.x = 0.35 * k;
        u.corpo.rotation.x = -0.12 * k;
        return;
      }
      if (estado.fase !== "jogo") {
        if (quem === 0) {
          u.pernaD.rotation.x = -0.3;
          u.pernaD.userData.joelho.rotation.x = 0.35;
          u.bracoE.rotation.z = -0.3; u.bracoD.rotation.z = 0.3;
        }
        return;
      }
      const sal = lado.salto;
      const lento = estado.t < lado.lentoAte ? 2.6 : 1;
      const f = clamp(sal.f + estado.alfa * PASSO / (sal.T * lento), 0, 1);
      if (sal.truque && sal.j0 === quem) this.posarTruque(m, sal.truque, f);
      else this.posarToques(m, sal, f, quem, lado.folego, b.y);
    },

    posarLado(L, lado, estado, dt) {
      const base = L.k === 0 ? -1 : 1;
      const reforco = !!lado && estado.t < lado.reforcoAte && !this.final;
      const comBola = !!lado && (lado.salto.j0 === 1 || lado.salto.j1 === 1);
      L.entra = suave(L.entra, reforco || comBola ? 1 : 0, 4, dt);
      L.craque.position.set(L.x, 0, 0);
      L.craque.rotation.set(0, L.entra * 0.35 * base, 0);
      L.parceiro.visible = L.entra > 0.02;
      /* O reforço chega correndo de fora do quadro. */
      L.parceiro.position.set(L.x + base * lerp(3.5, X_REFORCO, curva(L.entra)), 0, -0.3);
      L.parceiro.rotation.set(0, -0.45 * base, 0);
      this.posarBola(L, lado, estado, dt);
      this.posarCraque(L, L.craque, 0, lado, estado);
      if (L.parceiro.visible) this.posarCraque(L, L.parceiro, 1, lado, estado);
      if (L.entra < 0.98 && L.parceiro.visible) L.parceiro.position.y = Math.abs(Math.sin(this.t * 12)) * 0.12 * (1 - L.entra);

      const b = L.bola.position;
      L.sombras.craque.position.set(L.craque.position.x, 0.012, 0.05);
      L.sombras.parceiro.position.set(L.parceiro.position.x, 0.012, -0.25);
      L.sombras.parceiro.visible = L.parceiro.visible;
      L.sombras.bola.position.set(b.x, 0.013, b.z);
      L.sombras.bola.scale.setScalar(clamp(1.2 - b.y * 0.15, 0.4, 1.2));
      L.sombras.bola.material.opacity = 1;
      this.efeitosDaBola(L, lado, estado, dt);
    },

    efeitosDaBola(L, lado, estado, dt) {
      const b = L.bola.position;
      const t = estado.t;
      const ativo = lado && !lado.caida && estado.fase === "jogo";
      const time = L.k === 0 ? this.timeA : this.timeB;
      const [c1] = time ? this.corDoTime(time.id) : [[1, 1, 1]];
      let aura = 0, corAura = c1, escala = 0.9;
      const emis = L.bola.material.emissive;
      emis.setRGB(0, 0, 0);
      if (ativo && t < lado.fogoAte) {
        aura = 1; corAura = [1, 0.55, 0.15]; escala = 1.3;
        emis.setRGB(0.5, 0.18, 0.02);
        for (let i = 0; i < (LEVE ? 1 : 3); i++) {
          (i % 2 ? this.p.brilho : this.p.chama).emitir({
            x: b.x + sorte(-0.06, 0.06), y: b.y + sorte(-0.05, 0.08), z: b.z + sorte(-0.06, 0.06),
            vx: sorte(-0.3, 0.3), vy: sorte(0.6, 1.6), vz: sorte(-0.2, 0.2),
            vida: sorte(0.25, 0.5), tam: sorte(0.28, 0.55), tamFim: 0.05,
            cor: [1, 0.62, 0.12], corFim: [0.85, 0.08, 0.02], arrasto: 1.2, grav: -1.5,
          });
        }
        if (Math.random() < 0.25) this.p.fumaca.emitir({
          x: b.x, y: b.y + 0.25, z: b.z, vx: sorte(-0.2, 0.2), vy: 0.8, vz: 0,
          vida: 1.1, tam: 0.4, tamFim: 1, cor: [0.25, 0.22, 0.22], alfa: 0.3, arrasto: 0.8,
        });
      } else if (ativo && t < lado.brilhoAte) {
        aura = 0.8; escala = 1;
        emis.setRGB(c1[0] * 0.35, c1[1] * 0.35, c1[2] * 0.35);
        const sis = this.p[{ estrela: "estrela", coracao: "coracao", raio: "raio" }[lado.forma] || "estrela"];
        if (Math.random() < (LEVE ? 0.5 : 0.9)) sis.emitir({
          x: b.x + sorte(-0.05, 0.05), y: b.y + sorte(-0.05, 0.05), z: b.z,
          vx: sorte(-0.2, 0.2), vy: sorte(-0.1, 0.3), vz: 0,
          vida: sorte(0.5, 0.9), tam: sorte(0.16, 0.26), tamFim: 0.03, cor: c1, corFim: [1, 1, 1], arrasto: 2,
        });
        this.p.brilho.emitir({ x: b.x, y: b.y, z: b.z, vida: 0.35, tam: 0.24, tamFim: 0.02, cor: c1, alfa: 0.7 });
      }
      if (ativo && t < lado.lentoAte) {
        aura = Math.max(aura, 0.7); if (aura === 0.7) corAura = [0.55, 0.85, 1];
        if (Math.random() < 0.5) this.p.brilho.emitir({ x: b.x, y: b.y, z: b.z, vida: 0.9, tam: 0.22, tamFim: 0.2, cor: [0.55, 0.85, 1], alfa: 0.35 });
      }
      if (ativo && t < lado.ventoAte && Math.random() < (LEVE ? 0.3 : 0.6)) {
        const a = this.t * 7;
        this.p.fumaca.emitir({
          x: b.x + Math.cos(a) * 0.5, y: b.y + sorte(-0.2, 0.3), z: b.z + Math.sin(a) * 0.5,
          vx: -Math.sin(a) * 2.5, vy: 0.3, vz: Math.cos(a) * 2.5,
          vida: 0.6, tam: 0.35, tamFim: 0.7, cor: [0.85, 0.92, 1], alfa: 0.3, arrasto: 1,
        });
      }
      const blindada = ativo && t < lado.blindadaAte;
      L.escudo.visible = blindada;
      if (blindada) {
        L.escudo.position.copy(b);
        L.escudo.material.uniforms.uForca.value = 0.8 + Math.sin(this.t * 7) * 0.2;
        aura = Math.max(aura, 0.6);
      }
      L.aura.position.copy(b);
      L.aura.material.opacity = aura * (0.75 + Math.sin(this.t * 8) * 0.25);
      L.aura.material.color.setRGB(...corAura);
      L.aura.scale.setScalar(escala);
      /* Gota de suor quando o fôlego está acabando. */
      const suando = ativo && lado.folego < 0.25;
      L.gota.material.opacity = suando ? 0.9 : 0;
      if (suando) {
        const c = (this.t * 1.1 + L.k * 0.5) % 1;
        L.gota.position.set(L.craque.position.x + 0.36, 2.0 - c * 0.5, 0.15);
      }
    },

    /* ───────────── quadro ───────────── */

    quadro(dt, agora, estado = {}) {
      if (!this.renderer) return;
      this.t += dt;
      this.U.uT.value = this.t;
      if (this.agenda.length) {
        const prontos = this.agenda.filter(x => x.em <= this.t);
        this.agenda = this.agenda.filter(x => x.em > this.t);
        for (const x of prontos) x.f();
      }
      const j = estado.jogo;
      const e = { fase: estado.fase, alfa: estado.alfa || 0, t: estado.t || 0 };
      this.lados.forEach((L, k) => {
        const time = k === 0 ? this.timeA : this.timeB;
        const lado = j && time ? j.lados[time.id] : null;
        this.posarLado(L, lado, e, dt);
      });
      this.animarTorcida(dt, j);
      this.animarFogos(dt);
      for (const s of this.sistemas) s.passo(dt);

      this.texPlaca.offset.x = (this.t * 0.05) % 1;
      this.texAnel.offset.x = (-this.t * 0.03) % 1;
      const respira = this.ociosa ? 0.85 + Math.sin(this.t * 1.4) * 0.15 : 1;
      for (const h of this.halos) h.material.opacity = (h.scale.x > 24 ? 0.22 : 0.95) * respira * (0.97 + Math.sin(this.t * 13 + h.id) * 0.03);
      this.matCone.uniforms.uForca.value = 0.05 * respira;
      this.flash = Math.max(0, this.flash - dt * 2.2);
      this.luzFesta.intensity = Math.max(0, this.luzFesta.intensity - dt * 6);
      this.renderer.toneMappingExposure = 1.05 + this.flash * 0.5;

      this.mexerCamera(dt);
      this.renderer.render(this.scene, this.camera);
    },

    /* Agito por setor: 0 sentado, 1 de pé, 2 pulando, 3 ola. A torcida
       levanta com a sequência do time e senta quando a bola cai. */
    animarTorcida(dt, j) {
      for (let s = 0; s < 2; s++) {
        const time = s === 0 ? this.timeA : this.timeB;
        const lado = j && time ? j.lados[time.id] : null;
        let alvo = 0.9 + (lado ? Math.min(1, lado.seq / 120) : 0) + this.extra[s];
        if (this.triste[s] > this.t) alvo = 0.15;
        if (this.final) alvo = this.final.vencedor === (time && time.id) ? 3.0 : 0.1;
        if (this.ociosa) alvo = 0.7 + Math.sin(this.t * 0.8 + s) * 0.3;
        this.agito[s] = suave(this.agito[s], alvo, alvo > this.agito[s] ? 6 : 2.5, dt);
        this.U.uAgito.value[s] = this.agito[s];
        this.extra[s] = Math.max(0, this.extra[s] - dt * 0.8);
      }
    },

    animarFogos(dt) {
      for (const f of this.foguetes) {
        if (f.em > this.t) continue;
        if (!f.subindo) { f.subindo = true; f.y = 2; }
        f.y += dt * 26;
        this.p.brilho.emitir({ x: f.x, y: f.y, z: f.z, vy: -2, vida: 0.35, tam: 0.5, tamFim: 0.05, cor: [1, 0.85, 0.5] });
        if (f.y >= f.alto) {
          f.feito = true;
          const n = LEVE ? 50 : 110;
          for (let i = 0; i < n; i++) {
            const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, v = sorte(7, 10);
            const r = Math.sqrt(1 - u * u);
            this.p.brilho.emitir({
              x: f.x, y: f.y, z: f.z, vx: r * Math.cos(a) * v, vy: u * v, vz: r * Math.sin(a) * v,
              vida: sorte(1.1, 1.8), tam: sorte(0.7, 1.1), tamFim: 0.1, cor: f.cor, corFim: [1, 0.5, 0.2], arrasto: 1.6, grav: 3,
            });
          }
        }
      }
      this.foguetes = this.foguetes.filter(f => !f.feito);
    },

    mexerCamera(dt) {
      const cam = this.camera, c = this.cam;
      /* Câmera baixa olhando pra cima: os craques descem pro terço de baixo,
         que no celular em pé ficava só grama. */
      const pos = V1.set(Math.sin(this.t * 0.21) * 0.3, 1.25, 6.3);
      const olhar = V2.set(0, 2.7, 0);
      let taxa = 2;
      /* Com reforço em campo a câmera recua pra caber o quarto jogador. */
      pos.z += Math.max(this.lados[0].entra, this.lados[1].entra) * 1.7;
      if (this.foco && this.foco.ate < this.t) this.foco = null;
      if (this.final) {
        const k = clamp((this.t - this.final.t0) / 2.5);
        pos.set(Math.sin(this.t * 0.25) * 0.8, lerp(1.25, 2.4, k), lerp(6.3, 8.4, k));
        olhar.set(0, lerp(2.7, 2.9, k), 0);
        taxa = 1.5;
      } else if (this.ociosa) {
        pos.set(Math.sin(this.t * 0.18) * 1.6, 2.0 + Math.sin(this.t * 0.11) * 0.3, 7.8);
        olhar.set(Math.sin(this.t * 0.18) * 0.5, 2.4, 0);
        taxa = 0.8;
      } else if (this.foco) {
        const x = this.lados[this.foco.k].x;
        pos.set(x * 0.6, 1.5, 5.4);
        olhar.set(x * 0.9, 2.0, 0);
        taxa = 2.5;
      }
      if (c.fov === 0) { c.pos.copy(pos); c.olhar.copy(olhar); c.fov = 1; }
      const a = 1 - Math.exp(-taxa * dt);
      c.pos.lerp(pos, a);
      c.olhar.lerp(olhar, a);
      this.soco = Math.max(0, this.soco - dt * 3);
      this.tremor = Math.max(0, this.tremor - dt * 0.9);
      cam.position.copy(c.pos);
      cam.position.z -= this.soco * 0.6;
      if (this.tremor > 0) {
        cam.position.x += (Math.random() - 0.5) * this.tremor * 0.2;
        cam.position.y += (Math.random() - 0.5) * this.tremor * 0.2;
      }
      cam.lookAt(c.olhar);
      const fovAlvo = this.fovBase * (1 - this.soco * 0.05);
      if (Math.abs(cam.fov - fovAlvo) > 0.01) { cam.fov = fovAlvo; cam.updateProjectionMatrix(); }
    },

    /* Onde aparece cada coisa de cada lado (px do palco): a bola, a cabeça,
       o pé e o topo onde fica o contador. */
    rotulos(saida) {
      const proj = (v, o) => {
        V3.copy(v).project(this.camera);
        o.x = (V3.x * 0.5 + 0.5) * this.W;
        o.y = (-V3.y * 0.5 + 0.5) * this.H;
        return o;
      };
      this.lados.forEach((L, k) => {
        const o = saida[k] || (saida[k] = { bola: {}, cabeca: {}, pe: {}, topo: {}, parceiro: {} });
        proj(L.bola.position, o.bola);
        proj(V4.set(L.craque.position.x, 2.3, 0), o.cabeca);
        proj(V4.set(L.craque.position.x, -0.05, 0.2), o.pe);
        proj(V4.set(L.craque.position.x, 4.9, 0), o.topo);
        proj(V4.set(L.parceiro.position.x, 2.4, L.parceiro.position.z), o.parceiro);
        o.parceiroVisivel = L.parceiro.visible && L.entra > 0.6;
      });
      return saida;
    },
  };
})();
