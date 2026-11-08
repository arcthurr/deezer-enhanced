# Dépannage

Premier réflexe : ouvrez les *Réglages Better Deezer* (`Ctrl ,`) › **À propos**. La ligne **Éléments de Deezer reconnus** dit si Better Deezer reconnaît la page de Deezer. « Tout est en place » : le problème est ailleurs. Une liste de noms : Deezer a changé quelque chose (voir [Après une mise à jour de Deezer](#après-une-mise-à-jour-de-deezer)).

- [Rien ne change sur deezer.com](#rien-ne-change-sur-deezercom)
- [Après une mise à jour de Deezer](#après-une-mise-à-jour-de-deezer)
- [Application Windows](#application-windows)
- [Thèmes](#thèmes)
- [Paroles et vue « En écoute »](#paroles-et-vue--en-écoute-)
- [Modules](#modules)
- [Messages dans la console](#messages-dans-la-console)
- [Signaler un problème](#signaler-un-problème)

## Rien ne change sur deezer.com

| Vérifier | Solution |
| --- | --- |
| L'extension est-elle activée ? | `chrome://extensions` (ou `edge://extensions`) : *Better Deezer* activé, sans bouton rouge *Erreurs*. Rechargez deezer.com. |
| L'avez-vous désactivé ? | Appuyez sur `Ctrl ,` sur deezer.com : une fenêtre propose de le réactiver. |
| Le bon site ? | Better Deezer ne tourne que sur `www.deezer.com` (pas `account.deezer.com`, ni les anciennes pages vitrine `deezer.com/fr/`). |
| Après avoir décompressé une nouvelle version | *Charger l'extension non empaquetée* pointe vers un dossier : après avoir remplacé son contenu, cliquez la flèche de rechargement sur la carte de l'extension, puis rechargez deezer.com. |
| Une autre extension ou un userscript Deezer | Désactivez-le et rechargez : deux skins se battent pour les mêmes éléments. |
| *Coups de cœur*, *Albums*… absents de la barre latérale | Masqués par défaut. *Réglages › Barre latérale* les réaffiche un par un (ou *Rétablir par défaut*). |
| Une entrée ne se déplace pas dans *Réglages › Barre latérale* | Deezer dispose ce groupe d'une façon qu'on ne peut pas réordonner sans déplacer ses éléments, ce que Better Deezer ne fait jamais. Afficher / masquer marche toujours. |
| Userscript | Violentmonkey / Tampermonkey doit être autorisé sur deezer.com, et le script activé. Une seule copie installée (extension **ou** userscript). |

## Après une mise à jour de Deezer

Deezer publie souvent de nouvelles versions. Better Deezer ne dépend jamais des noms de classes générés par Deezer, seulement de repères stables (`data-testid`, rôles ARIA) : la plupart des mises à jour passent sans souci. Sinon :

1. *Réglages › À propos* liste les éléments **introuvables** (par exemple `volumeButton, progressInput`).
2. Coupez la fonction qui semble cassée (son interrupteur dans *Apparence* ou *Lecture et volume*), ou tout Better Deezer avec *Désactiver Better Deezer* : Deezer se recharge sans modification.
3. [Signalez-le](#signaler-un-problème) avec la liste. La correction tient en général en une ligne de `src/core/10-anchors.js`.

Une fonction qui plante est coupée automatiquement pour la session : une partie cassée ne casse jamais le reste. Son nom apparaît dans la console : `feature "…" disabled after error`.

À noter : certains éléments n'existent que sur certaines pages ou pour certains comptes. `profileButton` manque quand on est déconnecté, `volumeInput` tant que le volume n'a pas été ouvert, `homeSections` en dehors de l'accueil.

## Application Windows

| Symptôme | Cause et solution |
| --- | --- |
| `irm … \| iex` affiche du texte rouge sur la *stratégie d'exécution* | Lancez-le dans **Windows PowerShell** (pas cmd), ou clic droit sur `install.ps1` › *Exécuter avec PowerShell*. L'installation se fait pour votre compte seulement, sans droits administrateur. |
| `irm` : *La connexion a été interrompue de manière inattendue* | Le téléchargement depuis GitHub a échoué (connexion, proxy ou pare-feu). Réessayez ; sinon téléchargez `better-deezer-windows.zip` depuis les [Releases](https://github.com/Gabizoc/Better-Deezer/releases) et lancez `install.ps1` depuis le dossier décompressé. |
| *Installation annulée : Deezer.exe introuvable* | L'installation cherche aux emplacements habituels, puis demande le chemin complet de `Deezer.exe` ; Entrée annule. Installez d'abord l'application Deezer ([deezer.com/download](https://www.deezer.com/download)), ou indiquez le chemin à l'avance : `$env:BD_DEEZER_PATH = "C:\chemin\vers\Deezer.exe"` avant la commande d'installation. |
| Deezer s'ouvre sans le skin | Deezer a sans doute été mis à jour, ce qui remplace le fichier modifié. Fermez puis rouvrez votre session Windows (le correctif est remis à l'ouverture de session si Deezer est fermé), ou lancez `better-deezer apply`. `better-deezer status` dit si Deezer est modifié. Puis lisez le journal (plus bas). |
| *better-deezer* n'est pas reconnu | L'installation l'ajoute au PATH de l'utilisateur : ouvrez un **nouveau** terminal. Il se trouve dans `%LOCALAPPDATA%\BetterDeezer\bin`. |
| *Impossible de joindre les versions sur GitHub* (update) | Pas de connexion, ou GitHub limite les requêtes anonymes : réessayez dans quelques minutes. Avec GitHub CLI connecté (`gh auth login`), `better-deezer update` passe par lui. |
| *La version … ne contient pas cli.ps1, ui.ps1 : trop ancienne* | Version demandée plus ancienne que la commande elle-même (1.0.0). Installez-la depuis la page des versions. |
| *Fichier corrompu : … (somme SHA-256 différente)* | Un fichier téléchargé ne correspond pas au `SHA256SUMS.txt` de la version. Rien n'a été installé ; réessayez. |
| *Impossible de modifier Deezer : accès refusé* | Deezer est installé pour tous les utilisateurs (Program Files). Lancez l'installation depuis un PowerShell ouvert en administrateur. |
| *build/main.js not found in app.asar* | Deezer a changé la façon dont son application est emballée. Rien n'a été modifié ; signalez-le avec votre version de Deezer. |
| *The patched app.asar did not read back correctly* | Le nouveau fichier a échoué à sa vérification et n'a pas été utilisé : Deezer est intact. Signalez-le avec le journal. |
| Deezer ne démarre plus après l'installation | Lancez `better-deezer restore`. Sinon, dans `%LOCALAPPDATA%\Programs\deezer-desktop\resources`, remplacez `app.asar` par `app.asar.bd-backup`, ou réinstallez Deezer. Merci de le signaler. |
| Alerte antivirus | L'installation modifie un fichier de l'application Deezer (`app.asar`), ce que certains antivirus signalent. Les scripts sont en texte clair dans `%LOCALAPPDATA%\BetterDeezer\` : vous pouvez les lire. |
| Désinstaller | `better-deezer uninstall`, ou *Paramètres Windows › Applications › Better Deezer › Désinstaller*. Le correctif est retiré de Deezer ; vos réglages Better Deezer restent dans le stockage de Deezer jusqu'à ce que vous vidiez son cache. |

**Journal** : `better-deezer logs`, ou le fichier `%LOCALAPPDATA%\BetterDeezer\patch.log` (collez `%LOCALAPPDATA%\BetterDeezer` dans la barre d'adresse de l'Explorateur). Chaque passage y écrit le fichier de Deezer modifié, ou pourquoi il ne l'a pas été.

**DevTools dans l'application** : lancez Deezer avec `Deezer.exe --remote-debugging-port=9222`, ouvrez `http://127.0.0.1:9222` dans Chrome pour l'inspecter, et utilisez l'API `__betterDeezer` dans la console.

## Thèmes

| Message ou symptôme | Signification et solution |
| --- | --- |
| *Hors ligne : thèmes de la communauté inclus dans cette version.* | La Marketplace n'a pas pu télécharger la liste à jour depuis GitHub (hors ligne ou bloqué). Les thèmes inclus dans cette version marchent. |
| *invalid link* / *the link must start with https://* | Il faut un lien direct `https://` vers le fichier `.json`. Sur GitHub, le lien **Raw**. |
| *download failed (HTTP 404)* | Lien faux ou fichier privé. |
| *download failed: Failed to fetch* | Le site refuse le téléchargement depuis deezer.com (CORS) : téléchargez le fichier et utilisez *Choisir un fichier…* (*Réglages › Thèmes › Installer un thème*). |
| *file too large* | Un thème fait 100 Ko au plus. |
| *Impossible d'enregistrer : …* suivi d'une liste | Le thème est invalide ; chaque point dit quoi corriger, par exemple `colors.dark.bg: "blue" is not a color`. Format : [Thèmes](themes.md). |
| Avertissements de contraste dans l'éditeur (`text-2 on bg: 3.1 (min 4.5)`) | Pas une erreur : le thème s'enregistre, mais certains textes seront peu lisibles. Ajustez les couleurs nommées. |
| Un thème semble cassé après une mise à jour de Deezer | Son `css` vise peut-être un élément qui a bougé. Repassez sur *Graphite* et prévenez l'auteur du thème. |
| Clair / sombre ne change rien | Le thème n'a qu'une palette (ex. *Aurora*, sombre uniquement). Sa carte l'indique. |

## Paroles et vue « En écoute »

| Message | Signification |
| --- | --- |
| *Recherche des paroles…* | Requête à la source des paroles, en général moins d'une seconde. |
| *Pas de paroles trouvées pour ce titre.* | Ni Deezer ni LRCLIB n'ont ce titre. Tout le monde peut en ajouter sur [lrclib.net](https://lrclib.net). |
| *Instrumental ♪* | Le titre est marqué instrumental. |
| *Paroles indisponibles (connexion à lrclib.net impossible).* | Hors ligne, ou un pare-feu / bloqueur de pub bloque `lrclib.net`. Autorisez-le ou coupez le module. |
| Paroles décalées | LRCLIB a trouvé une autre version (radio edit, live). Seules les versions à moins de 8 s de la durée du titre sont acceptées, les synchronisées en priorité ; s'il n'existe que des paroles simples, elles s'affichent sans synchronisation. |
| La ligne se remplit trop vite ou trop lentement | La source est LRCLIB (indiquée sous les paroles), qui ne donne que le début de chaque ligne : le remplissage est estimé. Les paroles mot à mot de Deezer sont exactes quand Deezer les a pour ce titre. |
| Toujours *Paroles : LRCLIB*, jamais Deezer | Deezer n'a pas de paroles synchronisées pour ce titre, ou la requête à Deezer a échoué (déconnecté, réseau). Vérifiez *Réglages › Lecture et volume › Paroles* : *Deezer puis LRCLIB*. L'extension demande Chrome / Edge 111 ou plus récent. |
| `F` ne fait rien | Vous tapez dans un champ, ou le module est coupé (*Réglages › Modules*). Si rien ne joue, la vue le dit. |

## Modules

| Module | En cas de souci |
| --- | --- |
| Couleur d'accent selon la pochette | Garde l'accent du thème : la pochette n'a pas pu être lue (certaines réponses du CDN refusent la lecture). Le titre suivant marche en général. |
| Minuteur de sommeil | Il vit dans la page ouverte : recharger ou fermer Deezer l'annule. Le volume baisse, puis est remis à son niveau après la pause. |
| Masquer les bannières promotionnelles | Purement visuel. Si un bandeau apparaît encore, c'est un nouveau : signalez son texte. |
| Transitions fluides | Coupées automatiquement quand le système demande moins d'animations (Windows : *Paramètres › Accessibilité › Effets visuels › Effets d'animation*). |
| Mode compact | Seulement des espacements et des tailles ; coupez-le si quelque chose se chevauche. |

## Messages dans la console

Ouvrez les DevTools avec `F12` › *Console*. Avec l'extension, choisissez **Better Deezer** dans la liste des contextes pour utiliser `__betterDeezer`.

| Message | Signification |
| --- | --- |
| `[Better Deezer] vX.Y.Z (extension) running on …` | Tout va bien. |
| `anchors not found (Deezer may have changed, or the element is not on screen): …` | La même liste que dans *À propos*. Normal si l'élément n'est pas sur cette page. Better Deezer ne démarre que sur le lecteur, jamais sur les pages vitrine de Deezer (`/explore/…`, téléchargement, offres) : si vous le voyez là, c'est une ancienne version. Dans Chrome, il s'affiche dans le panneau *Erreurs* de l'extension ; c'est un avertissement, pas un plantage. |
| `feature "x" disabled after error in update: …` | Cette fonction a planté et a été coupée pour la session. Signalez l'erreur. |
| `volume input never mounted` | Le curseur de volume n'a pas pu atteindre celui de Deezer (rare). Un nouveau clic sur le haut-parleur règle en général le problème. |

Commandes utiles :

```js
__betterDeezer.health()            // éléments de Deezer reconnus
__betterDeezer.features()          // chaque fonction : active, coupée, en échec
__betterDeezer.disable("volume")   // couper une fonction ( .enable("volume") pour annuler )
__betterDeezer.debug()             // journaux détaillés ; __betterDeezer.debug(false) pour arrêter
```

## Signaler un problème

Ouvrez une issue sur le dépôt avec :

1. Où : navigateur et version, ou l'application Windows ; extension, userscript ou installation Windows.
2. Ce que vous avez fait et ce que vous attendiez.
3. La ligne **Éléments de Deezer reconnus** de l'onglet *À propos*, ou la sortie de `__betterDeezer.health()` et `__betterDeezer.features()`.
4. Pour l'application Windows : la sortie de `better-deezer status` et les dernières lignes de `better-deezer logs`.
5. Une capture d'écran aide.

Ne collez jamais de cookies, de jetons ni votre valeur `arl` : personne n'en a besoin pour déboguer Better Deezer.
