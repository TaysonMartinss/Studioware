import { AbsoluteFill, Easing, interpolate, useVideoConfig } from "remotion";
import { evolvePath } from "@remotion/paths";
import { clamp, pop, useFontes, useFrame } from "../components/motion";
import { ESCALA, Kicker, Revelar, TOPO, useMargem, useSombra } from "../components/ui";
import { useEstilo } from "../estilos";
import { CenaGrafico } from "../types";

const suave = Easing.bezier(0.65, 0, 0.35, 1);
const AREA = { x: 110, y: 520, w: 860, h: 640 };

const formatar = (v: number) => (Math.abs(v) >= 1000 ? v.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }));

// Infográfico limpo estilo explainer: eixos, barras a crescer ou linha a desenhar-se, números a contar
export const Grafico: React.FC<{ cena: CenaGrafico; cor: string }> = ({ cena, cor }) => {
  const MARGEM = useMargem();
  const f = useFrame();
  const { fps } = useVideoConfig();
  const e = useEstilo();
  const { titulo, corpo } = useFontes();
  const max = Math.max(...cena.dados.map((d) => d.valor)) * 1.1 || 1;
  const n = cena.dados.length;
  const sTitulo = pop(f, fps, 2, 14);
  const eixo = interpolate(f, [4, 18], [0, 1], { ...clamp, easing: suave });
  const sombra = useSombra();
  // só a barra em destaque leva a cor; as outras ficam neutras para o olho ir direto a ela
  const corDe = (i: number) =>
    cena.destaque != null ? (i === cena.destaque ? cor : `${e.corTexto}40`) : e.paleta ? e.paleta[i % e.paleta.length] : cor;
  const curva = e.easing ? Easing.bezier(...e.easing) : suave;

  const pontos = cena.dados.map((d, i) => ({
    x: AREA.x + (n === 1 ? AREA.w / 2 : (i / (n - 1)) * AREA.w),
    y: AREA.y + AREA.h - (d.valor / max) * AREA.h,
  }));
  const caminho = pontos.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");
  const progressoLinha = interpolate(f, [14, 14 + 12 * n], [0, 1], { ...clamp, easing: suave });
  const linha = evolvePath(progressoLinha, caminho);

  return (
    <AbsoluteFill style={{ color: e.corTexto, fontFamily: corpo }}>
      <div style={{ position: "absolute", top: TOPO, left: MARGEM, right: MARGEM, opacity: sTitulo, transform: `translateY(${(1 - sTitulo) * 30}px)` }}>
        <Kicker cor={cor}>{cena.unidade ? `Em ${cena.unidade}` : "Os números"}</Kicker>
        <Revelar inicio={4} style={{ marginTop: 18 }}><div style={{ fontFamily: titulo, fontSize: ESCALA.h2, lineHeight: 1.02, textTransform: "uppercase", textShadow: sombra }}>{cena.titulo}</div></Revelar>
      </div>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line key={t} x1={AREA.x} x2={AREA.x + AREA.w * eixo} y1={AREA.y + AREA.h * (1 - t)} y2={AREA.y + AREA.h * (1 - t)} stroke={e.corTexto} strokeOpacity={t === 0 ? 0.6 : 0.12} strokeWidth={t === 0 ? 4 : 2} />
        ))}
        {cena.grafico === "barras" &&
          cena.dados.map((d, i) => {
            const largura = (AREA.w / n) * 0.62;
            const x = AREA.x + (AREA.w / n) * i + ((AREA.w / n) - largura) / 2;
            const p = interpolate(f, [12 + i * 6, 30 + i * 6], [0, 1], { ...clamp, easing: curva });
            const h = (d.valor / max) * AREA.h * p;
            return <rect key={i} x={x} y={AREA.y + AREA.h - h} width={largura} height={h} rx={Math.min(e.raio, 8)} fill={corDe(i)} />;
          })}
        {cena.grafico === "linha" && (
          <>
            {e.area && (
              <path d={`${caminho} L ${pontos[pontos.length - 1].x} ${AREA.y + AREA.h} L ${pontos[0].x} ${AREA.y + AREA.h} Z`} fill={e.area}
                style={{ clipPath: `inset(0 ${100 - progressoLinha * 100}% 0 0)` }} />
            )}
            <path d={caminho} fill="none" stroke={cor} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={linha.strokeDasharray} strokeDashoffset={linha.strokeDashoffset} />
            {pontos.map((p, i) => {
              const s = pop(f, fps, 14 + (12 * n * i) / Math.max(1, n - 1), 10);
              return <circle key={i} cx={p.x} cy={p.y} r={18 * s} fill={e.fundo} stroke={corDe(i)} strokeWidth={8} />;
            })}
          </>
        )}
      </svg>
      {cena.dados.map((d, i) => {
        const largura = AREA.w / n;
        const ini = 12 + i * 6;
        const p = interpolate(f, [ini, ini + 18], [0, 1], { ...clamp, easing: suave });
        const cx = cena.grafico === "barras" ? AREA.x + largura * i + largura / 2 : pontos[i].x;
        const topoValor = cena.grafico === "barras" ? AREA.y + AREA.h - (d.valor / max) * AREA.h * p - 70 : pontos[i].y - 80;
        return (
          <div key={i}>
            <div style={{ position: "absolute", left: cx - 120, width: 240, top: topoValor, textAlign: "center", fontFamily: titulo, fontSize: 48, color: corDe(i), opacity: p }}>
              {formatar(d.valor * p)}{cena.unidade ? <span style={{ fontSize: 28 }}> {cena.unidade}</span> : null}
            </div>
            <div style={{ position: "absolute", left: cx - 120, width: 240, top: AREA.y + AREA.h + 20, textAlign: "center", fontSize: 32, fontWeight: 600, opacity: eixo, lineHeight: 1.1 }}>
              {d.rotulo}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
