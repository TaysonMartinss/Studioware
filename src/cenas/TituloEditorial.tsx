import { AbsoluteFill, Easing, Sequence, interpolate, random, useVideoConfig } from "remotion";
import { Camara3D, DesfoqueMovimento } from "../aprendidos/_kit";
import { Conteudo } from "../components/MidiaReal";
import { Sfx } from "../components/Sfx";
import { FundoVice } from "../components/Vice";
import { FONTES, useFrame } from "../components/motion";
import { Midia } from "../types";
import { usePaleta } from "./DadoEditorial";
import { Decoracoes } from "./Decoracoes";

// Título editorial (gancho e fecho nos estilos Editorial e Vice): cada palavra sobe por trás de uma máscara, uma a uma,
// a parte de antes em serifa itálica, a palavra-chave enorme e pesada com o sublinhado desenhado e o resto pequeno.
// A câmara entra com um empurrão 3D e motion blur e depois avança devagar; o objeto do gancho flutua por cima.
const limpar = (t: string) => t.replace(/[.,;:!?…"]+$/g, "");

export const TituloEditorial: React.FC<{ texto: string; objeto?: Midia; rodape?: React.ReactNode; kicker?: string }> = ({ texto, objeto, rodape, kicker }) => {
  const f = useFrame();
  const { fps, width: L, height: A, durationInFrames: d } = useVideoConfig();
  const P = usePaleta();
  const palavras = texto.trim().split(/\s+/).filter(Boolean);
  // palavra-chave: a mais comprida (no fecho costuma ser a pergunta; no gancho, o assunto)
  const k = palavras.reduce((m, p, i) => (limpar(p).length >= limpar(palavras[m]).length ? i : m), 0);
  const antes = palavras.slice(0, k), chave = limpar(palavras[k] ?? ""), depois = palavras.slice(k + 1);
  const PASSO = Math.round(fps * 0.12); // intervalo entre palavras
  const quando = (i: number) => 6 + i * PASSO; // frame em que a palavra i entra
  const sobe = (i: number) => interpolate(f, [quando(i), quando(i) + 9], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const tamanho = Math.min(210, (L * 0.8) / (Math.max(4, chave.length) * 0.62));
  const temObjeto = Boolean(objeto?.arquivo);

  // câmara: empurrão de entrada (0,5 s) com motion blur e avanço lento até ao fim
  const z = (q: number) => interpolate(q, [0, 15], [-260, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }) + interpolate(q, [15, d], [0, 70], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = (q: number) => interpolate(q, [0, 15], [140, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const vy = y(f) - y(f - 1) + (z(f) - z(f - 1)) * 0.25;

  // máscara: a palavra sobe de baixo de uma linha invisível
  const palavra = (p: string, i: number, estilo: React.CSSProperties, chaveReact: number) => (
    <span key={chaveReact} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom", paddingBottom: "0.08em" }}>
      <span style={{ display: "inline-block", transform: `translateY(${sobe(i) * 110}%)`, ...estilo }}>{p}</span>
    </span>
  );
  const linha = (ws: string[], ini: number, estilo: React.CSSProperties) => (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 0.34em" }}>
      {ws.map((p, j) => palavra(p.toLowerCase(), ini + j, estilo, j))}
    </div>
  );
  const sublinhado = interpolate(f, [quando(k) + 6, quando(k) + 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });

  return (
    <AbsoluteFill style={{ background: P.vice ? "#1a0a2e" : P.fundo }}>
      <Sequence from={0} durationInFrames={fps} layout="none"><Sfx nome="whoosh" volume={0.4} /></Sequence>
      <Sequence from={quando(k)} durationInFrames={fps} layout="none"><Sfx nome="clique" volume={0.32} /></Sequence>
      <DesfoqueMovimento vy={vy}>
        <Camara3D z={z(f)} y={-y(f)}>
          {/* plano do fundo */}
          <div style={{
            position: "absolute", left: -L * 0.6, right: -L * 0.6, top: -A * 0.6, bottom: -A * 0.6, transform: "translateZ(-500px)",
            backgroundColor: P.vice ? "#1a0a2e" : P.fundo,
            ...(P.grelha ? { backgroundImage: "linear-gradient(#0000002e 2px, transparent 2px), linear-gradient(90deg, #0000002e 2px, transparent 2px)", backgroundSize: "60px 60px", filter: "blur(1.2px)" } : {}),
          }} />
          {P.vice && <div style={{ position: "absolute", inset: 0, transform: "translateZ(-380px) scale(1.3)" }}><FundoVice /></div>}
          <Decoracoes bloco={99} inicio={4} f={f} fps={fps} L={L} A={A} tinta={P.tinta} cor={P.destaque} evitar={[A * 0.36, A * 0.78]} />
          {temObjeto && (
            <div style={{ position: "absolute", left: L * 0.18, width: L * 0.64, top: A * 0.06, height: A * 0.3, transform: `translateZ(160px) translateY(${Math.sin(f / 22) * 12}px)`, filter: "drop-shadow(0 34px 36px #0000004d)", opacity: interpolate(f, [4, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
              <Conteudo midia={objeto!} estilo={{ width: "100%", height: "100%", objectFit: "contain", background: "none" }} />
            </div>
          )}
          <div style={{ position: "absolute", left: 70, right: 70, top: temObjeto ? A * 0.4 : A * 0.3, textAlign: "center", color: P.tinta, transformStyle: "preserve-3d" }}>
            <div style={{ fontFamily: FONTES.mono, fontSize: 26, letterSpacing: "0.22em", opacity: 0.55 * (1 - sobe(0)), marginBottom: 20 }}>{kicker ?? "001"} ——</div>
            {antes.length > 0 && linha(antes, 0, { fontFamily: FONTES.serif, fontStyle: "italic", fontSize: 80, lineHeight: 1.05, textShadow: P.vice ? P.sombra : undefined })}
            <div style={{ overflow: "hidden", paddingBottom: "0.06em", margin: "6px 0" }}>
              <div style={{
                transform: `translateY(${sobe(k) * 110}%)`, fontFamily: FONTES.inter, fontWeight: 900, fontSize: tamanho, lineHeight: 1, letterSpacing: "-0.05em", whiteSpace: "nowrap",
                ...(P.vice ? { fontFamily: FONTES.anton, fontWeight: 400, fontStyle: "italic", textTransform: "uppercase", letterSpacing: "0.01em", color: P.destaque, textShadow: P.sombra } : {}),
              }}>{P.vice ? chave : chave.toLowerCase()}</div>
            </div>
            <svg width={L - 140} height={30} style={{ display: "block", marginTop: -10 }}>
              <path d={`M ${L * 0.3} 14 Q ${L * 0.4} ${6 + random(`tt${texto}`) * 14} ${L * 0.58} 12`} stroke={P.destaque} strokeWidth={7} fill="none" strokeLinecap="round"
                strokeDasharray={L * 0.32} strokeDashoffset={L * 0.32 * (1 - sublinhado)} />
            </svg>
            {depois.length > 0 && linha(depois, k + 1, { fontFamily: FONTES.serif, fontStyle: "italic", fontSize: 58, lineHeight: 1.1, opacity: 0.85, textShadow: P.vice ? P.sombra : undefined })}
          </div>
        </Camara3D>
      </DesfoqueMovimento>
      {rodape && <div style={{ position: "absolute", left: 0, right: 0, top: A * 0.8, display: "flex", justifyContent: "center" }}>{rodape}</div>}
    </AbsoluteFill>
  );
};
