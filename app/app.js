/* App do celular: entra na conta, liga o conector da nuvem no @ do TikTok e
   abre o jogo web em tela cheia, lendo o canal do streamer. A live sai pela
   transmissão de tela do próprio app do TikTok. */
"use strict";

const $ = id => document.getElementById(id);

const url = new URLSearchParams(location.search);
const API = (url.get("api") || CONFIG.api).replace(/\/+$/, "");
const RELAY = (url.get("relay") || CONFIG.relay).replace(/\/+$/, "");

const guardado = {
  ler(chave) { try { return localStorage.getItem("rp." + chave); } catch (e) { return null; } },
  gravar(chave, valor) {
    try { valor == null ? localStorage.removeItem("rp." + chave) : localStorage.setItem("rp." + chave, valor); } catch (e) { /* aba anônima */ }
  },
};

/* Id fixo do aparelho: a API conta no limite de aparelhos por conta. */
function aparelho() {
  let id = guardado.ler("aparelho");
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
    guardado.gravar("aparelho", id);
  }
  return id;
}

/* A API manda frases em minúscula e sem ponto; na tela vira frase. */
function frase(texto) {
  texto = String(texto || "").trim();
  if (!texto) return "";
  texto = texto[0].toUpperCase() + texto.slice(1);
  return /[.!?]$/.test(texto) ? texto : texto + ".";
}

/* Sem prazo, um pedido que o iOS congelou ao ir pro TikTok fica pendurado pra sempre. */
const PRAZO_PEDIDO_MS = 15000;

async function pedir(base, rota, { metodo = "GET", corpo, cabecalhos = {} } = {}) {
  let resposta;
  try {
    resposta = await fetch(base + rota, {
      method: metodo,
      headers: { ...(corpo ? { "Content-Type": "application/json" } : {}), ...cabecalhos },
      body: corpo ? JSON.stringify(corpo) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout ? AbortSignal.timeout(PRAZO_PEDIDO_MS) : undefined,
    });
  } catch (e) {
    throw Object.assign(new Error("Sem conexão com a Renda Play. Confira a internet e tente de novo."), { status: 0 });
  }
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw Object.assign(new Error(frase(dados.erro) || "Algo deu errado. Tente de novo."), { status: resposta.status, dados });
  return dados;
}

/* ───────────── estado ───────────── */

const app = {
  conta: null,
  jogo: guardado.ler("jogo"),
  aoVivo: null,
  vigia: null,
  trava: null,
  resumo: null,
};

const IPHONE = /iPhone|iPad|iPod/.test(navigator.userAgent)
  || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const INSTALADO = matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches
  || navigator.standalone === true;

/* O Chrome do Android avisa quando dá pra instalar; o iPhone nunca avisa. */
let pedidoInstalar = null;
addEventListener("beforeinstallprompt", evento => {
  evento.preventDefault();
  pedidoInstalar = evento;
  mostrarInstalar();
});
addEventListener("appinstalled", () => { pedidoInstalar = null; $("instalar").hidden = true; });

function mostrarInstalar() {
  if (INSTALADO || guardado.ler("instalar-dispensado")) return;
  const texto = $("instalar-texto");
  if (IPHONE) {
    texto.textContent = "Adicione à tela de início pelo Safari. Pelo ícone, o jogo abre em tela cheia, sem a barra do navegador.";
  } else if (pedidoInstalar) {
    texto.textContent = "Instale pra abrir direto da tela inicial, já em tela cheia.";
  } else {
    texto.textContent = "Adicione à tela inicial pelo Chrome. Pelo ícone, o jogo abre em tela cheia, sem a barra do navegador.";
  }
  $("botao-instalar").hidden = !pedidoInstalar;
  $("botao-passo-a-passo").hidden = Boolean(pedidoInstalar);
  $("instalar").hidden = false;
}

function abrirPassoAPasso() {
  if (IPHONE) {
    $("folha-iphone").hidden = false;
    return;
  }
  $("botao-android-instalar").hidden = !pedidoInstalar;
  $("folha-android").hidden = false;
}

async function instalar() {
  if (!pedidoInstalar) return;
  pedidoInstalar.prompt();
  const { outcome } = await pedidoInstalar.userChoice;
  if (outcome === "accepted") $("instalar").hidden = true;
  pedidoInstalar = null;
}

function mostrar(tela) {
  for (const id of ["tela-carregando", "tela-entrar", "tela-inicio"]) $(id).hidden = id !== tela;
}

/* ───────────── entrar ───────────── */

let ativando = false;

