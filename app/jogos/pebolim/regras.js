/* Regras do Pebolim Gigante: quem joga o clássico, os bonecos com @ de cada
   time, a física da mesa (bola, varetas, chute), a IA das varetas, a pressão
   da torcida, os efeitos de presente, o placar, o gol de ouro e o ranking.
   Sem DOM: o tempo anda pelo `passo(dt)` em passos fixos de 60 Hz, o sorteio
   é injetável e tudo que acontece volta numa lista de acontecimentos pra
   cena, o HUD e o som. */
"use strict";

function normalizar(texto) {
  return String(texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim();
}

/* Primeiro time citado no texto, por palavra inteira. No mesmo ponto do
   texto ganha o apelido mais comprido ("sao paulo" antes de um "sao"). */
function reconhecerTime(times, texto) {
  const alvo = ` ${normalizar(texto)} `;
  if (alvo.length <= 2) return null;
  let melhor = null;
  for (const t of times) {
    for (const apelido of t.apelidos || []) {
      const a = normalizar(apelido);
      if (!a) continue;
      const i = alvo.indexOf(` ${a} `);
      if (i < 0) continue;
      if (!melhor || i < melhor.i || (i === melhor.i && a.length > melhor.tam)) melhor = { i, tam: a.length, time: t };
    }
  }
  return melhor ? melhor.time : null;
}

const PALAVRAS_BOMBA = new Set(["chuta", "chute", "chutao", "chuuta", "bomba", "bombinha", "bombaaa", "isola", "fuzila"]);

function pediuBomba(texto) {
  return normalizar(texto).split(" ").some(p => PALAVRAS_BOMBA.has(p));
}

/* Mesa em centímetros, vista de cima: x atravessa a tela, y vai do gol do
   time A (embaixo, y < 0) ao gol do time B. Chanfro nos quatro cantos pra
   bola não morrer parada ali. */
const MESA = { larg: 68, comp: 116, gol: 20, chanfro: 7, raio: 1.7, passo: 1 / 60, subpassos: 6 };

/* As 8 varetas de baixo pra cima, como numa mesa de verdade. */
const VARETAS = [
  ["a", "goleiro", [0]],
  ["a", "zaga", [-11, 11]],
  ["b", "ataque", [-19, 0, 19]],
  ["a", "meio", [-24, -12, 0, 12, 24]],
  ["b", "meio", [-24, -12, 0, 12, 24]],
  ["a", "ataque", [-19, 0, 19]],
  ["b", "zaga", [-11, 11]],
  ["b", "goleiro", [0]],
];

/* `base`: primeiro lugar da função no elenco de 11. `mira`: erro do chute em
   meias-larguras de gol (zaga chuta pra frente, o ataque mira). */
const FUNCOES = {
  goleiro: { base: 0, numeros: [1], forca: 160, mira: 2.6, reacao: 11 },
  zaga: { base: 1, numeros: [2, 3], forca: 175, mira: 2.2, reacao: 8 },
  meio: { base: 3, numeros: [6, 8, 5, 10, 4], forca: 195, mira: 1.7, reacao: 7 },
  ataque: { base: 8, numeros: [7, 9, 11], forca: 235, mira: 1.25, reacao: 7.5 },
};

/* Quem chega primeiro ganha o centroavante, depois os meias, a zaga e o gol. */
const ORDEM_ENTRADA = [9, 8, 10, 5, 4, 6, 3, 7, 1, 2, 0];
const PE = { x: 1.5, y: 1.3 };
const PAREDAO_X = 6.5;
const ZONA_CHUTE = { tras: -5, frente: 5 };
const VELOCIDADE_VARETA = 92;

const FAIXAS_EFEITO = ["brilho", "canhao", "gelo", "fogo", "chuva"];
const FORMAS_BRILHO = ["estrela", "coracao", "raio"];

function cursoDe(funcao, homens) {
  if (funcao === "goleiro") return MESA.gol / 2 + 3;
  return MESA.larg / 2 - 2.4 - Math.max(...homens.map(Math.abs));
}

function novaMesa() {
  return {
    varetas: VARETAS.map(([lado, funcao, homens], i) => ({
      i, lado, funcao, homens,
      y: -MESA.comp / 2 + (i + 0.5) * MESA.comp / VARETAS.length,
      dir: lado === "a" ? 1 : -1,
      curso: cursoDe(funcao, homens),
      pos: 0, ant: 0, vel: 0, visto: 0,
      ang: 0, angAnt: 0, chute: null, espera: 0,
    })),
    bolas: [],
  };
}

function lugarDe(v, k) { return FUNCOES[v.funcao].base + k; }

function novoElenco() {
  const elenco = [];
  for (const f of Object.values(FUNCOES)) {
    for (const n of f.numeros) elenco.push({ numero: n, dono: null, desde: 0, gols: 0, craque: false, bomba: false });
  }
  return elenco;
}

class Pebolim {
  constructor(cfg, aleatorio = Math.random) {
    this.cfg = cfg;
    this.sorte = aleatorio;
    this.zerar();
  }

  zerar() {
    this.t = 0;
    this.acumulado = 0;
    this.alfa = 0;
    this.rodada = 0;
    this.fase = "aquecimento";
    this.fimFase = this.cfg.tempos.aquecimento;
    this.pessoas = new Map();
    this.citacoes = new Map();
    this.ultimoReal = 0;
    this.artilheiros = new Map();
    this.vitorias = new Map();
    this.jogo = null;
    this.esperando = false;
    this.idBola = 0;
    this.porId = new Map(this.cfg.times.map(t => [t.id, t]));
    this.mesa = novaMesa();
  }

  time(id) { return this.porId.get(id) || null; }

  pessoa(quem) {
    const id = String(quem.id || quem.nome);
    let p = this.pessoas.get(id);
    if (!p) {
      p = { id, nome: quem.nome || id, time: null, craqueRodada: -1, bombaEm: -Infinity };
      this.pessoas.set(id, p);
    } else if (quem.nome) p.nome = quem.nome;
    return p;
  }

  /* ───────── quem joga ───────── */

  /* Pessoas diferentes que citaram cada time na janela, sem os que já estão
     em campo; do mais citado pro menos. */
  ranqueCitacoes(fora = []) {
    const limite = this.t - this.cfg.janelaCitacao;
    const conta = new Map();
    for (const [id, c] of this.citacoes) {
      if (c.t < limite) { this.citacoes.delete(id); continue; }
      if (fora.includes(c.time)) continue;
      conta.set(c.time, (conta.get(c.time) || 0) + c.peso);
    }
    return [...conta].sort((a, b) => b[1] - a[1]).map(([time, n]) => ({ time, n }));
  }

  sortearTime(fora) {
    const lista = this.cfg.times.filter(t => !fora.includes(t.id));
    const total = lista.reduce((s, t) => s + (t.peso || 1), 0);
    let r = this.sorte() * total;
    for (const t of lista) { r -= t.peso || 1; if (r <= 0) return t.id; }
    return lista[lista.length - 1].id;
  }

  emCampo(p) {
    const j = this.jogo;
    return !!(j && p.time && (p.time === j.a || p.time === j.b));
  }

  /* ───────── bonecos ───────── */

  /* O boneco da pessoa no time dela: o que já tem, um livre ou o do @ mais
     antigo que ainda não marcou nesta partida. */
  darBoneco(p) {
    const j = this.jogo;
    const elenco = j.bonecos[p.time];
    let k = elenco.findIndex(b => b.dono && b.dono.id === p.id);
    if (k >= 0) {
      elenco[k].desde = this.t;
      elenco[k].dono.nome = p.nome;
      return { lugar: k, novo: false, saiu: null };
    }
    k = ORDEM_ENTRADA.find(i => !elenco[i].dono);
    let saiu = null;
    if (k === undefined) {
      let antigo = null;
      for (const i of ORDEM_ENTRADA) {
        const b = elenco[i];
        if (b.gols === 0 && (!antigo || b.desde < antigo.desde)) antigo = { i, desde: b.desde };
      }
      if (!antigo) return { lugar: null, novo: false, saiu: null };
      k = antigo.i;
      saiu = { ...elenco[k].dono };
    }
    Object.assign(elenco[k], {
      dono: { id: p.id, nome: p.nome }, desde: this.t, gols: 0,
      craque: p.craqueRodada === this.rodada, bomba: false,
    });
    return { lugar: k, novo: true, saiu };
  }

  tirarBoneco(p) {
    const j = this.jogo;
    if (!j) return;
    for (const id of [j.a, j.b]) {
      for (const b of j.bonecos[id]) {
        if (b.dono && b.dono.id === p.id) Object.assign(b, { dono: null, gols: 0, craque: false, bomba: false });
      }
    }
  }

  lugarDaPessoa(p) {
    const j = this.jogo;
    if (!this.emCampo(p)) return -1;
    return j.bonecos[p.time].findIndex(b => b.dono && b.dono.id === p.id);
  }

  /* ───────── live ───────── */

  comentario(quem, texto) {
    const time = reconhecerTime(this.cfg.times, texto);
    const p = this.pessoa(quem);
    const bomba = pediuBomba(texto);
    const lista = [];
    if (time) {
      this.ultimoReal = this.t;
      if (p.time !== time.id) this.tirarBoneco(p);
      p.time = time.id;
      const atual = this.citacoes.get(p.id);
      this.citacoes.set(p.id, { time: time.id, t: this.t, peso: Math.max(1, atual && atual.time === time.id ? atual.peso : 1) });
    } else if (!bomba || !p.time) return lista;
    else this.ultimoReal = this.t;

    const j = this.jogo;
    const emCampo = this.emCampo(p);
    const ev = { tipo: "comentou", id: p.id, nome: p.nome, time: p.time, lugar: null, novo: false, saiu: null, bomba: false, desafiante: false };
    if (emCampo) {
      Object.assign(ev, this.darBoneco(p));
      if (bomba && ev.lugar !== null && this.t >= p.bombaEm) {
        j.bonecos[p.time][ev.lugar].bomba = true;
        p.bombaEm = this.t + this.cfg.intervaloBomba;
        ev.bomba = true;
      }
    } else if (j) ev.desafiante = true;
    lista.push(ev);
    if (this.fase === "pausa" && emCampo) this.retomar(lista);
    return lista;
  }

  curtida(quem, n = 1) {
    const p = this.pessoas.get(String(quem.id || quem.nome));
    const j = this.jogo;
    if (!p || !this.emCampo(p)) return [];
    j.pressao[p.time] = Math.min(1, j.pressao[p.time] + n / this.cfg.curtidasPorPressao);
    return [{ tipo: "curtiu", id: p.id, nome: p.nome, time: p.time, pressao: j.pressao[p.time] }];
  }

  /* Reforço: o boneco da pessoa fica dourado até a partida acabar. Quem
     ainda não estava em campo entra. */
  seguiu(quem) {
    const p = this.pessoa(quem);
    const j = this.jogo;
    p.craqueRodada = j && !j.vencedor ? this.rodada : this.rodada + 1;
    const ev = { tipo: "seguiu", id: p.id, nome: p.nome, time: p.time, lugar: null };
    if (j && this.emCampo(p) && !j.vencedor) {
      const r = this.darBoneco(p);
      if (r.lugar !== null) j.bonecos[p.time][r.lugar].craque = true;
      ev.lugar = r.lugar;
    }
    return [ev];
  }

  compartilhou(quem) {
    const p = this.pessoa(quem);
    return [{ tipo: "compartilhou", id: p.id, nome: p.nome, time: p.time || (this.jogo ? this.perdendo() : null) }];
  }

  faixaDe(moedas) {
    let i = -1;
    this.cfg.faixas.forEach((f, k) => { if (moedas >= f.moedas) i = k; });
    return i;
  }

  perdendo() {
    const j = this.jogo;
    return j.gols[j.a] <= j.gols[j.b] ? j.a : j.b;
  }

  citarComPeso(p, faixa) {
    const c = this.citacoes.get(p.id);
    this.citacoes.set(p.id, { time: p.time, t: this.t, peso: (c && c.time === p.time ? c.peso : 1) + 1 + faixa * 2 });
  }

  /* `moedas` é o envio inteiro (com o combo). `faixa` vem do ⚙ (o streamer
     escolheu o efeito desse presente); sem ela vale pelo valor. */
  presente(quem, { nome, moedas, quantidade = 1, faixa = null }) {
    if (faixa === null) faixa = this.faixaDe(moedas);
    if (faixa < 0) return [];
    faixa = Math.min(FAIXAS_EFEITO.length - 1, faixa);
    const p = this.pessoa(quem);
    const j = this.jogo;
    const efeito = FAIXAS_EFEITO[faixa];
    const base = { tipo: "presente", id: p.id, nome: p.nome, presente: nome, quantidade, moedas, faixa, efeito };

    /* Torcedor de time fora do clássico: o presente vira força pro time dele
       entrar no próximo. */
    if (j && p.time && !this.emCampo(p)) {
      this.citarComPeso(p, faixa);
      return [{ ...base, time: p.time, desafiante: true }];
    }
    if (!j) {
      if (p.time) this.citarComPeso(p, faixa);
      return [{ ...base, time: p.time, aquecimento: true }];
    }
    const time = p.time || this.perdendo();
    const fila = j.efeitos[time];
    const forma = FORMAS_BRILHO[Math.floor(this.sorte() * FORMAS_BRILHO.length)];
    if (fila.length < this.cfg.filaMaxima) fila.push({ efeito, de: p.nome, id: p.id, forma });
    this.ultimoReal = this.t;
    const ev = { ...base, time, semTime: !p.time, forma, lugar: null };
    if (p.time && !j.vencedor) ev.lugar = this.darBoneco(p).lugar;
    const lista = [ev];
    if (this.fase === "pausa") this.retomar(lista);
    return lista;
  }

  /* ───────── a partida ───────── */

  comecar(a, b, lista) {
    this.rodada++;
    const par = v => ({ [a]: v(), [b]: v() });
    this.jogo = {
      a, b, lado: { a, b },
      gols: par(() => 0), bonecos: par(novoElenco), efeitos: par(() => []), especial: par(() => null),
      pressao: par(() => 0), turbo: par(() => 0), gelo: par(() => 0), paredao: par(() => 0),
      chuvaAte: 0, relogio: this.cfg.duracao, ouro: false, vencedor: null,
    };
    this.mesa = novaMesa();
    /* Quem citou um dos dois na janela já entra em campo, na ordem em que
       comentou: com mais de 11, os mais recentes ficam. */
    const citou = [...this.citacoes].filter(([, c]) => c.time === a || c.time === b).sort((x, y) => x[1].t - y[1].t);
    for (const [id, c] of citou) {
      const p = this.pessoas.get(id);
      if (p && p.time === c.time) this.darBoneco(p);
    }
    for (const id of [a, b]) for (const [pid, c] of this.citacoes) if (c.time === id) this.citacoes.delete(pid);
    lista.push({ tipo: "classico", a, b, rodada: this.rodada });
    this.fase = "abertura";
    this.fimFase = this.t + this.cfg.tempos.abertura;
  }

  novaBola(extra) {
    const s = () => (this.sorte() < 0.5 ? -1 : 1);
    const bola = {
      id: ++this.idBola, extra,
      x: 0, y: 0, ax: 0, ay: 0,
      vx: s() * (25 + this.sorte() * 35), vy: s() * (18 + this.sorte() * 22),
      parada: 0, fogo: false, efeito: null, toque: { a: null, b: null }, ultimo: null,
    };
    this.mesa.bolas.push(bola);
    return bola;
  }

  /* A bola entra pelo meio da mesa, como no buraco do saque. */
  sacar(lista) {
    this.fase = "jogo";
    this.fimFase = Infinity;
    const bola = this.novaBola(false);
    lista.push({ tipo: "saque", bola: bola.id });
  }

  retomar(lista) {
    lista.push({ tipo: "retomou" });
    this.ultimoReal = this.t;
    if (!this.mesa.bolas.some(b => !b.extra)) this.sacar(lista);
    else {
      this.fase = "jogo";
      this.fimFase = Infinity;
    }
  }

  pausar(lista) {
    const j = this.jogo;
    this.fase = "pausa";
    this.fimFase = Infinity;
    this.mesa.bolas = [];
    j.chuvaAte = 0;
    lista.push({ tipo: "ocioso", a: j.a, b: j.b });
  }

  terminar(lista) {
    const j = this.jogo;
    const perdedor = j.vencedor === j.a ? j.b : j.a;
    this.vitorias.set(j.vencedor, (this.vitorias.get(j.vencedor) || 0) + 1);
    this.mesa.bolas = [];
    this.fase = "fim";
    this.fimFase = this.t + this.cfg.tempos.fim;
    lista.push({ tipo: "fim", vencedor: j.vencedor, perdedor, gols: { ...j.gols }, rodada: this.rodada, ouro: j.ouro });
  }

  /* O vencedor fica e pega o desafiante mais citado; sem desafiante, revanche. */
  proximoClassico(lista) {
    const j = this.jogo;
    const fica = j.vencedor;
    const perdedor = fica === j.a ? j.b : j.a;
    const desafiante = this.ranqueCitacoes([fica])[0];
    const outro = desafiante ? desafiante.time : perdedor;
    this.jogo = null;
    this.comecar(fica, outro, lista);
    lista[lista.length - 1].revanche = !desafiante;
  }

  /* Dois times citados: começa. Um só: o rival é sorteado. Ninguém: espera. */
  fimDoAquecimento(lista) {
    const ranque = this.ranqueCitacoes();
    if (!ranque.length) {
      this.fimFase = this.t + 1;
      if (!this.esperando) lista.push({ tipo: "aguardando" });
      this.esperando = true;
      return;
    }
    this.esperando = false;
    const a = ranque[0].time;
    const b = ranque[1] ? ranque[1].time : this.sortearTime([a]);
    this.comecar(a, b, lista);
  }

  mudarFase(lista) {
    switch (this.fase) {
      case "aquecimento": this.fimDoAquecimento(lista); break;
      case "abertura": this.sacar(lista); break;
      case "gol":
        if (this.jogo.vencedor) this.terminar(lista);
        else this.sacar(lista);
        break;
      case "fim":
        this.fase = "intervalo";
        this.fimFase = this.t + this.cfg.tempos.intervalo;
        lista.push({ tipo: "intervalo" });
        break;
      case "intervalo": this.proximoClassico(lista); break;
    }
  }

  /* ───────── relógio ───────── */

  passo(dt) {
    const lista = [];
    this.acumulado += dt;
    while (this.acumulado >= MESA.passo) {
      this.acumulado -= MESA.passo;
      this.tique(lista);
    }
    this.alfa = this.acumulado / MESA.passo;
    return lista;
  }

  tique(lista) {
    const dt = MESA.passo;
    this.t += dt;
    for (const v of this.mesa.varetas) { v.ant = v.pos; v.angAnt = v.ang; }
    for (const b of this.mesa.bolas) { b.ax = b.x; b.ay = b.y; }
    const j = this.jogo;
    if (j) {
      const decai = this.cfg.pressaoCai * dt;
      for (const id of [j.a, j.b]) j.pressao[id] = Math.max(0, j.pressao[id] - (j.pressao[id] < 1 ? decai : 0));
    }
    if (this.fase === "jogo") this.jogar(dt, lista);
    else this.descansar(dt);
    if (this.t >= this.fimFase) this.mudarFase(lista);
  }

  /* Fora do jogo as varetas voltam pro meio, devagar. */
  descansar(dt) {
    for (const v of this.mesa.varetas) {
      v.chute = null;
      v.vel = 0;
      v.pos += (0 - v.pos) * (1 - Math.exp(-3 * dt));
      v.visto = v.pos;
      v.ang += (0 - v.ang) * (1 - Math.exp(-8 * dt));
    }
  }

  jogar(dt, lista) {
    const j = this.jogo;
    if (this.t - this.ultimoReal > this.cfg.ociosidade) { this.pausar(lista); return; }

    if (j.relogio > 0) {
      j.relogio = Math.max(0, j.relogio - dt);
      if (j.relogio === 0) {
        if (j.gols[j.a] === j.gols[j.b]) {
          j.ouro = true;
          lista.push({ tipo: "golDeOuro" });
        } else {
          j.vencedor = j.gols[j.a] > j.gols[j.b] ? j.a : j.b;
          this.terminar(lista);
          return;
        }
      }
    }

    this.cronometros(lista);
    this.ativarEfeitos(lista);
    for (const v of this.mesa.varetas) this.moverVareta(v, dt, lista);
    const sub = dt / MESA.subpassos;
    for (let s = 0; s < MESA.subpassos && this.fase === "jogo"; s++) this.moverBolas(sub, lista);
    if (this.fase === "jogo") this.bolaParada(dt, lista);
  }

  /* ───────── presentes e torcida ───────── */

  cronometros(lista) {
    const j = this.jogo, t = this.t;
    for (const id of [j.a, j.b]) {
      if (j.turbo[id] && t >= j.turbo[id]) { j.turbo[id] = 0; lista.push({ tipo: "acabou", efeito: "turbo", time: id }); }
      if (!j.turbo[id] && j.pressao[id] >= 1) {
        j.turbo[id] = t + this.cfg.turbo;
        j.pressao[id] = 0;
        lista.push({ tipo: "turbo", time: id });
      }
      if (j.gelo[id] && t >= j.gelo[id]) { j.gelo[id] = 0; lista.push({ tipo: "acabou", efeito: "gelo", time: id }); }
      if (j.paredao[id] && t >= j.paredao[id]) { j.paredao[id] = 0; lista.push({ tipo: "acabou", efeito: "paredao", time: id }); }
    }
    if (j.chuvaAte && t >= j.chuvaAte) {
      j.chuvaAte = 0;
      const extras = this.mesa.bolas.filter(b => b.extra).map(b => b.id);
      this.mesa.bolas = this.mesa.bolas.filter(b => !b.extra);
      lista.push({ tipo: "acabou", efeito: "chuva", bolas: extras });
    }
  }

  /* A fila de cada time anda: gelo e chuva valem na hora; os de chute
     esperam o chute anterior do time sair. */
  ativarEfeitos(lista) {
    const j = this.jogo;
    for (const id of [j.a, j.b]) {
      const fila = j.efeitos[id];
      const rival = id === j.a ? j.b : j.a;
      while (fila.length) {
        const e = fila[0];
        if (e.efeito === "gelo") {
          fila.shift();
          j.gelo[rival] = Math.max(j.gelo[rival], this.t) + this.cfg.gelo;
          lista.push({ tipo: "gelo", time: id, rival, de: e.de });
        } else if (e.efeito === "chuva") {
          if (j.chuvaAte) break;
          fila.shift();
          j.chuvaAte = this.t + this.cfg.chuva;
          j.paredao[id] = this.t + this.cfg.paredao;
          const novas = [];
          while (this.mesa.bolas.length < 3) novas.push(this.novaBola(true).id);
          lista.push({ tipo: "chuva", time: id, de: e.de, bolas: novas });
        } else {
          if (j.especial[id]) break;
          fila.shift();
          j.especial[id] = e;
          lista.push({ tipo: "preparado", time: id, efeito: e.efeito, de: e.de, forma: e.forma });
        }
      }
    }
  }

  /* ───────── varetas ───────── */

  /* A bola que mais interessa à vareta: a mais perto dela no comprido da mesa. */
  bolaDa(v) {
    let melhor = null, d = Infinity;
    for (const b of this.mesa.bolas) {
      const dd = Math.abs(b.y - v.y);
      if (dd < d) { d = dd; melhor = b; }
    }
    return melhor;
  }

  /* Onde a bola vai cruzar a linha da vareta, rebatendo nas laterais. */
  prever(b, v) {
    let x = b.x;
    const dy = v.y - b.y;
    if (Math.abs(b.vy) > 5 && dy * b.vy > 0) x += b.vx * Math.min(0.5, dy / b.vy);
    const lim = MESA.larg / 2 - MESA.raio;
    for (let i = 0; i < 4 && Math.abs(x) > lim; i++) x = Math.sign(x) * 2 * lim - x;
    return x;
  }

  moverVareta(v, dt, lista) {
    const j = this.jogo;
    const time = j.lado[v.lado];
    const congelada = v.funcao === "goleiro" && j.gelo[time] > this.t;
    const turbo = j.turbo[time] > this.t ? 1 : 0;
    if (v.espera > 0) v.espera -= dt;
    if (congelada) {
      v.vel = 0;
      v.chute = null;
      v.ang += (0 - v.ang) * (1 - Math.exp(-10 * dt));
      return;
    }

    const bola = this.bolaDa(v);
    let alvo = 0;
    if (bola) {
      const xp = this.prever(bola, v);
      let custo = Infinity;
      for (const off of v.homens) {
        const p = Math.max(-v.curso, Math.min(v.curso, xp - off));
        const c = Math.abs(p + off - xp) * 4 + Math.abs(p - v.pos);
        if (c < custo) { custo = c; alvo = p; }
      }
    }
    const f = FUNCOES[v.funcao];
    v.visto += (alvo - v.visto) * (1 - Math.exp(-f.reacao * (1 + turbo * 0.5) * dt));
    const vmax = VELOCIDADE_VARETA * (1 + turbo * 0.7);
    v.vel = Math.max(-vmax, Math.min(vmax, (v.visto - v.pos) * 14));
    v.pos = Math.max(-v.curso, Math.min(v.curso, v.pos + v.vel * dt));

    if (v.chute) this.girar(v, dt, lista);
    else {
      v.ang += (0 - v.ang) * (1 - Math.exp(-12 * dt));
      if (v.espera <= 0) this.decidirChute(v);
    }
  }

  /* Ponto da bola em relação ao boneco `k`: `frente` no sentido do ataque. */
  relativo(v, k, b) {
    return { lado: b.x - (v.pos + v.homens[k]), frente: (b.y - v.y) * v.dir };
  }

  naZona(v, k, b, folga = 0) {
    const r = this.relativo(v, k, b);
    return r.frente >= ZONA_CHUTE.tras - folga && r.frente <= ZONA_CHUTE.frente + folga
      && Math.abs(r.lado) <= this.peX(v) + MESA.raio + 0.6 + folga;
  }

  peX(v) {
    const j = this.jogo;
    return v.funcao === "goleiro" && j && j.paredao[j.lado[v.lado]] > this.t ? PAREDAO_X : PE.x;
  }

  decidirChute(v) {
    for (const b of this.mesa.bolas) {
      for (let k = 0; k < v.homens.length; k++) {
        if (this.naZona(v, k, b)) { v.chute = { t: 0, k, bola: b, bateu: false }; return; }
      }
    }
  }

  /* Recua, gira pra frente (o contato é quando o pé passa embaixo) e volta. */
  girar(v, dt, lista) {
    const c = v.chute;
    c.t += dt;
    if (c.t < 0.06) v.ang = -0.7 * (c.t / 0.06);
    else if (c.t < 0.12) v.ang = -0.7 + 2.6 * ((c.t - 0.06) / 0.06);
    else v.ang = 1.9 * Math.max(0, 1 - (c.t - 0.12) / 0.18);
    if (!c.bateu && c.t >= 0.09) {
      c.bateu = true;
      if (this.mesa.bolas.includes(c.bola) && this.naZona(v, c.k, c.bola, 1)) this.chutar(v, c.k, c.bola, lista);
    }
    if (c.t >= 0.3) {
      v.chute = null;
      v.ang = 0;
      v.espera = 0.12;
    }
  }

  chutar(v, k, b, lista) {
    const j = this.jogo;
    const time = j.lado[v.lado];
    const lugar = lugarDe(v, k);
    const boneco = j.bonecos[time][lugar];
    const especial = j.especial[time];
    const efeito = especial ? especial.efeito : null;
    if (especial) j.especial[time] = null;
    const f = FUNCOES[v.funcao];

    let mira = f.mira;
    if (boneco.craque) mira *= 0.45;
    if (efeito === "brilho") mira *= 0.35;
    if (efeito === "canhao") mira = 0.12;
    if (efeito === "fogo") mira = 0;
    const golY = v.dir * (MESA.comp / 2 + 3);
    const mx = (this.sorte() * 2 - 1) * (MESA.gol / 2) * mira;
    const dx = mx - b.x, dy = golY - b.y, d = Math.hypot(dx, dy);

    const turbo = j.turbo[time] > this.t;
    let forca = f.forca * (0.85 + this.sorte() * 0.3);
    if (turbo) forca *= 1.35;
    if (boneco.bomba) forca *= 1.5;
    if (efeito === "canhao") forca *= 2.1;
    if (efeito === "fogo") forca *= 1.7;
    forca = Math.min(560, forca);

    b.vx = (dx / d) * forca + (efeito === "fogo" || efeito === "canhao" ? 0 : v.vel * 0.35);
    b.vy = (dy / d) * forca;
    b.fogo = efeito === "fogo";
    b.efeito = efeito ? { efeito, time, forma: especial.forma, de: especial.de } : turbo ? { efeito: "turbo", time } : null;
    b.parada = 0;
    const bomba = boneco.bomba;
    boneco.bomba = false;
    this.tocou(b, v, k);
    lista.push({
      tipo: "chute", time, lado: v.lado, vareta: v.i, k, lugar, bola: b.id, forca, efeito, bomba, turbo,
      dono: boneco.dono, craque: boneco.craque, x: b.x, y: b.y,
    });
  }

  tocou(b, v, k) {
    const lugar = lugarDe(v, k);
    b.toque[v.lado] = lugar;
    b.ultimo = { lado: v.lado, lugar };
  }

  /* ───────── bola ───────── */

  moverBolas(dt, lista) {
    const bolas = this.mesa.bolas;
    const ar = Math.exp(-0.42 * dt);
    for (const b of bolas) {
      const vel = Math.hypot(b.vx, b.vy);
      const freio = vel < 4 ? Math.exp(-4 * dt) : ar;
      b.vx *= freio;
      b.vy *= freio;
      this.rampa(b, dt, vel);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      this.bater(b, lista);
    }
    if (bolas.length > 1) this.entreBolas(bolas);
    for (const b of [...bolas]) {
      if (Math.abs(b.y) > MESA.comp / 2 + MESA.raio && Math.abs(b.x) < MESA.gol / 2) {
        this.gol(b, lista);
        if (this.fase !== "jogo") return;
      }
    }
  }

  /* Entre duas varetas, onde ninguém alcança, a mesa tem um caimento leve
     que leva a bola devagar pro boneco mais perto. */
  rampa(b, dt, vel) {
    if (vel > 30) return;
    let perto = null, d = Infinity;
    for (const v of this.mesa.varetas) {
      const dd = Math.abs(b.y - v.y);
      if (dd < d) { d = dd; perto = v; }
    }
    if (d > 3.5) b.vy += Math.sign(perto.y - b.y) * 38 * dt;
  }

  bater(b, lista) {
    const r = MESA.raio;
    const mx = MESA.larg / 2, my = MESA.comp / 2;
    const quique = (forca, tipo) => { if (forca > 30) lista.push({ tipo: "batida", em: tipo, forca, x: b.x, y: b.y }); };

    if (Math.abs(b.x) > mx - r) {
      const s = Math.sign(b.x);
      b.x = s * (mx - r);
      if (b.vx * s > 0) { quique(Math.abs(b.vx), "borda"); b.vx *= -0.72; }
    }
    if (Math.abs(b.y) > my - r && Math.abs(b.x) > MESA.gol / 2) {
      const s = Math.sign(b.y);
      if (Math.abs(b.y) < my + r) {
        b.y = s * (my - r);
        if (b.vy * s > 0) { quique(Math.abs(b.vy), "borda"); b.vy *= -0.72; }
      }
    }
    /* Cantos chanfrados. */
    const lim = mx + my - MESA.chanfro;
    const sx = Math.sign(b.x) || 1, sy = Math.sign(b.y) || 1;
    const fora = (sx * b.x + sy * b.y - lim) / Math.SQRT2 + r;
    if (fora > 0 && Math.abs(b.y) < my) {
      const nx = sx / Math.SQRT2, ny = sy / Math.SQRT2;
      b.x -= nx * fora;
      b.y -= ny * fora;
      const vn = b.vx * nx + b.vy * ny;
      if (vn > 0) {
        quique(vn, "borda");
        b.vx -= 1.72 * vn * nx;
        b.vy -= 1.72 * vn * ny;
      }
    }
    /* Traves: as quinas da boca do gol. */
    for (const px of [-MESA.gol / 2, MESA.gol / 2]) {
      const py = Math.sign(b.y) * my;
      this.empurrar(b, px, py, 0, 0, 0, 0.6, null, lista, "trave");
    }
    if (b.fogo) return;
    const j = this.jogo;
    for (const v of this.mesa.varetas) {
      if (Math.abs(b.y - v.y) > PE.y + r + 0.5 || Math.abs(v.ang) > 0.6) continue;
      if (v.funcao === "goleiro" && j.gelo[j.lado[v.lado]] > this.t) {
        for (let k = 0; k < v.homens.length; k++) this.empurrar(b, v.pos + v.homens[k], v.y, PE.x + 0.4, PE.y + 0.4, 0, 0.5, null, lista, "gelo");
        continue;
      }
      const hx = this.peX(v);
      for (let k = 0; k < v.homens.length; k++) this.empurrar(b, v.pos + v.homens[k], v.y, hx, PE.y, v.vel, 0.55, [v, k], lista, "boneco");
    }
  }

  /* Bola contra um retângulo (o pé do boneco; tamanho zero é a trave). */
  empurrar(b, cx, cy, hx, hy, velX, quica, quem, lista, tipo) {
    const r = MESA.raio;
    const px = Math.max(cx - hx, Math.min(cx + hx, b.x));
    const py = Math.max(cy - hy, Math.min(cy + hy, b.y));
    let dx = b.x - px, dy = b.y - py;
    let d = Math.hypot(dx, dy);
    if (d >= r) return;
    if (d < 1e-6) {
      dx = 0;
      dy = Math.sign(b.y - cy) || (quem ? quem[0].dir : 1);
      d = 0;
    } else { dx /= d; dy /= d; }
    const entra = d === 0 ? r + hy - Math.abs(b.y - cy) : r - d;
    b.x += dx * entra;
    b.y += dy * entra;
    const vn = (b.vx - velX) * dx + b.vy * dy;
    if (vn < 0) {
      b.vx -= (1 + quica) * vn * dx;
      b.vy -= (1 + quica) * vn * dy;
      if (-vn > 30) lista.push({ tipo: "batida", em: tipo, forca: -vn, x: b.x, y: b.y });
    }
    if (quem) this.tocou(b, quem[0], quem[1]);
  }

  entreBolas(bolas) {
    const r2 = MESA.raio * 2;
    for (let i = 0; i < bolas.length; i++) {
      for (let k = i + 1; k < bolas.length; k++) {
        const a = bolas[i], b = bolas[k];
        if (a.fogo || b.fogo) continue;
        let dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d >= r2 || d < 1e-6) continue;
        dx /= d; dy /= d;
        const meio = (r2 - d) / 2;
        a.x -= dx * meio; a.y -= dy * meio;
        b.x += dx * meio; b.y += dy * meio;
        const vn = (b.vx - a.vx) * dx + (b.vy - a.vy) * dy;
        if (vn < 0) {
          const imp = vn * 0.95;
          a.vx += imp * dx; a.vy += imp * dy;
          b.vx -= imp * dx; b.vy -= imp * dy;
        }
      }
    }
  }

  /* Bola parada onde ninguém alcança por tanto tempo: a mesa treme. */
  bolaParada(dt, lista) {
    for (const b of this.mesa.bolas) {
      if (Math.hypot(b.vx, b.vy) > 6) { b.parada = 0; continue; }
      const alcancavel = this.mesa.varetas.some(v => v.homens.some((_, k) => this.naZona(v, k, b)));
      b.parada = alcancavel ? 0 : b.parada + dt;
      if (b.parada > this.cfg.mesaTreme) {
        b.parada = 0;
        const s = () => (this.sorte() < 0.5 ? -1 : 1);
        b.vx = s() * (40 + this.sorte() * 40);
        b.vy = s() * (30 + this.sorte() * 30);
        lista.push({ tipo: "treme", bola: b.id });
      }
    }
  }

  /* Quem tocou por último na bola, do time que marcou, faz o gol. Se o
     último toque foi do outro time, foi desvio. */
  gol(b, lista) {
    const j = this.jogo;
    const lado = b.y > 0 ? "a" : "b";
    const time = j.lado[lado];
    const rival = time === j.a ? j.b : j.a;
    this.mesa.bolas = this.mesa.bolas.filter(x => x !== b);
    j.gols[time]++;
    const lugar = b.toque[lado];
    const boneco = lugar === null ? null : j.bonecos[time][lugar];
    const autor = boneco && boneco.dono ? { ...boneco.dono } : null;
    if (boneco) boneco.gols++;
    if (autor) {
      const a = this.artilheiros.get(autor.id) || { id: autor.id, nome: autor.nome, time, gols: 0 };
      a.nome = autor.nome;
      a.gols++;
      this.artilheiros.set(autor.id, a);
    }
    if (j.ouro || j.gols[time] >= this.cfg.gols) j.vencedor = time;
    const chuva = j.chuvaAte > this.t && !j.vencedor;
    lista.push({
      tipo: "gol", time, rival, lado, autor, lugar, numero: boneco ? boneco.numero : null,
      desvio: !!(b.ultimo && b.ultimo.lado !== lado), efeito: b.efeito ? b.efeito.efeito : null,
      bola: b.id, x: b.x, gols: { ...j.gols }, ouro: j.ouro, decidiu: !!j.vencedor, chuva,
    });
    if (chuva) {
      if (!b.extra) {
        const nova = this.novaBola(false);
        lista.push({ tipo: "saque", bola: nova.id });
      }
      return;
    }
    this.mesa.bolas = [];
    j.chuvaAte = 0;
    this.fase = "gol";
    this.fimFase = this.t + this.cfg.tempos.gol;
  }

  /* Tecla de teste: termina a partida já, pra quem estiver na frente. */
  encerrar() {
    const j = this.jogo;
    if (!j || j.vencedor) return;
    if (j.gols[j.a] === j.gols[j.b]) j.gols[j.a]++;
    j.vencedor = j.gols[j.a] > j.gols[j.b] ? j.a : j.b;
    this.mesa.bolas = [];
    this.fase = "gol";
    this.fimFase = this.t;
  }

  rankingArtilheiros(n = 8) {
    return [...this.artilheiros.values()].sort((a, b) => b.gols - a.gols).slice(0, n);
  }

  rankingTimes() {
    return [...this.vitorias].sort((a, b) => b[1] - a[1]).map(([time, v]) => ({ time, vitorias: v }));
  }

  resta() { return Math.max(0, this.fimFase - this.t); }
}

