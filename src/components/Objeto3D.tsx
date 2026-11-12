import { Environment, Lightformer } from "@react-three/drei";
import { ThreeCanvas } from "@remotion/three";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useEstilo } from "../estilos";
import { Glb, TAMANHO } from "../cenas/Modelo3DCena";
import { CAIXA_PROCEDURAL, Hardware3D } from "./Hardware3D";

const FOV = 30;
const nada = () => {};

// Modelo 3D usado como mídia de uma cena (no lugar de uma foto ou vídeo): gira devagar e flutua,
// enquadrado para caber inteiro no espaço que a mídia ocupa (fundo, cartão, ecrã do estúdio 3D, lado do vídeo longo).
export const Objeto3D: React.FC<{ arquivo: string; style?: React.CSSProperties }> = ({ arquivo, style }) => {
  const caixa = useRef<HTMLDivElement>(null);
  const [tam, setTam] = useState<[number, number] | null>(null);
  const [espera] = useState(() => delayRender("medir o espaço do modelo 3D"));
  const f = useCurrentFrame();
  const { width: L, height: A } = useVideoConfig();
  const e = useEstilo();

  // o canvas precisa do tamanho em píxeis: mede o contentor (offsetWidth ignora as transformações de animação)
  // no primeiro layout a largura ainda pode ser 0 (os contentores das transições ainda não têm tamanho): espera por ela
  useLayoutEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const medir = () => {
      if (el.offsetWidth > 8 && el.offsetHeight > 8) { setTam([el.offsetWidth, el.offsetHeight]); return true; }
      return false;
    };
    if (medir()) return;
    const obs = new ResizeObserver(() => { if (medir()) obs.disconnect(); });
    obs.observe(el);
    // sem tamanho ao fim de 3 s: usa o ecrã inteiro, para nunca bloquear o render
    const t = setTimeout(() => { obs.disconnect(); setTam((x) => x ?? [L, A]); }, 3000);
    return () => { obs.disconnect(); clearTimeout(t); };
  }, [L, A]);
  // só liberta o frame depois de o canvas montar (o ThreeCanvas e o carregamento do GLB têm as suas próprias esperas)
  useEffect(() => {
    if (tam) continueRender(espera);
  }, [tam, espera]);

  const procedural = arquivo.startsWith("procedural:") ? (arquivo.slice(11) as keyof typeof CAIXA_PROCEDURAL) : null;
  const cor = e.cor;
  let distancia = 8;
  if (tam) {
    // o modelo (com folga para a diagonal ao girar) ocupa ~80% do lado mais curto
    const aspeto = tam[0] / tam[1];
    distancia = (TAMANHO * 1.25) / 0.8 / (2 * Math.tan((FOV * Math.PI) / 360) * Math.min(1, aspeto));
  }
  const rotY = -0.6 + f * 0.012;
  const flutuar = Math.sin(f / 24) * 0.05;

  return (
    <div
      ref={caixa}
      style={{
        position: "relative", overflow: "hidden",
        // estúdio discreto atrás do objeto: brilho na cor do estilo, sem tapar o que está por baixo
        background: `radial-gradient(ellipse at 50% 45%, ${cor}38, ${e.fundo}00 70%)`, ...style,
      }}
    >
      {tam && (
        <ThreeCanvas width={tam[0]} height={tam[1]} gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }} camera={{ fov: FOV, position: [0, 0.2, distancia], near: 0.1, far: 200 }} style={{ position: "absolute", inset: 0 }}>
          <hemisphereLight args={["#ffffff", "#30303a", 1.0]} />
          <directionalLight position={[3, 4, 5]} intensity={3.2} />
          <directionalLight position={[-2, -1, 4]} intensity={0.9} />
          <directionalLight position={[-4, 2, -3]} intensity={e.brilho ? 3 : 1.5} color={cor} />
          <Environment resolution={128} frames={1}>
            <Lightformer intensity={4} position={[0, 4, 4]} scale={[8, 2, 1]} />
            <Lightformer intensity={2} position={[0, -3, 3]} scale={[8, 1, 1]} />
            <Lightformer intensity={1.2} position={[-5, 0, 2]} scale={[2, 6, 1]} color={cor} />
            <Lightformer intensity={0.8} position={[5, 1, -2]} scale={[2, 6, 1]} />
          </Environment>
          <group position={[0, flutuar, 0]} rotation={[0.14, rotY, 0]}>
            {procedural
              ? <group scale={TAMANHO / Math.max(...CAIXA_PROCEDURAL[procedural])}><Hardware3D tipo={procedural} t={0} f={f} cor={cor} /></group>
              : <Glb url={staticFile(arquivo)} t={0} aoMedir={nada} />}
          </group>
        </ThreeCanvas>
      )}
    </div>
  );
};
