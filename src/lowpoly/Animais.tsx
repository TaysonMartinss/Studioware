import { useMemo } from "react";
import * as THREE from "three";
import { caixa, cilindro, cone, esfera, mat, rng } from "./util";

// Animais low poly animados: dinossauros (de perfil, virados para +x) e peixes em cardume.
// `acao`: andar (as patas e a cauda balançam), rugir (cabeça para cima, boca aberta) ou parado (respira).

type Acao = "andar" | "rugir" | "parado";
const S = Math.sin;

// ---------- tiranossauro (~4,5 m de altura) ----------
export const Tiranossauro: React.FC<{ t: number; acao?: Acao; cor?: string }> = ({ t, acao = "andar", cor = "#5f8f3e" }) => {
  const anda = acao === "andar" ? 1 : 0, ruge = acao === "rugir" ? 1 : 0;
  const a = t * 3.2;
  const corpo = mat(cor), barriga = mat("#c9b98a"), escuro = mat("#2f4a22");
  const perna = (lado: number, fase: number) => (
    <group position={[0.2, 2.15, 0.45 * lado]} rotation-z={anda * 0.5 * S(a + fase)}>
      <mesh position={[0, -0.6, 0]} geometry={cilindro(0.38, 0.28, 1.3, 6)} material={corpo} />
      <group position-y={-1.2} rotation-z={-anda * 0.35 * Math.max(0, S(a + fase + 1))}>
        <mesh position={[0.1, -0.45, 0]} rotation-z={0.25} geometry={cilindro(0.2, 0.16, 0.95, 6)} material={corpo} />
        <mesh position={[0.35, -0.9, 0]} geometry={caixa(0.75, 0.16, 0.38)} material={escuro} />
      </group>
    </group>
  );
  const respira = 0.04 * S(t * 2);
  return (
    <group position-y={anda * 0.08 * Math.abs(S(a))}>
      {perna(1, 0)}
      {perna(-1, Math.PI)}
      {/* corpo inclinado, cauda e pescoço */}
      <group position={[0.3, 2.7 + respira, 0]} rotation-z={-0.18 + 0.1 * ruge}>
        <mesh scale={[1.6, 0.85, 0.8]} geometry={esfera(1, 1)} material={corpo} />
        <mesh position={[0.2, -0.35, 0]} scale={[1.2, 0.5, 0.6]} geometry={esfera(1, 1)} material={barriga} />
        <group position={[-1.4, 0.05, 0]} rotation-z={-0.08 + 0.12 * S(a * 0.5) * anda}>
          <mesh position={[-1.4, 0, 0]} rotation-z={Math.PI / 2} geometry={cone(0.6, 3.2, 6)} material={corpo} />
        </group>
        {/* braços pequenos */}
        {[1, -1].map((l) => <mesh key={l} position={[1.05, -0.25, 0.45 * l]} rotation-z={-0.9 + 0.15 * S(t * 4)} geometry={cilindro(0.08, 0.06, 0.55, 5)} material={corpo} />)}
        {/* cabeça */}
        <group position={[1.55, 0.75, 0]} rotation-z={0.15 + 0.5 * ruge + 0.05 * S(t * 2.5)}>
          <mesh position={[0, -0.1, 0]} rotation-z={-0.6} geometry={cilindro(0.38, 0.45, 0.8, 6)} material={corpo} />
          <mesh position={[0.55, 0.25, 0]} geometry={caixa(1.2, 0.5, 0.6)} material={corpo} />
          <group position={[0.05, 0.05, 0]} rotation-z={-(0.12 + 0.55 * ruge * (0.6 + 0.4 * S(t * 9)))}>
            <mesh position={[0.55, -0.06, 0]} geometry={caixa(1.1, 0.2, 0.52)} material={barriga} />
          </group>
          {[1, -1].map((l) => <mesh key={l} position={[0.65, 0.42, 0.31 * l]} geometry={esfera(0.07, 0)} material={mat("#ffcf3a", { emissivo: "#ff9a1a", brilho: 0.4 })} />)}
          {Array.from({ length: 5 }, (_, i) => <mesh key={i} position={[0.25 + i * 0.2, 0.0, 0.2]} rotation-x={Math.PI} geometry={cone(0.04, 0.12, 4)} material={mat("#f4f1e6")} />)}
        </group>
      </group>
    </group>
  );
};

// ---------- braquiossauro (pescoço comprido, ~10 m) ----------
export const Braquiossauro: React.FC<{ t: number; acao?: Acao; cor?: string }> = ({ t, acao = "andar", cor = "#7d8a6a" }) => {
  const anda = acao === "andar" ? 1 : 0;
  const a = t * 1.6;
  const corpo = mat(cor);
  const pata = (x: number, z: number, fase: number) => (
    <group position={[x, 3.4, z]} rotation-z={anda * 0.25 * S(a + fase)}>
      <mesh position-y={-1.7} geometry={cilindro(0.42, 0.38, 3.4, 6)} material={corpo} />
    </group>
  );
  return (
    <group>
      {pata(1.6, 0.8, 0)}{pata(1.6, -0.8, Math.PI)}{pata(-1.4, 0.8, Math.PI)}{pata(-1.4, -0.8, 0)}
      <mesh position={[0.1, 4.2, 0]} scale={[2.8, 1.5, 1.4]} geometry={esfera(1, 1)} material={corpo} />
      <group position={[-2.4, 4.0, 0]} rotation-z={0.15 * S(a * 0.7)}>
        <mesh position={[-2, -0.3, 0]} rotation-z={Math.PI / 2 + 0.15} geometry={cone(0.7, 4.4, 6)} material={corpo} />
      </group>
      <group position={[2.3, 4.8, 0]} rotation-z={-0.85 + 0.05 * S(t * 0.9)}>
        <mesh position-y={2.6} geometry={cilindro(0.3, 0.6, 5.4, 6)} material={corpo} />
        <group position-y={5.4} rotation-z={0.9}>
          <mesh position={[0.35, 0, 0]} scale={[1.6, 0.8, 0.8]} geometry={esfera(0.38, 1)} material={corpo} />
          {[1, -1].map((l) => <mesh key={l} position={[0.55, 0.12, 0.26 * l]} geometry={esfera(0.05, 0)} material={mat("#111")} />)}
        </group>
      </group>
    </group>
  );
};

