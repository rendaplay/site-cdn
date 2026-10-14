/* Regras da Chuva de Bolinha: quem joga, a fila de bolinhas, a rodada, os
   pontos, as faixas de presente e os eventos. Sem DOM: o tempo anda pelo
   `passo(dt)`, o sorteio é injetável e tudo que acontece volta numa lista
   de acontecimentos pra cena, o HUD e o som reagirem. */
"use strict";

const MesaFisica = typeof module !== "undefined" ? require("./fisica.js").Mesa : Mesa;

/* Mesa em px do palco. Vertical respeita as zonas do TikTok: cabeçalho até
   11%, HUD em 12–18%, tabuleiro até 61%, potes até 68% e o resto fica pro
   chat e os botões do app. */
const FORMATOS = {
  vertical: {
    W: 1080, H: 1920,
    mesa: { x0: 24, x1: 836, topo: 372, y0: 440, poteTopo: 1196, poteFundo: 1300 },
  },
  horizontal: {
    W: 1920, H: 1080,
    mesa: { x0: 608, x1: 1312, topo: 150, y0: 205, poteTopo: 850, poteFundo: 940 },
  },
};

const CORES = ["#FF3D9A", "#39E6FF", "#FFE14D", "#7CFF6B", "#B46BFF", "#FF8A3D", "#3DFFC5", "#FF5C5C", "#5C8BFF", "#F7A8FF"];

function hashTexto(s) {
  let h = 2166136261;
  for (const ch of String(s)) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return h >>> 0;
}

const FILA_MAX = 600;
const FECHAR_MAX = 10;

class Partida {
  constructor(cfg, formato = "vertical", aleatorio = Math.random) {
    this.cfg = cfg;
    this.sorte = aleatorio;
    this.mesa = new MesaFisica(FORMATOS[formato].mesa, { ...cfg.mesa, potes: cfg.potes.length }, aleatorio);
    this.jogadores = new Map();
    this.zerar();
  }

  zerar() {
    this.t = 0;
    this.fila = [];
    this.vazao = 0;
    this.rodada = 1;
    this.fase = "rodada";
    this.fimFase = this.cfg.rodada.duracao;
    this.rei = null;
    this.curtidas = 0;
    this.moedas = 0;
    this.bolinhas = 0;
    this.ultimoPresente = 0;
    this.ultimaSurpresa = -Infinity;
    this.pinoOuroAte = 0;
    this.bolonaAte = 0;
    this.podio = [];
    this.jogadores.clear();
    this.mesa.bolas = [];
    this.mesa.pinoDeOuro = -1;
  }

  trocarFormato(formato) {
    this.mesa.bolas = [];
    this.mesa.montar(FORMATOS[formato].mesa);
    this.mesa.pinoDeOuro = -1;
    this.pinoOuroAte = 0;
  }

  jogador(quem) {
    const id = String(quem.id || quem.nome);
    let j = this.jogadores.get(id);
    if (!j) {
      j = {
        id, nome: quem.nome || id, foto: quem.foto || null,
        cor: CORES[hashTexto(id) % CORES.length],
        pontos: 0, total: 0, moedas: 0, melhor: 0, ultimoComentario: -Infinity,
      };
      this.jogadores.set(id, j);
    } else {
      if (quem.nome) j.nome = quem.nome;
      if (quem.foto) j.foto = quem.foto;
    }
    return j;
  }

  enfileirar(j, qtd, extra = {}) {
    for (let i = 0; i < qtd && this.fila.length < FILA_MAX; i++) this.fila.push({ dono: j.id, ...extra });
  }

  /* ───────── live ───────── */

  comentario(quem) {
    const j = this.jogador(quem);
    if (this.t - j.ultimoComentario < this.cfg.chat.intervalo) return [];
    j.ultimoComentario = this.t;
    this.enfileirar(j, 1);
    return [{ tipo: "comentou", id: j.id }];
  }

