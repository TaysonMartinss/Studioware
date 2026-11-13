import { Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { FONTES, clamp } from "./motion";
import CANAIS from "../canais.json";

// Marca d'água do canal em todos os vídeos. Muda de canto a cada 12 s (com um fade curto),
// para quem reposta não conseguir cortá-la com um único recorte. As posições evitam a barra
// de cima e os botões/legenda das plataformas (Shorts, Reels, TikTok).
// os canais estão em src/canais.json (logo em public/marca/); o roteiro escolhe com "canal"
type Canal = { nome: string; arroba: string; logo: string; pixelado?: boolean; redonda?: boolean };
export const CANAL_PADRAO = "duckexplica";
// canal apagado ou desconhecido: o padrão, ou o primeiro que exista (os canais criam-se e apagam-se no painel)
export const canalDe = (id?: string): Canal => {
  const todos = CANAIS as Record<string, Canal>;
  return todos[id ?? CANAL_PADRAO] ?? todos[CANAL_PADRAO] ?? Object.values(todos)[0];
};
const OPACIDADE = 0.6;
// no 16:9 (YouTube) fica nos cantos da direita: o da esquerda tem o capítulo atual e o rodapé tem as legendas
const POSICOES_16x9: React.CSSProperties[] = [
  { top: 40, right: 48 },
  { bottom: 180, right: 48 },
];
const POSICOES: React.CSSProperties[] = [
  { top: 104, left: 44 },
  { top: 1180, left: 44 }, // entre o cartão da mídia (até ~1170) e a legenda (1230), longe do centro
  { top: 104, right: 150 },
];
const TROCA = 12 * 30;
const FADE = 10;

export const MarcaDagua: React.FC<{ canal?: string }> = ({ canal }) => {
  const marca = canalDe(canal);
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const posicoes = width > height ? POSICOES_16x9 : POSICOES;
  const n = Math.floor(f / TROCA);
  const local = f - n * TROCA;
  const visivel = interpolate(local, [0, FADE, TROCA - FADE, TROCA], [n === 0 ? 1 : 0, 1, 1, 0], clamp);
  return (
    <div
      style={{
        position: "absolute", ...posicoes[n % posicoes.length], display: "flex", alignItems: "center", gap: 10,
        padding: "6px 16px 6px 8px", borderRadius: 999, background: "#0000004d",
        opacity: OPACIDADE * visivel, pointerEvents: "none",
      }}
    >
      {/* logo opaca (o fundo não saiu): recortada em círculo, do tamanho da pílula, em vez de um quadrado */}
      <Img src={staticFile(marca.logo)} style={marca.redonda
        ? { width: 46, height: 46, borderRadius: "50%", objectFit: "cover", imageRendering: marca.pixelado ? "pixelated" : "auto" }
        : { height: 46, imageRendering: marca.pixelado ? "pixelated" : "auto" }} />
      <span style={{ fontFamily: FONTES.inter, fontWeight: 800, fontSize: 28, color: "#fff", letterSpacing: "-0.01em", textShadow: "0 2px 6px #0008" }}>{marca.arroba}</span>
    </div>
  );
};
