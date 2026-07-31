#!/bin/bash

# Verifica parametro
if [ $# -ne 1 ]; then
    echo "Uso: $0 <file>"
    exit 1
fi

FILE="$1"

# Verifica che siamo in un repository git
git rev-parse --is-inside-work-tree >/dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "Errore: non sei in un repository Git."
    exit 1
fi

# Verifica che esista lo storico del file
if ! git log -- "$FILE" >/dev/null 2>&1; then
    echo "Errore: nessuna cronologia trovata per '$FILE'."
    exit 1
fi

echo
echo "Ultimi 10 commit per $FILE:"
echo "------------------------------------------------------------"
git log -n 10 --pretty=format:"%h  %ad  %an  %s" --date=short -- "$FILE"
echo "------------------------------------------------------------"
echo

read -p "Inserisci il commit hash da cui ripristinare il file: " HASH

# Verifica che l'hash esista
if ! git cat-file -e "${HASH}^{commit}" 2>/dev/null; then
    echo "Errore: commit '$HASH' non valido."
    exit 1
fi

echo
echo "Ripristino di '$FILE' dal commit $HASH..."
git restore --source="$HASH" "$FILE"

if [ $? -eq 0 ]; then
    echo "Ripristino completato."
else
    echo "Errore durante il ripristino."
    exit 1
fi
