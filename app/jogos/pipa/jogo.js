/* Liga as peças: live (comum/live.js) → regras → céu e HUD, e o relógio.
   O relógio do jogo (`agora`, ms) só anda fora da pausa, então relo,
   escudo e evento congelam juntos com a tela. */
"use strict";

const { chave, config, opcoes } = Config.carregar();
const combate = new Combate(config);

const CHAT_DEMO = [
  "boa tarde live", "kkkkkk", "kkkkkkkkk", "manda no gás", "corta ele", "ê cortou", "aparei",
  "relo relo", "vai pipa", "sobe sobe", "quero ver cortar o rei", "minha pipa", "olha a linha",
  "salve quebrada", "cheguei", "bora", "vou cobrar", "aí sim", "eita", "pipa no alto",
];

const Jogo = {
  agora: 0,
  pausado: false,
  ultimoHud: 0,
  ultimoCobrou: -Infinity,
  info: { rei: null, top: new Set() },

  iniciar() {
    Som.aplicar(config);
    this.palco = document.getElementById("palco");
    this.palco.classList.toggle("seguro", !!config.modoSeguro);
    Ceu.montar(document.getElementById("ceu"));
    Hud.montar(this.palco, config);
    Painel.montar(chave, config);
    combate.distancia = (a, b) => Ceu.distancia(a, b);

    this.forcado = opcoes.formato;
    this.aplicarFormato();
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
    const quadro = ms => {
      const dt = Math.min(0.05, (ms - antes) / 1000);
      antes = ms;
      this.quadro(dt);
      requestAnimationFrame(quadro);
    };
    requestAnimationFrame(quadro);
  },

  aplicarFormato() {
    const f = this.forcado || (innerHeight >= innerWidth ? "vertical" : "horizontal");
    const { W, H } = FORMATOS[f];
    if (f !== this.formato) {
      this.formato = f;
      this.palco.classList.toggle("vertical", f === "vertical");
      this.palco.classList.toggle("horizontal", f === "horizontal");
      Ceu.aplicarFormato(f);
    }
    const s = Math.min(innerWidth / W, innerHeight / H);
    this.palco.style.transform =
      `translate(${(innerWidth - W * s) / 2}px, ${(innerHeight - H * s) / 2}px) scale(${s})`;
  },

  receber(ev) {
    const quem = ev.usuario;
    const t = this.agora;
    let lista = [];
    if (ev.tipo === "comentario") lista = combate.comentario(quem, ev.texto, t);
    else if (ev.tipo === "presente") {
      const p = ev.presente;
      lista = combate.presente(quem, { nome: p.nome, moedas: p.total, quantidade: p.quantidade }, t);
    } else if (ev.tipo === "curtida") lista = combate.curtida(quem, ev.curtidas, t);
    else if (ev.tipo === "seguiu") lista = combate.seguiu(quem, t);
    else if (ev.tipo === "compartilhou") lista = combate.compartilhou(quem, t);
    this.contar(lista);
  },

  contar(lista) {
    for (const a of lista) {
      const j = a.id && combate.jogadores.get(a.id);
      if (a.tipo === "entrou") {
        Ceu.entrar(a.id, j, this.agora);
        Som.entrou();
      } else if (a.tipo === "saiu") {
        a.motivo === "vento" ? Ceu.levar(a.id) : Ceu.recolher(a.id);
      } else if (a.tipo === "gas" || a.tipo === "segurou") {
        Ceu.gas(a.id);
      } else if (a.tipo === "presente") {
        this.presente(a, j);
      } else if (a.tipo === "relo") {
        Som.relo();
        if (a.duelo.cobranca) {
          const pa = Ceu.pipas.get(a.duelo.a);
          if (pa) Ceu.texto("COBRANÇA", pa.corpo.x, pa.corpo.y - 110, 0.6, "#FFD23F");
        }
      } else if (a.tipo === "corte") {
        this.corte(a);
      } else if (a.tipo === "bloqueou") {
        Ceu.bloquear(a.autor, a.vitima);
      } else if (a.tipo === "escudo") {
        const p = Ceu.pipas.get(a.id);
        if (p) Ceu.texto("ESCUDO", p.corpo.x, p.corpo.y - 80, 0.55, "#BFF3FF");
      } else if (a.tipo === "seguiu") {
        Hud.aviso(`<b>${escapar(j.nome)}</b> seguiu e soltou a pipa`);
      } else if (a.tipo === "compartilhou") {
        Hud.aviso(`<b>${escapar(j.nome)}</b> compartilhou: escudo ${config.escudoCompartilhar} s`);
      } else if (a.tipo === "evento") {
        this.evento(a);
      } else if (a.tipo === "fimEvento") {
        this.fimEvento(a);
      } else if (a.tipo === "aparou") {
        Ceu.pegarDourada(a.id);
      }
    }
  },

  presente(a, j) {
    const f = config.faixas[a.faixa];
    Som.presente(a.faixa);
    if (a.faixa >= 2) {
      Hud.aviso(`<b>${escapar(j.nome)}</b> mandou ${escapar(f.nome)}`, "presente");
    }
    if (a.moedas >= config.destaqueMoedas || f.fogo) {
      Hud.anunciar({
        fita: a.dourado ? `${f.nome} (dourado)` : f.nome,
        nome: j.nome,
        texto: `${a.quantidade > 1 ? a.quantidade + "× " : ""}${a.nome || "presente"} · ${f.efeito}`,
        cor: f.fogo ? "#FF6A1A" : a.faixa >= 3 ? "#FFD23F" : "#8FE3FF",
        jogador: j,
        ms: f.fogo ? 3600 : 2600,
      });
    }
    const p = Ceu.pipas.get(a.id);
    if (p) {
      p.flash = 1;
      Ceu.explodir(p.corpo.x, p.corpo.y, [p.cores[0], p.cores[1], "#FFFFFF"], 20 + a.faixa * 15, 6 + a.faixa * 2, "faisca");
    }
    if (f.fogo) Ceu.tremor = 18;
  },

  corte(a) {
    const autor = combate.jogadores.get(a.autor);
    const vitima = combate.jogadores.get(a.vitima);
    const grande = a.eraRei || a.cobrou || a.fogo;
    Ceu.cortar(a.autor, a.vitima, { grande, fogo: a.fogo });
    Hud.corte(autor, vitima, a);
    Som.corte(grande);
    /* Anúncio grande só pra coroa que durou: no começo da live a coroa
       troca toda hora e o anúncio perderia a graça. */
    if (a.eraRei && a.reiPor >= config.rei.anuncio * 1000) {
      Hud.anunciar({ fita: "Derrubou o rei", nome: autor.nome,
        texto: `cortou ${vitima.nome} depois de ${tempoNoAr(a.tempoNoAr)} no ar`, cor: "#FFD23F", jogador: autor });
    } else if (a.cobrou && a.duelo && a.duelo.tipo === "ataque" && this.agora - this.ultimoCobrou > 20000) {
      /* Cobrança do relo natural fica no céu e no feed. Anúncio é pra quem
         pagou pra cobrar, e no máximo um a cada 20 s: com presente
         frequente (ou dois rivais pagando em loop) virava enxurrada. */
      this.ultimoCobrou = this.agora;
      Hud.anunciar({ fita: "Cobrou!", nome: autor.nome, texto: `devolveu o corte em ${vitima.nome}`, cor: "#FF8FB1", jogador: autor });
    }
  },

  evento(a) {
    Som.evento();
    const info = EVENTOS[a.evento];
    Hud.anunciar({ fita: "Surpresa", nome: info.titulo, texto: info.texto, cor: "#FFD23F", ms: 3000 });
    if (a.evento === "ventania") {
      Vento.forca = 2.6;
      Ceu.tingir = { ...Ceu.tingir, cor: "#24164A", alvo: 0.28 };
    } else if (a.evento === "dourado") {
      Ceu.tingir = { ...Ceu.tingir, cor: "#FFC23A", alvo: 0.12 };
    } else if (a.evento === "avoada") {
      Ceu.soltarDourada(config.surpresa.duracao.avoada);
    }
  },

  fimEvento(a) {
    Vento.forca = 1;
    Ceu.tingir = { ...Ceu.tingir, alvo: 0 };
    if (a.evento === "ventania") {
      const n = a.levou.length;
      Hud.anunciar(n
        ? { fita: "Ventania", nome: `${n} ${n === 1 ? "pipa foi" : "pipas foram"} embora`, texto: "quem comentou segurou a linha", cor: "#B9A8FF" }
        : { fita: "Ventania", nome: "Todo mundo segurou!", texto: "o chat salvou as pipas", cor: "#B9A8FF" });
    } else if (a.evento === "avoada") {
      if (a.dono) {
        const j = combate.jogadores.get(a.dono);
        const como = a.naLinha ? "a dourada enroscou na linha" : "pegou a pipa dourada";
        Hud.anunciar({ fita: "Aparou!", nome: j.nome, texto: `${como}: escudo e 2 cortes`, cor: "#FFD23F", jogador: j });
      } else Ceu.largarDourada();
    }
  },

  quadro(dt) {
    if (!this.pausado) {
      this.agora += dt * 1000;
      this.contar(combate.tick(this.agora));
      const fogo = combate.duelos.some(d => d.fogo);
      if (fogo) Ceu.tingir = { ...Ceu.tingir, cor: "#FF3A1A", alvo: 0.16 };
      else if (Ceu.tingir.cor === "#FF3A1A") Ceu.tingir = { ...Ceu.tingir, alvo: 0 };
    }
    if (this.agora - this.ultimoHud > 250) {
      this.ultimoHud = this.agora;
      const rei = combate.rei(this.agora);
      const ranking = combate.ranking(5);
      this.info = { rei: rei ? rei.id : null, top: new Set(ranking.slice(0, 3).map(j => j.id)) };
      Hud.placar(combate, this.agora);
      Hud.ranking(ranking);
      Ceu.areas = Hud.areas();
      this.conferirCeu();
    }
    Hud.evento(combate.evento, this.agora);
    Ceu.quadro(this.pausado ? 0 : dt, combate, this.agora, this.info);
  },

  /* Rede de segurança: a tela segue a regra mesmo se algum acontecimento
     se perder (ex.: entrou e saiu no mesmo quadro). */
  conferirCeu() {
    for (const id of combate.pipas.keys()) {
      if (!Ceu.pipas.has(id)) Ceu.entrar(id, combate.jogadores.get(id), this.agora);
    }
    for (const [id, p] of Ceu.pipas) {
      if (!combate.pipas.has(id) && p.estado !== "recolhendo") Ceu.recolher(id);
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
    if (k === "p") { e.preventDefault(); Painel.alternar(true); }
    else if (k === " ") { e.preventDefault(); this.pausado = !this.pausado; this.palco.querySelector(".pausa").hidden = !this.pausado; }
    else if (k === "f") { this.forcado = this.formato === "vertical" ? "horizontal" : "vertical"; this.aplicarFormato(); }
    else if (k === "s") Som.alternar();
    else if (k === "d") this.live.ligarDemo();
    else if (k === "r") this.zerar();
    else if (k === "t") {
      for (let i = 0; i < 10; i++) {
        const nome = "espectador" + Math.floor(Math.random() * 400);
        this.live.simular({ tipo: "comentario", usuario: { id: nome, nome }, texto: "bora" });
      }
    } else if (k >= "1" && k <= "5") {
      const f = config.faixas[Number(k) - 1];
      this.teste("presente", { presente: { nome: "Teste", moedas: f.moedas, quantidade: 1, total: f.moedas } });
    } else if (k === "v" || k === "c" || k === "a") {
      if (combate.evento) this.contar(combate.encerrarEvento(this.agora));
      this.contar(combate.surpresa({ v: "ventania", c: "dourado", a: "avoada" }[k], this.agora));
    }
  },

  zerar() {
    combate.zerar(this.agora);
    Ceu.pipas.clear();
    Ceu.avoadas = [];
    Ceu.largarDourada();
    Vento.forca = 1;
    Ceu.tingir = { ...Ceu.tingir, alvo: 0 };
    Hud.$.feed.replaceChildren();
    this.ultimoCobrou = -Infinity;
  },
};

Jogo.iniciar();
window.Jogo = Jogo;
window.combate = combate;
