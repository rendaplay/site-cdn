// Regras da roleta de saída, sem DOM: o roleta.js usa no navegador e o node testa.
(function (raiz) {
  'use strict';

  const ESPERA_ARMAR_MS = 8000;
  const VALIDADE_MS = 10 * 60 * 1000;
  // Metade da página: antes disso a pessoa ainda não viu preço nem prova.
  const ROLAGEM_MINIMA = 0.5;
  // Subida rápida = o dedo indo pra barra de endereço. Leitura normal sobe devagar.
  const SUBIDA_PX = 280;
  const SUBIDA_JANELA_MS = 450;
  // Ausência curta é notificação ou troca rápida de app; volta depois disso é "pensei melhor".
  const AUSENCIA_MINIMA_MS = 4000;

  // 50/50 fixado no aparelho: quem caiu no controle nunca vê a roleta.
  function sortearGrupo(aleatorio) {
    return aleatorio < 0.5 ? 'roleta' : 'controle';
  }

  function podeMostrar({ grupo, jaViu, temCheckout, desdeEntradaMs, rolagem, gatilho }) {
    if (grupo !== 'roleta' || jaViu || !temCheckout) return false;
    if (desdeEntradaMs < ESPERA_ARMAR_MS) return false;
    // Quem abriu o checkout e voltou já passou do meio da página, mesmo tendo vindo do topo.
    if (gatilho === 'voltou_checkout') return true;
    return rolagem >= ROLAGEM_MINIMA;
  }

  // amostras: [{t, y}] da mais antiga pra mais nova.
  function subiuRapido(amostras) {
    const ultima = amostras[amostras.length - 1];
    if (!ultima) return false;
    let maisBaixo = ultima.y;
    for (let i = amostras.length - 1; i >= 0; i--) {
      if (ultima.t - amostras[i].t > SUBIDA_JANELA_MS) break;
      maisBaixo = Math.max(maisBaixo, amostras[i].y);
    }
    return maisBaixo - ultima.y >= SUBIDA_PX;
  }

  function voltouDepoisDeSair(saiuEm, agora) {
    return saiuEm != null && agora - saiuEm >= AUSENCIA_MINIMA_MS;
  }

  function restanteMs(expiraEm, agora) {
    return Math.max(0, expiraEm - agora);
  }

  function relogio(ms) {
    const total = Math.ceil(ms / 1000);
    const min = Math.floor(total / 60);
    const seg = total % 60;
    return `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;
  }

  const api = {
    VALIDADE_MS, sortearGrupo, podeMostrar, subiuRapido, voltouDepoisDeSair, restanteMs, relogio,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else raiz.RoletaRegras = api;
})(this);
