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

## Validation locale tiny-scale (2026-05-26)
Conteneur Surch local (`ghcr.io/rhanka/surch:latest`, wire OpenSearch 2.17.1) :
- **Mapping matchID `deces_index.yml` accepté** par Surch (création d'index OK)
  — `pattern_replace` char_filter, `index_prefixes`, `geo_point`, `normalizer`
  custom, multi-fields `.raw`, date `yyyyMMdd` : tous supportés.
- **Bulk** d'un extrait (3 docs) : 0 erreur.
- **Requêtes** type deces-backend OK : `match NOM=martin` → 2 hits (analyzer
  `norm` lowercase appliqué), `bool must[NOM,PRENOM]` → 1 hit, scores BM25.
- **Gap parité identifié** : type numérique `short` (AGE_DECES) et `byte` non
  supportés par Surch (`mapper_parsing_exception`) → contourné en `integer`
  pour le test ; corrigé côté surch (support `short`/`byte`). À retirer du
  mapping de contournement une fois la release surch avec le fix utilisée.

## Stack complet monté en local (2026-05-26) — findings swap
Stack debout : **Surch + Redis + deces-backend** (images locales). Le chemin
bout-en-bout `deces-backend → Surch` est confirmé (Surch reçoit bien
`POST /deces/_search`). Findings de câblage indispensables :
1. **Le backend hardcode `node: 'http://elasticsearch:9200'`** (`dist/elasticsearch.js`)
   — il **ignore `ES_URL`**. Surch doit donc tourner sur le **port 9200** sous
   l'alias réseau `elasticsearch` (pas 7700). Override compose corrigé.
2. **Le backend exige Redis** (host hardcodé `redis`, image `redis:alpine`) en
   amont de la recherche ; sans lui le flux renvoie `total:0` sans atteindre ES.
3. **BLOQUEUR — product check du client ES v8** : le backend utilise
   `@elastic/elasticsearch` **8.18.2**, dont le transport
   (`@elastic/transport/lib/Transport.js`) **exige le header réponse
   `x-elastic-product: Elasticsearch`** sinon lève `ProductNotSupported`.
   Surch (profil OpenSearch) ne l'émet pas → la recherche du backend renvoie
   silencieusement `total:0`, alors que la **requête exacte du backend POSTée
   directement à Surch renvoie le bon hit** (vérifié). Toutes les briques DSL
   (`match`, `fuzziness:auto`, `function_score`, `bool minimum_should_match`,
   `min_score`, `sort _score`, `track_total_hits`) fonctionnent sur Surch.
   → décision de scope ouverte (cf. ci-dessous + handover).

## Étapes
- [x] Plan + voie de peuplement confirmée (dataprep, pas snapshot).
- [x] Override compose : service `surch` (alias `elasticsearch`, **port 9200**),
      drop-in `packages/deces-infra/docker-compose-surch.yml` + service Redis.
- [x] Validation swap tiny-scale locale : mapping accepté + bulk + requêtes
      DSL OK (gap `short`/`byte` corrigé côté surch).
- [x] Stack backend+Redis+Surch monté ; `_search` backend→Surch confirmé.
- [x] **SWAP END-TO-END PROUVÉ** (2026-05-26) : avec un Surch portant le header
      de compat opt-in `SURCH_ELASTIC_PRODUCT_COMPAT=1` (image construite depuis
      surch main `0ccb5be`), `GET /deces/api/v1/search?firstName=jean&lastName=martin`
      renvoie `total:1` avec le résultat complet (JEAN MARTIN, score 0.94, shape
      matchID intégrale : name/birth/death/scores). Le product check du client
      `@elastic/elasticsearch` v8 est satisfait → **deces-backend interroge Surch
      à la place d'Elasticsearch, de bout en bout.**

## Parité + latence via le VRAI backend — Surch vs ES 8.6.1 (local, indicatif)
Même deces-backend, même requête (`firstName=jean&lastName=martin`), même
mapping + extrait synthétique (3 docs), alias `elasticsearch:9200` basculé
d'un moteur à l'autre :

| Via deces-backend | total | maxScoreES (BM25) | latence p50 | moy |
|-------------------|------:|------------------:|------------:|----:|
| → **Surch** (header compat) | 1 | 1.4508328 | **2.7 ms** | 2.9 ms |
| → **Elasticsearch 8.6.1** | 1 | 1.4508327 | 6.8 ms | 7.0 ms |

- **Parité exacte** : même hit, score BM25 identique à 6 décimales — le backend
  obtient le même résultat des deux moteurs (parité confirmée end-to-end, pas
  seulement au niveau wire).
- **Latence** : Surch ~2.5x plus rapide ici, mais **corpus de 3 docs → chiffre
  INDICATIF du câblage/round-trip, PAS un benchmark**. Le benchmark stable
  (artillery `test-perf-v1` + temps d'indexation) se fait **en CI sur le corpus
  réel** (via dataprep) — le scénario artillery rejoue des noms aléatoires qui
  n'ont de sens que sur le vrai corpus.

## Temps d'indexation — corpus RÉEL 1,36M docs (Surch vs ES 8.6.1)
Corpus réel matchID restauré depuis le snapshot dev
(`esdata_eb84b2eb_74bab91a`, bucket `fichier-des-personnes-decedees-elasticsearch-dev`)
= **1 355 728 docs** (un mois INSEE, `deces-2020-m01`). Même dump bulk
(`/tmp/deces-real.bulk.ndjson`), même mapping réel, mêmes chunks de 10 000 docs
en série, `refresh_interval=30s`, même machine.

| Moteur | Docs | Temps bulk | Débit moyen |
|--------|-----:|-----------:|------------:|
| **Surch** | 1 355 728 | **426 s** (~7,1 min) | ~3 180 docs/s |
| **Elasticsearch 8.6.1** | 1 355 728 | 834 s (~13,9 min) | ~1 624 docs/s |

→ **Surch indexe le corpus réel ~1,96x plus vite qu'Elasticsearch 8.6.1.**

Caveats / findings :
- Mesure **locale mono-machine** (indicative, corpus réel) ; la mesure stable
  multi-rep reste pour la CI K8s.
- **Débit Surch décroissant** avec la taille de l'index (~4 783 docs/s sur les
  200 premiers k → ~1 901 docs/s vers 1,2M) : coût par bulk croissant (rebuild
  partiel à chaque chunk) — piste d'optimisation. ES reste plus constant.
- **Finding concurrence Surch** : pendant un bulk soutenu, des lectures
  concurrentes (`_count`/`_search`) ont **bloqué** Surch (reads + writes en
  hang). En bulk série sans accès concurrent : 0 hang, 1,36M OK. À investiguer
  côté surch (contention lecteur/écrivain sous charge d'indexation).

## Recette du swap local (reproductible)
1. `docker network create deces-eval`
2. Surch : `docker run -d --name deces-surch --network deces-eval
   --network-alias elasticsearch -e SURCH_PORT=9200
   -e SURCH_ELASTIC_PRODUCT_COMPAT=1 surch:<tag>` (port **9200** : le backend
   hardcode `http://elasticsearch:9200`).
3. Redis : `docker run -d --name deces-redis --network deces-eval
   --network-alias redis redis:alpine`.
4. Backend : `docker run -d --name deces-backend --network deces-eval
   -e COMMUNES_JSON=data/communes.json -e DISPOSABLE_MAIL=data/disposable-mail.txt
   -e DB_JSON=data/userDB.json -e PROOFS=data/proofs -e JOBS=data/jobs
   -e WIKIDATA_LINKS=data/wikidata.json -e BACKEND_JOB_CONCURRENCY=6
   -e BACKEND_CHUNK_CONCURRENCY=3 -e BACKEND_TMP_MAX=150 -e BACKEND_TMP_DURATION=14400
   -e BACKEND_TMP_WINDOW=86400 -e BACKEND_TMPFILE_PERSISTENCE=3600000
   -e BACKEND_LOG_LEVEL=error -e BACKEND_TOKEN_KEY=devkey -e BACKEND_TOKEN_USER=dev
   -e BACKEND_TOKEN_PASSWORD=dev -e ES_INDEX=deces -e APP=deces -e APP_VERSION=latest
   -p 8084:8080 matchid/deces-backend:latest`.
5. Peupler (ici extrait synthétique ; en réel = dataprep) puis interroger
   `localhost:8084/deces/api/v1/search?...`.
- [ ] Dataprep → Surch sur extrait réduit : valider l'indexation + santé index.
- [ ] `test-perf-v1` contre Surch (extrait) : valider le scénario passe.
- [ ] Passage CI : dataprep + artillery Surch vs ES, datasets complets,
      chiffres publiés (indexation + latence).
- [ ] Caveats : champs/mappings non couverts par Surch (cf. gap-analysis),
      requêtes du backend non supportées → à lister.

## Procédure de run

### 1. Démarrer Surch (à la place d'ES)
```
export DC_NETWORK=<réseau matchID>      # cf. matchID Makefile
export ES_PORT=7700                     # Surch écoute sur 7700
export SURCH_TAG=sha-<HEAD surch>       # CI ; ':dev' en local
docker compose -f packages/deces-infra/docker-compose-surch.yml up -d surch
```
Les alias réseau `elasticsearch` + `deces-elasticsearch` rendent le swap
transparent pour le backend (`ES_HOST?=elasticsearch`) **et** le dataprep
(`ES_HOST?=deces-elasticsearch`). Seul `ES_PORT=7700` est à surcharger.

### 2. Peupler Surch via dataprep (= mesure d'indexation)
La recette `deces_dataprep` lit `deces_src` (CSV S3/data.gouv) et écrit dans
`deces_index` (connector elasticsearch → Surch).
```
make -C packages/deces-dataprep recipe-run-local ES_PORT=7700
```
- Petit extrait local : `test_chunk_size: 100` (recette) / `CHUNK_SIZE` réduit.
- Datasets complets : en CI (creds dev dans `matchID/artefacts`).
- **Mesurer le temps d'indexation** : durée de `recipe-run-local` + `_count`
  final sur Surch (`GET /deces/_count`).

### 3. Artillery contre Surch
```
make -C packages/deces-backend test-perf-v1   # scénario test-backend-v1.yml
```
Comparer aux mêmes chiffres ES baseline (snapshot dev restauré OU même dataprep).

## Caveats parité à vérifier au peuplement
Le mapping `deces_index.yml` exerce des réglages ES à confirmer côté Surch :
- `index.store.preload`, `refresh_interval`, `number_of_replicas` → réglages ES
  d'I/O/réplication, probablement ignorés/no-op côté Surch (in-memory).
- `char_filter` `pattern_replace` (`alphanum`) + `normalizer` custom `norm`.
- `tokenizer` `edge_ngram` (autocomplete) — déjà certifié B2 deces_v2 côté surch.
- `dynamic: False` (rejet des champs hors mapping).
→ tout réglage non supporté qui ferait échouer le PUT mapping est un point de
gap à lister (et à router vers la roadmap surch si bloquant).
