import { useMemo } from "react";
import * as THREE from "three";
import { caixa, cilindro, clamp01, cone, entre, esfera, geo, lerp, mat, rng } from "./util";

// Pacote relojoaria de luxo ("porque é que um relógio de luxo é tão caro"): relógio genérico (sem marcas nem logótipos),
// o movimento mecânico e as suas peças em grande plano, materiais e fabrico, a oficina e a boutique.
// As peças ficam de pé, viradas para a câmara (+z), à escala de exposição.

const ACO = "#d7dbe0", OURO = "#d4af37", LATAO = "#d9b45a", RODIO = "#c8ccd2", RUBI = "#d4142e", AZUL = "#3b6fd6";
const metal = (cor: string, aspereza = 0.25) => mat(cor, { metal: 0.85, aspereza });
const brilho = (cor: string, b: number) => mat(cor, { emissivo: cor, brilho: b });
const PI2 = Math.PI * 2;

// espiral (mola real, espiral do balanço) como tubo, em cache por forma
const espiral = (rIn: number, rOut: number, voltas: number, grossura: number) =>
  geo(`esp${rIn.toFixed(3)},${rOut.toFixed(3)},${voltas.toFixed(2)},${grossura}`, () => {
    const pts: THREE.Vector3[] = [];
    const n = Math.round(voltas * 40);
    for (let i = 0; i <= n; i++) { const k = i / n, a = k * voltas * PI2, r = lerp(rIn, rOut, k); pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0)); }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, grossura, 4, false);
  });
const toro = (r: number, tubo: number, seg = 32) => geo(`toro${r},${tubo},${seg}`, () => new THREE.TorusGeometry(r, tubo, 6, seg));

// ---------- roda dentada: aro, raios, cubo, dentes e o rubi no eixo ----------
export const Roda: React.FC<{ r: number; dentes: number; ang: number; cor?: string; esp?: number }> = ({ r, dentes, ang, cor = LATAO, esp = 0.04 }) => (
  <group rotation-z={ang}>
    <mesh geometry={toro(r * 0.86, r * 0.09)} material={metal(cor)} />
    {[0, 1, 2, 3].map((k) => <mesh key={k} rotation-z={(k * Math.PI) / 4 * 2} geometry={caixa(r * 0.12, r * 1.72, esp * 0.8)} material={metal(cor)} />)}
    {Array.from({ length: dentes }, (_, k) => (
      <group key={k} rotation-z={(k * PI2) / dentes}><mesh position-y={r * 0.98} geometry={caixa((PI2 * r) / dentes * 0.5, r * 0.16, esp)} material={metal(cor)} /></group>
    ))}
    <mesh rotation-x={Math.PI / 2} geometry={cilindro(r * 0.22, r * 0.22, esp * 1.6, 10)} material={metal(RODIO)} />
    <mesh position-z={esp} geometry={esfera(Math.max(0.025, r * 0.08), 1)} material={mat(RUBI, { emissivo: RUBI, brilho: 0.4, aspereza: 0.15 })} />
  </group>
);

// ---------- balanço com espiral azul, âncora e roda de escape: o "tic-tac" ----------
const FREQ = 1.2; // oscilações por segundo (mais lento que o real, para se ver)
export const Escape: React.FC<{ t: number; escala?: number }> = ({ t }) => {
  const s = Math.sin(t * PI2 * FREQ);
  const balanco = 2.2 * s;
  const ancora = 0.22 * Math.tanh(4 * s);
  const passo = Math.floor(t * 2 * FREQ) + entre((t * 2 * FREQ) % 1, 0, 0.15);
  return (
    <group>
      {/* balanço */}
      <group position-y={0.45}>
        <group rotation-z={balanco}>
          <mesh geometry={toro(0.48, 0.035, 40)} material={metal(LATAO)} />
          <mesh geometry={caixa(0.96, 0.05, 0.03)} material={metal(LATAO)} />
          {Array.from({ length: 8 }, (_, k) => <group key={k} rotation-z={(k * PI2) / 8}><mesh position-y={0.52} geometry={esfera(0.03, 0)} material={metal(OURO)} /></group>)}
        </group>
        <group scale={1 + 0.12 * s} rotation-z={balanco * 0.15}><mesh geometry={espiral(0.05, 0.3, 7, 0.006)} material={brilho(AZUL, 0.5)} /></group>
        <mesh position-z={0.03} geometry={esfera(0.04, 1)} material={mat(RUBI, { emissivo: RUBI, brilho: 0.5 })} />
      </group>
      {/* âncora: balança de um lado para o outro e solta um dente de cada vez */}
      <group position-y={-0.2} rotation-z={ancora}>
        <mesh position-y={0.25} geometry={caixa(0.05, 0.5, 0.03)} material={metal(RODIO)} />
        <mesh position-y={-0.05} geometry={caixa(0.55, 0.06, 0.03)} material={metal(RODIO)} />
        {[1, -1].map((l) => <mesh key={l} position={[0.26 * l, -0.12, 0.01]} rotation-z={0.3 * l} geometry={caixa(0.05, 0.12, 0.035)} material={mat(RUBI, { emissivo: RUBI, brilho: 0.5 })} />)}
      </group>
      {/* roda de escape: avança aos saltos */}
      <group position-y={-0.68}>
        <group rotation-z={-passo * (PI2 / 15)}>
          <mesh geometry={toro(0.27, 0.025)} material={metal(RODIO)} />
          {Array.from({ length: 15 }, (_, k) => <group key={k} rotation-z={(k * PI2) / 15}><mesh position={[0.03, 0.31, 0]} rotation-z={-0.5} geometry={caixa(0.035, 0.1, 0.03)} material={metal(RODIO)} /></group>)}
          {[0, 1, 2].map((k) => <mesh key={k} rotation-z={(k * PI2) / 3} position-y={0} geometry={caixa(0.03, 0.5, 0.02)} material={metal(RODIO)} />)}
        </group>
        <mesh position-z={0.03} geometry={esfera(0.035, 1)} material={mat(RUBI, { emissivo: RUBI, brilho: 0.5 })} />
      </group>
    </group>
  );
};

