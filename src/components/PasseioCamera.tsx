import { useId, useState } from "react";
import { FundoNoir } from "./FundosNoir";
import { AbsoluteFill, Easing, Img, OffthreadVideo, continueRender, delayRender, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

// Passeio de câmara 3D sobre um print ou vídeo (a técnica do After Effects ensinada pelo criador):
// 1. a mídia é importada e recortada com uma máscara retangular (cantos arredondados), sobre o fundo de túnel 3D do estilo editorial;
// 2. tudo é camada 3D: uma câmara com um Null Object como pai; o nulo é que se mexe (posição, escala e orientação)
//    e a câmara olha sempre para o ponto de interesse (o centro do ecrã);
// 3. o nulo vai de ponto de interesse em ponto de interesse com keyframes suavizados a 65/65 (Keyframe Velocity),
//    com motion blur proporcional à velocidade;
// 4. profundidade de campo: o ponto de interesse fica nítido e o resto do plano desfoca (mais quando o plano está
//    inclinado), como o Depth of Field com Aperture e Focus Distance da câmara.
export type PontoPasseio = {
  x: number; y: number; // ponto de interesse na mídia, de 0 a 1 (0,0 = canto de cima à esquerda)
  zoom?: number; // 1 = mídia inteira; 2 = o dobro (por omissão 1,8)
  rx?: number; ry?: number; rz?: number; // orientação do nulo em graus (inclinação para dar profundidade)
};

// curva do After Effects com influência 65% à saída e à entrada
export const CURVA_65 = Easing.bezier(0.65, 0, 0.35, 1);

// percurso automático quando o roteiro não indica pontos: vista geral inclinada → topo → baixo → recua
export const PASSEIO_PADRAO: PontoPasseio[] = [
  { x: 0.5, y: 0.5, zoom: 1, rx: 14, ry: -20, rz: -3 },
  { x: 0.32, y: 0.3, zoom: 1.9, rx: 6, ry: 10, rz: 1 },
  { x: 0.68, y: 0.7, zoom: 2, rx: -6, ry: -8, rz: -1 },
  { x: 0.5, y: 0.5, zoom: 1.12, rx: 8, ry: 14, rz: 2 },
];
// de onde a câmara chega no primeiro frame (mais longe e mais inclinada)
const ENTRADA: Required<PontoPasseio> = { x: 0.5, y: 0.55, zoom: 0.7, rx: 32, ry: -34, rz: -8 };

const completo = (p: PontoPasseio): Required<PontoPasseio> => ({ x: p.x, y: p.y, zoom: p.zoom ?? 1.8, rx: p.rx ?? 0, ry: p.ry ?? 0, rz: p.rz ?? 0 });

// estado do nulo no frame f: cada ponto tem uma fatia igual do tempo; no início da fatia a câmara viaja até ele
// (até 0,8 s, curva 65/65) e no resto fica a derivar devagar (aproxima 3%)
export const estadoPasseio = (pontos: PontoPasseio[], f: number, duracao: number, fps: number): Required<PontoPasseio> => {
  const ps = (pontos.length ? pontos : PASSEIO_PADRAO).map(completo);
  const fatia = Math.max(1, duracao / ps.length);
  const i = Math.min(ps.length - 1, Math.max(0, Math.floor(f / fatia)));
  const de = i === 0 ? ENTRADA : ps[i - 1], ate = ps[i];
  const t0 = i * fatia, viagem = Math.min(fps * 0.8, fatia * 0.55);
  const q = interpolate(f, [t0, t0 + viagem], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: CURVA_65 });
  const deriva = interpolate(f, [t0 + viagem, t0 + fatia], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const mix = (a: number, b: number) => a + (b - a) * q;
  return { x: mix(de.x, ate.x), y: mix(de.y, ate.y), zoom: mix(de.zoom, ate.zoom) * (1 + 0.03 * deriva), rx: mix(de.rx, ate.rx), ry: mix(de.ry, ate.ry), rz: mix(de.rz, ate.rz) };
};

export const PasseioCamera: React.FC<{
  arquivo: string; video?: boolean; inicioS?: number;
  pontos?: PontoPasseio[];
  fundo?: string; cor?: string; // Solid do fundo e o brilho atrás do plano
  profundidade?: boolean; // depth of field (por omissão: sim nas imagens; nos vídeos fica desligado, para não decodificar duas vezes)
  cheio?: boolean; // ecrã inteiro: a mídia cobre a tela toda (sem fundo à volta), com o mesmo movimento de câmara
}> = ({ arquivo, video = false, inicioS = 0, pontos = [], fundo = "#050505", cor = "#ffffff", profundidade, cheio = false }) => {
  const f = useCurrentFrame();
  const { width: L, height: A, fps, durationInFrames: d } = useVideoConfig();
  const id = `pc${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  // proporção da mídia: a imagem mede-se ao carregar; os vídeos assumem 16:9
  const [aspeto, setAspeto] = useState<number | null>(video ? 16 / 9 : null);
  const [espera] = useState(() => (video ? null : delayRender("medir o print do passeio de câmara")));
  const medido = (w: number, h: number) => { if (!aspeto) setAspeto(w / Math.max(1, h)); if (espera !== null) continueRender(espera); };

  // plano (com a máscara) a caber em 90% da largura e 62% da altura na vista geral
  const asp = aspeto ?? 16 / 9;
  // ecrã inteiro: o plano é a tela e a câmara fica sempre perto o bastante (zoom mínimo, inclinação mais suave e o ponto
  // de interesse limitado) para as bordas da imagem nunca aparecerem
  // (12% maior que a tela: o motion blur da entrada tem imagem por trás das bordas em vez de puxar o preto)
  const W = cheio ? L * 1.12 : Math.min(L * 0.9, A * 0.62 * asp), H = cheio ? A * 1.12 : W / asp;
  const ajustar = (e: Required<PontoPasseio>): Required<PontoPasseio> => {
    if (!cheio) return e;
    const zoom = Math.max(1.45, e.zoom * 1.35);
    const m = ((zoom - 1) / (2 * zoom)) * 0.8;
    const lim = (v: number) => Math.min(0.5 + m, Math.max(0.5 - m, v));
    return { x: lim(e.x), y: lim(e.y), zoom, rx: e.rx * 0.4, ry: e.ry * 0.4, rz: e.rz * 0.35 };
  };
  const s = ajustar(estadoPasseio(pontos, f, d, fps)), s0 = ajustar(estadoPasseio(pontos, f - 1, d, fps));
  // motion blur: velocidade do ponto de interesse no ecrã (e do zoom) em px por frame
  const vx = (s.x - s0.x) * W * s.zoom + (s.zoom - s0.zoom) * W * 0.5, vy = (s.y - s0.y) * H * s.zoom + (s.zoom - s0.zoom) * H * 0.5;
  const bx = Math.min(40, Math.abs(vx) * 0.45), by = Math.min(40, Math.abs(vy) * 0.45);
  const comBlur = bx > 0.3 || by > 0.3;
  // depth of field: o plano desfoca fora do foco, mais quando está inclinado
  const dof = (profundidade ?? !video) ? 2.5 + (Math.abs(s.rx) + Math.abs(s.ry)) * 0.22 : 0;
  const raioFoco = (0.32 * L) / s.zoom; // em px do plano: o que está à volta do ponto de interesse fica nítido

  const midia = (filtro?: string) => (
    <div style={{ position: "absolute", inset: 0, filter: filtro }}>
      {video
        ? <OffthreadVideo src={staticFile(arquivo)} muted trimBefore={Math.round(inicioS * fps)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : <Img src={staticFile(arquivo)} onLoad={(e) => medido(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)} onError={() => espera !== null && continueRender(espera)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
    </div>
  );
  const mascara = `radial-gradient(circle at ${s.x * 100}% ${s.y * 100}%, #000 ${raioFoco}px, transparent ${raioFoco * 2.2}px)`;

  return (
    <AbsoluteFill style={{ background: fundo, overflow: "hidden" }}>
      {/* fundo: o túnel 3D do estilo editorial (grelha em perspetiva a correr), com um brilho suave atrás do plano */}
      <FundoNoir variante={2} />
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 50%, ${cor}22, transparent 60%)` }} />
      {comBlur && (
        <svg width={0} height={0} style={{ position: "absolute" }}>
          <filter id={id} x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation={`${bx} ${by}`} /></filter>
        </svg>
      )}
      {/* o motion blur aplica-se a uma área 80 px maior que a tela: o escurecimento que o desfoque cria nas bordas fica fora */}
      <div style={{ position: "absolute", inset: -80, filter: comBlur ? `url(#${id})` : undefined }}>
        {/* câmara: perspetiva fixa a olhar para o centro (o ponto de interesse) */}
        <div style={{ position: "absolute", inset: 80, perspective: 1600, perspectiveOrigin: "50% 50%" }}>
          {/* nulo: escala, orientação e posição (leva o ponto de interesse ao centro do ecrã) */}
          <AbsoluteFill style={{
            transformStyle: "preserve-3d", transformOrigin: "50% 50%",
            transform: `scale(${s.zoom}) rotateX(${s.rx}deg) rotateY(${s.ry}deg) rotateZ(${s.rz}deg) translate(${(0.5 - s.x) * W}px, ${(0.5 - s.y) * H}px)`,
          }}>
            {/* camada da mídia com a máscara retangular */}
            <div style={{ position: "absolute", left: (L - W) / 2, top: (A - H) / 2, width: W, height: H, overflow: "hidden", ...(cheio ? {} : { borderRadius: 16, boxShadow: "0 50px 120px #000c, 0 0 0 1px #ffffff1f" }) }}>
              {dof > 0 ? (
                <>
                  {midia(`blur(${dof}px)`)}
                  <div style={{ position: "absolute", inset: 0, WebkitMaskImage: mascara, maskImage: mascara }}>{midia()}</div>
                </>
              ) : midia()}
            </div>
          </AbsoluteFill>
        </div>
      </div>
    </AbsoluteFill>
  );
};
