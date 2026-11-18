import * as THREE from "three";
import { BandeiraBrasil, BandeiraXadrez, CapaceteF1, Champanhe } from "./F1";
import { CopoGin, Garrafa } from "./Bebidas";
import { caixa, cilindro, clamp01, entre, esfera, geo, lerp, mat, rng, sementeDe, suave } from "./util";

// Boneco low poly: blocos facetados com articulações (ombro, cotovelo, anca, joelho, pescoço) e uma cara simples
// (olhos que piscam, sobrancelhas e boca por expressão). Mede ~1,8 m. Olha para +z (para a câmara) com rotY = 0.
// Cada ação é uma função do tempo que devolve uma pose; o roteiro só escolhe o nome.

export type Visual = "pessoa" | "jogador" | "arbitro" | "gamer" | "cientista" | "astronauta" | "crianca" | "executivo" | "mergulhador" | "medico" | "alienigena" | "robo" | "piloto" | "piloto_capacete" | "mecanico" | "relojoeiro" | "motoboy" | "politico" | "presidente";
export type Acao =
  | "parado" | "andar" | "correr" | "acenar" | "apontar" | "celebrar" | "choque" | "pensar" | "falar" | "encolher"
  | "bracos_cruzados" | "chutar" | "torcer" | "dancar" | "sentar" | "digitar" | "apitar" | "cartao" | "var" | "cair" | "flutuar" | "triste"
  | "beber" | "beber_sentado" | "cheirar" | "baforar" | "tontura" | "nervoso" | "ao_telefone" | "entregar" | "rolar_celular" | "celular_sentado" | "cabeca_nas_maos" | "esconder_rosto" | "discursar" | "protestar";
export type Expressao = "neutro" | "feliz" | "triste" | "choque" | "bravo" | "pensativo" | "convencido";
export type Segura = "cartao_amarelo" | "cartao_vermelho" | "apito" | "celular" | "trofeu" | "bola" | "bandeira" | "portatil" | "comando" | "geiger" | "bandeira_xadrez" | "bandeira_brasil" | "champanhe" | "dinheiro" | "pinca" | "relogio" | "copo_gin" | "garrafa_gin" | "nota_enrolada" | "lanca_perfume" | "pano" | "cartao_banco" | "maquininha" | "microfone" | "placa_protesto" | "carteira_trabalho";

type Braco = [number, number, number]; // [à frente, para o lado, cotovelo] em radianos
type Perna = [number, number]; // [anca à frente, joelho]
export type Pose = {
  y: number; inclina: number; giro: number; cab: [number, number, number];
  bE: Braco; bD: Braco; pE: Perna; pD: Perna;
  queda: number; // 0 = de pé, 1 = deitado de costas
};

const BASE: Pose = { y: 0, inclina: 0, giro: 0, cab: [0, 0, 0], bE: [0.05, 0.12, 0.15], bD: [0.05, 0.12, 0.15], pE: [0, 0], pD: [0, 0], queda: 0 };
const misturar = (a: Pose, b: Pose, k: number): Pose => {
  const m = (x: number, y: number) => lerp(x, y, k);
  const v = <T extends number[]>(x: T, y: T) => x.map((n, i) => m(n, y[i])) as T;
  return { y: m(a.y, b.y), inclina: m(a.inclina, b.inclina), giro: m(a.giro, b.giro), cab: v(a.cab, b.cab), bE: v(a.bE, b.bE), bD: v(a.bD, b.bD), pE: v(a.pE, b.pE), pD: v(a.pD, b.pD), queda: m(a.queda, b.queda) };
};
const S = Math.sin;

// passo de marcha/corrida (fase em ciclos)
const passo = (t: number, hz: number, amp: number, joelho: number, braco: number, cotov: number, inclina: number, salto: number): Pose => {
  const a = t * hz * Math.PI * 2;
  return {
    ...BASE, inclina, y: salto * Math.abs(S(a)),
    pE: [amp * S(a), joelho * Math.max(0, S(a - 1.2))], pD: [-amp * S(a), joelho * Math.max(0, -S(a - 1.2))],
    bE: [-braco * S(a), 0.12, cotov], bD: [braco * S(a), 0.12, cotov], cab: [0, 0, 0.03 * S(a)],
  };
};
// um gole a cada 3,2 s: sobe (0,3–0,8 s), fica (até 1,5 s) e desce (até 2 s)
const gole = (t: number) => { const f = t % 3.2; return entre(f, 0.3, 0.8) * (1 - entre(f, 1.5, 2.0)); };
const sentado = (t: number): Pose => ({ ...BASE, y: -0.42, inclina: 0.06, pE: [1.45, 1.5], pD: [1.4, 1.5], bE: [0.5, 0.15, 1.1], bD: [0.5, 0.15, 1.1], cab: [0.02 * S(t * 1.3), 0, 0] });

