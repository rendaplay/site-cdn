/* Regras do Pinball Gigante: a mesa (paredes, bumpers, estilingues, alvos,
   rampas, roleta e flippers), a física das bolas, a IA dos flippers, quem
   ganha cada ponto, a fila de bolas e de efeitos, o multiplicador, o
   jackpot da live e a rodada. Sem DOM: o tempo anda pelo `passo(dt)` em
   passos fixos de 120 Hz (cada um em 4 subpassos, pra bola rápida não
   atravessar parede fina), o sorteio é injetável e tudo que acontece volta
   numa lista de acontecimentos pra mesa, o HUD e o som.

   Coordenadas da mesa em px do palco: 1080 de largura, 1640 de altura, y
   pra baixo. O canal de lançamento fica à direita de x = 960. */
"use strict";

const PASSO = 1 / 120;
const SUB = 4;
const RAIO = 24;
const VMAX = 3400;
const MESA = { largura: 1080, altura: 1640, centro: 498, canal: 960 };

/* Neon de cada pessoa: sorteado na chegada, sem repetir até dar a volta. */
const CORES = ["#ff2bd6", "#00e5ff", "#ffe600", "#39ff14", "#ff7a1a", "#b44bff",
  "#ff3860", "#1affb2", "#4d8bff", "#ff9de2", "#c6ff00", "#7df9ff"];

const FAIXAS_EFEITO = ["brilho", "ima", "multibola", "fogo", "mesa"];
const FORMAS_BRILHO = ["estrela", "coracao", "raio"];

/* Fatias da roleta do meio, na ordem em que aparecem no disco. */
const PREMIOS_ROLETA = [
  { id: "p2500", pontos: 2500, rotulo: "2.500", peso: 3 },
  { id: "bola", rotulo: "BOLA", peso: 2 },
  { id: "p5000", pontos: 5000, rotulo: "5.000", peso: 3 },
  { id: "mult", rotulo: "MULTI", peso: 2 },
  { id: "p10000", pontos: 10000, rotulo: "10.000", peso: 2 },
  { id: "jackpot", rotulo: "JACKPOT", peso: 1 },
  { id: "p25000", pontos: 25000, rotulo: "25.000", peso: 1.2 },
  { id: "p50000", pontos: 50000, rotulo: "50.000", peso: 0.5 },
];

const LANCADOR = { x: 1002, y: 1572 };
const GIRO_SOBE = 24;
const GIRO_DESCE = 16;
const ELASTICO = { parede: 0.32, flipper: 0.18, bumper: 0.55, estilingue: 0.5, alvo: 0.3, roleta: 0.45, bola: 0.9 };

function segmento(ax, ay, bx, by, extra = {}) {
  const r = extra.r ?? 7;
  const s = { tipo: "parede", ...extra, ax, ay, bx, by, r, dx: bx - ax, dy: by - ay };
  s.l2 = s.dx * s.dx + s.dy * s.dy;
  s.x0 = Math.min(ax, bx) - r - RAIO; s.x1 = Math.max(ax, bx) + r + RAIO;
  s.y0 = Math.min(ay, by) - r - RAIO; s.y1 = Math.max(ay, by) + r + RAIO;
  return s;
}

function novoFlipper(lado, px, py) {
  const e = lado === "e";
  return {
    lado, px, py, len: 140, r0: 20, r1: 11,
    repouso: e ? 0.52 : Math.PI - 0.52, cima: e ? -0.49 : Math.PI + 0.49,
    ang: e ? 0.52 : Math.PI - 0.52, w: 0, alvo: 0, tx: 0, ty: 0,
    bateEm: 0, soltaEm: 0, esperaAte: 0, ignora: new Set(),
  };
}

/* A mesa inteira. Muda de estado (alvo caído, flipper girando), então cada
   partida monta a sua. */
