/* O Zé: de costas, abraçado no coqueiro, subindo do jeito do tirador de coco
   do Nordeste (peconha nos pés). Esqueleto simples com IK de dois ossos em
   braços e pernas; a pose sai de um ciclo de escalada e de reações aos
   acontecimentos, misturadas por peso.

   O ciclo é o da peconha: mãos seguram enquanto os pés sobem juntos, depois
   os pés firmam e as mãos sobem uma de cada vez. Com o quadril parado na
   tela (a câmera segue ele), o que fica preso no tronco desliza pra baixo.

   Origem no quadril, unidade = px do palco antes da escala da cena. */
"use strict";

const ZE = {
  pele: "#A86A43", peleSombra: "#6E4026", peleLuz: "#D39A6C",
  cabelo: "#1C120C", contorno: "#24140B", sola: "#D6A27C",
  /* braço solto no plano da tela; abraçando o tronco ele aponta pra dentro
     da tela e encurta (escorço) */
  braco: [60, 56], bracoAbraco: [36, 40], perna: [60, 58],
  /* meia largura do tronco em unidades do Zé (60 px na tela ÷ escala 1.2) */
  tronco: 50,
};

const zeLerp = (a, b, t) => a + (b - a) * t;
const zeLim = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const zeSuave = t => t * t * (3 - 2 * t);

/* Cotovelo/joelho por IK de dois ossos. `lado` escolhe pra que lado dobra.
   Se o alvo está longe demais, o membro estica e o fim encosta no máximo. */
function zeIk(ax, ay, bx, by, l1, l2, lado) {
  let dx = bx - ax, dy = by - ay;
  let d = Math.hypot(dx, dy) || 0.001;
  const max = l1 + l2 - 0.5;
  if (d > max) { bx = ax + dx / d * max; by = ay + dy / d * max; dx = bx - ax; dy = by - ay; d = max; }
  d = Math.max(d, Math.abs(l1 - l2) + 0.5);
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const mx = ax + dx * a / d, my = ay + dy * a / d;
  return { jx: mx - lado * dy * h / d, jy: my + lado * dx * h / d, bx, by };
}

/* Cápsula afinando de A (raio ra) a B (raio rb). */
function zeCapsula(c, ax, ay, bx, by, ra, rb) {
  const ang = Math.atan2(by - ay, bx - ax);
  c.beginPath();
  c.arc(ax, ay, ra, ang + Math.PI / 2, ang - Math.PI / 2);
  c.arc(bx, by, rb, ang - Math.PI / 2, ang + Math.PI / 2);
  c.closePath();
}

/* Pose base: tudo que o desenho precisa, em números (pra misturar por peso). */
function zePoseBase() {
  return {
    hx: 0, hy: 0,                  // quadril
    nx: 0, ny: -98,                // base do pescoço
    cx: 0, cy: 0, giro: 0, incl: 0, // cabeça: deslocamento, virada (−1..1), inclinação
    meL: [-46, -150], meR: [46, -150], // mãos
    peL: [-38, 100], peR: [38, 100],   // pés
    agarra: 1,                     // 1 = dedos fechados no tronco, 0 = mão aberta
    soltoL: 0, soltoR: 0,          // 1 = braço solto (comprimento inteiro), 0 = abraçando
    chapeu: 0, chapeuGiro: 0,      // chapéu subindo e girando (voando)
    tremor: 0,
  };
}

function zeMistura(a, b, t) {
  if (t <= 0) return a;
  const s = {};
  for (const k of Object.keys(a)) {
    s[k] = Array.isArray(a[k]) ? [zeLerp(a[k][0], b[k][0], t), zeLerp(a[k][1], b[k][1], t)] : zeLerp(a[k], b[k], t);
  }
  return s;
}