export const POSES: Record<Acao, (t: number, s: number) => Pose> = {
  parado: (t, s) => ({ ...BASE, y: 0.006 * S(t * 2.4 + s), cab: [0.02 * S(t * 0.9 + s), 0.05 * S(t * 0.5 + s), 0.02 * S(t * 0.7)], bE: [0.05, 0.12 + 0.02 * S(t * 2.4), 0.15], bD: [0.05, 0.12 + 0.02 * S(t * 2.4 + 1), 0.15] }),
  andar: (t) => passo(t, 1.7, 0.5, 0.75, 0.42, 0.25, 0.04, 0.035),
  correr: (t) => passo(t, 2.7, 0.95, 1.5, 0.9, 1.35, 0.28, 0.09),
  acenar: (t) => ({ ...POSES.parado(t, 0), bD: [0.25, 2.55, 0.35 + 0.4 * S(t * 9)], cab: [0, 0, 0.06] }),
  apontar: (t) => ({ ...POSES.parado(t, 0), bD: [1.5, 0.15, 0.05], giro: -0.12, cab: [0, -0.15, 0] }),
  celebrar: (t) => {
    const salto = Math.abs(S(t * Math.PI * 1.6));
    return { ...BASE, y: 0.28 * salto, bE: [0.2, 2.75 + 0.15 * S(t * 10), 0.2], bD: [0.2, 2.75 + 0.15 * S(t * 10 + 1), 0.2], pE: [0.35 * salto, 0.7 * salto], pD: [0.25 * salto, 0.6 * salto], cab: [-0.15, 0, 0] };
  },
  choque: (t) => ({ ...BASE, inclina: -0.14, y: 0.04, bE: [1.05, 0.55, 1.75], bD: [1.05, 0.55, 1.75], cab: [-0.12, 0.03 * S(t * 30), 0], pE: [-0.05, 0.05], pD: [0.08, 0.05] }),
  pensar: (t) => ({ ...BASE, bD: [0.95, 0.15, 2.35], bE: [0.55, 0.2, 1.6], cab: [0.08, 0.12, 0.12 + 0.03 * S(t)], inclina: 0.03 }),
  falar: (t) => ({ ...POSES.parado(t, 0), bE: [0.55 + 0.25 * S(t * 3.1), 0.25, 1.2 + 0.2 * S(t * 4)], bD: [0.45 + 0.25 * S(t * 2.6 + 2), 0.3, 1.1 + 0.25 * S(t * 3.4)], cab: [0.05 * S(t * 4.2), 0.08 * S(t * 1.3), 0.04 * S(t * 2)] }),
  encolher: (t) => ({ ...BASE, y: 0.02, bE: [0.35, 0.65, 1.6], bD: [0.35, 0.65, 1.6], cab: [0.05, 0, -0.18 + 0.04 * S(t * 2)] }),
  bracos_cruzados: (t) => ({ ...POSES.parado(t, 0), bE: [0.3, -0.2, 1.5], bD: [0.36, -0.2, 1.42], inclina: -0.04, cab: [-0.05, 0, 0.05] }),
  chutar: (t) => {
    // prepara (0,2–0,55 s), chuta (0,55–0,75 s) e acompanha
    const tras = entre(t, 0.2, 0.55) * (1 - entre(t, 0.55, 0.68));
    const frente = entre(t, 0.55, 0.75) * (1 - entre(t, 1.1, 1.6));
    return { ...BASE, inclina: 0.1 - 0.2 * frente, pD: [-0.75 * tras + 1.35 * frente, 1.3 * tras + 0.15 * frente], pE: [0.1, 0.15], bE: [0.4 * frente - 0.3 * tras, 0.9, 0.3], bD: [-0.5 * frente + 0.4 * tras, 0.7, 0.3], cab: [0.18, 0, 0] };
  },
  torcer: (t) => ({ ...BASE, y: 0.06 * Math.abs(S(t * 6)), bE: [0.3, 2.45 + 0.3 * S(t * 6), 0.4], bD: [0.3, 2.45 + 0.3 * S(t * 6 + 0.5), 0.4], cab: [-0.12, 0, 0] }),
  dancar: (t) => ({ ...BASE, y: 0.05 * Math.abs(S(t * 5)), giro: 0.3 * S(t * 2.5), inclina: 0.05 * S(t * 5), bE: [0.6 + 0.6 * S(t * 5), 0.8 + 0.6 * S(t * 2.5), 1.2], bD: [0.6 - 0.6 * S(t * 5), 0.8 - 0.6 * S(t * 2.5), 1.2], pE: [0.25 * Math.max(0, S(t * 5)), 0.5 * Math.max(0, S(t * 5))], pD: [0.25 * Math.max(0, -S(t * 5)), 0.5 * Math.max(0, -S(t * 5))], cab: [0, 0, 0.12 * S(t * 5)] }),
  sentar: (t) => sentado(t),
  // beber: leva o copo à boca a cada ~3 s, inclina a cabeça para trás e volta a baixar (o objeto seguro vai no braço bD)
  beber: (t) => { const k = gole(t); return { ...POSES.parado(t, 0), bD: [lerp(0.55, 1.05, k), lerp(0.18, 0.05, k), lerp(1.25, 2.5, k)], bE: [0.1, 0.15, 0.3], cab: [-0.22 * k, 0, 0.03 * S(t)] }; },
  beber_sentado: (t) => { const k = gole(t); return { ...sentado(t), bD: [lerp(0.6, 1.05, k), lerp(0.2, 0.05, k), lerp(1.2, 2.5, k)], cab: [-0.22 * k, 0, 0] }; },
  // cheirar (vídeos de saúde/prevenção): debruça-se sobre a bancada, a mão com a nota no nariz, endireita-se de
  // repente com a cabeça para trás e esfrega o nariz; repete a cada 4,5 s
  cheirar: (t) => {
    const f = t % 4.5;
    const baixa = entre(f, 0.2, 0.7) * (1 - entre(f, 2.1, 2.5));
    const varre = entre(f, 0.8, 2.0);
    const solavanco = entre(f, 2.4, 2.6) * (1 - entre(f, 2.7, 3.3));
    const esfrega = entre(f, 2.6, 2.9) * (1 - entre(f, 3.9, 4.3));
    const mao = Math.max(baixa, esfrega);
    return {
      ...POSES.parado(t, 0), inclina: 0.55 * baixa - 0.06 * solavanco, giro: 0.14 * (varre - 0.5) * baixa,
      cab: [0.3 * baixa - 0.3 * solavanco, 0, 0.05 * solavanco], y: -0.04 * baixa,
      bD: [lerp(0.3, 1.55, mao), lerp(0.15, -0.9, mao), lerp(0.6, 1.35, mao) + 0.08 * esfrega * Math.sin(t * 16)],
      bE: [lerp(0.1, 0.95, baixa), lerp(0.15, 0.3, baixa), lerp(0.3, 0.35, baixa)],
    };
  },
  // baforar (lança-perfume, solventes): leva o pano ou o frasco ao nariz e à boca, inspira fundo com a cabeça para
  // trás e, ao baixar, fica tonto a balançar; repete a cada 4,5 s
  baforar: (t) => {
    const f = t % 4.5;
    const sobe = entre(f, 0.2, 0.6) * (1 - entre(f, 2.0, 2.4));
    const inspira = entre(f, 0.6, 1.9) * (1 - entre(f, 2.0, 2.3));
    const tonto = entre(f, 2.2, 2.8) * (1 - entre(f, 4.1, 4.5));
    return {
      ...POSES.parado(t, 0), y: 0.02 * inspira - 0.03 * tonto, inclina: -0.07 * inspira + 0.07 * tonto * Math.sin(t * 1.7),
      giro: 0.16 * tonto * Math.sin(t * 2.1), cab: [-0.22 * inspira + 0.1 * tonto, 0.12 * tonto * Math.sin(t * 1.3), 0.14 * tonto * Math.sin(t * 2.3)],
      bD: [lerp(0.25, 1.55, sobe), lerp(0.15, -0.9, sobe), lerp(0.5, 1.35, sobe)],
      bE: [0.15 + 0.25 * tonto, 0.15 + 0.5 * tonto, 0.3],
      pE: [0.1 * tonto * Math.max(0, Math.sin(t * 2.1)), 0.15 * tonto * Math.max(0, Math.sin(t * 2.1))], pD: [0.1 * tonto * Math.max(0, -Math.sin(t * 2.1)), 0.15 * tonto * Math.max(0, -Math.sin(t * 2.1))],
    };
  },
  // tontura: cambaleia, com a cabeça a rodar e os braços abertos para se equilibrar
  tontura: (t) => ({
    ...BASE, y: -0.02 + 0.015 * Math.sin(t * 2.6), inclina: 0.1 * Math.sin(t * 1.5), giro: 0.22 * Math.sin(t * 1.1),
    cab: [0.12 + 0.1 * Math.sin(t * 1.9), 0.15 * Math.sin(t * 1.3), 0.2 * Math.sin(t * 2.2)],
    bE: [0.25 + 0.2 * Math.sin(t * 1.7), 0.55 + 0.25 * Math.sin(t * 2.1), 0.5], bD: [0.25 + 0.2 * Math.sin(t * 1.9 + 1), 0.55 + 0.25 * Math.sin(t * 2.3 + 2), 0.5],
    pE: [0.18 * Math.max(0, Math.sin(t * 1.1)), 0.3 * Math.max(0, Math.sin(t * 1.1))], pD: [0.18 * Math.max(0, -Math.sin(t * 1.1)), 0.3 * Math.max(0, -Math.sin(t * 1.1))],
  }),
  // nervoso (paranoia, ansiedade): olha depressa para um lado e para o outro, treme e esfrega as mãos
  nervoso: (t) => {
    const olha = Math.tanh(3 * Math.sin(t * 1.9)) * 0.6;
    return {
      ...BASE, y: 0.006 * Math.sin(t * 41), inclina: 0.06, cab: [0.04 + 0.02 * Math.sin(t * 37), olha, 0.03 * Math.sin(t * 29)],
      bE: [0.95, 0.1, 1.75 + 0.15 * Math.sin(t * 9)], bD: [0.95, 0.1, 1.75 + 0.15 * Math.sin(t * 9 + Math.PI)],
    };
  },
  // ao telefone: o celular encostado à orelha, a outra mão a gesticular devagar
  ao_telefone: (t) => ({
    ...POSES.parado(t, 0), bD: [0.45, 0.4, 2.8], bE: [0.4 + 0.25 * Math.sin(t * 2.2), 0.25, 1.1 + 0.2 * Math.sin(t * 3.1)],
    cab: [0.04 * Math.sin(t * 1.7), 0.1 * Math.sin(t * 0.8), -0.12],
  }),
  // entregar: estica o braço para dar o que tem na mão (o cartão ao falso motoboy, o dinheiro, o celular)
  entregar: (t) => ({ ...POSES.parado(t, 0), bD: [1.3 + 0.03 * Math.sin(t * 2), 0.06, 0.2], cab: [0.12, 0, 0], inclina: 0.04 }),
  // vícios digitais: rolar o feed (em pé, curvado, o polegar a deslizar), o mesmo sentado na beira da cama, a cabeça
  // entre as mãos (culpa, cansaço) e esconder a cara com as duas mãos (vergonha). O celular vai na mão bD.
  // (ângulos achados por IK numérico: mãos juntas à frente do peito, nas têmporas ou à frente da cara)
  rolar_celular: (t) => ({ ...POSES.parado(t, 0), inclina: 0.08, bD: [0.5, -0.3, 1.05], bE: [0.45, -0.3, 1.1 + 0.1 * Math.max(0, Math.sin(t * 5))], cab: [0.42 + 0.02 * Math.sin(t * 0.8), 0, 0.03] }),
  celular_sentado: (t) => ({ ...sentado(t), inclina: 0.2, bD: [0.5, -0.3, 1.05], bE: [0.45, -0.3, 1.1 + 0.1 * Math.max(0, Math.sin(t * 5))], cab: [0.42 + 0.02 * Math.sin(t * 0.8), 0, 0.03] }),
  cabeca_nas_maos: (t) => ({ ...sentado(t), inclina: 0.42, bE: [1.75, -0.6, 1.9], bD: [1.75, -0.6, 1.9], cab: [0.3, 0.06 * Math.sin(t * 0.9), 0.03 * Math.sin(t * 1.3)] }),
  esconder_rosto: (t) => ({ ...POSES.parado(t, 0), inclina: 0.12, bE: [1.5, -0.75, 1.55], bD: [1.5, -0.75, 1.55], cab: [0.12, 0.08 * Math.sin(t * 1.1), 0], y: 0.004 * Math.sin(t * 23) }),
  // discursar: uma mão no púlpito, a outra a marcar as frases (de vez em quando o punho no ar); protestar: o
  // cartaz (ou a bandeira) erguido a subir e descer, o outro punho a acompanhar e pequenos saltos
  discursar: (t) => {
    const marca = Math.max(0, Math.sin(t * 3.4)), punho = entre(t % 5, 3.2, 3.5) * (1 - entre(t % 5, 4.2, 4.6));
    return { ...POSES.parado(t, 0), bE: [0.75, 0.12, 0.55], bD: [lerp(0.9 + 0.5 * marca, 2.9, punho), lerp(0.25, 0.1, punho), lerp(1.4 - 0.6 * marca, 0.3, punho)], cab: [0.06 * Math.sin(t * 3.4), 0.12 * Math.sin(t * 0.7), 0], inclina: 0.04 + 0.03 * marca };
  },
  protestar: (t) => {
    const sobe = Math.max(0, Math.sin(t * 5));
    return { ...BASE, y: 0.06 * sobe, bD: [2.8 + 0.12 * sobe, 0.1, 0.15 + 0.2 * (1 - sobe)], bE: [0.4 + 1.6 * sobe, 0.3, 1.6 - 1.2 * sobe], pE: [0.15 * sobe, 0.3 * sobe], pD: [0.1 * sobe, 0.25 * sobe], cab: [-0.12, 0.05 * Math.sin(t * 2), 0] };
  },
  digitar: (t) => ({ ...sentado(t), bE: [1.0, 0.2, 0.85 + 0.12 * Math.max(0, S(t * 17))], bD: [1.0, 0.2, 0.85 + 0.12 * Math.max(0, S(t * 19 + 1))], cab: [0.18, 0, 0] }),
  apitar: (t) => ({ ...BASE, bD: [1.25, 0.05, 2.55], bE: [0.1, 1.55 + 0.05 * S(t * 3), 0.05], cab: [-0.05, -0.1, 0], inclina: -0.03 }),
  cartao: (t) => ({ ...BASE, bD: [2.95, 0.12, 0.05], bE: [0.05, 0.2, 0.2], cab: [-0.1, 0, 0], inclina: -0.05, y: 0.01 * S(t * 3) }),
  var: (t) => {
    // desenha o ecrã do VAR no ar: mãos juntas em cima, abrem para os lados e descem
    const k = (t * 0.7) % 1;
    const abre = entre(k, 0.05, 0.35), desce = entre(k, 0.4, 0.7);
    return { ...BASE, bE: [1.5 - 0.6 * desce, 0.1 + 0.9 * abre, 0.4 * (1 - abre)], bD: [1.5 - 0.6 * desce, 0.1 + 0.9 * abre, 0.4 * (1 - abre)], cab: [0.05, 0, 0] };
  },
  cair: (t) => {
    // simulação: tropeça, cai de costas e fica a rebolar com as mãos na perna
    const q = entre(t, 0.25, 0.85);
    const rebola = q >= 1 ? 0.1 * S(t * 7) : 0;
    return { ...BASE, queda: q, bE: [0.5 + 1.2 * q, 0.6, 0.8 + 1.0 * q], bD: [0.5 + 1.2 * q, 0.6, 0.8 + 1.0 * q], pE: [1.0 * q, 1.4 * q], pD: [0.3 * q, 0.2 * q], giro: rebola, cab: [-0.2 * (1 - q), 0, 0] };
  },
  flutuar: (t) => ({ ...BASE, y: 0.35 + 0.12 * S(t * 1.2), inclina: 0.08 * S(t * 0.7), bE: [0.3 + 0.2 * S(t * 0.9), 0.7, 0.4], bD: [0.2 + 0.2 * S(t * 0.8 + 1), 0.8, 0.5], pE: [0.25 + 0.15 * S(t * 0.6), 0.35], pD: [-0.1 + 0.15 * S(t * 0.7 + 2), 0.25], cab: [0.05 * S(t * 0.5), 0.1 * S(t * 0.4), 0.06 * S(t * 0.6)] }),
  triste: (t) => ({ ...BASE, inclina: 0.16, y: -0.02, bE: [0.0, 0.05, 0.1], bD: [0.0, 0.05, 0.1], cab: [0.38 + 0.02 * S(t), 0, 0.05] }),
};

