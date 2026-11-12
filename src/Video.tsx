import { AbsoluteFill, Html5Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import { BarraProgresso } from "./components/BarraProgresso";
import { Fundo } from "./components/Fundo";
import { Mundo3D } from "./components/Mundo3D";
import { Legendas } from "./components/Legendas";
import { MarcaDagua } from "./components/MarcaDagua";
import { Musica } from "./components/Musica";
import { Sfx, SfxCtx, SFX_PADRAO } from "./components/Sfx";
import { Overlay } from "./components/Overlay";
import { ColagemPapel, FiltrosFerver, FiltrosOndular } from "./components/PapelMotion";
import { FiltrosAquarela } from "./components/Aquarela";
import { Pico, SonsPico, calcularPicos } from "./components/Picos";
import { RitmoCtx, normalizar, ritmoDaFala, zoomPunch } from "./components/motion";
import { Transicao } from "./components/Transicao";
import { ESTILOS, EstiloCtx, useEstilo } from "./estilos";
import { Clipe } from "./cenas/Clipe";
import { Comparacao } from "./cenas/Comparacao";
import { Cta } from "./cenas/Cta";
import { Fato } from "./cenas/Fato";
import { Faixa } from "./cenas/Faixa";
import { Tipografia } from "./cenas/Tipografia";
import { DadoEditorial } from "./cenas/DadoEditorial";
import { Gancho } from "./cenas/Gancho";
import { Palavras } from "./cenas/Palavras";
import { Grafico } from "./cenas/Grafico";
import { LinhaTempo } from "./cenas/LinhaTempo";
import { ManimCena } from "./cenas/ManimCena";
import { Quiz } from "./cenas/Quiz";
import { LowPolyCena } from "./lowpoly/LowPolyCena";
import { PincelCena } from "./pincel/PincelCena";
import { Modelo3DCena } from "./cenas/Modelo3DCena";
import { Numero } from "./cenas/Numero";
import { Produto } from "./cenas/Produto";
import { Cena, FPS, Manifest, framesDaCena } from "./types";
import { FiltroPixel } from "./components/Pixel";

const ConteudoCena: React.FC<{ cena: Cena; cor: string; destaques?: Set<string> }> = ({ cena, cor, destaques }) => {
  if (cena.tipo === "dado") return <DadoEditorial cena={cena} />;
  if (cena.tipo === "tipografia") return <Tipografia cena={cena} cor={cor} destaques={destaques} />;
  if (cena.tipo === "faixa") return <Faixa cena={cena} cor={cor} />;
  if (cena.tipo === "palavras") return <Palavras cena={cena} cor={cor} />;
  if (cena.tipo === "gancho") return <Gancho cena={cena} cor={cor} />;
  if (cena.tipo === "produto") return <Produto cena={cena} cor={cor} />;
  if (cena.tipo === "fato") return <Fato cena={cena} cor={cor} />;
  if (cena.tipo === "grafico") return <Grafico cena={cena} cor={cor} />;
  if (cena.tipo === "linha_tempo") return <LinhaTempo cena={cena} cor={cor} />;
  if (cena.tipo === "manim") return <ManimCena cena={cena} cor={cor} />;
  if (cena.tipo === "quiz") return <Quiz cena={cena} cor={cor} />;
  if (cena.tipo === "lowpoly") return <LowPolyCena cena={cena} cor={cor} />;
  if (cena.tipo === "pincel") return <PincelCena cena={cena} cor={cor} />;
  if (cena.tipo === "clipe") return <Clipe cena={cena} cor={cor} />;
  if (cena.tipo === "numero") return <Numero cena={cena} cor={cor} />;
  if (cena.tipo === "comparacao") return <Comparacao cena={cena} cor={cor} />;
  if (cena.tipo === "modelo3d") return <Modelo3DCena cena={cena} cor={cor} />;
  // capítulos são dos vídeos longos; num vertical viram um facto com a etiqueta do capítulo
  if (cena.tipo === "capitulo") return <Fato cena={{ ...cena, tipo: "fato", kicker: cena.kicker ?? `Capítulo ${cena.numero ?? ""}`.trim() }} cor={cor} />;
  return <Cta cena={cena} cor={cor} />;
};

const CenaCompleta: React.FC<{ cena: Cena; indice: number; cor: string; destaques: Set<string>; pico?: Pico; emojis?: Record<string, string> }> = ({
  cena, indice, cor, destaques, pico, emojis,
}) => {
  const f = useCurrentFrame();
  const palavras = cena.palavras ?? [];
  // nos cortes, enquanto um exemplo editorial (frase de efeito ou dado) está no ecrã, a frase já está escrita: sem legenda
  const editoriais = cena.tipo === "clipe" ? (cena.broll ?? []).filter((b) => b.cena?.tipo === "tipografia" || b.cena?.tipo === "dado") : [];
  const palavrasLegenda = editoriais.length ? palavras.filter((p) => !editoriais.some((b) => p.inicioMs >= b.inicioMs - 60 && p.inicioMs < b.fimMs)) : palavras;
  // zoom punch no início da cena e em cada palavra de destaque (estilos calmos ficam sem)
  const { shake, rgbSplit, tema } = useEstilo();
  const gatilhos = shake === 0 ? [] : [0, ...palavras.filter((p) => destaques.has(normalizar(p.texto))).map((p) => Math.round((p.inicioMs / 1000) * FPS)), ...(pico ? [pico.frame] : [])];

  return (
    <AbsoluteFill>
      {indice > 0 && <Sfx nome="whoosh" volume={0.6} />}
      {cena.audio && <Html5Audio src={staticFile(cena.audio)} />}
      {/* revelação preparada com [pausa longa]: riser até ao golpe, impacto e (na principal) chime */}
      {pico && <SonsPico frame={pico.frame} principal={pico.principal} />}
      <Transicao indice={indice} zoom={zoomPunch(f, gatilhos)} filtro={rgbSplit ? "url(#rgb-split)" : undefined}>
        <RitmoCtx.Provider value={["gancho", "cta", "clipe"].includes(cena.tipo) ? 1 : ritmoDaFala(cena.fala)}>
          <ConteudoCena cena={cena} cor={cor} destaques={destaques} />
        </RitmoCtx.Provider>
      </Transicao>
      {/* papel: um recorte novo a cada 3 palavras (o gancho já tem as letras de resgate e o CTA o botão) */}
      {tema === "papel" && !["gancho", "cta", "clipe"].includes(cena.tipo) && <ColagemPapel palavras={palavras} />}
      {/* a tipografia editorial já escreve a fala no ecrã */}
      {cena.tipo !== "tipografia" && cena.tipo !== "dado" && <Legendas palavras={palavrasLegenda} destaques={destaques} cor={cor} emojis={emojis} />}
    </AbsoluteFill>
  );
};

// separa os canais vermelho e azul em direções opostas (sinal de vídeo analógico)
const FiltroRgb: React.FC<{ d: number }> = ({ d }) => (
  <svg width={0} height={0} style={{ position: "absolute" }}>
    <filter id="rgb-split" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
      <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
      <feOffset in="r" dx={d} dy={0} result="r2" />
      <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
      <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
      <feOffset in="b" dx={-d} dy={0} result="b2" />
      <feBlend in="r2" in2="g" mode="screen" result="rg" />
      <feBlend in="rg" in2="b2" mode="screen" />
    </filter>
  </svg>
);

export const Video: React.FC<{ manifest: Manifest }> = ({ manifest }) => {
  const estilo = ESTILOS[manifest.estilo ?? "neon"] ?? ESTILOS.neon;
  const cor = manifest.cor ?? estilo.cor;
  const destaques = new Set([...(manifest.destaques ?? []), ...Object.keys(manifest.emojis ?? {})].map(normalizar));
  // legendas com emoji desligadas a pedido (as palavras-chave dos cortes continuam a ser destaque de cor)
  const emojis = undefined;
  const inicios = manifest.cenas.reduce<number[]>((a, c, i) => [...a, i ? a[i - 1] + framesDaCena(manifest.cenas[i - 1]) : 0], []);
  const picos = calcularPicos(manifest.cenas, 3);
  let inicio = 0;

  return (
    <EstiloCtx.Provider value={estilo}>
    <SfxCtx.Provider value={SFX_PADRAO * (manifest.sfxVolume ?? 1)}>
    <AbsoluteFill>
      <Fundo cor={cor} />
      {estilo.tema === "mundo3d" && <Mundo3D cenas={manifest.cenas} inicios={inicios} cor={cor} />}
      <Musica manifest={manifest} />
      {manifest.cenas.map((cena, i) => {
        const dur = framesDaCena(cena);
        const el = (
          <Sequence key={i} from={inicio} durationInFrames={dur} name={`${i + 1}. ${cena.tipo}`}>
            <CenaCompleta cena={cena} indice={i} cor={cor} destaques={destaques} emojis={emojis} pico={picos.find((p) => p.cena === i)} />
          </Sequence>
        );
        inicio += dur;
        return el;
      })}
      <Overlay />
      {manifest.marcaDagua !== false && <MarcaDagua canal={manifest.canal} />}
      {estilo.rgbSplit ? <FiltroRgb d={estilo.rgbSplit} /> : null}
      {estilo.pixel ? <FiltroPixel tamanho={estilo.pixel.tamanho} niveis={estilo.pixel.niveis} /> : null}
      {estilo.tema === "papel" && <FiltrosFerver />}
      <FiltrosOndular />
      {estilo.textura === "aquarela" && <FiltrosAquarela tinta={estilo.corTexto} />}
      <BarraProgresso cor={cor} />
    </AbsoluteFill>
    </SfxCtx.Provider>
    </EstiloCtx.Provider>
  );
};
