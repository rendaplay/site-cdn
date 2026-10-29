/* Regras da Corrida Presidencial: dois corredores, presente vira impulso,
   nitro, casca de banana no rival ou jato, por faixa de valor. Sem DOM e sem
   relógio próprio: quem chama passa o dt. Metros e velocidades aqui; a cena
   só suaviza. */
"use strict";

(function (raiz) {
  const LadosClasse = raiz.Lados || (typeof require !== "undefined" ? require("../comum/eleicao/lados.js").Lados : null);

  class Corrida {
    constructor(config, candidatos) {
      this.config = config;
      this.lados = new LadosClasse(candidatos, config);
      this.numero = 0;
      this.serie = [0, 0];
      this.novaCorrida();
    }

    novaCorrida() {
      this.numero++;
      this.pos = [0, 0];
      this.vel = [this.config.base, this.config.base];
      this.caido = [0, 0];
      this.boost = [[], []];
      this.fase = "correndo";
      this.tempo = 0;
      this.liderAtual = -1;
      this.ultrapassouEm = -Infinity;
      this.encostouAberto = [false, false];
      this.avisouRetaFinal = false;
      this.doadores = [new Map(), new Map()];
      this.lados.novaRodada();
    }

    receber(p) {
      const u = p.user || {};
      const d = p.data || {};
      const quem = { id: u.id, nick: u.nickname, avatar: u.avatar };
      const agora = p.agora ?? Date.now();
      let saida;
      if (p.type === "gift") {
        const quantidade = Math.max(1, Number(d.count) || 1);
        const moedas = Number(d.total_coins) || (Number(d.coins) || 0) * quantidade;
        const faixa = this.config.faixa ? this.config.faixa(d.name, Number(d.coins) || moedas / quantidade) : null;
        saida = this.lados.presente({ ...quem, presente: d.name, quantidade, moedas, faixa });
      } else if (p.type === "chat") saida = this.lados.comentario({ ...quem, texto: d.text, agora });
      else if (p.type === "like") saida = this.lados.curtida({ ...quem, curtidas: Number(d.count) || 1, agora }, l => this.pos[l]);
      else if (p.type === "follow") saida = this.lados.seguiu(quem, l => this.pos[l]);
      else return [];
      return saida.flatMap(a => (a.tipo === "entrada" ? this.aplicar(a, agora) : [a]));
    }

    efeitoDe(moedas, faixa) {
      const faixas = [...this.config.faixas].sort((x, y) => x.de - y.de);
      if (faixa !== null && faixa !== undefined && faixas[faixa]) return faixas[faixa].efeito;
      return (faixas.filter(f => moedas >= f.de).pop() || faixas[0]).efeito;
    }

    aplicar(e, agora) {
      if (this.fase !== "correndo") return [];
      const c = this.config;
      if (e.fonte !== "presente") {
        this.pos[e.lado] += e.pontos;
        return [{ tipo: "efeito", efeito: "passinho", lado: e.lado, alvo: e.lado, quem: e.quem, moedas: 0, metros: e.pontos, fonte: e.fonte, liberado: false }];
      }
      const d = this.doadores[e.lado].get(e.quem.id) || { ...e.quem, moedas: 0, desde: agora };
      d.moedas += e.pontos;
      this.doadores[e.lado].set(e.quem.id, d);

      // A faixa vale pelo preço de cada presente: combo de 20 rosas continua sendo rosa.
      const efeito = this.efeitoDe(e.pontos / Math.max(1, e.quantidade || 1), e.faixa);
      const base = { tipo: "efeito", efeito, lado: e.lado, alvo: e.lado, quem: e.quem, moedas: e.pontos, liberado: e.liberado, presente: e.presente };
      if (efeito === "impulso") {
        const metros = Math.min(e.pontos * c.impulso.metrosPorMoeda, c.impulso.teto ?? 120);
        this.pos[e.lado] += metros;
        return [{ ...base, metros }];
      }
      if (efeito === "banana") {
        const alvo = 1 - e.lado;
        this.caido[alvo] = c.banana.segundos;
        const metros = Math.min(e.pontos * c.banana.metrosPorMoeda, c.banana.teto);
        this.boost[e.lado].push({ resta: c.nitro.segundos, mps: metros / c.nitro.segundos, tipo: "nitro" });
        return [{ ...base, alvo, metros }];
      }
      const r = c[efeito];
      const metros = Math.min(e.pontos * r.metrosPorMoeda, r.teto);
      this.boost[e.lado].push({ resta: r.segundos, mps: metros / r.segundos, tipo: efeito });
      return [{ ...base, metros }];
    }

    avancar(dt, agora) {
      if (this.fase !== "correndo" || !(dt > 0)) return [];
      const c = this.config;
      this.tempo += dt;
      for (const l of [0, 1]) {
        let mps = 0;
        for (const b of this.boost[l]) {
          const usado = Math.min(dt, b.resta);
          mps += (b.mps * usado) / dt;
          b.resta -= usado;
        }
        this.boost[l] = this.boost[l].filter(b => b.resta > 1e-9);
        if (this.caido[l] > 0) {
          this.caido[l] = Math.max(0, this.caido[l] - dt);
          this.vel[l] = 0;
        } else {
          this.vel[l] = c.base + mps;
          this.pos[l] += this.vel[l] * dt;
        }
      }
      return this.depoisDeAndar(agora);
    }

    depoisDeAndar(agora) {
      const c = this.config;
      const saida = [];
      const [a, b] = this.pos;
      if (a >= c.pista || b >= c.pista) {
        const vencedor = a >= b ? 0 : 1;
        this.fase = "chegou";
        this.serie[vencedor]++;
        saida.push({ tipo: "chegada", vencedor, tempo: this.tempo });
        return saida;
      }
      const lider = a > b ? 0 : b > a ? 1 : -1;
      if (lider >= 0 && lider !== this.liderAtual) {
        if (this.liderAtual >= 0 && Math.max(a, b) >= 50 && agora - this.ultrapassouEm >= 3000) {
          saida.push({ tipo: "ultrapassagem", lado: lider });
          this.ultrapassouEm = agora;
        }
        this.liderAtual = lider;
      }
      if (lider >= 0) {
        const atras = 1 - lider;
        const distancia = this.pos[lider] - this.pos[atras];
        if (distancia >= c.encostou.de) this.encostouAberto[atras] = true;
        else if (distancia <= c.encostou.para && this.encostouAberto[atras]) {
          this.encostouAberto[atras] = false;
          saida.push({ tipo: "encostou", lado: atras });
        }
      }
      if (!this.avisouRetaFinal && Math.max(a, b) >= c.pista * c.retaFinal) {
        this.avisouRetaFinal = true;
        saida.push({ tipo: "retaFinal" });
      }
      return saida;
    }

    lider() { return this.pos[0] > this.pos[1] ? 0 : this.pos[1] > this.pos[0] ? 1 : -1; }

    mvp(lado) {
      return [...this.doadores[lado].values()].sort((x, y) => y.moedas - x.moedas || x.desde - y.desde)[0] || null;
    }
  }

  /* `lados` do preset troca campos de cada candidato da lista comum (nome,
     comandos, parceiro de chapa) sem mexer na lista que a Urna também usa. */
  function candidatosDoPreset(lista, lados = []) {
    return lista.map((c, i) => ({ ...c, ...(lados[i] || {}) }));
  }

  raiz.Corrida = Corrida;
  raiz.candidatosDoPreset = candidatosDoPreset;
  if (typeof module !== "undefined") module.exports = { Corrida, candidatosDoPreset };
})(typeof window !== "undefined" ? window : globalThis);
