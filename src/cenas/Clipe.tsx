import { AbsoluteFill, OffthreadVideo, Sequence, staticFile, useVideoConfig } from "remotion";
import { MidiaCartao } from "../components/MidiaReal";
import { pop, useFontes, useFrame } from "../components/motion";
import { useEstilo } from "../estilos";
import { CenaClipe } from "../types";

// Vídeo gravado por si (já cortado pelo Auto-Editor). Vertical ocupa o ecrã todo; horizontal fica ao centro com fundo desfocado.
export const Clipe: React.FC<{ cena: CenaClipe; cor: string }> = ({ cena, cor }) => {
  const f = useFrame();
  const { fps, width: L, height: A } = useVideoConfig();
  const e = useEstilo();
  const { titulo } = useFontes();
  if (!cena.arquivo) return <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", color: e.corTexto, fontSize: 40 }}>(clipe ainda não processado)</AbsoluteFill>;
  const src = staticFile(cena.arquivo);
  const enq = cena.enquadramento;
  const seguir = enq?.modo === "seguir" && enq.xs?.length && enq.cropLargura;
  const horizontal = !seguir && (cena.largura ?? 9) > (cena.altura ?? 16);
  const s = pop(f, fps, 3, 14);
  // frases = palavras até à pontuação final; cada frase nova alterna entre plano normal e plano 8% mais fechado
  const ms = (f / fps) * 1000;
  const inicios = (cena.palavras ?? []).filter((p, k, arr) => k === 0 || /[.!?]$/.test(arr[k - 1].texto)).map((p) => p.inicioMs);
  const frase = inicios.filter((t) => t <= ms).length;
  const zoom = frase % 2 === 0 ? 1.08 : 1;

  return (
    <AbsoluteFill>
      {seguir ? (
        // enquadramento automático: o vídeo enche a altura e desliza para o x do corte deste frame
        (() => {
          const k = A / enq!.altura, i = Math.min(enq!.xs!.length - 1, Math.max(0, Math.round((f / fps) * enq!.fps)));
          const escalaCorte = L / (enq!.cropLargura! * k);
          return (
            <AbsoluteFill style={{ overflow: "hidden", transform: `scale(${zoom * escalaCorte})`, transformOrigin: "50% 35%" }}>
              <OffthreadVideo src={src} style={{ position: "absolute", top: 0, left: -enq!.xs![i] * k, height: A, width: enq!.largura * k, maxWidth: "none" }} />
            </AbsoluteFill>
          );
        })()
      ) : horizontal ? (
        <>
          <OffthreadVideo src={src} muted style={{ width: "100%", height: "100%", objectFit: "cover", filter: "blur(40px) brightness(0.5)", transform: "scale(1.2)" }} />
          <AbsoluteFill style={{ justifyContent: "center", padding: "0 0 380px" }}>
            <OffthreadVideo src={src} style={{ width: "100%", borderRadius: 0, boxShadow: `0 0 60px ${cor}44` }} />
          </AbsoluteFill>
        </>
      ) : (
        <OffthreadVideo src={src} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${zoom})`, transformOrigin: "50% 35%" }} />
      )}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, #0008, transparent 22%, transparent 60%, #000a)" }} />
      {cena.titulo && (
        <div style={{ position: "absolute", top: 160, left: 60, right: 60, fontFamily: titulo, fontSize: 80, color: "#fff", textTransform: "uppercase", textShadow: "0 6px 0 #000", opacity: s, transform: `translateY(${(1 - s) * 30}px)` }}>
          {cena.titulo}
        </div>
      )}
      {(cena.broll ?? []).map((b, i) => {
        const ini = Math.round((b.inicioMs / 1000) * fps);
        return (
          <Sequence key={i} from={ini} durationInFrames={Math.max(1, Math.round(((b.fimMs - b.inicioMs) / 1000) * fps))} layout="none">
            <MidiaCartao midia={b.midia} cor={cor} top={300} altura={760} atraso={0} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
