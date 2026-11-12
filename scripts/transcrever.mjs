// Cenas "clipe" (vídeos gravados por si): corta silêncios com o Auto-Editor e transcreve com o Whisper (legendas palavra a palavra).
// Uso: node scripts/transcrever.mjs roteiros/x.json [--forcar]
import { downloadWhisperModel, installWhisperCpp, toCaptions, transcribe } from "@remotion/install-whisper-cpp";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const WHISPER_DIR = resolve(".whisper");
const WHISPER_VERSAO = "1.5.5";
const MODELO = process.env.WHISPER_MODELO ?? "small"; // "medium" é mais preciso em PT, mas ~1.5 GB

const correr = (cmd, args, opcoes = {}) => {
  const r = spawnSync(cmd, args, { encoding: "utf-8", shell: cmd === "npx", ...opcoes });
  if (r.status !== 0) throw new Error(`${cmd} falhou: ${(r.stderr || r.stdout || "").slice(-800)}`);
  return r.stdout;
};

const caminho = process.argv[2];
const forcar = process.argv.includes("--forcar");
const roteiro = JSON.parse(readFileSync(caminho, "utf-8"));
const pasta = `public/videos/${roteiro.id}`;
mkdirSync(pasta, { recursive: true });
mkdirSync("out/whisper", { recursive: true });

const clipes = roteiro.cenas.map((c, i) => [c, i]).filter(([c]) => c.tipo === "clipe" && (forcar || !c.palavras?.length));
if (clipes.length) {
  // instala o whisper.cpp e o modelo só na primeira vez
  await installWhisperCpp({ to: WHISPER_DIR, version: WHISPER_VERSAO, printOutput: false });
  await downloadWhisperModel({ model: MODELO, folder: WHISPER_DIR, printOutput: false });
}

for (const [cena, i] of clipes) {
  const bruto = `public/${cena.bruto}`;
  if (!existsSync(bruto)) throw new Error(`não existe ${bruto}`);
  const cortado = `${pasta}/clipe-${i}.mp4`;

  // momento escolhido num vídeo longo: recorta primeiro o trecho [inicio, fim] (em segundos do original)
  let origem = bruto;
  if (cena.inicio !== undefined && cena.fim !== undefined) {
    origem = `out/whisper/${roteiro.id}-${i}-trecho.mp4`;
    console.log(`  ✂ cena ${i + 1}: a recortar ${cena.inicio.toFixed(1)}s–${cena.fim.toFixed(1)}s…`);
    correr("npx", ["remotion", "ffmpeg", "-y", "-loglevel", "error", "-ss", String(cena.inicio), "-to", String(cena.fim), "-i", bruto,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-c:a", "aac", "-b:a", "192k", origem]);
  }
  if (cena.cortar !== false) {
    console.log(`  ✂ cena ${i + 1}: a cortar silêncios…`);
    correr("python", ["-m", "auto_editor", origem, "--margin", `${cena.margem ?? 0.15}sec`, "--no-open", "-o", cortado]);
  } else {
    copyFileSync(origem, cortado);
  }

  const info = JSON.parse(correr("npx", ["remotion", "ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", cortado]));
  const wav = `out/whisper/${roteiro.id}-${i}.wav`;
  correr("npx", ["remotion", "ffmpeg", "-y", "-loglevel", "error", "-i", cortado, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav]);

  console.log(`  📝 cena ${i + 1}: a transcrever (whisper ${MODELO})…`);
  const { transcription } = await transcribe({
    inputPath: resolve(wav), whisperPath: WHISPER_DIR, whisperCppVersion: WHISPER_VERSAO, model: MODELO,
    modelFolder: WHISPER_DIR, tokenLevelTimestamps: true, language: roteiro.idioma ?? "pt", printOutput: false,
  });
  // tokens sem espaço inicial pertencem à palavra anterior
  const palavras = [];
  for (const c of toCaptions({ whisperCppOutput: { transcription } }).captions) {
    const t = c.text;
    if (!t.trim() || /^\[.*\]$/.test(t.trim())) continue;
    if (t.startsWith(" ") || !palavras.length) palavras.push({ texto: t.trim(), inicioMs: c.startMs, fimMs: c.endMs });
    else Object.assign(palavras.at(-1), { texto: palavras.at(-1).texto + t, fimMs: c.endMs });
  }

  // tira as descrições de som do Whisper entre parênteses retos ("[MÚSICA]"), mesmo partidas em várias palavras
  for (let k = 0, dentro = false; k < palavras.length; ) {
    const w = palavras[k].texto;
    if (w.startsWith("[")) dentro = true;
    const fecha = w.endsWith("]");
    if (dentro) { palavras.splice(k, 1); if (fecha) dentro = false; } else k++;
  }
  Object.assign(cena, {
    arquivo: cortado.replace(/^public\//, ""), palavras,
    duracaoMs: Math.round(Number(info.format.duration) * 1000),
    largura: info.streams[0]?.width, altura: info.streams[0]?.height,
  });
  cena.fala ||= palavras.map((p) => p.texto).join(" ");

  // vídeo horizontal: enquadramento automático no rosto (ou no movimento) para o vertical
  if (cena.enquadrar !== false && (cena.largura ?? 0) > (cena.altura ?? 0)) {
    console.log(`  🎯 cena ${i + 1}: a enquadrar no rosto…`);
    const json = `out/whisper/${roteiro.id}-${i}-enquadramento.json`;
    correr("python", ["scripts/reframe.py", cortado, json], { env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
    cena.enquadramento = JSON.parse(readFileSync(json, "utf-8"));
  }
  console.log(`  🎬 cena ${i + 1}: ${(cena.duracaoMs / 1000).toFixed(1)}s, ${palavras.length} palavras`);
}

writeFileSync(caminho, JSON.stringify(roteiro, null, 2));
