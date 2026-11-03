/* Liga as peças: live (comum/live.js) → Arena (regras.js) → cena, HUD e
   som, mais as teclas de teste. A cena avisa pelo `aoMomento` quando o
   mascote arranca, bate, cambaleia e cai, e o som entra nessa hora.

   Na câmera lenta da voadora a regra anda junto com a cena (dt × lento),
   pra trombada sair no quadro em que o pé encosta. */
"use strict";

const { chave, config, semente } = Config.carregar();
const W = 1080;

const CHAT_DEMO = [
  "boa noite live", "kkkkkk", "kkkkkkkkk", "empurra", "derruba", "olha o juiz", "eita", "que isso",
  "cheguei", "bora", "nãooo", "🔥🔥🔥", "segura", "caiu kkk", "quase", "vai cair", "juiz ladrão", "é hoje",
];

/* Cada time da plateia de demonstração comenta o nome e os apelidos;
   time de mais torcida (peso) tem mais gente. */
function ladosDaDemo(times) {
  const lados = [];
  for (const t of times) {
    const frases = [t.nome, ...t.apelidos, `vamo ${t.apelidos[0]}`, `empurra ${t.apelidos[0]}`, `${t.nome} ${t.nome}`];
    for (let i = 0; i < Math.max(1, Math.round(t.peso / 2)); i++) lados.push({ comentarios: frases });
  }
  return lados;
}