// expressão de cada ação quando o roteiro não escolhe outra
export const EXPRESSAO_DA_ACAO: Partial<Record<Acao, Expressao>> = {
  celebrar: "feliz", torcer: "feliz", dancar: "feliz", acenar: "feliz", choque: "choque", pensar: "pensativo", apontar: "convencido",
  bracos_cruzados: "convencido", cair: "choque", triste: "triste", nervoso: "choque", tontura: "triste", ao_telefone: "pensativo", rolar_celular: "neutro", celular_sentado: "neutro", cabeca_nas_maos: "triste", esconder_rosto: "triste", discursar: "convencido", protestar: "bravo", apitar: "bravo", cartao: "bravo", var: "pensativo", chutar: "bravo",
};

// pose no tempo t (s), com entrada suave a partir da pose de repouso
export const poseEm = (acao: Acao, t: number, semente: number) => {
  const alvo = POSES[acao](t, semente);
  return acao === "parado" ? alvo : misturar(POSES.parado(t, semente), alvo, suave(t / 0.35));
};

// ---------- aparência ----------
const PELES = ["#f2c9a6", "#e0ab7f", "#b97a4f", "#8a5634", "#5e3a22"];
const CABELOS = ["#2b1d14", "#4a2f1d", "#1a1a1a", "#8a5a2b", "#d9b46a", "#6b3b1f"];
type Roupa = { tronco: string; pernas: string; sapato: string; meia?: string; extra?: "headset" | "bata" | "capacete" | "gravata" | "faixa" | "presidente" | "mergulho" | "medico" | "macacao" | "motoboy" };
const roupaDe = (v: Visual, cor: string): Roupa => {
  switch (v) {
    case "jogador": return { tronco: cor, pernas: "#f4f4f4", sapato: "#1b1b1b", meia: cor };
    case "arbitro": return { tronco: cor || "#f2d21b", pernas: "#151515", sapato: "#151515", meia: "#151515" };
    case "gamer": return { tronco: cor, pernas: "#2a2f3d", sapato: "#e8e8e8", extra: "headset" };
    case "cientista": return { tronco: "#f4f6f8", pernas: "#34405a", sapato: "#3a2a20", extra: "bata" };
    case "astronauta": return { tronco: "#eef1f4", pernas: "#eef1f4", sapato: "#9aa3ad", extra: "capacete" };
    case "executivo": return { tronco: "#2c3446", pernas: "#2c3446", sapato: "#151515", extra: "gravata" };
    // político genérico (fato escuro, gravata na cor da personagem) e presidente (fato e a faixa verde e amarela)
    case "politico": return { tronco: "#23293a", pernas: "#23293a", sapato: "#151515", extra: "gravata" };
    case "presidente": return { tronco: "#1e2433", pernas: "#1e2433", sapato: "#111111", extra: "presidente" };
    case "mergulhador": return { tronco: "#1d2430", pernas: "#1d2430", sapato: cor || "#ffcf3a", extra: "mergulho" };
    case "medico": return { tronco: "#5fb8b0", pernas: "#5fb8b0", sapato: "#f4f4f4", extra: "medico" };
    case "alienigena": return { tronco: cor || "#c9ced6", pernas: "#9aa3ad", sapato: "#6b7480" };
    case "robo": return { tronco: "#7d8794", pernas: "#6b7480", sapato: "#3a3f47" };
    case "piloto": case "piloto_capacete": return { tronco: cor, pernas: cor, sapato: "#1b1b1b", extra: "macacao" };
    case "motoboy": return { tronco: cor || "#1d2430", pernas: "#2a2f3d", sapato: "#151515", extra: "motoboy" };
    case "relojoeiro": return { tronco: "#f4f6f8", pernas: "#2c3446", sapato: "#2a2a2a", extra: "bata" };
    case "mecanico": return { tronco: cor, pernas: "#22252c", sapato: "#1b1b1b", extra: "headset" };
    default: return { tronco: cor, pernas: "#3d4a66", sapato: "#2a2a2a" };
  }
};

