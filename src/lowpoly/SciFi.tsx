import { useMemo } from "react";
import * as THREE from "three";
import { Estrelas } from "./ambiente";
import { Corpo } from "./Espaco";
import { Inst, Instancias } from "./Instancias";
import { alturaTerreno } from "./Natureza";
import { MAT_VERTICES, caixa, cilindro, cone, entre, esfera, mat, pedra, rng } from "./util";

// Ficção científica: disco voador (que pode abduzir uma vaca com o raio), vaca, cristais que brilham,
// portal dimensional e um planeta alienígena com céu roxo, planeta com anéis e duas luas.

// ---------- vaca (para ser abduzida, ou só a pastar) ----------
export const Vaca: React.FC<{ t: number }> = ({ t }) => {
  const branco = mat("#f4f2ec"), preto = mat("#1f1d1b");
  return (
    <group>
      <mesh position-y={0.85} scale={[1.5, 0.75, 0.75]} geometry={caixa(1, 1, 1)} material={branco} />
      <mesh position={[0.2, 1.05, 0.38]} geometry={caixa(0.5, 0.35, 0.02)} material={preto} />
      <mesh position={[-0.35, 0.8, -0.38]} geometry={caixa(0.4, 0.3, 0.02)} material={preto} />
      {[[0.55, 0.28], [-0.55, 0.28], [0.55, -0.28], [-0.55, -0.28]].map(([x, z], i) => <mesh key={i} position={[x, 0.25 + 0.03 * Math.sin(t * 8 + i), z]} geometry={caixa(0.16, 0.5, 0.16)} material={branco} />)}
      <group position={[0.92, 1.12, 0]} rotation-z={0.1 * Math.sin(t * 2)}>
        <mesh geometry={caixa(0.45, 0.42, 0.42)} material={branco} />
        <mesh position={[0.24, -0.08, 0]} geometry={caixa(0.08, 0.24, 0.36)} material={mat("#e8a0a0")} />
        {[1, -1].map((l) => <mesh key={l} position={[0.05, 0.27, 0.16 * l]} geometry={cone(0.04, 0.14, 4)} material={mat("#e9dcc0")} />)}
        {[1, -1].map((l) => <mesh key={l} position={[0.16, 0.08, 0.215 * l]} geometry={esfera(0.035, 0)} material={preto} />)}
      </group>
      <mesh position={[-0.82, 0.95, 0]} rotation-z={-0.6 + 0.2 * Math.sin(t * 3)} geometry={cilindro(0.025, 0.025, 0.55, 4)} material={branco} />
    </group>
  );
};

// ---------- disco voador ----------
// paira e roda; com variante "abduzir", a partir de `quando` acende o raio e a vaca sobe até ao disco
export const Ovni: React.FC<{ t: number; quando: number; abduzir: boolean; altura: number; cor: string }> = ({ t, quando, abduzir, altura, cor }) => {
  const raio = abduzir && t >= quando;
  const sobe = abduzir ? entre(t, quando + 0.6, quando + 3.4) : 0;
  return (
    <group>
      <group position-y={altura + 0.25 * Math.sin(t * 1.4)} rotation-z={0.06 * Math.sin(t * 0.9)}>
        <group rotation-y={t * 1.2}>
          <mesh scale={[1, 0.22, 1]} geometry={esfera(2.2, 2)} material={mat("#aab2bd", { metal: 0.8, aspereza: 0.25 })} />
          <mesh position-y={0.42} scale={[1, 0.75, 1]} geometry={esfera(0.95, 1)} material={mat("#9fe8ff", { opacidade: 0.55, aspereza: 0.05, emissivo: "#4fd0ff", brilho: 0.4 })} />
          {Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2;
            return <mesh key={i} position={[Math.cos(a) * 1.95, -0.05, Math.sin(a) * 1.95]} geometry={esfera(0.1, 0)} material={mat(i % 2 ? cor : "#ffe14a", { emissivo: i % 2 ? cor : "#ffe14a", brilho: (Math.sin(t * 6 + i) > 0 ? 2.2 : 0.4) })} />;
          })}
          <mesh position-y={-0.35} geometry={cilindro(0.7, 0.9, 0.2, 10)} material={mat("#6b7480", { metal: 0.6, emissivo: raio ? "#7dffb0" : "#000000", brilho: raio ? 1 : 0 })} />
        </group>
        {raio && (
          <mesh position-y={-altura / 2 - 0.2}>
            <cylinderGeometry args={[0.85, 2.2, altura, 18, 1, true]} />
            <meshBasicMaterial color="#9dffc8" transparent opacity={0.22 + 0.05 * Math.sin(t * 9)} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
        )}
        {raio && <pointLight position-y={-1.5} intensity={30} distance={altura + 4} color="#9dffc8" />}
      </group>
      {abduzir && sobe < 1 && (
        <group position-y={sobe * (altura - 1.4)} rotation={[sobe * 1.2, sobe * 4, sobe * 0.8]} scale={1 - 0.45 * sobe}>
          <Vaca t={t} />
        </group>
      )}
    </group>
  );
};

