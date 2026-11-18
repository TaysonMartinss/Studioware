import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

// Efeitos de uma cena escolhidos no editor manual (como os do rea-capcut): predefinição de cor, movimento de câmara e
// fades de entrada/saída a preto. Valem igual no player do painel e no render final.
export type EfeitosDaCena = { cor?: string; movimento?: string; entrada?: number; saida?: number };

// predefinições de cor (filtros CSS): o nome é o que o roteiro guarda
export const FILTROS_COR: Record<string, string> = {
  cinema: "contrast(1.14) saturate(0.82) sepia(0.1) brightness(0.94)",
  quente: "sepia(0.28) saturate(1.25) hue-rotate(-10deg)",
  frio: "saturate(0.88) hue-rotate(14deg) contrast(1.06) brightness(1.03)",
  pb: "grayscale(1) contrast(1.12)",
  vintage: "sepia(0.48) contrast(0.9) brightness(1.06) saturate(0.78)",
  vivo: "saturate(1.5) contrast(1.08)",
  suave: "contrast(0.86) brightness(1.07) saturate(0.88)",
  noite: "brightness(0.78) contrast(1.15) saturate(0.7) hue-rotate(18deg)",
};

export const EfeitosCena: React.FC<{ efeitos?: EfeitosDaCena; children: React.ReactNode }> = ({ efeitos, children }) => {
  const f = useCurrentFrame();
  const { durationInFrames: d, fps } = useVideoConfig();
  if (!efeitos || (!efeitos.cor && !efeitos.movimento && !efeitos.entrada && !efeitos.saida)) return <>{children}</>;
  const p = d > 1 ? f / (d - 1) : 0;
  const mov = efeitos.movimento;
  const transform =
    mov === "zoom-in" ? `scale(${1 + 0.12 * p})`
    : mov === "zoom-out" ? `scale(${1.12 - 0.12 * p})`
    : mov === "pan" ? `scale(1.1) translateX(${(0.5 - p) * 7}%)`
    : mov === "tremor" ? `scale(1.03) translate(${Math.sin(f * 1.7) * 5}px, ${Math.cos(f * 2.3) * 5}px) rotate(${Math.sin(f * 0.9) * 0.4}deg)`
    : undefined;
  const ent = Math.max(0, efeitos.entrada ?? 0) * fps, sai = Math.max(0, efeitos.saida ?? 0) * fps;
  const preto = Math.max(
    ent > 0 ? interpolate(f, [0, ent], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0,
    sai > 0 ? interpolate(f, [d - sai, d - 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0,
  );
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill style={{ filter: efeitos.cor ? FILTROS_COR[efeitos.cor] : undefined, transform }}>{children}</AbsoluteFill>
      {preto > 0 && <AbsoluteFill style={{ background: "#000", opacity: preto, pointerEvents: "none" }} />}
    </AbsoluteFill>
  );
};
