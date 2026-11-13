import { AbsoluteFill, useVideoConfig } from "remotion";

// Estilo "Vice Sunset": direção de arte de cidade costeira ao pôr do sol (inspirada no GTA VI, sem marcas):
// céu roxo → rosa → laranja, sol com riscas no horizonte e silhuetas de palmeiras. Usado no fundo do estilo,
// por trás do layout rosto + gameplay e nas cenas editoriais quando o estilo é "vice".
export const CEU_VICE = "linear-gradient(180deg, #170a33 0%, #3d1460 28%, #a12a7d 52%, #ff4f8f 70%, #ff9b5e 86%, #ffd27a 100%)";
export const VICE = { tinta: "#ffffff", destaque: "#ffd45e", acento: "#2ee6d6", sombra: "#2a0b45", rosa: "#ff4f8f" };

const Palmeira: React.FC<{ x: number; base: number; altura: number; inclina: number; espelho?: boolean }> = ({ x, base, altura, inclina, espelho }) => {
  const topoX = x + inclina, topoY = base - altura;
  const folha = (ang: number, comp: number) => {
    const r = (ang * Math.PI) / 180;
    const fx = topoX + Math.cos(r) * comp, fy = topoY + Math.sin(r) * comp * 0.55 + comp * 0.18;
    const cx = topoX + Math.cos(r) * comp * 0.5, cy = topoY + Math.sin(r) * comp * 0.5 - comp * 0.22;
    return `M ${topoX} ${topoY} Q ${cx} ${cy} ${fx} ${fy} Q ${cx + 10} ${cy + 26} ${topoX} ${topoY + 8} Z`;
  };
  return (
    <g fill="#1a0826" transform={espelho ? `translate(${2 * x}, 0) scale(-1, 1)` : undefined}>
      <path d={`M ${x - 9} ${base} Q ${x + inclina * 0.2} ${base - altura * 0.5} ${topoX - 4} ${topoY} L ${topoX + 5} ${topoY} Q ${x + inclina * 0.25 + 12} ${base - altura * 0.5} ${x + 11} ${base} Z`} />
      {[-170, -140, -110, -70, -40, -10, 20, 160].map((a, i) => <path key={i} d={folha(a, 150 + (i % 3) * 25)} />)}
    </g>
  );
};

export const FundoVice: React.FC<{ palmeiras?: boolean }> = ({ palmeiras = true }) => {
  const { width: L, height: A } = useVideoConfig();
  const horizonte = A * 0.74;
  return (
    <AbsoluteFill style={{ background: CEU_VICE }}>
      {/* sol com riscas horizontais (o fundo do céu passa pelas riscas) */}
      <div style={{
        position: "absolute", left: L / 2 - 300, top: horizonte - 420, width: 600, height: 600, borderRadius: "50%",
        background: "linear-gradient(180deg, #ffe08a, #ff7a6b 75%)",
        maskImage: "linear-gradient(180deg, #000 52%, transparent 52% 56%, #000 56% 64%, transparent 64% 69%, #000 69% 76%, transparent 76% 82%, #000 82% 88%, transparent 88%)",
        WebkitMaskImage: "linear-gradient(180deg, #000 52%, transparent 52% 56%, #000 56% 64%, transparent 64% 69%, #000 69% 76%, transparent 76% 82%, #000 82% 88%, transparent 88%)",
        filter: "drop-shadow(0 0 60px #ff8a6b88)",
      }} />
      {/* mar escuro com reflexo */}
      <div style={{ position: "absolute", left: 0, right: 0, top: horizonte, bottom: 0, background: "linear-gradient(180deg, #3a1252, #12061f)" }} />
      <div style={{ position: "absolute", left: L / 2 - 220, width: 440, top: horizonte + 10, height: 220, background: "repeating-linear-gradient(180deg, #ff9b5e66 0 6px, transparent 6px 18px)", maskImage: "linear-gradient(180deg, #000, transparent)", WebkitMaskImage: "linear-gradient(180deg, #000, transparent)" }} />
      {palmeiras && (
        <svg width={L} height={A} style={{ position: "absolute", inset: 0 }}>
          <Palmeira x={120} base={horizonte + 40} altura={A * 0.42} inclina={70} />
          <Palmeira x={L - 110} base={horizonte + 60} altura={A * 0.5} inclina={-90} espelho />
          <Palmeira x={L - 230} base={horizonte + 40} altura={A * 0.3} inclina={-40} espelho />
        </svg>
      )}
    </AbsoluteFill>
  );
};
