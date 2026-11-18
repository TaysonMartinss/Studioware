import * as THREE from "three";
import { caixa, cilindro, clamp01, entre, esfera, geo, lerp, mat, rng } from "./util";
import { Inst, Instancias } from "./Instancias";
import { Hora } from "./ambiente";

// Pacote "vícios digitais e saúde mental" (vídeos de prevenção, sem nada explícito):
//   - QuartoEscuro: quarto às 3 da manhã, cortinas fechadas, só a luz azul do celular e o relógio vermelho; bagunça
//     no chão. Variante "manha": o mesmo quarto arrumado, cortinas abertas e sol (a recuperação).
//   - Consultorio: consultório de psicólogo, luz quente de dia, duas poltronas, estante, planta e diplomas.
//   - Objetos: "smartphone" gigante (rolar | notificacoes | 18 | bloqueado) e "cerebro" com o circuito da
//     recompensa (dopamina | tolerancia | recuperar).
// Quem está "sentado" no quarto senta-se na beira da cama; no consultório, numa poltrona.

const PAREDE_Z = -2.6;
export const CAMA_Z = -0.75; // beira da cama (a pessoa sentada fica à frente dela)
const r2 = (x: number) => Math.round(x * 100) / 100;

// dígitos de 7 segmentos (relógio, "18+")
const SEG: Record<string, string> = { "0": "abcdef", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc", "5": "afgcd", "6": "afgedc", "7": "abc", "8": "abcdefg", "9": "abcdfg" };
export const Digitos: React.FC<{ texto: string; altura: number; cor: string; brilho?: number }> = ({ texto, altura, cor, brilho = 1.6 }) => {
  const h = altura, w = h * 0.55, e = h * 0.13, passo = w + h * 0.28;
  const m = mat(cor, { emissivo: cor, brilho });
  const seg = (s: string): [number, number, number, number] => ({
    a: [0, h / 2, w, e], g: [0, 0, w, e], d: [0, -h / 2, w, e],
    f: [-w / 2, h / 4, e, h / 2], b: [w / 2, h / 4, e, h / 2], e: [-w / 2, -h / 4, e, h / 2], c: [w / 2, -h / 4, e, h / 2],
  } as Record<string, [number, number, number, number]>)[s];
  const chars = [...texto];
  const largura = chars.reduce((s, c) => s + (c === ":" ? h * 0.35 : passo), 0);
  let x = -largura / 2;
  return (
    <group>
      {chars.map((c, i) => {
        const cx = x + (c === ":" ? h * 0.175 : passo / 2);
        x += c === ":" ? h * 0.35 : passo;
        if (c === ":") return <group key={i} position-x={cx}>{[0.22, -0.22].map((y) => <mesh key={y} position-y={y * h} geometry={caixa(e, e, e)} material={m} />)}</group>;
        if (c === "+") return <group key={i} position-x={cx}><mesh geometry={caixa(w, e, e)} material={m} /><mesh geometry={caixa(e, w, e)} material={m} /></group>;
        return <group key={i} position-x={cx}>{[...(SEG[c] ?? "")].map((s) => { const [sx, sy, l, a] = seg(s); return <mesh key={s} position={[sx, sy, 0]} geometry={caixa(l, a, e * 0.6)} material={m} />; })}</group>;
      })}
    </group>
  );
};

const LIVROS_QUARTO: Inst[] = Array.from({ length: 9 }, (_, i) => ({ p: [-0.3 + (i % 5) * 0.12, 0.45 + Math.floor(i / 5) * 0.55, 0.05], cor: ["#7a3b3b", "#3b5a7a", "#a3893b", "#4a6a4a"][i % 4] }));
const LIVROS_CONSULTORIO: Inst[] = Array.from({ length: 30 }, (_, i) => ({ p: [-0.62 + (i % 10) * 0.14, 0.42 + Math.floor(i / 10) * 0.55, 0.02], s: [1, 0.8 + ((i * 37) % 5) * 0.06, 1], cor: ["#8a3b3b", "#3b5a8a", "#c9a24a", "#4f7a54", "#6a4a7a", "#d8d2c4"][(i * 7) % 6] }));

// ---------- quarto escuro ----------
const Cama: React.FC<{ manha: boolean }> = ({ manha }) => (
  <group position={[0, 0, CAMA_Z - 1.0]}>
    <mesh position-y={0.17} geometry={caixa(2.7, 0.34, 2.0)} material={mat("#3a2a20")} />
    <mesh position-y={0.42} geometry={caixa(2.6, 0.18, 1.94)} material={mat("#d9d6cf")} />
    {/* cabeceira à esquerda, almofadas */}
    <mesh position={[-1.38, 0.62, 0]} geometry={caixa(0.1, 1.0, 2.0)} material={mat("#2e221a")} />
    {[-0.45, 0.45].map((z) => <mesh key={z} position={[-1.05, 0.6, z]} rotation-z={0.25} geometry={caixa(0.22, 0.2, 0.75)} material={mat(manha ? "#f2efe8" : "#bfc4cf")} />)}
    {/* edredão: arrumado de manhã, amarrotado à noite */}
    {manha
      ? <mesh position={[0.25, 0.54, 0]} geometry={caixa(2.0, 0.08, 1.96)} material={mat("#6f8fb0")} />
      : [[0.5, 0.56, -0.3, 0.2, 1.3, 0.12, 1.2], [-0.1, 0.6, 0.35, -0.3, 0.9, 0.16, 0.9], [0.85, 0.53, 0.5, 0.5, 0.8, 0.1, 0.9]].map(([x, y, z, r, l, a, p], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[0.08 * i, r, 0.06]} geometry={caixa(l, a, p)} material={mat(i % 2 ? "#27324a" : "#2f3b57")} />
      ))}
  </group>
);

