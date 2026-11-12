import { useMemo } from "react";
import * as THREE from "three";
import { Hora } from "./ambiente";
import { Inst, Instancias } from "./Instancias";
import { caixa, cilindro, clamp01, cone, esfera, mat, pedra, rng } from "./util";
import { Efeito } from "./Efeitos";

// Cidade: as personagens estão no passeio da frente (z ≈ 0); atrás delas a rua com carros a passar,
// o passeio do outro lado e uma fila de prédios com janelas (acesas ao acaso à noite) e, ao longe, o skyline.

const CORES_PREDIO = ["#d9cbb3", "#c7b49a", "#a9b7c6", "#e3d5c0", "#9fa8b5", "#cfa98b", "#b8c4b1", "#8d97a6"];
const CORES_CARRO = ["#d93a3a", "#2f6fd6", "#f2c12e", "#f4f4f4", "#2b2b2b", "#3aa66a", "#8a4fd1", "#e07a2e"];

const Carro: React.FC<{ cor: string; noite: boolean }> = ({ cor, noite }) => (
  <group>
    <mesh position-y={0.55} geometry={caixa(4.1, 0.65, 1.8)} material={mat(cor, { aspereza: 0.5, metal: 0.2 })} />
    <mesh position={[-0.2, 1.1, 0]} geometry={caixa(2.2, 0.55, 1.6)} material={mat(cor, { aspereza: 0.5, metal: 0.2 })} />
    <mesh position={[-0.2, 1.1, 0]} geometry={caixa(2.25, 0.42, 1.63)} material={mat("#1d2a38", { aspereza: 0.2, metal: 0.5 })} />
    {[[-1.3, 0.85], [1.3, 0.85], [-1.3, -0.85], [1.3, -0.85]].map(([x, z], i) => (
      <mesh key={i} position={[x, 0.35, z]} rotation-x={Math.PI / 2} geometry={cilindro(0.35, 0.35, 0.25, 8)} material={mat("#1a1a1a")} />
    ))}
    {[0.6, -0.6].map((z) => <mesh key={z} position={[2.06, 0.6, z]} geometry={caixa(0.05, 0.18, 0.35)} material={mat("#fffbe0", { emissivo: "#fff2b0", brilho: noite ? 2 : 0.3 })} />)}
    {[0.6, -0.6].map((z) => <mesh key={z} position={[-2.06, 0.6, z]} geometry={caixa(0.05, 0.16, 0.35)} material={mat("#ff3b30", { emissivo: "#ff2a1f", brilho: noite ? 1.6 : 0.3 })} />)}
  </group>
);

