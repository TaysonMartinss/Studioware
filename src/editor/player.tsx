// Player ao vivo do editor manual (tela Editar do painel): o vídeo a sério, desenhado no navegador pelo @remotion/player
// com as mesmas composições do render (Video e VideoLongo), para ver cada mudança na hora, sem renderizar.
// O painel (JavaScript simples) controla-o pela API em window.PlayerEstudio. Compilar: node scripts/build_editor.mjs
import { createRoot, Root } from "react-dom/client";
import { createRef, SyntheticEvent } from "react";
import { prefetch, staticFile } from "remotion";
import { Player, PlayerRef } from "@remotion/player";
import { Video } from "../Video";
import { VideoLongo } from "../longo/VideoLongo";
import { FPS, Manifest, framesDaCena } from "../types";
import { SONS_ESTUDIO, ficheiroSom } from "../components/Sfx";

type Montado = {
  atualizar: (manifest: Manifest) => void;
  // o evento do clique/tecla tem de chegar ao play: é ele que autoriza o som no navegador
  tocar: (e?: Event) => void; pausar: () => void; alternar: (e?: Event) => void;
  irPara: (frame: number) => void; frame: () => number; aTocar: () => boolean;
  aoFrame: (f: (frame: number) => void) => void;
  aoTocar: (f: (aTocar: boolean) => void) => void;
  volume: (v: number) => void;
  desmontar: () => void;
};

const duracaoDe = (m: Manifest) => Math.max(1, m.cenas.reduce((t, c) => t + framesDaCena(c), 0));

// narrações e efeitos sonoros já descarregados para a memória: o play começa com som desde o primeiro frame. Sem
// isto, um efeito curto (clique, impacto) só começava a descarregar quando devia tocar e acabava antes de se ouvir.
const preCarregadas = new Map<string, () => void>();
const preCarregarUrl = (url: string) => {
  if (preCarregadas.has(url)) return;
  const p = prefetch(url, { method: "blob-url" });
  preCarregadas.set(url, p.free);
  p.waitUntilDone().catch(() => preCarregadas.delete(url));
};
function preCarregar(m: Manifest) {
  for (const n of SONS_ESTUDIO) preCarregarUrl(staticFile(`sfx/${n}.wav`));
  for (const c of m.cenas) {
    if (c.audio) preCarregarUrl(staticFile(c.audio));
    const nomes = [...(c.sons ?? []).map((s) => s.nome), c.somEntrada, ...Object.values(c.trocaSons ?? {}), c.som?.nome];
    for (const n of nomes) { const f = n && n !== "nenhum" ? ficheiroSom(n) : null; if (f) preCarregarUrl(f.src); }
  }
}
const comoSintetico = (e?: Event) => e as unknown as SyntheticEvent | undefined;

function montar(el: HTMLElement, manifestInicial: Manifest): Montado {
  const raiz: Root = createRoot(el);
  const ref = createRef<PlayerRef>();
  let manifest = manifestInicial;
  const ouvintesFrame = new Set<(f: number) => void>(), ouvintesTocar = new Set<(t: boolean) => void>();
  let ligado: PlayerRef | null = null;
  // liga os eventos do player (uma vez por instância do player)
  const ligar = () => {
    const p = ref.current;
    if (!p || p === ligado) return;
    ligado = p;
    p.addEventListener("frameupdate", (e) => ouvintesFrame.forEach((f) => f(e.detail.frame)));
    p.addEventListener("seeked", (e) => ouvintesFrame.forEach((f) => f(e.detail.frame)));
    p.addEventListener("play", () => ouvintesTocar.forEach((f) => f(true)));
    p.addEventListener("pause", () => ouvintesTocar.forEach((f) => f(false)));
    p.addEventListener("ended", () => ouvintesTocar.forEach((f) => f(false)));
  };
  const desenhar = () => {
    preCarregar(manifest);
    const longo = manifest.formato === "longo";
    raiz.render(
      <Player
        ref={ref}
        component={(longo ? VideoLongo : Video) as React.FC<{ manifest: Manifest }>}
        inputProps={{ manifest }}
        durationInFrames={duracaoDe(manifest)}
        fps={FPS}
        compositionWidth={longo ? 1920 : 1080}
        compositionHeight={longo ? 1080 : 1920}
        style={{ width: "100%", height: "100%" }}
        acknowledgeRemotionLicense
        clickToPlay={false}
        doubleClickToFullscreen
        spaceKeyToPlayOrPause={false}
        numberOfSharedAudioTags={12}
        renderLoading={() => <div style={{ color: "#999", font: "14px system-ui", display: "grid", placeItems: "center", height: "100%" }}>A carregar…</div>}
      />,
    );
    // o player só existe depois de o React o montar: tenta ligar os eventos até conseguir
    let tentativas = 0;
    const tentar = () => { ligar(); if ((!ligado || ref.current !== ligado) && tentativas++ < 100) setTimeout(tentar, 50); };
    tentar();
  };
  desenhar();
  return {
    atualizar: (m) => { manifest = m; desenhar(); },
    tocar: (e) => ref.current?.play(comoSintetico(e)), pausar: () => ref.current?.pause(), alternar: (e) => ref.current?.toggle(comoSintetico(e)),
    irPara: (f) => ref.current?.seekTo(Math.max(0, Math.min(duracaoDe(manifest) - 1, Math.round(f)))),
    frame: () => ref.current?.getCurrentFrame() ?? 0,
    aTocar: () => ref.current?.isPlaying() ?? false,
    aoFrame: (f) => { ouvintesFrame.add(f); },
    aoTocar: (f) => { ouvintesTocar.add(f); },
    volume: (v) => ref.current?.setVolume(v),
    desmontar: () => raiz.unmount(),
  };
}

declare global { interface Window { PlayerEstudio: { montar: typeof montar; FPS: number; framesDaCena: typeof framesDaCena } } }
window.PlayerEstudio = { montar, FPS, framesDaCena };
