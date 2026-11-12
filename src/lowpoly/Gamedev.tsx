import { useMemo } from "react";
import * as THREE from "three";
import { caixa, cilindro, clamp01, cone, entre, esfera, lerp, mat, rng, sai } from "./util";

// Pacote "como fazer um videogame": o hardware da consola (cada peça mostra o que faz) e as etapas do jogo
// (código, motor, arte 3D, som, nível, bugs) até ao jogo a correr na TV. As peças ficam de pé, viradas para a câmara.

const PRETO = "#16181d", CINZA = "#3a3f48", PRATA = "#c9ced6", OURO = "#d9a93a", PCB = "#1f6b3a";
const brilho = (cor: string, b: number) => mat(cor, { emissivo: cor, brilho: b });
const fase = (t: number, v: number, d = 0) => (((t * v + d) % 1) + 1) % 1;

// ---------- placa-mãe: liga tudo; sinais a correr pelas pistas ----------
const PISTAS: [number, number, number, number][] = [[0.15, 0.7, 0.5, 0.7], [-0.2, 0.35, -0.2, -0.45], [-0.9, 0.9, -0.55, 0.9], [0.5, -1.0, 0.5, -0.25], [-0.55, -0.2, 0.3, -0.2], [0.85, 0.2, 0.85, -0.9]];
export const PlacaMae: React.FC<{ t: number; cor: string }> = ({ t, cor }) => (
  <group>
    <mesh geometry={caixa(2.4, 3, 0.06)} material={mat(PCB)} />
    {PISTAS.map(([x0, y0, x1, y1], i) => (
      <group key={i}>
        <mesh position={[(x0 + x1) / 2, (y0 + y1) / 2, 0.035]} geometry={caixa(Math.abs(x1 - x0) + 0.03, Math.abs(y1 - y0) + 0.03, 0.01)} material={mat(OURO, { metal: 0.6 })} />
        {[0, 0.5].map((d) => { const f = fase(t, 0.8, i * 0.17 + d); return <mesh key={d} position={[lerp(x0, x1, f), lerp(y0, y1, f), 0.05]} geometry={caixa(0.08, 0.08, 0.03)} material={brilho(cor, 2)} />; })}
      </group>
    ))}
    <mesh position={[-0.2, 0.7, 0.06]} geometry={caixa(0.7, 0.7, 0.08)} material={mat(PRATA, { metal: 0.6 })} />
    {[0.55, 0.72].map((x) => <mesh key={x} position={[x, 0.7, 0.06]} geometry={caixa(0.07, 1.3, 0.08)} material={mat(PRETO)} />)}
    {[-0.5, -0.9].map((y) => <mesh key={y} position={[-0.2, y, 0.06]} geometry={caixa(1.6, 0.09, 0.08)} material={mat(PRETO)} />)}
    <mesh position={[0.1, -0.2, 0.05]} geometry={caixa(0.9, 0.12, 0.03)} material={mat(CINZA)} />
    <mesh position={[-1.05, 0.9, 0.15]} geometry={caixa(0.3, 1, 0.3)} material={mat(CINZA)} />
    <mesh position={[0.5, -1.2, 0.06]} geometry={caixa(0.4, 0.4, 0.06)} material={mat(PRETO)} />
    {Array.from({ length: 8 }, (_, i) => <mesh key={i} position={[-0.65 + (i % 4) * 0.3, i < 4 ? 1.2 : 0.2, 0.1]} rotation-x={Math.PI / 2} geometry={cilindro(0.05, 0.05, 0.14, 6)} material={mat("#2b3a6a")} />)}
  </group>
);

// ---------- processador: os núcleos acendem em ondas (está a calcular) ----------
export const Processador: React.FC<{ t: number; cor: string }> = ({ t, cor }) => {
  const r = fase(t, 0.7);
  return (
    <group>
      <mesh geometry={caixa(1.3, 1.3, 0.06)} material={mat(PCB)} />
      <mesh position-z={0.08} geometry={caixa(1.0, 1.0, 0.1)} material={mat(PRATA, { metal: 0.7, aspereza: 0.3 })} />
      {Array.from({ length: 16 }, (_, i) => {
        const b = 0.2 + 2 * Math.max(0, Math.sin(t * 6 - (i % 4) * 0.8 - Math.floor(i / 4) * 0.5));
        return <mesh key={i} position={[-0.33 + (i % 4) * 0.22, 0.33 - Math.floor(i / 4) * 0.22, 0.14]} geometry={caixa(0.17, 0.17, 0.02)} material={brilho(cor, b)} />;
      })}
      <mesh position-z={0.16} scale={0.3 + r * 1.3}>
        <torusGeometry args={[0.6, 0.02, 4, 32]} />
        <meshBasicMaterial color={cor} transparent opacity={0.8 * (1 - r)} />
      </mesh>
    </group>
  );
};

