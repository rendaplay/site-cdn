/* O estádio à noite em three.js: o círculo central em cima de um tablado
   de grama, o gramado listrado, a arquibancada com a torcida e os flashes,
   os refletores, os 12 mascotes, o juiz e os efeitos. Lê a posição de
   cada um direto da Arena (regras.js) e só desenha: pose, rosto, queda,
   partículas e câmera. Por cima do canvas, em DOM: a placa de cada time,
   os @ que pipocam, o clarão e a vinheta.

   A câmera lenta da voadora sai daqui (`lento`): o jogo multiplica o passo
   das regras por ela, então a física e a imagem andam juntas. */
"use strict";

const Cena = (() => {
  const LEVE = new URLSearchParams(location.search).get("leve") === "1";
  const ALTO = 0.32;
  const HFOV = 38;
  const DPR_MAX = LEVE ? 1 : 1.75;
  const MAX_POPS = 4;

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const suave = (atual, alvo, taxa, dt) => atual + (alvo - atual) * (1 - Math.exp(-taxa * dt));
  const sorte = (a, b) => a + Math.random() * (b - a);
  const giroAte = (de, para) => {
    let d = (para - de) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  };
  const corRGB = hex => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };

  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();

  /* ───────────── partículas ───────────── */

  class Particulas {
    constructor(max, mapa, aditivo) {
      this.max = max;
      this.i = 0;
      this.d = {
        p: new Float32Array(max * 3), v: new Float32Array(max * 3),
        vida: new Float32Array(max), vidaMax: new Float32Array(max),
        tam0: new Float32Array(max), tam1: new Float32Array(max),
        alfa: new Float32Array(max), arrasto: new Float32Array(max), grav: new Float32Array(max),
        cor0: new Float32Array(max * 3), cor1: new Float32Array(max * 3), chao: new Float32Array(max),
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
      d.chao[i] = o.chao ?? ALTO;
      d.cor0.set(o.cor || [1, 1, 1], i * 3);
      d.cor1.set(o.corFim || o.cor || [1, 1, 1], i * 3);
    }

    passo(dt) {
      const d = this.d;
      const P = this.pos.array, C = this.cor.array, T = this.tam.array, A = this.alf.array;
      for (let i = 0; i < this.max; i++) {
        if (d.vida[i] <= 0) { if (A[i] !== 0) { A[i] = 0; T[i] = 0; } continue; }
        d.vida[i] -= dt;
        const k = i * 3;
        const ar = Math.exp(-d.arrasto[i] * dt);
        d.v[k] *= ar; d.v[k + 1] = d.v[k + 1] * ar - d.grav[i] * dt; d.v[k + 2] *= ar;
        d.p[k] += d.v[k] * dt;
        d.p[k + 1] += d.v[k + 1] * dt;
        d.p[k + 2] += d.v[k + 2] * dt;
        if (d.p[k + 1] < d.chao[i] && d.grav[i] > 0) { d.p[k + 1] = d.chao[i]; d.v[k + 1] *= -0.3; d.v[k] *= 0.6; d.v[k + 2] *= 0.6; }
        const t = 1 - Math.max(0, d.vida[i]) / d.vidaMax[i];
        P[k] = d.p[k]; P[k + 1] = d.p[k + 1]; P[k + 2] = d.p[k + 2];
        for (let c = 0; c < 3; c++) C[k + c] = lerp(d.cor0[k + c], d.cor1[k + c], t);
        T[i] = lerp(d.tam0[i], d.tam1[i], t);
        A[i] = d.alfa[i] * (t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88);
      }
      for (const a of [this.pos, this.cor, this.tam, this.alf]) a.needsUpdate = true;
    }
  }

  /* Confete de papel de verdade: quadradinhos que giram e caem rodando. */
  class Confete {
    constructor(max, raio) {
      this.max = max;
      this.raio = raio + 0.1;
      this.i = 0;
      this.malha = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.11, 0.07),
        new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }), max);
      this.malha.frustumCulled = false;
      this.malha.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.p = new Float32Array(max * 3);
      this.v = new Float32Array(max * 3);
      this.giro = new Float32Array(max * 3);
      this.vida = new Float32Array(max);
      this.m = new THREE.Matrix4();
      this.q = new THREE.Quaternion();
      this.e = new THREE.Euler();
      this.s = new THREE.Vector3();
      this.c = new THREE.Color();
      const zero = new THREE.Matrix4().makeScale(0, 0, 0);
      for (let i = 0; i < max; i++) {
        this.malha.setMatrixAt(i, zero);
        this.malha.setColorAt(i, this.c.set(0xffffff));
      }
    }

    emitir(x, y, z, vx, vy, vz, cor) {
      const i = this.i;
      this.i = (this.i + 1) % this.max;
      this.p.set([x, y, z], i * 3);
      this.v.set([vx, vy, vz], i * 3);
      this.giro.set([sorte(0, 6), sorte(0, 6), sorte(0, 6)], i * 3);
      this.vida[i] = sorte(3.5, 5.5);
      this.malha.setColorAt(i, this.c.set(cor));
      this.malha.instanceColor.needsUpdate = true;
    }

    passo(dt, t) {
      const { p, v, giro, vida } = this;
      let algum = false;
      for (let i = 0; i < this.max; i++) {
        if (vida[i] <= 0) continue;
        algum = true;
        vida[i] -= dt;
        const k = i * 3;
        const ar = Math.exp(-2.2 * dt);
        v[k] = v[k] * ar + Math.sin(t * 3 + i) * 0.6 * dt;
        v[k + 1] = Math.max(-1.3, v[k + 1] * ar - 6 * dt);
        v[k + 2] = v[k + 2] * ar + Math.cos(t * 2.6 + i) * 0.6 * dt;
        p[k] += v[k] * dt; p[k + 1] += v[k + 1] * dt; p[k + 2] += v[k + 2] * dt;
        const chao = Math.hypot(p[k], p[k + 2]) < this.raio ? ALTO + 0.01 : 0.01;
        if (p[k + 1] < chao) { p[k + 1] = chao; v[k] = v[k + 1] = v[k + 2] = 0; }
        const parado = p[k + 1] <= chao + 0.001;
        if (!parado) for (let c = 0; c < 3; c++) giro[k + c] += dt * (4 + c * 1.7);
        this.e.set(parado ? -Math.PI / 2 : giro[k], parado ? 0 : giro[k + 1], giro[k + 2]);
        const esc = vida[i] < 0.6 ? vida[i] / 0.6 : 1;
        this.s.set(esc, esc, esc);
        this.m.compose(v1.set(p[k], p[k + 1], p[k + 2]), this.q.setFromEuler(this.e), this.s);
        this.malha.setMatrixAt(i, this.m);
      }
      if (algum) this.malha.instanceMatrix.needsUpdate = true;
    }
  }

  /* ───────────── céu e estádio ───────────── */

  function fundo() {
    const c = document.createElement("canvas");
    c.width = 4; c.height = 256;
    const g = c.getContext("2d");
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, "#03040c");
    gr.addColorStop(0.55, "#0b1230");
    gr.addColorStop(1, "#1c2a5c");
    g.fillStyle = gr;
    g.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  function estrela(raio) {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2, r = i % 2 ? raio * 0.45 : raio;
      s[i ? "lineTo" : "moveTo"](Math.sin(a) * r, Math.cos(a) * r);
    }
    return new THREE.ExtrudeGeometry(s, { depth: raio * 0.3, bevelEnabled: false });
  }

  return {
    t: 0,
    lento: 1,
    tremor: 0,
    flash: 0,

    montar(canvas, palco, cfg, aoMomento) {
      this.cfg = cfg;
      this.R = cfg.arena.raio;
      this.aoMomento = aoMomento || (() => {});
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !LEVE, powerPreference: "high-performance" });
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.15;
      this.renderer.shadowMap.enabled = !LEVE;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.scene = new THREE.Scene();
      this.scene.background = fundo();
      this.scene.fog = new THREE.Fog(0x0b1230, 40, 120);
      this.camera = new THREE.PerspectiveCamera(50, 9 / 16, 0.1, 400);

      this.tex = {
        brilho: Texturas.brilho(), poeira: Texturas.poeira(), facho: Texturas.facho(),
        sombra: Texturas.sombra(), tigre: Texturas.tigre(), led: Texturas.led(),
      };
      this.montarLuz();
      this.montarEstadio();
      this.montarArena();
      this.montarMascotes();
      this.montarJuiz();
      this.montarEfeitos();
      this.montarTela(palco);
      this.cam = { pos: new THREE.Vector3(0, 12, 14), olhar: new THREE.Vector3(0, 0.5, 0.6), fov: 50, corte: true };
      this.diretorModo = { modo: "base" };
      this.agenda = [];
    },

    montarLuz() {
      const s = this.scene;
      s.add(new THREE.HemisphereLight(0x5a6fb0, 0x10200f, 0.6));
      /* Refletor da frente (atrás da câmera, à esquerda): faz a sombra
         cair pra trás e acende o rosto de todo mundo. */
      this.luz = new THREE.DirectionalLight(0xf4f6ff, 2.4);
      this.luz.position.set(-9, 20, 13);
      this.luz.castShadow = !LEVE;
      this.luz.shadow.mapSize.set(2048, 2048);
      const c = this.luz.shadow.camera;
      c.left = -8; c.right = 8; c.top = 8; c.bottom = -8; c.near = 5; c.far = 50;
      this.luz.shadow.bias = -0.0005;
      this.luz.shadow.normalBias = 0.03;
      s.add(this.luz, this.luz.target);
      /* Os do fundo recortam a silhueta. */
      const contra1 = new THREE.DirectionalLight(0xbfd4ff, 1.4);
      contra1.position.set(-14, 16, -20);
      const contra2 = new THREE.DirectionalLight(0xffe7c0, 1.1);
      contra2.position.set(15, 14, -18);
      const frente = new THREE.DirectionalLight(0xffffff, 0.55);
      frente.position.set(6, 6, 14);
      s.add(contra1, contra2, frente);
      this.luzAura = new THREE.PointLight(0xffd040, 0, 7, 1.5);
      s.add(this.luzAura);
    },

    /* Gramado inteiro, linhas, placas de LED, arquibancada com a torcida
       e os quatro refletores (os dois do fundo aparecem). */
    montarEstadio() {
      const s = this.scene;
      const grama = this.tex.gramado = Texturas.gramado();
      grama.repeat.set(10, 12);
      const campo = new THREE.Mesh(new THREE.PlaneGeometry(76, 110),
        new THREE.MeshStandardMaterial({ map: grama, roughness: 0.95, color: 0x5d7566 }));
      campo.rotation.x = -Math.PI / 2;
      campo.receiveShadow = true;
      s.add(campo);

      const cal = new THREE.MeshBasicMaterial({ color: 0xdfe8df, toneMapped: true });
      const linha = (w, d, x, z) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), cal);
        m.rotation.x = -Math.PI / 2;
        m.position.set(x, 0.01, z);
        s.add(m);
      };
      linha(68, 0.14, 0, 0);
      linha(0.14, 105, -34, 0);
      linha(0.14, 105, 34, 0);
      linha(68, 0.14, 0, -52.5);
      linha(40.3, 0.14, 0, -36);
      linha(0.14, 16.5, -20.15, -44.25);
      linha(0.14, 16.5, 20.15, -44.25);
      const roda = new THREE.Mesh(new THREE.RingGeometry(9.08, 9.22, 96), cal);
      roda.rotation.x = -Math.PI / 2;
      roda.position.y = 0.012;
      s.add(roda);

      /* Placas de LED no fundo e nas laterais. */
      const led = this.tex.led;
      led.repeat.set(14, 1);
      this.ledMat = new THREE.MeshBasicMaterial({ map: led, toneMapped: false, color: 0xbbbbbb });
      const placa = (w, x, z, ry) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.9), this.ledMat);
        m.position.set(x, 0.45, z);
        m.rotation.y = ry;
        s.add(m);
      };
      placa(72, 0, -55.5, 0);
      placa(100, -37, 0, Math.PI / 2);
      placa(100, 37, 0, -Math.PI / 2);

      /* Arquibancada: degraus escuros e a torcida em instâncias. O pulo da
         torcida anda no shader (sem mexer em matriz por quadro). */
      const concreto = new THREE.MeshStandardMaterial({ color: 0x1b2130, roughness: 0.95 });
      const degraus = 14;
      const lados = [
        { x: 0, z: -58, ry: 0, w: 90 },
        { x: -41, z: -4, ry: Math.PI / 2, w: 120 },
        { x: 41, z: -4, ry: -Math.PI / 2, w: 120 },
      ];
      const lugares = [];
      for (const l of lados) {
        const g = new THREE.Group();
        g.position.set(l.x, 0, l.z);
        g.rotation.y = l.ry;
        for (let i = 0; i < degraus; i++) {
          const m = new THREE.Mesh(new THREE.BoxGeometry(l.w, 0.9, 1.6), concreto);
          m.position.set(0, 1.2 + i * 0.95, -i * 1.5);
          g.add(m);
        }
        const teto = new THREE.Mesh(new THREE.BoxGeometry(l.w, 0.6, 14), new THREE.MeshStandardMaterial({ color: 0x0c0f18, roughness: 1 }));
        teto.position.set(0, degraus * 0.95 + 6, -degraus * 1.5 + 3);
        g.add(teto);
        s.add(g);
        g.updateMatrixWorld(true);
        const passo = LEVE ? 1.1 : 0.7;
        for (let i = 0; i < degraus; i++) {
          for (let x = -l.w / 2 + 0.5; x < l.w / 2; x += passo * sorte(0.8, 1.3)) {
            if (Math.random() < 0.12) continue;
            v1.set(x, 1.65 + i * 0.95 + 0.35, -i * 1.5 + sorte(-0.2, 0.3)).applyMatrix4(g.matrixWorld);
            lugares.push(v1.clone());
          }
        }
      }
      const cores = this.cfg.times.flatMap(t => [t.cor, t.cor2]).concat(["#d8d8d8", "#2a2a2a", "#c8a070", "#7a4a30"]);
      const torcida = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.62, 0.32),
        new THREE.MeshStandardMaterial({ roughness: 0.9 }), lugares.length);
      const fase = new Float32Array(lugares.length);
      const m = new THREE.Matrix4(), cor = new THREE.Color();
      lugares.forEach((p, i) => {
        m.makeTranslation(p.x, p.y, p.z);
        torcida.setMatrixAt(i, m);
        torcida.setColorAt(i, cor.set(cores[Math.floor(Math.random() * cores.length)]).multiplyScalar(sorte(0.35, 0.7)));
        fase[i] = Math.random() * 6.28;
      });
      torcida.geometry.setAttribute("aFase", new THREE.InstancedBufferAttribute(fase, 1));
      this.uTorcida = { uTempo: { value: 0 }, uPulo: { value: 0.15 } };
      torcida.material.onBeforeCompile = sh => {
        Object.assign(sh.uniforms, this.uTorcida);
        sh.vertexShader = sh.vertexShader
          .replace("#include <common>", "#include <common>\nattribute float aFase;\nuniform float uTempo;\nuniform float uPulo;")
          .replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed.y += max(0.0, sin(uTempo * 7.0 + aFase)) * uPulo;");
      };
      s.add(torcida);
      this.lugares = lugares;

      /* Flash de celular piscando na torcida. */
      const nFlash = LEVE ? 60 : 160;
      this.flashes = new Particulas(nFlash, this.tex.brilho, true);
      s.add(this.flashes.pontos);

      /* Refletores: torre, painel de lâmpadas acesas, brilho e o facho. */
      const ferro = new THREE.MeshStandardMaterial({ color: 0x2a3040, roughness: 0.7, metalness: 0.4 });
      const lampada = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
      const brilhoMat = new THREE.SpriteMaterial({ map: this.tex.brilho, color: 0xdfe9ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
      const fachoMat = new THREE.MeshBasicMaterial({ map: this.tex.facho, color: 0x9fb8ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, side: THREE.DoubleSide, opacity: 0.5 });
      for (const [x, z] of [[-22, -57], [22, -57]]) {
        const alto = 16;
        const torre = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, alto, 8), ferro);
        torre.position.set(x, alto / 2, z);
        s.add(torre);
        const painel = new THREE.Group();
        painel.position.set(x, alto + 1.5, z);
        painel.lookAt(0, 0, 0);
        const fundoP = new THREE.Mesh(new THREE.BoxGeometry(7, 4, 0.4), ferro);
        painel.add(fundoP);
        for (let i = 0; i < 4; i++) for (let k = 0; k < 6; k++) {
          const l = new THREE.Mesh(new THREE.CircleGeometry(0.42, 12), lampada);
          l.position.set(-2.8 + k * 1.12, -1.4 + i * 0.95, 0.22);
          painel.add(l);
        }
        s.add(painel);
        const b = new THREE.Sprite(brilhoMat);
        b.scale.set(26, 18, 1);
        b.position.copy(painel.position);
        s.add(b);
        const comp = Math.hypot(x, alto, z) * 0.8;
        const cone = new THREE.Mesh(new THREE.CylinderGeometry(3, 12, comp, 20, 1, true), fachoMat);
        cone.geometry.translate(0, -comp / 2, 0);
        cone.position.copy(painel.position);
        cone.lookAt(0, 0, 0);
        cone.rotateX(-Math.PI / 2);
        s.add(cone);
      }
    },

    /* O tablado: grama listrada por cima, cal na borda e na linha do
       meio, lateral escura com faixa branca. */
    montarArena() {
      const R = this.R;
      const grama = Texturas.gramado();
      grama.repeat.set(1.2, 1.4);
      grama.center.set(0.5, 0.5);
      const topo = new THREE.MeshStandardMaterial({ map: grama, roughness: 0.9 });
      const lado = new THREE.MeshStandardMaterial({ color: 0x1f4a26, roughness: 0.9 });
      this.tablado = new THREE.Group();
      const disco = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.04, R + 0.2, ALTO, 72, 1), [lado, topo, lado]);
      disco.position.y = ALTO / 2;
      disco.receiveShadow = true;
      disco.castShadow = !LEVE;
      this.tablado.add(disco);
      const cal = new THREE.MeshBasicMaterial({ color: 0xf2f6f0 });
      const borda = new THREE.Mesh(new THREE.RingGeometry(R - 0.16, R - 0.02, 96), cal);
      borda.rotation.x = -Math.PI / 2;
      borda.position.y = ALTO + 0.006;
      this.tablado.add(borda);
      const meio = new THREE.Mesh(new THREE.PlaneGeometry((R - 0.1) * 2, 0.12), cal);
      meio.rotation.x = -Math.PI / 2;
      meio.position.y = ALTO + 0.005;
      this.tablado.add(meio);
      const ponto = new THREE.Mesh(new THREE.CircleGeometry(0.16, 24), cal);
      ponto.rotation.x = -Math.PI / 2;
      ponto.position.y = ALTO + 0.007;
      this.tablado.add(ponto);
      const faixa = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.1, R + 0.13, 0.06, 72, 1, true), cal);
      faixa.position.y = ALTO - 0.08;
      this.tablado.add(faixa);
      this.scene.add(this.tablado);

      /* Anel que acende na borda quando alguém está na beira. */
      this.anelPerigo = new THREE.Mesh(new THREE.RingGeometry(R - 0.2, R + 0.05, 96),
        new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.anelPerigo.rotation.x = -Math.PI / 2;
      this.anelPerigo.position.y = ALTO + 0.01;
      this.scene.add(this.anelPerigo);
    },

    montarMascotes() {
      this.bonecos = new Map();
      const sombraMat = new THREE.MeshBasicMaterial({ map: this.tex.sombra, transparent: true, depthWrite: false, opacity: LEVE ? 0.8 : 0.45 });
      const estrelaGeo = estrela(0.09);
      const estrelaMat = new THREE.MeshBasicMaterial({ color: 0xffe14a, toneMapped: false });
      this.cfg.times.forEach((t, i) => {
        const rig = Personagens.mascote(t, this.tex);
        this.scene.add(rig.raiz);
        const sombra = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), sombraMat);
        sombra.rotation.x = -Math.PI / 2;
        sombra.renderOrder = 1;
        this.scene.add(sombra);
        const estrelas = new THREE.Group();
        for (let k = 0; k < 4; k++) estrelas.add(new THREE.Mesh(estrelaGeo, estrelaMat));
        estrelas.visible = false;
        this.scene.add(estrelas);
        const branco = Texturas.clareza(t.cor) > 0.7;
        this.bonecos.set(t.id, {
          id: t.id, i, rig, sombra, estrelas, time: t,
          forte: branco ? t.cor2 : t.cor, fraca: branco ? t.cor : t.cor2,
          x: 0, z: 0, y: ALTO, ang: 0, fase: Math.random() * 6, desvio: sorte(-0.5, 0.5),
          piscar: sorte(1, 4), piscando: 0, pulo: 0, levou: 0, levouDir: 0, susto: 0,
          queda: null, volta: null, escala: 1, golpe: null, olhar: { x: 0, y: 0 }, festa: 0,
        });
      });
    },

    montarJuiz() {
      const rig = Personagens.juiz();
      this.scene.add(rig.raiz);
      const sombra = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4),
        new THREE.MeshBasicMaterial({ map: this.tex.sombra, transparent: true, depthWrite: false, opacity: LEVE ? 0.8 : 0.45 }));
      sombra.rotation.x = -Math.PI / 2;
      this.scene.add(sombra);
      this.juiz = { rig, sombra, ang: 0, fase: 0, apito: 0, cartao: 0, cartaoCor: null, empurra: 0, piscar: 2, piscando: 0, x: 0, z: 0 };
    },

    montarEfeitos() {
      const n = LEVE ? 0.45 : 1;
      this.po = new Particulas(Math.round(500 * n), this.tex.poeira, false);
      this.faisca = new Particulas(Math.round(700 * n), this.tex.brilho, true);
      this.confete = new Confete(Math.round(700 * n), this.R);
      this.scene.add(this.po.pontos, this.faisca.pontos, this.confete.malha);
      this.qtd = n;
      /* Onda de choque no chão: anéis que crescem e somem. */
      this.ondas = [];
      const onda = new THREE.RingGeometry(0.8, 1, 48);
      for (let i = 0; i < 6; i++) {
        const m = new THREE.Mesh(onda, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
        m.rotation.x = -Math.PI / 2;
        m.visible = false;
        this.scene.add(m);
        this.ondas.push({ m, t: 1, dur: 1, tam: 1 });
      }
      /* Aura do gigante: brilho atrás do mascote. */
      this.aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.brilho, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
      this.aura.scale.set(5, 5, 1);
      this.scene.add(this.aura);
      /* Estouro do impacto: estrela branca que abre e some. */
      this.estouros = [];
      for (let i = 0; i < 6; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.brilho, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, toneMapped: false }));
        sp.visible = false;
        this.scene.add(sp);
        this.estouros.push({ sp, t: 1, dur: 0.3, tam: 1 });
      }
    },

    /* ───────────── reações da live ───────────── */

    boneco(id) { return this.bonecos.get(id); },

    centro(b, alto = 1) { return v2.set(b.x, b.y + alto, b.z); },

    comentou(id, nome, empurrou, chave) {
      const b = this.boneco(id);
      if (!b) return;
      this.pop(b, nome, empurrou ? "" : "fraco", chave);
      if (!b.queda) b.pulo = Math.max(b.pulo, 0.35);
    },

    curtiu(id) {
      const b = this.boneco(id);
      if (!b || b.queda) return;
      b.pulo = Math.max(b.pulo, 0.25);
      this.faiscas(this.centro(b, 2.1), 3, [1, 0.45, 0.6], 0.6);
    },

    empurrao(a) {
      const b = this.boneco(a.time);
      if (!b) return;
      b.golpe = { tipo: a.golpe, t: 0 };
      if (a.golpe === "voadora") {
        this.voo = { de: a.time, alvo: a.alvo, t: 0, perto: false };
        this.cam.corte = true;
      }
      this.aoMomento("arrancada", { golpe: a.golpe });
    },

    bateu(a) {
      const de = this.boneco(a.time), alvo = this.boneco(a.alvo);
      if (!alvo) return;
      const forte = { chat: 0.5, curtida: 0.35, ombrada: 1, carrinho: 1.1, voadora: 1.8 }[a.golpe] || 0.5;
      alvo.levou = 0.8;
      alvo.levouDir = Math.atan2(alvo.x - de.x, alvo.z - de.z);
      alvo.susto = 1;
      const p = v3.set((alvo.x + de.x) / 2, ALTO + (a.golpe === "voadora" ? 1.1 : 0.85), (alvo.z + de.z) / 2);
      this.estourar(p, 0.9 + forte * 1.4, 0.25 + forte * 0.08);
      this.faiscas(p, Math.round(5 + forte * 18), corRGB(de.forte), forte);
      this.faiscas(p, Math.round(3 + forte * 8), [1, 1, 0.9], forte);
      if (forte >= 1) this.onda(alvo.x, alvo.z, 1.4 + forte, 0.5, de.forte);
      if (a.golpe === "carrinho") this.nuvem(alvo.x, alvo.z, 10, 0.9);
      this.tremor = Math.max(this.tremor, forte * 0.5);
      if (a.golpe === "voadora") {
        this.flash = Math.max(this.flash, 0.55);
        if (this.voo && this.voo.de === a.time) this.voo.bateu = true;
      }
      this.aoMomento("bateu", { golpe: a.golpe, forca: forte });
    },

    beira(id) {
      const b = this.boneco(id);
      if (!b) return;
      b.susto = 1;
      this.pop(b, "!", "alerta");
      this.aoMomento("beira", {});
    },

    voltou(id, revive) {
      const b = this.boneco(id);
      if (!b) return;
      if (b.queda) b.volta = { t: 0, x0: b.x, z0: b.z, y0: b.y };
      b.queda = null;
      b.pulo = 0.6;
      this.faiscas(this.centro(b, 1), revive ? 40 : 14, corRGB(b.forte), revive ? 1.4 : 0.8);
      if (revive) this.onda(b.x, b.z, 3, 0.8, b.forte);
    },

    caiu(a) {
      const b = this.boneco(a.time);
      if (!b) return;
      const d = Math.hypot(a.x, a.z) || 1;
      b.queda = { t: 0, x0: b.x, z0: b.z, ux: a.x / d, uz: a.z / d, motivo: a.motivo };
      b.golpe = null;
      b.susto = 1;
      this.nuvem(b.x, b.z, 12, 1.2);
      if (this.diretorModo.modo === "base") this.focar(b, 1.3, 0.55);
      this.aoMomento("caiu", { motivo: a.motivo });
    },

    apito(a) {
      this.juiz.apito = 0.9;
      this.popJuiz(a.acao === "vermelho" ? "🟥" : "📣");
    },

    juizAgiu(a) {
      const j = this.juiz;
      if (a.acao === "empurrao") {
        j.empurra = 0.6;
        const b = this.boneco(a.time);
        if (b) {
          b.levou = 0.8;
          b.levouDir = Math.atan2(b.x - j.x, b.z - j.z);
          this.estourar(v3.set(b.x, ALTO + 0.9, b.z), 2.2, 0.35);
          this.faiscas(v3, 18, [1, 1, 1], 1);
          this.tremor = Math.max(this.tremor, 0.6);
        }
      } else {
        j.cartao = 1.8;
        j.cartaoCor = a.acao === "vermelho" ? 0xe8141e : 0xffd21a;
        j.rig.cartao.material.color.setHex(j.cartaoCor);
        j.rig.cartao.material.emissive.setHex(j.cartaoCor).multiplyScalar(0.5);
        if (a.acao === "vermelho") {
          this.flash = Math.max(this.flash, 0.35);
          this.focar(this.juiz, 1.8, 0.62);
        }
      }
    },

    terremoto(a) {
      const b = this.boneco(a.time);
      this.tremor = 1.6;
      this.flash = 0.6;
      this.abalo = 1.6;
      for (let i = 0; i < 3; i++) this.agendar(i * 0.18, () => this.onda(0, 0, 9 + i * 2, 1.2, i ? "#ffd04a" : b.forte));
      for (const id of a.alvos) {
        const r = this.boneco(id);
        if (r) { r.pulo = 0.9; r.susto = 1; }
      }
      this.nuvem(0, 0, 30, this.R * 0.9);
      this.uTorcida.uPulo.value = 0.6;
      this.diretorModo = { modo: "terremoto", ate: this.t + 2.6 };
    },

    /* Aura do presente no mascote, maior a cada faixa. */
    presente(a, rotulo) {
      const b = this.boneco(a.time);
      if (!b) return;
      if (rotulo) this.pop(b, rotulo, "presente", a.id);
      const n = a.faixa;
      const p = this.centro(b, 1);
      this.faiscas(p, Math.round(12 + n * 16), corRGB(b.forte), 0.8 + n * 0.3);
      this.faiscas(p, Math.round(6 + n * 8), [1, 0.92, 0.6], 0.8 + n * 0.3);
      if (n >= 1) this.onda(b.x, b.z, 2 + n, 0.7, b.forte);
      b.pulo = Math.max(b.pulo, 0.4);
      this.uTorcida.uPulo.value = Math.max(this.uTorcida.uPulo.value, 0.25 + n * 0.1);
      if (n >= 1 && n <= 2 && this.diretorModo.modo === "base") this.focar(b, n === 2 ? 2.2 : 1.4, 0.6);
    },

    fim(a) {
      const b = this.boneco(a.vencedor);
      this.vencedor = a.vencedor;
      this.voo = null;
      this.diretorModo = { modo: "vitoria", b, t0: this.t, ate: Infinity };
      this.abrirEspaco(b);
      this.festa = 5.5;
      this.uTorcida.uPulo.value = 0.7;
      this.flash = 0.5;
    },

    /* Na festa o campeão anda pro meio do círculo, um pouco pra frente, e
       quem sobrou vai pra trás dele, num arco longe da câmera. */
    abrirEspaco(v) {
      const meio = { x: 0, z: 0.8 };
      v.lugarFesta = meio;
      const outros = [...this.bonecos.values()].filter(b => b !== v && !b.queda);
      outros.sort((a, b) => a.x - b.x);
      const lim = this.R - 0.5;
      outros.forEach((b, i) => {
        const ang = Math.PI - (outros.length > 1 ? (i / (outros.length - 1) - 0.5) * 1.9 : 0.5);
        b.lugarFesta = this.dentro(meio.x + Math.sin(ang) * 3.6, meio.z + Math.cos(ang) * 3.6, lim);
      });
      this.lugarJuiz = this.dentro(0, -4, lim);
    },

    dentro(x, z, lim) {
      const d = Math.hypot(x, z);
      return d > lim ? { x: x * lim / d, z: z * lim / d } : { x, z };
    },

    intervalo() {
      this.diretorModo = { modo: "base" };
      this.vencedor = null;
    },

    novaRodada(arena) {
      for (const b of this.bonecos.values()) {
        b.queda = null; b.volta = null; b.golpe = null; b.levou = 0; b.susto = 0; b.escala = 1;
        b.festa = 0; b.lugarFesta = null;
        const t = arena.time(b.id);
        b.x = t.x; b.z = t.z; b.y = ALTO;
        b.ang = Math.atan2(-t.x, -t.z);
        b.pulo = 0.8;
      }
      this.vencedor = null;
      this.lugarJuiz = null;
      this.enq = null;
      this.voo = null;
      this.festa = 0;
      this.diretorModo = { modo: "base" };
      this.cam.corte = true;
    },

    agendar(seg, f) { this.agenda.push({ em: this.t + seg, f }); },

    /* ───────────── efeitos ───────────── */

    faiscas(p, quantos, cor, forca = 1) {
      quantos = Math.round(quantos * this.qtd);
      for (let i = 0; i < quantos; i++) {
        const a = Math.random() * Math.PI * 2, el = sorte(-0.2, 1.1), v = sorte(2, 6) * forca;
        this.faisca.emitir({
          x: p.x, y: p.y, z: p.z,
          vx: Math.cos(a) * Math.cos(el) * v, vy: Math.sin(el) * v + 1, vz: Math.sin(a) * Math.cos(el) * v,
          vida: sorte(0.4, 0.9), tam: sorte(0.12, 0.26) * (0.7 + forca * 0.4), tamFim: 0.02,
          arrasto: 2.5, grav: 7, cor, corFim: [cor[0] * 0.6, cor[1] * 0.3, cor[2] * 0.2],
        });
      }
    },

    nuvem(x, z, quantos, espalha, chao = ALTO) {
      quantos = Math.round(quantos * this.qtd);
      for (let i = 0; i < quantos; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * espalha;
        this.po.emitir({
          x: x + Math.cos(a) * r, y: chao + 0.15, z: z + Math.sin(a) * r,
          vx: Math.cos(a) * sorte(0.5, 2), vy: sorte(0.3, 1.2), vz: Math.sin(a) * sorte(0.5, 2),
          vida: sorte(0.8, 1.6), tam: sorte(0.5, 0.9), tamFim: sorte(1.4, 2.2), alfa: 0.55,
          arrasto: 2.2, cor: [0.72, 0.8, 0.62], corFim: [0.4, 0.48, 0.38],
        });
      }
    },

    onda(x, z, tam, dur, cor = "#ffffff") {
      const o = this.ondas.reduce((velha, k) => (k.t / k.dur > velha.t / velha.dur ? k : velha));
      o.t = 0; o.dur = dur; o.tam = tam;
      o.m.position.set(x, ALTO + 0.03, z);
      o.m.material.color.set(cor);
      o.m.visible = true;
    },

    estourar(p, tam, dur) {
      const e = this.estouros.reduce((velha, k) => (k.t / k.dur > velha.t / velha.dur ? k : velha));
      e.t = 0; e.dur = dur; e.tam = tam;
      e.sp.position.copy(p);
      e.sp.visible = true;
    },

    focar(alvo, seg, zoom) {
      this.diretorModo = { modo: "foco", alvo, ate: this.t + seg, zoom };
    },

    /* ───────────── pose ───────────── */

    /* Um mascote por quadro: lugar, pra onde olha, corpo e rosto conforme
       o que está acontecendo com ele (queda > beira > golpe > tranco >
       tonto > festa > andar). */
    posar(b, t, arena, dt) {
      const rig = b.rig, R = this.R, tempo = this.t;
      let alvoAng = null, incl = 0, rolar = 0, sobe = 0, esticar = 1;
      let pernaA = 0, pernaB = 0, bracoX = [0, 0], bracoZ = [0.35, 0.35], cotov = [0, 0];
      let cabX = 0, cabZ = 0, brava = 0, boca = [1, 0.4, 0.45], olhoEsc = 1, pupila = [0, 0];
      const vel = Math.hypot(t.vx, t.vz);

      b.pulo = Math.max(0, b.pulo - dt);
      b.levou = Math.max(0, b.levou - dt);
      b.susto = Math.max(0, b.susto - dt * 0.8);
      if (b.golpe) { b.golpe.t += dt; if (!t.ataque && b.golpe.t > 0.35) b.golpe = null; }

      if (b.queda) {
        const q = b.queda;
        q.t += dt;
        const k = clamp(q.t / (q.motivo === "vermelho" ? 1.1 : 0.8));
        const longe = q.motivo === "vermelho" ? 2.2 : 1.25;
        const borda = Math.max(Math.hypot(q.x0, q.z0), R - 0.3);
        b.x = lerp(q.x0, q.ux * (borda + longe), k);
        b.z = lerp(q.z0, q.uz * (borda + longe), k);
        b.y = lerp(ALTO, 0, k) + Math.sin(k * Math.PI) * (q.motivo === "vermelho" ? 1.6 : 0.55);
        alvoAng = Math.atan2(-q.ux, -q.uz);
        if (q.motivo === "vermelho") {
          incl = k < 1 ? -0.3 : 0.5;
          cabX = 0.5;
          bracoZ = [0.15, 0.15];
          boca = [0.8, 0.3, 0.45];
          brava = -0.4;
          sobe = k >= 1 ? -0.42 : 0;
          if (k >= 1) { pernaA = -1.5; pernaB = -1.5; }
        } else {
          incl = -Math.min(1, k * 1.25) * Math.PI / 2;
          bracoZ = [2.2, 2.2];
          pernaA = -0.6; pernaB = -0.2;
          boca = [0.7, 0.9, 0.5];
          olhoEsc = k >= 1 ? 0.2 : 1.2;
        }
      } else {
        if (b.volta) {
          const v = b.volta;
          v.t += dt;
          const k = clamp(v.t / 0.6);
          b.x = lerp(v.x0, t.x, k);
          b.z = lerp(v.z0, t.z, k);
          b.y = lerp(v.y0, ALTO, k) + Math.sin(k * Math.PI) * 1.4;
          if (k >= 1) b.volta = null;
        } else if (b.lugarFesta) {
          b.x = suave(b.x, b.lugarFesta.x, 3, dt);
          b.z = suave(b.z, b.lugarFesta.z, 3, dt);
          b.y = ALTO;
        } else {
          b.x = t.x;
          b.z = t.z;
          b.y = ALTO;
        }
        const golpe = t.ataque ? t.ataque.tipo : null;
        if (t.beira) {
          alvoAng = Math.atan2(-t.x, -t.z);
          incl = -0.42 + Math.sin(tempo * 10 + b.i) * 0.3;
          rolar = Math.sin(tempo * 6.3 + b.i) * 0.18;
          bracoX = [tempo * 15, tempo * 15 + Math.PI];
          bracoZ = [1.3, 1.3];
          boca = [0.7, 0.95, 0.5];
          brava = -0.45;
          olhoEsc = 1.25;
          pupila = [Math.sin(tempo * 23) * 0.4, 0.3];
          pernaA = Math.sin(tempo * 10) * 0.3;
          pernaB = -pernaA;
        } else if (golpe === "carrinho") {
          alvoAng = Math.atan2(t.vx, t.vz);
          incl = -1.15;
          sobe = 0.32;
          pernaA = -0.25; pernaB = -0.75;
          bracoX = [-2.6, -2.4];
          bracoZ = [0.6, 0.6];
          brava = 0.5;
          boca = [1.3, 0.55, 0.5];
          if (Math.random() < 0.7) this.nuvem(b.x, b.z, 1, 0.3);
        } else if (golpe === "voadora") {
          alvoAng = Math.atan2(t.vx, t.vz);
          incl = -1.35;
          sobe = 0.55 + Math.sin(Math.min(1, b.golpe ? b.golpe.t / 0.6 : 0) * Math.PI) * 0.5;
          pernaA = 0.1; pernaB = -1.3;
          bracoX = [-0.8, -0.8];
          bracoZ = [1.6, 1.6];
          brava = 0.6;
          boca = [1.3, 0.6, 0.5];
          const c = corRGB(b.forte);
          for (let i = 0; i < 3; i++) {
            this.faisca.emitir({
              x: b.x + sorte(-0.2, 0.2), y: b.y + sobe + sorte(0.2, 1), z: b.z + sorte(-0.2, 0.2),
              vida: 0.5, tam: sorte(0.25, 0.45), tamFim: 0.05, cor: c, corFim: [1, 1, 1], arrasto: 3,
            });
          }
        } else if (golpe) {
          alvoAng = Math.atan2(t.vx, t.vz);
          const forte = golpe === "ombrada";
          incl = forte ? 0.5 : 0.38;
          rolar = forte ? -0.35 : 0;
          b.fase += dt * 18;
          pernaA = Math.sin(b.fase) * 0.9;
          pernaB = -pernaA;
          bracoX = forte ? [-0.4, -1.5] : [-1.45, -1.45];
          bracoZ = forte ? [0.7, 0.2] : [0.25, 0.25];
          brava = 0.55;
          boca = [1.35, 0.32, 0.5];
        } else if (b.levou > 0) {
          const k = b.levou / 0.8;
          alvoAng = b.levouDir + Math.PI;
          incl = -0.55 * k;
          bracoZ = [0.35 + k * 2, 0.35 + k * 2];
          bracoX = [-k * 0.6, -k * 0.6];
          boca = [0.75, 1, 0.5];
          olhoEsc = 1 + k * 0.3;
          brava = -0.4 * k;
          cabX = -0.3 * k;
        } else if (t.tonto > 0) {
          rolar = Math.sin(tempo * 5 + b.i) * 0.2;
          incl = Math.sin(tempo * 3.7 + b.i) * 0.12;
          cabZ = Math.sin(tempo * 5) * 0.25;
          bracoZ = [0.6 + Math.sin(tempo * 5) * 0.3, 0.6 - Math.sin(tempo * 5) * 0.3];
          boca = [0.9, 0.5, 0.45];
          pupila = [Math.cos(tempo * 11) * 0.7, Math.sin(tempo * 11) * 0.7];
        } else if (this.vencedor === b.id) {
          sobe = Math.abs(Math.sin(tempo * 6)) * 0.4;
          bracoZ = [2.7 + Math.sin(tempo * 12) * 0.2, 2.7 - Math.sin(tempo * 12) * 0.2];
          boca = [1.25, 0.85, 0.5];
          cabX = -0.2;
        } else if (vel > 0.25) {
          alvoAng = Math.atan2(t.vx, t.vz);
          b.fase += dt * (4 + vel * 4);
          const k = Math.min(1, vel / 1.2);
          pernaA = Math.sin(b.fase) * 0.6 * k;
          pernaB = -pernaA;
          bracoX = [-pernaA * 0.8, pernaA * 0.8];
          sobe = Math.abs(Math.sin(b.fase)) * 0.05 * k;
          incl = 0.08 * k;
        } else {
          sobe = Math.sin(tempo * 2.4 + b.i) * 0.012;
          bracoZ = [0.35 + Math.sin(tempo * 2.4 + b.i) * 0.05, 0.35 + Math.sin(tempo * 2.4 + b.i) * 0.05];
          cabZ = Math.sin(tempo * 0.9 + b.i * 2) * 0.08;
        }
        if (b.pulo > 0 && !golpe && !t.beira) sobe += Math.sin(clamp(b.pulo / 0.4) * Math.PI) * 0.22 * Math.min(1, b.pulo * 3);
      }

      if (alvoAng === null) alvoAng = Math.atan2(this.cam.pos.x - b.x, this.cam.pos.z - b.z) + b.desvio;
      b.ang += giroAte(b.ang, alvoAng) * (1 - Math.exp(-10 * dt));

      const eAlvo = this.vencedor === b.id ? 1.3 : t.gigante > 0 ? this.cfg.presentes.cresce : 1;
      b.escala = suave(b.escala, eAlvo, 6, dt);
      if (b.levou > 0.6) esticar = 1 - (b.levou - 0.6) * 0.8;

      rig.raiz.position.set(b.x, b.y, b.z);
      rig.raiz.rotation.y = b.ang;
      rig.corpo.rotation.set(incl, 0, rolar);
      rig.corpo.position.y = sobe;
      rig.corpo.scale.set(b.escala * (2 - esticar), b.escala * esticar, b.escala * (2 - esticar));
      rig.pernas[0].coxa.rotation.x = pernaA;
      rig.pernas[1].coxa.rotation.x = pernaB;
      rig.bracos.forEach((br, k) => {
        br.ombro.rotation.x = bracoX[k];
        br.ombro.rotation.z = br.lado * bracoZ[k];
        br.cotovelo.rotation.x = cotov[k];
      });
      rig.cabeca.rotation.set(cabX, 0, cabZ);

      /* Rosto: piscar, pupila, sobrancelha e boca. */
      b.piscar -= dt;
      if (b.piscar <= 0) { b.piscando = 0.13; b.piscar = sorte(1.8, 4.5); }
      b.piscando = Math.max(0, b.piscando - dt);
      const fecha = b.piscando > 0 ? 0.12 : 1;
      for (const o of rig.olhos) {
        o.g.scale.set(olhoEsc, olhoEsc * fecha, 1);
        o.pupila.position.x = pupila[0] * 0.04;
        o.pupila.position.y = pupila[1] * 0.035;
      }
      rig.sobrancelhas.forEach((s, k) => {
        const lado = k ? 1 : -1;
        s.rotation.z = Math.PI / 2 + lado * brava;
        s.position.y = 0.23 + (brava < 0 ? -brava * 0.06 : -brava * 0.03);
      });
      rig.boca.scale.set(boca[0], boca[1], boca[2]);

      rig.coroa.visible = !b.queda && (this.vencedor === b.id || (!!t.coroa && t.coroa.vale && t.vivo));
      if (rig.coroa.visible) rig.coroa.rotation.y = tempo * 1.2;

      b.sombra.position.set(b.x, (b.queda ? 0 : ALTO) + 0.012, b.z);
      const s = b.escala * (1 - clamp(sobe, 0, 1) * 0.4) * (b.queda && b.queda.t > 0.8 ? 1.4 : 1);
      b.sombra.scale.set(s, s, s);
      b.sombra.visible = !(b.queda && b.queda.t < 0.6);

      const tonto = t.tonto > 0 || (b.queda && b.queda.t > 0.8 && b.queda.motivo !== "vermelho");
      b.estrelas.visible = tonto;
      if (tonto) {
        const cabeca = rig.cabeca.getWorldPosition(v1);
        b.estrelas.position.set(cabeca.x, cabeca.y + (b.queda ? 0.3 : 0.55) * b.escala, cabeca.z);
        b.estrelas.children.forEach((e, k) => {
          const a = tempo * 4 + (k / 4) * Math.PI * 2;
          e.position.set(Math.cos(a) * 0.42, Math.sin(a * 2) * 0.05, Math.sin(a) * 0.42);
          e.rotation.y = tempo * 6;
        });
      }
    },

    posarJuiz(arena, dt) {
      const j = this.juiz, rig = j.rig, a = arena.juiz, tempo = this.t;
      if (this.lugarJuiz) {
        j.x = suave(j.x, this.lugarJuiz.x, 3, dt);
        j.z = suave(j.z, this.lugarJuiz.z, 3, dt);
      } else { j.x = a.x; j.z = a.z; }
      const vel = Math.hypot(a.vx, a.vz);
      j.apito = Math.max(0, j.apito - dt);
      j.cartao = Math.max(0, j.cartao - dt);
      j.empurra = Math.max(0, j.empurra - dt);
      let alvoAng = vel > 0.3 ? Math.atan2(a.vx, a.vz) : Math.atan2(this.cam.pos.x - a.x, this.cam.pos.z - a.z);
      if (a.modo === "corre" && a.alvo) {
        const b = this.boneco(a.alvo);
        if (b) alvoAng = Math.atan2(b.x - a.x, b.z - a.z);
      }
      j.ang += giroAte(j.ang, alvoAng) * (1 - Math.exp(-8 * dt));
      j.fase += dt * (3 + vel * 3.2);
      const k = Math.min(1, vel / 2);
      let incl = 0.1 * k, bracoX = [-Math.sin(j.fase) * 0.7 * k, Math.sin(j.fase) * 0.7 * k], bracoZ = [0.3, 0.3];
      let cotov = [0, 0], brava = a.modo === "corre" ? 0.45 : 0.1, boca = [1, 0.4, 0.4];
      if (j.apito > 0) {
        bracoX[1] = -2.2; bracoZ[1] = 0.55; cotov[1] = -1.6;
        boca = [0.6, 0.6, 0.4];
        rig.apito.position.set(0, 0.95, 0.42);
      } else rig.apito.position.set(0, 0.55, 0.46);
      if (j.cartao > 0) {
        bracoX[1] = -3.0; bracoZ[1] = 0.15; cotov[1] = 0;
        brava = 0.6;
        boca = [1.2, 0.35, 0.4];
      }
      if (j.empurra > 0) {
        bracoX = [-1.5, -1.5]; bracoZ = [0.2, 0.2];
        incl = 0.35;
        brava = 0.6;
      }
      rig.cartao.visible = j.cartao > 0;
      rig.raiz.position.set(j.x, ALTO, j.z);
      rig.raiz.rotation.y = j.ang;
      rig.corpo.rotation.x = incl;
      rig.corpo.position.y = Math.abs(Math.sin(j.fase)) * 0.06 * k;
      rig.pernas[0].coxa.rotation.x = Math.sin(j.fase) * 0.65 * k;
      rig.pernas[1].coxa.rotation.x = -Math.sin(j.fase) * 0.65 * k;
      rig.bracos.forEach((br, i) => {
        br.ombro.rotation.x = bracoX[i];
        br.ombro.rotation.z = br.lado * bracoZ[i];
        br.cotovelo.rotation.x = cotov[i];
      });
      rig.peito.scale.set(1, 1 + Math.sin(tempo * 2.2) * 0.015, 1);
      j.piscar -= dt;
      if (j.piscar <= 0) { j.piscando = 0.13; j.piscar = sorte(2, 5); }
      j.piscando = Math.max(0, j.piscando - dt);
      for (const o of rig.olhos) o.g.scale.y = j.piscando > 0 ? 0.12 : 1;
      rig.sobrancelhas.forEach((s, i) => { s.rotation.z = Math.PI / 2 + (i ? 1 : -1) * brava; });
      rig.boca.scale.set(...boca);
      j.sombra.position.set(j.x, ALTO + 0.012, j.z);
    },

    /* ───────────── câmera ───────────── */

    /* Plano aberto de cima, um pouco do lado de quem está assistindo; os
       cortes chegam perto do que importa e voltam. */
    diretor(dt, arena) {
      const d = this.diretorModo;
      if (d.ate !== undefined && this.t > d.ate) this.diretorModo = { modo: "base" };
      const m = this.diretorModo;
      const R = this.R;
      const pos = v1, olhar = v2;
      let fovH = HFOV, taxa = 2.2;
      const balanco = Math.sin(this.t * 0.13) * 1.4;
      this.poseBase(pos, olhar, balanco);
      const e = this.enquadrar(arena, dt);
      pos.sub(olhar).multiplyScalar(e.s);
      olhar.x += e.cx;
      olhar.z += e.cz;
      pos.add(olhar);

      if (m.modo === "foco") {
        const alvo = m.alvo;
        const ax = alvo.x, az = alvo.z;
        const k = m.zoom;
        pos.set(lerp(pos.x, ax * 0.8, k), lerp(pos.y, 6.5, k), lerp(pos.z, az + 8.5, k));
        olhar.set(lerp(olhar.x, ax, k), lerp(olhar.y, 0.6, k), lerp(olhar.z, az, k));
        taxa = 3;
      } else if (m.modo === "terremoto") {
        pos.set(0, 15.5, 15.5);
        olhar.set(0, -0.6, 0);
        taxa = 3;
      } else if (m.modo === "vitoria") {
        const b = m.b;
        const ang = Math.sin((this.t - m.t0) * 0.5) * 0.45;
        pos.set(b.x + Math.sin(ang) * 4.6, b.y + 2.5, b.z + Math.cos(ang) * 4.6);
        olhar.set(b.x, b.y + 2.1, b.z);
        taxa = 2.4;
      }
      if (this.voo && !this.voo.bateu) {
        const de = this.boneco(this.voo.de), alvo = this.boneco(this.voo.alvo);
        const t = arena.time(this.voo.de);
        if (de && alvo && t.ataque) {
          const dist = Math.hypot(alvo.x - de.x, alvo.z - de.z);
          if (dist < 2.4) this.voo.perto = true;
          const mx = (de.x + alvo.x) / 2, mz = (de.z + alvo.z) / 2;
          pos.set(mx + 1.5, 3.4, mz + 6.5);
          olhar.set(mx, 1.1, mz);
          taxa = 4;
        }
      }
      if (this.voo) {
        this.voo.t += dt;
        if (this.voo.bateu) {
          this.voo.depois = (this.voo.depois || 0) + dt;
          if (this.voo.depois > 0.7) this.voo = null;
        } else if (this.voo.t > 2.5) this.voo = null;
      }
      this.aplicarCamera(dt, pos, olhar, fovH, taxa);
    },

    /* Plano de cima que enche a faixa 9:16 com o círculo. Em celular mais
       comprido a mira sobe: o círculo desce pra perto do cartão e o que
       sobra em cima é torcida. O pé da tela fica pro chat do TikTok. */
    poseBase(pos, olhar, balanco = 0) {
      const comprido = clamp((this.H / this.W - 16 / 9) / 0.4);
      pos.set(balanco, 11.6, 11.8);
      olhar.set(balanco * 0.2, 0.2 + comprido * 0.5, 0.1 - comprido * 2.2);
    },

    /* O plano aberto segue quem ainda está em pé: o grupo ocupa uns 65% da
       largura, e a câmera chega perto quando sobra pouca gente ou todo mundo
       se junta no meio (a beira do círculo pode sair do quadro). */
    enquadrar(arena, dt) {
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const t of arena.times) {
        if (!t.vivo) continue;
        x0 = Math.min(x0, t.x); x1 = Math.max(x1, t.x);
        z0 = Math.min(z0, t.z); z1 = Math.max(z1, t.z);
      }
      const e = this.enq || (this.enq = { cx: 0, cz: 0, s: 1 });
      if (x0 === Infinity) return e;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      let r = 0;
      for (const t of arena.times) if (t.vivo) r = Math.max(r, Math.hypot(t.x - cx, t.z - cz));
      const alvo = clamp((r + 0.9) * 0.225, 0.4, 1.05);
      e.s = suave(e.s, alvo, alvo < e.s ? 0.7 : 1.4, dt);
      e.cx = suave(e.cx, cx * 0.85, 0.9, dt);
      e.cz = suave(e.cz, cz * 0.85, 0.9, dt);
      return e;
    },

    /* Onde fica, na tela, a beira de baixo do círculo no plano base: o
       cartão do presente senta logo abaixo dela. */
    medirChao() {
      const c = this.camera.clone();
      const pos = new THREE.Vector3(), olhar = new THREE.Vector3();
      this.poseBase(pos, olhar);
      c.position.copy(pos);
      c.lookAt(olhar);
      c.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(HFOV) / 2) / c.aspect));
      c.updateProjectionMatrix();
      c.updateMatrixWorld();
      const p = new THREE.Vector3(0, ALTO, this.R + 0.2).project(c);
      this.palco.style.setProperty("--chao", `${Math.round((1 - p.y) / 2 * this.H)}px`);
    },

    aplicarCamera(dt, pos, olhar, fovH, taxa) {
      const cam = this.cam;
      const k = cam.corte ? 1 : 1 - Math.exp(-taxa * dt);
      cam.corte = false;
      cam.pos.lerp(pos, k);
      cam.olhar.lerp(olhar, k);
      const c = this.camera;
      c.position.copy(cam.pos);
      c.lookAt(cam.olhar);
      /* O campo de visão é pela largura: celular mais comprido abre pra
         cima e pra baixo, e o círculo nunca corta dos lados. */
      c.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fovH) / 2) / c.aspect));
      if (this.tremor > 0.01) {
        const tr = Math.min(1.5, this.tremor) ** 2;
        c.position.x += (Math.random() - 0.5) * 0.25 * tr;
        c.position.y += (Math.random() - 0.5) * 0.25 * tr;
        c.rotation.z += (Math.random() - 0.5) * 0.03 * tr;
      }
      c.updateProjectionMatrix();
    },

    /* ───────────── tela (DOM por cima do canvas) ───────────── */

    montarTela(palco) {
      this.palco = palco;
      this.$pops = document.createElement("div");
      this.$pops.className = "pops";
      this.$placas = document.createElement("div");
      this.$placas.className = "placas";
      this.$clarao = document.createElement("div");
      this.$clarao.className = "clarao";
      const vinheta = document.createElement("div");
      vinheta.className = "vinheta";
      palco.querySelector("#estadio").after(vinheta, this.$clarao, this.$placas, this.$pops);
      for (const b of this.bonecos.values()) {
        const el = document.createElement("div");
        el.className = "placa";
        el.textContent = b.time.sigla;
        el.style.setProperty("--cor", b.forte);
        el.style.setProperty("--cor2", b.fraca);
        el.style.setProperty("--letra", Texturas.clareza(b.forte) > 0.6 ? "#070b1c" : "#ffffff");
        this.$placas.append(el);
        b.placa = el;
      }
      this.popsVivos = [];
    },

    tela(p) {
      v3.copy(p).project(this.camera);
      return { x: (v3.x + 1) / 2 * this.W, y: (1 - v3.y) / 2 * this.H, atras: v3.z > 1 };
    },

    /* Onde fica a placa do mascote na tela: acima da cabeça (e da coroa). */
    topo(b) {
      const cabeca = b.rig.cabeca.getWorldPosition(v3);
      return this.tela(v3.set(cabeca.x, cabeca.y + 0.75 * b.escala, cabeca.z));
    },

    /* O @ sai acima da placa do mascote, no máximo 4 de uma vez: o novo
       procura lugar livre (acima ou do lado) e, sem lugar, tira o mais velho
       que estiver no caminho. O @ de quem mandou presente fica por cima e
       nunca sai por causa do chat. A mesma pessoa tem um @ só: o novo troca o
       anterior e herda dele o destaque de presente e a coroa. */
    pop(b, texto, cls = "", chave = null) {
      if (!b || b.queda) return;
      const s = this.topo(b);
      if (s.atras) return;
      const velho = chave && this.popsVivos.find(p => p.chave === chave && p.el.isConnected);
      if (velho) {
        if (velho.presente) cls = "presente";
        if (velho.coroa && !texto.startsWith("👑")) texto = `👑${texto}`;
        velho.el.remove();
      }
      const presente = cls === "presente";
      const el = document.createElement("div");
      el.className = `pop ${cls}`;
      el.textContent = texto;
      el.style.setProperty("--cor", b.forte);
      this.$pops.append(el);
      const w = el.offsetWidth, h = el.offsetHeight;
      this.popsVivos = this.popsVivos.filter(p => p.el.isConnected);
      const bate = (x, y) => this.popsVivos.filter(p => Math.abs(p.x - x) < (p.w + w) / 2 + 8 && Math.abs(p.y - y) < (p.h + h) / 2 + 4);
      const lugar = (x, y) => ({ x: clamp(x, w / 2 + 16, this.W - w / 2 - 16), y: clamp(y, this.H * 0.36, this.H * 0.86) });
      const base = s.y - 46;
      const tentativas = [[0, 0], [0, -(h + 6)], [-(w + 10) / 2, -(h + 6) / 2], [(w + 10) / 2, -(h + 6) / 2], [0, -2 * (h + 6)]];
      let pos = null;
      for (const [dx, dy] of tentativas) {
        const l = lugar(s.x + dx, base + dy);
        if (!bate(l.x, l.y).length) { pos = l; break; }
      }
      if (!pos) {
        pos = lugar(s.x, base);
        for (const p of bate(pos.x, pos.y)) if (presente || !p.presente) p.el.remove();
        if (!presente && bate(pos.x, pos.y).some(p => p.el.isConnected)) { el.remove(); return; }
      }
      if (!presente) {
        const comuns = this.popsVivos.filter(p => p.el.isConnected && !p.presente);
        while (comuns.length >= MAX_POPS) comuns.shift().el.remove();
      }
      el.style.left = `${pos.x}px`;
      el.style.top = `${pos.y}px`;
      this.popsVivos.push({ el, x: pos.x, y: pos.y, w, h, presente, chave, coroa: texto.startsWith("👑") });
      el.addEventListener("animationend", () => el.remove());
    },

    popJuiz(texto) {
      const cabeca = this.juiz.rig.cabeca.getWorldPosition(v3);
      const s = this.tela(v3.set(cabeca.x, cabeca.y + 0.6, cabeca.z));
      const el = document.createElement("div");
      el.className = "pop juiz";
      el.textContent = texto;
      el.style.left = `${clamp(s.x, 60, this.W - 60)}px`;
      el.style.top = `${clamp(s.y - 30, this.H * 0.24, this.H * 0.86)}px`;
      this.$pops.append(el);
      el.addEventListener("animationend", () => el.remove());
    },

    placas(arena) {
      for (const b of this.bonecos.values()) {
        const t = arena.time(b.id);
        const s = this.topo(b);
        const el = b.placa;
        const fora = !t.vivo;
        if (el._fora !== fora) { el._fora = fora; el.classList.toggle("fora", fora); }
        const perigo = !!t.beira;
        if (el._perigo !== perigo) { el._perigo = perigo; el.classList.toggle("perigo", perigo); }
        el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) translate(-50%, -100%)`;
      }
    },

    /* ───────────── formato ───────────── */

    aplicarFormato(W, H) {
      this.W = W;
      this.H = H;
      this.camera.aspect = W / H;
      this.camera.updateProjectionMatrix();
      if (this.palco) this.medirChao();
      if (this.escalaTela) this.dimensionar(this.escalaTela);
    },

    dimensionar(escala) {
      this.escalaTela = escala;
      const dpr = Math.min(DPR_MAX, window.devicePixelRatio || 1);
      const larg = Math.min(1080, Math.max(2, Math.round(this.W * escala * dpr)));
      const alt = Math.round(larg * this.H / this.W);
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(larg, alt, false);
      this.alturaPx = alt;
    },

    /* ───────────── quadro ───────────── */

    quadro(arena, dt) {
      this.t += dt;
      if (this.agenda.length) {
        const prontos = this.agenda.filter(x => x.em <= this.t);
        this.agenda = this.agenda.filter(x => x.em > this.t);
        for (const x of prontos) x.f();
      }
      const lentoAlvo = this.voo && this.voo.perto && !this.voo.bateu ? 0.22 : 1;
      this.lento = suave(this.lento, lentoAlvo, lentoAlvo < 1 ? 14 : 6, dt);
      const dtMundo = dt * this.lento;

      let gigante = null, beira = 0;
      for (const b of this.bonecos.values()) {
        const t = arena.time(b.id);
        this.posar(b, t, arena, dtMundo);
        if (t.gigante > 0 && t.vivo) gigante = b;
        if (t.beira) beira++;
      }
      this.posarJuiz(arena, dtMundo);

      /* Tablado treme no terremoto. */
      this.abalo = Math.max(0, (this.abalo || 0) - dt);
      this.tablado.position.y = this.abalo > 0 ? Math.sin(this.t * 60) * 0.04 * this.abalo : 0;

      const aura = this.aura.material;
      if (gigante) {
        aura.opacity = suave(aura.opacity, 0.55 + Math.sin(this.t * 8) * 0.15, 6, dt);
        aura.color.set(gigante.forte);
        this.aura.position.set(gigante.x, ALTO + 1.4 * gigante.escala, gigante.z - 0.3);
        this.aura.scale.setScalar(4.5 * gigante.escala);
        this.luzAura.position.set(gigante.x, ALTO + 2.5, gigante.z + 1);
        this.luzAura.color.set(gigante.forte);
        this.luzAura.intensity = suave(this.luzAura.intensity, 9, 6, dt);
      } else {
        aura.opacity = suave(aura.opacity, 0, 4, dt);
        this.luzAura.intensity = suave(this.luzAura.intensity, 0, 4, dt);
      }
      this.anelPerigo.material.opacity = beira ? 0.35 + Math.sin(this.t * 14) * 0.2 : suave(this.anelPerigo.material.opacity, 0, 6, dt);

      for (const o of this.ondas) {
        if (o.t >= o.dur) { o.m.visible = false; continue; }
        o.t += dt;
        const k = Math.min(1, o.t / o.dur);
        const s = 0.4 + k * o.tam;
        o.m.scale.set(s, s, s);
        o.m.material.opacity = (1 - k) * 0.85;
      }
      for (const e of this.estouros) {
        if (e.t >= e.dur) { e.sp.visible = false; continue; }
        e.t += dt;
        const k = Math.min(1, e.t / e.dur);
        e.sp.scale.setScalar(e.tam * (0.4 + k));
        e.sp.material.opacity = 1 - k;
      }

      /* Festa do vencedor: confete do alto na cor do time. */
      if (this.festa > 0 && this.vencedor) {
        this.festa -= dt;
        const b = this.boneco(this.vencedor);
        const cores = [b.time.cor, b.time.cor2, b.forte, "#ffd34a"];
        const n = Math.random() < this.qtd ? 4 : 1;
        for (let i = 0; i < n; i++) {
          this.confete.emitir(b.x + sorte(-4, 4), sorte(5, 7), b.z + sorte(-4, 4), sorte(-0.5, 0.5), sorte(-0.5, 0.5), sorte(-0.5, 0.5), cores[i % cores.length]);
        }
        if (Math.random() < dt * 3) this.faiscas(v3.set(b.x + sorte(-1, 1), sorte(2.5, 4), b.z + sorte(-1, 1)), 16, corRGB(cores[Math.floor(Math.random() * 2)]), 1.4);
      }

      /* Flash de celular na torcida. */
      if (Math.random() < dt * (LEVE ? 10 : 26) && this.lugares.length) {
        const p = this.lugares[Math.floor(Math.random() * this.lugares.length)];
        this.flashes.emitir({ x: p.x, y: p.y + 0.4, z: p.z, vida: sorte(0.08, 0.2), tam: sorte(0.8, 1.6), cor: [1, 1, 1] });
      }
      this.uTorcida.uTempo.value = this.t;
      this.uTorcida.uPulo.value = suave(this.uTorcida.uPulo.value, 0.12, 0.6, dt);
      this.tex.led.offset.x = (this.t * 0.04) % 1;

      this.po.passo(dtMundo);
      this.faisca.passo(dtMundo);
      this.flashes.passo(dt);
      this.confete.passo(dtMundo, this.t);

      this.diretor(dt, arena);
      this.tremor = Math.max(0, this.tremor - dt * 1.6);
      this.flash = Math.max(0, this.flash - dt * 2.2);
      this.$clarao.style.opacity = this.flash.toFixed(3);

      const px = this.alturaPx / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2));
      for (const p of [this.po, this.faisca, this.flashes]) p.material.uniforms.uEscala.value = px;
      this.renderer.render(this.scene, this.camera);
      this.placas(arena);
    },
  };
})();
