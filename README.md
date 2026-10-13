# Mapa Eleitoral PE · 2026

Dashboard interativo em HTML5 + MapLibre para explorar os resultados eleitorais de Pernambuco por cargo, candidato, município e seção.

## Executar

Como o navegador bloqueia o carregamento de JSON via `file://`, sirva esta pasta com um servidor HTTP local:

```bash
python -m http.server 8000
```

Depois abra `http://localhost:8000`.

## Atualizar os dados derivados

Os CSVs originais permanecem na raiz. Para regenerar o pacote leve usado pelo dashboard:

```bash
python build_data.py
```

O script cria `data/election-data.json` com agregados municipais e votos por seção para todos os candidatos. O GeoJSON municipal é mantido em `data/municipios.geojson`.
