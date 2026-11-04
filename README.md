# TERA EVENTS — Publication automatisée

Workflow de production de contenus pour TERA EVENTS : rédaction assistée, génération de visuels fidèles aux gabarits Figma, validation humaine puis programmation sur les réseaux sociaux.

## Cadence éditoriale

- Lundi : **Le Déclic**, pour lever une objection ou expliquer une prestation.
- Mercredi : **Savoir-Faire**, pour montrer l'expertise Event Planning, Traiteur, Décoration et Salle.
- Vendredi : **L'Ancrage**, pour relier TERA EVENTS au calendrier et aux usages ivoiriens.
- Réalisations, Reels et vidéos : publication spontanée, hors workflow automatisé.

## État de production

- 22 gabarits Figma intégrés au render-service : formats 1080 × 1080, 1121 × 1350 et 1226 × 1350 selon le modèle source.
- Workflow n8n `wrq6FhVvULDUuUUp` actif et publié.
- Préparation le dimanche à 18 h, fuseau `Africa/Abidjan`.
- Publications le lundi, mercredi et vendredi à 08 h.
- OpenAI, rendu TERA, mail de validation et Buffer rattachés à leurs credentials.
- Validation séparée des textes et des visuels, avec contrôle des sources lorsque requis.
- Figma central rattaché au pack ; création des calques encore en mode assisté.

## Démarrage local du render-service

1. Copier `.env.example` vers `.env` et renseigner les valeurs locales.
2. Installer les dépendances dans `render-service` avec `npm install`.
3. Installer Chromium avec `npx playwright install chromium` si nécessaire.
4. Lancer `npm start` depuis `render-service`.
5. Vérifier `http://localhost:3100/health`.
6. Exécuter `npm test` pour contrôler la présence des 22 gabarits, leurs dimensions Figma et leurs ressources graphiques.

Les fichiers `code_*.js` sont destinés aux nœuds Code du workflow n8n. L'architecture et les règles sont dans `DOCUMENTATION.md`. Les contrôles et procédures d'incident sont dans `RUNBOOK.md`.

`workflow-tera-events.json` est l'export importable. Il peut être régénéré avec `node build_n8n_workflow.js` après toute modification d'un module `code_*.js`.

## Sécurité

Le fichier `.env` est local et ignoré par Git. Seul `.env.example`, sans secret, doit être versionné.

## Règle de changement

Avant toute modification : sauvegarder la version active, tester sans diffusion, vérifier les credentials TERA, publier la version n8n, puis actualiser `workflow-tera-events.json`, la documentation et GitHub. Ne jamais laisser plusieurs planificateurs TERA actifs.
