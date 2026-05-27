# Résultats CI matchID — corpus 60 557 docs (Surch vs Elasticsearch 8.6.1)

Run CI : `matchID-project/matchID` Actions, workflow `surch-eval perf`,
run **26517212004** (commit surch-eval `fd69b2e`). Bruts artillery (~1,1 Mo
chacun) = artefact CI `surch-eval-perf` du run ; ici le résumé + `indexation.json`.

Corpus : snapshot dev auto-résolu par `make deploy-dependencies` = 60 557 docs.
Même runner GitHub `ubuntu-latest` (**2 vCPU**), bulk série, mapping réel.

## Indexation (chronométrée, série)
| Moteur | Docs | Temps bulk | Débit |
|--------|-----:|-----------:|------:|
| Elasticsearch 8.6.1 | 60 557 | **7,4 s** | ~8 160 docs/s |
| Surch | 60 557 | 19,5 s | ~3 100 docs/s |
→ ES ~2,6x plus rapide.

## Artillery `test-backend-v1` (via le VRAI deces-backend, 8 340 req, 100% HTTP 200)
| Moteur | médiane | p95 | p99 | max | débit soutenu |
|--------|--------:|----:|----:|----:|--------------:|
| Elasticsearch 8.6.1 | 4,9 s | 48,4 s | 50,6 s | 57,0 s | 39,7 rps |
| Surch | 66,4 s | 93,9 s | 102,8 s | 107,7 s | 24,5 rps |
→ Surch plus lent (médiane ~13x, débit 0,6x).

## CAVEAT majeur — runner trop petit
Les latences absolues sont **aberrantes** (médiane ES 4,9 s pour une recherche
sur 60 k docs). Cause : le runner `ubuntu-latest` n'a que **2 vCPU**, partagés
par ES + Surch + le backend (concurrency 6) + l'artillery → CPU-bound massif.
**Seul le relatif (même runner, mêmes conditions) est exploitable** : Surch
sous-performe ES sur ce workload backend deces. Pour des chiffres absolus
crédibles il faut un runner plus gros (self-hosted / large) — la CI hébergée
standard ne suffit pas pour l'artillery à charge.

## Findings Surch (à investiguer côté surch)
- Sous-perf indexation (rebuild FST par bulk) — cf.
  `surch docs/wp-a-perf-followups-concurrent-bulk-search-stall.md`.
- Sous-perf recherche via le backend (function_score + fuzzy sur deces) à charge.
