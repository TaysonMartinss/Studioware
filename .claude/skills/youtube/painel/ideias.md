# Ideias de vídeos para o canal

Adaptado de `sub-skills/ideate.md` e `references/shorts-playbook.md` (claude-youtube, MIT) para o canal e para o painel.

## O canal
- O nome, o @ e o **nicho** do canal vêm no pedido. Todas as ideias têm de caber nesse nicho (um canal de futebol não recebe ideias de hardware, e vice-versa), a não ser que o foco pedido diga outra coisa.
- Shorts, Reels e TikTok verticais de 30 a 90 segundos; vídeos longos 16:9 de 5 a 10 minutos no YouTube.
- Público brasileiro (PT-BR) por defeito.

## Como pensar as ideias
1. **Pesquise antes de sugerir** (WebSearch): notícias e lançamentos do nicho do canal nas últimas semanas, preços que mudaram, polémicas, datas que estão a chegar (Black Friday, lançamentos, eventos), e perguntas que as pessoas fazem ("vale a pena", "qual comprar", "por que").
2. **Não repita** os vídeos que o canal já fez (lista no pedido). Um ângulo novo sobre um tema antigo pode servir, desde que seja claramente diferente.
3. **Misture estratégias** (pelo menos 3 das 4 entre as ideias):
   - `busca`: responde a uma pergunta que as pessoas pesquisam ("melhor placa de vídeo até 2 mil reais"). Vale durante meses.
   - `feed`: curiosidade ou "E se?" que para o dedo de quem está a passar. Vive do gancho.
   - `tendencia`: notícia ou lançamento desta semana. Só vale se for publicado já.
   - `venda`: ranking ou comparação com produtos que se podem comprar (afiliado).
4. **Um gancho por ideia**: uma frase que cria uma lacuna de curiosidade nos primeiros 2 segundos. Nada de "Olá pessoal" nem de promessas que o vídeo não cumpre. O YouTube penaliza títulos enganosos.
5. **Formato certo** (usar exatamente estes ids): `ranking` (top de produtos com recomendação de compra), `curiosidades` (factos do mundo gamer), `explicativo` (como funciona / por que, estilo Kurzgesagt), `storytelling` (uma história que termina na compra de um produto), `ese` (E se...?), `quiz` (perguntas para o público jogar), `livre` (estrutura própria, descrita no tema), `animado` (E se? em animação 3D), `longo` (vídeo longo do YouTube). Só sugira `longo` quando o tema aguenta 5 a 10 minutos com 4 a 7 capítulos.
6. **Dê nota de 1 a 10** a cada ideia, pensando em: procura ou curiosidade real, força do gancho, se dá para fazer com imagens reais e dados com fonte, e se encaixa no canal. Ordene da maior para a menor.

## Resposta
Responda **só com JSON válido**, sem texto antes nem depois:
```json
{
  "ideias": [
    {
      "titulo": "título de publicação, até 60 caracteres, palavra-chave no início",
      "tema": "o pedido para o roteirista, 1 a 2 frases com o ângulo exato",
      "formato": "ranking | curiosidades | explicativo | storytelling | ese | quiz | livre | animado | longo",
      "estrategia": "busca | feed | tendencia | venda",
      "gancho": "a primeira frase falada do vídeo",
      "porque": "1 frase: o sinal concreto que mostra que isto pode funcionar (notícia, pesquisa, data)",
      "urgencia": "esta semana | sempre | até DD/MM",
      "nota": 8
    }
  ]
}
```
