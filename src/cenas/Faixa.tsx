import { AbsoluteFill, interpolate, useVideoConfig } from "remotion";
import { Conteudo } from "../components/MidiaReal";
import { FONTES, pop, useFrame } from "../components/motion";
import { useEstilo } from "../estilos";
import { CenaFaixa } from "../types";

// Faixa de cinema: o vídeo ou a foto em 16:9 a toda a largura, sobre fundo escuro com um brilho da cor do estilo,
// e um título curto com brilho por cima (ex.: "475M VIEWS"). A legenda da fala fica por baixo, como nos reels.
export const Faixa: React.FC<{ cena: CenaFaixa; cor: string }> = ({ cena, cor }) => {
  const f = useFrame();
  const { fps, width: L, height: A, durationInFrames: d } = useVideoConfig();
  const e = useEstilo();
  const h = Math.round((L * 9) / 16);
  const topo = Math.round(A / 2 - h / 2 - 90);
  const s = pop(f, fps, 0, 12);
  const sTitulo = pop(f, fps, 5, 14);
  const zoom = interpolate(f, [0, d], [1.04, 1.12]);

  return (
    <AbsoluteFill style={{ background: "#050507" }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 90% 55% at 50% 42%, ${cor}2e, transparent 70%)` }} />
      <div style={{ position: "absolute", top: topo, left: 0, width: L, height: h, overflow: "hidden", opacity: s, transform: `translateY(${(1 - s) * 30}px)`, boxShadow: `0 0 80px ${cor}22` }}>
        {cena.midia?.arquivo ? (
          <Conteudo midia={cena.midia} estilo={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${zoom})` }} />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "#111218" }} />
        )}
      </div>
      {cena.titulo && (
        <div style={{
          position: "absolute", top: topo - 170, left: 40, right: 40, textAlign: "center",
          fontFamily: FONTES[e.titulo], fontSize: 104, lineHeight: 1, color: cor, letterSpacing: e.tracking,
          textShadow: `0 0 26px ${cor}cc, 0 0 60px ${cor}66`, opacity: sTitulo, transform: `scale(${0.85 + 0.15 * sTitulo})`,
        }}>
          {cena.titulo}
        </div>
      )}
    </AbsoluteFill>
  );
};
