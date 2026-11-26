# AGENTS.md — Fiabilisation des visuels TERA EVENTS (workflow n8n + render-service)

**Cabinet La Lignée — Direction Technique (architecte : Claude · implémentation : Codex)**
Référence : CODEX-TERA-N8N-001 v1.1 — 26/11/2026
Sources : TERA-N8N-AUDIT-001 (workflow), TERA-N8N-AUDIT-002 (render-service), TERA-N8N-SPEC-001 (capacités Figma), TERA-N8N-RM-001 (règles des visuels). En cas de contradiction, **ce fichier prévaut**.

---

## 0. Ton rôle et tes règles de conduite

Tu es l'agent d'implémentation. **Tu implémentes strictement ce qui est défini ici. Tu n'inventes ni architecture, ni nœud n8n, ni dépendance, ni règle métier.**

1. **Une tâche = une branche = une Pull Request**, dans l'ordre du §9. Ne commence pas une tâche dont la précédente n'est pas fusionnée.
2. **Si une information manque ou se contredit, tu t'arrêtes.** Tu écris la question dans la PR, section `QUESTIONS`, et tu n'implémentes que ce qui n'en dépend pas.
3. **Aucune dépendance hors liste** (§4.3).
4. **Aucun secret** dans le code, les commits, les tests ou les journaux. Les identifiants n8n (OpenAI, Buffer, Drive, SMTP, rendu) restent dans n8n ; ne les référence que par leur nom.
5. **Tu n'as accès ni à n8n, ni au VPS, ni à OpenAI, ni à Google Drive, ni à Buffer.** Tu ne déploies rien et tu n'actives rien. Tout se teste hors ligne (§8).
6. **Tu ne présentes jamais un code non testé comme validé.** Chaque PR contient la sortie réelle des commandes du §8.2.
7. **Tu ne modifies pas les contenus éditoriaux** : catalogue traiteur (`knowledge/`), coordonnées, tarifs, ligne éditoriale du prompt. Seules les consignes de longueur et de format du prompt sont dans le périmètre (T05).
8. **Encodage : UTF-8 sans BOM pour tous les fichiers.** Aucun caractère `U+FFFD` ne doit subsister.
9. Commits au format Conventional Commits, en français, impératif, < 72 caractères. Identifiants de code en anglais ; textes, messages d'erreur et commentaires en français.
10. Taille cible d'une PR : < 400 lignes modifiées hors fichiers générés et `template-specs.json`.

---

## 1. Contexte métier

TERA EVENTS (Abidjan) publie trois posts par semaine (lundi, mercredi, vendredi) sur Instagram, Facebook et LinkedIn. Le dimanche à 18 h (Africa/Abidjan), un workflow n8n rédige les textes avec OpenAI, produit les visuels avec le **render-service** (Express + Playwright, gabarits reproduisant Figma), envoie un pack de validation par e-mail à la Direction, puis programme les posts validés sur Buffer.

**Problème à résoudre** : les visuels débordent souvent (textes coupés, trop grands, sortant du cadre), et une erreur de rendu fait échouer la semaine entière sans alerte.

## 2. Objectifs et critères de succès

| # | Objectif | Critère mesurable |
|---|---|---|
| O1 | Aucun texte ne déborde | Pour les 22 gabarits, un rendu avec des textes à 100 % de la limite ne présente aucun dépassement (test T03) |
| O2 | Rendu fidèle à Figma | Tailles de police du rendu = tailles Figma ; réduction automatique bornée par `minSize` (§6.1) |
| O3 | Un champ trop long n'arrête plus la semaine | Le champ fautif est reformulé ou coupé ; la semaine continue (tests T05, T06) |
| O4 | Aucun échec silencieux | Toute erreur ou tout abandon déclenche un e-mail d'alerte (T06) |
| O5 | Photos traiteur réelles uniquement | Aucune image IA dans `declic:traiteur` ni `savoirfaire:traiteur` (T07) |
| O6 | Dépôt = production | `node build_n8n_workflow.js` reproduit le workflow de production (T00) |

