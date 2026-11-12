import { Hora, LUZ } from "./ambiente";
import { arcoIris, caixa, cilindro, esfera, mat } from "./util";

// Quarto gamer (enquadramento de streamer): as personagens ficam à frente, de cara para a câmara, e atrás delas
// está o setup: secretária com dois monitores, PC com vidro e RGB, fita de LED na parede, cama, prateleira,
// posters e uma janela com o céu da hora do dia. A luz é quente no teto e colorida pelo RGB.

const PAREDE_Z = -2.6;

export const Quarto: React.FC<{ hora: Hora; t: number; cor: string; cor2: string }> = ({ hora, t, cor, cor2 }) => {
  const rgb = arcoIris(t), rgb2 = arcoIris(t, 0.33), rgb3 = arcoIris(t, 0.66);
  const noite = hora === "noite";
  const ecra = (c: string) => mat("#0b0f18", { emissivo: c, brilho: 0.9 });
  return (
    <group>
      <hemisphereLight args={["#fff1dd", "#3a2f3a", noite ? 0.45 : 0.75]} />
      <ambientLight intensity={0.25} />
      <pointLight position={[0.5, 2.7, 1.2]} intensity={noite ? 9 : 14} distance={12} color="#ffe3bf" />
      <pointLight position={[0, 1.6, PAREDE_Z + 0.4]} intensity={7} distance={6} color={rgb} />
      <directionalLight position={[3, 5, 6]} intensity={noite ? 0.4 : 1.1} color="#fff6ea" />

      {/* chão de madeira (tábuas), tapete, paredes */}
      {Array.from({ length: 12 }, (_, i) => <mesh key={i} position={[-4.4 + i * 0.8, 0, 0.6]} geometry={caixa(0.78, 0.04, 7.4)} material={mat(i % 2 ? "#8a5e3c" : "#94673f")} />)}
      <mesh position={[0, 0.03, 0.4]} geometry={cilindro(1.6, 1.6, 0.02, 10)} material={mat(cor2)} />
      <mesh position={[0, 1.6, PAREDE_Z]} geometry={caixa(9, 3.4, 0.12)} material={mat("#2d3142")} />
      <mesh position={[-4.4, 1.6, 0.6]} geometry={caixa(0.12, 3.4, 7.4)} material={mat("#343a4f")} />
      <mesh position={[4.4, 1.6, 0.6]} geometry={caixa(0.12, 3.4, 7.4)} material={mat("#343a4f")} />
      {/* fita de LED a correr a parede de cima */}
      <mesh position={[0, 3.05, PAREDE_Z + 0.08]} geometry={caixa(8.6, 0.05, 0.04)} material={mat("#111111", { emissivo: rgb, brilho: 2.2 })} />
      {/* posters e painel de som */}
      <mesh position={[-2.2, 2.05, PAREDE_Z + 0.07]} geometry={caixa(0.9, 1.25, 0.02)} material={mat(cor, { emissivo: cor, brilho: 0.25 })} />
      <mesh position={[-2.2, 2.05, PAREDE_Z + 0.085]} geometry={esfera(0.25, 0)} material={mat("#ffffff", { emissivo: "#ffffff", brilho: 0.3 })} />
      <mesh position={[2.3, 2.15, PAREDE_Z + 0.07]} geometry={caixa(1.3, 0.8, 0.02)} material={mat("#1f2433", { emissivo: rgb3, brilho: 0.35 })} />
      {Array.from({ length: 6 }, (_, i) => <mesh key={i} position={[1.85 + (i % 3) * 0.32, 1.45 + Math.floor(i / 3) * 0.32, PAREDE_Z + 0.09]} geometry={caixa(0.28, 0.28, 0.05)} material={mat(i % 2 ? "#2a2f3e" : "#232838")} />)}

      {/* secretária com dois monitores, teclado e rato */}
      <group position={[0, 0, PAREDE_Z + 0.55]}>
        <mesh position-y={0.76} geometry={caixa(2.4, 0.06, 0.8)} material={mat("#1b1e26")} />
        {[-1.1, 1.1].map((x) => <mesh key={x} position={[x, 0.37, 0]} geometry={caixa(0.06, 0.74, 0.7)} material={mat("#12141a")} />)}
        {[-0.42, 0.42].map((x, i) => (
          <group key={x} position={[x, 0.79, -0.1]} rotation-y={-x * 0.35}>
            <mesh position-y={0.14} geometry={cilindro(0.03, 0.05, 0.28, 5)} material={mat("#22252d")} />
            <mesh position-y={0.47} geometry={caixa(0.78, 0.46, 0.05)} material={mat("#15171d")} />
            <mesh position={[0, 0.47, 0.03]} geometry={caixa(0.72, 0.4, 0.01)} material={ecra(i ? rgb2 : cor)} />
          </group>
        ))}
        <mesh position={[0, 0.8, 0.18]} geometry={caixa(0.7, 0.03, 0.2)} material={mat("#111111", { emissivo: rgb3, brilho: 0.8 })} />
        <mesh position={[0.5, 0.8, 0.2]} geometry={caixa(0.08, 0.03, 0.12)} material={mat("#111111", { emissivo: rgb, brilho: 0.8 })} />
        {/* candeeiro de secretária e caneca */}
        <mesh position={[-0.95, 0.88, 0.1]} geometry={cilindro(0.06, 0.05, 0.16, 6)} material={mat(cor2)} />
      </group>
      {/* PC com vidro lateral e ventoinhas RGB */}
      <group position={[1.65, 0, PAREDE_Z + 0.6]} rotation-y={-0.5}>
        <mesh position-y={0.52} geometry={caixa(0.3, 1.04, 0.62)} material={mat("#16181f")} />
        <mesh position={[-0.155, 0.52, 0]} geometry={caixa(0.01, 0.96, 0.56)} material={mat("#0b0d12", { emissivo: rgb2, brilho: 0.35 })} />
        {[0.78, 0.48, 0.18].map((y) => <mesh key={y} position={[-0.16, y, 0.05]} rotation-z={Math.PI / 2} geometry={cilindro(0.11, 0.11, 0.02, 10)} material={mat("#000000", { emissivo: rgb, brilho: 1.6 })} />)}
      </group>
      {/* cama encostada à esquerda */}
      <group position={[-3.3, 0, 0.4]}>
        <mesh position-y={0.25} geometry={caixa(1.6, 0.5, 2.3)} material={mat("#4a3a2c")} />
        <mesh position-y={0.55} geometry={caixa(1.5, 0.15, 2.2)} material={mat("#e8e4dc")} />
        <mesh position={[0, 0.66, 0.35]} geometry={caixa(1.52, 0.12, 1.4)} material={mat(cor2)} />
        <mesh position={[0, 0.72, -0.8]} geometry={caixa(1.1, 0.18, 0.45)} material={mat("#f4f1ea")} />
      </group>
      {/* prateleira com figuras */}
      <group position={[-1.0, 1.95, PAREDE_Z + 0.18]}>
        <mesh geometry={caixa(1.0, 0.05, 0.25)} material={mat("#6b4a2e")} />
        {[cor, "#f2c12e", "#3aa66a", cor2].map((c, i) => <mesh key={i} position={[-0.36 + i * 0.24, 0.12, 0]} geometry={i % 2 ? esfera(0.08, 0) : caixa(0.12, 0.2, 0.1)} material={mat(c)} />)}
      </group>
      {/* janela na parede da direita com o céu da hora */}
      <group position={[4.33, 1.75, 0.2]} rotation-y={-Math.PI / 2}>
        <mesh geometry={caixa(1.7, 1.3, 0.04)} material={mat(LUZ[hora].horizonte, { emissivo: LUZ[hora].horizonte, brilho: noite ? 0.3 : 0.8 })} />
        <mesh position-z={0.03} geometry={caixa(1.8, 0.06, 0.04)} material={mat("#e9e6df")} />
        <mesh position-z={0.03} geometry={caixa(0.06, 1.4, 0.04)} material={mat("#e9e6df")} />
      </group>
      {/* planta no canto */}
      <group position={[3.6, 0, -1.9]}>
        <mesh position-y={0.25} geometry={cilindro(0.22, 0.17, 0.5, 6)} material={mat("#c76b4a")} />
        {[0, 1, 2, 3].map((i) => <mesh key={i} position={[Math.cos(i * 1.6) * 0.15, 0.75 + i * 0.12, Math.sin(i * 1.6) * 0.15]} geometry={esfera(0.22, 0)} material={mat(i % 2 ? "#3f8f3c" : "#4fa14a")} />)}
      </group>
    </group>
  );
};