// ---------- mola real: o tambor com a mola em espiral; com "dar_corda" aperta e depois solta ----------
export const MolaReal: React.FC<{ t: number; quando: number; darCorda?: boolean }> = ({ t, quando, darCorda }) => {
  const aperto = darCorda ? entre(t, quando, quando + 1.6) * (1 - entre(t, quando + 2.6, quando + 6)) : 0.6 - 0.5 * entre(t, 0, 8);
  const q = Math.round(aperto * 12) / 12;
  const rOut = lerp(0.62, 0.3, q), voltas = lerp(5, 9, q);
  const giro = darCorda ? -entre(t, quando, quando + 1.6) * PI2 * 2 : -t * 0.4;
  return (
    <group>
      <mesh rotation-x={Math.PI / 2} position-z={-0.05} geometry={cilindro(0.72, 0.72, 0.04, 40)} material={mat("#3a3328", { metal: 0.4, aspereza: 0.5 })} />
      <Roda r={0.78} dentes={60} ang={giro * 0.2} esp={0.06} />
      <group rotation-z={giro}>
        <mesh position-z={0.04} geometry={espiral(0.1, rOut, voltas, 0.022)} material={mat("#e9eef4", { metal: 0.6, aspereza: 0.25, emissivo: "#8fa4bf", brilho: 0.35 })} />
        <mesh rotation-x={Math.PI / 2} geometry={cilindro(0.1, 0.1, 0.12, 12)} material={metal(RODIO)} />
      </group>
    </group>
  );
};

// ---------- trem de rodagem: rodas que engrenam umas nas outras (cada uma mais rápida) ----------
export const Engrenagens: React.FC<{ t: number }> = ({ t }) => {
  const rodas: [number, number, number][] = [[-0.8, 0.25, 0.55], [0.0, -0.25, 0.35], [0.6, 0.15, 0.28], [1.0, -0.3, 0.2]];
  let w = 0.25;
  const angs: number[] = [];
  rodas.forEach((r, i) => { if (i) w = (-w * rodas[i - 1][2]) / r[2]; angs.push(w * t + (i % 2 ? Math.PI / 20 : 0)); });
  return <group position-x={0.05}>{rodas.map(([x, y, r], i) => <group key={i} position={[x, y, 0]}><Roda r={r} dentes={Math.round(r * 50)} ang={angs[i]} /></group>)}</group>;
};

