import { useCurrentFrame, useVideoConfig } from "remotion";

// Barra de retenção fina no topo
export const BarraProgresso: React.FC<{ cor: string }> = ({ cor }) => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = (f / durationInFrames) * 100;
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 8, background: "rgba(127,127,127,0.25)" }}>
      <div style={{ width: `${p}%`, height: "100%", background: cor }} />
    </div>
  );
};
