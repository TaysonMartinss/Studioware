import { AbsoluteFill, Sequence, interpolate, random, useVideoConfig } from "remotion";
import { Glitch } from "../components/Glitch";
import { Icone } from "../components/Icone";
import { MidiaCartao, MidiaFundo } from "../components/MidiaReal";
import { clamp, pop, shake, useFontes, useFrame } from "../components/motion";
import { ESCALA, Kicker, RecortePapel, Revelar, TOPO, useMargem, useSombra, useTracking } from "../components/ui";
import { Em, Sfx } from "../components/Sfx";
import { useEstilo } from "../estilos";
import { CenaFato } from "../types";

const T = { kicker: 2, titulo: 5, midia: 10 };

// Curiosidade: etiqueta + título editorial alinhado à esquerda, mídia real em cartão e fundo desfocado
export const Fato: React.FC<{ cena: CenaFato; cor: string }> = ({ cena, cor }) => {
  const MARGEM = useMargem();
  const f = useFrame();
  const { fps } = useVideoConfig();
  const e = useEstilo();
  const { titulo } = useFontes();
  const sombra = useSombra();
  const tracking = useTracking();
  const papel = e.tema === "papel";
  const temMidia = Boolean(cena.midia?.arquivo);
  const sKicker = pop(f, fps, T.kicker, 14);
  const revelar = interpolate(f, [T.titulo, T.titulo + 12], [100, 0], { ...clamp, easing: (t) => 1 - Math.pow(1 - t, 3) });
  const icone = cena.icone ?? cena.emoji;

  return (
    <AbsoluteFill style={{ transform: shake(f, [T.titulo], 10 * e.shake) }}>
      <MidiaFundo midia={cena.midia} />
      <Em de={T.titulo}><Sfx nome="impacto" volume={0.21} /></Em>

      <div style={{ position: "absolute", top: TOPO, left: MARGEM, right: MARGEM }}>
        <Kicker cor={cor} style={{ opacity: sKicker, transform: `translateY(${(1 - sKicker) * 20}px)` }}>
          {cena.kicker ?? (cena.numero != null ? `Curiosidade nº ${cena.numero}` : "Você sabia?")}
        </Kicker>
        <Glitch inicio={T.titulo} semente={`fato${cena.numero}`}>
          {papel ? (
            // tira de papel recortada, com fibra à vista e a tremer
            <RecortePapel semente={`fato${cena.numero}`} padding="6px 22px" style={{ display: "inline-block", marginTop: 22, transform: `rotate(${(random(`ft${cena.numero}`) - 0.5) * 3}deg)` }}>
              <div style={{ fontFamily: titulo, fontSize: temMidia ? ESCALA.h2 : ESCALA.h1, lineHeight: 1.02, color: e.corTexto, textTransform: "uppercase" }}>{cena.titulo}</div>
            </RecortePapel>
          ) : (
            <Revelar inicio={T.titulo} style={{ marginTop: 22 }}>
              <div
                style={{
                  fontFamily: titulo, fontSize: temMidia ? ESCALA.h2 : ESCALA.h1, lineHeight: 1.02, color: e.corTexto, letterSpacing: tracking,
                  textTransform: "uppercase", clipPath: e.entrada ? undefined : `inset(-10% ${revelar}% -10% 0)`, textShadow: sombra,
                }}
              >
                {cena.titulo}
              </div>
            </Revelar>
          )}
        </Glitch>
      </div>

      {temMidia ? (
        <MidiaCartao midia={cena.midia} cor={cor} top={470} altura={700} atraso={T.midia} />
      ) : (
        icone && (
          <div style={{ position: "absolute", top: 640, width: "100%", display: "flex", justifyContent: "center", opacity: pop(f, fps, T.midia, 14) }}>
            <Icone nome={icone} tamanho={300} cor={cor} traco={1.25} />
          </div>
        )
      )}
    </AbsoluteFill>
  );
};
