// Biblioteca de música de fundo: public/musicas/<clima>/*.mp3 + public/musicas/catalogo.json (título, artista, crédito)
// Usada pelo pipeline (escolher a faixa) e pelo painel (gerir a biblioteca).
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const CLIMAS = {
  energetica: "Energética",
  tensa: "Tensa / suspense",
  ambiente: "Ambiente / explicativo",
  synthwave: "Synthwave / retro",
  lofi: "Lo-fi / calma",
};

// faixas que vêm com o projeto (geradas por scripts/gerar_musicas.py)
const GERADAS = new Set(["pulso-a", "contagem", "orbita", "neon-1985", "tarde-fria"]);

export const lerCatalogo = (raiz = ".") => {
  const f = join(raiz, "public/musicas/catalogo.json");
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf-8")) : {};
};
export const gravarCatalogo = (catalogo, raiz = ".") =>
  writeFileSync(join(raiz, "public/musicas/catalogo.json"), JSON.stringify(catalogo, null, 2));

export const listarMusicas = (raiz = ".") => {
  const pasta = join(raiz, "public/musicas");
  if (!existsSync(pasta)) return [];
  const catalogo = lerCatalogo(raiz);
  return readdirSync(pasta, { withFileTypes: true })
    .filter((d) => d.isDirectory() && CLIMAS[d.name])
    .flatMap((d) => readdirSync(join(pasta, d.name))
      .filter((f) => /\.(mp3|wav|m4a|ogg)$/i.test(f))
      .map((f) => {
        const arquivo = `musicas/${d.name}/${f}`;
        const base = f.replace(/\.\w+$/, "");
        const info = catalogo[arquivo] ?? {};
        return {
          arquivo, clima: d.name, nome: info.titulo || base.replace(/[-_]+/g, " "),
          artista: info.artista ?? (GERADAS.has(base) ? "Estúdio (gerada)" : ""), credito: info.credito ?? "",
          origem: info.origem ?? (GERADAS.has(base) ? "Gerada pelo projeto" : "Enviada"), bpm: info.bpm, duracaoS: info.duracaoS,
          climaSugerido: info.climaSugerido,
        };
      }));
};

// clima automático: o estilo manda quando tem uma sonoridade óbvia; senão, o formato
export const POR_ESTILO = { vox: "ambiente", aquarela: "lofi", vhs: "synthwave", hud: "tensa", cyber: "tensa", hormozi: "energetica", explicativo: "ambiente", matematica: "ambiente", papel: "lofi", corporativo: "lofi", clean: "lofi" };
export const POR_FORMATO = { quiz: "energetica", livre: "ambiente", ese: "tensa", animado: "tensa", storytelling: "tensa", ranking: "energetica", curiosidades: "energetica", explicativo: "ambiente", clipe: "lofi" };

export const climaAutomatico = (roteiro) => POR_ESTILO[roteiro.estilo] ?? POR_FORMATO[roteiro.formato] ?? "energetica";

// Devolve o caminho (em public/) da faixa a usar, ou undefined para vídeo sem música
export const escolherMusica = (roteiro, raiz = ".") => {
  const pedido = roteiro.musica ?? "auto";
  if (pedido === "nenhuma") return undefined;
  if (pedido.includes("/")) return existsSync(join(raiz, "public", pedido)) ? pedido : undefined;
  const todas = listarMusicas(raiz);
  const clima = pedido === "auto" ? climaAutomatico(roteiro) : pedido;
  // faixas importadas (ex.: YouTube Audio Library) têm prioridade sobre as geradas
  const doClima = todas.filter((m) => m.clima === clima);
  const reais = doClima.filter((m) => m.origem !== "Gerada pelo projeto");
  const lista = reais.length ? reais : doClima.length ? doClima : todas;
  if (!lista.length) return existsSync(join(raiz, "public/musica.mp3")) ? "musica.mp3" : undefined;
  // escolha estável por vídeo (o mesmo id dá sempre a mesma faixa)
  const h = [...(roteiro.id ?? "")].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  return lista[h % lista.length].arquivo;
};
