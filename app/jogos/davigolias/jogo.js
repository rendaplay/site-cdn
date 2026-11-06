/* Liga as peças: live (comum/live.js) → Duelo (regras.js) → cena, HUD e
   som, mais as teclas de teste. A cena avisa pelo `aoMomento` quando a
   pedra sai, bate ou passa, quando o gigante pisa e quando cai, e o som e
   as faixas de anúncio entram nessa hora. */
"use strict";

const { chave, config } = Config.carregar();
const W = 1080;

const CHAT_DEMO = [
  "boa noite live", "kkkkkk", "kkkkkkkkk", "vai davi", "derruba ele", "olha o tamanho disso", "eita",
  "que isso", "cheguei", "bora", "gira gira", "nãooo", "🔥🔥🔥", "corre davi", "acerta a testa", "ele tá vindo",
  "pedrada", "agora vai", "o gigante tá bravo", "kkk ele cresceu",
];

const Jogo = {
  pausado: false,
  comentarios: 0,

  iniciar() {
    Som.aplicar(config);
    this.palco = document.getElementById("palco");
    this.duelo = new Duelo(config);

    Cena.montar(document.getElementById("vale"), this.palco, config, (m, dados) => this.momento(m, dados));
    Hud.montar(this.palco);
    Painel.montar(chave, config);
    this.configurar = montarConfigurar({
      jogo: "davigolias",
      opcoes: () => config.faixas.map(f => f.nome),
      testar: presente => this.presenteTeste(presente),
      avancado: () => Painel.alternar(true),
      regras: [
        "👑 Quem mais manda presente na rodada vira o Golias. Presente dele faz o gigante andar e crescer.",
        "💬 Cada comentário de quem não é o Golias carrega a funda do Davi (1 por segundo por pessoa). Curtidas também carregam.",
        "🎁 Presente de quem não é o Golias carrega mais, conforme a faixa abaixo.",
        "🪨 Funda cheia: o Davi atira e derruba o gigante. Se o gigante chegar no Davi, o Golias vence.",
        "⏱️ Acabou o tempo: a pedra sai com o que tiver e só acerta se a funda passou da metade.",
      ],
      efeitos: () => config.faixas.map(f => f.efeito),
    });
    this.aplicarFormato(true);

    addEventListener("resize", () => this.aplicarFormato());
    addEventListener("keydown", e => this.tecla(e));

    Hud.sinal("demo");
    setTimeout(() => { if (this.live.estado === "conectando") Hud.sinal("conectando"); }, 3000);
    this.live = conectarLive({
      demo: { ligado: false, comentarios: CHAT_DEMO, ...config.demo },
      aoEvento: ev => this.receber(ev),
      aoEstado: estado => { if (estado !== "conectando") Hud.sinal(estado); },
    });
    setTimeout(() => Som.falar("inicio"), 1500);

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
    const d = this.duelo;
    const quem = ev.usuario;
    if (ev.tipo === "comentario") this.contar(d.comentario(quem, ev.texto));
    else if (ev.tipo === "curtida") this.contar(d.curtida(quem, ev.curtidas));
    else if (ev.tipo === "presente") {
      const pr = ev.presente;
      const faixa = this.configurar.faixa(pr.nome, pr.moedas);
      this.contar(d.presente(quem, { nome: pr.nome, moedas: pr.total, quantidade: pr.quantidade, faixa }));
    } else if (ev.tipo === "seguiu" || ev.tipo === "compartilhou") Cena.curtiu();
  },

  contar(lista) {
    for (const a of lista) {
      switch (a.tipo) {
        case "comentou":
          if (this.duelo.fase !== "rodada" && !a.golias) break;
          Cena.comentou(encurtar(a.nome, 14), a.golias);
          if (!a.carga) break;
          if (Math.random() < 0.3) Som.bip(false);
          if (++this.comentarios % 40 === 0) { Som.onda(); Som.falar("torcida"); }
          break;
        case "curtiu": Cena.curtiu(); break;
        case "presente": this.presente(a); break;
        case "golias":
          Cena.novoGolias(encurtar(a.nome, 16), true);
          Hud.dono(a.nome);
          Hud.anunciar(`👑 @${encurtar(a.nome, 14)} VIROU O GOLIAS`, "vermelho");
          Som.falar("golias");
          break;
        case "metade": Som.falar("metade"); break;
        case "perto": Som.falar("perto"); break;
        case "tiro":
          this.tiro = a;
          Cena.tiro(a);
          Som.falar(a.lendario ? "lendario" : "tiro");
          break;
        case "fim": this.fim(a); break;
        case "intervalo":
          Hud.mostrarPlacar(a.placar, a.vencedor);
          break;
        case "rodada":
          Hud.esconderPlacar();
          Cena.novaRodada(this.duelo);
          Hud.dono(a.golias && a.golias.nome);
          Hud.anunciar(`RODADA ${a.rodada}`, "ouro", 1.8);
          setTimeout(() => Som.falar("inicio"), 500);
          break;
      }
    }
  },

  /* Cada faixa é um momento: destaque com o @, a barra pulando e, nas
     altas, faixa de anúncio e narrador (que não atropela outra fala). */
  presente(a) {
    if (a.guardado) {
      Cena.comentou(encurtar(a.nome, 14), a.lado === "golias");
      return;
    }
    const rotulo = { nome: encurtar(a.nome, 12), simbolo: simboloDoPresente(a.presente), quantidade: a.quantidade };
    const n = Math.min(4, a.faixa);
    const quem = `@${encurtar(a.nome, 14)}`;
    if (a.lado === "golias") {
      Cena.presenteGolias(a, rotulo);
      Hud.pular("golias", n);
      Hud.anunciar(`${quem} FORTALECEU O GOLIAS`, "vermelho", n >= 2 ? 2.6 : 1.8, n >= 2 ? 1 : 0);
      if (n >= 2) Som.falar("cresceu");
      return;
    }
    Cena.presenteDavi(a, rotulo);
    if (n < 4) Hud.pular("davi", n);
    switch (n) {
      case 0: Som.faisca(4); break;
      case 1: Som.faisca(6); Som.onda(0.5); break;
      case 2: Som.onda(); break;
      case 3:
        Som.onda();
        Hud.anunciar(`${quem} FEZ O GIGANTE RECUAR`, "ouro", 2.8);
        break;
      case 4: Som.estrondo(0.8); break;
    }
  },

  fim(a) {
    Cena.fim(a);
    Hud.placarDaLive(this.duelo.placar());
    if (a.vencedor === "golias" && a.motivo === "tempo") Som.falar("venceu");
  },

  /* O que a cena avisa na hora exata da animação. */
  momento(m, dados = {}) {
    switch (m) {
      case "passo": Som.passo(dados.perto, dados.escala); break;
      case "ching": Som.ching(); break;
      case "pedra": Som.ching(true); Som.impacto(); break;
      case "escudo": Som.escudo(); break;
      case "lenda": {
        const r = dados.rotulo;
        Hud.anunciar(`${r.simbolo} @${r.nome}`, "ouro lenda", 2.4, 2);
        Som.tocar("torcida-forte", { volume: 0.9 });
        Som.onda(1);
        Som.estrondo(1.2);
        break;
      }
      case "rugido": Som.rugido(dados.forte); break;
      case "fogo": Som.fogo(); Som.falar("fogo"); break;
      case "tremor": Som.estrondo(1.4); Som.falar("tremor"); break;
      case "soltou": Som.soltou(dados.lendario); break;
      case "acertou": Som.impacto(); Som.estrondo(0.6); break;
      case "errou":
        Hud.anunciar("A PEDRA PASSOU RASPANDO", "vermelho");
        Som.rugido(false);
        Som.falar("errou");
        break;
      case "queda": {
        const nome = this.tiro && this.tiro.nome;
        Hud.anunciar(nome ? `@${encurtar(nome, 14)} DERRUBOU O GIGANTE!` : "O GIGANTE CAIU!", "ouro", 3.4);
        Som.estrondo(2.4);
        Som.tocar("torcida-forte");
        Som.onda(1);
        setTimeout(() => Som.tocar("fanfarra", { volume: 0.7 }), 1400);
        Som.falar("derrubou");
        break;
      }
      case "pisao": {
        const g = this.duelo.golias;
        Hud.anunciar(g ? `👑 @${encurtar(g.nome, 14)} VENCEU` : "O GOLIAS VENCEU", "vermelho", 3.4);
        Som.estrondo(2.2);
        Som.falar("venceu");
        break;
      }
    }
  },

  /* ───────── relógio ───────── */

  quadro(dt) {
    const d = this.duelo;
    const dtJogo = this.pausado ? 0 : dt;
    if (d.fase === "rodada" && dtJogo) this.contagem(d.resta(), d.resta() - dtJogo);
    this.contar(d.passo(dtJogo));
    if (d.fase === "intervalo") Hud.proxima(d.resta());
    Hud.quadro(d);
    Cena.quadro(d, dtJogo);
    Som.ritmo = 1 - d.dist / config.golias.distancia;
    Som.quadro(this.pausado || d.fase !== "rodada");
    Som.giro(Cena.d.vel / (Math.PI * 2), d.fracao());
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
    const golias = this.duelo.golias;
    const ids = ["teste.ana", "teste.beto", "teste.cida", "teste.dudu", "teste.edu", "teste.fefe"];
    let id = ids[this.testeId++ % ids.length];
    if (golias && golias.id === id) id = ids[this.testeId++ % ids.length];
    return { id, nome: nomeDeTeste() };
  },

  /* Presente de teste do lado do Davi: vem de um testador que não é o
     Golias (senão o gigante é que andaria). */
  presenteTeste(presente) {
    this.live.simular({ tipo: "presente", usuario: this.testador(), presente });
  },

  presenteDoGolias(faixa) {
    const g = this.duelo.golias;
    const usuario = g ? { id: g.id, nome: g.nome } : this.testador();
    const m = config.faixas[faixa].moedas;
    this.live.simular({ tipo: "presente", usuario, presente: { nome: "Rose", moedas: m, quantidade: 1, total: m } });
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
    else if (k === "g") this.presenteDoGolias(e.shiftKey ? 3 : 2);
    else if (k === "e") this.duelo.encerrar();
    else if (k === "d") this.live.ligarDemo();
    else if (k === "r") this.zerar();
    else if (k === "t") {
      for (let i = 0; i < 10; i++) {
        const nome = "espectador" + Math.floor(Math.random() * 400);
        this.live.simular({ tipo: "comentario", usuario: { id: nome, nome }, texto: CHAT_DEMO[Math.floor(Math.random() * CHAT_DEMO.length)] });
      }
    }
  },

  zerar() {
    this.duelo.zerar();
    this.comentarios = 0;
    this.tiro = null;
    Hud.esconderPlacar();
    Hud.placarDaLive(this.duelo.placar());
    Hud.dono(null);
    Cena.novaRodada(this.duelo);
  },
};

/* A placa do Golias usa a Lilita One: espera a fonte pra não sair o
   primeiro @ (e a capa) com a letra de reserva. */
document.fonts.load('40px "Lilita One"').catch(() => {}).finally(() => {
  Jogo.iniciar();
  window.Jogo = Jogo;
});
