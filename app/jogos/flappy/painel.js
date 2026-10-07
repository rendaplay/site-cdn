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
    const lista = (rotulo, nome, valor, cls = "") =>
      `<label class="${cls}">${rotulo}<input type="text" name="${nome}" data-lista="1" value="${escapar(valor.join(", "))}"></label>`;
    const efeito = (i, time, x) => `
      ${campo(`${time === "caos" ? "Sabotagem" : "Ajuda"}: nome`, `faixas.${i}.${time}.nome`, x.nome)}
      ${x.dur != null ? campo("Duração (s)", `faixas.${i}.${time}.dur`, x.dur, "number") : `<span></span>`}
      ${campo("No cardápio", `faixas.${i}.${time}.texto`, x.texto || "", "text", "cheia")}`;
    const faixa = (f, i) => `
      <fieldset class="faixa"><legend>Faixa ${i + 1}</legend>
        ${campo("A partir de (moedas)", `faixas.${i}.moedas`, f.moedas, "number", "cheia")}
        ${efeito(i, "caos", f.caos)}
        ${efeito(i, "ajuda", f.ajuda)}
      </fieldset>`;
    const s = config.surpresa;
    const v = config.voo;

    this.form.innerHTML = `
      <h2>Ajustes do ${escapar(config.titulo)}</h2>
      <p class="sub">Preset <b>${escapar(chave)}</b>. Fica salvo neste PC; o arquivo preset.js não muda.</p>
      <fieldset><legend>Quem pilota</legend>
        <label class="cheia">Controle<select name="controle">
          <option value="misto" ${config.controle === "misto" ? "selected" : ""}>Misto: piloto automático, o streamer assume ao apertar</option>
          <option value="auto" ${config.controle === "auto" ? "selected" : ""}>Só piloto automático (live sem aparecer)</option>
          <option value="streamer" ${config.controle === "streamer" ? "selected" : ""}>Só o streamer (espaço, ↑ ou clique)</option>
        </select></label>
        ${campo("Piloto volta depois de (s parado)", "devolver", config.devolver, "number")}
        ${campo("Erro do piloto (px, maior = cai mais)", "piloto.erro", config.piloto.erro, "number")}
        ${campo("Título", "titulo", config.titulo, "text", "cheia")}
        <label class="linha"><input type="checkbox" name="modoSeguro" ${config.modoSeguro ? "checked" : ""}>Modo seguro TikTok (sem pedir presente)</label>
        <label class="linha"><input type="checkbox" name="som" ${config.som ? "checked" : ""}>Som do jogo</label>
        ${campo("Volume do som (0 a 100)", "volume", config.volume, "number")}
      </fieldset>
      <fieldset><legend>Voo</legend>
        ${campo("Velocidade inicial (px/s)", "voo.velocidade", v.velocidade, "number")}
        ${campo("Velocidade máxima", "voo.velocidadeMax", v.velocidadeMax, "number")}
        ${campo("Vão inicial (px)", "voo.vao", v.vao, "number")}
        ${campo("Vão mínimo", "voo.vaoMin", v.vaoMin, "number")}
        ${campo("Vidas extras (máximo)", "vidasMax", config.vidasMax, "number")}
        ${campo("Tela de quem derrubou (s)", "telaMorte", config.telaMorte, "number")}
      </fieldset>
      <fieldset><legend>Times</legend>
        ${lista("Comentários que ajudam", "times.ajuda.comandos", config.times.ajuda.comandos)}
        ${lista("Comentários que sabotam", "times.caos.comandos", config.times.caos.comandos)}
        ${lista("Presentes que ajudam sempre", "times.ajuda.presentes", config.times.ajuda.presentes)}
        ${lista("Presentes que sabotam sempre", "times.caos.presentes", config.times.caos.presentes)}
        ${campo("Barra do chat enche com (comentários)", "chat.carga", config.chat.carga, "number")}
        ${campo("Presente de quem não escolheu", "times.padrao", config.times.padrao, "text")}
      </fieldset>
      <fieldset><legend>Evento-surpresa (chat esfriou)</legend>
        <label class="linha"><input type="checkbox" name="surpresa.ligada" ${s.ligada ? "checked" : ""}>Ligado</label>
        ${campo("Depois de quantos s sem presente", "surpresa.semPresente", s.semPresente, "number")}
        ${campo("Intervalo mínimo entre eventos (s)", "surpresa.intervalo", s.intervalo, "number")}
      </fieldset>
      ${config.faixas.map(faixa).join("")}
      <div class="botoes">
        <button type="submit" class="principal">Salvar e recarregar</button>
        <button type="button" data-acao="copiar">Copiar JSON</button>
        <button type="button" data-acao="restaurar">Voltar ao preset</button>
        <button type="button" data-acao="fechar">Fechar</button>
      </div>
      <div class="atalhos">
        <div><kbd>Espaço</kbd> <kbd>↑</kbd> ou clique: pular</div><div><kbd>P</kbd> ajustes · <kbd>Enter</kbd> pausa</div>
        <div><kbd>M</kbd> troca quem pilota</div><div><kbd>F</kbd> vertical / horizontal · <kbd>S</kbd> som</div>
        <div><kbd>1</kbd>…<kbd>5</kbd> sabotagem de teste por faixa</div><div><kbd>Shift</kbd>+<kbd>1</kbd>…<kbd>5</kbd> ajuda de teste</div>
        <div><kbd>C</kbd> <kbd>X</kbd> <kbd>Q</kbd> hora do chinelo, dobro, pão de queijo</div><div><kbd>T</kbd> 10 comentários de teste</div>
        <div><kbd>D</kbd> plateia de demonstração</div><div><kbd>R</kbd> zera a live (recorde, ranking, moedas)</div>
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
        : input.dataset.lista ? input.value.split(",").map(x => x.trim()).filter(Boolean)
        : input.value.trim();
      let alvo = c;
      caminho.slice(0, -1).forEach(k => { alvo = alvo[k]; });
      alvo[caminho[caminho.length - 1]] = valor;
    }
    if (c.times.padrao !== "ajuda") c.times.padrao = "caos";
    return c;
  },

  aberto() { return !this.form.hidden; },

  alternar(on = this.form.hidden) {
    this.form.hidden = !on;
    if (on) this.form.querySelector("select, input").focus();
  },
};
