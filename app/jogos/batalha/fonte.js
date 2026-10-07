/* De onde vêm os eventos: a live (comum/live.js: o WebSocket do conector ou
   o canal da nuvem, na live feita pelo celular) ou o demo embutido. Os dois
   entregam o mesmo pacote do conector, {type, user, data}, então o jogo não
   sabe (nem precisa saber) qual está ligado. */
"use strict";

const Conector = {
  ligado: false,
  _live: null,

  iniciar(porta, { aoEvento, aoSinal }) {
    this._live = conectarLive({
      ws: `ws://127.0.0.1:${porta}`,
      aoPacote: aoEvento,
      aoEstado: estado => {
        const ligado = estado === "conectado";
        if (ligado !== this.ligado) aoSinal(ligado);
        this.ligado = ligado;
      },
    });
  },

  parar() {
    if (this._live) this._live.parar();
  },
};

/* Plateia falsa pra testar e gravar print sem live. Não é sorteio puro:
   tem gente fiel a um lado, gente que só manda rosa, gente que manda um
   presente grande e esquece de escolher o lado, e ondas de um lado só
   (é o que faz a virada acontecer como numa live de verdade). */
const Demo = {
  _timer: null,
  _onda: { lado: 0, ate: 0 },

  NICKS: [
    "mari.alves", "joaozin_77", "tia_cida", "dudu.rj", "bia_santos", "careca_do_gas", "nanda.bh",
    "pedrinho.vlog", "luh_mendes", "seu_arnaldo", "kaka.oficial", "gabi_ssa", "rafa_motoboy",
    "dona_neide", "thi_barbeiro", "lari.costa", "zeca_fortal", "jessy.lima", "vini_fut", "carol_poa",
    "neto_caminhoneiro", "manu.recife", "brunao_gym", "aline.mkt", "tonhao_bar", "duda.mg",
    "leo_uber", "pri.manaus", "matheus.tech", "cris_cabelereira", "fefe_curitiba", "juninho.gamer",
    "vovo_lurdes", "gui_skate", "talita.nails", "diego_pedreiro", "isa.floripa", "renan_bombeiro",
    "paty.sp", "marcos_taxi", "lu_professora", "biel.mc", "keka_goiania", "robson.eletricista",
  ],
  OUTROS: [
    ["Finger Heart", 5, 30], ["Perfume", 20, 14], ["Doughnut", 30, 10], ["Hand Hearts", 100, 5],
    ["Hat and Mustache", 99, 5], ["Galaxy", 1000, 1.4], ["Lion", 29999, 0.05],
  ],
  CHAT: ["boraaa", "vira vira", "kkkkkk", "manda rosa galera", "tá pegando fogo", "ninguém segura",
    "que disputa", "olha a virada", "boa noite live", "ainda dá tempo", "eita"],

  /* `fracaoA()` é a fatia do lado 1 no placar: a onda puxa mais pro lado
     que está atrás, que é como a live reage quando vê o placar virando. */
  iniciar(config, aoEvento, fracaoA = () => 0.5) {
    const lados = config.lados;
    const pessoas = this.NICKS.map((nick, i) => ({
      id: "demo" + i,
      nick,
      fiel: Math.random() < 0.55 ? 0 : 1,
      escolheu: false,
      generoso: Math.random() < 0.15,
    }));
    const enviar = (type, p, data) =>
      aoEvento({ type, ts: Date.now() / 1000, user: p && { id: p.id, nickname: p.nick, avatar: null }, data });

    aoEvento({ type: "bridge_status", user: null, data: { mode: "demo" } });

    const sortear = (lista, peso) => {
      let r = Math.random() * lista.reduce((s, x) => s + peso(x), 0);
      for (const x of lista) if ((r -= peso(x)) <= 0) return x;
      return lista[lista.length - 1];
    };

    const passo = () => {
      const agora = Date.now();
      if (agora > this._onda.ate) {
        const f = fracaoA();
        const lado = f === 0.5 ? (Math.random() < 0.5 ? 0 : 1) : Math.random() < 0.75 ? (f > 0.5 ? 1 : 0) : (f > 0.5 ? 0 : 1);
        this._onda = { lado, ate: agora + 4000 + Math.random() * 5000 };
      }
      const p = sortear(pessoas, x => (x.fiel === this._onda.lado ? 3 : 1) * (x.generoso ? 2 : 1));
      const dado = Math.random();

      if (Math.random() < 0.25) enviar("like", p, { count: 5 + Math.floor(Math.random() * 20) });
      else if (Math.random() < 0.02) enviar("follow", p, {});
      else if (dado < 0.3) {
        const lado = lados[p.fiel];
        if (!p.escolheu && Math.random() < 0.6) {
          p.escolheu = true;
          enviar("chat", p, { text: Math.random() < 0.8 ? lado.comandos[0] : lado.nome.toLowerCase() });
        } else enviar("chat", p, { text: this.CHAT[Math.floor(Math.random() * this.CHAT.length)] });
      } else if (dado < 0.82 || !p.generoso && dado < 0.9) {
        const nome = lados[p.fiel].presente.aceitos[0];
        const count = [1, 1, 1, 1, 5, 5, 10, 30][Math.floor(Math.random() * 8)];
        p.escolheu = true;
        enviar("gift", p, { name: nome, count, coins: 1, total_coins: count });
      } else {
        const [name, coins] = sortear(this.OUTROS, x => x[2]);
        enviar("gift", p, { name, count: 1, coins, total_coins: coins });
        /* Quem nunca escolheu lado fica pendente; a maioria lembra de
           comentar o número uns segundos depois, como acontece na live. */
        if (!p.escolheu && Math.random() < 0.8) {
          p.escolheu = true;
          setTimeout(() => enviar("chat", p, { text: lados[p.fiel].comandos[0] }), 2500 + Math.random() * 4000);
        }
      }
      this._timer = setTimeout(passo, 280 + Math.random() * 900);
    };
    this._timer = setTimeout(passo, 600);
  },

  parar() { clearTimeout(this._timer); },
};
