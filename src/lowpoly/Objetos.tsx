import { useMemo } from "react";
import * as THREE from "three";
import { Efeito } from "./Efeitos";
import { Braquiossauro, Cardume, PeixeGrande, Pterossauro, Tiranossauro } from "./Animais";
import { Cristais, Ovni, Portal, Vaca } from "./SciFi";
import { Bomba, Bombardeiro, Cogumelo, Missil, Radiacao, alturaMissil } from "./Nuclear";
import { CarroF1 } from "./F1";
import { Dinheiro, Empresa, Moedas, Seta, Touro, Urso, Velas } from "./Financas";
import { ModeloGlb, dimsModelo } from "./Modelos";
import { Engrenagens, Escape, Fundicao, Lingotes, MaquinaCnc, Mecanismo, MolaReal, Relogio, Rubi, TanqueAgua } from "./Relojoaria";
import { Arte3D, Bug, Codigo, Comando, Consola, Fonte, Memoria, MotorJogo, Nivel, PlacaGrafica, PlacaMae, Processador, Som, Ssd, Tv, Ventoinha } from "./Gamedev";
import { caixa, cilindro, clamp01, cone, entre, esfera, geo, mat, rng, sai, suave } from "./util";

// Objetos animados para ciência, espaço e matemática. Cada um vive no seu sítio (`posicao`) e reage ao tempo:
// o foguetão descola em `quando`, o asteroide cai e explode em `quando`, o vulcão entra em erupção em `quando`,
// os sólidos constroem-se aresta a aresta. `tamanho` diz quanto espaço ocupam (a câmara usa-o para enquadrar).

export type TipoObjeto =
  | "foguetao" | "satelite" | "estacao" | "asteroide" | "atomo" | "molecula" | "adn" | "celula" | "vulcao"
  | "cubo" | "esfera" | "piramide" | "cilindro" | "cone" | "dodecaedro" | "icosaedro" | "toro" | "superficie" | "eixos"
  | "explosao" | "fogo" | "fumo" | "bola" | "trofeu" | "frasco" | "tiranossauro" | "braquiossauro" | "pterossauro" | "tubarao" | "baleia" | "cardume" | "ovni" | "vaca" | "cristal" | "portal" | "cogumelo" | "bomba" | "missil" | "bombardeiro" | "radiacao" | "carro_f1" | "velas" | "seta" | "touro" | "urso" | "moedas" | "dinheiro" | "empresa" | "modelo" | "placa_mae" | "processador" | "placa_de_video" | "memoria_ram" | "ssd" | "cooler" | "fonte" | "console" | "controle" | "tv" | "codigo" | "motor_jogo" | "arte_3d" | "som" | "nivel" | "bug" | "relogio" | "mecanismo" | "engrenagens" | "escape" | "mola_real" | "rubi" | "lingotes" | "fundicao" | "maquina_cnc" | "tanque_agua";

export type ObjetoCena = {
  tipo: TipoObjeto; posicao: [number, number, number]; escala: number; quando: number; cor: string; cor2: string;
  variante?: string; // molecula: agua | co2 | metano | oxigenio; superficie: onda | sela | paraboloide | gaussiana | seno
  girar: boolean;
  modelo?: string; // id do catálogo (já resolvido) para o tipo "modelo"
  rotacao?: number; // graus à volta do eixo vertical
  chuva?: boolean; // carro_f1 na pista à chuva: spray atrás das rodas
};

