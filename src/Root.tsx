import { Composition } from "remotion";
import { Video } from "./Video";
import { VideoLongo } from "./longo/VideoLongo";
import { CapaComposicao, CapaProps, tamanhoCapa } from "./capa/Capa";
import { Quadro3D, Quadro3DProps, tamanhoQuadro3D } from "./capa/Quadro3D";
import { FPS, Manifest, framesDaCena } from "./types";

const exemplo: Manifest = {
  id: "preview",
  titulo: "Preview",
  cor: "#00ff9d",
  destaques: ["melhor"],
  cenas: [
    { tipo: "gancho", texto_tela: "NÃO COMPRE ERRADO", fala: "Não compre a placa errada", duracaoMs: 2500 },
    {
      tipo: "produto", rank: 1, categoria: "Placa de vídeo", icone: "gpu", nome: "GPU EXEMPLO",
      preco: "R$ 0.000", selo: "MELHOR CUSTO", tags: ["1080p", "DLSS"],
      specs: [{ label: "Desempenho", valor: 80 }, { label: "Preço", valor: 60 }],
      fala: "Exemplo", duracaoMs: 5000,
    },
    { tipo: "cta", texto_tela: "SEGUE PRA MAIS", fala: "Segue", duracaoMs: 2500 },
  ],
};

// A duração vem da narração: soma das cenas do manifest
const duracao = ({ props }: { props: { manifest: Manifest } }) => ({
  durationInFrames: props.manifest.cenas.reduce((t, c) => t + framesDaCena(c), 0),
});

export const Root: React.FC = () => (
  <>
  <Composition
    id="Video"
    component={Video}
    width={1080}
    height={1920}
    fps={FPS}
    durationInFrames={300}
    defaultProps={{ manifest: exemplo }}
    calculateMetadata={duracao}
  />
  {/* vídeo longo para o YouTube (formato "longo") */}
  <Composition
    id="VideoLongo"
    component={VideoLongo}
    width={1920}
    height={1080}
    fps={FPS}
    durationInFrames={300}
    defaultProps={{ manifest: { ...exemplo, formato: "longo" } }}
    calculateMetadata={duracao}
  />
  {/* capa (thumbnail): imagem parada, 9:16 ou 16:9 conforme o formato pedido */}
  <Composition
    id="Capa"
    component={CapaComposicao}
    width={1080}
    height={1920}
    fps={FPS}
    durationInFrames={1}
    defaultProps={{ texto: "13 ANOS DE ESPERA", layout: "impacto", formato: "vertical", estilo: "neon" } as CapaProps}
    calculateMetadata={({ props }: { props: CapaProps }) => tamanhoCapa(props.formato)}
  />
  {/* frame limpo de uma cena low poly, para fundo das capas (scripts/capa.mjs escolhe o frame) */}
  <Composition
    id="Quadro3D"
    component={Quadro3D}
    width={1080}
    height={1920}
    fps={FPS}
    durationInFrames={900}
    defaultProps={{ cena: { tipo: "lowpoly", cenario: "estadio", fala: "" }, formato: "vertical" } as Quadro3DProps}
    calculateMetadata={({ props }: { props: Quadro3DProps }) => tamanhoQuadro3D(props.formato)}
  />
  </>
);
