import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from "remotion";
import { Estilo, useEstilo } from "../estilos";
import { FONTES } from "./motion";

// Camadas por cima de tudo (exceto legendas): textura, fita VHS, interface HUD

const Grao: React.FC<{ f: number; opacidade: number; mistura?: React.CSSProperties["mixBlendMode"] }> = ({ f, opacidade, mistura = "overlay" }) => (
  <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: opacidade, mixBlendMode: mistura }}>
    <filter id={`grao${f % 6}`}>
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={f % 6} />
    </filter>
    <rect width="100%" height="100%" filter={`url(#grao${f % 6})`} />
  </svg>
);

const Scan: React.FC<{ f: number }> = ({ f }) => (
  <AbsoluteFill
    style={{
      backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0 2px, transparent 2px 5px)",
      backgroundPosition: `0 ${f % 5}px`,
    }}
  />
);

const Vhs: React.FC<{ f: number; e: Estilo }> = ({ f, e }) => {
  const { fps } = useVideoConfig();
  // faixa de tracking de 20px que sobe do fundo ao topo em ~1,5 s, a cada 4,5 s
  const ciclo = (f / fps) % 4.5;
  const banda = ciclo < 1.5 ? 1920 - (ciclo / 1.5) * 1960 : -100;
  const s = Math.floor(f / fps);
  const tempo = `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const ondula = (random(`vt${f}`) - 0.5) * 24;
  return (
    <AbsoluteFill style={{ fontFamily: FONTES.vt323, color: "#fff" }}>
      {/* scanlines CRT: 1px preto / 1px transparente a 15% */}
      <AbsoluteFill style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0 1px, transparent 1px 2px)" }} />
      {/* tracking: banda distorcida (desfoque + deslocamento) a subir */}
      <div style={{ position: "absolute", left: -20, right: -20, top: banda, height: 20, backdropFilter: "blur(2px) brightness(1.5) saturate(0.4)", transform: `translateX(${ondula}px) skewX(${ondula / 4}deg)`, background: "#ffffff14" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: banda + 8, height: 3, background: "#ffffff55", filter: "blur(1px)" }} />
      <Grao f={f} opacidade={0.3} />
      <AbsoluteFill style={{ boxShadow: "inset 0 0 220px #000" }} />
      {/* interface de gravador: PLAY verde em cima à esquerda, contador SP em cima à direita, REC a piscar em baixo */}
      <div style={{ position: "absolute", top: 70, left: 60, fontSize: 64, color: "#00ff00", textShadow: "0 0 8px #00ff0088" }}>PLAY ▶</div>
      <div style={{ position: "absolute", top: 70, right: 60, fontSize: 60 }}>SP {tempo}</div>
      <div style={{ position: "absolute", bottom: 90, left: 60, fontSize: 60, display: "flex", gap: 14, alignItems: "center" }}>
        REC <span style={{ color: "#ff2b2b", opacity: f % fps < fps / 2 ? 1 : 0 }}>●</span>
      </div>
    </AbsoluteFill>
  );
};

// anel dividido em segmentos de N graus (com uma folga entre eles)
const Anel: React.FC<{ r: number; cor: string; rot: number; segmento: number; folga?: number; largura?: number }> = ({ r, cor, rot, segmento, folga = 4, largura = 3 }) => {
  const c = 2 * Math.PI * r;
  return <circle r={r} fill="none" stroke={cor} strokeWidth={largura} strokeDasharray={`${(c * segmento) / 360} ${(c * folga) / 360}`} transform={`rotate(${rot})`} />;
};

// régua de precisão: marca a cada 5px, maior a cada 25px
const Regua: React.FC<{ cor: string; lado: "left" | "right" }> = ({ cor, lado }) => (
  <div style={{
    position: "absolute", top: 260, bottom: 260, [lado]: 28, width: 22, opacity: 0.55,
    backgroundImage: `repeating-linear-gradient(180deg, ${cor} 0 1px, transparent 1px 5px), repeating-linear-gradient(180deg, ${cor} 0 2px, transparent 2px 25px)`,
    backgroundSize: "10px 100%, 22px 100%", backgroundRepeat: "no-repeat", backgroundPosition: lado === "left" ? "0 0, 0 0" : "12px 0, 0 0",
  }} />
);

const Hud: React.FC<{ f: number; e: Estilo }> = ({ f, e }) => {
  const { fps } = useVideoConfig();
  const scan = (f * 14) % 2100 - 100;
  const t = f / fps;
  // anel interno +45°/s, intermédio −20°/s, externo +90°/s aos impulsos (roda 90° em 0,35 s e pára)
  const interno = t * 45;
  const medio = -t * 20;
  const impulso = Math.min(1, (t % 1) / 0.35);
  const externo = 90 * Math.floor(t) + 90 * (impulso < 0.5 ? 2 * impulso * impulso : 1 - Math.pow(-2 * impulso + 2, 2) / 2);
  // números a correr: novos valores a cada frame
  const dado = (k: string, min: number, max: number) => (min + random(`${k}${f}`) * (max - min)).toFixed(2);
  const canto = (estilo: React.CSSProperties) => (
    <div style={{ position: "absolute", width: 90, height: 90, borderColor: e.cor, borderStyle: "solid", borderWidth: 0, ...estilo }} />
  );
  return (
    <AbsoluteFill style={{ fontFamily: FONTES.mono, color: e.cor, mixBlendMode: "screen" }}>
      {canto({ top: 40, left: 40, borderTopWidth: 5, borderLeftWidth: 5 })}
      {canto({ top: 40, right: 40, borderTopWidth: 5, borderRightWidth: 5 })}
      {canto({ bottom: 40, left: 40, borderBottomWidth: 5, borderLeftWidth: 5 })}
      {canto({ bottom: 40, right: 40, borderBottomWidth: 5, borderRightWidth: 5 })}
      <Regua cor={e.cor} lado="left" />
      <Regua cor={e.cor} lado="right" />
      {/* periferia ligeiramente desfocada: parece um holograma com profundidade de campo */}
      <svg width={360} height={360} viewBox="-180 -180 360 360" style={{ position: "absolute", right: -60, bottom: 260, opacity: 0.6, filter: "blur(1.5px)" }}>
        <Anel r={164} cor={e.cor} rot={externo} segmento={90} folga={8} largura={3} />
        <Anel r={132} cor={e.cor2} rot={medio} segmento={45} folga={6} largura={8} />
        <Anel r={100} cor={e.cor} rot={interno} segmento={15} folga={3} largura={2} />
        <line x1={-180} y1={0} x2={180} y2={0} stroke={e.cor} strokeWidth={1} opacity={0.6} />
        <line x1={0} y1={-180} x2={0} y2={180} stroke={e.cor} strokeWidth={1} opacity={0.6} />
      </svg>
      <svg width={260} height={260} viewBox="-130 -130 260 260" style={{ position: "absolute", left: -40, top: 140, opacity: 0.5, filter: "blur(1.5px)" }}>
        <Anel r={112} cor={e.cor} rot={-externo} segmento={45} folga={6} />
        <Anel r={82} cor={e.cor2} rot={interno * 1.5} segmento={90} folga={10} largura={6} />
      </svg>
      <div style={{ position: "absolute", left: 64, bottom: 110, fontSize: 28, lineHeight: 1.4, opacity: 0.85, filter: "blur(0.6px)" }}>
        <div>CLK {dado("clk", 100, 999)} GHZ</div>
        <div>TEMP {dado("tmp", 40, 90)} °C</div>
        <div>NET {dado("net", 100, 999)} MB/S</div>
      </div>
      <div style={{ position: "absolute", right: 70, top: 110, fontSize: 28, textAlign: "right", opacity: 0.8 }}>
        SCAN {String(Math.min(100, Math.floor((f % 90) * 1.2))).padStart(3, "0")}%
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: scan, height: 3, background: e.cor, boxShadow: `0 0 20px ${e.cor}`, opacity: 0.35 }} />
      <AbsoluteFill style={{ backgroundImage: `repeating-linear-gradient(0deg, ${e.cor}08 0 1px, transparent 1px 4px)` }} />
    </AbsoluteFill>
  );
};

export const Overlay: React.FC = () => {
  const f = useCurrentFrame();
  const e = useEstilo();
  if (!e.overlay) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {e.overlay === "scan" && <Scan f={f} />}
      {e.overlay === "vhs" && <Vhs f={f} e={e} />}
      {e.overlay === "hud" && <Hud f={f} e={e} />}
      {e.overlay === "papel" && <Grao f={Math.floor(f / e.passo)} opacidade={0.4} mistura="multiply" />}
      {e.overlay === "grao" && <Grao f={f} opacidade={0.12} />}
    </AbsoluteFill>
  );
};
