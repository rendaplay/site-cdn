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

async function pedir(base, rota, { metodo = "GET", corpo, cabecalhos = {} } = {}) {
  let resposta;
  try {
    resposta = await fetch(base + rota, {
      method: metodo,
      headers: { ...(corpo ? { "Content-Type": "application/json" } : {}), ...cabecalhos },
      body: corpo ? JSON.stringify(corpo) : undefined,
      cache: "no-store",
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
    texto.textContent = "No menu do Chrome (⋮), toque em Instalar app ou Adicionar à tela inicial.";
  }
  $("botao-instalar").hidden = !pedidoInstalar;
  $("botao-passo-a-passo").hidden = !IPHONE;
  $("instalar").hidden = false;
}

async function instalar() {
  if (!pedidoInstalar) return;
  pedidoInstalar.prompt();
  const { outcome } = await pedidoInstalar.userChoice;
  if (outcome === "accepted") $("instalar").hidden = true;
  pedidoInstalar = null;
}

function mostrar(tela) {
  for (const id of ["tela-entrar", "tela-inicio"]) $(id).hidden = id !== tela;
}

/* ───────────── entrar ───────────── */

let ativando = false;

function modoEntrar(ativar) {
  ativando = ativar;
  $("entrar-titulo").textContent = ativar ? "Ativar conta" : "Entrar";
  $("entrar-sub").textContent = ativar
    ? "Use o e-mail da compra, o código do pedido e crie uma senha."
    : "Use o e-mail e a senha da sua conta Renda Play.";
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
  try {
    app.conta = await pedir(API, "/eu", { cabecalhos: { Authorization: "Bearer " + sessao } });
  } catch (e) {
    if (e.status === 401) { sair(); return; }
    if (!app.conta) {
      mostrar("tela-entrar");
      $("entrar-erro").textContent = e.message;
      $("entrar-erro").hidden = false;
      return;
    }
  }
  montarInicio();
  mostrarInstalar();
  mostrar("tela-inicio");
}

function liberado(id) {
  const jogos = app.conta && app.conta.jogos;
  return !Array.isArray(jogos) || jogos.includes(id);
}

function montarInicio() {
  const conta = app.conta;
  $("conta-inicial").textContent = (conta.email || "R")[0].toUpperCase();
  $("conta-email").textContent = conta.email || "";
  $("conta-plano").textContent = conta.ativo ? `Plano ${conta.plano || "ativo"}` : "Assinatura inativa";
  $("campo-tiktok").value = guardado.ler("tiktok") || "";

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

  if (!liberado(app.jogo)) app.jogo = (JOGOS.find(j => liberado(j.id)) || {}).id || null;
  const lista = $("lista-jogos");
  lista.replaceChildren(...JOGOS.map(jogo => {
    const item = document.createElement("li");
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "jogo";
    botao.disabled = !liberado(jogo.id);
    botao.setAttribute("aria-pressed", String(jogo.id === app.jogo));
    botao.innerHTML = `<img src="${CONFIG.assets}capas/${jogo.id}.webp" alt="" loading="lazy">
      <span class="jogo-texto"><b></b><small></small></span>
      ${botao.disabled ? '<span class="cadeado" aria-label="Não está no seu plano">🔒</span>' : ""}`;
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
  guardado.gravar("jogo", id);
  for (const b of document.querySelectorAll(".jogo")) b.setAttribute("aria-pressed", "false");
  const indice = JOGOS.findIndex(j => j.id === id);
  document.querySelectorAll(".jogo")[indice].setAttribute("aria-pressed", "true");
  atualizarAcoes();
}

function arroba() {
  return $("campo-tiktok").value.trim().replace(/^@+/, "");
}

function atualizarAcoes() {
  const pode = !!(app.conta && app.conta.ativo && app.conta.canal && app.jogo && liberado(app.jogo));
  $("botao-testar").disabled = !pode;
  $("botao-iniciar").disabled = !pode || !/^[A-Za-z0-9._]{2,24}$/.test(arroba());
}

/* ───────────── live ───────────── */

function cabecalhosDoCanal() {
  return { "x-canal": app.conta.canal, "x-token": app.conta.token_canal };
}

async function ligarConector(simular) {
  const corpo = simular ? { simular: true } : { usuario: arroba() };
  return pedir(RELAY, "/api/conector/iniciar", { metodo: "POST", corpo, cabecalhos: cabecalhosDoCanal() });
}

async function comecar(simular) {
  const botao = simular ? $("botao-testar") : $("botao-iniciar");
  botao.disabled = true;
  try {
    if (!simular) guardado.gravar("tiktok", arroba());
    await ligarConector(simular);
    app.aoVivo = { simular, jogo: app.jogo };
    if (simular) abrirJogo();
    else $("folha-como").hidden = false;
  } catch (e) {
    alert(e.message);
  } finally {
    atualizarAcoes();
  }
}

const ROTULOS = {
  conectado: "conectado",
  conectando: "conectando ao TikTok",
  live_offline: "esperando você entrar ao vivo",
  usuario_nao_encontrado: "@ não encontrado no TikTok",
  restrito: "live com restrição de idade",
  erro: "TikTok recusou, tentando de novo",
  parado: "desligado",
};

function mostrarSelo(estado) {
  const selo = $("selo-jogo");
  selo.dataset.estado = estado;
  $("selo-texto").textContent = app.aoVivo && app.aoVivo.simular && estado === "conectado"
    ? "teste: plateia simulada" : ROTULOS[estado] || estado;
}

async function vigiarConector() {
  try {
    const { estado } = await pedir(RELAY, "/api/conector/estado", { cabecalhos: { "x-canal": app.conta.canal } });
    // Desligado sem a gente pedir (relay reiniciou, ficou sem leitor): liga de novo.
    if (estado === "parado" && app.aoVivo) await ligarConector(app.aoVivo.simular);
    mostrarSelo(estado);
  } catch (e) {
    mostrarSelo("sem internet");
  }
}

async function abrirJogo() {
  $("folha-como").hidden = true;
  const quadro = $("quadro-jogo");
  const parametros = new URLSearchParams({ canal: app.conta.canal, relay: RELAY });
  quadro.src = `jogos/${app.aoVivo.jogo}/index.html?${parametros}`;
  $("tela-jogo").hidden = false;
  $("menu-jogo").hidden = true;
  mostrarSelo("conectando");
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
  app.aoVivo = null;
  $("quadro-jogo").src = "about:blank";
  $("tela-jogo").hidden = true;
  if (app.trava) { app.trava.release().catch(() => {}); app.trava = null; }
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  try {
    await pedir(RELAY, "/api/conector/parar", { metodo: "POST", corpo: {}, cabecalhos: cabecalhosDoCanal() });
  } catch (e) { /* desliga sozinho sem leitor */ }
}

/* ───────────── ligações ───────────── */

for (const link of document.querySelectorAll("[data-suporte]")) link.href = CONFIG.suporte;

$("form-entrar").addEventListener("submit", entrar);
$("trocar-modo").addEventListener("click", () => modoEntrar(!ativando));
$("campo-tiktok").addEventListener("input", atualizarAcoes);
$("botao-testar").addEventListener("click", () => comecar(true));
$("botao-iniciar").addEventListener("click", () => comecar(false));
$("botao-abrir-jogo").addEventListener("click", abrirJogo);
$("botao-cancelar").addEventListener("click", () => { $("folha-como").hidden = true; pararLive(); });
$("botao-conta").addEventListener("click", () => { $("folha-conta").hidden = false; });
$("botao-instalar").addEventListener("click", instalar);
$("botao-instalar-fechar").addEventListener("click", () => {
  guardado.gravar("instalar-dispensado", "1");
  $("instalar").hidden = true;
});
$("botao-passo-a-passo").addEventListener("click", () => { $("folha-iphone").hidden = false; });
$("botao-fechar-iphone").addEventListener("click", () => { $("folha-iphone").hidden = true; });
$("dica-iphone").hidden = !IPHONE;
$("botao-fechar-conta").addEventListener("click", () => { $("folha-conta").hidden = true; });
$("botao-sair").addEventListener("click", sair);
$("selo-jogo").addEventListener("click", () => { $("menu-jogo").hidden = !$("menu-jogo").hidden; });
$("botao-voltar-jogo").addEventListener("click", () => { $("menu-jogo").hidden = true; });
$("botao-sair-jogo").addEventListener("click", pararLive);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && app.aoVivo && !app.trava) manterTelaAcesa();
});

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

carregarConta();
