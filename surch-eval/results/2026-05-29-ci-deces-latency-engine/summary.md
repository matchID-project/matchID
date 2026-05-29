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

## Root cause (confirmée dans le code — diagnostic corrigé)
La requête backend est un **`bool.must[function_score{ bool.must[
bool{minimum_should_match:2, should:[match PRENOM, match NOM]} ] }]`**. Le
raccourci WAND/top-K de Surch (`run_topk_search` → `maxscore_match`) ne
s'applique **qu'aux requêtes `Match`/`MultiMatch` nues** (garde de type à
`search.rs:1681`). Une requête `bool`/`function_score` est donc routée vers le
chemin **full-scan `run_search` qui score CHAQUE doc qui matche** ; les termes
de noms fréquents (PRENOM/NOM courants) ont d'énormes posting-lists sur 1,36M
docs → ~4,5 s/requête. ES applique WAND/block-max à travers bool/function_score.

**Le `min_score:0` de la requête est un faux indice** : la garde de type
disqualifie déjà la requête du top-K, donc `min_score` n'y change rien.
(Une première hypothèse "min_score:0 désactive le top-K" a été émise puis
**réfutée + annulée** : même en laissant passer `min_score<=0`, la requête bool
ne prend jamais le top-K.)

## Vrai levier (gros, à venir)
Étendre WAND/block-max top-K aux requêtes **`bool` (minimum_should_match)** et
**`function_score`**, pas seulement `Match`/`MultiMatch`. C'est l'optimisation
search-latency structurelle (≠ micro-fix) ; c'est elle qui rapprocherait Surch
des 3,7 ms d'ES sur deces. Parité à préserver (function_score peut produire des
scores ≤ 0 → la borne de score WAND doit en tenir compte).

## Note méthodo
Absolus bornés par le runner GitHub 2-vCPU ; mais l'écart 1200x est **structurel**
(full-scan-scoring-toutes-docs vs WAND), pas du bruit runner — un workload où
Surch est aujourd'hui inutilisable face à ES, à corriger pour le "substitut".

---
## MAJ — après optimisation #1 (intersection msm==n_should + unwrap function_score)
Run matchID `26616206949` (Surch `sha-ec3e999`). MÊME probe, MÊME corpus 1,36M.

| moteur | p50 | p95 | p99 | max | moy |
|--------|----:|----:|----:|----:|----:|
| ES 8.6.1 (run stable précédent) | 3,7 ms | 8,1 | 11,7 | 21,4 | 4,2 |
| **Surch AVANT #1** | 4513 ms | 5332 | 7313 | 9727 | 4511 |
| **Surch APRÈS #1** | **87,2 ms** | 166,3 | 196,7 | 287,0 | 98,0 |

→ **#1 = ~52x plus rapide sur deces** (4513→87 ms), 0 erreur, parité préservée
(oracles verts). L'écart vs ES passe de ~1200x à ~24x. Cause éliminée : Surch
unionnait+scorait toute la posting-list des shoulds ; il intersecte maintenant
(msm:2/2 = AND) après avoir traversé le wrapper function_score.

Reste (87ms vs 3,7ms ES) : autre nature (intersection de BTreeSet<String> d'IDs
publics + scoring + runner 2-vCPU), pistes backlog #10 (id maps denses) — PAS
l'union/disjonction. (Le job es a flaké ce run sur le build backend = fetch
wikidata transitoire ; ES p50 3,7ms repris du run stable, même ES/probe.)