## 3. Règles métier

| # | Règle |
|---|---|
| RM1 | Les limites de chaque champ (caractères, lignes, taille minimale) ont **une seule source** : `render-service/template-specs.json`. Le prompt, la validation n8n et le render-service la lisent ; aucune limite n'est écrite ailleurs. |
| RM2 | Aucune consigne de longueur exprimée en **mots** dans le prompt : uniquement des caractères, issus de RM1. |
| RM3 | Un champ trop long est d'abord **reformulé** (2 essais au maximum), puis **coupé au dernier mot entier** avec une ellipse (« … ») s'il dépasse encore. Chaque coupe est signalée dans le pack de validation. |
| RM4 | Le render-service **ne renvoie jamais 500 pour un débordement** : il renvoie 422 avec la liste des champs (contrat §7.2). |
| RM5 | Familles `declic:traiteur` et `savoirfaire:traiteur` : photo de fond tirée du dossier Drive `traiteur` (ID `128uaCDTB04L_zgdlM7adOl777Ps1BIrS`), photos non classées, **jamais** d'image générée. Une photo publiée dans les 56 derniers jours n'est pas retirée ; 5 photos différentes dans un carrousel ; photos dont le petit côté < 1080 px exclues. Sans photo éligible : fond canonique du gabarit + signalement dans le pack. |
| RM6 | Une décision visuelle « Modifier » avec une décision texte « Valider » refait **uniquement** le visuel (nouvelle photo traiteur ou nouvelle image IA selon la famille) et conserve le texte validé. |
| RM7 | Le Chiffre du mercredi reste 100 % graphique (aucune photo), comme aujourd'hui. |
| RM8 | Toute question en français commençant par Pourquoi, Comment, Qui, Que, Quel(le)(s), Quand, Où ou Combien se termine par « ? » (correction de la regex `où` corrompue). |

## 4. Architecture

### 4.1 Composants (existants, à modifier)
- `code_*.js` : code des nœuds Code n8n, injecté par `build_n8n_workflow.js` dans `workflow-tera-events.json` (export importable).
- `render-service/` : `server.js` (HTTP + Playwright), `layouts.js` (22 gabarits), `verify-templates.js`, `Dockerfile`.
- `knowledge/` : faits TERA (hors périmètre de modification).

### 4.2 Fichiers à créer
```
render-service/template-specs.json     ← RM1 (T02)
render-service/fonts/                  ← polices locales copiées depuis @fontsource (T01)
render-service/test/                   ← tests de rendu (T03)
test/                                  ← tests des nœuds Code n8n (T04+)
test/harness.js                        ← simulateur des variables n8n ($json, $input, $, $execution, $getWorkflowStaticData)
workflow-tera-errors.json              ← workflow d'erreur n8n (T06), généré par build_n8n_workflow.js
code_validate_lengths.js               ← T05
code_select_traiteur_photo.js          ← T07
CHANGELOG.md
```

### 4.3 Dépendances autorisées
| Où | Autorisé |
|---|---|
| render-service (prod) | `express`, `playwright` (versions actuelles), `@fontsource/*` pour Poppins, Playfair Display, Caveat, DM Serif Display, DM Sans, League Spartan, Inter, Geist (versions figées) |
| Tests | `node:test` et `node:assert` natifs uniquement |
| Nœuds n8n | nœuds natifs uniquement : Code, HTTP Request, IF, Google Drive, Edit Image, Send Email, Error Trigger |

Si une famille de police n'existe pas en `@fontsource`, arrête-toi et pose la question.

## 5. Modèle de données

