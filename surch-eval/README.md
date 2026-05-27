# surch-eval — évaluation end-to-end Surch en remplacement d'Elasticsearch

Branche `surch-eval` (matchID-project/matchID) : faire tourner le vrai
`deces-backend` + son test artillery (`test-perf-v1`) contre **Surch** à la
place d'Elasticsearch 8.6.1, et mesurer **temps d'indexation** + **latence
artillery** sur les jeux de données matchID.

## Mécanique (cf. surch `docs/wp-d-matchid/swap-guide.md`)
- `deces-backend` parle à ES via `ES_URL=${ES_HOST}:${ES_PORT}`. Le swap =
  pointer `ES_HOST` sur un conteneur **Surch** (`ghcr.io/rhanka/surch`, port 7700,
  wire OpenSearch 2.17.1). Surch est déjà certifié parité matchID B1/B2
  (b1-oracle 30/30, b2-oracle deces_v2 8/8) côté repo surch.

## Peuplement de l'index — décision actée
- **Surch : via `deces-dataprep`** (connector `elasticsearch` → URL Surch),
  PAS via restauration de snapshot ES : le snapshot ES est du format Lucene,
  Surch a son propre format natif (`surch_snapshot_format_version: 1`) →
  restauration infaisable. La ré-indexation dataprep **donne le temps
  d'indexation** (objectif user) sur chaque dataset.
- **ES baseline** : restauration du snapshot dev
  (`fichier-des-personnes-decedees-elasticsearch-dev`) OU même dataprep, pour
  une comparaison équitable.

## Mesures cibles
1. **Temps d'indexation** (dataprep → Surch vs → ES) par dataset.
2. **Latence artillery** `test-perf-v1` (scénario
   `packages/deces-backend/tests/performance/scenarios/test-backend-v1.yml`,
   2→50 RPS, 50/50 GET+POST) contre Surch vs ES.

## Cycle
- **Petite échelle en local** (docker-compose, extrait réduit) pour valider le
  câblage Surch + dataprep + backend + artillery.
- **Mesure stable en CI matchID** (creds dev dans `matchID/artefacts`,
  recettes S3/data.gouv) pour les chiffres publiables.

## Note importante — Surch est en mémoire
Surch n'a pas de répertoire de données local : l'index est tenu **en mémoire**
(persistance optionnelle via snapshot S3). À chaque démarrage l'index est vide
→ il faut **ré-indexer via dataprep** à chaque run, ce qui fournit pile la
mesure de temps d'indexation voulue. Le swap réseau utilise l'alias
`elasticsearch` (cf. `packages/deces-infra/docker-compose-surch.yml`) + `ES_PORT=7700`.

## Étapes
- [x] Plan + voie de peuplement confirmée (dataprep, pas snapshot).
- [x] Override compose : service `surch` (alias `elasticsearch`, port 7700),
      drop-in `packages/deces-infra/docker-compose-surch.yml` (`ES_PORT=7700`).
- [ ] Dataprep → Surch sur extrait réduit : valider l'indexation + santé index.
- [ ] `test-perf-v1` contre Surch (extrait) : valider le scénario passe.
- [ ] Passage CI : dataprep + artillery Surch vs ES, datasets complets,
      chiffres publiés (indexation + latence).
- [ ] Caveats : champs/mappings non couverts par Surch (cf. gap-analysis),
      requêtes du backend non supportées → à lister.
