// Pixel 3D: a cena (3D low poly, fotos, vídeos) fica em blocos de pixel com dithering ordenado e paleta curta,
// como uma cena 3D renderizada a baixa resolução num ecrã antigo. Só filtros SVG: funciona sobre qualquer conteúdo,
// e o título e as legendas ficam fora do filtro (nítidos).
//  1. pixelar: guarda um ponto de 2 px (1 px some nos renders a meia escala) no meio de cada bloco de `tamanho` px e dilata-o até encher o bloco;
//  2. dithering: soma um padrão Bayer 4x4 (do tamanho dos blocos) e arredonda cada canal a `niveis` valores.

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

const padraoBayer = (t: number) => {
  const rects = BAYER.map((v, i) => {
    const g = Math.round(((v + 0.5) / 16) * 255);
    return `<rect x='${(i % 4) * t}' y='${Math.floor(i / 4) * t}' width='${t}' height='${t}' fill='rgb(${g},${g},${g})'/>`;
  }).join("");
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${4 * t}' height='${4 * t}'>${rects}</svg>`)}`;
};

export const FiltroPixel: React.FC<{ tamanho: number; niveis: number }> = ({ tamanho: t, niveis }) => {
  const forca = 1 / (niveis - 1); // o ruído do Bayer cobre um degrau da paleta
  const tabela = Array.from({ length: niveis }, (_, i) => (i / (niveis - 1)).toFixed(3)).join(" ");
  return (
    <svg width={0} height={0} style={{ position: "absolute" }}>
      <filter id="pixel" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feFlood x={Math.floor(t / 2) - 1} y={Math.floor(t / 2) - 1} width={2} height={2} floodColor="#fff" result="ponto" />
        <feComposite in="ponto" in2="ponto" width={t} height={t} result="celula" />
        <feTile in="celula" result="grelha" />
        <feComposite in="SourceGraphic" in2="grelha" operator="in" result="amostras" />
        <feMorphology in="amostras" operator="dilate" radius={t / 2} result="blocos" />
        <feImage href={padraoBayer(t)} x={0} y={0} width={4 * t} height={4 * t} result="b" />
        <feTile in="b" result="bayer" />
        <feComposite in="blocos" in2="bayer" operator="arithmetic" k1={0} k2={1} k3={forca} k4={-forca / 2} result="soma" />
        <feComponentTransfer in="soma">
          <feFuncR type="discrete" tableValues={tabela} />
          <feFuncG type="discrete" tableValues={tabela} />
          <feFuncB type="discrete" tableValues={tabela} />
        </feComponentTransfer>
      </filter>
    </svg>
  );
};