// ---------- movimento completo (a "maquinaria" dentro do relógio); "automatico" junta o rotor ----------
export const Mecanismo: React.FC<{ t: number; automatico?: boolean }> = ({ t, automatico }) => {
  const perolas = useMemo(() => { const r = rng(3); return Array.from({ length: 26 }, () => { const a = r() * PI2, d = 0.15 + r() * 0.6; return [Math.cos(a) * d, Math.sin(a) * d] as [number, number]; }); }, []);
  return (
    <group>
      <mesh rotation-x={Math.PI / 2} position-z={-0.04} geometry={cilindro(0.85, 0.85, 0.05, 48)} material={metal(RODIO, 0.35)} />
      {perolas.map(([x, y], i) => <mesh key={i} position={[x, y, -0.012]} geometry={geo("perola", () => new THREE.CircleGeometry(0.06, 12))} material={metal(i % 2 ? "#bfc4cb" : "#d3d7dd", 0.5)} />)}
      <group position={[-0.32, 0.3, 0]}><Roda r={0.3} dentes={30} ang={-t * 0.08} /></group>
      <group position={[0.08, 0.05, 0.02]}><Roda r={0.24} dentes={24} ang={t * 0.25} /></group>
      <group position={[0.42, 0.25, 0.04]}><Roda r={0.17} dentes={18} ang={-t * 0.6} /></group>
      <group position={[0.45, -0.18, 0.02]}><Roda r={0.15} dentes={16} ang={t * 1.4} /></group>
      <group position={[-0.12, -0.38, 0.05]} scale={0.42}><Escape t={t} /></group>
      {/* pontes que seguram as rodas, com parafusos azulados */}
      <mesh position={[0.25, 0.3, 0.07]} rotation-z={-0.4} geometry={caixa(0.75, 0.12, 0.03)} material={metal(RODIO, 0.3)} />
      {[[0.55, 0.42], [-0.05, 0.18], [-0.6, -0.3]].map(([x, y], i) => <mesh key={i} position={[x, y, 0.09]} rotation-x={Math.PI / 2} geometry={cilindro(0.035, 0.035, 0.02, 8)} material={metal(AZUL, 0.3)} />)}
      {automatico && (
        <group position-z={0.12} rotation-z={Math.sin(t * 0.9) * 1.6}>
          <mesh geometry={geo("rotor", () => new THREE.RingGeometry(0.3, 0.82, 32, 1, Math.PI, Math.PI))} material={mat(OURO, { metal: 0.9, aspereza: 0.2, ladoDuplo: true, opacidade: 0.92 })} />
          <mesh rotation-x={Math.PI / 2} geometry={cilindro(0.1, 0.1, 0.04, 12)} material={metal(RODIO)} />
        </group>
      )}
    </group>
  );
};

