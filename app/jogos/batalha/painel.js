/* Painel de ajustes (tecla P). Salva por cima do preset neste PC e
   recarrega: é feito pra usar antes da live, não no meio da rodada. */
"use strict";

const Painel = {
  form: null,

  montar(chave, config) {
    this.chave = chave;
    this.config = config;
    this.form = document.querySelector(".painel");
    const campo = (rotulo, nome, valor, tipo = "text", cls = "") =>
      `<label class="${cls}">${rotulo}<input type="${tipo}" name="${nome}" value="${escapar(valor)}"${nome in this.DECIMAIS ? ` step="${this.DECIMAIS[nome]}"` : ""}></label>`;
    const lado = (l, i) => `
      <fieldset><legend>Lado ${i + 1}</legend>
        ${campo("Nome", `l${i}.nome`, l.nome)}
        ${campo("Foto (arquivo ou link)", `l${i}.foto`, l.foto)}
        ${campo("Cor", `l${i}.cor`, l.cor, "color")}
        ${campo("Cor escura (borda da tela)", `l${i}.corEscura`, l.corEscura, "color")}
        ${campo("Cor de destaque", `l${i}.acento`, l.acento, "color")}
        ${campo("Presente: nome na tela", `l${i}.presente.nome`, l.presente.nome)}
        ${campo("Presente: ícone (emoji ou até 3 letras)", `l${i}.presente.icone`, l.presente.icone)}
        ${campo("Presente: nomes que a live manda (vírgula)", `l${i}.presente.aceitos`, l.presente.aceitos.join(", "))}
        ${campo("Presente escrito no chat que também vale (vírgula)", `l${i}.presente.palavras`, (l.presente.palavras || []).join(", "), "text", "cheia")}
        ${campo("Comentários que escolhem este lado (vírgula)", `l${i}.comandos`, l.comandos.join(", "), "text", "cheia")}
      </fieldset>`;

    this.form.innerHTML = `
      <h2>Ajustes da Batalha de Torres</h2>
      <p class="sub">Preset <b>${escapar(chave)}</b>. Fica salvo neste PC; o arquivo preset.js não muda.</p>
      ${config.lados.map(lado).join("")}
      <fieldset><legend>Rodada</legend>
        ${campo("Duração (segundos)", "rodada.segundos", config.rodada.segundos, "number")}
        ${campo("Prorrogação no empate (segundos)", "rodada.prorrogacao", config.rodada.prorrogacao, "number")}
        ${campo("Prorrogações antes de dar empate", "rodada.prorrogacoesMax", config.rodada.prorrogacoesMax ?? 3, "number")}
        ${campo("Tela de vitória (segundos)", "rodada.vitoria", config.rodada.vitoria, "number")}
        ${campo("Meta da rodada em metros (0 desliga)", "meta.moedas", config.meta.moedas, "number")}
        ${campo("Faixa de presente grande a partir de (moedas)", "destaqueMoedas", config.destaqueMoedas, "number")}
        ${campo("Virada só conta com pelo menos (metros na rodada)", "viradaMinima", config.viradaMinima, "number")}
        <label class="linha cheia"><input type="checkbox" name="rodada.automatica" ${config.rodada.automatica ? "checked" : ""}>Começar a próxima rodada sozinho</label>
        ${campo("Crédito das fotos", "creditos", config.creditos, "text", "cheia")}
      </fieldset>
      <fieldset><legend>Modo seguro TikTok</legend>
        <p class="dica">A tela não pede presente, não mostra moedas e o 2× fica desligado. Recomendado: o TikTok restringe live por "solicitação artificial de presentes".</p>
        <label class="linha cheia"><input type="checkbox" name="modoSeguro" ${config.modoSeguro !== false ? "checked" : ""}>Modo seguro ligado</label>
      </fieldset>
      <fieldset><legend>Presente vale 2×</legend>
        <p class="dica">Quando um lado fica muito pra trás, o próximo presente dele vale o dobro por alguns segundos. Não funciona com o modo seguro ligado.</p>
        ${campo("Duração (segundos, 0 desliga)", "dobro.segundos", config.dobro.segundos, "number")}
        ${campo("Lado com até (% da altura do outro)", "dobro.atras", config.dobro.atras, "number")}
        ${campo("Só com a rodada em (metros)", "dobro.minimo", config.dobro.minimo, "number")}
        ${campo("Espera até o próximo 2× (segundos)", "dobro.intervalo", config.dobro.intervalo, "number")}
      </fieldset>
      <fieldset><legend>Comentário empilha</legend>
        <p class="dica">Comentar 1 / 2 (ou o nome do presente) empilha um tijolinho. Uma rosa vale 1 metro.</p>
        ${campo("Metros por comentário (0 desliga)", "comentario.metros", config.comentario.metros, "number")}
        ${campo("Intervalo por pessoa (segundos)", "comentario.intervalo", config.comentario.intervalo, "number")}
        ${campo("Teto por pessoa na rodada (metros)", "comentario.teto", config.comentario.teto, "number")}
      </fieldset>
      <fieldset><legend>Curtidas e seguidores empilham</legend>
        <p class="dica">A cada N curtidas de uma pessoa, um tijolinho no lado dela (o que ela escolheu, ou o de menos torcida). Seguir vale uma vez por pessoa.</p>
        ${campo("Curtidas por tijolinho (0 desliga)", "curtida.cada", config.curtida.cada, "number")}
        ${campo("Metros por tijolinho de curtida", "curtida.metros", config.curtida.metros, "number")}
        ${campo("Intervalo por pessoa (segundos)", "curtida.intervalo", config.curtida.intervalo, "number")}
        ${campo("Teto de curtida por pessoa na rodada (metros)", "curtida.teto", config.curtida.teto, "number")}
        ${campo("Metros por seguir (0 desliga)", "seguiu.metros", config.seguiu.metros, "number")}
      </fieldset>
      <fieldset><legend>Presente grande ataca</legend>
        <p class="dica">10+ moedas: vento · 100+: raio · 500+: bola de demolição · 3000+: terremoto na torre do outro.</p>
        ${campo("Derruba no máximo (% da torre, 0 desliga)", "ataque.maxPct", config.ataque.maxPct, "number")}
      </fieldset>
      <fieldset><legend>Som</legend>
        <label class="linha"><input type="checkbox" name="som" ${config.som ? "checked" : ""}>Som do jogo ligado</label>
        ${campo("Volume (0 a 100)", "volume", config.volume, "number")}
      </fieldset>
      <div class="botoes">
        <button type="submit" class="principal">Salvar e recarregar</button>
        <button type="button" data-acao="copiar">Copiar JSON</button>
        <button type="button" data-acao="restaurar">Voltar ao preset</button>
        <button type="button" data-acao="fechar">Fechar</button>
      </div>
      <div class="atalhos">
        <div><kbd>P</kbd> ajustes</div><div><kbd>Espaço</kbd> pausa</div>
        <div><kbd>N</kbd> encerra a rodada agora</div><div><kbd>R</kbd> zera a rodada</div>
        <div><kbd>F</kbd> vertical / horizontal</div><div><kbd>S</kbd> som liga / desliga</div>
        <div><kbd>1</kbd> <kbd>2</kbd> presente de teste</div><div><kbd>D</kbd> plateia de demonstração</div>
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

  /* Rodada de 0 s encerraria sem parar e tela de vitória de 0 s some antes
     de aparecer: número abaixo do mínimo vira o mínimo. */
  MINIMOS: { "rodada.segundos": 15, "rodada.prorrogacao": 5, "rodada.vitoria": 3, "rodada.prorrogacoesMax": 0, "dobro.intervalo": 10 },
  MAXIMOS: { volume: 100, "dobro.atras": 95, "ataque.maxPct": 90 },
  /* Campo com fração (passo do input); o resto arredonda pra inteiro. */
  DECIMAIS: { "comentario.metros": 0.05, "comentario.teto": 0.1, "curtida.metros": 0.05, "curtida.teto": 0.1, "seguiu.metros": 0.1 },

  ler() {
    const c = clonar(this.config);
    const lista = s => s.split(",").map(x => x.trim()).filter(Boolean);
    for (const input of this.form.querySelectorAll("input")) {
      const caminho = input.name.replace(/^l(\d)\./, "lados.$1.").split(".");
      let valor = input.type === "checkbox" ? input.checked
        : input.type === "number" ? Math.min(this.MAXIMOS[input.name] ?? Infinity, Math.max(this.MINIMOS[input.name] ?? 0, this.numero(input)))
        : input.value.trim();
      if (/aceitos$|comandos$|palavras$/.test(input.name)) valor = lista(valor);
      let alvo = c;
      caminho.slice(0, -1).forEach(k => { alvo = alvo[k]; });
      alvo[caminho[caminho.length - 1]] = valor;
    }
    return c;
  },

  numero(input) {
    const n = Number(String(input.value).replace(",", ".")) || 0;
    return input.name in this.DECIMAIS ? Math.round(n * 100) / 100 : Math.round(n);
  },

  aberto() { return !this.form.hidden; },

  alternar(on = this.form.hidden) {
    this.form.hidden = !on;
    if (on) this.form.querySelector("input").focus();
  },
};
