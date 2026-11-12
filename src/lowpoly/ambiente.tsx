import { useMemo } from "react";
import * as THREE from "three";
import { esfera, mat, rng } from "./util";

export type Hora = "dia" | "tarde" | "noite";

// Paleta de luz por hora do dia: céu em gradiente, nevoeiro a fundir o horizonte, sol (ou lua) e luz ambiente
export const LUZ: Record<Hora, { topo: string; horizonte: string; nevoa: string; sol: string; forcaSol: number; ceu: string; chao: string; forcaAmb: number; posSol: [number, number, number] }> = {
  dia: { topo: "#4d9be6", horizonte: "#cfe9f7", nevoa: "#cfe9f7", sol: "#fff4e0", forcaSol: 2.4, ceu: "#cfe6ff", chao: "#56704a", forcaAmb: 1.1, posSol: [30, 50, 25] },
  tarde: { topo: "#2f3f86", horizonte: "#f8a35a", nevoa: "#e99a6a", sol: "#ffb36b", forcaSol: 2.3, ceu: "#ffc7a0", chao: "#5a4060", forcaAmb: 0.85, posSol: [-45, 14, -30] },
  noite: { topo: "#050817", horizonte: "#1b2852", nevoa: "#121c3d", sol: "#9fb4ff", forcaSol: 0.75, ceu: "#4a5f9a", chao: "#14182a", forcaAmb: 0.5, posSol: [-20, 40, 20] },
};

// Cúpula do céu com gradiente (cores por vértice), sem nevoeiro
const Cupula: React.FC<{ hora: Hora }> = ({ hora }) => {
  const g = useMemo(() => {
    const geo = new THREE.SphereGeometry(400, 24, 12);
    const topo = new THREE.Color(LUZ[hora].topo), hor = new THREE.Color(LUZ[hora].horizonte);
    const p = geo.attributes.position, cores = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const k = Math.pow(Math.max(0, p.getY(i) / 400), 0.6);
      c.copy(hor).lerp(topo, k).toArray(cores, i * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(cores, 3));
    return geo;
  }, [hora]);
  return (
    <mesh geometry={g}>
      <meshBasicMaterial vertexColors side={THREE.BackSide} fog={false} depthWrite={false} />
    </mesh>
  );
};

// Estrelas: pontos fixos na cúpula (noite e espaço)
export const Estrelas: React.FC<{ n?: number; raio?: number; t?: number; todas?: boolean }> = ({ n = 900, raio = 350, t = 0, todas }) => {
  const g = useMemo(() => {
    const r = rng(7), pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      pos.set([raio * s * Math.cos(a), (todas ? raio * u : raio * Math.abs(u) * 0.95 + 5), raio * s * Math.sin(a)], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return geo;
  }, [n, raio, todas]);
  return (
    <points geometry={g} rotation-y={t * 0.004}>
      <pointsMaterial color="#ffffff" size={1.6} sizeAttenuation={false} fog={false} transparent opacity={0.9} />
    </points>
  );
};

// Céu, nevoeiro e luzes de um cenário ao ar livre. `perto`/`longe` controlam onde o nevoeiro começa.
export const Ambiente: React.FC<{ hora: Hora; t: number; perto?: number; longe?: number; astro?: boolean; interior?: boolean }> = ({ hora, t, perto = 40, longe = 260, astro = true, interior }) => {
  const L = LUZ[hora];
  const [sx, sy, sz] = L.posSol;
  return (
    <>
      {!interior && <Cupula hora={hora} />}
      {!interior && <fog attach="fog" args={[L.nevoa, perto, longe]} />}
      {!interior && hora === "noite" && <Estrelas t={t} />}
      <hemisphereLight args={[L.ceu, L.chao, L.forcaAmb]} />
      <ambientLight intensity={hora === "noite" ? 0.25 : 0.2} />
      <directionalLight position={[sx, sy, sz]} intensity={L.forcaSol} color={L.sol} />
      {/* luz de recorte de trás, para separar as personagens do fundo */}
      <directionalLight position={[-sx * 0.5, 12, -40]} intensity={hora === "noite" ? 0.5 : 0.7} color={hora === "tarde" ? "#ff9a6a" : "#bcd4ff"} />
      {astro && !interior && (
        <mesh position={[sx * 5, sy * 5, sz * 5]} geometry={esfera(hora === "noite" ? 9 : 14, 1)} material={mat(hora === "noite" ? "#e9eeff" : "#fff3c4", { emissivo: hora === "noite" ? "#dfe6ff" : "#ffe8a0", brilho: 1.4, semNevoa: true })} />
      )}
    </>
  );
};
