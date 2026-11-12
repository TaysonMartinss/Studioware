// Gera as capas (thumbnails) de um vídeo a partir do roteiro: 3 variantes (impacto, dividido, objeto) para escolher.
// Uso: node scripts/capa.mjs <id> [--texto "13 ANOS DE ESPERA"] [--destaque ESPERA] [--fundo 2] [--formato vertical|horizontal]
// Saída: out/capas/<id>-<layout>.jpg e out/capas/<id>.json (opções usadas e as mídias que podem ser fundo).
// 9:16 (1080×1920) para Shorts/Reels/TikTok; 16:9 em 1280×720 para o YouTube (limite de 2 MB).
import { criarBundle } from "./bundle.mjs";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [id, ...resto] = process.argv.slice(2);
if (!id) throw new Error("Uso: node scripts/capa.mjs <id> [--texto ...] [--destaque ...] [--fundo N] [--formato vertical|horizontal]");
const opcao = (nome) => { const i = resto.indexOf(`--${nome}`); return i >= 0 ? resto[i + 1] : undefined; };

const r = JSON.parse(readFileSync(`roteiros/${id}.json`, "utf-8"));
const existe = (m) => m?.arquivo && (m.arquivo.startsWith("procedural:") || existsSync(`public/${m.arquivo}`));

// mídias que podem ser fundo: as do gancho primeiro (é a imagem que prende), fotos antes de vídeos
const candidatos = [];
r.cenas.forEach((c, i) => {
  for (const m of [c.midia, c.esquerda?.midia, c.direita?.midia]) {
    if (existe(m) && m.formato !== "modelo3d" && !candidatos.some((x) => x.arquivo === m.arquivo)) {
      candidatos.push({ arquivo: m.arquivo, formato: m.formato, inicioS: m.inicioS, cena: i, gancho: c.tipo === "gancho" });
    }
  }
});
candidatos.sort((a, b) => Number(b.gancho) - Number(a.gancho) || Number(a.formato === "video") - Number(b.formato === "video") || a.cena - b.cena);

// objeto em destaque: um modelo 3D do vídeo (mídia 3D ou cena modelo3d), senão o hardware procedural de um produto
const objeto = (() => {
  for (const c of r.cenas) if (c.midia?.formato === "modelo3d" && existe(c.midia)) return { arquivo: c.midia.arquivo, formato: "modelo3d" };
  for (const c of r.cenas) if (c.tipo === "modelo3d") return { arquivo: c.modelo?.arquivo && existsSync(`public/${c.modelo.arquivo}`) ? c.modelo.arquivo : `procedural:${c.procedural ?? "gpu"}`, formato: "modelo3d" };
  const hw = r.cenas.find((c) => c.tipo === "produto" && ["gpu", "cpu", "ram", "ssd"].includes(c.icone));
  return hw ? { arquivo: `procedural:${hw.icone}`, formato: "modelo3d" } : undefined;
})();

const anterior = existsSync(`out/capas/${id}.json`) ? JSON.parse(readFileSync(`out/capas/${id}.json`, "utf-8")) : {};
const texto = (opcao("texto") ?? anterior.texto ?? r.thumbnail ?? r.titulo.split(/\s+/).slice(0, 5).join(" ")).trim();
const destaque = opcao("destaque") ?? (opcao("texto") ? undefined : anterior.destaque);
const fundoI = Math.max(0, Math.min(candidatos.length - 1, Number(opcao("fundo") ?? anterior.fundo ?? 0)));
const formato = opcao("formato") ?? anterior.formato ?? (r.formato === "longo" ? "horizontal" : "vertical");
const fundo = candidatos[fundoI];

mkdirSync("out/capas", { recursive: true });
console.log("[etapa] preparar");
const serveUrl = await criarBundle();
// um só browser para todas as imagens (abrir um por imagem demora e chega a passar o limite de 30 s)
const browser = await openBrowser("chrome", { chromiumOptions: { gl: "angle" } });
const comum = { serveUrl, puppeteerInstance: browser, chromiumOptions: { gl: "angle" }, timeoutInMilliseconds: 120000 };

// vídeos em animação 3D não têm fotos: tira um frame limpo (sem textos) das cenas low poly, a meio de cada uma,
// e usa-o como fundo. Guarda-se por assinatura da cena, para não voltar a renderizar o que não mudou.
const cenas3D = r.cenas.map((c, i) => ({ c, i })).filter(({ c }) => c.tipo === "lowpoly").slice(0, 3);
for (const { c, i } of cenas3D) {
  const { audio, palavras, duracaoMs, falaMs, ...limpa } = c;
  const assinatura = createHash("sha1").update(JSON.stringify([limpa, r.estilo, formato])).digest("hex").slice(0, 10);
  const arquivo = `videos/${id}/capa3d-${i}-${assinatura}.jpg`;
  if (!existsSync(`public/${arquivo}`)) {
    mkdirSync(`public/videos/${id}`, { recursive: true });
    const inputProps = { cena: { ...limpa, duracaoMs: c.duracaoMs ?? 4000 }, estilo: r.estilo, formato };
    const composition = await selectComposition({ ...comum, id: "Quadro3D", inputProps });
    const segundo = Math.min(2.5, ((c.duracaoMs ?? 4000) / 1000) * 0.55); // depois das entradas, antes do fim
    await renderStill({ ...comum, composition, inputProps, frame: Math.round(segundo * 30), output: `public/${arquivo}`, imageFormat: "jpeg", jpegQuality: 92 });
    console.log(`✔ fundo 3D da cena ${i + 1}: public/${arquivo}`);
  }
  if (!candidatos.some((x) => x.arquivo === arquivo)) candidatos.push({ arquivo, formato: "imagem", cena: i, gancho: i === 0, tresD: true });
}
// as fotos reais continuam primeiro; os frames 3D entram pela ordem das cenas (o da abertura primeiro)
candidatos.sort((a, b) => Number(Boolean(a.tresD)) - Number(Boolean(b.tresD)) || Number(b.gancho) - Number(a.gancho) || a.cena - b.cena);
const fundoFinal = candidatos[Math.max(0, Math.min(candidatos.length - 1, Number(opcao("fundo") ?? anterior.fundo ?? 0)))];
const variantes = [];
for (const layout of ["impacto", "dividido", "objeto"]) {
  const inputProps = { estilo: r.estilo, texto, destaque, layout, formato, fundo: fundoFinal && { arquivo: fundoFinal.arquivo, formato: fundoFinal.formato, inicioS: fundoFinal.inicioS }, objeto };
  const composition = await selectComposition({ ...comum, id: "Capa", inputProps });
  const saida = `out/capas/${id}-${layout}.jpg`;
  await renderStill({
    ...comum, composition, inputProps, frame: 0, output: saida, imageFormat: "jpeg", jpegQuality: 90,
    scale: formato === "horizontal" ? 1280 / 1920 : 1,
  });
  variantes.push(layout);
  console.log(`✔ ${saida}`);
}
const info = { texto, destaque, fundo: fundoI, formato, candidatos, variantes, escolhida: anterior.escolhida, geradoEm: new Date().toISOString() };
writeFileSync(`out/capas/${id}.json`, JSON.stringify(info, null, 2));
await browser.close({ silent: true });
console.log(JSON.stringify(info));
