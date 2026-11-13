// Bundle do Remotion que não copia a pasta public/ e se apaga sozinho no fim do processo.
// O bundle() copia a pasta public/ inteira para uma pasta nova no Temp (no Windows não há a opção de ligação simbólica).
// Com vídeos, uploads e modelos 3D a public/ passou dos 4 GB: cada render precisava de 4 GB livres e o disco enchia.
// Agora o bundle é feito com uma pasta pública vazia e, no lugar dela, fica uma junção do Windows (não precisa de
// administrador) a apontar para a public/ verdadeira. Ao apagar o bundle, só a junção sai: os ficheiros ficam.
import { bundle } from "@remotion/bundler";
import { existsSync, lstatSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

export async function criarBundle(opcoes = {}) {
  const vazia = mkdtempSync(join(tmpdir(), "studioware-public-vazia-"));
  const serveUrl = await bundle({ entryPoint: resolve("src/index.ts"), publicDir: vazia, ...opcoes });
  rmSync(vazia, { recursive: true, force: true });
  const publica = join(serveUrl, "public");
  // a cópia da pasta vazia sai e entra a junção para a public/ do projeto
  rmSync(publica, { recursive: true, force: true });
  symlinkSync(resolve("public"), publica, "junction");

  const apagar = () => {
    // só apaga uma pasta de bundle do Remotion dentro do Temp; a junção sai primeiro (sem seguir para a public/)
    const dentroDoTemp = resolve(serveUrl).toLowerCase().startsWith(resolve(tmpdir()).toLowerCase());
    if (!dentroDoTemp || !basename(serveUrl).startsWith("remotion-webpack-bundle-")) return;
    try {
      if (existsSync(publica) && lstatSync(publica).isSymbolicLink()) rmSync(publica, { force: true });
      rmSync(serveUrl, { recursive: true, force: true });
    } catch { /* fica para a próxima limpeza */ }
  };
  process.once("exit", apagar);
  for (const sinal of ["SIGINT", "SIGTERM"]) process.once(sinal, () => process.exit(130));
  return serveUrl;
}
