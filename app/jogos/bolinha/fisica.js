/* A mesa da Chuva de Bolinha: pinos em grade desencontrada, paredes, as
   divisórias dos potes e as bolinhas. Física própria, de círculos, em passo
   fixo (quem chama decide o dt; o jogo usa 1/120 s). Não desenha nada e não
   sabe de pontos: devolve o que aconteceu (bateu no pino, caiu no pote) e
   quem desenha e quem pontua decidem o resto. */
"use strict";

/* O pino de ouro é maior que os outros (na tela e na batida), pra ser visto
   no celular; ainda deixa a bolinha passar dos dois lados. */
const PINO_DE_OURO = 2.2;

class Mesa {
  /* dims: { x0, x1, topo, y0, poteTopo, poteFundo }, em px do palco.
     As divisórias dos potes ficam embaixo dos pinos da última linha, então
     `potes` = colunas da grade. */
  constructor(dims, cfg, aleatorio = Math.random) {
    this.cfg = cfg;
    this.sorte = aleatorio;
    this.bolas = [];
    this.proximoId = 1;
    this.pinoDeOuro = -1;
    this.montar(dims);
  }

  montar(dims) {
    this.dims = dims;
    const { x0, x1, y0, poteTopo } = dims;
    const linhas = this.cfg.linhas;
    const n = this.cfg.potes;
    this.passoX = (x1 - x0) / n;
    this.passoY = this.passoX * 0.8;
    this.pinos = [];
    /* A última linha tem n+1 pinos, alinhados com as divisórias; subindo, as
       linhas alternam entre essa e a desencontrada (n pinos no meio dos
       vãos), pra bolinha nunca achar um corredor reto até o pote. */
    for (let l = 0; l < linhas; l++) {
      const daBase = linhas - 1 - l;
      const y = y0 + l * this.passoY;
      const alinhada = daBase % 2 === 0;
      const qtd = alinhada ? n + 1 : n;
      for (let k = 0; k < qtd; k++) {
        const x = x0 + this.passoX * (alinhada ? k : k + 0.5);
        this.pinos.push({ x, y, linha: l, luz: 0 });
      }
    }
    this.yUltimaLinha = y0 + (linhas - 1) * this.passoY;
    this.divisorias = [];
    for (let k = 0; k <= n; k++) this.divisorias.push(x0 + this.passoX * k);
    this.linhaDoPote = poteTopo;
    this.grade = new Map();
  }

  /* Solta uma bolinha. Sem `x`, sai perto do meio com espalho de ~1 pote:
     é isso que deixa as pontas raras (e valiosas) sem ser impossíveis. */
  /* `toque` é o raio que vale contra pino e divisória. A bolona desenha
     enorme mas passa pela grade como uma bolinha comum: só as outras
     bolinhas sentem o tamanho dela. */
  soltar({ x, y, r, toque, vx = 0, vy = 0, dados = null } = {}) {
    const d = this.dims;
    const raio = r || this.cfg.raio;
    const meio = (d.x0 + d.x1) / 2;
    const px = x ?? meio + this.normal() * this.passoX * this.cfg.espalho;
    const b = {
      id: this.proximoId++,
      x: Math.min(d.x1 - raio, Math.max(d.x0 + raio, px)),
      y: y ?? d.topo,
      vx: vx + (this.sorte() - 0.5) * 40,
      vy,
      r: raio,
      toque: Math.min(raio, toque || raio),
      massa: raio * raio,
      ultimoPino: -1,
      parada: 0,
      fundo: -Infinity,
      tocouOuro: false,
      dados,
    };
    this.bolas.push(b);
    return b;
  }

