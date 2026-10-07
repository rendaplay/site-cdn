/* Física do voo: tucano, pilares, projéteis (chinelo e meteoro) e pão de
   queijo. Sem DOM e com o sorteio injetável, pra rodar igual no navegador,
   no piloto automático (que simula o futuro com isto) e no `node --test`.

   Coordenadas em px do palco. `topo` é a fiação, `chao` o calçadão. O
   pilar é guardado pela borda esquerda (`x`) e pelo centro do vão (`cy`).
   Quem decide se uma batida mata é a Partida: aqui só se mede e avisa. */
"use strict";

const RAIO_TUCA = 34;
const VY_MAX = 1500;

class Mundo {
  constructor(voo, dims, aleatorio = Math.random) {
    this.voo = voo;
    this.dims = dims;
    this.aleatorio = aleatorio;
    this.distancia = 0;
    this.reiniciar();
  }

  reiniciar() {
    const d = this.dims;
    this.t = 0;
    this.passaro = { x: d.x, y: (d.topo + d.chao) / 2, vy: 0, r: RAIO_TUCA, vivo: true, flap: 0, pulos: 0 };
    this.pilares = [];
    this.projeteis = [];
    this.queijos = [];
    this.gigantes = [];
    this.passados = 0;
    this.gerar = false;
    this.rolando = true;
    this.queijo = false;
    this.mods = { gravidade: 1, vento: 0, turbo: false };
    this._id = 0;
  }

  get velocidade() {
    const v = this.voo;
    return Math.min(v.velocidadeMax, v.velocidade + v.acelera * this.passados);
  }

  get vao() {
    const v = this.voo;
    return Math.max(v.vaoMin, v.vao - v.aperta * this.passados);
  }

  pular() {
    const p = this.passaro;
    if (!p.vivo) return;
    p.vy = -this.voo.pulo * this.mods.gravidade;
    p.flap = 1;
    p.pulos++;
  }

  /* Depois de uma batida que não matou (bolha, vida, invencível): afasta
     do chão (ou do teto, de ponta-cabeça) pra não bater de novo. */
  quicar() {
    this.passaro.vy = -this.voo.pulo * 0.85 * this.mods.gravidade;
  }

  matar() {
    this.passaro.vivo = false;
    this.rolando = false;
    this.passaro.vy = Math.min(this.passaro.vy, -500);
  }

  pairar(dt) {
    const p = this.passaro;
    const d = this.dims;
    this.t += dt;
    p.y = (d.topo + d.chao) / 2 + Math.sin(this.t * 4) * 26;
    p.vy = Math.cos(this.t * 4) * 104;
    p.flap = Math.max(0, p.flap - dt * 4);
    if (Math.sin(this.t * 4) > 0.95 && p.flap === 0) p.flap = 1;
    this.distancia += this.velocidade * 0.5 * dt;
  }

  /* ───────── criação ───────── */

  novoPilar() {
    const v = this.voo;
    const d = this.dims;
    const dono = this.gigantes.shift() || null;
    const vao = dono ? Math.max(250, this.vao * 0.74) : this.vao;
    const largura = dono ? v.largura * 1.3 : v.largura;
    const margem = Math.min(90, (d.chao - d.topo) * 0.08);
    const min = d.topo + margem + vao / 2;
    const max = d.chao - margem - vao / 2;
    const ultimo = this.pilares[this.pilares.length - 1];
    const ref = ultimo ? ultimo.cy : (min + max) / 2;
    const lo = Math.max(min, ref - v.desnivel);
    const hi = Math.min(max, ref + v.desnivel);
    const cy = lo + this.aleatorio() * (hi - lo);
    const pilar = { id: ++this._id, x: d.W + 40, cy, vao, largura, dono, contado: false, quebrado: false };
    this.pilares.push(pilar);
    if (this.queijo) this.queijos.push({ id: ++this._id, x: pilar.x + largura / 2, y: cy, pego: false });
    return pilar;
  }

  lancar(tipo, dono) {
    const p = this.passaro;
    const d = this.dims;
    const r = this.aleatorio;
    let proj;
    if (tipo === "chinelo") {
      const y = Math.min(d.chao - 60, Math.max(d.topo + 60, p.y + (r() - 0.5) * 240));
      const vx = -(this.velocidade + 560);
      const x = d.W + 80;
      const tempo = (x - p.x) / -vx;
      proj = { tipo, x, y, vx, vy: (p.y - y) / tempo, r: 28, giro: 9 + r() * 6, rot: 0, dono };
    } else {
      const vy = 760 + r() * 160;
      const vx = -(220 + r() * 120);
      const alvoX = p.x - 40 + r() * 560;
      const y = d.topo - 140;
      const tempo = (p.y - y) / vy;
      proj = { tipo: "meteoro", x: alvoX - vx * tempo, y, vx, vy, r: 36, giro: 2 + r() * 2, rot: r() * 6, dono };
    }
    proj.id = ++this._id;
    this.projeteis.push(proj);
    return proj;
  }

