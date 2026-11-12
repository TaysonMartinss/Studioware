import { Environment, Lightformer, useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, spring, staticFile, useVideoConfig } from "remotion";
import { Box3, Group, Mesh, Object3D, PerspectiveCamera, Quaternion, Vector3 } from "three";
import { CAIXA_PROCEDURAL, Hardware3D } from "../components/Hardware3D";
import { clamp, pop, useFontes, useFrame } from "../components/motion";
import { ESCALA, Kicker, Revelar, TOPO, useMargem, useSombra } from "../components/ui";
import { useEstilo } from "../estilos";
import { CenaModelo3D, Etiqueta3D } from "../types";

const FOV = 30;
export const TAMANHO = 1.75; // maior dimensão do modelo depois de normalizado (cabe na largura do 9:16 mesmo a rodar)
const SUBIR = 0.42; // o modelo fica acima do centro, longe das legendas
const sair = Easing.out(Easing.cubic);

// GLB normalizado: centrado, à escala TAMANHO, com a direção de explosão de cada peça calculada
export const Glb: React.FC<{ url: string; t: number; aoMedir: (caixa: Vector3) => void }> = ({ url, t, aoMedir }) => {
  const { scene } = useGLTF(url);
  const { objeto, escala, pecas } = useMemo(() => {
    // orienta o modelo com a face maior virada para a câmara: o eixo mais fino passa a ser a profundidade
    // (muitos modelos vêm "deitados", e de frente só se via a lateral)
    const o = new Group();
    o.add(scene.clone(true));
    const bruto = new Box3().setFromObject(o).getSize(new Vector3());
    const fino = Math.min(bruto.x, bruto.y, bruto.z);
    if (fino === bruto.y) o.rotation.x = Math.PI / 2;
    else if (fino === bruto.x) o.rotation.y = Math.PI / 2;
    o.updateMatrixWorld(true);
    const caixa = new Box3().setFromObject(o);
    const tamanho = caixa.getSize(new Vector3());
    const centro = caixa.getCenter(new Vector3());
    o.position.sub(centro);
    o.updateMatrixWorld(true);
    const lista: { malha: Object3D; original: Vector3; direcao: Vector3 }[] = [];
    o.traverse((m) => {
      if (!(m as Mesh).isMesh || !m.parent) return;
      const c = new Box3().setFromObject(m).getCenter(new Vector3());
      const dirMundo = c.lengthSq() > 1e-6 ? c.clone().normalize() : new Vector3(0, 0, 1);
      // a direção no espaço do pai, para a peça se afastar do centro mesmo dentro de hierarquias
      const q = m.parent.getWorldQuaternion(new Quaternion()).invert();
      const s = m.parent.getWorldScale(new Vector3());
      const dir = dirMundo.applyQuaternion(q).divide(s).multiplyScalar(Math.max(tamanho.x, tamanho.y, tamanho.z) * 0.18);
      lista.push({ malha: m, original: m.position.clone(), direcao: dir });
    });
    const e = TAMANHO / Math.max(tamanho.x, tamanho.y, tamanho.z);
    aoMedir(tamanho.clone().multiplyScalar(e));
    return { objeto: o, escala: e, pecas: lista };
  }, [scene, aoMedir]);
  for (const p of pecas) p.malha.position.copy(p.original).addScaledVector(p.direcao, t);
  return <group scale={escala}><primitive object={objeto} /></group>;
};

const ANCORAS: Record<Etiqueta3D["ancora"], (c: Vector3) => Vector3> = {
  topo: (c) => new Vector3(0, c.y / 2 + 0.12, 0),
  base: (c) => new Vector3(0, -c.y / 2 - 0.12, 0),
  frente: (c) => new Vector3(0, 0, c.z / 2 + 0.1),
  lado: (c) => new Vector3(c.x / 2 + 0.08, 0, 0),
  centro: () => new Vector3(0, 0, 0),
};

