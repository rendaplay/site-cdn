/* Som sintetizado, ligado por padrão em volume moderado (`som` e `volume`
   no preset ou no painel P; ?som=0 na URL e a tecla S desligam).
   Sintetizado e não arquivo: nada pra baixar, nada com direito autoral.

   O navegador só libera áudio depois de um clique na página. Fonte de
   navegador do OBS e a janela do launcher liberam sozinhas. */
"use strict";

const Som = {
  ligado: true,
  volume: 0.5,
  musica: 0.25,
  _ctx: null,
  _mestre: null,
  _ruido: null,
  _voltou: false,
  _aviso: null,
  _trilha: null,
  _relogio: null,
  _proximo: 0,
  _passo: 0,

  /* No celular nada destrava sozinho: o áudio só liga no fim de um toque
     (pointerup/touchend), e o iPhone suspende de novo quando o streamer vai
     pro TikTok e volta. */
  destravarNoToque() {
    const destravar = () => { if (this.ligado && this.volume) this.ctx(); };
    /* Na volta do TikTok o áudio pode ficar mudo de vez, mesmo "running":
       o primeiro toque depois disso troca o contexto por um novo. */
    const tocou = () => {
      if (this._voltou) this.recriar();
      destravar();
    };
    for (const evento of ["pointerdown", "pointerup", "touchend", "keydown"]) addEventListener(evento, tocou, true);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this._voltou = !!this._ctx;
      else destravar();
    });
    if (this.ligado && this.volume) {
      this.ctx();
      setTimeout(() => this.avisar(), 1500);
    }
    this.ligarMusica();
  },

  recriar() {
    this._voltou = false;
    if (!this._ctx) return;
    this._ctx.onstatechange = null;
    this._ctx.close().catch(() => {});
    this._ctx = this._mestre = this._ruido = this._trilha = null;
    this._proximo = 0;
  },

  ctx() {
    if (!this._ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      // Sem isto o iPhone com a chave do silencioso ligada deixa o jogo mudo.
      if (navigator.audioSession) navigator.audioSession.type = "playback";
      this._ctx = new AC();
      this._ctx.onstatechange = () => this.avisar();
      this._mestre = this._ctx.createGain();
      this._mestre.connect(this._ctx.destination);
      this._trilha = this._ctx.createGain();
      this._trilha.gain.value = this.nivelDaMusica();
      this._trilha.connect(this._mestre);
    }
    if (this._ctx.state !== "running") this._ctx.resume().catch(() => {});
    this._mestre.gain.value = this.volume;
    return this._ctx;
  },

  /* `em` marca a hora exata no relógio do áudio e `destino` troca a saída:
     a trilha usa os dois. */
  nota(freq, dur, { tipo = "triangle", vol = 0.18, ate = null, atraso = 0, em = null, destino = null } = {}) {
    if (!this.ligado || !this.volume) return;
    const c = this.ctx();
    if (!c) return;
    const t = em ?? c.currentTime + atraso;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(freq, t);
    if (ate) o.frequency.exponentialRampToValueAtTime(ate, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(destino || this._mestre);
    o.start(t);
    o.stop(t + dur + 0.02);
  },

  /* Ruído filtrado: o "corpo" de pancada, poeira e desabamento. */
  ruido(dur, { freq = 800, q = 0.8, vol = 0.2, atraso = 0, ate = null, em = null, destino = null, filtro = "bandpass" } = {}) {
    if (!this.ligado || !this.volume) return;
    const c = this.ctx();
    if (!c) return;
    if (!this._ruido) {
      const b = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this._ruido = b;
    }
    const t = em ?? c.currentTime + atraso;
    const s = c.createBufferSource();
    s.buffer = this._ruido;
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = filtro;
    f.frequency.setValueAtTime(freq, t);
    if (ate) f.frequency.exponentialRampToValueAtTime(ate, t + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(destino || this._mestre);
    s.start(t);
    s.stop(t + dur + 0.02);
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

  /* ───────── trilha de fundo ─────────
     Laço de compassos de 16 passos (TRILHA, no fim do arquivo) agendado uns
     0,3 s à frente no relógio do áudio. O setInterval só acorda o agendador:
     a nota cai no tempo certo mesmo com a aba ocupada. */
  nivelDaMusica() { return this.ligado && this.volume > 0 ? this.musica * 0.7 : 0; },

  ligarMusica() {
    const tocar = this.nivelDaMusica() > 0;
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
    g.setTargetAtTime(this.nivelDaMusica(), t, tocar ? 0.4 : 0.03);
  },

  agendar() {
    const c = this._ctx;
    if (!c || c.state !== "running" || !this._trilha) return;
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
    if (tr.bumbo[p] === "x") this.nota(105, 0.18, { tipo: "sine", vol: 0.32, ate: 42, em: t, destino: d });
    if (tr.caixa[p] === "x") this.ruido(0.12, { vol: 0.1, freq: 2000, q: 0.9, em: t, destino: d });
    if (tr.chimbal[p] === "x") this.ruido(0.035, { vol: 0.035, filtro: "highpass", freq: 7000, em: t, destino: d });
    const b = tr.baixo[p];
    if (b !== ".") this.nota(this.semitom(acorde[0] - 12 + this.GRAU_BAIXO[b]), passo * 1.8, { tipo: "triangle", vol: 0.2, em: t, destino: d });
    const a = tr.arpejo[p];
    if (a !== ".") {
      const n = Number(a);
      this.nota(this.semitom(acorde[n % 4] + (n >> 2) * 12), passo * 1.6, { tipo: "square", vol: 0.03, em: t, destino: d });
    }
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

  /* Presente chegou: o "plim" sai na hora, o encaixe só quando a peça assenta.
     Chuva de presentes vira metralhadora: no máximo um a cada 120 ms. */
  _empilharEm: -Infinity,
  empilhar() {
    const agora = performance.now();
    if (agora - this._empilharEm < 120) return;
    this._empilharEm = agora;
    this.nota(1046, 0.12, { tipo: "sine", vol: 0.12 });
    this.nota(1568, 0.16, { tipo: "sine", vol: 0.08, atraso: 0.05 });
  },
  /* Curtida e comentário chegam em rajada: no máximo um tique a cada 150 ms. */
  _toqueEm: -Infinity,
  toque() {
    const agora = performance.now();
    if (agora - this._toqueEm < 150) return;
    this._toqueEm = agora;
    this.nota(1900, 0.04, { tipo: "sine", vol: 0.035 });
  },
  entrou() {
    this.nota(523, 0.1, { tipo: "triangle", vol: 0.1 });
    this.nota(784, 0.16, { tipo: "triangle", vol: 0.1, atraso: 0.08 });
  },

  /* Fala gravada (arquivo do preset), uma por vez: `prioridade` corta a que
     estiver tocando, senão espera o `intervalo` desde a última. */
  _audios: new Map(),
  _fala: null,
  _falaEm: -Infinity,
  _ultimaFala: null,

  async fala(lista, { intervalo = 15, prioridade = false } = {}) {
    if (!this.ligado || !this.volume || !lista || !lista.length) return;
    const agora = performance.now();
    if (!prioridade && (this._fala || agora - this._falaEm < intervalo * 1000)) return;
    const c = this.ctx();
    if (!c) return;
    this._falaEm = agora;
    const opcoes = lista.length > 1 ? lista.filter(x => x !== this._ultimaFala) : lista;
    const url = opcoes[Math.floor(Math.random() * opcoes.length)];
    this._ultimaFala = url;
    let buffer = this._audios.get(url);
    if (!buffer) {
      try {
        buffer = await c.decodeAudioData(await (await fetch(url)).arrayBuffer());
      } catch (e) {
        console.warn("fala:", url, e);
        return;
      }
      this._audios.set(url, buffer);
    }
    if (this._fala) this._fala.stop();
    const s = c.createBufferSource();
    s.buffer = buffer;
    s.connect(this._mestre);
    s.onended = () => { if (this._fala === s) this._fala = null; };
    this._fala = s;
    s.start();
  },

  /* Batida de disputa em lá menor (Lám, Fá, Rém, Sol): dá clima de duelo
     sem brigar com os golpes e as falas. */
  TRILHA: {
    bpm: 116,
    acordes: [[-3, 0, 4, 9], [-7, -3, 0, 5], [-10, -7, -3, 2], [-5, -1, 2, 7]],
    bumbo: "x...x...x..x....",
    caixa: "....x.......x...",
    chimbal: "..x...x...x...x.",
    baixo: "1.1...1.5...1...",
    arpejo: "4...5...6...5...",
  },
};
