import { AbsoluteFill, Easing, Sequence, interpolate, useVideoConfig } from "remotion";
import { Sfx } from "../components/Sfx";
import { FONTES, pop, useFrame } from "../components/motion";
import { CenaDado } from "../types";
import { Decoracoes } from "./Decoracoes";
import { useEstilo } from "../estilos";
import { CEU_VICE, FundoVice, VICE } from "../components/Vice";

// Dado em formato editorial (quando alguém cita um número): papel milimétrico, rótulo em serifa itálica, o número
// enorme a contar e, se houver, um gráfico de barras a crescer (o destaque a vermelho). Câmara sempre em movimento
// (zoom lento e deriva lateral) e som: woosh na entrada e um impacto quando o número chega ao valor.
export const PAPEL = "#ecebe7", TINTA = "#111111", VERMELHO = "#e5332a";

// paleta das cenas editoriais: papel, tinta e vermelho; no estilo Vice, céu ao pôr do sol, branco e amarelo-sol
export const usePaleta = () => {
  const vice = useEstilo().tema === "vice";
  return vice
    ? { vice, fundo: CEU_VICE, tinta: VICE.tinta, destaque: VICE.destaque, grelha: false, sombra: `0 6px 0 ${VICE.sombra}` }
    : { vice, fundo: PAPEL, tinta: TINTA, destaque: VERMELHO, grelha: true, sombra: "none" };
};

const formatar = (v: number, casas: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

export const DadoEditorial: React.FC<{ cena: CenaDado }> = ({ cena }) => {
  const f = useFrame();
  const { fps, width: L, height: A, durationInFrames: d } = useVideoConfig();
  const P = usePaleta();
  const casas = Number.isInteger(cena.valor) ? 0 : 1;
  const conta = interpolate(f, [4, 4 + fps * 1.1], [0, cena.valor], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const sRotulo = pop(f, fps, 0, 10);
  const barras = (cena.barras ?? []).slice(0, 6);
  const maximo = Math.max(1, ...barras.map((b) => b.valor));
  const destaque = cena.destaque ?? (barras.length ? barras.length - 1 : -1);
  // o número e o sufixo (a 42% do tamanho) cabem numa linha
  const largura = `${cena.prefixo ?? ""}${formatar(cena.valor, casas)}`.length * 0.6 + (cena.sufixo ?? "").length * 0.6 * 0.42;
  const tamanho = Math.min(300, (L * 0.86) / Math.max(1.8, largura));
  // câmara: zoom lento para dentro e deriva lateral
  const camara = `scale(${interpolate(f, [0, d], [1.02, 1.1])}) translateX(${interpolate(f, [0, d], [-14, 14])}px)`;

  return (
    <AbsoluteFill style={{ background: P.fundo, overflow: "hidden" }}>
      <Sequence from={0} durationInFrames={Math.round(fps)} layout="none"><Sfx nome="whoosh" volume={0.38} /></Sequence>
      <Sequence from={Math.round(4 + fps * 1.1)} durationInFrames={Math.round(fps)} layout="none"><Sfx nome="impacto" volume={0.25} /></Sequence>
      <AbsoluteFill style={{ transform: camara }}>
        {P.vice && <FundoVice />}
        {P.grelha && <AbsoluteFill style={{ backgroundImage: "linear-gradient(#0000002e 2px, transparent 2px), linear-gradient(90deg, #0000002e 2px, transparent 2px)", backgroundSize: "60px 60px", filter: "blur(1px)" }} />}
        <Decoracoes bloco={7} inicio={0} f={f} fps={fps} L={L} A={A} tinta={P.tinta} cor={P.destaque} quantos={5} evitar={[A * 0.2, A * 0.8]} />
        <div style={{ position: "absolute", left: 70, right: 70, top: A * (barras.length ? 0.2 : 0.32), color: P.tinta, textAlign: "left" }}>
          <div style={{ fontFamily: FONTES.mono, fontSize: 26, letterSpacing: "0.22em", opacity: 0.55 * sRotulo }}>DADO ——</div>
          <div style={{ fontFamily: FONTES.inter, fontWeight: 900, fontSize: tamanho, lineHeight: 1, letterSpacing: "-0.05em", marginTop: 18, whiteSpace: "nowrap", ...(P.vice ? { fontFamily: FONTES.anton, fontWeight: 400, fontStyle: "italic", letterSpacing: "0.01em", textShadow: P.sombra } : {}) }}>
            {cena.prefixo}{formatar(conta, casas)}<span style={{ fontSize: tamanho * 0.42, letterSpacing: "-0.02em", color: P.destaque }}>{cena.sufixo}</span>
          </div>
          <div style={{ fontFamily: FONTES.serif, fontStyle: "italic", fontSize: 64, lineHeight: 1.1, marginTop: 14, opacity: sRotulo, transform: `translateY(${(1 - sRotulo) * 16}px)` }}>{cena.rotulo}</div>
        </div>
        {barras.length > 0 && (
          <div style={{ position: "absolute", left: 90, right: 90, top: A * 0.56, height: A * 0.26, display: "flex", alignItems: "flex-end", gap: 26, borderBottom: `3px solid ${P.tinta}` }}>
            {barras.map((b, i) => {
              const s = interpolate(f, [10 + i * 5, 10 + i * 5 + fps * 0.6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
              return (
                <div key={i} style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                  <div style={{ fontFamily: FONTES.mono, fontSize: 24, color: P.tinta, opacity: s, marginBottom: 8 }}>{b.formato ?? formatar(b.valor, Number.isInteger(b.valor) ? 0 : 1)}</div>
                  <div style={{ width: "100%", height: `${(b.valor / maximo) * 82 * s}%`, background: i === destaque ? P.destaque : P.tinta }} />
                  <div style={{ position: "absolute", bottom: -44, fontFamily: FONTES.mono, fontSize: 22, letterSpacing: "0.1em", color: P.tinta, opacity: 0.7 }}>{b.rotulo}</div>
                </div>
              );
            })}
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
