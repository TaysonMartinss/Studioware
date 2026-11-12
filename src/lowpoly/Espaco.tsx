import { useMemo } from "react";
import * as THREE from "three";
import { Estrelas } from "./ambiente";
import { Inst, Instancias } from "./Instancias";
import { MAT_VERTICES, esfera, fractal, mat, rng } from "./util";

// Espaço: os corpos do sistema solar em low poly (rochosos com relevo, gasosos às faixas, o Sol a arder),
// o sistema solar com órbitas, um buraco negro com disco de acreção e a comparação de tamanhos à escala real.

export type NomeCorpo = "sol" | "mercurio" | "venus" | "terra" | "lua" | "marte" | "jupiter" | "saturno" | "urano" | "neptuno";
export const CORPOS: Record<NomeCorpo, { nome: string; raioKm: number; tipo: "rocha" | "gas" | "estrela"; cores: string[]; aneis?: boolean; atmosfera?: string }> = {
  sol: { nome: "Sol", raioKm: 696340, tipo: "estrela", cores: ["#ffcf3a", "#ffb020", "#ff8a10", "#ffe27a"] },
  mercurio: { nome: "Mercúrio", raioKm: 2440, tipo: "rocha", cores: ["#9a9188", "#b5aca2", "#7f776f"] },
  venus: { nome: "Vénus", raioKm: 6052, tipo: "gas", cores: ["#e8c98a", "#d9b070", "#f0d9a6"], atmosfera: "#ffd9a0" },
  terra: { nome: "Terra", raioKm: 6371, tipo: "rocha", cores: ["#2a74c4", "#4f9a42", "#5f8f3a", "#f4f8fb"], atmosfera: "#7cc4ff" },
  lua: { nome: "Lua", raioKm: 1737, tipo: "rocha", cores: ["#b3b5b9", "#8a8c90", "#d6d7da"] },
  marte: { nome: "Marte", raioKm: 3390, tipo: "rocha", cores: ["#b0532d", "#c4673a", "#8f3f22", "#f1e6dc"], atmosfera: "#ff9a6a" },
  jupiter: { nome: "Júpiter", raioKm: 69911, tipo: "gas", cores: ["#d8b48a", "#c08a5a", "#efdcc0", "#a8714a", "#e6c9a3"] },
  saturno: { nome: "Saturno", raioKm: 58232, tipo: "gas", cores: ["#e3cf9b", "#cdb27a", "#efe0b8", "#d8c08a"], aneis: true },
  urano: { nome: "Urano", raioKm: 25362, tipo: "gas", cores: ["#9fd8de", "#8ccfd6", "#b3e2e6"], atmosfera: "#bff2f5" },
  neptuno: { nome: "Neptuno", raioKm: 24622, tipo: "gas", cores: ["#4f6fd6", "#3d5cc4", "#6f8fe6"], atmosfera: "#8fb0ff" },
};
const ruido3 = (x: number, y: number, z: number, s: number) => (fractal(x * 1.3 + 3, y * 1.3, s) + fractal(y * 1.3 + 7, z * 1.3, s + 1) + fractal(z * 1.3, x * 1.3 + 11, s + 2)) / 3;

