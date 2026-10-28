# TERA EVENTS — Pipeline de publication automatisée

Documentation du projet, en cours de construction. Projet indépendant de `la-lignee-publication-auto`, mais qui en réplique l'architecture éprouvée (n8n + render-service Node/Playwright, validation humaine avant publication).

## 1. Vue d'ensemble

TERA EVENTS publie 3 fois par semaine (lundi, mercredi, vendredi) sur Facebook, Instagram et LinkedIn, chaque créneau ayant un angle fixe. Le week-end reste au geste spontané de l'agence (réalisations, reels), hors de ce pipeline.

**Composants prévus :**
- **n8n** — même instance que La Lignée, workflow indépendant `TERA EVENTS - Publication Hebdomadaire` (`wrq6FhVvULDUuUUp`), actif avec un déclenchement le dimanche à 07 h (Africa/Abidjan).
- **OpenAI Responses API** — rédaction dynamique des textes selon le sujet, sans recherche web, via le credential n8n isolé `OpenAI - TERA EVENTS`.
- **OpenAI Image API** — génération des photos de fond contextuelles pour les gabarits photographiques. Aucun texte, logo ni élément de composition n'est généré dans l'image ; la charte reste appliquée par Figma et le render-service.
- **`render-service`** — service Node.js/Playwright déployé dans le conteneur Docker séparé `tera-render`. n8n le joint sur `http://tera-render:3000` et les images destinées aux réseaux sont servies par `https://tera-visuels.srv1896382.hstgr.cloud`.
- **Buffer** — programmation des publications validées sur les trois canaux TERA : Facebook, Instagram et LinkedIn.

## 2. Les 3 créneaux et leurs familles de gabarits

| Jour | Famille | Rôle | Variantes disponibles |
|---|---|---|---|
| Lundi | Le Déclic | Lever une objection, répondre une question fréquente | `eventplanning` (carrousel 4 slides), `traiteur` (post unique, prix affiché) |
| Mercredi | Savoir-Faire | Un conseil, un chiffre ou une prestation TERA | `generique` (4 slides), `chiffre` (5 slides), `traiteur` (5 slides) |
| Vendredi | L'Ancrage | Une accroche courte, ancrée dans la saison/le calendrier ivoirien | `a` (citation centrée), `b` (bloc + bouton CTA) |