  seguiu(quem) {
    const j = this.jogador(quem);
    this.enfileirar(j, 1, { dourada: true });
    return [{ tipo: "seguiu", id: j.id }];
  }

  compartilhou(quem) {
    const j = this.jogador(quem);
    this.enfileirar(j, this.cfg.chat.compartilhar);
    return [{ tipo: "compartilhou", id: j.id }];
  }

  curtida(quem, n = 1) {
    this.curtidas += n;
    if (this.curtidas < this.cfg.chat.curtidas) return [];
    this.curtidas %= this.cfg.chat.curtidas;
    this.mesa.choque();
    return [{ tipo: "choque", id: this.jogador(quem).id }];
  }

  faixaDe(moedas) {
    let i = -1;
    this.cfg.faixas.forEach((f, k) => { if (moedas >= f.moedas) i = k; });
    return i;
  }

  /* `faixa` vem do ⚙ (o streamer escolheu a faixa desse presente); sem ela
     vale pelo valor. O lendário segue só pelo valor. */
  presente(quem, { nome, moedas, quantidade = 1, faixa = null }) {
    const j = this.jogador(quem);
    if (faixa === null) faixa = this.faixaDe(moedas);
    j.moedas += moedas;
    this.moedas += moedas;
    this.ultimoPresente = this.t;
    if (faixa < 0) return [];
    const lendario = moedas >= this.cfg.lendario.moedas;
    const f = this.cfg.faixas[faixa];
    const bolinhas = lendario ? this.cfg.lendario.bolinhas : f.bolinhas;
    const chuva = lendario || !!f.chuva;
    /* Bolona e ouro passam na frente da fila: quem mandou presente grande
       quer ver na hora. */
    const frente = [];
    if (lendario || f.bolona) frente.push({ dono: j.id, bolona: true });
    for (let i = 0; i < (f.ouro || 0); i++) frente.push({ dono: j.id, dourada: true });
    this.fila.unshift(...frente);
    this.enfileirar(j, bolinhas, chuva ? { chuva: true } : {});
    return [{ tipo: "presente", id: j.id, faixa, lendario, nome, moedas, quantidade, bolinhas }];
  }

  /* ───────── pontos ───────── */

  valorDoPote(i) {
    const potes = this.cfg.potes;
    const meio = (potes.length - 1) / 2;
    if (this.t < this.bolonaAte && Math.abs(i - meio) <= 1) return Math.max(...potes);
    return potes[i];
  }

  pontuar(e) {
    const d = e.bola.dados;
    let pontos = this.valorDoPote(e.pote);
    if (d.dourada) pontos *= 2;
    if (e.bola.tocouOuro) pontos *= this.cfg.surpresa.multiplica;
    const j = this.jogadores.get(d.dono);
    if (j) {
      j.pontos += pontos;
      j.total += pontos;
      j.melhor = Math.max(j.melhor, pontos);
    }
    return {
      tipo: "pote", id: d.dono, pote: e.pote, pontos, bola: e.bola,
      grande: pontos >= this.cfg.destaque,
    };
  }

  /* ───────── relógio ───────── */

  soltarDaFila(acontecimentos) {
    const m = this.cfg.mesa;
    while (this.fila.length && this.vazao >= 1 && this.mesa.bolas.length < m.limite) {
      this.vazao -= 1;
      const item = this.fila.shift();
      const j = this.jogadores.get(item.dono);
      if (!j) continue;
      const dados = { dono: j.id, cor: j.cor, dourada: !!item.dourada, bolona: !!item.bolona };
      const d = this.mesa.dims;
      let b;
      if (item.bolona) {
        b = this.mesa.soltar({ r: m.raio * 3, toque: m.raio, x: (d.x0 + d.x1) / 2, y: d.topo - 60, dados });
        this.bolonaAte = this.t + this.cfg.bolonaDuracao;
      } else if (item.chuva) {
        /* Chuva cai de toda a largura, de um pouco acima da mesa. */
        const x = d.x0 + m.raio + this.sorte() * (d.x1 - d.x0 - 2 * m.raio);
        b = this.mesa.soltar({ x, y: d.topo - this.sorte() * 80, vy: 120, dados });
      } else {
        b = this.mesa.soltar({ dados });
      }
      this.bolinhas++;
      acontecimentos.push({ tipo: "soltou", id: j.id, bola: b });
    }
  }

