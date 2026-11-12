// Mundo 3D contínuo (estilo "Estúdio 3D"): um único cenário para o vídeo inteiro.
// Cada cena tem uma "estação" ao longo de um corredor de estúdio escuro; nas trocas de cena a câmara voa
// para a estação seguinte e atravessa um portal de luz. As cenas 2D flutuam à frente (Transicao "voo").
import { Environment, Lightformer, MeshReflectorMaterial, RoundedBox } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { useMemo } from "react";
import { AbsoluteFill, Easing, random, useCurrentFrame, useVideoConfig } from "remotion";
import { BufferAttribute, BufferGeometry, Vector3 } from "three";
import { useEstilo } from "../estilos";
import { Cena } from "../types";
import { CAIXA_PROCEDURAL, Hardware3D } from "./Hardware3D";

const FOV = 36;
const PASSO = 12; // distância entre estações
export const VOO = 10; // frames de voo de cada lado da troca de cena (a Transicao "voo" usa o mesmo valor)
const voo = Easing.inOut(Easing.cubic);
const lim = (x: number) => Math.min(1, Math.max(0, x));

// o corredor serpenteia um pouco para a câmara não andar sempre a direito
const curva = (u: number) => Math.sin(u * 1.3) * 1.4;
const estacao = (i: number) => new Vector3(curva(i), 0, -i * PASSO);

// u = índice da estação onde a câmara está; contínuo durante os voos
const posicaoNoCorredor = (g: number, fronteiras: number[]) =>
  fronteiras.reduce((u, b) => u + voo(lim((g - (b - VOO)) / (2 * VOO))), 0);

const Camara: React.FC<{ u: number; g: number }> = ({ u, g }) => {
  const camera = useThree((s) => s.camera);
  const balanco = Math.sin(g / 70) * 0.22;
  camera.position.set(curva(u) * 0.7 + balanco, 1.55 + Math.sin(u * 2.1) * 0.12, -u * PASSO + 7.5);
  camera.lookAt(curva(u + 0.25) * 0.8, 1.25, -u * PASSO - 3);
  camera.updateProjectionMatrix();
  return null;
};

// portal de luz entre estações: a câmara atravessa-o a meio do voo
const Portal: React.FC<{ z: number; x: number; cor: string; brilho: number }> = ({ z, x, cor, brilho }) => {
  const W = 4.8, H = 6.2, E = 0.05; // largo: em repouso fica a emoldurar o ecrã, sem cortar os títulos
  const barra = (pos: [number, number, number], tam: [number, number, number], k: number) => (
    <mesh key={k} position={pos}>
      <boxGeometry args={tam} />
      <meshStandardMaterial color={cor} emissive={cor} emissiveIntensity={brilho} toneMapped={false} />
    </mesh>
  );
  return (
    <group position={[x, 0, z]}>
      {barra([-W / 2, H / 2, 0], [E, H, E], 0)}
      {barra([W / 2, H / 2, 0], [E, H, E], 1)}
      {barra([0, H, 0], [W + E, E, E], 2)}
      <pointLight position={[0, H - 0.4, 0.6]} color={cor} intensity={6} distance={9} decay={1.6} />
    </group>
  );
};

// objeto de destaque de cada estação, num pedestal ao lado do conteúdo
const Destaque: React.FC<{ cena: Cena; i: number; g: number; cor: string }> = ({ cena, i, g, cor }) => {
  const e = estacao(i);
  const lado = i % 2 === 0 ? 1 : -1;
  const giro = g * 0.012 + i;
  const flutua = Math.sin(g / 24 + i) * 0.08;
  const icone = cena.tipo === "produto" ? cena.icone : undefined;
  const hardware = icone && icone in CAIXA_PROCEDURAL ? (icone as keyof typeof CAIXA_PROCEDURAL) : undefined;
  const metal = <meshPhysicalMaterial color="#c8ccd4" metalness={1} roughness={0.18} clearcoat={1} clearcoatRoughness={0.1} />;
  const formas = [
    <mesh key="n"><torusKnotGeometry args={[0.42, 0.14, 160, 24]} />{metal}</mesh>,
    <mesh key="i"><icosahedronGeometry args={[0.6, 0]} /><meshPhysicalMaterial color="#c8ccd4" metalness={1} roughness={0.25} flatShading /></mesh>,
    <RoundedBox key="c" args={[0.85, 0.85, 0.85]} radius={0.12} smoothness={4}>{metal}</RoundedBox>,
    <mesh key="o"><octahedronGeometry args={[0.62, 0]} /><meshPhysicalMaterial color={cor} metalness={0.9} roughness={0.2} flatShading /></mesh>,
  ];
  return (
    <group position={[e.x + lado * 2.3, 0, e.z - 3.6]}>
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.72, 0.8, 0.36, 64]} />
        <meshStandardMaterial color="#14161b" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.37, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.72, 0.015, 8, 96]} />
        <meshStandardMaterial color={cor} emissive={cor} emissiveIntensity={3} toneMapped={false} />
      </mesh>
      <group position={[0, 1.15 + flutua, 0]} rotation={[0.25, giro, 0.1]}>
        {hardware ? (
          <group scale={1.3 / Math.max(...CAIXA_PROCEDURAL[hardware])}><Hardware3D tipo={hardware} t={0} f={g} cor={cor} /></group>
        ) : formas[i % formas.length]}
      </group>
    </group>
  );
};

