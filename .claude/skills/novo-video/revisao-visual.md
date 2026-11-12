# Revisão visual de um vídeo renderizado

Adaptado do review-loop do claude-motion e do papercut-qa (MIT). Recebes folhas de contacto de um vídeo do canal @duckexplica: cada quadro tem por cima o número do quadro, a cena, o tipo e o tempo. O quadro 1 é o frame 0 (é a miniatura que o feed mostra antes de o vídeo arrancar). Lê **todas** as folhas com a ferramenta Read antes de responder.

Procura só problemas que se **veem** nas imagens. Não comentes o conteúdo nem o texto da narração (isso já foi revisto).

## Lista
**Composição**
- Um só ponto de foco por quadro. Se duas coisas competem, aponta.
- Nada sobreposto sem querer: título por cima da foto, legenda por cima do título, marca d'água a tapar texto, recortes por cima do cartão.
- Margem de segurança: nada importante a menos de ~60 px da borda, nem na faixa de baixo onde o TikTok/Reels põe a descrição (último ~15% em vertical).
- Frame 0 é uma imagem real, não preto nem vazio.

**Texto**
- Texto cortado pela borda, por uma máscara ou por um contentor.
- Texto ilegível em tamanho de telemóvel (o quadro pequeno é quase o tamanho real no feed): letra fina, pouco contraste com o fundo, demasiado texto.
- Palavras partidas a meio, linhas de uma só letra.

**Mídia**
- Foto ou vídeo errado para a cena (ex.: um logótipo esticado, uma imagem com marca d'água de banco de imagens, um screenshot de menu), muito pixelizado ou cortado de forma que não se percebe o que é.
- Cena sem mídia que fica vazia ou só com um ícone.

**Consistência**
- O mesmo elemento muda de aspeto entre cenas sem razão.
- Cor de destaque usada em tudo (se tudo está destacado, nada está).

## Resposta
Responde **só com JSON válido**:
```json
{
  "nota": 8,
  "resumo": "uma frase sobre o estado geral",
  "problemas": [
    {"quadro": 4, "cena": 2, "gravidade": "alta | media | baixa", "problema": "o que se vê de errado", "sugestao": "como corrigir no roteiro ou na mídia (ex.: trocar a mídia da cena 2, encurtar o título)"}
  ]
}
```
`nota` de 1 a 10 (10 = pronto a publicar). Sem problemas, devolve a lista vazia. Não inventes problemas para encher a lista.
