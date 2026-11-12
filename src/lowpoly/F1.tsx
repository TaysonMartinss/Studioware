import { useMemo } from "react";
import * as THREE from "three";
import { Inst, Instancias } from "./Instancias";
import { caixa, cilindro, esfera, mat, rng } from "./util";

// Pacote de Fórmula 1: carro de F1 dos anos 80/90 (sem halo, asa traseira alta, entrada de ar por cima do piloto),
// chuva, spray das rodas, boxes com garagens, pódio e bandeiras. Tudo genérico: cores à escolha, sem marcas.

export const CAPACETE = { base: "#f2d21b", faixa: "#1f9d3a", fio: "#1d3f9a", visor: "#15171c" };

// capacete do piloto (amarelo com faixa verde e fio azul por omissão)
export const CapaceteF1: React.FC<{ r?: number; base?: string }> = ({ r = 0.2, base = CAPACETE.base }) => (
  <group>
    <mesh geometry={esfera(r, 1)} scale={[1, 1.05, 1.08]} material={mat(base, { aspereza: 0.3, metal: 0.2 })} />
    <mesh position-y={-r * 0.25} geometry={cilindro(r * 1.02, r * 1.0, r * 0.28, 12)} material={mat(CAPACETE.faixa)} />
    <mesh position-y={-r * 0.45} geometry={cilindro(r * 0.99, r * 0.95, r * 0.08, 12)} material={mat(CAPACETE.fio)} />
    <mesh position={[0, r * 0.02, r * 0.98]} geometry={caixa(r * 1.3, r * 0.4, r * 0.3)} material={mat(CAPACETE.visor, { aspereza: 0.15, metal: 0.5 })} />
  </group>
);

// spray de água atrás das rodas (chuva): gotas brancas que saem e se desfazem
const Spray: React.FC<{ t: number }> = ({ t }) => (
  <group>
    {Array.from({ length: 14 }, (_, i) => {
      const f = (t * 2.2 + i / 14) % 1;
      const lado = i % 2 ? 1 : -1;
      return (
        <mesh key={i} position={[-1.7 - f * 5, 0.3 + f * 1.4, lado * (0.8 + f * 0.6)]} scale={0.25 + f * 1.4} geometry={esfera(0.5, 0)}
          material={mat("#e8edf2", { opacidade: 0.42 * (1 - f) })} />
      );
    })}
  </group>
);

