/* Os chefões, desenhados por código no estilo adesivo: contorno grosso,
   cor chapada, uma sombra e um brilho. Cada um cabe numa caixa de ~640 px
   centrada na origem, com o chão em y = +330.

   `e` é o estado de animação que a cena passa a cada quadro:
     t (s), resp (-1..1, respiração), olhar {x, y} (-1..1), boca (0..1),
     piscar (0..1), furia (0..1), tonto (bool), fala (bool). */
"use strict";

const TINTA = "#1B1222";
const LW = 9;
const TAU = Math.PI * 2;

function misturar(a, b, t) {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  return "#" + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

function tracar(c, cor, lw = LW) {
  if (cor) { c.fillStyle = cor; c.fill(); }
  c.lineWidth = lw;
  c.strokeStyle = TINTA;
  c.stroke();
}

function elipse(c, x, y, rx, ry, rot = 0) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, TAU);
}

function retangulo(c, x, y, w, h, r) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

/* Sombra chapada: pinta a forma toda na cor escura e por cima a mesma
   forma deslocada na cor clara, recortada pela original. */
function sombrear(c, caminho, clara, escura, dx = -20, dy = -16) {
  c.save();
  caminho();
  c.fillStyle = escura;
  c.fill();
  c.clip();
  c.translate(dx, dy);
  caminho();
  c.fillStyle = clara;
  c.fill();
  c.restore();
  caminho();
  tracar(c, null);
}

function olho(c, x, y, rx, ry, e, o = {}) {
  const { pupila = TINTA, branco = "#FFFFFF", palpebra = "#000", raiva = 0.3, lado = 1, tamPupila = 0.46 } = o;
  c.save();
  elipse(c, x, y, rx, ry);
  c.fillStyle = branco;
  c.fill();
  c.save();
  c.clip();
  if (e.tonto) {
    c.strokeStyle = TINTA;
    c.lineWidth = Math.max(3, rx * 0.09);
    c.beginPath();
    for (let a = 0; a < 14; a += 0.2) {
      const r = a * rx * 0.055;
      const ang = a + e.t * 9 * lado;
      c.lineTo(x + Math.cos(ang) * r, y + Math.sin(ang) * r * (ry / rx));
    }
    c.stroke();
  } else {
    const px = x + e.olhar.x * rx * 0.36;
    const py = y + e.olhar.y * ry * 0.3;
    const pr = rx * tamPupila * (1 - e.furia * 0.25);
    elipse(c, px, py, pr, pr * 1.08);
    c.fillStyle = pupila;
    c.fill();
    elipse(c, px - pr * 0.35, py - pr * 0.4, pr * 0.32, pr * 0.32);
    c.fillStyle = "rgba(255,255,255,.95)";
    c.fill();
  }
  /* Pálpebra de raiva: corta o alto do olho em diagonal, mais baixo do lado do nariz. */
  const corte = raiva + e.furia * 0.25;
  c.fillStyle = palpebra;
  c.beginPath();
  c.moveTo(x - rx * 1.2, y - ry * 1.3);
  c.lineTo(x + rx * 1.2, y - ry * 1.3);
  c.lineTo(x + rx * 1.2, y - ry + ry * 2 * corte * (lado > 0 ? 0.25 : 1));
  c.lineTo(x - rx * 1.2, y - ry + ry * 2 * corte * (lado > 0 ? 1 : 0.25));
  c.closePath();
  c.fill();
  if (e.piscar > 0) c.fillRect(x - rx * 1.2, y - ry * 1.2, rx * 2.4, ry * 2.2 * e.piscar + ry * 0.2);
  c.restore();
  elipse(c, x, y, rx, ry);
  tracar(c, null, LW * 0.85);
  c.restore();
}

function sobrancelha(c, x, y, w, h, ang, cor = TINTA) {
  c.save();
  c.translate(x, y);
  c.rotate(-ang);
  retangulo(c, -w / 2, -h / 2, w, h, h / 2);
  c.fillStyle = cor;
  c.fill();
  c.restore();
}

/* Membro de "mangueira" (desenho animado antigo): curva grossa com contorno. */
function mangueira(c, x0, y0, cx, cy, x1, y1, grossura, cor) {
  c.save();
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(x0, y0);
  c.quadraticCurveTo(cx, cy, x1, y1);
  c.lineWidth = grossura + LW * 1.6;
  c.strokeStyle = TINTA;
  c.stroke();
  c.lineWidth = grossura;
  c.strokeStyle = cor;
  c.stroke();
  c.restore();
}

/* Luva branca de quatro dedos. `aberta` 0 = punho fechado, 1 = mão aberta. */
function luva(c, x, y, ang, s, aberta = 0) {
  c.save();
  c.translate(x, y);
  c.rotate(ang);
  c.scale(s, s);
  if (aberta > 0) {
    for (let i = 0; i < 3; i++) {
      const a = -0.5 + i * 0.5;
      c.save();
      c.rotate(a);
      retangulo(c, -11, -78, 22, 48, 11);
      tracar(c, "#FFFFFF", 6);
      c.restore();
    }
    retangulo(c, 20, -40, 18, 34, 9);
    tracar(c, "#FFFFFF", 6);
  }
  elipse(c, 0, -14, 38, 34);
  tracar(c, "#FFFFFF", 7);
  if (!aberta) {
    c.beginPath();
    c.moveTo(-18, -34); c.lineTo(-18, -12);
    c.moveTo(0, -38); c.lineTo(0, -14);
    c.moveTo(18, -34); c.lineTo(18, -12);
    c.lineWidth = 4;
    c.strokeStyle = TINTA;
    c.stroke();
  }
  retangulo(c, -30, 12, 60, 24, 10);
  tracar(c, "#F1ECE2", 7);
  c.restore();
}

