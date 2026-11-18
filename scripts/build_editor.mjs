// Compila o player ao vivo do editor manual (src/editor/player.tsx) para server/editor/player.js, que o painel carrega.
// Usa o esbuild que já vem com o Remotion. O servidor do painel corre isto sozinho ao arrancar quando o código do
// vídeo (src/) mudou; à mão: node scripts/build_editor.mjs
import { build } from "esbuild";
import { mkdirSync } from "node:fs";

mkdirSync("server/editor", { recursive: true });
const inicio = Date.now();
await build({
  entryPoints: ["src/editor/player.tsx"],
  outfile: "server/editor/player.js",
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  jsx: "automatic",
  minify: true,
  sourcemap: false,
  legalComments: "none",
  loader: { ".json": "json" },
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "warning",
});
console.log(`player do editor compilado em ${((Date.now() - inicio) / 1000).toFixed(1)} s`);
