/* O pênalti em 3D (three.js): gramado, gol com rede que estufa, arquibancada
   atrás do gol (metade de cada time, a multidão da Torcida), refletores,
   placas de LED, o batedor e o goleiro articulados, a bola e os efeitos.

   Medidas em metros: linha do gol em z = 0 (gol de 7,32 × 2,44), marca do
   pênalti em z = 11, câmera em +z atrás do batedor. Cada cobrança é uma
   função do tempo desde o chute (`posarLance(τ)`): o replay do gol de placa
   é só tocar de novo o mesmo trecho mais devagar, de outro ângulo. */
"use strict";

const Cena = (() => {
  const LEVE = new URLSearchParams(location.search).get("leve") === "1";
  const GOL_X = 3.66, GOL_Y = 2.44, FUNDO_REDE = 2.0;
  const MARCA = 11;
  const GOLEIRO_Z = 0.35;
  const CONTATO = 0.42;
  const CHEGADA = { normal: 0.5, fogo: 0.36, cavadinha: 0.8 };
  const LENTO = 0.45;
  const BOLA = 0.16;
  const CORES_GOLEIRO = ["#39ff6a", "#ff7a1a", "#ff3fa4", "#18e0ff", "#ffe014", "#9b5cff"];

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
    rede() {
      const [c, g] = canvas(64, 64);
      g.strokeStyle = "rgba(255,255,255,.9)";
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(32, 0); g.lineTo(64, 32); g.lineTo(32, 64); g.lineTo(0, 32); g.closePath();
      g.stroke();
      return textura(c, { cor: false, repetir: true });
    },
    /* Gramado perto do gol: faixas de corte, ruído e as linhas da área.
       Cobre x de -32 a 32 e z de -8 a 40. */
    gramado() {
      const W = LEVE ? 1024 : 2048, H = Math.round(W * 48 / 64);
      const [c, g] = canvas(W, H);
      const px = x => (x + 32) / 64 * W, pz = z => (z + 8) / 48 * H, m = W / 64;
      for (let z = -8, i = 0; z < 40; z += 4.5, i++) {
        g.fillStyle = i % 2 ? "#2f8a3a" : "#3a9c44";
        g.fillRect(0, pz(z), W, 4.5 * m + 1);
      }
      for (let k = 0; k < (LEVE ? 9000 : 32000); k++) {
        const x = Math.random() * W, y = Math.random() * H;
        g.fillStyle = Math.random() < 0.5 ? "rgba(15,60,20,.22)" : "rgba(160,230,140,.12)";
        g.fillRect(x, y, 1 + Math.random() * 2, 2 + Math.random() * 4);
      }
      const v = g.createRadialGradient(px(0), pz(4), 0, px(0), pz(4), W * 0.7);
      v.addColorStop(0, "rgba(255,255,230,.10)");
      v.addColorStop(1, "rgba(0,10,20,.35)");
      g.fillStyle = v;
      g.fillRect(0, 0, W, H);
      g.strokeStyle = "rgba(250,252,255,.95)";
      g.lineWidth = 0.12 * m;
      g.lineCap = "round";
      const ret = (x0, z0, x1, z1) => g.strokeRect(px(x0), pz(z0), px(x1) - px(x0), pz(z1) - pz(z0));
      g.beginPath(); g.moveTo(0, pz(0)); g.lineTo(W, pz(0)); g.stroke();
      ret(-20.16, 0, 20.16, 16.5);
      ret(-9.16, 0, 9.16, 5.5);
      g.beginPath();
      const a = Math.acos(5.5 / 9.15);
      g.ellipse(px(0), pz(MARCA), 9.15 * m, 9.15 * m * (H / 48) / (W / 64), 0, Math.PI / 2 - a, Math.PI / 2 + a);
      g.stroke();
      g.fillStyle = "#fff";
      g.beginPath(); g.arc(px(0), pz(MARCA), 0.14 * m, 0, Math.PI * 2); g.fill();
      return textura(c);
    },
    placa(textoA, textoB, corA, corB) {
      const [c, g] = canvas(2048, 64);
      const blocos = [[textoA, corA], ["PÊNALTIS DA LIVE", "#ffd23a"], [textoB, corB], ["★", "#ffffff"]];
      let x = 0, k = 0;
      g.fillStyle = "#06070d";
      g.fillRect(0, 0, 2048, 64);
      g.font = '900 46px "Lilita One", "Arial Black", sans-serif';
      g.textBaseline = "middle";
      while (x < 2048) {
        const [t, cor] = blocos[k++ % blocos.length];
        const w = g.measureText(t).width + 70;
        g.fillStyle = cor;
        g.fillText(t, x + 35, 34);
        x += w;
      }
      g.fillStyle = "rgba(0,0,0,.35)";
      for (let y = 0; y < 64; y += 4) g.fillRect(0, y, 2048, 1);
      const t = textura(c, { repetir: true });
      t.wrapT = THREE.ClampToEdgeWrapping;
      return t;
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
    lance: null,
    prep: null,
    flash: 0,
    soco: 0,
    tremor: 0,
    ociosa: false,
    final: null,

    montar(canvas, cfg) {
      this.cfg = cfg;
      this.canvas = canvas;
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !LEVE, powerPreference: "high-performance" });
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.05;
      this.scene = new THREE.Scene();
      this.scene.fog = new THREE.Fog(0x0b1030, 45, 140);
      this.camera = new THREE.PerspectiveCamera(50, 9 / 16, 0.1, 600);
      this.hfov = 25;

      this.tex = {
        brilho: Tex.brilho(), estrela: Tex.estrela(), coracao: Tex.coracao(),
        papel: Tex.papel(), fumaca: Tex.fumaca(), sombra: Tex.sombra(),
      };
      this.U = {
        uT: { value: 0 },
        uAgito: { value: new Array(12).fill(0.6) },
        uOla: { value: new Array(12).fill(0) },
        uOlaG: { value: new THREE.Vector2(0, 0) },
      };
      this.agito = [0.8, 0.8, 0.5];
      this.extra = [0, 0, 0];
      this.comemora = [0, 0];
      this.agenda = [];

      this.montarLuz();
      this.montarCeu();
      this.montarGramado();
      this.montarGol();
      this.montarArquibancada();
      this.montarRefletores();
      this.montarJogadores();
      this.montarEfeitos();

      this.cam = { pos: new THREE.Vector3(0, 3.4, 20.5), olhar: new THREE.Vector3(0, 1.05, 0), fov: 0 };
      const [a, b] = cfg.times;
      this.classico(a, b);
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
      /* A largura do gol manda: celular mais comprido ganha céu e gramado,
         o gol fica do mesmo tamanho. */
      const v = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(this.hfov) / 2) / this.camera.aspect);
      this.fovBase = THREE.MathUtils.radToDeg(v);
      this.camera.fov = this.fovBase;
      this.camera.updateProjectionMatrix();
      for (const p of this.sistemas) p.material.uniforms.uEscala.value = larg * 0.9;
    },

    /* ───────────── montagem ───────────── */

    montarLuz() {
      this.hemi = new THREE.HemisphereLight(0x9fb0ff, 0x1d3020, 1.25);
      this.scene.add(this.hemi);
      this.luzFrente = new THREE.DirectionalLight(0xfff1dc, 2.2);
      this.luzFrente.position.set(7, 16, 24);
      this.scene.add(this.luzFrente);
      this.luzFundo = new THREE.DirectionalLight(0xbcd0ff, 1.5);
      this.luzFundo.position.set(-10, 14, -22);
      this.scene.add(this.luzFundo);
      this.luzGol = new THREE.PointLight(0xffd27a, 0, 14, 1.6);
      this.luzGol.position.set(0, 1.6, -0.5);
      this.scene.add(this.luzGol);
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
        const a = Math.random() * Math.PI - Math.PI, h = 0.25 + Math.random() * 0.7;
        p.set([Math.cos(a) * 300 * Math.cos(h), Math.sin(h) * 300, Math.sin(a) * 300 * Math.cos(h)], i * 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(p, 3));
      this.estrelas = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xcad6ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 }));
      this.scene.add(this.estrelas);
    },

    montarGramado() {
      const tex = Tex.gramado();
      const perto = new THREE.Mesh(new THREE.PlaneGeometry(64, 48), new THREE.MeshLambertMaterial({ map: tex }));
      perto.rotation.x = -Math.PI / 2;
      perto.position.set(0, 0, 16);
      this.scene.add(perto);
      const longe = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: 0x2c7a35 }));
      longe.rotation.x = -Math.PI / 2;
      longe.position.y = -0.02;
      this.scene.add(longe);
      const pista = new THREE.Mesh(new THREE.PlaneGeometry(90, 6), new THREE.MeshLambertMaterial({ color: 0x23283a }));
      pista.rotation.x = -Math.PI / 2;
      pista.position.set(0, 0.01, -9.5);
      this.scene.add(pista);
    },

    montarGol() {
      const g = new THREE.Group();
      const trave = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x3a3a3a });
      const r = 0.065;
      const poste = new THREE.CylinderGeometry(r, r, GOL_Y, 16);
      for (const lado of [-1, 1]) {
        const p = new THREE.Mesh(poste, trave);
        p.position.set(lado * GOL_X, GOL_Y / 2, 0);
        g.add(p);
      }
      const travessao = new THREE.Mesh(new THREE.CylinderGeometry(r, r, GOL_X * 2 + r * 2, 16), trave);
      travessao.rotation.z = Math.PI / 2;
      travessao.position.set(0, GOL_Y, 0);
      g.add(travessao);
      this.traves = [g.children[0], g.children[1], travessao];

      const fio = new THREE.MeshLambertMaterial({ color: 0x9aa0aa });
      const fino = 0.025;
      for (const lado of [-1, 1]) {
        const tras = new THREE.Mesh(new THREE.CylinderGeometry(fino, fino, 2.0, 6), fio);
        tras.position.set(lado * GOL_X, 1.0, -FUNDO_REDE);
        g.add(tras);
        const cima = new THREE.Mesh(new THREE.CylinderGeometry(fino, fino, FUNDO_REDE + 0.2, 6), fio);
        cima.rotation.x = Math.atan2(FUNDO_REDE, GOL_Y - 2.0) - Math.PI / 2;
        cima.position.set(lado * GOL_X, (GOL_Y + 2.0) / 2, -FUNDO_REDE / 2);
        g.add(cima);
      }

      const texRede = Tex.rede();
      const matRede = (rx, ry) => {
        const t = texRede.clone();
        t.needsUpdate = true;
        t.repeat.set(rx, ry);
        return new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false, fog: true });
      };
      const sx = LEVE ? 20 : 34, sy = LEVE ? 8 : 14;
      const fundo = new THREE.PlaneGeometry(GOL_X * 2, 2.0, sx, sy);
      this.redeFundo = new THREE.Mesh(fundo, matRede(GOL_X * 2 / 0.16, 2 / 0.16));
      this.redeFundo.position.set(0, 1.0, -FUNDO_REDE);
      this.redeBase = Float32Array.from(fundo.attributes.position.array);
      g.add(this.redeFundo);
      const teto = new THREE.Mesh(new THREE.PlaneGeometry(GOL_X * 2, Math.hypot(FUNDO_REDE, GOL_Y - 2.0)), matRede(GOL_X * 2 / 0.16, 13));
      teto.rotation.x = -Math.PI / 2 + Math.atan2(GOL_Y - 2.0, FUNDO_REDE);
      teto.position.set(0, (GOL_Y + 2.0) / 2, -FUNDO_REDE / 2);
      g.add(teto);
      for (const lado of [-1, 1]) {
        const forma = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(FUNDO_REDE, 0), new THREE.Vector2(FUNDO_REDE, 2.0), new THREE.Vector2(0, GOL_Y)]);
        const geo = new THREE.ShapeGeometry(forma);
        const uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, geo.attributes.position.getX(i) / 0.16, geo.attributes.position.getY(i) / 0.16);
        const t = texRede.clone();
        t.needsUpdate = true;
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
        m.rotation.y = Math.PI / 2;
        m.position.set(lado * GOL_X, 0, 0);
        g.add(m);
      }
      this.scene.add(g);
      this.estufa = { forca: 0, x: 0, y: 1, t: 9 };
    },

    /* Degraus atrás do gol, a multidão por cima e o corredor no meio que
       separa as torcidas. Setor 0 = time A (esquerda), 1 = time B. */
    montarArquibancada() {
      const filas = LEVE ? 8 : 11;
      const passo = LEVE ? 0.82 : 0.66;
      const largura = 30;
      this.filas = filas;
      const concreto = new THREE.MeshLambertMaterial({ color: 0x2b3047 });
      const borda = new THREE.MeshLambertMaterial({ color: 0x3a4060 });
      const y0 = 1.3, z0 = -13.2, dy = 0.72, dz = 0.92;
      for (let f = 0; f < filas; f++) {
        const degrau = new THREE.Mesh(new THREE.BoxGeometry(largura * 2, dy, dz), f % 2 ? concreto : borda);
        degrau.position.set(0, y0 + f * dy - dy / 2, z0 - f * dz);
        this.scene.add(degrau);
        const parede = new THREE.Mesh(new THREE.BoxGeometry(largura * 2, y0 + f * dy, 0.1), concreto);
        parede.position.set(0, (y0 + f * dy) / 2, z0 - f * dz + dz / 2);
        if (f === 0) this.scene.add(parede);
      }
      const fundo = new THREE.Mesh(new THREE.BoxGeometry(largura * 2, 3, 1), new THREE.MeshLambertMaterial({ color: 0x151a2c }));
      fundo.position.set(0, y0 + filas * dy + 0.7, z0 - filas * dz - 0.4);
      this.scene.add(fundo);

      /* Faixa de LED na frente do anel superior. */
      this.texAnel = Tex.placa("", "", "#fff", "#fff");
      const anel = new THREE.Mesh(new THREE.PlaneGeometry(largura * 2, 1.1), new THREE.MeshBasicMaterial({ map: this.texAnel, toneMapped: false }));
      anel.position.set(0, y0 + filas * dy + 0.2, z0 - filas * dz + 0.15);
      this.scene.add(anel);
      this.texAnel.repeat.set(3, 1);

      const corredor = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, filas * dz + 1), new THREE.MeshLambertMaterial({ color: 0x8a90a8 }));
      corredor.position.set(0, y0 + (filas * dy) / 2 - 0.4, z0 - (filas * dz) / 2 + 0.4);
      corredor.rotation.x = Math.atan2(dy, dz);
      this.scene.add(corredor);

      /* Rosto e malha redonda não aparecem a essa distância e triplicavam a
         torcida (1,1 mi de triângulos): o torcedor simples serve nos dois modos. */
      const geo = Personagens.malhaTorcedor({ leve: true });
      this.matTorcida = Personagens.material(this.U);
      /* Nenhuma câmera (nem a que passeia) vê além de |x| = 16 na arquibancada:
         torcedor fora disso só gastava triângulo. */
      const visivel = 17;
      const lugares = [];
      for (let f = 0; f < filas; f++) {
        for (let x = -visivel + 0.5; x <= visivel - 0.5; x += passo) {
          if (Math.abs(x) < 1.25) continue;
          lugares.push({ x: x + sorte(-0.08, 0.08), y: y0 + f * dy, z: z0 - f * dz + 0.05, f });
        }
      }
      this.multidao = new Personagens.Multidao(lugares.length, geo, this.matTorcida);
      this.torcedores = lugares.map((l, i) => {
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
        const geoB = new THREE.PlaneGeometry(6, 2.8, 24, 10);
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
        b.position.set(lado * 5.2, y0 + 7 * dy + 0.9, z0 - 7 * dz + 1.4);
        b.rotation.x = -0.32;
        this.scene.add(b);
        this.bandeiras.push(b);
      }

      /* Placas de LED atrás do gol: a textura corre pelo offset. */
      this.texPlaca = Tex.placa("", "", "#fff", "#fff");
      this.texPlaca.repeat.set(1.6, 1);
      const placas = new THREE.Mesh(new THREE.BoxGeometry(56, 0.95, 0.12), [
        new THREE.MeshLambertMaterial({ color: 0x0a0b12 }), new THREE.MeshLambertMaterial({ color: 0x0a0b12 }),
        new THREE.MeshLambertMaterial({ color: 0x0a0b12 }), new THREE.MeshLambertMaterial({ color: 0x0a0b12 }),
        new THREE.MeshBasicMaterial({ map: this.texPlaca, toneMapped: false }), new THREE.MeshLambertMaterial({ color: 0x0a0b12 }),
      ]);
      placas.position.set(0, 0.48, -4.6);
      this.scene.add(placas);
      this.placas = placas;
    },

    /* Duas torres de refletor com halo aditivo e o cone de luz descendo. */
    montarRefletores() {
      this.halos = [];
      const halo = new THREE.SpriteMaterial({ map: this.tex.brilho, color: 0xfff4dc, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
      const lampada = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, fog: false });
      const cone = new THREE.ShaderMaterial({
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
      this.matCone = cone;
      for (const lado of [-1, 1]) {
        const torre = new THREE.Group();
        torre.position.set(lado * 9.5, 13.2, -31);
        const painel = new THREE.Mesh(new THREE.BoxGeometry(6.2, 3.2, 0.4), new THREE.MeshLambertMaterial({ color: 0x1b1f2e }));
        torre.add(painel);
        for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
          const l = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16), lampada);
          l.position.set(-2.25 + i * 1.5, -1 + j, 0.21);
          torre.add(l);
        }
        const s = new THREE.Sprite(halo);
        s.scale.set(22, 16, 1);
        s.position.z = 1;
        torre.add(s);
        this.halos.push(s);
        const s2 = new THREE.Sprite(halo.clone());
        s2.material.opacity = 0.2;
        s2.scale.set(26, 6, 1);
        s2.position.z = 1.2;
        torre.add(s2);
        this.halos.push(s2);
        torre.lookAt(0, 0, 8);
        this.scene.add(torre);
        const de = torre.position.clone(), para = new THREE.Vector3(lado * 3, 0, 3);
        const c = new THREE.Mesh(new THREE.ConeGeometry(7, de.distanceTo(para), 24, 1, true), cone);
        c.position.copy(de).lerp(para, 0.5);
        c.lookAt(para);
        c.rotateX(-Math.PI / 2);
        this.scene.add(c);
      }
    },

    montarJogadores() {
      this.batedorM = Personagens.jogador({ leve: LEVE });
      this.goleiroM = Personagens.jogador({ leve: LEVE });
      this.scene.add(this.batedorM, this.goleiroM);
      this.bola = new THREE.Mesh(new THREE.SphereGeometry(BOLA, 24, 16), new THREE.MeshLambertMaterial({ map: Tex.bola() }));
      this.scene.add(this.bola);
      const sombra = new THREE.MeshBasicMaterial({ map: this.tex.sombra, transparent: true, depthWrite: false });
      const disco = (r) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(r, r), sombra);
        m.rotation.x = -Math.PI / 2;
        m.position.y = 0.012;
        this.scene.add(m);
        return m;
      };
      this.sombras = { batedor: disco(1.3), goleiro: disco(1.5), bola: disco(0.4) };
      this.aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.brilho, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
      this.aura.scale.set(1.1, 1.1, 1);
      this.scene.add(this.aura);
      this.estrelaCraque = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.estrela, color: 0xffd23a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
      this.estrelaCraque.scale.set(0.55, 0.55, 1);
      this.scene.add(this.estrelaCraque);
      this.gota = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0x8fd8ff, transparent: true, opacity: 0 }));
      this.gota.scale.y = 1.4;
      this.scene.add(this.gota);
      this.auraGoleiro = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.brilho, color: 0xffcf3a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
      this.auraGoleiro.scale.set(4, 4, 1);
      this.scene.add(this.auraGoleiro);
      this.posarParado();
    },

    montarEfeitos() {
      const n = LEVE ? 0.5 : 1;
      this.p = {
        brilho: new Particulas(Math.round(1400 * n), this.tex.brilho, true),
        estrela: new Particulas(Math.round(300 * n), this.tex.estrela, true),
        coracao: new Particulas(Math.round(200 * n), this.tex.coracao, true),
        papel: new Particulas(Math.round(900 * n), this.tex.papel, false),
        fumaca: new Particulas(Math.round(300 * n), this.tex.fumaca, false),
        chama: new Particulas(Math.round(500 * n), this.tex.brilho, false),
      };
      this.sistemas = Object.values(this.p);
      for (const s of this.sistemas) this.scene.add(s.pontos);
      this.foguetes = [];
    },

    /* ───────────── API do jogo ───────────── */

    classico(a, b) {
      if (!a || !b || !this.pronta && !this.multidao) return;
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
      const novo = Tex.placa(a.nome.toUpperCase(), b.nome.toUpperCase(), a.cor === "#f4f4f4" ? a.cor2 === "#111111" ? "#ffffff" : a.cor2 : a.cor, b.cor === "#f4f4f4" ? b.cor2 === "#111111" ? "#ffffff" : b.cor2 : b.cor);
      for (const [alvo, rep] of [["texPlaca", 1.6], ["texAnel", 3]]) {
        const velho = this[alvo];
        const t = novo.clone();
        t.needsUpdate = true;
        t.wrapS = THREE.RepeatWrapping;
        t.repeat.set(rep, 1);
        if (alvo === "texPlaca") this.placas.material[4].map = t;
        else this.scene.traverse(o => { if (o.material && o.material.map === velho) o.material.map = t; });
        velho.dispose();
        this[alvo] = t;
      }
      this.final = null;
      this.comemora = [0, 0];
      this.lance = null;
      this.prep = null;
      this.posarParado();
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
      return [rgb(t.cor), rgb(t.cor2)];
    },

    /* Uniforme do goleiro: a cor viva mais longe das cores do time que ele defende. */
    corGoleiro(time) {
      const c1 = new THREE.Color(time.cor), c2 = new THREE.Color(time.cor2);
      let melhor = CORES_GOLEIRO[0], dist = -1;
      for (const h of CORES_GOLEIRO) {
        const c = new THREE.Color(h);
        const d = Math.min(Math.hypot(c.r - c1.r, c.g - c1.g, c.b - c1.b), Math.hypot(c.r - c2.r, c.g - c2.g, c.b - c2.b));
        if (d > dist) { dist = d; melhor = h; }
      }
      return melhor;
    },

    batedor(ev) {
      if (!ev) return;
      const time = this.time(ev.time) || this.cfg.times.find(t => t.id === ev.time) || this.timeA;
      const rival = this.time(ev.rival) || this.cfg.times.find(t => t.id === ev.rival) || this.timeB;
      if (!time || !rival) return;
      const b = ev.batedor || {};
      const efeito = ev.efeito ? ev.efeito.efeito || ev.efeito : null;
      const pele = Personagens.PELES[Math.floor(Math.random() * Personagens.PELES.length)];
      const cabelo = Personagens.CABELOS[Math.floor(Math.random() * Personagens.CABELOS.length)];
      const kits = uniformes(this.timeA || time, this.timeB || rival);
      const kit = this.timeB && time.id === this.timeB.id ? kits[1] : kits[0];
      this.batedorM.userData.vestir({
        cor1: kit.cor, cor2: kit.cor2, padrao: kit.padrao, calcao: kit.calcao,
        nome: String(b.nome || "").replace(/^@/, "").slice(0, 12), numero: b.numero ?? 10, pele, cabelo,
      });
      const corG = this.corGoleiro(rival);
      this.goleiroM.userData.vestir({
        cor1: corG, cor2: "#151515", padrao: "liso", calcao: "#151515", nome: "", numero: "", goleiro: true,
        pele: Personagens.PELES[Math.floor(Math.random() * Personagens.PELES.length)], cabelo: Personagens.CABELOS[1],
        luva: "#ffffff",
      });
      this.goleiroM.userData.mat.manga.color.set(corG);
      const variante = ["brilho", "estrela", "coracao"][Math.floor(Math.random() * 3)];
      const paleta = [[1, 0.85, 0.2], [0.3, 0.9, 1], [1, 0.35, 0.75], [0.55, 1, 0.4], [0.75, 0.5, 1]];
      this.prep = {
        t0: this.t, time: time.id, rival: rival.id, efeito, craque: !!b.craque,
        variante, corBrilho: paleta[Math.floor(Math.random() * paleta.length)],
        nervoso: this.nervosoContra === time.id, paredao: false,
      };
      this.lance = null;
      this.final = null;
      this.redeReset();
      this.bola.visible = true;
    },

    /* Contra quem o goleiro está nervoso (o time que encheu a pressão). */
    nervoso(timeId) {
      this.nervosoContra = timeId;
      if (this.prep && this.prep.time === timeId) this.prep.nervoso = true;
    },

    /* Duração do voo da bola. O gol de placa voa rápido, mas em câmera
       lenta (LENTO), então chega mais tarde no relógio. */
    voo(ev) {
      if (ev.cavadinha) return CHEGADA.cavadinha;
      return ev.efeito === "fogo" || ev.efeito === "placa" ? CHEGADA.fogo : CHEGADA.normal;
    },

    tempoAteOResultado(ev) {
      if (!ev) return CONTATO + CHEGADA.normal;
      const voo = this.voo(ev);
      return CONTATO + (ev.efeito === "placa" ? voo / LENTO : voo);
    },

    /* Relógio real → tempo do lance (τ), com a câmera lenta do gol de placa. */
    tauDe(L, real) {
      if (L.efeito !== "placa" || real <= CONTATO) return real;
      const lento = L.voo / LENTO;
      if (real < CONTATO + lento) return CONTATO + (real - CONTATO) * LENTO;
      return real - lento + L.voo;
    },

    chute(ev) {
      if (!ev) return;
      if (!this.prep) {
        this.batedor({ time: ev.time, rival: ev.rival, batedor: ev.batedor || {}, efeito: ev.efeito ? { efeito: ev.efeito } : null });
        if (!this.prep) return;
      }
      const alvo = ev.alvo || { col: 0, lin: 0 };
      const mergulho = ev.mergulho || { col: 0, lin: 0 };
      const efeito = ev.efeito || null;
      const r = ev.resultado || "gol";
      const lateral = alvo.col * 2.7 + sorte(-0.2, 0.2);
      const altura = alvo.lin ? 1.85 + sorte(-0.1, 0.12) : 0.42 + sorte(-0.08, 0.1);
      let fim;
      if (r === "trave") {
        fim = alvo.col === 0 || (alvo.lin && Math.random() < 0.5)
          ? new THREE.Vector3(alvo.col * 1.6 + sorte(-0.4, 0.4), GOL_Y - 0.02, 0)
          : new THREE.Vector3(Math.sign(alvo.col) * (GOL_X - 0.03), altura, 0);
      } else if (r === "fora") {
        fim = alvo.col === 0 || alvo.lin
          ? new THREE.Vector3(alvo.col * 2.2 + sorte(-0.6, 0.6), GOL_Y + 0.9 + Math.random() * 0.8, 0)
          : new THREE.Vector3(Math.sign(alvo.col) * (GOL_X + 0.7 + Math.random() * 0.6), altura, 0);
      } else if (r === "defesa") {
        fim = new THREE.Vector3(mergulho.col === alvo.col ? lateral * 0.88 : lateral, altura, GOLEIRO_Z + 0.1);
      } else fim = new THREE.Vector3(lateral, altura, 0);
      const voo = this.voo(ev);
      this.lance = {
        t0: this.t, r, alvo, mergulho, efeito, fim, voo, cavadinha: !!ev.cavadinha,
        frango: !!ev.frango, paredao: !!ev.paredao, nervoso: !!ev.nervoso || this.prep.nervoso,
        curva: efeito === "curva" ? (alvo.col === 0 ? (Math.random() < 0.5 ? -1 : 1) : -alvo.col) * 1.3 : 0,
        rebote: new THREE.Vector3(sorte(-1, 1) * 2 + Math.sign(fim.x || 1) * 3, 2.6 + Math.random() * 1.6, r === "defesa" ? 4 + Math.random() * 3 : 6 + Math.random() * 3),
        time: this.prep.time, rival: this.prep.rival, chegou: false, replay: null,
      };
      this.prep.paredao = this.lance.paredao;
      this.nervosoContra = null;
    },

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
        const longe = sorte(4, 13);
        this.p.papel.emitir({
          x: cam.x + sorte(-0.45, 0.45) * longe, y: cam.y + sorte(0.1, 0.5) * longe, z: cam.z - longe,
          vx: sorte(-1, 1), vy: sorte(-0.5, 2), vz: sorte(-0.5, 0.5),
          vida: sorte(2.8, 4.5), tam: sorte(0.22, 0.36), cor, arrasto: 1.4, grav: 1.6,
        });
      }
    },

    fogos(n = 3) {
      for (let i = 0; i < n; i++) {
        this.foguetes.push({
          em: this.t + i * 0.35 + Math.random() * 0.2,
          x: sorte(-14, 14), z: sorte(-26, -12), y: 0, alto: sorte(16, 26),
          cor: [rgb("#ffd23a"), rgb("#ff4a6a"), rgb("#4ad8ff"), rgb("#9bff6a"), rgb("#ffffff")][Math.floor(Math.random() * 5)],
          subindo: false,
        });
      }
    },

    fim(ev) {
      if (!ev) return;
      this.final = { t0: this.t, vencedor: ev.vencedor, perdedor: ev.perdedor };
      this.fogos(LEVE ? 6 : 10);
      this.confete(ev.vencedor, LEVE ? 120 : 220);
      for (let i = 1; i < 4; i++) this.agenda.push({ em: this.t + i * 1.6, f: () => { this.fogos(LEVE ? 3 : 5); this.confete(ev.vencedor, LEVE ? 50 : 90); } });
    },

    ocioso(ligado) { this.ociosa = !!ligado; },

    /* ───────────── poses ───────────── */

    /* Zera as juntas de um jogador; cada pose só mexe no que precisa. */
    juntas(m) {
      const j = m.userData;
      for (const k of ["corpo", "cabeca", "bracoE", "bracoD", "pernaE", "pernaD"]) j[k].rotation.set(0, 0, 0);
      j.corpo.position.set(0, 0.74, 0);
      j.cabeca.position.set(0, 1.0, 0);
      m.rotation.set(0, 0, 0);
      m.scale.setScalar(m === this.goleiroM ? 1.15 : 1);
      return j;
    },

    posarParado() {
      const b = this.juntas(this.batedorM);
      this.batedorM.position.set(-0.9, 0, MARCA + 1.9);
      this.batedorM.rotation.y = Math.PI + 0.35;
      b.bracoE.rotation.z = -0.15; b.bracoD.rotation.z = 0.15;
      const g = this.juntas(this.goleiroM);
      this.goleiroM.position.set(0, 0, GOLEIRO_Z);
      g.bracoE.rotation.z = -0.7; g.bracoD.rotation.z = 0.7;
      this.bola.position.set(0, BOLA, MARCA);
    },

    corrida(j, fase, forca = 1) {
      const s = Math.sin(fase);
      j.pernaE.rotation.x = s * 0.9 * forca;
      j.pernaD.rotation.x = -s * 0.9 * forca;
      j.bracoE.rotation.x = -s * 0.8 * forca;
      j.bracoD.rotation.x = s * 0.8 * forca;
      j.bracoE.rotation.z = -0.2; j.bracoD.rotation.z = 0.2;
      j.corpo.position.y = 0.74 + Math.abs(Math.cos(fase)) * 0.07 * forca;
      j.corpo.rotation.x = 0.18 * forca;
    },

    /* Preparação: entra pela esquerda, ajeita a bola, recua e espera o apito. */
    posarPreparo(dt) {
      const p = this.prep;
      const dur = this.cfg.tempos.prepara;
      const t = this.t - p.t0;
      const m = this.batedorM, j = this.juntas(m);
      const inicio = new THREE.Vector3(-2.4, 0, MARCA + 4.2);
      const bola = new THREE.Vector3(-0.15, 0, MARCA + 0.55);
      const recuo = new THREE.Vector3(-0.9, 0, MARCA + 1.9);
      const a = Math.min(1.1, dur * 0.32), b = a + Math.min(0.7, dur * 0.2), c = b + Math.min(0.9, dur * 0.26);
      if (t < a) {
        const k = curva(t / a);
        m.position.lerpVectors(inicio, bola, k);
        m.rotation.y = Math.atan2(bola.x - inicio.x, bola.z - inicio.z);
        this.corrida(j, t * 11, 0.6);
      } else if (t < b) {
        m.position.copy(bola);
        m.rotation.y = Math.PI;
        const k = Math.sin(clamp((t - a) / (b - a)) * Math.PI);
        j.corpo.rotation.x = 0.9 * k;
        j.corpo.position.y = 0.74 - 0.18 * k;
        j.bracoD.rotation.x = -1.1 * k;
        j.bracoE.rotation.x = -0.9 * k;
        j.pernaE.rotation.x = 0.5 * k; j.pernaD.rotation.x = -0.25 * k;
      } else if (t < c) {
        const k = curva((t - b) / (c - b));
        m.position.lerpVectors(bola, recuo, k);
        m.rotation.y = Math.PI + 0.35 * k;
        this.corrida(j, -t * 9, 0.4);
      } else {
        m.position.copy(recuo);
        m.rotation.y = Math.PI + 0.35;
        const r = Math.sin(this.t * 2.2);
        j.corpo.rotation.x = 0.12 + r * 0.03;
        j.corpo.position.y = 0.74 + r * 0.015;
        j.bracoE.rotation.z = -0.25; j.bracoD.rotation.z = 0.25;
        j.cabeca.rotation.x = -0.1;
      }
      this.bola.position.set(0, BOLA, MARCA);
      this.bola.rotation.set(0, this.t * 0.2, 0);
      this.posarGoleiroEspera(p);
    },

    posarGoleiroEspera(p) {
      const m = this.goleiroM, j = this.juntas(m);
      const paredao = p && p.paredao;
      const s = Math.sin(this.t * 2.6);
      m.position.set(s * 0.45, 0, GOLEIRO_Z);
      j.corpo.rotation.x = 0.25;
      j.corpo.position.y = 0.6;
      j.pernaE.rotation.z = -0.25; j.pernaD.rotation.z = 0.25;
      j.pernaE.rotation.x = 0.35; j.pernaD.rotation.x = 0.35;
      j.bracoE.rotation.z = -1.0 - Math.abs(s) * 0.25;
      j.bracoD.rotation.z = 1.0 + Math.abs(s) * 0.25;
      j.corpo.position.y += Math.abs(Math.cos(this.t * 5.2)) * 0.05;
      if (p && p.efeito === "frango") {
        j.corpo.rotation.z = Math.sin(this.t * 3.3) * 0.18;
        j.cabeca.rotation.z = Math.sin(this.t * 2.1) * 0.25;
        j.bracoE.rotation.z = -0.5 + Math.sin(this.t * 7) * 0.4;
      }
      if (p && p.nervoso) {
        m.position.x += Math.sin(this.t * 61) * 0.035;
        j.cabeca.rotation.y = Math.sin(this.t * 47) * 0.12;
      }
      if (paredao) m.scale.setScalar(1.5);
    },

    /* A cobrança inteira em função de τ (segundos desde o chute). */
    posarLance(L, tau) {
      const m = this.batedorM, j = this.juntas(m);
      const recuo = new THREE.Vector3(-0.9, 0, MARCA + 1.9);
      const pe = new THREE.Vector3(-0.32, 0, MARCA + 0.32);
      const fimVoo = CONTATO + L.voo;

      /* Batedor: corrida, chute, e depois a comemoração ou a lamentação. */
      if (tau < CONTATO) {
        const k = tau / CONTATO;
        m.position.lerpVectors(recuo, pe, k);
        m.rotation.y = Math.PI + 0.35 * (1 - k);
        this.corrida(j, tau * 17, 1);
        if (k > 0.75) {
          const q = (k - 0.75) / 0.25;
          j.pernaD.rotation.x = lerp(j.pernaD.rotation.x, -1.0, q);
          j.pernaE.rotation.x = 0.2;
          j.corpo.rotation.x = 0.05;
        }
      } else if (tau < fimVoo + 0.6) {
        const q = clamp((tau - CONTATO) / 0.35);
        m.position.copy(pe);
        m.rotation.y = Math.PI;
        j.pernaD.rotation.x = lerp(-1.0, 1.5, curva(Math.min(1, q * 1.6))) * (L.cavadinha ? 0.6 : 1);
        j.pernaE.rotation.x = -0.15;
        j.corpo.rotation.x = -0.25 * q;
        j.bracoE.rotation.z = -1.1 * q; j.bracoD.rotation.z = 0.6 * q;
        j.bracoE.rotation.x = -0.5 * q;
      } else if (L.r === "gol") {
        /* Corre pra câmera e desliza de joelho com os braços abertos. */
        const t = tau - fimVoo - 0.6;
        const destino = new THREE.Vector3(0.6, 0, MARCA + 4.2);
        const k = clamp(t / 1.0);
        m.position.lerpVectors(pe, destino, curva(k));
        m.rotation.y = lerp(Math.PI, 0.25, clamp(t / 0.45));
        if (k < 0.7) this.corrida(j, t * 16, 1);
        else {
          const d = clamp((k - 0.7) / 0.3);
          j.pernaE.rotation.x = -1.5 * d; j.pernaD.rotation.x = -1.5 * d;
          j.corpo.position.y = 0.74 - 0.42 * d;
          j.corpo.rotation.x = -0.35 * d;
          j.bracoE.rotation.z = -2.3 * d; j.bracoD.rotation.z = 2.3 * d;
          j.cabeca.rotation.x = -0.4 * d;
        }
        if (k >= 1) {
          const v = Math.sin(t * 9);
          j.bracoE.rotation.z = -2.5 - v * 0.2; j.bracoD.rotation.z = 2.5 + v * 0.2;
        }
      } else {
        /* Mãos nos joelhos e cabeça baixa: de costas, mão na cabeça parecia comemoração. */
        const t = tau - fimVoo - 0.6;
        const k = clamp(t / 0.4);
        m.position.copy(pe);
        m.rotation.y = Math.PI;
        j.bracoE.rotation.z = -0.25 * k; j.bracoD.rotation.z = 0.25 * k;
        j.bracoE.rotation.x = -0.7 * k; j.bracoD.rotation.x = -0.7 * k;
        j.cabeca.rotation.x = 0.45 * k;
        j.corpo.rotation.x = 0.5 * k + Math.sin(t * 2) * 0.04;
      }

      /* Bola. */
      const bola = this.bola;
      const ini = new THREE.Vector3(0, BOLA, MARCA);
      if (tau < CONTATO) {
        bola.position.copy(ini);
      } else if (tau < fimVoo) {
        const s = (tau - CONTATO) / L.voo;
        bola.position.lerpVectors(ini, L.fim, s);
        const arco = L.cavadinha ? 1.4 : 0.32;
        bola.position.y += Math.sin(s * Math.PI) * arco;
        bola.position.x += Math.sin(s * Math.PI) * L.curva;
        bola.rotation.x -= 0.6;
        bola.rotation.z += L.curva * 0.2;
      } else {
        const t = tau - fimVoo;
        if (L.r === "gol") {
          const k = clamp(t / 0.22);
          const fundo = new THREE.Vector3(L.fim.x * 0.92, L.fim.y * 0.85, -FUNDO_REDE + 0.25);
          bola.position.lerpVectors(L.fim, fundo, 1 - Math.pow(1 - k, 2));
          if (t > 0.22) {
            const q = t - 0.22;
            bola.position.y = Math.max(BOLA, fundo.y - 4.9 * q * q);
            bola.position.z = fundo.z + Math.min(0.5, q * 0.6);
          }
          if (!L.chegou) { L.chegou = true; this.aoGol(L); }
        } else {
          if (!L.chegou) { L.chegou = true; this.aoErro(L); }
          const v = L.r === "fora" ? new THREE.Vector3(L.fim.x * 0.3, 0.6, -14) : L.rebote;
          bola.position.set(L.fim.x + v.x * t, Math.max(BOLA, L.fim.y + v.y * t - 4.9 * t * t), L.fim.z + v.z * t);
          if (L.r === "fora" && t > 0.6) bola.visible = false;
          bola.rotation.x += 0.3;
        }
      }

      this.posarGoleiroLance(L, tau);
    },

    posarGoleiroLance(L, tau) {
      const m = this.goleiroM, j = this.juntas(m);
      const reage = CONTATO - 0.04;
      const dur = 0.42;
      const col = L.mergulho.col, lin = L.mergulho.lin;
      if (L.paredao) m.scale.setScalar(1.5);
      if (tau < reage) {
        this.posarGoleiroEspera({ ...this.prep, nervoso: L.nervoso });
        if (L.paredao) m.scale.setScalar(1.5);
        return;
      }
      const t = tau - reage;
      const k = clamp(t / dur);
      if (L.frango) {
        /* Escorrega e cai sentado; a bola passa. */
        const q = curva(clamp(t / 0.35));
        m.position.set(col * 0.4 * q, 0, GOLEIRO_Z);
        m.rotation.z = -0.22 * q;
        j.pernaE.rotation.x = -1.5 * q; j.pernaD.rotation.x = -1.3 * q;
        j.pernaE.rotation.z = -0.55 * q; j.pernaD.rotation.z = 0.6 * q;
        j.corpo.position.y = 0.74 - 0.56 * q;
        j.corpo.rotation.x = -0.45 * q;
        j.bracoE.rotation.z = -2.2 * q; j.bracoD.rotation.z = 2.4 * q;
        j.cabeca.rotation.z = Math.sin(t * 8) * 0.2 * q;
        if (t > 0.45 && !this.replayEm && Math.random() < 0.25) {
          const a = this.t * 7;
          this.p.estrela.emitir({
            x: m.position.x + Math.cos(a) * 0.45, y: 1.45 + Math.sin(a * 2) * 0.05, z: GOLEIRO_Z + Math.sin(a) * 0.45,
            vx: -Math.sin(a) * 1.2, vz: Math.cos(a) * 1.2, vida: 0.6, tam: 0.2, tamFim: 0.05, cor: [1, 0.9, 0.3],
          });
        }
        if (t > 0.8) {
          const s = clamp((t - 0.8) / 0.4);
          j.bracoE.rotation.z = lerp(-2.2, -0.4, s);
          j.bracoD.rotation.z = lerp(2.4, 0.4, s);
          j.corpo.rotation.x = lerp(-0.5, 0.3, s);
          j.cabeca.rotation.x = 0.3 * s;
        }
        return;
      }
      if (col === 0) {
        const pulo = lin ? Math.sin(Math.min(1, t / 0.55) * Math.PI) * 0.7 : 0;
        m.position.set(0, pulo, GOLEIRO_Z);
        j.bracoE.rotation.z = lin ? -2.8 : -0.6;
        j.bracoD.rotation.z = lin ? 2.8 : 0.6;
        j.corpo.rotation.x = lin ? -0.1 : 0.5;
        j.corpo.position.y = lin ? 0.74 : 0.55;
      } else {
        /* Mergulho: o corpo deita pro lado e as mãos vão na frente. */
        const alcance = L.paredao ? 2.0 : 1.85;
        const x = col * alcance * curva(k);
        const altura = (lin ? 1.0 : 0.38) * Math.sin(k * Math.PI * 0.9) + (lin ? 0.15 : 0) * k;
        const deitado = clamp(t / 0.3);
        m.position.set(x, Math.max(0, altura), GOLEIRO_Z);
        m.rotation.z = -col * (lin ? 1.15 : 1.4) * curva(deitado);
        j.bracoE.rotation.z = -2.9 * curva(deitado);
        j.bracoD.rotation.z = 2.9 * curva(deitado);
        j.pernaE.rotation.z = -0.2; j.pernaD.rotation.z = 0.35;
        if (t > dur + 0.1) m.position.y = Math.max(0, m.position.y - (t - dur - 0.1) * 2) * (lin ? 1 : 0.6);
      }
      /* Depois do lance: comemora a defesa ou fica no chão. */
      const depois = tau - (CONTATO + L.voo + 0.5);
      if (depois > 0 && L.r !== "gol") {
        const q = clamp(depois / 0.4);
        m.rotation.z = lerp(m.rotation.z, 0, q);
        m.position.y = lerp(m.position.y, Math.abs(Math.sin(depois * 6)) * 0.35 * q, q);
        j.bracoE.rotation.z = lerp(j.bracoE.rotation.z, -2.6, q);
        j.bracoD.rotation.z = lerp(j.bracoD.rotation.z, 2.0 + Math.sin(depois * 12) * 0.4, q);
        j.corpo.rotation.x = 0;
      } else if (depois > 0.3) {
        const q = clamp((depois - 0.3) / 0.6);
        m.rotation.z = lerp(m.rotation.z, -col * 1.55, q);
        m.position.y = lerp(m.position.y, 0.05, q);
        j.cabeca.rotation.x = 0.4 * q;
        j.bracoE.rotation.z = lerp(j.bracoE.rotation.z, -0.3, q);
        j.bracoD.rotation.z = lerp(j.bracoD.rotation.z, 1.2 + Math.sin(depois * 5) * 0.3, q);
      }
    },

    /* ───────────── acontecimentos ───────────── */

    aoGol(L) {
      this.flash = L.efeito === "placa" ? 1.3 : 0.9;
      this.soco = 1;
      this.tremor = L.efeito === "fogo" || L.efeito === "placa" ? 0.5 : 0.25;
      this.estufa = { forca: L.efeito === "fogo" || L.efeito === "placa" ? 1.6 : 1, x: L.fim.x, y: L.fim.y, t: 0 };
      this.luzGol.intensity = 8;
      const s = this.setor(L.time);
      if (s >= 0) this.comemora[s] = this.t + 4;
      const r = this.setor(L.rival);
      if (r >= 0) this.comemora[r] = -(this.t + 4);
      this.confete(L.time, LEVE ? 60 : 110);
      const [c1, c2] = this.corDoTime(L.time);
      for (let i = 0; i < (LEVE ? 30 : 70); i++) {
        const a = Math.random() * Math.PI * 2, v = sorte(1.5, 5);
        this.p.brilho.emitir({
          x: L.fim.x, y: L.fim.y, z: -0.6, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: sorte(0, 2),
          vida: sorte(0.4, 0.9), tam: sorte(0.18, 0.35), tamFim: 0.02, cor: i % 2 ? c1 : [1, 0.95, 0.7], corFim: c2, arrasto: 2,
        });
      }
      if (L.efeito === "fogo") {
        for (let i = 0; i < (LEVE ? 40 : 90); i++) {
          this.p.brilho.emitir({
            x: L.fim.x + sorte(-0.5, 0.5), y: L.fim.y + sorte(-0.4, 0.4), z: -1.6,
            vx: sorte(-2, 2), vy: sorte(0, 4), vz: sorte(-3, 0),
            vida: sorte(0.6, 1.4), tam: sorte(0.2, 0.5), tamFim: 0.03, cor: [1, 0.8, 0.25], corFim: [0.9, 0.15, 0.02], arrasto: 1, grav: -1,
          });
        }
      }
      if (L.efeito === "placa") {
        this.fogos(LEVE ? 5 : 9);
        this.confete(null, LEVE ? 80 : 160);
        this.replayEm = this.t + 0.9;
      }
    },

    aoErro(L) {
      this.tremor = 0.15;
      const s = this.setor(L.rival);
      if (s >= 0) this.comemora[s] = this.t + 3;
      const r = this.setor(L.time);
      if (r >= 0) this.comemora[r] = -(this.t + 3);
      if (L.r === "trave") {
        for (let i = 0; i < 26; i++) {
          this.p.estrela.emitir({
            x: L.fim.x, y: L.fim.y, z: 0.1, vx: sorte(-3, 3), vy: sorte(-1, 3), vz: sorte(0, 2),
            vida: sorte(0.3, 0.6), tam: sorte(0.15, 0.3), tamFim: 0.02, cor: [1, 1, 0.85], arrasto: 3,
          });
        }
      } else if (L.r === "defesa") {
        const cor = new THREE.Color(this.corGoleiro(this.time(L.rival) || this.timeB)).toArray();
        for (let i = 0; i < 30; i++) {
          this.p.brilho.emitir({
            x: L.fim.x, y: L.fim.y, z: L.fim.z, vx: sorte(-3, 3), vy: sorte(-2, 3), vz: sorte(0, 3),
            vida: sorte(0.3, 0.7), tam: sorte(0.2, 0.4), tamFim: 0.02, cor, arrasto: 3,
          });
        }
        if (L.paredao) { this.flash = 0.6; this.confete(L.rival, 50); }
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

      /* Replay do gol de placa: a mesma cobrança, devagar, de lado. */
      const L = this.lance;
      let tau = L ? this.tauDe(L, this.t - L.t0) : 0;
      let replay = false;
      if (L && this.replayEm && this.t >= this.replayEm) {
        const dur = this.cfg.tempos.replay;
        const q = (this.t - this.replayEm) / dur;
        if (q < 1) {
          replay = true;
          tau = lerp(CONTATO - 0.25, CONTATO + L.voo + 0.25, q);
          this.bola.visible = true;
        } else this.replayEm = null;
      }

      if (L) {
        if (replay) {
          const rede = this.estufa;
          this.posarLance({ ...L, chegou: true }, tau);
          this.estufa = rede;
          if (tau > CONTATO + L.voo) this.estufa = { forca: 1.2, x: L.fim.x, y: L.fim.y, t: (tau - CONTATO - L.voo) };
        } else this.posarLance(L, tau);
      } else if (this.prep) this.posarPreparo(dt);
      else { this.posarParado(); this.posarGoleiroEspera(null); }

      this.efeitosDaBola(dt, L, tau);
      this.posarAcessorios();
      this.animarRede(dt);
      this.animarTorcida(dt, estado);
      this.animarFogos(dt);
      for (const s of this.sistemas) s.passo(dt);

      this.texPlaca.offset.x = (this.t * 0.05) % 1;
      this.texAnel.offset.x = (-this.t * 0.03) % 1;
      const respira = this.ociosa ? 0.85 + Math.sin(this.t * 1.4) * 0.15 : 1;
      for (const h of this.halos) h.material.opacity = (h.scale.x > 24 ? 0.22 : 0.95) * respira * (0.97 + Math.sin(this.t * 13 + h.id) * 0.03);
      this.matCone.uniforms.uForca.value = 0.05 * respira;
      this.flash = Math.max(0, this.flash - dt * 2.2);
      this.luzGol.intensity = Math.max(0, this.luzGol.intensity - dt * 9);
      this.renderer.toneMappingExposure = 1.05 + this.flash * 0.55;

      this.mexerCamera(dt, L, tau, replay);
      this.renderer.render(this.scene, this.camera);
    },

    efeitosDaBola(dt, L, tau) {
      const p = this.prep;
      if (!p) { this.aura.material.opacity = 0; return; }
      const efeito = L ? L.efeito : p.efeito;
      const b = this.bola.position;
      const voando = L && tau >= CONTATO && tau < CONTATO + L.voo + 0.15;
      const n = voando ? (LEVE ? 3 : 6) : 1;
      const corTime = this.corDoTime(p.time)[0];
      this.aura.position.copy(b);
      let aura = 0, corAura = [1, 1, 1];
      if (efeito === "brilho") {
        aura = 0.8; corAura = p.corBrilho;
        const sis = p.variante === "brilho" ? this.p.brilho : this.p[p.variante];
        if (Math.random() < (voando ? 1 : 0.35)) for (let i = 0; i < n; i++) sis.emitir({
          x: b.x + sorte(-0.15, 0.15), y: b.y + sorte(-0.1, 0.2), z: b.z + sorte(-0.1, 0.1),
          vx: sorte(-0.4, 0.4), vy: sorte(0.2, 0.9), vz: sorte(-0.2, 0.2),
          vida: sorte(0.4, 0.9), tam: sorte(0.12, 0.26), tamFim: 0.03, cor: p.corBrilho, corFim: [1, 1, 1], arrasto: 1.5,
        });
      } else if (efeito === "curva") {
        aura = 0.6; corAura = [0.5, 0.85, 1];
        for (let i = 0; i < n; i++) {
          const a = this.t * 9 + i * 2.1;
          this.p.brilho.emitir({
            x: b.x + Math.cos(a) * 0.32, y: b.y + 0.05 + Math.sin(a * 0.5) * 0.08, z: b.z + Math.sin(a) * 0.32,
            vx: -Math.sin(a) * 0.8, vy: 0.3, vz: Math.cos(a) * 0.8,
            vida: 0.5, tam: 0.14, tamFim: 0.02, cor: [0.55, 0.9, 1], corFim: [1, 1, 1], arrasto: 2,
          });
        }
      } else if (efeito === "fogo" || efeito === "placa") {
        const fogo = efeito === "fogo";
        aura = fogo ? 1 : 1.2; corAura = fogo ? [1, 0.55, 0.15] : [1, 0.82, 0.25];
        for (let i = 0; i < n + 1; i++) {
          (i % 2 ? this.p.brilho : this.p.chama).emitir({
            x: b.x + sorte(-0.08, 0.08), y: b.y + sorte(-0.05, 0.1), z: b.z + sorte(-0.08, 0.08),
            vx: sorte(-0.3, 0.3), vy: sorte(0.6, 1.6), vz: voando ? sorte(1, 3) : sorte(-0.2, 0.2),
            vida: sorte(0.25, 0.55), tam: sorte(0.35, 0.7), tamFim: 0.06,
            cor: fogo ? [1, 0.62, 0.12] : [1, 0.95, 0.6], corFim: fogo ? [0.85, 0.08, 0.02] : [1, 0.6, 0.1], arrasto: 1.2, grav: -1.5,
          });
        }
        if (fogo && Math.random() < 0.4) this.p.fumaca.emitir({
          x: b.x, y: b.y + 0.3, z: b.z, vx: sorte(-0.2, 0.2), vy: 0.8, vz: 0,
          vida: 1.2, tam: 0.5, tamFim: 1.2, cor: [0.25, 0.22, 0.22], alfa: 0.35, arrasto: 0.8,
        });
        if (!fogo && Math.random() < 0.5) this.p.estrela.emitir({
          x: b.x + sorte(-0.6, 0.6), y: b.y + sorte(0, 1.2), z: b.z + sorte(-0.4, 0.4),
          vx: 0, vy: 0.4, vz: 0, vida: 0.7, tam: 0.22, tamFim: 0.02, cor: [1, 0.85, 0.3],
        });
      } else if (voando) {
        for (let i = 0; i < 2; i++) this.p.brilho.emitir({
          x: b.x, y: b.y, z: b.z, vida: 0.25, tam: 0.16, tamFim: 0.02, cor: corTime, alfa: 0.5,
        });
      }
      const fora = L && !this.bola.visible;
      this.aura.material.opacity = fora ? 0 : aura * (0.75 + Math.sin(this.t * 8) * 0.25);
      this.aura.material.color.setRGB(...corAura);
      this.aura.scale.setScalar(efeito === "placa" ? 1.6 : 1.1);
    },

    posarAcessorios() {
      const p = this.prep;
      const bm = this.batedorM, gm = this.goleiroM;
      /* Sem batedor chamado ele sai de cena: parado, ficava com o nome do
         anterior e tapava a câmera que passeia na live parada. */
      bm.visible = this.sombras.batedor.visible = !!p && !this.ociosa;
      this.sombras.batedor.position.set(bm.position.x, 0.012, bm.position.z);
      this.sombras.goleiro.position.set(gm.position.x, 0.012, gm.position.z);
      this.sombras.goleiro.scale.setScalar(gm.scale.x * (1 - Math.min(0.4, gm.position.y * 0.3)));
      this.sombras.bola.position.set(this.bola.position.x, 0.013, this.bola.position.z);
      this.sombras.bola.visible = this.bola.visible;
      const craque = p && p.craque;
      this.estrelaCraque.material.opacity = craque ? 0.95 : 0;
      if (craque) {
        this.estrelaCraque.position.set(bm.position.x, bm.position.y + 2.2 + Math.sin(this.t * 3) * 0.08, bm.position.z);
        this.estrelaCraque.material.rotation = this.t * 1.5;
      }
      const suando = p && (p.efeito === "frango" || p.nervoso) && !this.lance;
      this.gota.material.opacity = suando ? 0.9 : 0;
      if (suando) {
        const c = (this.t * 0.9) % 1;
        this.gota.position.set(gm.position.x + 0.36, 2.0 - c * 0.5, gm.position.z + 0.15);
      }
      const paredao = (p && p.paredao) || (this.lance && this.lance.paredao);
      this.auraGoleiro.material.opacity = paredao ? 0.55 + Math.sin(this.t * 6) * 0.15 : 0;
      this.auraGoleiro.position.set(gm.position.x, 1.4, gm.position.z - 0.3);
      const mats = gm.userData.mat;
      if (paredao) { mats.camisa.emissive && mats.camisa.emissive.set(0x6a4a00); mats.manga.color.set("#ffc21a"); }
      else if (mats.camisa.emissive) mats.camisa.emissive.set(0x000000);
    },

    redeReset() { this.estufa = { forca: 0, x: 0, y: 1, t: 9 }; },

    /* A rede de trás empurra pra fora em volta do ponto do gol e balança. */
    animarRede(dt) {
      const e = this.estufa;
      e.t += dt;
      const pos = this.redeFundo.geometry.attributes.position;
      const base = this.redeBase;
      const amp = e.forca * Math.exp(-e.t * 2.2) * (e.t < 0.12 ? e.t / 0.12 : Math.cos((e.t - 0.12) * 9) * 0.6 + 0.4);
      if (Math.abs(amp) < 0.002 && !this.redeMexida) return;
      this.redeMexida = Math.abs(amp) >= 0.002;
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3], y = base[i * 3 + 1] + 1.0;
        const d2 = (x - e.x) ** 2 + (y - e.y) ** 2 * 1.4;
        const perto = Math.exp(-d2 / 1.6);
        pos.setZ(i, base[i * 3 + 2] - amp * 0.85 * perto);
        /* A onda que corre pela malha é o que aparece de frente. */
        const onda = Math.sin(Math.sqrt(d2) * 4 - e.t * 16) * Math.exp(-Math.sqrt(d2) * 0.5);
        pos.setY(i, base[i * 3 + 1] + amp * (0.22 * onda - 0.12 * perto));
        pos.setX(i, x + amp * 0.12 * onda * Math.sign(x - e.x));
      }
      pos.needsUpdate = true;
    },

    /* Agito por setor: 0 sentado, 1 de pé, 2 pulando, 3 ola. */
    animarTorcida(dt, estado) {
      const pressao = estado.pressao || {};
      for (let s = 0; s < 2; s++) {
        const time = s === 0 ? this.timeA : this.timeB;
        const pr = time ? pressao[time.id] || 0 : 0;
        let alvo = 0.95 + pr * 0.9 + this.extra[s];
        const c = this.comemora[s];
        if (c > this.t) alvo = 2.0;
        else if (c < 0 && -c > this.t) alvo = 0.15;
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

    mexerCamera(dt, L, tau, replay) {
      const cam = this.camera, c = this.cam;
      const pos = new THREE.Vector3(0, 3.4, 20.5), olhar = new THREE.Vector3(0, 1.05, 0);
      let fov = this.fovBase, taxa = 3;
      const p = this.prep;
      if (this.final) {
        const k = clamp((this.t - this.final.t0) / 2);
        pos.set(Math.sin(this.t * 0.25) * 2, lerp(3.4, 5, k), lerp(20.5, 23, k));
        olhar.set(0, lerp(1.05, 5.5, k), lerp(0, -10, k));
        taxa = 1.5;
      } else if (this.ociosa) {
        pos.set(Math.sin(this.t * 0.18) * 4, 4.6 + Math.sin(this.t * 0.11) * 0.6, 21);
        olhar.set(Math.sin(this.t * 0.18) * 1.5, 2.8, -4);
        taxa = 0.8;
      } else if (replay) {
        /* Replay de trás do gol, através da rede, com a bola vindo na câmera. */
        pos.set(1.4, 1.5, -3.4);
        olhar.set(-0.3, 1.0, 8);
        fov = this.fovBase * 1.25;
        taxa = 50;
      } else if (L && tau > CONTATO + L.voo + 0.7 && L.r === "gol") {
        const bm = this.batedorM.position;
        pos.set(bm.x * 0.4, 2.3, bm.z + 5.4);
        olhar.set(bm.x * 0.3, 1.6, bm.z - 4);
        taxa = 2;
      } else if (p && (p.efeito === "placa" || p.efeito === "fogo") && (!L || tau < CONTATO)) {
        const k = clamp((this.t - p.t0) / this.cfg.tempos.prepara);
        pos.set(lerp(0, 1.1, k), lerp(3.4, 1.7, k), lerp(20.5, 17.6, k));
        olhar.set(0, lerp(1.05, 1.35, k), 0);
        taxa = 2.5;
      } else if (p && !L) {
        const k = clamp((this.t - p.t0) / this.cfg.tempos.prepara);
        pos.z = lerp(21.2, 20.3, curva(k));
      }
      if (c.fov === 0) { c.pos.copy(pos); c.olhar.copy(olhar); c.fov = fov; }
      const a = 1 - Math.exp(-taxa * dt);
      c.pos.lerp(pos, a);
      c.olhar.lerp(olhar, a);
      c.fov = lerp(c.fov, fov, a);
      this.soco = Math.max(0, this.soco - dt * 3);
      this.tremor = Math.max(0, this.tremor - dt * 0.9);
      cam.position.copy(c.pos);
      cam.position.z -= this.soco * 0.9;
      if (this.tremor > 0) {
        cam.position.x += (Math.random() - 0.5) * this.tremor * 0.25;
        cam.position.y += (Math.random() - 0.5) * this.tremor * 0.25;
      }
      cam.lookAt(c.olhar);
      const fovAlvo = c.fov * (1 - this.soco * 0.06);
      if (Math.abs(cam.fov - fovAlvo) > 0.01) { cam.fov = fovAlvo; cam.updateProjectionMatrix(); }
    },
  };
})();
