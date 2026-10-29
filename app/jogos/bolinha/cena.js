/* O desenho da máquina em canvas: fundo neon que respira, gabinete, pinos,
   bolinhas com a foto de quem jogou, rastros, potes, faíscas e textos.
   O que não muda (gabinete, vidro, estrelas) é pintado uma vez num canvas
   de fundo; bolinha e brilho de pino viram sprite em cache. */
"use strict";

const COR_POTE = { 50: "#FF2E88", 20: "#FF7A2E", 10: "#FFD12E", 5: "#5CFF8A", 2: "#2EE6FF", 1: "#8C7BFF" };
const OURO = "#FFD24A";

function corDoPote(v) {
  const chaves = Object.keys(COR_POTE).map(Number).sort((a, b) => b - a);
  for (const k of chaves) if (v >= k) return COR_POTE[k];
  return COR_POTE[1];
}

function encurtar(texto, n) {
  const chars = [...String(texto || "")];
  return chars.length > n ? chars.slice(0, n - 1).join("") + "…" : chars.join("");
}

function inicial(nome) {
  const limpo = String(nome || "?").replace(/^[^\p{L}\p{N}]+/u, "");
  return ([...limpo][0] || "?").toUpperCase();
}

function arredondado(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function telaNova(w, h) {
  const t = document.createElement("canvas");
  t.width = Math.ceil(w);
  t.height = Math.ceil(h);
  return t;
}

const Cena = {
  W: 1080, H: 1920,
  tremor: 0,
  flash: 0,
  flashCor: "#FFFFFF",
  particulas: [],
  textos: [],
  aneis: [],
  potesPulo: [],
  rastros: new Map(),
  fotos: new Map(),
  sprites: new Map(),
  brilhos: new Map(),

  montar(canvas) {
    this.canvas = canvas;
    this.c = canvas.getContext("2d");
  },

  /* `desce`: em celular mais comprido que 9:16 a mesa desce junto com o HUD. */
  aplicarFormato(W, H, mesa, potes, zoom = 1, desce = 0) {
    this.W = W;
    this.H = H;
    this.zoom = zoom;
    this.desce = desce;
    this.canvas.width = W;
    this.canvas.height = H;
    this.mesa = mesa;
    this.valores = potes;
    this.potesPulo = potes.map(() => ({ y: 0, v: 0, luz: 0 }));
    this.rastros.clear();
    this.particulas = [];
    this.textos = [];
    this.fundo = this.pintarFundo();
  },

  /* ───────── o que não muda ───────── */

  moldura() {
    const d = this.mesa.dims;
    const m = 24;
    return { x: d.x0 - m, y: d.topo - 34, w: d.x1 - d.x0 + 2 * m, h: d.poteFundo - d.topo + 34 + 22 };
  },

  pintarFundo() {
    const { W, H } = this;
    const t = telaNova(W, H);
    const c = t.getContext("2d");
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0A0320");
    g.addColorStop(0.5, "#140838");
    g.addColorStop(1, "#07021A");
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);

    /* Estrelas fixas: dão profundidade sem roubar a atenção. */
    let s = 9;
    const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 220; i++) {
      c.globalAlpha = 0.15 + r() * 0.45;
      c.fillStyle = r() < 0.2 ? "#9FE8FF" : "#FFFFFF";
      const tam = r() < 0.9 ? 1.5 : 3;
      c.fillRect(r() * W, r() * H, tam, tam);
    }
    c.globalAlpha = 1;

    /* Daqui pra baixo, tudo em px da mesa. */
    const z = this.zoom;
    c.setTransform(z, 0, 0, z, 0, this.desce);
    const f = this.moldura();
    const vertical = H > W;

    /* Corpo do gabinete descendo até o pé da tela no vertical. */
    if (vertical) {
      const base = c.createLinearGradient(0, f.y + f.h, 0, H);
      base.addColorStop(0, "#1B0B45");
      base.addColorStop(1, "#0B0424");
      c.fillStyle = base;
      arredondado(c, f.x - 6, f.y + f.h - 30, f.w + 12, (H - this.desce) / z - f.y - f.h + 80, 34);
      c.fill();
      c.strokeStyle = "rgba(255,61,154,.35)";
      c.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        const y = f.y + f.h + 90 + i * 120;
        c.beginPath();
        c.moveTo(f.x + 40, y);
        c.lineTo(f.x + f.w - 40, y);
        c.stroke();
      }
    }

    /* Vidro escuro da mesa com vinheta. */
    arredondado(c, f.x, f.y, f.w, f.h, 30);
    const vidro = c.createRadialGradient(f.x + f.w / 2, f.y + f.h * 0.4, 50, f.x + f.w / 2, f.y + f.h * 0.4, f.h * 0.75);
    vidro.addColorStop(0, "#1D0C4F");
    vidro.addColorStop(1, "#090222");
    c.fillStyle = vidro;
    c.fill();

    /* Grade fininha no vidro, como fliperama. */
    c.save();
    arredondado(c, f.x, f.y, f.w, f.h, 30);
    c.clip();
    c.strokeStyle = "rgba(120,90,255,.07)";
    c.lineWidth = 1;
    for (let x = f.x; x < f.x + f.w; x += 28) { c.beginPath(); c.moveTo(x, f.y); c.lineTo(x, f.y + f.h); c.stroke(); }
    for (let y = f.y; y < f.y + f.h; y += 28) { c.beginPath(); c.moveTo(f.x, y); c.lineTo(f.x + f.w, y); c.stroke(); }
    c.restore();

    /* Moldura neon: rosa embaixo, ciano em cima. */
    const neon = c.createLinearGradient(0, f.y, 0, f.y + f.h);
    neon.addColorStop(0, "#39E6FF");
    neon.addColorStop(1, "#FF3D9A");
    c.save();
    c.shadowColor = "#B46BFF";
    c.shadowBlur = 30;
    c.strokeStyle = neon;
    c.lineWidth = 7;
    arredondado(c, f.x, f.y, f.w, f.h, 30);
    c.stroke();
    c.shadowBlur = 0;
    c.lineWidth = 2;
    c.strokeStyle = "rgba(255,255,255,.55)";
    arredondado(c, f.x + 1, f.y + 1, f.w - 2, f.h - 2, 29);
    c.stroke();
    c.restore();

    this.pintarPotesFixos(c);
    return t;
  },

  pintarPotesFixos(c) {
    const m = this.mesa;
    const d = m.dims;
    /* Divisórias: tubos de luz da última linha de pino até o fundo. */
    for (const x of m.divisorias) {
      if (x <= d.x0 + 1 || x >= d.x1 - 1) continue;
      const g = c.createLinearGradient(0, m.yUltimaLinha, 0, d.poteFundo);
      g.addColorStop(0, "rgba(255,255,255,.1)");
      g.addColorStop(1, "rgba(255,255,255,.55)");
      c.fillStyle = g;
      arredondado(c, x - 3, m.yUltimaLinha, 6, d.poteFundo - m.yUltimaLinha, 3);
      c.fill();
    }
  },

  /* ───────── sprites ───────── */

  foto(j) {
    if (!j || !j.foto) return null;
    let f = this.fotos.get(j.foto);
    if (!f) {
      f = new Image();
      f.onload = () => { for (const k of [...this.sprites.keys()]) if (k.startsWith(j.id + "|")) this.sprites.delete(k); };
      f.src = j.foto;
      this.fotos.set(j.foto, f);
    }
    return f.complete && f.naturalWidth ? f : null;
  },

  spriteDaBola(j, r, tipo) {
    const chave = `${j.id}|${r}|${tipo}`;
    let s = this.sprites.get(chave);
    if (s) return s;
    const borda = tipo === "bolona" ? 7 : tipo === "dourada" ? 5 : 3.5;
    const tam = Math.ceil((r + borda + 2) * 2);
    s = telaNova(tam, tam);
    const c = s.getContext("2d");
    const meio = tam / 2;
    c.save();
    c.beginPath();
    c.arc(meio, meio, r, 0, Math.PI * 2);
    c.clip();
    const img = this.foto(j);
    if (img) {
      c.drawImage(img, meio - r, meio - r, r * 2, r * 2);
    } else {
      const g = c.createLinearGradient(0, meio - r, 0, meio + r);
      g.addColorStop(0, j.cor);
      g.addColorStop(1, "#1A0B3D");
      c.fillStyle = g;
      c.fillRect(0, 0, tam, tam);
      c.fillStyle = "#FFFFFF";
      c.font = `800 ${Math.round(r * 1.05)}px Figtree, system-ui, sans-serif`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(inicial(j.nome), meio, meio + r * 0.06);
    }
    if (tipo === "dourada") {
      c.fillStyle = "rgba(255,200,40,.28)";
      c.fillRect(0, 0, tam, tam);
    }
    /* Brilho de bolinha de gude. */
    const brilho = c.createRadialGradient(meio - r * 0.4, meio - r * 0.45, 1, meio - r * 0.2, meio - r * 0.2, r * 1.1);
    brilho.addColorStop(0, "rgba(255,255,255,.55)");
    brilho.addColorStop(0.35, "rgba(255,255,255,.08)");
    brilho.addColorStop(1, "rgba(0,0,0,.35)");
    c.fillStyle = brilho;
    c.fillRect(0, 0, tam, tam);
    c.restore();

    c.lineWidth = borda;
    if (tipo === "bolona") {
      const g = c.createConicGradient ? c.createConicGradient(0, meio, meio) : null;
      if (g) ["#FF3D9A", "#FFE14D", "#7CFF6B", "#39E6FF", "#B46BFF", "#FF3D9A"].forEach((cor, i, a) => g.addColorStop(i / (a.length - 1), cor));
      c.strokeStyle = g || "#FFE14D";
    } else c.strokeStyle = tipo === "dourada" ? OURO : j.cor;
    c.beginPath();
    c.arc(meio, meio, r + borda / 2 - 0.5, 0, Math.PI * 2);
    c.stroke();
    this.sprites.set(chave, s);
    return s;
  },

  /* Halo colorido (pino aceso, brilho de bolinha), em cache por cor. */
  brilho(cor, r = 26) {
    const chave = cor + r;
    let s = this.brilhos.get(chave);
    if (s) return s;
    s = telaNova(r * 2, r * 2);
    const c = s.getContext("2d");
    const g = c.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, cor);
    g.addColorStop(0.25, cor + "AA");
    g.addColorStop(1, cor + "00");
    c.fillStyle = g;
    c.fillRect(0, 0, r * 2, r * 2);
    this.brilhos.set(chave, s);
    return s;
  },

  /* ───────── efeitos que o jogo chama ───────── */

  /* Texto com `chave` substitui o anterior de mesma chave. */
  texto(txt, x, y, { cor = "#FFFFFF", tam = 44, dur = 1.1, sobe = 90, sub = null, chave = null } = {}) {
    if (chave) this.textos = this.textos.filter(t => t.chave !== chave);
    this.textos.push({ txt, x, y, cor, tam, dur, sobe, sub, chave, t: 0 });
    if (this.textos.length > 40) this.textos.shift();
  },

  faiscas(x, y, cores, n = 14, forca = 380, tipo = "faisca") {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = forca * (0.35 + Math.random() * 0.65);
      this.particulas.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - forca * 0.35,
        cor: cores[i % cores.length], vida: 0, dur: 0.5 + Math.random() * 0.6,
        tam: tipo === "confete" ? 7 + Math.random() * 6 : 3 + Math.random() * 3,
        tipo, giro: Math.random() * 6,
      });
    }
    if (this.particulas.length > 900) this.particulas.splice(0, this.particulas.length - 900);
  },

  confete() {
    const cores = ["#FF3D9A", "#FFE14D", "#7CFF6B", "#39E6FF", "#B46BFF", "#FFFFFF"];
    const f = this.moldura();
    for (let i = 0; i < 6; i++) this.faiscas(f.x + f.w * (0.1 + i * 0.16), f.y + 40, cores, 26, 650, "confete");
  },

  anel(x, y, cor, raio = 120) {
    this.aneis.push({ x, y, cor, raio, t: 0 });
  },

  potePulou(i, forca = 1) {
    const p = this.potesPulo[i];
    if (!p) return;
    p.v += 160 * forca;
    p.luz = Math.min(1, p.luz + 0.6 * forca + 0.3);
  },

  /* ───────── quadro ───────── */

  quadro(partida, dt, agora, jogadores) {
    const c = this.c;
    const m = partida.mesa;
    this.tremor = Math.max(0, this.tremor - dt * 40);
    const tx = this.tremor ? (Math.random() - 0.5) * this.tremor : 0;
    const ty = this.tremor ? (Math.random() - 0.5) * this.tremor : 0;

    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(this.fundo, 0, 0);
    const z = this.zoom;
    c.setTransform(z, 0, 0, z, 0, this.desce);
    this.respirar(agora);
    c.setTransform(z, 0, 0, z, tx, ty + this.desce);

    this.desenharBocal(m, agora);
    this.desenharPinos(m, agora, partida);
    this.desenharPotes(partida, dt, agora);
    this.desenharRastros(m, jogadores, dt);
    this.desenharBolas(m, jogadores, partida, dt, agora);
    this.desenharParticulas(dt);
    this.desenharAneis(dt);
    this.desenharTextos(dt);

    c.setTransform(1, 0, 0, 1, 0, 0);
    if (this.flash > 0) {
      c.globalAlpha = Math.min(1, this.flash);
      c.fillStyle = this.flashCor;
      c.fillRect(0, 0, this.W, this.H);
      c.globalAlpha = 1;
      this.flash = Math.max(0, this.flash - dt * 2.5);
    }
  },

  /* Manchas de neon que pulsam devagar atrás da máquina. */
  respirar(agora) {
    const c = this.c;
    const f = this.moldura();
    const manchas = [
      { x: f.x + f.w * 0.15, y: f.y + f.h * 0.25, cor: "#FF3D9A", fase: 0 },
      { x: f.x + f.w * 0.85, y: f.y + f.h * 0.55, cor: "#39E6FF", fase: 2.1 },
      { x: f.x + f.w * 0.4, y: f.y + f.h * 0.9, cor: "#B46BFF", fase: 4.2 },
    ];
    c.globalCompositeOperation = "lighter";
    for (const s of manchas) {
      const a = 0.1 + 0.07 * Math.sin(agora * 0.6 + s.fase);
      const r = 300 + 40 * Math.sin(agora * 0.4 + s.fase);
      c.globalAlpha = a;
      c.drawImage(this.brilho(s.cor, 128), s.x - r, s.y - r, r * 2, r * 2);
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
  },

  desenharBocal(m, agora) {
    const c = this.c;
    const d = m.dims;
    const x = (d.x0 + d.x1) / 2;
    const y = d.topo - 26;
    const pulso = 0.6 + 0.4 * Math.sin(agora * 3);
    c.globalCompositeOperation = "lighter";
    c.globalAlpha = 0.5 * pulso;
    c.drawImage(this.brilho("#39E6FF", 60), x - 60, y - 40, 120, 120);
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
    c.fillStyle = "#0B0424";
    c.strokeStyle = "#39E6FF";
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(x - 46, y - 8);
    c.lineTo(x + 46, y - 8);
    c.lineTo(x + 24, y + 22);
    c.lineTo(x - 24, y + 22);
    c.closePath();
    c.fill();
    c.stroke();
  },

  desenharPinos(m, agora, partida) {
    const c = this.c;
    const rp = m.cfg.raioPino;
    const ouro = m.pinoDeOuro;
    /* Onda de luz descendo pela grade, pra mesa nunca ficar parada. */
    c.globalCompositeOperation = "lighter";
    for (let i = 0; i < m.pinos.length; i++) {
      const p = m.pinos[i];
      const onda = Math.max(0, Math.sin(agora * 1.6 - p.linha * 0.55 - p.x * 0.004)) ** 6 * 0.35;
      const luz = Math.max(p.luz, onda);
      if (luz > 0.02 && i !== ouro) {
        const cor = p.luz > onda && p.cor ? p.cor : "#9F8CFF";
        const r = 14 + 16 * luz;
        c.globalAlpha = Math.min(1, luz * 1.2);
        c.drawImage(this.brilho(cor), p.x - r, p.y - r, r * 2, r * 2);
      }
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
    for (let i = 0; i < m.pinos.length; i++) {
      const p = m.pinos[i];
      if (i === ouro) continue;
      c.fillStyle = p.luz > 0.3 ? "#FFFFFF" : "#D9D2FF";
      c.beginPath();
      c.arc(p.x, p.y, rp + p.luz * 2, 0, Math.PI * 2);
      c.fill();
    }
    if (ouro >= 0) this.pinoDeOuro(m.pinos[ouro], rp, agora, partida.cfg.surpresa.multiplica);
  },

  /* Pino de ouro: raios de luz girando e o multiplicador escrito. */
  pinoDeOuro(p, rp, agora, mult) {
    const c = this.c;
    const pulso = 1 + 0.2 * Math.sin(agora * 6);
    const r = 70 * pulso;
    c.globalCompositeOperation = "lighter";
    c.drawImage(this.brilho(OURO, 64), p.x - r, p.y - r, r * 2, r * 2);
    c.save();
    c.translate(p.x, p.y);
    c.rotate(agora * 1.5);
    c.globalAlpha = 0.5;
    c.fillStyle = OURO;
    for (let k = 0; k < 8; k++) {
      c.rotate(Math.PI / 4);
      c.beginPath();
      c.moveTo(-3, rp * PINO_DE_OURO + 4);
      c.lineTo(3, rp * PINO_DE_OURO + 4);
      c.lineTo(0, rp * PINO_DE_OURO + 28);
      c.closePath();
      c.fill();
    }
    c.restore();
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
    const raio = rp * PINO_DE_OURO;
    const g = c.createRadialGradient(p.x - raio * 0.3, p.y - raio * 0.3, 1, p.x, p.y, raio);
    g.addColorStop(0, "#FFF6C8");
    g.addColorStop(0.5, OURO);
    g.addColorStop(1, "#B07800");
    c.fillStyle = g;
    c.beginPath();
    c.arc(p.x, p.y, raio, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#4A2E00";
    c.font = '900 20px "Big Shoulders Display", Impact, sans-serif';
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(`×${mult}`, p.x, p.y + 1);
  },

  desenharPotes(partida, dt, agora) {
    const c = this.c;
    const m = partida.mesa;
    const d = m.dims;
    const topo = d.poteTopo - 34;
    const alto = d.poteFundo - topo;
    for (let i = 0; i < this.valores.length; i++) {
      const p = this.potesPulo[i];
      /* Mola: o pote afunda com a pancada e volta. */
      p.v += (-p.y * 260 - p.v * 14) * dt;
      p.y += p.v * dt;
      p.luz = Math.max(0, p.luz - dt * 1.6);
      const valor = partida.valorDoPote(i);
      const turbinado = valor !== this.valores[i];
      const cor = turbinado ? OURO : corDoPote(valor);
      const x = m.divisorias[i] + 5;
      const w = m.passoX - 10;
      const y = topo + p.y;
      const pulso = turbinado ? 0.5 + 0.5 * Math.sin(agora * 8) : 0;
      const luz = Math.max(p.luz, pulso * 0.7);

      const g = c.createLinearGradient(0, y, 0, y + alto);
      g.addColorStop(0, cor + "00");
      g.addColorStop(0.45, cor + Math.round(0x40 + luz * 0x70).toString(16).padStart(2, "0"));
      g.addColorStop(1, cor + "EE");
      c.fillStyle = g;
      arredondado(c, x, y, w, alto, 10);
      c.fill();
      if (luz > 0.05) {
        c.globalCompositeOperation = "lighter";
        c.globalAlpha = luz * 0.8;
        c.drawImage(this.brilho(cor, 60), x + w / 2 - 70, y + alto - 90, 140, 140);
        c.globalAlpha = 1;
        c.globalCompositeOperation = "source-over";
      }
      c.fillStyle = "#FFFFFF";
      c.shadowColor = cor;
      c.shadowBlur = 14;
      const tam = Math.round(m.passoX * (valor >= 10 ? 0.54 : 0.6));
      c.font = `900 ${tam}px "Big Shoulders Display", Impact, sans-serif`;
      c.textAlign = "center";
      c.textBaseline = "alphabetic";
      c.fillText(String(valor), x + w / 2, y + alto - 16);
      c.shadowBlur = 0;
    }
  },

  desenharRastros(m, jogadores, dt) {
    const c = this.c;
    const vivos = new Set();
    for (const b of m.bolas) {
      vivos.add(b.id);
      let r = this.rastros.get(b.id);
      if (!r) { r = []; this.rastros.set(b.id, r); }
      r.push(b.x, b.y);
      if (r.length > 24) r.splice(0, 2);
      const j = jogadores.get(b.dados.dono);
      const cor = b.dados.bolona ? "#FFE14D" : b.dados.dourada ? OURO : j ? j.cor : "#FFFFFF";
      const n = r.length / 2;
      if (n < 2) continue;
      c.strokeStyle = cor;
      c.lineCap = "round";
      for (let k = 1; k < n; k++) {
        c.globalAlpha = (k / n) * 0.35;
        c.lineWidth = b.r * 1.3 * (k / n);
        c.beginPath();
        c.moveTo(r[(k - 1) * 2], r[(k - 1) * 2 + 1]);
        c.lineTo(r[k * 2], r[k * 2 + 1]);
        c.stroke();
      }
    }
    c.globalAlpha = 1;
    for (const id of this.rastros.keys()) if (!vivos.has(id)) this.rastros.delete(id);
  },

  desenharBolas(m, jogadores, partida, dt, agora) {
    const c = this.c;
    for (const b of m.bolas) {
      const j = jogadores.get(b.dados.dono);
      if (!j) continue;
      const tipo = b.dados.bolona ? "bolona" : b.dados.dourada ? "dourada" : "normal";
      b.ang = (b.ang || 0) + (b.vx / b.r) * dt;
      if (tipo !== "normal" || b.tocouOuro) {
        const r = b.r * 2.2;
        c.globalCompositeOperation = "lighter";
        c.globalAlpha = 0.55 + 0.2 * Math.sin(agora * 7 + b.id);
        c.drawImage(this.brilho(tipo === "bolona" ? "#FF3D9A" : OURO, 64), b.x - r, b.y - r, r * 2, r * 2);
        c.globalAlpha = 1;
        c.globalCompositeOperation = "source-over";
      }
      const s = this.spriteDaBola(j, Math.round(b.r), tipo);
      c.save();
      c.translate(b.x, b.y);
      c.rotate(b.ang);
      c.drawImage(s, -s.width / 2, -s.height / 2);
      c.restore();
      if (partida.rei === j.id) this.coroa(b.x, b.y - b.r - 4, b.r * 0.9);
    }
  },

  coroa(x, y, tam) {
    const c = this.c;
    const w = tam * 1.3;
    const h = tam * 0.8;
    c.fillStyle = OURO;
    c.strokeStyle = "#7A4B00";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x - w / 2, y);
    c.lineTo(x - w / 2, y - h * 0.75);
    c.lineTo(x - w / 4, y - h * 0.35);
    c.lineTo(x, y - h);
    c.lineTo(x + w / 4, y - h * 0.35);
    c.lineTo(x + w / 2, y - h * 0.75);
    c.lineTo(x + w / 2, y);
    c.closePath();
    c.fill();
    c.stroke();
  },

  desenharParticulas(dt) {
    const c = this.c;
    const vivas = [];
    c.globalCompositeOperation = "lighter";
    for (const p of this.particulas) {
      p.vida += dt;
      if (p.vida >= p.dur) continue;
      p.vy += (p.tipo === "confete" ? 520 : 900) * dt;
      p.vx *= 1 - dt * (p.tipo === "confete" ? 1.6 : 0.8);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const a = 1 - p.vida / p.dur;
      c.globalAlpha = a;
      c.fillStyle = p.cor;
      if (p.tipo === "confete") {
        c.globalCompositeOperation = "source-over";
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.giro + p.vida * 8);
        c.fillRect(-p.tam / 2, -p.tam / 4, p.tam, p.tam / 2);
        c.restore();
        c.globalCompositeOperation = "lighter";
      } else {
        c.beginPath();
        c.arc(p.x, p.y, p.tam * a + 0.5, 0, Math.PI * 2);
        c.fill();
      }
      vivas.push(p);
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
    this.particulas = vivas;
  },

  desenharAneis(dt) {
    const c = this.c;
    this.aneis = this.aneis.filter(a => (a.t += dt) < 0.6);
    for (const a of this.aneis) {
      const k = a.t / 0.6;
      c.globalAlpha = 1 - k;
      c.strokeStyle = a.cor;
      c.lineWidth = 8 * (1 - k) + 1;
      c.beginPath();
      c.arc(a.x, a.y, a.raio * (0.2 + k * 0.8), 0, Math.PI * 2);
      c.stroke();
    }
    c.globalAlpha = 1;
  },

  /* Nome de quem caiu no pote da ponta não pode vazar pra fora da mesa. */
  dentroDaMesa(t) {
    if (t.meiaLargura == null) {
      const c = this.c;
      c.font = `900 ${t.tam}px "Big Shoulders Display", Impact, sans-serif`;
      let w = c.measureText(t.txt).width;
      if (t.sub) {
        c.font = `800 ${Math.round(t.tam * 0.6)}px Figtree, system-ui, sans-serif`;
        w = Math.max(w, c.measureText(t.sub).width);
      }
      t.meiaLargura = w / 2 + 6;
    }
    const d = this.mesa.dims;
    const min = d.x0 + t.meiaLargura;
    const max = d.x1 - t.meiaLargura;
    return min > max ? (d.x0 + d.x1) / 2 : Math.min(max, Math.max(min, t.x));
  },

  desenharTextos(dt) {
    const c = this.c;
    this.textos = this.textos.filter(t => (t.t += dt) < t.dur);
    c.textAlign = "center";
    c.textBaseline = "middle";
    for (const t of this.textos) {
      const k = t.t / t.dur;
      const entra = Math.min(1, t.t / 0.12);
      const escala = 0.6 + 0.4 * entra + (k < 0.15 ? 0.15 * Math.sin((k / 0.15) * Math.PI) : 0);
      const y = t.y - t.sobe * (1 - Math.pow(1 - k, 2));
      c.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      const x = this.dentroDaMesa(t);
      c.font = `900 ${Math.round(t.tam * escala)}px "Big Shoulders Display", Impact, sans-serif`;
      c.lineWidth = Math.max(4, t.tam * 0.14);
      c.strokeStyle = "rgba(10,3,32,.9)";
      c.strokeText(t.txt, x, y);
      c.fillStyle = t.cor;
      c.fillText(t.txt, x, y);
      if (t.sub) {
        const sub = Math.round(t.tam * 0.6);
        const ySub = y + t.tam * 0.5 + sub * 0.6;
        c.font = `800 ${sub}px Figtree, system-ui, sans-serif`;
        c.lineWidth = 6;
        c.strokeText(t.sub, x, ySub);
        c.fillStyle = "#FFFFFF";
        c.fillText(t.sub, x, ySub);
      }
    }
    c.globalAlpha = 1;
  },
};
