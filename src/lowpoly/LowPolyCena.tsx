import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { Icone } from "../components/Icone";
import { useFontes } from "../components/motion";
import { TOPO, useMargem } from "../components/ui";
import { useEstilo } from "../estilos";
import { CenaLowPoly, ObjetoLowPoly, PersonagemLowPoly, Posicao3D } from "../types";
import { Ambiente, Hora } from "./ambiente";
import { Acao, Boneco, EXPRESSAO_DA_ACAO, poseEm } from "./Boneco";
import { Cidade } from "./Cidade";
import { Estadio } from "./Estadio";
import { Bioma, Natureza } from "./Natureza";
import { BuracoNegro, CORPOS, Escala, LuzEspaco, NomeCorpo, ORBITAS, Planeta, SistemaSolar, layoutEscala, posOrbita } from "./Espaco";
import { Estudio, Laboratorio } from "./Laboratorio";
import { Objeto, ObjetoCena, TipoObjeto, medidaDe, posicaoAgora } from "./Objetos";
import { resolverModelo } from "./Modelos";
import { CadeiraGamer, Quarto } from "./Quarto";
import { Corrida, FundoMar, PreHistoria } from "./Exteriores";
import { Abrigo, Hospital, Nave, SOFA_Z, SalaAula, SalaEstar } from "./Interiores";
import { clarao, raioOnda } from "./Nuclear";
import { PlanetaAlien } from "./SciFi";
import { DegrauPodio, ALTURA_PODIO } from "./F1";
import { Bolsa } from "./Financas";
import { EstudioJogos } from "./Gamedev";
import { BoutiqueLuxo, OficinaRelojoaria } from "./Relojoaria";

// interiores (fundo próprio, sem céu) e a cor de fundo de cada um
const INTERIORES: Partial<Record<CenaLowPoly["cenario"], string>> = {
  quarto: "#141722", laboratorio: "#dfe6ec", abrigo: "#2a2622", sala_aula: "#efe6cf", sala_estar: "#2a2420", hospital: "#dceeea", nave: "#05070d", fundo_mar: "#0b4a6e", bolsa: "#151b28", estudio_jogos: "#1b1d27", oficina_relojoaria: "#f3f3ef", boutique_luxo: "#123d2c",
};
import { clamp01, esfera, lerp, mat, suave } from "./util";
import { etapaTinta } from "../components/Aquarela";

// Cena 3D low poly: o roteiro descreve o cenário, a hora, as personagens (visual, ação, expressão, onde estão,
// para onde vão e para quem olham) e o plano de câmara; esta cena calcula tudo frame a frame. Nada é desenhado
// à mão por vídeo. Funciona em vertical (9:16) e no vídeo longo (16:9): o enquadramento adapta-se.

const SENTADO: Acao[] = ["sentar", "digitar"];
const LOOP: Acao[] = ["andar", "correr"];

type Estado = { x: number; z: number; rotY: number; acao: Acao; tAcao: number; sentado: boolean };

// lugares no palco. No vertical (ecrã estreito) as personagens ficam em diagonal, uma mais à frente,
// para caberem maiores; no 16:9 ficam lado a lado
const slot = (p: Posicao3D | undefined, i: number, n: number, S: number): [number, number] => {
  if (Array.isArray(p)) return p;
  const estreito = S < 1.5;
  if (p === "esquerda") return estreito ? [-0.7, 0.45] : [-S, 0];
  if (p === "direita") return estreito ? [0.7, -0.45] : [S, 0];
  if (p === "centro") return [0, 0];
  if (p === "fundo") return [0, -2.4];
  return estreito ? [(i - (n - 1) / 2) * 0.95, i % 2 ? -0.45 : 0.45] : [(i - (n - 1) / 2) * S, 0];
};
const OLHAR: Record<string, number> = { camera: 0, esquerda: -0.75, direita: 0.75, fundo: Math.PI };