// tamanho aproximado (diâmetro, em metros) à escala 1, e a altura do centro acima do chão
export const MEDIDAS: Record<TipoObjeto, { tamanho: number; centro: number }> = {
  foguetao: { tamanho: 4.5, centro: 2.2 }, satelite: { tamanho: 2.6, centro: 1.6 }, estacao: { tamanho: 4, centro: 1.8 }, asteroide: { tamanho: 7, centro: 0.6 },
  atomo: { tamanho: 2.2, centro: 1.4 }, molecula: { tamanho: 1.8, centro: 1.4 }, adn: { tamanho: 3.4, centro: 1.7 }, celula: { tamanho: 2.2, centro: 1.4 },
  vulcao: { tamanho: 8, centro: 2 }, cubo: { tamanho: 1.6, centro: 1.3 }, esfera: { tamanho: 1.6, centro: 1.3 }, piramide: { tamanho: 1.7, centro: 1.3 },
  cilindro: { tamanho: 1.6, centro: 1.3 }, cone: { tamanho: 1.7, centro: 1.3 }, dodecaedro: { tamanho: 1.6, centro: 1.3 }, icosaedro: { tamanho: 1.6, centro: 1.3 },
  toro: { tamanho: 1.8, centro: 1.3 }, superficie: { tamanho: 4, centro: 0.9 }, eixos: { tamanho: 3, centro: 0.9 },
  explosao: { tamanho: 6, centro: 1.5 }, fogo: { tamanho: 2, centro: 1 }, fumo: { tamanho: 4, centro: 2 }, bola: { tamanho: 0.6, centro: 0.11 },
  trofeu: { tamanho: 1, centro: 1.2 }, frasco: { tamanho: 0.8, centro: 1.2 },
  tiranossauro: { tamanho: 7, centro: 2.3 }, braquiossauro: { tamanho: 12, centro: 5 }, pterossauro: { tamanho: 4, centro: 3 },
  tubarao: { tamanho: 4, centro: 2 }, baleia: { tamanho: 9, centro: 3 }, cardume: { tamanho: 5, centro: 2.5 },
  ovni: { tamanho: 11, centro: 0 }, vaca: { tamanho: 2, centro: 0.8 }, cristal: { tamanho: 2.4, centro: 1 }, portal: { tamanho: 3.8, centro: 1.7 },
  cogumelo: { tamanho: 48, centro: 0 }, bomba: { tamanho: 3.2, centro: 1.6 }, missil: { tamanho: 9, centro: 0 }, bombardeiro: { tamanho: 16, centro: 0 }, radiacao: { tamanho: 2.6, centro: 0 },
  carro_f1: { tamanho: 5, centro: 0.5 },
  velas: { tamanho: 4.4, centro: 1.5 }, seta: { tamanho: 2.4, centro: 1.4 }, touro: { tamanho: 2.6, centro: 0.9 }, urso: { tamanho: 2.4, centro: 0.9 },
  moedas: { tamanho: 1.4, centro: 0.5 }, dinheiro: { tamanho: 1.4, centro: 0.3 }, empresa: { tamanho: 5, centro: 2.4 },
  modelo: { tamanho: 2, centro: 1 },
  placa_mae: { tamanho: 3.1, centro: 1.6 }, processador: { tamanho: 1.6, centro: 1.4 }, placa_de_video: { tamanho: 2.9, centro: 1.5 }, memoria_ram: { tamanho: 2.8, centro: 1.4 },
  ssd: { tamanho: 3.2, centro: 1.4 }, cooler: { tamanho: 1.7, centro: 1.4 }, fonte: { tamanho: 2.6, centro: 1.3 }, console: { tamanho: 2.8, centro: 0.35 },
  controle: { tamanho: 1.6, centro: 1.3 }, tv: { tamanho: 3.3, centro: 1.3 }, codigo: { tamanho: 2.9, centro: 1.6 }, motor_jogo: { tamanho: 3.1, centro: 1.6 },
  arte_3d: { tamanho: 2.2, centro: 1.1 }, som: { tamanho: 2.6, centro: 1.4 }, nivel: { tamanho: 6.6, centro: 0.8 }, bug: { tamanho: 1.4, centro: 0.4 },
  relogio: { tamanho: 3.2, centro: 1.6 }, mecanismo: { tamanho: 1.8, centro: 1.4 }, engrenagens: { tamanho: 2.6, centro: 1.4 }, escape: { tamanho: 2.1, centro: 1.4 },
  mola_real: { tamanho: 1.7, centro: 1.4 }, rubi: { tamanho: 0.9, centro: 1.3 }, lingotes: { tamanho: 1.3, centro: 0.2 }, fundicao: { tamanho: 2.6, centro: 1 },
  maquina_cnc: { tamanho: 2.6, centro: 1.2 }, tanque_agua: { tamanho: 2.1, centro: 1 },
};

// medidas de um objeto (o "modelo" tem as do ficheiro, em metros)
export const medidaDe = (o: { tipo: TipoObjeto; modelo?: string }) => {
  if (o.tipo !== "modelo") return MEDIDAS[o.tipo] ?? { tamanho: 1, centro: 1 };
  const [l, a, p] = dimsModelo(o.modelo);
  return { tamanho: Math.max(l, a, p), centro: a / 2 };

};

// velocidade do carro de F1 com variante "andar" (m/s)
export const VEL_F1 = 24;
// onde está o objeto agora (o foguetão sobe; o asteroide vem do céu)
export const posicaoAgora = (o: ObjetoCena, t: number): [number, number, number] => {
  const [x, y, z] = o.posicao;
  if (o.tipo === "foguetao") { const d = Math.max(0, t - o.quando); return [x, y + 1.6 * d * d * o.escala, z]; }
  if (o.tipo === "carro_f1" && o.variante === "andar") return [x + VEL_F1 * (t - o.quando) * o.escala, y, z];
  if (o.tipo === "missil") return [x, y + (alturaMissil(t, o.quando) + 4) * o.escala, z];
  if (o.tipo === "cogumelo") return [x, y + 18 * o.escala, z];
  if (o.tipo === "bombardeiro") return [x, y + 18 * o.escala, z];
  if (o.tipo === "asteroide") { const k = entre(t, o.quando - 1.6, o.quando); return [x - 14 * (1 - k) * o.escala, y + 20 * (1 - k) * o.escala, z - 6 * (1 - k) * o.escala]; }
  return [x, y, z];
};