// ---------- placa gráfica: ventoinhas a rodar e os píxeis a formar a imagem por cima ----------
const PIXEIS = (r: number, c: number) => (r === 1 && c === 6 ? "#ffd84a" : r <= 2 ? "#5ab0ff" : r === 3 && c === 2 ? "#e5281f" : r === 3 ? (c > 4 ? "#3fae4a" : "#5ab0ff") : "#2f8a3a");
export const PlacaGrafica: React.FC<{ t: number; quando: number; cor: string }> = ({ t, quando, cor }) => (
  <group>
    <group position-y={-0.65}>
      <mesh geometry={caixa(2.6, 1.1, 0.25)} material={mat("#2a2d33")} />
      <mesh position={[0, 0.5, 0.13]} geometry={caixa(2.5, 0.06, 0.01)} material={brilho(cor, 1)} />
      <mesh position={[0, -0.6, -0.05]} geometry={caixa(2.4, 0.12, 0.08)} material={mat(PCB)} />
      <mesh position={[1.35, 0, 0]} geometry={caixa(0.08, 1.2, 0.3)} material={mat(PRATA, { metal: 0.6 })} />
      {[-0.6, 0.6].map((x) => (
        <group key={x} position={[x, 0, 0.13]}>
          <mesh rotation-x={Math.PI / 2} geometry={cilindro(0.44, 0.44, 0.02, 16)} material={mat(PRETO)} />
          <group rotation-z={-t * 18}>{Array.from({ length: 6 }, (_, k) => <mesh key={k} rotation-z={(k * Math.PI) / 3} position-z={0.02} geometry={caixa(0.1, 0.78, 0.02)} material={mat("#555b66")} />)}</group>
          <mesh position-z={0.04} rotation-x={Math.PI / 2} geometry={cilindro(0.1, 0.1, 0.03, 10)} material={mat(cor)} />
        </group>
      ))}
    </group>
    {/* a imagem que a placa desenha, pixel a pixel */}
    {Array.from({ length: 40 }, (_, i) => {
      const c = i % 8, r = Math.floor(i / 8), k = sai((t - quando - i * 0.04) / 0.2);
      if (k <= 0) return null;
      return <mesh key={i} position={[-0.84 + c * 0.24, 1.05 - r * 0.24, 0]} scale={k} geometry={caixa(0.22, 0.22, 0.04)} material={brilho(PIXEIS(r, c), 0.5)} />;
    })}
  </group>
);

// ---------- memória RAM: bits a entrar e a sair dos chips ----------
export const Memoria: React.FC<{ t: number; cor: string }> = ({ t, cor }) => (
  <group>
    <mesh geometry={caixa(2.6, 0.7, 0.05)} material={mat(PCB)} />
    {Array.from({ length: 8 }, (_, i) => <mesh key={i} position={[-1.05 + i * 0.3, 0.03, 0.045]} geometry={caixa(0.24, 0.4, 0.04)} material={mat(PRETO)} />)}
    <mesh position={[0, -0.32, 0.01]} geometry={caixa(2.5, 0.08, 0.055)} material={mat(OURO, { metal: 0.7 })} />
    {Array.from({ length: 14 }, (_, i) => {
      const f = fase(t, 0.9, i / 14), sobe = i % 2 === 0, y = 0.3 + (sobe ? f : 1 - f) * 1.0;
      return <mesh key={i} position={[-1.05 + (i % 8) * 0.3, y, 0.05]} geometry={caixa(0.09, 0.09, 0.09)} material={brilho(sobe ? cor : "#f4f4f4", 1.2 * (1 - Math.abs(f - 0.5)))} />;
    })}
  </group>
);

// ---------- SSD: os ficheiros voam para dentro e ficam guardados ----------
export const Ssd: React.FC<{ t: number; quando: number; cor: string }> = ({ t, quando, cor }) => {
  const aGravar = t > quando && t < quando + 3;
  return (
    <group position-x={0.6}>
      <mesh geometry={caixa(2.2, 0.55, 0.04)} material={mat("#1b2a24")} />
      {[-0.55, 0.15].map((x) => <mesh key={x} position={[x, 0, 0.04]} geometry={caixa(0.5, 0.4, 0.04)} material={mat(PRETO)} />)}
      <mesh position={[0.7, 0, 0.035]} geometry={caixa(0.5, 0.42, 0.01)} material={mat(cor)} />
      <mesh position={[-1.0, 0, 0.03]} geometry={caixa(0.08, 0.45, 0.04)} material={mat(OURO, { metal: 0.7 })} />
      <mesh position={[0.95, 0.2, 0.05]} geometry={esfera(0.04, 0)} material={brilho("#59e08a", aGravar && Math.sin(t * 30) > 0 ? 3 : 0.2)} />
      {Array.from({ length: 6 }, (_, i) => {
        const k = clamp01((t - quando - i * 0.45) / 0.7);
        if (k <= 0 || k >= 1) return null;
        return (
          <group key={i} position={[lerp(-2.5, 0, k), Math.sin(k * Math.PI) * 0.9 + (i % 2 ? 0.2 : -0.1), 0.1]} scale={1 - k * 0.8} rotation-z={(1 - k) * 0.4}>
            <mesh geometry={caixa(0.28, 0.36, 0.02)} material={mat("#f4f6f8")} />
            <mesh position={[0, 0.13, 0.012]} geometry={caixa(0.28, 0.08, 0.005)} material={mat(["#3fa0ff", "#e5281f", "#f2c12e"][i % 3])} />
          </group>
        );
      })}
    </group>
  );
};