/* ───────────────────────── O Boleto Gigante ───────────────────────── */

const CODIGO_BARRAS = [3, 1, 2, 1, 1, 3, 2, 1, 1, 2, 3, 1, 2, 2, 1, 1, 3, 1, 2, 1, 1, 2, 1, 3, 2, 1, 1, 2, 2, 1, 3, 1, 1, 2, 1, 2, 3, 1, 1, 2];

function boleto(c, e) {
  const t = e.t;
  const W = 232;
  const H = 300;
  const papel = misturar("#F7F0DC", "#F6C7B4", e.furia * 0.7);
  const papelSombra = misturar("#E2D3AE", "#E09A86", e.furia * 0.7);
  const onda = k => Math.sin(t * 2.3 + k) * 7;
  const vermelho = misturar("#D42A2A", "#A50E1A", e.furia);

  /* pernas e braços ficam atrás do papel */
  const passo = Math.sin(t * 3) * 6;
  mangueira(c, -80, H - 40, -95, H + 10, -120, H + 34 + passo, 18, TINTA);
  mangueira(c, 80, H - 40, 95, H + 10, 120, H + 34 - passo, 18, TINTA);
  for (const lado of [-1, 1]) {
    elipse(c, lado * 138, H + 44 + (lado < 0 ? passo : -passo), 54, 24);
    tracar(c, "#2A1E2E");
    elipse(c, lado * 128, H + 36 + (lado < 0 ? passo : -passo), 20, 7);
    c.fillStyle = "rgba(255,255,255,.35)";
    c.fill();
  }

  const soco = Math.sin(t * 7) * 14 * (0.6 + e.furia);
  mangueira(c, -W + 10, 20, -W - 70, 10, -W - 92, -70 + soco, 18, TINTA);
  luva(c, -W - 92, -78 + soco, -0.25 + Math.sin(t * 7) * 0.08, 1.05, 0);
  mangueira(c, W - 10, 30, W + 80, 70, W + 96, 130 + e.resp * 6, 18, TINTA);
  luva(c, W + 104, 128 + e.resp * 6, 2.6, 1.05, 1);

  const caminho = () => {
    c.beginPath();
    c.moveTo(-W + onda(0), -H);
    c.lineTo(W - 64, -H);
    c.lineTo(W + onda(1) * 0.4, -H + 64);
    c.quadraticCurveTo(W + onda(1) * 1.6, 0, W + onda(2), H);
    c.quadraticCurveTo(W * 0.5, H + 12 * Math.sin(t * 2.3), 0, H);
    c.quadraticCurveTo(-W * 0.5, H - 12 * Math.sin(t * 2.3), -W + onda(3), H);
    c.quadraticCurveTo(-W - onda(4) * 1.6, 0, -W + onda(0), -H);
    c.closePath();
  };
  sombrear(c, caminho, papel, papelSombra, -22, -16);

  c.save();
  caminho();
  c.clip();
  /* cabeçalho do banco */
  c.fillStyle = misturar("#ECE1C2", "#EBB7A3", e.furia * 0.7);
  c.fillRect(-W - 20, -H, W * 2 + 40, 78);
  c.fillStyle = "#BCA97F";
  c.fillRect(-W - 20, -H + 76, W * 2 + 40, 4);
  retangulo(c, -W + 22, -H + 15, 48, 48, 10);
  tracar(c, "#E8B923", 5);
  c.fillStyle = TINTA;
  c.font = "900 38px 'Big Shoulders Display', Impact, sans-serif";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText("$", -W + 46, -H + 41);
  c.textAlign = "left";
  c.font = "900 30px 'Big Shoulders Display', Impact, sans-serif";
  c.fillText("BANCO DO APERTO", -W + 84, -H + 41);
  c.fillStyle = "#BCA97F";
  c.fillRect(W - 116, -H + 14, 3, 50);
  c.fillStyle = TINTA;
  c.font = "800 24px 'Big Shoulders Display', Impact, sans-serif";
  c.fillText("001-9", W - 102, -H + 41);

  /* campos */
  c.fillStyle = "#BCA97F";
  c.fillRect(-W, -H + 142, W * 2, 3);
  c.fillRect(70, -H + 80, 3, 62);
  c.fillStyle = "#7C6B4C";
  c.font = "700 17px 'Figtree', sans-serif";
  c.fillText("Beneficiário", -W + 22, -H + 100);
  c.fillText("Vencimento", 86, -H + 100);
  c.fillStyle = TINTA;
  c.font = "800 24px 'Figtree', sans-serif";
  c.fillText("VOCÊ MESMO", -W + 22, -H + 126);
  c.fillStyle = vermelho;
  c.font = "900 32px 'Big Shoulders Display', Impact, sans-serif";
  c.fillText(e.furia > 0.5 ? "ONTEM" : "HOJE", 86, -H + 126);

  c.fillStyle = "#BCA97F";
  c.fillRect(-W, 182, W * 2, 3);
  c.fillStyle = "#7C6B4C";
  c.font = "700 17px 'Figtree', sans-serif";
  c.fillText("Valor do documento", 24, 206);
  c.fillStyle = TINTA;
  c.font = "900 38px 'Big Shoulders Display', Impact, sans-serif";
  c.fillText("R$ 9.999,99", 24, 244);
  c.restore();

  /* carimbo */
  c.save();
  c.translate(-110, 232);
  c.rotate(-0.16 + Math.sin(t * 1.3) * 0.01);
  c.globalAlpha = 0.88;
  const carimbo = e.furia > 0.5 ? "PROTESTADO" : "VENCE HOJE";
  c.font = "900 40px 'Big Shoulders Display', Impact, sans-serif";
  const larg = c.measureText(carimbo).width + 34;
  retangulo(c, -larg / 2, -30, larg, 60, 10);
  c.lineWidth = 6;
  c.strokeStyle = vermelho;
  c.stroke();
  c.fillStyle = vermelho;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(carimbo, 0, 2);
  c.restore();

  /* rosto */
  const susto = e.piscar;
  for (const lado of [-1, 1]) {
    olho(c, lado * 92, -58, 58, 60, e, { lado, palpebra: papel, raiva: 0.28, branco: "#FFFFFF" });
    sobrancelha(c, lado * 96, -132 + (e.furia ? -4 : 0) + susto * 6, 120, 26 + e.furia * 6, lado * (0.32 + e.furia * 0.12));
  }

  const abre = 44 + e.boca * 44;
  const boca = () => {
    c.beginPath();
    c.moveTo(-160, 50);
    c.quadraticCurveTo(0, 36, 160, 50);
    c.quadraticCurveTo(150, 50 + abre, 0, 54 + abre);
    c.quadraticCurveTo(-150, 50 + abre, -160, 50);
    c.closePath();
  };
  boca();
  c.fillStyle = "#3A0D16";
  c.fill();
  c.save();
  boca();
  c.clip();
  elipse(c, 0, 64 + abre, 90, 34);
  c.fillStyle = "#D9455A";
  c.fill();
  c.fillStyle = "#FFFFFF";
  c.fillRect(-170, 34, 340, 46);
  let x = -150;
  c.fillStyle = TINTA;
  for (let i = 0; x < 150; i++) {
    const w = CODIGO_BARRAS[i % CODIGO_BARRAS.length] * 3.2;
    if (i % 2 === 0) c.fillRect(x, 34, w, 42);
    x += w + 2.6;
  }
  c.restore();
  boca();
  tracar(c, null);
}