// frente: para onde fica a câmara (0 = +z); "olhar: camera" vira a personagem para lá
const estadoDe = (p: PersonagemLowPoly, i: number, todos: PersonagemLowPoly[], t: number, S: number, frente = 0): Estado => {
  const acao = (p.acao ?? (p.destino ? "andar" : "parado")) as Acao;
  const [x0, z0] = slot(p.posicao, i, todos.length, S);
  const [x1, z1] = p.destino ? slot(p.destino, i, todos.length, S) : [x0, z0];
  const dist = Math.hypot(x1 - x0, z1 - z0);
  const v = acao === "correr" ? 3.6 : 1.4, t0 = 0.3;
  const prog = dist > 0.01 ? clamp01(((t - t0) * v) / dist) : 1;
  const chegada = t0 + dist / v;
  const movendo = dist > 0.01 && t >= t0 && prog < 1;
  const x = lerp(x0, x1, prog), z = lerp(z0, z1, prog);

  // para onde olha: câmara, um lado, ou outra personagem (rodado só 3/4 para a cara continuar a ver-se)
  let base = OLHAR[p.olhar ?? "camera"] === undefined ? undefined : OLHAR[p.olhar ?? "camera"] + frente;
  if (base === undefined) {
    const k = todos.findIndex((o) => o.nome && o.nome === p.olhar);
    if (k >= 0) { const [ox, oz] = slot(todos[k].destino ?? todos[k].posicao, k, todos.length, S); base = Math.atan2(ox - x, oz - z) * 0.7; } else base = 0;
  }
  if (acao === "chutar" && !p.olhar) base = 2.5; // remata para a baliza, de lado para a câmara
  const direcao = Math.atan2(x1 - x0, z1 - z0);
  let rotY = base;
  if (movendo) rotY = direcao;
  else if (dist > 0.01 && t >= chegada) rotY = lerp(direcao, base, suave((t - chegada) / 0.5));
  else if (dist > 0.01) rotY = lerp(base, direcao, suave((t - t0 + 0.3) / 0.3));

  const efetiva: Acao = movendo ? (acao === "correr" ? "correr" : "andar") : LOOP.includes(acao) ? "parado" : acao;
  const tAcao = dist > 0.01 && !movendo && t >= chegada ? t - chegada : t;
  return { x, z, rotY, acao: efetiva, tAcao, sentado: SENTADO.includes(efetiva) };
};

// a bola do remate: parada no pé, sai disparada no momento do chuto (0,68 s), em arco, e rola
const BolaRemate: React.FC<{ e: Estado }> = ({ e }) => {
  const dx = Math.sin(e.rotY), dz = Math.cos(e.rotY);
  const sx = e.x + dx * 0.5 - dz * 0.12, sz = e.z + dz * 0.5 + dx * 0.12;
  const dt = Math.max(0, e.tAcao - 0.68);
  const voo = Math.min(dt, 1.4);
  const y = Math.max(0.11, 0.11 + 5.5 * voo - 4.9 * voo * voo);
  const d = 15 * voo + 4 * Math.max(0, dt - 1.4);
  return <mesh position={[sx + dx * d, y, sz + dz * d]} rotation={[d * 2, 0, d]} geometry={esfera(0.11, 1)} material={mat("#f5f5f5")} />;
};

const Camara: React.FC<{ pos: THREE.Vector3; alvo: THREE.Vector3; fov: number }> = ({ pos, alvo, fov }) => {
  const cam = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  cam.position.copy(pos);
  cam.fov = fov; cam.near = 0.1; cam.far = 1500;
  cam.lookAt(alvo);
  cam.updateProjectionMatrix();
  return null;
};

