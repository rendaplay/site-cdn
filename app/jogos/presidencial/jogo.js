/* Liga as peças: live → regras → cena e HUD, e o relógio das fases.
   largada (3-2-1-JÁ) → correndo → chegada (foto finish) → pódio → nova
   largada. Apoio que chega fora da corrida espera na fila e entra no JÁ. */
"use strict";

const { chave, config, opcoes } = Config.carregar();
const candidatos = window[config.candidatos] || window.CANDIDATOS;
const FILA_LEVE_MAX = 300;

/* A plateia de demonstração do live.js entrega o evento já normalizado;
   as regras falam o pacote do conector. */
const TIPO_DO_PACOTE = { presente: "gift", comentario: "chat", curtida: "like", seguiu: "follow", compartilhou: "share" };
function pacoteDe(ev) {
  const user = { id: ev.usuario.id, nickname: ev.usuario.nome, avatar: ev.usuario.foto };
  const pr = ev.presente || {};
  const data = ev.tipo === "presente" ? { name: pr.nome, coins: pr.moedas, count: pr.quantidade, total_coins: pr.total }
    : ev.tipo === "comentario" ? { text: ev.texto }
    : ev.tipo === "curtida" ? { count: ev.curtidas } : {};
  return { type: TIPO_DO_PACOTE[ev.tipo], user, data };
}