export const QuartoEscuro: React.FC<{ t: number; manha?: boolean; cor: string }> = ({ t, manha = false, cor }) => {
  const r = rng(77);
  // a luz do ecrã do celular treme como um vídeo a passar
  const ecra = 4 + 1.0 * Math.sin(t * 5.3) * Math.sin(t * 2.1 + 1) + 0.35 * Math.sin(t * 13.7);
  const latas = Array.from({ length: 7 }, () => ({ p: [lerp(-3.4, 3.4, r()), 0.09, lerp(-0.2, 1.8, r())] as [number, number, number], r: r() * 6, deitada: r() > 0.5 }));
  return (
    <group>
      <hemisphereLight args={[manha ? "#fff1dd" : "#5a6a9a", manha ? "#6b5640" : "#0b0c12", manha ? 0.9 : 0.32]} />
      <ambientLight intensity={manha ? 0.35 : 0.12} />
      {manha ? (
        <>
          <directionalLight position={[3.5, 4, 2]} intensity={2.2} color="#ffe2b0" />
          <pointLight position={[2.6, 1.8, PAREDE_Z + 0.8]} intensity={10} distance={7} color="#ffd9a0" />
        </>
      ) : (
        <>
          {/* luar pela fresta da cortina e a luz azul do celular na cara */}
          <directionalLight position={[2.6, 3, 2]} intensity={0.6} color="#7f9cff" />
          <pointLight position={[0, 1.35, CAMA_Z + 0.75]} intensity={r2(ecra)} distance={3.6} decay={1.4} color="#9fc8ff" />
          <pointLight position={[1.85, 0.75, CAMA_Z - 0.6]} intensity={1.1} distance={1.6} color="#ff2a2a" />
        </>
      )}

      {/* chão, paredes */}
      {Array.from({ length: 12 }, (_, i) => <mesh key={i} position={[-4.4 + i * 0.8, 0, 0.6]} geometry={caixa(0.78, 0.04, 7.4)} material={mat(manha ? (i % 2 ? "#9a7050" : "#a37856") : (i % 2 ? "#3a2c22" : "#403026"))} />)}
      <mesh position={[0, 1.6, PAREDE_Z]} geometry={caixa(9, 3.4, 0.12)} material={mat(manha ? "#d9d2c3" : "#1c2132")} />
      <mesh position={[-4.4, 1.6, 0.6]} geometry={caixa(0.12, 3.4, 7.4)} material={mat(manha ? "#cfc7b6" : "#191d2c")} />
      <mesh position={[4.4, 1.6, 0.6]} geometry={caixa(0.12, 3.4, 7.4)} material={mat(manha ? "#cfc7b6" : "#191d2c")} />
      <mesh position={[0, 0.03, 0.6]} geometry={cilindro(1.5, 1.5, 0.02, 9)} material={mat(manha ? cor : "#2a2433")} />

      <Cama manha={manha} />

      {/* janela com cortinas: fechadas com uma fresta de luar à noite, abertas de manhã */}
      <group position={[2.6, 1.85, PAREDE_Z + 0.08]}>
        <mesh geometry={caixa(1.6, 1.3, 0.04)} material={mat(manha ? "#cfe8ff" : "#0d1630", { emissivo: manha ? "#bfe0ff" : "#2a3f80", brilho: manha ? 0.9 : 0.25 })} />
        {[-1, 1].map((l) => (
          <mesh key={l} position={[l * (manha ? 0.98 : 0.42), -0.05, 0.06]} geometry={caixa(manha ? 0.32 : 0.8, 1.6, 0.06)} material={mat(manha ? "#e9dcc3" : "#202842")} />
        ))}
        {!manha && <mesh position={[0, -0.05, 0.1]} geometry={caixa(0.035, 1.5, 0.01)} material={mat("#8fb0ff", { emissivo: "#8fb0ff", brilho: 1.4 })} />}
      </group>

      {/* mesa de cabeceira com o relógio */}
      <group position={[1.85, 0, CAMA_Z - 0.6]}>
        <mesh position-y={0.3} geometry={caixa(0.55, 0.6, 0.5)} material={mat("#2b211a")} />
        <mesh position={[0, 0.7, 0]} geometry={caixa(0.42, 0.2, 0.18)} material={mat("#0b0b0d")} />
        <group position={[0, 0.7, 0.095]}><Digitos texto={manha ? "08:30" : "03:12"} altura={0.09} cor={manha ? "#ffb04a" : "#ff2a2a"} brilho={manha ? 0.8 : 2.4} /></group>
        {manha && <group position={[-0.12, 0.6, 0.05]}><mesh geometry={cilindro(0.05, 0.04, 0.16, 7)} material={mat("#e9e4da")} /></group>}
      </group>

      {/* candeeiro e estante: de manhã há uma planta */}
      <group position={[-3.4, 0, PAREDE_Z + 0.5]}>
        <mesh position-y={0.8} geometry={caixa(0.8, 1.6, 0.4)} material={mat(manha ? "#a67c55" : "#2a2119")} />
        <Instancias geometria={caixa(0.08, 0.28, 0.22)} material={mat("#ffffff")} itens={LIVROS_QUARTO} />
        {manha && (
          <group position={[0, 1.6, 0]}>
            <mesh position-y={0.12} geometry={cilindro(0.14, 0.11, 0.24, 7)} material={mat("#c96f4a")} />
            {[0, 1.2, 2.4, 3.6, 4.8].map((a) => <mesh key={a} position={[Math.cos(a) * 0.12, 0.38, Math.sin(a) * 0.12]} rotation={[Math.sin(a) * 0.5, a, Math.cos(a) * 0.5]} geometry={esfera(0.13, 0)} material={mat("#4f9a52")} />)}
          </group>
        )}
      </group>

      {/* a bagunça (só à noite): latas, roupa, caixa de pizza e pratos */}
      {!manha && (
        <group>
          {latas.map((l, i) => (
            <mesh key={i} position={l.deitada ? [l.p[0], 0.06, l.p[2]] : l.p} rotation={l.deitada ? [Math.PI / 2, 0, l.r] : [0, l.r, 0]} geometry={cilindro(0.045, 0.045, 0.16, 7)} material={mat(i % 3 === 0 ? "#3fd16a" : i % 3 === 1 ? "#c9ccd2" : "#e03a3a", { metal: 0.6, aspereza: 0.35 })} />
          ))}
          {[[-2.4, 0.4, 0.3], [2.9, 1.2, -0.5], [-1.2, 1.9, 1.2]].map(([x, z, rot], i) => (
            <group key={i} position={[x, 0.05, z]} rotation-y={rot}>
              <mesh geometry={caixa(0.7, 0.06, 0.45)} material={mat(["#3d4c6b", "#6b3d3d", "#3d6b55"][i])} />
              <mesh position={[0.15, 0.06, 0.05]} rotation-y={0.6} geometry={caixa(0.45, 0.06, 0.3)} material={mat(["#4a5a7d", "#7d4a4a", "#4a7d63"][i])} />
            </group>
          ))}
          <group position={[1.6, 0.04, 0.9]} rotation-y={-0.4}>
            <mesh geometry={caixa(0.6, 0.05, 0.6)} material={mat("#c9a26b")} />
            <mesh position={[0, 0.3, -0.3]} rotation-x={-1.2} geometry={caixa(0.6, 0.02, 0.6)} material={mat("#d8b37c")} />
            <mesh position={[0.1, 0.04, 0.05]} rotation-y={0.4} geometry={cilindro(0.2, 0.2, 0.02, 3)} material={mat("#e0a64a")} />
          </group>
          <mesh position={[-1.7, 0.03, 1.5]} geometry={cilindro(0.18, 0.15, 0.03, 9)} material={mat("#e6e6e6")} />
        </group>
      )}
    </group>
  );
};

