#!/usr/bin/env python3
"""Gera data/*.json e data/cursos.json a partir das grades públicas do Júpiter Web (EEL-USP).
Só usa a biblioteca padrão. Uso:  python scraper/gerar_grades.py
Para outra unidade da USP, adicione os códigos (codcg, codcur, codhab) em CURSOS."""
import html, json, re, time, unicodedata, urllib.request
from pathlib import Path

UNIDADE = "EEL – Lorena"
CODCG = 88
# (nome, periodo, codcur, codhab) — copiados de jupCursoLista?codcg=88&tipo=N
CURSOS = [
    ("Engenharia Ambiental", "integral", 88251, 0),
    ("Engenharia Bioquímica", "integral", 88152, 0),
    ("Engenharia de Materiais", "integral", 88202, 0),
    ("Engenharia de Produção", "noturno", 88352, 4),
    ("Engenharia Física", "integral", 88301, 0),
    ("Engenharia Química", "integral", 88052, 0),
    ("Engenharia Química", "noturno", 88052, 4),
]
URL = "https://uspdigital.usp.br/jupiterweb/listarGradeCurricular?codcg={}&codcur={}&codhab={}&tipo=N"
DATA = Path(__file__).resolve().parent.parent / "data"

def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")

def baixar(url):
    req = urllib.request.Request(url, headers={"User-Agent": "fluxograma-eel (projeto estudantil)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("iso-8859-1")  # o Júpiter responde em ISO-8859-1

MARCADOR = re.compile(
    r"(@@D:\w+@@|\d+º\s*Per[ií]odo Ideal|Disciplinas Obrigat[óo]rias|"
    r"Disciplinas Optativas (?:Eletivas|Livres)|Subtotal:)")

def parse(pagina):
    """Devolve a lista de semestres com as disciplinas OBRIGATÓRIAS e seus pré-requisitos."""
    pagina = re.sub(r"<a[^>]*sgldis=(\w+)[^>]*>.*?</a>", r" @@D:\1@@ ", pagina, flags=re.S | re.I)
    texto = " ".join(html.unescape(re.sub(r"<[^>]+>", " ", pagina)).split())
    ini = texto.find("Disciplinas Obrigatórias")
    if ini < 0:
        raise ValueError("grade não encontrada (o layout do Júpiter mudou?)")
    partes = MARCADOR.split(texto[ini:])
    semestres, sem, em_obrigatorias, disc = [], None, False, None
    for i in range(1, len(partes), 2):
        marca, corpo = partes[i], partes[i + 1]
        if marca.startswith("Disciplinas Obrigat"):
            em_obrigatorias = True
        elif marca.startswith("Disciplinas Optativas"):
            em_obrigatorias = False
        elif not em_obrigatorias:
            continue
        elif "Per" in marca and "Ideal" in marca:
            n = int(re.match(r"\d+", marca).group())
            sem = {"label": f"{n}º Semestre", "disciplines": []}
            semestres.append(sem)
        elif marca.startswith("@@D:") and sem is not None:
            m = re.search(r"\s[A-Z]{3}\d{4}\s", " " + corpo + " ")
            cabeca = (" " + corpo + " ")[: m.start()] if m else corpo
            resto = (" " + corpo + " ")[m.start():] if m else ""
            c = re.match(r"\s*(.*?)\s+(\d+)\s+(\d+)\s+(\d+)(?:\s+\d+)*\s*$", cabeca)
            nome, cred = (c.group(1), int(c.group(2))) if c else (cabeca.strip(), 0)
            weak, strong = [], []
            for cod, forte in re.findall(r"([A-Z]{3}\d{4})\s(?:(?![A-Z]{3}\d{4}\s).)*?Requisito( fraco)?", resto):
                (weak if forte else strong).append(cod)
            sem["disciplines"].append({"id": marca[4:-2], "name": nome, "credits": cred,
                                       "weak": weak, "strong": strong})
        # "Subtotal:" apenas encerra o trecho da última disciplina
    return [s for s in semestres if s["disciplines"]]

def main():
    DATA.mkdir(exist_ok=True)
    indice = []
    for nome, periodo, codcur, codhab in CURSOS:
        arquivo = f"eel-{slug(nome)}-{periodo}.json"
        try:
            sems = parse(baixar(URL.format(CODCG, codcur, codhab)))
            (DATA / arquivo).write_text(json.dumps(
                {"id": arquivo[:-5], "nome": nome, "periodo": periodo, "semesters": sems},
                ensure_ascii=False, indent=1), encoding="utf-8")
            print(f"ok   {arquivo}: {len(sems)} semestres, {sum(len(s['disciplines']) for s in sems)} disciplinas")
        except Exception as e:  # mantém o arquivo anterior, se existir
            print(f"ERRO {arquivo}: {e}")
        if (DATA / arquivo).exists():
            indice.append({"id": arquivo[:-5], "nome": nome, "periodo": periodo, "arquivo": arquivo})
        time.sleep(1.5)  # não sobrecarrega o Júpiter
    (DATA / "cursos.json").write_text(json.dumps(
        [{"unidade": UNIDADE, "cursos": indice}], ensure_ascii=False, indent=1), encoding="utf-8")

if __name__ == "__main__":
    main()
