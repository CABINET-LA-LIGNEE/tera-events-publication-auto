# TERA EVENTS - Runbook d'exploitation

Ce runbook permet d'exploiter et réparer le workflow sans reconstruire le dispositif.

## Contrôle hebdomadaire

Avant le dimanche 18 h :

- confirmer que `TERA EVENTS - Publication Hebdomadaire` est actif et publié ;
- vérifier les crédits OpenAI et la disponibilité du render-service ;
- vérifier Gmail SMTP et Buffer ;
- confirmer qu'aucun workflow TERA de test n'est actif.

Après réception du mail :

- vérifier les trois jours attendus et toutes les slides ;
- lire les légendes et les textes affichés ;
- ouvrir Figma en cas de retouche ;
- décider séparément pour le texte et le visuel ;
- confirmer les sources lorsqu'un fait, chiffre ou tarif est présenté ;
- commenter toute demande de modification.

Après validation :

- vérifier que seules les publications doublement validées atteignent Buffer ;
- vérifier Facebook, Instagram et LinkedIn séparément ;
- conserver les identifiants Buffer ;
- contrôler la date, l'heure et le statut programmé.

## Erreur `Credentials not found`

Le credential existe peut-être encore, mais n'est plus rattaché au nœud.

1. ouvrir le nœud en erreur ;
2. sélectionner le credential TERA correct ;
3. enregistrer et publier le workflow ;
4. relancer un test sans diffusion si possible.

Rattachements attendus :

- rédaction et photos : `OpenAI - TERA EVENTS` ;
- prévisualisations : `TERA Render Service Token` ;
- mail : `Gmail SMTP - La Lignée` ;
- Buffer TERA : `Header Auth account`.

## OpenAI refuse une requête

- vérifier le solde, la facturation, la clé et le modèle ;
- lire l'erreur avant de modifier le prompt ;
- ne pas relancer en boucle une génération payante.

## Le rendu visuel échoue

- vérifier `TERA Render Service Token`, l'URL du service et le conteneur `tera-render` ;
- vérifier les ressources graphiques et l'espace disque ;
- ne pas remplacer silencieusement le visuel par une ancienne image.

## Le mail est incomplet

- vérifier le collecteur, `slide_count` et `slide_index` ;
- vérifier que chaque jour a produit toutes ses slides ;
- ne jamais envoyer un carrousel incomplet à validation.

## Buffer refuse la programmation

- lire les erreurs GraphQL, pas seulement le code HTTP ;
- vérifier le compte TERA et les `channelIds` ;
- vérifier les deux validations, les sources et une date future ;
- rechercher une programmation existante avant une nouvelle mutation ;
- ne jamais réessayer aveuglément un résultat incertain.

Si une seule plateforme échoue, réparer uniquement cette livraison. Ne pas rejouer les réseaux déjà acceptés.

## Date dépassée

Conserver le contenu et demander une nouvelle date. Ne jamais publier automatiquement à l'heure courante.

## Modification Figma

Réexporter le visuel et renouveler l'accord visuel. Si le texte affiché change, renouveler aussi l'accord texte. Une modification Figma ne met pas Buffer à jour automatiquement.

## Procédure de changement

1. relever l'état, la version active et les exécutions en attente ;
2. sauvegarder l'export courant ;
3. tester sans schedule et sans diffusion réelle ;
4. appliquer une modification limitée ;
5. tester le chemin nominal et un cas d'erreur ;
6. reporter le changement dans le workflow principal ;
7. rattacher les credentials sans copier leurs valeurs ;
8. publier le workflow ;
9. vérifier calendrier et rotation ;
10. mettre à jour GitHub ;
11. supprimer les tests devenus inutiles.

## Retour arrière

La sauvegarde inactive `TERA EVENTS - SAUVEGARDE AVANT OPENAI - 2026-10-27 1937` sert de référence. Avant de l'utiliser : sauvegarder la version actuelle, noter la rotation et les validations en attente, vérifier ses fournisseurs et ne jamais activer deux schedules simultanément.

## Arrêt et vérification humaine obligatoires

Suspendre la programmation si :

- Figma et les aperçus diffèrent ;
- une source ou un tarif est incertain ;
- Buffer renvoie un résultat inconnu ;
- la date est passée ;
- un credential semble appartenir à un autre client ;
- une correction touche une publication déjà programmée.

## Définition de terminé

Une semaine est traitée lorsque le pack complet a été présenté, les deux décisions et les sources ont été enregistrées, les exports sont persistants, chaque livraison Buffer possède un identifiant et aucun contenu refusé, incomplet ou expiré n'a été envoyé.
