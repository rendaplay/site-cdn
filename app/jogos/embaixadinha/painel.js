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
    const time = (t, i) => campo(t.nome, `times.${i}.apelidos`, t.apelidos.join(", "), "text", "cheia");

    this.form.innerHTML = `
      <h2>Ajustes do ${escapar(config.titulo)}</h2>
      <p class="sub">Preset <b>${escapar(chave)}</b>. Fica salvo neste PC; o arquivo preset.js não muda.</p>
      <fieldset><legend>Geral</legend>
        ${campo("Título", "titulo", config.titulo, "text", "cheia")}
        ${marca("Som do jogo", "som", config.som)}
        ${marca("Narrador", "narrador", config.narrador)}
        ${campo("Volume do som (0 a 100)", "volume", config.volume, "number")}
        ${campo("Volume da música (0 a 100)", "musica", config.musica, "number")}
      </fieldset>
      <fieldset><legend>Rodada</legend>
        ${campo("Duração da rodada (s)", "duracao", config.duracao, "number")}
        ${campo("Espera antes do 1º clássico (s)", "tempos.aquecimento", config.tempos.aquecimento, "number")}
        ${campo("Ranking na tela (s)", "tempos.intervalo", config.tempos.intervalo, "number")}
        ${campo("Bolas param sem ninguém comentar (s)", "ociosidade", config.ociosidade, "number")}
        ${campo("Sequência mínima pra recorde", "recordeMinimo", config.recordeMinimo, "number")}
        ${campo("Truque: espera por pessoa (s)", "intervaloTruque", config.intervaloTruque, "number")}
      </fieldset>
      <fieldset><legend>Fôlego</legend>
        ${campo("Queda por segundo", "folego.queda", config.folego.queda, "number")}
        ${campo("Queda a mais por toque", "folego.quedaPorToque", config.folego.quedaPorToque, "number")}
        ${campo("Enche por comentário", "folego.toque", config.folego.toque, "number")}
        ${campo("Enche por curtida", "folego.curtida", config.folego.curtida, "number")}
        ${campo("Bola volta depois de (s)", "recomeco", config.recomeco, "number")}
      </fieldset>
      <fieldset><legend>Efeitos</legend>
        ${campo("Reforço de quem segue (s)", "reforco", config.reforco, "number")}
        ${campo("Câmera lenta (s)", "lento", config.lento, "number")}
        ${campo("Vento no rival (s)", "vento", config.vento, "number")}
        ${campo("Bola blindada do show (s)", "blindada", config.blindada, "number")}
        ${campo("Efeitos na fila de cada time", "filaMaxima", config.filaMaxima, "number")}
      </fieldset>
      ${config.faixas.map(faixa).join("")}
      <fieldset class="cheia"><legend>Apelidos (separados por vírgula)</legend>
        ${config.times.map(time).join("")}
      </fieldset>
      <div class="botoes">
        <button type="submit" class="principal">Salvar e recarregar</button>
        <button type="button" data-acao="copiar">Copiar JSON</button>
        <button type="button" data-acao="restaurar">Voltar ao preset</button>
        <button type="button" data-acao="fechar">Fechar</button>
      </div>
      <div class="atalhos">
        <div><kbd>P</kbd> ajustes · <kbd>Enter</kbd> pausa · <kbd>S</kbd> som</div>
        <div><kbd>1</kbd>…<kbd>5</kbd> presente de teste por faixa</div>
        <div><kbd>T</kbd> 10 comentários de times · <kbd>C</kbd> curtidas · <kbd>B</kbd> truque</div>
        <div><kbd>F</kbd> novo seguidor (reforço) · <kbd>H</kbd> compartilhou · <kbd>E</kbd> encerra a rodada</div>
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
    c.times.forEach((t, i) => {
      const apelidos = String(t.apelidos).split(",").map(a => normalizar(a)).filter(Boolean);
      t.apelidos = apelidos.length ? apelidos : this.config.times[i].apelidos;
    });
    c.duracao = Math.max(30, c.duracao);
    c.filaMaxima = Math.max(1, Math.round(c.filaMaxima));
    c.ociosidade = Math.max(10, c.ociosidade);
    c.recomeco = Math.max(0.5, c.recomeco);
    c.folego.queda = Math.max(0.005, c.folego.queda);
    return c;
  },

  aberto() { return !this.form.hidden; },

  alternar(on = this.form.hidden) {
    this.form.hidden = !on;
    if (on) this.form.querySelector("input").focus();
  },
};
