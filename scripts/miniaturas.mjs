// Miniaturas dos estilos para o painel (server/miniaturas/<estilo>.jpg), no mesmo formato da galeria do README:
// um frame vertical de uma cena que mostra o estilo (405×720).
// - Os estilos de fábrica usam as próprias imagens do README (docs/exemplos/).
// - Os outros (os aprendidos e os antigos) renderizam a cena de número, a que mais mostra o estilo: a cor de destaque,
//   a letra dos títulos e o fundo. Também serve de teste: o servidor corre isto depois de aprender ou refinar um
//   estilo, e se o render falhar os efeitos novos voltam atrás.
// Correr de novo depois de mudar src/estilos.json:  node scripts/miniaturas.mjs [id ...]
import { criarBundle } from "./bundle.mjs";
import { renderStill, selectComposition } from "@remotion/renderer";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";

const DO_README = { neon: "lowpoly-neon", pixel: "pixel3d", editorial: "editorial-dividido", vice: "vice-sunset" };
const todos = JSON.parse(readFileSync("src/estilos.json", "utf-8"));
const pedidos = process.argv.slice(2);
const ids = pedidos.length ? pedidos : Object.keys(todos);

const palavras = (texto, passo = 230) => texto.split(" ").map((t, i) => ({ texto: t, inicioMs: i * passo, fimMs: i * passo + passo - 20 }));
const frase = "oito segundos de atenção";
const CENA = { tipo: "numero", fala: frase, duracaoMs: 4000, palavras: palavras(frase), valor: 8, sufixo: " s", texto: "de atenção média" };

mkdirSync("server/miniaturas", { recursive: true });
let serveUrl;
for (const id of ids) {
  const e = todos[id];
  if (!e) { console.error(`✘ ${id}: não existe`); process.exitCode = 1; continue; }
  const readme = DO_README[id] && `docs/exemplos/${DO_README[id]}.jpg`;
  if (readme && existsSync(readme)) { copyFileSync(readme, `server/miniaturas/${id}.jpg`); console.log(`✔ ${id} (README)`); continue; }
  serveUrl ??= await criarBundle();
  const inputProps = { manifest: { id: `miniatura-${id}`, titulo: "", estilo: id, destaques: ["atenção"], marcaDagua: false, cenas: [CENA] } };
  const composition = await selectComposition({ serveUrl, id: "Video", inputProps, chromiumOptions: { gl: "angle" } });
  await renderStill({ composition, serveUrl, inputProps, frame: 70, output: `server/miniaturas/${id}.jpg`, imageFormat: "jpeg", jpegQuality: 80, scale: 0.375, chromiumOptions: { gl: "angle" }, timeoutInMilliseconds: 120000 });
  console.log(`✔ ${id}`);
}
