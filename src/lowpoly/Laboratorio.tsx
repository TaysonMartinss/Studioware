import { useMemo } from "react";
import * as THREE from "three";
import { Objeto, ObjetoCena } from "./Objetos";
import { caixa, cilindro, cone, esfera, mat, rng } from "./util";

// Laboratório: bancada ao fundo com frascos a borbulhar, tubos de ensaio, microscópio, quadro branco com uma
// molécula e um gráfico desenhados, tabela periódica na parede, estantes com frascos e uma hotte com vidro.
// As personagens ficam à frente, viradas para a câmara (como no quarto gamer).

const PAREDE = -2.6;
const frasco = (cor: string, x: number): ObjetoCena => ({ tipo: "frasco", posicao: [x, 1.17, PAREDE + 0.6], escala: 0.8, quando: 0, cor, cor2: cor, girar: false });

export const Laboratorio: React.FC<{ t: number; cor: string; cor2: string }> = ({ t, cor, cor2 }) => {
  const tabela = useMemo(() => {
    const r = rng(3), cores = ["#e5483f", "#f2c12e", "#3aa66a", "#3f8fe5", "#8a4fd1", "#f08a3a", "#9aa3ad"];
    const out: { x: number; y: number; cor: string }[] = [];
    for (let row = 0; row < 7; row++) for (let col = 0; col < 18; col++) {
      if (row === 0 && col > 0 && col < 17) continue;
      if ((row === 1 || row === 2) && col > 1 && col < 12) continue;
      out.push({ x: col * 0.085, y: -row * 0.085, cor: cores[Math.floor(r() * cores.length)] });
    }
    return out;
  }, []);
  const linhaGrafico = useMemo(() => {
    const pts = Array.from({ length: 30 }, (_, i) => new THREE.Vector3(i * 0.04, Math.sin(i * 0.35) * 0.18 + i * 0.008, 0));
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: cor }));
  }, [cor]);
  return (
    <group>
      <hemisphereLight args={["#f2f8ff", "#5a6470", 0.9]} />
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 2.9, 0.8]} intensity={16} distance={14} color="#f4f9ff" />
      <directionalLight position={[3, 5, 6]} intensity={0.9} color="#ffffff" />

      {/* chão em mosaico, paredes, painéis de luz no teto */}
      {Array.from({ length: 12 * 9 }, (_, i) => {
        const x = (i % 12) - 5.5, z = Math.floor(i / 12) - 2.1;
        return <mesh key={i} position={[x * 0.8, 0, z * 0.8]} geometry={caixa(0.78, 0.04, 0.78)} material={mat((i + Math.floor(i / 12)) % 2 ? "#d9dee4" : "#c7ced6")} />;
      })}
      <mesh position={[0, 1.6, PAREDE]} geometry={caixa(9, 3.4, 0.12)} material={mat("#e8eef2")} />
      <mesh position={[-4.4, 1.6, 0.6]} geometry={caixa(0.12, 3.4, 7.4)} material={mat("#dde5ea")} />
      <mesh position={[4.4, 1.6, 0.6]} geometry={caixa(0.12, 3.4, 7.4)} material={mat("#dde5ea")} />
      {[-1.6, 1.6].map((x) => <mesh key={x} position={[x, 3.28, 0]} geometry={caixa(1.4, 0.04, 0.6)} material={mat("#ffffff", { emissivo: "#ffffff", brilho: 1.2 })} />)}

      {/* bancada com tampo preto, armários por baixo */}
      <group position={[0, 0, PAREDE + 0.5]}>
        <mesh position-y={0.45} geometry={caixa(3.6, 0.9, 0.75)} material={mat("#f4f6f8")} />
        {[-1.2, 0, 1.2].map((x) => <mesh key={x} position={[x, 0.45, 0.38]} geometry={caixa(1.1, 0.8, 0.02)} material={mat("#dfe5ea")} />)}
        <mesh position-y={0.93} geometry={caixa(3.7, 0.06, 0.8)} material={mat("#22252b", { aspereza: 0.4 })} />
        {/* suporte de tubos de ensaio */}
        <group position={[-1.3, 0.96, 0.05]}>
          <mesh position-y={0.1} geometry={caixa(0.55, 0.04, 0.15)} material={mat("#c9a26a")} />
          {[cor, "#3aa66a", cor2, "#f2c12e", "#8a4fd1"].map((c, i) => (
            <group key={i} position={[-0.2 + i * 0.1, 0.16, 0]}>
              <mesh geometry={cilindro(0.03, 0.03, 0.32, 6)} material={mat("#e6f6ff", { opacidade: 0.35 })} />
              <mesh position-y={-0.07} geometry={cilindro(0.026, 0.026, 0.16, 6)} material={mat(c, { emissivo: c, brilho: 0.6 })} />
            </group>
          ))}
        </group>
        {/* microscópio */}
        <group position={[1.35, 0.96, 0]} rotation-y={-0.5}>
          <mesh position-y={0.04} geometry={caixa(0.28, 0.06, 0.34)} material={mat("#2e3440")} />
          <mesh position={[0, 0.25, -0.1]} rotation-x={0.25} geometry={caixa(0.07, 0.4, 0.08)} material={mat("#2e3440")} />
          <mesh position={[0, 0.16, 0.03]} geometry={caixa(0.2, 0.03, 0.18)} material={mat("#3a404c")} />
          <mesh position={[0, 0.38, 0.02]} rotation-x={-0.4} geometry={cilindro(0.04, 0.05, 0.32, 8)} material={mat("#e9ecf0")} />
          <mesh position={[0, 0.55, -0.06]} rotation-x={-0.4} geometry={cilindro(0.03, 0.03, 0.12, 8)} material={mat("#1c1f26")} />
        </group>
      </group>
      {[cor, "#3aa66a", cor2].map((c, i) => <Objeto key={i} o={frasco(c, -0.5 + i * 0.5)} t={t + i * 0.3} />)}

      {/* quadro branco com uma molécula e um gráfico desenhados */}
      <group position={[-1.9, 1.95, PAREDE + 0.07]}>
        <mesh geometry={caixa(1.9, 1.05, 0.03)} material={mat("#fbfcfd")} />
        <mesh position-y={-0.56} geometry={caixa(1.95, 0.05, 0.08)} material={mat("#9aa3ad")} />
        <group position={[-0.5, 0.05, 0.02]}>
          {[[0, 0], [0.22, 0.14], [-0.22, 0.14], [0, -0.26]].map(([x, y], i) => <mesh key={i} position={[x, y, 0]} geometry={cilindro(0.055, 0.055, 0.01, 10)} rotation-x={Math.PI / 2} material={mat(i ? "#3f8fe5" : "#e5483f")} />)}
          {[[0.11, 0.07, -0.57], [-0.11, 0.07, 0.57], [0, -0.13, 0]].map(([x, y, r], i) => <mesh key={i} position={[x, y, 0]} rotation-z={r === 0 ? 0 : r} geometry={caixa(0.015, 0.24, 0.005)} material={mat("#2a2f3a")} />)}
        </group>
        <group position={[0.15, -0.25, 0.02]}>
          <mesh position={[0.3, 0, 0]} geometry={caixa(0.65, 0.01, 0.005)} material={mat("#2a2f3a")} />
          <mesh position={[0, 0.25, 0]} geometry={caixa(0.01, 0.5, 0.005)} material={mat("#2a2f3a")} />
          <primitive object={linhaGrafico} />
        </group>
      </group>
      {/* tabela periódica */}
      <group position={[0.55, 2.45, PAREDE + 0.07]}>
        <mesh position={[0.72, -0.27, -0.005]} geometry={caixa(1.65, 0.72, 0.01)} material={mat("#ffffff")} />
        {tabela.map((q, i) => <mesh key={i} position={[q.x, q.y, 0.005]} geometry={caixa(0.075, 0.075, 0.01)} material={mat(q.cor)} />)}
      </group>
      {/* estante com frascos à esquerda */}
      <group position={[-3.9, 0, -0.8]} rotation-y={Math.PI / 2}>
        {[0.6, 1.2, 1.8].map((y) => <mesh key={y} position-y={y} geometry={caixa(1.6, 0.05, 0.4)} material={mat("#b8c0c8")} />)}
        <mesh position={[-0.8, 1.1, 0]} geometry={caixa(0.05, 2.2, 0.4)} material={mat("#9aa3ad")} />
        <mesh position={[0.8, 1.1, 0]} geometry={caixa(0.05, 2.2, 0.4)} material={mat("#9aa3ad")} />
        {Array.from({ length: 12 }, (_, i) => {
          const y = [0.6, 1.2, 1.8][i % 3], x = -0.6 + Math.floor(i / 3) * 0.4;
          return <mesh key={i} position={[x, y + 0.13, 0]} geometry={i % 2 ? cilindro(0.08, 0.08, 0.22, 7) : cone(0.1, 0.22, 7)} material={mat(["#e5483f", "#3f8fe5", "#3aa66a", "#f2c12e"][i % 4], { opacidade: 0.75 })} />;
        })}
      </group>
      {/* hotte à direita */}
      <group position={[3.6, 0, -1.2]} rotation-y={-Math.PI / 2}>
        <mesh position-y={0.45} geometry={caixa(1.6, 0.9, 0.8)} material={mat("#eef1f4")} />
        <mesh position-y={1.6} geometry={caixa(1.6, 1.4, 0.8)} material={mat("#e3e8ec")} />
        <mesh position={[0, 1.45, 0.41]} geometry={caixa(1.4, 1.0, 0.02)} material={mat("#bfe3ff", { opacidade: 0.35, aspereza: 0.1 })} />
        <mesh position={[0, 2.5, 0]} geometry={cilindro(0.18, 0.18, 0.4, 8)} material={mat("#c9ced6")} />
      </group>
      {/* lavatório e chuveiro de emergência ficam fora de cena; uma bata pendurada dá vida à parede */}
      <mesh position={[3.0, 1.6, PAREDE + 0.12]} geometry={caixa(0.45, 0.9, 0.08)} material={mat("#f8fafc")} />
      <mesh position={[3.0, 2.08, PAREDE + 0.12]} geometry={esfera(0.06, 0)} material={mat("#9aa3ad")} />
    </group>
  );
};

