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
      </fieldset>`;

    this.form.innerHTML = `
      <h2>Ajustes do ${escapar(config.titulo)}</h2>
      <p class="sub">Preset <b>${escapar(chave)}</b>. Fica salvo neste PC; o arquivo preset.js não muda.</p>
      <fieldset><legend>Geral</legend>
        ${campo("Título", "titulo", config.titulo, "text", "cheia")}
        ${marca("Som do jogo", "som", config.som)}
        ${marca("Narradora", "narrador", config.narrador)}
        ${campo("Volume do som (0 a 100)", "volume", config.volume, "number")}
        ${campo("Volume da música (0 a 100)", "musica", config.musica, "number")}
        ${campo("Peixes dormem sem comentário (s)", "ociosidade", config.ociosidade, "number")}
      </fieldset>
      <fieldset><legend>Peixes</legend>
        ${campo("Peixes nadando (o resto dorme na toca)", "maxPeixes", config.maxPeixes, "number")}
        ${campo("Pula e dança: espera por pessoa (s)", "intervaloTruque", config.intervaloTruque, "number")}
        ${campo("Petisco faz crescer", "tamanho.petisco", config.tamanho.petisco, "number")}
        ${campo("Floco faz crescer", "tamanho.floco", config.tamanho.floco, "number")}
        ${campo("Fome depois de (s) sem comer", "fome.apos", config.fome.apos, "number")}
        ${campo("Fome: encolhe a cada (s)", "fome.intervalo", config.fome.intervalo, "number")}
      </fieldset>
      <fieldset><legend>Aquário da live</legend>
        ${campo("Meta do 1º nível", "aquario.meta", config.aquario.meta, "number")}
        ${campo("Meta cresce (×)", "aquario.cresce", config.aquario.cresce, "number")}
        ${campo("Festa do nível (s)", "aquario.festa", config.aquario.festa, "number")}
      </fieldset>
      <fieldset><legend>Efeitos</legend>
        ${campo("Tartaruga (s)", "tartaruga", config.tartaruga, "number")}
        ${campo("Tubarão (s)", "tubarao", config.tubarao, "number")}
        ${campo("Maior do aquário depois do tubarão (s)", "maiorTubarao", config.maiorTubarao, "number")}
        ${campo("Baleia (s)", "baleia", config.baleia, "number")}
        ${campo("Cardume de quem compartilhou (s)", "cardume", config.cardume, "number")}
        ${campo("Efeitos na fila de cada pessoa", "filaMaxima", config.filaMaxima, "number")}
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
        <div><kbd>1</kbd>…<kbd>5</kbd> presente de teste por faixa</div>
        <div><kbd>T</kbd> 10 comentários · <kbd>C</kbd> curtidas · <kbd>N</kbd> enche o aquário</div>
        <div><kbd>F</kbd> novo seguidor (reforço) · <kbd>H</kbd> compartilhou · <kbd>J</kbd> pula · <kbd>K</kbd> dança</div>
        <div><kbd>D</kbd> plateia de demonstração · <kbd>R</kbd> zera a live</div>
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
    c.ociosidade = Math.max(10, c.ociosidade);
    c.maxPeixes = Math.min(60, Math.max(5, Math.round(c.maxPeixes)));
    c.intervaloTruque = Math.max(0, c.intervaloTruque);
    c.tamanho.petisco = Math.max(0, c.tamanho.petisco);
    c.tamanho.floco = Math.max(0, c.tamanho.floco);
    c.fome.apos = Math.max(20, c.fome.apos);
    c.fome.intervalo = Math.max(5, c.fome.intervalo);
    c.aquario.meta = Math.max(10, c.aquario.meta);
    c.aquario.cresce = Math.max(1, c.aquario.cresce);
    for (const k of ["tartaruga", "tubarao", "baleia"]) c[k] = Math.min(30, Math.max(4, c[k]));
    c.filaMaxima = Math.max(1, Math.round(c.filaMaxima));
    return c;
  },

  aberto() { return !this.form.hidden; },

  alternar(on = this.form.hidden) {
    this.form.hidden = !on;
    if (on) this.form.querySelector("input").focus();
  },
};
