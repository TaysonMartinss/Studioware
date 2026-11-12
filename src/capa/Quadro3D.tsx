import { AbsoluteFill } from "remotion";
import { FiltrosAquarela } from "../components/Aquarela";
import { ESTILOS, EstiloCtx } from "../estilos";
import { LowPolyCena } from "../lowpoly/LowPolyCena";
import { CenaLowPoly } from "../types";

// Um frame limpo de uma cena low poly (sem título, etiquetas, legendas nem marca d'água), para servir de fundo
// à capa quando o vídeo é animação 3D e não tem fotos. O scripts/capa.mjs escolhe o frame (meio da cena).
export type Quadro3DProps = { cena: CenaLowPoly; estilo?: string; formato: "vertical" | "horizontal" };

export const Quadro3D: React.FC<Quadro3DProps> = ({ cena, estilo }) => {
  const e = ESTILOS[estilo ?? "neon"] ?? ESTILOS.neon;
  return (
    <EstiloCtx.Provider value={e}>
      <AbsoluteFill style={{ background: e.fundo }}>
        {e.textura === "aquarela" && <FiltrosAquarela tinta={e.corTexto} />}
        <LowPolyCena cena={cena} cor={e.cor} semTexto />
      </AbsoluteFill>
    </EstiloCtx.Provider>
  );
};

export const tamanhoQuadro3D = (formato: Quadro3DProps["formato"]) =>
  formato === "horizontal" ? { width: 1920, height: 1080 } : { width: 1080, height: 1920 };