function modoEntrar(ativar) {
  ativando = ativar;
  $("entrar-titulo").textContent = ativar ? "Ativar conta" : "Entrar";
  $("entrar-sub").textContent = ativar
    ? "Use o e-mail da compra, o código do pedido e crie uma senha."
    : "Use o e-mail da compra e a sua senha. Primeira vez? Pode usar o código do pedido que veio no e-mail da Kiwify.";
  $("rotulo-senha").textContent = ativar ? "Crie uma senha" : "Senha ou código do pedido";
  $("rotulo-pedido").hidden = !ativar;
  $("campo-senha").autocomplete = ativar ? "new-password" : "current-password";
  $("botao-entrar").textContent = ativar ? "Ativar e entrar" : "Entrar";
  $("trocar-modo").textContent = ativar ? "Já tenho conta: entrar" : "Primeira vez? Ativar com o código da compra";
  $("entrar-erro").hidden = true;
}

async function entrar(evento) {
  evento.preventDefault();
  const email = $("campo-email").value.trim().toLowerCase();
  const senha = $("campo-senha").value;
  const corpo = { email, senha, aparelho: aparelho() };
  if (ativando) corpo.pedido = $("campo-pedido").value.trim();
  const botao = $("botao-entrar");
  botao.disabled = true;
  $("entrar-erro").hidden = true;
  try {
    const { sessao } = await pedir(API, ativando ? "/ativar" : "/entrar", { metodo: "POST", corpo });
    guardado.gravar("sessao", sessao);
    $("campo-senha").value = "";
    await carregarConta();
  } catch (e) {
    $("entrar-erro").textContent = e.message;
    $("entrar-erro").hidden = false;
  } finally {
    botao.disabled = false;
  }
}

function sair() {
  guardado.gravar("sessao", null);
  guardado.gravar("ao-vivo", null);
  app.conta = null;
  $("campo-pedido").value = "";
  $("folha-conta").hidden = true;
  modoEntrar(false);
  mostrar("tela-entrar");
}

/* ───────────── início ───────────── */

async function carregarConta() {
  const sessao = guardado.ler("sessao");
  if (!sessao) { mostrar("tela-entrar"); return; }
  if (!app.conta) {
    $("carregando-erro").hidden = true;
    $("botao-tentar").hidden = true;
    $("carregando-texto").hidden = false;
    mostrar("tela-carregando");
  }
  try {
    app.conta = await pedir(API, "/eu", { cabecalhos: { Authorization: "Bearer " + sessao } });
  } catch (e) {
    if (e.status === 401) { sair(); return; }
    if (!app.conta) {
      $("carregando-texto").hidden = true;
      $("carregando-erro").textContent = e.message;
      $("carregando-erro").hidden = false;
      $("botao-tentar").hidden = false;
      return;
    }
  }
  montarInicio();
  mostrarInstalar();
  mostrar("tela-inicio");
  retomarLive();
}

/* O iOS fecha a aba enquanto o TikTok transmite e recarrega a página na volta:
   quem estava com o jogo aberto volta direto pra ele. Live parada há muito
   tempo não volta, pra não religar o conector de surpresa no dia seguinte. */
const RETOMAR_ATE_MS = 30 * 60 * 1000;

function lembrarLive() {
  guardado.gravar("ao-vivo", app.aoVivo ? JSON.stringify({ ...app.aoVivo, em: Date.now() }) : null);
}

function retomarLive() {
  let salva = null;
  try { salva = JSON.parse(guardado.ler("ao-vivo")); } catch (e) { /* lixo antigo */ }
  if (!salva || Date.now() - salva.em > RETOMAR_ATE_MS) { guardado.gravar("ao-vivo", null); return; }
  if (!app.conta.ativo || !app.conta.canal || !jogavel(salva.jogo)) return;
  app.aoVivo = { simular: salva.simular, jogo: salva.jogo };
  app.registro = registroGuardado(salva.id_live);
  anotar(`live de ${salva.jogo} retomada · @${arroba()} · ${navigator.userAgent}`);
  // O jogo recarregado conta do zero: o que já tinha somado vira a base.
  if (salva.id_live) {
    Object.assign(app.aoVivo, { id_live: salva.id_live, inicio: salva.inicio, base: salva.numeros, numeros: salva.numeros });
  }
  abrirJogo();
}

function liberado(id) {
  const jogos = app.conta && app.conta.jogos;
  return !Array.isArray(jogos) || jogos.includes(id);
}

function jogavel(id) {
  const jogo = JOGOS.find(j => j.id === id);
  return !!jogo && !jogo.indisponivel && liberado(id);
}