// ---------- consultório ----------
export const Poltrona: React.FC<{ cor: string }> = ({ cor }) => (
  <group position-z={-0.12}>
    <mesh position-y={0.24} geometry={caixa(0.8, 0.48, 0.75)} material={mat(cor)} />
    <mesh position={[0, 0.72, -0.32]} rotation-x={-0.12} geometry={caixa(0.8, 0.75, 0.16)} material={mat(cor)} />
    {[-1, 1].map((l) => <mesh key={l} position={[l * 0.42, 0.56, -0.02]} geometry={caixa(0.14, 0.24, 0.72)} material={mat(cor)} />)}
    <mesh position-y={0.5} geometry={caixa(0.66, 0.06, 0.6)} material={mat(new THREE.Color(cor).offsetHSL(0, 0, 0.06).getStyle())} />
  </group>
);

export const Consultorio: React.FC<{ t: number; hora: Hora; cor: string }> = ({ t, hora, cor }) => {
  const noite = hora === "noite";
  return (
    <group>
      <hemisphereLight args={["#fff2df", "#6a5440", noite ? 0.5 : 0.9]} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[3.5, 4, 3]} intensity={noite ? 0.3 : 1.5} color="#ffe7c4" />
      <pointLight position={[-2.9, 1.9, -1.6]} intensity={noite ? 9 : 5} distance={6} color="#ffcf8a" />

      {Array.from({ length: 12 }, (_, i) => <mesh key={i} position={[-4.4 + i * 0.8, 0, 0.6]} geometry={caixa(0.78, 0.04, 7.4)} material={mat(i % 2 ? "#a07650" : "#a87d57")} />)}
      <mesh position={[0, 1.6, PAREDE_Z]} geometry={caixa(9, 3.4, 0.12)} material={mat("#e3d9c6")} />
      <mesh position={[0, 0.45, PAREDE_Z + 0.07]} geometry={caixa(9, 0.9, 0.04)} material={mat("#8f7a62")} />
      <mesh position={[-4.4, 1.6, 0.6]} geometry={caixa(0.12, 3.4, 7.4)} material={mat("#d8cdb8")} />
      <mesh position={[4.4, 1.6, 0.6]} geometry={caixa(0.12, 3.4, 7.4)} material={mat("#d8cdb8")} />
      <mesh position={[0, 0.03, 0.1]} geometry={cilindro(2.0, 2.0, 0.02, 10)} material={mat(cor)} />

      {/* estante com livros */}
      <group position={[-2.6, 0, PAREDE_Z + 0.3]}>
        <mesh position-y={1.05} geometry={caixa(1.6, 2.1, 0.4)} material={mat("#6e4b30")} />
        <mesh position={[0, 1.05, 0.12]} geometry={caixa(1.48, 1.98, 0.2)} material={mat("#3d2a1c")} />
        <group position-z={0.12}><Instancias geometria={caixa(0.1, 0.36, 0.22)} material={mat("#ffffff")} itens={LIVROS_CONSULTORIO} /></group>
      </group>
      {/* diplomas e quadro */}
      {[[0.3, 2.2], [1.1, 2.2]].map(([x, y], i) => (
        <group key={i} position={[x, y, PAREDE_Z + 0.08]}>
          <mesh geometry={caixa(0.55, 0.42, 0.04)} material={mat("#2b2118")} />
          <mesh position-z={0.022} geometry={caixa(0.45, 0.32, 0.01)} material={mat("#f4efe2")} />
          <mesh position={[0, -0.05, 0.03]} geometry={cilindro(0.04, 0.04, 0.01, 8)} material={mat("#c9a24a", { metal: 0.6 })} />
        </group>
      ))}
      {/* janela com cortina leve */}
      <group position={[2.8, 1.8, PAREDE_Z + 0.08]}>
        <mesh geometry={caixa(1.6, 1.4, 0.04)} material={mat(noite ? "#1b2440" : "#cfe6ff", { emissivo: noite ? "#2a3a6a" : "#cfe6ff", brilho: noite ? 0.3 : 0.8 })} />
        <mesh position={[0.95, -0.05, 0.06]} geometry={caixa(0.36, 1.7, 0.05)} material={mat("#f0e6d2")} />
      </group>
      {/* candeeiro de pé, mesinha com lenços e água, planta */}
      <group position={[-3.0, 0, -1.4]}>
        <mesh position-y={0.8} geometry={cilindro(0.025, 0.025, 1.6, 6)} material={mat("#2a2a2a")} />
        <mesh position-y={1.66} geometry={cilindro(0.18, 0.26, 0.3, 8)} material={mat("#f3e3c4", { emissivo: "#ffd59a", brilho: noite ? 0.9 : 0.35 })} />
      </group>
      <group position={[0, 0, -1.45]}>
        <mesh position-y={0.25} geometry={cilindro(0.3, 0.3, 0.04, 10)} material={mat("#6e4b30")} />
        <mesh position-y={0.12} geometry={cilindro(0.04, 0.04, 0.24, 6)} material={mat("#3d2a1c")} />
        <mesh position={[-0.1, 0.33, 0]} geometry={caixa(0.2, 0.12, 0.12)} material={mat("#d8e6f0")} />
        <mesh position={[-0.1, 0.4, 0]} geometry={caixa(0.06, 0.04, 0.04)} material={mat("#ffffff")} />
        <mesh position={[0.12, 0.34, 0.04]} geometry={cilindro(0.04, 0.035, 0.14, 8)} material={mat("#bfe3ff", { opacidade: 0.55 })} />
      </group>
      <group position={[3.3, 0, -1.6]}>
        <mesh position-y={0.2} geometry={cilindro(0.22, 0.17, 0.4, 7)} material={mat("#c96f4a")} />
        {Array.from({ length: 9 }, (_, i) => { const a = i * 2.1; return <mesh key={i} position={[Math.cos(a) * 0.2, 0.55 + (i % 3) * 0.22, Math.sin(a) * 0.2]} rotation={[Math.sin(a) * 0.6, a, Math.cos(a) * 0.6]} geometry={esfera(0.2, 0)} material={mat(i % 2 ? "#4f9a52" : "#3f8546")} />; })}
      </group>
      {/* relógio de parede discreto: a sessão está a correr */}
      <group position={[-0.9, 2.35, PAREDE_Z + 0.08]}>
        <mesh rotation-x={Math.PI / 2} geometry={cilindro(0.2, 0.2, 0.04, 14)} material={mat("#f7f3ea")} />
        <mesh position-z={0.03} rotation-z={-t * 0.5} geometry={caixa(0.015, 0.16, 0.01)} material={mat("#222")} />
      </group>
    </group>
  );
};

