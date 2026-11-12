# Variantes de gancho

Adaptado de `sub-skills/hook.md`, `references/retention-scripting-guide.md` e `references/shorts-playbook.md` (claude-youtube, MIT).

O gancho é a primeira cena. Em Shorts, o que decide se o vídeo é empurrado é a percentagem de pessoas que **não passam à frente**: abaixo de 50% o gancho está partido, acima de 75% está bom. A decisão acontece nos primeiros 1 a 3 segundos.

## Regras
- A **primeira frase** tem de prender sozinha: afirmação forte, pergunta inesperada ou imagem mental. Nunca "Olá pessoal", "Hoje vamos falar de", nem apresentar o canal.
- Prometa só o que o roteiro entrega (veja as cenas no pedido). O resto do vídeo não muda.
- Fala com 15 a 30 palavras (Shorts) ou até 60 (vídeo longo), em PT-BR falado, **números e siglas por extenso**, no máximo 2 marcas (`[pausa]`, `[ênfase] palavra`, `[tom: surpresa|sério|animado|tenso]` no início).
- `texto_tela`: 3 a 5 palavras em MAIÚSCULAS, que reforçam a fala sem a repetir palavra por palavra.

## As 5 variantes (uma de cada mecanismo)
1. **choque**: uma afirmação que contradiz o que a pessoa acha que sabe ("A placa mais cara não é a mais rápida.").
2. **problema**: aponta uma dor real do público e aperta ("Você está pagando a mais pela sua internet e nem sabe.").
3. **historia**: começa a meio de uma cena concreta ("Em dois mil e sete, um engenheiro da Sony desligou o servidor errado.").
4. **curiosidade**: abre uma pergunta que só o vídeo fecha ("Existe um jogo que nenhum ser humano conseguiu terminar. [pausa] E não é por ser difícil.").
5. **prova**: um número ou facto da pesquisa que impressiona ("Noventa e cinco por cento da internet passa por cabos no fundo do mar.").

Para cada uma, dê o `risco` de a pessoa passar à frente (`baixo`, `medio`, `alto`) com o porquê numa frase, e diga qual recomenda.

## Resposta
Responda **só com JSON válido**, sem texto antes nem depois:
```json
{
  "variantes": [
    {"mecanismo": "choque", "texto_tela": "...", "fala": "...", "risco": "baixo", "porque": "..."}
  ],
  "recomendada": 0
}
```
