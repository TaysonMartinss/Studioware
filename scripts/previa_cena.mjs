// Pré-visualização de uma cena no editor: um frame (imagem fixa) com o que está no roteiro agora, sem renderizar o vídeo.
// Se o vídeo já foi narrado, usa a duração e as palavras da narração (public/videos/<id>/manifest.json); senão, estima.
//   node scripts/previa_cena.mjs <id> <cena> [fração do tempo da cena, 0 a 1; padrão 0.6]
// Escreve out/previa/<id>-<cena>.jpg e imprime o caminho.
import { criarBundle } from "./bundle.mjs";
import { renderStill, selectComposition } from "@remotion/renderer";
import { existsSync, mkdirSync, readFileSync } from "node:fs";

const [id, n, fracao = "0.6"] = process.argv.slice(2);
const i = Number(n);
if (!/^[a-z0-9-]{1,80}$/.test(id ?? "") || !Number.isInteger(i)) throw new Error("uso: previa_cena.mjs <id> <cena>");
const r = JSON.parse(readFileSync(`roteiros/${id}.json`, "utf-8"));
const doRoteiro = r.cenas[i];
if (!doRoteiro) throw new Error(`a cena ${i + 1} não existe`);

// a narração (se já existe) dá a duração e o tempo de cada palavra; o resto vem do roteiro editado
const narrado = existsSync(`public/videos/${id}/manifest.json`) ? JSON.parse(readFileSync(`public/videos/${id}/manifest.json`, "utf-8")).cenas?.[i] : null;
const palavrasDe = (texto, passo = 330) => String(texto ?? "").replace(/\[[^\]]*\]/g, " ").split(/\s+/).filter(Boolean).map((t, k) => ({ texto: t, inicioMs: k * passo, fimMs: k * passo + passo - 30 }));
const estimadas = palavrasDe(doRoteiro.fala);
const cena = {
  ...doRoteiro,
  duracaoMs: narrado?.duracaoMs ?? doRoteiro.duracaoMs ?? Math.max(3500, estimadas.length * 330 + 600),
  palavras: narrado?.palavras ?? doRoteiro.palavras ?? estimadas,
};
const longo = r.formato === "longo";
const inputProps = { manifest: { id: `previa-${id}`, titulo: r.titulo ?? "", estilo: r.estilo, formato: r.formato, destaques: r.destaques ?? [], marcaDagua: false, cenas: [cena] } };

mkdirSync("out/previa", { recursive: true });
const serveUrl = await criarBundle();
const chromiumOptions = { gl: "angle" };
const composition = await selectComposition({ serveUrl, id: longo ? "VideoLongo" : "Video", inputProps, chromiumOptions });
const frame = Math.min(composition.durationInFrames - 1, Math.max(0, Math.round(composition.durationInFrames * Math.min(0.95, Math.max(0.05, Number(fracao) || 0.6)))));
const saida = `out/previa/${id}-${i}.jpg`;
await renderStill({ composition, serveUrl, inputProps, frame, output: saida, imageFormat: "jpeg", jpegQuality: 82, scale: longo ? 0.4 : 0.42, chromiumOptions, timeoutInMilliseconds: 120000 });
console.log(saida);