// ---------- pterossauro (voa às voltas) ----------
export const Pterossauro: React.FC<{ t: number; cor?: string; raio?: number; fase?: number }> = ({ t, cor = "#a0563a", raio = 9, fase = 0 }) => {
  const a = t * 0.45 + fase;
  const bate = S(t * 5 + fase) * 0.55;
  const m = mat(cor);
  return (
    <group position={[Math.cos(a) * raio, 9 + S(t * 0.8 + fase) * 1.2, Math.sin(a) * raio - 6]} rotation-y={-a - Math.PI / 2}>
      <mesh rotation-z={Math.PI / 2} geometry={cilindro(0.18, 0.12, 1.4, 5)} material={m} />
      <mesh position={[0.85, 0.1, 0]} rotation-z={-Math.PI / 2 + 0.2} geometry={cone(0.14, 0.8, 5)} material={m} />
      <mesh position={[0.6, 0.35, 0]} rotation-z={0.6} geometry={cone(0.08, 0.6, 4)} material={mat("#d9783a")} />
      {[1, -1].map((l) => (
        <group key={l} position={[0.1, 0.05, 0.1 * l]} rotation-x={l * bate}>
          <mesh position={[0, 0, 1.3 * l]} scale={[1, 0.08, 1]} geometry={caixa(0.9, 1, 2.6)} material={mat(cor, { ladoDuplo: true })} />
        </group>
      ))}
    </group>
  );
};

// ---------- peixes em cardume ----------
const CORES_PEIXE = ["#ffb02a", "#ff6a3a", "#3fb7e5", "#f2e14a", "#e5487f", "#8adf6a"];
export const Cardume: React.FC<{ t: number; n?: number; centro: [number, number, number]; raio?: number; semente?: number }> = ({ t, n = 14, centro, raio = 3, semente = 1 }) => {
  const peixes = useMemo(() => {
    const r = rng(semente * 13);
    const cor = CORES_PEIXE[Math.floor(r() * CORES_PEIXE.length)];
    return Array.from({ length: n }, () => ({ fase: r() * Math.PI * 2, dr: (r() - 0.5) * 1.2, dy: (r() - 0.5) * 1.4, v: 0.35 + r() * 0.1, cor: r() < 0.8 ? cor : CORES_PEIXE[Math.floor(r() * CORES_PEIXE.length)], s: 0.7 + r() * 0.5 }));
  }, [n, semente]);
  return (
    <group position={centro}>
      {peixes.map((p, i) => {
        const a = t * p.v + p.fase, rr = raio + p.dr;
        return (
          <group key={i} position={[Math.cos(a) * rr, p.dy + 0.3 * S(t * 1.3 + p.fase), Math.sin(a) * rr]} rotation-y={-a} scale={p.s}>
            <mesh rotation-z={-Math.PI / 2} scale={[0.6, 1, 1]} geometry={cone(0.14, 0.42, 5)} material={mat(p.cor)} />
            <mesh position={[-0.27, 0, 0]} rotation-y={0.4 * S(t * 12 + p.fase)} geometry={caixa(0.14, 0.2, 0.02)} material={mat(p.cor, { ladoDuplo: true })} />
          </group>
        );
      })}
    </group>
  );
};

// peixe grande solitário (tubarão ou baleia) que passa ao fundo
export const PeixeGrande: React.FC<{ t: number; tipo?: "tubarao" | "baleia"; z?: number; y?: number }> = ({ t, tipo = "tubarao", z = -14, y = 4 }) => {
  const baleia = tipo === "baleia";
  const x = ((t * (baleia ? 1.5 : 3) + 30) % 60) - 30;
  const cor = baleia ? "#3d5a7a" : "#7d8a99";
  return (
    <group position={[x, y + S(t * 0.6) * 0.4, z]} scale={baleia ? 3 : 1.4}>
      <mesh scale={[1.6, 0.55, 0.55]} geometry={esfera(1, 1)} material={mat(cor)} />
      <mesh position={[0.2, -0.2, 0]} scale={[1.3, 0.35, 0.45]} geometry={esfera(1, 1)} material={mat("#e6ecf2")} />
      <group position={[-1.5, 0, 0]} rotation-y={0.35 * S(t * (baleia ? 2 : 4))}>
        <mesh position={[-0.35, 0, 0]} rotation-z={baleia ? Math.PI / 2 : 0} scale={[0.25, 1.1, 0.08]} geometry={caixa(1, 1, 1)} material={mat(cor)} />
      </group>
      {!baleia && <mesh position={[0.1, 0.6, 0]} rotation-z={-0.4} geometry={cone(0.3, 0.7, 4)} material={mat(cor)} />}
    </group>
  );
};
