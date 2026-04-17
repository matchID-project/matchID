# SPEC EVOL - Checklist make, CI et CD

## Objet

Cette spec centralise les cibles `make` qui servent de contrat d'execution
pour le monorepo. Elle complete les specs par lot en donnant une vue cible par
cible, avec le statut de preuve local, CI ou CD.

Regles:

- toutes les validations passent par `make`;
- pas de validation par `npm`, `docker` ou scripts appeles directement;
- une preuve GitHub doit citer le workflow, le job, le run id et le statut;
- les cibles SCW et `deploy-remote` relevent du lot 8 tant qu'elles ne sont pas
  prouvees sur `dev-deces.matchid.io`.

## Etat des preuves CI/CD

Preuves observees avant creation de cette spec:

```text
Workflow  Event          Run id       Statut   Couverture
--------  -------------  -----------  -------  -------------------------------
CI        push           24542130936  pass     smoke tools/backend/dataprep/ui/e2e
CI        pull_request   24542132027  pass     smoke tools/backend/dataprep/ui/e2e
CD        push           24542130939  pass     images + snapshot dataprep
CD        dispatch       24533977844  pass     images + snapshot dataprep avec debug
```

Le run CD `24542130939` contient les jobs verts suivants:

```text
Job                              Statut
-------------------------------  ------
Detect artifact changes          pass
Publish matchid-backend image    pass
Publish matchid-frontend image   pass
Publish deces-backend image      pass
Publish deces-ui image           pass
Publish dataprep snapshot        pass
```

Le run CI PR `24542132027` contient les jobs verts suivants:

```text
Job                   Statut
--------------------  ------
Detect changed areas  pass
Tools smoke           pass
Backend smoke         pass
Dataprep smoke        pass
UI smoke              pass
End-to-end smoke      pass
```

## Cibles de validation CI

```text
Cible make racine                  Source historique                 Workflow/job monorepo        Statut
---------------------------------  --------------------------------  ---------------------------  ----------------
make smoke-tools                   packages/tools: tools-smoke       CI / Tools smoke             prouve push + PR
make smoke-backend                 deces-backend: backend-dev-test   CI / Backend smoke           prouve push + PR
make smoke-dataprep                deces-dataprep: full/check local  CI / Dataprep smoke          prouve push + PR
make smoke-ui                      deces-ui: frontend-test           CI / UI smoke                prouve push + PR
make smoke-e2e                     pas de cible inter-repos unique   CI / End-to-end smoke        prouve push + PR
make backend-dev-test              deces-backend direct              cible racine incluse         prouve local lot 3
make frontend-test                 deces-ui direct                   cible racine incluse         prouve local lot 3
```

Notes:

- `make smoke-ui` et `make smoke-e2e` demarrent une stack dev avec donnees de
  smoke, donc ils couvrent aussi le chemin `dataprep -> elasticsearch -> backend
  -> ui`.
- `make backend-dev-test` et `make frontend-test` restent disponibles comme
  cibles directes de diagnostic local, meme si les jobs CI utilisent les cibles
  `smoke-*`.

## Cibles runtime avec donnees

Ces cibles ne sont pas seulement du CI/CD: elles prouvent que le repo peut
demarrer avec des donnees exploitables.

```text
Cible make racine                  Role                              Preuve actuelle              Statut
---------------------------------  --------------------------------  ---------------------------  ----------------
make dataprep-run                  indexer depuis les donnees source lot 5 local + CD snapshot    prouve
make dataprep-data-tag             calculer le tag data canonique    utilise par dataprep/run     prouve indirect
make elasticsearch-restore         restaurer snapshot S3 vers ES     via artifact-restore local   prouve local
make artifact-restore-dataprep-snapshot  wrapper restore lot 7       preuve locale lot 7          prouve local
make dev                           demarrer ES/backend/UI en dev     lot 5 local + smoke UI/e2e   prouve
make dev-stop                      arreter la stack dev              utilise par smoke cleanup    prouve indirect
make deploy-local                  restore async + up + API test     cible legacy conservee       a revalider lot 8
```

Point a ne pas perdre: `make elasticsearch-restore` existe a la racine via
l'inclusion de `packages/deces-infra/Makefile`. Elle restaure le snapshot
`esdata_${DATAPREP_VERSION}_${DATA_VERSION}` depuis le repository S3 configure.

Pour le lot 8, le gate preprod devra demontrer explicitement:

```text
Etape                              Cible attendue
---------------------------------  --------------------------------------------
restauration preprod               make elasticsearch-restore
demarrage preprod                  make dev ou make deploy-local selon scenario
validation API                     make smoke-backend-api ou deploy remote test
validation UI                      make frontend-test ou smoke UI preprod dedie
```

## Cibles CD artefacts

