# PLAN

- [x] Lot 0 - Cadrage de migration fige
  - [x] Exec
    - [x] Creer la branche d'integration dediee au rebase monorepo
    - [x] Figer dans une spec la matrice des SHAs importes et des branches upstream cibles
    - [x] Figer dans une spec la liste des ecarts monorepo voulus vs ecarts non voulus
    - [x] Decider et documenter que l'execution de reference se fait depuis la racine
    - [x] Decider et documenter le role cible de `deces-infra`
    - [x] Decider et documenter le role cible de `tools`
    - [x] Decider et documenter la strategie de configuration hors git
    - [x] Figer et documenter que `deploy-remote` est la voie canonique de deploiement preprod et prod a ce stade
    - [x] Sortir `deploy-k8s` du chemin critique et le placer en roadmap
    - [x] Figer et documenter que le contrat d'artefacts de reference de la chaine complete est `image backend` + `image deces-backend` + `image deces-ui` + `snapshot Elasticsearch esdata_${DATAPREP_VERSION}_${DATA_VERSION}`
    - [x] Figer et documenter que l'artefact de reference de `deces-dataprep` pour `deploy-remote` est le snapshot Elasticsearch `esdata_${DATAPREP_VERSION}_${DATA_VERSION}`
  - [x] Tests
    - [x] Verifier la coherence entre `PLAN.md` et les specs
    - [x] Verifier la coherence entre artefacts de reference, execution du dataprep, `deploy-remote` et preprod cible
    - [x] Verifier que les decisions actees couvrent bien `deces-dataprep`, `deces-backend`, `deces-ui` et `deces-infra`
  - [x] UAT
    - [x] Gate: je te presente la matrice upstream, les ecarts voulus, les artefacts de reference complets et la voie de deploiement canonique
    - [x] Gate: tu valides le cadrage du lot 0 avant tout rattrapage upstream

- [x] Lot 1 - Rattrapage upstream de `tools` et `deces-dataprep`
  - [x] Exec
    - [x] Relever precisement les 2 commits upstream manquants de `packages/tools`
    - [x] Integrer le commit `19bdb29` de `packages/tools` (`checksums changed their address in datagouv`)
    - [x] Integrer le commit `3797919` de `packages/tools` (`lets fix again : no more checksum in datagouv ...`)
    - [x] Documenter les ecarts residuels conserves pour `packages/tools`
    - [x] Relever precisement les 2 commits upstream manquants de `packages/deces-dataprep`
    - [x] Integrer le commit `d12b125` de `packages/deces-dataprep` (`feat: update FILES_TO_PROCESS regex for year 2026`)
    - [x] Integrer le commit `e0489f1` de `packages/deces-dataprep` (`Merge pull request #158 ... year-2026`)
    - [x] Conserver l'import upstream `FILES_TO_PROCESS` as is dans son commit de rattrapage, sans melanger de correction monorepo
    - [x] Documenter les ecarts residuels conserves pour `packages/deces-dataprep`
    - [x] Corriger en commit separe l'usage local inutile de `sudo` dans `packages/tools` (`config-proxy` et `docker-config-proxy`) pour respecter les regles du monorepo et debloquer les validations `make`
    - [x] Faire reutiliser a `packages/deces-dataprep` les prerequis mutualises du monorepo pour `config`, `network` et `vm_max` afin de debloquer les gates `make` du lot 1 sans rouvrir le lot 4
    - [x] Debloquer le `frontend` historique utilise par `packages/deces-dataprep` en neutralisant l'audit npm uniquement pour le `dev` local
  - [x] Tests
    - [x] Ne compter comme validation du lot 1 que des executions via cibles `make`
    - [x] Valider le calcul canonique du tag de donnees via `make data-version` a la racine et `make -C packages/deces-dataprep data-tag`
    - [x] Valider le lancement local cible de `packages/deces-dataprep` via `make -C packages/deces-dataprep dev`
    - [x] Valider un run minimal de dataprep en environnement de dev via `make -C packages/deces-dataprep recipe-run`
    - [x] Lister explicitement les tests executes et leur resultat avant entree en UAT du lot 1
  - [x] UAT
    - [x] Gate: je te presente les commits rattrapes, les ecarts residuels et les preuves de test `tools` + `deces-dataprep`
    - [x] Gate: tu valides que le lot 1 est termine et qu'on peut ouvrir le lot 2

