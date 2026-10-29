/* O corredor: cabeção recortado da caricatura em cima de um atleta cartoon
   desenhado em código. Origem no chão, entre os pés; unidade = px do palco
   na escala 1 (a cena passa a escala de cada raia).

   A cabeça sai da arte de meio corpo: um contorno à mão em volta do cabelo,
   orelhas e queixo (a barba do Lula desce mais) corta o terno fora, e o
   contorno preto é a silhueta borrada por deslocamento, pintada atrás. */
"use strict";

(function (raiz) {
  /* Polígono da cabeça em px da arte (1086×1448) e o ponto do queixo, onde
     o pescoço encaixa. Conferido no print: cabelo e orelhas inteiros, sem gola. */
  const RECORTE = {
    lula: {
      pontos: [[270, 0], [810, 0], [810, 330], [770, 385], [738, 425], [715, 455], [692, 476], [664, 500], [636, 527], [600, 551],
        [555, 565], [510, 565], [478, 553], [452, 532], [424, 505], [400, 475], [380, 445], [355, 420], [310, 395], [270, 370]],
      queixo: [530, 560],
      pele: "#E9A27C", peleSombra: "#B8704E",
    },
    flavio: {
      pontos: [[280, 0], [790, 0], [790, 320], [748, 350], [718, 390], [696, 432], [666, 462], [646, 479], [620, 498], [565, 513],
        [520, 513], [470, 500], [436, 478], [410, 450], [386, 420], [362, 380], [326, 352], [280, 330]],
      queixo: [545, 508],
      pele: "#EBA67F", peleSombra: "#B97553",
    },
    trump: {
      pontos: [[295, 0], [790, 0], [790, 300], [745, 345], [712, 370], [695, 412], [670, 460], [640, 500], [605, 530], [565, 550],
        [520, 553], [478, 538], [440, 512], [405, 478], [378, 440], [355, 398], [335, 368], [295, 345]],
      queixo: [530, 548],
      pele: "#F59A6E", peleSombra: "#C2683F",
    },
  };

  /* Parceiro de chapa: corre colado, um pouco atrás e mais longe da câmera,
     com a cabeça inteira fora da do titular. */
  const PARCEIRO = { dx: -150, dy: -34, escala: 0.94 };

  const ALTURA_CABECA = 360;
  const CONTORNO = 9;
  const TRONCO = 112;
  const COXA = 66, CANELA = 64;
  const BRACO = 46, ANTEBRACO = 42;
  const TINTA = "#14121C";
  const SHORT = "#1C2140";
  const TAU = Math.PI * 2;

  function recortarCabeca(img, r) {
    const xs = r.pontos.map(p => p[0]), ys = r.pontos.map(p => p[1]);
    const x0 = Math.min(...xs), y0 = Math.min(...ys);
    const w0 = Math.max(...xs) - x0, h0 = Math.max(...ys) - y0;
    const k = ALTURA_CABECA / h0;
    const pad = CONTORNO + 2;
    const w = Math.ceil(w0 * k) + pad * 2, h = Math.ceil(h0 * k) + pad * 2;

    const recorte = document.createElement("canvas");
    recorte.width = w; recorte.height = h;
    const c = recorte.getContext("2d");
    c.save();
    c.translate(pad, pad);
    c.scale(k, k);
    c.translate(-x0, -y0);
    c.beginPath();
    r.pontos.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    c.clip();
    c.drawImage(img, 0, 0);
    c.restore();

    /* Silhueta preta (a arte por file:// suja o canvas, então nada de
       getImageData: a sombra é a própria imagem com source-in). */
    const sombra = document.createElement("canvas");
    sombra.width = w; sombra.height = h;
    const s = sombra.getContext("2d");
    s.drawImage(recorte, 0, 0);
    s.globalCompositeOperation = "source-in";
    s.fillStyle = TINTA;
    s.fillRect(0, 0, w, h);

    const final = document.createElement("canvas");
    final.width = w; final.height = h;
    const f = final.getContext("2d");
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      f.drawImage(sombra, Math.cos(a) * CONTORNO, Math.sin(a) * CONTORNO);
    }
    f.drawImage(recorte, 0, 0);
    return {
      canvas: final,
      queixo: [(r.queixo[0] - x0) * k + pad, (r.queixo[1] - y0) * k + pad],
    };
  }

  /* Chama em degradê, pré-desenhada uma vez: no quadro só vira drawImage. */
  let chamaSprite = null;
  function chama() {
    if (chamaSprite) return chamaSprite;
    const w = 220, h = 90;
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    const c = cv.getContext("2d");
    const camadas = [["rgba(255,80,20,.9)", 1], ["rgba(255,160,30,.95)", 0.72], ["rgba(255,236,120,1)", 0.45], ["rgba(255,255,240,1)", 0.22]];
    for (const [cor, f] of camadas) {
      c.beginPath();
      const ry = (h / 2 - 4) * f, rx = (w - 10) * f;
      c.moveTo(w - 6, h / 2 - ry);
      c.bezierCurveTo(w - 6 - rx * 0.35, h / 2 - ry * 1.1, w - 6 - rx * 0.8, h / 2 - ry * 0.5, w - 6 - rx, h / 2);
      c.bezierCurveTo(w - 6 - rx * 0.8, h / 2 + ry * 0.5, w - 6 - rx * 0.35, h / 2 + ry * 1.1, w - 6, h / 2 + ry);
      c.arc(w - 6, h / 2, ry, Math.PI / 2, -Math.PI / 2, true);
      c.fillStyle = cor;
      c.fill();
    }
    chamaSprite = cv;
    return cv;
  }

  /* Chama apontando pra trás (x negativo) a partir de (x, y), girada `ang`. */
  function desenharChama(c, x, y, comp, larg, ang, alfa = 1) {
    const sp = chama();
    c.save();
    c.translate(x, y);
    c.rotate(ang);
    c.globalAlpha *= alfa;
    c.drawImage(sp, -comp, -larg / 2, comp, larg);
    c.restore();
  }

  function capsula(c, ax, ay, bx, by, ra, rb) {
    const ang = Math.atan2(by - ay, bx - ax);
    c.beginPath();
    c.arc(ax, ay, ra, ang + Math.PI / 2, ang - Math.PI / 2);
    c.arc(bx, by, rb, ang - Math.PI / 2, ang + Math.PI / 2);
    c.closePath();
  }

  function pintar(c, cor) {
    c.lineWidth = 6;
    c.strokeStyle = TINTA;
    c.stroke();
    c.fillStyle = cor;
    c.fill();
  }

  function estrela(c, x, y, r) {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.45 : r;
      c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    c.closePath();
  }

  function escurecer(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const ch = s => Math.round(((n >> s) & 255) * f);
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  }

  /* Pose num objeto reaproveitado: nada de alocar por quadro. */
  function novaPose() {
    return { inc: 0, quadril: 0, pernas: [[0, 0], [0, 0]], bracos: [[0, 0], [0, 0]], cabeca: 0, giro: 0 };
  }

  class Corredor {
    constructor(candidato, img) {
      this.c = candidato;
      this.r = RECORTE[candidato.id] || RECORTE.lula;
      this.cabeca = img ? recortarCabeca(img, this.r) : null;
      this.fase = Math.random() * TAU;
      this.tempo = 0;
      this.queda = 0;
      this.voo = 0;
      this.passos = 0;
      this.pose = novaPose();
      this.camisa = candidato.cor;
      this.camisaSombra = escurecer(candidato.cor, 0.62);
      this.numeroCor = candidato.acento && candidato.acento !== "#FFFFFF" ? candidato.acento : "#FFFFFF";
      this.peleLonge = escurecer(this.r.pele, 0.8);
      this.parceiro = null;
      this.recuo = 0;
    }

    static criar(candidato, src) {
      const um = (cand, arte) => new Promise(ok => {
        const img = new Image();
        img.onload = () => ok(new Corredor(cand, img));
        img.onerror = () => ok(new Corredor(cand, null));
        img.src = arte;
      });
      const p = candidato.parceiro;
      return Promise.all([um(candidato, src), p ? um({ ...candidato, id: p.id }, p.arte) : null]).then(([titular, parceiro]) => {
        titular.parceiro = parceiro;
        titular.recuo = parceiro ? -PARCEIRO.dx : 0;
        return titular;
      });
    }

    /* Anda o relógio do corredor. Devolve true no quadro em que um pé bate
       no chão (a cena solta poeira). */
    atualizar(dt, estado) {
      if (this.parceiro) this.parceiro.atualizar(dt, estado);
      const { vel = 0, caido = false, voando = false, pose = "correndo" } = estado;
      this.tempo += dt;
      this.queda += ((caido ? 1 : 0) - this.queda) * Math.min(1, dt * (caido ? 14 : 5));
      this.voo += ((voando ? 1 : 0) - this.voo) * Math.min(1, dt * 3.2);
      if (pose !== "correndo" || caido) return false;
      /* Cadência de quem corre, não de quem anda: a velocidade real
         (metros/s do jogo) só acelera um pouco a passada. */
      const antes = this.fase;
      this.fase += dt * TAU * (1.55 + 0.22 * Math.sqrt(Math.max(0, vel))) * (voando ? 0.5 : 1);
      const passou = Math.floor(antes / Math.PI) !== Math.floor(this.fase / Math.PI);
      if (this.fase > 1e4) this.fase -= TAU * 1000;
      return passou && !voando;
    }

    montarPose(pose, vel) {
      const p = this.pose;
      const f = this.fase;
      if (pose === "largada") {
        p.inc = 1.15;
        p.pernas[0][0] = 1.25; p.pernas[0][1] = 2.35;
        p.pernas[1][0] = 0.15; p.pernas[1][1] = 1.25;
        p.bracos[0][0] = -1.05; p.bracos[0][1] = 0.05;
        p.bracos[1][0] = -1.0; p.bracos[1][1] = 0.05;
        p.cabeca = 0.55; p.giro = 0;
        return p;
      }
      if (pose === "comemora") {
        const t = this.tempo;
        p.inc = -0.05;
        p.pernas[0][0] = 0.12 * Math.sin(t * 9); p.pernas[0][1] = 0.3 + 0.3 * Math.max(0, Math.sin(t * 9));
        p.pernas[1][0] = -0.12 * Math.sin(t * 9); p.pernas[1][1] = 0.3 + 0.3 * Math.max(0, -Math.sin(t * 9));
        p.bracos[0][0] = 0.35 + 0.25 * Math.sin(t * 12); p.bracos[0][1] = 2.5;
        p.bracos[1][0] = -0.2; p.bracos[1][1] = 2.3 + 0.25 * Math.sin(t * 12 + 2);
        p.cabeca = -0.08 + 0.06 * Math.sin(t * 9); p.giro = 0;
        return p;
      }
      const corre = Math.min(1, 0.6 + Math.sqrt(Math.max(0, vel)) * 0.08);
      p.inc = 0.16 + 0.12 * corre;
      for (let i = 0; i < 2; i++) {
        const fi = f + i * Math.PI;
        /* Joelho dobra no balanço (calcanhar sobe atrás) e estica antes de
           pisar; o braço vai ao contrário da perna do mesmo lado. */
        p.pernas[i][0] = 0.12 + (0.5 + 0.16 * corre) * Math.sin(fi);
        p.pernas[i][1] = 0.22 + 0.16 * Math.max(0, -Math.cos(fi)) + 1.85 * corre * Math.pow(Math.max(0, Math.cos(fi + 0.3)), 1.5);
        p.bracos[i][0] = -(0.7 + 0.2 * corre) * Math.sin(fi);
        p.bracos[i][1] = 1.3 + 0.25 * Math.cos(fi);
      }
      p.cabeca = 0.06 * Math.sin(f * 2);
      p.giro = 0;
      return p;
    }

    /* Ponto do joelho e do tornozelo de uma perna, a partir do quadril (0,0). */
    perna(i, out) {
      const [coxa, joelho] = this.pose.pernas[i];
      const kx = Math.sin(coxa) * COXA, ky = Math.cos(coxa) * COXA;
      const canela = coxa - joelho;
      out[0] = kx; out[1] = ky;
      out[2] = kx + Math.sin(canela) * CANELA; out[3] = ky + Math.cos(canela) * CANELA;
      out[4] = canela;
      return out;
    }

    /* x, y: chão. o: { escala, vel, pose, boost: "nitro"|"jato"|null, rastro } */
    desenhar(c, x, y, o) {
      const escala = o.escala || 1;
      if (this.parceiro) {
        const op = this._oParceiro || (this._oParceiro = {});
        Object.assign(op, o);
        op.escala = escala * PARCEIRO.escala;
        this.parceiro.desenhar(c, x + PARCEIRO.dx * escala, y + PARCEIRO.dy * escala, op);
      }
      const pose = this.queda > 0.02 && o.pose !== "largada" ? "correndo" : o.pose || "correndo";
      this.montarPose(pose, o.vel || 0);
      const p = this.pose;
      const voo = this.voo * (o.alturaVoo ?? 110);

      const a = this._a || (this._a = [0, 0, 0, 0, 0]);
      const b = this._b || (this._b = [0, 0, 0, 0, 0]);
      this.perna(0, a);
      this.perna(1, b);
      /* O pé mais baixo toca o chão: o corpo sobe e desce sozinho no passo. */
      const sola = 14;
      let quadril = -(Math.max(a[3], b[3]) + sola);
      if (pose === "correndo") quadril -= 5 * Math.max(0, Math.sin(this.fase * 2));
      quadril -= voo;

      c.save();
      c.translate(x, y);
      c.scale(escala, escala);

      /* sombra no chão, menor quando voa */
      const somb = 1 / (1 + voo / 90);
      c.fillStyle = `rgba(30,10,0,${0.28 * somb})`;
      c.beginPath();
      c.ellipse(4, 2, 70 * somb, 13 * somb, 0, 0, TAU);
      c.fill();

      if (this.queda > 0.02) {
        /* caindo de costas: gira tudo em volta do quadril e deita no chão */
        const q = this.queda;
        c.translate(0, -quadril * (1 - q) - 26 * q);
        c.rotate(-1.42 * q);
        c.translate(0, quadril * (1 - q) + 26 * q);
        if (q > 0.5) {
          p.pernas[0][0] = 0.6 + 0.35 * Math.sin(this.tempo * 15); p.pernas[0][1] = 0.4;
          p.pernas[1][0] = 0.35 + 0.35 * Math.sin(this.tempo * 15 + 2); p.pernas[1][1] = 0.8;
          p.bracos[0][0] = 2.2 + 0.4 * Math.sin(this.tempo * 13); p.bracos[0][1] = 0.4;
          p.bracos[1][0] = 2.6 + 0.4 * Math.sin(this.tempo * 13 + 1); p.bracos[1][1] = 0.4;
          this.perna(0, a);
          this.perna(1, b);
        }
      }

      c.translate(0, quadril);
      const inc = p.inc;
      const ombro = TRONCO - 24;
      const ombroX = Math.sin(inc) * ombro - Math.cos(inc) * 12, ombroY = -Math.cos(inc) * ombro + Math.sin(inc) * 12;
      const pescocoX = Math.sin(inc) * TRONCO, pescocoY = -Math.cos(inc) * TRONCO;

      if (o.boost === "jato") this.mochila(c, inc, true);

      this.braco(c, 1, ombroX, ombroY, true);
      this.membroPerna(c, b, this.peleLonge, true);
      this.tronco(c, inc, ombroX, ombroY);
      this.membroPerna(c, a, this.r.pele, false);
      this.shorts(c, inc);
      if (o.boost === "jato") this.mochila(c, inc, false);
      this.braco(c, 0, ombroX, ombroY, false);
      this.desenharCabeca(c, pescocoX, pescocoY, p);

      if (o.boost === "nitro" && this.queda < 0.5) {
        const fl = 0.8 + 0.25 * Math.sin(this.tempo * 40);
        c.globalCompositeOperation = "lighter";
        desenharChama(c, a[2] - 8, a[3] + 4, 150 * fl, 60, 0.1, 0.9);
        desenharChama(c, b[2] - 8, b[3] + 4, 130 * fl, 52, 0.15, 0.7);
        c.globalCompositeOperation = "source-over";
      }
      c.restore();

      if (this.queda > 0.6) this.estrelas(c, x, y, escala);
      this.ultimoQuadril = quadril;
    }

    membroPerna(c, v, pele, longe) {
      const [kx, ky, ax, ay, canela] = v;
      capsula(c, 0, 0, kx, ky, 19, 15);
      pintar(c, pele);
      capsula(c, kx, ky, ax, ay, 15, 11);
      pintar(c, pele);
      /* tênis: cano branco, sola escura e a faixa na cor do lado */
      const pe = canela * 0.5;
      const fx = Math.cos(pe), fy = -Math.sin(pe);
      const nx = Math.sin(pe), ny = Math.cos(pe);
      const bx = ax - fx * 14, by = ay - fy * 14;
      const px = ax + fx * 38, py = ay + fy * 38;
      c.beginPath();
      c.moveTo(bx - nx * 10, by - ny * 10);
      c.lineTo(px - nx * 5, py - ny * 5);
      c.quadraticCurveTo(px + fx * 14 + nx * 4, py + fy * 14 + ny * 4, px + nx * 11, py + ny * 11);
      c.lineTo(bx + nx * 11, by + ny * 11);
      c.quadraticCurveTo(bx - fx * 9, by - fy * 9, bx - nx * 10, by - ny * 10);
      c.closePath();
      c.lineJoin = "round";
      pintar(c, longe ? "#D9DCE6" : "#FFFFFF");
      c.beginPath();
      c.moveTo(bx + nx * 11, by + ny * 11);
      c.lineTo(px + nx * 11, py + ny * 11);
      c.lineWidth = 5;
      c.lineCap = "round";
      c.strokeStyle = TINTA;
      c.stroke();
      c.beginPath();
      c.moveTo(bx + fx * 4 - nx * 1, by + fy * 4 - ny * 1);
      c.lineTo(px - fx * 10 + nx * 3, py - fy * 10 + ny * 3);
      c.lineWidth = 5;
      c.strokeStyle = longe ? this.camisaSombra : this.camisa;
      c.stroke();
      c.lineCap = "butt";
    }

    braco(c, i, ox, oy, longe) {
      const [ombro, cotovelo] = this.pose.bracos[i];
      const ex = ox + Math.sin(ombro) * BRACO, ey = oy + Math.cos(ombro) * BRACO;
      const fa = ombro + cotovelo;
      const hx = ex + Math.sin(fa) * ANTEBRACO, hy = ey + Math.cos(fa) * ANTEBRACO;
      const pele = longe ? this.peleLonge : this.r.pele;
      capsula(c, ox, oy, ex, ey, 14, 11);
      pintar(c, pele);
      capsula(c, ex, ey, hx, hy, 11, 10);
      pintar(c, pele);
      c.beginPath();
      c.arc(hx, hy, 13, 0, TAU);
      pintar(c, pele);
    }

    tronco(c, inc, ox, oy) {
      c.save();
      c.rotate(inc);
      const t = TRONCO;
      c.beginPath();
      c.moveTo(-36, 8);
      c.bezierCurveTo(-42, -t * 0.45, -48, -t * 0.82, -34, -t - 4);
      c.quadraticCurveTo(0, -t - 18, 38, -t - 2);
      c.bezierCurveTo(50, -t * 0.75, 44, -t * 0.4, 38, 8);
      c.closePath();
      pintar(c, this.camisa);
      /* faixa lateral e gola */
      c.save();
      c.clip();
      c.fillStyle = this.camisaSombra;
      c.fillRect(-50, -t - 20, 20, t + 30);
      c.fillStyle = "rgba(255,255,255,.18)";
      c.fillRect(20, -t - 20, 9, t + 30);
      c.restore();
      c.beginPath();
      c.arc(2, -t - 6, 15, 0.1, Math.PI - 0.1);
      c.lineWidth = 6;
      c.strokeStyle = "#FFFFFF";
      c.stroke();
      /* número do peito */
      c.save();
      c.translate(8, -t * 0.3);
      c.rotate(-0.04);
      c.fillStyle = "#FFFFFF";
      c.strokeStyle = TINTA;
      c.lineWidth = 4;
      c.beginPath();
      c.roundRect(-27, -24, 54, 46, 8);
      c.fill();
      c.stroke();
      c.font = "900 44px 'Big Shoulders Display', 'Arial Narrow', sans-serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillStyle = this.c.cor;
      c.fillText(this.c.numero, 0, 1);
      c.restore();
      c.restore();
    }

    shorts(c, inc) {
      c.save();
      c.rotate(inc * 0.4);
      c.beginPath();
      c.moveTo(-37, -10);
      c.lineTo(39, -10);
      c.quadraticCurveTo(46, 14, 40, 34);
      c.lineTo(-36, 34);
      c.quadraticCurveTo(-44, 12, -37, -10);
      c.closePath();
      pintar(c, SHORT);
      c.fillStyle = this.camisa;
      c.fillRect(-24, -6, 7, 36);
      c.restore();
    }

    mochila(c, inc, atras) {
      c.save();
      c.rotate(inc);
      if (atras) {
        const fl = 0.85 + 0.2 * Math.sin(this.tempo * 46);
        c.globalCompositeOperation = "lighter";
        desenharChama(c, -60, -14, 210 * fl, 66, -1.25, 1);
        desenharChama(c, -40, -14, 170 * fl, 54, -1.4, 0.8);
        c.globalCompositeOperation = "source-over";
      } else {
        c.beginPath();
        c.roundRect(-74, -TRONCO + 4, 46, 92, 16);
        pintar(c, "#C9CED9");
        c.beginPath();
        c.roundRect(-70, -TRONCO + 20, 38, 22, 6);
        pintar(c, this.camisa);
        for (const bx of [-66, -46]) {
          c.beginPath();
          c.moveTo(bx - 7, -16); c.lineTo(bx + 9, -16); c.lineTo(bx + 12, -2); c.lineTo(bx - 10, -2);
          c.closePath();
          pintar(c, "#5D6475");
        }
      }
      c.restore();
    }

    desenharCabeca(c, ox, oy, p) {
      const h = this.cabeca;
      const alt = TRONCO * 1.6 + 20;
      if (!h) {
        c.beginPath();
        c.arc(ox + 6, oy - alt / 2 + 10, alt / 2.2, 0, TAU);
        pintar(c, this.r.pele);
        return;
      }
      const k = alt / ALTURA_CABECA;
      const balanco = 3 * Math.sin(this.fase * 2);
      c.save();
      c.translate(ox + 4, oy + 16 + balanco);
      c.rotate(p.cabeca - p.inc * 0.55);
      c.scale(k, k);
      c.drawImage(h.canvas, -h.queixo[0], -h.queixo[1]);
      c.restore();
    }

    estrelas(c, x, y, escala) {
      const t = this.tempo;
      const cx = x - 215 * escala, cy = y - 110 * escala;
      c.save();
      c.fillStyle = "#FFE14D";
      c.strokeStyle = TINTA;
      c.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        const a = t * 5 + (i * TAU) / 5;
        estrela(c, cx + Math.cos(a) * 80 * escala, cy + Math.sin(a) * 26 * escala - 60 * escala, 15 * escala);
        c.fill();
        c.stroke();
      }
      c.restore();
    }
  }

  raiz.Corredor = Corredor;
  raiz.RECORTE_CABECA = RECORTE;
  raiz.desenharChama = desenharChama;
  raiz.desenharEstrela = estrela;
})(window);
