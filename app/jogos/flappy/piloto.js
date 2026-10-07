/* Piloto automático. A cada decisão simula ~0,8 s pra frente duas vezes
   (pular agora / não pular) com uma política gulosa e escolhe o caminho
   sem batida; na dúvida, o que bate mais tarde.

   Ele erra de propósito, do jeito que a plateia entende: vê o centro do
   vão com um pouco de ruído, de vez em quando calcula muito mal um pilar
   (`deslize`), reage com atraso, enxerga pouco na neblina, não prevê a
   rajada de vento e leva um susto quando a gravidade vira. Sem presente
   ele voa bastante; com sabotagem, cai. */
"use strict";

const PASSO_SIM = 1 / 60;
const HORIZONTE = 0.8;
const FOLGA = 5;
const colide = typeof module !== "undefined" && module.exports ? require("./mundo.js").bateNoPilar : bateNoPilar;

class Piloto {
  constructor(cfg = {}, aleatorio = Math.random) {
    this.cfg = { erro: 16, atraso: 0.05, visaoNeblina: 300, sustoInversao: 0.3, deslize: 0.012, ...cfg };
    this.aleatorio = aleatorio;
    this.reiniciar();
  }

  reiniciar() {
    this.ruido = new Map();
    this.agendado = null;
    this.proxima = 0;
  }

  gauss() {
    const r = this.aleatorio;
    return (r() + r() + r() - 1.5) * 1.15;
  }

  /* Centro do vão como o piloto acha que é: o ruído é sorteado uma vez por
     pilar, então o erro é consistente (ele mira errado, não treme). */
  centroVisto(pilar) {
    let e = this.ruido.get(pilar.id);
    if (e === undefined) {
      const forte = this.aleatorio() < this.cfg.deslize;
      e = this.gauss() * this.cfg.erro * (forte ? 6 : 1);
      this.ruido.set(pilar.id, e);
      if (this.ruido.size > 40) this.ruido.delete(this.ruido.keys().next().value);
    }
    return pilar.cy + e;
  }

  /* `ctx`: { neblina, assustado } vindos da Partida. Devolve true pra pular. */
  decidir(mundo, ctx = {}) {
    const t = mundo.t;
    if (this.agendado !== null && t >= this.agendado) {
      this.agendado = null;
      return true;
    }
    if (this.agendado !== null || t < this.proxima || ctx.assustado) return false;
    this.proxima = t + PASSO_SIM;

    const p = mundo.passaro;
    const visao = ctx.neblina ? this.cfg.visaoNeblina : Infinity;
    const pilares = mundo.pilares
      .filter(pi => !pi.quebrado && pi.x - p.x < visao && pi.x + pi.largura + 10 > p.x - p.r - 4)
      .map(pi => ({ x: pi.x, largura: pi.largura, vao: pi.vao, cy: this.centroVisto(pi) }));
    const projeteis = mundo.projeteis.filter(pr => pr.x - p.x < visao + 200);
    const cena = { mundo, pilares, projeteis };

    const quer = this.quer(mundo, p.y, p.vy, pilares, 0);
    const ordem = quer ? [true, false] : [false, true];
    const a = this.simular(cena, ordem[0]);
    let pular = ordem[0];
    if (a.bateu) {
      const b = this.simular(cena, ordem[1]);
      if (!b.bateu || b.t > a.t) pular = ordem[1];
    }
    if (!pular) return false;
    if (this.cfg.atraso > 0) {
      this.agendado = t + this.cfg.atraso;
      return false;
    }
    return true;
  }

  alvo(mundo, pilares, tempo) {
    const p = mundo.passaro;
    const d = mundo.dims;
    const g = mundo.mods.gravidade;
    const dx = mundo.velocidade * tempo;
    const proximo = pilares.find(pi => pi.x - dx + pi.largura + 10 > p.x - p.r);
    if (!proximo) return (d.topo + d.chao) / 2;
    return proximo.cy + g * proximo.vao * 0.1;
  }

  /* Política gulosa: passou do alvo e está caindo, pula. */
  quer(mundo, y, vy, pilares, tempo) {
    const g = mundo.mods.gravidade;
    const alvo = this.alvo(mundo, pilares, tempo);
    return g > 0 ? y > alvo && vy > -120 : y < alvo && vy < 120;
  }

  simular({ mundo, pilares, projeteis }, pularAgora) {
    const p = mundo.passaro;
    const d = mundo.dims;
    const v = mundo.voo;
    const g = mundo.mods.gravidade;
    const vel = mundo.velocidade;
    const r = p.r + FOLGA;
    let y = p.y;
    let vy = pularAgora ? -v.pulo * g : p.vy;
    let ultimoPulo = pularAgora ? 0 : -Infinity;

    for (let tempo = PASSO_SIM; tempo <= HORIZONTE; tempo += PASSO_SIM) {
      if (tempo >= 0.12 && tempo - ultimoPulo >= 0.15 && this.quer(mundo, y, vy, pilares, tempo)) {
        vy = -v.pulo * g;
        ultimoPulo = tempo;
      }
      vy = Math.max(-1500, Math.min(1500, vy + v.gravidade * g * PASSO_SIM));
      y += vy * PASSO_SIM;
      if (g > 0 && y + p.r > d.chao) return { bateu: true, t: tempo };
      if (g < 0 && y - p.r < d.topo) return { bateu: true, t: tempo };
      if (y + p.r > d.chao) { y = d.chao - p.r; vy = Math.min(vy, 0); }
      if (y - p.r < d.topo) { y = d.topo + p.r; vy = Math.max(vy, 0); }

      const dx = vel * tempo;
      for (const pi of pilares) {
        if (colide(p.x, y, r, pi.x - dx, pi.largura, pi.cy, pi.vao)) return { bateu: true, t: tempo };
      }
      for (const pr of projeteis) {
        if (Math.hypot(pr.x + pr.vx * tempo - p.x, pr.y + pr.vy * tempo - y) < pr.r + p.r * 0.8 + FOLGA) {
          return { bateu: true, t: tempo };
        }
      }
    }
    return { bateu: false, t: HORIZONTE };
  }
}

if (typeof module !== "undefined" && module.exports) module.exports = { Piloto };
