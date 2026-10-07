/* Som sintetizado, ligado por padrão em volume moderado (`som` e `volume`
   no preset ou no painel P; ?som=0 na URL e a tecla S desligam).
   Sintetizado e não arquivo: nada pra baixar, nada com direito autoral.

   O navegador só libera áudio depois de um clique na página. Fonte de
   navegador do OBS e a janela do launcher liberam sozinhas. */
"use strict";

const Som = {
  ligado: true,
  volume: 0.5,
  _ctx: null,
  _mestre: null,
  _ruido: null,

  /* No celular nada destrava sozinho: o áudio só liga no fim de um toque
     (pointerup/touchend), e o iPhone suspende de novo quando o streamer vai
     pro TikTok e volta. */
  destravarNoToque() {
    const destravar = () => { if (this.ligado && this.volume) this.ctx(); };
    for (const evento of ["pointerdown", "pointerup", "touchend", "keydown"]) addEventListener(evento, destravar, true);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) destravar(); });
  },

  ctx() {
    if (!this._ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      // Sem isto o iPhone com a chave do silencioso ligada deixa o jogo mudo.
      if (navigator.audioSession) navigator.audioSession.type = "playback";
      this._ctx = new AC();
      this._mestre = this._ctx.createGain();
      this._mestre.connect(this._ctx.destination);
    }
    if (this._ctx.state === "suspended") this._ctx.resume();
    this._mestre.gain.value = this.volume;
    return this._ctx;
  },

  nota(freq, dur, { tipo = "triangle", vol = 0.18, ate = null, atraso = 0 } = {}) {
    if (!this.ligado || !this.volume) return;
    const c = this.ctx();
    if (!c) return;
    const t = c.currentTime + atraso;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(freq, t);
    if (ate) o.frequency.exponentialRampToValueAtTime(ate, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this._mestre);
    o.start(t);
    o.stop(t + dur + 0.02);
  },

  /* Ruído filtrado: o "corpo" de pancada, poeira e desabamento. */
  ruido(dur, { freq = 800, q = 0.8, vol = 0.2, atraso = 0, ate = null } = {}) {
    if (!this.ligado || !this.volume) return;
    const c = this.ctx();
    if (!c) return;
    if (!this._ruido) {
      const b = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this._ruido = b;
    }
    const t = c.currentTime + atraso;
    const s = c.createBufferSource();
    s.buffer = this._ruido;
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(freq, t);
    if (ate) f.frequency.exponentialRampToValueAtTime(ate, t + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this._mestre);
    s.start(t);
    s.stop(t + dur + 0.02);
  },

  /* Peça assentando: mais grave quanto maior. `t` vai de 0 (tijolo) a 1. */
  encaixe(t) {
    this.nota(210 - t * 120, 0.16 + t * 0.1, { tipo: "sine", vol: 0.32, ate: 70 });
    this.ruido(0.07 + t * 0.06, { freq: 1600 - t * 900, q: 1.2, vol: 0.1 + t * 0.06 });
  },
  queda() {
    this.ruido(0.35, { freq: 2400, ate: 500, q: 2, vol: 0.08 });
    this.nota(620, 0.22, { tipo: "triangle", vol: 0.05, ate: 240, atraso: 0.05 });
  },
  impacto(t) {
    this.nota(95, 0.7 + t * 0.4, { tipo: "sine", vol: 0.5, ate: 32 });
    this.ruido(0.5 + t * 0.5, { freq: 420, ate: 90, q: 0.7, vol: 0.32 });
    this.ruido(0.18, { freq: 3000, q: 1.5, vol: 0.08, atraso: 0.02 });
  },
  desabar() {
    for (let i = 0; i < 6; i++) this.ruido(0.3, { freq: 600 - i * 60, ate: 120, vol: 0.18, atraso: i * 0.11 });
    this.nota(70, 1.2, { tipo: "sine", vol: 0.4, ate: 28 });
  },
  dobro() { [660, 880, 1320].forEach((f, i) => this.nota(f, 0.14, { tipo: "square", vol: 0.06, atraso: i * 0.08 })); },
  virada() {
    this.nota(160, 0.5, { tipo: "sawtooth", vol: 0.1, ate: 900 });
    this.nota(1200, 0.35, { tipo: "square", vol: 0.05, atraso: 0.45 });
  },
  tique(ultimo) { this.nota(ultimo ? 1320 : 880, 0.09, { tipo: "square", vol: 0.07 }); },
  vitoria() { [392, 523, 659, 784, 1047].forEach((f, i) => this.nota(f, 0.4, { tipo: "triangle", vol: 0.14, atraso: i * 0.12 })); },
};