const Jogo = {
  fase: "largada",
  faseT: 0,
  fila: [],
  filaLeve: 0,
  pausado: false,
  ultimo: 0,
  encaixe: "",

  iniciar() {
    this.corrida = new Corrida({ ...config, faixa: (nome, moedas) => (this.configurar ? this.configurar.faixa(nome, moedas) : null) }, candidatos);
    window.corrida = this.corrida;
    this.palco = document.getElementById("palco");
    Hud.montar(this.palco, candidatos, config);
    this.formatoAtual = opcoes.formato || "vertical";
    this.pronto = Cena.montar(document.getElementById("cena"), this.formatoAtual, candidatos, config.arte).then(() => Hud.cabecas());
    this.mudarFormato(this.formatoAtual);
    addEventListener("resize", () => this.encaixar());

    Painel.montar(chave, config);
    this.configurar = montarConfigurar({
      jogo: "presidencial",
      opcoes: () => ["Impulso", "Nitro", "Casca de banana", "Jato"],
      testar: p => this.enviarTeste({ name: p.nome, count: p.quantidade, coins: p.moedas, total_coins: p.total }),
      avancado: () => Painel.alternar(true),
    });

    Vozes.iniciar({ volume: (config.volume ?? 80) / 100, efeitos: ["nitro", "escorregao", "jato", "torcida-forte", "tiro", "apito"] });
    Vozes.ligado = config.som !== false;
    this.ligarSomDeFundo();

    this.live = conectarLive({
      ws: `ws://127.0.0.1:${opcoes.porta}`,
      demo: {
        ligado: opcoes.demo,
        semente: opcoes.semente,
        ritmo: 1.2,
        presentes: [
          { nome: "Rose", moedas: 1, peso: 30, lado: 0 },
          { nome: "White Rose", moedas: 1, peso: 30, lado: 1 },
          { nome: "Finger Heart", moedas: 5, peso: 8 },
          { nome: "Doughnut", moedas: 30, peso: 4 },
          { nome: "Hand Heart", moedas: 100, peso: 1 },
          { nome: "Galaxy", moedas: 1000, peso: 0.2 },
        ],
        lados: [{ comentarios: ["13", "lula"] }, { comentarios: ["22", "flavio"] }],
      },
      aoPacote: p => this.receber(p),
      aoEvento: (ev, live) => { if (live.modo === "demo") this.receber(pacoteDe(ev)); },
      aoEstado: e => Hud.sinal(e),
    });
    Hud.sinal(this.live.estado);

    addEventListener("keydown", e => this.tecla(e));
    this.novaLargada(true);
    requestAnimationFrame(t => this.quadro(t));
  },

  /* ───────────── som ───────────── */

  ligarSomDeFundo() {
    Vozes.musica("musica-corrida", (config.musica ?? 100) / 100);
    if (!this.torcida) {
      this.torcida = new Audio(`${Vozes.base}efeitos/torcida.mp3`);
      this.torcida.loop = true;
      const destravar = () => { if (this.torcidaLigada() && this.torcida.paused) this.torcida.play().catch(() => {}); };
      for (const ev of ["pointerdown", "touchend", "keydown"]) addEventListener(ev, destravar, true);
      document.addEventListener("visibilitychange", () => { if (!document.hidden) destravar(); });
    }
    this.torcida.volume = Math.min(1, Vozes.volume * 0.72);
    if (this.torcidaLigada()) this.torcida.play().catch(() => {});
    else this.torcida.pause();
  },

  torcidaLigada() { return Vozes.ligado && Vozes.volume > 0; },

  ritmoDaMusica(r) { if (Vozes._musica) Vozes._musica.playbackRate = r; },

  somDe(a) {
    if (a.tipo === "efeito") {
      if (a.efeito === "nitro") Vozes.efeito("nitro", 0.8);
      else if (a.efeito === "banana") { Vozes.efeito("escorregao"); Vozes.falar("provocacao", a.lado); }
      else if (a.efeito === "jato") { Vozes.efeito("jato"); Vozes.falar("massa", "narrador"); }
    } else if (a.tipo === "ultrapassagem") {
      Vozes.efeito("torcida-forte", 0.7);
      if (!Vozes.falar("ultrapassagem", a.lado)) Vozes.falar("ultrapassagem", "narrador");
    } else if (a.tipo === "encostou") Vozes.falar("encostou", "narrador");
    else if (a.tipo === "retaFinal") {
      Vozes.falar("retaFinal", "narrador");
      this.ritmoDaMusica(1.15);
    }
  },

  /* ───────────── live ───────────── */

  receber(p) {
    if (p.type === "bridge_status") return this.aoStatus(p.data || {});
    /* O conector só avisa "mock" uma vez, ao subir; se o jogo abriu
       depois, reconhece a simulação pelo id dos espectadores falsos. */
    if (!this.corrida.lados.ladoSimulado && /^mock\d+$/.test((p.user || {}).id)) this.aoStatus({ mode: "mock" });
    if (this.fase !== "correndo") {
      /* presente e follow nunca saem da fila; o teto vale só pro resto */
      const garantido = p.type === "gift" || p.type === "follow";
      if (garantido) this.fila.push(p);
      else if (this.filaLeve < FILA_LEVE_MAX) { this.fila.push(p); this.filaLeve++; }
      return;
    }
    this.contar(this.corrida.receber(p));
  },

  /* `conector.py --mock` não tem quem comente 13/22 nem quem mande a rosa
     branca: cada espectador falso torce por um lado fixo, pelo id. */
  aoStatus(d) {
    /* o usuário de teste do ⚙ comenta o lado antes; o hash não pode passar por cima */
    if (d.mode === "mock") this.corrida.lados.ladoSimulado = id => /^teste\d/.test(id) ? -1 : hashTexto(id) % 2;
    else if (d.mode === "live") this.corrida.lados.ladoSimulado = null;
  },

  contar(lista) {
    if (!lista.length) return;
    for (const a of lista) {
      if (a.tipo === "chegada") { this.chegou(a); continue; }
      Cena.efeito(a);
      this.somDe(a);
    }
    Hud.contar(lista, this.corrida);
  },

  /* ───────────── fases ───────────── */

  novaLargada(primeira = false) {
    if (!primeira) this.corrida.novaCorrida();
    Cena.novaCorrida(this.corrida.numero, config.pista);
    this.fase = "largada";
    this.faseT = 0;
    this.contou = 0;
    Hud.cancelarFaixas();
    Hud.fecharPodio();
    Hud.fecharFoto();
    Hud.placar(this.corrida);
    Hud.torcedores(this.corrida);
    this.ritmoDaMusica(1);
    Vozes.falar("largada", "narrador");
  },

  /* 3-2-1 com 0,8 s de respiro antes, pro palco aparecer parado. */
  largada() {
    const passo = Math.max(0.5, (config.largada || 3) / 3);
    const n = Math.floor((this.faseT - 0.8) / passo) + 1;
    if (n > this.contou && n >= 1) {
      this.contou = n;
      if (n <= 3) Hud.contagem(String(4 - n));
      else this.ja();
    }
  },

  ja() {
    Hud.contagem("JÁ!");
    Vozes.efeito("tiro");
    Cena.empolgar(-1, 1);
    this.fase = "correndo";
    this.faseT = 0;
    const fila = this.fila;
    this.fila = [];
    this.filaLeve = 0;
    for (const p of fila) {
      if (this.fase !== "correndo") { this.fila.push(p); continue; }
      this.contar(this.corrida.receber(p));
    }
  },

  chegou(a) {
    this.fase = "chegada";
    this.faseT = 0;
    this.vencedor = a.vencedor;
    this.tempoFinal = a.tempo;
    this.fotoMostrada = false;
    Hud.cancelarFaixas();
    Cena.fotoFinish(a.vencedor);
    Vozes.efeito("apito");
    Vozes.falar("chegada", "narrador");
    Hud.placar(this.corrida);
  },

  chegada() {
    const congelou = Cena.foto && Cena.foto.congelado;
    if ((congelou || this.faseT > 4) && !this.fotoMostrada) {
      this.fotoMostrada = true;
      this.congelouEm = this.faseT;
      if (Cena.foto) Cena.foto.congelado = true;
      Hud.fotoFinish(this.vencedor);
    }
    if (this.fotoMostrada && this.faseT - this.congelouEm > (config.chegada || 2.4)) this.podio();
  },

  podio() {
    this.fase = "podio";
    this.faseT = 0;
    Hud.cancelarFaixas();
    Hud.fecharFoto();
    Hud.podio({ vencedor: this.vencedor, corrida: this.corrida, tempo: this.tempoFinal, segundos: config.podio });
    Vozes.efeito("fanfarra");
    Vozes.falar("vitoria", this.vencedor);
  },

  /* ───────────── quadro ───────────── */

  quadro(t) {
    const dt = Math.min(0.05, Math.max(0, (t - (this.ultimo || t)) / 1000));
    this.ultimo = t;
    if (!this.pausado) this.passo(dt);
    requestAnimationFrame(x => this.quadro(x));
  },

  passo(dt) {
    this.faseT += dt;
    if (this.fase === "largada") this.largada();
    else if (this.fase === "correndo") this.contar(this.corrida.avancar(dt * Cena.ritmo, Date.now()));
    else if (this.fase === "chegada") this.chegada();
    else if (this.fase === "podio") {
      Hud.proxima(config.podio - this.faseT);
      Hud.confete.quadro(dt);
      if (this.faseT >= config.podio) this.novaLargada();
      return;
    }
    Cena.quadro(dt, this.corrida, this.fase);
    Hud.quadro(dt, this.corrida, this.fase);
  },

  /* ───────────── palco ───────────── */

  mudarFormato(nome) {
    this.formatoAtual = nome;
    this.palco.classList.toggle("vertical", nome === "vertical");
    this.palco.classList.toggle("horizontal", nome === "horizontal");
    this.encaixe = "";
    this.encaixar();
  },

  /* O palco tem 1080×1920 (ou 1920×1080) e escala pra caber na janela sem
     distorcer; na vertical, em tela mais comprida, ele estica até 9:21. O
     canvas desenha no tamanho real da tela. Janela de tamanho 0 (aba em
     segundo plano, iframe ainda montando) tenta de novo no próximo quadro. */
  encaixar() {
    if (!innerWidth || !innerHeight) { requestAnimationFrame(() => this.encaixar()); return; }
    const vertical = this.formatoAtual !== "horizontal";
    const altura = vertical ? Math.min(2520, Math.max(1920, Math.round(1080 * innerHeight / innerWidth))) : 0;
    const medida = `${this.formatoAtual}:${altura}`;
    if (medida !== this.encaixe) {
      this.encaixe = medida;
      Cena.formato(this.formatoAtual, altura);
      this.palco.style.height = vertical ? `${altura}px` : "";
      this.palco.style.setProperty("--sobra", `${vertical ? (altura - 1920) / 2 : 0}px`);
      Hud.medir();
    }
    const { W, H } = Cena.L;
    const escala = Math.min(innerWidth / W, innerHeight / H);
    this.palco.style.transform = `translate(${(innerWidth - W * escala) / 2}px, ${(innerHeight - H * escala) / 2}px) scale(${escala})`;
    Cena.dimensionar(escala);
  },

  pausar() {
    this.pausado = !this.pausado;
    Hud.pausa(this.pausado);
  },

  /* ───────────── testes ───────────── */

  presenteTeste(lado) {
    const valores = [1, 1, 5, 10, 30, 99, 199, 500, 1000];
    const moedas = valores[Math.floor(Math.random() * valores.length)];
    this.enviarTeste({ name: candidatos[lado].presente.aceitos[0], count: 1, coins: moedas, total_coins: moedas }, lado);
  },

  /* Quem testa pelo ⚙ escolhe o presente, não o lado: o usuário de teste
     comenta o número antes, senão o presente fica esperando lado. */
  enviarTeste(data, lado) {
    if (lado === undefined) {
      const dono = candidatos.findIndex(c => (c.presente.aceitos || []).includes(data.name));
      lado = dono >= 0 ? dono : (this.ladoTeste = 1 - (this.ladoTeste || 0));
    }
    const id = `teste${lado}${Math.floor(Math.random() * 3)}`;
    const user = { id, nickname: id, avatar: null };
    this.receber({ type: "chat", user, data: { text: String(candidatos[lado].numero) } });
    this.receber({ type: "gift", user, data });
  },

  tecla(e) {
    if (Painel.aberto()) {
      if (e.key === "Escape") Painel.alternar(false);
      return;
    }
    if (e.target && /input|select|textarea/i.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === "p") { e.preventDefault(); Painel.alternar(true); }
    else if (k === " ") { e.preventDefault(); this.pausar(); }
    else if (k === "n") this.novaLargada();
    else if (k === "r") {
      this.corrida.serie = [0, 0];
      this.corrida.numero = 0;
      this.novaLargada();
    }
    else if (k === "f") this.mudarFormato(this.formatoAtual === "vertical" ? "horizontal" : "vertical");
    else if (k === "s") { Vozes.alternar(); this.ligarSomDeFundo(); }
    else if (k === "d" && this.live.modo !== "demo") this.live.ligarDemo();
    else if (k === "1" || k === "2") this.presenteTeste(Number(k) - 1);
  },
};

window.Jogo = Jogo;
Jogo.iniciar();
