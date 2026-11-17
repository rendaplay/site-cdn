/* Som do Pinball Gigante: trilha synthwave em loop baixo, efeitos (mp3 em
   audio/), o arpejo sintetizado dos presentes e o locutor de fliperama
   (audio/voz/, lista em falas.js). Uma fala por vez, e a música abaixa
   enquanto ele fala. Web Audio com os mp3 baixados por fetch: por file:// o
   fetch falha e o jogo fica só com o sintetizado. Desliga no painel (P), na
   URL (?som=0) ou na S. */
"use strict";

const SONS = ["trilha", "bumper", "estilingue", "flipper", "lancamento", "alvo", "caiu", "multibola", "jackpot",
  "roleta", "rampa", "fogo", "ima", "tilt", "confete", "fanfarra", "fogos"];

/* Falas que passam por cima da que está tocando. As outras esperam o respiro. */
const FALA_FORTE = new Set(["jackpot", "mesa", "podio", "recorde", "multibola", "fogo"]);
const RESPIRO = 1.4;
/* Fala que não pode sumir: espera a anterior acabar em vez de ser descartada. */
const ANUNCIO = new Set(["jackpot", "mesa", "podio", "recorde"]);
const VOLUME_TRILHA = 0.75;
/* Com 12 bolas na mesa os bumpers batem em rajada: poucos de cada vez. */
const MAX_SIMULTANEOS = { bumper: 3, estilingue: 2, flipper: 2, alvo: 3, rampa: 2 };

