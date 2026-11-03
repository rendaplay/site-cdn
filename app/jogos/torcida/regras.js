/* Regras da Maior Torcida do Brasil: quem torce pra quem, a lotação de cada
   setor (um torcedor por pessoa), o barulho, o presente indo pro último time
   comentado, o presidente de cada torcida, a ordem do placar, o fim da
   rodada e o ranking da live. Sem DOM: o tempo anda pelo `passo(dt)` e tudo
   que acontece volta numa lista de acontecimentos pra cena, o HUD e o som.

   Fases: rodada → fim (festa do vencedor) → intervalo (ranking) → rodada. */
"use strict";

const FOLGA = 1e-9;

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

class Estadio {
  constructor(cfg) {
    this.cfg = cfg;
    this.zerar();
  }

  zerar() {
    this.t = 0;
    this.rodada = 1;
    this.pessoas = new Map();
    this.setores = this.cfg.times.map((t, i) => ({
      id: t.id, nome: t.nome, pos: i, torcedores: 0, extras: 0, barulho: 0,
      presidente: null, doacoes: new Map(), vitorias: 0,
      reserva: { extras: 0, doacoes: new Map() },
    }));
    this.porId = new Map(this.setores.map(s => [s.id, s]));
    this.comecarRodada();
  }

  comecarRodada() {
    this.fase = "rodada";
    this.fimFase = this.t + this.cfg.rodada.duracao;
    this.vencedor = null;
  }

  setor(id) { return this.porId.get(id) || null; }

  lotacao(s) { return s.torcedores + s.extras; }

  ordem() { return [...this.setores].sort((a, b) => a.pos - b.pos); }

  /* O mais vazio; no empate, o que está mais embaixo no placar. */
  maisVazio() {
    return this.ordem().reduce((m, s) => (this.lotacao(s) <= this.lotacao(m) ? s : m));
  }

  pessoa(quem) {
    const id = String(quem.id || quem.nome);
    let p = this.pessoas.get(id);
    if (!p) {
      p = { id, nome: quem.nome || id, time: null, sentado: null, ultimoBarulho: -Infinity };
      this.pessoas.set(id, p);
    } else if (quem.nome) p.nome = quem.nome;
    return p;
  }

  resta() { return Math.max(0, this.fimFase - this.t); }

  /* ───────── live ───────── */

  /* Comentário com time escolhe (ou troca) o time da pessoa. Quem já tem
     time ganha o torcedor sentado no setor; quem já está sentado só pula. */
  comentario(quem, texto) {
    const time = reconhecerTime(this.cfg.times, texto);
    const p = time ? this.pessoa(quem) : this.pessoas.get(String(quem.id || quem.nome));
    if (!p) return [];
    if (quem.nome) p.nome = quem.nome;
    if (time) p.time = time.id;
    if (!p.time || this.fase !== "rodada") return [];
    const lista = [];
    if (p.sentado !== p.time) this.sentar(p, lista);
    else lista.push({ tipo: "pulou", time: p.time, id: p.id, nome: p.nome });
    if (this.t - p.ultimoBarulho >= this.cfg.chat.intervalo - FOLGA) {
      p.ultimoBarulho = this.t;
      this.barulho(this.setor(p.time), this.cfg.barulho.comentario);
    }
    this.reordenar(p.nome, lista);
    return lista;
  }

  /* Põe a pessoa no setor do time dela; se estava em outro, sai de lá. */
  sentar(p, lista) {
    const de = p.sentado ? this.setor(p.sentado) : null;
    if (de) de.torcedores--;
    const para = this.setor(p.time);
    para.torcedores++;
    p.sentado = para.id;
    lista.push({ tipo: "entrou", time: para.id, id: p.id, nome: p.nome, de: de ? de.id : null });
  }

  curtida(quem, n = 1) {
    const p = this.pessoas.get(String(quem.id || quem.nome));
    if (!p || !p.sentado || this.fase !== "rodada") return [];
    const b = this.cfg.barulho;
    this.barulho(this.setor(p.sentado), Math.min(b.curtidaMax, n * b.curtida));
    return [{ tipo: "acenou", time: p.sentado, id: p.id, nome: p.nome }];
  }

  faixaDe(moedas) {
    let i = -1;
    this.cfg.faixas.forEach((f, k) => { if (moedas >= f.moedas) i = k; });
    return i;
  }

  extrasDaCaravana(moedas) {
    const c = this.cfg.caravana;
    return Math.min(c.maximo, Math.max(c.minimo, Math.round(moedas * c.porMoeda)));
  }

  /* `moedas` é o envio inteiro (com o combo). `faixa` vem do ⚙ (o streamer
     escolheu o efeito desse presente); sem ela vale pelo valor. O presente
     vai pro último time que a pessoa comentou; quem nunca comentou time não
     escolhe, e o efeito toca no setor mais vazio. Só a caravana soma
     lotação; fora da rodada ela e a doação ficam pra próxima. */
  presente(quem, { nome, moedas, quantidade = 1, faixa = null }) {
    if (faixa === null || faixa === undefined) faixa = this.faixaDe(moedas);
    if (faixa < 0) return [];
    faixa = Math.min(faixa, this.cfg.faixas.length - 1);
    const p = this.pessoa(quem);
    const time = p.time ? this.setor(p.time) : null;
    const alvo = time || this.maisVazio();
    const caravana = faixa === 3;
    const extras = caravana ? this.extrasDaCaravana(moedas) : 0;
    const lista = [];
    const doado = {
      tipo: "presente", time: alvo.id, id: p.id, nome: p.nome, presente: nome,
      quantidade, moedas, faixa, extras, semTime: !time,
    };

    if (this.fase !== "rodada") {
      alvo.reserva.extras += extras;
      if (time) time.reserva.doacoes.set(p.id, (time.reserva.doacoes.get(p.id) || 0) + moedas);
      lista.push({ ...doado, guardado: true });
      return lista;
    }

    if (time && p.sentado !== time.id) this.sentar(p, lista);
    alvo.extras += extras;
    this.barulho(alvo, this.cfg.barulho.presente[faixa] || 0);
    lista.push(doado);
    if (time) this.doar(time, p, moedas, lista);
    this.reordenar(p.nome, lista);
    return lista;
  }

