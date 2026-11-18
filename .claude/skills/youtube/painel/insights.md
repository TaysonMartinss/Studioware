# Diagnóstico do canal (menu Insights)

Adaptado de `sub-skills/analyze.md` e `sub-skills/audit.md` (claude-youtube, MIT) para o painel do estúdio.

Recebes um ficheiro JSON com os números reais do canal no YouTube (API oficial) e o cruzamento com o que o estúdio sabe
de cada vídeo que fez. **Lê-o com Read.** Lê também, para os valores de referência:
- `.claude/skills/youtube/references/analytics-guide.md` (hierarquia das métricas, funil, fontes de tráfego)
- `.claude/skills/youtube/references/shorts-playbook.md` (o que conta nos Shorts: percentagem vista, loop, primeiros 3 s)
- `.claude/skills/youtube/references/algorithm-guide.md`

## O que tens no ficheiro
- `total` e `totalAntes`: o período escolhido e o período anterior com a mesma duração (para ver a tendência).
  `averageViewPercentage` é a percentagem média vista (nos Shorts pode passar de 100% por causa do loop),
  `averageViewDuration` em segundos, `estimatedMinutesWatched` em minutos.
- `porDia`: views, minutos e inscritos por dia.
- `trafego`: as views por fonte (`SHORTS` = feed de Shorts, `YT_SEARCH` = pesquisa, `RELATED_VIDEO` = sugeridos,
  `SUBSCRIBER` = inscritos, `EXT_URL` = links de fora, `BROWSE` = página inicial, `NO_LINK_OTHER`, `PLAYLIST`…).
- `videos`: os últimos 50, com os números do período (`periodo`) e de sempre (`total`). `short` diz se é Short.
  `ctr` e `impressoes` só existem quando a conta os tem na API.
- `estudio`: para os vídeos que o estúdio fez, o estilo, o formato, a duração, se teve efeitos sonoros (`sfx`), a
  música e a primeira frase (`gancho`).
- `cruzamento`: médias por estilo, formato, duração, efeitos sonoros e Short ou vídeo longo. Cada grupo traz `n` (número de
  vídeos): **com n < 3 não tires conclusões firmes**, diz que é um indício.

## Como analisar
1. **Tendência**: compara `total` com `totalAntes` (views, minutos vistos, percentagem vista, inscritos líquidos).
2. **Shorts**: o que importa é a percentagem vista (≥ 70% é bom, ≥ 90% é ótimo) e o peso do feed de Shorts no tráfego.
   Um Short com muitas views e percentagem baixa foi empurrado mas não segurou; um com percentagem alta e poucas views
   merece um gancho ou um título melhor.
3. **Vídeos longos**: duração média vista (≥ 50% do vídeo é forte), CTR (4 a 8% é saudável) e fontes (pesquisa + sugeridos).
4. **Destaques**: os 3 melhores e os 3 piores do período, e o que têm em comum (tema, formato, estilo, gancho, duração).
5. **O que funciona no estúdio**: lê o `cruzamento` e diz que estilo, formato e duração seguram melhor o público
   **neste canal**. É a parte mais valiosa: liga o que o estúdio faz ao que o público responde.
6. **Ações**: no máximo 5, ordenadas por impacto e esforço, concretas e possíveis no estúdio (ex.: "usar o Editorial 3D nos
   curiosidades", "ganchos com número nos primeiros 2 s", "rankings de 30 a 45 s em vez de 60 s").

Não inventes números: usa só os do ficheiro. Se faltarem dados (canal novo, poucos vídeos), diz o que dá para concluir e o
que só se vai saber com mais vídeos. Escreve em PT-BR, simples e direto, sem jargão sem explicação.

## Resposta
Responde **só com JSON válido**, sem texto antes nem depois:
```json
{
  "resumo": "2 a 3 frases: como o canal está e a tendência",
  "saude": "boa | atencao | fraca",
  "destaques": [{"video": "<id do YouTube>", "tipo": "melhor | pior", "porque": "1 frase"}],
  "funciona": ["frase curta sobre o que funciona neste canal (estilo, formato, duração, gancho), com os números"],
  "nao_funciona": ["frase curta sobre o que não está a funcionar, com os números"],
  "acoes": [{"titulo": "a ação, curta", "porque": "o número que a justifica", "como": "como fazer no estúdio", "impacto": "alto | medio | baixo"}],
  "ideias": ["até 3 temas de vídeo que seguem o que já funcionou"]
}
```