function montarMesa() {
  const paredes = [];
  const add = (ax, ay, bx, by, extra) => { const s = segmento(ax, ay, bx, by, extra); paredes.push(s); return s; };

  /* Arco do topo: meia elipse de uma parede à outra. */
  const arco = [];
  const N = 28;
  for (let i = 0; i <= N; i++) {
    const a = Math.PI + Math.PI * i / N;
    arco.push({ x: 540 + 504 * Math.cos(a), y: 330 + 262 * Math.sin(a) });
  }
  for (let i = 0; i < N; i++) add(arco[i].x, arco[i].y, arco[i + 1].x, arco[i + 1].y, { tipo: "arco" });

  add(36, 330, 36, 1060);
  add(36, 1060, 250, 1375, { tipo: "estilingue", i: 0 });
  add(250, 1375, 330, 1450);
  add(1044, 330, 1044, 1700);
  add(960, 470, 960, 1700, { r: 8 });
  add(960, 1060, 746, 1375, { tipo: "estilingue", i: 1 });
  add(746, 1375, 666, 1450);
  add(960, 1604, 1044, 1604);
  /* Portinha do canal: a bola lançada passa subindo; a que desce pela
     direita cai em cima dela e rola pra mesa, sem voltar pro lançador. */
  add(960, 470, 1044, 416, { umaVia: true });
  /* Paredes de dentro das rampas laterais. */
  add(150, 430, 150, 960, { r: 6 });
  add(846, 430, 846, 960, { r: 6 });
  /* Pinos das passagens do topo. */
  for (const x of [378, 458, 538, 618]) add(x, 172, x, 236, { r: 7 });
  /* Trava da "mesa é sua": só existe enquanto o efeito dura. */
  const trava = add(300, 1585, 696, 1585, { tipo: "trava", r: 9 });

  const bumpers = [
    { i: 0, x: 400, y: 410, r: 46 },
    { i: 1, x: 596, y: 410, r: 46 },
    { i: 2, x: 498, y: 565, r: 46 },
  ];

  const alvos = [];
  for (const [banco, x] of [[0, 170], [1, 826]]) {
    for (const y of [580, 655, 730]) alvos.push(segmento(x, y - 27, x, y + 27, { tipo: "alvo", i: alvos.length, banco, r: 9, caido: false }));
  }

  const sensores = [
    { i: 0, tipo: "rollover", x: 418, y: 205, r: 22 },
    { i: 1, tipo: "rollover", x: 498, y: 205, r: 22 },
    { i: 2, tipo: "rollover", x: 578, y: 205, r: 22 },
    { i: 3, tipo: "rampa", x: 93, y: 640, r: 30 },
    { i: 4, tipo: "rampa", x: 903, y: 640, r: 30 },
  ];
  for (const s of sensores) s.dentro = new Set();

  return {
    paredes, arco, trava, bumpers, alvos, sensores,
    roleta: { x: 498, y: 820, r: 54 },
    flippers: [novoFlipper("e", 340, 1460), novoFlipper("d", 656, 1460)],
    bancos: [{ resetEm: 0 }, { resetEm: 0 }],
    rollovers: [false, false, false],
  };
}

class Pinball {
  constructor(cfg, aleatorio = Math.random) {
    this.cfg = cfg;
    this.sorte = aleatorio;
    this.zerar();
  }

  zerar() {
    this.t = 0;
    this.acumulado = 0;
    this.alfa = 0;
    this.fase = "espera";
    this.fimFase = Infinity;
    this.rodada = 0;
    this.relogio = this.cfg.duracao;
    this.ocioso = false;
    this.ultimoReal = -Infinity;
    this.pessoas = new Map();
    this.comEfeito = new Set();
    this.bolas = [];
    this.lancamentos = [];
    this.proximoLancamento = 0;
    this.nBola = 0;
    this.geo = montarMesa();
    this.jackpot = { valor: 0, meta: this.cfg.jackpot.meta, festaAte: 0 };
    this.mult = { carga: 0, ate: 0 };
    this.mesa = null;
    this.roleta = { girando: false, ate: 0, premio: 0, id: null, bola: 0 };
    this.recorde = { pontos: 0, nome: null, id: null };
    this.melhorBola = { pontos: 0, nome: null, id: null, cor: null };
    this.cores = [];
    this._kx = 0; this._ky = 0;
  }

  pessoa(quem) {
    const id = String(quem.id || quem.nome);
    let p = this.pessoas.get(id);
    if (!p) {
      if (!this.cores.length) {
        this.cores = CORES.slice();
        for (let i = this.cores.length - 1; i > 0; i--) {
          const j = Math.floor(this.sorte() * (i + 1));
          [this.cores[i], this.cores[j]] = [this.cores[j], this.cores[i]];
        }
      }
      p = { id, nome: quem.nome || id, cor: this.cores.pop(), pontos: 0, total: 0, tiltEm: -Infinity, fila: [], ativo: null, imaAte: 0, fogoAte: 0 };
      this.pessoas.set(id, p);
    } else if (quem.nome) p.nome = quem.nome;
    return p;
  }

  bolasDe(id) { return this.bolas.filter(b => b.id === id); }
  temBola(p) { return this.bolas.some(b => b.id === p.id) || this.lancamentos.some(l => l.id === p.id); }
  /* A bola "da pessoa" de comentário, na mesa ou esperando a vez. */
  principal(p) { return this.bolas.find(b => b.id === p.id && b.principal) || this.lancamentos.find(l => l.id === p.id && l.principal) || null; }

  /* ───────── live ───────── */

  marcarReal(lista) {
    this.ultimoReal = this.t;
    if (this.ocioso) {
      this.ocioso = false;
      lista.push({ tipo: "retomou" });
    }
    if (this.fase === "espera") this.comecarRodada(lista);
  }

  comentario(quem, texto = "") {
    const lista = [];
    const p = this.pessoa(quem);
    this.marcarReal(lista);
    const atual = this.principal(p);
    if (!atual) {
      this.pedirBola(p, { principal: true }, lista);
      return lista;
    }
    /* Já tem bola: a bola pula (uma vez a cada tanto), a que espera na fila não. */
    if (atual.x == null || this.t < p.tiltEm) return lista;
    const naMesa = this.bolasDe(p.id).filter(b => !b.canal);
    if (!naMesa.length) return lista;
    p.tiltEm = this.t + this.cfg.intervaloTilt;
    for (const b of naMesa) {
      b.vy = Math.min(b.vy, 0) - 1150;
      b.vx += (this.sorte() - 0.5) * 500;
    }
    lista.push({ tipo: "tilt", id: p.id, nome: p.nome, cor: p.cor, bolas: naMesa.map(b => b.n) });
    return lista;
  }

