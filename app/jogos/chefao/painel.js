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
      `<label class="${cls}">${rotulo}<input type="${tipo}" name="${nome}" value="${escapar(valor)}"${tipo === "number" ? ' step="any"' : ""}></label>`;
    const chefe = (c, i) => `
      <fieldset><legend>Chefão ${i + 1}</legend>
        ${campo("Nome", `chefes.${i}.nome`, c.nome, "text", "cheia")}
        ${campo("Fala de entrada", `chefes.${i}.entrada`, c.entrada, "text", "cheia")}
        ${campo("Nome do contra-ataque", `chefes.${i}.contra`, c.contra)}
        ${campo("Fala da derrota", `chefes.${i}.derrota`, c.derrota)}
      </fieldset>`;
    const faixa = (f, i) => `
      <fieldset><legend>Golpe ${i + 1}</legend>
        ${campo("A partir de (moedas)", `faixas.${i}.moedas`, f.moedas, "number")}
        ${campo("Nome na tela", `faixas.${i}.nome`, f.nome)}
      </fieldset>`;
    const s = config.surpresa;
    const ct = config.contra;

    this.form.innerHTML = `
      <h2>Ajustes do Chefão</h2>
      <p class="sub">Preset <b>${escapar(chave)}</b>. Fica salvo neste PC; o arquivo preset.js não muda.</p>
      <fieldset><legend>Luta</legend>
        ${campo("Título", "titulo", config.titulo)}
        <label class="linha"><input type="checkbox" name="modoSeguro" ${config.modoSeguro ? "checked" : ""}>Modo seguro TikTok (sem pedir presente)</label>
        ${campo("Dano por moeda", "danoPorMoeda", config.danoPorMoeda, "number")}
        ${campo("Vida do 1º chefão", "vida.0", config.vida[0], "number")}
        ${campo("Vida do 2º chefão", "vida.1", config.vida[1], "number")}
        ${campo("Vida do 3º chefão", "vida.2", config.vida[2], "number")}
        ${campo("Vida do 4º chefão", "vida.3", config.vida[3], "number")}
        ${campo("Depois, vida × (por rodada)", "crescimento", config.crescimento, "number")}
        ${campo("Tela de vitória (s)", "vitoria", config.vitoria, "number")}
        ${campo("Comentário: dano", "comentario.dano", config.comentario.dano, "number")}
        ${campo("Comentário: espera por pessoa (s)", "comentario.espera", config.comentario.espera, "number")}
        ${campo("Curtidas por soco", "curtida.cada", config.curtida.cada, "number")}
        ${campo("Curtida: dano do soco", "curtida.dano", config.curtida.dano, "number")}
        ${campo("Curtida: espera por pessoa (s)", "curtida.espera", config.curtida.espera, "number")}
        ${campo("Curtida: socos no máximo por vez", "curtida.teto", config.curtida.teto, "number")}
        ${campo("Seguiu: dano (1 vez por pessoa)", "seguiu", config.seguiu, "number")}
        ${campo("Anúncio grande a partir de (moedas)", "destaqueMoedas", config.destaqueMoedas, "number")}
        <label class="linha"><input type="checkbox" name="som" ${config.som ? "checked" : ""}>Som do jogo</label>
        ${campo("Volume do som (0 a 100)", "volume", config.volume, "number")}
      </fieldset>
      <fieldset><legend>Contra-ataque e cura</legend>
        ${campo("Primeiro aos (s de luta)", "contra.primeiro", ct.primeiro, "number")}
        ${campo("Depois, a cada (s)", "contra.intervalo", ct.intervalo, "number")}
        ${campo("Na fúria, a cada (s)", "contra.intervaloFuria", ct.intervaloFuria, "number")}
        ${campo("Tempo pro chat reagir (s)", "contra.duracao", ct.duracao, "number")}
        ${campo("Meta (fração da vida, 0.08 = 8%)", "contra.meta", ct.meta, "number")}
        ${campo("Cura se acertar (fração)", "contra.cura", ct.cura, "number")}
        ${campo("Parado, cura depois de (s)", "curaParado.depois", config.curaParado.depois, "number")}
        ${campo("Parado, cura por segundo (fração)", "curaParado.porSegundo", config.curaParado.porSegundo, "number")}
      </fieldset>
      ${config.faixas.map(faixa).join("")}
      ${config.chefes.map(chefe).join("")}
      <fieldset><legend>Evento-surpresa (chat esfriou)</legend>
        <label class="linha"><input type="checkbox" name="surpresa.ligada" ${s.ligada ? "checked" : ""}>Ligado</label>
        ${campo("Depois de quantos s sem presente", "surpresa.semPresente", s.semPresente, "number")}
        ${campo("Intervalo mínimo entre eventos (s)", "surpresa.intervalo", s.intervalo, "number")}
        ${campo("Mutirão: pessoas", "surpresa.mutirao.pessoas", s.mutirao.pessoas, "number")}
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
        <div><kbd>E</kbd> evento-surpresa</div><div><kbd>A</kbd> contra-ataque agora</div>
        <div><kbd>K</kbd> derruba o chefão (teste)</div><div><kbd>D</kbd> plateia de demonstração</div>
        <div><kbd>R</kbd> zera a live</div>
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