```text
Cible make racine                         Artefact produit              Workflow/job monorepo               Statut
----------------------------------------  ----------------------------  ----------------------------------  ----------------
make artifact-versions                    tags artefacts                diagnostic local                    prouve local
make artifact-build-dataprep-backend      image matchid-backend         CD / Publish matchid-backend image  prouve local + GH
make artifact-publish-dataprep-backend    push matchid-backend          CD / Publish matchid-backend image  prouve local + GH
make artifact-build-dataprep-frontend     image matchid-frontend        CD / Publish matchid-frontend image prouve local + GH
make artifact-publish-dataprep-frontend   push matchid-frontend         CD / Publish matchid-frontend image prouve local + GH
make artifact-build-deces-backend         image deces-backend           CD / Publish deces-backend image    prouve local + GH
make artifact-publish-deces-backend       push deces-backend            CD / Publish deces-backend image    prouve local + GH
make artifact-build-deces-ui              image deces-ui                CD / Publish deces-ui image         prouve local + GH
make artifact-publish-deces-ui            push deces-ui                 CD / Publish deces-ui image         prouve local + GH
make artifact-build-legacy-package        package legacy matchID        master only                         cible presente
make artifact-publish-legacy-package      publish package legacy        master only                         cible presente
make artifact-produce-dataprep-snapshot   index ES local                CD / Publish dataprep snapshot      prouve local + GH
make artifact-publish-dataprep-snapshot   snapshot S3 ES                CD / Publish dataprep snapshot      prouve local + GH
make artifact-restore-dataprep-snapshot   restore snapshot ES           local                               prouve local
```

Le snapshot CD prouve au run `24542130939`:

```text
Champ                 Valeur
--------------------  ---------------------------------------------------------
bucket non-prod       fichier-des-personnes-decedees-elasticsearch-dev
files_to_process      deces-2020.txt.gz
job                   Publish dataprep snapshot
statut                pass
```

Le run de debug `24533977844` a aussi capture:

```text
Champ                 Valeur
--------------------  ---------------------------------------------------------
snapshot              esdata_6df42346_d2d7ee21
count ES              679573
artifact              dataprep-snapshot-metadata / id 6486657468
digest artifact       a50f8884a528fcf22b2919fb5d1443e1cc9e600d6efeb7bff80f6fb7e2cbc39c
```

## Cibles deploy-remote et SCW pour lot 8

Ces cibles existent mais ne sont pas encore des preuves de substitution de la
preprod. Elles doivent etre reprises dans le lot 8.

```text
Cible racine                  Role cible                         Statut lot 8
----------------------------  ----------------------------------  ----------------------
make deploy-remote            deploy preprod/prod canonique       a reconstruire/prouver
make deploy-remote-instance   configure instance remote SCW       a prouver
make deploy-remote-services   deploie services sur instance       a prouver
make deploy-remote-publish    branche nginx/API/publication       a prouver
make deploy-delete-old        nettoie anciennes instances         a prouver
make deploy-monitor           installe monitoring                 a prouver
make deploy-cdn-purge-cache   purge CDN                           a prouver
make deploy-docker-pull-base  precharge images base remote        a prouver
make update-base-image        cree image SCW base UI/deploy       a auditer/fixer/prouver
```

```text
Cible package/outils                         Role cible                  Statut lot 8
-------------------------------------------  --------------------------  -----------------------
make -C packages/deces-dataprep remote-all   execution dataprep remote   a comparer au snapshot CD
make -C packages/deces-dataprep update-base-image image SCW dataprep     a migrer ou retirer
make -C packages/tools SCW-instance-snapshot snapshot volume SCW         primitive outil
make -C packages/tools SCW-instance-image    image SCW depuis snapshot   primitive outil
```

Points d'attention lot 8:

- `make update-base-image` racine contient encore du legacy et doit etre auditee
  avant usage comme contrat monorepo.
- `packages/deces-dataprep update-base-image` modifie puis commit son Makefile:
  ce comportement ne doit pas rester implicite dans le monorepo.
- les appels `SCW-instance-snapshot` et `SCW-instance-image` sont des primitives
  outils; le lot 8 doit definir quelle cible racine les expose proprement.
- les images SCW ne remplacent pas les images Docker publiees au lot 7: elles
  servent a accelerer/provisionner l'instance distante `deploy-remote`.

Checklist lot 8 associee:

- [ ] choisir la cible canonique pour construire/actualiser l'image SCW preprod;
- [ ] supprimer ou encadrer tout commit automatique fait par une cible `make`;
- [ ] prouver `make deploy-docker-pull-base` sur l'instance preprod;
- [ ] prouver la creation d'une image SCW depuis une instance monorepo;
- [ ] prouver `make deploy-remote` de bout en bout sur `dev-deces.matchid.io`;
- [ ] prouver la restauration effective du snapshot sur la preprod;
- [ ] prouver API + UI apres bascule preprod.