/* ───────────────────────── O Chefe do Trabalho ───────────────────────── */

function chefe(c, e) {
  const t = e.t;
  const pele = misturar("#F1BE97", "#EE7563", e.furia * 0.85);
  const peleSombra = misturar("#D99C76", "#C9503F", e.furia * 0.85);
  const terno = "#2B3756";
  const ternoSombra = "#1E2740";
  const pelo = "#33241C";
  const cab = e.resp * 5;

  /* braço do dedo em riste (atrás do corpo) */
  const sermao = Math.sin(t * (6 + e.furia * 5)) * 0.18;
  mangueira(c, 210, 40, 330, 120, 318, -20, 64, terno);
  c.save();
  c.translate(318, -30);
  c.rotate(sermao);
  retangulo(c, -10, -112, 24, 76, 12);
  tracar(c, pele, 7);
  elipse(c, 0, -14, 40, 42);
  tracar(c, pele, 7);
  c.beginPath();
  c.moveTo(-16, -34); c.lineTo(10, -34);
  c.moveTo(-18, -14); c.lineTo(12, -14);
  c.lineWidth = 4; c.strokeStyle = peleSombra; c.stroke();
  c.restore();

  /* braço da caneca */
  mangueira(c, -210, 40, -340, 110, -300, 6 + cab, 64, terno);

  /* corpo */
  const corpo = () => {
    c.beginPath();
    c.moveTo(-270, 230);
    c.lineTo(-262, 70);
    c.quadraticCurveTo(-250, -6, -130, -18);
    c.lineTo(130, -18);
    c.quadraticCurveTo(250, -6, 262, 70);
    c.lineTo(270, 230);
    c.closePath();
  };
  c.save();
  c.translate(0, 230);
  c.scale(1 + e.resp * 0.018, 1 + e.resp * 0.025);
  c.translate(0, -230);
  sombrear(c, corpo, terno, ternoSombra, -24, -10);
  /* camisa e barriga */
  const camisa = () => {
    c.beginPath();
    c.moveTo(-76, -18);
    c.lineTo(76, -18);
    c.quadraticCurveTo(170, 120, 132, 232);
    c.lineTo(-132, 232);
    c.quadraticCurveTo(-170, 120, -76, -18);
    c.closePath();
  };
  sombrear(c, camisa, "#EEF2F8", "#C8D1E0", -16, -10);
  for (const y of [70, 130, 190]) {
    elipse(c, 46, y, 7, 7);
    tracar(c, "#FFFFFF", 4);
  }
  /* lapelas */
  for (const lado of [-1, 1]) {
    c.beginPath();
    c.moveTo(lado * 76, -18);
    c.lineTo(lado * 128, 40);
    c.lineTo(lado * 96, 70);
    c.lineTo(lado * 140, 232);
    c.lineTo(lado * 128, 232);
    c.quadraticCurveTo(lado * 166, 120, lado * 76, -18);
    tracar(c, "#36456B", 7);
  }
  /* gravata */
  c.beginPath();
  c.moveTo(-22, 8);
  c.lineTo(22, 8);
  c.lineTo(36, 168);
  c.lineTo(0, 204);
  c.lineTo(-36, 168);
  c.closePath();
  c.save();
  c.fillStyle = "#C8202F";
  c.fill();
  c.clip();
  c.strokeStyle = "#E8505C";
  c.lineWidth = 10;
  for (let y = -10; y < 240; y += 34) {
    c.beginPath(); c.moveTo(-50, y); c.lineTo(50, y + 30); c.stroke();
  }
  c.restore();
  tracar(c, null, 7);
  retangulo(c, -26, -14, 52, 30, 10);
  tracar(c, "#B01828", 7);
  /* gola */
  for (const lado of [-1, 1]) {
    c.beginPath();
    c.moveTo(lado * 8, -22);
    c.lineTo(lado * 80, -30);
    c.lineTo(lado * 52, 20);
    c.closePath();
    tracar(c, "#FFFFFF", 7);
  }
  c.restore();

  /* mesa */
  c.beginPath();
  c.moveTo(-330, 196); c.lineTo(330, 196); c.lineTo(310, 222); c.lineTo(-310, 222); c.closePath();
  tracar(c, "#B07A50", 8);
  retangulo(c, -310, 222, 620, 112, 8);
  tracar(c, "#8A5A38", 8);
  c.fillStyle = "rgba(0,0,0,.12)";
  c.fillRect(-306, 226, 612, 14);
  retangulo(c, -120, 248, 240, 56, 8);
  tracar(c, "#E6B53C", 6);
  retangulo(c, -110, 256, 220, 40, 5);
  c.fillStyle = "#F4CF62";
  c.fill();
  c.fillStyle = TINTA;
  c.font = "900 34px 'Big Shoulders Display', Impact, sans-serif";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText("SR. CHEFE", 0, 278);
  /* pilha de papel */
  for (let i = 0; i < 5; i++) {
    retangulo(c, -290 + (i % 2) * 6, 176 - i * 12, 120, 16, 3);
    tracar(c, i % 2 ? "#FFFFFF" : "#F1EDE4", 5);
  }

  /* caneca */
  c.save();
  c.translate(-300, 0 + cab);
  c.rotate(-0.08 + Math.sin(t * 2) * 0.04);
  for (let i = 0; i < 3; i++) {
    const s = (t * 0.7 + i / 3) % 1;
    c.beginPath();
    c.moveTo(-16 + i * 16, -64 - s * 70);
    c.quadraticCurveTo(-4 + i * 16 + Math.sin(t * 3 + i) * 10, -84 - s * 70, -16 + i * 16, -104 - s * 70);
    c.lineWidth = 6;
    c.strokeStyle = `rgba(255,255,255,${0.55 * (1 - s)})`;
    c.stroke();
  }
  elipse(c, 58, -6, 26, 30);
  c.lineWidth = 20; c.strokeStyle = TINTA; c.stroke();
  c.lineWidth = 10; c.strokeStyle = "#FFFFFF"; c.stroke();
  retangulo(c, -54, -60, 108, 112, 14);
  tracar(c, "#FFFFFF", 8);
  c.fillStyle = "#C8202F";
  c.font = "900 30px 'Big Shoulders Display', Impact, sans-serif";
  c.fillText("Nº1", 0, -20);
  c.font = "900 22px 'Big Shoulders Display', Impact, sans-serif";
  c.fillText("CHEFE", 0, 10);
  c.restore();
  elipse(c, -300, 48 + cab, 40, 30);
  tracar(c, pele, 7);

  /* cabeça */
  c.save();
  c.translate(0, cab);
  for (const lado of [-1, 1]) {
    elipse(c, lado * 150, -140, 30, 42);
    tracar(c, pele, 8);
    c.beginPath();
    c.moveTo(lado * 140, -110);
    c.quadraticCurveTo(lado * 172, -150, lado * 138, -176);
    c.quadraticCurveTo(lado * 160, -200, lado * 128, -210);
    c.lineTo(lado * 116, -140);
    c.closePath();
    tracar(c, "#9D9AA4", 6);
  }
  const cabeca = () => elipse(c, 0, -150, 148, 168);
  sombrear(c, cabeca, pele, peleSombra, -26, -14);
  c.save();
  cabeca();
  c.clip();
  elipse(c, -48, -268, 50, 22, -0.3);
  c.fillStyle = "rgba(255,255,255,.55)";
  c.fill();
  c.restore();
  /* papada */
  c.beginPath();
  c.moveTo(-70, -6);
  c.quadraticCurveTo(0, 26, 70, -6);
  c.lineWidth = 6; c.strokeStyle = peleSombra; c.stroke();
  /* fios do penteado */
  c.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    c.moveTo(-122, -232 + i * 16);
    c.quadraticCurveTo(-10, -340 + i * 22 + Math.sin(t * 2 + i) * 4, 110, -250 + i * 12);
    c.lineWidth = 9; c.strokeStyle = pelo; c.stroke();
  }

  /* óculos e olhos */
  const susto = e.piscar;
  for (const lado of [-1, 1]) {
    retangulo(c, lado * 70 - 56, -196, 112, 82, 24);
    c.fillStyle = "rgba(220,240,255,.85)";
    c.fill();
    olho(c, lado * 70, -154, 30, 32, e, { lado, palpebra: "rgba(220,240,255,1)", raiva: 0.26, tamPupila: 0.55 });
    c.save();
    retangulo(c, lado * 70 - 56, -196, 112, 82, 24);
    c.clip();
    c.beginPath();
    c.moveTo(lado * 70 - 40, -120); c.lineTo(lado * 70 + 10, -200); c.lineTo(lado * 70 + 34, -200); c.lineTo(lado * 70 - 16, -120);
    c.fillStyle = "rgba(255,255,255,.55)";
    c.fill();
    c.restore();
    retangulo(c, lado * 70 - 56, -196, 112, 82, 24);
    c.lineWidth = 10; c.strokeStyle = TINTA; c.stroke();
    sobrancelha(c, lado * 74, -214 + susto * 6 - (e.fala ? Math.abs(Math.sin(t * 8)) * 6 : 0), 108, 24, lado * (0.28 + e.furia * 0.16), pelo);
  }
  c.beginPath();
  c.moveTo(-14, -164); c.quadraticCurveTo(0, -176, 14, -164);
  c.lineWidth = 10; c.strokeStyle = TINTA; c.stroke();

  /* nariz, bigode e boca */
  elipse(c, 0, -102, 40, 34);
  tracar(c, peleSombra, 7);
  elipse(c, -12, -114, 12, 8);
  c.fillStyle = "rgba(255,255,255,.4)";
  c.fill();
  const abre = 6 + e.boca * 34;
  elipse(c, 0, -34 + abre * 0.4, 52, abre);
  tracar(c, "#4A1620", 7);
  if (abre > 14) {
    c.save();
    elipse(c, 0, -34 + abre * 0.4, 52, abre);
    c.clip();
    c.fillStyle = "#FFFFFF";
    c.fillRect(-52, -34 + abre * 0.4 - abre, 104, 14);
    c.restore();
  }
  const bigode = Math.sin(t * 9) * (e.fala ? 3 : 0);
  c.beginPath();
  c.moveTo(0, -74 + bigode);
  c.bezierCurveTo(-40, -90, -96, -76, -100, -40 + bigode);
  c.bezierCurveTo(-70, -56, -30, -46, 0, -58 + bigode);
  c.bezierCurveTo(30, -46, 70, -56, 100, -40 + bigode);
  c.bezierCurveTo(96, -76, 40, -90, 0, -74 + bigode);
  tracar(c, pelo, 7);

  /* fúria: veia e vapor */
  if (e.furia > 0.05) {
    c.save();
    c.globalAlpha = Math.min(1, e.furia * 1.4);
    c.translate(84, -262);
    c.scale(1 + Math.sin(t * 10) * 0.08, 1 + Math.sin(t * 10) * 0.08);
    c.strokeStyle = "#B3122A";
    c.lineWidth = 9;
    for (let i = 0; i < 4; i++) {
      c.save();
      c.rotate(i * Math.PI / 2);
      c.beginPath();
      c.moveTo(8, -22); c.quadraticCurveTo(8, -8, 22, -8);
      c.stroke();
      c.restore();
    }
    c.restore();
    for (const lado of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const s = (t * 1.6 + i / 3) % 1;
        elipse(c, lado * (180 + s * 40), -170 - s * 90, 14 + s * 22, 12 + s * 18);
        c.fillStyle = `rgba(255,255,255,${0.75 * (1 - s) * e.furia})`;
        c.fill();
      }
    }
  }
  c.restore();
}