// ---------- cristais a brilhar ----------
const CORES_CRISTAL = ["#b45aff", "#4fd0ff", "#ff4fd8", "#5affc0"];
export const Cristais: React.FC<{ t: number; cor?: string; semente?: number }> = ({ t, cor, semente = 1 }) => {
  const pecas = useMemo(() => {
    const r = rng(semente * 7);
    return Array.from({ length: 7 }, (_, i) => ({ a: r() * 6.28, inc: 0.15 + r() * 0.5, h: 0.6 + r() * 1.4, raio: 0.12 + r() * 0.12, d: i === 0 ? 0 : 0.15 + r() * 0.35 }));
  }, [semente]);
  const c = cor ?? CORES_CRISTAL[semente % CORES_CRISTAL.length];
  return (
    <group>
      {pecas.map((p, i) => (
        <group key={i} position={[Math.cos(p.a) * p.d, 0, Math.sin(p.a) * p.d]} rotation={[Math.sin(p.a) * p.inc, 0, -Math.cos(p.a) * p.inc]}>
          <mesh position-y={p.h / 2} geometry={cilindro(p.raio * 0.7, p.raio, p.h, 6)} material={mat(c, { emissivo: c, brilho: 0.6 + 0.3 * Math.sin(t * 2 + i), opacidade: 0.9, aspereza: 0.2 })} />
          <mesh position-y={p.h + p.raio * 0.6} geometry={cone(p.raio * 0.7, p.raio * 1.3, 6)} material={mat(c, { emissivo: c, brilho: 0.9, opacidade: 0.9, aspereza: 0.2 })} />
        </group>
      ))}
      <pointLight position-y={1} intensity={6} distance={5} color={c} />
    </group>
  );
};

// ---------- portal dimensional ----------
export const Portal: React.FC<{ t: number; quando: number; cor: string }> = ({ t, quando, cor }) => {
  const abre = entre(t, quando, quando + 0.8);
  const espiral = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < 160; i++) { const a = i * 0.25, r = 1.3 * (1 - i / 160); pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0.02)); }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);
  return (
    <group position-y={1.7}>
      <mesh><torusGeometry args={[1.6, 0.18, 6, 24]} /><meshStandardMaterial color="#3a3f47" metalness={0.6} roughness={0.4} flatShading /></mesh>
      {Array.from({ length: 8 }, (_, i) => <mesh key={i} position={[Math.cos(i * 0.785) * 1.6, Math.sin(i * 0.785) * 1.6, 0.15]} geometry={esfera(0.08, 0)} material={mat(cor, { emissivo: cor, brilho: 2 })} />)}
      <group scale={abre + 0.001}>
        <mesh><circleGeometry args={[1.45, 32]} /><meshBasicMaterial color={cor} transparent opacity={0.55} side={THREE.DoubleSide} /></mesh>
        <lineSegments geometry={espiral} rotation-z={-t * 3}><lineBasicMaterial color="#ffffff" transparent opacity={0.7} /></lineSegments>
        <mesh rotation-z={t * 2} scale={0.6}><circleGeometry args={[1.45, 6]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.25} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
      </group>
      {abre > 0 && <pointLight position-z={1} intensity={25 * abre} distance={8} color={cor} />}
    </group>
  );
};

