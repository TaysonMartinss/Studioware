// Gera as miniaturas dos apoios visuais dos cortes (o seletor de tipo, variação e fundo no editor):
// server/miniaturas/apoio-<chave>.jpg. Cada uma é um frame real do estúdio, com um exemplo do que a opção faz.
// As imagens de exemplo são renderizadas pelo próprio estúdio (cena low poly), sem fotos de terceiros.
// Correr de novo quando mudar o visual de um apoio:  node scripts/miniaturas_apoios.mjs [chave ...]
import { criarBundle } from "./bundle.mjs";
import { renderStill, selectComposition } from "@remotion/renderer";
import { existsSync, mkdirSync } from "node:fs";

const pedidos = process.argv.slice(2);
const IMAGEM = "studioware/exemplo-cidade.jpg"; // gerada no primeiro passo (public/)
const palavras = (texto, passo = 230) => texto.split(" ").map((t, i) => ({ texto: t, inicioMs: i * passo, fimMs: i * passo + passo - 20 }));
const frase = "o segredo é a consistência";
const objeto = { fonte: "polyhaven", modelo: "Camera_01", arquivo: "modelos/polyhaven/Camera_01/Camera_01_1k.gltf", formato: "modelo3d" };
const imagem = { fonte: "arquivo", consulta: IMAGEM, arquivo: IMAGEM, formato: "imagem" };
const tipografia = (extra) => ({ tipo: "tipografia", fala: frase, duracaoMs: 4000, palavras: palavras(frase), chaves: ["consistência"], objeto, ...extra });

// [chave, estilo, cena, frame]
const ITENS = [
  ["cidade", "editorial", { tipo: "lowpoly", fala: "x", duracaoMs: 4000, palavras: palavras("uma cidade"), cenario: "cidade", hora: "tarde", plano: "aberto", camera: "estatica" }, 50],
  ["tipografia-centro", "editorial", tipografia({ layout: "centro", fundo: "papel" }), 75],
  ["tipografia-dividido", "editorial", tipografia({ layout: "dividido", fundo: "papel" }), 75],
  ["tipografia-titulo", "editorial", { tipo: "gancho", fala: frase, duracaoMs: 4000, palavras: palavras(frase), texto_tela: frase, midia: objeto }, 60],
  ["fundo-papel", "editorial", tipografia({ layout: "centro", fundo: "papel", objeto: undefined }), 75],
  ["fundo-topografia", "editorial", tipografia({ layout: "centro", fundo: "topografia", objeto: undefined }), 75],
  ["fundo-grelha", "editorial", tipografia({ layout: "centro", fundo: "grelha", objeto: undefined }), 75],
  ["fundo-tunel", "editorial", tipografia({ layout: "centro", fundo: "tunel", objeto: undefined }), 75],
  ["dado", "editorial", { tipo: "dado", fala: "x", duracaoMs: 4000, palavras: [], valor: 475, sufixo: " mil", rotulo: "views em 24 horas", barras: [{ rotulo: "2022", valor: 120 }, { rotulo: "2023", valor: 260 }, { rotulo: "2024", valor: 475 }], fundo: "papel" }, 80],
  ["calendario", "editorial", { tipo: "calendario", fala: "x", duracaoMs: 4000, palavras: [], de: "2010", ate: "2023", fundo: "papel" }, 58],
  ["numero", "neon", { tipo: "numero", fala: "x", duracaoMs: 4000, palavras: [], valor: 8, sufixo: " s", texto: "de atenção média" }, 70],
  ["palavras", "neon", { tipo: "palavras", fala: "x", duracaoMs: 4000, palavras: [], textos: ["MEDO", "ANSIEDADE"], fundo: "escuro" }, 50],
  ["faixa", "neon", { tipo: "faixa", fala: "x", duracaoMs: 4000, palavras: [], titulo: "13 ANOS", midia: imagem }, 45],
  ["passeio", "neon", { tipo: "print", fala: "x", duracaoMs: 5000, palavras: [], midia: imagem }, 40],
  ["passeio-cheio", "neon", { tipo: "print", fala: "x", duracaoMs: 5000, palavras: [], midia: imagem, telaCheia: true }, 40],
  ["lowpoly", "neon", { tipo: "lowpoly", fala: "x", duracaoMs: 4000, palavras: [], cenario: "espaco", variante: "sistema_solar", hora: "noite" }, 60],
];
// os cenários da animação 3D (o seletor de cenário no editor): cada um com uma personagem, num plano aberto
const CENARIOS = ["estudio", "cidade", "quarto", "sala_estar", "natureza", "estadio", "corrida", "espaco", "planeta", "laboratorio", "hospital", "sala_aula", "bolsa", "estudio_jogos", "nave", "fundo_mar", "pre_historia", "abrigo", "planeta_alien", "oficina_relojoaria", "boutique_luxo", "balada", "lounge", "banheiro_balada", "carnaval", "rua_sp", "quarto_escuro", "consultorio", "brasilia", "plenario", "supermercado"];
const SEM_PESSOA = ["espaco", "planeta", "bolsa", "fundo_mar"];
for (const cen of CENARIOS) ITENS.push([`cenario-${cen}`, "neon", { tipo: "lowpoly", fala: "x", duracaoMs: 4000, palavras: [], cenario: cen, hora: cen === "cidade" ? "tarde" : "dia", plano: "aberto", camera: "estatica",
  ...(SEM_PESSOA.includes(cen) ? {} : { personagens: [{ visual: cen === "hospital" ? "medico" : cen === "laboratorio" ? "cientista" : cen === "nave" ? "astronauta" : "pessoa", acao: "acenar", expressao: "feliz" }] }) }, 50]);

mkdirSync("server/miniaturas", { recursive: true });
const serveUrl = await criarBundle();
for (const [chave, estilo, cena, frame] of ITENS) {
  if (pedidos.length && !pedidos.includes(chave)) continue;
  const inputProps = { manifest: { id: `apoio-${chave}`, titulo: "", estilo, destaques: [], marcaDagua: false, cenas: [cena] } };
  const composition = await selectComposition({ serveUrl, id: "Video", inputProps, chromiumOptions: { gl: "angle" } });
  const exemplo = chave === "cidade";
  if (exemplo && existsSync(`public/${IMAGEM}`) && !pedidos.includes("cidade")) continue;
  await renderStill({
    composition, serveUrl, inputProps, frame, imageFormat: "jpeg", chromiumOptions: { gl: "angle" }, timeoutInMilliseconds: 120000,
    ...(exemplo ? { output: `public/${IMAGEM}`, jpegQuality: 88 } : { output: `server/miniaturas/apoio-${chave}.jpg`, jpegQuality: 78, scale: 0.25 }),
  });
  console.log(`✔ ${chave}`);
}