// ---------- espaço ----------
const Foguetao: React.FC<{ o: ObjetoCena; t: number }> = ({ o, t }) => {
  const voo = Math.max(0, t - o.quando);
  const tremor = voo > 0 || t > o.quando - 0.8 ? Math.sin(t * 60) * 0.015 : 0;
  return (
    <group>
      {/* plataforma (fica no chão) */}
      <group position={[0, -o.posicao[1] / o.escala, 0]}>
        <mesh position-y={0.15} geometry={caixa(3.2, 0.3, 3.2)} material={mat("#5a5f68")} />
        <mesh position={[1.3, 2.4, 0]} geometry={caixa(0.3, 4.6, 0.3)} material={mat("#c94a2a")} />
      </group>
      <group position={[tremor, 1.6 * voo * voo, 0]}>
        <mesh position-y={1.9} geometry={cilindro(0.42, 0.45, 3, 10)} material={mat("#f2f2f2")} />
        <mesh position-y={3.85} geometry={cone(0.42, 0.9, 10)} material={mat(o.cor)} />
        <mesh position={[0, 2.6, 0.41]} rotation-x={Math.PI / 2} geometry={cilindro(0.14, 0.14, 0.05, 10)} material={mat("#7fc4ff", { emissivo: "#7fc4ff", brilho: 0.6 })} />
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[Math.cos(i * Math.PI / 2) * 0.5, 0.7, Math.sin(i * Math.PI / 2) * 0.5]} rotation-y={-i * Math.PI / 2} geometry={caixa(0.35, 0.8, 0.06)} material={mat(o.cor)} />
        ))}
        <mesh position-y={0.3} geometry={cilindro(0.3, 0.4, 0.3, 8)} material={mat("#3a3d44", { metal: 0.5 })} />
        {voo > 0 && (
          <mesh position-y={-0.6 - 0.4 * Math.sin(t * 40)} rotation-x={Math.PI} geometry={cone(0.38, 1.6 + 0.4 * Math.sin(t * 31), 8)}>
            <meshBasicMaterial color="#ffb02a" transparent opacity={0.9} />
          </mesh>
        )}
        {voo > 0 && <Efeito tipo="fogo" t={t} quando={o.quando} posicao={[0, 0.1, 0]} escala={0.9} />}
      </group>
      {/* fumo da descolagem, que fica na plataforma */}
      <group position={[0, -o.posicao[1] / o.escala, 0]}>
        <Efeito tipo="fumo" t={t} quando={o.quando - 0.6} duracao={3} posicao={[0, 0.3, 0]} escala={1.1} semente={3} />
      </group>
    </group>
  );
};

const Satelite: React.FC<{ o: ObjetoCena; t: number }> = ({ t }) => (
  <group rotation={[0.3, t * 0.25, 0.15]}>
    <mesh geometry={caixa(0.7, 0.7, 0.9)} material={mat("#d4a72c", { metal: 0.6, aspereza: 0.35 })} />
    {[1, -1].map((l) => (
      <group key={l} position={[l * 1.25, 0, 0]} rotation-x={t * 0.2}>
        <mesh geometry={caixa(1.6, 0.03, 0.75)} material={mat("#1d3a7a", { metal: 0.3, aspereza: 0.3, emissivo: "#16306a", brilho: 0.3 })} />
        <mesh position-x={-l * 0.85} rotation-z={Math.PI / 2} geometry={cilindro(0.03, 0.03, 0.2, 5)} material={mat("#9aa3ad")} />
      </group>
    ))}
    <mesh position={[0, 0.55, 0.2]} rotation-x={-0.6} geometry={cone(0.35, 0.18, 10)} material={mat("#e6e8ec")} />
  </group>
);

const Estacao: React.FC<{ o: ObjetoCena; t: number }> = ({ t }) => (
  <group rotation={[0.25, 0.4 + t * 0.08, 0.05]}>
    <mesh rotation-z={Math.PI / 2} geometry={caixa(0.2, 4, 0.2)} material={mat("#b8bec8")} />
    {[-0.6, 0.6].map((z) => <mesh key={z} position={[0, 0, z * 0.6]} rotation-x={Math.PI / 2} geometry={cilindro(0.28, 0.28, 1.1, 8)} material={mat("#e9ecf0")} />)}
    <mesh rotation-z={Math.PI / 2} geometry={cilindro(0.26, 0.26, 1.2, 8)} material={mat("#e9ecf0")} />
    {[-1.7, -1.2, 1.2, 1.7].map((x) => [1, -1].map((l) => (
      <mesh key={`${x}${l}`} position={[x, 0, l * 0.95]} geometry={caixa(0.42, 0.02, 1.5)} material={mat("#c98a2a", { metal: 0.4, emissivo: "#6a3a10", brilho: 0.25 })} />
    )))}
  </group>
);

const Asteroide: React.FC<{ o: ObjetoCena; t: number }> = ({ o, t }) => {
  const g = useMemo(() => {
    const geo = new THREE.DodecahedronGeometry(0.8, 1);
    const p = geo.attributes.position, v = new THREE.Vector3(), r = rng(9);
    const mapa = new Map<string, number>();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const chave = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
      if (!mapa.has(chave)) mapa.set(chave, 0.8 + r() * 0.35);
      v.multiplyScalar(mapa.get(chave)!);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);
  const caiu = t >= o.quando;
  return (
    <group>
      {!caiu && (
        <group rotation={[t * 2, t * 1.3, 0]}>
          <mesh geometry={g} material={mat("#6b5d52")} />
        </group>
      )}
      {!caiu && t > o.quando - 1.6 && <Efeito tipo="fogo" t={t} quando={o.quando - 1.6} duracao={1.6} posicao={[0, 0, 0]} escala={1.2} semente={5} />}
      {caiu && (
        <>
          <mesh position-y={-o.posicao[1] / o.escala + 0.02} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[2.2, 12]} />
            <meshStandardMaterial color="#2c2622" flatShading />
          </mesh>
          <Efeito tipo="explosao" t={t} quando={o.quando} posicao={[0, 0, 0]} escala={1.3} />
        </>
      )}
    </group>
  );
};

