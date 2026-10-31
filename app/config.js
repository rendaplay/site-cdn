/* Endereços e jogos do app do celular. ?api= e ?relay= na URL trocam o
   servidor (teste local). Jogo novo entra com uma linha em JOGOS e uma
   pasta em ../jogos_web/ (o montar.py copia). */
"use strict";

const CONFIG = {
  api: "https://api.rendaplay.com.br",
  relay: "https://relay.rendaplay.com.br",
  // Capas, marca e arquivos dos jogos: o montar.py --cdn aponta pro jsDelivr.
  assets: "",
  guia: "https://rendaplay.com.br/guia-restricoes.pdf",
  grupo: "https://chat.whatsapp.com/LXwhUQe2uVOKTo7YhKmYmh",
  suporte: "https://wa.me/5511941867789?text=" + encodeURIComponent("Oi! Preciso de ajuda com o app da Renda Play no celular."),
};

/* Só os jogos web: os de Roblox ainda precisam do PC. */
const JOGOS = [
  { id: "batalha", nome: "Batalha de Torres", descricao: "Disputa fictícia entre dois lados: comentários, curtidas e presentes movimentam as torres." },
  { id: "pipa", nome: "Pipa Combate", descricao: "Comentou, soltou a pipa. Presente corta." },
  { id: "escalada", nome: "Escalada", descricao: "Metade do chat ajuda o Zé, metade derruba." },
  { id: "racha", nome: "Racha da Live", descricao: "Cada comentário vira um carro na pista." },
  { id: "chefao", nome: "Chefão Coletivo", descricao: "O chat inteiro contra o Boleto Gigante." },
  { id: "flappy", nome: "Voa, Tuca!", descricao: "O chat paga pra derrubar ou salvar o tucano." },
  // indisponivel: aparece na lista sem deixar abrir.
  { id: "urna", indisponivel: true, nome: "Disputa da Live", descricao: "Uma disputa fictícia ao vivo: cada interação soma pontos para um dos lados." },
  { id: "presidencial", indisponivel: true, nome: "Corrida da Live", descricao: "Uma corrida fictícia ao vivo em que as interações movimentam a disputa." },
  { id: "bolinha", nome: "Chuva de Bolinha", descricao: "Cada comentário solta uma bolinha com a sua foto." },
  { id: "caiounaocai", nome: "Cai ou Não Cai?", descricao: "O chat salva o time do coração do rebaixamento." },
];
