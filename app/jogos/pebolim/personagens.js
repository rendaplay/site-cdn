/* O boneco de pebolim de madeira pintada e o torcedor do ginásio. Os dois são
   uma malha só repetida num InstancedMesh: cada vértice sabe de que parte é
   (camisa, pele, calção, cabelo, braço, olho, meia, chuteira) e a cor de cada
   um vem por instância. O padrão da camisa (lisa, listrada, faixa...) sai no
   fragment shader, na posição local do boneco. */
"use strict";

const Personagens = (() => {
  const PADRAO = { liso: 0, horiz: 1, listras: 2, faixa: 3, diagonal: 4, mangas: 5 };
  const PELES = ["#f2c9a0", "#e0ac80", "#c68b5e", "#a26c45", "#7a4c30", "#5a3722"];
  const CABELOS = ["#1c130d", "#2e1d12", "#4a2e18", "#14100c", "#6b4424", "#c9a25a"];

  /* Cada peça leva no atributo `aParte` de que parte ela é. */
  function peca(geo, parte, { x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0 } = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    g.deleteAttribute("uv");
    g.scale(sx, sy, sz);
    if (rx) g.rotateX(rx);
    if (rz) g.rotateZ(rz);
    g.translate(x, y, z);
    g.setAttribute("aParte", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(parte), 1));
    return g;
  }

  function juntar(pecas) {
    const total = pecas.reduce((s, g) => s + g.attributes.position.count, 0);
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), parte = new Float32Array(total);
    let k = 0;
    for (const g of pecas) {
      const n = g.attributes.position.count;
      pos.set(g.attributes.position.array, k * 3);
      nor.set(g.attributes.normal.array, k * 3);
      parte.set(g.attributes.aParte.array, k);
      k += n;
      g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    geo.setAttribute("aParte", new THREE.BufferAttribute(parte, 1));
    geo.computeBoundingSphere();
    return geo;
  }

  /* ───────────── boneco do pebolim ───────────── */

  /* Em centímetros, com a vareta no eixo x passando pelo peito (origem).
     Olha pra +z; a sola fica 7 cm abaixo da vareta, rente à mesa. O pé é
     um bloco só, largo, como o boneco de verdade. */
  function malhaBoneco({ leve = false } = {}) {
    const s = leve ? 8 : 14;
    const c = leve ? 2 : 4;
    const p = [];
    p.push(peca(new THREE.SphereGeometry(1.55, s + 2, s), 1, { y: 3.05 }));
    p.push(peca(new THREE.SphereGeometry(1.64, s + 2, s, 0, Math.PI * 2, 0, 1.35), 3, { y: 3.12, z: -0.12, rx: -0.32 }));
    p.push(peca(new THREE.CylinderGeometry(0.62, 0.7, 0.9, s), 1, { y: 1.65 }));
    p.push(peca(new THREE.CapsuleGeometry(1.05, 1.5, c, s + 2), 0, { y: 0.15, sx: 1.42, sz: 0.92 }));
    for (const lado of [-1, 1]) {
      p.push(peca(new THREE.SphereGeometry(0.62, s, s - 2), 4, { x: lado * 1.62, y: 1.2 }));
      p.push(peca(new THREE.CapsuleGeometry(0.46, 2.0, c, s), 4, { x: lado * 1.86, y: -0.2, z: 0.15, rz: lado * 0.1 }));
      p.push(peca(new THREE.SphereGeometry(0.5, s, s - 2), 1, { x: lado * 1.98, y: -1.55, z: 0.25 }));
      p.push(peca(new THREE.CapsuleGeometry(0.58, 2.1, c, s), 1, { x: lado * 0.72, y: -3.5 }));
      p.push(peca(new THREE.CylinderGeometry(0.64, 0.62, 1.1, s), 6, { x: lado * 0.72, y: -4.85 }));
      if (!leve) p.push(peca(new THREE.SphereGeometry(0.2, 8, 6), 5, { x: lado * 0.55, y: 3.15, z: 1.42, sz: 0.5 }));
    }
    p.push(peca(new THREE.CylinderGeometry(1.32, 1.42, 1.25, s + 2), 2, { y: -1.75, sz: 0.78 }));
    p.push(peca(new THREE.BoxGeometry(3.0, 1.05, 2.5, 1, 1, 1), 7, { y: -6.15, z: 0.12 }));
    p.push(peca(new THREE.CylinderGeometry(1.5, 1.5, 1.05, s, 1, false, 0, Math.PI), 7, { y: -6.15, z: 1.37, sz: 0.5 }));
    if (leve) {
      for (const lado of [-1, 1]) p.push(peca(new THREE.BoxGeometry(0.32, 0.32, 0.1), 5, { x: lado * 0.55, y: 3.15, z: 1.47 }));
    }
    return juntar(p);
  }

  const ATRIBUTOS_BONECO = /* glsl */`
    attribute float aParte;
    attribute vec3 iCor1; attribute vec3 iCor2; attribute vec3 iCalca; attribute vec3 iPele;
    attribute vec4 iInfo;
    varying vec3 vCor1; varying vec3 vCor2; varying vec3 vCalca; varying vec3 vPele;
    varying vec3 vLocal; varying float vParte; varying vec4 vInfo;
  `;

  const CORES_BONECO = /* glsl */`
    uniform float uT;
    varying vec3 vCor1; varying vec3 vCor2; varying vec3 vCalca; varying vec3 vPele;
    varying vec3 vLocal; varying float vParte; varying vec4 vInfo;

    vec3 camisa(vec3 p) {
      int pd = int(vInfo.x + 0.5);
      vec3 c = vCor1;
      if (pd == 1) c = mix(vCor1, vCor2, step(0.5, fract(p.y * 0.95 + 0.2)));
      else if (pd == 2) c = mix(vCor1, vCor2, step(0.5, fract(p.x * 0.62 + 0.25)));
      else if (pd == 3) {
        float d = abs(p.y - 0.35);
        if (d < 0.42) c = vCor2;
        else if (d < 0.6) c = vec3(0.03);
      } else if (pd == 4) {
        if (abs(p.x * 0.85 + p.y - 0.2) < 0.55) c = vCor2;
      }
      if (p.y > 1.15 && abs(p.x) < 0.75) c = vCor2;
      return c;
    }
  `;

  /* Cada instância: cores, `iInfo` = (padrão, craque, brilho de quem acabou
     de entrar, gelo). */
  function materialBoneco(U, { leve = false } = {}) {
    const m = leve
      ? new THREE.MeshLambertMaterial({ color: 0xffffff })
      : new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.38, metalness: 0.0, envMapIntensity: 0.55 });
    m.onBeforeCompile = sh => {
      sh.uniforms.uT = U.uT;
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\n" + ATRIBUTOS_BONECO)
        .replace("#include <begin_vertex>", `#include <begin_vertex>
          vLocal = position; vParte = aParte; vInfo = iInfo;
          vCor1 = iCor1; vCor2 = iCor2; vCalca = iCalca; vPele = iPele;`);
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\n" + CORES_BONECO)
        .replace("#include <color_fragment>", `
          vec3 cor;
          int pa = int(vParte + 0.5);
          float craque = vInfo.y;
          if (pa == 0) cor = camisa(vLocal);
          else if (pa == 1) cor = vPele;
          else if (pa == 2) cor = vCalca;
          else if (pa == 3) cor = vec3(0.07, 0.045, 0.03);
          else if (pa == 4) cor = vLocal.y > 0.45 ? (int(vInfo.x + 0.5) == 5 ? vCor2 : vCor1) : vPele;
          else if (pa == 5) cor = vec3(0.02);
          else if (pa == 6) cor = vCor2;
          else cor = vec3(0.05, 0.05, 0.06);
          if (craque > 0.5 && (pa == 0 || pa == 2 || pa == 4 || pa == 6)) {
            float faixa = 0.5 + 0.5 * sin(vLocal.y * 2.2 - uT * 5.0);
            cor = mix(vec3(1.0, 0.72, 0.16), vec3(1.0, 0.9, 0.5), faixa * 0.6);
          }
          cor = mix(cor, vec3(0.62, 0.86, 1.0), vInfo.w * 0.75);
          diffuseColor.rgb = cor;`)
        .replace("#include <emissivemap_fragment>", `
          totalEmissiveRadiance += diffuseColor.rgb * vInfo.z * 0.9;
          if (craque > 0.5 && (pa == 0 || pa == 2 || pa == 4 || pa == 6)) totalEmissiveRadiance += diffuseColor.rgb * 0.22;
          totalEmissiveRadiance += vec3(0.2, 0.45, 0.7) * vInfo.w * 0.35;`);
      if (!leve) {
        sh.fragmentShader = sh.fragmentShader.replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
          if (vInfo.y > 0.5) roughnessFactor = 0.22;`)
          .replace("#include <metalnessmap_fragment>", `#include <metalnessmap_fragment>
          if (vInfo.y > 0.5 && (pa == 0 || pa == 2 || pa == 4 || pa == 6)) metalnessFactor = 0.65;`);
      }
    };
    m.customProgramCacheKey = () => "boneco" + (leve ? "-leve" : "");
    return m;
  }

  /* Os 22 bonecos de uma vez. `vestir(i, o)` pinta um, `info(i, ...)` liga
     craque, brilho e gelo. */
  class Elenco {
    constructor(qtd, geo, mat) {
      const g = geo.clone();
      this.attr = {};
      for (const [nome, tam] of [["iCor1", 3], ["iCor2", 3], ["iCalca", 3], ["iPele", 3], ["iInfo", 4]]) {
        const a = new THREE.InstancedBufferAttribute(new Float32Array(qtd * tam), tam);
        a.setUsage(THREE.DynamicDrawUsage);
        g.setAttribute(nome, a);
        this.attr[nome] = a;
      }
      this.mesh = new THREE.InstancedMesh(g, mat, qtd);
      this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.mesh.frustumCulled = false;
      this.cor = new THREE.Color();
    }

    vestir(i, { cor1, cor2, calcao, padrao, pele }) {
      const a = this.attr;
      this.cor.set(cor1).toArray(a.iCor1.array, i * 3);
      this.cor.set(cor2).toArray(a.iCor2.array, i * 3);
      this.cor.set(calcao).toArray(a.iCalca.array, i * 3);
      this.cor.set(pele).toArray(a.iPele.array, i * 3);
      a.iInfo.array[i * 4] = PADRAO[padrao] || 0;
      for (const x of Object.values(a)) x.needsUpdate = true;
    }

    info(i, craque, brilho, gelo) {
      const arr = this.attr.iInfo.array;
      if (arr[i * 4 + 1] === craque && arr[i * 4 + 2] === brilho && arr[i * 4 + 3] === gelo) return;
      arr[i * 4 + 1] = craque;
      arr[i * 4 + 2] = brilho;
      arr[i * 4 + 3] = gelo;
      this.attr.iInfo.needsUpdate = true;
    }
  }

  /* ───────────── torcida do ginásio ───────────── */

  /* Torcedor de pé, simples: tronco, cabeça e braços. Pula conforme o agito
     do lado dele (uniforme), cada um no seu tempo. */
  function malhaTorcedor({ leve = false } = {}) {
    const s = leve ? 5 : 7;
    const p = [];
    p.push(peca(new THREE.CapsuleGeometry(0.26, 0.55, 1, s), 0, { y: 1.05, sz: 0.75 }));
    p.push(peca(new THREE.SphereGeometry(0.24, s, s - 2), 1, { y: 1.72 }));
    p.push(peca(new THREE.CapsuleGeometry(0.11, 0.5, 1, s - 2), 2, { x: -0.36, y: 1.25 }));
    p.push(peca(new THREE.CapsuleGeometry(0.11, 0.5, 1, s - 2), 3, { x: 0.36, y: 1.25 }));
    p.push(peca(new THREE.CylinderGeometry(0.24, 0.2, 0.75, s), 4, { y: 0.38 }));
    return juntar(p);
  }

  function materialTorcedor(U) {
    const m = new THREE.MeshLambertMaterial({ color: 0xffffff });
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, { uT: U.uT, uAgito: U.uAgito });
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", `#include <common>
          attribute float aParte; attribute vec3 iCor; attribute vec3 iPele; attribute vec2 iInfo;
          uniform float uT; uniform vec2 uAgito;
          varying vec3 vCor; varying float vParte;`)
        .replace("#include <begin_vertex>", `#include <begin_vertex>
          float ag = iInfo.x < 0.5 ? uAgito.x : uAgito.y;
          float ritmo = abs(sin(uT * (5.5 + ag * 3.0) + iInfo.y * 6.2831));
          float braco = clamp(ag, 0.0, 1.0);
          if (aParte > 1.5 && aParte < 3.5) {
            float lado = aParte < 2.5 ? -1.0 : 1.0;
            vec3 ombro = vec3(lado * 0.3, 1.5, 0.0);
            float a = braco * (2.4 + 0.5 * sin(uT * 9.0 + iInfo.y * 7.0));
            vec3 q = transformed - ombro;
            float c = cos(a * lado), s = sin(a * lado);
            transformed = ombro + vec3(q.x * c - q.y * s, q.x * s + q.y * c, q.z);
          }
          transformed.y += ritmo * (0.08 + ag * 0.42);
          vCor = aParte < 0.5 || (aParte > 1.5 && aParte < 3.5 && transformed.y > 1.35) ? iCor : (aParte > 3.5 ? vec3(0.12, 0.13, 0.18) : iPele);
          vParte = aParte;`);
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vCor; varying float vParte;")
        .replace("#include <color_fragment>", "diffuseColor.rgb = vCor;");
    };
    m.customProgramCacheKey = () => "torcedor-pebolim";
    return m;
  }

  class Torcida {
    constructor(lugares, geo, mat) {
      const n = lugares.length;
      const g = geo.clone();
      this.cor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
      this.pele = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
      this.info = new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2);
      g.setAttribute("iCor", this.cor);
      g.setAttribute("iPele", this.pele);
      g.setAttribute("iInfo", this.info);
      this.mesh = new THREE.InstancedMesh(g, mat, n);
      this.mesh.frustumCulled = false;
      this.lugares = lugares;
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), esc = new THREE.Vector3();
      const c = new THREE.Color();
      lugares.forEach((l, i) => {
        e.set(0, l.giro, 0);
        q.setFromEuler(e);
        esc.setScalar(l.escala);
        m4.compose(l.pos, q, esc);
        this.mesh.setMatrixAt(i, m4);
        c.set(PELES[Math.floor(l.sorte * 97) % PELES.length]).toArray(this.pele.array, i * 3);
        this.info.array[i * 2] = l.lado;
        this.info.array[i * 2 + 1] = l.sorte;
      });
    }

    /* Metade de cada lado com a camisa do time; um ou outro com a segunda cor. */
    pintar(timeA, timeB) {
      const c = new THREE.Color();
      this.lugares.forEach((l, i) => {
        const t = l.lado < 0.5 ? timeA : timeB;
        c.set(l.sorte > 0.72 ? t.cor2 : t.cor);
        if (l.sorte > 0.9) c.set("#2a2f3d");
        c.toArray(this.cor.array, i * 3);
      });
      this.cor.needsUpdate = true;
    }
  }

  return { PADRAO, PELES, CABELOS, malhaBoneco, materialBoneco, Elenco, malhaTorcedor, materialTorcedor, Torcida };
})();