### 5.1 `template-specs.json`
```json
{
  "version": 1,
  "templates": {
    "tera-chiffremercredi-s2": {
      "fields": {
        "statistique": { "maxChars": 5, "maxLines": 1, "size": 156, "minSize": 125, "required": true },
        "titre":       { "maxChars": 45, "maxLines": 2, "size": 58, "minSize": 47, "required": true }
      }
    }
  }
}
```
- Une entrée par gabarit de `layouts.js` (22) et par champ dynamique (`data`, `dataNormal`/`dataAccent`, `dataAccent`/`dataMain`).
- Pour les champs bicolores (`titleTwoTone`, `quoteTwoTone`), une entrée de groupe : `"titre_normal+titre_accent": { "maxChars": 26, ... }`, la limite portant sur la somme.
- `maxChars`, `maxLines` : valeurs du tableau de l'**annexe A** (copie de SPEC-001). `size` : taille actuelle dans `layouts.js`. `minSize` = `ceil(size × 0,8)`.
- Champ absent de l'annexe A : arrête-toi (`QUESTIONS`).

### 5.2 État persistant n8n (`$getWorkflowStaticData('global')`)
| Clé | Contenu | Rétention |
|---|---|---|
| `weeklyPackAccumulator[executionId]` | existant | purge des clés de plus de 7 jours à chaque exécution |
| `traiteurPhotoHistory` | `[{ fileId, usedAt (ISO) }]` | purge au-delà de 56 jours |

## 6. Spécifications fonctionnelles

### 6.1 Render-service — moteur d'ajustement (T02)
1. **Supprimer le plancher de 30 px** (`isReadableBody`, `mobileMinSize`, `minReadableSize` dans `server.js`). La taille rendue = `size` de `layouts.js`.
2. Pour **chaque** nœud texte dynamique (y compris `nowrap` et bicolores) : `data-fit-text`, `data-max-lines` = `maxLines`, `data-max-width` = largeur du conteneur, `data-min-size` = `minSize`, tous lus dans `template-specs.json`.
3. Un champ `nowrap` réduit sa police jusqu'à tenir en largeur.
4. **Contrôle de composition** après ajustement : chaque élément `[data-field]` doit être entièrement dans le cadre (`.canvas`) et ne chevaucher aucun autre élément `[data-field]`. Tolérance 1 px.
5. Dépassement résiduel (champ ou composition) → **422** (§7.2). Aucune capture n'est stockée.
6. Polices : supprimer l'`@import` Google Fonts ; déclarer des `@font-face` vers `fonts/` (servies en data URI ou fichier local), toutes les graisses utilisées par `layouts.js`, y compris Playfair Display 400 et Caveat 400. `Dockerfile` : copier `fonts/` et `template-specs.json`.
7. Avant capture : `document.fonts.check()` pour chaque famille utilisée ; échec → 500 `{ "error": "font_missing", "font": "…" }`.
8. Purge : au démarrage et toutes les 24 h, suppression des fichiers de `STORAGE_DIR` de plus de 30 jours, hors `figma-source/`.

### 6.2 n8n — validation des longueurs (T05)
Nouveau nœud Code **« Valider Longueurs »** (`code_validate_lengths.js`, `runOnceForEachItem`) entre « Parser Réponse OpenAI » et « Préparer Photo de Fond IA ».
- Entrée : item parsé (`famille`, `variante`, `slides[]`). Correspondance slide → gabarit : la `TEMPLATE_MAP` existante, **déplacée** dans un module partagé injecté par le build (une seule définition).
- Applique **avant** contrôle les normalisations existantes (statistique, ponctuation RM8).
- Sortie : item inchangé + `length_issues: [{ slide, field, length, maxChars }]` (vide si conforme).
- Branche IF « Longueurs conformes ? » : non → nœud HTTP **« Reformuler Champs »** (OpenAI Responses, même identifiant et même modèle que « Générer le contenu (OpenAI) ») avec un prompt **par champ** : texte d'origine, limite en caractères, consigne « même sens, même ton, ≤ N caractères, renvoie uniquement le texte ». Puis nouveau passage dans « Valider Longueurs » (`reformulation_attempt` + 1). Au 2e échec : coupe RM3, `length_warnings[]` renseigné, la suite continue.
- Un 422 du render-service suit le même chemin (champs listés dans `overflow`), au plus 1 fois par slide, puis coupe RM3 avec une marge de 15 % et un nouveau rendu.

