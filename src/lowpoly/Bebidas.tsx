import { caixa, cilindro, mat } from "./util";

// ---------- bebidas (também na mão do boneco) ----------
export const Garrafa: React.FC<{ cor?: string; rotulo?: string; alta?: number }> = ({ cor = "#cfe9f2", rotulo = "#f2efe6", alta = 1 }) => {
  const vidro = mat(cor, { opacidade: 0.78, aspereza: 0.12, metal: 0.1 });
  return (
    <group scale={[1, alta, 1]}>
      <mesh position-y={0.11} geometry={cilindro(0.045, 0.05, 0.22, 8)} material={vidro} />
      <mesh position-y={0.255} geometry={cilindro(0.017, 0.045, 0.07, 8)} material={vidro} />
      <mesh position-y={0.31} geometry={cilindro(0.017, 0.017, 0.05, 8)} material={vidro} />
      <mesh position-y={0.345} geometry={cilindro(0.02, 0.02, 0.025, 8)} material={mat("#2a2a2a")} />
      <mesh position-y={0.1} geometry={cilindro(0.051, 0.051, 0.085, 8)} material={mat(rotulo)} />
    </group>
  );
};
// gin tônica: copo balão com gelo, rodela de limão e palhinha
export const CopoGin: React.FC<{ cheio?: number }> = ({ cheio = 0.75 }) => (
  <group>
    <mesh position-y={0.075} geometry={cilindro(0.058, 0.04, 0.15, 10)} material={mat("#e6f6ff", { opacidade: 0.5, aspereza: 0.08, emissivo: "#ffffff", brilho: 0.15 })} />
    <mesh position-y={0.075 * cheio + 0.005} geometry={cilindro(0.052, 0.038, 0.15 * cheio, 10)} material={mat("#d5f1ff", { opacidade: 0.6, emissivo: "#aee4ff", brilho: 0.2 })} />
    {[[-0.015, 0.1, 0.01, 0.4], [0.018, 0.085, -0.01, 1.1], [0.0, 0.07, 0.02, 2]].map(([x, y, z, r], i) => (
      <mesh key={i} position={[x, y, z]} rotation={[r, r * 0.7, 0]} geometry={caixa(0.03, 0.03, 0.03)} material={mat("#f4fbff", { opacidade: 0.8 })} />
    ))}
    <mesh position={[0.045, 0.15, 0]} rotation-z={1.2} geometry={cilindro(0.03, 0.03, 0.008, 8)} material={mat("#a6d63a")} />
    <mesh position={[-0.02, 0.17, 0.01]} rotation-z={0.25} geometry={cilindro(0.004, 0.004, 0.2, 5)} material={mat("#ff3b6b")} />
  </group>
);
