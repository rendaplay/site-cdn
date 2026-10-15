/* Liga as peças: live → regras → tela, e o relógio da rodada.
   Fases: "rodada" (relógio correndo) → "apuracao" → "vitoria" → nova
   rodada. A rodada já é zerada quando a apuração começa: presente que
   chega nesse intervalo conta pra próxima eleição. */
"use strict";

const { chave, config, opcoes } = Config.carregar();
const candidatos = window[config.candidatos] || window.CANDIDATOS;

/* A plateia de demonstração do live.js entrega o evento já normalizado;
   as regras falam o pacote do conector. */
const TIPO_DO_PACOTE = { presente: "gift", comentario: "chat", curtida: "like", seguiu: "follow", compartilhou: "share" };
function pacoteDe(ev) {
  const user = { id: ev.usuario.id, nickname: ev.usuario.nome, avatar: ev.usuario.foto };
  const pr = ev.presente || {};
  const data = ev.tipo === "presente" ? { name: pr.nome, coins: pr.moedas, count: pr.quantidade, total_coins: pr.total }
    : ev.tipo === "comentario" ? { text: ev.texto }
    : ev.tipo === "curtida" ? { count: ev.curtidas } : {};
  return { type: TIPO_DO_PACOTE[ev.tipo], user, data };
}