- [x] Lot 2 - Rattrapage upstream de `deces-backend`
  - [x] Exec
    - [x] Relever precisement tous les commits upstream manquants de `packages/deces-backend`
    - [x] Integrer le commit `b3a91cc` de `packages/deces-backend` (`Update score.ts`)
    - [x] Integrer le commit `8a38acd` de `packages/deces-backend` (`Merge pull request #491 ... Update score.ts`)
    - [x] Integrer le commit `d8eda70` de `packages/deces-backend` (`move contact mail to contact@matchid.io`)
    - [x] Integrer le commit `8dcdfc3` de `packages/deces-backend` (`Merge pull request #492 ... new-contact-mail`)
    - [x] Integrer le commit `c37bd0d` de `packages/deces-backend` (`update vuln in package-lock`)
    - [x] Integrer le commit `f73db56` de `packages/deces-backend` (`push mail validation code duration to 6 hours`)
    - [x] Integrer le commit `367c0f1` de `packages/deces-backend` (`Merge pull request #500 ... code-validation-duration`)
    - [x] Integrer le commit `794b3b6` de `packages/deces-backend` (`Add rate limit to send OTP mail function`)
    - [x] Integrer le commit `79cc134` de `packages/deces-backend` (`Add test for send email rate limit`)
    - [x] Integrer le commit `747c0ff` de `packages/deces-backend` (`Apply exponential rate limit when sending emails frequently`)
    - [x] Integrer le commit `b5dba5a` de `packages/deces-backend` (`fix: exp backoff; refine display; fix OTP delay`)
    - [x] Integrer le commit `5894a91` de `packages/deces-backend` (`Merge pull request #502 ... send-email-ratelimit`)
    - [x] Documenter les ecarts residuels conserves pour `packages/deces-backend`
    - [x] Rendre le port Maildev local parametrable pour eviter les collisions et garder `make backend-dev` testable
  - [x] Tests
    - [x] Ne compter comme validation du lot 2 que des executions via cibles `make`
    - [x] Valider le demarrage local cible de `packages/deces-backend` via `make backend-dev`
    - [x] Preparer l'index Elasticsearch de reference requis par les tests backend via `make elasticsearch`
    - [x] Rendre `make backend-dev-test` compatible avec l'image Alpine utilisee par le backend
    - [x] Assurer la presence du fichier de test `clients_test.csv` au chemin attendu par `server.spec.ts`
    - [x] Isoler `bulk.spec.ts` pour qu'il ne lance pas de vrais jobs et ne pollue pas la suite backend
    - [x] Garantir un singleton des workers bulk `processStream` pendant la suite backend pour eviter les collisions entre fichiers de tests
    - [x] Attendre explicitement le readiness check dans `make backend-dev` avant de considerer le backend dev demarre
    - [x] Serialiser l'execution inter-fichiers de Vitest pour `packages/deces-backend` afin d'eviter les collisions Redis/filesystem
    - [x] Reinitialiser Redis backend et les fichiers `.enc` transitoires avant `make backend-test-vitest`
    - [x] Arreter le backend dev resident avant `make backend-test-vitest` pour eviter deux workers backend concurrents sur Redis
    - [x] Valider les tests backend cibles via `make backend-test-vitest` puis `make backend-dev-test`
    - [x] Verifier explicitement les comportements touches par le rattrapage backend a travers les cibles `make` precedentes
    - [x] Lister explicitement les tests executes et leur resultat avant entree en UAT du lot 2
  - [x] UAT
    - [x] Gate: je te presente les commits rattrapes, les ecarts residuels et les preuves de test backend
    - [x] Gate: tu valides que le rattrapage backend reste bien limite au perimetre attendu
    - [x] Gate: tu valides que le lot 2 est termine et qu'on peut ouvrir le lot 3

- [x] Lot 3 - Rattrapage upstream de `deces-ui`
  - [x] Exec
    - [x] Relever precisement tous les commits upstream manquants de `packages/deces-ui`
    - [x] Integrer le commit `31b8079` de `packages/deces-ui` (`art 85`)
    - [x] Integrer le commit `073cf2d` de `packages/deces-ui` (`Merge pull request #976 ... art-85`)
    - [x] Integrer le commit `cc72ff0` de `packages/deces-ui` (`art 85`)
    - [x] Integrer le commit `0ba3431` de `packages/deces-ui` (`Merge pull request #979 ... art-85`)
    - [x] Integrer le commit `47bcb86` de `packages/deces-ui` (`move contact mail to contact@matchid.io`)
    - [x] Integrer le commit `b828650` de `packages/deces-ui` (`Merge pull request #981 ... new-contact-mail`)
    - [x] Integrer le commit `7875bc3` de `packages/deces-ui` (`avoid resetting token if there is an atypical network error`)
    - [x] Integrer le commit `c51de22` de `packages/deces-ui` (`Merge pull request #983 ... reset-token`)
    - [x] Integrer le commit `d0e25ab` de `packages/deces-ui` (`fix vulns in package-lock`)
    - [x] Integrer le commit `12d50e1` de `packages/deces-ui` (`art 85`)
    - [x] Integrer le commit `f50aa3c` de `packages/deces-ui` (`enable test to be flexible to validation code duration`)
    - [x] Integrer le commit `8a53d7e` de `packages/deces-ui` (`Merge pull request #986 ... art-85`)
    - [x] Integrer le commit `f182d28` de `packages/deces-ui` (`art 85`)
    - [x] Integrer le commit `da04697` de `packages/deces-ui` (`Merge pull request #988 ... art-85`)
    - [x] Integrer le commit `69713ba` de `packages/deces-ui` (`year 2026`)
    - [x] Integrer le commit `43bd91a` de `packages/deces-ui` (`Merge pull request #993 ... 2026`)
    - [x] Integrer le commit `08e33bb` de `packages/deces-ui` (`desactivate google analytics`)
    - [x] Integrer le commit `82ba880` de `packages/deces-ui` (`Merge pull request #995 ... desactivate-google-analytics`)
    - [x] Documenter les ecarts residuels conserves pour `packages/deces-ui`
    - [x] Debloquer `make frontend-dev` en neutralisant l'audit npm uniquement pour le dev UI local
    - [x] Debloquer `make frontend-test` en rendant la cible UI compatible avec les variables et services du monorepo
  - [x] Tests
    - [x] Ne compter comme validation du lot 3 que des executions via cibles `make`
    - [x] Valider le demarrage local cible de `packages/deces-ui` via `make frontend-dev`
    - [x] Valider les tests UI cibles via `MAILDEV_UI_PORT=37343 make frontend-test`
    - [x] Verifier explicitement les comportements touches par le rattrapage UI a travers les cibles `make` precedentes
    - [x] Lister explicitement les tests executes et leur resultat avant entree en UAT du lot 3
  - [x] UAT
    - [x] Gate: je te presente les commits rattrapes, les ecarts residuels et les preuves de test UI
    - [x] Gate: tu valides que le rattrapage UI reste bien limite au perimetre attendu
    - [x] Gate: tu valides que le lot 3 est termine et qu'on peut ouvrir le lot 4