const Jogo = {
  pausado: false,
  agenda: [],
  comentarios: 0,
  beiras: 0,

  iniciar() {
    Som.aplicar(config);
    this.palco = document.getElementById("palco");
    const aleatorio = semente != null ? Texturas.sorteio(semente + 1) : Math.random;
    this.arena = new Arena(config, aleatorio);
    this.times = new Map(config.times.map(t => [t.id, t]));

    Cena.montar(document.getElementById("estadio"), this.palco, config, (m, dados) => this.momento(m, dados));
    Cena.novaRodada(this.arena);
    Hud.montar(this.palco, config);
    Painel.montar(chave, config);
    this.configurar = montarConfigurar({
      jogo: "empurra",
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
    this.depois(1.5, () => { Som.tocar("apito"); Som.falar("inicio"); });

    let antes = performance.now();
    const quadro = () => {
      const ms = performance.now();
      const dt = Math.min(0.05, Math.max(0, ms - antes) / 1000);
      antes = ms;
      this.quadro(dt);
      requestAnimationFrame(quadro);
    };
    requestAnimationFrame(quadro);
  },

  /* Celular mais comprido que 9:16 (até 9:21): o palco cresce pra baixo e a
     câmera abre junto, em vez de sobrar faixa preta. */
  aplicarFormato(primeira = false) {
    const H = innerWidth && innerHeight ? Math.min(2520, Math.max(1920, Math.round(W * innerHeight / innerWidth))) : 1920;
    if (H !== this.altura || primeira) {
      this.altura = H;
      this.palco.style.height = `${H}px`;
      Cena.aplicarFormato(W, H);
    }
    const s = Math.min(innerWidth / W, innerHeight / H);
    this.palco.style.transform = `translate(${(innerWidth - W * s) / 2}px, ${(innerHeight - H * s) / 2}px) scale(${s})`;
    Cena.dimensionar(s);
  },

  /* ───────── live ───────── */

  receber(ev) {
    const a = this.arena;
    const quem = ev.usuario;
    if (ev.tipo === "comentario") {
      if (++this.comentarios % 40 === 0) { Som.onda(); Som.falar("torcida"); }
      this.contar(a.comentario(quem, ev.texto));
    } else if (ev.tipo === "curtida") this.contar(a.curtida(quem, ev.curtidas));
    else if (ev.tipo === "presente") {
      const pr = ev.presente;
      const faixa = this.configurar.faixa(pr.nome, pr.moedas);
      this.contar(a.presente(quem, { nome: pr.nome, moedas: pr.total, quantidade: pr.quantidade, faixa }));
    } else if (ev.tipo === "seguiu" || ev.tipo === "compartilhou") Som.onda(0.5);
  },

  nome(id) { return (this.times.get(id) || {}).nome || ""; },

  coroado(a) {
    const c = this.arena.time(a.time).coroa;
    return !!c && c.vale && c.id === a.id;
  },

  rotulo(a) { return `${this.coroado(a) ? "👑" : ""}@${encurtar(a.nome, 14)}`; },

  /* Time de camisa branca usa a 2ª cor pra não sumir no cartão e no texto. */
  cores(id) {
    const t = this.times.get(id);
    const branco = Texturas.clareza(t.cor) > 0.7;
    return branco ? [t.cor2, t.cor] : [t.cor, t.cor2];
  },

  contar(lista) {
    for (const a of lista) {
      switch (a.tipo) {
        case "comentou":
          if (this.arena.fase !== "rodada") break;
          Cena.comentou(a.time, this.rotulo(a), a.empurrou, a.id);
          if (a.empurrou) {
            Hud.piscarChip(a.time);
            if (Math.random() < 0.3) Som.bip(false);
          }
          break;
        case "curtiu": Cena.curtiu(a.time); break;
        case "empurrao": Cena.empurrao(a); break;
        case "bateu": Cena.bateu(a); break;
        case "beira": Cena.beira(a.time); break;
        case "voltou":
          Cena.voltou(a.time, a.revive);
          if (a.revive) {
            Hud.anunciar(`${this.nome(a.time)} VOLTOU`, "ouro", 2.2, 1);
            Som.tocar("nitro", { volume: 0.8 });
          } else Som.bip(true);
          if (a.revive || Math.random() < 0.4) Som.falar("voltou");
          break;
        case "caiu": this.caiu(a); break;
        case "apito":
          Cena.apito(a);
          Som.tocar("apito", { volume: 0.9 });
          if (a.acao !== "vermelho") Som.falar("juiz");
          break;
        case "juiz": this.juiz(a); break;
        case "presente": this.presente(a); break;
        case "terremoto":
          Cena.terremoto(a);
          Hud.anunciar("TERREMOTO", "ouro lenda", 2.8, 3);
          Som.estrondo(2.4);
          Som.tocar("torcida-forte", { volume: 0.9 });
          Som.onda(1);
          Som.falar("terremoto");
          break;
        case "coroa":
          if (a.tomou && this.coroado(a)) Cena.pop(Cena.boneco(a.time), this.rotulo(a), "coroa", a.id);
          break;
        case "fim": this.fim(a); break;
        case "intervalo":
          Hud.esconderVitoria();
          Hud.ranking(this.arena, a.vencedor);
          Cena.intervalo();
          break;
        case "rodada":
          Hud.esconderRanking();
          Hud.limparCartoes();
          Cena.novaRodada(this.arena);
          Hud.anunciar(`RODADA ${a.rodada}`, "ouro", 1.8);
          this.beiras = 0;
          this.depois(0.6, () => { Som.tocar("apito"); Som.falar("inicio"); });
          break;
      }
    }
  },

  /* O cartão sai pra todo presente, até fora da rodada; o golpe só dentro
     dela. Cada faixa sobe o brilho do som. */
  presente(a) {
    const [cor, cor2] = this.cores(a.time);
    Hud.cartao({
      id: a.id, seq: a.seq, nome: encurtar(a.nome, 16), simbolo: simboloDoPresente(a.presente),
      quantidade: a.quantidade, faixa: a.faixa, cor, cor2,
    });
    Som.subida(a.faixa);
    if (a.guardado || a.fora) return;
    Cena.presente(a, this.rotulo(a));
    if (a.faixa >= 1) Som.onda(0.4 + a.faixa * 0.15);
  },

  caiu(a) {
    Cena.caiu(a);
    const nome = this.nome(a.time);
    if (a.presente) Hud.derrubou(a.presente, nome);
    if (a.vivos >= 1 && this.arena.fase === "rodada") Hud.anunciar(`${nome} CAIU FORA`, "vermelho", 2, 0);
    Som.onda(0.7);
    if (a.motivo !== "vermelho") Som.falar("caiu", a.time);
  },

  juiz(a) {
    Cena.juizAgiu(a);
    const nome = this.nome(a.time);
    if (a.acao === "empurrao") {
      Som.baque(1);
      Hud.anunciar(`O JUIZ EMPURROU O ${nome}`, "ouro", 2.2, 0);
    } else if (a.acao === "amarelo") {
      Som.tocar("apito", { volume: 0.7, taxa: 1.15 });
      Hud.anunciar(`AMARELO PRO ${nome}`, "amarelo", 2.2, 1);
      Som.falar("amarelo");
    } else {
      Som.tocar("apito", { volume: 1 });
      Som.estrondo(0.7);
      Hud.anunciar("CARTÃO VERMELHO", "vermelho", 2.6, 2);
      Som.falar("vermelho");
    }
  },

  fim(a) {
    Cena.fim(a);
    const [cor, cor2] = this.cores(a.vencedor);
    Hud.vitoria(this.nome(a.vencedor), cor, cor2, a.ajudante && a.ajudante.nome);
    Som.tocar("torcida-forte");
    Som.tocar("confete", { volume: 0.8 });
    Som.onda(1);
    this.depois(0.9, () => Som.tocar("fanfarra", { volume: 0.7 }));
    if (a.motivo === "tempo") {
      Som.tocar("apito");
      Som.falar("tempo");
      this.depois(2.4, () => Som.falar("venceu", a.vencedor));
    } else Som.falar("venceu", a.vencedor);
  },

  /* O que a cena avisa na hora exata da animação. */
  momento(m, dados = {}) {
    switch (m) {
      case "arrancada": {
        const g = dados.golpe;
        if (g === "chat" || g === "curtida") { Som.zum(g === "chat" ? 0.25 : 0.12); break; }
        Som.zum({ ombrada: 0.55, carrinho: 0.7, voadora: 1 }[g] || 0.4);
        if (g === "carrinho") { Som.tocar("escorregao", { volume: 0.8 }); Som.falar("carrinho"); }
        if (g === "voadora") { Som.tocar("jato", { volume: 0.9 }); Som.falar("voadora"); }
        break;
      }
      case "bateu": Som.baque(dados.forca); break;
      case "beira":
        Som.boing();
        if (++this.beiras % 3 === 1) Som.falar("beira");
        break;
      case "caiu": Som.tombo(); break;
    }
  },

  /* ───────── relógio ───────── */

  depois(seg, f) { this.agenda.push({ em: this.arena.t + seg, f }); },

  quadro(dt) {
    const a = this.arena;
    const dtJogo = this.pausado ? 0 : dt;
    const dtRegra = dtJogo * Cena.lento;
    if (a.fase === "rodada" && dtRegra) this.contagem(a.resta(), a.resta() - dtRegra);
    this.contar(a.passo(dtRegra));
    if (this.agenda.length) {
      const prontos = this.agenda.filter(x => x.em <= a.t);
      this.agenda = this.agenda.filter(x => x.em > a.t);
      for (const x of prontos) x.f();
    }
    if (a.fase === "intervalo") Hud.proxima(a.resta());
    Hud.quadro(a, dtJogo);
    Cena.quadro(a, dtJogo);
    Som.ritmo = this.aperto();
    Som.quadro(this.pausado || a.fase !== "rodada");
  },

  /* 0 a 1: quanto a rodada apertou, pelo que sobrou em pé e pelo relógio. */
  aperto() {
    const a = this.arena;
    if (a.fase !== "rodada") return 0;
    const n = config.times.length;
    const gente = 1 - (a.vivos().length - 2) / (n - 2);
    const relogio = 1 - a.resta() / 30;
    return Math.min(1, Math.max(0, gente, relogio));
  },

  /* Últimos 10 s: rufar em 3 ondas cada vez mais rápidas e bipe nos 5 finais. */
  contagem(antes, depois) {
    const passou = s => antes > s && depois <= s;
    if (passou(10)) { Som.falar("dez"); Som.tocar("rufar", { volume: 0.8 }); }
    if (passou(6.5)) Som.tocar("rufar", { volume: 0.9, taxa: 1.08 });
    if (passou(3.2)) Som.tocar("rufar", { volume: 1, taxa: 1.16 });
    if (depois > 0 && depois <= 5 && Math.ceil(antes) !== Math.ceil(depois)) Som.bip(true);
  },

  /* ───────── teclas e testes ───────── */

  testeId: 0,
  testador() {
    const ids = ["teste.ana", "teste.beto", "teste.cida", "teste.dudu", "teste.edu", "teste.fefe"];
    return { id: ids[this.testeId++ % ids.length], nome: nomeDeTeste() };
  },

  /* O testador comenta um time em pé antes de mandar, pra o presente ter
     dono e o golpe aparecer. */
  presenteTeste(presente) {
    const usuario = this.testador();
    const vivos = this.arena.vivos();
    const lista = vivos.length ? vivos : this.arena.times;
    const t = this.times.get(lista[Math.floor(Math.random() * lista.length)].id);
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
    if (k === "p") { e.preventDefault(); Painel.alternar(true); }
    else if (e.key === "Enter") { this.pausado = !this.pausado; this.palco.querySelector(".pausa").hidden = !this.pausado; }
    else if (k === "s") Som.alternar();
    else if (k === "j") this.arena.proximoApito = this.arena.t;
    else if (k === "e") this.arena.encerrar();
    else if (k === "d") this.live.ligarDemo();
    else if (k === "r") this.zerar();
    else if (k === "t") {
      for (let i = 0; i < 10; i++) {
        const nome = "espectador" + Math.floor(Math.random() * 400);
        const t = config.times[Math.floor(Math.random() * config.times.length)];
        const texto = Math.random() < 0.7 ? t.apelidos[0] : CHAT_DEMO[Math.floor(Math.random() * CHAT_DEMO.length)];
        this.live.simular({ tipo: "comentario", usuario: { id: nome, nome }, texto });
      }
    }
  },

  zerar() {
    this.arena.zerar();
    this.agenda = [];
    this.comentarios = 0;
    this.beiras = 0;
    Hud.esconderVitoria();
    Hud.esconderRanking();
    Hud.limparCartoes();
    Cena.novaRodada(this.arena);
  },
};

/* As placas e o cartão usam a Lilita One: espera a fonte pra não sair o
   primeiro @ (e a capa) com a letra de reserva. */
document.fonts.load('40px "Lilita One"').catch(() => {}).finally(() => {
  Jogo.iniciar();
  window.Jogo = Jogo;
});
