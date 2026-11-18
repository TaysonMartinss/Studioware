import { useMemo } from "react";
import * as THREE from "three";
import { Boneco, poseEm } from "./Boneco";
import { CopoGin, Garrafa } from "./Bebidas";
import { caixa, cilindro, cone, esfera, geo, mat, rng } from "./util";

// Vida noturna em low poly: a balada (pista que acende ao ritmo, focos a varrer, bola de espelhos, DJ, colunas a
// pulsar, bar com garrafas e gente a dançar) e o lounge (sofás, mesa com gin e copos, narguilé com brasa e fumo).
// Mesmo enquadramento dos outros interiores: parede do fundo em z = -2,6, laterais em x = ±4,4.
const PAREDE = -2.6;
export const SOFA_LOUNGE_Z = -1.75;
const NEON = ["#ff2bd6", "#2bd9ff", "#8a3bff", "#ffd12b", "#2bff8a", "#ff4b3b"];

// a batida da música (124 bpm): número da batida e um pulso que salta a cada uma e cai depressa
const batida = (t: number, bpm = 124) => { const b = (t * bpm) / 60; return { n: Math.floor(b), pulso: Math.pow(1 - (b % 1), 3) }; };

// feixe de luz visível (cone aditivo): só um material por cor
const FEIXES = new Map<string, THREE.Material>();
const feixe = (cor: string) => {
  let m = FEIXES.get(cor);
  if (!m) { m = new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }); FEIXES.set(cor, m); }
  return m;
};

