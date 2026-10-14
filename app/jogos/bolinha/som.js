/* Som sintetizado por WebAudio: nada pra baixar, nada com direito autoral.
   Ligado de fábrica em volume moderado; desliga no painel (P), no preset
   (`som: false`), na URL (?som=0) ou na tecla S. A trilha de fundo tem
   volume próprio (`musica`) e liga e desliga junto. */
"use strict";

const Som = {
  ligado: true,
  volume: 0.6,
  musica: 0.25,
  /* Sons de prioridade 0 que tocam juntos. Rajada de rosa passa disso e o
     resto fica mudo: 50 "plins" de uma vez viram só barulho. */
  MAX_SONS: 6,
  _ctx: null,
  _mestre: null,
  _ruido: null,
  _tocando: [],
  _ultimo: {},
  _aviso: null,
  _trilha: null,
  _abafa: null,
  _relogio: null,
  _proximo: 0,
  _passo: 0,

  /* Liga com a config do jogo (`som`; `volume` e `musica` de 0 a 100). */
  aplicar(config) {
    this.ligado = config.som !== false;
    this.volume = Math.min(1, Math.max(0, (config.volume ?? 60) / 100));
    this.musica = Math.min(1, Math.max(0, (config.musica ?? 25) / 100));
    /* Chrome e WebView2 podem travar o áudio até o primeiro clique ou tecla
       na janela (o OBS libera sozinho): destrava no primeiro gesto. */
    const destravar = () => {
      const c = this.ctx();
      if (c && c.state !== "running") c.resume().then(() => this.avisar(), () => {});
    };
    // No toque, o navegador só libera o áudio no fim dele (pointerup/touchend).
    for (const evento of ["pointerdown", "pointerup", "touchend", "keydown"]) addEventListener(evento, destravar, true);
    // O iPhone suspende o áudio quando o streamer vai pro TikTok e volta.
    document.addEventListener("visibilitychange", () => { if (!document.hidden) destravar(); });
    if (this.ligado) {
      this.ctx();
      setTimeout(() => this.avisar(), 1500);
    }
    this.ligarMusica();
  },

  alternar() {
    this.ligado = !this.ligado;
    if (this.ligado) this.ctx();
    this.ligarMusica();
    this.avisar();
    if (this.ligado) setTimeout(() => this.presente(1), 80);
  },

  ctx() {
    if (!this._ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      // Sem isto o iPhone com a chave do silencioso ligada deixa o jogo mudo.
      if (navigator.audioSession) navigator.audioSession.type = "playback";
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
      this._abafa = c.createGain();
      this._trilha = c.createGain();
      this._trilha.gain.value = 0;
      this._trilha.connect(this._abafa).connect(suave);
      if (c.state === "suspended") c.resume().catch(() => {});
    }
    return this._ctx;
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
    if (dur >= 0.3) this.abafar(t, dur);
    return c;
  },

  /* ───────── trilha de fundo ─────────
     Laço de compassos de 16 passos (TRILHA, no fim do arquivo) agendado uns
     0,3 s à frente no relógio do áudio. O setInterval só acorda o agendador:
     a nota cai no tempo certo mesmo com a aba ocupada. */
  ligarMusica() {
    const tocar = this.ligado && this.volume > 0 && this.musica > 0;
    if (tocar && !this._relogio) this._relogio = setInterval(() => this.agendar(), 100);
    if (!tocar && this._relogio) {
      clearInterval(this._relogio);
      this._relogio = null;
    }
    this._proximo = 0;
    if (!this._trilha) return;
    const g = this._trilha.gain;
    const t = this._ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(tocar ? this.musica * 0.7 : 0, t, tocar ? 0.4 : 0.03);
  },

  agendar() {
    const c = this._ctx;
    if (!c || c.state !== "running") return;
    const tr = this.TRILHA;
    const passo = 15 / tr.bpm;
    if (this._proximo < c.currentTime) this._proximo = c.currentTime + 0.05;
    while (this._proximo < c.currentTime + 0.3) {
      this.passoDaTrilha(tr, this._passo, this._proximo, passo);
      this._passo = (this._passo + 1) % (tr.acordes.length * 16);
      this._proximo += passo;
    }
  },

  /* Acordes em semitons a partir do dó central; nos padrões "." é pausa.
     Baixo: 1, 5 e 8 = tônica, quinta e oitava. Arpejo: 0 a 3 = nota do
     acorde, 4 a 7 = a mesma uma oitava acima. */
  GRAU_BAIXO: { 1: 0, 5: 7, 8: 12 },

  semitom(s) { return 261.63 * Math.pow(2, s / 12); },

  passoDaTrilha(tr, i, t, passo) {
    const p = i % 16;
    const acorde = tr.acordes[(i - p) / 16];
    const d = this._trilha;
    const tm = tr.timbre;
    if (tr.bumbo[p] === "x") this.tom(105, 0.18, { tipo: "sine", vol: 0.32, ate: 42, em: t, ataque: 0.003, destino: d });
    if (tr.caixa[p] === "x") this.ruido(0.12, { vol: 0.1, filtro: "bandpass", freq: tm.caixa || 1800, q: 0.9, em: t, ataque: 0.002, destino: d });
    if (tr.chimbal[p] === "x") this.ruido(0.035, { vol: 0.035, filtro: "highpass", freq: 7000, em: t, ataque: 0.001, destino: d });
    const b = tr.baixo[p];
    if (b !== ".") {
      this.tom(this.semitom(acorde[0] - 12 + this.GRAU_BAIXO[b]), passo * 1.8,
        { tipo: tm.baixo, vol: 0.2, brilho: 500, em: t, ataque: 0.01, destino: d });
    }
    const a = tr.arpejo[p];
    if (a !== ".") {
      const n = Number(a);
      this.tom(this.semitom(acorde[n % 4] + (n >> 2) * 12), passo * 1.6,
        { tipo: tm.arpejo, vol: tm.arpejoVol || 0.07, brilho: 2400, em: t, ataque: 0.006, destino: d });
    }
    if (p === 0 && tm.pad) {
      for (let k = 1; k < 4; k++) {
        this.tom(this.semitom(acorde[k] - 12), passo * 15, { tipo: "sawtooth", vol: tm.pad, brilho: 900, em: t, ataque: passo * 4, destino: d });
      }
    }
  },

  /* Efeito que importa abaixa a trilha enquanto toca; ela volta devagar. */
  abafar(t, dur) {
    const g = this._abafa.gain;
    if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t);
    else g.cancelScheduledValues(t);
    g.setTargetAtTime(0.35, t, 0.03);
    g.setTargetAtTime(1, t + dur, 0.35);
  },

  envelope(param, t, vol, ataque, dur) {
    param.setValueAtTime(0.0001, t);
    param.exponentialRampToValueAtTime(vol, t + ataque);
    param.exponentialRampToValueAtTime(0.0001, t + dur);
  },

  /* Tom com envelope curto. `brilho` passa o timbre por um passa-baixa:
     dente de serra filtrada vira metal sem arranhar. `em` marca a hora
     exata no relógio do áudio (a trilha usa), `destino` troca a saída. */
  tom(freq, dur, { tipo = "triangle", vol = 0.1, ate = null, atraso = 0, ataque = 0.008, brilho = 0, em = null, destino = this._mestre } = {}) {
    const c = this._ctx;
    const t = em ?? c.currentTime + atraso;
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
    saida.connect(g).connect(destino);
    o.start(t);
    o.stop(t + dur + 0.05);
  },

  ruido(dur, { vol = 0.1, filtro = "lowpass", freq = 1000, ate = null, q = 1, atraso = 0, ataque = 0.004, em = null, destino = this._mestre } = {}) {
    const c = this._ctx;
    const t = em ?? c.currentTime + atraso;
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
    src.connect(f).connect(g).connect(destino);
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
    this.ruido(0.15 + peso * 0.2, { vol: 0.12 + peso * 0.06, freq: Math.max(300, 1400 - peso * 300), ate: 70, atraso });
  },

  /* Escala pentatônica (dó maior): qualquer sequência de pino soa como
     melodia, nunca como erro. Linha de cima mais aguda. */
  ESCALA: [0, 2, 4, 7, 9],

  nota(grau) {
    const oitava = Math.floor(grau / 5);
    const semitom = this.ESCALA[((grau % 5) + 5) % 5] + oitava * 12;
    return 261.63 * Math.pow(2, semitom / 12);
  },

  pino(linha, linhas, forca = 0.5) {
    if (!this.comecar("pino", 0.16, { espera: 0.018 })) return;
    const grau = 4 + (linhas - 1 - linha);
    const f = this.nota(grau);
    const vol = 0.035 + forca * 0.05;
    this.tom(f, 0.16, { tipo: "sine", vol, ataque: 0.002 });
    this.tom(f * 4, 0.05, { tipo: "sine", vol: vol * 0.25, ataque: 0.001 });
  },

  /* Pote: pancada grave; quanto mais vale, mais brilho por cima. */
  pote(pontos, max) {
    const peso = Math.min(1, pontos / max);
    if (!this.comecar("pote", 0.3, { espera: 0.03, prioridade: peso > 0.3 ? 1 : 0 })) return;
    this.tom(150 - peso * 40, 0.22, { tipo: "sine", vol: 0.16 + peso * 0.1, ate: 55, ataque: 0.003 });
    this.ruido(0.06, { vol: 0.05, filtro: "bandpass", freq: 2400, q: 2 });
    if (peso >= 0.2) this.sino(this.nota(9 + Math.round(peso * 5)), 0.35, { vol: 0.05 + peso * 0.05 });
  },

  /* Pote de 20+: arpejo subindo e um brilho. */
  destaque(pontos) {
    if (!this.comecar("destaque", 1.2, { prioridade: 2 })) return;
    const base = pontos >= 50 ? 10 : 7;
    [0, 2, 4, 5, 7].forEach((g, i) => this.sino(this.nota(base + g), 0.5, { vol: 0.09, atraso: i * 0.07 }));
    this.ruido(0.9, { vol: 0.04, filtro: "highpass", freq: 6000, atraso: 0.2, ataque: 0.2 });
    this.baque(0.6);
  },

  choque() {
    if (!this.comecar("choque", 0.6, { prioridade: 1, espera: 0.3 })) return;
    this.tom(90, 0.4, { tipo: "sawtooth", vol: 0.07, ate: 900, brilho: 2400 });
    this.ruido(0.35, { vol: 0.08, filtro: "bandpass", freq: 3200, ate: 800, q: 3 });
  },

  soltou() {
    if (!this.comecar("soltou", 0.08, { espera: 0.05 })) return;
    this.tom(520, 0.07, { tipo: "triangle", vol: 0.03, ate: 880, ataque: 0.002 });
  },

  /* Presente: faixa 0 a 4, cada degrau mais grandioso. */
  presente(faixa) {
    const n = Math.max(0, Math.min(4, Math.round(faixa)));
    if (!this.comecar("presente", 1, { prioridade: 2, espera: 0.12 })) return;
    const notas = [[7, 9], [7, 9, 12], [5, 7, 9, 12], [5, 7, 9, 12, 14], [0, 4, 7, 9, 12, 14, 17]][n];
    notas.forEach((g, i) => this.sino(this.nota(5 + g), 0.45 + n * 0.1, { vol: 0.07 + n * 0.01, atraso: i * 0.06 }));
    if (n >= 3) this.baque(0.5 + (n - 3) * 0.5, 0.05);
  },

  bolona() {
    if (!this.comecar("bolona", 2, { prioridade: 2 })) return;
    this.baque(1.4);
    this.tom(55, 1.6, { tipo: "sawtooth", vol: 0.08, ate: 35, brilho: 300 });
    this.ruido(1.5, { vol: 0.1, freq: 400, ate: 60, ataque: 0.05 });
  },

  pinoDeOuro() {
    if (!this.comecar("ouro", 1.4, { prioridade: 2 })) return;
    [12, 14, 17, 19, 21, 24].forEach((g, i) => this.sino(this.nota(g), 0.6, { vol: 0.05, atraso: i * 0.05 }));
  },

  apito() {
    if (!this.comecar("apito", 0.5, { prioridade: 2 })) return;
    this.tom(1650, 0.18, { tipo: "square", vol: 0.04, brilho: 3000 });
    this.tom(2100, 0.25, { tipo: "square", vol: 0.04, brilho: 3000, atraso: 0.2 });
  },

  bip(ultimo = false) {
    if (!this.comecar("bip", 0.2, { prioridade: 2 })) return;
    this.tom(ultimo ? 1320 : 880, ultimo ? 0.4 : 0.12, { tipo: "triangle", vol: 0.07 });
  },

  fanfarra() {
    if (!this.comecar("fanfarra", 2.4, { prioridade: 2 })) return;
    const seq = [[0, 0], [4, 0.14], [7, 0.28], [12, 0.42], [7, 0.66], [12, 0.8]];
    for (const [g, t] of seq) {
      this.tom(this.nota(5 + Math.round(g * 5 / 12)), 0.35, { tipo: "sawtooth", vol: 0.04, brilho: 1800, atraso: t });
      this.sino(this.nota(10 + Math.round(g * 5 / 12)), 0.5, { vol: 0.05, atraso: t });
    }
    this.baque(0.8, 0.8);
  },

  /* Curtida chega em enxurrada: no máximo uma a cada 0,15 s, baixinha e
     subindo a escala, pra rajada soar como brilho e não metralhadora. */
  _curtida: 0,
  curtida() {
    if (!this.comecar("curtida", 0.06, { espera: 0.15 })) return;
    this._curtida = (this._curtida + 1) % 5;
    this.tom(this.nota(10 + this._curtida), 0.06, { tipo: "sine", vol: 0.022, ataque: 0.002 });
  },

  /* Seguiu (bolinha de ouro) ou compartilhou: dois sinos dourados. */
  seguiu() {
    if (!this.comecar("seguiu", 0.45, { espera: 0.25, prioridade: 1 })) return;
    this.sino(this.nota(12), 0.25, { vol: 0.06 });
    this.sino(this.nota(14), 0.4, { vol: 0.06, atraso: 0.09 });
  },

  /* Primeiro comentário de alguém: "pop" de quem entrou na mesa. */
  entrou() {
    if (!this.comecar("entrou", 0.1, { espera: 0.12 })) return;
    this.tom(this.nota(7), 0.08, { tipo: "sine", vol: 0.04, ate: this.nota(9), ataque: 0.002 });
  },

  /* Fliperama neon: dó maior, pulsação leve e sino espaçado, que o pino
     já toca melodia de sobra. */
  TRILHA: {
    bpm: 112,
    acordes: [[0, 4, 7, 12], [-3, 0, 4, 9], [-7, -3, 0, 5], [-5, -1, 2, 7]],
    bumbo: "x.......x.......",
    caixa: "....x.......x...",
    chimbal: "..x...x...x...x.",
    baixo: "1.....1.5.......",
    arpejo: "0...2...4...2...",
    timbre: { baixo: "triangle", arpejo: "sine", arpejoVol: 0.06 },
  },
};
