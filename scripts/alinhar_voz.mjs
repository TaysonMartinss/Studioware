// Tempos das palavras de um áudio narrado por um motor que não os dá (Chatterbox): transcreve com o Whisper
// e imprime [{texto, inicioMs, fimMs}]. O narrar.py alinha depois estas palavras com o texto do roteiro.
// Uso: node scripts/alinhar_voz.mjs audio.wav [idioma]   (WAV 16 kHz mono)
import { toCaptions, transcribe } from "@remotion/install-whisper-cpp";
import { resolve } from "node:path";

const WHISPER_DIR = resolve(".whisper");
const [wav, idioma = "pt"] = process.argv.slice(2);
const { transcription } = await transcribe({
  inputPath: resolve(wav), whisperPath: WHISPER_DIR, whisperCppVersion: "1.5.5", model: process.env.WHISPER_MODELO ?? "small",
  modelFolder: WHISPER_DIR, tokenLevelTimestamps: true, language: idioma, printOutput: false,
});
const palavras = [];
for (const c of toCaptions({ whisperCppOutput: { transcription } }).captions) {
  const t = c.text;
  if (!t.trim() || /^\[.*\]$/.test(t.trim())) continue;
  if (t.startsWith(" ") || !palavras.length) palavras.push({ texto: t.trim(), inicioMs: c.startMs, fimMs: c.endMs });
  else Object.assign(palavras.at(-1), { texto: palavras.at(-1).texto + t, fimMs: c.endMs });
}
process.stdout.write(JSON.stringify(palavras));