  doar(s, p, moedas, lista) {
    const total = (s.doacoes.get(p.id) || 0) + moedas;
    s.doacoes.set(p.id, total);
    const atual = s.presidente;
    if (atual && atual.id === p.id) {
      atual.moedas = total;
      atual.nome = p.nome;
    } else if (!atual || total > atual.moedas) {
      s.presidente = { id: p.id, nome: p.nome, moedas: total };
      lista.push({ tipo: "presidente", time: s.id, id: p.id, nome: p.nome, tomou: !!atual, anterior: atual ? atual.nome : null });
    }
  }

  barulho(s, quanto) {
    if (s && quanto > 0) s.barulho += quanto;
  }

  /* 0 sentado, 1 de pé, 2 pulando, 3 ola, contínuo entre os níveis. */
  agito(s) {
    const [a, b, c] = this.cfg.barulho.niveis;
    const x = s.barulho;
    if (x <= a) return x / a;
    if (x <= b) return 1 + (x - a) / (b - a);
    if (x <= c) return 2 + (x - b) / (c - b);
    return 3;
  }

  /* ───────── placar ───────── */

  /* Mais torcida em cima; no empate fica quem já estava na frente. Quem
     subiu ganha um `passou` com os que deixou pra trás, do mais bem
     colocado pro pior. */
  reordenar(por, lista) {
    const novo = [...this.setores].sort((a, b) => this.lotacao(b) - this.lotacao(a) || a.pos - b.pos);
    const antes = new Map(this.setores.map(s => [s.id, s.pos]));
    const avisos = [];
    novo.forEach((s, para) => {
      const de = s.pos;
      if (de === para) return;
      s.pos = para;
      lista.push({ tipo: "mudou", time: s.id, de, para });
      if (para > de || this.fase !== "rodada") return;
      const passados = this.setores
        .filter(o => o !== s && antes.get(o.id) >= para && antes.get(o.id) < de)
        .sort((a, b) => antes.get(a.id) - antes.get(b.id)).map(o => o.id);
      avisos.push({ tipo: "passou", time: s.id, passados, para, lider: para === 0, por });
    });
    lista.push(...avisos);
  }

  /* ───────── relógio ───────── */

  passo(dt) {
    this.t += dt;
    const queda = Math.pow(0.5, dt / this.cfg.barulho.meiaVida);
    for (const s of this.setores) s.barulho *= queda;
    const lista = [];
    if (this.t < this.fimFase - FOLGA) return lista;
    if (this.fase === "rodada") this.fecharRodada(lista);
    else if (this.fase === "fim") {
      this.fase = "intervalo";
      this.fimFase = this.t + this.cfg.rodada.intervalo;
      lista.push({ tipo: "intervalo", vencedor: this.vencedor });
    } else this.novaRodada(lista);
    return lista;
  }

  encerrar() {
    if (this.fase === "rodada") this.fimFase = this.t;
  }

  /* O primeiro do placar leva a rodada; estádio vazio não tem vencedor. */
  fecharRodada(lista) {
    const lider = this.ordem()[0];
    const ganhou = this.lotacao(lider) > 0 ? lider : null;
    if (ganhou) ganhou.vitorias++;
    this.vencedor = ganhou ? ganhou.id : null;
    this.fase = "fim";
    this.fimFase = this.t + this.cfg.rodada.fim;
    lista.push({
      tipo: "fim", rodada: this.rodada, vencedor: this.vencedor,
      lotacao: ganhou ? this.lotacao(ganhou) : 0,
      presidente: ganhou && ganhou.presidente ? { id: ganhou.presidente.id, nome: ganhou.presidente.nome } : null,
    });
  }

  /* Estádio esvazia: lotação e presidentes zeram, a ordem anterior
     desempata e o que foi doado fora da rodada já conta. */
  novaRodada(lista) {
    for (const p of this.pessoas.values()) { p.sentado = null; p.ultimoBarulho = -Infinity; }
    const reservas = [];
    for (const s of this.setores) {
      s.torcedores = 0;
      s.extras = s.reserva.extras;
      s.presidente = null;
      s.doacoes = new Map();
      s.barulho = 0;
      for (const [id, moedas] of s.reserva.doacoes) {
        const p = this.pessoas.get(id);
        this.doar(s, p || { id, nome: id }, moedas, []);
      }
      if (s.extras || s.presidente) reservas.push({ time: s.id, extras: s.extras, presidente: s.presidente ? { ...s.presidente } : null });
      s.reserva = { extras: 0, doacoes: new Map() };
    }
    this.rodada++;
    this.comecarRodada();
    lista.push({ tipo: "rodada", rodada: this.rodada, reservas });
    const mudancas = [];
    this.reordenar(null, mudancas);
    lista.push(...mudancas.filter(a => a.tipo === "mudou"));
  }

  /* Rodadas vencidas por time; quem nunca ganhou fica fora. */
  rankingLive() {
    return this.setores.filter(s => s.vitorias)
      .sort((a, b) => b.vitorias - a.vitorias || a.pos - b.pos);
  }
}

if (typeof module !== "undefined") module.exports = { Estadio, normalizar, reconhecerTime };
