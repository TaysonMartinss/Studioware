import { AbsoluteFill, OffthreadVideo, staticFile, useVideoConfig } from "remotion";
import { pop, useFontes, useFrame } from "../components/motion";
import { useEstilo } from "../estilos";
import { CenaManim } from "../types";

// Clip renderizado pelo Manim (vertical 1080x1920) em ecrã inteiro, com título opcional por cima
export const ManimCena: React.FC<{ cena: CenaManim; cor: string }> = ({ cena, cor }) => {
  const f = useFrame();
  const { fps } = useVideoConfig();
  const e = useEstilo();
  const { titulo } = useFontes();
  const s = pop(f, fps, 3, 14);
  return (
    <AbsoluteFill>
      {cena.midia?.arquivo ? (
        <OffthreadVideo src={staticFile(cena.midia.arquivo)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", color: e.corTexto, fontSize: 40 }}>(cena Manim ainda não renderizada)</AbsoluteFill>
      )}
      {cena.titulo && (
        <div style={{ position: "absolute", top: 170, left: 70, right: 70, fontFamily: titulo, fontSize: 76, color: e.corTexto, opacity: s, transform: `translateY(${(1 - s) * 30}px)`, borderLeft: `10px solid ${cor}`, paddingLeft: 26 }}>
          {cena.titulo}
        </div>
      )}
    </AbsoluteFill>
  );
};
