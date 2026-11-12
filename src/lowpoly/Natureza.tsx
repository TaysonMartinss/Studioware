import { useMemo } from "react";
import * as THREE from "three";
import { Hora } from "./ambiente";
import { Inst, Instancias } from "./Instancias";
import { MAT_VERTICES, cilindro, cone, esfera, fractal, mat, pedra, rng, suave } from "./util";

// ---------- Natureza: terreno facetado com relevo ----------
export type Bioma = "floresta" | "deserto" | "neve";
const PALETAS: Record<Bioma, { baixo: string[]; rocha: string; alto: string; areia: string; agua?: string; copa: string[] }> = {
  floresta: { baixo: ["#5d9b3e", "#538f37", "#68a646"], rocha: "#7d7468", alto: "#f2f4f7", areia: "#d8c48f", agua: "#3f8fd6", copa: ["#3f8a3a", "#4c9a40", "#357a33", "#5aa845"] },
  deserto: { baixo: ["#e3c27d", "#d9b36b", "#e8cb8c"], rocha: "#b9734a", alto: "#c98a5a", areia: "#e8cf98", copa: ["#5f8f3e"] },
  neve: { baixo: ["#f3f6fa", "#e6edf5", "#fbfcfe"], rocha: "#6f7682", alto: "#ffffff", areia: "#dfe6ee", agua: "#7fb3d9", copa: ["#2f5d3a", "#386b42"] },
};

// altura do terreno: plano à volta das personagens, colinas a meio e montanhas ao fundo
export const alturaTerreno = (x: number, z: number) => {
  const d = Math.hypot(x, z);
  const plano = suave((d - 7) / 18) * (1 - suave((z + 2) / 8)); // à frente do palco fica plano (é onde está a câmara)
  const colinas = (fractal(x * 0.03, z * 0.03, 3) - 0.45) * 9;
  const montanhas = suave((-z - 35) / 50) * Math.pow(fractal(x * 0.012 + 9, z * 0.012, 5, 5), 1.6) * 75;
  return plano * (colinas + montanhas);
};

export const Natureza: React.FC<{ hora: Hora; t: number; bioma?: Bioma }> = ({ hora, t, bioma = "floresta" }) => {
  const P = PALETAS[bioma];
  const terreno = useMemo(() => {
    const g = new THREE.PlaneGeometry(340, 300, 90, 80).toNonIndexed();
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, -100);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, alturaTerreno(pos.getX(i), pos.getZ(i)));
    // uma cor por face, pela altura e inclinação
    const cores = new Float32Array(pos.count * 3), c = new THREE.Color(), r = rng(5);
    for (let f = 0; f < pos.count; f += 3) {
      const ys = [pos.getY(f), pos.getY(f + 1), pos.getY(f + 2)];
      const y = (ys[0] + ys[1] + ys[2]) / 3, desnivel = Math.max(...ys) - Math.min(...ys);
      const cor = y > 38 ? P.alto : desnivel > 2.2 || y > 22 ? P.rocha : y < -0.6 && P.agua ? P.areia : P.baixo[Math.floor(r() * P.baixo.length)];
      c.set(cor);
      for (let k = 0; k < 3; k++) c.toArray(cores, (f + k) * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(cores, 3));
    g.computeVertexNormals();
    return g;
  }, [bioma]);

  const { troncos, copas, pedras, nuvens } = useMemo(() => {
    const r = rng(17);
    const tr: Inst[] = [], cp: Inst[] = [], pd: Inst[] = [];
    for (let i = 0; i < 900 && tr.length < 260; i++) {
      const x = (r() - 0.5) * 220, z = 20 - r() * 170;
      if (Math.hypot(x, z) < 9 || (z > -6 && Math.abs(x) < 14)) continue; // deixa livre o palco e o caminho da câmara
      const y = alturaTerreno(x, z);
      if (y < -0.4 || y > 20) continue;
      const s = 0.8 + r() * 0.8;
      tr.push({ p: [x, y, z], s, r: r() * 6 });
      cp.push({ p: [x, y, z], s, r: r() * 6, cor: P.copa[Math.floor(r() * P.copa.length)] });
    }
    for (let i = 0; i < 70; i++) {
      const x = (r() - 0.5) * 120, z = 10 - r() * 90;
      if (Math.hypot(x, z) < 6) continue;
      pd.push({ p: [x, alturaTerreno(x, z), z], s: 0.4 + r() * 1.4, r: r() * 6, cor: P.rocha });
    }
    const nv = Array.from({ length: 9 }, () => ({ x: (r() - 0.5) * 260, y: 32 + r() * 22, z: -60 - r() * 90, s: 2 + r() * 3, v: 0.6 + r() * 0.8 }));
    return { troncos: tr, copas: cp, pedras: pd, nuvens: nv };
  }, [bioma]);

  const deserto = bioma === "deserto";
  return (
    <group>
      <mesh geometry={terreno} material={MAT_VERTICES} />
      {P.agua && <mesh position={[0, -0.9 + 0.05 * Math.sin(t), -100]} rotation-x={-Math.PI / 2}><planeGeometry args={[340, 300, 1, 1]} /><meshStandardMaterial color={P.agua} transparent opacity={0.82} roughness={0.25} metalness={0.1} flatShading /></mesh>}
      {/* árvores: tronco + duas copas em cone (no deserto são catos) */}
      <Instancias itens={troncos} geometria={deserto ? cilindro(0.35, 0.4, 3.2, 6) : cilindro(0.18, 0.28, 2, 5)} material={mat(deserto ? "#5f8f3e" : "#6b4a2e")} t={0}
        mover={(_, it, __, m) => { m.position.y += deserto ? 1.6 * (typeof it.s === "number" ? it.s : 1) : 1 * (typeof it.s === "number" ? it.s : 1); }} />
      {!deserto && (
        <>
          <Instancias itens={copas} geometria={cone(1.6, 3.2, 6)} material={mat("#ffffff")} t={0} mover={(_, it, __, m) => { m.position.y += 3 * (it.s as number); }} />
          <Instancias itens={copas} geometria={cone(1.15, 2.4, 6)} material={mat("#ffffff")} t={0} mover={(_, it, __, m) => { m.position.y += 4.6 * (it.s as number); }} />
        </>
      )}
      <Instancias itens={pedras} geometria={pedra(1)} material={mat("#ffffff")} />
      {/* nuvens que passam devagar */}
      {hora !== "noite" && nuvens.map((n, i) => (
        <group key={i} position={[((n.x + t * n.v + 130) % 260) - 130, n.y, n.z]} scale={n.s}>
          {[[0, 0, 0, 1.4], [1.5, -0.2, 0.3, 1.1], [-1.4, -0.3, -0.2, 1], [0.4, 0.6, -0.3, 0.9]].map(([x, y, z, s], k) => (
            <mesh key={k} position={[x, y, z]} geometry={esfera(s, 0)} material={mat(hora === "tarde" ? "#ffd9c2" : "#ffffff", { emissivo: "#ffffff", brilho: 0.15 })} />
          ))}
        </group>
      ))}
    </group>
  );
};
