# Suivi du projet MICI Score

Dernière mise à jour : 2026-11-03

## Référence vérifiée

- Dépôt : [Johunn/mici-score](https://github.com/Johunn/mici-score)
- Branche de référence : `main`
- Commit vérifié : [`6ab55009322962173d558329b3e7a74338d87260`](https://github.com/Johunn/mici-score/commit/6ab55009322962173d558329b3e7a74338d87260), daté du 2026-10-16, « Forcer le renouvellement des scripts de score et recettes ».
- Vérification effectuée le 2026-11-03. Le dépôt indique `main` comme branche par défaut. La copie locale était propre, alignée sur `origin/main`, après récupération des références distantes.
- Aucune PR ouverte n’a été retournée par la recherche GitHub au moment de la vérification.
- La PR [#34](https://github.com/Johunn/mici-score/pull/34) est fermée et fusionnée. Elle versionne les scripts de score et de recettes en `?v=69` et passe le cache du service worker à `mici-score-v69`.
- La PR [#33](https://github.com/Johunn/mici-score/pull/33) est fermée et fusionnée. Elle corrige des références de portions, ajoute « Œuf entier » et inclut des contrôles de couverture des ingrédients de recettes.
- Les anciennes branches issues de chantiers fusionnés sont encore présentes sur GitHub. Aucune branche n’a été supprimée et aucun besoin de nettoyage n’a été décidé.

## État général

MICI Score est une PWA autonome avec calcul indicatif, catalogue alimentaire et recettes, journal local, export de sauvegarde, synchronisation Google Drive facultative et prise en charge hors ligne. Le README précise que les estimations ne sont ni validées scientifiquement ni un avis médical.

Le code de référence est à jour au commit ci-dessus. Ce suivi est documentaire ; aucune modification de l’application, des données personnelles, du moteur de score ou du déploiement n’a été effectuée.

## Chantiers

### Terminé — refonte de l’interface v6

- **Faits vérifiés :** la PR [#8](https://github.com/Johunn/mici-score/pull/8), « Refonte UX v6 — intégration sur la base main à jour », est fermée et fusionnée. Le commit courant expose `APP_V='v6.2'`.
- **Décision :** chantier terminé ; ne pas le rouvrir sans défaut concret.
- **Limite :** la fusion confirme l’intégration au code, mais cet audit ne refait pas de vérification visuelle ni d’essais fonctionnels des parcours.

### À réexaminer — notes de recettes signalées dans un contexte antérieur

- **Contexte rapporté, non preuve de l’état actuel :** une ancienne conversation disait que certaines notes semblaient inchangées après corrections et qu’une confirmation visuelle finale restait à faire. Les notes attendues ci-dessous sont des valeurs rapportées historiquement, pas des résultats vérifiés aujourd’hui.
- **Faits vérifiés dans le dépôt courant :** le catalogue comporte actuellement « Pâtes rapides aux courgettes et au saumon fumé », « Pâtes aux chicons et au saumon », « Salade de poulet au curry », « Mousse de café au lait » et une recette au thon, aux courgettes et au fromage. Les noms historiques ne correspondent donc pas tous exactement aux titres actuels. Les PR #33 et #34 ont depuis corrigé des références de portions et le renouvellement des scripts en cache.
- **Cibles historiques à ne pas traiter comme résultats actuels :**
  - Pâtes au saumon fumé : 4,1 → 7,4 attendu ;
  - Mousse de café au lait : 4,7 → 7,7 attendu ;
  - Salade de poulet au curry : 7,8 → 8,7 attendu ;
  - Pâtes aux chicons et au saumon : 3,3 → 5,7 attendu ;
  - Pâtes au thon et au fromage : 2,7 → 3,6 attendu.
- **Objectif :** faire correspondre chaque intitulé historique à l’identifiant actuel (ou constater qu’il a disparu), puis suivre le calcul de bout en bout : ingrédients et quantités, résolution vers le catalogue, portions de référence, profil et sensibilités, score calculé, score rendu dans la liste et la fiche.
- **Décision :** ne pas modifier les coefficients ni les notes avant d’avoir reproduit et localisé un écart. Les scores sont indicatifs, parfois partiels, et dépendent du profil et des règles courantes.
- **Risques :** comparaison entre versions ou recettes différentes ; ingrédients partiellement exclus du score ; données de portion et profil ; cache navigateur/service worker ; confusion entre tests automatisés et affichage publié.
- **Prochaine étape :** relever les identifiants et les ingrédients exacts dans `recipes.js`, recalculer avec le moteur de `score-core.js`, confronter aux assertions dans `tests/regression.test.cjs`, puis vérifier l’affichage de la version publiée séparément.
- **Critère de clôture :** chaque cible est reliée à une recette actuelle ou déclarée absente ; tout écart est expliqué et corrigé avec une preuve de calcul ; la présentation est contrôlée sur l’application publiée et son cache renouvelé, ou la vérification visuelle est explicitement laissée en attente.

### En attente de cadrage — maintenance des fichiers et branches

- **Faits vérifiés :** le dépôt contient des branches historiques en plus de `main`, dont plusieurs noms associés à des PR fusionnées. Le prompt de reprise indique qu’aucune suppression antérieure n’avait été effectuée. Aucun inventaire justifiant une suppression n’a été établi ici.
- **Décision :** ne supprimer aucun fichier ni aucune branche.
- **Prochaine étape :** si le nettoyage devient souhaité, définir d’abord son périmètre (branches distantes, fichiers du dépôt ou autres sources), puis vérifier chaque élément et son lien avec les PR.
- **Critère de clôture :** périmètre explicite, inventaire vérifiable et décision documentée avant toute suppression.

## Tests et contrôles

- **Réalisés :** métadonnées du dépôt, branche par défaut, commit de `main`, état de la copie locale, PR ouvertes, PR récentes fusionnées, présence des recettes citées, contenu du workflow de régression et statut combiné du commit courant.
- **CI du commit courant :** l’API de statut combiné n’a retourné aucun statut (`statuses: []`). Cela ne prouve ni réussite ni échec de tests.
- **Workflow repéré :** `.github/workflows/regression-tests.yml`, qui exécute `node --test tests/regression.test.cjs` avec Node.js 24 sur les PR vers `main` et les pushs concernés.
- **Non effectués dans cette reprise :** suite de tests locale, calcul indépendant des cinq recettes, vérification visuelle de l’application publiée, test sur téléphone, test de sauvegarde/restauration et parcours Google Drive/hors ligne.
- **Échec observé :** la lecture de `AGENTS.md` à la racine et d’un workflow `deploy.yml` a répondu 404 dans l’API GitHub. Le checkout ne contient pas de `AGENTS.md` à sa racine ; le seul workflow trouvé est celui des tests. Cela ne permet pas de conclure à l’absence de workflows dans d’autres chemins ou sous-répertoires.
- **Publication :** aucune publication ni modification de la production n’a été faite.

## Comment reprendre

1. Lire ce fichier, puis confirmer la branche et le commit actuels de `main` sur GitHub.
2. Partir de `main` à jour sur une branche dédiée.
3. Pour le chantier recettes, commencer par retrouver les identifiants actuels dans `recipes.js` et comprendre `recipeScore` dans `index.html` ainsi que les fonctions de calcul dans `score-core.js`.
4. Vérifier la CI par son résultat observable ; ne pas présenter les objectifs historiques comme des notes recalculées ou vérifiées visuellement.
5. Préserver les règles de score, recettes, données locales, sauvegardes, Google Drive, confidentialité et mode hors ligne, sauf justification étayée.
6. Laisser toute PR non fusionnée et ne pas déployer sans demande explicite.