const Jogo = {
  fase: "rodada",
  fimEm: 0,
  pausadoCom: null,
  prorrogacao: false,
  prorrogacoes: 0,
  ultimoSegundo: null,
  resultado: null,

  iniciar() {
    this.urna = new Urna({ ...config, faixa: (nome, moedas) => this.configurar.faixa(nome, moedas) }, candidatos);
    window.urna = this.urna;
    Tela.montar(config, opcoes.formato, candidatos, config.arte);
    Painel.montar(chave, config);
    this.configurar = montarConfigurar({
      jogo: "urna",
      opcoes: () => ["Voto", "Voto em massa"],
      testar: p => this.enviarTeste({ name: p.nome, count: p.quantidade, coins: p.moedas, total_coins: p.total }),
      avancado: () => Painel.alternar(true),
    });

    Vozes.iniciar({ volume: (config.volume ?? 80) / 100, efeitos: ["rufar", "confete", "fanfarra", "urna-confirma", "tecla"] });
    Vozes.ligado = config.som !== false;
    Vozes.musica("musica-urna", (config.musica ?? 100) / 100);
    Vozes.falar("entrada", "narrador");

    this.novoRelogio(config.rodada.segundos);
    Tela.placar(this.urna);

    this.live = conectarLive({
      ws: `ws://127.0.0.1:${opcoes.porta}`,
      demo: {
        ligado: opcoes.demo,
        presentes: [
          { nome: "Rose", moedas: 1, peso: 30, lado: 0 },
          { nome: "White Rose", moedas: 1, peso: 30, lado: 1 },
          { nome: "Doughnut", moedas: 30, peso: 4 },
          { nome: "Hand Heart", moedas: 100, peso: 1 },
          { nome: "Galaxy", moedas: 1000, peso: 0.2 },
        ],
        lados: [{ comentarios: ["13", "lula"] }, { comentarios: ["22", "flavio"] }],
      },
      aoPacote: p => this.receber(p),
      aoEvento: (ev, live) => { if (live.modo === "demo") this.receber(pacoteDe(ev)); },
      aoEstado: e => Tela.sinal(e),
    });
    Tela.sinal(this.live.estado);

    addEventListener("keydown", e => this.tecla(e));
    setInterval(() => this.relogio(), 100);
  },

  receber(p) {
    if (p.type === "bridge_status") return this.aoStatus(p.data || {});
    /* O conector só avisa "mock" uma vez, ao subir; se o jogo abriu
       depois, reconhece a simulação pelo id dos espectadores falsos. */
    if (!this.urna.lados.ladoSimulado && /^mock\d+$/.test((p.user || {}).id)) this.aoStatus({ mode: "mock" });
    Tela.contar(this.urna.receber(p), this.urna);
  },

  /* `conector.py --mock` não tem quem comente 13/22 nem quem mande a rosa
     branca: cada espectador falso torce por um lado fixo, pelo id. */
  aoStatus(d) {
    if (d.mode === "mock") this.urna.lados.ladoSimulado = id => hashTexto(id) % 2;
    else if (d.mode === "live") this.urna.lados.ladoSimulado = null;
  },

  novoRelogio(segundos) {
    this.fimEm = performance.now() + segundos * 1000;
    this.ultimoSegundo = null;
  },

  restante() {
    return (this.pausadoCom ?? (this.fimEm - performance.now())) / 1000;
  },

  relogio() {
    if (this.pausadoCom != null) return;
    const seg = this.restante();

    if (this.fase === "apuracao") {
      if (seg <= 0) this.mostrarEleito();
      return;
    }
    if (this.fase === "vitoria") {
      if (config.rodada.automatica) {
        Tela.contagemVitoria(seg);
        if (seg <= 0) this.proximaRodada();
      }
      return;
    }

    /* Rodada sem voto recomeça calada: contagem pra nada só confunde. */
    const final = seg <= 10.05 && seg > 0 && this.urna.total() > 0;
    Tela.tempo(seg, { numero: this.urna.numero, prorrogacao: this.prorrogacao, final });
    const inteiro = Math.ceil(seg);
    if (final && inteiro !== this.ultimoSegundo) {
      this.ultimoSegundo = inteiro;
      if (inteiro === 10) Vozes.falar("retaFinal", "narrador");
      if (inteiro === 5) Vozes.efeito("rufar");
    }
    if (seg <= 0) this.fimDoTempo();
  },

  fimDoTempo() {
    const passo = this.urna.fimDoTempo(this.prorrogacoes);
    if (passo === "recomecar") this.novoRelogio(config.rodada.segundos);
    else if (passo === "prorrogar") {
      this.prorrogacao = true;
      this.prorrogacoes++;
      this.novoRelogio(config.rodada.prorrogacao || 20);
    } else this.encerrar();
  },

  encerrar() {
    if (this.fase !== "rodada") return;
    if (!this.urna.total()) return this.zerar();
    const r = this.urna.encerrar();
    this.resultado = r;
    this.fase = "apuracao";
    this.prorrogacao = false;
    this.prorrogacoes = 0;
    Tela.tempo(0, { numero: r.numero });
    this.live.anotar(`fase: apuração da rodada ${r.numero}`, true);
    this.urna.novaRodada();
    Urnas.zerar();
    Tela.apuracao(r);
    Tela.placar(this.urna);
    this.novoRelogio(Math.max(4.6, config.rodada.apuracao || 6));
  },

  mostrarEleito() {
    this.fase = "vitoria";
    this.live.anotar("fase: eleito", true);
    const auto = config.rodada.automatica;
    Tela.eleito(this.resultado, auto ? config.rodada.vitoria : null);
    this.novoRelogio(config.rodada.vitoria);
  },

  proximaRodada() {
    if (this.fase === "apuracao") this.mostrarEleito();
    this.fase = "rodada";
    this.live.anotar("fase: nova rodada", true);
    Tela.fecharEleito();
    this.novoRelogio(config.rodada.segundos);
    Vozes.falar("largada", "narrador");
  },

  zerar() {
    this.urna.numero--;
    this.urna.novaRodada();
    Urnas.zerar();
    this.prorrogacao = false;
    this.prorrogacoes = 0;
    Tela.placar(this.urna);
    this.novoRelogio(config.rodada.segundos);
  },

  pausar() {
    if (this.pausadoCom == null) this.pausadoCom = this.fimEm - performance.now();
    else {
      this.fimEm = performance.now() + this.pausadoCom;
      this.pausadoCom = null;
    }
    Tela.pausa(this.pausadoCom != null);
  },

  presenteTeste(lado) {
    const valores = [1, 1, 5, 10, 30, 99, 199, 500, 1000];
    const moedas = valores[Math.floor(Math.random() * valores.length)];
    this.enviarTeste({ name: candidatos[lado].presente.aceitos[0], count: 1, coins: moedas, total_coins: moedas });
  },

  enviarTeste(data) {
    const id = "teste" + Math.floor(Math.random() * 6);
    this.receber({ type: "gift", user: { id, nickname: id, avatar: null }, data });
  },

  tecla(e) {
    if (e.ctrlKey || e.metaKey) return;
    if (Painel.aberto()) {
      if (e.key === "Escape") Painel.alternar(false);
      return;
    }
    if (e.target && /input|select|textarea/i.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === "p") { e.preventDefault(); Painel.alternar(true); }
    else if (k === " ") { e.preventDefault(); this.pausar(); }
    else if (k === "n") this.fase === "rodada" ? this.encerrar() : this.proximaRodada();
    else if (k === "r") { if (this.fase !== "rodada") this.proximaRodada(); this.zerar(); }
    else if (k === "f") Tela.alternarFormato();
    else if (k === "s") {
      Vozes.alternar();
      if (Vozes.ligado && !Vozes._musica) Vozes.musica("musica-urna", (config.musica ?? 100) / 100);
    }
    else if (k === "d" && this.live.modo !== "demo") this.live.ligarDemo();
    else if (k === "1" || k === "2") this.presenteTeste(Number(k) - 1);
  },
};

Jogo.iniciar();
window.Jogo = Jogo;