function montarInicio() {
  const conta = app.conta;
  $("conta-inicial").textContent = (conta.email || "R")[0].toUpperCase();
  $("conta-email").textContent = conta.email || "";
  $("conta-plano").textContent = conta.ativo ? `Plano ${conta.plano || "ativo"}` : "Assinatura inativa";
  $("campo-tiktok").value = guardado.ler("tiktok") || "";
  aoDigitarArroba();

  const aviso = $("aviso-conta");
  const algumLiberado = JOGOS.some(j => liberado(j.id));
  if (!conta.ativo || !conta.canal) {
    aviso.innerHTML = "<b>Sua assinatura não está ativa.</b> Renove pra voltar a fazer live com os jogos.";
  } else if (!algumLiberado) {
    const pro = conta.ofertas && conta.ofertas.pro;
    aviso.innerHTML = "<b>Seu plano tem os jogos do Roblox, que rodam no computador.</b> Os jogos de celular estão no plano Pro.";
    if (pro && pro.checkout) {
      const link = document.createElement("a");
      link.href = pro.checkout;
      link.target = "_blank";
      link.rel = "noopener";
      link.className = "rp-botao";
      link.textContent = `Quero o Pro (${pro.preco}${pro.periodo || ""})`;
      aviso.append(link);
    }
  }
  aviso.hidden = conta.ativo && conta.canal && algumLiberado;

  if (!jogavel(app.jogo)) app.jogo = (JOGOS.find(j => jogavel(j.id)) || {}).id || null;
  if (app.jogo) prepararJogo(app.jogo);
  const lista = $("lista-jogos");
  lista.replaceChildren(...JOGOS.map(jogo => {
    const item = document.createElement("li");
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "jogo";
    botao.disabled = !jogavel(jogo.id);
    botao.setAttribute("aria-pressed", String(jogo.id === app.jogo));
    const selo = jogo.indisponivel ? '<span class="selo-indisponivel">Temporariamente indisponível</span>' : "";
    botao.innerHTML = `<img src="${CONFIG.assets}capas/${jogo.id}.webp" alt="" loading="lazy">
      <span class="jogo-texto">${selo}<b></b><small></small></span>
      ${botao.disabled && !jogo.indisponivel ? '<span class="cadeado" aria-label="Não está no seu plano">🔒</span>' : ""}`;
    botao.querySelector("b").textContent = jogo.nome;
    botao.querySelector("small").textContent = jogo.descricao;
    botao.addEventListener("click", () => escolherJogo(jogo.id));
    item.append(botao);
    return item;
  }));
  atualizarAcoes();
}

function escolherJogo(id) {
  app.jogo = id;
  prepararJogo(id);
  guardado.gravar("jogo", id);
  for (const b of document.querySelectorAll(".jogo")) b.setAttribute("aria-pressed", "false");
  const indice = JOGOS.findIndex(j => j.id === id);
  document.querySelectorAll(".jogo")[indice].setAttribute("aria-pressed", "true");
  atualizarAcoes();
}

function arroba() {
  return lerArroba($("campo-tiktok").value).usuario || "";
}