// ---------- relógio de luxo genérico ----------
// variante: pronto | explodir (as camadas separam-se em `quando`) | traseira (vira e mostra o movimento pelo fundo de safira)
// | quartzo (o ponteiro dos segundos salta de segundo a segundo; nos mecânicos desliza)
const R = 0.6;
export const Relogio: React.FC<{ t: number; quando: number; variante?: string; mostrador: string }> = ({ t, quando, variante, mostrador }) => {
  const explodir = variante === "explodir", traseira = variante === "traseira", quartzo = variante === "quartzo";
  const k = explodir ? entre(t, quando, quando + 1.2) : 0;
  const virar = traseira ? entre(t, quando, quando + 1) * Math.PI : 0;
  const seg = quartzo ? Math.floor(t) : Math.floor(t * 8) / 8;
  const aSeg = -(seg / 60) * PI2 * 4, aMin = -((10 + t / 60) / 60) * PI2, aHora = -((10.2 + t / 3600) / 12) * PI2;
  const aco = metal(ACO, 0.2), elo = metal(ACO, 0.3), eloMeio = metal("#e9ecef", 0.15);
  return (
    <group rotation-y={virar - k * 0.65}>
      {/* bracelete: elos de três peças a curvar para trás */}
      {[1, -1].map((l) => Array.from({ length: 6 }, (_, i) => {
        const y = l * (R + 0.2 + i * 0.19), z = -Math.pow(i / 5, 2) * 0.45;
        return (
          <group key={`${l}${i}`} position={[0, y, z - k * 0.4]} rotation-x={l * (i / 5) * 0.7}>
            {[-0.17, 0.17].map((x) => <mesh key={x} position-x={x} geometry={caixa(0.14, 0.17, 0.09)} material={elo} />)}
            <mesh geometry={caixa(0.2, 0.17, 0.1)} material={eloMeio} />
          </group>
        );
      }))}
      {/* fundo (de safira na variante traseira) e o movimento lá dentro */}
      <group position-z={-0.14 - k * 0.9}>
        <mesh rotation-x={Math.PI / 2} geometry={cilindro(R * 0.92, R * 0.92, 0.04, 40)} material={traseira ? mat("#bfe6ff", { opacidade: 0.18, aspereza: 0.05 }) : aco} />
      </group>
      <group position-z={-0.06 - k * 0.5} rotation-y={traseira ? Math.PI : 0} scale={0.6}><Mecanismo t={t} automatico={traseira} /></group>
      {/* caixa, asas e coroa de dar corda */}
      <mesh rotation-x={Math.PI / 2} geometry={cilindro(R, R * 0.97, 0.24, 40)} material={aco} />
      {[1, -1].map((l) => [1, -1].map((m) => <mesh key={`${l}${m}`} position={[0.28 * m, l * (R + 0.04), -0.02]} geometry={caixa(0.14, 0.2, 0.16)} material={aco} />))}
      <group position={[R + 0.06, 0, 0]} rotation-z={Math.PI / 2}>
        <mesh geometry={cilindro(0.08, 0.08, 0.1, 12)} material={aco} />
        {Array.from({ length: 6 }, (_, i) => <mesh key={i} rotation-y={(i * Math.PI) / 6} geometry={caixa(0.17, 0.1, 0.012)} material={metal("#b9bec6")} />)}
      </group>
      {/* mostrador, índices, janela da data e ponteiros */}
      <group position-z={0.125 + k * 0.35}>
        <mesh rotation-x={Math.PI / 2} geometry={cilindro(R * 0.86, R * 0.86, 0.01, 40)} material={mat(mostrador, { aspereza: 0.35, metal: 0.3 })} />
        {Array.from({ length: 12 }, (_, i) => (
          <group key={i} rotation-z={(-i * PI2) / 12}>
            {i === 0 ? [-0.025, 0.025].map((x) => <mesh key={x} position={[x, R * 0.68, 0.01]} geometry={caixa(0.03, 0.11, 0.015)} material={metal("#f2f2f2", 0.15)} />)
              : i === 3 ? null : <mesh position={[0, R * 0.7, 0.01]} geometry={i % 3 === 0 ? caixa(0.04, 0.1, 0.015) : esfera(0.03, 0)} material={metal("#f2f2f2", 0.15)} />}
          </group>
        ))}
        <mesh position={[R * 0.6, 0, 0.008]} geometry={caixa(0.1, 0.08, 0.01)} material={mat("#fafafa")} />
        <mesh position={[R * 0.6, 0, 0.014]} geometry={caixa(0.04, 0.03, 0.005)} material={mat("#111")} />
      </group>
      <group position-z={0.15 + k * 0.6}>
        <group rotation-z={aHora}><mesh position-y={0.13} geometry={caixa(0.05, 0.28, 0.012)} material={metal("#f4f4f4", 0.15)} /></group>
        <group rotation-z={aMin}><mesh position-y={0.2} geometry={caixa(0.035, 0.42, 0.012)} material={metal("#f4f4f4", 0.15)} /></group>
        <group rotation-z={aSeg} position-z={0.01}><mesh position-y={0.17} geometry={caixa(0.012, 0.5, 0.01)} material={mat(quartzo ? "#f4f4f4" : "#e5281f")} /></group>
        <mesh position-z={0.02} rotation-x={Math.PI / 2} geometry={cilindro(0.025, 0.025, 0.02, 10)} material={metal(ACO)} />
      </group>
      {/* luneta e vidro de safira */}
      <group position-z={0.13 + k * 0.85}>
        <mesh geometry={toro(R * 0.93, 0.055, 48)} material={metal(OURO, 0.2)} />
        {Array.from({ length: 12 }, (_, i) => <group key={i} rotation-z={(i * PI2) / 12}><mesh position={[0, R * 0.93, 0.05]} geometry={caixa(0.02, 0.05, 0.01)} material={mat("#2a2a2a")} /></group>)}
        <mesh position-z={0.04} rotation-x={Math.PI / 2} geometry={cilindro(R * 0.88, R * 0.88, 0.01, 40)} material={mat("#dff3ff", { opacidade: 0.14, aspereza: 0.02, metal: 0.2 })} />
      </group>
    </group>
  );
};

// ---------- rubi sintético (as "joias" dos eixos), a rodar e a cintilar ----------
export const Rubi: React.FC<{ t: number }> = ({ t }) => (
  <group rotation={[0.3, t * 0.8, 0]}>
    <mesh scale={[1, 0.75, 1]} geometry={geo("octa", () => new THREE.OctahedronGeometry(0.35, 0))} material={mat(RUBI, { emissivo: RUBI, brilho: 0.6, aspereza: 0.1, metal: 0.2, opacidade: 0.92 })} />
    {[0, 1, 2, 3].map((i) => { const b = Math.max(0, Math.sin(t * 5 + i * 1.7)); return <mesh key={i} position={[Math.cos(i * 1.6) * 0.32, Math.sin(i * 2.3) * 0.22, 0.25]} scale={b} geometry={caixa(0.06, 0.06, 0.01)} rotation-z={Math.PI / 4} material={brilho("#ffffff", 2)} />; })}
  </group>
);