  normal() {
    const u = Math.max(1e-9, this.sorte());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * this.sorte());
  }

  /* Tranco em todas as bolinhas (o "choque nos pinos" das curtidas). */
  choque(forca = 1) {
    for (const b of this.bolas) {
      b.vx += (this.sorte() - 0.5) * 520 * forca;
      b.vy -= (200 + this.sorte() * 220) * forca;
    }
    for (const p of this.pinos) p.luz = 1;
  }

  passo(dt) {
    const c = this.cfg;
    const d = this.dims;
    const eventos = [];
    for (const p of this.pinos) if (p.luz > 0) p.luz = Math.max(0, p.luz - dt * 2.2);

    for (const b of this.bolas) {
      b.vy += c.gravidade * dt;
      /* Sem teto de lado a bolinha voa por cima de várias linhas de pino. */
      if (Math.abs(b.vx) > c.velLado) b.vx = Math.sign(b.vx) * c.velLado;
      const v = Math.hypot(b.vx, b.vy);
      if (v > c.velMax) {
        b.vx *= c.velMax / v;
        b.vy *= c.velMax / v;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      /* A parede devolve a bolinha com um empurrão pro meio: sem isso ela
         desce colada nela até o pote da ponta, que deixaria de ser raro. */
      if (b.x < d.x0 + b.r) { b.x = d.x0 + b.r; b.vx = Math.abs(b.vx) * c.quiqueParede + c.empurraoParede; }
      if (b.x > d.x1 - b.r) { b.x = d.x1 - b.r; b.vx = -Math.abs(b.vx) * c.quiqueParede - c.empurraoParede; }

      this.baterNosPinos(b, eventos);
      if (b.y > this.yUltimaLinha) this.baterNasDivisorias(b);

      /* Presa entre a parede e um pino, ou equilibrada em cima de um (raro,
         mas trava a bolinha pra sempre): sem descer por um tempo, leva um
         peteleco pro meio da mesa. */
      if (b.y > b.fundo + 4) { b.fundo = b.y; b.parada = 0; }
      else if ((b.parada += dt) > 0.7) {
        const meio = (d.x0 + d.x1) / 2;
        b.vx += Math.sign(meio - b.x || 1) * (140 + this.sorte() * 80);
        b.vy -= 80;
        b.parada = 0;
      }
    }

    this.colisoesEntreBolas();

    const restantes = [];
    for (const b of this.bolas) {
      if (b.y >= this.linhaDoPote) {
        const pote = Math.min(c.potes - 1, Math.max(0, Math.floor((b.x - d.x0) / this.passoX)));
        eventos.push({ tipo: "pote", bola: b, pote });
      } else restantes.push(b);
    }
    this.bolas = restantes;
    return eventos;
  }

  baterNosPinos(b, eventos) {
    const c = this.cfg;
    const raioPino = c.raioPino;
    /* Só os pinos das linhas perto da bolinha. */
    const lMin = Math.floor((b.y - b.toque - raioPino - this.dims.y0) / this.passoY);
    if (lMin >= this.cfg.linhas || b.y + b.toque + raioPino < this.dims.y0) return;
    for (let i = 0; i < this.pinos.length; i++) {
      const p = this.pinos[i];
      if (p.linha < lMin - 1 || p.linha > lMin + 2) continue;
      const dx = b.x - p.x;
      const dy = b.y - p.y;
      const min = b.toque + (i === this.pinoDeOuro ? raioPino * PINO_DE_OURO : raioPino);
      const dist2 = dx * dx + dy * dy;
      if (dist2 >= min * min || dist2 === 0) continue;
      const dist = Math.sqrt(dist2);
      let nx = dx / dist;
      let ny = dy / dist;
      /* Batida bem no topo do pino quicaria reto pra cima pra sempre: um
         desvio pequeno decide o lado, como na máquina de verdade. */
      nx += (this.sorte() - 0.5) * c.desvio;
      const nn = Math.hypot(nx, ny);
      nx /= nn;
      ny /= nn;
      b.x = p.x + nx * min;
      b.y = p.y + ny * min;
      const vn = b.vx * nx + b.vy * ny;
      if (vn < 0) {
        b.vx -= (1 + c.quique) * vn * nx;
        b.vy -= (1 + c.quique) * vn * ny;
        b.vx *= c.atrito;
      }
      if (b.ultimoPino !== i) {
        b.ultimoPino = i;
        p.luz = 1;
        p.cor = b.dados && b.dados.cor;
        if (i === this.pinoDeOuro) b.tocouOuro = true;
        eventos.push({ tipo: "pino", bola: b, pino: i, forca: Math.min(1, -vn / 600) });
      }
    }
  }

  /* Divisória = segmento vertical da linha do pino até o fundo, tratado
     como cápsula fina. */
  baterNasDivisorias(b) {
    const c = this.cfg;
    const meia = c.raioPino * 0.6;
    for (const x of this.divisorias) {
      const dx = b.x - x;
      const min = b.toque + meia;
      if (Math.abs(dx) >= min) continue;
      const lado = dx === 0 ? (this.sorte() < 0.5 ? -1 : 1) : Math.sign(dx);
      b.x = x + lado * min;
      if (b.vx * lado < 0) b.vx = -b.vx * c.quiqueParede;
    }
  }

  colisoesEntreBolas() {
    const tam = this.cfg.raio * 2.6;
    const grade = this.grade;
    grade.clear();
    for (const b of this.bolas) {
      const k = Math.floor(b.x / tam) * 4096 + Math.floor(b.y / tam);
      const lista = grade.get(k);
      if (lista) lista.push(b); else grade.set(k, [b]);
    }
    const e = this.cfg.quiqueBolas;
    for (const b of this.bolas) {
      const cx = Math.floor(b.x / tam);
      const cy = Math.floor(b.y / tam);
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
          const lista = grade.get(gx * 4096 + gy);
          if (!lista) continue;
          for (const o of lista) {
            if (o.id <= b.id) continue;
            const dx = o.x - b.x;
            const dy = o.y - b.y;
            const min = b.r + o.r;
            const dist2 = dx * dx + dy * dy;
            if (dist2 >= min * min || dist2 === 0) continue;
            const dist = Math.sqrt(dist2);
            const nx = dx / dist;
            const ny = dy / dist;
            const soma = b.massa + o.massa;
            const sobra = min - dist;
            b.x -= nx * sobra * (o.massa / soma);
            b.y -= ny * sobra * (o.massa / soma);
            o.x += nx * sobra * (b.massa / soma);
            o.y += ny * sobra * (b.massa / soma);
            const vrel = (o.vx - b.vx) * nx + (o.vy - b.vy) * ny;
            if (vrel < 0) {
              const j = -(1 + e) * vrel / (1 / b.massa + 1 / o.massa);
              b.vx -= (j / b.massa) * nx;
              b.vy -= (j / b.massa) * ny;
              o.vx += (j / o.massa) * nx;
              o.vy += (j / o.massa) * ny;
            }
          }
        }
      }
    }
  }

  /* Centro x de cada pote, pra quem desenha. */
  centroDoPote(i) { return this.dims.x0 + this.passoX * (i + 0.5); }

  sortearPinoDeOuro() {
    /* Do meio da mesa: pino da borda quase ninguém toca. */
    const candidatos = this.pinos
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.linha >= 2 && p.linha <= this.cfg.linhas - 3
        && Math.abs(p.x - (this.dims.x0 + this.dims.x1) / 2) < this.passoX * 2.5);
    this.pinoDeOuro = candidatos.length ? candidatos[Math.floor(this.sorte() * candidatos.length)].i : -1;
    return this.pinoDeOuro;
  }
}

if (typeof module !== "undefined") module.exports = { Mesa, PINO_DE_OURO };
