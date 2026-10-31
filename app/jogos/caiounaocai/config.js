/* Configuração = preset (preset.js) + o que o painel salvou neste PC +
   o que veio na URL, nessa ordem: a URL sempre ganha, pra dar pra testar
   sem mexer no que o streamer deixou salvo. ?ws= e ?demo= quem lê é o
   comum/live.js. */
"use strict";

const Config = {
  PREFIXO: "rendaplay.caiounaocai.",

  carregar() {
    const url = new URLSearchParams(location.search);
    const presets = window.CAIOUNAOCAI_PRESETS;
    const chave = presets[url.get("preset")] ? url.get("preset") : window.CAIOUNAOCAI_PRESET_PADRAO;
    const config = mesclar(clonar(presets[chave]), this.lerSalvo(chave));

    const num = k => (url.has(k) && Number.isFinite(Number(url.get(k))) ? Number(url.get(k)) : null);
    if (url.has("som")) config.som = url.get("som") !== "0";
    if (url.has("narrador")) config.narrador = url.get("narrador") !== "0";
    /* O modo seguro é fixo: nada na tela pede presente nem mostra moedas. */
    config.modoSeguro = true;
    if (num("rodada") !== null) config.rodada.duracao = Math.max(10, num("rodada"));

    return { chave, config, opcoes: { semente: num("semente") } };
  },

  lerSalvo(chave) {
    try { return JSON.parse(localStorage.getItem(this.PREFIXO + chave) || "null") || {}; }
    catch (e) { return {}; }
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

/* Mescla objetos e listas de objetos por posição (faixas e times); valor
   simples ou lista de texto troca inteiro. */
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
