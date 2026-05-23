# SPEC_EVOL_007 - Preuve de parite dataprep

## Objet

Tracer la preuve acceptee de non-regression data entre le dataprep historique et
le monorepo, puis retirer du tronc courant l'outillage `make` temporaire utilise
pour l'etablir.

Cette preuve complete le lot 9 du plan. Elle ne remplace pas la preuve
CI/CD avant/apres, tenue dans
[SPEC_EVOL_MAKE_CICD_CHECKLIST](SPEC_EVOL_MAKE_CICD_CHECKLIST.md).

## Portee retenue

La preuve retenue est une preuve de parite de sortie produite, pas une preuve de
restauration d'un snapshot upstream existant.

Elle compare:

- le resultat du dataprep historique execute depuis `packages/deces-dataprep`
  avec son backend historique `packages/deces-dataprep/backend`;
- le resultat du dataprep monorepo execute depuis `packages/deces-dataprep`
  avec le backend monorepo `packages/dataprep-backend`.

Dans les deux cas:

- le projet injecte est le meme:
  `packages/deces-dataprep/projects/deces-dataprep`;
- les fichiers d'entree sont les memes;
- la recette executee est la meme;
- la comparaison porte sur le contenu effectivement indexe dans Elasticsearch.

## Methodologie executee

La preuve detaillee a ete executee sur le commit `41c099bb`
`test: add dataprep parity contract`.

Le protocole temporaire faisait:

1. recuperation du meme jeu de fichiers d'entree;
2. execution dataprep "historique";
3. export de l'index Elasticsearch produit;
4. execution dataprep "monorepo";
5. export de l'index Elasticsearch produit;
6. comparaison stricte des artefacts exportes.

Le contrat compare etait:

- `count.txt`
- `mapping.json`
- `source-types.json`
- `sample.json`

Le `sample.json` etait calcule sur `10000` documents deterministes avec le seed
`424242`, apres tri global par `_id`.

Les commandes historiques executees etaient:

```text
make dataprep-parity-contract-test
make dataprep-parity-contract DATAPREP_PARITY_FILES_TO_PROCESS=deces-2020-m01.txt.gz
make dataprep-parity-contract DATAPREP_PARITY_FILES_TO_PROCESS=deaths.txt.gz
```

Cet outillage temporaire est retire du tronc courant par le commit qui ajoute ce
document. Il reste consultable dans l'historique git.

## Resultats

```text
Dataset               | Count historique | Count monorepo | Sample 10000 | Mapping/types | Statut
----------------------+------------------+----------------+--------------+---------------+--------
deces-2020-m01.txt.gz | 60557            | 60557          | ok           | ok            | pass
deaths.txt.gz         | 1355728          | 1355728        | ok           | ok            | pass
```

Note `deaths.txt.gz`:

- les logs de recette intermediaires annoncent `1355745` lignes traitees et
  `1355744` lignes ecrites;
- l'export Elasticsearch compare contient `1355728` documents des deux cotes;
- la preuve retenue est donc la parite stricte du contenu indexe exporte.

## Ecarts de code acceptes

La preuve n'impose pas `0 diff` entre `packages/deces-dataprep/backend` et
`packages/dataprep-backend`. Les ecarts retenus ont ete analyses avant
acceptation.

### Backend dataprep

```text
Fichier                        | Ecart principal                               | Statut
-------------------------------+-----------------------------------------------+---------------------------
code/recipes.py                | `raise err()` -> `raise Exception(err())`     | justifie
conf/connectors/connectors.yml | `host: elasticsearch` -> `host: ${ES_HOST}`   | justifie
docker-compose.yml             | injection `ES_HOST`                           | justifie
Dockerfile                     | durcissement build Python                     | justifie
Makefile                       | orchestration/dev/runtime monorepo            | justifie
```

Justification du diff Python:

- `err()` dans `packages/dataprep-backend/code/log.py` renvoie une chaine;
- `raise err()` n'est pas valide en Python 3, car on ne peut pas lever une
  chaine;
- `raise Exception(err())` est donc un correctif strict de chemin d'erreur, pas
  un changement fonctionnel arbitraire sur le flux nominal.

### Frontend dataprep

```text
Fichier              | Ecart principal                  | Statut
---------------------+----------------------------------+---------------------------
Dockerfile           | normalisation version npm/image  | justifie
docker-compose-build | adaptation build monorepo        | justifie
Makefile             | orchestration build/tag          | justifie
```

## Conclusion

La preuve est acceptee comme suffisante pour le lot 9 parce qu'elle demontre la
parite du resultat indexe produit sur deux jeux de donnees, avec meme projet,
meme recette et memes entrees, malgre des ecarts d'orchestration entre backend
historique et backend monorepo.

Ce document porte la preuve. Les cibles `make` temporaires utilisees pour la
construire ne font pas partie du contrat permanent du monorepo et sont donc
retirees du tronc courant.
