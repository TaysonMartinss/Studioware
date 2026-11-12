"""Valida um roteiro antes de gravar: preços consistentes, pesquisa com fontes, fala sem algarismos nem promessas inventadas.

- Preços: cada cena de produto aponta para o catálogo partilhado (dados/precos.json) com `produto_ref`;
  o preço no ecrã é preenchido a partir dele e o valor dito na fala tem de bater com ele.
- Pesquisa: o roteiro traz `pesquisa` [{fato, fonte, url}] com factos específicos.
- Fala: números por extenso, sem promessas que não existem ("testadas e aprovadas", "planilha"…), PT-BR.

Uso: python scripts/validar_roteiro.py roteiros/x.json [--corrigir] [--json]
  --corrigir  preenche `preco` e `valor` a partir do catálogo e grava `qualidade` no roteiro
  --json      imprime só {"erros": [...], "avisos": [...]} (para o painel)
"""
import json
import re
import sys
import unicodedata
from datetime import date, datetime
from pathlib import Path

CATALOGO = Path("dados/precos.json")
VALIDADE_DIAS = 7

# ---------- números por extenso (pt-BR / pt-PT) ----------
UNIDADES = {"zero": 0, "um": 1, "uma": 1, "dois": 2, "duas": 2, "tres": 3, "quatro": 4, "cinco": 5, "seis": 6, "sete": 7, "oito": 8, "nove": 9,
            "dez": 10, "onze": 11, "doze": 12, "treze": 13, "catorze": 14, "quatorze": 14, "quinze": 15, "dezesseis": 16, "dezasseis": 16,
            "dezessete": 17, "dezassete": 17, "dezoito": 18, "dezenove": 19, "dezanove": 19}
DEZENAS = {"vinte": 20, "trinta": 30, "quarenta": 40, "cinquenta": 50, "sessenta": 60, "setenta": 70, "oitenta": 80, "noventa": 90}
CENTENAS = {"cem": 100, "cento": 100, "duzentos": 200, "duzentas": 200, "trezentos": 300, "trezentas": 300, "quatrocentos": 400, "quatrocentas": 400,
            "quinhentos": 500, "quinhentas": 500, "seiscentos": 600, "seiscentas": 600, "setecentos": 700, "setecentas": 700,
            "oitocentos": 800, "oitocentas": 800, "novecentos": 900, "novecentas": 900}
MULTIPLOS = {"mil": 1_000, "milhao": 1_000_000, "milhoes": 1_000_000, "bilhao": 1_000_000_000, "bilhoes": 1_000_000_000}


def norm(t):
    return unicodedata.normalize("NFD", t.lower()).encode("ascii", "ignore").decode()


def numeros_por_extenso(texto):
    """Encontra sequências de números escritos por extenso e devolve [(valor, indice_da_ultima_palavra, palavras)]."""
    palavras = re.findall(r"[a-zà-ÿ]+", norm(texto))
    achados, i = [], 0
    while i < len(palavras):
        if palavras[i] not in UNIDADES and palavras[i] not in DEZENAS and palavras[i] not in CENTENAS and palavras[i] not in MULTIPLOS:
            i += 1
            continue
        total, parcial, j = 0, 0, i
        while j < len(palavras):
            w = palavras[j]
            if w in UNIDADES:
                parcial += UNIDADES[w]
            elif w in DEZENAS:
                parcial += DEZENAS[w]
            elif w in CENTENAS:
                parcial += CENTENAS[w]
            elif w in MULTIPLOS:
                total += max(parcial, 1) * MULTIPLOS[w]
                parcial = 0
            elif w == "e" and j + 1 < len(palavras) and any(palavras[j + 1] in d for d in (UNIDADES, DEZENAS, CENTENAS)):
                pass
            else:
                break
            j += 1
        achados.append((total + parcial, j - 1, palavras))
        i = j
    return achados