  curtida(quem, n = 1) {
    if (this.fase !== "jogo") return [];
    const p = this.pessoa(quem);
    const m = this.mult, c = this.cfg.multiplicador;
    if (this.t < m.ate) return [];
    m.carga = Math.min(1, m.carga + Math.min(c.curtidaMaxima, n * c.curtida));
    if (m.carga < 1) return [{ tipo: "curtiu", id: p.id, nome: p.nome, carga: m.carga }];
    m.carga = 0;
    m.ate = this.t + c.duracao;
    return [{ tipo: "multiplicador", id: p.id, nome: p.nome, ate: m.ate }];
  }

  /* Reforço: a bola da pessoa fica dourada (vale dobrado) e vem uma extra. */
  seguiu(quem) {
    const lista = [];
    const p = this.pessoa(quem);
    this.marcarReal(lista);
    const atual = this.principal(p);
    if (atual) for (const b of [...this.bolasDe(p.id), ...this.lancamentos.filter(l => l.id === p.id)]) b.dourada = true;
    else this.pedirBola(p, { principal: true, dourada: true, presente: true }, lista);
    this.pedirBola(p, { dourada: true, presente: true }, lista);
    lista.unshift({ tipo: "reforco", id: p.id, nome: p.nome, cor: p.cor });
    return lista;
  }

  compartilhou(quem) {
    const lista = [];
    const p = this.pessoa(quem);
    this.marcarReal(lista);
    lista.push({ tipo: "compartilhou", id: p.id, nome: p.nome, cor: p.cor });
    this.pedirBola(p, { presente: true }, lista);
    return lista;
  }

  faixaDe(moedas) {
    let i = -1;
    this.cfg.faixas.forEach((f, k) => { if (moedas >= f.moedas) i = k; });
    return i;
  }

  /* `moedas` é o envio inteiro (com o combo). `faixa` vem do ⚙ (o streamer
     escolheu o efeito desse presente); sem ela vale pelo valor. */
  presente(quem, { nome, moedas, quantidade = 1, faixa = null }) {
    if (faixa === null) faixa = this.faixaDe(moedas);
    if (faixa < 0) return [];
    faixa = Math.min(FAIXAS_EFEITO.length - 1, faixa);
    const lista = [];
    const p = this.pessoa(quem);
    this.marcarReal(lista);
    const efeito = FAIXAS_EFEITO[faixa];
    const forma = FORMAS_BRILHO[Math.floor(this.sorte() * FORMAS_BRILHO.length)];
    if (p.fila.length < this.cfg.filaMaxima) p.fila.push({ efeito, forma });
    this.comEfeito.add(p);
    lista.push({ tipo: "presente", id: p.id, nome: p.nome, cor: p.cor, presente: nome, quantidade, moedas, faixa, efeito, forma });
    return lista;
  }

  /* ───────── bolas ───────── */

  /* Bola de comentário respeita o teto da mesa e a fila curta; bola de
     presente passa do teto até `maxPresente` e sempre entra na fila. */
  pedirBola(p, props, lista) {
    const naFila = this.lancamentos.filter(l => !l.presente).length;
    const naMesa = this.bolas.filter(b => !b.presente).length;
    if (!props.presente && naMesa + naFila >= this.cfg.maxBolas + this.cfg.filaCurta) {
      lista.push({ tipo: "lotado", id: p.id, nome: p.nome });
      return false;
    }
    this.lancamentos.push({ id: p.id, principal: false, dourada: false, brilho: null, presente: false, rapido: false, ...props });
    const espera = this.lancamentos.length - 1 + Math.max(0, this.bolas.length - this.cfg.maxBolas + 1);
    if (!props.presente && this.bolas.length >= this.cfg.maxBolas) lista.push({ tipo: "fila", id: p.id, nome: p.nome, pos: espera });
    return true;
  }

  lancarDaFila(lista) {
    if (!this.lancamentos.length || this.t < this.proximoLancamento) return;
    if (this.bolas.some(b => b.x > MESA.canal && b.y > 1380)) return;
    const k = this.lancamentos.findIndex(l => this.bolas.length < (l.presente ? this.cfg.maxPresente : this.cfg.maxBolas));
    if (k < 0) return;
    const [pedido] = this.lancamentos.splice(k, 1);
    const p = this.pessoas.get(pedido.id);
    const b = {
      n: ++this.nBola, id: p.id, nome: p.nome, cor: p.cor,
      x: LANCADOR.x, y: LANCADOR.y, antX: LANCADOR.x, antY: LANCADOR.y, vx: 0, vy: 0,
      pontos: 0, principal: pedido.principal, presente: pedido.presente, dourada: pedido.dourada, brilho: pedido.brilho,
      nasceu: this.t, paradoDesde: this.t, canal: true, bateu: new Map(),
    };
    this.impulsionar(b);
    this.bolas.push(b);
    this.proximoLancamento = this.t + (pedido.rapido ? 0.16 : 0.3);
    lista.push({ tipo: "lancou", n: b.n, id: p.id, nome: p.nome, cor: p.cor, principal: b.principal, dourada: b.dourada, brilho: b.brilho, multibola: !!pedido.rapido });
  }

