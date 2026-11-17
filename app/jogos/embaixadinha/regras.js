/* Regras da Embaixadinha Coletiva: quem joga o clássico, o fôlego e a
   sequência de cada craque, o ritmo dos toques, a fila de truques, os
   efeitos de presente, o recorde da live e a rodada. Sem DOM: o tempo anda
   pelo `passo(dt)` em passos fixos de 60 Hz, o sorteio é injetável e tudo
   que acontece volta numa lista de acontecimentos pra cena, o HUD e o som.
   A cena só lê `jogo.lados[id].salto` pra desenhar a bola. */
"use strict";

const PASSO = 1 / 60;

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

const TRUQUES = ["lambreta", "chapeu", "bicicleta", "calcanhar", "ombro"];
const NOME_TRUQUE = { lambreta: "Lambreta", chapeu: "Chapéu", bicicleta: "Bicicleta", calcanhar: "Calcanhar", ombro: "Ombro" };
const PALAVRAS_TRUQUE = new Map([
  ["lambreta", "lambreta"], ["lambretinha", "lambreta"],
  ["chapeu", "chapeu"], ["chapeuzinho", "chapeu"], ["chapelzinho", "chapeu"],
  ["bicicleta", "bicicleta"], ["bike", "bicicleta"],
  ["calcanhar", "calcanhar"], ["calcanhada", "calcanhar"],
  ["ombro", "ombro"], ["ombrinho", "ombro"],
]);

function reconhecerTruque(texto) {
  for (const p of normalizar(texto).split(" ")) if (PALAVRAS_TRUQUE.has(p)) return PALAVRAS_TRUQUE.get(p);
  return null;
}

const FAIXAS_EFEITO = ["brilho", "lento", "vento", "fogo", "show"];
const FORMAS_BRILHO = ["estrela", "coracao", "raio"];
const SHOW = ["lambreta", "chapeu", "calcanhar", "ombro", "bicicleta", "chapeu", "lambreta", "ombro", "calcanhar", "bicicleta"];

/* Altura (m) de cada parte do corpo que toca a bola. */
const CONTATO = { peE: 0.22, peD: 0.22, coxaE: 0.72, coxaD: 0.72, cabeca: 1.86 };
const GRAVIDADE = 9.8;
const MARCOS = [50, 100, 200, 300, 500, 750, 1000];

function marcoDe(n) {
  let m = 0;
  for (const x of MARCOS) if (n >= x) m = x;
  if (n >= 1500) m = Math.floor(n / 500) * 500;
  return m;
}

/* Um salto da bola de uma parte do corpo a outra. `fu` é a fração do tempo
   subindo, pra cena traçar a parábola sem refazer a física. `j0`/`j1`: de
   qual jogador sai e em qual chega (o 1 é o reforço). */
function novoSalto(de, para, altura, gravidade = GRAVIDADE, extra = {}) {
  const y0 = CONTATO[de], y1 = CONTATO[para];
  const ap = Math.max(y0, y1) + altura;
  const sobe = Math.sqrt(2 * (ap - y0) / gravidade);
  const desce = Math.sqrt(2 * (ap - y1) / gravidade);
  return { de, para, ap, fu: sobe / (sobe + desce), T: sobe + desce, f: 0, j0: 0, j1: 0, truque: null, rapido: false, ...extra };
}

/* Altura da bola no salto, em metros, pela fração `f` (0 a 1). */
function alturaNoSalto(s, f) {
  const y0 = CONTATO[s.de], y1 = CONTATO[s.para];
  if (f < s.fu) { const u = f / s.fu; return y0 + (s.ap - y0) * (1 - (1 - u) * (1 - u)); }
  const u = (f - s.fu) / (1 - s.fu);
  return s.ap - (s.ap - y1) * u * u;
}

function novoLado(id, cfg) {
  return {
    id, seq: 0, melhor: 0, toques: 0, folego: cfg.folego.inicio, caida: 0, ultimo: null,
    marco: 0, bateu: false, fila: [], ativo: null, truques: [], pendentes: 0, origemPendente: null, donoPendente: null,
    lentoAte: 0, ventoAte: 0, blindadaAte: 0, reforcoAte: 0, brilhoAte: 0, fogoAte: 0, forma: null,
    salto: novoSalto("peD", "peE", 0.4), saltos: 0, truque: null,
  };
}