// ---------- lingotes (ouro | aco | platina), três empilhados ----------
const CORES_LINGOTE: Record<string, string> = { ouro: "#e8b730", aco: "#c9ced6", platina: "#e4e6ea" };
export const Lingotes: React.FC<{ variante?: string }> = ({ variante }) => {
  const c = CORES_LINGOTE[variante ?? "ouro"] ?? CORES_LINGOTE.ouro;
  const barra = geo("lingote", () => { const g = new THREE.CylinderGeometry(0.17, 0.22, 0.16, 4, 1); g.rotateY(Math.PI / 4); g.scale(2.2, 1, 1); return g; });
  return (
    <group>
      {[[-0.36, 0.08], [0.36, 0.08], [0, 0.24]].map(([x, y], i) => (
        <group key={i} position={[x, y, 0]}>
          <mesh geometry={barra} material={mat(c, { metal: 0.9, aspereza: 0.22 })} />
          <mesh position-y={0.085} geometry={caixa(0.25, 0.005, 0.14)} material={mat(c, { metal: 0.9, aspereza: 0.4 })} />
        </group>
      ))}
    </group>
  );
};

// ---------- fundição: o cadinho inclina em `quando` e o metal derretido enche os moldes ----------
export const Fundicao: React.FC<{ t: number; quando: number }> = ({ t, quando }) => {
  const inc = entre(t, quando, quando + 1) * 1.15;
  const vaza = clamp01((inc - 0.8) / 0.3) * (1 - entre(t, quando + 4, quando + 4.5));
  const enche = entre(t, quando + 1, quando + 4);
  const quente = mat("#ff8a1f", { emissivo: "#ff7a10", brilho: 2.2 });
  return (
    <group>
      <pointLight position={[0, 1.2, 0.6]} intensity={6 * (0.4 + vaza)} distance={6} color="#ff8a3a" />
      {/* suporte e cadinho */}
      {[-1.25, -0.25].map((x) => <mesh key={x} position={[x, 0.7, -0.2]} geometry={caixa(0.1, 1.4, 0.1)} material={mat("#3a3d44")} />)}
      <group position={[-0.75, 1.35, -0.2]} rotation-z={-inc}>
        <mesh geometry={cilindro(0.34, 0.24, 0.55, 12)} material={mat("#4a4440", { aspereza: 0.9 })} />
        <mesh position-y={0.26} rotation-x={-Math.PI / 2} geometry={geo("disco.3", () => new THREE.CircleGeometry(0.3, 16))} material={quente} />
        <mesh rotation-z={Math.PI / 2} geometry={cilindro(0.04, 0.04, 1.0, 6)} material={mat("#3a3d44")} />
      </group>
      {/* jorro de metal derretido */}
      {vaza > 0.02 && <mesh position={[-0.28, 0.95, -0.2]} scale={[vaza, 1, vaza]} geometry={cilindro(0.06, 0.05, 0.9, 8)} material={quente} />}
      {/* moldes a encher */}
      <group position={[0.1, 0, -0.2]}>
        <mesh position-y={0.2} geometry={caixa(1.6, 0.4, 0.6)} material={mat("#2b2e35")} />
        {[-0.5, 0, 0.5].map((x, i) => {
          const h = clamp01(enche * 3 - i) * 0.25;
          return h > 0.005 ? <mesh key={x} position={[x - 0.38 + 0.38, 0.15 + h / 2 + 0.03, 0]} geometry={caixa(0.38, h, 0.3)} material={i === 0 && enche > 0.9 ? mat("#e8b730", { metal: 0.9, aspereza: 0.25, emissivo: "#ff7a10", brilho: 0.4 }) : quente} /> : null;
        })}
      </group>
      {vaza > 0.1 && Array.from({ length: 8 }, (_, i) => { const f = ((t * 2.5 + i / 8) % 1); return <mesh key={i} position={[-0.3 + Math.sin(i * 2.1) * f * 0.5, 0.5 + f * 0.6 - f * f * 0.9, -0.2 + Math.cos(i * 1.3) * f * 0.3]} geometry={esfera(0.03, 0)} material={brilho("#ffc04a", 3 * (1 - f))} />; })}
    </group>
  );
};

