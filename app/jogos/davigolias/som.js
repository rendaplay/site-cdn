/* Som do Davi x Golias: tambor de guerra que acelera com o gigante chegando,
   o assobio da funda girando, a pisada, o rugido, a pedrada e a queda
   (sintetizados), a torcida e a fanfarra (mp3 em audio/) e o narrador
   (audio/voz/, lista em falas.js). Um bordão por vez, e o tambor abaixa
   enquanto ele fala. Por file:// o fetch falha e fica só o sintetizado.
   Desliga no painel (P), na URL (?som=0) ou na S. */
"use strict";

const EFEITOS = ["torcida", "torcida-forte", "rufar", "fanfarra", "jato"];

/* Falas que passam por cima da que está tocando. As outras esperam o respiro. */
const FALA_FORTE = new Set(["inicio", "dez", "derrubou", "venceu", "lendario"]);
const RESPIRO = 1.2;
const VOLUME_TRILHA = 0.8;
const VOLUME_TORCIDA = 0.22;

const Som = {
  ligado: true,
  volume: 0.7,
  musica: 0.35,
  narrador: true,
  _ctx: null,
  _mestre: null,
  _trilha: null,
  _torcida: null,
  _giro: null,
  _buf: new Map(),
  _ruido: null,
  _fundoLigado: null,
  _fala: null,
  _livreEm: 0,
  _ultimaFala: null,
  _aviso: null,
  _voltou: false,
  _batida: 0,
  _proxima: 0,
  ritmo: 0,

  aplicar(config) {
    this.ligado = config.som !== false;
    this.narrador = config.narrador !== false;
    this.volume = Math.min(1, Math.max(0, (config.volume ?? 70) / 100));
    this.musica = Math.min(1, Math.max(0, (config.musica ?? 35) / 100));
    this.falas = window.DAVIGOLIAS_FALAS || [];
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
       deixar o áudio mudo de vez. O primeiro toque depois da volta troca o
       contexto por um novo, que só nasce liberado dentro de um gesto. */
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
      this._ruido = this.criarRuido(c, 2);
      this._fundoLigado = null;
      this._giro = null;
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
    this._ctx = this._mestre = this._trilha = this._torcida = this._fala = this._giro = null;
    this.ctx();
    this.ligarFundo();
    this.avisar();
  },

  criarRuido(c, seg) {
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * seg), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  },

  /* Efeitos primeiro, depois as falas, poucas de cada vez pra não disputar
     a rede com o jogo abrindo. */
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

  /* Torcida de fundo e o assobio da funda, uma vez por contexto. */
  ligarFundo() {
    const c = this._ctx;
    if (!c || c.state !== "running") return;
    if (!this._giro) {
      this.ligarGiro();
      this._proxima = c.currentTime + 0.1;
    }
    if (this._fundoLigado === c || !this._buf.has("torcida")) return;
    this._fundoLigado = c;
    const t = this.tocar("torcida", { loop: true, volume: VOLUME_TORCIDA });
    this._torcida = t && t.ganho;
  },

  /* Ruído num passa-banda: o volume e o tom acompanham a velocidade da
     funda, e o tremor de amplitude bate na volta dela. */
  ligarGiro() {
    const c = this._ctx;
    const fonte = c.createBufferSource(), filtro = c.createBiquadFilter(), ganho = c.createGain();
    const am = c.createGain(), lfo = c.createOscillator(), prof = c.createGain();
    fonte.buffer = this._ruido;
    fonte.loop = true;
    filtro.type = "bandpass";
    filtro.Q.value = 2.5;
    filtro.frequency.value = 500;
    ganho.gain.value = 0;
    am.gain.value = 0.6;
    lfo.frequency.value = 1;
    prof.gain.value = 0.4;
    lfo.connect(prof).connect(am.gain);
    fonte.connect(filtro).connect(am).connect(ganho).connect(this._mestre);
    fonte.start();
    lfo.start();
    this._giro = { filtro, ganho, lfo };
  },

  giro(voltasPorSeg, carga) {
    const g = this._giro;
    if (!g || !this.rodando()) return;
    const t = this._ctx.currentTime;
    const v = Math.min(1, voltasPorSeg / 5);
    g.ganho.gain.setTargetAtTime(0.02 + v * v * 0.16, t, 0.1);
    g.filtro.frequency.setTargetAtTime(380 + v * 900 + carga * 500, t, 0.1);
    g.lfo.frequency.setTargetAtTime(Math.max(0.5, voltasPorSeg), t, 0.1);
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

  falar(momento) {
    if (!this.narrador || !this.rodando()) return;
    const c = this._ctx, agora = c.currentTime;
    const forte = FALA_FORTE.has(momento);
    if (!forte && agora < this._livreEm) return;
    let opcoes = this.falas.filter(f => f.momento === momento && this._buf.has("voz:" + f.id));
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
    g.setTargetAtTime(cheio * 0.35, agora, 0.05);
    g.setTargetAtTime(cheio, agora + dur, 0.3);
  },

  onda(alto = 0.8) {
    if (!this._torcida || !this.rodando()) return;
    const g = this._torcida.gain, t = this._ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(alto, t, 0.1);
    g.setTargetAtTime(VOLUME_TORCIDA, t + 1.4, 0.6);
  },

  /* ───────── tambor de guerra ───────── */

  /* Agenda as batidas um pouco à frente. `ritmo` (0 a 1) é o quanto o
     gigante já andou: de 84 a 150 batidas por minuto. */
  quadro(parado) {
    const c = this._ctx;
    if (!this.rodando() || !this._giro) return;
    const bpm = 84 + this.ritmo * 66;
    const passo = 60 / bpm / 2;
    while (this._proxima < c.currentTime + 0.12) {
      const t = Math.max(this._proxima, c.currentTime);
      if (!parado) {
        const n = this._batida % 8;
        if (n === 0 || n === 3 || n === 4) this.tambor(t, n === 0 ? 1 : 0.7, 58);
        if (n === 6 && this.ritmo > 0.35) this.tambor(t, 0.5, 74);
        if (n % 2 === 1 && this.ritmo > 0.6) this.caixa(t, 0.25 + this.ritmo * 0.2);
      }
      this._batida++;
      this._proxima += passo;
    }
  },

  tambor(t, forca, freq) {
    const c = this._ctx, o = c.createOscillator(), g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(freq * 2.2, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.08);
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.9 * forca, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    o.connect(g).connect(this._trilha);
    o.start(t);
    o.stop(t + 0.5);
    this.ruido(t, { dur: 0.06, freq: 900, volume: 0.25 * forca, saida: this._trilha });
  },

  caixa(t, forca) {
    this.ruido(t, { dur: 0.12, freq: 2400, q: 0.8, volume: forca, saida: this._trilha, tipo: "highpass" });
  },

  ruido(t, { dur, freq, q = 1, volume = 1, saida = null, tipo = "bandpass", ataque = 0.004 }) {
    const c = this._ctx;
    const fonte = c.createBufferSource(), filtro = c.createBiquadFilter(), g = c.createGain();
    fonte.buffer = this._ruido;
    filtro.type = tipo;
    filtro.frequency.value = freq;
    filtro.Q.value = q;
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(volume, t + ataque);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    fonte.connect(filtro).connect(g).connect(saida || this._mestre);
    fonte.start(t, Math.random());
    fonte.stop(t + dur + 0.05);
    return filtro;
  },

  /* ───────── efeitos sintetizados ───────── */

  passo(perto, escala) {
    if (!this.rodando()) return;
    const c = this._ctx, t = c.currentTime;
    const forca = Math.min(1, 0.3 + perto * 0.7) * Math.min(1.3, escala);
    const o = c.createOscillator(), g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(70 / Math.sqrt(escala), t);
    o.frequency.exponentialRampToValueAtTime(32, t + 0.35);
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(forca, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    o.connect(g).connect(this._mestre);
    o.start(t);
    o.stop(t + 0.65);
    this.ruido(t, { dur: 0.5, freq: 260, q: 0.7, volume: forca * 0.6, tipo: "lowpass" });
  },

  /* Rugido: dente de serra grave com vibrato, passando por um formante que
     abre e fecha, mais um chiado por cima. */
  rugido(forte) {
    if (!this.rodando()) return;
    const c = this._ctx, t = c.currentTime, dur = forte ? 1.7 : 1.1;
    const filtro = c.createBiquadFilter(), g = c.createGain();
    filtro.type = "lowpass";
    filtro.Q.value = 6;
    filtro.frequency.setValueAtTime(300, t);
    filtro.frequency.linearRampToValueAtTime(forte ? 1300 : 950, t + dur * 0.35);
    filtro.frequency.linearRampToValueAtTime(260, t + dur);
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(forte ? 0.55 : 0.4, t + 0.12);
    g.gain.setValueAtTime(forte ? 0.55 : 0.4, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    filtro.connect(g).connect(this._mestre);
    const lfo = c.createOscillator(), prof = c.createGain();
    lfo.frequency.value = 23;
    prof.gain.value = 9;
    lfo.connect(prof);
    for (const [f, tipo] of [[62, "sawtooth"], [93, "sawtooth"], [124, "square"]]) {
      const o = c.createOscillator();
      o.type = tipo;
      o.frequency.setValueAtTime(f, t);
      o.frequency.linearRampToValueAtTime(f * 1.15, t + dur * 0.3);
      o.frequency.linearRampToValueAtTime(f * 0.8, t + dur);
      prof.connect(o.frequency);
      o.connect(filtro);
      o.start(t);
      o.stop(t + dur);
    }
    lfo.start(t);
    lfo.stop(t + dur);
    this.ruido(t, { dur, freq: 700, q: 0.6, volume: 0.25, ataque: 0.1 });
  },

  soltou(lendario) {
    if (!this.rodando()) return;
    const c = this._ctx, t = c.currentTime;
    const f = this.ruido(t, { dur: 0.7, freq: 900, q: 3, volume: 0.6, ataque: 0.02 });
    f.frequency.exponentialRampToValueAtTime(2600, t + 0.2);
    f.frequency.exponentialRampToValueAtTime(500, t + 0.7);
    if (lendario) this.tocar("jato", { volume: 0.7 });
  },

  impacto() {
    if (!this.rodando()) return;
    const c = this._ctx, t = c.currentTime;
    this.ruido(t, { dur: 0.25, freq: 3000, q: 0.5, volume: 1, tipo: "highpass", ataque: 0.001 });
    const o = c.createOscillator(), g = c.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(420, t);
    o.frequency.exponentialRampToValueAtTime(90, t + 0.25);
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.8, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g).connect(this._mestre);
    o.start(t);
    o.stop(t + 0.4);
  },

  /* Ronco grave: ruído num passa-baixa que treme. Queda, pisão e tremor. */
  estrondo(dur = 1.8) {
    if (!this.rodando()) return;
    const c = this._ctx, t = c.currentTime;
    const f = this.ruido(t, { dur, freq: 140, q: 1, volume: 1, tipo: "lowpass", ataque: 0.06 });
    const lfo = c.createOscillator(), prof = c.createGain();
    lfo.frequency.value = 9;
    prof.gain.value = 60;
    lfo.connect(prof).connect(f.frequency);
    lfo.start(t);
    lfo.stop(t + dur);
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(48, t);
    o.frequency.exponentialRampToValueAtTime(25, t + dur);
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.9, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this._mestre);
    o.start(t);
    o.stop(t + dur);
  },

  fogo() {
    if (!this.rodando()) return;
    const t = this._ctx.currentTime;
    const f = this.ruido(t, { dur: 1.2, freq: 400, q: 0.5, volume: 0.5, tipo: "lowpass", ataque: 0.05 });
    f.frequency.exponentialRampToValueAtTime(3000, t + 0.4);
    for (let i = 0; i < 10; i++) this.ruido(t + Math.random() * 1.2, { dur: 0.03, freq: 4000, q: 1, volume: 0.3, tipo: "highpass", ataque: 0.001 });
  },

  faisca(n = 4) {
    if (!this.rodando()) return;
    const c = this._ctx, t0 = c.currentTime;
    for (let i = 0; i < n; i++) {
      const t = t0 + i * 0.05 + Math.random() * 0.03;
      const o = c.createOscillator(), g = c.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime(1400 + Math.random() * 1600, t);
      o.frequency.exponentialRampToValueAtTime(3200, t + 0.06);
      g.gain.setValueAtTime(0.09, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      o.connect(g).connect(this._mestre);
      o.start(t);
      o.stop(t + 0.11);
    }
  },

  /* "Ching" de moeda: dois parciais de sino que somem devagar. O `grave`
     é a pedra chegando no bolso. */
  ching(grave = false) {
    if (!this.rodando()) return;
    const c = this._ctx, t = c.currentTime;
    const base = grave ? 1320 : 1760;
    for (const [mult, vol, dur] of [[1, 0.22, 0.9], [2.76, 0.1, 0.5], [5.4, 0.05, 0.25]]) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(base * mult, t);
      g.gain.setValueAtTime(0.001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(this._mestre);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
    this.ruido(t, { dur: 0.06, freq: 6000, q: 1, volume: 0.25, tipo: "highpass", ataque: 0.001 });
  },

  /* Lança batendo no escudo de bronze: estalo e parciais metálicos. */
  escudo() {
    if (!this.rodando()) return;
    const c = this._ctx, t = c.currentTime;
    this.ruido(t, { dur: 0.12, freq: 1800, q: 2, volume: 0.9, ataque: 0.001 });
    for (const [freq, vol] of [[310, 0.35], [497, 0.25], [833, 0.18], [1290, 0.1]]) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      o.connect(g).connect(this._mestre);
      o.start(t);
      o.stop(t + 0.75);
    }
  },

  bip(agudo) {
    if (!this.rodando()) return;
    const c = this._ctx, o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
    o.type = "triangle";
    o.frequency.setValueAtTime(agudo ? 880 : 520 + Math.random() * 160, t);
    o.frequency.exponentialRampToValueAtTime(agudo ? 1760 : 1040, t + 0.08);
    g.gain.setValueAtTime(agudo ? 0.18 : 0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g).connect(this._mestre);
    o.start(t);
    o.stop(t + 0.13);
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