export type BonecoProps = {
  pose: Pose; expressao: Expressao; visual: Visual; cor: string; pele?: string; cabelo?: string; semente: string;
  t: number; fala?: boolean; segura?: Segura;
};

const OLHO = new THREE.Color("#141414");
// boca por expressão (fala = abre e fecha)
const Boca: React.FC<{ e: Expressao; abre: number }> = ({ e, abre }) => {
  const preto = mat("#2a1414");
  if (e === "choque" || abre > 0.35) {
    const a = e === "choque" ? 1 : abre;
    return <mesh geometry={esfera(0.045, 0)} material={preto} scale={[1, 0.5 + 0.9 * a, 0.35]} />;
  }
  if (e === "feliz" || e === "convencido") {
    const g = geo(`sorriso${e}`, () => new THREE.TorusGeometry(e === "feliz" ? 0.055 : 0.04, 0.014, 3, 7, Math.PI));
    return <mesh geometry={g} material={preto} rotation={[0, 0, Math.PI + (e === "convencido" ? 0.35 : 0)]} position={[e === "convencido" ? 0.015 : 0, 0.02, 0]} />;
  }
  if (e === "triste") {
    const g = geo("triste", () => new THREE.TorusGeometry(0.045, 0.013, 3, 7, Math.PI));
    return <mesh geometry={g} material={preto} position={[0, -0.025, 0]} />;
  }
  return <mesh geometry={caixa(0.085, 0.016, 0.02)} material={preto} rotation-z={e === "bravo" ? -0.12 : e === "pensativo" ? 0.18 : 0} position-x={e === "pensativo" ? 0.02 : 0} />;
};