// ---------- máquina CNC: a fresa desenha a caixa do relógio num bloco de aço, com aparas e refrigerante ----------
export const MaquinaCnc: React.FC<{ t: number }> = ({ t }) => {
  const x = Math.sin(t * 1.5) * 0.3, z = Math.cos(t * 1.1) * 0.15;
  return (
    <group>
      <mesh position-y={0.45} geometry={caixa(2.2, 0.9, 1.2)} material={mat("#c4c9d0")} />
      <mesh position={[0, 1.55, -0.55]} geometry={caixa(2.2, 1.3, 0.1)} material={mat("#b5bac2")} />
      {[-1.05, 1.05].map((x0) => <mesh key={x0} position={[x0, 1.55, 0]} geometry={caixa(0.1, 1.3, 1.2)} material={mat("#b5bac2")} />)}
      <mesh position={[0, 2.25, 0]} geometry={caixa(2.2, 0.1, 1.2)} material={mat("#a9aeb6")} />
      <mesh position={[0, 1.55, 0.6]} geometry={caixa(2.0, 1.3, 0.02)} material={mat("#cfe6ff", { opacidade: 0.18, aspereza: 0.05 })} />
      <mesh position={[0.75, 1.0, 0.62]} geometry={caixa(0.35, 0.25, 0.04)} material={brilho("#3fa0ff", 0.6)} />
      {/* mesa, peça e fresa */}
      <mesh position={[0, 0.95, 0]} geometry={caixa(1.6, 0.1, 0.8)} material={mat("#5a5f68")} />
      <mesh position={[0, 1.08, 0]} geometry={cilindro(0.26, 0.26, 0.16, 24)} material={metal(ACO, 0.3)} />
      <group position={[x, 1.55, z]}>
        <mesh geometry={cilindro(0.12, 0.12, 0.5, 12)} material={mat("#3a3d44")} />
        <mesh position-y={-0.32} rotation-y={t * 40} geometry={cilindro(0.025, 0.025, 0.2, 6)} material={metal("#e9ecef")} />
        <mesh position-y={-0.2} rotation-x={Math.PI} geometry={cone(0.12, 0.25, 8)} material={mat("#7fc8ff", { opacidade: 0.25 })} />
      </group>
      <mesh position={[0, 2.0, 0]} geometry={caixa(1.9, 0.06, 0.06)} material={mat("#3a3d44")} />
      {Array.from({ length: 10 }, (_, i) => { const f = ((t * 3 + i / 10) % 1); return <mesh key={i} position={[x + Math.sin(i * 2.4) * f * 0.5, 1.15 + f * 0.25 - f * f * 0.35, z + Math.cos(i * 1.7) * f * 0.4]} rotation={[i, t * 9, i]} geometry={caixa(0.04, 0.012, 0.02)} material={metal("#e9ecef")} />; })}
      {/* coluna de luzes */}
      <group position={[1.0, 2.3, -0.5]}>
        {["#28c840", "#febc2e", "#ff3b30"].map((c, i) => <mesh key={c} position-y={i * 0.1} geometry={cilindro(0.05, 0.05, 0.09, 8)} material={brilho(c, i === 0 ? 2 : 0.1)} />)}
      </group>
    </group>
  );
};

// ---------- teste de estanqueidade: o relógio num tanque de água sob pressão (o ponteiro do manómetro sobe) ----------
export const TanqueAgua: React.FC<{ t: number; quando: number }> = ({ t, quando }) => {
  const p = entre(t, quando, quando + 3);
  return (
    <group>
      <mesh position-y={0.1} geometry={cilindro(0.75, 0.8, 0.2, 24)} material={mat("#3a3d44")} />
      <mesh position-y={0.95} geometry={cilindro(0.62, 0.62, 1.5, 24)} material={mat("#3f8fd6", { opacidade: 0.35, aspereza: 0.1 })} />
      <mesh position-y={0.95} geometry={cilindro(0.65, 0.65, 1.52, 24)} material={mat("#dff3ff", { opacidade: 0.12, aspereza: 0.05 })} />
      <mesh position-y={1.78} geometry={cilindro(0.72, 0.72, 0.16, 24)} material={metal("#7d838c")} />
      {Array.from({ length: 8 }, (_, i) => <mesh key={i} position={[Math.cos((i * PI2) / 8) * 0.65, 1.88, Math.sin((i * PI2) / 8) * 0.65]} geometry={cilindro(0.04, 0.04, 0.06, 6)} material={metal(ACO)} />)}
      <group position={[0, 0.95, 0]} scale={0.32}><Relogio t={t} quando={0} mostrador="#14233f" /></group>
      {Array.from({ length: 10 }, (_, i) => { const f = ((t * 0.5 + i / 10) % 1); return <mesh key={i} position={[Math.sin(i * 2.7) * 0.4, 0.3 + f * 1.3, Math.cos(i * 1.9) * 0.3]} geometry={esfera(0.025 + (i % 3) * 0.01, 0)} material={mat("#e6f6ff", { opacidade: 0.6 })} />; })}
      {/* manómetro */}
      <group position={[0.85, 1.4, 0.2]}>
        <mesh rotation-x={Math.PI / 2} geometry={cilindro(0.22, 0.22, 0.06, 20)} material={metal("#7d838c")} />
        <mesh position-z={0.035} rotation-x={Math.PI / 2} geometry={cilindro(0.19, 0.19, 0.01, 20)} material={mat("#fafafa")} />
        <mesh position-z={0.04} rotation-z={1.8 - p * 3.4}><boxGeometry args={[0.015, 0.16, 0.01]} /><meshStandardMaterial color="#e5281f" /></mesh>
        <mesh position={[-0.25, -0.25, -0.1]} rotation-z={0.8} geometry={cilindro(0.03, 0.03, 0.45, 6)} material={metal("#7d838c")} />
      </group>
    </group>
  );
};

