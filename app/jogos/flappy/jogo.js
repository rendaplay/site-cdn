/* Liga as peças: live (comum/live.js) → Partida → cena e HUD, o piloto
   automático e o teclado. A física anda em passo fixo de 1/120 s, então
   o voo é o mesmo em 30, 60 ou 144 Hz. */
"use strict";

const { chave, config, opcoes } = Config.carregar();
const PASSO = 1 / 120;

const FORMATOS = {
  vertical: { W: 1080, H: 1920, dims: { W: 1080, topo: 330, chao: 1420, x: 400 } },
  horizontal: { W: 1920, H: 1080, dims: { W: 1920, topo: 150, chao: 856, x: 540 } },
};

const CHAT_DEMO = [
  "boa noite live", "kkkkkk", "kkkkkkkkk", "voa tuca", "cai cai cai", "derruba ele", "salva o tuca",
  "olha o meteoro kkk", "tá de ponta-cabeça", "bora recorde", "eita", "quase", "aí sim", "manda neblina",
  "rio de janeiro na área", "cheguei", "que bico é esse", "tucano brabo", "vai vai vai", "nãooo",
];

const Jogo = {
  pausado: false,
  ultimoToque: -Infinity,
  acumulado: 0,
  ultimoRanking: 0,
  morteEm: null,

  iniciar() {
    Som.aplicar(config);
    this.palco = document.getElementById("palco");
    this.forcado = opcoes.formato;
    this.formato = this.forcado || (innerHeight >= innerWidth ? "vertical" : "horizontal");
    const aleatorio = opcoes.semente != null ? sorteio(opcoes.semente + 1) : Math.random;

    this.partida = new Partida(config, FORMATOS[this.formato].dims, aleatorio, Config.lerRecorde(chave));
    this.recordeGravado = this.partida.recordeSalvo;
    this.piloto = new Piloto(config.piloto, aleatorio);
    Cena.montar(document.getElementById("voo"));
    this.palco.classList.toggle("seguro", !!config.modoSeguro);
    Hud.montar(this.palco, config);
    Hud.tucaEmCima = () => {
      const d = this.partida.mundo.dims;
      return this.partida.mundo.passaro.y < (d.topo + d.chao) / 2;
    };
    Painel.montar(chave, config);
    this.aplicarFormato(true);

    addEventListener("resize", () => this.aplicarFormato());
    addEventListener("keydown", e => this.tecla(e));
    this.palco.addEventListener("pointerdown", e => {
      if (e.button === 0 && !Painel.aberto()) this.pular("streamer");
    });

    Hud.sinal("demo");
    setTimeout(() => { if (this.live.estado === "conectando") Hud.sinal("conectando"); }, 3000);
    this.live = conectarLive({
      demo: { ligado: false, comentarios: CHAT_DEMO, ...config.demo },
      aoEvento: ev => this.receber(ev),
      aoEstado: estado => { if (estado !== "conectando") Hud.sinal(estado); },
    });

    let antes = performance.now();
    const quadro = () => {
      const ms = performance.now();
      const dt = Math.min(0.05, Math.max(0, ms - antes) / 1000);
      antes = ms;
      this.quadro(dt, ms / 1000);
      requestAnimationFrame(quadro);
    };
    requestAnimationFrame(quadro);
  },

  aplicarFormato(primeira = false) {
    const f = this.forcado || (innerHeight >= innerWidth ? "vertical" : "horizontal");
    const { W, H, dims } = FORMATOS[f];
    if (f !== this.formato || primeira) {
      this.formato = f;
      this.palco.classList.toggle("vertical", f === "vertical");
      this.palco.classList.toggle("horizontal", f === "horizontal");
      Cena.aplicarFormato(dims, W, H);
      if (!primeira) {
        this.partida.mundo.dims = dims;
        this.partida.voos--;
        this.partida.novoVoo();
        Hud.esconderMorte();
      }
    }
    const s = Math.min(innerWidth / W, innerHeight / H);
    this.palco.style.transform = `translate(${(innerWidth - W * s) / 2}px, ${(innerHeight - H * s) / 2}px) scale(${s})`;
  },

  /* ───────── quem pilota ───────── */

  quemPilota() {
    if (config.controle === "auto") return "auto";
    if (config.controle === "streamer") return "streamer";
    return this.partida.t - this.ultimoToque < config.devolver ? "streamer" : "auto";
  },

  pular(origem) {
    if (origem === "streamer") {
      if (config.controle === "auto") return;
      this.ultimoToque = this.partida.t;
    }
    if (this.pausado) return;
    if (this.partida.pular()) Som.pulo();
  },

  /* ───────── live ───────── */

  receber(ev) {
    const p = this.partida;
    const quem = { ...ev.usuario, simulado: ev.simulado };
    let lista = [];
    if (ev.tipo === "comentario") lista = p.comentario(quem, ev.texto);
    else if (ev.tipo === "presente") {
      const pr = ev.presente;
      lista = p.presente(quem, { nome: pr.nome, moedas: pr.total, quantidade: pr.quantidade });
    } else if (ev.tipo === "curtida") lista = p.curtida(quem, ev.curtidas);
    else if (ev.tipo === "seguiu") lista = p.seguiu(quem);
    else if (ev.tipo === "compartilhou") lista = p.compartilhou(quem);
    this.contar(lista);
  },

  contar(lista) {
    const p = this.partida;
    const tuca = p.mundo.passaro;
    for (const a of lista) {
      const j = a.id ? p.jogadores.get(a.id) : null;
      switch (a.tipo) {
        case "presente": this.presente(a, j); break;
        case "aplicado": this.efeitoNaTela(this.faixaInfo(a.faixa, a.time), j); break;
        case "barra":
          Som.presente(2, { menor: a.time === "caos" });
          Hud.anunciar(a.time === "caos"
            ? { fita: "Chinelada do chat", cor: "#FF4D61", texto: `${config.chat.carga} comentários de quem sabota`, ms: 1800 }
            : { fita: "Bolha do chat", cor: "#3EE08F", texto: `${config.chat.carga} comentários de quem ajuda`, ms: 1800 });
          break;
        case "seguiu": Hud.feed(j, "seguiu", "#FFD23F"); break;
        case "compartilhou": Hud.feed(j, "compartilhou", "#FFD23F"); break;
        case "ponto":
          Som.ponto();
          if (p.ativo("turbo") || (p.evento && p.evento.nome === "dobro")) Cena.texto("+2", tuca.x + 40, tuca.y - 70, { cor: "#FFD23F", tam: 58 });
          break;
        case "queijo":
          Som.ponto();
          Cena.texto("+1", a.x, a.y - 30, { cor: "#FFD23F", tam: 62 });
          Cena.explodir(a.x, a.y, ["#F0B547", "#FFE7A0"], 12, 260, "brilho", 6);
          break;
        case "recorde":
          Som.recorde();
          Hud.anunciar({ fita: "Novo recorde da live!", cor: "#FFD23F", texto: `passou dos ${fmt.format(a.antes)} pontos`, ms: 2600 });
          for (let i = 0; i < 4; i++) Cena.explodir(Cena.W * (0.2 + i * 0.2), p.mundo.dims.topo + 60, ["#FFD23F", "#FF4D61", "#3EE08F", "#59C3FF", "#FFFFFF"], 34, 700, "confete", 9);
          break;
        case "salvou": this.salvou(a); break;
        case "quebrou":
          Cena.quebrarPilar(a.pilar, tuca.y);
          Cena.tremor = Math.max(Cena.tremor, 12);
          Som.impacto();
          break;
        case "rebateu":
          Cena.explodir(a.proj.x, a.proj.y, ["#FFD23F", "#FFF3B0"], 18, 420);
          break;
        case "impacto":
          Cena.impacto(a.x, a.y);
          Som.impacto();
          break;
        case "inverteu":
          Cena.texto(a.ligado ? "DE PONTA-CABEÇA!" : "DESVIROU", tuca.x + 120, tuca.y - 110, { cor: a.ligado ? "#C9A8FF" : "#FFFFFF", tam: a.ligado ? 70 : 54, dur: 1.4 });
          break;
        case "morreu": this.morreu(a); break;
        case "novoVoo":
          Hud.esconderMorte();
          this.piloto.reiniciar();
          this.morteEm = null;
          break;
        case "evento": {
          Som.evento();
          const info = EVENTOS[a.evento];
          Hud.anunciar({ fita: info.titulo, cor: "#FFD23F", texto: info.texto, ms: 2600 });
          break;
        }
      }
    }
  },

  faixaInfo(faixa, time) { return config.faixas[faixa][time]; },

  presente(a, j) {
    if (a.faixa < 0) return;
    Som.presente(a.faixa, { menor: a.time === "caos" });
    const f = this.faixaInfo(a.faixa, a.time);
    const cor = COR_EFEITO[f.efeito];
    Hud.feed(j, f.nome, cor, a.guardado);
    if (a.moedas >= config.destaqueMoedas || a.lendario) {
      Hud.anunciar({
        fita: a.lendario ? `Lendário: ${f.nome}` : f.nome,
        cor,
        jogador: j,
        texto: `${a.quantidade > 1 ? a.quantidade + "× " : ""}${a.nome || "presente"} · ${a.guardado ? "entra no próximo voo" : a.lendario ? (f.teto ? `${f.teto} s, o máximo` : "no máximo") : f.texto}`,
        lendario: a.lendario,
        ms: a.lendario ? 3800 : a.faixa >= 4 ? 3000 : 2400,
      });
    }
    if (!a.guardado) this.efeitoNaTela(f, j);
  },

  /* Reação imediata em volta do Tuca, pra todo presente ser visto na hora. */
  efeitoNaTela(f, j) {
    const tuca = this.partida.mundo.passaro;
    const x = tuca.x + 130;
    const y = tuca.y - 100;
    const cor = COR_EFEITO[f.efeito];
    switch (f.efeito) {
      case "pontos":
        Cena.texto(`+${f.pontos}`, tuca.x + 30, tuca.y - 60, { cor: "#FFD23F", tam: 60 });
        Cena.explodir(tuca.x, tuca.y, ["#F0B547", "#FFE7A0"], 10, 240, "brilho", 6);
        break;
      case "vento": Cena.texto("RAJADA!", x, y, { cor, tam: 56 }); break;
      case "neblina": Cena.texto("NEBLINA", x, y, { cor: "#FFFFFF", tam: 58 }); break;
      case "gigante": Cena.texto("PILAR GIGANTE", x + 80, y, { cor, tam: 58 }); break;
      case "meteoros":
        Cena.tremor = Math.max(Cena.tremor, 20);
        Cena.texto("METEOROS!", x, y, { cor, tam: 70, dur: 1.4 });
        break;
      case "escudo": Cena.texto("BOLHA", x, y, { cor, tam: 56 }); break;
      case "lento": Cena.texto("CÂMERA LENTA", x + 60, y, { cor, tam: 58 }); break;
      case "vida":
        Cena.texto("+1 VIDA", x, y, { cor, tam: 62 });
        Cena.explodir(tuca.x, tuca.y, ["#FF6F91", "#FFFFFF"], 16, 300);
        break;
      case "turbo":
        Cena.flash = 0.5;
        Cena.texto("ASA DE OURO", x + 60, y, { cor, tam: 72, dur: 1.5 });
        break;
    }
  },

  salvou(a) {
    const p = this.partida;
    const tuca = p.mundo.passaro;
    Som.salvou();
    Cena.tremor = Math.max(Cena.tremor, 10);
    if (a.por === "escudo") {
      Cena.explodir(tuca.x, tuca.y, ["#BFF3FF", "#7FDBFF", "#FFFFFF"], 30, 520, "brilho", 7);
      const quem = a.dono && a.dono.nome ? `${encurtar(a.dono.nome, 14)} salvou!` : "A bolha salvou!";
      Cena.texto(quem, tuca.x + 150, tuca.y - 110, { cor: "#7FDBFF", tam: 54, dur: 1.4 });
    } else {
      Cena.explodir(tuca.x, tuca.y, ["#FF6F91", "#FFFFFF"], 24, 460);
      Cena.texto("-1 VIDA", tuca.x + 120, tuca.y - 110, { cor: "#FF6F91", tam: 60, dur: 1.2 });
    }
  },

  morreu(a) {
    const p = this.partida;
    Som.morte();
    Cena.pena(p.mundo.passaro);
    Cena.flash = 0.75;
    Cena.tremor = 34;
    this.morteEm = p.t;
    this.morteInfo = a;
    if (p.recordeSalvo > this.recordeGravado) {
      this.recordeGravado = p.recordeSalvo;
      Config.salvarRecorde(chave, p.recordeSalvo);
    }
  },

  /* ───────── relógio ───────── */

  passo() {
    const p = this.partida;
    const controle = this.quemPilota();
    if (p.fase === "preparo" && config.controle === "streamer") p.fimFase = Math.max(p.fimFase, p.t + PASSO * 2);
    if (p.fase === "voo" && controle === "auto") {
      if (this.piloto.decidir(p.mundo, { neblina: p.ativo("neblina"), assustado: p.t < p.susto })) {
        if (p.pular()) Som.pulo();
      }
    }
    this.contar(p.passo(PASSO));
  },

  quadro(dt, agora) {
    const p = this.partida;
    if (!this.pausado) {
      this.acumulado = Math.min(0.25, this.acumulado + dt);
      while (this.acumulado >= PASSO) {
        this.passo();
        this.acumulado -= PASSO;
      }
    }
    const controle = this.quemPilota();
    Cena.quadro(p, this.pausado ? 0 : dt, agora);
    Hud.placar(p, controle);
    if (p.fase === "morte" && this.morteEm != null) {
      if (p.t - this.morteEm > 0.7 && !Hud.$.morte.classList.contains("on")) Hud.morte(this.morteInfo, p, controle);
      Hud.contagemMorte(p.fimFase - p.t);
    }
    if (agora - this.ultimoRanking > 0.5) {
      this.ultimoRanking = agora;
      Hud.ranking(p);
    }
    const dica = p.fase === "preparo" && config.controle === "streamer" ? "Aperte <kbd>Espaço</kbd> ou clique pra voar"
      : p.fase === "preparo" && config.controle === "misto" ? "Piloto automático · <kbd>Espaço</kbd> ou clique e você assume"
      : "";
    if (dica !== this.dicaAtual) {
      this.dicaAtual = dica;
      Hud.dica(dica);
    }
  },

  /* ───────── teclas e testes ───────── */

  testeId: 0,
  teste(tipo, extra = {}) {
    const nomes = ["teste.ana", "teste.beto", "teste.cida", "teste.dudu", "teste.edu", "teste.fefe"];
    const nome = extra.nome || nomes[this.testeId++ % nomes.length];
    this.live.simular({ tipo, usuario: { id: nome, nome }, ...extra });
  },

  tecla(e) {
    if (Painel.aberto()) {
      if (e.key === "Escape") Painel.alternar(false);
      return;
    }
    const k = e.key.toLowerCase();
    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
      e.preventDefault();
      if (!e.repeat) this.pular("streamer");
      return;
    }
    const digito = /^Digit([1-5])$/.exec(e.code);
    if (digito) {
      const i = Number(digito[1]) - 1;
      const time = e.shiftKey ? "ajuda" : "caos";
      const f = config.faixas[i];
      const presente = time === "ajuda" ? config.times.ajuda.presentes[0] : config.times.caos.presentes[0];
      this.teste("presente", { nome: `teste.${time}${i + 1}`, presente: { nome: presente, moedas: f.moedas, quantidade: 1, total: f.moedas } });
      return;
    }
    if (k === "p") { e.preventDefault(); Painel.alternar(true); }
    else if (e.key === "Enter") { this.pausado = !this.pausado; this.palco.querySelector(".pausa").hidden = !this.pausado; }
    else if (k === "f") { this.forcado = this.formato === "vertical" ? "horizontal" : "vertical"; this.aplicarFormato(); }
    else if (k === "s") Som.alternar();
    else if (k === "m") {
      const ordem = ["misto", "auto", "streamer"];
      config.controle = ordem[(ordem.indexOf(config.controle) + 1) % ordem.length];
      this.ultimoToque = -Infinity;
      Hud.anunciar({ fita: { misto: "Misto", auto: "Só piloto automático", streamer: "Só o streamer" }[config.controle], cor: "#59C3FF", ms: 1400 });
    } else if (k === "d") this.live.ligarDemo();
    else if (k === "r") this.zerar();
    else if (k === "t") {
      for (let i = 0; i < 10; i++) {
        const nome = "espectador" + Math.floor(Math.random() * 400);
        this.live.simular({ tipo: "comentario", usuario: { id: nome, nome }, texto: Math.random() < 0.5 ? "1" : "2" });
      }
    } else if (k === "c" || k === "x" || k === "q") {
      this.contar(this.partida.encerrarEvento());
      this.contar([this.partida.iniciarEvento({ c: "chinelo", x: "dobro", q: "queijo" }[k])]);
    }
  },

  zerar() {
    this.partida.zerar();
    this.piloto.reiniciar();
    this.morteEm = null;
    Hud.esconderMorte();
    Hud.$.feed.replaceChildren();
  },
};

Jogo.iniciar();
window.Jogo = Jogo;