// ---------- planeta alienígena ----------
const CEU_ALIEN = new THREE.Color("#2a0f4a"), HORIZONTE_ALIEN = new THREE.Color("#c04a9a");
export const PlanetaAlien: React.FC<{ t: number }> = ({ t }) => {
  const ceu = useMemo(() => {
    const g = new THREE.SphereGeometry(400, 24, 12);
    const p = g.attributes.position, cores = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) c.copy(HORIZONTE_ALIEN).lerp(CEU_ALIEN, Math.pow(Math.max(0, p.getY(i) / 400), 0.5)).toArray(cores, i * 3);
    g.setAttribute("color", new THREE.BufferAttribute(cores, 3));
    return g;
  }, []);
  const chao = useMemo(() => {
    const g = new THREE.PlaneGeometry(300, 260, 80, 70).toNonIndexed();
    g.rotateX(-Math.PI / 2); g.translate(0, 0, -90);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, alturaTerreno(p.getX(i) + 40, p.getZ(i)) * 0.8);
    const cores = new Float32Array(p.count * 3), c = new THREE.Color(), r = rng(19);
    for (let f = 0; f < p.count; f += 3) {
      const y = (p.getY(f) + p.getY(f + 1) + p.getY(f + 2)) / 3;
      c.set(y > 25 ? "#e8d8ff" : y > 10 ? "#5a3a7a" : ["#3a2a5a", "#43306a", "#2f5a6a"][Math.floor(r() * 3)]);
      for (let k = 0; k < 3; k++) c.toArray(cores, (f + k) * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(cores, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  const { cristais, plantas, rochas } = useMemo(() => {
    const r = rng(41), cs: { p: [number, number, number]; s: number; k: number }[] = [], ps: { p: [number, number, number]; h: number; cor: string; fase: number }[] = [], rs: Inst[] = [];
    const livre = (x: number, z: number) => Math.hypot(x, z) > 6 && !(z > -4 && Math.abs(x) < 9);
    const y = (x: number, z: number) => alturaTerreno(x + 40, z) * 0.8;
    for (let i = 0; i < 600 && cs.length < 26; i++) { const x = (r() - 0.5) * 70, z = 6 - r() * 60; if (livre(x, z)) cs.push({ p: [x, y(x, z), z], s: 0.8 + r() * 1.8, k: i }); }
    for (let i = 0; i < 600 && ps.length < 30; i++) { const x = (r() - 0.5) * 60, z = 6 - r() * 50; if (livre(x, z)) ps.push({ p: [x, y(x, z), z], h: 1 + r() * 2.5, cor: ["#5affc0", "#ff4fd8", "#ffe14a"][i % 3], fase: r() * 6 }); }
    for (let i = 0; i < 50; i++) { const x = (r() - 0.5) * 80, z = 8 - r() * 70; if (livre(x, z)) rs.push({ p: [x, y(x, z), z], s: 0.4 + r() * 1.6, r: r() * 6, cor: "#4a3a5a" }); }
    return { cristais: cs, plantas: ps, rochas: rs };
  }, []);
  return (
    <group>
      <mesh geometry={ceu}><meshBasicMaterial vertexColors side={THREE.BackSide} fog={false} depthWrite={false} /></mesh>
      <fog attach="fog" args={["#7a3a8a", 40, 230]} />
      <Estrelas n={600} raio={350} t={t} />
      <hemisphereLight args={["#e0b0ff", "#2a1a3a", 0.9]} />
      <ambientLight intensity={0.25} color="#c08aff" />
      <directionalLight position={[-30, 25, -20]} intensity={1.8} color="#ffd0f0" />
      <directionalLight position={[20, 10, 30]} intensity={0.6} color="#7fd8ff" />
      {/* planeta com anéis e duas luas no céu */}
      <group position={[60, 90, -260]}><Corpo nome="saturno" raio={38} t={t * 0.3} giro={0.02} /></group>
      <mesh position={[-120, 120, -280]} geometry={esfera(14, 1)} material={mat("#ffe0f4", { emissivo: "#ffb0e0", brilho: 0.8, semNevoa: true })} />
      <mesh position={[-60, 160, -300]} geometry={esfera(7, 1)} material={mat("#b0f0ff", { emissivo: "#80d8ff", brilho: 0.8, semNevoa: true })} />
      <mesh geometry={chao} material={MAT_VERTICES} />
      <Instancias itens={rochas} geometria={pedra(1)} material={mat("#ffffff")} />
      {cristais.map((c, i) => <group key={i} position={c.p} scale={c.s}><Cristais t={t} semente={c.k} /></group>)}
      {/* plantas alienígenas: caule que balança e uma bolha de luz na ponta */}
      {plantas.map((p, i) => (
        <group key={i} position={p.p} rotation-z={0.12 * Math.sin(t * 1.2 + p.fase)}>
          <mesh position-y={p.h / 2} geometry={cilindro(0.04, 0.08, p.h, 5)} material={mat("#3a6a5a")} />
          <mesh position-y={p.h} scale={1 + 0.12 * Math.sin(t * 2.5 + p.fase)} geometry={esfera(0.28, 1)} material={mat(p.cor, { emissivo: p.cor, brilho: 1.2, opacidade: 0.9 })} />
        </group>
      ))}
    </group>
  );
};
