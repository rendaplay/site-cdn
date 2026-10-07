/* Liga as peças: live (comum/live.js) → regras → cena e HUD, e o relógio.
   O relógio do jogo (`agora`, ms) só anda fora da pausa: contra-ataque,
   evento e tela de vitória congelam junto com a tela. */
"use strict";

const { chave, config, opcoes } = Config.carregar();
const raid = new Raid(config);

const CHAT_DEMO = [
  "boa noite live", "kkkkkk", "kkkkkkkkk", "bora derrubar", "bate nele", "soco", "vai vai vai",
  "pega ele", "tá quase", "manda chinelada", "olha a vida dele", "aí sim", "eita", "que isso kkk",
  "cheguei", "salve salve", "quero o golpe final", "mãe chegou kkk", "derruba", "🔥🔥🔥",
];

const Jogo = {
  agora: 0,
  pausado: false,
  ultimoHud: 0,
  ultimaFala: 0,
  agenda: [],

  iniciar() {
    Som.aplicar(config);
    this.palco = document.getElementById("palco");
    Cena.montar(document.getElementById("arena"));
    this.forcado = opcoes.formato;
    this.aplicarFormato();
    this.palco.classList.toggle("seguro", !!config.modoSeguro);
    Hud.montar(this.palco, config);
    Painel.montar(chave, config);
    addEventListener("resize", () => this.aplicarFormato());
    addEventListener("keydown", e => this.tecla(e));
    this.entrarChefe(raid.chefe);

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
    const { W, H } = LAYOUTS[f];
    if (f !== this.formato) {
      this.formato = f;
      this.palco.classList.toggle("vertical", f === "vertical");
      this.palco.classList.toggle("horizontal", f === "horizontal");
      Cena.aplicarFormato(f);
    }
    const s = Math.min(innerWidth / W, innerHeight / H);
    this.palco.style.transform =
      `translate(${(innerWidth - W * s) / 2}px, ${(innerHeight - H * s) / 2}px) scale(${s})`;
  },

  /* Agenda pelo relógio do jogo (pausa e gravação quadro a quadro seguem junto). */
  depois(ms, fn) { this.agenda.push({ em: this.agora + ms, fn }); },

  receber(ev) {
    const quem = ev.usuario;
    const t = this.agora;
    let lista = [];
    if (ev.tipo === "comentario") lista = raid.comentario(quem, ev.texto, t);
    else if (ev.tipo === "presente") {
      const p = ev.presente;
      lista = raid.presente(quem, { nome: p.nome, moedas: p.total, quantidade: p.quantidade }, t);
    } else if (ev.tipo === "curtida") lista = raid.curtida(quem, ev.curtidas, t);
    else if (ev.tipo === "seguiu") lista = raid.seguiu(quem, t);
    else if (ev.tipo === "compartilhou") lista = raid.compartilhou(quem, t);
    this.contar(lista);
  },

  contar(lista) {
    const c = raid.chefe;
    const def = c.def;
    for (const a of lista) {
      const j = a.id ? raid.jogadores.get(a.id) : null;
      switch (a.tipo) {
        case "presente":
          if (a.faixa >= 0) Som.presente(a.faixa);
          if (a.faixa >= 0 && a.moedas >= config.destaqueMoedas) {
            const f = config.faixas[a.faixa];
            /* O Chinelo da Mãe tem a própria entrada: o cartão vem depois da pancada. */
            if (a.faixa >= 4) Hud.esconderFala();
            const texto = `${a.quantidade > 1 ? a.quantidade + "× " : ""}${a.nome || "presente"} · ${fmt.format(Math.round(a.moedas * config.danoPorMoeda * raid.multiplicador(this.agora, "presente")))} de dano`;
            const anunciar = () => Hud.anunciar({
              fita: f.nome,
              nome: j.nome,
              texto,
              cor: a.faixa >= 4 ? "#FFE066" : a.faixa >= 3 ? "#FF4A6A" : "#FF7A3A",
              jogador: j,
              ms: a.faixa >= 4 ? 3600 : 2600,
            });
            if (a.faixa < 4) anunciar();
            else this.depois(1500, () => { if (raid.chefe.estado === "luta") anunciar(); });
          }
          break;
        case "dano":
          Cena.golpe(a, j);
          if (a.origem === "presente") Som.golpe(a.faixa); else Som.soco();
          if (a.origem === "presente" && a.faixa >= 2 && a.faixa < 4 && Math.random() < 0.45) this.falar(sortear(def.falas), 900);
          if (a.origem === "presente" && a.faixa >= 4) {
            this.palco.classList.add("cinema");
            this.depois(1500, () => this.palco.classList.remove("cinema"));
          }
          break;
        case "guardado":
          if (a.faixa >= 0 || a.origem !== "comentario") Hud.aviso(`<b>${escapar(j.nome)}</b> guardou ${fmt.format(a.dano)} de dano pro próximo chefão`);
          break;
        case "furia":
          Som.fase();
          Hud.anunciar({ fita: "Fúria", nome: c.nome, texto: "50% de vida: agora ele ataca mais", cor: "#FF4A3A" });
          this.falar(def.furia);
          break;
        case "escudo":
          Cena.ligarEscudo();
          Som.fase();
          Hud.anunciar({ fita: "Escudo", nome: def.escudo.replace(/!$/, ""), texto: `${fmt.format(a.valor)} de escudo pra quebrar`, cor: "#6FE3FF" });
          this.falar(def.escudo);
          break;
        case "escudoQuebrado":
          Cena.quandoAcertar(() => { Cena.escudoQuebrou(); Som.escudoQuebrado(); });
          Hud.anunciar({ fita: "Quebrou o escudo", nome: j.nome, texto: "agora é direto na vida", cor: "#6FE3FF", jogador: j });
          break;
        case "faltam":
          Som.alerta();
          Hud.faltam(raid, Cena.emVoo, this.agora, true);
          break;
        case "contra":
          Som.alerta();
          this.falar(def.contraFala, 3200);
          break;
        case "interrompido":
          Hud.anunciar({ fita: "Interrompido!", nome: j.nome, texto: `segurou o ${def.contra.toLowerCase()}: chefão tonto, dano ×1,5`, cor: "#FFD23F", jogador: j });
          this.falar(def.tonto);
          break;
        case "contraAcertou":
          Cena.contraAcertou();
          if (a.cura > 0) Cena.curar(a.cura);
          Som.fase();
          Hud.anunciar({ fita: def.contra, nome: "Ninguém segurou", texto: `ele se curou ${fmt.format(a.cura)}`, cor: "#5CFF9A" });
          this.depois(600, () => this.falar(def.curou));
          break;
        case "derrotado":
          this.derrota(a);
          break;
        case "novoChefe":
          this.entrarChefe(a.chefe);
          break;
        case "evento": {
          Som.evento();
          const info = EVENTOS[a.evento];
          const texto = a.evento === "mutirao" ? `${config.surpresa.mutirao.pessoas} ${info.texto}` : info.texto;
          Hud.anunciar({ fita: "Surpresa", nome: info.titulo, texto, cor: info.cor, ms: 3000 });
          break;
        }
        case "mutirao":
          Hud.anunciar({ fita: "Mutirão!", nome: `${a.ids.length} pessoas juntas`, texto: `golpe coletivo de ${fmt.format(a.dano)}`, cor: "#5CFF9A", ms: 3000 });
          break;
        case "seguiu":
          Hud.aviso(`<b>${escapar(j.nome)}</b> seguiu: ${fmt.format(config.seguiu)} de dano`);
          break;
        case "compartilhou":
          Hud.aviso(`<b>${escapar(j.nome)}</b> compartilhou: ${fmt.format(config.compartilhou)} de dano`);
          break;
      }
    }
  },

  falar(texto, ms = 2800) {
    if (!texto) return;
    this.ultimaFala = this.agora;
    Hud.falar(texto, ms);
    Cena.falar(Math.min(1.6, ms / 1000));
  },

  entrarChefe(c) {
    Hud.fecharFinal();
    Cena.trocarChefe(c);
    Hud.chefe(c);
    this.depois(700, () => Hud.anunciar({ fita: `Chefão ${c.numero}`, nome: c.nome, texto: `${fmt.format(c.vidaMax)} de vida`, cor: c.def.cor, ms: 2600 }));
    this.depois(1100, () => this.falar(c.def.entrada, 3000));
  },

  /* Golpe final: espera o golpe chegar, câmera lenta, explode, nome gigante
     com coroa e depois a tela de vitória até o próximo chefão. */
  derrota(a) {
    const final = raid.jogadores.get(a.golpeFinal);
    const danoFinal = this.ultimoDano(a.golpeFinal);
    Hud.limparAnuncios();
    Cena.quandoAcertar(() => {
      Cena.derrotar();
      this.falar(a.chefe.def.derrota, 1400);
      Som.golpeFinal();
      this.depois(1700, () => { Hud.golpeFinal(final, danoFinal); Som.vitoria(); });
      this.depois(5000, () => Hud.vitoria(a, raid, this.nomeDoProximo()));
    });
  },

  nomeDoProximo() {
    const lista = raid.cfg.chefes;
    const n = raid.rodada + 1;
    const volta = Math.floor(n / lista.length) + 1;
    return lista[n % lista.length].nome + (volta > 1 ? " " + (ROMANOS[volta] || volta) : "");
  },

  ultimoDano(id) {
    const ef = [...Cena.efeitos].reverse().find(e => e.a && e.a.id === id);
    return ef ? ef.a.dano : 0;
  },

  quadro(dt) {
    if (!this.pausado) {
      this.agora += dt * 1000;
      const vencidos = this.agenda.filter(x => x.em <= this.agora);
      this.agenda = this.agenda.filter(x => x.em > this.agora);
      vencidos.forEach(x => x.fn());
      this.contar(raid.tick(this.agora));
      const c = raid.chefe;
      if (c.estado === "luta" && c.curando) Cena.curaLenta();
      if (c.estado === "luta" && this.agora - this.ultimaFala > 18000 && c.def.falas.length) this.falar(sortear(c.def.falas));
      if (c.estado === "derrotado") Hud.contagemVitoria((raid.proximoEm - this.agora) / 1000);
    }
    Hud.vida(raid.chefe, Cena.emVoo, this.pausado ? 0 : dt);
    Hud.estado(raid, this.agora);
    Hud.chips(raid, this.agora);
    if (this.agora - this.ultimoHud > 250) {
      this.ultimoHud = this.agora;
      Hud.placar(raid);
      Hud.faltam(raid, Cena.emVoo, this.agora);
    }
    Cena.quadro(this.pausado ? 0 : dt, raid, this.agora);
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
    } else if (k === "e") {
      if (raid.evento) this.contar([raid.encerrarEvento(this.agora)]);
      const ordem = raid.ordemSurpresa();
      this.contar([raid.surpresa(ordem[raid.rodizio++ % ordem.length], this.agora)]);
    } else if (k === "a") {
      this.contar(raid.forcarContra(this.agora));
    } else if (k === "k" && raid.chefe.estado === "luta") {
      const resto = Math.ceil((raid.chefe.vida + raid.chefe.escudo) / config.danoPorMoeda);
      this.teste("presente", { presente: { nome: "Teste", moedas: resto, quantidade: 1, total: resto } });
    }
  },

  zerar() {
    raid.zerar(this.agora);
    this.agenda = [];
    Cena.efeitos = [];
    Cena.fichas = [];
    Cena.numeros = [];
    Hud.limparAnuncios();
    this.entrarChefe(raid.chefe);
  },
};

function sortear(lista) { return lista[Math.floor(Math.random() * lista.length)]; }

Jogo.iniciar();
window.Jogo = Jogo;
window.raid = raid;
