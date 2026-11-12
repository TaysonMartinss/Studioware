// Gera as capas (thumbnails) de um vídeo a partir do roteiro: 3 variantes (impacto, dividido, objeto) para escolher.
// Uso: node scripts/capa.mjs <id> [--texto "13 ANOS DE ESPERA"] [--destaque ESPERA] [--fundo 2] [--formato vertical|horizontal]
// Saída: out/capas/<id>-<layout>.jpg e out/capas/<id>.json (opções usadas e as mídias que podem ser fundo).
// 9:16 (1080×1920) para Shorts/Reels/TikTok; 16:9 em 1280×720 para o YouTube (limite de 2 MB).
import { criarBundle } from "./bundle.mjs";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [id, ...resto] = process.argv.slice(2);
if (!id) throw new Error("Uso: node scripts/capa.mjs <id> [--texto ...] [--destaque ...] [--fundo N] [--formato vertical|horizontal]");
const opcao = (nome) => { const i = resto.indexOf(`--${nome}`); return i >= 0 ? resto[i + 1] : undefined; };

const r = JSON.parse(readFileSync(`roteiros/${id}.json`, "utf-8"));
const existe = (m) => m?.arquivo && (m.arquivo.startsWith("procedural:") || existsSync(`public/${m.arquivo}`));

// mídias que podem ser fundo: as do gancho primeiro (é a imagem que prende), fotos antes de vídeos
const candidatos = [];
r.cenas.forEach((c, i) => {
  // nos cortes, as fotos e vídeos dos apoios também servem de fundo
  for (const m of [c.midia, c.esquerda?.midia, c.direita?.midia, ...(c.broll ?? []).map((b) => b.midia)]) {
    if (existe(m) && m.formato !== "modelo3d" && !candidatos.some((x) => x.arquivo === m.arquivo)) {
      candidatos.push({ arquivo: m.arquivo, formato: m.formato, inicioS: m.inicioS, cena: i, gancho: c.tipo === "gancho" });
    }
  }
});
candidatos.sort((a, b) => Number(b.gancho) - Number(a.gancho) || Number(a.formato === "video") - Number(b.formato === "video") || a.cena - b.cena);

// cortes e clipes: frames do próprio vídeo (a pessoa), já no enquadramento vertical do vídeo (rosto ou webcam),
// a 25%, 50% e 75% do corte. Ficam primeiro: num corte, a cara de quem fala é o que prende na capa.
const ffmpeg = (args) => spawnSync("npx", ["remotion", "ffmpeg", ...args].map((a) => (/[\s&()^"]/.test(a) ? `"${a}"` : a)), { shell: true, encoding: "utf-8" });
r.cenas.forEach((c, i) => {
  if (c.tipo !== "clipe" || !c.arquivo || !existsSync(`public/${c.arquivo}`)) return;
  const dur = (c.duracaoMs ?? 10000) / 1000, enq = c.enquadramento;
  [0.25, 0.5, 0.75].forEach((q, k) => {
    const t = dur * q;
    const arquivo = `videos/${r.id}/capa-clipe-${i}-${k}.jpg`;
    if (!existsSync(`public/${arquivo}`)) {
      mkdirSync(`public/videos/${r.id}`, { recursive: true });
      // recorte vertical: o x do corte nesse frame (modo seguir), a webcam (modo webcam) ou o centro
      let filtro = "crop=ih*9/16:ih";
      if (enq?.modo === "seguir" && enq.xs?.length && enq.cropLargura) filtro = `crop=${enq.cropLargura}:ih:${enq.xs[Math.min(enq.xs.length - 1, Math.round(t * enq.fps))]}:0`;
      else if (enq?.modo === "webcam") {
        const seg = [...(enq.segmentos ?? [])].reverse().find((sg) => sg.de <= t * enq.fps && (sg.cam || sg.rosto));
        const [x, y, w, h] = seg?.cam ?? seg?.rosto ?? [0, 0, enq.largura, enq.altura];
        filtro = seg?.cam ? `crop=${w}:${h}:${x}:${y}` : `crop=ih*9/16:ih:${Math.max(0, x + w / 2 - (enq.altura * 9) / 32)}:0`;
      } else if (enq?.modo === "passa" || (c.largura ?? 9) <= (c.altura ?? 16)) filtro = "null";
      const r2 = ffmpeg(["-y", "-loglevel", "error", "-ss", t.toFixed(2), "-i", `public/${c.arquivo}`, "-frames:v", "1", "-vf", `${filtro},scale=1080:-2`, "-q:v", "3", `public/${arquivo}`]);
      if (r2.status !== 0) { console.log(`⚠ frame do clipe ${i + 1} (${q * 100}%): ${(r2.stderr || "").slice(-200)}`); return; }
    }
    if (!candidatos.some((x) => x.arquivo === arquivo)) candidatos.push({ arquivo, formato: "imagem", cena: i, gancho: true, clipe: true });
  });
});
candidatos.sort((a, b) => Number(Boolean(b.clipe)) - Number(Boolean(a.clipe)) || Number(b.gancho) - Number(a.gancho) || Number(a.formato === "video") - Number(b.formato === "video") || a.cena - b.cena);

// objeto em destaque: um modelo 3D do vídeo (mídia 3D ou cena modelo3d), senão o hardware procedural de um produto
const objeto = (() => {
  // o objeto 3D de uma frase de efeito editorial (cortes) ou da tipografia
  for (const c of r.cenas) for (const o of [c.objeto, ...(c.broll ?? []).map((b) => b.cena?.objeto)]) if (o?.formato === "modelo3d" && existe(o)) return { arquivo: o.arquivo, formato: "modelo3d" };
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
candidatos.sort((a, b) => Number(Boolean(b.clipe)) - Number(Boolean(a.clipe)) || Number(Boolean(a.tresD)) - Number(Boolean(b.tresD)) || Number(b.gancho) - Number(a.gancho) || a.cena - b.cena);
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
// a capa escolhida (a que se baixa e vai para a biblioteca) é uma cópia: atualiza-a com a variante nova do mesmo layout
if (info.escolhida && existsSync(`out/capas/${id}-${info.escolhida}.jpg`)) copyFileSync(`out/capas/${id}-${info.escolhida}.jpg`, `out/${id}.capa.jpg`);
await browser.close({ silent: true });
console.log(JSON.stringify(info));
