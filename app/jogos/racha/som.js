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
  MAX_SONS: 5,
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
    if (tocar) this.ambiente();
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

  bufferRuido() {
    const c = this._ctx;
    if (!this._ruido) {
      this._ruido = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const d = this._ruido.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return this._ruido;
  },

  ruido(dur, { vol = 0.1, filtro = "lowpass", freq = 1000, ate = null, q = 1, atraso = 0, ataque = 0.004, em = null, destino = this._mestre } = {}) {
    const c = this._ctx;
    const t = em ?? c.currentTime + atraso;
    const src = c.createBufferSource();
    src.buffer = this.bufferRuido();
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

  /* Faixas do racha (turbo, nitro, óleo, míssil, escudo, bomba) no degrau
     de grandeza do presente. */
  NIVEL: [0, 1, 2, 3, 3, 4],

  tocar(a) {
    switch (a.tipo) {
      case "buzina": this.buzina(); break;
      case "presente":
        if (a.faixa < 0) break;
        this.presente(this.NIVEL[Math.min(a.faixa, 5)]);
        if (a.efeito === "turbo" || a.efeito === "nitro") this.nitro(a.efeito === "nitro");
        break;
      case "atingido": a.efeito === "oleo" ? this.derrapou() : this.explosao(a.efeito === "bomba"); break;
      case "largada": this.largada(a.segundos); break;
      case "vai": this.vai(); this.acelerar(true); break;
      case "podio": case "espera": this.acelerar(false); break;
      case "ultrapassagem": this.ultrapassagem(); break;
      case "lider":
        if (!this.comecar("lider", 0.4, { espera: 0.5, prioridade: 1 })) break;
        this.sino(659.25, 0.2, { vol: 0.08 });
        this.sino(987.77, 0.35, { vol: 0.08, atraso: 0.1 });
        break;
      case "chegou":
        if (a.posicao === 1) {
          this.vitoria();
          this.torcer();
        } else if (a.posicao <= 3) this.chegada(a.posicao);
        break;
      case "surpresa": this.surpresa(); break;
      case "curtida": this.curtida(); break;
      case "seguiu": case "compartilhou": this.seguiu(); break;
      case "entrou": this.entrou(); break;
      case "apoio": this.apoio(); break;
    }
  },

  /* Buzina de comentário: vem toda hora, então curta e abafada. */
  buzina() {
    if (!this.comecar("buzina", 0.2, { espera: 0.3 })) return;
    this.tom(415.3, 0.18, { tipo: "sawtooth", vol: 0.035, brilho: 900, ataque: 0.01 });
    this.tom(523.25, 0.18, { tipo: "sawtooth", vol: 0.035, brilho: 900, ataque: 0.01 });
  },

  /* Motor girando alto e o sopro do nitro. */
  nitro(forte) {
    if (!this.comecar("nitro", 0.7, { espera: 0.25 })) return;
    this.tom(90, forte ? 0.6 : 0.4, { tipo: "sawtooth", vol: 0.09, ate: forte ? 300 : 220, brilho: 900, ataque: 0.02 });
    if (forte) this.ruido(0.6, { vol: 0.1, filtro: "bandpass", freq: 700, ate: 3500, q: 0.8, ataque: 0.05 });
  },

  derrapou() {
    if (!this.comecar("derrapou", 0.6, { espera: 0.3, prioridade: 1 })) return;
    this.tom(750, 0.5, { tipo: "sine", vol: 0.06, ate: 280, ataque: 0.02 });
    this.ruido(0.45, { vol: 0.05, filtro: "bandpass", freq: 1800, ate: 900, q: 4, ataque: 0.03 });
  },

  explosao(grande) {
    if (!this.comecar("explosao", 1, { espera: 0.25, prioridade: grande ? 2 : 1 })) return;
    this.baque(grande ? 2 : 1);
    this.ruido(grande ? 0.9 : 0.6, { vol: 0.12, freq: 2500, ate: 120, ataque: 0.003 });
  },

  /* Três bipes graves nos últimos segundos da largada; o "vai" é agudo. */
  largada(segundos = 3) {
    if (!this.comecar("largada", segundos, { prioridade: 2 })) return;
    for (let i = 0; i < 3; i++) {
      this.tom(440, 0.22, { tipo: "sine", vol: 0.11, atraso: Math.max(0, segundos - 3 + i), ataque: 0.005 });
    }
  },

  vai() {
    if (!this.comecar("vai", 0.7, { prioridade: 2 })) return;
    this.tom(880, 0.5, { tipo: "sine", vol: 0.12, ataque: 0.005 });
    this.tom(880, 0.5, { vol: 0.05, ataque: 0.005 });
    this.tom(70, 0.7, { tipo: "sawtooth", vol: 0.07, ate: 260, brilho: 800, ataque: 0.04 });
  },

  /* Passou de raspão: motor subindo e o vento do carro. */
  ultrapassagem() {
    if (!this.comecar("ultrapassagem", 0.4, { espera: 0.5, prioridade: 1 })) return;
    this.tom(200, 0.35, { tipo: "sawtooth", vol: 0.08, ate: 330, brilho: 1000, ataque: 0.02 });
    this.ruido(0.35, { vol: 0.08, filtro: "bandpass", freq: 2200, ate: 600, q: 1, ataque: 0.08 });
  },

  /* 2º e 3º lugar: a fanfarra da vitória em miniatura, um degrau abaixo. */
  chegada(posicao) {
    if (!this.comecar("chegada" + posicao, 0.9, { prioridade: 1 })) return;
    const base = posicao === 2 ? 659.25 : 587.33;
    [base, base * 1.26, base * 1.498].forEach((f, i) => this.tom(f, 0.16, { vol: 0.07, atraso: i * 0.09, brilho: 2200 }));
    this.sino(base * 2, posicao === 2 ? 0.5 : 0.35, { vol: 0.05, atraso: 0.27 });
  },

  /* Curtida chega em enxurrada: no máximo uma a cada 0,15 s, baixinha e
     subindo a escala, pra rajada soar como brilho e não metralhadora. */
  ESCALA_CURTIDA: [1046.5, 1174.66, 1318.51, 1567.98, 1760],
  _curtida: 0,

  curtida() {
    if (!this.comecar("curtida", 0.06, { espera: 0.15 })) return;
    this._curtida = (this._curtida + 1) % this.ESCALA_CURTIDA.length;
    this.tom(this.ESCALA_CURTIDA[this._curtida], 0.06, { tipo: "sine", vol: 0.025, ataque: 0.002 });
  },

  /* Seguiu ou compartilhou: turbo de graça, dois sinos. */
  seguiu() {
    if (!this.comecar("seguiu", 0.4, { espera: 0.25, prioridade: 1 })) return;
    this.sino(783.99, 0.25, { vol: 0.06 });
    this.sino(1174.66, 0.35, { vol: 0.06, atraso: 0.09 });
  },

  /* Piloto novo na grade: motor dando a partida, curtinho. */
  entrou() {
    if (!this.comecar("entrou", 0.25, { espera: 0.2 })) return;
    this.tom(80, 0.22, { tipo: "sawtooth", vol: 0.04, ate: 160, brilho: 600, ataque: 0.01 });
  },

  /* Comentário com @ passou a empurrar outro piloto. */
  apoio() {
    if (!this.comecar("apoio", 0.1, { espera: 0.15 })) return;
    this.tom(988, 0.07, { tipo: "sine", vol: 0.03, ate: 1318.51, ataque: 0.003 });
  },

  /* Ronco dos motores e a arquibancada por baixo da trilha. Nós fixos,
     criados uma vez: só o giro e o volume mudam. Saem pela trilha, então
     calam junto com ela. */
  _motor: null,
  _giro: null,
  _torcida: null,

  ambiente() {
    const c = this._ctx;
    if (this._motor) return;
    const motor = c.createOscillator();
    motor.type = "sawtooth";
    motor.frequency.value = 45;
    const tremido = c.createOscillator();
    tremido.frequency.value = 9;
    const tremidoGanho = c.createGain();
    tremidoGanho.gain.value = 3;
    tremido.connect(tremidoGanho).connect(motor.frequency);
    const abafado = c.createBiquadFilter();
    abafado.type = "lowpass";
    abafado.frequency.value = 300;
    this._motor = c.createGain();
    this._motor.gain.value = 0.03;
    motor.connect(abafado).connect(this._motor).connect(this._trilha);
    this._giro = motor.frequency;

    const torcida = c.createBufferSource();
    torcida.buffer = this.bufferRuido();
    torcida.loop = true;
    const voz = c.createBiquadFilter();
    voz.type = "bandpass";
    voz.frequency.value = 900;
    voz.Q.value = 0.6;
    this._torcida = c.createGain();
    this._torcida.gain.value = 0.04;
    torcida.connect(voz).connect(this._torcida).connect(this._trilha);
    motor.start();
    tremido.start();
    torcida.start();
  },

  /* Largou: os motores sobem de giro. Pódio e espera: marcha lenta. */
  acelerar(correndo) {
    if (!this._motor) return;
    const t = this._ctx.currentTime;
    this._giro.setTargetAtTime(correndo ? 72 : 45, t, correndo ? 0.6 : 1.2);
    this._motor.gain.setTargetAtTime(correndo ? 0.1 : 0.03, t, 0.5);
  },

  /* Chegada do 1º: a arquibancada levanta e volta a sentar. */
  torcer() {
    if (!this._torcida) return;
    const g = this._torcida.gain;
    const t = this._ctx.currentTime;
    g.setTargetAtTime(0.16, t, 0.15);
    g.setTargetAtTime(0.04, t + 1.5, 0.8);
  },

  /* Racha de rua: mi menor, bumbo de pista e baixo em colcheia. */
  TRILHA: {
    bpm: 140,
    acordes: [[-8, -5, -1, 4], [-12, -8, -5, 0], [-10, -6, -3, 2], [-13, -9, -6, -1]],
    bumbo: "x.......x.x.....",
    caixa: "....x.......x...",
    chimbal: "x.x.x.x.x.x.x.x.",
    baixo: "1.1.1.1.1.1.5.8.",
    arpejo: "4.....5.....6...",
    timbre: { baixo: "sawtooth", arpejo: "square", arpejoVol: 0.03, pad: 0.01 },
  },
};