/* Dois clubes de camisa parecida (Flamengo x Inter, Corinthians x Santos)
   viram uma mancha só em campo: um deles entra de reserva. A cor que conta é
   a média do que aparece na camisa, pesada pelo padrão. */
const PESO_COR2 = { liso: 0, listras: 0.5, horiz: 0.5, faixa: 0.2, diagonal: 0.2, mangas: 0.2 };
const PARECIDAS = 110;

function corDaCamisa(k) {
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const p = PESO_COR2[k.padrao] ?? 0.3;
  const a = rgb(k.cor), b = rgb(k.cor2);
  return a.map((v, i) => v * (1 - p) + b[i] * p);
}

function camisasParecidas(k1, k2) {
  const a = corDaCamisa(k1), b = corDaCamisa(k2);
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < PARECIDAS;
}

/* Camisa de cada lado no clássico. O segundo time troca primeiro; se a
   reserva dele também bater, troca o primeiro. */
function uniformes(a, b) {
  const kit = t => ({ cor: t.cor, cor2: t.cor2, calcao: t.calcao, padrao: t.padrao });
  const reserva = t => (t.reserva ? { ...kit(t), ...t.reserva } : kit(t));
  if (!camisasParecidas(a, b)) return [kit(a), kit(b)];
  if (!camisasParecidas(a, reserva(b))) return [kit(a), reserva(b)];
  if (!camisasParecidas(reserva(a), b)) return [reserva(a), kit(b)];
  return [kit(a), reserva(b)];
}

if (typeof module !== "undefined") {
  module.exports = { Pebolim, MESA, VARETAS, FUNCOES, ORDEM_ENTRADA, FAIXAS_EFEITO, normalizar, reconhecerTime, pediuBomba, lugarDe, uniformes, camisasParecidas };
}
