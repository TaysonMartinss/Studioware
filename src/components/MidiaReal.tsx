import { AbsoluteFill, Img, Loop, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useEstilo } from "../estilos";
import { Midia } from "../types";
import { clamp, pop, useFrame } from "./motion";
import { useBordaViva } from "./PapelMotion";
import { Em, Sfx } from "./Sfx";
import { useWiggle } from "./ui";
import { Objeto3D } from "./Objeto3D";

export const Conteudo: React.FC<{ midia: Midia; estilo: React.CSSProperties }> = ({ midia, estilo }) => {
  const { fps } = useVideoConfig();
  // modelo 3D: gira no espaço da mídia (o objectFit e os filtros de foto não se aplicam)
  if (midia.formato === "modelo3d") {
    const { objectFit, filter, ...resto } = estilo;
    return <Objeto3D arquivo={midia.arquivo!} style={resto} />;
  }
  const src = staticFile(midia.arquivo!);
  if (midia.formato !== "video") return <Img src={src} style={estilo} />;
  const inicio = Math.round((midia.inicioS ?? 0) * fps);
  const video = <OffthreadVideo src={src} muted trimBefore={inicio} style={estilo} />;
  const util = midia.duracaoS ? Math.floor((midia.duracaoS - (midia.inicioS ?? 0)) * fps) : 0;
  // b-roll mais curto que a cena: repete em loop
  return util > fps ? <Loop durationInFrames={util} layout="none">{video}</Loop> : video;
};

