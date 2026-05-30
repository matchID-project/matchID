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

---
## MAJ — après optimisation #10 (intersection sur doc-ids entiers denses u32)
Run matchID `26651526846` (Surch `sha-8aae6a1`). Candidate resolution +
intersection en `u32` interne (plus de clone de `String` publique par doc).

| moteur | p50 | p95 | p99 | max | moy |
|--------|----:|----:|----:|----:|----:|
| ES 8.6.1 (run stable) | 3,7 ms | 8,1 | 11,7 | 21,4 | 4,2 |
| Surch après #1 | 87,2 | 166,3 | 196,7 | 287,0 | 98,0 |
| **Surch après #10** | **69,9** | **84,7** | **120,5** | **150,0** | **70,3** |

→ #10 : **p50 −20%, p95 ÷2** (166→85). Cumulé deces **4513→70 ms (~64x)**,
écart vs ES **1200x → ~19x**, 0 erreur, parité préservée (37 blocs verts).

Résidu (70 vs 3,7 ms) : la résolution construit encore les DEUX posting-lists
complètes (PRENOM, NOM = dizaines de milliers chacune) avant d'intersecter —
O(df) par clause. Une intersection leapfrog/galloping sur skip-lists (Surch les
a côté maxscore) éviterait de matérialiser les deux ensembles → prochain levier
deces (rendements décroissants). + runner 2-vCPU.

---
## DÉCOMPOSITION des 70ms (run 26666766298, surch sha-8aae6a1) — diagnostic
Même noms, 3 formes : `match` (1 terme NOM) / `bool` (PRENOM ∧ NOM) / `full`.

| p50 (ms) | match | bool | full |
|----------|------:|-----:|-----:|
| ES 8.6.1 | 4,0 | **3,0** | 2,8 |
| Surch    | 36,1 | **68,2** | 68,7 |

**Constats (data-driven)** :
1. Wrapper `function_score`+`min_score:0`+`track_total_hits`+`sort` ≈ **gratuit**
   (Surch full 68,7 ≈ bool 68,2). Écarté comme cause.
2. Un **seul `match` terme courant = 36 ms** (vs ES 4 ms, 9x). Coût de base.
3. `bool` ≈ **2× match** → Surch **matérialise la posting-list COMPLÈTE de chaque
   terme (O(df))** ; l'intersection est gratuite. ES : `bool` (3ms) < `match`
   (4ms) → block-max skip, ne touche jamais les listes complètes.

**Levier confirmé** : éviter de matérialiser les listes O(df).
- bool deces → **intersection leapfrog** (piloter le terme rare, `advance_to`
  l'autre ; primitive `PostingsBlockSkipIter::advance_to` déjà présente).
- match seul → s'assurer que le top-K block-max WAND **skippe** vraiment
  (ne score que ce qu'il faut pour le top-20).

---
## MAJ — après #11 (intersection leapfrog/galloping) — NEUTRE sur deces (honnête)
Run matchID `26668292578` (Surch `sha-a6fa7aa`, es+surch dans le MÊME run).
Intersection leapfrog implémentée (pilote le terme rare, `advance_to` sur skip-lists
FoR, sans matérialiser les listes complètes). **Parité préservée** : `cargo test`
vert + ci-k8s ndcg-gate vert (SciFact Surch 0,6576 ; TREC-COVID 0,4750 — inchangés).

| p50 (ms) | match | bool | full | full (probe 2000) |
|----------|------:|-----:|-----:|------------------:|
| ES 8.6.1 (ce run) | 3,6 | 3,1 | 2,7 | 4,6 |
| Surch #10 (run préc.) | 36,1 | 68,2 | 68,7 | 69,9 |
| **Surch #11 (ce run)** | 39,7 | 74,4 | 75,2 | **78,2** |

**Verdict honnête : #11 ne bouge PAS la latence deces.** Preuve : le `match` (terme
seul, leapfrog NON engagé car mono-terme) passe 36,1→39,7 (+10%) sans aucun
changement de code sur ce chemin → ce run-runner 2-vCPU est ~10% plus lent ; le
même +10% appliqué au bool #10 (68,2×1,10≈75) explique entièrement le 74,4. La
stratégie d'intersection a changé le bool de ~0%. **La conjonction n'était pas le
goulot.**

**Vrai levier (re-confirmé par la décompo)** : `match` terme courant = ~40 ms ≈
**11× ES**, et `bool ≈ 2× match`. Le coût dominant est le **hot-loop par-terme**
(décodage FoR + scoring BM25 de toute la posting-list), PAS l'intersection. ES ne
le paie jamais (block-max WAND top-K : son `bool` 3,1 ms < son `match` 3,6 ms).
Prochain levier deces : faire **skipper** le top-K du `match` nu
(`run_topk_search`/`maxscore_match`) sur ce corpus → fixe aussi le `bool`. #11
reste en place (parité-safe, utile pour conjonctions sélectives `df_rare ≪ df_autre`
mono-token) mais ne rapproche pas des 2× ES.

---
## MAJ — #12+#13 : élimination du SETUP par-requête → 2× PLUS RAPIDE QU'ES (p50) ✅
Diagnostic #11 corrigé par les données : les postings en mémoire sont déjà
décodés (`&[Posting]`), le goulot n'était PAS le per-doc loop mais le **setup
O(n) par-requête** : copie+pointer-chase d'un `BTreeMap` de doc_len, et build
d'un `BTreeSet` à partir de postings déjà triés. Quatre changements parité-safe :
dense `Vec<u64>` doc_len (`de19a9c`), fast-path mono-token candidats (`dfb6c25`),
emprunt zéro-copie du slice doc_len (`3bfec8f`), précompute incrémental de
`min_doc_len` (`2c59e91`).

Run `26697199003` (sha-`2c59e91`, baseline ES propre même run) :

| deces p50 (ms) | match | bool | full | full probe |
|---|--:|--:|--:|--:|
| ES 8.6.1 | 3,8 | 3,1 | 2,7 | **4,9** |
| **Surch** | **1,7** | **1,8** | **1,9** | **2,0** |

→ **Surch p50 2,0 ms vs ES 4,9 ms = 2,45× plus rapide** : critère « ≥2× » ATTEINT
sur la médiane (et la moyenne 3,8 vs 5,5). Parcours cumulé deces **4513 → 2,0 ms**,
écart vs ES **~1200× plus lent → 2,45× plus rapide**. Parité préservée (oracles +
ndcg-gate verts).

**Caveat — la QUEUE reste le front** : Surch p95 14,3 / p99 20,8 / max 62,8 vs ES
10,6 / 15,2 / 21,8. C'est le `bool`/`function_score` à fort df (scan complet via
`run_search`) ; ES élague via WAND. Prochain levier deces = étendre le top-K
WAND aux `bool`(msm)/`function_score` pour resserrer p95/p99.