// ---------- ventoinha: roda e empurra o ar quente para fora ----------
export const Ventoinha: React.FC<{ t: number; cor: string }> = ({ t, cor }) => (
  <group>
    {[[0, 0.7, 1.5, 0.1], [0, -0.7, 1.5, 0.1], [0.7, 0, 0.1, 1.5], [-0.7, 0, 0.1, 1.5]].map(([x, y, l, a], i) => <mesh key={i} position={[x, y, 0]} geometry={caixa(l, a, 0.25)} material={mat(PRETO)} />)}
    <group rotation-z={-t * 22}>
      {Array.from({ length: 7 }, (_, k) => <group key={k} rotation-z={(k * Math.PI * 2) / 7}><mesh position={[0, 0.38, 0.02]} rotation-y={0.5} geometry={caixa(0.26, 0.42, 0.02)} material={mat(cor)} /></group>)}
    </group>
    <mesh rotation-x={Math.PI / 2} geometry={cilindro(0.18, 0.18, 0.12, 12)} material={mat(CINZA)} />
    {Array.from({ length: 10 }, (_, i) => {
      const f = fase(t, 1.4, i / 10), a = (i / 10) * Math.PI * 2;
      return <mesh key={i} position={[Math.cos(a) * 0.45, Math.sin(a) * 0.45, 0.2 + f * 1.8]} geometry={caixa(0.02, 0.02, 0.4)} material={mat("#cfe8ff", { opacidade: 0.6 * (1 - f) })} />;
    })}
  </group>
);

// ---------- fonte de alimentação: o raio pulsa e a energia segue pelo cabo ----------
export const Fonte: React.FC<{ t: number }> = ({ t }) => {
  const pulso = 0.6 + 2 * Math.max(0, Math.sin(t * 5));
  return (
    <group>
      <mesh geometry={caixa(1.6, 0.9, 1.0)} material={mat("#2b2e35")} />
      <mesh position-z={0.51} rotation-x={Math.PI / 2} geometry={cilindro(0.34, 0.34, 0.01, 16)} material={mat(PRETO)} />
      {[-0.2, 0, 0.2].map((y) => <mesh key={y} position={[0, y, 0.52]} geometry={caixa(0.66, 0.025, 0.01)} material={mat("#6b7280")} />)}
      <group position={[0, 0.85, 0]}>
        {[[-0.08, 0.15, 0.4], [0.06, 0, -0.4], [-0.04, -0.15, 0.4]].map(([x, y, r], i) => <mesh key={i} position={[x, y, 0]} rotation-z={r} geometry={caixa(0.08, 0.22, 0.06)} material={brilho("#ffd23a", pulso)} />)}
      </group>
      <mesh position={[-1.3, -0.25, 0]} rotation-z={Math.PI / 2} geometry={cilindro(0.07, 0.07, 1.1, 6)} material={mat(PRETO)} />
      {Array.from({ length: 4 }, (_, i) => <mesh key={i} position={[-0.8 - fase(t, 1.2, i / 4) * 1.1, -0.25, 0]} geometry={esfera(0.07, 0)} material={brilho("#ffd23a", 2)} />)}
    </group>
  );
};

// ---------- consola: pronta | montar (as peças caem no sítio e a tampa fecha) | explodir (vista explodida) ----------
export const Consola: React.FC<{ t: number; quando: number; variante?: string; cor: string }> = ({ t, quando, variante, cor }) => {
  const montar = variante === "montar", explodir = variante === "explodir";
  const pecas: { p: [number, number, number]; g: THREE.BufferGeometry; c: string }[] = [
    { p: [0, 0.1, 0], g: caixa(2.2, 0.04, 1.5), c: PCB },
    { p: [-0.3, 0.15, 0.1], g: caixa(0.35, 0.06, 0.35), c: PRATA },
    { p: [0.15, 0.2, 0.15], g: caixa(0.08, 0.16, 0.6), c: PRETO },
    { p: [0.3, 0.2, 0.15], g: caixa(0.08, 0.16, 0.6), c: PRETO },
    { p: [-0.3, 0.14, -0.45], g: caixa(0.6, 0.03, 0.15), c: "#1b2a24" },
    { p: [0.6, 0.22, -0.35], g: caixa(0.7, 0.2, 0.45), c: "#2a2d33" },
    { p: [-0.75, 0.24, 0.3], g: cilindro(0.22, 0.22, 0.1, 12), c: cor },
    { p: [0.75, 0.2, 0.45], g: caixa(0.5, 0.18, 0.35), c: "#4a4f58" },
  ];
  const tampaY = montar ? lerp(2.6, 0, entre(t, quando + 3.6, quando + 4.2)) : explodir ? 1.9 + Math.sin(t * 2) * 0.05 : 0;
  const ligada = montar ? t > quando + 4.4 : !explodir;
  return (
    <group>
      {/* base */}
      <mesh position-y={0.05} geometry={caixa(2.6, 0.1, 1.9)} material={mat("#f2f3f5")} />
      {pecas.map((q, i) => {
        let y = q.p[1];
        if (montar) { const k = entre(t, quando + i * 0.42, quando + i * 0.42 + 0.35); if (k <= 0) return null; y = lerp(2.6, q.p[1], k); }
        if (explodir) y = q.p[1] + 0.5 + (i === 0 ? 0 : 0.5) + Math.sin(t * 2 + i) * 0.04;
        return <mesh key={i} position={[q.p[0], y, q.p[2]]} geometry={q.g} material={mat(q.c)} />;
      })}
      {/* tampa: branca com a faixa preta e as entradas de ar */}
      <group position-y={tampaY}>
        {[-0.75, 0.75].map((x) => <mesh key={x} position={[x, 0.33, 0]} geometry={caixa(1.1, 0.46, 1.9)} material={mat("#f2f3f5")} />)}
        <mesh position-y={0.31} geometry={caixa(0.4, 0.42, 1.88)} material={mat("#1b1d22")} />
        {Array.from({ length: 6 }, (_, i) => <mesh key={i} position={[-1.2 + i * 0.1, 0.57, 0]} geometry={caixa(0.04, 0.01, 1.6)} material={mat("#c9ced6")} />)}
      </group>
      <mesh position={[0, 0.33, 0.96]} geometry={caixa(0.36, 0.04, 0.02)} material={brilho(ligada ? cor : "#333", ligada ? 2 + Math.sin(t * 3) * 0.6 : 0)} />
    </group>
  );
};

