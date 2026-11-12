import { AbsoluteFill, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Conteudo, MidiaCartao } from "../components/MidiaReal";
import { LowPolyCena } from "../lowpoly/LowPolyCena";
import { PincelCena } from "../pincel/PincelCena";
import { Faixa } from "./Faixa";
import { Numero } from "./Numero";
import { Palavras } from "./Palavras";
import { pop, useFontes, useFrame } from "../components/motion";
import { useEstilo } from "../estilos";
import { CenaClipe } from "../types";

type Retangulo = [number, number, number, number];
// mostra o retângulo [x, y, w, h] do vídeo original a encher uma caixa (como object-fit: cover, centrado no retângulo)
const Recorte: React.FC<{ src: string; vl: number; va: number; r: Retangulo; caixa: { top: number; altura: number; largura: number }; mudo?: boolean; zoom?: number; mascara?: string }> = ({ src, vl, va, r, caixa, mudo, zoom = 1, mascara }) => {
  const [x, y, w, h] = r;
  const k = Math.max(caixa.largura / w, caixa.altura / h) * zoom;
  // o centro do retângulo vai para o centro da caixa, sem deixar ver fora do vídeo
  const left = Math.min(0, Math.max(caixa.largura - vl * k, caixa.largura / 2 - (x + w / 2) * k));
  const top = Math.min(0, Math.max(caixa.altura - va * k, caixa.altura / 2 - (y + h / 2) * k));
  return (
    <div style={{ position: "absolute", top: caixa.top, left: 0, width: caixa.largura, height: caixa.altura, overflow: "hidden", maskImage: mascara, WebkitMaskImage: mascara }}>
      <OffthreadVideo src={src} muted={mudo} style={{ position: "absolute", left, top, width: vl * k, height: va * k, maxWidth: "none" }} />
    </div>
  );
};

const DESVANECER = 135; // px em que a base da webcam se funde com a gameplay
// Gameplay com webcam: a webcam em cima e o jogo ao centro em baixo (o recorte do jogo foge da webcam, até 20% da largura)
const Dividido: React.FC<{ src: string; enq: NonNullable<CenaClipe["enquadramento"]>; f: number; fps: number; L: number; A: number; zoom: number }> = ({ src, enq, f, fps, L, A, zoom }) => {
  const segs = enq.segmentos ?? [];
  const i = Math.round((f / fps) * enq.fps);
  const seg = [...segs].reverse().find((s) => s.de <= i) ?? segs[0];
  const { largura: vl, altura: va } = enq;
  if (seg?.rosto) {
    // a edição foi para a webcam em ecrã cheio: corte vertical no rosto
    const [x, y, w, h] = seg.rosto;
    const cw = va * (L / A);
    return <Recorte src={src} vl={vl} va={va} r={[x + w / 2 - cw / 2, Math.max(0, y + h / 2 - va / 2), cw, va]} caixa={{ top: 0, altura: A, largura: L }} zoom={zoom} />;
  }
  if (!seg?.cam) {
    return (
      <>
        <OffthreadVideo src={src} muted style={{ width: "100%", height: "100%", objectFit: "cover", filter: "blur(40px) brightness(0.5)", transform: "scale(1.2)" }} />
        <AbsoluteFill style={{ justifyContent: "center" }}><OffthreadVideo src={src} style={{ width: "100%" }} /></AbsoluteFill>
      </>
    );
  }
  // altura da faixa da webcam: a mesma no clipe todo (proporção mediana das webcams), entre 30% e 40% do ecrã
  const asps = segs.filter((s) => s.cam).map((s) => s.cam![2] / s.cam![3]).sort((a, b) => a - b);
  const asp = asps[Math.floor(asps.length / 2)] ?? 16 / 9;
  const hc = Math.round(Math.min(A * 0.4, Math.max(A * 0.3, L / asp)));
  const hj = A - hc;
  // jogo: altura toda do original, largura com a proporção da faixa de baixo, ao centro (onde está a mira)
  const jw = Math.min(vl, va * (L / hj));
  let jx = vl / 2 - jw / 2;
  const [cx, , cwid] = seg.cam;
  const sobra = vl * 0.2; // até 20%: a mira (centro do original) continua dentro do recorte
  if (cx + cwid > jx && cx < jx + jw) {
    jx = cx + cwid / 2 < vl / 2 ? Math.min(jx + sobra, cx + cwid) : Math.max(jx - sobra, cx - jw);
  }
  return (
    <>
      {/* o jogo começa por baixo da webcam e a webcam desvanece por cima dele: sem divisão seca entre os dois */}
      <Recorte src={src} vl={vl} va={va} r={[jx, 0, jw, va]} caixa={{ top: hc - DESVANECER, altura: hj + DESVANECER, largura: L }} zoom={zoom} />
      <Recorte src={src} vl={vl} va={va} r={seg.cam} caixa={{ top: 0, altura: hc, largura: L }} mudo
        mascara={`linear-gradient(180deg, #000 0, #000 ${hc - DESVANECER}px, rgba(0,0,0,.8) ${hc - DESVANECER / 2}px, transparent ${hc}px)`} />
    </>
  );
};