// ---------- smartphone gigante ----------
// rolar: o feed sobe sem fim; notificacoes: chovem notificações com o contador a subir; 18: conteúdo desfocado com o
// aviso 18+ (nada explícito); bloqueado: o cadeado fecha em `quando` e o ecrã fica calmo (a recuperação)
export const Smartphone: React.FC<{ t: number; quando: number; variante?: string; cor: string }> = ({ t, quando, variante = "rolar", cor }) => {
  const L = 0.9, A = 1.8;
  const k = clamp01(t - quando);
  const feed = Array.from({ length: 7 }, (_, i) => i);
  const passo = 0.42, desl = (t * (variante === "rolar" ? 1.1 : 0.15)) % passo;
  const bloqueado = variante === "bloqueado";
  const fecha = entre(t, quando, quando + 0.5);
  return (
    <group rotation={[0.05, Math.sin(t * 0.6) * 0.18, 0.04 * Math.sin(t * 0.4)]}>
      <mesh geometry={caixa(L + 0.08, A + 0.1, 0.09)} material={mat("#15171c", { metal: 0.4, aspereza: 0.4 })} />
      <mesh position-z={0.047} geometry={caixa(L, A, 0.004)} material={mat(bloqueado ? "#0e1a14" : "#0b0f18", { emissivo: bloqueado ? "#0d2a1c" : "#16223a", brilho: 0.6 })} />
      <pointLight position={[0, 0, 0.8]} intensity={bloqueado ? 1.2 : 3 + Math.sin(t * 6) * 0.8} distance={4} color={bloqueado ? "#7dffb0" : "#9fc8ff"} />
      <mesh position={[0, A / 2 - 0.05, 0.05]} geometry={caixa(0.2, 0.035, 0.005)} material={mat("#05060a")} />
      {/* o feed (em todos menos no bloqueado): cartões que sobem, cortados nas bordas do ecrã */}
      {!bloqueado && feed.map((i) => {
        const y = -A / 2 + 0.1 + i * passo + desl;
        if (y > A / 2 - 0.2 || y < -A / 2 + 0.05) return null;
        const c = ["#ff4f8a", "#ffb84f", "#4fd1ff", "#a26bff", "#5ce08a"][(i + Math.floor(t * (variante === "rolar" ? 1.1 : 0.15) / passo)) % 5];
        return (
          <group key={i} position={[0, y, 0.052]}>
            <mesh geometry={caixa(L - 0.12, 0.34, 0.004)} material={mat(c, { emissivo: c, brilho: variante === "18" ? 0.25 : 0.55, opacidade: variante === "18" ? 0.55 : 1 })} />
            <mesh position={[-L / 2 + 0.15, -0.12, 0.003]} geometry={caixa(0.16, 0.04, 0.003)} material={mat("#ffffff", { emissivo: "#ffffff", brilho: 0.4 })} />
          </group>
        );
      })}
      {/* 18+: desfoque (grelha de quadrados) e o aviso a pulsar */}
      {variante === "18" && (
        <group position-z={0.06}>
          <mesh geometry={caixa(L - 0.04, A - 0.1, 0.002)} material={mat("#2a0f1f", { opacidade: 0.75 })} />
          <mesh rotation-x={Math.PI / 2} geometry={cilindro(0.3, 0.3, 0.01, 24)} material={mat("#e0243a", { emissivo: "#e0243a", brilho: 0.9 + 0.3 * Math.sin(t * 4) })} />
          <mesh position-z={0.006} rotation-x={Math.PI / 2} geometry={cilindro(0.25, 0.25, 0.012, 24)} material={mat("#1a0a12")} />
          <group position-z={0.02}><Digitos texto="18+" altura={0.16} cor="#ffffff" brilho={1.2} /></group>
        </group>
      )}
      {/* notificações: bolhas que descem do topo e o contador vermelho a subir */}
      {variante === "notificacoes" && (
        <group position-z={0.06}>
          {[0, 1, 2].map((j) => {
            const f = ((t * 0.9 + j / 3) % 1);
            return <mesh key={j} position={[0, A / 2 - 0.2 - f * 0.9, 0]} scale={[1, 1, 1]} geometry={caixa(L - 0.1, 0.16, 0.01)} material={mat("#f4f6fb", { emissivo: "#ffffff", brilho: 0.3, opacidade: 1 - f })} />;
          })}
          <group position={[L / 2 - 0.02, A / 2 - 0.02, 0.02]}>
            <mesh rotation-x={Math.PI / 2} geometry={cilindro(0.13, 0.13, 0.02, 16)} material={mat("#e0243a", { emissivo: "#e0243a", brilho: 0.8 })} />
            <group position-z={0.02}><Digitos texto={String(Math.min(99, 3 + Math.floor(t * 4)))} altura={0.09} cor="#ffffff" brilho={1} /></group>
          </group>
        </group>
      )}
      {/* bloqueado: cadeado que fecha e um anel verde */}
      {bloqueado && (
        <group position={[0, 0.05, 0.08]} scale={0.9 + 0.1 * k}>
          <mesh geometry={caixa(0.42, 0.34, 0.08)} material={mat("#3fd17a", { emissivo: "#3fd17a", brilho: 0.5 })} />
          <mesh position={[0, 0.17 + 0.12 * (1 - fecha), 0]} geometry={geo("arco-cadeado", () => new THREE.TorusGeometry(0.14, 0.03, 6, 14, Math.PI))} material={mat("#c8d0cc", { metal: 0.6, aspereza: 0.3 })} />
          <mesh position={[0, -0.02, 0.045]} geometry={cilindro(0.035, 0.035, 0.01, 8)} material={mat("#0e1a14")} />
          <mesh position-z={-0.02} rotation-x={Math.PI / 2} geometry={geo("anel-calmo", () => new THREE.TorusGeometry(0.62, 0.012, 6, 40))} material={mat(cor, { emissivo: "#7dffb0", brilho: 0.5 * fecha })} scale={1 + 0.04 * Math.sin(t * 2)} />
        </group>
      )}
    </group>
  );
};

