/* Configurar pelo toque: botão ⚙ que aparece quando mexe o mouse ou toca na
   tela (some sozinho, pra não ir pra live) e abre a lista de presentes. Pra
   cada presente o streamer escolhe a faixa do jogo e testa ali mesmo. Fica
   salvo neste aparelho. Feito pro celular, onde não tem a tecla P.

   const cfg = montarConfigurar({
     jogo: "pipa",                         // chave no localStorage
     opcoes: () => ["Rabiola", ...],       // nome de cada faixa, em ordem
     testar: presente => ...,              // { nome, moedas, quantidade, total }
     avancado: () => Painel.alternar(true),
   });
   cfg.faixa(nome, moedasUnitarias)        // índice escolhido ou null

   Depende de comum/presentes.js. */
"use strict";

(function (raiz) {
  const SOME_EM = 4000;
  /* O painel aparece na transmissão do celular: nada de nome de presente nem
     de faixa na tela, só símbolo (o nome fica no title). */
  const PELO_VALOR = "🪙";
  const SIMBOLOS_FAIXA = ["✨", "🎉", "🔥", "💥", "👑", "🌟", "🚀", "💎"];

  const CSS = `
.rp-cfg-botao { position: fixed; right: 16px; bottom: 16px; z-index: 2147483000; width: 56px; height: 56px;
  border: 0; border-radius: 50%; background: rgba(12,10,20,.78); color: #fff; font-size: 28px; line-height: 56px;
  box-shadow: 0 6px 20px rgba(0,0,0,.4); cursor: pointer; opacity: 0; pointer-events: none;
  transition: opacity .25s; -webkit-tap-highlight-color: transparent; }
.rp-cfg-botao.visivel { opacity: 1; pointer-events: auto; }
.rp-cfg { position: fixed; z-index: 2147483001; right: 0; top: 0; bottom: 0; width: min(420px, 100vw);
  display: flex; flex-direction: column; background: rgba(14,12,24,.96); color: #F4F1FA;
  font: 15px/1.35 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; box-shadow: -10px 0 40px rgba(0,0,0,.5); }
.rp-cfg[hidden] { display: none; }
.rp-cfg header { display: flex; align-items: center; gap: 12px; padding: 16px 16px 10px; }
.rp-cfg h2 { flex: 1; margin: 0; font-size: 19px; font-weight: 800; }
.rp-cfg .rp-cfg-sub { margin: 0 16px 10px; color: #B9B2CC; font-size: 13px; }
.rp-cfg ul { flex: 1; overflow-y: auto; margin: 0; padding: 0 16px 8px; list-style: none; scrollbar-width: thin; }
.rp-cfg li { display: grid; grid-template-columns: 40px 1fr auto; align-items: center; gap: 10px;
  padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,.08); }
.rp-cfg .rp-cfg-icone { font-size: 30px; text-align: center; }
.rp-cfg .rp-cfg-faixas { display: flex; flex-wrap: wrap; gap: 6px; }
.rp-cfg .rp-cfg-faixas button { min-width: 40px; padding: 0 8px; font-size: 20px; border: 2px solid transparent; }
.rp-cfg .rp-cfg-faixas button[aria-pressed="true"] { border-color: #6C4BFF; background: rgba(108,75,255,.35); }
.rp-cfg button { min-height: 40px; padding: 0 14px; border: 0; border-radius: 10px; background: rgba(255,255,255,.12);
  color: inherit; font: inherit; font-weight: 700; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.rp-cfg button:active { background: rgba(255,255,255,.22); }
.rp-cfg .rp-cfg-testar { width: 48px; padding: 0; font-size: 20px; background: #6C4BFF; }
.rp-cfg .rp-cfg-fechar { width: 40px; padding: 0; font-size: 20px; }
.rp-cfg footer { display: flex; gap: 10px; align-items: center; padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); border-top: 1px solid rgba(255,255,255,.08); }
.rp-cfg .rp-cfg-status { flex: 1; color: #B9B2CC; font-size: 13px; }
@media (max-aspect-ratio: 1/1) {
  .rp-cfg { top: auto; width: 100vw; height: 58vh; border-radius: 18px 18px 0 0; box-shadow: 0 -10px 40px rgba(0,0,0,.5); }
}`;

  function montarConfigurar({ jogo, opcoes, testar, avancado }) {
    const CHAVE = `rendaplay.${jogo}.presentes`;
    let escolhas = ler();
    let timer = null;

    function ler() {
      try { return JSON.parse(localStorage.getItem(CHAVE) || "null") || {}; }
      catch (e) { return {}; }
    }
    function gravar() {
      try { localStorage.setItem(CHAVE, JSON.stringify(escolhas)); return true; }
      catch (e) { return false; }
    }

    const estilo = document.createElement("style");
    estilo.textContent = CSS;
    document.head.append(estilo);

    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "rp-cfg-botao";
    botao.textContent = "⚙";
    botao.setAttribute("aria-label", "Configurar presentes");

    const folha = document.createElement("section");
    folha.className = "rp-cfg";
    folha.hidden = true;
    folha.innerHTML = `
      <header><h2>⚙ 🎁</h2><button type="button" class="rp-cfg-fechar" aria-label="Fechar">✕</button></header>
      <p class="rp-cfg-sub">${PELO_VALOR} = pelo valor · ${SIMBOLOS_FAIXA.slice(0, 5).join(" ")} = efeito do mais fraco ao mais forte</p>
      <ul></ul>
      <footer><span class="rp-cfg-status"></span>${avancado ? '<button type="button" class="rp-cfg-avancado">Ajustes avançados</button>' : ""}</footer>`;
    const lista = folha.querySelector("ul");
    const status = folha.querySelector(".rp-cfg-status");
    document.body.append(botao, folha);

    const mostrarBotao = () => {
      if (!folha.hidden) return;
      botao.classList.add("visivel");
      clearTimeout(timer);
      timer = setTimeout(() => botao.classList.remove("visivel"), SOME_EM);
    };
    addEventListener("pointermove", mostrarBotao, { passive: true });
    addEventListener("pointerdown", mostrarBotao, { passive: true });

    /* Tecla dentro da folha não chega no jogo (1 a 5 soltam presente, P abre o painel). */
    folha.addEventListener("keydown", e => {
      e.stopPropagation();
      if (e.key === "Escape") fechar();
    });

    function desenhar() {
      const nomes = opcoes();
      lista.replaceChildren(...PRESENTES_TIKTOK.map(p => {
        const li = document.createElement("li");
        li.innerHTML = `<span class="rp-cfg-icone"></span><span class="rp-cfg-faixas"></span>
          <button type="button" class="rp-cfg-testar" aria-label="Testar">▶</button>`;
        const icone = li.querySelector(".rp-cfg-icone");
        icone.textContent = p.icone;
        icone.title = `${p.nome} · ${p.moedas.toLocaleString("pt-BR")} ${p.moedas === 1 ? "moeda" : "moedas"}`;
        const faixas = li.querySelector(".rp-cfg-faixas");
        const atual = escolhas[p.chave];
        const escolhida = Number.isInteger(atual) && atual < nomes.length ? atual : null;
        const chip = (simbolo, titulo, valor) => {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = simbolo;
          b.title = titulo;
          b.setAttribute("aria-label", titulo);
          b.setAttribute("aria-pressed", String(valor === escolhida));
          b.addEventListener("click", () => {
            if (valor === null) delete escolhas[p.chave];
            else escolhas[p.chave] = valor;
            for (const outro of faixas.children) outro.setAttribute("aria-pressed", String(outro === b));
            status.textContent = gravar() ? "✓" : "Não deu pra salvar neste aparelho.";
          });
          return b;
        };
        faixas.append(chip(PELO_VALOR, "Pelo valor (padrão)", null),
          ...nomes.map((nome, i) => chip(SIMBOLOS_FAIXA[i] || String(i + 1), nome, i)));
        li.querySelector(".rp-cfg-testar").addEventListener("click", () => {
          testar({ nome: p.api, moedas: p.moedas, quantidade: 1, total: p.moedas });
          status.textContent = `${p.icone} ✓`;
        });
        return li;
      }));
    }

    function abrir() {
      clearTimeout(timer);
      botao.classList.remove("visivel");
      status.textContent = "";
      desenhar();
      folha.hidden = false;
    }
    function fechar() {
      folha.hidden = true;
    }

    botao.addEventListener("click", abrir);
    folha.querySelector(".rp-cfg-fechar").addEventListener("click", fechar);
    if (avancado) folha.querySelector(".rp-cfg-avancado").addEventListener("click", () => { fechar(); avancado(); });

    return {
      faixa(nome, moedas) {
        const i = escolhaDoPresente(escolhas, nome, moedas);
        return Number.isInteger(i) && i >= 0 && i < opcoes().length ? i : null;
      },
      aberto: () => !folha.hidden,
      abrir,
      fechar,
    };
  }

  raiz.montarConfigurar = montarConfigurar;
})(window);
