# MICI Score

Application web personnelle qui estime la **tolérance digestive d'un aliment ou d'un repas**, construite pour une **rectocolite ulcéro-hémorragique avec poche en J** (anastomose iléo-anale).

**Application : https://johunn.github.io/mici-score/**

> **Avertissement.** Le MICI Score est une estimation personnelle. Ce n'est ni un diagnostic, ni un traitement, ni un avis médical, et il n'a pas été validé cliniquement. Les chiffres viennent de connaissances générales et de choix arbitraires, pas d'études par aliment. Ton ressenti et ton journal priment toujours sur le score. En cas de sang dans les selles, fièvre, douleurs importantes, déshydratation, perte de poids, fuites nocturnes ou augmentation durable du nombre de selles, contacte ton gastro-entérologue.

## À quoi ça sert

- Donner un score de **0 à 10** (10 = très bien toléré) à plus de 500 aliments et plats courants.
- Composer une **assiette** (plusieurs aliments, portion ou poids en grammes) et voir le score du repas.
- Afficher des **points d'attention** (gras, lactose, fibres insolubles, gaz possibles, épices, stimulants, sucres, ultra-transformé) avec des pistes d'adaptation. Ce ne sont pas des interdits.
- Tenir un **journal** : note de ressenti de 0 à 10, Questran pris ou non, à jeun ou non, remarques.
- **Personnaliser** : corriger le score d'un aliment, régler des sensibilités par caractéristique, repérer un « déclencheur personnel » d'après le journal.

## Lecture du score

| Score | Couleur | Sens |
|---|---|---|
| 6 ou plus | vert | généralement bien toléré |
| 4 à 6 | orange | à adapter (portion, cuisson, accompagnement) |
| moins de 4 | rouge | plusieurs points d'attention |

Ces seuils sont des choix de lecture, pas des valeurs sourcées.

## Comment le score est calculé

Chaque aliment a des niveaux de 0 à 3 pour sept caractéristiques : gras, lactose, fibres insolubles, fermentescibles (gaz), épices et acidité, stimulants, sucres concentrés. Un bonus « épaississant » (riz blanc, banane, pomme de terre) réduit la pénalité.

```
pénalité = somme(poids × sensibilité × multiplicateur du profil × niveau)
           + 0,3 × additifs − 0,5 × bonus épaississant   (minimum 0)
score    = 10 × exp(−pénalité / 9)
```

Les portions (trace ×0,3, petite ×0,6, normale ×1, grosse ×1,5) et le poids saisi en grammes modulent les niveaux. Les poids de référence viennent en partie de la table belge NUBEL (Conseil supérieur de la Santé) et sinon d'estimations. Tout le détail (poids, niveaux de preuve, sources, limites, questions pour le médecin) est dans l'onglet **Sources** de l'application, à montrer à un médecin ou à un diététicien.

## Installer sur Android

1. Ouvrir https://johunn.github.io/mici-score/ dans Chrome.
2. Menu ⋮ puis **Installer l'application** (ou **Ajouter à l'écran d'accueil**).

L'appli fonctionne ensuite comme une application, en plein écran.

## Données personnelles

- Journal, corrections et réglages sont stockés **uniquement dans le navigateur de l'appareil** (`localStorage`). Aucun serveur, aucun compte, rien n'est envoyé.
- Vider les données de Chrome efface tout. Utilise **Profil > Copier la sauvegarde** de temps en temps et garde le texte dans une note.
- Le stockage est propre à chaque adresse : pour changer d'adresse, copie la sauvegarde puis restaure-la dans la nouvelle appli (**Profil > Restaurer**).
- Le bouton de partage ne transmet que le lien de l'appli, aucune donnée.

## Contenu du dépôt

| Fichier | Rôle |
|---|---|
| `index.html` | l'application complète (page unique) |
| `manifest.webmanifest` | informations d'installation (nom, icônes, couleurs) |
| `sw.js` | service worker « réseau d'abord » : charge la dernière version en ligne |
| `icons/` | icônes de l'application |
| `LISEZ-MOI.txt` | étapes d'hébergement sur GitHub Pages |

## Mettre à jour l'application

1. Remplacer `index.html` dans le dépôt (même nom de fichier) puis valider.
2. Attendre 1 à 2 minutes le déploiement de GitHub Pages (jusqu'à environ 10 minutes avec le cache).
3. Rouvrir l'appli sur le téléphone en étant en ligne. Le journal n'est pas touché.

Si `sw.js` change, le navigateur le met à jour à la visite suivante.

## Limites connues

- Aucun score, ni « feu tricolore » alimentaire validé n'existe pour la rectocolite ou la poche : celui-ci n'en est pas un.
- Niveaux par aliment estimés ; aucune source par aliment. Les produits de marque n'ont pas leur composition exacte.
- Le score d'une assiette suppose des effets additifs : l'ordre des aliments, la quantité exacte, le repas de la veille, le stress ne sont pas modélisés.
- Les coefficients de portion, le diviseur 9 et les multiplicateurs du profil sont arbitraires.
- L'application ne détecte ni pochite ni déshydratation.
- Un régime pauvre en FODMAP, s'il est utilisé pour des symptômes de type SII, doit être temporaire, en phases et suivi par un diététicien.

## Sources principales

- ECCO, Dietary Management of IBD : an ECCO Consensus (2025).
- AGA, Clinical Practice Update on diet and nutritional therapies in IBD.
- Crohn's & Colitis UK, Food and Crohn's or Colitis.
- NHS Hull University Teaching Hospitals, Eating with an ileoanal pouch.
- Ardalan et al., Aliment Pharmacol Ther 2021 (alimentation et poche, revue narrative).
- Ardalan et al., JGH Open 2023 et 2025 (Monash Pouch Diet).

La liste complète, avec liens et niveaux de preuve, est dans l'onglet Sources de l'application.

## Licence et affiliation

Projet personnel, sans licence déclarée pour l'instant : par défaut, tous droits réservés. L'application n'est affiliée à aucune association. Le ruban violet est un symbole générique de sensibilisation aux MICI (Journée mondiale le 19 mai), pas le logo d'une association.
