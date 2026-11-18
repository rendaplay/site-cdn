/* Liga as peças: live (comum/live.js) → Pebolim (regras.js) → cena, HUD e
   som, mais as teclas de teste. A física anda em passo fixo dentro do
   regras.js; aqui o quadro só entrega o tempo e desenha. O que acontece em
   sequência (grito, fanfarra, ranking) anda no relógio do jogo, então a
   pausa segura tudo junto. */
"use strict";

const { chave, config, opcoes } = Config.carregar();
const LARGURA_PALCO = 1080;

const CHAT_DEMO = [
  "boa noite live", "kkkkkk", "kkkkkkkkk", "que mesa é essa", "olha o goleiro", "aí sim", "eita", "que isso",
  "cheguei", "bora", "uuuuh", "nãooo", "🔥🔥🔥", "gira a vareta", "que frango kkk", "olha a pressão",
];
const GRITOS_DEMO = ["chuta", "bomba", "chuta logo", "manda a bomba", "chutaaa"];

/* Sorteio com semente (mulberry32): ?semente= repete a mesma partida. */
function sorteio(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Cada pessoa da plateia falsa torce por um time fixo e às vezes pede a bomba. */
function ladosDaDemo(times) {
  const lados = [];
  for (const t of times) {
    const ap = t.apelidos[0];
    const frases = [t.nome, ...t.apelidos, `vamo ${ap}`, `${ap} ${ap}`, `gol do ${ap}`, ...GRITOS_DEMO.map(g => `${ap} ${g}`)];
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
    this.partida = new Pebolim(config, aleatorio);
    this.times = new Map(config.times.map(t => [t.id, t]));

    Cena.montar(document.getElementById("campo"), config);
    Hud.montar(this.palco, config);
    Painel.montar(chave, config);
    this.configurar = montarConfigurar({
      jogo: "pebolim",
      opcoes: () => config.faixas.map(f => f.nome),
      testar: presente => this.presenteTeste(presente),
      avancado: () => Painel.alternar(true),
      regras: [
        "Os dois times mais comentados jogam o pebolim. Comentou o time: ganha um boneco com o @ na mesa.",
        "O último boneco a tocar na bola leva o gol com o @.",
        "Escreveu \"chuta\" ou \"bomba\": o próximo chute do time sai mais forte.",
        "Curtidas enchem a pressão, que cheia vira turbo. Quem segue vira craque dourado.",
        "Partida até 5 gols ou 3 min, empate vai pro gol de ouro. O vencedor fica e pega o time mais comentado de fora.",
      ],
      efeitos: () => [
        "bola brilhante",
        "canhão: chute mais forte",
        "congela o goleiro rival",
        "bola de fogo, gol garantido",
        "chuva de bolas e goleiro paredão",
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
  ladoDo(id) { const j = this.partida.jogo; return j && id === j.b ? "b" : "a"; },

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
        case "curtiu": Cena.festa(a.time, 0.35); break;
        case "turbo":
          Hud.faixa(`🔥 TURBO DO ${this.nomeTime(a.time)}!`, "vermelha");
          Cena.turbo(a);
          Som.tocar("jato", { volume: 0.5, taxa: 1.2 });
          Som.onda();
          Som.falar("turbo", a.time);
          break;
        case "seguiu": this.seguiu(a); break;
        case "compartilhou":
          Hud.faixa(`📣 @${encurtar(a.nome, 16)} chamou a galera!`, "verde");
          Cena.confete(a.time, 30);
          Som.tocar("confete", { volume: 0.6 });
          break;
        case "presente": this.presente(a); break;
        case "preparado": this.preparado(a); break;
        case "gelo":
          Cena.gelo(a);
          Hud.faixa(`🧊 Goleiro do ${this.nomeTime(a.rival)} congelado!`);
          Som.tocar("uuh", { volume: 0.6, taxa: 1.15 });
          Som.falar("gelo");
          break;
        case "chuva":
          Cena.chuva(a);
          Hud.telao(a, config.chuva);
          Som.tocar("fogos");
          Som.tocar("fanfarra", { volume: 0.7 });
          Som.onda();
          Som.falar("chuva");
          break;
        case "acabou":
          if (a.efeito === "chuva") Hud.esconderTelao();
          break;
        case "aguardando":
          Hud.chamada("aguardando");
          Cena.ocioso(true);
          break;
        case "classico": this.classico(a); break;
        case "saque":
          Cena.saque(a);
          Som.tocar("apito", { volume: 0.35, taxa: 1.25 });
          break;
        case "chute": this.chute(a); break;
        case "batida":
          Cena.batida(a);
          Som.curto(a.em === "boneco" ? "chute" : "batida", Math.min(0.9, 0.25 + a.forca / 400), 60);
          break;
        case "treme":
          Cena.treme(a);
          Som.estrondo();
          break;
        case "gol": this.gol(a); break;
        case "golDeOuro":
          Hud.faixa("⚡ GOL DE OURO: QUEM MARCAR VENCE!", "ouro");
          Som.tocar("apito");
          Som.onda();
          this.depois(0.4, () => Som.falar("golouro"));
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
    if (a.lugar !== null && j) {
      if (a.novo) {
        Cena.destacar(this.ladoDo(a.time), a.lugar);
        Cena.festa(a.time, 0.5);
        if (Math.random() < 0.5) Som.bip(false);
      }
      if (a.bomba) {
        Hud.faixa(`💥 @${encurtar(a.nome, 16)} vai soltar a bomba!`);
        Som.bip(true);
      }
    }
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

  seguiu(a) {
    Hud.faixa(`⭐ REFORÇO! @${encurtar(a.nome, 16)}`, "ouro");
    if (a.lugar !== null) Cena.destacar(this.ladoDo(a.time), a.lugar);
    Cena.confete(a.time, 24);
    Som.tocar("confete", { volume: 0.5 });
    Som.falar("reforco");
  },

  presente(a) {
    Hud.presente({
      nome: a.nome, simbolo: simboloDoPresente(a.presente), quantidade: a.quantidade,
      efeito: a.efeito, forma: a.forma, time: a.time, desafiante: a.desafiante, semTime: a.semTime,
    });
    Som.subida(a.faixa);
    if (a.time) Cena.confete(a.time, 10 + a.faixa * 10);
    if (a.desafiante) { Cena.festa(a.time, 0.5); return; }
    if (a.aquecimento) { this.mostrarAquecimento(); return; }
    Cena.festa(a.time, 0.5 + a.faixa * 0.12);
    if (a.lugar !== null && a.lugar !== undefined) Cena.destacar(this.ladoDo(a.time), a.lugar);
  },

  /* Efeito de chute pronto: a bola já brilha na cor do time até o chute sair. */
  preparado(a) {
    if (a.efeito === "fogo") {
      Hud.faixa(`🔥 BOLA DE FOGO DO ${this.nomeTime(a.time)}!`, "vermelha");
      Som.tocar("jato", { volume: 0.6 });
      Som.onda();
      Som.falar("fogo");
    } else if (a.efeito === "canhao") {
      Hud.faixa(`💣 CANHÃO DO ${this.nomeTime(a.time)} CARREGADO!`);
      Som.falar("canhao");
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

  chute(a) {
    Cena.chute(a);
    const forte = a.efeito === "canhao" || a.efeito === "fogo" || a.bomba;
    Som.curto("chute", forte ? 1 : Math.min(0.85, 0.35 + a.forca / 500), 40);
    if (forte) {
      Som.tocar("giro", { volume: 0.8 });
      Som.estrondo();
    }
    if (a.bomba && a.dono) Hud.faixa(`💥 BOMBA DE @${encurtar(a.dono.nome, 16)}!`, "vermelha");
  },

  gol(a) {
    const j = this.partida.jogo;
    Cena.gol(a);
    Hud.gol(a);
    Hud.gols(a.gols);
    Som.tocar("gol");
    Som.tocar("torcida-forte", { volume: a.chuva ? 0.5 : 0.85 });
    Som.onda();
    if (a.decidiu) return;
    if (!a.chuva || Math.random() < 0.4) Som.falar("gol", Math.random() < 0.6 ? a.time : null);
    /* Ponto de partida: quem marcar o próximo leva (não no gol de ouro, que já decide). */
    const falta = config.gols - a.gols[a.time];
    if (!a.chuva && falta === 1 && a.gols[a.rival] < config.gols - 1) this.depois(1.4, () => Som.falar("matchpoint"));
    if (j && j.ouro) Hud.faixa("🏆 GOL DE OURO!", "ouro");
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
      Hud.ranking(this.partida, a.vencedor, a.gols);
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
    Hud.atualizar(j, d.fase, d.t);
    if (j && (d.fase === "fim" || d.fase === "intervalo") && this.vencedor) {
      const desafiante = d.ranqueCitacoes([this.vencedor])[0];
      const fimIntervalo = d.fase === "intervalo" ? d.resta() : d.resta() + config.tempos.intervalo;
      Hud.proxima(fimIntervalo, desafiante && desafiante.time, this.vencedor);
    }
    Cena.quadro(Math.min(0.05, dtJogo), agora, { fase: d.fase, mesa: d.mesa, alfa: d.alfa, jogo: j });
    Hud.donos(Cena.rotulos(this.posicoes), j, d.fase);
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

  /* Alguém com boneco em campo (pra curtida e bomba de teste). */
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
    if (k === "p") { e.preventDefault(); Painel.alternar(true); }
    else if (e.key === "Enter") { this.pausado = !this.pausado; this.palco.querySelector(".pausa").hidden = !this.pausado; }
    else if (k === "s") Som.alternar();
    else if (k === "e") this.partida.encerrar();
    else if (k === "d") this.live.ligarDemo();
    else if (k === "r") this.zerar();
    else if (k === "f") {
      const p = this.alguemEmCampo();
      const nome = "fã" + Math.floor(Math.random() * 400);
      this.live.simular({ tipo: "seguiu", usuario: p ? { id: p.id, nome: p.nome } : { id: nome, nome } });
    } else if (k === "c") {
      const p = this.alguemEmCampo();
      if (p) this.live.simular({ tipo: "curtida", usuario: { id: p.id, nome: p.nome }, curtidas: 40 });
    } else if (k === "b") {
      const p = this.alguemEmCampo();
      if (p) this.live.simular({ tipo: "comentario", usuario: { id: p.id, nome: p.nome }, texto: "chuta" });
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
    Cena.ocioso(true);
  },
};

/* A cena e o HUD desenham com a Lilita One: espera a fonte pra não sair o
   primeiro quadro (e a capa) com a letra de reserva. */
document.fonts.load('40px "Lilita One"').catch(() => {}).finally(() => {
  Jogo.iniciar();
  window.Jogo = Jogo;
});