### 6.3 n8n — fiabilité (T06)
| Point | Comportement attendu |
|---|---|
| Parser, JSON illisible | Lever une erreur (plus de `{error, raw}` transmis à la suite) |
| Contrôle des décisions sans commentaire | Plus d'exception : la décision devient « Modifier » avec le commentaire « Modification demandée sans commentaire ». Le champ commentaire est marqué obligatoire dans le formulaire si le nœud `emailSend` le permet ; sinon, le signaler dans `QUESTIONS` |
| « Refusé », « Abandon après 3 tentatives » | Remplacés par un nœud Send Email (même identifiant SMTP que le pack) vers l'adresse du pack : jour, famille, raison |
| Workflow d'erreur | `workflow-tera-errors.json` : Error Trigger → Send Email (nom du workflow, nœud, message, lien vers l'exécution). Le lier par `settings.errorWorkflow` = `"__TERA_ERROR_WORKFLOW_ID__"` (remplacé par l'humain) |
| Rendu | Réessais uniquement sur erreur réseau, délai dépassé ou 5xx ; jamais sur 422 |
| Collecteur | Supprimer le cas codé en dur du `2026-11-01` ; purge §5.2 |

### 6.4 n8n — photos traiteur (T07)
Pour `famille` ∈ {`declic`+`traiteur`, `savoirfaire`+`traiteur`}, la branche IA est contournée (IF « Famille traiteur ? ») :
1. **Google Drive** (nœud natif, identifiant nommé `Google Drive - TERA (lecture seule)`) : liste les fichiers image du dossier RM5 (non récursif, `trashed = false`).
2. **« Choisir Photo Traiteur »** (`code_select_traiteur_photo.js`) : retire les ID présents dans `traiteurPhotoHistory` (< 56 jours) et ceux dont `imageMediaMetadata` indique un petit côté < 1080 px ; tirage aléatoire de N photos distinctes (N = nombre de slides) ; si l'éligibilité est insuffisante, complète en réutilisant les plus anciennes de l'historique, puis signale `photo_warning`. Aucune photo → pas de `background_image` (fond canonique) + `photo_warning`.
3. **Google Drive** : téléchargement binaire. **Edit Image** : redimensionnement au plus 1350 px de côté, JPEG qualité 80.
4. Conversion en data URI → `background_images[]` (ou `background_image` pour 1 slide), `photo_files[]` (nom + lien Drive) pour le pack.
5. Écriture dans `traiteurPhotoHistory` **uniquement après** programmation réussie sur Buffer (« Vérifier Réponse Buffer »).
6. « Associer Photo Générée » ne lève plus d'erreur pour ces familles.
7. Pack de validation : afficher `photo_files`, `photo_warning`, `length_warnings`.

### 6.5 n8n — « Modifier » visuel seul (T08)
Table de décision par créneau (remplace la logique actuelle de « Contrôler Accords Texte + Visuels ») :

| Texte | Visuel | Sources | Résultat |
|---|---|---|---|
| Valider | Valider | ≠ « Sources à revoir » | `Valider` |
| Refuser | * | * | `Refuser` |
| * | Refuser | * | `Refuser` |
| Valider | Modifier | ≠ « Sources à revoir » | `ModifierVisuel` |
| autre cas | | | `Modifier` (régénération complète, comportement actuel) |

`ModifierVisuel` : nouveau tirage photo (familles traiteur) ou nouvelle image IA (autres familles hors Chiffre), puis nouveau rendu avec les textes validés, retour au pack. La limite de 3 tentatives s'applique aux deux branches.

## 7. Contrats d'interface

### 7.1 `GET /specs`
200 → contenu de `template-specs.json`. Même authentification que `/render` (en-tête `x-render-token` si `RENDER_AUTH_TOKEN` est défini).

### 7.2 `POST /render/:template`
| Cas | Code | Corps |
|---|---|---|
| Succès | 200 | inchangé : `{ id, url, width, height }` |
| Gabarit inconnu | 400 | inchangé |
| Champ requis absent | 400 | `{ "error": "missing_fields", "fields": ["titre"] }` |
| Configuration statique invalide | 400 | `{ "error": "invalid_static_field", "field": "edition_label", "length": N, "maxChars": 22 }` |
| Débordement | **422** | `{ "error": "overflow", "template": "…", "fields": [{ "field": "titre", "reason": "lines" \| "width" \| "canvas" \| "overlap", "lines": 3, "maxLines": 2, "size": 47, "minSize": 47, "length": 61, "maxChars": 45 }] }` |
| Police manquante | 500 | `{ "error": "font_missing", "font": "Caveat 400" }` |
| Autre | 500 | `{ "error": "…" }` |

## 8. Stratégie de test

### 8.1 Environnement Codex
Script de configuration (réglages de l'environnement, pas dans le code) :
```bash
cd render-service && npm ci && npx playwright install --with-deps chromium && cd ..
```
Après T01, aucun accès réseau n'est nécessaire pendant les tests.

### 8.2 Commandes (toutes doivent passer avant toute PR)
| Commande (racine) | Contenu |
|---|---|
| `npm run check:encoding` | Échoue si un fichier suivi contient `U+FFFD` ou n'est pas en UTF-8 valide |
| `npm run build` | `node build_n8n_workflow.js` |
| `npm run test:nodes` | `node --test test/` : nœuds Code avec `test/harness.js` |
| `npm run test:render` | `cd render-service && npm test` : `verify-templates.js` + tests de rendu |
| `npm run check` | Les quatre ci-dessus, dans l'ordre |

Un `package.json` racine sans dépendance porte ces scripts.

### 8.3 Tests de rendu obligatoires (T03)
Pour chacun des 22 gabarits :
- **Limite** : chaque champ rempli à `maxChars` avec un texte français réaliste (mots de 4 à 9 lettres, accents, majuscules si `uppercase`) → 200, aucun dépassement.
- **Dépassement** : un champ à `maxChars × 1,6` → 422 nommant ce champ.
- **Fidélité** : avec les textes d'exemple Figma (annexe B), la taille calculée de chaque champ = `size` (aucune réduction).
- **Polices** : `document.fonts.check` vrai pour toutes les familles, réseau coupé (`page.route('**', abort)` sauf data URI).

## 9. Tâches, dans l'ordre

| Tâche | Contenu | Critères d'acceptation |
|---|---|---|
| **T00 — Alignement dépôt / production** | L'humain dépose l'export de production dans `n8n/export-prod.json`. Le dépôt est **désaligné** : `build_n8n_workflow.js` produit d'anciens noms (« Claude », « Est Valider ? », « Préparer Pack Hebdomadaire », « Traiter la Validation Hebdomadaire ») absents de la production. Extraire le code de chaque nœud Code de l'export vers `code_*.js` ; aligner le build (noms, connexions, `settings` y compris `binaryMode`, notes, réessais) ; corriger l'encodage UTF-8 et la regex RM8 ; ajouter `check:encoding`, `package.json` racine et `CHANGELOG.md`. **Bloquée tant que l'export n'est pas déposé.** | Le JSON généré = l'export à `id`, `position`, `credentials`, `webhookId`, `versionId` près (test automatisé) ; `check:encoding` vert |
| **T01 — Polices locales** | `@fontsource/*` (§4.3), copie vers `render-service/fonts/`, `@font-face`, suppression de Google Fonts, `Dockerfile` | Test polices réseau coupé vert ; plus aucune occurrence de `fonts.googleapis` |
| **T02 — Specs et moteur d'ajustement** | `template-specs.json` (annexe A), `GET /specs`, §6.1, §7.2 | Tests unitaires du moteur : plancher supprimé, `minSize` respecté, `nowrap` ajusté, 422 conforme |
| **T03 — Tests de rendu** | §8.3 pour les 22 gabarits | 22 × 4 tests verts ; captures PNG « limite » jointes à la PR |
| **T04 — Harnais de test n8n** | `test/harness.js`, tests des nœuds existants (Parser, Préparer Requêtes Visuel, Collecter) | `test:nodes` vert |
| **T05 — Prompt et validation des longueurs** | Le prompt lit les limites de `template-specs.json` (injectées par le build, comme `knowledge/`), RM2 ; §6.2 | Aucune limite en mots dans le prompt (test) ; tests : conforme, reformulé, coupé, 422 → reformulation |
| **T06 — Fiabilité** | §6.3 | Tests du Parser, du contrôle des décisions, du collecteur ; `workflow-tera-errors.json` généré |
| **T07 — Photos traiteur** | §6.4 | Tests du tirage : exclusions 56 jours et < 1080 px, distinctes, complément, aucune photo ; aucune requête d'image IA pour les familles traiteur (test sur le graphe généré) |
| **T08 — « Modifier » visuel seul** | §6.5 | Test de la table de décision (toutes les lignes) ; branche présente dans le graphe généré |
| **T09 — Documentation** | `DOCUMENTATION.md`, `RUNBOOK.md` (alertes, 422, photos, procédure de déploiement §11), `README.md` | Relecture humaine |

## 10. Définition du « terminé »
- `npm run check` vert, sortie réelle copiée dans la PR.
- Aucune limite de texte écrite hors `template-specs.json`.
- `CHANGELOG.md` à jour.
- Écarts et questions listés.

Description de PR :
```
## Quoi
## Pourquoi (tâche Txx, règles RMx)
## Comment tester
## Résultats réels des commandes
## Captures (tâches de rendu)
## Écarts avec la spécification
## QUESTIONS
```

## 11. Déploiement (fait par un humain, pour information)
1. Export de sauvegarde du workflow actif. 2. render-service : nouvelle image Docker taguée, conteneur de test en parallèle de la production. 3. Import du workflow dans une **copie inactive**, rattachement des identifiants, création du workflow d'erreur et remplacement de `__TERA_ERROR_WORKFLOW_ID__`. 4. Exécution manuelle sans programmation Buffer. 5. Validation Direction. 6. Bascule : désactivation de l'ancien workflow, activation du nouveau, bascule de `TERA_RENDER_BASE_URL`. 7. Retour arrière : réactiver l'ancien workflow et l'ancienne image.

## 12. Hors périmètre (ne pas faire)
Déploiement, activation ou modification dans n8n, création d'identifiants, changement des formats des gabarits (décision D1 en attente), modification des maquettes Figma, indexation automatique des photos (option V2), changement de modèle OpenAI, contenus éditoriaux, passage du dépôt en privé.

## 13. Décisions en attente — valeurs de travail
| # | Décision (Direction) | Valeur de travail |
|---|---|---|
| D1 | Formats 1121×1350 et 1226×1350 → 1080×1350 ? | Formats actuels conservés |
| D2 | Visibilité du dépôt GitHub | Inchangée |
| D3 | Indexation automatique des photos (V2) | Non |
| D4 | Destinataire des alertes | Adresse du pack de validation |

---

## Annexe A — Limites par champ (copie de TERA-N8N-SPEC-001)

`edition_label` est obligatoire et statique, avec `minSize: 20`. `STATIC_FIELDS` injecte « Le chiffre du mercredi ». Ce champ est exclu du prompt et de la reformulation. Un dépassement relève du contrat `invalid_static_field` du §7.2.

Valeurs **estimées** par mesure des maquettes Figma. T03 les vérifie : si un test « limite » échoue alors que le texte respecte `maxChars`, **réduis `maxChars`** pour ce champ (jamais `minSize`) et signale-le dans la PR.

| Gabarit | Champ | maxChars | maxLines |
|---|---|---|---|
| tera-chiffremercredi-s1 à s5 | edition_label | 22 | 1 |
| tera-chiffremercredi-s1 | chiffre | 3 | 1 |
| | unite | 10 | 1 |
| | headline | 45 | 2 |
| | insight | 70 | 1 |
| tera-chiffremercredi-s2 | surtitre | 35 | 1 |
| | statistique | 5 | 1 |
| | cartouche | 26 | 1 |
| | titre | 45 | 2 |
| | texte | 120 | 2 |
| tera-chiffremercredi-s3 | surtitre | 35 | 1 |
| | titre | 26 | 1 |
| | conseil1_titre, conseil2_titre, conseil3_titre | 30 | 1 |
| | conseil1_texte, conseil2_texte, conseil3_texte | 65 | 1 |
| tera-chiffremercredi-s4 | surtitre | 35 | 1 |
| | titre | 50 | 2 |
| | detail1, detail2, detail3 | 45 | 1 |
| | conclusion | 55 | 1 |
| tera-chiffremercredi-s5 | badge | 14 | 1 |
| | titre | 60 | 3 |
| | texte | 115 | 2 |
| | cta_question | 28 | 1 |
| | cta_action | 14 | 1 |
| tera-savoirfairemercredi-s1 | titre | 38 | 3 |
| | texte | 200 | 3 |
| tera-savoirfairemercredi-s2 | repere | 20 | 1 |
| | titre | 60 | 3 |
| | texte | 140 | 2 |
| tera-savoirfairemercredi-s3 | repere | 20 | 1 |
| | titre | 40 | 2 |
| | moment1_horaire … moment3_horaire | 5 | 1 |
| | moment1_titre … moment3_titre | 14 | 1 |
| | moment1_texte … moment3_texte | 70 | 1 |
| tera-savoirfairemercredi-s4 | repere | 20 | 1 |
| | titre | 40 | 2 |
| | texte (conclusion) | 140 | 2 |
| | cta_question | 30 | 1 |
| tera-declic-traiteur | accroche | 30 | 1 |
| | titre | 15 | 1 |
| | texte | 100 | 3 |
| | prix | 6 | 1 |
| tera-declic-eventplanning-s1 | titre_normal+titre_accent | 70 | 4 |
| tera-declic-eventplanning-s2 … s5 | tag_formule | 25 | 1 |
| | titre_normal+titre_accent | 26 | 1 |
| | texte | 210 | 3 |
| tera-declic-eventplanning-s5 | cta_label | 24 | 1 |
| tera-savoirfairetraiteur-s1 | badge1 | 32 | 1 |
| | badge2 | 30 | 1 |
| | texte | 175 | 3 |
| tera-savoirfairetraiteur-s2 … s5 | gamme_ligne1 | 8 | 1 |
| | gamme_ligne2 | 12 | 1 |
| | badge | 32 | 1 |
| | texte | 125 | 2 |
| tera-ancragevendredi-a | citation_accent+citation_main | 75 | 3 |
| tera-ancragevendredi-b | headline | 90 | 3 |
| | body | 125 | 2 |

**Écart signalé** : le schéma du prompt `savoirfaire:generique` slide 3 (repère, titre, texte) ne correspond pas au gabarit `tera-savoirfairemercredi-s3` (repère, titre, 3 × horaire/titre/texte). En T05, aligne le schéma du prompt sur le gabarit (le gabarit fait foi) et liste les champs ajoutés dans la PR.

## Annexe B — Textes d'exemple Figma
Les textes d'exemple de chaque gabarit sont ceux des exports `render-service/generated/figma-source/*.png` et du fichier Figma `vZn7iir8VGn5fh8M9tIfXZ`. L'humain fournit `render-service/test/figma-samples.json` (`{ template: { field: "texte" } }`) avant T03 ; s'il est absent, T03 n'exécute pas le test « Fidélité » et le signale.