// ---------- comando: botões e manípulos (com "jogar" mexem) ----------
export const Comando: React.FC<{ t: number; jogar?: boolean; cor: string }> = ({ t, jogar, cor }) => {
  const m = mat("#2a2d33");
  return (
    <group rotation-x={0.35}>
      <mesh geometry={caixa(1.1, 0.45, 0.3)} material={m} />
      {[1, -1].map((l) => <mesh key={l} position={[0.55 * l, -0.18, 0]} rotation-z={0.5 * l} scale={[0.8, 1.3, 0.75]} geometry={esfera(0.28, 1)} material={m} />)}
      {[[-0.28, -0.02], [0.24, -0.16]].map(([x, y], i) => (
        <group key={i} position={[x, y, 0.16]} rotation={jogar ? [Math.sin(t * 5 + i) * 0.4, Math.cos(t * 4 + i) * 0.4, 0] : [0, 0, 0]}>
          <mesh rotation-x={Math.PI / 2} position-z={0.03} geometry={cilindro(0.04, 0.04, 0.08, 6)} material={mat(PRETO)} />
          <mesh rotation-x={Math.PI / 2} position-z={0.08} geometry={cilindro(0.1, 0.1, 0.04, 10)} material={mat("#3a3d44")} />
        </group>
      ))}
      <group position={[-0.5, 0.1, 0.16]}>{[0, Math.PI / 2].map((r) => <mesh key={r} rotation-z={r} geometry={caixa(0.2, 0.06, 0.04)} material={mat(PRETO)} />)}</group>
      {[[0, 0.09, "#1fae5a"], [0.09, 0, "#e5281f"], [-0.09, 0, "#1f6fe5"], [0, -0.09, "#f2c12e"]].map(([x, y, c], i) => (
        <mesh key={i} position={[0.48 + (x as number), 0.1 + (y as number), 0.17]} geometry={esfera(0.045, 0)} material={brilho(c as string, jogar && Math.floor(t * 4) % 4 === i ? 2.5 : 0.3)} />
      ))}
      <mesh position={[0, 0.2, 0.16]} geometry={caixa(0.3, 0.03, 0.01)} material={brilho(cor, 1.5)} />
    </group>
  );
};

// ---------- o jogo a correr num ecrã (plataformas, herói a saltar, moedas, nuvens) ----------
export const JogoNoEcra: React.FC<{ t: number; l: number; a: number }> = ({ t, l, a }) => {
  const meio = l / 2;
  const dentro = (x: number) => Math.abs(x) < meio - 0.08;
  const rola = (x0: number, v: number, vao: number) => ((((x0 - t * v) % vao) + vao) % vao) - vao / 2;
  return (
    <group>
      <mesh geometry={caixa(l, a, 0.005)} material={brilho("#6ec6ff", 0.6)} />
      {Array.from({ length: 4 }, (_, i) => { const x = rola(i * 1.1, 0.3, 4.4) * (l / 4.4) * 1.2; return dentro(x) ? <mesh key={`n${i}`} position={[x, a * 0.32 - (i % 2) * 0.08, 0.01]} geometry={caixa(0.3 * l / 3, 0.08 * a, 0.01)} material={brilho("#ffffff", 0.7)} /> : null; })}
      {Array.from({ length: 12 }, (_, i) => { const x = rola(i * 0.4, 1.2, 4.8) * (l / 4.8); return dentro(x) ? <mesh key={`c${i}`} position={[x, -a * 0.4, 0.01]} geometry={caixa(l / 12.5, a * 0.14, 0.01)} material={brilho(i % 2 ? "#3fae4a" : "#2f8a3a", 0.6)} /> : null; })}
      {Array.from({ length: 5 }, (_, i) => { const x = rola(i * 0.9 + 0.4, 1.2, 4.5) * (l / 4.5); return dentro(x) ? <mesh key={`m${i}`} position={[x, -a * 0.05, 0.015]} geometry={caixa(l * 0.025, l * 0.025, 0.01)} material={brilho("#ffd84a", 1)} /> : null; })}
      <mesh position={[-l * 0.2, -a * 0.25 + Math.abs(Math.sin(t * 3)) * a * 0.25, 0.02]} geometry={caixa(l * 0.05, a * 0.12, 0.01)} material={brilho("#e5281f", 0.9)} />
      <mesh position={[-meio + l * 0.12, a / 2 - a * 0.08, 0.015]} geometry={caixa(l * 0.18, a * 0.05, 0.01)} material={brilho("#ffffff", 1)} />
    </group>
  );
};

