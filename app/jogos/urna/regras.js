/* Regras da Urna Eletrônica: cada moeda de presente é um voto pro lado da
   pessoa (lado decidido por comum/eleicao/lados.js). Sem DOM e sem relógio
   próprio, pra rodar igual no navegador e no node --test. */
"use strict";

(function (raiz) {
  const LadosClasse = raiz.Lados || (typeof require !== "undefined" ? require("../comum/eleicao/lados.js").Lados : null);

  class Urna {
    constructor(config, candidatos) {
      this.config = config;
      this.lados = new LadosClasse(candidatos, config);
      this.numero = 0;
      this.serie = [0, 0];
      this.novaRodada();
    }

    novaRodada() {
      this.numero++;
      this.votos = [0, 0];
      this.doadores = [new Map(), new Map()];
      this.lider = -1;
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
      else if (p.type === "like") saida = this.lados.curtida({ ...quem, curtidas: Number(d.count) || 1, agora }, l => this.votos[l]);
      else if (p.type === "follow") saida = this.lados.seguiu(quem, l => this.votos[l]);
      else return [];
      return saida.flatMap(a => (a.tipo === "entrada" ? this.votar(a, agora) : [a]));
    }

    votar(e, agora) {
      this.votos[e.lado] += e.pontos;
      if (e.fonte === "presente") {
        const d = this.doadores[e.lado].get(e.quem.id) || { ...e.quem, votos: 0, desde: agora };
        d.nick = e.quem.nick;
        d.avatar = e.quem.avatar || d.avatar;
        d.votos += e.pontos;
        this.doadores[e.lado].set(e.quem.id, d);
      }
      const massa = e.fonte === "presente" && (e.faixa === 1 || (e.faixa !== 0 && e.pontos >= this.config.massa));
      const saida = [{ tipo: "voto", lado: e.lado, quem: e.quem, votos: e.pontos, presente: e.presente, quantidade: e.quantidade, liberado: e.liberado, fonte: e.fonte, massa }];
      const agoraLider = this.liderAgora();
      if (agoraLider >= 0 && agoraLider !== this.lider) {
        if (this.lider >= 0 && this.total() >= (this.config.viradaMinima || 0)) saida.push({ tipo: "virada", lado: agoraLider, quem: e.quem });
        this.lider = agoraLider;
      }
      return saida;
    }

    total() { return this.votos[0] + this.votos[1]; }

    liderAgora() {
      const [a, b] = this.votos;
      return a > b ? 0 : b > a ? 1 : -1;
    }

    porcentagens() {
      const [a, b] = this.votos;
      if (!a && !b) return [50, 50];
      let pa = Math.round((a / (a + b)) * 100);
      if (a && b) pa = Math.min(99, Math.max(1, pa));
      return [pa, 100 - pa];
    }

    top(lado, n = 3) {
      return [...this.doadores[lado].values()].sort((x, y) => y.votos - x.votos || x.desde - y.desde).slice(0, n);
    }

    fimDoTempo(prorrogacoes = 0) {
      if (!this.total()) return "recomecar";
      if (this.liderAgora() >= 0) return "encerrar";
      return prorrogacoes >= (this.config.rodada.prorrogacoesMax ?? 3) ? "encerrar" : "prorrogar";
    }

    encerrar() {
      const vencedor = this.liderAgora();
      if (vencedor >= 0) this.serie[vencedor]++;
      return {
        vencedor,
        votos: [...this.votos],
        porcentagens: this.porcentagens(),
        mvp: vencedor >= 0 ? this.top(vencedor, 1)[0] || null : null,
        numero: this.numero,
        serie: [...this.serie],
      };
    }
  }

  raiz.Urna = Urna;
  if (typeof module !== "undefined") module.exports = { Urna };
})(typeof window !== "undefined" ? window : globalThis);