// ruinas: a cidade depois do desastre (prédios partidos e escurecidos, entulho, fogos, fumo, carros queimados)
// onda: onda de choque a passar (centro e raio atual): os prédios inclinam-se e afundam e os vidros desaparecem
export const Cidade: React.FC<{ hora: Hora; t: number; ruinas?: boolean; onda?: { x: number; z: number; raio: number } }> = ({ hora, t, ruinas, onda }) => {
  const noite = hora === "noite" && !ruinas;
  const { predios, janelas, acesas, longe, carros, arvores, ruina, entulho } = useMemo(() => {
    const r = rng(11);
    const pr: { x: number; l: number; a: number; p: number; cor: string; z: number }[] = [];
    const jan: Inst[] = [];
    // fila de prédios atrás da rua (z < -12) e uma segunda fila mais alta atrás
    for (const fila of [{ z: -17, min: 9, max: 30 }, { z: -30, min: 22, max: 55 }]) {
      for (let x = -70; x < 70;) {
        const l = 7 + r() * 7, a = fila.min + r() * (fila.max - fila.min), p = 8 + r() * 4;
        pr.push({ x: x + l / 2, l: l - 0.6, a, p, cor: CORES_PREDIO[Math.floor(r() * CORES_PREDIO.length)], z: fila.z - p / 2 });
        // janelas na fachada (só na primeira fila: a segunda fica no nevoeiro)
        if (fila.z === -17)
          for (let y = 2.2; y < a - 1; y += 2.6)
            for (let jx = x + 1.2; jx < x + l - 1.2; jx += 1.7)
              jan.push({ p: [jx, y, fila.z + 0.06], s: [1, 1, 1], cor: noite ? (r() < 0.45 ? "#ffd27a" : "#1b2235") : (r() < 0.15 ? "#e8f3ff" : "#7fa4c9") });
        x += l;
      }
    }
    const lg: Inst[] = [];
    for (let x = -160; x < 160; x += 6 + r() * 5) lg.push({ p: [x, 0, -70 - r() * 25], s: [5 + r() * 4, 20 + r() * 60, 6], cor: noite ? "#232a44" : "#9fb0c6" });
    const cs = Array.from({ length: 7 }, (_, i) => ({ faixa: i % 2, x0: r() * 140, v: 7 + r() * 6, cor: CORES_CARRO[i % CORES_CARRO.length] }));
    const arv: Inst[] = [];
    for (let x = -60; x <= 60; x += 9) if (Math.abs(x) > 5) arv.push({ p: [x + (r() - 0.5) * 2, 0, -12.3], s: 0.9 + r() * 0.4 });
    // ruínas: cada prédio fica com uma altura partida, uma inclinação e entulho à volta; alguns ardem
    const ru = pr.map((p) => ({ corte: 0.3 + r() * 0.5, inclina: (r() - 0.5) * 0.12, arde: r() < 0.22 }));
    const ent: Inst[] = [];
    for (let i = 0; i < 90; i++) ent.push({ p: [(r() - 0.5) * 120, 0, -10 - r() * 14], s: 0.4 + r() * 1.6, r: r() * 6, cor: ["#5a544e", "#6b645c", "#4a4540", "#7a6a5a"][i % 4] });
    for (let i = 0; i < 25; i++) ent.push({ p: [(r() - 0.5) * 60, 0, -1 - r() * 8], s: 0.2 + r() * 0.6, r: r() * 6, cor: "#5a544e" });
    return { predios: pr, janelas: jan, acesas: jan.filter((j) => j.cor === "#ffd27a"), longe: lg, carros: cs, arvores: arv, ruina: ru, entulho: ent };
  }, [noite]);

  const janelaGeo = useMemo(() => new THREE.BoxGeometry(1.1, 1.5, 0.08), []);
  const blocoGeo = useMemo(() => { const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0); return g; }, []);
  const verde = Math.floor(t / 5) % 2 === 0;

  return (
    <group>
      {/* passeio da frente, rua (duas faixas), passeio de trás */}
      <mesh position={[0, 0.07, 1]} geometry={caixa(200, 0.14, 6)} material={mat("#b9b4ab")} />
      <mesh position={[0, 0, -5]} geometry={caixa(200, 0.02, 9)} material={mat("#3b3d42")} />
      <mesh position={[0, 0.07, -11]} geometry={caixa(200, 0.14, 3)} material={mat("#b9b4ab")} />
      <mesh position={[0, -0.02, 30]} geometry={caixa(200, 0.02, 50)} material={mat("#8f8a80")} />
      {/* traços da estrada e passadeira */}
      {Array.from({ length: 20 }, (_, i) => <mesh key={i} position={[-95 + i * 10, 0.015, -5]} geometry={caixa(4, 0.01, 0.18)} material={mat("#f2f2f2")} />)}
      {Array.from({ length: 7 }, (_, i) => <mesh key={i} position={[6, 0.016, -8.6 + i * 1.2]} geometry={caixa(3.2, 0.01, 0.6)} material={mat("#f2f2f2")} />)}
      {/* prédios */}
      {predios.map((p, i) => {
        // a onda de choque inclina o prédio para longe do centro e afunda-o
        let rotX = 0, rotZ = 0, afunda = 0;
        if (onda) {
          const dx = p.x - onda.x, dz = p.z - onda.z, d = Math.hypot(dx, dz);
          const k = clamp01((onda.raio - d) / 30);
          rotZ = -(dx / (d || 1)) * 0.4 * k; rotX = (dz / (d || 1)) * 0.4 * k; afunda = p.a * 0.45 * k;
        }
        const ru = ruina[i], a = ruinas ? p.a * ru.corte : p.a;
        const cor = ruinas ? new THREE.Color(p.cor).lerp(new THREE.Color("#3a3430"), 0.55).getStyle() : p.cor;
        return (
          <group key={i} position={[p.x, -afunda, p.z]} rotation={[rotX + (ruinas ? ru.inclina * 0.5 : 0), 0, rotZ + (ruinas ? ru.inclina : 0)]}>
            <mesh position-y={a / 2} geometry={caixa(p.l, a, p.p)} material={mat(cor)} />
            {!ruinas && <mesh position-y={p.a + 0.25} geometry={caixa(p.l + 0.3, 0.5, p.p + 0.3)} material={mat("#6d6a66")} />}
            {!ruinas && i % 3 === 0 && <mesh position={[p.l * 0.2, p.a + 1.2, 0]} geometry={cilindro(0.8, 0.8, 1.4, 7)} material={mat("#7a6a5a")} />}
            {/* topo partido: blocos soltos e vigas à vista */}
            {ruinas && [0, 1, 2].map((k) => <mesh key={k} position={[(k - 1) * p.l * 0.3, a + 0.4 + k * 0.3, (k % 2 ? 1 : -1) * p.p * 0.2]} rotation={[k, k * 2, 0.4]} geometry={caixa(p.l * 0.25, 0.8 + k * 0.4, p.p * 0.3)} material={mat(cor)} />)}
            {ruinas && <mesh position={[p.l * 0.3, a + 1.2, 0]} rotation-z={0.5} geometry={caixa(0.2, 2.6, 0.2)} material={mat("#3a2f28")} />}
            {/* porta da loja no rés-do-chão */}
            {p.z > -25 && <mesh position={[0, 1.3, p.p / 2 + 0.03]} geometry={caixa(Math.min(4, p.l * 0.5), 2.6, 0.05)} material={mat(ruinas ? "#151515" : "#2b3240", { emissivo: noite ? "#ffcf80" : "#000000", brilho: noite ? 0.5 : 0 })} />}
            {ruinas && ru.arde && p.z > -25 && <Efeito tipo="fogo" t={t + i} quando={0} posicao={[0, a + 0.2, p.p / 2]} escala={1.6} semente={i} />}
          </group>
        );
      })}
      {/* vidros: rebentam quando a onda chega; nas ruínas já não existem */}
      {!ruinas && !(onda && onda.raio > Math.abs(onda.z + 17)) && <Instancias itens={janelas} geometria={janelaGeo} material={mat("#ffffff")} />}
      {/* à noite as janelas acesas brilham (uma camada por cima, ligeiramente à frente) */}
      {noite && !(onda && onda.raio > Math.abs(onda.z + 17)) && <group position-z={0.02}><Instancias itens={acesas} geometria={janelaGeo} material={mat("#ffd27a", { emissivo: "#ffc45a", brilho: 1.4 })} /></group>}
      {ruinas && <Instancias itens={entulho} geometria={pedra(1)} material={mat("#ffffff")} />}
      {ruinas && [[-20, -12], [6, -14], [28, -13], [-8, -22]].map(([x, z], i) => <Efeito key={i} tipo="fumo" t={t + 4} quando={0} posicao={[x, 4, z]} escala={3} semente={i + 20} />)}
      <Instancias itens={longe} geometria={blocoGeo} material={mat("#ffffff")} />
      {/* árvores no passeio de trás */}
      <Instancias itens={arvores} geometria={cilindro(0.15, 0.2, 2, 5)} material={mat("#6b4a2e")} t={0} mover={(_, __, ___, m) => { m.position.y += 1; }} />
      {!ruinas && <Instancias itens={arvores} geometria={esfera(1.4, 0)} material={mat("#4f8f3c")} t={0} mover={(_, __, ___, m) => { m.position.y += 3; }} />}
      {/* candeeiros */}
      {Array.from({ length: 9 }, (_, i) => -48 + i * 12).map((x) => (
        <group key={x} position={[x, 0.14, -1.6]}>
          <mesh position-y={2.6} geometry={cilindro(0.07, 0.09, 5.2, 6)} material={mat("#3a3f47")} />
          <mesh position={[0, 5.2, -0.7]} rotation-x={Math.PI / 2} geometry={cilindro(0.05, 0.05, 1.4, 5)} material={mat("#3a3f47")} />
          <mesh position={[0, 5.05, -1.35]} geometry={cone(0.35, 0.3, 6)} material={mat("#3a3f47")} />
          <mesh position={[0, 4.88, -1.35]} geometry={esfera(0.18, 0)} material={mat(ruinas ? "#3a3a3a" : "#fff2c4", { emissivo: "#ffe39a", brilho: noite ? 2.5 : ruinas ? 0 : 0.2 })} />
        </group>
      ))}
      {noite && <pointLight position={[0, 4.8, -2.9]} intensity={25} distance={14} color="#ffd890" />}
      {/* semáforo */}
      <group position={[8.2, 0.14, -1.4]}>
        <mesh position-y={1.8} geometry={cilindro(0.08, 0.08, 3.6, 6)} material={mat("#30343b")} />
        <mesh position-y={3.9} geometry={caixa(0.4, 1.1, 0.35)} material={mat("#22252b")} />
        <mesh position={[0, 4.2, 0.18]} geometry={esfera(0.12, 0)} material={mat("#ff3b30", { emissivo: "#ff2a1f", brilho: verde ? 0.05 : 2 })} />
        <mesh position={[0, 3.6, 0.18]} geometry={esfera(0.12, 0)} material={mat("#34c759", { emissivo: "#22c55e", brilho: verde ? 2 : 0.05 })} />
      </group>
      {/* carros: cada faixa num sentido, a dar a volta à rua */}
      {carros.map((c, i) => {
        // nas ruínas os carros ficaram parados e queimados; com a onda param onde estão
        const sentido = c.faixa ? -1 : 1;
        const tt = onda ? Math.min(t, 0.2) : t;
        const x = ruinas ? -40 + i * 13 : ((((c.x0 + c.v * tt * sentido) % 160) + 160) % 160) - 80;
        return <group key={i} position={[x, 0, c.faixa ? -7.2 : -2.9]} rotation-y={(c.faixa ? Math.PI : 0) + (ruinas ? (i % 3 - 1) * 0.5 : 0)}><Carro cor={ruinas ? "#2e2a28" : c.cor} noite={noite} /></group>;
      })}
    </group>
  );
};