- [x] Lot 4 - Runtime monorepo stabilise
  - [x] Exec
    - [x] Verifier que `packages/dataprep-backend` reste aligne sur `matchID-project/backend:dev`
    - [x] Verifier que `packages/dataprep-frontend` reste aligne sur `matchID-project/frontend:dev`
    - [x] Corriger la dependance racine a `tagfiles.version`
    - [x] Supprimer le `git clone backend` dans `packages/deces-dataprep/Makefile`
    - [x] Remplacer dans `packages/deces-dataprep` les appels `backend/tools` par `packages/tools`
    - [x] Remplacer dans `packages/deces-dataprep` les chemins `backend/*` par des chemins monorepo explicites
    - [x] Mutualiser explicitement `network`, `vm_max`, `elasticsearch-start`, `elasticsearch-check` et `elasticsearch-stop` entre la racine et `deces-infra`
    - [x] Faire consommer a `packages/deces-dataprep` les cibles Elasticsearch mutualisees au lieu du backend clone quand le monorepo fournit deja l'infra cible
    - [x] Retirer ou neutraliser le doublon `packages/deces-backend/tools`
    - [x] Definir le contrat des variables exportees par la racine
    - [x] Definir le contrat des variables propres aux packages
    - [x] Stabiliser la source de verite de `.data.sha1`
    - [x] Stabiliser la source de verite de `.dataprep.sha1`
    - [x] Traiter en commit separe l'harmonisation du moteur regex shell/Python autour de `FILES_TO_PROCESS` en forme POSIX-compatible (`[0-9]` plutot que `\d`) si l'ecart reste utile a corriger
    - [x] Deplacer Redis de `deces-backend` vers `deces-infra`
    - [x] Deplacer SMTP de `deces-backend` vers `deces-infra`
    - [x] Clarifier la responsabilite des snapshots et restores entre `deces-infra`, `deces-dataprep` et `tools`
  - [x] Tests
    - [x] Valider le fonctionnement local cible de `packages/dataprep-backend`
    - [x] Valider le fonctionnement local cible de `packages/dataprep-frontend`
    - [x] Valider que chaque package peut etre execute sans dependance implicite a un clone externe
    - [x] Lister explicitement les tests executes et leur resultat avant entree en UAT du lot 4
  - [x] UAT
    - [x] Gate: je te presente le runtime cible du monorepo, les contrats retenus et les preuves de test de non-regression structurelle
    - [x] Gate: tu valides que le lot 4 est termine et qu'on peut ouvrir le lot 5

- [x] Lot 5 - Chaine dev complete validee
  - [x] Exec
    - [x] Definir la commande canonique de bootstrap dev depuis la racine
    - [x] Definir explicitement quelle image `backend` est la source canonique pour `deces-dataprep` en dev, en test et pour le deploiement
    - [x] Definir la procedure canonique de restore snapshot
    - [x] Definir la procedure canonique de run dataprep
    - [x] Definir le protocole canonique de comparaison d'indexation entre le `deces-dataprep` original et le `deces-dataprep` monorepo sur un jeu de donnees de reference
    - [x] Rendre `make dev` racine reproductible
    - [x] Documenter la procedure de bootstrap dev
  - [x] Tests
    - [x] Valider `deces-infra` en local
    - [x] Valider Elasticsearch en local
    - [x] Valider Redis en local
    - [x] Valider SMTP en local
    - [x] Valider `deces-backend` en local
    - [x] Valider `deces-ui` en local
    - [x] Valider `deces-dataprep` en local
    - [x] Valider la recuperation de `communes`
    - [x] Valider la recuperation de `wikidata`
    - [x] Valider la recuperation de `disposable-mail`
    - [x] Valider la recuperation des sources Data.gouv
    - [x] Rejouer une indexation de reference avec le `deces-dataprep` original et avec le `deces-dataprep` monorepo via des cibles `make`
    - [x] Valider l'egalite exacte du nombre de documents indexes entre les deux runs de reference
    - [x] Valider l'egalite de 1000 documents echantillonnes de maniere deterministe entre les deux runs de reference
    - [x] Valider la compatibilite dataprep -> index -> backend -> ui
    - [x] Lister explicitement les tests executes et leur resultat avant entree en UAT du lot 5
  - [x] UAT
    - [x] Gate: je te presente la procedure dev canonique, la source canonique de l'image `backend` pour `deces-dataprep`, la preuve de parite d'indexation et les preuves de fonctionnement bout en bout en local
    - [x] Gate: tu valides que la chaine dev complete est acceptable et qu'on peut ouvrir le lot 6