  passo(dt) {
    this.t += dt;
    const acontecimentos = [];
    const cfg = this.cfg;

    if (this.fase === "rodada") {
      /* Fila vazia é solta na hora; com fila, sai na vazão do preset. */
      this.vazao = Math.min(this.vazao + cfg.mesa.vazao * dt, Math.max(1, cfg.mesa.vazao * 0.25));
      if (this.fila.length) this.soltarDaFila(acontecimentos);
    }

    for (const e of this.mesa.passo(dt)) {
      if (e.tipo === "pote") acontecimentos.push(this.pontuar(e));
      else acontecimentos.push(e);
    }

    this.surpresa(acontecimentos);

    if (this.fase === "rodada" && this.t >= this.fimFase) {
      this.fase = "fechando";
      this.fimFase = this.t + FECHAR_MAX;
      acontecimentos.push({ tipo: "fechando" });
    } else if (this.fase === "fechando" && (!this.mesa.bolas.length || this.t >= this.fimFase)) {
      this.fecharRodada(acontecimentos);
    } else if (this.fase === "podio" && this.t >= this.fimFase) {
      this.novaRodada(acontecimentos);
    }
    return acontecimentos;
  }

  surpresa(acontecimentos) {
    const s = this.cfg.surpresa;
    if (this.pinoOuroAte && this.t >= this.pinoOuroAte) {
      this.pinoOuroAte = 0;
      this.mesa.pinoDeOuro = -1;
      acontecimentos.push({ tipo: "fimPinoDeOuro" });
    }
    if (!s.ligada || this.fase !== "rodada" || this.pinoOuroAte) return;
    if (this.t - this.ultimoPresente < s.semPresente || this.t - this.ultimaSurpresa < s.intervalo) return;
    if (this.fimFase - this.t < 10) return;
    const pino = this.mesa.sortearPinoDeOuro();
    if (pino < 0) return;
    this.pinoOuroAte = this.t + s.duracao;
    this.ultimaSurpresa = this.t;
    acontecimentos.push({ tipo: "pinoDeOuro", pino });
  }

  fecharRodada(acontecimentos) {
    this.mesa.bolas = [];
    this.podio = this.rankingRodada(3).filter(j => j.pontos > 0);
    const antes = this.rei;
    if (this.podio.length) this.rei = this.podio[0].id;
    this.fase = "podio";
    this.fimFase = this.t + this.cfg.rodada.podio;
    acontecimentos.push({ tipo: "podio", top: this.podio, rei: this.rei, novoRei: this.rei !== antes });
  }

  novaRodada(acontecimentos) {
    for (const j of this.jogadores.values()) j.pontos = 0;
    this.rodada++;
    this.fase = "rodada";
    this.fimFase = this.t + this.cfg.rodada.duracao;
    this.bolonaAte = 0;
    acontecimentos.push({ tipo: "rodada", rodada: this.rodada });
  }

  rankingRodada(n = 5) {
    return [...this.jogadores.values()].filter(j => j.pontos > 0)
      .sort((a, b) => b.pontos - a.pontos).slice(0, n);
  }

  rankingLive(n = 5) {
    return [...this.jogadores.values()].filter(j => j.total > 0)
      .sort((a, b) => b.total - a.total).slice(0, n);
  }

  resta() { return Math.max(0, this.fimFase - this.t); }
}

if (typeof module !== "undefined") module.exports = { Partida, FORMATOS, hashTexto };
