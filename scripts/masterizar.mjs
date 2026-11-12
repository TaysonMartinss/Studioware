// Masterização do áudio do vídeo final para o padrão das plataformas (YouTube, TikTok, Reels normalizam a ~-14 LUFS):
// mede o volume integrado (EBU R128) e ajusta em duas passagens, com pico real até -1 dBTP. O vídeo é copiado sem
// recodificar; só o áudio é refeito (AAC 192 kb/s, 48 kHz). Adaptado do motor de som do claude-motion (MIT).
// Uso: node scripts/masterizar.mjs out/<id>.mp4   (também é chamado no fim de cada render)
import { spawnSync } from "node:child_process";
import { existsSync, renameSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

export const ALVO_LUFS = -14;
const PICO = -1;
const FAIXA = 11;

// o ffmpeg que vem com o Remotion (não é preciso instalar nada)
const ffmpeg = () => {
  const require = createRequire(import.meta.url);
  try {
    const pasta = dirname(require.resolve("@remotion/compositor-win32-x64-msvc/package.json"));
    const exe = join(pasta, "ffmpeg.exe");
    if (existsSync(exe)) return exe;
  } catch {}
  return "ffmpeg";
};

const medir = (arquivo) => {
  const r = spawnSync(ffmpeg(), ["-hide_banner", "-nostats", "-i", arquivo, "-vn", "-af", `loudnorm=I=${ALVO_LUFS}:TP=${PICO}:LRA=${FAIXA}:print_format=json`, "-f", "null", "-"], { encoding: "utf-8", maxBuffer: 64 * 2 ** 20 });
  const texto = r.stderr ?? "";
  const json = texto.slice(texto.lastIndexOf("{"), texto.lastIndexOf("}") + 1);
  try { return JSON.parse(json); } catch { return null; }
};

export function masterizar(arquivo) {
  const m = medir(arquivo);
  if (!m || m.input_i === "-inf") return { ok: false, motivo: "sem áudio" };
  const antes = Number(m.input_i);
  const pico = Number(m.input_tp);
  // já está no alvo (±0,7 LU) e sem picos acima do limite: não mexe
  if (Math.abs(antes - ALVO_LUFS) <= 0.7 && pico <= PICO) return { ok: true, antes, depois: antes, mudou: false };
  const tmp = arquivo.replace(/\.mp4$/, ".master.mp4");
  const filtro = `loudnorm=I=${ALVO_LUFS}:TP=${PICO}:LRA=${FAIXA}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  const r = spawnSync(ffmpeg(), ["-hide_banner", "-y", "-i", arquivo, "-map", "0:v", "-map", "0:a", "-c:v", "copy", "-af", filtro, "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", tmp], { encoding: "utf-8", maxBuffer: 64 * 2 ** 20 });
  if (r.status !== 0 || !existsSync(tmp)) {
    rmSync(tmp, { force: true });
    return { ok: false, motivo: (r.stderr ?? "").split("\n").filter(Boolean).slice(-2).join(" ") };
  }
  renameSync(tmp, arquivo);
  const depois = Number(medir(arquivo)?.input_i ?? NaN);
  return { ok: true, antes, depois, mudou: true };
}

if (process.argv[1]?.endsWith("masterizar.mjs") && process.argv[2]) {
  const r = masterizar(process.argv[2]);
  console.log(r.ok ? `🔊 Volume: ${r.antes.toFixed(1)} → ${r.depois.toFixed(1)} LUFS${r.mudou ? "" : " (já estava no alvo)"}` : `⚠ Masterização não feita: ${r.motivo}`);
}