- [x] Lot 6 - CI monorepo et non-regression validees
  - [x] Exec
    - [x] Inventorier les workflows CI historiques par composant
    - [x] Inventorier les workflows CD historiques par composant
    - [x] Distinguer explicitement la CI de validation de la CI de build/publication d'artefacts
    - [x] Mapper le job CI historique de `deces-dataprep` sur `make -C packages/deces-dataprep all`
    - [x] Mapper le job CI historique de `deces-backend` sur build image, avec runtime backend couvert par le job historique `deces-ui`
    - [x] Mapper le job CI historique de `deces-ui` sur build, `deploy-local`, `backend-test` et `frontend-test`
    - [x] Mapper les jobs CI historiques de `dataprep-backend` et `dataprep-frontend`
    - [x] Creer la CI racine du monorepo
    - [x] Ajouter le job lint/build/tests de `deces-backend`
    - [x] Ajouter le job build/tests de `deces-ui`
    - [x] Ajouter le job de validation ciblee de `deces-dataprep`
    - [x] Ajouter le job de validation ciblee de `tools`
    - [x] Couvrir la chaine complete via les jobs historiques `deces-ui` et `deces-dataprep`
    - [x] Definir les declenchements conditionnels par chemins modifies
    - [x] Sortir la CI des dependances a l'environnement personnel
    - [x] Confirmer qu'aucune donnee artificielle durable n'est necessaire en CI
    - [x] Definir les secrets necessaires en CI
    - [x] Definir les checks bloquants pour merge
    - [x] Documenter que les jobs historiques de build/publication d'images de `dataprep-backend` et `dataprep-frontend` ne sont pas encore reconstruits dans la CI racine et relevent du lot 7
    - [x] Documenter que les jobs historiques de deploiement relevent des lots 7 et 8, pas du lot 6
  - [x] Tests
    - [x] Valider un pipeline CI vert sur la branche d'integration
    - [x] Valider que les jobs CI historiques couvrent bien les gates des lots precedents
    - [x] Valider le tableau de mapping avant/apres des workflows CI par composant
    - [x] Lister explicitement les tests executes et leur resultat avant entree en UAT du lot 6
  - [x] UAT
    - [x] Gate: je te presente le pipeline cible, sa couverture et les preuves de passage au vert
    - [x] Gate: tu valides que la CI monorepo est suffisante pour ouvrir le lot 7