Chaque créneau a un **angle fixe** (le jour détermine l'angle), mais la **variante** utilisée à l'intérieur de cet angle **tourne chaque semaine**, pour que le contenu varie selon le sujet (demande explicite du cabinet). La rotation est gérée par `code_prepare_pilliers.js` via les données statiques du workflow n8n (`$getWorkflowStaticData`), un index par famille qui avance d'un cran à chaque exécution hebdomadaire.

Les pools de variantes ne contiennent que ce qui est réellement dessiné dans Figma. À enrichir au fur et à mesure (Décoration, Salle, Savoir-Faire Traiteur sont prévus mais pas encore maquettés — voir §5).

## 3. Fichiers du dépôt

- `code_prepare_pilliers.js` — détermine jour/famille/variante + rotation hebdomadaire.
- `code_prompt_prep.js` — construit le prompt éditorial : charte + schéma JSON exact par famille/variante. Contient les deux règles absolues du cabinet (écriture indétectable comme IA, orthographe irréprochable) et les faits TERA vérifiés.
- `code_parse_openai_response.js` — parsing anti-crash de la réponse OpenAI et contrôles éditoriaux bloquants.
- `code_prepare_visuals.js` — transforme le JSON éditorial en appels au render-service, un par slide, en injectant les éléments de marque fixes que le modèle ne génère jamais.
- `code_prepare_pack.js` — regroupe les trois publications dans un formulaire de validation hebdomadaire.
- `code_traiter_validation.js` — répartit les décisions Valider, Modifier et Refuser.
- `code_prepare_regeneration.js` — prépare une nouvelle tentative à partir du commentaire de validation, avec trois tentatives maximum.
- `code_prepare_buffer.js` — prépare une programmation pour Facebook, Instagram et LinkedIn à partir des canaux définis dans l'environnement n8n.
- `render-service/` — service de rendu, voir §4.

L'export `workflow-tera-events.json` assemble les appels OpenAI pour la rédaction et les photos, le rendu, le formulaire de validation, les branches de décision, la boucle de régénération et l'appel Buffer. Il est généré par `build_n8n_workflow.js`. Les credentials sont associés dans n8n et ne sont jamais enregistrés dans le dépôt.

## 4. render-service

`render-service/layouts.js` définit **22 gabarits**, reconstruits depuis le fichier Figma `GABARIT-TERA-EVENTS` (`vZn7iir8VGn5fh8M9tIfXZ`) : positions, polices, couleurs, dégradés, ombres et éléments décoratifs.

Chaque gabarit conserve une photo ou un dégradé Figma comme fond canonique. Le workflow peut toutefois fournir un champ `background_image` propre à la publication : l'image issue de la banque média TERA remplace alors automatiquement le fond canonique, tout en conservant la composition graphique du gabarit. `background_position` permet d'ajuster le cadrage si nécessaire.

`render-service/server.js` utilise des arbres de mise en page composés de groupes, rangées et éléments positionnés. Les propriétés `data` sont remplies par la rédaction automatique ; les propriétés `static` restent fixes. Les compositions, espacements et dimensions proviennent de chaque nœud Figma. Le contrôle `npm test` vérifie les 22 correspondances avec le manifeste Figma et la présence de toutes les ressources locales.

**Limitations actuelles :**
- Aucun format Story (1080×1920) n'est encore dessiné dans Figma pour ces gabarits — à faire.
- Pas de variante Décoration ni Salle pour l'instant.

## 5. Prochaines étapes

L'adresse de validation configurée est `cabinetlalignee@gmail.com`, avec le credential Gmail SMTP déjà opérationnel dans n8n.

Le catalogue traiteur validé est centralisé dans `knowledge/tera-traiteur.json`. Il contient les
formules Cocktails dînatoires, Repas assis et Pauses café, leurs compositions, leurs paliers de
prix et les conditions commerciales. Le constructeur l'injecte automatiquement dans le prompt de
rédaction : les tarifs publiés sont toujours présentés comme ceux des formules TERA EVENTS.

Les informations institutionnelles et commerciales vérifiées sur le site sont centralisées dans
`knowledge/tera-site-facts.json`. Les deux bases sont injectées ensemble lors de la rédaction. Le
catalogue transmis reste prioritaire pour toute information relative au traiteur.

Le collecteur hebdomadaire attend les trois jours et toutes leurs slides avant d'envoyer un seul
e-mail de validation. Aucun nom ou prénom de membre de l'équipe n'est autorisé dans les contenus ;
un contrôle bloque notamment toute occurrence des membres connus avant la création des visuels.

La variante `savoirfaire:chiffre` est toujours rendue comme un carrousel graphique de cinq slides.
Le pack de validation affiche systématiquement toutes les slides de chaque carrousel, numérotées et
dans leur ordre de publication. La décision Valider / Modifier / Refuser reste unique par publication,
mais elle porte sur l'ensemble des visuels affichés ; aucune slide ne peut être programmée sans avoir
été présentée dans le pack.
Elle n'accepte aucune photo de fond, y compris lorsqu'une image est produite ou transmise par erreur
en amont. Les deux garde-fous du workflow retirent et ignorent systématiquement ce champ.

La marque est toujours désignée par `TERA EVENTS`. La mention `Centre Commercial TERA` est réservée
à une indication explicite de localisation et ne peut jamais remplacer le nom de l'entreprise. Les
légendes sont produites sous forme de deux à quatre paragraphes courts et aérés ; les hashtags sont
normalisés avec leur préfixe `#` avant la validation.

Chaque légende reçoit automatiquement un bloc de contact non modifiable : WhatsApp ou appel au
`+225 05 66 22 10 10`, puis `reservations@tera.events`. Ces coordonnées ne sont jamais laissées à
la génération libre du modèle.

1. Tester le parcours génération → photo IA → rendu → validation → régénération éventuelle, sans valider la branche Buffer pendant le test.
2. Vérifier une programmation Buffer contrôlée, puis activer le déclencheur hebdomadaire.
3. Maquetter les formats Story complémentaires dans Figma.

## 6. Accès & identifiants

Les noms de variables attendues sont documentés dans `.env.example`. Le fichier `.env` local est ignoré par Git et ne doit jamais contenir de valeur destinée au dépôt.

Les trois canaux Buffer TERA sont configurés dans l'environnement local et dans l'environnement n8n :

- Facebook : `6a982d93065799be4673b410`
- Instagram : `6a982dc0065799be4673b59e`
- LinkedIn : `6a982ded065799be4673b71c`
