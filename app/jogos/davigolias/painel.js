/* Painel de ajustes (tecla P). Salva por cima do preset neste PC e
   recarrega: é feito pra usar antes da live, não no meio dela. */
"use strict";

const Painel = {
  form: null,

  montar(chave, config) {
    this.chave = chave;
    this.config = config;
    this.form = document.querySelector(".painel");
    const campo = (rotulo, nome, valor, tipo = "text", cls = "") =>
      `<label class="${cls}">${rotulo}<input type="${tipo}" name="${nome}" value="${escapar(valor)}" ${tipo === "number" ? 'step="any"' : ""}></label>`;
    const marca = (rotulo, nome, ligado) =>
      `<label class="linha"><input type="checkbox" name="${nome}" ${ligado ? "checked" : ""}>${rotulo}</label>`;
    const faixa = (f, i) => `
      <fieldset class="faixa"><legend>Faixa ${i + 1}</legend>
        ${campo("A partir de (moedas)", `faixas.${i}.moedas`, f.moedas, "number")}
        ${campo("Efeito", `faixas.${i}.nome`, f.nome)}
        ${campo("O que faz (Como funciona do ⚙)", `faixas.${i}.efeito`, f.efeito, "text", "cheia")}
      </fieldset>`;

    this.form.innerHTML = `
      <h2>Ajustes do ${escapar(config.titulo)}</h2>
      <p class="sub">Preset <b>${escapar(chave)}</b>. Fica salvo neste PC; o arquivo preset.js não muda.</p>
      <fieldset><legend>Geral</legend>
        ${campo("Título", "titulo", config.titulo, "text", "cheia")}
        ${marca("Som do jogo", "som", config.som)}
        ${marca("Narrador", "narrador", config.narrador)}
        ${campo("Volume do som (0 a 100)", "volume", config.volume, "number")}
        ${campo("Volume do tambor (0 a 100)", "musica", config.musica, "number")}
      </fieldset>
      <fieldset><legend>Rodada</legend>
        ${campo("Duração (s)", "rodada.duracao", config.rodada.duracao, "number")}
        ${campo("Placar na tela (s)", "rodada.intervalo", config.rodada.intervalo, "number")}
      </fieldset>
      <fieldset><legend>Funda</legend>
        ${campo("Carga pra disparar", "funda.cheia", config.funda.cheia, "number")}
        ${campo("Carga por comentário", "funda.comentario", config.funda.comentario, "number")}
        ${campo("Comentário: 1 carga a cada (s)", "funda.intervalo", config.funda.intervalo, "number")}
        ${campo("Curtidas por carga", "funda.curtidasPorCarga", config.funda.curtidasPorCarga, "number")}
      </fieldset>
      <fieldset><legend>Gigante</legend>
        ${campo("Distância (m)", "golias.distancia", config.golias.distancia, "number")}
        ${campo("Anda sozinho (m/s)", "golias.velocidade", config.golias.velocidade, "number")}
        ${campo("Sem dono anda (m/s)", "golias.velocidadeSemDono", config.golias.velocidadeSemDono, "number")}
        ${campo("Tremor empurra (m)", "golias.empurrao", config.golias.empurrao, "number")}
      </fieldset>
      ${config.faixas.map(faixa).join("")}
      <div class="botoes">
        <button type="submit" class="principal">Salvar e recarregar</button>
        <button type="button" data-acao="copiar">Copiar JSON</button>
        <button type="button" data-acao="restaurar">Voltar ao preset</button>
        <button type="button" data-acao="fechar">Fechar</button>
      </div>
      <div class="atalhos">
        <div><kbd>P</kbd> ajustes · <kbd>Enter</kbd> pausa · <kbd>S</kbd> som</div>
        <div><kbd>1</kbd>…<kbd>5</kbd> presente de teste por faixa (lado do Davi)</div>
        <div><kbd>G</kbd> presente de teste do Golias</div>
        <div><kbd>T</kbd> 10 comentários</div><div><kbd>E</kbd> encerra a rodada</div>
        <div><kbd>D</kbd> plateia de demonstração</div><div><kbd>R</kbd> zera a live</div>
      </div>`;

    this.form.onsubmit = e => {
      e.preventDefault();
      Config.salvar(chave, this.ler());
      location.reload();
    };
    this.form.onclick = e => {
      const acao = e.target.dataset && e.target.dataset.acao;
      if (acao === "fechar") this.alternar(false);
      if (acao === "restaurar") { Config.restaurar(chave); location.reload(); }
      if (acao === "copiar" && navigator.clipboard) {
        navigator.clipboard.writeText(JSON.stringify(this.ler(), null, 2));
        e.target.textContent = "Copiado";
      }
    };
    this.form.addEventListener("pointerdown", e => e.stopPropagation());
  },

  ler() {
    const c = clonar(this.config);
    for (const input of this.form.querySelectorAll("input, select")) {
      const caminho = input.name.split(".");
      const valor = input.type === "checkbox" ? input.checked
        : input.type === "number" ? Number(input.value) || 0
        : input.value.trim();
      let alvo = c;
      caminho.slice(0, -1).forEach(k => { alvo = alvo[k]; });
      alvo[caminho[caminho.length - 1]] = valor;
    }
    c.rodada.duracao = Math.max(10, c.rodada.duracao);
    c.funda.cheia = Math.max(1, c.funda.cheia);
    c.golias.distancia = Math.max(5, c.golias.distancia);
    return c;
  },

  aberto() { return !this.form.hidden; },

  alternar(on = this.form.hidden) {
    this.form.hidden = !on;
    if (on) this.form.querySelector("input").focus();
  },
};