  impulsionar(b) {
    b.vx = 0;
    b.vy = -this.cfg.lancamento * (0.94 + this.sorte() * 0.12);
  }

  /* ───────── pontos ───────── */

  multiplicadorDe(b) {
    const t = this.t;
    const p = this.pessoas.get(b.id);
    let m = 1;
    if (b.dourada || b.brilho) m *= 2;
    if (t < this.mult.ate) m *= 2;
    if (t < this.jackpot.festaAte) m *= 2;
    if (p && t < p.fogoAte) m *= 3;
    return m;
  }

  /* Ponto que a bola fez: vai pra dona dela, ou pra quem está com a mesa. */
  pontuar(b, base, lista, motivo, x, y) {
    const v = base * this.multiplicadorDe(b);
    b.pontos += v;
    const dono = (this.mesa && this.pessoas.get(this.mesa.id)) || this.pessoas.get(b.id);
    lista.push({ tipo: "pontos", motivo, valor: v, n: b.n, id: dono.id, nome: dono.nome, cor: b.cor, x, y });
    this.creditar(dono, v, lista);
    return v;
  }

  creditar(p, v, lista) {
    p.pontos += v;
    p.total += v;
    this.encher(p, v, lista);
  }

  encher(p, v, lista) {
    const j = this.jackpot, c = this.cfg.jackpot;
    j.valor += v;
    if (j.valor < j.meta) return;
    const bonus = Math.round(j.meta * c.bonus / 100) * 100;
    j.valor = 0;
    j.meta = Math.round(j.meta * c.cresce / 1000) * 1000;
    j.festaAte = this.t + c.festa;
    p.pontos += bonus;
    p.total += bonus;
    lista.push({ tipo: "jackpot", id: p.id, nome: p.nome, cor: p.cor, bonus, meta: j.meta, ate: j.festaAte });
  }

  /* ───────── efeitos de presente ───────── */

  efeitos(lista) {
    const t = this.t;
    for (const p of this.comEfeito) {
      if (p.ativo && t >= p.ativo.ate) {
        lista.push({ tipo: "acabou", efeito: p.ativo.efeito, id: p.id, nome: p.nome });
        if (p.ativo.efeito === "mesa") this.mesa = null;
        p.ativo = null;
      }
      if (p.ativo) continue;
      if (!p.fila.length) { this.comEfeito.delete(p); continue; }
      if (p.fila[0].efeito === "mesa" && this.mesa) continue;
      this.iniciarEfeito(p, p.fila.shift(), lista);
    }
  }

  iniciarEfeito(p, e, lista) {
    const t = this.t, cfg = this.cfg;
    const ev = { tipo: "efeito", efeito: e.efeito, id: p.id, nome: p.nome, cor: p.cor, forma: e.forma };
    const garantir = () => { if (!this.temBola(p)) this.pedirBola(p, { principal: true, presente: true }, lista); };
    switch (e.efeito) {
      case "brilho":
        this.pedirBola(p, { brilho: e.forma, presente: true }, lista);
        p.ativo = { efeito: "brilho", ate: t + 1.2 };
        break;
      case "ima":
        garantir();
        p.imaAte = t + cfg.ima;
        p.ativo = { efeito: "ima", ate: p.imaAte };
        break;
      case "multibola":
        for (let i = 0; i < 4; i++) this.pedirBola(p, { presente: true, rapido: true }, lista);
        p.ativo = { efeito: "multibola", ate: t + 2 };
        break;
      case "fogo": {
        garantir();
        p.fogoAte = t + cfg.fogo;
        p.ativo = { efeito: "fogo", ate: p.fogoAte };
        lista.push(ev);
        for (const a of this.geo.alvos) if (!a.caido) this.derrubar(a, null, p, lista);
        this.encher(p, Math.round(this.jackpot.meta * cfg.fogoJackpot), lista);
        ev.ate = p.fogoAte;
        return;
      }
      case "mesa":
        garantir();
        this.mesa = { id: p.id, nome: p.nome, cor: p.cor, ate: t + cfg.mesa };
        p.ativo = { efeito: "mesa", ate: this.mesa.ate };
        break;
    }
    ev.ate = p.ativo.ate;
    lista.push(ev);
  }

  /* ───────── peças da mesa ───────── */

  derrubar(a, b, p, lista) {
    a.caido = true;
    const pts = this.cfg.pontos;
    const x = (a.ax + a.bx) / 2, y = (a.ay + a.by) / 2;
    const valor = b ? this.pontuar(b, pts.alvo, lista, "alvo", x, y) : this.pontuarPessoa(p, pts.alvo, lista, "alvo", x, y);
    lista.push({ tipo: "alvo", i: a.i, banco: a.banco, valor, cor: b ? b.cor : p.cor });
    const banco = this.geo.alvos.filter(o => o.banco === a.banco);
    if (banco.every(o => o.caido)) {
      this.geo.bancos[a.banco].resetEm = this.t + 2.5;
      const v = b ? this.pontuar(b, pts.banco, lista, "banco", x, y) : this.pontuarPessoa(p, pts.banco, lista, "banco", x, y);
      lista.push({ tipo: "banco", banco: a.banco, valor: v });
    }
  }

