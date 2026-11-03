/* Davi e Golias montados por código com as geometrias do three.js: cada
   junta é um grupo (quadril, coxa, joelho, ombro, cotovelo, pescoço) e a
   pose sai de poucos números por quadro. Os dois nascem de frente pro +z,
   com o pé no zero. Medidas em metros do Davi; o Golias é montado em
   tamanho de gente forte e a cena escala o grupo. */
"use strict";

const Personagens = (() => {
  const mat = (cor, o = {}) => new THREE.MeshStandardMaterial({ color: cor, roughness: 0.75, metalness: 0, ...o });

  function malha(geo, material, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  function grupo(pai, x = 0, y = 0, z = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    if (pai) pai.add(g);
    return g;
  }

  /* Membro pendurado na junta: cápsula descendo `comp` a partir do pivô. */
  function membro(pai, raio, comp, material, seg = 10) {
    const m = malha(new THREE.CapsuleGeometry(raio, comp, 4, seg), material, 0, -comp / 2, 0);
    pai.add(m);
    return m;
  }

  function esfera(raio, material, seg = 16) {
    return malha(new THREE.SphereGeometry(raio, seg, Math.max(8, Math.round(seg * 0.75))), material);
  }

  /* ───────────────────────── Davi ───────────────────────── */

  function davi() {
    const pele = mat("#c98552", { roughness: 0.62 });
    const linho = mat("#ecd6a4", { roughness: 0.92 });
    const linhoSombra = mat("#c9ab72", { roughness: 0.95 });
    const couro = mat("#6e4122", { roughness: 0.8 });
    const cabelo = mat("#2b1a10", { roughness: 0.9 });
    const tiara = mat("#c2362b", { roughness: 0.7 });
    const branco = mat("#ffffff", { roughness: 0.3 });
    const iris = mat("#3a2210", { roughness: 0.25 });
    const sobr = mat("#24150c", { roughness: 0.9 });
    const boca = mat("#6b2a1e", { roughness: 0.6 });

    const raiz = grupo(null);
    const corpo = grupo(raiz);
    const quadril = grupo(corpo, 0, 0.7, 0);

    const pernas = [-1, 1].map(lado => {
      const coxa = grupo(quadril, lado * 0.085, 0, 0);
      membro(coxa, 0.054, 0.3, pele);
      const joelho = grupo(coxa, 0, -0.33, 0);
      membro(joelho, 0.048, 0.29, pele);
      const pe = grupo(joelho, 0, -0.33, 0);
      pe.add(malha(new THREE.BoxGeometry(0.09, 0.035, 0.19), couro, 0, -0.02, 0.035));
      const tira = malha(new THREE.TorusGeometry(0.05, 0.009, 6, 12), couro, 0, -0.26, 0);
      tira.rotation.x = Math.PI / 2;
      joelho.add(tira);
      return { coxa, joelho, pe };
    });

    const tronco = grupo(quadril);
    const saia = new THREE.LatheGeometry([
      new THREE.Vector2(0.001, -0.3), new THREE.Vector2(0.2, -0.3), new THREE.Vector2(0.185, -0.18),
      new THREE.Vector2(0.16, 0), new THREE.Vector2(0.165, 0.16), new THREE.Vector2(0.17, 0.26),
      new THREE.Vector2(0.12, 0.35), new THREE.Vector2(0.06, 0.39), new THREE.Vector2(0.001, 0.4),
    ], 18);
    const tunica = malha(saia, linho);
    tunica.scale.set(1, 1, 0.82);
    tronco.add(tunica);
    const barra = malha(new THREE.TorusGeometry(0.195, 0.014, 6, 24), linhoSombra, 0, -0.29, 0);
    barra.rotation.x = Math.PI / 2;
    barra.scale.set(1, 0.82, 1);
    tronco.add(barra);
    const cinto = malha(new THREE.TorusGeometry(0.162, 0.024, 8, 24), couro, 0, 0.0, 0);
    cinto.rotation.x = Math.PI / 2;
    cinto.scale.set(1, 0.82, 1);
    tronco.add(cinto);
    const alca = malha(new THREE.TorusGeometry(0.2, 0.012, 6, 28), couro, 0, 0.16, 0);
    alca.rotation.set(0.05, Math.PI / 2, 0.75);
    alca.scale.set(0.82, 1, 1);
    tronco.add(alca);
    const bolsa = esfera(0.07, couro, 12);
    bolsa.scale.set(1, 1.15, 0.6);
    bolsa.position.set(-0.17, -0.06, 0.04);
    tronco.add(bolsa);
    const pedras = grupo(bolsa);
    const pescoco = malha(new THREE.CylinderGeometry(0.042, 0.048, 0.1, 10), pele, 0, 0.42, 0);
    tronco.add(pescoco);

    const cabeca = grupo(tronco, 0, 0.53, 0);
    const cranio = esfera(0.15, pele, 28);
    cranio.scale.set(1, 1.06, 0.97);
    cabeca.add(cranio);
    const queixo = esfera(0.1, pele, 18);
    queixo.scale.set(1, 0.8, 1);
    queixo.position.set(0, -0.06, 0.04);
    cabeca.add(queixo);
    for (const lado of [-1, 1]) {
      const orelha = esfera(0.032, pele, 10);
      orelha.scale.set(0.5, 1, 0.8);
      orelha.position.set(lado * 0.148, 0, -0.005);
      cabeca.add(orelha);
    }
    const olhos = [-1, 1].map(lado => {
      const g = grupo(cabeca, lado * 0.056, 0.012, 0.118);
      const b = esfera(0.036, branco, 16);
      b.scale.set(1, 1.18, 0.6);
      g.add(b);
      const i = esfera(0.022, iris, 12);
      i.scale.set(1, 1.1, 0.55);
      i.position.set(lado * -0.004, -0.004, 0.018);
      g.add(i);
      const luz = esfera(0.0075, branco, 6);
      luz.material = new THREE.MeshBasicMaterial({ color: 0xffffff });
      luz.position.set(0.009, 0.01, 0.031);
      g.add(luz);
      return g;
    });
    const sobrancelhas = [-1, 1].map(lado => {
      const s = malha(new THREE.BoxGeometry(0.056, 0.014, 0.016), sobr, lado * 0.058, 0.072, 0.13);
      cabeca.add(s);
      return s;
    });
    const nariz = esfera(0.022, pele, 10);
    nariz.scale.set(1, 0.9, 0.9);
    nariz.position.set(0, -0.025, 0.148);
    cabeca.add(nariz);
    const sorriso = malha(new THREE.TorusGeometry(0.03, 0.008, 6, 14, Math.PI), boca, 0, -0.07, 0.13);
    sorriso.rotation.z = Math.PI;
    cabeca.add(sorriso);
    const rnd = Texturas.sorteio(3);
    for (let i = 0; i < 22; i++) {
      const a = rnd() * Math.PI * 2;
      const alto = 0.25 + rnd() * 0.75;
      const x = Math.cos(a) * 0.14 * Math.sqrt(1 - alto * alto * 0.6);
      const z = Math.sin(a) * 0.14 * Math.sqrt(1 - alto * alto * 0.6) - 0.02;
      if (z > 0.07 && alto < 0.7) continue;
      const cacho = esfera(0.045 + rnd() * 0.03, cabelo, 10);
      cacho.position.set(x, 0.02 + alto * 0.13, z);
      cabeca.add(cacho);
    }
    const faixa = malha(new THREE.TorusGeometry(0.152, 0.017, 8, 28), tiara, 0, 0.06, -0.005);
    faixa.rotation.x = Math.PI / 2 - 0.12;
    cabeca.add(faixa);
    const ponta = malha(new THREE.BoxGeometry(0.03, 0.12, 0.012), tiara, 0.03, 0.0, -0.16);
    ponta.rotation.z = 0.4;
    cabeca.add(ponta);

    const bracos = [-1, 1].map(lado => {
      const ombro = grupo(tronco, lado * 0.185, 0.31, 0);
      membro(ombro, 0.044, 0.21, pele);
      const manga = esfera(0.065, linho, 12);
      manga.scale.set(1, 0.9, 0.95);
      ombro.add(manga);
      const cotovelo = grupo(ombro, 0, -0.24, 0);
      membro(cotovelo, 0.039, 0.19, pele);
      const mao = esfera(0.047, pele, 12);
      mao.position.y = -0.23;
      cotovelo.add(mao);
      return { ombro, cotovelo, mao };
    });

    return {
      raiz, corpo, quadril, tronco, cabeca, pernas, bracos, olhos, sobrancelhas, sorriso, pedras, bolsa,
      materiais: { pele, couro },
    };
  }

  /* ───────────────────────── Golias ───────────────────────── */

  function golias(texEscamas) {
    const pele = mat("#c47e4e", { roughness: 0.62 });
    const bronze = mat("#b98140", { roughness: 0.32, metalness: 0.85 });
    const bronzeEscuro = mat("#7d5326", { roughness: 0.4, metalness: 0.8 });
    const escamas = mat("#c99248", { roughness: 0.3, metalness: 0.9, map: texEscamas, bumpMap: texEscamas, bumpScale: 1.2 });
    const couro = mat("#4a2c18", { roughness: 0.85 });
    const tecido = mat("#7c1f1a", { roughness: 0.9 });
    const barba = mat("#1f130c", { roughness: 0.95 });
    const branco = mat("#fff4e2", { roughness: 0.4, emissive: "#4a3a2a" });
    const pupila = mat("#120806", { roughness: 0.3 });
    const crina = mat("#a8231b", { roughness: 0.95 });
    const ouro = mat("#ffcc33", { roughness: 0.22, metalness: 1, emissive: "#6a4300", emissiveIntensity: 0.35 });
    const joia = mat("#e3182d", { roughness: 0.15, metalness: 0.2, emissive: "#5a0008", emissiveIntensity: 0.6 });
    const madeira = mat("#5a3a20", { roughness: 0.8 });

    const raiz = grupo(null);
    const corpo = grupo(raiz);
    const quadril = grupo(corpo, 0, 0.98, 0);

    const pernas = [-1, 1].map(lado => {
      const coxa = grupo(quadril, lado * 0.15, -0.02, 0);
      membro(coxa, 0.13, 0.36, pele, 12);
      const joelho = grupo(coxa, 0, -0.44, 0);
      membro(joelho, 0.11, 0.34, pele, 12);
      const caneleira = malha(new THREE.CylinderGeometry(0.13, 0.12, 0.3, 12, 1, true), bronze, 0, -0.2, 0.01);
      joelho.add(caneleira);
      const joelheira = esfera(0.12, bronze, 12);
      joelheira.scale.set(1, 0.8, 0.7);
      joelheira.position.set(0, 0, 0.05);
      joelho.add(joelheira);
      const pe = grupo(joelho, 0, -0.44, 0);
      pe.add(malha(new THREE.BoxGeometry(0.2, 0.1, 0.34), couro, 0, -0.03, 0.07));
      return { coxa, joelho, pe };
    });

    const saia = grupo(quadril, 0, -0.04, 0);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const tira = malha(new THREE.BoxGeometry(0.1, 0.36, 0.03), i % 2 ? couro : tecido, 0, 0, 0);
      const g = grupo(saia, Math.sin(a) * 0.27, 0, Math.cos(a) * 0.22);
      g.rotation.y = a;
      tira.position.y = -0.17;
      tira.rotation.x = 0.16;
      g.add(tira);
      const rebite = esfera(0.02, bronze, 6);
      rebite.position.set(0, -0.3, 0.06);
      g.add(rebite);
    }

    const tronco = grupo(quadril, 0, 0.04, 0);
    /* Tronco em V: cintura fina no cinto, peito largo em cima. */
    const peito = malha(new THREE.LatheGeometry([
      new THREE.Vector2(0.001, -0.02), new THREE.Vector2(0.25, -0.02), new THREE.Vector2(0.23, 0.1),
      new THREE.Vector2(0.27, 0.26), new THREE.Vector2(0.36, 0.44), new THREE.Vector2(0.41, 0.58),
      new THREE.Vector2(0.37, 0.68), new THREE.Vector2(0.24, 0.74), new THREE.Vector2(0.001, 0.77),
    ], 24), escamas);
    peito.scale.set(1.12, 1, 0.78);
    escamas.map.repeat.set(6, 3);
    tronco.add(peito);
    const cinto = malha(new THREE.TorusGeometry(0.255, 0.055, 8, 26), couro, 0, 0.04, 0);
    cinto.rotation.x = Math.PI / 2;
    cinto.scale.set(1.12, 0.78, 1.4);
    tronco.add(cinto);
    const fivela = malha(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 16), bronze, 0, 0.04, 0.215);
    fivela.rotation.x = Math.PI / 2;
    tronco.add(fivela);
    const gola = malha(new THREE.TorusGeometry(0.2, 0.045, 8, 22), bronzeEscuro, 0, 0.72, 0);
    gola.rotation.x = Math.PI / 2;
    gola.scale.set(1.1, 0.85, 1);
    tronco.add(gola);

    const placa = Texturas.placa();
    const plaquinha = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.17),
      new THREE.MeshStandardMaterial({ map: placa.textura, roughness: 0.45, metalness: 0.35, transparent: true }));
    plaquinha.position.set(0, 0.4, 0.29);
    plaquinha.rotation.x = -0.12;
    tronco.add(plaquinha);

    const pescoco = malha(new THREE.CylinderGeometry(0.1, 0.13, 0.16, 12), pele, 0, 0.8, 0);
    tronco.add(pescoco);
    const cabeca = grupo(tronco, 0, 0.94, 0.02);
    const cranio = esfera(0.17, pele, 24);
    cranio.scale.set(1, 1.08, 1);
    cabeca.add(cranio);
    const mandibula = esfera(0.14, pele, 16);
    mandibula.scale.set(1.05, 0.8, 1);
    mandibula.position.set(0, -0.07, 0.03);
    cabeca.add(mandibula);
    const barbaGeo = new THREE.LatheGeometry([
      new THREE.Vector2(0.001, -0.3), new THREE.Vector2(0.06, -0.27), new THREE.Vector2(0.13, -0.17),
      new THREE.Vector2(0.155, -0.06), new THREE.Vector2(0.15, 0.0), new THREE.Vector2(0.001, 0.0),
    ], 14);
    const barbaMalha = malha(barbaGeo, barba, 0, -0.03, 0.06);
    barbaMalha.scale.set(1, 1, 0.75);
    cabeca.add(barbaMalha);
    const boca = esfera(0.05, mat("#2a0b06", { roughness: 0.9 }), 10);
    boca.scale.set(1, 0.2, 0.5);
    boca.position.set(0, -0.095, 0.15);
    cabeca.add(boca);
    const bigode = malha(new THREE.TorusGeometry(0.06, 0.02, 6, 12, Math.PI), barba, 0, -0.06, 0.155);
    cabeca.add(bigode);
    const nariz = esfera(0.04, pele, 10);
    nariz.scale.set(0.9, 1, 1.1);
    nariz.position.set(0, -0.015, 0.17);
    cabeca.add(nariz);
    const olhos = [-1, 1].map(lado => {
      const g = grupo(cabeca, lado * 0.062, 0.025, 0.142);
      const b = esfera(0.036, branco, 12);
      b.scale.set(1.25, 0.85, 0.5);
      g.add(b);
      const p = esfera(0.016, pupila, 8);
      p.position.set(0, 0, 0.012);
      g.add(p);
      return g;
    });
    const sobrancelhas = [-1, 1].map(lado => {
      const s = malha(new THREE.BoxGeometry(0.085, 0.026, 0.03), barba, lado * 0.06, 0.062, 0.16);
      s.rotation.z = lado * 0.42;
      cabeca.add(s);
      return s;
    });

    const elmo = grupo(cabeca, 0, 0.03, 0);
    const cupula = malha(new THREE.SphereGeometry(0.2, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), bronze);
    cupula.scale.set(1, 1.12, 1.05);
    elmo.add(cupula);
    const aro = malha(new THREE.TorusGeometry(0.2, 0.022, 8, 26), bronzeEscuro, 0, 0.0, 0);
    aro.rotation.x = Math.PI / 2;
    aro.scale.set(1, 1.05, 1);
    elmo.add(aro);
    const naseira = malha(new THREE.BoxGeometry(0.04, 0.15, 0.03), bronze, 0, -0.05, 0.2);
    elmo.add(naseira);
    for (const lado of [-1, 1]) {
      const bochecha = malha(new THREE.BoxGeometry(0.03, 0.17, 0.12), bronze, lado * 0.185, -0.09, 0.06);
      bochecha.rotation.z = -lado * 0.12;
      elmo.add(bochecha);
    }
    const crista = grupo(elmo, 0, 0.2, 0);
    for (let i = 0; i < 11; i++) {
      const a = -1.25 + i * 0.25;
      const pena = malha(new THREE.BoxGeometry(0.035, 0.16, 0.07), crina, 0, 0, 0);
      pena.position.set(0, Math.cos(a) * 0.06, Math.sin(a) * 0.16);
      pena.rotation.x = a;
      crista.add(pena);
    }

    const coroa = grupo(elmo, 0, 0.215, 0);
    const anel = malha(new THREE.CylinderGeometry(0.16, 0.15, 0.07, 20, 1, true), ouro);
    coroa.add(anel);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const pico = malha(new THREE.ConeGeometry(0.035, 0.12, 6), ouro, Math.sin(a) * 0.155, 0.09, Math.cos(a) * 0.155);
      coroa.add(pico);
      const pedra = esfera(0.022, joia, 8);
      pedra.position.set(Math.sin(a) * 0.162, 0, Math.cos(a) * 0.162);
      coroa.add(pedra);
    }
    coroa.visible = false;

    const bracos = [-1, 1].map(lado => {
      const ombro = grupo(tronco, lado * 0.42, 0.6, 0);
      const ombreira = malha(new THREE.SphereGeometry(0.17, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), bronze);
      ombreira.scale.set(1.1, 0.8, 1);
      ombreira.rotation.z = -lado * 0.35;
      ombro.add(ombreira);
      membro(ombro, 0.115, 0.34, pele, 12);
      const cotovelo = grupo(ombro, 0, -0.42, 0);
      membro(cotovelo, 0.1, 0.3, pele, 12);
      const bracadeira = malha(new THREE.CylinderGeometry(0.12, 0.13, 0.22, 12, 1, true), bronze, 0, -0.22, 0);
      cotovelo.add(bracadeira);
      const mao = esfera(0.12, pele, 12);
      mao.scale.set(1, 1.1, 0.95);
      mao.position.y = -0.42;
      cotovelo.add(mao);
      return { ombro, cotovelo, mao };
    });

    /* Lança na mão direita (lado -1), escudo no braço esquerdo. */
    const lanca = grupo(bracos[0].mao, 0, 0, 0.02);
    lanca.add(malha(new THREE.CylinderGeometry(0.035, 0.04, 3.2, 8), madeira, 0, 0.6, 0));
    const lamina = malha(new THREE.ConeGeometry(0.08, 0.36, 4), bronze, 0, 2.38, 0);
    lanca.add(lamina);
    lanca.add(malha(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 8), bronze, 0, 2.17, 0));
    lanca.rotation.x = Math.PI / 2;

    const escudo = grupo(bracos[1].cotovelo, 0.13, -0.2, 0.05);
    const disco = malha(new THREE.CylinderGeometry(0.48, 0.48, 0.05, 28), bronze);
    disco.rotation.z = Math.PI / 2;
    escudo.add(disco);
    const borda = malha(new THREE.TorusGeometry(0.48, 0.03, 8, 30), bronzeEscuro);
    borda.rotation.y = Math.PI / 2;
    escudo.add(borda);
    const umbo = esfera(0.12, bronze, 14);
    umbo.scale.set(0.5, 1, 1);
    umbo.position.x = -0.04;
    escudo.add(umbo);

    return {
      raiz, corpo, quadril, tronco, cabeca, pernas, bracos, olhos, sobrancelhas, boca, coroa, placa, lanca, escudo,
      materiais: { pele, bronze },
      ALTURA: 2.25,
    };
  }

  return { davi, golias };
})();
