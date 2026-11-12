# Pacote de publicação do @duckexplica

Adaptado de `sub-skills/metadata.md`, `references/seo-playbook.md` e `references/shorts-playbook.md` (claude-youtube, MIT).

Recebe o roteiro de um vídeo já feito e devolve o texto pronto a colar em cada plataforma. Escreva em PT-BR (ou PT-PT se o mercado for Portugal). **Só afirme o que está no roteiro e na pesquisa dele**: o YouTube compara o título e a descrição com o conteúdo do vídeo e esconde os vídeos com títulos enganosos.

## Títulos (3 variantes)
- **busca**: palavra-chave que as pessoas pesquisam logo no início, intenção clara ("Melhor placa de vídeo até 2 mil em 2026").
- **curiosidade**: lacuna de curiosidade ou emoção, sem mentir ("A placa que a NVIDIA não quer que você compre").
- **misto**: a palavra-chave dentro de uma frase com curiosidade.
- Shorts: 20 a 40 caracteres (o feed corta a partir de uns 40). Vídeo longo: até 70 caracteres, palavra-chave nos primeiros 40.
- Números ajudam ("3", "R$ 2 mil", "2026"). Sem MAIÚSCULAS em tudo, sem emojis em excesso (no máximo 1).

## YouTube
- **Descrição**: as 2 primeiras linhas (uns 125 caracteres) são o anúncio. Palavra-chave nas primeiras 25 palavras.
  - Shorts: 2 a 4 linhas no total, mais as hashtags.
  - Vídeo longo: 150 a 300 palavras. Linhas de abertura, depois os capítulos (use exatamente os que vierem no pedido, começando em 0:00), um resumo do que se aprende, as fontes principais, e no fim um convite para comentar.
  - Se houver links de afiliado no roteiro, diga-o claramente ("Links de afiliado: ...") e acrescente #publi.
- **Tags**: 5 a 10, valem pouco. Use para variações de escrita e nomes de produtos (ex.: "rtx 5060", "rtx5060").
- **Hashtags**: 3 a 5. As 3 primeiras aparecem acima do título. Nunca mais de 15 (acima disso o YouTube ignora todas). Em Shorts, inclua #shorts.

## TikTok e Instagram Reels
- **Legenda**: 1 a 2 frases com gancho e uma pergunta que puxe comentários, mais 3 a 5 hashtags do nicho (#games, #hardware, #pcgamer, #curiosidades...).
- Sem marca d'água de outras plataformas (o vídeo já tem a do canal).

## Comentário fixado
- Uma pergunta que gera respostas ou uma informação extra (fonte, preço com data, "parte 2?"). Até 2 frases.

## Capa (vídeo longo)
- `texto`: 2 a 4 palavras que **não repetem** o título, completam-no.
- `conceito`: o que se vê, em 1 frase (objeto principal, expressão ou emoção, cores com contraste, legível no telemóvel).

## Resposta
Responda **só com JSON válido**, sem texto antes nem depois:
```json
{
  "titulos": [{"tipo": "busca", "texto": "..."}, {"tipo": "curiosidade", "texto": "..."}, {"tipo": "misto", "texto": "..."}],
  "youtube": {"descricao": "...", "tags": ["..."], "hashtags": ["#..."]},
  "tiktok": {"legenda": "...", "hashtags": ["#..."]},
  "instagram": {"legenda": "...", "hashtags": ["#..."]},
  "comentario_fixado": "...",
  "capa": {"texto": "...", "conceito": "..."}
}
```