  quebrar(pilar) { pilar.quebrado = true; }
  remover(proj) { this.projeteis = this.projeteis.filter(p => p !== proj); }

  /* ───────── passo ───────── */

  passo(dt) {
    const saida = [];
    const p = this.passaro;
    const d = this.dims;
    const g = this.mods.gravidade;
    this.t += dt;
    p.flap = Math.max(0, p.flap - dt * 5);

    if (!p.vivo) {
      p.vy = Math.min(VY_MAX, p.vy + this.voo.gravidade * dt);
      p.y = Math.min(d.chao - p.r * 0.6, p.y + p.vy * dt);
      return saida;
    }

    p.vy += (this.voo.gravidade * g + this.mods.vento) * dt;
    p.vy = Math.max(-VY_MAX, Math.min(VY_MAX, p.vy));
    p.y += p.vy * dt;

    /* O lado pra onde a gravidade puxa mata; o outro só segura. */
    if (p.y + p.r > d.chao) {
      p.y = d.chao - p.r;
      if (g > 0) saida.push({ tipo: "colisao", com: "chao" });
      else p.vy = Math.min(p.vy, 0);
    } else if (p.y - p.r < d.topo) {
      p.y = d.topo + p.r;
      if (g < 0) saida.push({ tipo: "colisao", com: "teto" });
      else p.vy = Math.max(p.vy, 0);
    }

    if (!this.rolando) return saida;
    const vel = this.velocidade;
    this.distancia += vel * dt;

    for (const pi of this.pilares) pi.x -= vel * dt;
    for (const q of this.queijos) q.x -= vel * dt;
    this.pilares = this.pilares.filter(pi => pi.x + pi.largura > -80);
    this.queijos = this.queijos.filter(q => q.x > -60 && !q.pego);
    if (this.gerar) {
      const ultimo = this.pilares[this.pilares.length - 1];
      if (!ultimo || ultimo.x < d.W + 40 - this.voo.distancia) this.novoPilar();
    }

    for (const pr of this.projeteis) {
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.rot += pr.giro * dt;
      if (pr.tipo === "meteoro" && pr.y + pr.r * 0.5 > d.chao) {
        pr.fora = true;
        saida.push({ tipo: "impacto", x: pr.x, y: d.chao });
      }
      if (pr.x < -120) pr.fora = true;
    }
    this.projeteis = this.projeteis.filter(pr => !pr.fora);

    for (const pi of this.pilares) {
      if (!pi.contado && pi.x + pi.largura / 2 < p.x) {
        pi.contado = true;
        this.passados++;
        saida.push({ tipo: "ponto", pilar: pi });
      }
    }
    for (const q of this.queijos) {
      if (!q.pego && Math.hypot(q.x - p.x, q.y - p.y) < p.r + 34) {
        q.pego = true;
        saida.push({ tipo: "queijo", x: q.x, y: q.y });
      }
    }

    const pilar = this.pilares.find(pi => !pi.quebrado && bateNoPilar(p.x, p.y, p.r, pi.x, pi.largura, pi.cy, pi.vao));
    if (pilar) saida.push({ tipo: "colisao", com: "pilar", obj: pilar });
    const proj = this.projeteis.find(pr => Math.hypot(pr.x - p.x, pr.y - p.y) < pr.r + p.r * 0.8);
    if (proj) saida.push({ tipo: "colisao", com: proj.tipo, obj: proj });
    return saida;
  }
}

/* Círculo contra os dois blocos do pilar (em cima e embaixo do vão). A
   laje da ponta é 10 px mais larga que o tijolo, de cada lado. */
function bateNoPilar(px, py, r, x, largura, cy, vao) {
  const topoVao = cy - vao / 2;
  const baseVao = cy + vao / 2;
  if (px + r < x - 10 || px - r > x + largura + 10) return false;
  if (py - r > topoVao && py + r < baseVao) return false;
  const nx = Math.max(x - 10, Math.min(px, x + largura + 10));
  const emCima = py < cy;
  const ny = emCima ? Math.min(py, topoVao) : Math.max(py, baseVao);
  if (emCima ? py <= topoVao : py >= baseVao) return px + r > x - 10 && px - r < x + largura + 10;
  return Math.hypot(px - nx, py - ny) < r;
}

if (typeof module !== "undefined" && module.exports) module.exports = { Mundo, bateNoPilar, RAIO_TUCA };
