for f in *.json; do
    jq . "$f" > tmp.json && mv tmp.json "$f"
done