  /* Ponto sem bola (bola de fogo derrubando alvo, prêmio da roleta). */
  pontuarPessoa(p, base, lista, motivo, x, y) {
    let m = 1;
    if (this.t < this.mult.ate) m *= 2;
    if (this.t < this.jackpot.festaAte) m *= 2;
    const dono = (this.mesa && this.pessoas.get(this.mesa.id)) || p;
    const v = base * m;
    lista.push({ tipo: "pontos", motivo, valor: v, n: 0, id: dono.id, nome: dono.nome, cor: p.cor, x, y });
    this.creditar(dono, v, lista);
    return v;
  }

  girarRoleta(b, lista) {
    const r = this.roleta;
    if (r.girando) return;
    const total = PREMIOS_ROLETA.reduce((s, x) => s + x.peso, 0);
    let s = this.sorte() * total, k = 0;
    for (; k < PREMIOS_ROLETA.length - 1; k++) { s -= PREMIOS_ROLETA[k].peso; if (s <= 0) break; }
    Object.assign(r, { girando: true, ate: this.t + 1.6, premio: k, id: b.id, bola: b.n });
    lista.push({ tipo: "roleta", premio: k, id: b.id, nome: b.nome, cor: b.cor, ate: r.ate });
  }

  pagarRoleta(lista) {
    const r = this.roleta;
    r.girando = false;
    const p = this.pessoas.get(r.id);
    const pr = PREMIOS_ROLETA[r.premio];
    const g = this.geo.roleta;
    let valor = 0;
    if (pr.pontos) {
      const b = this.bolas.find(x => x.n === r.bola);
      valor = b ? this.pontuar(b, pr.pontos, lista, "roleta", g.x, g.y) : this.pontuarPessoa(p, pr.pontos, lista, "roleta", g.x, g.y);
    } else if (pr.id === "bola") this.pedirBola(p, { presente: true }, lista);
    else if (pr.id === "mult") {
      const m = this.mult;
      if (this.t >= m.ate) {
        m.carga += 0.5;
        if (m.carga >= 1) {
          m.carga = 0;
          m.ate = this.t + this.cfg.multiplicador.duracao;
          lista.push({ tipo: "multiplicador", id: p.id, nome: p.nome, ate: m.ate });
        }
      }
    } else if (pr.id === "jackpot") this.encher(p, Math.round(this.jackpot.meta * 0.06), lista);
    lista.push({ tipo: "premio", premio: r.premio, rotulo: pr.rotulo, id: p.id, nome: p.nome, cor: p.cor, valor });
  }

  /* ───────── flippers ───────── */

  /* Bola em cima ou chegando no flipper parado, do lado dele. */
  naZona(f, b) {
    if (b.canal || b.vy < -250) return false;
    const ux = Math.cos(f.repouso), uy = Math.sin(f.repouso);
    let nx = -uy, ny = ux;
    if (ny > 0) { nx = -nx; ny = -ny; }
    const dx = b.x - f.px, dy = b.y - f.py;
    const ao = dx * ux + dy * uy;
    const alto = dx * nx + dy * ny;
    return ao > -10 && ao < f.len + 18 && alto > -6 && alto < RAIO + 95;
  }

  /* Reflexo imperfeito: demora um pouco pra bater e às vezes deixa passar. */
  ia(lista) {
    const t = this.t, c = this.cfg.ia;
    for (const f of this.geo.flippers) {
      if (this.mesa) {
        if (!f.alvo) lista.push({ tipo: "flipper", lado: f.lado });
        f.alvo = 1; f.soltaEm = 0; f.bateEm = 0;
        continue;
      }
      if (f.alvo && !f.soltaEm) f.soltaEm = t + 0.2;
      if (f.alvo && t >= f.soltaEm) { f.alvo = 0; f.soltaEm = 0; f.esperaAte = t + 0.1; }
      if (f.alvo) continue;
      if (f.bateEm) {
        if (t >= f.bateEm) {
          f.bateEm = 0; f.alvo = 1; f.soltaEm = t + 0.22;
          lista.push({ tipo: "flipper", lado: f.lado });
        }
        continue;
      }
      if (t < f.esperaAte) continue;
      for (const b of this.bolas) {
        if (!this.naZona(f, b)) { f.ignora.delete(b.n); continue; }
        if (f.ignora.has(b.n)) continue;
        if (this.sorte() < c.erro) { f.ignora.add(b.n); continue; }
        f.bateEm = t + c.reacao + this.sorte() * c.variacao;
        break;
      }
    }
  }

  moverFlipper(f, h) {
    const alvo = f.alvo ? f.cima : f.repouso;
    const vel = (f.alvo ? GIRO_SOBE : GIRO_DESCE) * h;
    const d = Math.max(-vel, Math.min(vel, alvo - f.ang));
    f.ang += d;
    f.w = d / h;
    f.tx = f.px + f.len * Math.cos(f.ang);
    f.ty = f.py + f.len * Math.sin(f.ang);
  }

