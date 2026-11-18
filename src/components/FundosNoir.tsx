import { AbsoluteFill, useVideoConfig } from "remotion";
import { useFrame } from "./motion";
import { GrelhaOndulada } from "./GrelhaOndulada";

// Fundos animados do estilo Editorial (alternam de cena para cena com o papel):
//  0 topografia: curvas de nível brancas finas sobre preto, a ondular devagar
//  1 grelha azul: grelha branca ondulada sobre azul-escuro, com uma faixa de sombra a percorrer o ecrã
//  2 túnel 3D: grelha em perspetiva no chão e no teto, a avançar em loop
export const FUNDOS_NOIR = 3;

const Topografia: React.FC = () => {
  const f = useFrame();
  const { width: L, height: A } = useVideoConfig();
  const cx = L * 0.55 + Math.sin(f / 90) * 60, cy = A * 0.3 + Math.cos(f / 110) * 50;
  const curva = (k: number) => {
    const r0 = 40 + k * 46;
    const pts = Array.from({ length: 64 }, (_, i) => {
      const a = (i / 64) * Math.PI * 2;
      const r = r0 * (1 + 0.22 * Math.sin(a * 3 + k * 0.4 + f / 40) + 0.12 * Math.sin(a * 5 - k * 0.25 - f / 55) + 0.08 * Math.cos(a * 2 + f / 70));
      return `${(cx + Math.cos(a) * r * 1.15).toFixed(1)},${(cy + Math.sin(a) * r * 1.6).toFixed(1)}`;
    });
    return `M ${pts.join(" L ")} Z`;
  };
  return (
    <AbsoluteFill style={{ background: "#050505" }}>
      <svg width={L} height={A} style={{ position: "absolute", inset: 0 }}>
        {Array.from({ length: 34 }, (_, k) => (
          <path key={k} d={curva(k)} fill="none" stroke="#ffffff" strokeWidth={2.2} opacity={0.75 - k * 0.012} />
        ))}
      </svg>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 50%, transparent 40%, #000000cc 100%)" }} />
    </AbsoluteFill>
  );
};

const GrelhaAzul: React.FC = () => {
  const f = useFrame();
  const { height: A } = useVideoConfig();
  const faixa = ((f * 6) % (A * 1.6)) - A * 0.3;
  return (
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, #0b2a8a, #04103d 60%, #01040f)" }}>
      <GrelhaOndulada opacidade={0.55} preto={false} />
      <div style={{ position: "absolute", left: 0, right: 0, top: faixa, height: A * 0.28, background: "linear-gradient(180deg, transparent, #000000cc, transparent)" }} />
    </AbsoluteFill>
  );
};

const Tunel: React.FC = () => {
  const f = useFrame();
  const { width: L, height: A } = useVideoConfig();
  const anda = (f * 7) % 120;
  const plano = (cima: boolean): React.CSSProperties => ({
    position: "absolute", left: -L, right: -L, height: A * 1.2, [cima ? "bottom" : "top"]: A * 0.5,
    transformOrigin: cima ? "bottom" : "top", transform: `rotateX(${cima ? -78 : 78}deg)`,
    backgroundImage: "linear-gradient(#ffffff99 2px, transparent 2px), linear-gradient(90deg, #ffffff99 2px, transparent 2px)",
    backgroundSize: "120px 120px", backgroundPosition: `0 ${cima ? -anda : anda}px`,
    maskImage: `linear-gradient(${cima ? "0deg" : "180deg"}, transparent 0%, #000 45%)`, WebkitMaskImage: `linear-gradient(${cima ? "0deg" : "180deg"}, transparent 0%, #000 45%)`,
  });
  return (
    <AbsoluteFill style={{ background: "#020202", perspective: 600, perspectiveOrigin: "50% 50%", overflow: "hidden" }}>
      <div style={plano(true)} />
      <div style={plano(false)} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 50%, #000 8%, transparent 45%)" }} />
    </AbsoluteFill>
  );
};

export const FundoNoir: React.FC<{ variante: number }> = ({ variante }) => {
  const v = ((variante % FUNDOS_NOIR) + FUNDOS_NOIR) % FUNDOS_NOIR;
  return v === 0 ? <Topografia /> : v === 1 ? <GrelhaAzul /> : <Tunel />;
};

// Plano do fundo (Noir ou Vice) dentro de uma câmara 3D: os fundos desenham do tamanho do ecrã, por isso o plano é
// ampliado o bastante para cobrir o ecrã no pior enquadramento da câmara (recuo, pan e rotação). Com a escala antiga
// (1,3 a -380 px ≈ 1,02 do ecrã) as bordas pretas apareciam assim que a câmara se mexia.
// escala: quanto ampliar; a regra é cobrir com folga  escala × 1400 / (1400 + 380 − recuo máximo da câmara)  ≥ ~1,35
export const PlanoFundo3D: React.FC<{ children: React.ReactNode; escala?: number }> = ({ children, escala = 1.8 }) => (
  <div style={{ position: "absolute", inset: 0, transform: `translateZ(-380px) scale(${escala})` }}>{children}</div>
);
