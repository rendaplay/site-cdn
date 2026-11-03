/* Regras do Davi x Golias: o total de cada doador na rodada, quem é o
   Golias e a troca, a carga da funda, a distância e o tamanho do gigante,
   o tiro, o fim da rodada e o placar da live. Sem DOM: o tempo anda pelo
   `passo(dt)` e tudo que acontece volta numa lista de acontecimentos pra
   cena, o HUD e o som.

   Fases: rodada → tiro (pedra no ar) → fim (gigante caindo ou pisando) →
   intervalo (placar) → rodada. */
"use strict";

const FOLGA = 1e-9;

class Duelo {
  constructor(cfg) {
    this.cfg = cfg;
    this.zerar();
  }

  zerar() {
    this.t = 0;
    this.rodada = 1;
    this.vitorias = { davi: 0, golias: 0 };
    this.temidos = new Map();
    this.golias = null;
    this.totais = new Map();
    this.reservas = new Map();
    this.pessoas = new Map();
    this.escala = 1;
    this.comecarRodada();
  }

  comecarRodada() {
    this.fase = "rodada";
    this.fimFase = this.t + this.cfg.rodada.duracao;
    this.dist = this.cfg.golias.distancia;
    this.carga = 0;
    this.passouMetade = false;
    this.avisouPerto = false;
    this.ultimaCarga = null;
    this.tiro = null;
  }

  pessoa(quem) {
    const id = String(quem.id || quem.nome);
    let p = this.pessoas.get(id);
    if (!p) {
      p = { id, nome: quem.nome || id, ultimaCarga: -Infinity, curtidas: 0 };
      this.pessoas.set(id, p);
    } else if (quem.nome) p.nome = quem.nome;
    return p;
  }

  ehGolias(p) { return !!this.golias && this.golias.id === p.id; }

  fracao() { return Math.min(1, this.carga / this.cfg.funda.cheia); }

  resta() { return Math.max(0, this.fimFase - this.t); }

  /* ───────── live ───────── */

  comentario(quem) {
    const p = this.pessoa(quem);
    const golias = this.ehGolias(p);
    const pode = this.fase === "rodada" && !golias && this.t - p.ultimaCarga >= this.cfg.funda.intervalo - FOLGA;
    const carga = pode ? this.cfg.funda.comentario : 0;
    const lista = [{ tipo: "comentou", id: p.id, nome: p.nome, carga, golias }];
    if (pode) {
      p.ultimaCarga = this.t;
      this.carregar(p, carga, lista);
    }
    return lista;
  }

  curtida(quem, n = 1) {
    if (this.fase !== "rodada") return [];
    const p = this.pessoa(quem);
    if (this.ehGolias(p)) return [];
    p.curtidas += n;
    const por = this.cfg.funda.curtidasPorCarga;
    const carga = Math.floor(p.curtidas / por);
    if (!carga) return [];
    p.curtidas -= carga * por;
    const lista = [{ tipo: "curtiu", id: p.id, nome: p.nome, carga }];
    this.carregar(p, carga, lista);
    return lista;
  }

  faixaDe(moedas) {
    let i = -1;
    this.cfg.faixas.forEach((f, k) => { if (moedas >= f.moedas) i = k; });
    return i;
  }

  /* `moedas` é o envio inteiro (com o combo). `faixa` vem do ⚙ (o streamer
     escolheu o efeito desse presente); sem ela vale pelo valor. Do Golias,
     o gigante anda e cresce; de qualquer outro, a funda carrega, e se o
     total passar o do Golias quem mandou vira o gigante. */
  presente(quem, { nome, moedas, quantidade = 1, faixa = null }) {
    if (faixa === null || faixa === undefined) faixa = this.faixaDe(moedas);
    if (faixa < 0) return [];
    faixa = Math.min(faixa, this.cfg.faixas.length - 1);
    const p = this.pessoa(quem);
    const base = { tipo: "presente", id: p.id, nome: p.nome, presente: nome, quantidade, moedas, faixa };

    if (this.fase !== "rodada") {
      this.reservas.set(p.id, (this.reservas.get(p.id) || 0) + moedas);
      return [{ ...base, lado: this.ehGolias(p) ? "golias" : "davi", guardado: true }];
    }

    if (this.ehGolias(p)) {
      const g = this.cfg.golias;
      const passos = g.passos[faixa] || 0;
      const crescimento = g.crescimento[faixa] || 0;
      this.escala = Math.min(g.escalaMax, this.escala + crescimento);
      this.golias.total += moedas;
      this.totais.set(p.id, this.golias.total);
      const lista = [{ ...base, lado: "golias", passos, crescimento }];
      this.andar(passos, lista);
      return lista;
    }

    const f = this.cfg.funda;
    const lendario = faixa === this.cfg.faixas.length - 1;
    const carga = lendario ? 0 : f.presente[faixa] || 0;
    const empurrao = faixa === 3 ? this.cfg.golias.empurrao : 0;
    const lista = [{ ...base, lado: "davi", carga, empurrao, lendario }];
    if (empurrao) this.dist = Math.min(this.cfg.golias.distancia, this.dist + empurrao);
    const total = (this.totais.get(p.id) || 0) + moedas;
    this.totais.set(p.id, total);
    if (lendario) {
      this.ultimaCarga = p;
      this.atirar(lista, { lendario: true });
    } else this.carregar(p, carga, lista);
    if (this.fase === "rodada" && (!this.golias || total > this.golias.total)) this.coroar(p, total, lista);
    return lista;
  }