class Embaixadinha {
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
    this.vitorias = new Map();
    this.recorde = { n: 0, time: null, nome: null };
    this.jogo = null;
    this.esperando = false;
    this.porId = new Map(this.cfg.times.map(t => [t.id, t]));
  }

  time(id) { return this.porId.get(id) || null; }

  pessoa(quem) {
    const id = String(quem.id || quem.nome);
    let p = this.pessoas.get(id);
    if (!p) {
      p = { id, nome: quem.nome || id, time: null, truqueEm: -Infinity, toques: 0 };
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

  rival(id) { const j = this.jogo; return id === j.a ? j.b : j.a; }

  /* Quem está atrás na rodada: menor melhor sequência, depois menor sequência atual. */
  perdendo() {
    const j = this.jogo;
    const a = j.lados[j.a], b = j.lados[j.b];
    if (a.melhor !== b.melhor) return a.melhor < b.melhor ? j.a : j.b;
    return a.seq < b.seq ? j.a : j.b;
  }

  /* ───────── live ───────── */

  comentario(quem, texto) {
    const time = reconhecerTime(this.cfg.times, texto);
    const truque = reconhecerTruque(texto);
    const p = this.pessoa(quem);
    const lista = [];
    if (time) {
      p.time = time.id;
      const atual = this.citacoes.get(p.id);
      this.citacoes.set(p.id, { time: time.id, t: this.t, peso: Math.max(1, atual && atual.time === time.id ? atual.peso : 1) });
    } else if (!truque || !p.time) return lista;
    this.ultimoReal = this.t;

    const j = this.jogo;
    const emCampo = this.emCampo(p);
    const ev = { tipo: "comentou", id: p.id, nome: p.nome, time: p.time, desafiante: false, truque: null };
    lista.push(ev);
    if (!emCampo) {
      if (j) ev.desafiante = true;
      return lista;
    }
    if (this.fase === "pausa") this.retomar(lista);
    if (this.fase !== "jogo") return lista;

    const lado = j.lados[p.time];
    if (lado.caida) return lista;
    lado.folego = Math.min(1, lado.folego + this.cfg.folego.toque);
    if (truque && this.t >= p.truqueEm) {
      p.truqueEm = this.t + this.cfg.intervaloTruque;
      if (lado.truques.length < 4) lado.truques.push({ nome: truque, id: p.id, de: p.nome, show: false });
      ev.truque = truque;
    } else this.tocar(lado, p, 1, "comentario", lista);
    return lista;
  }

  /* Curtida de quem não tem time (a maioria) vai pra bola com menos fôlego. */
  curtida(quem, n = 1) {
    const j = this.jogo;
    if (!j || (this.fase !== "jogo" && this.fase !== "pausa")) return [];
    const p = this.pessoa(quem);
    const id = this.emCampo(p) ? p.time : (j.lados[j.a].folego <= j.lados[j.b].folego ? j.a : j.b);
    const lado = j.lados[id];
    if (lado.caida || this.fase !== "jogo") return [];
    const f = this.cfg.folego;
    lado.folego = Math.min(1, lado.folego + Math.min(f.curtidaMaxima, n * f.curtida));
    return [{ tipo: "curtiu", id: p.id, nome: p.nome, time: id, folego: lado.folego }];
  }

  /* Reforço: um segundo craque do clube entra por um tempo e cada toque vale mais. */
  seguiu(quem) {
    const p = this.pessoa(quem);
    const j = this.jogo;
    if (!j || j.vencedor) return [{ tipo: "seguiu", id: p.id, nome: p.nome, time: p.time }];
    const id = this.emCampo(p) ? p.time : this.perdendo();
    const lado = j.lados[id];
    lado.reforcoAte = Math.max(lado.reforcoAte, this.t) + this.cfg.reforco;
    return [{ tipo: "reforco", id: p.id, nome: p.nome, time: id, ate: lado.reforcoAte }];
  }

  compartilhou(quem) {
    const p = this.pessoa(quem);
    const time = this.emCampo(p) || !this.jogo ? p.time : this.perdendo();
    return [{ tipo: "compartilhou", id: p.id, nome: p.nome, time }];
  }

  faixaDe(moedas) {
    let i = -1;
    this.cfg.faixas.forEach((f, k) => { if (moedas >= f.moedas) i = k; });
    return i;
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
    const fila = j.lados[time].fila;
    const forma = FORMAS_BRILHO[Math.floor(this.sorte() * FORMAS_BRILHO.length)];
    if (fila.length < this.cfg.filaMaxima) fila.push({ efeito, de: p.nome, id: p.id, forma });
    this.ultimoReal = this.t;
    const lista = [{ ...base, time, semTime: !p.time, forma }];
    if (this.fase === "pausa") this.retomar(lista);
    return lista;
  }

  /* ───────── a sequência ───────── */

  /* Toque que conta: soma na sequência (em dobro com reforço), marca o @ e
     confere marco e recorde. */
  tocar(lado, p, valor, origem, lista, truque = null) {
    const reforco = this.t < lado.reforcoAte;
    const vale = valor * (reforco ? this.cfg.reforcoValor : 1);
    lado.seq += vale;
    lado.toques++;
    if (lado.seq > lado.melhor) lado.melhor = lado.seq;
    if (p) {
      lado.ultimo = { id: p.id, nome: p.nome };
      p.toques++;
    }
    const nome = p ? p.nome : null;
    lista.push({ tipo: origem === "truque" ? "truque" : "toque", time: lado.id, valor: vale, seq: lado.seq, id: p ? p.id : null, nome, origem, truque, reforco });

    const marco = marcoDe(lado.seq);
    if (marco > lado.marco) {
      lado.marco = marco;
      lista.push({ tipo: "marco", time: lado.id, n: marco, seq: lado.seq });
    }
    if (lado.seq > this.recorde.n && lado.seq >= this.cfg.recordeMinimo) {
      const ultimo = lado.ultimo ? lado.ultimo.nome : null;
      this.recorde = { n: lado.seq, time: lado.id, nome: ultimo };
      if (!lado.bateu) {
        lado.bateu = true;
        lista.push({ tipo: "recorde", time: lado.id, n: lado.seq, nome: ultimo, rodada: this.rodada });
      }
    }
  }

  /* Na hora do contato: decide se a bola cai, se sai truque, toque de efeito
     ou um salto comum pelo fôlego. */
  contato(lado, lista) {
    const t = this.t;
    const s = lado.salto;
    const blindada = t < lado.blindadaAte;
    lado.saltos++;
    lado.truque = null;
    if (lado.folego <= 0 && !blindada && !lado.pendentes && !lado.truques.length) {
      lado.caida = t;
      lista.push({ tipo: "caiu", time: lado.id, seq: lado.seq, nome: lado.ultimo ? lado.ultimo.nome : null, de: s.para });
      return;
    }
    /* Com reforço a bola às vezes passa pro outro craque. */
    const reforco = t < lado.reforcoAte;
    const pos = { j0: s.j1, j1: reforco && this.sorte() < 0.5 ? 1 - s.j1 : reforco ? s.j1 : 0 };

    if (lado.truques.length) {
      const tr = lado.truques.shift();
      lado.truque = tr;
      lado.salto = novoSalto(s.para, "peD", tr.nome === "bicicleta" ? 2.4 : 1.4, GRAVIDADE, { j0: s.j1, j1: s.j1, truque: tr.nome });
      lado.salto.T = tr.show ? 0.8 : 1.4;
      const p = this.pessoas.get(tr.id) || null;
      this.tocar(lado, p, 5, "truque", lista, tr.nome);
      return;
    }
    if (lado.pendentes > 0) {
      lado.pendentes--;
      lado.folego = Math.min(1, lado.folego + 0.03);
      const lado2 = s.para === "peD" ? "peE" : "peD";
      lado.salto = novoSalto(s.para, lado2, 0.1, GRAVIDADE * 2.2, { j0: s.j1, j1: s.j1, rapido: true });
      // O toque do presente é de quem mandou: o recorde que sair dele leva o @.
      if (lado.donoPendente) lado.ultimo = lado.donoPendente;
      this.tocar(lado, null, 1, lado.origemPendente || "efeito", lista);
      if (!lado.pendentes) lado.fogoAte = Math.min(lado.fogoAte, t + 1.2);
      return;
    }

    /* Fôlego cheio: toques baixos e variados; vazio: bola alta, só no pé. */
    const f = lado.folego;
    const aperto = Math.pow(1 - f, 1.3);
    const altura = (0.35 + 2.6 * aperto) * (0.85 + this.sorte() * 0.3);
    const pesos = f > 0.55 ? { peE: 3, peD: 3, coxaE: 1.5, coxaD: 1.5, cabeca: 1.3 }
      : f > 0.25 ? { peE: 4, peD: 4, coxaE: 1, coxaD: 1, cabeca: 0.5 }
      : { peE: 5, peD: 5, coxaE: 0.6, coxaD: 0.6, cabeca: 0 };
    const total = Object.values(pesos).reduce((a, b) => a + b, 0);
    let r = this.sorte() * total, para = "peD";
    for (const [k, w] of Object.entries(pesos)) { r -= w; if (r <= 0) { para = k; break; } }
    lado.salto = novoSalto(s.para, para, pos.j0 !== pos.j1 ? Math.max(1.3, altura) : altura, GRAVIDADE, pos);
  }

  /* Câmera lenta estica o salto; vento não muda o tempo, só a cena. */
  animar(lado, dt, lista) {
    const t = this.t;
    if (lado.ativo && t >= lado.ativo.ate) {
      lista.push({ tipo: "acabou", time: lado.id, efeito: lado.ativo.efeito });
      lado.ativo = null;
    }
    if (lado.reforcoAte && t >= lado.reforcoAte) {
      lado.reforcoAte = 0;
      lista.push({ tipo: "fimReforco", time: lado.id });
    }
    if (lado.caida) {
      if (t - lado.caida >= this.cfg.recomeco) this.recomecar(lado, lista);
      return;
    }
    if (!lado.ativo && lado.fila.length) this.iniciarEfeito(lado, lado.fila.shift(), lista);

    const fo = this.cfg.folego;
    const blindada = t < lado.blindadaAte;
    if (t >= lado.lentoAte) {
      const queda = Math.min(fo.quedaMaxima, fo.queda + lado.seq * fo.quedaPorToque) * (t < lado.ventoAte ? 2 : 1);
      lado.folego = Math.max(blindada ? 0.15 : 0, lado.folego - queda * dt);
    }

    const s = lado.salto;
    const lento = t < lado.lentoAte ? 2.6 : 1;
    s.f += dt / (s.T * lento);
    if (s.f >= 1) this.contato(lado, lista);
  }

  iniciarEfeito(lado, e, lista) {
    const t = this.t, cfg = this.cfg;
    const ev = { tipo: "efeito", time: lado.id, efeito: e.efeito, de: e.de, forma: e.forma, rival: this.rival(lado.id) };
    switch (e.efeito) {
      case "brilho":
        lado.pendentes += 3;
        lado.origemPendente = "brilho";
        lado.donoPendente = e.de ? { id: e.id, nome: e.de } : null;
        lado.brilhoAte = t + 6;
        lado.forma = e.forma;
        lado.ativo = { efeito: "brilho", ate: t + 1.4 };
        break;
      case "lento":
        lado.lentoAte = Math.max(lado.lentoAte, t) + cfg.lento;
        lado.ativo = { efeito: "lento", ate: t + cfg.lento };
        break;
      case "vento": {
        const outro = this.jogo.lados[ev.rival];
        outro.ventoAte = Math.max(outro.ventoAte, t) + cfg.vento;
        lado.ativo = { efeito: "vento", ate: t + cfg.vento };
        break;
      }
      case "fogo":
        lado.pendentes += 25;
        lado.origemPendente = "fogo";
        lado.donoPendente = e.de ? { id: e.id, nome: e.de } : null;
        lado.fogoAte = t + 30;
        lado.ativo = { efeito: "fogo", ate: t + 6 };
        break;
      case "show":
        lado.blindadaAte = Math.max(lado.blindadaAte, t) + cfg.blindada;
        lado.truques = SHOW.map(nome => ({ nome, id: e.id, de: e.de, show: true })).concat(lado.truques);
        lado.ativo = { efeito: "show", ate: t + 9 };
        ev.ate = lado.blindadaAte;
        break;
    }
    lista.push(ev);
  }

  recomecar(lado, lista) {
    Object.assign(lado, {
      seq: 0, folego: this.cfg.folego.inicio, caida: 0, marco: 0, bateu: false, ultimo: null,
      salto: novoSalto("peD", "peE", 0.5), truque: null,
    });
    lista.push({ tipo: "recomecou", time: lado.id });
  }

  /* ───────── a rodada ───────── */

  comecar(a, b, lista) {
    this.rodada++;
    this.jogo = {
      a, b,
      lados: { [a]: novoLado(a, this.cfg), [b]: novoLado(b, this.cfg) },
      relogio: this.cfg.duracao, vencedor: null,
    };
    this.jogo.lados[b].salto.f = 0.5;
    for (const id of [a, b]) for (const [pid, c] of this.citacoes) if (c.time === id) this.citacoes.delete(pid);
    lista.push({ tipo: "classico", a, b, rodada: this.rodada });
    this.fase = "abertura";
    this.fimFase = this.t + this.cfg.tempos.abertura;
  }

  valendo(lista) {
    this.fase = "jogo";
    this.fimFase = Infinity;
    lista.push({ tipo: "valendo" });
  }

  retomar(lista) {
    lista.push({ tipo: "retomou" });
    this.ultimoReal = this.t;
    this.fase = "jogo";
    this.fimFase = Infinity;
  }

  pausar(lista) {
    const j = this.jogo;
    this.fase = "pausa";
    this.fimFase = Infinity;
    lista.push({ tipo: "ocioso", a: j.a, b: j.b });
  }

  terminar(lista) {
    const j = this.jogo;
    const la = j.lados[j.a], lb = j.lados[j.b];
    const venceA = la.melhor !== lb.melhor ? la.melhor > lb.melhor : la.toques >= lb.toques;
    j.vencedor = venceA ? j.a : j.b;
    const perdedor = venceA ? j.b : j.a;
    this.vitorias.set(j.vencedor, (this.vitorias.get(j.vencedor) || 0) + 1);
    this.fase = "fim";
    this.fimFase = this.t + this.cfg.tempos.fim;
    lista.push({ tipo: "fim", vencedor: j.vencedor, perdedor, melhor: { [j.a]: la.melhor, [j.b]: lb.melhor }, rodada: this.rodada });
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
      case "abertura": this.valendo(lista); break;
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
    while (this.acumulado >= PASSO) {
      this.acumulado -= PASSO;
      this.tique(lista);
    }
    this.alfa = this.acumulado / PASSO;
    return lista;
  }

  tique(lista) {
    this.t += PASSO;
    if (this.fase === "jogo") this.jogar(PASSO, lista);
    if (this.t >= this.fimFase) this.mudarFase(lista);
  }

  jogar(dt, lista) {
    const j = this.jogo;
    if (this.t - this.ultimoReal > this.cfg.ociosidade) { this.pausar(lista); return; }
    j.relogio = Math.max(0, j.relogio - dt);
    if (j.relogio === 0) { this.terminar(lista); return; }
    for (const id of [j.a, j.b]) this.animar(j.lados[id], dt, lista);
  }

  /* Tecla de teste: termina a rodada já. */
  encerrar() {
    const j = this.jogo;
    if (!j || j.vencedor || this.fase !== "jogo") return;
    j.relogio = PASSO / 2;
  }

  rankingTimes() {
    return [...this.vitorias].sort((a, b) => b[1] - a[1]).map(([time, v]) => ({ time, vitorias: v }));
  }

  rankingToques(n = 8) {
    return [...this.pessoas.values()].filter(p => p.toques > 0).sort((a, b) => b.toques - a.toques).slice(0, n);
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
  module.exports = {
    Embaixadinha, PASSO, TRUQUES, NOME_TRUQUE, FAIXAS_EFEITO, CONTATO, MARCOS,
    normalizar, reconhecerTime, reconhecerTruque, marcoDe, novoSalto, alturaNoSalto, uniformes, camisasParecidas,
  };
}
