# MICI Score

Application web mobile (PWA) personnelle qui estime la tolérance digestive d'aliments sur une échelle de 0 à 10, pour un profil MICI avec poche iléo-anale (poche en J). Profil « Général » disponible.

**Ce sont des estimations générales, non validées scientifiquement. Ni diagnostic ni traitement. Elles ne remplacent pas l'avis d'un gastro-entérologue ou d'un diététicien. Ton vécu et ton journal priment toujours sur le score.**

Application : https://johunn.github.io/mici-score/

## Utilisation

- **Calculer** : liste d'environ 500 aliments génériques (recherche, filtre par catégorie, tri par catégories, nom ou score ; 50 aliments par page). Touche un aliment pour l'ajouter à ton assiette, `›` pour sa fiche. Dans l'assiette : portion (trace, petite, normale, grosse) ou poids en grammes, Questran pris, à jeun.
- **Journal** : note ton ressenti après un repas (0 à 10). L'appli signale des aliments « à surveiller » selon tes notes, sans modifier le score ; tu peux confirmer ou écarter.
- **Sources** : calcul, poids, niveaux de preuve et limites.
- **Profil** : thèmes, profil, sensibilités, sauvegarde.

## Lecture du score

| Score | Lecture |
|---|---|
| 6 ou plus (vert) | généralement bien toléré |
| 4 à 6 (orange) | à adapter (portion, cuisson, accompagnement) |
| moins de 4 (rouge) | plusieurs points d'attention |

Aucun aliment n'est interdit. Un `*` indique un score corrigé par toi.

## Calcul

Chaque aliment est noté de 0 à 3 sur plusieurs caractéristiques (gras, lactose, fibres insolubles, oligosaccharides, fructose et polyols, épices et acidité, stimulants, sucres concentrés, additifs), avec un bonus épaississant. La pénalité est la somme pondérée de ces niveaux ; le score vaut `10 × exp(−pénalité / 9)`. Les poids, les coefficients de portion, les seuils de couleur et le diviseur sont des **choix arbitraires** ; les niveaux par aliment sont des estimations. Aucun score alimentaire validé n'existe pour la rectocolite ou la poche. Détail et niveaux de preuve dans l'onglet Sources de l'appli.

## Installation sur Android

Ouvre https://johunn.github.io/mici-score/ dans Chrome, puis menu ⋮ > « Installer l'application » (ou « Ajouter à l'écran d'accueil »).

## Assistant de départ

À la première utilisation (aucune donnée enregistrée, ou nouveau compte Google sans données), une fenêtre propose de pré-régler le profil : poche en J, rectocolite, Crohn ou autre, avec options sténose et poussée. Le profil « Poche en J » est le seul à ajuster le score (hypothèses arbitraires) ; la sténose applique fibres insolubles ×1,5 ; la poussée ne change pas les scores. Relançable depuis Profil > Mon profil.

## Compte Google (optionnel)

Pastille « Se connecter » en haut de l'appli ou Profil > « Compte Google et synchronisation » : connexion avec Google, puis le journal et les réglages sont copiés dans un **dossier caché de ton propre Google Drive** (autorisation limitée à ce dossier). Aucune donnée n'est hébergée par l'auteur de l'appli. Il faut d'abord créer un identifiant client Google : voir `GUIDE-GOOGLE-CLOUD.md`. Ce sont des données de santé : Google les traite selon ses conditions. « Supprimer mes données en ligne » efface la copie ; « Se déconnecter » arrête la synchro.

## Données

Sans compte Google, tout reste dans le navigateur (`localStorage`) : rien n'est envoyé aux serveurs de l'éditeur. Le script de connexion de Google (Google Identity Services) est chargé quand tu ouvres l'onglet Profil : Google voit alors ton adresse IP, même sans connexion. Avec le compte, une copie est aussi dans ton Drive (voir ci-dessus). Vider les données du navigateur efface le journal. Utilise Profil > « Copier la sauvegarde » de temps en temps. Une autre adresse a un autre stockage : copie la sauvegarde, puis restaure-la.

## Contenu du dépôt

- `index.html` : toute l'application (données et code embarqués)
- `fonts/` : polices Bricolage Grotesque, Figtree et Montserrat hébergées avec l'appli (licence SIL OFL 1.1, textes dans `fonts/licences/`) : aucune requête vers Google Fonts
- `manifest.webmanifest`, `sw.js`, `icons/` : installation et mode « réseau d'abord » (le service worker ignore les requêtes vers d'autres sites)
- `GUIDE-GOOGLE-CLOUD.md` : création de l'identifiant Google
- `LISEZ-MOI.txt` : notes d'installation

## Mise à jour

Remplace `index.html` (et `sw.js` si fourni) à la racine du dépôt (même nom), attends 1 à 2 minutes le déploiement GitHub Pages, puis vérifie la version affichée discrètement en haut à gauche de l'écran et en bas de l'onglet Profil. Le journal n'est pas touché.

## Limites

- Estimations par aliment non sourcées ; effets supposés additifs ; interactions (repas de la veille, stress, quantité exacte) non modélisées.
- Peu de données publiées sur l'alimentation avec une poche en J ; le lien gras, acides biliaires et selles, et l'effet du Questran sur la poche ne sont pas démontrés.
- L'appli ne détecte ni pochite ni déshydratation. En cas de fièvre, sang, douleurs importantes, ballonnement avec arrêt des gaz et des selles, perte de poids ou selles très liquides persistantes, consulte rapidement.

## Sources principales

ECCO, Dietary Management of IBD (consensus 2025, J Crohns Colitis 19(9):jjaf122 ; PDF complet relu : déclarations 25.1 et 25.2 sur la poche, 21.1 sur la sténose, 20.1 et 12 sur le low FODMAP, 23.1 sur le gras et les acides biliaires) ; AGA Clinical Practice Update on diet in IBD ; Crohn's & Colitis UK, Food ; Ardalan et al., Aliment Pharmacol Ther 2020 (alimentation et poche) ; table belge NUBEL « Poids et mesures » (Conseil supérieur de la Santé) pour les poids de portion.

## Licence

Aucun fichier de licence : tous droits réservés.
