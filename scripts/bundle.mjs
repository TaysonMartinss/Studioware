// Bundle do Remotion que se apaga sozinho no fim do processo.
// O bundle() copia a pasta public/ inteira (vídeos, música, modelos: ~1 GB) para uma pasta nova no Temp e nunca
// a apaga; com três bundles por vídeo (produzir, capa, miniaturas) o disco enchia ao fim de alguns vídeos.
import { bundle } from "@remotion/bundler";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";

export async function criarBundle(opcoes = {}) {
  const serveUrl = await bundle({ entryPoint: resolve("src/index.ts"), ...opcoes });
  const apagar = () => {
    // só apaga uma pasta de bundle do Remotion dentro do Temp
    const dentroDoTemp = resolve(serveUrl).toLowerCase().startsWith(resolve(tmpdir()).toLowerCase());
    if (dentroDoTemp && basename(serveUrl).startsWith("remotion-webpack-bundle-")) {
      try { rmSync(serveUrl, { recursive: true, force: true }); } catch { /* fica para a próxima limpeza */ }
    }
  };
  process.once("exit", apagar);
  for (const sinal of ["SIGINT", "SIGTERM"]) process.once(sinal, () => process.exit(130));
  return serveUrl;
}
