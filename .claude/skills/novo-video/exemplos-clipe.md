# Exemplos visuais num corte de pessoa a falar

Recebes a transcrição de um Short (um corte de podcast, entrevista, aula, vlog) com o tempo de cada trecho em segundos.
A voz da pessoa continua sempre; a tua tarefa é escolher **onde mostrar um exemplo visual por cima da fala**, para quem
está a ver perceber e não se aborrecer com uma cabeça a falar. Durante o exemplo a pessoa aparece pequena num canto.

## Primeiro: o vídeo precisa de exemplos?

- **Não precisa** (`"autoexplicativo": true`, `"exemplos": []`) quando a própria imagem já mostra o que se diz:
  gameplay, tutorial de ecrã, demonstração de um produto nas mãos, receita a ser feita, jogada de futebol.
  Pistas na fala: "olha aqui", "estão a ver", "vou mostrar", "repara nisto", descrições do que está no ecrã.
- **Precisa** quando é só a pessoa a falar de coisas que não se veem: histórias, conceitos, números, lugares,
  pessoas, objetos, comparações. É o caso normal dos podcasts.

## Regras dos exemplos

- Entre 2 e 5 exemplos num corte de 30 a 60 s (1 a 2 num corte de 20 s). Cada um dura **2,5 a 7 s**.
- O exemplo começa **no momento em que a palavra é dita** (usa o tempo do trecho onde ela está) e acaba quando a ideia acaba.
- Nunca nos primeiros 2 s (o gancho é a pessoa) nem nos últimos 2 s. Pelo menos 1,5 s de pessoa entre dois exemplos.
- A pessoa tem de ficar visível em pelo menos 40% do corte.
- Mostra **coisas concretas** que se dizem (um lugar, um objeto, um animal, uma marca, um número, uma ação), não ideias vagas.
- Varia o tipo de exemplo quando faz sentido.

## Tipos de exemplo

1. **`midia`**: vídeo ou foto real. É o melhor para coisas reais e reconhecíveis.
   `{"fonte": "pixabay" | "pexels", "consulta": "termos em inglês, concretos (ex.: 'stock market traders screens')", "tipo": "video" | "imagem"}`
   para cenas genéricas (prefira `"video"`); `{"fonte": "wikimedia", "consulta": "nome exato (ex.: 'Ayrton Senna 1988')", "tipo": "imagem"}`
   para pessoas famosas, lugares e objetos históricos; `{"fonte": "steam", "consulta": "nome do jogo"}` para um jogo de PC.
2. **`lowpoly`**: cena 3D low poly animada, para situações encenadas, ciência, espaço, coisas que não há em stock
   (um personagem a fazer algo, o sistema solar, um estádio, o interior de um relógio). Campos abaixo.
3. **`pincel`**: ilustração desenhada à mão, para conceitos, números, comparações, listas e processos
   (ícones com seta, barras que crescem, um X sobre o erro). Campos abaixo.

## Resposta

Responde **só com JSON**, sem texto à volta:

```json
{
  "autoexplicativo": false,
  "motivo": "uma frase: porque precisa (ou não) de exemplos",
  "exemplos": [
    { "inicio": 4.2, "fim": 8.0, "tipo": "midia", "midia": { "fonte": "pexels", "consulta": "people running marathon city", "tipo": "video" } },
    { "inicio": 12.5, "fim": 17.0, "tipo": "pincel", "cena": { "papel": "quadro", "elementos": [ { "tipo": "barras", "valores": [2, 5, 9], "rotulos": ["2022", "2023", "2024"] } ] } },
    { "inicio": 23.0, "fim": 28.0, "tipo": "lowpoly", "cena": { "cenario": "espaco", "variante": "sistema_solar", "rotulos": true } }
  ]
}
```

Em `cena` (lowpoly e pincel) não escrevas `tipo` nem `fala`: são preenchidos. Sem `titulo` (a legenda já mostra a fala).
Os campos de cada um estão a seguir (os mesmos das cenas normais dos roteiros); para os nomes dos modelos prontos da
Kenney podes ler `.claude/skills/novo-video/modelos-lowpoly.md`.
