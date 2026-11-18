import { useMemo } from "react";
import * as THREE from "three";
import { Boneco, poseEm } from "./Boneco";
import { Instancias, Inst } from "./Instancias";
import { caixa, cilindro, cone, esfera, geo, mat, rng } from "./util";

// Cenários para vídeos de saúde e prevenção sobre drogas: o banheiro de uma balada (bancada à frente das
// personagens com o pó e a nota, cabines atrás, luz fluorescente a falhar e o grave da pista a entrar pela porta)
// e um bloco de carnaval de rua à noite (sobrados coloridos, bandeirinhas, confete a cair e gente a pular).
// Mesmo enquadramento dos interiores: parede do fundo em z = -2,6, laterais em x = ±4,4.
const PAREDE = -2.6;
// bancada do banheiro: fica à frente das personagens (entre elas e a câmara) e tapa-lhes as pernas
export const BANCADA_Z = 1.0;

const FEIXES = new Map<string, THREE.Material>();
const feixe = (cor: string, opacidade = 0.12) => {
  const chave = `${cor}${opacidade}`;
  let m = FEIXES.get(chave);
  if (!m) { m = new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: opacidade, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }); FEIXES.set(chave, m); }
  return m;
};

// ---------- banheiro da balada ----------
export const BanheiroBalada: React.FC<{ t: number; cor: string; cor2: string }> = ({ t, cor2 }) => {
  // a lâmpada fluorescente falha de vez em quando (padrão fixo, igual em cada render)
  const falha = (t % 5.3 > 1.1 && t % 5.3 < 1.22) || (t % 5.3 > 1.32 && t % 5.3 < 1.38) || (t % 7.9 > 4.0 && t % 7.9 < 4.09);
  const grave = Math.pow(1 - ((t * 124) / 60) % 1, 3); // a batida da pista atrás da porta
  const azulejos = useMemo(() => {
    const it: Inst[] = [];
    for (let x = 0; x < 30; x++) for (let y = 0; y < 18; y++) it.push({ p: [-4.35 + x * 0.3, 0.1 + y * 0.18, PAREDE + 0.07], cor: (x + y) % 7 === 0 ? "#1d3a3f" : (x * 3 + y) % 5 === 0 ? "#22454b" : "#28525a" });
    return it;
  }, []);
  const chao = useMemo(() => {
    const it: Inst[] = [];
    for (let x = 0; x < 18; x++) for (let z = 0; z < 9; z++) it.push({ p: [-4.25 + x * 0.5, 0, -2.35 + z * 0.5], cor: (x + z) % 2 ? "#1a1b1f" : "#9a978f" });
    return it;
  }, []);
  // autocolantes e rabiscos nas portas das cabines
  const autocolantes = useMemo(() => {
    const r = rng(9);
    return Array.from({ length: 16 }, (_, i) => ({ x: -2.6 + r() * 5.2, y: 0.6 + r() * 1.5, l: 0.08 + r() * 0.18, a: 0.05 + r() * 0.12, rot: (r() - 0.5) * 0.6, cor: ["#ff2bd6", "#ffd12b", "#2bd9ff", "#f2f2f2", "#ff4b3b"][i % 5] }));
  }, []);
  return (
    <group>
      <ambientLight intensity={0.22} />
      <hemisphereLight args={["#bfe9ff", "#0d0a14", 0.4]} />
      {/* fluorescente fria no teto e o néon da porta, que pulsa com o grave */}
      <pointLight position={[0, 2.9, -0.4]} intensity={falha ? 0.6 : 9} distance={7} color="#d8f4ff" />
      <pointLight position={[-4.0, 1.3, -1.0]} intensity={3 + 7 * grave} distance={5} color="#ff2bd6" />
      <pointLight position={[0, 1.6, 2.4]} intensity={2.5} distance={5} color="#ffffff" />

      {/* paredes: azulejo de metro esverdeado atrás, laterais escuras, teto */}
      <mesh position={[0, 1.6, PAREDE]} geometry={caixa(9, 3.4, 0.12)} material={mat("#132629")} />
      <Instancias itens={azulejos} geometria={caixa(0.28, 0.16, 0.02)} material={mat("#ffffff", { aspereza: 0.3 })} />
      {[-4.4, 4.4].map((x) => <mesh key={x} position={[x, 1.6, 0.6]} geometry={caixa(0.12, 3.4, 7.4)} material={mat("#15181d")} />)}
      <mesh position={[0, 3.3, 0.6]} geometry={caixa(9, 0.1, 7.4)} material={mat("#101216")} />
      <Instancias itens={chao} geometria={caixa(0.49, 0.03, 0.49)} material={mat("#ffffff", { aspereza: 0.4 })} />

      {/* lâmpada fluorescente (tubo) */}
      <mesh position={[0, 3.2, -0.4]} geometry={caixa(1.6, 0.06, 0.12)} material={mat("#e9fbff", { emissivo: "#d8f4ff", brilho: falha ? 0.1 : 2.2 })} />
      {/* porta para a pista, entreaberta na parede da esquerda: luz rosa a entrar */}
      <group position={[-4.32, 0, -1.0]}>
        <mesh position-y={1.05} geometry={caixa(0.04, 2.1, 1.0)} material={mat("#0b0710", { emissivo: "#ff2bd6", brilho: 0.25 + 0.9 * grave })} />
        <mesh position={[0.3, 1.05, 0.48]} rotation-y={0.9} geometry={caixa(0.05, 2.1, 0.9)} material={mat("#3a1b2a")} />
        <mesh position={[1.6, 1.05, 0]} rotation-z={Math.PI / 2} geometry={cone(1.0, 3.2, 10)} material={feixe("#ff2bd6", 0.05 + 0.05 * grave)} />
      </group>

      {/* três cabines ao fundo: divisórias, portas (a da direita entreaberta) e os autocolantes */}
      {[-1.8, 0, 1.8].map((x, k) => (
        <group key={x} position={[x, 0, PAREDE + 0.95]}>
          <mesh position={[-0.88, 1.15, -0.45]} geometry={caixa(0.05, 2.0, 0.9)} material={mat("#3a2230")} />
          <mesh position={[k === 2 ? 0.25 : 0, 1.15, 0.02]} rotation-y={k === 2 ? -0.55 : 0} geometry={caixa(k === 2 ? 1.2 : 1.7, 1.85, 0.05)} material={mat(k === 1 ? "#5a2238" : "#4a1d30")} />
          <mesh position={[0.6, 1.15, 0.06]} geometry={caixa(0.05, 0.14, 0.03)} material={mat("#c9ced6", { metal: 0.7 })} />
        </group>
      ))}
      <mesh position={[2.68, 1.15, PAREDE + 0.5]} geometry={caixa(0.05, 2.0, 0.9)} material={mat("#3a2230")} />
      {autocolantes.map((a, i) => <mesh key={i} position={[a.x, a.y, PAREDE + 1.0]} rotation-z={a.rot} geometry={caixa(a.l, a.a, 0.005)} material={mat(a.cor, { emissivo: a.cor, brilho: 0.25 })} />)}
      {/* secador de mãos e papeleira na parede da direita */}
      <mesh position={[4.28, 1.3, -0.3]} geometry={caixa(0.2, 0.32, 0.3)} material={mat("#c9ced6", { metal: 0.6, aspereza: 0.35 })} />
      <mesh position={[4.0, 0.3, 0.5]} geometry={cilindro(0.2, 0.17, 0.6, 8)} material={mat("#2a2d34")} />
      {[0, 1, 2].map((k) => <mesh key={k} position={[3.95 + k * 0.05, 0.62, 0.5 - k * 0.06]} geometry={esfera(0.07, 0)} material={mat("#ece8de")} />)}
      {/* néon do lado de cima do espelho (que fica do lado da câmara) */}
      <mesh position={[0, 2.55, PAREDE + 0.1]} geometry={caixa(5, 0.04, 0.03)} material={mat("#111", { emissivo: cor2 || "#8a3bff", brilho: 1.6 })} />

      {/* bancada das pias à frente: tampo escuro, duas pias, torneiras e, no meio, as carreiras, o cartão e o saquinho */}
      <group position={[0, 0, BANCADA_Z]}>
        <mesh position-y={0.45} geometry={caixa(4.6, 0.9, 0.5)} material={mat("#3a3640")} />
        <mesh position={[0, 0.86, 0.26]} geometry={caixa(4.6, 0.02, 0.02)} material={mat("#111", { emissivo: cor2 || "#8a3bff", brilho: 1.4 })} />
        <mesh position-y={0.92} geometry={caixa(4.7, 0.05, 0.6)} material={mat("#2b2d33", { aspereza: 0.25, metal: 0.2 })} />
        {[-1.6, 1.6].map((x) => (
          <group key={x} position={[x, 0.95, 0]}>
            <mesh position-y={-0.005} scale={[1, 0.15, 0.7]} geometry={esfera(0.24, 1)} material={mat("#e9ece9", { aspereza: 0.3 })} />
            <mesh position={[0, 0.12, -0.2]} geometry={cilindro(0.018, 0.022, 0.24, 6)} material={mat("#c9ced6", { metal: 0.8, aspereza: 0.2 })} />
            <mesh position={[0, 0.22, -0.13]} rotation-x={Math.PI / 2} geometry={cilindro(0.015, 0.015, 0.16, 6)} material={mat("#c9ced6", { metal: 0.8, aspereza: 0.2 })} />
          </group>
        ))}
        {[-0.75, -0.62, 0.55, 0.68].map((x, k) => <mesh key={x} position={[x, 0.948, -0.12 + (k % 2) * 0.05]} rotation-y={0.12 * (k % 2 ? 1 : -1)} geometry={caixa(0.03, 0.007, 0.22)} material={mat("#f6f6f4", { emissivo: "#ffffff", brilho: 0.15 })} />)}
        <mesh position={[-0.2, 0.95, -0.05]} rotation-y={0.4} geometry={caixa(0.085, 0.006, 0.054)} material={mat("#1f4fa8", { aspereza: 0.4 })} />
        <mesh position={[0.15, 0.96, 0.08]} scale={[1, 0.5, 0.8]} geometry={esfera(0.04, 0)} material={mat("#f2f2f0", { opacidade: 0.9 })} />
        <mesh position={[-0.05, 0.955, 0.12]} rotation-y={-0.3} geometry={caixa(0.08, 0.012, 0.15)} material={mat("#1c1f26")} />
        <mesh position={[-0.05, 0.962, 0.12]} rotation-y={-0.3} geometry={caixa(0.068, 0.002, 0.13)} material={mat("#4fb3ff", { emissivo: "#4fb3ff", brilho: 0.6 })} />
        {[[1.05, 0.05], [-1.05, 0.1]].map(([x, z], k) => <mesh key={k} position={[x, 1.02, z]} geometry={cilindro(0.04, 0.032, 0.14, 8)} material={mat(k ? "#e33b3b" : "#f2f2f2", { aspereza: 0.6 })} />)}
      </group>
    </group>
  );
};

