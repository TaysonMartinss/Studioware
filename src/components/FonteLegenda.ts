import { continueRender, delayRender, staticFile } from "remotion";

// Fonte das legendas (todas menos a do papel): Keep Calm. A fonte é paga para uso comercial (K-Type), por isso não vem
// no repositório: ponha o ficheiro em public/fontes/keep-calm.ttf (ou .otf). Sem o ficheiro fica a fonte do estilo.
export const FAMILIA_LEGENDA = "Keep Calm";

if (typeof document !== "undefined" && typeof FontFace !== "undefined") {
  const espera = delayRender("fonte das legendas");
  const tentar = async () => {
    for (const nome of ["fontes/keep-calm.ttf", "fontes/keep-calm.otf"]) {
      try {
        const face = await new FontFace(FAMILIA_LEGENDA, `url(${staticFile(nome)})`).load();
        document.fonts.add(face);
        return;
      } catch {
        // não existe este ficheiro: tenta o próximo
      }
    }
  };
  tentar().finally(() => continueRender(espera));
}
