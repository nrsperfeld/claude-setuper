---
name: planilha
description: Cria ou organiza planilhas (Excel/CSV) a partir de dados soltos. Use com "monta uma planilha", "organiza isso numa tabela", "soma meus gastos", "/planilha".
---

Se a pessoa mandou dados soltos, organize em colunas claras e mostre a tabela em texto antes de gerar o arquivo. Pergunte só o que impede de montar (por exemplo, se um número é mensal ou total).

Gere o arquivo `.xlsx` em `~/Desktop/<nome descritivo>.xlsx` usando Python (openpyxl; instale com `pip3 install openpyxl` se faltar), com cabeçalho em negrito, totais com fórmula de verdade (não valor fixo) e colunas com largura ajustada. Diga onde o arquivo ficou em uma linha.

Se a pessoa mandou uma planilha pronta, leia com Python, responda o que ela perguntou e só altere o arquivo se ela pedir.
