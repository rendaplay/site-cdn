/* Liga as peças: live (comum/live.js) → Embaixadinha (regras.js) → cena,
   HUD e som, mais as teclas de teste. As sequências andam em passo fixo
   dentro do regras.js; aqui o quadro só entrega o tempo e desenha. O que
   acontece em sequência (fanfarra, ranking) anda no relógio do jogo, então
   a pausa segura tudo junto. */
"use strict";

const { chave, config, opcoes } = Config.carregar();
const LARGURA_PALCO = 1080;

const CHAT_DEMO = [
  "boa noite live", "kkkkkk", "kkkkkkkkk", "que habilidade", "olha o craque", "aí sim", "eita", "que isso",
  "cheguei", "bora", "uuuuh", "nãooo", "🔥🔥🔥", "não deixa cair", "quase caiu kkk", "segura essa bola",
];
const TRUQUES_DEMO = ["lambreta", "chapeu", "chapéu", "bicicleta", "calcanhar", "ombro"];

/* Sorteio com semente (mulberry32): ?semente= repete a mesma live. */
function sorteio(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Cada pessoa da plateia falsa torce por um time fixo e às vezes pede truque. */
function ladosDaDemo(times) {
  const lados = [];
  for (const t of times) {
    const ap = t.apelidos[0];
    const frases = [t.nome, ...t.apelidos, `vamo ${ap}`, `${ap} ${ap}`, `sobe ${ap}`, `${ap} ${ap} ${ap}`, ...TRUQUES_DEMO];
    for (let i = 0; i < Math.max(1, Math.round(t.peso / 2)); i++) lados.push({ comentarios: frases });
  }
  return lados;
}

const Jogo = {
  pausado: false,
  agenda: [],
  posicoes: [],

  iniciar() {
    Som.aplicar(config);
    this.palco = document.getElementById("palco");
    const aleatorio = opcoes.semente != null ? sorteio(opcoes.semente + 1) : Math.random;
    this.partida = new Embaixadinha(config, aleatorio);
    this.times = new Map(config.times.map(t => [t.id, t]));

    Cena.montar(document.getElementById("campo"), config);
    Hud.montar(this.palco, config);
    Painel.montar(chave, config);
    this.configurar = montarConfigurar({
      jogo: "embaixadinha",
      opcoes: () => config.faixas.map(f => f.nome),
      testar: presente => this.presenteTeste(presente),
      avancado: () => Painel.alternar(true),
      regras: [
        "Cada time tem um craque fazendo embaixadinha. Comentou o time: é um toque, e o @ salta da bola.",
        "O fôlego cai sozinho, mais rápido quanto maior a sequência. Zerou, a bola cai e recomeça do zero.",
        "Escreveu \"lambreta\", \"chapéu\", \"bicicleta\", \"calcanhar\" ou \"ombro\": truque que vale +5.",
        "Curtidas enchem o fôlego. Quem segue traz um reforço e cada toque vale 2.",
        "Rodada de 2 min: a maior sequência vence e pega o time mais comentado de fora.",
      ],
      efeitos: () => [
        "bola brilhante, +3 toques",
        "câmera lenta: não perde fôlego",
        "vento no rival: o fôlego dele cai em dobro",
        "bola de fogo, +25 toques",
        "show do craque: +50 e bola blindada",
      ],
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
    const W = LARGURA_PALCO;
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
  nomeTime(id) { const t = this.time(id); return t ? t.nome.toUpperCase() : ""; },

  /* ───────── live ───────── */

  receber(ev) {
    const d = this.partida;
    const quem = ev.usuario;
    if (ev.tipo === "comentario") this.contar(d.comentario(quem, ev.texto));
    else if (ev.tipo === "curtida") this.contar(d.curtida(quem, ev.curtidas));
    else if (ev.tipo === "seguiu") this.contar(d.seguiu(quem));
    else if (ev.tipo === "compartilhou") this.contar(d.compartilhou(quem));
    else if (ev.tipo === "presente") {
      const pr = ev.presente;
      const faixa = this.configurar.faixa(pr.nome, pr.moedas);
      this.contar(d.presente(quem, { nome: pr.nome, moedas: pr.total, quantidade: pr.quantidade, faixa }));
    }
  },

  contar(lista) {
    for (const a of lista) {
      switch (a.tipo) {
        case "comentou": this.comentou(a); break;
        case "toque": this.toque(a); break;
        case "truque": this.truque(a); break;
        case "marco": this.marco(a); break;
        case "recorde": this.recorde(a); break;
        case "caiu": this.caiu(a); break;
        case "recomecou":
          Cena.recomecou(a);
          Hud.recomecou(a);
          break;
        case "curtiu": Cena.festa(a.time, 0.2); break;
        case "reforco": this.reforco(a); break;
        case "fimReforco": break;
        case "seguiu":
          Hud.faixa(`⭐ @${encurtar(a.nome, 16)} chegou!`, "ouro");
          Som.tocar("confete", { volume: 0.5 });
          break;
        case "compartilhou":
          Hud.faixa(`📣 @${encurtar(a.nome, 16)} chamou a galera!`, "verde");
          Cena.confete(a.time, 45);
          Som.tocar("confete", { volume: 0.6 });
          break;
        case "presente": this.presente(a); break;
        case "efeito": this.efeito(a); break;
        case "acabou":
          if (a.efeito === "show") Hud.esconderTelao();
          break;
        case "aguardando":
          Hud.chamada("aguardando");
          Cena.ocioso(true);
          break;
        case "classico": this.classico(a); break;
        case "valendo":
          Som.tocar("apito", { volume: 0.4, taxa: 1.15 });
          break;
        case "ocioso":
          Hud.chamada("ocioso", [a.a, a.b]);
          Hud.esconderTelao();
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
    const d = this.partida, j = d.jogo;
    if (a.desafiante && d.fase !== "aquecimento" && j) {
      const lider = d.ranqueCitacoes([j.a, j.b])[0];
      /* Avisa quando um time novo assume a ponta dos desafiantes, não a cada comentário. */
      if (lider && lider.time !== this.desafiante) {
        this.desafiante = lider.time;
        Hud.faixa(`⚔️ ${this.nomeTime(lider.time)} quer desafiar o vencedor!`);
        Som.falar("desafiante");
      }
    }
    if (d.fase === "aquecimento") this.mostrarAquecimento();
  },

  /* Antes do primeiro clássico: a chamada mostra quem está na frente. */
  mostrarAquecimento() {
    const ranque = this.partida.ranqueCitacoes();
    if (!ranque.length) return;
    Hud.chamada("aguardando", ranque.slice(0, 6).map(r => r.time));
  },

  /* O som do toque segue a parte do corpo onde a bola acabou de bater. */
  toque(a) {
    Cena.toque(a);
    Hud.toque(a);
    const j = this.partida.jogo;
    const s = j && j.lados[a.time] && j.lados[a.time].salto;
    const parte = s ? s.de : "peD";
    const som = parte === "cabeca" ? "cabeca" : parte.startsWith("coxa") ? "coxa" : "pe";
    Som.curto(som, a.origem === "comentario" ? 0.8 : 0.55, a.origem === "fogo" ? 70 : 45);
  },

  truque(a) {
    Cena.truque(a);
    Hud.truque(a);
    Som.tocar("truque", { volume: 0.8 });
    this.depois(0.5, () => { Som.tocar("ole", { volume: 0.7 }); Som.onda(); });
    if (Math.random() < 0.5) this.depois(0.9, () => Som.falar("truque"));
  },

  marco(a) {
    Cena.marco(a);
    Hud.faixa(`🔥 ${a.n} TOQUES DO ${this.nomeTime(a.time)}!`, a.n >= 100 ? "ouro" : "");
    Som.tocar("torcida-forte", { volume: 0.7 });
    Som.onda();
    Som.falar("marco", Math.random() < 0.5 ? a.time : null, a.n);
  },

  recorde(a) {
    Cena.recorde(a);
    Hud.recorde(a);
    Som.tocar("fanfarra", { volume: 0.7 });
    Som.tocar("fogos", { volume: 0.8 });
    Som.onda();
    Som.falar("recorde");
  },

  caiu(a) {
    Cena.caiu(a);
    Hud.caiu(a);
    this.depois(0.35, () => Som.tocar("quique", { volume: 0.8 }));
    if (a.seq >= 5) Som.tocar("uuh", { volume: 0.6 });
    if (a.seq >= 15) this.depois(0.5, () => Som.falar("caiu"));
  },

  reforco(a) {
    Hud.faixa(`⭐ REFORÇO! @${encurtar(a.nome, 16)}`, "ouro");
    Cena.reforco(a);
    Som.tocar("confete", { volume: 0.5 });
    Som.falar("reforco");
  },

  presente(a) {
    Hud.presente({
      nome: a.nome, simbolo: simboloDoPresente(a.presente), quantidade: a.quantidade,
      efeito: a.efeito, forma: a.forma, time: a.time, desafiante: a.desafiante, semTime: a.semTime,
    });
    Som.subida(a.faixa);
    if (a.desafiante) { Cena.festa(a.time, 0.5); return; }
    if (a.aquecimento) { this.mostrarAquecimento(); return; }
    Cena.festa(a.time, 0.5 + a.faixa * 0.12);
  },

  /* O efeito começa quando sai da fila do time, não quando o presente chega. */
  efeito(a) {
    Cena.efeito(a);
    Hud.efeito(a);
    if (a.efeito === "brilho") {
      Som.tocar("confete", { volume: 0.4, taxa: 1.2 });
    } else if (a.efeito === "lento") {
      Hud.faixa(`🐢 CÂMERA LENTA NO ${this.nomeTime(a.time)}!`);
      Som.falar("lento");
    } else if (a.efeito === "vento") {
      Hud.faixa(`🌪️ VENTANIA NO ${this.nomeTime(a.rival)}!`);
      Som.tocar("vento", { volume: 0.8 });
      Som.falar("vento");
    } else if (a.efeito === "fogo") {
      Hud.faixa(`🔥 BOLA DE FOGO DO ${this.nomeTime(a.time)}!`, "vermelha");
      Som.tocar("jato", { volume: 0.6 });
      Som.onda();
      Som.falar("fogo");
    } else if (a.efeito === "show") {
      Hud.telao(a, 9);
      Som.tocar("fogos");
      Som.tocar("fanfarra", { volume: 0.7 });
      Som.onda();
      Som.falar("show");
    }
  },

  classico(a) {
    Hud.esconderRanking();
    Hud.esconderChamada();
    Hud.classico(a.a, a.b, { revanche: a.revanche });
    Cena.ocioso(false);
    Cena.classico(this.time(a.a), this.time(a.b));
    this.desafiante = null;
    this.vencedor = null;
    Som.tocar("apito");
    Som.onda();
    this.depois(0.5, () => Som.falar("classico"));
  },

  fim(a) {
    const vencedor = this.time(a.vencedor);
    Cena.fim(a);
    Hud.esconderTelao();
    Som.tocar("apito");
    this.depois(0.4, () => {
      Som.tocar("fogos");
      Som.tocar("torcida-forte");
      Som.onda();
      Som.falar("campeao", Math.random() < 0.6 ? a.vencedor : null);
      Hud.faixa(`🏆 ${vencedor.nome.toUpperCase()} VENCE!`, "ouro");
    });
    this.depois(1.6, () => Som.tocar("fanfarra", { volume: 0.7 }));
    this.depois(Math.min(3, config.tempos.fim - 1), () => {
      Hud.ranking(this.partida, a);
      this.vencedor = a.vencedor;
    });
  },

  /* ───────── relógio ───────── */

  depois(seg, f) {
    this.agenda.push({ em: this.partida.t + seg, f });
  },

  quadro(dt, agora) {
    const d = this.partida;
    const dtJogo = this.pausado ? 0 : dt;
    this.contar(d.passo(dtJogo));
    if (this.agenda.length) {
      const prontos = this.agenda.filter(x => x.em <= d.t);
      this.agenda = this.agenda.filter(x => x.em > d.t);
      for (const x of prontos) x.f();
    }
    const j = d.jogo;
    Hud.atualizar(j, d.fase, d.t, d.recorde);
    if (j && (d.fase === "fim" || d.fase === "intervalo") && this.vencedor) {
      const desafiante = d.ranqueCitacoes([this.vencedor])[0];
      const fimIntervalo = d.fase === "intervalo" ? d.resta() : d.resta() + config.tempos.intervalo;
      Hud.proxima(fimIntervalo, desafiante && desafiante.time, this.vencedor);
    }
    Cena.quadro(Math.min(0.05, dtJogo), agora, { fase: d.fase, alfa: d.alfa, jogo: j, t: d.t });
    Hud.posicionar(Cena.rotulos(this.posicoes), j, d.fase);
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
    const j = this.partida.jogo;
    const ids = j ? [j.a, j.b] : config.times.map(t => t.id);
    const t = this.time(ids[Math.floor(Math.random() * ids.length)]);
    this.live.simular({ tipo: "comentario", usuario, texto: t.apelidos[0] });
    this.live.simular({ tipo: "presente", usuario, presente });
  },

  /* Alguém que já comentou um dos times em campo. */
  alguemEmCampo() {
    const j = this.partida.jogo;
    if (!j) return null;
    const lista = [...this.partida.pessoas.values()].filter(p => p.time === j.a || p.time === j.b);
    return lista[Math.floor(Math.random() * lista.length)] || null;
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
    const j = this.partida.jogo;
    const nomeFalso = () => { const n = "fã" + Math.floor(Math.random() * 400); return { id: n, nome: n }; };
    const daqui = p => (p ? { id: p.id, nome: p.nome } : nomeFalso());
    if (k === "p") { e.preventDefault(); Painel.alternar(true); }
    else if (e.key === "Enter") { this.pausado = !this.pausado; this.palco.querySelector(".pausa").hidden = !this.pausado; }
    else if (k === "s") Som.alternar();
    else if (k === "e") this.partida.encerrar();
    else if (k === "d") this.live.ligarDemo();
    else if (k === "r") this.zerar();
    else if (k === "f") this.live.simular({ tipo: "seguiu", usuario: daqui(this.alguemEmCampo()) });
    else if (k === "h") this.live.simular({ tipo: "compartilhou", usuario: daqui(this.alguemEmCampo()) });
    else if (k === "c") this.live.simular({ tipo: "curtida", usuario: daqui(this.alguemEmCampo()), curtidas: 15 });
    else if (k === "b") {
      const p = this.alguemEmCampo();
      if (p) this.live.simular({ tipo: "comentario", usuario: daqui(p), texto: TRUQUES_DEMO[Math.floor(Math.random() * TRUQUES_DEMO.length)] });
    } else if (k === "t") {
      const ids = j ? [j.a, j.b, config.times[Math.floor(Math.random() * config.times.length)].id] : config.times.map(t => t.id);
      for (let i = 0; i < 10; i++) {
        const nome = "espectador" + Math.floor(Math.random() * 400);
        const t = this.time(ids[Math.floor(Math.random() * ids.length)]);
        this.live.simular({ tipo: "comentario", usuario: { id: nome, nome }, texto: t.apelidos[0] });
      }
    }
  },

  zerar() {
    this.partida.zerar();
    this.agenda = [];
    this.vencedor = null;
    Hud.esconderRanking();
    Hud.esconderTelao();
    Hud.chamada("aguardando");
    Cena.neutro();
    Cena.ocioso(true);
  },
};

/* A cena e o HUD desenham com a Lilita One: espera a fonte pra não sair o
   primeiro quadro com a letra de reserva. */
document.fonts.load('40px "Lilita One"').catch(() => {}).finally(() => {
  Jogo.iniciar();
  window.Jogo = Jogo;
});