// semTexto: só a imagem 3D (para o fundo das capas)
export const LowPolyCena: React.FC<{ cena: CenaLowPoly; cor: string; semTexto?: boolean }> = ({ cena, cor, semTexto }) => {
  const f = useCurrentFrame();
  const { fps, width: L, height: A } = useVideoConfig();
  const e = useEstilo();
  const { titulo } = useFontes();
  const MARGEM = useMargem();
  const vertical = A > L;
  const t = f / fps;
  const T = Math.max(1.5, (cena.duracaoMs ?? 4000) / 1000);
  const hora: Hora = cena.hora ?? "dia";
  const S = vertical ? 1.15 : 1.8;
  const cor2Estilo = e.cor2 ?? "#2d5bd6";
  const pessoas = (cena.personagens ?? []).slice(0, 6);
  // cidade com cogumelo e personagens: a câmara olha ao longo da rua (os prédios tapariam o céu) e o cogumelo fica no fim da rua
  const ruaComCogumelo = cena.cenario === "cidade" && pessoas.length > 0 && (cena.objetos ?? []).some((o) => o.tipo === "cogumelo");
  const frente = ruaComCogumelo ? 1.25 : 0;
  const estados = pessoas.map((p, i) => estadoDe(p, i, pessoas, t, S, frente));
  const planeta = cena.cenario === "planeta";
  const raioPlaneta = pessoas.length ? 7 : 4.2;
  const posPlaneta: [number, number, number] = pessoas.length ? [3, -2.5, -16] : [0, 0, 0];

  const espaco = cena.cenario === "espaco";
  const variante = cena.variante ?? (espaco ? "sistema_solar" : "");
  const interior = cena.cenario in INTERIORES;
  const noVazio = planeta || espaco || cena.cenario === "estudio" || cena.cenario === "planeta_alien" || interior;
  // objetos presos ao chão (animais, empresa, pilhas…) não se empilham: ficam lado a lado no chão
  const empilhar = vertical && noVazio && !pessoas.length && !(cena.objetos ?? []).some((o) => PRESOS_AO_CHAO.includes(o.tipo));
  const objetos: ObjetoCena[] = (cena.objetos ?? []).slice(0, 8).map((o, i, todos) => resolverObjeto(o, i, todos.length, S, planeta || espaco, cor, cor2Estilo, empilhar));
  // empilhados: assentam uns por cima dos outros a partir do chão (o primeiro da lista fica em cima)
  if (empilhar && objetos.length > 1) {
    const livres = objetos.map((o, i) => ({ o, i, solto: !Array.isArray(cena.objetos?.[i]?.posicao) }));
    let base = planeta || espaco ? -((livres.reduce((s, q) => s + medidaDe(q.o).tamanho * q.o.escala, 0)) / 2) : 0.25;
    for (const q of [...livres].reverse()) {
      if (!q.solto) continue;
      const tam = medidaDe(q.o).tamanho * q.o.escala;
      q.o.posicao = [q.o.posicao[0], base + tam / 2, q.o.posicao[2]];
      base += tam * 1.05;
    }
  }
  const larguraEscala = vertical ? 6 : 12;
  objetos.forEach((o, i) => {
    const pedido = cena.objetos?.[i];
    if (o.tipo === "cogumelo") {
      if (pedido?.escala === undefined) o.escala = 2;
      if (!Array.isArray(pedido?.posicao)) o.posicao = ruaComCogumelo ? [-170, 0, -40] : [pedido?.posicao === "esquerda" ? -40 : pedido?.posicao === "direita" ? 40 : 0, 0, -90];
    }
    if (o.tipo === "bomba" && pedido?.quando === undefined) o.quando = -1;
    if (o.tipo === "bombardeiro" && !Array.isArray(pedido?.posicao)) o.posicao = [0, 0, pessoas.length ? -25 : 0];
  });
  // efeitos do cogumelo na cena: clarão branco, onda de choque nos prédios e tremor da câmara
  const cogumelos = objetos.filter((o) => o.tipo === "cogumelo");
  const brilhoClarao = Math.max(0, ...cogumelos.map((o) => clarao(t, o.quando)));
  const ondaCidade = cogumelos[0] ? { x: cogumelos[0].posicao[0], z: cogumelos[0].posicao[2], raio: raioOnda(t, cogumelos[0].quando, cogumelos[0].escala) } : undefined;

  // boca a mexer só enquanto a narração diz uma palavra
  const ms = t * 1000;
  const aFalar = (cena.palavras ?? []).some((w) => ms >= w.inicioMs && ms <= w.fimMs);

  // ---------- câmara: enquadra quem está em cena (ou o cenário), conforme o plano e o formato ----------
  const plano = cena.plano ?? (pessoas.length || (cena.objetos ?? []).length ? "medio" : "aberto");
  const mov = cena.camera ?? "suave";
  const vfov = vertical ? 52 : 36;
  const tanV = Math.tan((vfov * Math.PI) / 360), tanH = tanV * (L / A);
  const k = clamp01(t / T);
  const alvo = new THREE.Vector3();
  let H: number, W: number, inclina: number;
  // focos dos objetos: posição (inicial, ou atual com a câmara "seguir") e tamanho
  const AO_FUNDO = ["cogumelo", "bombardeiro"];
  const focos = objetos.filter((o) => !(pessoas.length && AO_FUNDO.includes(o.tipo))).map((o) => ({
    p: ((q: [number, number, number]): [number, number, number] => PRESOS_AO_CHAO.includes(o.tipo) ? [q[0], q[1] + medidaDe(o).centro * o.escala, q[2]] : q)(
      mov === "seguir" || ["foguetao", "missil", "cogumelo", "bombardeiro", "carro_f1"].includes(o.tipo) ? posicaoAgora(o, t) : o.posicao),
    r: (medidaDe(o).tamanho * o.escala) / 2,
  }));
  if (pessoas.length) {
    // para planos estáveis usa o início e o fim do percurso; a câmara "seguir" usa a posição atual
    const xs = pessoas.flatMap((p, i) => {
      const a = slot(p.posicao, i, pessoas.length, S), b = p.destino ? slot(p.destino, i, pessoas.length, S) : a;
      return mov === "seguir" ? [estados[i].x] : [a[0], b[0]];
    });
    const zs = mov === "seguir" ? estados.map((s) => s.z) : pessoas.flatMap((p, i) => [slot(p.posicao, i, pessoas.length, S)[1], slot(p.destino ?? p.posicao, i, pessoas.length, S)[1]]);
    focos.forEach((q) => xs.push(q.p[0] - q.r, q.p[0] + q.r));
    const span = Math.max(...xs) - Math.min(...xs);
    const sentado = estados.every((s) => s.sentado);
    const principal = estados[Math.max(0, pessoas.findIndex((p) => p.fala))];
    if (plano === "close") {
      const cabecaAlta = pessoas[Math.max(0, pessoas.findIndex((p) => p.fala))]?.visual === "alienigena" ? 0.14 : 0; // a cabeça do alienígena é mais alta
      alvo.set(principal.x, (sentado ? 1.15 : 1.58) + cabecaAlta, principal.z); H = 1.05 + cabecaAlta; W = 0.95; inclina = 0.05;
    } else if (plano === "medio") {
      alvo.set((Math.max(...xs) + Math.min(...xs)) / 2, sentado ? 0.8 : 0.98, (Math.max(...zs) + Math.min(...zs)) / 2); H = 2.5; W = span + (vertical ? 1.1 : 1.5) + (interior ? 0.9 : 0); inclina = 0.12;
    } else {
      alvo.set((Math.max(...xs) + Math.min(...xs)) / 2, 1.4, (Math.max(...zs) + Math.min(...zs)) / 2 - 0.5); H = 6; W = span + 4.5; inclina = 0.24;
    }
    if (planeta) inclina = 0.02;
    if (pessoas.some((p) => p.acao === "flutuar")) alvo.y += 0.4;
    // cogumelo ao fundo: câmara baixa, a olhar para cima, para o céu (e o cogumelo) entrar no plano
    if (objetos.some((o) => o.tipo === "cogumelo")) { inclina = -0.2; alvo.y += plano === "close" ? 0.1 : 0.5; }
    const topo = Math.max(0, ...focos.map((q) => q.p[1] + q.r));
    if (plano !== "close" && topo > H * 0.8) { H = topo * 1.25; alvo.y = topo / 2; }
  } else if (focos.length) {
    // só objetos: enquadra a caixa que os contém
    const xs = focos.flatMap((q) => [q.p[0] - q.r, q.p[0] + q.r]), ys = focos.flatMap((q) => [q.p[1] - q.r, q.p[1] + q.r]), zs = focos.map((q) => q.p[2]);
    const largura = Math.max(...xs) - Math.min(...xs), altura = Math.max(...ys) - Math.min(...ys);
    const fator = plano === "close" ? 1.05 : plano === "medio" ? 1.35 : 1.9;
    alvo.set((Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2, (Math.max(...zs) + Math.min(...zs)) / 2);
    H = altura * fator; W = largura * fator; inclina = noVazio ? 0.1 : 0.18;
  } else {
    const padrao: Record<CenaLowPoly["cenario"], [number, number, number, number]> = {
      estadio: [0, 2.2, -8, 13], cidade: [0, 5, -10, 17], quarto: [0, 1.3, -1.5, 3.6], natureza: [0, 7, -35, 32], planeta: [0, 0, 0, raioPlaneta * (cena.variante === "saturno" ? 5.2 : 3.3)],
      espaco: [0, 0, 0, 10], laboratorio: [0, 1.4, -1.6, 3.4], estudio: [0, 1.2, 0, 4],
      fundo_mar: [0, 2.5, -9, 9], pre_historia: [0, 2.8, -9, 11], corrida: [0, 1.5, -5, 7], sala_aula: [0, 1.5, -1.6, 3.6],
      sala_estar: [0, 1.2, -1.4, 3.4], hospital: [1, 1.3, -1.4, 3.6], nave: [0, 1.7, -2, 4.2], planeta_alien: [0, 3, -10, 12], abrigo: [0, 1.3, -1.4, 3.6], bolsa: [0, 2.0, -2.2, 4.6], estudio_jogos: [0, 1.6, -1.6, 3.8], oficina_relojoaria: [0, 1.6, -1.6, 3.8], boutique_luxo: [0, 1.6, -1.6, 3.8],
    };
    const [x, y, z, h] = padrao[cena.cenario] ?? padrao.estadio;
    alvo.set(x, y, z); H = h; W = planeta ? h * 0.95 : h * 0.8; inclina = planeta ? 0 : 0.16;
    if (espaco && variante === "sistema_solar") { H = vertical ? 34 : 26; W = vertical ? 30 : 46; inclina = vertical ? 1.0 : 0.55; }
    if (espaco && variante === "buraco_negro") { H = 10; W = 15; inclina = 0.04; }
    if (espaco && variante === "escala") {
      const corpos = layoutEscala(escalaCorpos(cena), larguraEscala);
      H = Math.max(...corpos.map((c) => c.raio)) * 2 * 1.5; W = larguraEscala * 1.15; inclina = 0;
    }
  }
  let d = Math.max(H / (2 * tanV), W / (2 * tanH));
  let yaw = planeta || espaco ? 0 : ruaComCogumelo ? frente : 0.16;
  if (mov === "suave") d *= 1 - 0.07 * k;
  if (mov === "aproximar") d *= 1 - 0.25 * suave(k);
  if (mov === "afastar") d *= 1 + 0.3 * suave(k);
  if (mov === "orbitar") yaw += -0.55 + 1.1 * suave(k);
  if (mov === "travelling") alvo.x += (k - 0.5) * W * 0.35;
  const posCam = new THREE.Vector3(
    alvo.x + d * Math.sin(yaw) * Math.cos(inclina),
    alvo.y + d * Math.sin(inclina),
    alvo.z + d * Math.cos(yaw) * Math.cos(inclina),
  );
  // a onda de choque, ao passar pela câmara, abana-a
  for (const o of cogumelos) {
    const dist = Math.hypot(posCam.x - o.posicao[0], posCam.z - o.posicao[2]);
    const passou = raioOnda(t, o.quando, o.escala) - dist;
    if (passou > 0 && passou < 90) {
      const forca = (1 - passou / 90) * 0.35;
      const j = new THREE.Vector3(Math.sin(t * 53) * forca, Math.cos(t * 47) * forca, Math.sin(t * 41) * forca * 0.5);
      posCam.add(j); alvo.add(j.multiplyScalar(0.6));
    }
  }
  // no vertical a legenda ocupa o terço de baixo: a câmara desce o olhar para as personagens ficarem um pouco acima do meio
  if (vertical && pessoas.length && plano !== "aberto") { alvo.y -= H * 0.08; posCam.y -= H * 0.08; }

  const cor2 = e.cor2 ?? "#2d5bd6";
  const podio = cena.cenario === "corrida" && variante === "podio";
  objetos.forEach((o) => { if (o.tipo === "carro_f1" && cena.cenario === "corrida" && variante === "chuva") o.chuva = true; });
  const festa = cena.festa || pessoas.some((p) => p.acao === "celebrar" || p.acao === "torcer") ? 1 : 0;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* estilo aquarela: o 3D é pintado a tinta e aguada (o filtro está em components/Aquarela.tsx);
          estilo Pixel 3D: só o 3D fica em pixel com dithering (título, etiquetas e legendas por cima, nítidos) */}
      <div style={{ position: "absolute", inset: 0, filter: e.textura === "aquarela" ? `url(#aquarela-${etapaTinta(f)})` : e.pixel ? "url(#pixel)" : undefined }}>
      <ThreeCanvas width={L} height={A} gl={{ antialias: true, preserveDrawingBuffer: true }} camera={{ fov: vfov, position: [0, 2, 8], near: 0.1, far: 1500 }} style={{ position: "absolute", inset: 0 }}>
        <Camara pos={posCam} alvo={alvo} fov={vfov} />
        {noVazio && (
          <color attach="background" args={[planeta || espaco ? "#02030a" : cena.cenario === "planeta_alien" ? "#2a0f4a" : INTERIORES[cena.cenario] ?? new THREE.Color(e.fundo).lerp(new THREE.Color("#0b0d14"), 0.6).getStyle()]} />
        )}
        {!noVazio && <Ambiente hora={hora} t={t} perto={cogumelos.length ? 220 : cena.cenario === "natureza" ? 60 : 45} longe={cogumelos.length ? 1100 : cena.cenario === "natureza" ? 320 : 230} />}
        {cena.cenario === "estadio" && <Estadio hora={hora} t={t} festa={festa} cor={cor} cor2={cor2} />}
        {cena.cenario === "cidade" && <Cidade hora={hora} t={t} ruinas={variante === "ruinas"} onda={ondaCidade} />}
        {cena.cenario === "cidade" && variante === "ruinas" && <fog attach="fog" args={["#8a7464", 25, 170]} />}
        {cena.cenario === "quarto" && <Quarto hora={hora} t={t} cor={cor} cor2={cor2} />}
        {cena.cenario === "natureza" && <Natureza hora={hora} t={t} bioma={(cena.variante as Bioma) ?? "floresta"} />}
        {planeta && <Planeta t={t} tipo={(cena.variante as NomeCorpo) ?? "terra"} raio={raioPlaneta} posicao={posPlaneta} />}
        {espaco && variante === "sistema_solar" && <SistemaSolar t={t} />}
        {espaco && variante === "buraco_negro" && <BuracoNegro t={t} />}
        {espaco && variante === "escala" && <Escala t={t} corpos={escalaCorpos(cena)} largura={larguraEscala} />}
        {espaco && !["sistema_solar", "buraco_negro", "escala"].includes(variante) && <LuzEspaco t={t} />}
        {cena.cenario === "laboratorio" && <Laboratorio t={t} cor={cor} cor2={cor2Estilo} />}
        {cena.cenario === "estudio" && <Estudio cor={cor} cor2={cor2Estilo} fundo={e.fundo} />}
        {cena.cenario === "fundo_mar" && <FundoMar t={t} />}
        {cena.cenario === "pre_historia" && <PreHistoria t={t} comDinos={cena.variante !== "sem_dinossauros"} />}
        {cena.cenario === "corrida" && <Corrida t={t} cor={cor} cor2={cor2Estilo} variante={variante} />}
        {cena.cenario === "sala_aula" && <SalaAula t={t} hora={hora} cor={cor} />}
        {cena.cenario === "sala_estar" && <SalaEstar t={t} hora={hora} cor={cor} cor2={cor2Estilo} />}
        {cena.cenario === "hospital" && <Hospital t={t} hora={hora} />}
        {cena.cenario === "nave" && <Nave t={t} cor={cor} />}
        {cena.cenario === "abrigo" && <Abrigo t={t} />}
        {cena.cenario === "oficina_relojoaria" && <OficinaRelojoaria t={t} cor={cor} />}
        {cena.cenario === "boutique_luxo" && <BoutiqueLuxo t={t} />}
        {cena.cenario === "estudio_jogos" && <EstudioJogos t={t} cor={cor} cor2={cor2Estilo} />}
        {cena.cenario === "bolsa" && <Bolsa t={t} variante={variante} cor={cor} />}
        {cena.cenario === "planeta_alien" && <PlanetaAlien t={t} />}
        {objetos.map((o, i) => <Objeto key={i} o={o} t={t} />)}

        {pessoas.map((p, i) => {
          const s = estados[i];
          const acao = s.acao;
          const expressao = p.expressao ?? EXPRESSAO_DA_ACAO[acao] ?? (p.acao ? EXPRESSAO_DA_ACAO[p.acao as Acao] : undefined) ?? "neutro";
          const visual = p.visual ?? (planeta || espaco ? "astronauta" : cena.cenario === "estadio" ? "jogador" : cena.cenario === "quarto" ? "gamer" : cena.cenario === "laboratorio" ? "cientista" : cena.cenario === "fundo_mar" ? "mergulhador" : cena.cenario === "hospital" ? "medico" : cena.cenario === "nave" ? "astronauta" : cena.cenario === "planeta_alien" ? "alienigena" : cena.cenario === "bolsa" ? "executivo" : cena.cenario === "estudio_jogos" ? "gamer" : cena.cenario === "oficina_relojoaria" ? "relojoeiro" : cena.cenario === "boutique_luxo" ? "executivo" : cena.cenario === "corrida" ? (variante === "boxes" && i > 0 ? "mecanico" : "piloto") : "pessoa");
          const corP = p.cor ?? (visual === "arbitro" ? "#f2d21b" : i % 2 ? cor2 : cor);
          const segura = p.segura ?? (acao === "cartao" ? "cartao_amarelo" : acao === "apitar" ? "apito" : undefined);
          return (
            <group key={i}>
              {podio && lugarPodio(p, i) > 0 && <group position={[s.x, 0, s.z]}><DegrauPodio lugar={lugarPodio(p, i)} cor={cor} /></group>}
              <group position={[s.x, planeta || espaco ? 0.6 : podio ? ALTURA_PODIO[lugarPodio(p, i)] ?? 0 : 0, s.sentado && cena.cenario === "sala_estar" ? SOFA_Z + 0.3 : s.z]} rotation-y={s.rotY}>
                {s.sentado && cena.cenario !== "sala_estar" && <group position-z={-0.05}><CadeiraGamer cor={corP} /></group>}
                <Boneco pose={poseEm(acao, s.tAcao, i * 1.7)} expressao={expressao} visual={visual} cor={corP} pele={p.pele} cabelo={p.cabelo}
                  semente={`${p.nome ?? ""}${i}${visual}`} t={t} fala={p.fala && aFalar} segura={segura} />
              </group>
              {acao === "chutar" && <BolaRemate e={s} />}
            </group>
          );
        })}
      </ThreeCanvas>
      </div>

      {/* clarão da detonação: o ecrã fica branco e volta aos poucos */}
      {brilhoClarao > 0.01 && <div style={{ position: "absolute", inset: 0, background: "#fffaf0", opacity: brilhoClarao, pointerEvents: "none" }} />}
      {/* etiquetas 3D: presas a um ponto do mundo, projetadas com a mesma câmara */}
      {!semTexto && (() => {
        const cam = new THREE.PerspectiveCamera(vfov, L / A, 0.1, 1500);
        cam.position.copy(posCam); cam.lookAt(alvo); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
        const marcas: { texto: string; p: [number, number, number] }[] = [];
        objetos.forEach((o, i) => {
          const r = cena.objetos?.[i]?.rotulo;
          if (!r) return;
          const [x, y, z] = posicaoAgora(o, t);
          marcas.push({ texto: r, p: [x, y + (medidaDe(o).tamanho * o.escala) / 2, z] });
        });
        pessoas.forEach((p, i) => { if (p.rotulo) marcas.push({ texto: p.rotulo, p: [estados[i].x, estados[i].sentado ? 1.55 : 2.05, estados[i].z] }); });
        if (espaco && variante === "escala" && cena.rotulos !== false)
          layoutEscala(escalaCorpos(cena), larguraEscala).forEach((c) => marcas.push({ texto: CORPOS[c.nome].nome, p: [c.posicao[0], c.raio, 0] }));
        if (espaco && variante === "sistema_solar" && cena.rotulos)
          ORBITAS.forEach((o) => { const [x, y, z] = posOrbita(o, t); marcas.push({ texto: CORPOS[o.nome].nome, p: [x, y + o.raio, z] }); });
        const s = suave((f - 12) / 10);
        return marcas.map((m, i) => {
          const v = new THREE.Vector3(...m.p).project(cam);
          if (v.z > 1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2) return null;
          const x = ((v.x + 1) / 2) * L, y = ((1 - v.y) / 2) * A;
          const sobe = (vertical ? 70 : 56) + (i % 2) * (vertical ? 90 : 70); // alternadas, para não se taparem
          const meia = (m.texto.length * (vertical ? 24 : 21) + 40) / 2;
          const desvio = Math.min(L - 30 - meia - x, Math.max(30 + meia - x, 0));
          return (
            <div key={i} style={{ position: "absolute", left: x, top: y, opacity: s, pointerEvents: "none" }}>
              <div style={{ position: "absolute", left: -6, top: -6, width: 12, height: 12, borderRadius: 99, background: cor, boxShadow: `0 0 12px ${cor}` }} />
              <div style={{ position: "absolute", left: -1.5, top: -sobe * s, width: 3, height: sobe * s, background: `${cor}cc` }} />
              <div style={{ position: "absolute", left: 0, top: -sobe * s, transform: `translate(calc(-50% + ${desvio}px), -100%)`, whiteSpace: "nowrap", padding: "8px 18px", borderRadius: 12, background: "#0b0d12e6", border: `3px solid ${cor}`, color: "#fff", fontFamily: titulo, fontSize: vertical ? 40 : 34, textTransform: "uppercase" }}>
                {m.texto}
              </div>
            </div>
          );
        });
      })()}

      {/* título e etiqueta (as legendas da narração vêm por baixo, como nas outras cenas) */}
      {cena.titulo && !semTexto && (
        <div style={{ position: "absolute", top: vertical ? TOPO : 60, left: MARGEM, right: MARGEM, textAlign: vertical ? "center" : "left", fontFamily: titulo, fontSize: vertical ? 76 : 64, lineHeight: 1.05, textTransform: "uppercase", color: "#fff", textShadow: "0 6px 0 #000a, 0 0 30px #000c", opacity: clamp01((f - 2) / 6) }}>
          {cena.titulo}
          <div style={{ width: 120, height: 8, background: cor, margin: vertical ? "16px auto 0" : "16px 0 0", borderRadius: e.raio }} />
        </div>
      )}
      {cena.etiqueta && !semTexto && (() => {
        const s = suave((f - 10) / 8);
        const marca = cena.etiqueta.marca;
        const corM = marca === "errado" ? "#ef4444" : marca === "certo" ? "#22c55e" : cor;
        return (
          <div style={{ position: "absolute", top: vertical ? (cena.titulo ? TOPO + 230 : TOPO) : (cena.titulo ? 220 : 60), left: 0, right: 0, display: "flex", justifyContent: vertical ? "center" : "flex-start", paddingLeft: vertical ? 0 : MARGEM }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 26px", borderRadius: 999, background: "#0b0d12e6", border: `4px solid ${corM}`, color: "#fff", fontFamily: titulo, fontSize: vertical ? 50 : 44, textTransform: "uppercase", transform: `scale(${0.6 + 0.4 * s})`, opacity: s, boxShadow: "0 10px 30px #0008" }}>
              {marca && <Icone nome={marca === "errado" ? "x" : "check"} tamanho={vertical ? 46 : 40} cor={corM} traco={3.5} />}
              {cena.etiqueta.texto}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// lugar no pódio: centro = 1.º, esquerda = 2.º, direita = 3.º; sem posição, pela ordem da lista
const lugarPodio = (p: PersonagemLowPoly, i: number) =>
  p.posicao === "centro" ? 1 : p.posicao === "esquerda" ? 2 : p.posicao === "direita" ? 3 : Array.isArray(p.posicao) ? 0 : i < 3 ? i + 1 : 0;

// corpos a comparar na variante "escala" (padrão: Terra, Júpiter e Sol)
const escalaCorpos = (cena: CenaLowPoly) =>
  ((cena.corpos?.length ? cena.corpos : ["terra", "jupiter", "sol"]).filter((c) => c in CORPOS) as NomeCorpo[]);

// objetos que assentam no chão (o resto flutua à altura do centro)
const NO_CHAO: TipoObjeto[] = ["lingotes", "fundicao", "maquina_cnc", "tanque_agua", "console", "tv", "arte_3d", "nivel", "bug", "modelo", "touro", "urso", "moedas", "dinheiro", "empresa", "carro_f1", "foguetao", "vulcao", "explosao", "fogo", "fumo", "asteroide", "bola", "tiranossauro", "braquiossauro", "ovni", "vaca", "cristal", "portal"];
// desenhados a partir do chão (o centro para a câmara fica à altura de MEDIDAS.centro)
const PRESOS_AO_CHAO: TipoObjeto[] = ["lingotes", "fundicao", "maquina_cnc", "tanque_agua", "console", "tv", "arte_3d", "nivel", "bug", "modelo", "tiranossauro", "braquiossauro", "ovni", "vaca", "cristal", "portal", "cogumelo", "missil", "bombardeiro", "radiacao", "touro", "urso", "moedas", "dinheiro", "empresa", "carro_f1"];
const SOLIDOS: TipoObjeto[] = ["cubo", "esfera", "piramide", "cilindro", "cone", "dodecaedro", "icosaedro", "toro"];
// empilhar = vertical sem chão nem personagens (estúdio, laboratório, espaço): os objetos ficam uns por cima dos outros,
// em ziguezague, para caberem maiores no ecrã estreito
const resolverObjeto = (o: ObjetoLowPoly, i: number, n: number, S: number, semChao: boolean, cor: string, cor2: string, empilhar = false): ObjetoCena => {
  const escala = o.escala ?? 1;
  const modelo = o.tipo === "modelo" ? resolverModelo(o.modelo) : undefined;
  const m = medidaDe({ tipo: o.tipo, modelo });
  let x = 0, y = NO_CHAO.includes(o.tipo) && !semChao ? 0 : m.centro * escala, z = 0;
  const p = o.posicao;
  if (Array.isArray(p) && p.length === 3) [x, y, z] = p as [number, number, number];
  else if (Array.isArray(p)) [x, z] = p as [number, number];
  else {
    // modelos pequenos (comida, objetos de mesa) ficam juntos: o espaço entre eles segue o tamanho e não o das personagens
    const passo = Math.max(o.tipo === "modelo" ? Math.min(S, m.tamanho * escala * 1.4) : S, m.tamanho * escala * (empilhar ? 1.1 : 0.65));
    if (empilhar && n > 1 && p !== "fundo") {
      const k = p === "esquerda" ? 0 : p === "direita" ? 1 : p === "centro" ? (n - 1) / 2 : i;
      x = (k % 2 ? 1 : -1) * passo * 0.25;
      y = 1.3 + ((n - 1) / 2 - k) * passo * 0.95;
    } else if (p === "esquerda") x = -passo; else if (p === "direita") x = passo; else if (p === "fundo") z = -3; else if (p !== "centro") x = (i - (n - 1) / 2) * passo;
  }
  return { tipo: o.tipo, posicao: [x, y, z], escala, quando: o.quando ?? (SOLIDOS.includes(o.tipo) ? 0.2 : 1), cor: o.cor ?? (o.tipo === "relogio" ? "#14233f" : cor), cor2: o.cor2 ?? cor2, variante: o.variante, girar: true, modelo, rotacao: o.rotacao };
};
