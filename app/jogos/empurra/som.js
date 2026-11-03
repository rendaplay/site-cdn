/* Som do Empurra-Empurra: batucada de arquibancada que esquenta conforme
   a rodada aperta, o baque do empurrão, o boing de quem cambaleia na
   beira, o vento da arrancada e o estrondo do terremoto (sintetizados),
   mais apito, torcida, confete, escorregão e fanfarra (mp3 em audio/) e o
   narrador (audio/voz/, lista em falas.js). Um bordão por vez, e a
   batucada abaixa enquanto ele fala. Por file:// o fetch falha e fica só o
   sintetizado. Desliga no painel (P), na URL (?som=0) ou na S. */
"use strict";

const EFEITOS = ["torcida", "torcida-forte", "rufar", "fanfarra", "jato", "apito", "confete", "escorregao", "nitro"];

/* Falas que passam por cima da que está tocando. As outras esperam o respiro. */
const FALA_FORTE = new Set(["inicio", "dez", "venceu", "terremoto", "vermelho"]);
const RESPIRO = 1.2;
const VOLUME_TRILHA = 0.8;
const VOLUME_TORCIDA = 0.24;

const Som = {
  ligado: true,
  volume: 0.7,
  musica: 0.3,
  narrador: true,
  _ctx: null,
  _mestre: null,
  _trilha: null,
  _torcida: null,
  _batucada: null,
  _buf: new Map(),
  _ruido: null,
  _fundoLigado: null,
  _fala: null,
  _falaForte: false,
  _livreEm: 0,
  _ultimaFala: null,
  _aviso: null,
  _voltou: false,
  _batida: 0,
  _proxima: 0,
  ritmo: 0,

  aplicar(config) {
    this.ligado = config.som !== false && new URLSearchParams(location.search).get("som") !== "0";
    this.narrador = config.narrador !== false;
    this.volume = Math.min(1, Math.max(0, (config.volume ?? 70) / 100));
    this.musica = Math.min(1, Math.max(0, (config.musica ?? 30) / 100));
    this.falas = window.EMPURRA_FALAS || [];
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
      this._batucada = null;
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
    this._ctx = this._mestre = this._trilha = this._torcida = this._fala = this._batucada = null;
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

  /* Torcida de fundo e a batucada, uma vez por contexto. */
  ligarFundo() {
    const c = this._ctx;
    if (!c || c.state !== "running") return;
    if (this._batucada !== c) {
      this._batucada = c;
      this._proxima = c.currentTime + 0.1;
    }
    if (this._fundoLigado === c || !this._buf.has("torcida")) return;
    this._fundoLigado = c;
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

  /* Fala do momento; com `time`, prefere a fala daquele time. */
  falar(momento, time = null) {
    if (!this.narrador || !this.rodando()) return;
    const c = this._ctx, agora = c.currentTime;
    const forte = FALA_FORTE.has(momento);
    // A forte só corta a fala comum: duas fortes seguidas não se atropelam.
    if (agora < this._livreEm && (!forte || this._falaForte)) return;
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
    this._falaForte = forte;
    const dur = this._fala.duracao;
    this._livreEm = agora + dur + RESPIRO;
    const g = this._trilha.gain, cheio = this.musica * VOLUME_TRILHA;
    g.cancelScheduledValues(agora);
    g.setTargetAtTime(cheio * 0.3, agora, 0.05);
    g.setTargetAtTime(cheio, agora + dur, 0.3);
  },

  onda(alto = 0.8) {
    if (!this._torcida || !this.rodando()) return;
    const g = this._torcida.gain, t = this._ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(alto, t, 0.1);
    g.setTargetAtTime(VOLUME_TORCIDA, t + 1.4, 0.6);
  },

  /* ───────── batucada ───────── */

  /* Agenda as batidas um pouco à frente, em semicolcheias. `ritmo` (0 a 1)
     é o aperto da rodada (pouca gente em pé, fim do tempo): acelera de 100
     a 128 por minuto e vai entrando tamborim e chocalho. */
  quadro(parado) {
    const c = this._ctx;
    if (!this.rodando() || this._batucada !== c) return;
    const passo = 60 / (100 + this.ritmo * 28) / 4;
    while (this._proxima < c.currentTime + 0.12) {
      const t = Math.max(this._proxima, c.currentTime);
      if (!parado) {
        const n = this._batida % 16;
        if (n === 4 || n === 12) this.surdo(t, n === 12 ? 1 : 0.55, n === 12 ? 52 : 64);
        if (n === 14 && this.ritmo > 0.3) this.surdo(t, 0.4, 64);
        this.caixa(t, [0, 3, 6, 8, 11, 14].includes(n) ? 0.32 : 0.1);
        if (this.ritmo > 0.25 && [0, 2, 3, 6, 8, 10, 11, 14].includes(n)) this.tamborim(t, n === 0 || n === 8 ? 0.5 : 0.3);
        if (this.ritmo > 0.6 && n % 2 === 1) this.ruido(t, { dur: 0.05, freq: 7000, volume: 0.12, saida: this._trilha, tipo: "highpass" });
      }
      this._batida++;
      this._proxima += passo;
    }
  },

  surdo(t, forca, freq) {
    const c = this._ctx, o = c.createOscillator(), g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(freq * 1.8, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.06);
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.95 * forca, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    o.connect(g).connect(this._trilha);
    o.start(t);
    o.stop(t + 0.6);
    this.ruido(t, { dur: 0.05, freq: 700, volume: 0.2 * forca, saida: this._trilha });
  },

  caixa(t, forca) {
    this.ruido(t, { dur: 0.07, freq: 3200, q: 0.7, volume: forca * 0.5, saida: this._trilha, tipo: "highpass" });
  },

  tamborim(t, forca) {
    const c = this._ctx, o = c.createOscillator(), g = c.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(980, t);
    o.frequency.exponentialRampToValueAtTime(720, t + 0.05);
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.28 * forca, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    o.connect(g).connect(this._trilha);
    o.start(t);
    o.stop(t + 0.1);
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

  /* Baque do empurrão: corpo contra corpo, mais grave e comprido quanto
     mais forte. */
  baque(forca = 0.5) {
    if (!this.rodando()) return;
    const c = this._ctx, t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(150 + forca * 40, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.18 + forca * 0.12);
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(Math.min(1, 0.45 + forca * 0.4), t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3 + forca * 0.2);
    o.connect(g).connect(this._mestre);
    o.start(t);
    o.stop(t + 0.55 + forca * 0.2);
    this.ruido(t, { dur: 0.12 + forca * 0.08, freq: 900, q: 0.8, volume: 0.35 + forca * 0.3, ataque: 0.002 });
    if (forca >= 1) this.ruido(t, { dur: 0.2, freq: 3500, q: 0.6, volume: 0.4, tipo: "highpass", ataque: 0.001 });
  },

  /* Boing de quem cambaleia na beira. */
  boing() {
    if (!this.rodando()) return;
    const c = this._ctx, t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), prof = c.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(240, t);
    o.frequency.exponentialRampToValueAtTime(520, t + 0.5);
    lfo.frequency.value = 14;
    prof.gain.value = 40;
    lfo.connect(prof).connect(o.frequency);
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.28, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    o.connect(g).connect(this._mestre);
    o.start(t);
    lfo.start(t);
    o.stop(t + 0.62);
    lfo.stop(t + 0.62);
  },

  /* Vento da arrancada: ruído que sobe de tom. */
  zum(forca = 0.5) {
    if (!this.rodando()) return;
    const t = this._ctx.currentTime;
    const f = this.ruido(t, { dur: 0.3 + forca * 0.3, freq: 600, q: 2, volume: 0.25 + forca * 0.35, ataque: 0.04 });
    f.frequency.exponentialRampToValueAtTime(2400 + forca * 1500, t + 0.25 + forca * 0.2);
  },

  /* Queda pra fora do círculo: escorregão e o tombo no chão. */
  tombo() {
    if (!this.rodando()) return;
    this.tocar("escorregao", { volume: 0.7, taxa: 0.9 + Math.random() * 0.2 });
    const c = this._ctx, t = c.currentTime + 0.42;
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(35, t + 0.3);
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.7, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    o.connect(g).connect(this._mestre);
    o.start(t);
    o.stop(t + 0.5);
  },

  /* Ronco grave: ruído num passa-baixa que treme. */
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

  /* Brilho que sobe: quanto maior a faixa do presente, mais notas. */
  subida(faixa) {
    if (!this.rodando()) return;
    const c = this._ctx, t0 = c.currentTime;
    [523, 659, 784, 1047, 1319, 1568].slice(0, 2 + faixa).forEach((f, i) => {
      const t = t0 + i * 0.06, o = c.createOscillator(), g = c.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.001, t);
      g.gain.exponentialRampToValueAtTime(0.14, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      o.connect(g).connect(this._mestre);
      o.start(t);
      o.stop(t + 0.4);
    });
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