// ---------- TV com o jogo final; com "ligar" o ecrã acende em `quando` ----------
export const Tv: React.FC<{ t: number; quando: number; ligar?: boolean }> = ({ t, quando, ligar }) => {
  const acesa = !ligar || t >= quando;
  return (
    <group>
      <mesh position-y={0.04} geometry={caixa(1.2, 0.08, 0.5)} material={mat(CINZA)} />
      <mesh position-y={0.25} geometry={caixa(0.12, 0.4, 0.08)} material={mat(CINZA)} />
      <group position-y={1.35}>
        <mesh geometry={caixa(3.2, 1.9, 0.12)} material={mat(PRETO)} />
        <group position-z={0.065}>{acesa ? <JogoNoEcra t={t - quando} l={3} a={1.7} /> : <mesh geometry={caixa(3, 1.7, 0.005)} material={mat("#0b0c10")} />}</group>
      </group>
    </group>
  );
};

// ---------- janela de editor (base do código e do motor de jogo) ----------
const Janela: React.FC<{ l: number; a: number; children?: React.ReactNode }> = ({ l, a, children }) => (
  <group>
    <mesh geometry={caixa(l, a, 0.05)} material={brilho("#1e1e2e", 0.25)} />
    <mesh position={[0, a / 2 - 0.08, 0.03]} geometry={caixa(l, 0.16, 0.01)} material={mat("#2b2b3d")} />
    {["#ff5f57", "#febc2e", "#28c840"].map((c, i) => <mesh key={c} position={[-l / 2 + 0.12 + i * 0.12, a / 2 - 0.08, 0.04]} geometry={esfera(0.035, 0)} material={brilho(c, 0.8)} />)}
    <group position-z={0.035}>{children}</group>
  </group>
);

// código: linhas a serem escritas a partir de `quando`, com o cursor a piscar
export const Codigo: React.FC<{ t: number; quando: number }> = ({ t, quando }) => {
  const linhas = useMemo(() => { const r = rng(21); return Array.from({ length: 11 }, () => ({ recuo: Math.floor(r() * 3), partes: Array.from({ length: 1 + Math.floor(r() * 3) }, () => 0.2 + r() * 0.5) })); }, []);
  const CORES = ["#c792ea", "#82aaff", "#c3e88d", "#f78c6c", "#89ddff"];
  const escritas = (t - quando) / 0.28;
  let ultima = 0;
  return (
    <Janela l={2.8} a={1.9}>
      {linhas.map((ln, i) => {
        const k = clamp01(escritas - i);
        if (k <= 0) return null;
        ultima = i;
        let x = -1.15 + ln.recuo * 0.16;
        return (
          <group key={i} position-y={0.62 - i * 0.12}>
            <mesh position-x={-1.3} geometry={caixa(0.08, 0.05, 0.005)} material={mat("#4b5063")} />
            {ln.partes.map((w, j) => { const ww = w * k; const m = <mesh key={j} position-x={x + ww / 2} geometry={caixa(Math.max(0.01, ww), 0.06, 0.005)} material={brilho(CORES[(i + j) % 5], 0.8)} />; x += w + 0.06; return m; })}
          </group>
        );
      })}
      {Math.floor(t * 2) % 2 === 0 && <mesh position={[-0.9 + linhas[ultima].partes.reduce((s, w) => s + w + 0.06, 0), 0.62 - ultima * 0.12, 0]} geometry={caixa(0.02, 0.09, 0.005)} material={brilho("#ffffff", 1.5)} />}
    </Janela>
  );
};

// motor de jogo: hierarquia, inspetor e a vista 3D com um cubo e as setas do gizmo; o botão "play" pulsa
export const MotorJogo: React.FC<{ t: number; cor: string }> = ({ t, cor }) => (
  <Janela l={3} a={2}>
    {Array.from({ length: 6 }, (_, i) => <mesh key={`h${i}`} position={[-1.2 + (i % 3 ? 0.08 : 0), 0.6 - i * 0.16, 0]} geometry={caixa(0.42, 0.07, 0.005)} material={mat(i === 2 ? cor : "#4b5063")} />)}
    {Array.from({ length: 5 }, (_, i) => <mesh key={`i${i}`} position={[1.2, 0.6 - i * 0.18, 0]} geometry={caixa(0.42, 0.06, 0.005)} material={mat("#4b5063")} />)}
    <mesh position={[0, -0.08, 0]} geometry={caixa(1.8, 1.55, 0.005)} material={mat("#11131b")} />
    {Array.from({ length: 7 }, (_, i) => <mesh key={`g${i}`} position={[-0.75 + i * 0.25, -0.08, 0.005]} geometry={caixa(0.008, 1.5, 0.003)} material={mat("#262a38")} />)}
    {Array.from({ length: 6 }, (_, i) => <mesh key={`v${i}`} position={[0, -0.7 + i * 0.25, 0.005]} geometry={caixa(1.75, 0.008, 0.003)} material={mat("#262a38")} />)}
    <group position={[0, -0.1, 0.25]} rotation={[0.5, t * 0.8, 0]}>
      <mesh geometry={caixa(0.4, 0.4, 0.4)} material={mat(cor)} />
      {([[0.4, 0, 0, "#ff4d4d", [0, 0, -Math.PI / 2]], [0, 0.4, 0, "#59e08a", [0, 0, 0]], [0, 0, 0.4, "#4d8bff", [Math.PI / 2, 0, 0]]] as const).map(([x, y, z, c, r], i) => (
        <group key={i} position={[x, y, z]} rotation={r as unknown as [number, number, number]}>
          <mesh position-y={-0.1} geometry={cilindro(0.015, 0.015, 0.2, 5)} material={brilho(c, 1)} />
          <mesh position-y={0.03} geometry={cone(0.045, 0.1, 6)} material={brilho(c, 1)} />
        </group>
      ))}
    </group>
    <mesh position={[0, 0.82, 0.01]} rotation-z={-Math.PI / 2} geometry={cone(0.07, 0.12, 3)} material={brilho("#59e08a", 1 + Math.max(0, Math.sin(t * 4)) * 1.5)} />
  </Janela>
);