  /* ───────── física ───────── */

  /* Empurra a bola pra fora de um ponto de contato (`raio` = espessura da
     peça) e rebate a velocidade relativa à peça (wx, wy). Devolve a força da
     batida, ou -1 se não encostou. A normal fica em _kx/_ky pro chute. */
  resolver(b, qx, qy, raio, e, wx, wy, sdx, sdy) {
    let nx = b.x - qx, ny = b.y - qy;
    const min = raio + RAIO;
    const d2 = nx * nx + ny * ny;
    if (d2 >= min * min) return -1;
    let d = Math.sqrt(d2);
    if (d < 1e-6) {
      /* Centro em cima da peça: sai pro lado de onde a bola veio. */
      nx = -sdy; ny = sdx;
      if ((b.ox - qx) * nx + (b.oy - qy) * ny < 0) { nx = -nx; ny = -ny; }
      d = Math.hypot(nx, ny) || 1;
      nx /= d; ny /= d;
    } else { nx /= d; ny /= d; }
    b.x = qx + nx * min;
    b.y = qy + ny * min;
    this._kx = nx; this._ky = ny;
    const rvx = b.vx - wx, rvy = b.vy - wy;
    const vn = rvx * nx + rvy * ny;
    if (vn >= 0) return 0;
    const tx = -ny, ty = nx, vt = rvx * tx + rvy * ty;
    b.vx = wx + rvx - (1 + e) * vn * nx - 0.02 * vt * tx;
    b.vy = wy + rvy - (1 + e) * vn * ny - 0.02 * vt * ty;
    return -vn;
  }

  contraSegmento(b, s, e) {
    if (b.x < s.x0 || b.x > s.x1 || b.y < s.y0 || b.y > s.y1) return -1;
    let u = ((b.x - s.ax) * s.dx + (b.y - s.ay) * s.dy) / s.l2;
    u = u < 0 ? 0 : u > 1 ? 1 : u;
    return this.resolver(b, s.ax + s.dx * u, s.ay + s.dy * u, s.r, e, 0, 0, s.dx, s.dy);
  }

  chutar(b, forca) {
    b.vx += this._kx * forca;
    b.vy += this._ky * forca;
  }

  /* Uma batida por peça por bola a cada tanto: a bola encostada não vira
     metralhadora de pontos. */
  bateuAgora(b, chave, espera = 0.08) {
    const antes = b.bateu.get(chave);
    if (antes != null && this.t - antes < espera) return false;
    b.bateu.set(chave, this.t);
    return true;
  }

  moverBola(b, h, lista) {
    const t = this.t, geo = this.geo;
    const p = this.pessoas.get(b.id);
    const ima = p && t < p.imaAte && !b.canal;
    if (ima) {
      let alvo = geo.bumpers[0], melhor = Infinity;
      for (const k of geo.bumpers) {
        const d = (k.x - b.x) ** 2 + (k.y - b.y) ** 2;
        if (d < melhor) { melhor = d; alvo = k; }
      }
      const d = Math.sqrt(melhor) || 1;
      b.vx += (alvo.x - b.x) / d * 4200 * h;
      b.vy += (alvo.y - b.y) / d * 4200 * h;
    } else b.vy += this.cfg.gravidade * h;
    const v = Math.hypot(b.vx, b.vy);
    if (v > VMAX) { b.vx *= VMAX / v; b.vy *= VMAX / v; }
    b.ox = b.x; b.oy = b.y;
    b.x += b.vx * h;
    b.y += b.vy * h;

    for (const s of geo.paredes) {
      if (s.umaVia && b.vy <= 0) continue;
      if (s.tipo === "trava") {
        if (!this.mesa) continue;
        if (this.contraSegmento(b, s, 0.4) >= 0) {
          if (b.vy > -1300) b.vy = -1300 - this.sorte() * 400;
          if (this.bateuAgora(b, "trava", 0.3)) lista.push({ tipo: "trava", x: b.x });
        }
        continue;
      }
      const e = s.tipo === "estilingue" ? ELASTICO.estilingue : ELASTICO.parede;
      const forca = this.contraSegmento(b, s, e);
      if (forca > 120 && s.tipo === "estilingue" && this.bateuAgora(b, "e" + s.i, 0.12)) {
        this.chutar(b, 950);
        const x = (s.ax + s.bx) / 2, y = (s.ay + s.by) / 2;
        const valor = this.pontuar(b, this.cfg.pontos.estilingue, lista, "estilingue", x, y);
        lista.push({ tipo: "estilingue", i: s.i, valor, cor: b.cor });
      }
    }

    for (const k of geo.bumpers) {
      if (Math.abs(b.x - k.x) > k.r + RAIO || Math.abs(b.y - k.y) > k.r + RAIO) continue;
      const forca = this.resolver(b, k.x, k.y, k.r, ELASTICO.bumper, 0, 0, 1, 0);
      if (forca < 0) continue;
      this.chutar(b, ima ? 520 : 720);
      if (this.bateuAgora(b, "b" + k.i)) {
        const valor = this.pontuar(b, this.cfg.pontos.bumper, lista, "bumper", k.x, k.y - k.r);
        lista.push({ tipo: "bumper", i: k.i, valor, cor: b.cor, n: b.n });
      }
    }

    for (const a of geo.alvos) {
      if (a.caido) continue;
      if (this.contraSegmento(b, a, ELASTICO.alvo) >= 0 && !a.caido) this.derrubar(a, b, p, lista);
    }

    const g = geo.roleta;
    if (Math.abs(b.x - g.x) < g.r + RAIO && Math.abs(b.y - g.y) < g.r + RAIO) {
      if (this.resolver(b, g.x, g.y, g.r, ELASTICO.roleta, 0, 0, 1, 0) >= 0) {
        this.chutar(b, 260);
        this.girarRoleta(b, lista);
      }
    }

    for (const f of geo.flippers) {
      if (Math.abs(b.x - f.px) > f.len + 60 || Math.abs(b.y - f.py) > f.len + 60) continue;
      const fx = f.tx - f.px, fy = f.ty - f.py;
      let u = ((b.x - f.px) * fx + (b.y - f.py) * fy) / (f.len * f.len);
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      const qx = f.px + fx * u, qy = f.py + fy * u;
      this.resolver(b, qx, qy, f.r0 + (f.r1 - f.r0) * u, ELASTICO.flipper, -f.w * (qy - f.py), f.w * (qx - f.px), fx, fy);
    }

    for (const s of geo.sensores) {
      const dentro = (b.x - s.x) ** 2 + (b.y - s.y) ** 2 < s.r * s.r;
      if (!dentro) { s.dentro.delete(b.n); continue; }
      if (s.dentro.has(b.n)) continue;
      s.dentro.add(b.n);
      if (s.tipo === "rampa" && b.vy < 0) {
        const valor = this.pontuar(b, this.cfg.pontos.rampa, lista, "rampa", s.x, s.y);
        lista.push({ tipo: "rampa", i: s.i, valor, cor: b.cor, nome: b.nome });
      } else if (s.tipo === "rollover") this.rolar(s, b, lista);
    }
    const vfim = Math.hypot(b.vx, b.vy);
    if (vfim > VMAX) { b.vx *= VMAX / vfim; b.vy *= VMAX / vfim; }
  }

