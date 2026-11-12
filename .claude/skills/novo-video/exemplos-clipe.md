# Exemplos visuais num corte de pessoa a falar

Recebes a transcrição de um Short (um corte de podcast, entrevista, aula, vlog) com o tempo de cada trecho em segundos.
A voz da pessoa continua sempre; a tua tarefa é decidir **onde cortar da pessoa para um apoio visual** e qual,
como um editor de reels. Durante o apoio a pessoa **não aparece** (sem câmara no canto): o apoio ocupa o ecrã todo.

## Primeiro: o vídeo precisa de apoios?

- **Não precisa** (`"autoexplicativo": true`, `"exemplos": []`) quando a própria imagem já mostra o que se diz:
  gameplay, tutorial de ecrã, demonstração de um produto nas mãos, receita a ser feita, jogada de futebol.
  Pistas na fala: "olha aqui", "estão a ver", "vou mostrar", "repara nisto".
- **Precisa** quando é só a pessoa a falar de coisas que não se veem: histórias, conceitos, números, lugares,
  objetos, comparações. É o caso normal dos podcasts.

## Princípios de edição (siga sempre)

1. **Ritmo pela emoção da fala**: corte nas pausas e nas ênfases. Um apoio começa exatamente quando a palavra
   importante é dita (usa o tempo do trecho) e acaba no fim dessa ideia, numa pausa.
2. **Estímulo contínuo**: a imagem muda a cada 3 a 5 s (o estúdio já muda o zoom da pessoa sozinho; os teus apoios
   são os outros cortes). Num corte de 30 a 60 s, 6 a 12 apoios (3 a 4 num de 20 s); 2 a 5 s de pessoa entre eles.
3. **Texto como design**: as frases de efeito viram tipografia editorial (`editorial`), não legenda.
4. **Cena com contexto**: cada apoio é uma extensão da mensagem (o cérebro quando se fala da mente, o coração no amor,
   o gráfico quando há números), nunca decoração solta.
5. **Continuidade**: um apoio fecha uma ideia e a pessoa abre a próxima; não corte a meio de uma frase curta.
6. **Sentido narrativo acima do ritmo**: os apoios constroem tensão antes de uma revelação; a **revelação, a piada ou a
   conclusão ficam na cara da pessoa** (a reação dela prende). Nunca nos primeiros 2 s (o gancho é a pessoa) nem nos
   últimos 2 s. A pessoa fica visível em pelo menos 40% do corte.
(O estúdio já põe woosh e impactos nas entradas dos apoios e mexe a câmara em tudo; não precisas de pedir.)

## Tipos de apoio

1. **`editorial`** (frase de efeito): a frase que a pessoa diz nesse trecho aparece escrita como numa revista
   (serifa itálica + a palavra-chave enorme + um objeto ao lado), e a legenda some enquanto ela está no ecrã.
   Use para as **frases de efeito, conclusões fortes e citações** (1 a 3 por corte), num trecho de 2,5 a 6,5 s que
   contém a frase inteira.
   `{"tipo": "editorial", "inicio": 8.2, "fim": 13.0, "chave": "perguntando" (a palavra da frase a pôr em grande), "layout": "centro" | "dividido", "objeto": {...}}`
   - `objeto`: algo que remete à frase. Primeiro procure um **modelo 3D realista do Poly Haven** já no projeto
     `{"fonte": "polyhaven", "modelo": "<id>"}` (lista por categoria em `.claude/skills/novo-video/modelos-polyhaven.md`:
     objetos, comida, ferramentas, eletrónica, mobília, natureza…); se não houver, um modelo realista do Sketchfab
     `{"fonte": "sketchfab", "consulta": "human brain"}`
     (termo em inglês, um objeto só: brain, heart, hourglass, smartphone, coin, trophy, clock, key, lightbulb…), ou um modelo
     **Kenney** já no projeto `{"fonte": "kenney", "modelo": "pack/nome"}` (lista em `.claude/skills/novo-video/modelos-lowpoly.md`),
     ou uma imagem de um objeto isolado `{"fonte": "pixabay", "consulta": "hourglass isolated"}`.
   - `layout`: `dividido` = frase no topo à direita, objeto grande ao centro, palavra-chave em baixo à esquerda (bom para
     objetos marcantes); `centro` = texto centrado com o objeto acima ou abaixo. Alterne.
2. **`dado`** (quando a pessoa cita um número): o número conta no ecrã em formato editorial, com o que significa e,
   se ela compara valores, um gráfico de barras.
   `{"tipo": "dado", "inicio": 20.0, "fim": 23.0, "valor": 475, "prefixo": "", "sufixo": " milhões", "rotulo": "de views em 24 horas", "barras": [{"rotulo": "2019", "valor": 120}, {"rotulo": "2024", "valor": 475}]}`
   (`barras` só quando há mesmo uma comparação; a última fica a vermelho).
3. **`midia`** (vídeo em ecrã inteiro que ilustra o que se diz neste momento): uma cena real.
   `{"tipo": "midia", "inicio": 4.2, "fim": 8.0, "midia": {"fonte": "pixabay" | "pexels", "consulta": "termos em inglês concretos", "tipo": "video" | "imagem"}}`
   (`"wikimedia"` para pessoas famosas, lugares e objetos históricos; `"steam"` para um jogo de PC). Prefira `video`.
4. **`faixa`**: vídeo ou foto **horizontal** numa faixa de cinema sobre fundo escuro, com um título curto com brilho por
   cima (quase sempre um número). `{"tipo": "faixa", "inicio": 6.0, "fim": 10.0, "titulo": "475M VIEWS", "midia": {...}}`.
5. **`palavras`**: cartaz de 1 a 4 palavras gigantes (vermelho e branco) para emoções ou ideias abstratas ditas com força.
   `{"tipo": "palavras", "inicio": 14.0, "fim": 16.5, "palavras": ["ANSIEDADE", "MEDO"], "fundo": "escuro" | "papel"}`. No máximo 2.
6. **`lowpoly`**: cena 3D low poly animada, para situações encenadas que não existem em vídeo de stock.
   `{"tipo": "lowpoly", "inicio": 23.0, "fim": 27.0, "cena": {"cenario": "espaco", "variante": "sistema_solar"}}` (campos abaixo).

## Resposta

Responde **só com JSON**, sem texto à volta:

```json
{
  "autoexplicativo": false,
  "motivo": "uma frase: porque precisa (ou não) de apoios",
  "exemplos": [
    { "inicio": 4.2, "fim": 8.0, "tipo": "midia", "midia": { "fonte": "pixabay", "consulta": "people scrolling phone at night", "tipo": "video" } },
    { "inicio": 9.5, "fim": 14.5, "tipo": "editorial", "chave": "perguntando", "layout": "dividido", "objeto": { "fonte": "sketchfab", "consulta": "human brain" } },
    { "inicio": 20.0, "fim": 23.0, "tipo": "dado", "valor": 8, "sufixo": " segundos", "rotulo": "é a atenção média hoje" }
  ]
}
```

Em `cena` (lowpoly) não escrevas `tipo` nem `fala`: são preenchidos. Sem `titulo` (a legenda já mostra a fala).