def valores_em_reais(texto):
    """Valores ditos como dinheiro na fala: número por extenso seguido de 'reais' (até 2 palavras depois)."""
    valores = []
    for valor, fim, palavras in numeros_por_extenso(texto):
        seguintes = palavras[fim + 1:fim + 3]
        if "reais" in seguintes or "real" in seguintes or "conto" in seguintes or "contos" in seguintes:
            valores.append(valor)
    return valores


def formatar_reais(v):
    return "R$ " + f"{int(v):,}".replace(",", ".")


# afirmações que o canal não pode provar ou coisas que não existem
PROMESSAS = [
    (r"\btestad[oa]s?\b", "diz que os produtos foram testados"),
    (r"\baprovad[oa]s?\b", "diz que os produtos foram aprovados"),
    (r"\bgarantid[oa]\b|\bgarantia total\b", "promete uma garantia"),
    (r"\bplanilha\b", "promete uma planilha"),
    (r"\b100 ?%|\bcem por cento\b", "afirmação absoluta (100%)"),
    (r"\bnunca mais\b", "promessa absoluta (nunca mais)"),
    (r"\bo melhor do mercado\b|\bo melhor do mundo\b", "superlativo sem base"),
]
# português europeu numa narração brasileira
PT_PT = ["ecra", "telemovel", "ficheiro", "estas a", "tens de", "fixe", "autocarro", "comboio", "equipa", "registo", "rapariga", "utilizador", "portatil"]

DURACOES = {"curto": (30, 45), "medio": (45, 60), "longo": (60, 90), "video_longo": (300, 600)}


# cenas que abrem um tópico: o título da tela tem de ser dito no início da fala
TOPICOS = {"lowpoly": "titulo", "pincel": "titulo", "fato": "titulo", "produto": "nome", "capitulo": "titulo"}
VAZIAS = set("a o as os um uma uns umas de da do das dos e em no na nos nas que com por para pra sem mais seu sua seus suas ao aos the of and".split())


def chaves(texto):
    return [w for w in re.findall(r"[a-z]+", norm(texto)) if len(w) >= 3 and w not in VAZIAS]


def topico_dito(titulo, fala):
    """O início da fala menciona alguma palavra-chave do título? (tolera plural e conjugação pelo radical)"""
    ks = chaves(titulo)
    if not ks:
        return True  # título só com números ou siglas curtas: não dá para comparar
    inicio = re.findall(r"[a-z]+", norm(re.sub(r"\[[^\]]*\]", " ", fala)))[:30]
    return any(w.startswith(k[:5]) or k.startswith(w[:5]) and len(w) >= 4 for k in ks for w in inicio)


# Manim: o que falha sempre neste estúdio (Manim Community 0.22; o LaTeX vem do MiKTeX) — ver .claude/skills/novo-video/manim-guia.md
MANIM_PROIBIDO = {
    "ShowCreation": "é do ManimGL antigo: use Create",
    "TextMobject": "é do ManimGL antigo: use Text",
    "TexMobject": "é do ManimGL antigo: use Text",
    "ThreeDScene": "3D é lento demais para o render: use Scene",
    "SVGMobject": "não há ficheiros SVG: desenhe com formas",
    "ImageMobject": "não há ficheiros de imagem: desenhe com formas",
}


def problemas_manim(codigo):
    import ast
    try:
        arvore = ast.parse(codigo)
    except SyntaxError as e:
        return [f"o código tem um erro de sintaxe na linha {e.lineno}: {e.msg}"]
    out = []
    if not any(isinstance(n, ast.ClassDef) and n.name == "Cena" for n in arvore.body):
        out.append("falta a `class Cena(Scene)`")
    if any(isinstance(n, (ast.Import, ast.ImportFrom)) for n in ast.walk(arvore)):
        out.append("tem `import` (o estúdio já põe `from manim import *`)")
    nomes = {n.id for n in ast.walk(arvore) if isinstance(n, ast.Name)} | {n.attr for n in ast.walk(arvore) if isinstance(n, ast.Attribute)}
    out += [f"`{nome}` {porque}" for nome, porque in MANIM_PROIBIDO.items() if nome in nomes]
    return out