  rolar(s, b, lista) {
    const luzes = this.geo.rollovers;
    luzes[s.i] = true;
    const valor = this.pontuar(b, this.cfg.pontos.rollover, lista, "rollover", s.x, s.y);
    lista.push({ tipo: "rollover", i: s.i, valor, cor: b.cor });
    if (luzes.every(Boolean)) {
      luzes.fill(false);
      const v = this.pontuar(b, this.cfg.pontos.rollovers, lista, "rollovers", 498, 205);
      lista.push({ tipo: "rollovers", valor: v, cor: b.cor });
    }
  }

  entreBolas() {
    const bs = this.bolas;
    const min = RAIO * 2;
    for (let i = 0; i < bs.length; i++) {
      const a = bs[i];
      for (let j = i + 1; j < bs.length; j++) {
        const b = bs[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        if (dx > min || dx < -min || dy > min || dy < -min) continue;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min || d2 < 1e-9) continue;
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, sobra = (min - d) / 2;
        a.x -= nx * sobra; a.y -= ny * sobra;
        b.x += nx * sobra; b.y += ny * sobra;
        const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (vn >= 0) continue;
        const k = (1 + ELASTICO.bola) * vn / 2;
        a.vx += k * nx; a.vy += k * ny;
        b.vx -= k * nx; b.vy -= k * ny;
      }
    }
  }

  fisica(lista) {
    const h = PASSO / SUB;
    for (const b of this.bolas) { b.antX = b.x; b.antY = b.y; }
    for (let s = 0; s < SUB; s++) {
      for (const f of this.geo.flippers) this.moverFlipper(f, h);
      for (const b of this.bolas) this.moverBola(b, h, lista);
      if (this.bolas.length > 1) this.entreBolas();
    }
    const t = this.t;
    for (let i = this.bolas.length - 1; i >= 0; i--) {
      const b = this.bolas[i];
      b.canal = b.x > MESA.canal + 6;
      if (b.y > MESA.altura + RAIO || b.x < 0 || b.x > MESA.largura) {
        this.bolas.splice(i, 1);
        this.caiu(b, lista);
        continue;
      }
      const v = Math.hypot(b.vx, b.vy);
      if (b.canal && b.y > 1530 && v < 60) {
        this.impulsionar(b);
        lista.push({ tipo: "relancou", n: b.n });
        continue;
      }
      if (v > 40) b.paradoDesde = t;
      else if (t - b.paradoDesde > 3) {
        /* Bola presa (encaixada num canto): a mesa dá um chacoalhão. */
        b.vy = -900;
        b.vx = (this.sorte() - 0.5) * 600;
        b.paradoDesde = t;
      }
    }
  }

  caiu(b, lista) {
    for (const f of this.geo.flippers) f.ignora.delete(b.n);
    for (const s of this.geo.sensores) s.dentro.delete(b.n);
    lista.push({ tipo: "caiu", n: b.n, id: b.id, nome: b.nome, cor: b.cor, pontos: b.pontos, x: b.x, principal: b.principal });
    this.fecharBola(b, lista);
  }