const Ze = {
  tempo: 0,
  fase: 0,
  reacoes: [],
  proximaOlhada: 7,
  vel: 0,
  caindo: 0,
  balanco: 0,
  pontos: null,

  /* Reação com começo, duração e prioridade: a de maior prioridade ativa
     manda na pose e no rosto. */
  reagir(tipo, { dur = 1.2, atraso = 0, prio = 1 } = {}) {
    this.reacoes = this.reacoes.filter(r => r.tipo !== tipo);
    this.reacoes.push({ tipo, inicio: this.tempo + atraso, dur, prio });
  },

  quadro(dt, { vel, caindo, balanco }) {
    this.tempo += dt;
    this.vel = vel;
    this.caindo = caindo;
    this.balanco = balanco;
    this.reacoes = this.reacoes.filter(r => this.tempo < r.inicio + r.dur);
    /* Um ciclo de escalada sobe ~0,9 m; na subida rápida (escada) o ciclo
       tem teto pra não virar borrão. Parado ou descendo, as mãos firmam. */
    const ciclos = zeLim(vel / 0.9, 0, 2.6);
    this.fase = (this.fase + dt * ciclos) % 1;
    if (this.tempo > this.proximaOlhada) {
      if (!this.reacaoAtiva() && Math.abs(vel) < 2) this.reagir("olha", { dur: 1.8, prio: 0 });
      this.proximaOlhada = this.tempo + 8 + Math.random() * 6;
    }
  },

  reacaoAtiva() {
    let melhor = null;
    for (const r of this.reacoes) {
      if (this.tempo < r.inicio) continue;
      if (!melhor || r.prio > melhor.prio || (r.prio === melhor.prio && r.inicio > melhor.inicio)) melhor = r;
    }
    return melhor;
  },

  /* ───────────── poses ───────────── */

  poseEscalada() {
    const p = zePoseBase();
    const u = this.fase;
    /* Cada membro tem uma janela em que se solta e sobe; fora dela está preso
       no tronco e desliza pra baixo com a subida. */
    const membro = (r0, r1, topo, base) => {
      const solto = r1 - r0, preso = 1 - solto;
      const t = (u - r1 + 1) % 1;
      if (t < preso) return { y: zeLerp(topo, base, t / preso), solto: 0 };
      const k = zeSuave((t - preso) / solto);
      return { y: zeLerp(base, topo, k), solto: Math.sin(k * Math.PI) };
    };
    /* abraço de coala: mãos na altura da cabeça, nas laterais do tronco,
       cotovelos abertos e baixos */
    const pes = membro(0.02, 0.42, 62, 104);
    const mR = membro(0.5, 0.7, -172, -126);
    const mL = membro(0.68, 0.9, -172, -126);
    p.meR = [51 + mR.solto * 12, mR.y - mR.solto * 8];
    p.meL = [-51 - mL.solto * 12, mL.y - mL.solto * 8];
    /* pés juntos (a peconha prende um no outro), joelhos abrem quando sobem */
    const abre = zeLim((104 - pes.y) / 44);
    p.peL = [-34 - abre * 6, pes.y];
    p.peR = [34 + abre * 6, pes.y];
    /* corpo encolhe quando os pés sobem e estica quando as mãos sobem */
    const estica = zeLim((mR.solto + mL.solto) * 0.8);
    p.ny = -94 - estica * 8 + abre * 4;
    p.nx = (mR.solto - mL.solto) * 7;
    p.hx = Math.sin(u * Math.PI * 2) * 2.5;
    p.cy = estica * -2;
    p.incl = (mR.solto - mL.solto) * 0.06;
    return p;
  },

  posePara(tipo, k, t) {
    const p = zePoseBase();
    const s = Math.sin;
    switch (tipo) {
      case "olha":
        /* vira pro público por um instante: dá cara ao boneco */
        Object.assign(p, this.poseEscalada());
        p.giro = 0.72 * zeSuave(zeLim(k * 4)) * zeSuave(zeLim((1 - k) * 4));
        p.incl = -0.05;
        break;
      case "feliz":
        Object.assign(p, this.poseEscalada());
        p.giro = 0.75; p.cy = -4 + s(t * 18) * 2;
        break;
      case "comemora": {
        /* solta a mão direita e soca o ar, de cara pro público */
        p.meL = [-47, -150];
        const soco = s(t * 14) * 10;
        p.meR = [96, -236 + soco];
        p.soltoR = 1;
        p.giro = 0.8; p.incl = -0.12; p.nx = 6; p.ny = -102;
        p.peL = [-36, 96]; p.peR = [36, 96];
        p.chapeu = 6 + Math.max(0, soco); p.chapeuGiro = 0.1;
        break;
      }
      case "escorrega":
        /* abraça forte, pernas abertas e duras, olhando pra baixo */
        p.meL = [-46, -132]; p.meR = [46, -128];
        p.peL = [-78, 92]; p.peR = [78, 96];
        p.ny = -90; p.giro = -0.7; p.incl = 0.32; p.cy = 4;
        p.tremor = 2.2;
        break;
      case "susto":
        /* urubu chegando: olha pra cima, braço esquerdo protege a cabeça */
        p.meL = [-24, -226 + s(t * 30) * 4]; p.meR = [47, -146]; p.soltoL = 1;
        p.peL = [-70 + s(t * 22) * 14, 92]; p.peR = [44, 104];
        p.giro = 0.68; p.incl = -0.42; p.cy = -2;
        p.agarra = 0.3; p.chapeu = 26; p.chapeuGiro = 0.4;
        p.tremor = 1.5;
        break;
      case "agarrado":
        /* o urubu levou pelos ombros: pendurado, esperneando */
        p.meL = [-70 + s(t * 16) * 16, -170 + s(t * 13) * 14];
        p.meR = [70 + s(t * 15 + 1) * 16, -168 + s(t * 12 + 2) * 14];
        p.peL = [-30 + s(t * 14) * 18, 118 + s(t * 14) * 8];
        p.peR = [30 + s(t * 14 + 3) * 18, 118 + s(t * 14 + 3) * 8];
        p.ny = -104; p.giro = 0.62; p.incl = -0.2; p.agarra = 0; p.soltoL = p.soltoR = 1;
        p.chapeu = 60; p.chapeuGiro = 1.1;
        break;
      case "coco":
        /* coco na cabeça: encolhe, chapéu amassa, olhos apertados */
        Object.assign(p, this.poseEscalada());
        p.cy = 12 * zeLim(1 - k * 1.2); p.ny = -90;
        p.giro = 0.55; p.incl = 0.22 + s(t * 20) * 0.05;
        p.chapeu = -6;
        break;
      case "sagui":
        /* sagui puxando o pé direito: olha pra baixo e chuta */
        p.meL = [-47, -152]; p.meR = [47, -146];
        p.peL = [-36, 96];
        p.peR = [56 + s(t * 18) * 14, 128 + s(t * 18) * 10];
        p.giro = 0.66; p.incl = 0.38; p.hx = 6;
        break;
      case "vento":
        /* abraça o tronco de olho fechado */
        p.meL = [-45, -140]; p.meR = [45, -138];
        p.peL = [-40, 96]; p.peR = [40, 96];
        p.ny = -88; p.cy = 6; p.giro = 0.45; p.incl = 0.15;
        p.tremor = 0.8;
        break;
      case "asa":
        /* pendurado na barra da asa-delta: aqui as mãos lá em cima são de verdade */
        p.meL = [-44, -214]; p.meR = [44, -214];
        p.peL = [-22 + s(t * 3) * 6, 120]; p.peR = [26 + s(t * 3) * 6, 116];
        p.ny = -108; p.giro = 0.7; p.incl = -0.1;
        p.agarra = 0.6; p.chapeu = 10; p.chapeuGiro = -0.15; p.soltoL = p.soltoR = 1;
        break;
      case "foguete":
        /* agarrado no foguete: corpo colado, pernas voando, chapéu longe */
        p.meL = [-46, -146]; p.meR = [46, -150];
        p.peL = [-58 + s(t * 26) * 10, 126]; p.peR = [58 + s(t * 26 + 2) * 10, 126];
        p.ny = -96; p.giro = 0.6; p.incl = -0.1;
        p.chapeu = 90; p.chapeuGiro = 2.4;
        p.tremor = 1.8;
        break;
      case "tonto":
        /* depois da areia: segura baixo, cabeça rodando */
        p.meL = [-47, -124]; p.meR = [47, -120];
        p.peL = [-50, 100]; p.peR = [50, 100];
        p.ny = -88; p.cx = s(t * 6) * 5; p.cy = 6;
        p.giro = 0.65 * s(t * 3); p.incl = s(t * 6) * 0.15;
        p.chapeu = -4; p.chapeuGiro = 0.25;
        break;
      case "queda":
        /* caindo: braços pra cima se debatendo, pernas pedalando */
        p.meL = [-84 + s(t * 19) * 18, -210 + s(t * 23) * 16];
        p.meR = [84 + s(t * 21 + 1) * 18, -214 + s(t * 17 + 2) * 16];
        p.peL = [-46 + s(t * 15) * 22, 108 + s(t * 15) * 12];
        p.peR = [46 + s(t * 15 + Math.PI) * 22, 108 + s(t * 15 + Math.PI) * 12];
        p.ny = -100; p.giro = 0.7; p.incl = -0.3; p.agarra = 0; p.soltoL = p.soltoR = 1;
        p.chapeu = 70 + s(t * 7) * 10; p.chapeuGiro = s(t * 5) * 0.8;
        break;
    }
    return p;
  },

  ROSTO: {
    olha: "neutro", feliz: "feliz", comemora: "feliz", escorrega: "medo", susto: "pavor",
    agarrado: "pavor", coco: "dor", sagui: "bravo", vento: "esforco", asa: "feliz",
    foguete: "feliz", tonto: "tonto", queda: "pavor",
  },

  pose() {
    let p = this.poseEscalada();
    let rosto = "neutro";
    const r = this.reacaoAtiva();
    if (r) {
      const k = zeLim((this.tempo - r.inicio) / r.dur);
      const peso = zeSuave(zeLim((this.tempo - r.inicio) / 0.14)) * zeSuave(zeLim((r.inicio + r.dur - this.tempo) / 0.22));
      p = zeMistura(p, this.posePara(r.tipo, k, this.tempo), peso);
      if (peso > 0.4) rosto = this.ROSTO[r.tipo] || rosto;
    }
    /* deslizando pra baixo devagar (sabotagem pequena): escorrega leve */
    if (this.vel < -0.4 && this.caindo < 0.5 && !(r && r.prio >= 2)) {
      const peso = zeLim((-this.vel - 0.4) / 2) * 0.8;
      p = zeMistura(p, this.posePara("escorrega", 0, this.tempo), peso);
      if (peso > 0.4) rosto = "medo";
    }
    if (this.balanco > 0.5 && !(r && r.prio >= 2)) {
      const peso = zeLim((this.balanco - 0.5) * 1.5) * 0.85;
      p = zeMistura(p, this.posePara("vento", 0, this.tempo), peso);
      if (peso > 0.4) rosto = "esforco";
    }
    if (this.caindo > 0.05) {
      p = zeMistura(p, this.posePara("queda", 0, this.tempo), zeSuave(zeLim(this.caindo)));
      if (this.caindo > 0.4) rosto = "pavor";
    }
    /* respiração */
    p.ny += Math.sin(this.tempo * 2.4) * 1.2;
    return { p, rosto };
  },

  /* ───────────── desenho ───────────── */

  desenhar(c, cfg) {
    const { p, rosto } = this.pose();
    const Z = ZE;
    const regata = cfg.regata || "#F2C230", bermuda = cfg.bermuda || "#1E6FD9";
    const tr = p.tremor ? (Math.sin(this.tempo * 61) * p.tremor) : 0;

    c.save();
    c.translate(p.hx + tr, p.hy);
    c.lineJoin = "round";
    c.lineCap = "round";

    /* esqueleto */
    const [oLx, oLy] = [p.nx - 42, p.ny + 8], [oRx, oRy] = [p.nx + 42, p.ny + 8];
    const osso = (solto, i) => zeLerp(Z.bracoAbraco[i], Z.braco[i], solto);
    const bL = zeIk(oLx, oLy, p.meL[0], p.meL[1], osso(p.soltoL, 0), osso(p.soltoL, 1), -1);
    const bR = zeIk(oRx, oRy, p.meR[0], p.meR[1], osso(p.soltoR, 0), osso(p.soltoR, 1), 1);
    const qL = [-19, 6], qR = [19, 6];
    const pL = zeIk(qL[0], qL[1], p.peL[0], p.peL[1], Z.perna[0], Z.perna[1], 1);
    const pR = zeIk(qR[0], qR[1], p.peR[0], p.peR[1], Z.perna[0], Z.perna[1], -1);

    /* sombra no tronco: separa a silhueta do tronco quando a cor é parecida */
    c.fillStyle = "rgba(20,10,4,0.30)";
    c.beginPath(); c.ellipse(4, -46, 56, 130, 0, 0, Math.PI * 2); c.fill();

    /* peconha: passa pela frente do tronco, atrás dos pés */
    const tornL = [pL.bx + 4, pL.by - 4], tornR = [pR.bx - 4, pR.by - 4];
    c.strokeStyle = Z.contorno; c.lineWidth = 11;
    c.beginPath(); c.moveTo(...tornL); c.quadraticCurveTo((tornL[0] + tornR[0]) / 2, Math.max(tornL[1], tornR[1]) + 16, ...tornR); c.stroke();
    c.strokeStyle = "#9A6A35"; c.lineWidth = 6;
    c.stroke();
    c.strokeStyle = "#C8955A"; c.lineWidth = 2; c.setLineDash([5, 6]);
    c.stroke(); c.setLineDash([]);

    /* pernas e pés */
    for (const [q, perna, lado] of [[qL, pL, -1], [qR, pR, 1]]) {
      this.membro(c, q[0], q[1], perna.jx, perna.jy, perna.bx, perna.by, 15, 12.5, 9.5, lado);
      this.pe(c, perna.bx, perna.by, lado, perna.jx);
    }

    /* bermuda: cintura e as duas pernas da bermuda até o meio da coxa */
    this.bermuda(c, bermuda, qL, pL, qR, pR);

    /* costas e regata */
    this.costas(c, p, regata);

    /* braços (por cima das costas) */
    for (const [ox, oy, b, lado] of [[oLx, oLy, bL, -1], [oRx, oRy, bR, 1]]) {
      this.membro(c, ox, oy, b.jx, b.jy, b.bx, b.by, 12.5, 10.5, 8, lado, true);
    }

    /* cabeça e chapéu; as mãos por cima da aba, agarradas no tronco */
    const cab = [p.nx + p.cx, p.ny - 27 + p.cy];
    this.cabeca(c, cab[0], cab[1], p, rosto);
    this.chapeu(c, cab[0], cab[1], p);
    for (const [b, lado] of [[bL, -1], [bR, 1]]) this.mao(c, b.jx, b.jy, b.bx, b.by, lado, p.agarra);

    c.restore();

    this.pontos = {
      maoL: [bL.bx + p.hx, bL.by], maoR: [bR.bx + p.hx, bR.by],
      peL: [pL.bx + p.hx, pL.by], peR: [pR.bx + p.hx, pR.by],
      cabeca: [cab[0] + p.hx, cab[1]], ombros: [p.nx + p.hx, p.ny + 8],
    };
    return this.pontos;
  },

  /* braço ou perna: contorno, pele, sombra do lado de fora e luz do sol à direita */
  membro(c, ax, ay, jx, jy, bx, by, r0, r1, r2, lado, braco = false) {
    const Z = ZE;
    c.fillStyle = Z.contorno;
    zeCapsula(c, ax, ay, jx, jy, r0 + 3, r1 + 3); c.fill();
    zeCapsula(c, jx, jy, bx, by, r1 + 3, r2 + 3); c.fill();
    c.save();
    c.fillStyle = Z.pele;
    zeCapsula(c, ax, ay, jx, jy, r0, r1); c.fill();
    zeCapsula(c, jx, jy, bx, by, r1, r2); c.fill();
    /* sombra (luz vem do pôr do sol, à direita) */
    c.beginPath();
    zeCapsula(c, ax, ay, jx, jy, r0, r1);
    zeCapsula(c, jx, jy, bx, by, r1, r2);
    c.clip();
    c.fillStyle = Z.peleSombra; c.globalAlpha = 0.55;
    zeCapsula(c, ax - 9, ay + 2, jx - 9, jy + 2, r0, r1); c.fill();
    zeCapsula(c, jx - 9, jy + 2, bx - 9, by + 2, r1, r2); c.fill();
    c.globalAlpha = 0.5; c.fillStyle = Z.peleLuz;
    zeCapsula(c, ax + 10, ay - 1, jx + 10, jy - 1, r0 * 0.45, r1 * 0.45); c.fill();
    zeCapsula(c, jx + 10, jy - 1, bx + 10, by - 1, r1 * 0.45, r2 * 0.45); c.fill();
    c.globalAlpha = 1;
    /* volume do músculo: bíceps no braço, panturrilha na perna */
    c.strokeStyle = "rgba(60,30,14,0.45)"; c.lineWidth = 2.2;
    const mx = (braco ? ax : jx) + ((braco ? jx : bx) - (braco ? ax : jx)) * 0.5;
    const my = (braco ? ay : jy) + ((braco ? jy : by) - (braco ? ay : jy)) * 0.5;
    c.beginPath(); c.arc(mx - lado * 2, my, braco ? 7 : 8, Math.PI * 0.6, Math.PI * 1.3); c.stroke();
    c.restore();
  },

  mao(c, jx, jy, x, y, lado, agarra) {
    const Z = ZE;
    const ang = Math.atan2(y - jy, x - jx);
    c.save();
    c.translate(x, y);
    c.rotate(ang);
    c.fillStyle = Z.contorno;
    c.beginPath(); c.ellipse(2, 0, 15, 12.5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = Z.pele;
    c.beginPath(); c.ellipse(2, 0, 12, 9.5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = Z.peleLuz; c.globalAlpha = 0.5;
    c.beginPath(); c.ellipse(4, -3 * lado, 6, 3.5, 0, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;
    /* dedos: fechados abraçam o tronco, abertos se espalham */
    c.strokeStyle = Z.contorno; c.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const a = (-0.5 + i * 0.33) * (1.4 - agarra * 0.6);
      const r = 11 + (1 - agarra) * 7;
      c.beginPath(); c.moveTo(8 + Math.cos(a) * 4, Math.sin(a) * 4 * lado);
      c.lineTo(8 + Math.cos(a) * r, Math.sin(a) * r * lado); c.stroke();
    }
    c.restore();
  },

  pe(c, x, y, lado, joelhoX) {
    const Z = ZE;
    /* de costas: calcanhar e a sola apertando o tronco, ponta pra dentro */
    const ang = lado * -0.5 + (joelhoX - x) * 0.002;
    c.save();
    c.translate(x, y + 6);
    c.rotate(ang);
    c.fillStyle = Z.contorno;
    c.beginPath(); c.ellipse(-lado * 6, 2, 19, 12, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = Z.peleSombra;
    c.beginPath(); c.ellipse(-lado * 6, 1, 16, 9, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = Z.sola; c.globalAlpha = 0.75;
    c.beginPath(); c.ellipse(-lado * 9, 5, 10, 4, 0, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;
    c.strokeStyle = Z.contorno; c.lineWidth = 1.5;
    for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(-lado * (18 + k * 2), -3 + k * 4, 2.5, 0, Math.PI * 2); c.stroke(); }
    c.restore();
  },

  bermuda(c, cor, qL, pL, qR, pR) {
    const Z = ZE;
    const meio = (q, k, t) => [q[0] + (k.jx - q[0]) * t, q[1] + (k.jy - q[1]) * t];
    const perp = (q, k) => { const d = Math.hypot(k.jx - q[0], k.jy - q[1]) || 1; return [-(k.jy - q[1]) / d, (k.jx - q[0]) / d]; };
    const mL = meio(qL, pL, 0.55), nL = perp(qL, pL);
    const mR = meio(qR, pR, 0.55), nR = perp(qR, pR);
    c.beginPath();
    c.moveTo(-33, -12);
    c.lineTo(33, -12);
    c.quadraticCurveTo(38, 2, mR[0] - nR[0] * 18, mR[1] - nR[1] * 18);
    c.lineTo(mR[0] + nR[0] * 18, mR[1] + nR[1] * 18);
    c.quadraticCurveTo(8, 22, 0, 20);
    c.quadraticCurveTo(-8, 22, mL[0] - nL[0] * 18, mL[1] - nL[1] * 18);
    c.lineTo(mL[0] + nL[0] * 18, mL[1] + nL[1] * 18);
    c.quadraticCurveTo(-38, 2, -33, -12);
    c.closePath();
    c.strokeStyle = Z.contorno; c.lineWidth = 6; c.stroke();
    c.save();
    c.fillStyle = cor; c.fill();
    c.clip();
    const sombra = c.createLinearGradient(-40, 0, 40, 0);
    sombra.addColorStop(0, "rgba(0,0,30,0.35)"); sombra.addColorStop(0.55, "rgba(0,0,30,0)"); sombra.addColorStop(1, "rgba(255,240,220,0.12)");
    c.fillStyle = sombra; c.fillRect(-70, -20, 140, 90);
    /* hibisco */
    const flor = mistura(cor, "#FFFFFF", 0.78);
    for (const [fx, fy, s] of [[-22, -2, 1], [14, 2, 0.9], [30, 18, 0.8], [-34, 20, 0.85], [-4, 14, 0.7], [44, 34, 0.8], [-46, 36, 0.8]]) {
      c.fillStyle = flor;
      for (let k = 0; k < 5; k++) {
        const a = k * 1.2566 + fx;
        c.beginPath(); c.ellipse(fx + Math.cos(a) * 5 * s, fy + Math.sin(a) * 5 * s, 5 * s, 3 * s, a, 0, Math.PI * 2); c.fill();
      }
      c.fillStyle = "#F2C230"; c.beginPath(); c.arc(fx, fy, 1.8 * s, 0, Math.PI * 2); c.fill();
    }
    /* cós e costura do meio */
    c.fillStyle = mistura(cor, "#000000", 0.38); c.fillRect(-40, -13, 80, 7);
    c.strokeStyle = mistura(cor, "#000000", 0.4); c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, -6); c.lineTo(0, 19); c.stroke();
    c.restore();
  },

  costas(c, p, regata) {
    const Z = ZE;
    const nx = p.nx, ny = p.ny;
    /* tronco do corpo: ombros largos, cintura fina, inclina junto com o pescoço */
    const ponto = (x, y) => [x + nx * zeLim(y / ny), y];
    const forma = pts => { c.beginPath(); c.moveTo(...ponto(...pts[0])); for (let i = 1; i < pts.length; i += 2) c.quadraticCurveTo(...ponto(...pts[i]), ...ponto(...pts[i + 1])); c.closePath(); };
    const corpo = [[-30, -6], [-36, ny * 0.45], [-43, ny + 22], [-48, ny + 6], [-26, ny], [0, ny - 4], [26, ny], [48, ny + 6], [43, ny + 22], [36, ny * 0.45], [30, -6], [0, -2], [-30, -6]];
    forma(corpo);
    c.strokeStyle = Z.contorno; c.lineWidth = 6; c.stroke();
    c.fillStyle = Z.pele; c.fill();
    c.save(); c.clip();
    c.fillStyle = Z.peleSombra; c.globalAlpha = 0.6;
    c.beginPath(); c.ellipse(-40 + nx * 0.5, ny * 0.5, 18, 70, 0, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 0.45; c.fillStyle = Z.peleLuz;
    c.beginPath(); c.ellipse(42 + nx * 0.6, ny + 18, 8, 22, 0.2, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;

    /* regata nadador: costas cobertas, ombros e omoplatas de fora */
    const reg = [[-29, -4], [-34, ny * 0.45], [-31, ny + 34], [-22, ny + 24], [-14, ny + 2], [0, ny + 6], [14, ny + 2], [22, ny + 24], [31, ny + 34], [34, ny * 0.45], [29, -4], [0, 0], [-29, -4]];
    forma(reg);
    c.fillStyle = regata; c.fill();
    c.strokeStyle = mistura(regata, "#000000", 0.45); c.lineWidth = 2.5; c.stroke();
    forma(reg); c.save(); c.clip();
    const g = c.createLinearGradient(-36, 0, 36, 0);
    g.addColorStop(0, "rgba(60,25,0,0.42)"); g.addColorStop(0.45, "rgba(60,25,0,0.05)"); g.addColorStop(0.8, "rgba(255,250,220,0.18)"); g.addColorStop(1, "rgba(60,25,0,0.2)");
    c.fillStyle = g; c.fillRect(-50, ny - 10, 100, -ny + 20);
    /* dobras do tecido que puxam pro braço que está subindo */
    c.strokeStyle = mistura(regata, "#000000", 0.3); c.lineWidth = 2;
    const puxa = (p.meR[1] - p.meL[1]) * 0.08;
    c.beginPath(); c.moveTo(-18, ny * 0.35); c.quadraticCurveTo(0, ny * 0.42 + puxa, 20, ny * 0.3); c.stroke();
    c.beginPath(); c.moveTo(-12, ny * 0.65); c.quadraticCurveTo(4, ny * 0.7 - puxa, 16, ny * 0.6); c.stroke();
    /* número nas costas: a regata do Zé é do time da praia */
    c.fillStyle = mistura(regata, "#7A3F00", 0.55);
    c.font = "900 30px 'Big Shoulders Display', sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText("10", nx * 0.5, ny * 0.5);
    c.restore();
    c.restore();

    /* pescoço */
    c.fillStyle = Z.contorno;
    c.beginPath(); c.roundRect(nx - 12, ny - 20, 24, 26, 8); c.fill();
    c.fillStyle = Z.peleSombra;
    c.beginPath(); c.roundRect(nx - 9, ny - 18, 18, 23, 6); c.fill();
  },

  cabeca(c, x, y, p, rosto) {
    const Z = ZE, R = 30;
    const giro = zeLim(p.giro, -1, 1);
    const lado = giro >= 0 ? 1 : -1;
    const a = Math.abs(giro);
    c.save();
    c.translate(x, y);
    c.rotate(p.incl);

    /* orelha do lado de lá */
    const orelha = ox => {
      c.fillStyle = Z.contorno; c.beginPath(); c.ellipse(ox, 2, 8, 11, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = Z.pele; c.beginPath(); c.ellipse(ox, 2, 5.5, 8.5, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = Z.peleSombra; c.beginPath(); c.ellipse(ox, 3, 2.5, 5, 0, 0, Math.PI * 2); c.fill();
    };
    orelha(-lado * (R - 1) * (1 - a * 0.25));

    c.fillStyle = Z.contorno;
    c.beginPath(); c.arc(0, 0, R + 3, 0, Math.PI * 2); c.fill();
    /* nariz e queixo despontam do contorno quando ele vira */
    if (a > 0.35) {
      const k = (a - 0.35) / 0.65;
      c.beginPath(); c.ellipse(lado * (R - 2 + k * 6), 6, 7 * k + 2, 6, 0, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = Z.pele;
    c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.fill();
    if (a > 0.35) {
      const k = (a - 0.35) / 0.65;
      c.beginPath(); c.ellipse(lado * (R - 2 + k * 6), 6, 7 * k - 1 + 2, 4, 0, 0, Math.PI * 2); c.fill();
    }

    /* cabelo cobre tudo menos o rosto (que aparece conforme ele vira) */
    const fx = lado * R * (1.05 - a * 0.45), rx = R * 0.95 * a;
    c.save();
    c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.clip();
    c.fillStyle = Z.cabelo;
    c.beginPath();
    c.rect(-R - 2, -R - 2, R * 2 + 4, R * 2 + 4);
    if (rx > 1) c.ellipse(fx, 7, rx, R * 0.86, 0, 0, Math.PI * 2);
    c.fill("evenodd");
    /* nuca raspada: pele aparecendo embaixo do cabelo */
    c.fillStyle = mistura(Z.pele, Z.cabelo, 0.45);
    c.beginPath(); c.ellipse(-lado * a * 8, R + 2, R * 0.75, 9, 0, 0, Math.PI * 2); c.fill();
    /* textura de cabelo crespo curto */
    c.fillStyle = "rgba(255,230,200,0.10)";
    for (let i = 0; i < 9; i++) {
      const hx = -16 + (i % 3) * 14 - lado * a * 8, hy = -14 + Math.floor(i / 3) * 10;
      c.beginPath(); c.arc(hx, hy, 3.2, 0, Math.PI * 2); c.fill();
    }
    c.restore();

    if (a > 0.2) this.rosto(c, lado, a, R, rosto);
    orelha(lado * (R - 1) * (1 - a * 1.25));
    c.restore();
  },

  rosto(c, lado, a, R, rosto) {
    const t = this.tempo;
    const ex = lado * R * (0.95 - a * 0.42), ey = -1;
    const vis = zeLim((a - 0.2) / 0.3);
    c.globalAlpha = vis;
    c.lineCap = "round";
    c.strokeStyle = "#1A0C05"; c.fillStyle = "#1A0C05";
    /* sobrancelha */
    const sob = { medo: -5, pavor: -8, bravo: 3, esforco: 2, dor: 2 }[rosto] || -1;
    const incl = { bravo: 0.5, esforco: 0.3, medo: -0.4, pavor: -0.5 }[rosto] || 0;
    c.lineWidth = 3.5;
    c.beginPath();
    c.moveTo(ex - lado * 6, ey - 9 + sob + incl * 5 * lado * lado);
    c.lineTo(ex + lado * 5, ey - 9 + sob - incl * 4);
    c.stroke();
    /* olho */
    c.lineWidth = 3;
    if (rosto === "feliz") {
      c.beginPath(); c.arc(ex, ey + 1, 5, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
    } else if (rosto === "dor" || rosto === "esforco") {
      c.beginPath(); c.moveTo(ex - 5, ey - 2); c.lineTo(ex + 3 * lado, ey + 1); c.lineTo(ex - 5, ey + 4); c.stroke();
    } else if (rosto === "tonto") {
      c.lineWidth = 2;
      c.beginPath();
      for (let k = 0; k < 14; k++) { const ang = k * 0.8 + t * 8, r = k * 0.45; c.lineTo(ex + Math.cos(ang) * r, ey + Math.sin(ang) * r); }
      c.stroke();
    } else {
      const grande = rosto === "pavor" ? 7.5 : rosto === "medo" ? 6 : 4.6;
      c.fillStyle = "#FFFFFF";
      c.beginPath(); c.ellipse(ex, ey, grande * 0.8, grande, 0, 0, Math.PI * 2); c.fill();
      c.lineWidth = 1.6; c.stroke();
      c.fillStyle = "#1A0C05";
      const pup = rosto === "pavor" ? 2.2 : 2.8;
      c.beginPath(); c.arc(ex + lado * 1.5, ey + (rosto === "pavor" ? -1 : 0.5), pup, 0, Math.PI * 2); c.fill();
    }
    /* boca */
    const mx = lado * R * (0.98 - a * 0.36), my = 13;
    c.lineWidth = 2.6;
    if (rosto === "feliz") {
      c.fillStyle = "#5A1A10";
      c.beginPath(); c.moveTo(mx - lado * 9, my - 3); c.quadraticCurveTo(mx - lado * 2, my + 9, mx + lado * 4, my - 4); c.closePath(); c.fill();
      c.fillStyle = "#FFF"; c.beginPath(); c.moveTo(mx - lado * 8, my - 2.5); c.lineTo(mx + lado * 3, my - 3.5); c.lineTo(mx - lado * 1, my); c.closePath(); c.fill();
    } else if (rosto === "pavor" || rosto === "medo") {
      const r = rosto === "pavor" ? 5.5 : 4;
      c.fillStyle = "#5A1A10"; c.beginPath(); c.ellipse(mx - lado * 2, my + 1, r * 0.75, r, 0, 0, Math.PI * 2); c.fill();
    } else if (rosto === "dor" || rosto === "esforco") {
      c.fillStyle = "#FFF"; c.beginPath(); c.roundRect(mx - lado * 3 - 6, my - 3, 12, 6, 2); c.fill();
      c.strokeStyle = "#1A0C05"; c.lineWidth = 1.6; c.stroke();
    } else if (rosto === "bravo") {
      c.beginPath(); c.moveTo(mx - lado * 8, my + 2); c.quadraticCurveTo(mx - lado * 2, my - 3, mx + lado * 3, my + 2); c.stroke();
    } else if (rosto === "tonto") {
      c.beginPath(); c.moveTo(mx - lado * 8, my); for (let k = 1; k <= 4; k++) c.lineTo(mx - lado * 8 + lado * k * 3, my + (k % 2 ? -2 : 2)); c.stroke();
    } else {
      c.beginPath(); c.moveTo(mx - lado * 7, my); c.quadraticCurveTo(mx - lado * 2, my + 3, mx + lado * 2, my - 1); c.stroke();
    }
    c.globalAlpha = 1;
  },

  chapeu(c, x, y, p) {
    c.save();
    c.translate(x, y - 21 - p.chapeu);
    c.rotate(p.incl * 0.8 + p.chapeuGiro);
    const contorno = ZE.contorno;
    /* aba vista um pouco de cima, com a borda de palha desfiada */
    c.fillStyle = contorno;
    c.beginPath(); c.ellipse(0, 0, 50, 16, 0, 0, Math.PI * 2); c.fill();
    const aba = c.createLinearGradient(0, -16, 0, 16);
    aba.addColorStop(0, "#F4DB98"); aba.addColorStop(1, "#C2913F");
    c.fillStyle = aba;
    c.beginPath(); c.ellipse(0, 0, 47, 13, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "rgba(110,70,25,0.4)"; c.lineWidth = 1.3;
    for (let r = 32; r < 47; r += 5) { c.beginPath(); c.ellipse(0, 0, r, r * 0.27, 0, 0, Math.PI * 2); c.stroke(); }
    c.strokeStyle = "#B9893C"; c.lineWidth = 1.5;
    for (let k = 0; k < 32; k++) {
      const a = k / 32 * Math.PI * 2;
      const bx = Math.cos(a) * 47, by = Math.sin(a) * 13;
      c.beginPath(); c.moveTo(bx, by); c.lineTo(bx * 1.06, by * 1.12 + 1); c.stroke();
    }
    /* copa */
    c.fillStyle = contorno;
    c.beginPath(); c.moveTo(-33, -1); c.bezierCurveTo(-35, -40, 35, -40, 33, -1); c.closePath(); c.fill();
    const copa = c.createLinearGradient(-30, 0, 30, 0);
    copa.addColorStop(0, "#C99A4E"); copa.addColorStop(0.6, "#EBCB80"); copa.addColorStop(1, "#D9B064");
    c.fillStyle = copa;
    c.beginPath(); c.moveTo(-30, -2); c.bezierCurveTo(-32, -36, 32, -36, 30, -2); c.closePath(); c.fill();
    c.strokeStyle = "rgba(120,80,30,0.35)"; c.lineWidth = 1.2;
    for (let k = -24; k <= 24; k += 6) { c.beginPath(); c.moveTo(k, -6); c.quadraticCurveTo(k * 0.8, -20, k * 0.5, -28); c.stroke(); }
    c.fillStyle = "#7A2E1C"; c.fillRect(-31, -12, 62, 8);
    c.fillStyle = "#A8432A"; c.fillRect(-31, -12, 62, 2.5);
    c.restore();
  },
};
