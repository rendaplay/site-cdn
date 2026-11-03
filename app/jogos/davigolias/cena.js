/* O vale em 3D (three.js): céu de fim de tarde, chão, paredões de pedra,
   o Davi girando a funda na frente e o Golias andando lá do fundo, mais a
   pedra, as partículas, a câmera e os @ que pipocam na tela.

   O estado do jogo vem do Duelo (regras.js): a cena só lê a distância, a
   carga e o tamanho e anima o resto. O Golias não desliza: anda em passos
   inteiros até a posição que a distância pede, e cada pisada treme a
   câmera. O tiro e a queda têm a linha do tempo deles aqui, e avisam o
   jogo pelo `aoMomento` pra tocar o som na hora certa. */
"use strict";

const Cena = (() => {
  const LEVE = new URLSearchParams(location.search).get("leve") === "1";
  const DAVI = new THREE.Vector3(0.5, 0, 0.3);
  const TRILHA_X = -0.8;
  const METRO = 0.75;
  const ESCALA_GOLIAS = 4;
  const SOL = new THREE.Vector3(-0.5, 0.42, -0.76).normalize();
  const RAIO_FUNDA = 0.46;
  /* Da pedra lendária: tela escura, céu dourado e só então o arremesso. */
  const ESCURO_LENDA = 0.5;
  const NEBLINA_LENDA = new THREE.Color(1, 0.84, 0.55);
  const SOL_FOGO = new THREE.Color(1, 0.5, 0.22);
  const CEU_LENDA = { uTopo: new THREE.Color("#a8560c"), uMeio: new THREE.Color("#ffb53a"), uHorizonte: new THREE.Color("#fff0b8") };

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const suave = (atual, alvo, taxa, dt) => atual + (alvo - atual) * (1 - Math.exp(-taxa * dt));
  const curva = t => t * t * (3 - 2 * t);
  const sorte = (a, b) => a + Math.random() * (b - a);

  /* Onde cada @ nasce, em px do palco a partir da cabeça. */
  const VAGAS_POP = [[-150, -70], [140, -170], [-150, -270], [140, -370]];
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), v4 = new THREE.Vector3();
  const CIMA = new THREE.Vector3(0, 1, 0);

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
        if (d.p[k + 1] < 0.03 && d.grav[i] > 0) { d.p[k + 1] = 0.03; d.v[k + 1] *= -0.3; d.v[k] *= 0.6; d.v[k + 2] *= 0.6; }
        const t = 1 - Math.max(0, d.vida[i]) / d.vidaMax[i];
        P[k] = d.p[k]; P[k + 1] = d.p[k + 1]; P[k + 2] = d.p[k + 2];
        for (let c = 0; c < 3; c++) C[k + c] = lerp(d.cor0[k + c], d.cor1[k + c], t);
        T[i] = lerp(d.tam0[i], d.tam1[i], t);
        A[i] = d.alfa[i] * (t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88);
      }
      for (const a of [this.pos, this.cor, this.tam, this.alf]) a.needsUpdate = true;
    }
  }

  /* ───────────── céu ───────────── */

  function ceu() {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTopo: { value: new THREE.Color("#2d2a5e") },
        uMeio: { value: new THREE.Color("#c4607a") },
        uHorizonte: { value: new THREE.Color("#ffb66b") },
        uSol: { value: SOL },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 uTopo, uMeio, uHorizonte, uSol;
        varying vec3 vDir;
        void main() {
          float h = vDir.y;
          vec3 c = mix(uHorizonte, uMeio, smoothstep(0.0, 0.22, h));
          c = mix(c, uTopo, smoothstep(0.18, 0.75, h));
          c = mix(c, uHorizonte * 0.9, smoothstep(0.0, -0.1, h));
          float s = max(dot(vDir, uSol), 0.0);
          c += vec3(1.0, 0.72, 0.4) * pow(s, 12.0) * 0.55;
          c += vec3(1.0, 0.85, 0.6) * pow(s, 90.0) * 0.8;
          c = mix(c, vec3(1.0, 0.96, 0.85), smoothstep(0.9975, 0.999, s));
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    const m = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), mat);
    m.renderOrder = -1;
    return m;
  }

  /* Pedra low-poly: dodecaedro com os vértices mexidos e cor por camada
     (estratos de arenito), sombreado chapado. */
  function pedra(rnd, cores, detalhe = 1) {
    const geo = new THREE.DodecahedronGeometry(1, detalhe);
    const pos = geo.attributes.position;
    const mapa = new Map();
    for (let i = 0; i < pos.count; i++) {
      const chave = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
      if (!mapa.has(chave)) mapa.set(chave, 0.82 + rnd() * 0.36);
      const f = mapa.get(chave);
      pos.setXYZ(i, pos.getX(i) * f, pos.getY(i) * f, pos.getZ(i) * f);
    }
    const cor = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const faixa = Math.floor((pos.getY(i) + 1.2) * 3.2);
      c.set(cores[((faixa % cores.length) + cores.length) % cores.length]);
      cor.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(cor, 3));
    geo.computeVertexNormals();
    return geo;
  }

  /* ───────────── a cena ───────────── */

  return {
    tremor: 0,
    flash: 0,
    calor: 0,
    semCorteAte: 0,
    raiosK: 0,
    raiosAlvo: 0,
    escuro: 0,
    lento: 1,
    parado: 0,
    t: 0,

    montar(canvas, palco, cfg, aoMomento) {
      this.cfg = cfg;
      this.aoMomento = aoMomento || (() => {});
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !LEVE, powerPreference: "high-performance" });
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.08;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = LEVE ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
      this.scene = new THREE.Scene();
      this.scene.fog = new THREE.Fog(0xe7a676, 70, 330);
      this.camera = new THREE.PerspectiveCamera(42, 9 / 16, 0.1, 900);
      this.camera.rotation.order = "YXZ";

      this.tex = { brilho: Texturas.brilho(), poeira: Texturas.poeira() };
      this.montarLuz();
      this.montarVale();
      this.montarDavi();
      this.montarGolias();
      this.montarEfeitos();
      this.montarTela(palco);
      this.cam = { pos: new THREE.Vector3(2.6, 1.6, 6.8), olhar: new THREE.Vector3(0, 3, -40), fov: 42, modo: "base", corte: true };
      this.reiniciar(cfg.golias.distancia, 1);
    },

    montarLuz() {
      const s = this.scene;
      this.ceuLuz = new THREE.HemisphereLight(0xffd2a8, 0x6a3f2c, 1.15);
      this.corCeuLuz = this.ceuLuz.color.clone();
      s.add(this.ceuLuz);
      this.sol = new THREE.DirectionalLight(0xffc489, 2.7);
      this.sol.castShadow = true;
      const tam = LEVE ? 512 : 1024;
      this.sol.shadow.mapSize.set(tam, tam);
      this.sol.shadow.bias = -0.0006;
      this.sol.shadow.normalBias = 0.03;
      s.add(this.sol, this.sol.target);
      this.corSol = this.sol.color.clone();
      const frente = new THREE.DirectionalLight(0xc4ccff, 1.25);
      frente.position.set(4, 7, 12);
      s.add(frente);
      this.luzFunda = new THREE.PointLight(0xffa040, 0, 6, 1.6);
      s.add(this.luzFunda);
    },

    /* Sombra do sol só onde tem gente: do Davi até o Golias. A caixa
       acompanha o gigante pra resolução não se espalhar pelo vale todo. */
    ajustarSombra() {
      const zG = this.g.z;
      const meio = v1.set((DAVI.x + TRILHA_X) / 2, 0, (DAVI.z + zG) / 2);
      this.sol.target.position.copy(meio);
      this.sol.position.copy(meio).addScaledVector(SOL, 120);
      const c = this.sol.shadow.camera;
      const comp = Math.abs(zG - DAVI.z) + 6;
      const alto = ESCALA_GOLIAS * this.g.e * 2.4;
      const meia = (comp * SOL.y + alto * Math.sqrt(1 - SOL.y * SOL.y)) / 2 + 3;
      c.left = -9; c.right = 9; c.top = meia; c.bottom = -meia;
      c.near = 60; c.far = 200;
      c.updateProjectionMatrix();
    },

    /* Reflexo do céu nos metais (bronze, escamas, coroa): sem isso o metal
       fica preto. Sai uma vez só, de uma cena com o céu e o chão. */
    ambiente() {
      const cena = new THREE.Scene();
      cena.add(ceu());
      const chao = new THREE.Mesh(new THREE.CircleGeometry(500, 16), new THREE.MeshBasicMaterial({ color: 0xa8643a }));
      chao.rotation.x = -Math.PI / 2;
      chao.position.y = -5;
      cena.add(chao);
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      const env = pmrem.fromScene(cena, 0.03).texture;
      pmrem.dispose();
      return env;
    },

    montarVale() {
      const s = this.scene;
      s.environment = this.ambiente();
      this.ceu = ceu();
      this.corCeu = Object.fromEntries(Object.keys(CEU_LENDA).map(k => [k, this.ceu.material.uniforms[k].value.clone()]));
      this.corNeblina = s.fog.color.clone();
      s.add(this.ceu);
      const texChao = Texturas.chao();
      texChao.repeat.set(150, 150);
      const chao = new THREE.Mesh(new THREE.PlaneGeometry(700, 700),
        new THREE.MeshStandardMaterial({ map: texChao, color: 0xf0d2b2, roughness: 1 }));
      chao.rotation.x = -Math.PI / 2;
      chao.position.z = -200;
      chao.receiveShadow = true;
      s.add(chao);

      const rnd = Texturas.sorteio(29);
      const arenito = ["#b5643c", "#c97b4c", "#a9573a", "#d99464", "#bd6e45", "#9c4f34"];
      const matPedra = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 });

      /* Paredões dos dois lados: blocos empilhados em degrau, mais altos
         quanto mais longe, e mesas de topo chato no horizonte. */
      for (const lado of [-1, 1]) {
        for (let i = 0; i < 22; i++) {
          const z = 12 - i * 11 - rnd() * 6;
          const longe = clamp(-z / 200);
          const x = lado * (11 + rnd() * 6 + longe * 18);
          const alto = 5 + rnd() * 7 + longe * 26;
          const geo = pedra(rnd, arenito, 1);
          const m = new THREE.Mesh(geo, matPedra);
          m.scale.set(4 + rnd() * 5, alto, 5 + rnd() * 5);
          m.position.set(x, alto * 0.35, z);
          m.rotation.y = rnd() * 3;
          m.castShadow = !LEVE && i < 10;
          m.receiveShadow = true;
          s.add(m);
          if (rnd() < 0.6) {
            const topo = new THREE.Mesh(pedra(rnd, arenito, 0), matPedra);
            topo.scale.set(3 + rnd() * 3, 2 + rnd() * 3, 3 + rnd() * 3);
            topo.position.set(x - lado * (2 + rnd() * 3), alto * 0.85 + rnd() * 2, z + rnd() * 4);
            topo.rotation.set(rnd(), rnd() * 3, rnd());
            s.add(topo);
          }
        }
      }
      const matMesa = new THREE.MeshStandardMaterial({ color: 0xb1675a, flatShading: true, roughness: 1 });
      for (let i = 0; i < 9; i++) {
        const raio = 18 + rnd() * 30, alto = 22 + rnd() * 40;
        const m = new THREE.Mesh(new THREE.CylinderGeometry(raio * 0.8, raio, alto, 7, 1), matMesa);
        m.position.set(-150 + i * 38 + rnd() * 20, alto / 2 - 2, -300 - rnd() * 60);
        m.rotation.y = rnd() * 3;
        s.add(m);
      }

      /* Pedras soltas e moitas secas no caminho, numa malha instanciada só. */
      const nPedras = LEVE ? 60 : 150;
      const soltas = new THREE.InstancedMesh(pedra(rnd, ["#a7704c", "#8f5c3e", "#bf885c"], 0), matPedra, nPedras);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), esc = new THREE.Vector3(), p = new THREE.Vector3();
      for (let i = 0; i < nPedras; i++) {
        let x, z;
        do {
          x = (rnd() - 0.5) * 34;
          z = 9 - rnd() * 150;
        } while ((Math.abs(x - TRILHA_X) < 3.2 && z < 2) || (Math.abs(x - DAVI.x) < 7 && z > -6));
        const t = 0.12 + Math.pow(rnd(), 3) * 1.6;
        p.set(x, t * 0.25, z);
        q.setFromEuler(e.set(rnd() * 3, rnd() * 3, rnd() * 3));
        esc.set(t * (1 + rnd()), t * (0.6 + rnd() * 0.5), t * (1 + rnd()));
        soltas.setMatrixAt(i, m4.compose(p, q, esc));
      }
      soltas.castShadow = !LEVE;
      soltas.receiveShadow = true;
      s.add(soltas);

      const nMoitas = LEVE ? 14 : 34;
      const moitas = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0),
        new THREE.MeshStandardMaterial({ color: 0x8a8a4a, flatShading: true, roughness: 1 }), nMoitas);
      for (let i = 0; i < nMoitas; i++) {
        const lado = rnd() < 0.5 ? -1 : 1;
        const x = lado * (3 + rnd() * 9), z = -6 - rnd() * 120;
        const t = 0.25 + rnd() * 0.45;
        p.set(x, t * 0.4, z);
        q.setFromEuler(e.set(0, rnd() * 3, 0));
        esc.set(t * 1.3, t * 0.8, t * 1.2);
        moitas.setMatrixAt(i, m4.compose(p, q, esc));
      }
      moitas.receiveShadow = true;
      s.add(moitas);
    },

    /* ───────────── Davi ───────────── */

    montarDavi() {
      const r = Personagens.davi();
      this.scene.add(r.raiz);
      const corda = new THREE.MeshStandardMaterial({ color: 0x7a5530, roughness: 0.9 });
      const funda = {
        cordas: [0, 1].map(() => {
          const m = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1, 5), corda);
          m.castShadow = true;
          this.scene.add(m);
          return m;
        }),
        bolsa: new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshStandardMaterial({ color: 0x5a3519, roughness: 0.8, emissive: 0x000000 })),
        pedra: new THREE.Mesh(new THREE.IcosahedronGeometry(0.038, 1), new THREE.MeshStandardMaterial({ color: 0x9a948c, roughness: 0.6, flatShading: true })),
        aro: new THREE.Group(),
        brilho: new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.brilho, color: 0xffd27a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 })),
      };
      funda.bolsa.scale.set(1, 0.6, 1.2);
      funda.bolsa.castShadow = true;
      const rastro = new THREE.Mesh(new THREE.RingGeometry(RAIO_FUNDA - 0.06, RAIO_FUNDA + 0.05, 40, 1, 0, 2.4),
        new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      rastro.rotation.x = -Math.PI / 2;
      funda.aro.add(rastro);
      funda.rastro = rastro;
      this.scene.add(funda.bolsa, funda.pedra, funda.aro, funda.brilho);
      this.d = {
        rig: r, funda, modo: "girando", tm: 0, giro: 0, vel: 4, pulso: 0, fogo: 0, piscar: 2,
        carga: 0, pedrasNaBolsa: [], reacao: null, brilho: 0,
      };
    },

    poseDavi(dt) {
      const d = this.d, r = d.rig, g = this.g;
      d.tm += dt;
      const alvo = Math.atan2(TRILHA_X - DAVI.x, g.z - DAVI.z);
      r.raiz.position.copy(DAVI);
      r.raiz.rotation.y = alvo + 1.15;
      r.corpo.position.set(0, 0, 0);
      r.quadril.position.y = 0.7;
      const perto = clamp(1 - (DAVI.z - g.z - 3) / 40);

      for (const [i, p] of r.pernas.entries()) {
        const lado = i ? 1 : -1;
        p.coxa.rotation.set(-0.06, 0, lado * 0.2);
        p.joelho.rotation.set(0.14, 0, 0);
        p.pe.rotation.set(-0.08, 0, -lado * 0.2);
      }
      r.tronco.rotation.set(0, Math.sin(d.giro) * 0.05, -0.04);
      r.cabeca.rotation.set(-0.08 - perto * 0.2, -0.95, 0);
      const [direito, esquerdo] = r.bracos;
      direito.ombro.rotation.set(Math.sin(d.giro) * 0.14, 0, -2.85 + Math.cos(d.giro) * 0.1);
      direito.cotovelo.rotation.set(-0.35, 0, 0);
      esquerdo.ombro.rotation.set(-0.15, 0, 1.25);
      esquerdo.cotovelo.rotation.set(-0.25, 0, 0);

      let sobr = 0.3, sobrY = 0.072, bocaY = 0.35, bocaX = 1, olho = 1, frown = false;
      d.piscar -= dt;
      if (d.piscar < 0) d.piscar = 2.5 + Math.random() * 2.5;

      if (d.modo === "arremesso") {
        const enrola = clamp(d.tm / 0.5);
        const solta = clamp((d.tm - 0.5) / 0.2);
        r.tronco.rotation.y = -0.5 * enrola * (1 - solta) + 0.55 * curva(solta);
        r.tronco.rotation.z = -0.04 - 0.12 * solta;
        r.corpo.position.x = 0.1 * curva(solta);
        r.quadril.position.y = 0.7 - 0.05 * enrola;
        direito.ombro.rotation.z = lerp(-2.85, 0.9, curva(solta));
        direito.ombro.rotation.x = lerp(0, -0.5, solta);
        esquerdo.ombro.rotation.z = lerp(1.25, 0.4, solta);
        sobr = 0.42; bocaY = 0.25; bocaX = 0.8;
      } else if (d.modo === "comemora") {
        r.raiz.rotation.y = lerp(r.raiz.rotation.y, Math.atan2(this.cam.pos.x - DAVI.x, this.cam.pos.z - DAVI.z), clamp(d.tm * 3));
        const pulo = Math.abs(Math.sin(d.tm * 7.5));
        r.corpo.position.y = pulo * 0.16;
        direito.ombro.rotation.set(0, 0, -2.6 + Math.sin(d.tm * 15) * 0.2);
        esquerdo.ombro.rotation.set(0, 0, 2.6 - Math.sin(d.tm * 15) * 0.2);
        direito.cotovelo.rotation.x = esquerdo.cotovelo.rotation.x = -0.3;
        r.cabeca.rotation.set(-0.15, 0.25, 0);
        sobr = -0.2; sobrY = 0.085; bocaY = 1.5; bocaX = 1.25;
      } else if (d.modo === "medo") {
        const k = clamp(d.tm / 0.4);
        r.quadril.position.y = 0.7 - 0.13 * k;
        for (const p of r.pernas) { p.coxa.rotation.x = -0.55 * k; p.joelho.rotation.x = 0.95 * k; }
        r.tronco.rotation.x = 0.2 * k;
        direito.ombro.rotation.set(-2.2 * k, 0, -0.6 * k);
        esquerdo.ombro.rotation.set(-2.2 * k, 0, 0.6 * k);
        direito.cotovelo.rotation.x = esquerdo.cotovelo.rotation.x = -1.4 * k;
        r.cabeca.rotation.set(-0.55 * k, 0.8, Math.sin(d.tm * 30) * 0.02);
        sobr = -0.35; sobrY = 0.09; bocaY = 0.8; bocaX = 0.7; olho = 1.25; frown = true;
      }

      /* Reação a presente, por cima do giro: soco no ar com a mão livre
         ou um susto de recuo quando o gigante se fortalece. */
      const re = d.reacao;
      if (re && d.modo === "girando") {
        re.t += dt;
        const u = re.t / re.dur;
        if (u >= 1) d.reacao = null;
        else if (re.tipo === "soco") {
          const w = clamp(re.t / 0.12) * clamp((1 - u) * 4);
          const bate = Math.abs(Math.sin(re.t * 11));
          esquerdo.ombro.rotation.set(-0.25 * w, 0, lerp(1.25, 2.75 + bate * 0.25, w));
          esquerdo.cotovelo.rotation.x = lerp(-0.25, -0.15 - bate * 0.5, w);
          r.corpo.position.y += bate * 0.07 * w;
          r.cabeca.rotation.x -= 0.2 * w;
          sobr = lerp(sobr, -0.15, w); bocaY = lerp(bocaY, 1.4, w); bocaX = lerp(bocaX, 1.2, w);
        } else {
          const w = clamp(re.t / 0.12) * clamp((1 - u) * 3);
          r.corpo.position.x -= 0.25 * w;
          r.quadril.position.y -= 0.14 * w;
          for (const p of r.pernas) {
            p.coxa.rotation.x = lerp(p.coxa.rotation.x, -0.6, w);
            p.joelho.rotation.x = lerp(p.joelho.rotation.x, 1.05, w);
          }
          r.tronco.rotation.x += 0.28 * w;
          r.tronco.rotation.z += 0.18 * w;
          esquerdo.ombro.rotation.set(-2.3 * w, 0, lerp(1.25, 0.55, w));
          esquerdo.cotovelo.rotation.x = lerp(-0.25, -1.6, w);
          r.cabeca.rotation.set(r.cabeca.rotation.x - 0.45 * w, r.cabeca.rotation.y + 0.5 * w, Math.sin(re.t * 32) * 0.04 * w);
          sobr = lerp(sobr, -0.35, w); sobrY = 0.09; bocaY = lerp(bocaY, 0.8, w); bocaX = lerp(bocaX, 0.7, w);
          olho = lerp(1, 1.3, w); frown = w > 0.3;
        }
      }

      for (const [i, s] of r.sobrancelhas.entries()) {
        const lado = i ? 1 : -1;
        s.rotation.z = lado * sobr;
        s.position.y = sobrY;
      }
      const piscando = d.piscar < 0.12 && d.modo !== "medo";
      for (const o of r.olhos) o.scale.set(olho, piscando ? 0.12 : olho, 1);
      r.sorriso.scale.set(bocaX, bocaY, 1);
      r.sorriso.rotation.z = frown ? 0 : Math.PI;
      r.sorriso.position.y = frown ? -0.085 : -0.07;
      r.raiz.updateMatrixWorld(true);
    },

    /* Funda: gira em volta da mão, mais rápido e mais quente conforme carrega. */
    animarFunda(dt) {
      const d = this.d, f = d.funda;
      const fr = d.carga;
      const girando = d.modo === "girando" || (d.modo === "arremesso" && d.tm < 0.62);
      const vAlvo = d.modo === "arremesso" ? 34 : 4 + fr * 15 + d.pulso * 10;
      d.vel = suave(d.vel, girando ? vAlvo : 0, 6, dt);
      d.pulso = Math.max(0, d.pulso - dt * 1.5);
      d.brilho = Math.max(0, d.brilho - dt * 0.9);
      d.giro += d.vel * dt;
      d.fogo = Math.max(0, d.fogo - dt);

      const mao = d.rig.bracos[0].mao.getWorldPosition(v1);
      const centro = v2.copy(mao).add(v3.set(0, 0.05, 0));
      let bolsa;
      if (girando) {
        bolsa = new THREE.Vector3(Math.cos(d.giro) * RAIO_FUNDA, 0.06 + Math.sin(d.giro * 2) * 0.03, Math.sin(d.giro) * RAIO_FUNDA).add(centro);
      } else {
        bolsa = new THREE.Vector3(0.05, -RAIO_FUNDA * 0.9, 0.04).add(mao);
      }
      f.ponto = bolsa;
      f.bolsa.position.copy(bolsa);
      f.bolsa.rotation.y = -d.giro;
      f.pedra.position.copy(bolsa).y += 0.02;
      f.pedra.visible = !d.solta;
      for (const [i, c] of f.cordas.entries()) {
        const de = v3.copy(mao).add(new THREE.Vector3(0, 0, i ? 0.012 : -0.012));
        const dir = new THREE.Vector3().subVectors(bolsa, de);
        const comp = dir.length();
        c.position.copy(de).addScaledVector(dir, 0.5);
        c.scale.set(1, comp, 1);
        c.quaternion.setFromUnitVectors(CIMA, dir.normalize());
        c.visible = !(d.solta && i === 1);
      }
      f.aro.position.copy(centro);
      f.aro.rotation.y = -d.giro;
      const rapido = clamp((d.vel - 5) / 20);
      const quente = d.fogo > 0 ? clamp(d.fogo * 1.5) : 0;
      const ouro = clamp(d.brilho);
      f.rastro.material.opacity = girando ? Math.max(rapido * 0.55, quente * 0.4, ouro * 0.5) : 0;
      f.rastro.material.color.setRGB(1, lerp(0.9, 0.55, Math.max(fr, quente)), lerp(0.7, 0.2, Math.max(fr, quente)));
      f.brilho.position.copy(bolsa);
      const tam = 0.2 + fr * 0.6 + d.pulso * 0.3 + quente * 0.25 + ouro * 0.6;
      f.brilho.scale.set(tam, tam, 1);
      f.brilho.material.opacity = clamp(fr * 0.9 + d.pulso * 0.3 + quente * 0.3 + ouro * 0.5) * (girando ? 1 : 0.3);
      f.brilho.material.color.setRGB(1, lerp(0.88, 0.55, Math.max(fr, quente)), lerp(0.55, 0.15, Math.max(fr, quente)));
      f.bolsa.material.emissive.setRGB(fr * 0.5 + quente * 1.2 + ouro * 0.8, fr * 0.25 + quente * 0.35 + ouro * 0.6, ouro * 0.1);
      f.pedra.material.emissive.setRGB(quente * 1.4 + ouro * 0.6, quente * 0.45 + ouro * 0.45, 0);
      this.calor = suave(this.calor, quente, quente ? 6 : 1.5, dt);
      this.sol.color.copy(this.corSol).lerp(SOL_FOGO, this.calor * 0.7);
      this.ceuLuz.color.copy(this.corCeuLuz).lerp(SOL_FOGO, this.calor * 0.6);
      this.luzFunda.position.copy(bolsa);
      this.luzFunda.distance = lerp(6, 16, this.calor);
      this.luzFunda.intensity = (fr * 2.5 + this.calor * 3.5 + d.pulso + ouro * 2.5) * (LEVE ? 0 : 1);

      if (quente && girando) this.labaredas(bolsa, LEVE ? 1 : 3, quente);
      if (ouro > 0.2 && girando && Math.random() < ouro) {
        this.fogo.emitir({
          x: bolsa.x, y: bolsa.y, z: bolsa.z, vx: sorte(-1, 1), vy: sorte(0, 1.6), vz: sorte(-1, 1),
          vida: 0.6, tam: 0.08, tamFim: 0.01, cor: [1, 0.95, 0.6], corFim: [1, 0.6, 0.1], arrasto: 1.4, grav: 2,
        });
      }
      if (fr > 0.7 && girando && Math.random() < fr * 0.5) {
        this.fogo.emitir({
          x: bolsa.x, y: bolsa.y, z: bolsa.z, vx: sorte(-0.4, 0.4), vy: sorte(0, 0.6), vz: sorte(-0.4, 0.4),
          vida: 0.4, tam: 0.05, cor: [1, 0.9, 0.5], corFim: [1, 0.5, 0.1], arrasto: 2,
        });
      }

      /* Pedra extra: surge grande acima da cabeça do Davi, gira no ar e
         mergulha na funda. */
      for (const p of d.pedrasNaBolsa) {
        p.t += dt;
        const alvo = d.rig.bolsa.getWorldPosition(v3);
        const k = clamp((p.t - p.paira) / p.dur);
        if (p.t < p.paira) {
          const surge = clamp(p.t / 0.18);
          p.mesh.scale.setScalar(4.2 * (surge < 1 ? Math.sin(surge * Math.PI * 0.75) / 0.707 : 1));
          p.mesh.position.copy(p.de);
          p.mesh.position.y += Math.sin(p.t * 7) * 0.05;
        } else {
          p.mesh.scale.setScalar(lerp(4.2, 1.4, curva(k)));
          p.mesh.position.lerpVectors(p.de, alvo, curva(k));
          p.mesh.position.y += Math.sin(k * Math.PI) * 0.35;
        }
        p.mesh.rotation.x += dt * 5;
        p.mesh.rotation.y += dt * 3;
        for (let i = 0; i < (LEVE ? 1 : 2); i++) {
          const q = p.mesh.position;
          const a = sorte(0, Math.PI * 2);
          this.fogo.emitir({
            x: q.x, y: q.y, z: q.z, vx: Math.cos(a) * 1.2, vy: sorte(-0.4, 1), vz: Math.sin(a) * 1.2,
            vida: sorte(0.4, 0.7), tam: 0.07, tamFim: 0.01, cor: [1, 0.95, 0.6], corFim: [1, 0.55, 0.1], arrasto: 2,
          });
        }
        if (k >= 1 && !p.chegou) {
          p.chegou = true;
          this.scene.remove(p.mesh);
          for (const c of p.mesh.children) c.material.dispose();
          this.flash = Math.max(this.flash, 0.4);
          d.brilho = Math.max(d.brilho, 1.4);
          d.pulso = 2;
          this.faiscas(alvo, 50, [1, 0.9, 0.45], 1.7);
          this.aoMomento("pedra");
        }
      }
      d.pedrasNaBolsa = d.pedrasNaBolsa.filter(p => !p.chegou);
    },

    /* Chamas com forma de gota subindo de um ponto: a funda em brasa. */
    labaredas(p, quantas, forca = 1) {
      for (let i = 0; i < quantas; i++) {
        this.chama.emitir({
          x: p.x + sorte(-0.06, 0.06), y: p.y + sorte(-0.03, 0.05), z: p.z + sorte(-0.06, 0.06),
          vx: sorte(-0.2, 0.2), vy: sorte(1.1, 2.2) * forca, vz: sorte(-0.2, 0.2),
          vida: sorte(0.3, 0.55), tam: sorte(0.14, 0.26) * (0.6 + forca * 0.4), tamFim: 0.04, alfa: 0.75,
          cor: [1, 0.72, 0.28], corFim: [0.9, 0.12, 0], arrasto: 1.2, grav: -0.6,
        });
      }
    },

    /* ───────────── Golias ───────────── */

    montarGolias() {
      const r = Personagens.golias(Texturas.escamas());
      this.scene.add(r.raiz);
      this.g = {
        rig: r, z: -80, alvoZ: -80, e: 1, eAlvo: 1, fase: Math.PI / 2, passo: null,
        modo: "anda", tm: 0, rugir: 0, rugirDur: 1, risada: 0, empurrao: 0, nome: "",
        bater: 0, baterDur: 1, susto: 0, inchar: 0, incharForca: 0.1, incharDur: 0.7, brasa: 0,
        estrelas: [0, 1, 2].map(() => {
          const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0),
            new THREE.MeshBasicMaterial({ color: 0xffe066 }));
          s.visible = false;
          this.scene.add(s);
          return s;
        }),
      };
      /* Só o que não tem brilho próprio fica em brasa quando ele cresce. */
      this.matsGolias = new Set();
      r.raiz.traverse(o => {
        const m = o.material;
        if (m && m.emissive && m.emissive.getHex() === 0) this.matsGolias.add(m);
      });
    },

    zDe(dist, e) {
      return -(0.9 + 1.7 * e + dist * METRO);
    },

    passada() { return 0.85 * ESCALA_GOLIAS * this.g.e; },

    /* Passo inteiro de `de` até `para`: o pé que estava atrás vai pra
       frente e pisa no fim. */
    darPasso(para, dur) {
      const g = this.g;
      g.passo = { de: g.z, para, t: 0, dur, fase0: g.fase, sentido: para > g.z ? 1 : -1 };
    },

    andarGolias(dt) {
      const g = this.g;
      if (g.passo) {
        const p = g.passo;
        p.t += dt;
        const k = clamp(p.t / p.dur);
        g.z = lerp(p.de, p.para, curva(k));
        g.fase = p.fase0 + Math.PI * k * p.sentido;
        if (k >= 1) {
          g.passo = null;
          this.pisada(1);
        }
        return;
      }
      if (g.modo !== "anda" && g.modo !== "corre") return;
      const falta = g.alvoZ - g.z;
      const L = this.passada();
      if (g.modo === "corre") {
        if (falta > 0.05) this.darPasso(g.z + Math.min(falta, L * 1.5), clamp(falta / 40, 0.2, 0.32));
        return;
      }
      if (falta > L * 0.6) {
        const atraso = falta / L;
        this.darPasso(g.z + Math.min(falta, L), clamp(1.15 - atraso * 0.12, 0.45, 1.15));
      } else if (falta < -0.6) {
        this.darPasso(g.z + Math.max(falta, -L * 0.8), 0.55);
      }
    },

    /* Pisada: tremor mais forte quanto maior e mais perto, poeira no pé. */
    pisada(forca) {
      const g = this.g;
      const perto = clamp(1 - (DAVI.z - g.z) / 70);
      this.tremor = Math.max(this.tremor, (0.25 + perto * 0.75) * g.e * forca);
      const pe = (Math.round(g.fase / Math.PI) % 2 === 0) ? g.rig.pernas[1].pe : g.rig.pernas[0].pe;
      const p = pe.getWorldPosition(v1);
      this.nuvem(p.x, p.z, 10 + Math.round(perto * 10), 0.9 * g.e, 1.2 * g.e);
      this.aoMomento("passo", { perto, escala: g.e });
    },

    poseGolias(dt) {
      const g = this.g, r = g.rig;
      g.tm += dt;
      g.e = suave(g.e, g.eAlvo, 3, dt);
      const s = Math.sin(g.fase), c = Math.cos(g.fase);
      const andando = g.passo ? 1 : 0.25;
      r.raiz.position.set(TRILHA_X, 0, g.z);
      g.inchar = Math.max(0, g.inchar - dt / g.incharDur);
      r.raiz.scale.setScalar(ESCALA_GOLIAS * g.e * (1 + g.incharForca * Math.sin(Math.PI * (1 - g.inchar))));
      r.raiz.rotation.set(0, Math.atan2(DAVI.x - TRILHA_X, DAVI.z - g.z) * 0.6, 0);
      r.corpo.position.set(0, -0.06 * (1 - Math.abs(c)) * andando, 0);
      r.corpo.rotation.set(0, 0, 0);
      const resp = Math.sin(g.tm * 1.7);

      const [pd, pe] = r.pernas;
      pd.coxa.rotation.set(-s * 0.4, 0, -0.04);
      pe.coxa.rotation.set(s * 0.4, 0, 0.04);
      pd.joelho.rotation.x = 0.08 + 0.6 * Math.max(0, -c) * andando;
      pe.joelho.rotation.x = 0.08 + 0.6 * Math.max(0, c) * andando;
      pd.pe.rotation.x = -pd.coxa.rotation.x - pd.joelho.rotation.x;
      pe.pe.rotation.x = -pe.coxa.rotation.x - pe.joelho.rotation.x;
      r.tronco.rotation.set(0.1 + resp * 0.015, s * 0.09, c * 0.05 * andando);
      r.tronco.scale.set(1 + resp * 0.012, 1, 1 + resp * 0.012);
      r.cabeca.rotation.set(0.1, -s * 0.06, 0);
      const [bd, be] = r.bracos;
      bd.ombro.rotation.set(-s * 0.12 + 0.05, 0, -0.18);
      bd.cotovelo.rotation.set(-1.45, 0, 0);
      be.ombro.rotation.set(s * 0.3 - 0.1, 0, 0.22);
      be.cotovelo.rotation.set(-0.7, 0, 0);
      r.boca.scale.y = 0.2;
      for (const o of r.olhos) o.scale.setScalar(1);

      if (g.rugir > 0) {
        g.rugir = Math.max(0, g.rugir - dt);
        const k = Math.sin(Math.PI * (1 - g.rugir / g.rugirDur));
        const w = clamp(k * 1.6);
        bd.ombro.rotation.z -= 0.9 * w;
        be.ombro.rotation.z += 1.3 * w;
        be.ombro.rotation.x -= 0.5 * w;
        r.tronco.rotation.x -= 0.22 * w;
        r.cabeca.rotation.x -= 0.45 * w;
        r.boca.scale.y = 0.2 + 1.1 * w;
        r.tronco.rotation.z += Math.sin(g.tm * 40) * 0.01 * w;
      }
      if (g.risada > 0) {
        g.risada = Math.max(0, g.risada - dt);
        const w = clamp(g.risada * 2);
        r.corpo.position.y += Math.abs(Math.sin(g.tm * 18)) * 0.03 * w;
        r.cabeca.rotation.x -= 0.35 * w;
        r.boca.scale.y = 0.2 + (0.6 + Math.sin(g.tm * 18) * 0.4) * w;
        be.ombro.rotation.x -= 0.4 * w;
      }
      if (g.empurrao > 0) {
        g.empurrao = Math.max(0, g.empurrao - dt);
        const w = Math.sin(g.empurrao * 12) * clamp(g.empurrao);
        r.corpo.rotation.z = w * 0.08;
        r.tronco.rotation.x -= Math.abs(w) * 0.2;
        bd.ombro.rotation.z -= Math.abs(w) * 0.6;
        be.ombro.rotation.z += Math.abs(w) * 0.6;
      }
      /* Bate a lança no escudo duas vezes antes de rugir. */
      if (g.bater > 0) {
        g.bater = Math.max(0, g.bater - dt);
        const u = 1 - g.bater / g.baterDur;
        const w = clamp(u * 6) * clamp((1 - u) * 6);
        /* Braço da lança no alto em u = 0, ½ e 1; bate em ¼ e ¾. */
        const alto = 0.5 + 0.5 * Math.cos(u * Math.PI * 4);
        be.ombro.rotation.x -= 0.7 * w;
        be.ombro.rotation.z -= 0.6 * w;
        be.cotovelo.rotation.x = lerp(be.cotovelo.rotation.x, -1.4, w);
        bd.ombro.rotation.x -= 0.5 * w;
        bd.ombro.rotation.z -= (0.3 + 1.1 * alto) * w;
        bd.cotovelo.rotation.x = lerp(bd.cotovelo.rotation.x, -0.7 - 0.6 * alto, w);
        r.cabeca.rotation.x += 0.12 * w;
        r.boca.scale.y = Math.max(r.boca.scale.y, 0.2 + 0.4 * w);
      }
      /* Assustado com o tremor: escudo na frente da cara, corpo pra trás. */
      if (g.susto > 0) {
        g.susto = Math.max(0, g.susto - dt);
        const w = clamp(g.susto * 1.5) * clamp((1.9 - g.susto) * 6);
        be.ombro.rotation.x -= 1.45 * w;
        be.ombro.rotation.z -= 0.45 * w;
        be.cotovelo.rotation.x = lerp(be.cotovelo.rotation.x, -1.75, w);
        bd.ombro.rotation.z -= 0.45 * w;
        r.tronco.rotation.x -= 0.22 * w;
        r.cabeca.rotation.x -= 0.3 * w;
        r.cabeca.rotation.y += Math.sin(g.tm * 26) * 0.05 * w;
        r.boca.scale.y = Math.max(r.boca.scale.y, 0.2 + 0.7 * w);
        for (const o of r.olhos) o.scale.setScalar(1 + 0.5 * w);
      }

      if (g.modo === "golpe" || g.modo === "cai" || g.modo === "caido") this.poseQueda(dt);
      else if (g.modo === "pisao") this.posePisao(dt);
      this.animarEstrelas(dt);
      r.raiz.updateMatrixWorld(true);
      this.brasaGolias(dt);
    },

    /* Brilho vermelho quando ele se fortalece: o corpo em brasa, um halo
       atrás e luz vermelha no chão em volta. */
    brasaGolias(dt) {
      const g = this.g;
      g.brasa = Math.max(0, g.brasa - dt * 0.8);
      const k = clamp(g.brasa) * (0.75 + 0.25 * Math.sin(this.t * 16));
      if (k > 0 || this.brasaAntes) {
        for (const m of this.matsGolias) m.emissive.setRGB(0.32 * k, 0.02 * k, 0);
      }
      this.brasaAntes = k > 0;
      const peito = g.rig.tronco.getWorldPosition(v3);
      peito.y += 0.3 * ESCALA_GOLIAS * g.e;
      const h = this.alturaGolias();
      this.auraGolias.position.copy(peito).z -= 0.4 * g.e;
      this.auraGolias.scale.set(h * 1.1, h * 1.25, 1);
      this.auraGolias.material.opacity = 0.4 * k;
      this.luzGolias.position.copy(peito).z += 2.5 * g.e;
      this.luzGolias.intensity = LEVE ? 0 : 22 * k;
    },

    /* Pedrada na testa: a cabeça vai pra trás, ele cambaleia de costas até
       ter espaço e cai de cara pra frente, girando no pé. */
    poseQueda() {
      const g = this.g, r = g.rig;
      const [bd, be] = r.bracos;
      const t = g.tm;
      const recuo = clamp(t / 0.35);
      const tontura = clamp((t - 0.25) / 0.9);
      if (g.modo === "golpe") {
        r.cabeca.rotation.x = -0.75 * (1 - tontura * 0.6);
        r.tronco.rotation.x = -0.28 * recuo + Math.sin(t * 9) * 0.06 * tontura;
        r.corpo.rotation.z = Math.sin(t * 6) * 0.1 * tontura;
        bd.ombro.rotation.z = -0.9 - Math.sin(t * 11) * 0.4;
        be.ombro.rotation.z = 0.9 + Math.sin(t * 11 + 1) * 0.4;
        r.boca.scale.y = 1;
        for (const o of r.olhos) o.scale.set(1.5, 1.5, 1);
        g.z = lerp(g.zGolpe, g.zQueda, curva(clamp(t / 0.9)));
        g.fase = Math.PI / 2 + Math.sin(t * 7) * 0.5 * (1 - tontura);
        if (t >= 1.05) { g.modo = "cai"; g.tm = 0; }
        return;
      }
      const k = g.modo === "caido" ? 1 : clamp(t / 0.95);
      const ang = (Math.PI / 2 - 0.1) * k * k;
      r.raiz.rotation.x = ang;
      r.cabeca.rotation.x = -0.3;
      bd.ombro.rotation.set(-2.6 * k, 0, -0.5);
      be.ombro.rotation.set(-2.6 * k, 0, 0.5);
      bd.cotovelo.rotation.x = be.cotovelo.rotation.x = -0.2;
      for (const p of r.pernas) { p.coxa.rotation.x = 0; p.joelho.rotation.x = 0.05; }
      r.boca.scale.y = 0.9;
      for (const o of r.olhos) o.scale.set(1, 0.15, 1);
      if (g.modo === "cai" && k >= 1) {
        g.modo = "caido";
        g.tm = 0;
        const cabeca = r.cabeca.getWorldPosition(v1);
        this.tremor = 1.6;
        this.flash = Math.max(this.flash, 0.35);
        this.nuvem(cabeca.x, cabeca.z, 40, 2.4, 2.8);
        this.nuvem(TRILHA_X, g.z + ESCALA_GOLIAS * g.e * 1.1, 30, 2.4, 2.4);
        this.anelPoeira(TRILHA_X, g.z + ESCALA_GOLIAS * g.e, 6 * g.e);
        this.aoMomento("queda");
        g.estrelasAte = 6;
      }
      if (g.modo === "caido") r.raiz.rotation.x = ang + Math.sin(Math.min(g.tm, 0.5) * Math.PI * 4) * 0.03 * (1 - g.tm * 2);
    },

    /* Pisão: levanta a perna da frente, segura no alto e desce de vez. */
    posePisao() {
      const g = this.g, r = g.rig;
      const t = g.tm;
      const sobe = curva(clamp(t / 0.7));
      const desce = clamp((t - 0.95) / 0.16);
      /* Chega de lado até o pé direito ficar em cima do Davi. */
      r.raiz.position.x = lerp(TRILHA_X, DAVI.x + 0.15 * ESCALA_GOLIAS * g.e, curva(clamp(t / 0.9)));
      r.raiz.rotation.y = 0;
      const [pd, pe] = r.pernas;
      const [bd, be] = r.bracos;
      pd.coxa.rotation.x = lerp(-1.35 * sobe, -0.45, desce);
      pd.joelho.rotation.x = lerp(1.25 * sobe, 0.1, desce);
      pd.pe.rotation.x = 0.2;
      pe.coxa.rotation.x = 0.25 * desce;
      pe.joelho.rotation.x = 0.15;
      r.tronco.rotation.x = lerp(-0.18 * sobe, 0.32, desce);
      r.cabeca.rotation.x = lerp(-0.1, 0.35, desce);
      r.corpo.position.z = 0.35 * desce;
      r.corpo.position.y = -0.08 * desce;
      bd.ombro.rotation.z = -0.6 * sobe;
      be.ombro.rotation.z = 0.8 * sobe;
      r.boca.scale.y = 0.2 + sobe * 0.9;
      if (desce >= 1 && !g.pisou) {
        g.pisou = true;
        this.tremor = 2;
        this.nuvem(DAVI.x, DAVI.z - 0.4, 40, 1.6, 2.6);
        this.anelPoeira(DAVI.x, DAVI.z, 5);
        this.escuroAlvo = 0.86;
        this.d.rig.raiz.visible = false;
        this.d.funda.aro.visible = false;
        this.aoMomento("pisao");
      }
    },

    animarEstrelas(dt) {
      const g = this.g;
      g.estrelasAte = Math.max(0, (g.estrelasAte || 0) - dt);
      const ativo = g.estrelasAte > 0;
      const cabeca = ativo ? g.rig.cabeca.getWorldPosition(v1) : null;
      g.estrelas.forEach((s, i) => {
        s.visible = ativo;
        if (!ativo) return;
        const a = this.t * 3 + (i * Math.PI * 2) / 3;
        const raio = 0.5 * g.e * ESCALA_GOLIAS * 0.35;
        s.position.set(cabeca.x + Math.cos(a) * raio, cabeca.y + 0.5 * g.e + Math.sin(a * 2) * 0.1, cabeca.z + Math.sin(a) * raio);
        s.rotation.y += dt * 6;
        s.scale.setScalar(g.e * 1.5);
      });
    },

    /* ───────────── efeitos ───────────── */

    montarEfeitos() {
      const n = LEVE ? 0.4 : 1;
      this.fogo = new Particulas(Math.round(700 * n), this.tex.brilho, true);
      this.po = new Particulas(Math.round(600 * n), this.tex.poeira, false);
      this.chama = new Particulas(Math.round(400 * n), Texturas.chama(), true);
      this.scene.add(this.fogo.pontos, this.po.pontos, this.chama.pontos);
      this.pedraTiro = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 1),
        new THREE.MeshStandardMaterial({ color: 0xa8a298, roughness: 0.55, flatShading: true, emissive: 0x000000 }));
      this.pedraTiro.visible = false;
      this.pedraTiro.castShadow = true;
      this.scene.add(this.pedraTiro);
      this.aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.brilho, color: 0xffd060, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
      this.scene.add(this.aura);
      this.motesEm = 0;

      this.matPedraOuro = new THREE.MeshStandardMaterial({ color: 0xd8a850, roughness: 0.35, metalness: 0.5, emissive: 0xff9020, emissiveIntensity: 0.45, flatShading: true });
      this.racha = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: Texturas.racha(), transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
      this.racha.rotation.x = -Math.PI / 2;
      this.racha.visible = false;
      this.rachaT = 0;
      this.auraGolias = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.brilho, color: 0xff2a10, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
      this.luzGolias = new THREE.PointLight(0xff3018, 0, 20, 1);
      this.brilhoPlaca = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.brilho, color: 0xfff0c0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
      this.brasaRacha = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.brilho, color: 0xff6418, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
      this.brasaRacha.renderOrder = 4;
      this.scene.add(this.racha, this.brasaRacha, this.auraGolias, this.luzGolias, this.brilhoPlaca);

      /* Raios dourados em leque, sempre no alto do quadro, pra pedra lendária. */
      this.raios = new THREE.Group();
      const geoRaio = new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0);
      this.matRaio = new THREE.MeshBasicMaterial({ map: Texturas.raio(), color: 0xffd36a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      for (let i = 0; i < 11; i++) {
        const m = new THREE.Mesh(geoRaio, this.matRaio);
        m.scale.set(sorte(10, 26), sorte(300, 420), 1);
        m.rotation.z = (i / 10 - 0.5) * 1.9 + sorte(-0.05, 0.05);
        this.raios.add(m);
      }
      this.raios.visible = false;
      this.raios.renderOrder = 1;
      this.scene.add(this.raios);
    },

    nuvem(x, z, quantos, tam, espalha) {
      quantos = Math.round(quantos * (LEVE ? 0.45 : 1));
      for (let i = 0; i < quantos; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * espalha;
        const v = sorte(0.6, 2.4);
        this.po.emitir({
          x: x + Math.cos(a) * r * 0.4, y: sorte(0.05, 0.4), z: z + Math.sin(a) * r * 0.4,
          vx: Math.cos(a) * v * espalha * 0.5, vy: sorte(0.2, 1.1), vz: Math.sin(a) * v * espalha * 0.5,
          vida: sorte(1.2, 2.4), tam: tam * sorte(0.6, 1.1), tamFim: tam * sorte(1.6, 2.6),
          alfa: 0.75, cor: [0.86, 0.66, 0.48], corFim: [0.78, 0.6, 0.48], arrasto: 1.6,
        });
      }
    },

    anelPoeira(x, z, raio) {
      const n = LEVE ? 16 : 36;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        this.po.emitir({
          x: x + Math.cos(a) * 0.5, y: 0.15, z: z + Math.sin(a) * 0.5,
          vx: Math.cos(a) * raio * 1.6, vy: 0.3, vz: Math.sin(a) * raio * 1.6,
          vida: 1.6, tam: raio * 0.25, tamFim: raio * 0.55, alfa: 0.6,
          cor: [0.9, 0.72, 0.52], arrasto: 1.8,
        });
      }
    },

    faiscas(p, quantos, cor, forca = 1) {
      quantos = Math.round(quantos * (LEVE ? 0.5 : 1));
      for (let i = 0; i < quantos; i++) {
        this.fogo.emitir({
          x: p.x, y: p.y, z: p.z,
          vx: sorte(-2, 2) * forca, vy: sorte(-0.5, 2.5) * forca, vz: sorte(-2, 2) * forca,
          vida: sorte(0.35, 0.8), tam: sorte(0.04, 0.09) * forca, tamFim: 0.01,
          cor, corFim: [1, 0.35, 0.05], arrasto: 1.2, grav: 3,
        });
      }
    },

    /* Poeira dourada no ar contra o sol: o vale nunca fica parado. */
    motes(dt) {
      this.motesEm -= dt;
      if (this.motesEm > 0) return;
      this.motesEm = LEVE ? 0.25 : 0.07;
      const cam = this.camera;
      const frente = cam.getWorldDirection(v1);
      const dist = sorte(1.5, 16);
      const p = v2.copy(cam.position).addScaledVector(frente, dist);
      this.fogo.emitir({
        x: p.x + sorte(-1, 1) * dist * 0.5, y: p.y + sorte(-1, 1) * dist * 0.7, z: p.z,
        vx: sorte(0.05, 0.35), vy: sorte(-0.05, 0.12), vz: sorte(-0.1, 0.1),
        vida: sorte(4, 7), tam: sorte(0.02, 0.05), alfa: 0.55, cor: [1, 0.85, 0.6],
      });
    },

    /* ───────────── eventos ───────────── */

    comentou(nome, doGolias) {
      if (doGolias) {
        this.pop(this.g.rig.cabeca.getWorldPosition(v1), `@${nome}`, "golias");
        return;
      }
      this.d.pulso = Math.min(1.5, this.d.pulso + 0.35);
      this.pop(this.cabecaDavi(), `@${nome}`, "");
    },

    curtiu() {
      this.d.pulso = Math.min(1.5, this.d.pulso + 0.15);
    },

    /* Presente do lado do Davi: toda faixa tem destaque com o @, soco no
       ar e a funda acelerando; cada faixa acima é um momento maior. */
    presenteDavi(a, rotulo) {
      const d = this.d, g = this.g;
      const n = Math.min(4, a.faixa);
      if (n < 4) this.destaque(this.cabecaDavi(), rotulo, "davi", n);
      d.pulso = 2;
      d.brilho = Math.max(d.brilho, 1.2);
      if (n < 4) d.reacao = { tipo: "soco", t: 0, dur: 1.3 };
      /* Tremor e lendária são o momento: a troca de Golias que vier junto
         não corta a câmera. */
      if (n >= 3) this.semCorteAte = this.t + 2.5;
      const bolsa = d.funda.ponto || this.cabecaDavi();
      switch (n) {
        case 0:
          this.faiscas(bolsa, 70, [1, 0.95, 0.6], 2.4);
          this.aoMomento("ching");
          break;
        case 1: {
          const m = new THREE.Mesh(this.pedraTiro.geometry, this.matPedraOuro);
          const halo = new THREE.Sprite(this.aura.material.clone());
          halo.material.opacity = 0.3;
          halo.scale.setScalar(0.3);
          m.add(halo);
          m.scale.setScalar(0.01);
          this.scene.add(m);
          const de = this.cabecaDavi().clone().add(v2.set(0, 0.95, 0));
          d.pedrasNaBolsa.push({ mesh: m, de, t: 0, paira: 0.9, dur: 0.5 });
          this.faiscas(de, 40, [1, 0.9, 0.5], 1.6);
          this.aoMomento("ching");
          break;
        }
        case 2:
          d.fogo = 7;
          this.faiscas(bolsa, 50, [1, 0.6, 0.2], 1.9);
          this.labaredas(bolsa, LEVE ? 6 : 14, 1.8);
          this.flash = Math.max(this.flash, 0.2);
          this.aoMomento("fogo");
          break;
        case 3: {
          this.tremor = Math.max(this.tremor, 1.9);
          g.empurrao = 1.2;
          g.susto = 1.9;
          if (g.modo === "anda") {
            g.passo = null;
            this.darPasso(g.z - this.passada() * 0.7, 0.45);
          }
          this.rachar(lerp(DAVI.x, TRILHA_X, 0.6), lerp(DAVI.z, g.z, 0.6), 5);
          this.anelPoeira(DAVI.x, DAVI.z, 3);
          this.aoMomento("tremor");
          break;
        }
        default:
          /* Lendária: tudo apaga, o céu vira ouro e a câmera corta pro
             Davi de baixo; o tiro sai depois (ver `tiro`). */
          this.escuroAlvo = 0.92;
          this.cam.modo = "lenda";
          this.depois(ESCURO_LENDA, () => {
            this.escuroAlvo = 0;
            this.flash = Math.max(this.flash, 0.9);
            this.raiosAlvo = 1;
            this.cam.corte = true;
            d.fogo = 8;
            d.brilho = 2;
            this.faiscas(this.cabecaDavi(), 80, [1, 0.9, 0.5], 2.4);
            this.anelPoeira(DAVI.x, DAVI.z, 4);
            this.aoMomento("lenda", { rotulo });
          });
          break;
      }
    },

    /* Presente do lado do Golias, em degraus: brasa e rosnado; depois a
       lança batendo no escudo; nas faixas altas ele cresce, pisa, racha o
       chão e o Davi se encolhe. */
    presenteGolias(a, rotulo) {
      const g = this.g;
      const n = Math.min(4, a.faixa);
      this.destaque(v1.set(TRILHA_X, 0, g.z), rotulo, "golias", n);
      g.brasa = [0.7, 1.4, 2, 2.4, 2.8][n];
      g.inchar = 1;
      g.incharForca = [0.05, 0.08, 0.2, 0.24, 0.28][n];
      g.incharDur = n >= 2 ? 1.6 : 0.7;
      if (n === 0) {
        g.rugir = g.rugirDur = 0.7;
        this.aoMomento("rugido", { forte: false });
        return;
      }
      g.bater = g.baterDur = 0.8;
      for (const em of [0.2, 0.6]) {
        this.depois(em, () => {
          this.faiscas(g.rig.escudo.getWorldPosition(v1), LEVE ? 30 : 55, [1, 0.88, 0.5], 2.6 * g.e);
          this.flash = Math.max(this.flash, 0.15);
          this.aoMomento("escudo");
        });
      }
      this.depois(0.8, () => {
        g.rugir = g.rugirDur = 1.1 + n * 0.2;
        if (n === 1) {
          this.aoMomento("rugido", { forte: false });
          return;
        }
        this.pisada(1.6 + n * 0.3);
        this.rachar(TRILHA_X, g.z + ESCALA_GOLIAS * g.e * 0.9, ESCALA_GOLIAS * g.e * 1.5);
        this.anelPoeira(TRILHA_X, g.z + 1, (3 + n) * g.e);
        if (this.d.modo === "girando") this.d.reacao = { tipo: "recuo", t: 0, dur: 1.4 + n * 0.3 };
        this.aoMomento("rugido", { forte: true });
      });
    },

    /* Racha que abre no chão com brasa no fundo. */
    rachar(x, z, tam) {
      this.racha.position.set(x, 0.03, z);
      this.racha.rotation.z = sorte(-0.4, 0.4);
      this.racha.visible = true;
      this.rachaT = 0;
      this.rachaTam = tam;
      this.faiscas(v1.set(x, 0.1, z), LEVE ? 30 : 60, [1, 0.55, 0.15], 2.2);
    },

    /* Troca de dono: corte no rosto com a coroa, a placa troca o @ num
       clarão e ele ruge. No começo da rodada só troca, sem corte. */
    novoGolias(nome, troca = false) {
      const g = this.g;
      g.nome = nome;
      g.rig.placa.desenhar(nome);
      g.rig.coroa.visible = true;
      g.coroaPop = 0;
      g.rugir = g.rugirDur = 1.6;
      this.tremor = Math.max(this.tremor, 0.6);
      this.faiscas(g.rig.coroa.getWorldPosition(v1), 40, [1, 0.9, 0.4], 2 * g.e);
      const placa = g.rig.tronco.localToWorld(v2.set(0, 0.4, 0.3));
      this.faiscas(placa, 40, [1, 0.95, 0.7], 1.6 * g.e);
      this.placaBrilho = 1;
      this.aoMomento("rugido", { forte: true });
      if (troca && this.cam.modo === "base" && this.t >= this.semCorteAte) {
        if (this.destaques.davi) this.destaques.davi.remove();
        this.cam.modo = "coroa";
        this.cam.corte = true;
        this.depois(1.6, () => {
          if (this.cam.modo !== "coroa") return;
          this.cam.modo = "base";
          this.cam.corte = true;
        });
      }
    },

    tirarGolias() {
      const g = this.g;
      g.nome = "";
      g.rig.placa.desenhar("");
      g.rig.coroa.visible = false;
    },

    escala(e) { this.g.eAlvo = e; },

    tiro(a) {
      if (a.lendario) this.depois(this.cfg.rodada.lenda || 0, () => this.arremessar(a));
      else this.arremessar(a);
    },

    /* Enrola, solta e a pedra voa em câmera lenta com a câmera atrás
       dela. Acerta a testa ou passa raspando por cima. */
    arremessar(a) {
      const d = this.d;
      d.modo = "arremesso";
      d.tm = 0;
      d.solta = false;
      this.cam.modo = "mira";
      this.voo = { t: 0, acertou: a.acertou, lendario: a.lendario, solto: false, bateu: false, dur: a.lendario ? 2.7 : 2.25 };
      if (a.lendario) d.fogo = 6;
    },

    animarTiro(dtReal) {
      const voo = this.voo;
      if (!voo) return;
      const d = this.d, g = this.g;
      voo.t += dtReal;
      if (!voo.solto && d.tm >= 0.6) {
        voo.solto = true;
        d.solta = true;
        voo.de = d.funda.ponto.clone();
        voo.t = 0;
        this.cam.modo = "pedra";
        this.aoMomento("soltou", { lendario: voo.lendario });
      }
      if (!voo.solto) return;
      const testa = g.rig.cabeca.getWorldPosition(v1).add(v2.set(0, 0.04 * ESCALA_GOLIAS * g.e, 0.17 * ESCALA_GOLIAS * g.e));
      const alvo = voo.acertou ? testa : testa.clone().add(v2.set(1.4 * g.e, 1.8 * g.e, -0.6));
      const u = voo.t / voo.dur;
      const k = voo.acertou ? Math.min(1, u) : u;
      const p = this.pedraTiro.position;
      p.lerpVectors(voo.de, alvo, k);
      if (!voo.acertou && u > 1) p.addScaledVector(v3.subVectors(alvo, voo.de).normalize(), (u - 1) * 30);
      p.y += Math.sin(clamp(k) * Math.PI) * Math.min(1.2, voo.de.distanceTo(alvo) * 0.06);
      voo.dir = v3.subVectors(alvo, voo.de).normalize().clone();
      this.pedraTiro.visible = !voo.bateu;
      this.pedraTiro.scale.setScalar(voo.lendario ? 1.6 : 1.2);
      this.pedraTiro.rotation.x += dtReal * 7;
      this.pedraTiro.rotation.z += dtReal * 5;
      this.pedraTiro.material.emissive.setRGB(voo.lendario ? 0.8 : 0.15, voo.lendario ? 0.55 : 0.1, voo.lendario ? 0.1 : 0.02);
      this.aura.position.copy(p);
      const brilho = voo.lendario ? 1.1 : 0.3;
      this.aura.scale.set(brilho, brilho, 1);
      this.aura.material.opacity = voo.bateu ? 0 : voo.lendario ? 0.95 : 0.5;
      if (!voo.bateu) {
        for (let i = 0; i < (LEVE ? 1 : 2); i++) {
          this.fogo.emitir({
            x: p.x + sorte(-0.03, 0.03), y: p.y + sorte(-0.03, 0.03), z: p.z,
            vx: sorte(-0.1, 0.1), vy: sorte(-0.1, 0.1), vz: sorte(-0.1, 0.1),
            vida: 0.5, tam: voo.lendario ? 0.3 : 0.12, tamFim: 0.02,
            cor: voo.lendario ? [1, 0.8, 0.3] : [1, 0.95, 0.85], corFim: voo.lendario ? [1, 0.3, 0.05] : [0.6, 0.5, 0.4],
          });
        }
      }
      if (voo.acertou && u >= 1 && !voo.bateu) {
        voo.bateu = true;
        this.parado = 0.14;
        this.flash = 0.7;
        this.tremor = 1.2;
        this.faiscas(p, 60, [1, 1, 0.8], 2.2);
        g.modo = "golpe";
        g.tm = 0;
        g.passo = null;
        g.zGolpe = g.z;
        g.zQueda = Math.min(g.z, DAVI.z - 1.2 - ESCALA_GOLIAS * g.e * 2.3);
        this.aoMomento("acertou");
        this.depois(1.2, () => { this.raiosAlvo = 0; });
        this.cam.modo = "rosto";
        this.cam.corte = true;
        this.depois(0.75, () => {
          this.cam.modo = "queda";
          this.cam.corte = true;
        });
      }
      if (!voo.acertou && u >= 1 && !voo.passou) {
        voo.passou = true;
        this.raiosAlvo = 0;
        g.risada = 1.8;
        this.aoMomento("errou");
      }
      if (!voo.acertou && u > 1.6) {
        this.voo = null;
        this.pedraTiro.visible = false;
        this.aura.material.opacity = 0;
        this.cam.modo = "base";
      }
    },

    fim(a) {
      const d = this.d, g = this.g;
      if (a.vencedor === "davi") {
        this.depois(3.5, () => {
          d.modo = "comemora";
          d.tm = 0;
          this.cam.modo = "heroi";
          this.cam.corte = true;
        });
        return;
      }
      d.modo = "medo";
      d.tm = 0;
      this.voo = null;
      this.pedraTiro.visible = false;
      this.aura.material.opacity = 0;
      this.cam.modo = "pisao";
      g.alvoZ = this.zDe(0, g.e);
      if (g.z < g.alvoZ - 0.5) g.modo = "corre";
      else this.comecarPisao();
    },

    comecarPisao() {
      const g = this.g;
      g.modo = "pisao";
      g.tm = 0;
      g.pisou = false;
      g.passo = null;
      g.fase = Math.PI / 2;
      this.aoMomento("rugido", { forte: true });
    },

    /* O que os presentes deixam na cena por uns segundos: a racha no chão,
       o clarão da placa e o céu dourado da pedra lendária. */
    efeitosPresente(dt) {
      if (this.racha.visible) {
        this.rachaT += dt;
        const t = this.rachaT;
        /* Comprida no sentido da câmera: vista de longe, de raspão, achata. */
        const tam = this.rachaTam * (0.3 + 0.7 * curva(clamp(t / 0.25)));
        this.racha.scale.set(tam * 1.5, tam * 3.6, 1);
        const some = clamp((4.5 - t) / 1.2);
        this.racha.material.opacity = clamp(t / 0.08) * some;
        /* Brasa saindo da fenda: de raspão a racha some, a luz e as
           labaredas não. */
        const b = this.brasaRacha;
        b.position.set(this.racha.position.x, 0.25, this.racha.position.z);
        b.scale.set(tam * 2.2, tam * 0.5, 1);
        b.material.opacity = 0.9 * clamp(t / 0.1) * clamp((2.6 - t) / 1.2);
        if (t < 1.6 && Math.random() < (LEVE ? 0.4 : 1)) {
          const p = this.racha.position;
          this.labaredas(v1.set(p.x + sorte(-0.45, 0.45) * tam, 0.05, p.z + sorte(-1, 1) * tam), 1, 0.8 + tam * 0.25);
        }
        if (t > 4.5) this.racha.visible = false;
      } else this.brasaRacha.material.opacity = 0;

      this.placaBrilho = Math.max(0, (this.placaBrilho || 0) - dt * 1.4);
      const g = this.g;
      if (this.placaBrilho > 0) {
        this.brilhoPlaca.position.copy(g.rig.tronco.localToWorld(v1.set(0, 0.4, 0.34)));
        const tam = ESCALA_GOLIAS * g.e * (0.6 + (1 - this.placaBrilho) * 0.6);
        this.brilhoPlaca.scale.set(tam * 1.6, tam, 1);
      }
      this.brilhoPlaca.material.opacity = this.placaBrilho;

      this.raiosK = suave(this.raiosK, this.raiosAlvo, this.raiosAlvo > this.raiosK ? 5 : 1.2, dt);
      const k = this.raiosK;
      this.raios.visible = k > 0.01;
      if (this.raios.visible) {
        const c = this.camera;
        const frente = c.getWorldDirection(v1);
        const cima = v2.set(0, 1, 0).applyQuaternion(c.quaternion);
        this.raios.position.copy(c.position).addScaledVector(frente, 220).addScaledVector(cima, 150);
        this.raios.quaternion.copy(c.quaternion);
        this.matRaio.opacity = 0.5 * k * (0.85 + 0.15 * Math.sin(this.t * 3));
      }
      const u = this.ceu.material.uniforms;
      for (const nome in CEU_LENDA) u[nome].value.copy(this.corCeu[nome]).lerp(CEU_LENDA[nome], k);
      this.scene.fog.color.copy(this.corNeblina).lerp(NEBLINA_LENDA, k * 0.7);
    },

    /* Rodada nova: gigante lá no fundo, Davi de pé, câmera no lugar. */
    reiniciar(distancia, escala) {
      const d = this.d, g = this.g;
      g.e = g.eAlvo = escala;
      g.z = g.alvoZ = this.zDe(distancia, escala);
      g.passo = null;
      g.modo = "anda";
      g.tm = 0;
      g.rugir = g.risada = g.empurrao = 0;
      g.estrelasAte = 0;
      g.fase = Math.PI / 2;
      g.rig.raiz.rotation.set(0, 0, 0);
      d.modo = "girando";
      d.tm = 0;
      d.solta = false;
      d.fogo = 0;
      d.brilho = 0;
      d.reacao = null;
      g.bater = g.susto = g.inchar = g.brasa = 0;
      this.raiosAlvo = 0;
      this.racha.visible = false;
      d.rig.raiz.visible = true;
      d.funda.aro.visible = true;
      this.voo = null;
      this.pedraTiro.visible = false;
      this.aura.material.opacity = 0;
      this.escuroAlvo = 0;
      this.cam.modo = "base";
      this.cam.corte = true;
      this.agenda = [];
    },

    novaRodada(duelo) {
      this.flash = Math.max(this.flash, 0.6);
      this.reiniciar(duelo.dist, duelo.escala);
      if (duelo.golias) this.novoGolias(duelo.golias.nome);
      else this.tirarGolias();
    },

    depois(seg, f) { this.agenda.push({ em: this.t + seg, f }); },

    /* ───────────── câmera ───────────── */

    diretor(dtReal, duelo) {
      const cam = this.cam, g = this.g;
      const pos = v1, olhar = v2;
      let fov = 42, taxa = 2.5;
      const cabeca = g.rig.cabeca.getWorldPosition(new THREE.Vector3());
      if (cam.modo === "mira" || cam.modo === "pedra") {
        /* Plano aberto na diagonal, por baixo: a funda girando, a pedra
           subindo e a testa do gigante, tudo no mesmo quadro. Vai
           chegando devagar enquanto a pedra voa. */
        const u = this.voo && this.voo.solto ? clamp(this.voo.t / this.voo.dur) : 0;
        pos.set(DAVI.x + lerp(1.2, 1, u), lerp(0.6, 0.75, u), DAVI.z + lerp(10, 8.8, u));
        fov = this.enquadrar(pos, olhar, cabeca, 0.06, 0.64, DAVI.x - 0.7);
        taxa = cam.modo === "mira" ? 3 : 1.6;
      } else if (cam.modo === "rosto") {
        /* Close curto no impacto: a cabeça inteira, um pouco de baixo. */
        const cab = ESCALA_GOLIAS * g.e * 0.45;
        pos.copy(cabeca).add(v3.set(cab * 1.3, cab * 0.1, cab * 6.5));
        olhar.copy(cabeca).add(v3.set(0, cab * 0.3, 0));
        fov = 34; taxa = 14;
      } else if (cam.modo === "coroa") {
        /* Troca de dono: a coroa, o rosto e a placa com o @ novo. */
        const cab = ESCALA_GOLIAS * g.e * 0.45;
        olhar.copy(cabeca).y += cab * 0.15;
        pos.copy(olhar).add(v3.set(cab * 1.4, -cab * 0.2, cab * 11));
        fov = 30; taxa = 1.2;
      } else if (cam.modo === "lenda") {
        /* Pedra lendária: o Davi de baixo, contra o céu dourado. */
        pos.set(DAVI.x + 0.5, 0.35, DAVI.z + 3.2);
        olhar.set(DAVI.x - 0.8, 1.7, DAVI.z - 8);
        fov = 58; taxa = 0.8;
      } else if (cam.modo === "queda") {
        /* Baixo e na diagonal da frente: ele cai de cara vindo pra câmera. */
        const h = this.alturaGolias();
        pos.set(TRILHA_X + Math.min(h * 0.8, 7), h * 0.24, g.z + h * 1.95);
        olhar.set(TRILHA_X, h * 0.32, g.z + h * 0.3);
        fov = 56; taxa = 1.6;
      } else if (cam.modo === "heroi") {
        /* Davi virado pra câmera comemorando, o gigante no chão atrás. */
        pos.set(DAVI.x + 0.6, 0.85, DAVI.z + 3.6);
        olhar.set(DAVI.x - 0.4, 1.45, DAVI.z - 6);
        fov = 50; taxa = 2;
      } else if (cam.modo === "pisao") {
        const h = this.alturaGolias();
        pos.set(DAVI.x - 0.6, 0.35, DAVI.z + 3.4);
        olhar.set(lerp(DAVI.x, TRILHA_X, 0.5), h * 0.5, g.z);
        fov = 72; taxa = 3;
      } else {
        const perto = clamp((g.z - this.zDe(duelo.cfg.golias.distancia, 1)) / (this.zDe(0, 1) - this.zDe(duelo.cfg.golias.distancia, 1)));
        const k = Math.pow(perto, 1.3);
        pos.set(DAVI.x - lerp(1.1, 1.3, k), lerp(1.5, 1.05, k), DAVI.z + lerp(11, 7.5, k));
        pos.x += Math.sin(this.t * 0.37) * 0.08;
        pos.y += Math.sin(this.t * 0.51) * 0.05;
        fov = this.enquadrar(pos, olhar, cabeca, 0.05, 0.7, DAVI.x - lerp(0.45, 0.15, k));
        taxa = 2.2;
      }
      this.aplicarCamera(dtReal, pos, olhar, fov, taxa);
    },

    /* Põe o pé do Davi a `pe` da altura da tela (de baixo) e o alto da
       cabeça do Golias a `topo`, abrindo a lente o quanto precisar.
       Devolve o fov e escreve pra onde olhar. */
    enquadrar(pos, olhar, cabeca, pe, topo, alvoX) {
      const g = this.g;
      const ang = alvo => Math.atan2(alvo.y - pos.y, Math.hypot(alvo.x - pos.x, alvo.z - pos.z));
      const alto = v4.copy(cabeca);
      alto.y += 0.35 * ESCALA_GOLIAS * g.e;
      const aPe = ang(v3.set(DAVI.x, 0, DAVI.z));
      const aTopo = ang(alto);
      const fovRad = clamp((aTopo - aPe) / (topo - pe), THREE.MathUtils.degToRad(18), THREE.MathUtils.degToRad(80));
      const pitch = aPe + fovRad * (0.5 - pe);
      /* Celular mais comprido corta dos lados: o Davi nunca sai da tela. */
      const aDavi = Math.atan2(-(DAVI.x - pos.x), -(DAVI.z - pos.z));
      const folga = Math.atan(Math.tan(fovRad / 2) * this.camera.aspect) * 0.55;
      let yaw = Math.atan2(-(alvoX - pos.x), -(Math.max(g.z, -20) - pos.z));
      yaw = clamp(yaw, aDavi - folga, aDavi + folga);
      olhar.set(pos.x - Math.sin(yaw) * 10, pos.y + Math.tan(pitch) * 10, pos.z - Math.cos(yaw) * 10);
      return THREE.MathUtils.radToDeg(fovRad);
    },

    aplicarCamera(dt, pos, olhar, fov, taxa) {
      const cam = this.cam;
      const k = cam.corte ? 1 : 1 - Math.exp(-taxa * dt);
      cam.corte = false;
      cam.pos.lerp(pos, k);
      cam.olhar.lerp(olhar, k);
      cam.fov = lerp(cam.fov, fov, k);
      const c = this.camera;
      c.position.copy(cam.pos);
      c.lookAt(cam.olhar);
      c.fov = cam.fov;
      if (this.tremor > 0.01) {
        const tr = this.tremor * this.tremor;
        c.position.x += (Math.random() - 0.5) * 0.22 * tr;
        c.position.y += (Math.random() - 0.5) * 0.22 * tr;
        c.rotation.z += (Math.random() - 0.5) * 0.03 * tr;
      }
      c.updateProjectionMatrix();
    },

    alturaGolias() { return ESCALA_GOLIAS * this.g.e * this.g.rig.ALTURA; },

    cabecaDavi() {
      return this.d.rig.cabeca.getWorldPosition(new THREE.Vector3());
    },

    /* ───────────── tela (DOM por cima do canvas) ───────────── */

    montarTela(palco) {
      this.palco = palco;
      this.vagas = VAGAS_POP.map(() => null);
      this.destaques = { davi: null, golias: null };
      this.$pops = document.createElement("div");
      this.$pops.className = "pops";
      this.$clarao = document.createElement("div");
      this.$clarao.className = "clarao";
      this.$escuro = document.createElement("div");
      this.$escuro.className = "escuro";
      const vinheta = document.createElement("div");
      vinheta.className = "vinheta";
      palco.querySelector("#vale").after(vinheta, this.$escuro, this.$clarao, this.$pops);
      this.escuroAlvo = 0;
    },

    tela(p) {
      v3.copy(p).project(this.camera);
      return { x: (v3.x + 1) / 2 * this.W, y: (1 - v3.y) / 2 * this.H, atras: v3.z > 1 };
    },

    /* Os @ saem em 4 vagas fixas em volta da cabeça, uma acima da outra e
       alternando os lados: nunca um por cima do outro. Sem vaga livre, o
       mais antigo sai. */
    pop(p, texto, cls) {
      const s = this.tela(p);
      if (s.atras) return;
      let i = this.vagas.indexOf(null);
      if (i < 0) {
        i = this.vagas.reduce((velha, el, k) => (el.nasceu < this.vagas[velha].nasceu ? k : velha), 0);
        this.vagas[i].remove();
      }
      const el = document.createElement("div");
      el.className = `pop ${cls}`;
      el.textContent = texto;
      el.nasceu = performance.now();
      el.addEventListener("animationend", () => {
        el.remove();
        if (this.vagas[i] === el) this.vagas[i] = null;
      });
      this.vagas[i] = el;
      this.$pops.append(el);
      const [dx, dy] = VAGAS_POP[i];
      const meia = el.offsetWidth / 2 + 90;
      el.style.left = `${clamp(s.x + dx, meia, Math.max(meia, this.W - meia))}px`;
      el.style.top = `${clamp(s.y + dy, this.H * 0.26, this.H * 0.8)}px`;
    },

    /* Quem mandou presente ganha um cartão maior que o @ de comentário,
       perto de quem ganhou força. Um por lado: o novo troca o
       anterior. */
    destaque(p, rotulo, lado, n) {
      const s = this.tela(p);
      const velho = this.destaques[lado];
      if (velho) velho.remove();
      const el = document.createElement("div");
      el.className = `destaque ${lado} n${n}`;
      const icone = document.createElement("span");
      icone.textContent = rotulo.simbolo + (rotulo.quantidade > 1 ? `×${rotulo.quantidade}` : "");
      const nome = document.createElement("b");
      nome.textContent = `@${rotulo.nome}`;
      el.append(icone, nome);
      el.addEventListener("animationend", e => {
        if (e.target !== el) return;
        el.remove();
        if (this.destaques[lado] === el) this.destaques[lado] = null;
      });
      this.destaques[lado] = el;
      this.$pops.append(el);
      const meia = el.offsetWidth / 2 + 80;
      /* Do Davi, à esquerda das pernas: não cobre a funda nem o chão na
         frente do gigante. Do Golias, no chão abaixo dos pés (o ponto
         dado é o pé): não cobre o capacete nem a racha. */
      const x = s.atras ? this.W / 2 : lado === "davi" ? s.x - meia - 20 : s.x;
      const y = s.atras ? this.H / 2 : s.y + (lado === "davi" ? 330 : this.destaques.davi ? 460 : 300);
      el.style.left = `${clamp(x, meia, Math.max(meia, this.W - meia))}px`;
      el.style.top = `${clamp(y, this.H * 0.37, this.H * 0.86)}px`;
    },

    /* ───────────── formato ───────────── */

    aplicarFormato(W, H) {
      this.W = W;
      this.H = H;
      this.camera.aspect = W / H;
      this.camera.updateProjectionMatrix();
      if (this.escalaTela) this.dimensionar(this.escalaTela);
    },

    dimensionar(escala) {
      this.escalaTela = escala;
      const dpr = Math.min(LEVE ? 1 : 1.75, window.devicePixelRatio || 1);
      const larg = Math.min(1080, Math.max(2, Math.round(this.W * escala * dpr)));
      const alt = Math.round(larg * this.H / this.W);
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(larg, alt, false);
      this.alturaPx = alt;
    },

    /* ───────────── quadro ───────────── */

    quadro(duelo, dt) {
      const g = this.g;
      let dtReal = dt;
      if (this.parado > 0) {
        this.parado -= dt;
        dtReal = 0;
      }
      const lentoAlvo = this.voo && this.voo.solto && !this.voo.bateu && !this.voo.passou ? 0.22 : 1;
      this.lento = suave(this.lento, lentoAlvo, 8, dt);
      const dtMundo = dtReal * this.lento;
      this.t += dtReal;

      if (this.agenda.length) {
        const prontos = this.agenda.filter(x => x.em <= this.t);
        this.agenda = this.agenda.filter(x => x.em > this.t);
        for (const x of prontos) x.f();
      }

      if (duelo.fase === "rodada" && g.modo === "anda") g.alvoZ = this.zDe(duelo.dist, duelo.escala);
      if (g.modo === "corre" && !g.passo && g.z >= g.alvoZ - 0.3) this.comecarPisao();
      g.eAlvo = duelo.escala;
      this.d.carga = suave(this.d.carga, duelo.fracao(), 4, dtReal);

      this.andarGolias(dtMundo);
      this.poseGolias(dtMundo);
      this.poseDavi(dtMundo);
      this.animarFunda(dtMundo);
      this.animarTiro(dtReal);
      this.motes(dtReal);
      this.fogo.passo(dtMundo);
      this.po.passo(dtMundo);
      this.chama.passo(dtMundo);
      this.ajustarSombra();
      this.diretor(dtReal, duelo);
      this.efeitosPresente(dtReal);

      this.tremor = Math.max(0, this.tremor - dtReal * 2.2);
      this.flash = Math.max(0, this.flash - dtReal * 2.5);
      this.escuro = suave(this.escuro, this.escuroAlvo, this.escuroAlvo > this.escuro ? 12 : 2, dtReal);
      this.$clarao.style.opacity = this.flash.toFixed(3);
      this.$escuro.style.opacity = this.escuro.toFixed(3);

      const px = this.alturaPx / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2));
      this.fogo.material.uniforms.uEscala.value = px;
      this.po.material.uniforms.uEscala.value = px;
      this.chama.material.uniforms.uEscala.value = px;
      this.renderer.render(this.scene, this.camera);
    },
  };
})();