// ---------- arte 3D: o modelo passa de malha de arame a pintado (uma linha sobe e pinta) ----------
const HEROI: { p: [number, number, number]; g: THREE.BufferGeometry; c: string }[] = [
  { p: [0, 0.35, 0], g: caixa(0.5, 0.7, 0.3), c: "#3a5ba0" },
  { p: [0, 1.0, 0], g: caixa(0.7, 0.65, 0.4), c: "#e5281f" },
  { p: [0, 1.6, 0], g: esfera(0.3, 1), c: "#f0c39b" },
  { p: [0, 1.82, -0.02], g: esfera(0.3, 1), c: "#4a2c1a" },
  { p: [0.48, 1.0, 0], g: caixa(0.2, 0.62, 0.22), c: "#f0c39b" },
  { p: [-0.48, 1.0, 0], g: caixa(0.2, 0.62, 0.22), c: "#f0c39b" },
];
export const Arte3D: React.FC<{ t: number; quando: number; cor: string }> = ({ t, quando, cor }) => {
  const linha = lerp(-0.1, 2.2, entre(t, quando, quando + 1.8));
  return (
    <group>
      <mesh position-y={0.05} geometry={cilindro(1, 1.05, 0.1, 16)} material={mat("#2a2d33")} />
      <mesh position-y={0.11} geometry={cilindro(0.9, 0.9, 0.01, 16)} material={brilho(cor, 0.4)} />
      <group position-y={0.12} rotation-y={t * 0.6}>
        {HEROI.map((h, i) => (
          <mesh key={i} position={h.p} geometry={h.g} scale={h.c === "#4a2c1a" ? [1.02, 0.55, 1.02] : 1}>
            {h.p[1] < linha ? <meshStandardMaterial color={h.c} flatShading roughness={0.9} /> : <meshBasicMaterial color="#5ad1ff" wireframe />}
          </mesh>
        ))}
      </group>
      {linha > 0 && linha < 2.1 && <mesh position-y={linha + 0.12} rotation-x={-Math.PI / 2}><ringGeometry args={[0.6, 0.66, 24]} /><meshBasicMaterial color="#5ad1ff" side={THREE.DoubleSide} /></mesh>}
    </group>
  );
};

// ---------- som: coluna, onda de som a dançar e notas a subir ----------
export const Som: React.FC<{ t: number; cor: string }> = ({ t, cor }) => (
  <group>
    <group position-x={-1.1}>
      <mesh geometry={caixa(0.7, 1.1, 0.5)} material={mat("#2a2d33")} />
      <mesh position={[0, -0.15, 0.26]} rotation-x={Math.PI / 2} scale={[1, 1 + Math.max(0, Math.sin(t * 12)) * 0.4, 1]} geometry={cilindro(0.25, 0.25, 0.04, 14)} material={mat(PRETO)} />
      <mesh position={[0, 0.3, 0.26]} rotation-x={Math.PI / 2} geometry={cilindro(0.1, 0.1, 0.04, 10)} material={mat(PRETO)} />
    </group>
    {Array.from({ length: 20 }, (_, i) => {
      const h = 0.08 + Math.abs(Math.sin(t * 6 + i * 0.6) * Math.sin(t * 2.3 + i * 0.25)) * 0.9;
      return <mesh key={i} position={[-0.55 + i * 0.09, 0, 0]} geometry={caixa(0.06, h, 0.06)} material={brilho(cor, 1)} />;
    })}
    {[0, 1, 2].map((i) => {
      const f = fase(t, 0.35, i / 3);
      return (
        <group key={i} position={[-0.3 + i * 0.5, 0.4 + f * 1.2, 0.1]} rotation-z={Math.sin(t * 2 + i) * 0.2}>
          <mesh scale={[1.2, 0.85, 0.6]} geometry={esfera(0.08, 0)} material={mat("#f4f4f4", { opacidade: 1 - f })} />
          <mesh position={[0.08, 0.17, 0]} geometry={caixa(0.025, 0.34, 0.025)} material={mat("#f4f4f4", { opacidade: 1 - f })} />
        </group>
      );
    })}
  </group>
);

