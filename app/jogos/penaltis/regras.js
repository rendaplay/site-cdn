/* Regras do Pênaltis da Live: quem joga o clássico, a fila de batedores de
   cada time, o canto pedido no chat, a pressão da torcida, os efeitos de
   presente, o resultado de cada cobrança, quem venceu e o ranking da live.
   Sem DOM: o tempo anda pelo `passo(dt)`, o sorteio é injetável e tudo que
   acontece volta numa lista de acontecimentos pra cena, o HUD e o som. */
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

const PALAVRAS_COLUNA = {
  esquerda: -1, esq: -1, esquerdo: -1,
  direita: 1, dir: 1, direito: 1,
  meio: 0, centro: 0, cavadinha: 0, panenka: 0,
};
const PALAVRAS_LINHA = {
  alto: 1, angulo: 1, gaveta: 1, cima: 1, encima: 1,
  baixo: 0, rasteiro: 0, rasteira: 0, cantinho: 0, chao: 0,
};

/* Canto pedido no comentário: coluna (-1 esquerda, 0 meio, 1 direita, do
   ponto de vista de quem bate) e linha (0 baixo, 1 alto). O que não foi
   dito fica null e o jogo sorteia. */
function lerCanto(texto) {
  let col = null, lin = null, cavadinha = false;
  for (const p of normalizar(texto).split(" ")) {
    if (p in PALAVRAS_COLUNA && col === null) col = PALAVRAS_COLUNA[p];
    if (p in PALAVRAS_LINHA && lin === null) lin = PALAVRAS_LINHA[p];
    if (p === "cavadinha" || p === "panenka") cavadinha = true;
  }
  if (cavadinha) lin = 1;
  if (col === null && lin === null) return null;
  return { col, lin, cavadinha };
}

/* Número da camisa estável por pessoa, de 2 a 99. */
function numeroDe(id) {
  let h = 7;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return 2 + (h % 98);
}

/* Acabou a disputa? `n` cobranças pra cada lado; depois, morte súbita a cada par. */
function decidida(golsA, golsB, chutesA, chutesB, n) {
  if (chutesA <= n && chutesB <= n) {
    if (golsA + (n - chutesA) < golsB) return true;
    if (golsB + (n - chutesB) < golsA) return true;
    return chutesA === n && chutesB === n && golsA !== golsB;
  }
  return chutesA === chutesB && golsA !== golsB;
}

const EFEITOS = ["brilho", "curva", "frango", "fogo", "placa"];
const GARANTIDO = new Set(["fogo", "placa"]);

class Disputa {
  constructor(cfg, aleatorio = Math.random) {
    this.cfg = cfg;
    this.sorte = aleatorio;
    this.zerar();
  }

  zerar() {
    this.t = 0;
    this.rodada = 0;
    this.fase = "aquecimento";
    this.fimFase = this.cfg.tempos.aquecimento;
    this.pessoas = new Map();
    this.citacoes = new Map();
    this.ultimoReal = 0;
    this.artilheiros = new Map();
    this.vitorias = new Map();
    this.jogo = null;
    this.porId = new Map(this.cfg.times.map(t => [t.id, t]));
  }

  time(id) { return this.porId.get(id) || null; }

