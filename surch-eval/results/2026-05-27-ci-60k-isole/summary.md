# CI 60k ISOLÉ — 2 jobs parallèles (un runner par moteur)

Run `matchID-project/matchID` Actions `surch-eval perf` **26522846889**
(commit `93e6b0d`). Jobs `perf es` + `perf surch` en parallèle, **chacun sur
son runner ubuntu-latest (2 vCPU)** → un seul moteur résident par job. Corpus
dev auto = 60 557 docs. Bruts artillery = artefacts CI `surch-eval-perf-{es,surch}`.

## Indexation (bulk série, isolé)
| Moteur | Docs | Temps | Débit |
|--------|-----:|------:|------:|
| ES 8.6.1 | 60 557 | 6,7 s | ~9 100 docs/s |
| Surch | 60 557 | 20,4 s | ~2 970 docs/s |
→ ES ~3x plus rapide.

## Artillery test-backend-v1 (via le vrai backend, 100% HTTP 200)
| Moteur | médiane | p95 | p99 | max | débit | req |
|--------|--------:|----:|----:|----:|------:|----:|
| ES 8.6.1 | 12,2 s | 48,9 s | 53,0 s | 58,5 s | 38,9 rps | 8340 |
| Surch | 88,8 s | 113,3 s | 115,1 s | 119,9 s | 19,4 rps | 6989 |
→ Surch ~7x plus lent (médiane), ~0,5x débit.

## DIAGNOSTIC — le goulot n'est PAS la contention inter-moteur
L'isolation (2 runners séparés) n'a PAS baissé les latences absolues (ES médiane
est même passée de 4,9 s en non-isolé à 12,2 s ici). Donc le goulot est le
**backend Node (concurrency 6) + le runner 2 vCPU** qui ne soutient pas 50 rps :
les requêtes font la queue, la latence mesurée = temps d'attente, pas le temps
moteur. Les chiffres ABSOLUS ne sont pas représentatifs ; seul le RELATIF
(Surch < ES sur ce workload) est exploitable.

## Pour des chiffres absolus crédibles
Vraie machine (plan Scaleway) : instance dédiée, **temps dataprep** comme métrique
d'indexation (pipeline complète), artillery sur **gp1-xs** (taille représentative),
corpus full 28M via dataprep + snapshot.
