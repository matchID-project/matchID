# Graph Report - .  (2026-05-21)

## Corpus Check
- Large corpus: 903 files · ~1 960 993 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder, or use --no-semantic to run AST-only.

## Summary
- 2625 nodes · 4572 edges · 134 communities detected
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 76 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output


## Input Scope
- Requested: auto
- Resolved: committed (source: cli)
- Included files: 903 · Candidates: 1382
- Excluded: 0 untracked · 22140 ignored · 1 sensitive · 0 missing committed
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
- `authorize api for OAuth protocol` --uses--> `Log`  [INFERRED]
  packages/dataprep-backend/code/api.py → packages/dataprep-backend/code/log.py
- `ListUsers` --uses--> `Log`  [INFERRED]
  packages/dataprep-backend/code/api.py → packages/dataprep-backend/code/log.py
- `ListGroups` --uses--> `Log`  [INFERRED]
  packages/dataprep-backend/code/api.py → packages/dataprep-backend/code/log.py
- `ListRoles` --uses--> `Log`  [INFERRED]
  packages/dataprep-backend/code/api.py → packages/dataprep-backend/code/log.py
- `OAuthList` --uses--> `Log`  [INFERRED]
  packages/dataprep-backend/code/api.py → packages/dataprep-backend/code/log.py

## Communities

### Community 0 - "Reveal.js Slides"
Cohesion: 0.1
Nodes (78): addEventListeners(), announceStatus(), availableRoutes(), cancelAutoSlide(), closeOverlay(), configure(), createStatusElement(), cueAutoSlide() (+70 more)

### Community 1 - "DSFR Design System (vendored)"
Cohesion: 0.05
Nodes (37): Breadcrumb(), Call(), Collapse(), CollapseButton(), CollapsesGroup(), Disclosure(), DisclosureButton(), DisclosuresGroup() (+29 more)

### Community 2 - "DataPrep Backend"
Cohesion: 0.06
Nodes (6): Connector, Dataset, fwf_format(), Recipe, thread_job(), to_fwf()

### Community 3 - "DSFR Design System (vendored)"
Cohesion: 0.05
Nodes (9): DisclosureButton, HeaderLinks, InjectSvg, Modal, Root, ScrollLocker, Stunned, TabButton (+1 more)

### Community 4 - "DSFR Design System (vendored)"
Cohesion: 0.06
Nodes (29): addClass(), Call(), CollapseButton, CollapsesGroup, Engine, Get(), getClassNames(), GetMethod() (+21 more)

### Community 5 - "jQuery (vendored)"
Cohesion: 0.07
Nodes (35): A(), cb(), D(), ea(), eb(), fb(), g(), ga() (+27 more)

### Community 6 - "DSFR Design System (vendored)"
Cohesion: 0.06
Nodes (5): api$1(), Element$1, Emitter, RadioButtonGroup, Stage

### Community 7 - "DSFR Design System (vendored)"
Cohesion: 0.05
Nodes (4): f, g(), ne, p()

### Community 8 - "DSFR Design System (vendored)"
Cohesion: 0.05
Nodes (14): adjust(), de, disclose(), Ee, I(), j, k, m() (+6 more)

### Community 9 - "Deces Backend"
Cohesion: 0.11
Nodes (33): applyRegex(), cityNorm(), normalize(), countryNorm(), extractboroughNumber(), filterStopNames(), firstNameNorm(), firstNameSexMismatch() (+25 more)