// Exemplo visual de ecrã inteiro por cima da fala (vídeo/foto, low poly ou pincel); a pessoa fica num canto
type Broll = NonNullable<CenaClipe["broll"]>[number];
const Exemplo: React.FC<{ b: Broll; cor: string; canto: React.ReactNode }> = ({ b, cor, canto }) => {
  const f = useCurrentFrame();
  const { durationInFrames: d } = useVideoConfig();
  // transição leve: 3 frames (quase um corte seco)
  const entra = interpolate(f, [0, 3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sai = interpolate(f, [d - 3, d], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const o = Math.min(entra, sai);
  const zoom = interpolate(f, [0, d], [1.04, 1.12]);
  const duracaoMs = b.fimMs - b.inicioMs;
  // como nos reels: a faixa de cinema e as palavras gigantes entram em corte seco e tapam a pessoa (a voz continua)
  if (b.layout === "faixa" && b.midia?.arquivo) return <AbsoluteFill><Faixa cena={{ tipo: "faixa", fala: "", midia: b.midia, titulo: b.titulo, duracaoMs }} cor={cor} /></AbsoluteFill>;
  if (b.cena?.tipo === "numero") {
    return (
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 90% 60% at 50% 40%, ${cor}30, transparent 70%), #050507` }}>
        <Numero cena={{ ...b.cena, duracaoMs, palavras: [] }} cor={cor} />
      </AbsoluteFill>
    );
  }
  if (b.cena?.tipo === "palavras") return <AbsoluteFill><Palavras cena={{ ...b.cena, duracaoMs, palavras: [] }} cor={cor} /></AbsoluteFill>;
  let conteudo: React.ReactNode = null;
  if (b.midia?.arquivo) conteudo = <Conteudo midia={b.midia} estilo={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${zoom})` }} />;
  else if (b.cena?.tipo === "lowpoly") conteudo = <LowPolyCena cena={{ ...b.cena, duracaoMs, palavras: [] }} cor={cor} />;
  else if (b.cena?.tipo === "pincel") conteudo = <PincelCena cena={{ ...b.cena, duracaoMs, palavras: [] }} cor={cor} />;
  if (!conteudo) return null; // a mídia não se descarregou: fica a pessoa
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <AbsoluteFill style={{ background: "#000", overflow: "hidden", transform: `scale(${1.03 - 0.03 * entra})` }}>{conteudo}</AbsoluteFill>
      <div style={{ position: "absolute", left: 40, top: 1480, width: 270, height: 350, borderRadius: 28, overflow: "hidden", border: `5px solid ${cor}`, boxShadow: "0 18px 40px #000a", transform: `scale(${0.85 + 0.15 * entra})`, transformOrigin: "0% 100%" }}>
        {canto}
      </div>
    </AbsoluteFill>
  );
};

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
  const webcam = enq?.modo === "webcam" && enq.segmentos?.length;
  const horizontal = !seguir && !webcam && (cena.largura ?? 9) > (cena.altura ?? 16);
  const s = pop(f, fps, 3, 14);
  // receita de edição: a imagem muda a cada 3 a 5 s. Novo plano (corte seco para outro zoom) no início de uma frase
  // ou depois de uma vírgula, se já passaram 2,5 s; à força aos 4,5 s. Dentro do plano, um zoom lento (nunca parado).
  const ms = (f / fps) * 1000;
  const ws = cena.palavras ?? [];
  const cortes = [0];
  ws.forEach((p, k) => {
    const desde = p.inicioMs - cortes[cortes.length - 1];
    const pausa = k > 0 && /[.!?,;:]$/.test(ws[k - 1].texto);
    if ((pausa && desde >= 2500) || desde >= 4500) cortes.push(p.inicioMs);
  });
  const plano = cortes.filter((t) => t <= ms).length - 1;
  const ZOOMS = [1, 1.14, 1.06, 1.18];
  const zoom = ZOOMS[plano % ZOOMS.length] * (1 + Math.min((ms - cortes[plano]) / 1000, 5) * 0.004);

  return (
    <AbsoluteFill>
      {webcam ? (
        <Dividido src={src} enq={enq!} f={f} fps={fps} L={L} A={A} zoom={1 + (zoom - 1) * 0.5} />
      ) : seguir ? (
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
        if (b.cheio) {
          // a pessoa no canto: o mesmo recorte do enquadramento (o rosto), sem som (a voz vem do vídeo principal)
          const vl = enq?.largura ?? cena.largura ?? 1080, va = enq?.altura ?? cena.altura ?? 1920;
          const k = Math.min(enq?.xs?.length ? enq.xs.length - 1 : 0, Math.max(0, Math.round((f / fps) * (enq?.fps ?? fps))));
          const cw = Math.min(vl, va * (270 / 350));
          const r: Retangulo = seguir ? [enq!.xs![k], 0, enq!.cropLargura!, va] : [vl / 2 - cw / 2, 0, cw, va];
          return (
            <Sequence key={i} from={ini} durationInFrames={Math.max(1, Math.round(((b.fimMs - b.inicioMs) / 1000) * fps))} layout="none">
              <Exemplo b={b} cor={cor} canto={<Recorte src={src} vl={vl} va={va} r={r} caixa={{ top: 0, altura: 350, largura: 270 }} mudo />} />
            </Sequence>
          );
        }
        return (
          <Sequence key={i} from={ini} durationInFrames={Math.max(1, Math.round(((b.fimMs - b.inicioMs) / 1000) * fps))} layout="none">
            <MidiaCartao midia={b.midia!} cor={cor} top={300} altura={760} atraso={0} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
