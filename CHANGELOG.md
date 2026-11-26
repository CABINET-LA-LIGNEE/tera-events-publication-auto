# Journal des modifications

## T02

- Ajoute les limites de rendu des 22 gabarits et les expose via `GET /specs`.
- Ajuste le texte entre sa taille de maquette et sa taille minimale. Signale les débordements par une réponse 422 et les erreurs du cartouche fixe du mercredi par une réponse 400.
- Vérifie les polices avant la capture et purge les anciens rendus après 30 jours.

## T01

- Intègre les polices Fontsource au service de rendu pour produire les visuels sans requête externe de police.
- Vérifie dans Chromium que les familles, graisses et styles se chargent hors ligne.

## T00

- Aligne la reconstruction hors ligne sur l’export de production du 4 novembre 2026.
- Corrige la détection des questions commençant par « Où » sur la slide 3 du Chiffre du mercredi.
