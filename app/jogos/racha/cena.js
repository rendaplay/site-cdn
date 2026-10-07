/* A pista em 3D (three.js): cenário rolando em laço, os carros instanciados
   (uma malha por modelo, cor por instância), partículas, mísseis, óleo,
   escudo, câmera e as etiquetas com o nome em cima de cada carro.

   O mundo fica parado em volta da câmera e o chão rola por baixo (`rolado`,
   em metros de tela). Os carros não andam pela distância real: ficam em
   formação na ordem da corrida, com a distância comprimida (ver
   `formacao`), e o número de verdade vai no placar e na barra. */
"use strict";

const Cena = (() => {
  const FAIXAS = 6;
  const LARG_FAIXA = 3.2;
  const MEIA_PISTA = FAIXAS * LARG_FAIXA / 2 + 0.4;
  /* Metros de tela por metro de corrida: a 10 m/s a pista rola a 26 m/s. */
  const ESCALA = 2.6;
  const VAO = 240;
  const SEPARACAO = 5.7;
  const MAX = 30;
  const LARGADA_X = 4;
  const COR_IMPULSO = { turbo: [1.0, 0.55, 0.15], nitro: [0.12, 0.45, 1.0], maximo: [0.55, 0.25, 1.0] };

  const FORMATOS = {
    vertical: { W: 1080, H: 1920, fov: 25, dist: 78, angulo: 0.5, alvoZ: 0.2, liderEm: 0.8 },
    horizontal: { W: 1920, H: 1080, fov: 21, dist: 50, angulo: 0.49, alvoZ: 0.4, liderEm: 0.78 },
  };

  const faixaZ = f => -MEIA_PISTA + 0.4 + LARG_FAIXA * (f + 0.5);
  const suave = (atual, alvo, taxa, dt) => atual + (alvo - atual) * (1 - Math.exp(-taxa * dt));
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ───────────── partículas ───────────── */

  class Particulas {
    constructor(max, mapa, aditivo) {
      this.max = max;
      this.i = 0;
      this.dados = {
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
      const d = this.dados;
      const i = this.i;
      this.i = (this.i + 1) % this.max;
      d.p.set([o.x, o.y, o.z], i * 3);
      d.v.set([o.vx || 0, o.vy || 0, o.vz || 0], i * 3);
      d.vida[i] = d.vidaMax[i] = o.vida || 1;
      d.tam0[i] = o.tam || 1;
      d.tam1[i] = o.tamFim ?? o.tam ?? 1;
      d.alfa[i] = o.alfa ?? 1;
      d.arrasto[i] = o.arrasto || 0;
      d.grav[i] = o.grav || 0;
      const c0 = o.cor || [1, 1, 1];
      const c1 = o.corFim || c0;
      d.cor0.set(c0, i * 3);
      d.cor1.set(c1, i * 3);
    }

    passo(dt, rolagem) {
      const d = this.dados;
      const P = this.pos.array, C = this.cor.array, T = this.tam.array, A = this.alf.array;
      for (let i = 0; i < this.max; i++) {
        if (d.vida[i] <= 0) { if (A[i] !== 0) { A[i] = 0; T[i] = 0; } continue; }
        d.vida[i] -= dt;
        const k = i * 3;
        const ar = Math.exp(-d.arrasto[i] * dt);
        d.v[k] *= ar; d.v[k + 1] = d.v[k + 1] * ar - d.grav[i] * dt; d.v[k + 2] *= ar;
        d.p[k] += (d.v[k] - rolagem) * dt;
        d.p[k + 1] += d.v[k + 1] * dt;
        d.p[k + 2] += d.v[k + 2] * dt;
        if (d.p[k + 1] < 0.05 && d.grav[i] > 0) { d.p[k + 1] = 0.05; d.v[k + 1] *= -0.3; }
        const t = 1 - Math.max(0, d.vida[i]) / d.vidaMax[i];
        P[k] = d.p[k]; P[k + 1] = d.p[k + 1]; P[k + 2] = d.p[k + 2];
        for (let c = 0; c < 3; c++) C[k + c] = lerp(d.cor0[k + c], d.cor1[k + c], t);
        T[i] = lerp(d.tam0[i], d.tam1[i], t);
        A[i] = d.alfa[i] * (t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9);
      }
      for (const a of [this.pos, this.cor, this.tam, this.alf]) a.needsUpdate = true;
    }
  }

  /* Pontos de luz fixos (faróis, lanternas, postes): mesmo shader, sem vida. */
  function luzes(max, mapa) {
    const p = new Particulas(max, mapa, true);
    p.n = 0;
    p.limpar = () => { p.n = 0; };
    p.por = (x, y, z, tam, cor, alfa = 1) => {
      if (p.n >= max) return;
      const i = p.n++;
      p.pos.array.set([x, y, z], i * 3);
      p.cor.array.set(cor, i * 3);
      p.tam.array[i] = tam;
      p.alf.array[i] = alfa;
    };
    p.fechar = () => {
      for (let i = p.n; i < max; i++) p.alf.array[i] = 0;
      for (const a of [p.pos, p.cor, p.tam, p.alf]) a.needsUpdate = true;
    };
    return p;
  }

  /* Material com atlas por instância (números das portas, placas). */
  function materialAtlas(mapa, lado, extra = {}) {
    const m = new THREE.MeshLambertMaterial({ map: mapa, transparent: true, ...extra });
    m.onBeforeCompile = s => {
      s.vertexShader = s.vertexShader
        .replace("#include <common>", "#include <common>\nattribute vec2 aCelula;")
        .replace("#include <uv_vertex>", `#include <uv_vertex>\nvMapUv = (vec2(uv.x, 1.0 - uv.y) + aCelula) / ${lado.toFixed(1)};`);
    };
    return m;
  }

  function mesclar(partes) {
    const pos = [], cor = [];
    for (const [geo, c, matriz] of partes) {
      const g = geo.toNonIndexed ? (geo.index ? geo.toNonIndexed() : geo) : geo;
      if (matriz) g.applyMatrix4(matriz);
      const p = g.attributes.position.array;
      const k = new THREE.Color(c);
      for (let i = 0; i < p.length; i += 3) { pos.push(p[i], p[i + 1], p[i + 2]); cor.push(k.r, k.g, k.b); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(cor, 3));
    g.computeVertexNormals();
    return g;
  }

  const M4 = (x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, ry = 0) =>
    new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sx, sy, sz));

  /* ───────────── a cena ───────────── */

  const Cena = {
    L: FORMATOS.vertical,
    formatoAtual: "vertical",
    rolado: 0,
    vRolagem: 0,
    tempo: 0,
    camX: 0,
    tremor: 0,
    agora: 0,
    vis: new Map(),
    ordemVis: [],
    misseis: [],
    bombas: [],
    pocas: [],
    ondas: [],
    foco: null,
    xChegada: null,
    xLargada: LARGADA_X,

    montar(canvas, formato, palco) {
      this.canvas = canvas;
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.05;
      this.scene = new THREE.Scene();
      this.scene.fog = new THREE.Fog(0xd98a6e, 110, 340);
      this.camera = new THREE.PerspectiveCamera(25, 9 / 16, 5, 900);

      this.texturas = {
        brilho: Texturas.brilho(), fumaca: Texturas.fumaca(), sombra: Texturas.sombra(),
        facho: Texturas.facho(), oleo: Texturas.oleo(),
      };
      this.montarLuz();
      this.montarCenario();
      this.montarFrota();
      this.montarEfeitos();
      this.montarEtiquetas(palco);
      this.formato(formato);
    },

    montarLuz() {
      const s = this.scene;
      s.add(new THREE.HemisphereLight(0xffc49a, 0x3a2f4a, 1.05));
      this.sol = new THREE.DirectionalLight(0xffd6a8, 2.1);
      this.sol.position.set(-40, 34, 46);
      s.add(this.sol);
      const contra = new THREE.DirectionalLight(0x8fa8ff, 0.55);
      contra.position.set(30, 18, -40);
      s.add(contra);
      this.clarao = new THREE.PointLight(0xffa040, 0, 40, 1.6);
      this.clarao.position.set(0, 3, 0);
      s.add(this.clarao);
    },

    montarCenario() {
      const s = this.scene;
      const t = this.texturas;

      const ceuMat = new THREE.MeshBasicMaterial({ map: Texturas.ceu(), fog: false, depthWrite: false });
      this.ceu = new THREE.Mesh(new THREE.PlaneGeometry(1400, 260), ceuMat);
      this.ceu.position.set(0, 70, -420);
      this.ceu.renderOrder = -1;
      s.add(this.ceu);

      /* Serras ao longe, duas camadas, sem rolar com o chão (parallax). */
      this.serras = new THREE.Group();
      const rnd = Texturas.sorteio(17);
      [[-300, 0x4b3a63, 34], [-230, 0x5e4766, 22]].forEach(([z, cor, alt]) => {
        const pts = [];
        for (let x = -700; x <= 700; x += 40) pts.push(new THREE.Vector2(x, alt * (0.3 + rnd() * 0.7)));
        const forma = new THREE.Shape([new THREE.Vector2(-700, -5), ...pts, new THREE.Vector2(700, -5)]);
        const m = new THREE.Mesh(new THREE.ShapeGeometry(forma), new THREE.MeshBasicMaterial({ color: cor, fog: true }));
        m.position.z = z;
        this.serras.add(m);
      });
      s.add(this.serras);

      const chaoT = Texturas.grama();
      chaoT.repeat.set(900 / 12, 560 / 12);
      this.chao = new THREE.Mesh(new THREE.PlaneGeometry(900, 560), new THREE.MeshLambertMaterial({ map: chaoT }));
      this.chao.rotation.x = -Math.PI / 2;
      this.chao.position.set(0, -0.03, -200);
      s.add(this.chao);

      const largura = MEIA_PISTA * 2;
      const pistaT = Texturas.asfalto({ faixas: FAIXAS, largura });
      pistaT.repeat.set(320 / 16, 1);
      this.pistaMat = new THREE.MeshPhongMaterial({ map: pistaT, shininess: 12, specular: 0x222222 });
      this.pista = new THREE.Mesh(new THREE.PlaneGeometry(320, largura), this.pistaMat);
      this.pista.rotation.x = -Math.PI / 2;
      s.add(this.pista);

      const acost = Texturas.cascalho();
      acost.repeat.set(320 / 4, 1);
      this.acostamentos = [[-MEIA_PISTA - 0.9, 1.8], [MEIA_PISTA + 1.1, 2.2]].map(([z, w]) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(320, w), new THREE.MeshLambertMaterial({ map: acost }));
        m.rotation.x = -Math.PI / 2;
        m.position.set(0, -0.01, z);
        s.add(m);
        return m;
      });

      const railT = Texturas.guardRail();
      railT.repeat.set(320 / 8, 1);
      this.rail = new THREE.Mesh(new THREE.BoxGeometry(320, 0.34, 0.12), [
        new THREE.MeshLambertMaterial({ color: 0x8a8f96 }), new THREE.MeshLambertMaterial({ color: 0x8a8f96 }),
        new THREE.MeshLambertMaterial({ color: 0xb8bcc2 }), new THREE.MeshLambertMaterial({ color: 0x6d7178 }),
        new THREE.MeshPhongMaterial({ map: railT, shininess: 40 }), new THREE.MeshLambertMaterial({ color: 0x6d7178 }),
      ]);
      this.rail.position.set(0, 0.72, -MEIA_PISTA - 1.6);
      s.add(this.rail);
      this.texturasRolando = [[pistaT, 16, 320], [acost, 4, 320], [railT, 8, 320]];
      this.chaoT = chaoT;

      this.grupoCenario = new THREE.Group();
      s.add(this.grupoCenario);
      this.montarObjetosCenario();
      this.montarPorticos();
    },

    /* Tudo que passa pela beira (postes, árvores, placas, balizadores) em
       duas cópias de VAO metros, pra rolar em laço sem buraco. */
    montarObjetosCenario() {
      const g = this.grupoCenario;
      const rnd = Texturas.sorteio(29);
      const lista = (n, gerar) => {
        const base = Array.from({ length: n }, (_, i) => gerar(i));
        return [...base, ...base.map(m => new THREE.Matrix4().makeTranslation(VAO, 0, 0).multiply(m))];
      };
      const instanciar = (geo, mat, matrizes) => {
        const m = new THREE.InstancedMesh(geo, mat, matrizes.length);
        matrizes.forEach((x, i) => m.setMatrixAt(i, x));
        m.frustumCulled = false;
        g.add(m);
        return m;
      };
      const vertexMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

      const zRail = -MEIA_PISTA - 1.6;
      instanciar(new THREE.BoxGeometry(0.14, 0.9, 0.14), new THREE.MeshLambertMaterial({ color: 0x7a7f86 }),
        lista(VAO / 2.5, i => M4(i * 2.5, 0.45, zRail - 0.1)));

      const poste = mesclar([
        [new THREE.CylinderGeometry(0.12, 0.18, 10, 6), 0x9aa0a6, M4(0, 5, 0)],
        [new THREE.BoxGeometry(0.14, 0.14, 3.2), 0x9aa0a6, M4(0, 9.9, 1.5)],
        [new THREE.BoxGeometry(0.5, 0.22, 0.9), 0x55585e, M4(0, 9.8, 3.1)],
        [new THREE.BoxGeometry(0.4, 0.04, 0.7), 0xffe2a0, M4(0, 9.68, 3.1)],
      ]);
      const postes = [];
      instanciar(poste, vertexMat, lista(VAO / 40, i => { postes.push(i * 40 + 12); return M4(i * 40 + 12, 0, zRail - 1.2); }));
      this.postesX = postes;
      this.zPoste = zRail - 1.2 + 3.1;

      const arvore = mesclar([
        [new THREE.CylinderGeometry(0.22, 0.32, 2.6, 5), 0x5a3d28, M4(0, 1.3, 0)],
        [new THREE.IcosahedronGeometry(2.1, 0), 0x2f5a2a, M4(0, 3.6, 0, 1, 0.9, 1)],
        [new THREE.IcosahedronGeometry(1.5, 0), 0x3d6e30, M4(0.4, 5.0, 0.2)],
      ]);
      const arvores = [];
      for (let i = 0; i < 46; i++) {
        const longe = rnd() < 0.9;
        const z = longe ? -16 - rnd() * 70 : MEIA_PISTA + 7 + rnd() * 26;
        const e = 0.8 + rnd() * 0.9;
        arvores.push(M4(rnd() * VAO, 0, z, e, e * (0.85 + rnd() * 0.4), e, rnd() * 6));
      }
      instanciar(arvore, vertexMat, [...arvores, ...arvores.map(m => new THREE.Matrix4().makeTranslation(VAO, 0, 0).multiply(m))]);

      const moita = mesclar([[new THREE.IcosahedronGeometry(0.9, 0), 0x46692f, M4(0, 0.5, 0, 1.4, 0.8, 1)]]);
      const moitas = [];
      for (let i = 0; i < 40; i++) {
        const perto = rnd() < 0.4;
        const z = perto ? MEIA_PISTA + 3.4 + rnd() * 5 : -MEIA_PISTA - 3.5 - rnd() * 10;
        const e = perto ? 0.35 + rnd() * 0.35 : 0.6 + rnd() * 0.9;
        moitas.push(M4(rnd() * VAO, 0, z, e, e, e, rnd() * 6));
      }
      instanciar(moita, vertexMat, [...moitas, ...moitas.map(m => new THREE.Matrix4().makeTranslation(VAO, 0, 0).multiply(m))]);

      const baliza = mesclar([
        [new THREE.BoxGeometry(0.16, 1.1, 0.16), 0xf0eee8, M4(0, 0.55, 0)],
        [new THREE.BoxGeometry(0.17, 0.2, 0.17), 0x1a1a1a, M4(0, 0.85, 0)],
        [new THREE.BoxGeometry(0.06, 0.1, 0.18), 0xd8261c, M4(0.06, 0.95, 0)],
      ]);
      instanciar(baliza, vertexMat, lista(VAO / 20, i => M4(i * 20 + 5, 0, MEIA_PISTA + 2.6)));

      const placasT = Texturas.placas();
      const placaGeo = new THREE.PlaneGeometry(9, 4.5);
      const cel = [];
      const placas = [];
      const pernas = [];
      for (let i = 0; i < VAO / 60; i++) {
        const x = i * 60 + 34;
        const alt = 4.2 + (i % 2) * 1.2;
        placas.push(M4(x, alt + 2.25, -26));
        pernas.push(M4(x - 3, alt / 2, -26.15, 1, alt, 1), M4(x + 3, alt / 2, -26.15, 1, alt, 1));
        cel.push(i % 4);
      }
      const matPlaca = materialAtlas(placasT, 2, { transparent: false });
      matPlaca.onBeforeCompile = s => {
        s.vertexShader = s.vertexShader
          .replace("#include <common>", "#include <common>\nattribute vec2 aCelula;")
          .replace("#include <uv_vertex>", "#include <uv_vertex>\nvMapUv = (uv + aCelula) * vec2(0.5, 0.5);");
      };
      const mPlacas = instanciar(placaGeo, matPlaca, [...placas, ...placas.map(m => new THREE.Matrix4().makeTranslation(VAO, 0, 0).multiply(m))]);
      const celulas = new Float32Array(mPlacas.count * 2);
      [...cel, ...cel].forEach((c, i) => { celulas[i * 2] = c % 2; celulas[i * 2 + 1] = 1 - Math.floor(c / 2); });
      placaGeo.setAttribute("aCelula", new THREE.InstancedBufferAttribute(celulas, 2));
      instanciar(new THREE.BoxGeometry(0.25, 1, 0.25), new THREE.MeshLambertMaterial({ color: 0x4a4d52 }),
        [...pernas, ...pernas.map(m => new THREE.Matrix4().makeTranslation(VAO, 0, 0).multiply(m))]);

      /* Luz amarela dos postes no chão e o brilho da lâmpada. */
      const poca = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
        map: this.texturas.facho, color: 0xffb35a, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      const pocas = [];
      for (const x of [...postes, ...postes.map(x => x + VAO)]) {
        pocas.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0.03, this.zPoste + 1.5),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), new THREE.Vector3(14, 11, 1)));
      }
      instanciar(poca.geometry, poca.material, pocas).renderOrder = 1;

      this.luzesPoste = luzes(postes.length * 2, this.texturas.brilho);
      for (const x of [...postes, ...postes.map(x => x + VAO)]) this.luzesPoste.por(x, 9.62, this.zPoste, 4.2, [1.0, 0.78, 0.45], 0.9);
      this.luzesPoste.fechar();
      g.add(this.luzesPoste.pontos);
    },

    /* Largada e chegada: faixa quadriculada no asfalto e a placa do outro
       lado do guard-rail, de frente pra câmera. */
    montarPorticos() {
      const portico = nome => {
        const grupo = new THREE.Group();
        const cinza = new THREE.MeshLambertMaterial({ color: 0x3a3d44 });
        const zPlaca = -MEIA_PISTA - 4.5;
        for (const x of [-5.4, 5.4]) {
          const poste = new THREE.Mesh(new THREE.BoxGeometry(0.35, 6.2, 0.35), cinza);
          poste.position.set(x, 3.1, zPlaca - 0.2);
          grupo.add(poste);
        }
        const placa = new THREE.Mesh(new THREE.PlaneGeometry(12, 1.5), new THREE.MeshBasicMaterial({ map: Texturas.faixaPortico(nome), fog: false }));
        placa.position.set(0, 5.6, zPlaca);
        grupo.add(placa);
        const quad = Texturas.quadriculado();
        quad.repeat.set(1, 10);
        const faixa = new THREE.Mesh(new THREE.PlaneGeometry(1.6, MEIA_PISTA * 2), new THREE.MeshLambertMaterial({ map: quad }));
        faixa.rotation.x = -Math.PI / 2;
        faixa.position.y = 0.02;
        grupo.add(faixa);
        this.scene.add(grupo);
        return grupo;
      };
      this.porticoLargada = portico("LARGADA");
      this.porticoChegada = portico("CHEGADA");
      this.porticoChegada.visible = false;
    },

    montarFrota() {
      const s = this.scene;
      this.matPintura = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 90, specular: 0x555555, flatShading: true });
      this.matDetalhe = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 50, specular: 0x333333, flatShading: true });
      this.modelos = Carros.MODELOS.map(m => {
        const p = new THREE.InstancedMesh(m.pintura, this.matPintura, MAX);
        const d = new THREE.InstancedMesh(m.detalhe, this.matDetalhe, MAX);
        p.setColorAt(0, new THREE.Color(1, 1, 1));
        for (const x of [p, d]) { x.count = 0; x.frustumCulled = false; s.add(x); }
        return { ...m, mp: p, md: d };
      });
      this.rodas = new THREE.InstancedMesh(Carros.roda(), new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 30, flatShading: true }), MAX * 4);
      this.rodas.frustumCulled = false;
      s.add(this.rodas);

      const placaGeo = new THREE.PlaneGeometry(1, 1);
      this.celulas = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 2), 2);
      this.celulas.setUsage(THREE.DynamicDrawUsage);
      placaGeo.setAttribute("aCelula", this.celulas);
      this.placas = new THREE.InstancedMesh(placaGeo, materialAtlas(Texturas.numeros(), Texturas.NUMEROS_LADO, { alphaTest: 0.4 }), MAX);
      this.placas.frustumCulled = false;
      s.add(this.placas);

      const chapa = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
      this.sombras = new THREE.InstancedMesh(chapa, new THREE.MeshBasicMaterial({ map: this.texturas.sombra, transparent: true, depthWrite: false }), MAX);
      this.fachos = new THREE.InstancedMesh(chapa, new THREE.MeshBasicMaterial({
        map: this.texturas.facho, color: 0xfff0d0, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false,
      }), MAX);
      for (const m of [this.sombras, this.fachos]) { m.frustumCulled = false; m.renderOrder = 1; s.add(m); }

      this.escudos = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), new THREE.ShaderMaterial({
        uniforms: { uTempo: { value: 0 } },
        vertexShader: `
          varying float vBorda;
          void main() {
            vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
            vec3 n = normalize(normalMatrix * mat3(instanceMatrix) * normal);
            vBorda = 1.0 - abs(dot(n, normalize(-mv.xyz)));
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform float uTempo; varying float vBorda;
          void main() {
            float a = pow(vBorda, 2.2) * (0.75 + 0.25 * sin(uTempo * 6.0)) + 0.06;
            gl_FragColor = vec4(vec3(0.35, 0.85, 1.0) * a * 1.6, a);
            #include <colorspace_fragment>
          }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }), MAX);
      this.escudos.frustumCulled = false;
      this.escudos.renderOrder = 4;
      s.add(this.escudos);

      this.luzesCarro = luzes(MAX * 5, this.texturas.brilho);
      s.add(this.luzesCarro.pontos);
      this._m = new THREE.Matrix4();
      this._m2 = new THREE.Matrix4();
      this._q = new THREE.Quaternion();
      this._e = new THREE.Euler();
      this._v = new THREE.Vector3();
      this._s = new THREE.Vector3();
      this._c = new THREE.Color();
    },

    montarEfeitos() {
      this.fogo = new Particulas(1400, this.texturas.brilho, true);
      this.fumo = new Particulas(900, this.texturas.fumaca, false);
      this.scene.add(this.fogo.pontos, this.fumo.pontos);

      const missil = mesclar([
        [new THREE.CylinderGeometry(0.16, 0.16, 1.3, 8).rotateZ(Math.PI / 2), 0xe8e8e8, null],
        [new THREE.ConeGeometry(0.16, 0.45, 8).rotateZ(-Math.PI / 2), 0xd8261c, M4(0.87, 0, 0)],
        [new THREE.BoxGeometry(0.3, 0.5, 0.04), 0xd8261c, M4(-0.55, 0, 0)],
        [new THREE.BoxGeometry(0.3, 0.04, 0.5), 0xd8261c, M4(-0.55, 0, 0)],
      ]);
      this.malhaMissil = new THREE.InstancedMesh(missil, new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true }), 8);
      this.malhaMissil.count = 0;
      this.malhaMissil.frustumCulled = false;
      this.scene.add(this.malhaMissil);

      const bomba = mesclar([
        [new THREE.IcosahedronGeometry(0.8, 1), 0x1c1c22, null],
        [new THREE.CylinderGeometry(0.22, 0.22, 0.4, 8), 0x55585e, M4(0, 0.85, 0)],
      ]);
      this.malhaBomba = new THREE.InstancedMesh(bomba, new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 80 }), 2);
      this.malhaBomba.count = 0;
      this.malhaBomba.frustumCulled = false;
      this.scene.add(this.malhaBomba);

      this.malhaPoca = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
        new THREE.MeshPhongMaterial({ map: this.texturas.oleo, transparent: true, shininess: 120, specular: 0x888888, depthWrite: false }), 8);
      this.malhaPoca.count = 0;
      this.malhaPoca.frustumCulled = false;
      this.malhaPoca.renderOrder = 1;
      this.scene.add(this.malhaPoca);

      this.malhaOnda = new THREE.InstancedMesh(new THREE.RingGeometry(0.85, 1, 48).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), 4);
      this.malhaOnda.count = 0;
      this.malhaOnda.frustumCulled = false;
      this.scene.add(this.malhaOnda);

      /* Linhas de velocidade: riscos claros correndo mais rápido que o chão. */
      this.riscos = Array.from({ length: 34 }, (_, i) => ({ x: i * 9, y: 0.3 + (i * 7 % 10) / 10 * 2.6, z: faixaZ(i % FAIXAS) + ((i * 13) % 7 - 3) * 0.3, len: 7 + (i * 5 % 9) }));
      this.malhaRiscos = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 0.06), new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      }), this.riscos.length);
      this.malhaRiscos.frustumCulled = false;
      this.malhaRiscos.renderOrder = 3;
      this.scene.add(this.malhaRiscos);

      const n = 700;
      const chuvaGeo = new THREE.BufferGeometry();
      chuvaGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 6), 3).setUsage(THREE.DynamicDrawUsage));
      this.chuva = new THREE.LineSegments(chuvaGeo, new THREE.LineBasicMaterial({ color: 0xbfd2ff, transparent: true, opacity: 0.38 }));
      this.chuva.frustumCulled = false;
      this.chuva.visible = false;
      this.gotas = Array.from({ length: n }, () => [Math.random() * 90 - 45, Math.random() * 30, Math.random() * 60 - 30]);
      this.scene.add(this.chuva);
    },

    montarEtiquetas(palco) {
      this.camadaEtiquetas = document.createElement("div");
      this.camadaEtiquetas.className = "etiquetas";
      palco.querySelector(".hud-pista").appendChild(this.camadaEtiquetas);
      this.etiquetas = new Map();
    },

    formato(nome) {
      this.formatoAtual = nome;
      this.L = FORMATOS[nome];
      this.camera.fov = this.L.fov;
      this.camera.aspect = this.L.W / this.L.H;
      this.camera.updateProjectionMatrix();
      if (this.escala) this.dimensionar(this.escala);
    },

    dimensionar(escala) {
      this.escala = escala;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(2, Math.round(this.L.W * escala * dpr));
      const h = Math.max(2, Math.round(this.L.H * escala * dpr));
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(w, h, false);
      const px = h / (2 * Math.tan(THREE.MathUtils.degToRad(this.L.fov) / 2));
      for (const p of [this.fogo, this.fumo, this.luzesCarro, this.luzesPoste]) p.material.uniforms.uEscala.value = px;
    },

    larguraVisivel(dist = this.L.dist) {
      return 2 * dist * Math.tan(THREE.MathUtils.degToRad(this.L.fov) / 2) * (this.L.W / this.L.H);
    },

    /* ───────────── formação ───────────── */

    /* Ordem da tela com histerese: só troca dois carros vizinhos quando a
       diferença passa de 0,4 m, senão dois carros colados piscam de lugar. */
    ordenarVisiveis(lista) {
      const chave = p => (p.chegada != null ? 1e6 - p.chegada : p.d);
      const por = new Map(lista.map(p => [p.id, p]));
      let ordem = this.ordemVis.filter(id => por.has(id));
      for (const p of lista) {
        if (ordem.includes(p.id)) continue;
        let i = ordem.findIndex(id => chave(por.get(id)) < chave(p));
        if (i < 0) i = ordem.length;
        ordem.splice(i, 0, p.id);
      }
      for (let volta = 0; volta < 3; volta++) {
        for (let i = 0; i < ordem.length - 1; i++) {
          if (chave(por.get(ordem[i + 1])) > chave(por.get(ordem[i])) + 0.4) [ordem[i], ordem[i + 1]] = [ordem[i + 1], ordem[i]];
        }
      }
      this.ordemVis = ordem;
      return ordem.map(id => por.get(id));
    },

    formacao(lista, fase) {
      const alvos = new Map();
      if (fase === "espera" || fase === "largada") {
        const ordemFaixas = [2, 3, 1, 4, 0, 5];
        lista.forEach((p, i) => {
          const fila = Math.floor(i / FAIXAS);
          const k = i % FAIXAS;
          alvos.set(p.id, { x: LARGADA_X - 3 - fila * 6.4 - (k % 2) * 1.6, faixa: ordemFaixas[k] });
        });
        return alvos;
      }
      /* Vão de tela entre um carro e o de trás: proporcional ao gap real,
         encolhido por igual quando a formação não cabe em ~80% da tela. */
      const chave = p => (p.chegada != null ? Infinity : p.d);
      const passo = 1.0;
      const vaos = lista.map((p, i) => {
        if (!i) return 0;
        const a = chave(lista[i - 1]), b = chave(p);
        return a === Infinity && b === Infinity ? 0.4 : Math.min(8, Math.max(0, a - b) * 0.4);
      });
      const soma = vaos.reduce((s, v) => s + v, 0);
      const cabe = this.larguraVisivel() * 0.8 - passo * Math.max(0, lista.length - 1);
      const fator = soma > Math.max(0, cabe) ? Math.max(0, cabe) / soma : 1;
      const ultimo = new Array(FAIXAS).fill(Infinity);
      let xAnt = 0;
      lista.forEach((p, i) => {
        const v = this.vis.get(p.id);
        const pref = v ? v.faixa : this.faixaInicial(p);
        const desejado = i ? xAnt - passo - vaos[i] * fator : 0;
        let melhor = null;
        for (let f = 0; f < FAIXAS; f++) {
          const x = Math.min(desejado, ultimo[f] - SEPARACAO);
          const nota = x - Math.abs(f - pref) * 1.1 - (f === pref ? 0 : 0.5);
          if (!melhor || nota > melhor.nota) melhor = { f, x, nota };
        }
        ultimo[melhor.f] = melhor.x;
        alvos.set(p.id, { x: melhor.x, faixa: melhor.f });
        xAnt = melhor.x;
      });
      return alvos;
    },

    faixaInicial(p) { return (p.numero * 7) % FAIXAS; },

    /* ───────────── quadro ───────────── */

    quadro(dt, e) {
      this.tempo += dt;
      const { racha, agora, visiveis } = e;
      this.agora = agora;
      const fase = racha.fase;
      const lista = this.ordenarVisiveis(visiveis);
      const alvos = this.formacao(lista, fase);

      let vAlvo = 0;
      if (racha.correndo) {
        const frente = lista.slice(0, 6);
        vAlvo = frente.reduce((s, p) => s + (p.v || racha.config.velocidade), 0) / Math.max(1, frente.length) * ESCALA;
      }
      this.vRolagem = suave(this.vRolagem, vAlvo, fase === "podio" ? 1.2 : 1.6, dt);
      this.rolado += this.vRolagem * dt;

      this.atualizarCarros(dt, lista, alvos, racha, agora);
      this.atualizarCamera(dt, lista, racha, agora);
      this.atualizarCenario(dt, racha);
      this.atualizarEfeitos(dt, racha);
      this.desenharCarros(racha, agora);
      this.renderer.render(this.scene, this.camera);
      this.atualizarEtiquetas(lista, racha, agora);
    },

    atualizarCarros(dt, lista, alvos, racha, agora) {
      const larg = this.larguraVisivel();
      const esquerda = this.camX - larg * 0.62;
      const presentes = new Set();
      for (const p of lista) {
        presentes.add(p.id);
        const alvo = alvos.get(p.id);
        let v = this.vis.get(p.id);
        if (!v) {
          const naGrade = racha.fase === "espera" || racha.fase === "largada";
          v = {
            id: p.id, x: naGrade ? alvo.x : Math.min(alvo.x, esquerda - 4), vx: naGrade ? 0 : 8,
            z: faixaZ(alvo.faixa), vz: 0, faixa: alvo.faixa, roda: 0, yaw: 0, giro: null, saindo: false,
          };
          this.vis.set(p.id, v);
        }
        v.saindo = false;
        v.faixa = alvo.faixa;
        v.alvoX = alvo.x;
      }
      for (const [id, v] of this.vis) {
        if (!presentes.has(id)) {
          v.saindo = true;
          v.alvoX = esquerda - 12;
          if (v.x < esquerda - 10) { this.vis.delete(id); continue; }
        }
        const k = 5.5;
        v.vx += ((v.alvoX - v.x) * k - v.vx * 2 * Math.sqrt(k)) * dt;
        v.vx = Math.max(-30, Math.min(30, v.vx));
        v.x += v.vx * dt;
        const kz = 7;
        v.vz += ((faixaZ(v.faixa) - v.z) * kz - v.vz * 2 * Math.sqrt(kz)) * dt;
        v.z += v.vz * dt;
        const frente = this.vRolagem + v.vx;
        v.yaw = suave(v.yaw, Math.max(-0.4, Math.min(0.4, Math.atan2(-v.vz, Math.max(4, frente)))), 10, dt);
        v.roda += frente * dt;
      }
    },

    atualizarCamera(dt, lista, racha, agora) {
      const L = this.L;
      let dist = L.dist;
      let angulo = L.angulo;
      let alvoZ = L.alvoZ;
      let giro = 0;
      const larg = this.larguraVisivel();
      let x;
      const lider = lista[0] && this.vis.get(lista[0].id);
      if (racha.fase === "espera" || racha.fase === "largada") {
        x = LARGADA_X - larg * 0.28;
      } else if (racha.fase === "podio" && racha.podio && this.vis.get(racha.podio[0].id)) {
        const v = this.vis.get(racha.podio[0].id);
        dist *= 0.5;
        angulo *= 0.75;
        alvoZ = v.z + 1;
        x = v.x + 0.5;
        giro = Math.sin(this.tempo * 0.35) * 0.22 - 0.12;
      } else {
        x = lider ? lider.x - larg * (L.liderEm - 0.5) : 0;
        if (this.foco && agora < this.foco.ate && this.vis.get(this.foco.id)) {
          const v = this.vis.get(this.foco.id);
          x = Math.min(x, v.x + larg * 0.12);
          dist *= 0.88;
        }
      }
      this.camX = suave(this.camX, x, 2.4, dt);
      this.camDist = suave(this.camDist || dist, dist, 1.8, dt);
      this.camAng = suave(this.camAng || angulo, angulo, 1.8, dt);
      this.camZ = suave(this.camZ ?? alvoZ, alvoZ, 1.8, dt);
      this.camGiro = suave(this.camGiro || 0, giro, 1.2, dt);
      this.tremor = Math.max(0, this.tremor - dt * 2.2);
      const t = this.tremor * this.tremor;
      const tx = (Math.sin(this.tempo * 61) + Math.sin(this.tempo * 37)) * 0.35 * t;
      const ty = (Math.sin(this.tempo * 53) + Math.sin(this.tempo * 29)) * 0.3 * t;
      const alvo = new THREE.Vector3(this.camX + tx, ty, this.camZ);
      const d = this.camDist;
      this.camera.position.set(
        alvo.x + Math.sin(this.camGiro) * Math.cos(this.camAng) * d,
        alvo.y + Math.sin(this.camAng) * d,
        alvo.z + Math.cos(this.camGiro) * Math.cos(this.camAng) * d,
      );
      this.camera.lookAt(alvo);
    },

    atualizarCenario(dt, racha) {
      const cx = this.camX;
      for (const m of [this.pista, this.rail, ...this.acostamentos]) m.position.x = cx;
      for (const [t, tile, len] of this.texturasRolando) t.offset.x = (((cx - len / 2 + this.rolado) / tile) % 1 + 1) % 1;
      this.chao.position.x = cx;
      this.chaoT.offset.x = ((((cx - 450 + this.rolado) / 12) % 1) + 1) % 1;
      this.ceu.position.x = cx;
      this.serras.position.x = cx * 0.92 - this.rolado * 0.004;

      let base = -(this.rolado % VAO);
      while (base > cx - VAO * 0.9) base -= VAO;
      while (base + VAO * 2 < cx + VAO * 0.9) base += VAO;
      this.grupoCenario.position.x = base;

      const lider = this.ordemVis[0] && this.vis.get(this.ordemVis[0]);
      const pLider = racha.lider;
      if (racha.fase === "espera" || racha.fase === "largada") {
        this.xLargada = LARGADA_X;
        this.xChegada = null;
      } else {
        this.xLargada -= this.vRolagem * dt;
        if (racha.fase === "corrida" && pLider && lider) this.xChegada = lider.x + (racha.pista - pLider.d) * ESCALA;
        else if (this.xChegada != null) this.xChegada -= this.vRolagem * dt;
      }
      const larg = this.larguraVisivel(this.L.dist * 1.6);
      this.porticoLargada.visible = Math.abs(this.xLargada - cx) < larg;
      this.porticoLargada.position.x = this.xLargada;
      this.porticoChegada.visible = this.xChegada != null && Math.abs(this.xChegada - cx) < larg;
      if (this.xChegada != null) this.porticoChegada.position.x = this.xChegada;

      const forte = Math.min(1, this.vRolagem / 30);
      this.malhaRiscos.material.opacity = 0.34 * forte * forte;
      const m = this._m;
      this.riscos.forEach((r, i) => {
        r.x -= (this.vRolagem * 1.8) * dt;
        if (r.x < cx - 70) r.x += 140;
        if (r.x > cx + 70) r.x -= 140;
        m.makeScale(r.len * (0.4 + forte), 1.6, 1).setPosition(r.x, r.y, r.z);
        this.malhaRiscos.setMatrixAt(i, m);
      });
      this.malhaRiscos.instanceMatrix.needsUpdate = true;

      const chovendo = racha.chovendo;
      this.chuva.visible = chovendo;
      this.chuvaForca = suave(this.chuvaForca || 0, chovendo ? 1 : 0, 1.5, dt);
      this.pistaMat.shininess = 12 + this.chuvaForca * 80;
      this.pistaMat.specular.setScalar(0.13 + this.chuvaForca * 0.35);
      this.scene.fog.color.setRGB(lerp(0.85, 0.42, this.chuvaForca), lerp(0.54, 0.45, this.chuvaForca), lerp(0.43, 0.55, this.chuvaForca));
      if (chovendo) {
        const p = this.chuva.geometry.attributes.position.array;
        this.gotas.forEach((g, i) => {
          g[1] -= 38 * dt;
          g[0] -= (this.vRolagem * 0.6 + 6) * dt;
          if (g[1] < 0) { g[1] += 30; g[0] = Math.random() * 90 - 45; }
          if (g[0] < -45) g[0] += 90;
          const x = cx + g[0], z = g[2];
          p.set([x, g[1], z, x + 0.5, g[1] + 1.6, z], i * 6);
        });
        this.chuva.geometry.attributes.position.needsUpdate = true;
      }
    },

    desenharCarros(racha, agora) {
      const m = this._m, m2 = this._m2, q = this._q, e = this._e, v3 = this._v, s3 = this._s;
      const cont = this.modelos.map(() => 0);
      let nRoda = 0, nPlaca = 0, nSombra = 0, nEscudo = 0;
      this.luzesCarro.limpar();
      const luz = this.luzesCarro;

      for (const [id, v] of this.vis) {
        const p = racha.pilotos.get(id);
        if (!p) continue;
        const mod = this.modelos[p.modelo];
        let y = 0, giro = 0, rolar = 0;
        if (v.giro) {
          const g = v.giro;
          const t = (this.tempo - g.inicio) / g.dur;
          if (t >= 1) v.giro = null;
          else if (t >= 0) {
            const suaveT = 1 - Math.pow(1 - t, 2.2);
            giro = suaveT * g.voltas * Math.PI * 2;
            y = g.pulo * Math.sin(Math.PI * Math.min(1, t * 1.25));
            rolar = g.pulo ? Math.sin(t * Math.PI * 2) * 0.35 : 0;
          }
        }
        const impulso = p.impulso && p.impulso.ate > agora ? p.impulso.mult : 1;
        const empina = impulso > 1.2 ? 0.035 * Math.min(1, impulso - 1) : 0;
        e.set(rolar, v.yaw + giro, empina, "YXZ");
        q.setFromEuler(e);
        m.compose(v3.set(v.x, y, v.z), q, s3.set(1, 1, 1));

        const k = cont[p.modelo]++;
        mod.mp.setMatrixAt(k, m);
        mod.md.setMatrixAt(k, m);
        const ehRei = racha.rei === id;
        this._c.set(ehRei ? Carros.OURO : Carros.PALETA[p.cor]);
        mod.mp.setColorAt(k, this._c);

        for (const [rx, ry, rz] of mod.rodas) {
          for (const lado of rz ? [1, -1] : [0]) {
            m2.makeRotationZ(-v.roda / mod.raio);
            m2.scale(s3.set(mod.raio, mod.raio, mod.larguraRoda));
            m2.setPosition(rx, ry, rz * lado);
            this.rodas.setMatrixAt(nRoda++, m2.premultiply(m));
          }
        }

        const [px, py, tam] = mod.placa;
        m2.makeScale(tam, tam, 1).setPosition(px, py, mod.meiaPlaca + 0.02);
        this.placas.setMatrixAt(nPlaca, m2.premultiply(m));
        const n = p.numero % (Texturas.NUMEROS_LADO * Texturas.NUMEROS_LADO);
        this.celulas.setXY(nPlaca, n % Texturas.NUMEROS_LADO, Math.floor(n / Texturas.NUMEROS_LADO));
        nPlaca++;

        q.setFromEuler(e.set(0, v.yaw + giro, 0));
        m2.compose(v3.set(v.x, 0.02, v.z), q, s3.set(mod.comprimento * 1.15, 1, mod.largura * 1.5 + y * 0.3));
        this.sombras.setMatrixAt(nSombra, m2);
        const fx = mod.comprimento / 2 + 2.6;
        m2.compose(v3.set(v.x + Math.cos(v.yaw + giro) * fx, 0.025, v.z - Math.sin(v.yaw + giro) * fx), q, s3.set(5.5, 1, mod.largura * 1.3));
        this.fachos.setMatrixAt(nSombra, m2);
        nSombra++;

        if (p.escudoAte > agora) {
          const r = mod.comprimento * 0.62;
          m2.compose(v3.set(v.x, 0.7 + y, v.z), q.identity(), s3.set(r, r * 0.55, r * 0.6));
          this.escudos.setMatrixAt(nEscudo++, m2);
        }

        for (const f of mod.farois) {
          v3.set(f[0], f[1], f[2]).applyMatrix4(m);
          luz.por(v3.x, v3.y, v3.z, 2.2, [1, 0.93, 0.78], 0.85);
        }
        for (const l of mod.lanternas) {
          v3.set(l[0], l[1], l[2]).applyMatrix4(m);
          const freio = p.lento && p.lento.ate > agora;
          luz.por(v3.x, v3.y, v3.z, freio ? 1.8 : 1.1, [1, 0.12, 0.08], freio ? 1 : 0.8);
        }

        this.emitirDoCarro(v, p, mod, m, impulso, agora, ehRei);
      }

      this.modelos.forEach((mod, i) => {
        mod.mp.count = mod.md.count = cont[i];
        mod.mp.instanceMatrix.needsUpdate = mod.md.instanceMatrix.needsUpdate = true;
        if (mod.mp.instanceColor) mod.mp.instanceColor.needsUpdate = true;
      });
      this.rodas.count = nRoda;
      this.placas.count = nPlaca;
      this.sombras.count = this.fachos.count = nSombra;
      this.escudos.count = nEscudo;
      this.celulas.needsUpdate = true;
      for (const x of [this.rodas, this.placas, this.sombras, this.fachos, this.escudos]) x.instanceMatrix.needsUpdate = true;
      this.escudos.material.uniforms.uTempo.value = this.tempo;
      luz.fechar();
    },

    emitirDoCarro(v, p, mod, m, impulso, agora, ehRei) {
      const v3 = this._v;
      const [ex, ey, ez] = mod.escape;
      if (impulso > 1.01 && this.vRolagem > 1) {
        const tipo = impulso >= 2 ? "maximo" : impulso >= 1.5 ? "nitro" : "turbo";
        const cor = COR_IMPULSO[tipo];
        const n = tipo === "turbo" ? 2 : 4;
        for (const lado of mod.rodas[0][2] && tipo !== "turbo" ? [ez, -ez] : [ez]) {
          v3.set(ex, ey + 0.05, lado).applyMatrix4(m);
          for (let i = 0; i < n; i++) {
            this.fogo.emitir({
              x: v3.x + Math.random() * 0.2, y: v3.y + (Math.random() - 0.5) * 0.1, z: v3.z + (Math.random() - 0.5) * 0.12,
              vx: this.vRolagem * 0.72 - 7 - Math.random() * 5, vy: (Math.random() - 0.5) * 0.6, vz: (Math.random() - 0.5) * 0.6,
              vida: 0.12 + Math.random() * 0.12, tam: tipo === "turbo" ? 1.0 : 2.0, tamFim: 0.35,
              cor: tipo === "turbo" ? [1, 0.9, 0.6] : [0.75, 0.9, 1], corFim: cor, alfa: 0.95,
            });
          }
        }
        if (tipo !== "turbo" && Math.random() < 0.5) {
          this.fogo.emitir({
            x: v.x - mod.comprimento * 0.5, y: 0.4 + Math.random() * 0.8, z: v.z + (Math.random() - 0.5) * mod.largura,
            vx: this.vRolagem * 0.2 - 12, vida: 0.25, tam: 0.35, tamFim: 0.1, cor, alfa: 0.7,
          });
        }
      }
      if (p.lento && p.lento.ate > agora && Math.random() < 0.8) {
        this.fumo.emitir({
          x: v.x + (Math.random() - 0.5) * mod.comprimento, y: 0.3, z: v.z + (Math.random() - 0.5) * mod.largura,
          vx: this.vRolagem * 0.7, vy: 1 + Math.random(), vida: 1.2, tam: 1.6, tamFim: 4.2,
          cor: [0.75, 0.74, 0.76], alfa: 0.5, arrasto: 1.2,
        });
      }
      if (ehRei && Math.random() < 0.35) {
        this.fogo.emitir({
          x: v.x + (Math.random() - 0.5) * mod.comprimento, y: 0.6 + Math.random() * mod.topo, z: v.z + (Math.random() - 0.5) * mod.largura,
          vx: this.vRolagem * 0.9, vy: 0.6, vida: 0.6, tam: 0.45, tamFim: 0.05, cor: [1, 0.85, 0.35], alfa: 0.9,
        });
      }
    },

    /* ───────────── efeitos ───────────── */

    atualizarEfeitos(dt, racha) {
      const m = this._m, q = this._q, e = this._e, v3 = this._v, s3 = this._s;
      this.misseis = this.misseis.filter(ms => {
        ms.t += dt;
        const alvo = this.vis.get(ms.alvo);
        const de = this.vis.get(ms.de);
        if (alvo) ms.fim = [alvo.x, 1, alvo.z];
        if (!ms.ini) ms.ini = de ? [de.x, 1.4, de.z] : [this.camX - this.larguraVisivel() * 0.6, 3, ms.fim ? ms.fim[2] : 0];
        const t = Math.min(1, ms.t / ms.dur);
        const f = ms.fim || ms.ini;
        const x = lerp(ms.ini[0], f[0], t), z = lerp(ms.ini[2], f[2], t);
        const y = lerp(ms.ini[1], f[1], t) + Math.sin(t * Math.PI) * 4;
        const antes = ms.pos || [x - 1, y, z];
        ms.pos = [x, y, z];
        const dx = x - antes[0], dy = y - antes[1], dz = z - antes[2];
        if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 1e-4) ms.ang = [Math.atan2(-dz, dx), Math.atan2(dy, Math.hypot(dx, dz))];
        ms.ang = ms.ang || [0, 0];
        for (let i = 0; i < 3; i++) {
          this.fumo.emitir({ x, y, z, vx: this.vRolagem * 0.9, vy: 0.4, vida: 0.9, tam: 0.9, tamFim: 2.6, cor: [0.85, 0.85, 0.88], alfa: 0.55, arrasto: 1.5 });
        }
        this.fogo.emitir({ x, y, z, vida: 0.15, tam: 1.4, tamFim: 0.4, cor: [1, 0.9, 0.6], corFim: [1, 0.4, 0.1] });
        if (t >= 1) {
          this.explosao(f[0], 1, f[2], 1.1);
          if (alvo && ms.atingiu) this.girar(alvo, { voltas: 1.5, pulo: 1.6, dur: 1.5 });
          return false;
        }
        return true;
      });
      this.malhaMissil.count = this.misseis.length;
      this.misseis.forEach((ms, i) => {
        q.setFromEuler(e.set(0, ms.ang[0], ms.ang[1], "YXZ"));
        m.compose(v3.set(...ms.pos), q, s3.set(1.3, 1.3, 1.3));
        this.malhaMissil.setMatrixAt(i, m);
      });
      this.malhaMissil.instanceMatrix.needsUpdate = true;

      this.bombas = this.bombas.filter(b => {
        b.t += dt;
        const t = Math.min(1, b.t / b.dur);
        b.pos = [b.x, lerp(28, 0.8, t * t), b.z];
        this.fogo.emitir({ x: b.x, y: b.pos[1] + 1, z: b.z, vida: 0.2, tam: 0.8, tamFim: 0.2, cor: [1, 0.9, 0.5], corFim: [1, 0.3, 0] });
        if (t >= 1) {
          this.explosao(b.x, 1, b.z, 2.2);
          this.ondas.push({ x: b.x, z: b.z, t: 0, dur: 0.9, r: 26 });
          for (const id of b.vitimas) {
            const v = this.vis.get(id);
            if (v) { this.girar(v, { voltas: 1, pulo: 2.4, dur: 1.6 }); this.explosao(v.x, 0.8, v.z, 0.8); }
          }
          this.tremor = Math.max(this.tremor, 1.6);
          return false;
        }
        return true;
      });
      this.malhaBomba.count = this.bombas.length;
      this.bombas.forEach((b, i) => {
        m.compose(v3.set(...b.pos), q.setFromEuler(e.set(b.t * 3, b.t * 2, 0)), s3.set(1.3, 1.3, 1.3));
        this.malhaBomba.setMatrixAt(i, m);
      });
      this.malhaBomba.instanceMatrix.needsUpdate = true;

      this.ondas = this.ondas.filter(o => (o.t += dt) < o.dur);
      this.malhaOnda.count = this.ondas.length;
      this.ondas.forEach((o, i) => {
        const r = 1 + o.r * (o.t / o.dur);
        m.compose(v3.set(o.x, 0.3, o.z), q.identity(), s3.set(r, 1, r));
        this.malhaOnda.setMatrixAt(i, m);
      });
      this.malhaOnda.material.opacity = this.ondas.length ? 0.85 * (1 - this.ondas[0].t / this.ondas[0].dur) : 0;
      this.malhaOnda.instanceMatrix.needsUpdate = true;

      this.pocas = this.pocas.filter(pc => {
        pc.x -= this.vRolagem * dt;
        pc.t += dt;
        const alvo = this.vis.get(pc.alvo);
        if (alvo && !pc.pegou && pc.x <= alvo.x + 1) {
          pc.pegou = true;
          this.girar(alvo, { voltas: 2, pulo: 0, dur: 1.5 });
        }
        return pc.x > this.camX - this.larguraVisivel() && pc.t < 8;
      });
      this.malhaPoca.count = this.pocas.length;
      this.pocas.forEach((pc, i) => {
        const r = Math.min(1, pc.t * 4);
        m.compose(v3.set(pc.x, 0.03, pc.z), q.identity(), s3.set(4.2 * r, 1, 3.2 * r));
        this.malhaPoca.setMatrixAt(i, m);
      });
      this.malhaPoca.instanceMatrix.needsUpdate = true;

      this.clarao.intensity = Math.max(0, this.clarao.intensity - dt * 160);
      this.fogo.passo(dt, 0);
      this.fumo.passo(dt, 0);
    },

    girar(v, g) { v.giro = { inicio: this.tempo, ...g }; },

    explosao(x, y, z, forca = 1) {
      for (let i = 0; i < 36 * forca; i++) {
        const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI * 0.5;
        const vel = (4 + Math.random() * 7) * forca;
        this.fogo.emitir({
          x, y, z, vx: Math.cos(a) * Math.cos(b) * vel + this.vRolagem * 0.6, vy: Math.sin(b) * vel, vz: Math.sin(a) * Math.cos(b) * vel,
          vida: 0.35 + Math.random() * 0.35, tam: (2 + Math.random() * 2) * forca, tamFim: 0.6,
          cor: [1, 0.95, 0.7], corFim: [1, 0.35, 0.05], arrasto: 3,
        });
      }
      for (let i = 0; i < 26 * forca; i++) {
        const a = Math.random() * Math.PI * 2;
        this.fogo.emitir({
          x, y, z, vx: Math.cos(a) * 14 + this.vRolagem * 0.6, vy: 4 + Math.random() * 10, vz: Math.sin(a) * 14,
          vida: 0.6 + Math.random() * 0.4, tam: 0.35, tamFim: 0.1, cor: [1, 0.85, 0.4], grav: 18, arrasto: 1,
        });
      }
      for (let i = 0; i < 18 * forca; i++) {
        const a = Math.random() * Math.PI * 2;
        this.fumo.emitir({
          x: x + Math.cos(a) * 1.5, y: y + Math.random(), z: z + Math.sin(a) * 1.5,
          vx: Math.cos(a) * 2 + this.vRolagem * 0.75, vy: 1.5 + Math.random() * 2, vz: Math.sin(a) * 2,
          vida: 1.6 + Math.random(), tam: 3 * forca, tamFim: 7 * forca, cor: [0.3, 0.28, 0.3], corFim: [0.55, 0.52, 0.55], alfa: 0.7, arrasto: 1.4,
        });
      }
      this.clarao.position.set(x, y + 2, z);
      this.clarao.intensity = 120 * forca;
      this.tremor = Math.max(this.tremor, 0.7 * forca);
    },

    estouro(v, cor, n = 24) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        this.fogo.emitir({
          x: v.x, y: 1, z: v.z, vx: Math.cos(a) * 6 + this.vRolagem * 0.5, vy: 2 + Math.random() * 5, vz: Math.sin(a) * 6,
          vida: 0.5 + Math.random() * 0.3, tam: 0.7, tamFim: 0.1, cor, arrasto: 2,
        });
      }
    },

    confete() {
      const cores = [[1, 0.8, 0.12], [1, 0.24, 0.5], [0.25, 0.88, 0.69], [0.4, 0.6, 1], [1, 1, 1]];
      for (let i = 0; i < 160; i++) {
        this.fumo.emitir({
          x: this.camX + (Math.random() - 0.5) * 30, y: 14 + Math.random() * 10, z: (Math.random() - 0.5) * 22,
          vx: (Math.random() - 0.5) * 3, vy: -2 - Math.random() * 2, vz: (Math.random() - 0.5) * 3,
          vida: 3 + Math.random() * 2, tam: 0.5, tamFim: 0.4, cor: cores[i % cores.length], alfa: 1, arrasto: 0.4,
        });
      }
    },

    /* O que a regra decidiu, animado na pista. */
    aoAcontecer(a, racha) {
      const v = id => this.vis.get(id);
      switch (a.tipo) {
        case "presente": {
          const alvo = a.alvo && v(a.alvo.id);
          if (alvo && a.efeito) {
            const cor = a.efeito === "turbo" ? COR_IMPULSO.turbo : a.efeito === "escudo" ? [0.4, 0.9, 1] : COR_IMPULSO.nitro;
            this.estouro(alvo, cor, 10 + a.faixa * 8);
          }
          if (a.faixa >= 2 && a.alvo) this.foco = { id: a.alvo.id, ate: this.agora + 2500 };
          if (a.efeito === "nitro" || a.faixa >= 2) this.tremor = Math.max(this.tremor, 0.25 + a.faixa * 0.1);
          break;
        }
        case "atingido":
        case "bloqueou": {
          const alvo = v(a.alvo.id);
          if (a.efeito === "oleo") {
            if (alvo) this.pocas.push({ x: alvo.x + 7, z: alvo.z, alvo: a.alvo.id, t: 0, pegou: a.tipo === "bloqueou" });
          } else if (a.efeito === "missil") {
            this.misseis.push({ de: a.por && a.por.id, alvo: a.alvo.id, t: 0, dur: 0.95, atingiu: a.tipo === "atingido" });
          } else if (a.efeito === "bomba") {
            let b = this.bombas.find(x => x.por === (a.por && a.por.id) && x.t === 0);
            if (!b) {
              b = { por: a.por && a.por.id, x: alvo ? alvo.x : this.camX, z: 0, t: 0, dur: 0.75, vitimas: [] };
              this.bombas.push(b);
            }
            if (a.tipo === "atingido") b.vitimas.push(a.alvo.id);
          }
          break;
        }
        case "buzina": {
          const c = v(a.piloto.id);
          if (c) this.estouro(c, [1, 0.95, 0.6], 6);
          break;
        }
        case "vai":
          for (const c of this.vis.values()) {
            for (let i = 0; i < 6; i++) {
              this.fumo.emitir({ x: c.x - 1.5, y: 0.3, z: c.z + (Math.random() - 0.5) * 1.6, vx: -2, vy: 0.8, vida: 1.4, tam: 1.4, tamFim: 4, cor: [0.8, 0.8, 0.82], alfa: 0.45, arrasto: 1 });
            }
          }
          break;
        case "chegou":
          if (a.posicao === 1) { const c = v(a.piloto.id); if (c) this.estouro(c, [1, 0.85, 0.3], 60); }
          break;
        case "podio":
          this.confete();
          break;
      }
    },

    /* ───────────── etiquetas ───────────── */

    telaDe(x, y, z) {
      const p = this._v.set(x, y, z).project(this.camera);
      return { x: (p.x + 1) / 2 * this.L.W, y: (1 - p.y) / 2 * this.L.H, dentro: p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1 };
    },

    telaDoCarro(id) {
      const v = this.vis.get(id);
      if (!v) return null;
      const t = this.telaDe(v.x, 2.4, v.z);
      return t.dentro ? t : null;
    },

    atualizarEtiquetas(lista, racha, agora) {
      const vivos = new Set();
      for (const [id, v] of this.vis) {
        const p = racha.pilotos.get(id);
        if (!p) continue;
        const mod = this.modelos[p.modelo];
        let et = this.etiquetas.get(id);
        if (!et) {
          et = document.createElement("div");
          et.className = "etiqueta";
          et.innerHTML = '<span class="coroa"></span><span class="pos"></span><span class="nome"></span>';
          this.camadaEtiquetas.appendChild(et);
          et._pos = et.children[1];
          et._nome = et.children[2];
          this.etiquetas.set(id, et);
        }
        vivos.add(id);
        const pos = racha.posicao(p);
        const texto = pos ? `${pos}º` : "";
        if (et._pos.textContent !== texto) et._pos.textContent = texto;
        if (et._nome.textContent !== p.nome) et._nome.textContent = p.nome;
        const classes = `etiqueta${pos === 1 && racha.fase !== "espera" ? " lider" : ""}${racha.rei === id ? " rei" : ""}${p.escudoAte > agora ? " escudo" : ""}${pos > 0 && pos <= 3 ? ` p${pos}` : ""}`;
        if (et.className !== classes) et.className = classes;
        const t = this.telaDe(v.x, (v.giro ? 0.8 : 0) + mod.topo + 0.55, v.z);
        if (!t.dentro || v.saindo) { et.style.display = "none"; continue; }
        et.style.display = "";
        et.style.transform = `translate(${t.x.toFixed(1)}px,${t.y.toFixed(1)}px)`;
        et.style.zIndex = String(Math.round(100 + v.z * 4));
      }
      for (const [id, et] of this.etiquetas) {
        if (!vivos.has(id)) { et.remove(); this.etiquetas.delete(id); }
      }
    },

    zerar() {
      this.vis.clear();
      this.ordemVis = [];
      this.misseis = [];
      this.bombas = [];
      this.pocas = [];
    },

    info() {
      const r = this.renderer.info.render;
      return { chamadas: r.calls, triangulos: r.triangles, carros: this.vis.size };
    },
  };

  return Cena;
})();
