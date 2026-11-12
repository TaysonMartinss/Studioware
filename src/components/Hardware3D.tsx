// Modelos 3D procedurais de hardware (sem ficheiro): usados quando não há um GLB para o produto.
// Cada peça tem um vetor de "explosão" próprio, para a vista explodida mostrar o que está por dentro.
import { useMemo } from "react";

type Peca = { pos: [number, number, number]; explode: [number, number, number]; children: React.ReactNode };

const Explodir: React.FC<Peca & { t: number }> = ({ pos, explode, t, children }) => (
  <group position={[pos[0] + explode[0] * t, pos[1] + explode[1] * t, pos[2] + explode[2] * t]}>{children}</group>
);

const metal = (cor: string, rugosidade = 0.35) => <meshStandardMaterial color={cor} metalness={0.6} roughness={rugosidade + 0.1} />;
const plastico = (cor: string, rugosidade = 0.55) => <meshStandardMaterial color={cor} metalness={0.15} roughness={rugosidade} />;
const luz = (cor: string) => <meshStandardMaterial color={cor} emissive={cor} emissiveIntensity={2.2} toneMapped={false} />;

const Ventoinha: React.FC<{ rot: number; r?: number }> = ({ rot, r = 0.42 }) => (
  <group rotation={[Math.PI / 2, 0, 0]}>
    <mesh><cylinderGeometry args={[r, r, 0.04, 48, 1, true]} />{plastico("#15151b")}</mesh>
    <mesh position={[0, 0.02, 0]}><cylinderGeometry args={[r * 0.24, r * 0.24, 0.06, 32]} />{plastico("#22222b", 0.4)}</mesh>
    <group rotation={[0, rot, 0]}>
      {Array.from({ length: 9 }).map((_, i) => (
        <mesh key={i} rotation={[0.35, (i / 9) * Math.PI * 2, 0]} position={[Math.cos((i / 9) * Math.PI * 2) * r * 0.58, 0, -Math.sin((i / 9) * Math.PI * 2) * r * 0.58]}>
          <boxGeometry args={[r * 0.62, 0.012, r * 0.28]} />
          {plastico("#2a2a33", 0.6)}
        </mesh>
      ))}
    </group>
  </group>
);

const Gpu: React.FC<{ t: number; f: number; cor: string }> = ({ t, f, cor }) => {
  const aletas = useMemo(() => Array.from({ length: 34 }, (_, i) => -1.08 + i * 0.065), []);
  return (
    <group>
      <Explodir pos={[0, 0, -0.2]} explode={[0, 0, -1.1]} t={t}><mesh><boxGeometry args={[2.36, 0.98, 0.03]} />{metal("#2b2d33", 0.45)}</mesh></Explodir>
      <Explodir pos={[0, 0, -0.13]} explode={[0, 0, -0.62]} t={t}>
        <mesh><boxGeometry args={[2.28, 0.92, 0.04]} />{plastico("#123524", 0.7)}</mesh>
        <mesh position={[-0.45, -0.5, 0]}><boxGeometry args={[1.1, 0.09, 0.03]} />{metal("#d4a72c", 0.25)}</mesh>
      </Explodir>
      <Explodir pos={[0, 0, 0]} explode={[0, 0, 0]} t={t}>
        {aletas.map((x) => <mesh key={x} position={[x, 0, 0]}><boxGeometry args={[0.012, 0.8, 0.2]} />{metal("#9aa0a8", 0.3)}</mesh>)}
      </Explodir>
      <Explodir pos={[0, 0, 0.15]} explode={[0, 0, 0.62]} t={t}>
        <mesh><boxGeometry args={[2.42, 1.0, 0.09]} />{plastico("#26272e", 0.3)}</mesh>
        <mesh position={[0, 0.495, 0.02]}><boxGeometry args={[2.2, 0.025, 0.05]} />{luz(cor)}</mesh>
      </Explodir>
      {[-0.56, 0.56].map((x) => (
        <Explodir key={x} pos={[x, 0, 0.22]} explode={[0, 0, 1.05]} t={t}><Ventoinha rot={f * 0.35 + x} /></Explodir>
      ))}
      <Explodir pos={[-1.24, 0, 0]} explode={[-0.6, 0, 0]} t={t}><mesh><boxGeometry args={[0.04, 1.06, 0.42]} />{metal("#c6c9cf", 0.3)}</mesh></Explodir>
    </group>
  );
};

