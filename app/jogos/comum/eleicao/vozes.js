/* Falas dos jogos das eleições: bordões reais dos candidatos e o narrador.
   Uma fala por vez; a mais importante interrompe a menor e fala pequena
   espera um respiro, senão a live vira uma gritaria. Efeito e música não
   entram na fila. */
"use strict";

(function (raiz) {
  const PRIORIDADE = { vitoria: 5, virada: 4, massa: 3, ultrapassagem: 3, retaFinal: 3, largada: 3, encostou: 2, entrada: 1, provocacao: 1 };
  const QUEM = ["lula", "flavio"];

  class FilaDeVozes {
    constructor(catalogo, { intervaloMin = 4000, sortear = Math.random } = {}) {
      this.catalogo = catalogo;
      this.intervaloMin = intervaloMin;
      this.sortear = sortear;
      this.tocando = null;
      this.livreEm = -Infinity;
      this.ultimoId = null;
    }

    pedir(momento, quem, agora) {
      const alvo = typeof quem === "number" ? QUEM[quem] : quem;
      const prioridade = PRIORIDADE[momento] || 1;
      if (this.tocando && this.tocando.prioridade >= prioridade) return null;
      if (!this.tocando && prioridade < 3 && agora < this.livreEm) return null;
      const opcoes = this.catalogo.filter(v => v.momento === momento && v.quem === alvo);
      if (!opcoes.length) return null;
      const semRepetir = opcoes.length > 1 ? opcoes.filter(v => v.id !== this.ultimoId) : opcoes;
      const item = semRepetir[Math.floor(this.sortear() * semRepetir.length)];
      this.tocando = { ...item, prioridade };
      this.ultimoId = item.id;
      return item;
    }

    terminou(agora) {
      this.tocando = null;
      this.livreEm = agora + this.intervaloMin;
    }
  }

  /* Sem o fim da fala a fila trava: o prazo é a duração do clipe mais 1 s,
     ou 6 s enquanto o navegador ainda não sabe a duração. */
  const prazoDaFala = duracao => (Number.isFinite(duracao) && duracao > 0 ? duracao + 1 : 6) * 1000;

  /* WAV vazio: dá um arquivo válido pra preparar elementos que ainda não
     têm som escolhido. */
  const SILENCIO = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
  const COPIAS_POR_EFEITO = 3;

  /* Vai pro registro da live no app do celular (como o anotar de
     comum/live.js), uma vez por linha: no iPhone é o único jeito de saber se
     o Safari deixou o som tocar. */
  const anotadas = new Set();
  function anotarSom(linha) {
    if (anotadas.has(linha) || !raiz.parent || raiz.parent === raiz) return;
    anotadas.add(linha);
    raiz.parent.postMessage({ rendaplay: "registro", linha: `som: ${linha}`, urgente: true }, "*");
  }

  /* No navegador: HTMLAudio por arquivo (funciona por file://, onde fetch de
     mp3 pro Web Audio falha). Celular só libera cada elemento de áudio depois
     de tocar dentro de um toque; por isso os elementos são criados na
     abertura, preparados no primeiro toque e reaproveitados. */
  const Vozes = {
    ligado: true,
    volume: 0.8,
    base: "../comum/eleicao/audio/",
    fila: null,
    _atual: null,
    _musica: null,
    _elMusica: null,
    _elVoz: null,
    _prazo: null,
    _vez: 0,
    _piscinas: new Map(),

    iniciar({ base, volume, catalogo = raiz.VOZES_CATALOGO || [], efeitos = [] } = {}) {
      if (base) this.base = base;
      if (volume !== undefined) this.volume = volume;
      this.fila = new FilaDeVozes(catalogo);
      this._elMusica = this._criar(SILENCIO);
      this._elMusica.loop = true;
      this._elVoz = this._criar(SILENCIO);
      for (const nome of efeitos) this._piscina(nome);
      this.destravarNoToque();
    },

    _criar(src) {
      const a = new Audio();
      a.setAttribute("playsinline", "");
      a.playsInline = true;
      a.preload = "auto";
      a.src = src;
      return a;
    },

    _piscina(nome) {
      let p = this._piscinas.get(nome);
      if (!p) {
        p = Array.from({ length: COPIAS_POR_EFEITO }, () => this._criar(`${this.base}efeitos/${nome}.mp3`));
        this._piscinas.set(nome, p);
      }
      return p;
    },

    /* Toca mudo e para: o navegador passa a aceitar play() desse elemento
       fora de um toque. */
    _preparar(el) {
      if (!el.paused || el._preparando) return;
      el._preparando = true;
      el.muted = true;
      const fim = () => { el._preparando = false; el.muted = false; };
      el.play().then(() => {
        if (el._preparando) { el.pause(); el.currentTime = 0; }
        fim();
      }).catch(fim);
    },

    _usar(el) {
      el._preparando = false;
      el.muted = false;
    },

    _retomarMusica() {
      const m = this._musica;
      if (m && this.ligado && m.paused) m.play().then(() => anotarSom("música tocando"), e => anotarSom(`música bloqueada no toque (${e.name})`));
    },

    /* O iPhone suspende o áudio ao ir pro TikTok e voltar. */
    destravarNoToque() {
      const eventos = ["pointerdown", "touchend", "keydown"];
      let preparado = false;
      const destravar = () => {
        if (!preparado) {
          anotarSom("primeiro toque no jogo");
          preparado = true;
          const todos = [this._elMusica, this._elVoz, ...[...this._piscinas.values()].flat()];
          for (const el of todos) if (el && el !== this._musica) this._preparar(el);
        }
        this._retomarMusica();
      };
      for (const ev of eventos) addEventListener(ev, destravar, true);
      document.addEventListener("visibilitychange", () => { if (!document.hidden) this._retomarMusica(); });
    },

    falar(momento, quem) {
      if (!this.ligado || !this.volume || !this.fila) return false;
      const item = this.fila.pedir(momento, quem, performance.now());
      if (!item) return false;
      const a = this._elVoz;
      a.pause();
      clearTimeout(this._prazo);
      this._usar(a);
      a.volume = this.volume;
      /* O elemento é o mesmo pra toda fala: o play() recusado da fala
         interrompida não pode encerrar a que entrou no lugar. */
      const vez = ++this._vez;
      const fim = () => {
        if (this._atual !== a || this._vez !== vez) return;
        clearTimeout(this._prazo);
        a.onended = a.onerror = a.onloadedmetadata = null;
        this._atual = null;
        this.fila.terminou(performance.now());
      };
      const armarPrazo = () => { clearTimeout(this._prazo); this._prazo = setTimeout(fim, prazoDaFala(a.duration)); };
      a.onended = fim;
      a.onerror = fim;
      a.onloadedmetadata = armarPrazo;
      this._atual = a;
      a.src = this.base + item.arquivo;
      armarPrazo();
      a.play().catch(e => { anotarSom(`fala bloqueada (${e.name})`); fim(); });
      return true;
    },

    efeito(nome, volume = 1) {
      if (!this.ligado || !this.volume) return;
      const piscina = this._piscina(nome);
      const a = piscina.find(el => el.paused && !el._preparando) || piscina[0];
      this._usar(a);
      a.currentTime = 0;
      a.volume = Math.min(1, this.volume * volume);
      a.play().catch(() => {});
    },

    /* O iPhone ignora audio.volume: com volume zero só não tocando. Por isso
       música e torcida já vêm do arquivo bem abaixo das falas. */
    musica(nome, volume = 1) {
      const a = this._elMusica;
      a.pause();
      if (!nome || !this.ligado || this.volume * volume <= 0) { this._musica = null; return; }
      this._usar(a);
      a.src = `${this.base}efeitos/${nome}.mp3`;
      a.loop = true;
      a.playbackRate = 1;
      a.volume = Math.min(1, this.volume * volume);
      this._musica = a;
      a.play().then(() => anotarSom("música tocando"), e => anotarSom(`música bloqueada (${e.name})`));
    },

    alternar() {
      this.ligado = !this.ligado;
      if (!this.ligado) { if (this._atual) this._atual.pause(); if (this._musica) this._musica.pause(); }
      else if (this._musica) this._musica.play().catch(() => {});
    },
  };

  raiz.FilaDeVozes = FilaDeVozes;
  raiz.Vozes = Vozes;
  raiz.PRIORIDADE_VOZ = PRIORIDADE;
  if (typeof module !== "undefined") module.exports = { FilaDeVozes, PRIORIDADE, Vozes, prazoDaFala };
})(typeof window !== "undefined" ? window : globalThis);