// ---------- ciência ----------
const Atomo: React.FC<{ o: ObjetoCena; t: number }> = ({ o, t }) => {
  const nucleo = useMemo(() => {
    const r = rng(4);
    return Array.from({ length: 12 }, (_, i) => ({ p: [(r() - 0.5) * 0.36, (r() - 0.5) * 0.36, (r() - 0.5) * 0.36] as [number, number, number], protao: i % 2 === 0 }));
  }, []);
  const orbitas = [[0, 0], [1.05, 0.5], [-1.05, 0.5]];
  return (
    <group rotation-y={t * 0.3}>
      {nucleo.map((n, i) => <mesh key={i} position={n.p} geometry={esfera(0.16, 1)} material={mat(n.protao ? "#e5483f" : "#9aa3ad")} />)}
      {orbitas.map(([rx, rz], i) => {
        const a = t * (2.2 + i * 0.4) + i * 2;
        return (
          <group key={i} rotation={[rx, 0, rz]}>
            <mesh rotation-x={Math.PI / 2}><torusGeometry args={[1, 0.012, 4, 64]} /><meshBasicMaterial color={o.cor2} transparent opacity={0.7} /></mesh>
            <mesh position={[Math.cos(a), 0, Math.sin(a)]} geometry={esfera(0.08, 1)} material={mat(o.cor, { emissivo: o.cor, brilho: 1.2 })} />
          </group>
        );
      })}
    </group>
  );
};

const ATOMOS: Record<string, { cor: string; r: number }> = { O: { cor: "#e5483f", r: 0.32 }, H: { cor: "#f4f4f4", r: 0.2 }, C: { cor: "#333438", r: 0.3 }, N: { cor: "#3f6fe5", r: 0.3 } };
const MOLECULAS: Record<string, { a: [string, [number, number, number]][]; ligacoes: [number, number, number?][] }> = {
  agua: { a: [["O", [0, 0, 0]], ["H", [0.62, -0.48, 0]], ["H", [-0.62, -0.48, 0]]], ligacoes: [[0, 1], [0, 2]] },
  co2: { a: [["C", [0, 0, 0]], ["O", [0.8, 0, 0]], ["O", [-0.8, 0, 0]]], ligacoes: [[0, 1, 2], [0, 2, 2]] },
  metano: { a: [["C", [0, 0, 0]], ["H", [0.5, 0.5, 0.5]], ["H", [-0.5, -0.5, 0.5]], ["H", [-0.5, 0.5, -0.5]], ["H", [0.5, -0.5, -0.5]]], ligacoes: [[0, 1], [0, 2], [0, 3], [0, 4]] },
  oxigenio: { a: [["O", [0.4, 0, 0]], ["O", [-0.4, 0, 0]]], ligacoes: [[0, 1, 2]] },
  amonia: { a: [["N", [0, 0.1, 0]], ["H", [0.6, -0.3, 0]], ["H", [-0.3, -0.3, 0.52]], ["H", [-0.3, -0.3, -0.52]]], ligacoes: [[0, 1], [0, 2], [0, 3]] },
};
const Ligacao: React.FC<{ a: [number, number, number]; b: [number, number, number]; desvio?: number }> = ({ a, b, desvio = 0 }) => {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const meio = va.clone().add(vb).multiplyScalar(0.5), dir = vb.clone().sub(va);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  const lado = new THREE.Vector3(0, 0, 1).applyQuaternion(q).multiplyScalar(desvio);
  return <mesh position={meio.add(lado)} quaternion={q} geometry={cilindro(0.05, 0.05, dir.length(), 6)} material={mat("#c9ced6")} />;
};
const Molecula: React.FC<{ o: ObjetoCena; t: number }> = ({ o, t }) => {
  const m = MOLECULAS[o.variante ?? "agua"] ?? MOLECULAS.agua;
  return (
    <group rotation={[0.3 * Math.sin(t * 0.5), t * 0.6, 0]} scale={1.05}>
      {m.a.map(([el, p], i) => <mesh key={i} position={p} geometry={esfera(ATOMOS[el].r, 1)} material={mat(ATOMOS[el].cor, { aspereza: 0.5 })} />)}
      {m.ligacoes.map(([i, j, n], k) => (n === 2
        ? [-0.07, 0.07].map((d) => <Ligacao key={`${k}${d}`} a={m.a[i][1]} b={m.a[j][1]} desvio={d} />)
        : <Ligacao key={k} a={m.a[i][1]} b={m.a[j][1]} />))}
    </group>
  );
};

