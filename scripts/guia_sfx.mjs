// Gera .claude/skills/novo-video/sons-meme.md (o guia de sons de efeito que a IA segue) a partir do catálogo
// public/sfx/catalogo.json. Correr de novo sempre que se acrescentam ou mudam sons:  node scripts/guia_sfx.mjs
import { readFileSync, writeFileSync } from "node:fs";

const catalogo = JSON.parse(readFileSync("public/sfx/catalogo.json", "utf-8"));
const porCategoria = {};
for (const [id, s] of Object.entries(catalogo)) if (s.auto) (porCategoria[s.categoria] ??= []).push([id, s]);

const linhas = [
  "# Sons de efeito populares (portfólio de SFX)",
  "",
  "Sons de meme e de edição que o público reconhece, marcados num momento exato da fala. Usam-se com moderação:",
  "**no máximo 2 por corte de 30 a 60 s** (3 num vídeo longo), nunca dois seguidos, e só quando o momento pede mesmo.",
  "Um som certo no sítio certo prende; um som em cada frase cansa e parece amador. Prefira o som que combina com o",
  "**tom do canal** e da frase; não use nenhum num tema sério (morte, doença, tragédia, notícias tristes).",
  "Os sons de \"Trilha de momento\" são trechos de música: servem para um momento de 5 a 8 s, não para o vídeo todo.",
  "",
  "## Formato",
  "",
  "- Nos cortes (resposta dos exemplos visuais): `\"sons\": [{\"nome\": \"<id>\", \"em\": 12.3}]`, com `em` em segundos do corte",
  "  (o tempo da palavra onde o som entra, tirado da transcrição).",
  "- Nas cenas de um roteiro narrado: `\"som\": {\"nome\": \"<id>\", \"em\": 1.2}` dentro da cena, com `em` em segundos desde o",
  "  início dessa cena (sem `em`, toca no início da cena).",
  "",
  "## Catálogo (`id`: quando usar; onde marcar)",
];
for (const [cat, sons] of Object.entries(porCategoria)) {
  linhas.push("", `### ${cat}`);
  for (const [id, s] of sons) linhas.push(`- \`${id}\` (${s.nome}): ${s.quando}. Marcar ${s.onde}.`);
}
writeFileSync(".claude/skills/novo-video/sons-meme.md", linhas.join("\n") + "\n");
console.log(`sons-meme.md: ${Object.values(porCategoria).flat().length} sons em ${Object.keys(porCategoria).length} categorias`);