const Cpu: React.FC<{ t: number; cor: string }> = ({ t, cor }) => {
  const pinos = useMemo(() => Array.from({ length: 196 }, (_, i) => [-0.5 + (i % 14) * 0.077, -0.5 + Math.floor(i / 14) * 0.077] as const), []);
  return (
    <group rotation={[-0.5, 0, 0]}>
      <Explodir pos={[0, 0, -0.05]} explode={[0, 0, -0.7]} t={t}>
        {pinos.map(([x, y], i) => <mesh key={i} position={[x, y, 0]}><boxGeometry args={[0.03, 0.03, 0.03]} />{metal("#d4a72c", 0.25)}</mesh>)}
      </Explodir>
      <Explodir pos={[0, 0, 0]} explode={[0, 0, 0]} t={t}><mesh><boxGeometry args={[1.25, 1.25, 0.06]} />{plastico("#1f5135", 0.6)}</mesh></Explodir>
      <Explodir pos={[0, 0, 0.07]} explode={[0, 0, 0.35]} t={t}><mesh><boxGeometry args={[0.42, 0.42, 0.04]} />{plastico("#2b2b33", 0.3)}</mesh></Explodir>
      <Explodir pos={[0, 0, 0.11]} explode={[0, 0, 0.9]} t={t}>
        <mesh><boxGeometry args={[0.98, 0.98, 0.08]} />{metal("#c8ccd2", 0.22)}</mesh>
        <mesh position={[0, -0.36, 0.045]}><boxGeometry args={[0.6, 0.04, 0.005]} />{luz(cor)}</mesh>
      </Explodir>
    </group>
  );
};

const Ssd: React.FC<{ t: number; cor: string }> = ({ t, cor }) => (
  <group rotation={[-0.35, 0, 0]}>
    <Explodir pos={[0, 0, 0]} explode={[0, 0, 0]} t={t}>
      <mesh><boxGeometry args={[2.4, 0.6, 0.03]} />{plastico("#111114", 0.6)}</mesh>
      <mesh position={[-1.13, 0, 0]}><boxGeometry args={[0.14, 0.5, 0.032]} />{metal("#d4a72c", 0.25)}</mesh>
    </Explodir>
    {[-0.55, 0.05, 0.6].map((x, i) => (
      <Explodir key={x} pos={[x, 0, 0.035]} explode={[0, 0, 0.35 + i * 0.12]} t={t}><mesh><boxGeometry args={[0.44, 0.44, 0.04]} />{plastico("#26262c", 0.35)}</mesh></Explodir>
    ))}
    <Explodir pos={[0, 0, 0.07]} explode={[0, 0, 0.95]} t={t}>
      <mesh><boxGeometry args={[2.0, 0.56, 0.01]} />{metal("#1c1c22", 0.5)}</mesh>
      <mesh position={[0.6, 0.18, 0.008]}><boxGeometry args={[0.5, 0.06, 0.005]} />{luz(cor)}</mesh>
    </Explodir>
  </group>
);

const Ram: React.FC<{ t: number; f: number; cor: string }> = ({ t, f, cor }) => (
  <group rotation={[0, 0, 0]}>
    <Explodir pos={[0, 0, 0]} explode={[0, 0, 0]} t={t}>
      <mesh><boxGeometry args={[2.6, 0.62, 0.03]} />{plastico("#0f3a26", 0.65)}</mesh>
      <mesh position={[0, -0.33, 0]}><boxGeometry args={[2.4, 0.06, 0.032]} />{metal("#d4a72c", 0.25)}</mesh>
    </Explodir>
    {[-1, 1].map((lado) => (
      <Explodir key={lado} pos={[0, 0.03, 0.04 * lado]} explode={[0, 0, 0.55 * lado]} t={t}>
        <mesh><boxGeometry args={[2.64, 0.64, 0.025]} />{metal("#202228", 0.35)}</mesh>
      </Explodir>
    ))}
    <Explodir pos={[0, 0.36, 0]} explode={[0, 0.55, 0]} t={t}>
      <mesh><boxGeometry args={[2.5, 0.08, 0.1]} />{luz(cor)}</mesh>
      <mesh position={[((f * 0.04) % 2.5) - 1.25, 0, 0.051]}><boxGeometry args={[0.3, 0.06, 0.002]} /><meshBasicMaterial color="#ffffff" toneMapped={false} /></mesh>
    </Explodir>
  </group>
);

export const Hardware3D: React.FC<{ tipo: "gpu" | "cpu" | "ssd" | "ram"; t: number; f: number; cor: string }> = ({ tipo, t, f, cor }) => {
  if (tipo === "cpu") return <Cpu t={t} cor={cor} />;
  if (tipo === "ssd") return <Ssd t={t} cor={cor} />;
  if (tipo === "ram") return <Ram t={t} f={f} cor={cor} />;
  return <Gpu t={t} f={f} cor={cor} />;
};

// caixa envolvente aproximada de cada modelo procedural (para posicionar etiquetas)
export const CAIXA_PROCEDURAL = { gpu: [2.42, 1.06, 0.5], cpu: [1.25, 1.25, 0.3], ssd: [2.4, 0.6, 0.15], ram: [2.64, 0.8, 0.1] } as const;