// ---------- cenário: oficina de relojoaria (branca, janelas grandes, bancadas altas com candeeiros) ----------
const PAREDE = -2.6;
export const OficinaRelojoaria: React.FC<{ t: number; cor: string }> = ({ t, cor }) => (
  <group>
    <hemisphereLight args={["#ffffff", "#d8d8d0", 1.0]} />
    <ambientLight intensity={0.35} />
    <pointLight position={[0, 2.9, 0.8]} intensity={10} distance={14} color="#ffffff" />
    <directionalLight position={[2, 4, -1]} intensity={0.9} color="#eef6ff" />
    <mesh position={[0, 0, 0.6]} geometry={caixa(9, 0.04, 7.4)} material={mat("#d9dbd6")} />
    <mesh position={[0, 1.7, PAREDE]} geometry={caixa(9, 3.6, 0.12)} material={mat("#f3f3ef")} />
    {[-4.4, 4.4].map((x) => <mesh key={x} position={[x, 1.7, 0.6]} geometry={caixa(0.12, 3.6, 7.4)} material={mat("#efefea")} />)}
    {/* janelas de luz natural */}
    {[-1.6, 1.6].map((x) => <mesh key={x} position={[x, 1.9, PAREDE + 0.07]} geometry={caixa(1.6, 2.2, 0.02)} material={brilho("#e6f3ff", 0.9)} />)}
    {/* relógio de parede com o ponteiro a deslizar */}
    <group position={[0, 2.5, PAREDE + 0.09]}>
      <mesh rotation-x={Math.PI / 2} geometry={cilindro(0.45, 0.45, 0.06, 32)} material={mat("#ffffff")} />
      <mesh position-z={0.03} geometry={toro(0.45, 0.03)} material={metal(ACO)} />
      {Array.from({ length: 12 }, (_, i) => <group key={i} rotation-z={(i * PI2) / 12}><mesh position={[0, 0.36, 0.04]} geometry={caixa(0.025, 0.08, 0.01)} material={mat("#222")} /></group>)}
      <group rotation-z={-t * 0.1} position-z={0.05}><mesh position-y={0.17} geometry={caixa(0.01, 0.36, 0.005)} material={mat("#e5281f")} /></group>
      <group rotation-z={-1.2} position-z={0.045}><mesh position-y={0.13} geometry={caixa(0.03, 0.28, 0.005)} material={mat("#222")} /></group>
    </group>
    {/* bancadas de relojoeiro */}
    {[-2.9, 2.9].map((x, j) => (
      <group key={x} position={[x, 0, -1.2]} rotation-y={x > 0 ? -0.45 : 0.45}>
        <mesh position-y={0.97} geometry={caixa(1.6, 0.06, 0.8)} material={mat("#fafafa")} />
        <mesh position={[0, 1.005, 0.05]} geometry={caixa(1.3, 0.01, 0.5)} material={mat(j ? "#2f6b4f" : "#2a4a7a")} />
        <mesh position-y={0.48} geometry={caixa(1.5, 0.94, 0.7)} material={mat("#ececec")} />
        {[0.2, 0.45, 0.7].map((y) => <mesh key={y} position={[0, y, 0.36]} geometry={caixa(1.3, 0.2, 0.01)} material={mat("#e0e0e0")} />)}
        {/* candeeiro articulado */}
        <mesh position={[-0.6, 1.3, -0.25]} rotation-z={0.3} geometry={caixa(0.03, 0.65, 0.03)} material={mat("#3a3d44")} />
        <mesh position={[-0.4, 1.6, -0.15]} rotation-z={-1.0} geometry={caixa(0.03, 0.5, 0.03)} material={mat("#3a3d44")} />
        <mesh position={[-0.2, 1.48, -0.05]} rotation-x={Math.PI} geometry={cone(0.12, 0.15, 10)} material={mat("#3a3d44")} />
        <pointLight position={[-0.2, 1.35, 0]} intensity={1.5} distance={1.5} color="#fff4e2" />
        {/* porta-movimento com o movimento, bandejas de peças */}
        <group position={[0.05, 1.07, 0.05]} rotation-x={-Math.PI / 2 + 0.25} scale={0.12}><Mecanismo t={t} /></group>
        {[0.45, 0.62].map((dx, k) => (
          <group key={dx} position={[dx, 1.01, 0.1]}>
            <mesh geometry={caixa(0.14, 0.03, 0.24)} material={mat("#f4f4f4")} />
            {Array.from({ length: 6 }, (_, i) => <mesh key={i} position={[((i % 2) - 0.5) * 0.06, 0.02, -0.08 + Math.floor(i / 2) * 0.08]} geometry={esfera(0.012, 0)} material={mat(k ? RUBI : LATAO)} />)}
          </group>
        ))}
      </group>
    ))}
    {/* armário de gavetas */}
    <group position={[0, 0, PAREDE + 0.35]}>
      <mesh position-y={0.55} geometry={caixa(1.4, 1.1, 0.5)} material={mat("#e7e7e2")} />
      {Array.from({ length: 12 }, (_, i) => <mesh key={i} position={[-0.45 + (i % 4) * 0.3, 0.2 + Math.floor(i / 4) * 0.33, 0.26]} geometry={caixa(0.2, 0.05, 0.01)} material={metal(ACO)} />)}
      <mesh position={[0, 1.12, 0]} geometry={caixa(1.45, 0.04, 0.52)} material={mat(cor)} />
    </group>
  </group>
);