// partículas de poeira a flutuar na luz (posições fixas por semente: o render é determinístico)
const Poeira: React.FC<{ n: number; comprimento: number; g: number }> = ({ n, comprimento, g }) => {
  const geo = useMemo(() => {
    const p = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) {
      p[k * 3] = (random(`px${k}`) - 0.5) * 9;
      p[k * 3 + 1] = random(`py${k}`) * 5;
      p[k * 3 + 2] = 8 - random(`pz${k}`) * (comprimento + 16);
    }
    const b = new BufferGeometry();
    b.setAttribute("position", new BufferAttribute(p, 3));
    return b;
  }, [n, comprimento]);
  return (
    <points geometry={geo} position={[0, Math.sin(g / 90) * 0.15, 0]}>
      <pointsMaterial size={0.035} color="#ffffff" transparent opacity={0.35} sizeAttenuation depthWrite={false} />
    </points>
  );
};

export const Mundo3D: React.FC<{ cenas: Cena[]; inicios: number[]; cor: string }> = ({ cenas, inicios, cor }) => {
  const g = useCurrentFrame();
  const { width: L, height: A } = useVideoConfig();
  const e = useEstilo();
  const fronteiras = inicios.slice(1);
  const u = posicaoNoCorredor(g, fronteiras);
  const comprimento = cenas.length * PASSO;
  // só desenha as estações perto da câmara (o resto está no nevoeiro)
  const perto = cenas.map((c, i) => ({ c, i })).filter(({ i }) => Math.abs(i - u) < 2.2);

  return (
    <AbsoluteFill>
      <ThreeCanvas width={L} height={A} gl={{ antialias: true, preserveDrawingBuffer: true }} camera={{ fov: FOV, near: 0.1, far: 80 }} style={{ position: "absolute", inset: 0 }}>
        <color attach="background" args={[e.fundo]} />
        <fog attach="fog" args={[e.fundo, 9, 30]} />
        <Camara u={u} g={g} />
        <ambientLight intensity={0.25} />
        <directionalLight position={[3, 8, 4]} intensity={1.4} />
        {/* reflexos dos metais: caixas de luz de estúdio, uma na cor do estilo */}
        <Environment resolution={128} frames={1}>
          <Lightformer intensity={3} position={[0, 5, 2]} scale={[10, 2, 1]} />
          <Lightformer intensity={1.6} position={[-5, 1, 0]} scale={[2, 6, 1]} color={cor} />
          <Lightformer intensity={1} position={[5, 2, -2]} scale={[2, 6, 1]} />
        </Environment>
        {/* chão espelhado, com o reflexo desfocado como num estúdio de produto */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -comprimento / 2 + 6]}>
          <planeGeometry args={[40, comprimento + 40]} />
          <MeshReflectorMaterial
            blur={[300, 80]} resolution={512} mixBlur={1} mixStrength={18} roughness={1} depthScale={1.1}
            minDepthThreshold={0.4} maxDepthThreshold={1.4} color="#0b0c10" metalness={0.6} mirror={0.7}
          />
        </mesh>
        {cenas.map((_, i) => {
          const a = estacao(i), b = estacao(i + 1);
          return i < cenas.length - 1 && Math.abs(i + 0.5 - u) < 2.5 ? <Portal key={`p${i}`} z={(a.z + b.z) / 2} x={(a.x + b.x) / 2} cor={cor} brilho={e.brilho ? 3 : 1.8} /> : null;
        })}
        {perto.map(({ c, i }) => (c.tipo === "modelo3d" ? null : <Destaque key={i} cena={c} i={i} g={g} cor={cor} />))}
        <Poeira n={260} comprimento={comprimento} g={g} />
      </ThreeCanvas>
      {/* vinheta: o olhar fica no centro, onde está o conteúdo */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, transparent 50%, rgba(0,0,0,0.7) 100%)" }} />
    </AbsoluteFill>
  );
};
