/* O Pebolim Gigante em 3D (three.js): ginásio à noite, a mesa de madeira e
   vidro iluminada no meio, torcida nas arquibancadas, as varetas cromadas e
   os bonecos de madeira pintados com as cores do clube.

   Medidas em centímetros da mesa (as mesmas do regras.js): o campo é o plano
   y = 0, o x da mesa é o x da cena e o y da mesa vira -z, então o gol do time
   A fica perto da câmera (embaixo na tela) e o do B lá no fundo. A cena só
   desenha: posição de bola e vareta vem pronta do regras.js a cada quadro. */
"use strict";

const Cena = (() => {
  const LEVE = new URLSearchParams(location.search).get("leve") === "1";
  const VARA_Y = 8;
/* Boneco e bola desenhados maiores que na física: vistos do alto, no
   tamanho real ficam miúdos no celular. */
const ESCALA_BONECO = 1.3;
  const PAREDE = 6;
  const BORDA = 11;
  const CHAO = -88;
  const MX = MESA.larg / 2, MZ = MESA.comp / 2;
  const R = MESA.raio;
  const RB = R * 1.3;
  const MAX_BOLAS = 3;

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const suave = (atual, alvo, taxa, dt) => atual + (alvo - atual) * (1 - Math.exp(-taxa * dt));
  const sorte = (a, b) => a + Math.random() * (b - a);
  const rgb = hex => new THREE.Color(hex).toArray();
  const claro = hex => new THREE.Color(hex).getHSL({}).l > 0.75;

  /* Cor que aparece no escuro: o time de camisa preta ou branca brilha na
     segunda cor (ou num cinza azulado), senão o LED some. */
  function corDeLuz(time) {
    const c1 = new THREE.Color(time.cor).getHSL({});
    if (c1.s > 0.25 && c1.l > 0.12 && c1.l < 0.8) return time.cor;
    const c2 = new THREE.Color(time.cor2).getHSL({});
    if (c2.s > 0.25 && c2.l > 0.12 && c2.l < 0.8) return time.cor2;
    return "#dfe8ff";
  }

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
    t.anisotropy = LEVE ? 2 : 8;
    return t;
  }

  const Tex = {
    brilho() {
      const [c, g] = canvas(64, 64);
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, "rgba(255,255,255,1)");
      gr.addColorStop(0.25, "rgba(255,255,255,.65)");
      gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
      return textura(c, { cor: false });
    },
    forma(desenhar) {
      const [c, g] = canvas(64, 64);
      g.translate(32, 32);
      g.fillStyle = "#fff";
      g.shadowColor = "#fff";
      g.shadowBlur = 8;
      g.beginPath();
      desenhar(g);
      g.fill();
      return textura(c, { cor: false });
    },
    estrela() {
      return this.forma(g => {
        for (let i = 0; i < 10; i++) {
          const r = i % 2 ? 11 : 27, a = (i / 10) * Math.PI * 2 - Math.PI / 2;
          g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
      });
    },
    coracao() {
      return this.forma(g => {
        g.moveTo(0, 22);
        g.bezierCurveTo(-28, 2, -24, -24, 0, -12);
        g.bezierCurveTo(24, -24, 28, 2, 0, 22);
      });
    },
    raio() {
      return this.forma(g => {
        for (const [x, y] of [[6, -28], [-14, 4], [-1, 4], [-8, 28], [14, -6], [1, -6], [9, -28]]) g.lineTo(x, y);
      });
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
      gr.addColorStop(0, "rgba(0,0,0,.6)");
      gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
      return textura(c, { cor: false });
    },
    /* Faixa que some pra um lado: luz do LED espalhando no campo e no chão. */
    degrade() {
      const [c, g] = canvas(8, 128);
      const gr = g.createLinearGradient(0, 0, 0, 128);
      gr.addColorStop(0, "rgba(255,255,255,1)");
      gr.addColorStop(0.3, "rgba(255,255,255,.35)");
      gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr;
      g.fillRect(0, 0, 8, 128);
      return textura(c, { cor: false });
    },
    /* O campo pintado: verde com faixas de corte, linhas brancas, áreas e um
       escurecido nas bordas. */
    campo() {
      const px = LEVE ? 7.5 : 15;
      const W = Math.round(MESA.larg * px), H = Math.round(MESA.comp * px);
      const [c, g] = canvas(W, H);
      const gr = g.createLinearGradient(0, 0, W, 0);
      gr.addColorStop(0, "#14592c");
      gr.addColorStop(0.5, "#1d7a3b");
      gr.addColorStop(1, "#14592c");
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
      const faixas = 14;
      for (let i = 0; i < faixas; i++) {
        g.fillStyle = i % 2 ? "rgba(255,255,255,.045)" : "rgba(0,0,0,.06)";
        g.fillRect(0, (i * H) / faixas, W, H / faixas);
      }
      for (let i = 0; i < (LEVE ? 2500 : 9000); i++) {
        g.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,.035)" : "rgba(0,0,0,.05)";
        g.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 2, 1 + Math.random() * 2);
      }
      const cm = v => v * px;
      g.strokeStyle = "rgba(255,255,255,.92)";
      g.fillStyle = "rgba(255,255,255,.92)";
      g.lineWidth = cm(0.45);
      const m = cm(2.2);
      g.strokeRect(m, m, W - 2 * m, H - 2 * m);
      g.beginPath(); g.moveTo(m, H / 2); g.lineTo(W - m, H / 2); g.stroke();
      g.beginPath(); g.arc(W / 2, H / 2, cm(9.5), 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(W / 2, H / 2, cm(0.9), 0, Math.PI * 2); g.fill();
      for (const lado of [0, 1]) {
        const y0 = lado ? H - m : m, s = lado ? -1 : 1;
        g.strokeRect(W / 2 - cm(19), Math.min(y0, y0 + s * cm(15)), cm(38), cm(15));
        g.strokeRect(W / 2 - cm(11), Math.min(y0, y0 + s * cm(6)), cm(22), cm(6));
        g.beginPath(); g.arc(W / 2, y0 + s * cm(11), cm(0.7), 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(W / 2, y0 + s * cm(15), cm(6), lado ? Math.PI + 0.65 : 0.65, lado ? -0.65 : Math.PI - 0.65); g.stroke();
      }
      const v = g.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, H * 0.62);
      v.addColorStop(0, "rgba(0,0,0,0)");
      v.addColorStop(1, "rgba(0,0,0,.42)");
      g.fillStyle = v;
      g.fillRect(0, 0, W, H);
      return textura(c);
    },
    /* Madeira escura envernizada, veio na horizontal. */
    madeira() {
      const [c, g] = canvas(512, 128);
      g.fillStyle = "#5a2f17";
      g.fillRect(0, 0, 512, 128);
      for (let i = 0; i < 70; i++) {
        const y = Math.random() * 128, a = 0.05 + Math.random() * 0.12;
        g.strokeStyle = Math.random() < 0.5 ? `rgba(30,12,4,${a})` : `rgba(150,82,40,${a})`;
        g.lineWidth = 1 + Math.random() * 3;
        g.beginPath();
        g.moveTo(0, y);
        for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 3);
        g.stroke();
      }
      const brilho = g.createLinearGradient(0, 0, 0, 128);
      brilho.addColorStop(0, "rgba(255,210,160,.12)");
      brilho.addColorStop(0.5, "rgba(255,210,160,0)");
      g.fillStyle = brilho;
      g.fillRect(0, 0, 512, 128);
      return textura(c, { repetir: true });
    },
    /* Taco do ginásio com as linhas da quadra. Cobre 1000 × 1000 cm. */
    piso() {
      const N = LEVE ? 512 : 1024, k = N / 1000;
      const [c, g] = canvas(N, N);
      g.fillStyle = "#6b4a2c";
      g.fillRect(0, 0, N, N);
      const larg = 12 * k;
      for (let i = 0; i * larg < N; i++) {
        let y = 0;
        while (y < N) {
          const comp = (80 + Math.random() * 140) * k;
          const tom = 90 + Math.random() * 40;
          g.fillStyle = `rgb(${tom + 30},${tom},${tom * 0.55})`;
          g.fillRect(i * larg + 0.5, y + 0.5, larg - 1, comp - 1);
          y += comp;
        }
      }
      g.fillStyle = "rgba(20,10,4,.35)";
      g.fillRect(0, 0, N, N);
      g.strokeStyle = "rgba(255,222,120,.75)";
      g.lineWidth = 5 * k;
      const meio = N / 2;
      g.beginPath(); g.arc(meio, meio, 180 * k, 0, Math.PI * 2); g.stroke();
      g.strokeRect(meio - 330 * k, 40 * k, 660 * k, N - 80 * k);
      g.beginPath(); g.moveTo(meio - 330 * k, meio); g.lineTo(meio + 330 * k, meio); g.stroke();
      return textura(c);
    },
    rede() {
      const [c, g] = canvas(64, 64);
      g.strokeStyle = "rgba(255,255,255,.85)";
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(32, 0); g.lineTo(64, 32); g.lineTo(32, 64); g.lineTo(0, 32); g.closePath();
      g.stroke();
      return textura(c, { cor: false, repetir: true });
    },
    /* Faixa da arquibancada com o nome dos dois times. */
    faixa(textoA, textoB, corA, corB) {
      const [c, g] = canvas(1024, 64);
      for (let i = 0; i < 8; i++) {
        const a = i % 2 === 0;
        g.fillStyle = a ? corA : corB;
        g.fillRect(i * 128, 0, 128, 64);
        g.fillStyle = claro(a ? corA : corB) ? "#111" : "#fff";
        g.font = '40px "Lilita One", Impact, sans-serif';
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(a ? textoA : textoB, i * 128 + 64, 34);
      }
      return textura(c, { repetir: true });
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

  /* Cone de luz do refletor: aditivo, some na base e nas bordas. */
  function materialFeixe() {
    return new THREE.ShaderMaterial({
      uniforms: { uCor: { value: new THREE.Color(0xfff2d8) }, uForca: { value: 0.07 } },
      vertexShader: `
        varying float vAltura; varying vec3 vN; varying vec3 vV;
        void main() {
          vAltura = uv.y;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uCor; uniform float uForca;
        varying float vAltura; varying vec3 vN; varying vec3 vV;
        void main() {
          float borda = pow(abs(dot(vN, vV)), 2.0);
          gl_FragColor = vec4(uCor * uForca * borda * smoothstep(0.0, 0.9, vAltura), 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }

  /* ───────────── cena ───────────── */

  return {
    LEVE,
    t: 0,
    timeA: null,
    timeB: null,
    flash: 0,
    soco: 0,
    tremor: 0,
    ociosa: false,

    montar(canvasEl, cfg) {
      this.cfg = cfg;
      this.canvas = canvasEl;
      this.renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: !LEVE, powerPreference: "high-performance" });
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.1;
      if (!LEVE) {
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      }
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x05060d);
      this.scene.fog = new THREE.Fog(0x05060d, 320, 900);
      this.camera = new THREE.PerspectiveCamera(40, 9 / 16, 2, 3000);
      this.hfov = 42;

      this.tex = {
        brilho: Tex.brilho(), estrela: Tex.estrela(), coracao: Tex.coracao(), raio: Tex.raio(),
        papel: Tex.papel(), fumaca: Tex.fumaca(), sombra: Tex.sombra(), degrade: Tex.degrade(),
      };
      this.U = { uT: { value: 0 }, uAgito: { value: new THREE.Vector2(0.3, 0.3) } };
      this.agito = [0.3, 0.3];
      this.agenda = [];

      this.montarLuz();
      this.montarGinasio();
      this.montarMesa();
      this.montarVaretas();
      this.montarBonecos();
      this.montarBolas();
      this.montarEfeitos();
      if (!LEVE) this.montarReflexo();

      this.cam = { pos: new THREE.Vector3(), olhar: new THREE.Vector3(), alvo: new THREE.Vector3(0, 0, 0) };
      const [a, b] = cfg.times;
      this.classico(a, b);
      this.posarCamera(0, true);
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
      /* A largura da mesa manda: celular mais comprido ganha chão, a mesa fica do mesmo tamanho. */
      const v = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(this.hfov) / 2) / this.camera.aspect);
      this.fovBase = THREE.MathUtils.radToDeg(v);
      this.camera.fov = this.fovBase;
      this.camera.updateProjectionMatrix();
      for (const p of this.sistemas) p.material.uniforms.uEscala.value = larg * 1.1;
    },

    /* ───────────── montagem ───────────── */

    montarLuz() {
      this.hemi = new THREE.HemisphereLight(0x6f7fc0, 0x2a1a10, 0.75);
      this.scene.add(this.hemi);
      this.refletor = new THREE.SpotLight(0xfff0dc, LEVE ? 3.2 : 3.6, 0, 0.62, 0.55, 0);
      this.refletor.position.set(0, 330, 40);
      this.refletor.target.position.set(0, 0, -4);
      this.scene.add(this.refletor, this.refletor.target);
      if (!LEVE) {
        this.refletor.castShadow = true;
        this.refletor.shadow.mapSize.set(2048, 2048);
        this.refletor.shadow.camera.near = 150;
        this.refletor.shadow.camera.far = 480;
        this.refletor.shadow.bias = -0.0004;
        this.refletor.shadow.radius = 3;
      }
      this.contra = new THREE.DirectionalLight(0x9db4ff, 0.9);
      this.contra.position.set(-80, 140, -260);
      this.scene.add(this.contra);
      this.luzGol = [0, 1].map(() => {
        const l = new THREE.PointLight(0xffffff, 0, 160, 0);
        this.scene.add(l);
        return l;
      });
      this.luzBola = new THREE.PointLight(0xff8a2a, 0, 60, 0);
      this.scene.add(this.luzBola);
    },

    /* Ambiente pros cromados e o verniz: painéis de luz numa sala escura. */
    montarReflexo() {
      const sala = new THREE.Scene();
      sala.background = new THREE.Color(0x0b0d18);
      const painel = (cor, x, y, z, w, h, ry = 0, rx = 0) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: cor, side: THREE.DoubleSide }));
        m.position.set(x, y, z);
        m.rotation.set(rx, ry, 0);
        sala.add(m);
      };
      painel(0xffffff, 0, 9, 0, 10, 10, 0, Math.PI / 2);
      painel(0x8fa8ff, -10, 3, 0, 6, 2, Math.PI / 2);
      painel(0xffd2a0, 10, 3, 0, 6, 2, -Math.PI / 2);
      painel(0x445066, 0, -6, 0, 20, 20, 0, Math.PI / 2);
      const pm = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pm.fromScene(sala, 0.03).texture;
      pm.dispose();
    },

    montarGinasio() {
      const piso = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000),
        LEVE ? new THREE.MeshLambertMaterial({ map: Tex.piso() }) : new THREE.MeshStandardMaterial({ map: Tex.piso(), roughness: 0.35, metalness: 0, envMapIntensity: 0.4 }));
      piso.rotation.x = -Math.PI / 2;
      piso.position.y = CHAO;
      piso.receiveShadow = !LEVE;
      this.scene.add(piso);

      /* Luz do LED da mesa espalhando no chão. */
      this.halosChao = [];
      for (const lado of [0, 1]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(260, 140), new THREE.MeshBasicMaterial({
          map: this.tex.brilho, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending,
        }));
        m.rotation.x = -Math.PI / 2;
        m.position.set(0, CHAO + 0.5, lado ? -70 : 70);
        this.scene.add(m);
        this.halosChao.push(m);
      }

      /* Arquibancadas dos dois lados compridos e no fundo, com a torcida.
         `fora` aponta pra trás da arquibancada (longe da mesa); a torcida
         olha pro lado contrário. Lado 0 = time A (perto da câmera), 1 = B. */
      const madeira = new THREE.MeshLambertMaterial({ color: 0x262a38 });
      const DEGRAUS = 7, ALTO = 13, FUNDO = 24;
      const setores = [
        { x: -118, z: -30, comp: 380, fora: [-1, 0] },
        { x: 118, z: -30, comp: 380, fora: [1, 0] },
        { x: 0, z: -175, comp: 300, fora: [0, -1] },
      ];
      const geoDegrau = new THREE.BoxGeometry(1, ALTO, FUNDO);
      for (const s of setores) {
        const giro = Math.atan2(s.fora[0], s.fora[1]);
        for (let d = 0; d < DEGRAUS; d++) {
          const m = new THREE.Mesh(geoDegrau, madeira);
          m.scale.x = s.comp;
          m.position.set(s.x + s.fora[0] * d * FUNDO, CHAO + ALTO / 2 + d * ALTO, s.z + s.fora[1] * d * FUNDO);
          m.rotation.y = giro;
          this.scene.add(m);
        }
      }
      const lugares = [];
      const total = LEVE ? 160 : 380;
      for (let i = 0; i < total; i++) {
        const s = setores[i % 3];
        const d = Math.floor(Math.random() * DEGRAUS);
        const ao = (Math.random() - 0.5) * (s.comp - 20);
        const dist = d * FUNDO + sorte(-3, 3);
        const x = s.x + s.fora[0] * dist + s.fora[1] * ao;
        const z = s.z + s.fora[1] * dist - s.fora[0] * ao;
        lugares.push({
          pos: new THREE.Vector3(x, CHAO + ALTO * (d + 1), z),
          giro: Math.atan2(-s.fora[0], -s.fora[1]) + (Math.random() - 0.5) * 0.5,
          escala: 15 + Math.random() * 3, lado: z < -20 ? 1 : 0, sorte: Math.random(),
        });
      }
      this.torcida = new Personagens.Torcida(lugares, Personagens.malhaTorcedor({ leve: LEVE }), Personagens.materialTorcedor(this.U));
      this.scene.add(this.torcida.mesh);

      /* Faixas com o nome dos times na frente das arquibancadas. */
      this.faixasTorcida = [];
      for (const s of setores) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(s.comp, 9), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        m.position.set(s.x - s.fora[0] * (FUNDO / 2 + 0.2), CHAO + 6, s.z - s.fora[1] * (FUNDO / 2 + 0.2));
        m.rotation.y = Math.atan2(-s.fora[0], -s.fora[1]);
        this.scene.add(m);
        this.faixasTorcida.push(m);
      }

      /* Refletores pendurados com o cone de luz descendo na mesa. */
      this.matFeixe = materialFeixe();
      this.halos = [];
      const halo = new THREE.SpriteMaterial({ map: this.tex.brilho, color: 0xfff1d6, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const cima = new THREE.Vector3(0, 1, 0);
      for (const [x, y, z] of [[-75, 230, -120], [75, 230, -120], [-110, 230, 30], [110, 230, 30]]) {
        const lampada = new THREE.Vector3(x, y, z);
        const alvo = new THREE.Vector3(x * 0.25, 0, z * 0.25 - 10);
        const dir = lampada.clone().sub(alvo);
        const alto = dir.length();
        const cone = new THREE.Mesh(new THREE.CylinderGeometry(3, 46, alto, LEVE ? 12 : 24, 1, true), this.matFeixe);
        cone.position.copy(lampada).add(alvo).multiplyScalar(0.5);
        cone.quaternion.setFromUnitVectors(cima, dir.normalize());
        this.scene.add(cone);
        const s = new THREE.Sprite(halo);
        s.position.copy(lampada);
        s.scale.setScalar(50);
        this.scene.add(s);
        this.halos.push(s);
      }
    },

    montarMesa() {
      const mesa = new THREE.Group();
      this.scene.add(mesa);
      const texMadeira = Tex.madeira();
      const madeira = LEVE
        ? new THREE.MeshLambertMaterial({ map: texMadeira })
        : new THREE.MeshStandardMaterial({ map: texMadeira, roughness: 0.32, metalness: 0, envMapIntensity: 0.8 });
      const escuro = new THREE.MeshLambertMaterial({ color: 0x0c0a0a });
      const caixa = (w, h, d, x, y, z, mat = madeira) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.position.set(x, y, z);
        m.castShadow = m.receiveShadow = !LEVE;
        mesa.add(m);
        return m;
      };

      const campo = new THREE.Mesh(new THREE.PlaneGeometry(MESA.larg, MESA.comp),
        LEVE ? new THREE.MeshLambertMaterial({ map: Tex.campo() }) : new THREE.MeshStandardMaterial({ map: Tex.campo(), roughness: 0.55, metalness: 0, envMapIntensity: 0.35 }));
      campo.rotation.x = -Math.PI / 2;
      campo.receiveShadow = !LEVE;
      mesa.add(campo);

      /* Bordas compridas, as de fundo com a boca do gol, o corpo e os pés. */
      const ext = MX + PAREDE, extZ = MZ + PAREDE;
      for (const s of [-1, 1]) caixa(PAREDE, BORDA + 16, MESA.comp + PAREDE * 2, s * (MX + PAREDE / 2), (BORDA - 16) / 2, 0);
      const ladoGol = (MESA.larg - MESA.gol) / 2;
      for (const s of [-1, 1]) {
        const z = s * (MZ + PAREDE / 2);
        for (const lx of [-1, 1]) caixa(ladoGol, BORDA + 16, PAREDE, lx * (MESA.gol / 2 + ladoGol / 2), (BORDA - 16) / 2, z);
        caixa(MESA.gol, BORDA - 7.5, PAREDE, 0, 7.5 + (BORDA - 7.5) / 2, z);
        caixa(MESA.gol, 16, PAREDE, 0, -8, z);
      }
      caixa(ext * 2, 14, extZ * 2, 0, -12, 0);
      const perna = new THREE.CylinderGeometry(5, 4, -CHAO - 19, LEVE ? 8 : 16);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const p = new THREE.Mesh(perna, madeira);
          p.position.set(sx * (ext - 7), (CHAO - 19) / 2, sz * (extZ - 9));
          mesa.add(p);
        }
      }
      /* Cantos chanfrados. */
      const lado = MESA.chanfro / Math.SQRT2;
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const c = caixa(lado * 2, BORDA, lado * 2, sx * MX, BORDA / 2, sz * MZ);
          c.rotation.y = Math.PI / 4;
        }
      }

      /* A gaveta do gol: caixa escura atrás da boca, com rede no fundo. */
      this.redes = [];
      const texRede = Tex.rede();
      for (const s of [-1, 1]) {
        const z = s * (MZ + PAREDE + 5);
        caixa(MESA.gol + 4, 2, 12, 0, -1, s * (MZ + PAREDE / 2 + 3), escuro);
        const t = texRede.clone();
        t.needsUpdate = true;
        t.repeat.set(MESA.gol / 1.6, 9 / 1.6);
        const geo = new THREE.PlaneGeometry(MESA.gol, 9, 10, 5);
        const rede = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.8, color: 0xdfe6f0, side: THREE.DoubleSide, depthWrite: false }));
        rede.position.set(0, 3.5, z);
        mesa.add(rede);
        this.redes.push({ mesh: rede, base: Float32Array.from(geo.attributes.position.array), forca: 0, x: 0, t: 9 });
      }

      /* Vidro sobre as bordas: um painel baixo, quase invisível, com a aresta acesa. */
      const vidro = new THREE.MeshBasicMaterial({ color: 0xbfd8ff, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide });
      const aresta = new THREE.MeshBasicMaterial({ color: 0xe8f2ff, transparent: true, opacity: 0.55 });
      const vidroAlto = 9;
      for (const s of [-1, 1]) {
        const v = new THREE.Mesh(new THREE.PlaneGeometry(MESA.comp + PAREDE * 2, vidroAlto), vidro);
        v.rotation.y = Math.PI / 2;
        v.position.set(s * (MX + PAREDE / 2), BORDA + vidroAlto / 2, 0);
        mesa.add(v);
        const a = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, MESA.comp + PAREDE * 2), aresta);
        a.position.set(s * (MX + PAREDE / 2), BORDA + vidroAlto, 0);
        mesa.add(a);
      }
      for (const s of [-1, 1]) {
        const v = new THREE.Mesh(new THREE.PlaneGeometry(MESA.larg + PAREDE * 2, vidroAlto), vidro);
        v.position.set(0, BORDA + vidroAlto / 2, s * (MZ + PAREDE / 2));
        mesa.add(v);
        const a = new THREE.Mesh(new THREE.BoxGeometry(MESA.larg + PAREDE * 2, 0.35, 0.35), aresta);
        a.position.set(0, BORDA + vidroAlto, s * (MZ + PAREDE / 2));
        mesa.add(a);
      }

      /* Fita de LED no pé das bordas, por dentro, e a luz dela no campo.
         Metade de baixo na cor do A, de cima na do B. */
      this.leds = [];
      const fita = (w, d, x, z, lado) => {
        const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, d), mat);
        m.position.set(x, 0.5, z);
        mesa.add(m);
        const brilho = new THREE.MeshBasicMaterial({ map: this.tex.degrade, color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
        const comp = Math.max(w, d);
        const p = new THREE.Mesh(new THREE.PlaneGeometry(comp, 9), brilho);
        p.rotation.x = -Math.PI / 2;
        if (d > w) {
          p.rotation.z = x < 0 ? Math.PI / 2 : -Math.PI / 2;
          p.position.set(x - Math.sign(x) * 4.4, 0.06, z);
        } else {
          p.rotation.z = z < 0 ? Math.PI : 0;
          p.position.set(x, 0.06, z - Math.sign(z) * 4.4);
        }
        mesa.add(p);
        this.leds.push({ lado, mat, brilho });
      };
      for (const s of [-1, 1]) {
        fita(0.6, MZ - 1, s * (MX - 0.3), MZ / 2, 0);
        fita(0.6, MZ - 1, s * (MX - 0.3), -MZ / 2, 1);
      }
      const lg = (MESA.larg - MESA.gol) / 2 - 3;
      for (const lx of [-1, 1]) {
        fita(lg, 0.6, lx * (MESA.gol / 2 + 1.5 + lg / 2), MZ - 0.3, 0);
        fita(lg, 0.6, lx * (MESA.gol / 2 + 1.5 + lg / 2), -MZ + 0.3, 1);
      }

      /* Barra de luz sobre cada gol: acende na cor de quem marcou. */
      this.barraGol = [-1, 1].map(s => {
        const mat = new THREE.MeshBasicMaterial({ color: 0x333333 });
        const m = new THREE.Mesh(new THREE.BoxGeometry(MESA.gol, 1.2, 1.2), mat);
        m.position.set(0, BORDA + 0.6, s * (MZ + PAREDE / 2));
        mesa.add(m);
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.brilho, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
        halo.position.copy(m.position);
        halo.scale.set(60, 26, 1);
        mesa.add(halo);
        return { mat, halo };
      });

      /* Luz embaixo da mesa, no chão: a mesa "flutua" iluminada. */
      this.mesa = mesa;
    },

    montarVaretas() {
      const comp = MESA.larg + PAREDE * 2 + 70;
      const seg = LEVE ? 10 : 20;
      const geoVara = new THREE.CylinderGeometry(0.55, 0.55, comp, seg);
      geoVara.rotateZ(Math.PI / 2);
      const geoCabo = new THREE.CylinderGeometry(1.5, 1.5, 12, seg);
      geoCabo.rotateZ(Math.PI / 2);
      const geoAnel = new THREE.CylinderGeometry(1.0, 1.0, 1.2, seg);
      geoAnel.rotateZ(Math.PI / 2);
      this.matVara = [0, 1].map(() => LEVE
        ? new THREE.MeshPhongMaterial({ color: 0xc8ccd6, specular: 0xffffff, shininess: 90 })
        : new THREE.MeshStandardMaterial({ color: 0xe6e9f0, metalness: 1, roughness: 0.18, envMapIntensity: 1.3 }));
      this.matCabo = [0, 1].map(() => new THREE.MeshLambertMaterial({ color: 0x222222 }));
      const anel = new THREE.MeshLambertMaterial({ color: 0x15161a });
      this.varetas = VARETAS.map(([lado, funcao, homens], i) => {
        const g = new THREE.Group();
        const z = -(-MZ + (i + 0.5) * MESA.comp / VARETAS.length);
        g.position.set(0, VARA_Y, z);
        const l = lado === "a" ? 0 : 1;
        const vara = new THREE.Mesh(geoVara, this.matVara[l]);
        vara.castShadow = !LEVE;
        g.add(vara);
        const s = lado === "a" ? 1 : -1;
        const cabo = new THREE.Mesh(geoCabo, this.matCabo[l]);
        cabo.position.x = s * (comp / 2 - 6);
        g.add(cabo);
        for (const x of [-1, 1]) {
          const a = new THREE.Mesh(geoAnel, anel);
          a.position.x = x * (MX - 1.5);
          g.add(a);
        }
        this.scene.add(g);
        return { g, z, lado, l, funcao, homens };
      });
    },

    montarBonecos() {
      const geo = Personagens.malhaBoneco({ leve: LEVE });
      const mat = Personagens.materialBoneco(this.U, { leve: LEVE });
      this.indice = { a: [], b: [] };
      this.bonecos = [];
      for (const v of this.varetas) {
        v.homens.forEach((off, k) => {
          const lugar = FUNCOES[v.funcao].base + k;
          this.indice[v.lado][lugar] = this.bonecos.length;
          this.bonecos.push({ v, off, k, lugar, lado: v.lado, escala: 1, brilho: 0, pos: new THREE.Vector3() });
        });
      }
      this.elenco = new Personagens.Elenco(this.bonecos.length, geo, mat);
      this.elenco.mesh.castShadow = !LEVE;
      this.scene.add(this.elenco.mesh);
      this.m4 = new THREE.Matrix4();
      this.q = new THREE.Quaternion();
      this.e = new THREE.Euler();
      this.esc = new THREE.Vector3();
      this.peles = this.bonecos.map((_, i) => Personagens.PELES[(i * 7 + 3) % Personagens.PELES.length]);

      if (LEVE) {
        const sombras = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
          map: this.tex.sombra, transparent: true, depthWrite: false,
        }), this.bonecos.length);
        sombras.frustumCulled = false;
        this.scene.add(sombras);
        this.sombras = sombras;
      }
    },

    montarBolas() {
      const seg = LEVE ? 14 : 28;
      const geo = new THREE.SphereGeometry(RB, seg, Math.round(seg * 0.7));
      const [c, g] = canvas(128, 64);
      g.fillStyle = "#f6f3ea";
      g.fillRect(0, 0, 128, 64);
      g.fillStyle = "#ff7a1a";
      g.fillRect(0, 28, 128, 8);
      g.fillStyle = "rgba(0,0,0,.12)";
      for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 128, Math.random() * 64, 2, 2);
      const mapa = textura(c);
      this.bolas = [];
      for (let i = 0; i < MAX_BOLAS; i++) {
        const mat = LEVE
          ? new THREE.MeshLambertMaterial({ map: mapa })
          : new THREE.MeshStandardMaterial({ map: mapa, roughness: 0.28, metalness: 0, envMapIntensity: 0.9 });
        const m = new THREE.Mesh(geo, mat);
        m.castShadow = !LEVE;
        m.visible = false;
        this.scene.add(m);
        const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.brilho, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
        aura.scale.setScalar(12);
        this.scene.add(aura);
        const sombra = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.MeshBasicMaterial({ map: this.tex.sombra, transparent: true, depthWrite: false }));
        sombra.rotation.x = -Math.PI / 2;
        sombra.visible = LEVE;
        this.scene.add(sombra);
        this.bolas.push({ mesh: m, mat, aura, sombra, id: null, queda: 0, giro: new THREE.Quaternion(), ultima: new THREE.Vector3() });
      }
      /* A bola do gol: segue pra dentro da gaveta depois que o regras.js a tira da mesa. */
      this.bolaGol = { mesh: new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: mapa })), t: 9, x: 0, s: 1 };
      this.bolaGol.mesh.visible = false;
      this.scene.add(this.bolaGol.mesh);
    },

    montarEfeitos() {
      const n = LEVE ? 0.45 : 1;
      this.rastro = new Particulas(Math.round(500 * n), this.tex.brilho, true);
      this.formas = {
        estrela: new Particulas(Math.round(160 * n), this.tex.estrela, true),
        coracao: new Particulas(Math.round(160 * n), this.tex.coracao, true),
        raio: new Particulas(Math.round(160 * n), this.tex.raio, true),
      };
      this.fogo = new Particulas(Math.round(500 * n), this.tex.fumaca, true);
      this.fumaca = new Particulas(Math.round(200 * n), this.tex.fumaca, false);
      this.confetes = new Particulas(Math.round(900 * n), this.tex.papel, false);
      this.faiscas = new Particulas(Math.round(500 * n), this.tex.brilho, true);
      this.sistemas = [this.rastro, ...Object.values(this.formas), this.fogo, this.fumaca, this.confetes, this.faiscas];
      for (const s of this.sistemas) this.scene.add(s.pontos);

      /* Bloco de gelo em volta do goleiro congelado. */
      this.gelos = [0, 1].map(() => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(9, 15, 7), new THREE.MeshLambertMaterial({
          color: 0x9fe4ff, emissive: 0x2a6f9a, transparent: true, opacity: 0.45, depthWrite: false,
        }));
        m.visible = false;
        this.scene.add(m);
        const aresta = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: 0xe8fbff, transparent: true, opacity: 0.8 }));
        m.add(aresta);
        return { mesh: m, forca: 0 };
      });

      /* Paredão: escudo dourado da largura do goleiro na física. */
      this.paredoes = [0, 1].map(() => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(PAREDAO_X * 2, 13, 1.4), new THREE.MeshBasicMaterial({
          color: 0xffc83a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
        }));
        const aresta = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: 0xfff1b0, transparent: true, opacity: 0 }));
        m.add(aresta);
        m.visible = false;
        this.scene.add(m);
        return { mesh: m, aresta, forca: 0 };
      });

      /* Onda de choque do canhão. */
      this.ondas = [0, 1, 2].map(() => {
        const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 32), new THREE.MeshBasicMaterial({
          color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        }));
        m.rotation.x = -Math.PI / 2;
        this.scene.add(m);
        return { mesh: m, t: 9 };
      });
      this.fogos = [];
    },

    /* ───────────── clássico e cores ───────────── */

    classico(a, b) {
      this.timeA = a;
      this.timeB = b;
      const corA = corDeLuz(a), corB = corDeLuz(b);
      this.corLuz = [new THREE.Color(corA), new THREE.Color(corB)];
      for (const led of this.leds) {
        led.mat.color.copy(this.corLuz[led.lado]);
        led.brilho.color.copy(this.corLuz[led.lado]);
      }
      this.halosChao.forEach((h, i) => h.material.color.copy(this.corLuz[i]));
      const [kA, kB] = uniformes(a, b);
      this.matCabo[0].color.set(kA.cor);
      this.matCabo[1].color.set(kB.cor);
      this.bonecos.forEach((bo, i) => {
        const t = bo.lado === "a" ? kA : kB;
        this.elenco.vestir(i, { cor1: t.cor, cor2: t.cor2, calcao: t.calcao || t.cor2, padrao: t.padrao, pele: this.peles[i] });
      });
      this.torcida.pintar(a, b);
      const tex = Tex.faixa(a.sigla, b.sigla, a.cor, b.cor);
      for (const f of this.faixasTorcida) {
        if (f.material.map) f.material.map.dispose();
        const t = tex.clone();
        t.needsUpdate = true;
        t.repeat.set(f.geometry.parameters.width / 260, 1);
        f.material.map = t;
        f.material.needsUpdate = true;
      }
      for (const g of this.gelos) g.forca = 0;
      this.final = null;
    },

    corDo(timeId) {
      if (this.timeA && timeId === this.timeA.id) return this.corLuz[0];
      if (this.timeB && timeId === this.timeB.id) return this.corLuz[1];
      return new THREE.Color(0xffffff);
    },

    timeDo(timeId) {
      if (this.timeA && timeId === this.timeA.id) return this.timeA;
      if (this.timeB && timeId === this.timeB.id) return this.timeB;
      return null;
    },

    /* ───────────── acontecimentos ───────────── */

    /* Quem entrou (ou virou reforço) brilha um instante. */
    destacar(lado, lugar) {
      const i = this.indice[lado] && this.indice[lado][lugar];
      if (i == null) return;
      this.bonecos[i].brilho = 1;
      const p = this.bonecos[i].pos;
      const cor = this.corLuz[lado === "a" ? 0 : 1].toArray();
      for (let k = 0; k < (LEVE ? 6 : 14); k++) {
        this.faiscas.emitir({
          x: p.x, y: p.y + 4, z: p.z, vx: sorte(-30, 30), vy: sorte(10, 50), vz: sorte(-30, 30),
          vida: sorte(0.4, 0.8), tam: sorte(1.5, 3), tamFim: 0, cor, grav: 60, arrasto: 2,
        });
      }
    },

    chute(ev) {
      const cor = this.corDo(ev.time).toArray();
      const x = ev.x, z = -ev.y;
      const forte = ev.forca > 300 || ev.efeito === "canhao" || ev.bomba;
      for (let k = 0; k < (forte ? 16 : 5) * (LEVE ? 0.5 : 1); k++) {
        this.faiscas.emitir({
          x, y: R, z, vx: sorte(-40, 40), vy: sorte(5, 40), vz: sorte(-40, 40),
          vida: sorte(0.15, 0.35), tam: sorte(1, 2.5), tamFim: 0, cor: forte ? [1, 0.9, 0.6] : [1, 1, 1], arrasto: 4,
        });
      }
      if (ev.efeito === "canhao" || ev.bomba) {
        const o = this.ondas.find(w => w.t > 0.6) || this.ondas[0];
        o.t = 0;
        o.mesh.position.set(x, 0.3, z);
        o.mesh.material.color.setRGB(...(ev.efeito === "canhao" ? cor : [1, 0.85, 0.4]));
        this.tremor = Math.max(this.tremor, ev.efeito === "canhao" ? 0.7 : 0.35);
      }
      if (ev.efeito === "fogo") {
        this.queimarDefesa(ev.time);
        this.tremor = Math.max(this.tremor, 0.6);
      }
    },

    /* A defesa rival pega fogo: chamas em cada boneco do outro time. */
    queimarDefesa(time) {
      const lado = this.timeA && time === this.timeA.id ? "b" : "a";
      for (const bo of this.bonecos) {
        if (bo.lado !== lado) continue;
        for (let k = 0; k < (LEVE ? 3 : 7); k++) {
          this.fogo.emitir({
            x: bo.pos.x + sorte(-2, 2), y: sorte(0, 6), z: bo.pos.z + sorte(-1.5, 1.5),
            vx: sorte(-4, 4), vy: sorte(14, 30), vz: sorte(-4, 4),
            vida: sorte(0.5, 1), tam: sorte(5, 8), tamFim: 1.5, cor: [1, 0.55, 0.12], corFim: [0.7, 0.08, 0.01], alfa: 0.5,
          });
        }
      }
    },

    gol(ev) {
      const lado = ev.lado === "a" ? 0 : 1;
      const zGol = ev.lado === "a" ? -MZ : MZ;
      const t = this.timeDo(ev.time);
      const cor = this.corLuz[lado];
      const barra = this.barraGol[ev.lado === "a" ? 0 : 1];
      barra.mat.color.copy(cor);
      barra.halo.material.color.copy(cor);
      barra.halo.material.opacity = 1;
      const luz = this.luzGol[lado];
      luz.color.copy(cor);
      luz.intensity = LEVE ? 3 : 6;
      luz.position.set(ev.x, 10, zGol * 0.92);
      this.flash = 1;
      this.ledFesta = { lado, t: 0 };
      const rede = this.redes[ev.lado === "a" ? 0 : 1];
      rede.forca = 1;
      rede.x = ev.x;
      rede.t = 0;
      const bg = this.bolaGol;
      bg.t = 0;
      bg.x = ev.x;
      bg.s = Math.sign(zGol);
      bg.mesh.visible = !ev.chuva;
      if (!ev.chuva) {
        this.soco = 1;
        this.cam.alvo.set(ev.x * 0.5, 0, zGol);
      }
      this.tremor = Math.max(this.tremor, ev.chuva ? 0.4 : 1);
      const n = (ev.chuva ? 50 : 140) * (LEVE ? 0.45 : 1);
      const cores = t ? [rgb(t.cor), rgb(t.cor2), [1, 0.85, 0.2]] : [[1, 1, 1]];
      for (let k = 0; k < n; k++) {
        const c = cores[k % cores.length];
        this.confetes.emitir({
          x: ev.x + sorte(-8, 8), y: sorte(4, 12), z: zGol - Math.sign(zGol) * sorte(2, 10),
          vx: sorte(-70, 70), vy: sorte(60, 150), vz: -Math.sign(zGol) * sorte(10, 80),
          vida: sorte(1.8, 3.2), tam: sorte(1.4, 2.4), cor: c, grav: 90, arrasto: 1.6,
        });
      }
      this.festa(ev.time, 1);
    },

    /* A bola nova cai do alto no meio da mesa. */
    saque() { this.flashSaque = 1; },

    treme() { this.tremor = Math.max(this.tremor, 0.9); this.chacoalho = 1; },

    batida(ev) {
      if (ev.forca < 120 || LEVE) return;
      for (let k = 0; k < 3; k++) {
        this.faiscas.emitir({ x: ev.x, y: R, z: -ev.y, vx: sorte(-20, 20), vy: sorte(5, 25), vz: sorte(-20, 20), vida: 0.2, tam: 1.2, tamFim: 0, cor: [1, 1, 1], arrasto: 4 });
      }
    },

    gelo() { this.flash = Math.max(this.flash, 0.35); },

    chuva(ev) {
      this.fogosAgora(3, ev.time);
      this.flash = Math.max(this.flash, 0.6);
      this.festa(ev.time, 1);
    },

    turbo(ev) {
      this.festa(ev.time, 0.9);
      this.flash = Math.max(this.flash, 0.3);
    },

    /* Torcida do time comemora por um tempo (`forca` de 0 a 1). */
    festa(timeId, forca = 0.6) {
      const i = this.timeA && timeId === this.timeA.id ? 0 : this.timeB && timeId === this.timeB.id ? 1 : -1;
      if (i < 0) return;
      this.agito[i] = Math.max(this.agito[i], 0.4 + forca * 0.9);
    },

    confete(timeId, n = 40) {
      const t = this.timeDo(timeId);
      const cores = t ? [rgb(t.cor), rgb(t.cor2)] : [[1, 0.85, 0.2], [1, 1, 1]];
      const lado = this.timeA && timeId === this.timeA.id ? 1 : -1;
      for (let k = 0; k < n * (LEVE ? 0.5 : 1); k++) {
        this.confetes.emitir({
          x: sorte(-MX, MX), y: sorte(30, 60), z: lado * sorte(0, MZ) * 0.9,
          vx: sorte(-15, 15), vy: sorte(-10, 20), vz: sorte(-15, 15),
          vida: sorte(2, 3.5), tam: sorte(1.4, 2.2), cor: cores[k % 2], grav: 40, arrasto: 1.2,
        });
      }
    },

    fogosAgora(n, timeId) {
      const t = this.timeDo(timeId);
      for (let i = 0; i < n; i++) {
        this.agenda.push({ em: this.t + i * 0.35, f: () => {
          const x = sorte(-90, 90), y = sorte(120, 190), z = sorte(-180, -40);
          const cor = t && Math.random() < 0.6 ? rgb(corDeLuz(t)) : [1, 0.85, 0.3];
          for (let k = 0; k < (LEVE ? 30 : 70); k++) {
            const a = Math.random() * Math.PI * 2, b = Math.acos(sorte(-1, 1)), v = sorte(50, 80);
            this.faiscas.emitir({
              x, y, z, vx: Math.sin(b) * Math.cos(a) * v, vy: Math.cos(b) * v, vz: Math.sin(b) * Math.sin(a) * v,
              vida: sorte(0.9, 1.5), tam: sorte(4, 7), tamFim: 1, cor, corFim: [1, 1, 1], grav: 30, arrasto: 1.4,
            });
          }
        } });
      }
    },

    ocioso(sim) { this.ociosa = sim; },

    fim(ev) {
      const t = this.timeDo(ev.vencedor);
      this.final = { lado: this.timeA && ev.vencedor === this.timeA.id ? 0 : 1, t: 0 };
      this.fogosAgora(6, ev.vencedor);
      this.festa(ev.vencedor, 1);
      if (t) this.confete(ev.vencedor, 160);
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
      const mesa = estado.mesa;
      const alfa = estado.alfa ?? 1;
      const jogo = estado.jogo || null;
      if (mesa) {
        this.posarVaretas(mesa, alfa, jogo);
        this.posarParedoes();
        this.posarBolas(dt, mesa, alfa, jogo);
      }
      this.animarGol(dt);
      this.animarLuzes(dt, jogo);
      this.animarTorcida(dt);
      for (const o of this.ondas) {
        o.t += dt;
        const k = clamp(o.t / 0.45);
        o.mesh.scale.setScalar(2 + k * 26);
        o.mesh.material.opacity = (1 - k) * 0.9;
      }
      for (const s of this.sistemas) s.passo(dt);
      this.posarCamera(dt);
      this.renderer.render(this.scene, this.camera);
    },

    posarVaretas(mesa, alfa, jogo) {
      const t = this.t;
      const timeDe = lado => (jogo ? jogo.lado[lado] : null);
      for (let i = 0; i < this.varetas.length; i++) {
        const v = this.varetas[i], r = mesa.varetas[i];
        v.x = lerp(r.ant, r.pos, alfa);
        v.ang = lerp(r.angAnt, r.ang, alfa);
        v.g.position.x = v.x;
        v.g.rotation.x = v.lado === "a" ? v.ang : -v.ang;
        const time = timeDe(v.lado);
        v.turbo = jogo && jogo.turbo[time] > 0;
        v.gelo = jogo && v.funcao === "goleiro" && jogo.gelo[time] > 0;
        v.paredao = jogo && v.funcao === "goleiro" && jogo.paredao[time] > 0;
      }
      for (const l of [0, 1]) {
        const m = this.matVara[l];
        const turbo = this.varetas.some(v => v.l === l && v.turbo);
        const alvo = turbo ? 0.55 + 0.35 * Math.sin(t * 14) : 0;
        if (m.emissive) {
          m.emissive.copy(this.corLuz[l]);
          m.emissiveIntensity = suave(m.emissiveIntensity, alvo, 10, 1 / 60);
        }
      }

      const elenco = jogo ? { a: jogo.bonecos[jogo.a], b: jogo.bonecos[jogo.b] } : null;
      for (let i = 0; i < this.bonecos.length; i++) {
        const bo = this.bonecos[i], v = bo.v;
        const alvoEsc = v.paredao ? 1.18 : 1;
        bo.escala = suave(bo.escala, alvoEsc, 6, 1 / 60);
        bo.brilho = Math.max(0, bo.brilho - 1 / 60 / 1.2);
        bo.pos.set(v.x + bo.off, VARA_Y, v.z);
        this.e.set(v.lado === "a" ? v.ang : -v.ang, v.lado === "a" ? Math.PI : 0, 0, "XYZ");
        this.q.setFromEuler(this.e);
        this.esc.setScalar(bo.escala * ESCALA_BONECO);
        this.m4.compose(bo.pos, this.q, this.esc);
        this.elenco.mesh.setMatrixAt(i, this.m4);
        const dados = elenco && elenco[bo.lado][bo.lugar];
        const craque = dados && (dados.craque || v.paredao) ? 1 : 0;
        this.elenco.info(i, craque, Math.round(bo.brilho * 20) / 20, v.gelo ? 1 : 0);
        if (this.sombras) {
          const pe = Math.abs(Math.cos(v.ang));
          this.esc.set(4.6 * bo.escala, 3.6 * (0.6 + pe * 0.4), 1);
          this.e.set(-Math.PI / 2, 0, 0);
          this.q.setFromEuler(this.e);
          this.m4.compose(new THREE.Vector3(bo.pos.x, 0.08, bo.pos.z - (v.lado === "a" ? 1 : -1) * Math.sin(v.ang) * 4), this.q, this.esc);
          this.sombras.setMatrixAt(i, this.m4);
        }
      }
      this.elenco.mesh.instanceMatrix.needsUpdate = true;
      if (this.sombras) this.sombras.instanceMatrix.needsUpdate = true;

      for (const l of [0, 1]) {
        const g = this.gelos[l];
        const v = this.varetas.find(x => x.l === l && x.funcao === "goleiro");
        g.forca = suave(g.forca, v.gelo ? 1 : 0, 8, 1 / 60);
        g.mesh.visible = g.forca > 0.02;
        if (g.mesh.visible) {
          g.mesh.position.set(v.x, VARA_Y - 1, v.z);
          g.mesh.scale.setScalar(0.6 + g.forca * 0.4);
          g.mesh.material.opacity = 0.45 * g.forca;
          if (Math.random() < 0.3) {
            this.faiscas.emitir({ x: v.x + sorte(-5, 5), y: sorte(0, 12), z: v.z + sorte(-3, 3), vy: sorte(2, 8), vida: 0.8, tam: sorte(1, 2), tamFim: 0, cor: [0.7, 0.92, 1] });
          }
        }
      }
    },

    posarParedoes() {
      for (const l of [0, 1]) {
        const p = this.paredoes[l];
        const v = this.varetas.find(x => x.l === l && x.funcao === "goleiro");
        p.forca = suave(p.forca, v.paredao ? 1 : 0, 6, 1 / 60);
        p.mesh.visible = p.forca > 0.02;
        if (!p.mesh.visible) continue;
        const pulso = 0.8 + 0.2 * Math.sin(this.t * 8);
        p.mesh.position.set(v.x, 6.5, v.z);
        p.mesh.scale.set(p.forca, 1, 1);
        p.mesh.material.opacity = 0.32 * p.forca * pulso;
        p.aresta.material.opacity = 0.9 * p.forca;
      }
    },

    posarBolas(dt, mesa, alfa, jogo) {
      const especial = jogo ? [jogo.especial[jogo.a], jogo.especial[jogo.b]] : [null, null];
      const pendente = especial[0] ? { e: especial[0], l: 0 } : especial[1] ? { e: especial[1], l: 1 } : null;
      const vivas = new Set(mesa.bolas.map(b => b.id));
      for (const vis of this.bolas) if (vis.id !== null && !vivas.has(vis.id)) vis.id = null;
      for (const b of mesa.bolas) {
        let vis = this.bolas.find(x => x.id === b.id);
        if (!vis) {
          vis = this.bolas.find(x => x.id === null);
          if (!vis) continue;
          vis.id = b.id;
          vis.queda = 1;
          vis.ultima.set(b.x, R, -b.y);
        }
        vis.vivo = true;
        const x = lerp(b.ax, b.x, alfa), z = -lerp(b.ay, b.y, alfa);
        vis.queda = Math.max(0, vis.queda - dt * 2.4);
        const q = vis.queda;
        const altura = q > 0 ? 34 * q * q + Math.abs(Math.sin((1 - q) * Math.PI * 2.5)) * 3 * q : 0;
        vis.mesh.visible = true;
        vis.mesh.position.set(x, RB + altura, z);
        const dx = x - vis.ultima.x, dz = z - vis.ultima.z;
        const d = Math.hypot(dx, dz);
        if (d > 1e-4) {
          const eixo = new THREE.Vector3(dz / d, 0, -dx / d);
          vis.giro.premultiply(new THREE.Quaternion().setFromAxisAngle(eixo, d / RB));
          vis.mesh.quaternion.copy(vis.giro);
        }
        vis.ultima.set(x, R, z);
        vis.sombra.position.set(x + altura * 0.15, 0.05, z);
        vis.sombra.scale.setScalar(1 + altura * 0.03);

        const vel = Math.hypot(b.vx, b.vy);
        const ef = b.efeito;
        let auraCor = null, auraTam = 0;
        if (b.fogo || (pendente && pendente.e.efeito === "fogo" && !b.extra)) {
          auraCor = [1, 0.42, 0.05]; auraTam = 24;
          for (let k = 0; k < (LEVE ? 1 : 3); k++) {
            this.fogo.emitir({
              x: x + sorte(-1, 1), y: R + sorte(0, 1.5), z: z + sorte(-1, 1), vx: sorte(-3, 3), vy: sorte(10, 22), vz: sorte(-3, 3),
              vida: sorte(0.3, 0.6), tam: sorte(7, 11), tamFim: 2, cor: [1, 0.6, 0.15], corFim: [0.8, 0.1, 0.01], alfa: 0.7,
            });
          }
        } else if (pendente && !b.extra) {
          auraCor = this.corLuz[pendente.l].toArray();
          auraTam = 10 + Math.sin(this.t * 10) * 2;
        }
        if (ef && vel > 25) {
          const l = this.timeA && ef.time === this.timeA.id ? 0 : 1;
          const cor = this.corLuz[l].toArray();
          if (ef.efeito === "brilho") {
            const s = this.formas[ef.forma] || this.formas.estrela;
            if (Math.random() < (LEVE ? 0.5 : 1)) s.emitir({ x, y: R + 1, z, vx: sorte(-6, 6), vy: sorte(2, 10), vz: sorte(-6, 6), vida: 0.7, tam: sorte(3, 5), tamFim: 0.5, cor, corFim: [1, 1, 1] });
          } else if (ef.efeito === "canhao") {
            this.fumaca.emitir({ x, y: R, z, vx: sorte(-3, 3), vy: sorte(1, 5), vz: sorte(-3, 3), vida: 0.8, tam: 4, tamFim: 10, cor: [0.8, 0.8, 0.85], alfa: 0.5 });
          }
          auraCor = auraCor || cor;
          auraTam = Math.max(auraTam, 9);
          this.rastro.emitir({ x, y: R, z, vida: 0.35, tam: 4.2, tamFim: 0.5, cor, alfa: 0.9 });
        } else if (vel > 140) {
          this.rastro.emitir({ x, y: R, z, vida: 0.18, tam: 3, tamFim: 0.5, cor: [1, 1, 1], alfa: 0.5 });
        }
        if (b.extra) { auraCor = auraCor || [1, 0.85, 0.35]; auraTam = Math.max(auraTam, 9); }
        if (this.ociosa) { auraCor = [1, 1, 1]; auraTam = 10 + Math.sin(this.t * 4) * 3; }
        vis.aura.position.set(x, RB + altura, z);
        if (auraCor) {
          vis.aura.material.color.setRGB(...auraCor);
          vis.aura.material.opacity = 0.85;
          vis.aura.scale.setScalar(auraTam);
        } else {
          /* Bola branca some no meio dos bonecos na tela do celular: halo fraco o tempo todo. */
          vis.aura.material.color.setRGB(1, 0.9, 0.55);
          vis.aura.material.opacity = 0.6;
          vis.aura.scale.setScalar(8);
        }
      }
      for (const vis of this.bolas) {
        if (vis.id === null) {
          vis.mesh.visible = false;
          vis.sombra.visible = false;
          vis.aura.material.opacity = 0;
        } else vis.sombra.visible = LEVE;
      }
      const fogoVivo = mesa.bolas.some(b => b.fogo) || (pendente && pendente.e.efeito === "fogo");
      const principal = this.bolas.find(v => v.id !== null);
      this.luzBola.intensity = suave(this.luzBola.intensity, fogoVivo && principal ? 2.5 : 0, 8, dt);
      if (principal) this.luzBola.position.copy(principal.mesh.position).setY(8);
    },

    animarGol(dt) {
      const bg = this.bolaGol;
      if (bg.mesh.visible) {
        bg.t += dt;
        const k = bg.t;
        const z = bg.s * (MZ + R + Math.min(1, k * 4) * 6);
        const y = RB - Math.max(0, k - 0.15) * Math.max(0, k - 0.15) * 260;
        bg.mesh.position.set(bg.x, Math.max(-1.5, y), z);
        if (k > 1.2) bg.mesh.visible = false;
      }
      for (const r of this.redes) {
        r.t += dt;
        const forca = r.forca * Math.exp(-r.t * 3) * Math.cos(r.t * 16);
        const pos = r.mesh.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const x = r.base[i * 3], y = r.base[i * 3 + 1];
          const d = Math.exp(-((x - r.x) ** 2) / 30 - (y * y) / 20);
          pos.setZ(i, (r.mesh.position.z > 0 ? 1 : -1) * forca * d * 4);
        }
        pos.needsUpdate = true;
        if (r.t > 2) r.forca = 0;
      }
      for (const b of this.barraGol) b.halo.material.opacity = Math.max(0, b.halo.material.opacity - dt * 0.5);
      for (const l of this.luzGol) l.intensity = Math.max(0, l.intensity - dt * 3);
    },

    animarLuzes(dt, jogo) {
      const festa = this.ledFesta;
      if (festa) {
        festa.t += dt;
        if (festa.t > 2.6) this.ledFesta = null;
      }
      const turbo = jogo ? [jogo.turbo[jogo.a] > 0, jogo.turbo[jogo.b] > 0] : [false, false];
      for (const led of this.leds) {
        let forca = 0.55;
        const cor = festa ? this.corLuz[festa.lado] : this.corLuz[led.lado];
        if (festa) forca = 0.6 + 0.4 * (Math.sin(festa.t * 18) > 0 ? 1 : 0.2);
        else if (turbo[led.lado]) forca = 0.6 + 0.4 * Math.abs(Math.sin(this.t * 10));
        if (this.final) forca = 0.55 + 0.45 * Math.abs(Math.sin(this.t * 6));
        const c = this.final ? this.corLuz[this.final.lado] : cor;
        led.mat.color.copy(c);
        led.brilho.color.copy(c);
        led.brilho.opacity = forca;
      }
      const respira = this.ociosa ? 0.8 + Math.sin(this.t * 1.4) * 0.2 : 1;
      this.matFeixe.uniforms.uForca.value = 0.07 * respira + this.flash * 0.06;
      for (const h of this.halos) h.material.opacity = 0.9 * respira;
      this.flash = Math.max(0, this.flash - dt * 2.2);
      this.flashSaque = Math.max(0, (this.flashSaque || 0) - dt * 2);
      this.renderer.toneMappingExposure = 1.1 + this.flash * 0.35;
      if (this.final) this.final.t += dt;
    },

    animarTorcida(dt) {
      for (let i = 0; i < 2; i++) {
        this.agito[i] = suave(this.agito[i], this.ociosa ? 0.15 : 0.3, 0.5, dt);
      }
      this.U.uAgito.value.set(this.agito[0], this.agito[1]);
    },

    /* Câmera atrás do gol do A, alta e inclinada; o gol dá um soco na
       direção da rede e a tela treme. */
    posarCamera(dt, primeira = false) {
      const base = new THREE.Vector3(0, 128, 96);
      const olhar = new THREE.Vector3(0, 0, -9);
      if (this.ociosa) {
        base.x += Math.sin(this.t * 0.25) * 10;
        base.y -= 6;
      }
      this.soco = Math.max(0, this.soco - dt * 0.7);
      const s = Math.sin(Math.min(1, this.soco) * Math.PI * 0.5);
      const punch = s * s;
      const alvo = this.cam.alvo;
      base.lerp(new THREE.Vector3(alvo.x * 0.5, 92, alvo.z + 78), punch * 0.4);
      olhar.lerp(alvo, punch * 0.45);
      if (this.final) {
        const k = clamp(this.final.t / 3);
        base.y -= k * 18;
        base.z -= k * 20;
      }
      if (primeira) {
        this.cam.pos.copy(base);
        this.cam.olhar.copy(olhar);
      } else {
        this.cam.pos.lerp(base, 1 - Math.exp(-6 * dt));
        this.cam.olhar.lerp(olhar, 1 - Math.exp(-6 * dt));
      }
      this.tremor = Math.max(0, this.tremor - dt * 2.2);
      const tr = this.tremor * this.tremor * 2.2;
      this.camera.position.copy(this.cam.pos).add(new THREE.Vector3(sorte(-tr, tr), sorte(-tr, tr), sorte(-tr, tr)));
      this.camera.lookAt(this.cam.olhar);
      this.chacoalho = Math.max(0, (this.chacoalho || 0) - dt * 2);
      this.mesa.position.x = Math.sin(this.t * 60) * this.chacoalho * 0.6;
      if (this.fovBase) {
        this.camera.fov = this.fovBase * (1 - punch * 0.08);
        this.camera.updateProjectionMatrix();
      }
    },

    /* Onde cada boneco aparece na tela (px do palco), pro @ em cima dele. */
    rotulos(saida) {
      const v = new THREE.Vector3();
      for (let i = 0; i < this.bonecos.length; i++) {
        const bo = this.bonecos[i];
        v.set(bo.pos.x, bo.pos.y + 6.5, bo.pos.z).project(this.camera);
        const o = saida[i] || (saida[i] = {});
        o.lado = bo.lado;
        o.lugar = bo.lugar;
        o.x = (v.x * 0.5 + 0.5) * this.W;
        o.y = (-v.y * 0.5 + 0.5) * this.H;
        o.prof = v.z;
        o.perto = -v.y * 0.5 + 0.5;
      }
      return saida;
    },
  };
})();
