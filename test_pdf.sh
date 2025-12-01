#!/bin/sh
TOKEN=$(cat token.json | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo "Token obtido."

# Listar monitores e pegar o primeiro ID
MONITORS=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8081/api/monitors)
MONITOR_ID=$(echo $MONITORS | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Monitor ID: $MONITOR_ID"

if [ -z "$MONITOR_ID" ]; then
  echo "Nenhum monitor encontrado ou erro na listagem"
  echo "Resposta: $MONITORS"
  exit 1
fi

# Testar PDF
echo "Baixando PDF para Monitor ID: $MONITOR_ID..."
HTTP_CODE=$(curl -s -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "http://localhost:8081/api/pdf/monthly-report/$MONITOR_ID?year=2024&month=1&style=status" -o test_report.pdf)

echo "HTTP Code: $HTTP_CODE"
ls -lh test_report.pdf

if [ "$HTTP_CODE" -eq 200 ]; then
    echo "SUCESSO: PDF gerado com sucesso!"
else
    echo "ERRO: Falha ao gerar PDF."
    # Se for pequeno, mostrar conteudo
    SIZE=$(wc -c < test_report.pdf)
    if [ "$SIZE" -lt 1000 ]; then
        cat test_report.pdf
    fi
fi