- [x] Lot 7 - Artefacts de reference produits et publies
  - [x] Exec
    - [x] Definir la convention de versionnage monorepo des artefacts
    - [x] Definir les artefacts versionnes par package
    - [x] Definir la convention de calcul et d'exposition de `DATAPREP_VERSION` et `DATA_VERSION` pour le deploiement
    - [x] Etablir la matrice exhaustive de parite workflow/job historique -> workflow/job monorepo
      - [x] Lister `packages/tools/.github/workflows/actions.yml` / job `swift`
      - [x] Lister `packages/tools/.github/workflows/actions.yml` / job `remote`
      - [x] Lister `packages/dataprep-backend/.github/workflows/pull.yml` / job `test`
      - [x] Lister `packages/dataprep-backend/.github/workflows/push.yml` / job `build`
      - [x] Lister `packages/dataprep-backend/.github/workflows/deploy.yml` / job `deploy`
      - [x] Lister `packages/dataprep-frontend/.github/workflows/pull.yml` / job `test`
      - [x] Lister `packages/dataprep-frontend/.github/workflows/push.yml` / job `build`
      - [x] Lister `packages/deces-backend/.github/workflows/dockerimage.yml` / job `build`
      - [x] Lister `packages/deces-backend/.github/workflows/dockerimage.yml` / job `bulk`
      - [x] Lister `packages/deces-ui/.github/workflows/pr.yml` / job `test`
      - [x] Lister `packages/deces-ui/.github/workflows/push.yml` / job `build`
      - [x] Lister `packages/deces-ui/.github/workflows/push.yml` / job `deploy`
      - [x] Lister `packages/deces-ui/.github/workflows/logs-full.yml`
      - [x] Lister `packages/deces-ui/.github/workflows/logs-update.yml`
      - [x] Lister `packages/deces-dataprep/.github/workflows/pr.yml` / job `test`
      - [x] Lister `packages/deces-dataprep/.github/workflows/small.yml` / job `build`
      - [x] Lister `packages/deces-dataprep/.github/workflows/year.yml` / job `build`
      - [x] Lister `packages/deces-dataprep/.github/workflows/full.yml` / job `check-previous-failure`
      - [x] Lister `packages/deces-dataprep/.github/workflows/full.yml` / job `build`
      - [x] Lister `packages/deces-dataprep/.github/workflows/push-dev.yml` / job `build`
      - [x] Lister `packages/deces-dataprep/.github/workflows/push-master.yml` / job `build`
    - [x] Pour chaque job historique liste, renseigner explicitement son statut cible (`ci.yml`, `cd.yml`, lot 8 ou retire du contrat)
    - [x] Definir explicitement le sort des jobs historiques CD de build/publication d'images de `dataprep-backend` et `dataprep-frontend`
    - [x] Si ces images restent requises, reconstruire leurs jobs CD de build/publication dans le monorepo
    - [x] Definir explicitement le sort des jobs historiques CD de build/publication d'images de `deces-backend` et `deces-ui`
    - [x] Reconstruire les jobs CD de build/publication d'artefacts requis dans le monorepo
    - [x] Reconstruire le job CD GitHub de publication du snapshot dataprep dans le monorepo
    - [x] Figer la picture complete lots 6/7/8 `upstream -> monorepo`, service par service et job par job
  - [x] Tests
    - [x] Prouver en local via `make` chaque job monorepo reconstruit au lot 7
    - [x] Prouver sur GitHub Actions chaque job CD monorepo reconstruit au lot 7
    - [x] Prouver sur GitHub Actions chaque job CI monorepo apres retour aux commandes make historiques
    - [x] Capturer pour chaque preuve GitHub le workflow, le job, le `run id` et le statut final
    - [x] Verifier localement le contenu des artefacts produits par les jobs reconstruits quand un artefact est attendu
    - [x] Valider le build local de l'image `matchid-backend`
    - [x] Valider la publication locale de l'image `matchid-backend`
    - [x] Valider la publication GitHub de l'image `matchid-backend`
    - [x] Valider le build local de l'image `matchid-frontend`
    - [x] Valider la publication locale de l'image `matchid-frontend`
    - [x] Valider la publication GitHub de l'image `matchid-frontend`
    - [x] Valider le build local de l'image `deces-backend`
    - [x] Valider la publication locale de l'image `deces-backend`
    - [x] Valider la publication GitHub de l'image `deces-backend`
    - [x] Valider le build local de l'image `deces-ui`
    - [x] Valider la publication locale de l'image `deces-ui`
    - [x] Valider la publication GitHub de l'image `deces-ui`
    - [x] Lever le blocage GitHub `DOCKER_PASSWORD` pour les jobs `Publish * image`
    - [x] Valider la production du snapshot Elasticsearch `esdata_${DATAPREP_VERSION}_${DATA_VERSION}`
    - [x] Valider la publication du snapshot Elasticsearch `esdata_${DATAPREP_VERSION}_${DATA_VERSION}`
    - [x] Valider la publication GitHub du snapshot Elasticsearch `esdata_${DATAPREP_VERSION}_${DATA_VERSION}`
    - [x] Valider la restauration du snapshot Elasticsearch `esdata_${DATAPREP_VERSION}_${DATA_VERSION}` dans le flux `deploy-remote`
    - [x] Valider l'egalite stricte count + sample entre l'index avant suppression et l'index restaure depuis le snapshot artefact
    - [x] Nettoyer `ci.yml` des validations inventees et revenir aux commandes `make` historiques des repos sources
    - [x] Centraliser la matrice des cibles `make` CI/CD, runtime avec donnees et complements SCW lot 8 dans `spec/SPEC_EVOL_MAKE_CICD_CHECKLIST.md`
    - [x] Produire le tableau paddé de demonstration `source -> monorepo -> preuve make -> preuve GH -> statut`
    - [x] Produire le tableau paddé complet lots 6/7/8 `service -> job source -> job monorepo -> lot -> preuve -> statut`
    - [x] Mettre a jour `spec/SPEC_EVOL_MAKE_CICD_CHECKLIST.md` avec les run ids GitHub CI verts apres correction
    - [x] Lister explicitement les tests executes et leur resultat avant entree en UAT du lot 7
  - [x] UAT
    - [x] Gate: je te presente la picture complete lots 6/7/8 `upstream -> monorepo`, service par service, job par job, avec preuves `make` + GitHub
    - [x] Gate: je te presente la matrice exhaustive des jobs historiques, leur sort cible et les preuves `make` + GitHub associees
    - [x] Gate: je te presente les artefacts produits, leur versionnage, les jobs CD reconstruits et les preuves de publication/restauration
    - [x] Gate: tu valides en UAT, apres `make clean elasticsearch-restore dev`, que les artefacts de reference sont suffisants pour ouvrir le lot 8

