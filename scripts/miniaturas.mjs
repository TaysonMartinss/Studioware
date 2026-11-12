// Gera uma miniatura real de cada estilo (frame de uma cena de exemplo) para o painel: server/miniaturas/<estilo>.jpg
// Correr de novo depois de mudar src/estilos.json:  node scripts/miniaturas.mjs
import { criarBundle } from "./bundle.mjs";
import { renderStill, selectComposition } from "@remotion/renderer";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const estilos = Object.keys(JSON.parse(readFileSync("src/estilos.json", "utf-8")));
const palavras = "a melhor escolha hoje".split(" ").map((texto, i) => ({ texto, inicioMs: i * 260, fimMs: i * 260 + 240 }));
// cena de produto: mostra etiqueta, título, painel, preço e barras (e não tem glitch, que estragaria a miniatura)
const cenas = [{
  tipo: "produto", rank: 1, categoria: "Placa de vídeo", icone: "gpu", nome: "RTX 5070", preco: "R$ 4.199", selo: "A partir de",
  tags: ["1440p", "DLSS 4"], specs: [{ label: "Desempenho", valor: 90 }, { label: "Preço", valor: 70 }], fala: "x", duracaoMs: 3000, palavras,
}];

mkdirSync("server/miniaturas", { recursive: true });
const serveUrl = await criarBundle();
for (const estilo of estilos) {
  const inputProps = { manifest: { id: "miniatura", titulo: "", estilo, destaques: ["três"], cenas } };
  const composition = await selectComposition({ serveUrl, id: "Video", inputProps });
  await renderStill({ composition, serveUrl, inputProps, frame: 70, output: `server/miniaturas/${estilo}.jpg`, imageFormat: "jpeg", jpegQuality: 80, scale: 0.3 });
  console.log(`✔ ${estilo}`);
}
