# Fluxograma – EEL-USP

Fluxogramas interativos das grades da Escola de Engenharia de Lorena (pré-requisitos fracos/fortes e dependentes).

- `index.html`, `style.css`, `script.js`: site estático (GitHub Pages).
- `data/cursos.json`: índice que alimenta o seletor. `data/*.json`: uma grade por arquivo.
- `scraper/gerar_grades.py`: baixa as grades públicas do Júpiter Web e gera os JSONs (só biblioteca padrão).
- `.github/workflows/atualizar-grades.yml`: roda o scraper no GitHub (Actions → Atualizar grades → Run workflow).

## Primeira execução
Vêm prontas apenas as duas grades de Engenharia Química. Para gerar as 7 grades da EEL, rode o workflow
ou `python scraper/gerar_grades.py`. Só entram as disciplinas obrigatórias (optativas ficam de fora).
Confira os resultados contra o Júpiter, que é a fonte oficial.

## Outro curso ou unidade
Acrescente `(nome, período, codcur, codhab)` em `CURSOS` no scraper (os códigos estão em
`jupCursoLista?codcg=<unidade>&tipo=N`) e ajuste `CODCG` e `UNIDADE`.