- [x] Lot 8 - Preprod `dev-deces.matchid.io` operationnelle
  - [x] Exec
    - [x] Inventorier les images Docker encore pilotees par les anciens repos
    - [x] Inventorier les buckets et snapshots encore pilotes par les anciens repos
    - [x] Inventorier les volumes encore pilotes par les anciens repos
    - [x] Inventorier DNS, certificats, monitoring et jobs de refresh encore pilotes par les anciens repos
    - [x] Inventorier et trancher les cibles d'image SCW `update-base-image`, `deploy-docker-pull-base`, `SCW-instance-snapshot` et `SCW-instance-image`
    - [x] Supprimer ou encadrer tout commit automatique encore declenche par une cible `make`
    - [x] Definir l'environnement cible de `dev-deces.matchid.io`
    - [x] Definir la configuration preprod hors git necessaire au monorepo
    - [x] Definir explicitement le workflow CD de deploiement preprod depuis le monorepo
    - [x] Reconstruire le job de deploiement preprod `deploy-remote` depuis le monorepo
    - [x] Valider les prerequis et variables du flux `deploy-remote` pour la preprod
    - [x] Garantir que le test public `deploy-remote-publish` cible `dev-deces.matchid.io` en preprod et non `deces.matchid.io`
    - [x] Ajouter un declenchement manuel CD pre-merge qui garde `GIT_BRANCH=dev` et ne change que la branche clonee distante
    - [x] Corriger le blocage TypeScript du build image `deces-backend` revele par le CD manuel sans changer le comportement webhook
    - [x] Corriger l'amorcage SSH SCW de `deploy-remote` pour utiliser l'utilisateur `SCW_SSHUSER` et la cle privee locale
    - [x] Corriger l'authentification Docker distante de `deploy-local` pour tirer les images privees publiees
    - [x] Provisionner l'infra de preprod depuis le monorepo
    - [x] Rendre disponible en preprod le snapshot Elasticsearch `esdata_${DATAPREP_VERSION}_${DATA_VERSION}`
    - [x] Rendre disponible en preprod l'image `backend` necessaire a l'execution du dataprep
    - [x] Deployer `deces-infra` en preprod
    - [x] Deployer l'image `deces-backend` en preprod
    - [x] Deployer l'image `deces-ui` en preprod
    - [x] Executer le flux `deploy-remote` de bout en bout pour la preprod
    - [x] Publier la configuration d'acces `dev-deces.matchid.io`
    - [x] Rattraper l'evolution upstream `deces-ui` securite + art85 depuis `fix/art-85`
    - [x] Corriger les ecarts CI/CD arbitres M1, H4, H5 et H6 sans changer le contrat upstream valide
    - [x] Rebrancher le CD `dataprep-small` sur les deux datasets upstream `deces-2020-m01.txt.gz` et `deaths.txt.gz`
    - [x] Rebrancher le CD `dataprep-year` sur `full-check` + `remote-all` SCW, en clonant le monorepo et en executant `packages/deces-dataprep`
    - [x] Rebrancher le CD `dataprep-full` sur `full-check` + `remote-all` SCW, en clonant le monorepo et en executant `packages/deces-dataprep`
    - [x] Documenter la passe d'arbitrage H1/H2/H3/H7 avant tout changement supplementaire de Makefile ou Dockerfile
    - [x] Restaurer la sequence CI upstream de `deces-backend`: `backend-build-image`, `deploy-dependencies`, `backend-test-vitest`
    - [x] Realigner la commande Vitest `deces-backend` sur l'upstream `npm run test --verbose`
    - [x] Corriger H7 en remplacant le contournement `DATA_DIR=build-data` par le repertoire package-local upstream `DATA_DIR=data`
    - [x] Corriger le montage Vitest CI de `deces-backend` pour reutiliser en absolu le repertoire `packages/deces-backend/data`
  - [x] Tests
    - [x] Valider la restauration effective du snapshot Elasticsearch par `deploy-remote` en preprod
    - [x] Valider le test API en preprod
    - [x] Valider le test UI en preprod
    - [x] Valider la chaine dataprep -> index -> backend -> ui en preprod
    - [x] Valider statiquement les workflows CI/CD apres correction des ecarts arbitres
    - [x] Prouver sur GitHub Actions la CI complete apres correction H5/H7: run `24757045362`
    - [x] Prouver sur GitHub Actions la CI apres rattrapage upstream `deces-ui`: run `24757200408`
    - [x] Prouver sur GitHub Actions les jobs CD dataprep `small` et `year` reconstruits: runs `24777149351` et `24777914592`
    - [x] Documenter le garde-fou `dataprep-full`: non lance depuis PR car le snapshot prod attendu est absent et l'execution publierait en prod
    - [x] Valider l'observabilite preprod au niveau lot 8: `deploy-monitor` execute sans erreur, `MONITOR_BUCKET` absent documente
    - [x] Lister explicitement les tests executes et leur resultat avant entree en UAT du lot 8
  - [x] UAT
    - [x] Gate: je te presente la preprod `dev-deces.matchid.io`, son etat, les preuves de deploiement et les resultats de test
    - [x] Gate: tu valides que la preprod monorepo est acceptable et qu'on peut ouvrir le lot 9

## Workpackages actifs

Convention de suivi:

