/* Os 12 mascotes e o juiz, montados por código com as geometrias do
   three.js. Cada mascote é um bicho genérico de desenho (nunca o mascote
   oficial do clube) com a camisa, o calção e o número do time. Toda junta
   é um grupo (quadril, coxa, ombro, cotovelo, pescoço) e a cena faz a pose
   com poucos números por quadro. Nascem de frente pro +z com o pé no
   zero; medidas em metros. */
"use strict";

const Personagens = (() => {
  const mat = (cor, o = {}) => new THREE.MeshStandardMaterial({ color: cor, roughness: 0.62, metalness: 0, ...o });

  function malha(geo, material, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    return m;
  }

  function grupo(pai, x = 0, y = 0, z = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    if (pai) pai.add(g);
    return g;
  }

  /* Membro pendurado na junta: cápsula descendo `comp` a partir do pivô. */
  function membro(pai, raio, comp, material) {
    const m = malha(new THREE.CapsuleGeometry(raio, comp, 4, 10), material, 0, -comp / 2, 0);
    pai.add(m);
    return m;
  }

  function esfera(raio, material, seg = 18) {
    return malha(new THREE.SphereGeometry(raio, seg, Math.max(8, Math.round(seg * 0.75))), material);
  }

  /* Bola achatada: orelha, focinho, mancha. */
  function bola(pai, raio, material, [x, y, z], [sx, sy, sz] = [1, 1, 1], seg = 16) {
    const m = esfera(raio, material, seg);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    pai.add(m);
    return m;
  }

  function cone(pai, raio, alto, material, [x, y, z], rot = [0, 0, 0]) {
    const m = malha(new THREE.ConeGeometry(raio, alto, 14), material, x, y, z);
    m.rotation.set(...rot);
    pai.add(m);
    return m;
  }

  /* Cor, focinho e o que cada bicho tem de próprio na cabeça. */
  const BICHOS = {
    urso: { pele: "#8a5a34", focinho: "#e0bc92", nariz: "#2a1a12" },
    leao: { pele: "#eaa743", focinho: "#fbe0aa", nariz: "#5a2a18" },
    elefante: { pele: "#a3abb5", focinho: null, nariz: null },
    panda: { pele: "#f6f6f4", focinho: "#ffffff", nariz: "#1b1b1f", mao: "#1b1b1f" },
    pinguim: { pele: "#1d2029", focinho: null, nariz: null, mao: "#1d2029" },
    hipopotamo: { pele: "#9a87ad", focinho: "#c3b0d2", nariz: null },
    gato: { pele: "#a9aab2", focinho: "#f4f1ec", nariz: "#f08aa0" },
    coala: { pele: "#8f949e", focinho: null, nariz: "#2b2b30" },
    tigre: { pele: "#f08a24", focinho: "#fff5e8", nariz: "#c84a5a" },
    touro: { pele: "#76432a", focinho: "#e0ae90", nariz: null },
    rinoceronte: { pele: "#8e918b", focinho: "#a4a7a0", nariz: null },
    coelho: { pele: "#f3ede4", focinho: "#ffffff", nariz: "#f08aa0" },
  };

  /* Tronco: perfil girado, barrigudo embaixo e estreito nos ombros. */
  function tronco(material) {
    const perfil = [[0.3, 0], [0.38, 0.08], [0.41, 0.2], [0.39, 0.34], [0.33, 0.45], [0.2, 0.52], [0.12, 0.54]]
      .map(([r, y]) => new THREE.Vector2(r, y));
    return malha(new THREE.LatheGeometry(perfil, 28), material);
  }

  function mascote(t, texturas) {
    const b = BICHOS[t.bicho] || BICHOS.urso;
    const pele = t.bicho === "tigre" ? mat("#ffffff", { map: texturas.tigre }) : mat(b.pele);
    const peleLisa = mat(b.pele);
    const mao = b.mao ? mat(b.mao) : peleLisa;
    const camisa = mat("#ffffff", { map: Texturas.camisa(t), roughness: 0.78 });
    const manga = mat(t.padrao === "mangas" ? t.cor2 : t.padrao === "listras" || t.padrao === "horiz" ? t.cor2 : t.cor, { roughness: 0.78 });
    const calcao = mat(t.calcao, { roughness: 0.78 });
    const meiao = mat(t.calcao === "#ffffff" ? t.cor : t.calcao === "#111111" || t.calcao === "#151515" ? "#f4f4f4" : t.calcao, { roughness: 0.8 });
    const chuteira = mat("#1a1a1e", { roughness: 0.45 });
    const solado = mat("#f4f4f4", { roughness: 0.5 });
    const branco = mat("#ffffff", { roughness: 0.25 });
    const preto = mat("#141418", { roughness: 0.3 });
    const boca = mat("#4a1418", { roughness: 0.5 });

    const raiz = grupo(null);
    const corpo = grupo(raiz);
    const quadril = grupo(corpo, 0, 0.44, 0);

    const pernas = [-1, 1].map(lado => {
      const coxa = grupo(quadril, lado * 0.16, 0, 0);
      membro(coxa, 0.1, 0.12, peleLisa);
      const canela = malha(new THREE.CylinderGeometry(0.105, 0.095, 0.2, 12), meiao, 0, -0.26, 0);
      coxa.add(canela);
      const pe = grupo(coxa, 0, -0.38, 0);
      bola(pe, 0.13, chuteira, [0, 0.0, 0.06], [0.95, 0.55, 1.45]);
      bola(pe, 0.13, solado, [0, -0.045, 0.06], [1, 0.22, 1.5]);
      return { coxa, pe };
    });
    const short = malha(new THREE.CylinderGeometry(0.36, 0.33, 0.24, 24), calcao, 0, 0.02, 0);
    quadril.add(short);

    const peito = grupo(quadril, 0, 0.1, 0);
    peito.add(tronco(camisa));

    const bracos = [-1, 1].map(lado => {
      const ombro = grupo(peito, lado * 0.36, 0.42, 0);
      bola(ombro, 0.14, manga, [0, -0.02, 0], [1, 1, 1]);
      const cotovelo = grupo(ombro, 0, -0.08, 0);
      membro(cotovelo, 0.085, 0.16, mao);
      bola(cotovelo, 0.115, mao, [0, -0.3, 0]);
      ombro.rotation.z = lado * 0.35;
      return { ombro, cotovelo, lado };
    });

    const pescoco = grupo(peito, 0, 0.5, 0);
    const cabeca = grupo(pescoco, 0, 0.36, 0);
    const cranio = bola(cabeca, 0.44, pele, [0, 0, 0], [1.04, 0.96, 0.98], 28);
    if (t.bicho === "tigre") cranio.rotation.y = Math.PI;

    /* Olhos grandes de desenho: branco, pupila (a cena mexe) e brilho. */
    const olhos = [-1, 1].map(lado => {
      const g = grupo(cabeca, lado * 0.16, 0.07, 0.35);
      const branco_ = bola(g, 0.12, branco, [0, 0, 0], [0.9, 1.05, 0.62]);
      const pupila = grupo(g, 0, 0, 0.055);
      bola(pupila, 0.062, preto, [0, 0, 0], [1, 1.1, 0.6]);
      bola(pupila, 0.02, branco, [0.022, 0.03, 0.03], [1, 1, 0.5], 8);
      return { g, branco: branco_, pupila, lado };
    });
    const sobrancelhas = [-1, 1].map(lado => {
      const s = malha(new THREE.CapsuleGeometry(0.025, 0.1, 3, 6), mat(t.bicho === "panda" || t.bicho === "coelho" ? "#2a2a2e" : "#2a1810"), lado * 0.16, 0.23, 0.39);
      s.rotation.z = Math.PI / 2;
      cabeca.add(s);
      return s;
    });

    let bocaY = -0.15, bocaZ = 0.4;
    const f = b.focinho ? mat(b.focinho) : null;
    const nariz = b.nariz ? mat(b.nariz, { roughness: 0.3 }) : null;
    const orelhasRedondas = (r, y, abre, dentro) => [-1, 1].map(l => {
      const o = bola(cabeca, r, peleLisa, [l * abre, y, -0.04], [1, 1, 0.55]);
      if (dentro) bola(o, r * 0.62, mat(dentro), [0, 0, 0.5 * r], [1, 1, 0.5]);
      return o;
    });

    switch (t.bicho) {
      case "urso":
        orelhasRedondas(0.14, 0.33, 0.3, "#5e3a20");
        bola(cabeca, 0.2, f, [0, -0.1, 0.32], [1.1, 0.8, 0.8]);
        bola(cabeca, 0.07, nariz, [0, -0.04, 0.48], [1.3, 0.9, 0.8]);
        bocaZ = 0.46; bocaY = -0.17;
        break;
      case "leao": {
        const juba = mat("#a8521c", { roughness: 0.85 });
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          bola(cabeca, 0.17, juba, [Math.sin(a) * 0.42, Math.cos(a) * 0.4 + 0.02, -0.08], [1, 1, 0.8], 10);
        }
        bola(cabeca, 0.4, juba, [0, 0.02, -0.16], [1.15, 1.1, 0.8]);
        orelhasRedondas(0.1, 0.36, 0.26, "#c4782e");
        bola(cabeca, 0.19, f, [0, -0.11, 0.32], [1.15, 0.8, 0.8]);
        bola(cabeca, 0.065, nariz, [0, -0.03, 0.48], [1.4, 0.9, 0.8]);
        bocaZ = 0.46; bocaY = -0.18;
        break;
      }
      case "elefante": {
        for (const l of [-1, 1]) {
          const o = bola(cabeca, 0.3, peleLisa, [l * 0.44, 0.02, -0.06], [0.22, 1.15, 0.95]);
          o.rotation.y = l * 0.5;
          bola(cabeca, 0.24, mat("#d7a9b3"), [l * 0.47, 0.0, 0.0], [0.12, 1.0, 0.8]).rotation.y = l * 0.5;
        }
        let p = grupo(cabeca, 0, -0.05, 0.36);
        for (let i = 0; i < 4; i++) {
          bola(p, 0.1 - i * 0.012, peleLisa, [0, 0, 0], [1, 1, 1], 12);
          p = grupo(p, 0, -0.1, 0.05);
          p.rotation.x = 0.28;
        }
        bola(p, 0.075, peleLisa, [0, 0, 0.02], [1, 0.8, 1], 12);
        for (const l of [-1, 1]) cone(cabeca, 0.03, 0.16, branco, [l * 0.13, -0.2, 0.33], [1.9, 0, -l * 0.4]);
        bocaY = -0.22; bocaZ = 0.3;
        break;
      }
      case "panda": {
        const pretoPanda = mat("#1b1b1f");
        orelhasRedondas(0.14, 0.33, 0.3, null).forEach(o => { o.material = pretoPanda; });
        for (const l of [-1, 1]) {
          const m = bola(cabeca, 0.15, pretoPanda, [l * 0.16, 0.05, 0.31], [0.85, 1.15, 0.55]);
          m.rotation.z = l * 0.5;
        }
        bola(cabeca, 0.17, f, [0, -0.12, 0.33], [1.1, 0.75, 0.8]);
        bola(cabeca, 0.065, nariz, [0, -0.06, 0.47], [1.3, 0.9, 0.8]);
        bocaZ = 0.45; bocaY = -0.19;
        break;
      }
      case "pinguim": {
        bola(cabeca, 0.38, mat("#ffffff"), [0, -0.05, 0.12], [0.95, 0.85, 0.85]);
        const bico = mat("#ffa31a", { roughness: 0.4 });
        cone(cabeca, 0.09, 0.22, bico, [0, -0.08, 0.5], [Math.PI / 2, 0, 0]);
        bocaY = -0.2; bocaZ = 0.42;
        break;
      }
      case "hipopotamo": {
        orelhasRedondas(0.07, 0.36, 0.24, "#7a688c");
        bola(cabeca, 0.27, f, [0, -0.14, 0.27], [1.25, 0.85, 0.95]);
        for (const l of [-1, 1]) bola(cabeca, 0.04, mat("#5b4870"), [l * 0.1, -0.04, 0.52], [1.2, 0.8, 0.5], 8);
        bocaY = -0.26; bocaZ = 0.5;
        break;
      }
      case "gato": {
        const dentro = mat("#f4a3b5");
        for (const l of [-1, 1]) {
          cone(cabeca, 0.13, 0.26, peleLisa, [l * 0.25, 0.38, -0.02], [0, 0, -l * 0.35]);
          cone(cabeca, 0.075, 0.16, dentro, [l * 0.24, 0.37, 0.04], [0, 0, -l * 0.35]);
        }
        bola(cabeca, 0.15, f, [0, -0.12, 0.34], [1.2, 0.75, 0.7]);
        bola(cabeca, 0.045, nariz, [0, -0.05, 0.46], [1.3, 0.9, 0.8]);
        const fio = mat("#ffffff");
        for (const l of [-1, 1]) for (const k of [-1, 1]) {
          const w = malha(new THREE.CylinderGeometry(0.006, 0.006, 0.26, 4), fio, l * 0.24, -0.1 + k * 0.03, 0.38);
          w.rotation.z = Math.PI / 2 + l * k * 0.12;
          cabeca.add(w);
        }
        for (let i = 0; i < 3; i++) bola(cabeca, 0.06, mat("#7d7e86"), [(i - 1) * 0.1, 0.36, 0.12], [0.5, 0.25, 1], 8);
        bocaZ = 0.45; bocaY = -0.18;
        break;
      }
      case "coala":
        for (const l of [-1, 1]) {
          const o = bola(cabeca, 0.2, peleLisa, [l * 0.38, 0.24, -0.04], [1, 1, 0.5]);
          bola(o, 0.14, mat("#eef0f2", { roughness: 0.9 }), [0, -0.01, 0.12], [1, 1, 0.5]);
        }
        bola(cabeca, 0.12, nariz, [0, -0.06, 0.42], [0.85, 1.25, 0.7]);
        bocaY = -0.22; bocaZ = 0.4;
        break;
      case "tigre":
        orelhasRedondas(0.11, 0.35, 0.28, "#fff5e8");
        for (const l of [-1, 1]) bola(cabeca, 0.14, f, [l * 0.09, -0.13, 0.32], [1, 0.8, 0.8]);
        bola(cabeca, 0.055, nariz, [0, -0.06, 0.45], [1.4, 0.9, 0.8]);
        bocaZ = 0.44; bocaY = -0.19;
        break;
      case "touro": {
        const chifre = mat("#f1e6c8", { roughness: 0.4 });
        for (const l of [-1, 1]) {
          const base = grupo(cabeca, l * 0.32, 0.26, 0);
          base.rotation.z = -l * 1.1;
          membro(base, 0.06, 0.12, chifre).position.y = 0.08;
          const ponta = cone(base, 0.055, 0.18, chifre, [l * -0.06, 0.26, 0], [0, 0, l * 0.6]);
          ponta.castShadow = true;
        }
        for (const l of [-1, 1]) bola(cabeca, 0.1, peleLisa, [l * 0.42, 0.12, -0.04], [1, 0.5, 0.6]);
        bola(cabeca, 0.24, f, [0, -0.15, 0.3], [1.2, 0.75, 0.85]);
        for (const l of [-1, 1]) bola(cabeca, 0.035, mat("#5a2c22"), [l * 0.1, -0.1, 0.5], [1, 1.2, 0.5], 8);
        const argola = malha(new THREE.TorusGeometry(0.06, 0.016, 8, 18), mat("#f2c641", { metalness: 0.8, roughness: 0.25 }), 0, -0.2, 0.5);
        cabeca.add(argola);
        bocaY = -0.27; bocaZ = 0.44;
        break;
      }
      case "rinoceronte": {
        for (const l of [-1, 1]) cone(cabeca, 0.07, 0.2, peleLisa, [l * 0.26, 0.38, -0.05], [0, 0, -l * 0.3]);
        bola(cabeca, 0.24, f, [0, -0.12, 0.3], [1.05, 0.8, 1.05]);
        const chifre = mat("#ece3cc", { roughness: 0.4 });
        cone(cabeca, 0.09, 0.3, chifre, [0, 0.04, 0.5], [0.5, 0, 0]);
        cone(cabeca, 0.05, 0.14, chifre, [0, 0.12, 0.38], [0.4, 0, 0]);
        for (const l of [-1, 1]) bola(cabeca, 0.03, mat("#3a3c38"), [l * 0.09, -0.15, 0.53], [1, 1.2, 0.5], 8);
        bocaY = -0.26; bocaZ = 0.46;
        break;
      }
      case "coelho": {
        const dentro = mat("#f6a7bb");
        for (const l of [-1, 1]) {
          const base = grupo(cabeca, l * 0.15, 0.32, -0.04);
          base.rotation.z = -l * 0.18;
          base.rotation.x = -0.12;
          const o = malha(new THREE.CapsuleGeometry(0.08, 0.38, 4, 10), peleLisa, 0, 0.26, 0);
          o.scale.z = 0.6;
          base.add(o);
          const d = malha(new THREE.CapsuleGeometry(0.045, 0.3, 4, 8), dentro, 0, 0.26, 0.04);
          d.scale.z = 0.4;
          base.add(d);
        }
        bola(cabeca, 0.15, f, [0, -0.12, 0.33], [1.2, 0.75, 0.7]);
        bola(cabeca, 0.045, nariz, [0, -0.05, 0.46], [1.3, 0.9, 0.8]);
        for (const l of [-1, 1]) {
          const d = malha(new THREE.BoxGeometry(0.05, 0.07, 0.02), branco, l * 0.028, -0.25, 0.43);
          cabeca.add(d);
        }
        bocaZ = 0.44; bocaY = -0.19;
        break;
      }
    }

    const bocaM = bola(cabeca, 0.1, boca, [0, bocaY, bocaZ], [1, 0.4, 0.45], 14);

    /* Coroa de quem mais empurrou pelo time: escondida até ter dono. */
    const coroa = grupo(cabeca, 0, 0.5, 0);
    const ouro = mat("#ffc83a", { metalness: 0.85, roughness: 0.28, emissive: "#5a3a00", emissiveIntensity: 0.4 });
    coroa.add(malha(new THREE.CylinderGeometry(0.2, 0.18, 0.1, 18, 1, true), ouro));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      cone(coroa, 0.05, 0.13, ouro, [Math.sin(a) * 0.19, 0.11, Math.cos(a) * 0.19]);
      bola(coroa, 0.025, mat(["#ff3b5c", "#2fd0ff", "#7cff5a"][i % 3], { roughness: 0.2 }), [Math.sin(a) * 0.2, 0.0, Math.cos(a) * 0.2], [1, 1, 1], 8);
    }
    coroa.visible = false;

    raiz.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return { raiz, corpo, quadril, pernas, peito, bracos, pescoco, cabeca, olhos, sobrancelhas, boca: bocaM, coroa, camisa, ALTURA: 1.75 };
  }

  /* ───────── juiz ───────── */

  /* Gordinho de preto, careca com topete do lado, bigode, apito no
     cordão e o cartão escondido na mão direita (a cena troca a cor). */
  function juiz() {
    const pele = mat("#e2a67c");
    const preto = mat("#17181c", { roughness: 0.8 });
    const branco = mat("#ffffff", { roughness: 0.25 });
    const pupilaM = mat("#141418", { roughness: 0.3 });
    const cabelo = mat("#3a3a40", { roughness: 0.9 });
    const prata = mat("#d8dde4", { metalness: 0.9, roughness: 0.25 });

    const raiz = grupo(null);
    const corpo = grupo(raiz);
    const quadril = grupo(corpo, 0, 0.5, 0);
    const pernas = [-1, 1].map(lado => {
      const coxa = grupo(quadril, lado * 0.17, 0, 0);
      membro(coxa, 0.1, 0.16, pele);
      coxa.add(malha(new THREE.CylinderGeometry(0.105, 0.095, 0.24, 12), preto, 0, -0.3, 0));
      const pe = grupo(coxa, 0, -0.44, 0);
      bola(pe, 0.13, preto, [0, 0, 0.06], [0.95, 0.55, 1.45]);
      bola(pe, 0.13, branco, [0, -0.045, 0.06], [1, 0.22, 1.5]);
      return { coxa, pe };
    });
    quadril.add(malha(new THREE.CylinderGeometry(0.4, 0.36, 0.24, 24), preto, 0, 0.02, 0));
    const peito = grupo(quadril, 0, 0.1, 0);
    bola(peito, 0.52, preto, [0, 0.26, 0.02], [1, 0.95, 1.02], 24);
    bola(peito, 0.44, preto, [0, 0.5, 0], [0.86, 0.6, 0.8], 20);
    const gola = malha(new THREE.TorusGeometry(0.17, 0.035, 8, 20), branco, 0, 0.74, 0.02);
    gola.rotation.x = Math.PI / 2;
    peito.add(gola);
    const cordao = malha(new THREE.TorusGeometry(0.2, 0.012, 6, 24, Math.PI), mat("#e03030"), 0, 0.73, 0.18);
    cordao.rotation.set(Math.PI * 0.62, 0, Math.PI);
    peito.add(cordao);
    const apito = grupo(peito, 0, 0.55, 0.46);
    apito.add(malha(new THREE.CylinderGeometry(0.035, 0.035, 0.09, 10), prata));
    apito.children[0].rotation.z = Math.PI / 2;

    const bracos = [-1, 1].map(lado => {
      const ombro = grupo(peito, lado * 0.46, 0.55, 0);
      bola(ombro, 0.14, preto, [0, 0, 0]);
      const cotovelo = grupo(ombro, 0, -0.08, 0);
      membro(cotovelo, 0.085, 0.2, pele);
      const mao = grupo(cotovelo, 0, -0.34, 0);
      bola(mao, 0.11, pele, [0, 0, 0]);
      ombro.rotation.z = lado * 0.3;
      return { ombro, cotovelo, mao, lado };
    });
    const cartao = malha(new THREE.BoxGeometry(0.2, 0.28, 0.012), mat("#ffd21a", { roughness: 0.4, emissive: "#000000" }), 0, -0.14, 0.04);
    bracos[1].mao.add(cartao);
    cartao.visible = false;

    const pescoco = grupo(peito, 0, 0.76, 0);
    const cabeca = grupo(pescoco, 0, 0.26, 0);
    bola(cabeca, 0.32, pele, [0, 0, 0], [1, 1.02, 0.98], 26);
    for (const l of [-1, 1]) {
      bola(cabeca, 0.14, cabelo, [l * 0.26, 0.02, -0.08], [0.5, 0.8, 1]);
      bola(cabeca, 0.07, pele, [l * 0.32, -0.02, 0], [0.5, 1, 0.8]);
    }
    bola(cabeca, 0.06, pele, [0, -0.04, 0.32], [1, 1, 0.9]);
    const bigode = bola(cabeca, 0.12, cabelo, [0, -0.12, 0.28], [1.25, 0.35, 0.5]);
    bigode.rotation.x = -0.2;
    const olhos = [-1, 1].map(lado => {
      const g = grupo(cabeca, lado * 0.11, 0.06, 0.27);
      const b = bola(g, 0.06, branco, [0, 0, 0], [0.9, 1, 0.6]);
      const pupila = grupo(g, 0, 0, 0.03);
      bola(pupila, 0.032, pupilaM, [0, 0, 0], [1, 1, 0.6], 10);
      return { g, branco: b, pupila, lado };
    });
    const sobrancelhas = [-1, 1].map(lado => {
      const s = malha(new THREE.CapsuleGeometry(0.022, 0.08, 3, 6), cabelo, lado * 0.11, 0.16, 0.29);
      s.rotation.z = Math.PI / 2;
      cabeca.add(s);
      return s;
    });
    const boca = bola(cabeca, 0.06, mat("#5a1a18"), [0, -0.19, 0.27], [1, 0.4, 0.4], 12);

    raiz.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return { raiz, corpo, quadril, pernas, peito, bracos, pescoco, cabeca, olhos, sobrancelhas, boca, apito, cartao, ALTURA: 1.9 };
  }

  return { mascote, juiz, mat, malha, grupo, bola };
})();