### Community 10 - "DataPrep Backend"
Cohesion: 0.05
Nodes (35): login, OAuthCallbackAPI, delete text/yaml source code including the recipe (warning: a yaml source may in, get list of all configured users, return current user if logged, login api with user and hash, callback api for OAuth protocol, stop matchID backend service (+27 more)

### Community 12 - "DSFR Design System (vendored)"
Cohesion: 0.06
Nodes (6): Collection, Load, Renderer, Resizer, setAttributes(), State

### Community 13 - "DSFR Design System (vendored)"
Cohesion: 0.06
Nodes (1): Instance

### Community 14 - "Reveal.js Slides"
Cohesion: 0.24
Nodes (32): $a(), an(), b(), br(), c(), Cr(), d(), e() (+24 more)

### Community 15 - "Reveal.js Slides"
Cohesion: 0.24
Nodes (32): $a(), b(), c(), cr(), d(), e(), Ga(), gr() (+24 more)

### Community 16 - "DSFR Design System (vendored)"
Cohesion: 0.06
Nodes (3): be(), le, q

### Community 17 - "DataPrep Backend"
Cohesion: 0.1
Nodes (26): actionFile, allowed_conf_file(), allowed_upload_file(), authorize(), Conf, DatasetApi, DirectoryConf, FileConf (+18 more)

### Community 18 - "Deces UI"
Cohesion: 0.09
Nodes (19): ageRangeTypingMask(), ageRangeValidationMask(), ageTypingMask(), ageValidationMask(), capitalize(), dateEditMask(), dateRangeTransformMask(), dateRangeTypingMask() (+11 more)

### Community 19 - "DSFR Design System (vendored)"
Cohesion: 0.07
Nodes (3): Disclosure, Display, querySelectorAllArray()

### Community 20 - "Reveal.js Slides"
Cohesion: 0.24
Nodes (29): Ac(), bc(), $c(), Cc(), cl(), D(), dc(), Fc() (+21 more)

### Community 21 - "DSFR Design System (vendored)"
Cohesion: 0.11
Nodes (1): y

### Community 22 - "Test_recipes.py"
Cohesion: 0.09
Nodes (19): Regroupe les tests des fonctions dont le comportement pourrait varier     avec N, Vérifie que les colonnes dérivées par transform et rank sont correctes, S'assure que l'unfold a bien explosé les listes, S'assure que les listes vides sont conservées avec valeur de remplissage, Regroupe les tests focalisés sur les comportements potentiellement     modifiés, _recipe_with_args(), test_internal_delete(), test_internal_eval() (+11 more)

### Community 23 - "DataPrep Backend"
Cohesion: 0.11
Nodes (10): DFA, find_all_matches(), find_match(), levenshtein_automata(), Matcher, NFA, Uses lookup_func to find all words within levenshtein distance k of word.     Ar, Uses lookup_func to find all words within levenshtein distance k of word.      A (+2 more)

### Community 24 - "DSFR Design System (vendored)"
Cohesion: 0.08
Nodes (5): A, d, h(), L, resize()

### Community 25 - "Reveal.js Slides"
Cohesion: 0.25
Nodes (25): a(), Br(), co(), e(), fa(), fo(), go(), ho() (+17 more)

### Community 26 - "Reveal.js Slides"
Cohesion: 0.26
Nodes (24): _a(), Aa(), Ao(), e(), el(), Eo(), i(), jo() (+16 more)

### Community 27 - "DataPrep Backend"
Cohesion: 0.09
Nodes (9): deepupdate(), distance(), flatten(), geopoint(), levenshtein(), levenshtein_norm(), ngrams(), Recursively update a dict.     Subdict's won't be overwritten but also updated. (+1 more)

### Community 28 - "DSFR Design System (vendored)"
Cohesion: 0.12
Nodes (4): fetch(), init(), pe, replace()

### Community 29 - "DSFR Design System (vendored)"
Cohesion: 0.09
Nodes (4): Breakpoint, HeaderModal, ModalBody, Navigation

### Community 30 - "Reveal.js Slides"
Cohesion: 0.12
Nodes (2): ai(), ci()

### Community 31 - "DSFR Design System (vendored)"
Cohesion: 0.13
Nodes (11): a(), c(), h(), i(), l(), n(), o(), p() (+3 more)

### Community 32 - "Deces Backend"
Cohesion: 0.14
Nodes (7): RequestInput, buildResultSingle(), getFromGeoPoint(), isBodyResponse(), log(), runBulkRequest(), runRequest()

### Community 34 - "Reveal.js Slides"
Cohesion: 0.28
Nodes (19): de(), e(), fe(), ge(), Gr(), he(), hi(), hr() (+11 more)

### Community 35 - "Deces Backend"
Cohesion: 0.11
Nodes (8): ageRangeValidationMask(), ageValidationMask(), dateRangeTransformMask(), dateRangeValidationMask(), dateTransformMask(), dateValidationMask(), isDateLimit(), isDateRange()

### Community 36 - "DataPrep Backend"
Cohesion: 0.15
Nodes (5): Configured, FacebookSignIn, GithubSignIn, OAuthSignIn, TwitterSignIn

### Community 37 - "Reveal.js Slides"
Cohesion: 0.3
Nodes (18): Ar(), e(), ei(), fe(), ge(), he(), ke(), ki() (+10 more)

### Community 38 - "Reveal.js Slides"
Cohesion: 0.33
Nodes (17): ao(), C(), e(), eo(), io(), Jr(), n(), no() (+9 more)

### Community 39 - "Reveal.js Slides"
Cohesion: 0.25
Nodes (12): C(), Ct(), e(), ei(), i(), Mi(), o(), P() (+4 more)

### Community 40 - "Reveal.js Slides"
Cohesion: 0.14
Nodes (2): yi, zi

### Community 41 - "DSFR Design System (vendored)"
Cohesion: 0.12
Nodes (4): c(), n, r, S

### Community 42 - "Deces Backend"
Cohesion: 0.15
Nodes (7): WebhookValidationController, isInvalidHostname(), isWebhookValidated(), log(), sendWebhook(), validateChallenge(), validateWebhookUrl()

### Community 43 - "DSFR Design System (vendored)"
Cohesion: 0.16
Nodes (2): ke, Se

### Community 44 - "DSFR Design System (vendored)"
Cohesion: 0.16
Nodes (3): restore(), te, ye

### Community 45 - "DSFR Design System (vendored)"
Cohesion: 0.13
Nodes (4): AccordionsGroup, NavigationItem, queryParentSelector(), SidemenuList

### Community 46 - "DSFR Design System (vendored)"
Cohesion: 0.13
Nodes (2): Register, Registration

### Community 47 - "DSFR Design System (vendored)"
Cohesion: 0.13
Nodes (1): u

### Community 48 - "DSFR Design System (vendored)"
Cohesion: 0.12
Nodes (2): TabPanel, TabsGroup

### Community 49 - "Reveal.js Slides"
Cohesion: 0.41
Nodes (14): a(), betterTrim(), c(), d(), f(), g(), h(), i() (+6 more)

### Community 50 - "Deces Backend"
Cohesion: 0.18
Nodes (11): csvHandle(), formatJob(), JsonParseStream(), JsonStringifyStream(), log(), pbkdf2(), processChunk(), processCsv() (+3 more)

### Community 51 - "Deces Backend"
Cohesion: 0.16
Nodes (6): AuthController, log(), generateOTP(), log(), scheduleOtpExpiry(), sendOTP()

### Community 52 - "Reveal.js Slides"
Cohesion: 0.13
Nodes (1): Controls

### Community 53 - "Reveal.js Slides"
Cohesion: 0.19
Nodes (1): Fragments

### Community 54 - "Reveal.js Slides"
Cohesion: 0.14
Nodes (1): Keyboard

### Community 55 - "Deces Backend"
Cohesion: 0.14
Nodes (5): StatusController, checkClientHealth(), getClient(), LoggerStream, Reporter

### Community 56 - "DSFR Design System (vendored)"
Cohesion: 0.17
Nodes (3): FocusTrap, isFocusable(), ModalsGroup

### Community 57 - "DSFR Design System (vendored)"
Cohesion: 0.15
Nodes (2): je, we

### Community 58 - "Reveal.js Slides"
Cohesion: 0.34
Nodes (13): closest(), createSingletonNode(), createStyleSheet(), deserialize(), distanceBetween(), enterFullscreen(), extend(), getQueryHash() (+5 more)

### Community 59 - "DataPrep Backend"
Cohesion: 0.18
Nodes (7): check_rights(), check_rights_groups(), Group, Role, User, Configured, UserMixin

### Community 60 - "Reveal.js Slides"
Cohesion: 0.2
Nodes (1): AutoAnimate

### Community 61 - "DSFR Design System (vendored)"
Cohesion: 0.14
Nodes (2): Breadcrumb, EquisizedsGroup

### Community 62 - "DSFR Design System (vendored)"
Cohesion: 0.14
Nodes (2): Collapse, Table

### Community 63 - "DSFR Design System (vendored)"
Cohesion: 0.16
Nodes (2): completeAssign(), Scheme

### Community 64 - "DSFR Design System (vendored)"
Cohesion: 0.17
Nodes (3): Inspector, LogLevel, Message

### Community 65 - "DSFR Design System (vendored)"
Cohesion: 0.18
Nodes (2): E, ve

### Community 66 - "Js"
Cohesion: 0.19
Nodes (9): c(), e(), k(), l(), M(), O(), q(), T() (+1 more)

### Community 67 - "Reveal.js Slides"
Cohesion: 0.21
Nodes (1): Touch

### Community 68 - "Reveal.js Slides"
Cohesion: 0.21
Nodes (2): bi, ti()

### Community 69 - "DSFR Design System (vendored)"
Cohesion: 0.16
Nodes (1): DisclosuresGroup

### Community 70 - "Deces UI"
Cohesion: 0.24
Nodes (8): buildURLParams(), enableDisplayMode(), search(), searchSubmit(), searchTrigger(), searchURLUpdate(), toggleAdvancedSearch(), toggleFuzzySearch()

### Community 71 - "Reveal.js Slides"
Cohesion: 0.21
Nodes (1): Focus

### Community 72 - "Reveal.js Slides"
Cohesion: 0.17
Nodes (1): SlideContent

### Community 73 - "Reveal.js Slides"
Cohesion: 0.22
Nodes (1): di()

### Community 74 - "DSFR Design System (vendored)"
Cohesion: 0.15
Nodes (1): Ie

### Community 75 - "Reveal.js Slides"
Cohesion: 0.2
Nodes (1): Notes

### Community 76 - "Reveal.js Slides"
Cohesion: 0.3
Nodes (1): Overview

### Community 77 - "Reveal.js Slides"
Cohesion: 0.17
Nodes (1): Plugins

### Community 78 - "Reveal.js Slides"
Cohesion: 0.2
Nodes (1): Progress

### Community 79 - "Reveal.js Slides"
Cohesion: 0.27
Nodes (1): ri()

### Community 80 - "jQuery (vendored)"
Cohesion: 0.2
Nodes (12): addCombinator(), condense(), createPositionalPseudo(), elementMatcher(), markFunction(), matcherFromGroupMatchers(), matcherFromTokens(), multipleContexts() (+4 more)

### Community 81 - "DataPrep Frontend"
Cohesion: 0.23
Nodes (5): brDiff(), coloredDiff(), formatDate(), formatDiff(), formatSex()

### Community 82 - "Deces Backend"
Cohesion: 0.32
Nodes (10): buildAdaptativeBlockMatch(), buildAdvancedMatch(), buildAggregation(), buildFrom(), buildIndexMatch(), buildMatch(), buildRequest(), buildSimpleMatch() (+2 more)

### Community 85 - "Reveal.js Slides"
Cohesion: 0.25
Nodes (1): Playback

### Community 86 - "Reveal.js Slides"
Cohesion: 0.2
Nodes (1): Backgrounds

### Community 87 - "Reveal.js Slides"
Cohesion: 0.24
Nodes (1): Location

### Community 88 - "Reveal.js Slides"
Cohesion: 0.36
Nodes (1): ki

### Community 89 - "Reveal.js Slides"
Cohesion: 0.18
Nodes (1): li()

### Community 90 - "DSFR Design System (vendored)"
Cohesion: 0.18
Nodes (2): Equisized, TableCaption

### Community 91 - "Reveal.js Slides"
Cohesion: 0.24
Nodes (1): Pointer

### Community 92 - "Deces Backend"
Cohesion: 0.24
Nodes (1): SearchController

### Community 93 - "Reveal.js Slides"
Cohesion: 0.24
Nodes (1): SlideNumber

### Community 94 - "Reveal.js Slides"
Cohesion: 0.29
Nodes (1): oi()

### Community 95 - "DSFR Design System (vendored)"
Cohesion: 0.22
Nodes (1): oe

### Community 96 - "Deces Backend"
Cohesion: 0.4
Nodes (8): ageRangeStringQuery(), dateRangeStringQuery(), firstNameQuery(), fuzzyShouldTermQuery(), fuzzyTermQuery(), matchQuery(), nameQuery(), prefixQuery()

### Community 97 - "Deces UI"
Cohesion: 0.27
Nodes (4): axis(), caption(), render(), scale()

### Community 98 - "Deces Backend"
Cohesion: 0.31
Nodes (1): ProcessStream

### Community 99 - "DataPrep Backend"
Cohesion: 0.33
Nodes (6): check_conf(), deepupdate(), ordered_load(), Recursively update a dict.     Subdict's won't be overwritten but also updated., read_conf(), read_conf_dir()

### Community 100 - "Reveal.js Slides"
Cohesion: 0.22
Nodes (1): ii()

### Community 101 - "Reveal.js Slides"
Cohesion: 0.25
Nodes (1): Pi

### Community 102 - "DSFR Design System (vendored)"
Cohesion: 0.22
Nodes (1): z

### Community 103 - "Deces UI"
Cohesion: 0.28
Nodes (3): buildRequest(), buildSort(), validScrollId()

### Community 104 - "Reveal.js Slides"
Cohesion: 0.56
Nodes (6): a(), e(), f(), l(), Tt(), u()

### Community 105 - "Reveal.js Slides"
Cohesion: 0.56
Nodes (6): a(), f(), je(), l(), t(), u()

### Community 106 - "Reveal.js Slides"
Cohesion: 0.29
Nodes (1): Hi

### Community 107 - "Reveal.js Slides"
Cohesion: 0.32
Nodes (1): xi

### Community 108 - "jQuery (vendored)"
Cohesion: 0.25
Nodes (8): adoptValue(), ajaxConvert(), ajaxHandleResponses(), Animation(), createFxNow(), done(), propFilter(), Tween()

### Community 109 - "Deces UI"
Cohesion: 0.43
Nodes (6): ageRangeStringQuery(), dateRangeStringQuery(), firstNameQuery(), fuzzyTermQuery(), matchQuery(), prefixQuery()

### Community 110 - "Deces UI"
Cohesion: 0.46
Nodes (7): fullApiPath(), runAggregationRequest(), runCompareRequest(), runIdRequest(), runRequest(), runSearchRequest(), runSearchStreamRequest()

### Community 111 - "Reveal.js Slides"
Cohesion: 0.29
Nodes (1): Print

### Community 112 - "DataPrep Frontend"
Cohesion: 0.29
Nodes (1): ScrollManager

### Community 113 - "Package_versions.py"
Cohesion: 0.57
Nodes (6): get_version(), main(), parse_args(), read_json(), set_version(), write_json()

### Community 114 - "Deces Backend"
Cohesion: 0.4
Nodes (1): BulkController

### Community 115 - "Reveal.js Slides"
Cohesion: 0.47
Nodes (1): ni()

### Community 116 - "DSFR Design System (vendored)"
Cohesion: 0.4
Nodes (1): b

### Community 117 - "jQuery (vendored)"
Cohesion: 0.47
Nodes (6): buildFragment(), DOMEval(), domManip(), getAll(), remove(), setGlobalEval()

### Community 118 - "Reveal.js Slides"
Cohesion: 0.73
Nodes (3): e(), n(), t()

### Community 119 - "Reveal.js Slides"
Cohesion: 0.73
Nodes (3): e(), n(), t()

### Community 120 - "Reveal.js Slides"
Cohesion: 0.73
Nodes (3): getScrollOffset(), magnify(), pan()

### Community 121 - "Reveal.js Slides"
Cohesion: 0.73
Nodes (3): m(), r(), y()

### Community 122 - "Reveal.js Slides"
Cohesion: 0.73
Nodes (3): l(), m(), r()

### Community 123 - "Export_es_index_snapshot.py"
Cohesion: 0.67
Nodes (5): clear_scroll(), main(), normalize_docs(), run_curl(), write_outputs()

### Community 124 - "DataPrep Backend"
Cohesion: 0.4
Nodes (1): OAuthSignIn

### Community 127 - "Deces UI"
Cohesion: 0.6
Nodes (3): getJobData(), getJobsData(), getJobsFilteredData()

### Community 128 - "Reveal.js Slides"
Cohesion: 0.7
Nodes (2): colorBrightness(), colorToRgb()

### Community 129 - "Deces Backend"
Cohesion: 0.83
Nodes (1): AggregationController

### Community 130 - "Deces Backend"
Cohesion: 0.5
Nodes (1): JobsController

### Community 131 - "jQuery (vendored)"
Cohesion: 0.5
Nodes (4): createTween(), defaultPrefilter(), getDefaultDisplay(), showHide()

### Community 132 - "Reveal.js Slides"
Cohesion: 0.5
Nodes (1): Plugin()

### Community 133 - "Reveal.js Slides"
Cohesion: 0.5
Nodes (1): Plugin()

### Community 134 - "Reveal.js Slides"
Cohesion: 0.5
Nodes (1): Plugin()

### Community 136 - "RunAllTests.js"
Cohesion: 0.83
Nodes (3): runAllTests(), runTest(), waitForWarmup()

### Community 137 - "Reveal.js Slides"
Cohesion: 0.5
Nodes (1): loadScript()

### Community 138 - "Reveal.js Slides"
Cohesion: 0.5
Nodes (1): Plugin()

### Community 139 - "jQuery (vendored)"
Cohesion: 0.67
Nodes (3): augmentWidthOrHeight(), curCSS(), getWidthOrHeight()

### Community 143 - "jQuery (vendored)"
Cohesion: 1
Nodes (2): dataAttr(), getData()

## Knowledge Gaps
- **38 isolated node(s):** `get list of all configured users`, `return current user if logged`, `stop matchID backend service`, `get all configured elements         Lists all configured elements of the backend`, `list uploaded resources` (+33 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `DSFR Design System (vendored)`** (1 nodes): `Instance`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `DSFR Design System (vendored)`** (1 nodes): `y`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reveal.js Slides`** (2 nodes): `ai()`, `ci()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reveal.js Slides`** (2 nodes): `yi`, `zi`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `DSFR Design System (vendored)`** (2 nodes): `ke`, `Se`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `DSFR Design System (vendored)`** (2 nodes): `Register`, `Registration`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `DSFR Design System (vendored)`** (1 nodes): `u`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `DSFR Design System (vendored)`** (2 nodes): `TabPanel`, `TabsGroup`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reveal.js Slides`** (1 nodes): `Controls`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reveal.js Slides`** (1 nodes): `Fragments`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reveal.js Slides`** (1 nodes): `Keyboard`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `DSFR Design System (vendored)`** (2 nodes): `je`, `we`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reveal.js Slides`** (1 nodes): `AutoAnimate`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `DSFR Design System (vendored)`** (2 nodes): `Breadcrumb`, `EquisizedsGroup`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `DSFR Design System (vendored)`** (2 nodes): `Collapse`, `Table`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `DSFR Design System (vendored)`** (2 nodes): `completeAssign()`, `Scheme`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `DSFR Design System (vendored)`** (2 nodes): `E`, `ve`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reveal.js Slides`** (1 nodes): `Touch`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reveal.js Slides`** (2 nodes): `bi`, `ti()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `DSFR Design System (vendored)`** (1 nodes): `DisclosuresGroup`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reveal.js Slides`** (1 nodes): `Focus`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reveal.js Slides`** (1 nodes): `SlideContent`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reveal.js Slides`** (1 nodes): `di()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `DSFR Design System (vendored)`** (1 nodes): `Ie`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reveal.js Slides`** (1 nodes): `Notes`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reveal.js Slides`** (1 nodes): `Overview`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reveal.js Slides`** (1 nodes): `Plugins`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reveal.js Slides`** (1 nodes): `Progress`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reveal.js Slides`** (1 nodes): `ri()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reveal.js Slides`** (1 nodes): `Playback`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reveal.js Slides`** (1 nodes): `Backgrounds`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reveal.js Slides`** (1 nodes): `Location`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reveal.js Slides`** (1 nodes): `ki`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reveal.js Slides`** (1 nodes): `li()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `DSFR Design System (vendored)`** (2 nodes): `Equisized`, `TableCaption`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reveal.js Slides`** (1 nodes): `Pointer`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Deces Backend`** (1 nodes): `SearchController`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reveal.js Slides`** (1 nodes): `SlideNumber`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reveal.js Slides`** (1 nodes): `oi()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `DSFR Design System (vendored)`** (1 nodes): `oe`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Deces Backend`** (1 nodes): `ProcessStream`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reveal.js Slides`** (1 nodes): `ii()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reveal.js Slides`** (1 nodes): `Pi`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `DSFR Design System (vendored)`** (1 nodes): `z`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reveal.js Slides`** (1 nodes): `Hi`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reveal.js Slides`** (1 nodes): `xi`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reveal.js Slides`** (1 nodes): `Print`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `DataPrep Frontend`** (1 nodes): `ScrollManager`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Deces Backend`** (1 nodes): `BulkController`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reveal.js Slides`** (1 nodes): `ni()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `DSFR Design System (vendored)`** (1 nodes): `b`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `DataPrep Backend`** (1 nodes): `OAuthSignIn`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reveal.js Slides`** (2 nodes): `colorBrightness()`, `colorToRgb()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Deces Backend`** (1 nodes): `AggregationController`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Deces Backend`** (1 nodes): `JobsController`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reveal.js Slides`** (1 nodes): `Plugin()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reveal.js Slides`** (1 nodes): `Plugin()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reveal.js Slides`** (1 nodes): `Plugin()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reveal.js Slides`** (1 nodes): `loadScript()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reveal.js Slides`** (1 nodes): `Plugin()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `jQuery (vendored)`** (2 nodes): `dataAttr()`, `getData()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Instance` connect `DSFR Design System (vendored)` to `DSFR Design System (vendored)`, `DSFR Design System (vendored)`, `DSFR Design System (vendored)`, `DSFR Design System (vendored)`, `DSFR Design System (vendored)`, `DSFR Design System (vendored)`, `DSFR Design System (vendored)`, `DSFR Design System (vendored)`, `DSFR Design System (vendored)`, `DSFR Design System (vendored)`, `DSFR Design System (vendored)`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Why does `Log` connect `DataPrep Backend` to `DataPrep Backend`, `DataPrep Backend`, `DataPrep Backend`, `DataPrep Backend`, `DataPrep Backend`, `DataPrep Backend`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **Why does `p()` connect `DSFR Design System (vendored)` to `DSFR Design System (vendored)`, `DSFR Design System (vendored)`, `DSFR Design System (vendored)`, `DSFR Design System (vendored)`, `DSFR Design System (vendored)`, `DSFR Design System (vendored)`, `DSFR Design System (vendored)`, `DSFR Design System (vendored)`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **Are the 65 inferred relationships involving `Log` (e.g. with `ListUsers` and `ListGroups`) actually correct?**
  _`Log` has 65 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `Recipe` (e.g. with `Configured` and `Log`) actually correct?**
  _`Recipe` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `get list of all configured users`, `return current user if logged`, `stop matchID backend service` to the rest of the system?**
  _38 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Reveal.js Slides` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._