// ---------- bloco de carnaval ----------
const CORES_CASA = ["#e8b21b", "#2f8fd6", "#e0523b", "#3fae6a", "#d65aa8", "#f2efe6", "#ff8a2b"];
const CORES_FESTA = ["#ff2bd6", "#ffd12b", "#2bd9ff", "#2bff8a", "#ff4b3b", "#8a3bff", "#ffffff"];

// fio de bandeirinhas entre dois pontos, com barriga ao meio; as bandeiras abanam com o vento
const Bandeirinhas: React.FC<{ z: number; y: number; t: number; semente: number }> = ({ z, y, t, semente }) => {
  const n = 22;
  const ponto = (k: number) => { const u = k / (n - 1); return [-4.4 + u * 8.8, y - 0.45 * Math.sin(Math.PI * u), z] as [number, number, number]; };
  const fio = geo(`fio${z}${y}`, () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, k) => new THREE.Vector3(...ponto((k / 8) * (n - 1))))), 24, 0.006, 3, false));
  const tri = geo("bandeirinha", () => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute([-0.11, 0, 0, 0.11, 0, 0, 0, -0.2, 0], 3)); g.computeVertexNormals(); return g; });
  return (
    <group>
      <mesh geometry={fio} material={mat("#ddd")} />
      {Array.from({ length: n }, (_, k) => (
        <mesh key={k} position={ponto(k)} rotation-x={0.35 * Math.sin(t * 3 + k * 0.7 + semente)} geometry={tri} material={mat(CORES_FESTA[(k + semente) % CORES_FESTA.length], { ladoDuplo: true, emissivo: CORES_FESTA[(k + semente) % CORES_FESTA.length], brilho: 0.25 })} />
      ))}
    </group>
  );
};

