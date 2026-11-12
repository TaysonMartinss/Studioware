// Pipeline completo: roteiro JSON -> narração + legendas -> render MP4 vertical em out/
// Uso: npm run video -- roteiros/a.json [roteiros/b.json ...]
import { criarBundle } from "./bundle.mjs";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { escolherMusica } from "./musica.mjs";
import { ALVO_LUFS, masterizar } from "./masterizar.mjs";

const correr = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: "inherit", env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
  if (r.status !== 0) throw new Error(`Falhou: ${cmd} ${args.join(" ")}`);
};

const roteiros = process.argv.slice(2);
if (!roteiros.length) {
  console.error("Uso: npm run video -- roteiros/<video>.json");
  process.exit(1);
}

if (!existsSync("public/sfx/rasgo.wav")) correr("python", ["scripts/sfx.py"]);
mkdirSync("out", { recursive: true });

// WebGL (cenas 3D) no Windows precisa do ANGLE; a API Node não lê o remotion.config.ts
const CHROMIUM = { gl: "angle" };

// No Windows não se pode substituir um ficheiro aberto (vídeo antigo a tocar no painel ou num leitor,
// antivírus a analisá-lo). Renderiza-se à parte e troca-se no fim, com novas tentativas.
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const substituir = async (novo, destino) => {
  for (let t = 0; t < 20; t++) {
    try { return renameSync(novo, destino); } catch (e) { if (e.code !== "EPERM" && e.code !== "EBUSY") throw e; }
    await espera(750);
  }
  // ainda preso: afasta o antigo (mover um ficheiro aberto costuma ser permitido) e põe o novo no lugar
  try {
    mkdirSync("out/.antigos", { recursive: true });
    renameSync(destino, `out/.antigos/${basename(destino, ".mp4")}-${Date.now()}.mp4`);
    return renameSync(novo, destino);
  } catch {
    throw new Error(`O vídeo antigo ${destino} está aberto noutro programa. Feche-o; o novo ficou em ${novo}`);
  }
};

// Capítulos do YouTube para a descrição: "0:00 Título" com os tempos reais da narração
// (o YouTube pede o primeiro em 0:00 e pelo menos 3 capítulos de 10 s ou mais)
const FPS = 30;
const PAD_MS = 250;
const relogio = (s) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = String(Math.floor(s % 60)).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
};
const escreverCapitulos = (id, manifest) => {
  let frames = 0;
  const caps = [];
  for (const c of manifest.cenas) {
    if (c.tipo === "capitulo") caps.push({ s: frames / FPS, titulo: c.titulo });
    frames += Math.ceil((((c.duracaoMs ?? 3000) + PAD_MS) / 1000) * FPS);
  }
  if (!caps.length) return;
  if (caps[0].s > 0) caps.unshift({ s: 0, titulo: "Introdução" });
  const texto = [manifest.legenda_post ?? "", "", ...caps.map((c) => `${relogio(c.s)} ${c.titulo}`)].join("\n").trim();
  writeFileSync(`out/${id}.descricao.txt`, texto + "\n");
  console.log(`📑 ${caps.length} capítulos -> out/${id}.descricao.txt (duração ${relogio(frames / FPS)})`);
};

const ids = roteiros.map((r) => JSON.parse(readFileSync(r, "utf-8")).id);

console.log("[etapa] midia");
roteiros.forEach((r) => correr("python", ["scripts/buscar_midia.py", r])); // só descarrega o que ainda falta
roteiros.forEach((r) => correr("python", ["scripts/manim_cenas.py", r])); // só renderiza o que mudou
console.log("[etapa] clipes");
roteiros.forEach((r) => correr(process.execPath, ["scripts/transcrever.mjs", r]));

console.log("[etapa] narracao");
roteiros.forEach((r, i) => {
  console.log(`▶ ${ids[i]} (${basename(r)})`);
  correr("python", ["scripts/narrar.py", r]);
});

// o bundle copia public/, por isso só depois das narrações existirem
console.log("[etapa] preparar");
const serveUrl = await criarBundle();

for (const id of ids) {
  const manifest = JSON.parse(readFileSync(`public/videos/${id}/manifest.json`, "utf-8"));
  // música de fundo: "auto" escolhe pelo estilo/formato na biblioteca public/musicas/
  manifest.musica = escolherMusica(manifest);
  console.log(manifest.musica ? `♪ Música: ${manifest.musica}` : "♪ Sem música");
  const inputProps = { manifest };
  writeFileSync(`out/${id}.props.json`, JSON.stringify(inputProps));

  console.log("[etapa] render");
  const longo = manifest.formato === "longo";
  if (longo) escreverCapitulos(id, manifest);
  const composition = await selectComposition({ serveUrl, id: longo ? "VideoLongo" : "Video", inputProps, chromiumOptions: CHROMIUM });
  let ultimo = -1;
  await renderMedia({
    composition, serveUrl, inputProps, codec: "h264", outputLocation: `out/.render/${id}.mp4`, chromiumOptions: CHROMIUM,
    // Os b-rolls ficam em cache de frames; sem limite a cache chega a ~5 GB e, num vídeo longo, a memória acaba
    // a meio e o codificador morre (EPIPE). Limita-se a cache e, no 16:9 (frames maiores), as páginas em paralelo.
    offthreadVideoCacheSizeInBytes: 1536 * 2 ** 20,
    ...(longo && { concurrency: 5 }),
    onProgress: ({ progress }) => {
      const p = Math.floor(progress * 100);
      if (p >= ultimo + 5) console.log(`[progresso] ${(ultimo = p)}`);
    },
  });
  // volume final no padrão das plataformas (-14 LUFS); se falhar, o vídeo segue como saiu do render
  console.log("[etapa] masterizar");
  const m = masterizar(`out/.render/${id}.mp4`);
  console.log(m.ok ? `🔊 Volume: ${m.antes.toFixed(1)} → ${m.depois.toFixed(1)} LUFS (alvo ${ALVO_LUFS})` : `⚠ Volume não ajustado: ${m.motivo}`);
  await substituir(`out/.render/${id}.mp4`, `out/${id}.mp4`);
  console.log(`✔ out/${id}.mp4`);
}