const Som = {
  ligado: true,
  volume: 0.7,
  musica: 0.25,
  narrador: true,
  _ctx: null,
  _mestre: null,
  _trilha: null,
  _buf: new Map(),
  _fundoLigado: null,
  _fala: null,
  _livreEm: 0,
  _ultimaFala: null,
  _aviso: null,
  _voltou: false,
  _espera: null,
  _tocando: {},
  /* Últimos sons pedidos, pra conferir no teste sem precisar ouvir. */
  registro: [],

  aplicar(config) {
    this.ligado = config.som !== false;
    this.narrador = config.narrador !== false;
    this.volume = Math.min(1, Math.max(0, (config.volume ?? 70) / 100));
    this.musica = Math.min(1, Math.max(0, (config.musica ?? 25) / 100));
    this.falas = window.PINBALL_FALAS || [];
    /* Chrome e WebView2 podem travar o áudio até o primeiro clique ou tecla
       na janela (o OBS libera sozinho): destrava no primeiro gesto. */
    const destravar = () => {
      const c = this.ctx();
      if (c && c.state !== "running") c.resume().then(() => { this.avisar(); this.ligarFundo(); }, () => {});
    };
    // No toque, o navegador só libera o áudio no fim dele (pointerup/touchend).
    const tocou = () => {
      if (this._voltou) this.recriar();
      destravar();
    };
    for (const evento of ["pointerdown", "pointerup", "touchend", "keydown"]) addEventListener(evento, tocou, true);
    /* Quando o streamer vai pro TikTok abrir a live e volta, o celular pode
       deixar o áudio mudo de vez, às vezes com o contexto dizendo "running".
       O primeiro toque depois da volta troca o contexto por um novo, que só
       nasce liberado dentro de um gesto. */
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this._voltou = !!this._ctx;
      else destravar();
    });
    if (this.ctx()) {
      this.carregar();
      setTimeout(() => this.avisar(), 1500);
    }
  },

  ctx() {
    if (!this._ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      // Sem isto o iPhone com a chave do silencioso ligada deixa o jogo mudo.
      if (navigator.audioSession) navigator.audioSession.type = "playback";
      const c = this._ctx = new AC();
      c.onstatechange = () => { this.avisar(); this.ligarFundo(); };
      /* Compressor fazendo de limitador: multibola em rajada não estoura. */
      const limite = c.createDynamicsCompressor();
      limite.threshold.value = -14;
      limite.knee.value = 6;
      limite.ratio.value = 10;
      limite.attack.value = 0.003;
      limite.release.value = 0.25;
      this._mestre = c.createGain();
      this._mestre.gain.value = this.ligado ? this.volume : 0;
      this._mestre.connect(limite).connect(c.destination);
      this._trilha = c.createGain();
      this._trilha.gain.value = this.musica * VOLUME_TRILHA;
      this._trilha.connect(this._mestre);
      this._fundoLigado = null;
      if (c.state === "suspended") c.resume().catch(() => {});
    }
    return this._ctx;
  },

  recriar() {
    this._voltou = false;
    const velho = this._ctx;
    if (!velho) return;
    velho.onstatechange = null;
    velho.close().catch(() => {});
    this._ctx = this._mestre = this._trilha = this._fala = null;
    this._tocando = {};
    this.ctx();
    this.ligarFundo();
    this.avisar();
  },

  /* Efeitos primeiro (a música já sai), depois as falas, poucas de cada vez
     pra não disputar a rede com o jogo abrindo. */
  async carregar() {
    const baixar = async (chave, url) => {
      try {
        const dados = await (await fetch(url)).arrayBuffer();
        const c = this.ctx();
        if (!c) return;
        this._buf.set(chave, await c.decodeAudioData(dados));
      } catch (e) { /* sem o arquivo (file://, rede): fica mudo */ }
    };
    await Promise.all(SONS.map(n => baixar(n, `audio/${n}.mp3`)));
    this.ligarFundo();
    const fila = this.falas.map(f => f.id);
    const trabalhar = async () => { while (fila.length) { const id = fila.shift(); await baixar("voz:" + id, `audio/voz/${id}.mp3`); } };
    await Promise.all([trabalhar(), trabalhar(), trabalhar()]);
  },

  rodando() { return !!this._ctx && this._ctx.state === "running"; },

  ligarFundo() {
    const c = this._ctx;
    if (!c || c.state !== "running" || this._fundoLigado === c || !this._buf.has("trilha")) return;
    this._fundoLigado = c;
    this.tocar("trilha", { loop: true, saida: this._trilha });
  },

  anotar(nome, extra) {
    this.registro.push({ nome, ...extra, ms: Math.round(performance.now()) });
    if (this.registro.length > 300) this.registro.splice(0, 100);
  },

  tocar(nome, { volume = 1, loop = false, saida = null, taxa = 1 } = {}) {
    if (!nome.startsWith("voz:")) this.anotar(nome, { volume, taxa: Math.round(taxa * 100) / 100 });
    const c = this._ctx;
    const buf = this._buf.get(nome);
    if (!c || c.state !== "running" || !buf) return null;
    const fonte = c.createBufferSource(), ganho = c.createGain();
    fonte.buffer = buf;
    fonte.loop = loop;
    fonte.playbackRate.value = taxa;
    ganho.gain.value = volume;
    fonte.connect(ganho).connect(saida || this._mestre);
    fonte.start();
    return { fonte, ganho, duracao: buf.duration / taxa };
  },

  /* Batida que se repete muito: no máximo uma a cada `ms` e poucas tocando
     juntas, com o tom variando pra não soar metralhadora. `tom` puxa o tom
     pra cima ou pra baixo (cada bumper tem o seu). */
  curto(nome, volume = 1, ms = 45, tom = 1) {
    const agora = performance.now();
    this._ultimo = this._ultimo || {};
    if (agora - (this._ultimo[nome] || 0) < ms) return;
    const max = MAX_SIMULTANEOS[nome] || 4;
    if ((this._tocando[nome] || 0) >= max) return;
    this._ultimo[nome] = agora;
    const s = this.tocar(nome, { volume, taxa: tom * (0.9 + Math.random() * 0.2) });
    if (!s) return;
    this._tocando[nome] = (this._tocando[nome] || 0) + 1;
    s.fonte.onended = () => { this._tocando[nome] = Math.max(0, (this._tocando[nome] || 1) - 1); };
  },

  falar(momento) {
    if (!this.narrador || !this.rodando()) return;
    const c = this._ctx, agora = c.currentTime;
    const forte = FALA_FORTE.has(momento);
    const anuncio = ANUNCIO.has(momento);
    const livre = anuncio ? this._livreEm - RESPIRO + 0.3 : this._livreEm;
    // A forte só corta a fala comum: duas fortes seguidas não se atropelam.
    if (agora < livre && (!forte || this._falaForte)) {
      if (anuncio && !this._espera && livre - agora < 5) {
        this._espera = setTimeout(() => { this._espera = null; this.falar(momento); }, (livre - agora) * 1000 + 50);
      }
      return;
    }
    let opcoes = this.falas.filter(f => f.momento === momento && this._buf.has("voz:" + f.id));
    if (opcoes.length > 1) opcoes = opcoes.filter(f => f.id !== this._ultimaFala);
    const fala = opcoes[Math.floor(Math.random() * opcoes.length)];
    if (!fala) return;
    if (this._fala) try { this._fala.fonte.stop(); } catch (e) { /* já acabou */ }
    this._fala = this.tocar("voz:" + fala.id, { volume: 1.15 });
    if (!this._fala) return;
    this.anotar("voz:" + fala.id, { momento });
    this._ultimaFala = fala.id;
    this._falaForte = forte;
    const dur = this._fala.duracao;
    this._livreEm = agora + dur + RESPIRO;
    const g = this._trilha.gain, cheio = this.musica * VOLUME_TRILHA;
    g.cancelScheduledValues(agora);
    g.setTargetAtTime(cheio * 0.3, agora, 0.05);
    g.setTargetAtTime(cheio, agora + dur, 0.3);
  },

  /* Arpejo do presente: cada faixa sobe mais notas, mais alto e mais forte,
     pra dar pra ouvir o tamanho do presente sem olhar. */
  subida(faixa) {
    this.anotar("subida", { faixa });
    if (!this.rodando()) return;
    const c = this._ctx, t0 = c.currentTime;
    const notas = [0, 4, 7, 12, 16, 19, 24].slice(0, faixa + 3);
    const passo = 0.075 - faixa * 0.008, volume = 0.06 + faixa * 0.025;
    notas.forEach((semitom, i) => {
      const t = t0 + i * passo, ultima = i === notas.length - 1;
      const o = c.createOscillator(), g = c.createGain();
      o.type = faixa >= 3 ? "square" : "triangle";
      o.frequency.value = 523.25 * 2 ** (semitom / 12);
      const dur = ultima ? 0.18 + faixa * 0.08 : 0.1;
      g.gain.setValueAtTime(volume * (faixa >= 3 ? 0.6 : 1), t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(this._mestre);
      o.start(t);
      o.stop(t + dur + 0.02);
    });
  },

  alternar() {
    this.ligado = !this.ligado;
    const c = this.ctx();
    if (c) this._mestre.gain.setTargetAtTime(this.ligado ? this.volume : 0, c.currentTime, 0.05);
    this.avisar();
  },

  /* Aviso discreto só quando o navegador travou o áudio de verdade. */
  avisar() {
    const travado = this.ligado && this.volume > 0 && this._ctx && this._ctx.state !== "running";
    if (travado && !this._aviso) {
      const a = this._aviso = document.createElement("div");
      a.textContent = matchMedia("(pointer: coarse)").matches ? "Toque na tela para ativar o som" : "Clique na tela para ativar o som";
      a.style.cssText = "position:fixed;left:12px;bottom:12px;z-index:9999;padding:6px 12px;border-radius:999px;"
        + "background:rgba(0,0,0,.6);color:#fff;font:600 13px system-ui,sans-serif;pointer-events:none";
      document.body.appendChild(a);
    }
    if (this._aviso) this._aviso.hidden = !travado;
  },
};