// Estúdio neutro: fundo escuro em gradiente, chão com grelha que se perde ao longe e luzes de recorte na cor do estilo.
// Bom para matemática, átomos, moléculas e qualquer objeto que deva ser a única coisa em cena.
export const Estudio: React.FC<{ cor: string; cor2: string; fundo: string }> = ({ cor, cor2, fundo }) => {
  const grelha = useMemo(() => {
    const g = new THREE.GridHelper(60, 60, cor, "#3a4150");
    (g.material as THREE.Material).transparent = true;
    (g.material as THREE.Material).opacity = 0.35;
    return g;
  }, [cor]);
  const base = new THREE.Color(fundo).lerp(new THREE.Color("#0b0d14"), 0.6).getStyle();
  return (
    <group>
      <fog attach="fog" args={[base, 10, 34]} />
      <hemisphereLight args={["#e8eeff", "#1a1d26", 0.8]} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[4, 6, 6]} intensity={2.2} color="#ffffff" />
      <directionalLight position={[-6, 3, -4]} intensity={1.6} color={cor} />
      <directionalLight position={[6, 2, -5]} intensity={1.2} color={cor2} />
      <mesh position-y={-0.01} rotation-x={-Math.PI / 2}><planeGeometry args={[80, 80]} /><meshStandardMaterial color={base} roughness={1} /></mesh>
      <primitive object={grelha} position-y={0.005} />
    </group>
  );
};