  /* Conta a bola pra melhor da rodada e pro recorde da live. */
  fecharBola(b, lista) {
    if (b.pontos > this.melhorBola.pontos) this.melhorBola = { pontos: b.pontos, nome: b.nome, id: b.id, cor: b.cor };
    if (b.pontos > this.recorde.pontos && b.pontos >= this.cfg.recordeMinimo) {
      this.recorde = { pontos: b.pontos, nome: b.nome, id: b.id };
      lista.push({ tipo: "recorde", id: b.id, nome: b.nome, cor: b.cor, pontos: b.pontos });
    }
  }

  relogios(lista) {
    const t = this.t, geo = this.geo;
    if (this.roleta.girando && t >= this.roleta.ate) this.pagarRoleta(lista);
    geo.bancos.forEach((k, i) => {
      if (k.resetEm && t >= k.resetEm) {
        k.resetEm = 0;
        for (const a of geo.alvos) if (a.banco === i) a.caido = false;
        lista.push({ tipo: "subiu", banco: i });
      }
    });
    if (this.mult.ate && t >= this.mult.ate) { this.mult.ate = 0; lista.push({ tipo: "fimMultiplicador" }); }
    if (this.jackpot.festaAte && t >= this.jackpot.festaAte) { this.jackpot.festaAte = 0; lista.push({ tipo: "fimFesta" }); }
  }

  /* ───────── a rodada ───────── */

  comecarRodada(lista) {
    this.rodada++;
    this.fase = "jogo";
    this.fimFase = Infinity;
    this.relogio = this.cfg.duracao;
    this.melhorBola = { pontos: 0, nome: null, id: null, cor: null };
    for (const p of this.pessoas.values()) p.pontos = 0;
    lista.push({ tipo: "rodada", n: this.rodada });
  }

  terminar(lista) {
    const limpas = this.bolas.map(b => ({ n: b.n, x: b.x, y: b.y, cor: b.cor }));
    for (const b of this.bolas) this.fecharBola(b, lista);
    this.bolas = [];
    this.mesa = null;
    this.mult = { carga: this.mult.carga, ate: 0 };
    this.jackpot.festaAte = 0;
    this.roleta.girando = false;
    for (const p of this.pessoas.values()) {
      p.ativo = null;
      p.imaAte = p.fogoAte = 0;
    }
    for (const f of this.geo.flippers) { f.alvo = 0; f.bateEm = 0; f.soltaEm = 0; f.ignora.clear(); }
    this.fase = "fim";
    this.fimFase = this.t + this.cfg.podio;
    lista.push({ tipo: "limpou", bolas: limpas });
    lista.push({ tipo: "fim", rodada: this.rodada, podio: this.rankingRodada(3), melhorBola: { ...this.melhorBola } });
  }

  passo(dt) {
    const lista = [];
    this.acumulado += dt;
    while (this.acumulado >= PASSO) {
      this.acumulado -= PASSO;
      this.tique(lista);
    }
    this.alfa = this.acumulado / PASSO;
    return lista;
  }

  tique(lista) {
    this.t += PASSO;
    if (this.fase === "jogo") this.jogar(lista);
    else if (this.fase === "fim" && this.t >= this.fimFase) {
      if (this.t - this.ultimoReal < this.cfg.ociosidade) this.comecarRodada(lista);
      else {
        this.fase = "espera";
        this.fimFase = Infinity;
        lista.push({ tipo: "aguardando" });
      }
    }
  }

  jogar(lista) {
    if (!this.ocioso && this.t - this.ultimoReal > this.cfg.ociosidade) {
      this.ocioso = true;
      lista.push({ tipo: "ocioso" });
    }
    if (!this.ocioso) {
      const antes = this.relogio;
      this.relogio = Math.max(0, this.relogio - PASSO);
      if (antes > 10 && this.relogio <= 10) lista.push({ tipo: "ultimos" });
    }
    this.efeitos(lista);
    this.lancarDaFila(lista);
    this.ia(lista);
    this.fisica(lista);
    this.relogios(lista);
    if (this.relogio === 0) this.terminar(lista);
  }

  /* Tecla de teste: termina a rodada já. */
  encerrar() {
    if (this.fase === "jogo") this.relogio = 0;
  }

  rankingRodada(n = 3) {
    return [...this.pessoas.values()].filter(p => p.pontos > 0).sort((a, b) => b.pontos - a.pontos).slice(0, n)
      .map(p => ({ id: p.id, nome: p.nome, cor: p.cor, pontos: p.pontos }));
  }

  rankingLive(n = 5) {
    return [...this.pessoas.values()].filter(p => p.total > 0).sort((a, b) => b.total - a.total).slice(0, n)
      .map(p => ({ id: p.id, nome: p.nome, cor: p.cor, pontos: p.total }));
  }

  resta() { return Math.max(0, this.fimFase - this.t); }
}

if (typeof module !== "undefined") {
  module.exports = { Pinball, PASSO, SUB, RAIO, VMAX, MESA, CORES, FAIXAS_EFEITO, FORMAS_BRILHO, PREMIOS_ROLETA, montarMesa, segmento };
}
