/* Regras do Cai ou Não Cai?: a tabela, os pontos, quem torce pra quem, as
   zonas, o presidente de cada torcida, o fim da rodada e o ranking da live.
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

class Tabela {
  constructor(cfg, aleatorio = Math.random) {
    this.cfg = cfg;
    this.sorte = aleatorio;
    this.zerar();
  }

  zerar() {
    this.t = 0;
    this.rodada = 1;
    this.fase = "rodada";
    this.fimFase = this.cfg.rodada.duracao;
    this.torcedores = new Map();
    this.times = this.cfg.times.map(t => ({
      id: t.id, nome: t.nome, pontos: 0, reserva: 0, pos: 0,
      vitorias: 0, quedas: 0, presidente: null, doacoes: new Map(),
    }));
    this.porId = new Map(this.times.map(t => [t.id, t]));
    const ordem = [...this.times];
    for (let i = ordem.length - 1; i > 0; i--) {
      const j = Math.floor(this.sorte() * (i + 1));
      [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
    }
    ordem.forEach((t, i) => { t.pos = i; });
  }

  time(id) { return this.porId.get(id) || null; }

  ordem() { return [...this.times].sort((a, b) => a.pos - b.pos); }

  zona(pos) {
    const z = this.cfg.zonas;
    if (pos < z.topo) return "topo";
    if (pos >= this.times.length - z.queda) return "queda";
    return "meio";
  }

  torcedor(quem) {
    const id = String(quem.id || quem.nome);
    let j = this.torcedores.get(id);
    if (!j) {
      j = { id, nome: quem.nome || id, time: null, ultimoPonto: -Infinity, curtidas: 0 };
      this.torcedores.set(id, j);
    } else if (quem.nome) j.nome = quem.nome;
    return j;
  }

  /* ───────── live ───────── */

  comentario(quem, texto) {
    const time = reconhecerTime(this.cfg.times, texto);
    if (!time) return [];
    const j = this.torcedor(quem);
    const trocou = j.time !== time.id;
    j.time = time.id;
    const pontuou = this.fase === "rodada" && this.t - j.ultimoPonto >= this.cfg.chat.intervalo;
    const lista = [{ tipo: "comentou", time: time.id, id: j.id, nome: j.nome, pontuou, trocou }];
    if (pontuou) {
      j.ultimoPonto = this.t;
      this.somar(this.time(time.id), this.cfg.chat.ponto, j, lista);
    }
    return lista;
  }

  curtida(quem, n = 1) {
    const j = this.torcedores.get(String(quem.id || quem.nome));
    if (!j || !j.time || this.fase !== "rodada") return [];
    j.curtidas += n;
    const por = this.cfg.chat.curtidasPorPonto;
    const pontos = Math.floor(j.curtidas / por);
    if (!pontos) return [];
    j.curtidas -= pontos * por;
    const lista = [{ tipo: "curtiu", time: j.time, id: j.id, nome: j.nome, pontos }];
    this.somar(this.time(j.time), pontos, j, lista);
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
    const j = this.torcedor(quem);
    const time = j.time ? this.time(j.time) : null;
    const pontos = time ? Math.round(moedas * this.cfg.pontosPorMoeda) : 0;
    /* Quem nunca comentou time não pontua, mas o efeito toca no lanterna,
       que é quem mais precisa: o presente não some da tela. */
    const alvo = time || this.ordem()[this.times.length - 1];
    const lista = [{
      tipo: "presente", time: alvo.id, id: j.id, nome: j.nome, presente: nome,
      quantidade, moedas, faixa, pontos, semTime: !time,
    }];
    if (!time) return lista;
    if (this.fase !== "rodada") {
      time.reserva += pontos;
      return lista;
    }
    this.doar(time, j, moedas, lista);
    this.somar(time, pontos, j, lista);
    return lista;
  }

  doar(time, j, moedas, lista) {
    const total = (time.doacoes.get(j.id) || 0) + moedas;
    time.doacoes.set(j.id, total);
    const atual = time.presidente;
    if (atual && atual.id === j.id) {
      atual.moedas = total;
      atual.nome = j.nome;
    } else if (!atual || total > atual.moedas) {
      time.presidente = { id: j.id, nome: j.nome, moedas: total };
      lista.push({ tipo: "presidente", time: time.id, id: j.id, nome: j.nome, tomou: !!atual });
    }
  }

  /* ───────── tabela ───────── */

  somar(time, pontos, j, lista) {
    time.pontos += pontos;
    this.reordenar(j ? j.nome : null, lista);
  }

  /* Mais pontos em cima; no empate fica quem já estava na frente. */
  reordenar(por, lista) {
    const novo = [...this.times].sort((a, b) => b.pontos - a.pontos || a.pos - b.pos);
    const avisos = [];
    novo.forEach((t, para) => {
      const de = t.pos;
      if (de === para) return;
      t.pos = para;
      lista.push({ tipo: "mudou", time: t.id, de, para });
      if (this.fase !== "rodada") return;
      const zDe = this.zona(de), zPara = this.zona(para);
      if (zDe === "queda" && zPara !== "queda") avisos.push({ tipo: "saiuZ4", time: t.id, por });
      else if (zDe !== "queda" && zPara === "queda") avisos.push({ tipo: "entrouZ4", time: t.id });
      if (para === 0) avisos.push({ tipo: "lider", time: t.id, por });
    });
    lista.push(...avisos);
  }

  /* ───────── relógio ───────── */

  passo(dt) {
    this.t += dt;
    const lista = [];
    if (this.t < this.fimFase) return lista;
    if (this.fase === "rodada") this.fecharRodada(lista);
    else if (this.fase === "queda") {
      this.fase = "intervalo";
      this.fimFase = this.t + this.cfg.rodada.intervalo;
      lista.push({ tipo: "intervalo" });
    } else this.novaRodada(lista);
    return lista;
  }

  encerrar() {
    if (this.fase === "rodada") this.fimFase = this.t;
  }

  /* Os de baixo caem do último pro primeiro da zona; o líder leva a rodada. */
  fecharRodada(lista) {
    const ordem = this.ordem();
    const caidos = ordem.slice(ordem.length - this.cfg.zonas.queda).reverse();
    const campeao = ordem[0];
    campeao.vitorias++;
    for (const t of caidos) t.quedas++;
    this.fase = "queda";
    this.fimFase = this.t + this.cfg.rodada.queda;
    lista.push({ tipo: "fim", caidos: caidos.map(t => t.id), campeao: campeao.id, rodada: this.rodada });
  }

  /* Pontos zeram (fica o que foi doado no intervalo) e a ordem anterior
     desempata. */
  novaRodada(lista) {
    for (const t of this.times) {
      t.pontos = t.reserva;
      t.reserva = 0;
      t.presidente = null;
      t.doacoes.clear();
    }
    this.rodada++;
    this.fase = "rodada";
    this.fimFase = this.t + this.cfg.rodada.duracao;
    lista.push({ tipo: "rodada", rodada: this.rodada });
    this.reordenar(null, []);
  }

  rankingLive() {
    return this.times.filter(t => t.vitorias || t.quedas)
      .sort((a, b) => b.vitorias - a.vitorias || a.quedas - b.quedas || a.pos - b.pos);
  }

  resta() { return Math.max(0, this.fimFase - this.t); }
}

if (typeof module !== "undefined") module.exports = { Tabela, normalizar, reconhecerTime };
