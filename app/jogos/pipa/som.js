/* Som sintetizado por WebAudio: nada pra baixar, nada com direito autoral.
   Ligado de fábrica em volume moderado; desliga no painel (P), no preset
   (`som: false`), na URL (?som=0) ou na tecla S. */
"use strict";

const Som = {
  ligado: true,
  volume: 0.6,
  /* Sons de prioridade 0 que tocam juntos. Rajada de rosa passa disso e o
     resto fica mudo: 50 "plins" de uma vez viram só barulho. */
  MAX_SONS: 5,
  _ctx: null,
  _mestre: null,
  _ruido: null,
  _tocando: [],
  _ultimo: {},
  _aviso: null,

  /* Liga com a config do jogo (`som`, `volume` de 0 a 100). */
  aplicar(config) {
    this.ligado = config.som !== false;
    this.volume = Math.min(1, Math.max(0, (config.volume ?? 60) / 100));
    /* Chrome e WebView2 podem travar o áudio até o primeiro clique ou tecla
       na janela (o OBS libera sozinho): destrava no primeiro gesto. */
    const destravar = () => {
      const c = this.ctx();
      if (c && c.state !== "running") c.resume().then(() => this.avisar(), () => {});
    };
    addEventListener("pointerdown", destravar, true);
    addEventListener("keydown", destravar, true);
    if (this.ligado) {
      this.ctx();
      setTimeout(() => this.avisar(), 1500);
    }
  },

  alternar() {
    this.ligado = !this.ligado;
    if (this.ligado) this.ctx();
    this.avisar();
    if (this.ligado) setTimeout(() => this.presente(1), 80);
  },

  ctx() {
    if (!this._ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      const c = this._ctx = new AC();
      c.onstatechange = () => this.avisar();
      /* Soma dos sons → passa-baixa (nada estridente) → compressor fazendo
         de limitador, pra rajada de presente não estourar → volume do painel. */
      this._mestre = c.createGain();
      const volume = c.createGain();
      volume.gain.value = Math.pow(this.volume, 1.5);
      const suave = c.createBiquadFilter();
      suave.type = "lowpass";
      suave.frequency.value = 6500;
      const limite = c.createDynamicsCompressor();
      limite.threshold.value = -18;
      limite.knee.value = 6;
      limite.ratio.value = 12;
      limite.attack.value = 0.002;
      limite.release.value = 0.2;
      this._mestre.connect(suave).connect(limite).connect(volume).connect(c.destination);
      if (c.state === "suspended") c.resume().catch(() => {});
    }
    return this._ctx;
  },

  /* Aviso discreto só quando o navegador travou o áudio de verdade. */
  avisar() {
    const travado = this.ligado && this.volume > 0 && this._ctx && this._ctx.state !== "running";
    if (travado && !this._aviso) {
      const a = this._aviso = document.createElement("div");
      a.textContent = "Clique na tela para ativar o som";
      a.style.cssText = "position:fixed;left:12px;bottom:12px;z-index:9999;padding:6px 12px;border-radius:999px;"
        + "background:rgba(0,0,0,.6);color:#fff;font:600 13px system-ui,sans-serif;pointer-events:none";
      document.body.appendChild(a);
    }
    if (this._aviso) this._aviso.hidden = !travado;
  },

  /* Abre espaço pra um som de `dur` segundos. Com o áudio travado não agenda
     nada: o relógio parado faria tudo tocar junto quando destravar. `espera`
     ignora a repetição do mesmo som muito colada; prioridade 1 aceita mais
     sons juntos e 2 toca sempre. */
  comecar(chave, dur, { espera = 0, prioridade = 0 } = {}) {
    if (!this.ligado || this.volume <= 0) return null;
    const c = this.ctx();
    if (!c || c.state !== "running") return null;
    const t = c.currentTime;
    if (t - (this._ultimo[chave] ?? -Infinity) < espera) return null;
    this._tocando = this._tocando.filter(fim => fim > t);
    if (prioridade < 2 && this._tocando.length >= this.MAX_SONS + prioridade * 3) return null;
    this._ultimo[chave] = t;
    this._tocando.push(t + dur);
    return c;
  },

  envelope(param, t, vol, ataque, dur) {
    param.setValueAtTime(0.0001, t);
    param.exponentialRampToValueAtTime(vol, t + ataque);
    param.exponentialRampToValueAtTime(0.0001, t + dur);
  },

  /* Tom com envelope curto. `brilho` passa o timbre por um passa-baixa:
     dente de serra filtrada vira metal sem arranhar. */
  tom(freq, dur, { tipo = "triangle", vol = 0.1, ate = null, atraso = 0, ataque = 0.008, brilho = 0 } = {}) {
    const c = this._ctx;
    const t = c.currentTime + atraso;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(freq, t);
    if (ate) o.frequency.exponentialRampToValueAtTime(ate, t + dur);
    let saida = o;
    if (brilho) {
      const f = c.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = brilho;
      saida = o.connect(f);
    }
    this.envelope(g.gain, t, vol, ataque, dur);
    saida.connect(g).connect(this._mestre);
    o.start(t);
    o.stop(t + dur + 0.05);
  },

  ruido(dur, { vol = 0.1, filtro = "lowpass", freq = 1000, ate = null, q = 1, atraso = 0, ataque = 0.004 } = {}) {
    const c = this._ctx;
    const t = c.currentTime + atraso;
    if (!this._ruido) {
      this._ruido = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const d = this._ruido.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = c.createBufferSource();
    src.buffer = this._ruido;
    const f = c.createBiquadFilter();
    f.type = filtro;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (ate) f.frequency.exponentialRampToValueAtTime(ate, t + dur);
    const g = c.createGain();
    this.envelope(g.gain, t, vol, ataque, dur);
    src.connect(f).connect(g).connect(this._mestre);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  },

  sino(freq, dur, { vol = 0.1, atraso = 0 } = {}) {
    this.tom(freq, dur, { tipo: "sine", vol, atraso, ataque: 0.004 });
    this.tom(freq * 2, dur * 0.6, { tipo: "sine", vol: vol * 0.3, atraso, ataque: 0.004 });
    this.tom(freq * 3, dur * 0.3, { tipo: "sine", vol: vol * 0.1, atraso, ataque: 0.003 });
  },

  baque(peso = 1, atraso = 0) {
    this.tom(120 - peso * 25, 0.25 + peso * 0.2, { tipo: "sine", vol: 0.25 + peso * 0.1, ate: 38, atraso, ataque: 0.004 });
    this.ruido(0.15 + peso * 0.2, { vol: 0.12 + peso * 0.06, freq: 1400 - peso * 300, ate: 70, atraso });
  },

  /* Presente: nivel 0 (rosa) a 4 (leão), cada degrau mais grandioso.
     `menor` é a versão escura, pro time que atrapalha. */
  presente(nivel, { menor = false } = {}) {
    const n = Math.max(0, Math.min(4, Math.round(nivel)));
    const c = this.comecar("presente" + n, [0.12, 0.45, 0.75, 1.3, 2][n],
      { espera: [0.08, 0.12, 0.2, 0.35, 0.6][n], prioridade: n >= 3 ? 2 : n === 2 ? 1 : 0 });
    if (!c) return;
    const base = menor ? 392 : 523.25;
    const acorde = [base, base * (menor ? 1.189 : 1.26), base * 1.498, base * 2];
    if (n === 0) return this.tom(acorde[2], 0.1, { vol: 0.1, ate: acorde[3], ataque: 0.004 });
    if (n === 1) {
      this.sino(acorde[2], 0.35, { vol: 0.07 });
      this.sino(acorde[3], 0.4, { vol: 0.07, atraso: 0.07 });
      return;
    }
    if (n === 2) {
      acorde.forEach((f, i) => this.sino(f, i === 3 ? 0.55 : 0.3, { vol: 0.09, atraso: i * 0.07 }));
      return;
    }
    const grande = n === 4;
    this.baque(grande ? 2 : 1);
    this.ruido(0.35, { vol: 0.05, filtro: "bandpass", freq: 500, ate: 3000, q: 0.8, ataque: 0.25 });
    acorde.forEach((f, i) => this.tom(f, 0.22, { vol: 0.09, atraso: 0.08 + i * 0.06, brilho: 2500 }));
    const fim = grande ? 1.6 : 0.9;
    acorde.forEach(f => {
      this.tom(f, fim, { tipo: "sawtooth", vol: 0.035, atraso: 0.32, ataque: 0.03, brilho: grande ? 2200 : 1600 });
      this.tom(f, fim, { vol: 0.045, atraso: 0.32, ataque: 0.02 });
    });
    if (grande) {
      this.tom(base / 2, fim, { tipo: "sawtooth", vol: 0.07, atraso: 0.32, ataque: 0.03, brilho: 500 });
      [3, 4, 5, 6, 8, 6].forEach((m, i) => this.sino(base * m / 2, 0.4, { vol: 0.035, atraso: 0.45 + i * 0.13 }));
    }
  },

  vitoria() {
    if (!this.comecar("vitoria", 1.6, { prioridade: 2 })) return;
    [523.25, 659.25, 783.99].forEach((f, i) => this.tom(f, 0.2, { vol: 0.1, atraso: i * 0.11, brilho: 2500 }));
    [523.25, 659.25, 783.99, 1046.5].forEach(f => {
      this.tom(f, 1.2, { tipo: "sawtooth", vol: 0.03, atraso: 0.33, ataque: 0.03, brilho: 2000 });
      this.tom(f, 1.2, { vol: 0.05, atraso: 0.33, ataque: 0.02 });
    });
    [1568, 2093, 1760, 2349].forEach((f, i) => this.sino(f, 0.35, { vol: 0.03, atraso: 0.45 + i * 0.12 }));
  },

  /* Evento-surpresa: sopro subindo e três sinos. */
  surpresa() {
    if (!this.comecar("surpresa", 1.2, { prioridade: 2 })) return;
    this.ruido(0.8, { vol: 0.07, filtro: "bandpass", freq: 300, ate: 2400, q: 0.7, ataque: 0.4 });
    [587.33, 739.99, 880].forEach((f, i) => this.sino(f, 0.45, { vol: 0.09, atraso: 0.35 + i * 0.12 }));
  },

  entrou() {
    if (!this.comecar("entrou", 0.1, { espera: 0.15 })) return;
    this.tom(880, 0.08, { tipo: "sine", vol: 0.04, ate: 1175 });
  },

  /* Linha raspando na outra. */
  relo() {
    if (!this.comecar("relo", 0.35, { espera: 0.4 })) return;
    this.ruido(0.35, { vol: 0.035, filtro: "bandpass", freq: 2600, ate: 1700, q: 2, ataque: 0.06 });
  },

  /* "Ê, cortou": a linha estala, a pipa cai rodando e o chat comemora.
     Corte do rei, cobrança ou rabiola de fogo ganha baque e acorde. */
  corte(grande = false) {
    if (!this.comecar("corte", grande ? 1 : 0.5, { espera: 0.1, prioridade: grande ? 2 : 1 })) return;
    this.ruido(0.16, { vol: 0.12, filtro: "bandpass", freq: 3200, ate: 600, q: 3, ataque: 0.002 });
    this.tom(784, 0.3, { vol: 0.1, ate: 330, ataque: 0.003 });
    this.sino(659.25, 0.25, { vol: 0.07, atraso: 0.16 });
    this.sino(880, 0.35, { vol: 0.08, atraso: 0.26 });
    if (grande) {
      this.baque(1, 0.05);
      [523.25, 659.25, 783.99, 1046.5].forEach(f => this.tom(f, 0.7, { vol: 0.04, atraso: 0.3, ataque: 0.02 }));
    }
  },

  /* Ventania, cerol dourado ou pipa avoada: vento por baixo da surpresa. */
  evento() {
    if (!this.comecar("evento", 1.6, { prioridade: 2 })) return;
    this.ruido(1.6, { vol: 0.05, filtro: "bandpass", freq: 400, ate: 900, q: 1.2, ataque: 0.5 });
    this.surpresa();
  },
};
