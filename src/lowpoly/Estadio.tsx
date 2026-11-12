import { useMemo } from "react";
import * as THREE from "three";
import { Hora } from "./ambiente";
import { Inst, Instancias } from "./Instancias";
import { caixa, cilindro, esfera, geo, mat, rng } from "./util";

// Estádio de futebol: relvado às faixas com as linhas da grande área, baliza com rede, placas de LED,
// bancadas em degraus com público (que salta quando há festa), torres de iluminação e o monitor do VAR.
// As personagens ficam na grande área, à volta da origem; a baliza está atrás delas (z = -14).

const LINHA = 0.12;
const BALIZA_Z = -14;

// rede da baliza: grelha de linhas (fundo, lados e teto)
const redeGeo = () => {
  const p: number[] = [];
  const L = 3.66, A = 2.44, F = 2.2, passo = 0.3;
  const seg = (a: number[], b: number[]) => p.push(...a, ...b);
  for (let x = -L; x <= L + 1e-6; x += passo) { seg([x, 0, -F], [x, A, -F]); seg([x, A, 0], [x, A, -F]); }
  for (let y = 0; y <= A + 1e-6; y += passo) { seg([-L, y, -F], [L, y, -F]); seg([-L, y, 0], [-L, y, -F]); seg([L, y, 0], [L, y, -F]); }
  for (let z = 0; z >= -F - 1e-6; z -= passo) { seg([-L, A, z], [L, A, z]); seg([-L, 0, z], [-L, A, z]); seg([L, 0, z], [L, A, z]); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  return g;
};

const Linha: React.FC<{ x: number; z: number; l: number; p: number }> = ({ x, z, l, p }) => (
  <mesh position={[x, 0.025, z]} geometry={caixa(l, 0.01, p)} material={mat("#f4f7f2", { brilho: 0.15, emissivo: "#ffffff" })} />
);

export const Estadio: React.FC<{ hora: Hora; t: number; festa: number; cor: string; cor2: string }> = ({ hora, t, festa, cor, cor2 }) => {
  const noite = hora === "noite";
  const relva = noite ? ["#2f8f3a", "#38a145"] : ["#4a9e3f", "#57ad4a"];

  // público: bancada atrás da baliza e duas laterais, cada degrau com uma fila de adeptos
  const { publico, degraus, cabecas } = useMemo(() => {
    const r = rng(42);
    const cores = [cor, cor, cor2, "#f2f2f2", "#1d1d1d", "#d63b3b", "#2d5bd6", "#f2d21b"];
    const pub: Inst[] = [], deg: { p: [number, number, number]; s: [number, number, number] }[] = [];
    for (let k = 0; k < 10; k++) {
      const h = 1.4 + k * 0.85;
      deg.push({ p: [0, h / 2, -20 - k * 1.6], s: [96, h, 1.6] });
      for (let x = -46; x <= 46; x += 0.72) if (r() > 0.12) pub.push({ p: [x + (r() - 0.5) * 0.2, h + 0.32, -20 - k * 1.6], s: [1, 0.85 + r() * 0.3, 1], cor: cores[Math.floor(r() * cores.length)] });
      for (const lado of [1, -1]) {
        deg.push({ p: [lado * (40 + k * 1.6), h / 2, 22], s: [1.6, h, 84] });
        for (let z = -19; z <= 62; z += 0.72) if (r() > 0.12) pub.push({ p: [lado * (40 + k * 1.6), h + 0.32, z + (r() - 0.5) * 0.2], s: [1, 0.85 + r() * 0.3, 1], r: lado * Math.PI / 2, cor: cores[Math.floor(r() * cores.length)] });
      }
    }
    const peles = ["#f2c9a6", "#e0ab7f", "#b97a4f", "#8a5634"];
    const cab: Inst[] = pub.map((q) => ({ ...q, s: 1, cor: peles[Math.floor(r() * 4)], p: [q.p[0], q.p[1] + 0.48, q.p[2]] }));
    return { publico: pub, degraus: deg, cabecas: cab };
  }, [cor, cor2]);

  const corpoAdepto = useMemo(() => new THREE.BoxGeometry(0.42, 0.62, 0.34), []);
  const branco = mat("#ffffff");
  const rede = useMemo(redeGeo, []);
  const arcoGrande = geo("arcoArea", () => new THREE.TorusGeometry(9.15, 0.06, 3, 20, 1.852));
  const circulo = geo("circuloCentral", () => new THREE.TorusGeometry(9.15, 0.06, 3, 36));
  const anuncio = Math.floor(t / 4);

  return (
    <group>
      {/* relvado às faixas */}
      {Array.from({ length: 22 }, (_, i) => (
        <mesh key={i} position={[0, 0, BALIZA_Z + 2.5 + i * 5 - 5]} geometry={caixa(72, 0.02, 5)} material={mat(relva[i % 2])} />
      ))}
      <mesh position={[0, -0.05, 20]} geometry={caixa(200, 0.02, 200)} material={mat("#2c6a2a")} />
      {/* linhas: fundo, grande área, pequena área, marca de penálti, meia-lua e círculo central */}
      <Linha x={0} z={BALIZA_Z} l={68} p={LINHA} />
      <Linha x={-20.16} z={BALIZA_Z + 8.25} l={LINHA} p={16.5} />
      <Linha x={20.16} z={BALIZA_Z + 8.25} l={LINHA} p={16.5} />
      <Linha x={0} z={BALIZA_Z + 16.5} l={40.32} p={LINHA} />
      <Linha x={-9.16} z={BALIZA_Z + 2.75} l={LINHA} p={5.5} />
      <Linha x={9.16} z={BALIZA_Z + 2.75} l={LINHA} p={5.5} />
      <Linha x={0} z={BALIZA_Z + 5.5} l={18.32} p={LINHA} />
      <Linha x={-34} z={BALIZA_Z + 26} l={LINHA} p={52} />
      <Linha x={34} z={BALIZA_Z + 26} l={LINHA} p={52} />
      <Linha x={0} z={BALIZA_Z + 52.5} l={68} p={LINHA} />
      <mesh position={[0, 0.026, BALIZA_Z + 11]} geometry={cilindro(0.12, 0.12, 0.01, 8)} material={mat("#f4f7f2")} />
      <group position={[0, 0.026, BALIZA_Z + 11]} rotation-x={-Math.PI / 2}><mesh rotation-z={3.786} geometry={arcoGrande} material={mat("#f4f7f2")} /></group>
      <group position={[0, 0.026, BALIZA_Z + 52.5]} rotation-x={-Math.PI / 2}><mesh geometry={circulo} material={mat("#f4f7f2")} /></group>

      {/* baliza */}
      <group position={[0, 0, BALIZA_Z]}>
        {[-3.66, 3.66].map((x) => <mesh key={x} position={[x, 1.22, 0]} geometry={cilindro(0.06, 0.06, 2.44, 8)} material={mat("#ffffff", { brilho: 0.2, emissivo: "#ffffff" })} />)}
        <mesh position={[0, 2.44, 0]} rotation-z={Math.PI / 2} geometry={cilindro(0.06, 0.06, 7.44, 8)} material={mat("#ffffff", { brilho: 0.2, emissivo: "#ffffff" })} />
        <lineSegments geometry={rede}><lineBasicMaterial color="#ffffff" transparent opacity={0.55} /></lineSegments>
      </group>

      {/* placas de publicidade em LED (trocam a cada 4 s) */}
      {Array.from({ length: 10 }, (_, i) => {
        const c = [cor, cor2, "#ffffff", "#ffcc00", "#00c2ff"][(i + anuncio) % 5];
        return <mesh key={i} position={[-30 + i * 6.7, 0.45, BALIZA_Z - 3.5]} geometry={caixa(6.5, 0.9, 0.2)} material={mat("#111111", { emissivo: c, brilho: noite ? 1.3 : 0.8 })} />;
      })}

      {/* bancadas e público */}
      {degraus.map((d, i) => <mesh key={i} position={d.p} geometry={caixa(...d.s)} material={mat(i % 2 ? "#8d939c" : "#7d838c")} />)}
      <Instancias itens={publico} geometria={corpoAdepto} material={branco} t={t}
        mover={(i, it, tt, m) => {
          const fase = (it.p[0] + it.p[2]) * 0.35 + i * 0.37;
          m.position.y += (0.05 + 0.32 * festa) * Math.max(0, Math.sin(tt * (4 + 3 * festa) + fase));
        }} />
      {/* cabeças do público (uma esfera por adepto, mesma animação) */}
      <Instancias itens={cabecas}
        geometria={esfera(0.16, 0)} material={branco} t={t}
        mover={(i, it, tt, m) => {
          const fase = (it.p[0] + it.p[2]) * 0.35 + i * 0.37;
          m.position.y += (0.05 + 0.32 * festa) * Math.max(0, Math.sin(tt * (4 + 3 * festa) + fase));
        }} />
      {/* cobertura das bancadas */}
      <mesh position={[0, 14.5, -28]} rotation-x={0.12} geometry={caixa(100, 0.4, 18)} material={mat("#3a3f48")} />
      {[1, -1].map((l) => <mesh key={l} position={[l * 48, 14.5, 22]} rotation-z={-0.12 * l} geometry={caixa(18, 0.4, 90)} material={mat("#3a3f48")} />)}
      {/* ecrã gigante */}
      <mesh position={[0, 17.5, -30]} geometry={caixa(16, 5, 0.6)} material={mat("#15171c")} />
      <mesh position={[0, 17.5, -29.65]} geometry={caixa(15, 4.2, 0.05)} material={mat("#0a0c10", { emissivo: cor, brilho: 0.35 })} />

      {/* torres de iluminação */}
      {[[-44, -24], [44, -24], [-44, 60], [44, 60]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position-y={17} geometry={cilindro(0.4, 0.6, 34, 6)} material={mat("#6b717b")} />
          <mesh position={[0, 34, 0]} rotation-y={Math.atan2(-x, -z + 20)} geometry={caixa(5, 3, 0.6)} material={mat("#e8eef7", { emissivo: "#ffffff", brilho: noite ? 2.2 : 0.3 })} />
        </group>
      ))}
      {noite && <directionalLight position={[0, 40, 30]} intensity={1.6} color="#f2f6ff" />}
      {noite && <hemisphereLight args={["#cfe0ff", "#1f5a2a", 0.7]} />}

      {/* monitor do VAR à beira do relvado */}
      <group position={[9.5, 0, BALIZA_Z + 3]} rotation-y={-0.5}>
        <mesh position-y={0.55} geometry={caixa(0.5, 1.1, 0.5)} material={mat("#22262e")} />
        <mesh position-y={1.45} geometry={caixa(0.95, 0.65, 0.12)} material={mat("#1a1d24")} />
        <mesh position={[0, 1.45, 0.065]} geometry={caixa(0.85, 0.55, 0.01)} material={mat("#0c1a2e", { emissivo: "#3aa0ff", brilho: 0.9 })} />
        <mesh position={[0, 1.83, 0.05]} geometry={caixa(1.05, 0.08, 0.35)} material={mat("#1a1d24")} />
      </group>
    </group>
  );
};