/* ───────────────────────── O Mosquito da Dengue Rei ───────────────────────── */

function mosquito(c, e) {
  const t = e.t;
  const voo = Math.sin(t * 2.4) * 14;
  const corpo = "#2E2935";
  const corpoSombra = "#1C1822";
  const listra = "#ECE8F2";
  c.save();
  c.translate(0, voo - 30);

  /* asas, com rastro de movimento */
  const velocidade = 34 + e.furia * 18;
  const bate = Math.sin(t * velocidade);
  for (const lado of [-1, 1]) {
    for (const [desvio, alfa] of [[-0.3, 0.1], [0.3, 0.1], [0, 1]]) {
      c.save();
      c.translate(lado * 44, -96);
      c.rotate(lado * (-0.55 + bate * 0.22 + desvio));
      elipse(c, lado * 200, 0, 205, 68);
      c.fillStyle = `rgba(205,232,255,${0.32 * alfa})`;
      c.fill();
      c.lineWidth = 5;
      c.strokeStyle = `rgba(27,18,34,${0.6 * alfa})`;
      c.stroke();
      if (alfa === 1) {
        c.beginPath();
        c.moveTo(lado * 10, 0); c.quadraticCurveTo(lado * 200, -30, lado * 380, -8);
        c.moveTo(lado * 60, 10); c.quadraticCurveTo(lado * 200, 40, lado * 340, 30);
        c.moveTo(lado * 160, -14); c.lineTo(lado * 230, 46);
        c.lineWidth = 3;
        c.strokeStyle = "rgba(27,18,34,.35)";
        c.stroke();
        elipse(c, lado * 150, -26, 80, 14, lado * -0.05);
        c.fillStyle = "rgba(255,255,255,.35)";
        c.fill();
      }
      c.restore();
    }
  }

  /* capa real */
  const vento = Math.sin(t * 1.8);
  c.beginPath();
  c.moveTo(-112, -100);
  c.quadraticCurveTo(-200, 60, -186 + vento * 10, 250);
  c.quadraticCurveTo(-120, 270 + vento * 8, -60, 248);
  c.quadraticCurveTo(0, 276 - vento * 8, 60, 248);
  c.quadraticCurveTo(120, 270 + vento * 8, 186 - vento * 10, 250);
  c.quadraticCurveTo(200, 60, 112, -100);
  c.closePath();
  sombrear(c, () => {
    c.beginPath();
    c.moveTo(-112, -100);
    c.quadraticCurveTo(-200, 60, -186 + vento * 10, 250);
    c.quadraticCurveTo(-120, 270 + vento * 8, -60, 248);
    c.quadraticCurveTo(0, 276 - vento * 8, 60, 248);
    c.quadraticCurveTo(120, 270 + vento * 8, 186 - vento * 10, 250);
    c.quadraticCurveTo(200, 60, 112, -100);
    c.closePath();
  }, "#C21A31", "#8A0F21", 22, -10);

  /* pernas */
  const perna = (lado, i) => {
    const y0 = -30 + i * 34;
    const balanco = Math.sin(t * 2.4 + i + lado) * 10;
    const jx = lado * (220 + i * 14);
    const jy = y0 + 40 - i * 10;
    const px = lado * (250 + i * 26);
    const py = y0 + 250 + balanco - i * 20;
    c.save();
    c.lineCap = "round";
    c.lineJoin = "round";
    c.beginPath();
    c.moveTo(lado * 80, y0);
    c.lineTo(jx, jy);
    c.lineTo(px, py);
    c.lineWidth = 22; c.strokeStyle = TINTA; c.stroke();
    c.lineWidth = 12; c.strokeStyle = corpo; c.stroke();
    c.setLineDash([12, 22]);
    c.lineDashOffset = i * 7;
    c.lineWidth = 12; c.strokeStyle = listra; c.stroke();
    c.restore();
  };
  for (let i = 0; i < 3; i++) { perna(-1, i); perna(1, i); }

  /* abdômen listrado */
  const abdomen = () => elipse(c, 0, 120, 96, 170);
  abdomen();
  c.fillStyle = corpo;
  c.fill();
  c.save();
  abdomen();
  c.clip();
  c.fillStyle = listra;
  for (let y = 10; y < 300; y += 50) {
    c.beginPath();
    c.ellipse(0, y, 120, 26, 0, 0.15 * Math.PI, 0.85 * Math.PI);
    c.ellipse(0, y + 12, 120, 26, 0, 0.85 * Math.PI, 0.15 * Math.PI, true);
    c.fill();
  }
  c.fillStyle = "rgba(0,0,0,.28)";
  c.fillRect(30, -60, 120, 400);
  c.restore();
  abdomen();
  tracar(c, null);

  /* tórax com a lira branca */
  const torax = () => elipse(c, 0, -48, 124, 96);
  sombrear(c, torax, corpo, corpoSombra, -18, -14);
  c.save();
  c.lineCap = "round";
  c.strokeStyle = listra;
  c.lineWidth = 9;
  c.beginPath();
  c.moveTo(-40, -110); c.quadraticCurveTo(-82, -50, -36, 0);
  c.moveTo(40, -110); c.quadraticCurveTo(82, -50, 36, 0);
  c.moveTo(-8, -100); c.lineTo(-8, -20);
  c.moveTo(8, -100); c.lineTo(8, -20);
  c.stroke();
  c.restore();
  /* gola de arminho */
  for (let i = -4; i <= 4; i++) {
    elipse(c, i * 26, -128 + Math.abs(i) * 6, 22, 18);
    tracar(c, "#FFFFFF", 5);
    if (i % 2 === 0) {
      elipse(c, i * 26, -126 + Math.abs(i) * 6, 4, 7);
      c.fillStyle = TINTA;
      c.fill();
    }
  }

  /* cabeça */
  const cabeca = () => elipse(c, 0, -196, 104, 92);
  sombrear(c, cabeca, corpo, corpoSombra, -18, -12);
  const brilho = e.furia > 0.05;
  for (const lado of [-1, 1]) {
    c.save();
    if (brilho) { c.shadowColor = "rgba(255,40,60,.9)"; c.shadowBlur = 30 * e.furia; }
    olho(c, lado * 52, -204, 54, 60, e, { lado, branco: misturar("#E8475A", "#FF6A3A", e.furia), palpebra: corpo, raiva: 0.32, pupila: "#1A0A10", tamPupila: 0.4 });
    c.restore();
    c.save();
    elipse(c, lado * 52, -204, 54, 60);
    c.clip();
    c.fillStyle = "rgba(90,0,20,.18)";
    for (let k = 0; k < 18; k++) {
      elipse(c, lado * 52 + ((k % 6) - 2.5) * 18, -230 + Math.floor(k / 6) * 22 + (k % 2) * 8, 5, 5);
      c.fill();
    }
    c.restore();
  }
  /* boca e tromba-espada */
  const abre = 4 + e.boca * 20;
  elipse(c, 0, -134, 30, abre);
  tracar(c, "#4A1620", 6);
  c.save();
  c.translate(0, -130);
  c.rotate(-1.2 + Math.sin(t * 1.5) * 0.04);
  c.beginPath();
  c.moveTo(-9, 0); c.lineTo(9, 0); c.lineTo(2, 250); c.lineTo(-2, 250);
  c.closePath();
  tracar(c, "#3A3442", 6);
  c.beginPath();
  c.moveTo(-3, 10); c.lineTo(-1, 220);
  c.lineWidth = 3; c.strokeStyle = "rgba(255,255,255,.6)"; c.stroke();
  c.restore();

  /* antenas */
  for (const lado of [-1, 1]) {
    c.save();
    c.lineCap = "round";
    const balanco = Math.sin(t * 3 + lado) * 8;
    c.beginPath();
    c.moveTo(lado * 30, -276);
    c.quadraticCurveTo(lado * 60, -340, lado * 118 + balanco, -350);
    c.lineWidth = 8; c.strokeStyle = TINTA; c.stroke();
    for (let k = 1; k < 7; k++) {
      const s = k / 7;
      const ax = lado * (30 + (88 + balanco * lado) * s);
      const ay = -276 - 70 * Math.sin(s * Math.PI * 0.55);
      c.beginPath();
      c.moveTo(ax, ay); c.lineTo(ax - lado * 8, ay - 18);
      c.moveTo(ax, ay); c.lineTo(ax + lado * 14, ay + 6);
      c.lineWidth = 4; c.stroke();
    }
    c.restore();
  }

  /* coroa */
  c.save();
  c.translate(-8, -282 + Math.sin(t * 2.4 + 0.6) * 4);
  c.rotate(-0.14);
  c.beginPath();
  c.moveTo(-70, 10);
  c.lineTo(-80, -50); c.lineTo(-44, -20); c.lineTo(-22, -70); c.lineTo(0, -26);
  c.lineTo(22, -70); c.lineTo(44, -20); c.lineTo(80, -50); c.lineTo(70, 10);
  c.closePath();
  sombrear(c, () => {
    c.beginPath();
    c.moveTo(-70, 10);
    c.lineTo(-80, -50); c.lineTo(-44, -20); c.lineTo(-22, -70); c.lineTo(0, -26);
    c.lineTo(22, -70); c.lineTo(44, -20); c.lineTo(80, -50); c.lineTo(70, 10);
    c.closePath();
  }, "#F7C531", "#C98E0C", 10, -8);
  retangulo(c, -72, -6, 144, 22, 6);
  tracar(c, "#E2A913", 6);
  [[-40, 5, "#2E7DF2"], [0, 5, "#E8283F"], [40, 5, "#2E7DF2"]].forEach(([x, y, cor]) => {
    elipse(c, x, y, 9, 9);
    tracar(c, cor, 4);
  });
  [-80, -22, 22, 80].forEach(x => {
    elipse(c, x, x === -80 || x === 80 ? -50 : -70, 8, 8);
    tracar(c, "#FFF2B8", 4);
  });
  c.restore();
  c.restore();
}