- Les statuts courants se suivent par lettre de WP: `WP-A`, `WP-B`, `WP-C`.
- Les updates de conversation doivent se lire en `fait / a faire / attendus` en s'appuyant sur ces sections.
- Les anciens lots 9 et 10 sont consideres finalises et ne portent plus le backlog actif.

### WP-A - K8s readiness complete de matchID

Objectif: faire de Kubernetes un chemin complet de run et de deploiement pour matchID, du POC valide jusqu'au dev long-lived puis au prod mutualise, en supprimant les dependances cassantes au state local et au `deploy-remote` historique.

#### Socle k8s et POC

- [x] Le POC `../poc-k8s` est valide techniquement pour matchID.
- [x] Le contrat tenant-scoped `KUBE_CONFIG_DATA` via `make tenant-kubeconfig` est valide.
- [x] Un scaffold k8s local/CI existe deja sur `origin/dev` (`deploy/k8s/` + `.github/workflows/k8s-smoke.yml`).
- [ ] Rebaser les branches de travail actives sur `origin/dev` avant de reprendre le track k8s pour disposer du socle `deploy/k8s`.
- [ ] Garder un etat source de verite unique entre le scaffold k8s du repo matchID et le contrat plateforme dans `../poc-k8s`.

#### State applicatif partage

- [x] Le prototype `OTP Redis` existe sur `fix/p0-otp-redis-store`.
- [x] Rebaser `fix/p0-otp-redis-store` sur `origin/dev`.
- [x] Rejouer `npm test -- src/mail.spec.ts --testNamePattern "fake smtp server|disposable address|validateOTP|OTP key hides"`.
- [x] Rejouer `npx tsc -p tsconfig.json --noEmit`.
- [ ] Publier puis merger la PR `OTP Redis`.
- [ ] Sortir le rate limiting / ban IP du process memory vers un store partage.
- [ ] Sortir les stop flags, input metadata et autres etats de jobs bulk du process memory vers un store partage.
- [ ] Revoir les caches charges au demarrage (`updatedFields`, cache status/version) et rendre explicite leur comportement en multi-pod.

#### Fichiers partages et stockage

- [x] L'audit de persistance backend est fait: `JOBS` et `PROOFS` restent locaux aujourd'hui.
- [ ] Decider la cible de persistance des fichiers bulk (`JOBS`) : storage objet, volume partage, ou hybride.
- [ ] Decider la cible de persistance des preuves et PDFs (`PROOFS`) : storage objet, volume partage, ou hybride.
- [ ] Implementer un chemin resilient au restart pod pour les uploads bulk en entree.
- [ ] Implementer un chemin resilient au restart pod pour les resultats bulk en sortie.
- [ ] Implementer un chemin resilient au restart pod pour les corrections JSON et les PDFs.
- [ ] Definir retention, chiffrement, cleanup et reprise apres restart pour ces artefacts.
- [ ] Si un etat de sync storage est necessaire, le tracer dans Redis ou un store d'etat, jamais dans les blobs eux-memes.

#### Workers, scaling et mode d'execution

