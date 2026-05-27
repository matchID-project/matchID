# CI deaths (1.36M) — Surch vs Elasticsearch 8.6.1 — VERDICT

Run `matchID-project/matchID` Actions `surch-eval perf` **26528627429**
(commit `1ac5976c`). Dataset = **deaths.txt.gz (1 355 728 docs)** = le vrai
dataset CI matchID. 2 jobs parallèles, un runner ubuntu-latest (2 vCPU) par
moteur. Bruts artillery = artefacts CI `surch-eval-perf-{es,surch}`.

## Indexation (bulk série, 1.36M)
| Moteur | Docs | Temps `_bulk` brut | Débit |
|--------|-----:|-------------------:|------:|
| ES 8.6.1 | 1 355 728 | 116 s | ~11 600 docs/s |
| Surch | 1 355 728 | **2125 s (~35 min)** | ~640 docs/s |

**CADRAGE (corrigé)** : le 116 s ES est un `_bulk` brut mesuré ici — PAS la
« vraie » indexation matchID. Côté matchID l'indexation ES = le **dataprep
(~20 min)** qui produit un snapshot, puis **restore** (rapide) en prod. La bonne
référence pour Surch = son temps de **dataprep**, pas un `_bulk`. Mais **35 min
pour Surch reste aberrant** → optimisation indexation Surch (chantier Track A).
Le chemin est déjà au-delà des O(N²) évidents (Lot 1 append incrémental + Lot 1.6
FST déféré, vérifié) ; le résiduel super-linéaire (local 4 783→1 901 docs/s) est
subtil (pression mémoire/allocateur/cache à l'échelle) → à localiser par
**profilage flamegraph en CI**, pas de modif à l'aveugle ni de run local lourd.

## Artillery test-backend-v1 (via le vrai backend, 8340 req, 100% HTTP 200)
| Moteur | médiane | p95 | p99 | max | débit |
|--------|--------:|----:|----:|----:|------:|
| ES 8.6.1 | 13,5 s | 48,4 s | 52,0 s | 59,5 s | 36,6 rps |
| Surch | 54,6 s | 63,8 s | 64,8 s | 66,2 s | 26,3 rps |
→ **ES ~4x plus rapide (médiane).** Absolu CPU-bound (runner 2 vCPU, backend
goulot) → seul le relatif vaut, et il donne ES devant.

## VERDICT
Sur le dataset CI réel (deaths 1.36M), **Surch ne bat pas Elasticsearch 8.6.1** :
indexation ~18x plus lente, latence backend ~4x plus lente. Le critère pour
passer au 28M/GP1-XS (« Surch demontre plus performant que Elastic sur deaths »)
n'est PAS atteint → **on ne lance pas le 28M**.

## Faiblesses Surch a corriger (cote surch) avant de re-tenter
- Indexation : rebuild FST complet par bulk -> debit chute avec la taille
  (~640 docs/s a 1.36M). Cf. docs/wp-a-perf-followups-concurrent-bulk-search-stall.md.
- Recherche backend : ~4x plus lent qu'ES sur deces (function_score+fuzzy).
- Bug concurrence (reads pendant bulk) documente.
Note : le bench perf-paper surch montrait Surch PLUS rapide, mais sur le wire
OpenSearch brut (trec-covid). Le workload matchID (backend deces) est different
et defavorable a Surch aujourd'hui.
