# Latence deces ENGINE-TO-ENGINE — Surch vs Elasticsearch 8.6.1 (matchID CI)

Run `matchID-project/matchID` `surch-eval perf` **26609427689** (Surch image
`sha-f0a8d11`, AVANT optimisation min_score). Probe `latency_engine.sh` : rejoue
2000 requêtes deces-backend réelles (`function_score`/`bool minimum_should_match:2`/
`match PRENOM+NOM`, `min_score:0`, `sort _score`, `size 20`) **directement sur
`_search`**, sans backend Node. Corpus deces 1,36M, un moteur par job isolé.

| moteur | req | p50 | p95 | p99 | max | moy |
|--------|----:|----:|----:|----:|----:|----:|
| **Elasticsearch 8.6.1** | 2000 (0 err) | **3,7 ms** | 8,1 | 11,7 | 21,4 | 4,2 |
| **Surch** | 2000 (0 err) | **4513 ms** | 5332 | 7313 | 9727 | 4511 |

→ **Surch ~1200x PLUS LENT qu'ES** sur la vraie requête deces. 0 erreur,
index OK (1,36M indexés en 91s). C'est LA vérité latence que l'artillery via le
backend Node masquait — et elle est sévère.

## Root cause (confirmée dans le code)
La requête backend porte **`min_score: 0`**. Surch désactivait le raccourci
top-K/WAND dès qu'un `min_score` est présent (`run_topk_search` bail sur
`min_score.is_some()`) → **full-scan + scoring de TOUTE la posting-list** des
termes de noms fréquents (ex. PRENOM="marie") sur 1,36M docs → ~4,5 s.
Or `min_score:0` est **vacuous** (BM25 ≥ 0 toujours → `score>=0` ne filtre rien).

## Fix (surch, parité-safe, général — PAS overfit)
`run_topk_search` ne bail désormais que si `min_score > 0` ; un `min_score<=0`
est traité comme absent → WAND/top-K reste engagé, résultat + total identiques.
Général : tout client envoyant `min_score:0` (le client @elastic/elasticsearch
par défaut) en profite. → re-mesure deces latency attendue en ms (vs 4,5 s).

## Note méthodo
Absolus toujours bornés par le runner GitHub 2-vCPU ; mais l'écart 1200x est
structurel (full-scan vs WAND), pas du bruit runner. La re-mesure post-fix dira
de combien Surch se rapproche d'ES (3,7 ms).