// ---------- balada ----------
export const Balada: React.FC<{ t: number; cor: string; cor2: string }> = ({ t, cor, cor2 }) => {
  const { n, pulso } = batida(t);
  const forte = pulso > 0.45;
  // a cada 8 batidas as cores rodam
  const corDe = (k: number) => NEON[(k + Math.floor(n / 8)) % NEON.length];
  // pessoas a dançar dos lados (deixam o meio livre para as personagens do roteiro e o DJ)
  const multidao = useMemo(() => {
    const r = rng(42);
    return Array.from({ length: 10 }, (_, i) => {
      const lado = i % 2 ? 1 : -1;
      return { x: lado * (1.45 + r() * 2.4), z: -0.6 - r() * 1.4, cor: ["#2b2f45", "#4a2440", "#1f3d3a", "#3a2a1e", "#22324f", "#5a1f2b"][i % 6], fase: r() * 4, rot: -lado * (0.2 + r() * 0.5) };
    });
  }, []);
  return (
    <group>
      <ambientLight intensity={0.16} />
      <hemisphereLight args={["#6a4cff", "#140818", 0.35]} />
      {[0, 1, 2].map((i) => <pointLight key={i} position={[-2.6 + i * 2.6, 2.4, -0.4]} intensity={5 + 9 * pulso} distance={7} color={corDe(i * 2)} />)}
      <pointLight position={[0, 1.6, 2.2]} intensity={3} distance={6} color="#ffffff" />

      {/* sala escura com tiras de néon */}
      <mesh position={[0, 1.6, PAREDE]} geometry={caixa(9, 3.4, 0.12)} material={mat("#0c0912")} />
      {[-4.4, 4.4].map((x) => <mesh key={x} position={[x, 1.6, 0.6]} geometry={caixa(0.12, 3.4, 7.4)} material={mat("#0e0a16")} />)}
      <mesh position={[0, 3.3, 0.6]} geometry={caixa(9, 0.1, 7.4)} material={mat("#08060c")} />
      {[0.35, 3.0].map((y, k) => <mesh key={y} position={[0, y, PAREDE + 0.08]} geometry={caixa(8.6, 0.05, 0.03)} material={mat("#111", { emissivo: k ? cor2 : cor, brilho: forte ? 2 : 1.1 })} />)}
      {[-4.33, 4.33].map((x, k) => <mesh key={x} position={[x, 2.9, 0.6]} geometry={caixa(0.03, 0.05, 7)} material={mat("#111", { emissivo: k ? cor : cor2, brilho: forte ? 2 : 1.1 })} />)}

      {/* pista: os ladrilhos acendem ao ritmo, num padrão que muda a cada batida */}
      {Array.from({ length: 9 * 8 }, (_, i) => {
        const cx = i % 9, cz = Math.floor(i / 9);
        const aceso = (cx + cz + n) % 3 === 0 || ((cx * 7 + cz * 3 + n * 5) % 11 === 0);
        return <mesh key={i} position={[-4.0 + cx, 0, -2.2 + cz * 0.95]} geometry={caixa(0.96, 0.05, 0.92)} material={mat("#0b0b10", { emissivo: corDe(cx + cz), brilho: aceso ? (forte ? 0.95 : 0.6) : 0.05, aspereza: 0.35 })} />;
      })}

      {/* cabine do DJ ao fundo, com equalizador a saltar, pratos a rodar e o DJ a dançar */}
      <group position={[0, 0, -2.05]}>
        <mesh position-y={0.5} geometry={caixa(2.0, 1.0, 0.6)} material={mat("#15121c")} />
        {Array.from({ length: 14 }, (_, k) => {
          const h = 0.12 + 0.5 * Math.abs(Math.sin(t * (3 + k * 0.7) + k)) * (0.5 + 0.5 * pulso);
          return <mesh key={k} position={[-0.85 + k * 0.13, 0.15 + h / 2, 0.31]} scale-y={h / 0.1} geometry={caixa(0.08, 0.1, 0.02)} material={mat("#111", { emissivo: corDe(k > 9 ? 0 : k > 5 ? 3 : 4), brilho: 1.5 })} />;
        })}
        <mesh position-y={1.02} geometry={caixa(2.0, 0.04, 0.62)} material={mat("#22202a")} />
        {[-0.55, 0.55].map((x) => (
          <group key={x} position={[x, 1.06, 0.02]} rotation-y={t * 3.5}>
            <mesh geometry={cilindro(0.2, 0.2, 0.03, 16)} material={mat("#0d0d0f", { aspereza: 0.3 })} />
            <mesh position-y={0.02} geometry={cilindro(0.06, 0.06, 0.01, 8)} material={mat(cor)} />
            <mesh position={[0.12, 0.022, 0]} geometry={caixa(0.06, 0.005, 0.01)} material={mat("#f2f2f2")} />
          </group>
        ))}
        <mesh position={[0, 1.07, 0.05]} geometry={caixa(0.4, 0.06, 0.3)} material={mat("#2a2833", { emissivo: cor2, brilho: 0.25 })} />
        <group position={[0, 0, -0.45]}>
          <Boneco pose={poseEm("dancar", t * 0.8, 3)} expressao="feliz" visual="pessoa" cor="#17151d" semente="dj" t={t} />
        </group>
      </group>

      {/* colunas de som dos lados da cabine: os altifalantes pulsam com o grave */}
      {[-1.75, 1.75].map((x) => (
        <group key={x} position={[x, 0, -2.2]}>
          <mesh position-y={0.9} geometry={caixa(0.75, 1.8, 0.6)} material={mat("#121116")} />
          {[0.55, 1.3].map((y, k) => (
            <group key={y} position={[0, y, 0.31]} scale={1 + (k ? 0.03 : 0.08) * pulso}>
              <mesh rotation-x={Math.PI / 2} geometry={cilindro(k ? 0.17 : 0.27, k ? 0.17 : 0.27, 0.03, 14)} material={mat("#26242c")} />
              <mesh position-z={0.02} rotation-x={Math.PI / 2} geometry={cilindro(0.07, 0.07, 0.03, 10)} material={mat("#3a3842")} />
            </group>
          ))}
        </group>
      ))}

      {/* bola de espelhos e os focos que varrem a sala */}
      <mesh position={[0, 3.15, -0.6]} geometry={cilindro(0.008, 0.008, 0.3, 4)} material={mat("#555")} />
      <mesh position={[0, 2.85, -0.6]} rotation-y={t * 0.8} geometry={esfera(0.3, 1)} material={mat("#dfe3ea", { metal: 1, aspereza: 0.12, emissivo: "#ffffff", brilho: 0.15 + 0.35 * pulso })} />
      {[0, 1, 2, 3].map((i) => (
        <group key={i} position={[-3 + i * 2, 3.25, -1.6]} rotation={[0.45 + 0.3 * Math.sin(t * 1.1 + i * 1.3), 0, 0.65 * Math.sin(t * 0.9 + i * 1.7)]}>
          <mesh geometry={cilindro(0.12, 0.16, 0.22, 8)} material={mat("#1a1a20", { emissivo: corDe(i), brilho: 1 })} />
          <mesh position-y={-1.75} geometry={cone(0.75, 3.4, 14)} material={feixe(corDe(i))} />
        </group>
      ))}

      {/* bar na parede da esquerda: balcão e prateleiras de garrafas com luz por trás */}
      <group position={[-3.75, 0, 0.6]} rotation-y={Math.PI / 2}>
        <mesh position={[0, 0.55, 0.35]} geometry={caixa(2.6, 1.1, 0.5)} material={mat("#1c1622")} />
        <mesh position={[0, 1.12, 0.35]} geometry={caixa(2.7, 0.05, 0.6)} material={mat("#3a2e44", { aspereza: 0.3 })} />
        <mesh position={[0, 0.3, 0.61]} geometry={caixa(2.6, 0.03, 0.02)} material={mat("#111", { emissivo: cor2, brilho: 1.4 })} />
        <mesh position={[0, 1.9, -0.25]} geometry={caixa(2.6, 1.4, 0.05)} material={mat("#111", { emissivo: "#ff9a3b", brilho: 0.35 })} />
        {Array.from({ length: 18 }, (_, k) => (
          <group key={k} position={[-1.1 + (k % 9) * 0.27, 1.35 + Math.floor(k / 9) * 0.6, -0.15]}>
            <Garrafa cor={["#cfe9f2", "#2f7a3a", "#7a3a1e", "#e8c46a", "#b03a5a", "#e6f6ff"][k % 6]} alta={0.9 + (k % 3) * 0.12} />
          </group>
        ))}
        {[-0.7, 0.2, 0.9].map((x, k) => <group key={x} position={[x, 1.15, 0.4]}>{k === 1 ? <Garrafa /> : <CopoGin />}</group>)}
      </group>

      {/* a multidão a dançar, cada um no seu tempo */}
      {multidao.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]} rotation-y={p.rot}>
          <Boneco pose={poseEm(i % 4 === 3 ? "torcer" : "dancar", t + p.fase, i)} expressao="feliz" visual="pessoa" cor={p.cor} semente={`balada${i}`} t={t + p.fase} />
        </group>
      ))}
    </group>
  );
};