// objeto na mão direita (fica na ponta do antebraço)
const NaMao: React.FC<{ o: Segura; t: number }> = ({ o, t }) => {
  switch (o) {
    case "cartao_amarelo": case "cartao_vermelho":
      return <mesh position={[0, -0.1, 0.02]} geometry={caixa(0.09, 0.13, 0.008)} material={mat(o === "cartao_amarelo" ? "#ffd21a" : "#e5281f", { emissivo: o === "cartao_amarelo" ? "#ffd21a" : "#e5281f", brilho: 0.25 })} />;
    case "apito": return <mesh position={[0, -0.04, 0.05]} geometry={cilindro(0.02, 0.025, 0.06, 6)} rotation-x={1.4} material={mat("#c9ced6", { metal: 0.6, aspereza: 0.4 })} />;
    case "celular": return <group position={[0, -0.07, 0.03]}><mesh geometry={caixa(0.075, 0.15, 0.012)} material={mat("#1c1f26")} /><mesh position-z={0.007} geometry={caixa(0.065, 0.13, 0.002)} material={mat("#4fb3ff", { emissivo: "#4fb3ff", brilho: 0.9 })} /></group>;
    case "trofeu": return <group position={[0, -0.02, 0.05]} rotation-x={-0.2}><mesh position-y={0.2} geometry={cilindro(0.11, 0.05, 0.18, 7)} material={mat("#f2c230", { metal: 0.8, aspereza: 0.3 })} /><mesh position-y={0.08} geometry={cilindro(0.025, 0.025, 0.1, 5)} material={mat("#f2c230", { metal: 0.8, aspereza: 0.3 })} /><mesh position-y={0.02} geometry={caixa(0.12, 0.05, 0.12)} material={mat("#5a3b1e")} /></group>;
    case "bola": return <mesh position={[0, -0.13, 0.08]} geometry={esfera(0.11, 1)} material={mat("#f5f5f5")} />;
    case "bandeira": return <group position={[0, -0.05, 0]}><mesh position-y={0.35} geometry={cilindro(0.012, 0.012, 0.8, 5)} material={mat("#d9d9d9")} /><mesh position={[0.17, 0.6, 0]} rotation-y={0.25 * Math.sin(t * 6)} geometry={caixa(0.32, 0.22, 0.01)} material={mat("#ffd21a", { ladoDuplo: true })} /></group>;
    case "portatil": return <group position={[0, -0.12, 0.12]} rotation-x={-1.2}><mesh geometry={caixa(0.34, 0.02, 0.24)} material={mat("#3b4150")} /><mesh position={[0, 0.12, -0.12]} rotation-x={1.3} geometry={caixa(0.34, 0.22, 0.012)} material={mat("#7fd0ff", { emissivo: "#7fd0ff", brilho: 0.8 })} /></group>;
    case "comando": return <mesh position={[0, -0.08, 0.06]} geometry={caixa(0.16, 0.04, 0.09)} material={mat("#22252c")} />;
    case "bandeira_xadrez": case "bandeira_brasil": return (
      <group position={[0, -0.05, 0]}>
        <mesh position-y={0.4} geometry={cilindro(0.012, 0.012, 0.9, 5)} material={mat("#d9d9d9")} />
        <group position={[o === "bandeira_brasil" ? 0.26 : 0.17, 0.68, 0]}>
          {o === "bandeira_brasil" ? <BandeiraBrasil t={t} l={0.5} a={0.35} /> : <BandeiraXadrez t={t} />}
        </group>
      </group>
    );
    case "pinca": return (
      <group position={[0, -0.12, 0.04]}>
        {[1, -1].map((l) => <mesh key={l} position-x={0.012 * l} rotation-z={0.06 * l} geometry={caixa(0.012, 0.16, 0.008)} material={mat("#d7dbe0", { metal: 0.8, aspereza: 0.25 })} />)}
      </group>
    );
    case "relogio": return (
      <group position={[0, -0.1, 0.05]} rotation-x={-0.4}>
        <mesh rotation-x={Math.PI / 2} geometry={cilindro(0.05, 0.05, 0.02, 14)} material={mat("#d7dbe0", { metal: 0.85, aspereza: 0.2 })} />
        <mesh position-z={0.011} rotation-x={Math.PI / 2} geometry={cilindro(0.042, 0.042, 0.004, 14)} material={mat("#14233f")} />
        {[1, -1].map((l) => <mesh key={l} position-y={0.07 * l} geometry={caixa(0.04, 0.06, 0.014)} material={mat("#d7dbe0", { metal: 0.85, aspereza: 0.3 })} />)}
      </group>
    );
    case "dinheiro": return (
      <group position={[0, -0.1, 0.05]} rotation-x={-0.3}>
        {[0, 1, 2, 3].map((k) => <mesh key={k} position={[k * 0.02 - 0.03, k * 0.012, 0]} rotation-y={(k - 1.5) * 0.25} geometry={caixa(0.2, 0.004, 0.09)} material={mat("#4fae68")} />)}
      </group>
    );
    case "champanhe": return <group position={[0, -0.12, 0.03]}><Champanhe t={t} /></group>;
    case "copo_gin": return <group position={[0, -0.1, 0.06]} scale={1.7}><CopoGin /></group>;
    case "garrafa_gin": return <group position={[0, -0.22, 0.05]} scale={1.4}><Garrafa /></group>;
    case "nota_enrolada": return <mesh position={[0, -0.02, 0.04]} rotation-x={0.25} geometry={cilindro(0.012, 0.012, 0.15, 6)} material={mat("#7fb08a")} />;
    case "lanca_perfume": return (
      <group position={[0, -0.06, 0.05]}>
        <mesh geometry={cilindro(0.028, 0.028, 0.16, 8)} material={mat("#d9b24a", { metal: 0.8, aspereza: 0.3 })} />
        <mesh position-y={0.04} geometry={cilindro(0.03, 0.03, 0.05, 8)} material={mat("#c0392b")} />
        <mesh position-y={0.1} geometry={cilindro(0.008, 0.012, 0.04, 6)} material={mat("#d7dbe0", { metal: 0.8 })} />
      </group>
    );
    case "microfone": return <group position={[0, -0.05, 0.03]} rotation-x={-0.4}><mesh geometry={cilindro(0.022, 0.016, 0.16, 6)} material={mat("#1a1a1a")} /><mesh position-y={0.1} geometry={esfera(0.04, 1)} material={mat("#8a8f98", { metal: 0.5 })} /></group>;
    case "placa_protesto": return (
      <group position={[0, -0.02, 0.02]}>
        <mesh position-y={-0.4} geometry={cilindro(0.015, 0.015, 0.9, 4)} material={mat("#8a6a4a")} />
        <mesh position-y={-0.95} rotation-z={Math.PI} geometry={caixa(0.62, 0.42, 0.02)} material={mat("#f4f1ea", { ladoDuplo: true })} />
        {[0.08, -0.06].map((y, i) => <mesh key={y} position={[0, -0.95 - y, 0.012]} geometry={caixa(i ? 0.38 : 0.5, 0.07, 0.004)} material={mat(i ? "#1b1b1b" : "#c62828")} />)}
      </group>
    );
    case "carteira_trabalho": return <group position={[0, -0.06, 0.04]}><mesh geometry={caixa(0.1, 0.14, 0.015)} material={mat("#1d3f8a")} /><mesh position-z={0.009} geometry={caixa(0.05, 0.03, 0.002)} material={mat("#c9a24a")} /></group>;
    case "pano": return (
      <group position={[0, -0.06, 0.07]}>
        <mesh scale={[1.3, 0.8, 0.7]} geometry={esfera(0.06, 0)} material={mat("#f2f0ea")} />
        <mesh position={[0.02, -0.07, 0]} rotation-z={0.3} geometry={caixa(0.05, 0.09, 0.01)} material={mat("#f2f0ea", { ladoDuplo: true })} />
      </group>
    );
    case "cartao_banco": return (
      <group position={[0, -0.1, 0.03]}>
        <mesh geometry={caixa(0.085, 0.13, 0.006)} material={mat("#1f4fa8", { aspereza: 0.4 })} />
        <mesh position={[0, 0.03, 0.004]} geometry={caixa(0.03, 0.022, 0.002)} material={mat("#e0b84a", { metal: 0.8 })} />
      </group>
    );
    case "maquininha": return (
      <group position={[0, -0.09, 0.05]} rotation-x={-0.5}>
        <mesh geometry={caixa(0.09, 0.17, 0.035)} material={mat("#2a2d34")} />
        <mesh position={[0, 0.045, 0.019]} geometry={caixa(0.07, 0.05, 0.003)} material={mat("#173a22", { emissivo: "#49e07a", brilho: 0.7 })} />
        {[0, 1, 2].map((k) => <mesh key={k} position={[0, -0.02 - k * 0.022, 0.019]} geometry={caixa(0.065, 0.014, 0.004)} material={mat(k === 2 ? "#3fa34d" : "#cfd3da")} />)}
      </group>
    );
    case "geiger": return (
      <group position={[0, -0.08, 0.06]}>
        <mesh geometry={caixa(0.14, 0.12, 0.22)} material={mat("#f2c12e")} />
        <mesh position={[0, 0.062, 0.03]} geometry={caixa(0.1, 0.005, 0.1)} material={mat("#0b1a0e", { emissivo: "#5aff8a", brilho: 0.4 + 0.6 * Math.abs(Math.sin(t * 13)) })} />
        <mesh position={[0, 0.0, 0.2]} rotation-x={Math.PI / 2} geometry={cilindro(0.025, 0.025, 0.22, 6)} material={mat("#3a3d44")} />
      </group>
    );
  }
};