  pessoa(quem) {
    const id = String(quem.id || quem.nome);
    let p = this.pessoas.get(id);
    if (!p) {
      p = { id, nome: quem.nome || id, time: null, craque: false, numero: numeroDe(id) };
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

  /* ───────── live ───────── */

  comentario(quem, texto) {
    const time = reconhecerTime(this.cfg.times, texto);
    const p = this.pessoa(quem);
    const canto = lerCanto(texto);
    const lista = [];
    if (time) {
      this.ultimoReal = this.t;
      if (p.time !== time.id) this.sairDaFila(p);
      p.time = time.id;
      const atual = this.citacoes.get(p.id);
      this.citacoes.set(p.id, { time: time.id, t: this.t, peso: Math.max(1, atual && atual.time === time.id ? atual.peso : 1) });
    } else if (!canto || !p.time) return lista;
    else this.ultimoReal = this.t;

    const j = this.jogo;
    const emCampo = j && p.time && (p.time === j.a || p.time === j.b);
    const ev = { tipo: "comentou", id: p.id, nome: p.nome, time: p.time, canto: null, fila: null, desafiante: false };
    if (emCampo) {
      const fila = j.filas[p.time];
      let item = fila.find(x => x.id === p.id);
      if (!item && !(j.batedor && j.batedor.id === p.id)) {
        item = { id: p.id, nome: p.nome, numero: p.numero, canto: null };
        fila.push(item);
        ev.entrou = true;
      }
      if (item && canto) item.canto = canto;
      /* Quem está na marca ainda pode mudar o canto até o chute. */
      if (canto && j.batedor && j.batedor.id === p.id && this.fase === "preparando") j.batedor.canto = canto;
      ev.canto = canto;
      ev.fila = item ? fila.indexOf(item) + 1 : 0;
    } else if (j) ev.desafiante = true;
    lista.push(ev);
    if (this.fase === "pausa" && emCampo) this.retomar(lista);
    return lista;
  }

  sairDaFila(p) {
    if (!this.jogo) return;
    for (const id of [this.jogo.a, this.jogo.b]) {
      const fila = this.jogo.filas[id];
      const i = fila.findIndex(x => x.id === p.id);
      if (i >= 0) fila.splice(i, 1);
    }
  }

  curtida(quem, n = 1) {
    const p = this.pessoas.get(String(quem.id || quem.nome));
    const j = this.jogo;
    if (!p || !p.time || !j || (p.time !== j.a && p.time !== j.b)) return [];
    const antes = j.pressao[p.time];
    j.pressao[p.time] = Math.min(1, antes + n / this.cfg.curtidasPorPressao);
    const lista = [{ tipo: "curtiu", id: p.id, nome: p.nome, time: p.time, pressao: j.pressao[p.time] }];
    if (antes < 1 && j.pressao[p.time] >= 1) lista.push({ tipo: "pressaoCheia", time: p.time, nome: p.nome });
    return lista;
  }

  seguiu(quem) {
    const p = this.pessoa(quem);
    p.craque = true;
    return [{ tipo: "seguiu", id: p.id, nome: p.nome, time: p.time }];
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

  /* `moedas` é o envio inteiro (com o combo). `faixa` vem do ⚙ (o streamer
     escolheu o efeito desse presente); sem ela vale pelo valor. */
  presente(quem, { nome, moedas, quantidade = 1, faixa = null }) {
    if (faixa === null) faixa = this.faixaDe(moedas);
    if (faixa < 0) return [];
    faixa = Math.min(EFEITOS.length - 1, faixa);
    const p = this.pessoa(quem);
    const j = this.jogo;
    const base = { tipo: "presente", id: p.id, nome: p.nome, presente: nome, quantidade, moedas, faixa, efeito: EFEITOS[faixa] };

    /* Torcedor de time fora do clássico: o presente vira força pro time dele
       entrar no próximo. */
    if (j && p.time && p.time !== j.a && p.time !== j.b) {
      const c = this.citacoes.get(p.id);
      this.citacoes.set(p.id, { time: p.time, t: this.t, peso: (c && c.time === p.time ? c.peso : 1) + 1 + faixa * 2 });
      return [{ ...base, time: p.time, desafiante: true }];
    }
    if (!j) {
      if (p.time) {
        const c = this.citacoes.get(p.id);
        this.citacoes.set(p.id, { time: p.time, t: this.t, peso: (c && c.time === p.time ? c.peso : 1) + 1 + faixa * 2 });
      }
      return [{ ...base, time: p.time, aquecimento: true }];
    }
    const time = p.time || this.perdendo();
    j.efeitos[time].push({ efeito: EFEITOS[faixa], de: p.nome });
    if (EFEITOS[faixa] === "placa") j.paredao[time]++;
    const ev = { ...base, time, semTime: !p.time };
    this.ultimoReal = this.t;
    if (EFEITOS[faixa] === "curva" && p.time) {
      const fila = j.filas[time];
      const i = fila.findIndex(x => x.id === p.id);
      const item = i >= 0 ? fila.splice(i, 1)[0] : { id: p.id, nome: p.nome, numero: p.numero, canto: null };
      if (!(j.batedor && j.batedor.id === p.id)) {
        fila.unshift(item);
        ev.furouFila = true;
      }
    }
    const lista = [ev];
    if (this.fase === "pausa") this.retomar(lista);
    return lista;
  }

  /* ───────── a disputa ───────── */

  comecar(a, b, lista) {
    this.rodada++;
    const vazio = () => ({ [a]: [], [b]: [] });
    this.jogo = {
      a, b, vez: a, gols: { [a]: 0, [b]: 0 }, chutes: { [a]: 0, [b]: 0 },
      historico: { [a]: [], [b]: [] }, filas: vazio(), efeitos: vazio(),
      paredao: { [a]: 0, [b]: 0 }, pressao: { [a]: 0, [b]: 0 }, bots: { [a]: 0, [b]: 0 },
      batedor: null, cobranca: null,
    };
    /* Quem citou um dos dois na janela já entra na fila, na ordem em que comentou. */
    const citou = [...this.citacoes].filter(([, c]) => c.time === a || c.time === b).sort((x, y) => x[1].t - y[1].t);
    for (const [id, c] of citou) {
      const p = this.pessoas.get(id);
      if (p && p.time === c.time) this.jogo.filas[c.time].push({ id: p.id, nome: p.nome, numero: p.numero, canto: null });
    }
    for (const id of [a, b]) for (const [pid, c] of this.citacoes) if (c.time === id) this.citacoes.delete(pid);
    lista.push({ tipo: "classico", a, b, rodada: this.rodada });
    this.fase = "abertura";
    this.fimFase = this.t + this.cfg.tempos.abertura;
  }

  proximoBatedor(lista) {
    const j = this.jogo;
    const fila = j.filas[j.vez];
    const ocioso = !j.filas[j.a].length && !j.filas[j.b].length && this.t - this.ultimoReal > this.cfg.ociosidade;
    if (ocioso) {
      this.fase = "pausa";
      this.fimFase = Infinity;
      lista.push({ tipo: "ocioso", a: j.a, b: j.b });
      return;
    }
    let batedor;
    if (fila.length) {
      const item = fila.shift();
      const p = this.pessoas.get(item.id);
      batedor = { ...item, nome: p ? p.nome : item.nome, bot: false, craque: !!(p && p.craque) };
      if (p) p.craque = false;
    } else {
      const numeros = this.time(j.vez).numeros || [10, 9, 7, 11, 8];
      const n = numeros[j.bots[j.vez]++ % numeros.length];
      batedor = { id: null, nome: `Camisa ${n}`, numero: n, canto: null, bot: true, craque: false };
    }
    const efeito = j.efeitos[j.vez].shift() || null;
    j.batedor = batedor;
    j.cobranca = null;
    const rival = j.vez === j.a ? j.b : j.a;
    this.fase = "preparando";
    this.fimFase = this.t + this.cfg.tempos.prepara;
    lista.push({
      tipo: "batedor", time: j.vez, rival, batedor, efeito,
      numeroCobranca: j.chutes[j.vez] + 1, morteSubita: j.chutes[j.vez] >= this.cfg.cobrancas,
      fila: { [j.a]: j.filas[j.a].length, [j.b]: j.filas[j.b].length },
    });
    j.efeitoAtual = efeito;
  }

  retomar(lista) {
    lista.push({ tipo: "retomou" });
    this.proximoBatedor(lista);
  }

  sortearColuna(pesoMeio) {
    const r = this.sorte();
    const lado = (1 - pesoMeio) / 2;
    return r < lado ? -1 : r < lado + pesoMeio ? 0 : 1;
  }

  /* O chute: canto (pedido ou sorteado), pulo do goleiro e resultado. */
  chutar(lista) {
    const j = this.jogo;
    const cfg = this.cfg.chute;
    const b = j.batedor;
    const efeito = j.efeitoAtual ? j.efeitoAtual.efeito : null;
    const rival = j.vez === j.a ? j.b : j.a;
    const pedido = b.canto || {};
    const alvo = {
      col: pedido.col ?? this.sortearColuna(cfg.meioBatedor),
      lin: pedido.lin ?? (this.sorte() < cfg.alto ? 1 : 0),
    };
    const cavadinha = !!pedido.cavadinha;
    const nervoso = j.pressao[j.vez] >= 1;
    if (nervoso) j.pressao[j.vez] = 0;
    const paredao = j.paredao[rival] > 0 && !GARANTIDO.has(efeito);
    if (paredao) j.paredao[rival]--;
    const frango = efeito === "frango";

    let resultado, mergulho;
    if (GARANTIDO.has(efeito)) {
      resultado = "gol";
      mergulho = { col: alvo.col === 0 ? (this.sorte() < 0.5 ? -1 : 1) : -alvo.col, lin: 0 };
    } else if (paredao) {
      resultado = "defesa";
      mergulho = { ...alvo };
    } else {
      let erro = alvo.lin ? cfg.erroAlto : cfg.erro;
      if (b.craque) erro = 0;
      if (efeito === "brilho") erro *= 0.5;
      mergulho = cavadinha
        ? { col: this.sorte() < 0.5 ? -1 : 1, lin: 0 }
        : { col: this.sortearColuna(cfg.meioGoleiro), lin: this.sorte() < 0.5 ? 1 : 0 };
      if (this.sorte() < erro) {
        resultado = this.sorte() < cfg.trave ? "trave" : "fora";
      } else if (mergulho.col === alvo.col && !frango) {
        let defende = alvo.col === 0 ? cfg.defesaMeio : alvo.lin ? cfg.defesaAlto : cfg.defesaBaixo;
        if (nervoso) defende *= 0.5;
        if (b.craque) defende *= 0.75;
        if (efeito === "curva") defende *= 0.7;
        resultado = this.sorte() < defende ? "defesa" : "gol";
      } else resultado = "gol";
    }

    j.chutes[j.vez]++;
    j.historico[j.vez].push(resultado === "gol");
    if (resultado === "gol") {
      j.gols[j.vez]++;
      if (b.id) {
        const a = this.artilheiros.get(b.id) || { id: b.id, nome: b.nome, time: j.vez, gols: 0 };
        a.nome = b.nome;
        a.gols++;
        this.artilheiros.set(b.id, a);
      }
    }
    j.cobranca = { resultado, alvo, mergulho, efeito, nervoso, paredao, frango, cavadinha };
    lista.push({
      tipo: "chute", time: j.vez, rival, batedor: b, resultado, alvo, mergulho, efeito,
      nervoso, paredao, frango, cavadinha, gols: { ...j.gols }, historico: { [j.a]: [...j.historico[j.a]], [j.b]: [...j.historico[j.b]] },
    });
    this.fase = "chute";
    this.fimFase = this.t + this.cfg.tempos.chute;
  }

  depoisDoChute(lista) {
    const j = this.jogo;
    const extra = j.cobranca.efeito === "placa" ? this.cfg.tempos.replay : 0;
    this.fase = "reacao";
    this.fimFase = this.t + this.cfg.tempos.reacao + extra;
    if (decidida(j.gols[j.a], j.gols[j.b], j.chutes[j.a], j.chutes[j.b], this.cfg.cobrancas)) {
      const vencedor = j.gols[j.a] > j.gols[j.b] ? j.a : j.b;
      j.vencedor = vencedor;
    }
  }

  depoisDaReacao(lista) {
    const j = this.jogo;
    if (j.vencedor) {
      const perdedor = j.vencedor === j.a ? j.b : j.a;
      this.vitorias.set(j.vencedor, (this.vitorias.get(j.vencedor) || 0) + 1);
      this.fase = "fim";
      this.fimFase = this.t + this.cfg.tempos.fim;
      lista.push({ tipo: "fim", vencedor: j.vencedor, perdedor, gols: { ...j.gols }, rodada: this.rodada });
      return;
    }
    j.vez = j.vez === j.a ? j.b : j.a;
    this.proximoBatedor(lista);
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

  /* ───────── relógio ───────── */

  passo(dt) {
    this.t += dt;
    const lista = [];
    if (this.jogo) {
      const decai = this.cfg.pressaoCai * dt;
      for (const id of [this.jogo.a, this.jogo.b]) {
        if (this.jogo.pressao[id] < 1) this.jogo.pressao[id] = Math.max(0, this.jogo.pressao[id] - decai);
      }
    }
    if (this.t < this.fimFase) return lista;
    switch (this.fase) {
      case "aquecimento": this.fimDoAquecimento(lista); break;
      case "abertura": this.proximoBatedor(lista); break;
      case "preparando": this.chutar(lista); break;
      case "chute": this.depoisDoChute(lista); break;
      case "reacao": this.depoisDaReacao(lista); break;
      case "fim":
        this.fase = "intervalo";
        this.fimFase = this.t + this.cfg.tempos.intervalo;
        lista.push({ tipo: "intervalo" });
        break;
      case "intervalo": this.proximoClassico(lista); break;
    }
    return lista;
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

  /* Tecla de teste: termina a disputa já, pra quem estiver na frente. */
  encerrar() {
    const j = this.jogo;
    if (!j || j.vencedor) return;
    if (j.gols[j.a] === j.gols[j.b]) j.gols[j.a]++;
    j.vencedor = j.gols[j.a] > j.gols[j.b] ? j.a : j.b;
    if (this.fase !== "chute" && this.fase !== "reacao") { this.fase = "reacao"; this.fimFase = this.t; }
  }

  rankingArtilheiros(n = 8) {
    return [...this.artilheiros.values()].sort((a, b) => b.gols - a.gols).slice(0, n);
  }

  rankingTimes() {
    return [...this.vitorias].sort((a, b) => b[1] - a[1]).map(([time, v]) => ({ time, vitorias: v }));
  }

  resta() { return Math.max(0, this.fimFase - this.t); }
}

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

if (typeof module !== "undefined") module.exports = { Disputa, normalizar, reconhecerTime, lerCanto, numeroDe, decidida, EFEITOS, uniformes, camisasParecidas };
