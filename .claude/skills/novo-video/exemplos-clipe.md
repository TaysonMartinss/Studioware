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

- **Receita de edição** (estímulo contínuo, como a rolagem do TikTok): a imagem muda **a cada 3 a 5 s**. Quando a
  pessoa está no ecrã, o estúdio já muda o zoom a cada 3–5 s sozinho; os teus exemplos são os cortes para o apoio.
  Num corte de 30 a 60 s, 6 a 12 exemplos (3 a 4 num de 20 s), cada um com **2 a 5 s** (`palavras` e `numero`: 1,2 a 3 s),
  com 2 a 5 s de pessoa entre eles.
- **Sentido narrativo acima do ritmo**: os exemplos acompanham a história. Use-os para **construir tensão** antes de
  uma revelação (imagens que preparam a ideia) e deixe a **revelação, a piada ou a conclusão na cara da pessoa**
  (sem exemplo por cima dessas frases). A reação dela é o que prende.
- O exemplo começa **no momento em que a palavra é dita** (usa o tempo do trecho onde ela está) e acaba quando a ideia acaba.
- Nunca nos primeiros 2 s (o gancho é a pessoa) nem nos últimos 2 s. Pelo menos 1 s de pessoa entre dois exemplos.
- A pessoa tem de ficar visível em pelo menos 40% do corte.
- Mostra **coisas concretas** que se dizem (um lugar, um objeto, um animal, uma marca, um número, uma ação), não ideias vagas.
- Varia o tipo de exemplo quando faz sentido.

## Tipos de exemplo

0. **`faixa`** (o mais usado, como nos reels de edição): vídeo ou foto **horizontal** numa faixa de cinema sobre fundo
   escuro, com um título curto com brilho por cima. Para coisas reais: um lugar, um produto, uma cena de filme/jogo, um
   número que aconteceu. `{"tipo": "faixa", "inicio": 6.0, "fim": 10.0, "titulo": "475M VIEWS" (opcional, até 3 palavras, quase sempre um número), "midia": {"fonte": "pixabay" | "wikimedia" | "steam", "consulta": "...", "tipo": "video" | "imagem"}}`.
5. **`numero`** (gráfico animado): o número conta no ecrã com o que significa, para o dado mais forte que a pessoa diz.
   `{"tipo": "numero", "inicio": 20.0, "fim": 22.5, "valor": 475, "prefixo": "", "sufixo": " milhões", "texto": "de views em 24 horas", "alerta": false}`.
   No máximo 2 por corte; `alerta: true` para números de perigo ou perda.
4. **`palavras`**: cartaz de 1 a 4 palavras gigantes (vermelho e branco) para o **conceito-chave** que a pessoa diz com
   força ou para emoções/ideias abstratas (ex.: "PROCRASTINAÇÃO"; ou "ANSIEDADE", "MEDO", "FRUSTRAÇÃO" a entrar uma a uma).
   `{"tipo": "palavras", "inicio": 14.0, "fim": 16.5, "palavras": ["ANSIEDADE", "MEDO"], "fundo": "escuro" | "papel"}`.
   No máximo 2 por corte.

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
