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
      `<label class="${cls}">${rotulo}<input type="${tipo}" name="${nome}" value="${escapar(valor)}"></label>`;
    const faixa = (f, i) => `
      <fieldset class="faixa"><legend>Faixa ${i + 1}</legend>
        ${campo("A partir de (moedas)", `faixas.${i}.moedas`, f.moedas, "number")}
        ${campo("Nome na tela", `faixas.${i}.nome`, f.nome)}
        ${campo("O que faz (cardápio)", `faixas.${i}.efeito`, f.efeito, "text", "cheia")}
        ${campo("Corta quantas", `faixas.${i}.cortes`, f.cortes, "number")}
        ${campo("Escudo (s)", `faixas.${i}.escudo`, f.escudo, "number")}
      </fieldset>`;
    const s = config.surpresa;

    this.form.innerHTML = `
      <h2>Ajustes do Pipa Combate</h2>
      <p class="sub">Preset <b>${escapar(chave)}</b>. Fica salvo neste PC; o arquivo preset.js não muda.</p>
      <fieldset><legend>Céu</legend>
        ${campo("Título", "titulo", config.titulo)}
        ${campo("Pipas no ar (máximo)", "maxPipas", config.maxPipas, "number")}
        ${campo("Relo natural a cada (s, mínimo)", "relo.intervaloMin", config.relo.intervaloMin, "number")}
        ${campo("Relo natural a cada (s, máximo)", "relo.intervaloMax", config.relo.intervaloMax, "number")}
        ${campo("Rei do céu a partir de (s no ar)", "rei.minimo", config.rei.minimo, "number")}
        ${campo("Escudo de quem compartilha (s)", "escudoCompartilhar", config.escudoCompartilhar, "number")}
        ${campo("Anúncio grande a partir de (moedas)", "destaqueMoedas", config.destaqueMoedas, "number")}
        ${campo("Curtidas pra 1 gás", "gas.curtidas", config.gas.curtidas, "number")}
        ${campo("Gás acumulado (máximo)", "gas.max", config.gas.max, "number")}
        <label class="linha"><input type="checkbox" name="modoSeguro" ${config.modoSeguro ? "checked" : ""}>Modo seguro TikTok (sem pedir presente)</label>
        <label class="linha"><input type="checkbox" name="som" ${config.som ? "checked" : ""}>Som do jogo</label>
        ${campo("Volume do som (0 a 100)", "volume", config.volume, "number")}
      </fieldset>
      ${config.faixas.map(faixa).join("")}
      <fieldset><legend>Evento-surpresa (chat esfriou)</legend>
        <label class="linha"><input type="checkbox" name="surpresa.ligada" ${s.ligada ? "checked" : ""}>Ligado</label>
        ${campo("Depois de quantos s sem presente", "surpresa.semPresente", s.semPresente, "number")}
        ${campo("Intervalo mínimo entre eventos (s)", "surpresa.intervalo", s.intervalo, "number")}
        ${campo("Ventania leva até (pipas)", "surpresa.ventaniaLeva", s.ventaniaLeva, "number")}
      </fieldset>
      <div class="botoes">
        <button type="submit" class="principal">Salvar e recarregar</button>
        <button type="button" data-acao="copiar">Copiar JSON</button>
        <button type="button" data-acao="restaurar">Voltar ao preset</button>
        <button type="button" data-acao="fechar">Fechar</button>
      </div>
      <div class="atalhos">
        <div><kbd>P</kbd> ajustes</div><div><kbd>Espaço</kbd> pausa</div>
        <div><kbd>F</kbd> vertical / horizontal</div><div><kbd>S</kbd> som</div>
        <div><kbd>1</kbd>…<kbd>5</kbd> presente de teste por faixa</div><div><kbd>T</kbd> 10 comentários de teste</div>
        <div><kbd>V</kbd> <kbd>C</kbd> <kbd>A</kbd> ventania, cerol dourado, pipa avoada</div><div><kbd>D</kbd> plateia de demonstração</div>
        <div><kbd>R</kbd> zera o céu e o ranking</div>
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
  },

  ler() {
    const c = clonar(this.config);
    for (const input of this.form.querySelectorAll("input")) {
      const caminho = input.name.split(".");
      const valor = input.type === "checkbox" ? input.checked
        : input.type === "number" ? Number(input.value) || 0
        : input.value.trim();
      let alvo = c;
      caminho.slice(0, -1).forEach(k => { alvo = alvo[k]; });
      alvo[caminho[caminho.length - 1]] = valor;
    }
    return c;
  },

  aberto() { return !this.form.hidden; },

  alternar(on = this.form.hidden) {
    this.form.hidden = !on;
    if (on) this.form.querySelector("input").focus();
  },
};