// Cadeira gamer (aparece debaixo de quem está sentado), virada para a câmara
export const CadeiraGamer: React.FC<{ cor: string }> = ({ cor }) => (
  <group>
    <mesh position-y={0.25} geometry={cilindro(0.04, 0.04, 0.3, 5)} material={mat("#22252c")} />
    {[0, 1, 2, 3, 4].map((i) => <mesh key={i} position={[Math.cos(i * 1.257) * 0.26, 0.06, Math.sin(i * 1.257) * 0.26]} rotation-y={-i * 1.257} geometry={caixa(0.5, 0.05, 0.06)} material={mat("#22252c")} />)}
    <mesh position-y={0.45} geometry={caixa(0.56, 0.1, 0.55)} material={mat("#1e2028")} />
    <mesh position={[0, 0.95, -0.27]} rotation-x={-0.12} geometry={caixa(0.56, 0.95, 0.1)} material={mat("#1e2028")} />
    <mesh position={[0, 0.95, -0.21]} rotation-x={-0.12} geometry={caixa(0.18, 0.85, 0.02)} material={mat(cor)} />
    {[1, -1].map((l) => <mesh key={l} position={[0.3 * l, 0.62, 0]} geometry={caixa(0.06, 0.06, 0.4)} material={mat("#1e2028")} />)}
  </group>
);