// ---------- nível: as plataformas aparecem uma a uma, depois o herói atravessa a saltar ----------
const BLOCOS: [number, number][] = [[-3, 0.4], [-2.2, 0.4], [-1.4, 0.8], [-0.6, 0.8], [0.2, 1.3], [1.0, 0.8], [1.8, 0.5], [2.6, 0.5]];
export const Nivel: React.FC<{ t: number; quando: number }> = ({ t, quando }) => {
  const pronto = quando + BLOCOS.length * 0.25 + 0.6;
  const k = fase(Math.max(0, t - pronto), 0.25);
  const xh = lerp(-3, 2.6, k), i0 = Math.min(BLOCOS.length - 2, Math.floor((xh + 3) / 0.8));
  const topo = lerp(BLOCOS[i0][1], BLOCOS[i0 + 1][1], clamp01((xh - BLOCOS[i0][0]) / 0.8));
  return (
    <group>
      {BLOCOS.map(([x, h], i) => {
        const s = sai((t - quando - i * 0.25) / 0.3);
        if (s <= 0) return null;
        return (
          <group key={i} position-x={x} scale={[1, s, 1]}>
            <mesh position-y={h / 2} geometry={caixa(0.78, h, 0.78)} material={mat("#8a5a3a")} />
            <mesh position-y={h + 0.05} geometry={caixa(0.8, 0.1, 0.8)} material={mat("#4fbf4a")} />
            {i % 2 === 1 && <mesh position-y={h + 0.45} rotation={[Math.PI / 2, 0, t * 3]} geometry={cilindro(0.15, 0.15, 0.04, 10)} material={brilho("#ffd84a", 0.6)} />}
          </group>
        );
      })}
      {t > quando + BLOCOS.length * 0.25 && (
        <group position={[3.2, 0, 0]}>
          <mesh position-y={0.8} geometry={cilindro(0.03, 0.03, 1.6, 5)} material={mat(PRATA)} />
          <mesh position={[0.22, 1.42, 0]} geometry={caixa(0.42, 0.28, 0.02)} material={mat("#e5281f", { ladoDuplo: true })} />
        </group>
      )}
      {t > pronto && <mesh position={[xh, topo + 0.3 + Math.abs(Math.sin(k * Math.PI * 7)) * 0.5, 0]} geometry={caixa(0.3, 0.4, 0.3)} material={mat("#e5281f")} />}
    </group>
  );
};

// ---------- bug: o inseto anda; com "corrigido" encolhe em `quando` e aparece um visto verde ----------
export const Bug: React.FC<{ t: number; quando: number; corrigido?: boolean }> = ({ t, quando, corrigido }) => {
  const some = corrigido ? entre(t, quando, quando + 0.5) : 0;
  const pata = Math.sin(t * 14) * 0.35;
  return (
    <group>
      <group scale={Math.max(0.001, 1 - some)} position-x={Math.sin(t * 0.8) * 0.4} rotation-y={Math.cos(t * 0.8) * 0.4}>
        <mesh position={[-0.25, 0.3, 0]} scale={[1.3, 0.8, 1]} geometry={esfera(0.3, 1)} material={mat("#c0392b")} />
        <mesh position={[0.15, 0.3, 0]} geometry={esfera(0.17, 1)} material={mat("#7a1f17")} />
        <mesh position={[0.36, 0.32, 0]} geometry={esfera(0.12, 0)} material={mat(PRETO)} />
        {[1, -1].map((l) => <mesh key={l} position={[0.5, 0.48, 0.07 * l]} rotation={[0.4 * l, 0, -0.6]} geometry={caixa(0.015, 0.3, 0.015)} material={mat(PRETO)} />)}
        {[-0.35, -0.1, 0.12].map((x, i) => [1, -1].map((l) => (
          <mesh key={`${i}${l}`} position={[x, 0.15, 0.25 * l]} rotation={[0.9 * l, 0, (i % 2 ? pata : -pata)]} geometry={caixa(0.03, 0.32, 0.03)} material={mat(PRETO)} />
        )))}
      </group>
      {!corrigido && <mesh position={[0, 1.1, 0]} geometry={caixa(0.1, 0.32, 0.05)} material={brilho("#ff3b30", 1 + Math.max(0, Math.sin(t * 6)) * 2)} />}
      {!corrigido && <mesh position={[0, 0.85, 0]} geometry={caixa(0.1, 0.1, 0.05)} material={brilho("#ff3b30", 1 + Math.max(0, Math.sin(t * 6)) * 2)} />}
      {some > 0 && (
        <group position-y={0.8} scale={sai(some)}>
          <mesh position={[-0.12, -0.06, 0]} rotation-z={0.8} geometry={caixa(0.1, 0.32, 0.06)} material={brilho("#28c840", 1.5)} />
          <mesh position={[0.12, 0.08, 0]} rotation-z={-0.6} geometry={caixa(0.1, 0.62, 0.06)} material={brilho("#28c840", 1.5)} />
        </group>
      )}
    </group>
  );
};

