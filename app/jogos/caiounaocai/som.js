/* Som do Cai ou Não Cai?: música e torcida em loop baixo, efeitos (mp3 em
   audio/), o bipe e o estrondo sintetizados, e o narrador (audio/voz/, lista
   em falas.js). Um bordão por vez, e a música abaixa enquanto ele fala.
   Web Audio com os mp3 baixados por fetch: por file:// o fetch falha e o
   jogo fica só com o bipe. Desliga no painel (P), na URL (?som=0) ou na S. */
"use strict";

const EFEITOS = ["musica-corrida", "torcida", "torcida-forte", "apito", "rufar", "escorregao", "jato", "nitro", "confete", "fanfarra"];

/* Falas que passam por cima da que está tocando. As outras esperam o respiro. */
const FALA_FORTE = new Set(["inicio", "dez", "caiu", "lendario"]);
const RESPIRO = 1.2;
const VOLUME_TRILHA = 0.75;
const VOLUME_TORCIDA = 0.35;

const Som = {
  ligado: true,
  volume: 0.7,
  musica: 0.3,
  narrador: true,
  _ctx: null,
  _mestre: null,
  _trilha: null,
  _torcida: null,
  _buf: new Map(),
  _fundoLigado: null,
  _fala: null,
  _livreEm: 0,
  _ultimaFala: null,
  _aviso: null,
  _voltou: false,

  aplicar(config) {
    this.ligado = config.som !== false;
    this.narrador = config.narrador !== false;
    this.volume = Math.min(1, Math.max(0, (config.volume ?? 70) / 100));
    this.musica = Math.min(1, Math.max(0, (config.musica ?? 30) / 100));
    this.falas = window.CAIOUNAOCAI_FALAS || [];
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
      /* Compressor fazendo de limitador: presente em rajada não estoura. */
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
    this._ctx = this._mestre = this._trilha = this._torcida = this._fala = null;
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
        this._buf.set(chave, await new Promise((ok, erro) => c.decodeAudioData(dados, ok, erro)));
      } catch (e) { /* sem o arquivo (file://, rede): fica mudo */ }
    };
    await Promise.all(EFEITOS.map(n => baixar(n, `audio/${n}.mp3`)));
    this.ligarFundo();
    const fila = this.falas.map(f => f.id);
    const trabalhar = async () => { while (fila.length) { const id = fila.shift(); await baixar("voz:" + id, `audio/voz/${id}.mp3`); } };
    await Promise.all([trabalhar(), trabalhar(), trabalhar()]);
  },

  rodando() { return !!this._ctx && this._ctx.state === "running"; },

  /* Música e torcida de fundo, uma vez por contexto, quando o áudio libera. */
  ligarFundo() {
    const c = this._ctx;
    if (!c || c.state !== "running" || this._fundoLigado === c || !this._buf.has("musica-corrida")) return;
    this._fundoLigado = c;
    this.tocar("musica-corrida", { loop: true, saida: this._trilha });
    const t = this.tocar("torcida", { loop: true, volume: VOLUME_TORCIDA });
    this._torcida = t && t.ganho;
  },

  tocar(nome, { volume = 1, loop = false, saida = null, taxa = 1 } = {}) {
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

  /* Fala do momento; com o time, prefere a fala com o nome dele. */
  falar(momento, time = null) {
    if (!this.narrador || !this.rodando()) return;
    const c = this._ctx, agora = c.currentTime;
    const forte = FALA_FORTE.has(momento);
    if (!forte && agora < this._livreEm) return;
    const prontas = this.falas.filter(f => f.momento === momento && this._buf.has("voz:" + f.id));
    const doTime = time ? prontas.filter(f => f.time === time) : [];
    const gerais = prontas.filter(f => !f.time);
    let opcoes = doTime.length && (Math.random() < 0.7 || !gerais.length) ? doTime : gerais;
    if (opcoes.length > 1) opcoes = opcoes.filter(f => f.id !== this._ultimaFala);
    const fala = opcoes[Math.floor(Math.random() * opcoes.length)];
    if (!fala) return;
    if (this._fala) try { this._fala.fonte.stop(); } catch (e) { /* já acabou */ }
    this._fala = this.tocar("voz:" + fala.id, { volume: 1.15 });
    if (!this._fala) return;
    this._ultimaFala = fala.id;
    const dur = this._fala.duracao;
    this._livreEm = agora + dur + RESPIRO;
    const g = this._trilha.gain, cheio = this.musica * VOLUME_TRILHA;
    g.cancelScheduledValues(agora);
    g.setTargetAtTime(cheio * 0.3, agora, 0.05);
    g.setTargetAtTime(cheio, agora + dur, 0.3);
  },

  /* A torcida de fundo sobe e volta: gol, salvação, líder novo. */
  onda() {
    if (!this._torcida || !this.rodando()) return;
    const g = this._torcida.gain, t = this._ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(0.8, t, 0.1);
    g.setTargetAtTime(VOLUME_TORCIDA, t + 1.2, 0.6);
  },

  bip(agudo) {
    if (!this.rodando()) return;
    const c = this._ctx, o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
    o.type = "triangle";
    o.frequency.setValueAtTime(agudo ? 880 : 520 + Math.random() * 160, t);
    o.frequency.exponentialRampToValueAtTime(agudo ? 1760 : 1040, t + 0.08);
    g.gain.setValueAtTime(agudo ? 0.18 : 0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g).connect(this._mestre);
    o.start(t);
    o.stop(t + 0.13);
  },

  /* Ronco grave do terremoto: ruído passando por um passa-baixa que treme. */
  estrondo() {
    if (!this.rodando()) return;
    const c = this._ctx, t = c.currentTime, dur = 1.8;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    const d = buf.getChannelData(0);
    let v = 0;
    for (let i = 0; i < d.length; i++) { v = v * 0.97 + (Math.random() * 2 - 1) * 0.03; d[i] = v * 6; }
    const fonte = c.createBufferSource(), filtro = c.createBiquadFilter(), g = c.createGain();
    fonte.buffer = buf;
    filtro.type = "lowpass";
    filtro.frequency.value = 140;
    const lfo = c.createOscillator(), prof = c.createGain();
    lfo.frequency.value = 9;
    prof.gain.value = 60;
    lfo.connect(prof).connect(filtro.frequency);
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    fonte.connect(filtro).connect(g).connect(this._mestre);
    fonte.start(t);
    lfo.start(t);
    lfo.stop(t + dur);
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
