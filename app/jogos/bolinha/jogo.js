/* Liga as peças: live (comum/live.js) → Partida → cena, HUD e som, mais as
   teclas de teste. A física anda em passo fixo de 1/120 s, então a mesa se
   comporta igual em 30, 60 ou 144 Hz. */
"use strict";

const { chave, config, opcoes } = Config.carregar();
const PASSO = 1 / 120;

const CHAT_DEMO = [
  "boa noite live", "kkkkkk", "kkkkkkkkk", "solta a bolinha", "vai no 50", "quase kkk", "aí sim",
  "cai no 20 pfv", "bora rei", "eita", "que isso", "minha bolinha!", "olha a minha", "vaiii",
  "cheguei", "sp na área", "bahia aqui", "nãooo", "manda chuva", "🔥🔥🔥",
];

/* Sorteio com semente (mulberry32): ?semente= repete a mesma mesa. */
function sorteio(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const Jogo = {
  pausado: false,
  acumulado: 0,
  ultimoTop: 0,
  lentoAte: 0,
  ultimoDestaque: -Infinity,
  ultimoNome: -Infinity,
  ultimoBip: -1,
  vistos: new Set(),

  iniciar() {
    Som.aplicar(config);
    this.palco = document.getElementById("palco");
    this.forcado = opcoes.formato;
    this.formato = this.forcado || "vertical";
    const aleatorio = opcoes.semente != null ? sorteio(opcoes.semente + 1) : Math.random;

    this.partida = new Partida(config, this.formato, aleatorio);
    Cena.montar(document.getElementById("mesa"));
    this.palco.classList.toggle("seguro", !!config.modoSeguro);
    Hud.montar(this.palco, config);
    Painel.montar(chave, config);
    this.configurar = montarConfigurar({
      jogo: "bolinha",
      opcoes: () => config.faixas.map(f => f.nome),
      testar: presente => this.teste("presente", { presente }),
      avancado: () => Painel.alternar(true),
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

  /* Celular mais comprido que 9:16 (até 9:21): o palco cresce pra baixo em
     vez de sobrar faixa preta, e HUD e mesa descem um quarto da sobra, pra
     sair de baixo do topo do TikTok sem entrar nos comentários. */
  aplicarFormato(primeira = false) {
    const f = this.forcado || "vertical";
    const { W, zoom } = FORMATOS[f];
    const H = f === "vertical" && innerWidth && innerHeight
      ? Math.min(2520, Math.max(1920, Math.round(1080 * innerHeight / innerWidth)))
      : FORMATOS[f].H;
    if (f !== this.formato || H !== this.altura || primeira) {
      const trocou = f !== this.formato && !primeira;
      this.formato = f;
      this.altura = H;
      this.palco.classList.toggle("vertical", f === "vertical");
      this.palco.classList.toggle("horizontal", f === "horizontal");
      this.palco.style.height = f === "vertical" ? `${H}px` : "";
      const desce = (H - FORMATOS[f].H) / 4;
      this.palco.style.setProperty("--desce", `${desce}px`);
      if (trocou) this.partida.trocarFormato(f);
      Cena.aplicarFormato(W, H, this.partida.mesa, config.potes, zoom, desce);
      Hud.chaveTop = "";
    }
    const s = Math.min(innerWidth / W, innerHeight / H);
    this.palco.style.transform = `translate(${(innerWidth - W * s) / 2}px, ${(innerHeight - H * s) / 2}px) scale(${s})`;
  },

  /* ───────── live ───────── */

  receber(ev) {
    const p = this.partida;
    const quem = ev.usuario;
    let lista = [];
    if (ev.tipo === "comentario") lista = p.comentario(quem, ev.texto);
    else if (ev.tipo === "presente") {
      const pr = ev.presente;
      const faixa = this.configurar.faixa(pr.nome, pr.moedas);
      lista = p.presente(quem, { nome: pr.nome, moedas: pr.total, quantidade: pr.quantidade, faixa });
    } else if (ev.tipo === "curtida") {
      Som.curtida();
      lista = p.curtida(quem, ev.curtidas);
    }
    else if (ev.tipo === "seguiu") lista = p.seguiu(quem);
    else if (ev.tipo === "compartilhou") lista = p.compartilhou(quem);
    this.contar(lista);
  },

  /* Texto que voa na mesa: no celular a mesa sai a ~0,4 do tamanho, então
     na vertical ele cresce pra continuar legível. */
  tam(px) {
    return Math.round(px * (this.formato === "vertical" ? 1.4 : 1));
  },

  /* Ponto de aviso perto do bocal. Avisos seguidos descem um degrau cada,
     pra dois "seguiu!" no mesmo segundo não virarem um borrão. */
  bocal() {
    const d = this.partida.mesa.dims;
    const agora = performance.now();
    this.degrau = agora - (this.ultimoBocal || 0) < 700 ? ((this.degrau || 0) + 1) % 4 : 0;
    this.ultimoBocal = agora;
    return { x: (d.x0 + d.x1) / 2, y: d.topo + 40 + this.degrau * this.tam(70) };
  },

  contar(lista) {
    const p = this.partida;
    const m = p.mesa;
    for (const a of lista) {
      const j = a.id ? p.jogadores.get(a.id) : null;
      switch (a.tipo) {
        case "soltou":
          if (a.bola.dados.bolona) this.bolona(j);
          else Som.soltou();
          break;
        case "pino": {
          const pino = m.pinos[a.pino];
          Som.pino(pino.linha, m.cfg.linhas, a.forca);
          break;
        }
        case "pote": this.pote(a, j); break;
        case "presente": this.presente(a, j); break;
        case "comentou":
          if (!this.vistos.has(a.id)) {
            this.vistos.add(a.id);
            Som.entrou();
          }
          break;
        case "seguiu": {
          Som.seguiu();
          const b = this.bocal();
          Cena.texto(`${encurtar(j.nome, 16)} seguiu!`, b.x, b.y + 30, { cor: OURO, tam: this.tam(40), dur: 1.6, sobe: 30, sub: "bolinha de ouro" });
          break;
        }
        case "compartilhou": {
          Som.seguiu();
          const b = this.bocal();
          Cena.texto(`${encurtar(j.nome, 16)} compartilhou!`, b.x, b.y + 30, { cor: "#7CFF6B", tam: this.tam(40), dur: 1.6, sobe: 30, sub: `+${config.chat.compartilhar} bolinhas` });
          break;
        }
        case "choque": {
          Som.choque();
          Cena.flash = 0.22;
          Cena.flashCor = "#39E6FF";
          Cena.tremor = Math.max(Cena.tremor, 10);
          const f = Cena.moldura();
          Cena.texto("CHOQUE!", f.x + f.w / 2, f.y + f.h * 0.6, { cor: "#39E6FF", tam: this.tam(96), dur: 1.3, sobe: 40, sub: `${fmt.format(config.chat.curtidas)} curtidas` });
          break;
        }
        case "pinoDeOuro":
          Som.pinoDeOuro();
          Hud.anunciar({ fita: "Pino de ouro!", cor: "#E0A800", texto: `bolinha que encostar nele vale ×${config.surpresa.multiplica} por ${config.surpresa.duracao} s`, ms: 3000 });
          break;
        case "fechando":
          Som.apito();
          Hud.anunciar({ fita: "Fim da rodada!", cor: "#FF3D9A", texto: "as últimas bolinhas ainda contam", ms: 2200 });
          break;
        case "podio":
          Som.fanfarra();
          Cena.confete();
          Hud.podio(a, p);
          break;
        case "rodada":
          Som.apito();
          Hud.esconderPodio();
          Hud.anunciar({ fita: `Rodada ${a.rodada}`, cor: "#39E6FF", texto: "comente pra soltar sua bolinha", ms: 2200 });
          break;
      }
    }
  },

  pote(a, j) {
    const p = this.partida;
    const m = p.mesa;
    const x = m.centroDoPote(a.pote);
    const y = m.dims.poteTopo;
    const max = Math.max(...config.potes);
    const cor = a.pontos >= max ? "#FF3D9A" : corDoPote(Math.min(a.pontos, max));
    Cena.potePulou(a.pote, Math.min(1.6, 0.4 + a.pontos / max));
    Cena.faiscas(x, y, [cor, "#FFFFFF"], 6 + Math.min(24, a.pontos), 260 + Math.min(400, a.pontos * 8));
    Som.pote(a.pontos, max);
    const nome = j ? encurtar(j.nome, 12) : "";
    /* Um texto por pote, e nome só em pote bom e um de cada vez: na chuva
       caem dezenas juntas e os nomes, maiores no celular, viravam um borrão. */
    const comNome = a.pontos >= config.destaque && p.t - this.ultimoNome > 0.6;
    if (comNome) this.ultimoNome = p.t;
    Cena.texto(`+${fmt.format(a.pontos)}`, x, y - 50, { cor, tam: this.tam(a.pontos >= 10 ? 46 : 40), dur: 1.2, sub: comNome ? nome : null, chave: "pote" + a.pote });
    if (!a.grande) return;
    Cena.anel(x, y, cor, 160);
    Cena.tremor = Math.max(Cena.tremor, a.pontos >= max ? 14 : 8);
    const extra = a.bola.tocouOuro ? `pino de ouro ×${config.surpresa.multiplica}` : a.bola.dados.dourada ? "bolinha de ouro ×2" : "";
    /* Na chuva cai pote bom toda hora: o destaque grande respira entre um e
       outro, senão vira pisca-pisca. */
    if (p.t - this.ultimoDestaque > 1.6) {
      this.ultimoDestaque = p.t;
      this.lentoAte = performance.now() / 1000 + 0.55;
      Hud.destaque(j, a.pontos, extra);
      Som.destaque(a.pontos);
      Cena.flash = 0.18;
      Cena.flashCor = cor;
    }
  },

  presente(a, j) {
    const f = a.lendario ? config.lendario : config.faixas[a.faixa];
    Som.presente(a.lendario ? 4 : a.faixa);
    if (a.moedas < config.destaqueMoedas && !a.lendario) {
      const b = this.bocal();
      Cena.texto(encurtar(j.nome, 14), b.x, b.y + 30, { cor: COR_FAIXA[a.faixa] || "#FFFFFF", tam: this.tam(40), dur: 1.4, sobe: 30, sub: `+${a.bolinhas} bolinhas` });
    } else {
      Hud.anunciar({
        fita: f.nome,
        cor: a.lendario ? "#FF3D9A" : COR_FAIXA[a.faixa],
        jogador: j,
        texto: `${a.quantidade > 1 ? a.quantidade + "× " : ""}${a.nome || "presente"} · ${f.texto}`,
        lendario: a.lendario,
        ms: a.lendario ? 3800 : a.faixa >= 3 ? 2800 : 2200,
      });
    }
    if (a.faixa >= 3 || a.lendario) {
      Cena.tremor = Math.max(Cena.tremor, 12);
      Cena.confete();
    }
  },

  bolona(j) {
    Som.bolona();
    Cena.tremor = 26;
    Cena.flash = 0.35;
    Cena.flashCor = "#FF3D9A";
    Cena.confete();
    Hud.anunciar({
      fita: "Bolona!", cor: "#FF3D9A", jogador: j,
      texto: `os 3 potes do meio valem ${Math.max(...config.potes)} por ${config.bolonaDuracao} s`, ms: 3000,
    });
  },

  /* ───────── relógio ───────── */

  quadro(dt, agora) {
    const p = this.partida;
    const escala = agora < this.lentoAte ? 0.3 : 1;
    const dtJogo = this.pausado ? 0 : dt * escala;
    this.acumulado = Math.min(0.25, this.acumulado + dtJogo);
    while (this.acumulado >= PASSO) {
      this.contar(p.passo(PASSO));
      this.acumulado -= PASSO;
    }
    Cena.quadro(p, dtJogo, agora, p.jogadores);
    Hud.placar(p);
    if (p.fase === "rodada") {
      const resta = Math.ceil(p.resta());
      if (resta <= 5 && resta >= 1 && resta !== this.ultimoBip) {
        this.ultimoBip = resta;
        Som.bip(resta === 1);
      }
    }
    if (p.fase === "podio") Hud.proxima(p.resta());
    if (agora - this.ultimoTop > 0.4) {
      this.ultimoTop = agora;
      Hud.top(p, this.formato === "horizontal");
    }
  },

  /* ───────── teclas e testes ───────── */

  testeId: 0,
  teste(tipo, extra = {}) {
    const nomes = ["teste.ana", "teste.beto", "teste.cida", "teste.dudu", "teste.edu", "teste.fefe"];
    const nome = extra.nome || nomes[this.testeId++ % nomes.length];
    this.live.simular({ tipo, usuario: { id: nome, nome }, ...extra });
  },

  presenteTeste(moedas, nome) {
    this.teste("presente", { nome, presente: { nome: "Rose", moedas, quantidade: 1, total: moedas } });
  },

  tecla(e) {
    if (Painel.aberto()) {
      if (e.key === "Escape") Painel.alternar(false);
      return;
    }
    const k = e.key.toLowerCase();
    const digito = /^Digit([1-5])$/.exec(e.code);
    if (digito) {
      const i = Number(digito[1]) - 1;
      this.presenteTeste(config.faixas[i].moedas, `teste.faixa${i + 1}`);
      return;
    }
    if (k === "p") { e.preventDefault(); Painel.alternar(true); }
    else if (e.key === "Enter") { this.pausado = !this.pausado; this.palco.querySelector(".pausa").hidden = !this.pausado; }
    else if (k === "f") { this.forcado = this.formato === "vertical" ? "horizontal" : "vertical"; this.aplicarFormato(); }
    else if (k === "s") Som.alternar();
    else if (k === "l") this.presenteTeste(config.lendario.moedas, "teste.lenda");
    else if (k === "g") this.teste("seguiu");
    else if (k === "h") this.teste("compartilhou");
    else if (k === "c") this.teste("curtida", { curtidas: config.chat.curtidas });
    else if (k === "o") {
      this.partida.ultimoPresente = -Infinity;
      this.partida.ultimaSurpresa = -Infinity;
    } else if (k === "e" && this.partida.fase === "rodada") this.partida.fimFase = this.partida.t;
    else if (k === "d") this.live.ligarDemo();
    else if (k === "r") this.zerar();
    else if (k === "t") {
      for (let i = 0; i < 10; i++) {
        const nome = "espectador" + Math.floor(Math.random() * 400);
        this.live.simular({ tipo: "comentario", usuario: { id: nome, nome }, texto: "kkk" });
      }
    }
  },

  zerar() {
    this.partida.zerar();
    this.vistos.clear();
    Hud.esconderPodio();
    Hud.chaveTop = "";
  },
};

Jogo.iniciar();
window.Jogo = Jogo;
