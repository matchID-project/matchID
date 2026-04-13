# SPEC_EVOL_003 - Remise en route de la chaîne complète dataprep -> backend -> ui

## Contexte

Le dépôt doit redevenir le repo de référence d'un système complet, pas seulement d'une collection de packages.

La chaîne fonctionnelle observée est:

1. `tools`
2. `deces-dataprep`
3. `deces-infra`
4. `deces-backend`
5. `deces-ui`

## Objectif

Obtenir un run bout-en-bout reproductible en développement.

## Non-objectifs

- exiger immédiatement les mêmes volumes de données qu'en production
- traiter dès cette étape la bascule définitive prod

## Cas d'usage à couvrir

### Cas 1. Restaurer un snapshot existant

- récupérer l'état des données
- restaurer Elasticsearch
- démarrer backend puis UI
- valider des requêtes fonctionnelles

### Cas 2. Rejouer un dataprep

- récupérer les sources Data.gouv
- exécuter le dataprep
- publier ou restaurer l'index
- valider le backend et la UI sur cet index

## Travaux

### A. Définir le scénario de bootstrap canonique

- commande(s) racine officielles
- prérequis
- fichiers de config nécessaires
- mode "avec snapshot" et mode "avec dataprep"

### B. Définir les smoke tests

- dataprep: exécution minimale ou validation de sortie
- infra: healthcheck Elasticsearch, Redis, SMTP
- backend: healthcheck + requête de recherche + flux OTP si possible
- UI: page d'accueil + recherche simple + bulk/link minimal

### C. Définir les dépendances de données

- communes
- disposable mail
- wikidata
- fichiers Data.gouv
- snapshots elasticsearch

### D. Définir les preuves de compatibilité

- version dataprep compatible avec backend
- source canonique de l'image `backend` consommée par `deces-dataprep` selon les contextes `dev`, `test` et `deploy`
- index attendu par backend
- routes et comportements attendus par UI
- preuve de parité d'indexation entre le `deces-dataprep` original et le `deces-dataprep` monorepo sur un jeu de données de référence
  - égalité exacte du nombre de documents indexés
  - égalité d'un échantillon déterministe de 1000 documents normalisés

## Etat du lot 5 au 13 avril 2026

Le contrat local est maintenant le suivant:

- bootstrap applicatif local depuis la racine: `make dev`
- restore explicite d'un snapshot local: `make elasticsearch-restore`, puis `make dev`
- bootstrap dataprep local depuis la racine: `make dataprep-dev`
- run dataprep local depuis la racine: `make dataprep-run`

La source `backend` observée au lot 5 est maintenant clarifiée ainsi:

- référence historique `deces-dataprep`: image publiée issue de [packages/deces-dataprep/backend](/home/antoinefa/src/matchID/matchID/packages/deces-dataprep/backend), version `0.3.0-87fbbb`, utilisée via `make -C packages/deces-dataprep parity-run-original`
- candidat monorepo: image locale issue de [packages/dataprep-backend](/home/antoinefa/src/matchID/matchID/packages/dataprep-backend), version `0.4.0-4fe0da`, utilisée via `make -C packages/deces-dataprep parity-run-monorepo`
- cible de déploiement visée: artefact `image backend` versionné produit depuis `packages/dataprep-backend`

La source canonique de déploiement reste donc le backend du monorepo, mais le gate de parité avec la référence historique n'est pas encore validé.

Le bootstrap racine `make dev` ne restaure plus implicitement de snapshot. Il démarre maintenant la stack locale sur `elasticsearch-local`. La restauration de snapshot devient une procédure explicite distincte, ce qui rend la sémantique du lot 5 cohérente:

- scénario `bootstrap local`: `make dev`
- scénario `avec snapshot`: `make elasticsearch-restore` puis `make dev`
- scénario `avec dataprep`: `make dataprep-run` puis `make dev`

Point restant ouvert:

- démontrer que l'indexation produite par le `deces-dataprep` monorepo reste sémantiquement identique au comportement de référence sur un jeu de données de test

## Résultat du test de parité au 13 avril 2026

Le protocole de comparaison a été rejoué via `make` uniquement:

- `make -C packages/deces-dataprep parity-run-original`
- `make -C packages/deces-dataprep parity-run-monorepo`

Le harness a été recadré pour que:

- le run `original` utilise bien [packages/deces-dataprep/backend](/home/antoinefa/src/matchID/matchID/packages/deces-dataprep/backend) et son image publiée
- le run `monorepo` utilise bien [packages/dataprep-backend](/home/antoinefa/src/matchID/matchID/packages/dataprep-backend) et une image locale rebuildée depuis le code courant
- chaque run utilise un `ES_DATA` isolé sous `/tmp` pour éviter les effets de bord du backend legacy

Un premier passage a exposé un faux écart de protocole: l'export lisait l'index sans `/_refresh`, ce qui sous-estimait le volume réellement visible côté référence historique.

Le protocole final force désormais `/_refresh` avant export. Avec ce protocole stabilisé, le résultat observé est:

- `original.count = 679573`
- `monorepo.count = 679573`
- l'échantillon déterministe de `1000` documents est strictement identique

Conclusion au 13 avril 2026:

- le protocole de parité est maintenant en place et exécutable via `make`
- la parité d'indexation `original` vs `monorepo` est démontrée sur le jeu de référence
- le gate de parité du lot 5 peut être considéré comme fermé

## Protocole de comparaison d'indexation

Le protocole cible est le suivant:

1. fixer un jeu de référence déterministe, en pratique `FILES_TO_PROCESS=${FILES_TO_PROCESS_TEST}` sauf décision contraire documentée
2. exécuter le `deces-dataprep` original via ses cibles `make` sur un Elasticsearch isolé
3. exécuter le `deces-dataprep` monorepo via ses cibles `make` sur un Elasticsearch isolé
4. comparer le nombre exact de documents indexés
5. extraire un échantillon déterministe de 1000 documents, triés par `_id`
6. normaliser la représentation JSON comparée
7. vérifier l'égalité stricte document par document

## Preuves `make` déjà obtenues au lot 5

- `make dataprep-data-tag`
- `make dataprep-dev`
- `make dataprep-run`
- `make dev`
- `make -C packages/deces-dataprep parity-run-original`
- `make -C packages/deces-dataprep parity-run-monorepo`

Ces preuves couvrent déjà:

- la commande canonique de bootstrap local racine
- la source canonique `backend` pour le dataprep en `dev` et `test`
- la séparation explicite entre bootstrap local, restore snapshot et run dataprep
- la montée locale de `deces-infra`, `deces-backend`, `deces-ui` et `deces-dataprep`
- la récupération de `communes`
- la récupération de `wikidata`
- la récupération de `disposable-mail`
- la récupération des sources Data.gouv
- l'exécution effective du protocole de parité d'indexation

## Critères d'acceptation

- un développeur peut recréer la chaîne en suivant la doc du monorepo
- au moins un scénario de restauration et un scénario de fonctionnement applicatif sont validés
- la séquence de démarrage et d'arrêt est déterministe

## Dépendances

- [SPEC_EVOL_001](SPEC_EVOL_001_RATTRAPAGE_UPSTREAM_REFERENCES.md)
- [SPEC_EVOL_002](SPEC_EVOL_002_NORMALISATION_RUNTIME_MONOREPO.md)
- [SPEC_EVOL_004](SPEC_EVOL_004_VALIDATION_DEV_ET_CI.md)