/** Aceita "@fulano", "fulano" ou o link do perfil, que muito cliente cola no lugar do @. */
function lerArroba(texto) {
  const limpo = texto.replace(/\s+/g, "");
  if (!limpo) return {};
  const doLink = limpo.match(/tiktok\.com\/@([^/?#&]+)/i);
  if (doLink) return validarArroba(doLink[1]);
  if (/^(https?:|www\.)|tiktok\.com/i.test(limpo)) {
    return { erro: "Esse link não mostra o seu @. Abra seu perfil no TikTok e escreva só o nome que vem depois do @ (ex.: fulano)." };
  }
  return validarArroba(limpo.replace(/^@+/, ""));
}

function validarArroba(usuario) {
  if (/^[A-Za-z0-9._]{2,24}$/.test(usuario)) return { usuario };
  return { erro: "Escreva só o @ do TikTok, sem espaço nem acento: letras, números, ponto e _ (ex.: fulano)." };
}

/** Link colado vira o @ na hora; o que não der pra usar diz o porquê, em vez de só travar o botão. */
function aoDigitarArroba() {
  const campo = $("campo-tiktok");
  const { usuario, erro } = lerArroba(campo.value);
  if (usuario && usuario !== campo.value) campo.value = usuario;
  $("aviso-tiktok").textContent = erro || "";
  $("aviso-tiktok").hidden = !erro;
  atualizarAcoes();
}

function atualizarAcoes() {
  const pode = !!(app.conta && app.conta.ativo && app.conta.canal && app.jogo && jogavel(app.jogo));
  $("botao-testar").disabled = !pode;
  $("botao-iniciar").disabled = !pode || !arroba();
}

/* ───────────── live ───────────── */

function cabecalhosDoCanal() {
  return { "x-canal": app.conta.canal, "x-token": app.conta.token_canal };
}

async function ligarConector(simular) {
  const corpo = simular ? { simular: true } : { usuario: arroba() };
  return pedir(RELAY, "/api/conector/iniciar", { metodo: "POST", corpo, cabecalhos: cabecalhosDoCanal() });
}

/* O canal é um por conta: outro aparelho ou aba já em live ou teste divide os
   mesmos eventos (a live conta em dobro) e o teste troca a live real pela
   plateia simulada. */
async function canalLivre(simular) {
  let atual;
  try {
    atual = await pedir(RELAY, "/api/conector/estado", { cabecalhos: { "x-canal": app.conta.canal } });
  } catch (e) {
    return true;
  }
  if (!atual || atual.estado === "parado") return true;
  anotar(`canal já ocupado: ${atual.simulado ? "teste" : `live de @${atual.usuario}`} (${atual.estado})`);
  const aberto = atual.simulado ? "um teste" : "uma live";
  const efeito = simular && !atual.simulado
    ? "Se testar agora, a live de lá passa a receber a plateia de teste no lugar do TikTok."
    : "Feche lá antes, senão os dois jogos recebem os mesmos presentes.";
  return confirm(`Já tem ${aberto} aberto nesta conta em outro celular, computador ou aba. ${efeito}\n\nContinuar mesmo assim?`);
}

/* Subir a versão quando as regras mudarem: todo mundo lê de novo. */
const VERSAO_REGRAS = "1";

function aceitarRegras() {
  if (guardado.ler("regras") === VERSAO_REGRAS) return Promise.resolve(true);
  $("campo-regras").checked = false;
  $("botao-regras").disabled = true;
  $("folha-regras").hidden = false;
  return new Promise(resolver => { app.respostaRegras = resolver; });
}

function responderRegras(aceitou) {
  $("folha-regras").hidden = true;
  if (aceitou) guardado.gravar("regras", VERSAO_REGRAS);
  anotar(`regras ${aceitou ? "aceitas" : "recusadas"}`);
  if (app.respostaRegras) app.respostaRegras(aceitou);
  app.respostaRegras = null;
}

async function comecar(simular) {
  const botao = simular ? $("botao-testar") : $("botao-iniciar");
  botao.disabled = true;
  try {
    if (!simular && !(await aceitarRegras())) return;
    if (!(await canalLivre(simular))) return;
    if (!simular) guardado.gravar("tiktok", arroba());
    await ligarConector(simular);
    app.aoVivo = { simular, jogo: app.jogo };
    app.registro = [];
    anotar(`${simular ? "teste" : "live"} de ${app.jogo} · @${arroba()} · canal ${app.conta.canal} · ${navigator.userAgent}`);
    if (simular) abrirJogo();
    else $("folha-como").hidden = false;
  } catch (e) {
    anotar(`não ligou o conector: ${e.message}`);
    alert(e.message);
  } finally {
    atualizarAcoes();
  }
}

const ROTULOS = {
  conectado: "conectado",
  conectando: "conectando ao TikTok",
  live_offline: "esperando você entrar ao vivo",
  usuario_nao_encontrado: "procurando sua live, toque aqui",
  restrito: "live com restrição de idade",
  erro: "TikTok recusou, tentando de novo",
  parado: "desligado",
};

/* O TikTok responde "não encontrado" também pra conta que ainda não abriu a
   live; o conector segue tentando, e o menu deixa conferir o @ sem sair. */
function mostrarSelo(estado) {
  const selo = $("selo-jogo");
  const simulado = app.aoVivo && app.aoVivo.simular;
  if (selo.dataset.estado !== estado) anotar(`selo: ${estado}`);
  selo.dataset.estado = estado;
  const rotulo = simulado && estado === "conectado" ? "teste: plateia simulada" : ROTULOS[estado] || estado;
  $("selo-texto").textContent = simulado ? rotulo : `@${arroba()} · ${rotulo}`;
  const procurando = !simulado && estado === "usuario_nao_encontrado";
  $("aviso-arroba").hidden = !procurando;
  $("form-arroba").hidden = !procurando;
  if (procurando && document.activeElement !== $("campo-arroba-jogo")) $("campo-arroba-jogo").value = arroba();
}

async function trocarArroba(evento) {
  evento.preventDefault();
  const { usuario: novo, erro } = lerArroba($("campo-arroba-jogo").value);
  if (!novo) return alert(erro || "Digite o @ do seu TikTok.");
  $("campo-tiktok").value = novo;
  guardado.gravar("tiktok", novo);
  try {
    await ligarConector(false);
    $("menu-jogo").hidden = true;
    mostrarSelo("conectando");
  } catch (e) {
    alert(e.message);
  }
}

async function vigiarConector() {
  try {
    const { estado } = await pedir(RELAY, "/api/conector/estado", { cabecalhos: { "x-canal": app.conta.canal } });
    // Desligado sem a gente pedir (relay reiniciou, ficou sem leitor): liga de novo.
    if (estado === "parado" && app.aoVivo) await ligarConector(app.aoVivo.simular);
    mostrarSelo(estado);
    lembrarLive();
  } catch (e) {
    anotar(`estado do conector falhou: ${e.message}`);
    mostrarSelo("sem internet");
  }
}

/* ───────────── arquivos do jogo ───────────── */

/* O service worker guarda o jogo no aparelho (sw.js). Começa a baixar quando o
   jogo é escolhido, então na hora de abrir costuma já estar pronto. A promessa
   resolve quando o que trava a primeira pintura (código, estilo, fontes) chegou;
   as imagens seguem por trás. */
const preparos = {};

/* Pra celular de pouca memória que o Android mata com a live do TikTok aberta
   (o jogo faz a parte dele com ?leve=1, em jogos_web/comum/live.js). */
function modoLeve() {
  return guardado.ler("leve") === "1";
}

function prepararJogo(jogo) {
  if (preparos[jogo]) return preparos[jogo].essenciais;
  const sw = navigator.serviceWorker && navigator.serviceWorker.controller;
  // No modo leve nada de baixar o jogo inteiro em paralelo: cada arquivo vem quando o jogo pede.
  if (!CONFIG.assets || !sw || modoLeve()) return Promise.resolve();
  const preparo = { prontos: 0, total: 0 };
  preparo.essenciais = new Promise(resolve => { preparo.liberar = resolve; });
  preparos[jogo] = preparo;
  sw.postMessage({ tipo: "preparar", base: CONFIG.assets, jogo });
  return preparo.essenciais;
}

function aoPreparo(dados) {
  const preparo = preparos[dados.jogo];
  if (!preparo) return;
  if (dados.total) Object.assign(preparo, { prontos: dados.prontos, total: dados.total });
  if (dados.essenciais) {
    preparo.pronto = true;
    preparo.liberar();
  }
  if (dados.falhas) anotar(`preparo de ${dados.jogo}: ${dados.falhas} falhas ${dados.erro || ""}`);
  // Falhou de vez: a próxima escolha tenta de novo.
  if (dados.fim && dados.falhas) delete preparos[dados.jogo];
  if (app.aoVivo && app.aoVivo.jogo === dados.jogo) mostrarCarregando();
}

function mostrarCarregando() {
  const aviso = $("carregando-jogo");
  if (aviso.hidden) return;
  const preparo = app.aoVivo && preparos[app.aoVivo.jogo];
  const parte = preparo && preparo.total ? Math.round((100 * preparo.prontos) / preparo.total) : 0;
  $("carregando-barra").style.width = `${Math.max(4, parte)}%`;
  const demorando = Date.now() - app.abertoEm > 12000;
  $("carregando-texto").textContent = demorando
    ? "Internet lenta, ainda baixando o jogo. Ele fica salvo no celular pra próxima vez."
    : "Preparando o jogo…";
}

async function abrirJogo() {
  $("folha-como").hidden = true;
  const quadro = $("quadro-jogo");
  const parametros = new URLSearchParams({ canal: app.conta.canal, relay: RELAY });
  if (modoLeve()) parametros.set("leve", "1");
  const jogo = app.aoVivo.jogo;
  app.abertoEm = Date.now();
  $("carregando-jogo").hidden = false;
  mostrarCarregando();
  clearInterval(app.relogioCarregando);
  app.relogioCarregando = setInterval(mostrarCarregando, 1000);
  quadro.onload = () => {
    if (quadro.src === "about:blank") return;
    $("carregando-jogo").hidden = true;
    clearInterval(app.relogioCarregando);
    anotar(`jogo carregou em ${Math.round((Date.now() - app.abertoEm) / 1000)} s`);
    mandarRegistro();
    // O iOS às vezes mostra o quadro ainda com 0×0 na primeira pintura e não avisa o jogo quando cresce.
    reajustarAosPoucos();
  };
  quadro.src = "about:blank";
  // Se o service worker sumir no meio (o iOS mata o que fica parado), abre
  // assim mesmo: cada arquivo ainda passa por ele, com a VPS de reserva.
  const prazo = new Promise(resolve => setTimeout(() => {
    if (preparos[jogo] && !preparos[jogo].pronto) delete preparos[jogo];
    resolve();
  }, 25000));
  Promise.race([prepararJogo(jogo), prazo]).then(() => {
    if (app.aoVivo && app.aoVivo.jogo === jogo) quadro.src = `jogos/${jogo}/index.html?${parametros}`;
  });
  $("tela-jogo").hidden = false;
  document.documentElement.classList.add("jogando");
  $("menu-jogo").hidden = true;
  mostrarSelo("conectando");
  if (!app.aoVivo.id_live) abrirTelemetria();
  clearInterval(app.resumo);
  app.resumo = setInterval(() => {
    mandarTelemetria([resumoDaLive(false)]);
    mandarRegistro();
  }, RESUMO_A_CADA_MS);
  anotar(`jogo aberto · tela ${innerWidth}×${innerHeight} · memória ${navigator.deviceMemory || "?"} GB${modoLeve() ? " · modo leve" : ""}`);
  mandarRegistro();
  lembrarLive();
  clearInterval(app.vigia);
  app.vigia = setInterval(vigiarConector, 4000);
  vigiarConector();
  try { await document.documentElement.requestFullscreen({ navigationUI: "hide" }); } catch (e) { /* iOS não tem */ }
  try { await screen.orientation.lock("portrait"); } catch (e) { /* nem todo aparelho deixa */ }
  manterTelaAcesa();
}

/* Sem isto a tela apaga no meio da live e a transmissão fica preta. */
async function manterTelaAcesa() {
  if (!("wakeLock" in navigator) || !app.aoVivo) return;
  try {
    app.trava = await navigator.wakeLock.request("screen");
    // O navegador solta a trava quando o app sai da frente (indo pro TikTok).
    app.trava.addEventListener("release", () => { app.trava = null; });
  } catch (e) {
    app.trava = null;
  }
}

async function pararLive() {
  clearInterval(app.vigia);
  app.vigia = null;
  fecharTelemetria();
  app.aoVivo = null;
  lembrarLive();
  $("quadro-jogo").src = "about:blank";
  clearInterval(app.relogioCarregando);
  $("tela-jogo").hidden = true;
  document.documentElement.classList.remove("jogando");
  if (app.trava) { app.trava.release().catch(() => {}); app.trava = null; }
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  try {
    await pedir(RELAY, "/api/conector/parar", { metodo: "POST", corpo: {}, cabecalhos: cabecalhosDoCanal() });
  } catch (e) { /* desliga sozinho sem leitor */ }
}

/* ───────────── telemetria ───────────── */
/* Mesma rota do launcher do PC (api/TELEMETRIA.md): é o que põe a live do
   celular no painel do dono. Falhou, ignora: a live não pode depender disso. */

const RESUMO_A_CADA_MS = 60000;
const DURACAO_MAX_S = 48 * 3600;

function mandarTelemetria(eventos) {
  const sessao = guardado.ler("sessao");
  if (!sessao || !app.aoVivo || !app.aoVivo.id_live) return;
  pedir(API, "/telemetria", {
    metodo: "POST", corpo: { versao: "celular", eventos }, cabecalhos: { Authorization: "Bearer " + sessao },
  }).catch(() => {});
}

function eventoDaLive(tipo, dados) {
  return { tipo, em: Date.now() / 1000, dados: { id_live: app.aoVivo.id_live, ...dados } };
}

function resumoDaLive(final) {
  return eventoDaLive("resumo_live", { ...app.aoVivo.numeros, final });
}

function abrirTelemetria() {
  if (!crypto.randomUUID) return;
  const zerado = { moedas: 0, comentarios: 0, curtidas: 0 };
  Object.assign(app.aoVivo, { id_live: crypto.randomUUID(), inicio: Date.now(), base: zerado, numeros: zerado });
  const dados = { jogo: app.aoVivo.jogo, modo: app.aoVivo.simular ? "teste" : "real", origem: "celular" };
  if (/^[A-Za-z0-9._]{2,24}$/.test(arroba())) dados.tiktok = arroba();
  mandarTelemetria([eventoDaLive("live_iniciada", dados)]);
}

function fecharTelemetria() {
  clearInterval(app.resumo);
  app.resumo = null;
  if (!app.aoVivo || !app.aoVivo.id_live) return;
  const duracao = Math.round((Date.now() - app.aoVivo.inicio) / 1000);
  mandarTelemetria([resumoDaLive(true),
    eventoDaLive("live_encerrada", { duracao_s: Math.min(Math.max(duracao, 0), DURACAO_MAX_S) })]);
  anotar("live encerrada");
  mandarRegistro();
}

/* Registro da live pro suporte (aba Celular na ficha do cliente no admin):
   o que o app e o jogo viram, pra resolver reclamação sem pedir print. */

const REGISTRO_LINHAS = 600;

function anotar(linha) {
  if (!app.registro) return;
  const hora = new Date().toTimeString().slice(0, 8);
  app.registro.push(`${hora} ${String(linha).slice(0, 300)}`);
  if (app.registro.length > REGISTRO_LINHAS) app.registro.splice(0, app.registro.length - REGISTRO_LINHAS);
}

/* A API troca o registro da live pelo envio novo: a live retomada depois do
   crash continua o registro de antes, senão o que levou ao crash some. */
function guardarRegistro() {
  guardado.gravar("registro-live", app.aoVivo.id_live || null);
  guardado.gravar("registro", app.registro.join("\n"));
}

function registroGuardado(idLive) {
  if (!idLive || idLive !== guardado.ler("registro-live")) return [];
  return (guardado.ler("registro") || "").split("\n").filter(Boolean);
}

function mandarRegistro() {
  const sessao = guardado.ler("sessao");
  if (!sessao || !app.aoVivo || !app.aoVivo.id_live || !app.registro || !app.registro.length) return;
  pedir(API, "/registros", {
    metodo: "POST",
    corpo: { id_live: app.aoVivo.id_live, registros: { celular: app.registro.join("\n") } },
    cabecalhos: { Authorization: "Bearer " + sessao },
  }).catch(() => {});
}

/* Toque que o app recebe com o jogo aberto é toque que não chegou no jogo
   (o iframe não repassa pro app): sem ele o jogo não destrava o som. */
const toquesForaDoJogo = new Set();
addEventListener("pointerdown", e => {
  if ($("tela-jogo").hidden) return;
  const alvo = e.target.id || e.target.className || e.target.tagName;
  if (toquesForaDoJogo.has(alvo)) return;
  toquesForaDoJogo.add(alvo);
  anotar(`toque no app, fora do jogo: ${alvo} em ${Math.round(e.clientX)},${Math.round(e.clientY)}`);
  mandarRegistro();
}, true);

addEventListener("error", e => anotar(`ERRO no app: ${e.message} (${e.filename}:${e.lineno})`));
addEventListener("unhandledrejection", e => anotar(`ERRO no app: ${e.reason && e.reason.message || e.reason}`));

/* O jogo manda o total desde que abriu (jogos_web/comum/live.js). */
addEventListener("message", evento => {
  const dados = evento.data;
  const vivo = app.aoVivo;
  if (!vivo || !vivo.base || evento.source !== $("quadro-jogo").contentWindow) return;
  if (dados && dados.rendaplay === "registro") {
    anotar(`jogo: ${dados.linha}`);
    if (dados.urgente) mandarRegistro();
    return;
  }
  if (!dados || dados.rendaplay !== "resumo") return;
  // Na live real a plateia simulada não conta: veio de um teste em outro aparelho.
  const simulados = vivo.simular && dados.simulados || {};
  vivo.numeros = {};
  for (const campo of Object.keys(vivo.base)) {
    const soma = (Number(dados[campo]) || 0) + (Number(simulados[campo]) || 0);
    vivo.numeros[campo] = vivo.base[campo] + Math.max(0, Math.round(soma));
  }
});

/* ───────────── ligações ───────────── */

for (const link of document.querySelectorAll("[data-suporte]")) link.href = CONFIG.suporte;
for (const link of document.querySelectorAll("[data-guia]")) link.href = CONFIG.guia;

$("form-entrar").addEventListener("submit", entrar);
$("trocar-modo").addEventListener("click", () => modoEntrar(!ativando));
$("campo-tiktok").addEventListener("input", aoDigitarArroba);
$("campo-leve").checked = modoLeve();
$("campo-leve").addEventListener("change", () => guardado.gravar("leve", $("campo-leve").checked ? "1" : null));
$("botao-testar").addEventListener("click", () => comecar(true));
$("botao-iniciar").addEventListener("click", () => comecar(false));
$("botao-abrir-jogo").addEventListener("click", abrirJogo);
$("botao-cancelar").addEventListener("click", () => { $("folha-como").hidden = true; pararLive(); });
$("campo-regras").addEventListener("change", () => { $("botao-regras").disabled = !$("campo-regras").checked; });
$("botao-regras").addEventListener("click", () => responderRegras(true));
$("botao-regras-cancelar").addEventListener("click", () => responderRegras(false));
$("botao-conta").addEventListener("click", () => { $("folha-conta").hidden = false; });
$("botao-instalar").addEventListener("click", instalar);
$("botao-instalar-fechar").addEventListener("click", () => {
  guardado.gravar("instalar-dispensado", "1");
  $("instalar").hidden = true;
});
$("botao-passo-a-passo").addEventListener("click", abrirPassoAPasso);
$("botao-ajuda").addEventListener("click", () => { $("folha-ajuda").hidden = false; });
$("botao-fechar-ajuda").addEventListener("click", () => { $("folha-ajuda").hidden = true; });
$("botao-ajuda-instalar").hidden = INSTALADO;
$("botao-ajuda-instalar").addEventListener("click", () => {
  $("folha-ajuda").hidden = true;
  abrirPassoAPasso();
});
$("botao-android-instalar").addEventListener("click", () => {
  $("folha-android").hidden = true;
  instalar();
});
$("botao-fechar-android").addEventListener("click", () => { $("folha-android").hidden = true; });
$("botao-fechar-iphone").addEventListener("click", () => { $("folha-iphone").hidden = true; });
$("dica-iphone").hidden = !IPHONE;
$("botao-fechar-conta").addEventListener("click", () => { $("folha-conta").hidden = true; });
$("botao-sair").addEventListener("click", sair);
$("selo-jogo").addEventListener("click", () => { $("menu-jogo").hidden = !$("menu-jogo").hidden; });
$("botao-voltar-jogo").addEventListener("click", () => { $("menu-jogo").hidden = true; });
$("botao-sair-jogo").addEventListener("click", pararLive);
$("form-arroba").addEventListener("submit", trocarArroba);
$("botao-tela-cheia").addEventListener("click", voltarTelaCheia);
$("botao-tentar").addEventListener("click", carregarConta);
/* O app da tela de início do iOS volta do segundo plano com o tamanho da tela
   errado por um instante (WebKit 170595): o jogo se ajusta a esse tamanho e
   fica preto ou fora da tela. Na volta, desrola tudo e faz o jogo se medir
   de novo algumas vezes, até o iOS assentar o tamanho certo. */
function reajustarJogo() {
  if ($("tela-jogo").hidden) return;
  const quadro = $("quadro-jogo");
  scrollTo(0, 0);
  quadro.style.display = "none";
  void quadro.offsetHeight;
  quadro.style.display = "";
  try {
    quadro.contentWindow.scrollTo(0, 0);
    quadro.contentWindow.dispatchEvent(new Event("resize"));
  } catch (e) { /* jogo ainda carregando */ }
}

/* O Android tira a tela cheia quando a pessoa vai pro TikTok, e só um toque
   devolve (o navegador não deixa pedir sem gesto). */
function pedirTelaCheia() {
  const fora = !$("tela-jogo").hidden && document.fullscreenEnabled && !document.fullscreenElement
    && !matchMedia("(display-mode: fullscreen)").matches;
  $("botao-tela-cheia").hidden = !fora;
}

async function voltarTelaCheia() {
  $("botao-tela-cheia").hidden = true;
  try { await document.documentElement.requestFullscreen({ navigationUI: "hide" }); } catch (e) { /* segue sem */ }
  try { await screen.orientation.lock("portrait"); } catch (e) { /* nem todo aparelho deixa */ }
}

function reajustarAosPoucos() {
  for (const espera of [0, 250, 800, 2000]) setTimeout(reajustarJogo, espera);
}

function aoVoltar() {
  if (app.aoVivo) anotar("app voltou pra frente");
  reajustarAosPoucos();
  if (app.aoVivo && !app.trava) manterTelaAcesa();
  setTimeout(pedirTelaCheia, 300);
}

/* No Android o sistema mata a página parada atrás do TikTok sem aviso: o que
   foi anotado até aqui precisa sair antes, senão o crash não deixa rastro. */
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") return aoVoltar();
  if (!app.aoVivo) return;
  anotar("app foi pro segundo plano");
  guardarRegistro();
  mandarRegistro();
});
addEventListener("pageshow", aoVoltar);
addEventListener("resize", () => setTimeout(reajustarJogo, 250));

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
  navigator.serviceWorker.addEventListener("message", evento => {
    if (evento.data && evento.data.tipo === "preparo") aoPreparo(evento.data);
  });
  // Primeira visita: o service worker só passa a cuidar da página depois de ativar.
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (app.jogo && app.conta) prepararJogo(app.jogo);
  });
}

carregarConta();