/* ───────────────────────── O Ônibus Lotado ───────────────────────── */

const PELES = ["#F1C09A", "#C98B5E", "#8D5A3B", "#E6A77F", "#5E3A26", "#F3CFAE"];

function onibus(c, e) {
  const t = e.t;
  const mola = e.resp * 6 + (e.furia ? Math.sin(t * 30) * 2 * e.furia : 0);
  const amarelo = misturar("#F7B500", "#F28A1A", e.furia * 0.6);
  const amareloSombra = misturar("#D48F00", "#C9600E", e.furia * 0.6);

  /* rodas */
  for (const lado of [-1, 1]) {
    retangulo(c, lado * 176 - 56, 236, 112, 104, 24);
    tracar(c, "#221C26");
    c.fillStyle = "#3C3442";
    for (let k = 0; k < 4; k++) c.fillRect(lado * 176 - 44, 256 + k * 20, 88, 8);
  }

  /* braços pra fora da janela */
  for (const lado of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const y = -150 + i * 72 + mola;
      const aceno = Math.sin(t * (3 + i) + i * 2 + lado) * 18;
      const pele = PELES[(i * 2 + (lado > 0 ? 1 : 0)) % PELES.length];
      mangueira(c, lado * 240, y, lado * 300, y - 10, lado * (330 + i * 8), y - 50 + aceno, 22, pele);
      elipse(c, lado * (334 + i * 8), y - 60 + aceno, 22, 22);
      tracar(c, pele, 7);
    }
  }

  c.save();
  c.translate(0, mola);

  /* retrovisores */
  for (const lado of [-1, 1]) {
    c.save();
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(lado * 240, -240);
    c.quadraticCurveTo(lado * 300, -270, lado * 300, -210);
    c.lineWidth = 16; c.strokeStyle = TINTA; c.stroke();
    c.restore();
    retangulo(c, lado * 300 - 26, -230, 52, 86, 16);
    tracar(c, "#2A2430", 8);
    retangulo(c, lado * 300 - 16, -220, 32, 66, 10);
    c.fillStyle = "#8FB7CC";
    c.fill();
  }

  const lata = () => retangulo(c, -250, -320, 500, 580, 54);
  sombrear(c, lata, amarelo, amareloSombra, -24, -14);
  c.save();
  lata();
  c.clip();
  c.fillStyle = "#1F5FBF";
  c.fillRect(-260, 150, 520, 50);
  c.fillStyle = "#FFFFFF";
  c.fillRect(-260, 140, 520, 8);
  c.restore();

  /* letreiro */
  retangulo(c, -196, -302, 392, 74, 14);
  tracar(c, "#14101A", 8);
  const letreiro = e.furia > 0.5 ? "EXPRESSO" : "LOTADO";
  const pisca = e.furia > 0.5 && Math.sin(t * 10) < -0.2;
  c.save();
  c.font = "900 52px 'Big Shoulders Display', Impact, sans-serif";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillStyle = pisca ? "#5A1A10" : e.furia > 0.5 ? "#FF4A2A" : "#FFB020";
  c.shadowColor = c.fillStyle;
  c.shadowBlur = pisca ? 0 : 18;
  c.fillText(letreiro, 26, -264);
  c.font = "900 30px 'Big Shoulders Display', Impact, sans-serif";
  c.fillText("875", -150, -264);
  c.restore();
  c.save();
  retangulo(c, -190, -296, 380, 62, 10);
  c.clip();
  c.fillStyle = "rgba(20,16,26,.55)";
  for (let x = -190; x < 190; x += 6) c.fillRect(x, -300, 2, 70);
  for (let y = -296; y < -230; y += 6) c.fillRect(-196, y, 392, 2);
  c.restore();

  /* para-brisa com o povo apertado lá dentro */
  for (const lado of [-1, 1]) {
    const vidro = () => {
      c.beginPath();
      c.moveTo(lado * 14, -214);
      c.lineTo(lado * 222, -214);
      c.quadraticCurveTo(lado * 232, -214, lado * 232, -200);
      c.lineTo(lado * 236, 0);
      c.quadraticCurveTo(lado * 236, 14, lado * 222, 14);
      c.lineTo(lado * 14, 14);
      c.closePath();
    };
    vidro();
    const g = c.createLinearGradient(0, -214, 0, 14);
    g.addColorStop(0, "#2A5568");
    g.addColorStop(1, "#173341");
    c.fillStyle = g;
    c.fill();
    c.save();
    vidro();
    c.clip();
    c.fillStyle = "#0E2029";
    for (let k = 0; k < 6; k++) {
      const hx = lado * (40 + k * 36);
      const hy = -20 + (k % 2) * 14 + Math.sin(t * 2 + k) * 3;
      elipse(c, hx, hy, 22, 26);
      c.fill();
      c.fillRect(hx - 30, hy + 18, 60, 40);
    }
    c.strokeStyle = "#0E2029";
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(lado * 20, -150); c.lineTo(lado * 236, -150);
    c.stroke();
    c.beginPath();
    c.moveTo(lado * 60, -214); c.lineTo(lado * 150, 14); c.lineTo(lado * 190, 14); c.lineTo(lado * 100, -214);
    c.fillStyle = "rgba(255,255,255,.1)";
    c.fill();
    c.restore();
    vidro();
    tracar(c, null);
  }

  /* olhos no vidro e limpadores-sobrancelha */
  const susto = e.piscar;
  for (const lado of [-1, 1]) {
    olho(c, lado * 116, -98, 66, 70, e, { lado, palpebra: "#1F4252", raiva: 0.26 });
    c.save();
    c.translate(lado * 116, -186 + susto * 8);
    c.rotate(-lado * (0.26 + e.furia * 0.14));
    retangulo(c, -86, -9, 172, 18, 9);
    c.fillStyle = TINTA;
    c.fill();
    c.restore();
  }

  /* faróis */
  for (const lado of [-1, 1]) {
    elipse(c, lado * 190, 76, 42, 42);
    tracar(c, "#C9CED6", 8);
    elipse(c, lado * 190, 76, 28, 28);
    c.save();
    c.shadowColor = e.furia > 0.5 ? "#FF5030" : "#FFE9A0";
    c.shadowBlur = 24;
    c.fillStyle = e.furia > 0.5 ? "#FFB09A" : "#FFF6D0";
    c.fill();
    c.restore();
  }

  /* boca-grade */
  const abre = 42 + e.boca * 50;
  const boca = () => {
    c.beginPath();
    c.moveTo(-128, 52);
    c.quadraticCurveTo(0, 40, 128, 52);
    c.quadraticCurveTo(122, 52 + abre, 0, 56 + abre);
    c.quadraticCurveTo(-122, 52 + abre, -128, 52);
    c.closePath();
  };
  boca();
  c.fillStyle = "#2A0A12";
  c.fill();
  c.save();
  boca();
  c.clip();
  elipse(c, 0, 64 + abre, 70, 26);
  c.fillStyle = "#C9364A";
  c.fill();
  c.fillStyle = "#D6DBE2";
  c.fillRect(-140, 36, 280, 30);
  c.fillStyle = "#8A93A0";
  for (let x = -120; x <= 120; x += 30) c.fillRect(x - 3, 36, 6, 30);
  c.restore();
  boca();
  tracar(c, null);

  /* para-choque e placa */
  retangulo(c, -262, 214, 524, 52, 20);
  tracar(c, "#3A3440");
  retangulo(c, -84, 220, 168, 40, 6);
  tracar(c, "#FFFFFF", 5);
  c.fillStyle = "#1D4FB0";
  c.fillRect(-81, 223, 162, 10);
  c.fillStyle = "#FFFFFF";
  c.font = "800 9px 'Figtree', sans-serif";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText("BRASIL", 0, 228.5);
  c.fillStyle = TINTA;
  c.font = "900 26px 'Big Shoulders Display', Impact, sans-serif";
  c.fillText("LOT4D0", 0, 248);
  c.restore();
}

/* Onde fica cada coisa em cada chefão (coordenadas da arte): cabeça pro
   balão e pras estrelas de tontura, ponto fraco, área que os golpes acertam. */
const ARTE = {
  boleto: { desenhar: boleto, cabeca: { x: 0, y: -250 }, pontoFraco: { x: 0, y: 70 }, alvo: { x: 0, y: -40, rx: 200, ry: 240 }, cor: "#E23B3B" },
  chefe: { desenhar: chefe, cabeca: { x: 0, y: -300 }, pontoFraco: { x: 0, y: -100 }, alvo: { x: 0, y: -80, rx: 200, ry: 220 }, cor: "#2F5FD0" },
  mosquito: { desenhar: mosquito, cabeca: { x: 0, y: -330 }, pontoFraco: { x: 0, y: 100 }, alvo: { x: 0, y: -60, rx: 170, ry: 230 }, cor: "#C8283A" },
  onibus: { desenhar: onibus, cabeca: { x: 0, y: -310 }, pontoFraco: { x: 0, y: 90 }, alvo: { x: 0, y: -40, rx: 210, ry: 230 }, cor: "#F2A81D" },
};

if (typeof module !== "undefined") module.exports = { ARTE, misturar };