// ---------- cenário: boutique de luxo (paredes verde-escuras e madeira, vitrines iluminadas com relógios) ----------
export const BoutiqueLuxo: React.FC<{ t: number }> = ({ t }) => (
  <group>
    <hemisphereLight args={["#fff1d6", "#2a2018", 0.7]} />
    <ambientLight intensity={0.25} />
    <pointLight position={[0, 2.9, 0.6]} intensity={9} distance={12} color="#ffe6b8" />
    <mesh position={[0, 0, 0.6]} geometry={caixa(9, 0.04, 7.4)} material={mat("#e9e2d0", { aspereza: 0.3 })} />
    <mesh position={[0, 0.03, 0.3]} geometry={caixa(4, 0.01, 2.6)} material={mat("#3a2a20")} />
    <mesh position={[0, 1.7, PAREDE]} geometry={caixa(9, 3.6, 0.12)} material={mat("#123d2c")} />
    {[-4.4, 4.4].map((x) => <mesh key={x} position={[x, 1.7, 0.6]} geometry={caixa(0.12, 3.6, 7.4)} material={mat("#123d2c")} />)}
    {[-3, -1, 1, 3].map((x) => <mesh key={x} position={[x, 1.7, PAREDE + 0.08]} geometry={caixa(1.6, 2.8, 0.04)} material={mat("#5a3a22")} />)}
    <mesh position={[0, 3.25, PAREDE + 0.1]} geometry={caixa(8.8, 0.06, 0.05)} material={mat(OURO, { metal: 0.9, aspereza: 0.25, emissivo: "#a07a20", brilho: 0.3 })} />
    {/* nichos na parede com um relógio cada, iluminados */}
    {[-3, -1, 1, 3].map((x) => (
      <group key={x} position={[x, 1.7, PAREDE + 0.12]}>
        <mesh geometry={caixa(0.7, 0.7, 0.04)} material={mat("#e9e2d0")} />
        <pointLight position={[0, 0.3, 0.4]} intensity={0.8} distance={1.2} color="#fff1d6" />
        <group position-z={0.08} scale={0.16}><Relogio t={t} quando={0} mostrador={["#14233f", "#0f3b2a", "#111111", "#f2f0ea"][(x + 3) / 2]} /></group>
      </group>
    ))}
    {/* vitrines de vidro com relógios deitados */}
    {[-2.4, 2.4].map((x) => (
      <group key={x} position={[x, 0, -0.6]}>
        <mesh position-y={0.45} geometry={caixa(1.4, 0.9, 0.7)} material={mat("#5a3a22")} />
        <mesh position-y={0.93} geometry={caixa(1.3, 0.04, 0.6)} material={mat("#1b4d38")} />
        <mesh position-y={1.18} geometry={caixa(1.4, 0.5, 0.7)} material={mat("#e6f6ff", { opacidade: 0.15, aspereza: 0.05 })} />
        {[-0.4, 0, 0.4].map((dx, i) => <group key={dx} position={[dx, 1.0, 0]} rotation-x={-1.2} scale={0.11}><Relogio t={t + i} quando={0} mostrador={["#14233f", "#111111", "#0f3b2a"][i]} /></group>)}
        <pointLight position={[0, 1.6, 0.3]} intensity={1.2} distance={1.6} color="#fff1d6" />
      </group>
    ))}
    {/* poltronas */}
    {[-1.4, 1.4].map((x) => (
      <group key={x} position={[x, 0, 1.6]} rotation-y={x > 0 ? -2.6 : 2.6}>
        <mesh position-y={0.25} geometry={caixa(0.8, 0.4, 0.8)} material={mat("#6b3d22")} />
        <mesh position={[0, 0.65, -0.35]} geometry={caixa(0.8, 0.6, 0.15)} material={mat("#6b3d22")} />
      </group>
    ))}
  </group>
);
