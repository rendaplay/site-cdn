/* O torcedor cartoon e as peças que andam no estádio (o ônibus da caravana).

   O torcedor é uma malha só, desenhada uma vez e repetida num InstancedMesh:
   cada vértice sabe de que parte é (camisa, pele, calça, cabelo, braço,
   escuro, ouro) e de que grupo (corpo, braço esquerdo, braço direito,
   pernas). A pose sai inteira no vertex shader, a partir do agito do setor
   (sentado → de pé → pulando → ola) e dos tempos de cada um (chegou, pulou,
   acenou). O JS só mexe na matriz de quem está andando. */
"use strict";

const Personagens = (() => {
  const PADRAO = { liso: 0, horiz: 1, listras: 2, faixa: 3, diagonal: 4, mangas: 5 };
  const PELES = ["#f6d0a8", "#e8b48a", "#c98b5f", "#a8704a", "#7d4f32", "#5a3722"];
  const CABELOS = ["#1c130d", "#2e1d12", "#4a2e18", "#14100c", "#6b4424", "#c9a25a", "#0e0e10", "#8a8a8a"];
  const CALCAS = ["#1f2a44", "#232323", "#2c3e66", "#3a3f4a", "#1b1b26", "#4a5a7a"];
  const OMBRO = new THREE.Vector2(0.31, 1.36);
  const QUADRIL = 0.72;

  /* Cada peça leva no atributo `aPG` a parte (cor) e o grupo (articulação). */
  function peca(geo, parte, grupo, { x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0 } = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    g.scale(sx, sy, sz);
    if (rx) g.rotateX(rx);
    g.translate(x, y, z);
    const n = g.attributes.position.count;
    const pg = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { pg[i * 2] = parte; pg[i * 2 + 1] = grupo; }
    g.setAttribute("aPG", new THREE.BufferAttribute(pg, 2));
    return g;
  }

  function juntar(pecas) {
    const total = pecas.reduce((s, g) => s + g.attributes.position.count, 0);
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), pg = new Float32Array(total * 2);
    let k = 0;
    for (const g of pecas) {
      const n = g.attributes.position.count;
      pos.set(g.attributes.position.array, k * 3);
      nor.set(g.attributes.normal.array, k * 3);
      pg.set(g.attributes.aPG.array, k * 2);
      k += n;
      g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    geo.setAttribute("aPG", new THREE.BufferAttribute(pg, 2));
    geo.computeBoundingSphere();
    return geo;
  }

  /* Pés no chão (y = 0), olhando pra +z. Cabeção de cartoon. `coroa` põe a
     coroa do presidente. */
  function malhaTorcedor({ leve = false, coroa = false } = {}) {
    const seg = leve ? 6 : 10;
    const cap = leve ? 2 : 3;
    const p = [];
    for (const lado of [-1, 1]) {
      p.push(peca(new THREE.BoxGeometry(0.17, 0.11, 0.28), 5, 3, { x: lado * 0.11, y: 0.055, z: 0.04 }));
      p.push(peca(new THREE.CapsuleGeometry(0.09, 0.48, cap, seg), 2, 3, { x: lado * 0.11, y: 0.4 }));
      p.push(peca(new THREE.CapsuleGeometry(0.078, 0.42, cap, seg), 4, lado < 0 ? 1 : 2, { x: lado * 0.325, y: 1.1 }));
      p.push(peca(new THREE.SphereGeometry(0.088, seg, seg - 2), 1, lado < 0 ? 1 : 2, { x: lado * 0.33, y: 0.8 }));
    }
    p.push(peca(new THREE.CapsuleGeometry(0.25, 0.38, cap, seg + 2), 0, 0, { y: 1.03, sz: 0.74 }));
    p.push(peca(new THREE.SphereGeometry(0.275, seg + 2, seg), 1, 0, { y: 1.7 }));
    p.push(peca(new THREE.SphereGeometry(0.29, seg + 2, seg, 0, Math.PI * 2, 0, 1.25), 3, 0, { y: 1.71, z: -0.03, rx: -0.18 }));
    if (!leve) {
      for (const lado of [-1, 1]) {
        p.push(peca(new THREE.SphereGeometry(0.05, 8, 6), 5, 0, { x: lado * 0.095, y: 1.73, z: 0.238, sz: 0.6 }));
        p.push(peca(new THREE.SphereGeometry(0.06, 8, 6), 1, 0, { x: lado * 0.27, y: 1.68, sx: 0.5 }));
      }
      p.push(peca(new THREE.TorusGeometry(0.075, 0.018, 4, 10, Math.PI), 5, 0, { y: 1.6, z: 0.24, rx: Math.PI }));
    }
    if (coroa) {
      p.push(peca(new THREE.CylinderGeometry(0.23, 0.2, 0.16, 10, 1, true), 6, 0, { y: 2.02 }));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        p.push(peca(new THREE.ConeGeometry(0.06, 0.17, 5), 6, 0, { x: Math.sin(a) * 0.215, y: 2.18, z: Math.cos(a) * 0.215 }));
        p.push(peca(new THREE.SphereGeometry(0.035, 6, 4), 7, 0, { x: Math.sin(a) * 0.215, y: 2.28, z: Math.cos(a) * 0.215 }));
      }
    }
    return juntar(p);
  }

  /* ───────────── material com a pose no shader ───────────── */

  const POSE = /* glsl */`
    attribute vec2 aPG;
    attribute vec3 iCor1; attribute vec3 iCor2; attribute vec3 iPele; attribute vec3 iCabelo; attribute vec3 iCalca;
    attribute vec4 iInfo;
    attribute vec4 iTempo;
    uniform float uT;
    uniform float uAgito[12];
    uniform float uOla[12];
    uniform vec2 uOlaG;
    varying vec3 vCor1; varying vec3 vCor2; varying vec3 vPele; varying vec3 vCabelo; varying vec3 vCalca;
    varying vec3 vLocal; varying float vParte; varying float vPadrao; varying float vBrilho;

    mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
    mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }

    float angDist(float a, float b) { return abs(mod(a - b + 3.14159265, 6.2831853) - 3.14159265); }

    /* Devolve a pose do vértice (posição e normal locais). */
    void posar(inout vec3 p, inout vec3 n) {
      int s = int(iInfo.y + 0.5);
      float ag = uAgito[s];
      float fase = iInfo.z;
      float coluna = iInfo.w;
      float modo = iTempo.w;
      float andando = step(0.5, modo) * step(modo, 1.5);
      float chefe = step(1.5, modo);

      float dPulo = uT - iTempo.y;
      float pulo = dPulo >= 0.0 && dPulo < 1.5 ? 1.0 - smoothstep(1.1, 1.5, dPulo) : 0.0;
      float dAceno = uT - iTempo.z;
      float aceno = dAceno >= 0.0 && dAceno < 2.4 ? 1.0 - smoothstep(2.0, 2.4, dAceno) : 0.0;

      float pe = clamp(ag - fase * 0.25, 0.0, 1.0);
      float pula = clamp(ag - 1.0, 0.0, 1.0);
      float ola = max(clamp(ag - 2.0, 0.0, 1.0), uOla[s]);
      float crista = ola * smoothstep(0.35, 1.0, sin(coluna * 13.0 - uT * 6.5));
      crista = max(crista, uOlaG.x * exp(-pow(angDist(coluna, uOlaG.y), 2.0) / 0.03));

      float levanta = max(max(pe * (1.0 - ola), crista), max(pulo, max(andando, chefe)));
      levanta = max(levanta, aceno * 0.6);
      float sentado = 1.0 - levanta;

      float ritmo = abs(sin(uT * 6.6 + fase * 6.2831));
      float salto = pula * (1.0 - ola) * ritmo * 0.32 * (1.0 - andando);
      salto += pulo * abs(sin(min(dPulo, 1.4) * 6.7)) * 0.55 * (1.0 - dPulo / 1.5);
      salto += crista * 0.18 + chefe * ritmo * 0.12 * clamp(ag, 0.0, 1.0);

      float bracoL = mix(0.12, 0.32, pe);
      bracoL = mix(bracoL, 2.55 + 0.35 * sin(uT * 13.0 + fase * 9.0), pula * (1.0 - ola));
      bracoL = mix(bracoL, 2.95, max(crista, pulo));
      float bracoR = bracoL;
      bracoR = mix(bracoR, 2.5 + 0.5 * sin(dAceno * 15.0), aceno);
      bracoL = mix(bracoL, 0.55, chefe);
      bracoR = mix(bracoR, 2.4 + 0.45 * sin(uT * 7.0), chefe);

      float passada = sin(uT * 11.0 + fase * 6.2831) * andando;
      float g = aPG.y;
      vec3 pivo = vec3(0.0);
      mat3 R = mat3(1.0);
      if (g > 0.5 && g < 1.5) {
        pivo = vec3(-${OMBRO.x}, ${OMBRO.y}, 0.0);
        R = rotZ(-bracoL) * rotX(passada * 0.55);
      } else if (g > 1.5 && g < 2.5) {
        pivo = vec3(${OMBRO.x}, ${OMBRO.y}, 0.0);
        R = rotZ(bracoR) * rotX(-passada * 0.55);
      } else if (g > 2.5) {
        pivo = vec3(sign(p.x) * 0.11, ${QUADRIL}, 0.0);
        R = rotX(-1.45 * sentado + sign(p.x) * passada * 0.6);
      }
      p = pivo + R * (p - pivo);
      n = R * n;
      p.y += salto - 0.27 * sentado + abs(passada) * 0.06;

      float dChegou = uT - iTempo.x;
      float k = clamp(dChegou / 0.5, 0.0, 1.0);
      float volta = 1.0 + 2.7 * pow(k - 1.0, 3.0) + 1.7 * pow(k - 1.0, 2.0);
      p *= dChegou < 0.0 ? 1.0 : volta;
      vBrilho = dChegou >= 0.0 ? 1.0 - smoothstep(0.0, 1.6, dChegou) : 0.0;
    }
  `;

  const CORES = /* glsl */`
    varying vec3 vCor1; varying vec3 vCor2; varying vec3 vPele; varying vec3 vCabelo; varying vec3 vCalca;
    varying vec3 vLocal; varying float vParte; varying float vPadrao; varying float vBrilho;

    vec3 camisa(vec3 p) {
      int pd = int(vPadrao + 0.5);
      vec3 c = vCor1;
      if (pd == 1) c = mix(vCor1, vCor2, step(0.5, fract((p.y - 0.6) * 5.2)));
      else if (pd == 2) c = mix(vCor1, vCor2, step(0.5, fract(atan(p.x, p.z) * 1.6 + 0.25)));
      else if (pd == 3) {
        if (abs(p.y - 1.06) < 0.075) c = vCor2;
        else if (abs(p.y - 1.06) < 0.105) c = vec3(0.02);
      } else if (pd == 4) {
        if (abs(p.x * 0.95 * sign(p.z) + (p.y - 1.05)) < 0.075) c = vCor2;
      }
      if (p.y > 1.36 && length(p.xz) > 0.12) c = vCor2;
      if (p.y < 0.68) c = vCalca;
      return c;
    }
  `;

  function material(U) {
    const m = new THREE.MeshLambertMaterial({ color: 0xffffff });
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\n" + POSE)
        .replace("#include <beginnormal_vertex>", `
          vec3 objectNormal = vec3(normal);
          vec3 poseP = vec3(position);
          posar(poseP, objectNormal);
          vLocal = position; vParte = aPG.x; vPadrao = iInfo.x;
          vCor1 = iCor1; vCor2 = iCor2; vPele = iPele; vCabelo = iCabelo; vCalca = iCalca;`)
        .replace("#include <begin_vertex>", "vec3 transformed = poseP;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\n" + CORES)
        .replace("#include <color_fragment>", `
          vec3 cor;
          int pa = int(vParte + 0.5);
          if (pa == 0) cor = camisa(vLocal);
          else if (pa == 1) cor = vPele;
          else if (pa == 2) cor = vCalca;
          else if (pa == 3) cor = vCabelo;
          else if (pa == 4) cor = (${OMBRO.y} - vLocal.y) < 0.2 ? (int(vPadrao + 0.5) == 5 ? vCor2 : vCor1) : vPele;
          else if (pa == 5) cor = vec3(0.035, 0.03, 0.045);
          else if (pa == 6) cor = vec3(1.0, 0.68, 0.12);
          else cor = vec3(0.9, 0.08, 0.12);
          diffuseColor.rgb = cor;`)
        .replace("#include <emissivemap_fragment>", `
          totalEmissiveRadiance += diffuseColor.rgb * vBrilho * 0.85;
          if (pa >= 6) totalEmissiveRadiance += diffuseColor.rgb * 0.45;`);
    };
    m.customProgramCacheKey = () => "torcedor";
    return m;
  }

  /* ───────────── multidão (InstancedMesh compacto) ───────────── */

  /* Os ativos ficam sempre nos primeiros índices: tirar um põe o último no
     lugar dele, e `count` é só quem está no estádio. */
  class Multidao {
    constructor(max, geo, mat) {
      this.max = max;
      this.ativos = [];
      const g = geo.clone();
      this.attr = {};
      for (const [nome, tam] of [["iCor1", 3], ["iCor2", 3], ["iPele", 3], ["iCabelo", 3], ["iCalca", 3], ["iInfo", 4], ["iTempo", 4]]) {
        const a = new THREE.InstancedBufferAttribute(new Float32Array(max * tam), tam);
        a.setUsage(THREE.DynamicDrawUsage);
        g.setAttribute(nome, a);
        this.attr[nome] = a;
      }
      this.mesh = new THREE.InstancedMesh(g, mat, max);
      this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.mesh.frustumCulled = false;
      this.mesh.count = 0;
      this.m4 = new THREE.Matrix4();
      this.q = new THREE.Quaternion();
      this.e = new THREE.Euler();
      this.esc = new THREE.Vector3();
    }

    cheio() { return this.ativos.length >= this.max; }

    /* `t` = { cor1, cor2, padrao, pele, cabelo, calca } (THREE.Color), mais
       setor, fase e coluna (ângulo no anel, pra ola). */
    por(t) {
      if (this.cheio()) return null;
      const k = this.ativos.length;
      const um = { k, ...t };
      this.ativos.push(um);
      this.mesh.count = this.ativos.length;
      this.gravar(um);
      return um;
    }

    gravar(um) {
      const a = this.attr, k = um.k;
      um.cor1.toArray(a.iCor1.array, k * 3);
      um.cor2.toArray(a.iCor2.array, k * 3);
      um.pele.toArray(a.iPele.array, k * 3);
      um.cabelo.toArray(a.iCabelo.array, k * 3);
      um.calca.toArray(a.iCalca.array, k * 3);
      a.iInfo.array.set([um.padrao, um.setor, um.fase, um.coluna], k * 4);
      a.iTempo.array.set([um.chegou ?? -100, um.pulou ?? -100, um.acenou ?? -100, um.modo ?? 0], k * 4);
      this.colocar(um);
      for (const x of Object.values(a)) x.needsUpdate = true;
    }

    tempo(um, campo, valor) {
      if (um.k < 0) return;
      const i = { chegou: 0, pulou: 1, acenou: 2, modo: 3 }[campo];
      um[campo] = valor;
      this.attr.iTempo.array[um.k * 4 + i] = valor;
      this.attr.iTempo.needsUpdate = true;
    }

    colocar(um) {
      if (um.k < 0) return;
      this.e.set(0, um.giro || 0, 0);
      this.q.setFromEuler(this.e);
      const s = um.escala || 1;
      this.esc.set(s, s, s);
      this.m4.compose(um.pos, this.q, this.esc);
      this.mesh.setMatrixAt(um.k, this.m4);
      this.mesh.instanceMatrix.needsUpdate = true;
    }

    tirar(um) {
      const k = um.k;
      if (k < 0) return;
      const ultimo = this.ativos.pop();
      um.k = -1;
      if (ultimo !== um) {
        this.ativos[k] = ultimo;
        ultimo.k = k;
        this.gravar(ultimo);
      }
      this.mesh.count = this.ativos.length;
    }
  }

  function sortearVisual(rnd) {
    const qual = lista => lista[Math.floor(rnd() * lista.length)];
    return {
      pele: new THREE.Color(qual(PELES)),
      cabelo: new THREE.Color(qual(CABELOS)),
      calca: new THREE.Color(qual(CALCAS)),
    };
  }

  /* ───────────── ônibus da caravana ───────────── */

  /* Frente pra +z. O lado leva a textura com as janelas e o nome. */
  function onibus(time) {
    const g = new THREE.Group();
    const lado = new THREE.MeshLambertMaterial({ map: Texturas.onibus(time) });
    const cor = new THREE.MeshLambertMaterial({ color: time.cor });
    const vidro = new THREE.MeshLambertMaterial({ color: 0x223044, emissive: 0x334a66, emissiveIntensity: 0.6 });
    const corpo = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.7, 9), [lado, lado, cor, cor, vidro, cor]);
    corpo.position.y = 1.85;
    g.add(corpo);
    const teto = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.25, 8.4), new THREE.MeshLambertMaterial({ color: new THREE.Color(time.cor).lerp(new THREE.Color(1, 1, 1), 0.3) }));
    teto.position.y = 3.3;
    g.add(teto);
    const pneu = new THREE.MeshLambertMaterial({ color: 0x15151a });
    const roda = new THREE.CylinderGeometry(0.55, 0.55, 0.4, 14);
    roda.rotateZ(Math.PI / 2);
    for (const z of [-3, 3]) for (const x of [-1.2, 1.2]) {
      const r = new THREE.Mesh(roda, pneu);
      r.position.set(x, 0.55, z);
      g.add(r);
    }
    const farol = new THREE.MeshBasicMaterial({ color: 0xfff4c8 });
    for (const x of [-0.85, 0.85]) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.25, 0.05), farol);
      f.position.set(x, 0.95, 4.52);
      g.add(f);
    }
    g.userData.descartar = () => g.traverse(o => {
      if (!o.isMesh) return;
      o.geometry.dispose();
      for (const m of [].concat(o.material)) { if (m.map) m.map.dispose(); m.dispose(); }
    });
    return g;
  }

  return { PADRAO, malhaTorcedor, material, Multidao, sortearVisual, onibus };
})();