# biblioteca de modelos low poly (scripts/catalogo_modelos.py)
try:
    MODELOS = json.loads((Path(__file__).resolve().parent.parent / "src/lowpoly/modelos.json").read_text(encoding="utf-8"))
except Exception:
    MODELOS = {}
NOMES_MODELOS = {k.split("/")[1] for k in MODELOS}


def validar(roteiro, catalogo, corrigir=False):
    erros, avisos = [], []
    produtos = catalogo.get("produtos", {})
    hoje = date.today()
    brasil = not str(roteiro.get("mercado", "Brasil")).startswith("Portugal")

    # pesquisa com fontes
    alvo = DURACOES.get(roteiro.get("duracao_alvo", "medio"), DURACOES["medio"])
    minimo = 5 if alvo[1] <= 60 else 7 if alvo[1] <= 90 else 12
    pesquisa = roteiro.get("pesquisa") or []
    com_url = [p for p in pesquisa if str(p.get("url", "")).startswith("http")]
    if len(com_url) < minimo:
        erros.append(f"Pesquisa fraca: {len(com_url)} factos com fonte (mínimo {minimo}). Preencha `pesquisa` com factos específicos e o link de cada um.")

    # todo o vídeo termina a pedir a inscrição no canal (cena cta, também quando a ação é comentar ou link)
    cenas_r = roteiro.get("cenas", [])
    # apresentação do tema: logo depois do gancho, o tema é dito pelo nome (palavras-chave do título nas primeiras falas)
    GENERICAS = {"como", "funciona", "porque", "por", "voce", "video", "sao", "coisa", "coisas", "melhores", "melhor", "top", "sobre",
                 "quando", "onde", "qual", "quais", "isso", "este", "esse", "nunca", "todo", "todos", "acontece", "aconteceria", "seria", "existe"}
    if roteiro.get("formato") != "clipe" and len(cenas_r) > 2:
        ks = [k for k in chaves(roteiro.get("titulo", "")) if k not in GENERICAS]
        n_intro = 3 if alvo[1] > 90 else 2
        inicio = [c for c in cenas_r if c.get("tipo") != "capitulo"][:n_intro]
        palavras_inicio = re.findall(r"[a-z]+", norm(re.sub(r"\[[^\]]*\]", " ", " ".join(str(c.get("fala", "")) for c in inicio))))
        if ks and not any(w.startswith(k[:5]) or (k.startswith(w[:5]) and len(w) >= 4) for k in ks for w in palavras_inicio):
            avisos.append(f"Falta a apresentação do tema: as {n_intro} primeiras falas não dizem do que é o vídeo ({', '.join(ks[:4])}). "
                          "Logo a seguir ao gancho, uma ou duas frases com o tema pelo nome e o que a pessoa vai entender.")
    if roteiro.get("formato") != "clipe" and cenas_r:
        ctas = [c for c in cenas_r if c.get("tipo") == "cta"]
        if not ctas:
            avisos.append("Sem cena `cta` no fim: termine com um `cta` cuja fala peça a inscrição no canal (\"se inscreve pra não perder o próximo\").")
        elif not any(re.search(r"inscre[vw]", str(c.get("fala", "")), re.I) for c in ctas):
            avisos.append("A fala do `cta` não pede a inscrição no canal. Junte \"e se inscreve no canal\" (mesmo com comentar ou link).")

    refs_usados = set()
    palavras_total = 0
    for i, c in enumerate(roteiro.get("cenas", [])):
        n = i + 1
        if c.get("tipo") == "clipe":
            continue
        if c.get("tipo") == "manim":
            for pr in problemas_manim(c.get("codigo", "")):
                erros.append(f"Cena {n} (manim): {pr}.")
        if c.get("tipo") == "quiz":
            ops = c.get("opcoes") or []
            if not str(c.get("pergunta", "")).strip():
                erros.append(f"Cena {n} (quiz): falta a `pergunta`.")
            if not 2 <= len(ops) <= 4:
                erros.append(f"Cena {n} (quiz): precisa de 2 a 4 `opcoes` (tem {len(ops)}).")
            if "resposta" in c and not (isinstance(c["resposta"], int) and 0 <= c["resposta"] < len(ops)):
                erros.append(f"Cena {n} (quiz): `resposta` tem de ser o índice de uma opção (0 = a primeira).")
            nfq = norm(re.sub(r"\[[^\]]*\]", " ", c.get("fala", "")))
            if re.search(r"cinco\W+quatro\W+tres|tres\W+dois\W+um", nfq):
                erros.append(f"Cena {n} (quiz): a fala faz a contagem. Tire-a: a cena conta sozinha {c.get('segundos') or 5} segundos em silêncio depois da fala.")
            ditas = set(re.findall(r"\w+", nfq))
            faltam = [o for o in ops if (re.findall(r"\w+", norm(o)) or [""])[0] not in ditas]
            if faltam:
                avisos.append(f"Cena {n} (quiz): a fala não lê a(s) opção(ões) {', '.join(faltam)}. Leia-as com as mesmas palavras, para cada uma aparecer quando é dita.")
        fala = c.get("fala", "")
        limpa = re.sub(r"\[[^\]]*\]", " ", fala)
        nfala = norm(limpa)
        palavras = len(re.findall(r"\w+", limpa))
        palavras_total += palavras

        # algarismos na fala (a voz lê mal; tem de ir por extenso)
        if re.search(r"\d", limpa):
            erros.append(f"Cena {n}: a fala tem algarismos ({', '.join(re.findall(r'\d[\d.,]*\d|\d', limpa)[:3])}). Escreva por extenso, como se diz.")
        for padrao, porque in PROMESSAS:
            if re.search(padrao, nfala):
                erros.append(f"Cena {n}: {porque} ('{re.search(padrao, nfala).group(0)}'). Tire ou troque por algo verificável.")
        if brasil:
            for termo in PT_PT:
                if re.search(rf"\b{termo}\b", nfala):
                    avisos.append(f"Cena {n}: '{termo}' soa a português europeu.")
        campo = TOPICOS.get(c.get("tipo"))
        if campo and c.get(campo) and limpa.strip() and not topico_dito(c[campo], limpa):
            avisos.append(f"Cena {n}: a fala não diz o tópico da tela ('{c[campo]}'). Comece por ele, para quem ouve perceber que mudou de assunto.")
        # objetos "modelo" da biblioteca: o nome tem de existir (senão o motor escolhe o mais parecido)
        for o in (c.get("objetos") or []) if c.get("tipo") == "lowpoly" else []:
            if o.get("tipo") == "modelo":
                nome = str(o.get("modelo") or "")
                if not nome:
                    erros.append(f"Cena {n}: objeto `modelo` sem o campo `modelo` (pack/nome de modelos-lowpoly.md).")
                elif nome not in MODELOS and nome.split("/")[-1] not in NOMES_MODELOS:
                    avisos.append(f"Cena {n}: o modelo '{nome}' não existe na biblioteca; o motor vai usar o mais parecido. Escolha um `pack/nome` de modelos-lowpoly.md.")
        # [pausa] só depois de pontuação: no meio da frase parece que o vídeo travou (a narração ignora-a)
        for m in re.finditer(r"\[pausa( longa)?\]", c.get("fala", ""), re.I):
            antes = re.sub(r"\[[^\]]*\]", " ", c["fala"][:m.start()]).rstrip()
            if antes and not re.search(r"[.,!?;:…—–-][\"'”’)»]*$", antes):
                trecho = " ".join(antes.split()[-4:])
                avisos.append(f"Cena {n}: `{m.group(0)}` no meio da frase (\"…{trecho} {m.group(0)}\"). Ponha a pausa só depois de uma vírgula ou de um ponto; aqui vai ser ignorada.")
        # no formato animado a primeira cena lowpoly faz de gancho (curta de propósito)
        if c.get("tipo") not in ("gancho", "cta", "capitulo", "quiz") and not (i == 0 and (c.get("tipo") in ("lowpoly", "pincel") or roteiro.get("formato") == "livre")) and palavras < (12 if alvo[1] <= 45 else 16 if alvo[1] <= 90 else 22):
            avisos.append(f"Cena {n} ({c.get('tipo')}): só {palavras} palavras — provavelmente rasa. Explique o porquê ou dê um dado concreto.")

        # ritmo e retenção (guias de retenção de Shorts: decisão nos primeiros 1–3 s, um evento visual a cada 2–3 s)
        curto = alvo[1] <= 90
        segundos = palavras / 2.7
        if c.get("tipo") == "gancho" and curto:
            primeira = re.split(r"(?<=[.!?])\s", limpa.strip())[0] if limpa.strip() else ""
            if palavras > 30:
                avisos.append(f"Cena {n} (gancho): {palavras} palavras (~{segundos:.0f} s). O gancho decide se a pessoa fica nos primeiros 2 a 3 s: deixe-o em 15 a 25 palavras.")
            elif (n_primeira := len(re.findall(r"\w+", primeira))) > 14:
                avisos.append(f"Cena {n} (gancho): a primeira frase tem {n_primeira} palavras. Abra com uma frase curta que prenda sozinha.")
        if c.get("tipo") not in ("cta", "capitulo") and segundos > (12 if curto else 25):
            avisos.append(f"Cena {n}: ~{segundos:.0f} s com o mesmo visual. {'Em Shorts troque de imagem a cada poucos segundos' if curto else 'No vídeo longo, renove o visual pelo menos a cada 20 s'}: divida a cena em duas, cada uma com a sua mídia.")
        if curto and c.get("tipo") in ("fato", "gancho") and not c.get("midia"):
            avisos.append(f"Cena {n} ({c.get('tipo')}): sem `midia`, fica só texto e ícone. Junte uma imagem, um b-roll ou um modelo 3D.")

        # preços: produto ↔ catálogo ↔ fala
        ref = c.get("produto_ref")
        if c.get("tipo") == "produto" and c.get("preco") and not ref:
            erros.append(f"Cena {n}: produto '{c.get('nome')}' sem `produto_ref` para o catálogo de preços.")
        if ref:
            refs_usados.add(ref)
            item = produtos.get(ref)
            if not item:
                erros.append(f"Cena {n}: `produto_ref` '{ref}' não existe em dados/precos.json.")
            else:
                idade = (hoje - datetime.strptime(item["data"], "%Y-%m-%d").date()).days
                if idade > VALIDADE_DIAS:
                    avisos.append(f"Cena {n}: o preço de '{item['nome']}' tem {idade} dias. Atualize no catálogo.")
                if corrigir and c.get("tipo") == "produto":
                    c["preco"] = formatar_reais(item["preco"])
                    c.setdefault("selo", "A partir de")
                if corrigir and c.get("tipo") == "numero" and c.get("prefixo", "").strip().upper().startswith("R$"):
                    c["valor"] = int(item["preco"])
        precos_cena = [produtos[ref]["preco"]] if ref in produtos else []
        for v in valores_em_reais(limpa):
            # o valor dito tem de bater com o preço da cena ou com algum preço do catálogo usado no vídeo
            candidatos = precos_cena or [produtos[r]["preco"] for r in refs_usados | set(roteiro.get("precos_usados", [])) if r in produtos]
            if candidatos:
                perto = min(candidatos, key=lambda p: abs(p - v))
                if abs(perto - v) > max(0.06 * perto, 10):
                    erros.append(f"Cena {n}: a fala diz {formatar_reais(v)} mas o catálogo tem {formatar_reais(perto)}.")
            elif v >= 50:
                avisos.append(f"Cena {n}: a fala diz {formatar_reais(v)} sem ligação ao catálogo de preços (use `produto_ref` ou `precos_usados`).")

    # duração estimada (≈2,7 palavras por segundo + pausas)
    pausas = sum(len(re.findall(r"\[pausa", c.get("fala", ""))) for c in roteiro.get("cenas", []))
    estimada = palavras_total / 2.7 + pausas * 0.5 + 0.3 * len(roteiro.get("cenas", []))
    estimada += sum((c.get("segundos") or 5) + 1.3 for c in roteiro.get("cenas", []) if c.get("tipo") == "quiz")  # contagem em silêncio
    if estimada < alvo[0] - 3:
        avisos.append(f"Duração estimada {estimada:.0f} s, abaixo do alvo ({alvo[0]}–{alvo[1]} s): falta conteúdo.")
    elif estimada > alvo[1] + 5:
        avisos.append(f"Duração estimada {estimada:.0f} s, acima do alvo ({alvo[0]}–{alvo[1]} s): corte o que não acrescenta.")
    # vídeo longo: capítulos e cortes para Shorts
    if roteiro.get("formato") == "longo":
        cenas = roteiro.get("cenas", [])
        caps = [c for c in cenas if c.get("tipo") == "capitulo"]
        if len(caps) < 3:
            erros.append(f"Vídeo longo com {len(caps)} capítulos: o YouTube só mostra capítulos a partir de 3 (o ideal são 4 a 7).")
        for k, corte in enumerate(roteiro.get("cortes") or []):
            a, b = corte.get("inicio", -1), corte.get("fim", -1)
            if not (0 <= a <= b < len(cenas)):
                erros.append(f"Corte {k + 1}: cenas {a} a {b} fora do roteiro (há {len(cenas)} cenas, índices de 0 a {len(cenas) - 1}).")
                continue
            if not corte.get("gancho", {}).get("fala"):
                erros.append(f"Corte {k + 1}: falta o gancho próprio do Short.")
            fala = sum(len(re.findall(r"\w+", re.sub(r"\[[^\]]*\]", " ", c.get("fala", "")))) for c in cenas[a:b + 1])
            if fala / 2.7 > 75:
                avisos.append(f"Corte {k + 1}: cerca de {fala / 2.7:.0f} s de fala, longo demais para um Short (ideal 30 a 60 s).")
        if not roteiro.get("cortes"):
            avisos.append("Sem `cortes`: marque 2 ou 3 trechos que funcionem como Shorts.")
    return erros, avisos


def main():
    args = sys.argv[1:]
    caminho = Path(args[0])
    roteiro = json.loads(caminho.read_text(encoding="utf-8"))
    catalogo = json.loads(CATALOGO.read_text(encoding="utf-8")) if CATALOGO.exists() else {"produtos": {}}
    erros, avisos = validar(roteiro, catalogo, corrigir="--corrigir" in args)
    if "--corrigir" in args:
        roteiro["qualidade"] = {"erros": erros, "avisos": avisos, "validadoEm": datetime.now().isoformat(timespec="minutes")}
        caminho.write_text(json.dumps(roteiro, ensure_ascii=False, indent=2), encoding="utf-8")
    if "--json" in args:
        print(json.dumps({"erros": erros, "avisos": avisos}, ensure_ascii=False))
    else:
        for e in erros:
            print("ERRO  ", e)
        for a in avisos:
            print("AVISO ", a)
        print(f"{len(erros)} erros, {len(avisos)} avisos")
    sys.exit(1 if erros else 0)


if __name__ == "__main__":
    main()
