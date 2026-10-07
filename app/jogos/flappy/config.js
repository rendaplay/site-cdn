/* Configuração = preset (preset.js) + o que o painel salvou neste PC +
   o que veio na URL, nessa ordem: a URL sempre ganha, pra dar pra testar
   sem mexer no que o streamer deixou salvo. ?ws= e ?demo= quem lê é o
   comum/live.js. */
"use strict";

const Config = {
  PREFIXO: "rendaplay.flappy.",

  carregar() {
    const url = new URLSearchParams(location.search);
    const presets = window.FLAPPY_PRESETS;
    const chave = presets[url.get("preset")] ? url.get("preset") : window.FLAPPY_PRESET_PADRAO;
    const salvo = this.lerSalvo(chave);
    /* Ajuste salvo antes do volume existir: o som vinha desligado de
       fábrica, não foi escolha do streamer. */
    if (!("volume" in salvo)) delete salvo.som;
    const config = mesclar(clonar(presets[chave]), salvo);

    const num = k => (url.has(k) && Number.isFinite(Number(url.get(k))) ? Number(url.get(k)) : null);
    if (["auto", "misto", "streamer"].includes(url.get("controle"))) config.controle = url.get("controle");
    if (url.has("som")) config.som = url.get("som") !== "0";
    if (url.has("seguro")) config.modoSeguro = url.get("seguro") !== "0";
    if (url.has("surpresa")) config.surpresa.ligada = url.get("surpresa") !== "0";
    if (num("semente") !== null) config.demo.semente = num("semente");

    const formato = url.get("formato");
    return {
      chave,
      config,
      opcoes: {
        formato: formato === "horizontal" || formato === "vertical" ? formato : null,
        semente: num("semente"),
      },
    };
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

  /* Recorde de sempre deste PC, por preset (fica fora da configuração pra
     "Voltar ao preset" não apagar). */
  lerRecorde(chave) {
    try { return Number(localStorage.getItem(this.PREFIXO + "recorde." + chave)) || 0; }
    catch (e) { return 0; }
  },

  salvarRecorde(chave, pontos) {
    try { localStorage.setItem(this.PREFIXO + "recorde." + chave, String(pontos)); } catch (e) { /* sem storage */ }
  },
};

function clonar(x) { return JSON.parse(JSON.stringify(x)); }

/* Mescla objetos e listas de objetos por posição (as faixas); valor
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
