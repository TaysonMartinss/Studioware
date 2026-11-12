import { AbsoluteFill, Easing, interpolate, useVideoConfig } from "remotion";
import { Icone } from "../components/Icone";
import { clamp, pop, useFontes, useFrame } from "../components/motion";
import { ESCALA, Kicker, Revelar, TOPO as TOPO_TITULO, useMargem, useSombra } from "../components/ui";
import { useEstilo } from "../estilos";
import { CenaLinhaTempo } from "../types";

const suave = Easing.bezier(0.65, 0, 0.35, 1);
const TOPO = 500;
const FUNDO = 1180;

// Linha do tempo vertical: a linha desenha-se e cada evento entra quando o "cursor" lá chega
export const LinhaTempo: React.FC<{ cena: CenaLinhaTempo; cor: string }> = ({ cena, cor }) => {
  const MARGEM = useMargem();
  const f = useFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const e = useEstilo();
  const { titulo, corpo } = useFontes();
  const sombra = useSombra();
  const n = cena.eventos.length;
  // os eventos distribuem-se pela duração da cena, para acompanharem a narração
  const chegada = (i: number) => 8 + (i / Math.max(1, n)) * (durationInFrames * 0.75);
  const linha = interpolate(f, [6, chegada(n - 1) + 10], [0, 1], { ...clamp, easing: suave });
  const sTitulo = pop(f, fps, 2, 14);
  const passo = (FUNDO - TOPO) / Math.max(1, n - 1);

  return (
    <AbsoluteFill style={{ color: e.corTexto, fontFamily: corpo }}>
      <div style={{ position: "absolute", top: TOPO_TITULO, left: MARGEM, right: MARGEM, opacity: sTitulo, transform: `translateY(${(1 - sTitulo) * 30}px)` }}>
        <Kicker cor={cor}>Linha do tempo</Kicker>
        <Revelar inicio={4} style={{ marginTop: 18 }}><div style={{ fontFamily: titulo, fontSize: ESCALA.h2, lineHeight: 1.02, textTransform: "uppercase", textShadow: sombra }}>{cena.titulo}</div></Revelar>
      </div>
      <div style={{ position: "absolute", left: 200, top: TOPO, width: 4, height: (FUNDO - TOPO) * linha, background: cor, opacity: 0.6 }} />
      {cena.eventos.map((ev, i) => {
        const s = pop(f, fps, chegada(i), 11);
        const y = TOPO + passo * i;
        return (
          <div key={i}>
            <div style={{ position: "absolute", left: 202 - 16, top: y - 16, width: 32, height: 32, borderRadius: "50%", background: e.fundo, border: `6px solid ${cor}`, transform: `scale(${s})` }} />
            <div style={{ position: "absolute", left: 20, width: 140, top: y - 30, textAlign: "right", fontFamily: titulo, fontSize: 46, color: cor, opacity: s, fontVariantNumeric: "tabular-nums" }}>
              {ev.ano}
            </div>
            <div
              style={{
                position: "absolute", left: 260, right: 60, top: y - 40, display: "flex", gap: 18, alignItems: "center",
                fontSize: 40, fontWeight: 600, lineHeight: 1.2, opacity: s, transform: `translateX(${(1 - s) * 40}px)`,
                background: e.superficie, borderRadius: e.raio, padding: "16px 24px",
                boxShadow: e.sombraInterna ? "inset 0 -10px 22px #0005, inset 0 2px 0 #ffffff14" : undefined,
              }}
            >
              {(ev.icone ?? ev.emoji) && <Icone nome={ev.icone ?? ev.emoji} tamanho={44} cor={cor} traco={2} style={{ flexShrink: 0 }} />}
              <span>{ev.texto}</span>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