// ---------- cérebro com o circuito da recompensa ----------
// dopamina: pulsos amarelos correm do meio do cérebro (área tegmental ventral) para a frente (núcleo accumbens e
// córtex pré-frontal) e o cérebro brilha; tolerancia: os pulsos ficam fracos e lentos e o brilho apaga-se com o
// tempo; recuperar: o contrário, devagar
// um hemisfério = elipsoide (0,95 × 0,62 × 0,42) com saliências à superfície (as circunvoluções)
const ELIPSE: [number, number, number] = [0.95, 0.62, 0.42];
const DOBRAS = (() => {
  const r = rng(11), out: { p: [number, number, number]; s: number }[] = [];
  for (let i = 0; i < 70; i++) {
    const a = Math.acos(lerp(-0.35, 1, r())), b = r() * Math.PI * 2;
    const n = [Math.cos(b) * Math.sin(a), Math.cos(a), Math.sin(b) * Math.sin(a)];
    if (n[2] < -0.2) continue; // o lado de dentro (a fissura) fica liso
    out.push({ p: [n[0] * ELIPSE[0] * 0.93, n[1] * ELIPSE[1] * 0.93, n[2] * ELIPSE[2] * 0.93], s: 0.13 + r() * 0.07 });
  }
  return out;
})();
// circuito da recompensa por fora do hemisfério do lado da câmara: do meio (em baixo) para a frente (testa)
const CAMINHO = new THREE.CatmullRomCurve3([[-0.1, -0.32, 0.5], [0.15, -0.2, 0.62], [0.45, -0.02, 0.6], [0.7, 0.18, 0.48], [0.86, 0.34, 0.3]].map(([x, y, z]) => new THREE.Vector3(x, y, z)));
export const Cerebro: React.FC<{ t: number; quando: number; variante?: string }> = ({ t, quando, variante = "dopamina" }) => {
  const dt = Math.max(0, t - quando);
  const forca = variante === "tolerancia" ? 1 - 0.8 * clamp01(dt / 4) : variante === "recuperar" ? 0.2 + 0.8 * clamp01(dt / 4) : 1;
  const vel = lerp(0.12, 0.65, forca);
  const pele = new THREE.Color("#e8a0a8").lerp(new THREE.Color("#8d8890"), 1 - forca).getStyle();
  const pulsos = Array.from({ length: 6 }, (_, i) => ((t * vel + i / 6) % 1));
  return (
    <group rotation-y={-0.35 + Math.sin(t * 0.4) * 0.2} position-y={0.1}>
      {[-1, 1].map((lado) => (
        <group key={lado} position-z={lado * 0.24} scale={[1, 1, lado]}>
          <mesh scale={ELIPSE} geometry={esfera(1, 1)} material={mat(pele, { aspereza: 0.75 })} />
          {DOBRAS.map((l, i) => <mesh key={i} position={l.p} geometry={esfera(l.s, 0)} material={mat(new THREE.Color(pele).offsetHSL(0, 0, i % 3 === 0 ? -0.05 : 0.02).getStyle(), { aspereza: 0.7 })} />)}
        </group>
      ))}
      {/* cerebelo e tronco */}
      <mesh position={[-0.72, -0.42, 0]} scale={[1, 0.6, 1.5]} geometry={esfera(0.32, 1)} material={mat(new THREE.Color(pele).offsetHSL(0, 0, -0.08).getStyle())} />
      <mesh position={[-0.3, -0.68, 0]} rotation-z={0.35} geometry={cilindro(0.13, 0.1, 0.55, 6)} material={mat(pele)} />
      {/* o circuito: tubo fino e os pulsos */}
      <mesh geometry={geo("caminho-recompensa", () => new THREE.TubeGeometry(CAMINHO, 30, 0.025, 5, false))} material={mat("#ffcf4a", { emissivo: "#ffb000", brilho: r2(0.3 + 1.2 * forca), semNevoa: true })} />
      {pulsos.map((u, i) => {
        const p = CAMINHO.getPoint(u);
        return <mesh key={i} position={p} scale={(0.6 + 0.6 * forca) * (1 - u * 0.3)} geometry={esfera(0.07, 1)} material={mat("#fff3b0", { emissivo: "#ffd84a", brilho: r2(0.5 + 2.5 * forca), semNevoa: true })} />;
      })}
      {/* brilho na frente (recompensa) */}
      <pointLight position={[0.9, 0.35, 0.5]} intensity={r2(0.5 + 3.5 * forca * (0.75 + 0.25 * Math.sin(t * 5)))} distance={3} color="#ffd060" />
    </group>
  );
};
