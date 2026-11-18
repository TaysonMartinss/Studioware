import { AbsoluteFill, interpolate, useVideoConfig } from "remotion";
import { PasseioCamera } from "../components/PasseioCamera";
import { FONTES, useFrame } from "../components/motion";
import { useEstilo } from "../estilos";
import { CenaPrint } from "../types";

// Cena "print": um print (notícia, tweet, documento, ecrã de jogo) ou um vídeo percorrido por uma câmara 3D,
// de ponto de interesse em ponto de interesse. A legenda da fala fica por cima, como nas outras cenas.
export const Print: React.FC<{ cena: CenaPrint; cor: string }> = ({ cena, cor }) => {
  const f = useFrame();
  const { fps } = useVideoConfig();
  const e = useEstilo();
  const m = cena.midia;
  if (!m?.arquivo || m.formato === "modelo3d") return <AbsoluteFill style={{ background: e.fundo }} />;
  const entra = interpolate(f, [4, 4 + fps * 0.4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <PasseioCamera arquivo={m.arquivo} video={m.formato === "video"} inicioS={m.inicioS} pontos={cena.pontos ?? m.pontos} cor={cor} cheio={cena.telaCheia} />
      {cena.titulo && (
        <div style={{ position: "absolute", top: 150, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: entra, transform: `translateY(${(1 - entra) * -20}px)` }}>
          <div style={{ fontFamily: FONTES.mono, fontSize: 30, letterSpacing: "0.22em", color: "#fff", background: "#000a", padding: "10px 22px", borderRadius: 8, borderLeft: `6px solid ${cor}` }}>{cena.titulo.toUpperCase()}</div>
        </div>
      )}
    </AbsoluteFill>
  );
};