export const Carnaval: React.FC<{ t: number; cor: string; cor2: string }> = ({ t }) => {
  const batida = Math.pow(1 - ((t * 130) / 60) % 1, 3);
  const { pedras, casas, folioes, confete } = useMemo(() => {
    const r = rng(23);
    const pe: Inst[] = [];
    for (let x = 0; x < 32; x++) for (let z = 0; z < 17; z++) pe.push({ p: [-5.3 + x * 0.34 + (z % 2) * 0.17, 0, -2.75 + z * 0.34], s: [1, 0.6 + r() * 0.6, 1], r: (r() - 0.5) * 0.08, cor: ["#4a4650", "#55515c", "#3e3b44", "#5d5965"][Math.floor(r() * 4)] });
    // confete no chão
    for (let i = 0; i < 160; i++) pe.push({ p: [-4.3 + r() * 8.6, 0.03, -2.4 + r() * 5], s: [0.08, 0.03, 0.06], r: r() * 3, cor: CORES_FESTA[i % CORES_FESTA.length] });
    const ca = Array.from({ length: 7 }, (_, i) => ({ x: -5.4 + i * 1.8, a: 2.7 + r() * 0.9, cor: CORES_CASA[i % CORES_CASA.length], varanda: r() > 0.4 }));
    const fo = Array.from({ length: 12 }, (_, i) => {
      const lado = i % 2 ? 1 : -1;
      return { x: lado * (1.4 + r() * 2.7), z: -0.4 - r() * 1.8, cor: CORES_FESTA[i % CORES_FESTA.length], fase: r() * 4, rot: -lado * (0.15 + r() * 0.5), acao: (["torcer", "dancar", "celebrar", "dancar"] as const)[i % 4] };
    });
    const cf = Array.from({ length: 140 }, (_, i) => ({ x: -4 + r() * 8, z: -2.3 + r() * 4.2, v: 0.35 + r() * 0.4, fase: r(), giro: r() * 6, cor: CORES_FESTA[i % CORES_FESTA.length] }));
    return { pedras: pe, casas: ca, folioes: fo, confete: cf };
  }, []);
  return (
    <group>
      <ambientLight intensity={0.3} />
      <hemisphereLight args={["#8a6cff", "#24122a", 0.5]} />
      {[-2.6, 0, 2.6].map((x, i) => <pointLight key={x} position={[x, 2.6, -0.8]} intensity={4 + 5 * batida} distance={6} color={CORES_FESTA[(i * 2 + Math.floor(t * 2)) % 5]} />)}
      <pointLight position={[0, 2, 2.5]} intensity={3} distance={6} color="#ffe2b0" />

      {/* céu da noite e o clarão do trio elétrico atrás das casas */}
      <mesh position={[0, 4, -6]} geometry={caixa(30, 12, 0.1)} material={mat("#170b2e", { semNevoa: true })} />
      {[-2.2, 2.4].map((x, i) => (
        <group key={x} position={[x, 2.4, -4.2]} rotation-z={0.5 * Math.sin(t * 0.8 + i * 2)}>
          <mesh position-y={2.4} geometry={cone(0.9, 4.8, 12)} material={feixe(CORES_FESTA[(i * 3 + Math.floor(t)) % 6], 0.1)} />
        </group>
      ))}

      {/* rua de paralelepípedos com confete */}
      <Instancias itens={pedras} geometria={caixa(0.31, 0.06, 0.31)} material={mat("#ffffff")} />

      {/* sobrados coloridos ao fundo: portas, janelas com portadas, varandas com grade */}
      {casas.map((c, i) => (
        <group key={i} position={[c.x, 0, PAREDE - 0.4]}>
          <mesh position-y={c.a / 2} geometry={caixa(1.76, c.a, 0.6)} material={mat(c.cor)} />
          <mesh position-y={c.a + 0.08} geometry={caixa(1.86, 0.16, 0.7)} material={mat("#f2efe6")} />
          <mesh position={[0, c.a + 0.35, -0.1]} rotation-x={-0.25} geometry={caixa(1.86, 0.06, 0.8)} material={mat("#a34a2b")} />
          <mesh position={[-0.4, 0.62, 0.31]} geometry={caixa(0.5, 1.2, 0.03)} material={mat("#3a2418")} />
          <mesh position={[0.4, 0.75, 0.31]} geometry={caixa(0.45, 0.6, 0.03)} material={mat("#ffd9a0", { emissivo: "#ffb35a", brilho: 0.6 })} />
          {[-0.4, 0.4].map((x) => <mesh key={x} position={[x, c.a - 0.75, 0.31]} geometry={caixa(0.42, 0.62, 0.03)} material={mat(i % 3 ? "#ffd9a0" : "#2a3a52", { emissivo: i % 3 ? "#ffb35a" : "#000000", brilho: i % 3 ? 0.5 : 0 })} />)}
          {c.varanda && (
            <group position={[0, c.a - 1.15, 0.45]}>
              <mesh geometry={caixa(1.5, 0.05, 0.3)} material={mat("#f2efe6")} />
              {Array.from({ length: 9 }, (_, k) => <mesh key={k} position={[-0.7 + k * 0.175, 0.17, 0.14]} geometry={caixa(0.02, 0.32, 0.02)} material={mat("#1c1c22")} />)}
              <mesh position={[0, 0.33, 0.14]} geometry={caixa(1.5, 0.03, 0.03)} material={mat("#1c1c22")} />
            </group>
          )}
        </group>
      ))}

      {/* bandeirinhas cruzadas por cima da rua e postes com luz quente */}
      <Bandeirinhas z={-0.4} y={3.0} t={t} semente={0} />
      <Bandeirinhas z={-1.5} y={3.1} t={t} semente={3} />
      <Bandeirinhas z={-2.4} y={2.95} t={t} semente={5} />
      {[-3.9, 3.9].map((x) => (
        <group key={x} position={[x, 0, 0.6]}>
          <mesh position-y={1.5} geometry={cilindro(0.04, 0.06, 3, 6)} material={mat("#22252c")} />
          <mesh position={[0, 3.0, 0]} geometry={esfera(0.13, 0)} material={mat("#fff1d6", { emissivo: "#ffcf8a", brilho: 2 })} />
        </group>
      ))}

      {/* serpentinas penduradas nos fios */}
      {Array.from({ length: 10 }, (_, k) => (
        <mesh key={k} position={[-3.6 + k * 0.8, 2.3, -0.4 - (k % 3) * 1.0]} rotation-z={0.15 * Math.sin(t * 2 + k)} geometry={caixa(0.025, 0.9, 0.005)} material={mat(CORES_FESTA[k % 6], { ladoDuplo: true, emissivo: CORES_FESTA[k % 6], brilho: 0.3 })} />
      ))}

      {/* confete a cair, em espiral, e a voltar ao topo */}
      {confete.map((c, i) => {
        const f = (t * c.v * 0.3 + c.fase) % 1;
        return <mesh key={i} position={[c.x + 0.15 * Math.sin(t * 2 + i), 3.2 - f * 3.2, c.z]} rotation={[t * 3 + c.giro, t * 2 + i, 0]} geometry={caixa(0.05, 0.004, 0.035)} material={mat(c.cor, { ladoDuplo: true, emissivo: c.cor, brilho: 0.3 })} />;
      })}

      {/* foliões a pular dos lados, de abadá colorido */}
      {folioes.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]} rotation-y={p.rot}>
          <Boneco pose={poseEm(p.acao, t + p.fase, i)} expressao="feliz" visual="pessoa" cor={p.cor} semente={`folia${i}`} t={t + p.fase} />
        </group>
      ))}
    </group>
  );
};
