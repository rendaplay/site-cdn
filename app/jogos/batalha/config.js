/* Configuração = preset (preset.js) + o que o painel salvou neste PC +
   o que veio na URL. Nessa ordem: a URL sempre ganha, pra dar pra testar
   uma rodada curta sem mexer no que o streamer deixou salvo. */
"use strict";

const Config = {
  PREFIXO: "rendaplay.batalha.",

  /* O que vale quando o preset não diz (presets antigos não têm som nem 2×). */
  PADRAO: {
    som: true,
    volume: 50,
    dobro: { atras: 50, minimo: 150, segundos: 10, intervalo: 45 },
    comentario: { metros: 0.2, intervalo: 5, teto: 6 },
    modoSeguro: true,
    curtida: { cada: 25, metros: 0.5, intervalo: 5, teto: 6 },
    seguiu: { metros: 1 },
    ataque: { maxPct: 40 },
  },

  carregar() {
    const url = new URLSearchParams(location.search);
    const presets = window.BATALHA_PRESETS;
    const chave = presets[url.get("preset")] ? url.get("preset") : window.BATALHA_PRESET_PADRAO;
    const config = mesclar(mesclar(clonar(this.PADRAO), clonar(presets[chave])), this.lerSalvo(chave));

    const num = (k) => (url.has(k) && Number.isFinite(Number(url.get(k))) ? Number(url.get(k)) : null);
    if (num("rodada")) config.rodada.segundos = num("rodada");
    if (num("meta") !== null) config.meta.moedas = num("meta");
    if (url.has("som")) config.som = url.get("som") !== "0";

    const formato = url.get("formato");
    return {
      chave,
      config,
      opcoes: {
        demo: url.get("demo") === "1",
        porta: num("ws") || 8765,
        formato: formato === "horizontal" || formato === "vertical" ? formato : null,
      },
    };
  },

  lerSalvo(chave) {
    let salvo;
    try { salvo = JSON.parse(localStorage.getItem(this.PREFIXO + chave) || "null") || {}; }
    catch (e) { return {}; }
    /* Ajuste salvo antes do comentário valer (sem `comentario`) guardava o
       presente antigo do lado (GG no Flávio): o do preset ganha, o resto
       do que foi salvo (tempo, cores, som) continua. */
    if (!salvo.comentario && Array.isArray(salvo.lados)) {
      for (const l of salvo.lados) if (l) { delete l.presente; delete l.comandos; }
    }
    return salvo;
  },

  salvar(chave, config) {
    try { localStorage.setItem(this.PREFIXO + chave, JSON.stringify(config)); return true; }
    catch (e) { return false; }
  },

  restaurar(chave) {
    try { localStorage.removeItem(this.PREFIXO + chave); } catch (e) { /* sem storage: nada salvo */ }
  },
};

function clonar(x) { return JSON.parse(JSON.stringify(x)); }

/* Mescla objetos e listas por posição (os dois lados são `lados[0]` e
   `lados[1]`); valor simples ou lista de texto troca inteiro. */
function mesclar(base, extra) {
  if (Array.isArray(base) && Array.isArray(extra) && base.every(x => x && typeof x === "object")) {
    return base.map((b, i) => (i in extra ? mesclar(b, extra[i]) : b));
  }
  if (base && extra && typeof base === "object" && typeof extra === "object" && !Array.isArray(base)) {
    const saida = { ...base };
    for (const k of Object.keys(extra)) saida[k] = k in base ? mesclar(base[k], extra[k]) : extra[k];
    return saida;
  }
  return extra === undefined ? base : extra;
}