// Modelo 3D a girar, a explodir em peças, a revelar ou com a câmara a aproximar-se; etiquetas presas a pontos do modelo
export const Modelo3DCena: React.FC<{ cena: CenaModelo3D; cor: string }> = ({ cena, cor }) => {
  const MARGEM = useMargem();
  const f = useFrame();
  const { fps, durationInFrames, width: L, height: A } = useVideoConfig();
  const e = useEstilo();
  const { titulo, corpo } = useFontes();
  const sombra = useSombra();
  const anim = cena.animacao ?? "girar";
  const glb = cena.modelo?.arquivo;
  const procedural = cena.procedural ?? "gpu";

  // movimento da câmara e do modelo, tudo em função do frame (determinístico no render)
  const entrada = spring({ frame: f - 2, fps, config: { damping: 16, stiffness: 90 } });
  const explosao = anim === "explodir" ? interpolate(f, [18, 46], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) }) : 0;
  const rotY = anim === "revelar" ? interpolate(entrada, [0, 1], [-2.6, -0.5]) + f * 0.004
    : anim === "explodir" ? -0.55 - 0.45 * explosao + f * 0.003
    : -0.55 + f * (anim === "girar" ? 0.02 : 0.008);
  const rotX = anim === "explodir" ? 0.15 + 0.25 * explosao : 0.12;
  const escala = anim === "revelar" ? entrada : 0.85 + 0.15 * entrada;
  const camZ = anim === "aproximar" ? interpolate(f, [0, durationInFrames], [10.5, 7], { ...clamp, easing: sair }) : 8.6 - 0.4 * entrada;
  const flutuar = Math.sin(f / 22) * 0.04;

  const caixa = useMemo(() => {
    const c = CAIXA_PROCEDURAL[procedural];
    const m = Math.max(...c);
    return new Vector3(c[0], c[1], c[2]).multiplyScalar(TAMANHO / m);
  }, [procedural]);
  const caixaReal = useMemo(() => ({ atual: caixa }), [caixa]);
  const medir = useMemo(() => (c: Vector3) => { caixaReal.atual = c; }, [caixaReal]);

  // etiquetas: projeta o ponto 3D (com a mesma câmara e rotação) para coordenadas do ecrã
  const camara = useMemo(() => new PerspectiveCamera(FOV, L / A, 0.1, 100), [L, A]);
  camara.position.set(0, 0.25, camZ);
  camara.lookAt(0, 0, 0);
  camara.updateMatrixWorld();
  const modelo = new Object3D();
  modelo.position.set(0, SUBIR + flutuar, 0);
  modelo.rotation.set(rotX, rotY, 0);
  modelo.scale.setScalar(escala);
  modelo.updateMatrixWorld();
  const etiquetas = (cena.etiquetas ?? []).map((et, i) => {
    const p = ANCORAS[et.ancora](caixaReal.atual).applyMatrix4(modelo.matrixWorld).project(camara);
    const inicio = Math.round((et.inicioS ?? 1 + i * 0.9) * fps);
    return { ...et, x: (p.x * 0.5 + 0.5) * L, y: (-p.y * 0.5 + 0.5) * A, s: pop(f, fps, inicio, 14) };
  });

  const claro = e.tema === "claro";
  const sKicker = pop(f, fps, 2, 14);

  return (
    <AbsoluteFill>
      {/* sombra suave no "chão", por baixo do modelo */}
      <div style={{ position: "absolute", left: L * 0.18, right: L * 0.18, top: A * 0.552, height: 80, borderRadius: "50%", background: claro ? "#0f172a" : "#000", opacity: 0.35 * entrada, filter: "blur(30px)" }} />
      <ThreeCanvas width={L} height={A} gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }} camera={{ fov: FOV, position: [0, 0.25, camZ], near: 0.1, far: 100 }} style={{ position: "absolute", inset: 0 }}>
        <CameraSync z={camZ} />
        <hemisphereLight args={["#ffffff", "#30303a", claro ? 1.4 : 1.0]} />
        <directionalLight position={[3, 4, 5]} intensity={claro ? 3 : 3.4} />
        <directionalLight position={[-2, -1, 4]} intensity={0.9} />
        {/* luz de recorte na cor do estilo: separa o modelo do fundo */}
        <directionalLight position={[-4, 2, -3]} intensity={e.brilho ? 3.2 : 1.6} color={cor} />
        <Environment resolution={128} frames={1}>
          <Lightformer intensity={4} position={[0, 4, 4]} scale={[8, 2, 1]} />
          <Lightformer intensity={2} position={[0, -3, 3]} scale={[8, 1, 1]} />
          <Lightformer intensity={1.2} position={[-5, 0, 2]} scale={[2, 6, 1]} color={cor} />
          <Lightformer intensity={0.8} position={[5, 1, -2]} scale={[2, 6, 1]} />
        </Environment>
        <group position={[0, SUBIR + flutuar, 0]} rotation={[rotX, rotY, 0]} scale={escala}>
          {glb ? <Glb url={staticFile(glb)} t={explosao} aoMedir={medir} /> : <group scale={TAMANHO / Math.max(...CAIXA_PROCEDURAL[procedural])}><Hardware3D tipo={procedural} t={explosao} f={f} cor={cor} /></group>}
        </group>
      </ThreeCanvas>

      {(cena.titulo || cena.kicker) && (
        <div style={{ position: "absolute", top: TOPO, left: MARGEM, right: MARGEM, opacity: Math.min(1, sKicker * 1.4), transform: `translateY(${(1 - sKicker) * 20}px)` }}>
          {cena.kicker && <Kicker cor={cor}>{cena.kicker}</Kicker>}
          {cena.titulo && <Revelar inicio={4} style={{ marginTop: 18 }}><div style={{ fontFamily: titulo, fontSize: ESCALA.h2, lineHeight: 1.02, textTransform: "uppercase", color: e.corTexto, textShadow: sombra }}>{cena.titulo}</div></Revelar>}
        </div>
      )}

      {etiquetas.map((et, i) => {
        const direita = et.x < L / 2;
        return (
          <div key={i} style={{ position: "absolute", left: et.x, top: et.y, opacity: Math.min(1, et.s * 1.5), pointerEvents: "none" }}>
            <div style={{ position: "absolute", left: -8, top: -8, width: 16, height: 16, borderRadius: "50%", background: cor, boxShadow: `0 0 0 6px ${cor}33` }} />
            <div style={{ position: "absolute", top: -1.5, height: 3, width: 90 * et.s, background: cor, ...(direita ? { left: 0 } : { right: 0 }) }} />
            <div
              style={{
                position: "absolute", top: -26, ...(direita ? { left: 100 } : { right: 100 }), whiteSpace: "nowrap",
                fontFamily: corpo, fontWeight: 700, fontSize: 34, color: claro ? "#0f172a" : "#fff",
                background: claro ? "#ffffffee" : "#0b0b0fcc", border: `2px solid ${cor}`, borderRadius: Math.min(e.raio, 12), padding: "6px 16px",
                transform: `translateX(${(1 - et.s) * (direita ? -20 : 20)}px)`,
              }}
            >
              {et.texto}
            </div>
          </div>
        );
      })}
      {cena.modelo?.credito && (
        <div style={{ position: "absolute", right: MARGEM, top: A * 0.615, fontSize: 20, color: "#fffc", background: "#0008", padding: "4px 10px", borderRadius: 4, fontFamily: "sans-serif" }}>{cena.modelo.credito}</div>
      )}
    </AbsoluteFill>
  );
};

// a câmara do R3F segue o z calculado no frame (para a animação "aproximar")
const CameraSync: React.FC<{ z: number }> = ({ z }) => {
  const camera = useThree((s) => s.camera);
  camera.position.set(0, 0.25, z);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  return null;
};