// carro de F1 (≈4,6 m, frente para +x). `vel` só faz rodar as rodas
export const CarroF1: React.FC<{ cor: string; cor2: string; t: number; vel?: number; capacete?: string; chuva?: boolean }> = ({ cor, cor2, t, vel = 0, capacete, chuva }) => {
  const m = mat(cor, { aspereza: 0.35, metal: 0.25 }), m2 = mat(cor2, { aspereza: 0.35, metal: 0.25 }), preto = mat("#17181b");
  const giro = -t * vel / 0.36;
  return (
    <group>
      {/* fundo plano */}
      <mesh position={[-0.2, 0.12, 0]} geometry={caixa(3.6, 0.06, 1.3)} material={preto} />
      {/* bico e monocoque */}
      <mesh position={[1.5, 0.3, 0]} rotation-z={-0.06} geometry={caixa(1.9, 0.26, 0.42)} material={m} />
      <mesh position={[0.25, 0.42, 0]} geometry={caixa(1.3, 0.42, 0.7)} material={m} />
      <mesh position={[1.2, 0.45, 0]} geometry={caixa(0.9, 0.02, 0.2)} material={m2} />
      {/* pontões laterais */}
      {[1, -1].map((l) => <mesh key={l} position={[-0.3, 0.34, 0.6 * l]} geometry={caixa(1.7, 0.36, 0.5)} material={m} />)}
      {[1, -1].map((l) => <mesh key={l} position={[-0.3, 0.53, 0.6 * l]} geometry={caixa(1.7, 0.03, 0.5)} material={m2} />)}
      {/* tampa do motor e entrada de ar por cima do piloto */}
      <mesh position={[-1.05, 0.58, 0]} rotation-z={0.12} geometry={caixa(1.5, 0.42, 0.55)} material={m} />
      <mesh position={[-0.35, 0.92, 0]} geometry={caixa(0.4, 0.22, 0.32)} material={m} />
      <mesh position={[-0.14, 0.92, 0]} geometry={caixa(0.03, 0.16, 0.22)} material={preto} />
      {/* cockpit, volante e piloto */}
      <mesh position={[0.45, 0.64, 0]} geometry={caixa(0.62, 0.06, 0.46)} material={preto} />
      <mesh position={[0.85, 0.7, 0]} rotation-z={-0.5} geometry={caixa(0.3, 0.02, 0.5)} material={mat("#9fb3c8", { opacidade: 0.5 })} />
      <group position={[0.22, 0.78, 0]} rotation-y={Math.PI / 2}><CapaceteF1 r={0.17} base={capacete} /></group>
      {/* asa da frente com placas laterais */}
      <mesh position={[2.35, 0.1, 0]} geometry={caixa(0.55, 0.05, 1.9)} material={m2} />
      <mesh position={[2.25, 0.18, 0]} geometry={caixa(0.3, 0.04, 1.8)} material={m2} />
      {[1, -1].map((l) => <mesh key={l} position={[2.35, 0.17, 0.95 * l]} geometry={caixa(0.6, 0.22, 0.03)} material={m} />)}
      {/* asa de trás (dois elementos) e placas laterais */}
      <mesh position={[-2.15, 1.02, 0]} geometry={caixa(0.45, 0.05, 1.3)} material={m2} />
      <mesh position={[-2.3, 1.14, 0]} rotation-z={0.25} geometry={caixa(0.28, 0.04, 1.3)} material={m2} />
      {[1, -1].map((l) => <mesh key={l} position={[-2.2, 0.82, 0.66 * l]} geometry={caixa(0.7, 0.75, 0.04)} material={m} />)}
      <mesh position={[-2.05, 0.68, 0]} geometry={caixa(0.12, 0.5, 0.1)} material={preto} />
      {/* rodas: atrás maiores e mais largas */}
      {([[1.55, 0.86, 0.32, 0.36], [-1.45, 0.9, 0.38, 0.5]] as const).map(([x, z, r, w]) => [1, -1].map((l) => (
        <group key={`${x}${l}`} position={[x, r, z * l]}>
          <mesh rotation={[Math.PI / 2, giro, 0]} geometry={cilindro(r, r, w, 10)} material={preto} />
          <mesh position-z={(w / 2 + 0.005) * l} rotation-x={Math.PI / 2} geometry={cilindro(r * 0.55, r * 0.55, 0.01, 10)} material={mat("#8d939c", { metal: 0.6 })} />
        </group>
      )))}
      {/* braços da suspensão */}
      {[1.55, -1.45].map((x) => [1, -1].map((l) => <mesh key={`${x}${l}`} position={[x, 0.36, 0.45 * l]} geometry={caixa(0.05, 0.03, 0.75)} material={preto} />))}
      {chuva && vel > 1 && <Spray t={t} />}
      {chuva && <mesh position={[-2.45, 0.45, 0]} geometry={caixa(0.05, 0.06, 0.12)} material={mat("#ff2a1f", { emissivo: "#ff2a1f", brilho: Math.sin(t * 12) > 0 ? 3 : 0.3 })} />}
    </group>
  );
};

// chuva: riscos a cair à volta do palco (o mesmo frame dá sempre a mesma imagem)
export const Chuva: React.FC<{ t: number; n?: number }> = ({ t, n = 1400 }) => {
  const gotas = useMemo(() => {
    const r = rng(31), g: Inst[] = [];
    for (let i = 0; i < n; i++) g.push({ p: [(r() - 0.5) * 70, r() * 22, 8 - r() * 40], s: [1, 0.7 + r() * 0.6, 1] });
    return g;
  }, [n]);
  return (
    <Instancias itens={gotas} geometria={caixa(0.025, 0.7, 0.025)} material={mat("#c9d6e2", { opacidade: 0.55 })} t={t}
      mover={(_, it, tt, o) => { o.position.y = ((((it.p[1] - tt * 24) % 22) + 22) % 22); o.rotation.z = 0.12; }} />
  );
};

// céu cinzento de chuva (fica por dentro da cúpula do céu)
export const CeuChuva: React.FC = () => (
  <>
    <mesh>
      <sphereGeometry args={[380, 16, 8]} />
      <meshBasicMaterial color="#7d8691" side={THREE.BackSide} fog={false} depthWrite={false} />
    </mesh>
    <fog attach="fog" args={["#8b939d", 18, 150]} />
  </>
);