// Fundo de ecrã inteiro: a mesma mídia desfocada e escurecida, para preencher o 9:16
export const MidiaFundo: React.FC<{ midia?: Midia; opacidade?: number; desfoque?: number }> = ({ midia, opacidade = 0.45, desfoque = 40 }) => {
  const f = useCurrentFrame();
  const e = useEstilo();
  const { width: L, height: A } = useVideoConfig();
  if (!midia?.arquivo) return null;
  // modelo 3D de fundo: muito desfocado não se vê (a cena mostra-o nítido no cartão); pouco desfocado, gira em ecrã inteiro
  if (midia.formato === "modelo3d" && desfoque >= 20) return null;
  if (midia.formato === "modelo3d" && e.tema !== "mundo3d") {
    return (
      <AbsoluteFill style={{ opacity: Math.min(1, opacidade + 0.3) }}>
        {/* no vertical o título ocupa o terço de cima: o objeto fica no meio-baixo, para não ficar tapado */}
        <Objeto3D arquivo={midia.arquivo} style={A > L ? { position: "absolute", left: 0, right: 0, top: "40%", height: "44%" } : { width: "100%", height: "100%" }} />
        <AbsoluteFill style={{ background: e.tema === "claro" ? "linear-gradient(180deg, #ffffffcc, #fff0 30%, #fff0 70%, #ffffffcc)" : "linear-gradient(180deg, #000b, #0000 30%, #0000 65%, #000c)" }} />
      </AbsoluteFill>
    );
  }
  // no mundo 3D a mídia não tapa o cenário: é um ecrã suspenso no estúdio, com reflexo no chão
  if (e.tema === "mundo3d")
    return (
      <div style={{ position: "absolute", left: 96, right: 96, top: 380, height: 700, perspective: 1600 }}>
        <div
          style={{
            width: "100%", height: "100%", borderRadius: e.raio, overflow: "hidden", opacity: Math.min(1, opacidade + 0.25),
            transform: `rotateY(${Math.sin(f / 60) * 4}deg) rotateX(3deg)`, boxShadow: `0 40px 90px #000c, 0 0 0 1px #ffffff1f`,
            WebkitBoxReflect: "below 18px linear-gradient(transparent 72%, #ffffff24)",
          } as React.CSSProperties}
        >
          <Conteudo midia={midia} estilo={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${1.05 + f * 0.0005})` }} />
          <AbsoluteFill style={{ background: "linear-gradient(180deg, #0000 55%, #000a)" }} />
        </div>
      </div>
    );
  return (
    <AbsoluteFill style={{ opacity: opacidade, overflow: "hidden" }}>
      <Conteudo
        midia={midia}
        estilo={{ width: "100%", height: "100%", objectFit: "cover", filter: `blur(${desfoque}px) saturate(1.3)`, transform: `scale(${1.25 + f * 0.0006})` }}
      />
      {/* em estilos de fundo claro o véu é branco, para o texto escuro continuar legível */}
      <AbsoluteFill style={{ background: e.tema === "claro" ? "linear-gradient(180deg, #ffffffee, #ffffffaa 40%, #ffffffee)" : "linear-gradient(180deg, #000c, #0006 40%, #000d)" }} />
    </AbsoluteFill>
  );
};

// Cartão com a mídia nítida: entra com pop, Ken Burns lento. A moldura muda com o estilo:
// papel = foto polaroid com fita-cola e bordas rasgadas; hud = cantos em colchete e linha de scan; resto = brilho na cor
export const MidiaCartao: React.FC<{ midia?: Midia; cor: string; top: number; altura: number; atraso?: number }> = ({
  midia, cor, top, altura, atraso = 4,
}) => {
  const f = useFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const e = useEstilo();
  if (!midia?.arquivo) return null;
  const s = pop(f, fps, atraso, 12);
  const kenBurns = interpolate(f, [0, durationInFrames], [1.04, 1.16], clamp);
  const lado = (midia.consulta?.length ?? 0) % 2 ? 1 : -1;
  const papel = e.tema === "papel";
  const borda = useBordaViva();
  const hud = e.tema === "hud";
  const claro = e.tema === "claro";
  const jornal = e.textura === "jornal";
  const aquarela = e.textura === "aquarela";

  const moldura: React.CSSProperties = papel
    ? { background: "#fffdf6", padding: "22px 22px 70px", clipPath: borda(`polaroid${midia.arquivo}`, 1.2) }
    : hud
      ? { border: `2px solid ${cor}88`, boxShadow: `0 0 40px ${cor}44, inset 0 0 40px ${cor}33` }
      : aquarela
        ? { background: "#fbf7ec", padding: 18, clipPath: borda(`aguarela${midia.arquivo}`, 0.9, 40), filter: "drop-shadow(0 10px 14px #6b4a2a33)" }
      : jornal
        ? { borderRadius: 2, boxShadow: "12px 14px 0 #16151330", border: "6px solid #fffdf6", outline: `3px solid ${e.corTexto}` }
      : claro
        ? { borderRadius: e.raio, boxShadow: "0 30px 70px #0f172a33", border: "8px solid #fff" }
        : e.brilho && e.glowRaio
          ? { borderRadius: e.raio, boxShadow: `0 0 ${e.glowRaio}px ${cor}${Math.round((e.glowForca ?? 0.35) * 255).toString(16).padStart(2, "0")}, 0 30px 60px #000a` }
        : e.brilho
          ? { borderRadius: e.raio, border: `2px solid ${cor}`, boxShadow: `0 0 40px ${cor}55, 0 30px 60px #000a` }
          : { borderRadius: e.raio, boxShadow: "0 30px 70px #000b" };
  const giro = papel ? -2.5 * lado : jornal ? 0.6 * lado : 0;
  const w = useWiggle(`polaroid${midia.arquivo}`, 10);

  return (
    <div
      style={{
        position: "absolute", top, left: e.margem ?? 72, right: e.margem ?? 72, height: altura, ...moldura,
        transform: `translate(${w.x}px, ${(1 - s) * 300 + w.y}px) scale(${0.7 + 0.3 * s}) rotate(${(1 - s) * 8 * lado + giro + w.r}deg)`,
        filter: papel ? "drop-shadow(7px 7px 1px rgba(0,0,0,0.4))" : undefined,
        opacity: Math.min(1, s * 1.5),
      }}
    >
      <div style={{ width: "100%", height: "100%", overflow: "hidden", borderRadius: papel || hud ? 0 : Math.max(0, e.raio - 2), position: "relative" }}>
        <div style={{ width: "100%", height: "100%", transform: `scale(${kenBurns}) translateX(${lado * (kenBurns - 1) * 120}px)` }}>
          <Conteudo midia={midia} estilo={{ width: "100%", height: "100%", objectFit: "cover", filter: e.tema === "synthwave" ? "saturate(1.4) contrast(1.1)" : jornal ? "grayscale(0.85) contrast(1.25) sepia(0.25)" : aquarela ? `url(#aquarela-${f % 9 < 3 ? 0 : f % 9 < 6 ? 1 : 2})` : undefined }} />
        </div>
        {/* editorial: a foto "impressa" em meio-tom (pontos de tinta por cima, em multiply) */}
        {jornal && <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(#161513 28%, transparent 31%)", backgroundSize: "7px 7px", mixBlendMode: "multiply", opacity: 0.32 }} />}
        {hud && <div style={{ position: "absolute", left: 0, right: 0, top: `${(f * 2.5) % 100}%`, height: 3, background: cor, boxShadow: `0 0 20px ${cor}`, opacity: 0.7 }} />}
        {midia.credito && (
          <div style={{ position: "absolute", right: 14, bottom: 10, fontSize: 20, color: "#fffc", fontFamily: "sans-serif", letterSpacing: "0.04em", background: "#0008", padding: "4px 10px", borderRadius: 4 }}>
            {midia.credito}
          </div>
        )}
      </div>
      {/* cada foto nova entra com o som de papel a rasgar */}
      {papel && <Em de={atraso} dur={14}><Sfx nome="rasgo" volume={0.35} /></Em>}
      {papel && (
        <div style={{ position: "absolute", top: -26, left: "38%", width: 220, height: 56, background: "#f6e7a8cc", transform: `rotate(${4 * lado}deg)`, boxShadow: "0 2px 6px #0003" }} />
      )}
      {hud && [
        { top: -14, left: -14, borderTop: 6, borderLeft: 6 }, { top: -14, right: -14, borderTop: 6, borderRight: 6 },
        { bottom: -14, left: -14, borderBottom: 6, borderLeft: 6 }, { bottom: -14, right: -14, borderBottom: 6, borderRight: 6 },
      ].map(({ borderTop, borderLeft, borderRight, borderBottom, ...pos }, i) => (
        <div key={i} style={{ position: "absolute", width: 70, height: 70, ...pos, borderStyle: "solid", borderColor: cor, borderWidth: `${borderTop ?? 0}px ${borderRight ?? 0}px ${borderBottom ?? 0}px ${borderLeft ?? 0}px` }} />
      ))}
    </div>
  );
};