export const Boneco: React.FC<BonecoProps> = ({ pose, expressao, visual, cor, pele, cabelo, semente, t, fala, segura }) => {
  const r = rng(sementeDe(semente));
  const alien = visual === "alienigena", robo = visual === "robo";
  const corPele = pele ?? (alien ? ["#8fd65a", "#9aa3ad", "#6fc7d6", "#b48ad9"][Math.floor(r() * 4)] : PELES[Math.floor(r() * PELES.length)]);
  const corCabelo = cabelo ?? CABELOS[Math.floor(r() * CABELOS.length)];
  const roupa = roupaDe(visual, cor);
  const crianca = visual === "crianca";
  const astronauta = visual === "astronauta";
  const capaceteF1 = visual === "piloto_capacete";
  const escala = crianca ? 0.66 : 1;
  const cabeca = crianca ? 1.25 : 1;
  // piscar: a cada ~3 s, com desvio por personagem
  const fase = (t + r() * 3) % 3.2;
  const pisca = fase < 0.12 ? 0.15 : 1;
  const abre = fala ? Math.max(0, Math.sin(t * 15) * Math.sin(t * 6.3 + 1)) : 0;
  const sob = { neutro: [0, 0], feliz: [0.06, 0.15], triste: [-0.02, -0.35], choque: [0.08, 0.1], bravo: [-0.02, 0.45], pensativo: [0.03, -0.2], convencido: [0.02, 0.25] }[expressao];

  const mPele = robo ? mat("#aab2bd", { metal: 0.7, aspereza: 0.35 }) : mat(corPele), mTronco = mat(roupa.tronco), mPernas = mat(roupa.pernas), mSapato = mat(roupa.sapato), mMeia = mat(roupa.meia ?? corPele);
  const braco = (lado: 1 | -1, b: [number, number, number]) => (
    <group position={[0.29 * lado, 0.55, 0]} rotation={[-b[0], 0, b[1] * lado]}>
      <mesh position-y={-0.15} geometry={cilindro(0.065, 0.055, 0.3, 6)} material={visual === "jogador" || visual === "arbitro" ? mPele : mTronco} />
      {(visual === "jogador" || visual === "arbitro") && <mesh position-y={-0.06} geometry={cilindro(0.07, 0.066, 0.13, 6)} material={mTronco} />}
      <group position-y={-0.3} rotation-x={-b[2]}>
        <mesh position-y={-0.13} geometry={cilindro(0.052, 0.045, 0.27, 6)} material={visual === "jogador" || visual === "arbitro" ? mPele : astronauta ? mTronco : mPele} />
        {astronauta && <mesh position-y={-0.27} geometry={esfera(0.07, 0)} material={mat("#9aa3ad")} />}
        <mesh position-y={-0.29} geometry={esfera(0.06, 0)} material={astronauta ? mat("#9aa3ad") : mPele} />
        {lado === -1 && segura && <group position-y={-0.3}><NaMao o={segura} t={t} /></group>}
      </group>
    </group>
  );
  const perna = (lado: 1 | -1, p: [number, number]) => (
    <group position={[0.115 * lado, 0, 0]} rotation-x={-p[0]}>
      <mesh position-y={-0.22} geometry={cilindro(0.09, 0.075, 0.44, 6)} material={visual === "jogador" ? mPele : mPernas} />
      {visual === "jogador" && <mesh position-y={-0.08} geometry={cilindro(0.1, 0.095, 0.17, 6)} material={mPernas} />}
      <group position-y={-0.44} rotation-x={p[1]}>
        <mesh position-y={-0.21} geometry={cilindro(0.072, 0.06, 0.42, 6)} material={roupa.meia ? mMeia : mPernas} />
        <mesh position={[0, -0.45, 0.05]} geometry={caixa(0.12, 0.07, 0.24)} material={mSapato} />
      </group>
    </group>
  );

  // queda: o corpo roda para trás à volta dos pés e acaba deitado no chão
  const qa = pose.queda * (Math.PI / 2 - 0.05);
  return (
    <group scale={escala}>
      {/* sombra redonda no chão (mais barata e mais "desenho" do que sombras reais) */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.012} scale={[1 + pose.queda * 0.6, 1 + pose.queda * 1.8, 1]}>
        <circleGeometry args={[0.42, 10]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.22 * (1 - clamp01(pose.y * 1.5))} depthWrite={false} />
      </mesh>
      <group rotation-x={-qa} position={[0, 0.06 * pose.queda, -0.05 * pose.queda]}>
        <group position-y={0.93 + pose.y}>
          {perna(1, pose.pE)}
          {perna(-1, pose.pD)}
          <group rotation={[pose.inclina, pose.giro, 0]}>
            {/* anca e tronco */}
            <mesh position-y={0.04} geometry={caixa(0.36, 0.16, 0.22)} material={mPernas} />
            <mesh position-y={0.33} geometry={cilindro(0.25, 0.2, 0.5, 6)} material={mTronco} />
            {(roupa.extra === "bata" || roupa.extra === "medico") && <mesh position-y={0.1} geometry={cilindro(0.235, 0.25, 0.45, 6)} material={roupa.extra === "medico" ? mat("#f4f6f8") : mTronco} />}
            {roupa.extra === "medico" && <mesh position={[0, 0.33, 0]} geometry={cilindro(0.255, 0.21, 0.5, 6)} material={mat("#f4f6f8", { opacidade: 0.98 })} scale={[1.02, 1, 1.02]} />}
            {roupa.extra === "medico" && <mesh position={[0, 0.55, 0.12]} rotation-x={1.2} geometry={geo("estetoscopio", () => new THREE.TorusGeometry(0.15, 0.015, 4, 12, Math.PI))} material={mat("#2a2f38")} />}
            {roupa.extra === "mergulho" && <mesh position={[0, 0.36, -0.24]} rotation-x={0.05} geometry={cilindro(0.11, 0.11, 0.55, 8)} material={mat("#ffcf3a", { metal: 0.4 })} />}
            {(roupa.extra === "gravata" || roupa.extra === "presidente") && <mesh position={[0, 0.4, 0.2]} geometry={caixa(0.06, 0.28, 0.02)} material={mat(visual === "politico" ? cor : "#c0392b")} />}
            {roupa.extra === "presidente" && [1, -1].map((f) => (
              <group key={f} position={[0, 0.33, 0.205 * f]} rotation-z={0.72 * f}>
                <mesh geometry={caixa(0.13, 0.62, 0.012)} material={mat("#1f9d3a")} />
                <mesh position-z={0.007 * f} geometry={caixa(0.045, 0.62, 0.012)} material={mat("#f2d21b")} />
              </group>
            ))}
            {(roupa.extra === "gravata" || roupa.extra === "presidente") && <mesh position={[0, 0.54, 0.18]} geometry={caixa(0.16, 0.06, 0.06)} material={mat("#f4f4f4")} />}
            {visual === "arbitro" && <mesh position={[0, 0.5, 0.18]} geometry={caixa(0.2, 0.08, 0.06)} material={mat("#151515")} />}
            {/* macacão de piloto: gola e faixa branca no peito */}
            {roupa.extra === "macacao" && <mesh position-y={0.58} geometry={cilindro(0.11, 0.13, 0.05, 8)} material={mat("#f4f4f4")} />}
            {roupa.extra === "macacao" && <mesh position={[0, 0.42, 0.2]} geometry={caixa(0.3, 0.07, 0.03)} material={mat("#f4f4f4")} />}
            {roupa.extra === "macacao" && <mesh position={[0.1, 0.27, 0.2]} geometry={caixa(0.09, 0.06, 0.02)} material={mat("#f2d21b")} />}
            {robo && <mesh position={[0, 0.38, 0.21]} geometry={caixa(0.2, 0.14, 0.02)} material={mat("#0b1a2e", { emissivo: cor, brilho: 0.8 + 0.4 * Math.sin(t * 3) })} />}
            {/* motoboy: baú de entregas nas costas e faixa refletora no peito */}
            {roupa.extra === "motoboy" && (
              <group position={[0, 0.4, -0.33]}>
                <mesh geometry={caixa(0.46, 0.42, 0.36)} material={mat("#e8b21b")} />
                <mesh position-z={-0.185} geometry={caixa(0.3, 0.12, 0.01)} material={mat("#c0392b")} />
              </group>
            )}
            {roupa.extra === "motoboy" && <mesh position={[0, 0.3, 0.21]} geometry={caixa(0.36, 0.035, 0.02)} material={mat("#d9dde3", { emissivo: "#d9dde3", brilho: 0.2 })} />}
            {astronauta && <mesh position={[0, 0.36, -0.22]} geometry={caixa(0.36, 0.42, 0.16)} material={mat("#c9ced6")} />}
            {braco(1, pose.bE)}
            {braco(-1, pose.bD)}
            {/* pescoço e cabeça */}
            <mesh position-y={0.62} geometry={cilindro(0.06, 0.07, 0.1, 5)} material={mPele} />
            <group position-y={0.68} rotation={pose.cab} scale={cabeca}>
              {!robo && <mesh position-y={alien ? 0.22 : 0.16} geometry={esfera(0.2, 1)} material={mPele} scale={alien ? [1.12, 1.4, 1.05] : [1, 1.08, 1]} />}
              {!astronauta && !alien && !robo && !capaceteF1 && <mesh position={[0, 0.25, -0.03]} geometry={esfera(0.2, 1)} material={mat(corCabelo)} scale={[1.04, 0.62, 1.04]} />}
              {/* alienígena: olhos grandes amendoados, boca pequena e antenas com luz na ponta */}
              {alien && [1, -1].map((l) => (
                <group key={l}>
                  <mesh position={[0.09 * l, 0.16, 0.17]} rotation-z={0.45 * l} scale={[1.25, 0.62 * pisca, 0.4]} geometry={esfera(0.07, 1)} material={mat("#08080c", { aspereza: 0.15, metal: 0.4 })} />
                  <mesh position={[0.07 * l, 0.42, 0]} rotation-z={-0.35 * l} geometry={cilindro(0.012, 0.012, 0.22, 4)} material={mPele} />
                  <mesh position={[0.11 * l, 0.53, 0]} geometry={esfera(0.035, 0)} material={mat(cor, { emissivo: cor, brilho: 1.4 + 0.6 * Math.sin(t * 5 + l) })} />
                </group>
              ))}
              {/* robô: cabeça em caixa, visor que brilha, boca de luz e antena a piscar */}
              {robo && (
                <group position-y={0.16}>
                  <mesh geometry={caixa(0.38, 0.34, 0.34)} material={mPele} />
                  <mesh position={[0, 0.03, 0.172]} geometry={caixa(0.3, 0.1, 0.01)} material={mat("#0b1a2e")} />
                  {[1, -1].map((l) => <mesh key={l} position={[0.07 * l, 0.03, 0.18]} scale={[1, pisca, 1]} geometry={caixa(0.06, 0.04, 0.01)} material={mat(cor, { emissivo: cor, brilho: 2 })} />)}
                  <mesh position={[0, -0.09, 0.172]} scale={[0.4 + abre * 0.6, 1, 1]} geometry={caixa(0.16, 0.02, 0.01)} material={mat(cor, { emissivo: cor, brilho: 1.2 })} />
                  {[1, -1].map((l) => <mesh key={l} position={[0.2 * l, 0, 0]} rotation-z={Math.PI / 2} geometry={cilindro(0.05, 0.05, 0.04, 8)} material={mat("#6b7480", { metal: 0.6 })} />)}
                  <mesh position-y={0.25} geometry={cilindro(0.01, 0.01, 0.16, 4)} material={mat("#6b7480")} />
                  <mesh position-y={0.34} geometry={esfera(0.03, 0)} material={mat("#ff3b30", { emissivo: "#ff3b30", brilho: Math.sin(t * 4) > 0 ? 2 : 0.2 })} />
                </group>
              )}
              {/* olhos e sobrancelhas */}
              {!alien && !robo && !capaceteF1 && [1, -1].map((l) => (
                <group key={l} position={[0.075 * l, 0.17, 0.18]}>
                  <mesh geometry={esfera(0.028, 0)} scale={[1, pisca * (expressao === "choque" ? 1.35 : 1), 0.4]} material={mat(`#${OLHO.getHexString()}`)} />
                  <mesh position={[0, 0.06 + sob[0], 0.01]} rotation-z={sob[1] * l} geometry={caixa(0.07, 0.014, 0.02)} material={mat(corCabelo)} />
                </group>
              ))}
              {!robo && !capaceteF1 && <group position={[0, alien ? 0.04 : 0.07, alien ? 0.2 : 0.19]} scale={alien ? 0.6 : 1}><Boca e={expressao} abre={abre} /></group>}
              {roupa.extra === "headset" && (
                <group position-y={0.17}>
                  <mesh geometry={geo("arco", () => new THREE.TorusGeometry(0.215, 0.018, 4, 10, Math.PI))} material={mat("#1c1c22")} />
                  {[1, -1].map((l) => <mesh key={l} position={[0.205 * l, 0, 0]} rotation-z={Math.PI / 2} geometry={cilindro(0.06, 0.06, 0.05, 8)} material={mat(cor, { emissivo: cor, brilho: 0.6 })} />)}
                </group>
              )}
              {capaceteF1 && <group position-y={0.17}><CapaceteF1 r={0.25} /></group>}
              {roupa.extra === "motoboy" && (
                <group position-y={0.18}>
                  {/* capacete com a viseira levantada: a cara continua a ver-se */}
                  <mesh position={[0, 0.07, -0.08]} geometry={esfera(0.255, 1)} scale={[1.02, 0.98, 1.05]} material={mat("#c0392b", { aspereza: 0.3, metal: 0.2 })} />
                  <mesh position={[0, 0.2, 0.12]} rotation-x={-0.6} geometry={caixa(0.4, 0.05, 0.2)} material={mat("#1b2430", { aspereza: 0.1, metal: 0.5 })} />
                  <mesh position={[0, 0.07, -0.08]} scale={[1.03, 0.99, 1.06]} geometry={geo("faixa-capacete", () => new THREE.TorusGeometry(0.25, 0.02, 4, 16))} rotation-y={Math.PI / 2} material={mat("#f2f2f2")} />
                </group>
              )}
              {/* relojoeiro: lupa de relojoeiro presa ao olho direito */}
              {visual === "relojoeiro" && <mesh position={[-0.075, 0.17, 0.22]} rotation-x={Math.PI / 2} geometry={cilindro(0.032, 0.026, 0.07, 10)} material={mat("#5a5f68", { metal: 0.5 })} />}
              {astronauta && <mesh position-y={0.16} geometry={esfera(0.29, 1)} material={mat("#bfe3ff", { opacidade: 0.28, aspereza: 0.1, metal: 0.3 })} />}
              {roupa.extra === "mergulho" && <mesh position={[0, 0.17, 0.17]} geometry={caixa(0.34, 0.16, 0.1)} material={mat("#bfe9ff", { opacidade: 0.45, aspereza: 0.1 })} />}
              {roupa.extra === "mergulho" && <mesh position={[0.17, 0.05, 0.12]} rotation-x={0.3} geometry={cilindro(0.025, 0.025, 0.3, 5)} material={mat("#22252c")} />}
            </group>
          </group>
        </group>
      </group>
    </group>
  );
};

