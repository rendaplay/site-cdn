/* Liga as peças: live (comum/live.js) → Disputa (regras.js) → cena, HUD e
   som, mais as teclas de teste. O que acontece em sequência (bola na rede,
   grito, fanfarra) anda no relógio do jogo, então a pausa segura tudo junto. */
"use strict";

const { chave, config, opcoes } = Config.carregar();
const W = 1080;

const CHAT_DEMO = [
  "boa noite live", "kkkkkk", "kkkkkkkkk", "bate no canto", "pega goleiro", "aí sim", "eita", "que isso",
  "cheguei", "bora", "uuuuh", "nãooo", "🔥🔥🔥", "vai que é tua", "frango kkk", "olha a pressão",
];
const CANTOS_DEMO = ["esquerda", "direita", "meio", "esquerda alto", "direita baixo", "no angulo direita", "cavadinha", "rasteiro esquerda"];

/* Sorteio com semente (mulberry32): ?semente= repete a mesma disputa. */
function sorteio(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Cada pessoa da plateia falsa torce por um time fixo e às vezes pede o canto. */
function ladosDaDemo(times) {
  const lados = [];
  for (const t of times) {
    const ap = t.apelidos[0];
    const frases = [t.nome, ...t.apelidos, `vamo ${ap}`, `${ap} ${ap}`, ...CANTOS_DEMO.map(c => `${ap} ${c}`)];
    for (let i = 0; i < Math.max(1, Math.round(t.peso / 2)); i++) lados.push({ comentarios: frases });
  }
  return lados;
}

const Jogo = {
  pausado: false,
  agenda: [],

  iniciar() {
    Som.aplicar(config);
    this.palco = document.getElementById("palco");
    const aleatorio = opcoes.semente != null ? sorteio(opcoes.semente + 1) : Math.random;
    this.disputa = new Disputa(config, aleatorio);
    this.times = new Map(config.times.map(t => [t.id, t]));

    Cena.montar(document.getElementById("campo"), config);
    Hud.montar(this.palco, config);
    Painel.montar(chave, config);
    this.configurar = montarConfigurar({
      jogo: "penaltis",
      opcoes: () => config.faixas.map(f => f.nome),
      testar: presente => this.presenteTeste(presente),
      avancado: () => Painel.alternar(true),
    });
    this.aplicarFormato(true);

    addEventListener("resize", () => this.aplicarFormato());
    addEventListener("keydown", e => this.tecla(e));

    Hud.sinal("demo");
    setTimeout(() => { if (this.live.estado === "conectando") Hud.sinal("conectando"); }, 3000);
    this.live = conectarLive({
      demo: { ligado: false, comentarios: CHAT_DEMO, lados: ladosDaDemo(config.times), ...config.demo },
      aoEvento: ev => this.receber(ev),
      aoEstado: estado => { if (estado !== "conectando") Hud.sinal(estado); },
    });
    Hud.chamada("aguardando");
    Cena.ocioso(true);

    let antes = performance.now();
    const quadro = () => {
      const ms = performance.now();
      const dt = Math.min(0.5, Math.max(0, ms - antes) / 1000);
      antes = ms;
      this.quadro(dt, ms / 1000);
      requestAnimationFrame(quadro);
    };
    requestAnimationFrame(quadro);
  },

  /* Celular mais comprido que 9:16 (até 9:21): o palco cresce pra baixo em
     vez de sobrar faixa preta. */
  aplicarFormato(primeira = false) {
    const H = innerWidth && innerHeight ? Math.min(2520, Math.max(1920, Math.round(W * innerHeight / innerWidth))) : 1920;
    if (H !== this.altura || primeira) {
      this.altura = H;
      this.palco.style.height = `${H}px`;
      Cena.aplicarFormato(W, H);
    }
    const s = Math.min(innerWidth / W, innerHeight / H);
    this.palco.style.transform = `translate(${(innerWidth - W * s) / 2}px, ${(innerHeight - H * s) / 2}px) scale(${s})`;
  },

  time(id) { return this.times.get(id) || null; },
  sigla(id) { const t = this.time(id); return t ? t.sigla : ""; },
  nomeTime(id) { const t = this.time(id); return t ? t.nome.toUpperCase() : ""; },

  /* ───────── live ───────── */

  receber(ev) {
    const d = this.disputa;
    const quem = ev.usuario;
    if (ev.tipo === "comentario") this.contar(d.comentario(quem, ev.texto));
    else if (ev.tipo === "curtida") this.contar(d.curtida(quem, ev.curtidas));
    else if (ev.tipo === "seguiu") this.contar(d.seguiu(quem));
    else if (ev.tipo === "compartilhou") this.contar(d.compartilhou(quem));
    else if (ev.tipo === "presente") {
      const pr = ev.presente;
      const faixa = this.configurar.faixa(pr.nome, pr.moedas);
      const lista = d.presente(quem, { nome: pr.nome, moedas: pr.total, quantidade: pr.quantidade, faixa });
      this.contar(lista);
    }
  },

  contar(lista) {
    for (const a of lista) {
      switch (a.tipo) {
        case "comentou": this.comentou(a); break;
        case "curtiu": Cena.festa(a.time, 0.35); break;
        case "pressaoCheia":
          Hud.faixa(`🔥 A torcida do ${this.nomeTime(a.time)} tá pressionando!`, "vermelha");
          Cena.nervoso(a.time);
          Som.onda();
          Som.falar("pressao");
          break;
        case "seguiu": this.seguiu(a); break;
        case "compartilhou":
          Hud.faixa(`📣 @${encurtar(a.nome, 16)} chamou a galera!`, "verde");
          Cena.confete(a.time, 30);
          Som.tocar("confete", { volume: 0.6 });
          break;
        case "presente": this.presente(a); break;
        case "aguardando":
          Hud.chamada("aguardando");
          Cena.ocioso(true);
          break;
        case "classico": this.classico(a); break;
        case "batedor": this.batedor(a); break;
        case "chute": this.chute(a); break;
        case "ocioso":
          Hud.esconderBatedor();
          Hud.chamada("ocioso", [a.a, a.b]);
          Cena.ocioso(true);
          Som.falar("ocioso");
          break;
        case "retomou":
          Hud.esconderChamada();
          Cena.ocioso(false);
          break;
        case "fim": this.fim(a); break;
        case "intervalo": break;
      }
    }
  },

  comentou(a) {
    const j = this.disputa.jogo;
    if (a.entrou) {
      Cena.festa(a.time, 0.6);
      if (Math.random() < 0.4) Som.bip(false);
    }
    if (a.canto && j && j.batedor && j.batedor.id === a.id) Hud.cantoPedido(a.canto);
    if (a.desafiante && this.disputa.fase !== "aquecimento") {
      const ranque = this.disputa.ranqueCitacoes([j.a, j.b]);
      const lider = ranque[0];
      /* Avisa quando um time novo assume a ponta dos desafiantes, não a cada comentário. */
      if (lider && lider.time !== this.desafiante) {
        this.desafiante = lider.time;
        Hud.faixa(`⚔️ ${this.nomeTime(lider.time)} quer desafiar o vencedor!`);
        Som.falar("desafiante");
      }
    }
    if (this.disputa.fase === "aquecimento") this.mostrarAquecimento();
  },

  /* Antes do primeiro clássico: a chamada mostra quem está na frente. */
  mostrarAquecimento() {
    const ranque = this.disputa.ranqueCitacoes();
    if (!ranque.length) return;
    Hud.chamada("aguardando", ranque.slice(0, 6).map(r => r.time));
  },

  seguiu(a) {
    Hud.faixa(`⭐ CHEGOU REFORÇO! @${encurtar(a.nome, 16)}`, "ouro");
    Cena.confete(a.time, 24);
    Som.tocar("confete", { volume: 0.5 });
    Som.falar("reforco");
  },

  presente(a) {
    Hud.presente({
      nome: a.nome, simbolo: simboloDoPresente(a.presente), quantidade: a.quantidade,
      efeito: a.efeito, time: a.time, desafiante: a.desafiante,
    });
    Som.subida(a.faixa);
    Cena.confete(a.time, 14 + a.faixa * 12);
    if (a.desafiante) {
      Cena.festa(a.time, 0.5);
      return;
    }
    if (a.aquecimento) {
      this.mostrarAquecimento();
      return;
    }
    Cena.festa(a.time, 0.5 + a.faixa * 0.12);
    if (a.furouFila) Hud.faixa(`⚡ @${encurtar(a.nome, 16)} furou a fila do ${this.nomeTime(a.time)}!`);
    if (a.faixa >= 3) {
      Som.tocar(a.faixa === 4 ? "fanfarra" : "jato", { volume: 0.6 });
      Som.onda();
    }
    if (a.faixa === 4) {
      Hud.faixa(`🏆 @${encurtar(a.nome, 16)} preparou um GOL DE PLACA pro ${this.nomeTime(a.time)}!`, "ouro");
      Cena.fogos(4);
    }
    Hud.filas(this.disputa.jogo);
  },

  classico(a) {
    Hud.esconderRanking();
    Hud.esconderChamada();
    Hud.esconderBatedor();
    Hud.classico(a.a, a.b, { revanche: a.revanche });
    Cena.ocioso(false);
    Cena.classico(this.time(a.a), this.time(a.b));
    this.desafiante = null;
    Som.tocar("apito");
    Som.onda();
    this.depois(0.5, () => Som.falar("classico"));
    Hud.filas(this.disputa.jogo);
  },

  batedor(a) {
    const j = this.disputa.jogo;
    Hud.esconderChamada();
    Hud.batedor(a);
    Hud.filas(j);
    const n = config.cobrancas;
    if (a.morteSubita) Hud.rotulo("Morte súbita", true);
    else Hud.rotulo(`Cobrança ${a.numeroCobranca} de ${n}`);
    Cena.batedor(a);
    Som.tocar("apito", { volume: 0.5, taxa: 1.15 });
    if (a.morteSubita && a.numeroCobranca === n + 1 && a.time === j.a) this.depois(0.4, () => Som.falar("mortesubita"));
    else if (this.decisiva(a)) this.depois(0.6, () => Som.falar("decisiva"));
    else if (Math.random() < 0.35) this.depois(0.8, () => Som.falar("prepara"));
    /* Rufar sobe junto com a corrida pra bola. */
    this.depois(Math.max(0, config.tempos.prepara - 1.4), () => Som.tocar("rufar", { volume: 0.45, taxa: 1.5 }));
  },

  /* Se fizer, ganha: o batedor tem a disputa no pé. */
  decisiva(a) {
    const j = this.disputa.jogo;
    const g = { ...j.gols }, c = { ...j.chutes };
    g[a.time]++;
    c[a.time]++;
    return decidida(g[j.a], g[j.b], c[j.a], c[j.b], config.cobrancas);
  },

  chute(a) {
    Cena.chute(a);
    Som.tocar("chute", { volume: 0.9 });
    const placa = a.efeito === "placa";
    const quando = Cena.tempoAteOResultado ? Cena.tempoAteOResultado(a) : 0.8;
    if (a.efeito === "fogo") Som.tocar("jato", { volume: 0.5, taxa: 1.3 });

    this.depois(quando, () => {
      const t = this.time(a.time);
      if (a.resultado === "gol") {
        Som.tocar("rede");
        Som.tocar("torcida-forte", { volume: 0.8 });
        Som.onda();
        const tipo = a.frango ? "frango" : placa ? "placa" : "gol";
        Hud.resultado(tipo, a.batedor.bot ? t.nome : `@${encurtar(a.batedor.nome, 16)}`);
        const fala = a.frango ? "frango" : placa ? "placa" : a.efeito === "fogo" ? "fogo" : a.cavadinha ? "cavadinha" : "gol";
        if (fala === "gol") Som.falar("gol", Math.random() < 0.5 ? a.time : null);
        else Som.falar(fala);
        if (a.frango) Som.tocar("escorregao", { volume: 0.7 });
        if (placa) {
          Som.tocar("fogos");
          Som.tocar("fanfarra", { volume: 0.7 });
        }
      } else if (a.resultado === "defesa") {
        Som.tocar("luva");
        Som.tocar("torcida-forte", { volume: 0.55 });
        Som.onda();
        Hud.resultado("defesa", a.paredao ? "Paredão!" : "");
        Som.falar("defesa");
      } else {
        if (a.resultado === "trave") Som.tocar("trave", { volume: 0.8 });
        Som.tocar("uuh", { volume: 0.8 });
        Hud.resultado(a.resultado);
        Som.falar(a.resultado);
      }
      Hud.placar(a);
      Hud.esconderBatedor();
    });
  },

  fim(a) {
    const vencedor = this.time(a.vencedor);
    Cena.fim(a);
    Som.tocar("apito");
    this.depois(0.4, () => {
      Som.tocar("fogos");
      Som.tocar("torcida-forte");
      Som.onda();
      Som.falar("campeao", Math.random() < 0.6 ? a.vencedor : null);
      Hud.faixa(`🏆 ${vencedor.nome.toUpperCase()} VENCE A DISPUTA!`, "ouro");
    });
    this.depois(1.6, () => Som.tocar("fanfarra", { volume: 0.7 }));
    this.depois(Math.min(3, config.tempos.fim - 1), () => {
      Hud.ranking(this.disputa, a.vencedor, a.gols);
      this.vencedor = a.vencedor;
    });
  },

  /* ───────── relógio ───────── */

  depois(seg, f) {
    this.agenda.push({ em: this.disputa.t + seg, f });
  },

  quadro(dt, agora) {
    const d = this.disputa;
    const dtJogo = this.pausado ? 0 : dt;
    this.contar(d.passo(dtJogo));
    if (this.agenda.length) {
      const prontos = this.agenda.filter(x => x.em <= d.t);
      this.agenda = this.agenda.filter(x => x.em > d.t);
      for (const x of prontos) x.f();
    }
    const j = d.jogo;
    if (j) Hud.pressao(j.pressao);
    if (j && (d.fase === "fim" || d.fase === "intervalo") && this.vencedor) {
      const desafiante = d.ranqueCitacoes([this.vencedor])[0];
      const fimIntervalo = d.fase === "intervalo" ? d.resta() : d.resta() + config.tempos.intervalo;
      Hud.proxima(fimIntervalo, desafiante && desafiante.time, this.vencedor);
    }
    Cena.quadro(Math.min(0.05, dtJogo), agora, { fase: d.fase, pressao: j ? j.pressao : null });
  },

  /* ───────── teclas e testes ───────── */

  testeId: 0,
  testador() {
    const ids = ["teste.ana", "teste.beto", "teste.cida", "teste.dudu", "teste.edu", "teste.fefe"];
    return { id: ids[this.testeId++ % ids.length], nome: nomeDeTeste() };
  },

  /* O presente de teste vai pra um time em campo: o testador comenta o time
     antes, senão o presente iria pro time que está perdendo. */
  presenteTeste(presente) {
    const usuario = this.testador();
    const j = this.disputa.jogo;
    const ids = j ? [j.a, j.b] : config.times.map(t => t.id);
    const t = this.time(ids[Math.floor(Math.random() * ids.length)]);
    this.live.simular({ tipo: "comentario", usuario, texto: t.apelidos[0] });
    this.live.simular({ tipo: "presente", usuario, presente });
  },

  tecla(e) {
    if (Painel.aberto()) {
      if (e.key === "Escape") Painel.alternar(false);
      return;
    }
    const k = e.key.toLowerCase();
    const digito = /^Digit([1-5])$/.exec(e.code);
    if (digito) {
      const m = config.faixas[Number(digito[1]) - 1].moedas;
      this.presenteTeste({ nome: "Rose", moedas: m, quantidade: 1, total: m });
      return;
    }
    const j = this.disputa.jogo;
    if (k === "p") { e.preventDefault(); Painel.alternar(true); }
    else if (e.key === "Enter") { this.pausado = !this.pausado; this.palco.querySelector(".pausa").hidden = !this.pausado; }
    else if (k === "s") Som.alternar();
    else if (k === "e") this.disputa.encerrar();
    else if (k === "d") this.live.ligarDemo();
    else if (k === "r") this.zerar();
    else if (k === "f") {
      const nome = "fã" + Math.floor(Math.random() * 400);
      this.live.simular({ tipo: "seguiu", usuario: { id: nome, nome } });
    } else if (k === "c" && j) {
      const id = [...this.disputa.pessoas.values()].find(p => p.time === j.a || p.time === j.b);
      if (id) this.live.simular({ tipo: "curtida", usuario: { id: id.id, nome: id.nome }, curtidas: 40 });
    } else if (k === "t") {
      const ids = j ? [j.a, j.b, config.times[Math.floor(Math.random() * config.times.length)].id] : config.times.map(t => t.id);
      for (let i = 0; i < 10; i++) {
        const nome = "espectador" + Math.floor(Math.random() * 400);
        const t = this.time(ids[Math.floor(Math.random() * ids.length)]);
        const canto = Math.random() < 0.4 ? " " + CANTOS_DEMO[Math.floor(Math.random() * CANTOS_DEMO.length)] : "";
        this.live.simular({ tipo: "comentario", usuario: { id: nome, nome }, texto: t.apelidos[0] + canto });
      }
    }
  },

  zerar() {
    this.disputa.zerar();
    this.agenda = [];
    this.vencedor = null;
    Hud.esconderRanking();
    Hud.esconderBatedor();
    Hud.chamada("aguardando");
    Cena.ocioso(true);
  },
};

/* A cena e o HUD desenham com a Lilita One: espera a fonte pra não sair o
   primeiro quadro (e a capa) com a letra de reserva. */
document.fonts.load('40px "Lilita One"').catch(() => {}).finally(() => {
  Jogo.iniciar();
  window.Jogo = Jogo;
});