// bandeiras (tecido de 1 × 0,7 à escala 1, a ondular)
export const BandeiraXadrez: React.FC<{ t: number; l?: number; a?: number }> = ({ t, l = 0.32, a = 0.22 }) => {
  const nx = 6, ny = 4;
  return (
    <group rotation-y={0.25 * Math.sin(t * 6)}>
      <mesh geometry={caixa(l, a, 0.008)} material={mat("#f4f4f4", { ladoDuplo: true })} />
      {Array.from({ length: nx * ny }, (_, k) => {
        const i = k % nx, j = Math.floor(k / nx);
        if ((i + j) % 2) return null;
        return [1, -1].map((s) => <mesh key={`${k}${s}`} position={[-l / 2 + (i + 0.5) * (l / nx), -a / 2 + (j + 0.5) * (a / ny), 0.005 * s]} geometry={caixa(l / nx, a / ny, 0.002)} material={mat("#151515")} />);
      })}
    </group>
  );
};
export const BandeiraBrasil: React.FC<{ t: number; l?: number; a?: number }> = ({ t, l = 0.32, a = 0.22 }) => (
  <group rotation-y={0.25 * Math.sin(t * 6)}>
    <mesh geometry={caixa(l, a, 0.008)} material={mat("#1f9d3a", { ladoDuplo: true })} />
    {[1, -1].map((s) => (
      <group key={s} position-z={0.005 * s}>
        {/* losango amarelo: quadrado rodado 45° e esticado na horizontal */}
        <group scale={[l / a, 1, 1]}><mesh rotation-z={Math.PI / 4} geometry={caixa(a * 0.6, a * 0.6, 0.002)} material={mat("#f2d21b")} /></group>
        <mesh position-z={0.002 * s} rotation-x={Math.PI / 2} geometry={cilindro(a * 0.2, a * 0.2, 0.002, 14)} material={mat("#1d3f9a")} />
        <mesh position-z={0.003 * s} rotation-z={-0.12} geometry={caixa(a * 0.42, a * 0.035, 0.002)} material={mat("#f4f4f4")} />
      </group>
    ))}
  </group>
);

// garrafa de champanhe com o jato de espuma
export const Champanhe: React.FC<{ t: number; jato?: boolean }> = ({ t, jato = true }) => (
  <group>
    <mesh position-y={0.1} geometry={cilindro(0.04, 0.045, 0.2, 8)} material={mat("#1d4d2a", { aspereza: 0.2, metal: 0.3 })} />
    <mesh position-y={0.24} geometry={cilindro(0.016, 0.038, 0.09, 8)} material={mat("#d8b24a", { metal: 0.7, aspereza: 0.3 })} />
    {jato && Array.from({ length: 12 }, (_, i) => {
      const f = (t * 1.8 + i / 12) % 1;
      return <mesh key={i} position={[Math.sin(i * 2.3) * 0.08 * f, 0.3 + f * 1.1, f * 0.5 - f * f * 0.3]} scale={0.4 + f * 1.3} geometry={esfera(0.035, 0)} material={mat("#fbf6df", { opacidade: 0.85 * (1 - f * 0.8) })} />;
    })}
  </group>
);

// pódio: um degrau por baixo de cada personagem (1.º mais alto) e o painel atrás
export const ALTURA_PODIO = [0, 0.9, 0.6, 0.4];
export const DegrauPodio: React.FC<{ lugar: number; cor: string }> = ({ lugar, cor }) => {
  const a = ALTURA_PODIO[lugar] ?? 0;
  if (!a) return null;
  return (
    <group>
      <mesh position-y={a / 2} geometry={caixa(0.95, a, 0.9)} material={mat("#eef0f3")} />
      <mesh position={[0, a - 0.03, 0]} geometry={caixa(0.97, 0.06, 0.92)} material={mat(cor)} />
      {/* número do lugar em traços (1, 2 ou 3) */}
      {Array.from({ length: lugar }, (_, k) => <mesh key={k} position={[(k - (lugar - 1) / 2) * 0.12, a * 0.5, 0.455]} geometry={caixa(0.05, Math.min(0.28, a * 0.5), 0.01)} material={mat(cor)} />)}
    </group>
  );
};
export const PainelPodio: React.FC<{ cor: string; cor2: string }> = ({ cor, cor2 }) => (
  <group position={[0, 0, -1.8]}>
    <mesh position-y={2} geometry={caixa(7, 4, 0.2)} material={mat(cor2)} />
    <mesh position-y={3.5} geometry={caixa(7, 0.35, 0.22)} material={mat(cor)} />
    {/* faixa xadrez em baixo */}
    {Array.from({ length: 28 }, (_, i) => [0, 1].map((j) => <mesh key={`${i}${j}`} position={[-3.5 + 0.125 + i * 0.25, 0.15 + j * 0.25, 0.11]} geometry={caixa(0.25, 0.25, 0.01)} material={mat((i + j) % 2 ? "#151515" : "#f4f4f4")} />))}
    <mesh position-y={0.02} geometry={caixa(7.5, 0.04, 3.2)} material={mat("#3a3d44")} />
  </group>
);

