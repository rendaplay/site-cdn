/* Liga as peças: eventos → regras → tela, e o relógio da rodada.
   Fases: "rodada" (relógio correndo) e "vitoria" (tela do vencedor; os
   presentes desse intervalo já contam pra rodada seguinte). */
"use strict";

const { chave, config, opcoes } = Config.carregar();
const batalha = new Batalha(config);

const Jogo = {
  fase: "rodada",
  fimEm: 0,
  pausadoCom: null,
  prorrogacao: false,
  prorrogacoes: 0,
  ultimoSegundo: null,
  demo: false,

  iniciar() {
    Som.ligado = config.som !== false;
    Som.volume = Math.max(0, Math.min(1, (config.volume ?? 50) / 100));
    Tela.montar(config, opcoes.formato);
    Painel.montar(chave, config);
    this.novoRelogio(config.rodada.segundos);
    Tela.placar(batalha);
    Tela.sinal(false, true);

    if (opcoes.demo) this.ligarDemo();
    else {
      setTimeout(() => { if (!Conector.ligado && !this.demo) Tela.sinal(false, false); }, 3000);
      Conector.iniciar(opcoes.porta, {
        aoEvento: p => this.receber(p),
        aoSinal: ok => Tela.sinal(ok, this.demo),
      });
    }
    addEventListener("keydown", e => this.tecla(e));
    setInterval(() => this.relogio(), 100);
    /* O placar também tem coisa que expira sozinha (sequência de 25 s). */
    setInterval(() => Tela.placar(batalha), 1000);
  },

  ligarDemo() {
    this.demo = true;
    Tela.sinal(true, true);
    Demo.iniciar(config, p => this.receber(p), () => batalha.fracao(0));
  },

  receber(p) {
    const u = p.user || {};
    const d = p.data || {};
    const quem = { id: u.id, nick: u.nickname, avatar: u.avatar };
    let acontecimentos;
    if (p.type === "bridge_status") return this.aoStatus(d);
    /* O conector só avisa "mock" uma vez, ao subir; se o jogo abriu
       depois, reconhece a simulação pelo id dos espectadores falsos. */
    if (!batalha.ladoSimulado && /^mock\d+$/.test(u.id)) this.aoStatus({ mode: "mock" });
    if (p.type === "gift") {
      const qtd = Math.max(1, Number(d.count) || 1);
      const moedas = Number(d.total_coins) || (Number(d.coins) || 0) * qtd;
      acontecimentos = batalha.presente({ ...quem, presente: d.name, quantidade: qtd, moedas });
    } else if (p.type === "chat") {
      acontecimentos = batalha.comentario({ ...quem, texto: d.text });
    } else if (p.type === "like") {
      acontecimentos = batalha.curtida({ ...quem, curtidas: Number(d.count) || 1 });
    } else if (p.type === "follow") {
      acontecimentos = batalha.seguiu(quem);
    } else return;
    Tela.contar(acontecimentos, batalha);
  },

  /* `conector.py --mock` não tem quem comente 1/2 nem quem mande o
     presente do lado B. Cada espectador falso torce por um lado fixo
     (pelo id), senão a simulação seria só lado A. */
  aoStatus(d) {
    if (d.mode === "mock") batalha.ladoSimulado = id => hashTexto(id) % 2;
    else if (d.mode === "live") batalha.ladoSimulado = null;
  },

  novoRelogio(segundos) {
    this.fimEm = performance.now() + segundos * 1000;
    this.ultimoSegundo = null;
  },

  restante() {
    return ((this.pausadoCom ?? (this.fimEm - performance.now())) / 1000);
  },

  relogio() {
    if (this.pausadoCom != null) return;
    const seg = this.restante();

    if (this.fase === "vitoria") {
      if (config.rodada.automatica) {
        Tela.contagemVitoria(seg);
        if (seg <= 0) this.proximaRodada();
      }
      return;
    }

    const dobro = batalha.tique();
    if (dobro.length) Tela.contar(dobro, batalha);

    /* Rodada sem presente recomeça calada: 3-2-1 pra nada só confunde. */
    const final = seg <= 10.05 && seg > 0 && batalha.total() > 0;
    Tela.tempo(seg, { numero: batalha.numero, prorrogacao: this.prorrogacao, final });
    const inteiro = Math.ceil(seg);
    if (final && inteiro !== this.ultimoSegundo) {
      this.ultimoSegundo = inteiro;
      Tela.contagem(inteiro);
    }
    if (seg <= 0) this.fimDoTempo();
  },

  fimDoTempo() {
    Tela.contagem(null);
    const passo = batalha.fimDoTempo(this.prorrogacoes);
    if (passo === "recomecar") this.novoRelogio(config.rodada.segundos);
    else if (passo === "prorrogar") {
      this.prorrogacao = true;
      this.prorrogacoes++;
      this.novoRelogio(config.rodada.prorrogacao || 20);
    } else this.encerrar();
  },

  encerrar() {
    if (!batalha.total()) return this.zerar();
    const r = batalha.encerrar();
    this.fase = "vitoria";
    this.prorrogacao = false;
    this.prorrogacoes = 0;
    Tela.tempo(0, { numero: r.numero });
    batalha.novaRodada();
    Tela.fimDeRodada(r, config.rodada.automatica ? config.rodada.vitoria : null, batalha);
    Tela.placar(batalha);
    this.novoRelogio(config.rodada.vitoria);
  },

  proximaRodada() {
    if (Tela.fechando) return;
    this.fase = "rodada";
    Tela.fecharVitoria();
    this.novoRelogio(config.rodada.segundos);
  },

  zerar() {
    batalha.numero--;
    batalha.novaRodada();
    Torres.zerar();
    this.prorrogacao = false;
    this.prorrogacoes = 0;
    Tela.contagem(null);
    Tela.placar(batalha);
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
    const id = "teste" + Math.floor(Math.random() * 6);
    this.receber({
      type: "gift",
      user: { id, nickname: id, avatar: null },
      data: { name: config.lados[lado].presente.aceitos[0], count: 1, coins: moedas, total_coins: moedas },
    });
  },

  tecla(e) {
    if (Painel.aberto()) {
      if (e.key === "Escape") Painel.alternar(false);
      return;
    }
    const k = e.key.toLowerCase();
    if (k === "p") { e.preventDefault(); Painel.alternar(true); }
    else if (k === " ") { e.preventDefault(); this.pausar(); }
    else if (k === "n") this.fase === "vitoria" ? this.proximaRodada() : this.encerrar();
    else if (k === "r") { if (this.fase === "vitoria") this.proximaRodada(); this.zerar(); }
    else if (k === "f") Tela.alternarFormato();
    else if (k === "s") { Som.ligado = !Som.ligado; Som.tique(false); }
    else if (k === "d" && !this.demo) this.ligarDemo();
    else if (k === "1" || k === "2") this.presenteTeste(Number(k) - 1);
  },
};

Jogo.iniciar();
window.batalha = batalha;
window.Jogo = Jogo;