  coroar(p, total, lista) {
    const anterior = this.golias ? { id: this.golias.id, nome: this.golias.nome } : null;
    this.golias = { id: p.id, nome: p.nome, total };
    lista.push({ tipo: "golias", id: p.id, nome: p.nome, anterior, total });
  }

  carregar(p, carga, lista) {
    if (!carga || this.fase !== "rodada") return;
    this.carga = Math.min(this.cfg.funda.cheia, this.carga + carga);
    this.ultimaCarga = p;
    if (!this.passouMetade && this.carga >= this.cfg.funda.cheia / 2) {
      this.passouMetade = true;
      if (this.carga < this.cfg.funda.cheia) lista.push({ tipo: "metade" });
    }
    if (this.carga >= this.cfg.funda.cheia) this.atirar(lista, {});
  }

  /* ───────── gigante ───────── */

  andar(metros, lista) {
    if (this.fase !== "rodada") return;
    this.dist = Math.max(0, this.dist - metros);
    if (!this.avisouPerto && this.dist < this.cfg.golias.distancia * 0.25) {
      this.avisouPerto = true;
      if (this.dist > 0) lista.push({ tipo: "perto" });
    }
    if (this.dist <= 0) this.terminar("golias", "pisao", lista);
  }

  /* ───────── tiro e fim ───────── */

  atirar(lista, { lendario = false, tempo = false }) {
    const quem = this.ultimaCarga;
    const acertou = lendario || this.carga >= this.cfg.funda.cheia * (tempo ? this.cfg.funda.acertoNoTempo : 1) - FOLGA;
    this.tiro = { acertou, id: quem ? quem.id : null, nome: quem ? quem.nome : null, lendario, tempo };
    this.fase = "tiro";
    this.fimFase = this.t + this.cfg.rodada.tiro + (lendario ? this.cfg.rodada.lenda || 0 : 0);
    lista.push({ tipo: "tiro", ...this.tiro, carga: this.fracao() });
  }

  terminar(vencedor, motivo, lista) {
    this.vitorias[vencedor]++;
    if (this.golias) {
      const t = this.temidos.get(this.golias.id) || { id: this.golias.id, nome: this.golias.nome, rodadas: 0 };
      t.nome = this.golias.nome;
      t.rodadas++;
      this.temidos.set(t.id, t);
    }
    this.fase = "fim";
    this.fimFase = this.t + this.cfg.rodada.fim;
    this.vencedor = vencedor;
    const quem = vencedor === "davi" ? this.tiro : this.golias;
    lista.push({
      tipo: "fim", vencedor, motivo, rodada: this.rodada,
      id: quem ? quem.id : null, nome: quem ? quem.nome : null,
    });
  }

  encerrar() {
    if (this.fase === "rodada") this.fimFase = this.t;
  }

  /* ───────── relógio ───────── */

  passo(dt) {
    this.t += dt;
    const lista = [];
    if (this.fase === "rodada") {
      const g = this.cfg.golias;
      this.andar((this.golias ? g.velocidade : g.velocidadeSemDono) * dt, lista);
      if (this.fase !== "rodada") return lista;
    }
    if (this.t < this.fimFase - FOLGA) return lista;
    if (this.fase === "rodada") this.atirar(lista, { tempo: true });
    else if (this.fase === "tiro") {
      if (this.tiro.acertou) this.terminar("davi", this.tiro.tempo ? "tempo" : "tiro", lista);
      else this.terminar("golias", "tempo", lista);
    } else if (this.fase === "fim") {
      this.fase = "intervalo";
      this.fimFase = this.t + this.cfg.rodada.intervalo;
      lista.push({ tipo: "intervalo", vencedor: this.vencedor, placar: this.placar() });
    } else this.novaRodada(lista);
    return lista;
  }

  /* O Golias que venceu segue gigante e com o total; o resto zera. Depois
     da vitória do Davi o gigante volta sem dono e do tamanho normal. O que
     foi doado entre as rodadas já conta pra próxima. */
  novaRodada(lista) {
    const manteve = this.vencedor === "golias" ? this.golias : null;
    this.totais = new Map(manteve ? [[manteve.id, manteve.total]] : []);
    this.golias = manteve;
    if (!manteve) this.escala = 1;
    for (const [id, moedas] of this.reservas) {
      const total = (this.totais.get(id) || 0) + moedas;
      this.totais.set(id, total);
      if (this.golias && this.golias.id === id) this.golias.total = total;
      else if (!this.golias || total > this.golias.total) {
        const p = this.pessoas.get(id);
        this.golias = { id, nome: p ? p.nome : id, total };
      }
    }
    this.reservas.clear();
    for (const p of this.pessoas.values()) { p.curtidas = 0; p.ultimaCarga = -Infinity; }
    this.rodada++;
    this.comecarRodada();
    lista.push({ tipo: "rodada", rodada: this.rodada, golias: this.golias ? { ...this.golias } : null });
  }

  placar() {
    let temido = null;
    for (const t of this.temidos.values()) if (!temido || t.rodadas > temido.rodadas) temido = t;
    return { davi: this.vitorias.davi, golias: this.vitorias.golias, temido: temido ? { ...temido } : null };
  }
}

if (typeof module !== "undefined") module.exports = { Duelo };