- [ ] Distinguer les workloads API, UI, Redis, moteur de recherche et workers bulk dans la topologie k8s.
- [ ] Definir la topologie BullMQ sur k8s: worker embarque dans l'API, Deployment dedie, ou Job dedie.
- [ ] Ajouter un shutdown gracieux et un mode drain pour les jobs longs pendant rollout / eviction.
- [ ] Definir la strategie de scaling de l'API.
- [ ] Definir la strategie de scaling des workers bulk.
- [ ] Definir la strategie de scaling du moteur de recherche cible (ES aujourd'hui, Surch possiblement ensuite).
- [ ] Statuer sur l'usage de volumes partages vs storage objet pour les workers bulk.
- [ ] Statuer sur le besoin de sticky sessions ou achever un flux completement stateless.

#### Readiness, rollout et rollback

- [x] Le scaffold k8s present sur `origin/dev` couvre deja un smoke local et un smoke POC.
- [ ] Ajouter les `startupProbe` manquants et calibrer les tolerances de demarrage lent.
- [ ] Definir la procedure de rollout par environnement (`local`, `dev`, `poc`, `prod`).
- [ ] Definir la procedure de rollback d'image applicative sur k8s.
- [ ] Definir la procedure de rollback de snapshot / donnees sur k8s.
- [ ] Ajouter des gates de smoke post-deploy avant ouverture du trafic.
- [ ] Verifier explicitement un changement de version avec rollback sur backend et UI en condition k8s.

#### Observabilite, logs et supervision

- [ ] Porter `deploy-monitor` / New Relic vers une strategie k8s.
- [ ] Exporter les logs applicatifs et d'acces vers storage objet / S3.
- [ ] Definir la retention des logs et le chemin de restauration.
- [ ] Definir dashboards et alertes pour pods, jobs, queues, ingress et moteur de recherche.
- [ ] Aligner le transport des logs k8s avec les buckets historiques (`LOG_BUCKET`, `LOG_DB_BUCKET`, `MONITOR_BUCKET`) ou leur remplacement.

#### Edge, ingress, TLS et CDN

- [x] Le smoke POC peut fonctionner sans ingress public via `port-forward`.
- [ ] Standardiser le controleur d'ingress de la plateforme partagee.
- [ ] Standardiser TLS / cert-manager sur la plateforme partagee.
- [ ] Definir le modele DNS des environnements `dev`, `poc`, `preprod`, `prod`.
- [ ] Redefinir le mecanisme CDN / cache purge pour le monde k8s.
- [ ] Decider le mecanisme cible de diffusion edge pour l'UI apres bascule k8s.

#### CI/CD k8s

- [x] Le pipeline actuel build/publish/deploy existe encore via `deploy-remote`.
- [x] Un workflow `k8s-smoke.yml` existe deja sur `origin/dev`.
- [ ] Decider a quel moment k8s devient un vrai chemin de deploiement et pas seulement un smoke.
- [ ] Definir le workflow de deploiement k8s du dev partage.
- [ ] Definir le workflow de deploiement k8s du prod.
- [ ] Fixer le modele d'identite k8s officiel pour les projets (`KUBE_CONFIG_DATA` namespace-scoped industrialise, ou credentials courts remplaces proprement).
- [ ] Gerer la livraison des secrets / ConfigMaps sans derive entre environnements.
- [ ] Ajouter les gates de rollout / rollback au workflow CI/CD k8s.
- [ ] Automatiser l'onboarding, l'offboarding, la validation de contrat et la drift detection entre repo plateforme et clusters.
- [ ] Garder `deploy-remote` comme filet temporaire tant que le chemin k8s n'est pas complet.

#### Dataprep sur k8s

- [ ] Definir `deces-dataprep` comme `Job` / `CronJob` k8s et non seulement comme execution distante VM.
- [ ] Definir les classes de compute pour `small`, `year` et `full`.
- [ ] Definir l'equivalent k8s du compute lourd actuel (`PRO2-M`, `PRO2-L`) avec pools ou classes dediees.
- [ ] Definir la production de snapshot dataprep sur k8s.
- [ ] Definir la publication et la restauration du snapshot dataprep sur k8s.
- [ ] Valider le cout et la perf avant toute coupure definitive du chemin VM actuel pour le full.

#### Environnements et plateforme mutualisee

- [ ] Provisionner un environnement dev long-lived sur la plateforme k8s partagee.
- [ ] Passer du modele `1 tenant = 1 projet` au modele `1 tenant = 1 projet x environnement`.
- [ ] Definir si la preprod bascule aussi sur k8s ou reste transitoirement sur le chemin actuel.
- [ ] Provisionner un cluster prod dedie dans un projet prod mutualise.
- [ ] Definir les pools de noeuds cibles: baseline, burst, compute lourd, et leurs contraintes de scheduling.
- [ ] Definir les classes de stockage cibles par usage (`ES`, blobs, preuves, dataprep).
- [ ] Renommer / rescoper `../poc-k8s` en repo plateforme partagee une fois le modele stabilise.
- [ ] Formaliser le contrat multi-projets de cette plateforme partagee.

### WP-B - Surch parity proof et benches k8s

Objectif: prouver la compatibilite de Surch avec le besoin matchID, puis utiliser k8s pour les benches lourds et les validations de deploiement.

#### Etat prouve

- [x] Le tenant `surch` existe deja dans `../poc-k8s` comme tenant batch / burst-only.
- [x] Le track actif cote `surch` est `wp/d-matchid`.
- [x] Le replay `B1` tourne a `30/30` sur `Surch HEAD`.
- [x] Le test `B2` charge une vraie tranche INSEE 10k et valide un match representatif.

#### A faire

- [ ] Rejouer le replay contre un oracle `OpenSearch / ES-7.x`.
- [ ] Figer l'oracle de comparaison sur statuts, `hits.total`, top-hit ids et forme critique des reponses.
- [ ] Prouver le mapping `deces` complet et pas seulement un sous-ensemble de fixture.
- [ ] Prouver `dataprep -> surch` sur dataset reel.
- [ ] Prouver les requetes backend et aggregations matchID sans bascule applicative.
- [ ] Industrialiser les benches k8s `00-init-corpora`, `ndcg-gate`, `insee-bench` comme gates de preuve.
- [ ] Decider si Surch remplace Elasticsearch pour matchID ou reste d'abord un moteur de bench / R&D.

### WP-C - Tracks adjacents a preprovisionner

Objectif: preprovisionner les sujets adjacents qui vont probablement sortir du track principal sans les melanger trop tot avec `WP-A`.

#### Inventaire et cadrage

- [ ] Inventorier les sujets data / produit a ouvrir explicitement (INSEE, autres sources, RGPD, variantes dataprep, autres besoins batch).
- [ ] Identifier pour chacun le besoin de compute, stockage, observabilite et reseau.
- [ ] Distinguer ce qui reste un sous-sujet de `WP-A` de ce qui doit devenir un WP autonome.
- [ ] Ouvrir les prochains WPs lettres quand leur perimetre devient concret.
- [ ] Garder la dependance de ces tracks vers la plateforme k8s explicite.