// geometria de cada corpo (raio 1), com uma cor por face
const GEOS = new Map<string, THREE.BufferGeometry>();
export const geoCorpo = (nome: NomeCorpo) => {
  const ja = GEOS.get(nome);
  if (ja) return ja;
  const d = CORPOS[nome];
  const geo = new THREE.IcosahedronGeometry(1, nome === "sol" ? 4 : 5);
  const pos = geo.attributes.position, v = new THREE.Vector3();
  const semente = [...nome].reduce((a, c) => a + c.charCodeAt(0), 0);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const n = ruido3(v.x, v.y, v.z, semente);
    let elev = 1;
    if (nome === "terra") elev = 1 + Math.max(0, n - 0.5) * 0.16;
    else if (d.tipo === "rocha") elev = 1 + (n - 0.5) * (nome === "lua" || nome === "mercurio" ? 0.08 : 0.06);
    else if (d.tipo === "estrela") elev = 1 + (n - 0.5) * 0.05;
    v.multiplyScalar(elev);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  const cores = new Float32Array(pos.count * 3), c = new THREE.Color(), r = rng(semente);
  for (let f = 0; f < pos.count; f += 3) {
    let y = 0, ya = 0, e = 0, xz = 0;
    for (let k = 0; k < 3; k++) { v.fromBufferAttribute(pos, f + k); e += v.length() / 3; y += v.y / 3; ya += Math.abs(v.y) / 3; xz += (v.x + v.z) / 3; }
    if (nome === "terra") c.set(ya > 0.92 ? "#f4f8fb" : e < 1.002 ? (e < 1.0005 ? "#1f5fae" : "#2a74c4") : e > 1.05 ? "#8b7d6b" : e > 1.025 ? "#5f8f3a" : "#4f9a42");
    else if (nome === "marte") c.set(ya > 0.93 ? "#f1e6dc" : e > 1.02 ? "#c4673a" : e < 0.985 ? "#8f3f22" : "#b0532d");
    else if (d.tipo === "rocha") c.set(e < 0.985 ? d.cores[1] : e > 1.02 ? d.cores[2] : d.cores[0]);
    else if (d.tipo === "estrela") c.set(d.cores[Math.floor(r() * d.cores.length)]);
    else {
      // gasosos: faixas por latitude, com ondulação (e a Grande Mancha Vermelha em Júpiter)
      const faixa = Math.floor((y + 1) * 7 + Math.sin(xz * 3) * 0.35 + fractal(xz * 2, y * 2, semente) * 0.6);
      c.set(d.cores[((faixa % d.cores.length) + d.cores.length) % d.cores.length]);
      if (nome === "jupiter" && Math.hypot(y + 0.35, xz - 0.6) < 0.16) c.set("#c0563a");
    }
    for (let k = 0; k < 3; k++) c.toArray(cores, (f + k) * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(cores, 3));
  geo.computeVertexNormals();
  GEOS.set(nome, geo);
  return geo;
};

const MAT_SOL = new THREE.MeshBasicMaterial({ vertexColors: true });

// um corpo celeste no sítio, com rotação própria, anéis, atmosfera e (só a Terra) nuvens
export const Corpo: React.FC<{ nome: NomeCorpo; raio: number; posicao?: [number, number, number]; t: number; giro?: number }> = ({ nome, raio, posicao = [0, 0, 0], t, giro = 0.06 }) => {
  const d = CORPOS[nome];
  const nuvens = useMemo(() => {
    if (nome !== "terra") return [];
    const r = rng(31), out: Inst[] = [];
    for (let i = 0; i < 70; i++) {
      const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      out.push({ p: [1.035 * s * Math.cos(a), 1.035 * u, 1.035 * s * Math.sin(a)], s: [0.06 + r() * 0.12, 0.025 + r() * 0.04, 0.012], r: a });
    }
    return out;
  }, [nome]);
  const aneis = useMemo(() => {
    if (!d.aneis) return null;
    const g = new THREE.RingGeometry(1.35, 2.3, 48, 4);
    const p = g.attributes.position, cores = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const rr = Math.hypot(p.getX(i), p.getY(i));
      c.set(rr < 1.6 ? "#bfa77a" : rr < 1.95 ? "#e6d3a6" : rr < 2.05 ? "#5a4a35" : "#cdb88c").toArray(cores, i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(cores, 3));
    return g;
  }, [d.aneis]);
  return (
    <group position={posicao} scale={raio}>
      <group rotation={[0.35, t * giro, 0.1]}>
        <mesh geometry={geoCorpo(nome)} material={d.tipo === "estrela" ? MAT_SOL : MAT_VERTICES} />
        {nuvens.length > 0 && <Instancias itens={nuvens} geometria={esfera(1, 1)} material={mat("#ffffff", { opacidade: 0.88, emissivo: "#ffffff", brilho: 0.45 })} t={0} mover={(_, __, ___, m) => m.lookAt(0, 0, 0)} />}
      </group>
      {aneis && (
        <mesh geometry={aneis} rotation={[-Math.PI / 2 + 0.45, 0, 0.1]}>
          <meshStandardMaterial vertexColors side={THREE.DoubleSide} transparent opacity={0.9} flatShading roughness={0.9} />
        </mesh>
      )}
      {d.atmosfera && (
        <mesh scale={1.045}>
          <sphereGeometry args={[1, 48, 24]} />
          <meshBasicMaterial color={d.atmosfera} transparent opacity={0.1} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      )}
      {d.tipo === "estrela" && [1.08, 1.22, 1.45].map((s, i) => (
        <mesh key={s} scale={s}>
          <sphereGeometry args={[1, 32, 16]} />
          <meshBasicMaterial color={i ? "#ff9a2a" : "#ffd36a"} transparent opacity={[0.35, 0.15, 0.06][i] * (1 + 0.15 * Math.sin(t * 3 + i))} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
    </group>
  );
};

// luz e fundo do espaço (o Sol à direita, como nas fotos da NASA)
export const LuzEspaco: React.FC<{ t: number; sol?: [number, number, number] }> = ({ t, sol }) => (
  <>
    <Estrelas n={1600} raio={300} t={t} todas />
    <ambientLight intensity={0.12} />
    {sol ? <pointLight position={sol} intensity={600} distance={0} decay={1.6} color="#fff1d6" /> : <directionalLight position={[12, 4, 8]} intensity={3.2} color="#fff6e8" />}
    <directionalLight position={[-10, -2, -6]} intensity={0.25} color="#5a7bd6" />
  </>
);

// ---------- planeta sozinho (cenário "planeta") ----------
export const Planeta: React.FC<{ t: number; tipo?: NomeCorpo; raio: number; posicao: [number, number, number] }> = ({ t, tipo = "terra", raio, posicao }) => (
  <group>
    <LuzEspaco t={t} />
    <Corpo nome={CORPOS[tipo] ? tipo : "terra"} raio={raio} posicao={posicao} t={t} />
    {tipo === "terra" && (
      <group position={posicao} rotation-y={t * 0.15 + 2}>
        <Corpo nome="lua" raio={raio * 0.27} posicao={[raio * 2.4, raio * 0.3, 0]} t={t} giro={0.02} />
      </group>
    )}
  </group>
);

// ---------- sistema solar (fora de escala, para caber) ----------
export const ORBITAS: { nome: NomeCorpo; dist: number; raio: number; fase: number }[] = [
  { nome: "mercurio", dist: 3.6, raio: 0.22, fase: 0.4 }, { nome: "venus", dist: 5, raio: 0.36, fase: 2.1 },
  { nome: "terra", dist: 6.5, raio: 0.38, fase: 4.0 }, { nome: "marte", dist: 8, raio: 0.3, fase: 5.3 },
  { nome: "jupiter", dist: 11.5, raio: 1.05, fase: 1.2 }, { nome: "saturno", dist: 15, raio: 0.9, fase: 3.3 },
  { nome: "urano", dist: 18, raio: 0.6, fase: 0.2 }, { nome: "neptuno", dist: 20.5, raio: 0.58, fase: 2.7 },
];
export const posOrbita = (o: (typeof ORBITAS)[number], t: number): [number, number, number] => {
  const a = o.fase + t * 0.9 * Math.pow(o.dist / 6.5, -1.5) * 0.25;
  return [Math.cos(a) * o.dist, 0, -Math.sin(a) * o.dist];
};
export const SistemaSolar: React.FC<{ t: number }> = ({ t }) => {
  const aneis = useMemo(() => ORBITAS.map((o) => {
    const pts = Array.from({ length: 97 }, (_, i) => { const a = (i / 96) * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * o.dist, 0, Math.sin(a) * o.dist); });
    return new THREE.BufferGeometry().setFromPoints(pts);
  }), []);
  return (
    <group>
      <LuzEspaco t={t} sol={[0, 0, 0]} />
      <Corpo nome="sol" raio={2.1} t={t} giro={0.03} />
      {aneis.map((g, i) => <lineLoop key={i} geometry={g}><lineBasicMaterial color="#8fa6d8" transparent opacity={0.35} /></lineLoop>)}
      {ORBITAS.map((o) => <Corpo key={o.nome} nome={o.nome} raio={o.raio} posicao={posOrbita(o, t)} t={t} giro={0.4} />)}
    </group>
  );
};

// ---------- buraco negro com disco de acreção ----------
export const BuracoNegro: React.FC<{ t: number }> = ({ t }) => {
  const disco = useMemo(() => {
    const g = new THREE.RingGeometry(1.7, 6.5, 96, 6);
    const p = g.attributes.position, cores = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), rr = Math.hypot(x, y), a = Math.atan2(y, x);
      const k = (rr - 1.7) / 4.8;
      const veio = 0.75 + 0.25 * Math.sin(a * 5 + rr * 2.2);
      c.set(k < 0.15 ? "#fff6dc" : k < 0.4 ? "#ffc04a" : k < 0.7 ? "#ff6a1a" : "#7a1a08").multiplyScalar(veio * (1 - k * 0.7)).toArray(cores, i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(cores, 3));
    return g;
  }, []);
  const matDisco = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }), []);
  return (
    <group>
      <LuzEspaco t={t} />
      {/* disco visto quase de lado, a rodar */}
      <mesh geometry={disco} material={matDisco} rotation={[-Math.PI / 2 + 0.22, 0, t * 0.6]} />
      {/* a luz da parte de trás do disco, dobrada por cima e por baixo do horizonte (o efeito "Interstellar") */}
      <mesh geometry={disco} material={matDisco} scale={[0.78, 0.78, 0.78]} rotation={[0.05, 0, t * 0.6]} />
      {/* horizonte de eventos e anel de fotões */}
      <mesh geometry={esfera(1.55, 3)}><meshBasicMaterial color="#000000" /></mesh>
      <mesh rotation-x={0.05}>
        <torusGeometry args={[1.62, 0.05, 6, 64]} />
        <meshBasicMaterial color="#ffe9b0" transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
};

// ---------- comparação de tamanhos (à escala real entre eles) ----------
export const layoutEscala = (corpos: NomeCorpo[], largura: number) => {
  const lista = corpos.filter((c) => CORPOS[c]).sort((a, b) => CORPOS[a].raioKm - CORPOS[b].raioKm);
  const soma = lista.reduce((s, c) => s + CORPOS[c].raioKm * 2, 0);
  const folga = largura * 0.06;
  const k = (largura - folga * (lista.length - 1)) / soma;
  let x = -largura / 2;
  return lista.map((c) => {
    const r = CORPOS[c].raioKm * k;
    const p: [number, number, number] = [x + r, 0, 0];
    x += 2 * r + folga;
    return { nome: c, raio: r, posicao: p };
  });
};
export const Escala: React.FC<{ t: number; corpos: NomeCorpo[]; largura: number }> = ({ t, corpos, largura }) => (
  <group>
    <LuzEspaco t={t} />
    {layoutEscala(corpos, largura).map((c) => <Corpo key={c.nome} nome={c.nome} raio={c.raio} posicao={c.posicao} t={t} />)}
  </group>
);