const ADN: React.FC<{ o: ObjetoCena; t: number }> = ({ o, t }) => {
  const pares = 22, altura = 3.2, raio = 0.55;
  const bases = ["#e5483f", "#3f8fe5", "#f2c12e", "#3aa66a"];
  return (
    <group rotation-y={t * 0.5} position-y={-altura / 2}>
      {Array.from({ length: pares }, (_, i) => {
        const y = (i / (pares - 1)) * altura, a = i * 0.55;
        const p1: [number, number, number] = [Math.cos(a) * raio, y, Math.sin(a) * raio];
        const p2: [number, number, number] = [Math.cos(a + Math.PI) * raio, y, Math.sin(a + Math.PI) * raio];
        return (
          <group key={i}>
            <mesh position={p1} geometry={esfera(0.09, 1)} material={mat(o.cor)} />
            <mesh position={p2} geometry={esfera(0.09, 1)} material={mat(o.cor2)} />
            <group position-y={y} rotation-y={-a}>
              <mesh position-x={raio / 2} rotation-z={Math.PI / 2} geometry={cilindro(0.04, 0.04, raio, 5)} material={mat(bases[i % 4])} />
              <mesh position-x={-raio / 2} rotation-z={Math.PI / 2} geometry={cilindro(0.04, 0.04, raio, 5)} material={mat(bases[(i + 2) % 4])} />
            </group>
          </group>
        );
      })}
    </group>
  );
};

const Celula: React.FC<{ o: ObjetoCena; t: number }> = ({ o, t }) => {
  const organelos = useMemo(() => {
    const r = rng(12);
    return Array.from({ length: 7 }, () => ({ p: [(r() - 0.5) * 1.1, (r() - 0.5) * 0.9, (r() - 0.5) * 1.1] as [number, number, number], rot: r() * 3 }));
  }, []);
  const pulso = 1 + 0.03 * Math.sin(t * 2);
  return (
    <group rotation-y={t * 0.25} scale={pulso}>
      <mesh geometry={esfera(1.05, 2)} material={mat(o.cor2, { opacidade: 0.28, aspereza: 0.3 })} />
      <mesh position={[0.15, 0.05, 0]} geometry={esfera(0.38, 1)} material={mat("#8a4fd1", { emissivo: "#5a2a9a", brilho: 0.3 })} />
      <mesh position={[0.18, 0.08, 0.05]} geometry={esfera(0.14, 1)} material={mat("#c08af0")} />
      {organelos.map((g, i) => (
        <mesh key={i} position={g.p} rotation={[g.rot, g.rot * 2, 0]} scale={[1.8, 0.8, 0.8]} geometry={esfera(0.12, 1)} material={mat(i % 2 ? "#f08a3a" : "#3aa66a")} />
      ))}
    </group>
  );
};

const Vulcao: React.FC<{ o: ObjetoCena; t: number }> = ({ o, t }) => {
  const erupcao = t >= o.quando;
  return (
    <group position-y={-o.posicao[1] / o.escala}>
      <mesh position-y={1.6} geometry={cilindro(0.9, 4, 3.2, 9)} material={mat("#5a4a42")} />
      <mesh position-y={3.15} geometry={cilindro(0.75, 0.9, 0.12, 9)} material={mat("#ff5a14", { emissivo: "#ff4a10", brilho: erupcao ? 2.2 : 0.9 })} />
      {/* rios de lava pela encosta */}
      {erupcao && [0, 2.1, 4.2].map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * 1.9 * clamp01((t - o.quando) / 2), 2.2 - 1.1 * clamp01((t - o.quando) / 2), Math.sin(a) * 1.9 * clamp01((t - o.quando) / 2)]}
          rotation={[0, -a, 0.95]} geometry={caixa(0.3, 2.6 * clamp01((t - o.quando) / 2) + 0.01, 0.08)} material={mat("#ff6a1a", { emissivo: "#ff4a10", brilho: 1.8 })} />
      ))}
      <Efeito tipo="fumo" t={t} quando={o.quando - 2} posicao={[0, 3.3, 0]} escala={1.3} semente={7} />
      {erupcao && <Efeito tipo="explosao" t={t} quando={o.quando} posicao={[0, 3.3, 0]} escala={1.4} semente={8} />}
      {erupcao && <Efeito tipo="fogo" t={t} quando={o.quando} posicao={[0, 3.2, 0]} escala={1.6} semente={9} />}
    </group>
  );
};

const Frasco: React.FC<{ o: ObjetoCena; t: number }> = ({ o, t }) => (
  <group>
    <mesh position-y={-0.2} geometry={cone(0.35, 0.6, 10)} material={mat("#dff3ff", { opacidade: 0.35, aspereza: 0.1 })} />
    <mesh position-y={-0.3} geometry={cone(0.26, 0.42, 10)} material={mat(o.cor, { emissivo: o.cor, brilho: 0.7, opacidade: 0.9 })} />
    <mesh position-y={0.25} geometry={cilindro(0.09, 0.09, 0.35, 8)} material={mat("#dff3ff", { opacidade: 0.35, aspereza: 0.1 })} />
    {[0, 1, 2].map((i) => {
      const k = ((t * 0.8 + i / 3) % 1);
      return <mesh key={i} position={[0.05 * Math.sin(i * 2 + t), -0.35 + k * 0.75, 0]} geometry={esfera(0.035, 0)} material={mat("#ffffff", { opacidade: 1 - k })} />;
    })}
  </group>
);

