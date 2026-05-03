# Graph Report - .  (2026-05-03)

## Corpus Check
- Large corpus: 816 files · ~1,942,548 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder, or use --no-semantic to run AST-only.

## Summary
- 2625 nodes · 4882 edges · 71 communities detected
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 76 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output


## Input Scope
- Requested: auto
- Resolved: committed (source: cli)
- Included files: 816 · Candidates: 1375
- Excluded: 0 untracked · 0 ignored · 1 sensitive · 0 missing committed
- Recommendation: Use --scope all or graphify.yaml inputs.corpus for a knowledge-base folder.
## God Nodes (most connected - your core abstractions)
1. `Log` - 70 edges
2. `p()` - 55 edges
3. `Instance` - 54 edges
4. `Recipe` - 45 edges
5. `Call()` - 27 edges
6. `Element$1` - 24 edges
7. `y` - 24 edges
8. `u` - 22 edges
9. `slide()` - 20 edges
10. `ri()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `get list of all configured users` --uses--> `Log`  [INFERRED]
  packages/dataprep-backend/code/api.py → packages/dataprep-backend/code/log.py
- `return current user if logged` --uses--> `Log`  [INFERRED]
  packages/dataprep-backend/code/api.py → packages/dataprep-backend/code/log.py
- `login api with user and hash` --uses--> `Log`  [INFERRED]
  packages/dataprep-backend/code/api.py → packages/dataprep-backend/code/log.py
- `authorize api for OAuth protocol` --uses--> `Log`  [INFERRED]
  packages/dataprep-backend/code/api.py → packages/dataprep-backend/code/log.py
- `callback api for OAuth protocol` --uses--> `Log`  [INFERRED]
  packages/dataprep-backend/code/api.py → packages/dataprep-backend/code/log.py

## Communities

### Community 0 - "Community 0"
Cohesion: 0.01
Nodes (80): AccordionsGroup, addClass(), api$1(), Breadcrumb, Breakpoint, Call(), Collapse, CollapseButton (+72 more)

### Community 1 - "Community 1"
Cohesion: 0.01
Nodes (51): A, adjust(), b, be(), c(), conceal(), d, de (+43 more)

### Community 2 - "Community 2"
Cohesion: 0.02
Nodes (28): ai(), bi, C(), ci(), Ct(), di(), e(), ei() (+20 more)

### Community 3 - "Community 3"
Cohesion: 0.02
Nodes (81): AggregationController, AuthController, log(), BulkController, StatusController, WebhookValidationController, RequestInput, buildResultSingle() (+73 more)

### Community 4 - "Community 4"
Cohesion: 0.03
Nodes (82): actionFile, allowed_conf_file(), allowed_upload_file(), authorize(), Conf, DatasetApi, DirectoryConf, FileConf (+74 more)

### Community 5 - "Community 5"
Cohesion: 0.1
Nodes (78): addEventListeners(), announceStatus(), availableRoutes(), cancelAutoSlide(), closeOverlay(), configure(), createStatusElement(), cueAutoSlide() (+70 more)

### Community 6 - "Community 6"
Cohesion: 0.04
Nodes (35): addCombinator(), adoptValue(), ajaxConvert(), ajaxHandleResponses(), Animation(), augmentWidthOrHeight(), buildFragment(), condense() (+27 more)

### Community 7 - "Community 7"
Cohesion: 0.05
Nodes (37): Breadcrumb(), Call(), Collapse(), CollapseButton(), CollapsesGroup(), Disclosure(), DisclosureButton(), DisclosuresGroup() (+29 more)

### Community 8 - "Community 8"
Cohesion: 0.08
Nodes (5): Dataset, fwf_format(), Recipe, thread_job(), to_fwf()

### Community 9 - "Community 9"
Cohesion: 0.05
Nodes (16): ageRangeValidationMask(), ageValidationMask(), dateRangeTransformMask(), dateRangeValidationMask(), dateTransformMask(), dateValidationMask(), isDateLimit(), isDateRange() (+8 more)

### Community 10 - "Community 10"
Cohesion: 0.07
Nodes (35): A(), cb(), D(), ea(), eb(), fb(), g(), ga() (+27 more)

### Community 11 - "Community 11"
Cohesion: 0.24
Nodes (32): $a(), b(), c(), cr(), d(), e(), Ga(), gr() (+24 more)

### Community 12 - "Community 12"
Cohesion: 0.24
Nodes (32): $a(), an(), b(), br(), c(), Cr(), d(), e() (+24 more)

### Community 13 - "Community 13"
Cohesion: 0.09
Nodes (19): ageRangeTypingMask(), ageRangeValidationMask(), ageTypingMask(), ageValidationMask(), capitalize(), dateEditMask(), dateRangeTransformMask(), dateRangeTypingMask() (+11 more)

### Community 14 - "Community 14"
Cohesion: 0.24
Nodes (29): Ac(), bc(), $c(), Cc(), cl(), D(), dc(), Fc() (+21 more)

### Community 15 - "Community 15"
Cohesion: 0.09
Nodes (19): Regroupe les tests des fonctions dont le comportement pourrait varier     avec N, Vérifie que les colonnes dérivées par transform et rank sont correctes, S'assure que l'unfold a bien explosé les listes, S'assure que les listes vides sont conservées avec valeur de remplissage, Regroupe les tests focalisés sur les comportements potentiellement     modifiés, _recipe_with_args(), test_internal_delete(), test_internal_eval() (+11 more)

### Community 16 - "Community 16"
Cohesion: 0.13
Nodes (10): DFA, find_all_matches(), find_match(), levenshtein_automata(), Matcher, NFA, Uses lookup_func to find all words within levenshtein distance k of word.     Ar, Uses lookup_func to find all words within levenshtein distance k of word.      A (+2 more)

### Community 17 - "Community 17"
Cohesion: 0.25
Nodes (25): a(), Br(), co(), e(), fa(), fo(), go(), ho() (+17 more)

### Community 18 - "Community 18"
Cohesion: 0.26
Nodes (24): _a(), Aa(), Ao(), e(), el(), Eo(), i(), jo() (+16 more)

### Community 19 - "Community 19"
Cohesion: 0.09
Nodes (9): deepupdate(), distance(), flatten(), geopoint(), levenshtein(), levenshtein_norm(), ngrams(), Recursively update a dict.     Subdict's won't be overwritten but also updated. (+1 more)

### Community 20 - "Community 20"
Cohesion: 0.13
Nodes (11): a(), c(), h(), i(), l(), n(), o(), p() (+3 more)

### Community 21 - "Community 21"
Cohesion: 0.28
Nodes (19): de(), e(), fe(), ge(), Gr(), he(), hi(), hr() (+11 more)

### Community 22 - "Community 22"
Cohesion: 0.3
Nodes (18): Ar(), e(), ei(), fe(), ge(), he(), ke(), ki() (+10 more)

### Community 23 - "Community 23"
Cohesion: 0.33
Nodes (17): ao(), C(), e(), eo(), io(), Jr(), n(), no() (+9 more)

### Community 24 - "Community 24"
Cohesion: 0.41
Nodes (14): a(), betterTrim(), c(), d(), f(), g(), h(), i() (+6 more)

### Community 25 - "Community 25"
Cohesion: 0.13
Nodes (1): Controls

### Community 26 - "Community 26"
Cohesion: 0.19
Nodes (1): Fragments

### Community 27 - "Community 27"
Cohesion: 0.14
Nodes (1): Keyboard

### Community 28 - "Community 28"
Cohesion: 0.34
Nodes (13): closest(), createSingletonNode(), createStyleSheet(), deserialize(), distanceBetween(), enterFullscreen(), extend(), getQueryHash() (+5 more)

### Community 29 - "Community 29"
Cohesion: 0.19
Nodes (9): c(), e(), k(), l(), M(), O(), q(), T() (+1 more)

### Community 30 - "Community 30"
Cohesion: 0.2
Nodes (1): AutoAnimate

### Community 31 - "Community 31"
Cohesion: 0.24
Nodes (8): buildURLParams(), enableDisplayMode(), search(), searchSubmit(), searchTrigger(), searchURLUpdate(), toggleAdvancedSearch(), toggleFuzzySearch()

### Community 32 - "Community 32"
Cohesion: 0.21
Nodes (1): Touch

### Community 33 - "Community 33"
Cohesion: 0.23
Nodes (1): Focus

### Community 34 - "Community 34"
Cohesion: 0.17
Nodes (1): SlideContent

### Community 35 - "Community 35"
Cohesion: 0.23
Nodes (5): brDiff(), coloredDiff(), formatDate(), formatDiff(), formatSex()

### Community 36 - "Community 36"
Cohesion: 0.2
Nodes (1): Notes

### Community 37 - "Community 37"
Cohesion: 0.3
Nodes (1): Overview

### Community 38 - "Community 38"
Cohesion: 0.17
Nodes (1): Plugins

### Community 39 - "Community 39"
Cohesion: 0.2
Nodes (1): Progress

### Community 40 - "Community 40"
Cohesion: 0.25
Nodes (1): Playback

### Community 41 - "Community 41"
Cohesion: 0.2
Nodes (1): Backgrounds

### Community 42 - "Community 42"
Cohesion: 0.24
Nodes (1): Location

### Community 43 - "Community 43"
Cohesion: 0.24
Nodes (1): SearchController

### Community 44 - "Community 44"
Cohesion: 0.31
Nodes (1): ProcessStream

### Community 45 - "Community 45"
Cohesion: 0.27
Nodes (4): axis(), caption(), render(), scale()

### Community 47 - "Community 47"
Cohesion: 0.24
Nodes (1): Pointer

### Community 48 - "Community 48"
Cohesion: 0.24
Nodes (1): SlideNumber

### Community 49 - "Community 49"
Cohesion: 0.28
Nodes (3): buildRequest(), buildSort(), validScrollId()

### Community 50 - "Community 50"
Cohesion: 0.56
Nodes (6): a(), e(), f(), l(), Tt(), u()

### Community 51 - "Community 51"
Cohesion: 0.56
Nodes (6): a(), f(), je(), l(), t(), u()

### Community 52 - "Community 52"
Cohesion: 0.43
Nodes (6): ageRangeStringQuery(), dateRangeStringQuery(), firstNameQuery(), fuzzyTermQuery(), matchQuery(), prefixQuery()

### Community 53 - "Community 53"
Cohesion: 0.46
Nodes (7): fullApiPath(), runAggregationRequest(), runCompareRequest(), runIdRequest(), runRequest(), runSearchRequest(), runSearchStreamRequest()

### Community 54 - "Community 54"
Cohesion: 0.29
Nodes (1): ScrollManager

### Community 55 - "Community 55"
Cohesion: 0.29
Nodes (1): Print

### Community 56 - "Community 56"
Cohesion: 0.57
Nodes (6): get_version(), main(), parse_args(), read_json(), set_version(), write_json()

### Community 57 - "Community 57"
Cohesion: 0.73
Nodes (3): e(), n(), t()

### Community 58 - "Community 58"
Cohesion: 0.73
Nodes (3): e(), n(), t()

### Community 59 - "Community 59"
Cohesion: 0.73
Nodes (3): getScrollOffset(), magnify(), pan()

### Community 60 - "Community 60"
Cohesion: 0.73
Nodes (3): m(), r(), y()

### Community 61 - "Community 61"
Cohesion: 0.73
Nodes (3): l(), m(), r()

### Community 62 - "Community 62"
Cohesion: 0.67
Nodes (5): clear_scroll(), main(), normalize_docs(), run_curl(), write_outputs()

### Community 65 - "Community 65"
Cohesion: 0.6
Nodes (3): getJobData(), getJobsData(), getJobsFilteredData()

### Community 66 - "Community 66"
Cohesion: 0.7
Nodes (2): colorBrightness(), colorToRgb()

### Community 67 - "Community 67"
Cohesion: 0.5
Nodes (1): JobsController

### Community 69 - "Community 69"
Cohesion: 0.83
Nodes (3): runAllTests(), runTest(), waitForWarmup()

### Community 70 - "Community 70"
Cohesion: 0.5
Nodes (1): loadScript()

### Community 71 - "Community 71"
Cohesion: 0.5
Nodes (1): Plugin()

### Community 72 - "Community 72"
Cohesion: 0.5
Nodes (1): Plugin()

### Community 73 - "Community 73"
Cohesion: 0.5
Nodes (1): Plugin()

### Community 74 - "Community 74"
Cohesion: 0.5
Nodes (1): Plugin()

## Knowledge Gaps
- **38 isolated node(s):** `get list of all configured users`, `return current user if logged`, `stop matchID backend service`, `get all configured elements         Lists all configured elements of the backend`, `list uploaded resources` (+33 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 25`** (1 nodes): `Controls`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (1 nodes): `Fragments`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (1 nodes): `Keyboard`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (1 nodes): `AutoAnimate`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (1 nodes): `Touch`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (1 nodes): `Focus`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (1 nodes): `SlideContent`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (1 nodes): `Notes`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (1 nodes): `Overview`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (1 nodes): `Plugins`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (1 nodes): `Progress`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (1 nodes): `Playback`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (1 nodes): `Backgrounds`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (1 nodes): `Location`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (1 nodes): `SearchController`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (1 nodes): `ProcessStream`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (1 nodes): `Pointer`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (1 nodes): `SlideNumber`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (1 nodes): `ScrollManager`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (1 nodes): `Print`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 66`** (2 nodes): `colorBrightness()`, `colorToRgb()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 67`** (1 nodes): `JobsController`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 70`** (1 nodes): `loadScript()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 71`** (1 nodes): `Plugin()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 72`** (1 nodes): `Plugin()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 73`** (1 nodes): `Plugin()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 74`** (1 nodes): `Plugin()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Log` connect `Community 4` to `Community 16`, `Community 8`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **Are the 65 inferred relationships involving `Log` (e.g. with `ListUsers` and `ListGroups`) actually correct?**
  _`Log` has 65 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `Recipe` (e.g. with `Configured` and `Log`) actually correct?**
  _`Recipe` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `get list of all configured users`, `return current user if logged`, `stop matchID backend service` to the rest of the system?**
  _38 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.01 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.01 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.02 - nodes in this community are weakly interconnected._