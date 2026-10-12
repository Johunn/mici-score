# Créer l'identifiant Google pour MICI Score (≈ 15 minutes, une seule fois)

But : obtenir un **identifiant client** (se termine par `.apps.googleusercontent.com`). Il n'est pas secret : il identifie l'appli auprès de Google. Les intitulés de la console Google Cloud changent parfois ; je ne les ai pas vérifiés en direct, donc si un libellé diffère, cherche le plus proche.

## 1. Projet
1. Va sur https://console.cloud.google.com avec le compte Google que tu veux utiliser pour l'appli.
2. En haut, sélecteur de projet > **Nouveau projet** > nom : `MICI Score` > Créer, puis sélectionne-le.

## 2. Activer l'API Drive
1. Menu > **API et services** > **Bibliothèque**.
2. Cherche **Google Drive API** > **Activer**. (Sans ça, la synchro échoue avec « Accès refusé ».)

## 3. Écran de consentement
1. Menu > **API et services** > **Écran de consentement OAuth** (ou « Google Auth Platform »).
2. Nom de l'appli : `MICI Score` ; e-mail d'assistance : le tien ; **Type d'utilisateur : Externe**.
3. **Utilisateurs de test** (Audience) : ajoute **exactement** l'adresse Gmail avec laquelle tu te connecteras dans l'appli (**obligatoire** tant que l'appli est en « Test »).
4. **Accès aux données / Champs d'application** : ajoute `openid`, `email` et `https://www.googleapis.com/auth/drive.appdata` (« Voir et gérer ses propres données de configuration dans Google Drive »). Ne rajoute rien d'autre.

## 4. Identifiant OAuth
1. Menu > **Identifiants** (ou « Clients ») > **Créer des identifiants** > **ID client OAuth**.
2. Type d'application : **Application Web**.
3. **Origines JavaScript autorisées** : `https://johunn.github.io` (sans `/mici-score`, sans `/` final).
4. **URI de redirection autorisés** : ajoute `https://johunn.github.io/mici-score/` (avec le `/` final, exactement). Elle sert uniquement à la connexion depuis l'icône installée sur l'écran d'accueil (v25) ; dans le navigateur, la fenêtre popup n'en a pas besoin. Crée (ou modifie le client existant : Identifiants > ton ID client > Enregistrer), puis copie l'**ID client**. Les changements peuvent prendre quelques minutes à s'appliquer.

## 5. Dans l'appli
Profil > « Compte Google et synchronisation » > colle l'ID > « Enregistrer l'identifiant » > « Se connecter avec Google ». Fais-le une fois par appareil, ou envoie-moi l'ID pour que je l'intègre au fichier.

## À savoir
- **Mode test :** tant que l'écran de consentement est en « Test », l'autorisation expire au bout de 7 jours : reconnexion hebdomadaire (un appui sur « Synchroniser maintenant »). Pour l'éviter : Écran de consentement > **Publier l'application**. L'autorisation utilisée est classée « non sensible », donc la publication ne devrait pas exiger de vérification poussée (à confirmer dans la console).
- Au premier passage, Google peut afficher « Google n'a pas validé cette appli » : « Paramètres avancés » > continuer. C'est normal pour ton propre projet en test.
- Les données sont dans un dossier caché du Drive (pas visible dans « Mon Drive »). Pour l'effacer : bouton « Supprimer mes données en ligne » dans l'appli, ou Drive > Paramètres > Gérer les applications.

## Dépannage
- **« Accès bloqué : … n'a pas terminé la procédure de validation de Google », Erreur 403 : access_denied** : le compte avec lequel tu te connectes n'est pas dans les testeurs. Console Google Cloud > Audience (ou Écran de consentement > Utilisateurs de test) > **Add users** > ajoute l'adresse Gmail affichée sur l'écran d'erreur > Enregistrer. Attends 1 à 5 minutes, puis réessaie dans la fenêtre Google. Alternative : **Publier l'application** (statut « En production ») ; plus aucun testeur à ajouter.
- **« Accès refusé par Google » dans l'appli après connexion** : l'API Google Drive n'est pas activée (étape 2) ou le champ d'application `drive.appdata` manque (étape 3).
- **Erreur « redirect_uri_mismatch » ou « origin_mismatch »** : l'origine JavaScript autorisée doit être exactement `https://johunn.github.io` ; l'URI de redirection (icône installée) doit être exactement `https://johunn.github.io/mici-score/`.
- **Écran blanc après le choix du compte, depuis l'icône installée (v24 et avant)** : la fenêtre popup de Google ne fonctionne pas dans une appli installée. Depuis la v25, l'appli installée utilise une redirection de la page entière (voir étape 4).

## Partager l'appli à d'autres personnes
1. Envoie-leur le lien https://johunn.github.io/mici-score/ (bouton de partage de l'appli). Sans compte, ils peuvent déjà tout utiliser en local.
2. Pour qu'ils puissent **se connecter avec Google** : console Google Cloud > Audience > **Publier l'application** (« En production »). Sans cela, seules les adresses ajoutées comme utilisateurs de test (100 maximum) peuvent se connecter, avec une autorisation qui expire après 7 jours.
3. Chacun se connecte avec **son propre compte Google** : ses données vont dans **son** Drive (dossier caché), jamais dans le tien.
4. Après publication, essaie avec un second compte Google : selon la documentation Google, l'avertissement « appli non validée » ne concerne que les autorisations sensibles ou restreintes, ce qui n'est pas le cas ici, mais Google peut demander une vérification de la marque (nom, logo, politique de confidentialité) pour afficher le nom de l'appli.

## Publier l'application (page Branding)
Le bouton « Publier l'application » reste grisé tant que la page **Branding** n'a pas les quatre informations ci-dessous.
1. Mets d'abord en ligne sur GitHub `index.html` (v17) et `confidentialite.html` (même dossier), puis vérifie que https://johunn.github.io/mici-score/confidentialite.html s'ouvre.
2. Console > **Branding** (Google Auth Platform) :
   - **Nom de l'application** : `MICI Score`
   - **E-mail d'assistance** : ton adresse
   - **Page d'accueil de l'application** : `https://johunn.github.io/mici-score/`
   - **Règles de confidentialité** : `https://johunn.github.io/mici-score/confidentialite.html`
   - **Coordonnées du développeur** : ton adresse e-mail
   - **Domaines autorisés** : la console peut te demander `github.io`. Je n'ai pas vérifié qu'elle l'accepte ; si elle refuse, note le message exact.
3. Enregistre. Ne clique pas sur « Vérifier la marque » : elle exige un domaine qui t'appartient. Sans vérification, l'écran de consentement affichera le domaine plutôt que le nom de l'appli (selon la documentation Google).
4. Va dans **Audience** > **Publier l'application** > confirme (statut « En production »).
5. Teste avec un second compte Google qui n'est pas dans les testeurs.