// boxes: três garagens abertas viradas para o pit lane, pneus empilhados, carrinhos de ferramentas e um carro parado
export const Boxes: React.FC<{ t: number; cor: string; cor2: string }> = ({ t, cor, cor2 }) => {
  const pneus = useMemo(() => {
    const r = rng(12), p: Inst[] = [];
    [-7.6, -4.4, 4.4, 7.6].forEach((x) => { for (let k = 0; k < 3 + Math.floor(r() * 2); k++) p.push({ p: [x, 0.17 + k * 0.32, -7.2], r: r() }); });
    return p;
  }, []);
  return (
    <group>
      <mesh position={[0, -0.02, -2]} geometry={caixa(200, 0.02, 30)} material={mat("#3a3c41")} />
      <mesh position={[0, 0.005, 2.4]} geometry={caixa(200, 0.02, 0.15)} material={mat("#f4f4f4")} />
      <mesh position={[0, 0.005, -4.8]} geometry={caixa(200, 0.02, 0.12)} material={mat("#f2d21b")} />
      {/* edifício das garagens */}
      <mesh position={[0, 2.5, -11]} geometry={caixa(60, 5, 0.3)} material={mat("#d9dde3")} />
      <mesh position={[0, 5.4, -8]} geometry={caixa(60, 0.8, 6.4)} material={mat("#c4c9d0")} />
      <mesh position={[0, 5.0, -4.85]} geometry={caixa(60, 0.6, 0.1)} material={mat(cor2)} />
      {[-15, -5, 5, 15].map((x) => <mesh key={x} position={[x, 2.5, -8]} geometry={caixa(0.3, 5, 6)} material={mat("#bfc4cb")} />)}
      {/* chão de garagem claro e luzes no teto */}
      <mesh position={[0, 0.0, -8]} geometry={caixa(60, 0.02, 6)} material={mat("#aeb4bc")} />
      {[-10, 0, 10].map((x) => <mesh key={x} position={[x, 4.95, -8]} geometry={caixa(6, 0.05, 0.4)} material={mat("#ffffff", { emissivo: "#ffffff", brilho: 1.5 })} />)}
      {/* parede do fundo de cada box com a cor da equipa e monitores */}
      {[-10, 0, 10].map((x) => (
        <group key={x} position={[x, 0, -10.8]}>
          <mesh position-y={1.6} geometry={caixa(9.4, 3.2, 0.05)} material={mat(cor)} />
          <mesh position={[0, 2.4, 0.05]} geometry={caixa(1.6, 0.9, 0.05)} material={mat("#0e1420", { emissivo: "#3fa0ff", brilho: 0.5 + 0.2 * Math.sin(t * 2 + x) })} />
          <mesh position={[2, 2.4, 0.05]} geometry={caixa(1.6, 0.9, 0.05)} material={mat("#0e1420", { emissivo: "#59e08a", brilho: 0.5 })} />
        </group>
      ))}
      <Instancias itens={pneus} geometria={cilindro(0.33, 0.33, 0.3, 10)} material={mat("#16171a")} />
      {[-2.6, 2.6].map((x) => (
        <group key={x} position={[x, 0, -7.6]}>
          <mesh position-y={0.55} geometry={caixa(0.9, 0.9, 0.5)} material={mat("#c0392b")} />
          {[0.3, 0.55, 0.8].map((y) => <mesh key={y} position={[0, y, 0.26]} geometry={caixa(0.8, 0.02, 0.01)} material={mat("#7a1f17")} />)}
        </group>
      ))}
      <group position={[0, 0, -7]}><CarroF1 cor={cor} cor2={cor2} t={t} /></group>
      {/* torre de pit (os engenheiros) ao lado do pit lane */}
      <group position={[-12, 0, 1.2]}>
        <mesh position-y={1} geometry={caixa(2.4, 2, 1)} material={mat("#2a2d33")} />
        <mesh position={[0, 1.6, 0.51]} geometry={caixa(2, 0.6, 0.02)} material={mat("#0e1420", { emissivo: "#3fa0ff", brilho: 0.6 })} />
      </group>
    </group>
  );
};

// homenagem: flores ao pé do muro
export const Flores: React.FC<{ largura?: number }> = ({ largura = 8 }) => {
  const f = useMemo(() => {
    const r = rng(5), i: Inst[] = [];
    const cores = ["#f2d21b", "#1f9d3a", "#f4f4f4", "#e5281f", "#ff8ab8", "#1d3f9a"];
    for (let k = 0; k < 160; k++) i.push({ p: [(r() - 0.5) * largura, 0.12 + r() * 0.35, -10.5 + r() * 0.8], s: 0.7 + r() * 0.6, cor: cores[k % cores.length] });
    return i;
  }, [largura]);
  return <Instancias itens={f} geometria={esfera(0.12, 0)} material={mat("#ffffff")} />;
};