// ---------- cenário: estúdio de desenvolvimento de jogos ----------
const PAREDE = -2.6;
export const EstudioJogos: React.FC<{ t: number; cor: string; cor2: string }> = ({ t, cor, cor2 }) => (
  <group>
    <hemisphereLight args={["#e6ecff", "#2a2420", 0.75]} />
    <ambientLight intensity={0.3} />
    <pointLight position={[0, 2.9, 0.8]} intensity={12} distance={14} color="#fff1e0" />
    <pointLight position={[0, 1.6, PAREDE + 0.8]} intensity={4} distance={5} color={cor} />
    <directionalLight position={[4, 5, 4]} intensity={0.8} />
    {Array.from({ length: 12 }, (_, i) => <mesh key={i} position={[-4.4 + i * 0.8, 0, 0.6]} geometry={caixa(0.78, 0.04, 7.4)} material={mat(i % 2 ? "#5a4636" : "#634d3b")} />)}
    <mesh position={[0, 1.7, PAREDE]} geometry={caixa(9, 3.6, 0.12)} material={mat("#262a36")} />
    {[-4.4, 4.4].map((x) => <mesh key={x} position={[x, 1.7, 0.6]} geometry={caixa(0.12, 3.6, 7.4)} material={mat("#232733")} />)}
    <mesh position={[0, 3.3, PAREDE + 0.08]} geometry={caixa(8.6, 0.05, 0.04)} material={brilho(cor, 2)} />
    {/* TV grande na parede com o jogo a correr */}
    <group position={[0, 1.85, PAREDE + 0.1]}>
      <mesh geometry={caixa(2.4, 1.4, 0.08)} material={mat(PRETO)} />
      <group position-z={0.045}><JogoNoEcra t={t} l={2.24} a={1.26} /></group>
    </group>
    {/* quadro com o esboço do nível e posters */}
    <group position={[-2.75, 1.8, PAREDE + 0.08]}>
      <mesh geometry={caixa(1.5, 1.0, 0.04)} material={mat("#f4f4f0")} />
      {[[-0.5, -0.25, 0.3], [-0.15, -0.1, 0.3], [0.2, 0.05, 0.3], [0.5, -0.2, 0.25]].map(([x, y, l], i) => <mesh key={i} position={[x, y, 0.025]} geometry={caixa(l, 0.03, 0.005)} material={mat("#2b5bd6")} />)}
      <mesh position={[0.45, 0.3, 0.025]} geometry={caixa(0.03, 0.25, 0.005)} material={mat("#e5281f")} />
    </group>
    {[[2.4, 2.1, cor2], [3.2, 1.7, "#f2c12e"], [2.5, 1.3, cor]].map(([x, y, c], i) => <mesh key={i} position={[x as number, y as number, PAREDE + 0.07]} geometry={caixa(0.6, 0.8, 0.02)} material={mat(c as string)} />)}
    {/* secretárias com dois monitores (código e arte) */}
    {[-3.0, 3.0].map((x, j) => (
      <group key={x} position={[x, 0, -1.2]} rotation-y={x > 0 ? -0.5 : 0.5}>
        <mesh position-y={0.74} geometry={caixa(1.5, 0.06, 0.75)} material={mat("#e9e6df")} />
        {[-0.6, 0.6].map((dx) => <mesh key={dx} position={[dx, 0.37, 0]} geometry={caixa(0.06, 0.74, 0.65)} material={mat(CINZA)} />)}
        {[-0.33, 0.33].map((dx, k) => (
          <group key={dx} position={[dx, 1.08, -0.2]}>
            <mesh geometry={caixa(0.6, 0.38, 0.03)} material={mat(PRETO)} />
            <mesh position-z={0.017} geometry={caixa(0.56, 0.34, 0.005)} material={brilho(j === 0 ? (k ? "#1e1e2e" : "#22283a") : k ? "#3a2a4a" : "#2a3a2a", 0.6)} />
            {Array.from({ length: 5 }, (_, l) => <mesh key={l} position={[-0.18 + (l % 2) * 0.05, 0.12 - l * 0.06, 0.022]} geometry={caixa(0.12 + ((l * 7) % 5) * 0.04, 0.025, 0.003)} material={brilho(["#c792ea", "#82aaff", "#c3e88d", "#f78c6c", cor][l], 1)} />)}
          </group>
        ))}
        <mesh position={[0, 0.78, 0.15]} geometry={caixa(0.5, 0.02, 0.16)} material={mat("#1b1f2a")} />
      </group>
    ))}
    {/* pufe, estante com figuras e planta */}
    <mesh position={[2.2, 0.32, 1.2]} scale={[1, 0.6, 1]} geometry={esfera(0.55, 1)} material={mat(cor2)} />
    <group position={[-3.9, 0, 0.4]}>
      {[0.5, 1.1, 1.7].map((y) => <mesh key={y} position-y={y} geometry={caixa(0.4, 0.04, 1.4)} material={mat("#7a5232")} />)}
      {Array.from({ length: 6 }, (_, i) => <mesh key={i} position={[0, 0.65 + Math.floor(i / 2) * 0.6, -0.4 + (i % 2) * 0.6]} geometry={caixa(0.18, 0.26, 0.18)} material={mat(["#e5281f", "#1f6fe5", "#f2c12e", "#1fae5a", cor, cor2][i])} />)}
    </group>
    <group position={[3.7, 0, -2]}>
      <mesh position-y={0.25} geometry={cilindro(0.22, 0.17, 0.5, 6)} material={mat("#c76b4a")} />
      {[0, 1, 2, 3].map((i) => <mesh key={i} position={[Math.cos(i * 1.6) * 0.15, 0.75 + i * 0.12, Math.sin(i * 1.6) * 0.15]} geometry={esfera(0.22, 0)} material={mat(i % 2 ? "#3f8f3c" : "#4fa14a")} />)}
    </group>
  </group>
);
