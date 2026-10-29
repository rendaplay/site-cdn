/* Configuração = preset (preset.js) + o que o painel salvou neste PC +
   o que veio na URL, nessa ordem: a URL sempre ganha, pra testar uma corrida
   curta sem mexer no que o streamer deixou salvo. ?ws=, ?demo=, ?canal= e
   ?relay= quem lê é o comum/live.js. */
"use strict";

const Config = {
  PREFIXO: "rendaplay.presidencial.",

  carregar() {
    const url = new URLSearchParams(location.search);
    const presets = window.PRESIDENCIAL_PRESETS;
    const chave = presets[url.get("preset")] ? url.get("preset") : window.PRESIDENCIAL_PRESET_PADRAO;
    const config = mesclar(clonar(presets[chave]), this.lerSalvo(chave));
    /* O modo seguro é fixo: nada na tela pede presente nem mostra moedas. */
    config.modoSeguro = true;

    const num = (k) => (url.has(k) && Number.isFinite(Number(url.get(k))) ? Number(url.get(k)) : null);
    if (num("pista")) config.pista = num("pista");
    if (url.has("som")) config.som = url.get("som") !== "0";

    const formato = url.get("formato");
    return {
      chave,
      config,
      opcoes: {
        demo: url.get("demo") === "1",
        semente: num("semente"),
        porta: num("ws") || 8765,
        formato: formato === "horizontal" || formato === "vertical" ? formato : null,
      },
    };
  },

  /* Candidatos, lados e artes são do preset: o painel não edita, e o que
     foi salvo esconderia a troca (Trump entrou de parceiro no 22). */
  lerSalvo(chave) {
    let salvo;
    try { salvo = JSON.parse(localStorage.getItem(this.PREFIXO + chave) || "null") || {}; }
    catch (e) { return {}; }
    delete salvo.candidatos;
    delete salvo.lados;
    delete salvo.arte;
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

/* Objetos mesclam por chave; valor simples ou lista troca inteiro. */
function mesclar(base, extra) {
  if (base && extra && typeof base === "object" && typeof extra === "object" && !Array.isArray(base) && !Array.isArray(extra)) {
    const saida = { ...base };
    for (const k of Object.keys(extra)) saida[k] = k in base ? mesclar(base[k], extra[k]) : extra[k];
    return saida;
  }
  return extra === undefined ? base : extra;
}
