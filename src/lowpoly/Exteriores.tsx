import { useMemo } from "react";
import * as THREE from "three";
import { Braquiossauro, Cardume, PeixeGrande, Pterossauro, Tiranossauro } from "./Animais";
import { Inst, Instancias } from "./Instancias";
import { BandeiraBrasil, Boxes, CarroF1, CeuChuva, Chuva, Flores, PainelPodio } from "./F1";
import { alturaTerreno } from "./Natureza";
import { Objeto } from "./Objetos";
import { MAT_VERTICES, caixa, cilindro, cone, esfera, fractal, mat, pedra, rng } from "./util";

// ---------- fundo do mar ----------
// Areia com dunas, rochas, corais coloridos, algas a ondular, raios de luz vindos da superfície, bolhas a subir,
// cardumes a nadar às voltas, um tubarão ao fundo e os restos de um barco afundado.
export const FundoMar: React.FC<{ t: number }> = ({ t }) => {
  const areia = useMemo(() => {
    const g = new THREE.PlaneGeometry(160, 160, 60, 60).toNonIndexed().rotateX(-Math.PI / 2);
    const p = g.attributes.position, cores = new Float32Array(p.count * 3), c = new THREE.Color(), r = rng(8);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), d = Math.hypot(x, z);
      p.setY(i, (fractal(x * 0.05, z * 0.05, 4) - 0.5) * 3 * Math.min(1, Math.max(0, (d - 5) / 10)));
    }
    for (let f = 0; f < p.count; f += 3) { c.set(["#d9c48c", "#cdb77c", "#e2cf98"][Math.floor(r() * 3)]); for (let k = 0; k < 3; k++) c.toArray(cores, (f + k) * 3); }
    g.setAttribute("color", new THREE.BufferAttribute(cores, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  const { rochas, corais, algas, bolhas } = useMemo(() => {
    const r = rng(21);
    const rs: Inst[] = [], cs: { p: [number, number, number]; tipo: number; cor: string; s: number }[] = [], as: { p: [number, number, number]; h: number; fase: number }[] = [], bs: { x: number; z: number; v: number; o: number }[] = [];
    const longe = (x: number, z: number) => Math.hypot(x, z) > 4.5 && !(z > -2 && Math.abs(x) < 7);
    for (let i = 0; i < 400 && rs.length < 40; i++) { const x = (r() - 0.5) * 70, z = 6 - r() * 60; if (longe(x, z)) rs.push({ p: [x, 0, z], s: 0.5 + r() * 2.2, r: r() * 6, cor: ["#6f6a62", "#7d756a", "#5a5650"][i % 3] }); }
    const coresCoral = ["#ff6a8a", "#ff9a3a", "#b05ad9", "#ffd23a", "#3fd6c6", "#ff4a5a"];
    for (let i = 0; i < 400 && cs.length < 45; i++) { const x = (r() - 0.5) * 50, z = 4 - r() * 40; if (longe(x, z)) cs.push({ p: [x, 0, z], tipo: i % 3, cor: coresCoral[Math.floor(r() * coresCoral.length)], s: 0.6 + r() * 0.9 }); }
    for (let i = 0; i < 400 && as.length < 35; i++) { const x = (r() - 0.5) * 50, z = 4 - r() * 40; if (longe(x, z)) as.push({ p: [x, 0, z], h: 4 + Math.floor(r() * 5), fase: r() * 6 }); }
    for (let i = 0; i < 40; i++) bs.push({ x: (r() - 0.5) * 30, z: -r() * 25, v: 0.8 + r() * 0.8, o: r() * 14 });
    return { rochas: rs, corais: cs, algas: as, bolhas: bs };
  }, []);
  return (
    <group>
      <fog attach="fog" args={["#0d5a80", 6, 55]} />
      <hemisphereLight args={["#9fe0ff", "#0a2a3a", 1.1]} />
      <ambientLight intensity={0.3} color="#7fc8ff" />
      <directionalLight position={[4, 20, 6]} intensity={1.6} color="#d6f3ff" />
      <mesh geometry={areia} material={MAT_VERTICES} />
      <Instancias itens={rochas} geometria={pedra(1)} material={mat("#ffffff")} />
      {corais.map((c, i) => (
        <group key={i} position={c.p} scale={c.s}>
          {c.tipo === 0 && [0, 1, 2, 3].map((k) => <mesh key={k} position={[Math.cos(k * 1.7) * 0.25, 0.5 + k * 0.15, Math.sin(k * 1.7) * 0.25]} rotation={[Math.cos(k) * 0.4, 0, Math.sin(k) * 0.4]} geometry={cilindro(0.06, 0.1, 1 + k * 0.2, 5)} material={mat(c.cor)} />)}
          {c.tipo === 1 && <mesh position-y={0.35} scale={[1, 0.7, 1]} geometry={esfera(0.5, 1)} material={mat(c.cor)} />}
          {c.tipo === 2 && [0, 1, 2].map((k) => <mesh key={k} position={[k * 0.25 - 0.25, 0.4, 0]} geometry={cone(0.25, 0.9 + k * 0.2, 6)} material={mat(c.cor)} />)}
        </group>
      ))}
      {/* algas: troncos de blocos que ondulam com a corrente */}
      {algas.map((a, i) => (
        <group key={i} position={a.p}>
          {Array.from({ length: a.h }, (_, k) => (
            <mesh key={k} position={[Math.sin(t * 1.3 + a.fase + k * 0.5) * 0.08 * k, 0.35 + k * 0.6, 0]} rotation-z={Math.sin(t * 1.3 + a.fase + k * 0.5) * 0.15} geometry={caixa(0.18, 0.6, 0.05)} material={mat(k % 2 ? "#3f8f4a" : "#4fa358")} />
          ))}
        </group>
      ))}
      {/* raios de luz da superfície */}
      {[[-6, -10, 0.25], [2, -14, -0.15], [9, -8, 0.1], [-2, -22, 0.05]].map(([x, z, inc], i) => (
        <mesh key={i} position={[x, 12, z]} rotation-z={inc}>
          <coneGeometry args={[3.5, 26, 8, 1, true]} />
          <meshBasicMaterial color="#bfefff" transparent opacity={0.05 + 0.02 * Math.sin(t * 0.8 + i)} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} fog={false} />
        </mesh>
      ))}
      {bolhas.map((b, i) => {
        const y = ((t * b.v + b.o) % 14);
        return <mesh key={i} position={[b.x + Math.sin(t * 2 + i) * 0.15, y, b.z]} geometry={esfera(0.06 + (i % 3) * 0.03, 0)} material={mat("#e6f8ff", { opacidade: 0.6, emissivo: "#ffffff", brilho: 0.3 })} />;
      })}
      <Cardume t={t} centro={[-5, 2.5, -9]} raio={3} semente={1} />
      <Cardume t={t} centro={[6, 3.5, -13]} raio={4} n={18} semente={2} />
      <Cardume t={t * 1.2} centro={[1, 5, -20]} raio={5} n={20} semente={3} />
      <PeixeGrande t={t} tipo="tubarao" z={-22} y={5} />
      {/* barco afundado */}
      <group position={[12, 0.3, -20]} rotation={[0.15, -0.6, 0.35]}>
        <mesh position-y={0.8} geometry={caixa(7, 1.6, 2.4)} material={mat("#5a4030")} />
        <mesh position={[3.8, 0.9, 0]} rotation-y={Math.PI / 4} geometry={caixa(1.7, 1.5, 1.7)} material={mat("#5a4030")} />
        <mesh position={[-0.5, 3, 0]} geometry={cilindro(0.1, 0.12, 4, 5)} material={mat("#4a3426")} />
      </group>
    </group>
  );
};

// ---------- pré-história ----------
// Selva com palmeiras e fetos, um vulcão a fumegar ao fundo, um T-rex a passar, braquiossauros ao longe e pterossauros no céu.
export const PreHistoria: React.FC<{ t: number; comDinos?: boolean }> = ({ t, comDinos = true }) => {
  const chao = useMemo(() => {
    const g = new THREE.PlaneGeometry(300, 260, 80, 70).toNonIndexed();
    g.rotateX(-Math.PI / 2); g.translate(0, 0, -90);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, alturaTerreno(p.getX(i), p.getZ(i)) * 0.6);
    const cores = new Float32Array(p.count * 3), c = new THREE.Color(), r = rng(6);
    for (let f = 0; f < p.count; f += 3) {
      const y = (p.getY(f) + p.getY(f + 1) + p.getY(f + 2)) / 3;
      c.set(y > 18 ? "#6d5a4a" : y > 9 ? "#5d7a3a" : ["#4f8a33", "#5a9a3a", "#447a2c"][Math.floor(r() * 3)]);
      for (let k = 0; k < 3; k++) c.toArray(cores, (f + k) * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(cores, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  const { palmeiras, fetos } = useMemo(() => {
    const r = rng(33), ps: { p: [number, number, number]; s: number; r: number }[] = [], fs: Inst[] = [];
    for (let i = 0; i < 700 && ps.length < 70; i++) {
      const x = (r() - 0.5) * 140, z = 15 - r() * 110;
      if (Math.hypot(x, z) < 14 || (z > -14 && Math.abs(x) < 18)) continue;
      ps.push({ p: [x, alturaTerreno(x, z) * 0.6, z], s: 0.8 + r() * 0.6, r: r() * 6 });
    }
    for (let i = 0; i < 160; i++) {
      const x = (r() - 0.5) * 60, z = 8 - r() * 50;
      if (Math.hypot(x, z) < 4) continue;
      fs.push({ p: [x, alturaTerreno(x, z) * 0.6, z], s: [1 + r(), 0.5 + r() * 0.4, 1 + r()], r: r() * 6, cor: ["#3f8a3a", "#4fa045", "#2f7030"][i % 3] });
    }
    return { palmeiras: ps, fetos: fs };
  }, []);
  const vulcao = { tipo: "vulcao" as const, posicao: [-38, 0, -75] as [number, number, number], escala: 3.2, quando: -10, cor: "#ff6a1a", cor2: "#ff6a1a", girar: false };
  // o T-rex anda para um lado e para o outro em frente à câmara (vira-se nas pontas)
  const xRex = 3 * Math.sin(t * 0.35), viraRex = Math.cos(t * 0.35) >= 0 ? 0 : Math.PI;
  return (
    <group>
      <mesh geometry={chao} material={MAT_VERTICES} />
      {palmeiras.map((p, i) => (
        <group key={i} position={p.p} rotation-y={p.r} scale={p.s}>
          {[0, 1, 2, 3].map((k) => <mesh key={k} position={[k * 0.12, 0.9 + k * 1.6, 0]} rotation-z={-0.06 * k} geometry={cilindro(0.18 - k * 0.02, 0.22 - k * 0.02, 1.7, 6)} material={mat("#7a5a3a")} />)}
          {Array.from({ length: 7 }, (_, k) => (
            <group key={k} position={[0.45, 6.8, 0]} rotation={[0, (k / 7) * Math.PI * 2, -0.5 + 0.06 * Math.sin(t * 1.5 + i + k)]}>
              <mesh position={[1.2, -0.25, 0]} rotation-z={-0.3} scale={[2.6, 0.06, 0.55]} geometry={caixa(1, 1, 1)} material={mat(k % 2 ? "#3f8a3a" : "#4f9a40")} />
            </group>
          ))}
        </group>
      ))}
      <Instancias itens={fetos} geometria={cone(0.8, 1, 7)} material={mat("#ffffff")} />
      <Objeto o={vulcao} t={t} />
      {comDinos && (
        <>
          <group position={[xRex, 0, -9]} rotation-y={viraRex} scale={0.95}><Tiranossauro t={t} acao="andar" /></group>
          <group position={[-24 + ((t * 0.8) % 30), alturaTerreno(-20, -40) * 0.6, -40]} scale={1}><Braquiossauro t={t} acao="andar" /></group>
          <group position={[10, alturaTerreno(16, -48) * 0.6, -48]} rotation-y={Math.PI} scale={0.85}><Braquiossauro t={t + 1.3} acao="parado" cor="#8a8f6a" /></group>
          <Pterossauro t={t} raio={12} fase={0} />
          <Pterossauro t={t} raio={16} fase={2.2} cor="#8a4a3a" />
          <Pterossauro t={t} raio={10} fase={4.1} />
        </>
      )}
    </group>
  );
};

// ---------- pista de corrida ----------
// Reta da meta com zebras, bancada cheia, pórtico de partida com luzes, barreiras de pneus e carros de F1 a passar.
// variante: chuva (céu cinzento, piso molhado, spray) | boxes (garagens e pit lane) | podio (painel atrás; os degraus
// ficam debaixo das personagens) | vazia (pista sem carros nem público, com flores e bandeira: homenagem)
const CORES_CORRIDA = ["#e5281f", "#1f6fe5", "#f2c12e", "#1fae5a", "#f4f4f4", "#ff7a1a"];
const CAPACETES = ["#f2d21b", "#f4f4f4", "#e5281f", "#1f6fe5", "#1b1b1b", "#ff7a1a"];
export const Corrida: React.FC<{ t: number; cor: string; cor2: string; variante?: string }> = ({ t, cor, cor2, variante }) => {
  const chuva = variante === "chuva", vazia = variante === "vazia", podio = variante === "podio";
  const { publico, arvores } = useMemo(() => {
    const r = rng(77), pub: Inst[] = [], arv: Inst[] = [];
    const cores = [cor, cor2, "#f2f2f2", "#e5281f", "#1f6fe5", "#f2c12e", "#222"];
    for (let k = 0; k < 6; k++) for (let x = -60; x <= 60; x += 0.75) if (r() > 0.15) pub.push({ p: [x, 1.4 + k * 0.8 + 0.3, -16 - k * 1.2], s: [1, 0.85 + r() * 0.3, 1], cor: chuva && r() < 0.5 ? ["#1f6fe5", "#f2c12e", "#e5281f"][Math.floor(r() * 3)] : cores[Math.floor(r() * cores.length)] });
    for (let i = 0; i < 60; i++) arv.push({ p: [(r() - 0.5) * 220, 0, -30 - r() * 40], s: 1 + r() * 1.4, r: r() * 6 });
    return { publico: pub, arvores: arv };
  }, [cor, cor2, chuva]);
  if (variante === "boxes") return <Boxes t={t} cor={cor} cor2={cor2} />;
  const carros = vazia || podio ? [] : CORES_CORRIDA.map((c, i) => ({ c, faixa: i % 2, x0: i * 33, v: (chuva ? 20 : 26) + (i % 3) * 3 }));
  const luzes = Math.min(5, Math.floor(t * 1.5));
  return (
    <group>
      {chuva && <CeuChuva />}
      {chuva && <Chuva t={t} />}
      <mesh position={[0, -0.02, 0]} geometry={caixa(400, 0.02, 200)} material={mat(chuva ? "#3f7432" : "#4f8f3a")} />
      {/* asfalto (molhado: mais escuro e a brilhar) */}
      <mesh position={[0, 0.01, -5]} geometry={caixa(400, 0.02, 10)} material={chuva ? mat("#24262b", { aspereza: 0.18, metal: 0.45 }) : mat("#34363b")} />
      {chuva && [[-14, -3], [6, -7], [22, -4], [-30, -6]].map(([x, z], i) => <mesh key={i} position={[x, 0.025, z]} geometry={caixa(5 + i, 0.005, 1.4)} material={mat("#5d6f82", { aspereza: 0.05, metal: 0.7 })} />)}
      {/* zebras vermelho/branco nas margens */}
      {Array.from({ length: 60 }, (_, i) => [-0.3, -9.7].map((z) => <mesh key={`${i}${z}`} position={[-120 + i * 4, 0.03, z]} geometry={caixa(2, 0.03, 0.6)} material={mat(i % 2 ? "#e5281f" : "#f4f4f4")} />))}
      <mesh position={[4, 0.025, -5]} geometry={caixa(1.2, 0.02, 10)} material={mat("#f4f4f4")} />
      {/* bancada e público (vazia: bancada sem ninguém) */}
      {Array.from({ length: 6 }, (_, k) => <mesh key={k} position={[0, (1.4 + k * 0.8) / 2, -16 - k * 1.2]} geometry={caixa(124, 1.4 + k * 0.8, 1.2)} material={mat(k % 2 ? "#8d939c" : "#7d838c")} />)}
      <mesh position={[0, 9.5, -19]} rotation-x={0.15} geometry={caixa(126, 0.3, 9)} material={mat(cor2)} />
      {!vazia && <Instancias itens={publico} geometria={caixa(0.42, 0.62, 0.34)} material={mat("#ffffff")} t={t} mover={(i, _it, tt, m) => { m.position.y += 0.08 * Math.max(0, Math.sin(tt * (podio ? 11 : 7) + i)) * (podio ? 2 : 1); }} />}
      {/* barreira de pneus e muro */}
      <mesh position={[0, 0.5, -11.2]} geometry={caixa(400, 1, 0.4)} material={mat("#f2f2f2")} />
      {Array.from({ length: 50 }, (_, i) => <mesh key={i} position={[-100 + i * 4, 0.3, -10.6]} rotation-x={Math.PI / 2} geometry={cilindro(0.35, 0.35, 0.6, 8)} material={mat(i % 2 ? "#151515" : cor)} />)}
      {/* pórtico de partida com as cinco luzes (apagadas na pista vazia) */}
      <group position={[4, 0, -5]}>
        {[5.6, -5.6].map((z) => <mesh key={z} position={[0, 3, z]} geometry={caixa(0.4, 6, 0.4)} material={mat("#2a2d33")} />)}
        <mesh position={[0, 6, 0]} geometry={caixa(0.6, 0.8, 11.6)} material={mat("#2a2d33")} />
        {Array.from({ length: 5 }, (_, i) => <mesh key={i} position={[0.32, 6, -2 + i]} geometry={esfera(0.22, 1)} material={mat("#ff2a1f", { emissivo: "#ff2a1f", brilho: !vazia && i < luzes ? 2.5 : 0.05 })} />)}
      </group>
      <Instancias itens={arvores} geometria={esfera(2.2, 0)} material={mat(chuva ? "#335f2c" : "#3f7a35")} t={0} mover={(_, it, __, m) => { m.position.y += 2.2 * (it.s as number); }} />
      {carros.map((k, i) => {
        const x = ((((k.x0 + k.v * t) % 200) + 200) % 200) - 100;
        return <group key={i} position={[x, 0, k.faixa ? -6.8 : -3.3]} scale={0.8}><CarroF1 cor={k.c} cor2={i % 2 ? "#f4f4f4" : "#1b1b1b"} t={t} vel={k.v} capacete={CAPACETES[i]} chuva={chuva} /></group>;
      })}
      {/* homenagem: flores ao pé do muro e uma bandeira do Brasil grande presa à rede */}
      {vazia && <Flores largura={10} />}
      {vazia && (
        <group position={[0, 0, -11.3]}>
          {[-1.9, 1.9].map((x) => <mesh key={x} position={[x, 2.2, 0]} geometry={cilindro(0.05, 0.05, 4.4, 6)} material={mat("#c9ced6")} />)}
          <group position={[0, 3.2, 0.05]}><BandeiraBrasil t={t * 0.4} l={3.6} a={2.4} /></group>
        </group>
      )}
      {podio && <PainelPodio cor={cor} cor2={cor2} />}
    </group>
  );
};