// ---------- lounge ----------
// mangueira do narguilé: um tubo curvo do narguilé até ao sofá
const mangueira = (de: [number, number, number], ate: [number, number, number]) =>
  geo(`mang${de.join(",")}${ate.join(",")}`, () => {
    const meio = new THREE.Vector3((de[0] + ate[0]) / 2, 0.08, (de[2] + ate[2]) / 2);
    const curva = new THREE.CatmullRomCurve3([new THREE.Vector3(...de), meio, new THREE.Vector3(...ate)]);
    return new THREE.TubeGeometry(curva, 24, 0.014, 5, false);
  });

export const Lounge: React.FC<{ t: number; cor: string; cor2: string }> = ({ t, cor, cor2 }) => {
  const veludo = cor || "#5b2a4a";
  const NARG: [number, number, number] = [1.05, 0, -0.35];
  // fumo: partículas que sobem do narguilé, crescem e desaparecem (material próprio por partícula, opacidade por frame)
  const fumo = useMemo(() => Array.from({ length: 30 }, () => new THREE.MeshStandardMaterial({ color: "#e8e2f0", transparent: true, opacity: 0, depthWrite: false, flatShading: true, roughness: 1 })), []);
  const nevoa = useMemo(() => Array.from({ length: 6 }, () => new THREE.MeshStandardMaterial({ color: "#cdbfe0", transparent: true, opacity: 0.08, depthWrite: false, flatShading: true, roughness: 1 })), []);
  const brasa = Math.sin(t * 6.3) + Math.sin(t * 2.1) > 0.4;
  return (
    <group>
      <ambientLight intensity={0.22} />
      <hemisphereLight args={["#ffcf9a", "#2a1020", 0.35]} />
      {[-1.1, 0, 1.1].map((x) => <pointLight key={x} position={[x, 2.2, -0.6]} intensity={4.5} distance={4} color="#ffb36b" />)}
      <pointLight position={[0, 1.2, PAREDE + 0.5]} intensity={6} distance={5} color={cor2} />
      <pointLight position={[NARG[0], 1.15, NARG[2]]} intensity={brasa ? 1.6 : 1.1} distance={1.6} color="#ff6a2b" />

      {/* chão de madeira escura, parede de ripas e néon por trás do sofá */}
      {Array.from({ length: 12 }, (_, i) => <mesh key={i} position={[-4.4 + i * 0.8, 0, 0.6]} geometry={caixa(0.78, 0.04, 7.4)} material={mat(i % 2 ? "#2e1f18" : "#33231b")} />)}
      <mesh position={[0, 1.6, PAREDE]} geometry={caixa(9, 3.4, 0.12)} material={mat("#24121d")} />
      {Array.from({ length: 22 }, (_, i) => <mesh key={i} position={[-4.2 + i * 0.4, 1.6, PAREDE + 0.08]} geometry={caixa(0.16, 3.3, 0.05)} material={mat("#3a2117")} />)}
      {[-4.4, 4.4].map((x) => <mesh key={x} position={[x, 1.6, 0.6]} geometry={caixa(0.12, 3.4, 7.4)} material={mat("#1e1018")} />)}
      <mesh position={[0, 1.55, PAREDE + 0.13]} geometry={caixa(4.6, 0.04, 0.03)} material={mat("#111", { emissivo: cor2, brilho: 1.6 })} />
      <mesh position={[2.6, 2.3, PAREDE + 0.14]} geometry={geo("aro-lounge", () => new THREE.TorusGeometry(0.32, 0.03, 6, 20))} material={mat("#111", { emissivo: "#ff3bb0", brilho: 1.8 })} />

      {/* sofá de veludo em U */}
      <group position={[0, 0, SOFA_LOUNGE_Z]}>
        <mesh position-y={0.24} geometry={caixa(3.8, 0.48, 0.95)} material={mat(veludo, { aspereza: 0.95 })} />
        <mesh position={[0, 0.46, 0.05]} geometry={caixa(3.5, 0.12, 0.85)} material={mat(veludo, { aspereza: 0.95 })} />
        <mesh position={[0, 0.82, -0.38]} geometry={caixa(3.8, 0.72, 0.22)} material={mat(veludo, { aspereza: 0.95 })} />
        {[-1.2, 0, 1.2].map((x) => <mesh key={x} position={[x, 0.82, -0.25]} rotation-x={-0.15} geometry={caixa(1.0, 0.5, 0.14)} material={mat(veludo, { aspereza: 1 })} />)}
      </group>
      {[-1, 1].map((l) => (
        <group key={l} position={[2.45 * l, 0, -0.65]} rotation-y={-l * Math.PI / 2}>
          <mesh position-y={0.24} geometry={caixa(1.5, 0.48, 0.85)} material={mat(veludo, { aspereza: 0.95 })} />
          <mesh position={[0, 0.78, -0.34]} geometry={caixa(1.5, 0.64, 0.2)} material={mat(veludo, { aspereza: 0.95 })} />
        </group>
      ))}

      {/* mesa baixa com gin, copos, limas e balde de gelo */}
      <group position={[0, 0, -0.55]}>
        <mesh position-y={0.35} geometry={cilindro(0.75, 0.75, 0.05, 16)} material={mat("#1b1416", { aspereza: 0.25, metal: 0.2 })} />
        <mesh position-y={0.17} geometry={cilindro(0.12, 0.18, 0.34, 8)} material={mat("#c9a24a", { metal: 0.8, aspereza: 0.3 })} />
        <group position={[-0.15, 0.38, -0.05]}><Garrafa /></group>
        <group position={[0.25, 0.38, 0.2]}><CopoGin /></group>
        <group position={[-0.45, 0.38, 0.25]}><CopoGin cheio={0.45} /></group>
        <group position={[0.4, 0.38, -0.25]}>
          <mesh position-y={0.08} geometry={cilindro(0.11, 0.09, 0.16, 10)} material={mat("#c8ccd2", { metal: 0.9, aspereza: 0.2 })} />
          {[0, 1, 2, 3].map((k) => <mesh key={k} position={[Math.cos(k * 1.6) * 0.05, 0.16, Math.sin(k * 1.6) * 0.05]} geometry={caixa(0.04, 0.04, 0.04)} material={mat("#f4fbff", { opacidade: 0.85 })} />)}
        </group>
        {[0, 1, 2].map((k) => <mesh key={k} position={[-0.05 + k * 0.07, 0.42, 0.4]} geometry={esfera(0.04, 1)} material={mat("#7cc23a")} />)}
      </group>

      {/* narguilé: vaso de vidro, haste dourada, prato, fornilho com brasa e duas mangueiras até ao sofá */}
      <group position={NARG} scale={1.25}>
        <mesh position-y={0.18} scale={[1, 1.25, 1]} geometry={esfera(0.16, 1)} material={mat("#7a3bd6", { opacidade: 0.72, aspereza: 0.1, emissivo: "#5a1fb0", brilho: 0.25 })} />
        <mesh position-y={0.55} geometry={cilindro(0.022, 0.03, 0.55, 6)} material={mat("#d4a84a", { metal: 0.85, aspereza: 0.25 })} />
        <mesh position-y={0.6} geometry={esfera(0.045, 0)} material={mat("#d4a84a", { metal: 0.85, aspereza: 0.25 })} />
        <mesh position-y={0.84} geometry={cilindro(0.13, 0.13, 0.015, 12)} material={mat("#d4a84a", { metal: 0.85, aspereza: 0.25 })} />
        <mesh position-y={0.9} rotation-x={Math.PI} geometry={cone(0.07, 0.1, 8)} material={mat("#3a2a24")} />
        {[[-0.025, 0.012], [0.02, -0.02], [0.015, 0.025]].map(([x, z], k) => (
          <mesh key={k} position={[x, 0.95, z]} geometry={caixa(0.035, 0.025, 0.035)} material={mat("#2a1a14", { emissivo: "#ff5a1f", brilho: brasa ? 2.2 - k * 0.3 : 1.2 })} />
        ))}
      </group>
      <mesh geometry={mangueira([NARG[0] - 0.05, 0.45, NARG[2]], [0.45, 0.62, SOFA_LOUNGE_Z + 0.45])} material={mat("#2b2b33")} />
      <mesh geometry={mangueira([NARG[0] + 0.05, 0.45, NARG[2] + 0.03], [1.95, 0.6, -0.55])} material={mat("#2b2b33")} />
      {fumo.map((m, i) => {
        // cada baforada sobe a ondular, abre para os lados e desvanece (opacidade baixa: lê-se como fumo, não como bolas)
        const f = (t * 0.2 + i / fumo.length) % 1;
        m.opacity = 0.2 * Math.sin(Math.PI * f) * (1 - f * 0.5);
        const deriva = Math.sin(i * 2.1 + t * 0.7) * 0.5 * f + Math.sin(f * 7 + i) * 0.08;
        return <mesh key={i} position={[NARG[0] + deriva, 1.2 + f * 1.6, NARG[2] + Math.cos(i * 1.7 + t * 0.4) * 0.4 * f]} scale={[0.06 + f * 0.55, 0.05 + f * 0.32, 0.06 + f * 0.5]} rotation={[i, t * 0.3 + i, 0]} geometry={esfera(1, 1)} material={m} />;
      })}
      {nevoa.map((m, i) => (
        <mesh key={`n${i}`} position={[-3 + i * 1.2 + Math.sin(t * 0.15 + i) * 0.4, 2.4 + 0.15 * Math.sin(t * 0.3 + i * 2), -1.4 + (i % 2) * 0.8]} scale={[1.4, 0.35, 0.8]} geometry={esfera(1, 1)} material={m} />
      ))}

      {/* candeeiros pendentes por cima da mesa e uma planta em cada canto */}
      {[-1.1, 0, 1.1].map((x) => (
        <group key={x} position={[x, 2.7, -0.6]}>
          <mesh position-y={0.35} geometry={cilindro(0.006, 0.006, 0.7, 4)} material={mat("#222")} />
          <mesh geometry={cone(0.16, 0.18, 8)} material={mat("#d4a84a", { metal: 0.7, aspereza: 0.3 })} />
          <mesh position-y={-0.1} geometry={esfera(0.06, 1)} material={mat("#fff1d6", { emissivo: "#ffcf8a", brilho: 1.6 })} />
        </group>
      ))}
      {[-3.6, 3.6].map((x) => (
        <group key={x} position={[x, 0, -2.0]}>
          <mesh position-y={0.25} geometry={cilindro(0.22, 0.17, 0.5, 6)} material={mat("#1b1416")} />
          {[0, 1, 2, 3].map((i) => <mesh key={i} position={[Math.cos(i * 1.6) * 0.15, 0.75 + i * 0.12, Math.sin(i * 1.6) * 0.15]} geometry={esfera(0.22, 0)} material={mat(i % 2 ? "#2f6b30" : "#3a7f3a")} />)}
        </group>
      ))}
    </group>
  );
};
