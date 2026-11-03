/* O estádio em 3D (three.js): anel de arquibancada em volta do gramado, um
   setor por time, refletores, telões, a multidão instanciada e os efeitos
   de presente, mais a câmera e o que aparece por cima em DOM (os @, o
   cartão do presente e o nome dos setores no plano geral).

   O estado vem do Estadio (regras.js): a cena lê a lotação e o agito de
   cada setor e anima o resto. Quem tem @ senta na frente e no meio do
   setor; o torcedor genérico (sem @, não conta) senta no fundo e sai
   quando falta lugar. O anel é uma superelipse (retângulo de canto
   redondo): os setores têm o mesmo comprimento de arco na fila do meio. */
"use strict";

const Cena = (() => {
  const LEVE = new URLSearchParams(location.search).get("leve") === "1";
  const A0 = 17, B0 = 24, EXPOENTE = 4;
  const FILAS = 6, PROF = 1.5, DEGRAU = 0.8, Y0 = 1.7;
  const CORREDOR = 1.4, LARG_ASSENTO = 0.95;
  const FUNDO = FILAS * PROF;
  const TOPO = Y0 + (FILAS - 1) * DEGRAU;
  const MURETA = Y0 + 0.45;
  const PISTA = -4.6;
  const CAMPO = 22;
  const TUNEL = Math.PI / 2;
  const MAX_TORCEDORES = LEVE ? 640 : 1200;

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const suave = (atual, alvo, taxa, dt) => atual + (alvo - atual) * (1 - Math.exp(-taxa * dt));
  const curva = t => t * t * (3 - 2 * t);
  const sorte = (a, b) => a + Math.random() * (b - a);
  const angulo = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();

  /* ───────────── forma do anel ───────────── */

  function raio(th, o) {
    const a = A0 + o, b = B0 + o;
    return Math.pow(Math.pow(Math.abs(Math.cos(th) / a), EXPOENTE) + Math.pow(Math.abs(Math.sin(th) / b), EXPOENTE), -1 / EXPOENTE);
  }

  function ponto(th, o, y = 0, alvo = new THREE.Vector3()) {
    const r = raio(th, o);
    return alvo.set(Math.cos(th) * r, y, Math.sin(th) * r);
  }

  /* Normal pra dentro do anel (pro gramado). */
  function normal(th, o, alvo = new THREE.Vector3()) {
    const a = ponto(th - 0.002, o, 0, v1), b = ponto(th + 0.002, o, 0, v2);
    alvo.set(b.z - a.z, 0, -(b.x - a.x)).normalize();
    if (alvo.dot(ponto(th, o, 0, v3)) > 0) alvo.negate();
    return alvo;
  }

  /* Comprimento de arco na fila do meio: setores do mesmo tamanho. */
  function tabelaArco(o) {
    const N = 2048, ths = new Float32Array(N + 1), s = new Float32Array(N + 1);
    let antes = ponto(-Math.PI / 2, o, 0, new THREE.Vector3()).clone();
    for (let i = 0; i <= N; i++) {
      const th = -Math.PI / 2 + (i / N) * Math.PI * 2;
      const p = ponto(th, o, 0, v1);
      s[i] = i ? s[i - 1] + p.distanceTo(antes) : 0;
      ths[i] = th;
      antes.copy(p);
    }
    const total = s[N];
    const theta = arco => {
      let x = ((arco % total) + total) % total;
      let lo = 0, hi = N;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (s[m] <= x) lo = m; else hi = m; }
      return ths[lo] + ((x - s[lo]) / (s[hi] - s[lo] || 1)) * (ths[hi] - ths[lo]);
    };
    return { total, theta };
  }

  const altura = fila => Y0 + fila * DEGRAU;

  /* ───────────── partículas ───────────── */

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

  /* ───────────── céu ───────────── */

  function ceu() {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTopo: { value: new THREE.Color("#050816") },
        uMeio: { value: new THREE.Color("#141a44") },
        uHorizonte: { value: new THREE.Color("#4a2a5e") },
        uLuz: { value: 1 },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 uTopo; uniform vec3 uMeio; uniform vec3 uHorizonte; uniform float uLuz;
        varying vec3 vDir;
        void main() {
          float h = max(vDir.y, 0.0);
          vec3 c = mix(uHorizonte, uMeio, smoothstep(0.0, 0.22, h));
          c = mix(c, uTopo, smoothstep(0.2, 0.75, h));
          gl_FragColor = vec4(c * uLuz, 1.0);
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

  /* ───────────── malhas do anel ───────────── */

  /* Faixa entre duas curvas do anel, de `th0` a `th1`. Cada ponta é
     [deslocamento, altura]. A u corre com o ângulo (da esquerda pra direita
     de quem olha do gramado) e a v de baixo pra cima. */
  function faixaAnel(th0, th1, [oa, ya], [ob, yb], segs, cor = null, repetir = 0) {
    const pos = [], uv = [], cores = [], idx = [];
    const c = cor ? new THREE.Color(cor) : null;
    let arco = 0, antes = null;
    for (let i = 0; i <= segs; i++) {
      const th = lerp(th0, th1, i / segs);
      const pa = ponto(th, oa, ya, new THREE.Vector3()), pb = ponto(th, ob, yb, new THREE.Vector3());
      if (antes) arco += pa.distanceTo(antes);
      antes = pa;
      pos.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
      const u = repetir ? arco / repetir : i / segs;
      uv.push(u, 0, u, 1);
      if (c) cores.push(c.r, c.g, c.b, c.r, c.g, c.b);
      if (i) {
        const k = i * 2;
        idx.push(k - 2, k - 1, k, k - 1, k + 1, k);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    if (c) g.setAttribute("color", new THREE.Float32BufferAttribute(cores, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  function juntarGeo(lista) {
    let total = 0;
    for (const g of lista) total += g.attributes.position.count;
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), cor = new Float32Array(total * 3), uv = new Float32Array(total * 2);
    const idx = [];
    let k = 0;
    for (const g of lista) {
      const n = g.attributes.position.count;
      pos.set(g.attributes.position.array, k * 3);
      nor.set(g.attributes.normal.array, k * 3);
      if (g.attributes.color) cor.set(g.attributes.color.array, k * 3);
      uv.set(g.attributes.uv.array, k * 2);
      for (const i of g.index.array) idx.push(i + k);
      k += n;
      g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(cor, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    return geo;
  }

  /* Ponto por cima da arquibancada do setor (bandeirão e mosaico): u ao
     longo do setor, v da frente (0) pro fundo (1), `acima` m por cima dos
     degraus. */
  function sobreSetor(s, u, v, acima, folga, alvo) {
    const th = lerp(s.th0 + folga, s.th1 - folga, u);
    const o = lerp(-0.2, FUNDO - 0.3, v);
    return ponto(th, o, Y0 + (o / PROF) * DEGRAU + acima - 0.3, alvo);
  }

  function superficie(s, nu, nv, acima, folga) {
    const g = new THREE.PlaneGeometry(1, 1, nu, nv);
    const P = g.attributes.position, U = g.attributes.uv;
    for (let i = 0; i < P.count; i++) {
      const p = sobreSetor(s, U.getX(i), U.getY(i), acima, folga, v1);
      P.setXYZ(i, p.x, p.y, p.z);
    }
    g.computeVertexNormals();
    return g;
  }

  /* ───────────── telão ───────────── */

  function telao() {
    const [c, g] = (() => { const x = document.createElement("canvas"); x.width = 640; x.height = 360; return [x, x.getContext("2d")]; })();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return { c, g, tex, chave: "" };
  }

  return {
    LEVE,
    t: 0,
    apagao: 0,
    apagaoAlvo: 0,
    flash: 0,
    tremor: 0,

    montar(canvas, palco, cfg, aoMomento) {
      this.cfg = cfg;
      this.aoMomento = aoMomento || (() => {});
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !LEVE, powerPreference: "high-performance" });
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.05;
      this.scene = new THREE.Scene();
      this.scene.fog = new THREE.Fog(0x0b0f26, 140, 420);
      this.camera = new THREE.PerspectiveCamera(46, 9 / 16, 0.3, 1400);

      this.times = cfg.times;
      this.indice = new Map(cfg.times.map((t, i) => [t.id, i]));
      this.U = {
        uT: { value: 0 },
        uAgito: { value: new Array(12).fill(0) },
        uOla: { value: new Array(12).fill(0) },
        uOlaG: { value: new THREE.Vector2(0, 0) },
      };
      this.tex = { brilho: Texturas.brilho(), fumaca: Texturas.fumaca(), papel: Texturas.papel() };

      this.montarLuz();
      this.montarSetores();
      this.montarArquibancada();
      this.montarEntorno();
      this.montarTorcida();
      this.montarEfeitos();
      this.montarTela(palco);
      this.cam = { pos: new THREE.Vector3(0, 80, -90), olhar: new THREE.Vector3(0, 0, 0), fov: 46, corte: true };
      this.az = -Math.PI / 2;
      this.lado = 1;
      this.agenda = [];
      this.foco = null;
      this.focoLivre = 0;
      this.ultimoClose = -99;
      this.passeio = null;
      this.proximaVisita = 10;
      this.visitados = 0;
      this.proximoPasseio = 14;
      this.genericoEm = 2;
      this.ultimaEntrada = -99;
      this.lendas = [];
      this.efeitos = [];
    },

    montarLuz() {
      const s = this.scene;
      this.ceuLuz = new THREE.HemisphereLight(0x9fb0ff, 0x2a2238, 1.25);
      s.add(this.ceuLuz);
      this.luzA = new THREE.DirectionalLight(0xfff1dc, 2.1);
      this.luzA.position.set(24, 50, -20);
      this.luzB = new THREE.DirectionalLight(0xc8d6ff, 1.1);
      this.luzB.position.set(-26, 34, 30);
      s.add(this.luzA, this.luzB);
      this.forca = { ceu: this.ceuLuz.intensity, a: this.luzA.intensity, b: this.luzB.intensity };

      /* Holofote do show lendário e luzes dos sinalizadores: sempre na cena
         (intensidade 0) pra não recompilar o shader no meio da live. */
      this.holofote = new THREE.SpotLight(0xfff6e0, 0, 0, 0.32, 0.5, 0);
      this.holofote.position.set(0, 60, 0);
      s.add(this.holofote, this.holofote.target);
      this.chamas = [0, 1, 2].map(() => {
        const l = new THREE.PointLight(0xff3a20, 0, 16, 0);
        s.add(l);
        return { luz: l, ate: 0, cor: new THREE.Color() };
      });
    },

    /* ───────────── setores e assentos ───────────── */

    montarSetores() {
      const meio = (FILAS / 2) * PROF;
      const arco = tabelaArco(meio);
      this.arco = arco;
      const porSetor = arco.total / 12;
      const colunas = Math.floor((porSetor - CORREDOR) / LARG_ASSENTO);
      const larg = (porSetor - CORREDOR) / colunas;
      this.setores = this.times.map((time, i) => {
        const centro = i * porSetor;
        const s = {
          i, time,
          thc: arco.theta(centro),
          th0: arco.theta(centro - porSetor / 2 + CORREDOR / 2),
          th1: arco.theta(centro + porSetor / 2 - CORREDOR / 2),
          cor: new THREE.Color(time.cor), cor2: new THREE.Color(time.cor2),
          padrao: Personagens.PADRAO[time.padrao] ?? 0,
          assentos: [], torcedores: new Set(), genericos: 0, agito: 0, ola: 0,
          presidente: null,
        };
        if (s.th1 < s.th0) s.th1 += Math.PI * 2;
        for (let fila = 0; fila < FILAS; fila++) {
          for (let col = 0; col < colunas; col++) {
            const th = arco.theta(centro - (colunas * larg) / 2 + (col + 0.5) * larg);
            const o = fila * PROF + 0.95;
            const n = normal(th, o, new THREE.Vector3());
            s.assentos.push({
              fila, col, th, o,
              pos: ponto(th, o, altura(fila), new THREE.Vector3()),
              giro: Math.atan2(n.x, n.z),
              prioridade: fila * 3 + Math.abs(col - (colunas - 1) / 2) * 0.62 + Math.random() * 0.2,
              ocupante: null,
            });
          }
        }
        s.ordem = [...s.assentos].sort((a, b) => a.prioridade - b.prioridade);
        s.frente = ponto(s.thc, -0.6, 0, new THREE.Vector3());
        s.meio = ponto(s.thc, FUNDO / 2, altura(FILAS / 2) + 1, new THREE.Vector3());
        s.topo = ponto(s.thc, FUNDO + 0.3, TOPO + 3.4, new THREE.Vector3());
        s.dentro = normal(s.thc, FUNDO / 2, new THREE.Vector3());
        return s;
      });
      this.colunas = colunas;
    },

    montarArquibancada() {
      const s = this.scene;
      const SEG = LEVE ? 240 : 360;
      const T0 = -Math.PI / 2 - 0.0001, T1 = T0 + Math.PI * 2 + 0.0002;
      const partes = [];
      partes.push(faixaAnel(T0, T1, [-0.05, 0], [-0.05, MURETA], SEG, "#3b3f52"));
      partes.push(faixaAnel(T0, T1, [-0.35, MURETA], [0.05, MURETA], SEG, "#8a8fa6"));
      for (let f = 0; f < FILAS; f++) {
        const h = altura(f);
        partes.push(faixaAnel(T0, T1, [f * PROF, h], [(f + 1) * PROF, h], SEG, f % 2 ? "#5a5f76" : "#62677e"));
        partes.push(faixaAnel(T0, T1, [(f + 1) * PROF, h], [(f + 1) * PROF, h + DEGRAU], SEG, "#3d4155"));
      }
      partes.push(faixaAnel(T0, T1, [FUNDO, TOPO + DEGRAU], [FUNDO, TOPO + 3.2], SEG, "#2c3042"));
      partes.push(faixaAnel(T0, T1, [FUNDO, TOPO + 3.2], [FUNDO + 0.7, TOPO + 3.2], SEG, "#9ba0b8"));
      const concreto = new THREE.Mesh(juntarGeo(partes), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
      s.add(concreto);

      const fachada = Texturas.fachada();
      fachada.repeat.set(1, 1);
      const fora = new THREE.Mesh(faixaAnel(T0, T1, [FUNDO + 0.7, -0.5], [FUNDO + 0.7, TOPO + 3.2], SEG, null, 6),
        new THREE.MeshLambertMaterial({ map: fachada, side: THREE.DoubleSide }));
      s.add(fora);

      /* Por setor: as faixas com o nome (frente e fundo), a fita de LED no
         alto e os assentos na cor do time. */
      const assento = new THREE.BoxGeometry(LARG_ASSENTO * 0.78, 0.1, 0.46);
      assento.translate(0, 0.42, 0.02);
      const encosto = new THREE.BoxGeometry(LARG_ASSENTO * 0.78, 0.48, 0.08);
      encosto.translate(0, 0.66, -0.24);
      const geoAssento = (() => {
        const a = assento.toNonIndexed(), b = encosto.toNonIndexed();
        const g = new THREE.BufferGeometry();
        for (const nome of ["position", "normal"]) {
          const x = new Float32Array(a.attributes[nome].array.length + b.attributes[nome].array.length);
          x.set(a.attributes[nome].array);
          x.set(b.attributes[nome].array, a.attributes[nome].array.length);
          g.setAttribute(nome, new THREE.BufferAttribute(x, 3));
        }
        return g;
      })();
      const total = this.setores.reduce((n, x) => n + x.assentos.length, 0);
      const cadeiras = new THREE.InstancedMesh(geoAssento, new THREE.MeshLambertMaterial({ color: 0xffffff }), total);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), um = new THREE.Vector3(1, 1, 1), e = new THREE.Euler();
      const escuro = new THREE.Color("#262a3a"), cor = new THREE.Color();
      let k = 0;
      for (const st of this.setores) {
        const time = st.time;
        const branco = Texturas.claro(time.cor);
        for (const a of st.assentos) {
          e.set(0, a.giro, 0);
          q.setFromEuler(e);
          m4.compose(a.pos, q, um);
          cadeiras.setMatrixAt(k, m4);
          const base = branco ? (a.fila % 2 ? st.cor2 : st.cor) : (a.fila % 3 === 2 ? st.cor2 : st.cor);
          cor.copy(base).lerp(escuro, branco ? 0.45 : 0.3);
          cadeiras.setColorAt(k, cor);
          k++;
        }
        const frente = new THREE.Mesh(faixaAnel(st.th0, st.th1, [-0.1, 0.35], [-0.1, MURETA - 0.12], 24),
          new THREE.MeshLambertMaterial({ map: Texturas.faixaFrente(time), side: THREE.DoubleSide, emissive: 0xffffff, emissiveIntensity: 0.12 }));
        frente.material.emissiveMap = frente.material.map;
        s.add(frente);
        const fundo = new THREE.Mesh(faixaAnel(st.th0, st.th1, [FUNDO - 0.06, TOPO + DEGRAU + 0.35], [FUNDO - 0.06, TOPO + 3.0], 24),
          new THREE.MeshLambertMaterial({ map: Texturas.faixaTopo(time), side: THREE.DoubleSide, emissive: 0xffffff, emissiveIntensity: 0.2 }));
        fundo.material.emissiveMap = fundo.material.map;
        s.add(fundo);
        st.fita = new THREE.Mesh(faixaAnel(st.th0, st.th1, [FUNDO + 0.05, TOPO + 3.2], [FUNDO + 0.05, TOPO + 3.5], 16),
          new THREE.MeshBasicMaterial({ color: st.cor.clone().lerp(new THREE.Color(1, 1, 1), 0.15), side: THREE.DoubleSide, toneMapped: false }));
        s.add(st.fita);
        const pedestal = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.05, 1.3), new THREE.MeshLambertMaterial({ color: time.cor }));
        const pe = ponto(st.thc, -1.15, 0.52, new THREE.Vector3());
        pedestal.position.copy(pe);
        pedestal.rotation.y = Math.atan2(st.dentro.x, st.dentro.z);
        pedestal.visible = false;
        s.add(pedestal);
        st.pedestal = pedestal;
      }
      cadeiras.instanceMatrix.needsUpdate = true;
      cadeiras.instanceColor.needsUpdate = true;
      s.add(cadeiras);

      const led = Texturas.led();
      led.repeat.set(18, 1);
      this.led = led;
      this.placasLed = new THREE.Mesh(faixaAnel(T0, T1, [-2.4, 0], [-2.4, 0.85], SEG, null, 0),
        new THREE.MeshBasicMaterial({ map: led, side: THREE.DoubleSide, toneMapped: false }));
      s.add(this.placasLed);
    },

    montarEntorno() {
      const s = this.scene;
      this.ceu = ceu();
      s.add(this.ceu);
      const chao = new THREE.Mesh(new THREE.CircleGeometry(420, 48), new THREE.MeshLambertMaterial({ color: 0x141a26 }));
      chao.rotation.x = -Math.PI / 2;
      chao.position.y = -0.6;
      s.add(chao);
      const pista = new THREE.Mesh(new THREE.PlaneGeometry(2 * A0 + 2, 2 * B0 + 2), new THREE.MeshLambertMaterial({ color: 0x24573a }));
      pista.rotation.x = -Math.PI / 2;
      pista.position.y = -0.02;
      s.add(pista);
      const gram = new THREE.Mesh(new THREE.PlaneGeometry(CAMPO + 6, CAMPO * 1.55 + 6),
        new THREE.MeshLambertMaterial({ map: Texturas.gramado(CAMPO + 6, CAMPO * 1.55 + 6, CAMPO) }));
      gram.rotation.x = -Math.PI / 2;
      s.add(gram);

      const trave = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.25 });
      const rede = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false });
      const larg = 5.5 * CAMPO / 34, alto = 1.9;
      for (const lado of [-1, 1]) {
        const z = lado * CAMPO * 1.55 / 2;
        const g = new THREE.Group();
        for (const x of [-larg / 2, larg / 2]) {
          const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, alto, 8), trave);
          poste.position.set(x, alto / 2, 0);
          g.add(poste);
        }
        const barra = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, larg, 8), trave);
        barra.rotation.z = Math.PI / 2;
        barra.position.y = alto;
        g.add(barra);
        const fundo = new THREE.Mesh(new THREE.PlaneGeometry(larg, alto), rede);
        fundo.position.set(0, alto / 2, lado * 1.1);
        g.add(fundo);
        g.position.z = z;
        s.add(g);
      }

      /* Torres de refletor nos quatro cantos, com o brilho e o facho. */
      this.brilhos = [];
      const poste = new THREE.MeshLambertMaterial({ color: 0x5a6078 });
      const painel = new THREE.MeshBasicMaterial({ color: 0xfff6dc, toneMapped: false });
      for (const th of [0.32, -0.32, Math.PI - 0.32, Math.PI + 0.32]) {
        const base = ponto(th, FUNDO + 5, 0, new THREE.Vector3());
        const h = 30;
        const torre = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, h, 8), poste);
        torre.position.set(base.x, h / 2, base.z);
        s.add(torre);
        const cab = new THREE.Group();
        cab.position.set(base.x, h + 1.5, base.z);
        cab.lookAt(0, 0, 0);
        const caixa = new THREE.Mesh(new THREE.BoxGeometry(7, 3.6, 0.3), poste);
        cab.add(caixa);
        for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
          const l = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.3), painel);
          l.position.set(-2.55 + i * 1.7, -0.8 + j * 1.6, 0.32);
          cab.add(l);
        }
        s.add(cab);
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.brilho, color: 0xfff0c8, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
        glow.scale.set(24, 24, 1);
        glow.position.copy(cab.position).addScaledVector(v1.copy(cab.position).negate().normalize(), 1);
        s.add(glow);
        this.brilhos.push(glow);
        if (!LEVE) {
          const dist = cab.position.length();
          const cone = new THREE.Mesh(new THREE.ConeGeometry(14, dist * 0.9, 24, 1, true),
            new THREE.MeshBasicMaterial({ color: 0xfff2d0, transparent: true, opacity: 0.045, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
          cone.geometry.translate(0, -dist * 0.45, 0);
          cone.geometry.rotateX(-Math.PI / 2);
          cone.position.copy(cab.position);
          cone.lookAt(v1.set(0, 0, 0));
          s.add(cone);
          this.brilhos.push(cone);
        }
      }
      for (const b of this.brilhos) b.userData.base = b.material.opacity;

      /* Telões nos dois fundos, em cima da arquibancada. */
      this.telao = telao();
      this.telaoMat = new THREE.MeshBasicMaterial({ map: this.telao.tex, toneMapped: false });
      const moldura = new THREE.MeshLambertMaterial({ color: 0x1a1d28 });
      this.teloes = [];
      for (const th of [-Math.PI / 2, Math.PI / 2]) {
        const p = ponto(th, FUNDO + 1.4, TOPO + 9.2, new THREE.Vector3());
        const g = new THREE.Group();
        this.teloes.push(g);
        g.position.copy(p);
        g.lookAt(0, TOPO + 4, 0);
        const quadro = new THREE.Mesh(new THREE.BoxGeometry(16.4, 9.6, 0.6), moldura);
        quadro.position.z = -0.35;
        g.add(quadro);
        g.add(new THREE.Mesh(new THREE.PlaneGeometry(15.6, 8.8), this.telaoMat));
        for (const x of [-6, 6]) {
          const pe = new THREE.Mesh(new THREE.BoxGeometry(0.6, 9, 0.6), moldura);
          pe.position.set(x, -9, -0.4);
          g.add(pe);
        }
        s.add(g);
      }

      /* Cidade de noite em volta e estrelas. */
      const janelas = Texturas.janelas();
      const rnd = Texturas.sorteio(11);
      const predio = new THREE.BoxGeometry(1, 1, 1);
      const quantos = LEVE ? 40 : 80;
      const mats = this.predios = [0, 1, 2].map(i => {
        const t = janelas.clone();
        t.needsUpdate = true;
        t.repeat.set(1 + i, 2 + i);
        return new THREE.MeshBasicMaterial({ map: t, color: 0x9aa0c0 });
      });
      for (let i = 0; i < quantos; i++) {
        const a = (i / quantos) * Math.PI * 2 + rnd() * 0.05;
        const r = 120 + rnd() * 90;
        const h = 10 + rnd() * 38 * (rnd() < 0.2 ? 2 : 1);
        const m = new THREE.Mesh(predio, mats[i % 3]);
        m.scale.set(8 + rnd() * 14, h, 8 + rnd() * 12);
        m.position.set(Math.cos(a) * r, h / 2 - 0.6, Math.sin(a) * r);
        m.rotation.y = -a;
        s.add(m);
      }
      const n = LEVE ? 300 : 700;
      const est = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2, y = 0.15 + rnd() * 0.85;
        const r = Math.sqrt(1 - y * y);
        est.set([Math.cos(a) * r * 560, y * 560, Math.sin(a) * r * 560], i * 3);
      }
      const ge = new THREE.BufferGeometry();
      ge.setAttribute("position", new THREE.BufferAttribute(est, 3));
      this.estrelas = new THREE.Points(ge, new THREE.PointsMaterial({ color: 0xcfd8ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 }));
      s.add(this.estrelas);
    },

    /* ───────────── torcida ───────────── */

    montarTorcida() {
      this.matTorcedor = Personagens.material(this.U);
      this.multidao = new Personagens.Multidao(MAX_TORCEDORES, Personagens.malhaTorcedor({ leve: LEVE }), this.matTorcedor);
      this.scene.add(this.multidao.mesh);
      this.chefes = new Personagens.Multidao(12, Personagens.malhaTorcedor({ leve: LEVE, coroa: true }), this.matTorcedor);
      this.scene.add(this.chefes.mesh);
      this.pessoas = new Map();
      this.andando = new Set();
      this.rnd = Math.random;
    },

    visual(st, generico) {
      const v = Personagens.sortearVisual(this.rnd);
      return {
        cor1: st.cor.clone(), cor2: st.cor2.clone(), padrao: generico && Math.random() < 0.35 ? 0 : st.padrao,
        ...v, setor: st.i, fase: Math.random(),
      };
    },

    /* Primeiro lugar livre pela ordem (o real da frente pro fundo, o
       genérico do fundo pra frente). Sem lugar, o real tira um genérico. */
    lugar(st, generico) {
      const lista = generico ? [...st.ordem].reverse() : st.ordem;
      let a = lista.find(x => !x.ocupante);
      if (a || generico) return a || null;
      a = [...st.ordem].reverse().find(x => x.ocupante && x.ocupante.generico && !x.ocupante.saindo);
      if (a) {
        this.sair(a.ocupante, true);
        return a;
      }
      return null;
    },

    sentar(st, { pessoa = null, nome = "", generico = false, extra = false, chegada = "aparece", de = null }) {
      const a = this.lugar(st, generico);
      if (!a || this.multidao.cheio()) return null;
      const um = this.multidao.por({
        ...this.visual(st, generico), coluna: a.th,
        pos: a.pos.clone(), giro: a.giro, escala: 1,
        chegou: chegada === "aparece" ? this.t : -100,
        modo: chegada === "aparece" ? 0 : 1,
      });
      if (!um) return null;
      Object.assign(um, { st, assento: a, pessoa, nome, generico, extra });
      a.ocupante = um;
      st.torcedores.add(um);
      if (generico) st.genericos++;
      if (pessoa) this.pessoas.set(pessoa, um);
      if (chegada === "desce") this.caminhar(um, this.caminhoDescida(a), 0);
      else if (chegada === "pula") this.caminhar(um, this.caminhoPulo(a, de), 0);
      return um;
    },

    /* Do alto do setor, degrau por degrau até a fila do lugar. */
    caminhoDescida(a) {
      const pts = [ponto(a.th, FUNDO + 0.6, TOPO + DEGRAU, new THREE.Vector3())];
      for (let f = FILAS - 1; f >= a.fila; f--) pts.push(ponto(a.th, f * PROF + 0.95, altura(f), new THREE.Vector3()));
      return pts;
    },

    /* Da porta do ônibus: salta a placa e a mureta e sobe até o lugar. */
    caminhoPulo(a, de) {
      const pts = [de.clone(), ponto(a.th, -1.4, 0, new THREE.Vector3())];
      pts.push(ponto(a.th, 0.9, altura(0), new THREE.Vector3()));
      for (let f = 1; f <= a.fila; f++) pts.push(ponto(a.th, f * PROF + 0.95, altura(f), new THREE.Vector3()));
      return pts;
    },

    caminhar(um, pts, espera, aoFim = null) {
      um.caminho = { pts, i: 0, t: -espera, aoFim };
      um.pos.copy(pts[0]);
      this.multidao.colocar(um);
      this.multidao.tempo(um, "modo", 1);
      this.andando.add(um);
    },

    /* Sai andando pro alto do setor; `rapido` = genérico abrindo lugar. */
    sair(um, rapido = false) {
      if (um.saindo) return;
      um.saindo = true;
      const a = um.assento;
      if (a && a.ocupante === um) a.ocupante = null;
      um.st.torcedores.delete(um);
      if (um.generico) um.st.genericos--;
      if (um.pessoa && this.pessoas.get(um.pessoa) === um) this.pessoas.delete(um.pessoa);
      const pts = [um.pos.clone()];
      for (let f = (a ? a.fila : FILAS - 1) + 1; f < FILAS; f++) pts.push(ponto(um.assento.th, f * PROF + 0.95, altura(f), new THREE.Vector3()));
      pts.push(ponto(um.assento.th, FUNDO + 1.2, TOPO + DEGRAU, new THREE.Vector3()));
      this.caminhar(um, pts, rapido ? 0 : Math.random() * 2.5, () => this.multidao.tirar(um));
      um.caminho.velocidade = rapido ? 5 : 2.6 + Math.random();
    },

    andar(dt) {
      for (const um of this.andando) {
        const c = um.caminho;
        c.t += dt * (c.velocidade || 3.2);
        if (c.t < 0) continue;
        while (c.i < c.pts.length - 1 && c.t >= c.pts[c.i].distanceTo(c.pts[c.i + 1])) {
          c.t -= c.pts[c.i].distanceTo(c.pts[c.i + 1]);
          c.i++;
        }
        if (c.i >= c.pts.length - 1) {
          um.pos.copy(c.pts[c.pts.length - 1]);
          this.andando.delete(um);
          um.caminho = null;
          if (um.k >= 0 && !um.saindo) {
            um.pos.copy(um.assento.pos);
            um.giro = um.assento.giro;
            this.multidao.tempo(um, "modo", 0);
            this.multidao.colocar(um);
          }
          if (c.aoFim) c.aoFim();
          continue;
        }
        const a = c.pts[c.i], b = c.pts[c.i + 1];
        const d = a.distanceTo(b) || 1;
        const k = Math.min(1, c.t / d);
        um.pos.lerpVectors(a, b, k);
        const subida = Math.abs(b.y - a.y);
        um.pos.y += Math.sin(k * Math.PI) * (subida > 1 ? subida * 0.8 + 0.8 : 0.22);
        const dx = b.x - a.x, dz = b.z - a.z;
        if (dx * dx + dz * dz > 0.01) um.giro = Math.atan2(dx, dz);
        this.multidao.colocar(um);
      }
    },

    /* ───────────── eventos da live ───────────── */

    entrou(a) {
      const st = this.setores[this.indice.get(a.time)];
      const velho = this.pessoas.get(a.id);
      if (velho) this.sair(velho, true);
      const um = this.sentar(st, { pessoa: a.id, nome: a.nome });
      this.ultimaEntrada = this.t;
      if (!um) return;
      this.rotulo(um, a.nome, 3.4);
      if (!this.foco && this.t - this.ultimoClose > 7 && this.t > this.focoLivre) {
        this.ultimoClose = this.t;
        this.focar({ modo: "torcedor", um, dur: 2.8, prioridade: 0 });
      }
    },

    pulou(a) {
      const um = this.pessoas.get(a.id);
      if (!um) return;
      this.multidao.tempo(um, "pulou", this.t);
      if (!um.rotuloAte || this.t > um.rotuloAte + 3) this.rotulo(um, a.nome, 1.8, "curto");
    },

    acenou(a) {
      const um = this.pessoas.get(a.id);
      if (um && this.t - (um.acenou ?? -100) > 2.2) this.multidao.tempo(um, "acenou", this.t);
    },

    /* Genérico chega devagar quando o chat está parado; não conta. */
    genericos(estadio, dt) {
      const g = this.cfg.genericos;
      if (!g || !g.ligado || estadio.fase !== "rodada") return;
      this.genericoEm -= dt;
      if (this.genericoEm > 0) return;
      this.genericoEm = g.intervalo * (this.t - this.ultimaEntrada < g.calma ? 3 : 1) * sorte(0.6, 1.4);
      const livres = this.setores.filter(st => st.genericos < g.porSetor);
      if (!livres.length) return;
      const st = livres[Math.floor(Math.random() * livres.length)];
      this.sentar(st, { generico: true, chegada: "desce" });
    },

    /* ───────────── presentes ───────────── */

    presente(a, rotulo) {
      const st = this.setores[this.indice.get(a.time)];
      const n = Math.min(4, a.faixa);
      this.cartao(st, rotulo, n);
      const um = this.pessoas.get(a.id);
      if (um) this.multidao.tempo(um, "pulou", this.t);
      st.ola = Math.max(st.ola, n >= 1 ? 0.25 : 0);
      if (n === 0) this.sinalizador(st, 1);
      else if (n === 1) this.bandeirao(st);
      else if (n === 2) this.mosaico(st, rotulo.nome);
      else if (n === 3) this.caravana(st, a.extras);
      else this.lendario(st, rotulo);
    },

    /* Presente fora da rodada: só o cartão, o efeito fica pra próxima. */
    guardado(a, rotulo) {
      this.cartao(this.setores[this.indice.get(a.time)], rotulo, Math.min(4, a.faixa));
    },

    sinalizador(st, forca) {
      const quantos = forca >= 1 ? (LEVE ? 2 : 3) : 2;
      /* Fumaça na cor do time; time de camisa preta solta a segunda cor. */
      const escura = st.cor.r + st.cor.g + st.cor.b < 0.1;
      const fumaca = (escura ? st.cor2 : st.cor).clone();
      const cor = new THREE.Color(1, 0.45, 0.25).lerp(fumaca, 0.25);
      for (let i = 0; i < quantos; i++) {
        const th = lerp(st.th0, st.th1, (i + 0.5 + sorte(-0.2, 0.2)) / quantos);
        const fila = Math.floor(Math.random() * 3);
        const p = ponto(th, fila * PROF + 0.95, altura(fila) + 2.1, new THREE.Vector3());
        this.efeitos.push({ tipo: "tocha", p, ate: this.t + 4.2 * forca + 1.2, cor: fumaca, faisca: cor, acc: 0 });
        const luz = this.chamas.find(c => c.ate < this.t) || this.chamas[i % 3];
        luz.ate = this.t + 4.4 * forca + 1;
        luz.luz.position.copy(p).addScaledVector(st.dentro, 1.2);
        luz.cor.set(0xff4020).lerp(cor, 0.4);
        luz.luz.color.copy(luz.cor);
      }
      this.aoMomento("sinalizador");
      this.focar({ modo: "setor", st, dur: 3.6, prioridade: 1 });
    },

    bandeirao(st) {
      const tex = (this.bandeiras ||= new Map());
      if (!tex.has(st.i)) tex.set(st.i, Texturas.bandeira(st.time));
      const geo = superficie(st, LEVE ? 18 : 30, LEVE ? 8 : 12, 2.3, 0.02);
      const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex.get(st.i), side: THREE.DoubleSide }));
      const rolo = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1, 10), new THREE.MeshLambertMaterial({ color: st.time.cor2 }));
      this.scene.add(mesh, rolo);
      this.efeitos.push({ tipo: "bandeira", st, mesh, rolo, t0: this.t, dur: 7.5 });
      this.aoMomento("bandeira");
      this.focar({ modo: "setor", st, dur: 6.5, prioridade: 2, longe: 9 });
    },

    mosaico(st, nome) {
      /* Por cima das cabeças, como os cartões erguidos. */
      const geo = superficie(st, LEVE ? 10 : 18, 2, 2.6, 0.012);
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uMapa: { value: Texturas.mosaico(st.time, `@${encurtar(nome, 14)}`) },
          uT: { value: 0 }, uFim: { value: 99 },
          uVerso: { value: (Texturas.claro(st.time.cor) ? st.cor2 : st.cor).clone().multiplyScalar(0.8) },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
          uniform sampler2D uMapa; uniform float uT; uniform float uFim; uniform vec3 uVerso;
          varying vec2 vUv;
          void main() {
            /* Cartões virando em colunas, da esquerda pra direita. */
            float colunas = 36.0;
            float col = floor(vUv.x * colunas);
            float f = fract(vUv.x * colunas);
            float atraso = col / colunas * 1.1;
            float vira = clamp((uT - atraso) / 0.3, 0.0, 1.0) - clamp((uT - uFim - atraso * 0.6) / 0.3, 0.0, 1.0);
            float largura = abs(cos(vira * 3.14159));
            if (uT < atraso - 0.25 || abs(f - 0.5) > 0.5 * largura + 0.02) discard;
            vec3 frente = texture2D(uMapa, vUv).rgb;
            vec3 cor = mix(uVerso, frente, step(0.5, vira)) * (0.6 + 0.4 * largura);
            gl_FragColor = vec4(cor, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      this.scene.add(mesh);
      this.efeitos.push({ tipo: "mosaico", st, mesh, t0: this.t, dur: 8.5 });
      st.ola = 0;
      this.aoMomento("mosaico");
      this.focar({ modo: "mosaico", st, dur: 7.2, prioridade: 3 });
    },

    /* O ônibus sai do túnel, roda pela pista até o setor, buzina e solta a
       torcida extra, que pula a mureta e sobe até os lugares. */
    caravana(st, extras) {
      const bus = Personagens.onibus(st.time);
      this.scene.add(bus);
      const ida = angulo(TUNEL, st.thc);
      const dur = 2.2 + Math.abs(ida) * 0.9;
      const visiveis = Math.min(extras || 0, LEVE ? 30 : 60);
      this.efeitos.push({ tipo: "onibus", st, bus, t0: this.t, dur, ida, visiveis, soltos: 0, fase: "vem" });
      this.aoMomento("caravana");
      this.focar({ modo: "onibus", st, dur: dur + 5.5, prioridade: 3 });
    },

    lendario(st, rotulo) {
      this.lendas.push({ st, rotulo });
      if (this.lendas.length === 1) this.comecarLenda();
    },

    comecarLenda() {
      const { st, rotulo } = this.lendas[0];
      this.lenda = { st, rotulo, t0: this.t, dur: 8.5, proximo: 0.6 };
      this.apagaoAlvo = 1;
      this.holofote.position.copy(st.meio).addScaledVector(st.dentro, 14).setY(46);
      this.holofote.target.position.copy(st.meio);
      this.holofote.color.set(0xfff4dc);
      if (!this.facho) {
        this.facho = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 24, 1, true),
          new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
        this.facho.geometry.translate(0, -0.5, 0);
        this.scene.add(this.facho);
      }
      const de = this.holofote.position, para = st.meio;
      const dist = de.distanceTo(para);
      this.facho.position.copy(de);
      this.facho.scale.set(dist * 0.34, dist, dist * 0.34);
      this.facho.quaternion.setFromUnitVectors(v1.set(0, -1, 0), v2.copy(para).sub(de).normalize());
      st.ola = 1;
      /* Setor lotado pro show: genéricos (sem @, fora da contagem) nos lugares
         vazios enquanto as luzes apagam. */
      this.lenda.extras = [];
      const vagas = st.ordem.filter(x => !x.ocupante).length;
      for (let i = 0; i < Math.min(vagas, LEVE ? 40 : 120); i++) {
        const um = this.sentar(st, { generico: true });
        if (!um) break;
        um.chegou = this.t + 0.3 + Math.random() * 0.5;
        this.multidao.gravar(um);
        this.lenda.extras.push(um);
      }
      this.telaoLenda = { nome: rotulo.nome, simbolo: rotulo.simbolo, time: st.time };
      this.aoMomento("lenda", { rotulo, st });
      this.focar({ modo: "lenda", st, dur: 8.4, prioridade: 4 });
    },

    animarLenda(dt) {
      const L = this.lenda;
      if (!L) return;
      const t = this.t - L.t0;
      const on = t < 0.5 ? 0 : t < L.dur - 1 ? 1 : Math.max(0, (L.dur - t));
      this.holofote.intensity = on * 9;
      this.facho.material.opacity = on * 0.16;
      L.st.ola = Math.max(L.st.ola, 1);
      if (t > L.proximo && t < L.dur - 1.2) {
        L.proximo = t + (LEVE ? sorte(0.3, 0.5) : sorte(0.1, 0.22));
        this.fogos(L.st, null, true);
      }
      if (t >= L.dur) {
        for (const um of L.extras) {
          this.agenda.push({ em: this.t + 1 + Math.random() * 7, f: () => { if (!um.saindo && um.k >= 0) this.sair(um); } });
        }
        this.lenda = null;
        this.lendas.shift();
        this.telaoLenda = null;
        if (this.lendas.length) this.comecarLenda();
        else this.apagaoAlvo = 0;
      }
    },

    fogos(st, cor = null, perto = false) {
      const base = cor || (Math.random() < 0.5 ? st.cor : Math.random() < 0.5 ? st.cor2 : new THREE.Color(Math.random() < 0.5 ? 0xffd25a : 0xffffff));
      const c = base.clone();
      if (c.r + c.g + c.b < 0.3) c.set(0xffd25a);
      const p = perto
        ? ponto(lerp(st.th0, st.th1, Math.random()), sorte(FUNDO * 0.5, FUNDO + 8), TOPO + sorte(8, 18), new THREE.Vector3())
        : ponto(st.thc + sorte(-0.5, 0.5), sorte(-6, 20), sorte(26, 44), new THREE.Vector3());
      this.efeitos.push({ tipo: "foguete", de: ponto(st.thc + sorte(-0.2, 0.2), FUNDO + 1, TOPO + 3, new THREE.Vector3()), para: p, cor: c, t0: this.t, dur: 0.7 });
    },

    estourar(p, c) {
      const n = LEVE ? 40 : 70;
      const arr = c.toArray();
      const miolo = c.clone().lerp(new THREE.Color(1, 1, 1), 0.2).toArray();
      for (let i = 0; i < n; i++) {
        const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
        const vel = sorte(9, 14);
        this.luzes.emitir({
          x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * r * vel, vy: u * vel, vz: Math.sin(a) * r * vel,
          vida: sorte(1.2, 1.9), tam: 1.1, tamFim: 0.35, cor: miolo, corFim: arr, arrasto: 1.6, grav: 4,
        });
      }
      this.luzes.emitir({ x: p.x, y: p.y, z: p.z, vida: 0.25, tam: 9, tamFim: 14, cor: arr, alfa: 0.7 });
      this.flash = Math.min(0.5, this.flash + 0.12);
      this.aoMomento("fogos");
    },

    /* ───────────── presidente ───────────── */

    presidente(time, nome, tomou = false) {
      const st = this.setores[this.indice.get(time)];
      st.pedestal.visible = true;
      if (!st.presidente) {
        const pe = ponto(st.thc, -1.15, 1.05, new THREE.Vector3());
        st.presidente = this.chefes.por({
          ...this.visual(st, false), padrao: st.padrao, coluna: st.thc,
          pos: pe, giro: Math.atan2(st.dentro.x, st.dentro.z), escala: 1.55, chegou: this.t, modo: 2,
        });
      } else {
        Object.assign(st.presidente, Personagens.sortearVisual(this.rnd), { chegou: this.t });
        this.chefes.gravar(st.presidente);
      }
      if (st.placa) {
        st.placa.material.map.dispose();
        st.placa.material.dispose();
        this.scene.remove(st.placa);
      }
      const placa = new THREE.Sprite(new THREE.SpriteMaterial({ map: Texturas.placa(encurtar(nome, 14)), fog: false }));
      placa.scale.set(4, 0.875, 1);
      placa.position.copy(st.presidente.pos).setY(4.9);
      placa.renderOrder = 5;
      this.scene.add(placa);
      st.placa = placa;
      st.presidenteNome = nome;
      for (let i = 0; i < 26; i++) {
        this.luzes.emitir({
          x: placa.position.x, y: 3.2, z: placa.position.z, vx: sorte(-3, 3), vy: sorte(2, 6), vz: sorte(-3, 3),
          vida: sorte(0.8, 1.3), tam: 0.9, tamFim: 0.2, cor: [1, 0.85, 0.35], arrasto: 1.4, grav: 5,
        });
      }
      /* Quem tomou a presidência ganha a câmera depois do efeito do presente. */
      if (tomou) this.agenda.push({ em: this.t + 2.6, f: () => this.focar({ modo: "presidente", st, dur: 3.4, prioridade: 1.5 }) });
    },

    tirarPresidentes() {
      for (const st of this.setores) {
        if (st.presidente) this.chefes.tirar(st.presidente);
        st.presidente = null;
        st.presidenteNome = null;
        st.pedestal.visible = false;
        if (st.placa) { this.scene.remove(st.placa); st.placa.material.map.dispose(); st.placa.material.dispose(); st.placa = null; }
      }
    },

    /* ───────────── rodada ───────────── */

    fim(a) {
      this.vencedor = a.vencedor ? this.setores[this.indice.get(a.vencedor)] : null;
      this.festa = { t0: this.t, st: this.vencedor, presidente: a.presidente };
      if (this.vencedor) {
        this.vencedor.ola = 1;
        this.focar({ modo: "vitoria", st: this.vencedor, dur: 99, prioridade: 9 });
      }
    },

    /* Todo mundo levanta e sai andando pelo alto da arquibancada. */
    esvaziar() {
      for (const st of this.setores) for (const um of [...st.torcedores]) this.sair(um);
      this.tirarPresidentes();
      this.festa = null;
      this.vencedor = null;
      this.foco = null;
      for (const st of this.setores) st.ola = 0;
      this.U.uOlaG.value.set(0, 0);
    },

    novaRodada(estadio, reservas = []) {
      if (this.festa) this.esvaziar();
      this.foco = null;
      for (const r of reservas) {
        const st = this.setores[this.indice.get(r.time)];
        const n = Math.min(r.extras || 0, LEVE ? 30 : 60);
        for (let i = 0; i < n; i++) {
          const um = this.sentar(st, { extra: true, chegada: "desce" });
          if (um) um.caminho.t = -i * 0.12;
        }
        if (r.presidente) this.presidente(r.time, r.presidente.nome);
      }
    },

    /* ───────────── efeitos (partículas) ───────────── */

    montarEfeitos() {
      this.fumaca = new Particulas(LEVE ? 260 : 700, this.tex.fumaca, false);
      this.luzes = new Particulas(LEVE ? 500 : 2000, this.tex.brilho, true);
      this.papel = new Particulas(LEVE ? 320 : 900, this.tex.papel, false);
      this.scene.add(this.fumaca.pontos, this.luzes.pontos, this.papel.pontos);
    },

    confete(st, quantos) {
      const cores = [st.cor.toArray(), st.cor2.toArray(), [1, 0.82, 0.25], [1, 1, 1]];
      for (let i = 0; i < quantos; i++) {
        const th = lerp(st.th0, st.th1, Math.random());
        const p = ponto(th, sorte(-2, FUNDO), sorte(10, 16), v1);
        this.papel.emitir({
          x: p.x, y: p.y, z: p.z, vx: sorte(-1.5, 1.5), vy: sorte(-1, 1), vz: sorte(-1.5, 1.5),
          vida: sorte(3, 4.6), tam: sorte(0.4, 0.65), cor: cores[i % cores.length], arrasto: 1.2, grav: 2.2,
        });
      }
    },

    animarEfeitos(dt) {
      const vivos = [];
      for (const e of this.efeitos) {
        const t = this.t - (e.t0 ?? 0);
        if (e.tipo === "tocha") {
          if (this.t > e.ate) continue;
          e.acc += dt;
          const passo = LEVE ? 0.09 : 0.045;
          while (e.acc > passo) {
            e.acc -= passo;
            this.fumaca.emitir({
              x: e.p.x + sorte(-0.3, 0.3), y: e.p.y + 0.3, z: e.p.z + sorte(-0.3, 0.3),
              vx: sorte(-0.8, 0.8), vy: sorte(2.6, 4), vz: sorte(-0.8, 0.8),
              vida: sorte(2.8, 3.8), tam: 3, tamFim: 9.5, cor: e.cor.toArray(), alfa: 0.72, arrasto: 0.45,
            });
            this.luzes.emitir({
              x: e.p.x, y: e.p.y, z: e.p.z, vx: sorte(-2.5, 2.5), vy: sorte(2, 6), vz: sorte(-2.5, 2.5),
              vida: sorte(0.3, 0.7), tam: 0.6, tamFim: 0.1, cor: [1, 0.75, 0.4], arrasto: 2, grav: 6,
            });
            this.luzes.emitir({ x: e.p.x, y: e.p.y, z: e.p.z, vida: 0.12, tam: sorte(2.2, 3.2), cor: e.faisca.toArray(), alfa: 0.9 });
          }
          vivos.push(e);
        } else if (e.tipo === "bandeira") {
          if (t > e.dur) { this.scene.remove(e.mesh, e.rolo); e.mesh.geometry.dispose(); e.mesh.material.dispose(); e.rolo.geometry.dispose(); continue; }
          this.animarBandeira(e, t);
          vivos.push(e);
        } else if (e.tipo === "mosaico") {
          e.mesh.material.uniforms.uT.value = t;
          e.mesh.material.uniforms.uFim.value = e.dur - 1.6;
          if (t > e.dur) { this.scene.remove(e.mesh); e.mesh.geometry.dispose(); e.mesh.material.uniforms.uMapa.value.dispose(); e.mesh.material.dispose(); continue; }
          if (t > 1.6 && !e.ola) { e.ola = true; this.aoMomento("cartoes"); }
          vivos.push(e);
        } else if (e.tipo === "onibus") {
          if (this.animarOnibus(e, t)) vivos.push(e);
        } else if (e.tipo === "foguete") {
          const k = clamp(t / e.dur);
          const p = v1.lerpVectors(e.de, e.para, 1 - (1 - k) * (1 - k));
          this.luzes.emitir({ x: p.x, y: p.y, z: p.z, vida: 0.4, tam: 0.7, tamFim: 0.1, cor: [1, 0.85, 0.5] });
          if (k >= 1) { this.estourar(e.para, e.cor); continue; }
          vivos.push(e);
        }
      }
      this.efeitos = vivos;
      for (const c of this.chamas) {
        const resta = c.ate - this.t;
        c.luz.intensity = resta > 0 ? Math.min(1, resta) * (4 + Math.sin(this.t * 40 + c.cor.r * 9) * 1.4 + Math.random()) : 0;
      }
    },

    /* Desenrola do fundo pra frente, ondula com a torcida e enrola de
       volta. O pedaço ainda enrolado fica preso no rolo. */
    animarBandeira(e, t) {
      const g = e.mesh.geometry, P = g.attributes.position, U = g.attributes.uv;
      const abre = t < 1.6 ? curva(t / 1.6) : t > e.dur - 1.3 ? curva(Math.max(0, e.dur - t) / 1.3) : 1;
      const frente = 1 - abre;
      for (let i = 0; i < P.count; i++) {
        const u = U.getX(i), v = U.getY(i);
        const vv = Math.max(v, frente);
        const onda = (Math.sin(u * 9 + this.t * 2.6 + vv * 3) * 0.26 + Math.cos(u * 5 - this.t * 1.9) * 0.14) * Math.min(1, (vv - frente) * 6);
        const p = sobreSetor(e.st, u, vv, 2.3 + onda, 0.02, v1);
        P.setXYZ(i, p.x, p.y, p.z);
      }
      P.needsUpdate = true;
      g.computeVertexNormals();
      const a = sobreSetor(e.st, 0, frente, 2.45, 0.02, v1), b = sobreSetor(e.st, 1, frente, 2.45, 0.02, v2);
      e.rolo.position.addVectors(a, b).multiplyScalar(0.5);
      e.rolo.scale.set(1, a.distanceTo(b) * 1.03, 1);
      e.rolo.quaternion.setFromUnitVectors(v3.set(0, 1, 0), v2.sub(a).normalize());
      e.rolo.visible = abre < 0.995;
    },

    animarOnibus(e, t) {
      const st = e.st, bus = e.bus;
      let k, th;
      if (t < e.dur) {
        k = curva(clamp(t / e.dur));
        th = TUNEL + e.ida * k;
        bus.position.copy(ponto(th, PISTA, 0, v1));
      } else if (t < e.dur + 3.4) {
        k = 1;
        th = TUNEL + e.ida;
        bus.position.copy(ponto(th, PISTA, 0, v1));
        if (!e.chegou) { e.chegou = true; this.aoMomento("buzina"); }
        const solta = Math.floor((t - e.dur - 0.3) / 0.055);
        while (e.soltos < e.visiveis && e.soltos <= solta) {
          e.soltos++;
          const porta = bus.position.clone().addScaledVector(st.dentro, -1.5);
          const um = this.sentar(st, { extra: true, chegada: "pula", de: porta });
          if (um) um.caminho.velocidade = 6.5;
        }
      } else {
        const volta = clamp((t - e.dur - 3.4) / 2.4);
        if (volta >= 1) { this.scene.remove(bus); bus.userData.descartar(); return false; }
        k = 1 + curva(volta) * 0.9;
        th = TUNEL + e.ida * k;
        bus.position.copy(ponto(th, PISTA, 0, v1));
        bus.scale.setScalar(volta > 0.8 ? 1 - (volta - 0.8) * 5 : 1);
      }
      const frente = ponto(th + Math.sign(e.ida || 1) * 0.02, PISTA, 0, v2);
      bus.lookAt(frente);
      if (t > e.dur && t < e.dur + 3.4) bus.position.y = Math.abs(Math.sin(t * 18)) * 0.04;
      return true;
    },

    /* ───────────── câmera ───────────── */

    focar(f) {
      const atual = this.foco;
      if (atual && (atual.prioridade || 0) > (f.prioridade || 0) && this.t < atual.ate) return;
      this.foco = { ...f, t0: this.t, ate: this.t + f.dur };
      this.passeio = null;
    },

    /* Plano geral: o anel inteiro de pé no celular (o comprido na vertical),
       do lado oposto ao dos setores mais cheios pra eles ficarem de frente,
       balançando devagar. */
    geral(estadio, dt) {
      let sx = 0, sz = 0, total = 0;
      for (const st of this.setores) {
        const n = estadio.lotacao(estadio.setor(st.time.id));
        const w = Math.pow(n, 1.4);
        sx += st.meio.x * w; sz += st.meio.z * w; total += w;
      }
      const alvoZ = total > 0 ? Math.sign(sz || 1) : 1;
      this.lado = suave(this.lado ?? 1, alvoZ, 0.25, dt);
      const lado = this.lado >= 0 ? 1 : -1;
      const base = lado > 0 ? -Math.PI / 2 : Math.PI / 2;
      const balanco = Math.sin(this.t * 0.07) * 0.32 + (total > 0 ? clamp(sx / (total * 30), -0.3, 0.3) * lado : 0);
      this.az = suave(this.az, base + balanco, 0.35, dt);
      const dist = 80, alto = 92;
      const olhar = v2.set(-Math.cos(this.az) * 5, 2, -Math.sin(this.az) * 5);
      const pos = v1.set(Math.cos(this.az) * dist, alto, Math.sin(this.az) * dist);
      return { pos: pos.clone(), olhar: olhar.clone(), fov: 46, taxa: 1.4 };
    },

    /* Ponto no gramado de frente pro meio do setor, `dist` m pra dentro. */
    naFrente(st, dist, y) {
      return st.meio.clone().addScaledVector(st.dentro, dist).setY(y);
    },

    planoSetor(st, longe = 0) {
      const pos = this.naFrente(st, 24 + longe, 11 + longe * 0.5);
      const olhar = ponto(st.thc, FUNDO * 0.42, altura(2) + 1.2, new THREE.Vector3());
      return { pos, olhar, fov: 44 };
    },

    diretor(estadio, dt) {
      const f = this.foco;
      if (f && this.t > f.ate) {
        this.foco = null;
        this.focoLivre = this.t + 1.5;
      }
      let alvo;
      const foco = this.foco;
      if (foco && foco.modo === "torcedor" && foco.um.k >= 0) {
        const um = foco.um;
        const fr = v3.set(Math.sin(um.giro), 0, Math.cos(um.giro));
        const cabeca = um.pos.clone().setY(um.pos.y + 1.4);
        alvo = { pos: cabeca.clone().addScaledVector(fr, 9.5).setY(cabeca.y + 3.2), olhar: cabeca.clone().setY(cabeca.y + 0.9), fov: 40, taxa: 2.2 };
      } else if (foco && (foco.modo === "setor" || foco.modo === "presidente")) {
        alvo = { ...this.planoSetor(foco.st, foco.longe || 0), taxa: 2 };
        if (foco.modo === "presidente") {
          const p = foco.st.presidente ? foco.st.presidente.pos : foco.st.frente;
          alvo = { pos: p.clone().addScaledVector(foco.st.dentro, 17).setY(6.5), olhar: p.clone().setY(3.6), fov: 42, taxa: 2.2 };
        }
      } else if (foco && foco.modo === "mosaico") {
        /* Olha um pouco pra direita do setor: o fim do @ não fica embaixo do placar. */
        const st = foco.st;
        const pos = this.naFrente(st, 27, 23);
        const olhar = ponto(lerp(st.thc, st.th1, 0.3), FUNDO * 0.5, altura(3) + 1.2, new THREE.Vector3());
        alvo = { pos, olhar, fov: 46, taxa: 2 };
      } else if (foco && foco.modo === "onibus") {
        /* Acompanha o ônibus de lado, do gramado, com a arquibancada atrás. */
        const ef = this.efeitos.find(e => e.tipo === "onibus" && e.st === foco.st);
        if (ef && this.t - ef.t0 < ef.dur + 0.4) {
          const b = ef.bus.position;
          const th = Math.atan2(b.z, b.x);
          const n = normal(th, PISTA, new THREE.Vector3());
          alvo = { pos: b.clone().addScaledVector(n, 19).setY(8), olhar: b.clone().addScaledVector(n, -3).setY(2.5), fov: 48, taxa: 2.6 };
        } else alvo = { ...this.planoSetor(foco.st, 4), taxa: 1.8 };
      } else if (foco && foco.modo === "lenda") {
        const st = foco.st;
        /* O setor enche a tela com os fogos logo acima. */
        const pos = this.naFrente(st, 22, 6.5);
        const olhar = ponto(st.thc, FUNDO * 0.45, TOPO + 2.5, new THREE.Vector3());
        alvo = { pos, olhar, fov: 54, taxa: 1.8 };
      } else if (foco && foco.modo === "vitoria") {
        alvo = { ...this.planoSetor(foco.st, 3 + Math.min(4, (this.t - foco.t0) * 0.5)), taxa: 1.6 };
      } else if (this.passeio) {
        const p = this.passeio;
        p.th += dt * 0.13;
        const pos = ponto(p.th + Math.PI, -14, 11, new THREE.Vector3()).multiplyScalar(0.35).setY(11);
        const olhar = ponto(p.th, FUNDO * 0.5, altura(3), new THREE.Vector3());
        alvo = { pos, olhar, fov: 46, taxa: 1.2 };
        if (this.t > p.ate) { this.passeio = null; this.proximoPasseio = this.t + 18; }
      } else {
        alvo = this.geral(estadio, dt);
        /* Visita curta aos 3 setores mais cheios, um de cada vez. */
        if (estadio.fase === "rodada" && this.t > this.proximaVisita && estadio.resta() > 8) {
          this.proximaVisita = this.t + 11;
          const cheios = this.setores.filter(st => estadio.lotacao(estadio.setor(st.time.id)) > 0)
            .sort((a, b) => estadio.setor(a.time.id).pos - estadio.setor(b.time.id).pos).slice(0, 3);
          if (cheios.length) this.focar({ modo: "setor", st: cheios[this.visitados++ % cheios.length], dur: 4.5, prioridade: 0.5, longe: 2 });
        }
        if (estadio.fase === "rodada" && this.t > this.proximoPasseio && estadio.resta() > 14) {
          const cheio = [...this.setores].sort((a, b) => b.torcedores.size - a.torcedores.size)[0];
          this.passeio = { th: cheio.thc - 0.6, ate: this.t + 9 };
        }
      }
      this.aplicarCamera(dt, alvo.pos, alvo.olhar, alvo.fov, alvo.taxa || 1.6);
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
        c.position.x += (Math.random() - 0.5) * 0.3 * tr;
        c.position.y += (Math.random() - 0.5) * 0.3 * tr;
      }
      c.updateProjectionMatrix();
    },

    modoCamera() { return this.foco ? this.foco.modo : this.passeio ? "passeio" : "geral"; },

    /* ───────────── telão ───────────── */

    desenharTelao(estadio) {
      const T = this.telao;
      const resta = estadio.resta();
      let chave, desenho;
      const lider = estadio.ordem()[0];
      const liderTime = this.times[this.indice.get(lider.id)];
      const g = T.g, W = 640, H = 360;
      const fundoTime = time => {
        Texturas.padrao(g, time, 0, 0, W, H, 1.6);
        g.fillStyle = "rgba(6,8,20,.55)";
        g.fillRect(0, 0, W, H);
      };
      const texto = (s, y, tam, cor = "#fff") => Texturas.letreiro(g, s, W / 2, y, W - 60, tam, { cor, borda: 0.14 });
      if (this.festa && this.festa.st) {
        const st = this.festa.st, p = this.festa.presidente;
        chave = `fim:${st.i}:${p ? p.nome : ""}`;
        desenho = () => {
          fundoTime(st.time);
          texto("MAIOR TORCIDA", 64, 46, "#ffc928");
          texto((st.time.curto || st.time.nome).toUpperCase(), 168, 120);
          if (p) texto(`👑 @${encurtar(p.nome, 16)}`, 290, 50, "#ffd95a");
        };
      } else if (this.telaoLenda) {
        const L = this.telaoLenda;
        chave = `lenda:${L.nome}`;
        desenho = () => {
          fundoTime(L.time);
          texto(L.simbolo, 110, 120);
          texto(`@${encurtar(L.nome, 16)}`, 240, 84, "#ffd95a");
          texto((L.time.curto || L.time.nome).toUpperCase(), 322, 40);
        };
      } else if (estadio.fase === "rodada" && resta <= 10) {
        const n = Math.ceil(resta);
        chave = `conta:${n}`;
        desenho = () => {
          g.fillStyle = n <= 3 ? "#b0121a" : "#151a3a";
          g.fillRect(0, 0, W, H);
          texto(String(n), H / 2 + 8, 260, n <= 3 ? "#fff" : "#ffc928");
        };
      } else {
        const n = estadio.lotacao(lider);
        chave = `lider:${lider.id}:${n}:${estadio.fase}`;
        desenho = () => {
          if (n) fundoTime(liderTime);
          else { g.fillStyle = "#121633"; g.fillRect(0, 0, W, H); }
          texto("MAIOR TORCIDA DO BRASIL", 62, 40, "#ffc928");
          if (n) {
            texto((liderTime.curto || liderTime.nome).toUpperCase(), 175, 118);
            texto(`${n} ${n === 1 ? "TORCEDOR" : "TORCEDORES"}`, 292, 50);
          } else texto("PORTÕES ABERTOS", 200, 76);
        };
      }
      if (chave === T.chave) return;
      T.chave = chave;
      g.clearRect(0, 0, W, H);
      desenho();
      g.fillStyle = "rgba(0,0,0,.18)";
      for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);
      T.tex.needsUpdate = true;
    },

    /* ───────────── tela (DOM por cima do canvas) ───────────── */

    montarTela(palco) {
      this.palco = palco;
      this.$pops = document.createElement("div");
      this.$pops.className = "pops";
      this.$tags = document.createElement("div");
      this.$tags.className = "tags";
      this.$clarao = document.createElement("div");
      this.$clarao.className = "clarao";
      const vinheta = document.createElement("div");
      vinheta.className = "vinheta";
      palco.querySelector("#estadio").after(vinheta, this.$clarao, this.$tags, this.$pops);
      this.rotulos = [];
      this.tags = this.setores.map(st => {
        const el = document.createElement("div");
        el.className = "tag";
        el.style.setProperty("--c1", st.time.cor);
        el.style.setProperty("--c2", st.time.cor2);
        el.innerHTML = `<span></span><b>0</b>`;
        el.querySelector("span").textContent = st.time.sigla;
        this.$tags.append(el);
        return { el, n: el.querySelector("b"), valor: -1 };
      });
    },

    tela(p) {
      v3.copy(p).project(this.camera);
      return { x: (v3.x + 1) / 2 * this.W, y: (1 - v3.y) / 2 * this.H, atras: v3.z > 1 };
    },

    /* @ em cima da cabeça de quem chegou; acompanha a câmera. */
    rotulo(um, nome, seg, cls = "") {
      const el = document.createElement("div");
      el.className = `nome ${cls}`;
      el.textContent = `@${encurtar(nome, 14)}`;
      el.style.setProperty("--c1", um.st.time.cor);
      el.style.setProperty("--c2", um.st.time.cor2);
      this.$pops.append(el);
      const r = { el, um, ate: this.t + seg, nasceu: this.t };
      um.rotuloAte = r.ate;
      this.rotulos.push(r);
      if (this.rotulos.length > 7) {
        const velho = this.rotulos.shift();
        velho.el.remove();
      }
    },

    moverRotulos() {
      const vivos = [];
      for (const r of this.rotulos) {
        if (this.t > r.ate || r.um.k < 0) { r.el.remove(); continue; }
        const p = v1.copy(r.um.pos).setY(r.um.pos.y + 2.25 * (r.um.escala || 1));
        const s = this.tela(p);
        const fora = r.um.nome === r.um.st.presidenteNome || s.atras || s.x < 40 || s.x > this.W - 40 || s.y < 300 || s.y > this.H - 160;
        r.el.hidden = fora;
        if (!fora) {
          const idade = this.t - r.nasceu, resta = r.ate - this.t;
          const sobe = Math.min(1, idade / 0.3);
          r.el.style.transform = `translate(${s.x.toFixed(1)}px, ${(s.y - 20 * sobe).toFixed(1)}px) translate(-50%, -100%) scale(${(0.6 + 0.4 * sobe).toFixed(3)})`;
          r.el.style.opacity = Math.min(1, resta / 0.4).toFixed(2);
        }
        vivos.push(r);
      }
      this.rotulos = vivos;
    },

    /* Nome do setor e a lotação no plano geral, pra comparar de longe. */
    moverTags(estadio) {
      const mostra = this.modoCamera() === "geral" && estadio.fase === "rodada";
      this.$tags.classList.toggle("some", !mostra);
      if (!mostra) return;
      for (const [i, st] of this.setores.entries()) {
        const tag = this.tags[i];
        const setor = estadio.setor(st.time.id);
        const n = estadio.lotacao(setor);
        if (n !== tag.valor) {
          tag.valor = n;
          tag.n.textContent = n;
          tag.el.classList.toggle("vazio", !n);
        }
        tag.el.classList.toggle("grande", n > 0 && setor.pos < 5);
        const s = this.tela(st.topo);
        const fora = s.atras || s.y < 300 || s.y > this.H - 120;
        tag.el.hidden = fora;
        /* Não entra embaixo do placar lateral. */
        const max = s.y > 520 && s.y < 1060 ? this.W - 380 : this.W - 110;
        if (!fora) tag.el.style.transform = `translate(${clamp(s.x, 110, max).toFixed(1)}px, ${s.y.toFixed(1)}px) translate(-50%, -100%)`;
      }
    },

    /* Cartão de quem mandou presente: ícone (×N) e o @, na cor do time. */
    cartao(st, rotulo, n) {
      if (this.$cartao) this.$cartao.remove();
      const el = document.createElement("div");
      el.className = `cartao n${n}`;
      el.style.setProperty("--c1", st.time.cor);
      el.style.setProperty("--c2", st.time.cor2);
      const icone = document.createElement("span");
      icone.className = "icone";
      icone.textContent = rotulo.simbolo;
      let frente = icone;
      if (n >= 2) {
        frente = document.createElement("span");
        frente.className = "selo";
        frente.append(icone);
      }
      const txt = document.createElement("span");
      txt.className = "txt";
      const nome = document.createElement("b");
      nome.textContent = `@${encurtar(rotulo.nome, 18)}` + (rotulo.quantidade > 1 ? ` ×${rotulo.quantidade}` : "");
      const time = document.createElement("small");
      time.textContent = (st.time.curto || st.time.nome).toUpperCase();
      txt.append(nome, time);
      el.append(frente, txt);
      for (let i = 0; i < n * 3; i++) {
        const f = document.createElement("i");
        f.className = "faisca";
        f.style.left = `${Math.random() * 100}%`;
        f.style.top = `${Math.random() < 0.5 ? -8 - Math.random() * 18 : 100 + Math.random() * 18}%`;
        f.style.animationDelay = `${-Math.random()}s`;
        el.append(f);
      }
      el.addEventListener("animationend", e => {
        if (e.target !== el) return;
        el.remove();
        if (this.$cartao === el) this.$cartao = null;
      });
      this.$cartao = el;
      this.$pops.append(el);
      /* Nunca passa de 92% da largura. */
      const max = this.W * 0.92;
      if (el.offsetWidth > max) el.style.setProperty("--tam", `${Math.floor(parseFloat(getComputedStyle(el).fontSize) * max / el.offsetWidth)}px`);
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

    quadro(estadio, dt) {
      this.t += dt;
      this.U.uT.value = this.t;

      if (this.agenda.length) {
        const prontos = this.agenda.filter(x => x.em <= this.t);
        this.agenda = this.agenda.filter(x => x.em > this.t);
        for (const x of prontos) x.f();
      }

      const fim = estadio.fase === "rodada" && estadio.resta() <= 10;
      for (const st of this.setores) {
        const s = estadio.setor(st.time.id);
        let alvo = estadio.agito(s);
        if (fim && st.torcedores.size) alvo = Math.max(alvo, 1.6);
        if (this.festa && this.festa.st === st) alvo = 3;
        st.agito = suave(st.agito, alvo, alvo > st.agito ? 3 : 0.8, dt);
        this.U.uAgito.value[st.i] = st.agito;
        const olaAlvo = this.lenda && this.lenda.st === st ? 1 : this.festa && this.festa.st === st ? 1 : 0;
        st.ola = st.ola > olaAlvo ? Math.max(olaAlvo, st.ola - dt * 0.18) : suave(st.ola, olaAlvo, 4, dt);
        this.U.uOla.value[st.i] = st.ola;
        st.fita.material.color.copy(st.cor).multiplyScalar(0.7 + Math.min(1.6, st.agito * 0.5) + (Math.sin(this.t * 8 + st.i) * 0.2 + 0.2) * Math.min(1, st.agito));
      }

      if (this.festa) {
        const t = this.t - this.festa.t0;
        if (this.festa.st) {
          if (t < 6 && Math.random() < dt * 30) this.confete(this.festa.st, LEVE ? 6 : 14);
          this.U.uOlaG.value.set(t > 2.5 ? clamp((t - 2.5) / 0.8) : 0, this.festa.st.thc + (t - 2.5) * 1.3);
        }
      }

      this.genericos(estadio, dt);
      this.andar(dt);
      this.animarEfeitos(dt);
      this.animarLenda(dt);
      this.fumaca.passo(dt);
      this.luzes.passo(dt);
      this.papel.passo(dt);
      this.diretor(estadio, dt);
      this.desenharTelao(estadio);
      /* O telão do lado da câmera só mostraria as costas; nos planos fechados
         ele ficaria atrás do tempo e das faixas. */
      const modo = this.modoCamera();
      const aberto = modo === "geral" || modo === "passeio" || modo === "onibus";
      for (const g of this.teloes) g.visible = aberto && (g.position.z * this.camera.position.z < 0 || Math.abs(this.camera.position.z) < Math.abs(g.position.z) - 4);

      this.led.offset.x = (this.led.offset.x + dt * 0.02) % 1;
      this.apagao = suave(this.apagao, this.apagaoAlvo, this.apagaoAlvo > this.apagao ? 5 : 1.5, dt);
      const luz = 1 - this.apagao * 0.88;
      this.ceuLuz.intensity = this.forca.ceu * luz;
      this.luzA.intensity = this.forca.a * luz;
      this.luzB.intensity = this.forca.b * luz;
      for (const b of this.brilhos) b.material.opacity = b.userData.base * (1 - this.apagao * 0.92);
      this.placasLed.material.color.setScalar(1 - this.apagao * 0.7);
      this.ceu.material.uniforms.uLuz.value = 1 - this.apagao * 0.8;
      for (const m of this.predios) m.color.setHex(0x9aa0c0).multiplyScalar(1 - this.apagao * 0.85);

      this.tremor = Math.max(0, this.tremor - dt * 2.2);
      this.flash = Math.max(0, this.flash - dt * 2.5);
      this.$clarao.style.opacity = this.flash.toFixed(3);

      this.moverRotulos();
      this.moverTags(estadio);

      const px = this.alturaPx / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2));
      this.fumaca.material.uniforms.uEscala.value = px;
      this.luzes.material.uniforms.uEscala.value = px;
      this.papel.material.uniforms.uEscala.value = px;
      this.renderer.render(this.scene, this.camera);
    },
  };
})();
