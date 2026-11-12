// Transcreve um vídeo longo inteiro (para escolher os melhores momentos): palavras com tempos e frases.
// Uso: node scripts/transcrever_longo.mjs public/uploads/x.mp4 out/cortes/x/transcricao.json [--idioma pt]
// Fica em cache: se o JSON já existe e o vídeo não mudou, não volta a transcrever.
import { downloadWhisperModel, installWhisperCpp, toCaptions, transcribe } from "@remotion/install-whisper-cpp";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const WHISPER_DIR = resolve(".whisper");
const WHISPER_VERSAO = "1.5.5";
const MODELO = process.env.WHISPER_MODELO ?? "small";

const [video, saida] = process.argv.slice(2);
const idioma = process.argv.includes("--idioma") ? process.argv[process.argv.indexOf("--idioma") + 1] : "pt";
if (!video || !saida) { console.error("uso: node scripts/transcrever_longo.mjs <video> <saida.json>"); process.exit(1); }

const assinatura = `${statSync(video).size}-${statSync(video).mtimeMs}-${MODELO}`;
if (existsSync(saida) && JSON.parse(readFileSync(saida, "utf-8")).assinatura === assinatura) {
  console.log("transcrição em cache");
  process.exit(0);
}
mkdirSync(dirname(saida), { recursive: true });

const correr = (cmd, args) => {
  // com a shell (npx no Windows) os caminhos com espaços ("Tayson Martins") têm de ir entre aspas
  const shell = cmd === "npx";
  const r = spawnSync(cmd, shell ? args.map((a) => (/[\s&()^"]/.test(a) ? `"${a}"` : a)) : args, { encoding: "utf-8", shell });
  if (r.status !== 0) throw new Error(`${cmd} falhou: ${(r.stderr || r.stdout || "").slice(-800)}`);
  return r.stdout;
};

const duracao = Number(JSON.parse(correr("npx", ["remotion", "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", video])).format.duration);
const wav = saida.replace(/\.json$/, ".wav");
correr("npx", ["remotion", "ffmpeg", "-y", "-loglevel", "error", "-i", video, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav]);

await installWhisperCpp({ to: WHISPER_DIR, version: WHISPER_VERSAO, printOutput: false });
await downloadWhisperModel({ model: MODELO, folder: WHISPER_DIR, printOutput: false });
console.log(`a transcrever ${(duracao / 60).toFixed(1)} min (whisper ${MODELO})…`);
const { transcription } = await transcribe({
  inputPath: resolve(wav), whisperPath: WHISPER_DIR, whisperCppVersion: WHISPER_VERSAO, model: MODELO,
  modelFolder: WHISPER_DIR, tokenLevelTimestamps: true, language: idioma, printOutput: false,
});

// palavras (tokens sem espaço inicial pertencem à palavra anterior), em segundos
const palavras = [];
for (const c of toCaptions({ whisperCppOutput: { transcription } }).captions) {
  const t = c.text;
  if (!t.trim() || /^\[.*\]$/.test(t.trim())) continue;
  if (t.startsWith(" ") || !palavras.length) palavras.push({ w: t.trim(), s: c.startMs / 1000, e: c.endMs / 1000 });
  else Object.assign(palavras.at(-1), { w: palavras.at(-1).w + t, e: c.endMs / 1000 });
}
// tira as descrições de som do Whisper entre parênteses retos ("[SONS DA TORCIDA]"), mesmo partidas em várias palavras
for (let i = 0, dentro = false; i < palavras.length; ) {
  const w = palavras[i].w;
  if (w.startsWith("[")) dentro = true;
  const fecha = w.endsWith("]");
  if (dentro) { palavras.splice(i, 1); if (fecha) dentro = false; } else i++;
}
// frases: acabam na pontuação final ou numa pausa de mais de 0,8 s
const frases = [];
let atual = [];
palavras.forEach((p, i) => {
  atual.push(p);
  const prox = palavras[i + 1];
  if (!prox || /[.!?]$/.test(p.w) || prox.s - p.e > 0.8) {
    frases.push({ inicio: atual[0].s, fim: atual.at(-1).e, texto: atual.map((x) => x.w).join(" ") });
    atual = [];
  }
});
writeFileSync(saida, JSON.stringify({ assinatura, duracao, idioma, palavras, frases }));
console.log(`✔ ${palavras.length} palavras, ${frases.length} frases`);
