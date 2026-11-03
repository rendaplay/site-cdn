/* Som da Maior Torcida do Brasil: a batucada da arquibancada (surdo, caixa e
   tamborim sintetizados) que engrossa com o barulho do estádio e acelera
   nos 10 s finais, o coro da torcida em mp3 subindo e descendo junto, os
   efeitos dos presentes (sinalizador chiando, bandeirão no vento, cartões
   virando, buzina do ônibus, apagão e fogos) e o narrador (audio/voz/,
   lista em falas.js). Um bordão por vez, e a batucada abaixa enquanto ele
   fala. Por file:// o fetch falha e fica só o sintetizado. Desliga no
   painel (P), na URL (?som=0) ou na S. */
"use strict";

const EFEITOS = ["torcida", "torcida-forte", "rufar", "fanfarra", "apito", "confete"];

/* Falas que passam por cima da que está tocando. As outras esperam o respiro. */
const FALA_FORTE = new Set(["inicio", "dez", "venceu", "lendario", "rodada"]);
/* Momento com fala do próprio time que sempre usa a do time. */
const FALA_DO_TIME = new Set(["venceu"]);
const RESPIRO = 1.2;
const VOLUME_TRILHA = 0.8;
const VOLUME_TORCIDA = 0.16;

const Som = {
  ligado: true,
  volume: 0.7,
  musica: 0.4,
  narrador: true,
  _ctx: null,
  _mestre: null,
  _trilha: null,
  _torcida: null,
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
  _onda: 0,
  /* 0 a 1: quanto o estádio está fazendo barulho (cena → som). */
  barulho: 0,
  final: false,

  aplicar(config) {
    this.ligado = config.som !== false;
    this.narrador = config.narrador !== false;
    this.volume = Math.min(1, Math.max(0, (config.volume ?? 70) / 100));
    this.musica = Math.min(1, Math.max(0, (config.musica ?? 40) / 100));
    this.falas = window.TORCIDA_FALAS || [];
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
      this._proxima = 0;
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

  /* Coro da torcida de fundo, uma vez por contexto. */
  ligarFundo() {
    const c = this._ctx;
    if (!c || c.state !== "running") return;
    if (!this._proxima) this._proxima = c.currentTime + 0.1;
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

  /* Com `time`, a fala do time sai 70% das vezes (no `venceu`, sempre). */
  falar(momento, time = null) {
    if (!this.narrador || !this.rodando()) return;
    const c = this._ctx, agora = c.currentTime;
    const forte = FALA_FORTE.has(momento);
    // A forte só corta a fala comum: duas fortes seguidas não se atropelam.
    if (agora < this._livreEm && (!forte || this._falaForte)) return;
    const prontas = this.falas.filter(f => f.momento === momento && this._buf.has("voz:" + f.id));
    const doTime = time ? prontas.filter(f => f.time === time) : [];
    const gerais = prontas.filter(f => !f.time);
    const preferir = FALA_DO_TIME.has(momento) || Math.random() < 0.7 || !gerais.length;
    let opcoes = doTime.length && preferir ? doTime : gerais;
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

  /* Coro sobe de uma vez e volta pro nível do barulho. */
  onda(alto = 0.8, seg = 1.4) {
    if (!this.rodando()) return;
    this._onda = Math.max(this._onda, alto);
    this._ondaAte = this._ctx.currentTime + seg;
  },

  /* ───────── batucada ───────── */

  /* Agenda um compasso de semicolcheias um pouco à frente: surdo de
     marcação no 1 e no 3, a resposta no contratempo, caixa e tamborim
     entrando conforme o estádio esquenta. 128 por minuto (140 no fim). */
  quadro(parado) {
    const c = this._ctx;
    if (!this.rodando() || !this._proxima) return;
    const agora = c.currentTime;
    if (this._torcida) {
      const onda = agora < (this._ondaAte || 0) ? this._onda : 0;
      if (!onda) this._onda = 0;
      const alvo = parado ? VOLUME_TORCIDA * 0.7 : Math.max(onda, VOLUME_TORCIDA + this.barulho * 0.42);
      this._torcida.gain.setTargetAtTime(alvo, agora, onda ? 0.08 : 0.5);
    }
    const bpm = this.final ? 140 : 128;
    const passo = 60 / bpm / 4;
    const b = this.barulho;
    while (this._proxima < agora + 0.12) {
      const t = Math.max(this._proxima, agora);
      if (!parado) {
        const n = this._batida % 16;
        if (n === 0 || n === 8) this.surdo(t, 1, 58);
        if (n === 6 || n === 14) this.surdo(t, 0.75, 76);
        if (b > 0.15 && (n === 4 || n === 12)) this.caixa(t, 0.22 + b * 0.25);
        if (b > 0.35 && n % 2 === 1) this.caixa(t, 0.06 + b * 0.08);
        if (b > 0.5 && [0, 3, 6, 10, 12].includes(n)) this.tamborim(t, 0.1 + b * 0.12);
        if (this.final && n % 4 === 2) this.caixa(t, 0.3);
      }
      this._batida++;
      this._proxima += passo;
    }
  },

  surdo(t, forca, freq) {
    const c = this._ctx, o = c.createOscillator(), g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(freq * 1.9, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.07);
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.85 * forca, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    o.connect(g).connect(this._trilha);
    o.start(t);
    o.stop(t + 0.6);
    this.ruido(t, { dur: 0.05, freq: 700, volume: 0.2 * forca, saida: this._trilha });
  },

  caixa(t, forca) {
    this.ruido(t, { dur: 0.1, freq: 2600, q: 0.8, volume: forca, saida: this._trilha, tipo: "highpass" });
  },

  tamborim(t, forca) {
    const c = this._ctx, o = c.createOscillator(), g = c.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(980, t);
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(forca, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    o.connect(g).connect(this._trilha);
    o.start(t);
    o.stop(t + 0.08);
    this.ruido(t, { dur: 0.03, freq: 5000, volume: forca * 0.8, saida: this._trilha, tipo: "highpass", ataque: 0.001 });
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

  /* ───────── efeitos dos presentes ───────── */

  /* Sinalizador acendendo: estalo e o chiado da queima. */
  chiado(seg = 3) {
    if (!this.rodando()) return;
    const t = this._ctx.currentTime;
    this.ruido(t, { dur: 0.08, freq: 3000, q: 1, volume: 0.5, tipo: "highpass", ataque: 0.001 });
    const f = this.ruido(t + 0.05, { dur: seg, freq: 5200, q: 0.7, volume: 0.16, ataque: 0.15 });
    f.frequency.linearRampToValueAtTime(4200, t + seg);
  },

  /* Pano grande pegando vento. */
  vento(seg = 1.6) {
    if (!this.rodando()) return;
    const t = this._ctx.currentTime;
    const f = this.ruido(t, { dur: seg, freq: 300, q: 1.2, volume: 0.5, ataque: 0.4 });
    f.frequency.exponentialRampToValueAtTime(1300, t + seg * 0.6);
    f.frequency.exponentialRampToValueAtTime(400, t + seg);
    for (let i = 0; i < 4; i++) this.ruido(t + 0.3 + i * 0.32, { dur: 0.12, freq: 600, q: 2, volume: 0.25 });
  },

  /* Centenas de cartões virando: estalinhos espalhados que varrem o setor. */
  cartoes(seg = 1.4) {
    if (!this.rodando()) return;
    const t0 = this._ctx.currentTime;
    for (let i = 0; i < 70; i++) {
      const t = t0 + (i / 70) * seg + Math.random() * 0.05;
      this.ruido(t, { dur: 0.025, freq: 2200 + Math.random() * 3000, q: 2, volume: 0.12 + Math.random() * 0.1, ataque: 0.001 });
    }
  },

  /* Buzina de ônibus: duas notas em onda quadrada passando por um filtro. */
  buzina(vezes = 2) {
    if (!this.rodando()) return;
    const c = this._ctx, t0 = c.currentTime;
    for (let v = 0; v < vezes; v++) {
      const t = t0 + v * 0.42, dur = v === vezes - 1 ? 0.6 : 0.28;
      const filtro = c.createBiquadFilter(), g = c.createGain();
      filtro.type = "lowpass";
      filtro.frequency.value = 1500;
      g.gain.setValueAtTime(0.001, t);
      g.gain.exponentialRampToValueAtTime(0.32, t + 0.02);
      g.gain.setValueAtTime(0.32, t + dur - 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      filtro.connect(g).connect(this._mestre);
      for (const f of [311, 392]) {
        const o = c.createOscillator();
        o.type = "square";
        o.frequency.value = f;
        o.connect(filtro);
        o.start(t);
        o.stop(t + dur);
      }
    }
  },

  /* Refletores desligando: o tranco do disjuntor e o zumbido caindo. */
  apagao() {
    if (!this.rodando()) return;
    const c = this._ctx, t = c.currentTime;
    this.ruido(t, { dur: 0.3, freq: 180, q: 0.8, volume: 1, tipo: "lowpass", ataque: 0.002 });
    const o = c.createOscillator(), g = c.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(30, t + 1.2);
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    o.connect(g).connect(this._mestre);
    o.start(t);
    o.stop(t + 1.25);
  },

  /* Rojão: o assobio subindo e o estouro com estalos. */
  fogos() {
    if (!this.rodando()) return;
    const c = this._ctx, t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(900, t);
    o.frequency.exponentialRampToValueAtTime(2400, t + 0.35);
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    o.connect(g).connect(this._mestre);
    o.start(t);
    o.stop(t + 0.4);
    this.ruido(t + 0.36, { dur: 0.6, freq: 240, q: 0.7, volume: 0.9, tipo: "lowpass", ataque: 0.002 });
    for (let i = 0; i < 9; i++) this.ruido(t + 0.45 + Math.random() * 0.7, { dur: 0.03, freq: 4200, volume: 0.22, tipo: "highpass", ataque: 0.001 });
  },

  /* Corneta de estádio: dente de serra com vibrato curto. */
  corneta() {
    if (!this.rodando()) return;
    const c = this._ctx, t = c.currentTime, dur = 1.1;
    const filtro = c.createBiquadFilter(), g = c.createGain();
    filtro.type = "lowpass";
    filtro.frequency.value = 2200;
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.05);
    g.gain.setValueAtTime(0.22, t + dur - 0.15);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    filtro.connect(g).connect(this._mestre);
    const lfo = c.createOscillator(), prof = c.createGain();
    lfo.frequency.value = 6;
    prof.gain.value = 6;
    lfo.connect(prof);
    for (const f of [466, 470]) {
      const o = c.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      prof.connect(o.frequency);
      o.connect(filtro);
      o.start(t);
      o.stop(t + dur);
    }
    lfo.start(t);
    lfo.stop(t + dur);
  },

  /* Plim de quem senta: grave e curto, pra não cansar com o chat cheio. */
  plim() {
    if (!this.rodando()) return;
    const c = this._ctx, o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
    o.type = "triangle";
    o.frequency.setValueAtTime(620 + Math.random() * 120, t);
    o.frequency.exponentialRampToValueAtTime(1240, t + 0.06);
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g).connect(this._mestre);
    o.start(t);
    o.stop(t + 0.13);
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