// ---------- matemática ----------
const GEO_SOLIDO: Record<string, () => THREE.BufferGeometry> = {
  cubo: () => new THREE.BoxGeometry(1.4, 1.4, 1.4), esfera: () => new THREE.IcosahedronGeometry(0.85, 1), piramide: () => new THREE.ConeGeometry(0.95, 1.5, 4),
  cilindro: () => new THREE.CylinderGeometry(0.7, 0.7, 1.4, 12), cone: () => new THREE.ConeGeometry(0.8, 1.5, 12), dodecaedro: () => new THREE.DodecahedronGeometry(0.85, 0),
  icosaedro: () => new THREE.IcosahedronGeometry(0.85, 0), toro: () => new THREE.TorusGeometry(0.62, 0.26, 8, 16),
};
const Solido: React.FC<{ o: ObjetoCena; t: number }> = ({ o, t }) => {
  const g = geo(`solido${o.tipo}`, GEO_SOLIDO[o.tipo]);
  const arestas = useMemo(() => new THREE.EdgesGeometry(g, 20), [g]);
  // constrói-se: as arestas crescem do centro, depois as faces enchem
  const k = t - o.quando;
  const linhas = sai(k / 0.8), faces = suave((k - 0.6) / 0.6);
  return (
    <group rotation={[0.35, t * 0.5, 0.1]}>
      <lineSegments geometry={arestas} scale={0.2 + 0.8 * linhas}><lineBasicMaterial color={o.cor} transparent opacity={linhas} /></lineSegments>
      <mesh geometry={g} scale={faces * 0.995 + 0.001} material={mat(o.cor2, { opacidade: 0.55 * faces + 0.001, aspereza: 0.4, emissivo: o.cor2, brilho: 0.15 })} />
    </group>
  );
};

const FUNCOES: Record<string, (x: number, z: number, t: number) => number> = {
  onda: (x, z, t) => { const r = Math.hypot(x, z) * 2.4; return Math.cos(r - t * 2.5) * Math.exp(-r * 0.22) * 0.55; },
  sela: (x, z) => (x * x - z * z) * 0.35,
  paraboloide: (x, z) => (x * x + z * z) * 0.3 - 0.6,
  gaussiana: (x, z, t) => Math.exp(-(x * x + z * z) * 0.9) * (1.2 + 0.2 * Math.sin(t * 2)),
  seno: (x, z, t) => Math.sin(x * 1.6 + t) * Math.cos(z * 1.6) * 0.5,
};
const Superficie: React.FC<{ o: ObjetoCena; t: number }> = ({ o, t }) => {
  const f = FUNCOES[o.variante ?? "onda"] ?? FUNCOES.onda;
  const g = useMemo(() => new THREE.PlaneGeometry(3.6, 3.6, 26, 26).toNonIndexed().rotateX(-Math.PI / 2), []);
  const p = g.attributes.position;
  const c1 = new THREE.Color(o.cor2), c2 = new THREE.Color(o.cor), c = new THREE.Color();
  if (!g.getAttribute("color")) g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(p.count * 3), 3));
  const cores = g.getAttribute("color") as THREE.BufferAttribute;
  const ys: number[] = [];
  for (let i = 0; i < p.count; i++) { const y = f(p.getX(i), p.getZ(i), t); p.setY(i, y); ys.push(y); }
  const min = Math.min(...ys), max = Math.max(...ys);
  for (let i = 0; i < p.count; i += 3) {
    const m = (ys[i] + ys[i + 1] + ys[i + 2]) / 3;
    c.copy(c1).lerp(c2, clamp01((m - min) / (max - min + 1e-6)));
    for (let k = 0; k < 3; k++) cores.setXYZ(i + k, c.r, c.g, c.b);
  }
  p.needsUpdate = true; cores.needsUpdate = true;
  g.computeVertexNormals();
  return (
    <group rotation-y={0.5 + t * 0.15}>
      <mesh geometry={g}><meshStandardMaterial vertexColors flatShading side={THREE.DoubleSide} roughness={0.6} /></mesh>
      <Eixos />
    </group>
  );
};
const Eixos: React.FC = () => (
  <group>
    {([["#ef4444", [Math.PI / 2, 0, -Math.PI / 2]], ["#22c55e", [0, 0, 0]], ["#3b82f6", [Math.PI / 2, 0, 0]]] as [string, [number, number, number]][]).map(([cor, rot], i) => (
      <group key={i} rotation={rot}>
        <mesh position-y={1.1} geometry={cilindro(0.02, 0.02, 2.2, 5)} material={mat(cor, { emissivo: cor, brilho: 0.5 })} />
        <mesh position-y={2.25} geometry={cone(0.07, 0.18, 6)} material={mat(cor, { emissivo: cor, brilho: 0.5 })} />
      </group>
    ))}
  </group>
);

