/* Endereços e jogos do app do celular. ?api= e ?relay= na URL trocam o
   servidor (teste local). Jogo novo entra com uma linha em JOGOS e uma
   pasta em ../jogos_web/ (o montar.py copia). */
"use strict";

const CONFIG = {
  api: "https://api.rendaplay.com.br",
  relay: "https://relay.rendaplay.com.br",
  // Capas, marca e arquivos dos jogos: o montar.py --cdn aponta pro jsDelivr.
  assets: "",
  suporte: "https://wa.me/5511941867789?text=" + encodeURIComponent("Oi! Preciso de ajuda com o app da Renda Play no celular."),
};

/* Só os jogos web: os de Roblox ainda precisam do PC. */
const JOGOS = [
  { id: "batalha", nome: "Batalha", descricao: "Tela dividida e uma corda que só anda com presente." },
  { id: "pipa", nome: "Pipa Combate", descricao: "Comentou, soltou a pipa. Presente corta." },
  { id: "escalada", nome: "Escalada", descricao: "Metade do chat ajuda o Zé, metade derruba." },
  { id: "racha", nome: "Racha da Live", descricao: "Cada comentário vira um carro na pista." },
  { id: "chefao", nome: "Chefão Coletivo", descricao: "O chat inteiro contra o Boleto Gigante." },
  { id: "flappy", nome: "Voa, Tuca!", descricao: "O chat paga pra derrubar ou salvar o tucano." },
];