// ---------- desenho de qualquer objeto ----------
export const Objeto: React.FC<{ o: ObjetoCena; t: number }> = ({ o, t }) => {
  const [x, y, z] = o.tipo === "asteroide" || o.tipo === "carro_f1" ? posicaoAgora(o, t) : o.posicao;
  // entrada: aparece a crescer (menos os que já estão no mundo: vulcão, foguetão, efeitos)
  const cresce = ["vulcao", "foguetao", "explosao", "fogo", "fumo", "asteroide", "ovni", "portal", "vaca", "cristal", "tiranossauro", "braquiossauro", "cogumelo", "missil", "bombardeiro", "carro_f1", "velas", "seta", "moedas", "empresa", "console", "placa_de_video", "ssd", "codigo", "arte_3d", "nivel", "bug", "tv", "relogio", "mola_real", "fundicao", "tanque_agua"].includes(o.tipo) ? 1 : sai(t / 0.5);
  let corpo: React.ReactNode = null;
  switch (o.tipo) {
    case "foguetao": corpo = <Foguetao o={o} t={t} />; break;
    case "satelite": corpo = <Satelite o={o} t={t} />; break;
    case "estacao": corpo = <Estacao o={o} t={t} />; break;
    case "asteroide": corpo = <Asteroide o={o} t={t} />; break;
    case "atomo": corpo = <Atomo o={o} t={t} />; break;
    case "molecula": corpo = <Molecula o={o} t={t} />; break;
    case "adn": corpo = <ADN o={o} t={t} />; break;
    case "celula": corpo = <Celula o={o} t={t} />; break;
    case "vulcao": corpo = <Vulcao o={o} t={t} />; break;
    case "frasco": corpo = <Frasco o={o} t={t} />; break;
    case "superficie": corpo = <Superficie o={o} t={t} />; break;
    case "eixos": corpo = <Eixos />; break;
    case "bola": corpo = <mesh rotation={[t * 3, 0, 0]} geometry={esfera(0.11, 1)} material={mat("#f5f5f5")} />; break;
    case "trofeu": corpo = (
      <group rotation-y={t * 0.6}>
        <mesh position-y={0.25} geometry={cilindro(0.32, 0.14, 0.5, 9)} material={mat("#f2c230", { metal: 0.8, aspereza: 0.3 })} />
        <mesh position-y={-0.1} geometry={cilindro(0.06, 0.06, 0.3, 6)} material={mat("#f2c230", { metal: 0.8, aspereza: 0.3 })} />
        <mesh position-y={-0.35} geometry={caixa(0.4, 0.2, 0.4)} material={mat("#3a2a1e")} />
      </group>
    ); break;
    // animais: "variante" = acao (andar | rugir | parado)
    case "tiranossauro": corpo = <group position-y={-o.posicao[1] / o.escala}><Tiranossauro t={t} acao={(o.variante as "andar") ?? "parado"} /></group>; break;
    case "braquiossauro": corpo = <group position-y={-o.posicao[1] / o.escala}><Braquiossauro t={t} acao={(o.variante as "andar") ?? "parado"} /></group>; break;
    case "pterossauro": corpo = <group position={[0, -9, 6]}><Pterossauro t={t} raio={2.5} /></group>; break;
    case "tubarao": case "baleia": corpo = <group position={[-((((t * (o.tipo === "baleia" ? 1.5 : 3) + 30) % 60) + 60) % 60 - 30), -2, 0]} rotation-y={0}><PeixeGrande t={t} tipo={o.tipo} z={0} y={2} /></group>; break;
    case "cardume": corpo = <Cardume t={t} centro={[0, 0, 0]} raio={2} />; break;
    // ficção científica (o disco voador fica a 5 m do chão; com variante "abduzir" leva a vaca em `quando`)
    case "ovni": corpo = <group position-y={-o.posicao[1] / o.escala}><Ovni t={t} quando={o.quando} abduzir={o.variante === "abduzir"} altura={5} cor={o.cor} /></group>; break;
    case "vaca": corpo = <group position-y={-o.posicao[1] / o.escala}><Vaca t={t} /></group>; break;
    case "cristal": corpo = <group position-y={-o.posicao[1] / o.escala}><Cristais t={t} cor={o.cor === o.cor2 ? undefined : o.cor} /></group>; break;
    case "portal": corpo = <group position-y={-o.posicao[1] / o.escala}><Portal t={t} quando={o.quando} cor={o.cor} /></group>; break;
    // pacote nuclear
    case "cogumelo": corpo = <group position-y={-o.posicao[1] / o.escala}><Cogumelo t={t} quando={o.quando} /></group>; break;
    case "bomba": corpo = <Bomba t={t} variante={o.variante} quando={o.quando} altura={16} />; break;
    case "missil": corpo = <group position-y={-o.posicao[1] / o.escala}><Missil t={t} quando={o.quando} /></group>; break;
    case "bombardeiro": corpo = <group position-y={-o.posicao[1] / o.escala}><Bombardeiro t={t} largar={o.variante === "largar"} altura={18} /></group>; break;
    case "carro_f1": corpo = <CarroF1 cor={o.cor} cor2={o.cor2} t={t} vel={o.variante === "andar" ? VEL_F1 : 0} chuva={o.chuva} />; break;
    // finanças / bolsa
    case "velas": corpo = <Velas t={t} quando={o.quando} tendencia={o.variante} />; break;
    case "seta": corpo = <Seta t={t} quando={o.quando} desce={o.variante === "desce"} />; break;
    case "touro": corpo = <group position-y={-o.posicao[1] / o.escala}><Touro t={t} acao={o.variante} /></group>; break;
    case "urso": corpo = <group position-y={-o.posicao[1] / o.escala}><Urso t={t} acao={o.variante} /></group>; break;
    case "moedas": corpo = <group position-y={-o.posicao[1] / o.escala}><Moedas t={t} quando={o.quando} cair={o.variante === "cair"} /></group>; break;
    case "dinheiro": corpo = <group position-y={-o.posicao[1] / o.escala}><Dinheiro t={t} chuva={o.variante === "chuva"} /></group>; break;
    case "empresa": corpo = <group position-y={-o.posicao[1] / o.escala}><Empresa t={t} quando={o.quando} cor={o.cor} cor2={o.cor2} /></group>; break;
    // como fazer um videogame: hardware e etapas do jogo
    case "placa_mae": corpo = <PlacaMae t={t} cor={o.cor} />; break;
    case "processador": corpo = <Processador t={t} cor={o.cor} />; break;
    case "placa_de_video": corpo = <PlacaGrafica t={t} quando={o.quando} cor={o.cor} />; break;
    case "memoria_ram": corpo = <Memoria t={t} cor={o.cor} />; break;
    case "ssd": corpo = <Ssd t={t} quando={o.quando} cor={o.cor} />; break;
    case "cooler": corpo = <Ventoinha t={t} cor={o.cor} />; break;
    case "fonte": corpo = <Fonte t={t} />; break;
    case "controle": corpo = <Comando t={t} jogar={o.variante === "jogar"} cor={o.cor} />; break;
    case "codigo": corpo = <Codigo t={t} quando={o.quando} />; break;
    case "motor_jogo": corpo = <MotorJogo t={t} cor={o.cor} />; break;
    case "som": corpo = <Som t={t} cor={o.cor} />; break;
    case "console": corpo = <group position-y={-o.posicao[1] / o.escala}><Consola t={t} quando={o.quando} variante={o.variante} cor={o.cor} /></group>; break;
    case "tv": corpo = <group position-y={-o.posicao[1] / o.escala}><Tv t={t} quando={o.quando} ligar={o.variante === "ligar"} /></group>; break;
    case "arte_3d": corpo = <group position-y={-o.posicao[1] / o.escala}><Arte3D t={t} quando={o.quando} cor={o.cor} /></group>; break;
    case "nivel": corpo = <group position-y={-o.posicao[1] / o.escala}><Nivel t={t} quando={o.quando} /></group>; break;
    case "bug": corpo = <group position-y={-o.posicao[1] / o.escala}><Bug t={t} quando={o.quando} corrigido={o.variante === "corrigido"} /></group>; break;
    // relojoaria
    case "relogio": corpo = <Relogio t={t} quando={o.quando} variante={o.variante} mostrador={o.cor} />; break;
    case "mecanismo": corpo = <Mecanismo t={t} automatico={o.variante === "automatico"} />; break;
    case "engrenagens": corpo = <Engrenagens t={t} />; break;
    case "escape": corpo = <group position-y={-0.1}><Escape t={t} /></group>; break;
    case "mola_real": corpo = <MolaReal t={t} quando={o.quando} darCorda={o.variante === "dar_corda"} />; break;
    case "rubi": corpo = <Rubi t={t} />; break;
    case "lingotes": corpo = <group position-y={-o.posicao[1] / o.escala}><Lingotes variante={o.variante} /></group>; break;
    case "fundicao": corpo = <group position-y={-o.posicao[1] / o.escala}><Fundicao t={t} quando={o.quando} /></group>; break;
    case "maquina_cnc": corpo = <group position-y={-o.posicao[1] / o.escala}><MaquinaCnc t={t} /></group>; break;
    case "tanque_agua": corpo = <group position-y={-o.posicao[1] / o.escala}><TanqueAgua t={t} quando={o.quando} /></group>; break;
    case "modelo": corpo = o.modelo ? <group position-y={-o.posicao[1] / o.escala} rotation-y={((o.rotacao ?? 0) * Math.PI) / 180}><ModeloGlb id={o.modelo} t={t} girar={o.variante === "girar"} /></group> : null; break;
    case "radiacao": corpo = <group position-y={-o.posicao[1] / o.escala}><Radiacao t={t} /></group>; break;
    case "explosao": case "fogo": case "fumo":
      corpo = <Efeito tipo={o.tipo} t={t} quando={o.quando} posicao={[0, 0, 0]} escala={1} />; break;
    default: if (GEO_SOLIDO[o.tipo]) corpo = <Solido o={o} t={t} />;
  }
  if (o.tipo === "asteroide") return <group position={[x, y, z]} scale={o.escala}>{corpo}</group>;
  return <group position={[x, y, z]} scale={o.escala * (0.001 + 0.999 * cresce)}>{corpo}</group>;
};


